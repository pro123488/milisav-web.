using UnityEngine;

namespace MundoBloques
{
    /// <summary>Bloque cayendo (arena, grava).</summary>
    public sealed class FallingBlockEntity : Entity
    {
        public Block block;
        float age;
        public override bool Attackable { get { return false; } }

        public static void Spawn(int x, int y, int z, Block b)
        {
            var go = new GameObject("Falling " + b.key);
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = new Vector3(x + 0.5f, y, z + 0.5f);
            var e = go.AddComponent<FallingBlockEntity>();
            e.block = b; e.width = 0.98f; e.height = 0.98f; e.stepHeight = 0;
            var m = new GameObject("model");
            m.transform.SetParent(go.transform, false);
            m.transform.localPosition = new Vector3(0, 0.5f, 0);
            var it = b.item;
            m.AddComponent<MeshFilter>().sharedMesh = ItemMeshes.Get(it);
            var mr = m.AddComponent<MeshRenderer>(); mr.sharedMaterial = Mats.Opaque;
            var mpb = new MaterialPropertyBlock(); mpb.SetFloat("_ObjLight", 0.9f); mr.SetPropertyBlock(mpb);
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (G == null || G.paused || G.world == null) return;
            age += dt;
            StepPhysics(dt);
            if (onGround || age > 10f)
            {
                int x = Mathf.FloorToInt(transform.position.x), y = Mathf.FloorToInt(transform.position.y + 0.1f), z = Mathf.FloorToInt(transform.position.z);
                var cur = W.GetBlock(x, y, z);
                if (cur.id == 0 || cur.replaceable || cur.shape == Shape.Cross) W.SetBlock(x, y, z, block);
                else ItemEntity.Spawn(transform.position + Vector3.up * 0.3f, new ItemStack(block.item, 1), Vector3.up * 2f);
                Sfx.Block(block.sound, transform.position);
                dead = true; Destroy(gameObject);
            }
        }
    }

    /// <summary>TNT encendido.</summary>
    public sealed class PrimedTnt : Entity
    {
        float fuse = 4f;
        MaterialPropertyBlock mpb;
        MeshRenderer mr;
        public override bool Attackable { get { return false; } }

        public static PrimedTnt Spawn(Vector3 pos, float fuse = 4f, Vector3? v = null)
        {
            var go = new GameObject("TNT");
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var e = go.AddComponent<PrimedTnt>();
            e.fuse = fuse; e.width = 0.98f; e.height = 0.98f; e.stepHeight = 0;
            e.vel = v ?? new Vector3(Random.Range(-1f, 1f), 4f, Random.Range(-1f, 1f));
            var m = new GameObject("model");
            m.transform.SetParent(go.transform, false);
            m.transform.localPosition = new Vector3(0, 0.5f, 0);
            m.AddComponent<MeshFilter>().sharedMesh = ItemMeshes.Get(B.Tnt.item);
            e.mr = m.AddComponent<MeshRenderer>(); e.mr.sharedMaterial = Mats.Opaque;
            e.mpb = new MaterialPropertyBlock();
            Sfx.Play(Clip.Fizz, pos, 1f);
            return e;
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (G == null || G.paused || G.world == null) return;
            fuse -= dt;
            vel.x *= Mathf.Pow(0.05f, dt); vel.z *= Mathf.Pow(0.05f, dt);
            StepPhysics(dt);
            bool flash = Mathf.FloorToInt(fuse * 5f) % 2 == 0;
            mpb.SetColor("_Tint", flash ? Color.white : new Color(2.2f, 2.2f, 2.2f));
            mpb.SetFloat("_ObjLight", 1f);
            mr.SetPropertyBlock(mpb);
            if (fuse <= 0f)
            {
                var p = transform.position + Vector3.up * 0.5f;
                dead = true; Destroy(gameObject);
                G.Explode(p, 4f, null, true, false);
            }
        }
    }
}
