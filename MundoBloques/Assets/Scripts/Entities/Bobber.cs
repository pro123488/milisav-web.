using UnityEngine;

namespace MundoBloques
{
    /// <summary>Flotador de la cana de pescar: se lanza, flota en el agua y pica de vez en cuando.</summary>
    public sealed class Bobber : Entity
    {
        public Player owner;
        public bool Alive { get { return !dead; } }

        bool biting;
        float biteTimer = -1f, biteWindow, dip, anim, life;
        BoxModel model;
        Transform line;
        MaterialPropertyBlock lineMpb;

        public override bool Attackable { get { return false; } }
        public override float EyeHeight { get { return 0.1f; } }

        public static Bobber Cast(Player p)
        {
            var go = new GameObject("Bobber");
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = p.Eye + p.camT.forward * 0.6f - Vector3.up * 0.1f;
            var b = go.AddComponent<Bobber>();
            b.owner = p; b.width = 0.2f; b.height = 0.2f; b.stepHeight = 0f;
            b.vel = p.camT.forward * 14f + Vector3.up * 3f;
            b.BuildVisual();
            return b;
        }

        void BuildVisual()
        {
            model = new BoxModel(transform, "model");
            model.Cube("top", 3f, 2f, 3f, 0f, 3f, 0f, 0xD03030);
            model.Cube("bottom", 3f, 2f, 3f, 0f, 1f, 0f, 0xF4F4F4);
            model.Apply(1f, false);
            var l = new GameObject("line");
            l.transform.SetParent(transform, false);
            l.AddComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(Vector3.one, Col.Hex(0xE8E8E8));
            var mr = l.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Mats.Mob;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            lineMpb = new MaterialPropertyBlock(); lineMpb.SetFloat("_ObjLight", 1f); mr.SetPropertyBlock(lineMpb);
            line = l.transform;
        }

        void Update()
        {
            if (G == null || W == null || G.paused || dead) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            life += dt; anim += dt;
            if (owner == null || owner.dead || owner.bobber != this) { Retract(); return; }
            var held = owner.inv.Held;
            if (held.IsEmpty || held.item.action != "rod" || (owner.transform.position - transform.position).sqrMagnitude > 900f || life > 300f) { Retract(); return; }
            var p0 = transform.position;
            if (!W.IsLoaded(Mathf.FloorToInt(p0.x), Mathf.FloorToInt(p0.z))) return;

            float top;
            bool wet = WaterUtil.SurfaceTop(W, p0, out top);
            if (wet)
            {
                float k = Mathf.Exp(-4f * dt);
                vel.x *= k; vel.z *= k;
                float targetY = top - 0.12f - dip;
                vel.y = Mathf.Clamp((targetY - p0.y) * 10f, -3f, 3f);
                if (!biting)
                {
                    if (biteTimer < 0f) biteTimer = Random.Range(5f, 16f);
                    float speedUp = G.weather != null && G.weather.Raining ? 1.6f : 1f;
                    biteTimer -= dt * speedUp;
                    if (biteTimer <= 0f)
                    {
                        biting = true; biteWindow = 1.3f;
                        Sfx.Play(Clip.Splash, p0, 0.8f, 1.3f);
                        Particles.Burst(p0, new Color32(200, 225, 255, 255), 8, 1.5f, 0.08f, 0.5f);
                        G.ui.Hint("¡Algo ha picado! Clic derecho", 1.3f);
                    }
                    dip = Mathf.Sin(anim * 2.2f) * 0.01f;
                }
                else
                {
                    biteWindow -= dt;
                    dip = 0.2f + Mathf.Sin(anim * 30f) * 0.05f;
                    if (biteWindow <= 0f) { biting = false; dip = 0f; biteTimer = Random.Range(3f, 9f); }
                }
            }
            else
            {
                biting = false; dip = 0f; biteTimer = -1f;
                if (onGround) { float k = Mathf.Exp(-8f * dt); vel.x *= k; vel.z *= k; }
            }
            StepPhysics(dt, !wet);
        }

        void LateUpdate()
        {
            if (line == null || owner == null || dead) return;
            var cam = owner.camT;
            var tip = cam.position + cam.right * 0.32f - cam.up * 0.18f + cam.forward * 0.7f;
            var end = transform.position + Vector3.up * 0.2f;
            var d = end - tip;
            float len = d.magnitude;
            if (len < 0.05f) { line.localScale = Vector3.zero; return; }
            line.position = (tip + end) * 0.5f;
            line.rotation = Quaternion.LookRotation(d / len);
            line.localScale = new Vector3(0.3f, 0.3f, len * 16f);
        }

        void Retract()
        {
            if (owner != null && owner.bobber == this) owner.bobber = null;
            dead = true;
            Destroy(gameObject);
        }

        /// <summary>Recoge el sedal: si estaba picando, pesca algo.</summary>
        public void Reel()
        {
            if (dead || owner == null) return;
            if (biting)
            {
                var it = RollLoot(owner);
                var pos = transform.position;
                var to = owner.Eye - pos;
                G.SpawnItem(pos + Vector3.up * 0.15f, new ItemStack(it, 1), new Vector3(to.x * 1.1f, 4.5f + Mathf.Clamp(to.y, 0f, 5f) * 0.9f, to.z * 1.1f));
                Sfx.Play(Clip.Splash, pos, 0.9f, 1.2f);
                Particles.Burst(pos, new Color32(190, 220, 255, 255), 14, 2.5f, 0.1f, 0.6f);
                owner.fishCaught++;
                owner.WearHeld(1);
                G.ui.Hint("¡Has pescado: " + it.name + "!", 1.8f);
            }
            else Sfx.Play(Clip.Cast, owner.transform.position, 0.5f, 1.4f);
            Retract();
        }

        static Item RollLoot(Player p)
        {
            var rng = GameRoot.I.rand;
            float r = rng.Float();
            if (r < 0.52f) return Items.Get("cod");
            if (r < 0.80f) return Items.Get("salmon");
            if (r < 0.92f)
            {
                string[] junk = { "stick", "string", "bone", "bowl", "rotten_flesh", "leather", "feather" };
                return Items.Get(rng.Pick(junk));
            }
            string[] treasure = { "emerald", "lapis", "gold_ingot", "amethyst_shard", "ruby", "sapphire", "saddle", "golden_apple", "diamond" };
            float t = rng.Float();
            int idx = t < 0.55f ? rng.Int(4) : rng.Int(treasure.Length);
            return Items.Get(treasure[idx]);
        }
    }
}
