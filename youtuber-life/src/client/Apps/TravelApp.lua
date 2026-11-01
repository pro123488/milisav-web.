--!nonstrict
-- App Viajes: destinos desbloqueables (LifeData.Destinations). Descripción, coste, requisitos,
-- lugares para grabar y productos exclusivos. Vuelos desde el mostrador de la Terminal Internacional;
-- estando en un destino: tienda exclusiva, hotel y vuelo de vuelta.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local LifeData = require(Shared.LifeData)
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local VideoData = require(Shared.VideoData)
local Progression = require(Shared.Progression)
local F = require(Shared.VideoFormulas)
local Util = require(Shared.Util)
local T = UI.Theme

local player = Players.LocalPlayer
local COUNTER_RADIUS = 35

local Travel = { Id = "travel", Name = "Viajes", Icon = "✈️", Order = 11, Surfaces = { pc = true, phone = true, panel = true }, Width = 760, Height = 560 }

local function airport()
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == "airport" then
			return sp
		end
	end
	return nil
end

-- "dest" (y el destino), "airport" (junto al mostrador) o "city"
local function whereAmI(data)
	local at = data.Trip and data.Trip.At or ""
	if at ~= "" and LifeData.DestById[at] then
		return "dest", LifeData.DestById[at]
	end
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if root then
		local d = LifeData.destinationAt(root.Position.X, root.Position.Z)
		if d then
			return "dest", d
		end
		local ap = airport()
		if ap then
			local dx, dz = root.Position.X - ap.WX, root.Position.Z - ap.WZ
			if dx * dx + dz * dz <= COUNTER_RADIUS * COUNTER_RADIUS then
				return "airport", nil
			end
		end
	end
	return "city", nil
end

local function reqText(d)
	local req = d.Req or {}
	local parts = { "nivel " .. (req.Level or 1) }
	if req.Rank then
		local r = Progression.Ranks[req.Rank]
		parts[#parts + 1] = "invitación (rango «" .. (r and r.Name or tostring(req.Rank)) .. "» o un patrocinio activo)"
	end
	return table.concat(parts, " · ")
end

-- Motivo por el que está bloqueado (o nil si se puede volar)
local function lockReason(data, d)
	local req = d.Req or {}
	if data.Level < (req.Level or 1) then
		return "Necesitas nivel " .. req.Level .. " (tienes " .. data.Level .. ")."
	end
	if req.Rank then
		local rankIdx = data.Derived and data.Derived.RankIndex or 1
		local sponsor = type(data.Sponsors) == "table" and next(data.Sponsors.Active or {}) ~= nil
		if rankIdx < req.Rank and not sponsor then
			local r = Progression.Ranks[req.Rank]
			return "Solo con invitación: sube al rango «" .. (r and r.Name or tostring(req.Rank)) .. "» o acepta un patrocinio."
		end
	end
	return nil
end

local function statsText(def)
	local s = def.Stats
	if def.Slot == "camera" then
		return "Cámara · vídeo " .. s.Video .. " · foto " .. s.Photo .. " · poca luz " .. s.LowLight .. " · estab. " .. s.Stab
			.. " · " .. s.Battery .. " escenas por carga" .. (s.Weather and " · resistente a la lluvia" or "")
	elseif def.Slot == "phone" then
		return "Teléfono · fotos " .. s.Photo .. " · vídeo " .. s.Video .. " · " .. s.PhotoStorage .. " fotos de capacidad"
	elseif def.Slot == "drone" then
		return "Dron · tomas aéreas · rendimiento " .. (s.Performance or 0)
	elseif def.Slot == "mic" then
		return "Micrófono portátil · audio " .. s.Audio
	elseif def.Slot == "light" then
		return "Luz portátil · iluminación +" .. s.Light
	end
	return "Producto para reseñas · rendimiento " .. (s.Performance or 0) .. " · durabilidad " .. (s.Durability or 0)
end

local function spotsLine(d)
	local names, cats = {}, {}
	for _, s in ipairs(d.Spots) do
		names[#names + 1] = s[1]
		for _, c in ipairs(VideoData.Categories) do
			if F.overlap(c.Tags, s[4]) > 0 and not Util.indexOf(cats, c.Name) and #cats < 6 then
				cats[#cats + 1] = c.Name
			end
		end
	end
	return "🎥 " .. table.concat(names, ", "), "Ideal para: " .. table.concat(cats, ", ")
end

function Travel.build(container, ctx)
	local lastPlace = nil
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local place, here = whereAmI(data)
		lastPlace = place .. (here and here.Id or "")
		local s = UI.scroll(container, { Pad = 6 })
		UI.title(s, "✈️ Viajes y turismo")
		local visited = State.count(data.Visited and data.Visited.Destinations)
		UI.label(s, "💰 $" .. Util.formatInt(data.Money) .. " · Destinos visitados: " .. visited .. "/" .. #LifeData.Destinations, { TextSize = 13, Color = T.Sub })

		if place == "dest" and here then
			-- Estás de viaje: tienda exclusiva, hotel y vuelta
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "📍 Estás en " .. here.Name, { Font = Enum.Font.GothamBlack, TextSize = 16 })
			UI.label(card, here.Desc, { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			local spots, ideal = spotsLine(here)
			UI.label(card, spots, { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, ideal, { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.button(card, "🏨 Dormir en el hotel ($" .. here.Hotel.Price .. ")", function()
				Net.call("Destination.Hotel", {})
			end, { Width = 240, Height = 30, Color = T.Accent2 })
			local n = data.Needs or { Energy = 100, Mood = 70 }
			UI.label(card, "🏨 " .. here.Hotel.Name .. ": energía +" .. here.Hotel.Energy .. ", ánimo +" .. here.Hotel.Mood
				.. " (ahora ⚡ " .. math.floor(n.Energy) .. "/100). El vuelo de vuelta está incluido en el billete.", { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })

			UI.title(s, "🛍 " .. here.ShopName .. " (solo aquí)")
			local owned = {}
			for _, rec in pairs(data.Inventory or {}) do
				owned[rec.Id] = (owned[rec.Id] or 0) + 1
			end
			for _, id in ipairs(here.Shop) do
				local def = Catalog.get(id)
				if def then
					local ic = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
					UI.label(ic, def.Name .. (owned[id] and ("  · tienes " .. owned[id]) or ""), { Font = Enum.Font.GothamBold, TextSize = 14 })
					UI.label(ic, def.Desc, { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
					UI.label(ic, statsText(def) .. ((def.Req.Level or 1) > 1 and (" · nivel " .. def.Req.Level) or ""), { TextSize = 11, Height = 0, Auto = Enum.AutomaticSize.Y })
					UI.button(ic, "Comprar $" .. Util.formatInt(def.Price), function()
						Net.call("Destination.Buy", { item = id, nonce = Net.nonce() })
					end, { Width = 150, Height = 28, Color = T.Ok })
				end
			end
			UI.button(s, "🛫 Volver a la ciudad (vuelo incluido)", function()
				Net.call("Destination.Return", {})
			end, { Width = 300, Height = 32, Color = T.Gold, TextColor = Color3.new(0, 0, 0) })
		elseif place == "airport" then
			UI.label(s, "🛫 Estás en el mostrador de la Terminal Internacional: elige destino. El billete incluye la vuelta.", { Color = T.Ok, Height = 0, Auto = Enum.AutomaticSize.Y })
		else
			UI.label(s, "Los vuelos salen del mostrador de la Terminal Internacional, en el Aeropuerto (noreste de la ciudad).", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.button(s, "🚕 Taxi al aeropuerto", function()
				Net.call("Destination.Taxi", {})
			end, { Width = 200, Height = 30, Color = T.Gold, TextColor = Color3.new(0, 0, 0) })
		end

		UI.title(s, place == "dest" and "🌍 Otros destinos" or "🌍 Destinos")
		for _, d in ipairs(LifeData.Destinations) do
			if not (here and here.Id == d.Id) then
				local lock = lockReason(data, d)
				local beenThere = data.Visited and data.Visited.Destinations and data.Visited.Destinations[d.Id]
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, d.Name .. (beenThere and "  ✔ visitado" or ""), { Font = Enum.Font.GothamBold, TextSize = 15 })
				UI.label(card, d.Desc, { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, "💵 Billete ida y vuelta $" .. Util.formatInt(d.Cost) .. " · 🏨 Hotel $" .. d.Hotel.Price .. " · Requisitos: " .. reqText(d), { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, lock and ("🔒 Bloqueado: " .. lock) or "🔓 Desbloqueado", { TextSize = 12, Color = lock and T.Err or T.Ok, Height = 0, Auto = Enum.AutomaticSize.Y })
				local spots, ideal = spotsLine(d)
				UI.label(card, spots, { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, ideal, { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
				local ex = {}
				for _, id in ipairs(d.Shop) do
					local def = Catalog.get(id)
					if def then
						ex[#ex + 1] = def.Name .. " ($" .. Util.formatInt(def.Price) .. ")"
					end
				end
				UI.label(card, "🛍 Exclusivos: " .. table.concat(ex, ", "), { TextSize = 11, Color = T.Gold, Height = 0, Auto = Enum.AutomaticSize.Y })
				if place == "airport" and not lock then
					UI.button(card, "🛫 Volar ($" .. Util.formatInt(d.Cost) .. ")", function()
						Net.call("Destination.Fly", { dest = d.Id })
					end, { Width = 160, Height = 30, Color = T.Accent })
				end
			end
		end
	end
	render()
	ctx.onState(render)
	-- Si te mueves (llegas al mostrador o aterrizas), se actualiza sola
	task.spawn(function()
		while container.Parent do
			task.wait(1.5)
			local data = State.Data
			if container.Parent and data then
				local place, here = whereAmI(data)
				if place .. (here and here.Id or "") ~= lastPlace then
					render()
				end
			end
		end
	end)
end

return Travel
