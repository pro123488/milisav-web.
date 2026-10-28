-- LeagueConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/LeagueConfig
--
-- LIGAS, COPA Y MODO CARRERA (FASE 7). Todas las competiciones y clubes son ficticios.
-- Calendario dentro de una temporada de FootballConfig.SEASON_LENGTH (30) jornadas:
--   jornadas 0-17  -> 18 jornadas de liga (ida y vuelta, 10 equipos)
--   jornadas 19, 22, 25, 28 -> rondas de copa (octavos, cuartos, semifinal, final)
--   jornada 29     -> cierre de temporada: clasificación final, premios, ascensos y descensos
-- Para añadir divisiones basta con añadir entradas a Divisions (de menor a mayor nivel).

local LeagueConfig = {}

LeagueConfig.Divisions = {
	{ level = 1, name = "Liga Regional", strength = { 40, 50 }, prize = 1, promote = 2, relegate = 0 },
	{ level = 2, name = "Tercera División", strength = { 48, 58 }, prize = 2, promote = 2, relegate = 2 },
	{ level = 3, name = "Segunda División B", strength = { 56, 66 }, prize = 4, promote = 2, relegate = 2 },
	{ level = 4, name = "Segunda División", strength = { 64, 74 }, prize = 8, promote = 2, relegate = 2 },
	{ level = 5, name = "Primera División", strength = { 72, 85 }, prize = 16, promote = 0, relegate = 3 },
}

LeagueConfig.TEAMS = 10
LeagueConfig.LEAGUE_FIRST_CYCLE = 0
LeagueConfig.LEAGUE_ROUNDS = 18 -- (TEAMS - 1) × 2
LeagueConfig.CUP_CYCLES = { 19, 22, 25, 28 }
LeagueConfig.CUP_ROUND_NAMES = { "Octavos de final", "Cuartos de final", "Semifinal", "Final" }
LeagueConfig.CUP_TEAMS = 16
LeagueConfig.CUP_NAME = "Copa del Imperio"
LeagueConfig.FINALIZE_CYCLE = 29

-- Puntos
LeagueConfig.POINTS_WIN = 3
LeagueConfig.POINTS_DRAW = 1

-- Premios (se multiplican por el "prize" de la división)
LeagueConfig.MATCH_PRIZE_SCALE = 1.2 -- multiplicador sobre el premio base de MatchService
LeagueConfig.POSITION_PRIZE = 5000 -- × (equipos + 1 − posición) / equipos
LeagueConfig.TITLE_BONUS = 20000
LeagueConfig.PROMOTION_BONUS = 15000
LeagueConfig.CUP_ROUND_PRIZE = { 1000, 2500, 6000, 15000 } -- por ganar cada ronda
LeagueConfig.OBJECTIVE_BONUS = 10000

-- Reputación ganada (o perdida)
LeagueConfig.REP_TITLE_BASE = 8
LeagueConfig.REP_TITLE_PER_LEVEL = 4
LeagueConfig.REP_PROMOTION = 6
LeagueConfig.REP_CUP_BASE = 6
LeagueConfig.REP_CUP_PER_LEVEL = 2
LeagueConfig.REP_RELEGATION = -5

-- Junta directiva (modo carrera)
LeagueConfig.BOARD_START = 60
LeagueConfig.BOARD_MET = 15
LeagueConfig.BOARD_FAILED = -20

-- Evolución de los rivales entre temporadas
LeagueConfig.AI_DRIFT = 2

function LeagueConfig.Division(level)
	return LeagueConfig.Divisions[math.clamp(level or 1, 1, #LeagueConfig.Divisions)]
end

return LeagueConfig
