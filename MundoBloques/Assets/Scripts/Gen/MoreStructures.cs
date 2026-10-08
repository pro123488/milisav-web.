using System;
using System.Collections.Generic;

namespace MundoBloques
{
    /// <summary>Estructuras adicionales del Mundo Superior: minas abandonadas, naufragios y portales en ruinas.</summary>
    public static class MoreStructures
    {
        const int MReg = 7, SReg = 9, RReg = 8;

        public static void Overworld(Chunk c, Writer w, OverworldGen g)
        {
            int cx = c.cx, cz = c.cz;
            // ---- minas abandonadas
            int mx0 = MathX.FloorDiv(cx, MReg), mz0 = MathX.FloorDiv(cz, MReg);
            for (int mz = mz0 - 1; mz <= mz0 + 1; mz++)
                for (int mx = mx0 - 1; mx <= mx0 + 1; mx++)
                {
                    var m = GetMine(g, mx, mz);
                    if (m == null) continue;
                    if (w.ox + 15 < m.minX || w.ox > m.maxX || w.oz + 15 < m.minZ || w.oz > m.maxZ) continue;
                    BuildMine(w, g, m);
                }
            // ---- naufragios
            int sx0 = MathX.FloorDiv(cx, SReg), sz0 = MathX.FloorDiv(cz, SReg);
            for (int sz = sz0 - 1; sz <= sz0 + 1; sz++)
                for (int sx = sx0 - 1; sx <= sx0 + 1; sx++)
                {
                    int px, pz, dir;
                    if (!ShipPos(g, sx, sz, out px, out pz, out dir)) continue;
                    if (w.ox + 15 < px - 12 || w.ox > px + 12 || w.oz + 15 < pz - 12 || w.oz > pz + 12) continue;
                    BuildShip(w, g, px, pz, dir);
                }
            // ---- portales en ruinas
            int rx0 = MathX.FloorDiv(cx, RReg), rz0 = MathX.FloorDiv(cz, RReg);
            for (int rz = rz0 - 1; rz <= rz0 + 1; rz++)
                for (int rx = rx0 - 1; rx <= rx0 + 1; rx++)
                {
                    int px, pz;
                    if (!RuinPos(g, rx, rz, out px, out pz)) continue;
                    if (w.ox + 15 < px - 6 || w.ox > px + 6 || w.oz + 15 < pz - 6 || w.oz > pz + 6) continue;
                    BuildRuinedPortal(w, g, px, pz);
                }
        }

        /// <summary>Que estructura generada hay en este punto (para los logros): "mineshaft", "shipwreck" o null.</summary>
        public static string KindAt(OverworldGen g, int x, int y, int z)
        {
            int rx0 = MathX.FloorDiv(x >> 4, MReg), rz0 = MathX.FloorDiv(z >> 4, MReg);
            for (int rz = rz0 - 1; rz <= rz0 + 1; rz++)
                for (int rx = rx0 - 1; rx <= rx0 + 1; rx++)
                {
                    var m = GetMine(g, rx, rz);
                    if (m != null && x >= m.minX && x <= m.maxX && z >= m.minZ && z <= m.maxZ && y >= m.y - 1 && y <= m.y + 5) return "mineshaft";
                }
            int sx0 = MathX.FloorDiv(x >> 4, SReg), sz0 = MathX.FloorDiv(z >> 4, SReg);
            for (int sz = sz0 - 1; sz <= sz0 + 1; sz++)
                for (int sx = sx0 - 1; sx <= sx0 + 1; sx++)
                {
                    int px, pz, dir;
                    if (ShipPos(g, sx, sz, out px, out pz, out dir) && Math.Abs(x - px) <= 9 && Math.Abs(z - pz) <= 9) return "shipwreck";
                }
            return null;
        }

        // ====================================================================
        // MINAS ABANDONADAS
        // ====================================================================
        internal sealed class MineLayout
        {
            public int cx, cz, y, minX, maxX, minZ, maxZ;
            public List<int[]> tunnels = new List<int[]>();     // x0,z0,x1,z1 (linea central, alineada con un eje)
            public List<int[]> rooms = new List<int[]>();       // x,z,radio
        }

        static readonly Dictionary<long, MineLayout> mineCache = new Dictionary<long, MineLayout>();

        internal static MineLayout GetMine(OverworldGen g, int rx, int rz)
        {
            long key = ((long)(g.seed & 0xFFFF) << 44) ^ ((long)(rx & 0x3FFFFF) << 22) ^ (long)(rz & 0x3FFFFF);
            lock (mineCache)
            {
                MineLayout m;
                if (mineCache.TryGetValue(key, out m)) return m;
                m = MakeMine(g, rx, rz);
                mineCache[key] = m;
                if (mineCache.Count > 256) mineCache.Clear();
                return m;
            }
        }

        static MineLayout MakeMine(OverworldGen g, int rx, int rz)
        {
            uint h = MathX.Hash(rx, 801, rz, g.seed);
            if (h % 100 >= 60) return null;
            int cx = (rx * MReg + 1 + (int)((h >> 8) % (uint)(MReg - 2))) * 16 + 8;
            int cz = (rz * MReg + 1 + (int)((h >> 16) % (uint)(MReg - 2))) * 16 + 8;
            int y = 16 + (int)((h >> 24) % 22u);
            var col = g.Column(cx, cz);
            if (col.h < y + 10 || col.skyTop >= 0) return null;
            var rng = new Rng(h ^ 0x5BD1E995u);
            var m = new MineLayout { cx = cx, cz = cz, y = y };
            int len = rng.Range(40, 72);
            int x0 = cx - len / 2, x1 = cx + len / 2;
            m.tunnels.Add(new[] { x0, cz, x1, cz });
            m.rooms.Add(new[] { cx, cz, 4 });
            m.rooms.Add(new[] { x0, cz, 2 });
            m.rooms.Add(new[] { x1, cz, 2 });
            int minZ = cz, maxZ = cz;
            for (int x = x0 + 8; x < x1 - 4; x += rng.Range(11, 18))
            {
                if (Math.Abs(x - cx) < 6) continue;
                int bl = rng.Range(12, 30), sgn = rng.Chance(0.5f) ? 1 : -1;
                m.tunnels.Add(new[] { x, cz, x, cz + sgn * bl });
                m.rooms.Add(new[] { x, cz + sgn * bl, 2 });
                minZ = Math.Min(minZ, cz + sgn * bl); maxZ = Math.Max(maxZ, cz + sgn * bl);
                if (rng.Chance(0.35f))
                {
                    int bl2 = rng.Range(8, 20);
                    m.tunnels.Add(new[] { x, cz, x, cz - sgn * bl2 });
                    m.rooms.Add(new[] { x, cz - sgn * bl2, 2 });
                    minZ = Math.Min(minZ, cz - sgn * bl2); maxZ = Math.Max(maxZ, cz - sgn * bl2);
                }
            }
            m.minX = x0 - 6; m.maxX = x1 + 6; m.minZ = minZ - 6; m.maxZ = maxZ + 6;
            return m;
        }

        // posiciones ya comprobadas dentro de una llamada (altura del terreno)
        sealed class HeightCache
        {
            readonly OverworldGen g; readonly Dictionary<long, int> d = new Dictionary<long, int>();
            public HeightCache(OverworldGen g) { this.g = g; }
            public int At(int x, int z)
            {
                long k = ((long)x << 32) ^ (uint)z; int h;
                if (!d.TryGetValue(k, out h)) { h = g.Column(x, z).h; d[k] = h; }
                return h;
            }
        }

        static void CarveCell(Writer w, HeightCache hc, int x, int z, int y, int height)
        {
            if (!w.In(x, y, z) || hc.At(x, z) < y + 6) return;
            for (int dy = 0; dy < height; dy++)
            {
                var b = w.Get(x, y + dy, z);
                if (b.id == 0 || b.fluid || b == B.Bedrock) continue;
                w.Set(x, y + dy, z, B.Air);
            }
            var fl = w.Get(x, y - 1, z);
            if (fl.id == 0 || fl.fluid) w.Set(x, y - 1, z, B.Planks[0]);
        }

        static void BuildMine(Writer w, OverworldGen g, MineLayout m)
        {
            int y = m.y;
            var hc = new HeightCache(g);
            // tuneles
            foreach (var t in m.tunnels)
            {
                bool alongX = t[1] == t[3];
                int a0 = Math.Min(alongX ? t[0] : t[1], alongX ? t[2] : t[3]);
                int a1 = Math.Max(alongX ? t[0] : t[1], alongX ? t[2] : t[3]);
                for (int a = a0; a <= a1; a++)
                {
                    int tt = a - a0;
                    for (int s = -1; s <= 1; s++)
                    {
                        int x = alongX ? a : t[0] + s, z = alongX ? t[1] + s : a;
                        CarveCell(w, hc, x, z, y, 3);
                    }
                    int cxp = alongX ? a : t[0], czp = alongX ? t[1] : a;
                    if (tt % 5 == 2)
                    {
                        for (int s = -2; s <= 2; s++)
                        {
                            int x = alongX ? a : t[0] + s, z = alongX ? t[1] + s : a;
                            if (!w.In(x, y + 3, z) || hc.At(x, z) < y + 6) continue;
                            if (Math.Abs(s) == 2) { for (int dy = 0; dy < 3; dy++) w.Set(x, y + dy, z, B.Log[0]); }
                            w.Set(x, y + 3, z, B.Planks[0]);
                        }
                    }
                    else if (tt % 15 == 9)
                    {
                        int x = alongX ? a : t[0] + 1, z = alongX ? t[1] + 1 : a;
                        if (w.In(x, y, z) && hc.At(x, z) >= y + 6 && w.Get(x, y, z).id == 0 && w.Get(x, y - 1, z).Collides) w.Set(x, y, z, B.Torch, 0);
                    }
                    else if (tt % 11 == 5 && MathX.Hash01(cxp, y, czp, g.seed) < 0.35f)
                    {
                        // escombros de grava en el suelo
                        if (w.In(cxp, y - 1, czp) && w.Get(cxp, y - 1, czp).Collides) w.Set(cxp, y - 1, czp, B.Gravel);
                    }
                }
            }
            // salas
            for (int i = 0; i < m.rooms.Count; i++)
            {
                int rx = m.rooms[i][0], rz = m.rooms[i][1], r = m.rooms[i][2];
                if (rx + r < w.ox || rx - r > w.ox + 15 || rz + r < w.oz || rz - r > w.oz + 15) continue;
                for (int dz = -r; dz <= r; dz++)
                    for (int dx = -r; dx <= r; dx++) CarveCell(w, hc, rx + dx, rz + dz, y, 4);
                foreach (var cs in new[] { new[] { -r, -r }, new[] { r, -r }, new[] { -r, r }, new[] { r, r } })
                    if (w.In(rx + cs[0], y, rz + cs[1]) && hc.At(rx + cs[0], rz + cs[1]) >= y + 6) for (int dy = 0; dy < 4; dy++) w.Set(rx + cs[0], y + dy, rz + cs[1], B.Log[0]);
                var rng = new Rng(MathX.Hash(rx, y, rz, g.seed + 811));
                if (i == 0)
                {
                    if (w.In(rx, y, rz)) { w.Set(rx, y - 1, rz, B.Cobble); w.Set(rx, y, rz, B.Spawner, 2); }
                    w.Chest(rx + 2, y, rz + 2, rng.Int(4), "mineshaft", rng);
                    w.Chest(rx - 2, y, rz - 2, rng.Int(4), "mineshaft", rng);
                    w.IfAir(rx - 2, y, rz + 2, B.Torch, 0); w.IfAir(rx + 2, y, rz - 2, B.Torch, 0);
                }
                else
                {
                    if (rng.Chance(0.6f)) w.Chest(rx + rng.Range(-1, 2), y, rz + rng.Range(-1, 2), rng.Int(4), "mineshaft", rng);
                    if (rng.Chance(0.3f)) w.IfAir(rx + 1, y, rz + 1, B.Torch, 0);
                }
            }
        }

        // ====================================================================
        // NAUFRAGIOS
        // ====================================================================
        internal static bool ShipPos(OverworldGen g, int sx, int sz, out int x, out int z, out int dir)
        {
            uint h = MathX.Hash(sx, 821, sz, g.seed);
            x = z = 0; dir = (int)((h >> 28) & 1);
            if (h % 100 >= 55) return false;
            x = (sx * SReg + 1 + (int)((h >> 8) % (uint)(SReg - 2))) * 16 + 8;
            z = (sz * SReg + 1 + (int)((h >> 16) % (uint)(SReg - 2))) * 16 + 8;
            var col = g.Column(x, z);
            bool ocean = Biomes.IsOcean(col.biome) && col.HasWater && col.water - col.h >= 4;
            bool beach = col.biome == BiomeId.Beach && !col.HasWater;
            return (ocean || beach) && col.skyTop < 0;
        }

        static void BuildShip(Writer w, OverworldGen g, int px, int pz, int dir)
        {
            var rng = new Rng(MathX.Hash(px, 822, pz, g.seed));
            // altura del fondo: el punto mas bajo bajo el casco
            int baseH = int.MaxValue;
            for (int l = 0; l <= 16; l += 4)
                for (int s = -3; s <= 3; s += 3)
                {
                    int x, z; ShipXZ(px, pz, dir, l, s, out x, out z);
                    baseH = Math.Min(baseH, g.Column(x, z).h);
                }
            int by = baseH + 1;
            var hull = B.Planks[2]; var rail = B.Log[2]; var deck = B.Planks[0];
            for (int l = 0; l <= 16; l++)
            {
                int half = l <= 12 ? 3 : Math.Max(0, 3 - (l - 12));
                for (int s = -half; s <= half; s++)
                {
                    int x, z; ShipXZ(px, pz, dir, l, s, out x, out z);
                    if (!w.In(x, by, z)) continue;
                    var cc = g.Column(x, z);
                    bool wetCol = cc.water > cc.h;
                    // fondo (con algun hueco)
                    if (!rng.Chance(0.1f) || l == 8) w.Set(x, by, z, hull);
                    bool wall = Math.Abs(s) == half || l == 0;
                    for (int y = 1; y <= 6; y++)
                    {
                        int ay = by + y;
                        Block fill = wetCol && ay <= OverworldGen.Sea ? B.Water : B.Air;
                        if (wall && y <= 3)
                        {
                            if (rng.Chance(0.15f)) w.Set(x, ay, z, fill);
                            else w.Set(x, ay, z, y == 3 ? rail : hull);
                        }
                        else if (l <= 4 && y == 4 && Math.Abs(s) <= half) w.Set(x, ay, z, rng.Chance(0.22f) ? fill : deck);
                        else if (l == 4 && y <= 3 && Math.Abs(s) < half) w.Set(x, ay, z, Math.Abs(s) >= 1 ? hull : fill);
                        else w.Set(x, ay, z, fill);
                    }
                }
            }
            // mastil roto
            int mh = rng.Range(5, 9);
            for (int y = 1; y <= mh; y++) { int x, z; ShipXZ(px, pz, dir, 8, 0, out x, out z); w.Set(x, by + y, z, B.Log[0]); }
            if (mh >= 6) for (int s = -2; s <= 2; s++) { int x, z; ShipXZ(px, pz, dir, 8, s, out x, out z); if (s != 0 && !rng.Chance(0.3f)) w.Set(x, by + 5, z, B.Planks[0]); }
            // cofres
            int cx1, cz1; ShipXZ(px, pz, dir, 2, 0, out cx1, out cz1);
            w.Chest(cx1, by + 1, cz1, dir == 0 ? 1 : 0, "shipwreck", rng);
            int cx2, cz2; ShipXZ(px, pz, dir, 10, 1, out cx2, out cz2);
            w.Chest(cx2, by + 1, cz2, rng.Int(4), "shipwreck_supply", rng);
            if (rng.Chance(0.5f)) { int cx3, cz3; ShipXZ(px, pz, dir, 6, -1, out cx3, out cz3); w.Chest(cx3, by + 1, cz3, rng.Int(4), "shipwreck_supply", rng); }
            // barril de provisiones y pistas en la cubierta
            int bx, bz; ShipXZ(px, pz, dir, 5, 2, out bx, out bz);
            if (w.Get(bx, by + 1, bz).fluid || w.Get(bx, by + 1, bz).id == 0) w.Set(bx, by + 1, bz, B.Hay);
        }

        static void ShipXZ(int px, int pz, int dir, int l, int s, out int x, out int z)
        {
            if (dir == 0) { x = px - 8 + l; z = pz + s; }
            else { x = px + s; z = pz - 8 + l; }
        }

        // ====================================================================
        // PORTALES EN RUINAS
        // ====================================================================
        internal static bool RuinPos(OverworldGen g, int rx, int rz, out int x, out int z)
        {
            uint h = MathX.Hash(rx, 831, rz, g.seed);
            x = z = 0;
            if (h % 100 >= 42) return false;
            x = (rx * RReg + 1 + (int)((h >> 8) % (uint)(RReg - 2))) * 16 + 8;
            z = (rz * RReg + 1 + (int)((h >> 16) % (uint)(RReg - 2))) * 16 + 8;
            var col = g.Column(x, z);
            if (col.HasWater || col.skyTop >= 0 || col.h < OverworldGen.Sea + 2) return false;
            switch (col.biome)
            {
                case BiomeId.Beach: case BiomeId.River: case BiomeId.Mushroom: case BiomeId.SnowyPeaks: case BiomeId.Mountains: case BiomeId.Island: return false;
            }
            return !Biomes.IsOcean(col.biome);
        }

        static void BuildRuinedPortal(Writer w, OverworldGen g, int px, int pz)
        {
            var rng = new Rng(MathX.Hash(px, 832, pz, g.seed));
            int by = g.Column(px, pz).h;
            // plataforma de ladrillos del Abismo mezclada con roca y magma
            for (int dz = -4; dz <= 4; dz++)
                for (int dx = -4; dx <= 4; dx++)
                {
                    if (dx * dx + dz * dz > 17) continue;
                    int x = px + dx, z = pz + dz;
                    int gh = g.Column(x, z).h;
                    for (int y = gh + 1; y <= by; y++) w.Set(x, y, z, B.AbyssRock);
                    float r = rng.Float();
                    w.Set(x, by, z, r < 0.12f ? B.Magma : (r < 0.55f ? B.AbyssBricks : B.AbyssRock));
                    for (int y = 1; y <= 6; y++) { var cur = w.Get(x, by + y, z); if (cur.id != 0 && !cur.fluid) w.Set(x, by + y, z, B.Air); }
                }
            // marco 4x5 (eje X o Z) con piezas que faltan
            bool alongX = rng.Chance(0.5f);
            for (int u = 0; u < 4; u++)
                for (int v = 0; v < 5; v++)
                {
                    bool frame = u == 0 || u == 3 || v == 0 || v == 4;
                    if (!frame) continue;
                    if ((u == 0 || u == 3) && (v == 0 || v == 4)) { if (rng.Chance(0.5f)) continue; }
                    if (rng.Chance(0.28f)) continue;
                    int x = alongX ? px - 1 + u : px, z = alongX ? pz : pz - 1 + u;
                    w.Set(x, by + 1 + v, z, B.Obsidian);
                }
            // escombros y cofre
            for (int k = 0; k < 4; k++) w.IfAir(px + rng.Range(-3, 4), by + 1, pz + rng.Range(-3, 4), B.AbyssBricks);
            w.Chest(px + (alongX ? 0 : 3), by + 1, pz + (alongX ? 3 : 0), alongX ? 2 : 3, "ruined_portal", rng);
            w.Set(px + (alongX ? 3 : 0), by + 1, pz + (alongX ? 0 : 3), B.Torch, 0);
        }
    }
}
