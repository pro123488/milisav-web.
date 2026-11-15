-- TrophyConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/TrophyConfig
--
-- CAMINO DE TROFEOS de los partidos en grupo (al estilo de los juegos de lucha por trofeos):
--   * Ganar suma trofeos, perder resta (nunca por debajo de 0).
--   * Los rangos dependen de los trofeos actuales.
--   * Los premios del camino se desbloquean con el MÁXIMO de trofeos alcanzado: si luego
--     bajas, lo ya desbloqueado no se pierde.
-- Funciones puras: las usan el servidor (para aplicar) y la interfaz (para mostrar lo mismo).

local TrophyConfig = {}

TrophyConfig.WIN = 8
TrophyConfig.DRAW = 2
TrophyConfig.LOSS = -3
TrophyConfig.PER_GOAL = 1 -- por cada gol propio, hasta MAX_GOAL_BONUS
TrophyConfig.MAX_GOAL_BONUS = 3
TrophyConfig.MVP = 2

TrophyConfig.Ranks = {
	{ name = "Bronce", icon = "🥉", min = 0, color = Color3.fromRGB(205, 127, 50) },
	{ name = "Plata", icon = "🥈", min = 100, color = Color3.fromRGB(200, 205, 215) },
	{ name = "Oro", icon = "🥇", min = 250, color = Color3.fromRGB(255, 200, 50) },
	{ name = "Platino", icon = "💠", min = 500, color = Color3.fromRGB(120, 230, 220) },
	{ name = "Diamante", icon = "💎", min = 900, color = Color3.fromRGB(110, 170, 255) },
	{ name = "Maestro", icon = "🔮", min = 1400, color = Color3.fromRGB(190, 110, 255) },
	{ name = "Leyenda", icon = "👑", min = 2000, color = Color3.fromRGB(255, 90, 120) },
}

-- Premios del camino: at = trofeos necesarios. Tipos: money, egg (se abre al reclamar), crate (balón nuevo)
TrophyConfig.Road = {
	{ at = 25, money = 3000 },
	{ at = 50, egg = "basic" },
	{ at = 100, money = 10000 },
	{ at = 150, crate = "crate" },
	{ at = 250, egg = "golden" },
	{ at = 350, money = 50000 },
	{ at = 500, crate = "elite" },
	{ at = 700, egg = "champion" },
	{ at = 900, money = 200000 },
	{ at = 1200, egg = "jungle" },
	{ at = 1600, egg = "ocean" },
	{ at = 2000, money = 1000000 },
}

function TrophyConfig.Rank(trophies)
	local current = TrophyConfig.Ranks[1]
	for _, rank in ipairs(TrophyConfig.Ranks) do
		if trophies >= rank.min then
			current = rank
		end
	end
	return current
end

function TrophyConfig.NextRank(trophies)
	for _, rank in ipairs(TrophyConfig.Ranks) do
		if trophies < rank.min then
			return rank
		end
	end
	return nil
end

-- Cambio de trofeos de un partido
function TrophyConfig.Delta(result, goals, isMvp)
	local delta = result == "win" and TrophyConfig.WIN or (result == "draw" and TrophyConfig.DRAW or TrophyConfig.LOSS)
	if result ~= "loss" then
		delta += math.min(goals, TrophyConfig.MAX_GOAL_BONUS) * TrophyConfig.PER_GOAL
	end
	if isMvp then
		delta += TrophyConfig.MVP
	end
	return delta
end

return TrophyConfig
