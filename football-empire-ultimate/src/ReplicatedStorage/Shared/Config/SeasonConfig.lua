-- SeasonConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/SeasonConfig
--
-- PASE DE TEMPORADA (estilo «pase de batalla»).
--   * Cada temporada dura 28 días y empieza sola (se calcula con la fecha).
--   * Jugando se ganan puntos; cada XP_PER_TIER puntos se sube un nivel (hasta TIERS).
--   * Pista GRATIS: dinero, huevos y cajas. Pista PREMIUM: solo cosméticos (balones y trajes
--     exclusivos y cajas de balones). El premium no da dinero ni mascotas: no es pay-to-win.
--
-- ⚠️ PREMIUM_PRODUCT_ID = 0 significa «PENDIENTE DE CONFIGURACIÓN».
--   El premium se vende con un Developer Product (una compra por temporada). Hasta que lo crees
--   en el Creator Dashboard (Monetización > Productos de desarrollador) y pongas aquí su ID,
--   el botón de compra aparece desactivado y nadie puede tener la pista premium.

local Config = script.Parent
local CollectionConfig = require(Config.CollectionConfig)
local OutfitConfig = require(Config.OutfitConfig)
local WeeklyConfig = require(Config.WeeklyConfig)

local SeasonConfig = {}

SeasonConfig.PREMIUM_PRODUCT_ID = 0 -- TODO: pega aquí el ID del Developer Product «Pase de temporada premium»

SeasonConfig.EPOCH = WeeklyConfig.EPOCH -- la temporada 1 empezó el lunes 2/11/2026 00:00 UTC
SeasonConfig.SEASON_SECONDS = 28 * 86400
SeasonConfig.TIERS = 20
SeasonConfig.XP_PER_TIER = 120

-- Puntos del pase por cada cosa que haces (los concede el servidor)
SeasonConfig.XP = {
	match = 20, -- jugar un partido en grupo
	win = 15, -- ganarlo
	goal = 5, -- cada gol tuyo (máx. MAX_GOALS_XP por partido)
	dailyMission = 15, -- reclamar una misión diaria
	chainMission = 25, -- reclamar una misión de progreso
	hatch = 3, -- abrir un huevo
	crate = 3, -- abrir una caja de balones
	cycle = 2, -- cada jornada que pasas jugando
	dailyLogin = 40, -- primera conexión del día (UTC)
}
SeasonConfig.MAX_GOALS_XP = 5

-- Las temporadas van rotando por estos temas; cada uno tiene sus exclusivos de la pista premium.
SeasonConfig.Themes = {
	{ id = "fire", name = "Temporada de Fuego", icon = "🔥", ball = "season_fire", outfit = "season_fire", eliteBall = "season_fire_elite" },
	{ id = "ice", name = "Temporada de Hielo", icon = "❄️", ball = "season_ice", outfit = "season_ice", eliteBall = "season_ice_elite" },
	{ id = "galaxy", name = "Temporada Galáctica", icon = "🌌", ball = "season_galaxy", outfit = "season_galaxy", eliteBall = "season_galaxy_elite" },
	{ id = "gold", name = "Temporada Dorada", icon = "👑", ball = "season_gold", outfit = "season_gold", eliteBall = "season_gold_elite" },
}

-- Temporada en curso: { number, theme, startsAt, endsAt }
function SeasonConfig.Current(now)
	now = now or os.time()
	local index = math.max(0, math.floor((now - SeasonConfig.EPOCH) / SeasonConfig.SEASON_SECONDS))
	return {
		number = index + 1,
		theme = SeasonConfig.Themes[index % #SeasonConfig.Themes + 1],
		startsAt = SeasonConfig.EPOCH + index * SeasonConfig.SEASON_SECONDS,
		endsAt = SeasonConfig.EPOCH + (index + 1) * SeasonConfig.SEASON_SECONDS,
	}
end

local function money(amount)
	return { type = "money", amount = amount }
end
local function egg(id)
	return { type = "egg", egg = id }
end
local function crate(id)
	return { type = "crate", crate = id }
end

local FREE = {
	money(2000), money(3000), egg("basic"), money(4000), money(5000),
	crate("crate"), money(6000), egg("basic"), money(8000), egg("golden"),
	money(10000), crate("crate"), money(12000), egg("basic"), money(15000),
	egg("golden"), money(20000), crate("crate"), money(25000), egg("champion"),
}

-- Recompensas de una temporada: lista de TIERS elementos { free = recompensa, premium = recompensa o nil }
function SeasonConfig.Rewards(seasonNumber)
	local theme = SeasonConfig.Themes[(math.max(1, seasonNumber) - 1) % #SeasonConfig.Themes + 1]
	local premium = {
		[1] = { type = "ball", id = theme.ball },
		[4] = crate("crate"),
		[7] = crate("crate"),
		[10] = { type = "outfit", id = theme.outfit },
		[13] = crate("elite"),
		[16] = crate("crate"),
		[18] = crate("elite"),
		[20] = { type = "ball", id = theme.eliteBall },
	}
	local tiers = {}
	for tier = 1, SeasonConfig.TIERS do
		tiers[tier] = { free = FREE[tier], premium = premium[tier] }
	end
	return tiers
end

-- Texto de una recompensa para la interfaz y los avisos.
function SeasonConfig.Describe(reward)
	if not reward then
		return "—"
	end
	if reward.type == "money" then
		return string.format("💰 %d $", reward.amount)
	elseif reward.type == "egg" then
		local def = CollectionConfig.EggById[reward.egg]
		return string.format("%s %s (se abre al reclamar)", def.icon, def.name)
	elseif reward.type == "crate" then
		local def = CollectionConfig.CrateById[reward.crate]
		return string.format("%s %s (balón nuevo al reclamar)", def.icon, def.name)
	elseif reward.type == "ball" then
		local def = CollectionConfig.BallById[reward.id]
		local rarity = CollectionConfig.RarityById[def.rarity]
		return string.format("%s Balón exclusivo «%s» (%s)", def.icon, def.name, rarity.name)
	elseif reward.type == "outfit" then
		local def = OutfitConfig.ById[reward.id]
		return string.format("%s Traje exclusivo «%s»", def.icon, def.name)
	end
	return "?"
end

function SeasonConfig.Level(xp)
	return math.min(SeasonConfig.TIERS, math.floor(xp / SeasonConfig.XP_PER_TIER))
end

return SeasonConfig
