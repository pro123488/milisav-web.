-- HistoryService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/HistoryService
--
-- HISTORIA DEL CLUB (FASE 8). Todo sale de acontecimientos reales ya registrados:
--   temporadas (LeagueService), títulos (trophies), ascensos/descensos y resultados
--   importantes (history), récords (records), estadísticas de todos los tiempos
--   (allTimeStats, MatchService), leyendas (SquadService), fichajes destacados
--   (TransferService) y evolución de la reputación (aquí).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FootballConfig = require(Shared.Config.FootballConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)

local HistoryService = {}

local SNAPSHOT_EVERY = 5 -- jornadas entre puntos de la gráfica de reputación

-- Texto legible de cada tipo de evento de la cronología
local function describe(e)
	local k = e.kind
	if k == "stadium_stage" then
		return "🏟️", string.format("El estadio asciende a %s (etapa %s)", tostring(e.name), tostring(e.stage))
	elseif k == "trophy" then
		return "🏆", string.format("¡Título! %s (temporada %s)", tostring(e.name), tostring(e.season))
	elseif k == "promotion" then
		return "⬆️", string.format("Ascenso de %s a %s", tostring(e.from), tostring(e.to))
	elseif k == "relegation" then
		return "⬇️", string.format("Descenso de %s a %s", tostring(e.from), tostring(e.to))
	elseif k == "big_result" then
		return "⚽", string.format("Resultado histórico: %s-%s contra %s (%s)", tostring(e.gf), tostring(e.ga), tostring(e.opponent), tostring(e.competition))
	elseif k == "transfer_in" then
		return "✍️", string.format("Fichaje de %s (media %s) por %s %s", tostring(e.name), tostring(e.ovr), tostring(e.fee), GameConfig.CURRENCY)
	elseif k == "transfer_out" then
		return "💰", string.format("Venta de %s a %s por %s %s", tostring(e.name), tostring(e.club), tostring(e.fee), GameConfig.CURRENCY)
	elseif k == "loan_in" then
		return "🔁", string.format("%s llega cedido de %s", tostring(e.name), tostring(e.club))
	elseif k == "loan_out" then
		return "🔁", string.format("%s se va cedido a %s", tostring(e.name), tostring(e.club))
	elseif k == "youth_promoted" then
		return "🧬", string.format("%s debuta desde la cantera con %s años", tostring(e.name), tostring(e.age))
	elseif k == "player_retired" then
		return "👋", string.format("Se retira %s (media máxima %s)%s", tostring(e.name), tostring(e.peak), e.legend and " · leyenda del club" or "")
	elseif k == "player_left" then
		return "🚪", string.format("%s se va al terminar su contrato", tostring(e.name))
	elseif k == "player_released" then
		return "🚪", string.format("Rescisión del contrato de %s", tostring(e.name))
	elseif k == "sponsor_signed" then
		return "🤝", string.format("Contrato de patrocinio con %s", tostring(e.brand))
	elseif k == "sponsor_expired" or k == "sponsor_terminated" then
		return "🤝", string.format("Termina el patrocinio de %s", tostring(e.brand))
	elseif k == "season_end" then
		return "📅", string.format("Fin de la temporada %s", tostring(e.season))
	elseif k == "halloween_reward" then
		return "🎃", string.format("Premio del evento de Halloween: %s", tostring(e.name))
	elseif k == "weekly_reward" then
		return "🌎", string.format("Puesto %s en la competición semanal del universo", tostring(e.rank))
	end
	return "•", k
end

function HistoryService.AfterCycle(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local reputation = EconomyFormulas.Reputation(data)
	if data.records.highestReputation == nil or reputation > data.records.highestReputation.value then
		data.records.highestReputation = { value = reputation, season = data.season.number }
	end
	if data.stats.cycles % SNAPSHOT_EVERY == 0 then
		table.insert(data.reputationHistory, { season = data.season.number, cycle = data.season.cycle, value = reputation })
		while #data.reputationHistory > 60 do
			table.remove(data.reputationHistory, 1)
		end
	end
end

local function topBy(stats, field, n)
	local list = {}
	for _, s in pairs(stats) do
		if s[field] > 0 then
			table.insert(list, s)
		end
	end
	table.sort(list, function(a, b)
		if a[field] ~= b[field] then
			return a[field] > b[field]
		end
		return a.name < b.name
	end)
	local out = {}
	for i = 1, math.min(n, #list) do
		local s = list[i]
		table.insert(out, { name = s.name, pos = FootballConfig.Position(s.pos).short, value = s[field], origin = s.origin })
	end
	return out
end

function HistoryService.BuildState(data)
	local timeline = {}
	for i = #data.history, math.max(1, #data.history - 59), -1 do
		local e = data.history[i]
		if e.kind ~= "season_end" or i == #data.history then
			local icon, text = describe(e)
			table.insert(timeline, { t = e.t, icon = icon, text = text, kind = e.kind })
		end
	end
	local league = data.league or {}
	local s = data.stats
	return {
		founded = data.club.founded,
		seasons = league.history or {},
		trophies = data.trophies,
		records = data.records,
		topScorers = topBy(data.allTimeStats, "goals", 10),
		topAssists = topBy(data.allTimeStats, "assists", 10),
		topApps = topBy(data.allTimeStats, "apps", 10),
		legends = data.legends,
		reputationHistory = data.reputationHistory,
		reputationNow = EconomyFormulas.Reputation(data),
		timeline = timeline,
		totals = {
			matches = s.matchesPlayed or 0, wins = s.wins or 0, draws = s.draws or 0, losses = s.losses or 0,
			goalsFor = s.goalsFor or 0, goalsAgainst = s.goalsAgainst or 0,
			graduates = s.academyGraduates or 0, buildings = s.buildings or 0,
		},
	}
end

return HistoryService
