-- TournamentService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/TournamentService
--
-- TORNEOS DEL SERVIDOR (FASE 9): un jugador crea un torneo (4 u 8 clubes), los demás
-- jugadores del servidor se apuntan durante 45 s y los huecos se completan con clubes
-- ficticios. Eliminatorias simuladas en directo, ronda a ronda.
-- El campeón recibe trofeo y premio SOLO si participan al menos 2 clubes humanos
-- (un torneo contra la máquina es de práctica: evita repetir torneos para ganar dinero).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local NetworkConfig = require(Shared.Config.NetworkConfig)
local LeagueConfig = require(Shared.Config.LeagueConfig)
local TacticsConfig = require(Shared.Config.TacticsConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local ClubService = require(script.Parent.ClubService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)
local MatchService = require(script.Parent.MatchService)

local TournamentService = {}

local notifyRemote = Remotes.Get("Notify")
local rng = Random.new()
local current = nil -- torneo activo del servidor
local nextId = 0

local function humans(t)
	local n = 0
	for _, e in ipairs(t.entrants) do
		if e.player then
			n += 1
		end
	end
	return n
end

local function broadcast(t, kind, message)
	for _, e in ipairs(t.entrants) do
		if e.player and e.player.Parent then
			notifyRemote:FireClient(e.player, kind, message)
		end
	end
end

local function available(data)
	local n = 0
	for _, p in ipairs(data.squad) do
		if (p.injury or 0) <= 0 and not (p.loan and p.loan.type == "out") then
			n += 1
		end
	end
	return n >= 11
end

local function userEntrant(player)
	local data = DataService.Get(player)
	return {
		player = player,
		name = ClubService.DisplayName(data),
		short = ClubService.ShortName(data),
		strength = math.floor(MatchService.TeamStrength(data) + 0.5),
	}
end

function TournamentService.Create(player, payload)
	local data = DataService.Get(player)
	if current and current.status ~= "done" then
		return false, "Ya hay un torneo en marcha en este servidor. ¡Apúntate!"
	end
	local size = tonumber(type(payload) == "table" and payload.size)
	local valid = false
	for _, s in ipairs(NetworkConfig.TOURNAMENT_SIZES) do
		if s == size then
			valid = true
		end
	end
	if not valid then
		return false, "Tamaño de torneo no válido."
	end
	if os.time() < (data.network.tournamentCooldown or 0) then
		return false, string.format("Podrás crear otro torneo en %d minutos.", math.ceil((data.network.tournamentCooldown - os.time()) / 60))
	end
	if not available(data) then
		return false, "No tienes 11 jugadores disponibles."
	end
	data.network.tournamentCooldown = os.time() + NetworkConfig.TOURNAMENT_COOLDOWN
	nextId += 1
	current = {
		id = nextId,
		size = size,
		creator = player.DisplayName,
		status = "open",
		startsAt = os.clock() + NetworkConfig.TOURNAMENT_JOIN_SECONDS,
		entrants = { userEntrant(player) },
		rounds = {},
	}
	for _, other in ipairs(Players:GetPlayers()) do
		if other ~= player then
			notifyRemote:FireClient(other, "info", string.format("🏆 %s ha creado un %s de %d clubes. ¡Apúntate en Red de clubes › Torneo!",
				player.DisplayName, NetworkConfig.TOURNAMENT_NAME, size))
		end
	end
	return true, string.format("🏆 Torneo creado. La inscripción se cierra en %d s.", NetworkConfig.TOURNAMENT_JOIN_SECONDS)
end

function TournamentService.Join(player)
	local data = DataService.Get(player)
	if not current or current.status ~= "open" then
		return false, "No hay ningún torneo con la inscripción abierta."
	end
	for _, e in ipairs(current.entrants) do
		if e.player == player then
			return false, "Ya estás inscrito."
		end
	end
	if #current.entrants >= current.size then
		return false, "El torneo está completo."
	end
	if not available(data) then
		return false, "No tienes 11 jugadores disponibles."
	end
	table.insert(current.entrants, userEntrant(player))
	return true, "✅ Inscrito en el " .. NetworkConfig.TOURNAMENT_NAME .. "."
end

-- Partido de una eliminatoria. Devuelve el ganador y el texto del resultado.
local function playTie(t, a, b, roundName)
	local hg, ag
	local competition = NetworkConfig.TOURNAMENT_NAME
	if a.player and b.player and a.player.Parent and b.player.Parent then
		local result = MatchService.PlayUsers(a.player, b.player, competition, a, b)
		if result then
			hg, ag = result.home.goals, result.away.goals
			for side, p in ipairs({ a.player, b.player }) do
				local copy = table.clone(result)
				copy.userSide = side
				local us = side == 1 and hg or ag
				local them = side == 1 and ag or hg
				copy.outcome = us > them and "W" or (us == them and "D" or "L")
				notifyRemote:FireClient(p, "match", copy)
			end
		end
	end
	if not hg then
		local human = (a.player and a.player.Parent) and a or ((b.player and b.player.Parent) and b or nil)
		if human then
			local ai = human == a and b or a
			local result = MatchService.Play(human.player, ai.opponent or { name = ai.name, short = ai.short, strength = ai.strength, seed = rng:NextInteger(1, 2 ^ 30),
				formation = TacticsConfig.DEFAULT_FORMATION, mentality = "BALANCED", style = "POSSESSION" }, {
				clubName = human.name, clubShort = human.short, home = human == a, competition = competition, noEconomy = true,
			})
			hg, ag = result.home.goals, result.away.goals
			notifyRemote:FireClient(human.player, "match", result)
		else
			-- Dos clubes ficticios (o jugadores que ya se fueron): por nivel
			local pa = 1 / (1 + math.exp(-((a.player and not a.player.Parent and 0 or a.strength) - (b.player and not b.player.Parent and 0 or b.strength)) / 6))
			hg = rng:NextNumber() < pa and rng:NextInteger(1, 3) or rng:NextInteger(0, 1)
			ag = hg > 0 and rng:NextInteger(0, hg) or rng:NextInteger(0, 1)
		end
	end
	local winner, penalties = nil, false
	if hg > ag then
		winner = a
	elseif ag > hg then
		winner = b
	else
		penalties = true
		winner = rng:NextNumber() < math.clamp(0.5 + (a.strength - b.strength) / 100, 0.2, 0.8) and a or b
	end
	local text = string.format("%s: %s %d - %d %s%s → pasa %s", roundName, a.short, hg, ag, b.short, penalties and " (penaltis)" or "", winner.short)
	return winner, text
end

local function roundName(remaining)
	if remaining == 2 then
		return "Final"
	elseif remaining == 4 then
		return "Semifinal"
	end
	return "Cuartos de final"
end

local function run(t)
	t.status = "running"
	-- Completar con clubes ficticios del nivel medio de los humanos
	local total, n = 0, 0
	for _, e in ipairs(t.entrants) do
		total += e.strength
		n += 1
	end
	local avg = n > 0 and total / n or 50
	while #t.entrants < t.size do
		local name, short = MatchService.RandomClubName(rng)
		local strength = math.clamp(math.floor(avg + rng:NextInteger(-5, 5) + 0.5), 35, 92)
		table.insert(t.entrants, {
			name = name, short = short, strength = strength,
			opponent = { name = name, short = short, strength = strength, seed = rng:NextInteger(1, 2 ^ 30),
				formation = TacticsConfig.Formations[rng:NextInteger(1, #TacticsConfig.Formations)].id,
				mentality = TacticsConfig.Mentalities[rng:NextInteger(1, #TacticsConfig.Mentalities)].id,
				style = TacticsConfig.Styles[rng:NextInteger(1, #TacticsConfig.Styles)].id },
		})
	end
	for i = #t.entrants, 2, -1 do
		local j = rng:NextInteger(1, i)
		t.entrants[i], t.entrants[j] = t.entrants[j], t.entrants[i]
	end
	broadcast(t, "info", string.format("🏆 ¡Empieza el %s! %d clubes (%d humanos).", NetworkConfig.TOURNAMENT_NAME, t.size, humans(t)))
	local alive = table.clone(t.entrants)
	while #alive > 1 do
		task.wait(NetworkConfig.TOURNAMENT_ROUND_SECONDS)
		local name = roundName(#alive)
		local winners, lines = {}, {}
		for i = 1, #alive, 2 do
			local winner, text = playTie(t, alive[i], alive[i + 1], name)
			table.insert(winners, winner)
			table.insert(lines, text)
		end
		table.insert(t.rounds, { name = name, lines = lines })
		broadcast(t, "info", "🏆 " .. table.concat(lines, " · "))
		alive = winners
	end
	local champion = alive[1]
	t.champion = champion.name
	t.status = "done"
	local rewarded = humans(t) >= 2 and champion.player and champion.player.Parent
	if rewarded then
		local data = DataService.Get(champion.player)
		if data then
			local division = LeagueConfig.Division(data.league and data.league.division or 1)
			local prize = NetworkConfig.TOURNAMENT_PRIZE * division.prize
			EconomyService.Earn(champion.player, prize, EconomyService.Category.PRIZE, NetworkConfig.TOURNAMENT_NAME)
			data.network.points += NetworkConfig.TOURNAMENT_POINTS
			table.insert(data.trophies, { kind = "tournament", name = NetworkConfig.TOURNAMENT_NAME, season = data.season.number })
			StadiumService.LogEvent(data, "trophy", { kind = "tournament", name = NetworkConfig.TOURNAMENT_NAME, season = data.season.number })
			notifyRemote:FireClient(champion.player, "success", string.format("🏆 ¡Campeón del %s! +%d %s y +%d puntos de red.",
				NetworkConfig.TOURNAMENT_NAME, prize, GameConfig.CURRENCY, NetworkConfig.TOURNAMENT_POINTS))
		end
	end
	broadcast(t, "info", string.format("🏆 Campeón del torneo: %s%s", champion.name, rewarded and "" or " (torneo de práctica: sin premio)"))
end

function TournamentService.Start()
	task.spawn(function()
		while true do
			task.wait(1)
			local t = current
			if t and t.status == "open" and (os.clock() >= t.startsAt or #t.entrants >= t.size) then
				task.spawn(run, t)
			end
		end
	end)
end

function TournamentService.BuildState(player)
	if not current then
		return nil
	end
	local t = current
	local entrants, joined = {}, false
	for _, e in ipairs(t.entrants) do
		table.insert(entrants, { name = e.name, short = e.short, strength = e.strength, human = e.player ~= nil })
		if e.player == player then
			joined = true
		end
	end
	return {
		id = t.id, size = t.size, creator = t.creator, status = t.status, champion = t.champion,
		secondsLeft = t.status == "open" and math.max(0, math.floor(t.startsAt - os.clock())) or 0,
		entrants = entrants, rounds = t.rounds, joined = joined, humans = humans(t),
	}
end

return TournamentService
