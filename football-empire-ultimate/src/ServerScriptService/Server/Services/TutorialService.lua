-- TutorialService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/TutorialService
--
-- PRIMEROS PASOS: comprueba con los datos reales del club qué paso de la guía toca y entrega
-- el premio de cada paso completado (en orden, una sola vez). El cliente solo muestra la guía.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local TutorialConfig = require(Shared.Config.TutorialConfig)
local OutfitConfig = require(Shared.Config.OutfitConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PetService = require(script.Parent.PetService)

local TutorialService = {}

local notifyRemote = Remotes.Get("Notify")

-- ¿Está hecho ese paso? (se mira el estado real guardado por el servidor)
local DONE = {
	name = function(data)
		return data.club.named == true
	end,
	daily = function(data)
		return data.rewards.lastClaimDay > 0
	end,
	match = function(data)
		return data.stats.arenaMatches >= 1
	end,
	egg = function(data)
		return data.collection.hatched >= 1
	end,
	equip = function(data)
		return #data.collection.equippedPets >= 1
	end,
	piece = function(data)
		return #data.stadium.pieces >= 1
	end,
	outfit = function(data)
		return data.collection.outfit ~= OutfitConfig.DEFAULT
	end,
}

-- Avanza la guía todo lo que se pueda y entrega los premios pendientes.
function TutorialService.Check(player)
	local data = DataService.Get(player)
	if not data or data.tutorial.finished then
		return
	end
	local tutorial = data.tutorial
	while tutorial.step <= #TutorialConfig.Steps do
		local step = TutorialConfig.Steps[tutorial.step]
		local done = DONE[step.id]
		if not done or not done(data) then
			break
		end
		tutorial.step += 1
		EconomyService.Earn(player, step.money, EconomyService.Category.PRIZE, "Primeros pasos")
		notifyRemote:FireClient(player, "success", string.format("✅ Primeros pasos: %s · +%d $", step.text, step.money))
	end
	if tutorial.step > #TutorialConfig.Steps then
		tutorial.finished = true
		local gift = PetService.GrantEgg(player, TutorialConfig.FINAL_EGG)
		notifyRemote:FireClient(player, "success", "🎉 ¡Primeros pasos completados! Regalo: " .. (gift or "un huevo dorado"))
	end
end

function TutorialService.BuildState(data)
	local tutorial = data.tutorial
	return {
		step = tutorial.step, -- índice del paso actual (los anteriores están hechos)
		finished = tutorial.finished,
	}
end

return TutorialService
