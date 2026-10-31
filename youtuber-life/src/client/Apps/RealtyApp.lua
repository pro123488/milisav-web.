--!nonstrict
-- App Inmobiliaria: mercado con filtros (precio, tamaño, distrito, calidad, tipo y características),
-- contratos de alquiler, compra, venta, mudanzas, deudas y mejoras de tus propiedades.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local PropertyData = require(Shared.PropertyData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)
local T = UI.Theme

local Realty = { Id = "realty", Name = "Inmobiliaria", Icon = "🏘", Order = 6, Surfaces = { pc = true, phone = true, panel = true }, Width = 940, Height = 580 }

function Realty.build(container, ctx)
	local tab = "market"
	local f = { kind = 1, price = 1, size = 1, district = 1, env = 1, pool = false, studio = false, view = false }
	local selected = ctx.params.listing
	local kinds = { "Todos", "Vivienda", "Estudio", "Negocio", "Garaje", "Terreno" }
	local kindKeys = { false, "home", "studio", "business", "garage", "land" }
	local prices = { "Cualquier precio", "Hasta $1.000/sem o $25.000", "Hasta $2.000/sem o $100.000", "Sin límite" }
	local priceRent = { math.huge, 1000, 2000, math.huge }
	local priceBuy = { math.huge, 25000, 100000, math.huge }
	local sizes = { "Cualquier tamaño", "Más de 1.000 m²", "Más de 2.000 m²", "Más de 3.000 m²" }
	local sizeMin = { 0, 1000, 2000, 3000 }
	local envs = { "Cualquier calidad", "Entorno 60+", "Entorno 75+", "Entorno 90+" }
	local envMin = { 0, 60, 75, 90 }
	local districts = { "Todos los distritos" }
	local districtIds = { false }
	for _, l in ipairs(PropertyData.Listings) do
		local d = WorldData.DistrictById[l.District]
		if not Util.indexOf(districtIds, l.District) then
			districts[#districts + 1] = d.Name
			districtIds[#districtIds + 1] = l.District
		end
	end

	local render
	local function detail(parent, l)
		local data = State.Data
		local rec = data.Properties[l.Id]
		local card = UI.card(parent, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, l.Name, { Font = Enum.Font.GothamBlack, TextSize = 16, Height = 22 })
		UI.label(card, l.Type .. " · " .. PropertyData.Kinds[l.Kind] .. " · " .. WorldData.DistrictById[l.District].Name, { TextSize = 12, Color = T.Sub })
		UI.label(card, (l.Rent and ("Alquiler $" .. Util.formatInt(l.Rent) .. "/sem") or "No se alquila") .. "  ·  " .. (l.Buy and ("Compra $" .. Util.formatInt(l.Buy)) or "No se vende"), { Font = Enum.Font.GothamBold, Color = T.Gold })
		UI.label(card, "Mantenimiento $" .. l.Upkeep .. "/sem (si es tuya) · Reventa " .. math.floor(l.Resale * 100) .. "%", { TextSize = 12 })
		UI.label(card, "Superficie " .. Util.formatInt(l.W * l.D) .. " m² · " .. l.Slots .. " muebles · almacena " .. l.Storage .. " objetos", { TextSize = 12 })
		UI.label(card, "Entorno " .. l.Env .. "/100 · Bonus de grabación +" .. l.Studio .. (l.View and (" · " .. l.View) or "") .. (l.Pool and " · Piscina" or "") .. (l.Remodel and " · Remodelable" or " · No remodelable"), { TextSize = 12 })
		local req = {}
		if (l.Req.Level or 1) > 1 then
			req[#req + 1] = "nivel " .. l.Req.Level
		end
		if (l.Req.Subs or 0) > 0 then
			req[#req + 1] = Util.formatInt(l.Req.Subs) .. " suscriptores"
		end
		if #req > 0 then
			UI.label(card, "Requisitos: " .. table.concat(req, ", "), { TextSize = 12, Color = (data.Level >= (l.Req.Level or 1) and data.Channel.Subs >= (l.Req.Subs or 0)) and T.Ok or T.Err })
		end
		if l.Rent then
			UI.label(card, "📄 Contrato simulado: pagas la primera semana + fianza ($" .. Util.formatInt(l.Rent * 2) .. "). Cada 7 días jugados se cobra el alquiler. Impago = recargo del 10%; tras 3 impagos se rescinde el contrato y tus muebles vuelven a tu inventario. La fianza se devuelve al terminar sin deudas.", { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		local row = UI.row(card, 34, nil, 6)
		if not rec then
			if l.Rent then
				UI.button(row, "📄 Alquilar", function()
					Notify.confirm("¿Firmar el contrato de alquiler de «" .. l.Name .. "» por $" .. Util.formatInt(l.Rent * 2) .. " (semana + fianza)?", function()
						Net.call("Prop.Rent", { id = l.Id })
					end, "Firmar")
				end, { Width = 120, Color = T.Accent2 })
			end
			if l.Buy then
				UI.button(row, "🔑 Comprar", function()
					Notify.confirm("¿Comprar «" .. l.Name .. "» por $" .. Util.formatInt(l.Buy) .. "?", function()
						Net.call("Prop.Buy", { id = l.Id })
					end, "Comprar")
				end, { Width = 120, Color = T.Ok })
			end
		end
		UI.button(row, "🚕 Ir a verla", function()
			Net.call("Prop.Go", { id = l.Id })
		end, { Width = 130 })
		return card
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local d = data.Derived
		local top = UI.row(container, 34)
		UI.button(top, "🏘 Mercado", function()
			tab = "market"
			render()
		end, { Width = 120, Height = 28, Color = tab == "market" and T.Accent or T.Panel3 })
		UI.button(top, "🔑 Mis propiedades (" .. State.count(data.Properties) .. "/" .. d.MaxProps .. ")", function()
			tab = "mine"
			render()
		end, { Width = 210, Height = 28, Color = tab == "mine" and T.Accent or T.Panel3 })
		UI.label(top, "📦 Almacenaje " .. d.Stored .. "/" .. d.StorageCap .. " · 💰 $" .. Util.formatInt(data.Money), { Size = UDim2.fromOffset(300, 28), TextSize = 12, Color = T.Sub })
		local body = UI.frame(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Transparency = 1, Radius = false })
		if tab == "mine" then
			local s = UI.scroll(body, { Pad = 6 })
			UI.label(s, "🏠 Vives en: " .. (data.HomeProperty ~= "" and PropertyData.ById[data.HomeProperty].Name or "Residencia Económica (habitación alquilada)"), { Font = Enum.Font.GothamBold })
			if data.HomeProperty ~= "" then
				UI.button(s, "Volver a la Residencia Económica", function()
					Net.call("Prop.MoveIn", { id = "" })
				end, { Width = 280, Height = 28, TextSize = 12 })
			end
			if next(data.Properties) == nil then
				UI.label(s, "Aún no tienes propiedades. Puedes alquilar antes de tener dinero para comprar.", { Color = T.Sub })
			end
			for id, rec in pairs(data.Properties) do
				local l = PropertyData.ById[id]
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = rec.Debt > 0 and Color3.fromRGB(80, 40, 40) or T.Panel2 })
				UI.label(card, (rec.Mode == "own" and "🔑 " or "📄 ") .. l.Name .. (data.HomeProperty == id and "  · 🏠 tu hogar" or ""), { Font = Enum.Font.GothamBold })
				local due = math.max(0, rec.NextDue - data.Home.PlayDays)
				UI.label(card, (rec.Mode == "own" and ("Propia · mantenimiento $" .. l.Upkeep) or ("Alquiler $" .. l.Rent .. " · fianza $" .. rec.Deposit)) .. " · próximo pago en " .. due .. " días · muebles " .. State.count(rec.Placed) .. "/" .. l.Slots, { TextSize = 12, Color = T.Sub })
				local ups = {}
				for key in pairs(rec.Upgrades) do
					ups[#ups + 1] = PropertyData.Upgrades[key].Name
				end
				if #ups > 0 then
					UI.label(card, "Mejoras: " .. table.concat(ups, ", "), { TextSize = 12, Color = T.Ok })
				end
				if rec.Debt > 0 then
					UI.label(card, "⚠ Deuda: $" .. Util.formatInt(rec.Debt) .. " (" .. rec.Missed .. " impagos)", { TextSize = 12, Color = T.Err })
				end
				local row = UI.row(card, 32, nil, 4)
				UI.button(row, "🚕 Ir", function()
					Net.call("Prop.Go", { id = id })
				end, { Width = 70, Height = 28, TextSize = 12 })
				if data.HomeProperty ~= id and (l.Kind == "home" or l.Kind == "studio") then
					UI.button(row, "🏠 Vivir aquí", function()
						Net.call("Prop.MoveIn", { id = id })
					end, { Width = 110, Height = 28, TextSize = 12 })
				end
				if rec.Debt > 0 then
					UI.button(row, "Pagar deuda", function()
						Net.call("Prop.PayDebt", { id = id })
					end, { Width = 110, Height = 28, TextSize = 12, Color = T.Accent })
				end
				if rec.Mode == "rent" then
					if l.Buy then
						UI.button(row, "🔑 Comprar ($" .. Util.formatInt(l.Buy) .. ")", function()
							Net.call("Prop.Buy", { id = id })
						end, { Width = 170, Height = 28, TextSize = 12, Color = T.Ok })
					end
					UI.button(row, "Terminar contrato", function()
						Notify.confirm("¿Terminar el alquiler de «" .. l.Name .. "»? Tus muebles volverán al inventario y se devolverá la fianza si no hay deudas.", function()
							Net.call("Prop.EndRent", { id = id })
						end)
					end, { Width = 150, Height = 28, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
				else
					UI.button(row, "Vender ($" .. Util.formatInt(math.floor(l.Buy * l.Resale + (rec.Spent or 0) * 0.5 - rec.Debt)) .. ")", function()
						Notify.confirm("¿Vender «" .. l.Name .. "»? Tus muebles volverán al inventario.", function()
							Net.call("Prop.Sell", { id = id })
						end, "Vender")
					end, { Width = 170, Height = 28, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
				end
				local urow = UI.frame(card, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
				UI.grid(urow, 210, 28, 4)
				for key, up in pairs(PropertyData.Upgrades) do
					if not rec.Upgrades[key] then
						UI.button(urow, "+ " .. up.Name .. " $" .. Util.formatInt(up.Cost), function()
							Notify.confirm(up.Name .. ": " .. up.Desc .. " ¿Instalar por $" .. Util.formatInt(up.Cost) .. "?", function()
								Net.call("Prop.Upgrade", { id = id, key = key })
							end)
						end, { Size = UDim2.fromOffset(210, 28), TextSize = 11 })
					end
				end
			end
			return
		end
		-- Mercado con filtros
		local narrow = ctx.kind == "phone"
		local filters = UI.scroll(body, { Size = narrow and UDim2.new(1, 0, 0, 120) or UDim2.new(0, 330, 1, 0), Color = T.Panel2, Transparency = 0, Pad = 2 })
		UI.cycle(filters, "Tipo", kinds, f.kind, function(i)
			f.kind = i
			render()
		end, { LabelWidth = 70, ValueWidth = 150 })
		UI.cycle(filters, "Precio", prices, f.price, function(i)
			f.price = i
			render()
		end, { LabelWidth = 70, ValueWidth = 150 })
		UI.cycle(filters, "Tamaño", sizes, f.size, function(i)
			f.size = i
			render()
		end, { LabelWidth = 70, ValueWidth = 150 })
		UI.cycle(filters, "Distrito", districts, f.district, function(i)
			f.district = i
			render()
		end, { LabelWidth = 70, ValueWidth = 150 })
		UI.cycle(filters, "Calidad", envs, f.env, function(i)
			f.env = i
			render()
		end, { LabelWidth = 70, ValueWidth = 150 })
		UI.toggle(filters, "Con piscina", f.pool, function(v)
			f.pool = v
			render()
		end)
		UI.toggle(filters, "Bueno para grabar (+8)", f.studio, function(v)
			f.studio = v
			render()
		end)
		UI.toggle(filters, "Con vistas", f.view, function(v)
			f.view = v
			render()
		end)
		local list = UI.scroll(body, { Size = narrow and UDim2.new(1, 0, 1, -126) or UDim2.new(1, -340, 1, 0), Position = narrow and UDim2.fromOffset(0, 126) or UDim2.fromOffset(340, 0), Pad = 6 })
		if selected and PropertyData.ById[selected] then
			detail(list, PropertyData.ById[selected])
			UI.button(list, "◀ Ver todos los anuncios", function()
				selected = nil
				render()
			end, { Width = 220, Height = 28 })
			return
		end
		local count = 0
		for _, l in ipairs(PropertyData.Listings) do
			local ok = true
			if kindKeys[f.kind] and l.Kind ~= kindKeys[f.kind] then
				ok = false
			end
			if (l.Rent or math.huge) > priceRent[f.price] and (l.Buy or math.huge) > priceBuy[f.price] and f.price > 1 and f.price < 4 then
				ok = false
			end
			if l.W * l.D < sizeMin[f.size] then
				ok = false
			end
			if districtIds[f.district] and l.District ~= districtIds[f.district] then
				ok = false
			end
			if l.Env < envMin[f.env] then
				ok = false
			end
			if f.pool and not l.Pool then
				ok = false
			end
			if f.studio and l.Studio < 8 then
				ok = false
			end
			if f.view and not l.View then
				ok = false
			end
			if ok then
				count = count + 1
				local mine = data.Properties[l.Id]
				local b = UI.button(list, (mine and "✔ " or "") .. l.Name .. "\n" .. (l.Rent and ("$" .. Util.formatInt(l.Rent) .. "/sem") or "—") .. "  ·  " .. (l.Buy and ("$" .. Util.formatInt(l.Buy)) or "—") .. "  ·  " .. Util.formatInt(l.W * l.D) .. " m²  ·  entorno " .. l.Env .. ((l.Req.Level or 1) > data.Level and ("  · 🔒 nivel " .. l.Req.Level) or ""), function()
					selected = l.Id
					render()
				end, { Size = UDim2.new(1, -8, 0, 46), TextSize = 12, Color = mine and Color3.fromRGB(40, 80, 60) or T.Panel2 })
				b.TextXAlignment = Enum.TextXAlignment.Left
			end
		end
		if count == 0 then
			UI.label(list, "Ningún anuncio cumple los filtros.", { Color = T.Sub })
		end
	end
	render()
	ctx.onState(render)
end

return Realty
