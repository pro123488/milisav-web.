using System;
using UnityEngine;
using UnityEngine.UI;

namespace MundoBloques
{
    /// <summary>Utilidades para construir interfaz uGUI por codigo (sin prefabs ni EventSystem).</summary>
    public static class UIKit
    {
        public static Font font;
        public static readonly Color Panel = new Color(0.12f, 0.12f, 0.14f, 0.94f);
        public static readonly Color Slot = new Color(0.25f, 0.25f, 0.28f, 0.95f);
        public static readonly Color SlotHi = new Color(0.55f, 0.55f, 0.65f, 0.95f);
        public static readonly Color Btn = new Color(0.28f, 0.3f, 0.36f, 1f);
        public static readonly Color BtnHi = new Color(0.4f, 0.45f, 0.58f, 1f);
        public static readonly Color Gold = new Color(1f, 0.85f, 0.35f);

        public static Font GetFont()
        {
            if (font != null) return font;
            try { font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
            if (font == null) { try { font = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { } }
            if (font == null) font = Font.CreateDynamicFontFromOSFont("Arial", 16);
            return font;
        }

        /// <summary>Rect anclado arriba a la izquierda dentro de parent (coordenadas de referencia).</summary>
        public static RectTransform Rect(Transform parent, string name, float x, float y, float w, float h)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = go.GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        /// <summary>Rect centrado en pantalla.</summary>
        public static RectTransform Centered(Transform parent, string name, float w, float h, float dx = 0, float dy = 0)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = go.GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(dx, dy);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        public static RectTransform Anchored(Transform parent, string name, Vector2 anchor, float x, float y, float w, float h)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = go.GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
            rt.anchoredPosition = new Vector2(x, y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        public static Image Img(Transform parent, string name, float x, float y, float w, float h, Color c)
        {
            var rt = Rect(parent, name, x, y, w, h);
            var im = rt.gameObject.AddComponent<Image>();
            im.color = c; im.raycastTarget = false;
            return im;
        }

        public static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        }

        public static Text Txt(Transform parent, string text, int size, Color c, TextAnchor anchor, float x, float y, float w, float h, bool shadow = true)
        {
            var rt = Rect(parent, "txt", x, y, w, h);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = GetFont(); t.text = text; t.fontSize = size; t.color = c; t.alignment = anchor;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false; t.supportRichText = true;
            if (shadow) { var s = rt.gameObject.AddComponent<Shadow>(); s.effectColor = new Color(0, 0, 0, 0.8f); s.effectDistance = new Vector2(1.2f, -1.2f); }
            return t;
        }

        public static RawImage Icon(Transform parent, float x, float y, float w, float h)
        {
            var rt = Rect(parent, "icon", x, y, w, h);
            var r = rt.gameObject.AddComponent<RawImage>();
            r.texture = IconAtlas.Texture; r.raycastTarget = false;
            return r;
        }

        public static bool Over(RectTransform rt, Vector2 mouse)
        {
            return rt != null && rt.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(rt, mouse, null);
        }
    }

    /// <summary>Boton simple con deteccion de raton propia.</summary>
    public sealed class UIButton
    {
        public RectTransform rt; public Image bg; public Text label; public Action onClick; public bool enabled = true;
        public Color normal = UIKit.Btn, hover = UIKit.BtnHi;

        public static UIButton Make(Transform parent, string text, float x, float y, float w, float h, Action click, int size = 18)
        {
            var b = new UIButton();
            b.rt = UIKit.Rect(parent, "btn", x, y, w, h);
            b.bg = b.rt.gameObject.AddComponent<Image>(); b.bg.color = b.normal; b.bg.raycastTarget = false;
            b.label = UIKit.Txt(b.rt, text, size, Color.white, TextAnchor.MiddleCenter, 0, 0, w, h);
            b.onClick = click;
            return b;
        }

        public void Tick(Vector2 mouse, bool clicked)
        {
            if (rt == null || !rt.gameObject.activeInHierarchy) return;
            bool over = enabled && UIKit.Over(rt, mouse);
            bg.color = !enabled ? new Color(0.2f, 0.2f, 0.22f, 1f) : (over ? hover : normal);
            label.color = enabled ? Color.white : new Color(0.55f, 0.55f, 0.55f);
            if (over && clicked && onClick != null) { Sfx.Play(Clip.Click, GameRoot.I.transform.position, 0.5f); onClick(); }
        }
    }

    /// <summary>Campo de texto sencillo (nombre del mundo, semilla...).</summary>
    public sealed class UITextField
    {
        public RectTransform rt; public Image bg; public Text text; public string value = ""; public bool focused; public int maxLen = 24; public string placeholder = "";
        public bool numeric;

        public static UITextField Make(Transform parent, float x, float y, float w, float h, string placeholder)
        {
            var f = new UITextField();
            f.placeholder = placeholder;
            f.rt = UIKit.Rect(parent, "field", x, y, w, h);
            f.bg = f.rt.gameObject.AddComponent<Image>(); f.bg.color = new Color(0.05f, 0.05f, 0.07f, 1f); f.bg.raycastTarget = false;
            f.text = UIKit.Txt(f.rt, "", 18, Color.white, TextAnchor.MiddleLeft, 8, 0, w - 16, h);
            return f;
        }

        public void Tick(Vector2 mouse, bool clicked)
        {
            if (clicked) focused = UIKit.Over(rt, mouse);
            if (focused)
            {
                var typed = Inp.Typed;
                for (int i = 0; i < typed.Length; i++)
                {
                    char c = typed[i];
                    if (c == '\b') { if (value.Length > 0) value = value.Substring(0, value.Length - 1); }
                    else if (c == '\n' || c == '\r') { }
                    else if (!char.IsControl(c) && value.Length < maxLen && (!numeric || char.IsDigit(c) || (c == '-' && value.Length == 0))) value += c;
                }
                if (Inp.Pressed(Act.Backspace) && typed.IndexOf('\b') < 0 && value.Length > 0) value = value.Substring(0, value.Length - 1);
            }
            bool show = value.Length > 0;
            string cur = focused && (int)(Time.unscaledTime * 2f) % 2 == 0 ? "_" : "";
            text.text = show ? value + cur : (focused ? cur : "<color=#777777>" + placeholder + "</color>");
            bg.color = focused ? new Color(0.1f, 0.12f, 0.2f, 1f) : new Color(0.05f, 0.05f, 0.07f, 1f);
        }
    }

    /// <summary>Control deslizante.</summary>
    public sealed class UISlider
    {
        public RectTransform rt; public Image track, fill; public Text label;
        public float min, max, value; public Action<float> onChange; public string format; bool drag;
        readonly Func<float, string> fmt;

        public static UISlider Make(Transform parent, string name, float x, float y, float w, float min, float max, float value, Func<float, string> fmt, Action<float> change)
        {
            var s = new UISlider { min = min, max = max, value = value, onChange = change };
            s.rt = UIKit.Rect(parent, "slider", x, y, w, 30);
            s.track = s.rt.gameObject.AddComponent<Image>(); s.track.color = new Color(0.05f, 0.05f, 0.07f, 1f); s.track.raycastTarget = false;
            s.fill = UIKit.Img(s.rt, "fill", 0, 0, 10, 30, new Color(0.35f, 0.55f, 0.9f, 1f));
            s.label = UIKit.Txt(s.rt, name, 17, Color.white, TextAnchor.MiddleCenter, 0, 0, w, 30);
            var fm = fmt;
            s.Update(name, fm);
            return s;
        }

        string baseName;
        Func<float, string> fm2;
        void Update(string name, Func<float, string> f) { baseName = name; fm2 = f; Refresh(); }

        void Refresh()
        {
            float t = Mathf.InverseLerp(min, max, value);
            fill.rectTransform.sizeDelta = new Vector2(rt.sizeDelta.x * t, 30);
            label.text = baseName + ": " + (fm2 != null ? fm2(value) : value.ToString("0.0"));
        }

        public void Tick(Vector2 mouse)
        {
            if (!rt.gameObject.activeInHierarchy) return;
            if (Inp.MouseDown(0) && UIKit.Over(rt, mouse)) drag = true;
            if (!Inp.MouseHeld(0)) drag = false;
            if (drag)
            {
                Vector2 local;
                RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, mouse, null, out local);
                float t = Mathf.Clamp01(local.x / rt.sizeDelta.x);
                float nv = Mathf.Lerp(min, max, t);
                if (!Mathf.Approximately(nv, value)) { value = nv; if (onChange != null) onChange(value); }
            }
            Refresh();
        }
    }
}
