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
    public static partial class SaveSystem
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
                    // un cierre justo entre borrar y mover deja el temporal completo: se recupera
                    if (!File.Exists(f) && File.Exists(f + ".tmp")) { try { File.Move(f + ".tmp", f); } catch { } }
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
            try { FlushChunks(); if (Directory.Exists(WorldDir(name))) Directory.Delete(WorldDir(name), true); } catch (Exception e) { Debug.LogWarning(e.Message); }
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
                WriteAtomic(Path.Combine(WorldDir(g.worldName), "level.json"), JsonUtility.ToJson(dto));
                g.world.SaveAll(g.quitting);
            }
            catch (Exception e) { Debug.LogWarning("No se pudo guardar: " + e.Message); }
        }

        /// <summary>Escribe en un temporal y lo mueve al destino: un cierre brusco no deja el archivo a medias.</summary>
        static void WriteAtomic(string path, string text)
        {
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, text);
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        public static void ApplyToPlayer(LevelDto dto, Player p)
        {
            p.health = Mathf.Max(1f, dto.health); p.hunger = dto.hunger; p.saturation = dto.saturation;
            FromDto(dto.inv, p.inv.slots); FromDto(dto.armor, p.inv.armor); p.inv.selected = Mathf.Clamp(dto.sel, 0, 8);
            p.spawnPos = new Vector3(dto.sx, dto.sy, dto.sz); p.spawnDim = (Dim)dto.sdim; p.hasBed = dto.hasBed;
            p.yaw = dto.yaw; p.pitch = dto.pitch; p.totalKills = dto.kills; p.fishCaught = dto.fish; p.petsTamed = dto.pets;
        }
    }
}
