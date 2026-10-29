-- CommunityService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/CommunityService
--
-- EVENTOS COMUNITARIOS (FASE 9): cada hora, un objetivo compartido por todos los clubes
-- del servidor (marcar goles, ganar o jugar partidos). Cuentan los partidos reales de
-- cualquier competición. Al cumplirse, todos los que han contribuido y siguen conectados
-- reciben la recompensa.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local NetworkConfig = require(Shared.Config.NetworkConfig)
local Remotes = require(Shared.Modules.Remotes)

local EconomyService = require(script.Parent.EconomyService)
local MatchService = require(script.Parent.MatchService)

local CommunityService = {}

local notifyRemote = Remotes.Get("Notify")
local state = { period = -1 }

local function ensurePeriod()
	local period = math.floor(os.time() / NetworkConfig.COMMUNITY_PERIOD)
	if state.period ~= period then
		local goal = NetworkConfig.COMMUNITY_GOALS[period % #NetworkConfig.COMMUNITY_GOALS + 1]
		state = { period = period, goal = goal, progress = 0, contributors = {}, completed = false }
	end
	return state
end

local function complete(s)
	s.completed = true
	local text = string.format(s.goal.text, s.goal.target)
	for userId in pairs(s.contributors) do
		local player = Players:GetPlayerByUserId(userId)
		if player then
			EconomyService.Earn(player, s.goal.reward, EconomyService.Category.PRIZE, "Evento comunitario")
		end
	end
	for _, player in ipairs(Players:GetPlayers()) do
		local contributed = s.contributors[player.UserId]
		notifyRemote:FireClient(player, "success", string.format("🤝 ¡Objetivo comunitario cumplido! «%s»%s", text,
			contributed and string.format(" · +%d %s por contribuir", s.goal.reward, GameConfig.CURRENCY) or ""))
	end
end

function CommunityService.Report(player, _, goalsFor, goalsAgainst)
	local s = ensurePeriod()
	if s.completed then
		return
	end
	local metric = s.goal.metric
	local amount = 0
	if metric == "goals" then
		amount = goalsFor
	elseif metric == "wins" then
		amount = goalsFor > goalsAgainst and 1 or 0
	elseif metric == "matches" then
		amount = 1
	end
	if amount > 0 then
		s.progress += amount
		s.contributors[player.UserId] = true
		if s.progress >= s.goal.target then
			complete(s)
		end
	end
end

function CommunityService.BuildState(player)
	local s = ensurePeriod()
	return {
		text = string.format(s.goal.text, s.goal.target),
		progress = math.min(s.progress, s.goal.target),
		target = s.goal.target,
		reward = s.goal.reward,
		completed = s.completed,
		contributed = s.contributors[player.UserId] == true,
		secondsLeft = NetworkConfig.COMMUNITY_PERIOD - (os.time() % NetworkConfig.COMMUNITY_PERIOD),
	}
end

function CommunityService.Start()
	MatchService.OnUserMatch(CommunityService.Report)
end

return CommunityService
