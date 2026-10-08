using System.Collections.Concurrent;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Resultado del mallado de un chunk, listo para subir a un Mesh de Unity.</summary>
    public sealed class MeshData
    {
        public Chunk chunk;
        public int version;
        public readonly List<Vector3> verts = new List<Vector3>(8192);
        public readonly List<Vector2> uvs = new List<Vector2>(8192);
        public readonly List<Vector2> uv2 = new List<Vector2>(8192);
        public readonly List<Color32> colors = new List<Color32>(8192);
        public readonly List<int>[] tris = { new List<int>(8192), new List<int>(2048), new List<int>(2048) };

        static readonly ConcurrentBag<MeshData> pool = new ConcurrentBag<MeshData>();

        public static MeshData Take()
        {
            MeshData m;
            if (!pool.TryTake(out m)) m = new MeshData();
            return m;
        }

        public void Release() { Clear(); chunk = null; pool.Add(this); }

        public void Clear()
        {
            verts.Clear(); uvs.Clear(); uv2.Clear(); colors.Clear();
            for (int i = 0; i < 3; i++) tris[i].Clear();
        }

        public int VertexCount { get { return verts.Count; } }
    }
}
