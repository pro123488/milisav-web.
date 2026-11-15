-- CollectionConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/CollectionConfig
--
-- MASCOTAS Y BALONES COLECCIONABLES con rarezas.
--   * Los huevos y las cajas se compran con el dinero del club (no con Robux).
--   * Las probabilidades de cada rareza se muestran SIEMPRE en la interfaz.
--   * Mascotas: hasta MAX_EQUIPPED_PETS te siguen y suman un bonus a las recompensas de los
--     partidos en grupo. Balones: solo cambian el aspecto del balón (color, estela, brillo).

local CollectionConfig = {}

CollectionConfig.MAX_EQUIPPED_PETS = 3 -- base; los renacimientos suman huecos (RebirthConfig.PET_SLOT_AT)
CollectionConfig.ABSOLUTE_MAX_PETS = 5
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

	-- pool = "jungle": solo salen del Huevo de la selva
	{ id = "frog", pool = "jungle", name = "Rana", icon = "🐸", rarity = "common", bonus = 0.02, body = Color3.fromRGB(90, 200, 80), accent = Color3.fromRGB(230, 250, 200), ears = "round" },
	{ id = "chameleon", pool = "jungle", name = "Camaleón", icon = "🦎", rarity = "common", bonus = 0.02, body = Color3.fromRGB(60, 190, 160), accent = Color3.fromRGB(255, 210, 80), ears = "none", fin = true },
	{ id = "parrot", pool = "jungle", name = "Loro", icon = "🦜", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(230, 50, 50), accent = Color3.fromRGB(60, 140, 255), ears = "none", beak = true, wings = true },
	{ id = "monkey", pool = "jungle", name = "Mono", icon = "🐵", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(140, 95, 60), accent = Color3.fromRGB(240, 200, 160), ears = "round" },
	{ id = "tiger", pool = "jungle", name = "Tigre", icon = "🐯", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(245, 140, 30), accent = Color3.fromRGB(30, 25, 25), ears = "round" },
	{ id = "gorilla", pool = "jungle", name = "Gorila rey", icon = "🦍", rarity = "legendary", bonus = 0.15, body = Color3.fromRGB(55, 55, 65), accent = Color3.fromRGB(150, 140, 135), ears = "round", mane = true, sparkles = Color3.fromRGB(255, 220, 120) },
	{ id = "jaguar", pool = "jungle", name = "Jaguar dorado", icon = "🐆", rarity = "mythic", bonus = 0.25, body = Color3.fromRGB(255, 200, 60), accent = Color3.fromRGB(120, 70, 20), ears = "round", neon = true, sparkles = Color3.fromRGB(255, 240, 150) },

	-- pool = "ocean": solo salen del Huevo oceánico
	{ id = "clownfish", pool = "ocean", name = "Pez payaso", icon = "🐠", rarity = "common", bonus = 0.02, body = Color3.fromRGB(255, 130, 30), accent = Color3.fromRGB(255, 255, 255), ears = "none", fin = true },
	{ id = "crab", pool = "ocean", name = "Cangrejo", icon = "🦀", rarity = "common", bonus = 0.02, body = Color3.fromRGB(220, 60, 50), accent = Color3.fromRGB(255, 200, 180), ears = "round" },
	{ id = "turtle", pool = "ocean", name = "Tortuga", icon = "🐢", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(90, 160, 80), accent = Color3.fromRGB(150, 110, 60), ears = "none", fin = true },
	{ id = "jellyfish", pool = "ocean", name = "Medusa", icon = "🪼", rarity = "rare", bonus = 0.05, body = Color3.fromRGB(220, 150, 255), accent = Color3.fromRGB(255, 220, 255), ears = "long", neon = true },
	{ id = "octopus", pool = "ocean", name = "Pulpo", icon = "🐙", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(200, 70, 160), accent = Color3.fromRGB(255, 180, 230), ears = "floppy" },
	{ id = "dolphin", pool = "ocean", name = "Delfín", icon = "🐬", rarity = "epic", bonus = 0.09, body = Color3.fromRGB(110, 170, 230), accent = Color3.fromRGB(235, 245, 255), ears = "none", fin = true, beak = true },
	{ id = "kraken", pool = "ocean", name = "Kraken", icon = "🦑", rarity = "legendary", bonus = 0.15, body = Color3.fromRGB(110, 40, 140), accent = Color3.fromRGB(80, 230, 200), ears = "floppy", sparkles = Color3.fromRGB(120, 255, 220) },
	{ id = "leviathan", pool = "ocean", name = "Leviatán de cristal", icon = "🐋", rarity = "mythic", bonus = 0.25, body = Color3.fromRGB(150, 230, 255), accent = Color3.fromRGB(255, 255, 255), ears = "none", fin = true, neon = true, sparkles = Color3.fromRGB(220, 250, 255) },

	-- pool = "rebirth": solo salen del Huevo renacido (hace falta haber renacido)
	{ id = "moonwolf", pool = "rebirth", name = "Lobo lunar", icon = "🐺", rarity = "epic", bonus = 0.12, body = Color3.fromRGB(170, 180, 220), accent = Color3.fromRGB(60, 70, 120), ears = "pointy", sparkles = Color3.fromRGB(200, 210, 255) },
	{ id = "griffin", pool = "rebirth", name = "Grifo", icon = "🦅", rarity = "legendary", bonus = 0.20, body = Color3.fromRGB(230, 190, 110), accent = Color3.fromRGB(255, 255, 255), ears = "pointy", beak = true, wings = true, sparkles = Color3.fromRGB(255, 230, 160) },
	{ id = "shadowdragon", pool = "rebirth", name = "Dragón de sombra", icon = "🐲", rarity = "legendary", bonus = 0.20, body = Color3.fromRGB(40, 30, 60), accent = Color3.fromRGB(170, 80, 255), ears = "pointy", wings = true, horn = true, sparkles = Color3.fromRGB(190, 120, 255) },
	{ id = "goalangel", pool = "rebirth", name = "Ángel del gol", icon = "😇", rarity = "mythic", bonus = 0.35, body = Color3.fromRGB(255, 255, 245), accent = Color3.fromRGB(255, 215, 80), ears = "none", wings = true, horn = true, neon = true, sparkles = Color3.fromRGB(255, 245, 190) },
}

-- weights = probabilidad (%) de cada rareza. Dentro de una rareza, todas las mascotas valen igual.
CollectionConfig.Eggs = {
	{ id = "basic", name = "Huevo básico", icon = "🥚", cost = 5000, weights = { common = 70, rare = 24, epic = 5, legendary = 0.9, mythic = 0.1 } },
	{ id = "golden", name = "Huevo dorado", icon = "🌟", cost = 40000, weights = { common = 35, rare = 40, epic = 19, legendary = 5, mythic = 1 } },
	{ id = "champion", name = "Huevo de campeón", icon = "🏆", cost = 250000, weights = { common = 0, rare = 45, epic = 38, legendary = 14, mythic = 3 } },
	-- Huevos temáticos: cada uno tiene sus propias mascotas (pool)
	{ id = "jungle", pool = "jungle", name = "Huevo de la selva", icon = "🌴", cost = 80000, weights = { common = 55, rare = 30, epic = 11, legendary = 3.5, mythic = 0.5 } },
	{ id = "ocean", pool = "ocean", name = "Huevo oceánico", icon = "🌊", cost = 150000, weights = { common = 40, rare = 36, epic = 18, legendary = 5, mythic = 1 } },
	{ id = "rebirth", pool = "rebirth", name = "Huevo renacido", icon = "🔄", cost = 500000, requiresRebirth = 1, weights = { common = 0, rare = 0, epic = 70, legendary = 26, mythic = 4 } },
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
	{ id = "leather", name = "Cuero retro", icon = "🟤", rarity = "common", color = Color3.fromRGB(140, 85, 45), material = "Leather" },
	{ id = "pink", name = "Chicle", icon = "🩷", rarity = "common", color = Color3.fromRGB(255, 130, 200), material = "SmoothPlastic" },
	{ id = "camo", name = "Camuflaje", icon = "🪖", rarity = "common", color = Color3.fromRGB(95, 115, 60), material = "Fabric" },
	{ id = "stone", name = "Piedra", icon = "🪨", rarity = "rare", color = Color3.fromRGB(130, 130, 135), material = "Rock", trail = { Color3.fromRGB(200, 200, 200), Color3.fromRGB(90, 90, 95) } },
	{ id = "ruby", name = "Rubí", icon = "♦️", rarity = "rare", color = Color3.fromRGB(220, 20, 60), material = "Glass", trail = { Color3.fromRGB(255, 120, 150), Color3.fromRGB(180, 0, 40) }, sparkles = Color3.fromRGB(255, 120, 150) },
	{ id = "emerald", name = "Esmeralda", icon = "💚", rarity = "rare", color = Color3.fromRGB(30, 200, 110), material = "Glass", trail = { Color3.fromRGB(150, 255, 190), Color3.fromRGB(10, 140, 70) }, sparkles = Color3.fromRGB(150, 255, 190) },
	{ id = "storm", name = "Tormenta", icon = "⚡", rarity = "epic", color = Color3.fromRGB(80, 90, 140), material = "Neon", trail = { Color3.fromRGB(255, 255, 140), Color3.fromRGB(120, 160, 255) }, light = Color3.fromRGB(180, 200, 255), sparkles = Color3.fromRGB(255, 255, 160) },
	{ id = "plasma", name = "Plasma", icon = "🟣", rarity = "epic", color = Color3.fromRGB(255, 60, 255), material = "ForceField", trail = { Color3.fromRGB(255, 160, 255), Color3.fromRGB(120, 40, 255) }, light = Color3.fromRGB(255, 120, 255) },
	{ id = "solar", name = "Sol", icon = "☀️", rarity = "legendary", color = Color3.fromRGB(255, 170, 30), material = "Neon", trail = { Color3.fromRGB(255, 255, 180), Color3.fromRGB(255, 120, 0) }, fire = true, light = Color3.fromRGB(255, 190, 80) },
	{ id = "void", name = "Vacío", icon = "⚫", rarity = "mythic", color = Color3.fromRGB(10, 10, 15), material = "Neon", trail = { Color3.fromRGB(120, 255, 255), Color3.fromRGB(255, 80, 255), Color3.fromRGB(0, 0, 0) }, light = Color3.fromRGB(120, 255, 255), sparkles = Color3.fromRGB(150, 255, 255) },
}
-- Balones exclusivos del pase de temporada y de los renacimientos (exclusive = no salen en las cajas)
for _, ball in ipairs({
	{ id = "rebirth_phoenix", name = "Fénix renacido", icon = "🔥", rarity = "mythic", color = Color3.fromRGB(255, 110, 30), material = "Neon", trail = { Color3.fromRGB(255, 240, 120), Color3.fromRGB(255, 60, 20), Color3.fromRGB(150, 0, 60) }, fire = true, light = Color3.fromRGB(255, 140, 60), sparkles = Color3.fromRGB(255, 210, 120) },
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

-- ===== Mascotas doradas =====
-- Cada mascota normal tiene una versión dorada que se consigue FUSIONANDO FUSE_COUNT copias.
-- Se generan aquí (id «gold_<id>», grupo «golden»): ningún huevo las da directamente.
CollectionConfig.FUSE_COUNT = 5
CollectionConfig.GOLDEN_BONUS = 2.5 -- multiplica el bonus de la mascota normal
CollectionConfig.GOLDEN_SELL = 3 -- multiplica el precio de venta
local GOLD = Color3.fromRGB(255, 205, 60)
local basePets = {}
for _, pet in ipairs(CollectionConfig.Pets) do
	table.insert(basePets, pet)
end
for _, pet in ipairs(basePets) do
	local golden = table.clone(pet)
	golden.id = "gold_" .. pet.id
	golden.base = pet.id
	golden.basePool = pet.pool
	golden.pool = "golden"
	golden.golden = true
	golden.name = pet.name .. " dorado"
	golden.bonus = math.floor(pet.bonus * CollectionConfig.GOLDEN_BONUS * 100 + 0.5) / 100
	golden.body = pet.body:Lerp(GOLD, 0.6)
	golden.accent = GOLD
	golden.sparkles = Color3.fromRGB(255, 235, 140)
	table.insert(CollectionConfig.Pets, golden)
end

-- ÍNDICE: premio (una vez) por haber descubierto todas las mascotas normales de un grupo
CollectionConfig.IndexRewards = {
	{ pool = "classic", name = "Clásicas", icon = "🥚", money = 50000, egg = "golden" },
	{ pool = "jungle", name = "Selva", icon = "🌴", money = 150000, egg = "champion" },
	{ pool = "ocean", name = "Océano", icon = "🌊", money = 300000, egg = "champion" },
	{ pool = "rebirth", name = "Renacidas", icon = "🔄", money = 1000000, egg = "rebirth" },
}
CollectionConfig.SELL_DUPLICATES_RARITIES = { common = true, rare = true } -- «Vender repetidas» (se queda 1)

-- Mascotas normales de un grupo (las que cuentan para el índice)
function CollectionConfig.PetsOfPool(pool)
	local list = {}
	for _, pet in ipairs(CollectionConfig.Pets) do
		if not pet.golden and (pet.pool or "classic") == pool then
			table.insert(list, pet)
		end
	end
	return list
end

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
