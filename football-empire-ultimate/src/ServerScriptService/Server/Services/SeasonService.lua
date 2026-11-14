-- SeasonService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/SeasonService
--
-- PASE DE TEMPORADA.
--   * Los puntos los concede SOLO el servidor a partir de lo que haces de verdad (partidos,
--     misiones, huevos, jornadas, conexión diaria).
--   * Reclamar: el servidor comprueba el nivel, que no esté ya reclamado y, en la pista premium,
--     que tengas el premium de ESTA temporada.
--   * PREMIUM: se vende con un Developer Product. Solo se activa cuando Roblox entrega el recibo
--     de compra (ProcessReceipt) y los datos se han guardado. Nunca se simula una compra, y si el
--     ID del producto es 0 («pendiente de configuración») la compra está desactivada.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local SeasonConfig = require(Shared.Config.SeasonConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PetService = require(script.Parent.PetService)

local SeasonService = {}

local notifyRemote = Remotes.Get("Notify")
local MAX_XP = SeasonConfig.TIERS * SeasonConfig.XP_PER_TIER
local priceCache = nil -- { time, price }
local changedCallbacks = {}

local function configured()
	return type(SeasonConfig.PREMIUM_PRODUCT_ID) == "number" and SeasonConfig.PREMIUM_PRODUCT_ID > 0
end

-- Si ha empezado una temporada nueva, el progreso empieza de cero (el premium va por temporada).
local function ensureSeason(data)
	local current = SeasonConfig.Current()
	local pass = data.pass
	if pass.season ~= current.number then
		pass.season = current.number
		pass.xp = 0
		pass.claimedFree = {}
		pass.claimedPremium = {}
	end
	return current, pass
end

local function isPremium(pass, current)
	return pass.premiumSeason == current.number
end

local function fireChanged(player)
	for _, callback in ipairs(changedCallbacks) do
		task.spawn(callback, player)
	end
end

-- Avisa cuando el pase cambia fuera de una acción (compra premium confirmada, subida de nivel).
function SeasonService.OnChanged(callback)
	table.insert(changedCallbacks, callback)
end

-- ===== Puntos =====

function SeasonService.AddXP(player, amount)
	local data = DataService.Get(player)
	if not data or type(amount) ~= "number" or amount <= 0 then
		return
	end
	local _, pass = ensureSeason(data)
	local multiplier = WeeklyConfig.ActiveBonus().xpMultiplier or 1
	local before = SeasonConfig.Level(pass.xp)
	pass.xp = math.min(MAX_XP, pass.xp + math.floor(amount * multiplier + 0.5))
	local after = SeasonConfig.Level(pass.xp)
	if after > before then
		notifyRemote:FireClient(player, "success", string.format("🎟️ ¡Nivel %d del pase de temporada! Tienes recompensas por reclamar.", after))
	end
end

-- Puntos por la primera conexión de cada día (UTC).
function SeasonService.DailyLogin(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local _, pass = ensureSeason(data)
	local today = math.floor(os.time() / 86400)
	if pass.lastLoginDay ~= today then
		pass.lastLoginDay = today
		SeasonService.AddXP(player, SeasonConfig.XP.dailyLogin)
	end
end

-- ===== Recompensas =====

local function grant(player, data, reward)
	if reward.type == "money" then
		EconomyService.Earn(player, reward.amount, EconomyService.Category.PRIZE, "Pase de temporada")
		return string.format("💰 +%d $", reward.amount)
	elseif reward.type == "egg" then
		return PetService.GrantEgg(player, reward.egg) or "🥚 Huevo"
	elseif reward.type == "crate" then
		return PetService.GrantBall(player, reward.crate) or "📦 Ya tienes todos los balones de las cajas"
	elseif reward.type == "ball" then
		data.collection.balls[reward.id] = true
		return SeasonConfig.Describe(reward)
	elseif reward.type == "outfit" then
		data.collection.outfits[reward.id] = true
		return SeasonConfig.Describe(reward)
	end
	return "?"
end

-- Reclama una recompensa si procede. Devuelve el texto de lo conseguido o nil + motivo.
local function claimOne(player, data, current, pass, tier, track)
	local rewards = SeasonConfig.Rewards(current.number)[tier]
	local reward = rewards and rewards[track]
	if not reward then
		return nil, "Esa recompensa no existe."
	end
	if tier > SeasonConfig.Level(pass.xp) then
		return nil, string.format("Todavía no has llegado al nivel %d del pase.", tier)
	end
	local claimed = track == "premium" and pass.claimedPremium or pass.claimedFree
	local key = tostring(tier)
	if claimed[key] then
		return nil, "Ya has reclamado esa recompensa."
	end
	if track == "premium" and not isPremium(pass, current) then
		return nil, "Esa recompensa es de la pista premium de esta temporada."
	end
	claimed[key] = true
	return grant(player, data, reward)
end

function SeasonService.Claim(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local tier = tonumber(payload.tier)
	if not tier or tier ~= math.floor(tier) or tier < 1 or tier > SeasonConfig.TIERS then
		return false, "Nivel no válido."
	end
	local track = payload.track == "premium" and "premium" or "free"
	local current, pass = ensureSeason(data)
	local text, reason = claimOne(player, data, current, pass, tier, track)
	if not text then
		return false, reason
	end
	return true, string.format("🎟️ Nivel %d: %s", tier, text)
end

function SeasonService.ClaimAll(player)
	local data = DataService.Get(player)
	local current, pass = ensureSeason(data)
	local count = 0
	for tier = 1, SeasonConfig.Level(pass.xp) do
		for _, track in ipairs({ "free", "premium" }) do
			if claimOne(player, data, current, pass, tier, track) then
				count += 1
			end
		end
	end
	if count == 0 then
		return false, "No tienes recompensas del pase por reclamar."
	end
	return true, string.format("🎟️ Has reclamado %d recompensa%s del pase. Mira tus mascotas, balones y trajes.", count, count == 1 and "" or "s")
end

-- ===== Premium (Developer Product) =====

local function price()
	if not configured() then
		return nil
	end
	if priceCache and os.clock() - priceCache.time < 300 then
		return priceCache.price
	end
	local ok, info = pcall(function()
		return MarketplaceService:GetProductInfo(SeasonConfig.PREMIUM_PRODUCT_ID, Enum.InfoType.Product)
	end)
	priceCache = { time = os.clock(), price = ok and type(info) == "table" and info.PriceInRobux or nil }
	return priceCache.price
end

function SeasonService.RequestPremium(player)
	local data = DataService.Get(player)
	if not configured() then
		return false, "El premium del pase está pendiente de configuración: todavía no tiene un producto de Roblox."
	end
	local current, pass = ensureSeason(data)
	if isPremium(pass, current) then
		return false, "Ya tienes el premium de esta temporada."
	end
	local ok, err = pcall(function()
		MarketplaceService:PromptProductPurchase(player, SeasonConfig.PREMIUM_PRODUCT_ID)
	end)
	if not ok then
		warn("[SeasonService] PromptProductPurchase falló: ", err)
		return false, "Roblox no pudo abrir la ventana de compra. Inténtalo más tarde."
	end
	return true, "Abriendo la compra de Roblox…"
end

-- Roblox llama a esta función cuando una compra se ha pagado de verdad.
local function processReceipt(receipt)
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	local data = player and DataService.Get(player)
	if not data then
		return Enum.ProductPurchaseDecision.NotProcessedYet -- se reintentará cuando el jugador vuelva
	end
	if not configured() or receipt.ProductId ~= SeasonConfig.PREMIUM_PRODUCT_ID then
		return Enum.ProductPurchaseDecision.NotProcessedYet -- producto desconocido: no se da por entregado
	end
	local current, pass = ensureSeason(data)
	local receiptId = tostring(receipt.PurchaseId)
	if not pass.receipts[receiptId] then
		pass.receipts[receiptId] = os.time()
		pass.premiumSeason = current.number
		notifyRemote:FireClient(player, "success", string.format("¡Compra confirmada! 💎 Pista premium de la %s activada.", current.theme.name))
		fireChanged(player)
	end
	-- Solo se da por entregada cuando el progreso está guardado
	if not DataService.IsSaveEnabled(player) or not DataService.Save(player, false) then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- ===== Estado =====

function SeasonService.BuildState(data)
	local current, pass = ensureSeason(data)
	local free, premium = {}, {}
	for tier = 1, SeasonConfig.TIERS do
		free[tier] = pass.claimedFree[tostring(tier)] == true
		premium[tier] = pass.claimedPremium[tostring(tier)] == true
	end
	return {
		number = current.number,
		themeId = current.theme.id,
		name = current.theme.name,
		icon = current.theme.icon,
		endsAt = current.endsAt,
		xp = pass.xp,
		level = SeasonConfig.Level(pass.xp),
		premium = isPremium(pass, current),
		productConfigured = configured(),
		price = price(),
		claimedFree = free,
		claimedPremium = premium,
	}
end

function SeasonService.Start()
	MarketplaceService.ProcessReceipt = processReceipt
end

return SeasonService
