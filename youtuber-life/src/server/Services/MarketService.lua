--!nonstrict
-- MarketService: tienda de segunda mano «Rastro & Retro» (Zona de tiendas de segunda mano).
--  * Stock diario determinista (MarketData.stock): 12-15 artículos usados con condición 35-90%.
--    Precio = Price × (0,3 + 0,5 × condición) × descuento del evento de segunda mano (si lo hay).
--  * Cada unidad se vende una sola vez por jugador y día (data.UsedBought).
--  * Comprar, vender al rastro (70% × condición del precio pagado) y reparar con descuento exigen estar en la tienda.
--  * Coleccionables: objetos ocultos que solo aparecen a veces; los distintos conseguidos se guardan en Visited.Collectibles.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Catalog = require(Shared.ItemCatalog)
local MarketData = require(Shared.MarketData)
local Util = require(Shared.Util)

local Market = {}
local S

function Market.Init(services)
	S = services
end

function Market.discount()
	local d = S.Events and S.Events.usedDiscount and S.Events.usedDiscount() or 0
	if type(d) ~= "number" or d <= 0 then
		return 0
	end
	return Util.clamp(d, 0, 0.9)
end

function Market.stock()
	return MarketData.stock(S.Time.day())
end

function Market.findUnit(key)
	if type(key) ~= "string" then
		return nil
	end
	for _, u in ipairs(Market.stock()) do
		if u.Key == key then
			return u
		end
	end
	return nil
end

-- Registro de unidades compradas hoy por el jugador (se reinicia cada día)
local function boughtToday(data)
	local day = S.Time.day()
	local b = data.UsedBought
	if type(b) ~= "table" or b.Day ~= day then
		b = { Day = day, Units = {} }
		data.UsedBought = b
	end
	if type(b.Units) ~= "table" then
		b.Units = {}
	end
	return b
end

function Market.inStore(player)
	return S.World.nearSpecial(player, "usedstore", MarketData.StoreRadius) ~= nil
end

function Market.unitInfo(player, u)
	local data = S.Data.get(player)
	local def = Catalog.get(u.Id)
	local price = MarketData.usedPrice(def, u.Cond, Market.discount())
	local newPrice = (not def.Collectible) and S.Shop.priceOf(player, def) or nil
	local b = data and data.UsedBought
	return {
		Key = u.Key,
		Id = u.Id,
		Name = def.Name,
		Cat = def.Cat,
		Cond = u.Cond,
		CondText = MarketData.condText(u.Cond),
		Price = price,
		NewPrice = newPrice,
		Saving = newPrice and math.max(0, newPrice - price) or nil,
		Collectible = def.Collectible == true,
		Level = def.Req and def.Req.Level or 1,
		Sold = type(b) == "table" and b.Day == S.Time.day() and type(b.Units) == "table" and b.Units[u.Key] == true or false,
	}
end

-- Registra un coleccionable distinto (compra o intercambio). Devuelve true si es nuevo.
function Market.registerCollectible(player, itemId)
	local def = Catalog.get(itemId)
	local data = S.Data.get(player)
	if not def or not def.Collectible or not data then
		return false
	end
	data.Visited.Collectibles = data.Visited.Collectibles or {}
	if data.Visited.Collectibles[itemId] then
		return false
	end
	data.Visited.Collectibles[itemId] = true
	S.Net.notify(player, "⭐ ¡Nuevo coleccionable para tu colección! " .. def.Name .. " (" .. Util.count(data.Visited.Collectibles) .. "/" .. #MarketData.collectibles() .. ")", "gold")
	S.Quest.check(player)
	S.Data.markDirty(player)
	return true
end

-- Motivo por el que un objeto no puede salir de tu inventario (venta en el rastro o intercambio). nil = se puede.
-- opts.leaving: conjunto de uids que también salen a la vez (para no quedarte sin teléfono).
function Market.lockReason(player, uid, opts)
	local data = S.Data.get(player)
	local rec = data and type(uid) == "string" and data.Inventory[uid]
	if not rec then
		return "No tienes ese objeto."
	end
	local def = Catalog.get(rec.Id)
	if not def then
		return "Objeto desconocido."
	end
	local loc = rec.Loc or "home"
	if loc:sub(1, 4) == "rig:" then
		return def.Name .. " está instalado en un computador. Desmóntalo primero en el Montador de PC."
	end
	if loc:sub(1, 5) == "prop:" then
		return def.Name .. " está colocado en una propiedad. Recógelo primero con el modo construcción."
	end
	if rec.Loan then
		return def.Name .. " es equipo prestado por un patrocinador: se devuelve al terminar el contrato."
	end
	if def.Slot == "bag" and loc == "backpack" then
		return "Saca " .. def.Name .. " de la mochila primero."
	end
	if def.Slot == "phone" then
		local leaving = opts and opts.leaving or {}
		local left = 0
		for u, r in pairs(data.Inventory) do
			if u ~= uid and not leaving[u] and not r.Loan then
				local d = Catalog.get(r.Id)
				if d and d.Slot == "phone" then
					left = left + 1
				end
			end
		end
		if left < 1 then
			return "No puedes quedarte sin teléfono: es tu único teléfono propio."
		end
	end
	return nil
end

local function tradeLocked(player, uid)
	return S.Trade and S.Trade.isOffered and S.Trade.isOffered(player, uid)
end

function Market.Start()
	local Net = S.Net

	Net.on("Market.Stock", function(player)
		local units = {}
		for i, u in ipairs(Market.stock()) do
			units[i] = Market.unitInfo(player, u)
		end
		return true, nil, { day = S.Time.day(), discount = Market.discount(), inStore = Market.inStore(player), units = units }
	end)

	Net.on("Market.Inspect", function(player, p)
		local u = Market.findUnit(p.key)
		if not u then
			return false, "Ese artículo ya no está en el stock de hoy."
		end
		local info = Market.unitInfo(player, u)
		local def = Catalog.get(u.Id)
		info.Note = MarketData.wearNote(u.Cond)
		info.Performance = MarketData.performance(u.Cond)
		info.RepairCost = MarketData.repairCost(def, u.Cond)
		info.Desc = def.Desc
		local msg = def.Name .. ": condición " .. u.Cond .. "% (" .. info.CondText .. ") · $" .. Util.formatInt(info.Price)
		if info.NewPrice then
			msg = msg .. " (nuevo $" .. Util.formatInt(info.NewPrice) .. ", ahorras $" .. Util.formatInt(info.Saving) .. ")"
		else
			msg = msg .. " · ⭐ pieza de colección"
		end
		return true, msg, info
	end)

	Net.on("Market.Buy", function(player, p)
		local data = S.Data.get(player)
		local u = Market.findUnit(p.key)
		if not u then
			return false, "Ese artículo ya no está en el stock de hoy."
		end
		local b = boughtToday(data)
		if b.Units[u.Key] then
			return false, "Ya compraste esta unidad hoy: cada artículo usado se vende una sola vez."
		end
		if not Market.inStore(player) then
			return false, "Tienes que estar en Rastro & Retro (Zona de tiendas de segunda mano) para comprar."
		end
		local def = Catalog.get(u.Id)
		local lvl = def.Req and def.Req.Level or 1
		if data.Level < lvl then
			return false, "Necesitas nivel " .. lvl .. " para usar " .. def.Name .. "."
		end
		if Util.count(data.Inventory) >= S.Inventory.MaxItems then
			return false, "Tu inventario está lleno (" .. S.Inventory.MaxItems .. " objetos). Vende algo primero."
		end
		local toBackpack = def.Portable and S.Inventory.canFit(player, def)
		if not toBackpack and not S.Property.canStore(player, 1) then
			return false, "Tu vivienda está llena (" .. S.Property.storedCount(player) .. "/" .. S.Property.storageCap(player) .. " objetos). Vende algo o consigue más almacenaje."
		end
		local price = MarketData.usedPrice(def, u.Cond, Market.discount())
		if not S.Economy.spend(player, price, "Compras", "Segunda mano: " .. def.Name) then
			return false, "No tienes suficiente dinero ($" .. Util.formatInt(price) .. ")."
		end
		local uid, loc = S.Inventory.add(player, def.Id, { src = "used", paid = price, cond = u.Cond, loc = "backpack" })
		if not uid then
			S.Economy.add(player, price, "Reembolsos", "Compra de segunda mano anulada", { silent = true })
			return false, tostring(loc or "No se pudo entregar el artículo.")
		end
		b.Units[u.Key] = true
		data.Counters.used_bought = (data.Counters.used_bought or 0) + 1
		S.Shop.afterPurchase(player, 1, price)
		if def.Collectible then
			Market.registerCollectible(player, def.Id)
		end
		local saving = (not def.Collectible) and math.max(0, S.Shop.priceOf(player, def) - price) or 0
		return true, "Compraste " .. def.Name .. " usado (" .. u.Cond .. "%) por $" .. Util.formatInt(price)
			.. (saving > 0 and (" · ahorraste $" .. Util.formatInt(saving)) or "") .. ". Está en " .. (loc == "backpack" and "tu mochila" or "tu casa") .. ".",
			{ uid = uid, price = price, cond = u.Cond }
	end)

	Net.on("Market.Sell", function(player, p)
		local data = S.Data.get(player)
		if not Market.inStore(player) then
			return false, "Para vender al rastro tienes que estar en Rastro & Retro. (Desde el inventario puedes vender online, pero pagan menos)."
		end
		local err = Market.lockReason(player, p.uid)
		if err then
			return false, err
		end
		if tradeLocked(player, p.uid) then
			return false, "Está en tu oferta de intercambio: quítalo de la oferta antes de venderlo."
		end
		local rec = data.Inventory[p.uid]
		local def = Catalog.get(rec.Id)
		if def.Cat == "food" then
			return false, "En el rastro no compramos comida."
		end
		local value = MarketData.sellValue(rec, def)
		if value < 1 then
			return false, "Nadie pagaría nada por " .. def.Name .. "."
		end
		local online = S.Inventory.sellValue(rec, def)
		S.Inventory.remove(player, p.uid)
		S.Economy.add(player, value, "Ventas", "Venta en Rastro & Retro: " .. def.Name, {})
		data.Counters.used_sold = (data.Counters.used_sold or 0) + 1
		return true, "Vendiste " .. def.Name .. " al rastro por $" .. Util.formatInt(value) .. (value > online and (" (online te daban $" .. Util.formatInt(online) .. ")") or "") .. ".", { value = value }
	end)

	Net.on("Market.Repair", function(player, p)
		local data = S.Data.get(player)
		local rec = type(p.uid) == "string" and data.Inventory[p.uid]
		if not rec then
			return false, "No tienes ese objeto."
		end
		if not Market.inStore(player) then
			return false, "El taller está en Rastro & Retro: ve allí para reparar con descuento."
		end
		local def = Catalog.get(rec.Id)
		if rec.Cond >= 100 then
			return false, def.Name .. " no necesita reparación."
		end
		local cost = MarketData.repairCost(def, rec.Cond)
		if not S.Economy.spend(player, cost, "Reparaciones", "Taller de Rastro & Retro: " .. def.Name) then
			return false, "La reparación cuesta $" .. Util.formatInt(cost) .. "."
		end
		rec.Cond = 100
		data.Counters.used_repairs = (data.Counters.used_repairs or 0) + 1
		return true, def.Name .. " reparado en el taller por $" .. Util.formatInt(cost) .. " (condición 100%).", { cost = cost }
	end)
end

return Market
