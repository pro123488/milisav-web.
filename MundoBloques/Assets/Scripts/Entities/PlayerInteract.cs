using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Mineria, colocacion de bloques, uso de objetos y combate.</summary>
    public sealed partial class Player
    {
        public float useTime;
        public Phys.Hit target;
        public Entity targetEntity;
        public float breakProgress;
        public bool breaking;
        int bx, by, bz;
        float breakSoundTimer, attackCooldown, creativeRepeat, placeCooldown;
        GameObject highlight, crackGo;
        Mesh crackMesh;
        Vector2[][] crackUv;
        public HeldItem held;
        static readonly Box[] tmpBoxes = new Box[12];

        public float Reach { get { return G.creative ? 6f : 4.8f; } }

        void InitInteract()
        {
            // contorno del bloque apuntado
            highlight = new GameObject("Highlight");
            var mf = highlight.AddComponent<MeshFilter>(); var mr = highlight.AddComponent<MeshRenderer>();
            var m = new Mesh();
            var v = new List<Vector3>(); var idx = new List<int>(); var col = new List<Color32>(); var uv = new List<Vector2>(); var uv2 = new List<Vector2>();
            Vector3[] c = { new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(1, 1, 0), new Vector3(1, 1, 1), new Vector3(0, 1, 1) };
            int[] e = { 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 };
            for (int i = 0; i < 8; i++) { v.Add(c[i]); col.Add(new Color32(0, 0, 0, 255)); uv.Add(new Vector2(TileAtlas.U0[TileAtlas.White] + 0.001f, TileAtlas.V0[TileAtlas.White] + 0.001f)); uv2.Add(Vector2.one); }
            for (int i = 0; i < e.Length; i++) idx.Add(e[i]);
            m.SetVertices(v); m.SetColors(col); m.SetUVs(0, uv); m.SetUVs(1, uv2); m.SetIndices(idx, MeshTopology.Lines, 0);
            mf.sharedMesh = m; mr.sharedMaterial = Mats.Lines;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            highlight.SetActive(false);

            // grietas al romper
            crackGo = new GameObject("Crack");
            var cmf = crackGo.AddComponent<MeshFilter>(); var cmr = crackGo.AddComponent<MeshRenderer>();
            crackMesh = new Mesh();
            var cv = new List<Vector3>(); var ct = new List<int>(); var cc = new List<Color32>(); var cuv2 = new List<Vector2>();
            float[][] faces = {
                new[] { 1f, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0 }, new[] { 0f, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1 },
                new[] { 0f, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1 }, new[] { 0f, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0 },
                new[] { 0f, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1 }, new[] { 1f, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0 } };
            foreach (var f in faces)
            {
                int bi = cv.Count;
                for (int k = 0; k < 4; k++) { cv.Add(new Vector3(f[k * 3], f[k * 3 + 1], f[k * 3 + 2])); cc.Add(new Color32(255, 255, 255, 255)); cuv2.Add(Vector2.one); }
                ct.Add(bi); ct.Add(bi + 1); ct.Add(bi + 2); ct.Add(bi); ct.Add(bi + 2); ct.Add(bi + 3);
            }
            crackMesh.SetVertices(cv); crackMesh.SetColors(cc); crackMesh.SetUVs(1, cuv2); crackMesh.SetTriangles(ct, 0);
            crackUv = new Vector2[10][];
            for (int s = 0; s < 10; s++)
            {
                int t = TileAtlas.Crack0 + s;
                var arr = new Vector2[24];
                for (int f = 0; f < 6; f++)
                {
                    arr[f * 4 + 0] = new Vector2(TileAtlas.U0[t], TileAtlas.V0[t]); arr[f * 4 + 1] = new Vector2(TileAtlas.U0[t], TileAtlas.V1[t]);
                    arr[f * 4 + 2] = new Vector2(TileAtlas.U1[t], TileAtlas.V1[t]); arr[f * 4 + 3] = new Vector2(TileAtlas.U1[t], TileAtlas.V0[t]);
                }
                crackUv[s] = arr;
            }
            crackMesh.uv = crackUv[0];
            cmf.sharedMesh = crackMesh; cmr.sharedMaterial = Mats.Transparent;
            cmr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            crackGo.SetActive(false);

            held = new GameObject("Held").AddComponent<HeldItem>();
            held.transform.SetParent(camT, false);
            held.Init(this);
        }

        public void StopBreaking()
        {
            breaking = false; breakProgress = 0;
            if (crackGo != null) crackGo.SetActive(false);
            if (highlight != null) highlight.SetActive(false);
        }

        public void CancelUse() { useTime = 0; }

        void Interact(float dt)
        {
            if (attackCooldown > 0) attackCooldown -= dt;
            if (placeCooldown > 0) placeCooldown -= dt;
            var origin = camT.position; var dir = camT.forward;
            target = Phys.Raycast(W, origin, dir, Reach, false);
            float ed;
            targetEntity = Entity.Raycast(origin, dir, Reach, this, out ed);
            if (targetEntity != null && target.hit && target.dist < ed) targetEntity = null;

            // contorno
            if (target.hit && targetEntity == null)
            {
                highlight.SetActive(true);
                int n = Shapes.Boxes(target.block, W.GetMeta(target.x, target.y, target.z), tmpBoxes);
                float x0 = 0, y0 = 0, z0 = 0, x1 = 1, y1 = 1, z1 = 1;
                if (target.block.shape == Shape.Cross || target.block.shape == Shape.Crop) { x0 = 0.12f; z0 = 0.12f; x1 = 0.88f; z1 = 0.88f; y1 = 0.85f; }
                else if (n > 0)
                {
                    x0 = y0 = z0 = 9f; x1 = y1 = z1 = -9f;
                    for (int i = 0; i < n; i++)
                    {
                        x0 = Mathf.Min(x0, tmpBoxes[i].x0); y0 = Mathf.Min(y0, tmpBoxes[i].y0); z0 = Mathf.Min(z0, tmpBoxes[i].z0);
                        x1 = Mathf.Max(x1, tmpBoxes[i].x1); y1 = Mathf.Max(y1, tmpBoxes[i].y1); z1 = Mathf.Max(z1, tmpBoxes[i].z1);
                    }
                }
                const float e = 0.003f;
                highlight.transform.position = new Vector3(target.x + x0 - e, target.y + y0 - e, target.z + z0 - e);
                highlight.transform.localScale = new Vector3(x1 - x0 + 2 * e, y1 - y0 + 2 * e, z1 - z0 + 2 * e);
            }
            else highlight.SetActive(false);

            var heldStack = inv.Held;
            bool mouseDown = Inp.MouseDown(0), mouseHeld = Inp.MouseHeld(0);

            // ---- clic izquierdo: atacar o picar ----
            if (targetEntity != null)
            {
                StopBreaking();
                if ((mouseDown || mouseHeld) && attackCooldown <= 0f) Attack(targetEntity);
            }
            else if (target.hit && mouseHeld) Mine(dt, mouseDown);
            else StopBreaking();
            if (!mouseHeld) StopBreaking();

            // ---- clic derecho: usar / colocar ----
            UseUpdate(dt);
        }

        // ---------------------------------------------------------------- combate
        void Attack(Entity e)
        {
            var h = inv.Held;
            float dmg = 1f;
            if (!h.IsEmpty && (h.item.tool == ToolKind.Sword || h.item.tool == ToolKind.Axe || h.item.tool == ToolKind.Pickaxe || h.item.tool == ToolKind.Shovel || h.item.tool == ToolKind.Hoe)) dmg = h.item.damage;
            bool crit = !onGround && vel.y < 0 && !inWater && !flying;
            if (crit) dmg *= 1.5f;
            attackCooldown = (h.IsEmpty || h.item.tool != ToolKind.Sword) ? 0.5f : 0.4f;
            e.Damage(dmg, transform.position, this, sprinting ? 1.1f : 0.6f);
            Sfx.Play(Clip.Hit, e.transform.position, 0.8f);
            if (crit) Particles.Burst(e.transform.position + Vector3.up, new Color32(255, 255, 255, 255), 8, 2f, 0.1f, 0.4f);
            held.Swing();
            AddExhaustion(0.1f);
            if (!h.IsEmpty && h.item.durability > 0 && !G.creative)
            {
                if (inv.slots[inv.selected].Wear(h.item.tool == ToolKind.Sword ? 1 : 2)) Sfx.Play(Clip.Hit, transform.position, 0.6f, 0.6f);
            }
            if (e.dead) totalKills++;
        }

        // ---------------------------------------------------------------- mineria
        void Mine(float dt, bool pressed)
        {
            var b = target.block;
            if (b.fluid) { StopBreaking(); return; }
            var tool = inv.Held;
            bool creative = G.creative;
            if (!breaking || bx != target.x || by != target.y || bz != target.z)
            {
                breaking = true; breakProgress = 0; bx = target.x; by = target.y; bz = target.z; breakSoundTimer = 0;
            }
            if (creative)
            {
                creativeRepeat -= dt;
                if (pressed || creativeRepeat <= 0f)
                {
                    BreakBlock(bx, by, bz); creativeRepeat = 0.22f; held.Swing();
                }
                return;
            }
            if (b.hardness < 0f) { crackGo.SetActive(false); return; }
            float time = b.BreakTime(tool);
            breakSoundTimer -= dt;
            if (breakSoundTimer <= 0f)
            {
                breakSoundTimer = 0.28f;
                Sfx.Block(b.sound, new Vector3(bx + 0.5f, by + 0.5f, bz + 0.5f), false, 0.45f);
                Particles.BlockBreak(bx, by, bz, b, 2);
                held.Swing();
            }
            breakProgress += time <= 0.0001f ? 1f : dt / time;
            if (breakProgress >= 1f) { BreakBlock(bx, by, bz); breakProgress = 0; breaking = false; crackGo.SetActive(false); }
            else
            {
                crackGo.SetActive(true);
                crackGo.transform.position = new Vector3(bx - 0.002f, by - 0.002f, bz - 0.002f);
                crackGo.transform.localScale = Vector3.one * 1.004f;
                crackMesh.uv = crackUv[Mathf.Clamp((int)(breakProgress * 10f), 0, 9)];
            }
        }

        public void BreakBlock(int x, int y, int z)
        {
            var w = W;
            var b = w.GetBlock(x, y, z);
            if (b.id == 0 || b.fluid) return;
            int meta = w.GetMeta(x, y, z);
            if (b.hardness < 0f && !G.creative) return;
            if (b.shape == Shape.Crop && meta >= 7) Advancements.Event("harvest");
            var heldStack = inv.Held;
            var drops = new List<ItemStack>();
            if (!G.creative)
            {
                if (b.shape == Shape.Crop) BlockLogic.CropDrops(b, meta, G.rand, drops);
                else if (b.shape == Shape.Door) { if ((meta & 8) == 0) drops.Add(new ItemStack(b.item, 1)); }
                else if (b == B.EndFrame) { }
                else b.GetDrops(G.rand, heldStack, drops);
                if (b.hasEntity) w.DropEntityContents(x, y, z, drops);
            }
            else if (b.hasEntity) { }
            // puertas: eliminar la otra mitad
            if (b.shape == Shape.Door)
            {
                int oy = (meta & 8) != 0 ? y - 1 : y + 1;
                if (w.GetBlock(x, oy, z) == b) w.SetBlock(x, oy, z, B.Air);
            }
            // portal del Abismo roto: la validacion borra el resto
            Particles.BlockBreak(x, y, z, b, 12);
            Sfx.Block(b.sound, new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), false, 1f);
            w.SetBlock(x, y, z, B.Air);
            // agua que se sostenia: ya lo gestionan los fluidos
            for (int i = 0; i < drops.Count; i++)
                G.SpawnItem(new Vector3(x + 0.5f, y + 0.4f, z + 0.5f), drops[i], new Vector3(Random.Range(-1.2f, 1.2f), Random.Range(2f, 3.5f), Random.Range(-1.2f, 1.2f)));
            if (!G.creative)
            {
                AddExhaustion(0.025f);
                if (!heldStack.IsEmpty && heldStack.item.durability > 0 && heldStack.item.tool != ToolKind.None && b.hardness > 0f)
                {
                    if (inv.slots[inv.selected].Wear(heldStack.item.tool == ToolKind.Sword ? 2 : 1)) Sfx.Play(Clip.Hit, transform.position, 0.6f, 0.6f);
                }
            }
            if (b == B.Tnt) { }
        }

        // ---------------------------------------------------------------- uso (clic derecho)
        void UseUpdate(float dt)
        {
            var h = inv.Held;
            bool down = Inp.MouseDown(1), heldDown = Inp.MouseHeld(1);
            // comida y arco se usan manteniendo
            if (!h.IsEmpty && heldDown)
            {
                if (h.item.IsFood && h.item.action != "milk" && (hunger < 20f || h.item.alwaysEdible || G.creative) && !(target.hit && target.block.interactive && !sneaking)
                    && !(h.item.crop != null && target.hit && target.face == 2 && B.IsFarmland(target.block)))
                {
                    useTime += dt;
                    if (Mathf.FloorToInt(useTime * 4f) != Mathf.FloorToInt((useTime - dt) * 4f)) { Sfx.Play(Clip.Eat, transform.position, 0.4f); Particles.Burst(Eye + camT.forward * 0.6f - Vector3.up * 0.2f, TileAtlas.Average(TileAtlas.White), 2, 1.5f, 0.06f, 0.3f); }
                    if (useTime >= 1.4f)
                    {
                        Eat(h.item);
                        var food = h.item;
                        if (!G.creative) ConsumeHeld(1);
                        if (food.key.EndsWith("_stew") || food.key == "tomato_soup" || food.key == "salad") GiveBack("bowl");
                        useTime = 0;
                    }
                    return;
                }
                if (h.item.action == "milk" && down) { ConsumeHeld(1); GiveBack("bucket"); Sfx.Play(Clip.Drink, transform.position); hunger = Mathf.Min(20, hunger + 3); return; }
                if (h.item.action == "bow" && (G.creative || inv.Count(Items.Get("arrow")) > 0))
                {
                    useTime += dt;
                    return;
                }
            }
            if (!heldDown && useTime > 0.01f)
            {
                if (!h.IsEmpty && h.item.action == "bow" && useTime > 0.15f) FireBow(Mathf.Clamp01(useTime / 1f));
                useTime = 0;
            }
            bool trigger = down || (heldDown && placeCooldown <= 0f && !h.IsEmpty && h.item.block != null && h.item.block.shape != Shape.Door);
            if (!trigger || placeCooldown > 0f) return;
            placeCooldown = 0.2f;
            if (targetEntity != null)
            {
                var m = targetEntity as Mob;
                if (m != null && m.Interact(this)) { held.Swing(); return; }
                var bt = targetEntity as Boat;
                if (bt != null && bt.Interact(this)) { held.Swing(); return; }
            }
            if (target.hit && target.block.interactive && !(sneaking && !h.IsEmpty))
            {
                if (InteractBlock(target)) { held.Swing(); return; }
            }
            if (h.IsEmpty) return;
            UseHeldItem(h);
        }

        public void ConsumeHeld(int n)
        {
            if (G.creative) return;
            inv.slots[inv.selected].count -= n;
            if (inv.slots[inv.selected].count <= 0) inv.slots[inv.selected].Clear();
        }

        void GiveBack(string key)
        {
            var left = inv.Add(new ItemStack(Items.Get(key), 1));
            if (!left.IsEmpty) G.SpawnItem(Eye + camT.forward * 0.5f, left, camT.forward * 3f);
        }

        void FireBow(float power)
        {
            var arrow = Items.Get("arrow");
            if (!G.creative) { if (!inv.Remove(arrow, 1)) return; inv.slots[inv.selected].Wear(1); }
            var p = Projectile.Spawn(ProjKind.Arrow, Eye + camT.forward * 0.5f, camT.forward * (12f + power * 28f), this, 6f);
            Sfx.Play(Clip.Bow, transform.position, 0.9f, 0.8f + power * 0.5f);
            held.Swing();
        }

        // ---------------------------------------------------------------- interaccion con bloques
        bool InteractBlock(Phys.Hit hit)
        {
            var w = W; var b = hit.block; int x = hit.x, y = hit.y, z = hit.z;
            var h = inv.Held;
            if (b == B.CraftingTable) { G.ui.OpenCrafting(); return true; }
            if (b == B.Stonecutter) { G.ui.OpenStonecutter(); return true; }
            if (b == B.Furnace || b == B.FurnaceOn)
            {
                var e = w.EnsureEntity(x, y, z) as FurnaceEntity;
                if (e != null) { G.ui.OpenFurnace(e); Sfx.Play(Clip.Chest, transform.position, 0.5f, 1.2f); return true; }
                return false;
            }
            if (b == B.Chest)
            {
                // un bloque encima impide abrir
                if (w.GetBlock(x, y + 1, z).FullOpaque) return true;
                var e = w.EnsureEntity(x, y, z) as ChestEntity;
                var og = w.gen as OverworldGen;
                if (og != null) { var kind = MoreStructures.KindAt(og, x, y, z); if (kind != null) Advancements.Event("chest:" + kind); }
                if (e != null) { G.ui.OpenChest(e); Sfx.Play(Clip.Chest, transform.position, 0.7f); return true; }
                return false;
            }
            if (b.shape == Shape.Door)
            {
                int meta = w.GetMeta(x, y, z);
                bool top = (meta & 8) != 0;
                int by0 = top ? y - 1 : y;
                int m0 = w.GetMeta(x, by0, z);
                bool open = (m0 & 4) != 0;
                int nm = (m0 & 3) | (open ? 0 : 4);
                w.SetBlock(x, by0, z, b, nm); w.SetBlock(x, by0 + 1, z, b, nm | 8);
                Sfx.Play(Clip.Door, new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), 0.7f, open ? 0.8f : 1.1f);
                return true;
            }
            if (b.shape == Shape.Gate)
            {
                int gm = w.GetMeta(x, y, z) ^ 4;
                w.SetMeta(x, y, z, gm);
                Sfx.Play(Clip.Door, new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), 0.6f, (gm & 4) != 0 ? 1.1f : 0.85f);
                return true;
            }
            if (b == B.Bed)
            {
                if (G.sky.IsNight && G.world.dim == Dim.Overworld) { G.SleepInBed(new Vector3(x + 0.5f, y + 1f, z + 0.5f)); }
                else
                {
                    spawnPos = new Vector3(x + 0.5f, y + 1.05f, z + 0.5f); spawnDim = G.world.dim; hasBed = true;
                    G.ui.Toast(G.world.dim == Dim.Overworld ? "Solo puedes dormir de noche. Punto de reaparicion guardado." : "¡La cama explota!");
                    if (G.world.dim != Dim.Overworld) { w.SetBlock(x, y, z, B.Air); G.Explode(new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), 4f, null, true, false); }
                }
                return true;
            }
            if (b == B.Tnt)
            {
                if (!h.IsEmpty && h.item.action == "flint") { Ignite(x, y, z); WearHeld(1); return true; }
                return false;
            }
            if (b == B.EndFrame)
            {
                if (!h.IsEmpty && h.item.key == "eye_of_end" && (w.GetMeta(x, y, z) & 1) == 0)
                {
                    w.SetBlock(x, y, z, B.EndFrame, 1);
                    ConsumeHeld(1);
                    Sfx.Play(Clip.Portal, new Vector3(x, y, z), 0.5f, 1.4f);
                    if (Portals.TryOpenEnd(w, x, y, z)) { G.ui.Toast("¡El portal del Final se ha abierto!"); Sfx.Play(Clip.Portal, transform.position, 1f, 0.6f); }
                    return true;
                }
                return false;
            }
            return false;
        }

        public void WearHeld(int n)
        {
            if (G.creative) return;
            if (inv.slots[inv.selected].Wear(n)) Sfx.Play(Clip.Hit, transform.position, 0.6f, 0.6f);
        }

        public void Ignite(int x, int y, int z)
        {
            W.SetBlock(x, y, z, B.Air);
            PrimedTnt.Spawn(new Vector3(x + 0.5f, y, z + 0.5f), 4f, new Vector3(0, 2f, 0));
        }

        // ---------------------------------------------------------------- usar objeto en mano
        void UseHeldItem(ItemStack h)
        {
            var it = h.item;
            var w = W;
            // semillas y cultivos
            if (it.crop != null)
            {
                if (target.hit && target.face == 2 && B.IsFarmland(target.block) && w.GetBlock(target.x, target.y + 1, target.z).id == 0)
                {
                    w.SetBlock(target.x, target.y + 1, target.z, it.crop, 0);
                    ConsumeHeld(1); Sfx.Block(Snd.Plant, target.point); held.Swing();
                }
                return;
            }
            switch (it.action)
            {
                case "bucket":
                    {
                        var fh = Phys.Raycast(w, camT.position, camT.forward, Reach, true);
                        if (fh.hit && fh.block.fluid && w.GetMeta(fh.x, fh.y, fh.z) == 0)
                        {
                            bool lava = fh.block.isLava;
                            w.SetBlock(fh.x, fh.y, fh.z, B.Air);
                            ReplaceHeld(Items.Get(lava ? "lava_bucket" : "water_bucket"));
                            Sfx.Play(Clip.Splash, transform.position, 0.6f);
                        }
                        return;
                    }
                case "water_bucket":
                case "lava_bucket":
                    {
                        var fh = Phys.Raycast(w, camT.position, camT.forward, Reach, true);
                        if (!fh.hit) return;
                        int px = fh.x, py = fh.y, pz = fh.z;
                        if (!(fh.block.replaceable && fh.block.id != 0)) { px += Block.DX[fh.face]; py += Block.DY[fh.face]; pz += Block.DZ[fh.face]; }
                        var cur = w.GetBlock(px, py, pz);
                        if (!(cur.id == 0 || cur.replaceable)) return;
                        bool lava = it.action == "lava_bucket";
                        if (!lava && w.dim == Dim.Abismo) { Particles.Burst(new Vector3(px + 0.5f, py + 0.5f, pz + 0.5f), new Color32(220, 220, 220, 255), 12, 2f); Sfx.Play(Clip.Fizz, transform.position); ReplaceHeld(Items.Get("bucket")); return; }
                        w.SetBlock(px, py, pz, lava ? B.Lava : B.Water, 0);
                        ReplaceHeld(Items.Get("bucket"));
                        Sfx.Play(Clip.Splash, transform.position, 0.6f);
                        return;
                    }
                case "flint":
                    {
                        if (!target.hit) return;
                        int px = target.x + Block.DX[target.face], py = target.y + Block.DY[target.face], pz = target.z + Block.DZ[target.face];
                        if (target.block == B.Obsidian || target.block == B.Portal)
                        {
                            if (Portals.TryLight(w, px, py, pz)) { Sfx.Play(Clip.Portal, transform.position, 1f); WearHeld(1); held.Swing(); }
                        }
                        else Sfx.Play(Clip.Fizz, transform.position, 0.4f, 1.5f);
                        return;
                    }
                case "bonemeal":
                    if (target.hit) BoneMeal(target.x, target.y, target.z);
                    return;
                case "boat":
                    {
                        var fh = Phys.Raycast(w, camT.position, camT.forward, Reach, true);
                        if (!fh.hit) return;
                        var pos = fh.point + new Vector3(Block.DX[fh.face], Block.DY[fh.face], Block.DZ[fh.face]) * 0.1f;
                        if (fh.block.fluid) pos.y = fh.y + 0.7f;
                        if (Phys.Overlaps(w, AABB.At(pos, 1.4f, 0.5f))) { pos.y += 0.6f; if (Phys.Overlaps(w, AABB.At(pos, 1.4f, 0.5f))) return; }
                        Boat.Spawn(pos, yaw);
                        ConsumeHeld(1); Sfx.Play(Clip.Splash, pos, 0.7f); held.Swing(); placeCooldown = 0.4f;
                        return;
                    }
                case "rod":
                    {
                        if (bobber != null && bobber.Alive) { bobber.Reel(); held.Swing(); placeCooldown = 0.35f; return; }
                        bobber = Bobber.Cast(this);
                        Sfx.Play(Clip.Cast, transform.position, 0.8f); held.Swing(); placeCooldown = 0.35f;
                        return;
                    }
                case "eye":
                    {
                        if (w.dim != Dim.Overworld) return;
                        int fx, fz;
                        Structures.NearestStronghold(G.worldSeed, Mathf.FloorToInt(transform.position.x), Mathf.FloorToInt(transform.position.z), out fx, out fz);
                        Projectile.SpawnEye(Eye + camT.forward * 0.5f, new Vector3(fx, 0, fz), this);
                        ConsumeHeld(1); Sfx.Play(Clip.Whoosh, transform.position);
                        held.Swing();
                        return;
                    }
                case "pearl":
                    Projectile.Spawn(ProjKind.Pearl, Eye + camT.forward * 0.5f, camT.forward * 24f, this, 0);
                    ConsumeHeld(1); Sfx.Play(Clip.Whoosh, transform.position); held.Swing(); placeCooldown = 0.4f;
                    return;
                case "shears": return;
            }
            if (it.key == "snowball" || it.key == "egg")
            {
                Projectile.Spawn(it.key == "egg" ? ProjKind.Egg : ProjKind.Snowball, Eye + camT.forward * 0.5f, camT.forward * 22f, this, 0);
                ConsumeHeld(1); Sfx.Play(Clip.Whoosh, transform.position); held.Swing();
                return;
            }
            // herramientas de suelo
            if (target.hit && (it.tool == ToolKind.Hoe || it.tool == ToolKind.Shovel))
            {
                var tb = target.block;
                bool airAbove = w.GetBlock(target.x, target.y + 1, target.z).id == 0 || w.GetBlock(target.x, target.y + 1, target.z).shape == Shape.Cross;
                if (it.tool == ToolKind.Hoe && target.face != 3 && airAbove && (tb == B.Grass || tb == B.Dirt || tb == B.Path || tb == B.CoarseDirt || tb == B.Podzol))
                {
                    if (w.GetBlock(target.x, target.y + 1, target.z).id != 0) w.SetBlock(target.x, target.y + 1, target.z, B.Air);
                    w.SetBlock(target.x, target.y, target.z, tb == B.CoarseDirt ? B.Dirt : B.Farmland);
                    Sfx.Block(Snd.Dirt, target.point); WearHeld(1); held.Swing();
                    return;
                }
                if (it.tool == ToolKind.Shovel && target.face != 3 && airAbove && (tb == B.Grass || tb == B.Dirt || tb == B.Podzol || tb == B.CoarseDirt))
                {
                    w.SetBlock(target.x, target.y, target.z, B.Path);
                    Sfx.Block(Snd.Dirt, target.point); WearHeld(1); held.Swing();
                    return;
                }
            }
            if (it.block != null) TryPlace(h);
        }

        public void ReplaceHeld(Item to)
        {
            if (G.creative) return;
            if (inv.slots[inv.selected].count <= 1) inv.slots[inv.selected] = new ItemStack(to, 1);
            else { inv.slots[inv.selected].count--; GiveBack(to.key); }
        }

        void BoneMeal(int x, int y, int z)
        {
            var w = W; var b = w.GetBlock(x, y, z);
            bool used = false;
            if (b.shape == Shape.Crop)
            {
                int age = w.GetMeta(x, y, z);
                if (age < 7) { w.SetMeta(x, y, z, Mathf.Min(7, age + G.rand.Range(2, 5))); used = true; }
            }
            else
            {
                for (int i = 0; i < B.Sapling.Length; i++)
                    if (B.Sapling[i] == b) { BlockLogic.RandomTick(w, x, y, z, b); used = true; w.rng.Chance(0.5f); }
                if (b == B.Grass)
                {
                    for (int k = 0; k < 14; k++)
                    {
                        int dx = G.rand.Range(-2, 3), dz = G.rand.Range(-2, 3);
                        int gy = y + 1;
                        if (w.GetBlock(x + dx, y, z + dz) == B.Grass && w.GetBlock(x + dx, gy, z + dz).id == 0)
                            w.SetBlock(x + dx, gy, z + dz, G.rand.Chance(0.15f) ? B.Flowers[G.rand.Int(B.Flowers.Length)] : B.TallGrass);
                    }
                    used = true;
                }
            }
            if (used) { ConsumeHeld(1); Particles.Burst(new Vector3(x + 0.5f, y + 1f, z + 0.5f), new Color32(80, 220, 80, 255), 12, 1.5f, 0.1f, 0.6f); Sfx.Play(Clip.Pop, transform.position, 0.5f, 1.6f); held.Swing(); }
        }

        // ---------------------------------------------------------------- colocar bloques
        void TryPlace(ItemStack h)
        {
            if (!target.hit) return;
            var w = W;
            var blk = h.item.block;
            var tb = target.block;
            int face = target.face;
            int meta = w.GetMeta(target.x, target.y, target.z);
            float fy = target.point.y - target.y;

            // unir losas
            if (blk.shape == Shape.Slab && tb == blk && blk.slabFull != null)
            {
                bool top = (meta & 1) != 0;
                if ((face == 2 && !top) || (face == 3 && top))
                {
                    w.SetBlock(target.x, target.y, target.z, blk.slabFull);
                    ConsumeHeld(1); Sfx.Block(blk.sound, target.point); held.Swing();
                    return;
                }
            }
            int px = target.x, py = target.y, pz = target.z;
            if (!(tb.replaceable && tb.id != 0)) { px += Block.DX[face]; py += Block.DY[face]; pz += Block.DZ[face]; }
            if (py < 0 || py >= 127) return;
            var cur = w.GetBlock(px, py, pz);
            if (!(cur.id == 0 || cur.replaceable)) return;

            int nm = 0;
            switch (blk.shape)
            {
                case Shape.Stairs:
                    nm = FacingIndex();
                    if (face == 3 || (face != 2 && fy > 0.5f && face < 6)) nm |= 4;
                    break;
                case Shape.Slab:
                    if (face == 3 || (face != 2 && fy > 0.5f)) nm = 1;
                    break;
                case Shape.Door:
                    nm = FacingIndex();
                    if (w.GetBlock(px, py + 1, pz).id != 0 && !w.GetBlock(px, py + 1, pz).replaceable) return;
                    if (!w.GetBlock(px, py - 1, pz).Collides) return;
                    break;
                case Shape.Ladder:
                    if (face == 2 || face == 3) return;
                    nm = face == 0 ? 0 : (face == 1 ? 1 : (face == 4 ? 2 : 3));
                    break;
                case Shape.Fence:
                case Shape.Pane:
                    nm = BlockLogic.ConnMeta(w, px, py, pz, blk);
                    break;
                case Shape.Gate:
                    nm = FacingIndex() & 3;
                    break;
                case Shape.Torch:
                    if (face == 3) return;
                    nm = face == 2 ? 0 : (face == 0 ? 1 : face == 1 ? 2 : face == 4 ? 3 : 4);
                    break;
            }
            if (blk.oriented) nm = (FacingIndex() + 2) % 4;
            if (B.IsLeaves(blk)) nm = 1;
            if (blk == B.Bed) nm = 0;

            // no colocar dentro de entidades
            if (blk.Collides)
            {
                var cell = new AABB(px, py, pz, px + 1, py + (blk.shape == Shape.Door ? 2 : 1), pz + 1);
                for (int i = 0; i < Entity.All.Count; i++)
                {
                    var e = Entity.All[i];
                    if (e == null || e is ItemEntity || e is Projectile) continue;
                    if (e.Box.Intersects(cell)) return;
                }
            }
            if (blk.support != Support.None && !BlockLogic.Supported(w, px, py, pz, blk, nm)) return;
            if (blk.shape == Shape.Crop) return;

            if (cur.id != 0 && cur.replaceable && cur.shape != Shape.Fluid && !cur.fluid) { /* sustituye plantas */ }
            w.SetBlock(px, py, pz, blk, nm);
            if (blk.shape == Shape.Door) w.SetBlock(px, py + 1, pz, blk, nm | 8);
            ConsumeHeld(1);
            Sfx.Block(blk.sound, new Vector3(px + 0.5f, py + 0.5f, pz + 0.5f));
            held.Swing();
        }
    }
}
