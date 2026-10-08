using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public enum Clip { Hurt, Pop, Click, Explode, Bow, Eat, Splash, Door, Chest, Portal, Fizz, Drink, Hit, Break, Place, Level, Zombie, Moo, Oink, Bleat, Cluck, Hiss, Growl, Bell, Teleport, Roar, Whoosh, Bark, Neigh, Thunder, Cast, Meow }

    /// <summary>Efectos de sonido generados por codigo (no hace falta importar audios).</summary>
    public static class Sfx
    {
        static readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        static AudioSource[] pool;
        static int next;
        static Transform root;
        public static float volume = 0.8f;

        public static void Init(Transform parent)
        {
            if (pool != null) return;
            var go = new GameObject("Sfx");
            go.transform.SetParent(parent, false);
            root = go.transform;
            pool = new AudioSource[20];
            for (int i = 0; i < pool.Length; i++)
            {
                var s = new GameObject("src" + i).AddComponent<AudioSource>();
                s.transform.SetParent(root, false);
                s.playOnAwake = false; s.spatialBlend = 1f; s.rolloffMode = AudioRolloffMode.Linear; s.minDistance = 2f; s.maxDistance = 28f;
                pool[i] = s;
            }
        }

        static AudioClip Make(string name, float dur, float cutoff, float tone, float toneEnd, float noiseAmt, float decay, int seed)
        {
            int rate = 22050, n = (int)(dur * rate);
            var data = new float[n];
            var rng = new System.Random(seed);
            float lp = 0, phase = 0;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)n;
                float env = Mathf.Pow(1f - t, decay) * Mathf.Min(1f, i / 120f);
                float noise = (float)(rng.NextDouble() * 2.0 - 1.0);
                lp += (noise - lp) * cutoff;
                float f = Mathf.Lerp(tone, toneEnd, t);
                phase += f / rate;
                float sine = Mathf.Sin(phase * 6.2831853f);
                data[i] = (lp * noiseAmt + sine * (1f - noiseAmt)) * env * 0.8f;
            }
            var c = AudioClip.Create(name, n, 1, rate, false);
            c.SetData(data, 0);
            return c;
        }

        static AudioClip Get(string key)
        {
            AudioClip c;
            if (clips.TryGetValue(key, out c)) return c;
            switch (key)
            {
                case "step": c = Make(key, 0.09f, 0.25f, 0, 0, 1f, 2f, 1); break;
                case "dig_stone": c = Make(key, 0.14f, 0.45f, 0, 0, 1f, 3f, 2); break;
                case "dig_dirt": c = Make(key, 0.14f, 0.2f, 0, 0, 1f, 2.5f, 3); break;
                case "dig_wood": c = Make(key, 0.16f, 0.3f, 180, 90, 0.6f, 3f, 4); break;
                case "dig_glass": c = Make(key, 0.2f, 0.9f, 1400, 900, 0.5f, 4f, 5); break;
                case "dig_sand": c = Make(key, 0.16f, 0.6f, 0, 0, 1f, 2f, 6); break;
                case "dig_cloth": c = Make(key, 0.12f, 0.12f, 0, 0, 1f, 2f, 7); break;
                case "dig_metal": c = Make(key, 0.2f, 0.7f, 800, 600, 0.4f, 3.5f, 8); break;
                case "dig_water": c = Make(key, 0.2f, 0.15f, 300, 200, 0.7f, 2.5f, 9); break;
                case "dig_plant": c = Make(key, 0.1f, 0.35f, 0, 0, 1f, 2f, 10); break;
                case Names.Hurt: c = Make(key, 0.25f, 0.2f, 320, 120, 0.3f, 1.5f, 11); break;
                case Names.Pop: c = Make(key, 0.1f, 0.5f, 520, 900, 0.1f, 2f, 12); break;
                case Names.Click: c = Make(key, 0.04f, 0.8f, 1000, 1000, 0.2f, 2f, 13); break;
                case Names.Explode: c = Make(key, 0.9f, 0.08f, 60, 30, 0.9f, 1.6f, 14); break;
                case Names.Bow: c = Make(key, 0.3f, 0.4f, 200, 700, 0.3f, 2f, 15); break;
                case Names.Eat: c = Make(key, 0.18f, 0.25f, 120, 80, 0.8f, 2f, 16); break;
                case Names.Splash: c = Make(key, 0.3f, 0.2f, 0, 0, 1f, 2f, 17); break;
                case Names.Door: c = Make(key, 0.2f, 0.25f, 150, 100, 0.6f, 2.5f, 18); break;
                case Names.Chest: c = Make(key, 0.25f, 0.3f, 130, 220, 0.5f, 2f, 19); break;
                case Names.Portal: c = Make(key, 1.0f, 0.1f, 200, 480, 0.2f, 0.8f, 20); break;
                case Names.Fizz: c = Make(key, 0.35f, 0.5f, 0, 0, 1f, 1.5f, 21); break;
                case Names.Drink: c = Make(key, 0.25f, 0.2f, 200, 400, 0.4f, 2f, 22); break;
                case Names.Hit: c = Make(key, 0.12f, 0.5f, 220, 100, 0.5f, 3f, 23); break;
                case Names.Level: c = Make(key, 0.5f, 0.1f, 600, 1200, 0f, 1.2f, 24); break;
                case Names.Zombie: c = Make(key, 0.5f, 0.2f, 110, 70, 0.4f, 1.3f, 25); break;
                case Names.Moo: c = Make(key, 0.7f, 0.1f, 140, 100, 0.2f, 1.3f, 26); break;
                case Names.Oink: c = Make(key, 0.3f, 0.2f, 240, 180, 0.4f, 1.8f, 27); break;
                case Names.Bleat: c = Make(key, 0.5f, 0.2f, 420, 360, 0.2f, 1.5f, 28); break;
                case Names.Cluck: c = Make(key, 0.15f, 0.3f, 700, 500, 0.3f, 2f, 29); break;
                case Names.Hiss: c = Make(key, 0.6f, 0.7f, 0, 0, 1f, 0.6f, 30); break;
                case Names.Growl: c = Make(key, 0.7f, 0.12f, 90, 60, 0.5f, 1.3f, 31); break;
                case Names.Bell: c = Make(key, 0.8f, 0.1f, 880, 880, 0f, 1.5f, 32); break;
                case Names.Teleport: c = Make(key, 0.35f, 0.1f, 900, 200, 0.1f, 1.6f, 33); break;
                case Names.Roar: c = Make(key, 1.2f, 0.1f, 70, 40, 0.5f, 0.9f, 34); break;
                case Names.Whoosh: c = Make(key, 0.3f, 0.6f, 0, 0, 1f, 1f, 35); break;
                case Names.Bark: c = Make(key, 0.22f, 0.25f, 380, 220, 0.35f, 2.2f, 36); break;
                case Names.Neigh: c = Make(key, 0.8f, 0.12f, 520, 300, 0.2f, 1.4f, 37); break;
                case Names.Thunder: c = Make(key, 2.8f, 0.035f, 45, 28, 0.97f, 0.9f, 38); break;
                case Names.Cast: c = Make(key, 0.25f, 0.5f, 300, 900, 0.7f, 1.8f, 39); break;
                case Names.Meow: c = Make(key, 0.45f, 0.2f, 720, 520, 0.12f, 1.6f, 40); break;
                default: c = Make(key, 0.1f, 0.3f, 0, 0, 1f, 2f, 99); break;
            }
            clips[key] = c;
            return c;
        }

        static class Names
        {
            public const string Hurt = "hurt", Pop = "pop", Click = "click", Explode = "explode", Bow = "bow", Eat = "eat", Splash = "splash", Door = "door", Chest = "chest",
                Portal = "portal", Fizz = "fizz", Drink = "drink", Hit = "hit", Level = "level", Zombie = "zombie", Moo = "moo", Oink = "oink", Bleat = "bleat",
                Cluck = "cluck", Hiss = "hiss", Growl = "growl", Bell = "bell", Teleport = "teleport", Roar = "roar", Whoosh = "whoosh", Bark = "bark", Neigh = "neigh", Thunder = "thunder", Cast = "cast", Meow = "meow";
        }

        static string NameOf(Clip c)
        {
            switch (c)
            {
                case Clip.Hurt: return Names.Hurt; case Clip.Pop: return Names.Pop; case Clip.Click: return Names.Click; case Clip.Explode: return Names.Explode;
                case Clip.Bow: return Names.Bow; case Clip.Eat: return Names.Eat; case Clip.Splash: return Names.Splash; case Clip.Door: return Names.Door;
                case Clip.Chest: return Names.Chest; case Clip.Portal: return Names.Portal; case Clip.Fizz: return Names.Fizz; case Clip.Drink: return Names.Drink;
                case Clip.Hit: return Names.Hit; case Clip.Break: return "dig_stone"; case Clip.Place: return "dig_dirt"; case Clip.Level: return Names.Level;
                case Clip.Zombie: return Names.Zombie; case Clip.Moo: return Names.Moo; case Clip.Oink: return Names.Oink; case Clip.Bleat: return Names.Bleat;
                case Clip.Cluck: return Names.Cluck; case Clip.Hiss: return Names.Hiss; case Clip.Growl: return Names.Growl; case Clip.Bell: return Names.Bell;
                case Clip.Teleport: return Names.Teleport; case Clip.Roar: return Names.Roar;
                case Clip.Bark: return Names.Bark; case Clip.Neigh: return Names.Neigh; case Clip.Thunder: return Names.Thunder; case Clip.Cast: return Names.Cast; case Clip.Meow: return Names.Meow;
                default: return Names.Whoosh;
            }
        }

        static void PlayClip(AudioClip c, Vector3 pos, float vol, float pitch)
        {
            if (pool == null || c == null) return;
            var s = pool[next]; next = (next + 1) % pool.Length;
            s.transform.position = pos;
            s.clip = c; s.volume = Mathf.Clamp01(vol * volume); s.pitch = pitch;
            s.Play();
        }

        public static void Play(Clip c, Vector3 pos, float vol = 1f, float pitch = 1f)
        {
            PlayClip(Get(NameOf(c)), pos, vol, pitch * Random.Range(0.92f, 1.08f));
        }

        static AudioSource ui2d;

        /// <summary>Sonido sin posicion (truenos lejanos, musica de eventos).</summary>
        public static void Play2D(Clip c, float vol = 1f, float pitch = 1f)
        {
            if (root == null) return;
            if (ui2d == null)
            {
                ui2d = new GameObject("src2d").AddComponent<AudioSource>();
                ui2d.transform.SetParent(root, false); ui2d.playOnAwake = false; ui2d.spatialBlend = 0f;
            }
            ui2d.pitch = pitch; ui2d.PlayOneShot(Get(NameOf(c)), Mathf.Clamp01(vol * volume));
        }

        public static void Block(Snd kind, Vector3 pos, bool step = false, float vol = 1f)
        {
            string k;
            if (step) k = "step";
            else switch (kind)
                {
                    case Snd.Stone: case Snd.Gravel: k = "dig_stone"; break;
                    case Snd.Wood: k = "dig_wood"; break;
                    case Snd.Glass: k = "dig_glass"; break;
                    case Snd.Sand: case Snd.Snow: k = "dig_sand"; break;
                    case Snd.Cloth: k = "dig_cloth"; break;
                    case Snd.Metal: k = "dig_metal"; break;
                    case Snd.Water: k = "dig_water"; break;
                    case Snd.Plant: case Snd.Grass: k = "dig_plant"; break;
                    default: k = "dig_dirt"; break;
                }
            float pitch = step ? 0.8f + (kind == Snd.Stone ? 0.2f : 0f) : 1f;
            PlayClip(Get(k), pos, vol * (step ? 0.35f : 0.8f), pitch * Random.Range(0.85f, 1.15f));
        }
    }
}
