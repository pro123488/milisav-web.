namespace MundoBloques
{
    /// <summary>Los 16 colores de tinte (lana, concreto, terracota, cristal tintado).</summary>
    public static class Dyes
    {
        public static readonly string[] Keys =
        {
            "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
            "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"
        };
        public static readonly string[] Names =
        {
            "blanco", "naranja", "magenta", "celeste", "amarillo", "lima", "rosa", "gris",
            "gris claro", "cian", "morado", "azul", "marrón", "verde", "rojo", "negro"
        };
        public static readonly uint[] Colors =
        {
            0xE9ECEC, 0xF07613, 0xBD44B3, 0x3AAFD9, 0xF8C627, 0x70B919, 0xED8DAC, 0x3E4447,
            0x8E8E86, 0x158991, 0x792AAC, 0x35399D, 0x724728, 0x546D1B, 0xA12722, 0x141519
        };
    }

    /// <summary>Tipos de arbol/madera: colores usados por el generador de texturas.</summary>
    public sealed class WoodDef
    {
        public string key, name;       // "oak", "roble"
        public uint bark, planks, ring, leaf;
        public bool leafTinted = true;
        public int leafLight;
        public WoodDef(string key, string name, uint bark, uint planks, uint ring, uint leaf, bool tinted = true, int leafLight = 0)
        {
            this.key = key; this.name = name; this.bark = bark; this.planks = planks; this.ring = ring; this.leaf = leaf;
            leafTinted = tinted; this.leafLight = leafLight;
        }
    }

    public static class Woods
    {
        public static readonly WoodDef[] All =
        {
            new WoodDef("oak", "roble", 0x6B5330, 0xB8945F, 0xA07E4D, 0xD0D0D0),
            new WoodDef("birch", "abedul", 0xD5D1C3, 0xD7C185, 0xC9B57A, 0xC8D8C0),
            new WoodDef("spruce", "abeto", 0x3A2A18, 0x7A5A34, 0x6B4D2D, 0xA0B8A0),
            new WoodDef("jungle", "selva", 0x584619, 0xB88764, 0xA57855, 0xC0D8B0),
            new WoodDef("acacia", "acacia", 0x6D6455, 0xBA6337, 0xA85830, 0xD8D8A0),
            new WoodDef("palm", "palma", 0x8A6E45, 0xD9B77A, 0xC8A66A, 0xB0E0A0),
            new WoodDef("spirit", "espiritual", 0xB8D8E8, 0xCDEBF2, 0xA8D4E4, 0x9CF0E0, false, 8)
        };

        public const int Oak = 0, Birch = 1, Spruce = 2, Jungle = 3, Acacia = 4, Palm = 5, Spirit = 6;
    }
}
