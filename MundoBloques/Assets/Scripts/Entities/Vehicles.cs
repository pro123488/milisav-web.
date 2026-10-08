using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Algo sobre lo que el jugador puede montarse (barco, caballo).</summary>
    public interface IMount
    {
        Player Rider { get; set; }
        Vector3 SeatPosition { get; }
        Transform MountTransform { get; }
    }

    /// <summary>Utilidades para el agua: altura de la superficie bajo una entidad.</summary>
    public static class WaterUtil
    {
        /// <summary>Busca la superficie del agua en la columna de p. Devuelve false si no hay agua cerca de los pies.</summary>
        public static bool SurfaceTop(World w, Vector3 p, out float top)
        {
            top = 0f;
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            int y0 = Mathf.FloorToInt(p.y + 0.15f);
            if (!B.IsWaterlike(w.GetBlock(x, y0, z)))
            {
                if (B.IsWaterlike(w.GetBlock(x, y0 - 1, z))) { top = (y0 - 1) + 0.88f; return true; }
                return false;
            }
            int y = y0;
            while (y < y0 + 10 && B.IsWaterlike(w.GetBlock(x, y + 1, z))) y++;
            top = y + 0.88f;
            return true;
        }
    }

    /// <summary>Modelo hecho con cajas de colores y luz del mundo, para vehiculos y objetos sencillos.</summary>
    public sealed class BoxModel
    {
        public readonly Transform root;
        readonly List<Renderer> rends = new List<Renderer>();
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        float lightTimer, light = 1f, lastFlash = -1f;

        public BoxModel(Transform parent, string name)
        {
            root = new GameObject(name).transform;
            root.SetParent(parent, false);
        }

        /// <summary>Anade una caja. Tamano y posicion en pixeles (16 = 1 bloque); la posicion es el centro.</summary>
        public Transform Cube(string name, float sx, float sy, float sz, float px, float py, float pz, uint color, Transform parent = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent != null ? parent : root, false);
            go.transform.localPosition = new Vector3(px, py, pz) / 16f;
            go.AddComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(new Vector3(sx, sy, sz), Col.Hex(color));
            go.transform.localScale = Vector3.one;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Mats.Mob;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            rends.Add(mr);
            return go.transform;
        }

        public void Apply(float lightValue, bool flash)
        {
            mpb.SetFloat("_ObjLight", lightValue);
            mpb.SetColor("_Tint", flash ? new Color(1f, 0.4f, 0.4f) : Color.white);
            for (int i = 0; i < rends.Count; i++) rends[i].SetPropertyBlock(mpb);
        }

        /// <summary>Refresca la luz cada pocos decimas de segundo.</summary>
        public void Tick(Entity e, float dt)
        {
            lightTimer -= dt;
            float flash = e.hurtFlash > 0f ? 1f : 0f;
            if (lightTimer <= 0f || flash != lastFlash)
            {
                if (lightTimer <= 0f) { lightTimer = 0.4f; light = Mathf.Clamp01(e.LightAt() * 1.05f + 0.1f); }
                lastFlash = flash;
                Apply(light, flash > 0f);
            }
        }
    }

    /// <summary>Barco de madera: flota, se conduce con W A S D y se baja con Mayus.</summary>
    public sealed class Boat : Entity, IMount
    {
        Player rider;
        public Player Rider { get { return rider; } set { rider = value; } }
        public Transform MountTransform { get { return transform; } }
        public float yaw;
        float speed, anim;
        BoxModel model;
        Transform hull;

        public override bool Attackable { get { return rider == null && !dead; } }
        public override float EyeHeight { get { return 0.4f; } }

        Vector3 Forward { get { float r = yaw * Mathf.Deg2Rad; return new Vector3(Mathf.Sin(r), 0f, Mathf.Cos(r)); } }

        public Vector3 SeatPosition { get { return transform.position + new Vector3(0f, -0.15f + Mathf.Sin(anim * 2f) * 0.01f, 0f) - Forward * 0.1f; } }

        public static Boat Spawn(Vector3 pos, float yaw)
        {
            var go = new GameObject("Boat");
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var b = go.AddComponent<Boat>();
            b.yaw = yaw; b.width = 1.4f; b.height = 0.5f; b.stepHeight = 0f;
            b.maxHealth = b.health = 6f;
            b.BuildModel();
            b.transform.rotation = Quaternion.Euler(0, yaw, 0);
            return b;
        }

        void BuildModel()
        {
            model = new BoxModel(transform, "model");
            hull = model.root;
            // medidas en pixeles: 22 de ancho x 28 de largo
            model.Cube("floor", 18, 2, 24, 0, 1, 0, 0x9C7A4A);
            model.Cube("sideL", 2, 6, 26, -10, 4, 0, 0xA9855A);
            model.Cube("sideR", 2, 6, 26, 10, 4, 0, 0xA9855A);
            model.Cube("back", 18, 6, 2, 0, 4, -12, 0x8A6A3E);
            model.Cube("front", 14, 5, 2, 0, 3.5f, 12, 0x8A6A3E);
            model.Cube("bow", 8, 4, 2, 0, 6, 14, 0xB8956A);
            model.Cube("seat", 16, 1.2f, 4, 0, 4, -2, 0x6B4F2A);
            model.Cube("seat2", 16, 1.2f, 4, 0, 4, 5, 0x6B4F2A);
        }

        void Update()
        {
            if (G == null || W == null || G.paused || dead) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            var p0 = transform.position;
            if (!W.IsLoaded(Mathf.FloorToInt(p0.x), Mathf.FloorToInt(p0.z))) return;
            anim += dt;
            TickTimers(dt);
            if (rider != null && (rider.dead || rider.mount != (IMount)this)) rider = null;

            float thr = 0f, steer = 0f;
            if (rider != null && !G.ui.IsOpen) { thr = Inp.Axis(Act.Back, Act.Forward); steer = Inp.Axis(Act.Left, Act.Right); }

            float top;
            bool wet = WaterUtil.SurfaceTop(W, p0, out top);
            if (wet)
            {
                float targetY = top - 0.2f + Mathf.Sin(anim * 2f) * 0.02f;
                vel.y = Mathf.Clamp((targetY - p0.y) * 8f, -4f, 4f);
                if (thr > 0f) speed = Mathf.MoveTowards(speed, 7.5f, 9f * dt);
                else if (thr < 0f) speed = Mathf.MoveTowards(speed, -2.5f, 9f * dt);
                else speed = Mathf.MoveTowards(speed, 0f, 2.5f * dt);
            }
            else
            {
                vel.y = Mathf.Max(vel.y - 28f * dt, -50f);
                speed = Mathf.MoveTowards(speed, thr > 0f ? 1.2f : 0f, 12f * dt);
            }
            yaw += steer * 85f * dt * (Mathf.Abs(speed) > 0.3f ? 1f : 0.6f);
            var f = Forward;
            vel.x = f.x * speed; vel.z = f.z * speed;
            StepPhysics(dt, false);
            if (hitWall) speed *= 0.4f;
            transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            if (hull != null) hull.localRotation = Quaternion.Euler(Mathf.Sin(anim * 1.7f) * 1.2f, 0f, Mathf.Sin(anim * 1.3f) * 1.5f);

            if (wet && Mathf.Abs(speed) > 2f && Random.value < dt * 18f)
                Particles.Burst(transform.position - f * 0.9f + Vector3.up * 0.1f, new Color32(235, 245, 255, 255), 1, 0.5f, 0.09f, 0.5f, new Vector3(0.5f, 0.02f, 0.5f));
            model.Tick(this, dt);
        }

        /// <summary>El jugador pulsa clic derecho sobre el barco.</summary>
        public bool Interact(Player p)
        {
            if (rider != null) return false;
            p.Mount(this);
            return true;
        }

        protected override void OnHurt(float amount, Entity src)
        {
            Sfx.Block(Snd.Wood, transform.position, false, 0.8f);
        }

        public override void Die(Entity killer)
        {
            if (dead) return;
            dead = true;
            if (rider != null) rider.Dismount();
            bool creativeKill = killer != null && killer.IsPlayer && G.creative;
            if (!creativeKill) G.SpawnItem(transform.position + Vector3.up * 0.3f, new ItemStack(Items.Get("boat"), 1), new Vector3(0f, 3f, 0f));
            Particles.Burst(transform.position + Vector3.up * 0.3f, new Color32(160, 125, 80, 255), 14, 2f, 0.14f, 0.6f);
            Sfx.Block(Snd.Wood, transform.position, false, 1f);
            Destroy(gameObject);
        }
    }
}
