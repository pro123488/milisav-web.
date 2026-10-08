using System;
using UnityEngine;

namespace MundoBloques
{
    public interface IGenerator
    {
        void Generate(Chunk c);
    }

    public struct ColInfo
    {
        public int h;              // y del bloque superior solido del terreno
        public int water;          // y de la superficie del agua (0 = sin agua; si <= h no hay agua)
        public BiomeId biome;
        public int skyTop, skyBottom;   // isla flotante (skyTop = -1 si no hay)
        public float temp, humid;
        public bool island;        // isla tropical
        public bool river;
        public bool HasWater { get { return water > h; } }
    }

    /// <summary>Generador del Mundo Superior: oceanos, islas, rios, lagos, montanas, biomas, cuevas, menas y arboles.</summary>
    public sealed class OverworldGen : IGenerator
    {
        public const int Sea = 40;
        public readonly int seed;
        readonly Noise nCont, nTemp, nHumid, nDetail, nMount, nRiver, nLake, nIsland, nMush, nSky, nMisc, nCaveA, nCaveB, nCheese, nSurf;

        public OverworldGen(int seed)
        {
            this.seed = seed;
            nCont = new Noise(seed * 7 + 1); nTemp = new Noise(seed * 13 + 2); nHumid = new Noise(seed * 17 + 3);
            nDetail = new Noise(seed * 19 + 4); nMount = new Noise(seed * 23 + 5); nRiver = new Noise(seed * 29 + 6);
            nLake = new Noise(seed * 31 + 7); nIsland = new Noise(seed * 37 + 8); nMush = new Noise(seed * 41 + 9);
            nSky = new Noise(seed * 43 + 10); nMisc = new Noise(seed * 47 + 11); nCaveA = new Noise(seed * 53 + 12);
            nCaveB = new Noise(seed * 59 + 13); nCheese = new Noise(seed * 61 + 14); nSurf = new Noise(seed * 67 + 15);
        }

        // ------------------------------------------------------------------
        // Columna: altura, bioma, agua
        // ------------------------------------------------------------------
        public ColInfo Column(int x, int z)
        {
            float fx = x, fz = z;
            float c = Mathf.Clamp(nCont.Fbm(fx * 0.0012f, fz * 0.0012f, 4) * 4.2f + 0.1f, -1f, 1f);
            float temp = Mathf.Clamp(nTemp.Fbm(fx * 0.0008f + 300f, fz * 0.0008f, 3) * 4.2f, -1f, 1f);
            float humid = Mathf.Clamp(nHumid.Fbm(fx * 0.0009f - 300f, fz * 0.0009f + 50f, 3) * 4.2f, -1f, 1f);
            float hills = nDetail.Fbm(fx * 0.012f, fz * 0.012f, 4) * 3.5f;
            float mount = nMount.Ridged(fx * 0.0045f, fz * 0.0045f, 4);

            float landF = MathX.Smooth(-0.10f, 0.08f, c);
            float depthT = MathX.Smooth(-0.08f, -0.6f, c);
            float floor = Sea - 4 - depthT * 30f + hills * 2.5f;
            float inland = MathX.Smooth(-0.02f, 0.5f, c);
            float landBase = Sea + 1 + inland * 17f + hills * (2f + inland * 7f);
            float mountMask = MathX.Smooth(0.78f, 0.9f, mount) * MathX.Smooth(0.2f, 0.55f, c);
            float mountH = mountMask * (14f + (mount - 0.78f) * 240f);
            float h = Mathf.Lerp(floor, landBase + mountH, landF);

            bool island = false, mush = false;
            if (c < -0.12f)
            {
                float isl = nIsland.Fbm(fx * 0.006f + 77f, fz * 0.006f - 33f, 3);
                if (isl > 0.17f) { float ih = Sea - 6 + (isl - 0.17f) * 140f; if (ih > h) { h = ih; island = h >= Sea - 1; } }
                if (c < -0.3f)
                {
                    float mu = nMush.Fbm(fx * 0.004f, fz * 0.004f, 2);
                    if (mu > 0.2f) { float mh = Sea - 7 + (mu - 0.2f) * 120f; if (mh > h) { h = mh; mush = h >= Sea - 1; island = false; } }
                }
            }

            // rios
            float rm = 0f;
            if (landF > 0.5f && h < Sea + 16)
            {
                float riv = Math.Abs(nRiver.Fbm(fx * 0.0030f, fz * 0.0030f, 3));
                rm = (1f - MathX.Smooth(0f, 0.012f, riv)) * landF * MathX.Smooth(Sea + 16, Sea + 8, h);
                if (rm > 0f) h = Mathf.Lerp(h, Sea - 2.5f, rm * 0.95f);
            }

            // lagos tierra adentro
            int lakeWater = 0;
            if (c > 0.12f && mountMask < 0.2f)
            {
                float lk = nLake.Fbm(fx * 0.011f + 500f, fz * 0.011f, 2);
                float lm = MathX.Smooth(0.17f, 0.3f, lk);
                if (lm > 0f)
                {
                    int lakeLevel = (int)Math.Floor(Sea + 1 + inland * 17f - 1f);
                    float target = lakeLevel - 1 - lm * 3f;
                    if (target < h) h = Mathf.Lerp(h, target, lm);
                    if (lm > 0.12f && h < lakeLevel) lakeWater = lakeLevel;
                }
            }

            if (h > 100f) h = 100f + (h - 100f) * 0.5f;
            int hh = (int)Math.Floor(h);
            hh = Mathf.Clamp(hh, 2, 118);

            var ci = new ColInfo { h = hh, skyTop = -1, skyBottom = -1, temp = temp, humid = humid, island = island, river = rm > 0.5f };
            ci.water = hh < Sea ? Sea : lakeWater;
            if (ci.water <= hh) ci.water = 0;

            // bioma
            BiomeId b;
            if (mush && hh >= Sea - 1) b = BiomeId.Mushroom;
            else if (hh < Sea)
            {
                if (rm > 0.45f) b = BiomeId.River;
                else if (island && hh >= Sea - 1) b = BiomeId.Beach;
                else if (temp < -0.5f) b = BiomeId.FrozenOcean;
                else if (temp > 0.45f) b = BiomeId.WarmOcean;
                else b = (Sea - hh) > 18 ? BiomeId.DeepOcean : BiomeId.Ocean;
            }
            else if (rm > 0.5f) b = BiomeId.River;
            else if (island) b = hh <= Sea + 1 ? BiomeId.Beach : BiomeId.Island;
            else if (hh <= Sea + 1 && c < 0.2f) b = BiomeId.Beach;
            else
            {
                float tAdj = temp - (hh - Sea) * 0.004f;
                if (mountMask > 0.4f || hh > Sea + 38)
                    b = (tAdj < -0.15f || hh > 100) ? BiomeId.SnowyPeaks : BiomeId.Mountains;
                else if (tAdj < -0.38f) b = humid < 0f ? BiomeId.Tundra : BiomeId.Taiga;
                else if (tAdj < 0.05f)
                    b = humid < -0.2f ? BiomeId.Plains : (humid < 0.35f ? (nMisc.Perlin(fx * 0.004f, fz * 0.004f) > 0.1f ? BiomeId.BirchForest : BiomeId.Forest) : BiomeId.Taiga);
                else if (tAdj < 0.42f)
                    b = humid < -0.15f ? BiomeId.Plains : (humid < 0.3f ? BiomeId.Forest : (hh <= Sea + 6 ? BiomeId.Swamp : BiomeId.Forest));
                else
                {
                    if (humid < -0.1f && nMisc.Perlin(fx * 0.003f + 90f, fz * 0.003f) > 0.25f) b = BiomeId.Mesa;
                    else b = humid < -0.25f ? BiomeId.Desert : (humid < 0.15f ? BiomeId.Savanna : BiomeId.Jungle);
                }
            }
            ci.biome = b;

            // islas flotantes
            float sk = nSky.Fbm(fx * 0.0045f + 9000f, fz * 0.0045f, 3);
            if (sk > 0.2f)
            {
                float s = Mathf.Clamp01((sk - 0.2f) / 0.2f);
                int sbase = 92 + (int)Math.Floor(nDetail.Perlin(fx * 0.02f, fz * 0.02f) * 4f);
                int top = sbase + (int)(s * 4f);
                float thick = 3f + s * s * 22f;
                int bottom = top - (int)thick - (int)(Math.Max(0f, nDetail.Perlin(fx * 0.11f + 3f, fz * 0.11f)) * 6f * s);
                if (top > 118) top = 118;
                if (bottom < top - 1) { ci.skyTop = top; ci.skyBottom = bottom; }
            }
            return ci;
        }

        // ------------------------------------------------------------------
        // Generacion del chunk
        // ------------------------------------------------------------------
        public const int M = 6;                 // margen de la ventana de columnas
        public const int WN = 16 + 2 * M;

        public void Generate(Chunk c)
        {
            var w = new Writer(c);
            int ox = c.cx << 4, oz = c.cz << 4;
            var win = new ColInfo[WN * WN];
            for (int j = 0; j < WN; j++)
                for (int i = 0; i < WN; i++)
                    win[j * WN + i] = Column(ox - M + i, oz - M + j);

            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    var ci = win[(lz + M) * WN + lx + M];
                    c.biome[lz * 16 + lx] = (byte)ci.biome;
                    FillColumn(c, lx, lz, ox + lx, oz + lz, ci);
                }

            var rng = new Rng(MathX.Hash(c.cx, 7, c.cz, seed));
            Carve(c, win, rng);
            Ores(c, w, rng);
            Geodes(c, w, rng);
            Decorate(c, w, win);
            Structures.Overworld(c, w, this, win);
            c.RecomputeTop();
        }

        Block Hsh(float r, Block a, Block b) { return r < 0.5f ? a : b; }

        void FillColumn(Chunk c, int lx, int lz, int wx, int wz, ColInfo ci)
        {
            int h = ci.h;
            bool wet = ci.water > h;
            float r = MathX.Hash01(wx, 0, wz, seed + 11);
            Block top, filler; int fdepth = 3; Block under = null; int underDepth = 0;
            var bi = ci.biome;
            if (wet)
            {
                switch (bi)
                {
                    case BiomeId.WarmOcean: top = filler = B.Sand; break;
                    case BiomeId.DeepOcean: top = filler = (r < 0.15f ? B.Clay : B.Gravel); break;
                    case BiomeId.FrozenOcean: top = filler = (r < 0.3f ? B.Gravel : B.Sand); break;
                    case BiomeId.River: top = filler = (r < 0.55f ? B.Sand : (r < 0.7f ? B.Clay : B.Gravel)); break;
                    case BiomeId.Mushroom: top = B.Mycelium; filler = B.Dirt; break;
                    case BiomeId.Swamp: top = (r < 0.3f ? B.Clay : B.Dirt); filler = B.Dirt; break;
                    default: top = filler = (r < 0.75f ? B.Sand : B.Gravel); break;
                }
            }
            else
            {
                switch (bi)
                {
                    case BiomeId.Desert: top = filler = B.Sand; fdepth = 4; under = B.Sandstone; underDepth = 4; break;
                    case BiomeId.Beach: top = filler = B.Sand; fdepth = 3; under = B.Sandstone; underDepth = 2; break;
                    case BiomeId.River: top = filler = (r < 0.6f ? B.Sand : B.Gravel); break;
                    case BiomeId.Mesa: top = B.RedSand; filler = B.Terracotta[1]; fdepth = 14; break;
                    case BiomeId.Mushroom: top = B.Mycelium; filler = B.Dirt; break;
                    case BiomeId.Mountains:
                        if (h < Sea + 26) { top = B.Grass; filler = B.Dirt; }
                        else if (h > 88 && r < 0.5f) { top = B.SnowBlock; filler = B.Stone; fdepth = 1; }
                        else { top = r < 0.15f ? B.Gravel : B.Stone; filler = B.Stone; fdepth = 2; }
                        break;
                    case BiomeId.SnowyPeaks: top = B.SnowBlock; filler = B.SnowBlock; fdepth = 1 + (int)(r * 2f); break;
                    case BiomeId.Taiga:
                        top = nSurf.Perlin(wx * 0.08f, wz * 0.08f) > 0.35f ? B.Podzol : B.Grass; filler = B.Dirt; break;
                    case BiomeId.Jungle:
                        top = nSurf.Perlin(wx * 0.07f, wz * 0.07f) > 0.45f ? B.Podzol : B.Grass; filler = B.Dirt; break;
                    case BiomeId.Savanna:
                        top = nSurf.Perlin(wx * 0.06f, wz * 0.06f) > 0.4f ? B.CoarseDirt : B.Grass; filler = B.Dirt; break;
                    default: top = B.Grass; filler = B.Dirt; break;
                }
            }

            int deepY = 11 + (int)(nSurf.Perlin(wx * 0.1f, wz * 0.1f) * 3f);
            for (int y = 0; y <= h; y++)
            {
                Block b;
                if (y == 0) b = B.Bedrock;
                else if (y < 4 && MathX.Hash01(wx, y, wz, seed + 5) < (4 - y) * 0.25f) b = B.Bedrock;
                else
                {
                    int depth = h - y;
                    if (bi == BiomeId.Mesa && !wet && depth > 0 && depth <= 14) b = MesaBand(y);
                    else if (depth == 0) b = top;
                    else if (depth <= fdepth) b = filler;
                    else if (under != null && depth <= fdepth + underDepth) b = under;
                    else b = y < deepY ? B.Deepslate : B.Stone;
                }
                int i = Chunk.Idx(lx, y, lz);
                c.blocks[i] = b.id;
            }
            if (wet)
            {
                for (int y = h + 1; y <= ci.water && y < 128; y++)
                    c.blocks[Chunk.Idx(lx, y, lz)] = B.Water.id;
                if (bi == BiomeId.FrozenOcean) c.blocks[Chunk.Idx(lx, ci.water, lz)] = B.Ice.id;
            }

            // isla flotante
            if (ci.skyTop > 0)
            {
                for (int y = ci.skyBottom; y <= ci.skyTop; y++)
                {
                    int depth = ci.skyTop - y;
                    Block b;
                    if (depth == 0) b = B.SkyGrass;
                    else if (depth <= 3) b = B.Dirt;
                    else b = MathX.Hash01(wx, y, wz, seed + 21) < 0.12f ? B.Andesite : B.Stone;
                    c.blocks[Chunk.Idx(lx, y, lz)] = b.id;
                }
                c.biome[lz * 16 + lx] = c.biome[lz * 16 + lx];
            }
        }

        static readonly int[] mesaBands = { 1, 1, 4, 14, 0, 12, 1, 8, 4, 14, 1, 0 };
        Block MesaBand(int y)
        {
            int k = mesaBands[Math.Abs(y) % mesaBands.Length];
            return B.Terracotta[k];
        }

        // ------------------------------------------------------------------
        // Cuevas
        // ------------------------------------------------------------------
        void Carve(Chunk c, ColInfo[] win, Rng rng)
        {
            int ox = c.cx << 4, oz = c.cz << 4;
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    var ci = win[(lz + M) * WN + lx + M];
                    int maxY = Math.Min(ci.h - 4, 104);
                    int wx = ox + lx, wz = oz + lz;
                    for (int y = 5; y <= maxY; y++)
                    {
                        int i = Chunk.Idx(lx, y, lz);
                        if (c.blocks[i] == 0) continue;
                        bool carve = false;
                        float n1 = nCaveA.Perlin(wx * 0.017f, y * 0.024f, wz * 0.017f);
                        if (n1 > -0.09f && n1 < 0.09f)
                        {
                            float n2 = nCaveB.Perlin(wx * 0.017f + 137f, y * 0.024f + 31f, wz * 0.017f - 91f);
                            if (n1 * n1 + n2 * n2 < 0.0075f) carve = true;
                        }
                        if (!carve && y < 44)
                        {
                            float n3 = nCheese.Perlin(wx * 0.012f, y * 0.026f, wz * 0.012f);
                            if (n3 > 0.58f) carve = true;
                        }
                        if (carve) c.blocks[i] = (y <= 9 ? B.Lava : B.Air).id;
                    }
                }

            // pozos que conectan la superficie con las cuevas
            if (rng.Chance(0.16f))
            {
                int sx = rng.Range(4, 12), sz = rng.Range(4, 12);
                var ci = win[(sz + M) * WN + sx + M];
                if (ci.h > Sea + 2 && !ci.HasWater && ci.skyTop < 0 && (ci.biome != BiomeId.Beach))
                {
                    float rad = rng.Range(2.0f, 3.2f);
                    int bottom = Math.Max(14, ci.h - rng.Range(26, 44));
                    for (int y = ci.h; y >= bottom; y--)
                    {
                        float rr = rad * (0.75f + 0.25f * (float)Math.Sin(y * 0.4f));
                        for (int dz = -3; dz <= 3; dz++)
                            for (int dx = -3; dx <= 3; dx++)
                            {
                                if (dx * dx + dz * dz > rr * rr) continue;
                                int xx = sx + dx, zz = sz + dz;
                                if ((uint)xx >= 16u || (uint)zz >= 16u) continue;
                                int i = Chunk.Idx(xx, y, zz);
                                if (c.blocks[i] != B.Bedrock.id && c.blocks[i] != B.Water.id) c.blocks[i] = 0;
                            }
                    }
                    // camara al fondo
                    for (int dy = -3; dy <= 3; dy++)
                        for (int dz = -5; dz <= 5; dz++)
                            for (int dx = -5; dx <= 5; dx++)
                            {
                                if (dx * dx + dz * dz + dy * dy * 2 > 22) continue;
                                int xx = sx + dx, zz = sz + dz, yy = bottom + dy;
                                if ((uint)xx >= 16u || (uint)zz >= 16u || yy < 6) continue;
                                int i = Chunk.Idx(xx, yy, zz);
                                if (c.blocks[i] != B.Bedrock.id && c.blocks[i] != B.Water.id) c.blocks[i] = 0;
                            }
                }
            }
        }

        // ------------------------------------------------------------------
        // Menas y vetas
        // ------------------------------------------------------------------
        static bool IsRock(Block b) { return b == B.Stone || b == B.Deepslate; }

        void Vein(Chunk c, Rng rng, int cx, int cy, int cz, int size, Block ore, Block deepOre, Block onlyIn = null)
        {
            float r = (float)Math.Pow(size * 0.24f, 1.0 / 3.0) + 0.2f;
            int ir = (int)Math.Ceiling(r);
            float ex = rng.Range(0.7f, 1.3f), ez = rng.Range(0.7f, 1.3f);
            for (int dy = -ir; dy <= ir; dy++)
                for (int dz = -ir; dz <= ir; dz++)
                    for (int dx = -ir; dx <= ir; dx++)
                    {
                        float d = (dx * dx) / (ex * ex) + dy * dy + (dz * dz) / (ez * ez);
                        if (d > r * r * (0.55f + 0.45f * rng.Float())) continue;
                        int x = cx + dx, y = cy + dy, z = cz + dz;
                        if ((uint)x >= 16u || (uint)z >= 16u || y < 1 || y >= 127) continue;
                        int i = Chunk.Idx(x, y, z);
                        var cur = Block.All[c.blocks[i]];
                        if (onlyIn != null) { if (cur != onlyIn) continue; }
                        else if (!IsRock(cur)) continue;
                        c.blocks[i] = (cur == B.Deepslate && deepOre != null ? deepOre : ore).id;
                    }
        }

        void Ores(Chunk c, Writer w, Rng rng)
        {
            // rocas decorativas
            for (int k = 0; k < 3; k++)
            {
                var blk = k == 0 ? B.Granite : (k == 1 ? B.Diorite : B.Andesite);
                if (rng.Chance(0.55f)) Vein(c, rng, rng.Range(3, 13), rng.Range(8, 72), rng.Range(3, 13), 40, blk, null, B.Stone);
            }
            for (int i = 0; i < 2; i++) if (rng.Chance(0.6f)) Vein(c, rng, rng.Range(3, 13), rng.Range(6, 56), rng.Range(3, 13), 34, B.Tuff, B.Tuff, B.Deepslate);
            if (rng.Chance(0.4f)) Vein(c, rng, rng.Range(3, 13), rng.Range(10, 50), rng.Range(3, 13), 24, B.Gravel, null, B.Stone);

            for (int i = 0; i < 16; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(5, 108), rng.Range(2, 14), rng.Range(4, 9), B.CoalOre, B.DeepCoalOre);
            for (int i = 0; i < 9; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(8, 72), rng.Range(2, 14), rng.Range(4, 8), B.CopperOre, B.DeepCopperOre);
            for (int i = 0; i < 11; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(5, 66), rng.Range(2, 14), rng.Range(3, 8), B.IronOre, B.DeepIronOre);
            for (int i = 0; i < 4; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(5, 34), rng.Range(2, 14), rng.Range(3, 6), B.GoldOre, B.DeepGoldOre);
            for (int i = 0; i < 2; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(6, 32), rng.Range(2, 14), rng.Range(3, 6), B.LapisOre, B.DeepLapisOre);
            for (int i = 0; i < 2; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(4, 16), rng.Range(2, 14), rng.Range(1, 5), B.DiamondOre, B.DeepDiamondOre);
            for (int i = 0; i < 2; i++) if (rng.Chance(0.55f)) Vein(c, rng, rng.Range(2, 14), rng.Range(5, 24), rng.Range(2, 14), rng.Range(1, 4), B.RubyOre, B.DeepRubyOre);
            for (int i = 0; i < 2; i++) if (rng.Chance(0.55f)) Vein(c, rng, rng.Range(2, 14), rng.Range(10, 40), rng.Range(2, 14), rng.Range(1, 4), B.SapphireOre, B.DeepSapphireOre);
            if (rng.Chance(0.5f)) Vein(c, rng, rng.Range(2, 14), rng.Range(6, 38), rng.Range(2, 14), rng.Range(3, 5), B.AmethystOre, B.DeepAmethystOre);
            // esmeraldas en montanas
            var mid = (BiomeId)c.biome[8 * 16 + 8];
            if (mid == BiomeId.Mountains || mid == BiomeId.SnowyPeaks)
                for (int i = 0; i < 4; i++) Vein(c, rng, rng.Range(2, 14), rng.Range(10, 96), rng.Range(2, 14), 1, B.EmeraldOre, B.DeepEmeraldOre);
        }

        void Geodes(Chunk c, Writer w, Rng rng)
        {
            if (!rng.Chance(0.07f)) return;
            int gx = rng.Range(6, 10), gz = rng.Range(6, 10), gy = rng.Range(14, 34);
            int ox = c.cx << 4, oz = c.cz << 4;
            for (int dy = -6; dy <= 6; dy++)
                for (int dz = -6; dz <= 6; dz++)
                    for (int dx = -6; dx <= 6; dx++)
                    {
                        float d = (float)Math.Sqrt(dx * dx + dy * dy + dz * dz);
                        Block b = null;
                        if (d <= 2.6f) b = B.Air;
                        else if (d <= 3.6f) b = B.AmethystBlock;
                        else if (d <= 4.5f) b = B.Calcite;
                        else if (d <= 5.2f) b = B.SmoothStone;
                        if (b == null) continue;
                        w.Set(ox + gx + dx, gy + dy, oz + gz + dz, b);
                    }
            for (int k = 0; k < 14; k++)
            {
                int dx = rng.Range(-2, 3), dy = rng.Range(-2, 3), dz = rng.Range(-2, 3);
                int x = ox + gx + dx, y = gy + dy, z = oz + gz + dz;
                if (w.Id(x, y, z) == 0 && w.Get(x, y - 1, z).FullOpaque) w.Set(x, y, z, B.AmethystCluster);
            }
        }

        // ------------------------------------------------------------------
        // Decoracion: arboles, plantas, flores, cultivos silvestres
        // ------------------------------------------------------------------
        float TreeDensity(BiomeId b, int h)
        {
            switch (b)
            {
                case BiomeId.Plains: return 0.004f;
                case BiomeId.Forest: return 0.05f;
                case BiomeId.BirchForest: return 0.045f;
                case BiomeId.Taiga: return 0.045f;
                case BiomeId.Tundra: return 0.004f;
                case BiomeId.Savanna: return 0.009f;
                case BiomeId.Jungle: return 0.085f;
                case BiomeId.Swamp: return 0.03f;
                case BiomeId.Island: return 0.03f;
                case BiomeId.Beach: return 0.003f;
                case BiomeId.Mountains: return h < Sea + 32 ? 0.014f : 0.001f;
                case BiomeId.Mushroom: return 0.012f;
                case BiomeId.Desert: return 0f;
                default: return 0f;
            }
        }

        TreeType TreeFor(BiomeId b, Rng r, float misc)
        {
            switch (b)
            {
                case BiomeId.Forest: return r.Chance(0.12f) ? TreeType.Birch : TreeType.Oak;
                case BiomeId.BirchForest: return r.Chance(0.85f) ? TreeType.Birch : TreeType.Oak;
                case BiomeId.Taiga: case BiomeId.Tundra: case BiomeId.Mountains: return TreeType.Spruce;
                case BiomeId.Savanna: return TreeType.Acacia;
                case BiomeId.Jungle: return TreeType.Jungle;
                case BiomeId.Island: case BiomeId.Beach: return TreeType.Palm;
                case BiomeId.Mushroom: return TreeType.Mushroom;
                default: return TreeType.Oak;
            }
        }

        void Decorate(Chunk c, Writer w, ColInfo[] win)
        {
            int ox = c.cx << 4, oz = c.cz << 4;

            // ---- arboles (celdas de 4x4 con un candidato cada una) ----
            int gx0 = MathX.FloorDiv(ox - M, 4), gx1 = MathX.FloorDiv(ox + 15 + M, 4);
            int gz0 = MathX.FloorDiv(oz - M, 4), gz1 = MathX.FloorDiv(oz + 15 + M, 4);
            for (int gz = gz0; gz <= gz1; gz++)
                for (int gx = gx0; gx <= gx1; gx++)
                {
                    uint hs = MathX.Hash(gx, 91, gz, seed);
                    int tx = gx * 4 + (int)(hs & 3), tz = gz * 4 + (int)((hs >> 2) & 3);
                    int wi = tx - (ox - M), wj = tz - (oz - M);
                    if ((uint)wi >= WN || (uint)wj >= WN) continue;
                    var ci = win[wj * WN + wi];
                    var rng = new Rng(MathX.Hash(tx, 3, tz, seed + 4));
                    if (ci.skyTop > 0)
                    {
                        if (rng.Chance(0.07f * 16f * 0.25f) && ci.skyTop < 117) Trees.Grow(w, rng, TreeType.Spirit, tx, ci.skyTop, tz);
                        continue;
                    }
                    if (ci.HasWater) continue;
                    float dens = TreeDensity(ci.biome, ci.h);
                    if (dens <= 0f) continue;
                    if (!rng.Chance(Math.Min(1f, dens * 16f))) continue;
                    if (ci.biome == BiomeId.Beach && !ci.island) continue;
                    if (ci.h <= Sea) continue;
                    Trees.Grow(w, rng, TreeFor(ci.biome, rng, 0f), tx, ci.h, tz);
                }

            // ---- plantas del suelo ----
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    int wx = ox + lx, wz = oz + lz;
                    var ci = win[(lz + M) * WN + lx + M];
                    var rng = new Rng(MathX.Hash(wx, 5, wz, seed + 9));
                    if (ci.skyTop > 0) { DecorateSky(w, ci, wx, wz, rng); }
                    if (ci.HasWater) { DecorateUnderwater(w, ci, wx, wz, rng); continue; }
                    int y = ci.h + 1;
                    var ground = w.Get(wx, ci.h, wz);
                    if (y >= 127 || w.Id(wx, y, wz) != 0) continue;
                    float p = rng.Float();
                    switch (ci.biome)
                    {
                        case BiomeId.Plains:
                            if (p < 0.30f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            else if (p < 0.34f && ground == B.Grass) w.Set(wx, y, wz, B.Flowers[rng.Int(10)]);
                            else if (p < 0.3405f) w.Set(wx, y, wz, B.Pumpkin);
                            break;
                        case BiomeId.Forest: case BiomeId.BirchForest:
                            if (p < 0.2f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            else if (p < 0.225f && ground == B.Grass) w.Set(wx, y, wz, B.Flowers[rng.Int(11)]);
                            else if (p < 0.232f) w.Set(wx, y, wz, rng.Chance(0.5f) ? B.MushroomRed : B.MushroomBrown);
                            break;
                        case BiomeId.Taiga:
                            if (p < 0.12f && ground != B.Gravel) w.Set(wx, y, wz, B.Fern);
                            else if (p < 0.22f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            break;
                        case BiomeId.Savanna:
                            if (p < 0.45f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            break;
                        case BiomeId.Jungle:
                            if (p < 0.3f && ground != B.Stone) w.Set(wx, y, wz, p < 0.1f ? B.Fern : B.TallGrass);
                            else if (p < 0.304f) w.Set(wx, y, wz, B.Melon);
                            break;
                        case BiomeId.Swamp:
                            if (p < 0.22f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            else if (p < 0.235f) w.Set(wx, y, wz, B.Flowers[2]);
                            else if (p < 0.25f) w.Set(wx, y, wz, rng.Chance(0.5f) ? B.MushroomRed : B.MushroomBrown);
                            break;
                        case BiomeId.Desert:
                            if (p < 0.011f) w.Set(wx, y, wz, B.DeadBush);
                            else if (p < 0.0185f && ground == B.Sand) Trees.Cactus(w, rng, wx, ci.h, wz);
                            break;
                        case BiomeId.Mesa:
                            if (p < 0.012f) w.Set(wx, y, wz, B.DeadBush);
                            else if (p < 0.016f && ground == B.RedSand) Trees.Cactus(w, rng, wx, ci.h, wz);
                            break;
                        case BiomeId.Tundra:
                            if (ground == B.Grass) w.Set(wx, y, wz, B.SnowLayer);
                            break;
                        case BiomeId.Island:
                            if (p < 0.2f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            else if (p < 0.23f) w.Set(wx, y, wz, B.Flowers[rng.Int(11)]);
                            break;
                        case BiomeId.Mountains:
                            if (p < 0.06f && ground == B.Grass) w.Set(wx, y, wz, B.TallGrass);
                            else if (p < 0.075f && ground == B.Grass) w.Set(wx, y, wz, B.Flowers[rng.Int(11)]);
                            break;
                        case BiomeId.Mushroom:
                            if (p < 0.06f) w.Set(wx, y, wz, rng.Chance(0.5f) ? B.MushroomRed : B.MushroomBrown);
                            break;
                    }
                    // cana de azucar junto al agua
                    if ((ci.biome == BiomeId.Plains || ci.biome == BiomeId.Swamp || ci.biome == BiomeId.Jungle || ci.biome == BiomeId.Beach || ci.biome == BiomeId.River || ci.biome == BiomeId.Forest)
                        && ci.h >= Sea && ci.h <= Sea + 1 && (ground == B.Sand || ground == B.Grass || ground == B.Dirt) && w.Id(wx, y, wz) == 0 && rng.Chance(0.18f))
                    {
                        bool nearWater = false;
                        for (int k = 0; k < 4 && !nearWater; k++)
                        {
                            int dxx = k == 0 ? 1 : k == 1 ? -1 : 0, dzz = k == 2 ? 1 : k == 3 ? -1 : 0;
                            int ni = (wz + dzz - (oz - M)) * WN + (wx + dxx - (ox - M));
                            if ((uint)ni < (uint)win.Length)
                            {
                                var ni2 = win[ni];
                                if (ni2.HasWater && ni2.h < ci.h) nearWater = true;
                            }
                        }
                        if (nearWater)
                        {
                            int hgt = rng.Range(1, 4);
                            for (int k = 0; k < hgt; k++) w.Set(wx, y + k, wz, B.SugarCane);
                        }
                    }
                }
        }

        void DecorateSky(Writer w, ColInfo ci, int wx, int wz, Rng rng)
        {
            int y = ci.skyTop + 1;
            if (y >= 126 || w.Id(wx, y, wz) != 0) return;
            float p = rng.Float();
            if (p < 0.28f) w.Set(wx, y, wz, B.TallGrass);
            else if (p < 0.34f) w.Set(wx, y, wz, B.Flowers[rng.Chance(0.5f) ? 2 : 3]);
            else if (p < 0.36f) w.Set(wx, y, wz, B.AmethystCluster);
            else if (p < 0.37f) w.Set(wx, y, wz, B.SkyCrystal);
        }

        void DecorateUnderwater(Writer w, ColInfo ci, int wx, int wz, Rng rng)
        {
            int depth = ci.water - ci.h;
            int y = ci.h + 1;
            float p = rng.Float();
            if (ci.biome == BiomeId.WarmOcean && depth <= 12)
            {
                float cn = nSurf.Perlin(wx * 0.07f + 5f, wz * 0.07f);
                if (cn > 0.15f)
                {
                    int ci2 = (int)((cn - 0.15f) * 12f) % 5;
                    if (p < 0.55f) { w.Set(wx, y, wz, B.Corals[ci2]); if (p < 0.2f) w.Set(wx, y + 1, wz, B.Corals[ci2]); }
                    else if (p < 0.7f) w.Set(wx, y, wz, B.Seagrass);
                    return;
                }
            }
            if (ci.biome == BiomeId.FrozenOcean || ci.biome == BiomeId.River && p > 0.1f) { if (ci.biome == BiomeId.River && p < 0.2f) w.Set(wx, y, wz, B.Seagrass); return; }
            if (p < 0.10f && depth <= 24) w.Set(wx, y, wz, B.Seagrass);
            else if (p < 0.16f && depth >= 5 && depth <= 30)
            {
                int hgt = Math.Min(depth - 1, rng.Range(3, 11));
                for (int k = 0; k < hgt; k++) w.Set(wx, y + k, wz, B.Kelp);
            }
        }
    }
}
