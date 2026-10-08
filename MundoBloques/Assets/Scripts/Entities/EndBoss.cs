using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Cristal del Final: cura al dragon; al romperse explota.</summary>
    public sealed class EndCrystal : Entity
    {
        Transform core, frame;
        float t;
        public static int Alive;
        public override float EyeHeight { get { return 1f; } }

        public static EndCrystal Create(Vector3 pos)
        {
            var go = new GameObject("EndCrystal");
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos - new Vector3(0, 1f, 0);
            var e = go.AddComponent<EndCrystal>();
            e.width = 1.4f; e.height = 2f; e.health = e.maxHealth = 1f; e.noGravity = true;
            e.core = Make(go.transform, 8, 0xFF60E8, 0.0f);
            e.frame = Make(go.transform, 12, 0xE8D0FF, 0.0f);
            return e;
        }

        static Transform Make(Transform parent, float s, uint c, float y)
        {
            var g = new GameObject("c");
            g.transform.SetParent(parent, false);
            g.transform.localPosition = new Vector3(0, 1f, 0);
            g.AddComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(new Vector3(s, s, s), Col.Hex(c));
            var mr = g.AddComponent<MeshRenderer>(); mr.sharedMaterial = Mats.Mob;
            var mpb = new MaterialPropertyBlock(); mpb.SetFloat("_ObjLight", 1f); mr.SetPropertyBlock(mpb);
            return g.transform;
        }

        protected override void OnEnable() { base.OnEnable(); Alive++; }
        protected override void OnDisable() { base.OnDisable(); Alive--; }

        void Update()
        {
            if (G == null || G.paused) return;
            t += Time.deltaTime;
            core.localRotation = Quaternion.Euler(t * 80f, t * 120f, 0);
            frame.localRotation = Quaternion.Euler(t * 50f + 45f, -t * 70f, t * 30f);
            core.localPosition = new Vector3(0, 1f + Mathf.Sin(t * 2f) * 0.15f, 0);
            frame.localPosition = core.localPosition;
            if (Random.value < Time.deltaTime * 6f) Particles.Burst(transform.position + Vector3.up, new Color32(255, 100, 230, 255), 1, 0.6f, 0.1f, 0.8f, new Vector3(0.4f, 0.4f, 0.4f));
        }

        public override void Damage(float amount, Vector3 from, Entity src, float knock = 0.5f)
        {
            if (dead) return;
            dead = true;
            var p = transform.position + Vector3.up;
            Destroy(gameObject);
            G.Explode(p, 4f, src, true, false);
            var d = Dragon.Instance;
            if (d != null && (d.transform.position - p).sqrMagnitude < 90f * 90f) d.Damage(12f, p, src, 0f);
        }
    }

    /// <summary>Dragon del Final: jefe final con fases de vuelo orbital, rafagas de fuego y embestidas.</summary>
    public sealed class Dragon : Entity
    {
        public static Dragon Instance;
        Transform modelRoot, wingL, wingR;
        readonly List<Transform> tail = new List<Transform>();
        readonly List<Vector3> tailPos = new List<Vector3>();
        float t, phaseTimer, orbit, shootT;
        int phase;           // 0 orbitar, 1 rafagas, 2 embestida
        Vector3 dir = Vector3.forward;
        int shots;
        bool deathAnim; float deathT;
        MaterialPropertyBlock mpb;
        readonly List<Renderer> rends = new List<Renderer>();
        public override bool Hostile { get { return true; } }

        public static Dragon Create(Vector3 pos)
        {
            var go = new GameObject("Dragon");
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var d = go.AddComponent<Dragon>();
            d.width = 5f; d.height = 3f; d.health = d.maxHealth = 200f; d.noGravity = true;
            d.orbit = Random.value * 6.28f;
            d.Build();
            Instance = d;
            return d;
        }

        Transform Cube(Transform parent, string name, Vector3 sizePx, Vector3 posPx, uint color, float scale)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = posPx * (scale / 16f);
            var m = new GameObject("m"); m.transform.SetParent(g.transform, false);
            m.transform.localScale = Vector3.one * scale;
            m.AddComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(sizePx, Col.Hex(color));
            var mr = m.AddComponent<MeshRenderer>(); mr.sharedMaterial = Mats.Mob; rends.Add(mr);
            return g.transform;
        }

        void Build()
        {
            const float s = 1.6f;
            modelRoot = new GameObject("model").transform;
            modelRoot.SetParent(transform, false);
            modelRoot.localPosition = new Vector3(0, 1.5f, 0);
            Cube(modelRoot, "body", new Vector3(12, 10, 26), Vector3.zero, 0x1A1A24, s);
            Cube(modelRoot, "back", new Vector3(8, 2, 20), new Vector3(0, 6, -1), 0x2A2A3A, s);
            var neck = Cube(modelRoot, "neck", new Vector3(8, 8, 10), new Vector3(0, 2, 16), 0x20202C, s);
            var head = Cube(modelRoot, "head", new Vector3(10, 9, 12), new Vector3(0, 3, 26), 0x181820, s);
            Cube(modelRoot, "jaw", new Vector3(8, 3, 10), new Vector3(0, -3, 28), 0x101018, s);
            Cube(modelRoot, "eyeL", new Vector3(2, 2, 1), new Vector3(-3.5f, 6, 32.2f), 0xE060FF, s);
            Cube(modelRoot, "eyeR", new Vector3(2, 2, 1), new Vector3(3.5f, 6, 32.2f), 0xE060FF, s);
            Cube(modelRoot, "hornL", new Vector3(2, 4, 2), new Vector3(-4, 9, 24), 0x8A8A9A, s);
            Cube(modelRoot, "hornR", new Vector3(2, 4, 2), new Vector3(4, 9, 24), 0x8A8A9A, s);
            wingL = new GameObject("wingL").transform; wingL.SetParent(modelRoot, false); wingL.localPosition = new Vector3(-5, 4, 6) * (s / 16f);
            wingR = new GameObject("wingR").transform; wingR.SetParent(modelRoot, false); wingR.localPosition = new Vector3(5, 4, 6) * (s / 16f);
            Cube(wingL, "wl", new Vector3(30, 2, 14), new Vector3(-15, 0, 0), 0x2E2E40, s);
            Cube(wingL, "wl2", new Vector3(26, 1, 10), new Vector3(-14, 0, -11), 0x1A1A28, s);
            Cube(wingR, "wr", new Vector3(30, 2, 14), new Vector3(15, 0, 0), 0x2E2E40, s);
            Cube(wingR, "wr2", new Vector3(26, 1, 10), new Vector3(14, 0, -11), 0x1A1A28, s);
            for (int i = 0; i < 7; i++)
            {
                float sz = 8 - i * 0.8f;
                var tr = Cube(modelRoot, "tail" + i, new Vector3(sz, sz * 0.9f, 8), new Vector3(0, 0, -16 - i * 8), 0x1A1A24 + (uint)(i * 0x010103), s);
                tail.Add(tr); tailPos.Add(tr.localPosition);
            }
            mpb = new MaterialPropertyBlock(); mpb.SetFloat("_ObjLight", 0.85f);
            foreach (var r in rends) r.SetPropertyBlock(mpb);
            G.ui.SetBoss("Dragón del Final", 1f);
        }

        void Update()
        {
            if (G == null || G.paused || W == null) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            t += dt; shootT -= dt; phaseTimer -= dt;
            if (deathAnim) { DeathUpdate(dt); return; }
            TickTimers(dt);
            var pl = G.player;
            Vector3 target;
            float speed = 15f;
            Vector3 center = new Vector3(0, 80, 0);
            if (phaseTimer <= 0f)
            {
                phase = (phase + 1 + Random.Range(0, 2)) % 3;
                phaseTimer = phase == 0 ? Random.Range(8f, 14f) : (phase == 1 ? 9f : 6f);
                shots = 0;
                if (phase == 2) Sfx.Play(Clip.Roar, transform.position, 1f);
            }
            if (pl == null || pl.dead || G.creative && false) phase = 0;
            switch (phase)
            {
                case 1:
                    {
                        orbit += dt * 0.35f;
                        target = center + new Vector3(Mathf.Cos(orbit) * 28f, Mathf.Sin(t) * 4f, Mathf.Sin(orbit) * 28f);
                        speed = 13f;
                        if (shootT <= 0f && pl != null && shots < 6)
                        {
                            shootT = 1.1f; shots++;
                            var dd = (pl.Eye - transform.position).normalized;
                            var fb = Projectile.Spawn(ProjKind.Fireball, transform.position + Vector3.up * 2f + dd * 4f, dd * 15f, this, 6f);
                            Sfx.Play(Clip.Roar, transform.position, 0.8f, 1.4f);
                        }
                        break;
                    }
                case 2:
                    target = pl != null ? pl.transform.position + Vector3.up : center; speed = 22f;
                    if (pl != null && (pl.transform.position + Vector3.up * 1f - transform.position).sqrMagnitude < 20f)
                    {
                        if (!pl.dead && pl.invuln <= 0f) { pl.Damage(9f, transform.position, this, 1.6f); }
                    }
                    break;
                default:
                    orbit += dt * 0.38f;
                    target = center + new Vector3(Mathf.Cos(orbit) * 38f, Mathf.Sin(t * 0.6f) * 8f, Mathf.Sin(orbit) * 38f);
                    break;
            }
            var to = target - transform.position;
            var want = to.sqrMagnitude > 0.1f ? to.normalized : dir;
            dir = Vector3.Slerp(dir, want, 1f - Mathf.Exp(-(phase == 2 ? 3.5f : 2f) * dt)).normalized;
            transform.position += dir * speed * dt;
            // orientacion
            var look = Quaternion.LookRotation(dir, Vector3.up);
            modelRoot.rotation = Quaternion.Slerp(modelRoot.rotation, look, 1f - Mathf.Exp(-5f * dt));
            wingL.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(t * 3.2f) * 25f + 8f);
            wingR.localRotation = Quaternion.Euler(0, 0, -Mathf.Sin(t * 3.2f) * 25f - 8f);
            for (int i = 0; i < tail.Count; i++) tail[i].localRotation = Quaternion.Euler(Mathf.Sin(t * 2f - i * 0.5f) * 6f, Mathf.Sin(t * 1.4f - i * 0.6f) * 12f, 0);
            // curacion por cristales
            if (EndCrystal.Alive > 0 && health < maxHealth) { health = Mathf.Min(maxHealth, health + EndCrystal.Alive * 0.8f * dt); }
            G.ui.SetBoss("Dragón del Final", health / maxHealth);
            hurtFlash = Mathf.Max(0f, hurtFlash);
            mpb.SetColor("_Tint", hurtFlash > 0 ? new Color(1f, 0.5f, 0.5f) : Color.white);
            foreach (var r in rends) r.SetPropertyBlock(mpb);
            if (Random.value < dt * 0.4f) Sfx.Play(Clip.Roar, transform.position, 0.6f, Random.Range(0.8f, 1.2f));
            if (Random.value < dt * 20f) Particles.Burst(transform.position + Random.insideUnitSphere * 2f, new Color32(150, 60, 230, 255), 1, 0.5f, 0.12f, 0.7f);
        }

        protected override void OnHurt(float amount, Entity src) { Sfx.Play(Clip.Hit, transform.position, 1f, 0.5f); }

        public override void Die(Entity killer)
        {
            if (deathAnim) return;
            deathAnim = true; deathT = 0f;
            G.ui.SetBoss(null, 0f);
            Sfx.Play(Clip.Roar, transform.position, 1f, 0.5f);
        }

        void DeathUpdate(float dt)
        {
            deathT += dt;
            transform.position += Vector3.down * 2f * dt;
            modelRoot.localRotation *= Quaternion.Euler(0, 40f * dt, 0);
            if (Random.value < dt * 40f) Particles.Burst(transform.position + Random.insideUnitSphere * 3f, new Color32(255, 200, 255, 255), 4, 3f, 0.2f, 1f);
            if (deathT > 4f)
            {
                Instance = null;
                G.OnDragonDefeated(transform.position);
                dead = true;
                Destroy(gameObject);
            }
        }

        void OnDestroy() { if (Instance == this) Instance = null; }
    }
}
