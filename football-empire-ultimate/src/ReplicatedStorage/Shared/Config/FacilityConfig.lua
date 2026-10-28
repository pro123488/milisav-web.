-- FacilityConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/FacilityConfig
--
-- Catálogo de instalaciones del estadio. Cada nivel define:
--   cost        coste de construir/mejorar HASTA ese nivel (gasto de construcción)
--   upkeep      mantenimiento por ciclo económico
--   staff       coste de personal por ciclo
--   reputation  reputación que aporta
--   minStage    etapa del estadio evolutivo necesaria (ver StadiumStages)
--   requires    { idInstalación = nivelMínimo } necesarios para ese nivel
-- y efectos concretos: capacity, attractiveness, shopSpend, foodSpend, vipIncome, tourRate.
--
-- Para añadir una instalación nueva basta con añadir una entrada aquí y,
-- opcionalmente, un constructor visual en StadiumRenderer.

local FacilityConfig = {}

FacilityConfig.Facilities = {
	pitch = {
		id = "pitch",
		name = "Césped",
		icon = "🌱",
		category = "Terreno de juego",
		description = "La calidad del césped hace más atractivo tu estadio.",
		startLevel = 1,
		levels = {
			{ cost = 0, upkeep = 15, staff = 0, reputation = 1, attractiveness = 0.00, minStage = 1 },
			{ cost = 3500, upkeep = 25, staff = 5, reputation = 3, attractiveness = 0.05, minStage = 1 },
			{ cost = 9000, upkeep = 40, staff = 10, reputation = 6, attractiveness = 0.10, minStage = 1 },
			{ cost = 22000, upkeep = 60, staff = 15, reputation = 10, attractiveness = 0.16, minStage = 2 },
			{ cost = 55000, upkeep = 90, staff = 20, reputation = 15, attractiveness = 0.22, minStage = 3 },
		},
	},
	stands = {
		id = "stands",
		name = "Gradas",
		icon = "🏟️",
		category = "Aforo",
		description = "Más asientos = más aficionados en cada jornada.",
		startLevel = 1,
		designable = true,
		levels = {
			{ cost = 0, upkeep = 20, staff = 0, reputation = 1, capacity = 400, minStage = 1 },
			{ cost = 6000, upkeep = 45, staff = 10, reputation = 3, capacity = 1200, minStage = 1 },
			{ cost = 15000, upkeep = 80, staff = 20, reputation = 6, capacity = 2500, minStage = 1,
				requires = { pitch = 2, lockers = 2 } },
			{ cost = 40000, upkeep = 140, staff = 35, reputation = 10, capacity = 4500, minStage = 2 },
			{ cost = 90000, upkeep = 240, staff = 50, reputation = 16, capacity = 8000, minStage = 3 },
			{ cost = 200000, upkeep = 400, staff = 70, reputation = 24, capacity = 14000, minStage = 4 },
			{ cost = 450000, upkeep = 650, staff = 100, reputation = 32, capacity = 22000, minStage = 6 },
		},
	},
	lighting = {
		id = "lighting",
		name = "Iluminación",
		icon = "💡",
		category = "Ambiente",
		description = "Focos para jornadas nocturnas: más atractivo y reputación.",
		startLevel = 0,
		levels = {
			{ cost = 4000, upkeep = 15, staff = 5, reputation = 2, attractiveness = 0.06, minStage = 1 },
			{ cost = 11000, upkeep = 30, staff = 10, reputation = 4, attractiveness = 0.10, minStage = 1,
				requires = { pitch = 2 } },
			{ cost = 30000, upkeep = 55, staff = 15, reputation = 7, attractiveness = 0.15, minStage = 2 },
			{ cost = 70000, upkeep = 90, staff = 20, reputation = 11, attractiveness = 0.20, minStage = 3 },
			{ cost = 150000, upkeep = 140, staff = 30, reputation = 15, attractiveness = 0.26, minStage = 5 },
		},
	},
	scoreboard = {
		id = "scoreboard",
		name = "Marcador",
		icon = "📟",
		category = "Ambiente",
		description = "Un marcador muestra el nombre de tu club y mejora la experiencia.",
		startLevel = 0,
		levels = {
			{ cost = 2500, upkeep = 8, staff = 0, reputation = 1, attractiveness = 0.04, minStage = 1 },
			{ cost = 8000, upkeep = 18, staff = 5, reputation = 3, attractiveness = 0.07, minStage = 1,
				requires = { lighting = 1 } },
			{ cost = 25000, upkeep = 35, staff = 10, reputation = 6, attractiveness = 0.11, minStage = 2 },
		},
	},
	lockers = {
		id = "lockers",
		name = "Vestuarios",
		icon = "🚿",
		category = "Club",
		description = "Mejores vestuarios aumentan la reputación del club (y la moral de la plantilla en la FASE 4).",
		startLevel = 1,
		designable = true,
		levels = {
			{ cost = 0, upkeep = 10, staff = 0, reputation = 1, minStage = 1 },
			{ cost = 5000, upkeep = 20, staff = 10, reputation = 3, minStage = 1 },
			{ cost = 14000, upkeep = 35, staff = 15, reputation = 5, minStage = 1 },
			{ cost = 35000, upkeep = 60, staff = 25, reputation = 8, minStage = 2 },
		},
	},
	shop = {
		id = "shop",
		name = "Tienda del club",
		icon = "🛍️",
		category = "Comercial",
		description = "Cada aficionado que asiste gasta en camisetas y bufandas.",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 3000, upkeep = 15, staff = 15, reputation = 1, shopSpend = 0.8, minStage = 1 },
			{ cost = 9000, upkeep = 30, staff = 25, reputation = 2, shopSpend = 1.4, minStage = 1 },
			{ cost = 20000, upkeep = 55, staff = 35, reputation = 3, shopSpend = 2.1, minStage = 1,
				requires = { stands = 3 } },
			{ cost = 45000, upkeep = 95, staff = 50, reputation = 5, shopSpend = 2.9, minStage = 2 },
			{ cost = 100000, upkeep = 160, staff = 70, reputation = 7, shopSpend = 3.8, minStage = 3 },
			{ cost = 220000, upkeep = 260, staff = 95, reputation = 10, shopSpend = 5.0, minStage = 5 },
		},
	},
	restaurant = {
		id = "restaurant",
		name = "Restaurante",
		icon = "🍔",
		category = "Comercial",
		description = "Comida y bebida para los aficionados en cada jornada.",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 3500, upkeep = 18, staff = 15, reputation = 1, foodSpend = 1.0, minStage = 1 },
			{ cost = 10000, upkeep = 35, staff = 25, reputation = 2, foodSpend = 1.7, minStage = 1 },
			{ cost = 23000, upkeep = 60, staff = 35, reputation = 3, foodSpend = 2.5, minStage = 1,
				requires = { stands = 3 } },
			{ cost = 50000, upkeep = 100, staff = 50, reputation = 5, foodSpend = 3.4, minStage = 2 },
			{ cost = 110000, upkeep = 170, staff = 70, reputation = 7, foodSpend = 4.4, minStage = 3 },
			{ cost = 240000, upkeep = 280, staff = 95, reputation = 10, foodSpend = 5.6, minStage = 5 },
		},
	},

	-- ===== Instalaciones comerciales (FASE 3) =====
	kiosks = {
		id = "kiosks",
		name = "Quioscos",
		icon = "🌭",
		category = "Comercial",
		description = "Puestos de comida junto a las gradas: más gasto en restauración por espectador.",
		startLevel = 0,
		levels = {
			{ cost = 2500, upkeep = 8, staff = 10, reputation = 1, foodSpend = 0.3, minStage = 1 },
			{ cost = 7000, upkeep = 16, staff = 15, reputation = 1, foodSpend = 0.6, minStage = 1 },
			{ cost = 18000, upkeep = 30, staff = 25, reputation = 2, foodSpend = 1.0, minStage = 2 },
		},
	},
	tour = {
		id = "tour",
		name = "Tour del estadio",
		icon = "🗺️",
		category = "Comercial",
		description = "Visitas guiadas: ingresos en cada jornada según la reputación del club.",
		startLevel = 0,
		levels = {
			{ cost = 25000, upkeep = 40, staff = 20, reputation = 2, tourRate = 8, minStage = 2 },
			{ cost = 80000, upkeep = 80, staff = 35, reputation = 4, tourRate = 15, minStage = 3 },
			{ cost = 220000, upkeep = 150, staff = 60, reputation = 7, tourRate = 25, minStage = 5 },
		},
	},

	-- ===== Instalaciones que se desbloquean con el ESTADIO EVOLUTIVO (FASE 2+) =====
	vip = {
		id = "vip",
		name = "Zona VIP",
		icon = "🥂",
		category = "Comercial",
		description = "Palcos para patrocinadores e invitados. Ingresos extra por jornada.",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 50000, upkeep = 120, staff = 40, reputation = 6, vipIncome = 900, minStage = 2 },
			{ cost = 120000, upkeep = 220, staff = 60, reputation = 10, vipIncome = 2200, minStage = 3 },
			{ cost = 300000, upkeep = 400, staff = 90, reputation = 16, vipIncome = 5000, minStage = 5 },
		},
	},
	training = {
		id = "training",
		name = "Centro de entrenamiento",
		icon = "🏋️",
		category = "Deportivo",
		description = "Aumenta la reputación del club. Mejorará el desarrollo de la plantilla en la FASE 4.",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 40000, upkeep = 100, staff = 40, reputation = 4, minStage = 2 },
			{ cost = 110000, upkeep = 200, staff = 70, reputation = 8, minStage = 3 },
			{ cost = 280000, upkeep = 380, staff = 110, reputation = 13, minStage = 4 },
		},
	},
	academy = {
		id = "academy",
		name = "Academia juvenil",
		icon = "🧒",
		category = "Deportivo",
		description = "Aumenta la reputación del club. Será la base de la CANTERA GENERACIONAL (FASE 4).",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 45000, upkeep = 110, staff = 45, reputation = 4, minStage = 2 },
			{ cost = 120000, upkeep = 220, staff = 80, reputation = 8, minStage = 3 },
			{ cost = 300000, upkeep = 400, staff = 120, reputation = 13, minStage = 5 },
		},
	},
	trophyRoom = {
		id = "trophyRoom",
		name = "Sala de trofeos",
		icon = "🏆",
		category = "Club",
		description = "Atractivo para los visitantes. Exhibirá los títulos reales del club (FASES 7-8).",
		startLevel = 0,
		designable = true,
		levels = {
			{ cost = 30000, upkeep = 40, staff = 10, reputation = 5, attractiveness = 0.03, minStage = 2 },
			{ cost = 90000, upkeep = 80, staff = 20, reputation = 9, attractiveness = 0.06, minStage = 4 },
			{ cost = 250000, upkeep = 150, staff = 35, reputation = 14, attractiveness = 0.09, minStage = 6 },
		},
	},
}

-- Orden en la interfaz de construcción.
FacilityConfig.Order = {
	"pitch", "stands", "lighting", "scoreboard", "lockers", "shop", "restaurant",
	"kiosks", "tour", "vip", "training", "academy", "trophyRoom",
}

function FacilityConfig.Get(id)
	return FacilityConfig.Facilities[id]
end

function FacilityConfig.MaxLevel(id)
	local def = FacilityConfig.Facilities[id]
	return def and #def.levels or 0
end

-- Devuelve los datos del nivel `level` (nil si level == 0 o no existe).
function FacilityConfig.LevelData(id, level)
	local def = FacilityConfig.Facilities[id]
	if not def or level < 1 then
		return nil
	end
	return def.levels[level]
end

return FacilityConfig
