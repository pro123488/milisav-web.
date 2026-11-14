#!/usr/bin/env python3
"""
Comprobador de la API de Roblox para este proyecto (sin ejecutar nada).

Lee las definiciones de tipos de Roblox (globalTypes.d.luau, generadas a partir del volcado
oficial de la API y publicadas por el proyecto luau-lsp, licencia MIT) y comprueba en el código:

  1. Enum.X.Y                      -> el enum X existe y tiene el elemento Y.
  2. Instance.new("Clase")         -> la clase existe.
  3. game:GetService("Servicio")   -> el servicio existe, y cada miembro que se usa sobre la
                                      variable del servicio (Servicio.Algo / Servicio:Algo()) existe.
  4. C.New("Clase", { Prop = … })  -> cada propiedad del literal existe en esa clase.
  5. local x = Instance.new("Clase") / C.New("Clase", …)
                                   -> cada x.Prop = … y x:Metodo() posteriores existen en la clase.
  6. material = "Nombre" en las configuraciones -> es un Enum.Material válido.
  7. Variables con nombre de tipo evidente (humanoid, camera…) -> sus miembros existen.
  8. «local a, b = x and f()»      -> aviso: con and/or solo llega el primer valor de f().

Uso:  python3 tools/api_check.py [carpeta] [--defs ruta/globalTypes.d.luau]
Si no encuentra las definiciones intenta descargarlas a tools/.cache/. Sale con código 1 si hay problemas.
No sustituye a Roblox Studio: no comprueba tipos de valores ni el comportamiento en ejecución.
"""
import glob
import os
import re
import sys
import urllib.request

DEFS_URL = "https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau"
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DEFS = os.path.join(HERE, ".cache", "globalTypes.d.luau")

# Miembros válidos en cualquier instancia que las definiciones declaran en la base o de forma genérica
ALWAYS = {"Parent", "Name", "ClassName", "Archivable"}
# Hijos propios del proyecto a los que se accede por nombre (no son propiedades de Roblox)
OWN_CHILDREN = {"Shared"}
# Variables cuyo nombre indica su tipo en este proyecto
NAMED = {
    "humanoid": "Humanoid", "hum": "Humanoid", "camera": "Camera", "hrp": "BasePart",
}
# Nombres que casi siempre son ese tipo. Como a veces son tablas propias (un «player» de la
# plantilla, un «ball» de la colección…), solo se comprueban los miembros en PascalCase, que es
# como se llaman los de Roblox; los campos propios van en minúscula.
NAMED_PASCAL = {
    "player": "Player", "other": "Player", "character": "Model", "root": "Part",
    "otherRoot": "Part", "torso": "BasePart", "ball": "Part", "prompt": "ProximityPrompt",
    "button": "TextButton", "label": "TextLabel", "box": "TextBox", "sound": "Sound",
    "highlight": "Highlight", "scroll": "ScrollingFrame", "trail": "Trail", "seat": "Seat",
    "toggleButton": "TextButton", "joinButton": "TextButton", "kickButton": "TextButton", "passButton": "TextButton",
    "queueLabel": "TextLabel", "scoreLabel": "TextLabel", "timeLabel": "TextLabel", "teamsLabel": "TextLabel",
    "bannerText": "TextLabel", "bigText": "TextLabel", "eventsLabel": "TextLabel", "statusLabel": "TextLabel",
    "whistleSound": "Sound", "cheerSound": "Sound", "kickSound": "Sound", "announceBox": "TextBox",
}


def load_defs(path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            urllib.request.urlretrieve(DEFS_URL, path)
        except Exception as error:  # sin red: no es un fallo del proyecto
            print("No se pudieron descargar las definiciones de Roblox:", error)
            return None, None
    classes, enums = {}, {}
    current, is_enum = None, False
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            header = re.match(r"declare extern type (\w+)(?: extends (\w+))? with", line)
            if header:
                name, parent = header.group(1), header.group(2)
                if name.startswith("Enum") and name.endswith("_INTERNAL"):
                    current, is_enum = name[4:-9], True
                    enums[current] = set()
                else:
                    current, is_enum = name, False
                    classes[current] = {"parent": parent, "members": set()}
                if line.rstrip().endswith("end"):
                    current = None
                continue
            if current is None:
                continue
            if line.startswith("end"):
                current = None
                continue
            member = re.match(r"\s+(?:function\s+)?(\w+)", line)
            if member and not line.lstrip().startswith("@"):
                if is_enum:
                    enums[current].add(member.group(1))
                else:
                    classes[current]["members"].add(member.group(1))
    return classes, enums


def has_member(classes, cls, member):
    if member in ALWAYS:
        return True
    while cls and cls in classes:
        if member in classes[cls]["members"]:
            return True
        cls = classes[cls]["parent"]
    return False


def strip_comment(line):
    # Quita el comentario de línea respetando las cadenas
    out, quote, i = [], None, 0
    while i < len(line):
        ch = line[i]
        if quote:
            out.append(ch)
            if ch == "\\":
                i += 1
                if i < len(line):
                    out.append(line[i])
            elif ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
            out.append(ch)
        elif line.startswith("--", i):
            break
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def blank_strings(text):
    return re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", lambda m: '"' + " " * (len(m.group(0)) - 2) + '"', text)


def table_keys(text, start):
    """Claves de primer nivel del literal de tabla que empieza en text[start] == '{'."""
    depth, i, keys = 0, start, []
    clean = blank_strings(text)
    while i < len(clean):
        ch = clean[i]
        if ch in "{([":
            depth += 1
        elif ch in "})]":
            depth -= 1
            if depth == 0:
                break
        elif depth == 1:
            key = re.match(r"([A-Za-z_]\w*)\s*=(?!=)", clean[i:])
            previous = clean[i - 1] if i > 0 else " "
            if key and not (previous.isalnum() or previous in "_."):
                keys.append((key.group(1), text.count("\n", 0, i) + 1))
                i += len(key.group(1))
                continue
        i += 1
    return keys


def check_file(path, classes, enums, problems):
    with open(path, encoding="utf-8") as handle:
        raw_lines = handle.read().split("\n")
    lines = [strip_comment(line) for line in raw_lines]
    text = "\n".join(lines)
    short = os.path.relpath(path)

    def report(line, message):
        problems.append("%s:%d: %s" % (short, line, message))

    # 1. Enums
    for match in re.finditer(r"\bEnum\.(\w+)\.(\w+)", blank_strings(text)):
        enum, item = match.group(1), match.group(2)
        line = text.count("\n", 0, match.start()) + 1
        if enum not in enums:
            report(line, "el enum Enum.%s no existe" % enum)
        elif item not in enums[enum] and item not in ("GetEnumItems", "FromName", "FromValue"):
            report(line, "Enum.%s.%s no existe" % (enum, item))

    # 2 y 3. Clases y servicios
    for match in re.finditer(r"Instance\.new\(\s*\"(\w+)\"", text):
        if match.group(1) not in classes:
            report(text.count("\n", 0, match.start()) + 1, "Instance.new(\"%s\"): la clase no existe" % match.group(1))
    services = {}
    for match in re.finditer(r"local (\w+) = game:GetService\(\"(\w+)\"\)", text):
        if match.group(2) not in classes:
            report(text.count("\n", 0, match.start()) + 1, "el servicio %s no existe" % match.group(2))
        else:
            services[match.group(1)] = match.group(2)

    # 4. Literales de C.New
    for match in re.finditer(r"\bC\.New\(\s*\"(\w+)\"\s*,\s*\{", text):
        cls = match.group(1)
        line = text.count("\n", 0, match.start()) + 1
        if cls not in classes:
            report(line, "C.New(\"%s\"): la clase no existe" % cls)
            continue
        for key, key_line in table_keys(text, match.end() - 1):
            if key != "Children" and not has_member(classes, cls, key):
                report(key_line, "%s no tiene la propiedad «%s»" % (cls, key))

    # 5 y 7. Miembros de variables de tipo conocido
    typed = {}
    for number, line in enumerate(lines, 1):
        clean = blank_strings(line)
        if re.match(r"(local )?function ", line):
            typed = {}  # función nueva de primer nivel: las variables locales anteriores ya no valen
        created = re.search(r"(?:local )?(\w+) = (?:Instance\.new|C\.New)\(\s*\"(\w+)\"", line)
        assigned = re.match(r"\s*(?:local )?(\w+)(?:, \w+)* = ", clean)
        if created and created.group(2) in classes:
            typed[created.group(1)] = created.group(2)
        elif assigned and assigned.group(1) in typed:
            del typed[assigned.group(1)]
        scope = dict(NAMED)
        scope.update(services)
        scope.update(typed)
        for use in re.finditer(r"(?<![\w.:])(\w+)([.:])(\w+)", clean):
            variable, member = use.group(1), use.group(3)
            cls = scope.get(variable)
            if not cls and member[:1].isupper():
                cls = NAMED_PASCAL.get(variable)
            if cls and member not in OWN_CHILDREN and not has_member(classes, cls, member):
                report(number, "%s (%s) no tiene el miembro «%s»" % (variable, cls, member))

    # 8. Valores perdidos: «local a, b = x and f()» solo conserva el PRIMER valor que devuelve f()
    for number, line in enumerate(lines, 1):
        multi = re.match(r"\s*(?:local )?[\w.]+(?:, [\w.]+)+ = (.+)$", blank_strings(line))
        if not multi:
            continue
        right, depth, top_comma, top_level = multi.group(1).rstrip(), 0, False, []
        for ch in right:
            if ch in "({[":
                depth += 1
            elif ch in ")}]":
                depth -= 1
            elif ch == "," and depth == 0:
                top_comma = True
            top_level.append(ch if depth == 0 else " ")
        # Solo cuenta un and/or fuera de paréntesis (dentro de los argumentos no pierde valores)
        if not top_comma and right.endswith(")") and re.search(r"\b(and|or)\b", "".join(top_level)):
            report(number, "asignación múltiple con and/or: solo llega el primer valor de la función")

    # 6. Materiales escritos como texto en las configuraciones
    for match in re.finditer(r"\b\w*[mM]aterial = \"(\w+)\"", text):
        if match.group(1) not in enums.get("Material", ()):
            report(text.count("\n", 0, match.start()) + 1, "\"%s\" no es un Enum.Material" % match.group(1))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = args[0] if args else "src"
    defs = DEFAULT_DEFS
    if "--defs" in sys.argv:
        defs = sys.argv[sys.argv.index("--defs") + 1]
    classes, enums = load_defs(defs)
    if classes is None:
        print("api_check: omitido (sin definiciones de Roblox)")
        return 0
    problems = []
    files = sorted(glob.glob(os.path.join(root, "**", "*.lua"), recursive=True))
    for path in files:
        check_file(path, classes, enums, problems)
    for problem in problems:
        print("❌", problem)
    print("%d archivos comprobados contra la API de Roblox (%d clases, %d enums), %d problemas"
          % (len(files), len(classes), len(enums), len(problems)))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
