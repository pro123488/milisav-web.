using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Genera los iconos de 16x16 de los items y de la interfaz.</summary>
    public static class IconGen
    {
        static readonly Color32 Stick = new Color32(0x8B, 0x5E, 0x2B, 255);
        static readonly Color32 StickDark = new Color32(0x5E, 0x3E, 0x18, 255);
        static readonly Color32 OutlineC = new Color32(0x1C, 0x14, 0x10, 255);

        static uint ParseHex(string s)
        {
            if (s.StartsWith("0x")) s = s.Substring(2);
            return Convert.ToUInt32(s, 16);
        }

        static void Arc(Px p, float cx, float cy, float r, float a0, float a1, Color32 c, bool thick)
        {
            for (float a = a0; a <= a1; a += 2f)
            {
                float rad = a * Mathf.Deg2Rad;
                int x = (int)Math.Round(cx + Math.Cos(rad) * r), y = (int)Math.Round(cy + Math.Sin(rad) * r);
                p.Set(x, y, c);
                if (thick) { p.Set(x + 1, y, c); p.Set(x, y + 1, Col.Mul(c, 0.8f)); }
            }
        }

        public static Color32[] PaintItem(Item it)
        {
            var p = new Px(it.key.GetHashCode());
            if (it.kind == ItemKind.Block && it.block != null) { PaintBlockIcon(p, it.block); return p.d; }
            try { Spec(p, it.iconSpec ?? "stick"); }
            catch (Exception e) { Debug.LogWarning("Icono " + it.key + ": " + e.Message); p.Fill(Col.Hex(0xFF00FF)); }
            return p.d;
        }

        // ------------------ bloques ------------------
        static Color32 Sample(int tile, float u, float v, Tint tint, bool tintThis)
        {
            int col = tile % TileAtlas.Cols, row = tile / TileAtlas.Cols;
            int x = Mathf.Clamp((int)(u * 16), 0, 15), y = Mathf.Clamp((int)(v * 16), 0, 15);
            var c = TileAtlas.AtlasPixels[(row * 16 + (15 - y)) * TileAtlas.Width + col * 16 + x];
            if (tintThis && tint != Tint.None)
            {
                uint t = tint == Tint.Grass ? 0x8CC060u : tint == Tint.Foliage ? 0x6FB34Au : 0x3F76E4u;
                c = new Color32((byte)(c.r * ((t >> 16) & 255) / 255), (byte)(c.g * ((t >> 8) & 255) / 255), (byte)(c.b * (t & 255) / 255), c.a);
            }
            return c;
        }

        static void PaintBlockIcon(Px p, Block b)
        {
            if (b.shape == Shape.Cross || b.shape == Shape.Torch || b.shape == Shape.Crop || b.shape == Shape.Door)
            {
                int tile = b.shape == Shape.Crop ? b.tex[3] : b.tex[0];
                bool tinted = b.tint != Tint.None;
                if (b.shape == Shape.Door)
                {
                    for (int y = 0; y < 16; y++) for (int x = 2; x < 14; x++) p.Set(x, y, Sample(y < 8 ? b.tex[1] : b.tex[0], (x - 2) / 12f, (y % 8) / 8f * 0.5f + (y < 8 ? 0.5f : 0f), Tint.None, false));
                    p.Outline(OutlineC);
                    return;
                }
                for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) p.Set(x, y, Sample(tile, (x + 0.5f) / 16f, (y + 0.5f) / 16f, b.tint, tinted));
                return;
            }
            float hgt = b.shape == Shape.Slab ? 0.5f : (b.shape == Shape.Box && b.height < 0.99f ? Mathf.Max(0.3f, b.height) : 1f);
            for (int py = 0; py < 16; py++)
            {
                for (int px = 0; px < 16; px++)
                {
                    float sx = px + 0.5f, sy = py + 0.5f;
                    float yoff = 8f * (1f - hgt);
                    float a = (sx - 8f) / 8f, bb = (sy - yoff) / 4f;
                    float x = (a + bb) * 0.5f, z = (bb - a) * 0.5f;
                    if (x >= 0 && x <= 1 && z >= 0 && z <= 1)
                    {
                        p.Set(px, py, Sample(b.tex[2], x, z, b.tint, (b.tintMask & 4) != 0)); continue;
                    }
                    if (sx < 8f)
                    {
                        float xx = sx / 8f;
                        float ty = (sy - 4f * (xx + 1f) - yoff) / (8f * hgt);
                        if (xx >= 0 && xx <= 1 && ty >= 0 && ty <= 1)
                        {
                            var c = Sample(b.tex[b.oriented ? 6 : 4], xx, hgt < 1f ? 0.5f + 0.5f * ty : ty, b.tint, (b.tintMask & 16) != 0);
                            p.Set(px, py, Col.Mul(c, 0.82f)); continue;
                        }
                    }
                    else
                    {
                        float zz = (16f - sx) / 8f;
                        float ty = (sy - 4f * (1f + zz) - yoff) / (8f * hgt);
                        if (zz >= 0 && zz <= 1 && ty >= 0 && ty <= 1)
                        {
                            var c = Sample(b.tex[0], 1f - zz, hgt < 1f ? 0.5f + 0.5f * ty : ty, b.tint, (b.tintMask & 1) != 0);
                            p.Set(px, py, Col.Mul(c, 0.64f));
                        }
                    }
                }
            }
        }

        // ------------------ items ------------------
        static void Spec(Px p, string spec)
        {
            var parts = spec.Split('|');
            string shape = parts[0];
            Tier tier = null; uint hex = 0; bool hasHex = false;
            if (parts.Length > 1)
            {
                tier = Tiers.Get(parts[1]);
                if (tier == null) { hex = ParseHex(parts[1]); hasHex = true; }
            }
            Color32 M, L, D;
            if (tier != null) { M = Col.Hex(tier.main); L = Col.Hex(tier.light); D = Col.Hex(tier.dark); }
            else if (hasHex) { M = Col.Hex(hex); L = Col.Mul(M, 1.3f); D = Col.Mul(M, 0.65f); }
            else { M = Col.Hex(0xAAAAAA); L = Col.Hex(0xDDDDDD); D = Col.Hex(0x777777); }

            switch (shape)
            {
                case "pickaxe":
                    p.Line(2, 14, 10, 6, Stick); p.Line(3, 14, 11, 6, StickDark);
                    Arc(p, 6f, 9f, 7f, -85f, 12f, M, true); Arc(p, 6f, 9f, 8f, -75f, -10f, L, false);
                    p.Outline(OutlineC); break;
                case "axe":
                    p.Line(2, 14, 11, 5, Stick); p.Line(3, 14, 12, 5, StickDark);
                    p.Poly(new[] { 7, 3, 12, 1, 15, 5, 12, 9, 9, 8 }, M);
                    p.Line(7, 3, 12, 1, L); p.Line(12, 1, 15, 5, L); p.Line(9, 8, 12, 9, D); p.Line(12, 9, 15, 5, D);
                    p.Outline(OutlineC); break;
                case "shovel":
                    p.Line(2, 14, 10, 6, Stick); p.Line(3, 14, 11, 6, StickDark);
                    p.Ellipse(12f, 4f, 2.8f, 3.6f, M); p.Line(11, 1, 14, 3, L); p.Line(10, 5, 13, 7, D);
                    p.Outline(OutlineC); break;
                case "hoe":
                    p.Line(2, 14, 11, 5, Stick); p.Line(3, 14, 12, 5, StickDark);
                    p.Poly(new[] { 7, 2, 14, 2, 14, 7, 12, 7, 12, 4, 7, 4 }, M);
                    p.HLine(7, 14, 2, L); p.VLine(14, 2, 7, D);
                    p.Outline(OutlineC); break;
                case "sword":
                    p.Line(4, 11, 13, 2, M); p.Line(3, 11, 12, 2, L); p.Line(5, 11, 14, 2, D); p.Line(4, 10, 12, 2, L);
                    p.Line(2, 8, 7, 13, StickDark); p.Line(2, 9, 6, 13, Stick);
                    p.Line(1, 14, 4, 11, Stick); p.Set(1, 14, D);
                    p.Outline(OutlineC); break;
                case "helmet":
                    p.Ellipse(8f, 7f, 5.5f, 5f, M); p.Rect(2, 8, 13, 12, M); p.Rect(5, 9, 10, 12, Col.Clear);
                    p.Set(4, 3, L); p.Set(5, 2, L); p.Line(3, 6, 3, 11, L); p.Line(12, 6, 12, 11, D); p.Rect(5, 9, 10, 9, D);
                    p.Outline(OutlineC); break;
                case "chestplate":
                    p.Poly(new[] { 2, 2, 6, 2, 8, 5, 10, 2, 14, 2, 15, 7, 12, 8, 12, 14, 4, 14, 4, 8, 1, 7 }, M);
                    p.Line(5, 3, 7, 5, D); p.Line(11, 3, 9, 5, D); p.VLine(8, 6, 13, D); p.VLine(5, 9, 13, L); p.VLine(11, 9, 13, D);
                    p.Line(2, 2, 1, 7, L);
                    p.Outline(OutlineC); break;
                case "leggings":
                    p.Rect(3, 2, 12, 5, M); p.Rect(3, 6, 6, 14, M); p.Rect(9, 6, 12, 14, M);
                    p.HLine(3, 12, 2, L); p.VLine(3, 2, 14, L); p.VLine(12, 2, 14, D); p.VLine(6, 6, 14, D); p.HLine(3, 12, 5, D);
                    p.Outline(OutlineC); break;
                case "boots":
                    p.Rect(2, 5, 6, 11, M); p.Rect(2, 11, 8, 13, M); p.Rect(9, 5, 13, 11, M); p.Rect(9, 11, 15, 13, M);
                    p.HLine(2, 6, 5, L); p.HLine(9, 13, 5, L); p.HLine(2, 8, 13, D); p.HLine(9, 15, 13, D); p.VLine(6, 5, 11, D); p.VLine(13, 5, 11, D);
                    p.Outline(OutlineC); break;
                case "ingot":
                    p.Poly(new[] { 2, 9, 9, 4, 14, 6, 7, 11 }, L); p.Poly(new[] { 2, 9, 7, 11, 7, 14, 2, 12 }, M); p.Poly(new[] { 7, 11, 14, 6, 14, 9, 7, 14 }, D);
                    p.Outline(OutlineC); break;
                case "gem":
                    p.Poly(new[] { 8, 1, 14, 6, 8, 15, 2, 6 }, M); p.Poly(new[] { 8, 1, 14, 6, 8, 7, 2, 6 }, L);
                    p.Poly(new[] { 8, 7, 14, 6, 8, 15 }, D); p.Set(5, 4, Col.Hex(0xFFFFFF)); p.Set(6, 3, Col.Hex(0xFFFFFF)); p.Set(9, 11, Col.Mul(L, 1.1f));
                    p.Outline(OutlineC); break;
                case "shard":
                    p.Poly(new[] { 8, 1, 12, 5, 10, 14, 6, 14, 4, 5 }, M); p.Poly(new[] { 8, 1, 12, 5, 8, 7, 4, 5 }, L); p.Poly(new[] { 8, 7, 12, 5, 10, 14, 8, 14 }, D);
                    p.Outline(OutlineC); break;
                case "dust":
                    p.Ellipse(8f, 11f, 6f, 3f, D); p.Ellipse(8f, 10f, 5f, 3f, M); p.Ellipse(8f, 8.5f, 3f, 2f, L);
                    for (int i = 0; i < 6; i++) p.Set(4 + i * 2, 12 - (i % 2), L);
                    p.Outline(OutlineC); break;
                case "lump":
                    p.Poly(new[] { 3, 8, 6, 3, 11, 3, 14, 7, 13, 12, 8, 14, 4, 12 }, M); p.Poly(new[] { 6, 4, 11, 4, 12, 7, 7, 7 }, L);
                    p.Poly(new[] { 8, 11, 13, 12, 8, 14, 4, 12 }, D); p.SpeckleColor(0.06f, L, 4);
                    p.Outline(OutlineC); break;
                case "coal":
                    p.Poly(new[] { 3, 8, 6, 3, 11, 3, 14, 7, 13, 12, 8, 14, 4, 12 }, Col.Hex(0x2A2A2A)); p.Poly(new[] { 6, 4, 11, 4, 12, 7, 7, 7 }, Col.Hex(0x4A4A4A));
                    p.Set(8, 5, Col.Hex(0x6A6A6A)); p.Outline(Col.Hex(0x0A0A0A)); break;
                case "charcoal":
                    p.Poly(new[] { 3, 8, 6, 3, 11, 3, 14, 7, 13, 12, 8, 14, 4, 12 }, Col.Hex(0x3A2A24)); p.Poly(new[] { 6, 4, 11, 4, 12, 7, 7, 7 }, Col.Hex(0x5A463C));
                    p.Outline(Col.Hex(0x0A0A0A)); break;
                case "stick":
                    p.Line(3, 13, 12, 4, Stick); p.Line(4, 13, 13, 4, StickDark); p.Outline(OutlineC); break;
                case "flint":
                    p.Poly(new[] { 3, 12, 6, 4, 10, 2, 13, 8, 11, 13 }, Col.Hex(0x4A4A4E)); p.Poly(new[] { 6, 4, 10, 2, 10, 7, 7, 8 }, Col.Hex(0x6E6E74));
                    p.Outline(OutlineC); break;
                case "feather":
                    p.Line(3, 14, 12, 2, Col.Hex(0xF0F0F0)); for (int i = 0; i < 6; i++) { p.Line(4 + i, 12 - i * 2, 7 + i, 11 - i * 2, Col.Hex(0xE0E0E0)); p.Line(4 + i, 12 - i * 2, 2 + i, 10 - i * 2, Col.Hex(0xCFCFCF)); }
                    p.Outline(Col.Hex(0x707070)); break;
                case "leather":
                    p.Poly(new[] { 3, 3, 13, 3, 14, 8, 12, 13, 4, 13, 2, 8 }, Col.Hex(0xA0652D)); p.Poly(new[] { 4, 4, 12, 4, 12, 7, 4, 7 }, Col.Hex(0xB57A3D));
                    p.Line(5, 12, 11, 12, Col.Hex(0x70401A)); p.Outline(OutlineC); break;
                case "string":
                    for (int x = 1; x < 15; x++) p.Set(x, 8 + (int)Math.Round(Math.Sin(x * 0.7) * 3), Col.Hex(0xEEEEEE));
                    p.Outline(Col.Hex(0x707070)); break;
                case "bone":
                    p.Line(4, 12, 12, 4, Col.Hex(0xEEEEDD)); p.Line(5, 12, 12, 5, Col.Hex(0xCFCFB8));
                    p.Rect(2, 11, 4, 13, Col.Hex(0xEEEEDD)); p.Rect(11, 2, 13, 4, Col.Hex(0xEEEEDD)); p.Rect(10, 3, 12, 5, Col.Hex(0xEEEEDD)); p.Rect(3, 10, 5, 12, Col.Hex(0xEEEEDD));
                    p.Outline(OutlineC); break;
                case "slime":
                    p.Ellipse(8f, 9f, 5.5f, 4.8f, Col.Hex(0x6FCF4A)); p.Ellipse(8f, 9f, 3.5f, 3f, Col.Hex(0x8FE86A)); p.Set(6, 7, Col.Hex(0xE8FFD8)); p.Outline(Col.Hex(0x2A6A1A)); break;
                case "pearl":
                    p.Disc(8f, 8f, 5.5f, D); p.Disc(7.5f, 7.5f, 4.2f, M); p.Disc(6.5f, 6.5f, 2.2f, L); p.Set(5, 5, Col.Hex(0xFFFFFF)); p.Outline(OutlineC); break;
                case "rod":
                    p.Line(3, 13, 12, 4, M); p.Line(4, 13, 13, 4, D); p.Line(2, 13, 11, 4, L); p.Outline(OutlineC); break;
                case "paper":
                    p.Rect(3, 2, 12, 13, Col.Hex(0xF4F4EC)); p.HLine(4, 11, 5, Col.Hex(0xB0B0A8)); p.HLine(4, 11, 7, Col.Hex(0xB0B0A8)); p.HLine(4, 9, 9, Col.Hex(0xB0B0A8)); p.Outline(Col.Hex(0x707068)); break;
                case "book":
                    p.Rect(3, 2, 12, 13, Col.Hex(0x8A4A2A)); p.Rect(4, 3, 11, 12, Col.Hex(0xC8683A)); p.Rect(3, 2, 4, 13, Col.Hex(0x6A3418)); p.Rect(6, 5, 9, 7, Col.Hex(0xF0E0A0)); p.Outline(OutlineC); break;
                case "bowl":
                    p.Poly(new[] { 2, 7, 14, 7, 12, 12, 4, 12 }, Col.Hex(0x8A6A3A)); p.HLine(2, 13, 7, Col.Hex(0x5A3F1A)); p.HLine(4, 11, 12, Col.Hex(0x5A3F1A)); p.Outline(OutlineC); break;
                case "clay":
                    p.Disc(8f, 8f, 5f, Col.Hex(0x8A92A8)); p.Disc(7f, 7f, 3f, Col.Hex(0xA0A8BC)); p.Outline(OutlineC); break;
                case "brick":
                    p.Poly(new[] { 2, 6, 11, 4, 14, 7, 14, 10, 5, 12, 2, 9 }, M); p.Poly(new[] { 2, 6, 11, 4, 14, 7, 5, 9 }, L); p.Outline(OutlineC); break;
                case "snowball":
                    p.Disc(8f, 8f, 5f, Col.Hex(0xDDE8F0)); p.Disc(7f, 7f, 3.2f, Col.Hex(0xFFFFFF)); p.Outline(Col.Hex(0x707880)); break;
                case "egg":
                    p.Ellipse(8f, 8.5f, 4.2f, 5.4f, Col.Hex(0xE8DCC0)); p.Ellipse(7f, 7f, 2f, 2.6f, Col.Hex(0xF8F0E0)); p.Outline(Col.Hex(0x70604A)); break;
                case "wheat":
                    for (int i = 0; i < 3; i++) { int x = 4 + i * 3; p.VLine(x, 4, 14, Col.Hex(0xC8A428)); for (int k = 0; k < 4; k++) { p.Set(x - 1, 3 + k * 2, Col.Hex(0xE8C848)); p.Set(x + 1, 4 + k * 2, Col.Hex(0xE8C848)); } }
                    p.Outline(OutlineC); break;
                case "fluff":
                    p.Disc(5f, 9f, 3.5f, Col.Hex(0xF4F8FF)); p.Disc(10f, 8f, 4.2f, Col.Hex(0xFFFFFF)); p.Disc(8f, 11f, 3.5f, Col.Hex(0xE4ECFA)); p.Outline(Col.Hex(0x8090A8)); break;
                case "essence":
                    p.Disc(8f, 9f, 4f, Col.Hex(0x58D8E8)); p.Disc(8f, 8f, 2.4f, Col.Hex(0xC8FCFF)); p.Poly(new[] { 8, 1, 10, 6, 6, 6 }, Col.Hex(0x58D8E8)); p.Outline(Col.Hex(0x1A5A6A)); break;
                case "scale":
                    p.Poly(new[] { 8, 1, 14, 5, 14, 11, 8, 15, 2, 11, 2, 5 }, M); p.Poly(new[] { 8, 1, 14, 5, 8, 8, 2, 5 }, L); p.Outline(OutlineC); break;
                case "heart_item":
                    p.Poly(new[] { 8, 14, 1, 7, 1, 4, 3, 2, 6, 2, 8, 4, 10, 2, 13, 2, 15, 4, 15, 7 }, Col.Hex(0x9A3AE0)); p.Poly(new[] { 3, 3, 6, 3, 7, 5, 4, 6 }, Col.Hex(0xD8A0FF)); p.Outline(OutlineC); break;
                case "seeds":
                    for (int i = 0; i < 8; i++) { int x = 4 + (i * 5) % 9, y = 5 + (i * 3) % 8; p.Set(x, y, M); p.Set(x + 1, y, D); p.Set(x, y + 1, M); }
                    p.Outline(Col.Hex(0x101010)); break;
                case "apple":
                    p.Disc(8f, 9f, 5f, Col.Hex(0xD02828)); p.Disc(6.5f, 7.5f, 2f, Col.Hex(0xF05050)); p.Line(8, 4, 8, 2, StickDark); p.Poly(new[] { 9, 3, 12, 2, 11, 5 }, Col.Hex(0x4C9A2A)); p.Outline(OutlineC); break;
                case "golden_apple":
                    p.Disc(8f, 9f, 5f, Col.Hex(0xF4C820)); p.Disc(6.5f, 7.5f, 2f, Col.Hex(0xFFF090)); p.Line(8, 4, 8, 2, StickDark); p.Poly(new[] { 9, 3, 12, 2, 11, 5 }, Col.Hex(0x4C9A2A)); p.Outline(OutlineC); break;
                case "bread":
                    p.Ellipse(8f, 9f, 6.5f, 4f, Col.Hex(0xC98A3A)); p.Ellipse(8f, 8f, 5.5f, 3f, Col.Hex(0xE0A850)); p.Line(5, 6, 6, 10, Col.Hex(0xB0702A)); p.Line(8, 5, 9, 10, Col.Hex(0xB0702A)); p.Line(11, 6, 12, 10, Col.Hex(0xB0702A)); p.Outline(OutlineC); break;
                case "meat":
                    p.Ellipse(9f, 7f, 5.5f, 4.5f, M); p.Ellipse(8f, 6f, 3.5f, 2.5f, L); p.Line(3, 13, 7, 9, Col.Hex(0xEEEEDD)); p.Rect(2, 12, 4, 14, Col.Hex(0xEEEEDD)); p.Outline(OutlineC); break;
                case "fish":
                    p.Ellipse(7f, 8f, 5.5f, 3.4f, M); p.Poly(new[] { 11, 8, 15, 4, 15, 12 }, D); p.Set(4, 7, Col.Hex(0x101010)); p.Ellipse(6f, 9.5f, 3f, 1.2f, Col.Mul(M, 1.25f)); p.Outline(OutlineC); break;
                case "carrot":
                    p.Poly(new[] { 3, 4, 13, 12, 12, 14, 2, 6 }, Col.Hex(0xE8782A)); p.Line(4, 5, 11, 12, Col.Hex(0xF59A4A)); p.Line(3, 4, 1, 1, Col.Hex(0x4C9A2A)); p.Line(3, 4, 3, 0, Col.Hex(0x6CBA3A)); p.Line(3, 4, 0, 3, Col.Hex(0x4C9A2A)); p.Outline(OutlineC); break;
                case "carrot_gold":
                    p.Poly(new[] { 3, 4, 13, 12, 12, 14, 2, 6 }, Col.Hex(0xF4C820)); p.Line(4, 5, 11, 12, Col.Hex(0xFFF090)); p.Line(3, 4, 1, 1, Col.Hex(0x4C9A2A)); p.Line(3, 4, 3, 0, Col.Hex(0x6CBA3A)); p.Outline(OutlineC); break;
                case "potato":
                    p.Ellipse(8f, 9f, 5.8f, 4.4f, Col.Hex(0xC9A45A)); p.Ellipse(7f, 8f, 3f, 2f, Col.Hex(0xDDBB70)); p.Set(5, 10, Col.Hex(0x8A6A30)); p.Set(10, 8, Col.Hex(0x8A6A30)); p.Outline(OutlineC); break;
                case "potato_baked":
                    p.Ellipse(8f, 9f, 5.8f, 4.4f, Col.Hex(0xB07A30)); p.Ellipse(8f, 7.5f, 3.5f, 1.6f, Col.Hex(0xF4E8A0)); p.Outline(OutlineC); break;
                case "beet":
                    p.Disc(8f, 10f, 4.5f, Col.Hex(0x9A1E3A)); p.Disc(7f, 9f, 2f, Col.Hex(0xC03050)); p.Poly(new[] { 8, 6, 5, 1, 8, 3, 11, 1 }, Col.Hex(0x4C9A2A)); p.Outline(OutlineC); break;
                case "tomato":
                    p.Disc(8f, 9f, 5f, Col.Hex(0xD02A22)); p.Disc(6.5f, 7.5f, 1.8f, Col.Hex(0xF05848)); p.Poly(new[] { 8, 3, 11, 5, 8, 6, 5, 5 }, Col.Hex(0x3E8A2A)); p.Outline(OutlineC); break;
                case "melon_slice":
                    p.Poly(new[] { 1, 6, 15, 6, 12, 14, 4, 14 }, Col.Hex(0x3E8A2A)); p.Poly(new[] { 2, 7, 14, 7, 11, 12, 5, 12 }, Col.Hex(0xE8484A)); p.Set(6, 9, Col.Hex(0x202020)); p.Set(9, 9, Col.Hex(0x202020)); p.Set(8, 11, Col.Hex(0x202020)); p.Outline(OutlineC); break;
                case "pie":
                    p.Ellipse(8f, 9f, 6.5f, 4.5f, Col.Hex(0xC98A3A)); p.Ellipse(8f, 8f, 5f, 3.2f, Col.Hex(0xE08A1A)); p.Set(6, 8, Col.Hex(0xF8D0A0)); p.Set(10, 7, Col.Hex(0xF8D0A0)); p.Outline(OutlineC); break;
                case "cookie":
                    p.Disc(8f, 8f, 5.5f, Col.Hex(0xC98A3A)); p.Set(5, 6, Col.Hex(0x4A2A18)); p.Set(9, 5, Col.Hex(0x4A2A18)); p.Set(7, 9, Col.Hex(0x4A2A18)); p.Set(11, 9, Col.Hex(0x4A2A18)); p.Set(6, 11, Col.Hex(0x4A2A18)); p.Outline(OutlineC); break;
                case "stew":
                    p.Poly(new[] { 2, 7, 14, 7, 12, 13, 4, 13 }, Col.Hex(0x8A6A3A)); p.Ellipse(8f, 7f, 6f, 2f, M); p.HLine(4, 11, 13, Col.Hex(0x5A3F1A)); p.Set(6, 7, L); p.Set(9, 6, L); p.Outline(OutlineC); break;
                case "sandwich":
                    p.Poly(new[] { 2, 5, 14, 5, 14, 7, 2, 7 }, Col.Hex(0xE0A850)); p.Rect(2, 7, 13, 8, Col.Hex(0x4C9A2A)); p.Rect(2, 9, 13, 10, Col.Hex(0xD02A22)); p.Rect(2, 11, 13, 12, Col.Hex(0xC04040)); p.Rect(2, 13, 13, 14, Col.Hex(0xE0A850)); p.Outline(OutlineC); break;
                case "eye":
                    p.Disc(8f, 8f, 5f, Col.Hex(0xE8E0E0)); p.Disc(8f, 8f, 3f, M); p.Disc(8f, 8f, 1.3f, Col.Hex(0x101010)); p.Outline(OutlineC); break;
                case "eye_end":
                    p.Disc(8f, 8f, 5.5f, Col.Hex(0x1E7A5A)); p.Disc(8f, 8f, 4f, Col.Hex(0x58E0A8)); p.Disc(8f, 8f, 2.2f, Col.Hex(0x0A2A1E)); p.Set(7, 7, Col.Hex(0xFFFFFF)); p.Outline(OutlineC); break;
                case "bucket":
                    p.Poly(new[] { 3, 4, 13, 4, 11, 14, 5, 14 }, Col.Hex(0xAAAAAA)); p.Poly(new[] { 4, 5, 6, 5, 7, 13, 5, 13 }, Col.Hex(0xD8D8D8)); p.HLine(3, 12, 4, Col.Hex(0x666666));
                    if (hasHex && hex != 0) p.Poly(new[] { 4, 6, 12, 6, 11, 8, 5, 8 }, M);
                    p.Outline(OutlineC); break;
                case "shears":
                    p.Line(3, 13, 11, 4, Col.Hex(0xCFCFCF)); p.Line(13, 13, 5, 4, Col.Hex(0xAAAAAA)); p.Rect(1, 12, 4, 15, Col.Hex(0xC03030)); p.Rect(11, 12, 14, 15, Col.Hex(0xA02020)); p.Outline(OutlineC); break;
                case "bow":
                    Arc(p, 4f, 8f, 8f, -70f, 70f, Stick, true); p.Line(8, 1, 8, 15, Col.Hex(0xEEEEEE)); p.Outline(OutlineC); break;
                case "arrow":
                    p.Line(2, 14, 12, 4, Stick); p.Poly(new[] { 11, 1, 15, 5, 11, 5 }, Col.Hex(0x9A9A9A)); p.Line(2, 14, 1, 11, Col.Hex(0xF0F0F0)); p.Line(2, 14, 5, 15, Col.Hex(0xF0F0F0)); p.Line(3, 13, 2, 10, Col.Hex(0xE0E0E0)); p.Outline(OutlineC); break;
                case "flint_steel":
                    p.Rect(2, 8, 9, 13, Col.Hex(0x9A9A9A)); p.Rect(3, 9, 8, 12, Col.Hex(0x707070)); p.Poly(new[] { 9, 3, 14, 6, 12, 11, 8, 8 }, Col.Hex(0x4A4A4E)); p.Outline(OutlineC); break;
                default:
                    p.Fill(Col.Hex(0xFF00FF)); break;
            }
        }

        // ------------------ iconos de interfaz ------------------
        public static readonly string[] UiNames =
        {
            "ui_heart_full", "ui_heart_half", "ui_heart_empty", "ui_food_full", "ui_food_half", "ui_food_empty",
            "ui_bubble", "ui_armor", "ui_armor_half", "ui_armor_empty", "ui_slot_sel"
        };

        public static Color32[] PaintUi(string name)
        {
            var p = new Px(name.GetHashCode());
            var heart = new[] { 8, 14, 1, 7, 1, 4, 3, 2, 6, 2, 8, 4, 10, 2, 13, 2, 15, 4, 15, 7 };
            switch (name)
            {
                case "ui_heart_full":
                    p.Poly(heart, Col.Hex(0xE02020)); p.Poly(new[] { 3, 3, 6, 3, 7, 5, 4, 6 }, Col.Hex(0xFF8080)); p.Outline(Col.Hex(0x300808)); break;
                case "ui_heart_half":
                    p.Poly(heart, Col.Hex(0x3A2A2A));
                    for (int y = 0; y < 16; y++) for (int x = 8; x < 16; x++) { }
                    { var r = new Px(1); r.Poly(heart, Col.Hex(0xE02020)); r.Poly(new[] { 3, 3, 6, 3, 7, 5, 4, 6 }, Col.Hex(0xFF8080)); for (int y = 0; y < 16; y++) for (int x = 0; x < 8; x++) { var c = r.Get(x, y); if (c.a > 0) p.Set(x, y, c); } }
                    p.Outline(Col.Hex(0x300808)); break;
                case "ui_heart_empty":
                    p.Poly(heart, Col.Hex(0x3A2A2A)); p.Outline(Col.Hex(0x100808)); break;
                case "ui_food_full":
                    Drum(p, Col.Hex(0xC8783A), Col.Hex(0xE8A060)); break;
                case "ui_food_half":
                    Drum(p, Col.Hex(0x3A2A2A), Col.Hex(0x3A2A2A));
                    { var r = new Px(1); Drum(r, Col.Hex(0xC8783A), Col.Hex(0xE8A060)); for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) { var c = r.Get(x, y); if (c.a > 0 && x + (15 - y) < 16) p.Set(x, y, c); } }
                    break;
                case "ui_food_empty":
                    Drum(p, Col.Hex(0x3A2A2A), Col.Hex(0x3A2A2A)); break;
                case "ui_bubble":
                    p.Disc(8f, 8f, 6f, Col.Hex(0x8AB8FF, 140)); p.Ring(8f, 8f, 6f, 1.2f, Col.Hex(0xE0F0FF)); p.Set(5, 5, Col.Hex(0xFFFFFF)); p.Set(6, 4, Col.Hex(0xFFFFFF)); break;
                case "ui_armor":
                    p.Poly(new[] { 2, 2, 6, 2, 8, 5, 10, 2, 14, 2, 15, 7, 12, 8, 12, 14, 4, 14, 4, 8, 1, 7 }, Col.Hex(0xC8C8D0)); p.Line(8, 6, 8, 13, Col.Hex(0x8A8A94)); p.Outline(Col.Hex(0x202028)); break;
                case "ui_armor_half":
                    p.Poly(new[] { 2, 2, 6, 2, 8, 5, 10, 2, 14, 2, 15, 7, 12, 8, 12, 14, 4, 14, 4, 8, 1, 7 }, Col.Hex(0x303038));
                    { var r = new Px(1); r.Poly(new[] { 2, 2, 6, 2, 8, 5, 10, 2, 14, 2, 15, 7, 12, 8, 12, 14, 4, 14, 4, 8, 1, 7 }, Col.Hex(0xC8C8D0)); for (int y = 0; y < 16; y++) for (int x = 0; x < 8; x++) { var c = r.Get(x, y); if (c.a > 0) p.Set(x, y, c); } }
                    p.Outline(Col.Hex(0x101018)); break;
                case "ui_armor_empty":
                    p.Poly(new[] { 2, 2, 6, 2, 8, 5, 10, 2, 14, 2, 15, 7, 12, 8, 12, 14, 4, 14, 4, 8, 1, 7 }, Col.Hex(0x303038)); p.Outline(Col.Hex(0x101018)); break;
                default:
                    p.Border(Col.Hex(0xFFFFFF)); break;
            }
            return p.d;
        }

        static void Drum(Px p, Color32 meat, Color32 hi)
        {
            p.Disc(10f, 6f, 5f, meat); p.Disc(9f, 5f, 2f, hi);
            p.Line(7, 9, 3, 13, Col.Hex(0xEEEEDD)); p.Rect(2, 12, 4, 14, Col.Hex(0xEEEEDD)); p.Rect(1, 13, 3, 15, Col.Hex(0xEEEEDD));
            p.Outline(Col.Hex(0x300808));
        }
    }
}
