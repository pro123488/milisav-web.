using UnityEngine;

namespace MundoBloques
{
    public enum ProjKind { Arrow, Fireball, Pearl, Eye, Snowball, Egg }

    /// <summary>Flechas, bolas de fuego, perlas eteras, ojos del Final.</summary>
    public sealed class Projectile : Entity
    {
        public ProjKind kind;
        public Entity owner;
        public float damage = 4f, life;
        public bool stuck;
        float stuckTime;
        Vector3 target;      // para el ojo del Final
        float eyeT;
        Transform visual;
        public override bool Attackable { get { return false; } }

        public static Projectile Spawn(ProjKind kind, Vector3 pos, Vector3 vel, Entity owner, float damage)
        {
            var go = new GameObject("Proj " + kind);
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var p = go.AddComponent<Projectile>();
            p.kind = kind; p.vel = vel; p.owner = owner; p.damage = damage;
            p.width = 0.25f; p.height = 0.25f; p.stepHeight = 0;
            p.noGravity = kind == ProjKind.Fireball || kind == ProjKind.Eye;
            p.BuildVisual();
            return p;
        }

        public static Projectile SpawnEye(Vector3 pos, Vector3 target, Entity owner)
        {
            var p = Spawn(ProjKind.Eye, pos, Vector3.zero, owner, 0);
            p.target = target;
            return p;
        }

        void BuildVisual()
        {
            var v = new GameObject("vis");
            v.transform.SetParent(transform, false);
            visual = v.transform;
            var mf = v.AddComponent<MeshFilter>(); var mr = v.AddComponent<MeshRenderer>();
            string key = kind == ProjKind.Arrow ? "arrow" : kind == ProjKind.Fireball ? "blaze_powder" : kind == ProjKind.Pearl ? "ender_pearl" : kind == ProjKind.Eye ? "eye_of_end" : kind == ProjKind.Snowball ? "snowball" : "egg";
            var it = Items.Get(key);
            mf.sharedMesh = ItemMeshes.Get(it);
            mr.sharedMaterial = Mats.Item;
            v.transform.localScale = Vector3.one * (kind == ProjKind.Arrow ? 0.7f : 0.35f);
            if (kind == ProjKind.Arrow)
            {
                // segunda lamina girada 90 grados sobre el eje de la flecha: se ve desde cualquier lado
                var v2 = new GameObject("vis2");
                v2.transform.SetParent(v.transform, false);
                v2.transform.localRotation = Quaternion.AngleAxis(90f, new Vector3(1f, 1f, 0f).normalized);
                v2.AddComponent<MeshFilter>().sharedMesh = mf.sharedMesh;
                var mr2 = v2.AddComponent<MeshRenderer>(); mr2.sharedMaterial = Mats.Item;
                var mpb2 = new MaterialPropertyBlock(); mpb2.SetFloat("_ObjLight", 1f); mr2.SetPropertyBlock(mpb2);
            }
            var mpb = new MaterialPropertyBlock(); mpb.SetFloat("_ObjLight", 1f); mr.SetPropertyBlock(mpb);
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (G == null || G.paused || W == null) return;
            life += dt;
            if (life > 30f) { Destroy(gameObject); return; }
            if (kind == ProjKind.Eye) { UpdateEye(dt); return; }
            if (stuck)
            {
                stuckTime += dt;
                if (stuckTime > 40f) Destroy(gameObject);
                // recoger flechas
                var pl = G.player;
                if (kind == ProjKind.Arrow && pl != null && stuckTime > 0.5f && (pl.transform.position + Vector3.up - transform.position).sqrMagnitude < 1.5f && owner != null && owner.IsPlayer)
                {
                    var left = pl.inv.Add(new ItemStack(Items.Get("arrow"), 1));
                    if (left.IsEmpty) { Sfx.Play(Clip.Pop, transform.position, 0.5f); Destroy(gameObject); }
                }
                return;
            }
            Vector3 from = transform.position;
            if (kind == ProjKind.Arrow || kind == ProjKind.Snowball || kind == ProjKind.Egg || kind == ProjKind.Pearl) vel.y -= (kind == ProjKind.Arrow ? 12f : 22f) * dt;
            Vector3 step = vel * dt;
            float len = step.magnitude;
            if (len > 0)
            {
                var hit = Phys.Raycast(W, from, step, len + 0.05f, false);
                float ed;
                var e = EntityRay(from, step.normalized, len + 0.2f, out ed);
                if (e != null && (!hit.hit || ed < hit.dist)) { HitEntity(e); return; }
                if (hit.hit) { HitBlock(hit); return; }
            }
            transform.position = from + step;
            if (visual != null && vel.sqrMagnitude > 0.01f)
            {
                visual.rotation = kind == ProjKind.Arrow ? Quaternion.LookRotation(vel.normalized) * Quaternion.Euler(0, -90, -45) : Quaternion.Euler(0, life * 360f, 0);
            }
            if (kind == ProjKind.Fireball && Random.value < dt * 30f) Particles.Burst(transform.position, new Color32(255, 150, 30, 255), 1, 0.5f, 0.12f, 0.3f);
            if (kind == ProjKind.Pearl && Random.value < dt * 30f) Particles.Burst(transform.position, new Color32(120, 40, 220, 255), 1, 0.5f, 0.1f, 0.4f);
            var bl = W.GetBlock(Mathf.FloorToInt(transform.position.x), Mathf.FloorToInt(transform.position.y), Mathf.FloorToInt(transform.position.z));
            if (bl.fluid && kind != ProjKind.Fireball) { if (kind == ProjKind.Arrow) { vel *= 0.9f; } else { Destroy(gameObject); } }
        }

        Entity EntityRay(Vector3 o, Vector3 d, float max, out float dist)
        {
            Entity best = null; dist = max;
            for (int i = 0; i < All.Count; i++)
            {
                var e = All[i];
                if (e == null || e.dead || e == this || e == owner || e is ItemEntity || e is Projectile || !e.Attackable) continue;
                if (life < 0.15f && e == owner) continue;
                var bx = e.Box.Grow(0.15f);
                float t = bx.Ray(o, d, dist);
                if (t >= 0 && t < dist) { dist = t; best = e; }
            }
            return best;
        }

        void HitEntity(Entity e)
        {
            switch (kind)
            {
                case ProjKind.Arrow:
                    e.Damage(damage * Mathf.Clamp(vel.magnitude / 25f, 0.4f, 1.3f), transform.position - vel, owner, 0.5f);
                    Sfx.Play(Clip.Hit, transform.position, 0.6f);
                    break;
                case ProjKind.Fireball:
                    e.Damage(5f, transform.position - vel, owner, 0.5f); e.SetOnFire(5f);
                    G.Explode(transform.position, 1.2f, owner, false, true);
                    break;
                case ProjKind.Pearl:
                    TeleportOwner(); break;
                case ProjKind.Snowball: e.Damage(0.1f, transform.position - vel, owner, 0.4f); break;
                case ProjKind.Egg: e.Damage(0.1f, transform.position - vel, owner, 0.4f); break;
            }
            if (kind != ProjKind.Pearl) Destroy(gameObject);
        }

        void HitBlock(Phys.Hit hit)
        {
            switch (kind)
            {
                case ProjKind.Arrow:
                    transform.position = hit.point - vel.normalized * 0.05f;
                    vel = Vector3.zero; stuck = true; noGravity = true;
                    Sfx.Play(Clip.Hit, transform.position, 0.5f, 1.4f);
                    break;
                case ProjKind.Fireball:
                    G.Explode(hit.point, 1.4f, owner, false, true); Destroy(gameObject); break;
                case ProjKind.Pearl:
                    transform.position = hit.point + new Vector3(Block.DX[hit.face], Block.DY[hit.face], Block.DZ[hit.face]) * 0.4f;
                    TeleportOwner(); break;
                case ProjKind.Egg:
                    if (Random.value < 0.125f) G.SpawnMob("chicken", transform.position, true);
                    Destroy(gameObject); break;
                default: Particles.Burst(hit.point, new Color32(240, 245, 250, 255), 6, 1.5f, 0.1f, 0.4f); Destroy(gameObject); break;
            }
        }

        void TeleportOwner()
        {
            if (owner != null && !owner.dead)
            {
                Particles.Burst(owner.transform.position + Vector3.up, new Color32(130, 50, 220, 255), 20, 2f);
                var p = transform.position;
                var op = owner as Player;
                if (op != null) op.Dismount();
                owner.transform.position = new Vector3(p.x, p.y + 0.05f, p.z);
                owner.vel = Vector3.zero; owner.fallDistance = 0;
                if (owner.IsPlayer && !G.creative) owner.Damage(5f, p, null, 0f);
                Sfx.Play(Clip.Teleport, p, 1f);
                Particles.Burst(p + Vector3.up, new Color32(130, 50, 220, 255), 20, 2f);
            }
            Destroy(gameObject);
        }

        void UpdateEye(float dt)
        {
            eyeT += dt;
            var flat = new Vector3(target.x - transform.position.x, 0, target.z - transform.position.z);
            Vector3 dir = flat.sqrMagnitude > 1f ? flat.normalized : Vector3.zero;
            float rise = eyeT < 1.2f ? 2.5f : -1.2f;
            transform.position += (dir * 7f + new Vector3(0, rise, 0)) * dt;
            Particles.Burst(transform.position, new Color32(80, 255, 180, 255), 1, 0.5f, 0.1f, 0.5f);
            if (visual != null) visual.rotation = Quaternion.Euler(0, eyeT * 360f, 0);
            if (eyeT > 2.6f)
            {
                if (Random.value < 0.8f) ItemEntity.Spawn(transform.position, new ItemStack(Items.Get("eye_of_end"), 1), new Vector3(0, 3f, 0));
                else Particles.Burst(transform.position, new Color32(80, 255, 180, 255), 20, 2.5f);
                Destroy(gameObject);
            }
        }
    }
}
