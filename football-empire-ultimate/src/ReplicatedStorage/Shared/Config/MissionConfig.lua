-- MissionConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/MissionConfig
--
-- MISIONES Y LOGROS (FASE 10).
--   * Misiones diarias: 3 al día (se renuevan a las 00:00 UTC), elegidas del repertorio.
--   * Misiones de progreso: cadenas permanentes con objetivos cada vez mayores.
--   * Logros: hitos permanentes que se comprueban con datos reales del club.
-- Las métricas las registra el servidor a partir de acontecimientos reales (nunca el cliente).

local MissionConfig = {}

MissionConfig.DAILY_COUNT = 3

-- Métricas que el servidor cuenta (MissionService.Track)
MissionConfig.Metrics = {
	wins = "Partidos ganados",
	goals = "Goles marcados",
	matches = "Partidos jugados",
	build = "Mejoras de instalaciones",
	decorate = "Decoraciones colocadas",
	sponsor = "Contratos de patrocinio firmados",
	promote = "Canteranos subidos al primer equipo",
	sign = "Fichajes realizados",
	cycles = "Jornadas completadas",
	arena = "Partidos en grupo jugados",
	hatch = "Huevos abiertos",
	trophies = "Trofeos ganados",
	friendly = "Amistosos jugados",
	challenge = "Retos a otros clubes",
	candy = "Caramelos recogidos",
	stage = "Ascensos del estadio",
}

-- Repertorio de misiones diarias. target se multiplica por la escala de división (1 a 2).
MissionConfig.DailyPool = {
	{ id = "d_wins", metric = "wins", target = 3, text = "Gana %d partidos", money = 3000, reputation = 1 },
	{ id = "d_goals", metric = "goals", target = 6, text = "Marca %d goles", money = 2500, reputation = 1 },
	{ id = "d_matches", metric = "matches", target = 5, text = "Juega %d partidos", money = 2000, reputation = 0 },
	{ id = "d_build", metric = "build", target = 2, text = "Mejora %d instalaciones", money = 3000, reputation = 1 },
	{ id = "d_decorate", metric = "decorate", target = 2, text = "Coloca %d decoraciones", money = 1500, reputation = 0 },
	{ id = "d_cycles", metric = "cycles", target = 15, text = "Completa %d jornadas", money = 4000, reputation = 1 },
	{ id = "d_friendly", metric = "friendly", target = 2, text = "Juega %d amistosos", money = 2000, reputation = 0 },
	{ id = "d_challenge", metric = "challenge", target = 1, text = "Reta a %d club(es) del universo", money = 2500, reputation = 1 },
	{ id = "d_candy", metric = "candy", target = 25, text = "Recoge %d caramelos (Halloween)", money = 2500, reputation = 0, event = "halloween" },
	{ id = "d_arena", metric = "arena", target = 2, text = "Juega %d partidos en grupo", money = 3000, reputation = 1 },
	{ id = "d_hatch", metric = "hatch", target = 3, text = "Abre %d huevos de mascota", money = 2500, reputation = 0 },
	{ id = "d_trophies", metric = "trophies", target = 15, text = "Gana %d trofeos en los partidos en grupo", money = 3500, reputation = 1 },
}

-- Cadenas de progreso: cada nivel tiene un objetivo acumulado y su recompensa.
MissionConfig.Chains = {
	{ id = "c_wins", metric = "wins", name = "Ganador nato", targets = { 5, 15, 40, 100, 250 }, money = { 5000, 15000, 40000, 100000, 250000 } },
	{ id = "c_goals", metric = "goals", name = "Máquina de goles", targets = { 20, 75, 200, 500, 1200 }, money = { 4000, 12000, 35000, 90000, 220000 } },
	{ id = "c_build", metric = "build", name = "Arquitecto", targets = { 5, 15, 30, 50, 80 }, money = { 5000, 15000, 40000, 90000, 200000 } },
	{ id = "c_promote", metric = "promote", name = "Escuela de talentos", targets = { 1, 5, 12, 25, 50 }, money = { 5000, 20000, 50000, 120000, 250000 } },
	{ id = "c_sign", metric = "sign", name = "Director deportivo", targets = { 1, 5, 15, 30, 60 }, money = { 3000, 12000, 30000, 70000, 150000 } },
	{ id = "c_sponsor", metric = "sponsor", name = "Imán de patrocinadores", targets = { 1, 5, 12, 25, 50 }, money = { 3000, 12000, 30000, 70000, 150000 } },
}

-- Logros: stat (ver AchievementService.Stat) >= target
MissionConfig.Achievements = {
	{ id = "a_first_win", icon = "✅", name = "Primera victoria", stat = "wins", target = 1, reputation = 1, money = 1000 },
	{ id = "a_100_wins", icon = "💯", name = "Centenario de victorias", stat = "wins", target = 100, reputation = 5, money = 50000 },
	{ id = "a_100_goals", icon = "⚽", name = "100 goles", stat = "goals", target = 100, reputation = 2, money = 10000 },
	{ id = "a_1000_goals", icon = "🔥", name = "1.000 goles", stat = "goals", target = 1000, reputation = 6, money = 150000 },
	{ id = "a_first_title", icon = "🏆", name = "Primer título", stat = "titles", target = 1, reputation = 3, money = 20000 },
	{ id = "a_10_titles", icon = "👑", name = "Dinastía (10 títulos)", stat = "titles", target = 10, reputation = 8, money = 300000 },
	{ id = "a_stage_3", icon = "🏟️", name = "Estadio regional", stat = "stage", target = 3, reputation = 2, money = 15000 },
	{ id = "a_stage_5", icon = "🌟", name = "Estadio de élite", stat = "stage", target = 5, reputation = 4, money = 100000 },
	{ id = "a_stage_7", icon = "🏛️", name = "Estadio legendario", stat = "stage", target = 7, reputation = 8, money = 500000 },
	{ id = "a_fans_1k", icon = "👥", name = "1.000 aficionados", stat = "fans", target = 1000, reputation = 1, money = 3000 },
	{ id = "a_fans_10k", icon = "📣", name = "10.000 aficionados", stat = "fans", target = 10000, reputation = 3, money = 30000 },
	{ id = "a_fans_50k", icon = "🌍", name = "50.000 aficionados", stat = "fans", target = 50000, reputation = 6, money = 150000 },
	{ id = "a_graduate", icon = "🧬", name = "Hecho en casa", stat = "graduates", target = 1, reputation = 1, money = 3000 },
	{ id = "a_10_graduates", icon = "🎓", name = "Cantera de oro (10 canteranos)", stat = "graduates", target = 10, reputation = 4, money = 60000 },
	{ id = "a_legend", icon = "🏅", name = "Una leyenda se despide", stat = "legends", target = 1, reputation = 3, money = 20000 },
	{ id = "a_division_3", icon = "⬆️", name = "Escalando divisiones", stat = "division", target = 3, reputation = 3, money = 30000 },
	{ id = "a_division_5", icon = "🥇", name = "En la élite (Primera División)", stat = "division", target = 5, reputation = 8, money = 250000 },
	{ id = "a_million", icon = "💰", name = "Primer millón ingresado", stat = "earned", target = 1000000, reputation = 3, money = 0 },
	{ id = "a_network", icon = "🤝", name = "Conectado (50 puntos de red)", stat = "networkPoints", target = 50, reputation = 2, money = 15000 },
	{ id = "a_candy", icon = "🎃", name = "Rey de los caramelos (300)", stat = "candy", target = 300, reputation = 1, money = 10000 },
	{ id = "a_rep_100", icon = "⭐", name = "Reputación 100", stat = "reputation", target = 100, reputation = 0, money = 50000 },
	-- Partidos en grupo, trofeos y renacimientos
	{ id = "a_arena_goals_50", icon = "🥅", name = "Goleador de barrio (50 goles en grupo)", stat = "arenaGoals", target = 50, reputation = 2, money = 20000 },
	{ id = "a_arena_goals_500", icon = "🎯", name = "Pichichi (500 goles en grupo)", stat = "arenaGoals", target = 500, reputation = 5, money = 200000 },
	{ id = "a_rank_gold", icon = "🥇", name = "Rango Oro (250 trofeos)", stat = "trophies", target = 250, reputation = 2, money = 25000 },
	{ id = "a_rank_diamond", icon = "💎", name = "Rango Diamante (900 trofeos)", stat = "trophies", target = 900, reputation = 4, money = 120000 },
	{ id = "a_rank_legend", icon = "👑", name = "Rango Leyenda (2.000 trofeos)", stat = "trophies", target = 2000, reputation = 8, money = 500000 },
	{ id = "a_rebirth_1", icon = "🔄", name = "Renacido", stat = "rebirths", target = 1, reputation = 3, money = 50000 },
	{ id = "a_rebirth_5", icon = "🔥", name = "Cinco vidas (5 renacimientos)", stat = "rebirths", target = 5, reputation = 6, money = 500000 },
	-- Colección
	{ id = "a_pets_10", icon = "🐾", name = "Cuidador (10 mascotas descubiertas)", stat = "petsDiscovered", target = 10, reputation = 1, money = 15000 },
	{ id = "a_pets_all", icon = "📖", name = "Zoológico completo (las 33 mascotas)", stat = "petsDiscovered", target = 33, reputation = 6, money = 400000 },
	{ id = "a_golden_1", icon = "✨", name = "Toque de oro (1.ª mascota dorada)", stat = "goldenPets", target = 1, reputation = 2, money = 30000 },
	{ id = "a_golden_10", icon = "🌟", name = "Rey Midas (10 mascotas doradas)", stat = "goldenPets", target = 10, reputation = 5, money = 300000 },
	{ id = "a_balls_15", icon = "⚽", name = "Coleccionista de balones (15)", stat = "balls", target = 15, reputation = 2, money = 40000 },
	{ id = "a_pieces_50", icon = "🧱", name = "Arquitecto libre (50 piezas)", stat = "pieces", target = 50, reputation = 2, money = 30000 },
	{ id = "a_likes_25", icon = "👍", name = "Estadio popular (25 «me gusta»)", stat = "likes", target = 25, reputation = 2, money = 25000 },
	{ id = "a_likes_250", icon = "💖", name = "Estadio de culto (250 «me gusta»)", stat = "likes", target = 250, reputation = 5, money = 250000 },
}

function MissionConfig.Daily(id)
	for _, m in ipairs(MissionConfig.DailyPool) do
		if m.id == id then
			return m
		end
	end
	return nil
end

function MissionConfig.Chain(id)
	for _, c in ipairs(MissionConfig.Chains) do
		if c.id == id then
			return c
		end
	end
	return nil
end

function MissionConfig.Achievement(id)
	for _, a in ipairs(MissionConfig.Achievements) do
		if a.id == id then
			return a
		end
	end
	return nil
end

return MissionConfig
