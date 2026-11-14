-- CollectionConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/CollectionConfig
--
-- MASCOTAS Y BALONES COLECCIONABLES con rarezas.
--   * Los huevos y las cajas se compran con el dinero del club (no con Robux).
--   * Las probabilidades de cada rareza se muestran SIEMPRE en la interfaz.
--   * Mascotas: hasta MAX_EQUIPPED_PETS te siguen y suman un bonus a las recompensas de los
--     partidos en grupo. Balones: solo cambian el aspecto del balón (color, estela, brillo).

local CollectionConfig = {}

CollectionConfig.MAX_EQUIPPED_PETS = 3
CollectionConfig.DUPLICATE_BALL_REFUND = 0.5 -- balón repetido: se devuelve la mitad de la caja

CollectionConfig.Rarities = {
	{ id = "common", name = "Común", color = Color3.fromRGB(190, 195, 205), hex = "#BEC3CD", sell = 500 },
	{ id = "rare", name = "Raro", color = Color3.fromRGB(70, 150, 255), hex = "#4696FF", sell = 2500 },
	{ id = "epic", name = "Épico", color = Color3.fromRGB(175, 85, 255), hex = "#AF55FF", sell = 10000 },
	{ id = "legendary", name = "Legendario", color = Color3.fromRGB(255, 190, 40), hex = "#FFBE28", sell = 40000 },
	{ id = "mythic", name = "Mítico", color = Color3.fromRGB(255, 70, 130), hex = "#FF4682", sell = 150000 },
}

-- bonus = fracción que suma a las recompensas de los partidos en grupo mientras está equipada.
-- Aspecto: body/accent = colores · ears = floppy|pointy|long|round|none · extra = rasgos opcionales.
CollectionConfig.Pets = {
	{ id = "puppy", name = "Perrito", icon = "🐶", rarity = "common", bonus = 0.02, body = Color3.fromRGB(200, 150, 100), accent = Color3.fromRGB(120, 80, 50), ears = "floppy" },
	{ id = "kitten", name = "Gatito", icon = "🐱", rarity = "common", bonus = 0.02, body = Color3.fromRGB(240, 170, 90), accent = Color3.fromRGB(255, 240, 220), ears = "pointy" },
	{ id = "bunny", name = "Conejito", icon = "🐰", rarity = "common", bonus = 0.02, body = Color3.fromRGB(245, 245, 245), accent = Color3.fromRGB(255, 180, 200), ears = "long" },
	{ id = "chick", name = "Pollito", icon = "🐥", rarity = "common", bonus = 0.02, body = Color3.fromRGB(255, 225, 80), accent = Color3.fromRGB(255, 150, 40), ears = "none", beak = true },
	{ id = "fox", name = "Zorro", icon = "🦊", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(235, 120, 40), accent = Color3.fromRGB(250, 250, 250), ears = "pointy" },
	{ id = "panda", name = "Panda", icon = "🐼", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(245, 245, 245), accent = Color3.fromRGB(30, 30, 35), ears = "round" },
	{ id = "penguin", name = "Pingüino", icon = "🐧", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(40, 45, 60), accent = Color3.fromRGB(250, 250, 250), ears = "none", beak = true, wings = true },
	{ id = "lion", name = "León", icon = "🦁", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(235, 185, 90), accent = Color3.fromRGB(150, 90, 30), ears = "round", mane = true },
	{ id = "eagle", name = "Águila", icon = "🦅", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(110, 75, 45), accent = Color3.fromRGB(250, 250, 250), ears = "none", beak = true, wings = true },
	{ id = "shark", name = "Tiburón", icon = "🦈", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(90, 130, 170), accent = Color3.fromRGB(235, 240, 245), ears = "none", fin = true },
	{ id = "dragon", name = "Dragón", icon = "🐉", rarity = "legendary", bonus = 0.15, body = Color3.fromRGB(60, 170, 90), accent = Color3.fromRGB(255, 200, 60), ears = "pointy", wings = true, horn = true, sparkles = Color3.fromRGB(120, 255, 150) },
	{ id = "unicorn", name = "Unicornio", icon = "🦄", rarity = "legendary", bonus = 0.15, body = Color3.fromRGB(250, 245, 255), accent = Color3.fromRGB(255, 130, 220), ears = "pointy", horn = true, sparkles = Color3.fromRGB(255, 170, 240) },
	{ id = "phoenix", name = "Fénix dorado", icon = "🔥", rarity = "mythic", bonus = 0.25, body = Color3.fromRGB(255, 150, 30), accent = Color3.fromRGB(255, 225, 80), ears = "none", beak = true, wings = true, fire = true, neon = true },
	{ id = "goldenball", name = "Balonín de oro", icon = "🏆", rarity = "mythic", bonus = 0.25, body = Color3.fromRGB(255, 205, 50), accent = Color3.fromRGB(255, 245, 190), ears = "none", neon = true, sparkles = Color3.fromRGB(255, 230, 120) },
}

-- weights = probabilidad (%) de cada rareza. Dentro de una rareza, todas las mascotas valen igual.
CollectionConfig.Eggs = {
	{ id = "basic", name = "Huevo básico", icon = "🥚", cost = 5000, weights = { common = 70, rare = 24, epic = 5, legendary = 0.9, mythic = 0.1 } },
	{ id = "golden", name = "Huevo dorado", icon = "🌟", cost = 40000, weights = { common = 35, rare = 40, epic = 19, legendary = 5, mythic = 1 } },
	{ id = "champion", name = "Huevo de campeón", icon = "🏆", cost = 250000, weights = { common = 0, rare = 45, epic = 38, legendary = 14, mythic = 3 } },
}

-- Aspecto: color + material · trail = colores de la estela · sparkles/fire/light opcionales.
CollectionConfig.Balls = {
	{ id = "classic", name = "Clásico", icon = "⚽", rarity = "common", color = Color3.fromRGB(250, 250, 250), material = "SmoothPlastic" },
	{ id = "street", name = "Callejero naranja", icon = "🟠", rarity = "common", color = Color3.fromRGB(255, 140, 40), material = "SmoothPlastic" },
	{ id = "ocean", name = "Azul océano", icon = "🔵", rarity = "common", color = Color3.fromRGB(50, 120, 240), material = "SmoothPlastic" },
	{ id = "lime", name = "Verde lima", icon = "🟢", rarity = "common", color = Color3.fromRGB(120, 230, 70), material = "SmoothPlastic" },
	{ id = "fire", name = "Bola de fuego", icon = "🔥", rarity = "rare", color = Color3.fromRGB(255, 80, 30), material = "Neon", trail = { Color3.fromRGB(255, 200, 40), Color3.fromRGB(255, 60, 20) } },
	{ id = "ice", name = "Hielo", icon = "🧊", rarity = "rare", color = Color3.fromRGB(150, 225, 255), material = "Glass", trail = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(90, 190, 255) } },
	{ id = "toxic", name = "Tóxico neón", icon = "☢️", rarity = "rare", color = Color3.fromRGB(140, 255, 60), material = "Neon", trail = { Color3.fromRGB(200, 255, 120), Color3.fromRGB(40, 200, 60) } },
	{ id = "gold", name = "Oro macizo", icon = "🥇", rarity = "epic", color = Color3.fromRGB(255, 200, 50), material = "Metal", trail = { Color3.fromRGB(255, 240, 160), Color3.fromRGB(255, 180, 30) }, sparkles = Color3.fromRGB(255, 225, 120) },
	{ id = "galaxy", name = "Galaxia", icon = "🌌", rarity = "epic", color = Color3.fromRGB(110, 60, 220), material = "Neon", trail = { Color3.fromRGB(255, 120, 255), Color3.fromRGB(60, 80, 255) }, sparkles = Color3.fromRGB(200, 160, 255) },
	{ id = "lava", name = "Lava", icon = "🌋", rarity = "epic", color = Color3.fromRGB(200, 50, 20), material = "CrackedLava", trail = { Color3.fromRGB(255, 160, 40), Color3.fromRGB(120, 20, 10) }, light = Color3.fromRGB(255, 110, 40) },
	{ id = "diamond", name = "Diamante", icon = "💎", rarity = "legendary", color = Color3.fromRGB(170, 240, 255), material = "Glass", trail = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(120, 230, 255) }, sparkles = Color3.fromRGB(200, 250, 255), light = Color3.fromRGB(170, 240, 255) },
	{ id = "rainbow", name = "Arcoíris", icon = "🌈", rarity = "legendary", color = Color3.fromRGB(255, 90, 160), material = "Neon", trail = { Color3.fromRGB(255, 60, 60), Color3.fromRGB(255, 220, 60), Color3.fromRGB(60, 220, 120), Color3.fromRGB(70, 130, 255) }, sparkles = Color3.fromRGB(255, 255, 255) },
	{ id = "champion", name = "Balón del campeón", icon = "👑", rarity = "mythic", color = Color3.fromRGB(255, 215, 70), material = "Neon", trail = { Color3.fromRGB(255, 255, 220), Color3.fromRGB(255, 190, 30) }, sparkles = Color3.fromRGB(255, 240, 150), fire = true, light = Color3.fromRGB(255, 210, 90) },
}
-- Balones exclusivos del pase de temporada (exclusive = no salen en las cajas)
for _, ball in ipairs({
	{ id = "season_fire", name = "Meteorito", icon = "☄️", rarity = "legendary", color = Color3.fromRGB(170, 40, 20), material = "CrackedLava", trail = { Color3.fromRGB(255, 220, 80), Color3.fromRGB(255, 70, 20) }, fire = true },
	{ id = "season_fire_elite", name = "Sol ardiente", icon = "🌞", rarity = "mythic", color = Color3.fromRGB(255, 190, 40), material = "Neon", trail = { Color3.fromRGB(255, 255, 200), Color3.fromRGB(255, 120, 20) }, fire = true, light = Color3.fromRGB(255, 190, 80), sparkles = Color3.fromRGB(255, 230, 140) },
	{ id = "season_ice", name = "Copo polar", icon = "❄️", rarity = "legendary", color = Color3.fromRGB(215, 240, 255), material = "Ice", trail = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(120, 200, 255) }, sparkles = Color3.fromRGB(220, 245, 255) },
	{ id = "season_ice_elite", name = "Aurora boreal", icon = "🌠", rarity = "mythic", color = Color3.fromRGB(90, 255, 200), material = "Neon", trail = { Color3.fromRGB(90, 255, 200), Color3.fromRGB(120, 140, 255), Color3.fromRGB(220, 120, 255) }, light = Color3.fromRGB(120, 255, 220), sparkles = Color3.fromRGB(200, 255, 240) },
	{ id = "season_galaxy", name = "Nebulosa", icon = "🔮", rarity = "legendary", color = Color3.fromRGB(150, 70, 230), material = "Neon", trail = { Color3.fromRGB(255, 140, 255), Color3.fromRGB(90, 60, 220) }, sparkles = Color3.fromRGB(230, 180, 255) },
	{ id = "season_galaxy_elite", name = "Agujero negro", icon = "🕳️", rarity = "mythic", color = Color3.fromRGB(15, 10, 25), material = "Glass", trail = { Color3.fromRGB(200, 120, 255), Color3.fromRGB(20, 10, 40) }, light = Color3.fromRGB(170, 90, 255), sparkles = Color3.fromRGB(190, 130, 255) },
	{ id = "season_gold", name = "Corona real", icon = "👑", rarity = "legendary", color = Color3.fromRGB(255, 205, 60), material = "Metal", trail = { Color3.fromRGB(255, 245, 190), Color3.fromRGB(255, 190, 40) }, sparkles = Color3.fromRGB(255, 235, 150) },
	{ id = "season_gold_elite", name = "Balón de platino", icon = "💠", rarity = "mythic", color = Color3.fromRGB(225, 232, 245), material = "Metal", trail = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(170, 200, 255) }, light = Color3.fromRGB(220, 230, 255), sparkles = Color3.fromRGB(255, 255, 255) },
}) do
	ball.exclusive = true
	table.insert(CollectionConfig.Balls, ball)
end
CollectionConfig.DEFAULT_BALL = "classic"

CollectionConfig.Crates = {
	{ id = "crate", name = "Caja de balones", icon = "📦", cost = 8000, weights = { common = 60, rare = 30, epic = 8.5, legendary = 1.3, mythic = 0.2 } },
	{ id = "elite", name = "Caja de élite", icon = "🎁", cost = 120000, weights = { common = 0, rare = 50, epic = 36, legendary = 11, mythic = 3 } },
}

-- ===== Índices y utilidades =====
local function index(list)
	local byId = {}
	for _, item in ipairs(list) do
		byId[item.id] = item
	end
	return byId
end
CollectionConfig.RarityById = index(CollectionConfig.Rarities)
CollectionConfig.PetById = index(CollectionConfig.Pets)
CollectionConfig.EggById = index(CollectionConfig.Eggs)
CollectionConfig.BallById = index(CollectionConfig.Balls)
CollectionConfig.CrateById = index(CollectionConfig.Crates)

-- Probabilidades reales (%) tras aplicar la suerte: multiplica las rarezas épica o superior y renormaliza.
-- La usan el servidor para sortear y la interfaz para mostrar exactamente lo mismo.
function CollectionConfig.Odds(weights, luck)
	luck = type(luck) == "number" and math.clamp(luck, 1, 10) or 1
	local scaled, total = {}, 0
	for _, rarity in ipairs(CollectionConfig.Rarities) do
		local weight = weights[rarity.id] or 0
		if rarity.id == "epic" or rarity.id == "legendary" or rarity.id == "mythic" then
			weight *= luck
		end
		scaled[rarity.id] = weight
		total += weight
	end
	local odds = {}
	for id, weight in pairs(scaled) do
		odds[id] = total > 0 and weight / total * 100 or 0
	end
	return odds
end

return CollectionConfig
