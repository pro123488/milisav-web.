using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MundoBloques
{
    /// <summary>Minimapa, mapa del mundo y pantalla de logros.</summary>
    public sealed partial class GameUI
    {
        const int MiniN = 128, BigN = 192, BigPx = 576;
        RectTransform miniFrame, bigPanel, advPanel;
        RawImage miniImg, bigImg, miniArrow, bigArrow;
        Texture2D miniTex, bigTex, arrowTex;
        readonly Color32[] miniBuf = new Color32[MiniN * MiniN], bigBuf = new Color32[BigN * BigN];
        Text miniCoords, bigInfo, advHeader;
        bool mapOpen, advOpen, minimapOn = true;
        int bigZoom;
        float miniTimer, bigTimer;
        int advScroll;
        const int AdvVisible = 9;

        sealed class AdvRow { public RectTransform rt; public Image bg; public RawImage icon; public Text name, desc, mark, group; }
        readonly List<AdvRow> advRows = new List<AdvRow>();

        static Texture2D NewMapTex(int n)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false);
            t.filterMode = FilterMode.Point; t.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[n * n];
            for (int i = 0; i < px.Length; i++) px[i] = MapData.Unknown;
            t.SetPixels32(px); t.Apply(false);
            return t;
        }

        static Texture2D MakeArrow()
        {
            var p = new Px(7);
            p.Poly(new[] { 8, 1, 13, 14, 8, 11, 3, 14 }, Col.Hex(0xFFFFFF));
            p.Poly(new[] { 8, 4, 11, 12, 8, 10, 5, 12 }, Col.Hex(0xE03030));
            p.Outline(Col.Hex(0x101010));
            var t = new Texture2D(16, 16, TextureFormat.RGBA32, false);
            var px = new Color32[256];
            for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) px[(15 - y) * 16 + x] = p.d[y * 16 + x];
            t.SetPixels32(px); t.filterMode = FilterMode.Point; t.Apply(false);
            return t;
        }

        static void CenterPivot(RawImage r, float x, float y)
        {
            var rt = r.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0.5f, 0.5f); rt.anchoredPosition = new Vector2(x, -y);
        }

        void BuildMap()
        {
            arrowTex = MakeArrow();
            miniTex = NewMapTex(MiniN); bigTex = NewMapTex(BigN);
            minimapOn = Settings.minimap;
            var label = new Color(1f, 0.9f, 0.55f);
            // ---- minimapa en el HUD
            miniFrame = UIKit.Anchored(hudRoot, "minimap", new Vector2(1f, 1f), -12, -12, 148, 148);
            var fbg = miniFrame.gameObject.AddComponent<Image>(); fbg.color = new Color(0.04f, 0.04f, 0.06f, 0.85f); fbg.raycastTarget = false;
            miniImg = UIKit.Icon(miniFrame, 10, 10, MiniN, MiniN); miniImg.texture = miniTex;
            miniArrow = UIKit.Icon(miniFrame, 0, 0, 14, 14); miniArrow.texture = arrowTex; CenterPivot(miniArrow, 74, 74);
            UIKit.Txt(miniFrame, "N", 12, label, TextAnchor.MiddleCenter, 64, -1, 20, 12);
            UIKit.Txt(miniFrame, "S", 12, label, TextAnchor.MiddleCenter, 64, 138, 20, 12);
            UIKit.Txt(miniFrame, "O", 12, label, TextAnchor.MiddleCenter, 0, 68, 11, 14);
            UIKit.Txt(miniFrame, "E", 12, label, TextAnchor.MiddleCenter, 137, 68, 11, 14);
            miniCoords = UIKit.Txt(UIKit.Anchored(hudRoot, "minicoords", new Vector2(1f, 1f), -12, -162, 148, 20), "", 14, Color.white, TextAnchor.MiddleCenter, 0, 0, 148, 20);

            // ---- mapa grande
            bigPanel = UIKit.Centered(screenRoot, "bigmap", 620, 700);
            var bbg = bigPanel.gameObject.AddComponent<Image>(); bbg.color = UIKit.Panel; bbg.raycastTarget = false;
            UIKit.Txt(bigPanel, "Mapa del mundo", 26, Color.white, TextAnchor.MiddleCenter, 0, 8, 620, 36);
            bigImg = UIKit.Icon(bigPanel, 22, 52, BigPx, BigPx); bigImg.texture = bigTex;
            bigArrow = UIKit.Icon(bigImg.transform, 0, 0, 22, 22); bigArrow.texture = arrowTex; CenterPivot(bigArrow, BigPx / 2f, BigPx / 2f);
            UIKit.Txt(bigPanel, "N", 16, label, TextAnchor.MiddleCenter, 300, 34, 20, 18);
            bigInfo = UIKit.Txt(bigPanel, "", 16, new Color(0.85f, 0.92f, 1f), TextAnchor.UpperCenter, 22, 634, BigPx, 50);
            bigPanel.gameObject.SetActive(false);

            // ---- logros
            advPanel = UIKit.Centered(screenRoot, "advancements", 700, 640);
            var abg = advPanel.gameObject.AddComponent<Image>(); abg.color = UIKit.Panel; abg.raycastTarget = false;
            advHeader = UIKit.Txt(advPanel, "Logros", 28, UIKit.Gold, TextAnchor.MiddleCenter, 0, 8, 700, 40);
            for (int i = 0; i < AdvVisible; i++)
            {
                var r = new AdvRow();
                r.rt = UIKit.Rect(advPanel, "row", 10, 60 + i * 60, 680, 56);
                r.bg = r.rt.gameObject.AddComponent<Image>(); r.bg.raycastTarget = false;
                r.icon = UIKit.Icon(r.rt, 10, 10, 36, 36);
                r.name = UIKit.Txt(r.rt, "", 20, Color.white, TextAnchor.MiddleLeft, 58, 3, 480, 26);
                r.desc = UIKit.Txt(r.rt, "", 14, new Color(0.75f, 0.82f, 0.9f), TextAnchor.MiddleLeft, 58, 29, 520, 22);
                r.mark = UIKit.Txt(r.rt, "", 18, new Color(0.5f, 1f, 0.5f), TextAnchor.MiddleRight, 600, 14, 70, 28);
                r.group = UIKit.Txt(r.rt, "", 12, new Color(0.6f, 0.65f, 0.75f), TextAnchor.MiddleRight, 540, 3, 130, 16);
                advRows.Add(r);
            }
            UIKit.Txt(advPanel, "Rueda del ratón: desplazar  ·  L o Esc: cerrar", 15, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleCenter, 0, 606, 700, 26);
            advPanel.gameObject.SetActive(false);
        }

        public bool MinimapOn { get { return minimapOn; } set { minimapOn = value; Settings.minimap = value; } }

        public void OpenMap()
        {
            var g = GameRoot.I;
            if (g.player == null || g.player.dead || g.state != GameState.Playing) return;
            if (g.world.dim != Dim.Overworld) { Hint("No hay mapa en esta dimensión.", 2f); return; }
            if (container != null) CloseContainer();
            mapOpen = true; bigPanel.gameObject.SetActive(true); bigTimer = 0f;
            g.player.StopBreaking(); g.player.CancelUse();
        }

        public void CloseMap() { mapOpen = false; if (bigPanel != null) bigPanel.gameObject.SetActive(false); }

        public void OpenAdv()
        {
            var g = GameRoot.I;
            if (g.player == null || g.player.dead || g.state != GameState.Playing) return;
            if (container != null) CloseContainer();
            advOpen = true; advPanel.gameObject.SetActive(true); advScroll = 0;
            g.player.StopBreaking(); g.player.CancelUse();
        }

        public void CloseAdv() { advOpen = false; if (advPanel != null) advPanel.gameObject.SetActive(false); }

        static string Compass(float yaw)
        {
            string[] n = { "N", "NE", "E", "SE", "S", "SO", "O", "NO" };
            int i = Mathf.RoundToInt(Mathf.Repeat(yaw, 360f) / 45f) % 8;
            return n[i];
        }

        void TickMap(GameRoot g, Player p, float dt, Vector2 mouse)
        {
            bool ow = g.world.dim == Dim.Overworld;
            bool showMini = ow && minimapOn && !mapOpen;
            miniFrame.gameObject.SetActive(showMini);
            miniCoords.gameObject.SetActive(minimapOn && !mapOpen);
            var pp = p.transform.position;
            int px = Mathf.FloorToInt(pp.x), pz = Mathf.FloorToInt(pp.z);
            if (minimapOn) miniCoords.text = "X " + px + "  Y " + Mathf.FloorToInt(pp.y) + "  Z " + pz + "  " + Compass(p.yaw);
            if (showMini)
            {
                miniTimer -= dt;
                if (miniTimer <= 0f)
                {
                    miniTimer = 0.3f;
                    g.map.Render(miniBuf, MiniN, px, pz, 1);
                    miniTex.SetPixels32(miniBuf); miniTex.Apply(false);
                }
                miniArrow.rectTransform.localRotation = Quaternion.Euler(0f, 0f, -p.yaw);
            }
            if (mapOpen)
            {
                if (Mathf.Abs(Inp.Scroll) > 0.1f) { bigZoom = Mathf.Clamp(bigZoom + (Inp.Scroll < 0f ? 1 : -1), 0, 2); bigTimer = 0f; }
                int bpp = 1 << bigZoom;
                bigTimer -= dt;
                if (bigTimer <= 0f)
                {
                    bigTimer = 0.25f;
                    g.map.Render(bigBuf, BigN, px, pz, bpp);
                    bigTex.SetPixels32(bigBuf); bigTex.Apply(false);
                }
                bigArrow.rectTransform.localRotation = Quaternion.Euler(0f, 0f, -p.yaw);
                string cursor = "";
                Vector2 lp;
                if (RectTransformUtility.ScreenPointToLocalPointInRectangle(bigImg.rectTransform, mouse, null, out lp))
                {
                    float u = lp.x / BigPx, v = 1f + lp.y / BigPx;
                    if (u >= 0f && u <= 1f && v >= 0f && v <= 1f)
                        cursor = "   ·   Cursor: X " + (px + Mathf.RoundToInt((u - 0.5f) * BigN * bpp)) + "  Z " + (pz + Mathf.RoundToInt((v - 0.5f) * BigN * bpp));
                }
                bigInfo.text = "Estás en X " + px + "  Z " + pz + cursor + "\nEscala 1 píxel = " + bpp + (bpp == 1 ? " bloque" : " bloques") + "  ·  Rueda: zoom  ·  M o Esc: cerrar\nChunks explorados: " + g.map.Count;
            }
        }

        void TickAdv(GameRoot g, float dt)
        {
            if (!advOpen) return;
            int total = Advancements.All.Count;
            if (Mathf.Abs(Inp.Scroll) > 0.1f) advScroll = Mathf.Clamp(advScroll - (int)Mathf.Sign(Inp.Scroll), 0, Mathf.Max(0, total - AdvVisible));
            advHeader.text = "Logros  " + g.advDone.Count + " / " + total;
            for (int i = 0; i < advRows.Count; i++)
            {
                var r = advRows[i];
                int idx = advScroll + i;
                if (idx >= total) { r.rt.gameObject.SetActive(false); continue; }
                r.rt.gameObject.SetActive(true);
                var a = Advancements.All[idx];
                bool done = g.advDone.Contains(a.id);
                r.bg.color = done ? new Color(0.14f, 0.3f, 0.18f, 1f) : new Color(0.17f, 0.18f, 0.24f, 1f);
                var it = Items.Get(a.icon);
                r.icon.enabled = it != null;
                if (it != null) r.icon.uvRect = IconAtlas.UV(it.icon);
                r.icon.color = done ? Color.white : new Color(1f, 1f, 1f, 0.45f);
                r.name.text = a.name; r.name.color = done ? new Color(0.75f, 1f, 0.75f) : Color.white;
                r.desc.text = a.desc; r.group.text = a.group;
                r.mark.text = done ? "HECHO" : "";
            }
        }
    }
}
