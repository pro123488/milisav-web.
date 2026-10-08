using System;

namespace MundoBloques
{
    /// <summary>Escribe bloques en un chunk recortando todo lo que cae fuera de el (coordenadas del mundo).</summary>
    public sealed class Writer
    {
        public readonly Chunk c;
        public readonly World world;      // modo mundo: escribe en los chunks cargados
        public readonly int ox, oz;

        public Writer(Chunk c) { this.c = c; ox = c.cx << 4; oz = c.cz << 4; }
        public Writer(World world) { this.world = world; }

        public bool In(int wx, int wy, int wz)
        {
            if (world != null) return (uint)wy < 128u && world.IsLoaded(wx, wz);
            return (uint)(wx - ox) < 16u && (uint)(wz - oz) < 16u && (uint)wy < 128u;
        }

        public ushort Id(int wx, int wy, int wz)
        {
            if (world != null) return world.Id(wx, wy, wz);
            if (!In(wx, wy, wz)) return 0;
            return c.blocks[Chunk.Idx(wx - ox, wy, wz - oz)];
        }

        public Block Get(int wx, int wy, int wz) { return Block.All[Id(wx, wy, wz)]; }

        public void Set(int wx, int wy, int wz, Block b, int meta = 0)
        {
            if (!In(wx, wy, wz)) return;
            if (world != null) { world.SetBlock(wx, wy, wz, b, meta, false); return; }
            int i = Chunk.Idx(wx - ox, wy, wz - oz);
            c.blocks[i] = b.id; c.meta[i] = (byte)meta;
        }

        /// <summary>Solo sobrescribe aire, plantas y hojas.</summary>
        public void Soft(int wx, int wy, int wz, Block b, int meta = 0)
        {
            if (!In(wx, wy, wz)) return;
            var cur = Get(wx, wy, wz);
            if (cur.id == 0 || cur.replaceable || cur.shape == Shape.Cross || B.IsLeaves(cur) || cur == B.SnowLayer)
                Set(wx, wy, wz, b, meta);
        }

        /// <summary>Solo si el bloque actual es aire (para adornos).</summary>
        public void IfAir(int wx, int wy, int wz, Block b, int meta = 0)
        {
            if (!In(wx, wy, wz)) return;
            if (Id(wx, wy, wz) == 0) Set(wx, wy, wz, b, meta);
        }

        public void Fill(int x0, int y0, int z0, int x1, int y1, int z1, Block b, int meta = 0)
        {
            for (int y = Math.Min(y0, y1); y <= Math.Max(y0, y1); y++)
                for (int z = Math.Min(z0, z1); z <= Math.Max(z0, z1); z++)
                    for (int x = Math.Min(x0, x1); x <= Math.Max(x0, x1); x++) Set(x, y, z, b, meta);
        }

        /// <summary>Caja hueca (paredes, suelo y techo opcionales).</summary>
        public void Hollow(int x0, int y0, int z0, int x1, int y1, int z1, Block wall, bool floor, bool roof)
        {
            for (int y = y0; y <= y1; y++)
                for (int z = z0; z <= z1; z++)
                    for (int x = x0; x <= x1; x++)
                    {
                        bool edge = x == x0 || x == x1 || z == z0 || z == z1;
                        if (y == y0) { if (floor) Set(x, y, z, wall); else if (edge) Set(x, y, z, wall); }
                        else if (y == y1) { if (roof) Set(x, y, z, wall); else if (edge) Set(x, y, z, wall); }
                        else Set(x, y, z, edge ? wall : B.Air);
                    }
        }

        public ChestEntity Chest(int wx, int wy, int wz, int facing, string loot, Rng rng)
        {
            if (!In(wx, wy, wz)) return null;
            Set(wx, wy, wz, B.Chest, facing);
            var e = new ChestEntity { x = wx, y = wy, z = wz };
            Loot.Fill(e, loot, rng);
            c.entities[Chunk.Idx(wx - ox, wy, wz - oz)] = e;
            return e;
        }

        /// <summary>Antorcha sobre un poste de valla que llega hasta el suelo (para que no flote ni se caiga).</summary>
        public void Lamp(int x, int y, int z)
        {
            if (!In(x, y, z)) return;
            int yy = y - 1, n = 0;
            while (yy > 0 && n < 8 && !Get(x, yy, z).Collides) { n++; yy--; }
            if (n >= 8) return;
            for (int k = yy + 1; k < y; k++) Set(x, k, z, B.Fence[0]);
            Set(x, y, z, B.Torch, 0);
        }

        public void Spawn(string mob, float wx, float wy, float wz)
        {
            if (In((int)Math.Floor(wx), (int)Math.Floor(wy), (int)Math.Floor(wz))) c.pendingSpawns.Add(new SpawnReq(mob, wx, wy, wz));
        }
    }
}
