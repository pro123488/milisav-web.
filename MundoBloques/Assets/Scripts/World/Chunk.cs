using System.Collections.Generic;

namespace MundoBloques
{
    public struct SpawnReq
    {
        public string mob; public float x, y, z; public int id;
        public SpawnReq(string mob, float x, float y, float z)
        {
            this.mob = mob; this.x = x; this.y = y; this.z = z;
            id = (int)MathX.Hash((int)System.Math.Floor(x), (int)System.Math.Floor(y), (int)System.Math.Floor(z), 90210);
        }
    }

    /// <summary>Columna de 16x16 bloques de alto fijo. Datos puros (sin objetos de Unity).</summary>
    public sealed class Chunk
    {
        public const int SX = 16, SZ = 16, SY = 128;
        public const int VOL = SX * SZ * SY;

        public readonly int cx, cz;
        public readonly ushort[] blocks = new ushort[VOL];
        public readonly byte[] meta = new byte[VOL];
        public readonly byte[] light = new byte[VOL];      // alto: cielo, bajo: bloque
        public readonly byte[] biome = new byte[256];
        public readonly short[] top = new short[256];      // y del bloque mas alto no-aire por columna

        public volatile int state;                         // 0 nuevo, 1 generando, 2 listo
        public volatile int version;                       // cambia con cada modificacion
        public int meshedVersion = -1;
        public bool meshQueued;
        public bool modified;                              // hay que guardarlo
        public bool spawnsDone;
        public bool registered;
        public Dictionary<int, BlockEntity> entities = new Dictionary<int, BlockEntity>();
        public List<SpawnReq> pendingSpawns = new List<SpawnReq>();
        public object view;                                // ChunkView (lado Unity)
        public int lastMeshFrame;

        public Chunk(int cx, int cz) { this.cx = cx; this.cz = cz; }

        public static int Idx(int x, int y, int z) { return (y << 8) | (z << 4) | x; }
        public int OriginX { get { return cx << 4; } }
        public int OriginZ { get { return cz << 4; } }

        public void RecomputeTop()
        {
            for (int z = 0; z < 16; z++)
                for (int x = 0; x < 16; x++)
                {
                    int y = SY - 1;
                    while (y > 0 && blocks[Idx(x, y, z)] == 0) y--;
                    top[(z << 4) | x] = (short)y;
                }
        }
    }
}
