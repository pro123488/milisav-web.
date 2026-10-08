using System;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Utilidades de color para dibujar texturas por codigo.</summary>
    public static class Col
    {
        public static Color32 Hex(uint rgb, byte a = 255)
        {
            return new Color32((byte)((rgb >> 16) & 255), (byte)((rgb >> 8) & 255), (byte)(rgb & 255), a);
        }

        public static Color32 Mul(Color32 c, float f)
        {
            return new Color32(Clamp(c.r * f), Clamp(c.g * f), Clamp(c.b * f), c.a);
        }

        public static Color32 Add(Color32 c, int d)
        {
            return new Color32(Clamp(c.r + d), Clamp(c.g + d), Clamp(c.b + d), c.a);
        }

        public static Color32 Lerp(Color32 a, Color32 b, float t)
        {
            return new Color32(Clamp(a.r + (b.r - a.r) * t), Clamp(a.g + (b.g - a.g) * t), Clamp(a.b + (b.b - a.b) * t), Clamp(a.a + (b.a - a.a) * t));
        }

        public static Color32 WithAlpha(Color32 c, int a) { return new Color32(c.r, c.g, c.b, (byte)a); }

        public static byte Clamp(float v) { return (byte)(v < 0 ? 0 : (v > 255 ? 255 : (int)(v + 0.5f))); }

        public static readonly Color32 Clear = new Color32(0, 0, 0, 0);
    }

    /// <summary>Lienzo de 16x16 (y=0 es la fila superior).</summary>
    public sealed class Px
    {
        public const int S = 16;
        public readonly Color32[] d = new Color32[S * S];
        public readonly int seed;

        public Px(int seed) { this.seed = seed; }

        public bool In(int x, int y) { return x >= 0 && y >= 0 && x < S && y < S; }
        public void Set(int x, int y, Color32 c) { if (In(x, y)) d[y * S + x] = c; }
        public Color32 Get(int x, int y) { return In(x, y) ? d[y * S + x] : Col.Clear; }
        public void Fill(Color32 c) { for (int i = 0; i < d.Length; i++) d[i] = c; }

        /// <summary>Ruido determinista 0..1 para el pixel.</summary>
        public float R(int x, int y, int salt = 0) { return MathX.Hash01(x, y, salt, seed); }

        public void Rect(int x0, int y0, int x1, int y1, Color32 c)
        {
            for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) Set(x, y, c);
        }

        public void HLine(int x0, int x1, int y, Color32 c) { for (int x = x0; x <= x1; x++) Set(x, y, c); }
        public void VLine(int x, int y0, int y1, Color32 c) { for (int y = y0; y <= y1; y++) Set(x, y, c); }

        public void Line(int x0, int y0, int x1, int y1, Color32 c)
        {
            int dx = Math.Abs(x1 - x0), dy = -Math.Abs(y1 - y0);
            int sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            int err = dx + dy;
            for (int i = 0; i < 64; i++)
            {
                Set(x0, y0, c);
                if (x0 == x1 && y0 == y1) break;
                int e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }

        public void Disc(float cx, float cy, float r, Color32 c)
        {
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
                    if (dx * dx + dy * dy <= r * r) Set(x, y, c);
                }
        }

        public void Ring(float cx, float cy, float r, float thick, Color32 c)
        {
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
                    float dd = (float)Math.Sqrt(dx * dx + dy * dy);
                    if (dd <= r && dd >= r - thick) Set(x, y, c);
                }
        }

        public void Ellipse(float cx, float cy, float rx, float ry, Color32 c)
        {
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f - cx) / rx, dy = (y + 0.5f - cy) / ry;
                    if (dx * dx + dy * dy <= 1f) Set(x, y, c);
                }
        }

        /// <summary>Rellena un poligono (par de coordenadas x,y).</summary>
        public void Poly(int[] pts, Color32 c)
        {
            int n = pts.Length / 2;
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float px = x + 0.5f, py = y + 0.5f;
                    bool inside = false;
                    for (int i = 0, j = n - 1; i < n; j = i++)
                    {
                        float xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
                        if (((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
                    }
                    if (inside) Set(x, y, c);
                }
        }

        /// <summary>Base con variacion de brillo por pixel.</summary>
        public void Noise(uint hex, float amp, int salt = 0)
        {
            var b = Col.Hex(hex);
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                    d[y * S + x] = Col.Mul(b, 1f + (R(x, y, salt) - 0.5f) * 2f * amp);
        }

        /// <summary>Oscurece/aclara pixeles al azar sobre lo ya dibujado.</summary>
        public void Speckle(float chance, float factor, int salt = 1)
        {
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                    if (R(x, y, salt) < chance && d[y * S + x].a > 0) d[y * S + x] = Col.Mul(d[y * S + x], factor);
        }

        public void SpeckleColor(float chance, Color32 c, int salt = 2)
        {
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                    if (R(x, y, salt) < chance) d[y * S + x] = c;
        }

        /// <summary>Contorno oscuro de 1px alrededor de los pixeles opacos.</summary>
        public void Outline(Color32 c)
        {
            var copy = (Color32[])d.Clone();
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    if (copy[y * S + x].a != 0) continue;
                    bool near = false;
                    for (int k = 0; k < 4 && !near; k++)
                    {
                        int nx = x + (k == 0 ? 1 : k == 1 ? -1 : 0), ny = y + (k == 2 ? 1 : k == 3 ? -1 : 0);
                        if (In(nx, ny) && copy[ny * S + nx].a != 0) near = true;
                    }
                    if (near) d[y * S + x] = c;
                }
        }

        public void Border(Color32 c)
        {
            for (int i = 0; i < S; i++) { Set(i, 0, c); Set(i, S - 1, c); Set(0, i, c); Set(S - 1, i, c); }
        }

        /// <summary>Copia otro lienzo encima (respeta transparencia).</summary>
        public void Overlay(Px o)
        {
            for (int i = 0; i < d.Length; i++) if (o.d[i].a > 0) d[i] = o.d[i];
        }
    }
}
