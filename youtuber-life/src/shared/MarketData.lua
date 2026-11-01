--!nonstrict
-- MarketData: reglas de la tienda de segunda mano «Rastro & Retro» y del intercambio entre jugadores.
-- El stock de cada día es determinista (el mismo para todos los jugadores) y se calcula igual en servidor y cliente.

local Catalog = require(script.Parent.ItemCatalog)
local Util = require(script.Parent.Util)

local MarketData = {}

MarketData.StoreName = "Rastro & Retro"
MarketData.StoreRadius = 45
MarketData.MinStock = 12
MarketData.MaxStock = 15
MarketData.MinCond = 35
MarketData.MaxCond = 90
MarketData.SellRate = 0.7 -- vender en el rastro: 70% × condición del precio pagado (online: 55%)
MarketData.RepairDiscount = 0.3 -- el taller de la tienda repara un 30% más barato

MarketData.TradeRadius = 20 -- distancia máxima para empezar un intercambio
MarketData.TradeLeaveRadius = 25 -- si se separan más, el intercambio se cancela
MarketData.TradeMaxItems = 8
MarketData.TradeMaxMoney = 10000000
MarketData.TradeRequestSeconds = 60

-- Generador pseudoaleatorio determinista (Lehmer) a partir de un texto
local function rng(seed)
	local state = Util.hashString(seed) % 2147483646 + 1
	return function()
		state = (state * 16807) % 2147483647
		return state / 2147483647
	end
end

local pool, collectiblePool
local function pools()
	if not pool then
		pool, collectiblePool = {}, {}
		for _, id in ipairs(Catalog.Order) do
			local def = Catalog.get(id)
			if def.Collectible then
				collectiblePool[#collectiblePool + 1] = def
			elseif Catalog.isForSale(id) and def.Cat ~= "pc" and def.Cat ~= "food" then
				pool[#pool + 1] = def
			end
		end
	end
	return pool, collectiblePool
end

-- Lista de coleccionables del catálogo
function MarketData.collectibles()
	local _, cols = pools()
	return cols
end

local cache = {}
local cacheOrder = {}

-- Stock usado del día: { { Key, Id, Cond, Collectible }, ... } (12-15 unidades, sin PC completos ni comida).
-- Los coleccionables solo aparecen algunos días (1 o, con suerte, 2).
function MarketData.stock(day)
	day = math.floor(tonumber(day) or 1)
	if cache[day] then
		return cache[day]
	end
	local items, cols = pools()
	local r = rng("rastro:" .. day)
	local n = MarketData.MinStock + math.floor(r() * (MarketData.MaxStock - MarketData.MinStock + 1))
	local roll = r()
	local nCol = 0
	if #cols > 0 then
		if roll < 0.12 then
			nCol = 2
		elseif roll < 0.5 then
			nCol = 1
		end
	end
	local function cond()
		return MarketData.MinCond + math.floor(r() * (MarketData.MaxCond - MarketData.MinCond + 1))
	end
	local out = {}
	local idx = {}
	for i = 1, #items do
		idx[i] = i
	end
	for i = 1, math.min(n - nCol, #items) do
		local j = i + math.floor(r() * (#idx - i + 1))
		idx[i], idx[j] = idx[j], idx[i]
		out[#out + 1] = { Id = items[idx[i]].Id, Cond = cond() }
	end
	local cidx = {}
	for i = 1, #cols do
		cidx[i] = i
	end
	for i = 1, math.min(nCol, #cols) do
		local j = i + math.floor(r() * (#cidx - i + 1))
		cidx[i], cidx[j] = cidx[j], cidx[i]
		-- posición aleatoria dentro del stock
		local pos = 1 + math.floor(r() * (#out + 1))
		table.insert(out, pos, { Id = cols[cidx[i]].Id, Cond = cond(), Collectible = true })
	end
	for i, u in ipairs(out) do
		u.Key = day .. "-" .. i
	end
	cache[day] = out
	table.insert(cacheOrder, day)
	while #cacheOrder > 4 do
		cache[table.remove(cacheOrder, 1)] = nil
	end
	return out
end

-- Precio de un artículo usado: Price × (0,3 + 0,5 × condición) × descuento de evento
function MarketData.usedPrice(def, cond, discount)
	local p = def.Price * (0.3 + 0.5 * cond / 100) * (1 - (discount or 0))
	return math.max(1, math.floor(p + 0.5))
end

-- Lo que paga el rastro por un objeto tuyo
function MarketData.sellValue(rec, def)
	return math.floor((rec.Paid or def.Price) * MarketData.SellRate * (rec.Cond or 100) / 100 + 0.5)
end

-- Reparación completa en el taller de la tienda (con descuento sobre la reparación normal)
function MarketData.repairCost(def, cond)
	local base = math.max(5, math.floor(def.Price * 0.15 * (100 - cond) / 50 + 0.5))
	return math.max(3, math.floor(base * (1 - MarketData.RepairDiscount) + 0.5))
end

function MarketData.condText(cond)
	if cond >= 85 then
		return "Como nuevo"
	elseif cond >= 70 then
		return "Buen estado"
	elseif cond >= 55 then
		return "Uso visible"
	elseif cond >= 45 then
		return "Desgastado"
	end
	return "Para reparar"
end

function MarketData.wearNote(cond)
	if cond >= 85 then
		return "Apenas usado: conserva la caja y casi todos los accesorios."
	elseif cond >= 70 then
		return "Pequeños rasguños en la carcasa; funciona perfectamente."
	elseif cond >= 55 then
		return "Marcas de uso visibles y algún botón algo duro."
	elseif cond >= 45 then
		return "Bastante desgastado: conviene repararlo pronto."
	end
	return "Muy usado: funciona, pero rinde menos hasta que lo repares."
end

-- Rendimiento relativo según la condición (igual que InventoryService.condFactor)
function MarketData.performance(cond)
	return math.floor((0.85 + 0.15 * cond / 100) * 100 + 0.5)
end

return MarketData
