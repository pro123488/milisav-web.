-- MatchService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/MatchService
--
-- FASE 5: alineaciones, formaciones, tácticas y PARTIDOS SIMULADOS.
--   * Solo el servidor simula (MatchEngine + Random del servidor).
--   * Efectos reales: premios, reputación, satisfacción, estadísticas de jugadores,
--     forma física, lesiones, historial y récords.
--   * Los rivales de los amistosos son clubes ficticios generados en el servidor.
--     Las ligas (FASE 7) y los partidos entre usuarios (FASE 9) reutilizan
--     BuildUserSheet / BuildAISheet / Play.
-- Los partidos se presentan siempre como SIMULACIONES, no como partidos controlables.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local FootballConfig = require(Shared.Config.FootballConfig)
local TacticsConfig = require(Shared.Config.TacticsConfig)
local FootballFormulas = require(Shared.Modules.FootballFormulas)
local MatchEngine = require(Shared.Modules.MatchEngine)
local UniverseConfig = require(Shared.Config.UniverseConfig)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)

local MatchService = {}

local rng = Random.new()

-- ===== Alineación =====

local function available(p)
	return (p.injury or 0) <= 0 and not (p.loan and p.loan.type == "out")
end

local function slotScore(p, slotPos)
	local factor = MatchEngine.PlayerFactor({ pos = p.pos, slotPos = slotPos, fitness = p.fitness })
	return FootballFormulas.Overall(p) * factor
end

-- Mejor once posible para la formación actual (respeta lesiones y forma física).
function MatchService.AutoLineup(data)
	local formation = TacticsConfig.Formation(data.tactics.formation)
	local used, lineup = {}, {}
	for index, slotPos in ipairs(formation.slots) do
		local best, bestScore = nil, -1
		for _, p in ipairs(data.squad) do
			if not used[p.id] and available(p) then
				local score = slotScore(p, slotPos)
				if score > bestScore then
					best, bestScore = p, score
				end
			end
		end
		if best then
			used[best.id] = true
			lineup[index] = best.id
		else
			lineup[index] = ""
		end
	end
	data.tactics.lineup = lineup
	return lineup
end

-- Repara la alineación guardada: quita lesionados, duplicados o jugadores que ya no están.
function MatchService.ValidateLineup(data)
	local formation = TacticsConfig.Formation(data.tactics.formation)
	local byId = {}
	for _, p in ipairs(data.squad) do
		byId[p.id] = p
	end
	local lineup, used, missing = {}, {}, false
	for index = 1, #formation.slots do
		local id = data.tactics.lineup[index]
		local p = byId[id]
		if p and available(p) and not used[id] then
			lineup[index] = id
			used[id] = true
		else
			lineup[index] = ""
			missing = true
		end
	end
	if missing then
		-- Rellena los huecos con el mejor disponible para cada puesto
		for index, slotPos in ipairs(formation.slots) do
			if lineup[index] == "" then
				local best, bestScore = nil, -1
				for _, p in ipairs(data.squad) do
					if not used[p.id] and available(p) then
						local score = slotScore(p, slotPos)
						if score > bestScore then
							best, bestScore = p, score
						end
					end
				end
				if best then
					lineup[index] = best.id
					used[best.id] = true
				end
			end
		end
	end
	data.tactics.lineup = lineup
	return lineup
end

function MatchService.TeamStrength(data)
	local values = {}
	for _, p in ipairs(data.squad) do
		table.insert(values, FootballFormulas.Overall(p))
	end
	table.sort(values, function(a, b)
		return a > b
	end)
	local total, n = 0, math.min(11, #values)
	for i = 1, n do
		total += values[i]
	end
	return n > 0 and total / n or 40
end

function MatchService.BuildUserSheet(data, name, short)
	local formation = TacticsConfig.Formation(data.tactics.formation)
	local lineup = MatchService.ValidateLineup(data)
	local byId = {}
	for _, p in ipairs(data.squad) do
		byId[p.id] = p
	end
	local players = {}
	for index, slotPos in ipairs(formation.slots) do
		local p = byId[lineup[index]]
		if p then
			table.insert(players, {
				id = p.id, name = p.nickname or p.name, pos = p.pos, slotPos = slotPos, attrs = p.attrs, fitness = p.fitness or 100,
			})
		end
	end
	return {
		name = name, short = short,
		formation = formation.id, mentality = data.tactics.mentality, style = data.tactics.style,
		players = players,
	}
end

-- Rival generado de forma determinista a partir de su descripción (mismo rival = misma plantilla).
function MatchService.BuildAISheet(opponent)
	local seeded = Random.new(opponent.seed or 1)
	local formation = TacticsConfig.Formation(opponent.formation)
	local players = {}
	for index, slotPos in ipairs(formation.slots) do
		local attrs = {}
		local bias = FootballConfig.Bias[slotPos]
		for _, attr in ipairs(FootballConfig.Attributes) do
			attrs[attr.id] = math.clamp(opponent.strength + bias[attr.id] + seeded:NextInteger(-6, 6), 5, 97)
		end
		local probe = { pos = slotPos, attrs = attrs }
		local diff = opponent.strength - FootballFormulas.Overall(probe)
		for id, v in pairs(attrs) do
			attrs[id] = math.clamp(v + diff, 5, 97)
		end
		local first = FootballConfig.FirstNames[seeded:NextInteger(1, #FootballConfig.FirstNames)]
		local last = FootballConfig.LastNames[seeded:NextInteger(1, #FootballConfig.LastNames)]
		table.insert(players, {
			id = "ai" .. index, name = first .. " " .. last, pos = slotPos, slotPos = slotPos, attrs = attrs, fitness = 100,
		})
	end
	return {
		name = opponent.name, short = opponent.short,
		formation = formation.id, mentality = opponent.mentality, style = opponent.style,
		players = players,
	}
end

function MatchService.RandomClubName(random)
	random = random or rng
	local prefix = TacticsConfig.ClubPrefixes[random:NextInteger(1, #TacticsConfig.ClubPrefixes)]
	local town = TacticsConfig.ClubTowns[random:NextInteger(1, #TacticsConfig.ClubTowns)]
	local name = prefix .. " " .. town
	local short = string.upper(string.sub(town:gsub("[^%a]", ""), 1, 3))
	return name, short
end

-- ===== Amistosos =====

local function generateFriendlies(data)
	local strength = MatchService.TeamStrength(data)
	local offers = {}
	for i, difficulty in ipairs(TacticsConfig.FRIENDLY_DIFFICULTY) do
		local name, short = MatchService.RandomClubName()
		local formations = TacticsConfig.Formations
		table.insert(offers, {
			id = string.format("f%d-%d", data.stats.cycles, i),
			name = name,
			short = short,
			difficulty = difficulty.id,
			strength = math.clamp(math.floor(strength + difficulty.delta + rng:NextInteger(-2, 2) + 0.5), 35, 92),
			formation = formations[rng:NextInteger(1, #formations)].id,
			mentality = TacticsConfig.Mentalities[rng:NextInteger(1, #TacticsConfig.Mentalities)].id,
			style = TacticsConfig.Styles[rng:NextInteger(1, #TacticsConfig.Styles)].id,
			seed = rng:NextInteger(1, 2 ^ 30),
		})
	end
	data.friendlies.offers = offers
end

function MatchService.RefreshFriendlies(data, force)
	if force or #data.friendlies.offers == 0 then
		generateFriendlies(data)
	end
end

-- ===== Aplicar resultado =====

local function countAvailable(data)
	local n = 0
	for _, p in ipairs(data.squad) do
		if available(p) then
			n += 1
		end
	end
	return n
end

-- Aplica a los jugadores del usuario las consecuencias de un partido.
local function applyPlayerEffects(data, sheet, result, messages)
	local byId = {}
	for _, p in ipairs(data.squad) do
		byId[p.id] = p
	end
	local intense = data.training.intensity == "INTENSE"
	for _, entry in ipairs(sheet.players) do
		local p = byId[entry.id]
		if p then
			p.stats.apps += 1
			p.seasonStats = p.seasonStats or { apps = 0, goals = 0, assists = 0 }
			p.seasonStats.apps += 1
			local ps = result.playerStats[p.id]
			local goals, assists = ps and ps.goals or 0, ps and ps.assists or 0
			p.stats.goals += goals
			p.stats.assists += assists
			p.seasonStats.goals += goals
			p.seasonStats.assists += assists
			-- Estadísticas de todos los tiempos del club (sobreviven a ventas y retiradas)
			local all = data.allTimeStats[p.id]
			if not all then
				all = { name = p.name, pos = p.pos, origin = p.origin, apps = 0, goals = 0, assists = 0 }
				data.allTimeStats[p.id] = all
			end
			all.apps += 1
			all.goals += goals
			all.assists += assists
			local stamina = p.attrs.stamina or 50
			local cost = TacticsConfig.FITNESS_COST_MAX - (TacticsConfig.FITNESS_COST_MAX - TacticsConfig.FITNESS_COST_MIN) * stamina / 99
			p.fitness = math.clamp((p.fitness or 100) - cost, 0, 100)
			local injuryChance = TacticsConfig.INJURY_CHANCE + (intense and TacticsConfig.INJURY_CHANCE_INTENSE or 0)
			if rng:NextNumber() < injuryChance then
				p.injury = rng:NextInteger(TacticsConfig.INJURY_MIN, TacticsConfig.INJURY_MAX)
				table.insert(messages, string.format("🚑 %s se lesiona: %d jornadas de baja.", p.name, p.injury))
			end
		end
	end
end

local function updateRecords(data, entry)
	local records = data.records
	local diff = entry.gf - entry.ga
	local function better(current, value)
		return current == nil or value > current
	end
	if diff > 0 and better(records.biggestWin and (records.biggestWin.gf - records.biggestWin.ga), diff) then
		records.biggestWin = { gf = entry.gf, ga = entry.ga, opponent = entry.opponent, season = entry.season }
	end
	if diff < 0 and better(records.worstDefeat and (records.worstDefeat.ga - records.worstDefeat.gf), -diff) then
		records.worstDefeat = { gf = entry.gf, ga = entry.ga, opponent = entry.opponent, season = entry.season }
	end
	if diff >= 0 then
		records.unbeatenCurrent = (records.unbeatenCurrent or 0) + 1
	else
		records.unbeatenCurrent = 0
	end
	if (records.unbeatenCurrent or 0) > (records.unbeatenBest or 0) then
		records.unbeatenBest = records.unbeatenCurrent
	end
end

local matchCallbacks = {}

-- Avisa a otros servicios de cada partido de un usuario (eventos comunitarios, etc.).
function MatchService.OnUserMatch(callback)
	table.insert(matchCallbacks, callback)
end

local function fireMatch(player, result, us, them)
	for _, callback in ipairs(matchCallbacks) do
		task.spawn(callback, player, result, us, them)
	end
end

MatchService.ApplyPlayerEffects = applyPlayerEffects

function MatchService.SimulateSheets(homeSheet, awaySheet, crowd)
	return MatchEngine.Simulate(homeSheet, awaySheet, rng, { crowd = crowd or 0.5 })
end

-- Registra un partido en el historial, los totales y los récords del club.
-- entry = { competition, opponent, short, home, gf, ga, scorers, mvp, prize }
function MatchService.RecordMatch(data, entry)
	entry.t = os.time()
	entry.season = data.season.number
	entry.outcome = entry.gf > entry.ga and "W" or (entry.gf == entry.ga and "D" or "L")
	table.insert(data.matches, entry)
	while #data.matches > TacticsConfig.MAX_MATCH_HISTORY do
		table.remove(data.matches, 1)
	end
	local s = data.stats
	s.matchesPlayed = (s.matchesPlayed or 0) + 1
	s.wins = (s.wins or 0) + (entry.outcome == "W" and 1 or 0)
	s.draws = (s.draws or 0) + (entry.outcome == "D" and 1 or 0)
	s.losses = (s.losses or 0) + (entry.outcome == "L" and 1 or 0)
	s.goalsFor = (s.goalsFor or 0) + entry.gf
	s.goalsAgainst = (s.goalsAgainst or 0) + entry.ga
	updateRecords(data, entry)
	if math.abs(entry.gf - entry.ga) >= 4 then
		StadiumService.LogEvent(data, "big_result", { opponent = entry.opponent, gf = entry.gf, ga = entry.ga, competition = entry.competition })
	end
	return entry.outcome
end

function MatchService.Scorers(result, side)
	local scorers = {}
	for _, event in ipairs(result.events) do
		if event.type == "goal" and event.side == side then
			table.insert(scorers, string.format("%s %d'", event.player, event.minute))
		end
	end
	return scorers
end

-- Juega un partido del usuario y aplica todo.
-- opponent: rival ficticio { name, short, strength, ... } o, con opts.opponentSheet, un club real (hoja pública).
-- opts: competition ("Amistoso", "Liga", "Copa", "Reto", "Torneo"...), home, prizeScale,
--       noEconomy = true -> sin premio, reputación ni satisfacción (partidos entre usuarios y torneos)
function MatchService.Play(player, opponent, opts)
	local data = DataService.Get(player)
	local userSheet = MatchService.BuildUserSheet(data, opts.clubName, opts.clubShort)
	local opponentSheet = opts.opponentSheet or MatchService.BuildAISheet(opponent)
	local home = opts.home ~= false
	local crowd = (data.economy.lastCycle and data.economy.lastCycle.occupancy) or 0
	local result
	if home then
		result = MatchEngine.Simulate(userSheet, opponentSheet, rng, { crowd = crowd })
	else
		result = MatchEngine.Simulate(opponentSheet, userSheet, rng, { crowd = 0.7 })
	end
	local us = home and result.home or result.away
	local them = home and result.away or result.home
	local messages = {}
	applyPlayerEffects(data, userSheet, result, messages)

	-- Premios, reputación y satisfacción
	local outcome = us.goals > them.goals and "W" or (us.goals == them.goals and "D" or "L")
	local prize, repGain, satisfaction = 0, 0, 0
	if not opts.noEconomy then
		prize = TacticsConfig.FRIENDLY_PRIZE_BASE * (opponent.strength / 50) ^ 2 * (opts.prizeScale or 1)
			* UniverseConfig.Multiplier("matchPrize") -- evento del universo
		if outcome == "D" then
			prize *= TacticsConfig.PRIZE_DRAW
		elseif outcome == "L" then
			prize *= TacticsConfig.PRIZE_LOSS
		end
		prize = math.floor(prize)
		EconomyService.Earn(player, prize, EconomyService.Category.PRIZE, string.format("%s vs %s (%d-%d)", opts.competition, opponent.name, us.goals, them.goals))
		if outcome == "W" and opponent.strength >= MatchService.TeamStrength(data) - 3 then
			repGain = TacticsConfig.REPUTATION_WIN * (opts.reputationScale or 1)
			data.club.reputationEarned += repGain
		end
		satisfaction = outcome == "W" and TacticsConfig.SATISFACTION_WIN or (outcome == "L" and TacticsConfig.SATISFACTION_LOSS or 0)
		data.club.satisfaction = math.clamp(data.club.satisfaction + satisfaction, 0, 100)
	end

	MatchService.RecordMatch(data, {
		competition = opts.competition,
		opponent = opponent.name,
		short = opponent.short,
		home = home,
		gf = us.goals,
		ga = them.goals,
		scorers = MatchService.Scorers(result, home and 1 or 2),
		mvp = result.mvp and result.mvp.name or nil,
		prize = prize,
	})

	result.userSide = home and 1 or 2
	result.prize = prize
	result.reputation = repGain
	result.satisfaction = satisfaction
	result.outcome = outcome
	result.competition = opts.competition
	result.messages = messages
	fireMatch(player, result, us.goals, them.goals)
	result.playerStats = nil -- no hace falta en el cliente (ya se resume en los eventos)
	result.ratings = nil
	return result, messages
end

-- Partido entre dos usuarios conectados (FASE 9). Aplica efectos y registros a ambos.
-- Devuelve el resultado (sin datos internos) o nil y un motivo.
function MatchService.PlayUsers(homePlayer, awayPlayer, competition, homeInfo, awayInfo)
	local homeData, awayData = DataService.Get(homePlayer), DataService.Get(awayPlayer)
	if not homeData or not awayData then
		return nil, "Uno de los clubes no está disponible."
	end
	local homeSheet = MatchService.BuildUserSheet(homeData, homeInfo.name, homeInfo.short)
	local awaySheet = MatchService.BuildUserSheet(awayData, awayInfo.name, awayInfo.short)
	if #homeSheet.players < 11 or #awaySheet.players < 11 then
		return nil, "Uno de los clubes no tiene 11 jugadores disponibles."
	end
	local crowd = (homeData.economy.lastCycle and homeData.economy.lastCycle.occupancy) or 0
	local result = MatchEngine.Simulate(homeSheet, awaySheet, rng, { crowd = crowd })
	local sides = { { player = homePlayer, data = homeData, sheet = homeSheet, side = 1, other = awayInfo },
		{ player = awayPlayer, data = awayData, sheet = awaySheet, side = 2, other = homeInfo } }
	for _, entry in ipairs(sides) do
		applyPlayerEffects(entry.data, entry.sheet, result, {})
		local us = entry.side == 1 and result.home or result.away
		local them = entry.side == 1 and result.away or result.home
		MatchService.RecordMatch(entry.data, {
			competition = competition, opponent = entry.other.name, short = entry.other.short, home = entry.side == 1,
			gf = us.goals, ga = them.goals, scorers = MatchService.Scorers(result, entry.side),
			mvp = result.mvp and result.mvp.name or nil, prize = 0,
		})
		fireMatch(entry.player, result, us.goals, them.goals)
	end
	result.playerStats = nil
	result.ratings = nil
	result.competition = competition
	result.prize, result.reputation, result.satisfaction = 0, 0, 0
	return result
end

function MatchService.PlayFriendly(player, payload, clubName, clubShort)
	local data = DataService.Get(player)
	local offerId = type(payload) == "table" and payload.offer
	local opponent
	for _, offer in ipairs(data.friendlies.offers) do
		if offer.id == offerId then
			opponent = offer
		end
	end
	if not opponent then
		return false, "Ese amistoso ya no está disponible."
	end
	if data.friendlies.lastCycle == data.stats.cycles then
		return false, "Ya has jugado un amistoso en esta jornada. Espera a la próxima."
	end
	if countAvailable(data) < 11 then
		return false, "No tienes 11 jugadores disponibles (lesiones)."
	end
	local result = MatchService.Play(player, opponent, {
		clubName = clubName, clubShort = clubShort, home = true, competition = "Amistoso",
	})
	data.friendlies.lastCycle = data.stats.cycles
	data.friendlies.offers = {}
	return true, string.format("Amistoso simulado: %s %d - %d %s.", clubShort, result.home.goals, result.away.goals, opponent.short), result
end

-- ===== Acciones tácticas =====

function MatchService.SetFormation(player, payload)
	local data = DataService.Get(player)
	local id = type(payload) == "table" and payload.formation
	for _, f in ipairs(TacticsConfig.Formations) do
		if f.id == id then
			data.tactics.formation = f.id
			MatchService.ValidateLineup(data)
			return true, "Formación " .. f.name
		end
	end
	return false, "Formación no válida."
end

function MatchService.SetTactic(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	if payload.kind == "mentality" then
		for _, m in ipairs(TacticsConfig.Mentalities) do
			if m.id == payload.value then
				data.tactics.mentality = m.id
				return true, "Mentalidad " .. m.name
			end
		end
	elseif payload.kind == "style" then
		for _, st in ipairs(TacticsConfig.Styles) do
			if st.id == payload.value then
				data.tactics.style = st.id
				return true, "Estilo: " .. st.name
			end
		end
	end
	return false, "Táctica no válida."
end

function MatchService.SetLineupSlot(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local formation = TacticsConfig.Formation(data.tactics.formation)
	local slot = tonumber(payload.slot)
	if not slot or slot ~= math.floor(slot) or slot < 1 or slot > #formation.slots then
		return false, "Puesto no válido."
	end
	local target
	for _, p in ipairs(data.squad) do
		if p.id == payload.id then
			target = p
		end
	end
	if not target then
		return false, "Ese jugador no es de tu plantilla."
	end
	if not available(target) then
		return false, target.name .. " está lesionado."
	end
	MatchService.ValidateLineup(data)
	local lineup = data.tactics.lineup
	-- Si ya estaba en el once, intercambia los puestos
	for index, id in ipairs(lineup) do
		if id == target.id then
			lineup[index] = lineup[slot]
		end
	end
	lineup[slot] = target.id
	return true, string.format("%s al puesto %d (%s).", target.name, slot, FootballConfig.Position(formation.slots[slot]).short)
end

function MatchService.AutoLineupAction(player)
	local data = DataService.Get(player)
	MatchService.AutoLineup(data)
	return true, "Alineación automática: mejor once disponible."
end

-- ===== Jornada =====

function MatchService.AfterCycle(player)
	local data = DataService.Get(player)
	if not data then
		return {}
	end
	local messages = {}
	for _, p in ipairs(data.squad) do
		p.fitness = math.clamp((p.fitness or 100) + TacticsConfig.FITNESS_RECOVERY, 0, 100)
		if (p.injury or 0) > 0 then
			p.injury -= 1
			if p.injury <= 0 then
				p.injury = 0
				table.insert(messages, "✅ " .. p.name .. " se ha recuperado de su lesión.")
			end
		end
	end
	MatchService.RefreshFriendlies(data, false)
	MatchService.ValidateLineup(data)
	return messages
end

function MatchService.PlayerReady(player)
	local data = DataService.Get(player)
	if data then
		if #data.tactics.lineup == 0 then
			MatchService.AutoLineup(data)
		end
		MatchService.RefreshFriendlies(data, false)
	end
end

function MatchService.BuildState(data)
	local formation = TacticsConfig.Formation(data.tactics.formation)
	local lineupInfo = {}
	local byId = {}
	for _, p in ipairs(data.squad) do
		byId[p.id] = p
	end
	for index, slotPos in ipairs(formation.slots) do
		local p = byId[data.tactics.lineup[index]]
		lineupInfo[index] = { slotPos = slotPos, id = p and p.id or "" }
	end
	return {
		tactics = {
			formation = formation.id,
			mentality = data.tactics.mentality,
			style = data.tactics.style,
			lineup = lineupInfo,
		},
		friendlies = data.friendlies.offers,
		friendlyPlayed = data.friendlies.lastCycle == data.stats.cycles,
		matches = data.matches,
		records = data.records,
		strength = math.floor(MatchService.TeamStrength(data) * 10 + 0.5) / 10,
		totals = {
			played = data.stats.matchesPlayed or 0, wins = data.stats.wins or 0, draws = data.stats.draws or 0,
			losses = data.stats.losses or 0, goalsFor = data.stats.goalsFor or 0, goalsAgainst = data.stats.goalsAgainst or 0,
		},
	}
end

return MatchService
