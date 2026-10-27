-- BuildService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/BuildService
--
-- Construcción validada en el servidor:
--   * Mejorar instalaciones (coste, nivel máximo, etapa del estadio, requisitos, deuda).
--   * Comprar y colocar decoraciones en espacios PREDEFINIDOS del propio terreno.
--   * Constructor Pro amplía el número de espacios y los diseños disponibles,
--     pero todos los espacios están dentro del terreno y pasan las mismas validaciones.
-- Solo se puede modificar el estadio propio: no existe ninguna acción que reciba
-- el identificador de otro jugador.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local GamePassConfig = require(Shared.Config.GamePassConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local GamePassService = require(script.Parent.GamePassService)

local BuildService = {}

function BuildService.MaxDecorationSlots(player)
	if GamePassService.Owns(player, "CONSTRUCTOR_PRO") then
		return GameConfig.PRO_DECORATION_SLOTS
	end
	return GameConfig.FREE_DECORATION_SLOTS
end

function BuildService.Upgrade(player, facilityId)
	local data = DataService.Get(player)
	if type(facilityId) ~= "string" then
		return false, "Solicitud no válida."
	end
	local ok, reason, levelData = EconomyFormulas.CanUpgrade(data, facilityId)
	if not ok then
		return false, reason
	end
	local def = FacilityConfig.Get(facilityId)
	local newLevel = (data.stadium.facilities[facilityId] or 0) + 1
	local paid, payError = EconomyService.Spend(player, levelData.cost, EconomyService.Category.CONSTRUCTION,
		string.format("%s nivel %d", def.name, newLevel))
	if not paid then
		return false, payError
	end
	data.stadium.facilities[facilityId] = newLevel
	data.stats.buildings += 1
	local verb = newLevel == 1 and "construida" or "mejorada a nivel " .. newLevel
	return true, string.format("%s %s %s.", def.icon, def.name, verb)
end

local function parseSlot(slot)
	slot = tonumber(slot)
	if not slot or slot ~= math.floor(slot) or slot < 1 or slot > GameConfig.PRO_DECORATION_SLOTS then
		return nil
	end
	return slot
end

function BuildService.PlaceDecoration(player, slot, decorationId)
	local data = DataService.Get(player)
	slot = parseSlot(slot)
	if not slot then
		return false, "Espacio de decoración no válido."
	end
	if slot > BuildService.MaxDecorationSlots(player) then
		return false, "Ese espacio adicional requiere el pase Constructor Pro."
	end
	local item = type(decorationId) == "string" and CosmeticConfig.ById.decoration[decorationId]
	if not item then
		return false, "Esa decoración no existe."
	end
	if item.requiredPass and not GamePassService.Owns(player, item.requiredPass) then
		local pass = GamePassConfig.Get(item.requiredPass)
		return false, string.format("«%s» requiere el pase %s.", item.name, pass and pass.name or "?")
	end
	local key = tostring(slot)
	if data.stadium.decorations[key] then
		return false, "Ese espacio ya está ocupado. Retira primero la decoración."
	end
	if data.economy.debt > GameConfig.DEBT_BUILD_LIMIT then
		return false, "Tu deuda es demasiado alta para construir. Págala primero."
	end
	local paid, payError = EconomyService.Spend(player, item.cost, EconomyService.Category.DECORATION, item.name)
	if not paid then
		return false, payError
	end
	data.stadium.decorations[key] = item.id
	return true, string.format("«%s» colocada en el espacio %d.", item.name, slot)
end

function BuildService.RemoveDecoration(player, slot)
	local data = DataService.Get(player)
	slot = parseSlot(slot)
	if not slot then
		return false, "Espacio de decoración no válido."
	end
	local key = tostring(slot)
	local decoId = data.stadium.decorations[key]
	if not decoId then
		return false, "Ese espacio está vacío."
	end
	local item = CosmeticConfig.ById.decoration[decoId]
	data.stadium.decorations[key] = nil
	local refund = math.floor((item and item.cost or 0) * CosmeticConfig.DECORATION_REFUND)
	EconomyService.Earn(player, refund, EconomyService.Category.REFUND, "Retirada: " .. (item and item.name or decoId))
	return true, string.format("Decoración retirada (+%d %s).", refund, GameConfig.CURRENCY)
end

-- Decoraciones que se muestran: las que están en espacios permitidos y cuyo pase está confirmado.
function BuildService.VisibleDecorations(player, data)
	local visible = {}
	local maxSlots = BuildService.MaxDecorationSlots(player)
	for key, decoId in pairs(data.stadium.decorations) do
		local slot = tonumber(key)
		local item = CosmeticConfig.ById.decoration[decoId]
		if slot and item and slot <= maxSlots
			and (item.requiredPass == nil or GamePassService.Owns(player, item.requiredPass)) then
			visible[slot] = decoId
		end
	end
	return visible
end

return BuildService
