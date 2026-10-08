using System.Collections.Generic;

namespace MundoBloques
{
    /// <summary>Portales del Abismo (marco de obsidiana) y del Final (marcos con ojos).</summary>
    public static class Portals
    {
        static bool Free(World w, int x, int y, int z)
        {
            var b = w.GetBlock(x, y, z);
            return b.id == 0 || b == B.Portal;
        }

        /// <summary>Intenta encender un portal del Abismo en la celda libre (x,y,z).</summary>
        public static bool TryLight(World w, int x, int y, int z)
        {
            if (!Free(w, x, y, z)) return false;
            for (int axis = 0; axis < 2; axis++)
            {
                int dx = axis == 0 ? 1 : 0, dz = axis == 0 ? 0 : 1;
                int by = y, guard = 0;
                while (Free(w, x, by - 1, z) && guard++ < 22) by--;
                if (w.GetBlock(x, by - 1, z) != B.Obsidian) continue;
                int l = 0; while (l < 22 && Free(w, x - (l + 1) * dx, by, z - (l + 1) * dz)) l++;
                int r = 0; while (r < 22 && Free(w, x + (r + 1) * dx, by, z + (r + 1) * dz)) r++;
                int width = l + r + 1;
                if (width < 2 || width > 21) continue;
                int sx = x - l * dx, sz = z - l * dz;
                if (w.GetBlock(sx - dx, by, sz - dz) != B.Obsidian || w.GetBlock(sx + width * dx, by, sz + width * dz) != B.Obsidian) continue;
                int height = 0;
                while (height < 22)
                {
                    bool all = true;
                    for (int i = 0; i < width && all; i++) if (!Free(w, sx + i * dx, by + height, sz + i * dz)) all = false;
                    if (!all) break;
                    height++;
                }
                if (height < 3 || height > 21) continue;
                bool ok = true;
                for (int i = 0; i < width && ok; i++)
                    if (w.GetBlock(sx + i * dx, by - 1, sz + i * dz) != B.Obsidian || w.GetBlock(sx + i * dx, by + height, sz + i * dz) != B.Obsidian) ok = false;
                for (int j = 0; j < height && ok; j++)
                    if (w.GetBlock(sx - dx, by + j, sz - dz) != B.Obsidian || w.GetBlock(sx + width * dx, by + j, sz + width * dz) != B.Obsidian) ok = false;
                if (!ok) continue;
                for (int j = 0; j < height; j++)
                    for (int i = 0; i < width; i++)
                        w.SetBlock(sx + i * dx, by + j, sz + i * dz, B.Portal, axis, false);
                return true;
            }
            return false;
        }

        public static void Validate(World w, int x, int y, int z, int meta)
        {
            int axis = meta & 1;
            int dx = axis == 0 ? 1 : 0, dz = axis == 0 ? 0 : 1;
            bool ok = true;
            var n = new[] { w.GetBlock(x + dx, y, z + dz), w.GetBlock(x - dx, y, z - dz), w.GetBlock(x, y + 1, z), w.GetBlock(x, y - 1, z) };
            for (int i = 0; i < 4; i++) if (n[i] != B.Portal && n[i] != B.Obsidian) ok = false;
            if (ok) return;
            // eliminar todo el portal conectado
            var q = new Queue<int[]>();
            q.Enqueue(new[] { x, y, z });
            int guard = 0;
            while (q.Count > 0 && guard++ < 600)
            {
                var p = q.Dequeue();
                if (w.GetBlock(p[0], p[1], p[2]) != B.Portal) continue;
                w.SetBlock(p[0], p[1], p[2], B.Air, 0, false);
                q.Enqueue(new[] { p[0] + dx, p[1], p[2] + dz }); q.Enqueue(new[] { p[0] - dx, p[1], p[2] - dz });
                q.Enqueue(new[] { p[0], p[1] + 1, p[2] }); q.Enqueue(new[] { p[0], p[1] - 1, p[2] });
            }
        }

        /// <summary>Busca un bloque de portal cerca de (x,z) en el mundo dado.</summary>
        public static bool Find(World w, int x, int y0, int y1, int z, int radius, out int fx, out int fy, out int fz)
        {
            fx = fy = fz = 0;
            int best = int.MaxValue;
            for (int dz = -radius; dz <= radius; dz++)
                for (int dx = -radius; dx <= radius; dx++)
                {
                    if (!w.IsLoaded(x + dx, z + dz)) continue;
                    for (int yy = y0; yy <= y1; yy++)
                        if (w.GetBlock(x + dx, yy, z + dz) == B.Portal && w.GetBlock(x + dx, yy - 1, z + dz) != B.Portal)
                        {
                            int d = dx * dx + dz * dz + (yy - y0) * (yy - y0) / 4;
                            if (d < best) { best = d; fx = x + dx; fy = yy; fz = z + dz; }
                        }
                }
            return best != int.MaxValue;
        }

        /// <summary>Construye un portal 4x5 con la base en y, centrado en (x,z). Devuelve la celda interior de aparicion.</summary>
        public static void Build(World w, int x, int y, int z)
        {
            for (int j = -1; j <= 4; j++)
                for (int i = -2; i <= 3; i++)
                    for (int k = -1; k <= 1; k++)
                    {
                        bool frame = (j == -1 || j == 3) || (i == -1 || i == 2);
                        if (i < -1 || i > 2 || j > 3) { if (j >= 0) w.SetBlock(x + i, y + j, z + k, B.Air, 0, false); continue; }
                        if (k != 0) { if (j >= 0) w.SetBlock(x + i, y + j, z + k, B.Air, 0, false); else w.SetBlock(x + i, y + j, z + k, B.AbyssRock, 0, false); continue; }
                        w.SetBlock(x + i, y + j, z + k, frame ? B.Obsidian : B.Portal, 0, false);
                    }
        }

        // ---------------- Portal del Final ----------------
        /// <summary>Se llama tras poner un ojo: si los 12 marcos estan completos abre el portal.</summary>
        public static bool TryOpenEnd(World w, int x, int y, int z)
        {
            // buscar el centro del anillo: celdas con 3x3 de interior rodeado por 12 marcos
            for (int cx = x - 4; cx <= x + 4; cx++)
                for (int cz = z - 4; cz <= z + 4; cz++)
                {
                    bool ok = true;
                    for (int i = -1; i <= 1 && ok; i++)
                    {
                        foreach (var p in new[] { new[] { cx + i, cz - 2 }, new[] { cx + i, cz + 2 }, new[] { cx - 2, cz + i }, new[] { cx + 2, cz + i } })
                        {
                            if (w.GetBlock(p[0], y, p[1]) != B.EndFrame || (w.GetMeta(p[0], y, p[1]) & 1) == 0) { ok = false; break; }
                        }
                    }
                    if (!ok) continue;
                    for (int i = -1; i <= 1; i++)
                        for (int k = -1; k <= 1; k++) w.SetBlock(cx + i, y, cz + k, B.EndPortal, 0, false);
                    return true;
                }
            return false;
        }
    }
}
