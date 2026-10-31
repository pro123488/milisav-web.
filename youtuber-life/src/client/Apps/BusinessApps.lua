--!nonstrict
-- Apps de negocio y comunidad: Patrocinios, Eventos y Directos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local SponsorData = require(Shared.SponsorData)
local EventData = require(Shared.EventData)
local VideoData = require(Shared.VideoData)
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)
local T = UI.Theme

local apps = {}

local function catName(id)
	local c = VideoData.CategoryById[id]
	return c and c.Name or id
end
local function brandName(id)
	local b = SponsorData.BrandById[id]
	return b and b.Name or id
end
local kindNames = { gift = "🎁 Producto de regalo", loan = "📦 Equipo prestado", campaign = "📣 Campaña" }

---------------------------------------------------------------------------
-- PATROCINIOS
---------------------------------------------------------------------------
local Sponsors = { Id = "sponsors", Name = "Patrocinios", Icon = "🤝", Order = 5, Surfaces = { pc = true, phone = true, panel = true }, Width = 860, Height = 560 }
function Sponsors.build(container, ctx)
	task.spawn(Net.call, "Sponsor.Refresh", {}, { silent = true })
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local sp = data.Sponsors or {}
		local s = UI.scroll(container, { Pad = 6 })
		UI.label(s, "Reputación comercial: " .. data.BizRep .. "/100 · Reputación del canal: " .. data.Reputation .. "/100", { Font = Enum.Font.GothamBold, Color = T.Gold })
		UI.progress(s, data.BizRep / 100, T.Gold, { Height = 8 })
		UI.label(s, "Las marcas te ofrecen contratos según tu reputación y tus suscriptores. Cumplirlos sube tu reputación comercial; incumplirlos la baja.", { TextSize = 12, Color = T.Sub, Height = 30 })
		UI.title(s, "📋 Contratos activos")
		local any = false
		for id, c in pairs(sp.Active or {}) do
			any = true
			local left = c.DueDay - data.Home.PlayDays
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = left <= 0 and Color3.fromRGB(90, 50, 30) or T.Panel2 })
			UI.label(card, brandName(c.Brand) .. " · " .. (kindNames[c.Kind] or c.Kind), { Font = Enum.Font.GothamBold })
			UI.label(card, "Publica un vídeo de " .. catName(c.Category) .. " con calidad " .. c.MinQ .. "+" .. (c.Product and (" mostrando " .. Catalog.get(c.Product).Name .. " (plano de producto, llévalo en la mochila)") or "") .. ".", { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "Pago $" .. Util.formatInt(c.Pay) .. " (+$" .. c.Bonus .. " si la calidad supera " .. (c.MinQ + 15) .. ") · " .. (left >= 0 and ("quedan " .. left .. " días de juego") or "¡fuera de plazo!"), { TextSize = 12, Color = T.Ok })
			UI.label(card, "Al publicar en ViewTube Studio elige este contrato en «Patrocinio».", { TextSize = 11, Color = T.Sub })
			local row = UI.row(card, 30)
			UI.button(row, "🎬 Crear proyecto", function()
				local r = Net.call("Video.CreateProject", { category = c.Category, name = brandName(c.Brand) .. " · patrocinado" })
				if r.ok and c.Product then
					Net.call("Video.UpdatePlan", { pid = r.data.pid, plan = { Featured = { c.Product } } }, { silent = true })
				end
			end, { Width = 150, Height = 26, TextSize = 12, Color = T.Accent2 })
			UI.button(row, "Cancelar contrato", function()
				Notify.confirm("¿Cancelar el contrato con " .. brandName(c.Brand) .. "? Perderás 4 puntos de reputación comercial (incumplirlo cuesta 10).", function()
					Net.call("Sponsor.Cancel", { id = id })
				end)
			end, { Width = 150, Height = 26, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		end
		if not any then
			UI.label(s, "Ninguno.", { Color = T.Sub })
		end
		UI.title(s, "📨 Ofertas de hoy")
		if #(sp.Offers or {}) == 0 then
			UI.label(s, "No hay ofertas ahora. Llegan nuevas cada día de juego; sube tu reputación publicando vídeos de calidad.", { Color = T.Sub, Height = 30 })
		end
		for _, o in ipairs(sp.Offers or {}) do
			local b = SponsorData.BrandById[o.Brand]
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, b.Name .. " (" .. b.Field .. ") · " .. (kindNames[o.Kind] or o.Kind), { Font = Enum.Font.GothamBold })
			UI.label(card, "Requisitos: vídeo de " .. catName(o.Category) .. ", calidad " .. o.MinQ .. "+" .. (o.Product and (", mostrando " .. Catalog.get(o.Product).Name) or ""), { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "Duración: " .. o.Days .. " días de juego · Pago $" .. Util.formatInt(o.Pay) .. " + bonus $" .. o.Bonus .. (o.Product and (o.Kind == "gift" and " · el producto es tuyo" or " · el equipo se devuelve al final") or ""), { TextSize = 12, Color = T.Ok })
			UI.label(card, "Condiciones: si no entregas a tiempo, −10 de reputación comercial y −2 de reputación del canal.", { TextSize = 11, Color = T.Sub })
			local row = UI.row(card, 30)
			UI.button(row, "✅ Aceptar", function()
				Net.call("Sponsor.Accept", { id = o.Id })
			end, { Width = 110, Height = 26, Color = T.Ok })
			UI.button(row, "Rechazar", function()
				Net.call("Sponsor.Decline", { id = o.Id })
			end, { Width = 100, Height = 26 })
		end
		UI.title(s, "🗂 Historial")
		for _, h in ipairs(sp.History or {}) do
			UI.label(s, os.date("%d/%m", h.T) .. " · " .. brandName(h.Brand) .. " · " .. h.Result .. (h.Pay > 0 and (" · $" .. Util.formatInt(h.Pay)) or ""), { TextSize = 12, Color = h.Result == "Cumplido" and T.Ok or T.Warn })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Sponsors)

---------------------------------------------------------------------------
-- EVENTOS
---------------------------------------------------------------------------
local Events = { Id = "events", Name = "Eventos", Icon = "🎪", Order = 6, Surfaces = { pc = true, phone = true, panel = true }, Width = 760, Height = 560 }
function Events.build(container, ctx)
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local day = workspace:GetAttribute("GameDay") or 1
		local ev = EventData.forDay(day)
		local spot = WorldData.SpotById[ev.Spot]
		local s = UI.scroll(container, { Pad = 6 })
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = Color3.fromRGB(70, 25, 70) })
		UI.label(card, "🎪 HOY: " .. ev.Name, { Font = Enum.Font.GothamBlack, TextSize = 18, Height = 24 })
		UI.label(card, ev.Desc, { TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
		local active = data.Derived.EventActive
		UI.label(card, "📍 " .. (spot and spot.Name or "?") .. " (" .. WorldData.DistrictById[ev.District].Name .. ") · 🕒 " .. ev.Hours[1] .. ":00–" .. ev.Hours[2] .. ":00 · " .. (active and "✅ en curso" or "⏳ fuera de horario"), { TextSize = 12, Color = active and T.Ok or T.Warn })
		local row = UI.row(card, 32)
		UI.button(row, "🚕 Ir al evento", function()
			Net.call("Travel.TaxiSpot", { spot = ev.Spot })
		end, { Width = 150, Height = 28, Color = T.Gold, TextColor = Color3.new(0, 0, 0) })
		UI.label(s, "🎯 Objetivos (cada uno se cobra una vez):", { Font = Enum.Font.GothamBold })
		local prog = data.EventProg or {}
		local done = (prog.Day == day) and prog.Done or {}
		for i, g in ipairs(ev.Goals) do
			local ok = done[tostring(i)]
			UI.label(s, (ok and "✔ " or "○ ") .. EventData.goalText(g) .. " — $" .. g.Reward, { TextSize = 13, Color = ok and T.Ok or T.Text })
		end
		if prog.Day == day and (prog.Scenes or 0) > 0 then
			UI.label(s, "Escenas grabadas en el evento: " .. prog.Scenes, { TextSize = 12, Color = T.Sub })
		end
		UI.title(s, "📅 Próximos eventos")
		for i = 1, 6 do
			local e = EventData.forDay(day + i)
			UI.label(s, "Día " .. (day + i) .. " · " .. e.Name .. " · " .. WorldData.DistrictById[e.District].Name, { TextSize = 12, Color = T.Sub })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Events)

---------------------------------------------------------------------------
-- DIRECTOS
---------------------------------------------------------------------------
local Live = { Id = "live", Name = "Directo", Icon = "🔴", Order = 7, Surfaces = { pc = true }, Width = 720, Height = 520 }
local topics = {
	{ Id = "gaming", Name = "Partida en directo" }, { Id = "qa", Name = "Preguntas y respuestas" }, { Id = "tech", Name = "Charla de tecnología" },
	{ Id = "cooking", Name = "Cocinando en directo" }, { Id = "edit", Name = "Editando en directo" },
}
function Live.build(container, ctx)
	local topicIdx = 1
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local s = UI.scroll(container, { Pad = 6 })
		local live = State.Live
		if live and live.kind ~= "end" then
			UI.label(s, "🔴 EN DIRECTO · " .. live.topic, { Font = Enum.Font.GothamBlack, TextSize = 18, Color = T.Accent })
			UI.label(s, "👀 " .. live.viewers .. " espectadores (pico " .. live.peak .. ") · 💸 $" .. live.donations .. " en donaciones · +" .. live.subs .. " subs · ⏱ " .. live.left .. " s", { TextSize = 14 })
			UI.label(s, "Ánimo del chat: " .. live.engagement .. "%", { TextSize = 12, Color = T.Sub })
			UI.progress(s, live.engagement / 100, T.Ok)
			UI.label(s, "Las preguntas del chat aparecen en pantalla: responde bien para mantener a la audiencia.", { TextSize = 12, Color = T.Sub, Height = 30 })
			UI.button(s, "⏹ Terminar directo", function()
				Net.call("Live.Stop", {})
			end, { Width = 180, Color = T.Panel3 })
			return
		end
		UI.title(s, "🔴 Emitir en directo")
		UI.label(s, "Necesitas una cámara web en casa o una cámara. La audiencia depende de tus suscriptores, tu equipo (cámara, micrófono, PC), la decoración de la sala y tus respuestas. Duración: 75 s.", { TextSize = 12, Color = T.Sub, Height = 46 })
		local names = {}
		for i, t in ipairs(topics) do
			names[i] = t.Name
		end
		UI.cycle(s, "Tema", names, topicIdx, function(i)
			topicIdx = i
		end, { ValueWidth = 220 })
		UI.button(s, "🔴 Empezar directo", function()
			Net.call("Live.Start", { topic = topics[topicIdx].Id })
		end, { Width = 200, Color = T.Accent })
		if live and live.kind == "end" then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel3 })
			UI.label(card, "Resumen del último directo", { Font = Enum.Font.GothamBold })
			UI.label(card, "Pico " .. live.peak .. " · media " .. (live.avg or 0) .. " · anuncios $" .. (live.ads or 0) .. " · donaciones $" .. live.donations .. " · +" .. live.subs .. " suscriptores", { TextSize = 12 })
		end
		UI.title(s, "📼 Directos anteriores")
		for _, l in ipairs(data.Lives or {}) do
			UI.label(s, os.date("%d/%m %H:%M", l.T) .. " · " .. l.Topic .. " · pico " .. l.Peak .. " · $" .. (l.Donations + l.Ads) .. " · +" .. l.Subs .. " subs · ánimo " .. l.Engagement .. "%", { TextSize = 12, Color = T.Sub })
		end
	end
	render()
	ctx.cleanup = State.onLive(render)
	ctx.onState(function() end)
end
table.insert(apps, Live)

return apps
