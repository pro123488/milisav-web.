using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Threading;
using UnityEngine;

namespace MundoBloques
{
    public static partial class SaveSystem
    {
        // ---------------------------------------------------------------- escritura en segundo plano
        // Al descargar un chunk solo se copian sus datos (rapido); la compresion y la escritura las hace un hilo aparte.
        // Mientras un chunk espera en la cola, cualquier carga lee la copia en memoria, asi que nunca se ve un dato viejo.
        sealed class ChunkSnap
        {
            public string path;
            public ushort[] blocks; public byte[] meta, biome;
            public byte[] ents; public int entCount;
        }

        static readonly object gate = new object();
        static readonly Dictionary<string, ChunkSnap> pending = new Dictionary<string, ChunkSnap>();
        static readonly Queue<ChunkSnap> queue = new Queue<ChunkSnap>();
        static bool workerRunning;

        static void Enqueue(ChunkSnap s)
        {
            bool start = false;
            lock (gate)
            {
                pending[s.path] = s;
                queue.Enqueue(s);
                if (!workerRunning) { workerRunning = true; start = true; }
            }
            if (start) ThreadPool.QueueUserWorkItem(Drain);
        }

        static void Drain(object state)
        {
            while (true)
            {
                ChunkSnap s;
                bool stale;
                lock (gate)
                {
                    if (queue.Count == 0) { workerRunning = false; Monitor.PulseAll(gate); return; }
                    s = queue.Dequeue();
                    ChunkSnap cur;
                    stale = pending.TryGetValue(s.path, out cur) && cur != s;      // ya hay una copia mas nueva en cola
                }
                if (!stale)
                {
                    try { WriteSnap(s); }
                    catch (Exception ex) { Debug.LogWarning("No se pudo guardar el chunk: " + ex.Message); }
                }
                lock (gate)
                {
                    ChunkSnap cur;
                    if (pending.TryGetValue(s.path, out cur) && cur == s) pending.Remove(s.path);
                    Monitor.PulseAll(gate);
                }
            }
        }

        /// <summary>Espera a que se escriban todos los chunks pendientes (al salir, cambiar de mundo o borrar una partida).</summary>
        public static void FlushChunks()
        {
            lock (gate)
            {
                var until = DateTime.UtcNow.AddSeconds(30);
                while (pending.Count > 0 && DateTime.UtcNow < until) Monitor.Wait(gate, 100);
            }
        }

        static void WriteSnap(ChunkSnap s)
        {
            var used = new Dictionary<ushort, int>();
            var names = new List<string>();
            var pal = new ushort[Chunk.VOL];
            var src = s.blocks;
            for (int i = 0; i < Chunk.VOL; i++)
            {
                ushort id = src[i]; int pi;
                if (!used.TryGetValue(id, out pi)) { pi = names.Count; used[id] = pi; names.Add(Block.All[id].key); }
                pal[i] = (ushort)pi;
            }
            bool wide = names.Count > 256;
            byte[] idx;
            if (wide) { idx = new byte[Chunk.VOL * 2]; Buffer.BlockCopy(pal, 0, idx, 0, idx.Length); }
            else { idx = new byte[Chunk.VOL]; for (int i = 0; i < Chunk.VOL; i++) idx[i] = (byte)pal[i]; }

            Directory.CreateDirectory(Path.GetDirectoryName(s.path));
            string tmp = s.path + ".tmp";
            using (var fs = File.Create(tmp))
            using (var gz = new GZipStream(fs, CompressionLevel.Fastest))
            using (var w = new BinaryWriter(gz))
            {
                w.Write(2);
                w.Write(names.Count);
                for (int i = 0; i < names.Count; i++) w.Write(names[i]);
                w.Write(wide ? (byte)2 : (byte)1);
                w.Write(idx);
                w.Write(s.meta); w.Write(s.biome);
                w.Write(s.entCount);
                if (s.ents != null) w.Write(s.ents);
            }
            if (File.Exists(s.path)) File.Delete(s.path);
            File.Move(tmp, s.path);
        }

        public sealed class ChunkStore : IChunkStore
        {
            readonly string dir;
            public ChunkStore(string worldName) { dir = WorldDir(worldName); }

            string PathFor(Dim d, int cx, int cz) { return Path.Combine(dir, d.ToString(), "c_" + cx + "_" + cz + ".bin"); }

            public void Flush() { FlushChunks(); }

            public bool TryLoad(Dim dim, Chunk c)
            {
                var f = PathFor(dim, c.cx, c.cz);
                ChunkSnap s;
                lock (gate) pending.TryGetValue(f, out s);
                if (s != null)
                {
                    try
                    {
                        Buffer.BlockCopy(s.blocks, 0, c.blocks, 0, Chunk.VOL * 2);
                        Buffer.BlockCopy(s.meta, 0, c.meta, 0, Chunk.VOL);
                        Buffer.BlockCopy(s.biome, 0, c.biome, 0, 256);
                        if (s.entCount > 0) using (var r = new BinaryReader(new MemoryStream(s.ents))) ReadEntities(r, c, s.entCount);
                        return true;
                    }
                    catch (Exception ex) { Debug.LogWarning("Chunk pendiente invalido " + c.cx + "," + c.cz + ": " + ex.Message); return false; }
                }
                // si el programa se cerro justo entre borrar y mover, queda el temporal completo
                if (!File.Exists(f)) { if (!File.Exists(f + ".tmp")) return false; f += ".tmp"; }
                try
                {
                    using (var fs = File.OpenRead(f))
                    using (var gz = new GZipStream(fs, CompressionMode.Decompress))
                    using (var r = new BinaryReader(gz))
                    {
                        int ver = r.ReadInt32();
                        if (ver != 1 && ver != 2) return false;
                        int pc = r.ReadInt32();
                        var map = new ushort[pc];
                        for (int i = 0; i < pc; i++)
                        {
                            Block b;
                            map[i] = Block.ByKey.TryGetValue(r.ReadString(), out b) ? b.id : (ushort)0;
                        }
                        int width = ver == 1 ? 0 : r.ReadByte();
                        if (width == 0)
                        {
                            for (int i = 0; i < Chunk.VOL; i++) { int pi = r.ReadUInt16(); c.blocks[i] = pi < pc ? map[pi] : (ushort)0; }
                        }
                        else if (width == 1)
                        {
                            var raw = ReadExact(r, Chunk.VOL);
                            for (int i = 0; i < Chunk.VOL; i++) { int pi = raw[i]; c.blocks[i] = pi < pc ? map[pi] : (ushort)0; }
                        }
                        else
                        {
                            var raw = ReadExact(r, Chunk.VOL * 2);
                            for (int i = 0; i < Chunk.VOL; i++) { int pi = raw[i * 2] | (raw[i * 2 + 1] << 8); c.blocks[i] = pi < pc ? map[pi] : (ushort)0; }
                        }
                        Buffer.BlockCopy(ReadExact(r, Chunk.VOL), 0, c.meta, 0, Chunk.VOL);
                        Buffer.BlockCopy(ReadExact(r, 256), 0, c.biome, 0, 256);
                        ReadEntities(r, c, r.ReadInt32());
                    }
                    return true;
                }
                catch (Exception ex) { Debug.LogWarning("Chunk corrupto " + c.cx + "," + c.cz + ": " + ex.Message); return false; }
            }

            static byte[] ReadExact(BinaryReader r, int n)
            {
                var b = r.ReadBytes(n);
                if (b.Length != n) throw new EndOfStreamException();
                return b;
            }

            static void ReadEntities(BinaryReader r, Chunk c, int ne)
            {
                for (int i = 0; i < ne; i++)
                {
                    int idx = r.ReadInt32(); int type = r.ReadByte();
                    BlockEntity e = type == 0 ? (BlockEntity)new ChestEntity() : new FurnaceEntity();
                    e.x = (c.cx << 4) + (idx & 15); e.z = (c.cz << 4) + ((idx >> 4) & 15); e.y = idx >> 8;
                    e.Read(r);
                    c.entities[idx] = e;
                }
            }

            /// <summary>Toma una copia de los datos del chunk y la deja en cola; el disco se escribe en segundo plano.</summary>
            public void Save(Dim dim, Chunk c)
            {
                try
                {
                    var s = new ChunkSnap { path = PathFor(dim, c.cx, c.cz), blocks = new ushort[Chunk.VOL], meta = new byte[Chunk.VOL], biome = new byte[256] };
                    Buffer.BlockCopy(c.blocks, 0, s.blocks, 0, Chunk.VOL * 2);
                    Buffer.BlockCopy(c.meta, 0, s.meta, 0, Chunk.VOL);
                    Buffer.BlockCopy(c.biome, 0, s.biome, 0, 256);
                    if (c.entities.Count > 0)
                    {
                        using (var ms = new MemoryStream())
                        using (var w = new BinaryWriter(ms))
                        {
                            foreach (var kv in c.entities)
                            {
                                if (!(kv.Value is ChestEntity) && !(kv.Value is FurnaceEntity)) continue;
                                w.Write(kv.Key); w.Write((byte)(kv.Value is ChestEntity ? 0 : 1)); kv.Value.Write(w);
                                s.entCount++;
                            }
                            w.Flush();
                            s.ents = ms.ToArray();
                        }
                    }
                    Enqueue(s);
                }
                catch (Exception ex) { Debug.LogWarning("No se pudo guardar el chunk: " + ex.Message); }
            }
        }
    }
}
