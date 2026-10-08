using System;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>El Final: isla central de piedra del Final con pilares de obsidiana e islas lejanas flotando en el vacio.</summary>
    public sealed class EndGen : IGenerator
    {
        public readonly int seed;
        readonly Noise nTop, nOuter, nMisc;
        public const int IslandY = 64;
        public const int IslandR = 52;

        public EndGen(int seed)
        {
            this.seed = seed;
            nTop = new Noise(seed * 3 + 201); nOuter = new Noise(seed * 5 + 202); nMisc = new Noise(seed * 7 + 203);
        }

        public static int PillarCount = 10;
        public static void PillarInfo(int k, out int px, out int pz, out int radius, out int height)
        {
            double ang = k * Math.PI * 2.0 / PillarCount;
            px = (int)Math.Round(Math.Cos(ang) * 40.0); pz = (int)Math.Round(Math.Sin(ang) * 40.0);
            radius = 2 + (k % 3);
            height = 76 + ((k * 7) % 5) * 6 + (k % 2) * 3;
        }

        public void Generate(Chunk c)
        {
            var w = new Writer(c);
            int ox = c.cx << 4, oz = c.cz << 4;
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    int wx = ox + lx, wz = oz + lz;
                    double d = Math.Sqrt((double)wx * wx + (double)wz * wz);
                    c.biome[lz * 16 + lx] = (byte)(d < 130 ? BiomeId.EndIsland : BiomeId.EndVoid);
                    if (d < IslandR + 6)
                    {
                        float edge = nTop.Perlin(wx * 0.05f, wz * 0.05f) * 5f;
                        double rr = IslandR + edge;
                        if (d < rr)
                        {
                            int top = IslandY + (int)Math.Round(nTop.Perlin(wx * 0.09f + 5, wz * 0.09f) * 1.5f);
                            int depth = (int)((1.0 - d / rr) * 30.0 + nTop.Perlin(wx * 0.12f, wz * 0.12f) * 3f) + 2;
                            for (int y = top - depth; y <= top; y++) if (y > 0 && y < 128) c.blocks[Chunk.Idx(lx, y, lz)] = B.EndStone.id;
                        }
                    }
                    else if (d > 150)
                    {
                        for (int y = 36; y < 100; y++)
                        {
                            float n = nOuter.Fbm(wx * 0.022f, y * 0.04f, wz * 0.022f, 3);
                            float vert = Math.Abs(y - 66) / 34f;
                            if (n - vert * vert * 0.55f > 0.34f) c.blocks[Chunk.Idx(lx, y, lz)] = B.EndStone.id;
                        }
                    }
                }

            // pilares de obsidiana
            for (int k = 0; k < PillarCount; k++)
            {
                int px, pz, r, h;
                PillarInfo(k, out px, out pz, out r, out h);
                for (int dz = -r; dz <= r; dz++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (dx * dx + dz * dz > r * r + 1) continue;
                        w.Fill(px + dx, 50, pz + dz, px + dx, h, pz + dz, B.Obsidian);
                    }
                w.Set(px, h + 1, pz, B.Bedrock);
                if (k % 3 == 0)
                    for (int dz = -r - 1; dz <= r + 1; dz++)
                        for (int dx = -r - 1; dx <= r + 1; dx++)
                        {
                            if (Math.Abs(dx) != r + 1 && Math.Abs(dz) != r + 1) continue;
                            if (Math.Abs(dx) == r + 1 && Math.Abs(dz) == r + 1) continue;
                            w.Fill(px + dx, h + 1, pz + dz, px + dx, h + 3, pz + dz, B.Glass);
                        }
                w.Spawn("end_crystal", px + 0.5f, h + 2f, pz + 0.5f);
            }
            c.RecomputeTop();
        }
    }
}
