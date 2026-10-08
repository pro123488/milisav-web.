using System.Text;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
using UnityEngine.InputSystem;
#endif

namespace MundoBloques
{
    public enum Act
    {
        Forward, Back, Left, Right, Jump, Sneak, Sprint,
        Inventory, Drop, Pause, Debug, Recipes, Fly, Backspace, Enter, Tab,
        Hotbar1, Hotbar2, Hotbar3, Hotbar4, Hotbar5, Hotbar6, Hotbar7, Hotbar8, Hotbar9,
        Count
    }

    /// <summary>
    /// Capa de entrada: funciona con el Input Manager clasico y con el nuevo Input System.
    /// Llamar a Inp.Poll() una vez por frame (lo hace GameRoot).
    /// </summary>
    public static class Inp
    {
        public static Vector2 MousePos;
        public static Vector2 Look;
        public static float Scroll;
        public static string Typed = "";

        static readonly bool[] held = new bool[(int)Act.Count];
        static readonly bool[] down = new bool[(int)Act.Count];
        static readonly bool[] up = new bool[(int)Act.Count];
        static readonly bool[] mHeld = new bool[3];
        static readonly bool[] mDown = new bool[3];
        static readonly bool[] mUp = new bool[3];

        public static bool Held(Act a) { return held[(int)a]; }
        public static bool Pressed(Act a) { return down[(int)a]; }
        public static bool Released(Act a) { return up[(int)a]; }
        public static bool MouseHeld(int b) { return mHeld[b]; }
        public static bool MouseDown(int b) { return mDown[b]; }
        public static bool MouseUp(int b) { return mUp[b]; }

        public static float Axis(Act neg, Act pos)
        {
            return (Held(pos) ? 1f : 0f) - (Held(neg) ? 1f : 0f);
        }

#if ENABLE_LEGACY_INPUT_MANAGER || !ENABLE_INPUT_SYSTEM
        static readonly KeyCode[] codes = BuildCodes();

        static KeyCode[] BuildCodes()
        {
            var c = new KeyCode[(int)Act.Count];
            c[(int)Act.Forward] = KeyCode.W;
            c[(int)Act.Back] = KeyCode.S;
            c[(int)Act.Left] = KeyCode.A;
            c[(int)Act.Right] = KeyCode.D;
            c[(int)Act.Jump] = KeyCode.Space;
            c[(int)Act.Sneak] = KeyCode.LeftShift;
            c[(int)Act.Sprint] = KeyCode.LeftControl;
            c[(int)Act.Inventory] = KeyCode.E;
            c[(int)Act.Drop] = KeyCode.Q;
            c[(int)Act.Pause] = KeyCode.Escape;
            c[(int)Act.Debug] = KeyCode.F3;
            c[(int)Act.Recipes] = KeyCode.R;
            c[(int)Act.Fly] = KeyCode.F;
            c[(int)Act.Backspace] = KeyCode.Backspace;
            c[(int)Act.Enter] = KeyCode.Return;
            c[(int)Act.Tab] = KeyCode.Tab;
            for (int i = 0; i < 9; i++) c[(int)Act.Hotbar1 + i] = KeyCode.Alpha1 + i;
            return c;
        }

        public static void Poll()
        {
            for (int i = 0; i < (int)Act.Count; i++)
            {
                var k = codes[i];
                held[i] = Input.GetKey(k);
                down[i] = Input.GetKeyDown(k);
                up[i] = Input.GetKeyUp(k);
            }
            // Mayusculas o Ctrl derecho tambien cuentan
            if (Input.GetKey(KeyCode.RightShift)) held[(int)Act.Sneak] = true;
            if (Input.GetKey(KeyCode.RightControl)) held[(int)Act.Sprint] = true;
            for (int b = 0; b < 3; b++)
            {
                mHeld[b] = Input.GetMouseButton(b);
                mDown[b] = Input.GetMouseButtonDown(b);
                mUp[b] = Input.GetMouseButtonUp(b);
            }
            MousePos = Input.mousePosition;
            Look = new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y"));
            Scroll = Input.mouseScrollDelta.y;
            Typed = Input.inputString ?? "";
        }
#else
        static readonly StringBuilder typedBuf = new StringBuilder();
        static bool hooked;

        static Key KeyFor(Act a)
        {
            switch (a)
            {
                case Act.Forward: return Key.W;
                case Act.Back: return Key.S;
                case Act.Left: return Key.A;
                case Act.Right: return Key.D;
                case Act.Jump: return Key.Space;
                case Act.Sneak: return Key.LeftShift;
                case Act.Sprint: return Key.LeftCtrl;
                case Act.Inventory: return Key.E;
                case Act.Drop: return Key.Q;
                case Act.Pause: return Key.Escape;
                case Act.Debug: return Key.F3;
                case Act.Recipes: return Key.R;
                case Act.Fly: return Key.F;
                case Act.Backspace: return Key.Backspace;
                case Act.Enter: return Key.Enter;
                case Act.Tab: return Key.Tab;
                default: return Key.Digit1 + (int)(a - Act.Hotbar1);
            }
        }

        public static void Poll()
        {
            var kb = Keyboard.current;
            if (kb != null && !hooked)
            {
                hooked = true;
                kb.onTextInput += c => typedBuf.Append(c);
            }
            for (int i = 0; i < (int)Act.Count; i++)
            {
                if (kb == null) { held[i] = down[i] = up[i] = false; continue; }
                var kc = kb[KeyFor((Act)i)];
                held[i] = kc.isPressed;
                down[i] = kc.wasPressedThisFrame;
                up[i] = kc.wasReleasedThisFrame;
            }
            var m = Mouse.current;
            if (m != null)
            {
                mHeld[0] = m.leftButton.isPressed; mDown[0] = m.leftButton.wasPressedThisFrame; mUp[0] = m.leftButton.wasReleasedThisFrame;
                mHeld[1] = m.rightButton.isPressed; mDown[1] = m.rightButton.wasPressedThisFrame; mUp[1] = m.rightButton.wasReleasedThisFrame;
                mHeld[2] = m.middleButton.isPressed; mDown[2] = m.middleButton.wasPressedThisFrame; mUp[2] = m.middleButton.wasReleasedThisFrame;
                MousePos = m.position.ReadValue();
                Look = m.delta.ReadValue() * 0.05f;
                Scroll = m.scroll.ReadValue().y / 120f;
            }
            Typed = typedBuf.ToString();
            typedBuf.Length = 0;
        }
#endif
    }
}
