#!/usr/bin/env python3
"""
Comprueba referencias entre módulos: si un archivo hace
    local Servicio = require(...Servicio)
y luego usa Servicio.Algo, verifica que el módulo Servicio define 'Algo'
(function Servicio.Algo / Servicio.Algo = ... / clave en la tabla del módulo).

Uso:  python3 tools/field_check.py [carpeta]   (por defecto: src)
"""
import os
import re
import sys


def strip_comments_and_strings(src):
    src = re.sub(r"--\[(=*)\[.*?\]\1\]", "", src, flags=re.S)
    src = re.sub(r"--[^\n]*", "", src)
    src = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', src)
    src = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", src)
    return src


def module_fields(name, src):
    fields = set()
    for m in re.finditer(r"\bfunction\s+%s[.:](\w+)" % re.escape(name), src):
        fields.add(m.group(1))
    for m in re.finditer(r"\b%s\.(\w+)\s*=[^=]" % re.escape(name), src):
        fields.add(m.group(1))
    # claves de primer nivel de "local Nombre = { ... }"
    m = re.search(r"local\s+%s\s*=\s*\{" % re.escape(name), src)
    if m:
        depth, i = 1, m.end()
        start = i
        while i < len(src) and depth:
            if src[i] == "{":
                depth += 1
            elif src[i] == "}":
                depth -= 1
            i += 1
        body = src[start:i - 1]
        level, buf = 0, []
        for ch in body:
            if ch in "{(":
                level += 1
            elif ch in "})":
                level -= 1
            buf.append(ch if level == 0 else " ")
        for k in re.finditer(r"(?:^|[,\n])\s*(\w+)\s*=", "".join(buf)):
            fields.add(k.group(1))
    return fields


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "src"
    files = {}
    for dirpath, _, names in os.walk(root):
        for n in names:
            if n.endswith(".lua"):
                files[os.path.join(dirpath, n)] = strip_comments_and_strings(open(os.path.join(dirpath, n), encoding="utf-8").read())
    modules = {}
    for path, src in files.items():
        base = os.path.basename(path)
        if base.endswith(".server.lua") or base.endswith(".client.lua"):
            continue
        name = base[:-4]
        if re.search(r"\breturn\s+%s\s*$" % re.escape(name), src.strip()):
            modules[name] = module_fields(name, src)
    problems = 0
    # Alias por convención (las pantallas reciben estos módulos a través de ctx)
    CONVENTIONS = {"Theme": "Theme", "C": "Components", "Format": "Format"}
    for path, src in sorted(files.items()):
        for alias, modname in CONVENTIONS.items():
            if modname not in modules or not re.search(r"\b%s\s*[,=]" % alias, src):
                continue
            if re.search(r"local\s+%s\s*=\s*require" % alias, src):
                continue
            for use in re.finditer(r"(?<![.\w])%s\.(\w+)" % re.escape(alias), src):
                if use.group(1) not in modules[modname]:
                    line = src[:use.start()].count("\n") + 1
                    print("%s:%d: %s.%s no está definido en %s" % (path, line, alias, use.group(1), modname))
                    problems += 1
        for m in re.finditer(r"local\s+(\w+)\s*=\s*require\(([^\n]*)\)", src):
            alias, target = m.group(1), m.group(2)
            mod = re.findall(r"(\w+)\"?\)*$", target.replace('")', "").replace("'", ""))
            names = re.findall(r"\w+", target)
            modname = None
            for candidate in reversed(names):
                if candidate in modules:
                    modname = candidate
                    break
            if not modname:
                continue
            defined = modules[modname]
            for use in re.finditer(r"\b%s\.(\w+)" % re.escape(alias), src):
                field = use.group(1)
                if field not in defined:
                    line = src[:use.start()].count("\n") + 1
                    print("%s:%d: %s.%s no está definido en %s" % (path, line, alias, field, modname))
                    problems += 1
    print("%d módulos analizados, %d referencias rotas" % (len(modules), problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
