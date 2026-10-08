using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Paleta de materiales de una aldea.</summary>
    public sealed class Pal
    {
        public Block wall, log, floor, stairs, slab, door, foundation, path, glass;
    }

    public sealed class VBuilding
    {
        public int type, x0, z0, w, d, rot, floorY;
        public int FW { get { return (rot & 1) == 0 ? w : d; } }
        public int FD { get { return (rot & 1) == 0 ? d : w; } }
        public int cropIdx;
    }

    public sealed class VillageLayout
    {
        public int cx, cz, baseY, style;
        public Pal pal;
        public List<VBuilding> buildings = new List<VBuilding>();
        public List<int[]> roads = new List<int[]>();     // x0,z0,x1,z1 (inclusive)
        public List<int[]> lamps = new List<int[]>();
        public int radius = 40;
    }

    /// <summary>Transformacion de coordenadas locales de un edificio a coordenadas del mundo.</summary>
    public sealed class Frame
    {
        public Writer w; public VBuilding b; public int bw, bd;
        public Frame(Writer w, VBuilding b) { this.w = w; this.b = b; bw = b.w; bd = b.d; }

        public void ToWorld(int lx, int lz, out int wx, out int wz)
        {
            switch (b.rot)
            {
                case 0: wx = b.x0 + lx; wz = b.z0 + lz; break;
                case 1: wx = b.x0 + (bd - 1 - lz); wz = b.z0 + lx; break;
                case 2: wx = b.x0 + (bw - 1 - lx); wz = b.z0 + (bd - 1 - lz); break;
                default: wx = b.x0 + lz; wz = b.z0 + (bw - 1 - lx); break;
            }
        }

        public int Facing(int f) { return (f + 4 - b.rot) % 4; }

        public void Set(int lx, int y, int lz, Block blk, int meta = 0)
        {
            int wx, wz; ToWorld(lx, lz, out wx, out wz);
            w.Set(wx, b.floorY + y, wz, blk, meta);
        }

        public void SetF(int lx, int y, int lz, Block blk, int facingLocal, int extra = 0)
        {
            Set(lx, y, lz, blk, Facing(facingLocal) | extra);
        }

        public void Fill(int x0, int y0, int z0, int x1, int y1, int z1, Block blk)
        {
            for (int y = y0; y <= y1; y++) for (int z = z0; z <= z1; z++) for (int x = x0; x <= x1; x++) Set(x, y, z, blk);
        }
    }

    public static class Structures
    {
        const int VReg = 20, TReg = 14, SReg = 40, FReg = 10;

        // ====================================================================
        // MUNDO SUPERIOR
        // ====================================================================
        public static void Overworld(Chunk c, Writer w, OverworldGen g, ColInfo[] win)
        {
            int cx = c.cx, cz = c.cz;
            int rx0 = MathX.FloorDiv(cx, VReg), rz0 = MathX.FloorDiv(cz, VReg);
            for (int rz = rz0 - 1; rz <= rz0 + 1; rz++)
                for (int rx = rx0 - 1; rx <= rx0 + 1; rx++)
                {
                    var v = GetVillage(g, rx, rz);
                    if (v == null) continue;
                    int minX = v.cx - v.radius, maxX = v.cx + v.radius, minZ = v.cz - v.radius, maxZ = v.cz + v.radius;
                    if (w.ox + 15 < minX || w.ox > maxX || w.oz + 15 < minZ || w.oz > maxZ) continue;
                    BuildVillage(w, g, v);
                }
            int tx0 = MathX.FloorDiv(cx, TReg), tz0 = MathX.FloorDiv(cz, TReg);
            for (int tz = tz0 - 1; tz <= tz0 + 1; tz++)
                for (int tx = tx0 - 1; tx <= tx0 + 1; tx++)
                {
                    int px, pz;
                    if (!TemplePos(g, tx, tz, out px, out pz)) continue;
                    if (w.ox + 15 < px - 11 || w.ox > px + 11 || w.oz + 15 < pz - 11 || w.oz > pz + 11) continue;
                    BuildTemple(w, g, px, pz);
                }
            int sx0 = MathX.FloorDiv(cx, SReg), sz0 = MathX.FloorDiv(cz, SReg);
            for (int sz = sz0 - 1; sz <= sz0 + 1; sz++)
                for (int sx = sx0 - 1; sx <= sx0 + 1; sx++)
                {
                    int px, pz; StrongholdPos(g.seed, sx, sz, out px, out pz);
                    if (w.ox + 15 < px - 40 || w.ox > px + 40 || w.oz + 15 < pz - 40 || w.oz > pz + 40) continue;
                    BuildStronghold(w, g.seed, px, pz);
                }
            Dungeon(c, w, g);
            SkyRuin(c, w, g, win);
        }

        // ---------------------------------------------------------------- aldeas
        static readonly Dictionary<long, VillageLayout> villageCache = new Dictionary<long, VillageLayout>();

        static VillageLayout GetVillage(OverworldGen g, int rx, int rz)
        {
            long key = ((long)(g.seed & 0xFFFF) << 44) ^ ((long)(rx & 0x3FFFFF) << 22) ^ (long)(rz & 0x3FFFFF);
            lock (villageCache)
            {
                VillageLayout v;
                if (villageCache.TryGetValue(key, out v)) return v;
                v = MakeVillage(g, rx, rz);
                villageCache[key] = v;
                if (villageCache.Count > 512) villageCache.Clear();
                return v;
            }
        }

        /// <summary>Posicion central de la aldea de la region (rx,rz) si existe.</summary>
        public static bool VillageAt(OverworldGen g, int rx, int rz, out int x, out int z)
        {
            var v = GetVillage(g, rx, rz);
            x = v != null ? v.cx : 0; z = v != null ? v.cz : 0;
            return v != null;
        }

        public static int VillageRegion { get { return VReg; } }

        static VillageLayout MakeVillage(OverworldGen g, int rx, int rz)
        {
            uint h = MathX.Hash(rx, 701, rz, g.seed);
            if (h % 100 >= 62) return null;
            int ccx = rx * VReg + 4 + (int)((h >> 8) % (uint)(VReg - 8)), ccz = rz * VReg + 4 + (int)((h >> 16) % (uint)(VReg - 8));
            int x = ccx * 16 + 8, z = ccz * 16 + 8;
            var col = g.Column(x, z);
            var b = col.biome;
            if (col.HasWater || col.h < OverworldGen.Sea + 2 || col.h > OverworldGen.Sea + 28 || col.skyTop > 0) return null;
            int style;
            switch (b)
            {
                case BiomeId.Plains: case BiomeId.Forest: case BiomeId.BirchForest: style = 0; break;
                case BiomeId.Desert: style = 1; break;
                case BiomeId.Savanna: style = 2; break;
                case BiomeId.Taiga: style = 3; break;
                case BiomeId.Tundra: style = 4; break;
                default: return null;
            }
            int[] ox = { 24, -24, 0, 0, 16, -16 }, oz = { 0, 0, 24, -24, 16, -16 };
            for (int i = 0; i < ox.Length; i++)
            {
                var o = g.Column(x + ox[i], z + oz[i]);
                if (Math.Abs(o.h - col.h) > 7 || o.HasWater) return null;
            }
            var v = new VillageLayout { cx = x, cz = z, baseY = col.h, style = style, pal = MakePal(style) };
            var rng = new Rng(h ^ 0x7F4A7C15u);

            int lenXp = rng.Range(16, 31), lenXn = rng.Range(16, 31), lenZp = rng.Range(16, 31), lenZn = rng.Range(16, 31);
            v.roads.Add(new[] { x - lenXn, z - 1, x + lenXp, z + 1 });
            v.roads.Add(new[] { x - 1, z - lenZn, x + 1, z + lenZp });
            for (int arm = 0; arm < 4; arm++)
            {
                int len = arm == 0 ? lenXp : arm == 1 ? lenXn : arm == 2 ? lenZp : lenZn;
                int dir = (arm == 0 || arm == 2) ? 1 : -1;
                bool alongX = arm < 2;
                int t = 8;
                while (t < len)
                {
                    for (int side = -1; side <= 1; side += 2)
                    {
                        if (rng.Chance(0.22f)) continue;
                        var bd = NewBuilding(PickType(rng), rng);
                        int along = t * dir;
                        const int off = 3;
                        if (alongX)
                        {
                            bd.rot = side < 0 ? 2 : 0;
                            bd.x0 = x + along - bd.FW / 2;
                            bd.z0 = side < 0 ? z - off - bd.FD + 1 : z + off;
                        }
                        else
                        {
                            bd.rot = side < 0 ? 3 : 1;
                            bd.z0 = z + along - bd.FD / 2;
                            bd.x0 = side < 0 ? x - off - bd.FW + 1 : x + off;
                        }
                        var cc = g.Column(bd.x0 + bd.FW / 2, bd.z0 + bd.FD / 2);
                        if (cc.HasWater) continue;
                        bd.floorY = cc.h;
                        v.buildings.Add(bd);
                    }
                    t += 9 + rng.Range(0, 3);
                }
            }
            for (int i = -3; i <= 3; i++)
            {
                if (i == 0) continue;
                v.lamps.Add(new[] { x + i * 8, z + 2 }); v.lamps.Add(new[] { x + 2, z + i * 8 });
            }
            return v;
        }

        static int PickType(Rng r)
        {
            float f = r.Float();
            if (f < 0.34f) return 0;
            if (f < 0.58f) return 1;
            if (f < 0.78f) return 2;
            if (f < 0.9f) return 3;
            return 4;
        }

        static VBuilding NewBuilding(int type, Rng r)
        {
            var b = new VBuilding { type = type, cropIdx = r.Int(5) };
            switch (type)
            {
                case 0: b.w = 5; b.d = 5; break;
                case 1: b.w = 7; b.d = 5; break;
                case 2: b.w = 9; b.d = 9; break;
                case 3: b.w = 7; b.d = 7; break;
                default: b.w = 7; b.d = 9; break;
            }
            return b;
        }

        static Pal MakePal(int style)
        {
            var p = new Pal();
            int wd;
            switch (style)
            {
                case 1:
                    p.wall = B.Sandstone; p.log = B.Sandstone; p.floor = B.Sandstone; p.stairs = Block.ByKey["sandstone_stairs"]; p.slab = Block.ByKey["sandstone_slab"];
                    p.door = B.Door[Woods.Acacia]; p.foundation = B.Sandstone; p.path = B.Sandstone; p.glass = B.Glass; return p;
                case 2: wd = Woods.Acacia; break;
                case 3: case 4: wd = Woods.Spruce; break;
                default: wd = Woods.Oak; break;
            }
            p.wall = B.Planks[wd]; p.log = B.Log[wd]; p.floor = B.Cobble; p.stairs = B.WoodStairs[wd]; p.slab = B.WoodSlab[wd];
            p.door = B.Door[wd]; p.foundation = B.Cobble; p.path = B.Path; p.glass = B.Glass;
            return p;
        }

        static void BuildVillage(Writer w, OverworldGen g, VillageLayout v)
        {
            var pal = v.pal;
            foreach (var r in v.roads)
                for (int z = r[1]; z <= r[3]; z++)
                    for (int x = r[0]; x <= r[2]; x++)
                    {
                        if (!w.In(x, 64, z)) continue;
                        var col = g.Column(x, z);
                        if (col.HasWater) continue;
                        int y = col.h;
                        var cur = w.Get(x, y, z);
                        if (cur == B.Grass || cur == B.Dirt || cur == B.Sand || cur == B.Podzol || cur == B.CoarseDirt || cur == B.RedSand || cur == B.Gravel)
                        {
                            w.Set(x, y, z, pal.path);
                            for (int k = 1; k <= 3; k++)
                            {
                                var a = w.Get(x, y + k, z);
                                if (a.id != 0 && (a.shape == Shape.Cross || a == B.SnowLayer || B.IsLeaves(a) || B.IsLog(a))) w.Set(x, y + k, z, B.Air);
                            }
                        }
                    }
            BuildWell(w, g, v);
            foreach (var b in v.buildings) BuildBuilding(w, g, v, b);
            foreach (var l in v.lamps)
            {
                if (!w.In(l[0], 64, l[1])) continue;
                var col = g.Column(l[0], l[1]);
                if (col.HasWater) continue;
                var cur = w.Get(l[0], col.h, l[1]);
                if (cur == B.Path || cur == B.Sandstone || cur == B.Grass || cur == B.Dirt || cur == B.Sand)
                {
                    w.Set(l[0], col.h + 1, l[1], pal.log); w.Set(l[0], col.h + 2, l[1], pal.log); w.Set(l[0], col.h + 3, l[1], B.Torch);
                }
            }
        }

        static void BuildWell(Writer w, OverworldGen g, VillageLayout v)
        {
            int y = v.baseY;
            for (int dz = -3; dz <= 3; dz++)
                for (int dx = -3; dx <= 3; dx++)
                {
                    int x = v.cx + dx, z = v.cz + dz;
                    if (!w.In(x, y, z)) continue;
                    var col = g.Column(x, z);
                    for (int yy = y + 1; yy <= y + 6; yy++) { if (w.Get(x, yy, z).id != 0) w.Set(x, yy, z, B.Air); }
                    for (int yy = col.h; yy < y; yy++) w.Set(x, yy, z, B.Cobble);
                    if (Math.Abs(dx) <= 2 && Math.Abs(dz) <= 2)
                    {
                        bool inner = Math.Abs(dx) <= 1 && Math.Abs(dz) <= 1;
                        w.Set(x, y, z, inner ? B.Water : v.pal.floor);
                        if (inner) { w.Set(x, y - 1, z, B.Water); w.Set(x, y - 2, z, B.Cobble); }
                    }
                    else w.Set(x, y, z, v.pal.path);
                }
            for (int k = 1; k <= 3; k++)
                foreach (var s in new[] { new[] { -2, -2 }, new[] { 2, -2 }, new[] { -2, 2 }, new[] { 2, 2 } }) w.Set(v.cx + s[0], y + k, v.cz + s[1], v.pal.log);
            for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) w.Set(v.cx + dx, y + 4, v.cz + dz, v.pal.slab);
        }

        static void Foundation(Frame f, OverworldGen g, VillageLayout v, int margin)
        {
            var b = f.b;
            int minX = b.x0 - margin, maxX = b.x0 + b.FW - 1 + margin, minZ = b.z0 - margin, maxZ = b.z0 + b.FD - 1 + margin;
            for (int z = minZ; z <= maxZ; z++)
                for (int x = minX; x <= maxX; x++)
                {
                    if (!f.w.In(x, 64, z)) continue;
                    var col = g.Column(x, z);
                    bool inside = x >= b.x0 && x < b.x0 + b.FW && z >= b.z0 && z < b.z0 + b.FD;
                    for (int y = b.floorY + 1; y <= b.floorY + 11 && y < 127; y++)
                    {
                        var cur = f.w.Get(x, y, z);
                        if (cur.id != 0 && (inside || cur.shape == Shape.Cross || B.IsLeaves(cur) || B.IsLog(cur) || cur == B.SnowLayer)) f.w.Set(x, y, z, B.Air);
                    }
                    if (!inside && col.h >= b.floorY) continue;
                    for (int y = b.floorY; y >= Math.Max(2, b.floorY - 10); y--)
                    {
                        var cur = f.w.Get(x, y, z);
                        if (y < b.floorY && cur.Collides && cur.FullOpaque) break;
                        if (inside || y < b.floorY) f.w.Set(x, y, z, inside && y == b.floorY ? v.pal.floor : v.pal.foundation);
                    }
                }
        }

        static void BuildBuilding(Writer w, OverworldGen g, VillageLayout v, VBuilding b)
        {
            int minX = b.x0 - 2, maxX = b.x0 + b.FW + 1, minZ = b.z0 - 2, maxZ = b.z0 + b.FD + 1;
            if (w.ox + 15 < minX || w.ox > maxX || w.oz + 15 < minZ || w.oz > maxZ) return;
            var f = new Frame(w, b);
            var rng = new Rng(MathX.Hash(b.x0, b.type, b.z0, g.seed + 9));
            Foundation(f, g, v, 1);
            switch (b.type)
            {
                case 0: House(f, v.pal, rng, 5, 5); break;
                case 1: House(f, v.pal, rng, 7, 5); break;
                case 2: Farm(f, v.pal, rng); break;
                case 3: Smithy(f, v.pal, rng); break;
                default: Library(f, v.pal, rng); break;
            }
            int wx, wz; f.ToWorld(b.w / 2, -1, out wx, out wz);
            if (w.In(wx, 64, wz)) w.Set(wx, b.floorY, wz, v.pal.path);
        }

        static void Roof(Frame f, Pal p, int w, int d, int y0)
        {
            for (int j = 0; j <= (d - 1) / 2; j++)
            {
                int zA = j, zB = d - 1 - j;
                for (int x = -1; x <= w; x++)
                {
                    if (zA == zB) f.Set(x, y0 + j, zA, p.slab, 0);
                    else { f.SetF(x, y0 + j, zA, p.stairs, 0); f.SetF(x, y0 + j, zB, p.stairs, 2); }
                }
                for (int z = zA + 1; z < zB; z++) { f.Set(0, y0 + j, z, p.wall); f.Set(w - 1, y0 + j, z, p.wall); }
            }
            for (int x = -1; x <= w; x++) { f.SetF(x, y0, -1, p.stairs, 0); f.SetF(x, y0, d, p.stairs, 2); }
        }

        static void Walls(Frame f, Pal p, int w, int d, int height, bool stoneBase)
        {
            for (int y = 1; y <= height; y++)
                for (int x = 0; x < w; x++)
                    for (int z = 0; z < d; z++)
                    {
                        bool edge = x == 0 || x == w - 1 || z == 0 || z == d - 1;
                        if (!edge) continue;
                        bool corner = (x == 0 || x == w - 1) && (z == 0 || z == d - 1);
                        f.Set(x, y, z, corner ? p.log : (y == 1 && stoneBase ? p.foundation : p.wall));
                    }
        }

        static void Door(Frame f, Pal p, int x)
        {
            f.Set(x, 1, 0, B.Air); f.Set(x, 2, 0, B.Air);
            f.SetF(x, 1, 0, p.door, 2); f.SetF(x, 2, 0, p.door, 2, 8);
        }

        static void House(Frame f, Pal pal, Rng r, int w, int d)
        {
            f.Fill(0, 1, 0, w - 1, 3, d - 1, B.Air);
            for (int x = 0; x < w; x++) for (int z = 0; z < d; z++) f.Set(x, 0, z, pal.floor == B.Cobble ? pal.wall : pal.floor);
            Walls(f, pal, w, d, 3, true);
            f.Set(w / 2, 2, d - 1, pal.glass); f.Set(0, 2, d / 2, pal.glass); f.Set(w - 1, 2, d / 2, pal.glass);
            if (w >= 7) { f.Set(2, 2, d - 1, pal.glass); f.Set(w - 3, 2, d - 1, pal.glass); }
            Door(f, pal, w / 2);
            f.Set(w / 2 + 1, 2, -1, B.Torch, 0);
            Roof(f, pal, w, d, 4);
            f.Set(1, 2, 1, B.Torch);
            f.Set(w - 2, 1, d - 2, B.Bed);
            f.Set(w - 2, 1, 1, B.CraftingTable);
            if (r.Chance(0.5f)) f.Set(1, 1, d - 2, B.Furnace, f.Facing(2));
            else
            {
                int wx, wz; f.ToWorld(1, d - 2, out wx, out wz);
                f.w.Chest(wx, f.b.floorY + 1, wz, f.Facing(2), "village", r);
            }
            int sx, sz; f.ToWorld(w / 2, 1, out sx, out sz);
            f.w.Spawn("villager", sx + 0.5f, f.b.floorY + 1f, sz + 0.5f);
        }

        static void Farm(Frame f, Pal p, Rng r)
        {
            const int w = 9, d = 9;
            var crop = B.Crops[f.b.cropIdx];
            f.Fill(0, 1, 0, w - 1, 4, d - 1, B.Air);
            for (int x = 0; x < w; x++)
                for (int z = 0; z < d; z++)
                {
                    bool edge = x == 0 || x == w - 1 || z == 0 || z == d - 1;
                    if (edge) { f.Set(x, 0, z, p.log); continue; }
                    if (x == 4) { f.Set(x, 0, z, B.Water); continue; }
                    f.Set(x, 0, z, B.FarmlandWet);
                    f.Set(x, 1, z, crop, r.Chance(0.7f) ? 7 : r.Range(2, 7));
                }
            foreach (var c in new[] { new[] { 0, 0 }, new[] { w - 1, 0 }, new[] { 0, d - 1 }, new[] { w - 1, d - 1 } }) { f.Set(c[0], 1, c[1], p.log); f.Set(c[0], 2, c[1], B.Torch); }
            f.Set(4, 0, 0, p.floor); f.Set(4, 0, d - 1, p.floor);
        }

        static void Smithy(Frame f, Pal p, Rng r)
        {
            const int w = 7, d = 7;
            f.Fill(0, 1, 0, w - 1, 4, d - 1, B.Air);
            for (int x = 0; x < w; x++) for (int z = 0; z < d; z++) f.Set(x, 0, z, B.Cobble);
            for (int y = 1; y <= 4; y++)
                for (int x = 0; x < w; x++)
                    for (int z = 0; z < d; z++)
                        if (x == 0 || x == w - 1 || z == 0 || z == d - 1) f.Set(x, y, z, y == 4 ? B.StoneBricks : B.Cobble);
            for (int x = 0; x < w; x++) for (int z = 0; z < d; z++) f.Set(x, 5, z, p.slab);
            Door(f, p, 3);
            f.Set(0, 2, 3, B.Glass); f.Set(w - 1, 2, 3, B.Glass);
            f.Set(1, 1, 1, B.Lava); f.Set(2, 1, 1, B.Cobble); f.Set(1, 1, 2, B.Cobble);
            f.Set(5, 1, 5, B.Furnace, f.Facing(2)); f.Set(4, 1, 5, B.Furnace, f.Facing(2));
            f.Set(5, 1, 1, B.CraftingTable);
            f.Set(1, 3, 5, B.Torch); f.Set(5, 3, 3, B.Torch);
            int wx, wz; f.ToWorld(1, 5, out wx, out wz);
            f.w.Chest(wx, f.b.floorY + 1, wz, f.Facing(2), "smithy", r);
            int sx, sz; f.ToWorld(3, 3, out sx, out sz);
            f.w.Spawn("villager", sx + 0.5f, f.b.floorY + 1f, sz + 0.5f);
        }

        static void Library(Frame f, Pal p, Rng r)
        {
            const int w = 7, d = 9;
            f.Fill(0, 1, 0, w - 1, 4, d - 1, B.Air);
            for (int x = 0; x < w; x++) for (int z = 0; z < d; z++) f.Set(x, 0, z, p.wall);
            Walls(f, p, w, d, 4, true);
            Door(f, p, 3);
            for (int z = 2; z < d - 1; z += 2) { f.Set(0, 3, z, B.Glass); f.Set(w - 1, 3, z, B.Glass); }
            Roof(f, p, w, d, 5);
            for (int z = 2; z < d - 1; z++) { f.Set(1, 1, z, B.Bookshelf); f.Set(1, 2, z, B.Bookshelf); f.Set(w - 2, 1, z, B.Bookshelf); f.Set(w - 2, 2, z, B.Bookshelf); }
            f.Set(3, 1, d - 2, B.CraftingTable); f.Set(3, 3, 1, B.Torch);
            int wx, wz; f.ToWorld(3, d - 3, out wx, out wz);
            f.w.Chest(wx, f.b.floorY + 1, wz, f.Facing(2), "village", r);
            int sx, sz; f.ToWorld(3, 3, out sx, out sz);
            f.w.Spawn("villager", sx + 0.5f, f.b.floorY + 1f, sz + 0.5f);
        }

        // ---------------------------------------------------------------- templo del desierto
        static bool TemplePos(OverworldGen g, int tx, int tz, out int x, out int z)
        {
            uint h = MathX.Hash(tx, 702, tz, g.seed);
            x = z = 0;
            if (h % 100 >= 48) return false;
            x = (tx * TReg + 2 + (int)((h >> 8) % (uint)(TReg - 4))) * 16 + 8;
            z = (tz * TReg + 2 + (int)((h >> 16) % (uint)(TReg - 4))) * 16 + 8;
            var col = g.Column(x, z);
            return col.biome == BiomeId.Desert && !col.HasWater && col.skyTop < 0;
        }

        static void BuildTemple(Writer w, OverworldGen g, int px, int pz)
        {
            var col = g.Column(px, pz);
            int by = col.h;
            var rng = new Rng(MathX.Hash(px, 703, pz, g.seed));
            for (int k = 0; k <= 9; k++)
            {
                int hs = 10 - k;
                for (int dz = -hs; dz <= hs; dz++)
                    for (int dx = -hs; dx <= hs; dx++)
                    {
                        int x = px + dx, z = pz + dz;
                        if (!w.In(x, by, z)) continue;
                        bool edge = Math.Abs(dx) == hs || Math.Abs(dz) == hs;
                        Block b = B.Sandstone;
                        if (k == 2 && edge) b = B.Terracotta[1];
                        if (k == 5 && edge) b = B.Terracotta[11];
                        if (k == 0) { var gcol = g.Column(x, z); for (int y = gcol.h; y <= by; y++) w.Set(x, y, z, B.Sandstone); }
                        w.Set(x, by + k, z, b);
                        if (k > 0 && edge) for (int y = by; y < by + k; y++) w.Set(x, y, z, k == 2 ? B.Terracotta[1] : B.Sandstone);
                    }
            }
            w.Fill(px - 7, by + 1, pz - 7, px + 7, by + 5, pz + 7, B.Sandstone);
            w.Fill(px - 6, by + 1, pz - 6, px + 6, by + 5, pz + 6, B.Air);
            w.Fill(px - 6, by, pz - 6, px + 6, by, pz + 6, B.Sandstone);
            for (int dz = -6; dz <= 6; dz++) for (int dx = -6; dx <= 6; dx++) if (Math.Abs(dx) + Math.Abs(dz) < 4) w.Set(px + dx, by, pz + dz, B.Terracotta[11]);
            w.Fill(px - 1, by - 4, pz - 1, px + 1, by - 1, pz + 1, B.Sandstone);
            w.Set(px, by - 3, pz, B.Tnt); w.Set(px, by - 2, pz, B.Tnt);
            w.Set(px, by - 4, pz, B.Terracotta[1]);
            w.Chest(px + 5, by + 1, pz, 3, "temple", rng); w.Chest(px - 5, by + 1, pz, 1, "temple", rng);
            w.Chest(px, by + 1, pz + 5, 2, "temple", rng); w.Chest(px, by + 1, pz - 5, 0, "temple", rng);
            w.Fill(px - 1, by + 1, pz - 10, px + 1, by + 3, pz - 6, B.Air);
            for (int z = pz - 10; z <= pz - 7; z++) { w.Set(px - 2, by + 1, z, B.Sandstone); w.Set(px + 2, by + 1, z, B.Sandstone); }
            w.Set(px - 5, by + 3, pz - 5, B.Torch); w.Set(px + 5, by + 3, pz - 5, B.Torch);
            w.Spawn("mummy", px + 0.5f, by + 1f, pz + 3.5f);
        }

        // ---------------------------------------------------------------- mazmorras
        static void Dungeon(Chunk c, Writer w, OverworldGen g)
        {
            var rng = new Rng(MathX.Hash(c.cx, 704, c.cz, g.seed));
            if (!rng.Chance(0.07f)) return;
            int rx = rng.Range(5, 11), rz = rng.Range(5, 11), ry = rng.Range(12, 38);
            int x0 = w.ox + rx, z0 = w.oz + rz;
            for (int dy = 0; dy <= 5; dy += 5)
                for (int dz = -4; dz <= 4; dz += 4)
                    for (int dx = -4; dx <= 4; dx += 4)
                    {
                        var b = w.Get(x0 + dx, ry + dy, z0 + dz);
                        if (b != B.Stone && b != B.Deepslate && b != B.Granite && b != B.Diorite && b != B.Andesite && b != B.Tuff) return;
                    }
            w.Fill(x0 - 4, ry - 1, z0 - 4, x0 + 4, ry + 4, z0 + 4, B.Cobble);
            w.Fill(x0 - 3, ry, z0 - 3, x0 + 3, ry + 3, z0 + 3, B.Air);
            for (int dz = -3; dz <= 3; dz++) for (int dx = -3; dx <= 3; dx++) w.Set(x0 + dx, ry - 1, z0 + dz, rng.Chance(0.5f) ? B.MossyCobble : B.Cobble);
            w.Set(x0, ry, z0, B.Spawner, rng.Int(3));
            w.Chest(x0 - 3, ry, z0 + rng.Range(-2, 3), 1, "dungeon", rng);
            if (rng.Chance(0.6f)) w.Chest(x0 + 3, ry, z0 + rng.Range(-2, 3), 3, "dungeon", rng);
            w.Set(x0 + 2, ry + 2, z0 + 3, B.Torch, 0);
        }

        // ---------------------------------------------------------------- ruinas celestes
        static void SkyRuin(Chunk c, Writer w, OverworldGen g, ColInfo[] win)
        {
            var rng = new Rng(MathX.Hash(c.cx, 705, c.cz, g.seed));
            const int M = OverworldGen.M, WN = OverworldGen.WN;
            var ci = win[(8 + M) * WN + 8 + M];
            if (ci.skyTop < 0 || ci.skyTop - ci.skyBottom < 7 || !rng.Chance(0.3f)) return;
            int[] ox = { 5, -5, 0, 0 }, oz = { 0, 0, 5, -5 };
            for (int k = 0; k < 4; k++)
                if (win[(8 + M + oz[k]) * WN + 8 + M + ox[k]].skyTop < 0) return;
            int x0 = w.ox + 8, z0 = w.oz + 8, y = ci.skyTop;
            for (int dz = -4; dz <= 4; dz++)
                for (int dx = -4; dx <= 4; dx++)
                {
                    if (dx * dx + dz * dz > 20) continue;
                    w.Set(x0 + dx, y, z0 + dz, rng.Chance(0.2f) ? B.SkyStone : B.SkyBricks);
                    for (int k = 1; k <= 6; k++) w.Set(x0 + dx, y + k, z0 + dz, B.Air);
                }
            foreach (var s in new[] { new[] { -3, -3 }, new[] { 3, -3 }, new[] { -3, 3 }, new[] { 3, 3 } })
            {
                int h = rng.Range(3, 6);
                for (int k = 1; k <= h; k++) w.Set(x0 + s[0], y + k, z0 + s[1], B.SkyBricks);
                w.Set(x0 + s[0], y + h + 1, z0 + s[1], B.SkyCrystal);
            }
            w.Chest(x0, y + 1, z0, rng.Int(4), "sky", rng);
            w.Spawn("spirit", x0 + 0.5f, y + 3, z0 + 2.5f); w.Spawn("spirit", x0 - 1.5f, y + 4, z0 - 2.5f);
            if (rng.Chance(0.5f)) w.Spawn("crystal_golem", x0 + 0.5f, y + 1, z0 - 3.5f);
        }

        // ---------------------------------------------------------------- fortaleza (portal del Final)
        public static void StrongholdPos(int seed, int sx, int sz, out int x, out int z)
        {
            uint h = MathX.Hash(sx, 706, sz, seed);
            x = (sx * SReg + 6 + (int)((h >> 8) % (uint)(SReg - 12))) * 16 + 8;
            z = (sz * SReg + 6 + (int)((h >> 16) % (uint)(SReg - 12))) * 16 + 8;
        }

        /// <summary>Fortaleza mas cercana a (x,z).</summary>
        public static void NearestStronghold(int seed, int x, int z, out int fx, out int fz)
        {
            int sx0 = MathX.FloorDiv(x >> 4, SReg), sz0 = MathX.FloorDiv(z >> 4, SReg);
            long best = long.MaxValue; fx = 0; fz = 0;
            for (int sz = sz0 - 2; sz <= sz0 + 2; sz++)
                for (int sx = sx0 - 2; sx <= sx0 + 2; sx++)
                {
                    int px, pz; StrongholdPos(seed, sx, sz, out px, out pz);
                    long d = (long)(px - x) * (px - x) + (long)(pz - z) * (pz - z);
                    if (d < best) { best = d; fx = px; fz = pz; }
                }
        }

        static void BuildStronghold(Writer w, int seed, int px, int pz)
        {
            var rng = new Rng(MathX.Hash(px, 707, pz, seed));
            const int fy = 22;
            w.Fill(px - 8, fy - 1, pz - 8, px + 8, fy + 8, pz + 8, B.StoneBricks);
            w.Fill(px - 7, fy, pz - 7, px + 7, fy + 7, pz + 7, B.Air);
            for (int dz = -8; dz <= 8; dz++)
                for (int dx = -8; dx <= 8; dx++)
                    for (int dy = -1; dy <= 8; dy++)
                    {
                        bool edge = Math.Abs(dx) == 8 || Math.Abs(dz) == 8 || dy == -1 || dy == 8;
                        if (!edge) continue;
                        float r = MathX.Hash01(px + dx, fy + dy, pz + dz, seed + 3);
                        w.Set(px + dx, fy + dy, pz + dz, r < 0.2f ? B.MossyStoneBricks : (r < 0.35f ? B.CrackedStoneBricks : B.StoneBricks));
                    }
            for (int dz = -3; dz <= 3; dz++) for (int dx = -3; dx <= 3; dx++) w.Set(px + dx, fy, pz + dz, B.StoneBricks);
            const int fyF = fy + 2;
            for (int i = -1; i <= 1; i++)
            {
                w.Set(px + i, fyF, pz - 2, B.EndFrame, 0); w.Set(px + i, fyF, pz + 2, B.EndFrame, 0);
                w.Set(px - 2, fyF, pz + i, B.EndFrame, 0); w.Set(px + 2, fyF, pz + i, B.EndFrame, 0);
                foreach (var p in new[] { new[] { i, -2 }, new[] { i, 2 }, new[] { -2, i }, new[] { 2, i } })
                    for (int y = fy + 1; y < fyF; y++) w.Set(px + p[0], y, pz + p[1], B.StoneBricks);
            }
            for (int dz = -1; dz <= 1; dz++) for (int dx = -1; dx <= 1; dx++) { w.Set(px + dx, fy, pz + dz, B.Lava); w.Set(px + dx, fy + 1, pz + dz, B.Lava); w.Set(px + dx, fyF, pz + dz, B.Air); }
            foreach (var s in new[] { new[] { -6, -6 }, new[] { 6, -6 }, new[] { -6, 6 }, new[] { 6, 6 } }) w.Set(px + s[0], fy + 2, pz + s[1], B.Torch);
            int[][] dirs = { new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, 1 }, new[] { 0, -1 } };
            for (int k = 0; k < 4; k++)
            {
                int len = rng.Range(14, 26);
                int dx = dirs[k][0], dz = dirs[k][1];
                for (int t = 8; t < 8 + len; t++)
                    for (int s = -2; s <= 2; s++)
                        for (int y = fy - 1; y <= fy + 4; y++)
                        {
                            int x = px + dx * t + (dz != 0 ? s : 0), z = pz + dz * t + (dx != 0 ? s : 0);
                            bool inner = Math.Abs(s) <= 1 && y >= fy && y <= fy + 3;
                            if (inner) w.Set(x, y, z, B.Air);
                            else w.Set(x, y, z, MathX.Hash01(x, y, z, seed) < 0.25f ? B.MossyStoneBricks : B.StoneBricks);
                        }
                for (int t = 11; t < 8 + len; t += 6) w.Set(px + dx * t + (dz != 0 ? 1 : 0), fy + 2, pz + dz * t + (dx != 0 ? 1 : 0), B.Torch);
                int ex = px + dx * (8 + len + 3), ez = pz + dz * (8 + len + 3);
                w.Fill(ex - 4, fy - 1, ez - 4, ex + 4, fy + 5, ez + 4, B.StoneBricks);
                w.Fill(ex - 3, fy, ez - 3, ex + 3, fy + 4, ez + 3, B.Air);
                if (k == 0)
                {
                    for (int z = -2; z <= 2; z++) { w.Set(ex - 3, fy, ez + z, B.Bookshelf); w.Set(ex - 3, fy + 1, ez + z, B.Bookshelf); w.Set(ex + 3, fy, ez + z, B.Bookshelf); w.Set(ex + 3, fy + 1, ez + z, B.Bookshelf); }
                    w.Chest(ex, fy, ez, 1, "stronghold", rng);
                }
                else if (k == 1) { w.Chest(ex, fy, ez, 3, "stronghold", rng); w.Set(ex + 1, fy, ez, B.CraftingTable); }
                else if (k == 2) w.Set(ex, fy, ez, B.Spawner, 1);
                w.Set(ex + 2, fy + 2, ez + 2, B.Torch);
            }
        }

        // ====================================================================
        // ABISMO: fortalezas de ladrillo del Abismo
        // ====================================================================
        public static void Abismo(Chunk c, Writer w, AbismoGen g)
        {
            int rx0 = MathX.FloorDiv(c.cx, FReg), rz0 = MathX.FloorDiv(c.cz, FReg);
            for (int rz = rz0 - 1; rz <= rz0 + 1; rz++)
                for (int rx = rx0 - 1; rx <= rx0 + 1; rx++)
                {
                    uint h = MathX.Hash(rx, 708, rz, g.seed);
                    if (h % 100 >= 55) continue;
                    int px = (rx * FReg + 2 + (int)((h >> 8) % (uint)(FReg - 4))) * 16 + 8, pz = (rz * FReg + 2 + (int)((h >> 16) % (uint)(FReg - 4))) * 16 + 8;
                    if (w.ox + 15 < px - 30 || w.ox > px + 30 || w.oz + 15 < pz - 30 || w.oz > pz + 30) continue;
                    BuildAbyssFortress(w, g.seed, px, pz, h);
                }
        }

        static void BuildAbyssFortress(Writer w, int seed, int px, int pz, uint h)
        {
            var rng = new Rng(h ^ 0x1234567u);
            int y0 = 60 + (int)(h % 12);
            Block br = B.AbyssBricks;
            // dos pasillos en cruz
            for (int axis = 0; axis < 2; axis++)
                for (int t = -26; t <= 26; t++)
                    for (int s = -3; s <= 3; s++)
                        for (int y = 0; y <= 5; y++)
                        {
                            int x = px + (axis == 0 ? t : s), z = pz + (axis == 0 ? s : t);
                            bool wall = Math.Abs(s) == 3 || y == 0 || y == 5;
                            if (y == 0) w.Set(x, y0, z, br);
                            else if (!wall) w.Set(x, y0 + y, z, B.Air);
                            else if (axis == 0 || Math.Abs(t) > 3) w.Set(x, y0 + y, z, br);
                        }
            // pilares de soporte
            for (int t = -24; t <= 24; t += 6)
                for (int s = -3; s <= 3; s += 6)
                    for (int axis = 0; axis < 2; axis++)
                        for (int y = y0 - 1; y > 8; y--)
                        {
                            int x = px + (axis == 0 ? t : s), z = pz + (axis == 0 ? s : t);
                            var cur = w.Get(x, y, z);
                            if (cur.Collides && !cur.fluid) break;
                            w.Set(x, y, z, br);
                        }
            // torre central
            w.Hollow(px - 6, y0 + 1, pz - 6, px + 6, y0 + 13, pz + 6, br, false, true);
            w.Fill(px - 5, y0 + 6, pz - 5, px + 5, y0 + 6, pz + 5, br);
            w.Set(px, y0 + 7, pz, B.Spawner, 3);
            w.Set(px - 3, y0 + 7, pz - 3, B.Spawner, 3);
            w.Chest(px + 4, y0 + 7, pz + 4, 2, "abyss", rng);
            w.Chest(px - 4, y0 + 7, pz + 4, 2, "abyss", rng);
            for (int x = -20; x <= 20; x += 8) { w.Set(px + x, y0 + 4, pz + 2, B.Glowstone); w.Set(px + x, y0 + 4, pz - 2, B.Glowstone); }
        }
    }
}
