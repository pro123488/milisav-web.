using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Musica ambiental generada por codigo: piezas largas y suaves que suenan de vez en cuando.</summary>
    public static class Music
    {
        public static float volume = 0.5f;
        const int Rate = 16000, Moods = 4;
        static AudioSource src;
        static readonly AudioClip[] clips = new AudioClip[Moods];
        static readonly List<KeyValuePair<int, float[]>> ready = new List<KeyValuePair<int, float[]>>();
        static float gap = 3f;
        static bool started;

        public static void Init(Transform parent)
        {
            if (started) return;
            started = true;
            var go = new GameObject("Music");
            go.transform.SetParent(parent, false);
            src = go.AddComponent<AudioSource>();
            src.spatialBlend = 0f; src.loop = false; src.playOnAwake = false;
            // un unico hilo de baja prioridad, una pieza tras otra: no compite con la generacion del mundo
            var th = new Thread(() =>
            {
                for (int k = 0; k < Moods; k++)
                {
                    try { var d = Synth(k); lock (ready) ready.Add(new KeyValuePair<int, float[]>(k, d)); }
                    catch (Exception e) { Debug.LogWarning("Musica: " + e.Message); }
                }
            });
            th.IsBackground = true; th.Priority = System.Threading.ThreadPriority.BelowNormal; th.Name = "MusicSynth";
            th.Start();
        }

        /// <summary>Se llama cada frame. g puede ser null en el menu principal.</summary>
        public static void Tick(GameRoot g, float dt)
        {
            if (src == null) return;
            lock (ready)
            {
                while (ready.Count > 0)
                {
                    var kv = ready[0]; ready.RemoveAt(0);
                    var c = AudioClip.Create("music" + kv.Key, kv.Value.Length, 1, Rate, false);
                    c.SetData(kv.Value, 0);
                    clips[kv.Key] = c;
                }
            }
            src.volume = volume * 0.6f;
            if (src.isPlaying) return;
            gap -= dt;
            if (gap > 0f || volume < 0.01f) return;
            int idx = Pick(g);
            if (idx < 0 || clips[idx] == null) { gap = 1f; return; }
            src.clip = clips[idx]; src.Play();
            gap = g != null && g.state == GameState.Playing ? UnityEngine.Random.Range(50f, 140f) : 25f;
        }

        static int Pick(GameRoot g)
        {
            if (g == null || g.state != GameState.Playing || g.world == null || g.player == null) return 0;
            if (g.world.dim != Dim.Overworld) return 3;
            if (g.sky.IsNight) return 1;
            var p = g.player.transform.position;
            int top = g.world.SurfaceY(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.z));
            if (top > 0 && p.y < top - 12) return 2;
            return 0;
        }

        // ------------------------------------------------------------------ sintesis
        static float Hz(float root, int semi) { return root * Mathf.Pow(2f, semi / 12f); }

        static void Note(float[] buf, float t0, float dur, float freq, float amp, float attack, float decay, float harm)
        {
            int s0 = (int)(t0 * Rate), n = (int)(dur * Rate);
            float w = 2f * Mathf.PI * freq / Rate;
            for (int i = 0; i < n; i++)
            {
                int idx = s0 + i;
                if (idx < 0 || idx >= buf.Length) continue;
                float t = i / (float)Rate;
                float env = Mathf.Min(1f, t / attack) * Mathf.Exp(-t * decay) * Mathf.Min(1f, (dur - t) / 0.4f);
                float ph = w * i;
                float v = Mathf.Sin(ph) + harm * Mathf.Sin(ph * 2f) * Mathf.Exp(-t * 2.5f) + harm * 0.5f * Mathf.Sin(ph * 3.01f) * Mathf.Exp(-t * 4f);
                buf[idx] += v * env * amp;
            }
        }

        static float[] Synth(int mood)
        {
            var rng = new System.Random(1000 + mood * 77);
            float bpm = mood == 0 ? 68f : (mood == 1 ? 54f : (mood == 2 ? 44f : 40f));
            float beat = 60f / bpm;
            int bars = mood == 0 ? 18 : 16;
            float len = bars * 4f * beat;
            var buf = new float[(int)(len * Rate)];
            float root = mood == 0 ? 261.63f : (mood == 1 ? 220f : (mood == 2 ? 130.8f : 110f));
            int[] scale; int[][] chords;
            switch (mood)
            {
                case 0: scale = new[] { 0, 2, 4, 7, 9, 12, 14, 16 }; chords = new[] { new[] { 0, 4, 7 }, new[] { -3, 0, 4 }, new[] { -7, -3, 0 }, new[] { -5, -1, 2 } }; break;
                case 1: scale = new[] { 0, 3, 5, 7, 10, 12, 15 }; chords = new[] { new[] { 0, 3, 7 }, new[] { -4, 0, 3 }, new[] { 3, 7, 10 }, new[] { -2, 2, 5 } }; break;
                case 2: scale = new[] { 0, 1, 5, 7, 8, 12 }; chords = new[] { new[] { 0, 7, 12 }, new[] { -2, 5, 10 }, new[] { 0, 7, 12 }, new[] { 1, 8, 13 } }; break;
                default: scale = new[] { 0, 1, 6, 7, 11, 12 }; chords = new[] { new[] { 0, 6, 7 }, new[] { 1, 7, 13 }, new[] { 0, 6, 12 }, new[] { -1, 6, 11 } }; break;
            }
            // acordes largos y bajo
            for (int b = 0; b < bars; b++)
            {
                var ch = chords[b % chords.Length];
                float t0 = b * 4f * beat;
                for (int k = 0; k < ch.Length; k++)
                {
                    float f = Hz(root, ch[k]) * 0.5f;
                    Note(buf, t0, 4f * beat + 0.8f, f, 0.05f, 1.1f, 0.05f, 0.1f);
                    Note(buf, t0, 4f * beat + 0.8f, f * 1.004f, 0.04f, 1.4f, 0.05f, 0.1f);
                }
                Note(buf, t0, 3.2f * beat, Hz(root, ch[0]) * 0.25f, 0.11f, 0.05f, 0.35f, 0.15f);
            }
            // melodia dispersa
            float t = 4f * beat; int deg = rng.Next(scale.Length);
            float restP = mood == 0 ? 0.28f : (mood == 1 ? 0.4f : 0.6f);
            while (t < len - 4f * beat)
            {
                if (rng.NextDouble() < restP) { t += (1 + rng.Next(3)) * beat * 0.5f; continue; }
                deg = Mathf.Clamp(deg + rng.Next(-2, 3), 0, scale.Length - 1);
                float dur = (1 + rng.Next(3)) * beat;
                float f = Hz(root, scale[deg]) * (mood >= 2 ? 1f : 2f);
                Note(buf, t, Mathf.Min(dur + 1.5f, 5f), f, mood == 0 ? 0.13f : 0.1f, 0.012f, mood >= 2 ? 1.2f : 2.0f, 0.5f);
                t += dur;
            }
            // reverberacion sencilla (peines)
            int[] delays = { (int)(0.061f * Rate), (int)(0.097f * Rate), (int)(0.143f * Rate), (int)(0.211f * Rate) };
            var wet = new float[buf.Length];
            var y = new float[buf.Length];
            for (int d = 0; d < delays.Length; d++)
            {
                Array.Clear(y, 0, y.Length);
                int dl = delays[d];
                for (int i = 0; i < buf.Length; i++)
                {
                    float prev = i >= dl ? y[i - dl] : 0f;
                    y[i] = buf[i] + 0.52f * prev;
                    wet[i] += y[i] * 0.25f;
                }
            }
            float peak = 0.0001f;
            for (int i = 0; i < buf.Length; i++) { buf[i] = buf[i] * 0.55f + wet[i] * 0.45f; peak = Mathf.Max(peak, Mathf.Abs(buf[i])); }
            float norm = 0.7f / peak;
            int fade = 2 * Rate;
            for (int i = 0; i < buf.Length; i++)
            {
                float fi = Mathf.Min(1f, i / (float)fade) * Mathf.Min(1f, (buf.Length - i) / (float)fade);
                buf[i] *= norm * fi;
            }
            return buf;
        }
    }
}
