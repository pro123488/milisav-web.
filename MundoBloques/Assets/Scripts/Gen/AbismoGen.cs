using System;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>El Abismo: dimension de cavernas infinitas, mar de lava, roca roja, cuarzo y fortalezas.</summary>
    public sealed class AbismoGen : IGenerator
    {
        public const int LavaY = 31;
        public readonly int seed;
        readonly Noise nDens, nSoul, nMisc, nDetail;

        public AbismoGen(int seed)
        {
            this.seed = seed;
            nDens = new Noise(seed * 3 + 101); nSoul = new Noise(seed * 5 + 102); nMisc = new Noise(seed * 7 + 103); nDetail = new Noise(seed * 11 + 104);
        }

        public bool IsSolidAt(int x, int y, int z)
        {
            if (y <= 3 || y >= 124) return true;
            float n = nDens.Fbm(x * 0.011f, y * 0.019f, z * 0.011f, 3) * 0.95f;
            float grad = Math.Abs(y - 64) / 64f;
            grad = grad * grad * 0.95f + (y < 64 ? 0.18f * (64 - y) / 64f : 0f);
            return n + grad > 0.30f;
        }

        public void Generate(Chunk c)
        {
            var w = new Writer(c);
            int ox = c.cx << 4, oz = c.cz << 4;
            var rng = new Rng(MathX.Hash(c.cx, 44, c.cz, seed));
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    int wx = ox + lx, wz = oz + lz;
                    c.biome[lz * 16 + lx] = (byte)BiomeId.Ashlands;
                    for (int y = 0; y < 128; y++)
                    {
                        Block b;
                        if (y == 0 || y == 127) b = B.Bedrock;
                        else if (y < 4 && MathX.Hash01(wx, y, wz, seed + 1) < (4 - y) * 0.25f) b = B.Bedrock;
                        else if (y > 123 && MathX.Hash01(wx, y, wz, seed + 2) < (y - 123) * 0.25f) b = B.Bedrock;
                        else if (IsSolidAt(wx, y, wz))
                        {
                            b = B.AbyssRock;
                            float sn = nSoul.Perlin(wx * 0.06f, y * 0.1f, wz * 0.06f);
                            if (y < 44 && sn > 0.35f) b = B.SoulSand;
                            else if (y >= 22 && y <= 36 && nMisc.Perlin(wx * 0.09f, y * 0.12f, wz * 0.09f) > 0.5f) b = B.Basalt;
                        }
                        else if (y <= LavaY) b = B.Lava;
                        else b = B.Air;
                        c.blocks[Chunk.Idx(lx, y, lz)] = b.id;
                    }
                }

            // adornos: magma junto a la lava, glowstone en el techo, menas
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    for (int y = 4; y < 123; y++)
                    {
                        int i = Chunk.Idx(lx, y, lz);
                        if (c.blocks[i] == B.AbyssRock.id)
                        {
                            float r = MathX.Hash01(ox + lx, y, oz + lz, seed + 7);
                            if (y >= 20 && y <= 32 && c.blocks[Chunk.Idx(lx, y + 1, lz)] == B.Lava.id && r < 0.12f) c.blocks[i] = B.Magma.id;
                            else if (r < 0.011f) c.blocks[i] = B.QuartzOre.id;
                            else if (r < 0.015f) c.blocks[i] = B.AbyssGoldOre.id;
                            else if (r < 0.0153f && y >= 8 && y <= 24) c.blocks[i] = B.AbismitaOre.id;
                        }
                    }
                }
            for (int k = 0; k < 6; k++)
            {
                int gx = rng.Range(2, 14), gz = rng.Range(2, 14);
                int y = 122;
                while (y > 70 && c.blocks[Chunk.Idx(gx, y, gz)] == 0) y--;
                if (y <= 70 || y > 121) continue;
                if (c.blocks[Chunk.Idx(gx, y, gz)] == B.Lava.id) continue;
                int len = rng.Range(2, 6);
                for (int dy = 1; dy <= len; dy++)
                    for (int dz = -1; dz <= 1; dz++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            if (Math.Abs(dx) + Math.Abs(dz) + dy / 2 > 2) continue;
                            int xx = gx + dx, zz = gz + dz, yy = y - dy;
                            if ((uint)xx >= 16u || (uint)zz >= 16u || yy < 5) continue;
                            if (c.blocks[Chunk.Idx(xx, yy, zz)] == 0) c.blocks[Chunk.Idx(xx, yy, zz)] = B.Glowstone.id;
                        }
            }
            Structures.Abismo(c, w, this);
            c.RecomputeTop();
        }
    }
}
