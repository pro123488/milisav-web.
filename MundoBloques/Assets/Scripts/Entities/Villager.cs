using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public sealed class Trade
    {
        public string buyA; public int countA; public string buyB; public int countB; public string sell; public int countSell;
        public int uses, maxUses = 10;
        public Trade(string a, int ca, string sell, int cs, string b = null, int cb = 0) { buyA = a; countA = ca; buyB = b; countB = cb; this.sell = sell; countSell = cs; }
        public bool Available { get { return uses < maxUses; } }
    }

    /// <summary>Datos de comercio de un aldeano.</summary>
    public sealed class Villager
    {
        public Mob mob;
        public bool trading;
        public string profession;
        public List<Trade> trades = new List<Trade>();

        static readonly Trade[][] tables;

        static Villager()
        {
            tables = new[]
            {
                new[] { // granjero
                    new Trade("wheat", 20, "emerald", 1), new Trade("carrot", 22, "emerald", 1), new Trade("potato", 26, "emerald", 1), new Trade("beetroot", 15, "emerald", 1),
                    new Trade("tomato", 18, "emerald", 1), new Trade("pumpkin", 6, "emerald", 1), new Trade("emerald", 1, "bread", 6), new Trade("emerald", 1, "apple", 4),
                    new Trade("emerald", 2, "cooked_pork", 6), new Trade("emerald", 1, "wheat_seeds", 16), new Trade("emerald", 3, "golden_carrot", 3), new Trade("emerald", 1, "cookie", 8) },
                new[] { // herrero
                    new Trade("coal", 15, "emerald", 1), new Trade("iron_ingot", 4, "emerald", 1), new Trade("gold_ingot", 3, "emerald", 1), new Trade("copper_ingot", 8, "emerald", 1),
                    new Trade("emerald", 4, "iron_pickaxe", 1), new Trade("emerald", 3, "iron_axe", 1), new Trade("emerald", 5, "iron_sword", 1), new Trade("emerald", 8, "iron_chestplate", 1),
                    new Trade("emerald", 3, "iron_helmet", 1), new Trade("emerald", 6, "copper_chestplate", 1), new Trade("emerald", 12, "diamond", 1), new Trade("emerald", 2, "bucket", 1), new Trade("emerald", 1, "arrow", 16) },
                new[] { // bibliotecario / joyero
                    new Trade("paper", 24, "emerald", 1), new Trade("book", 4, "emerald", 1), new Trade("emerald", 3, "bookshelf", 1), new Trade("emerald", 1, "glass", 4),
                    new Trade("emerald", 5, "ruby", 1), new Trade("emerald", 5, "sapphire", 1), new Trade("emerald", 4, "amethyst_shard", 3), new Trade("emerald", 1, "torch", 12),
                    new Trade("emerald", 2, "glowstone", 1), new Trade("emerald", 6, "ender_pearl", 1), new Trade("lapis", 10, "emerald", 1), new Trade("emerald", 10, "shears", 1) }
            };
        }

        public Villager(Mob m)
        {
            mob = m;
            var p = m.transform.position;
            uint h = MathX.Hash(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y), Mathf.FloorToInt(p.z), 4242);
            int prof = (int)(h % 3);
            profession = prof == 0 ? "Granjero" : (prof == 1 ? "Herrero" : "Bibliotecario");
            var src = tables[prof];
            var rng = new Rng(h);
            var used = new HashSet<int>();
            int want = 5;
            // siempre incluir una venta de esmeraldas y algo de compra
            while (trades.Count < want)
            {
                int i = rng.Int(src.Length);
                if (!used.Add(i)) continue;
                var t = src[i];
                trades.Add(new Trade(t.buyA, t.countA, t.sell, t.countSell, t.buyB, t.countB));
            }
        }

        public bool CanDo(Player p, Trade t)
        {
            if (!t.Available) return false;
            var a = Items.Get(t.buyA);
            if (a == null || p.inv.Count(a) < t.countA) return false;
            if (t.buyB != null) { var b = Items.Get(t.buyB); if (b == null || p.inv.Count(b) < t.countB) return false; }
            return true;
        }

        public bool Do(Player p, Trade t)
        {
            if (!CanDo(p, t)) return false;
            p.inv.Remove(Items.Get(t.buyA), t.countA);
            if (t.buyB != null) p.inv.Remove(Items.Get(t.buyB), t.countB);
            var it = Items.Get(t.sell);
            var left = p.inv.Add(new ItemStack(it, t.countSell));
            if (!left.IsEmpty) GameRoot.I.SpawnItem(p.Eye, left, p.camT.forward * 2f);
            t.uses++;
            Sfx.Play(Clip.Bell, p.transform.position, 0.6f, 1.3f);
            return true;
        }
    }
}
