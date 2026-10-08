using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public enum AI { Passive, Hostile, Skeleton, Spider, Exploder, Slime, Wanderer, Blaze, Golem, Villager, Spirit, Fish, Wolf, Horse }

    public struct Part
    {
        public string name; public Vector3 size, pivot, off; public Color32 color; public char anim;
    }

    public struct Drop2
    {
        public string item; public int min, max; public float chance;
        public Drop2(string item, int min, int max, float chance = 1f) { this.item = item; this.min = min; this.max = max; this.chance = chance; }
    }

    public sealed class MobDef
    {
        public string key, name;
        public AI ai;
        public float health = 10, speed = 2f, width = 0.6f, height = 1f, damage = 2f, scale = 1f, sight = 22f;
        public bool burnsInDay, hostile, flies, baby;
        public string breedItem;
        public string[] tameItems;
        public List<Part> parts = new List<Part>();
        public Drop2[] drops = new Drop2[0];
        public Clip ambient = Clip.Pop; public float ambientChance = 0.0f;
        public bool glow;
        public int sizeVariant;

        public MobDef Add(string name, float sx, float sy, float sz, float px, float py, float pz, float ox, float oy, float oz, uint color, char anim = '\0')
        {
            parts.Add(new Part { name = name, size = new Vector3(sx, sy, sz), pivot = new Vector3(px, py, pz), off = new Vector3(ox, oy, oz), color = Col.Hex(color), anim = anim });
            return this;
        }
    }

    /// <summary>Catalogo de criaturas pacificas, hostiles y sobrenaturales con sus modelos de cubos.</summary>
    public static class MobDefs
    {
        public static readonly uint[] CatBody = { 0xD08A3A, 0x2C2C30, 0x9A9A9E, 0xEDEDED };
        public static readonly uint[] HorseBody = { 0x8B5A2B, 0xA0522D, 0x2B2320, 0xE8E4DC, 0x9A9A98, 0xC9A24D };
        public static readonly uint[] HorseMane = { 0x2B1B10, 0x4A2A14, 0x0E0A08, 0xC8C4BC, 0x555555, 0xE8D8A0 };
        public static readonly Dictionary<string, MobDef> All = new Dictionary<string, MobDef>();
        public static MobDef Get(string key) { MobDef d; return All.TryGetValue(key, out d) ? d : null; }
        static bool ready;

        static MobDef Def(string key, string name, AI ai, float hp, float speed, float w, float h, float scale)
        {
            var d = new MobDef { key = key, name = name, ai = ai, health = hp, speed = speed, width = w, height = h, scale = scale };
            All[key] = d; return d;
        }

        // Cuerpo humanoide estandar (px: 16 = 1 bloque; 32 de alto = 2 bloques)
        static void Humanoid(MobDef d, uint skin, uint shirt, uint pants, bool armsForward, float armW = 4f, float legW = 4f, float bodyW = 8f)
        {
            d.Add("legL", legW, 12, legW, -2, 12, 0, 0, -6, 0, pants, 'a');
            d.Add("legR", legW, 12, legW, 2, 12, 0, 0, -6, 0, pants, 'b');
            d.Add("body", bodyW, 12, 4, 0, 24, 0, 0, -6, 0, shirt);
            d.Add("armL", armW, 12, armW, -(bodyW * 0.5f + armW * 0.5f), 22, 0, 0, -5, 0, armsForward ? skin : shirt, armsForward ? 'z' : 'A');
            d.Add("armR", armW, 12, armW, bodyW * 0.5f + armW * 0.5f, 22, 0, 0, -5, 0, armsForward ? skin : shirt, armsForward ? 'z' : 'B');
            d.Add("head", 8, 8, 8, 0, 24, 0, 0, 4, 0, skin, 'h');
        }

        static void Eyes(MobDef d, uint color, float y = 24 + 4.5f, float spacing = 2f, float z = 4.05f, float size = 1.6f)
        {
            d.Add("eyeL", size, size, 0.4f, -spacing, y, z, 0, 0, 0, color, 'e');
            d.Add("eyeR", size, size, 0.4f, spacing, y, z, 0, 0, 0, color, 'e');
        }

        static void Init()
        {
            if (ready) return; ready = true;
            // ---------------- animales pacificos ----------------
            var cow = Def("cow", "Vaca", AI.Passive, 10, 1.6f, 0.9f, 1.4f, 0.9f); cow.breedItem = "wheat"; cow.ambient = Clip.Moo; cow.ambientChance = 0.004f;
            cow.drops = new[] { new Drop2("beef", 1, 3), new Drop2("leather", 0, 2) };
            QuadBody(cow, 0x4A3A2A, 0x3A2A1A, 0x6A5A4A, 12, 10, 18, 6);
            cow.Add("patch", 6, 0.3f, 8, 1.5f, 19, 0, 0, 0, 0, 0xF0F0F0);
            cow.Add("hornL", 1, 3, 1, -3.5f, 22, 11, 0, 1.5f, 0, 0xE8E0C8); cow.Add("hornR", 1, 3, 1, 3.5f, 22, 11, 0, 1.5f, 0, 0xE8E0C8);
            cow.Add("muzzle", 5, 3, 1, 0, 17, 13.2f, 0, 0, 0, 0xC8B8A0);

            var pig = Def("pig", "Cerdo", AI.Passive, 10, 1.7f, 0.9f, 0.9f, 0.9f); pig.breedItem = "carrot"; pig.ambient = Clip.Oink; pig.ambientChance = 0.004f;
            pig.drops = new[] { new Drop2("pork", 1, 3) };
            QuadBody(pig, 0xF0A0A8, 0xF0A0A8, 0xD88890, 10, 8, 16, 6);
            pig.Add("snout", 4, 3, 1.5f, 0, 10, 12.5f, 0, 0, 0, 0xE08088);

            var sheep = Def("sheep", "Oveja", AI.Passive, 8, 1.7f, 0.9f, 1.3f, 0.9f); sheep.breedItem = "wheat"; sheep.ambient = Clip.Bleat; sheep.ambientChance = 0.004f;
            sheep.drops = new[] { new Drop2("mutton", 1, 2) };
            QuadBody(sheep, 0xF0F0F0, 0xC8B8A0, 0xC8B8A0, 11, 9, 16, 6);

            var chicken = Def("chicken", "Gallina", AI.Passive, 4, 1.5f, 0.4f, 0.7f, 0.9f); chicken.breedItem = "wheat_seeds"; chicken.ambient = Clip.Cluck; chicken.ambientChance = 0.005f;
            chicken.drops = new[] { new Drop2("chicken", 1, 1), new Drop2("feather", 0, 2) };
            chicken.Add("legL", 1, 5, 1, -1.5f, 5, 0, 0, -2.5f, 0, 0xE8B83A, 'a'); chicken.Add("legR", 1, 5, 1, 1.5f, 5, 0, 0, -2.5f, 0, 0xE8B83A, 'b');
            chicken.Add("body", 6, 6, 8, 0, 11, 0, 0, -3, 0, 0xF4F4F4);
            chicken.Add("wingL", 1, 4, 5, -3.5f, 10, 0, 0, -2, 0, 0xE0E0E0, 'w'); chicken.Add("wingR", 1, 4, 5, 3.5f, 10, 0, 0, -2, 0, 0xE0E0E0, 'W');
            chicken.Add("head", 4, 6, 3, 0, 11, 4, 0, 3, 0, 0xF8F8F8, 'h'); chicken.Add("beak", 2, 1, 2, 0, 14, 6.4f, 0, 0, 0, 0xE8A020);
            chicken.Add("wattle", 1, 2, 1, 0, 12, 6f, 0, 0, 0, 0xD03030);
            chicken.Add("tail", 4, 4, 1, 0, 11, -4.5f, 0, 0, 0, 0xE8E8E8);

            var rabbit = Def("rabbit", "Conejo", AI.Passive, 3, 2.4f, 0.4f, 0.5f, 0.8f); rabbit.breedItem = "carrot";
            rabbit.drops = new[] { new Drop2("rabbit", 0, 1) };
            rabbit.Add("legL", 2, 3, 4, -2, 3, -2, 0, -1, 0, 0x8A6A4A, 'a'); rabbit.Add("legR", 2, 3, 4, 2, 3, -2, 0, -1, 0, 0x8A6A4A, 'b');
            rabbit.Add("body", 5, 5, 7, 0, 8, 0, 0, -2.5f, 0, 0x9A7A5A);
            rabbit.Add("head", 4, 4, 4, 0, 8, 3, 0, 2, 1, 0xA8886A, 'h');
            rabbit.Add("earL", 1, 5, 1, -1, 12, 3.5f, 0, 2, 0, 0x8A6A4A); rabbit.Add("earR", 1, 5, 1, 1, 12, 3.5f, 0, 2, 0, 0x8A6A4A);
            rabbit.Add("tail", 2, 2, 1, 0, 6, -4, 0, 0, 0, 0xF0F0F0);

            var wolf = Def("wolf", "Lobo", AI.Wolf, 8, 3.6f, 0.6f, 0.85f, 1f); wolf.ambient = Clip.Bark; wolf.ambientChance = 0.0012f; wolf.tameItems = new[] { "bone" };
            wolf.Add("legFL", 2.5f, 8, 2.5f, -2, 8, 4, 0, -4, 0, 0xC4C0B8, 'a'); wolf.Add("legFR", 2.5f, 8, 2.5f, 2, 8, 4, 0, -4, 0, 0xC4C0B8, 'b');
            wolf.Add("legBL", 2.5f, 8, 2.5f, -2, 8, -4, 0, -4, 0, 0xC4C0B8, 'b'); wolf.Add("legBR", 2.5f, 8, 2.5f, 2, 8, -4, 0, -4, 0, 0xC4C0B8, 'a');
            wolf.Add("body", 6, 6, 9, 0, 11, 0, 0, 0, 0, 0xD4D0C8);
            wolf.Add("head", 6, 6, 4, 0, 13, 5, 0, 0, 2, 0xDCD8D0, 'h');
            wolf.Add("snout", 3, 2.5f, 3, 0, 13, 5, 0, -1, 5.5f, 0xBDB8B0, 'h'); wolf.Add("nose", 1.6f, 1.2f, 0.5f, 0, 13, 5, 0, -0.3f, 7.2f, 0x151515, 'h');
            wolf.Add("earL", 2, 2.5f, 1, 0, 13, 5, -2, 4.2f, 1, 0xB5B0A8, 'h'); wolf.Add("earR", 2, 2.5f, 1, 0, 13, 5, 2, 4.2f, 1, 0xB5B0A8, 'h');
            wolf.Add("eyeL", 1, 1, 0.4f, 0, 13, 5, -1.8f, 0.8f, 4.05f, 0x202020, 'h'); wolf.Add("eyeR", 1, 1, 0.4f, 0, 13, 5, 1.8f, 0.8f, 4.05f, 0x202020, 'h');
            wolf.Add("collar", 6.6f, 6.6f, 1.4f, 0, 13, 5, 0, 0, -0.1f, 0xC02020, 'h');
            wolf.Add("tail", 2, 6, 2, 0, 12.5f, -5, 0, -1.5f, -1, 0xC4C0B8, 't');

            var cat = Def("cat", "Gato", AI.Wolf, 10, 3.2f, 0.45f, 0.55f, 1f); cat.ambient = Clip.Meow; cat.ambientChance = 0.0018f; cat.tameItems = new[] { "cod", "salmon" };
            cat.Add("legFL", 2, 6, 2, -1.5f, 6, 3.5f, 0, -3, 0, 0xD08A3A, 'a'); cat.Add("legFR", 2, 6, 2, 1.5f, 6, 3.5f, 0, -3, 0, 0xD08A3A, 'b');
            cat.Add("legBL", 2, 6, 2, -1.5f, 6, -3.5f, 0, -3, 0, 0xD08A3A, 'b'); cat.Add("legBR", 2, 6, 2, 1.5f, 6, -3.5f, 0, -3, 0, 0xD08A3A, 'a');
            cat.Add("body", 5, 5, 11, 0, 8.5f, 0, 0, 0, 0, 0xD08A3A);
            cat.Add("head", 5, 4.5f, 5, 0, 10, 5, 0, 0, 2, 0xD8964A, 'h');
            cat.Add("earL", 1.6f, 1.6f, 1, 0, 10, 5, -1.8f, 3, 1.5f, 0xD08A3A, 'h'); cat.Add("earR", 1.6f, 1.6f, 1, 0, 10, 5, 1.8f, 3, 1.5f, 0xD08A3A, 'h');
            cat.Add("snout", 2.5f, 1.8f, 1, 0, 10, 5, 0, -1, 4.6f, 0xEEC8B8, 'h');
            cat.Add("eyeL", 1, 1, 0.4f, 0, 10, 5, -1.5f, 0.7f, 4.55f, 0x6AC840, 'h'); cat.Add("eyeR", 1, 1, 0.4f, 0, 10, 5, 1.5f, 0.7f, 4.55f, 0x6AC840, 'h');
            cat.Add("collar", 5.6f, 5.1f, 1.2f, 0, 10, 5, 0, 0, -0.2f, 0xC02020, 'h');
            cat.Add("tail", 1.5f, 1.5f, 9, 0, 10, -5, 0, -0.5f, -4, 0xC47A30, 't');

            var horse = Def("horse", "Caballo", AI.Horse, 22, 4f, 1.2f, 1.7f, 1f); horse.breedItem = "apple"; horse.ambient = Clip.Neigh; horse.ambientChance = 0.0012f;
            horse.drops = new[] { new Drop2("leather", 0, 2) };
            horse.Add("legFL", 3.5f, 12, 3.5f, -3, 12, 8, 0, -6, 0, 0x8B5A2B, 'a'); horse.Add("legFR", 3.5f, 12, 3.5f, 3, 12, 8, 0, -6, 0, 0x8B5A2B, 'b');
            horse.Add("legBL", 3.5f, 12, 3.5f, -3, 12, -8, 0, -6, 0, 0x8B5A2B, 'b'); horse.Add("legBR", 3.5f, 12, 3.5f, 3, 12, -8, 0, -6, 0, 0x8B5A2B, 'a');
            horse.Add("body", 9, 9, 20, 0, 16.5f, 0, 0, 0, 0, 0x8B5A2B);
            horse.Add("neckA", 4.5f, 7, 5, 0, 22.5f, 8.5f, 0, 0, 0, 0x8B5A2B); horse.Add("neckB", 4.5f, 6, 5, 0, 28, 10.5f, 0, 0, 0, 0x8B5A2B);
            horse.Add("head", 5, 5.5f, 11, 0, 29, 11, 0, 0, 4.5f, 0x8B5A2B, 'h');
            horse.Add("muzzle", 4.4f, 4.6f, 3.5f, 0, 29, 11, 0, -0.5f, 10, 0x8B5A2B, 'h');
            horse.Add("earL", 1.6f, 3, 1.5f, 0, 29, 11, -1.8f, 4, 1.5f, 0x8B5A2B, 'h'); horse.Add("earR", 1.6f, 3, 1.5f, 0, 29, 11, 1.8f, 4, 1.5f, 0x8B5A2B, 'h');
            horse.Add("eyeL", 0.4f, 1, 1, 0, 29, 11, -2.55f, 1, 4, 0x151515, 'h'); horse.Add("eyeR", 0.4f, 1, 1, 0, 29, 11, 2.55f, 1, 4, 0x151515, 'h');
            horse.Add("mane", 1.6f, 12, 3, 0, 25.5f, 6.5f, 0, 0, 0, 0x2B1B10);
            horse.Add("tail", 2.5f, 11, 2.5f, 0, 19, -10, 0, -5, -1, 0x2B1B10, 't');
            horse.Add("saddle", 10, 1.5f, 8, 0, 21.5f, -1, 0, 0, 0, 0x6B3A1E); horse.Add("saddleHorn", 4, 2, 2, 0, 23, 2.5f, 0, 0, 0, 0x4A2810);

            var cod = Def("cod", "Bacalao", AI.Fish, 3, 2f, 0.4f, 0.3f, 0.9f); cod.drops = new[] { new Drop2("cod", 1, 1) };
            FishBody(cod, 0xB89A78, 0xD8C8A8);
            var salmon = Def("salmon", "Salmón", AI.Fish, 3, 2.2f, 0.5f, 0.35f, 1f); salmon.drops = new[] { new Drop2("salmon", 1, 1) };
            FishBody(salmon, 0xC25A4A, 0xE8A090);

            // ---------------- aldeano ----------------
            var vil = Def("villager", "Aldeano", AI.Villager, 20, 1.5f, 0.6f, 1.95f, 0.95f);
            Humanoid(vil, 0xC49A7A, 0x6B4A2A, 0x6B4A2A, false);
            vil.parts.RemoveAll(p => p.name == "armL" || p.name == "armR");
            vil.Add("arms", 8, 4, 4, 0, 18, 3, 0, 0, 0, 0x7A5A32);
            vil.Add("armsL", 4, 8, 4, -6, 22, 0, 0, -4, 0, 0x6B4A2A); vil.Add("armsR", 4, 8, 4, 6, 22, 0, 0, -4, 0, 0x6B4A2A);
            vil.Add("nose", 2, 4, 2, 0, 24, 5, 0, 1, 0, 0xB08A6A);
            Eyes(vil, 0x2E7A2E);
            vil.Add("brow", 8.2f, 1, 0.5f, 0, 24 + 6.3f, 4.1f, 0, 0, 0, 0x5A4030);

            // ---------------- hostiles ----------------
            var zombie = Def("zombie", "Zombi", AI.Hostile, 20, 2.3f, 0.6f, 1.95f, 0.95f); zombie.hostile = true; zombie.burnsInDay = true; zombie.damage = 3; zombie.ambient = Clip.Zombie; zombie.ambientChance = 0.003f;
            zombie.drops = new[] { new Drop2("rotten_flesh", 0, 2), new Drop2("iron_ingot", 1, 1, 0.025f), new Drop2("carrot", 1, 1, 0.025f), new Drop2("potato", 1, 1, 0.025f) };
            Humanoid(zombie, 0x5E8C4A, 0x2B6A8C, 0x2E2E86, true); Eyes(zombie, 0x101010);
            var drowned = Def("drowned", "Ahogado", AI.Hostile, 20, 2.2f, 0.6f, 1.95f, 0.95f); drowned.hostile = true; drowned.damage = 3; drowned.ambient = Clip.Zombie; drowned.ambientChance = 0.003f;
            drowned.drops = new[] { new Drop2("rotten_flesh", 0, 2), new Drop2("prismarine_crystals", 0, 1, 0.3f) };
            Humanoid(drowned, 0x6AA89A, 0x3A6A7A, 0x2A4A6A, true); Eyes(drowned, 0x80FFEE);
            var mummy = Def("mummy", "Momia", AI.Hostile, 22, 2.2f, 0.6f, 1.95f, 0.95f); mummy.hostile = true; mummy.damage = 3; mummy.ambient = Clip.Zombie; mummy.ambientChance = 0.003f;
            mummy.drops = new[] { new Drop2("rotten_flesh", 0, 2), new Drop2("gold_ingot", 1, 1, 0.08f), new Drop2("bone", 0, 1) };
            Humanoid(mummy, 0xCFC49A, 0xBFB48A, 0xB0A47A, true); Eyes(mummy, 0xE03030);
            var skel = Def("skeleton", "Esqueleto", AI.Skeleton, 20, 2.1f, 0.6f, 1.95f, 0.95f); skel.hostile = true; skel.burnsInDay = true; skel.damage = 3; skel.sight = 24f;
            skel.drops = new[] { new Drop2("bone", 0, 2), new Drop2("arrow", 0, 2) };
            Humanoid(skel, 0xD8D8CC, 0xC8C8BC, 0xC0C0B4, false, 2f, 2f, 6f); Eyes(skel, 0x202020);
            var askel = Def("abyss_skeleton", "Esqueleto del Abismo", AI.Skeleton, 24, 2.1f, 0.6f, 1.95f, 0.95f); askel.hostile = true; askel.damage = 4; askel.sight = 26f;
            askel.drops = new[] { new Drop2("bone", 0, 2), new Drop2("coal", 0, 1), new Drop2("quartz", 0, 1, 0.3f) };
            Humanoid(askel, 0x6A5A5A, 0x4A3A3A, 0x3A2A2A, false, 2f, 2f, 6f); Eyes(askel, 0xFF8030);
            var spider = Def("spider", "Araña", AI.Spider, 16, 3.4f, 1.2f, 0.7f, 0.9f); spider.hostile = true; spider.damage = 2;
            spider.drops = new[] { new Drop2("string", 0, 2), new Drop2("spider_eye", 0, 1, 0.33f) };
            spider.Add("body", 10, 8, 12, 0, 9, 0, 0, -4, 0, 0x3A3030); spider.Add("head", 8, 8, 8, 0, 9, 8, 0, -4, 0, 0x4A3A3A, 'h');
            spider.Add("eyeL", 1.5f, 1.5f, 0.4f, -2, 8, 12.05f, 0, 0, 0, 0xFF2020); spider.Add("eyeR", 1.5f, 1.5f, 0.4f, 2, 8, 12.05f, 0, 0, 0, 0xFF2020);
            for (int i = 0; i < 4; i++)
            {
                float z = 6 - i * 3.2f;
                spider.Add("legL" + i, 12, 1.5f, 1.5f, -4, 6, z, -6, 0, 0, 0x2A2222, (i % 2 == 0) ? 'a' : 'b');
                spider.Add("legR" + i, 12, 1.5f, 1.5f, 4, 6, z, 6, 0, 0, 0x2A2222, (i % 2 == 0) ? 'b' : 'a');
            }
            var creeper = Def("detonator", "Detonador", AI.Exploder, 20, 2.1f, 0.6f, 1.7f, 0.95f); creeper.hostile = true;
            creeper.drops = new[] { new Drop2("gunpowder", 0, 2) };
            creeper.Add("legFL", 4, 6, 4, -2, 6, 4, 0, -3, 0, 0x3AA02E, 'a'); creeper.Add("legFR", 4, 6, 4, 2, 6, 4, 0, -3, 0, 0x3AA02E, 'b');
            creeper.Add("legBL", 4, 6, 4, -2, 6, -4, 0, -3, 0, 0x3AA02E, 'b'); creeper.Add("legBR", 4, 6, 4, 2, 6, -4, 0, -3, 0, 0x3AA02E, 'a');
            creeper.Add("body", 8, 12, 4, 0, 18, 0, 0, -6, 0, 0x4DBA3A);
            creeper.Add("head", 8, 8, 8, 0, 18, 0, 0, 4, 0, 0x55C640, 'h');
            creeper.Add("eyeL", 2, 2, 0.4f, -2, 22.5f, 4.05f, 0, 0, 0, 0x101010, 'e'); creeper.Add("eyeR", 2, 2, 0.4f, 2, 22.5f, 4.05f, 0, 0, 0, 0x101010, 'e');
            creeper.Add("mouth", 2, 4, 0.4f, 0, 20.5f, 4.05f, 0, 0, 0, 0x101010, 'e');
            var slime = Def("gelatin", "Gelatina", AI.Slime, 12, 2f, 0.9f, 0.9f, 1f); slime.hostile = true; slime.damage = 2;
            slime.drops = new[] { new Drop2("slimeball", 0, 2) };
            slime.Add("core", 6, 6, 6, 0, 1, 0, 0, 3, 0, 0x3A8A3A);
            slime.Add("shell", 9, 9, 9, 0, 0, 0, 0, 4.5f, 0, 0x78D868);
            slime.Add("eyeL", 1.8f, 1.8f, 0.4f, -2.5f, 6, 4.55f, 0, 0, 0, 0x203020); slime.Add("eyeR", 1.8f, 1.8f, 0.4f, 2.5f, 6, 4.55f, 0, 0, 0, 0x203020);
            slime.Add("mouth", 1.2f, 1.2f, 0.4f, 0, 3, 4.55f, 0, 0, 0, 0x203020);
            var ender = Def("wanderer", "Errante", AI.Wanderer, 40, 3f, 0.6f, 2.9f, 1f); ender.hostile = false; ender.damage = 7;
            ender.drops = new[] { new Drop2("ender_pearl", 0, 1, 0.6f) };
            ender.Add("legL", 2, 30, 2, -2, 30, 0, 0, -15, 0, 0x101014, 'a'); ender.Add("legR", 2, 30, 2, 2, 30, 0, 0, -15, 0, 0x101014, 'b');
            ender.Add("body", 8, 12, 4, 0, 42, 0, 0, -6, 0, 0x181820);
            ender.Add("armL", 2, 30, 2, -5, 41, 0, 0, -14, 0, 0x101014, 'A'); ender.Add("armR", 2, 30, 2, 5, 41, 0, 0, -14, 0, 0x101014, 'B');
            ender.Add("head", 8, 8, 8, 0, 42, 0, 0, 4, 0, 0x181820, 'h');
            ender.Add("eyeL", 2.5f, 1, 0.4f, -2.2f, 46, 4.05f, 0, 0, 0, 0xE060FF); ender.Add("eyeR", 2.5f, 1, 0.4f, 2.2f, 46, 4.05f, 0, 0, 0, 0xE060FF);
            ender.glow = false; ender.scale = 0.96f;
            var blaze = Def("blaze", "Llamarada", AI.Blaze, 20, 2.4f, 0.6f, 1.8f, 1f); blaze.hostile = true; blaze.flies = true; blaze.damage = 5; blaze.sight = 30f;
            blaze.drops = new[] { new Drop2("blaze_rod", 0, 1, 0.7f) };
            blaze.Add("head", 8, 8, 8, 0, 22, 0, 0, 0, 0, 0xE8B830, 'h');
            blaze.Add("eyeL", 1.8f, 1.8f, 0.4f, -2, 23, 4.05f, 0, 0, 0, 0x402010); blaze.Add("eyeR", 1.8f, 1.8f, 0.4f, 2, 23, 4.05f, 0, 0, 0, 0x402010);
            for (int i = 0; i < 12; i++)
            {
                double ang = i * Math.PI * 2 / 12; float rad = 7 - (i / 4) * 0.5f;
                blaze.Add("rod" + i, 2, 8, 2, (float)Math.Cos(ang) * rad, 4 + (i / 4) * 6, (float)Math.Sin(ang) * rad, 0, 0, 0, i % 2 == 0 ? 0xF0A020u : 0xE07010u, 'r');
            }
            blaze.glow = true;
            var golem = Def("crystal_golem", "Gólem de cristal", AI.Golem, 80, 1.6f, 1.3f, 3.0f, 1.6f); golem.hostile = true; golem.damage = 9; golem.sight = 16f;
            golem.drops = new[] { new Drop2("sky_crystal_shard", 2, 5), new Drop2("ruby", 0, 1, 0.3f), new Drop2("sapphire", 0, 1, 0.3f), new Drop2("diamond", 0, 1, 0.15f) };
            Humanoid(golem, 0x9AE8F0, 0x6ACAD8, 0x5AB8C8, true, 6f, 5f, 12f);
            golem.Add("crystalA", 3, 6, 3, -4, 24, -3, 0, 3, 0, 0xE8FFFF); golem.Add("crystalB", 3, 8, 3, 3, 24, -2, 0, 4, 0, 0xCFFAFF);
            Eyes(golem, 0xFFFF80, 28.5f, 2.2f, 4.05f, 2f);
            golem.glow = true;
            var spirit = Def("spirit", "Espíritu", AI.Spirit, 6, 1.4f, 0.5f, 0.7f, 1f); spirit.flies = true;
            spirit.drops = new[] { new Drop2("spirit_essence", 1, 2) };
            spirit.Add("core", 6, 6, 6, 0, 8, 0, 0, 0, 0, 0xBFF8FF, 'k'); spirit.Add("halo", 9, 2, 9, 0, 8, 0, 0, 0, 0, 0x7AD8F0, 'r');
            spirit.Add("tail1", 4, 4, 4, 0, 5, -5, 0, 0, 0, 0x9AE8F8, 'k'); spirit.Add("tail2", 2.5f, 2.5f, 2.5f, 0, 3, -9, 0, 0, 0, 0x7AD8F0, 'k');
            spirit.Add("eyeL", 1.2f, 1.2f, 0.4f, -1.5f, 8.5f, 3.05f, 0, 0, 0, 0x203050); spirit.Add("eyeR", 1.2f, 1.2f, 0.4f, 1.5f, 8.5f, 3.05f, 0, 0, 0, 0x203050);
            spirit.glow = true;
        }

        static void QuadBody(MobDef d, uint body, uint head, uint legs, float bw, float bh, float bl, float headS)
        {
            float legH = 12f * (bh / 10f > 1f ? 1f : 0.8f);
            legH = Mathf.Max(5f, bh < 9 ? 6f : 12f);
            if (bh >= 10) legH = 12f;
            float by = legH + bh * 0.5f;
            d.Add("legFL", 4, legH, 4, -bw * 0.5f + 2, legH, bl * 0.5f - 2, 0, -legH / 2, 0, legs, 'a'); d.Add("legFR", 4, legH, 4, bw * 0.5f - 2, legH, bl * 0.5f - 2, 0, -legH / 2, 0, legs, 'b');
            d.Add("legBL", 4, legH, 4, -bw * 0.5f + 2, legH, -bl * 0.5f + 2, 0, -legH / 2, 0, legs, 'b'); d.Add("legBR", 4, legH, 4, bw * 0.5f - 2, legH, -bl * 0.5f + 2, 0, -legH / 2, 0, legs, 'a');
            d.Add("body", bw, bh, bl, 0, by, 0, 0, 0, 0, body);
            float hy = by + bh * 0.2f;
            d.Add("head", headS, headS, headS * 0.9f, 0, hy, bl * 0.5f + 1, 0, 0, headS * 0.45f, head, 'h');
            d.Add("eyeL", 1.4f, 1.4f, 0.4f, -headS * 0.28f, hy + headS * 0.15f, bl * 0.5f + 1 + headS * 0.9f + 0.05f, 0, 0, 0, 0x101010);
            d.Add("eyeR", 1.4f, 1.4f, 0.4f, headS * 0.28f, hy + headS * 0.15f, bl * 0.5f + 1 + headS * 0.9f + 0.05f, 0, 0, 0, 0x101010);
        }

        static void FishBody(MobDef d, uint body, uint belly)
        {
            d.Add("body", 3, 4, 8, 0, 2, 0, 0, 0, 0, body);
            d.Add("belly", 2.8f, 1, 6, 0, 0.3f, 0, 0, 0, 0, belly);
            d.Add("head", 3, 4, 3, 0, 2, 5, 0, 0, 0, body);
            d.Add("tail", 0.8f, 5, 3, 0, 2, -5.5f, 0, 0, 0, body, 't');
            d.Add("eyeL", 0.5f, 1, 1, -1.6f, 3, 5.5f, 0, 0, 0, 0x101010); d.Add("eyeR", 0.5f, 1, 1, 1.6f, 3, 5.5f, 0, 0, 0, 0x101010);
        }

        public static void EnsureInit() { Init(); }

        /// <summary>Todos los mobs en orden (para el creativo / documentacion).</summary>
        public static IEnumerable<MobDef> Each() { Init(); return All.Values; }

        // --------------------------------------------------------------- mallas de cajas
        static readonly Dictionary<long, Mesh> boxCache = new Dictionary<long, Mesh>();

        public static Mesh BoxMesh(Vector3 sizePx, Color32 color)
        {
            long key = ((long)(sizePx.x * 10) << 48) ^ ((long)(sizePx.y * 10) << 36) ^ ((long)(sizePx.z * 10) << 24) ^ ((long)color.r << 16) ^ ((long)color.g << 8) ^ color.b;
            Mesh m;
            if (boxCache.TryGetValue(key, out m)) return m;
            float hx = sizePx.x / 32f, hy = sizePx.y / 32f, hz = sizePx.z / 32f;
            var v = new List<Vector3>(); var col = new List<Color32>(); var uv = new List<Vector2>(); var uv2 = new List<Vector2>(); var t = new List<int>();
            float[][] faces = {
                new[] { hx, -hy, hz, hx, hy, hz, hx, hy, -hz, hx, -hy, -hz },
                new[] { -hx, -hy, -hz, -hx, hy, -hz, -hx, hy, hz, -hx, -hy, hz },
                new[] { -hx, hy, hz, -hx, hy, -hz, hx, hy, -hz, hx, hy, hz },
                new[] { -hx, -hy, -hz, -hx, -hy, hz, hx, -hy, hz, hx, -hy, -hz },
                new[] { -hx, -hy, hz, -hx, hy, hz, hx, hy, hz, hx, -hy, hz },
                new[] { hx, -hy, -hz, hx, hy, -hz, -hx, hy, -hz, -hx, -hy, -hz } };
            float[] shade = { 0.8f, 0.8f, 1f, 0.5f, 0.9f, 0.65f };
            float u = (TileAtlas.U0[TileAtlas.White] + TileAtlas.U1[TileAtlas.White]) * 0.5f, vv = (TileAtlas.V0[TileAtlas.White] + TileAtlas.V1[TileAtlas.White]) * 0.5f;
            for (int f = 0; f < 6; f++)
            {
                int bi = v.Count;
                var q = faces[f];
                for (int k = 0; k < 4; k++)
                {
                    v.Add(new Vector3(q[k * 3], q[k * 3 + 1], q[k * 3 + 2]));
                    col.Add(new Color32((byte)(color.r * shade[f]), (byte)(color.g * shade[f]), (byte)(color.b * shade[f]), 255));
                    uv.Add(new Vector2(u, vv)); uv2.Add(Vector2.one);
                }
                t.Add(bi); t.Add(bi + 1); t.Add(bi + 2); t.Add(bi); t.Add(bi + 2); t.Add(bi + 3);
            }
            m = new Mesh();
            m.SetVertices(v); m.SetColors(col); m.SetUVs(0, uv); m.SetUVs(1, uv2); m.SetTriangles(t, 0);
            m.RecalculateBounds();
            boxCache[key] = m;
            return m;
        }
    }
}
