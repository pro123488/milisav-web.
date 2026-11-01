--!nonstrict
-- App Vehículos: concesionario (comprar o alquilar con color), garaje (sacar, guardar, repostar/cargar,
-- taller, mejoras, pintura y venta) y cómo funciona el maletero.
-- Todas las acciones las valida el servidor (VehicleService): aquí solo se muestran datos y se piden acciones.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local LifeData = require(Shared.LifeData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)
local T = UI.Theme

local App = { Id = "vehicles", Name = "Vehículos", Icon = "🚗", Order = 10, Surfaces = { pc = true, phone = true, panel = true }, Width = 900, Height = 580 }

local function kmh(speed)
	return math.floor(speed * LifeData.KmhPerStud + 0.5)
end

local function colorName(i)
	local c = LifeData.VehicleColors[i] or LifeData.VehicleColors[1]
	return c[1]
end

local function colorNames()
	local out = {}
	for i, c in ipairs(LifeData.VehicleColors) do
		out[i] = c[1]
	end
	return out
end

-- ¿Estoy cerca de un edificio de cierto tipo? (solo para mostrar avisos; el servidor lo comprueba de verdad)
local function nearSpecial(kind, radius)
	local char = Players.LocalPlayer and Players.LocalPlayer.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == kind then
			local dx, dz = root.Position.X - sp.WX, root.Position.Z - sp.WZ
			if dx * dx + dz * dz <= radius * radius then
				return sp
			end
		end
	end
	return nil
end

local function specialNames(kind)
	local out = {}
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == kind then
			local d = WorldData.DistrictById[sp.District]
			out[#out + 1] = (sp.Name or kind) .. (d and (" (" .. d.Name .. ")") or "")
		end
	end
	return out
end

local function fuelText(def, rec)
	if def.Fuel == "none" then
		return "🚲 Sin combustible"
	end
	return (def.Fuel == "battery" and "🔋 Batería " or "⛽ Combustible ") .. math.floor(rec.Fuel + 0.5) .. "%"
end

local function upgradesText(rec)
	local list = {}
	for _, key in ipairs(LifeData.UpgradeOrder) do
		if rec.Upgrades and rec.Upgrades[key] then
			list[#list + 1] = LifeData.VehicleUpgrades[key].Name
		end
	end
	return #list > 0 and table.concat(list, ", ") or "ninguna"
end

local function sortedIds(vehicles)
	local ids = {}
	for id in pairs(vehicles or {}) do
		ids[#ids + 1] = id
	end
	table.sort(ids, function(a, b)
		local na, nb = tonumber(a:match("%d+")) or 0, tonumber(b:match("%d+")) or 0
		if na == nb then
			return a < b
		end
		return na < nb
	end)
	return ids
end

function App.build(container, ctx)
	local data0 = State.Data
	local owned = data0 and data0.Vehicles and next(data0.Vehicles) ~= nil
	local tab = ctx.params.tab or ((owned and not nearSpecial("dealer", 45)) and "garage" or "dealer")
	local color = 1
	local paint = {} -- [id] = índice de color elegido para pintar

	local render
	local function act(action, payload)
		Net.call(action, payload)
		render()
	end

	-- Una ficha del garaje (propio o alquilado)
	local function vehicleCard(s, id, rec, data, rental)
		local def = LifeData.VehicleById[rec.Model]
		if not def then
			return
		end
		local st = LifeData.vehicleStats(rec)
		local out = data.Derived and data.Derived.VehicleOut == id
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, (rental and "🔑 Alquiler · " or "") .. def.Name .. " · " .. def.Type .. " · " .. colorName(rec.Color) .. (out and "  ·  🟢 En la calle" or "  ·  🅿 En el garaje"),
			{ Font = Enum.Font.GothamBold, TextSize = 14, Color = out and T.Ok or T.Text })
		UI.label(card, fuelText(def, rec) .. "   ·   🔧 Estado " .. math.floor(rec.Cond + 0.5) .. "%   ·   📏 " .. string.format("%.1f", (rec.Odo or 0) / 1000) .. " km   ·   🏁 " .. kmh(st.Speed) .. " km/h   ·   📦 Maletero +" .. st.Trunk,
			{ TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
		if def.Fuel ~= "none" then
			UI.progress(card, rec.Fuel / 100, rec.Fuel < 15 and T.Err or (rec.Fuel < 35 and T.Warn or T.Ok), { Height = 6 })
		end
		if rental then
			UI.label(card, "Alquilado hasta el día " .. tostring(data.Rental.Until) .. ". Al terminar vuelve solo al concesionario.", { TextSize = 12, Color = T.Sub })
		else
			UI.label(card, "Mejoras: " .. upgradesText(rec) .. "   ·   Valor de venta: $" .. Util.formatInt(LifeData.sellValue(rec)), { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		-- Acciones principales
		local row = UI.row(card, 30)
		if out then
			UI.button(row, "🅿 Guardar", function()
				act("Veh.Store", {})
			end, { Width = 110, Height = 26, TextSize = 12 })
		else
			UI.button(row, "🚗 Sacar", function()
				act("Veh.Spawn", { id = id })
			end, { Width = 110, Height = 26, TextSize = 12, Color = T.Ok })
		end
		if def.Fuel ~= "none" then
			local cost = LifeData.fuelCost(def, rec)
			UI.button(row, (def.Fuel == "battery" and "🔋 Cargar $" or "⛽ Repostar $") .. cost, function()
				act("Veh.Refuel", { id = id })
			end, { Width = 140, Height = 26, TextSize = 12, Color = rec.Fuel < 35 and T.Warn or T.Panel3 })
		end
		UI.button(row, "🔧 Taller $" .. Util.formatInt(LifeData.repairCost(def, rec)), function()
			act("Veh.Repair", { id = id })
		end, { Width = 130, Height = 26, TextSize = 12, Color = rec.Cond < 60 and T.Warn or T.Panel3 })
		if rental then
			return
		end
		UI.button(row, "💰 Vender", function()
			Notify.confirm("¿Vender " .. def.Name .. " por $" .. Util.formatInt(LifeData.sellValue(rec)) .. "? Depende del estado y de las mejoras.", function()
				act("Veh.Sell", { id = id })
			end, "Vender")
		end, { Width = 100, Height = 26, TextSize = 12, Color = T.Err })
		-- Mejoras
		local ups = UI.row(card, 30)
		UI.label(ups, "⚙ Mejoras:", { Size = UDim2.fromOffset(80, 26), TextSize = 12, Color = T.Sub })
		for _, key in ipairs(LifeData.UpgradeOrder) do
			local up = LifeData.VehicleUpgrades[key]
			local has = rec.Upgrades and rec.Upgrades[key]
			UI.button(ups, has and ("✔ " .. up.Name) or (up.Name .. " $" .. Util.formatInt(LifeData.upgradeCost(def, key))), function()
				act("Veh.Upgrade", { id = id, key = key })
			end, { Width = 200, Height = 26, TextSize = 11, Color = has and T.Ok or T.Accent2, Disabled = has })
		end
		-- Pintura
		paint[id] = paint[id] or rec.Color
		UI.cycle(card, "🎨 Pintura ($" .. LifeData.PaintCost .. ")", colorNames(), paint[id], function(i)
			paint[id] = i
		end, { LabelWidth = 130, ValueWidth = 110 })
		UI.button(card, "🎨 Pintar", function()
			act("Veh.Paint", { id = id, color = paint[id] })
		end, { Width = 110, Height = 26, TextSize = 12 })
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local top = UI.row(container, 34)
		for _, t in ipairs({ { "dealer", "🏪 Concesionario" }, { "garage", "🔑 Mi garaje" }, { "help", "📦 Maletero y consejos" } }) do
			UI.button(top, t[2], function()
				tab = t[1]
				render()
			end, { Width = 170, Height = 28, Color = tab == t[1] and T.Accent or T.Panel3 })
		end
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 6 })
		local vehicles = data.Vehicles or {}
		local count = State.count(vehicles)
		local rentalOn = data.Rental and data.Rental.Rec and (data.Derived.Day or 0) <= (data.Rental.Until or 0)
		if tab == "dealer" then
			local dealer = nearSpecial("dealer", 45)
			if dealer then
				UI.label(s, "📍 Estás en el " .. dealer.Name .. ". Compra, alquila, instala mejoras o pinta tu vehículo.", { TextSize = 13, Color = T.Ok, Height = 0, Auto = Enum.AutomaticSize.Y })
			else
				UI.label(s, "Para comprar o alquilar ve al " .. table.concat(specialNames("dealer"), ", ") .. ". Usa el taxi (app Mapa) si está lejos.", { TextSize = 13, Color = T.Warn, Height = 0, Auto = Enum.AutomaticSize.Y })
			end
			UI.label(s, "💰 $" .. Util.formatInt(data.Money) .. "   ·   Nivel " .. data.Level .. "   ·   Garaje " .. count .. "/" .. LifeData.MaxVehicles, { Font = Enum.Font.GothamBold })
			local swatchRow = UI.row(s, 32)
			local swatch
			UI.cycle(swatchRow, "Color", colorNames(), color, function(i)
				color = i
				if swatch then
					swatch.BackgroundColor3 = UI.rgb(LifeData.VehicleColors[i][2])
				end
			end, { LabelWidth = 60, ValueWidth = 110 })
			swatch = UI.frame(swatchRow, { Size = UDim2.fromOffset(40, 24), Color = UI.rgb(LifeData.VehicleColors[color][2]) })
			for _, def in ipairs(LifeData.Vehicles) do
				local locked = data.Level < def.Level
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, def.Name .. " · " .. def.Type .. (locked and ("  🔒 nivel " .. def.Level) or ""), { Font = Enum.Font.GothamBold, TextSize = 14, Color = locked and T.Sub or T.Text })
				local fuel = LifeData.FuelNames[def.Fuel] .. (def.Fuel ~= "none" and (" (consumo " .. def.Use .. ")") or "")
				UI.label(card, "$" .. Util.formatInt(def.Price) .. "   ·   🏁 " .. kmh(def.Speed) .. " km/h   ·   ↪ Giro " .. def.Turn .. "   ·   📦 Maletero +" .. def.Trunk .. "   ·   " .. fuel .. "   ·   Nivel " .. def.Level,
					{ TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
				local row = UI.row(card, 30)
				UI.button(row, "Comprar $" .. Util.formatInt(def.Price), function()
					local r = Net.call("Veh.Buy", { model = def.Id, color = color })
					if r.ok then
						tab = "garage"
					end
					render()
				end, { Width = 150, Height = 26, TextSize = 12, Color = (not locked and data.Money >= def.Price) and T.Ok or T.Panel3 })
				UI.button(row, "Alquilar 1 día $" .. Util.formatInt(LifeData.rentPrice(def)), function()
					act("Veh.Rent", { model = def.Id, color = color })
				end, { Width = 170, Height = 26, TextSize = 12, Color = locked and T.Panel3 or T.Accent2 })
			end
		elseif tab == "garage" then
			UI.label(s, "📦 El maletero amplía tu mochila mientras estás cerca de tu vehículo (a menos de 30 studs): así transportas más equipo para grabar fuera." ..
				((data.Derived.TrunkBonus or 0) > 0 and ("  Ahora: +" .. data.Derived.TrunkBonus .. " espacios.") or ""),
				{ TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			if data.Derived.VehicleOut then
				UI.button(s, "🅿 Guardar el vehículo que está en la calle", function()
					act("Veh.Store", {})
				end, { Width = 320, Height = 28, TextSize = 12 })
			end
			if rentalOn then
				vehicleCard(s, "rental", data.Rental.Rec, data, true)
			end
			local ids = sortedIds(vehicles)
			if #ids == 0 and not rentalOn then
				UI.label(s, "Aún no tienes vehículos. Cómpralos o alquílalos en el concesionario.", { Color = T.Sub, Height = 30 })
				UI.button(s, "🏪 Ver el concesionario", function()
					tab = "dealer"
					render()
				end, { Width = 220, Height = 28 })
			end
			for _, id in ipairs(ids) do
				vehicleCard(s, id, vehicles[id], data, false)
			end
		else
			UI.title(s, "📦 Maletero")
			UI.label(s, "Cada vehículo tiene un maletero (bicicleta 0, moto +1, coche +4, furgoneta +10, camión +16). Mientras estés cerca de tu vehículo, la mochila gana esos espacios: carga trípodes, luces y cámaras de sobra para grabar en cualquier distrito. La mejora «Maletero ampliado» añade +3.",
				{ TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(s, "Mochila ahora: " .. (data.Derived.BackpackUsed or 0) .. "/" .. (data.Derived.BackpackCap or 0) .. ((data.Derived.TrunkBonus or 0) > 0 and (" (incluye +" .. data.Derived.TrunkBonus .. " del maletero)") or ""), { Font = Enum.Font.GothamBold, Color = T.Gold })
			UI.title(s, "🚗 Conducir")
			UI.label(s, "Saca tu vehículo en la calle desde Mi garaje y siéntate (E). W/S acelera y frena, A/D gira y Espacio para bajar. Cada modelo tiene su velocidad, giro y consumo.",
				{ TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.title(s, "⛽ Combustible, batería y taller")
			UI.label(s, "Conducir gasta combustible o batería y desgasta el vehículo. Sin combustible irás muy despacio. Reposta o carga en: " .. table.concat(specialNames("gas"), ", ") .. ". Los eléctricos también se cargan desde casa. Con el estado por debajo del 40 % pierdes velocidad: pasa por el taller.",
				{ TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.title(s, "🔑 Alquiler")
			UI.label(s, "¿Aún no te llega para comprarlo? Alquílalo un día en el concesionario. Al terminar el alquiler vuelve solo.",
				{ TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(s, "Kilómetros conducidos: " .. string.format("%.1f", (data.Counters.drive_m or 0) / 1000) .. " km · Vehículos comprados: " .. (data.Counters.vehicles_bought or 0), { TextSize = 12, Color = T.Sub })
		end
	end
	render()
	ctx.onState(render)
end

return App
