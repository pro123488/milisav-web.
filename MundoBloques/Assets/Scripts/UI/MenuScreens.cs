using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MundoBloques
{
    public sealed partial class GameUI
    {
        RectTransform menuRoot, pageMain, pageNew, pageLoad, pageControls, pausePanel, deathPanel, victoryPanel, loadingPanel;
        readonly List<UIButton> menuButtons = new List<UIButton>();
        readonly List<UIButton> pauseButtons = new List<UIButton>();
        readonly List<UIButton> newButtons = new List<UIButton>();
        readonly List<UIButton> loadButtons = new List<UIButton>();
        readonly List<UIButton> deathButtons = new List<UIButton>();
        readonly List<UIButton> victoryButtons = new List<UIButton>();
        UITextField nameField, seedField;
        bool newCreative;
        UIButton modeBtn;
        UISlider sViewDist, sSens, sVolume, sMusic;
        UIButton btnMinimap;
        Image loadingFill; Text loadingText;
        Text victoryText; float victoryScroll;
        bool menuVisible, pauseOpen, deathOpen, victoryOpen;
        int loadScroll; List<LevelDto> worlds = new List<LevelDto>();
        string pendingDelete;
        Text loadInfo;
        RectTransform loadList;

        // ================================================================== construccion
        void BuildMenus()
        {
            // --- menu principal ---
            menuRoot = UIKit.Rect(screenRoot, "menu", 0, 0, 0, 0); UIKit.Stretch(menuRoot);
            var bg = menuRoot.gameObject.AddComponent<Image>(); bg.color = new Color(0.05f, 0.09f, 0.16f, 0.9f); bg.raycastTarget = false;
            var title = UIKit.Txt(UIKit.Anchored(menuRoot, "t", new Vector2(0.5f, 1f), 0, -90, 900, 90), "MUNDOBLOQUES", 72, new Color(1f, 0.9f, 0.45f), TextAnchor.MiddleCenter, 0, 0, 900, 90);
            UIKit.Txt(UIKit.Anchored(menuRoot, "s", new Vector2(0.5f, 1f), 0, -150, 900, 40), "Construye, mina, cultiva y sobrevive en un mundo infinito de bloques", 22, new Color(0.8f, 0.9f, 1f), TextAnchor.MiddleCenter, 0, 0, 900, 40);

            pageMain = UIKit.Centered(menuRoot, "main", 360, 330, 0, -40);
            AddMenuBtn(pageMain, "Nuevo mundo", 0, () => ShowPage(pageNew));
            AddMenuBtn(pageMain, "Cargar mundo", 1, () => { RefreshWorlds(); ShowPage(pageLoad); });
            AddMenuBtn(pageMain, "Controles y guía", 2, () => ShowPage(pageControls));
            AddMenuBtn(pageMain, "Salir", 3, () => { Application.Quit(); });

            // --- nuevo mundo ---
            pageNew = UIKit.Centered(menuRoot, "new", 520, 420, 0, -40);
            UIKit.Txt(pageNew, "Nuevo mundo", 34, Color.white, TextAnchor.MiddleCenter, 0, 0, 520, 50);
            UIKit.Txt(pageNew, "Nombre", 18, new Color(0.8f, 0.9f, 1f), TextAnchor.MiddleLeft, 20, 62, 200, 24);
            nameField = UITextField.Make(pageNew, 20, 88, 480, 40, "Mi mundo");
            UIKit.Txt(pageNew, "Semilla (vacío = aleatoria)", 18, new Color(0.8f, 0.9f, 1f), TextAnchor.MiddleLeft, 20, 140, 400, 24);
            seedField = UITextField.Make(pageNew, 20, 166, 480, 40, "123456"); seedField.numeric = true; seedField.maxLen = 9;
            modeBtn = UIButton.Make(pageNew, "Modo: Supervivencia", 20, 226, 480, 44, () => { newCreative = !newCreative; modeBtn.label.text = "Modo: " + (newCreative ? "Creativo (vuelas y tienes todo)" : "Supervivencia"); });
            newButtons.Add(modeBtn);
            newButtons.Add(UIButton.Make(pageNew, "Crear mundo", 20, 290, 480, 50, CreateWorldPressed, 22));
            newButtons.Add(UIButton.Make(pageNew, "Atrás", 20, 350, 480, 44, () => ShowPage(pageMain)));

            // --- cargar ---
            pageLoad = UIKit.Centered(menuRoot, "load", 700, 470, 0, -40);
            UIKit.Txt(pageLoad, "Cargar mundo", 34, Color.white, TextAnchor.MiddleCenter, 0, 0, 700, 50);
            loadList = UIKit.Rect(pageLoad, "list", 10, 60, 680, 340);
            loadInfo = UIKit.Txt(pageLoad, "", 18, new Color(1f, 0.8f, 0.5f), TextAnchor.MiddleCenter, 0, 405, 700, 24);
            loadButtons.Add(UIButton.Make(pageLoad, "Atrás", 250, 425, 200, 40, () => { pendingDelete = null; ShowPage(pageMain); }));

            // --- controles ---
            pageControls = UIKit.Centered(menuRoot, "controls", 860, 560, 0, -50);
            UIKit.Txt(pageControls, "Controles y guía rápida", 32, Color.white, TextAnchor.MiddleCenter, 0, 0, 860, 44);
            UIKit.Txt(pageControls,
                "<b>Movimiento:</b> W A S D · Espacio saltar · Shift agacharse · Ctrl (o doble W) correr\n" +
                "<b>Ratón:</b> clic izq. picar/atacar (mantén) · clic der. colocar/usar/comer · rueda o 1-9 cambia objeto\n" +
                "<b>E</b> inventario y libro de recetas · <b>M</b> mapa · <b>L</b> logros · <b>Q</b> tirar · <b>F3</b> datos · <b>Esc</b> pausa\n" +
                "<b>Creativo:</b> doble Espacio vuela · F también alterna el vuelo · E abre todos los bloques\n\n" +
                "<b>Cómo progresar:</b> tala árboles → mesa de crafteo → pico de madera → piedra → horno → hierro.\n" +
                "Mina gemas (diamante, esmeralda, rubí, zafiro, amatista) bajo tierra; construye con el <b>cortapiedras</b>.\n" +
                "<b>Granja:</b> azada sobre tierra/hierba → siembra semillas (trigo, zanahoria, papa, remolacha, tomate, calabaza, sandía) cerca de agua.\n" +
                "Cría vacas, ovejas, cerdos y gallinas dándoles su comida; comercia con aldeanos usando esmeraldas.\n" +
                "<b>Vida:</b> pesca con la caña (clic der. al picar) · domestica lobos con huesos · monta caballos con montura y barcos (Mayús para bajar).\n" +
                "<b>Dimensiones:</b> obsidiana + mechero = portal del Abismo. Perlas etéreas + polvo de llama = Ojos del Final;\n" +
                "úsalos para hallar la fortaleza, rellena el marco del portal del Final y derrota al Dragón.\n" +
                "Explora islas, océanos, montañas, aldeas, templos, mazmorras e islas celestiales flotantes.",
                18, Color.white, TextAnchor.UpperLeft, 20, 60, 820, 430);
            menuButtons.Add(UIButton.Make(pageControls, "Atrás", 330, 505, 200, 44, () => ShowPage(pageMain)));

            // --- pausa ---
            pausePanel = UIKit.Centered(screenRoot, "pause", 520, 520);
            var pbg = pausePanel.gameObject.AddComponent<Image>(); pbg.color = UIKit.Panel; pbg.raycastTarget = false;
            UIKit.Txt(pausePanel, "Juego en pausa", 32, Color.white, TextAnchor.MiddleCenter, 0, 8, 520, 44);
            pauseButtons.Add(UIButton.Make(pausePanel, "Continuar", 40, 56, 440, 42, ClosePause, 20));
            sViewDist = UISlider.Make(pausePanel, "Distancia de visión", 40, 108, 440, 3, 12, 6, v => Mathf.RoundToInt(v) + " chunks", v => { GameRoot.I.viewDist = Mathf.RoundToInt(v); Settings.viewDist = Mathf.RoundToInt(v); });
            sSens = UISlider.Make(pausePanel, "Sensibilidad del ratón", 40, 144, 440, 0.5f, 5f, 2.2f, v => v.ToString("0.0"), v => { Settings.lookSens = v; if (GameRoot.I.player != null) GameRoot.I.player.lookSens = v; });
            sVolume = UISlider.Make(pausePanel, "Volumen de efectos", 40, 180, 440, 0f, 1f, 0.8f, v => Mathf.RoundToInt(v * 100) + "%", v => { Sfx.volume = v; Settings.sfx = v; });
            sMusic = UISlider.Make(pausePanel, "Volumen de la música", 40, 216, 440, 0f, 1f, 0.5f, v => Mathf.RoundToInt(v * 100) + "%", v => { Music.volume = v; Settings.music = v; });
            btnMinimap = UIButton.Make(pausePanel, "Minimapa: sí", 40, 262, 215, 40, () => { MinimapOn = !MinimapOn; btnMinimap.label.text = "Minimapa: " + (MinimapOn ? "sí" : "no"); }, 18);
            pauseButtons.Add(btnMinimap);
            pauseButtons.Add(UIButton.Make(pausePanel, "Logros (L)", 265, 262, 215, 40, () => { ClosePause(); OpenAdv(); }, 18));
            pauseButtons.Add(UIButton.Make(pausePanel, "Guardar partida", 40, 312, 440, 42, () => { SaveSystem.SaveLevel(GameRoot.I); Settings.Save(); Toast("Partida guardada."); }, 20));
            pauseButtons.Add(UIButton.Make(pausePanel, "Ver controles", 40, 362, 440, 42, () => Toast("WASD mover · E inventario · M mapa · L logros · Q tirar · F3 datos · clic der. usar"), 20));
            pauseButtons.Add(UIButton.Make(pausePanel, "Guardar y salir al menú", 40, 414, 440, 50, () => { ClosePause(); GameRoot.I.ReturnToMenu(); }, 20));
            pausePanel.gameObject.SetActive(false);

            // --- muerte ---
            deathPanel = UIKit.Rect(screenRoot, "death", 0, 0, 0, 0); UIKit.Stretch(deathPanel);
            var dbg = deathPanel.gameObject.AddComponent<Image>(); dbg.color = new Color(0.45f, 0.02f, 0.02f, 0.65f); dbg.raycastTarget = false;
            UIKit.Txt(UIKit.Anchored(deathPanel, "t", new Vector2(0.5f, 0.5f), 0, 90, 800, 100), "¡Has muerto!", 80, Color.white, TextAnchor.MiddleCenter, 0, 0, 800, 100);
            var dc = UIKit.Centered(deathPanel, "btns", 360, 140, 0, -50);
            deathButtons.Add(UIButton.Make(dc, "Reaparecer", 0, 0, 360, 56, () => GameRoot.I.Respawn(), 24));
            deathButtons.Add(UIButton.Make(dc, "Salir al menú", 0, 76, 360, 56, () => { HideDeath(); GameRoot.I.ReturnToMenu(); }, 22));
            deathPanel.gameObject.SetActive(false);

            // --- victoria ---
            victoryPanel = UIKit.Rect(screenRoot, "victory", 0, 0, 0, 0); UIKit.Stretch(victoryPanel);
            var vbg = victoryPanel.gameObject.AddComponent<Image>(); vbg.color = new Color(0.02f, 0.01f, 0.06f, 0.96f); vbg.raycastTarget = false;
            victoryText = UIKit.Txt(UIKit.Anchored(victoryPanel, "t", new Vector2(0.5f, 0.5f), 0, 0, 900, 1400), "", 26, Color.white, TextAnchor.UpperCenter, 0, 0, 900, 1400);
            var vc = UIKit.Anchored(victoryPanel, "b", new Vector2(0.5f, 0f), 0, 40, 360, 56);
            victoryButtons.Add(UIButton.Make(vc, "Volver al mundo", 0, 0, 360, 56, () => { HideVictory(); GameRoot.I.ExitEnd(); }, 22));
            victoryPanel.gameObject.SetActive(false);

            // --- carga ---
            loadingPanel = UIKit.Rect(overlayRoot, "loading", 0, 0, 0, 0); UIKit.Stretch(loadingPanel);
            var lbg = loadingPanel.gameObject.AddComponent<Image>(); lbg.color = new Color(0.04f, 0.06f, 0.1f, 1f); lbg.raycastTarget = false;
            loadingText = UIKit.Txt(UIKit.Anchored(loadingPanel, "t", new Vector2(0.5f, 0.5f), 0, 30, 800, 50), "Cargando...", 32, Color.white, TextAnchor.MiddleCenter, 0, 0, 800, 50);
            var lbar = UIKit.Anchored(loadingPanel, "bar", new Vector2(0.5f, 0.5f), 0, -20, 500, 14);
            var lbb = lbar.gameObject.AddComponent<Image>(); lbb.color = new Color(0, 0, 0, 0.8f); lbb.raycastTarget = false;
            loadingFill = UIKit.Img(lbar, "fill", 0, 0, 0, 14, new Color(0.4f, 0.8f, 0.4f, 1f));
            loadingPanel.gameObject.SetActive(false);
            overlayRoot.SetAsLastSibling();

            menuRoot.gameObject.SetActive(false);
            ShowPage(pageMain);
        }

        void AddMenuBtn(RectTransform parent, string text, int row, Action click)
        {
            menuButtons.Add(UIButton.Make(parent, text, 0, row * 76, 360, 60, click, 26));
        }

        bool clickUsed;     // el clic de este fotograma ya se ha usado (cambio de pagina)

        void ShowPage(RectTransform page)
        {
            clickUsed = true;
            pageMain.gameObject.SetActive(page == pageMain); pageNew.gameObject.SetActive(page == pageNew);
            pageLoad.gameObject.SetActive(page == pageLoad); pageControls.gameObject.SetActive(page == pageControls);
            if (page == pageNew && string.IsNullOrEmpty(nameField.value)) nameField.value = UniqueName();
        }

        string UniqueName()
        {
            for (int i = 1; i < 999; i++) { var n = "Mundo " + i; if (!SaveSystem.Exists(n)) return n; }
            return "Mundo";
        }

        void CreateWorldPressed()
        {
            string name = nameField.value.Trim();
            if (name.Length == 0) name = UniqueName();
            if (SaveSystem.Exists(name)) { Toast("Ya existe un mundo con ese nombre."); name = UniqueName(); nameField.value = name; return; }
            int seed;
            if (!int.TryParse(seedField.value, out seed) || seedField.value.Length == 0) seed = UnityEngine.Random.Range(1, 999999999);
            GameRoot.I.StartNewWorld(name, seed, newCreative);
        }

        // ================================================================== mostrar / ocultar
        public void ShowMainMenu() { menuRoot.gameObject.SetActive(true); menuVisible = true; ShowPage(pageMain); hudRoot.gameObject.SetActive(false); }
        public void HideMainMenu() { menuRoot.gameObject.SetActive(false); menuVisible = false; }

        public void ShowLoading(string text, float frac)
        {
            loadingPanel.gameObject.SetActive(true);
            loadingText.text = text;
            loadingFill.rectTransform.sizeDelta = new Vector2(500f * Mathf.Clamp01(frac), 14);
        }
        public void HideLoading() { loadingPanel.gameObject.SetActive(false); }

        public void ShowDeath() { deathOpen = true; deathPanel.gameObject.SetActive(true); }
        public void HideDeath() { deathOpen = false; deathPanel.gameObject.SetActive(false); }

        public void ShowVictory()
        {
            victoryOpen = true; victoryPanel.gameObject.SetActive(true); victoryScroll = -200f;
            victoryText.text =
                "<size=44><color=#FFE680>¡FELICIDADES!</color></size>\n\n" +
                "Has derrotado al <color=#E070FF>Dragón del Final</color>\n" +
                "y has completado la aventura de MundoBloques.\n\n\n" +
                "Has explorado biomas, océanos, islas y montañas,\n" +
                "minado gemas y minerales, cultivado la tierra,\n" +
                "criado animales, comerciado con aldeanos\n" +
                "y cruzado tres dimensiones.\n\n\n" +
                "<color=#AAAAFF>El mundo sigue siendo tuyo:\nconstruye lo que imagines.</color>\n\n\n" +
                "Gracias por jugar.";
        }
        void HideVictory() { victoryOpen = false; victoryPanel.gameObject.SetActive(false); }

        public void OpenPause()
        {
            pauseOpen = true; pausePanel.gameObject.SetActive(true); GameRoot.I.paused = true;
            sViewDist.value = GameRoot.I.viewDist; if (GameRoot.I.player != null) sSens.value = GameRoot.I.player.lookSens; sVolume.value = Sfx.volume; sMusic.value = Music.volume;
            btnMinimap.label.text = "Minimapa: " + (MinimapOn ? "sí" : "no");
        }

        public void ClosePause()
        {
            pauseOpen = false; pausePanel.gameObject.SetActive(false); GameRoot.I.paused = false; Settings.Save();
        }

        public void CloseAll()
        {
            if (container != null) CloseContainer();
            if (pauseOpen) ClosePause();
            CloseMap(); CloseAdv();
            HideDeath(); HideVictory();
            pausePanel.gameObject.SetActive(false);
        }

        // ================================================================== mundos guardados
        void RefreshWorlds()
        {
            worlds = SaveSystem.ListWorlds();
            loadScroll = 0; pendingDelete = null;
            RebuildWorldList();
        }

        void RebuildWorldList()
        {
            for (int i = loadList.childCount - 1; i >= 0; i--) Destroy(loadList.GetChild(i).gameObject);
            // limpiar botones de lista (los dos primeros ... se mantienen: solo el de atras)
            while (loadButtons.Count > 1) loadButtons.RemoveAt(loadButtons.Count - 1);
            int per = 5;
            if (worlds.Count == 0) { UIKit.Txt(loadList, "No hay mundos guardados todavía.", 22, new Color(0.8f, 0.8f, 0.8f), TextAnchor.MiddleCenter, 0, 130, 680, 40); return; }
            for (int i = 0; i < per; i++)
            {
                int idx = loadScroll + i;
                if (idx >= worlds.Count) break;
                var w = worlds[idx];
                float y = i * 66;
                var row = UIKit.Img(loadList, "row", 0, y, 680, 60, new Color(0.14f, 0.16f, 0.22f, 1f));
                string date = new DateTime(w.savedAt, DateTimeKind.Utc).ToLocalTime().ToString("dd/MM/yyyy HH:mm");
                UIKit.Txt(row.transform, w.name, 22, Color.white, TextAnchor.MiddleLeft, 14, 2, 330, 30);
                string dimName = w.dim == 1 ? "Abismo" : (w.dim == 2 ? "Final" : "Mundo Superior");
                UIKit.Txt(row.transform, (w.creative ? "Creativo" : "Supervivencia") + " · " + dimName + " · " + date, 14, new Color(0.7f, 0.8f, 0.9f), TextAnchor.MiddleLeft, 14, 32, 400, 24);
                var data = w;
                loadButtons.Add(UIButton.Make(row.transform, "Jugar", 430, 10, 110, 40, () => GameRoot.I.LoadWorld(data), 20));
                bool conf = pendingDelete == w.name;
                var del = UIButton.Make(row.transform, conf ? "¿Seguro?" : "Borrar", 550, 10, 120, 40, () =>
                {
                    if (pendingDelete == data.name) { SaveSystem.Delete(data.name); RefreshWorlds(); loadInfo.text = "Mundo borrado."; }
                    else { pendingDelete = data.name; RebuildWorldList(); }
                }, 18);
                del.normal = new Color(0.45f, 0.18f, 0.18f, 1f); del.hover = new Color(0.7f, 0.25f, 0.25f, 1f);
                loadButtons.Add(del);
            }
            loadInfo.text = worlds.Count > per ? "Rueda del ratón para ver más (" + (loadScroll + 1) + "-" + Mathf.Min(worlds.Count, loadScroll + per) + " de " + worlds.Count + ")" : "";
        }

        // ================================================================== tick de los menus
        void TickMenus(float dt, Vector2 mouse, bool click)
        {
            clickUsed = false;
            var g = GameRoot.I;
            if (menuVisible)
            {
                if (pageMain.gameObject.activeSelf || pageControls.gameObject.activeSelf) foreach (var b in menuButtons) b.Tick(mouse, click && !clickUsed);
                if (pageNew.gameObject.activeSelf)
                {
                    nameField.Tick(mouse, click && !clickUsed); seedField.Tick(mouse, click && !clickUsed);
                    foreach (var b in newButtons) b.Tick(mouse, click && !clickUsed);
                }
                if (pageLoad.gameObject.activeSelf)
                {
                    if (Mathf.Abs(Inp.Scroll) > 0.1f && worlds.Count > 5) { loadScroll = Mathf.Clamp(loadScroll - (int)Mathf.Sign(Inp.Scroll), 0, worlds.Count - 5); RebuildWorldList(); }
                    var copy = new List<UIButton>(loadButtons);
                    foreach (var b in copy) b.Tick(mouse, click && !clickUsed);
                }
            }
            if (pauseOpen)
            {
                sViewDist.Tick(mouse); sSens.Tick(mouse); sVolume.Tick(mouse); sMusic.Tick(mouse);
                foreach (var b in pauseButtons) b.Tick(mouse, click && !clickUsed);
            }
            if (deathOpen) foreach (var b in deathButtons) b.Tick(mouse, click && !clickUsed);
            if (victoryOpen)
            {
                victoryScroll += dt * 40f;
                var rt = victoryText.rectTransform;
                rt.anchoredPosition = new Vector2(0, -1000f + victoryScroll * 1.2f);
                foreach (var b in victoryButtons) b.Tick(mouse, click && !clickUsed);
            }
        }
    }
}
