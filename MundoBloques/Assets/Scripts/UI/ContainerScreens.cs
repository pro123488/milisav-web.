using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace MundoBloques
{
    public enum SlotKind { Normal, Output, Source, Trash }

    public sealed class Slot
    {
        public SlotView view; public ItemStack[] arr; public int idx; public SlotKind kind;
        public Func<ItemStack, bool> accept; public Action changed; public bool player;
        public Func<ItemStack> outGet; public Action outTake; public ItemStack source;
        public ItemStack Get() { return kind == SlotKind.Output ? outGet() : (kind == SlotKind.Source ? source : arr[idx]); }
        public void Set(ItemStack s) { arr[idx] = s; }
        public bool Accepts(ItemStack s) { return accept == null || accept(s); }
    }

    /// <summary>Pantalla con casillas (inventario, mesa de crafteo, horno, cofre, cortapiedras, creativo).</summary>
    public abstract class ContainerScreen
    {
        protected GameUI ui; protected Player p;
        public RectTransform root;
        protected readonly List<Slot> slots = new List<Slot>();
        protected readonly List<UIButton> buttons = new List<UIButton>();
        public ItemStack cursor;
        RawImage cursorIcon; Text cursorCount;
        RectTransform tipRt; Text tipText; Image tipBg;
        public virtual bool CanCloseWithE { get { return true; } }
        protected string title = "";
        protected float W = 560, H = 500;
        readonly List<Slot> hotbarSlots = new List<Slot>();
        protected readonly List<Slot> mainSlots = new List<Slot>();

        public void Init(GameUI ui, Player p, Transform parent)
        {
            this.ui = ui; this.p = p;
            root = UIKit.Centered(parent, "container", W, H);
            var bg = root.gameObject.AddComponent<Image>(); bg.color = UIKit.Panel; bg.raycastTarget = false;
            UIKit.Txt(root, title, 24, Color.white, TextAnchor.MiddleLeft, 18, 8, W - 36, 34);
            Build();
            // cursor y tooltip van siempre al final
            var parentRt = parent as RectTransform;
            var cr = UIKit.Anchored(parent, "cursor", new Vector2(0.5f, 0.5f), 0, 0, 40, 40);
            cr.pivot = new Vector2(0.5f, 0.5f);
            cursorIcon = UIKit.Icon(cr, 0, 0, 40, 40); cursorIcon.enabled = false;
            cursorCount = UIKit.Txt(cr, "", 15, Color.white, TextAnchor.LowerRight, 0, 0, 42, 42);
            tipRt = UIKit.Anchored(parent, "tip", new Vector2(0.5f, 0.5f), 0, 0, 260, 60);
            tipRt.pivot = new Vector2(0f, 1f);
            tipBg = tipRt.gameObject.AddComponent<Image>(); tipBg.color = new Color(0.08f, 0.02f, 0.14f, 0.96f); tipBg.raycastTarget = false;
            tipText = UIKit.Txt(tipRt, "", 16, Color.white, TextAnchor.UpperLeft, 8, 5, 250, 54);
            tipRt.gameObject.SetActive(false);
            cursorTr = cr;
        }

        RectTransform cursorTr;
        protected abstract void Build();

        // ---------------------------------------------------------------- construccion de casillas
        protected Slot AddSlot(ItemStack[] arr, int idx, float x, float y, Func<ItemStack, bool> accept = null, Action changed = null, bool player = false)
        {
            var s = new Slot { arr = arr, idx = idx, view = SlotView.Make(root, x, y, 44f), accept = accept, changed = changed, player = player };
            slots.Add(s);
            return s;
        }

        protected Slot AddOutput(float x, float y, Func<ItemStack> get, Action take)
        {
            var s = new Slot { kind = SlotKind.Output, outGet = get, outTake = take, view = SlotView.Make(root, x, y, 52f) };
            s.view.frame.color = new Color(0.35f, 0.3f, 0.15f, 0.95f);
            slots.Add(s);
            return s;
        }

        protected void AddPlayerInventory(float x, float y, bool armorToo = false)
        {
            for (int r = 0; r < 3; r++)
                for (int c = 0; c < 9; c++)
                {
                    var s = AddSlot(p.inv.slots, 9 + r * 9 + c, x + c * 48, y + r * 48, null, null, true);
                    mainSlots.Add(s);
                }
            for (int c = 0; c < 9; c++) { var s = AddSlot(p.inv.slots, c, x + c * 48, y + 3 * 48 + 10, null, null, true); hotbarSlots.Add(s); mainSlots.Add(s); }
        }

        protected UIButton AddButton(string text, float x, float y, float w, float h, Action click, int size = 16)
        {
            var b = UIButton.Make(root, text, x, y, w, h, click, size);
            buttons.Add(b);
            return b;
        }

        // ---------------------------------------------------------------- bucle
        public virtual void Tick(float dt, Vector2 mouse)
        {
            Slot hover = null;
            for (int i = 0; i < slots.Count; i++)
                if (UIKit.Over(slots[i].view.rt, mouse)) { hover = slots[i]; break; }
            bool left = Inp.MouseDown(0), right = Inp.MouseDown(1);
            bool shift = Inp.Held(Act.Sneak);
            for (int i = 0; i < buttons.Count; i++) buttons[i].Tick(mouse, left);
            bool overUi = false;
            if (hover != null && (left || right)) Click(hover, left ? 0 : 1, shift);
            else if ((left || right) && hover == null && !UIKit.Over(root, mouse) && !OverExtra(mouse) && !cursor.IsEmpty)
            {
                var d = left ? cursor : new ItemStack(cursor.item, 1, cursor.damage);
                cursor.count -= d.count; if (cursor.count <= 0) cursor.Clear();
                var fwd = p.camT.forward;
                GameRoot.I.SpawnItem(p.Eye + fwd * 0.4f, d, fwd * 5f + Vector3.up);
            }
            // intercambio con la barra rapida (1-9)
            if (hover != null && hover.kind == SlotKind.Normal && CanCloseWithE)
                for (int i = 0; i < 9; i++)
                    if (Inp.Pressed(Act.Hotbar1 + i))
                    {
                        var other = hotbarSlots.Count > i ? hotbarSlots[i] : null;
                        if (other != null && other != hover)
                        {
                            var a = hover.Get(); var b = other.Get();
                            if (hover.Accepts(b) && other.Accepts(a)) { hover.Set(b); other.Set(a); hover.changed?.Invoke(); other.changed?.Invoke(); }
                        }
                    }
            for (int i = 0; i < slots.Count; i++) slots[i].view.Show(slots[i].Get());
            for (int i = 0; i < slots.Count; i++) slots[i].view.frame.color = slots[i] == hover ? UIKit.SlotHi : (slots[i].kind == SlotKind.Output ? new Color(0.35f, 0.3f, 0.15f, 0.95f) : UIKit.Slot);
            // cursor
            Vector2 local;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(root.parent as RectTransform, mouse, null, out local);
            cursorIcon.enabled = !cursor.IsEmpty;
            if (!cursor.IsEmpty) { cursorIcon.uvRect = IconAtlas.UV(cursor.item.icon); cursorCount.text = cursor.count > 1 ? cursor.count.ToString() : ""; }
            else cursorCount.text = "";
            cursorTr.anchoredPosition = local + new Vector2(0, 0);
            // tooltip
            string tip = hover != null ? Tooltip(hover.Get()) : ExtraTooltip(mouse);
            if (cursor.IsEmpty && !string.IsNullOrEmpty(tip))
            {
                tipRt.gameObject.SetActive(true);
                tipText.text = tip;
                int lines = tip.Split('\n').Length;
                float w = Mathf.Max(150f, MaxLen(tip) * 8.6f + 16f);
                tipRt.sizeDelta = new Vector2(w, lines * 20f + 12f);
                tipText.rectTransform.sizeDelta = new Vector2(w - 12f, lines * 20f + 6f);
                tipRt.anchoredPosition = local + new Vector2(16, -8);
            }
            else tipRt.gameObject.SetActive(false);
            TickExtra(dt, mouse, left, right);
        }

        static int MaxLen(string s)
        {
            int m = 0;
            foreach (var l in s.Split('\n')) { int n = StripTags(l).Length; if (n > m) m = n; }
            return m;
        }
        static string StripTags(string s)
        {
            var sb = new StringBuilder(); bool tag = false;
            foreach (char c in s) { if (c == '<') tag = true; else if (c == '>') tag = false; else if (!tag) sb.Append(c); }
            return sb.ToString();
        }

        protected virtual void TickExtra(float dt, Vector2 mouse, bool left, bool right) { }
        protected virtual bool OverExtra(Vector2 mouse) { return false; }
        protected virtual string ExtraTooltip(Vector2 mouse) { return null; }

        public static string Tooltip(ItemStack s)
        {
            if (s.IsEmpty) return null;
            var it = s.item;
            var sb = new StringBuilder();
            sb.Append("<b>" + it.name + "</b>");
            if (it.tool != ToolKind.None && it.kind == ItemKind.Tool && it.tool != ToolKind.Shears) sb.Append("\n<color=#9AD>Daño " + it.damage.ToString("0.#") + " · Velocidad " + it.speed.ToString("0.#") + " · Nivel " + it.tier + "</color>");
            if (it.durability > 0) sb.Append("\n<color=#BBB>Durabilidad " + (it.durability - s.damage) + "/" + it.durability + "</color>");
            if (it.IsFood) sb.Append("\n<color=#FA8>Hambre +" + it.hunger + "</color>");
            if (it.armorSlot >= 0) sb.Append("\n<color=#9AD>Defensa +" + it.defense + "</color>");
            if (it.fuel > 0) sb.Append("\n<color=#FC6>Combustible: " + it.fuel.ToString("0") + " s</color>");
            if (it.block != null && it.block.light > 0) sb.Append("\n<color=#FE8>Luz " + it.block.light + "</color>");
            return sb.ToString();
        }

        // ---------------------------------------------------------------- logica de clics
        void Click(Slot s, int button, bool shift)
        {
            Sfx.Play(Clip.Click, p.transform.position, 0.3f, 1.4f);
            if (s.kind == SlotKind.Output) { TakeOutput(s, shift); return; }
            if (s.kind == SlotKind.Source)
            {
                var src = s.source;
                if (src.IsEmpty) return;
                int n = button == 0 ? src.item.maxStack : 1;
                if (shift) { p.inv.Add(new ItemStack(src.item, src.item.maxStack)); return; }
                if (cursor.IsEmpty) cursor = new ItemStack(src.item, n);
                else if (cursor.item == src.item) cursor.count = Mathf.Min(cursor.Max, cursor.count + (button == 0 ? cursor.Max : 1));
                else cursor = new ItemStack(src.item, n);
                return;
            }
            if (s.kind == SlotKind.Trash) { cursor.Clear(); return; }
            var cur = s.Get();
            if (shift && button == 0 && !cur.IsEmpty) { QuickMove(s); s.changed?.Invoke(); return; }
            if (button == 0)
            {
                if (cursor.IsEmpty) { cursor = cur; s.Set(ItemStack.Empty); }
                else if (cur.IsEmpty) { if (s.Accepts(cursor)) { s.Set(cursor); cursor.Clear(); } }
                else if (cur.SameKind(cursor)) { var left = cur.Merge(cursor); s.Set(cur); cursor = left; }
                else if (s.Accepts(cursor)) { s.Set(cursor); cursor = cur; }
            }
            else
            {
                if (cursor.IsEmpty)
                {
                    if (!cur.IsEmpty)
                    {
                        int half = (cur.count + 1) / 2;
                        cursor = new ItemStack(cur.item, half, cur.damage);
                        cur.count -= half; s.Set(cur.count <= 0 ? ItemStack.Empty : cur);
                    }
                }
                else if (cur.IsEmpty)
                {
                    if (s.Accepts(cursor))
                    {
                        s.Set(new ItemStack(cursor.item, 1, cursor.damage));
                        cursor.count--; if (cursor.count <= 0) cursor.Clear();
                    }
                }
                else if (cur.SameKind(cursor) && cur.count < cur.Max)
                {
                    cur.count++; s.Set(cur);
                    cursor.count--; if (cursor.count <= 0) cursor.Clear();
                }
            }
            s.changed?.Invoke();
        }

        void TakeOutput(Slot s, bool shift)
        {
            var res = s.outGet();
            if (res.IsEmpty) return;
            if (shift)
            {
                for (int guard = 0; guard < 80; guard++)
                {
                    res = s.outGet();
                    if (res.IsEmpty) break;
                    var left = p.inv.Add(res);
                    if (!left.IsEmpty) { // devolver lo que no cabe
                        p.inv.Remove(res.item, res.count - left.count); break; }
                    s.outTake();
                }
            }
            else if (cursor.IsEmpty) { cursor = res; s.outTake(); }
            else if (cursor.SameKind(res) && cursor.count + res.count <= cursor.Max) { cursor.count += res.count; s.outTake(); }
            OutputTaken();
        }

        protected virtual void OutputTaken() { }
        protected virtual IEnumerable<Slot> QuickTargets(Slot from) { return null; }

        void QuickMove(Slot s)
        {
            var st = s.Get();
            IEnumerable<Slot> targets;
            if (s.player)
            {
                targets = QuickTargets(s);
                if (targets == null)
                {
                    // dentro del inventario: de hotbar a principal y viceversa
                    var l = new List<Slot>();
                    bool inHot = s.idx < 9;
                    foreach (var m in mainSlots) if (m.arr == p.inv.slots && (inHot ? m.idx >= 9 : m.idx < 9)) l.Add(m);
                    // armadura
                    if (st.item.armorSlot >= 0) foreach (var m in slots) if (m.arr == p.inv.armor && m.Accepts(st) && m.arr[m.idx].IsEmpty) l.Insert(0, m);
                    targets = l;
                }
            }
            else
            {
                var l = new List<Slot>();
                foreach (var m in slots) if (m.player && m.kind == SlotKind.Normal) l.Add(m);
                // primero la barra rapida invertida: mejor principal primero
                l.Sort((a, b) => (b.idx >= 9 ? 1 : 0).CompareTo(a.idx >= 9 ? 1 : 0));
                targets = l;
            }
            foreach (var t in targets)
            {
                if (t == s || !t.Accepts(st) || st.IsEmpty) continue;
                var cur = t.Get();
                if (!cur.IsEmpty && cur.SameKind(st) && cur.count < cur.Max) { var left = cur.Merge(st); t.Set(cur); st = left; t.changed?.Invoke(); }
            }
            foreach (var t in targets)
            {
                if (t == s || !t.Accepts(st) || st.IsEmpty) continue;
                if (t.Get().IsEmpty) { t.Set(st); st = ItemStack.Empty; t.changed?.Invoke(); }
            }
            s.Set(st);
        }

        // ---------------------------------------------------------------- cierre
        public virtual void OnClose()
        {
            if (!cursor.IsEmpty)
            {
                var left = p.inv.Add(cursor);
                if (!left.IsEmpty) GameRoot.I.SpawnItem(p.Eye + p.camT.forward * 0.4f, left, p.camT.forward * 4f);
                cursor.Clear();
            }
        }

        protected void ReturnArray(ItemStack[] arr)
        {
            for (int i = 0; i < arr.Length; i++)
            {
                if (arr[i].IsEmpty) continue;
                var left = p.inv.Add(arr[i]);
                if (!left.IsEmpty) GameRoot.I.SpawnItem(p.Eye + p.camT.forward * 0.4f, left, p.camT.forward * 4f);
                arr[i].Clear();
            }
        }
    }

    // ====================================================================== crafteo
    public class CraftingScreen : ContainerScreen
    {
        readonly int gw, gh; ItemStack[] grid; ItemStack[] outArr = new ItemStack[1];
        CraftRecipe current;
        // libro de recetas
        public static bool bookOpen = true;
        RectTransform bookRt; UITextField search; UIButton onlyBtn; bool onlyCraftable;
        readonly List<CraftRecipe> shown = new List<CraftRecipe>();
        readonly List<SlotView> bookViews = new List<SlotView>();
        int bookScroll; float bookTimer; int hoverRecipe = -1;
        const int Cols = 5, Rows = 7;

        public CraftingScreen(int size, string title) { gw = gh = size; this.title = title; W = size == 3 ? 520 : 520; H = 470; }

        public override bool CanCloseWithE { get { return !(search != null && search.focused); } }

        protected override void Build()
        {
            grid = new ItemStack[gw * gh];
            float gx = gw == 3 ? 90 : 120, gy = gw == 3 ? 56 : 66;
            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++) AddSlot(grid, y * gw + x, gx + x * 48, gy + y * 48, null, Recompute);
            UIKit.Txt(root, "→", 40, Color.white, TextAnchor.MiddleCenter, gx + gw * 48 + 10, gy + (gh * 48) / 2 - 22, 50, 44);
            AddOutput(gx + gw * 48 + 66, gy + (gh * 48) / 2 - 26, () => outArr[0], TakeCraft);
            if (gw == 2)
            {
                // casillas de armadura
                for (int i = 0; i < 4; i++)
                {
                    int slot = i;
                    var s = AddSlot(p.inv.armor, i, 20, 40 + i * 48, st => st.item.armorSlot == slot, null, true);
                    s.player = false;
                }
            }
            AddPlayerInventory(44, 246);
            AddButton("Recetas", W - 110, 8, 92, 28, ToggleBook, 15);
            BuildBook();
        }

        void ToggleBook() { bookOpen = !bookOpen; bookRt.gameObject.SetActive(bookOpen); if (bookOpen) Filter(); }

        void BuildBook()
        {
            bookRt = UIKit.Rect(root, "book", W + 8, 0, 330, H);
            var bg = bookRt.gameObject.AddComponent<Image>(); bg.color = UIKit.Panel; bg.raycastTarget = false;
            UIKit.Txt(bookRt, "Libro de recetas", 22, UIKit.Gold, TextAnchor.MiddleLeft, 14, 6, 300, 30);
            search = UITextField.Make(bookRt, 10, 40, 310, 32, "Buscar objeto..."); search.maxLen = 20;
            onlyBtn = UIButton.Make(bookRt, "Solo con mis materiales: no", 10, 78, 310, 28, () => { onlyCraftable = !onlyCraftable; onlyBtn.label.text = "Solo con mis materiales: " + (onlyCraftable ? "sí" : "no"); bookScroll = 0; Filter(); }, 14);
            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                    bookViews.Add(SlotView.Make(bookRt, 10 + c * 62, 114 + r * 52, 48f));
            UIKit.Txt(bookRt, "Haz clic en una receta para colocar los ingredientes. Rueda para desplazar.", 13, new Color(0.7f, 0.8f, 0.9f), TextAnchor.UpperLeft, 10, 114 + Rows * 52 + 2, 310, 40);
            bookRt.gameObject.SetActive(bookOpen);
            if (bookOpen) Filter();
        }

        bool FitsGrid(CraftRecipe r) { return r.shapeless ? r.list.Count <= gw * gh : (r.w <= gw && r.h <= gh); }

        int[] counts = new int[36];
        bool CanMake(CraftRecipe r)
        {
            if (!FitsGrid(r)) return false;
            for (int i = 0; i < 36; i++) counts[i] = p.inv.slots[i].IsEmpty ? 0 : p.inv.slots[i].count;
            if (r.shapeless) { foreach (var ing in r.list) if (!Take(ing)) return false; }
            else foreach (var ing in r.cells) if (ing != null && !Take(ing)) return false;
            return true;
        }
        bool Take(string ing)
        {
            for (int i = 0; i < 36; i++) if (counts[i] > 0 && Recipes.IngredientMatches(ing, p.inv.slots[i].item)) { counts[i]--; return true; }
            return false;
        }

        void Filter()
        {
            shown.Clear();
            string q = search != null ? search.value.Trim().ToLowerInvariant() : "";
            foreach (var r in Recipes.Craft)
            {
                if (r.output == null) continue;
                if (q.Length > 0 && r.output.name.ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0) continue;
                if (onlyCraftable && !CanMake(r)) continue;
                shown.Add(r);
            }
            // lo fabricable primero
            var good = new List<CraftRecipe>(); var rest = new List<CraftRecipe>();
            foreach (var r in shown) (CanMake(r) ? good : rest).Add(r);
            shown.Clear(); shown.AddRange(good); shown.AddRange(rest);
        }

        public override void Tick(float dt, Vector2 mouse)
        {
            base.Tick(dt, mouse);
        }

        protected override bool OverExtra(Vector2 mouse) { return bookOpen && UIKit.Over(bookRt, mouse); }

        protected override void TickExtra(float dt, Vector2 mouse, bool left, bool right)
        {
            if (!bookOpen) return;
            search.Tick(mouse, left);
            onlyBtn.Tick(mouse, left);
            bookTimer -= dt;
            if (bookTimer <= 0f) { bookTimer = 0.5f; Filter(); }
            string prev = lastSearch;
            if (search.value != lastSearch) { lastSearch = search.value; bookScroll = 0; Filter(); }
            if (UIKit.Over(bookRt, mouse) && Mathf.Abs(Inp.Scroll) > 0.1f)
            {
                int maxScroll = Mathf.Max(0, (shown.Count + Cols - 1) / Cols - Rows);
                bookScroll = Mathf.Clamp(bookScroll - (int)Mathf.Sign(Inp.Scroll), 0, maxScroll);
            }
            hoverRecipe = -1;
            for (int i = 0; i < bookViews.Count; i++)
            {
                int ri = bookScroll * Cols + i;
                if (ri >= shown.Count) { bookViews[i].Show(ItemStack.Empty); bookViews[i].frame.color = new Color(0.18f, 0.18f, 0.2f, 0.6f); continue; }
                var r = shown[ri];
                bookViews[i].Show(new ItemStack(r.output, r.outCount));
                bool can = CanMake(r);
                bool over = UIKit.Over(bookViews[i].rt, mouse);
                bookViews[i].frame.color = over ? UIKit.SlotHi : (can ? new Color(0.25f, 0.4f, 0.25f, 0.95f) : new Color(0.3f, 0.18f, 0.18f, 0.9f));
                if (over) { hoverRecipe = ri; if (left && can && cursor.IsEmpty) AutoFill(r); else if (left && !can) { var gui = GameRoot.I.ui; gui.Toast(FitsGrid(r) ? "Te faltan ingredientes." : "Necesitas una mesa de crafteo."); } }
            }
        }

        string lastSearch = "";

        protected override string ExtraTooltip(Vector2 mouse)
        {
            if (!bookOpen || hoverRecipe < 0 || hoverRecipe >= shown.Count) return null;
            var r = shown[hoverRecipe];
            var sb = new StringBuilder();
            sb.Append("<b>" + r.output.name + "</b> ×" + r.outCount + (FitsGrid(r) ? "" : "  <color=#F88>(mesa de crafteo)</color>"));
            var need = new Dictionary<string, int>();
            Action<string> add = ing =>
            {
                string n = ing[0] == '#' ? TagName(ing) : Items.Get(ing).name;
                need[n] = need.ContainsKey(n) ? need[n] + 1 : 1;
            };
            if (r.shapeless) foreach (var i in r.list) add(i); else foreach (var i in r.cells) if (i != null) add(i);
            foreach (var kv in need) sb.Append("\n· " + kv.Value + " × " + kv.Key);
            return sb.ToString();
        }

        static string TagName(string ing)
        {
            switch (ing)
            {
                case "#planks": return "Tablones (cualquiera)";
                case "#logs": return "Troncos (cualquiera)";
                case "#wool": return "Lana (cualquiera)";
                case "#stone_tool_materials": return "Roca / pizarra adoquinada";
                case "#coals": return "Carbón o carbón vegetal";
                case "#sand": return "Arena";
                case "#meat": return "Carne cocinada";
                default: return ing;
            }
        }

        void AutoFill(CraftRecipe r)
        {
            // devolver lo que hay en la cuadricula
            for (int i = 0; i < grid.Length; i++)
                if (!grid[i].IsEmpty) { var left = p.inv.Add(grid[i]); grid[i] = left; }
            for (int i = 0; i < grid.Length; i++) if (!grid[i].IsEmpty) { GameRoot.I.SpawnItem(p.Eye, grid[i], Vector3.up * 2f); grid[i].Clear(); }
            if (r.shapeless)
            {
                int gi = 0;
                foreach (var ing in r.list) { if (!PullInto(ing, gi)) break; gi++; }
            }
            else
            {
                for (int y = 0; y < r.h; y++)
                    for (int x = 0; x < r.w; x++)
                    {
                        var ing = r.cells[y * r.w + x];
                        if (ing != null) PullInto(ing, y * gw + x);
                    }
            }
            Recompute();
        }

        bool PullInto(string ing, int gridIndex)
        {
            for (int i = 0; i < 36; i++)
            {
                var s = p.inv.slots[i];
                if (s.IsEmpty || !Recipes.IngredientMatches(ing, s.item)) continue;
                grid[gridIndex] = new ItemStack(s.item, 1, s.damage);
                p.inv.slots[i].count--; if (p.inv.slots[i].count <= 0) p.inv.slots[i].Clear();
                return true;
            }
            return false;
        }

        void Recompute()
        {
            current = Recipes.Find(grid, gw, gh);
            outArr[0] = current != null ? new ItemStack(current.output, current.outCount) : ItemStack.Empty;
        }

        void TakeCraft()
        {
            if (current != null) Advancements.Event("craft:" + current.outKey);
            for (int i = 0; i < grid.Length; i++)
            {
                if (grid[i].IsEmpty) continue;
                grid[i].count--;
                if (grid[i].count <= 0) grid[i].Clear();
            }
            Sfx.Play(Clip.Pop, p.transform.position, 0.4f, 1.3f);
            Recompute();
        }

        protected override void OutputTaken() { Recompute(); }

        protected override IEnumerable<Slot> QuickTargets(Slot from) { return null; }

        public override void OnClose()
        {
            ReturnArray(grid);
            base.OnClose();
        }
    }

    // ====================================================================== horno
    public sealed class FurnaceScreen : ContainerScreen
    {
        readonly FurnaceEntity f; Image flame, arrow;
        public FurnaceScreen(FurnaceEntity f) { this.f = f; title = "Horno"; W = 520; H = 440; }

        protected override void Build()
        {
            AddSlot(f.slots, 0, 150, 56, st => Recipes.FindSmelt(st.item) != null);
            AddSlot(f.slots, 1, 150, 150, st => st.item.fuel > 0);
            AddOutput(330, 100, () => f.slots[2], () => { if (!f.slots[2].IsEmpty) Advancements.Event("smelt:" + f.slots[2].item.key); f.slots[2].Clear(); });
            // el slot de salida debe permitir tomar todo el stack
            UIKit.Txt(root, "Ingrediente", 15, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleLeft, 200, 66, 120, 24);
            UIKit.Txt(root, "Combustible", 15, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleLeft, 200, 160, 120, 24);
            var fb = UIKit.Img(root, "fb", 156, 104, 32, 40, new Color(0, 0, 0, 0.5f));
            flame = UIKit.Img(root, "flame", 156, 144, 32, 0, new Color(1f, 0.55f, 0.1f, 1f));
            var ab = UIKit.Img(root, "ab", 210, 108, 90, 14, new Color(0, 0, 0, 0.5f));
            arrow = UIKit.Img(root, "arrow", 210, 108, 0, 14, new Color(0.9f, 0.9f, 0.9f, 1f));
            AddPlayerInventory(44, 230 - 10);
        }

        public override void Tick(float dt, Vector2 mouse)
        {
            base.Tick(dt, mouse);
            float b = f.burnMax > 0 ? Mathf.Clamp01(f.burn / f.burnMax) : 0;
            flame.rectTransform.sizeDelta = new Vector2(32, 40 * b);
            flame.rectTransform.anchoredPosition = new Vector2(156, -(144 - 40 * b));
            arrow.rectTransform.sizeDelta = new Vector2(90f * Mathf.Clamp01(f.cook / Mathf.Max(1f, f.cookTotal)), 14);
        }

        public override void OnClose() { base.OnClose(); GameRoot.I.world.MarkModified(f.x, f.z); }

        protected override IEnumerable<Slot> QuickTargets(Slot from)
        {
            var st = from.Get();
            var l = new List<Slot>();
            foreach (var s in slots)
            {
                if (s.player || s.kind != SlotKind.Normal) continue;
                if (s.Accepts(st)) l.Add(s);
            }
            // preferir entrada si se puede fundir, si no combustible
            if (Recipes.FindSmelt(st.item) != null) l.Sort((a, b) => a.idx.CompareTo(b.idx)); else l.Sort((a, b) => b.idx.CompareTo(a.idx));
            return l;
        }
    }

    // ====================================================================== cofre
    public sealed class ChestScreen : ContainerScreen
    {
        readonly ChestEntity c;
        public ChestScreen(ChestEntity c) { this.c = c; title = "Cofre"; W = 500; H = 470; }
        protected override void Build()
        {
            for (int r = 0; r < 3; r++) for (int col = 0; col < 9; col++) AddSlot(c.slots, r * 9 + col, 34 + col * 48, 50 + r * 48);
            UIKit.Txt(root, "Inventario", 18, new Color(0.8f, 0.9f, 1f), TextAnchor.MiddleLeft, 34, 202, 200, 24);
            AddPlayerInventory(34, 230);
        }
        public override void OnClose() { base.OnClose(); GameRoot.I.world.MarkModified(c.x, c.z); }
        protected override IEnumerable<Slot> QuickTargets(Slot from)
        {
            var l = new List<Slot>();
            foreach (var s in slots) if (!s.player && s.kind == SlotKind.Normal) l.Add(s);
            return l;
        }
    }

    // ====================================================================== cortapiedras
    public sealed class StonecutterScreen : ContainerScreen
    {
        ItemStack[] input = new ItemStack[1];
        int selected = -1; int scroll;
        List<CutRecipe> cuts = new List<CutRecipe>();
        readonly List<SlotView> views = new List<SlotView>();
        RectTransform listRt;
        string tip;

        public StonecutterScreen() { title = "Cortapiedras"; W = 560; H = 440; }

        protected override void Build()
        {
            AddSlot(input, 0, 30, 70, st => Recipes.CutsFor(st.item) != null, OnInput);
            UIKit.Txt(root, "Material", 15, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleCenter, 14, 118, 76, 22);
            listRt = UIKit.Rect(root, "list", 100, 46, 340, 150);
            var bg = listRt.gameObject.AddComponent<Image>(); bg.color = new Color(0, 0, 0, 0.3f); bg.raycastTarget = false;
            for (int r = 0; r < 3; r++) for (int c = 0; c < 6; c++) views.Add(SlotView.Make(listRt, 4 + c * 55, 4 + r * 48, 46f));
            AddOutput(470, 70, () => selected >= 0 && selected < cuts.Count && !input[0].IsEmpty ? new ItemStack(Items.Get(cuts[selected].output), cuts[selected].count) : ItemStack.Empty, TakeCut);
            UIKit.Txt(root, "Resultado", 15, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleCenter, 452, 126, 90, 22);
            UIKit.Txt(root, "Escaleras, losas y bloques pulidos con un solo material.", 14, new Color(0.7f, 0.8f, 0.9f), TextAnchor.UpperLeft, 100, 200, 340, 22);
            AddPlayerInventory(44, 226 + 10);
        }

        void OnInput()
        {
            cuts = input[0].IsEmpty ? new List<CutRecipe>() : (Recipes.CutsFor(input[0].item) ?? new List<CutRecipe>());
            selected = cuts.Count > 0 ? 0 : -1; scroll = 0;
        }

        void TakeCut()
        {
            input[0].count--; if (input[0].count <= 0) { input[0].Clear(); OnInput(); }
            Sfx.Play(Clip.Door, p.transform.position, 0.4f, 1.5f);
        }

        protected override bool OverExtra(Vector2 mouse) { return UIKit.Over(listRt, mouse); }

        protected override void TickExtra(float dt, Vector2 mouse, bool left, bool right)
        {
            int total = cuts.Count;
            if (UIKit.Over(listRt, mouse) && Mathf.Abs(Inp.Scroll) > 0.1f) scroll = Mathf.Clamp(scroll - (int)Mathf.Sign(Inp.Scroll), 0, Mathf.Max(0, (total + 5) / 6 - 3));
            tip = null;
            for (int i = 0; i < views.Count; i++)
            {
                int ri = scroll * 6 + i;
                if (ri >= total) { views[i].Show(ItemStack.Empty); views[i].frame.color = new Color(0.15f, 0.15f, 0.17f, 0.6f); continue; }
                var it = Items.Get(cuts[ri].output);
                views[i].Show(new ItemStack(it, cuts[ri].count));
                bool over = UIKit.Over(views[i].rt, mouse);
                views[i].frame.color = ri == selected ? new Color(0.4f, 0.6f, 0.9f, 1f) : (over ? UIKit.SlotHi : UIKit.Slot);
                if (over) { tip = "<b>" + it.name + "</b> ×" + cuts[ri].count; if (left) { selected = ri; Sfx.Play(Clip.Click, p.transform.position, 0.4f); } }
            }
        }

        protected override string ExtraTooltip(Vector2 mouse) { return tip; }

        protected override IEnumerable<Slot> QuickTargets(Slot from)
        {
            var l = new List<Slot>();
            foreach (var s in slots) if (!s.player && s.kind == SlotKind.Normal && s.Accepts(from.Get())) l.Add(s);
            return l;
        }

        public override void OnClose() { ReturnArray(input); base.OnClose(); }
    }

    // ====================================================================== comercio
    public sealed class TradeScreen : ContainerScreen
    {
        readonly Mob mob; readonly Villager v;
        readonly List<RectTransform> rows = new List<RectTransform>();
        readonly List<SlotView> aViews = new List<SlotView>(), bViews = new List<SlotView>(), sViews = new List<SlotView>();
        readonly List<Image> rowBg = new List<Image>();
        string tip;

        public TradeScreen(Mob m) { mob = m; v = m.villager; title = "Aldeano · " + v.profession; W = 560; H = 520; }
        public override bool CanCloseWithE { get { return true; } }

        protected override void Build()
        {
            UIKit.Txt(root, "Haz clic en un trato para comerciar. Las esmeraldas son la moneda.", 15, new Color(0.8f, 0.9f, 1f), TextAnchor.UpperLeft, 18, 40, 520, 22);
            for (int i = 0; i < v.trades.Count; i++)
            {
                var t = v.trades[i];
                var row = UIKit.Rect(root, "row", 18, 70 + i * 60, 524, 54);
                var bg = row.gameObject.AddComponent<Image>(); bg.color = new Color(0.16f, 0.18f, 0.24f, 1f); bg.raycastTarget = false;
                rows.Add(row); rowBg.Add(bg);
                var a = SlotView.Make(row, 10, 5, 44f); aViews.Add(a); a.Show(new ItemStack(Items.Get(t.buyA), t.countA));
                var b = SlotView.Make(row, 64, 5, 44f); bViews.Add(b); b.Show(t.buyB != null ? new ItemStack(Items.Get(t.buyB), t.countB) : ItemStack.Empty);
                if (t.buyB == null) { b.frame.color = new Color(0, 0, 0, 0); }
                UIKit.Txt(row, "→", 30, Color.white, TextAnchor.MiddleCenter, 116, 0, 50, 54);
                var s = SlotView.Make(row, 176, 5, 44f); sViews.Add(s); s.Show(new ItemStack(Items.Get(t.sell), t.countSell));
                UIKit.Txt(row, Items.Get(t.sell).name + " ×" + t.countSell, 18, Color.white, TextAnchor.MiddleLeft, 232, 0, 230, 54);
            }
            AddPlayerInventory(44, 380 - 4);
        }

        protected override bool OverExtra(Vector2 mouse) { return false; }

        protected override void TickExtra(float dt, Vector2 mouse, bool left, bool right)
        {
            tip = null;
            for (int i = 0; i < rows.Count; i++)
            {
                var t = v.trades[i];
                bool can = v.CanDo(p, t);
                bool over = UIKit.Over(rows[i], mouse);
                rowBg[i].color = !t.Available ? new Color(0.25f, 0.1f, 0.1f, 1f) : (over ? new Color(0.28f, 0.34f, 0.46f, 1f) : (can ? new Color(0.17f, 0.28f, 0.2f, 1f) : new Color(0.16f, 0.18f, 0.24f, 1f)));
                if (over)
                {
                    tip = !t.Available ? "<color=#F88>Agotado</color>" : (can ? "<color=#8F8>¡Clic para comerciar!</color>" : "<color=#F99>Te faltan materiales</color>");
                    tip += "\nUsos: " + t.uses + "/" + t.maxUses;
                    if (left)
                    {
                        bool onSlot = false;
                        if (!onSlot && v.Do(p, t)) { }
                        else if (!can) Sfx.Play(Clip.Hurt, p.transform.position, 0.3f, 1.6f);
                    }
                }
            }
        }

        protected override string ExtraTooltip(Vector2 mouse) { return tip; }
        public override void OnClose() { v.trading = false; base.OnClose(); }
    }

    // ====================================================================== creativo
    public sealed class CreativeScreen : ContainerScreen
    {
        static readonly string[] cats = { "Bloques", "Naturaleza", "Funcional", "Menas y gemas", "Herramientas", "Armadura", "Comida", "Materiales", "Criaturas" };
        int cat; int scroll;
        readonly List<Item> list = new List<Item>();
        readonly List<MobDef> mobList = new List<MobDef>();
        readonly List<Slot> palette = new List<Slot>();
        UITextField search; string lastSearch = "";
        const int Cols = 11, Rows = 5;
        readonly List<UIButton> mobButtons = new List<UIButton>();
        readonly List<UIButton> catButtons = new List<UIButton>();
        Text catLabel;

        public CreativeScreen() { title = "Modo creativo"; W = 620; H = 560; }
        public override bool CanCloseWithE { get { return !search.focused; } }

        protected override void Build()
        {
            for (int i = 0; i < cats.Length; i++)
            {
                int ci = i;
                var b = AddButton(cats[i], 14 + i * 66, 44, 64, 26, () => { cat = ci; scroll = 0; Refill(); }, 11);
                catButtons.Add(b);
            }
            search = UITextField.Make(root, 14, 76, 590, 28, "Buscar por nombre..."); search.maxLen = 24;
            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                {
                    var s = new Slot { kind = SlotKind.Source, view = SlotView.Make(root, 14 + c * 54, 112 + r * 52, 48f) };
                    slots.Add(s); palette.Add(s);
                }
            catLabel = UIKit.Txt(root, "", 16, new Color(0.8f, 0.9f, 1f), TextAnchor.MiddleLeft, 14, 376, 400, 24);
            // barra rapida del jugador + basura
            for (int c = 0; c < 9; c++) AddSlot(p.inv.slots, c, 14 + c * 54, 410, null, null, true);
            var trash = new Slot { kind = SlotKind.Trash, view = SlotView.Make(root, 14 + 10 * 54, 410, 48f) };
            trash.view.frame.color = new Color(0.4f, 0.12f, 0.12f, 0.95f); slots.Add(trash);
            UIKit.Txt(root, "Papelera", 12, new Color(1f, 0.7f, 0.7f), TextAnchor.UpperCenter, 14 + 10 * 54 - 6, 458, 62, 20);
            UIKit.Txt(root, "Clic: pila entera · Clic der.: uno · Mayús+clic: al inventario · Rueda: desplazar", 13, new Color(0.7f, 0.8f, 0.9f), TextAnchor.UpperLeft, 14, 470, 590, 22);
            // criaturas
            foreach (var d in MobDefs.Each()) mobList.Add(d);
            for (int i = 0; i < mobList.Count && i < 30; i++)
            {
                var d = mobList[i];
                var b = UIButton.Make(root, d.name, 14 + (i % 5) * 118, 116 + (i / 5) * 34, 114, 30, () => { SpawnMob(d); }, 14);
                mobButtons.Add(b);
            }
            Refill();
        }

        void SpawnMob(MobDef d)
        {
            var f = p.camT.forward; f.y = 0; f.Normalize();
            var pos = p.transform.position + f * 3f;
            GameRoot.I.SpawnMob(d.key, pos);
            GameRoot.I.ui.Toast(d.name + " aparece.");
        }

        void Refill()
        {
            list.Clear();
            string q = search != null ? search.value.Trim().ToLowerInvariant() : "";
            bool creatures = cats[cat] == "Criaturas";
            if (!creatures)
            {
                foreach (var it in Items.All)
                {
                    if (q.Length > 0) { if (it.name.ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0) continue; }
                    else if (it.category != cats[cat]) continue;
                    list.Add(it);
                }
            }
            foreach (var b in mobButtons) b.rt.gameObject.SetActive(creatures && q.Length == 0);
            foreach (var s in palette) s.view.rt.gameObject.SetActive(!(creatures && q.Length == 0));
            catLabel.text = (q.Length > 0 ? "Resultados" : cats[cat]) + (creatures ? "" : " (" + list.Count + ")");
            for (int i = 0; i < catButtons.Count; i++) catButtons[i].normal = i == cat ? new Color(0.35f, 0.5f, 0.8f, 1f) : UIKit.Btn;
        }

        protected override void TickExtra(float dt, Vector2 mouse, bool left, bool right)
        {
            search.Tick(mouse, left);
            if (search.value != lastSearch) { lastSearch = search.value; scroll = 0; Refill(); }
            bool creatures = cats[cat] == "Criaturas" && search.value.Trim().Length == 0;
            foreach (var b in mobButtons) b.Tick(mouse, left);
            if (Mathf.Abs(Inp.Scroll) > 0.1f)
            {
                int maxS = Mathf.Max(0, (list.Count + Cols - 1) / Cols - Rows);
                scroll = Mathf.Clamp(scroll - (int)Mathf.Sign(Inp.Scroll), 0, maxS);
            }
            for (int i = 0; i < palette.Count; i++)
            {
                int idx = scroll * Cols + i;
                palette[i].source = idx < list.Count ? new ItemStack(list[idx], 1) : ItemStack.Empty;
            }
        }
        protected override bool OverExtra(Vector2 mouse) { return false; }
    }
}
