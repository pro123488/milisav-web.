using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Mallas pequenas para mostrar items en la mano y en el suelo.</summary>
    public static class ItemMeshes
    {
        static readonly Dictionary<Item, Mesh> cache = new Dictionary<Item, Mesh>();
        static readonly Dictionary<Item, bool> flat = new Dictionary<Item, bool>();

        public static Material MaterialFor(Item it)
        {
            Mesh m = Get(it);
            return flat[it] ? Mats.Item : Mats.Cutout;
        }

        public static bool IsFlat(Item it) { Get(it); return flat[it]; }

        static void Quad(List<Vector3> v, List<Vector2> uv, List<Vector2> uv2, List<Color32> col, List<int> t, Vector3 a, Vector3 b, Vector3 c, Vector3 d, float u0, float v0, float u1, float v1, Color32 color, bool both)
        {
            int i = v.Count;
            v.Add(a); v.Add(b); v.Add(c); v.Add(d);
            uv.Add(new Vector2(u0, v0)); uv.Add(new Vector2(u0, v1)); uv.Add(new Vector2(u1, v1)); uv.Add(new Vector2(u1, v0));
            for (int k = 0; k < 4; k++) { uv2.Add(new Vector2(1, 1)); col.Add(color); }
            t.Add(i); t.Add(i + 1); t.Add(i + 2); t.Add(i); t.Add(i + 2); t.Add(i + 3);
            if (both) { t.Add(i + 2); t.Add(i + 1); t.Add(i); t.Add(i + 3); t.Add(i + 2); t.Add(i); }
        }

        public static Mesh Get(Item it)
        {
            Mesh m;
            if (cache.TryGetValue(it, out m)) return m;
            var v = new List<Vector3>(); var uv = new List<Vector2>(); var uv2 = new List<Vector2>(); var col = new List<Color32>(); var t = new List<int>();
            bool isFlat = true;
            var b = it.block;
            if (b != null && (b.shape == Shape.Cube || b.shape == Shape.Box || b.shape == Shape.Slab || b.shape == Shape.Stairs))
            {
                isFlat = false;
                float h = b.shape == Shape.Slab ? 0.5f : 1f;
                float y0 = -0.5f, y1 = y0 + h;
                float[][] faces = {
                    new[] { 0.5f, y0, 0.5f, 0.5f, y1, 0.5f, 0.5f, y1, -0.5f, 0.5f, y0, -0.5f },        // +X
                    new[] { -0.5f, y0, -0.5f, -0.5f, y1, -0.5f, -0.5f, y1, 0.5f, -0.5f, y0, 0.5f },    // -X
                    new[] { -0.5f, y1, 0.5f, -0.5f, y1, -0.5f, 0.5f, y1, -0.5f, 0.5f, y1, 0.5f },      // +Y
                    new[] { -0.5f, y0, -0.5f, -0.5f, y0, 0.5f, 0.5f, y0, 0.5f, 0.5f, y0, -0.5f },      // -Y
                    new[] { -0.5f, y0, 0.5f, -0.5f, y1, 0.5f, 0.5f, y1, 0.5f, 0.5f, y0, 0.5f },        // +Z
                    new[] { 0.5f, y0, -0.5f, 0.5f, y1, -0.5f, -0.5f, y1, -0.5f, -0.5f, y0, -0.5f }     // -Z
                };
                float[] shade = { 0.8f, 0.8f, 1f, 0.5f, 0.65f, 0.65f };
                for (int f = 0; f < 6; f++)
                {
                    int tile = b.tex[f];
                    if (b.oriented && f == 4) tile = b.tex[6];
                    float s = shade[f];
                    Color32 c = new Color32((byte)(255 * s), (byte)(255 * s), (byte)(255 * s), 255);
                    if (b.tint != Tint.None && (b.tintMask & (1 << f)) != 0)
                    {
                        uint tc = b.tint == Tint.Grass ? 0x79C05Au : (b.tint == Tint.Foliage ? 0x59AE30u : 0x3F76E4u);
                        c = new Color32((byte)(((tc >> 16) & 255) * s), (byte)(((tc >> 8) & 255) * s), (byte)((tc & 255) * s), 255);
                    }
                    var q = faces[f];
                    Quad(v, uv, uv2, col, t, new Vector3(q[0], q[1], q[2]), new Vector3(q[3], q[4], q[5]), new Vector3(q[6], q[7], q[8]), new Vector3(q[9], q[10], q[11]),
                        TileAtlas.U0[tile], TileAtlas.V0[tile] + (TileAtlas.V1[tile] - TileAtlas.V0[tile]) * (b.shape == Shape.Slab ? 0f : 0f), TileAtlas.U1[tile], TileAtlas.V1[tile], c, false);
                }
            }
            else if (b != null)
            {
                // plantas, antorchas, puertas...: quad plano con la textura del bloque
                isFlat = false;
                int tile = b.shape == Shape.Crop ? b.tex[3] : b.tex[0];
                Color32 c = new Color32(255, 255, 255, 255);
                if (b.tint != Tint.None) c = new Color32(130, 200, 100, 255);
                Quad(v, uv, uv2, col, t, new Vector3(-0.5f, -0.5f, 0), new Vector3(-0.5f, 0.5f, 0), new Vector3(0.5f, 0.5f, 0), new Vector3(0.5f, -0.5f, 0),
                    TileAtlas.U0[tile], TileAtlas.V0[tile], TileAtlas.U1[tile], TileAtlas.V1[tile], c, true);
            }
            else
            {
                var r = IconAtlas.UV4(it.icon);
                Quad(v, uv, uv2, col, t, new Vector3(-0.5f, -0.5f, 0), new Vector3(-0.5f, 0.5f, 0), new Vector3(0.5f, 0.5f, 0), new Vector3(0.5f, -0.5f, 0),
                    r.x, r.y, r.z, r.w, new Color32(255, 255, 255, 255), true);
            }
            m = new Mesh();
            m.SetVertices(v); m.SetUVs(0, uv); m.SetUVs(1, uv2); m.SetColors(col); m.SetTriangles(t, 0);
            m.RecalculateBounds();
            cache[it] = m;
            flat[it] = it.block == null;   // true => usa el atlas de iconos
            if (b != null && !(b.shape == Shape.Cube || b.shape == Shape.Box || b.shape == Shape.Slab || b.shape == Shape.Stairs)) flat[it] = false;
            return m;
        }
    }
}
