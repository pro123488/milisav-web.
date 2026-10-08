using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Clima del Mundo Superior: lluvia, nieve en biomas frios, tormentas con relampagos.</summary>
    public sealed class Weather : MonoBehaviour
    {
        public float rain;            // intensidad general suavizada 0..1
        public bool thunder;          // la lluvia actual es tormenta
        public float flash;           // destello de relampago 0..1

        bool wantRain;
        float timer = 600f;
        float rainMix, snowMix;       // cuanto llueve / nieva donde esta el jugador
        float rainAcc, snowAcc;
        ParticleSystem rainPs, snowPs;
        AudioSource rainSrc;
        float lightningTimer = 12f;
        readonly List<float> thunderIn = new List<float>();
        readonly List<float> thunderVol = new List<float>();
        GameObject bolt; float boltT;
        Material boltMat;

        public bool Raining { get { return rain > 0.35f; } }
        public float Overcast { get { return rain; } }
        public bool WantRain { get { return wantRain; } }

        /// <summary>0 = seco, 1 = lluvia, 2 = nieve.</summary>
        public static int PrecipType(BiomeId b)
        {
            switch (b)
            {
                case BiomeId.Desert: case BiomeId.Mesa: case BiomeId.Savanna: case BiomeId.Ashlands: case BiomeId.LavaSea: case BiomeId.EndIsland: case BiomeId.EndVoid: return 0;
            }
            return Biomes.Info[(int)b].snowy ? 2 : 1;
        }

        public bool RainAt(World w, int x, int z)
        {
            return w != null && w.dim == Dim.Overworld && rain > 0.5f && PrecipType(w.BiomeAt(x, z)) == 1;
        }

        /// <summary>Si la lluvia moja a alguien en p (al aire libre).</summary>
        public bool Wet(World w, Vector3 p)
        {
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            return RainAt(w, x, z) && w.SkyLight(x, Mathf.FloorToInt(p.y), z) >= 14;
        }

        public void Init()
        {
            rainPs = MakeSystem("Rain", true);
            snowPs = MakeSystem("Snow", false);
            rainSrc = gameObject.AddComponent<AudioSource>();
            rainSrc.clip = MakeRainClip(); rainSrc.loop = true; rainSrc.spatialBlend = 0f; rainSrc.volume = 0f; rainSrc.playOnAwake = false;
            boltMat = Mats.Particle;
        }

        ParticleSystem MakeSystem(string name, bool streak)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = 0f;
            main.startLifetime = 1f;
            main.maxParticles = streak ? 3500 : 2500;
            main.playOnAwake = false; main.loop = true;
            main.cullingMode = ParticleSystemCullingMode.AlwaysSimulate;
            var em = ps.emission; em.enabled = false;
            var sh = ps.shape; sh.enabled = false;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = Mats.Particle;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (streak) { r.renderMode = ParticleSystemRenderMode.Stretch; r.velocityScale = 0.035f; r.lengthScale = 2f; }
            else r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
            return ps;
        }

        static AudioClip MakeRainClip()
        {
            int rate = 22050, n = rate * 3, fade = rate / 5;
            var d = new float[n];
            var rng = new System.Random(5);
            float lp = 0f, lp2 = 0f;
            for (int i = 0; i < n; i++)
            {
                float noise = (float)(rng.NextDouble() * 2.0 - 1.0);
                lp += (noise - lp) * 0.38f;
                lp2 += (lp - lp2) * 0.04f;
                d[i] = (lp - lp2) * 0.55f;
            }
            var o = new float[n - fade];
            for (int i = 0; i < o.Length; i++)
            {
                float v = d[i];
                if (i < fade) { float t = i / (float)fade; v = Mathf.Lerp(d[n - fade + i], d[i], t); }
                o[i] = v;
            }
            var c = AudioClip.Create("rain", o.Length, 1, rate, false);
            c.SetData(o, 0);
            return c;
        }

        /// <summary>Cielo despejado ya (al dormir, al cambiar de mundo).</summary>
        public void Clear()
        {
            wantRain = false; thunder = false; rain = 0f; rainMix = 0f; snowMix = 0f; flash = 0f;
            timer = GameRoot.I != null ? GameRoot.I.rand.Range(600f, 1500f) : 900f;
            if (rainSrc != null) rainSrc.volume = 0f;
        }

        public void SetState(bool raining, bool storm)
        {
            wantRain = raining; thunder = raining && storm; rain = raining ? 1f : 0f;
            timer = GameRoot.I != null ? GameRoot.I.rand.Range(120f, 400f) : 300f;
        }

        public void Step(float dt, Player pl, World w)
        {
            var g = GameRoot.I;
            bool ow = w != null && w.dim == Dim.Overworld;
            if (ow)
            {
                timer -= dt;
                if (timer <= 0f)
                {
                    wantRain = !wantRain;
                    if (wantRain) { thunder = g.rand.Chance(0.3f); timer = g.rand.Range(150f, 420f); }
                    else { thunder = false; timer = g.rand.Range(600f, 1800f); }
                }
            }
            else { wantRain = false; thunder = false; }
            rain = Mathf.MoveTowards(rain, wantRain ? 1f : 0f, dt / (wantRain ? 20f : 30f));
            flash = Mathf.Max(0f, flash - dt * 3.5f);
            TickBolt(dt, pl);
            TickThunder(dt);

            if (pl == null || pl.cam == null) return;
            var cam = pl.cam.transform.position;
            int px = Mathf.FloorToInt(cam.x), pz = Mathf.FloorToInt(cam.z);
            int type = ow ? PrecipType(w.BiomeAt(px, pz)) : 0;
            rainMix = Mathf.MoveTowards(rainMix, type == 1 ? rain : 0f, dt * 0.6f);
            snowMix = Mathf.MoveTowards(snowMix, type == 2 ? rain : 0f, dt * 0.6f);

            if (ow && !pl.headInWater)
            {
                if (rainMix > 0.02f) { rainAcc += 720f * rainMix * dt; Emit(ref rainAcc, rainPs, false, cam, w); }
                if (snowMix > 0.02f) { snowAcc += 260f * snowMix * dt; Emit(ref snowAcc, snowPs, true, cam, w); }
            }

            // sonido de lluvia
            float expo = 0f;
            if (ow && !pl.headInWater)
            {
                int sl = w.SkyLight(px, Mathf.FloorToInt(cam.y), pz);
                expo = sl >= 14 ? 1f : (sl >= 9 ? 0.45f : (cam.y >= w.SurfaceY(px, pz) - 6 ? 0.15f : 0.03f));
            }
            float target = (rainMix + snowMix * 0.4f) * 0.5f * expo;
            rainSrc.volume = Mathf.MoveTowards(rainSrc.volume, target * Sfx.volume, dt * 0.5f);
            if (rainSrc.volume > 0.003f) { if (!rainSrc.isPlaying) rainSrc.Play(); }
            else if (rainSrc.isPlaying) rainSrc.Pause();

            if (thunder && rain > 0.8f && ow)
            {
                lightningTimer -= dt;
                if (lightningTimer <= 0f) { lightningTimer = g.rand.Range(6f, 22f); Strike(pl, w); }
            }
        }

        void Emit(ref float acc, ParticleSystem ps, bool snow, Vector3 cam, World w)
        {
            int n = Mathf.Min(40, (int)acc);
            acc -= (int)acc;
            if (acc > 4f) acc = 0f;
            for (int i = 0; i < n; i++)
            {
                float ang = Random.value * 6.2831f, r = Mathf.Sqrt(Random.value) * 18f;
                float x = cam.x + Mathf.Cos(ang) * r, z = cam.z + Mathf.Sin(ang) * r;
                int top = w.SurfaceY(Mathf.FloorToInt(x), Mathf.FloorToInt(z));
                if (top < 0) continue;
                float y0 = cam.y + 11f, yEnd = top + 1.02f;
                if (yEnd >= y0 - 1f) continue;
                float speed = snow ? Random.Range(1.6f, 2.6f) : Random.Range(20f, 27f);
                float life = (y0 - yEnd) / speed;
                var ep = new ParticleSystem.EmitParams();
                ep.position = new Vector3(x, y0, z);
                ep.velocity = snow ? new Vector3(Random.Range(-0.5f, 0.5f), -speed, Random.Range(-0.5f, 0.5f)) : new Vector3(0f, -speed, 0f);
                ep.startLifetime = life;
                ep.startSize = snow ? Random.Range(0.06f, 0.11f) : 0.035f;
                ep.startColor = snow ? new Color32(250, 252, 255, 235) : new Color32(175, 195, 235, 120);
                ps.Emit(ep, 1);
                if (!snow && Random.value < 0.12f) Particles.Burst(new Vector3(x, yEnd, z), new Color32(200, 215, 240, 255), 1, 0.5f, 0.05f, 0.16f, new Vector3(0.02f, 0.01f, 0.02f));
            }
        }

        // ---------------------------------------------------------------- relampagos
        void Strike(Player pl, World w)
        {
            var g = GameRoot.I;
            float ang = Random.value * 6.2831f, r = Random.Range(10f, 70f);
            var pp = pl.transform.position;
            int x = Mathf.FloorToInt(pp.x + Mathf.Cos(ang) * r), z = Mathf.FloorToInt(pp.z + Mathf.Sin(ang) * r);
            if (!w.IsLoaded(x, z)) return;
            int top = w.SurfaceY(x, z);
            if (top < 0) return;
            var ground = new Vector3(x + 0.5f, top + 1f, z + 0.5f);
            if (PrecipType(w.BiomeAt(x, z)) == 0) return;
            flash = 1f;
            SpawnBolt(ground, pl.cam.transform.position);
            float dist = (ground - pp).magnitude;
            thunderIn.Add(dist / 110f); thunderVol.Add(Mathf.Clamp(1.25f - dist / 90f, 0.3f, 1f));
            Particles.Burst(ground, new Color32(255, 250, 200, 255), 20, 3f, 0.14f, 0.6f);
            if (dist < 40f) Sfx.Play(Clip.Explode, ground, 0.6f, 1.5f);
            for (int i = Entity.All.Count - 1; i >= 0; i--)
            {
                var e = Entity.All[i];
                if (e == null || e.dead || e is ItemEntity || e is Projectile || e is Boat) continue;
                var d = e.transform.position - ground; float dy = d.y; d.y = 0f;
                if (d.magnitude < 3.5f && Mathf.Abs(dy) < 6f) { e.Damage(8f, ground, null, 0.5f); e.SetOnFire(5f); e.rainImmune = 6f; }
            }
        }

        void TickThunder(float dt)
        {
            for (int i = thunderIn.Count - 1; i >= 0; i--)
            {
                thunderIn[i] -= dt;
                if (thunderIn[i] <= 0f)
                {
                    Sfx.Play2D(Clip.Thunder, thunderVol[i], Random.Range(0.85f, 1.1f));
                    thunderIn.RemoveAt(i); thunderVol.RemoveAt(i);
                }
            }
        }

        void SpawnBolt(Vector3 ground, Vector3 camPos)
        {
            if (bolt != null) { var oldMf = bolt.GetComponent<MeshFilter>(); if (oldMf != null && oldMf.sharedMesh != null) Destroy(oldMf.sharedMesh); Destroy(bolt); }
            const int segs = 18; const float height = 95f;
            var pts = new Vector3[segs + 1];
            for (int i = 0; i <= segs; i++)
            {
                float t = i / (float)segs;
                float spread = (1f - t) * 4f;
                pts[i] = new Vector3(ground.x + (i == segs ? 0f : Random.Range(-1f, 1f) * spread), ground.y + height * (1f - t), ground.z + (i == segs ? 0f : Random.Range(-1f, 1f) * spread));
            }
            pts[segs] = ground;
            var v = new List<Vector3>(); var c = new List<Color32>(); var uv = new List<Vector2>(); var uv2 = new List<Vector2>(); var tris = new List<int>();
            for (int i = 0; i < segs; i++)
            {
                var a = pts[i]; var b = pts[i + 1];
                var dir = b - a; var mid = (a + b) * 0.5f;
                var right = Vector3.Cross(dir, camPos - mid).normalized * (0.22f + 0.1f * (i / (float)segs));
                int bi = v.Count;
                v.Add(a - right); v.Add(a + right); v.Add(b + right); v.Add(b - right);
                for (int k = 0; k < 4; k++) { c.Add(new Color32(235, 240, 255, 255)); uv.Add(Vector2.zero); uv2.Add(Vector2.one); }
                tris.Add(bi); tris.Add(bi + 1); tris.Add(bi + 2); tris.Add(bi); tris.Add(bi + 2); tris.Add(bi + 3);
            }
            var m = new Mesh();
            m.SetVertices(v); m.SetColors(c); m.SetUVs(0, uv); m.SetUVs(1, uv2); m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            bolt = new GameObject("Bolt");
            bolt.transform.SetParent(transform, false);
            bolt.AddComponent<MeshFilter>().sharedMesh = m;
            var mr = bolt.AddComponent<MeshRenderer>();
            mr.sharedMaterial = boltMat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            boltT = 0.4f;
        }

        void TickBolt(float dt, Player pl)
        {
            if (bolt == null) return;
            boltT -= dt;
            if (boltT <= 0f) { Destroy(bolt.GetComponent<MeshFilter>().sharedMesh); Destroy(bolt); bolt = null; return; }
            bolt.GetComponent<MeshRenderer>().enabled = (int)(boltT * 40f) % 3 != 0;
        }
    }
}
