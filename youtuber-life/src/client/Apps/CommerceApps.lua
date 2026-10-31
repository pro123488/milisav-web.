--!nonstrict
-- Apps de compras y gestión: Tienda (física y online), Ficha de producto, Comparador, Inventario,
-- Montador de PC y Banco.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local Catalog = require(Shared.ItemCatalog)
local PCBuild = require(Shared.PCBuild)
local Util = require(Shared.Util)
local T = UI.Theme

local apps = {}
local cart = {} -- carrito online compartido entre aperturas: { [itemId] = qty }
local compareList = {} -- productos elegidos en el comparador

local statNames = {
	Score = "Rendimiento", Tdp = "Calor (W)", IGpu = "Gráficos integrados", Cores = "Núcleos", Gb = "Capacidad (GB)", Watts = "Consumo/Potencia (W)",
	ProColor = "Color profesional", Capacity = "Disipación (W)", Noise = "Ruido", Airflow = "Flujo de aire", FanSlots = "Huecos ventilador",
	Speed = "Velocidad", CpuScore = "CPU", GpuScore = "GPU", Ram = "RAM (GB)", ColorAcc = "Precisión de color", Screens = "Pantallas",
	EditSpeed = "Velocidad de edición %", AudioMix = "Mezcla de audio", Video = "Vídeo", Gaming = "Juego", Comfort = "Comodidad",
	Photo = "Foto", LowLight = "Poca luz", Stab = "Estabilización", Battery = "Batería (escenas)", GbPerMin = "GB por minuto",
	Weather = "Resistente a lluvia", Audio = "Audio", Stability = "Estabilidad", Light = "Luz", Presentation = "Presentación",
	Decor = "Decoración", Charges = "Cargas", Slots = "Espacios de mochila", PhotoStorage = "Fotos que caben", Night = "Modo noche",
	Thumbnails = "Diseña miniaturas", EditLite = "Edición ligera (clips)", Performance = "Rendimiento", Durability = "Durabilidad", Aerial = "Tomas aéreas",
}

local function statText(k, v)
	if type(v) == "boolean" then
		return (statNames[k] or k) .. ": " .. (v and "Sí" or "No")
	end
	return (statNames[k] or k) .. ": " .. tostring(v)
end

local function ownedCount(itemId)
	local n = 0
	for _, rec in pairs(State.Data and State.Data.Inventory or {}) do
		if rec.Id == itemId then
			n = n + 1
		end
	end
	return n
end

local function compatText(def)
	local c = def.Compat or {}
	local parts = {}
	if c.Socket then
		parts[#parts + 1] = "Zócalo " .. c.Socket
	end
	if c.RamType then
		parts[#parts + 1] = c.RamType
	end
	if c.Form then
		parts[#parts + 1] = "Formato " .. c.Form
	end
	if c.Forms then
		parts[#parts + 1] = "Admite " .. table.concat(c.Forms, "/")
	end
	if c.MaxGpu then
		parts[#parts + 1] = "Gráfica máx. " .. c.MaxGpu .. " cm"
	end
	if c.Length then
		parts[#parts + 1] = "Largo " .. c.Length .. " cm"
	end
	if c.StorageSlots then
		parts[#parts + 1] = c.StorageSlots .. " ranuras de disco"
	end
	if def.Portable then
		parts[#parts + 1] = "Portátil"
	end
	return #parts > 0 and table.concat(parts, " · ") or "Compatible con todo"
end

local function buyHere(def, storeId)
	local r = Net.call("Shop.BuyInStore", { itemId = def.Id, qty = 1, nonce = Net.nonce() })
	return r.ok
end

-- Tarjeta de detalle de un producto (la usan la Tienda y la Ficha)
local function productDetail(parent, def, storeId, ctx)
	local card = UI.card(parent, { Height = 0, Auto = Enum.AutomaticSize.Y })
	UI.label(card, def.Name, { Font = Enum.Font.GothamBlack, TextSize = 18 })
	UI.label(card, Catalog.categoryName(def.Cat) .. " · " .. tostring(def.Sub) .. (def.Brand ~= "" and (" · " .. def.Brand) or ""), { TextSize = 12, Color = T.Sub })
	UI.label(card, "$" .. Util.formatInt(def.Price) .. "   ·   Calidad " .. def.Quality .. "/100" .. ((def.Req.Level or 1) > 1 and ("   ·   Requiere nivel " .. def.Req.Level) or ""), { Font = Enum.Font.GothamBold, Color = T.Gold })
	UI.label(card, def.Desc, { Height = 36, TextSize = 13 })
	for k, v in pairs(def.Stats) do
		UI.label(card, "• " .. statText(k, v), { TextSize = 12 })
	end
	if def.Parts then
		local names = {}
		for _, v in pairs(def.Parts) do
			if type(v) == "table" then
				for _, id in ipairs(v) do
					names[#names + 1] = Catalog.get(id).Name
				end
			else
				names[#names + 1] = Catalog.get(v).Name
			end
		end
		local stats = PCBuild.stats(def.Parts)
		UI.label(card, "Piezas: " .. table.concat(names, ", "), { TextSize = 12, Color = T.Sub, Height = 46 })
		UI.label(card, "Rendimiento " .. stats.Score .. " (" .. stats.TierName .. ") · hasta " .. stats.MaxScenes .. " clips · " .. stats.Temp .. " °C · ruido " .. stats.Noise .. "/10", { TextSize = 12 })
	end
	UI.label(card, "Compatibilidad: " .. compatText(def), { TextSize = 12, Color = T.Sub })
	local pros, cons = Catalog.prosCons(def)
	if #pros > 0 then
		UI.label(card, "👍 " .. table.concat(pros, " · "), { TextSize = 12, Color = T.Ok })
	end
	if #cons > 0 then
		UI.label(card, "👎 " .. table.concat(cons, " · "), { TextSize = 12, Color = T.Err })
	end
	local owned = ownedCount(def.Id)
	if owned > 0 then
		UI.label(card, "Tienes " .. owned, { TextSize = 12, Color = T.Accent2 })
	end
	local row = UI.row(card, 36)
	if storeId and Util.indexOf(def.Stores, storeId) then
		UI.button(row, "🛍 Comprar aquí", function()
			buyHere(def, storeId)
		end, { Width = 140, Color = T.Ok })
	end
	UI.button(row, "🛒 Al carrito online", function()
		cart[def.Id] = math.min(10, (cart[def.Id] or 0) + 1)
		Notify.toast(def.Name .. " añadido al carrito online.", "info")
	end, { Width = 160 })
	UI.button(row, "⚖ Comparar", function()
		if not Util.indexOf(compareList, def.Id) then
			if #compareList >= 4 then
				table.remove(compareList, 1)
			end
			table.insert(compareList, def.Id)
		end
		ctx.open("compare")
	end, { Width = 110 })
	return card
end

---------------------------------------------------------------------------
-- TIENDA (online + física)
---------------------------------------------------------------------------
local Shop = { Id = "shop", Name = "Tienda", Icon = "🛒", Order = 5, Surfaces = { pc = true, phone = true, panel = true }, Width = 940, Height = 580 }

function Shop.build(container, ctx)
	local storeId = ctx.params.store
	local tab = "catalog"
	local cat = nil
	local sortMode = 1
	local maxPrice = 0
	local selected = nil
	if storeId then
		Net.call("Shop.VisitStore", {}, { silent = true })
		cat = Catalog.Stores[storeId].Cats[1]
	end
	local cats = {}
	for _, c in ipairs(Catalog.Categories) do
		if not storeId or Util.indexOf(Catalog.Stores[storeId].Cats, c.Key) then
			cats[#cats + 1] = c
		end
	end
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local tabs = UI.row(container, 34)
		UI.label(tabs, storeId and ("🏬 " .. Catalog.Stores[storeId].Name .. " (tienda física: entrega inmediata)") or "🛒 Tienda online (entrega a domicilio)", { Size = UDim2.new(0, 330, 1, 0), Font = Enum.Font.GothamBold, TextSize = 13 })
		UI.button(tabs, "Catálogo", function()
			tab = "catalog"
			render()
		end, { Width = 90, Height = 28, Color = tab == "catalog" and T.Accent or T.Panel3 })
		local n = 0
		for _, q in pairs(cart) do
			n = n + q
		end
		UI.button(tabs, "Carrito (" .. n .. ")", function()
			tab = "cart"
			render()
		end, { Width = 100, Height = 28, Color = tab == "cart" and T.Accent or T.Panel3 })
		UI.button(tabs, "Pedidos", function()
			tab = "orders"
			render()
		end, { Width = 90, Height = 28, Color = tab == "orders" and T.Accent or T.Panel3 })
		UI.label(tabs, "💰 $" .. Util.formatInt(data.Money), { Size = UDim2.new(0, 120, 1, 0), Font = Enum.Font.GothamBold, Color = T.Ok })
		local body = UI.frame(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Transparency = 1, Radius = false })
		if tab == "cart" then
			local s = UI.scroll(body, { Pad = 6 })
			local total = 0
			for id, qty in pairs(cart) do
				local def = Catalog.get(id)
				total = total + def.Price * qty
				local row = UI.row(s, 32)
				UI.label(row, def.Name, { Size = UDim2.new(0.45, 0, 1, 0) })
				UI.button(row, "−", function()
					cart[id] = qty > 1 and qty - 1 or nil
					render()
				end, { Width = 30, Height = 26 })
				UI.label(row, "x" .. qty, { Size = UDim2.fromOffset(40, 26), Align = Enum.TextXAlignment.Center })
				UI.button(row, "+", function()
					cart[id] = math.min(10, qty + 1)
					render()
				end, { Width = 30, Height = 26 })
				UI.label(row, "$" .. Util.formatInt(def.Price * qty), { Size = UDim2.fromOffset(100, 26), Align = Enum.TextXAlignment.Right })
			end
			if next(cart) == nil then
				UI.label(s, "El carrito está vacío.", { Color = T.Sub })
				return
			end
			local shipping = total >= 500 and 0 or 15
			UI.label(s, "Subtotal $" .. Util.formatInt(total) .. " · Envío " .. (shipping == 0 and "gratis" or ("$" .. shipping)) .. " · TOTAL $" .. Util.formatInt(total + shipping), { Font = Enum.Font.GothamBold, Color = T.Gold })
			UI.label(s, "Presupuesto disponible: $" .. Util.formatInt(data.Money) .. (data.Money < total + shipping and "  ⚠ no alcanza" or ""), { Color = data.Money < total + shipping and T.Err or T.Sub, TextSize = 13 })
			UI.button(s, "✅ Confirmar pedido", function()
				Notify.confirm("¿Confirmar el pedido por $" .. Util.formatInt(total + shipping) .. "? Llegará a tu casa en unos minutos.", function()
					local items = {}
					for id, qty in pairs(cart) do
						items[#items + 1] = { id = id, qty = qty }
					end
					local r = Net.call("Shop.Checkout", { items = items, nonce = Net.nonce() })
					if r.ok then
						cart = {}
						tab = "orders"
						render()
					end
				end)
			end, { Width = 200, Color = T.Ok })
			return
		elseif tab == "orders" then
			local s = UI.scroll(body, { Pad = 6 })
			if #data.Orders == 0 then
				UI.label(s, "Aún no has hecho pedidos online.", { Color = T.Sub })
			end
			for _, o in ipairs(data.Orders) do
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				local names = {}
				for _, line in ipairs(o.Items) do
					names[#names + 1] = Catalog.get(line.Id).Name .. " x" .. line.Qty
				end
				local status = o.Status
				if status == "En camino" then
					status = status .. " (llega en " .. math.max(0, math.ceil(o.Eta - workspace:GetServerTimeNow())) .. " s)"
				end
				UI.label(card, "Pedido #" .. o.Num .. " · $" .. Util.formatInt(o.Total) .. " · " .. status, { Font = Enum.Font.GothamBold })
				UI.label(card, table.concat(names, ", "), { TextSize = 12, Color = T.Sub, Height = 32 })
				if o.Status == "En camino" then
					UI.button(card, "Cancelar pedido", function()
						Net.call("Shop.CancelOrder", { num = o.Num })
					end, { Width = 150, Height = 28, Color = Color3.fromRGB(110, 40, 40) })
				end
			end
			return
		end
		-- Catálogo con filtros
		local narrow = ctx.kind == "phone"
		local side = UI.scroll(body, { Size = narrow and UDim2.new(1, 0, 0, 44) or UDim2.new(0, 170, 1, 0), Horizontal = narrow, Pad = 4 })
		for _, c in ipairs(cats) do
			UI.button(side, c.Name, function()
				cat = c.Key
				selected = nil
				render()
			end, { Size = narrow and UDim2.fromOffset(110, 32) or UDim2.new(1, -8, 0, 30), TextSize = 12, Color = cat == c.Key and T.Accent or T.Panel3 })
		end
		local main = UI.frame(body, { Size = narrow and UDim2.new(1, 0, 1, -50) or UDim2.new(1, -180, 1, 0), Position = narrow and UDim2.fromOffset(0, 50) or UDim2.fromOffset(180, 0), Transparency = 1, Radius = false })
		local filters = UI.row(main, 32)
		local sorts = { "Precio ↑", "Precio ↓", "Calidad ↓", "Nombre" }
		UI.cycle(filters, "Orden", sorts, sortMode, function(i)
			sortMode = i
			render()
		end, { LabelWidth = 46, ValueWidth = 90 })
		local prices = { "Cualquier precio", "Hasta $100", "Hasta $500", "Hasta $1.000", "Hasta $3.000" }
		local priceVals = { 0, 100, 500, 1000, 3000 }
		UI.cycle(filters, "", prices, Util.indexOf(priceVals, maxPrice) or 1, function(i)
			maxPrice = priceVals[i]
			render()
		end, { LabelWidth = 0, ValueWidth = 130 })
		local list = UI.scroll(main, { Size = selected and UDim2.new(0.5, -4, 1, -38) or UDim2.new(1, 0, 1, -38), Position = UDim2.fromOffset(0, 38), Pad = 4 })
		local items = Catalog.list({ Cat = cat or (cats[1] and cats[1].Key), Store = storeId })
		local filtered = {}
		for _, def in ipairs(items) do
			if maxPrice == 0 or def.Price <= maxPrice then
				filtered[#filtered + 1] = def
			end
		end
		table.sort(filtered, function(a, b)
			if sortMode == 1 then
				return a.Price < b.Price
			elseif sortMode == 2 then
				return a.Price > b.Price
			elseif sortMode == 3 then
				return a.Quality > b.Quality
			end
			return a.Name < b.Name
		end)
		for _, def in ipairs(filtered) do
			local locked = data.Level < (def.Req.Level or 1)
			local b = UI.button(list, def.Name .. "   $" .. Util.formatInt(def.Price) .. "   ★" .. def.Quality .. (locked and ("   🔒 nivel " .. def.Req.Level) or "") .. (ownedCount(def.Id) > 0 and "   ✔" or ""), function()
				selected = def.Id
				render()
			end, { Size = UDim2.new(1, -8, 0, 32), TextSize = 12, Color = selected == def.Id and T.Accent2 or T.Panel2 })
			b.TextXAlignment = Enum.TextXAlignment.Left
		end
		if selected then
			local detail = UI.scroll(main, { Size = UDim2.new(0.5, -4, 1, -38), Position = UDim2.new(0.5, 4, 0, 38) })
			productDetail(detail, Catalog.get(selected), storeId, ctx)
		end
	end
	render()
	ctx.onState(function()
		if tab ~= "catalog" then
			render()
		end
	end)
end
table.insert(apps, Shop)

---------------------------------------------------------------------------
-- FICHA DE PRODUCTO (al inspeccionar en una tienda física)
---------------------------------------------------------------------------
local Product = { Id = "product", Name = "Producto", Icon = "🏷", Hidden = true, Surfaces = { panel = true }, Width = 520, Height = 520 }
function Product.build(container, ctx)
	local def = Catalog.get(ctx.params.item or "")
	if not def then
		return
	end
	local s = UI.scroll(container)
	productDetail(s, def, ctx.params.store, ctx)
	UI.button(s, "Ver todo el catálogo de la tienda", function()
		ctx.open("shop", { store = ctx.params.store })
	end, { Width = 280 })
end
table.insert(apps, Product)

---------------------------------------------------------------------------
-- COMPARADOR
---------------------------------------------------------------------------
local Compare = { Id = "compare", Name = "Comparador", Icon = "⚖", Order = 6, Surfaces = { pc = true, phone = true, panel = true }, Width = 960, Height = 560 }
function Compare.build(container, ctx)
	local cat = "camera"
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		local top = UI.row(container, 34)
		local names, keys = {}, {}
		for i, c in ipairs(Catalog.Categories) do
			names[i] = c.Name
			keys[i] = c.Key
		end
		UI.cycle(top, "Categoría", names, Util.indexOf(keys, cat) or 1, function(i)
			cat = keys[i]
			render()
		end, { LabelWidth = 80, ValueWidth = 180 })
		UI.button(top, "Vaciar", function()
			compareList = {}
			render()
		end, { Width = 80, Height = 28 })
		UI.label(top, "Elige hasta 4 productos (" .. #compareList .. "/4)", { Size = UDim2.fromOffset(240, 28), Color = T.Sub, TextSize = 12 })
		local picker = UI.scroll(container, { Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 40), Horizontal = true, Pad = 4 })
		for _, def in ipairs(Catalog.list({ Cat = cat })) do
			local on = Util.indexOf(compareList, def.Id) ~= nil
			UI.button(picker, def.Name, function()
				local i = Util.indexOf(compareList, def.Id)
				if i then
					table.remove(compareList, i)
				elseif #compareList < 4 then
					table.insert(compareList, def.Id)
				end
				render()
			end, { Size = UDim2.fromOffset(170, 34), TextSize = 11, Color = on and T.Ok or T.Panel3 })
		end
		local tableFrame = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -140), Position = UDim2.fromOffset(0, 90), Pad = 2, Color = T.Bg, Transparency = 0 })
		if #compareList == 0 then
			UI.label(tableFrame, "Selecciona productos arriba para compararlos.", { Color = T.Sub })
			return
		end
		local defs = {}
		for _, id in ipairs(compareList) do
			defs[#defs + 1] = Catalog.get(id)
		end
		local colW = 1 / (#defs + 1)
		local function row(label, fn, best)
			local r = UI.frame(tableFrame, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
			UI.label(r, label, { Size = UDim2.new(colW, 0, 0, 0), Auto = Enum.AutomaticSize.Y, Color = T.Sub, TextSize = 12 })
			local vals = {}
			for i, def in ipairs(defs) do
				vals[i] = fn(def)
			end
			local bestIdx = nil
			if best then
				local bv = nil
				for i, v in ipairs(vals) do
					local n = tonumber(v)
					if n and (bv == nil or (best == "max" and n > bv) or (best == "min" and n < bv)) then
						bv, bestIdx = n, i
					end
				end
			end
			for i, v in ipairs(vals) do
				UI.label(r, tostring(v), { Size = UDim2.new(colW, -4, 0, 0), Position = UDim2.new(colW * i, 0, 0, 0), Auto = Enum.AutomaticSize.Y, TextSize = 12, Color = (i == bestIdx and #defs > 1) and T.Ok or T.Text })
			end
		end
		row("Producto", function(d)
			return d.Name
		end)
		row("Precio $", function(d)
			return d.Price
		end, "min")
		row("Calidad", function(d)
			return d.Quality
		end, "max")
		local keysSeen, statKeys = {}, {}
		for _, d in ipairs(defs) do
			for k in pairs(d.Stats) do
				if not keysSeen[k] then
					keysSeen[k] = true
					statKeys[#statKeys + 1] = k
				end
			end
		end
		table.sort(statKeys)
		for _, k in ipairs(statKeys) do
			local lowerBetter = (k == "Noise" or k == "Tdp" or k == "GbPerMin")
			row(statNames[k] or k, function(d)
				local v = d.Stats[k]
				if type(v) == "boolean" then
					return v and "Sí" or "No"
				end
				return v == nil and "—" or v
			end, lowerBetter and "min" or "max")
		end
		if cat == "pc" then
			row("Rendimiento real", function(d)
				return PCBuild.stats(d.Parts).Score
			end, "max")
		elseif cat == "laptop" then
			row("Rendimiento real", function(d)
				return PCBuild.laptopStats(d).Score
			end, "max")
		end
		row("Durabilidad (simulada)", function(d)
			return d.Stats.Durability or math.floor(40 + d.Quality * 0.5)
		end, "max")
		row("Mantenimiento/año $", function(d)
			return math.floor(d.Price * 0.15 * (1.2 - d.Quality / 100))
		end, "min")
		row("Compatibilidad", compatText)
		row("Ventajas", function(d)
			local p = Catalog.prosCons(d)
			return #p > 0 and table.concat(p, ", ") or "—"
		end)
		row("Desventajas", function(d)
			local _, c = Catalog.prosCons(d)
			return #c > 0 and table.concat(c, ", ") or "—"
		end)
		row("Requisitos", function(d)
			return "Nivel " .. (d.Req.Level or 1)
		end)
		row("¿Lo tienes?", function(d)
			return ownedCount(d.Id) > 0 and "✔ Sí (puedes probarlo de verdad)" or "No (solo especificaciones)"
		end)
		local bottom = UI.row(container, 40)
		bottom.Position = UDim2.new(0, 0, 1, -42)
		UI.button(bottom, "🎬 Crear proyecto de comparativa", function()
			local r = Net.call("Video.CreateProject", { category = "compare", name = "Comparativa: " .. (defs[1] and defs[1].Name or "") })
			if r.ok then
				Net.call("Video.UpdatePlan", { pid = r.data.pid, plan = { Featured = compareList } }, { silent = true })
				Notify.toast("Para una «Prueba real» necesitas tener los productos en la mochila. Si no, se publicará como «Comparación de especificaciones».", "info")
			end
		end, { Width = 280, Color = T.Accent })
	end
	render()
end
table.insert(apps, Compare)

---------------------------------------------------------------------------
-- INVENTARIO Y MOCHILA
---------------------------------------------------------------------------
local Inventory = { Id = "inventory", Name = "Inventario", Icon = "🎒", Order = 7, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 560 }
function Inventory.build(container, ctx)
	local filter = "all"
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local d = data.Derived
		local top = UI.row(container, 34)
		for _, f in ipairs({ { "all", "Todo" }, { "backpack", "🎒 Mochila" }, { "home", "🏠 Casa" }, { "rig", "💻 Instalado" } }) do
			UI.button(top, f[2], function()
				filter = f[1]
				render()
			end, { Width = 110, Height = 28, Color = filter == f[1] and T.Accent or T.Panel3 })
		end
		UI.label(top, "Mochila " .. d.BackpackUsed .. "/" .. d.BackpackCap .. (d.AtHome and "  · estás en casa" or "  · sal de casa preparado"), { Size = UDim2.fromOffset(280, 28), TextSize = 12, Color = d.AtHome and T.Ok or T.Sub })
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 4 })
		local items = State.items(function(rec)
			if filter == "all" then
				return true
			elseif filter == "rig" then
				return rec.Loc:sub(1, 4) == "rig:"
			end
			return rec.Loc == filter
		end)
		if #items == 0 then
			UI.label(s, "No hay objetos aquí.", { Color = T.Sub })
		end
		for _, it in ipairs(items) do
			local rec, def, uid = it.Rec, it.Def, it.Uid
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			local loc = rec.Loc == "backpack" and "🎒 Mochila" or (rec.Loc == "home" and "🏠 Casa" or "💻 Instalado en PC")
			local extra = ""
			if def.Cat == "camera" or def.Cat == "phone" then
				extra = " · 🔋 " .. math.floor(rec.Charge or 100) .. "%"
			end
			if data.Equipped.Phone == uid then
				extra = extra .. " · 📱 en uso"
			end
			UI.label(card, def.Name .. "  ·  " .. loc .. extra, { Font = Enum.Font.GothamBold, TextSize = 13 })
			UI.label(card, Catalog.categoryName(def.Cat) .. " · condición " .. math.floor(rec.Cond) .. "% · pagado $" .. Util.formatInt(rec.Paid or 0) .. (def.Portable and " · portátil (" .. def.Size .. " esp.)" or ""), { TextSize = 12, Color = T.Sub })
			local row = UI.row(card, 30, nil, 4)
			if rec.Loc == "home" and def.Portable then
				UI.button(row, "→ Mochila", function()
					Net.call("Inv.Move", { uid = uid, to = "backpack" })
				end, { Width = 96, Height = 26, TextSize = 12, Color = T.Accent2 })
			elseif rec.Loc == "backpack" then
				UI.button(row, "→ Casa", function()
					Net.call("Inv.Move", { uid = uid, to = "home" })
				end, { Width = 80, Height = 26, TextSize = 12 })
			end
			if def.Slot == "phone" and data.Equipped.Phone ~= uid then
				UI.button(row, "Usar teléfono", function()
					Net.call("Inv.EquipPhone", { uid = uid })
				end, { Width = 110, Height = 26, TextSize = 12 })
			end
			if rec.Loc:sub(1, 4) ~= "rig:" then
				local ret = d.Returnable[uid]
				if ret then
					UI.button(row, "↩ Devolver (+$" .. ret .. ")", function()
						Notify.confirm("¿Devolver " .. def.Name .. " por $" .. ret .. "?", function()
							Net.call("Inv.Return", { uid = uid })
						end)
					end, { Width = 150, Height = 26, TextSize = 12 })
				end
				local sv = d.SellValues[uid] or 0
				UI.button(row, "Vender $" .. sv, function()
					Notify.confirm("¿Vender " .. def.Name .. " por $" .. sv .. "?", function()
						Net.call("Inv.Sell", { uid = uid })
					end, "Vender")
				end, { Width = 110, Height = 26, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
			end
			if rec.Cond < 90 then
				UI.button(row, "🧽 Limpiar", function()
					Net.call("Inv.Clean", { uid = uid })
				end, { Width = 90, Height = 26, TextSize = 12 })
			end
			if rec.Cond < 100 then
				UI.button(row, "🔧 Reparar", function()
					Net.call("Inv.Repair", { uid = uid })
				end, { Width = 90, Height = 26, TextSize = 12 })
			end
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Inventory)

---------------------------------------------------------------------------
-- MONTADOR DE PC
---------------------------------------------------------------------------
local Builder = { Id = "builder", Name = "Montador de PC", Icon = "🔧", Order = 8, Surfaces = { pc = true, panel = true }, Width = 980, Height = 580 }
function Builder.build(container, ctx)
	local editingRig = nil -- nil = lista; "new" = nuevo
	local draft = {}
	local name = ""
	local benchResult = {}
	local render
	local function partsIds()
		local ids = {}
		for k, v in pairs(draft) do
			if type(v) == "table" then
				ids[k] = {}
				for _, uid in ipairs(v) do
					local rec = State.Data.Inventory[uid]
					if rec then
						table.insert(ids[k], rec.Id)
					end
				end
			else
				local rec = State.Data.Inventory[v]
				ids[k] = rec and rec.Id or nil
			end
		end
		return ids
	end
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		if not editingRig then
			local s = UI.scroll(container, { Pad = 8 })
			UI.title(s, "💻 Tus computadores")
			UI.label(s, "Monta, mejora o desmonta tus PC en casa. Solo las piezas instaladas y reconocidas mejoran el rendimiento.", { Color = T.Sub, TextSize = 12, Height = 30 })
			for rigId, rig in pairs(data.Rigs) do
				local st = data.Derived.RigStats[rigId]
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, (data.ActiveRig == rigId and "⭐ " or "") .. rig.Name, { Font = Enum.Font.GothamBold })
				if st then
					UI.label(card, "Rendimiento " .. st.Score .. " (" .. st.TierName .. ") · " .. st.MaxScenes .. " clips · " .. st.Ram .. " GB RAM · " .. Util.formatInt(st.StorageGb) .. " GB · " .. st.Watts .. " W · " .. st.Temp .. " °C · ruido " .. st.Noise .. "/10 · valor piezas $" .. Util.formatInt(st.PartsValue), { TextSize = 12, Color = T.Sub, Height = 32 })
				end
				if benchResult[rigId] then
					UI.label(card, "🏁 Benchmark: " .. Util.formatInt(benchResult[rigId]) .. " puntos", { TextSize = 12, Color = T.Gold })
				end
				local row = UI.row(card, 30, nil, 4)
				if data.ActiveRig ~= rigId then
					UI.button(row, "Usar en escritorio", function()
						Net.call("PC.SetActive", { rigId = rigId })
					end, { Width = 140, Height = 26, TextSize = 12 })
				end
				UI.button(row, "🔧 Mejorar piezas", function()
					editingRig = rigId
					draft = Util.deepCopy(rig.Parts)
					name = rig.Name
					render()
				end, { Width = 130, Height = 26, TextSize = 12 })
				UI.button(row, "🏁 Benchmark", function()
					local r = Net.call("PC.Benchmark", { rigId = rigId })
					if r.ok then
						benchResult[rigId] = r.data.points
						render()
					end
				end, { Width = 110, Height = 26, TextSize = 12 })
				UI.button(row, "Desmontar", function()
					Notify.confirm("¿Desmontar " .. rig.Name .. "? Las piezas quedarán en casa.", function()
						Net.call("PC.Disassemble", { rigId = rigId })
					end)
				end, { Width = 100, Height = 26, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
			end
			UI.button(s, "＋ Montar un PC nuevo con piezas sueltas", function()
				editingRig = "new"
				draft = { storage = {}, fans = {} }
				name = "Mi PC"
				render()
			end, { Width = 340, Color = T.Accent })
			UI.button(s, "🛒 Comprar componentes", function()
				ctx.open("shop")
			end, { Width = 220 })
			return
		end
		-- Edición del montaje
		local left = UI.scroll(container, { Size = UDim2.new(0.58, -6, 1, -44), Pad = 6 })
		local right = UI.scroll(container, { Size = UDim2.new(0.42, 0, 1, -44), Position = UDim2.fromScale(0.58, 0), Color = T.Panel2, Transparency = 0 })
		local nb = UI.input(left, "Nombre del PC", name)
		nb.FocusLost:Connect(function()
			name = nb.Text
		end)
		local loc = editingRig ~= "new" and ("rig:" .. editingRig) or nil
		for _, slot in ipairs(PCBuild.Slots) do
			local available = State.items(function(rec, def)
				local sl = PCBuild.slotFor(def)
				return sl and sl.Key == slot.Key and (rec.Loc == "home" or rec.Loc == loc)
			end)
			local card = UI.card(left, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, slot.Name .. (slot.Required and " *" or ""), { Font = Enum.Font.GothamBold, TextSize = 13 })
			if #available == 0 then
				UI.label(card, "No tienes piezas de este tipo en casa.", { TextSize = 12, Color = T.Sub })
			end
			local grid = UI.frame(card, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
			UI.grid(grid, 250, 28, 4)
			for _, it in ipairs(available) do
				local sel
				if slot.Multi then
					sel = Util.indexOf(draft[slot.Key] or {}, it.Uid) ~= nil
				else
					sel = draft[slot.Key] == it.Uid
				end
				UI.button(grid, (sel and "✔ " or "") .. it.Def.Name, function()
					if slot.Multi then
						draft[slot.Key] = draft[slot.Key] or {}
						local i = Util.indexOf(draft[slot.Key], it.Uid)
						if i then
							table.remove(draft[slot.Key], i)
						else
							table.insert(draft[slot.Key], it.Uid)
						end
					else
						draft[slot.Key] = sel and nil or it.Uid
					end
					render()
				end, { Size = UDim2.fromOffset(250, 28), TextSize = 11, Color = sel and T.Ok or T.Panel3 })
			end
		end
		-- Vista previa y validación (el servidor vuelve a validar al guardar)
		local ids = partsIds()
		local ok, errors, warnings = PCBuild.validate(ids)
		local st = PCBuild.stats(ids)
		UI.title(right, ok and "✅ Compatible" or "❌ No compatible")
		for _, e in ipairs(errors) do
			UI.label(right, "• " .. e, { TextSize = 12, Color = T.Err, Height = 30 })
		end
		for _, w in ipairs(warnings) do
			UI.label(right, "• " .. w, { TextSize = 12, Color = T.Warn, Height = 30 })
		end
		UI.label(right, "Rendimiento estimado: " .. st.Score .. " (" .. st.TierName .. ")", { Font = Enum.Font.GothamBold })
		UI.label(right, "Clips por proyecto: " .. st.MaxScenes, { TextSize = 13 })
		UI.label(right, "Consumo: " .. st.Watts .. " W", { TextSize = 13 })
		UI.label(right, "Temperatura: " .. st.Temp .. " °C" .. (st.Throttled and " (limitado)" or ""), { TextSize = 13 })
		UI.label(right, "Ruido: " .. st.Noise .. "/10", { TextSize = 13 })
		UI.label(right, "Almacenamiento: " .. Util.formatInt(st.StorageGb) .. " GB", { TextSize = 13 })
		UI.label(right, "Valor de reventa aprox.: $" .. Util.formatInt(math.floor(st.PartsValue * 0.55)), { TextSize = 13 })
		local current = data.Derived.Session
		if current and current.Score then
			local diff = st.Score - current.Score
			UI.label(right, "Comparado con el equipo actual: " .. (diff >= 0 and "+" or "") .. math.floor(diff * 10) / 10, { TextSize = 13, Color = diff >= 0 and T.Ok or T.Err })
		end
		local bottom = UI.row(container, 40)
		bottom.Position = UDim2.new(0, 0, 1, -40)
		UI.button(bottom, editingRig == "new" and "🔧 Montar PC" or "💾 Guardar cambios", function()
			local r = Net.call("PC.SaveRig", { rigId = editingRig ~= "new" and editingRig or nil, name = name, parts = draft })
			if r.ok then
				editingRig = nil
				render()
			end
		end, { Width = 180, Color = ok and T.Ok or T.Panel3 })
		UI.button(bottom, "◀ Volver", function()
			editingRig = nil
			render()
		end, { Width = 100 })
	end
	render()
	ctx.onState(function()
		if not editingRig then
			render()
		end
	end)
end
table.insert(apps, Builder)

---------------------------------------------------------------------------
-- BANCO
---------------------------------------------------------------------------
local Bank = { Id = "bank", Name = "Banco", Icon = "🏦", Order = 9, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 560 }
function Bank.build(container, ctx)
	local tab = "account"
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local bank = data.Bank
		local top = UI.row(container, 34)
		for _, t in ipairs({ { "account", "Cuenta" }, { "history", "Movimientos" }, { "report", "Informe mensual" }, { "loans", "Ahorro y préstamos" } }) do
			UI.button(top, t[2], function()
				tab = t[1]
				render()
			end, { Width = 150, Height = 28, Color = tab == t[1] and T.Accent or T.Panel3 })
		end
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 6 })
		UI.label(s, "Banco Central Virtual · el dinero del juego no tiene relación con Robux.", { TextSize = 11, Color = T.Sub })
		if tab == "account" then
			UI.label(s, "Saldo disponible: $" .. Util.formatInt(data.Money), { Font = Enum.Font.GothamBlack, TextSize = 22, Color = T.Ok, Height = 30 })
			UI.label(s, "Ahorros: $" .. Util.formatInt(bank.Savings) .. " · Deuda de préstamo: $" .. Util.formatInt(bank.Loan), { TextSize = 14 })
			UI.label(s, "Este mes: ingresos $" .. Util.formatInt(data.Derived.MonthIncome) .. " · gastos $" .. Util.formatInt(data.Derived.MonthExpense), { TextSize = 14 })
			local h = data.Home
			UI.label(s, "🏠 Alquiler: $" .. h.Rent .. " cada 7 días jugados · próximo pago en " .. math.max(0, h.NextDue - h.PlayDays) .. " días · deuda $" .. h.Debt, { TextSize = 13, Color = h.Debt > 0 and T.Err or T.Sub })
			if h.Debt > 0 then
				UI.button(s, "Pagar deuda de alquiler ($" .. h.Debt .. ")", function()
					Net.call("Home.PayDebt", {})
				end, { Width = 260, Color = T.Accent })
			end
			UI.title(s, "🎯 Metas de ahorro")
			for i, g in ipairs(bank.Goals) do
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				local have = data.Money + bank.Savings
				UI.label(card, g.Name .. " · $" .. Util.formatInt(math.min(have, g.Target)) .. " / $" .. Util.formatInt(g.Target), { TextSize = 13 })
				UI.progress(card, have / g.Target, T.Ok)
				UI.button(card, "Quitar", function()
					Net.call("Bank.SetGoal", { remove = i })
				end, { Width = 80, Height = 24, TextSize = 11 })
			end
			local row = UI.row(s, 36)
			local gn = UI.input(row, "Nueva meta (ej. Cámara pro)", "", { Size = UDim2.fromOffset(220, 30) })
			local gt = UI.input(row, "Cantidad", "", { Size = UDim2.fromOffset(100, 30) })
			UI.button(row, "Crear", function()
				Net.call("Bank.SetGoal", { name = gn.Text, target = tonumber(gt.Text) })
			end, { Width = 80, Height = 30 })
		elseif tab == "history" then
			for _, t in ipairs(data.Transactions) do
				local row = UI.row(s, 24)
				UI.label(row, os.date("%d/%m %H:%M", t.T), { Size = UDim2.fromOffset(90, 22), TextSize = 11, Color = T.Sub })
				UI.label(row, t.C .. " · " .. t.D, { Size = UDim2.new(1, -220, 1, 0), TextSize = 12 })
				UI.label(row, (t.A >= 0 and "+" or "") .. Util.formatInt(t.A), { Size = UDim2.fromOffset(110, 22), TextSize = 12, Color = t.A >= 0 and T.Ok or T.Err, Align = Enum.TextXAlignment.Right })
			end
		elseif tab == "report" then
			local keys = {}
			for k in pairs(data.Monthly) do
				keys[#keys + 1] = k
			end
			table.sort(keys, function(a, b)
				return tonumber(a:sub(2)) > tonumber(b:sub(2))
			end)
			for _, k in ipairs(keys) do
				local m = data.Monthly[k]
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				local inc, exp = 0, 0
				for _, v in pairs(m.Inc) do
					inc = inc + v
				end
				for _, v in pairs(m.Exp) do
					exp = exp + v
				end
				UI.label(card, "Mes " .. k:sub(2) .. " · ingresos $" .. Util.formatInt(inc) .. " · gastos $" .. Util.formatInt(exp) .. " · balance " .. (inc - exp >= 0 and "+" or "") .. Util.formatInt(inc - exp), { Font = Enum.Font.GothamBold })
				local vals, labels = {}, {}
				for c, v in pairs(m.Exp) do
					vals[#vals + 1] = v
					labels[#labels + 1] = c:sub(1, 10)
				end
				if #vals > 0 then
					UI.label(card, "Gastos por categoría:", { TextSize = 12, Color = T.Sub })
					UI.bars(card, vals, labels, T.Err, { Height = 110 })
				end
				vals, labels = {}, {}
				for c, v in pairs(m.Inc) do
					vals[#vals + 1] = v
					labels[#labels + 1] = c:sub(1, 10)
				end
				if #vals > 0 then
					UI.label(card, "Ingresos por categoría:", { TextSize = 12, Color = T.Sub })
					UI.bars(card, vals, labels, T.Ok, { Height = 110 })
				end
			end
		elseif tab == "loans" then
			local row = UI.row(s, 36)
			local amt = UI.input(row, "Cantidad", "", { Size = UDim2.fromOffset(120, 30) })
			UI.button(row, "Depositar en ahorro", function()
				Net.call("Bank.Deposit", { amount = tonumber(amt.Text) })
			end, { Width = 160, Height = 30 })
			UI.button(row, "Retirar", function()
				Net.call("Bank.Withdraw", { amount = tonumber(amt.Text) })
			end, { Width = 90, Height = 30 })
			UI.label(s, "Los ahorros generan un 1% cada 7 días de juego (máx. $500 por semana).", { TextSize = 12, Color = T.Sub })
			UI.title(s, "💳 Préstamos (opcionales)")
			UI.label(s, "• Interés fijo del 10%: si pides $1.000 devuelves $1.100.\n• Se descuenta automáticamente el 10% de tus ingresos de vídeos y empleos hasta saldarlo.\n• Puedes pagar antes cuando quieras, sin penalización.\n• Límite actual: $" .. Util.formatInt(data.Derived.LoanLimit) .. " (sube con tu nivel).", { TextSize = 12, Height = 80, VAlign = Enum.TextYAlignment.Top })
			UI.label(s, "Deuda actual: $" .. Util.formatInt(bank.Loan), { Font = Enum.Font.GothamBold, Color = bank.Loan > 0 and T.Err or T.Ok })
			local row2 = UI.row(s, 36)
			local la = UI.input(row2, "Cantidad", "", { Size = UDim2.fromOffset(120, 30) })
			UI.button(row2, "Pedir préstamo", function()
				Notify.confirm("¿Pedir un préstamo de $" .. tostring(la.Text) .. "? Devolverás un 10% más.", function()
					Net.call("Bank.TakeLoan", { amount = tonumber(la.Text) })
				end)
			end, { Width = 140, Height = 30 })
			UI.button(row2, "Pagar", function()
				Net.call("Bank.RepayLoan", { amount = tonumber(la.Text) })
			end, { Width = 90, Height = 30 })
		end
	end
	render()
	ctx.onState(function()
		if tab == "history" or tab == "report" then
			render()
		end
	end)
end
table.insert(apps, Bank)

return apps
