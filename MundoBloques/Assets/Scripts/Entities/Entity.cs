using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Base de todo lo que se mueve en el mundo (jugador, mobs, objetos). Usa la fisica de cajas propia.</summary>
    public abstract class Entity : MonoBehaviour
    {
        public static readonly List<Entity> All = new List<Entity>();

        public Vector3 vel;
        public float width = 0.6f, height = 1.8f;
        public float health = 20f, maxHealth = 20f;
        public bool dead;
        public bool onGround, inWater, headInWater, inLava, hitWall, onLadder;
        public float fallDistance;
        public float invuln, hurtFlash, burn, rainImmune;
        public bool noGravity;
        public float stepHeight = 0.6f;
        public float airTime;
        public string label = "";

        protected static GameRoot G { get { return GameRoot.I; } }
        protected static World W { get { return GameRoot.I.world; } }

        public virtual bool IsPlayer { get { return false; } }
        public virtual bool Hostile { get { return false; } }
        public virtual bool Attackable { get { return true; } }
        public virtual float EyeHeight { get { return height * 0.9f; } }
        public Vector3 Pos { get { return transform.position; } set { transform.position = value; } }
        public Vector3 Eye { get { return transform.position + new Vector3(0, EyeHeight, 0); } }
        public AABB Box { get { return AABB.At(transform.position, width, height); } }

        protected virtual void OnEnable() { All.Add(this); }
        protected virtual void OnDisable() { All.Remove(this); }

        // ---------------------------------------------------------------- medio (agua/lava)
        protected void UpdateMedia()
        {
            var w = W; var p = transform.position;
            var feet = w.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y + 0.1f), Mathf.FloorToInt(p.z));
            var head = w.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y + EyeHeight), Mathf.FloorToInt(p.z));
            var mid = w.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y + height * 0.5f), Mathf.FloorToInt(p.z));
            inWater = B.IsWaterlike(feet) || B.IsWaterlike(mid);
            headInWater = B.IsWaterlike(head);
            inLava = feet.isLava || mid.isLava;
            onLadder = feet == B.Ladder || mid == B.Ladder;
        }

        /// <summary>Gravedad + colisiones. La velocidad horizontal la gestiona cada entidad.</summary>
        protected void StepPhysics(float dt, bool applyGravity = true)
        {
            var w = W;
            UpdateMedia();
            if (applyGravity && !noGravity)
            {
                float g = inWater ? 7f : (inLava ? 6f : 32f);
                vel.y -= g * dt;
                float term = inWater ? -4f : (inLava ? -3f : -58f);
                if (vel.y < term) vel.y = term;
            }
            var box = Box;
            var d = vel * dt;
            var want = d;
            bool grounded, hitH;
            bool was = onGround;
            Phys.Move(w, ref box, ref d, stepHeight, was, out grounded, out hitH);
            hitWall = hitH;
            if (Mathf.Abs(d.x - want.x) > 1e-4f) vel.x = 0;
            if (Mathf.Abs(d.z - want.z) > 1e-4f) vel.z = 0;
            if (Mathf.Abs(d.y - want.y) > 1e-4f) vel.y = 0;
            onGround = grounded;
            transform.position = box.Feet;
            if (d.y < 0 && !onGround && !inWater) fallDistance -= d.y;
            if (inWater || inLava) fallDistance = 0;
            if (onGround)
            {
                if (fallDistance > 0) OnLand(fallDistance);
                fallDistance = 0;
            }
            if (transform.position.y < -40f) OnVoid();
        }

        protected virtual void OnLand(float dist) { }
        protected virtual void OnVoid() { Damage(4f * Time.deltaTime * 60f, Vector3.up, null, 0f); }

        // ---------------------------------------------------------------- dano
        public virtual void Damage(float amount, Vector3 from, Entity src, float knock = 0.5f)
        {
            if (dead || amount <= 0f) return;
            if (invuln > 0f && amount < 1000f) return;
            health -= amount;
            invuln = 0.4f; hurtFlash = 0.25f;
            if (knock > 0f)
            {
                var dir = transform.position - from; dir.y = 0;
                if (dir.sqrMagnitude < 0.0001f) dir = Random.insideUnitSphere;
                dir.y = 0; dir.Normalize();
                vel.x = dir.x * 6f * knock * 2f; vel.z = dir.z * 6f * knock * 2f; vel.y = 5f * Mathf.Clamp01(knock * 1.5f);
                onGround = false;
            }
            OnHurt(amount, src);
            if (health <= 0f) { health = 0; Die(src); }
        }

        protected virtual void OnHurt(float amount, Entity src) { Sfx.Play(Clip.Hurt, transform.position, 0.7f); }
        public virtual void Die(Entity killer) { if (dead) return; dead = true; Destroy(gameObject); }
        public virtual void Heal(float a) { health = Mathf.Min(maxHealth, health + a); }

        protected void TickTimers(float dt)
        {
            if (invuln > 0) invuln -= dt;
            if (hurtFlash > 0) hurtFlash -= dt;
            if (rainImmune > 0f) rainImmune -= dt;
            if (burn > 0)
            {
                burn -= dt;
                if (inWater || (rainImmune <= 0f && G.weather != null && G.weather.Wet(W, transform.position + Vector3.up * (height * 0.5f)))) burn = 0;
                else if (Mathf.FloorToInt(burn * 2f) != Mathf.FloorToInt((burn + dt) * 2f)) { Damage(1f, transform.position, null, 0f); invuln = 0; }
            }
            if (inLava) { if (burn < 6f) burn = 6f; if (Random.value < dt * 2.5f) { Damage(4f, transform.position, null, 0f); } }
        }

        public void SetOnFire(float seconds) { if (!inWater && burn < seconds) burn = seconds; }

        // ---------------------------------------------------------------- utilidades
        public static Entity Closest(Vector3 p, float r, System.Func<Entity, bool> pred)
        {
            Entity best = null; float bd = r * r;
            for (int i = 0; i < All.Count; i++)
            {
                var e = All[i];
                if (e == null || e.dead || !pred(e)) continue;
                float d = (e.transform.position - p).sqrMagnitude;
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        }

        /// <summary>Ray vs entidades; devuelve la mas cercana y la distancia.</summary>
        public static Entity Raycast(Vector3 o, Vector3 d, float max, Entity ignore, out float dist)
        {
            Entity best = null; dist = max;
            for (int i = 0; i < All.Count; i++)
            {
                var e = All[i];
                if (e == null || e == ignore || e.dead || !e.Attackable) continue;
                var bx = e.Box.Grow(0.1f);
                float t = bx.Ray(o, d, dist);
                if (t >= 0f && t < dist) { dist = t; best = e; }
            }
            return best;
        }

        public float LightAt()
        {
            var p = transform.position;
            int x = Mathf.FloorToInt(p.x), y = Mathf.FloorToInt(p.y + height * 0.6f), z = Mathf.FloorToInt(p.z);
            int l = W.LightPacked(x, y, z);
            float sky = (l >> 4) / 15f * G.skyBrightness, blk = (l & 15) / 15f;
            return Mathf.Max(sky, blk);
        }
    }
}
