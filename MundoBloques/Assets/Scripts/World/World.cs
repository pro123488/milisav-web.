using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;

namespace MundoBloques
{
    public interface IChunkStore
    {
        bool TryLoad(Dim dim, Chunk c);
        void Save(Dim dim, Chunk c);
    }

    public struct SchedTick
    {
        public long due; public int x, y, z;
    }

    /// <summary>Un mundo (una dimension): chunks, bloques, luz, ticks y carga progresiva.</summary>
    public sealed class World
    {
        public const int H = 128;
        public readonly Dim dim;
        public readonly int seed;
        public readonly IGenerator gen;
        public readonly bool hasSky;
        public readonly int sea;
        public IChunkStore store;
        public int viewDist = 6;
        public int maxGen = 2, maxMesh = 2;

        public readonly ConcurrentDictionary<long, Chunk> chunks = new ConcurrentDictionary<long, Chunk>();
        public readonly ConcurrentQueue<MeshData> meshResults = new ConcurrentQueue<MeshData>();
        public long tickCount;
        public readonly Rng rng;

        // eventos para el lado Unity
        public Action<int, int, int, List<ItemStack>> OnDrops;
        public Action<int, int, int, Block> OnFallingBlock;
        public Action<int, int, int, Block, int> OnBlockBroken;
        public Action<Chunk> OnChunkUnloaded;
        public Action<int, int, int, int> OnSpawnerTick;

        int genRunning, meshRunning;
        readonly List<SchedTick> sched = new List<SchedTick>();
        readonly Queue<int[]> notifyQueue = new Queue<int[]>();
        bool inNotify;
        readonly List<BlockEntity> tickEntities = new List<BlockEntity>();
        int frameCounter;
        Chunk lastChunk;

        public World(Dim dim, int seed)
        {
            this.dim = dim; this.seed = seed;
            rng = new Rng(seed ^ 0x5DEECE6);
            switch (dim)
            {
                case Dim.Abismo: gen = new AbismoGen(seed); hasSky = false; sea = 31; break;
                case Dim.Final: gen = new EndGen(seed); hasSky = false; sea = 0; break;
                default: gen = new OverworldGen(seed); hasSky = true; sea = OverworldGen.Sea; break;
            }
        }

        // ----------------------------------------------------------------
        // Acceso a bloques
        // ----------------------------------------------------------------
        public Chunk GetChunk(int cx, int cz)
        {
            var l = lastChunk;
            if (l != null && l.cx == cx && l.cz == cz) return l;
            Chunk c;
            if (chunks.TryGetValue(MathX.ChunkKey(cx, cz), out c)) { lastChunk = c; return c; }
            return null;
        }

        /// <summary>Acceso sin cache (seguro desde hilos de fondo).</summary>
        public Chunk GetChunkNoCache(int cx, int cz)
        {
            Chunk c;
            return chunks.TryGetValue(MathX.ChunkKey(cx, cz), out c) ? c : null;
        }

        public bool IsLoaded(int x, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            return c != null && c.state == 2;
        }

        public ushort Id(int x, int y, int z)
        {
            if ((uint)y >= H) return 0;
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return 0;
            return c.blocks[Chunk.Idx(x & 15, y, z & 15)];
        }

        public Block GetBlock(int x, int y, int z) { return Block.All[Id(x, y, z)]; }

        public int GetMeta(int x, int y, int z)
        {
            if ((uint)y >= H) return 0;
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return 0;
            return c.meta[Chunk.Idx(x & 15, y, z & 15)];
        }

        public int LightPacked(int x, int y, int z)
        {
            if ((uint)y >= H) return hasSky ? 0xF0 : 0;
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return 0;
            return c.light[Chunk.Idx(x & 15, y, z & 15)];
        }

        public int SkyLight(int x, int y, int z) { return LightPacked(x, y, z) >> 4; }
        public int BlockLight(int x, int y, int z) { return LightPacked(x, y, z) & 15; }

        /// <summary>Altura de la superficie (primer bloque no-aire desde arriba) o -1.</summary>
        public int SurfaceY(int x, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return -1;
            return c.top[((z & 15) << 4) | (x & 15)];
        }

        /// <summary>Superficie de tierra: ignora agua, hojas y plantas.</summary>
        public int GroundY(int x, int z)
        {
            int y = SurfaceY(x, z);
            if (y < 0) return -1;
            while (y > 0)
            {
                var b = GetBlock(x, y, z);
                if (b.id != 0 && !b.fluid && b.Collides && !B.IsLeaves(b)) break;
                y--;
            }
            return y;
        }

        public BiomeId BiomeAt(int x, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return BiomeId.Plains;
            return (BiomeId)c.biome[((z & 15) << 4) | (x & 15)];
        }

        public bool SetBlock(int x, int y, int z, Block b, int meta = 0, bool notify = true)
        {
            if ((uint)y >= H) return false;
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return false;
            int lx = x & 15, lz = z & 15;
            int i = Chunk.Idx(lx, y, lz);
            ushort old = c.blocks[i];
            if (old == b.id && c.meta[i] == meta) return true;
            var ob = Block.All[old];
            c.blocks[i] = b.id; c.meta[i] = (byte)meta;
            c.modified = true;
            if (ob.hasEntity && !b.hasEntity)
            {
                BlockEntity e;
                if (c.entities.TryGetValue(i, out e)) { c.entities.Remove(i); tickEntities.Remove(e); }
            }
            // altura
            int ci = (lz << 4) | lx;
            if (b.id != 0) { if (y > c.top[ci]) c.top[ci] = (short)y; }
            else if (y == c.top[ci])
            {
                int ty = y - 1;
                while (ty > 0 && c.blocks[Chunk.Idx(lx, ty, lz)] == 0) ty--;
                c.top[ci] = (short)ty;
            }
            bool lightChange = ob.opaque != b.opaque || ob.light != b.light || ob.translucent != b.translucent;
            Dirty(c, lx, y, lz, lightChange ? Math.Max(8, Math.Max(ob.light, b.light)) : 1);
            if (notify)
            {
                Notify(x, y, z);
                if (b.fluid || ob.fluid) Schedule(x, y, z, b == B.Water ? 5 : 30);
                if (b.gravity) Schedule(x, y, z, 2);
            }
            return true;
        }

        public void SetMeta(int x, int y, int z, int meta)
        {
            if ((uint)y >= H) return;
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return;
            int i = Chunk.Idx(x & 15, y, z & 15);
            if (c.meta[i] == meta) return;
            c.meta[i] = (byte)meta; c.modified = true;
            Dirty(c, x & 15, y, z & 15, 1);
        }

        void Dirty(Chunk c, int lx, int y, int lz, int reach)
        {
            c.version++;
            bool w = lx < reach, e = lx >= 16 - reach, n = lz < reach, s = lz >= 16 - reach;
            if (w) Bump(c.cx - 1, c.cz);
            if (e) Bump(c.cx + 1, c.cz);
            if (n) Bump(c.cx, c.cz - 1);
            if (s) Bump(c.cx, c.cz + 1);
            if (w && n) Bump(c.cx - 1, c.cz - 1);
            if (w && s) Bump(c.cx - 1, c.cz + 1);
            if (e && n) Bump(c.cx + 1, c.cz - 1);
            if (e && s) Bump(c.cx + 1, c.cz + 1);
        }

        void Bump(int cx, int cz)
        {
            Chunk c;
            if (chunks.TryGetValue(MathX.ChunkKey(cx, cz), out c) && c.state == 2) c.version++;
        }

        // ----------------------------------------------------------------
        // Entidades de bloque
        // ----------------------------------------------------------------
        public BlockEntity GetEntity(int x, int y, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null) return null;
            BlockEntity e;
            return c.entities.TryGetValue(Chunk.Idx(x & 15, y, z & 15), out e) ? e : null;
        }

        /// <summary>Obtiene (o crea si falta) la entidad de bloque del cofre/horno de esa posicion.</summary>
        public BlockEntity EnsureEntity(int x, int y, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            if (c == null || c.state != 2) return null;
            int i = Chunk.Idx(x & 15, y, z & 15);
            BlockEntity e;
            if (c.entities.TryGetValue(i, out e)) { c.modified = true; return e; }
            var b = Block.All[c.blocks[i]];
            if (b == B.Chest) e = new ChestEntity { x = x, y = y, z = z };
            else if (b == B.Furnace || b == B.FurnaceOn) e = new FurnaceEntity { x = x, y = y, z = z };
            else return null;
            c.entities[i] = e;
            if (e.NeedsTick) tickEntities.Add(e);
            c.modified = true;
            return e;
        }

        void RegisterChunkEntities(Chunk c)
        {
            foreach (var e in c.entities.Values) if (e.NeedsTick) tickEntities.Add(e);
        }

        // ----------------------------------------------------------------
        // Actualizaciones de vecinos y ticks
        // ----------------------------------------------------------------
        public void Notify(int x, int y, int z)
        {
            notifyQueue.Enqueue(new[] { x + 1, y, z }); notifyQueue.Enqueue(new[] { x - 1, y, z });
            notifyQueue.Enqueue(new[] { x, y + 1, z }); notifyQueue.Enqueue(new[] { x, y - 1, z });
            notifyQueue.Enqueue(new[] { x, y, z + 1 }); notifyQueue.Enqueue(new[] { x, y, z - 1 });
            if (inNotify) return;
            inNotify = true;
            int guard = 0;
            while (notifyQueue.Count > 0 && guard++ < 20000)
            {
                var p = notifyQueue.Dequeue();
                BlockLogic.NeighborChanged(this, p[0], p[1], p[2]);
            }
            notifyQueue.Clear();
            inNotify = false;
        }

        public void Schedule(int x, int y, int z, int delay)
        {
            sched.Add(new SchedTick { due = tickCount + delay, x = x, y = y, z = z });
        }

        /// <summary>Rompe un bloque (por ejemplo al perder soporte) y suelta sus items.</summary>
        public void BreakNatural(int x, int y, int z, bool drop = true)
        {
            var b = GetBlock(x, y, z);
            if (b.id == 0) return;
            int meta = GetMeta(x, y, z);
            if (drop && OnDrops != null)
            {
                var list = new List<ItemStack>();
                b.GetDrops(rng, ItemStack.Empty, list);
                if (b.hasEntity) DropEntityContents(x, y, z, list);
                if (list.Count > 0) OnDrops(x, y, z, list);
            }
            if (OnBlockBroken != null) OnBlockBroken(x, y, z, b, meta);
            SetBlock(x, y, z, B.Air);
        }

        public void DropEntityContents(int x, int y, int z, List<ItemStack> into)
        {
            var e = GetEntity(x, y, z);
            ItemStack[] arr = null;
            if (e is ChestEntity) arr = ((ChestEntity)e).slots;
            else if (e is FurnaceEntity) arr = ((FurnaceEntity)e).slots;
            if (arr == null) return;
            for (int i = 0; i < arr.Length; i++) if (!arr[i].IsEmpty) { into.Add(arr[i]); arr[i].Clear(); }
        }

        /// <summary>Un tick de juego (20 por segundo).</summary>
        public void Tick(int pcx, int pcz, int tickRadius)
        {
            tickCount++;
            // ticks programados (fluidos)
            for (int i = sched.Count - 1; i >= 0; i--)
            {
                var s = sched[i];
                if (s.due > tickCount) continue;
                sched[i] = sched[sched.Count - 1]; sched.RemoveAt(sched.Count - 1);
                BlockLogic.ScheduledTick(this, s.x, s.y, s.z);
            }
            if (sched.Count > 4000) sched.RemoveRange(0, sched.Count - 4000);

            // ticks aleatorios
            for (int dz = -tickRadius; dz <= tickRadius; dz++)
                for (int dx = -tickRadius; dx <= tickRadius; dx++)
                {
                    var c = GetChunk(pcx + dx, pcz + dz);
                    if (c == null || c.state != 2) continue;
                    for (int k = 0; k < 48; k++)
                    {
                        int lx = rng.Int(16), lz = rng.Int(16), y = rng.Int(H);
                        var b = Block.All[c.blocks[Chunk.Idx(lx, y, lz)]];
                        if (b.randomTick) BlockLogic.RandomTick(this, (c.cx << 4) + lx, y, (c.cz << 4) + lz, b);
                    }
                }

            // entidades de bloque
            for (int i = tickEntities.Count - 1; i >= 0; i--)
            {
                var e = tickEntities[i];
                var c = GetChunk(e.x >> 4, e.z >> 4);
                if (c == null) { tickEntities.RemoveAt(i); continue; }
                if (Math.Abs(c.cx - pcx) > tickRadius + 1 || Math.Abs(c.cz - pcz) > tickRadius + 1) continue;
                e.Tick(this, 0.05f);
                if (e.Active) c.modified = true;
            }
        }

        /// <summary>Marca el chunk como modificado (cuando cambia el contenido de un cofre u horno).</summary>
        public void MarkModified(int x, int z)
        {
            var c = GetChunk(x >> 4, z >> 4);
            if (c != null) c.modified = true;
        }

        // ----------------------------------------------------------------
        // Carga progresiva de chunks
        // ----------------------------------------------------------------
        static int[][] spiral;
        static void BuildSpiral()
        {
            if (spiral != null) return;
            var list = new List<int[]>();
            const int R = 18;
            for (int dz = -R; dz <= R; dz++)
                for (int dx = -R; dx <= R; dx++) list.Add(new[] { dx, dz });
            list.Sort((a, b) => (a[0] * a[0] + a[1] * a[1]).CompareTo(b[0] * b[0] + b[1] * b[1]));
            spiral = list.ToArray();
        }

        static bool InCircle(int dx, int dz, int r) { return dx * dx + dz * dz <= r * r + r; }

        public void Stream(int pcx, int pcz)
        {
            BuildSpiral();
            frameCounter++;
            int load = viewDist + 1;
            for (int i = 0; i < spiral.Length; i++)
            {
                int dx = spiral[i][0], dz = spiral[i][1];
                if (!InCircle(dx, dz, load)) { if (dx * dx + dz * dz > (load + 2) * (load + 2)) break; continue; }
                long key = MathX.ChunkKey(pcx + dx, pcz + dz);
                Chunk c;
                if (!chunks.TryGetValue(key, out c)) { c = new Chunk(pcx + dx, pcz + dz); chunks[key] = c; }
                if (c.state == 0 && Volatile.Read(ref genRunning) < maxGen)
                {
                    c.state = 1;
                    Interlocked.Increment(ref genRunning);
                    var cc = c;
                    ThreadPool.QueueUserWorkItem(_ => GenJob(cc));
                }
            }

            // mallas
            for (int i = 0; i < spiral.Length; i++)
            {
                int dx = spiral[i][0], dz = spiral[i][1];
                if (!InCircle(dx, dz, viewDist)) { if (dx * dx + dz * dz > (viewDist + 2) * (viewDist + 2)) break; continue; }
                if (Volatile.Read(ref meshRunning) >= maxMesh) break;
                Chunk c;
                if (!chunks.TryGetValue(MathX.ChunkKey(pcx + dx, pcz + dz), out c)) continue;
                if (c.state == 2 && !c.registered) { c.registered = true; RegisterChunkEntities(c); }
                if (c.state != 2 || c.meshQueued || c.meshedVersion == c.version) continue;
                if (!NeighborsReady(c)) continue;
                QueueMesh(c);
            }

            // descarga de chunks lejanos
            if (frameCounter % 30 == 0)
            {
                int unload = load + 2;
                var toRemove = new List<Chunk>();
                foreach (var kv in chunks)
                {
                    var c = kv.Value;
                    if (Math.Abs(c.cx - pcx) > unload || Math.Abs(c.cz - pcz) > unload)
                        if (c.state != 1 && !c.meshQueued) toRemove.Add(c);
                }
                for (int i = 0; i < toRemove.Count; i++) Unload(toRemove[i]);
            }
        }

        public bool NeighborsReady(Chunk c)
        {
            for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dz == 0) continue;
                    Chunk n;
                    if (!chunks.TryGetValue(MathX.ChunkKey(c.cx + dx, c.cz + dz), out n) || n.state != 2) return false;
                }
            return true;
        }

        /// <summary>Todos los chunks en radio r alrededor ya estan generados y con malla.</summary>
        public bool AreaReady(int cx, int cz, int r, bool needMesh)
        {
            for (int dz = -r; dz <= r; dz++)
                for (int dx = -r; dx <= r; dx++)
                {
                    Chunk n;
                    if (!chunks.TryGetValue(MathX.ChunkKey(cx + dx, cz + dz), out n) || n.state != 2) return false;
                    if (needMesh && n.view == null) return false;
                }
            return true;
        }

        public int PendingJobs { get { return Volatile.Read(ref genRunning) + Volatile.Read(ref meshRunning); } }

        void GenJob(Chunk c)
        {
            try
            {
                bool loaded = store != null && store.TryLoad(dim, c);
                if (!loaded) { gen.Generate(c); }
                c.RecomputeTop();
                c.state = 2;
                if (!loaded) c.version++;
            }
            catch (Exception e)
            {
                Debug.LogError("Error generando chunk " + c.cx + "," + c.cz + ": " + e);
                c.RecomputeTop();
                c.state = 2;
            }
            finally { Interlocked.Decrement(ref genRunning); }
        }

        void QueueMesh(Chunk c)
        {
            c.meshQueued = true;
            int version = c.version;
            c.meshedVersion = version;
            Interlocked.Increment(ref meshRunning);
            ThreadPool.QueueUserWorkItem(_ => MeshJob(c, version));
        }

        void MeshJob(Chunk c, int version)
        {
            MeshData md = null;
            try
            {
                md = MeshData.Take();
                MeshBuilder.Build(this, c, md);
                md.chunk = c; md.version = version;
            }
            catch (Exception e)
            {
                Debug.LogError("Error mallando chunk " + c.cx + "," + c.cz + ": " + e);
                if (md != null) { md.Clear(); }
            }
            finally
            {
                c.meshQueued = false;
                if (md != null) meshResults.Enqueue(md);
                Interlocked.Decrement(ref meshRunning);
            }
        }

        void Unload(Chunk c)
        {
            Chunk removed;
            if (!chunks.TryRemove(MathX.ChunkKey(c.cx, c.cz), out removed)) return;
            if (lastChunk == c) lastChunk = null;
            if (c.modified && store != null) store.Save(dim, c);
            foreach (var e in c.entities.Values) tickEntities.Remove(e);
            if (OnChunkUnloaded != null) OnChunkUnloaded(c);
        }

        /// <summary>Guarda todos los chunks modificados (al salir o cambiar de dimension).</summary>
        public void SaveAll()
        {
            if (store == null) return;
            foreach (var kv in chunks)
                if (kv.Value.modified && kv.Value.state == 2) { store.Save(dim, kv.Value); kv.Value.modified = false; }
        }

        public void UnloadAll()
        {
            SaveAll();
            var all = new List<Chunk>(chunks.Values);
            foreach (var c in all) { if (OnChunkUnloaded != null) OnChunkUnloaded(c); }
            chunks.Clear(); tickEntities.Clear(); lastChunk = null;
        }
    }
}
