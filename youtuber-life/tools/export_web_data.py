#!/usr/bin/env python3
"""Exporta los datos compartidos del juego de Roblox (src/shared/*.lua) a web/src/gamedata.js
para que la versión 3D descargable use exactamente el mismo catálogo, ciudad, misiones y eventos.

Requisitos: pip install lupa
"""
import json
import os
import sys

from lupa import lua51

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TESTS = os.path.join(ROOT, "tools", "tests")
sys.path.insert(0, TESTS)
from run_tests import logical_entries, read  # noqa: E402

OUT = os.path.join(ROOT, "web", "src", "gamedata.js")


def to_py(lua, value, depth=0):
    if depth > 40:
        return None
    t = lua.globals().type(value)
    if t == "table":
        keys = list(value.keys())
        if keys and all(isinstance(k, (int, float)) for k in keys) and sorted(keys) == list(range(1, len(keys) + 1)):
            return [to_py(lua, value[i], depth + 1) for i in range(1, len(keys) + 1)]
        if not keys:
            return {}
        out = {}
        for k in keys:
            v = value[k]
            if lua.globals().type(v) == "function":
                continue
            out[str(k)] = to_py(lua, v, depth + 1)
        return out
    if t in ("function", "userdata", "thread"):
        return None
    return value


def main():
    lua = lua51.LuaRuntime(unpack_returned_tuples=True)
    lua.globals().READ = read
    harness = lua.execute(read(os.path.join(TESTS, "harness.lua")))
    root = harness.Node.new("game")
    entries = lua.table_from([lua.table_from({"logical": l, "path": p}) for l, p in logical_entries()])
    harness.mount(root, entries)
    env = lua.eval("setmetatable({}, { __index = _G })")
    req = harness.makeRequire(env)
    env.require = req
    shared = root.ReplicatedStorage.Shared
    mods = {}
    for name in ["Config", "ItemCatalog", "VideoData", "WorldData", "QuestDefs", "Progression", "PCBuild", "EventData", "FoodData", "SponsorData", "PropertyData"]:
        mods[name] = req(shared[name])
    cat = mods["ItemCatalog"]
    items = [to_py(lua, cat.Items[i]) for i in cat.Order.values()]
    data = {
        "Config": to_py(lua, mods["Config"]),
        "Items": items,
        "Categories": to_py(lua, cat.Categories),
        "Stores": to_py(lua, cat.Stores),
        "Video": to_py(lua, mods["VideoData"]),
        "World": {
            "CellSize": mods["WorldData"].CellSize,
            "RoadWidth": mods["WorldData"].RoadWidth,
            "Cols": mods["WorldData"].Cols,
            "Rows": mods["WorldData"].Rows,
            "Districts": to_py(lua, mods["WorldData"].Districts),
            "Spots": to_py(lua, mods["WorldData"].Spots),
            "Secrets": to_py(lua, mods["WorldData"].Secrets),
            "Specials": to_py(lua, mods["WorldData"].Specials),
        },
        "Quests": {
            "Tutorial": to_py(lua, mods["QuestDefs"].Tutorial),
            "Achievements": to_py(lua, mods["QuestDefs"].Achievements),
            "TrackNames": to_py(lua, mods["QuestDefs"].TrackNames),
        },
        "Ranks": to_py(lua, mods["Progression"].Ranks),
        "XpRewards": to_py(lua, mods["Progression"].Xp),
        "PC": {
            "Slots": to_py(lua, mods["PCBuild"].Slots),
            "TierNames": to_py(lua, mods["PCBuild"].TierNames),
            "MaxScenesByTier": to_py(lua, mods["PCBuild"].MaxScenesByTier),
            "BaseWatts": mods["PCBuild"].BaseWatts,
        },
        "Events": to_py(lua, mods["EventData"].Events),
        "Food": to_py(lua, mods["FoodData"]),
        "Sponsors": to_py(lua, mods["SponsorData"].Brands),
        "Properties": to_py(lua, mods["PropertyData"].Listings),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Generado por tools/export_web_data.py a partir de src/shared/*.lua. No editar a mano.\n")
        f.write("const GAMEDATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"Exportado {os.path.relpath(OUT, ROOT)}: {len(items)} objetos, {len(data['World']['Districts'])} distritos, "
          f"{len(data['World']['Spots'])} lugares, {len(data['Quests']['Achievements'])} logros, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
