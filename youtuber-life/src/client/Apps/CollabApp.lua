--!nonstrict
-- App Colaborar: invitar a jugadores cercanos a tus proyectos (permisos y reparto), responder invitaciones,
-- grabar en el proyecto del dueño, editar su línea de tiempo (con permiso) e historial de vídeos colaborativos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)
local T = UI.Theme

local App = { Id = "collab", Name = "Colaborar", Icon = "🤜", Order = 9, Surfaces = { pc = true, phone = true, panel = true }, Width = 800, Height = 580 }

local function money(n)
	return "$" .. Util.formatInt(math.floor(n or 0))
end

local function permsLine(perms)
	return "🎥 Grabar " .. (perms.record and "✔" or "✖") .. " · ✂ Editar " .. (perms.edit and "✔" or "✖") .. " · 📤 Publicar: solo el dueño"
end

local function small(parent, text, color)
	return UI.label(parent, text, { TextSize = 12, Color = color or T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
end

function App.build(container, ctx)
	local nearby = nil
	local form = { pidIndex = 1, record = true, edit = false, share = 20 }
	local shotIndex, usePhone = 1, false
	local render

	local function scan()
		task.spawn(function()
			local r = Net.call("Collab.Nearby", {}, { silent = true })
			nearby = (r.ok and r.data and r.data.players) or {}
			if container.Parent then
				render()
			end
		end)
	end

	local function myProjects(view)
		local busy = {}
		for _, c in ipairs(view.Active or {}) do
			if c.Role == "owner" then
				busy[c.Pid] = true
			end
		end
		for _, inv in ipairs(view.Outgoing or {}) do
			busy[inv.Pid or ""] = true
		end
		local list = {}
		for pid, proj in pairs(State.Data.Projects or {}) do
			if not busy[pid] then
				list[#list + 1] = { Pid = pid, Name = proj.Name }
			end
		end
		table.sort(list, function(a, b)
			return a.Pid < b.Pid
		end)
		return list
	end

	local function activeCard(s, c)
		local isOwner = c.Role == "owner"
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, (isOwner and "👑 Tu proyecto «" or "🤜 Proyecto de " .. c.Partner .. ": «") .. c.Project .. "»", { Font = Enum.Font.GothamBold, TextSize = 14 })
		small(card, (isOwner and ("Colaborador: " .. c.Partner .. " · se lleva el ") or "Tu parte: ") .. c.Share .. " % de los ingresos · a " .. c.Dist .. " studs"
			.. " · escenas: " .. c.Mine .. " tuyas, " .. c.Theirs .. " de " .. (isOwner and c.Partner or "los demás"))
		small(card, permsLine(c.Perms), T.Text)
		if isOwner then
			UI.toggle(card, "Puede grabar", c.Perms.record, function(v)
				Net.call("Collab.SetPerms", { id = c.Id, record = v, edit = c.Perms.edit })
			end, { Width = 200 })
			UI.toggle(card, "Puede editar", c.Perms.edit, function(v)
				Net.call("Collab.SetPerms", { id = c.Id, record = c.Perms.record, edit = v })
			end, { Width = 200 })
			UI.button(card, "🚪 Expulsar a " .. c.Partner, function()
				Net.call("Collab.Kick", { id = c.Id })
			end, { Width = 240, Height = 30, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		else
			if c.Perms.record then
				local names = {}
				for i, sh in ipairs(VideoData.Shots) do
					names[i] = sh.Name
				end
				UI.cycle(card, "Toma", names, shotIndex, function(i)
					shotIndex = i
				end)
				UI.toggle(card, "Grabar con el teléfono", usePhone, function(v)
					usePhone = v
				end, { Width = 220 })
				UI.button(card, "🎬 Grabar escena para «" .. c.Project .. "»", function()
					local shot = VideoData.Shots[shotIndex] or VideoData.Shots[1]
					Net.call("Video.RecordScene", { owner = c.OwnerId, pid = c.Pid, shot = shot.Id, usePhone = usePhone })
				end, { Width = 300, Height = 32, Color = T.Ok })
				small(card, "Graba en un lugar 🎥, una tienda o una casa, a menos de " .. ((State.Data.Derived.Collab or {}).RecordRadius or 40) .. " studs de " .. c.Partner .. ".")
			else
				small(card, "No tienes permiso para grabar en este proyecto.")
			end
			UI.button(card, "🚪 Salir de la colaboración", function()
				Net.call("Collab.Leave", { id = c.Id })
			end, { Width = 240, Height = 30, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		end
		if #c.Scenes > 0 then
			UI.label(card, "🎬 Escenas del proyecto", { Font = Enum.Font.GothamBold, TextSize = 13 })
			for _, sc in ipairs(c.Scenes) do
				small(card, "• " .. sc.Name .. " · calidad " .. sc.Q .. " · por " .. sc.ByName, sc.By == c.OwnerId and T.Text or T.Gold)
			end
		end
		if c.CanEdit then
			UI.label(card, "✂ Línea de tiempo" .. (#c.Timeline == 0 and " (vacía: el dueño debe importar y montar en el Editor)" or ""), { Font = Enum.Font.GothamBold, TextSize = 13, Height = 0, Auto = Enum.AutomaticSize.Y })
			for _, clip in ipairs(c.Timeline) do
				local row = UI.row(card, 28)
				UI.label(row, clip.Index .. ". " .. clip.Name, { Size = UDim2.new(1, -150, 1, 0), TextSize = 12 })
				UI.button(row, "▲", function()
					Net.call("Collab.EditClip", { id = c.Id, index = clip.Index, op = "up" }, { quietOk = true })
				end, { Width = 40, Height = 24, TextSize = 12 })
				UI.button(row, "▼", function()
					Net.call("Collab.EditClip", { id = c.Id, index = clip.Index, op = "down" }, { quietOk = true })
				end, { Width = 40, Height = 24, TextSize = 12 })
				UI.button(row, "✖", function()
					Net.call("Collab.EditClip", { id = c.Id, index = clip.Index, op = "remove" })
				end, { Width = 40, Height = 24, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
			end
		end
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local view = (data.Derived and data.Derived.Collab) or { Incoming = {}, Outgoing = {}, Active = {} }
		local s = UI.scroll(container, { Pad = 6 })
		UI.title(s, "🤜 Colaboraciones")
		small(s, "Invita a un jugador cercano (menos de " .. (view.InviteRadius or 25) .. " studs) a uno de tus proyectos. Tú decides si puede grabar (estando cerca de ti) y editar la línea de tiempo; publicar es siempre solo del dueño. "
			.. "El reparto (0-" .. (view.MaxShare or 50) .. " %) se fija al invitar y se paga de lo que genere el vídeo mientras los dos estéis conectados. Si el invitado graba alguna escena, el vídeo gana +10 % de visitas y +15 % de suscriptores. Nunca se transfieren objetos ni proyectos.")

		-- Invitaciones recibidas
		if #(view.Incoming or {}) > 0 then
			UI.title(s, "📨 Invitaciones recibidas")
			for _, inv in ipairs(view.Incoming) do
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, inv.From .. " te invita a «" .. inv.Project .. "» (" .. inv.Category .. ")", { Font = Enum.Font.GothamBold, TextSize = 14, Height = 0, Auto = Enum.AutomaticSize.Y })
				small(card, "💰 Reparto: " .. inv.Share .. " % de los ingresos del vídeo para ti · caduca en " .. inv.Left .. " s", T.Gold)
				small(card, permsLine(inv.Perms), T.Text)
				local row = UI.row(card, 34)
				UI.button(row, "✅ Aceptar", function()
					Net.call("Collab.Respond", { id = inv.Id, accept = true })
				end, { Width = 140, Color = T.Ok })
				UI.button(row, "✖ Rechazar", function()
					Net.call("Collab.Respond", { id = inv.Id, accept = false })
				end, { Width = 140 })
			end
		end

		-- Colaboraciones activas
		UI.title(s, "🤝 Colaboraciones activas")
		if #(view.Active or {}) == 0 then
			small(s, "Ninguna por ahora.")
		end
		for _, c in ipairs(view.Active or {}) do
			activeCard(s, c)
		end

		-- Invitaciones enviadas
		if #(view.Outgoing or {}) > 0 then
			UI.title(s, "📤 Invitaciones enviadas")
			for _, inv in ipairs(view.Outgoing) do
				local row = UI.row(s, 32)
				UI.label(row, "A " .. inv.To .. ": «" .. inv.Project .. "» · " .. inv.Share .. " % · caduca en " .. inv.Left .. " s", { Size = UDim2.new(1, -150, 1, 0), TextSize = 12 })
				UI.button(row, "Retirar", function()
					Net.call("Collab.CancelInvite", { id = inv.Id })
				end, { Width = 120, Height = 28, TextSize = 12 })
			end
		end

		-- Invitar
		UI.title(s, "➕ Invitar a colaborar")
		local projects = myProjects(view)
		if #projects == 0 then
			small(s, "Necesitas un proyecto propio sin colaborador (créalo en la app Ideas).")
		else
			form.pidIndex = math.min(form.pidIndex, #projects)
			local names = {}
			for i, pr in ipairs(projects) do
				names[i] = pr.Name
			end
			UI.cycle(s, "Proyecto", names, form.pidIndex, function(i)
				form.pidIndex = i
			end)
			UI.toggle(s, "Puede grabar escenas", form.record, function(v)
				form.record = v
			end)
			UI.toggle(s, "Puede editar clips", form.edit, function(v)
				form.edit = v
			end)
			UI.stepper(s, "Reparto", form.share, 0, view.MaxShare or 50, 5, function(v)
				form.share = v
			end, { Format = function(x)
				return x .. " % para el invitado"
			end })
			small(s, "📤 Publicar: siempre solo tú (no se puede ceder).")
			UI.button(s, "🔄 Buscar jugadores cercanos", function()
				nearby = nil
				render()
				scan()
			end, { Width = 240 })
			if nearby == nil then
				small(s, "Buscando...")
			elseif #nearby == 0 then
				small(s, "No hay nadie cerca. Queda con un amigo en el mismo sitio y vuelve a buscar.")
			else
				for _, p in ipairs(nearby) do
					local row = UI.row(s, 32)
					UI.label(row, "👤 " .. p.name .. " · a " .. p.dist .. " studs" .. (p.busy and " · ocupado" or ""), { Size = UDim2.new(1, -170, 1, 0), TextSize = 13 })
					UI.button(row, "🤜 Invitar", function()
						local pr = projects[form.pidIndex]
						if pr then
							Net.call("Collab.Invite", { userId = p.userId, pid = pr.Pid, share = form.share, record = form.record, edit = form.edit })
						end
					end, { Width = 150, Height = 28, TextSize = 12, Color = T.Ok })
				end
			end
		end

		-- Historial
		UI.title(s, "📜 Vídeos colaborativos")
		local counters = data.Counters or {}
		small(s, "Cobrado como colaborador: " .. money(counters.collab_earned) .. " · Pagado a tus colaboradores: " .. money(counters.collab_paid) .. " · Vídeos: " .. (counters.collabs or 0), T.Gold)
		local log = data.CollabLog or {}
		if #log == 0 then
			small(s, "Aún no has publicado ningún vídeo colaborativo.")
		end
		for _, e in ipairs(log) do
			local owner = e.Role == "owner"
			small(s, "• «" .. tostring(e.Title) .. "» " .. (owner and ("con " .. e.With .. " (tu proyecto)") or ("de " .. e.With)) .. " · " .. e.Share .. " %"
				.. (e.Bonus and " · bonus ✔" or "") .. " · " .. (owner and "pagado " or "cobrado ") .. money(e.Amount), T.Text)
		end
	end

	render()
	scan()
	ctx.onState(render)
end

return App
