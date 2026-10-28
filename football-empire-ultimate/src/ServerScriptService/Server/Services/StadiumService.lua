-- StadiumService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/StadiumService
--
-- ESTADIO EVOLUTIVO (FASE 2): ascenso entre las 7 etapas.
-- El servidor comprueba reputación, instalaciones, deuda y dinero con
-- EconomyFormulas.CanUpgradeStage antes de cobrar y ascender.
-- Cada ascenso queda registrado como evento real del club (base de la HISTORIA DEL CLUB).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)

local StadiumService = {}

-- Registra un evento real en el historial del club.
function StadiumService.LogEvent(data, kind, fields)
	local event = { t = os.time(), kind = kind }
	for k, v in pairs(fields or {}) do
		event[k] = v
	end
	table.insert(data.history, event)
	while #data.history > GameConfig.MAX_HISTORY_EVENTS do
		table.remove(data.history, 1)
	end
end

function StadiumService.UpgradeStage(player)
	local data = DataService.Get(player)
	local ok, reason, nextStage = EconomyFormulas.CanUpgradeStage(data)
	if not ok then
		return false, reason
	end
	local paid, payError = EconomyService.Spend(player, nextStage.upgradeCost, EconomyService.Category.CONSTRUCTION,
		"Ascenso del estadio: " .. nextStage.name)
	if not paid then
		return false, payError
	end
	data.stadium.stage = nextStage.stage
	data.stats.buildings += 1
	StadiumService.LogEvent(data, "stadium_stage", {
		stage = nextStage.stage,
		name = nextStage.name,
		reputation = EconomyFormulas.Reputation(data),
	})
	return true, string.format("🏟️ ¡Tu estadio asciende a %s (etapa %d)!", nextStage.name, nextStage.stage)
end

return StadiumService
