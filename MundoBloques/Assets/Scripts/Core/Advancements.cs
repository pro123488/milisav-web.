using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Un logro: se detecta por inventario, por eventos del juego o por el estado del jugador.</summary>
    public sealed class Adv
    {
        public string id, name, desc, icon, group;
        public Func<GameRoot, Player, bool> test;
    }

    /// <summary>Guia de progreso: logros que orientan al jugador por todo el juego.</summary>
    public static class Advancements
    {
        public static readonly List<Adv> All = new List<Adv>();
        static readonly HashSet<string> events = new HashSet<string>();
        static float timer;

        /// <summary>Anota algo que ha pasado ("craft:furnace", "kill:zombie", "trade"...).</summary>
        public static void Event(string key) { events.Add(key); }
        public static void ClearEvents() { events.Clear(); timer = 0f; }
        static bool E(string key) { return events.Contains(key); }

        static bool Has(Player p, string key)
        {
            var it = Items.Get(key);
            if (it == null) return false;
            if (p.inv.Count(it) > 0) return true;
            for (int i = 0; i < 4; i++) if (!p.inv.armor[i].IsEmpty && p.inv.armor[i].item == it) return true;
            return false;
        }

        static bool HasTag(Player p, string tag)
        {
            foreach (var k in Recipes.TagMembers(tag)) if (Has(p, k)) return true;
            return false;
        }

        static void Add(string group, string id, string name, string desc, string icon, Func<GameRoot, Player, bool> test)
        {
            All.Add(new Adv { group = group, id = id, name = name, desc = desc, icon = icon, test = test });
        }

        static Advancements()
        {
            const string A = "Primeros pasos", Mi = "Minería", Gr = "Granja y vida", Ex = "Exploración", Co = "Combate", Fn = "Dimensiones";
            Add(A, "wood", "Leñador", "Consigue madera de un tronco.", "oak_log", (g, p) => HasTag(p, "logs"));
            Add(A, "table", "Carpintero", "Fabrica una mesa de crafteo.", "crafting_table", (g, p) => E("craft:crafting_table") || Has(p, "crafting_table"));
            Add(A, "pickaxe", "Manos a la obra", "Fabrica un pico de madera.", "wood_pickaxe", (g, p) => E("craft:wood_pickaxe") || Has(p, "wood_pickaxe"));
            Add(A, "cobble", "Edad de piedra", "Pica piedra y consigue roca.", "cobblestone", (g, p) => Has(p, "cobblestone"));
            Add(A, "furnace", "Hora de cocinar", "Fabrica un horno.", "furnace", (g, p) => E("craft:furnace") || Has(p, "furnace"));
            Add(A, "bed", "Dulces sueños", "Fabrica una cama y duerme de noche.", "bed", (g, p) => E("sleep"));
            Add(A, "armor", "Cúbreme", "Equipa las cuatro piezas de armadura.", "iron_chestplate", (g, p) => { for (int i = 0; i < 4; i++) if (p.inv.armor[i].IsEmpty) return false; return true; });

            Add(Mi, "iron", "Adquisición de hierro", "Funde un lingote de hierro.", "iron_ingot", (g, p) => E("smelt:iron_ingot") || Has(p, "iron_ingot"));
            Add(Mi, "irontool", "Herramientas de verdad", "Fabrica un pico de hierro.", "iron_pickaxe", (g, p) => E("craft:iron_pickaxe") || Has(p, "iron_pickaxe"));
            Add(Mi, "diamond", "¡Diamantes!", "Consigue un diamante.", "diamond", (g, p) => Has(p, "diamond"));
            Add(Mi, "gems", "Joyero", "Reúne rubí, zafiro, esmeralda y amatista.", "ruby", (g, p) => Has(p, "ruby") && Has(p, "sapphire") && Has(p, "emerald") && Has(p, "amethyst_shard"));
            Add(Mi, "deep", "Profundidades", "Baja por debajo de la capa 14.", "deepslate", (g, p) => g.world.dim == Dim.Overworld && p.transform.position.y < 14f);
            Add(Mi, "cutter", "Cantero", "Fabrica un cortapiedras.", "stonecutter", (g, p) => E("craft:stonecutter") || Has(p, "stonecutter"));
            Add(Mi, "lava", "Sin miedo al fuego", "Llena un cubo de lava.", "lava_bucket", (g, p) => Has(p, "lava_bucket"));
            Add(Mi, "obsidian", "Roca volcánica", "Consigue obsidiana.", "obsidian", (g, p) => Has(p, "obsidian"));

            Add(Gr, "hoe", "Agricultor", "Fabrica una azada.", "stone_hoe", (g, p) => E("craft:wood_hoe") || E("craft:stone_hoe") || Has(p, "wood_hoe") || Has(p, "stone_hoe") || Has(p, "iron_hoe"));
            Add(Gr, "harvest", "Primera cosecha", "Recoge un cultivo maduro.", "wheat", (g, p) => E("harvest"));
            Add(Gr, "bread", "Pan de cada día", "Hornea pan.", "bread", (g, p) => E("craft:bread") || Has(p, "bread"));
            Add(Gr, "breed", "Granjero de animales", "Cría dos animales.", "wheat_seeds", (g, p) => E("breed"));
            Add(Gr, "trade", "Hacer negocios", "Comercia con un aldeano.", "emerald", (g, p) => E("trade"));
            Add(Gr, "fish", "Día de pesca", "Pesca algo con la caña.", "fishing_rod", (g, p) => p.fishCaught > 0);
            Add(Gr, "wolf", "El mejor amigo", "Domestica a un lobo con huesos.", "bone", (g, p) => p.petsTamed > 0);

            Add(Ex, "boat", "A navegar", "Súbete a un barco.", "boat", (g, p) => E("mount:boat"));
            Add(Ex, "horse", "A galope", "Monta un caballo ensillado.", "saddle", (g, p) => E("mount:horse"));
            Add(Ex, "sky", "Cabeza en las nubes", "Pisa una isla celestial flotante.", "cloud_fluff", (g, p) =>
            {
                if (g.world.dim != Dim.Overworld || !p.onGround) return false;
                var pp = p.transform.position;
                var under = g.world.GetBlock(Mathf.FloorToInt(pp.x), Mathf.FloorToInt(pp.y - 0.1f), Mathf.FloorToInt(pp.z));
                return under == B.SkyGrass || under == B.SkyStone || under == B.SkyBricks || under == B.Cloud || under == B.SkyCrystal;
            });
            Add(Ex, "explorer", "Cartógrafo", "Explora 300 chunks del mundo.", "paper", (g, p) => g.map.Count >= 300);
            Add(Ex, "explorer2", "Gran explorador", "Explora 2000 chunks del mundo.", "book", (g, p) => g.map.Count >= 2000);
            Add(Ex, "mine", "Minero valiente", "Abre un cofre de unas minas abandonadas.", "chest", (g, p) => E("chest:mineshaft"));
            Add(Ex, "wreck", "Tesoro hundido", "Abre un cofre de un naufragio.", "chest", (g, p) => E("chest:shipwreck"));

            Add(Co, "bow", "A distancia", "Fabrica un arco.", "bow", (g, p) => E("craft:bow") || Has(p, "bow"));
            Add(Co, "monster", "Cazador de monstruos", "Derrota a una criatura hostil.", "iron_sword", (g, p) => E("kill:hostile"));
            Add(Co, "boom", "Chist, chist...", "Derrota a un detonador.", "gunpowder", (g, p) => E("kill:detonator"));
            Add(Co, "skeleton", "Huesos rotos", "Derrota a un esqueleto.", "bone", (g, p) => E("kill:skeleton"));
            Add(Co, "golem", "Gólem de cristal", "Derrota a un gólem de cristal.", "sky_crystal_shard", (g, p) => E("kill:crystal_golem"));

            Add(Fn, "abyss", "Hacia el Abismo", "Entra en el Abismo por un portal.", "flint_and_steel", (g, p) => g.world.dim == Dim.Abismo || E("dim:abismo"));
            Add(Fn, "eye", "Ojo del Final", "Fabrica un Ojo del Final.", "eye_of_end", (g, p) => E("craft:eye_of_end") || Has(p, "eye_of_end"));
            Add(Fn, "end", "El Final", "Entra en la dimensión del Final.", "ender_pearl", (g, p) => g.world.dim == Dim.Final || E("dim:final"));
            Add(Fn, "dragon", "Libera el Final", "Derrota al Dragón del Final.", "dragon_scale", (g, p) => g.dragonDefeated);
        }

        public static int Done(GameRoot g) { return g.advDone.Count; }

        /// <summary>Comprueba los logros pendientes (una vez por segundo).</summary>
        public static void Tick(GameRoot g, Player p, float dt)
        {
            timer -= dt;
            if (timer > 0f) return;
            timer = 1.2f;
            for (int i = 0; i < All.Count; i++)
            {
                var a = All[i];
                if (g.advDone.Contains(a.id)) continue;
                bool ok;
                try { ok = a.test(g, p); } catch { ok = false; }
                if (!ok) continue;
                g.advDone.Add(a.id);
                g.ui.Toast("¡Logro conseguido: " + a.name + "!");
                Sfx.Play2D(Clip.Level, 0.7f, 1.1f);
            }
            events.Clear();
        }
    }
}
