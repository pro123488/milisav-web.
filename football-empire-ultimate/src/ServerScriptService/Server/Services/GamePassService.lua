-- GamePassService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/GamePassService
--
-- Integración REAL con MarketplaceService:
--   * UserOwnsGamePassAsync   -> comprobación de propiedad (con reintentos y caché en memoria)
--   * GetProductInfo          -> nombre/precio reales del pase cuando exista
--   * PromptGamePassPurchase  -> lo lanza el SERVIDOR con el ID del módulo de configuración
--   * PromptGamePassPurchaseFinished -> confirmación de compra emitida por Roblox en el servidor
--
-- Reglas de seguridad:
--   * La propiedad NUNCA se lee de los datos guardados ni del cliente.
--   * Solo el estado "owned" concede ventajas. "error", "checking" o "pending_config" no.
--   * Si Roblox no responde, el juego sigue funcionando y se reintenta en segundo plano.
--   * No existe ninguna ruta de código que marque un pase como comprado sin confirmación de Roblox.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local GamePassConfig = require(Shared.Config.GamePassConfig)
local Remotes = require(Shared.Modules.Remotes)
local Retry = require(script.Parent.Parent.Util.Retry)

local GamePassService = {}

-- Estados posibles de un pase para un jugador:
GamePassService.Status = {
	PENDING_CONFIG = "pending_config", -- ID = 0: aún no creado en el Creator Dashboard
	INACTIVE = "inactive", -- pase de una fase futura
	CHECKING = "checking", -- consultando a Roblox
	OWNED = "owned", -- propiedad confirmada por Roblox
	NOT_OWNED = "not_owned", -- Roblox confirma que no lo tiene
	ERROR = "error", -- Roblox no respondió; se reintenta
}
local S = GamePassService.Status

local ownership = {} -- [player] = { [passKey] = status }
local priceCache = {} -- [passKey] = { time, ok, price, forSale, name }
local changedCallbacks = {}
local promptOpen = {} -- [player] = passKey

local shopRemote = Remotes.Get("Shop")
local notifyRemote = Remotes.Get("Notify")

local function fireChanged(player, passKey)
	for _, callback in ipairs(changedCallbacks) do
		task.spawn(callback, player, passKey)
	end
end

local function getPrice(passKey)
	local def = GamePassConfig.Get(passKey)
	if not def or not GamePassConfig.IsConfigured(passKey) then
		return nil
	end
	local cached = priceCache[passKey]
	if cached and os.clock() - cached.time < GameConfig.PRICE_CACHE_SECONDS then
		return cached
	end
	local ok, info = Retry.Call(2, 1, function()
		return MarketplaceService:GetProductInfo(def.id, Enum.InfoType.GamePass)
	end)
	local entry = { time = os.clock(), ok = ok }
	if ok and type(info) == "table" then
		entry.price = info.PriceInRobux
		entry.forSale = info.IsForSale == true and info.PriceInRobux ~= nil
		entry.name = info.Name
	else
		warn("[GamePassService] No se pudo obtener el precio de ", passKey, ": ", info)
		-- caché corta para reintentar pronto
		entry.time = os.clock() - GameConfig.PRICE_CACHE_SECONDS + 30
	end
	priceCache[passKey] = entry
	return entry
end

-- Construye el estado de la Tienda Premium para un jugador (solo datos públicos de su propia sesión).
function GamePassService.BuildShopState(player)
	local list = {}
	local states = ownership[player] or {}
	for _, passKey in ipairs(GamePassConfig.Order) do
		local def = GamePassConfig.Get(passKey)
		if def then
			local price = def.active and getPrice(passKey) or nil
			table.insert(list, {
				key = passKey,
				name = def.name,
				icon = def.icon,
				iconImage = def.iconImage,
				accent = def.accent,
				description = def.description,
				benefits = def.benefits,
				active = def.active,
				phase = def.phase,
				configured = GamePassConfig.IsConfigured(passKey),
				status = states[passKey] or (def.active and S.PENDING_CONFIG or S.INACTIVE),
				priceKnown = price ~= nil and price.ok == true,
				price = price and price.price or nil,
				forSale = price ~= nil and price.forSale == true,
			})
		end
	end
	return list
end

function GamePassService.PushShop(player)
	if player.Parent then
		shopRemote:FireClient(player, GamePassService.BuildShopState(player))
	end
end

local function setStatus(player, passKey, status)
	local states = ownership[player]
	if not states then
		return
	end
	local previous = states[passKey]
	states[passKey] = status
	if previous ~= status then
		GamePassService.PushShop(player)
		fireChanged(player, passKey)
	end
end

local function checkOwnership(player, passKey)
	local def = GamePassConfig.Get(passKey)
	if not def.active then
		setStatus(player, passKey, S.INACTIVE)
		return
	end
	if not GamePassConfig.IsConfigured(passKey) then
		setStatus(player, passKey, S.PENDING_CONFIG)
		return
	end
	-- Si ya está confirmado, no se vuelve a consultar.
	if ownership[player] and ownership[player][passKey] == S.OWNED then
		return
	end
	setStatus(player, passKey, S.CHECKING)
	local ok, owns = Retry.Call(GameConfig.OWNERSHIP_RETRY_ATTEMPTS, 1, function()
		return MarketplaceService:UserOwnsGamePassAsync(player.UserId, def.id)
	end)
	if not player.Parent or not ownership[player] then
		return
	end
	if ok then
		setStatus(player, passKey, owns and S.OWNED or S.NOT_OWNED)
	else
		warn("[GamePassService] Roblox no respondió al comprobar ", passKey, " de ", player.Name, ": ", owns)
		setStatus(player, passKey, S.ERROR)
		-- Reintento en segundo plano sin bloquear el juego.
		task.delay(GameConfig.OWNERSHIP_RECHECK_SECONDS, function()
			if player.Parent and ownership[player] and ownership[player][passKey] == S.ERROR then
				checkOwnership(player, passKey)
			end
		end)
	end
end

-- ===== API pública =====

-- La ÚNICA función que debe usarse para decidir si se concede una ventaja de pago.
function GamePassService.Owns(player, passKey)
	local states = ownership[player]
	return states ~= nil and states[passKey] == S.OWNED
end

function GamePassService.GetStatus(player, passKey)
	local states = ownership[player]
	return states and states[passKey] or S.PENDING_CONFIG
end

-- Lista de claves de pases confirmados (para el estado que se envía al cliente).
function GamePassService.OwnedList(player)
	local result = {}
	for passKey, status in pairs(ownership[player] or {}) do
		if status == S.OWNED then
			result[passKey] = true
		end
	end
	return result
end

function GamePassService.OnOwnershipChanged(callback)
	table.insert(changedCallbacks, callback)
end

function GamePassService.PlayerAdded(player)
	ownership[player] = {}
	for _, passKey in ipairs(GamePassConfig.Order) do
		task.spawn(checkOwnership, player, passKey)
	end
	task.spawn(GamePassService.PushShop, player)
end

function GamePassService.PlayerRemoving(player)
	ownership[player] = nil
	promptOpen[player] = nil
end

-- Solicitud de compra enviada por el cliente. Devuelve ok, mensaje.
function GamePassService.RequestPurchase(player, passKey)
	if type(passKey) ~= "string" then
		return false, "Solicitud no válida."
	end
	local def = GamePassConfig.Get(passKey)
	if not def then
		return false, "Ese pase no existe."
	end
	if not def.active then
		return false, string.format("%s llegará en una fase posterior.", def.name)
	end
	if not GamePassConfig.IsConfigured(passKey) then
		return false, string.format("%s está pendiente de configuración: todavía no tiene un ID de Game Pass.", def.name)
	end
	local status = GamePassService.GetStatus(player, passKey)
	if status == S.OWNED then
		return false, "Ya tienes este pase."
	end
	if status == S.CHECKING then
		return false, "Estamos comprobando tus pases con Roblox. Inténtalo en unos segundos."
	end
	local price = getPrice(passKey)
	if price and price.ok and not price.forSale then
		return false, "Este pase no está a la venta en este momento."
	end
	if promptOpen[player] then
		return false, "Ya tienes una ventana de compra abierta."
	end
	local ok, err = pcall(function()
		MarketplaceService:PromptGamePassPurchase(player, def.id)
	end)
	if not ok then
		warn("[GamePassService] PromptGamePassPurchase falló: ", err)
		return false, "Roblox no pudo abrir la ventana de compra. Inténtalo más tarde."
	end
	promptOpen[player] = passKey
	-- Salvaguarda por si Roblox nunca llega a emitir el evento de cierre.
	task.delay(120, function()
		if promptOpen[player] == passKey then
			promptOpen[player] = nil
		end
	end)
	return true, "Abriendo la compra de Roblox…"
end

function GamePassService.Start()
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, gamePassId, wasPurchased)
		promptOpen[player] = nil
		local passKey = GamePassConfig.GetKeyById(gamePassId)
		if not passKey or not ownership[player] then
			return
		end
		local def = GamePassConfig.Get(passKey)
		if wasPurchased then
			-- Confirmación emitida por Roblox en el servidor: el cliente no puede falsificarla.
			setStatus(player, passKey, S.OWNED)
			notifyRemote:FireClient(player, "success", string.format("¡Compra confirmada! %s %s activado.", def.icon, def.name))
			for _, callback in ipairs(GamePassService._purchaseCallbacks) do
				task.spawn(callback, player, passKey)
			end
		else
			notifyRemote:FireClient(player, "info", "Compra cancelada. No se ha realizado ningún cargo.")
			-- Por si el jugador ya lo tenía, volvemos a comprobar.
			task.spawn(checkOwnership, player, passKey)
		end
	end)
end

GamePassService._purchaseCallbacks = {}
function GamePassService.OnPurchaseConfirmed(callback)
	table.insert(GamePassService._purchaseCallbacks, callback)
end

return GamePassService
