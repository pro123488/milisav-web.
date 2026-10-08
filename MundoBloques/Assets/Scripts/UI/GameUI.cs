using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace MundoBloques
{
    /// <summary>Vista de una casilla de inventario (icono, cantidad, barra de durabilidad).</summary>
    public sealed class SlotView
    {
        public RectTransform rt; public Image frame; public RawImage icon; public Text count; public Image bar, barBg;
        public float size;

        public static SlotView Make(Transform parent, float x, float y, float size = 44f, bool frame = true)
        {
            var v = new SlotView { size = size };
            v.rt = UIKit.Rect(parent, "slot", x, y, size, size);
            v.frame = v.rt.gameObject.AddComponent<Image>();
            v.frame.color = frame ? UIKit.Slot : new Color(0, 0, 0, 0); v.frame.raycastTarget = false;
            float pad = size * 0.1f;
            v.icon = UIKit.Icon(v.rt, pad, pad, size - pad * 2, size - pad * 2);
            v.icon.enabled = false;
            v.count = UIKit.Txt(v.rt, "", 15, Color.white, TextAnchor.LowerRight, 0, -1, size - 3, size);
            v.barBg = UIKit.Img(v.rt, "bg", 5, size - 7, size - 10, 3, new Color(0, 0, 0, 0.8f)); v.barBg.enabled = false;
            v.bar = UIKit.Img(v.rt, "bar", 5, size - 7, size - 10, 3, Color.green); v.bar.enabled = false;
            return v;
        }

        public void Show(ItemStack s)
        {
            if (s.IsEmpty) { icon.enabled = false; count.text = ""; bar.enabled = false; barBg.enabled = false; return; }
            icon.enabled = true;
            icon.uvRect = IconAtlas.UV(s.item.icon);
            count.text = s.count > 1 ? s.count.ToString() : "";
            if (s.item.durability > 0 && s.damage > 0)
            {
                float f = 1f - (float)s.damage / s.item.durability;
                barBg.enabled = true; bar.enabled = true;
                bar.rectTransform.sizeDelta = new Vector2((size - 10f) * Mathf.Clamp01(f), 3);
                bar.color = Color.Lerp(Color.red, Color.green, f);
            }
            else { bar.enabled = false; barBg.enabled = false; }
        }
    }

    /// <summary>Interfaz del juego: HUD, menus, pantallas de contenedor, carga, muerte y victoria.</summary>
    public sealed partial class GameUI : MonoBehaviour
    {
        Canvas canvas;
        RectTransform root, hudRoot, screenRoot, overlayRoot;
        public bool IsOpen { get { return container != null || pauseOpen || deathOpen || victoryOpen || mapOpen || advOpen; } }

        // HUD
        SlotView[] hotbar = new SlotView[9];
        Image hotbarSel;
        Image[] hearts = new Image[10], food = new Image[10], armorI = new Image[10], bubbles = new Image[10];
        RawImage[] heartsR = new RawImage[10], foodR = new RawImage[10], armorR = new RawImage[10], bubblesR = new RawImage[10];
        Text itemName, debugText, bossText, pickupText;
        Image bossBg, bossFill;
        Image flashImg, portalImg, waterImg;
        Color flashColor; float flashT;
        float itemNameT; Item lastHeld;
        bool showDebug;
        readonly List<Text> toasts = new List<Text>();
        readonly List<float> toastT = new List<float>();
        float pickupT; Item pickupItem; int pickupCount;
        string bossName; float bossFrac;
        float fpsT, fps; int fpsN;
        RawImage crossH;
        Text hintText; float hintT;

        public void Build()
        {
            var cgo = new GameObject("Canvas");
            cgo.transform.SetParent(transform, false);
            canvas = cgo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 100;
            var cs = cgo.AddComponent<CanvasScaler>();
            cs.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            cs.referenceResolution = new Vector2(1280, 720); cs.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight; cs.matchWidthOrHeight = 0.5f;
            root = cgo.GetComponent<RectTransform>();
            hudRoot = NewLayer("HUD"); screenRoot = NewLayer("Screens"); overlayRoot = NewLayer("Overlay");
            BuildHud();
            BuildMenus();
            BuildContainers();
            BuildMap();
        }

        RectTransform NewLayer(string name)
        {
            var rt = UIKit.Rect(root, name, 0, 0, 0, 0);
            UIKit.Stretch(rt);
            return rt;
        }

        // ================================================================== HUD
        void BuildHud()
        {
            // hotbar
            var hb = UIKit.Anchored(hudRoot, "hotbar", new Vector2(0.5f, 0f), 0, 8, 9 * 44 + 8, 52);
            var bg = hb.gameObject.AddComponent<Image>(); bg.color = new Color(0, 0, 0, 0.35f); bg.raycastTarget = false;
            hotbarSel = UIKit.Img(hb, "sel", 0, 0, 52, 52, new Color(1, 1, 1, 0.95f));
            for (int i = 0; i < 9; i++) hotbar[i] = SlotView.Make(hb, 4 + i * 44, 4, 44f);
            // corazones, hambre, armadura, burbujas
            for (int i = 0; i < 10; i++)
            {
                heartsR[i] = HudIcon(i * 19 - 194, 52, "ui_heart_full", 0);
                foodR[i] = HudIcon(176 - i * 19, 52, "ui_food_full", 0);
                armorR[i] = HudIcon(i * 19 - 194, 72, "ui_armor", 0);
                bubblesR[i] = HudIcon(176 - i * 19, 72, "ui_bubble", 0);
            }
            itemName = UIKit.Txt(UIKit.Anchored(hudRoot, "n", new Vector2(0.5f, 0f), 0, 102, 500, 30), "", 20, Color.white, TextAnchor.MiddleCenter, 0, 0, 500, 30);
            pickupText = UIKit.Txt(UIKit.Anchored(hudRoot, "p", new Vector2(1f, 0.5f), -10, -40, 380, 26), "", 17, new Color(0.8f, 1f, 0.8f), TextAnchor.MiddleRight, 0, 0, 380, 26);
            // mira
            var ch = UIKit.Centered(hudRoot, "cross", 20, 20);
            var h = UIKit.Img(ch, "h", 2, 9, 16, 2, new Color(1, 1, 1, 0.8f)); var v = UIKit.Img(ch, "v", 9, 2, 2, 16, new Color(1, 1, 1, 0.8f));
            hintText = UIKit.Txt(UIKit.Anchored(hudRoot, "hint", new Vector2(0.5f, 0.5f), 0, -70, 700, 30), "", 22, new Color(1f, 0.95f, 0.7f), TextAnchor.MiddleCenter, 0, 0, 700, 30);
            debugText = UIKit.Txt(UIKit.Rect(hudRoot, "dbg", 8, 6, 560, 300), "", 15, Color.white, TextAnchor.UpperLeft, 0, 0, 560, 300);
            debugText.gameObject.SetActive(false);
            // barra del jefe
            var bossRt = UIKit.Anchored(hudRoot, "boss", new Vector2(0.5f, 1f), 0, -40, 520, 40);
            bossText = UIKit.Txt(bossRt, "", 18, new Color(1f, 0.6f, 1f), TextAnchor.UpperCenter, 0, 0, 520, 22);
            bossBg = UIKit.Img(bossRt, "bg", 0, 24, 520, 10, new Color(0, 0, 0, 0.7f));
            bossFill = UIKit.Img(bossRt, "fill", 0, 24, 520, 10, new Color(0.8f, 0.2f, 0.9f, 1f));
            bossRt.gameObject.SetActive(false);
            // overlays
            waterImg = FullScreen(overlayRoot, new Color(0.1f, 0.3f, 0.7f, 0f));
            portalImg = FullScreen(overlayRoot, new Color(0.45f, 0.1f, 0.8f, 0f));
            flashImg = FullScreen(overlayRoot, new Color(1, 0, 0, 0));
        }

        Image FullScreen(Transform parent, Color c)
        {
            var rt = UIKit.Rect(parent, "full", 0, 0, 0, 0);
            UIKit.Stretch(rt);
            var im = rt.gameObject.AddComponent<Image>(); im.color = c; im.raycastTarget = false;
            return im;
        }

        RawImage HudIcon(float x, float y, string ui, int dummy)
        {
            var rt = UIKit.Anchored(hudRoot, ui, new Vector2(0.5f, 0f), x + 9, y + 9, 18, 18);
            var r = rt.gameObject.AddComponent<RawImage>(); r.texture = IconAtlas.Texture; r.raycastTarget = false;
            r.uvRect = IconAtlas.UV(IconAtlas.Ui(ui));
            return r;
        }

        public void Toast(string msg)
        {
            var rt = UIKit.Anchored(hudRoot, "toast", new Vector2(0f, 0f), 12, 0, 600, 24);
            var t = UIKit.Txt(rt, msg, 18, new Color(1f, 0.95f, 0.6f), TextAnchor.LowerLeft, 0, 0, 600, 24);
            toasts.Add(t); toastT.Add(5.5f);
            if (toasts.Count > 5) { Destroy(toasts[0].transform.parent.gameObject); toasts.RemoveAt(0); toastT.RemoveAt(0); }
        }

        /// <summary>Mensaje breve bajo la mira (avisos de pesca, montar, mascotas...).</summary>
        public void Hint(string msg, float secs = 2f) { if (hintText == null) return; hintText.text = msg; hintT = secs; }

        public void Flash(Color c) { flashColor = c; flashT = 1f; }
        public void SetPortalOverlay(float a) { portalImg.color = new Color(0.45f, 0.1f, 0.8f, a * 0.6f); }
        public void SetBoss(string name, float frac) { bossName = name; bossFrac = frac; }
        public void OnPickup(Item it, int n)
        {
            if (pickupItem == it && pickupT > 0) pickupCount += n; else { pickupItem = it; pickupCount = n; }
            pickupT = 2f;
        }
        public void OnSessionStart()
        {
            showDebug = false; debugText.gameObject.SetActive(false);
            Toast(GameRoot.I.creative ? "Modo creativo: pulsa E para el menú de objetos; doble salto para volar." : "Pulsa E para el inventario y el libro de recetas. ¡Sobrevive!");
            itemNameT = 0; lastHeld = null;
        }

        // ================================================================== bucle
        public void Tick(float dt)
        {
            var g = GameRoot.I;
            var mouse = Inp.MousePos;
            bool click = Inp.MouseDown(0);
            TickMenus(dt, mouse, click);
            if (g.state != GameState.Playing || g.player == null) { hudRoot.gameObject.SetActive(false); return; }
            hudRoot.gameObject.SetActive(true);
            var p = g.player;

            // teclas globales
            if (!deathOpen && !victoryOpen)
            {
                if (Inp.Pressed(Act.Pause))
                {
                    if (mapOpen) CloseMap();
                    else if (advOpen) CloseAdv();
                    else if (container != null) CloseContainer();
                    else if (pauseOpen) ClosePause();
                    else OpenPause();
                }
                else if (Inp.Pressed(Act.Inventory) && !pauseOpen && !mapOpen && !advOpen && (container == null || container.CanCloseWithE))
                {
                    if (container != null) CloseContainer();
                    else if (g.creative) OpenCreative(); else OpenInventory();
                }
                else if (Inp.Pressed(Act.Map) && !pauseOpen && !advOpen && container == null)
                {
                    if (mapOpen) CloseMap(); else OpenMap();
                }
                else if (Inp.Pressed(Act.Advancements) && !pauseOpen && !mapOpen && container == null)
                {
                    if (advOpen) CloseAdv(); else OpenAdv();
                }
            }
            if (Inp.Pressed(Act.Debug)) { showDebug = !showDebug; debugText.gameObject.SetActive(showDebug); }

            if (container != null) container.Tick(dt, mouse);
            TickMap(g, p, dt, mouse);
            TickAdv(g, dt);

            // hotbar
            hotbarSel.rectTransform.anchoredPosition = new Vector2(p.inv.selected * 44 + 0, 0);
            for (int i = 0; i < 9; i++) hotbar[i].Show(p.inv.slots[i]);
            // estadisticas
            bool surv = !g.creative;
            for (int i = 0; i < 10; i++)
            {
                heartsR[i].gameObject.SetActive(surv);
                foodR[i].gameObject.SetActive(surv);
                float hv = p.health - i * 2f;
                string hn = hv >= 2f ? "ui_heart_full" : (hv >= 1f ? "ui_heart_half" : "ui_heart_empty");
                if (p.invuln > 0.2f && Mathf.FloorToInt(Time.time * 10f) % 2 == 0 && p.health < 20) hn = "ui_heart_empty";
                heartsR[i].uvRect = IconAtlas.UV(IconAtlas.Ui(hn));
                float fv = p.hunger - i * 2f;
                foodR[i].uvRect = IconAtlas.UV(IconAtlas.Ui(fv >= 2f ? "ui_food_full" : (fv >= 1f ? "ui_food_half" : "ui_food_empty")));
                int def = p.inv.TotalDefense();
                armorR[i].gameObject.SetActive(surv && def > 0);
                float av = def - i * 2f;
                armorR[i].uvRect = IconAtlas.UV(IconAtlas.Ui(av >= 2f ? "ui_armor" : (av >= 1f ? "ui_armor_half" : "ui_armor_empty")));
                bool showB = surv && (p.headInWater || p.air < 14.9f);
                bubblesR[i].gameObject.SetActive(showB && p.air > i * 1.5f - 0.2f);
            }
            // nombre del objeto
            var held = p.inv.Held.IsEmpty ? null : p.inv.Held.item;
            if (held != lastHeld) { lastHeld = held; itemNameT = 2f; itemName.text = held != null ? held.name : ""; }
            if (itemNameT > 0) { itemNameT -= dt; itemName.color = new Color(1, 1, 1, Mathf.Clamp01(itemNameT)); }
            // recogidas
            if (pickupT > 0) { pickupT -= dt; pickupText.text = "+" + pickupCount + " " + pickupItem.name; pickupText.color = new Color(0.8f, 1f, 0.8f, Mathf.Clamp01(pickupT)); } else pickupText.text = "";
            if (hintT > 0f) { hintT -= dt; hintText.color = new Color(1f, 0.95f, 0.7f, Mathf.Clamp01(hintT * 2f)); if (hintT <= 0f) hintText.text = ""; }
            // toasts
            for (int i = toasts.Count - 1; i >= 0; i--)
            {
                toastT[i] -= dt;
                var rt = toasts[i].transform.parent as RectTransform;
                rt.anchoredPosition = new Vector2(12, 150 + (toasts.Count - 1 - i) * 26);
                toasts[i].color = new Color(1f, 0.95f, 0.6f, Mathf.Clamp01(toastT[i]));
                if (toastT[i] <= 0) { Destroy(rt.gameObject); toasts.RemoveAt(i); toastT.RemoveAt(i); }
            }
            // jefe
            var brt = bossBg.transform.parent as RectTransform;
            brt.gameObject.SetActive(bossName != null);
            if (bossName != null) { bossText.text = bossName; bossFill.rectTransform.sizeDelta = new Vector2(520f * Mathf.Clamp01(bossFrac), 10); }
            // overlays
            if (flashT > 0) { flashT -= dt * 2.2f; flashImg.color = new Color(flashColor.r, flashColor.g, flashColor.b, flashColor.a * Mathf.Clamp01(flashT)); }
            else flashImg.color = new Color(0, 0, 0, 0);
            waterImg.color = new Color(0.1f, 0.3f, 0.7f, p.headInWater ? 0.28f : 0f);
            if (showDebug) UpdateDebug(g, p, dt);
        }

        void UpdateDebug(GameRoot g, Player p, float dt)
        {
            fpsT += dt; fpsN++;
            if (fpsT >= 0.5f) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
            var pos = p.transform.position;
            int x = Mathf.FloorToInt(pos.x), y = Mathf.FloorToInt(pos.y), z = Mathf.FloorToInt(pos.z);
            var w = g.world;
            var sb = new StringBuilder();
            sb.AppendLine("MundoBloques  " + fps.ToString("0") + " fps");
            sb.AppendLine("XYZ: " + pos.x.ToString("0.00") + " / " + pos.y.ToString("0.00") + " / " + pos.z.ToString("0.00"));
            sb.AppendLine("Dimensión: " + w.dim + "   Bioma: " + Biomes.NameOf((int)w.BiomeAt(x, z)));
            sb.AppendLine("Chunk: " + (x >> 4) + "," + (z >> 4) + "   Chunks cargados: " + w.chunks.Count + "   Trabajos: " + w.PendingJobs);
            int l = w.LightPacked(x, y, z);
            sb.AppendLine("Luz cielo/bloque: " + (l >> 4) + "/" + (l & 15) + "   Hora: " + (g.sky.time * 24f).ToString("0.0"));
            if (p.target.hit) sb.AppendLine("Apuntando: " + p.target.block.name + " (" + p.target.x + "," + p.target.y + "," + p.target.z + ") meta " + w.GetMeta(p.target.x, p.target.y, p.target.z));
            sb.AppendLine("Clima: " + (g.weather.Raining ? (g.weather.thunder ? "tormenta" : "lluvia") : "despejado") + " (" + g.weather.rain.ToString("0.00") + ")   Mapa: " + g.map.Count + " chunks   Logros: " + g.advDone.Count + "/" + Advancements.All.Count);
            sb.AppendLine("Semilla: " + g.worldSeed + "   Entidades: " + Entity.All.Count);
            debugText.text = sb.ToString();
        }
    }
}
