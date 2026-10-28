-- LeagueService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/LeagueService
--
-- FASE 7: LIGAS (10 equipos, ida y vuelta), COPA (eliminatorias), CALENDARIO,
-- CLASIFICACIÓN, ASCENSOS/DESCENSOS y MODO CARRERA (objetivos de la junta directiva,
-- historial de temporadas y palmarés). Todo se simula en el servidor con MatchEngine.
-- Los partidos del usuario se juegan automáticamente en cada jornada con su alineación
-- y su táctica (MatchService.Play), y se presentan como partidos SIMULADOS.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local LeagueConfig = require(Shared.Config.LeagueConfig)
local TacticsConfig = require(Shared.Config.TacticsConfig)
local MatchEngine = require(Shared.Modules.MatchEngine)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)
local MatchService = require(script.Parent.MatchService)

local LeagueService = {}

local rng = Random.new()
local USER = "user"

-- ===== Equipos y calendario =====

local function newTeamId(league)
	league.nextTeamId = (league.nextTeamId or 0) + 1
	return "t" .. league.nextTeamId
end

local function makeAITeam(league, strength)
	local name, short = MatchService.RandomClubName()
	return {
		id = newTeamId(league),
		name = name,
		short = short,
		strength = math.clamp(math.floor(strength + 0.5), 30, 95),
		formation = TacticsConfig.Formations[rng:NextInteger(1, #TacticsConfig.Formations)].id,
		mentality = TacticsConfig.Mentalities[rng:NextInteger(1, #TacticsConfig.Mentalities)].id,
		style = TacticsConfig.Styles[rng:NextInteger(1, #TacticsConfig.Styles)].id,
		seed = rng:NextInteger(1, 2 ^ 30),
	}
end

local function randomStrength(division)
	return rng:NextInteger(division.strength[1], division.strength[2])
end

-- Liga de ida y vuelta por el método del círculo.
local function roundRobin(ids)
	local list = table.clone(ids)
	if #list % 2 == 1 then
		table.insert(list, "bye")
	end
	local n = #list
	local rounds = {}
	for r = 1, n - 1 do
		local pairs_ = {}
		for i = 1, n / 2 do
			local a, b = list[i], list[n - i + 1]
			if a ~= "bye" and b ~= "bye" then
				if (r + i) % 2 == 0 then
					table.insert(pairs_, { h = a, a = b })
				else
					table.insert(pairs_, { h = b, a = a })
				end
			end
		end
		table.insert(rounds, pairs_)
		-- rotar todos menos el primero
		table.insert(list, 2, table.remove(list, n))
	end
	local second = {}
	for _, round in ipairs(rounds) do
		local mirrored = {}
		for _, p in ipairs(round) do
			table.insert(mirrored, { h = p.a, a = p.h })
		end
		table.insert(second, mirrored)
	end
	for _, round in ipairs(second) do
		table.insert(rounds, round)
	end
	return rounds
end

local function teamMap(league)
	local map = {}
	for _, t in ipairs(league.teams) do
		map[t.id] = t
	end
	return map
end

-- ===== Copa =====

local function newCup(data, league)
	local strength = MatchService.TeamStrength(data)
	local teams = { USER }
	league.cupTeams = {}
	for _ = 1, LeagueConfig.CUP_TEAMS - 1 do
		local t = makeAITeam(league, strength + rng:NextInteger(-10, 8))
		table.insert(league.cupTeams, t)
		table.insert(teams, t.id)
	end
	-- sorteo
	for i = #teams, 2, -1 do
		local j = rng:NextInteger(1, i)
		teams[i], teams[j] = teams[j], teams[i]
	end
	league.cup = { participants = teams, rounds = {}, alive = true, champion = nil }
end

-- ===== Objetivo de la junta =====

local function boardObjective(data, league)
	local division = LeagueConfig.Division(league.division)
	local userStrength = MatchService.TeamStrength(data)
	local rank = 1
	for _, t in ipairs(league.teams) do
		if t.strength > userStrength then
			rank += 1
		end
	end
	local objective
	if division.promote == 0 and rank <= 2 then
		objective = { type = "title", target = 1, text = "Ganar la liga" }
	elseif division.promote > 0 and rank <= division.promote + 1 then
		objective = { type = "position", target = division.promote, text = string.format("Ascender (quedar entre los %d primeros)", division.promote) }
	elseif rank <= 6 then
		objective = { type = "position", target = 5, text = "Quedar entre los 5 primeros" }
	else
		local safe = LeagueConfig.TEAMS - math.max(2, division.relegate)
		objective = { type = "position", target = safe, text = division.relegate > 0 and "Evitar el descenso" or string.format("Quedar entre los %d primeros", safe) }
	end
	objective.expectedRank = rank
	return objective
end

-- Crea (o renueva) la liga de una temporada.
function LeagueService.NewLeague(data, seasonNumber, level, keepTeams)
	local old = data.league or {}
	local league = {
		season = seasonNumber,
		division = level,
		teams = {},
		fixtures = {},
		results = {},
		nextTeamId = old.nextTeamId or 0,
		boardConfidence = old.boardConfidence or LeagueConfig.BOARD_START,
		history = old.history or {},
	}
	local division = LeagueConfig.Division(level)
	for _, t in ipairs(keepTeams or {}) do
		t.strength = math.clamp(t.strength + rng:NextInteger(-LeagueConfig.AI_DRIFT, LeagueConfig.AI_DRIFT), 30, 95)
		table.insert(league.teams, t)
	end
	while #league.teams < LeagueConfig.TEAMS - 1 do
		table.insert(league.teams, makeAITeam(league, randomStrength(division)))
	end
	local ids = { USER }
	for _, t in ipairs(league.teams) do
		table.insert(ids, t.id)
	end
	league.fixtures = roundRobin(ids)
	data.league = league
	newCup(data, league)
	league.objective = boardObjective(data, league)
	return league
end

-- ===== Clasificación =====

function LeagueService.Standings(data)
	local league = data.league
	local rows, byId = {}, {}
	local function row(id, name, short)
		local r = { id = id, name = name, short = short, p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0, form = {} }
		byId[id] = r
		table.insert(rows, r)
	end
	row(USER, data.__clubName or "Tu club", data.__clubShort or "TÚ")
	for _, t in ipairs(league.teams) do
		row(t.id, t.name, t.short)
	end
	for round = 1, LeagueConfig.LEAGUE_ROUNDS do
		for _, m in ipairs(league.results[tostring(round)] or {}) do
			local h, a = byId[m.h], byId[m.a]
			if h and a then
				h.p += 1
				a.p += 1
				h.gf += m.hg
				h.ga += m.ag
				a.gf += m.ag
				a.ga += m.hg
				if m.hg > m.ag then
					h.w += 1
					a.l += 1
					h.pts += LeagueConfig.POINTS_WIN
					table.insert(h.form, "V")
					table.insert(a.form, "D")
				elseif m.hg < m.ag then
					a.w += 1
					h.l += 1
					a.pts += LeagueConfig.POINTS_WIN
					table.insert(h.form, "D")
					table.insert(a.form, "V")
				else
					h.d += 1
					a.d += 1
					h.pts += LeagueConfig.POINTS_DRAW
					a.pts += LeagueConfig.POINTS_DRAW
					table.insert(h.form, "E")
					table.insert(a.form, "E")
				end
			end
		end
	end
	table.sort(rows, function(x, y)
		if x.pts ~= y.pts then
			return x.pts > y.pts
		end
		local dx, dy = x.gf - x.ga, y.gf - y.ga
		if dx ~= dy then
			return dx > dy
		end
		if x.gf ~= y.gf then
			return x.gf > y.gf
		end
		return x.name < y.name
	end)
	for i, r in ipairs(rows) do
		r.position = i
		while #r.form > 5 do
			table.remove(r.form, 1)
		end
	end
	return rows
end

-- ===== Jugar =====

local function aiVsAi(home, away)
	local result = MatchEngine.Simulate(MatchService.BuildAISheet(home), MatchService.BuildAISheet(away), rng, { crowd = 0.5 })
	return result.home.goals, result.away.goals
end

local function countAvailable(data)
	local n = 0
	for _, p in ipairs(data.squad) do
		if (p.injury or 0) <= 0 and not (p.loan and p.loan.type == "out") then
			n += 1
		end
	end
	return n
end

-- Partido del usuario (o incomparecencia si no tiene 11 jugadores disponibles).
local function playUserMatch(player, data, opponent, home, competition, prizeScale)
	if countAvailable(data) < 11 then
		return nil, home and 0 or 3, home and 3 or 0, "⚠️ Sin 11 jugadores disponibles: partido perdido 0-3 por incomparecencia."
	end
	local result = MatchService.Play(player, opponent, {
		clubName = data.__clubName, clubShort = data.__clubShort, home = home,
		competition = competition, prizeScale = prizeScale,
	})
	return result, result.home.goals, result.away.goals, nil
end

local function playLeagueRound(player, data, round, out)
	local league = data.league
	local map = teamMap(league)
	local division = LeagueConfig.Division(league.division)
	local results = {}
	for _, pair in ipairs(league.fixtures[round] or {}) do
		local hg, ag
		if pair.h == USER or pair.a == USER then
			local home = pair.h == USER
			local opponent = map[home and pair.a or pair.h]
			local result, g1, g2, warning = playUserMatch(player, data, opponent, home, "Liga", division.prize * LeagueConfig.MATCH_PRIZE_SCALE)
			hg, ag = g1, g2
			if warning then
				table.insert(out.messages, warning)
			end
			if result then
				out.result = result
				out.points = (out.points or 0) + (result.outcome == "W" and 3 or (result.outcome == "D" and 1 or 0))
				local us = home and hg or ag
				local them = home and ag or hg
				table.insert(out.messages, string.format("⚽ Liga, jornada %d: %s %d - %d %s", round,
					home and data.__clubShort or opponent.short, hg, ag, home and opponent.short or data.__clubShort)
					.. (us > them and " · ¡Victoria!" or (us == them and " · Empate" or " · Derrota")))
			end
		else
			hg, ag = aiVsAi(map[pair.h], map[pair.a])
		end
		table.insert(results, { h = pair.h, a = pair.a, hg = hg, ag = ag })
	end
	league.results[tostring(round)] = results
end

local function strengthOf(data, league, id)
	if id == USER then
		return MatchService.TeamStrength(data)
	end
	for _, t in ipairs(league.cupTeams) do
		if t.id == id then
			return t.strength
		end
	end
	return 50
end

local function cupTeam(league, id)
	for _, t in ipairs(league.cupTeams) do
		if t.id == id then
			return t
		end
	end
	return nil
end

local function playCupRound(player, data, roundIndex, out)
	local league = data.league
	local cup = league.cup
	local entrants = roundIndex == 1 and cup.participants or (cup.rounds[roundIndex - 1] and cup.rounds[roundIndex - 1].winners) or {}
	local division = LeagueConfig.Division(league.division)
	local matches, winners = {}, {}
	for i = 1, #entrants, 2 do
		local a, b = entrants[i], entrants[i + 1]
		if not b then
			table.insert(winners, a)
			break
		end
		local hg, ag, winner, penalties
		if a == USER or b == USER then
			local home = a == USER
			local opponent = cupTeam(league, home and b or a)
			local result, g1, g2, warning = playUserMatch(player, data, opponent, home, "Copa", division.prize)
			hg, ag = g1, g2
			if warning then
				table.insert(out.messages, warning)
			end
			if result then
				out.result = result
			end
		else
			local sa, sb = strengthOf(data, league, a), strengthOf(data, league, b)
			local pa = 1 / (1 + math.exp(-(sa - sb) / 6))
			hg = rng:NextNumber() < pa and rng:NextInteger(1, 3) or rng:NextInteger(0, 1)
			ag = hg > 0 and rng:NextInteger(0, hg) or rng:NextInteger(0, 1)
		end
		if hg > ag then
			winner = a
		elseif ag > hg then
			winner = b
		else
			-- Penaltis: favorece ligeramente al mejor equipo
			local sa, sb = strengthOf(data, league, a), strengthOf(data, league, b)
			winner = rng:NextNumber() < math.clamp(0.5 + (sa - sb) / 100, 0.2, 0.8) and a or b
			penalties = true
		end
		table.insert(matches, { h = a, a = b, hg = hg, ag = ag, winner = winner, penalties = penalties })
		table.insert(winners, winner)
		if a == USER or b == USER then
			local name = LeagueConfig.CUP_ROUND_NAMES[roundIndex]
			if winner == USER then
				out.points = (out.points or 0) + 2
				local prize = LeagueConfig.CUP_ROUND_PRIZE[roundIndex] * division.prize
				EconomyService.Earn(player, prize, EconomyService.Category.PRIZE, LeagueConfig.CUP_NAME .. ": " .. name)
				table.insert(out.messages, string.format("🏆 %s · %s: ¡pasas de ronda%s! Premio %d %s.", LeagueConfig.CUP_NAME, name,
					penalties and " en los penaltis" or "", prize, GameConfig.CURRENCY))
			else
				cup.alive = false
				cup.eliminatedIn = name
				table.insert(out.messages, string.format("❌ %s · %s: eliminado%s.", LeagueConfig.CUP_NAME, name, penalties and " en los penaltis" or ""))
			end
		end
	end
	cup.rounds[roundIndex] = { matches = matches, winners = winners }
	if roundIndex == #LeagueConfig.CUP_CYCLES then
		cup.champion = winners[1]
		if cup.champion == USER then
			out.points = (out.points or 0) + 10
			local rep = LeagueConfig.REP_CUP_BASE + LeagueConfig.REP_CUP_PER_LEVEL * league.division
			data.club.reputationEarned += rep
			table.insert(data.trophies, { kind = "cup", name = LeagueConfig.CUP_NAME, season = data.season.number })
			StadiumService.LogEvent(data, "trophy", { kind = "cup", name = LeagueConfig.CUP_NAME, season = data.season.number })
			table.insert(out.messages, string.format("🏆🏆 ¡CAMPEONES DE LA %s! Reputación +%d.", string.upper(LeagueConfig.CUP_NAME), rep))
		end
	end
end

-- ===== Cierre de temporada =====

local function finalize(player, data, out)
	local league = data.league
	local division = LeagueConfig.Division(league.division)
	local standings = LeagueService.Standings(data)
	local position = 1
	for _, r in ipairs(standings) do
		if r.id == USER then
			position = r.position
		end
	end
	local teams = LeagueConfig.TEAMS
	local promoted = division.promote > 0 and position <= division.promote
	local relegated = division.relegate > 0 and position > teams - division.relegate
	local champion = position == 1

	-- Premios
	local positionPrize = math.floor(LeagueConfig.POSITION_PRIZE * division.prize * (teams + 1 - position) / teams)
	EconomyService.Earn(player, positionPrize, EconomyService.Category.PRIZE, string.format("%s: %dº puesto", division.name, position))
	if champion then
		out.points = (out.points or 0) + 10
		EconomyService.Earn(player, LeagueConfig.TITLE_BONUS * division.prize, EconomyService.Category.PRIZE, "Título de " .. division.name)
		local rep = LeagueConfig.REP_TITLE_BASE + LeagueConfig.REP_TITLE_PER_LEVEL * league.division
		data.club.reputationEarned += rep
		table.insert(data.trophies, { kind = "league", name = division.name, season = league.season })
		StadiumService.LogEvent(data, "trophy", { kind = "league", name = division.name, season = league.season })
		table.insert(out.messages, string.format("🏆 ¡CAMPEONES DE %s! Reputación +%d.", string.upper(division.name), rep))
	end
	if promoted then
		EconomyService.Earn(player, LeagueConfig.PROMOTION_BONUS * division.prize, EconomyService.Category.PRIZE, "Ascenso")
		data.club.reputationEarned += LeagueConfig.REP_PROMOTION
		StadiumService.LogEvent(data, "promotion", { from = division.name, to = LeagueConfig.Division(league.division + 1).name, season = league.season })
		table.insert(out.messages, string.format("⬆️ ¡ASCENSO a %s!", LeagueConfig.Division(league.division + 1).name))
	elseif relegated then
		data.club.reputationEarned = math.max(0, data.club.reputationEarned + LeagueConfig.REP_RELEGATION)
		StadiumService.LogEvent(data, "relegation", { from = division.name, to = LeagueConfig.Division(league.division - 1).name, season = league.season })
		table.insert(out.messages, string.format("⬇️ Descenso a %s.", LeagueConfig.Division(league.division - 1).name))
	end

	-- Objetivo de la junta
	local objective = league.objective
	local met = objective and position <= objective.target
	if met then
		EconomyService.Earn(player, LeagueConfig.OBJECTIVE_BONUS * division.prize, EconomyService.Category.PRIZE, "Objetivo de la junta cumplido")
		league.boardConfidence = math.clamp(league.boardConfidence + LeagueConfig.BOARD_MET, 0, 100)
		table.insert(out.messages, "✅ Objetivo de la junta cumplido: " .. objective.text)
	elseif objective then
		league.boardConfidence = math.clamp(league.boardConfidence + LeagueConfig.BOARD_FAILED, 0, 100)
		table.insert(out.messages, "❌ Objetivo de la junta no cumplido: " .. objective.text)
	end

	-- Historial de temporadas (base de la HISTORIA DEL CLUB)
	local userRow
	for _, r in ipairs(standings) do
		if r.id == USER then
			userRow = r
		end
	end
	local cup = league.cup
	-- Máximo goleador y mejor asistente de la temporada (eventos reales de los partidos)
	local topScorer, topAssist
	for _, p in ipairs(data.squad) do
		local s = p.seasonStats
		if s and s.goals > 0 and (not topScorer or s.goals > topScorer.goals) then
			topScorer = { name = p.name, goals = s.goals }
		end
		if s and s.assists > 0 and (not topAssist or s.assists > topAssist.assists) then
			topAssist = { name = p.name, assists = s.assists }
		end
	end
	if topScorer and (data.records.mostGoalsSeason == nil or topScorer.goals > data.records.mostGoalsSeason.goals) then
		data.records.mostGoalsSeason = { name = topScorer.name, goals = topScorer.goals, season = league.season }
	end
	if userRow and (data.records.bestSeasonPoints == nil or userRow.pts > data.records.bestSeasonPoints.points) then
		data.records.bestSeasonPoints = { points = userRow.pts, season = league.season, division = division.name }
	end
	table.insert(league.history, {
		topScorer = topScorer,
		topAssist = topAssist,
		season = league.season,
		division = league.division,
		divisionName = division.name,
		position = position,
		points = userRow and userRow.pts or 0,
		w = userRow and userRow.w or 0, d = userRow and userRow.d or 0, l = userRow and userRow.l or 0,
		gf = userRow and userRow.gf or 0, ga = userRow and userRow.ga or 0,
		champion = champion,
		promoted = promoted,
		relegated = relegated,
		cup = cup.champion == USER and "Campeón" or (cup.eliminatedIn or "—"),
		objectiveMet = met == true,
	})
	while #league.history > 30 do
		table.remove(league.history, 1)
	end
	table.insert(out.messages, string.format("📊 %s, temporada %d: terminas %dº con %d puntos.", division.name, league.season, position, userRow and userRow.pts or 0))

	-- Siguiente temporada
	local newLevel = league.division + (promoted and 1 or 0) - (relegated and 1 or 0)
	local keep = {}
	if newLevel == league.division then
		for _, r in ipairs(standings) do
			local isPromoted = division.promote > 0 and r.position <= division.promote
			local isRelegated = division.relegate > 0 and r.position > teams - division.relegate
			if r.id ~= USER and not isPromoted and not isRelegated then
				for _, t in ipairs(league.teams) do
					if t.id == r.id then
						table.insert(keep, t)
					end
				end
			end
		end
	end
	LeagueService.NewLeague(data, league.season + 1, newLevel, keep)
end

-- ===== Jornada =====

function LeagueService.Ensure(data)
	if type(data.league) ~= "table" or not data.league.season then
		-- Liga nueva: empieza ya si estamos al principio de la temporada; si no, la próxima
		local startSeason = (data.season.cycle <= 0) and data.season.number or data.season.number + 1
		local level = type(data.league) == "table" and data.league.division or 1
		LeagueService.NewLeague(data, startSeason, level, nil)
	elseif data.league.season < data.season.number then
		LeagueService.NewLeague(data, data.season.number, data.league.division, data.league.teams)
	end
end

-- Se llama en cada jornada ANTES de que SquadService avance el reloj de la temporada.
function LeagueService.AfterCycle(player, clubName, clubShort)
	local data = DataService.Get(player)
	local out = { messages = {}, result = nil }
	if not data then
		return out
	end
	data.__clubName, data.__clubShort = clubName, clubShort
	LeagueService.Ensure(data)
	local league = data.league
	local cycle = data.season.cycle
	if league.season == data.season.number then
		-- Liga (con recuperación de jornadas pendientes)
		local round = cycle - LeagueConfig.LEAGUE_FIRST_CYCLE + 1
		for r = 1, math.min(round, LeagueConfig.LEAGUE_ROUNDS) do
			if not league.results[tostring(r)] then
				playLeagueRound(player, data, r, out)
			end
		end
		-- Copa
		for index, cupCycle in ipairs(LeagueConfig.CUP_CYCLES) do
			if cycle >= cupCycle and not league.cup.rounds[index] then
				playCupRound(player, data, index, out)
			end
		end
		if cycle >= LeagueConfig.FINALIZE_CYCLE then
			finalize(player, data, out)
		end
	end
	data.__clubName, data.__clubShort = nil, nil
	return out
end

-- ===== Estado para el cliente =====

function LeagueService.BuildState(data, clubName, clubShort)
	LeagueService.Ensure(data)
	data.__clubName, data.__clubShort = clubName, clubShort
	local league = data.league
	local division = LeagueConfig.Division(league.division)
	local map = teamMap(league)
	local function label(id)
		if id == USER then
			return clubShort, clubName
		end
		local t = map[id] or cupTeam(league, id)
		return t and t.short or "?", t and t.name or "?"
	end
	local fixtures = {}
	for round, pairs_ in ipairs(league.fixtures) do
		for _, pair in ipairs(pairs_) do
			if pair.h == USER or pair.a == USER then
				local result
				for _, m in ipairs(league.results[tostring(round)] or {}) do
					if m.h == pair.h and m.a == pair.a then
						result = m
					end
				end
				local hs, hn = label(pair.h)
				local as, an = label(pair.a)
				table.insert(fixtures, {
					round = round, cycle = LeagueConfig.LEAGUE_FIRST_CYCLE + round - 1, home = pair.h == USER,
					homeShort = hs, homeName = hn, awayShort = as, awayName = an,
					hg = result and result.hg or nil, ag = result and result.ag or nil,
				})
			end
		end
	end
	local cupRounds = {}
	for index, round in ipairs(league.cup.rounds) do
		local matches = {}
		for _, m in ipairs(round.matches) do
			local hs = label(m.h)
			local as = label(m.a)
			table.insert(matches, { home = hs, away = as, hg = m.hg, ag = m.ag, penalties = m.penalties, user = m.h == USER or m.a == USER,
				userWon = m.winner == USER })
		end
		cupRounds[index] = { name = LeagueConfig.CUP_ROUND_NAMES[index], matches = matches }
	end
	local strengths = {}
	for _, t in ipairs(league.teams) do
		strengths[t.id] = t.strength
	end
	local standings = LeagueService.Standings(data)
	for _, r in ipairs(standings) do
		r.strength = r.id == USER and math.floor(MatchService.TeamStrength(data) + 0.5) or strengths[r.id]
		r.isUser = r.id == USER
	end
	data.__clubName, data.__clubShort = nil, nil
	return {
		season = league.season,
		started = league.season == data.season.number,
		division = league.division,
		divisionName = division.name,
		divisions = #LeagueConfig.Divisions,
		promote = division.promote,
		relegate = division.relegate,
		standings = standings,
		fixtures = fixtures,
		cup = { name = LeagueConfig.CUP_NAME, rounds = cupRounds, alive = league.cup.alive, champion = league.cup.champion == USER,
			eliminatedIn = league.cup.eliminatedIn, cycles = LeagueConfig.CUP_CYCLES, roundNames = LeagueConfig.CUP_ROUND_NAMES },
		objective = league.objective,
		boardConfidence = league.boardConfidence,
		history = league.history,
		trophies = data.trophies,
		cycle = data.season.cycle,
	}
end

function LeagueService.PlayerReady(player)
	local data = DataService.Get(player)
	if data then
		LeagueService.Ensure(data)
	end
end

return LeagueService
