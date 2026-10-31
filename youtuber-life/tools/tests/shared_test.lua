-- Pruebas de los módulos compartidos (fórmulas puras).
local root = H.Node.new("game")
H.mount(root, ENTRIES)
local env = setmetatable({}, { __index = _G })
local req = H.makeRequire(env)
env.require = req

local Shared = root.ReplicatedStorage.Shared
local Catalog = req(Shared.ItemCatalog)
local PCBuild = req(Shared.PCBuild)
local F = req(Shared.VideoFormulas)
local QuestDefs = req(Shared.QuestDefs)
local WorldData = req(Shared.WorldData)
local Progression = req(Shared.Progression)
local Util = req(Shared.Util)

local n = 0
for _ in pairs(Catalog.Items) do
	n = n + 1
end
assert(n > 100, "catálogo demasiado pequeño: " .. n)

-- Todos los PC completos deben ser montajes válidos
for _, id in ipairs(Catalog.Order) do
	local it = Catalog.Items[id]
	if it.Cat == "pc" then
		local ok, errs = PCBuild.validate(it.Parts)
		assert(ok, it.Id .. " no es válido: " .. table.concat(errs, "; "))
		assert(it.Price > 0)
	end
end

-- Incompatibilidades detectadas
local bad = { case = "case_mini", mobo = "mobo_k5_pro", cpu = "cpu_n7_640", ram = "ram_d4_8", storage = { "ssd_500" }, psu = "psu_400", cooling = "cool_stock", gpu = "gpu_vx9" }
local ok, errs, warns = PCBuild.validate(bad)
assert(not ok)
assert(#errs >= 4, "esperaba >=4 errores, hay " .. #errs)
assert(#warns >= 1)

local s1 = PCBuild.stats(Catalog.get("pc_old").Parts)
local s2 = PCBuild.stats(Catalog.get("pc_ws").Parts)
assert(s2.Score > s1.Score * 3, "la workstation debe ser mucho mejor")
assert(s2.MaxScenes > s1.MaxScenes)
assert(s1.Tier == 1, "pc_old debe ser tier 1, es " .. s1.Tier)

-- Escena: cámara buena > teléfono básico en el mismo lugar
local rng = function()
	return 0.99
end
local shot = req(Shared.VideoData).ShotById.wide
local base = { shot = shot, hour = 12, weather = "Clear", spotTags = { "shop" }, categoryTags = { "shop" }, spotNoise = 3, spotInterest = 8 }
base.device = Catalog.get("phone_basic").Stats
local a = F.scene(base, rng)
base.device = Catalog.get("cam_pro").Stats
local b = F.scene(base, rng)
assert(b.Quality > a.Quality, "la cámara pro debe dar más calidad")

-- Edición: línea vacía = 0, buena edición > mala
local e0 = F.edit({ entries = {} })
assert(e0.Final == 0)
local entries = {}
for i = 1, 6 do
	entries[i] = { q = 60, seconds = 20, trim = 0.75, shot = (i == 1) and "talking" or ("s" .. i), transition = (i % 3 == 0) and "fade" or "cut" }
end
local good = F.edit({ entries = entries, targetSeconds = 120, music = "m_pulse", musicVol = 0.3, voiceVol = 1, category = "tech", subtitles = true, titles = true, outro = "subscribe", color = { b = 5, c = 10, s = 5 }, colorAcc = 70 })
local badE = F.edit({ entries = entries, targetSeconds = 1200, music = "m_gold", musicVol = 1, voiceVol = 0.3, category = "tech", color = { b = 90, c = 0, s = 0 }, effects = { "particles", "slowmo", "vignette", "bokeh", "split" } })
assert(good.EditQuality > badE.EditQuality + 20, "buena " .. good.EditQuality .. " mala " .. badE.EditQuality)

-- Miniatura
local t1 = F.thumbnail({ text = "MI PRIMER PC", font = "GothamBlack", textColor = 3, bg = 2, template = "left", stickers = { "arrow" } }, { photoQuality = 60, photoMatches = true, keywordInText = true })
local t2 = F.thumbnail({ text = "esto es un titulo larguisimo que nadie podra leer nunca jamas", font = "Arcade", textColor = 1, bg = 1, template = "center", stickers = { "a", "b", "c", "d", "e" } }, {})
assert(t1.Score > t2.Score + 25, "miniatura buena " .. t1.Score .. " mala " .. t2.Score)
assert(t1.Score <= 100)

-- Visitas con límites
local v0 = F.expectedViews({ subs = 0, quality = 45, ctr = 0.05 })
assert(v0 > 20 and v0 < 400, "visitas iniciales razonables: " .. v0)
local vBig = F.expectedViews({ subs = 0, quality = 100, ctr = 0.1, trend = 1.5, luck = 1.3, viral = 4 })
assert(vBig <= 50000, "límite de visitas")

-- Misiones
assert(#QuestDefs.Achievements >= 100, "logros: " .. #QuestDefs.Achievements)
assert(#QuestDefs.Tutorial == 16)

-- Mundo
assert(#WorldData.Districts == 30, "distritos: " .. #WorldData.Districts)
local seen = {}
for _, d in ipairs(WorldData.Districts) do
	local key = d.Col .. ":" .. d.Row
	assert(not seen[key], "celda repetida " .. key)
	seen[key] = true
	local cx, cz = WorldData.center(d)
	assert(WorldData.districtAt(cx, cz) == d)
end
assert(#WorldData.Spots >= 60)

-- Progresión
local lvl, xp, ups = Progression.applyXp(1, 0, 1000)
assert(lvl > 3 and ups == lvl - 1)
assert(Util.formatInt(1234567) == "1.234.567", Util.formatInt(1234567))
assert(Util.formatShort(1520) == "1,5 K", Util.formatShort(1520))

return "(" .. n .. " objetos, " .. #QuestDefs.Achievements .. " logros, " .. #WorldData.Spots .. " lugares)"
