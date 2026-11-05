--!nonstrict
-- MonetizationService: Game Passes y Developer Products con los IDs de MonetizationConfig.
-- Si un ID es 0 no se ofrece nada. ProcessReceipt es idempotente: guarda el PurchaseId en el perfil y
-- guarda el perfil ANTES de confirmar la compra a Roblox. Los créditos del juego nunca se mezclan con Robux.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MC = require(ReplicatedStorage.Shared.MonetizationConfig)
local Util = require(ReplicatedStorage.Shared.Util)

local Mon = {}
local S
local owned = {} -- [player] = { VIP = true, ... }

function Mon.Init(services)
	S = services
end

function Mon.has(player, key)
	return owned[player] ~= nil and owned[player][key] == true
end

function Mon.onPlayerReady(player)
	owned[player] = {}
	for _, gp in ipairs(MC.GamePasses) do
		if MC.isConfigured(gp) then
			local ok, has = pcall(function()
				return MarketplaceService:UserOwnsGamePassAsync(player.UserId, gp.Id)
			end)
			if ok and has then
				owned[player][gp.Key] = true
			end
		end
	end
end

function Mon.onLeave(player)
	owned[player] = nil
end

local function productByKeyId(id)
	for _, p in ipairs(MC.Products) do
		if MC.isConfigured(p) and p.Id == id then
			return p
		end
	end
	return nil
end

function Mon.processReceipt(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local data = S.Data.get(player)
	if not data then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local pid = tostring(info.PurchaseId)
	if data.Receipts[pid] then
		return Enum.ProductPurchaseDecision.PurchaseGranted -- ya entregado antes
	end
	local product = productByKeyId(info.ProductId)
	if not product then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local amount = math.max(product.Min, math.floor(S.Lab.incomePerSecond(player) * 60 * product.Minutes))
	data.Credits = data.Credits + amount
	data.Receipts[pid] = os.time()
	if not S.Data.save(player, false) then
		-- deshacer y reintentar más tarde: Roblox volverá a llamar
		data.Credits = data.Credits - amount
		data.Receipts[pid] = nil
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	S.Net.notify(player, "🎁 +" .. Util.short(amount) .. " créditos. ¡Gracias por tu apoyo!", "gold")
	S.Data.markDirty(player)
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

function Mon.view(player)
	local passes, products = {}, {}
	for _, gp in ipairs(MC.GamePasses) do
		passes[#passes + 1] = { Key = gp.Key, Name = gp.Name, Desc = gp.Desc, Configured = MC.isConfigured(gp), Owned = Mon.has(player, gp.Key) }
	end
	for _, p in ipairs(MC.Products) do
		products[#products + 1] = { Key = p.Key, Name = p.Name, Minutes = p.Minutes, Min = p.Min, Configured = MC.isConfigured(p) }
	end
	return { Passes = passes, Products = products }
end

function Mon.Start()
	MarketplaceService.ProcessReceipt = Mon.processReceipt
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		for _, gp in ipairs(MC.GamePasses) do
			if gp.Id == passId and MC.isConfigured(gp) then
				owned[player] = owned[player] or {}
				owned[player][gp.Key] = true
				S.Net.notify(player, "⭐ ¡" .. gp.Name .. " activado!", "gold")
				S.Data.markDirty(player)
			end
		end
	end)
	-- el cliente pide comprar: solo se acepta si el ID está configurado (el cliente no decide nada más)
	S.Net.on("Shop.Prompt", function(player, p)
		local key = tostring(p.key)
		for _, gp in ipairs(MC.GamePasses) do
			if gp.Key == key then
				if not MC.isConfigured(gp) then
					return false, "Este pase aún no está disponible."
				end
				MarketplaceService:PromptGamePassPurchase(player, gp.Id)
				return true, "Abriendo la compra..."
			end
		end
		for _, pr in ipairs(MC.Products) do
			if pr.Key == key then
				if not MC.isConfigured(pr) then
					return false, "Este paquete aún no está disponible."
				end
				MarketplaceService:PromptProductPurchase(player, pr.Id)
				return true, "Abriendo la compra..."
			end
		end
		return false, "Producto desconocido."
	end)
end

return Mon
