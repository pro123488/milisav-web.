using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using UnityEngine;

namespace MundoBloques
{
    [Serializable] public sealed class StackDto { public string k; public int n; public int d; }

    [Serializable] public sealed class MobDto { public string k; public float x, y, z, hx, hy, hz; public int id; public int f; public int c; public float hp; }

    [Serializable] public sealed class BoatDto { public float x, y, z, yaw; }

    [Serializable]
    public sealed class LevelDto
    {
        public MobDto[] mobs;
        public string name; public int seed; public bool creative; public float dayTime;
        public float px, py, pz, yaw, pitch; public int dim;
        public float health = 20, hunger = 20, saturation = 5;
        public StackDto[] inv; public StackDto[] armor; public int sel;
        public float sx, sy, sz; public int sdim; public bool hasBed;
        public bool dragonDefeated, creditsShown;
        public long savedAt; public float playTime; public int kills;
        public int viewDist = 6;
        public string[] adv; public BoatDto[] boats; public int[] dead;
        public bool rain, storm; public int fish, pets;
    }

    /// <summary>Guardado en disco: nivel (JSON) y chunks modificados (binario comprimido).</summary>
    public static class SaveSystem
    {
        public static string Root { get { return Path.Combine(Application.persistentDataPath, "MundoBloques"); } }
        public static string WorldDir(string name) { return Path.Combine(Root, Sanitize(name)); }

        public static string Sanitize(string n)
        {
            foreach (var c in Path.GetInvalidFileNameChars()) n = n.Replace(c, '_');
            return n.Trim();
        }

        public static List<LevelDto> ListWorlds()
        {
            var list = new List<LevelDto>();
            try
            {
                if (!Directory.Exists(Root)) return list;
                foreach (var d in Directory.GetDirectories(Root))
                {
                    var f = Path.Combine(d, "level.json");
                    if (!File.Exists(f)) continue;
                    try { list.Add(JsonUtility.FromJson<LevelDto>(File.ReadAllText(f))); } catch { }
                }
            }
            catch (Exception e) { Debug.LogWarning("Listar mundos: " + e.Message); }
            list.Sort((a, b) => b.savedAt.CompareTo(a.savedAt));
            return list;
        }

        public static string MapFile(string name) { return Path.Combine(WorldDir(name), "map.bin"); }

        public static bool Exists(string name) { return File.Exists(Path.Combine(WorldDir(name), "level.json")); }

        public static void Delete(string name)
        {
            try { if (Directory.Exists(WorldDir(name))) Directory.Delete(WorldDir(name), true); } catch (Exception e) { Debug.LogWarning(e.Message); }
        }

        static StackDto[] ToDto(ItemStack[] arr)
        {
            var l = new List<StackDto>();
            for (int i = 0; i < arr.Length; i++)
                l.Add(arr[i].IsEmpty ? new StackDto { k = "", n = 0 } : new StackDto { k = arr[i].item.key, n = arr[i].count, d = arr[i].damage });
            return l.ToArray();
        }

        static void FromDto(StackDto[] dto, ItemStack[] arr)
        {
            if (dto == null) return;
            for (int i = 0; i < arr.Length && i < dto.Length; i++)
            {
                var it = string.IsNullOrEmpty(dto[i].k) ? null : Items.Get(dto[i].k);
                arr[i] = it == null ? ItemStack.Empty : new ItemStack(it, dto[i].n, dto[i].d);
            }
        }

        public static void SaveLevel(GameRoot g)
        {
            if (g.world == null || g.player == null) return;
            try
            {
                var p = g.player;
                var dto = new LevelDto
                {
                    name = g.worldName, seed = g.worldSeed, creative = g.creative, dayTime = g.sky.time,
                    px = p.transform.position.x, py = p.transform.position.y, pz = p.transform.position.z, yaw = p.yaw, pitch = p.pitch, dim = (int)g.world.dim,
                    health = p.health, hunger = p.hunger, saturation = p.saturation, inv = ToDto(p.inv.slots), armor = ToDto(p.inv.armor), sel = p.inv.selected,
                    sx = p.spawnPos.x, sy = p.spawnPos.y, sz = p.spawnPos.z, sdim = (int)p.spawnDim, hasBed = p.hasBed,
                    dragonDefeated = g.dragonDefeated, creditsShown = g.creditsShown, savedAt = DateTime.UtcNow.Ticks, playTime = g.playTime, kills = p.totalKills,
                    viewDist = g.world.viewDist
                };
                dto.mobs = g.CollectPersistentMobs();
                dto.boats = g.CollectBoats();
                dto.dead = new List<int>(g.persistentDead).ToArray();
                dto.adv = new List<string>(g.advDone).ToArray();
                dto.rain = g.weather != null && g.weather.WantRain; dto.storm = g.weather != null && g.weather.thunder;
                dto.fish = p.fishCaught; dto.pets = p.petsTamed;
                if (g.map.dirty) g.map.Save(MapFile(g.worldName), g.quitting);
                Directory.CreateDirectory(WorldDir(g.worldName));
                File.WriteAllText(Path.Combine(WorldDir(g.worldName), "level.json"), JsonUtility.ToJson(dto));
                g.world.SaveAll();
            }
            catch (Exception e) { Debug.LogWarning("No se pudo guardar: " + e.Message); }
        }

        public static void ApplyToPlayer(LevelDto dto, Player p)
        {
            p.health = Mathf.Max(1f, dto.health); p.hunger = dto.hunger; p.saturation = dto.saturation;
            FromDto(dto.inv, p.inv.slots); FromDto(dto.armor, p.inv.armor); p.inv.selected = Mathf.Clamp(dto.sel, 0, 8);
            p.spawnPos = new Vector3(dto.sx, dto.sy, dto.sz); p.spawnDim = (Dim)dto.sdim; p.hasBed = dto.hasBed;
            p.yaw = dto.yaw; p.pitch = dto.pitch; p.totalKills = dto.kills; p.fishCaught = dto.fish; p.petsTamed = dto.pets;
        }

        public sealed class ChunkStore : IChunkStore
        {
            readonly string dir;
            public ChunkStore(string worldName) { dir = WorldDir(worldName); }

            string PathFor(Dim d, int cx, int cz) { return System.IO.Path.Combine(dir, d.ToString(), "c_" + cx + "_" + cz + ".bin"); }

            public bool TryLoad(Dim dim, Chunk c)
            {
                var f = PathFor(dim, c.cx, c.cz);
                if (!File.Exists(f)) return false;
                try
                {
                    using (var fs = File.OpenRead(f))
                    using (var gz = new GZipStream(fs, CompressionMode.Decompress))
                    using (var r = new BinaryReader(gz))
                    {
                        int ver = r.ReadInt32();
                        if (ver != 1) return false;
                        int pc = r.ReadInt32();
                        var map = new ushort[pc];
                        for (int i = 0; i < pc; i++)
                        {
                            Block b;
                            map[i] = Block.ByKey.TryGetValue(r.ReadString(), out b) ? b.id : (ushort)0;
                        }
                        for (int i = 0; i < Chunk.VOL; i++) { int pi = r.ReadUInt16(); c.blocks[i] = pi < pc ? map[pi] : (ushort)0; }
                        var meta = r.ReadBytes(Chunk.VOL); Buffer.BlockCopy(meta, 0, c.meta, 0, Chunk.VOL);
                        var bio = r.ReadBytes(256); Buffer.BlockCopy(bio, 0, c.biome, 0, 256);
                        int ne = r.ReadInt32();
                        for (int i = 0; i < ne; i++)
                        {
                            int idx = r.ReadInt32(); int type = r.ReadByte();
                            BlockEntity e = type == 0 ? (BlockEntity)new ChestEntity() : new FurnaceEntity();
                            e.x = (c.cx << 4) + (idx & 15); e.z = (c.cz << 4) + ((idx >> 4) & 15); e.y = idx >> 8;
                            e.Read(r);
                            c.entities[idx] = e;
                        }
                    }
                    return true;
                }
                catch (Exception ex) { Debug.LogWarning("Chunk corrupto " + c.cx + "," + c.cz + ": " + ex.Message); return false; }
            }

            public void Save(Dim dim, Chunk c)
            {
                try
                {
                    var f = PathFor(dim, c.cx, c.cz);
                    Directory.CreateDirectory(System.IO.Path.GetDirectoryName(f));
                    var used = new Dictionary<ushort, int>();
                    var names = new List<string>();
                    var pal = new ushort[Chunk.VOL];
                    for (int i = 0; i < Chunk.VOL; i++)
                    {
                        ushort id = c.blocks[i]; int pi;
                        if (!used.TryGetValue(id, out pi)) { pi = names.Count; used[id] = pi; names.Add(Block.All[id].key); }
                        pal[i] = (ushort)pi;
                    }
                    using (var fs = File.Create(f))
                    using (var gz = new GZipStream(fs, CompressionMode.Compress))
                    using (var w = new BinaryWriter(gz))
                    {
                        w.Write(1);
                        w.Write(names.Count);
                        for (int i = 0; i < names.Count; i++) w.Write(names[i]);
                        for (int i = 0; i < Chunk.VOL; i++) w.Write(pal[i]);
                        w.Write(c.meta); w.Write(c.biome);
                        var ents = new List<KeyValuePair<int, BlockEntity>>();
                        foreach (var kv in c.entities) if (kv.Value is ChestEntity || kv.Value is FurnaceEntity) ents.Add(kv);
                        w.Write(ents.Count);
                        foreach (var kv in ents) { w.Write(kv.Key); w.Write((byte)(kv.Value is ChestEntity ? 0 : 1)); kv.Value.Write(w); }
                    }
                }
                catch (Exception ex) { Debug.LogWarning("No se pudo guardar el chunk: " + ex.Message); }
            }
        }
    }
}
