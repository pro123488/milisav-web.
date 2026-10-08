using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Atlas de texturas de bloques, generado por codigo al iniciar.</summary>
    public static class TileAtlas
    {
        public const int T = 16;
        public const int Cols = 32;
        static readonly Dictionary<string, int> map = new Dictionary<string, int>();
        public static readonly List<string> Names = new List<string>();
        public static bool Built;

        public static int Width, Height;
        public static Texture2D Texture;
        public static Color32[] AtlasPixels;
        public static float[] U0, V0, U1, V1;
        public static int White, Black, Crack0, EndEye;

        public static int Index(string name)
        {
            int i;
            if (map.TryGetValue(name, out i)) return i;
            if (Built) { Debug.LogError("Tile registrado tras construir el atlas: " + name); return 0; }
            i = Names.Count;
            map[name] = i; Names.Add(name);
            return i;
        }

        public static string NameOf(int i) { return Names[i]; }

        /// <summary>Pinta todos los tiles registrados y crea el Texture2D (si createTexture).</summary>
        public static void Build(bool createTexture = true)
        {
            B.Init();
            White = Index("white"); Black = Index("black");
            Crack0 = Index("crack_0");
            for (int i = 1; i < 10; i++) Index("crack_" + i);
            EndEye = Index("end_eye");

            int n = Names.Count;
            int rows = (n + Cols - 1) / Cols;
            Width = Cols * T;
            int h = rows * T, ph = 16;
            while (ph < h) ph *= 2;
            Height = ph;
            AtlasPixels = new Color32[Width * Height];
            U0 = new float[n]; V0 = new float[n]; U1 = new float[n]; V1 = new float[n];
            const float eps = 0.02f;
            for (int i = 0; i < n; i++)
            {
                var px = TexGen.Paint(Names[i]);
                int col = i % Cols, row = i / Cols;
                for (int y = 0; y < T; y++)
                    for (int x = 0; x < T; x++)
                        AtlasPixels[(row * T + (T - 1 - y)) * Width + col * T + x] = px[y * T + x];
                U0[i] = (col * T + eps) / Width; U1[i] = ((col + 1) * T - eps) / Width;
                V0[i] = (row * T + eps) / Height; V1[i] = ((row + 1) * T - eps) / Height;
            }
            Built = true;
            if (createTexture) MakeTexture();
        }

        static void MakeTexture()
        {
            Texture = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
            Texture.name = "MB_BlockAtlas";
            Texture.filterMode = FilterMode.Point;
            Texture.wrapMode = TextureWrapMode.Clamp;
            Texture.SetPixels32(AtlasPixels);
            Texture.Apply(false, false);
        }

        /// <summary>Color medio del tile (para particulas y minimapa).</summary>
        public static Color32 Average(int tile)
        {
            int col = tile % Cols, row = tile / Cols;
            int r = 0, g = 0, b = 0, c = 0;
            for (int y = 0; y < T; y++)
                for (int x = 0; x < T; x++)
                {
                    var p = AtlasPixels[(row * T + y) * Width + col * T + x];
                    if (p.a < 128) continue;
                    r += p.r; g += p.g; b += p.b; c++;
                }
            if (c == 0) return new Color32(128, 128, 128, 255);
            return new Color32((byte)(r / c), (byte)(g / c), (byte)(b / c), 255);
        }
    }
}
