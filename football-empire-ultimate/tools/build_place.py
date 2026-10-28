#!/usr/bin/env python3
"""
Genera FootballEmpireUltimate.rbxlx (archivo de lugar de Roblox en XML) a partir de src/,
siguiendo default.project.json y las convenciones de Rojo:
  carpeta          -> Folder
  X.server.lua     -> Script
  X.client.lua     -> LocalScript
  X.lua            -> ModuleScript

Uso:  python3 tools/build_place.py
El archivo resultante se abre directamente en Roblox Studio (Archivo > Abrir).
"""
import json
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "FootballEmpireUltimate.rbxlx")

_ref = 0


def next_ref():
    global _ref
    _ref += 1
    return "RBX%08X" % _ref


def cdata(text):
    # "]]>" no puede aparecer dentro de CDATA: se divide en dos secciones.
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def item(class_name, name, children="", source=None):
    props = '<string name="Name">%s</string>' % escape(name)
    if source is not None:
        props += '<ProtectedString name="Source">%s</ProtectedString>' % cdata(source)
    return '<Item class="%s" referent="%s"><Properties>%s</Properties>%s</Item>' % (
        class_name, next_ref(), props, children)


def from_path(path, name):
    """Convierte un archivo o carpeta de src/ en XML de instancias."""
    if os.path.isdir(path):
        children = "".join(
            from_path(os.path.join(path, entry), None)
            for entry in sorted(os.listdir(path))
            if not entry.startswith(".")
        )
        return item("Folder", name or os.path.basename(path), children)
    base = os.path.basename(path)
    if not base.endswith(".lua"):
        return ""
    with open(path, encoding="utf-8") as f:
        source = f.read()
    if base.endswith(".server.lua"):
        return item("Script", name or base[: -len(".server.lua")], source=source)
    if base.endswith(".client.lua"):
        return item("LocalScript", name or base[: -len(".client.lua")], source=source)
    return item("ModuleScript", name or base[: -len(".lua")], source=source)


def from_tree(name, node):
    if "$path" in node:
        return from_path(os.path.join(ROOT, node["$path"]), name)
    class_name = node.get("$className", "Folder")
    children = "".join(from_tree(k, v) for k, v in node.items() if not k.startswith("$"))
    return item(class_name, name, children)


def main():
    with open(os.path.join(ROOT, "default.project.json"), encoding="utf-8") as f:
        project = json.load(f)
    tree = project["tree"]
    services = "".join(from_tree(k, v) for k, v in tree.items() if not k.startswith("$"))
    xml = (
        '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
        + services + "</roblox>"
    )
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(xml)
    count = xml.count("<Item ")
    print("Generado %s (%d instancias)" % (os.path.relpath(OUTPUT, ROOT), count))
    return 0


if __name__ == "__main__":
    sys.exit(main())
