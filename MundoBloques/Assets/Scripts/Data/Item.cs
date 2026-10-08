using System.Collections.Generic;

namespace MundoBloques
{
    public enum ItemKind : byte { Material, Block, Tool, Armor, Food, Seed, Special }

    public sealed class Item
    {
        public string key, name;
        public int maxStack = 64;
        public ItemKind kind = ItemKind.Material;
        public string iconSpec;          // descripcion del icono procedural (no bloques)
        public int icon = -1;            // indice en el atlas de iconos
        public Block block;              // si se coloca como bloque
        public Block crop;               // si es semilla: cultivo que planta
        public ToolKind tool;
        public int tier;                 // nivel de minado
        public float speed = 1f;
        public float damage = 1f;
        public int durability;           // 0 = sin desgaste
        public int hunger;
        public float saturation;
        public bool alwaysEdible;
        public int armorSlot = -1;       // 0 casco, 1 peto, 2 pantalones, 3 botas
        public int defense;
        public float fuel;               // segundos de combustion
        public string action;            // accion especial (cubo, mechero, ojo del final...)
        public string category = "Materiales";

        public bool IsTool { get { return kind == ItemKind.Tool; } }
        public bool IsFood { get { return hunger > 0 || alwaysEdible; } }
    }

    public struct ItemStack
    {
        public Item item;
        public int count;
        public int damage;

        public ItemStack(Item item, int count = 1, int damage = 0)
        {
            this.item = item; this.count = count; this.damage = damage;
        }

        public bool IsEmpty { get { return item == null || count <= 0; } }
        public int Max { get { return item == null ? 0 : item.maxStack; } }
        public static ItemStack Empty { get { return default(ItemStack); } }

        public bool SameKind(ItemStack o)
        {
            return item == o.item && damage == o.damage;
        }

        public void Clear() { item = null; count = 0; damage = 0; }

        /// <summary>Intenta fusionar o; devuelve lo que sobra de o.</summary>
        public ItemStack Merge(ItemStack o)
        {
            if (o.IsEmpty) return o;
            if (IsEmpty) { this = o; return Empty; }
            if (!SameKind(o)) return o;
            int space = Max - count;
            int move = o.count < space ? o.count : space;
            if (move <= 0) return o;
            count += move; o.count -= move;
            if (o.count <= 0) return Empty;
            return o;
        }

        /// <summary>Gasta durabilidad. Devuelve true si la herramienta se rompe.</summary>
        public bool Wear(int amount = 1)
        {
            if (IsEmpty || item.durability <= 0) return false;
            damage += amount;
            if (damage >= item.durability) { Clear(); return true; }
            return false;
        }

        public string Label()
        {
            if (IsEmpty) return "";
            return item.name;
        }
    }

    /// <summary>Contenedor de items (inventario del jugador).</summary>
    public sealed class Inventory
    {
        public readonly ItemStack[] slots = new ItemStack[36];   // 0-8 barra rapida, 9-35 mochila
        public readonly ItemStack[] armor = new ItemStack[4];
        public int selected;

        public ItemStack Held { get { return slots[selected]; } }

        /// <summary>Anade items; devuelve lo que no cupo.</summary>
        public ItemStack Add(ItemStack s)
        {
            if (s.IsEmpty) return ItemStack.Empty;
            // primero rellenar pilas existentes (barra rapida primero)
            for (int i = 0; i < slots.Length && !s.IsEmpty; i++)
            {
                if (!slots[i].IsEmpty && slots[i].SameKind(s) && slots[i].count < slots[i].Max)
                    s = slots[i].Merge(s);
            }
            for (int i = 0; i < slots.Length && !s.IsEmpty; i++)
            {
                if (slots[i].IsEmpty)
                {
                    int n = s.count < s.Max ? s.count : s.Max;
                    slots[i] = new ItemStack(s.item, n, s.damage);
                    s.count -= n;
                    if (s.count <= 0) s = ItemStack.Empty;
                }
            }
            return s;
        }

        public int Count(Item it)
        {
            int n = 0;
            for (int i = 0; i < slots.Length; i++) if (!slots[i].IsEmpty && slots[i].item == it) n += slots[i].count;
            return n;
        }

        public bool Remove(Item it, int n)
        {
            if (Count(it) < n) return false;
            for (int i = slots.Length - 1; i >= 0 && n > 0; i--)
            {
                if (slots[i].IsEmpty || slots[i].item != it) continue;
                int t = slots[i].count < n ? slots[i].count : n;
                slots[i].count -= t; n -= t;
                if (slots[i].count <= 0) slots[i].Clear();
            }
            return true;
        }

        public int TotalDefense()
        {
            int d = 0;
            for (int i = 0; i < 4; i++) if (!armor[i].IsEmpty) d += armor[i].item.defense;
            return d;
        }

        public void Clear()
        {
            for (int i = 0; i < slots.Length; i++) slots[i].Clear();
            for (int i = 0; i < armor.Length; i++) armor[i].Clear();
        }
    }
}
