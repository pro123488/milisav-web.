-- BuildService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/BuildService
--
-- Construcción validada en el servidor:
--   * Mejorar instalaciones (coste, nivel máximo, etapa del estadio, requisitos, deuda).
--   * CONSTRUCCIÓN AVANZADA (FASE 2): colocar, mover y retirar decoraciones en
--     posición libre dentro de la zona de decoración del propio terreno.
--     PlacementRules valida zona, áreas reservadas, colisiones, rejilla y rotación.
--   * Constructor Pro: rejilla fina (1 stud), rotación a 45° y +6 decoraciones,
--     con exactamente las mismas zonas, colisiones y costes que el resto.
-- Solo se puede modificar el estadio propio: ninguna acción recibe el ID de otro jugador.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local GamePassConfig = require(Shared.Config.GamePassConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)
local PlacementRules = require(Shared.Modules.PlacementRules)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local GamePassService = require(script.Parent.GamePassService)

local BuildService = {}

function BuildService.IsPro(player)
	return GamePassService.Owns(player, "CONSTRUCTOR_PRO")
end

-- Límite de decoraciones: el de la etapa del estadio + extra de Constructor Pro.
function BuildService.MaxDecorations(player, data)
	local limit = EconomyFormulas.FreeDecorationLimit(data.stadium.stage)
	if BuildService.IsPro(player) then
		limit += GameConfig.PRO_EXTRA_DECORATIONS
	end
	return math.min(limit, GameConfig.MAX_DECORATIONS)
end

function BuildService.Tools(player)
	return PlacementRules.Tools(BuildService.IsPro(player))
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

local function readPlacement(payload)
	if type(payload) ~= "table" then
		return nil
	end
	local x, z, r = tonumber(payload.x), tonumber(payload.z), tonumber(payload.rotation)
	if not x or not z or not r then
		return nil
	end
	return x, z, r
end

local function passCheck(player, item)
	if item.requiredPass and not GamePassService.Owns(player, item.requiredPass) then
		local pass = GamePassConfig.Get(item.requiredPass)
		return false, string.format("«%s» requiere el pase %s.", item.name, pass and pass.name or "?")
	end
	return true
end

function BuildService.PlaceDecoration(player, payload)
	local data = DataService.Get(player)
	local decoId = type(payload) == "table" and payload.decoration
	local item = type(decoId) == "string" and CosmeticConfig.ById.decoration[decoId]
	if not item then
		return false, "Esa decoración no existe."
	end
	local x, z, rotation = readPlacement(payload)
	if not x then
		return false, "Posición no válida."
	end
	local allowed, passError = passCheck(player, item)
	if not allowed then
		return false, passError
	end
	local list = data.stadium.decorations
	local max = BuildService.MaxDecorations(player, data)
	if #list >= max then
		if not BuildService.IsPro(player) then
			return false, string.format("Has alcanzado el límite de %d decoraciones de tu etapa. Asciende el estadio o usa Constructor Pro.", max)
		end
		return false, string.format("Has alcanzado el límite de %d decoraciones.", max)
	end
	local ok, reason = PlacementRules.Validate({
		decorations = list, decoId = decoId, x = x, z = z, rotation = rotation, isPro = BuildService.IsPro(player),
	})
	if not ok then
		return false, reason
	end
	if data.economy.debt > GameConfig.DEBT_BUILD_LIMIT then
		return false, "Tu deuda es demasiado alta para construir. Págala primero."
	end
	local paid, payError = EconomyService.Spend(player, item.cost, EconomyService.Category.DECORATION, item.name)
	if not paid then
		return false, payError
	end
	table.insert(list, { id = decoId, x = x, z = z, r = rotation })
	return true, string.format("«%s» colocada.", item.name)
end

-- Comprueba que el índice enviado corresponde a la decoración esperada (evita estados obsoletos).
local function findDecoration(data, payload)
	if type(payload) ~= "table" then
		return nil
	end
	local index = tonumber(payload.index)
	if not index or index ~= math.floor(index) then
		return nil
	end
	local entry = data.stadium.decorations[index]
	if not entry or entry.id ~= payload.decoration then
		return nil
	end
	return index, entry
end

function BuildService.MoveDecoration(player, payload)
	local data = DataService.Get(player)
	local index, entry = findDecoration(data, payload)
	if not index then
		return false, "Esa decoración ya no está ahí. Vuelve a intentarlo."
	end
	local x, z, rotation = readPlacement(payload)
	if not x then
		return false, "Posición no válida."
	end
	local ok, reason = PlacementRules.Validate({
		decorations = data.stadium.decorations, decoId = entry.id, x = x, z = z, rotation = rotation,
		isPro = BuildService.IsPro(player), ignoreIndex = index,
	})
	if not ok then
		return false, reason
	end
	entry.x, entry.z, entry.r = x, z, rotation
	return true, "Decoración movida."
end

function BuildService.RemoveDecoration(player, payload)
	local data = DataService.Get(player)
	local index, entry = findDecoration(data, payload)
	if not index then
		return false, "Esa decoración ya no está ahí. Vuelve a intentarlo."
	end
	local item = CosmeticConfig.ById.decoration[entry.id]
	table.remove(data.stadium.decorations, index)
	local refund = math.floor((item and item.cost or 0) * CosmeticConfig.DECORATION_REFUND)
	EconomyService.Earn(player, refund, EconomyService.Category.REFUND, "Retirada: " .. (item and item.name or entry.id))
	return true, string.format("Decoración retirada (+%d %s).", refund, GameConfig.CURRENCY)
end

-- Qué decoraciones se muestran: dentro del límite actual y con su pase confirmado.
-- Devuelve una lista de booleanos alineada con data.stadium.decorations.
-- Las que no se muestran se conservan y reaparecen al recuperar el límite o la propiedad.
function BuildService.DecorationVisibility(player, data)
	local visible = {}
	local max = BuildService.MaxDecorations(player, data)
	local shown = 0
	for index, entry in ipairs(data.stadium.decorations) do
		local item = CosmeticConfig.ById.decoration[entry.id]
		local ok = item ~= nil and shown < max
			and (item.requiredPass == nil or GamePassService.Owns(player, item.requiredPass))
		if ok then
			shown += 1
		end
		visible[index] = ok
	end
	return visible
end

return BuildService
