--!nonstrict
-- App Amistades: personajes de la ciudad con los que has hecho amistad (solo amistad y relación profesional).
-- Nivel y barra de puntos, oficio, gustos descubiertos al charlar, dónde encontrarlos (taxi), regalos,
-- favores según el nivel, efectos activos e historial.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local FriendData = require(Shared.FriendData)
local WorldData = require(Shared.WorldData)
local VideoData = require(Shared.VideoData)
local Catalog = require(Shared.ItemCatalog)
local T = UI.Theme

local Friends = { Id = "friends", Name = "Amistades", Icon = "🫂", Order = 9, Surfaces = { pc = true, phone = true, panel = true }, Width = 800, Height = 580 }

local catNames = {}
for _, c in ipairs(Catalog.Categories) do
	catNames[c.Key] = c.Name
end

local function districtName(id)
	local d = WorldData.DistrictById[id or ""]
	return d and d.Name or "?"
end

local function likeText(key)
	local kind, id = key:sub(1, 1), key:sub(3)
	if kind == "v" then
		local c = VideoData.CategoryById[id]
		return "🎬 " .. (c and c.Name or id)
	end
	return "🎁 " .. (catNames[id] or id)
end

local function levelInfo(f)
	local pts = f and f.Pts or 0
	local lvl = FriendData.levelOf(pts)
	local cur, need = FriendData.progress(pts)
	return lvl, FriendData.Levels[lvl].Name, cur, need, pts
end

local function catList(ids)
	local names = {}
	for _, id in ipairs(ids or {}) do
		local c = VideoData.CategoryById[id]
		names[#names + 1] = c and c.Name or id
	end
	return table.concat(names, ", ")
end

function Friends.build(container, ctx)
	local selected = ctx.params and ctx.params.friend or nil
	local giftOpen = false

	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local list = data.Friends or {}
		local day = data.Derived and data.Derived.Day or 0
		local s = UI.scroll(container, { Pad = 8 })

		local def = selected and FriendData.ById[selected] or nil
		if not def then
			-- Lista de personajes
			local met, good = 0, 0
			for _, f in pairs(list) do
				met = met + 1
				if FriendData.levelOf(f.Pts) >= 3 then
					good = good + 1
				end
			end
			UI.title(s, "🫂 Amistades (" .. met .. "/" .. #FriendData.Friends .. " conocidas · " .. good .. " amigos)")
			UI.label(s, "Charla una vez al día, haz regalos que les gusten y pídeles favores cuando tengáis confianza. Si pasas muchos días sin hablar, la amistad se enfría poco a poco.", { TextSize = 12, Color = T.Sub, Height = 32 })
			for _, fd in ipairs(FriendData.Friends) do
				local f = list[fd.Id]
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel2 })
				if f then
					local _, lvlName, cur, need, pts = levelInfo(f)
					UI.label(card, fd.Name .. " · " .. fd.Job, { Font = Enum.Font.GothamBold })
					UI.label(card, "💛 " .. lvlName .. " · " .. pts .. " puntos" .. (need and (" (" .. cur .. "/" .. need .. " para subir)") or " · nivel máximo") .. " · 📍 " .. districtName(fd.District), { TextSize = 12, Color = T.Sub })
					UI.progress(card, need and cur / need or 1, T.Gold, { Height = 8 })
				else
					UI.label(card, "❔ " .. fd.Name .. " · " .. fd.Job, { Font = Enum.Font.GothamBold, Color = T.Sub })
					UI.label(card, "Aún no os conocéis. Suele estar en la acera de " .. districtName(fd.District) .. ".", { TextSize = 12, Color = T.Sub })
				end
				local row = UI.row(card, 30)
				UI.button(row, "Ver ficha", function()
					selected = fd.Id
					giftOpen = false
					render()
				end, { Width = 110, Height = 26, TextSize = 12, Color = T.Accent2 })
				UI.button(row, "🚕 Ir a " .. districtName(fd.District), function()
					Net.call("Travel.Taxi", { district = fd.District })
				end, { Width = 260, Height = 26, TextSize = 12 })
			end
			return
		end

		-- Ficha de un personaje
		local f = list[def.Id]
		local pers = FriendData.Personalities[def.Personality]
		local top = UI.row(s, 30)
		UI.button(top, "← Todas", function()
			selected = nil
			giftOpen = false
			render()
		end, { Width = 90, Height = 26, TextSize = 12 })
		UI.label(top, def.Name .. " · " .. def.Job, { Size = UDim2.new(1, -100, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 16 })
		UI.label(s, (pers and pers.Name or "") .. " · " .. def.Bio, { TextSize = 12, Color = T.Sub, Height = 30 })
		local where = UI.row(s, 30)
		UI.label(where, "📍 Suele estar en la acera de " .. districtName(def.District) .. ".", { Size = UDim2.new(1, -200, 1, 0), TextSize = 13 })
		UI.button(where, "🚕 Taxi al distrito", function()
			Net.call("Travel.Taxi", { district = def.District })
		end, { Width = 190, Height = 26, TextSize = 12 })

		if not f then
			UI.label(s, "Aún no os conocéis. Ve a " .. districtName(def.District) .. " y pulsa «Hablar» cerca de " .. def.Name .. " para presentarte.", { Color = T.Warn, Height = 36 })
			return
		end

		local lvl, lvlName, cur, need, pts = levelInfo(f)
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel2 })
		UI.label(card, "💛 Nivel " .. lvl .. ": " .. lvlName .. " · " .. pts .. " puntos", { Font = Enum.Font.GothamBold })
		UI.progress(card, need and cur / need or 1, T.Gold, { Height = 10 })
		UI.label(card, need and ("Faltan " .. (need - cur) .. " puntos para «" .. FriendData.Levels[lvl + 1].Name .. "».") or "¡Amistad al máximo!", { TextSize = 12, Color = T.Sub })
		UI.label(card, "Hoy: " .. (f.Chat == day and "✔ ya habéis charlado" or "💬 podéis charlar (en persona)") .. " · " .. (f.Gift == day and "✔ regalo hecho" or "🎁 puedes hacerle un regalo"), { TextSize = 12 })

		-- Gustos
		local known = f.Known or {}
		local likes = {}
		for _, key in ipairs(known) do
			likes[#likes + 1] = likeText(key)
		end
		local total = #def.Videos + #def.Gifts
		UI.label(s, "❤ Gustos conocidos (" .. #known .. "/" .. total .. ")", { Font = Enum.Font.GothamBold })
		UI.label(s, #likes > 0 and table.concat(likes, " · ") or "Charla con " .. def.Name .. " para descubrir qué le gusta.", { TextSize = 12, Color = #likes > 0 and T.Text or T.Sub, Height = 30 })

		-- Efectos activos
		local active = {}
		if f.Guest then
			local gs = WorldData.SpotById[def.District .. "_1"]
			active[#active + 1] = "🎬 Invitado en tu próximo vídeo: te espera en " .. (gs and gs.Name or "su distrito") .. " (+" .. FriendData.GuestInterest .. " interés por escena" .. ((f.Guest.Scenes or 0) > 0 and (", " .. f.Guest.Scenes .. " escenas juntos") or "") .. ")."
		end
		if f.Discount and f.Discount.Until >= day then
			local st = Catalog.Stores[f.Discount.Store]
			active[#active + 1] = "🏷 " .. f.Discount.Pct .. "% en " .. (st and st.Name or f.Discount.Store) .. " hasta el día " .. f.Discount.Until .. "."
		end
		if f.Task then
			local spot = WorldData.SpotById[f.Task.Spot]
			active[#active + 1] = "📦 Encargo: graba una escena en " .. (spot and spot.Name or "?") .. " ($" .. (f.Task.Reward or 0) .. ")."
		end
		if f.Tip and f.Tip.Day >= day then
			active[#active + 1] = "🔥 Tendencias del día " .. f.Tip.Day .. ": " .. catList(f.Tip.Hot) .. "."
		end
		if #active > 0 then
			UI.label(s, "✨ En marcha", { Font = Enum.Font.GothamBold })
			for _, a in ipairs(active) do
				UI.label(s, a, { TextSize = 12, Height = 30 })
			end
		end

		-- Regalos
		local giftRow = UI.row(s, 32)
		UI.label(giftRow, "🎁 Regalar (en persona, 1 al día; se consume)", { Size = UDim2.new(1, -170, 1, 0), Font = Enum.Font.GothamBold, TextSize = 13 })
		UI.button(giftRow, giftOpen and "Ocultar" or "Elegir objeto", function()
			giftOpen = not giftOpen
			render()
		end, { Width = 160, Height = 28, TextSize = 12, Color = T.Accent2 })
		if giftOpen then
			local shown = 0
			for uid, rec in pairs(data.Inventory or {}) do
				local item = Catalog.get(rec.Id)
				local loc = rec.Loc or "home"
				if item and shown < 40 and not rec.Loan and (loc == "home" or loc == "backpack") and data.Equipped.Phone ~= uid then
					shown = shown + 1
					local liked = false
					for _, key in ipairs(known) do
						if key == "g:" .. item.Cat then
							liked = true
						end
					end
					local row = UI.row(s, 28)
					UI.label(row, (liked and "❤ " or "") .. item.Name .. " · " .. (catNames[item.Cat] or item.Cat) .. (loc == "backpack" and " · mochila" or ""), { Size = UDim2.new(1, -110, 1, 0), TextSize = 12 })
					UI.button(row, "Regalar", function()
						local r = Net.call("Friend.Gift", { id = def.Id, uid = uid })
						if r and r.ok then
							giftOpen = false
						end
					end, { Width = 100, Height = 24, TextSize = 12, Color = liked and T.Ok or T.Panel3 })
				end
			end
			if shown == 0 then
				UI.label(s, "No tienes objetos que puedas regalar (los instalados, colocados o prestados no cuentan).", { TextSize = 12, Color = T.Sub, Height = 30 })
			end
		end

		-- Favores
		UI.label(s, "🤝 Favores", { Font = Enum.Font.GothamBold })
		for _, fav in ipairs(def.Favors) do
			local kind = FriendData.FavorKinds[fav.Kind]
			local last = f.Favors and f.Favors["L" .. fav.Level]
			local wait = last and (kind.Cooldown - (day - last)) or 0
			local status, color, can
			if lvl < fav.Level then
				status, color, can = "🔒 Nivel " .. fav.Level .. " (" .. FriendData.Levels[fav.Level].Name .. ")", T.Sub, false
			elseif wait > 0 then
				status, color, can = "⏳ En " .. wait .. (wait == 1 and " día" or " días"), T.Warn, false
			else
				status, color, can = "Disponible", T.Ok, true
			end
			local fc = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel2 })
			local row = UI.row(fc, 30)
			UI.label(row, kind.Icon .. " " .. kind.Name .. " · " .. status, { Size = UDim2.new(1, -110, 1, 0), Font = Enum.Font.GothamBold, TextSize = 13, Color = color })
			UI.button(row, "Pedir", function()
				Net.call("Friend.Favor", { id = def.Id, level = fav.Level })
			end, { Width = 100, Height = 26, TextSize = 12, Color = can and T.Ok or T.Panel3 })
			local desc = kind.Desc
			if fav.Kind == "discount" then
				local st = Catalog.Stores[fav.Store]
				desc = fav.Pct .. "% en " .. (st and st.Name or fav.Store) .. " durante " .. fav.Days .. " días (también online)."
			elseif fav.Kind == "commission" then
				local spot = WorldData.SpotById[fav.Spot]
				desc = "Graba una escena en " .. (spot and spot.Name or "?") .. " y te paga $" .. fav.Reward .. "."
			end
			UI.label(fc, desc, { TextSize = 12, Color = T.Sub, Height = 28 })
		end

		-- Historial
		UI.label(s, "📜 Historial", { Font = Enum.Font.GothamBold })
		for _, e in ipairs(f.Log or {}) do
			UI.label(s, "Día " .. (e.D or 0) .. " · " .. (e.T or ""), { TextSize = 12, Color = T.Sub })
		end
	end
	render()
	ctx.onState(render)
end

return Friends
