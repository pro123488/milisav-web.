--!nonstrict
-- App Comida: menú del lugar donde estás (restaurante, cafetería, máquina), cocina con recetas,
-- comida a domicilio y despensa.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local FoodData = require(Shared.FoodData)
local Catalog = require(Shared.ItemCatalog)
local T = UI.Theme

local Food = { Id = "food", Name = "Comida", Icon = "🍽", Order = 9, Surfaces = { pc = true, phone = true, panel = true }, Width = 720, Height = 540 }

function Food.build(container, ctx)
	local tab = ctx.params.tab or (ctx.params.place and "menu" or "pantry")
	local place = ctx.params.place
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local n = data.Needs or { Energy = 100, Mood = 70 }
		local top = UI.row(container, 34)
		local tabs = { { "pantry", "🧺 Despensa" }, { "cook", "👨‍🍳 Cocinar" }, { "delivery", "🛵 Domicilio" } }
		if place then
			table.insert(tabs, 1, { "menu", "📜 Menú" })
		end
		for _, t in ipairs(tabs) do
			UI.button(top, t[2], function()
				tab = t[1]
				render()
			end, { Width = 120, Height = 28, Color = tab == t[1] and T.Accent or T.Panel3 })
		end
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 6 })
		UI.label(s, "⚡ Energía " .. math.floor(n.Energy) .. "/100 · 😊 Ánimo " .. math.floor(n.Mood) .. "/100 · 💰 $" .. data.Money, { Font = Enum.Font.GothamBold })
		UI.progress(s, n.Energy / 100, T.Ok, { Height = 8 })
		UI.label(s, "Efecto moderado: con poca energía las escenas son algo menos interesantes y exportas más despacio. Con buen ánimo, tus escenas y directos mejoran un poco.", { TextSize = 11, Color = T.Sub, Height = 30 })
		if tab == "menu" and place then
			local menu = FoodData.Menus[place]
			UI.title(s, menu.Name)
			for _, it in ipairs(menu.Items) do
				local row = UI.row(s, 32)
				UI.label(row, it[2] .. " · energía +" .. it[4] .. " · ánimo +" .. it[5], { Size = UDim2.new(1, -110, 1, 0), TextSize = 13 })
				UI.button(row, "$" .. it[3], function()
					Net.call("Food.Order", { place = place, item = it[1] })
				end, { Width = 90, Height = 28, Color = T.Ok })
			end
		elseif tab == "cook" then
			UI.label(s, "Cocina en tu casa (nevera de la habitación o cocina de tu propiedad). Los ingredientes se compran en el Supermercado Fresco (Distrito de restaurantes) o online.", { TextSize = 12, Color = T.Sub, Height = 36 })
			local have = {}
			for _, rec in pairs(data.Inventory) do
				if rec.Loc == "home" or rec.Loc == "backpack" then
					have[rec.Id] = (have[rec.Id] or 0) + 1
				end
			end
			for _, r in ipairs(FoodData.Recipes) do
				local meal = Catalog.get(r.Id)
				local parts, ok = {}, true
				for _, need in ipairs(r.Needs) do
					local has = (have[need] or 0) > 0
					ok = ok and has
					parts[#parts + 1] = (has and "✔ " or "✖ ") .. Catalog.get(need).Name
				end
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, meal.Name .. " · energía +" .. meal.Stats.Energy .. " · ánimo +" .. meal.Stats.Mood, { Font = Enum.Font.GothamBold, TextSize = 13 })
				UI.label(card, table.concat(parts, "  "), { TextSize = 12, Color = ok and T.Ok or T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.button(card, "Cocinar", function()
					Net.call("Food.Cook", { recipe = r.Id })
				end, { Width = 100, Height = 26, Color = ok and T.Accent2 or T.Panel3 })
			end
		elseif tab == "delivery" then
			UI.label(s, "Llega a tu casa en " .. FoodData.Delivery.Seconds .. " s · envío $" .. FoodData.Delivery.Fee, { TextSize = 12, Color = T.Sub })
			for _, id in ipairs(FoodData.Delivery.Items) do
				local def = Catalog.get(id)
				local row = UI.row(s, 32)
				UI.label(row, def.Name .. " · energía +" .. def.Stats.Energy .. " · ánimo +" .. def.Stats.Mood, { Size = UDim2.new(1, -110, 1, 0), TextSize = 13 })
				UI.button(row, "$" .. (FoodData.Delivery.Prices[id] + FoodData.Delivery.Fee), function()
					Net.call("Food.Delivery", { item = id })
				end, { Width = 90, Height = 28, Color = T.Ok })
			end
			for _, o in ipairs(data.FoodOrders or {}) do
				UI.label(s, "🛵 " .. Catalog.get(o.Item).Name .. " llega en " .. math.max(0, math.ceil(o.Eta - workspace:GetServerTimeNow())) .. " s", { TextSize = 12, Color = T.Gold })
			end
		else
			local items = State.items(function(rec, def)
				return def.Cat == "food" and (rec.Loc == "home" or rec.Loc == "backpack")
			end)
			if #items == 0 then
				UI.label(s, "La despensa está vacía. Compra en el supermercado, cocina o pide a domicilio.", { Color = T.Sub, Height = 30 })
			end
			for _, it in ipairs(items) do
				local row = UI.row(s, 30)
				UI.label(row, it.Def.Name .. " · ⚡+" .. it.Def.Stats.Energy .. " 😊+" .. it.Def.Stats.Mood, { Size = UDim2.new(1, -100, 1, 0), TextSize = 13 })
				UI.button(row, "🍽 Comer", function()
					Net.call("Food.Eat", { uid = it.Uid })
				end, { Width = 90, Height = 26, TextSize = 12, Color = T.Ok })
			end
		end
	end
	render()
	ctx.onState(render)
end

return Food
