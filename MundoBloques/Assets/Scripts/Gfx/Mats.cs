using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace MundoBloques
{
    /// <summary>Materiales y parametros globales del shader de voxeles.</summary>
    public static class Mats
    {
        public static Material Opaque, Cutout, Transparent, Mob, Item, Cloud, Lines, Particle, Sky;
        public static Shader shader;
        public static Material[] Chunk;
        static bool ready;

        static Material Make(string name, Texture tex, int cull, int src, int dst, int zwrite, float cutoff, int queue)
        {
            var m = new Material(shader);
            m.name = name;
            m.mainTexture = tex;
            m.SetFloat("_Cull", cull);
            m.SetFloat("_SrcBlend", src);
            m.SetFloat("_DstBlend", dst);
            m.SetFloat("_ZWrite", zwrite);
            m.SetFloat("_Cutoff", cutoff);
            m.SetFloat("_ObjLight", -1f);
            m.renderQueue = queue;
            return m;
        }

        public static void Init()
        {
            if (ready) return;
            ready = true;
            shader = Resources.Load<Shader>("Shaders/MundoBloquesVoxel");
            if (shader == null) shader = Shader.Find("MundoBloques/Voxel");
            if (shader == null) { Debug.LogError("No se encontro el shader MundoBloques/Voxel; usando Sprites/Default."); shader = Shader.Find("Sprites/Default"); }
            else if (!shader.isSupported) { Debug.LogError("El shader MundoBloques/Voxel no es compatible con esta tarjeta grafica; usando Sprites/Default."); shader = Shader.Find("Sprites/Default"); }
            var atlas = TileAtlas.Texture;
            Opaque = Make("MB_Opaque", atlas, (int)CullMode.Back, (int)BlendMode.One, (int)BlendMode.Zero, 1, 0f, 2000);
            Cutout = Make("MB_Cutout", atlas, (int)CullMode.Off, (int)BlendMode.One, (int)BlendMode.Zero, 1, 0.5f, 2450);
            Transparent = Make("MB_Transparent", atlas, (int)CullMode.Back, (int)BlendMode.SrcAlpha, (int)BlendMode.OneMinusSrcAlpha, 0, 0.01f, 3000);
            Mob = Make("MB_Mob", atlas, (int)CullMode.Back, (int)BlendMode.One, (int)BlendMode.Zero, 1, 0f, 2000);
            Item = Make("MB_Item", IconAtlas.Texture, (int)CullMode.Off, (int)BlendMode.One, (int)BlendMode.Zero, 1, 0.5f, 2450);
            Cloud = Make("MB_Cloud", MakeCloudTexture(), (int)CullMode.Off, (int)BlendMode.SrcAlpha, (int)BlendMode.OneMinusSrcAlpha, 0, 0.02f, 3100);
            Cloud.mainTexture.wrapMode = TextureWrapMode.Repeat;
            Lines = Make("MB_Lines", atlas, (int)CullMode.Off, (int)BlendMode.One, (int)BlendMode.Zero, 1, 0f, 2100);
            Particle = Make("MB_Particle", Texture2D.whiteTexture, (int)CullMode.Off, (int)BlendMode.SrcAlpha, (int)BlendMode.OneMinusSrcAlpha, 0, 0.01f, 3050);
            Particle.SetFloat("_ObjLight", 1f);
            Sky = Make("MB_Sky", Texture2D.whiteTexture, (int)CullMode.Off, (int)BlendMode.SrcAlpha, (int)BlendMode.OneMinusSrcAlpha, 0, 0.01f, 1000);
            Sky.SetFloat("_ObjLight", 1f); Sky.SetFloat("_FogOn", 0f);
            Chunk = new[] { Opaque, Cutout, Transparent };
            SetGlobals(1f, 0.04f, new Color(0.6f, 0.75f, 1f), 60f, 120f);
        }

        static Texture2D MakeCloudTexture()
        {
            const int N = 64;
            var tex = new Texture2D(N, N, TextureFormat.RGBA32, false);
            var n = new Noise(4242);
            var px = new Color32[N * N];
            Func<float, float, float> F = (x, y) => n.Fbm(x * 0.09f, y * 0.09f, 3) + n.Perlin(x * 0.03f + 10f, y * 0.03f) * 0.5f;
            for (int y = 0; y < N; y++)
                for (int x = 0; x < N; x++)
                {
                    // mezcla de cuatro copias desplazadas para que la textura se repita sin costuras
                    float v = (F(x, y) * (N - x) * (N - y) + F(x - N, y) * x * (N - y) + F(x, y - N) * (N - x) * y + F(x - N, y - N) * x * y) / (N * N);
                    px[y * N + x] = v > 0.04f ? new Color32(255, 255, 255, 235) : new Color32(255, 255, 255, 0);
                }
            tex.SetPixels32(px);
            tex.filterMode = FilterMode.Point;
            tex.wrapMode = TextureWrapMode.Repeat;
            tex.Apply(false, false);
            return tex;
        }

        public static void SetGlobals(float sky, float ambient, Color fog, float fogStart, float fogEnd)
        {
            Shader.SetGlobalFloat("_MB_Sky", sky);
            Shader.SetGlobalFloat("_MB_Ambient", ambient);
            Shader.SetGlobalColor("_MB_Fog", fog);
            Shader.SetGlobalFloat("_MB_FogStart", fogStart);
            Shader.SetGlobalFloat("_MB_FogEnd", fogEnd);
        }
    }
}
