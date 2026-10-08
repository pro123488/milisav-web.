using UnityEngine;

namespace MundoBloques
{
    public enum BiomeId : byte
    {
        Ocean, DeepOcean, FrozenOcean, WarmOcean, Beach, River, Plains, Forest, BirchForest, Taiga, Tundra, Desert,
        Savanna, Jungle, Swamp, Mesa, Mountains, SnowyPeaks, Island, Mushroom, Celestial, Ashlands, LavaSea, EndIsland, EndVoid,
        Count
    }

    public sealed class BiomeInfo
    {
        public string name;
        public uint grass, foliage, water;
        public bool snowy;
        public BiomeInfo(string name, uint grass, uint foliage, uint water = 0x3F76E4, bool snowy = false)
        { this.name = name; this.grass = grass; this.foliage = foliage; this.water = water; this.snowy = snowy; }
    }

    public static class Biomes
    {
        public static readonly BiomeInfo[] Info = new BiomeInfo[(int)BiomeId.Count];

        static Biomes()
        {
            Info[(int)BiomeId.Ocean] = new BiomeInfo("Océano", 0x8EB971, 0x71A74D);
            Info[(int)BiomeId.DeepOcean] = new BiomeInfo("Océano profundo", 0x8EB971, 0x71A74D, 0x3A63C8);
            Info[(int)BiomeId.FrozenOcean] = new BiomeInfo("Océano helado", 0x80B497, 0x60A17B, 0x3938C9, true);
            Info[(int)BiomeId.WarmOcean] = new BiomeInfo("Océano cálido", 0xAEA42A, 0xAEA42A, 0x43D5EE);
            Info[(int)BiomeId.Beach] = new BiomeInfo("Playa", 0x91BD59, 0x77AB2F);
            Info[(int)BiomeId.River] = new BiomeInfo("Río", 0x8EB971, 0x71A74D);
            Info[(int)BiomeId.Plains] = new BiomeInfo("Llanura", 0x91BD59, 0x77AB2F);
            Info[(int)BiomeId.Forest] = new BiomeInfo("Bosque", 0x79C05A, 0x59AE30);
            Info[(int)BiomeId.BirchForest] = new BiomeInfo("Bosque de abedules", 0x88BB67, 0x6BA941);
            Info[(int)BiomeId.Taiga] = new BiomeInfo("Taiga", 0x86B783, 0x68A464);
            Info[(int)BiomeId.Tundra] = new BiomeInfo("Tundra nevada", 0x80B497, 0x60A17B, 0x3D57D6, true);
            Info[(int)BiomeId.Desert] = new BiomeInfo("Desierto", 0xBFB755, 0xAEA42A);
            Info[(int)BiomeId.Savanna] = new BiomeInfo("Sabana", 0xBFB755, 0xAEA42A);
            Info[(int)BiomeId.Jungle] = new BiomeInfo("Selva", 0x59C93C, 0x30BB0B);
            Info[(int)BiomeId.Swamp] = new BiomeInfo("Pantano", 0x6A7039, 0x6A7039, 0x617B64);
            Info[(int)BiomeId.Mesa] = new BiomeInfo("Mesa", 0x90814D, 0x9E814D);
            Info[(int)BiomeId.Mountains] = new BiomeInfo("Montañas", 0x8AB689, 0x6DA36B);
            Info[(int)BiomeId.SnowyPeaks] = new BiomeInfo("Picos nevados", 0x80B497, 0x60A17B, 0x3D57D6, true);
            Info[(int)BiomeId.Island] = new BiomeInfo("Isla tropical", 0x7FD04A, 0x4CC02A, 0x43D5EE);
            Info[(int)BiomeId.Mushroom] = new BiomeInfo("Isla de hongos", 0x55C93F, 0x2BBB0F);
            Info[(int)BiomeId.Celestial] = new BiomeInfo("Isla celestial", 0x7FE8C8, 0x5CE0B8);
            Info[(int)BiomeId.Ashlands] = new BiomeInfo("Cenizal del Abismo", 0xA08080, 0xA08080);
            Info[(int)BiomeId.LavaSea] = new BiomeInfo("Mar de lava", 0xA08080, 0xA08080);
            Info[(int)BiomeId.EndIsland] = new BiomeInfo("Isla del Final", 0xB0B0B0, 0xB0B0B0);
            Info[(int)BiomeId.EndVoid] = new BiomeInfo("Vacío del Final", 0xB0B0B0, 0xB0B0B0);
        }

        public static string NameOf(int id) { return Info[id].name; }
        public static bool IsOcean(BiomeId b) { return b == BiomeId.Ocean || b == BiomeId.DeepOcean || b == BiomeId.FrozenOcean || b == BiomeId.WarmOcean; }
    }
}
