--!nonstrict
-- MonetizationService: Game Passes (UserOwnsGamePassAsync) y Developer Products (ProcessReceipt).
--  * Los IDs vienen de ReplicatedStorage.Shared.MonetizationConfig (0 = no configurado).
--  * ProcessReceipt es idempotente: cada PurchaseId se registra en el perfil y nunca se entrega dos veces.
--  * Solo devuelve PurchaseGranted cuando la entrega quedó guardada; si el guardado falla, Roblox reintentará
--    y el registro evitará la entrega duplicada.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MonetizationConfig = require(ReplicatedStorage.Shared.MonetizationConfig)

local Monetization = {}
local S
local owned = {} -- [player] = { [key] = true }

function Monetization.Init(services)
	S = services
end

function Monetization.owns(player, key)
	return owned[player] ~= nil and owned[player][key] == true
end

function Monetization.ownedList(player)
	local list = {}
	for k in pairs(owned[player] or {}) do
		list[#list + 1] = k
	end
	return list
end

-- Suma de una ventaja numérica entre todos los pases que posee el jugador.
function Monetization.perk(player, perkName)
	local total = 0
	for key, pass in pairs(MonetizationConfig.GamePasses) do
		if Monetization.owns(player, key) then
			local v = pass.Perks[perkName]
			if type(v) == "number" then
				total = total + v
			elseif v == true then
				total = total + 1
			end
		end
	end
	return total
end

local function refresh(player)
	owned[player] = owned[player] or {}
	for key, pass in pairs(MonetizationConfig.GamePasses) do
		if MonetizationConfig.isConfigured(pass) then
			local ok, has = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, pass.Id)
			if ok and has then
				owned[player][key] = true
			end
		end
	end
end

function Monetization.onPlayerReady(player)
	refresh(player)
end

local function productById(id)
	for key, prod in pairs(MonetizationConfig.Products) do
		if MonetizationConfig.isConfigured(prod) and prod.Id == id then
			return key, prod
		end
	end
	return nil
end

local function processReceipt(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local data = S.Data.get(player)
	if not data then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local purchaseId = tostring(info.PurchaseId)
	if data.Receipts[purchaseId] then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	local key, prod = productById(info.ProductId)
	if not prod then
		S.Net.logError("receipt", "Producto desconocido " .. tostring(info.ProductId))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	-- Entrega
	if prod.Grant.Money then
		S.Economy.add(player, prod.Grant.Money, "Tienda Robux", prod.Name, {})
	end
	if prod.Grant.ExportTokens then
		data.ExportTokens = data.ExportTokens + prod.Grant.ExportTokens
	end
	data.Receipts[purchaseId] = os.time()
	table.insert(data.ReceiptOrder, purchaseId)
	while #data.ReceiptOrder > 200 do
		data.Receipts[table.remove(data.ReceiptOrder, 1)] = nil
	end
	S.Net.notify(player, "¡Gracias por tu compra! Recibiste: " .. prod.Name, "success")
	S.Data.markDirty(player)
	if not S.Data.save(player, false) then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

function Monetization.Start()
	MarketplaceService.ProcessReceipt = processReceipt

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		for key, pass in pairs(MonetizationConfig.GamePasses) do
			if pass.Id == passId and MonetizationConfig.isConfigured(pass) then
				owned[player] = owned[player] or {}
				owned[player][key] = true
				S.Net.notify(player, "Game Pass activado: " .. pass.Name, "success")
				S.Avatar.refreshOverhead(player)
				S.Data.markDirty(player)
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		owned[player] = nil
	end)

	S.Net.on("Shop.PassInfo", function(player)
		local list = {}
		for key, pass in pairs(MonetizationConfig.GamePasses) do
			list[#list + 1] = { Key = key, Name = pass.Name, Desc = pass.Description, Id = pass.Id, Configured = MonetizationConfig.isConfigured(pass), Owned = Monetization.owns(player, key) }
		end
		local prods = {}
		for key, prod in pairs(MonetizationConfig.Products) do
			prods[#prods + 1] = { Key = key, Name = prod.Name, Id = prod.Id, Configured = MonetizationConfig.isConfigured(prod) }
		end
		table.sort(list, function(a, b)
			return a.Name < b.Name
		end)
		table.sort(prods, function(a, b)
			return a.Name < b.Name
		end)
		return true, nil, { passes = list, products = prods }
	end)
end

return Monetization
