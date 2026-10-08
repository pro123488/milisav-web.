using System.Collections.Generic;

namespace MundoBloques
{
    public sealed class Tier
    {
        public string key, name;           // "iron", "de hierro"
        public int level; public float speed, bonus; public int durability;
        public string material;            // item para fabricar
        public uint main, light, dark;
        public int[] defense;              // casco, peto, pantalones, botas (null = sin armadura)
        public float armorDur;
        public Tier(string key, string name, int level, float speed, float bonus, int dur, string material, uint main, uint light, uint dark, int[] def = null, float armorDur = 0)
        {
            this.key = key; this.name = name; this.level = level; this.speed = speed; this.bonus = bonus; durability = dur;
            this.material = material; this.main = main; this.light = light; this.dark = dark; defense = def; this.armorDur = armorDur;
        }
    }

    public static class Tiers
    {
        public static readonly Tier[] All =
        {
            new Tier("wood", "de madera", 0, 2f, 0f, 59, "#planks", 0xA07A48, 0xC09A60, 0x6B4F2A),
            new Tier("stone", "de piedra", 1, 4f, 1f, 131, "#stone_tool_materials", 0x8A8A8A, 0xAAAAAA, 0x666666),
            new Tier("copper", "de cobre", 1, 5f, 1.5f, 190, "copper_ingot", 0xD9825A, 0xF0A27A, 0xA85F3A, new[] { 2, 5, 4, 1 }, 10),
            new Tier("iron", "de hierro", 2, 6f, 2f, 250, "iron_ingot", 0xD8D8D8, 0xFFFFFF, 0xA0A0A0, new[] { 2, 6, 5, 2 }, 15),
            new Tier("gold", "de oro", 0, 12f, 0f, 32, "gold_ingot", 0xF9D93F, 0xFFF08A, 0xC8A020, new[] { 2, 5, 3, 1 }, 7),
            new Tier("ruby", "de rubí", 3, 7.5f, 3f, 700, "ruby", 0xE0153D, 0xFF6A88, 0xA00F2C),
            new Tier("sapphire", "de zafiro", 3, 7f, 2.5f, 900, "sapphire", 0x2E5FE8, 0x7A9AFF, 0x2040A8),
            new Tier("emerald", "de esmeralda", 3, 8.5f, 2f, 650, "emerald", 0x17DD62, 0x80FFB0, 0x10A046),
            new Tier("amethyst", "de amatista", 2, 9f, 2f, 500, "amethyst_shard", 0xA571E6, 0xD0AEFF, 0x7A4AC0),
            new Tier("diamond", "de diamante", 3, 8f, 3f, 1561, "diamond", 0x5DECF5, 0xCFFFFF, 0x30B0B8, new[] { 3, 8, 6, 3 }, 33),
            new Tier("abismita", "de abismita", 4, 9f, 4f, 2031, "abismita_ingot", 0x4A3A3A, 0x7A6060, 0x2A1E1E, new[] { 3, 8, 6, 3 }, 37),
            new Tier("leather", "de cuero", 0, 1f, 0f, 0, "leather", 0xA0652D, 0xC0854D, 0x70401A, new[] { 1, 3, 2, 1 }, 5)
        };

        public static Tier Get(string key)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].key == key) return All[i];
            return null;
        }
    }

    /// <summary>Registro estatico de items.</summary>
    public static class Items
    {
        public static readonly List<Item> All = new List<Item>();
        public static readonly Dictionary<string, Item> ByKey = new Dictionary<string, Item>();
        public static bool Ready;

        public static Item Get(string key)
        {
            Item it;
            return ByKey.TryGetValue(key, out it) ? it : null;
        }

        static Item Add(Item it)
        {
            ByKey[it.key] = it; All.Add(it); return it;
        }

        static Item Mat(string key, string name, string icon, int stack = 64)
        {
            return Add(new Item { key = key, name = name, iconSpec = icon, maxStack = stack, kind = ItemKind.Material, category = "Materiales" });
        }

        static Item FoodItem(string key, string name, string icon, int hunger, float sat, int stack = 64, bool always = false)
        {
            return Add(new Item { key = key, name = name, iconSpec = icon, hunger = hunger, saturation = sat, maxStack = stack, kind = ItemKind.Food, alwaysEdible = always, category = "Comida" });
        }

        static Item Fuel(Item it, float seconds) { it.fuel = seconds; return it; }

        static Item Seed(string key, string name, string icon, string cropKey)
        {
            var it = Mat(key, name, icon); it.kind = ItemKind.Seed; it.crop = Block.ByKey["crop_" + cropKey]; it.category = "Naturaleza"; return it;
        }

        static Item Special(string key, string name, string icon, string action, int stack = 1)
        {
            return Add(new Item { key = key, name = name, iconSpec = icon, action = action, maxStack = stack, kind = ItemKind.Special, category = "Herramientas" });
        }

        static string Hex(uint c) { return "0x" + c.ToString("X6"); }

        public static void Init()
        {
            if (Ready) return;
            B.Init();
            Ready = true;

            // ---- items de bloques ----
            for (int i = 0; i < Block.All.Count; i++)
            {
                var b = Block.All[i];
                if (!b.hasItem) continue;
                var it = new Item { key = b.key, name = b.name, kind = ItemKind.Block, block = b, category = CategoryOf(b) };
                if (b.shape == Shape.Door) it.maxStack = 64;
                b.item = it;
                Add(it);
            }
            // el horno encendido suelta el horno normal
            Block.ByKey["furnace_on"].item = Get("furnace");

            // ---- materiales ----
            Fuel(Mat("stick", "Palo", "stick"), 5);
            Fuel(Mat("coal", "Carbón", "coal"), 80);
            Fuel(Mat("charcoal", "Carbón vegetal", "charcoal"), 80);
            Mat("raw_copper", "Cobre bruto", "lump|" + Hex(0xD9825A));
            Mat("raw_iron", "Hierro bruto", "lump|" + Hex(0xC4A182));
            Mat("raw_gold", "Oro bruto", "lump|" + Hex(0xE6C24A));
            Mat("copper_ingot", "Lingote de cobre", "ingot|" + Hex(0xD9825A));
            Mat("iron_ingot", "Lingote de hierro", "ingot|" + Hex(0xD8D8D8));
            Mat("gold_ingot", "Lingote de oro", "ingot|" + Hex(0xF9D93F));
            Mat("abismita_scrap", "Fragmento de abismita", "lump|" + Hex(0x5A3A3A));
            Mat("abismita_ingot", "Lingote de abismita", "ingot|" + Hex(0x4A3A3A));
            Mat("diamond", "Diamante", "gem|" + Hex(0x5DECF5));
            Mat("emerald", "Esmeralda", "gem|" + Hex(0x17DD62));
            Mat("ruby", "Rubí", "gem|" + Hex(0xE0153D));
            Mat("sapphire", "Zafiro", "gem|" + Hex(0x2E5FE8));
            Mat("amethyst_shard", "Fragmento de amatista", "shard|" + Hex(0xA571E6));
            Mat("lapis", "Lapislázuli", "dust|" + Hex(0x1F4FB5));
            Mat("quartz", "Cuarzo", "shard|" + Hex(0xEEE8E0));
            Mat("flint", "Pedernal", "flint");
            Mat("feather", "Pluma", "feather");
            Mat("leather", "Cuero", "leather");
            Mat("string", "Hilo", "string");
            Mat("bone", "Hueso", "bone");
            Mat("gunpowder", "Pólvora", "dust|" + Hex(0x606060));
            Mat("slimeball", "Bola de gelatina", "slime");
            Mat("ender_pearl", "Perla etérea", "pearl|" + Hex(0x1E7A5A), 16).action = "pearl";
            Mat("blaze_rod", "Vara de llama", "rod|" + Hex(0xF0B020));
            Fuel(Mat("blaze_powder", "Polvo de llama", "dust|" + Hex(0xF0B020)), 30);
            Fuel(Get("blaze_rod"), 120);
            Mat("paper", "Papel", "paper");
            Mat("book", "Libro", "book");
            Mat("bowl", "Cuenco", "bowl");
            Mat("sugar", "Azúcar", "dust|" + Hex(0xFFFFFF));
            Mat("clay_ball", "Bola de arcilla", "clay");
            Mat("brick", "Ladrillo", "brick|" + Hex(0x96574A));
            Mat("abyss_brick", "Ladrillo del Abismo", "brick|" + Hex(0x3A1A1E));
            Mat("snowball", "Bola de nieve", "snowball", 16);
            Mat("egg", "Huevo", "egg", 16);
            Mat("wheat", "Trigo", "wheat");
            Mat("glowstone_dust", "Polvo luminoso", "dust|" + Hex(0xFFE08A));
            Mat("prismarine_crystals", "Cristales de prismarina", "shard|" + Hex(0xBFEADF));
            Mat("sky_crystal_shard", "Esquirla celeste", "shard|" + Hex(0x9AF0F5));
            Mat("cloud_fluff", "Esponjosidad de nube", "fluff");
            Mat("spirit_essence", "Esencia espiritual", "essence");
            Mat("dragon_scale", "Escama del dragón", "scale|" + Hex(0x7A3AC8));
            Mat("dragon_heart", "Corazón del dragón", "heart_item");

            // ---- semillas y cultivos ----
            Seed("wheat_seeds", "Semillas de trigo", "seeds|" + Hex(0x8FB03A), "wheat");
            Seed("beetroot_seeds", "Semillas de remolacha", "seeds|" + Hex(0x9A1E3A), "beetroot");
            Seed("tomato_seeds", "Semillas de tomate", "seeds|" + Hex(0xD0B040), "tomato");
            Seed("pumpkin_seeds", "Semillas de calabaza", "seeds|" + Hex(0xE0C070), "pumpkin");
            Seed("melon_seeds", "Semillas de sandía", "seeds|" + Hex(0x303030), "melon");

            // ---- comida ----
            FoodItem("apple", "Manzana", "apple", 4, 2.4f);
            FoodItem("golden_apple", "Manzana dorada", "golden_apple", 4, 9.6f, 64, true);
            FoodItem("bread", "Pan", "bread", 5, 6f);
            FoodItem("beef", "Carne de res cruda", "meat|" + Hex(0xC04040), 3, 1.8f);
            FoodItem("cooked_beef", "Filete", "meat|" + Hex(0x8A4A2A), 8, 12.8f);
            FoodItem("pork", "Cerdo crudo", "meat|" + Hex(0xE08A8A), 3, 1.8f);
            FoodItem("cooked_pork", "Chuleta cocida", "meat|" + Hex(0xB8683A), 8, 12.8f);
            FoodItem("chicken", "Pollo crudo", "meat|" + Hex(0xE8C8A8), 2, 1.2f);
            FoodItem("cooked_chicken", "Pollo cocido", "meat|" + Hex(0xC8883A), 6, 7.2f);
            FoodItem("mutton", "Cordero crudo", "meat|" + Hex(0xC05060), 2, 1.2f);
            FoodItem("cooked_mutton", "Cordero cocido", "meat|" + Hex(0x9A5A3A), 6, 9.6f);
            FoodItem("rabbit", "Conejo crudo", "meat|" + Hex(0xD09080), 3, 1.8f);
            FoodItem("cooked_rabbit", "Conejo cocido", "meat|" + Hex(0xA8683A), 5, 6f);
            FoodItem("cod", "Bacalao crudo", "fish|" + Hex(0xB89A78), 2, 0.4f);
            FoodItem("cooked_cod", "Bacalao cocido", "fish|" + Hex(0x8A5A30), 5, 6f);
            FoodItem("salmon", "Salmón crudo", "fish|" + Hex(0xD06A5A), 2, 0.4f);
            FoodItem("cooked_salmon", "Salmón cocido", "fish|" + Hex(0xB06A3A), 6, 9.6f);
            var carrot = FoodItem("carrot", "Zanahoria", "carrot", 3, 3.6f); carrot.crop = Block.ByKey["crop_carrot"];
            var potato = FoodItem("potato", "Papa", "potato", 1, 0.6f); potato.crop = Block.ByKey["crop_potato"];
            FoodItem("baked_potato", "Papa asada", "potato_baked", 5, 6f);
            var beet = FoodItem("beetroot", "Remolacha", "beet", 1, 1.2f);
            FoodItem("tomato", "Tomate", "tomato", 2, 2.4f);
            FoodItem("melon_slice", "Rodaja de sandía", "melon_slice", 2, 1.2f);
            FoodItem("pumpkin_pie", "Pastel de calabaza", "pie", 8, 4.8f);
            FoodItem("cookie", "Galleta", "cookie", 2, 0.4f);
            FoodItem("mushroom_stew", "Estofado de hongos", "stew|" + Hex(0xA0724A), 6, 7.2f, 1);
            FoodItem("tomato_soup", "Sopa de tomate", "stew|" + Hex(0xD0382A), 7, 8f, 1);
            FoodItem("salad", "Ensalada", "stew|" + Hex(0x6FBF3A), 8, 9f, 1);
            FoodItem("sandwich", "Sándwich", "sandwich", 10, 12f);
            FoodItem("golden_carrot", "Zanahoria dorada", "carrot_gold", 6, 14.4f);
            FoodItem("rotten_flesh", "Carne podrida", "meat|" + Hex(0x7A8A4A), 4, 0.8f);
            FoodItem("spider_eye", "Ojo de araña", "eye|" + Hex(0x8A2A3A), 2, 3.2f);
            FoodItem("milk_bucket", "Cubo de leche", "bucket|" + Hex(0xF4F4F4), 3, 2f, 1, true).action = "milk";

            // ---- tintes ----
            for (int i = 0; i < 16; i++)
            {
                var d = Mat("dye_" + Dyes.Keys[i], "Tinte " + Dyes.Names[i], "dust|" + Hex(Dyes.Colors[i]));
                d.category = "Materiales";
            }

            // ---- herramientas ----
            string[] toolKeys = { "pickaxe", "axe", "shovel", "hoe", "sword" };
            string[] toolNames = { "Pico", "Hacha", "Pala", "Azada", "Espada" };
            ToolKind[] toolKinds = { ToolKind.Pickaxe, ToolKind.Axe, ToolKind.Shovel, ToolKind.Hoe, ToolKind.Sword };
            float[] baseDmg = { 2f, 3.5f, 2f, 1f, 4f };
            for (int t = 0; t < Tiers.All.Length; t++)
            {
                var ti = Tiers.All[t];
                if (ti.durability <= 0 || ti.key == "leather") continue;
                for (int k = 0; k < 5; k++)
                {
                    var it = new Item
                    {
                        key = ti.key + "_" + toolKeys[k], name = toolNames[k] + " " + ti.name, kind = ItemKind.Tool, maxStack = 1,
                        tool = toolKinds[k], tier = ti.level, speed = ti.speed, damage = baseDmg[k] + (k == 3 ? ti.bonus * 0.5f : ti.bonus),
                        durability = ti.durability, iconSpec = toolKeys[k] + "|" + ti.key, category = "Herramientas"
                    };
                    if (ti.key == "wood") it.fuel = 10;
                    Add(it);
                }
            }
            var shears = Special("shears", "Tijeras", "shears", "shears"); shears.kind = ItemKind.Tool; shears.tool = ToolKind.Shears; shears.speed = 6f; shears.durability = 238; shears.tier = 0;
            var bow = Special("bow", "Arco", "bow", "bow"); bow.durability = 384; bow.kind = ItemKind.Tool;
            Mat("arrow", "Flecha", "arrow");
            var fs = Special("flint_and_steel", "Mechero", "flint_steel", "flint"); fs.durability = 64; fs.kind = ItemKind.Tool;
            Special("bucket", "Cubo", "bucket|" + Hex(0), "bucket");
            Special("water_bucket", "Cubo de agua", "bucket|" + Hex(0x3F76E4), "water_bucket");
            Special("lava_bucket", "Cubo de lava", "bucket|" + Hex(0xFF7A1A), "lava_bucket").fuel = 1000;
            Special("eye_of_end", "Ojo del Final", "eye_end", "eye", 64);
            Special("bone_meal", "Polvo de hueso", "dust|" + Hex(0xF0F0E0), "bonemeal", 64);

            // ---- armadura ----
            string[] armKeys = { "helmet", "chestplate", "leggings", "boots" };
            string[] armNames = { "Casco", "Peto", "Pantalones", "Botas" };
            int[] baseDur = { 11, 16, 15, 13 };
            for (int t = 0; t < Tiers.All.Length; t++)
            {
                var ti = Tiers.All[t];
                if (ti.defense == null) continue;
                for (int a = 0; a < 4; a++)
                {
                    Add(new Item
                    {
                        key = ti.key + "_" + armKeys[a], name = armNames[a] + " " + ti.name, kind = ItemKind.Armor, maxStack = 1,
                        armorSlot = a, defense = ti.defense[a], durability = (int)(baseDur[a] * ti.armorDur),
                        iconSpec = armKeys[a] + "|" + ti.key, category = "Armadura"
                    });
                }
            }

            // ---- combustible de bloques ----
            for (int i = 0; i < Woods.All.Length; i++)
            {
                B.Log[i].item.fuel = 15; B.Planks[i].item.fuel = 15;
                B.Sapling[i].item.fuel = 5; B.WoodStairs[i].item.fuel = 15; B.WoodSlab[i].item.fuel = 7.5f;
                B.Door[i].item.fuel = 10;
            }
            Get("coal_block").fuel = 800; Get("crafting_table").fuel = 15; Get("chest").fuel = 15; Get("bookshelf").fuel = 15;
            Get("bed").fuel = 10;
            for (int i = 0; i < 16; i++) Get("wool_" + Dyes.Keys[i]).fuel = 5;
        }

        static string CategoryOf(Block b)
        {
            if (b.shape == Shape.Cross || b.shape == Shape.Crop || b.tint == Tint.Grass || b.tint == Tint.Foliage) return "Naturaleza";
            if (B.IsLog(b) || B.IsLeaves(b)) return "Naturaleza";
            if (b == B.Dirt || b == B.Grass || b == B.Sand || b == B.Gravel || b == B.Cactus || b == B.Pumpkin || b == B.Melon || b == B.Hay) return "Naturaleza";
            if (b.hasEntity || b.interactive || b == B.Torch || b == B.Tnt || b.shape == Shape.Door || b.light >= 14) return "Funcional";
            if (b.key.StartsWith("ore_") || b.key.EndsWith("_ore") || b.key.StartsWith("block_") || b.key.EndsWith("_block")) return "Menas y gemas";
            return "Bloques";
        }
    }
}
