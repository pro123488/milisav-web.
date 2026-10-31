#!/usr/bin/env python3
"""Genera build/YoutuberLife.rbxlx a partir de src/ (misma estructura que default.project.json).

Abre el archivo resultante con Roblox Studio (Archivo > Abrir) y pulsa Play.
Uso: python3 tools/build_rbxlx.py
"""
import glob
import os
import xml.dom.minidom
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "build", "YoutuberLife.rbxlx")

counter = [0]


def ref():
    counter[0] += 1
    return f"RBX{counter[0]:06d}"


def cdata(text):
    # "]]>" no puede aparecer dentro de CDATA: se parte en dos secciones
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def script_item(path, name):
    with open(path, encoding="utf-8") as f:
        source = f.read()
    cls = "ModuleScript"
    if name.endswith(".server"):
        cls, name = "Script", name[: -len(".server")]
    elif name.endswith(".client"):
        cls, name = "LocalScript", name[: -len(".client")]
    return (
        f'<Item class="{cls}" referent="{ref()}"><Properties>'
        f'<string name="Name">{escape(name)}</string>'
        f'<ProtectedString name="Source">{cdata(source)}</ProtectedString>'
        f"</Properties></Item>"
    )


def folder_item(path, name):
    parts = [f'<Item class="Folder" referent="{ref()}"><Properties><string name="Name">{escape(name)}</string></Properties>']
    for entry in sorted(os.listdir(path)):
        full = os.path.join(path, entry)
        if os.path.isdir(full):
            parts.append(folder_item(full, entry))
        elif entry.endswith(".lua") or entry.endswith(".luau"):
            parts.append(script_item(full, os.path.splitext(entry)[0]))
    parts.append("</Item>")
    return "".join(parts)


def service(cls, children="", props=""):
    return f'<Item class="{cls}" referent="{ref()}"><Properties><string name="Name">{cls}</string>{props}</Properties>{children}</Item>'


def main():
    body = []
    body.append(service("Workspace", props='<bool name="StreamingEnabled">false</bool>'))
    body.append(service("Lighting", props='<float name="Brightness">2.5</float><bool name="GlobalShadows">true</bool>'))
    body.append(service("ReplicatedStorage", folder_item(os.path.join(SRC, "shared"), "Shared")))
    body.append(service("ServerScriptService", folder_item(os.path.join(SRC, "server"), "Server")))
    starter_scripts = (
        f'<Item class="StarterPlayerScripts" referent="{ref()}"><Properties><string name="Name">StarterPlayerScripts</string></Properties>'
        + folder_item(os.path.join(SRC, "client"), "Client")
        + "</Item>"
    )
    body.append(service("StarterPlayer", starter_scripts))
    body.append(service("SoundService"))
    xml_text = (
        '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
        + "".join(body)
        + "</roblox>"
    )
    xml.dom.minidom.parseString(xml_text.encode("utf-8"))  # comprobar que el XML es válido
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(xml_text)
    n = len(glob.glob(os.path.join(SRC, "**", "*.lua"), recursive=True))
    print(f"Generado {os.path.relpath(OUT, ROOT)} ({n} scripts, {os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
