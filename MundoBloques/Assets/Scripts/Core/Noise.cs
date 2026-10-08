using System;

namespace MundoBloques
{
    /// <summary>Ruido de gradiente (Perlin mejorado) con semilla. Seguro para usar en hilos.</summary>
    public sealed class Noise
    {
        readonly byte[] p = new byte[512];

        public Noise(int seed)
        {
            var r = new Random(seed);
            var perm = new byte[256];
            for (int i = 0; i < 256; i++) perm[i] = (byte)i;
            for (int i = 255; i > 0; i--)
            {
                int j = r.Next(i + 1);
                byte t = perm[i]; perm[i] = perm[j]; perm[j] = t;
            }
            for (int i = 0; i < 512; i++) p[i] = perm[i & 255];
        }

        static float Fade(float t) { return t * t * t * (t * (t * 6f - 15f) + 10f); }
        static float Lerp(float a, float b, float t) { return a + (b - a) * t; }
        static int Fl(float v) { int i = (int)v; return v < i ? i - 1 : i; }

        static float Grad2(int h, float x, float y)
        {
            switch (h & 7)
            {
                case 0: return x + y;
                case 1: return -x + y;
                case 2: return x - y;
                case 3: return -x - y;
                case 4: return x;
                case 5: return -x;
                case 6: return y;
                default: return -y;
            }
        }

        static float Grad3(int h, float x, float y, float z)
        {
            h &= 15;
            float u = h < 8 ? x : y;
            float v = h < 4 ? y : (h == 12 || h == 14 ? x : z);
            return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
        }

        /// <summary>Ruido 2D en aproximadamente [-1,1].</summary>
        public float Perlin(float x, float y)
        {
            int xi = Fl(x), yi = Fl(y);
            float xf = x - xi, yf = y - yi;
            xi &= 255; yi &= 255;
            float u = Fade(xf), v = Fade(yf);
            int aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1];
            int ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
            float x1 = Lerp(Grad2(aa, xf, yf), Grad2(ba, xf - 1, yf), u);
            float x2 = Lerp(Grad2(ab, xf, yf - 1), Grad2(bb, xf - 1, yf - 1), u);
            return Lerp(x1, x2, v) * 0.7f;
        }

        /// <summary>Ruido 3D en aproximadamente [-1,1].</summary>
        public float Perlin(float x, float y, float z)
        {
            int xi = Fl(x), yi = Fl(y), zi = Fl(z);
            float xf = x - xi, yf = y - yi, zf = z - zi;
            xi &= 255; yi &= 255; zi &= 255;
            float u = Fade(xf), v = Fade(yf), w = Fade(zf);
            int a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi;
            int b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
            float r = Lerp(
                Lerp(Lerp(Grad3(p[aa], xf, yf, zf), Grad3(p[ba], xf - 1, yf, zf), u),
                     Lerp(Grad3(p[ab], xf, yf - 1, zf), Grad3(p[bb], xf - 1, yf - 1, zf), u), v),
                Lerp(Lerp(Grad3(p[aa + 1], xf, yf, zf - 1), Grad3(p[ba + 1], xf - 1, yf, zf - 1), u),
                     Lerp(Grad3(p[ab + 1], xf, yf - 1, zf - 1), Grad3(p[bb + 1], xf - 1, yf - 1, zf - 1), u), v),
                w);
            return r * 0.95f;
        }

        public float Fbm(float x, float y, int octaves, float lacunarity = 2f, float gain = 0.5f)
        {
            float sum = 0, amp = 1, norm = 0, f = 1;
            for (int i = 0; i < octaves; i++)
            {
                sum += Perlin(x * f + i * 31.7f, y * f - i * 17.3f) * amp;
                norm += amp; amp *= gain; f *= lacunarity;
            }
            return sum / norm;
        }

        public float Fbm(float x, float y, float z, int octaves, float lacunarity = 2f, float gain = 0.5f)
        {
            float sum = 0, amp = 1, norm = 0, f = 1;
            for (int i = 0; i < octaves; i++)
            {
                sum += Perlin(x * f + i * 31.7f, y * f - i * 17.3f, z * f + i * 11.1f) * amp;
                norm += amp; amp *= gain; f *= lacunarity;
            }
            return sum / norm;
        }

        /// <summary>Ruido de crestas en [0,1]: valores altos forman cordilleras.</summary>
        public float Ridged(float x, float y, int octaves)
        {
            float sum = 0, amp = 1, norm = 0, f = 1;
            for (int i = 0; i < octaves; i++)
            {
                float n = 1f - Math.Abs(Perlin(x * f + i * 7.3f, y * f + i * 13.9f));
                sum += n * n * amp;
                norm += amp; amp *= 0.5f; f *= 2f;
            }
            return sum / norm;
        }
    }

    /// <summary>Generador pseudoaleatorio rapido y determinista (xorshift). No usar UnityEngine.Random en hilos.</summary>
    public sealed class Rng
    {
        ulong s;

        public Rng(long seed)
        {
            s = (ulong)seed * 6364136223846793005UL + 1442695040888963407UL;
            if (s == 0) s = 88172645463325252UL;
            NextU(); NextU(); NextU();
        }

        public uint NextU()
        {
            s ^= s >> 12; s ^= s << 25; s ^= s >> 27;
            return (uint)((s * 2685821657736338717UL) >> 32);
        }

        /// <summary>Entero en [0, n).</summary>
        public int Int(int n) { return n <= 1 ? 0 : (int)(NextU() % (uint)n); }
        /// <summary>Entero en [a, b).</summary>
        public int Range(int a, int b) { return b <= a ? a : a + Int(b - a); }
        public float Float() { return (NextU() >> 8) * (1f / 16777216f); }
        public float Range(float a, float b) { return a + (b - a) * Float(); }
        public bool Chance(float p) { return Float() < p; }
        public T Pick<T>(T[] arr) { return arr[Int(arr.Length)]; }
    }

    public static class MathX
    {
        public static int FloorDiv(int a, int b) { int q = a / b; return (a % b != 0 && ((a < 0) != (b < 0))) ? q - 1 : q; }
        public static int Mod(int a, int b) { int m = a % b; return m < 0 ? m + b : m; }
        public static int Floor(float v) { int i = (int)v; return v < i ? i - 1 : i; }
        public static int Floor(double v) { int i = (int)v; return v < i ? i - 1 : i; }
        public static float Clamp01(float v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
        public static float Smooth(float a, float b, float v)
        {
            float t = Clamp01((v - a) / (b - a));
            return t * t * (3f - 2f * t);
        }

        public static uint Hash(int x, int y, int z, int seed)
        {
            unchecked
            {
                uint h = (uint)seed * 374761393u;
                h += (uint)x * 668265263u; h = (h ^ (h >> 13)) * 1274126177u;
                h += (uint)y * 2246822519u; h = (h ^ (h >> 16)) * 3266489917u;
                h += (uint)z * 374761393u; h = (h ^ (h >> 15)) * 2654435761u;
                return h ^ (h >> 16);
            }
        }

        public static float Hash01(int x, int y, int z, int seed) { return (Hash(x, y, z, seed) & 0xFFFFFF) / 16777216f; }
        public static long ChunkKey(int cx, int cz) { return ((long)cx << 32) ^ (uint)cz; }
    }
}
