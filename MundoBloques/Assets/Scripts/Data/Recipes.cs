using System;
using UnityEngine;
using System.Collections.Generic;

namespace MundoBloques
{
    public sealed class CraftRecipe
    {
        public string outKey; public int outCount = 1;
        public bool shapeless;
        public int w, h;
        public string[] cells;                 // shaped: w*h (null = vacio)
        public List<string> list;              // shapeless
        public Item output;
        public string Name { get { return output != null ? output.name : outKey; } }
    }

    public sealed class SmeltRecipe { public string input, output; public float time = 10f; }
    public sealed class CutRecipe { public string input, output; public int count = 1; }

    /// <summary>Todas las recetas del juego: crafteo (2x2/3x3), horno y cortapiedras.</summary>
    public static class Recipes
    {
        public static readonly List<CraftRecipe> Craft = new List<CraftRecipe>();
        public static readonly List<SmeltRecipe> Smelt = new List<SmeltRecipe>();
        public static readonly List<CutRecipe> Cut = new List<CutRecipe>();
        static readonly Dictionary<string, HashSet<string>> tags = new Dictionary<string, HashSet<string>>();
        static readonly Dictionary<string, SmeltRecipe> smeltBy = new Dictionary<string, SmeltRecipe>();
        static readonly Dictionary<string, List<CutRecipe>> cutBy = new Dictionary<string, List<CutRecipe>>();
        public static bool Ready;

        // ------------ etiquetas ------------
        public static bool IngredientMatches(string ing, Item it)
        {
            if (it == null) return false;
            if (ing[0] == '#')
            {
                HashSet<string> set;
                return tags.TryGetValue(ing.Substring(1), out set) && set.Contains(it.key);
            }
            return it.key == ing;
        }

        public static IEnumerable<string> TagMembers(string tag)
        {
            HashSet<string> set;
            if (tags.TryGetValue(tag, out set)) return set;
            return new string[0];
        }

        static void Tag(string tag, params string[] keys)
        {
            HashSet<string> set;
            if (!tags.TryGetValue(tag, out set)) { set = new HashSet<string>(); tags[tag] = set; }
            for (int i = 0; i < keys.Length; i++) set.Add(keys[i]);
        }

        // ------------ constructores ------------
        static void S(string outKey, int n, string pattern, params object[] map)
        {
            var d = new Dictionary<char, string>();
            for (int i = 0; i + 1 < map.Length; i += 2) d[(char)map[i]] = (string)map[i + 1];
            var rows = pattern.Split('|');
            int w = 0; for (int i = 0; i < rows.Length; i++) w = Math.Max(w, rows[i].Length);
            var r = new CraftRecipe { outKey = outKey, outCount = n, w = w, h = rows.Length, cells = new string[w * rows.Length] };
            for (int y = 0; y < rows.Length; y++)
                for (int x = 0; x < w; x++)
                {
                    char c = x < rows[y].Length ? rows[y][x] : ' ';
                    if (c == ' ') continue;
                    string k;
                    if (!d.TryGetValue(c, out k)) { Err("Receta " + outKey + ": falta ingrediente '" + c + "'"); return; }
                    r.cells[y * w + x] = k;
                }
            Finish(r);
        }

        static void L(string outKey, int n, params string[] ings)
        {
            var r = new CraftRecipe { outKey = outKey, outCount = n, shapeless = true, list = new List<string>(ings) };
            Finish(r);
        }

        static void Finish(CraftRecipe r)
        {
            r.output = Items.Get(r.outKey);
            if (r.output == null) { Err("Receta con resultado desconocido: " + r.outKey); return; }
            if (r.shapeless) foreach (var s in r.list) CheckIng(s, r.outKey);
            else foreach (var s in r.cells) if (s != null) CheckIng(s, r.outKey);
            Craft.Add(r);
        }

        static void CheckIng(string s, string ctx)
        {
            if (s[0] == '#') { if (!tags.ContainsKey(s.Substring(1))) Err("Etiqueta desconocida " + s + " en " + ctx); }
            else if (Items.Get(s) == null) Err("Ingrediente desconocido '" + s + "' en " + ctx);
        }

        static void Err(string m) { Debug.LogError(m); }

        static void Smeltr(string input, string output, float time = 10f)
        {
            if (Items.Get(input) == null || Items.Get(output) == null) { Err("Horno: " + input + " -> " + output); return; }
            var r = new SmeltRecipe { input = input, output = output, time = time };
            Smelt.Add(r); smeltBy[input] = r;
        }

        static void Cutr(string input, string output, int count = 1)
        {
            if (Items.Get(input) == null || Items.Get(output) == null) { Err("Cortapiedras: " + input + " -> " + output); return; }
            var r = new CutRecipe { input = input, output = output, count = count };
            Cut.Add(r);
            List<CutRecipe> l;
            if (!cutBy.TryGetValue(input, out l)) { l = new List<CutRecipe>(); cutBy[input] = l; }
            l.Add(r);
        }

        // ------------ consultas ------------
        public static SmeltRecipe FindSmelt(Item it)
        {
            SmeltRecipe r;
            return it != null && smeltBy.TryGetValue(it.key, out r) ? r : null;
        }

        public static List<CutRecipe> CutsFor(Item it)
        {
            List<CutRecipe> l;
            return it != null && cutBy.TryGetValue(it.key, out l) ? l : null;
        }

        public static float FuelTime(Item it) { return it == null ? 0f : it.fuel; }

        /// <summary>Busca una receta que coincida con la cuadricula (gw x gh).</summary>
        public static CraftRecipe Find(ItemStack[] grid, int gw, int gh)
        {
            int filled = 0;
            for (int i = 0; i < gw * gh; i++) if (!grid[i].IsEmpty) filled++;
            if (filled == 0) return null;
            for (int i = 0; i < Craft.Count; i++)
            {
                var r = Craft[i];
                if (r.shapeless)
                {
                    if (r.list.Count != filled) continue;
                    if (MatchShapeless(r, grid, gw * gh)) return r;
                }
                else
                {
                    if (r.w > gw || r.h > gh) continue;
                    if (MatchShaped(r, grid, gw, gh, false) || MatchShaped(r, grid, gw, gh, true)) return r;
                }
            }
            return null;
        }

        static bool MatchShapeless(CraftRecipe r, ItemStack[] grid, int n)
        {
            var used = new bool[n];
            foreach (var ing in r.list)
            {
                bool found = false;
                for (int i = 0; i < n; i++)
                {
                    if (used[i] || grid[i].IsEmpty) continue;
                    if (IngredientMatches(ing, grid[i].item)) { used[i] = true; found = true; break; }
                }
                if (!found) return false;
            }
            return true;
        }

        static bool MatchShaped(CraftRecipe r, ItemStack[] grid, int gw, int gh, bool mirror)
        {
            for (int oy = 0; oy <= gh - r.h; oy++)
                for (int ox = 0; ox <= gw - r.w; ox++)
                {
                    bool ok = true;
                    for (int y = 0; y < gh && ok; y++)
                        for (int x = 0; x < gw && ok; x++)
                        {
                            int rx = x - ox, ry = y - oy;
                            string need = null;
                            if (rx >= 0 && ry >= 0 && rx < r.w && ry < r.h) need = r.cells[ry * r.w + (mirror ? r.w - 1 - rx : rx)];
                            var have = grid[y * gw + x];
                            if (need == null) { if (!have.IsEmpty) ok = false; }
                            else if (have.IsEmpty || !IngredientMatches(need, have.item)) ok = false;
                        }
                    if (ok) return true;
                }
            return false;
        }

        // ------------ definicion ------------
        public static void Init()
        {
            if (Ready) return;
            Items.Init();
            Ready = true;

            // ---- etiquetas ----
            var planks = new List<string>(); var logs = new List<string>(); var wools = new List<string>();
            for (int i = 0; i < Woods.All.Length; i++) { planks.Add(B.Planks[i].key); logs.Add(B.Log[i].key); }
            for (int i = 0; i < 16; i++) wools.Add(B.Wool[i].key);
            Tag("planks", planks.ToArray());
            Tag("logs", logs.ToArray());
            Tag("wool", wools.ToArray());
            Tag("stone_tool_materials", "cobblestone", "cobbled_deepslate", "mossy_cobblestone");
            Tag("coals", "coal", "charcoal");
            Tag("sand", "sand", "red_sand");
            Tag("fish", "cod", "salmon");
            Tag("meat", "cooked_beef", "cooked_pork", "cooked_chicken", "cooked_mutton", "cooked_rabbit");
            Tag("mushrooms", "mushroom_red", "mushroom_brown");
            Tag("flowers", "dandelion", "poppy", "blue_orchid", "allium", "tulip_red", "tulip_orange", "tulip_white", "tulip_pink", "cornflower", "lily_valley", "sunflower");

            // ---- basicos ----
            S("stick", 4, "P|P", 'P', "#planks");
            S("crafting_table", 1, "PP|PP", 'P', "#planks");
            S("chest", 1, "PPP|P P|PPP", 'P', "#planks");
            S("furnace", 1, "CCC|C C|CCC", 'C', "#stone_tool_materials");
            S("stonecutter", 1, " I |SSS", 'I', "iron_ingot", 'S', "stone");
            S("torch", 4, "C|S", 'C', "#coals", 'S', "stick");
            S("bed", 1, "WWW|PPP", 'W', "#wool", 'P', "#planks");
            S("bookshelf", 1, "PPP|BBB|PPP", 'P', "#planks", 'B', "book");
            S("tnt", 1, "GSG|SGS|GSG", 'G', "gunpowder", 'S', "#sand");
            S("bowl", 4, "P P| P ", 'P', "#planks");
            S("bucket", 1, "I I| I ", 'I', "iron_ingot");
            S("shears", 1, " I|I ", 'I', "iron_ingot");
            L("flint_and_steel", 1, "iron_ingot", "flint");
            S("bow", 1, " SX|S X| SX", 'S', "stick", 'X', "string");
            S("fishing_rod", 1, "  S| ST|S T", 'S', "stick", 'T', "string");
            S("boat", 1, "P P|PPP", 'P', "#planks");
            S("saddle", 1, "LLL|LIL", 'L', "leather", 'I', "iron_ingot");
            S("arrow", 4, "F|S|T", 'F', "flint", 'S', "stick", 'T', "feather");
            S("paper", 3, "CCC", 'C', "sugar_cane");
            L("sugar", 1, "sugar_cane");
            L("book", 1, "paper", "paper", "paper", "leather");
            S("hay_block", 1, "WWW|WWW|WWW", 'W', "wheat");
            L("wheat", 9, "hay_block");

            // ---- bloques de construccion ----
            S("stone_bricks", 4, "SS|SS", 'S', "stone");
            L("mossy_stone_bricks", 1, "stone_bricks", "moss_block");
            L("mossy_cobblestone", 1, "cobblestone", "moss_block");
            S("chiseled_stone_bricks", 1, "S|S", 'S', "stone_bricks_slab");
            S("polished_granite", 4, "GG|GG", 'G', "granite");
            S("polished_diorite", 4, "GG|GG", 'G', "diorite");
            S("polished_andesite", 4, "GG|GG", 'G', "andesite");
            S("polished_deepslate", 4, "GG|GG", 'G', "cobbled_deepslate");
            S("deepslate_bricks", 4, "GG|GG", 'G', "polished_deepslate");
            S("deepslate_tiles", 4, "GG|GG", 'G', "deepslate_bricks");
            S("sandstone", 1, "SS|SS", 'S', "sand");
            S("red_sandstone", 1, "SS|SS", 'S', "red_sand");
            L("granite", 2, "diorite", "quartz");
            L("diorite", 2, "cobblestone", "quartz");
            L("andesite", 2, "diorite", "cobblestone");
            S("bricks", 1, "BB|BB", 'B', "brick");
            S("clay", 1, "CC|CC", 'C', "clay_ball");
            S("quartz_block", 1, "QQ|QQ", 'Q', "quartz");
            S("quartz_pillar", 2, "Q|Q", 'Q', "quartz_block");
            S("quartz_bricks", 4, "QQ|QQ", 'Q', "quartz_block");
            S("prismarine", 1, "PP|PP", 'P', "prismarine_crystals");
            S("prismarine_bricks", 1, "PPP|PPP|PPP", 'P', "prismarine_crystals");
            S("dark_prismarine", 1, "PPP|PCP|PPP", 'P', "prismarine_crystals", 'C', "coal");
            S("sea_lantern", 1, "QPQ|PPP|QPQ", 'Q', "quartz", 'P', "prismarine_crystals");
            S("end_stone_bricks", 4, "SS|SS", 'S', "end_stone");
            S("abyss_bricks", 1, "BB|BB", 'B', "abyss_brick");
            S("sky_bricks", 4, "SS|SS", 'S', "sky_stone");
            S("sky_stone", 4, "CC|CC", 'C', "cloud_fluff");
            S("cloud", 1, "FF|FF", 'F', "cloud_fluff");
            S("sky_crystal", 1, "SS|SS", 'S', "sky_crystal_shard");
            S("glowstone", 1, "DD|DD", 'D', "glowstone_dust");
            S("amethyst_block", 1, "AA|AA", 'A', "amethyst_shard");
            L("podzol", 1, "dirt", "stick");
            L("coarse_dirt", 2, "dirt", "gravel");
            S("snow_block", 1, "SS|SS", 'S', "snowball");

            // ---- bloques de almacenamiento ----
            string[,] store = {
                { "coal_block", "coal" }, { "copper_block", "copper_ingot" }, { "iron_block", "iron_ingot" }, { "gold_block", "gold_ingot" },
                { "lapis_block", "lapis" }, { "diamond_block", "diamond" }, { "emerald_block", "emerald" }, { "ruby_block", "ruby" },
                { "sapphire_block", "sapphire" }, { "abismita_block", "abismita_ingot" }, { "raw_iron_block", "raw_iron" },
                { "raw_copper_block", "raw_copper" }, { "raw_gold_block", "raw_gold" }
            };
            for (int i = 0; i < store.GetLength(0); i++)
            {
                S(store[i, 0], 1, "III|III|III", 'I', store[i, 1]);
                L(store[i, 1], 9, store[i, 0]);
            }
            string[] gems = { "ruby", "sapphire", "emerald", "amethyst" };
            string[] gemItem = { "ruby", "sapphire", "emerald", "amethyst_shard" };
            for (int i = 0; i < 4; i++) L("lamp_" + gems[i], 1, gemItem[i], "glowstone", "glass");

            // ---- madera ----
            for (int i = 0; i < Woods.All.Length; i++)
            {
                string k = Woods.All[i].key;
                L(k + "_planks", 4, k + "_log");
                S(B.WoodStairs[i].key, 4, "P  |PP |PPP", 'P', k + "_planks");
                S(B.WoodSlab[i].key, 6, "PPP", 'P', k + "_planks");
                S(k + "_door", 3, "PP|PP|PP", 'P', k + "_planks");
                S(k + "_fence", 3, "PSP|PSP", 'P', k + "_planks", 'S', "stick");
                S(k + "_fence_gate", 1, "SPS|SPS", 'P', k + "_planks", 'S', "stick");
            }
            S("ladder", 3, "S S|SSS|S S", 'S', "stick");
            S("glass_pane", 16, "GGG|GGG", 'G', "glass");
            S("iron_bars", 16, "III|III", 'I', "iron_ingot");
            for (int i = 0; i < 16; i++) S("glass_pane_" + Dyes.Keys[i], 16, "GGG|GGG", 'G', "glass_" + Dyes.Keys[i]);

            // ---- escaleras y losas de piedra ----
            foreach (var b in Block.All)
            {
                if (b.baseBlock == null || b.baseBlock.key.EndsWith("_planks")) continue;
                if (b.shape == Shape.Stairs) S(b.key, 4, "B  |BB |BBB", 'B', b.baseBlock.key);
                else if (b.shape == Shape.Slab) S(b.key, 6, "BBB", 'B', b.baseBlock.key);
            }

            // ---- tintes ----
            L("dye_red", 1, "poppy"); L("dye_red", 1, "tomato"); L("dye_red", 1, "beetroot"); L("dye_red", 1, "tulip_red");
            L("dye_orange", 1, "tulip_orange"); L("dye_orange", 2, "dye_red", "dye_yellow");
            L("dye_yellow", 1, "dandelion"); L("dye_yellow", 2, "sunflower");
            L("dye_lime", 2, "dye_green", "dye_white");
            L("dye_cyan", 2, "dye_blue", "dye_green");
            L("dye_light_blue", 1, "blue_orchid"); L("dye_light_blue", 2, "dye_blue", "dye_white");
            L("dye_blue", 1, "lapis"); L("dye_blue", 1, "cornflower");
            L("dye_purple", 2, "dye_blue", "dye_red");
            L("dye_magenta", 1, "allium"); L("dye_magenta", 2, "dye_purple", "dye_pink");
            L("dye_pink", 1, "tulip_pink"); L("dye_pink", 2, "dye_red", "dye_white");
            L("dye_white", 1, "bone_meal"); L("dye_white", 1, "lily_valley"); L("dye_white", 1, "tulip_white");
            L("dye_gray", 2, "dye_black", "dye_white");
            L("dye_light_gray", 2, "dye_gray", "dye_white");
            L("dye_black", 1, "coal"); L("dye_black", 1, "charcoal");
            L("dye_brown", 2, "dye_red", "dye_green");
            for (int i = 0; i < 16; i++)
            {
                string d = Dyes.Keys[i];
                if (d != "white") L("wool_" + d, 1, "wool_white", "dye_" + d);
                S("glass_" + d, 8, "GGG|GDG|GGG", 'G', "glass", 'D', "dye_" + d);
                S("terracotta_" + d, 8, "TTT|TDT|TTT", 'T', "terracotta", 'D', "dye_" + d);
                L("concrete_" + d, 8, "sand", "sand", "sand", "sand", "gravel", "gravel", "gravel", "gravel", "dye_" + d);
            }

            // ---- herramientas y armadura ----
            for (int t = 0; t < Tiers.All.Length; t++)
            {
                var ti = Tiers.All[t];
                string m = ti.material;
                if (ti.key != "leather")
                {
                    S(ti.key + "_pickaxe", 1, "MMM| S | S ", 'M', m, 'S', "stick");
                    S(ti.key + "_axe", 1, "MM|MS| S", 'M', m, 'S', "stick");
                    S(ti.key + "_shovel", 1, "M|S|S", 'M', m, 'S', "stick");
                    S(ti.key + "_hoe", 1, "MM| S| S", 'M', m, 'S', "stick");
                    S(ti.key + "_sword", 1, "M|M|S", 'M', m, 'S', "stick");
                }
                if (ti.defense != null)
                {
                    S(ti.key + "_helmet", 1, "MMM|M M", 'M', m);
                    S(ti.key + "_chestplate", 1, "M M|MMM|MMM", 'M', m);
                    S(ti.key + "_leggings", 1, "MMM|M M|M M", 'M', m);
                    S(ti.key + "_boots", 1, "M M|M M", 'M', m);
                }
            }
            L("abismita_ingot", 1, "abismita_scrap", "abismita_scrap", "abismita_scrap", "abismita_scrap", "gold_ingot", "gold_ingot", "gold_ingot", "gold_ingot");

            // ---- comida ----
            S("bread", 1, "WWW", 'W', "wheat");
            S("cookie", 8, "WSW", 'W', "wheat", 'S', "sugar");
            L("pumpkin_pie", 1, "pumpkin", "sugar", "egg");
            S("jack_o_lantern", 1, "P|T", 'P', "pumpkin", 'T', "torch");
            L("mushroom_stew", 1, "bowl", "mushroom_red", "mushroom_brown");
            L("tomato_soup", 1, "bowl", "tomato", "tomato");
            L("salad", 1, "bowl", "carrot", "tomato", "beetroot");
            L("sandwich", 1, "bread", "tomato", "#meat");
            S("golden_apple", 1, "GGG|GAG|GGG", 'G', "gold_ingot", 'A', "apple");
            L("golden_carrot", 1, "gold_ingot", "gold_ingot", "carrot");
            L("bone_meal", 3, "bone");
            L("blaze_powder", 2, "blaze_rod");
            L("eye_of_end", 1, "ender_pearl", "blaze_powder");
            L("glowstone_dust", 4, "glowstone");

            // ---- horno ----
            Smeltr("raw_iron", "iron_ingot"); Smeltr("raw_copper", "copper_ingot"); Smeltr("raw_gold", "gold_ingot");
            Smeltr("sand", "glass"); Smeltr("red_sand", "glass");
            Smeltr("cobblestone", "stone"); Smeltr("stone", "smooth_stone"); Smeltr("stone_bricks", "cracked_stone_bricks");
            Smeltr("cobbled_deepslate", "deepslate");
            Smeltr("clay_ball", "brick"); Smeltr("clay", "terracotta"); Smeltr("abyss_rock", "abyss_brick");
            Smeltr("sandstone", "smooth_stone", 8);
            for (int i = 0; i < Woods.All.Length; i++) Smeltr(Woods.All[i].key + "_log", "charcoal");
            Smeltr("beef", "cooked_beef"); Smeltr("pork", "cooked_pork"); Smeltr("chicken", "cooked_chicken");
            Smeltr("mutton", "cooked_mutton"); Smeltr("rabbit", "cooked_rabbit"); Smeltr("cod", "cooked_cod"); Smeltr("salmon", "cooked_salmon");
            Smeltr("potato", "baked_potato"); Smeltr("cactus", "dye_green");
            Smeltr("iron_ore", "iron_ingot"); Smeltr("deep_iron_ore", "iron_ingot");
            Smeltr("copper_ore", "copper_ingot"); Smeltr("deep_copper_ore", "copper_ingot");
            Smeltr("gold_ore", "gold_ingot"); Smeltr("deep_gold_ore", "gold_ingot"); Smeltr("abyss_gold_ore", "gold_ingot");

            // ---- cortapiedras ----
            foreach (var b in Block.All)
            {
                if (b.baseBlock == null || b.baseBlock.key.EndsWith("_planks")) continue;
                if (b.shape == Shape.Stairs) Cutr(b.baseBlock.key, b.key, 1);
                else if (b.shape == Shape.Slab) Cutr(b.baseBlock.key, b.key, 2);
            }
            Cutr("stone", "stone_bricks"); Cutr("stone", "smooth_stone"); Cutr("stone", "chiseled_stone_bricks");
            Cutr("stone_bricks", "chiseled_stone_bricks");
            Cutr("cobblestone", "stone_bricks");
            Cutr("granite", "polished_granite"); Cutr("diorite", "polished_diorite"); Cutr("andesite", "polished_andesite");
            Cutr("cobbled_deepslate", "polished_deepslate"); Cutr("cobbled_deepslate", "deepslate_bricks"); Cutr("cobbled_deepslate", "deepslate_tiles");
            Cutr("polished_deepslate", "deepslate_bricks"); Cutr("polished_deepslate", "deepslate_tiles"); Cutr("deepslate_bricks", "deepslate_tiles");
            Cutr("quartz_block", "quartz_pillar"); Cutr("quartz_block", "quartz_bricks");
            Cutr("end_stone", "end_stone_bricks"); Cutr("abyss_rock", "abyss_bricks");
            Cutr("prismarine", "prismarine_bricks"); Cutr("sky_stone", "sky_bricks");
            Cutr("sandstone", "smooth_stone"); Cutr("tuff", "stone_bricks"); Cutr("basalt", "smooth_basalt");
        }
    }
}
