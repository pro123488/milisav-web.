-- MissionService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/MissionService
--
-- MISIONES Y LOGROS (FASE 10).
--   * Track(jugador, métrica, cantidad): lo llama el servidor ante acontecimientos reales
--     (partidos, construcciones, fichajes, jornadas, caramelos…). El cliente no puede sumar progreso.
--   * Misiones diarias (3 al día, recompensa al reclamarlas) y cadenas de progreso permanentes.
--   * Logros comprobados con los datos reales del club; se conceden una sola vez.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local MissionConfig = require(Shared.Config.MissionConfig)
local HalloweenConfig = require(Shared.Config.HalloweenConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)

local MissionService = {}

local notifyRemote = Remotes.Get("Notify")
local rng = Random.new()

local function today()
	return math.floor(os.time() / 86400)
end

local function divisionScale(data)
	local division = data.league and data.league.division or 1
	return 1 + (division - 1) * 0.25 -- de ×1 (Regional) a ×2 (Primera)
end

-- Genera las misiones del día si ha cambiado el día.
function MissionService.EnsureDaily(data)
	local m = data.missions
	if m.day == today() and #m.daily > 0 then
		return
	end
	m.day = today()
	m.daily = {}
	local pool = {}
	for _, def in ipairs(MissionConfig.DailyPool) do
		if def.event ~= "halloween" or HalloweenConfig.IsActive() then
			table.insert(pool, def)
		end
	end
	for _ = 1, math.min(MissionConfig.DAILY_COUNT, #pool) do
		local def = table.remove(pool, rng:NextInteger(1, #pool))
		table.insert(m.daily, {
			id = def.id,
			target = math.max(1, math.floor(def.target * divisionScale(data) + 0.5)),
			progress = 0,
			claimed = false,
		})
	end
end

function MissionService.Track(player, metric, amount)
	local data = DataService.Get(player)
	amount = math.floor(tonumber(amount) or 0)
	if not data or amount <= 0 or not MissionConfig.Metrics[metric] then
		return
	end
	MissionService.EnsureDaily(data)
	local m = data.missions
	m.counters[metric] = (m.counters[metric] or 0) + amount
	for _, mission in ipairs(m.daily) do
		local def = MissionConfig.Daily(mission.id)
		if def and def.metric == metric and mission.progress < mission.target then
			mission.progress = math.min(mission.target, mission.progress + amount)
			if mission.progress >= mission.target then
				notifyRemote:FireClient(player, "success", "🎯 Misión diaria completada: " .. string.format(def.text, mission.target) .. ". ¡Reclama la recompensa en Misiones!")
			end
		end
	end
end

local function reward(player, data, money, reputation, label)
	if money and money > 0 then
		EconomyService.Earn(player, money, EconomyService.Category.PRIZE, label)
	end
	if reputation and reputation > 0 then
		data.club.reputationEarned += reputation
	end
end

function MissionService.ClaimDaily(player, payload)
	local data = DataService.Get(player)
	MissionService.EnsureDaily(data)
	local id = type(payload) == "table" and payload.id
	for _, mission in ipairs(data.missions.daily) do
		if mission.id == id then
			if mission.claimed then
				return false, "Ya has reclamado esta misión."
			end
			if mission.progress < mission.target then
				return false, "Todavía no has completado esta misión."
			end
			local def = MissionConfig.Daily(id)
			mission.claimed = true
			reward(player, data, def.money, def.reputation, "Misión diaria")
			return true, string.format("🎯 Recompensa: +%d %s%s", def.money, GameConfig.CURRENCY,
				def.reputation > 0 and string.format(" y +%d de reputación", def.reputation) or "")
		end
	end
	return false, "Esa misión no está disponible hoy."
end

function MissionService.ClaimChain(player, payload)
	local data = DataService.Get(player)
	local chain = MissionConfig.Chain(type(payload) == "table" and payload.id)
	if not chain then
		return false, "Misión no válida."
	end
	local level = (data.missions.chainLevels[chain.id] or 0) + 1
	local target = chain.targets[level]
	if not target then
		return false, "Ya has completado toda la cadena."
	end
	if (data.missions.counters[chain.metric] or 0) < target then
		return false, "Todavía no has llegado al objetivo."
	end
	data.missions.chainLevels[chain.id] = level
	reward(player, data, chain.money[level], 0, chain.name .. " " .. level)
	return true, string.format("🏁 %s nivel %d completado: +%d %s", chain.name, level, chain.money[level], GameConfig.CURRENCY)
end

-- ===== Logros =====

function MissionService.Stat(data, stat)
	if stat == "wins" then
		return data.stats.wins or 0
	elseif stat == "goals" then
		return data.stats.goalsFor or 0
	elseif stat == "titles" then
		return #data.trophies
	elseif stat == "stage" then
		return data.stadium.stage
	elseif stat == "fans" then
		return data.club.fans
	elseif stat == "graduates" then
		return data.stats.academyGraduates or 0
	elseif stat == "legends" then
		return #data.legends
	elseif stat == "division" then
		return data.league and data.league.division or 1
	elseif stat == "earned" then
		return data.economy.totalEarned
	elseif stat == "networkPoints" then
		return data.network.points
	elseif stat == "candy" then
		return data.halloween.total
	elseif stat == "reputation" then
		return EconomyFormulas.Reputation(data)
	end
	return 0
end

function MissionService.EvaluateAchievements(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	for _, a in ipairs(MissionConfig.Achievements) do
		if not data.missions.achievements[a.id] and MissionService.Stat(data, a.stat) >= a.target then
			data.missions.achievements[a.id] = os.time()
			reward(player, data, a.money, a.reputation, "Logro: " .. a.name)
			StadiumService.LogEvent(data, "achievement", { name = a.name })
			notifyRemote:FireClient(player, "success", string.format("%s ¡Logro desbloqueado! %s%s", a.icon, a.name,
				(a.money > 0 and string.format(" · +%d %s", a.money, GameConfig.CURRENCY) or "")))
		end
	end
end

function MissionService.BuildState(data)
	MissionService.EnsureDaily(data)
	local m = data.missions
	local daily = {}
	for _, mission in ipairs(m.daily) do
		local def = MissionConfig.Daily(mission.id)
		if def then
			table.insert(daily, {
				id = mission.id, text = string.format(def.text, mission.target), progress = mission.progress, target = mission.target,
				claimed = mission.claimed, money = def.money, reputation = def.reputation,
			})
		end
	end
	local chains = {}
	for _, chain in ipairs(MissionConfig.Chains) do
		local level = m.chainLevels[chain.id] or 0
		local nextTarget = chain.targets[level + 1]
		table.insert(chains, {
			id = chain.id, name = chain.name, metric = MissionConfig.Metrics[chain.metric], level = level, levels = #chain.targets,
			progress = m.counters[chain.metric] or 0, target = nextTarget, money = nextTarget and chain.money[level + 1] or 0,
		})
	end
	local achievements = {}
	for _, a in ipairs(MissionConfig.Achievements) do
		table.insert(achievements, {
			id = a.id, icon = a.icon, name = a.name, target = a.target, progress = math.min(MissionService.Stat(data, a.stat), a.target),
			unlockedAt = m.achievements[a.id], money = a.money, reputation = a.reputation,
		})
	end
	return { daily = daily, chains = chains, achievements = achievements, resetIn = 86400 - (os.time() % 86400) }
end

return MissionService
