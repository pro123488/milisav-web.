#!/usr/bin/env python3
"""Genera build/YoutuberLife3D.html: el juego 3D completo en UN solo archivo
(Three.js, datos, estilos y código incluidos). Se abre con doble clic, sin internet.

Uso:
  python3 tools/export_web_data.py   # (si cambiaste los datos Lua)
  python3 tools/build_web.py
"""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "web")
OUT = os.path.join(ROOT, "build", "YoutuberLife3D.html")
ORDER = ["engine.js", "world.js", "player.js", "systems.js", "ui.js", "apps.js", "main.js"]


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


def safe_script(js):
    return js.replace("</script", "<\\/script")


def main():
    html = read(WEB, "src", "index.html")
    three = read(WEB, "vendor", "three.min.js")
    lic = "/* three.js r160 — MIT License — https://threejs.org — ver web/vendor/three-LICENSE.txt */\n"
    data = read(WEB, "src", "gamedata.js")
    game = "\n".join("// ---- " + f + "\n" + read(WEB, "src", f) for f in ORDER)
    html = html.replace("/*STYLE*/", read(WEB, "src", "style.css"))
    html = html.replace("<script>/*THREE*/</script>", "<script>" + lic + safe_script(three) + "</script>")
    html = html.replace("<script>/*DATA*/</script>", "<script>" + safe_script(data) + "</script>")
    html = html.replace("<script>/*GAME*/</script>", "<script>" + safe_script(game) + "</script>")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Generado {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
