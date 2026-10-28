-- UniverseConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/UniverseConfig
--
-- UNIVERSO FUTBOLÍSTICO (FASE 8): perfiles públicos de clubes, rankings globales,
-- eventos del universo y competición semanal entre usuarios.
-- Solo se publican datos PÚBLICOS del club (nunca dinero, deuda ni datos de la cuenta).

local UniverseConfig = {}

-- ===== Almacenes de Roblox =====
UniverseConfig.PROFILE_STORE = "FEU_Universe_Profiles_v1"
UniverseConfig.RANKINGS = {
	{ id = "reputation", name = "Reputación", icon = "⭐", store = "FEU_Rank_Reputation_v1" },
	{ id = "value", name = "Valor del club", icon = "🏦", store = "FEU_Rank_Value_v1" },
	{ id = "titles", name = "Títulos", icon = "🏆", store = "FEU_Rank_Titles_v1" },
}
UniverseConfig.WEEKLY_STORE_PREFIX = "FEU_Weekly_v1_"

UniverseConfig.PUBLISH_SECONDS = 300 -- cada cuánto se publica el perfil de cada club
UniverseConfig.RANKING_CACHE_SECONDS = 120 -- caché por servidor de los rankings
UniverseConfig.PROFILE_CACHE_SECONDS = 300
UniverseConfig.RANKING_SIZE = 20

-- ===== Eventos del universo (rotan automáticamente; mismo evento en todos los servidores) =====
UniverseConfig.EVENT_HOURS = 24
UniverseConfig.Events = {
	{ id = "youth_week", name = "Semana de la cantera", icon = "🧬", effect = "youthGrowth", multiplier = 1.3,
		description = "Los juveniles de todas las academias evolucionan un 30 % más rápido." },
	{ id = "fan_festival", name = "Festival de aficionados", icon = "🎉", effect = "fanGrowth", multiplier = 1.3,
		description = "La afición crece un 30 % más rápido en todos los clubes." },
	{ id = "sponsor_market", name = "Mercado de patrocinio", icon = "🤝", effect = "contracts", multiplier = 1.15,
		description = "Los contratos de patrocinio pagan un 15 % más." },
	{ id = "derby_days", name = "Días de clásicos", icon = "⚔️", effect = "matchPrize", multiplier = 1.3,
		description = "Los premios de los partidos aumentan un 30 %." },
	{ id = "open_doors", name = "Puertas abiertas", icon = "🗺️", effect = "tour", multiplier = 1.5,
		description = "El tour del estadio genera un 50 % más de ingresos." },
}

-- ===== Competición semanal entre usuarios =====
UniverseConfig.WEEK_SECONDS = 7 * 24 * 3600
UniverseConfig.WeeklyPoints = { win = 3, draw = 1, cupRound = 2, title = 10 }
UniverseConfig.WeeklyRewards = { -- por posición final de la semana (se reclaman al entrar la semana siguiente)
	{ maxRank = 1, money = 50000, reputation = 5, label = "🥇 Campeón semanal" },
	{ maxRank = 3, money = 25000, reputation = 3, label = "🥈 Podio semanal" },
	{ maxRank = 10, money = 10000, reputation = 1, label = "🏅 Top 10 semanal" },
}

function UniverseConfig.CurrentEvent(now)
	now = now or os.time()
	local period = UniverseConfig.EVENT_HOURS * 3600
	local index = math.floor(now / period) % #UniverseConfig.Events + 1
	local secondsLeft = period - (now % period)
	return UniverseConfig.Events[index], secondsLeft
end

-- Multiplicador del evento activo para un efecto (1 si el evento actual no lo afecta).
function UniverseConfig.Multiplier(effect, now)
	local event = UniverseConfig.CurrentEvent(now)
	if event.effect == effect then
		return event.multiplier
	end
	return 1
end

function UniverseConfig.WeekIndex(now)
	return math.floor((now or os.time()) / UniverseConfig.WEEK_SECONDS)
end

function UniverseConfig.WeekSecondsLeft(now)
	now = now or os.time()
	return UniverseConfig.WEEK_SECONDS - (now % UniverseConfig.WEEK_SECONDS)
end

function UniverseConfig.WeeklyReward(rank)
	for _, reward in ipairs(UniverseConfig.WeeklyRewards) do
		if rank <= reward.maxRank then
			return reward
		end
	end
	return nil
end

return UniverseConfig
