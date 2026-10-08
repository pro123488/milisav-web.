using System;

namespace MundoBloques
{
    public enum TreeType { Oak, Birch, Spruce, Jungle, Acacia, Palm, Spirit, Mushroom }

    /// <summary>Generacion de arboles y plantas grandes (se recorta al chunk actual).</summary>
    public static class Trees
    {
        static void Blob(Writer w, int cx, int cy, int cz, float rx, float ry, float rz, Block leaves, Rng r, float hole = 0.08f)
        {
            int ix = (int)Math.Ceiling(rx), iy = (int)Math.Ceiling(ry), iz = (int)Math.Ceiling(rz);
            for (int dy = -iy; dy <= iy; dy++)
                for (int dz = -iz; dz <= iz; dz++)
                    for (int dx = -ix; dx <= ix; dx++)
                    {
                        float d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
                        if (d > 1f) continue;
                        if (d > 0.72f && hole > 0 && r.Chance(hole)) continue;
                        w.Soft(cx + dx, cy + dy, cz + dz, leaves);
                    }
        }

        static void Trunk(Writer w, Block log, int x, int y0, int z, int h)
        {
            for (int i = 1; i <= h; i++) w.Set(x, y0 + i, z, log);
        }

        public static void Grow(Writer w, Rng r, TreeType t, int x, int gy, int z)
        {
            switch (t)
            {
                case TreeType.Oak:
                    {
                        int h = r.Range(4, 7);
                        Trunk(w, B.Log[Woods.Oak], x, gy, z, h);
                        Blob(w, x, gy + h, z, 2.7f, 2.3f, 2.7f, B.Leaves[Woods.Oak], r);
                        break;
                    }
                case TreeType.Birch:
                    {
                        int h = r.Range(5, 8);
                        Trunk(w, B.Log[Woods.Birch], x, gy, z, h);
                        Blob(w, x, gy + h - 1, z, 2.2f, 2.6f, 2.2f, B.Leaves[Woods.Birch], r);
                        break;
                    }
                case TreeType.Spruce:
                    {
                        int h = r.Range(6, 11);
                        Trunk(w, B.Log[Woods.Spruce], x, gy, z, h);
                        int top = gy + h + 1;
                        for (int yy = top; yy >= gy + 2; yy--)
                        {
                            int layer = top - yy;
                            int rad = layer == 0 ? 0 : Math.Min(3, (layer + 1) / 2);
                            if (layer % 4 == 3) rad = Math.Max(1, rad - 1);
                            for (int dz = -rad; dz <= rad; dz++)
                                for (int dx = -rad; dx <= rad; dx++)
                                    if (dx * dx + dz * dz <= rad * rad + rad / 2 + 0.3f) w.Soft(x + dx, yy, z + dz, B.Leaves[Woods.Spruce]);
                        }
                        break;
                    }
                case TreeType.Jungle:
                    {
                        int h = r.Range(9, 16);
                        Trunk(w, B.Log[Woods.Jungle], x, gy, z, h);
                        Blob(w, x, gy + h, z, 3.8f, 2.6f, 3.8f, B.Leaves[Woods.Jungle], r);
                        for (int k = 0; k < 2; k++)
                        {
                            int ox = r.Range(-3, 4), oz = r.Range(-3, 4), oy = h - r.Range(3, 6);
                            Blob(w, x + ox, gy + oy, z + oz, 2.4f, 1.8f, 2.4f, B.Leaves[Woods.Jungle], r);
                            for (int yy = oy; yy < h; yy++) { }
                        }
                        break;
                    }
                case TreeType.Acacia:
                    {
                        int h = r.Range(4, 7);
                        Trunk(w, B.Log[Woods.Acacia], x, gy, z, h);
                        int dx = r.Chance(0.5f) ? 1 : -1, dz = r.Chance(0.5f) ? 1 : -1;
                        if (r.Chance(0.5f)) dz = 0; else dx = 0;
                        int px = x, pz = z, py = gy + h;
                        for (int i = 0; i < 2; i++) { px += dx; pz += dz; py++; w.Set(px, py, pz, B.Log[Woods.Acacia]); }
                        Blob(w, px, py, pz, 3.6f, 1.3f, 3.6f, B.Leaves[Woods.Acacia], r, 0.15f);
                        break;
                    }
                case TreeType.Palm:
                    {
                        int h = r.Range(6, 10);
                        int dx = r.Range(-1, 2), dz = r.Range(-1, 2);
                        if (dx == 0 && dz == 0) dx = 1;
                        int px = x, pz = z, py = gy;
                        for (int i = 1; i <= h; i++)
                        {
                            py = gy + i;
                            px = x + (int)Math.Round(dx * i * 0.22f); pz = z + (int)Math.Round(dz * i * 0.22f);
                            w.Set(px, py, pz, B.Log[Woods.Palm]);
                        }
                        var lf = B.Leaves[Woods.Palm];
                        w.Soft(px, py + 1, pz, lf);
                        for (int dxx = -1; dxx <= 1; dxx++)
                            for (int dzz = -1; dzz <= 1; dzz++)
                            {
                                if (dxx == 0 && dzz == 0) continue;
                                for (int k = 1; k <= 4; k++) w.Soft(px + dxx * k, py + (k >= 3 ? 0 : 1) - (k >= 4 ? 1 : 0), pz + dzz * k, lf);
                            }
                        break;
                    }
                case TreeType.Spirit:
                    {
                        int h = r.Range(7, 12);
                        Trunk(w, B.Log[Woods.Spirit], x, gy, z, h);
                        Blob(w, x, gy + h, z, 3.4f, 3.0f, 3.4f, B.Leaves[Woods.Spirit], r, 0.05f);
                        for (int k = 0; k < 5; k++)
                            w.Set(x + r.Range(-2, 3), gy + h - 1 - r.Range(0, 2), z + r.Range(-2, 3), B.SkyCrystal);
                        break;
                    }
                case TreeType.Mushroom:
                    {
                        int h = r.Range(4, 8);
                        for (int i = 1; i <= h; i++) w.Set(x, gy + i, z, B.MushroomStem);
                        var cap = r.Chance(0.5f) ? B.RedMushroomBlock : B.BrownMushroomBlock;
                        int cy = gy + h;
                        for (int dy = -1; dy <= 3; dy++)
                            for (int dz = -4; dz <= 4; dz++)
                                for (int dx = -4; dx <= 4; dx++)
                                {
                                    float d = (dx * dx + dz * dz) / 16f + (dy * dy) / 5.5f;
                                    if (d > 1f || d < 0.35f && dy < 2) continue;
                                    if (dy < 0 && dx * dx + dz * dz < 6) continue;
                                    w.Soft(x + dx, cy + dy, z + dz, cap);
                                }
                        break;
                    }
            }
        }

        public static void Cactus(Writer w, Rng r, int x, int gy, int z)
        {
            int h = r.Range(1, 4);
            for (int i = 1; i <= h; i++) w.Set(x, gy + i, z, B.Cactus);
        }
    }
}
