using UnityEngine;

namespace MundoBloques
{
    /// <summary>Objeto suelto en el suelo que se recoge al acercarse.</summary>
    public sealed class ItemEntity : Entity
    {
        public ItemStack stack;
        public float age, pickupDelay = 0.6f;
        Transform model;
        float bobSeed;

        public override bool Attackable { get { return false; } }

        public static ItemEntity Spawn(Vector3 pos, ItemStack s, Vector3 vel, float delay = 0.6f)
        {
            if (s.IsEmpty) return null;
            var go = new GameObject("Item " + s.item.key);
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var e = go.AddComponent<ItemEntity>();
            e.stack = s; e.vel = vel; e.pickupDelay = delay;
            e.width = 0.25f; e.height = 0.25f; e.stepHeight = 0f;
            e.BuildModel();
            return e;
        }

        void BuildModel()
        {
            var m = new GameObject("model");
            m.transform.SetParent(transform, false);
            var mf = m.AddComponent<MeshFilter>(); var mr = m.AddComponent<MeshRenderer>();
            mf.sharedMesh = ItemMeshes.Get(stack.item);
            mr.sharedMaterial = ItemMeshes.IsFlat(stack.item) ? Mats.Item : (stack.item.block != null && (stack.item.block.cutout || stack.item.block.shape == Shape.Cross) ? Mats.Cutout : Mats.Opaque);
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            bool cube = stack.item.block != null && (stack.item.block.shape == Shape.Cube || stack.item.block.shape == Shape.Box || stack.item.block.shape == Shape.Slab || stack.item.block.shape == Shape.Stairs);
            m.transform.localScale = Vector3.one * (cube ? 0.28f : 0.4f);
            model = m.transform;
            bobSeed = Random.value * 6.28f;
            var mpb = new MaterialPropertyBlock();
            mr.GetPropertyBlock(mpb);
            mpb.SetFloat("_ObjLight", 0.9f);
            mr.SetPropertyBlock(mpb);
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (G == null || G.paused || W == null) return;
            age += dt;
            if (age > 300f) { Destroy(gameObject); return; }
            if (pickupDelay > 0) pickupDelay -= dt;
            vel.x *= Mathf.Pow(onGround ? 0.02f : 0.6f, dt);
            vel.z *= Mathf.Pow(onGround ? 0.02f : 0.6f, dt);
            if (inWater) { vel.y += 30f * dt; vel.y = Mathf.Min(vel.y, 1.5f); }
            if (inLava) { Burn(); return; }
            StepPhysics(dt);
            if (model != null)
            {
                model.localPosition = new Vector3(0, 0.22f + Mathf.Sin(age * 2.5f + bobSeed) * 0.05f, 0);
                model.localRotation = Quaternion.Euler(0, age * 70f + bobSeed * 20f, 0);
            }
            // fusionar con vecinos
            if (age > 0.5f && Mathf.FloorToInt(age * 4f) != Mathf.FloorToInt((age - dt) * 4f))
            {
                for (int i = 0; i < All.Count; i++)
                {
                    var o = All[i] as ItemEntity;
                    if (o == null || o == this || o.dead || !o.stack.SameKind(stack)) continue;
                    if ((o.transform.position - transform.position).sqrMagnitude > 1f) continue;
                    if (o.stack.count + stack.count > stack.Max) continue;
                    o.stack.count += stack.count; o.age = Mathf.Min(o.age, age); dead = true; Destroy(gameObject); return;
                }
            }
            // atraer y recoger
            var p = G.player;
            if (p != null && !p.dead && pickupDelay <= 0f)
            {
                var d = (p.transform.position + Vector3.up * 0.8f) - transform.position;
                float dist = d.magnitude;
                if (dist < 1.7f) { vel += d.normalized * 18f * dt; vel.y += 0.2f; noGravity = dist < 0.9f; }
                else noGravity = false;
                if (dist < 0.9f)
                {
                    var left = p.inv.Add(stack);
                    int taken = stack.count - left.count;
                    if (taken > 0) { Sfx.Play(Clip.Pop, transform.position, 0.5f, Random.Range(1f, 1.5f)); G.ui.OnPickup(stack.item, taken); }
                    if (left.IsEmpty) { dead = true; Destroy(gameObject); }
                    else stack = left;
                }
            }
        }

        void Burn()
        {
            Particles.Burst(transform.position, new Color32(255, 140, 20, 255), 6, 2f, 0.1f, 0.4f);
            Sfx.Play(Clip.Fizz, transform.position, 0.4f);
            dead = true; Destroy(gameObject);
        }
    }
}
