-- SquadService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/SquadService
--
-- FASE 4: plantilla, contratos, entrenamiento y CANTERA GENERACIONAL.
--   * Evolución por jornada según potencial, edad, entrenamiento e instalaciones.
--   * Temporadas: edad, contratos, retiradas, leyendas y nueva hornada de juveniles.
--   * Ojeadores: mejoran el potencial de la cantera, la precisión del potencial
--     estimado y traen informes con juveniles que se pueden fichar.
-- Todo se valida aquí; el cliente solo envía intenciones con IDs de SUS jugadores.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FootballConfig = require(Shared.Config.FootballConfig)
local FootballFormulas = require(Shared.Modules.FootballFormulas)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)
local PlayerFactory = require(script.Parent.Parent.Util.PlayerFactory)

local SquadService = {}

local rng = Random.new()

local function findIn(list, id)
	if type(id) ~= "string" then
		return nil
	end
	for index, p in ipairs(list) do
		if p.id == id then
			return p, index
		end
	end
	return nil
end
SquadService.FindIn = findIn

local function academyLevel(data)
	return data.stadium.facilities.academy or 0
end

function SquadService.EnsureSquad(data)
	if #data.squad == 0 then
		data.squad = PlayerFactory.StartingSquad(data)
	end
	if #data.academy.youths == 0 and data.academy.seededIntake ~= true then
		local level = academyLevel(data)
		for _ = 1, FootballConfig.Academy(level).intake + 1 do
			table.insert(data.academy.youths, PlayerFactory.Youth(data, level, data.academy.scouts))
		end
		data.academy.seededIntake = true
	end
end

-- ===== Acciones =====

function SquadService.SetIntensity(player, payload)
	local data = DataService.Get(player)
	local id = type(payload) == "table" and payload.intensity
	for _, option in ipairs(FootballConfig.TrainingIntensities) do
		if option.id == id then
			data.training.intensity = option.id
			return true, "Entrenamiento: " .. option.name
		end
	end
	return false, "Intensidad no válida."
end

function SquadService.SetFocus(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local target = findIn(data.squad, payload.id) or findIn(data.academy.youths, payload.id)
	if not target then
		return false, "Ese jugador no es de tu club."
	end
	if payload.focus == nil or payload.focus == "" then
		target.focus = nil
		return true, target.name .. ": entrenamiento equilibrado."
	end
	for _, attr in ipairs(FootballConfig.Attributes) do
		if attr.id == payload.focus then
			target.focus = attr.id
			return true, string.format("%s: entrenamiento centrado en %s.", target.name, attr.name)
		end
	end
	return false, "Atributo no válido."
end

function SquadService.Renew(player, payload)
	local data = DataService.Get(player)
	local target = type(payload) == "table" and findIn(data.squad, payload.id)
	if not target then
		return false, "Ese jugador no es de tu plantilla."
	end
	local years = tonumber(type(payload) == "table" and payload.years)
	if not years or years ~= math.floor(years) or years < 1 or years > FootballConfig.CONTRACT_MAX_SEASONS then
		return false, "Duración no válida."
	end
	if target.contract > FootballConfig.RENEW_WINDOW then
		return false, string.format("Solo se puede renovar cuando quedan %d temporadas o menos.", FootballConfig.RENEW_WINDOW)
	end
	if target.age >= FootballConfig.RETIRE_FORCED_AGE - 1 and years > 1 then
		return false, "Por su edad, solo acepta renovar 1 temporada."
	end
	local demand = FootballFormulas.SalaryDemand(target)
	target.salary = demand
	target.contract = years
	return true, string.format("%s renueva %d temporada(s) por %d %s/jornada.", target.name, years, demand, GameConfig.CURRENCY)
end

function SquadService.Release(player, payload)
	local data = DataService.Get(player)
	local target, index = findIn(data.squad, type(payload) == "table" and payload.id)
	if not target then
		return false, "Ese jugador no es de tu plantilla."
	end
	if #data.squad <= FootballConfig.MIN_SQUAD then
		return false, string.format("Necesitas al menos %d jugadores en la plantilla.", FootballConfig.MIN_SQUAD)
	end
	local cost = FootballFormulas.ReleaseCost(target)
	local paid, err = EconomyService.Spend(player, cost, EconomyService.Category.WAGES, "Rescisión: " .. target.name)
	if not paid then
		return false, "No puedes pagar la rescisión (" .. cost .. " " .. GameConfig.CURRENCY .. "): " .. tostring(err)
	end
	table.remove(data.squad, index)
	StadiumService.LogEvent(data, "player_released", { name = target.name, ovr = FootballFormulas.OverallInt(target) })
	return true, target.name .. " deja el club."
end

function SquadService.PromoteYouth(player, payload)
	local data = DataService.Get(player)
	local youth, index = findIn(data.academy.youths, type(payload) == "table" and payload.id)
	if not youth then
		return false, "Ese juvenil no está en tu academia."
	end
	if youth.age < FootballConfig.YOUTH_MIN_PROMOTE_AGE then
		return false, string.format("Debe tener al menos %d años.", FootballConfig.YOUTH_MIN_PROMOTE_AGE)
	end
	if #data.squad >= FootballConfig.MAX_SQUAD then
		return false, string.format("La plantilla está llena (%d). Haz sitio primero.", FootballConfig.MAX_SQUAD)
	end
	table.remove(data.academy.youths, index)
	youth.salary = math.max(2, math.floor(FootballFormulas.SalaryDemand(youth) * FootballConfig.YOUTH_SALARY_SHARE))
	youth.contract = 3
	youth.joinedSeason = data.season.number
	table.insert(data.squad, youth)
	data.stats.academyGraduates = (data.stats.academyGraduates or 0) + 1
	StadiumService.LogEvent(data, "youth_promoted", { name = youth.name, ovr = FootballFormulas.OverallInt(youth), age = youth.age })
	return true, string.format("🧬 %s sube al primer equipo.", youth.name)
end

function SquadService.ReleaseYouth(player, payload)
	local data = DataService.Get(player)
	local youth, index = findIn(data.academy.youths, type(payload) == "table" and payload.id)
	if not youth then
		return false, "Ese juvenil no está en tu academia."
	end
	table.remove(data.academy.youths, index)
	return true, youth.name .. " deja la academia."
end

function SquadService.SetScouts(player, payload)
	local data = DataService.Get(player)
	local count = tonumber(type(payload) == "table" and payload.count)
	if not count or count ~= math.floor(count) or count < 0 or count > FootballConfig.MAX_SCOUTS then
		return false, "Número de ojeadores no válido."
	end
	data.academy.scouts = count
	if count > 0 and #data.academy.reports == 0 then
		data.academy.nextReport = data.stats.cycles + 1 -- primer informe en la próxima jornada
	end
	if count == 0 then
		data.academy.reports = {}
	end
	return true, count == 0 and "Has despedido a los ojeadores." or string.format("Ahora tienes %d ojeador(es).", count)
end

function SquadService.SignReport(player, payload)
	local data = DataService.Get(player)
	local candidate, index = findIn(data.academy.reports, type(payload) == "table" and payload.id)
	if not candidate then
		return false, "Ese informe ya no está disponible."
	end
	local level = academyLevel(data)
	if #data.academy.youths >= FootballConfig.Academy(level).capacity then
		return false, "La academia está llena. Mejora la Academia juvenil o haz sitio."
	end
	local fee = FootballFormulas.YouthSignFee(candidate.potential)
	local paid, err = EconomyService.Spend(player, fee, EconomyService.Category.ACADEMY, "Fichaje juvenil: " .. candidate.name)
	if not paid then
		return false, err
	end
	table.remove(data.academy.reports, index)
	table.insert(data.academy.youths, candidate)
	return true, string.format("🔎 %s se incorpora a la academia.", candidate.name)
end

-- ===== Evolución y temporadas =====

local function trainingMultiplier(data)
	local intensity = FootballConfig.Intensity(data.training.intensity)
	local trainingLevel = data.stadium.facilities.training or 0
	return intensity.growth * (1 + FootballConfig.TRAINING_FACILITY_BONUS * trainingLevel)
end

local function grow(player, multiplier)
	local delta = FootballFormulas.GrowthPerCycle(player, multiplier)
	FootballFormulas.ApplyGrowth(player, delta)
	local ovr = FootballFormulas.Overall(player)
	if ovr > (player.peak or 0) then
		player.peak = ovr
	end
end

local function legendCheck(data, p)
	local peak = math.floor((p.peak or 0) + 0.5)
	local apps = p.stats and p.stats.apps or 0
	local isLegend = peak >= FootballConfig.LEGEND_MIN_PEAK
		or (p.origin == "academy" and peak >= FootballConfig.LEGEND_MIN_ACADEMY_PEAK)
		or apps >= FootballConfig.LEGEND_MIN_APPS
	if isLegend then
		table.insert(data.legends, {
			name = p.name,
			pos = p.pos,
			peak = peak,
			origin = p.origin,
			seasons = math.max(1, data.season.number - (p.joinedSeason or data.season.number)),
			apps = apps,
			goals = p.stats and p.stats.goals or 0,
			assists = p.stats and p.stats.assists or 0,
			retiredSeason = data.season.number,
		})
		while #data.legends > 50 do
			table.remove(data.legends, 1)
		end
	end
	return isLegend
end

local function seasonEnd(data, messages)
	local finished = data.season.number
	data.season.number += 1
	data.season.cycle = 0

	-- Primer equipo: edad, contratos y retiradas
	local keep = {}
	for _, p in ipairs(data.squad) do
		p.age += 1
		p.contract -= 1
		local retireChance = (p.age - FootballConfig.RETIRE_MIN_AGE + 1) * FootballConfig.RETIRE_CHANCE_PER_YEAR
		if p.age >= FootballConfig.RETIRE_FORCED_AGE or (p.age >= FootballConfig.RETIRE_MIN_AGE and rng:NextNumber() < retireChance) then
			local legend = legendCheck(data, p)
			StadiumService.LogEvent(data, "player_retired", { name = p.name, age = p.age, peak = math.floor(p.peak + 0.5), legend = legend })
			table.insert(messages, string.format("👋 %s se retira con %d años%s.", p.name, p.age, legend and " y entra en las leyendas del club" or ""))
		elseif p.contract <= 0 then
			StadiumService.LogEvent(data, "player_left", { name = p.name, reason = "contract" })
			table.insert(messages, p.name .. " termina su contrato y deja el club.")
		else
			table.insert(keep, p)
		end
	end
	data.squad = keep

	-- Academia: edad y salidas
	local youths = {}
	for _, y in ipairs(data.academy.youths) do
		y.age += 1
		if y.age > FootballConfig.YOUTH_MAX_AGE then
			table.insert(messages, y.name .. " cumple " .. y.age .. " años y deja la academia sin debutar.")
		else
			table.insert(youths, y)
		end
	end
	data.academy.youths = youths

	-- Nueva hornada
	local level = academyLevel(data)
	local academy = FootballConfig.Academy(level)
	local free = academy.capacity - #data.academy.youths
	local intake = math.min(academy.intake, free)
	for _ = 1, intake do
		table.insert(data.academy.youths, PlayerFactory.Youth(data, level, data.academy.scouts))
	end
	if intake > 0 then
		table.insert(messages, string.format("🧬 Llega una nueva hornada a la cantera: %d juvenil(es).", intake))
	end
	if #data.squad < FootballConfig.MIN_SQUAD then
		-- Garantía de jugabilidad: se completan plazas con jugadores libres modestos.
		while #data.squad < FootballConfig.MIN_SQUAD do
			local positions = FootballConfig.Positions
			table.insert(data.squad, PlayerFactory.Create(data, {
				pos = positions[rng:NextInteger(1, #positions)].id,
				overall = rng:NextInteger(FootballConfig.STARTING_OVERALL.min, FootballConfig.STARTING_OVERALL.max),
				age = rng:NextInteger(20, 30),
				origin = "free",
			}))
		end
		table.insert(messages, "Se han incorporado jugadores libres para completar la plantilla mínima.")
	end
	StadiumService.LogEvent(data, "season_end", { season = finished })
	table.insert(messages, string.format("📅 Termina la temporada %d. ¡Empieza la temporada %d!", finished, data.season.number))
end

local function refreshReports(data)
	local academy = data.academy
	if academy.scouts <= 0 then
		academy.reports = {}
		return
	end
	if data.stats.cycles >= (academy.nextReport or 0) then
		academy.reports = {}
		for _ = 1, academy.scouts do
			local candidate = PlayerFactory.Youth(data, academyLevel(data), academy.scouts)
			table.insert(academy.reports, candidate)
		end
		academy.nextReport = data.stats.cycles + FootballConfig.SCOUT_REPORT_CYCLES
	end
end

-- Se llama después de cada jornada. Devuelve mensajes para el jugador.
function SquadService.AfterCycle(player)
	local data = DataService.Get(player)
	if not data then
		return {}
	end
	local messages = {}
	local multiplier = trainingMultiplier(data)
	for _, p in ipairs(data.squad) do
		grow(p, multiplier)
	end
	local youthMultiplier = FootballConfig.Academy(academyLevel(data)).growth * FootballConfig.Intensity(data.training.intensity).growth
	for _, y in ipairs(data.academy.youths) do
		grow(y, youthMultiplier)
	end
	refreshReports(data)
	data.season.cycle += 1
	if data.season.cycle >= FootballConfig.SEASON_LENGTH then
		seasonEnd(data, messages)
	end
	return messages
end

-- ===== Estado para el cliente (sin el potencial exacto) =====

local function publicPlayer(p, scouts, multiplier)
	local low, high = FootballFormulas.PotentialRange(p, scouts)
	local attrs = {}
	for id, v in pairs(p.attrs) do
		attrs[id] = math.floor(v + 0.5)
	end
	return {
		id = p.id,
		name = p.name,
		age = p.age,
		pos = p.pos,
		attrs = attrs,
		ovr = FootballFormulas.OverallInt(p),
		potentialLow = low,
		potentialHigh = high,
		star = low >= FootballConfig.STAR_POTENTIAL,
		value = FootballFormulas.MarketValue(p),
		salary = p.salary,
		salaryDemand = FootballFormulas.SalaryDemand(p),
		contract = p.contract,
		releaseCost = FootballFormulas.ReleaseCost(p),
		focus = p.focus,
		origin = p.origin,
		fitness = math.floor((p.fitness or 100) + 0.5),
		injury = p.injury or 0,
		stats = p.stats,
		growth = math.floor(FootballFormulas.GrowthPerCycle(p, multiplier or 1) * FootballConfig.SEASON_LENGTH * 10 + 0.5) / 10, -- media prevista por temporada
		signFee = p.origin == "academy" and FootballFormulas.YouthSignFee(p.potential) or nil,
	}
end

function SquadService.BuildState(data)
	local scouts = data.academy.scouts
	local squad, youths, reports = {}, {}, {}
	local squadMultiplier = trainingMultiplier(data)
	local youthMultiplier = FootballConfig.Academy(academyLevel(data)).growth * FootballConfig.Intensity(data.training.intensity).growth
	for _, p in ipairs(data.squad) do
		table.insert(squad, publicPlayer(p, scouts, squadMultiplier))
	end
	for _, y in ipairs(data.academy.youths) do
		table.insert(youths, publicPlayer(y, scouts, youthMultiplier))
	end
	for _, r in ipairs(data.academy.reports) do
		table.insert(reports, publicPlayer(r, scouts, youthMultiplier))
	end
	local level = academyLevel(data)
	return {
		squad = squad,
		academy = {
			youths = youths,
			reports = reports,
			scouts = scouts,
			level = level,
			capacity = FootballConfig.Academy(level).capacity,
			intake = FootballConfig.Academy(level).intake,
			nextReportIn = math.max(0, (data.academy.nextReport or 0) - data.stats.cycles),
		},
		training = {
			intensity = data.training.intensity,
			multiplier = trainingMultiplier(data),
		},
		season = { number = data.season.number, cycle = data.season.cycle, length = FootballConfig.SEASON_LENGTH },
		legends = data.legends,
		graduates = data.stats.academyGraduates or 0,
	}
end

return SquadService
