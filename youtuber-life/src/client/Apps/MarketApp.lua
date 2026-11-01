--!nonstrict
-- Apps de Segunda mano (Rastro & Retro: stock usado, vender, reparar, colección) e Intercambio entre jugadores.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local Catalog = require(Shared.ItemCatalog)
local MarketData = require(Shared.MarketData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)
local T = UI.Theme

local apps = {}

local function money(n)
	return "$" .. Util.formatInt(math.floor(n or 0))
end

local function atUsedStore()
	local player = Players.LocalPlayer
	local root = player and player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == "usedstore" then
			local dx, dz = root.Position.X - sp.WX, root.Position.Z - sp.WZ
			if dx * dx + dz * dz <= MarketData.StoreRadius * MarketData.StoreRadius then
				return true
			end
		end
	end
	return false
end

local function locked(rec)
	local loc = rec.Loc or "home"
	return loc:sub(1, 4) == "rig:" or loc:sub(1, 5) == "prop:" or rec.Loan
end

---------------------------------------------------------------------------
-- SEGUNDA MANO
---------------------------------------------------------------------------
local Market = { Id = "market", Name = "Segunda mano", Icon = "🏷", Order = 7, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 580 }

function Market.build(container, ctx)
	local tab = ctx.params.tab or "stock"
	local stock = nil
	local fetching = false
	local inspected = {}
	local render

	local function fetch()
		if fetching then
			return
		end
		fetching = true
		task.spawn(function()
			local r = Net.call("Market.Stock", {}, { silent = true })
			fetching = false
			if r.ok and r.data then
				stock = r.data
				if container.Parent then
					render()
				end
			end
		end)
	end

	local function storeHeader(s)
		local here = atUsedStore()
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = Color3.fromRGB(60, 45, 30) })
		UI.label(card, "♻ " .. MarketData.StoreName .. " · Zona de tiendas de segunda mano", { Font = Enum.Font.GothamBlack, TextSize = 16, Height = 22 })
		if here then
			UI.label(card, "📍 Estás en la tienda: puedes comprar, vender y reparar.", { TextSize = 12, Color = T.Ok })
		else
			UI.label(card, "Puedes mirar el stock desde aquí, pero para comprar, vender o reparar tienes que estar en la tienda.", { TextSize = 12, Color = T.Warn, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.button(card, "🚕 Ir a Rastro & Retro", function()
				Net.call("Travel.Taxi", { district = "secondhand" })
			end, { Width = 200, Height = 26, TextSize = 12, Color = T.Gold, TextColor = Color3.new(0, 0, 0) })
		end
	end

	local function renderStock(s, data)
		if not stock then
			UI.label(s, "Cargando el stock de hoy...", { Color = T.Sub })
			return
		end
		UI.label(s, "Stock del día " .. stock.day .. " · " .. #stock.units .. " artículos usados · cada unidad se vende una sola vez", { TextSize = 12, Color = T.Sub })
		if (stock.discount or 0) > 0 then
			UI.label(s, "🎪 Mercado de segunda mano: −" .. math.floor(stock.discount * 100 + 0.5) .. "% en todo el stock hoy.", { TextSize = 13, Color = T.Gold, Font = Enum.Font.GothamBold })
		end
		local b = data.UsedBought or {}
		local soldToday = (b.Day == stock.day) and (b.Units or {}) or {}
		for _, u in ipairs(stock.units) do
			local def = Catalog.get(u.Id)
			local sold = u.Sold or soldToday[u.Key]
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = u.Collectible and Color3.fromRGB(70, 55, 20) or T.Panel2 })
			UI.label(card, (u.Collectible and "⭐ COLECCIONABLE · " or "") .. u.Name .. " · " .. Catalog.categoryName(def.Cat), { Font = Enum.Font.GothamBold, TextSize = 14 })
			UI.label(card, "Condición " .. u.Cond .. "% (" .. u.CondText .. ") · Precio " .. money(u.Price)
				.. (u.NewPrice and (" · Nuevo " .. money(u.NewPrice) .. " · Ahorras " .. money(u.Saving)) or " · No se vende nuevo")
				.. ((u.Level or 1) > (data.Level or 1) and (" · requiere nivel " .. u.Level) or ""), { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.progress(card, u.Cond / 100, u.Cond >= 70 and T.Ok or (u.Cond >= 50 and T.Warn or T.Err), { Height = 6 })
			local info = inspected[u.Key]
			if info then
				UI.label(card, "🔍 " .. info.Note .. " Rinde al " .. info.Performance .. "% hasta repararlo (reparación aquí: " .. money(info.RepairCost) .. ").", { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, info.Desc or "", { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			end
			local row = UI.row(card, 30)
			UI.button(row, "🔍 Inspeccionar", function()
				local r = Net.call("Market.Inspect", { key = u.Key }, { silent = true })
				if r.ok and r.data then
					inspected[u.Key] = r.data
					render()
				end
			end, { Width = 130, Height = 26, TextSize = 12 })
			if sold then
				UI.label(row, "✔ Ya lo compraste hoy", { Size = UDim2.new(0, 200, 1, 0), TextSize = 12, Color = T.Ok })
			else
				UI.button(row, "🛒 Comprar " .. money(u.Price), function()
					Net.call("Market.Buy", { key = u.Key })
				end, { Width = 170, Height = 26, TextSize = 12, Color = T.Ok })
			end
		end
	end

	local function renderSell(s, data)
		UI.label(s, "El rastro paga el " .. math.floor(MarketData.SellRate * 100) .. "% del precio que pagaste × la condición (online solo el 55%). El taller repara un "
			.. math.floor(MarketData.RepairDiscount * 100) .. "% más barato. No se aceptan objetos instalados, colocados, prestados ni tu único teléfono.", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		local items = State.items(function(rec, def)
			return def.Cat ~= "food"
		end)
		if #items == 0 then
			UI.label(s, "No tienes objetos.", { Color = T.Sub })
		end
		for _, it in ipairs(items) do
			local rec, def = it.Rec, it.Def
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			local value = MarketData.sellValue(rec, def)
			local online = data.Derived and data.Derived.SellValues and data.Derived.SellValues[it.Uid] or 0
			UI.label(card, def.Name .. (def.Collectible and " ⭐" or ""), { Font = Enum.Font.GothamBold, TextSize = 13 })
			UI.label(card, "Condición " .. math.floor(rec.Cond) .. "% · pagado " .. money(rec.Paid) .. " · Rastro: " .. money(value) .. " · Online: " .. money(online), { TextSize = 12, Color = T.Sub })
			local row = UI.row(card, 30)
			if locked(rec) then
				UI.label(row, rec.Loan and "Prestado por un patrocinador" or "Instalado o colocado: no se puede vender", { Size = UDim2.new(0, 300, 1, 0), TextSize = 12, Color = T.Warn })
			else
				UI.button(row, "💵 Vender " .. money(value), function()
					Notify.confirm("¿Vender " .. def.Name .. " al rastro por " .. money(value) .. "?", function()
						Net.call("Market.Sell", { uid = it.Uid })
					end, "Vender")
				end, { Width = 150, Height = 26, TextSize = 12, Color = T.Ok })
			end
			if rec.Cond < 100 then
				UI.button(row, "🔧 Reparar " .. money(MarketData.repairCost(def, rec.Cond)), function()
					Net.call("Market.Repair", { uid = it.Uid })
				end, { Width = 150, Height = 26, TextSize = 12, Color = T.Accent2 })
			end
		end
	end

	local function renderCollection(s, data)
		local cols = MarketData.collectibles()
		local got = (data.Visited and data.Visited.Collectibles) or {}
		local n = State.count(got)
		UI.label(s, "⭐ Colección: " .. n .. "/" .. #cols .. " piezas distintas", { Font = Enum.Font.GothamBlack, TextSize = 16, Height = 24 })
		UI.progress(s, n / math.max(1, #cols), T.Gold, { Height = 8 })
		UI.label(s, "Los coleccionables no se venden nuevos: aparecen solo algunos días en el stock de Rastro & Retro. También se pueden conseguir en intercambios con otros jugadores.", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		for _, def in ipairs(cols) do
			local has = got[def.Id]
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = has and Color3.fromRGB(70, 55, 20) or T.Panel2 })
			UI.label(card, (has and "✔ " or "❔ ") .. def.Name, { Font = Enum.Font.GothamBold, TextSize = 13, Color = has and T.Gold or T.Text })
			UI.label(card, has and def.Desc or ("Valor de referencia " .. money(def.Price) .. ". Aún no la tienes."), { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local top = UI.row(container, 34)
		for _, t in ipairs({ { "stock", "🏷 Stock usado" }, { "sell", "💵 Vender y reparar" }, { "collection", "⭐ Colección" } }) do
			UI.button(top, t[2], function()
				tab = t[1]
				render()
			end, { Width = 170, Height = 28, Color = tab == t[1] and T.Accent or T.Panel3 })
		end
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 6 })
		UI.label(s, "💰 " .. money(data.Money), { Font = Enum.Font.GothamBold, Color = T.Gold })
		if tab == "collection" then
			renderCollection(s, data)
		else
			storeHeader(s)
			if tab == "sell" then
				renderSell(s, data)
			else
				renderStock(s, data)
			end
		end
		-- Nuevo día de juego: pedir el stock nuevo (al final para no reconstruir a mitad)
		local day = data.Derived and data.Derived.Day
		if stock and day and stock.day ~= day then
			fetch()
		end
	end
	render()
	fetch()
	ctx.onState(render)
end
table.insert(apps, Market)

---------------------------------------------------------------------------
-- INTERCAMBIO
---------------------------------------------------------------------------
local pushed = nil
local tradeListeners = {}
local listenerId = 0
Net.on("trade", function(d)
	pushed = d
	for _, fn in pairs(tradeListeners) do
		task.spawn(fn)
	end
end)

-- Estado más reciente: el push del servidor o la vista sincronizada del perfil
local function tradeState()
	local derived = State.Data and State.Data.Derived and State.Data.Derived.Trade
	if pushed and (not derived or (pushed.Seq or 0) > (derived.Seq or 0)) then
		return pushed
	end
	return derived or { Status = "none" }
end

local TradeApp = { Id = "trade", Name = "Intercambio", Icon = "🤝", Order = 8, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 580 }

function TradeApp.build(container, ctx)
	local nearby = nil
	local render

	local function scan()
		task.spawn(function()
			local r = Net.call("Trade.Nearby", {}, { silent = true })
			nearby = (r.ok and r.data and r.data.players) or {}
			if container.Parent then
				render()
			end
		end)
	end

	local function offerCard(s, title, offer, mine, confirmed)
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = confirmed and Color3.fromRGB(30, 70, 45) or T.Panel2 })
		UI.label(card, title .. (confirmed and " · ✅ confirmada" or " · sin confirmar"), { Font = Enum.Font.GothamBold, TextSize = 14 })
		if #offer.Items == 0 and (offer.Money or 0) == 0 then
			UI.label(card, "(vacía)", { TextSize = 12, Color = T.Sub })
		end
		for _, it in ipairs(offer.Items) do
			local row = UI.row(card, 28)
			UI.label(row, (it.Collectible and "⭐ " or "• ") .. it.Name .. (it.Missing and "" or (" · " .. it.Cond .. "%")), { Size = UDim2.new(1, -110, 1, 0), TextSize = 12, Color = it.Missing and T.Err or T.Text })
			if mine and it.Uid then
				UI.button(row, "✖ Quitar", function()
					Net.call("Trade.RemoveItem", { uid = it.Uid }, { quietOk = true })
				end, { Width = 90, Height = 24, TextSize = 12 })
			end
		end
		if (offer.Money or 0) > 0 then
			UI.label(card, "💰 " .. money(offer.Money), { TextSize = 13, Color = T.Gold, Font = Enum.Font.GothamBold })
		end
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local t = tradeState()
		local s = UI.scroll(container, { Pad = 6 })
		if t.Status == "pending" then
			UI.title(s, "🤝 Solicitud de intercambio")
			if t.Incoming then
				UI.label(s, t.Partner.Name .. " quiere intercambiar objetos o dinero contigo.", { TextSize = 14 })
				local row = UI.row(s, 34)
				UI.button(row, "✅ Aceptar", function()
					Net.call("Trade.Accept", {})
				end, { Width = 140, Color = T.Ok })
				UI.button(row, "✖ Rechazar", function()
					Net.call("Trade.Cancel", {})
				end, { Width = 140 })
			else
				UI.label(s, "Esperando a que " .. t.Partner.Name .. " acepte... (la solicitud caduca en " .. MarketData.TradeRequestSeconds .. " s)", { TextSize = 14, Color = T.Sub })
				UI.button(s, "Cancelar solicitud", function()
					Net.call("Trade.Cancel", {})
				end, { Width = 180 })
			end
			return
		elseif t.Status == "open" then
			UI.title(s, "🤝 Intercambio con " .. t.Partner.Name)
			UI.label(s, "Cualquier cambio en una oferta anula las confirmaciones. El servidor comprueba todo otra vez al final: si algo ya no está, no se transfiere nada. Quedaos a menos de " .. MarketData.TradeLeaveRadius .. " studs.", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			offerCard(s, "📤 Tu oferta", t.Mine, true, t.MyConfirmed)
			offerCard(s, "📥 Oferta de " .. t.Partner.Name, t.Theirs, false, t.TheirConfirmed)
			local mrow = UI.row(s, 34)
			local box = UI.input(mrow, "Dinero que ofreces", tostring(t.Mine.Money or 0), { Size = UDim2.new(0, 160, 0, 30) })
			UI.button(mrow, "💰 Ofrecer dinero", function()
				Net.call("Trade.SetMoney", { amount = tonumber(box.Text) or 0 }, { quietOk = true })
			end, { Width = 160, Height = 30, TextSize = 12 })
			local row = UI.row(s, 38)
			UI.button(row, t.MyConfirmed and "✅ Confirmado" or "✅ Confirmar intercambio", function()
				Net.call("Trade.Confirm", { version = t.Version })
			end, { Width = 220, Height = 34, Color = t.MyConfirmed and T.Panel3 or T.Ok })
			UI.button(row, "✖ Cancelar", function()
				Net.call("Trade.Cancel", {})
			end, { Width = 140, Height = 34, Color = Color3.fromRGB(110, 40, 40) })
			UI.title(s, "➕ Añadir objetos (máx. " .. (t.MaxItems or MarketData.TradeMaxItems) .. ")")
			local offered = {}
			for _, it in ipairs(t.Mine.Items) do
				if it.Uid then
					offered[it.Uid] = true
				end
			end
			local items = State.items(function(rec, def, uid)
				return not locked(rec) and not offered[uid]
			end)
			for _, it in ipairs(items) do
				local r = UI.row(s, 28)
				UI.label(r, it.Def.Name .. (it.Def.Collectible and " ⭐" or "") .. " · " .. math.floor(it.Rec.Cond) .. "%", { Size = UDim2.new(1, -110, 1, 0), TextSize = 12 })
				UI.button(r, "➕ Añadir", function()
					Net.call("Trade.AddItem", { uid = it.Uid }, { quietOk = true })
				end, { Width = 90, Height = 24, TextSize = 12, Color = T.Accent2 })
			end
			return
		end
		UI.title(s, "🤝 Intercambio con otros jugadores")
		UI.label(s, "Acércate a otro jugador (menos de " .. MarketData.TradeRadius .. " studs) y proponle un intercambio. Cada uno ofrece hasta " .. MarketData.TradeMaxItems
			.. " objetos y dinero; solo se completa cuando los dos confirman. No se pueden dar objetos instalados, colocados, prestados ni tu único teléfono.", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		if t.Last then
			UI.label(s, "Último: " .. tostring(t.Last.Msg), { TextSize = 12, Color = t.Last.Status == "done" and T.Ok or T.Warn, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		UI.button(s, "🔄 Buscar jugadores cercanos", function()
			nearby = nil
			render()
			scan()
		end, { Width = 240 })
		if nearby == nil then
			UI.label(s, "Buscando...", { Color = T.Sub })
		elseif #nearby == 0 then
			UI.label(s, "No hay nadie cerca. Queda con un amigo en el mismo sitio y vuelve a buscar.", { Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		else
			for _, p in ipairs(nearby) do
				local row = UI.row(s, 32)
				UI.label(row, "👤 " .. p.name .. " · a " .. p.dist .. " studs" .. (p.busy and " · ocupado" or ""), { Size = UDim2.new(1, -200, 1, 0), TextSize = 13 })
				UI.button(row, "🤝 Proponer intercambio", function()
					Net.call("Trade.Request", { userId = p.userId })
				end, { Width = 190, Height = 28, TextSize = 12, Color = T.Ok })
			end
		end
	end
	render()
	scan()
	ctx.onState(render)
	listenerId = listenerId + 1
	local myId = listenerId
	tradeListeners[myId] = function()
		if container.Parent then
			render()
		end
	end
	ctx.cleanup = function()
		tradeListeners[myId] = nil
	end
end
table.insert(apps, TradeApp)

return apps
