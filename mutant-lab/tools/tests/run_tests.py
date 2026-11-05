#!/usr/bin/env python3
"""Pruebas fuera de Studio.

1. Compila TODOS los .lua del proyecto con Lua 5.1 (subconjunto compatible con Luau).
2. Ejecuta las pruebas de tools/tests/*_test.lua con un árbol de instancias simulado.

Requisitos: pip install lupa
Uso: python3 tools/tests/run_tests.py
"""
import os
import sys
import glob

from lupa import lua51

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "src")
TESTS = os.path.dirname(os.path.abspath(__file__))

# Ubicación lógica de cada carpeta dentro del juego (igual que default.project.json)
MOUNTS = {
    "shared": "ReplicatedStorage/Shared",
    "server": "ServerScriptService/Server",
    "client": "StarterPlayer/StarterPlayerScripts/Client",
}


def logical_entries():
    entries = []
    for folder, logical in MOUNTS.items():
        base = os.path.join(SRC, folder)
        for path in sorted(glob.glob(os.path.join(base, "**", "*.lua"), recursive=True)):
            rel = os.path.relpath(path, base).replace(os.sep, "/")
            name = rel[:-4]
            for suffix in (".server", ".client"):
                if name.endswith(suffix):
                    name = name[: -len(suffix)]
            entries.append((logical + "/" + name, path))
    return entries


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def syntax_check(lua):
    failures = 0
    files = sorted(glob.glob(os.path.join(SRC, "**", "*.lua"), recursive=True))
    check = lua.eval("function(src, name) local f, e = loadstring(src, '@' .. name) return e end")
    for path in files:
        err = check(read(path), os.path.relpath(path, ROOT))
        if err:
            failures += 1
            print("ERROR DE SINTAXIS:", err)
    print(f"Sintaxis: {len(files) - failures}/{len(files)} archivos correctos")
    return failures


def main():
    lua = lua51.LuaRuntime(unpack_returned_tuples=True)
    failures = syntax_check(lua)
    lua.globals().READ = read

    tests = sorted(glob.glob(os.path.join(TESTS, "*_test.lua")))
    only = sys.argv[1:]
    for test in tests:
        if only and not any(o in test for o in only):
            continue
        rt = lua51.LuaRuntime(unpack_returned_tuples=True)
        rt.globals().READ = read
        harness = rt.execute(read(os.path.join(TESTS, "harness.lua")))
        entries = rt.table_from([rt.table_from({"logical": l, "path": p}) for l, p in logical_entries()])
        rt.globals().H = harness
        rt.globals().ENTRIES = entries
        rt.globals().MOCKS_SRC = read(os.path.join(TESTS, "mocks.lua"))
        try:
            result = rt.execute(read(test))
            print(f"OK   {os.path.basename(test)} {result if result else ''}")
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"FALLO {os.path.basename(test)}: {e}")
    if failures:
        print(f"\n{failures} fallo(s)")
        sys.exit(1)
    print("\nTodo correcto")


if __name__ == "__main__":
    main()
