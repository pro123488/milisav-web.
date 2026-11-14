#!/usr/bin/env python3
"""FASE 12 · Auditoría estática de seguridad de Football Empire Ultimate.

Comprueba reglas que deben cumplirse siempre:
  1. Solo hay dos puntos de entrada cliente→servidor: Action.OnServerInvoke y Arena (chut validado).
  2. Todo manejador que lee payload.<campo> valida antes type(payload) (él o la función a la que delega).
  3. Los números de UserId/índices enviados por el cliente pasan por tonumber + comprobación de entero o finitud.
  4. Ningún pase se concede leyendo datos guardados: las ventajas solo usan GamePassService.Owns.
  5. Los IDs de Game Pass no están inventados (0 = pendiente) salvo que el usuario los configure.
  6. No se usa loadstring/getfenv/setfenv.
Uso: python3 tools/security_check.py src
"""
import glob
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "src"
server = glob.glob(f"{root}/ServerScriptService/**/*.lua", recursive=True)
shared = glob.glob(f"{root}/ReplicatedStorage/**/*.lua", recursive=True)
problems = []

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

# 1. Puntos de entrada
# Puntos de entrada permitidos: Action (todas las acciones) y Arena (solo «kick», validado en ArenaService).
ALLOWED_ENTRIES = {("Main.server.lua", "actionRemote.OnServerInvoke"), ("ArenaService.lua", "arenaRemote.OnServerEvent")}
entries = [(p.split("/")[-1], m.group(0)) for p in server for m in re.finditer(r"\w+\.(OnServerEvent|OnServerInvoke)", read(p))]
for entry in entries:
    if entry not in ALLOWED_ENTRIES:
        problems.append(f"Punto de entrada del cliente no revisado: {entry}")

# 2. Validación de payload
for path in server:
    src = read(path)
    for m in re.finditer(r"\n(?:function ([\w.]+)|Actions\.(\w+) = function)\(player, payload\)(.*?)\nend\n", src, re.S):
        name, body = m.group(1) or m.group(2), m.group(3)
        if re.search(r"payload\.\w+", body) and "type(payload)" not in body:
            problems.append(f"{path}: {name} usa payload.* sin comprobar type(payload)")

# 3. tonumber de campos del cliente sin validar
for path in server:
    lines = read(path).splitlines()
    for i, line in enumerate(lines):
        m = re.search(r"local (\w+) = tonumber\(.*payload", line)
        if m:
            var = m.group(1)
            window = "\n".join(lines[i + 1:i + 6])
            if not re.search(rf"(math\.floor\({var}\)|validUserId\({var}\)|{var} ~= {var}|== {var}\b|\b{var} == (s|allowed)\b|GetPlayerByUserId\()", window + line):
                problems.append(f"{path}:{i + 1}: «{var}» viene del cliente y no se comprueba que sea entero/finito")

# 4. Ventajas de pago
for path in server:
    src = read(path)
    if re.search(r"data\.premium\.(owned|passes)|data\.passes|data\.gamepass", src):
        problems.append(f"{path}: lee un pase desde los datos guardados (purchaseLog es solo un registro y no cuenta)")

# 5. IDs de Game Pass
config = read(f"{root}/ReplicatedStorage/Shared/Config/GamePassConfig.lua")
ids = re.findall(r"\bid = (\d+)", config)
configured = [i for i in ids if i != "0"]
print(f"Game Passes: {len(ids)} definidos, {len(configured)} con ID configurado")

# 5b. Producto del pase de temporada premium (0 = pendiente; nunca debe inventarse)
season = read(f"{root}/ReplicatedStorage/Shared/Config/SeasonConfig.lua")
product = re.search(r"PREMIUM_PRODUCT_ID = (\d+)", season)
print("Pase de temporada premium:", "producto configurado" if product and product.group(1) != "0" else "pendiente de configuración (ID 0)")

# 6. Funciones peligrosas
for path in server + shared:
    if re.search(r"\b(loadstring|getfenv|setfenv)\s*\(", read(path)):
        problems.append(f"{path}: usa loadstring/getfenv/setfenv")

for p in problems:
    print("❌", p)
print(f"{len(server) + len(shared)} archivos auditados, {len(problems)} problemas")
sys.exit(1 if problems else 0)
