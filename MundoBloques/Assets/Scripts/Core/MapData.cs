using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Mapa explorado del Mundo Superior: un color por columna de bloques, guardado por chunk.</summary>
    public sealed class MapData
    {
        sealed class Tile { public int cx, cz; public Color32[] px = new Color32[256]; public float lastCapture; }

        readonly Dictionary<long, Tile> tiles = new Dictionary<long, Tile>();
        readonly Color32[] baseCache = new Color32[4096];
        readonly bool[] baseDone = new bool[4096];
        public bool dirty;
        public static readonly Color32 Unknown = new Color32(18, 20, 28, 255);

        public int Count { get { return tiles.Count; } }
        public void Clear() { tiles.Clear(); dirty = false; }

        Color32 BaseColor(Block b)
        {
            int id = b.id;
            if (id < baseCache.Length && baseDone[id]) return baseCache[id];
            var c = TileAtlas.Average(b.tex[2]);
            if (id < baseCache.Length) { baseCache[id] = c; baseDone[id] = true; }
            return c;
        }

        Color32 Tinted(Block b, BiomeInfo info)
        {
            var c = BaseColor(b);
            if (b.tint != Tint.None && (b.tintMask & 4) != 0)
            {
                uint t = b.tint == Tint.Grass ? info.grass : (b.tint == Tint.Foliage ? info.foliage : info.water);
                c = new Color32((byte)(c.r * ((t >> 16) & 255) / 255), (byte)(c.g * ((t >> 8) & 255) / 255), (byte)(c.b * (t & 255) / 255), 255);
            }
            return c;
        }

        static bool Ignorable(Block b) { return b.id == 0 || b.shape == Shape.Cross || b.shape == Shape.Crop || b.shape == Shape.Torch || b == B.SnowLayer; }

        /// <summary>Calcula (o recalcula) los colores de un chunk cargado.</summary>
        public void Capture(Chunk c, float now)
        {
            if (c == null || c.state != 2) return;
            long key = MathX.ChunkKey(c.cx, c.cz);
            Tile t;
            if (!tiles.TryGetValue(key, out t)) { t = new Tile { cx = c.cx, cz = c.cz }; tiles[key] = t; }
            t.lastCapture = now;
            var heights = new int[256];
            var cols = new Color32[256];
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    int i = (lz << 4) | lx;
                    int y = Mathf.Clamp(c.top[i], 0, 127);
                    var b = Block.All[c.blocks[Chunk.Idx(lx, y, lz)]];
                    int guard = 0;
                    while (y > 0 && Ignorable(b) && guard++ < 10) { y--; b = Block.All[c.blocks[Chunk.Idx(lx, y, lz)]]; }
                    var info = Biomes.Info[Mathf.Min(c.biome[i], (int)BiomeId.Count - 1)];
                    heights[i] = y;
                    Color32 col;
                    if (B.IsWaterlike(b) && b != B.Ice)
                    {
                        int yy = y, depth = 0;
                        while (yy > 0 && B.IsWaterlike(Block.All[c.blocks[Chunk.Idx(lx, yy, lz)]])) { yy--; depth++; }
                        var floorB = Block.All[c.blocks[Chunk.Idx(lx, yy, lz)]];
                        var fc = Tinted(floorB, info);
                        uint wc = info.water;
                        var water = new Color32((byte)((wc >> 16) & 255), (byte)((wc >> 8) & 255), (byte)(wc & 255), 255);
                        float k = Mathf.Clamp(0.45f + depth * 0.07f, 0.45f, 0.95f);
                        col = Col.Lerp(fc, water, k);
                        col = Col.Mul(col, Mathf.Clamp(1.05f - depth * 0.012f, 0.55f, 1.05f));
                        heights[i] = OverworldGen.Sea;
                    }
                    else col = Tinted(b, info);
                    cols[i] = col;
                }
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    int i = (lz << 4) | lx;
                    int hn = lz < 15 ? heights[i + 16] : heights[i];       // vecino al norte (+z)
                    int hw = lx > 0 ? heights[i - 1] : heights[i];
                    float shade = 1f + Mathf.Clamp((heights[i] - hn) * 0.07f + (heights[i] - hw) * 0.04f, -0.32f, 0.32f);
                    t.px[i] = Col.Mul(cols[i], shade);
                }
            dirty = true;
        }

        /// <summary>Captura chunks nuevos cerca del jugador y refresca los vecinos inmediatos de vez en cuando.</summary>
        public void CaptureAround(World w, int pcx, int pcz, int radius, float now, int budget)
        {
            for (int r = 0; r <= radius && budget > 0; r++)
                for (int dz = -r; dz <= r && budget > 0; dz++)
                    for (int dx = -r; dx <= r && budget > 0; dx++)
                    {
                        if (Math.Max(Math.Abs(dx), Math.Abs(dz)) != r) continue;
                        var c = w.GetChunkNoCache(pcx + dx, pcz + dz);
                        if (c == null || c.state != 2) continue;
                        Tile t;
                        bool have = tiles.TryGetValue(MathX.ChunkKey(c.cx, c.cz), out t);
                        // los cercanos se refrescan (construcciones nuevas); los lejanos solo la primera vez
                        if (have && (r > 2 || now - t.lastCapture < 4f)) continue;
                        Capture(c, now); budget--;
                    }
        }

        public bool TryGet(int cx, int cz, out Color32[] px)
        {
            Tile t;
            if (tiles.TryGetValue(MathX.ChunkKey(cx, cz), out t)) { px = t.px; return true; }
            px = null; return false;
        }

        /// <summary>Pinta una region cuadrada centrada en (x,z): n x n pixeles, bpp bloques por pixel.</summary>
        public void Render(Color32[] buf, int n, int centerX, int centerZ, int bpp)
        {
            int half = n / 2;
            long lastKey = long.MinValue; Color32[] lastPx = null;
            for (int j = 0; j < n; j++)
            {
                int wz = centerZ + (j - half) * bpp;
                for (int i = 0; i < n; i++)
                {
                    int wx = centerX + (i - half) * bpp;
                    int cx = wx >> 4, cz = wz >> 4;
                    long key = MathX.ChunkKey(cx, cz);
                    if (key != lastKey)
                    {
                        lastKey = key;
                        Tile t;
                        lastPx = tiles.TryGetValue(key, out t) ? t.px : null;
                    }
                    buf[j * n + i] = lastPx != null ? lastPx[((wz & 15) << 4) | (wx & 15)] : Unknown;
                }
            }
        }

        // ---------------------------------------------------------------- guardado
        public void Save(string path)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                using (var fs = File.Create(path))
                using (var gz = new GZipStream(fs, CompressionLevel.Fastest))
                using (var w = new BinaryWriter(gz))
                {
                    w.Write(1);
                    w.Write(tiles.Count);
                    foreach (var kv in tiles)
                    {
                        var t = kv.Value;
                        w.Write(t.cx); w.Write(t.cz);
                        for (int i = 0; i < 256; i++) { w.Write(t.px[i].r); w.Write(t.px[i].g); w.Write(t.px[i].b); }
                    }
                }
                dirty = false;
            }
            catch (Exception e) { Debug.LogWarning("No se pudo guardar el mapa: " + e.Message); }
        }

        public void Load(string path)
        {
            tiles.Clear(); dirty = false;
            if (!File.Exists(path)) return;
            try
            {
                using (var fs = File.OpenRead(path))
                using (var gz = new GZipStream(fs, CompressionMode.Decompress))
                using (var r = new BinaryReader(gz))
                {
                    if (r.ReadInt32() != 1) return;
                    int n = r.ReadInt32();
                    for (int k = 0; k < n; k++)
                    {
                        var t = new Tile { cx = r.ReadInt32(), cz = r.ReadInt32(), lastCapture = -100f };
                        for (int i = 0; i < 256; i++) t.px[i] = new Color32(r.ReadByte(), r.ReadByte(), r.ReadByte(), 255);
                        tiles[MathX.ChunkKey(t.cx, t.cz)] = t;
                    }
                }
            }
            catch (Exception e) { Debug.LogWarning("Mapa corrupto: " + e.Message); tiles.Clear(); }
        }
    }
}
