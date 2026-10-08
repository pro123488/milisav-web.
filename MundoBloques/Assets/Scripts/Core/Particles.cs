using UnityEngine;

namespace MundoBloques
{
    /// <summary>Particulas de bloques rotos y efectos simples.</summary>
    public static class Particles
    {
        static ParticleSystem ps;

        public static void Init(Transform parent)
        {
            if (ps != null) return;
            var go = new GameObject("Particles");
            go.transform.SetParent(parent, false);
            ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = 1.6f;
            main.startLifetime = 0.8f;
            main.startSize = 0.12f;
            main.maxParticles = 1500;
            main.playOnAwake = false;
            main.loop = false;
            var em = ps.emission; em.enabled = false;
            var sh = ps.shape; sh.enabled = false;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                      new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(1f, 0.6f), new GradientAlphaKey(0f, 1f) });
            col.color = g;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.material = Mats.Particle;
            r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
        }

        public static void Burst(Vector3 pos, Color32 color, int count, float speed = 3f, float size = 0.12f, float life = 0.8f, Vector3? spread = null)
        {
            if (ps == null) return;
            var sp = spread ?? new Vector3(0.5f, 0.5f, 0.5f);
            for (int i = 0; i < count; i++)
            {
                var ep = new ParticleSystem.EmitParams();
                ep.position = pos + new Vector3(Random.Range(-sp.x, sp.x), Random.Range(-sp.y, sp.y), Random.Range(-sp.z, sp.z)) * 0.9f;
                ep.velocity = new Vector3(Random.Range(-1f, 1f), Random.Range(0.2f, 1.4f), Random.Range(-1f, 1f)) * speed;
                float v = Random.Range(0.75f, 1.1f);
                ep.startColor = new Color32((byte)Mathf.Min(255, color.r * v), (byte)Mathf.Min(255, color.g * v), (byte)Mathf.Min(255, color.b * v), 255);
                ep.startSize = size * Random.Range(0.6f, 1.4f);
                ep.startLifetime = life * Random.Range(0.6f, 1.2f);
                ps.Emit(ep, 1);
            }
        }

        public static void BlockBreak(int x, int y, int z, Block b, int count = 14)
        {
            var c = TileAtlas.Average(b.tex[2]);
            if (b.tint != Tint.None) c = new Color32((byte)(c.r * 0.6f), (byte)(c.g * 0.85f), (byte)(c.b * 0.5f), 255);
            Burst(new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), c, count);
        }
    }
}
