--!nonstrict
-- ShopService: compras en tiendas físicas y online.
--  * Física: hay que estar dentro de la tienda que vende el objeto. Entrega inmediata (mochila o casa).
--  * Online: carrito, cobro único por pedido, entrega simulada, cancelación con reembolso.
--  * Cada petición de compra lleva un "nonce": si se repite (doble clic, reintento) no se cobra dos veces.
--  * Los PC completos se entregan como un montaje real de piezas (se pueden desmontar).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Shop = {}
local S

Shop.StoreRadius = 45

function Shop.Init(services)
	S = services
end

local function rememberNonce(data, nonce, result)
	data.Processed[nonce] = result
	table.insert(data.ProcessedOrder, nonce)
	while #data.ProcessedOrder > 40 do
		local old = table.remove(data.ProcessedOrder, 1)
		data.Processed[old] = nil
	end
end

local function validNonce(nonce)
	return type(nonce) == "string" and #nonce >= 6 and #nonce <= 40
end

function Shop.storeNear(player)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	for _, sp in ipairs(S.World.Specials) do
		if sp.Type == "store" then
			local dx, dz = root.Position.X - sp.WX, root.Position.Z - sp.WZ
			if dx * dx + dz * dz <= Shop.StoreRadius * Shop.StoreRadius then
				return sp.StoreId
			end
		end
	end
	return nil
end

function Shop.priceOf(player, def)
	local mult = S.Events and S.Events.priceMultiplier and S.Events.priceMultiplier(def) or 1
	if S.Friend and S.Friend.discountFor then
		mult = mult * (1 - S.Friend.discountFor(player, def))
	end
	return math.floor(def.Price * mult + 0.5)
end

-- Entrega un objeto (o un PC completo como montaje de piezas). Devuelve texto de destino.
function Shop.deliver(player, def, opts)
	if def.Cat == "pc" then
		local rigId = S.Computer.createRigFromPrebuilt(player, def, opts)
		return rigId and "tu casa (montado)" or nil
	end
	local uid, loc = S.Inventory.add(player, def.Id, opts)
	if not uid then
		return nil
	end
	return loc == "backpack" and "tu mochila" or "tu casa"
end

local function units(def, qty)
	if def.Parts then
		local n = 0
		for _, v in pairs(def.Parts) do
			n = n + (type(v) == "table" and #v or 1)
		end
		return n * qty
	end
	return qty
end

local function storageError(player, n)
	if not S.Property.canStore(player, n) then
		return "Tu vivienda está llena (" .. S.Property.storedCount(player) .. "/" .. S.Property.storageCap(player) .. " objetos). Vende algo o consigue una propiedad con más almacenaje."
	end
	return nil
end

local function checkBuyable(player, def, qty)
	local data = S.Data.get(player)
	if not def or not Catalog.isForSale(def.Id) then
		return "Ese producto no está a la venta."
	end
	if data.Level < (def.Req.Level or 1) then
		return "Necesitas nivel " .. def.Req.Level .. " para comprar " .. def.Name .. "."
	end
	if qty < 1 or qty > 10 then
		return "Cantidad no válida (1-10)."
	end
	return nil
end

function Shop.afterPurchase(player, n, total)
	local data = S.Data.get(player)
	data.Counters.items_bought = (data.Counters.items_bought or 0) + n
	data.Counters.money_spent = (data.Counters.money_spent or 0) + total
	S.Progress.addXp(player, S.Progress.Xp.Purchase * math.min(n, 5))
	S.Quest.tutorialEvent(player, "buy_item")
	S.Quest.check(player)
end

-- Entregas pendientes de pedidos online
function Shop.processOrders(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local now = os.time()
	for _, order in ipairs(data.Orders) do
		if order.Status == "En camino" and now >= order.Eta then
			order.Status = "Entregado"
			order.DeliveredAt = now
			for _, line in ipairs(order.Items) do
				local def = Catalog.get(line.Id)
				for _ = 1, line.Qty do
					Shop.deliver(player, def, { src = "online", paid = line.Unit, loc = "home" })
				end
			end
			S.Net.notify(player, "📦 Pedido #" .. order.Num .. " entregado en tu casa.", "success")
			S.Data.markDirty(player)
		end
	end
end

function Shop.Start()
	local Net = S.Net

	-- Compra en tienda física
	Net.on("Shop.BuyInStore", function(player, p)
		local data = S.Data.get(player)
		if not validNonce(p.nonce) then
			return false, "Petición de compra no válida."
		end
		if data.Processed[p.nonce] then
			return true, "Compra ya registrada (no se ha cobrado dos veces).", data.Processed[p.nonce]
		end
		local def = Catalog.get(p.itemId)
		local qty = math.floor(tonumber(p.qty) or 1)
		local err = checkBuyable(player, def, qty)
		if err then
			return false, err
		end
		local storeId = Shop.storeNear(player)
		if not storeId then
			return false, "Tienes que estar dentro de una tienda. También puedes pedirlo online desde la app Tienda."
		end
		if not Util.indexOf(def.Stores, storeId) then
			return false, "Esta tienda no vende " .. def.Name .. "."
		end
		local serr = storageError(player, units(def, qty))
		if serr then
			return false, serr
		end
		local unit = Shop.priceOf(player, def)
		local total = unit * qty
		if not S.Economy.spend(player, total, "Compras", def.Name .. (qty > 1 and (" x" .. qty) or "")) then
			return false, "No tienes suficiente dinero ($" .. Util.formatInt(total) .. ")."
		end
		local where
		for _ = 1, qty do
			where = Shop.deliver(player, def, { src = "shop", paid = unit, loc = "backpack" })
		end
		local result = { itemId = def.Id, qty = qty, total = total }
		rememberNonce(data, p.nonce, result)
		Shop.afterPurchase(player, qty, total)
		return true, "Compraste " .. def.Name .. " por $" .. Util.formatInt(total) .. ". Está en " .. tostring(where) .. ".", result
	end)

	-- Pedido online (carrito)
	Net.on("Shop.Checkout", function(player, p)
		local data = S.Data.get(player)
		if not validNonce(p.nonce) then
			return false, "Petición de compra no válida."
		end
		if data.Processed[p.nonce] then
			return true, "Pedido ya registrado (no se ha cobrado dos veces).", data.Processed[p.nonce]
		end
		if data.Home.Missed >= 2 then
			return false, "Tienes alquileres pendientes. Págalos en la app Banco antes de hacer pedidos online."
		end
		if type(p.items) ~= "table" or #p.items == 0 or #p.items > 20 then
			return false, "El carrito está vacío o es demasiado grande."
		end
		local lines, total, count = {}, 0, 0
		for _, line in ipairs(p.items) do
			local def = Catalog.get(type(line) == "table" and line.id or nil)
			local qty = math.floor(tonumber(type(line) == "table" and line.qty or 0) or 0)
			local err = checkBuyable(player, def, qty)
			if err then
				return false, err
			end
			local unit = Shop.priceOf(player, def)
			lines[#lines + 1] = { Id = def.Id, Qty = qty, Unit = unit }
			total = total + unit * qty
			count = count + units(def, qty)
		end
		local serr = storageError(player, count)
		if serr then
			return false, serr
		end
		local shipping = total >= 500 and 0 or 15
		total = total + shipping
		if not S.Economy.spend(player, total, "Compras online", "Pedido online (" .. count .. " artículos)") then
			return false, "No tienes suficiente dinero ($" .. Util.formatInt(total) .. ")."
		end
		data.Counters.order_num = (data.Counters.order_num or 0) + 1
		local hours = Config.OnlineDeliveryHours
		local order = {
			Num = data.Counters.order_num,
			Items = lines,
			Total = total,
			Shipping = shipping,
			Status = "En camino",
			Placed = os.time(),
			Eta = os.time() + math.floor(hours * Config.DayLengthSeconds / 24),
		}
		table.insert(data.Orders, 1, order)
		while #data.Orders > 30 do
			table.remove(data.Orders)
		end
		local result = { num = order.Num, total = total }
		rememberNonce(data, p.nonce, result)
		Shop.afterPurchase(player, count, total)
		return true, "Pedido #" .. order.Num .. " confirmado ($" .. Util.formatInt(total) .. "). Llegará a tu casa en unos " .. math.floor(hours * Config.DayLengthSeconds / 24 / 60 + 0.5) .. " minutos.", result
	end)

	Net.on("Shop.CancelOrder", function(player, p)
		local data = S.Data.get(player)
		for _, order in ipairs(data.Orders) do
			if order.Num == tonumber(p.num) then
				if order.Status ~= "En camino" then
					return false, "Este pedido ya no se puede cancelar."
				end
				order.Status = "Cancelado"
				S.Economy.add(player, order.Total, "Reembolsos", "Cancelación del pedido #" .. order.Num, {})
				return true, "Pedido #" .. order.Num .. " cancelado. Reembolso: $" .. Util.formatInt(order.Total) .. "."
			end
		end
		return false, "Pedido no encontrado."
	end)

	Net.on("Shop.VisitStore", function(player, p)
		-- El cliente avisa al abrir el catálogo físico; el servidor comprueba la posición.
		local storeId = Shop.storeNear(player)
		if storeId then
			S.Travel.markStoreVisit(player, storeId)
		end
		return true
	end)

	task.spawn(function()
		while true do
			task.wait(5)
			for _, player in ipairs(game:GetService("Players"):GetPlayers()) do
				local ok, err = pcall(Shop.processOrders, player)
				if not ok then
					S.Net.logError("orders", err)
				end
			end
		end
	end)
end

return Shop
