-- CommercialConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/CommercialConfig
--
-- Instalaciones comerciales (FASE 3): políticas de precios de tienda, restauración
-- y abonos, y catálogo de productos que se desbloquean con el nivel de cada instalación.
-- Los ingresos reales salen de EconomyFormulas.Cycle; los productos reparten esos
-- ingresos según su peso para que el jugador vea qué vende.

local CommercialConfig = {}

-- Política de precios de la tienda y de la restauración.
--   spend        multiplicador del gasto por espectador
--   satisfaction efecto sobre la satisfacción de la afición
CommercialConfig.PricePolicies = {
	{ id = "LOW", name = "Económicos", spend = 0.8, satisfaction = 5 },
	{ id = "NORMAL", name = "Normales", spend = 1.0, satisfaction = 0 },
	{ id = "HIGH", name = "Altos", spend = 1.25, satisfaction = -8 },
}
CommercialConfig.DEFAULT_POLICY = "NORMAL"

-- minLevel: nivel de la instalación que lo desbloquea · weight: parte de las ventas
CommercialConfig.ShopProducts = {
	{ id = "scarves", name = "Bufandas", icon = "🧣", minLevel = 1, weight = 3 },
	{ id = "shirts", name = "Camisetas oficiales", icon = "👕", minLevel = 1, weight = 5 },
	{ id = "balls", name = "Balones", icon = "⚽", minLevel = 2, weight = 2 },
	{ id = "caps", name = "Gorras y gorros", icon = "🧢", minLevel = 3, weight = 2 },
	{ id = "collectibles", name = "Coleccionables", icon = "🃏", minLevel = 4, weight = 3 },
	{ id = "premium", name = "Edición premium", icon = "✨", minLevel = 5, weight = 4 },
	{ id = "retro", name = "Camisetas retro", icon = "🎽", minLevel = 6, weight = 3 },
}

CommercialConfig.FoodProducts = {
	{ id = "drinks", name = "Bebidas", icon = "🥤", minLevel = 1, weight = 4 },
	{ id = "hotdogs", name = "Perritos calientes", icon = "🌭", minLevel = 1, weight = 4 },
	{ id = "snacks", name = "Palomitas y snacks", icon = "🍿", minLevel = 2, weight = 2 },
	{ id = "menus", name = "Menús completos", icon = "🍽️", minLevel = 3, weight = 4 },
	{ id = "gourmet", name = "Cocina gourmet", icon = "🥘", minLevel = 5, weight = 4 },
	{ id = "chef", name = "Experiencia de chef", icon = "👨‍🍳", minLevel = 6, weight = 3 },
}

local function find(list, id, default)
	for _, entry in ipairs(list) do
		if entry.id == id then
			return entry
		end
	end
	return default
end

function CommercialConfig.Policy(id)
	return find(CommercialConfig.PricePolicies, id, CommercialConfig.PricePolicies[2])
end

-- Reparte unos ingresos entre los productos desbloqueados con ese nivel.
-- Devuelve { { product, unlocked, revenue } } en el orden del catálogo.
function CommercialConfig.Breakdown(products, level, revenue)
	local totalWeight = 0
	for _, product in ipairs(products) do
		if level >= product.minLevel then
			totalWeight += product.weight
		end
	end
	local result = {}
	for _, product in ipairs(products) do
		local unlocked = level >= product.minLevel
		table.insert(result, {
			product = product,
			unlocked = unlocked,
			revenue = (unlocked and totalWeight > 0) and math.floor(revenue * product.weight / totalWeight) or 0,
		})
	end
	return result
end

return CommercialConfig
