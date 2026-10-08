using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public enum Shape : byte { Cube, Box, Cross, Slab, Stairs, Fluid, Torch, Crop, Door, Portal }
    public enum ToolKind : byte { None, Pickaxe, Axe, Shovel, Hoe, Sword, Shears }
    public enum Tint : byte { None, Grass, Foliage, Water }
    public enum Snd : byte { Stone, Grass, Dirt, Sand, Wood, Glass, Cloth, Metal, Water, Gravel, Snow, Plant }
    public enum Support : byte { None, Solid, Soil, Sand, Water }
    public enum Dim : byte { Overworld, Abismo, Final }

    public struct DropEntry
    {
        public string item; public int min, max; public float chance; public ToolKind needTool;
        public DropEntry(string item, int min, int max, float chance, ToolKind needTool = ToolKind.None)
        { this.item = item; this.min = min; this.max = max; this.chance = chance; this.needTool = needTool; }
    }

    /// <summary>Definicion de un tipo de bloque. Los datos de cada bloque (id de textura, dureza...) se declaran en B.cs.</summary>
    public sealed class Block
    {
        public static readonly List<Block> All = new List<Block>();
        public static readonly Dictionary<string, Block> ByKey = new Dictionary<string, Block>();

        // Direcciones de las 6 caras: +X, -X, +Y, -Y, +Z, -Z
        public static readonly int[] DX = { 1, -1, 0, 0, 0, 0 };
        public static readonly int[] DY = { 0, 0, 1, -1, 0, 0 };
        public static readonly int[] DZ = { 0, 0, 0, 0, 1, -1 };
        // meta de orientacion (0..3) -> cara hacia la que mira el frente
        public static readonly int[] FaceOfFacing = { 4, 0, 5, 1 };

        public ushort id;
        public string key, name;
        public Shape shape = Shape.Cube;
        public bool solid = true;          // colisiona
        public bool opaque = true;         // bloquea la luz y oculta las caras vecinas
        public bool cutout;                // alpha test (hojas, plantas, cristal)
        public bool translucent;           // mezcla alfa (agua, hielo, cristal tintado)
        public bool replaceable;           // se puede colocar encima (aire, agua, hierba alta)
        public bool fluid;
        public bool isLava;
        public float hardness = 1f;        // -1 = irrompible
        public ToolKind tool = ToolKind.None;
        public int level;                  // nivel minimo de herramienta para obtener drops
        public bool needsTool;
        public int light;                  // emision 0..15
        public int[] tex = new int[7];     // 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z 6:frente (bloques orientados)
        public Tint tint;
        public int tintMask = 63;
        public Snd sound = Snd.Stone;
        public Support support = Support.None;
        public bool gravity;
        public bool randomTick;
        public bool oriented;              // el meta 0..3 es la orientacion del frente
        public bool hasEntity;             // cofre, horno
        public bool interactive;           // click derecho hace algo
        public bool hasItem = true;
        public float height = 1f;          // para Shape.Box
        public float inset;                // para Shape.Box (cactus)
        public Block slabFull;             // losa -> bloque completo
        public Block slabHalf;             // bloque completo -> losa (para la mesa de cortar)
        public Block baseBlock;            // escaleras/losas: bloque original
        public bool damagesOnTouch;
        public bool unbreakableByHand;
        public Item item;
        public List<DropEntry> drops;
        public bool noDrops;
        public string dropSelfOverride;
        public bool glowTexture;

        public Block(string key, string name)
        {
            this.key = key; this.name = name;
        }

        public bool FullOpaque { get { return opaque && shape == Shape.Cube; } }
        public bool IsAir { get { return id == 0; } }
        public bool Collides { get { return solid && shape != Shape.Cross && shape != Shape.Torch && shape != Shape.Crop && shape != Shape.Fluid && shape != Shape.Portal; } }

        public static Block ById(ushort id) { return All[id]; }

        // ---- Constructor fluido ----
        public Block Tex(string all) { int t = TileAtlas.Index(all); for (int i = 0; i < 7; i++) tex[i] = t; return this; }
        public Block Tex(string top, string side, string bottom)
        {
            int t = TileAtlas.Index(top), s = TileAtlas.Index(side), b = TileAtlas.Index(bottom);
            tex[0] = tex[1] = tex[4] = tex[5] = tex[6] = s; tex[2] = t; tex[3] = b; return this;
        }
        public Block Front(string front) { tex[6] = TileAtlas.Index(front); oriented = true; return this; }
        public Block Face(int face, string name) { tex[face] = TileAtlas.Index(name); return this; }
        public Block CopyTex(Block o) { Array.Copy(o.tex, tex, 7); tint = o.tint; tintMask = o.tintMask; return this; }
        public Block Hard(float h) { hardness = h; return this; }
        public Block Unbreakable() { hardness = -1f; return this; }
        public Block Use(ToolKind k, int lvl = 0, bool need = false) { tool = k; level = lvl; needsTool = need; return this; }
        public Block Lit(int l) { light = l; return this; }
        public Block Sound(Snd s) { sound = s; return this; }
        public Block Shaped(Shape s) { shape = s; return this; }
        public Block NoCollide() { solid = false; return this; }
        public Block Clear() { opaque = false; return this; }
        public Block Cut() { opaque = false; cutout = true; return this; }
        public Block Trans() { opaque = false; translucent = true; return this; }
        public Block Repl() { replaceable = true; return this; }
        public Block Tinted(Tint t, int mask = 63) { tint = t; tintMask = mask; return this; }
        public Block Needs(Support s) { support = s; return this; }
        public Block Falls() { gravity = true; return this; }
        public Block Ticks() { randomTick = true; return this; }
        public Block Entity() { hasEntity = true; interactive = true; return this; }
        public Block Interact() { interactive = true; return this; }
        public Block NoItem() { hasItem = false; return this; }
        public Block Dims(float h, float ins = 0f) { shape = Shape.Box; height = h; inset = ins; return this; }
        public Block Drop(string itemKey, int min = 1, int max = 1, float chance = 1f, ToolKind needTool = ToolKind.None)
        {
            if (drops == null) { drops = new List<DropEntry>(); }
            drops.Add(new DropEntry(itemKey, min, max, chance, needTool)); return this;
        }
        public Block NoDrop() { noDrops = true; return this; }

        /// <summary>Calcula los objetos que suelta al romperse con el item dado.</summary>
        public void GetDrops(Rng rng, ItemStack tool, List<ItemStack> into)
        {
            if (noDrops) return;
            if (needsTool && !CanHarvest(tool)) return;
            if (drops == null)
            {
                if (item != null) into.Add(new ItemStack(item, 1));
                return;
            }
            for (int i = 0; i < drops.Count; i++)
            {
                var d = drops[i];
                if (d.needTool != ToolKind.None && (tool.IsEmpty || tool.item.tool != d.needTool)) continue;
                if (d.chance < 1f && !rng.Chance(d.chance)) continue;
                var it = Items.Get(d.item);
                if (it == null) continue;
                int n = d.min >= d.max ? d.min : rng.Range(d.min, d.max + 1);
                if (n > 0) into.Add(new ItemStack(it, n));
            }
        }

        public bool CanHarvest(ItemStack t)
        {
            if (!needsTool) return true;
            if (t.IsEmpty || t.item.tool != tool) return false;
            return t.item.tier >= level;
        }

        /// <summary>Segundos para romper el bloque con la herramienta dada.</summary>
        public float BreakTime(ItemStack t)
        {
            if (hardness < 0) return float.PositiveInfinity;
            if (hardness == 0) return 0f;
            float speed = 1f;
            bool right = !t.IsEmpty && t.item.tool == tool && tool != ToolKind.None;
            if (right) speed = Mathf.Max(1f, t.item.speed);
            else if (!t.IsEmpty && tool == ToolKind.None) speed = 1f;
            float time = hardness * 1.5f / speed;
            if (needsTool && !CanHarvest(t)) time = hardness * 5f;
            return time;
        }
    }
}
