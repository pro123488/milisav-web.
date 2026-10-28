-- StadiumStages (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/StadiumStages
--
-- Las siete etapas del ESTADIO EVOLUTIVO (FASE 2).
-- Cada etapa tiene:
--   upgradeCost   coste de ascender A esta etapa (gasto de construcción)
--   requirements  reputación mínima e instalaciones mínimas para ascender
--   effects       efectos funcionales permanentes mientras el estadio esté en esta etapa
--   visual        qué elementos visuales se construyen (lo interpreta StadiumRenderer)
--
-- Las instalaciones de FacilityConfig usan `minStage` para desbloquear niveles.
-- Requisitos calibrados para que cada etapa sea alcanzable maximizando la anterior.

local StadiumStages = {
	{
		stage = 1,
		name = "Campo básico",
		description = "Un campo humilde con unas pocas gradas. Aquí empieza tu imperio.",
		upgradeCost = 0,
		requirements = {},
		effects = { attractiveness = 0, sponsorBonus = 0, upkeep = 0, reputation = 0, freeDecorations = 6 },
		visual = { wall = nil, plaza = nil },
	},
	{
		stage = 2,
		name = "Estadio local",
		description = "El barrio entero viene a verte jugar. Desbloquea Zona VIP, Centro de entrenamiento, Academia y Sala de trofeos.",
		upgradeCost = 60000,
		requirements = { reputation = 25, facilities = { stands = 3, pitch = 2, lighting = 1 } },
		effects = { attractiveness = 0.05, sponsorBonus = 300, upkeep = 150, reputation = 5, freeDecorations = 7 },
		visual = { wall = { height = 4, material = "WoodPlanks" }, plaza = "Concrete", gate = true },
	},
	{
		stage = 3,
		name = "Estadio regional",
		description = "Tu club es conocido en toda la región.",
		upgradeCost = 180000,
		requirements = { reputation = 55, facilities = { stands = 4, shop = 3, restaurant = 3, vip = 1 } },
		effects = { attractiveness = 0.10, sponsorBonus = 800, upkeep = 400, reputation = 10, freeDecorations = 8 },
		visual = { wall = { height = 6, material = "Brick" }, plaza = "Cobblestone", gate = true, gateText = true },
	},
	{
		stage = 4,
		name = "Estadio profesional",
		description = "Instalaciones dignas del fútbol profesional. Las esquinas del estadio se cierran con gradas.",
		upgradeCost = 450000,
		requirements = { reputation = 95, facilities = { stands = 5, training = 2, academy = 1 } },
		effects = { attractiveness = 0.15, sponsorBonus = 2000, upkeep = 900, reputation = 20, freeDecorations = 9 },
		visual = { wall = { height = 8, material = "Concrete" }, plaza = "Slate", gate = true, gateText = true, corners = true },
	},
	{
		stage = 5,
		name = "Estadio de élite",
		description = "Uno de los mejores estadios del país, con pantallas gigantes.",
		upgradeCost = 1100000,
		requirements = { reputation = 125, facilities = { stands = 6, vip = 2, trophyRoom = 2 } },
		effects = { attractiveness = 0.22, sponsorBonus = 4500, upkeep = 1800, reputation = 30, freeDecorations = 10 },
		visual = { wall = { height = 10, material = "Concrete", stripe = true }, plaza = "Marble", gate = true, gateText = true, corners = true, screens = true },
	},
	{
		stage = 6,
		name = "Estadio internacional",
		description = "Sede de grandes noches europeas, con anillo de luz.",
		upgradeCost = 2600000,
		requirements = { reputation = 145, facilities = { lighting = 5, shop = 6, restaurant = 6, academy = 3 } },
		effects = { attractiveness = 0.30, sponsorBonus = 9000, upkeep = 3500, reputation = 45, freeDecorations = 11 },
		visual = { wall = { height = 12, material = "Glass", neon = true }, plaza = "Marble", gate = true, gateText = true, corners = true, screens = true, lightRing = true },
	},
	{
		stage = 7,
		name = "Estadio legendario",
		description = "Un templo del fútbol mundial. Acabados dorados y monumento del club.",
		upgradeCost = 6000000,
		requirements = { reputation = 165, facilities = { stands = 7, trophyRoom = 3, vip = 3 } },
		effects = { attractiveness = 0.40, sponsorBonus = 18000, upkeep = 6000, reputation = 60, freeDecorations = 12 },
		visual = { wall = { height = 14, material = "Marble", gold = true }, plaza = "Marble", gate = true, gateText = true, corners = true, screens = true, lightRing = true, monument = true },
	},
}

-- Etapa máxima disponible en la versión actual.
StadiumStages.MAX_STAGE_THIS_PHASE = 7

function StadiumStages.Get(stage)
	return StadiumStages[math.clamp(stage or 1, 1, #StadiumStages)]
end

return StadiumStages
