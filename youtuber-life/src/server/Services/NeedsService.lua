--!nonstrict
-- NeedsService: energía y ánimo con efectos MODERADOS (nunca bloquean el juego).
--  * La energía baja despacio mientras juegas y al grabar, trabajar o emitir.
--  * Comer (supermercado, restaurante, cafetería, máquinas, cocina, domicilio) y descansar la recuperan.
--  * Energía < 25: escenas algo menos interesantes y exportaciones un 15% más lentas.
--  * Ánimo alto (> 80): escenas algo más interesantes y directos más animados.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local FoodData = require(Shared.FoodData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Needs = {}
local S
local lastRest = {}
local warned = {}

function Needs.Init(services)
	S = services
end

local function needs(data)
	data.Needs = data.Needs or { Energy = 100, Mood = 70 }
	return data.Needs
end
Needs.get = needs

function Needs.change(player, energy, mood)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local n = needs(data)
	n.Energy = Util.clamp(n.Energy + (energy or 0), 0, 100)
	n.Mood = Util.clamp(n.Mood + (mood or 0), 0, 100)
	if n.Energy < 20 and not warned[player] then
		warned[player] = true
		S.Net.notify(player, "🥱 Estás cansado: come algo o descansa en una cama (efecto leve en tus vídeos).", "warn")
	elseif n.Energy >= 40 then
		warned[player] = nil
	end
	S.Data.markDirty(player)
end

function Needs.spend(player, amount)
	-- Asistente de tu empresa: gastas menos energía
	if S.Company and amount > 0 then
		amount = amount * S.Company.energyMult(player)
	end
	Needs.change(player, -amount, 0)
end

function Needs.interestBonus(player)
	local data = S.Data.get(player)
	if not data then
		return 0
	end
	local n = needs(data)
	local b = 0
	if n.Energy < 25 then
		b = b - 4
	end
	if n.Mood > 80 then
		b = b + 3
	elseif n.Mood < 30 then
		b = b - 2
	end
	return b
end

function Needs.exportMult(player)
	local data = S.Data.get(player)
	return (data and needs(data).Energy < 25) and 1.15 or 1
end

function Needs.mood(player)
	local data = S.Data.get(player)
	return data and needs(data).Mood or 60
end

local function eat(player, name, energy, mood)
	Needs.change(player, energy, mood)
	local data = S.Data.get(player)
	data.Counters.meals = (data.Counters.meals or 0) + 1
	S.Quest.check(player)
	return "🍽 " .. name .. ": energía +" .. energy .. ", ánimo +" .. mood .. "."
end

function Needs.rest(player)
	if not S.Home.isAtHome(player) then
		S.Net.notify(player, "Descansa en tu casa.", "info")
		return
	end
	if lastRest[player] and os.clock() - lastRest[player] < 90 then
		S.Net.notify(player, "Acabas de descansar.", "info")
		return
	end
	lastRest[player] = os.clock()
	Needs.change(player, 50, 6)
	S.Net.notify(player, "😴 Has descansado: energía +50.", "success")
end

local function placeNear(player, kind)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	local list = {}
	if kind == "vending" then
		list = S.World.VendingMachines or {}
	else
		for _, sp in ipairs(S.World.Specials) do
			if (kind == "restaurant" and sp.Type == "restaurant") or (kind == "cafe" and sp.Type == "cafe") then
				list[#list + 1] = Vector3.new(sp.WX, 0, sp.WZ)
			end
		end
	end
	for _, pos in ipairs(list) do
		local dx, dz = root.Position.X - pos.X, root.Position.Z - pos.Z
		if dx * dx + dz * dz <= 40 * 40 then
			return true
		end
	end
	return false
end

function Needs.Start()
	local Net = S.Net

	Net.on("Food.Eat", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid or ""]
		local def = rec and Catalog.get(rec.Id)
		if not def or def.Cat ~= "food" then
			return false, "Eso no se puede comer."
		end
		if rec.Loc ~= "home" and rec.Loc ~= "backpack" then
			return false, "No lo tienes a mano."
		end
		S.Inventory.remove(player, p.uid)
		return true, eat(player, def.Name, def.Stats.Energy, def.Stats.Mood)
	end)

	Net.on("Food.Order", function(player, p)
		local menu = FoodData.Menus[p.place or ""]
		if not menu then
			return false, "Lugar no válido."
		end
		if not placeNear(player, p.place) then
			return false, "Tienes que estar en " .. menu.Name .. "."
		end
		local item
		for _, it in ipairs(menu.Items) do
			if it[1] == p.item then
				item = it
			end
		end
		if not item then
			return false, "Ese plato no está en el menú."
		end
		if not S.Economy.spend(player, item[3], "Comida", item[2] .. " (" .. menu.Name .. ")") then
			return false, "Cuesta $" .. item[3] .. "."
		end
		local data = S.Data.get(player)
		if p.place == "restaurant" then
			data.Counters.restaurant_meals = (data.Counters.restaurant_meals or 0) + 1
		end
		return true, eat(player, item[2], item[4], item[5])
	end)

	Net.on("Food.Cook", function(player, p)
		local data = S.Data.get(player)
		if not S.Home.isAtHome(player) then
			return false, "Cocina en la cocina de tu casa."
		end
		local recipe
		for _, r in ipairs(FoodData.Recipes) do
			if r.Id == p.recipe then
				recipe = r
			end
		end
		if not recipe then
			return false, "Receta no válida."
		end
		local used = {}
		for _, need in ipairs(recipe.Needs) do
			local found = nil
			for uid, rec in pairs(data.Inventory) do
				if rec.Id == need and not used[uid] and (rec.Loc == "home" or rec.Loc == "backpack") then
					found = uid
					break
				end
			end
			if not found then
				return false, "Te falta: " .. Catalog.get(need).Name .. ". Cómpralo en el Supermercado Fresco."
			end
			used[found] = true
		end
		for uid in pairs(used) do
			S.Inventory.remove(player, uid)
		end
		S.Inventory.add(player, recipe.Id, { src = "cook", paid = 0, loc = "home" })
		data.Counters.cooked = (data.Counters.cooked or 0) + 1
		Needs.change(player, 0, 4)
		S.Quest.check(player)
		return true, "👨‍🍳 Has cocinado " .. Catalog.get(recipe.Id).Name .. ". Está en tu despensa."
	end)

	Net.on("Food.Delivery", function(player, p)
		local data = S.Data.get(player)
		local price = FoodData.Delivery.Prices[p.item or ""]
		if not price then
			return false, "Ese plato no está disponible a domicilio."
		end
		data.FoodOrders = data.FoodOrders or {}
		if #data.FoodOrders >= 3 then
			return false, "Ya tienes 3 pedidos de comida en camino."
		end
		local total = price + FoodData.Delivery.Fee
		if not S.Economy.spend(player, total, "Comida", "Comida a domicilio: " .. Catalog.get(p.item).Name) then
			return false, "Cuesta $" .. total .. " (incluye $" .. FoodData.Delivery.Fee .. " de envío)."
		end
		table.insert(data.FoodOrders, { Item = p.item, Eta = os.time() + FoodData.Delivery.Seconds })
		return true, "🛵 Pedido en camino: llega a tu casa en " .. FoodData.Delivery.Seconds .. " s."
	end)

	Net.on("Food.Rest", function(player)
		Needs.rest(player)
		return true
	end)

	Players.PlayerRemoving:Connect(function(player)
		lastRest[player] = nil
		warned[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(10)
			for _, player in ipairs(Players:GetPlayers()) do
				local data = S.Data.get(player)
				if data then
					local n = needs(data)
					n.Energy = math.max(0, n.Energy - 0.25)
					n.Mood = n.Mood + (60 - n.Mood) * 0.01
					-- comida a domicilio
					local orders = data.FoodOrders or {}
					for i = #orders, 1, -1 do
						if os.time() >= orders[i].Eta then
							local item = orders[i].Item
							table.remove(orders, i)
							S.Inventory.add(player, item, { src = "delivery", paid = 0, loc = "home" })
							S.Net.notify(player, "🛵 Tu comida ha llegado a casa: " .. Catalog.get(item).Name, "success")
						end
					end
					S.Data.markDirty(player)
				end
			end
		end
	end)
end

return Needs
