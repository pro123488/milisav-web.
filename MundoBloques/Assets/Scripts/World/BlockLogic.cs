using System;
using System.Collections.Generic;

namespace MundoBloques
{
    /// <summary>Reglas de los bloques: soporte, caida, fluidos, crecimiento (ticks aleatorios).</summary>
    public static class BlockLogic
    {
        static readonly int[] HX = { 1, -1, 0, 0 };
        static readonly int[] HZ = { 0, 0, 1, -1 };

        public static bool IsGround(Block b)
        {
            return B.IsSoil(b) || b == B.SkyGrass;
        }

        public static bool Supported(World w, int x, int y, int z, Block b, int meta)
        {
            var below = w.GetBlock(x, y - 1, z);
            switch (b.support)
            {
                case Support.None: return true;
                case Support.Solid:
                    if (b == B.Torch && meta >= 1 && meta <= 4)
                    {
                        int dx = meta == 1 ? -1 : (meta == 2 ? 1 : 0), dz = meta == 3 ? -1 : (meta == 4 ? 1 : 0);
                        var n = w.GetBlock(x + dx, y, z + dz);
                        return n.Collides && n.FullOpaque;
                    }
                    if (b == B.SnowLayer) return below.id != 0 && (below.FullOpaque || below.shape == Shape.Box) && below != B.SnowLayer;
                    return below.Collides && (below.FullOpaque || below.shape == Shape.Slab || below.shape == Shape.Stairs || below.shape == Shape.Box);
                case Support.Soil:
                    if (b.shape == Shape.Crop) return B.IsFarmland(below);
                    if (b == B.SugarCane) return below == B.SugarCane || below == B.Sand || below == B.RedSand || B.IsSoil(below);
                    return IsGround(below);
                case Support.Sand:
                    if (b == B.Cactus) return below == B.Sand || below == B.RedSand || below == B.Cactus;
                    return below == B.Sand || below == B.RedSand || B.IsSoil(below) || below.key.StartsWith("terracotta");
                case Support.Water:
                    return below == b || (below.Collides && below.id != 0);
            }
            return true;
        }

        static bool CanFall(Block below)
        {
            return below.id == 0 || below.replaceable || below.fluid || below.shape == Shape.Cross || below.shape == Shape.Torch || below.shape == Shape.Crop;
        }

        public static void NeighborChanged(World w, int x, int y, int z)
        {
            var b = w.GetBlock(x, y, z);
            if (b.id == 0) return;
            int meta = w.GetMeta(x, y, z);
            if (b.support != Support.None && !Supported(w, x, y, z, b, meta)) { w.BreakNatural(x, y, z); return; }
            if (b.gravity) { TryFall(w, x, y, z, b); return; }
            if (b.fluid) { w.Schedule(x, y, z, b == B.Water ? 5 : 30); return; }
            if (B.IsFarmland(b))
            {
                var above = w.GetBlock(x, y + 1, z);
                if (above.Collides && above.opaque) w.SetBlock(x, y, z, B.Dirt);
                return;
            }
            if (b == B.Portal) { Portals.Validate(w, x, y, z, meta); return; }
            if (b.shape == Shape.Door)
            {
                // media puerta de abajo (bit 8 = mitad superior)
                if ((meta & 8) != 0) { if (w.GetBlock(x, y - 1, z) != b) w.SetBlock(x, y, z, B.Air); }
                else
                {
                    var below = w.GetBlock(x, y - 1, z);
                    if (!below.Collides) w.BreakNatural(x, y, z);
                    else if (w.GetBlock(x, y + 1, z) != b) w.SetBlock(x, y, z, B.Air);
                }
            }
        }

        static void TryFall(World w, int x, int y, int z, Block b)
        {
            var below = w.GetBlock(x, y - 1, z);
            if (y > 0 && CanFall(below))
            {
                w.SetBlock(x, y, z, B.Air);
                if (w.OnFallingBlock != null) w.OnFallingBlock(x, y, z, b);
                else
                {
                    // sin entidades: caer de golpe
                    int ty = y - 1;
                    while (ty > 0 && CanFall(w.GetBlock(x, ty - 1, z))) ty--;
                    w.SetBlock(x, ty, z, b);
                }
            }
        }

        public static void ScheduledTick(World w, int x, int y, int z)
        {
            var b = w.GetBlock(x, y, z);
            if (b.fluid) FluidTick(w, x, y, z, b);
            else if (b.gravity) TryFall(w, x, y, z, b);
        }

        // ---------------- fluidos ----------------
        static int MaxLevel(World w, Block f) { return f == B.Water ? 7 : (w.dim == Dim.Abismo ? 5 : 3); }

        static void FluidTick(World w, int x, int y, int z, Block f)
        {
            int meta = w.GetMeta(x, y, z);
            int maxLevel = MaxLevel(w, f);
            bool source = meta == 0;
            if (!source)
            {
                int newMeta;
                var above = w.GetBlock(x, y + 1, z);
                if (above == f) newMeta = 8;
                else
                {
                    int best = 99;
                    for (int k = 0; k < 4; k++)
                    {
                        int nx = x + HX[k], nz = z + HZ[k];
                        if (w.GetBlock(nx, y, nz) != f) continue;
                        int nm = w.GetMeta(nx, y, nz);
                        int eff = nm == 0 ? 0 : ((nm & 8) != 0 ? 0 : (nm & 7));
                        if (eff + 1 < best) best = eff + 1;
                    }
                    if (best > maxLevel)
                    {
                        w.SetBlock(x, y, z, B.Air);
                        return;
                    }
                    newMeta = best;
                }
                if (newMeta != meta) { w.SetBlock(x, y, z, f, newMeta); meta = newMeta; }
            }
            int cur = (meta == 0 || (meta & 8) != 0) ? 0 : (meta & 7);

            // hacia abajo
            if (y > 0)
            {
                int r = TryFlow(w, f, x, y - 1, z, 8);
                if (r == 1) return;
                var below = w.GetBlock(x, y - 1, z);
                if (below == f) { int bm = w.GetMeta(x, y - 1, z); if ((bm & 8) != 0 || bm == 0) { if (!below.Collides) return; } }
            }
            int nl = cur + 1;
            if (nl > maxLevel) return;
            for (int k = 0; k < 4; k++) TryFlow(w, f, x + HX[k], y, z + HZ[k], nl);
        }

        /// <summary>Devuelve 1 si el fluido fluyo a la celda.</summary>
        static int TryFlow(World w, Block f, int x, int y, int z, int newMeta)
        {
            var t = w.GetBlock(x, y, z);
            bool other = t.fluid && t != f;
            if (other)
            {
                int tm = w.GetMeta(x, y, z);
                if (f == B.Water) w.SetBlock(x, y, z, tm == 0 ? B.Obsidian : B.Cobble);
                else w.SetBlock(x, y, z, B.Stone);
                return 1;
            }
            if (t == f)
            {
                int tm = w.GetMeta(x, y, z);
                if (tm == 0) return 0;
                if (newMeta == 8) { if ((tm & 8) != 0) return 0; }
                else if ((tm & 8) != 0 || (tm & 7) <= newMeta) return 0;
                w.SetBlock(x, y, z, f, newMeta);
                return 1;
            }
            if (t.id == 0 || (t.replaceable && !t.fluid) || t.shape == Shape.Cross || t.shape == Shape.Torch || t.shape == Shape.Crop)
            {
                // lava vecina al agua se solidifica
                if (t.id != 0) w.BreakNatural(x, y, z);
                // comprobar si hay fluido opuesto adyacente
                w.SetBlock(x, y, z, f, newMeta);
                return 1;
            }
            return 0;
        }

        // ---------------- ticks aleatorios ----------------
        public static void RandomTick(World w, int x, int y, int z, Block b)
        {
            var rng = w.rng;
            if (b == B.Grass)
            {
                var above = w.GetBlock(x, y + 1, z);
                if (above.FullOpaque) { w.SetBlock(x, y, z, B.Dirt); return; }
                int tx = x + rng.Range(-1, 2), tz = z + rng.Range(-1, 2), ty = y + rng.Range(-1, 2);
                if (w.GetBlock(tx, ty, tz) == B.Dirt && !w.GetBlock(tx, ty + 1, tz).FullOpaque && !w.GetBlock(tx, ty + 1, tz).fluid && w.SkyLight(tx, ty + 1, tz) >= 6)
                    w.SetBlock(tx, ty, tz, B.Grass);
                return;
            }
            if (B.IsLeaves(b)) { if (w.GetMeta(x, y, z) == 0 && !HasLog(w, x, y, z)) w.BreakNatural(x, y, z); return; }
            if (b.shape == Shape.Crop) { GrowCrop(w, x, y, z, b); return; }
            if (b == B.Farmland || b == B.FarmlandWet) { Moisture(w, x, y, z, b); return; }
            if (b == B.SugarCane || b == B.Cactus)
            {
                int hgt = 1;
                while (w.GetBlock(x, y - hgt, z) == b) hgt++;
                if (hgt < 3 && w.GetBlock(x, y + 1, z).id == 0 && rng.Chance(0.35f)) w.SetBlock(x, y + 1, z, b);
                return;
            }
            for (int i = 0; i < B.Sapling.Length; i++)
                if (B.Sapling[i] == b)
                {
                    if (rng.Chance(0.2f)) GrowSapling(w, x, y, z, i);
                    return;
                }
            if (b == B.Spawner) { if (w.OnSpawnerTick != null) w.OnSpawnerTick(x, y, z, w.GetMeta(x, y, z)); }
        }

        static bool HasLog(World w, int x, int y, int z)
        {
            const int R = 4;
            for (int dy = -R; dy <= R; dy++)
                for (int dz = -R; dz <= R; dz++)
                    for (int dx = -R; dx <= R; dx++)
                    {
                        if (Math.Abs(dx) + Math.Abs(dy) + Math.Abs(dz) > R + 2) continue;
                        var n = w.GetBlock(x + dx, y + dy, z + dz);
                        if (n.id != 0 && B.IsLog(n)) return true;
                        if (n == B.MushroomStem) return true;
                    }
            return false;
        }

        static void GrowSapling(World w, int x, int y, int z, int wood)
        {
            var below = w.GetBlock(x, y - 1, z);
            if (!IsGround(below)) return;
            w.SetBlock(x, y, z, B.Air, 0, false);
            var wr = new Writer(w);
            TreeType t;
            switch (wood)
            {
                case Woods.Birch: t = TreeType.Birch; break;
                case Woods.Spruce: t = TreeType.Spruce; break;
                case Woods.Jungle: t = TreeType.Jungle; break;
                case Woods.Acacia: t = TreeType.Acacia; break;
                case Woods.Palm: t = TreeType.Palm; break;
                case Woods.Spirit: t = TreeType.Spirit; break;
                default: t = TreeType.Oak; break;
            }
            Trees.Grow(wr, new Rng(x * 31 + z * 17 + y), t, x, y - 1, z);
        }

        public static int CropIndex(Block b)
        {
            for (int i = 0; i < B.Crops.Length; i++) if (B.Crops[i] == b) return i;
            return -1;
        }

        static void GrowCrop(World w, int x, int y, int z, Block b)
        {
            int age = w.GetMeta(x, y, z);
            if (age >= 7) return;
            var below = w.GetBlock(x, y - 1, z);
            if (!B.IsFarmland(below)) return;
            int light = Math.Max(w.SkyLight(x, y, z) >= 14 ? 15 : 0, w.BlockLight(x, y, z));
            if (w.SkyLight(x, y, z) < 12 && w.BlockLight(x, y, z) < 9) return;
            float p = below == B.FarmlandWet ? 0.7f : 0.28f;
            if (w.rng.Chance(p)) w.SetMeta(x, y, z, age + 1);
        }

        static void Moisture(World w, int x, int y, int z, Block b)
        {
            bool wet = false;
            for (int dy = -1; dy <= 1 && !wet; dy++)
                for (int dz = -4; dz <= 4 && !wet; dz++)
                    for (int dx = -4; dx <= 4 && !wet; dx++)
                        if (w.GetBlock(x + dx, y + dy, z + dz) == B.Water) wet = true;
            if (wet) { if (b != B.FarmlandWet) w.SetBlock(x, y, z, B.FarmlandWet); }
            else
            {
                if (b == B.FarmlandWet) { w.SetBlock(x, y, z, B.Farmland); return; }
                var above = w.GetBlock(x, y + 1, z);
                if (above.shape != Shape.Crop && w.rng.Chance(0.3f)) w.SetBlock(x, y, z, B.Dirt);
            }
        }

        /// <summary>Intenta cosechar un cultivo; devuelve los items.</summary>
        public static void CropDrops(Block crop, int age, Rng rng, List<ItemStack> into)
        {
            int idx = CropIndex(crop);
            if (idx < 0) return;
            string key = B.CropKeys[idx];
            bool mature = age >= 7;
            switch (key)
            {
                case "wheat":
                    if (mature) { Add(into, "wheat", 1, 1); Add(into, "wheat_seeds", 1, 3); } else Add(into, "wheat_seeds", 1, 1);
                    break;
                case "carrot": Add(into, "carrot", mature ? 2 : 1, mature ? 4 : 1); break;
                case "potato": Add(into, "potato", mature ? 2 : 1, mature ? 4 : 1); break;
                case "beetroot":
                    if (mature) { Add(into, "beetroot", 1, 2); Add(into, "beetroot_seeds", 1, 2); } else Add(into, "beetroot_seeds", 1, 1);
                    break;
                case "tomato":
                    if (mature) { Add(into, "tomato", 2, 3); Add(into, "tomato_seeds", 1, 2); } else Add(into, "tomato_seeds", 1, 1);
                    break;
                case "pumpkin":
                    if (mature) Add(into, "pumpkin", 1, 1); Add(into, "pumpkin_seeds", mature ? 1 : 1, mature ? 2 : 1);
                    break;
                default:
                    if (mature) Add(into, "melon_slice", 3, 5); Add(into, "melon_seeds", 1, mature ? 2 : 1);
                    break;
            }
            void Add(List<ItemStack> l, string k, int min, int max)
            {
                var it = Items.Get(k);
                if (it != null) l.Add(new ItemStack(it, min >= max ? min : rng.Range(min, max + 1)));
            }
        }
    }
}
