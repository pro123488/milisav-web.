using System;
using System.IO;

namespace MundoBloques
{
    public abstract class BlockEntity
    {
        public int x, y, z;                    // coordenadas del mundo
        public abstract void Write(BinaryWriter w);
        public abstract void Read(BinaryReader r);
        public virtual void Tick(World world, float dt) { }
        public virtual bool NeedsTick { get { return false; } }

        public static void WriteStack(BinaryWriter w, ItemStack s)
        {
            if (s.IsEmpty) { w.Write(""); return; }
            w.Write(s.item.key); w.Write(s.count); w.Write(s.damage);
        }

        public static ItemStack ReadStack(BinaryReader r)
        {
            string k = r.ReadString();
            if (k.Length == 0) return ItemStack.Empty;
            int n = r.ReadInt32(), d = r.ReadInt32();
            var it = Items.Get(k);
            return it == null ? ItemStack.Empty : new ItemStack(it, n, d);
        }
    }

    public sealed class ChestEntity : BlockEntity
    {
        public readonly ItemStack[] slots = new ItemStack[27];

        public override void Write(BinaryWriter w) { for (int i = 0; i < slots.Length; i++) WriteStack(w, slots[i]); }
        public override void Read(BinaryReader r) { for (int i = 0; i < slots.Length; i++) slots[i] = ReadStack(r); }

        public ItemStack Add(ItemStack s)
        {
            for (int i = 0; i < slots.Length && !s.IsEmpty; i++)
                if (!slots[i].IsEmpty && slots[i].SameKind(s)) s = slots[i].Merge(s);
            for (int i = 0; i < slots.Length && !s.IsEmpty; i++)
                if (slots[i].IsEmpty) { slots[i] = s; s = ItemStack.Empty; }
            return s;
        }
    }

    public sealed class FurnaceEntity : BlockEntity
    {
        public readonly ItemStack[] slots = new ItemStack[3];   // 0 entrada, 1 combustible, 2 resultado
        public float burn, burnMax, cook, cookTotal = 10f;

        public override bool NeedsTick { get { return true; } }

        public override void Write(BinaryWriter w)
        {
            for (int i = 0; i < 3; i++) WriteStack(w, slots[i]);
            w.Write(burn); w.Write(burnMax); w.Write(cook);
        }

        public override void Read(BinaryReader r)
        {
            for (int i = 0; i < 3; i++) slots[i] = ReadStack(r);
            burn = r.ReadSingle(); burnMax = r.ReadSingle(); cook = r.ReadSingle();
        }

        bool CanSmelt(SmeltRecipe rec)
        {
            if (rec == null || slots[0].IsEmpty) return false;
            var outItem = Items.Get(rec.output);
            if (slots[2].IsEmpty) return true;
            return slots[2].item == outItem && slots[2].count < slots[2].Max;
        }

        public override void Tick(World world, float dt)
        {
            var rec = Recipes.FindSmelt(slots[0].IsEmpty ? null : slots[0].item);
            bool can = CanSmelt(rec);
            bool wasLit = burn > 0;
            if (burn > 0) burn = Math.Max(0, burn - dt);
            if (burn <= 0 && can && !slots[1].IsEmpty && slots[1].item.fuel > 0)
            {
                burnMax = burn = slots[1].item.fuel;
                if (slots[1].item.key == "lava_bucket") { slots[1] = new ItemStack(Items.Get("bucket"), 1); }
                else { slots[1].count--; if (slots[1].count <= 0) slots[1].Clear(); }
            }
            if (burn > 0 && can)
            {
                cookTotal = rec.time;
                cook += dt;
                if (cook >= rec.time)
                {
                    cook = 0;
                    var outItem = Items.Get(rec.output);
                    if (slots[2].IsEmpty) slots[2] = new ItemStack(outItem, 1); else slots[2].count++;
                    slots[0].count--; if (slots[0].count <= 0) slots[0].Clear();
                }
            }
            else if (cook > 0) cook = Math.Max(0, cook - dt * 2f);

            bool lit = burn > 0;
            if (lit != wasLit)
            {
                var b = world.GetBlock(x, y, z);
                if (b == B.Furnace || b == B.FurnaceOn)
                    world.SetBlock(x, y, z, lit ? B.FurnaceOn : B.Furnace, world.GetMeta(x, y, z), false);
            }
        }
    }
}
