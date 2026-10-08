using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Aparicion de criaturas: iniciales por chunk, hostiles en la oscuridad, generadores de monstruos.</summary>
    public static class MobSpawner
    {
        static float timer;

        static int Count(bool hostile)
        {
            int n = 0;
            for (int i = 0; i < Entity.All.Count; i++)
            {
                var m = Entity.All[i] as Mob;
                if (m != null && !m.dead && m.def.hostile == hostile && m.def.ai != AI.Villager) n++;
            }
            return n;
        }

        /// <summary>Primera vez que un chunk entra en el area activa.</summary>
        public static void Activate(GameRoot g, Chunk c)
        {
            c.spawnsDone = true;
            var w = g.world;
            for (int i = 0; i < c.pendingSpawns.Count; i++)
            {
                var s = c.pendingSpawns[i];
                var pos = new Vector3(s.x, s.y, s.z);
                if (s.mob == "end_crystal") { if (!g.dragonDefeated) EndCrystal.Create(pos); continue; }
                var def = MobDefs.Get(s.mob);
                if (def == null) continue;
                bool keep = def.ai == AI.Villager || def.ai == AI.Spirit;
                if (keep && g.persistentIds.Contains(s.id)) continue;
                if (def.ai == AI.Villager && VillagerNear(pos)) continue;
                var m = Mob.Create(def, pos);
                m.persistent = keep;
                m.home = pos;
                if (keep) { m.spawnId = s.id; g.persistentIds.Add(s.id); }
            }
            c.pendingSpawns.Clear();
            if (w.dim != Dim.Overworld) return;
            // animales iniciales
            var rng = new Rng(MathX.Hash(c.cx, 311, c.cz, g.worldSeed));
            if (!rng.Chance(0.22f) || Count(false) > 70) return;
            int lx = rng.Range(2, 14), lz = rng.Range(2, 14);
            int x = (c.cx << 4) + lx, z = (c.cz << 4) + lz;
            var biome = (BiomeId)c.biome[lz * 16 + lx];
            string[] kinds;
            switch (biome)
            {
                case BiomeId.Plains: case BiomeId.Forest: case BiomeId.BirchForest: case BiomeId.Savanna: kinds = new[] { "cow", "pig", "sheep", "chicken", "sheep", "cow" }; break;
                case BiomeId.Taiga: case BiomeId.Mountains: case BiomeId.Tundra: kinds = new[] { "sheep", "rabbit", "cow", "pig" }; break;
                case BiomeId.Jungle: kinds = new[] { "chicken", "rabbit", "pig" }; break;
                case BiomeId.Swamp: kinds = new[] { "pig", "chicken" }; break;
                case BiomeId.Desert: case BiomeId.Mesa: kinds = new[] { "rabbit" }; break;
                case BiomeId.Beach: case BiomeId.Island: kinds = new[] { "chicken", "pig" }; break;
                case BiomeId.Mushroom: kinds = new[] { "cow", "pig" }; break;
                case BiomeId.Ocean: case BiomeId.DeepOcean: case BiomeId.WarmOcean: case BiomeId.River: case BiomeId.FrozenOcean: kinds = new[] { "cod", "salmon" }; break;
                default: return;
            }
            string kind = rng.Pick(kinds);
            int group = kind == "cod" || kind == "salmon" ? rng.Range(3, 6) : rng.Range(2, 5);
            for (int i = 0; i < group; i++)
            {
                int px = x + rng.Range(-3, 4), pz = z + rng.Range(-3, 4);
                if (!w.IsLoaded(px, pz)) continue;
                int gy = w.GroundY(px, pz);
                if (gy < 0) continue;
                Vector3 pos;
                if (kind == "cod" || kind == "salmon")
                {
                    int top = w.SurfaceY(px, pz);
                    if (!B.IsWaterlike(w.GetBlock(px, top, pz)) || top - gy < 3) continue;
                    pos = new Vector3(px + 0.5f, gy + 1.5f + (float)rng.Int(Mathf.Max(1, top - gy - 2)), pz + 0.5f);
                }
                else
                {
                    var below = w.GetBlock(px, gy, pz);
                    if (below.fluid || w.GetBlock(px, gy + 1, pz).fluid || B.IsWaterlike(w.GetBlock(px, gy + 1, pz))) continue;
                    pos = new Vector3(px + 0.5f, gy + 1.01f, pz + 0.5f);
                }
                Mob.Create(MobDefs.Get(kind), pos, rng.Chance(0.12f) && kind != "cod" && kind != "salmon");
            }
        }

        static bool VillagerNear(Vector3 p)
        {
            for (int i = 0; i < Entity.All.Count; i++)
            {
                var m = Entity.All[i] as Mob;
                if (m != null && m.def.ai == AI.Villager && (m.transform.position - p).sqrMagnitude < 4f) return true;
            }
            return false;
        }

        /// <summary>Se llama cada frame; actua cada pocos segundos.</summary>
        public static void Tick(GameRoot g, float dt)
        {
            timer += dt;
            if (timer < 1.2f) return;
            timer = 0f;
            var pl = g.player;
            if (pl == null || pl.dead) return;
            var w = g.world;
            if (Count(true) < (w.dim == Dim.Overworld ? 26 : 18))
                for (int a = 0; a < 3; a++) if (TryHostile(g, pl, w)) break;
            if (w.dim == Dim.Overworld && g.sky.IsDay && Random.value < 0.08f && Count(false) < 44) TryPassive(g, pl, w);
            // el Final siempre tiene errantes
        }

        static bool TryHostile(GameRoot g, Player pl, World w)
        {
            float ang = Random.value * 6.2831f, r = Random.Range(24f, 46f);
            var p = pl.transform.position + new Vector3(Mathf.Cos(ang) * r, 0, Mathf.Sin(ang) * r);
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            if (!w.IsLoaded(x, z)) return false;
            int top = w.SurfaceY(x, z);
            if (top < 2) return false;
            // elegir altura: superficie o cueva
            int y0 = Random.value < 0.4f ? top + 1 : Random.Range(6, Mathf.Max(8, top));
            if (w.dim == Dim.Abismo) y0 = Random.Range(8, 120);
            if (w.dim == Dim.Final) { y0 = w.SurfaceY(x, z) + 1; }
            int y = y0;
            for (int k = 0; k < 40 && y > 3; k++, y--)
            {
                var feet = w.GetBlock(x, y, z);
                var head = w.GetBlock(x, y + 1, z);
                var below = w.GetBlock(x, y - 1, z);
                if (feet.id == 0 && head.id == 0 && below.Collides && below.FullOpaque && !below.damagesOnTouch) break;
                if (k == 39) return false;
            }
            if (y <= 3) return false;
            if (w.GetBlock(x, y, z).id != 0 || w.GetBlock(x, y + 1, z).id != 0) return false;
            int l = w.LightPacked(x, y, z);
            float sky = (l >> 4) / 15f * (w.dim == Dim.Overworld ? g.sky.skyBrightness : 0f), blk = (l & 15) / 15f;
            if (Mathf.Max(sky, blk) > 0.34f) return false;
            var pos = new Vector3(x + 0.5f, y, z + 0.5f);
            if ((pos - pl.transform.position).sqrMagnitude < 18f * 18f) return false;
            string key = PickHostile(w, x, z, y, Random.value);
            if (key == null) return false;
            var def = MobDefs.Get(key);
            var m = Mob.Create(def, pos);
            if (def.ai == AI.Blaze) m.transform.position += Vector3.up * 2f;
            return true;
        }

        static string PickHostile(World w, int x, int z, int y, float r)
        {
            var biome = w.BiomeAt(x, z);
            if (w.dim == Dim.Abismo) return r < 0.62f ? "abyss_skeleton" : (r < 0.8f ? "gelatin" : (r < 0.9f ? "zombie" : "blaze"));
            if (w.dim == Dim.Final) return "wanderer";
            bool underground = y < w.SurfaceY(x, z) - 5;
            if (biome == BiomeId.Ocean || biome == BiomeId.DeepOcean) { if (B.IsWaterlike(w.GetBlock(x, y, z))) return "drowned"; }
            string zomb = (biome == BiomeId.Desert || biome == BiomeId.Mesa) ? "mummy" : "zombie";
            if (r < 0.34f) return zomb;
            if (r < 0.58f) return "skeleton";
            if (r < 0.74f) return "spider";
            if (r < 0.86f) return "detonator";
            if (r < 0.93f) return (biome == BiomeId.Swamp || underground) ? "gelatin" : zomb;
            return "wanderer";
        }

        static void TryPassive(GameRoot g, Player pl, World w)
        {
            float ang = Random.value * 6.2831f, r = Random.Range(28f, 50f);
            var p = pl.transform.position + new Vector3(Mathf.Cos(ang) * r, 0, Mathf.Sin(ang) * r);
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            if (!w.IsLoaded(x, z)) return;
            int gy = w.GroundY(x, z);
            if (gy < 0 || w.GetBlock(x, gy, z) != B.Grass) return;
            if (w.GetBlock(x, gy + 1, z).id != 0 && w.GetBlock(x, gy + 1, z).shape != Shape.Cross) return;
            var biome = w.BiomeAt(x, z);
            string key = Random.value < 0.4f ? "cow" : (Random.value < 0.5f ? "sheep" : (Random.value < 0.5f ? "pig" : "chicken"));
            if (biome == BiomeId.Desert) return;
            Mob.Create(MobDefs.Get(key), new Vector3(x + 0.5f, gy + 1.01f, z + 0.5f));
        }

        public static void SpawnerBlock(GameRoot g, int x, int y, int z, int meta)
        {
            var pl = g.player;
            if (pl == null || pl.dead) return;
            if ((pl.transform.position - new Vector3(x + 0.5f, y + 0.5f, z + 0.5f)).sqrMagnitude > 18f * 18f) return;
            int near = 0;
            for (int i = 0; i < Entity.All.Count; i++)
            {
                var m = Entity.All[i] as Mob;
                if (m != null && !m.dead && (m.transform.position - new Vector3(x, y, z)).sqrMagnitude < 144f) near++;
            }
            if (near >= 6) return;
            string[] keys = { "zombie", "skeleton", "spider", "blaze" };
            var def = MobDefs.Get(keys[Mathf.Clamp(meta, 0, 3)]);
            int n = Random.Range(1, 4);
            for (int k = 0; k < n; k++)
            {
                for (int tries = 0; tries < 8; tries++)
                {
                    int px = x + Random.Range(-3, 4), pz = z + Random.Range(-3, 4), py = y + Random.Range(-1, 2);
                    var w = g.world;
                    if (w.GetBlock(px, py, pz).id == 0 && w.GetBlock(px, py + 1, pz).id == 0 && w.GetBlock(px, py - 1, pz).Collides)
                    {
                        var m = Mob.Create(def, new Vector3(px + 0.5f, py, pz + 0.5f));
                        m.persistent = false;
                        Particles.Burst(new Vector3(px + 0.5f, py + 0.5f, pz + 0.5f), new Color32(255, 170, 40, 255), 8, 1.5f, 0.12f, 0.6f);
                        break;
                    }
                }
            }
            Sfx.Play(Clip.Fizz, new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), 0.5f);
        }
    }
}
