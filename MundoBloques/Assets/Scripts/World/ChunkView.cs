using UnityEngine;
using UnityEngine.Rendering;

namespace MundoBloques
{
    /// <summary>Objeto de Unity que dibuja un chunk.</summary>
    public sealed class ChunkView
    {
        public GameObject go;
        public Mesh mesh;
        MeshRenderer mr;
        MeshFilter mf;

        public ChunkView(Chunk c)
        {
            go = new GameObject("Chunk " + c.cx + "," + c.cz);
            go.transform.position = new Vector3(c.cx << 4, 0, c.cz << 4);
            mf = go.AddComponent<MeshFilter>();
            mr = go.AddComponent<MeshRenderer>();
            mesh = new Mesh();
            mesh.name = "ChunkMesh";
            mf.sharedMesh = mesh;
            mr.sharedMaterials = Mats.Chunk;
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mr.receiveShadows = false;
            mr.lightProbeUsage = LightProbeUsage.Off;
            mr.reflectionProbeUsage = ReflectionProbeUsage.Off;
        }

        public void Upload(MeshData md)
        {
            mesh.Clear();
            if (md.verts.Count == 0) { mr.enabled = false; return; }
            mr.enabled = true;
            if (md.verts.Count > 65000) mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(md.verts);
            mesh.SetUVs(0, md.uvs);
            mesh.SetUVs(1, md.uv2);
            mesh.SetColors(md.colors);
            mesh.subMeshCount = 3;
            for (int i = 0; i < 3; i++) mesh.SetTriangles(md.tris[i], i, false);
            mesh.bounds = new Bounds(new Vector3(8, 64, 8), new Vector3(16, 128, 16));
        }

        public void Destroy()
        {
            if (mesh != null) Object.Destroy(mesh);
            if (go != null) Object.Destroy(go);
        }
    }
}
