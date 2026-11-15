#!/usr/bin/env python3
"""
Comprobador del «contrato» entre el cliente y el servidor (sin ejecutar nada):

  1. Cada acción que pide el cliente (ctx.act("X") / act("X") / InvokeServer("X")) existe en el
     servidor como Actions.X. Si no, el botón respondería «Acción desconocida».
  2. Cada sección del estado que leen las pantallas (state.X / ctx.state.X) la envía el servidor
     en buildState. Si no, la pantalla fallaría al indexar un nil.
  3. Cada tipo de aviso que envía el servidor por el remote Notify con un tipo especial
     (tabla como mensaje) lo trata el cliente.

Uso:  python3 tools/contract_check.py [carpeta]   (por defecto: src)
"""
import glob
import os
import re
import sys


def read(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def strip_comments(text):
    return re.sub(r"--[^\n]*", "", text)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "src"
    server_main = os.path.join(root, "ServerScriptService", "Server", "Main.server.lua")
    client_files = glob.glob(os.path.join(root, "StarterPlayer", "**", "*.lua"), recursive=True)
    server_files = glob.glob(os.path.join(root, "ServerScriptService", "**", "*.lua"), recursive=True)
    problems = []

    main_src = strip_comments(read(server_main))
    actions = set(re.findall(r"\bActions\.(\w+)\s*=\s*function", main_src))

    # 2. Secciones del estado: claves de primer nivel del return de buildState
    start = main_src.index("local function buildState")
    body_start = main_src.index("return {", start)
    depth, i, sections = 0, body_start + len("return "), set()
    while i < len(main_src):
        ch = main_src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        elif depth == 1:
            key = re.match(r"(\w+)\s*=(?!=)", main_src[i:])
            if key and not (main_src[i - 1].isalnum() or main_src[i - 1] in "_."):
                sections.add(key.group(1))
                i += len(key.group(1))
                continue
        i += 1

    for path in client_files:
        src = strip_comments(read(path))
        short = os.path.relpath(path)
        for match in re.finditer(r"(?:\bact|InvokeServer)\(\s*\"(\w+)\"", src):
            if match.group(1) not in actions:
                line = src.count("\n", 0, match.start()) + 1
                problems.append("%s:%d: la acción «%s» no existe en el servidor (Actions)" % (short, line, match.group(1)))
        # «state» es el estado del club solo si el archivo no define su propia tabla «state»
        own_state = re.search(r"local state = \{", src) is not None
        pattern = r"\bctx\.state\.(\w+)" if own_state else r"\b(?:ctx\.)?state\.(\w+)"
        for match in re.finditer(pattern, src):
            name = match.group(1)
            if name.startswith("_"):
                continue  # marcas internas del envío incremental (_partial, _removed)
            if name not in sections:
                line = src.count("\n", 0, match.start()) + 1
                problems.append("%s:%d: el estado no tiene la sección «%s»" % (short, line, name))

    # 3. Avisos especiales (con tabla) enviados por el servidor
    client_main = strip_comments(read(os.path.join(root, "StarterPlayer", "StarterPlayerScripts", "Client", "Main.client.lua")))
    handled = set(re.findall(r"kind == \"(\w+)\" and type\(message\) == \"table\"", client_main))
    for path in server_files:
        src = strip_comments(read(path))
        for match in re.finditer(r"notifyRemote:Fire(?:All)?Clients?\((?:\w+,\s*)?\"(\w+)\",\s*\{", src):
            if match.group(1) not in handled:
                line = src.count("\n", 0, match.start()) + 1
                problems.append("%s:%d: el cliente no trata el aviso «%s» con datos" % (os.path.relpath(path), line, match.group(1)))

    for problem in problems:
        print("❌", problem)
    print("%d acciones en el servidor, %d secciones de estado, %d problemas" % (len(actions), len(sections), len(problems)))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
