using System.Collections.Generic;

namespace MundoBloques
{
    /// <summary>Tablas de botin para los cofres generados.</summary>
    public static class Loot
    {
        struct E
        {
            public string item; public int min, max; public float weight;
            public E(string item, int min, int max, float weight) { this.item = item; this.min = min; this.max = max; this.weight = weight; }
        }

        sealed class Table { public int rollsMin, rollsMax; public E[] entries; public float total; }

        static readonly Dictionary<string, Table> tables = new Dictionary<string, Table>();

        static void Def(string name, int rmin, int rmax, params E[] e)
        {
            var t = new Table { rollsMin = rmin, rollsMax = rmax, entries = e };
            for (int i = 0; i < e.Length; i++) t.total += e[i].weight;
            tables[name] = t;
        }

        static Loot()
        {
            Def("village", 4, 8,
                new E("bread", 1, 4, 10), new E("wheat", 1, 5, 8), new E("carrot", 1, 4, 8), new E("potato", 1, 4, 8), new E("apple", 1, 3, 6),
                new E("iron_ingot", 1, 2, 4), new E("coal", 1, 3, 5), new E("torch", 2, 6, 6), new E("emerald", 1, 2, 2), new E("wheat_seeds", 2, 6, 8),
                new E("bone_meal", 1, 3, 3), new E("stick", 2, 5, 5), new E("cooked_beef", 1, 2, 3), new E("tomato_seeds", 1, 3, 4), new E("beetroot_seeds", 1, 3, 4));
            Def("smithy", 4, 7,
                new E("iron_ingot", 1, 3, 8), new E("gold_ingot", 1, 2, 4), new E("copper_ingot", 1, 4, 6), new E("iron_sword", 1, 1, 2), new E("iron_pickaxe", 1, 1, 2),
                new E("iron_axe", 1, 1, 2), new E("iron_helmet", 1, 1, 1), new E("iron_chestplate", 1, 1, 1), new E("diamond", 1, 2, 1.5f), new E("coal", 2, 5, 8),
                new E("bread", 1, 3, 5), new E("apple", 1, 3, 4), new E("obsidian", 3, 6, 2), new E("copper_pickaxe", 1, 1, 2));
            Def("dungeon", 3, 6,
                new E("bone", 1, 4, 10), new E("string", 1, 4, 8), new E("gunpowder", 1, 4, 8), new E("iron_ingot", 1, 3, 5), new E("gold_ingot", 1, 2, 4),
                new E("bread", 1, 2, 6), new E("bucket", 1, 1, 2), new E("arrow", 2, 6, 6), new E("diamond", 1, 1, 1.2f), new E("ruby", 1, 1, 1),
                new E("sapphire", 1, 1, 1), new E("golden_apple", 1, 1, 0.6f), new E("copper_ingot", 1, 3, 5), new E("lapis", 2, 5, 4), new E("coal", 1, 4, 6));
            Def("temple", 4, 7,
                new E("bone", 1, 3, 8), new E("rotten_flesh", 1, 4, 8), new E("gold_ingot", 1, 3, 6), new E("emerald", 1, 3, 4), new E("diamond", 1, 2, 2),
                new E("iron_ingot", 1, 3, 6), new E("spider_eye", 1, 2, 5), new E("gunpowder", 1, 3, 6), new E("amethyst_shard", 1, 3, 3), new E("ruby", 1, 1, 1),
                new E("golden_apple", 1, 1, 0.5f), new E("tnt", 1, 2, 1));
            Def("sky", 4, 7,
                new E("sky_crystal_shard", 1, 4, 10), new E("spirit_essence", 1, 3, 8), new E("cloud_fluff", 2, 5, 6), new E("ruby", 1, 2, 2.5f), new E("sapphire", 1, 2, 2.5f),
                new E("emerald", 1, 2, 2.5f), new E("amethyst_shard", 2, 5, 4), new E("diamond", 1, 2, 2), new E("golden_apple", 1, 1, 1), new E("apple", 1, 3, 4),
                new E("ender_pearl", 1, 1, 1), new E("iron_ingot", 1, 3, 4), new E("gold_ingot", 1, 3, 4));
            Def("stronghold", 3, 6,
                new E("ender_pearl", 1, 2, 3), new E("iron_ingot", 1, 3, 6), new E("gold_ingot", 1, 2, 4), new E("bread", 1, 3, 6), new E("apple", 1, 2, 5),
                new E("book", 1, 2, 4), new E("diamond", 1, 1, 1), new E("paper", 2, 5, 5), new E("golden_apple", 1, 1, 0.7f), new E("iron_pickaxe", 1, 1, 1.2f),
                new E("arrow", 3, 8, 4), new E("coal", 2, 5, 5), new E("blaze_powder", 1, 2, 1));
            Def("mineshaft", 3, 6,
                new E("coal", 2, 6, 10), new E("iron_ingot", 1, 3, 6), new E("copper_ingot", 1, 4, 6), new E("gold_ingot", 1, 2, 3), new E("torch", 3, 8, 8),
                new E("bread", 1, 3, 5), new E("lapis", 2, 6, 4), new E("iron_pickaxe", 1, 1, 1.2f), new E("diamond", 1, 1, 0.8f), new E("ruby", 1, 1, 0.6f),
                new E("sapphire", 1, 1, 0.6f), new E("amethyst_shard", 1, 3, 2), new E("tnt", 1, 2, 1), new E("stick", 2, 6, 6), new E("bone", 1, 3, 3),
                new E("golden_apple", 1, 1, 0.3f), new E("raw_iron", 1, 3, 4));
            Def("shipwreck", 3, 6,
                new E("emerald", 1, 4, 5), new E("gold_ingot", 1, 4, 6), new E("iron_ingot", 1, 4, 6), new E("diamond", 1, 2, 2), new E("sapphire", 1, 2, 2),
                new E("ruby", 1, 1, 1.5f), new E("amethyst_shard", 1, 4, 3), new E("lapis", 2, 6, 4), new E("book", 1, 2, 3), new E("saddle", 1, 1, 1),
                new E("fishing_rod", 1, 1, 1.5f), new E("golden_apple", 1, 1, 0.8f), new E("bow", 1, 1, 0.8f));
            Def("shipwreck_supply", 4, 8,
                new E("bread", 2, 6, 10), new E("cooked_cod", 2, 5, 8), new E("cooked_salmon", 2, 4, 6), new E("apple", 1, 4, 6), new E("carrot", 1, 4, 6),
                new E("potato", 1, 4, 6), new E("coal", 2, 6, 6), new E("string", 1, 4, 6), new E("stick", 2, 6, 6), new E("arrow", 3, 8, 4), new E("torch", 3, 8, 5),
                new E("feather", 1, 4, 4), new E("leather", 1, 3, 3), new E("oak_planks", 2, 8, 5));
            Def("ruined_portal", 3, 5,
                new E("obsidian", 1, 4, 8), new E("flint_and_steel", 1, 1, 3), new E("gold_ingot", 1, 4, 6), new E("iron_ingot", 1, 3, 5), new E("glowstone_dust", 1, 4, 4),
                new E("golden_apple", 1, 1, 1), new E("quartz", 1, 4, 4), new E("abyss_brick", 1, 4, 3), new E("abismita_scrap", 1, 1, 0.5f), new E("diamond", 1, 1, 0.5f));
            Def("abyss", 4, 7,
                new E("gold_ingot", 1, 3, 8), new E("iron_ingot", 1, 3, 6), new E("obsidian", 2, 4, 4), new E("glowstone_dust", 2, 5, 6), new E("quartz", 2, 6, 6),
                new E("diamond", 1, 2, 2), new E("abismita_scrap", 1, 1, 1), new E("flint_and_steel", 1, 1, 2), new E("golden_apple", 1, 1, 1.5f),
                new E("blaze_rod", 1, 2, 3));
        }

        public static void Fill(ChestEntity chest, string table, Rng rng)
        {
            Table t;
            if (!tables.TryGetValue(table, out t)) return;
            int rolls = rng.Range(t.rollsMin, t.rollsMax + 1);
            for (int r = 0; r < rolls; r++)
            {
                float pick = rng.Float() * t.total;
                E chosen = t.entries[0];
                for (int i = 0; i < t.entries.Length; i++)
                {
                    pick -= t.entries[i].weight;
                    if (pick <= 0) { chosen = t.entries[i]; break; }
                }
                var it = Items.Get(chosen.item);
                if (it == null) continue;
                int n = rng.Range(chosen.min, chosen.max + 1);
                var stack = new ItemStack(it, it.maxStack == 1 ? 1 : n);
                int slot = rng.Int(27);
                for (int k = 0; k < 27; k++)
                {
                    int s = (slot + k) % 27;
                    if (chest.slots[s].IsEmpty) { chest.slots[s] = stack; break; }
                }
            }
        }
    }
}
