using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Ciclo dia/noche: color del cielo, niebla, sol, luna, estrellas y nubes.</summary>
    public sealed class DayNight : MonoBehaviour
    {
        public float time = 0.03f;                 // 0 = amanecer, 0.25 = mediodia, 0.5 = atardecer, 0.75 = medianoche
        public float dayLength = 1200f;
        public float skyBrightness = 1f;
        public bool frozen;
        public float overcast;                     // 0..1 nubosidad por clima
        public float flash;                        // destello de relampago 0..1
        public bool IsNight { get { return skyBrightness < 0.42f; } }
        public bool IsDay { get { return skyBrightness > 0.78f; } }

        Transform rig, sun, moon, stars, clouds;
        MaterialPropertyBlock sunMpb, moonMpb, starMpb, cloudMpb;
        Renderer sunR, moonR, starR, cloudR;
        Color fog = new Color(0.6f, 0.75f, 1f);
        Material cloudMat;

        static Mesh Quad(float s)
        {
            var m = new Mesh();
            m.vertices = new[] { new Vector3(-s, -s, 0), new Vector3(-s, s, 0), new Vector3(s, s, 0), new Vector3(s, -s, 0) };
            m.uv = new[] { new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0) };
            m.uv2 = new[] { Vector2.one, Vector2.one, Vector2.one, Vector2.one };
            m.colors32 = new[] { new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255) };
            m.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            m.RecalculateBounds();
            return m;
        }

        Transform Obj(string name, Mesh mesh, Material mat, out Renderer r)
        {
            var go = new GameObject(name);
            go.transform.SetParent(rig, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go.transform;
        }

        public void Init()
        {
            rig = new GameObject("SkyRig").transform;
            rig.SetParent(transform, false);
            sunMpb = new MaterialPropertyBlock(); moonMpb = new MaterialPropertyBlock(); starMpb = new MaterialPropertyBlock(); cloudMpb = new MaterialPropertyBlock();
            sun = Obj("sun", Quad(36f), Mats.Sky, out sunR);
            moon = Obj("moon", Quad(26f), Mats.Sky, out moonR);
            // estrellas
            var sm = new Mesh();
            var v = new List<Vector3>(); var t = new List<int>(); var uv = new List<Vector2>(); var uv2 = new List<Vector2>(); var col = new List<Color32>();
            var rng = new System.Random(77);
            for (int i = 0; i < 350; i++)
            {
                var d = new Vector3((float)rng.NextDouble() * 2 - 1, (float)rng.NextDouble() * 2 - 1, (float)rng.NextDouble() * 2 - 1);
                if (d.sqrMagnitude < 0.05f) { i--; continue; }
                d.Normalize();
                var c = d * 420f;
                var right = Vector3.Cross(d, Vector3.up).normalized; if (right.sqrMagnitude < 0.01f) right = Vector3.right;
                var up = Vector3.Cross(right, d).normalized;
                float s = 0.9f + (float)rng.NextDouble() * 1.4f;
                int bi = v.Count;
                v.Add(c - right * s - up * s); v.Add(c - right * s + up * s); v.Add(c + right * s + up * s); v.Add(c + right * s - up * s);
                for (int k = 0; k < 4; k++) { uv.Add(Vector2.zero); uv2.Add(Vector2.one); col.Add(new Color32(255, 255, 255, (byte)(150 + rng.Next(105)))); }
                t.Add(bi); t.Add(bi + 1); t.Add(bi + 2); t.Add(bi); t.Add(bi + 2); t.Add(bi + 3);
            }
            sm.SetVertices(v); sm.SetUVs(0, uv); sm.SetUVs(1, uv2); sm.SetColors(col); sm.SetTriangles(t, 0);
            stars = Obj("stars", sm, Mats.Sky, out starR);
            // nubes
            var cmesh = new Mesh();
            const float half = 1100f;
            cmesh.vertices = new[] { new Vector3(-half, 0, -half), new Vector3(-half, 0, half), new Vector3(half, 0, half), new Vector3(half, 0, -half) };
            cmesh.uv = new[] { new Vector2(0, 0), new Vector2(0, 2.4f), new Vector2(2.4f, 2.4f), new Vector2(2.4f, 0) };
            cmesh.uv2 = new[] { Vector2.one, Vector2.one, Vector2.one, Vector2.one };
            cmesh.colors32 = new[] { new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255) };
            cmesh.triangles = new[] { 0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0 };
            clouds = Obj("clouds", cmesh, Mats.Cloud, out cloudR);
            cloudMat = Mats.Cloud;
        }

        public void SkipNight() { time = 0.02f; }

        Color SkyColor(float elev)
        {
            var night = new Color(0.015f, 0.02f, 0.06f);
            var day = new Color(0.46f, 0.66f, 1f);
            var dusk = new Color(0.95f, 0.5f, 0.28f);
            float d = Mathf.Clamp01((elev + 0.12f) / 0.4f);
            var c = Color.Lerp(night, day, d);
            float horizon = Mathf.Clamp01(1f - Mathf.Abs(elev) * 4.5f);
            return Color.Lerp(c, dusk, horizon * 0.65f);
        }

        /// <summary>Se llama cada frame cuando hay mundo.</summary>
        public void Step(float dt, Player pl, World w, int viewDist)
        {
            if (!frozen && w.dim == Dim.Overworld) time = (time + dt / dayLength) % 1f;
            var cam = pl.cam;
            rig.position = cam.transform.position;
            float theta = time * Mathf.PI * 2f;
            float elev = Mathf.Sin(theta);
            float bright = Mathf.Clamp01(0.5f + elev * 1.2f);
            skyBrightness = Mathf.Max(0.1f, bright * (1f - overcast * 0.38f));
            float ambient = 0.035f;
            Color skyC; float fogStart, fogEnd = Mathf.Max(24f, viewDist * 16f - 6f);
            fogStart = fogEnd * 0.55f;
            bool underwater = pl.headInWater;
            bool lava = false;
            {
                var p = cam.transform.position;
                lava = W(w, p).isLava;
            }
            bool sky = w.dim == Dim.Overworld;
            if (w.dim == Dim.Overworld)
            {
                skyC = SkyColor(elev);
                if (overcast > 0.001f)
                {
                    var grey = new Color(0.50f, 0.54f, 0.60f) * Mathf.Clamp01(bright * 1.15f + 0.03f);
                    skyC = Color.Lerp(skyC, grey, overcast * 0.85f);
                    fogEnd *= 1f - overcast * 0.3f; fogStart = fogEnd * 0.5f;
                }
                if (flash > 0.001f) skyC = Color.Lerp(skyC, new Color(0.9f, 0.93f, 1f), flash * 0.7f);
            }
            else if (w.dim == Dim.Abismo) { skyC = new Color(0.32f, 0.07f, 0.04f); skyBrightness = 0f; ambient = 0.3f; fogStart = 8f; fogEnd = Mathf.Min(fogEnd, 70f); }
            else { skyC = new Color(0.06f, 0.03f, 0.09f); skyBrightness = 0f; ambient = 0.42f; fogStart = fogEnd * 0.7f; fogEnd *= 1.15f; }
            fog = skyC;
            if (underwater) { var wc = new Color(0.1f, 0.28f, 0.55f) * Mathf.Lerp(0.3f, 1f, skyBrightness); fog = wc; skyC = wc; fogStart = 0f; fogEnd = 22f; }
            if (lava) { fog = new Color(0.8f, 0.25f, 0.02f); skyC = fog; fogStart = 0f; fogEnd = 3.5f; }
            cam.backgroundColor = skyC;
            Mats.SetGlobals(w.dim == Dim.Overworld ? Mathf.Clamp01(skyBrightness + flash * 0.5f) : 0f, ambient, fog, fogStart, fogEnd);
            cam.farClipPlane = 900f;

            // astros
            bool showSky = sky && !underwater;
            sunR.enabled = showSky; moonR.enabled = showSky; starR.enabled = showSky; cloudR.enabled = showSky;
            if (showSky)
            {
                var dirSun = new Vector3(Mathf.Cos(theta), Mathf.Sin(theta), 0.18f).normalized;
                sun.position = rig.position + dirSun * 430f; sun.rotation = Quaternion.LookRotation(sun.position - rig.position);
                moon.position = rig.position - dirSun * 430f; moon.rotation = Quaternion.LookRotation(moon.position - rig.position);
                float clear = 1f - overcast * 0.92f;
                sunMpb.SetColor("_Tint", new Color(1f, 0.93f, 0.66f, elev > -0.1f ? clear : 0f)); sunR.SetPropertyBlock(sunMpb);
                moonMpb.SetColor("_Tint", new Color(0.82f, 0.88f, 1f, elev < 0.1f ? clear : 0f)); moonR.SetPropertyBlock(moonMpb);
                float night = Mathf.Clamp01(-elev * 3f) * clear;
                starMpb.SetColor("_Tint", new Color(1f, 1f, 1f, night)); starR.SetPropertyBlock(starMpb);
                stars.rotation = Quaternion.Euler(0, 0, theta * Mathf.Rad2Deg) * Quaternion.Euler(20, 0, 0);
                // nubes ancladas al mundo
                var cp = cam.transform.position;
                clouds.position = new Vector3(cp.x, 138f, cp.z);
                float wind = Time.time * 1.2f;
                cloudMat.mainTextureOffset = new Vector2((cp.x + wind) / 768f * 1f, cp.z / 768f);
                float cb = Mathf.Lerp(0.18f, 1f, skyBrightness) * (1f - overcast * 0.35f);
                cloudMpb.SetColor("_Tint", new Color(cb, cb, Mathf.Min(1f, cb * 1.05f), 0.9f)); cloudR.SetPropertyBlock(cloudMpb);
            }
        }

        static Block W(World w, Vector3 p) { return w.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y), Mathf.FloorToInt(p.z)); }
    }
}
