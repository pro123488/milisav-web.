-- RebirthService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/RebirthService
--
-- RENACIMIENTOS. El servidor comprueba los requisitos (etapa del estadio y dinero) y aplica el
-- reinicio: dinero, deuda, afición, instalaciones y etapa del estadio vuelven al principio.
-- Se conserva todo lo demás. Los bonus (ingresos, partidos, huecos de mascota…) se calculan a
-- partir del número de renacimientos guardado, así que no hay nada más que «dar».

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local RebirthConfig = require(Shared.Config.RebirthConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local GameConfig = require(Shared.Config.GameConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)

local RebirthService = {}

local notifyRemote = Remotes.Get("Notify")

function RebirthService.Count(player)
	local data = DataService.Get(player)
	return data and data.rebirth.count or 0
end

function RebirthService.Rebirth(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" or payload.confirm ~= true then
		return false, "Confirma el renacimiento."
	end
	local count = data.rebirth.count
	if count >= RebirthConfig.MAX then
		return false, string.format("Has llegado al máximo de %d renacimientos.", RebirthConfig.MAX)
	end
	local requirement = RebirthConfig.Requirement(count)
	if data.stadium.stage < requirement.stage then
		return false, string.format("Necesitas el estadio en la etapa %d (ahora estás en la %d).", requirement.stage, data.stadium.stage)
	end
	if data.economy.money < requirement.money then
		return false, string.format("Necesitas %d %s para renacer.", requirement.money, GameConfig.CURRENCY)
	end
	if data.economy.debt > 0 then
		return false, "Paga tu deuda antes de renacer."
	end

	-- Reinicio del estadio y de la economía
	local economy = data.economy
	local spent = economy.money
	economy.money = GameConfig.STARTING_MONEY
	economy.debt = 0
	EconomyService.AddTransaction(data, -spent, EconomyService.Category.REBIRTH, string.format("Renacimiento %d", count + 1))
	local facilities = {}
	for id, def in pairs(FacilityConfig.Facilities) do
		if def.startLevel > 0 then
			facilities[id] = def.startLevel
		end
	end
	data.stadium.facilities = facilities
	data.stadium.stage = 1
	data.club.fans = GameConfig.STARTING_FANS
	data.club.members = 0
	data.club.satisfaction = GameConfig.SATISFACTION_START

	data.rebirth.count = count + 1
	data.rebirth.lastAt = os.time()
	if data.rebirth.count >= RebirthConfig.BALL_AT then
		data.collection.balls[RebirthConfig.BALL] = true
	end
	StadiumService.LogEvent(data, "rebirth", { count = data.rebirth.count })
	notifyRemote:FireAllClients("info", string.format("🔄 %s ha renacido por %d.ª vez", player.DisplayName, data.rebirth.count))
	return true, string.format("🔄 ¡Renacimiento %d! Ahora ganas +%d %% en cada jornada y +%d %% en los partidos.",
		data.rebirth.count, math.floor(RebirthConfig.IncomeBonus(data.rebirth.count) * 100 + 0.5),
		math.floor(RebirthConfig.ArenaBonus(data.rebirth.count) * 100 + 0.5)), true
end

function RebirthService.BuildState(data)
	local count = data.rebirth.count
	return {
		count = count,
		max = RebirthConfig.MAX,
		next = count < RebirthConfig.MAX and RebirthConfig.Requirement(count) or nil,
	}
end

return RebirthService
