-- ClubService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/ClubService
--
-- Identidad del club: nombre (filtrado por Roblox), abreviatura y apariencia
-- (escudo, colores, equipación, efectos y diseños de construcción).
-- Las opciones de pago se validan con GamePassService.Owns en el SERVIDOR.

local TextService = game:GetService("TextService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local GamePassConfig = require(Shared.Config.GamePassConfig)

local GamePassService = require(script.Parent.GamePassService)
local DataService = require(script.Parent.DataService)

local ClubService = {}

local function filterText(player, text)
	local ok, result = pcall(function()
		local filterResult = TextService:FilterStringAsync(text, player.UserId, Enum.TextFilterContext.PublicChat)
		return filterResult:GetNonChatStringForBroadcastAsync()
	end)
	if not ok then
		return nil
	end
	return result
end

local function cleanInput(text, maxLen)
	if type(text) ~= "string" then
		return nil
	end
	text = text:gsub("[%c]", ""):gsub("^%s+", ""):gsub("%s+$", ""):gsub("%s+", " ")
	if utf8.len(text) == nil then
		return nil
	end
	if utf8.len(text) > maxLen then
		return nil
	end
	return text
end

-- Devuelve ok, mensaje
function ClubService.SetName(player, name, shortName)
	local data = DataService.Get(player)
	name = cleanInput(name, GameConfig.CLUB_NAME_MAX)
	shortName = cleanInput(shortName, GameConfig.SHORT_NAME_LEN)
	if not name or utf8.len(name) < GameConfig.CLUB_NAME_MIN then
		return false, string.format("El nombre debe tener entre %d y %d caracteres.", GameConfig.CLUB_NAME_MIN, GameConfig.CLUB_NAME_MAX)
	end
	if not shortName or not shortName:match("^%w%w%w$") then
		return false, "La abreviatura debe tener exactamente 3 letras o números."
	end
	shortName = shortName:upper()

	local filteredName = filterText(player, name)
	local filteredShort = filterText(player, shortName)
	if not filteredName or not filteredShort then
		return false, "No se pudo verificar el nombre con el filtro de Roblox. Inténtalo de nuevo."
	end
	if filteredName ~= name or filteredShort ~= shortName then
		return false, "Ese nombre no está permitido. Prueba con otro."
	end
	data.club.name = filteredName
	data.club.shortName = filteredShort
	data.club.named = true
	return true, "Nombre del club actualizado."
end

local function catalogItem(slot, itemId)
	local rule = CosmeticConfig.AppearanceSlots[slot]
	if not rule then
		return nil
	end
	local item = CosmeticConfig.ById[rule.catalog][itemId]
	if not item then
		return nil
	end
	if rule.appliesTo and item.appliesTo ~= rule.appliesTo then
		return nil
	end
	return item
end

function ClubService.CanUse(player, item)
	return item.requiredPass == nil or GamePassService.Owns(player, item.requiredPass)
end

function ClubService.SetAppearance(player, slot, itemId)
	local data = DataService.Get(player)
	if type(slot) ~= "string" or type(itemId) ~= "string" then
		return false, "Solicitud no válida."
	end
	local item = catalogItem(slot, itemId)
	if not item then
		return false, "Esa opción no existe."
	end
	if not ClubService.CanUse(player, item) then
		local pass = GamePassConfig.Get(item.requiredPass)
		return false, string.format("Necesitas el pase %s para usar «%s».", pass and pass.name or "?", item.name)
	end
	data.club.appearance[slot] = itemId
	return true, string.format("«%s» aplicado.", item.name)
end

-- Apariencia que REALMENTE se muestra: si una opción guardada requiere un pase
-- cuya propiedad no está confirmada ahora mismo, se usa la opción gratuita por defecto.
-- La selección guardada no se borra: vuelve a mostrarse cuando Roblox confirme la propiedad.
function ClubService.EffectiveAppearance(player, data)
	local effective = {}
	for slot in pairs(CosmeticConfig.AppearanceSlots) do
		local item = catalogItem(slot, data.club.appearance[slot])
		if item and ClubService.CanUse(player, item) then
			effective[slot] = item.id
		else
			effective[slot] = CosmeticConfig.Defaults[slot]
		end
	end
	return effective
end

function ClubService.IsVip(player)
	return GamePassService.Owns(player, "VIP_CLUB")
end

function ClubService.DisplayName(data)
	if data.club.named and data.club.name ~= "" then
		return data.club.name
	end
	return "Club de " .. tostring(data.club.ownerName)
end

function ClubService.ShortName(data)
	if data.club.named and data.club.shortName ~= "" then
		return data.club.shortName
	end
	return "FEU"
end

return ClubService
