--!nonstrict
-- App Mascotas: adoptar (en la Tienda de mascotas Huellitas), tus mascotas (nombre, color, accesorio,
-- felicidad, distancia paseada), sacar/guardar, jugar y dar de comer. Juguetes y accesorios de la tienda.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local LifeData = require(Shared.LifeData)
local WorldData = require(Shared.WorldData)
local T = UI.Theme
local Care = LifeData.PetCare

local Pets = { Id = "pets", Name = "Mascotas", Icon = "🐾", Order = 9, Surfaces = { pc = true, phone = true, panel = true }, Width = 780, Height = 560 }

-- ¿Está el jugador en la tienda de mascotas? (el servidor lo vuelve a comprobar)
local function shopSpecial()
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == "petshop" then
			return sp
		end
	end
	return nil
end

local function atShop()
	local sp = shopSpecial()
	local char = Players.LocalPlayer and Players.LocalPlayer.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not sp or not root then
		return false
	end
	local dx, dz = root.Position.X - sp.WX, root.Position.Z - sp.WZ
	return dx * dx + dz * dz <= 45 * 45
end

local function distText(m)
	m = m or 0
	if m >= 1000 then
		return string.format("%.1f km", m / 1000)
	end
	return math.floor(m) .. " m"
end

local function moodText(h)
	if h < Care.SadBelow then
		return "😢 Está un poco triste: juega con él o dale de comer (no afecta a tu progreso)", T.Accent2
	elseif h >= Care.HappyAbove then
		return "💖 ¡Muy feliz!", T.Ok
	end
	return "🙂 Contento", T.Text
end

function Pets.build(container, ctx)
	local adoptColor = 1
	local adoptName = ""
	local confirm = nil
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local list = data.Pets or {}
		local gear = data.PetGear or { Acc = {}, Toys = {} }
		local inShop = atShop()
		local count = State.count(list)
		local s = UI.scroll(container, { Pad = 8 })
		UI.title(s, "🐾 Mis mascotas (" .. count .. "/" .. Care.MaxPets .. ")")
		UI.label(s, "Juega con ellas, dales de comer y salid de paseo. Las fotos en modo Mascota (+" .. Care.PhotoBonus .. " calidad) y las escenas con tu mascota cerca (+" .. Care.SceneInterest .. " interés) mejoran tus vídeos.", { TextSize = 12, Color = T.Sub, Height = 32 })

		-- Tienda: adopción, accesorios y juguetes
		if inShop then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel })
			UI.label(card, "🏪 Tienda de mascotas Huellitas · Adopción", { Font = Enum.Font.GothamBold })
			local nameBox = UI.input(card, "Nombre (opcional)", adoptName)
			nameBox.FocusLost:Connect(function()
				adoptName = nameBox.Text
			end)
			UI.cycle(card, "Color", LifeData.PetColorNames, adoptColor, function(i)
				adoptColor = i
			end)
			for _, def in ipairs(LifeData.Pets) do
				local row = UI.row(card, 32)
				UI.label(row, def.Icon .. " " .. def.Name .. (def.Follows and "" or " · se queda en casa") .. " · comida $" .. def.Food, { Size = UDim2.new(1, -130, 1, 0), TextSize = 13 })
				UI.button(row, "Adoptar $" .. def.Price, function()
					local r = Net.call("Pet.Adopt", { species = def.Id, color = adoptColor, name = nameBox.Text })
					if r.ok then
						adoptName = ""
					end
				end, { Width = 120, Height = 28, Color = count < Care.MaxPets and T.Ok or T.Panel3 })
			end
			UI.label(card, "🧸 Juguetes (suman felicidad al jugar)", { Font = Enum.Font.GothamBold, TextSize = 13 })
			for _, toy in ipairs(LifeData.PetToys) do
				local row = UI.row(card, 30)
				local owned = gear.Toys and gear.Toys[toy.Id]
				UI.label(row, toy.Name .. " · +" .. toy.Bonus .. " felicidad", { Size = UDim2.new(1, -130, 1, 0), TextSize = 13, Color = owned and T.Ok or T.Text })
				UI.button(row, owned and "✔ Tuyo" or ("Comprar $" .. toy.Price), function()
					Net.call("Pet.BuyToy", { toy = toy.Id })
				end, { Width = 120, Height = 26, TextSize = 12, Color = owned and T.Panel3 or T.Accent2, Disabled = owned })
			end
		else
			local row = UI.row(s, 34)
			UI.label(row, "Adopta, compra accesorios y juguetes en la Tienda de mascotas Huellitas (Zona de apartamentos).", { Size = UDim2.new(1, -150, 1, 0), TextSize = 12, Color = T.Sub })
			UI.button(row, "🚕 Ir a Huellitas", function()
				Net.call("Travel.Taxi", { district = "apartments" })
			end, { Width = 140, Height = 28, TextSize = 12 })
		end

		if count == 0 then
			UI.label(s, "Aún no tienes mascotas. ¡Visita Huellitas para adoptar a tu primer compañero!", { Color = T.Sub, Height = 30 })
		end
		local ids = {}
		for id in pairs(list) do
			ids[#ids + 1] = id
		end
		table.sort(ids)
		for _, id in ipairs(ids) do
			local rec = list[id]
			local def = LifeData.PetById[rec.Species] or LifeData.Pets[1]
			local active = data.ActivePet == id
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			local where = def.Follows and (active and "🦮 Contigo" or "🏠 En casa") or "🏠 En su acuario"
			UI.label(card, def.Icon .. " " .. rec.Name .. " · " .. def.Name .. " · " .. where, { Font = Enum.Font.GothamBold })
			local happy = math.floor(rec.Happy or 0)
			local mood, moodColor = moodText(happy)
			UI.label(card, "Felicidad " .. happy .. "/100 · " .. mood, { TextSize = 12, Color = moodColor, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.progress(card, happy / 100, happy < Care.SadBelow and T.Accent2 or T.Ok, { Height = 8 })
			UI.label(card, "Paseado: " .. distText(rec.Walk) .. " · Color: " .. (LifeData.PetColorNames[rec.Color] or "-") .. " · Accesorio: " .. (rec.Acc or "Ninguno"), { TextSize = 12, Color = T.Sub })
			-- Nombre
			local nameRow = UI.row(card, 32)
			local nb = UI.input(nameRow, "Nombre", rec.Name, { Size = UDim2.new(0, 200, 0, 28) })
			UI.button(nameRow, "💾 Nombre", function()
				Net.call("Pet.Rename", { id = id, name = nb.Text })
			end, { Width = 100, Height = 28, TextSize = 12 })
			-- Color y accesorio
			UI.cycle(card, "Color", LifeData.PetColorNames, rec.Color or 1, function(i)
				Net.call("Pet.Color", { id = id, color = i })
			end)
			local accNames = {}
			local accIndex = 1
			for i, a in ipairs(LifeData.PetAccessories) do
				local price = LifeData.PetAccessoryPrices[a] or 0
				local owned = a == "Ninguno" or (gear.Acc and gear.Acc[a])
				accNames[i] = a .. (owned and "" or (" ($" .. price .. ")"))
				if a == rec.Acc then
					accIndex = i
				end
			end
			local chosenAcc = accIndex
			local accRow = UI.cycle(card, "Accesorio", accNames, accIndex, function(i)
				chosenAcc = i
			end)
			UI.button(accRow, "Poner", function()
				Net.call("Pet.Accessory", { id = id, acc = LifeData.PetAccessories[chosenAcc] })
			end, { Width = 80, Height = 28, TextSize = 12, Color = T.Accent2 })
			-- Acciones
			local actions = UI.row(card, 34)
			if def.Follows then
				if active then
					UI.button(actions, "🏠 Guardar", function()
						Net.call("Pet.Store", {})
					end, { Width = 110, Height = 30, TextSize = 13 })
				else
					UI.button(actions, "🦮 Sacar", function()
						Net.call("Pet.Spawn", { id = id })
					end, { Width = 110, Height = 30, TextSize = 13, Color = T.Ok })
				end
			end
			UI.button(actions, "🎾 Jugar", function()
				Net.call("Pet.Play", { id = id })
			end, { Width = 110, Height = 30, TextSize = 13, Color = T.Accent2 })
			UI.button(actions, "🍖 Dar de comer $" .. def.Food, function()
				Net.call("Pet.Feed", { id = id })
			end, { Width = 150, Height = 30, TextSize = 13 })
			if inShop then
				UI.button(actions, confirm == id and "¿Seguro? Confirmar" or "💞 Buscarle familia", function()
					if confirm ~= id then
						confirm = id
						render()
						return
					end
					confirm = nil
					Net.call("Pet.Rehome", { id = id })
				end, { Width = 160, Height = 30, TextSize = 12, Color = confirm == id and T.Err or T.Panel3 })
			end
		end
		local toys = {}
		for _, toy in ipairs(LifeData.PetToys) do
			if gear.Toys and gear.Toys[toy.Id] then
				toys[#toys + 1] = toy.Name
			end
		end
		if #toys > 0 then
			UI.label(s, "🧸 Tus juguetes: " .. table.concat(toys, ", "), { TextSize = 12, Color = T.Sub })
		end
		UI.label(s, "Consejo: una cama o un rascador para mascotas (Hogar & Deco) colocado en tu casa hace que su felicidad no baje.", { TextSize = 11, Color = T.Sub, Height = 28 })
	end
	render()
	ctx.onState(render)
end

return Pets
