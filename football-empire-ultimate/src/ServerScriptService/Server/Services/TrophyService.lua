-- TrophyService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/TrophyService
--
-- CAMINO DE TROFEOS: suma o resta trofeos al terminar cada partido en grupo (lo llama el
-- servidor con el resultado real) y entrega los premios del camino al reclamarlos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local TrophyConfig = require(Shared.Config.TrophyConfig)
local CollectionConfig = require(Shared.Config.CollectionConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PetService = require(script.Parent.PetService)

local TrophyService = {}

local notifyRemote = Remotes.Get("Notify")

-- result = "win" | "draw" | "loss". Devuelve el cambio de trofeos.
function TrophyService.AfterMatch(player, result, goals, isMvp)
	local data = DataService.Get(player)
	if not data then
		return 0
	end
	local arena = data.arena
	local before = TrophyConfig.Rank(arena.trophies)
	local delta = TrophyConfig.Delta(result, goals, isMvp)
	arena.trophies = math.max(0, arena.trophies + delta)
	arena.best = math.max(arena.best, arena.trophies)
	local after = TrophyConfig.Rank(arena.trophies)
	local text = string.format("🏆 %s%d trofeos · tienes %d (%s %s)", delta >= 0 and "+" or "", delta, arena.trophies, after.icon, after.name)
	notifyRemote:FireClient(player, delta >= 0 and "success" or "warning", text)
	if after.min > before.min then
		notifyRemote:FireAllClients("info", string.format("%s %s sube al rango %s", after.icon, player.DisplayName, after.name))
	end
	return delta
end

function TrophyService.Trophies(player)
	local data = DataService.Get(player)
	return data and data.arena.trophies or 0
end

function TrophyService.Claim(player, payload)
	local data = DataService.Get(player)
	local at = type(payload) == "table" and tonumber(payload.at)
	local reward
	for _, step in ipairs(TrophyConfig.Road) do
		if step.at == at then
			reward = step
		end
	end
	if not reward then
		return false, "Ese premio no existe."
	end
	local arena = data.arena
	if arena.best < reward.at then
		return false, string.format("Necesitas llegar a %d trofeos.", reward.at)
	end
	local key = tostring(reward.at)
	if arena.claimed[key] then
		return false, "Ya has reclamado ese premio."
	end
	arena.claimed[key] = true
	local got
	if reward.money then
		EconomyService.Earn(player, reward.money, EconomyService.Category.PRIZE, "Camino de trofeos")
		got = string.format("💰 +%d $", reward.money)
	elseif reward.egg then
		got = PetService.GrantEgg(player, reward.egg) or CollectionConfig.EggById[reward.egg].name
	elseif reward.crate then
		got = PetService.GrantBall(player, reward.crate) or "📦 Ya tienes todos los balones de las cajas"
	end
	return true, string.format("🏆 Premio de %d trofeos: %s", reward.at, got or "?")
end

function TrophyService.BuildState(data)
	local arena = data.arena
	local claimed = {}
	for _, step in ipairs(TrophyConfig.Road) do
		claimed[tostring(step.at)] = arena.claimed[tostring(step.at)] == true
	end
	return { trophies = arena.trophies, best = arena.best, claimed = claimed }
end

return TrophyService
