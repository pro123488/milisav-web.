using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Atlas de iconos (items + interfaz) generado por codigo.</summary>
    public static class IconAtlas
    {
        public const int T = 16;
        public const int Cols = 32;
        public static int Width, Height;
        public static Texture2D Texture;
        public static Color32[] Pixels;
        static readonly Dictionary<string, int> ui = new Dictionary<string, int>();
        public static bool Built;

        /// <summary>Debe llamarse despues de TileAtlas.Build y Items.Init.</summary>
        public static void Build(bool createTexture = true)
        {
            Items.Init();
            int n = Items.All.Count + IconGen.UiNames.Length + 1;
            int rows = (n + Cols - 1) / Cols;
            Width = Cols * T;
            int h = 16;
            while (h < rows * T) h *= 2;
            Height = h;
            Pixels = new Color32[Width * Height];
            for (int i = 0; i < Items.All.Count; i++)
            {
                var it = Items.All[i];
                it.icon = i;
                Blit(i, IconGen.PaintItem(it));
            }
            for (int i = 0; i < IconGen.UiNames.Length; i++)
            {
                int idx = Items.All.Count + i;
                ui[IconGen.UiNames[i]] = idx;
                Blit(idx, IconGen.PaintUi(IconGen.UiNames[i]));
            }
            Built = true;
            if (createTexture) MakeTexture();
        }

        static void MakeTexture()
        {
            Texture = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
            Texture.name = "MB_IconAtlas";
            Texture.filterMode = FilterMode.Point;
            Texture.wrapMode = TextureWrapMode.Clamp;
            Texture.SetPixels32(Pixels);
            Texture.Apply(false, false);
        }

        static void Blit(int i, Color32[] px)
        {
            int col = i % Cols, row = i / Cols;
            for (int y = 0; y < T; y++)
                for (int x = 0; x < T; x++)
                    Pixels[(row * T + (T - 1 - y)) * Width + col * T + x] = px[y * T + x];
        }

        public static int Ui(string name) { return ui[name]; }

        /// <summary>Rect uv (para RawImage.uvRect) del icono.</summary>
        public static Rect UV(int icon)
        {
            int col = icon % Cols, row = icon / Cols;
            return new Rect((float)col * T / Width, (float)row * T / Height, (float)T / Width, (float)T / Height);
        }

        /// <summary>Uv del icono en las 4 esquinas (u0,v0,u1,v1) para mallas de objetos soltos.</summary>
        public static Vector4 UV4(int icon)
        {
            int col = icon % Cols, row = icon / Cols;
            const float e = 0.02f;
            return new Vector4((col * T + e) / Width, (row * T + e) / Height, ((col + 1) * T - e) / Width, ((row + 1) * T - e) / Height);
        }
    }
}
