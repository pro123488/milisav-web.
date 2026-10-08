using System.Collections.Generic;

namespace MundoBloques
{
    /// <summary>Registro estatico de todos los bloques del juego. El orden de declaracion fija los ids.</summary>
    public static class B
    {
        // --- Terreno ---
        public static Block Air, Bedrock, Stone, Cobble, MossyCobble, Dirt, Grass, Podzol, Mycelium, CoarseDirt,
            Farmland, FarmlandWet, Path, Sand, RedSand, Gravel, Clay, Sandstone, RedSandstone, SnowBlock, SnowLayer,
            Ice, PackedIce, Water, Lava, Obsidian, Glowstone, Granite, Diorite, Andesite, Deepslate, CobbledDeepslate,
            Tuff, Calcite, Basalt, MossBlock, Bricks, StoneBricks, MossyStoneBricks, CrackedStoneBricks, SmoothStone,
            QuartzBlock, Prismarine, PrismarineBricks, SeaLantern, EndStone, EndStoneBricks, AbyssRock, AbyssBricks,
            SoulSand, Magma, Cloud, SkyCrystal, SkyBricks, SkyStone, SkyGrass;
        // --- Menas ---
        public static Block CoalOre, DeepCoalOre, CopperOre, DeepCopperOre, IronOre, DeepIronOre, GoldOre, DeepGoldOre,
            LapisOre, DeepLapisOre, DiamondOre, DeepDiamondOre, EmeraldOre, DeepEmeraldOre, RubyOre, DeepRubyOre,
            SapphireOre, DeepSapphireOre, AmethystOre, DeepAmethystOre, QuartzOre, AbyssGoldOre, AbismitaOre;
        public static Block AmethystBlock, AmethystCluster;
        // --- Maderas (indices en Woods.All) ---
        public static Block[] Log = new Block[Woods.All.Length], Planks = new Block[Woods.All.Length],
            Leaves = new Block[Woods.All.Length], Sapling = new Block[Woods.All.Length],
            WoodStairs = new Block[Woods.All.Length], WoodSlab = new Block[Woods.All.Length], Door = new Block[Woods.All.Length];
        // --- Tintes ---
        public static Block[] Wool = new Block[16], Concrete = new Block[16], Terracotta = new Block[16], StainedGlass = new Block[16];
        // --- Funcionales ---
        public static Block CraftingTable, Furnace, FurnaceOn, Chest, Stonecutter, Bookshelf, Bed, Torch, Tnt, Pumpkin,
            JackOLantern, Melon, Hay, Cactus, Glass, Spawner, Portal, EndPortal, EndFrame, DragonEgg;
        public static Block[] Crops = new Block[7];
        // --- Plantas ---
        public static Block TallGrass, Fern, DeadBush, SugarCane, Kelp, Seagrass, MushroomRed, MushroomBrown,
            MushroomStem, RedMushroomBlock, BrownMushroomBlock;
        public static Block[] Flowers;
        public static Block[] Corals;
        public static Block[] GemLamps = new Block[4];

        public static bool Ready;

        // Nombres de los 7 cultivos: trigo, zanahoria, papa, remolacha, tomate, calabaza, sandia
        public static readonly string[] CropKeys = { "wheat", "carrot", "potato", "beetroot", "tomato", "pumpkin", "melon" };

        static Block Def(string key, string name)
        {
            var b = new Block(key, name);
            b.id = (ushort)Block.All.Count;
            Block.All.Add(b);
            Block.ByKey[key] = b;
            return b;
        }

        static Block Rock(string key, string name, string tex, float hard = 1.5f, int lvl = 0)
        {
            return Def(key, name).Tex(tex).Hard(hard).Use(ToolKind.Pickaxe, lvl, true).Sound(Snd.Stone);
        }

        static Block Soil(string key, string name, string tex, float hard, Snd s = Snd.Dirt)
        {
            return Def(key, name).Tex(tex).Hard(hard).Use(ToolKind.Shovel).Sound(s);
        }

        static Block Stairs(Block b, string name)
        {
            var s = Def(b.key + "_stairs", name).CopyTex(b).Hard(b.hardness).Use(b.tool, b.level, b.needsTool).Sound(b.sound).Shaped(Shape.Stairs);
            s.opaque = false; s.baseBlock = b; return s;
        }

        static Block Slab(Block b, string name)
        {
            var s = Def(b.key + "_slab", name).CopyTex(b).Hard(b.hardness).Use(b.tool, b.level, b.needsTool).Sound(b.sound).Shaped(Shape.Slab);
            s.opaque = false; s.slabFull = b; s.baseBlock = b; b.slabHalf = s; return s;
        }

        static Block[] Ore(string key, string name, string deepName, float hard, int lvl, string dropKey, int min, int max, int light = 0)
        {
            var a = Rock(key + "_ore", name, "ore_" + key, hard, lvl).Drop(dropKey, min, max);
            var d = Rock("deep_" + key + "_ore", deepName, "deep_ore_" + key, hard * 1.4f, lvl).Drop(dropKey, min, max);
            a.light = light; d.light = light;
            return new[] { a, d };
        }

        static Block Plant(string key, string name, string tex)
        {
            var b = Def(key, name).Tex(tex).Shaped(Shape.Cross).NoCollide().Cut().Hard(0f).Sound(Snd.Plant).Needs(Support.Soil);
            return b;
        }

        static B()
        {
            // ====== Aire y terreno basico ======
            Air = Def("air", "Aire").NoCollide().Clear().Repl().NoItem().NoDrop().Hard(0);
            Air.shape = Shape.Cube;
            Bedrock = Rock("bedrock", "Lecho de roca", "bedrock").Unbreakable();
            Stone = Rock("stone", "Piedra", "stone", 1.5f).Drop("cobblestone");
            Cobble = Rock("cobblestone", "Roca", "cobblestone", 2f);
            MossyCobble = Rock("mossy_cobblestone", "Roca musgosa", "mossy_cobblestone", 2f);
            Dirt = Soil("dirt", "Tierra", "dirt", 0.5f);
            Grass = Soil("grass_block", "Bloque de hierba", "dirt", 0.6f, Snd.Grass).Drop("dirt").Ticks();
            Grass.Tex("grass_top", "grass_side", "dirt"); Grass.Tinted(Tint.Grass, 4);
            Podzol = Soil("podzol", "Podzol", "dirt", 0.5f).Drop("dirt"); Podzol.Tex("podzol_top", "podzol_side", "dirt");
            Mycelium = Soil("mycelium", "Micelio", "dirt", 0.6f).Drop("dirt"); Mycelium.Tex("mycelium_top", "mycelium_side", "dirt");
            CoarseDirt = Soil("coarse_dirt", "Tierra áspera", "coarse_dirt", 0.5f);
            Farmland = Soil("farmland", "Tierra de cultivo", "dirt", 0.6f).Drop("dirt").Dims(0.9375f).Ticks();
            Farmland.Tex("farmland_dry", "dirt", "dirt");
            FarmlandWet = Soil("farmland_wet", "Tierra de cultivo húmeda", "dirt", 0.6f).Drop("dirt").Dims(0.9375f).Ticks();
            FarmlandWet.Tex("farmland_wet", "dirt", "dirt");
            Farmland.hasItem = false; FarmlandWet.hasItem = false;
            Path = Soil("dirt_path", "Camino de tierra", "dirt", 0.65f).Drop("dirt").Dims(0.9375f);
            Path.Tex("dirt_path_top", "dirt_path_side", "dirt");
            Sand = Soil("sand", "Arena", "sand", 0.5f, Snd.Sand).Falls();
            RedSand = Soil("red_sand", "Arena roja", "red_sand", 0.5f, Snd.Sand).Falls();
            Gravel = Soil("gravel", "Grava", "gravel", 0.6f, Snd.Gravel).Falls().Drop("gravel").Drop("flint", 1, 1, 0.1f);
            Clay = Soil("clay", "Arcilla", "clay", 0.6f).Drop("clay_ball", 4, 4);
            Sandstone = Rock("sandstone", "Arenisca", "sandstone_side", 0.8f); Sandstone.Tex("sandstone_top", "sandstone_side", "sandstone_bottom");
            RedSandstone = Rock("red_sandstone", "Arenisca roja", "red_sandstone_side", 0.8f); RedSandstone.Tex("red_sandstone_top", "red_sandstone_side", "red_sandstone_bottom");
            SnowBlock = Soil("snow_block", "Bloque de nieve", "snow", 0.2f, Snd.Snow).Drop("snowball", 4, 4);
            SnowLayer = Soil("snow_layer", "Capa de nieve", "snow", 0.1f, Snd.Snow).Dims(0.125f).NoCollide().Repl().Drop("snowball", 1, 1);
            SnowLayer.opaque = false; SnowLayer.hasItem = false; SnowLayer.support = Support.Solid;
            Ice = Def("ice", "Hielo").Tex("ice").Hard(0.5f).Use(ToolKind.Pickaxe).Sound(Snd.Glass).Trans(); Ice.drops = null;
            PackedIce = Def("packed_ice", "Hielo compacto").Tex("packed_ice").Hard(0.8f).Use(ToolKind.Pickaxe).Sound(Snd.Glass);
            Water = Def("water", "Agua").Tex("water").Tinted(Tint.Water).Sound(Snd.Water).NoCollide().Trans().Repl().NoItem().NoDrop().Hard(-1f);
            Water.shape = Shape.Fluid; Water.fluid = true;
            Lava = Def("lava", "Lava").Tex("lava").Lit(15).NoCollide().Clear().Repl().NoItem().NoDrop().Hard(-1f).Sound(Snd.Water);
            Lava.shape = Shape.Fluid; Lava.fluid = true; Lava.isLava = true; Lava.damagesOnTouch = true;
            Obsidian = Rock("obsidian", "Obsidiana", "obsidian", 50f, 3);
            Glowstone = Def("glowstone", "Piedra luminosa").Tex("glowstone").Hard(0.3f).Lit(15).Sound(Snd.Glass).Drop("glowstone_dust", 2, 4);
            Granite = Rock("granite", "Granito", "granite");
            Diorite = Rock("diorite", "Diorita", "diorite");
            Andesite = Rock("andesite", "Andesita", "andesite");
            Rock("polished_granite", "Granito pulido", "polished_granite");
            Rock("polished_diorite", "Diorita pulida", "polished_diorite");
            Rock("polished_andesite", "Andesita pulida", "polished_andesite");
            Deepslate = Rock("deepslate", "Pizarra", "deepslate_side", 3f).Drop("cobbled_deepslate"); Deepslate.Tex("deepslate_top", "deepslate_side", "deepslate_top");
            CobbledDeepslate = Rock("cobbled_deepslate", "Pizarra adoquinada", "cobbled_deepslate", 3.5f);
            Rock("polished_deepslate", "Pizarra pulida", "polished_deepslate", 3.5f);
            Rock("deepslate_bricks", "Ladrillos de pizarra", "deepslate_bricks", 3.5f);
            Rock("deepslate_tiles", "Baldosas de pizarra", "deepslate_tiles", 3.5f);
            Tuff = Rock("tuff", "Toba", "tuff", 1.5f);
            Calcite = Rock("calcite", "Calcita", "calcite", 0.75f);
            Basalt = Rock("basalt", "Basalto", "basalt_side", 1.25f); Basalt.Tex("basalt_top", "basalt_side", "basalt_top");
            Rock("smooth_basalt", "Basalto liso", "smooth_basalt", 1.25f);
            MossBlock = Def("moss_block", "Bloque de musgo").Tex("moss_block").Hard(0.1f).Sound(Snd.Plant).Use(ToolKind.Hoe);
            Bricks = Rock("bricks", "Ladrillos", "bricks", 2f);
            StoneBricks = Rock("stone_bricks", "Ladrillos de piedra", "stone_bricks");
            MossyStoneBricks = Rock("mossy_stone_bricks", "Ladrillos de piedra musgosos", "mossy_stone_bricks");
            CrackedStoneBricks = Rock("cracked_stone_bricks", "Ladrillos de piedra agrietados", "cracked_stone_bricks");
            Rock("chiseled_stone_bricks", "Ladrillos de piedra cincelados", "chiseled_stone_bricks");
            SmoothStone = Rock("smooth_stone", "Piedra lisa", "smooth_stone", 2f);
            QuartzBlock = Rock("quartz_block", "Bloque de cuarzo", "quartz_side", 0.8f); QuartzBlock.Tex("quartz_top", "quartz_side", "quartz_top");
            Rock("quartz_pillar", "Pilar de cuarzo", "quartz_pillar_side", 0.8f).Tex("quartz_pillar_top", "quartz_pillar_side", "quartz_pillar_top");
            Rock("quartz_bricks", "Ladrillos de cuarzo", "quartz_bricks", 0.8f);
            Prismarine = Rock("prismarine", "Prismarina", "prismarine", 1.5f);
            PrismarineBricks = Rock("prismarine_bricks", "Ladrillos de prismarina", "prismarine_bricks", 1.5f);
            Rock("dark_prismarine", "Prismarina oscura", "dark_prismarine", 1.5f);
            SeaLantern = Def("sea_lantern", "Linterna marina").Tex("sea_lantern").Hard(0.3f).Lit(15).Sound(Snd.Glass).Drop("prismarine_crystals", 2, 3);
            EndStone = Rock("end_stone", "Piedra del Final", "end_stone", 3f);
            EndStoneBricks = Rock("end_stone_bricks", "Ladrillos del Final", "end_stone_bricks", 3f);
            AbyssRock = Rock("abyss_rock", "Roca del Abismo", "abyss_rock", 0.8f);
            AbyssBricks = Rock("abyss_bricks", "Ladrillos del Abismo", "abyss_bricks", 2f);
            SoulSand = Soil("soul_sand", "Arena de almas", "soul_sand", 0.5f, Snd.Sand);
            Magma = Rock("magma_block", "Bloque de magma", "magma", 0.5f).Lit(3); Magma.damagesOnTouch = true;
            Cloud = Def("cloud", "Nube sólida").Tex("cloud").Hard(0.3f).Sound(Snd.Cloth).Drop("cloud_fluff", 1, 2);
            SkyCrystal = Def("sky_crystal", "Cristal celeste").Tex("sky_crystal").Hard(0.8f).Lit(12).Sound(Snd.Glass).Use(ToolKind.Pickaxe).Drop("sky_crystal_shard", 1, 3);
            SkyBricks = Rock("sky_bricks", "Ladrillos celestes", "sky_bricks", 2f);
            SkyStone = Rock("sky_stone", "Piedra celeste", "sky_stone", 1.5f);
            SkyGrass = Soil("sky_grass", "Hierba celestial", "dirt", 0.6f, Snd.Grass).Drop("dirt"); SkyGrass.Tex("sky_grass_top", "sky_grass_side", "dirt");

            // ====== Menas ======
            var o = Ore("coal", "Mena de carbón", "Mena de carbón de pizarra", 3f, 0, "coal", 1, 1); CoalOre = o[0]; DeepCoalOre = o[1];
            o = Ore("copper", "Mena de cobre", "Mena de cobre de pizarra", 3f, 1, "raw_copper", 1, 3); CopperOre = o[0]; DeepCopperOre = o[1];
            o = Ore("iron", "Mena de hierro", "Mena de hierro de pizarra", 3f, 1, "raw_iron", 1, 1); IronOre = o[0]; DeepIronOre = o[1];
            o = Ore("gold", "Mena de oro", "Mena de oro de pizarra", 3f, 2, "raw_gold", 1, 1); GoldOre = o[0]; DeepGoldOre = o[1];
            o = Ore("lapis", "Mena de lapislázuli", "Mena de lapislázuli de pizarra", 3f, 1, "lapis", 4, 8); LapisOre = o[0]; DeepLapisOre = o[1];
            o = Ore("diamond", "Mena de diamante", "Mena de diamante de pizarra", 3f, 2, "diamond", 1, 1); DiamondOre = o[0]; DeepDiamondOre = o[1];
            o = Ore("emerald", "Mena de esmeralda", "Mena de esmeralda de pizarra", 3f, 2, "emerald", 1, 1); EmeraldOre = o[0]; DeepEmeraldOre = o[1];
            o = Ore("ruby", "Mena de rubí", "Mena de rubí de pizarra", 3.5f, 2, "ruby", 1, 2); RubyOre = o[0]; DeepRubyOre = o[1];
            o = Ore("sapphire", "Mena de zafiro", "Mena de zafiro de pizarra", 3.5f, 2, "sapphire", 1, 2); SapphireOre = o[0]; DeepSapphireOre = o[1];
            o = Ore("amethyst", "Mena de amatista", "Mena de amatista de pizarra", 3f, 1, "amethyst_shard", 1, 3); AmethystOre = o[0]; DeepAmethystOre = o[1];
            QuartzOre = Rock("quartz_ore", "Mena de cuarzo", "ore_quartz", 3f).Drop("quartz", 1, 2);
            AbyssGoldOre = Rock("abyss_gold_ore", "Mena de oro del Abismo", "ore_abyss_gold", 3f, 0).Drop("raw_gold", 1, 3);
            AbismitaOre = Rock("abismita_ore", "Abismita antigua", "ore_abismita", 30f, 3).Drop("abismita_scrap", 1, 1);
            AmethystBlock = Rock("amethyst_block", "Bloque de amatista", "block_amethyst", 1.5f, 1);
            AmethystCluster = Def("amethyst_cluster", "Cúmulo de amatista").Tex("amethyst_cluster").Shaped(Shape.Cross).NoCollide().Cut().Lit(6)
                .Hard(1.5f).Use(ToolKind.Pickaxe, 0, false).Sound(Snd.Glass).Drop("amethyst_shard", 2, 4);

            // Bloques de almacenamiento
            Rock("coal_block", "Bloque de carbón", "block_coal", 5f);
            Rock("copper_block", "Bloque de cobre", "block_copper", 3f, 1);
            Rock("iron_block", "Bloque de hierro", "block_iron", 5f, 1).Sound(Snd.Metal);
            Rock("gold_block", "Bloque de oro", "block_gold", 3f, 2).Sound(Snd.Metal);
            Rock("lapis_block", "Bloque de lapislázuli", "block_lapis", 3f, 1);
            Rock("diamond_block", "Bloque de diamante", "block_diamond", 5f, 2).Sound(Snd.Metal);
            Rock("emerald_block", "Bloque de esmeralda", "block_emerald", 5f, 2).Sound(Snd.Metal);
            Rock("ruby_block", "Bloque de rubí", "block_ruby", 5f, 2).Sound(Snd.Metal);
            Rock("sapphire_block", "Bloque de zafiro", "block_sapphire", 5f, 2).Sound(Snd.Metal);
            Rock("abismita_block", "Bloque de abismita", "block_abismita", 50f, 3).Sound(Snd.Metal);
            Rock("raw_iron_block", "Bloque de hierro bruto", "block_raw_iron", 5f, 1);
            Rock("raw_copper_block", "Bloque de cobre bruto", "block_raw_copper", 5f, 1);
            Rock("raw_gold_block", "Bloque de oro bruto", "block_raw_gold", 5f, 2);
            string[] gems = { "ruby", "sapphire", "emerald", "amethyst" };
            string[] gemNames = { "rubí", "zafiro", "esmeralda", "amatista" };
            for (int i = 0; i < 4; i++)
                GemLamps[i] = Def("lamp_" + gems[i], "Lámpara de " + gemNames[i]).Tex("lamp_" + gems[i]).Hard(0.5f).Lit(15).Sound(Snd.Glass);

            // ====== Maderas ======
            for (int i = 0; i < Woods.All.Length; i++)
            {
                var w = Woods.All[i];
                var log = Def(w.key + "_log", "Tronco de " + w.name).Hard(2f).Use(ToolKind.Axe).Sound(Snd.Wood);
                log.Tex("log_" + w.key + "_top", "log_" + w.key + "_side", "log_" + w.key + "_top");
                Log[i] = log;
                Planks[i] = Def(w.key + "_planks", "Tablones de " + w.name).Tex("planks_" + w.key).Hard(2f).Use(ToolKind.Axe).Sound(Snd.Wood);
                var lv = Def(w.key + "_leaves", "Hojas de " + w.name).Tex("leaves_" + w.key).Hard(0.2f).Use(ToolKind.Shears).Sound(Snd.Plant).Cut().Ticks();
                lv.Tinted(w.leafTinted ? Tint.Foliage : Tint.None); lv.light = w.leafLight;
                lv.Drop(w.key + "_leaves", 1, 1, 1f, ToolKind.Shears).Drop(w.key + "_sapling", 1, 1, 0.06f).Drop("stick", 1, 2, 0.04f);
                if (i == Woods.Oak) lv.Drop("apple", 1, 1, 0.01f);
                Leaves[i] = lv;
                var sp = Plant(w.key + "_sapling", "Brote de " + w.name, "sapling_" + w.key).Ticks();
                Sapling[i] = sp;
                WoodStairs[i] = Stairs(Planks[i], "Escalera de " + w.name);
                WoodSlab[i] = Slab(Planks[i], "Losa de " + w.name);
                var dr = Def(w.key + "_door", "Puerta de " + w.name).Shaped(Shape.Door).Hard(3f).Use(ToolKind.Axe).Sound(Snd.Wood).Interact();
                dr.tex[0] = TileAtlas.Index("door_" + w.key + "_bottom"); dr.tex[1] = TileAtlas.Index("door_" + w.key + "_top");
                dr.opaque = false; dr.cutout = true;
                Door[i] = dr;
            }

            // ====== Escaleras y losas de piedra ======
            Block[] stairBase = { Stone, Cobble, MossyCobble, StoneBricks, Bricks, Sandstone, RedSandstone, QuartzBlock, Andesite, Granite,
                Diorite, CobbledDeepslate, Prismarine, EndStoneBricks, AbyssBricks, SkyBricks, SmoothStone, MossyStoneBricks };
            foreach (var sb in stairBase)
            {
                string lower = sb.name.Substring(0, 1).ToLowerInvariant() + sb.name.Substring(1);
                Stairs(sb, "Escalera de " + lower);
                Slab(sb, "Losa de " + lower);
            }

            // ====== Tintes (lana, concreto, terracota, cristal) ======
            for (int i = 0; i < 16; i++)
            {
                string d = Dyes.Keys[i], n = Dyes.Names[i];
                Wool[i] = Def("wool_" + d, "Lana " + n).Tex("wool_" + d).Hard(0.8f).Sound(Snd.Cloth);
                Concrete[i] = Rock("concrete_" + d, "Concreto " + n, "concrete_" + d, 1.8f);
                Terracotta[i] = Rock("terracotta_" + d, "Terracota " + n, "terracotta_" + d, 1.25f);
                StainedGlass[i] = Def("glass_" + d, "Cristal " + n).Tex("glass_" + d).Hard(0.3f).Sound(Snd.Glass).Trans();
            }
            Rock("terracotta", "Terracota", "terracotta", 1.25f);

            // ====== Funcionales ======
            Glass = Def("glass", "Cristal").Tex("glass").Hard(0.3f).Sound(Snd.Glass).Cut(); Glass.drops = null;
            CraftingTable = Def("crafting_table", "Mesa de crafteo").Tex("crafting_top", "crafting_side", "planks_oak").Front("crafting_front")
                .Hard(2.5f).Use(ToolKind.Axe).Sound(Snd.Wood).Interact();
            CraftingTable.oriented = false;
            Furnace = Def("furnace", "Horno").Tex("furnace_top", "furnace_side", "furnace_top").Front("furnace_front").Hard(3.5f)
                .Use(ToolKind.Pickaxe, 0, true).Entity();
            FurnaceOn = Def("furnace_on", "Horno encendido").Tex("furnace_top", "furnace_side", "furnace_top").Front("furnace_front_on").Hard(3.5f)
                .Use(ToolKind.Pickaxe, 0, true).Entity().Lit(13).NoItem().Drop("furnace");
            Chest = Def("chest", "Cofre").Tex("chest_top", "chest_side", "chest_top").Front("chest_front").Hard(2.5f).Use(ToolKind.Axe).Sound(Snd.Wood).Entity();
            Stonecutter = Def("stonecutter", "Cortapiedras").Tex("stonecutter_top", "stonecutter_side", "stone").Hard(3.5f)
                .Use(ToolKind.Pickaxe, 0, true).Dims(0.5625f).Interact();
            Bookshelf = Def("bookshelf", "Estantería").Tex("planks_oak", "bookshelf", "planks_oak").Hard(1.5f).Use(ToolKind.Axe).Sound(Snd.Wood).Drop("book", 3, 3);
            Bed = Def("bed", "Cama").Tex("bed_top", "bed_side", "planks_oak").Dims(0.5625f).Hard(0.2f).Sound(Snd.Cloth).Interact();
            Bed.oriented = false;
            Torch = Def("torch", "Antorcha").Tex("torch").Shaped(Shape.Torch).NoCollide().Cut().Lit(14).Hard(0f).Sound(Snd.Wood).Needs(Support.Solid);
            Tnt = Def("tnt", "TNT").Tex("tnt_top", "tnt_side", "tnt_bottom").Hard(0f).Sound(Snd.Grass).Interact();
            Pumpkin = Def("pumpkin", "Calabaza").Tex("pumpkin_top", "pumpkin_side", "pumpkin_top").Hard(1f).Use(ToolKind.Axe).Sound(Snd.Wood);
            JackOLantern = Def("jack_o_lantern", "Calabaza tallada").Tex("pumpkin_top", "pumpkin_side", "pumpkin_top").Front("jack_face").Hard(1f).Use(ToolKind.Axe).Lit(15).Sound(Snd.Wood);
            Melon = Def("melon", "Sandía").Tex("melon_top", "melon_side", "melon_top").Hard(1f).Use(ToolKind.Axe).Sound(Snd.Wood).Drop("melon_slice", 3, 7);
            Hay = Def("hay_block", "Fardo de heno").Tex("hay_top", "hay_side", "hay_top").Hard(0.5f).Sound(Snd.Grass);
            Cactus = Def("cactus", "Cactus").Tex("cactus_top", "cactus_side", "cactus_top").Dims(1f, 0.0625f).Hard(0.4f).Sound(Snd.Plant).Needs(Support.Sand).Ticks();
            Cactus.damagesOnTouch = true;
            Spawner = Def("spawner", "Generador de monstruos").Tex("spawner").Hard(5f).Use(ToolKind.Pickaxe, 0, true).NoItem().NoDrop().Ticks();
            Spawner.opaque = false; Spawner.cutout = true;
            Portal = Def("portal", "Portal del Abismo").Tex("portal").Shaped(Shape.Portal).NoCollide().Trans().Lit(11).NoItem().NoDrop().Hard(-1f);
            EndPortal = Def("end_portal", "Portal del Final").Tex("end_portal").Dims(0.75f).NoCollide().Lit(15).NoItem().NoDrop().Hard(-1f);
            EndPortal.opaque = false;
            EndFrame = Def("end_portal_frame", "Marco del portal del Final").Tex("end_frame_top", "end_frame_side", "end_stone").Dims(0.8125f)
                .Unbreakable().Interact();
            DragonEgg = Def("dragon_egg", "Huevo del dragón").Tex("dragon_egg").Dims(1f, 0.0625f).Hard(3f).Lit(1);
            DragonEgg.opaque = false;

            // ====== Cultivos (meta = edad 0..7) ======
            string[] cropNames = { "Trigo", "Zanahorias", "Papas", "Remolachas", "Tomates", "Calabacera", "Sandiera" };
            for (int i = 0; i < 7; i++)
            {
                var c = Def("crop_" + CropKeys[i], cropNames[i]).Shaped(Shape.Crop).NoCollide().Cut().Hard(0f).Sound(Snd.Plant).NoItem().Ticks();
                for (int s = 0; s < 4; s++) c.tex[s] = TileAtlas.Index("crop_" + CropKeys[i] + "_" + s);
                c.support = Support.Soil;
                Crops[i] = c;
            }

            // ====== Plantas ======
            TallGrass = Plant("tall_grass", "Hierba alta", "tall_grass").Tinted(Tint.Grass).Repl();
            TallGrass.Drop("wheat_seeds", 1, 1, 0.12f).Drop("tall_grass", 1, 1, 1f, ToolKind.Shears);
            Fern = Plant("fern", "Helecho", "fern").Tinted(Tint.Grass).Repl();
            Fern.Drop("fern", 1, 1, 1f, ToolKind.Shears).Drop("stick", 1, 1, 0.1f);
            DeadBush = Plant("dead_bush", "Arbusto seco", "dead_bush").Repl().Needs(Support.Sand); DeadBush.Drop("stick", 0, 2);
            string[] fk = { "dandelion", "poppy", "blue_orchid", "allium", "tulip_red", "tulip_orange", "tulip_white", "tulip_pink", "cornflower", "lily_valley", "sunflower" };
            string[] fn = { "Diente de león", "Amapola", "Orquídea azul", "Allium", "Tulipán rojo", "Tulipán naranja", "Tulipán blanco", "Tulipán rosa", "Aciano", "Lirio del valle", "Girasol" };
            Flowers = new Block[fk.Length];
            for (int i = 0; i < fk.Length; i++) Flowers[i] = Plant(fk[i], fn[i], fk[i]);
            SugarCane = Plant("sugar_cane", "Caña de azúcar", "sugar_cane").Needs(Support.Soil); SugarCane.Ticks();
            SugarCane.support = Support.Sand;
            Kelp = Plant("kelp", "Alga", "kelp").Needs(Support.Water); Kelp.Drop("kelp", 1, 1);
            Seagrass = Plant("seagrass", "Hierba marina", "seagrass").Needs(Support.Water).Tinted(Tint.Grass); Seagrass.Drop("seagrass", 1, 1, 1f, ToolKind.Shears);
            MushroomRed = Plant("mushroom_red", "Hongo rojo", "mushroom_red").Lit(1); MushroomRed.support = Support.None;
            MushroomBrown = Plant("mushroom_brown", "Hongo marrón", "mushroom_brown").Lit(1); MushroomBrown.support = Support.None;
            MushroomStem = Def("mushroom_stem", "Tallo de hongo").Tex("mushroom_stem").Hard(0.2f).Use(ToolKind.Axe).Sound(Snd.Wood);
            RedMushroomBlock = Def("red_mushroom_block", "Hongo rojo gigante").Tex("mushroom_red_block").Hard(0.2f).Use(ToolKind.Axe).Sound(Snd.Wood).Drop("mushroom_red", 0, 2);
            BrownMushroomBlock = Def("brown_mushroom_block", "Hongo marrón gigante").Tex("mushroom_brown_block").Hard(0.2f).Use(ToolKind.Axe).Sound(Snd.Wood).Drop("mushroom_brown", 0, 2);
            string[] ck = { "tube", "brain", "bubble", "fire", "horn" };
            string[] cn = { "Coral de tubo", "Coral cerebro", "Coral burbuja", "Coral de fuego", "Coral de cuerno" };
            Corals = new Block[5];
            for (int i = 0; i < 5; i++) Corals[i] = Rock("coral_" + ck[i], cn[i], "coral_" + ck[i], 1.5f);

            Ready = true;
        }

        /// <summary>Fuerza la inicializacion del registro.</summary>
        public static void Init() { var _ = Air; }

        public static Block Get(string key)
        {
            Block b;
            return Block.ByKey.TryGetValue(key, out b) ? b : null;
        }

        public static bool IsWaterlike(Block b) { return b == Water || b == Kelp || b == Seagrass; }
        public static bool IsLog(Block b)
        {
            for (int i = 0; i < Log.Length; i++) if (Log[i] == b) return true;
            return false;
        }
        public static bool IsLeaves(Block b)
        {
            for (int i = 0; i < Leaves.Length; i++) if (Leaves[i] == b) return true;
            return false;
        }
        public static bool IsFarmland(Block b) { return b == Farmland || b == FarmlandWet; }
        public static bool IsSoil(Block b)
        {
            return b == Dirt || b == Grass || b == Podzol || b == Mycelium || b == CoarseDirt || b == Farmland || b == FarmlandWet || b == MossBlock || b == Path;
        }
    }
}
