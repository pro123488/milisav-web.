using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Genera las texturas de 16x16 de cada bloque por codigo (sin archivos de imagen).</summary>
    public static class TexGen
    {
        static int SeedOf(string name)
        {
            unchecked { int h = 17; for (int i = 0; i < name.Length; i++) h = h * 31 + name[i]; return h; }
        }

        public static Color32[] Paint(string name)
        {
            var p = new Px(SeedOf(name));
            try { Dispatch(name, p); }
            catch (Exception e) { Debug.LogWarning("Textura '" + name + "': " + e.Message); p.Fill(Col.Hex(0xFF00FF)); }
            return p.d;
        }

        // ---------- helpers ----------
        static void Cells(Px p, uint hex, int n, float amp, int salt = 5)
        {
            // pseudo-voronoi: cada celda con un brillo propio y bordes oscuros
            var b = Col.Hex(hex);
            int[] sx = new int[n], sy = new int[n]; float[] br = new float[n];
            for (int i = 0; i < n; i++)
            {
                sx[i] = (int)(p.R(i, 1, salt) * 16); sy[i] = (int)(p.R(i, 2, salt) * 16);
                br[i] = 1f + (p.R(i, 3, salt) - 0.5f) * 2f * amp;
            }
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    int best = 0, second = 0; float bd = 1e9f, sd = 1e9f;
                    for (int i = 0; i < n; i++)
                    {
                        for (int ox = -16; ox <= 16; ox += 16)
                            for (int oy = -16; oy <= 16; oy += 16)
                            {
                                float dx = x - (sx[i] + ox), dy = y - (sy[i] + oy);
                                float dd = dx * dx + dy * dy;
                                if (dd < bd) { sd = bd; second = best; bd = dd; best = i; }
                                else if (dd < sd && i != best) { sd = dd; second = i; }
                            }
                    }
                    float f = br[best] * (1f + (p.R(x, y, salt + 9) - 0.5f) * 0.08f);
                    if (Math.Sqrt(sd) - Math.Sqrt(bd) < 1.1f) f *= 0.78f;
                    p.Set(x, y, Col.Mul(b, f));
                }
        }

        static void BricksPattern(Px p, uint brick, uint mortar, int bw = 8, int bh = 4, float amp = 0.07f)
        {
            var bc = Col.Hex(brick); var mc = Col.Hex(mortar);
            for (int y = 0; y < 16; y++)
            {
                int row = y / bh;
                int off = (row % 2) * (bw / 2);
                for (int x = 0; x < 16; x++)
                {
                    bool mortarRow = (y % bh) == bh - 1;
                    bool mortarCol = ((x + off) % bw) == bw - 1;
                    if (mortarRow || mortarCol) p.Set(x, y, Col.Mul(mc, 1f + (p.R(x, y, 3) - 0.5f) * 0.1f));
                    else
                    {
                        int cellId = row * 7 + (x + off) / bw;
                        float cb = 1f + (MathX.Hash01(cellId, row, 77, p.seed) - 0.5f) * 0.18f;
                        p.Set(x, y, Col.Mul(bc, cb * (1f + (p.R(x, y, 4) - 0.5f) * 2f * amp)));
                    }
                }
            }
        }

        static void Ore(Px p, bool deep, uint main, uint hi)
        {
            if (deep) { p.Noise(0x484850, 0.05f, 1); p.Speckle(0.1f, 0.85f, 2); }
            else { p.Noise(0x7D7D7D, 0.06f, 1); p.Speckle(0.08f, 0.85f, 2); p.Speckle(0.05f, 1.12f, 3); }
            var c = Col.Hex(main); var h = Col.Hex(hi);
            int blobs = 6;
            for (int i = 0; i < blobs; i++)
            {
                int bx = 1 + (int)(p.R(i, 0, 11) * 12), by = 1 + (int)(p.R(i, 1, 11) * 12);
                int w = 2 + (int)(p.R(i, 2, 11) * 2), hh = 2 + (int)(p.R(i, 3, 11) * 2);
                for (int yy = 0; yy < hh; yy++)
                    for (int xx = 0; xx < w; xx++)
                    {
                        if ((xx == 0 && yy == 0 && w > 2) || (xx == w - 1 && yy == hh - 1 && hh > 2)) continue;
                        p.Set(bx + xx, by + yy, (xx + yy) % 2 == 0 ? c : Col.Mul(c, 0.82f));
                    }
                p.Set(bx, by, h);
            }
        }

        static void MetalBlock(Px p, uint hex)
        {
            var b = Col.Hex(hex);
            p.Noise(hex, 0.03f, 1);
            for (int i = 0; i < 16; i++)
            {
                p.Set(i, 0, Col.Mul(b, 1.18f)); p.Set(0, i, Col.Mul(b, 1.18f));
                p.Set(i, 15, Col.Mul(b, 0.78f)); p.Set(15, i, Col.Mul(b, 0.78f));
            }
            for (int i = 3; i < 13; i++) { p.Set(i, 16 - i - 1 + 0, Col.Mul(b, 1.22f)); }
            p.Rect(2, 2, 13, 13, Col.Mul(b, 0.95f)); p.Rect(3, 3, 12, 12, Col.Mul(b, 1.0f));
            p.Speckle(0.1f, 1.1f, 6);
        }

        static void Planks(Px p, uint hex)
        {
            var b = Col.Hex(hex);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    float f = 1f + (p.R(x, y, 1) - 0.5f) * 0.1f;
                    if (y % 4 == 3) f *= 0.72f;
                    // grano
                    if (p.R(x / 3, y, 6) < 0.15f) f *= 0.93f;
                    // juntas verticales alternadas
                    int row = y / 4;
                    int jx = (row % 2 == 0) ? 5 : 12;
                    if (x == jx && y % 4 != 3) f *= 0.8f;
                    p.Set(x, y, Col.Mul(b, f));
                }
        }

        static void LogSide(Px p, uint hex)
        {
            var b = Col.Hex(hex);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    float col = 0.82f + p.R(x, 0, 2) * 0.36f;
                    float f = col * (1f + (p.R(x, y, 3) - 0.5f) * 0.12f);
                    if (p.R(x, y / 2, 4) < 0.1f) f *= 0.8f;
                    p.Set(x, y, Col.Mul(b, f));
                }
        }

        static void LogTop(Px p, uint bark, uint ring)
        {
            var bc = Col.Hex(bark); var rc = Col.Hex(ring);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    int ax = Math.Abs(2 * x - 15), ay = Math.Abs(2 * y - 15);
                    int m = Math.Max(ax, ay);
                    Color32 c;
                    if (m >= 13) c = Col.Mul(bc, 0.95f + p.R(x, y, 1) * 0.1f);
                    else
                    {
                        int r = m / 3;
                        c = (r % 2 == 0) ? Col.Mul(rc, 1.0f + (p.R(x, y, 2) - 0.5f) * 0.1f) : Col.Mul(rc, 0.84f);
                    }
                    p.Set(x, y, c);
                }
        }

        static void Leaves(Px p, uint hex, bool glow)
        {
            var b = Col.Hex(hex);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    float r = p.R(x, y, 1);
                    float f = 0.75f + r * 0.4f;
                    if (p.R(x / 2, y / 2, 2) < 0.18f) f *= 0.8f;
                    var c = Col.Mul(b, f);
                    if (r < 0.15f) c.a = 0;
                    p.Set(x, y, c);
                }
            if (glow) p.SpeckleColor(0.07f, Col.Hex(0xFFFFFF), 8);
        }

        static void Sapling(Px p, uint leafHex)
        {
            var stem = Col.Hex(0x6B5330);
            p.VLine(7, 9, 15, stem); p.VLine(8, 10, 15, Col.Mul(stem, 0.8f));
            var lc = Col.Hex(leafHex);
            p.Disc(8, 5.5f, 4.2f, Col.Mul(lc, 0.9f));
            p.Disc(7, 4.5f, 2.4f, Col.Mul(lc, 1.15f));
            for (int i = 0; i < 12; i++) { int x = (int)(p.R(i, 0, 3) * 16), y = (int)(p.R(i, 1, 3) * 11); if (p.Get(x, y).a > 0 && ((x + y) % 3 == 0)) p.Set(x, y, Col.Mul(lc, 0.7f)); }
        }

        static void Door(Px p, uint hex, bool top)
        {
            Planks(p, hex);
            var dark = Col.Mul(Col.Hex(hex), 0.6f);
            p.Border(dark);
            p.Rect(3, top ? 3 : 1, 12, top ? 7 : 6, Col.Mul(Col.Hex(hex), 0.78f));
            if (top) p.Rect(3, 3, 12, 8, top ? Col.WithAlpha(Col.Hex(0xBFD8E8), 255) : dark);
            p.Set(12, top ? 14 : 3, Col.Hex(0xCFCFCF)); p.Set(12, top ? 15 : 4, Col.Hex(0x9A9A9A));
        }

        static void Glass(Px p, uint tint, int alpha, bool frame)
        {
            var c = Col.Hex(tint, (byte)alpha);
            for (int i = 0; i < p.d.Length; i++) p.d[i] = frame ? Col.Clear : c;
            if (frame) { var f = Col.Hex(0xDDEEFF); p.Border(f); }
            else { p.Border(Col.Hex(tint, (byte)Math.Min(255, alpha + 60))); }
            p.Set(2, 2, Col.Hex(0xFFFFFF, 255)); p.Set(3, 3, Col.Hex(0xFFFFFF, 255)); p.Set(2, 3, Col.Hex(0xFFFFFF, 200));
            p.Set(12, 11, Col.Hex(0xFFFFFF, 230)); p.Set(11, 12, Col.Hex(0xFFFFFF, 230));
            if (!frame) { p.Set(2, 2, Col.Hex(0xFFFFFF, (byte)Math.Min(255, alpha + 80))); p.Set(3, 3, Col.Hex(0xFFFFFF, (byte)Math.Min(255, alpha + 80))); }
        }

        static void Sidefringe(Px p, uint dirt, uint topHex, bool tall)
        {
            p.Noise(dirt, 0.12f, 1);
            p.Speckle(0.1f, 0.8f, 2);
            var t = Col.Hex(topHex);
            for (int x = 0; x < 16; x++)
            {
                int depth = 2 + (int)(p.R(x, 0, 9) * (tall ? 3.5f : 2.5f));
                for (int y = 0; y < depth; y++) p.Set(x, y, Col.Mul(t, 1f + (p.R(x, y, 4) - 0.5f) * 0.18f));
            }
        }

        static void Wool(Px p, uint hex)
        {
            var b = Col.Hex(hex);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                {
                    float f = 1f + (p.R(x, y, 1) - 0.5f) * 0.10f;
                    if (((x + y) & 1) == 0) f *= 1.03f; else f *= 0.97f;
                    if (y % 4 == 3) f *= 0.96f;
                    p.Set(x, y, Col.Mul(b, f));
                }
        }

        static uint DyeHex(string key)
        {
            for (int i = 0; i < Dyes.Keys.Length; i++) if (Dyes.Keys[i] == key) return Dyes.Colors[i];
            return 0xFF00FF;
        }

        static WoodDef WoodOf(string key)
        {
            for (int i = 0; i < Woods.All.Length; i++) if (Woods.All[i].key == key) return Woods.All[i];
            return Woods.All[0];
        }

        static void Stem(Px p, int x, int y0, int y1, Color32 c)
        {
            p.VLine(x, y0, y1, c);
        }

        static void Flower(Px p, uint petal, uint center, int radius = 2, int cy = 5)
        {
            var stem = Col.Hex(0x3E8A2A);
            p.VLine(7, cy + 2, 15, stem); p.VLine(8, cy + 4, 15, Col.Mul(stem, 0.8f));
            p.Set(6, 11, stem); p.Set(5, 10, stem); p.Set(9, 12, stem); p.Set(10, 11, stem);
            p.Disc(7.5f, cy, radius + 0.6f, Col.Hex(petal));
            p.Disc(7.5f, cy, 1.1f, Col.Hex(center));
            p.Outline(Col.WithAlpha(Col.Mul(Col.Hex(petal), 0.55f), 255));
            // el contorno no debe cubrir el tallo
        }

        static void Crop(Px p, string crop, int stage)
        {
            var green = Col.Hex(0x4C9A2A); var dg = Col.Hex(0x347A1C);
            uint pr; // color del producto
            switch (crop)
            {
                case "wheat": pr = 0xD9B84A; break;
                case "carrot": pr = 0xE8782A; break;
                case "potato": pr = 0xC9A45A; break;
                case "beetroot": pr = 0x9A1E3A; break;
                case "tomato": pr = 0xD02A22; break;
                case "pumpkin": pr = 0xE08A1A; break;
                default: pr = 0x6FBF3A; break; // melon
            }
            int h = new[] { 4, 7, 11, 14 }[stage];
            if (crop == "wheat")
            {
                for (int x = 1; x < 16; x += 3)
                {
                    int hh = h - (x % 2);
                    var c = stage == 3 ? Col.Hex(pr) : (stage == 2 ? Col.Hex(0x8FB03A) : green);
                    p.VLine(x, 16 - hh, 15, Col.Mul(c, 0.9f + p.R(x, 0, 2) * 0.2f));
                    p.VLine(x + 1, 16 - hh + 1, 15, Col.Mul(c, 0.8f));
                    if (stage == 3) { p.Set(x, 16 - hh - 1, Col.Hex(0xB89A30)); p.Set(x + 1, 16 - hh, Col.Hex(0xB89A30)); }
                }
            }
            else if (crop == "pumpkin" || crop == "melon")
            {
                int rad = new[] { 1, 2, 3, 4 }[stage];
                p.VLine(8, 16 - 3 - stage * 2, 15, green);
                for (int i = 0; i < 3 + stage * 2; i++) { p.Set(8 + (i % 2 == 0 ? 1 : -1) * (i / 2 + 1), 15 - i, dg); }
                if (stage >= 2) p.Disc(8, 12.5f, rad + 0.4f, Col.Hex(pr));
                if (stage == 3) { p.Disc(8, 12.5f, 1.2f, Col.Mul(Col.Hex(pr), 1.15f)); }
            }
            else
            {
                // hojas: manojos de tallos
                for (int x = 2; x < 16; x += 4)
                {
                    int hh = h - (x % 3);
                    p.VLine(x, 16 - hh, 15, green);
                    p.Set(x - 1, 16 - hh + 1, dg); p.Set(x + 1, 16 - hh + 2, dg);
                    if (stage == 3)
                    {
                        if (crop == "carrot") { p.VLine(x, 14, 15, Col.Hex(pr)); p.Set(x + 1, 14, Col.Hex(pr)); }
                        else if (crop == "potato") { p.Disc(x + 0.5f, 14.5f, 1.4f, Col.Hex(pr)); }
                        else if (crop == "beetroot") { p.Disc(x + 0.5f, 14.5f, 1.5f, Col.Hex(pr)); p.Set(x, 13, green); }
                        else if (crop == "tomato") { p.Disc(x + 0.5f, 12.5f, 1.6f, Col.Hex(pr)); p.Set(x, 11, dg); p.Set(x + 1, 11, dg); }
                    }
                    else if (stage == 2 && crop == "tomato") p.Disc(x + 0.5f, 12.5f, 1.1f, Col.Hex(0xB8C84A));
                }
            }
        }

        static void Crack(Px p, int stage)
        {
            var dk = Col.Hex(0x101010, 220);
            int n = (stage + 1);
            for (int i = 0; i < n; i++)
            {
                int x = 2 + (int)(p.R(i, 0, 40) * 12), y = 2 + (int)(p.R(i, 1, 40) * 12);
                int dx = p.R(i, 2, 40) < 0.5f ? 1 : -1, dy = p.R(i, 3, 40) < 0.5f ? 1 : -1;
                int len = 3 + stage / 2;
                for (int k = 0; k < len; k++)
                {
                    p.Set(x, y, dk);
                    if (p.R(i, k, 41) < 0.5f) x += dx; else y += dy;
                    if (p.R(i, k, 42) < 0.3f) { p.Set(x + dy, y, dk); }
                }
            }
        }

        // ---------- despachador principal ----------
        static void Dispatch(string n, Px p)
        {
            // ---- familias por prefijo ----
            if (n.StartsWith("deep_ore_")) { OreByName(p, n.Substring(9), true); return; }
            if (n.StartsWith("ore_")) { OreByName(p, n.Substring(4), false); return; }
            if (n.StartsWith("block_")) { MetalByName(p, n.Substring(6)); return; }
            if (n.StartsWith("lamp_")) { GemLamp(p, n.Substring(5)); return; }
            if (n.StartsWith("crack_")) { Crack(p, n[6] - '0'); return; }
            if (n.StartsWith("wool_")) { Wool(p, DyeHex(n.Substring(5))); return; }
            if (n.StartsWith("concrete_")) { p.Noise(DyeHex(n.Substring(9)), 0.025f, 1); return; }
            if (n.StartsWith("terracotta_")) { p.Noise(Mix(DyeHex(n.Substring(11)), 0x8A5A44, 0.55f), 0.05f, 1); p.Speckle(0.1f, 0.94f, 3); return; }
            if (n.StartsWith("glass_")) { Glass(p, DyeHex(n.Substring(6)), 150, false); return; }
            if (n.StartsWith("planks_")) { Planks(p, WoodOf(n.Substring(7)).planks); return; }
            if (n.StartsWith("leaves_")) { var w = WoodOf(n.Substring(7)); Leaves(p, w.leaf, !w.leafTinted); return; }
            if (n.StartsWith("sapling_")) { var w = WoodOf(n.Substring(8)); Sapling(p, w.leafTinted ? 0x4C9A2A : w.leaf); return; }
            if (n.StartsWith("log_"))
            {
                string rest = n.Substring(4); bool top = rest.EndsWith("_top");
                string key = rest.Substring(0, rest.LastIndexOf('_'));
                var w = WoodOf(key);
                if (top) LogTop(p, w.bark, w.ring); else LogSide(p, w.bark);
                if (key == "birch" && !top) { for (int i = 0; i < 6; i++) { int x = (int)(p.R(i, 0, 21) * 15), y = (int)(p.R(i, 1, 21) * 15); p.Set(x, y, Col.Hex(0x2A2A2A)); p.Set(x + 1, y, Col.Hex(0x2A2A2A)); } }
                if (key == "spirit" && !top) { for (int y = 2; y < 16; y += 5) p.HLine(0, 15, y, Col.Hex(0xFFFFFF, 255)); }
                return;
            }
            if (n.StartsWith("door_"))
            {
                string rest = n.Substring(5); bool top = rest.EndsWith("_top");
                string key = rest.Substring(0, rest.LastIndexOf('_'));
                Door(p, WoodOf(key).planks, top); return;
            }
            if (n.StartsWith("coral_"))
            {
                string k = n.Substring(6);
                uint c = k == "tube" ? 0x3050C8u : k == "brain" ? 0xCC4C9Eu : k == "bubble" ? 0xA018A0u : k == "fire" ? 0xD02830u : 0xE0D040u;
                p.Noise(c, 0.1f, 1);
                for (int i = 0; i < 14; i++) { int x = (int)(p.R(i, 0, 5) * 16), y = (int)(p.R(i, 1, 5) * 16); p.Set(x, y, Col.Mul(Col.Hex(c), 0.55f)); if (k == "brain") p.Set(x + 1, y, Col.Mul(Col.Hex(c), 0.7f)); }
                return;
            }
            if (n.StartsWith("crop_"))
            {
                string rest = n.Substring(5);
                int us = rest.LastIndexOf('_');
                Crop(p, rest.Substring(0, us), rest[us + 1] - '0'); return;
            }
            if (n.StartsWith("tulip_"))
            {
                string k = n.Substring(6);
                uint c = k == "red" ? 0xD02A2Au : k == "orange" ? 0xE8782Au : k == "white" ? 0xEEEEEEu : 0xF0A0C8u;
                Flower(p, c, c, 2, 5); return;
            }

            switch (n)
            {
                case "white": p.Fill(Col.Hex(0xFFFFFF)); break;
                case "black": p.Fill(Col.Hex(0x000000)); break;
                case "stone": p.Noise(0x7D7D7D, 0.05f, 1); p.Speckle(0.09f, 0.84f, 2); p.Speckle(0.06f, 1.12f, 3); break;
                case "cobblestone": Cells(p, 0x7C7C7C, 7, 0.14f); break;
                case "mossy_cobblestone": Cells(p, 0x7C7C7C, 7, 0.14f); MossPatches(p, 0.35f); break;
                case "dirt": p.Noise(0x866043, 0.1f, 1); p.Speckle(0.1f, 0.82f, 2); p.Speckle(0.06f, 1.15f, 3); break;
                case "coarse_dirt": p.Noise(0x77553B, 0.12f, 1); p.SpeckleColor(0.14f, Col.Hex(0x9C9C9C), 4); p.Speckle(0.1f, 0.8f, 2); break;
                case "grass_top": p.Noise(0xD2D2D2, 0.07f, 1); p.Speckle(0.12f, 0.88f, 2); break;
                case "grass_side": Sidefringe(p, 0x866043, 0x5FA132, false); break;
                case "sky_grass_top": p.Noise(0x7FE8C8, 0.07f, 1); p.SpeckleColor(0.07f, Col.Hex(0xE8FFF8), 2); p.Speckle(0.1f, 0.85f, 3); break;
                case "sky_grass_side": Sidefringe(p, 0x866043, 0x6FDDBB, true); break;
                case "podzol_top": p.Noise(0x5C3F1F, 0.14f, 1); p.SpeckleColor(0.12f, Col.Hex(0x7A5A2E), 3); p.Speckle(0.1f, 0.8f, 2); break;
                case "podzol_side": Sidefringe(p, 0x866043, 0x5C3F1F, false); break;
                case "mycelium_top": p.Noise(0x6F6369, 0.1f, 1); p.SpeckleColor(0.15f, Col.Hex(0x8A7390), 3); break;
                case "mycelium_side": Sidefringe(p, 0x866043, 0x6F6369, false); break;
                case "farmland_dry": Farm(p, 0x8E6A44); break;
                case "farmland_wet": Farm(p, 0x4E3320); break;
                case "dirt_path_top": p.Noise(0x9A7E48, 0.07f, 1); p.Speckle(0.1f, 0.88f, 2); break;
                case "dirt_path_side": Sidefringe(p, 0x866043, 0x9A7E48, false); break;
                case "sand": p.Noise(0xDBD3A0, 0.05f, 1); p.Speckle(0.08f, 0.93f, 2); break;
                case "red_sand": p.Noise(0xBE6821, 0.06f, 1); p.Speckle(0.08f, 0.9f, 2); break;
                case "gravel": Cells(p, 0x858585, 9, 0.18f, 8); p.SpeckleColor(0.08f, Col.Hex(0x8A7E70), 3); break;
                case "clay": p.Noise(0xA0A6B6, 0.03f, 1); p.Speckle(0.06f, 0.95f, 2); break;
                case "sandstone_top": p.Noise(0xDBD3A0, 0.03f, 1); p.Border(Col.Hex(0xCBC38E)); break;
                case "sandstone_bottom": p.Noise(0xD2CA98, 0.03f, 1); break;
                case "sandstone_side": p.Noise(0xDBD3A0, 0.04f, 1); p.HLine(0, 15, 3, Col.Hex(0xC4BB88)); p.HLine(0, 15, 11, Col.Hex(0xC4BB88)); p.HLine(0, 15, 12, Col.Hex(0xB8B07E)); break;
                case "red_sandstone_top": p.Noise(0xB5601F, 0.03f, 1); p.Border(Col.Hex(0xA25418)); break;
                case "red_sandstone_bottom": p.Noise(0xAB5A1C, 0.03f, 1); break;
                case "red_sandstone_side": p.Noise(0xB5601F, 0.04f, 1); p.HLine(0, 15, 3, Col.Hex(0x9E5018)); p.HLine(0, 15, 11, Col.Hex(0x9E5018)); p.HLine(0, 15, 12, Col.Hex(0x8E4614)); break;
                case "snow": p.Noise(0xF6FCFC, 0.02f, 1); p.Speckle(0.1f, 0.96f, 2); break;
                case "ice": p.Noise(0x9DC4FF, 0.04f, 1); for (int i = 0; i < p.d.Length; i++) p.d[i].a = 205; p.Line(1, 14, 12, 3, Col.Hex(0xD8E8FF, 230)); break;
                case "packed_ice": p.Noise(0x7FA6EE, 0.04f, 1); p.Line(0, 12, 10, 2, Col.Hex(0xA9C6FF)); p.Line(5, 15, 15, 6, Col.Hex(0xA9C6FF)); break;
                case "water":
                    p.Noise(0xE8EEFF, 0.04f, 1);
                    for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) { double w = Math.Sin((x + y * 0.5) * 0.9) + Math.Sin(y * 1.1); if (w > 1.2) p.Set(x, y, Col.Hex(0xFFFFFF)); }
                    break;
                case "lava":
                    p.Noise(0xE5600A, 0.18f, 1);
                    for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) { float r = p.R(x / 2, y / 2, 4); if (r > 0.7f) p.Set(x, y, Col.Hex(0xFFD23A)); else if (r < 0.15f) p.Set(x, y, Col.Hex(0xA02A05)); }
                    break;
                case "obsidian": p.Noise(0x150F23, 0.12f, 1); p.SpeckleColor(0.12f, Col.Hex(0x3A2A66), 3); p.SpeckleColor(0.03f, Col.Hex(0x7A5ACC), 4); break;
                case "glowstone": Cells(p, 0xE9B65B, 6, 0.2f, 7); p.SpeckleColor(0.1f, Col.Hex(0xFFE9A0), 3); break;
                case "granite": p.Noise(0x9A6B58, 0.07f, 1); p.SpeckleColor(0.14f, Col.Hex(0xB07F6B), 3); p.Speckle(0.1f, 0.8f, 2); break;
                case "diorite": p.Noise(0xBEBEBE, 0.05f, 1); p.SpeckleColor(0.16f, Col.Hex(0xEDEDED), 3); p.SpeckleColor(0.1f, Col.Hex(0x8A8A8A), 4); break;
                case "andesite": p.Noise(0x898989, 0.05f, 1); p.SpeckleColor(0.14f, Col.Hex(0xA4A4A4), 3); p.SpeckleColor(0.1f, Col.Hex(0x707070), 4); break;
                case "polished_granite": p.Noise(0x9A6B58, 0.02f, 1); p.Border(Col.Hex(0x84594A)); break;
                case "polished_diorite": p.Noise(0xC4C4C4, 0.02f, 1); p.Border(Col.Hex(0xAAAAAA)); break;
                case "polished_andesite": p.Noise(0x8E8E8E, 0.02f, 1); p.Border(Col.Hex(0x787878)); break;
                case "deepslate_side": p.Noise(0x484850, 0.05f, 1); for (int y = 0; y < 16; y += 4) p.HLine(0, 15, y + (int)(p.R(y, 0, 5) * 2), Col.Hex(0x3A3A42)); p.Speckle(0.08f, 1.15f, 3); break;
                case "deepslate_top": p.Noise(0x4C4C54, 0.05f, 1); p.Speckle(0.1f, 0.85f, 3); break;
                case "cobbled_deepslate": Cells(p, 0x4B4B53, 7, 0.14f); break;
                case "polished_deepslate": p.Noise(0x48484F, 0.02f, 1); p.Border(Col.Hex(0x3A3A41)); break;
                case "deepslate_bricks": BricksPattern(p, 0x4A4A52, 0x2E2E34); break;
                case "deepslate_tiles": BricksPattern(p, 0x424249, 0x2A2A30, 8, 8); break;
                case "tuff": Cells(p, 0x6C6D64, 6, 0.1f, 9); p.SpeckleColor(0.06f, Col.Hex(0x8A8A7C), 3); break;
                case "calcite": p.Noise(0xE0E0DC, 0.03f, 1); p.Speckle(0.1f, 0.94f, 2); break;
                case "basalt_side": p.Noise(0x4B4B50, 0.05f, 1); for (int x = 0; x < 16; x += 3) p.VLine(x, 0, 15, Col.Hex(0x3C3C40)); break;
                case "basalt_top": p.Noise(0x555559, 0.05f, 1); p.Border(Col.Hex(0x3C3C40)); p.Rect(5, 5, 10, 10, Col.Hex(0x46464A)); break;
                case "smooth_basalt": p.Noise(0x48484C, 0.03f, 1); break;
                case "moss_block": p.Noise(0x59711F, 0.12f, 1); p.Speckle(0.15f, 1.2f, 2); break;
                case "bricks": BricksPattern(p, 0x96574A, 0xA8A8A8); break;
                case "stone_bricks": StoneBricks(p); break;
                case "mossy_stone_bricks": StoneBricks(p); MossPatches(p, 0.3f); break;
                case "cracked_stone_bricks": StoneBricks(p); p.Line(3, 1, 6, 6, Col.Hex(0x4A4A4A)); p.Line(6, 6, 5, 10, Col.Hex(0x4A4A4A)); p.Line(11, 8, 14, 13, Col.Hex(0x4A4A4A)); break;
                case "chiseled_stone_bricks": StoneBricks(p); p.Rect(3, 3, 12, 12, Col.Hex(0x6A6A6A)); p.Rect(4, 4, 11, 11, Col.Hex(0x888888)); p.Rect(6, 6, 9, 9, Col.Hex(0x707070)); break;
                case "smooth_stone": p.Noise(0x9E9E9E, 0.02f, 1); p.Border(Col.Hex(0x8C8C8C)); break;
                case "quartz_top": p.Noise(0xEEE9E1, 0.02f, 1); break;
                case "quartz_side": p.Noise(0xEBE6DE, 0.02f, 1); p.HLine(0, 15, 15, Col.Hex(0xD6D1C8)); break;
                case "quartz_pillar_side": p.Noise(0xEBE6DE, 0.02f, 1); for (int x = 0; x < 16; x += 4) p.VLine(x, 0, 15, Col.Hex(0xD6D1C8)); break;
                case "quartz_pillar_top": p.Noise(0xEEE9E1, 0.02f, 1); p.Border(Col.Hex(0xD6D1C8)); p.Rect(4, 4, 11, 11, Col.Hex(0xE2DDD4)); break;
                case "quartz_bricks": BricksPattern(p, 0xEBE6DE, 0xD0CBC2); break;
                case "prismarine": Cells(p, 0x63A894, 6, 0.14f, 7); break;
                case "prismarine_bricks": BricksPattern(p, 0x5BA08D, 0x3E7A6A); break;
                case "dark_prismarine": Cells(p, 0x335A4C, 6, 0.12f, 7); break;
                case "sea_lantern": p.Noise(0xC9ECE2, 0.05f, 1); p.Border(Col.Hex(0x7FB0C0)); p.Rect(4, 4, 11, 11, Col.Hex(0xE8FFFA)); p.Line(0, 0, 4, 4, Col.Hex(0x7FB0C0)); p.Line(15, 0, 11, 4, Col.Hex(0x7FB0C0)); p.Line(0, 15, 4, 11, Col.Hex(0x7FB0C0)); p.Line(15, 15, 11, 11, Col.Hex(0x7FB0C0)); break;
                case "end_stone": p.Noise(0xDDDDA0, 0.06f, 1); p.SpeckleColor(0.12f, Col.Hex(0xEFEFB8), 3); p.Speckle(0.1f, 0.88f, 2); break;
                case "end_stone_bricks": BricksPattern(p, 0xE0E0A8, 0xB8B880); break;
                case "abyss_rock": p.Noise(0x703030, 0.1f, 1); p.SpeckleColor(0.1f, Col.Hex(0x8A3A3A), 3); p.Speckle(0.12f, 0.75f, 2); break;
                case "abyss_bricks": BricksPattern(p, 0x2E1518, 0x1B0C0E); break;
                case "soul_sand": p.Noise(0x54402F, 0.08f, 1); for (int i = 0; i < 6; i++) { int x = 1 + (int)(p.R(i, 0, 5) * 12), y = 1 + (int)(p.R(i, 1, 5) * 12); p.Rect(x, y, x + 1, y + 1, Col.Hex(0x2E2118)); } break;
                case "magma": p.Noise(0x3A1818, 0.1f, 1); for (int i = 0; i < 9; i++) { int x = (int)(p.R(i, 0, 6) * 14), y = (int)(p.R(i, 1, 6) * 14); p.Rect(x, y, x + 1 + (i % 2), y + 1, Col.Hex(i % 2 == 0 ? 0xFF7A1Au : 0xFFB02Au)); } break;
                case "cloud": p.Noise(0xF4F8FF, 0.025f, 1); p.Border(Col.Hex(0xE2ECFA)); break;
                case "sky_crystal":
                    p.Noise(0x9AF0F5, 0.06f, 1);
                    p.Line(0, 15, 15, 0, Col.Hex(0xE8FFFF)); p.Line(0, 10, 10, 0, Col.Hex(0xC6FAFF)); p.Line(5, 15, 15, 5, Col.Hex(0x7AD8E4));
                    p.Border(Col.Hex(0x6BC8D6)); break;
                case "sky_bricks": BricksPattern(p, 0xC9D9E8, 0x9FB4C8); break;
                case "sky_stone": p.Noise(0xB8C8D8, 0.05f, 1); p.Speckle(0.1f, 0.88f, 2); break;
                case "bedrock": Cells(p, 0x555555, 9, 0.28f, 8); p.Speckle(0.12f, 0.6f, 4); break;
                case "amethyst_cluster": AmethystCluster(p); break;
                case "crafting_top": Planks(p, 0xB8945F); p.Border(Col.Hex(0x6B4F2A)); p.HLine(1, 14, 5, Col.Hex(0x6B4F2A)); p.HLine(1, 14, 10, Col.Hex(0x6B4F2A)); p.VLine(5, 1, 14, Col.Hex(0x6B4F2A)); p.VLine(10, 1, 14, Col.Hex(0x6B4F2A)); break;
                case "crafting_side": Planks(p, 0xA8854F); p.Rect(0, 0, 15, 2, Col.Hex(0x7A5A30)); p.Rect(2, 5, 6, 12, Col.Hex(0x8A8A8A)); p.Rect(9, 6, 13, 8, Col.Hex(0xA06A3A)); p.VLine(11, 8, 13, Col.Hex(0x5A3A18)); break;
                case "crafting_front": Planks(p, 0xA8854F); p.Rect(0, 0, 15, 2, Col.Hex(0x7A5A30)); p.Line(3, 12, 8, 5, Col.Hex(0xBBBBBB)); p.Line(4, 12, 9, 5, Col.Hex(0x888888)); p.Rect(10, 6, 13, 8, Col.Hex(0x6A6A6A)); p.VLine(11, 9, 13, Col.Hex(0x5A3A18)); break;
                case "furnace_front": Cells(p, 0x7C7C7C, 6, 0.1f); p.Rect(4, 6, 11, 13, Col.Hex(0x222222)); p.Rect(5, 7, 10, 12, Col.Hex(0x101010)); p.Rect(4, 2, 11, 3, Col.Hex(0x333333)); break;
                case "furnace_front_on": Cells(p, 0x7C7C7C, 6, 0.1f); p.Rect(4, 6, 11, 13, Col.Hex(0x222222)); p.Rect(5, 7, 10, 12, Col.Hex(0xE8601A)); p.Rect(6, 9, 9, 12, Col.Hex(0xFFC83A)); p.Rect(4, 2, 11, 3, Col.Hex(0x333333)); break;
                case "furnace_side": Cells(p, 0x7C7C7C, 6, 0.1f); break;
                case "furnace_top": p.Noise(0x888888, 0.04f, 1); p.Border(Col.Hex(0x6A6A6A)); break;
                case "chest_top": p.Noise(0x9D6C2F, 0.05f, 1); p.Border(Col.Hex(0x5B3A12)); p.Rect(1, 1, 14, 14, Col.Mul(Col.Hex(0x9D6C2F), 1.05f)); break;
                case "chest_side": p.Noise(0x9D6C2F, 0.05f, 1); p.Border(Col.Hex(0x5B3A12)); p.HLine(1, 14, 5, Col.Hex(0x5B3A12)); break;
                case "chest_front": p.Noise(0x9D6C2F, 0.05f, 1); p.Border(Col.Hex(0x5B3A12)); p.HLine(1, 14, 5, Col.Hex(0x5B3A12)); p.Rect(7, 4, 8, 7, Col.Hex(0xD0D0D0)); p.Set(7, 6, Col.Hex(0x888888)); break;
                case "stonecutter_top": p.Noise(0x8A8A8A, 0.04f, 1); p.Border(Col.Hex(0x6A6A6A)); p.Disc(8, 8, 4.5f, Col.Hex(0xBFBFBF)); p.Disc(8, 8, 2f, Col.Hex(0x8A8A8A)); p.HLine(2, 13, 8, Col.Hex(0x666666)); break;
                case "stonecutter_side": p.Noise(0x8A8A8A, 0.04f, 1); p.Rect(0, 11, 15, 15, Col.Hex(0x6B4F2A)); p.HLine(0, 15, 11, Col.Hex(0x4A3518)); p.Rect(3, 3, 12, 6, Col.Hex(0xBFBFBF)); break;
                case "bookshelf":
                    Planks(p, 0xB8945F);
                    for (int row = 0; row < 2; row++)
                    {
                        int y0 = 1 + row * 8;
                        p.Rect(1, y0, 14, y0 + 5, Col.Hex(0x3A2A18));
                        for (int x = 1; x < 15; x++)
                        {
                            float r = MathX.Hash01(x, row, 7, p.seed);
                            uint bc = r < 0.2f ? 0x8A2A2Au : r < 0.4f ? 0x2A5A8Au : r < 0.6f ? 0x3A7A3Au : r < 0.8f ? 0xA07A2Au : 0x6A3A8Au;
                            p.VLine(x, y0 + 1, y0 + 5, Col.Mul(Col.Hex(bc), 0.8f + p.R(x, row, 8) * 0.4f));
                        }
                    }
                    break;
                case "bed_top": p.Noise(0xA82A2A, 0.04f, 1); p.Rect(0, 0, 15, 4, Col.Hex(0xEDEDED)); p.Border(Col.Hex(0x7A1A1A)); break;
                case "bed_side": p.Noise(0xA82A2A, 0.04f, 1); p.Rect(0, 8, 15, 15, Col.Hex(0x8A6A3A)); p.HLine(0, 15, 8, Col.Hex(0x5A3A18)); break;
                case "torch":
                    p.Rect(7, 6, 8, 15, Col.Hex(0x7A5A2A)); p.VLine(8, 6, 15, Col.Hex(0x5A3F1A));
                    p.Rect(7, 3, 8, 5, Col.Hex(0xFFC83A)); p.Set(7, 3, Col.Hex(0xFFF0A0)); p.Set(8, 2, Col.Hex(0xFF8A1A)); p.Set(7, 2, Col.Hex(0xFFB02A)); break;
                case "tnt_side": p.Noise(0xD8301E, 0.05f, 1); p.Rect(0, 5, 15, 10, Col.Hex(0xE8E8E0)); for (int x = 2; x < 14; x += 4) { p.VLine(x, 6, 9, Col.Hex(0x303030)); p.VLine(x + 1, 6, 6, Col.Hex(0x303030)); p.VLine(x + 1, 9, 9, Col.Hex(0x303030)); } break;
                case "tnt_top": p.Noise(0xC8C8C0, 0.04f, 1); p.Border(Col.Hex(0xD8301E)); p.Rect(7, 7, 8, 8, Col.Hex(0x3A3A3A)); break;
                case "tnt_bottom": p.Noise(0xD8301E, 0.05f, 1); break;
                case "pumpkin_side": for (int x = 0; x < 16; x++) { var c = Col.Hex(((x / 3) % 2 == 0) ? 0xD87A12u : 0xC06A0Eu); for (int y = 0; y < 16; y++) p.Set(x, y, Col.Mul(c, 1f + (p.R(x, y, 1) - 0.5f) * 0.08f)); } break;
                case "pumpkin_top": p.Noise(0xC77010, 0.06f, 1); p.Border(Col.Hex(0xA05A0C)); p.Rect(6, 6, 9, 9, Col.Hex(0x5A7A2A)); break;
                case "jack_face":
                    for (int x = 0; x < 16; x++) { var c = Col.Hex(((x / 3) % 2 == 0) ? 0xD87A12u : 0xC06A0Eu); for (int y = 0; y < 16; y++) p.Set(x, y, c); }
                    p.Poly(new[] { 2, 5, 6, 5, 4, 8 }, Col.Hex(0xFFE65A)); p.Poly(new[] { 10, 5, 14, 5, 12, 8 }, Col.Hex(0xFFE65A));
                    p.Rect(3, 10, 12, 12, Col.Hex(0xFFE65A)); p.Rect(5, 12, 10, 13, Col.Hex(0xFFE65A)); break;
                case "melon_side": for (int x = 0; x < 16; x++) { var c = Col.Hex(((x / 2) % 2 == 0) ? 0x5E9A2Au : 0x3E7A1Au); for (int y = 0; y < 16; y++) p.Set(x, y, Col.Mul(c, 1f + (p.R(x, y, 1) - 0.5f) * 0.1f)); } break;
                case "melon_top": p.Noise(0x4E8A22, 0.08f, 1); p.Border(Col.Hex(0x3E7A1A)); p.Rect(7, 7, 8, 8, Col.Hex(0x6B5330)); break;
                case "hay_side": p.Noise(0xC8A422, 0.1f, 1); p.HLine(0, 15, 3, Col.Hex(0x6B4F2A)); p.HLine(0, 15, 12, Col.Hex(0x6B4F2A)); for (int x = 0; x < 16; x += 2) p.VLine(x, 4, 11, Col.Mul(Col.Hex(0xC8A422), 0.88f)); break;
                case "hay_top": p.Noise(0xC8A422, 0.1f, 1); p.Border(Col.Hex(0x6B4F2A)); p.Disc(8, 8, 3, Col.Hex(0xB89018)); break;
                case "cactus_side": p.Noise(0x1E7A2A, 0.08f, 1); p.VLine(0, 0, 15, Col.Hex(0x145A1E)); p.VLine(15, 0, 15, Col.Hex(0x145A1E)); for (int i = 0; i < 8; i++) p.Set(2 + (int)(p.R(i, 0, 4) * 12), (int)(p.R(i, 1, 4) * 16), Col.Hex(0xD8E8B0)); break;
                case "cactus_top": p.Noise(0x1E7A2A, 0.06f, 1); p.Border(Col.Hex(0x145A1E)); p.Rect(5, 5, 10, 10, Col.Hex(0x2A8A38)); break;
                case "glass": Glass(p, 0xCFE8F4, 255, true); break;
                case "ladder":
                    for (int i = 0; i < p.d.Length; i++) p.d[i] = Col.Clear;
                    p.Rect(2, 0, 3, 15, Col.Hex(0x8B5E2B)); p.Rect(12, 0, 13, 15, Col.Hex(0x8B5E2B)); p.VLine(3, 0, 15, Col.Hex(0x6B4520)); p.VLine(13, 0, 15, Col.Hex(0x6B4520));
                    for (int y = 1; y < 16; y += 4) { p.Rect(4, y, 11, y + 1, Col.Hex(0xA67C3A)); p.HLine(4, 11, y + 1, Col.Hex(0x7A5A28)); }
                    break;
                case "iron_bars":
                    for (int i = 0; i < p.d.Length; i++) p.d[i] = Col.Clear;
                    foreach (int bx in new[] { 1, 7, 13 }) { p.Rect(bx, 0, bx + 1, 15, Col.Hex(0x9AA0A8)); p.VLine(bx + 1, 0, 15, Col.Hex(0x5E626A)); }
                    p.Rect(0, 7, 15, 8, Col.Hex(0x8A9098)); p.HLine(0, 15, 8, Col.Hex(0x5E626A));
                    break;
                case "spawner":
                    p.Fill(Col.Hex(0x0E1218)); p.Border(Col.Hex(0x6A7A8A)); p.HLine(0, 15, 8, Col.Hex(0x4A5A6A)); p.VLine(8, 0, 15, Col.Hex(0x4A5A6A));
                    for (int i = 0; i < 16; i++) { p.Set(i, i, Col.Hex(0x3A4A5A)); }
                    p.SpeckleColor(0.08f, Col.Hex(0x1E6A9A), 4); break;
                case "portal":
                    p.Noise(0x6A1EC0, 0.15f, 1);
                    for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) { double w = Math.Sin(x * 0.7 + y * 0.9) + Math.Sin(y * 0.5 - x * 0.4); if (w > 1.0) p.Set(x, y, Col.Hex(0xC890FF)); p.d[y * 16 + x].a = 190; }
                    break;
                case "end_portal": p.Fill(Col.Hex(0x04060E)); for (int i = 0; i < 22; i++) { int x = (int)(p.R(i, 0, 5) * 16), y = (int)(p.R(i, 1, 5) * 16); p.Set(x, y, Col.Hex(i % 3 == 0 ? 0x5ACFD0u : i % 3 == 1 ? 0x8A60E0u : 0x3AA090u)); } break;
                case "end_frame_top": p.Noise(0x3D6E58, 0.06f, 1); p.Border(Col.Hex(0x2A4A3C)); p.Rect(4, 4, 11, 11, Col.Hex(0x1E3A2E)); p.Rect(5, 5, 10, 10, Col.Hex(0x142A20)); break;
                case "end_frame_side": p.Noise(0x3D6E58, 0.05f, 1); p.Rect(0, 0, 15, 2, Col.Hex(0xDDDDA0)); p.Rect(0, 13, 15, 15, Col.Hex(0xDDDDA0)); p.Border(Col.Hex(0x2A4A3C)); break;
                case "end_eye": p.Disc(8, 8, 5.5f, Col.Hex(0x1E7A5A)); p.Disc(8, 8, 3.5f, Col.Hex(0x58E0A8)); p.Disc(8, 8, 1.6f, Col.Hex(0x0A2A1E)); break;
                case "dragon_egg": p.Noise(0x120C1E, 0.12f, 1); p.SpeckleColor(0.12f, Col.Hex(0x7A3AC8), 3); p.SpeckleColor(0.04f, Col.Hex(0xC890FF), 4); break;
                case "mushroom_stem": p.Noise(0xD8D0C0, 0.04f, 1); for (int x = 0; x < 16; x += 3) p.VLine(x, 0, 15, Col.Hex(0xC4BCA8)); break;
                case "mushroom_red_block": p.Noise(0xC02020, 0.06f, 1); for (int i = 0; i < 5; i++) { int x = (int)(p.R(i, 0, 6) * 13), y = (int)(p.R(i, 1, 6) * 13); p.Rect(x, y, x + 2, y + 2, Col.Hex(0xF0F0E8)); } break;
                case "mushroom_brown_block": p.Noise(0x8B5E3C, 0.06f, 1); for (int i = 0; i < 5; i++) { int x = (int)(p.R(i, 0, 6) * 13), y = (int)(p.R(i, 1, 6) * 13); p.Rect(x, y, x + 2, y + 1, Col.Hex(0xAD8460)); } break;
                // ---- plantas ----
                case "tall_grass": GrassBlades(p, false); break;
                case "fern": GrassBlades(p, true); break;
                case "dead_bush": { var c = Col.Hex(0x6B4F2A); p.VLine(7, 8, 15, c); p.Line(7, 10, 3, 5, c); p.Line(7, 11, 12, 6, c); p.Line(7, 9, 5, 3, c); p.Line(8, 12, 13, 9, c); break; }
                case "dandelion": Flower(p, 0xF8E02A, 0xFFF8A0, 2, 5); break;
                case "poppy": Flower(p, 0xD62020, 0x401010, 2, 5); break;
                case "blue_orchid": Flower(p, 0x2AA8E8, 0xC8F0FF, 2, 5); break;
                case "allium": Flower(p, 0xB060D8, 0xE8C0FF, 3, 5); break;
                case "cornflower": Flower(p, 0x4A6AE8, 0xFFFFFF, 2, 6); break;
                case "lily_valley": { Flower(p, 0xFFFFFF, 0xE8F0E8, 1, 6); p.Set(6, 8, Col.Hex(0xFFFFFF)); p.Set(9, 9, Col.Hex(0xFFFFFF)); break; }
                case "sunflower": Flower(p, 0xF8C81A, 0x6B4F1A, 3, 4); break;
                case "mushroom_red": p.Rect(7, 10, 8, 15, Col.Hex(0xE8E0D0)); p.Ellipse(8, 8.5f, 4.5f, 3f, Col.Hex(0xC02020)); p.Set(6, 7, Col.Hex(0xF0F0F0)); p.Set(9, 8, Col.Hex(0xF0F0F0)); p.Set(8, 6, Col.Hex(0xF0F0F0)); break;
                case "mushroom_brown": p.Rect(7, 10, 8, 15, Col.Hex(0xD8D0C0)); p.Ellipse(8, 9, 4.5f, 2.5f, Col.Hex(0x8B5E3C)); p.Set(7, 8, Col.Hex(0xAD8460)); break;
                case "sugar_cane":
                    for (int x = 3; x < 16; x += 5) { var c = Col.Hex(0x8CC84A); p.VLine(x, 0, 15, c); p.VLine(x + 1, 0, 15, Col.Mul(c, 0.82f)); for (int y = 2; y < 16; y += 5) { p.Set(x, y, Col.Mul(c, 0.6f)); p.Set(x + 1, y, Col.Mul(c, 0.5f)); } }
                    break;
                case "kelp": { var c = Col.Hex(0x2A7A3A); for (int y = 0; y < 16; y++) { int x = 7 + (int)Math.Round(Math.Sin(y * 0.6) * 1.5); p.Set(x, y, c); p.Set(x + 1, y, Col.Mul(c, 0.8f)); if (y % 4 == 1) p.Set(x - 1, y, Col.Mul(c, 1.2f)); if (y % 4 == 3) p.Set(x + 2, y, Col.Mul(c, 1.2f)); } break; }
                case "seagrass": { var c = Col.Hex(0xD0E0D0); for (int x = 3; x < 14; x += 3) { int h = 6 + (x % 4) * 2; p.VLine(x, 16 - h, 15, Col.Mul(c, 0.8f + p.R(x, 0, 2) * 0.3f)); } break; }
                case "sapling": Sapling(p, 0x4C9A2A); break;
                default:
                    {
                        // textura desconocida: color derivado del nombre para no dejar huecos
                        uint h = MathX.Hash(SeedOf(n), 1, 2, 3);
                        p.Noise(0x404040u + (h & 0xBFBFBF), 0.08f, 1);
                        p.Border(Col.Hex(0xFF00FF));
                        break;
                    }
            }
        }

        static uint Mix(uint a, uint b, float t)
        {
            int ar = (int)(a >> 16) & 255, ag = (int)(a >> 8) & 255, ab = (int)a & 255;
            int br = (int)(b >> 16) & 255, bg = (int)(b >> 8) & 255, bb = (int)b & 255;
            int r = (int)(ar + (br - ar) * t), g = (int)(ag + (bg - ag) * t), bl = (int)(ab + (bb - ab) * t);
            return (uint)((r << 16) | (g << 8) | bl);
        }

        static void MossPatches(Px p, float amount)
        {
            var g = Col.Hex(0x5A7A2A);
            for (int y = 0; y < 16; y++)
                for (int x = 0; x < 16; x++)
                    if (p.R(x / 2, y / 2, 55) < amount) p.Set(x, y, Col.Mul(g, 0.85f + p.R(x, y, 56) * 0.3f));
        }

        static void StoneBricks(Px p)
        {
            BricksPattern(p, 0x7D7D7D, 0x5E5E5E, 8, 8, 0.05f);
        }

        static void Farm(Px p, uint hex)
        {
            p.Noise(hex, 0.06f, 1);
            for (int y = 0; y < 16; y += 4) p.HLine(0, 15, y, Col.Mul(Col.Hex(hex), 0.72f));
            p.Border(Col.Mul(Col.Hex(hex), 0.82f));
        }

        static void GrassBlades(Px p, bool fern)
        {
            var c = Col.Hex(0xE0E0E0);
            if (!fern)
            {
                for (int x = 1; x < 16; x += 2)
                {
                    int h = 5 + (int)(p.R(x, 0, 3) * 9);
                    int lean = p.R(x, 1, 3) < 0.5f ? -1 : 1;
                    for (int i = 0; i < h; i++)
                    {
                        int xx = x + (i > h / 2 ? lean : 0);
                        p.Set(xx, 15 - i, Col.Mul(c, 0.72f + 0.28f * i / (float)h));
                    }
                }
            }
            else
            {
                p.VLine(8, 5, 15, Col.Mul(c, 0.7f));
                for (int i = 0; i < 9; i++)
                {
                    int y = 14 - i;
                    int len = 1 + (i < 5 ? i : 9 - i);
                    for (int k = 1; k <= len; k++) { p.Set(8 - k, y - k / 2, Col.Mul(c, 0.9f)); p.Set(8 + k, y - k / 2, Col.Mul(c, 0.8f)); }
                }
            }
        }

        static void AmethystCluster(Px p)
        {
            var a = Col.Hex(0xA571E6); var d = Col.Hex(0x7A4AC0); var l = Col.Hex(0xD0B0FF);
            int[] xs = { 4, 8, 11, 6, 13 }; int[] hs = { 8, 12, 9, 6, 6 };
            for (int i = 0; i < xs.Length; i++)
            {
                for (int k = 0; k < hs[i]; k++) { p.Set(xs[i], 15 - k, k > hs[i] - 3 ? l : a); p.Set(xs[i] + 1, 15 - k, d); }
            }
        }

        static void OreByName(Px p, string o, bool deep)
        {
            switch (o)
            {
                case "coal": Ore(p, deep, 0x2A2A2A, 0x4A4A4A); break;
                case "copper": Ore(p, deep, 0xD9825A, 0x4FB58A); break;
                case "iron": Ore(p, deep, 0xD8AF93, 0xF0D8C4); break;
                case "gold": Ore(p, deep, 0xFCEE4B, 0xFFFFC0); break;
                case "lapis": Ore(p, deep, 0x1F4FB5, 0x5A8AF0); break;
                case "diamond": Ore(p, deep, 0x5DECF5, 0xCFFFFF); break;
                case "emerald": Ore(p, deep, 0x17DD62, 0xA0FFC0); break;
                case "ruby": Ore(p, deep, 0xE0153D, 0xFF8AA0); break;
                case "sapphire": Ore(p, deep, 0x2E5FE8, 0x9AB8FF); break;
                case "amethyst": Ore(p, deep, 0xA571E6, 0xDDC0FF); break;
                case "quartz": p.Noise(0x703030, 0.1f, 1); p.Speckle(0.12f, 0.75f, 2); OreOver(p, 0xEEE8E0, 0xFFFFFF); break;
                case "abyss_gold": p.Noise(0x703030, 0.1f, 1); p.Speckle(0.12f, 0.75f, 2); OreOver(p, 0xFCEE4B, 0xFFFFC0); break;
                case "abismita": p.Noise(0x703030, 0.1f, 1); p.Speckle(0.12f, 0.75f, 2); OreOver(p, 0x4A3030, 0xD8A040); break;
                default: p.Noise(0x7D7D7D, 0.05f, 1); break;
            }
        }

        static void OreOver(Px p, uint main, uint hi)
        {
            var c = Col.Hex(main); var h = Col.Hex(hi);
            for (int i = 0; i < 6; i++)
            {
                int bx = 1 + (int)(p.R(i, 0, 12) * 12), by = 1 + (int)(p.R(i, 1, 12) * 12);
                int w = 2 + (int)(p.R(i, 2, 12) * 2), hh = 2 + (int)(p.R(i, 3, 12) * 2);
                for (int yy = 0; yy < hh; yy++) for (int xx = 0; xx < w; xx++) p.Set(bx + xx, by + yy, (xx + yy) % 2 == 0 ? c : Col.Mul(c, 0.82f));
                p.Set(bx, by, h);
            }
        }

        static void MetalByName(Px p, string o)
        {
            switch (o)
            {
                case "coal": p.Noise(0x161616, 0.12f, 1); p.SpeckleColor(0.15f, Col.Hex(0x2E2E2E), 3); break;
                case "copper": MetalBlock(p, 0xC0663D); p.SpeckleColor(0.08f, Col.Hex(0x4FB58A), 5); break;
                case "iron": MetalBlock(p, 0xDCDCDC); break;
                case "gold": MetalBlock(p, 0xF9D93F); break;
                case "lapis": p.Noise(0x1D46A6, 0.1f, 1); p.SpeckleColor(0.1f, Col.Hex(0xD8C070), 3); p.SpeckleColor(0.1f, Col.Hex(0x4A78E0), 4); break;
                case "diamond": MetalBlock(p, 0x4EE0E0); break;
                case "emerald": MetalBlock(p, 0x2FD45C); break;
                case "ruby": MetalBlock(p, 0xD0103A); break;
                case "sapphire": MetalBlock(p, 0x2A56D6); break;
                case "amethyst": MetalBlock(p, 0x9A5CD6); break;
                case "abismita": MetalBlock(p, 0x433838); break;
                case "raw_iron": p.Noise(0xC4A182, 0.12f, 1); p.SpeckleColor(0.1f, Col.Hex(0xD8B898), 3); break;
                case "raw_copper": p.Noise(0xC07A52, 0.12f, 1); p.SpeckleColor(0.1f, Col.Hex(0x4FB58A), 3); break;
                case "raw_gold": p.Noise(0xE6C24A, 0.12f, 1); p.SpeckleColor(0.1f, Col.Hex(0xFFE88A), 3); break;
                default: MetalBlock(p, 0x999999); break;
            }
        }

        static void GemLamp(Px p, string g)
        {
            uint c = g == "ruby" ? 0xE0153Du : g == "sapphire" ? 0x2E5FE8u : g == "emerald" ? 0x17DD62u : 0xA571E6u;
            p.Noise(Mix(c, 0xFFFFFF, 0.25f), 0.04f, 1);
            p.Border(Col.Mul(Col.Hex(c), 0.6f));
            p.Rect(2, 2, 13, 13, Col.Mul(Col.Hex(c), 0.85f));
            p.Rect(4, 4, 11, 11, Col.Hex(Mix(c, 0xFFFFFF, 0.55f)));
            p.Rect(6, 6, 9, 9, Col.Hex(0xFFFFFF));
        }
    }
}
