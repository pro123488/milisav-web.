--!nonstrict
-- Apps de vida diaria: Misiones, Mapa y transporte, Empleo, Álbum, Cámara, Estilo, Mensajes, Calendario,
-- Tendencias, Música, Archivos, Tareas, Noticias y Ajustes.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local Actions = require(Client.Actions)
local PhotoView = require(Client.PhotoView)
local Catalog = require(Shared.ItemCatalog)
local QuestDefs = require(Shared.QuestDefs)
local WorldData = require(Shared.WorldData)
local VideoData = require(Shared.VideoData)
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local F = require(Shared.VideoFormulas)
local T = UI.Theme

local apps = {}
local player = Players.LocalPlayer

local function catName(id)
	local c = VideoData.CategoryById[id]
	return c and c.Name or id
end

---------------------------------------------------------------------------
-- MISIONES Y LOGROS
---------------------------------------------------------------------------
local Missions = { Id = "missions", Name = "Misiones", Icon = "🏆", Order = 10, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 560 }
function Missions.build(container, ctx)
	local groupFilter = 1
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local q = data.Quests
		local s = UI.scroll(container, { Pad = 6 })
		local step = QuestDefs.Tutorial[q.Step]
		if step and not q.Skipped then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = Color3.fromRGB(40, 50, 80) })
			UI.label(card, "🎓 Tutorial " .. q.Step .. "/" .. #QuestDefs.Tutorial .. ": " .. step.Name, { Font = Enum.Font.GothamBold })
			UI.label(card, step.Hint, { TextSize = 13, Height = 36 })
			UI.label(card, "Recompensa: $" .. step.Reward.Money .. " y " .. step.Reward.Xp .. " XP", { TextSize = 12, Color = T.Gold })
			local row = UI.row(card, 30)
			UI.button(row, "Saltar este paso", function()
				Net.call("Quest.SkipStep", {})
			end, { Width = 140, Height = 26, TextSize = 12 })
			UI.button(row, "Ocultar tutorial", function()
				Net.call("Quest.SkipTutorial", {})
			end, { Width = 140, Height = 26, TextSize = 12 })
		elseif step and q.Skipped then
			UI.button(s, "Reactivar explicaciones del tutorial", function()
				Net.call("Quest.RestartTutorial", {})
			end, { Width = 300 })
		else
			UI.label(s, "🎓 Tutorial completado.", { Color = T.Ok })
		end
		-- Logros
		local pending = 0
		for _, a in ipairs(QuestDefs.Achievements) do
			if q.Completed[a.Id] and not q.Claimed[a.Id] then
				pending = pending + 1
			end
		end
		local row = UI.row(s, 34)
		UI.label(row, "🏆 Logros (" .. State.count(q.Completed) .. "/" .. #QuestDefs.Achievements .. ")", { Size = UDim2.fromOffset(220, 30), Font = Enum.Font.GothamBlack, TextSize = 16 })
		if pending > 0 then
			UI.button(row, "Cobrar todo (" .. pending .. ")", function()
				Net.call("Quest.ClaimAll", {})
			end, { Width = 170, Height = 30, Color = T.Ok })
		end
		local groups = { "Todos", "Pendientes de cobrar" }
		local groupKeys = {}
		for _, a in ipairs(QuestDefs.Achievements) do
			if not Util.indexOf(groups, a.Group) then
				groups[#groups + 1] = a.Group
			end
		end
		UI.cycle(s, "Mostrar", groups, groupFilter, function(i)
			groupFilter = i
			render()
		end, { ValueWidth = 220, LabelWidth = 70 })
		local values = data.Derived.QuestValues
		local shownPerTrack = {}
		for _, a in ipairs(QuestDefs.Achievements) do
			local done = q.Completed[a.Id] ~= nil
			local claimed = q.Claimed[a.Id] ~= nil
			local g = groups[groupFilter]
			local show = (groupFilter == 1) or (groupFilter == 2 and done and not claimed) or (g == a.Group)
			-- en la vista general solo el siguiente nivel de cada grupo (y los pendientes)
			if groupFilter == 1 and claimed then
				show = false
			end
			if groupFilter == 1 and not done then
				if shownPerTrack[a.Counter] then
					show = false
				end
				shownPerTrack[a.Counter] = true
			end
			if show then
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = done and (claimed and T.Panel2 or Color3.fromRGB(40, 70, 50)) or T.Panel2 })
				local v = values[a.Counter] or 0
				UI.label(card, (claimed and "✔ " or (done and "🎁 " or "")) .. a.Name, { Font = Enum.Font.GothamBold, TextSize = 13 })
				UI.progress(card, v / a.Target, done and T.Ok or T.Accent2, { Height = 8 })
				UI.label(card, Util.formatInt(math.min(v, a.Target)) .. "/" .. Util.formatInt(a.Target) .. " · $" .. Util.formatInt(a.Reward.Money) .. " · " .. a.Reward.Xp .. " XP" .. (a.Reward.Title and (" · título «" .. a.Reward.Title .. "»") or ""), { TextSize = 11, Color = T.Sub })
				if done and not claimed then
					UI.button(card, "Cobrar", function()
						Net.call("Quest.Claim", { id = a.Id })
					end, { Width = 100, Height = 26, Color = T.Ok })
				end
			end
		end
		-- Títulos
		UI.title(s, "🏷 Títulos")
		local tRow = UI.frame(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
		UI.grid(tRow, 200, 28, 4)
		UI.button(tRow, data.EquippedTitle == "" and "● Sin título" or "Sin título", function()
			Net.call("Title.Equip", { title = "" })
		end, { Size = UDim2.fromOffset(200, 28), TextSize = 12 })
		for title in pairs(data.Titles) do
			UI.button(tRow, (data.EquippedTitle == title and "● " or "") .. title, function()
				Net.call("Title.Equip", { title = title })
			end, { Size = UDim2.fromOffset(200, 28), TextSize = 12, Color = data.EquippedTitle == title and T.Accent or T.Panel3 })
		end
		-- Estadísticas personales
		UI.title(s, "📈 Estadísticas personales")
		for key, name in pairs(QuestDefs.TrackNames) do
			UI.label(s, name .. ": " .. Util.formatInt(values[key] or 0), { TextSize = 12, Color = T.Sub, Height = 16 })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Missions)

---------------------------------------------------------------------------
-- MAPA Y TRANSPORTE
---------------------------------------------------------------------------
local Map = { Id = "map", Name = "Mapa", Icon = "🗺", Order = 11, Surfaces = { pc = true, phone = true, panel = true }, Width = 900, Height = 580 }
local busLine = { budget = true, apartments = true, studios = true, entertainment = true, events = true, commercial = true, park = true, creators = true, financial = true, tourist = true, university = true, beach = true }
function Map.build(container, ctx)
	local selected = nil
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local narrow = ctx.kind == "phone"
		local mapW = narrow and 290 or 480
		local cell = mapW / WorldData.Cols
		local mapFrame = UI.frame(container, { Size = UDim2.fromOffset(mapW, cell * WorldData.Rows), Color = Color3.fromRGB(40, 40, 46) })
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		local here = root and WorldData.districtAt(root.Position.X, root.Position.Z)
		for _, d in ipairs(WorldData.Districts) do
			local visited = data.Visited.Districts[d.Id]
			local b = UI.button(mapFrame, (here == d and "📍" or (visited and "" or "?")) .. (narrow and "" or ("\n" .. d.Name)), function()
				selected = d.Id
				render()
			end, { Size = UDim2.fromOffset(cell - 3, cell - 3), Position = UDim2.fromOffset((d.Col - 1) * cell + 1.5, (d.Row - 1) * cell + 1.5), Color = UI.rgb(d.Ground), TextSize = 10, Radius = 3 })
			b.TextColor3 = Color3.new(1, 1, 1)
			b.TextStrokeTransparency = 0.3
			if not visited then
				b.BackgroundTransparency = 0.45
			end
			if selected == d.Id then
				UI.stroke(b, T.Gold, 3)
			end
		end
		if root then
			local w, h = WorldData.totalSize()
			local px = (root.Position.X + w / 2) / w * mapW
			local pz = (root.Position.Z + h / 2) / h * (cell * WorldData.Rows)
			local dot = UI.frame(mapFrame, { Size = UDim2.fromOffset(10, 10), Position = UDim2.fromOffset(px - 5, pz - 5), Color = T.Accent, Radius = 5 })
			dot.ZIndex = 5
		end
		local info = UI.scroll(container, { Size = narrow and UDim2.new(1, 0, 1, -(cell * WorldData.Rows) - 8) or UDim2.new(1, -mapW - 10, 1, 0), Position = narrow and UDim2.fromOffset(0, cell * WorldData.Rows + 8) or UDim2.fromOffset(mapW + 10, 0), Pad = 6 })
		local visitedCount = State.count(data.Visited.Districts)
		UI.label(info, "Distritos visitados: " .. visitedCount .. "/30 · Secretos: " .. State.count(data.Visited.Secrets) .. "/" .. #WorldData.Secrets, { Font = Enum.Font.GothamBold })
		UI.button(info, "🏠 Taxi a casa", function()
			Net.call("Home.Teleport", {})
		end, { Width = 160, Height = 30 })
		local d = selected and WorldData.DistrictById[selected]
		if not d then
			UI.label(info, "Toca un distrito para ver sus lugares y viajar. Los distritos con «?» aún no los has visitado.", { Color = T.Sub, Height = 40 })
			-- pista de un secreto no descubierto
			for _, sec in ipairs(WorldData.Secrets) do
				if not data.Visited.Secrets[sec.Id] then
					UI.label(info, "🔎 Pista: " .. sec.Hint, { Color = T.Gold, TextSize = 12, Height = 34 })
					break
				end
			end
			return
		end
		UI.title(info, d.Name)
		local tags = {}
		for _, t in ipairs(d.Tags) do
			tags[#tags + 1] = t
		end
		UI.label(info, "Ambiente: " .. table.concat(tags, ", ") .. " · ruido " .. d.Noise .. "/10 · gente " .. d.Busy .. "/10", { TextSize = 12, Color = T.Sub })
		if root then
			local cx, cz = WorldData.center(d)
			local dist = math.sqrt((cx - root.Position.X) ^ 2 + (cz - root.Position.Z) ^ 2)
			local fare = math.floor(Config.TaxiBaseFare + dist * Config.TaxiPerStud + 0.5)
			local row = UI.row(info, 34)
			UI.button(row, "🚕 Taxi ($" .. fare .. ")", function()
				Net.call("Travel.Taxi", { district = d.Id })
			end, { Width = 140, Height = 30, Color = T.Gold, TextColor = Color3.new(0, 0, 0) })
			if busLine[d.Id] then
				UI.button(row, "🚌 Autobús ($3)", function()
					Net.call("Travel.Bus", { district = d.Id })
				end, { Width = 140, Height = 30 })
			end
		end
		UI.label(info, "🎥 Lugares de grabación:", { Font = Enum.Font.GothamBold })
		for _, sp in ipairs(WorldData.Spots) do
			if sp.District == d.Id and not sp.Secret then
				local card = UI.card(info, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, sp.Name .. " · interés " .. sp.Interest, { TextSize = 13, Font = Enum.Font.GothamBold })
				local good = {}
				for _, c in ipairs(VideoData.Categories) do
					if F.overlap(c.Tags, sp.Tags) > 0 and #good < 5 then
						good[#good + 1] = c.Name
					end
				end
				UI.label(card, "Ideal para: " .. table.concat(good, ", "), { TextSize = 11, Color = T.Sub, Height = 28 })
				UI.button(card, "🚕 Ir aquí", function()
					Net.call("Travel.TaxiSpot", { spot = sp.Id })
				end, { Width = 100, Height = 26, TextSize = 12 })
			end
		end
		for _, sp in ipairs(WorldData.Specials) do
			if sp.District == d.Id then
				local n = sp.Name or (sp.StoreId and Catalog.Stores[sp.StoreId].Name) or sp.Type
				UI.label(info, "🏬 " .. n, { TextSize = 13 })
			end
		end
	end
	render()
	task.spawn(function()
		while container.Parent do
			task.wait(3)
			if container.Parent and not selected then
				render()
			end
		end
	end)
end
table.insert(apps, Map)

---------------------------------------------------------------------------
-- EMPLEO
---------------------------------------------------------------------------
local Jobs = { Id = "jobs", Name = "Empleo", Icon = "💼", Order = 12, Surfaces = { pc = true, phone = true, panel = true }, Width = 760, Height = 540 }
local jobInfo = {
	{ Id = "edit", Name = "Editor de vídeos freelance", Req = "Estar usando un computador", Desc = "Ordena los clips de un cliente. Paga más con un PC mejor." },
	{ Id = "photo", Name = "Fotógrafo por encargo", Req = "Cámara o teléfono", Desc = "Haz una foto concreta en un lugar de la ciudad. Paga según la calidad." },
	{ Id = "delivery", Name = "Repartidor", Req = "Empezar dentro de una tienda", Desc = "Lleva un paquete a un lugar. Paga según la distancia." },
	{ Id = "cashier", Name = "Cajero / dependiente", Req = "Empezar dentro de una tienda", Desc = "Calcula el cambio de tres clientes." },
	{ Id = "camera", Name = "Camarógrafo", Req = "Cámara o teléfono", Desc = "Graba 2 escenas de calidad mínima en el lugar que pide el cliente." },
	{ Id = "thumbs", Name = "Diseñador de miniaturas", Req = "Computador o tableta", Desc = "Diseña una miniatura con la palabra del cliente y buena puntuación." },
	{ Id = "tech", Name = "Técnico informático", Req = "Conocer los zócalos", Desc = "Elige la placa base compatible con cada procesador." },
	{ Id = "reporter", Name = "Periodista de eventos", Req = "Ir al evento del día", Desc = "Haz una foto y graba una escena en el evento de hoy." },
}
function Jobs.build(container, ctx)
	local order = nil
	local answers = nil
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local s = UI.scroll(container, { Pad = 6 })
		local job = data.Job or {}
		if job.Type then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = Color3.fromRGB(40, 60, 90) })
			UI.label(card, "📌 Encargo en curso", { Font = Enum.Font.GothamBold })
			if job.Type == "edit" then
				order = order or Util.deepCopy(job.Clips)
				UI.label(card, "Ordena los clips en el orden lógico de un vídeo:", { TextSize = 13 })
				for i, clip in ipairs(order) do
					local row = UI.row(card, 28)
					UI.label(row, i .. ". " .. clip, { Size = UDim2.fromOffset(200, 26), TextSize = 13 })
					UI.button(row, "▲", function()
						if i > 1 then
							order[i], order[i - 1] = order[i - 1], order[i]
							render()
						end
					end, { Width = 30, Height = 24 })
					UI.button(row, "▼", function()
						if i < #order then
							order[i], order[i + 1] = order[i + 1], order[i]
							render()
						end
					end, { Width = 30, Height = 24 })
				end
				UI.button(card, "📤 Entregar edición", function()
					local r = Net.call("Job.Submit", { order = order })
					order = nil
				end, { Width = 180, Color = T.Ok })
			elseif job.Type == "cashier" or job.Type == "tech" then
				answers = answers or {}
				local list = job.Type == "cashier" and job.Rounds or job.Questions
				for i, q in ipairs(list) do
					if job.Type == "cashier" then
						local row = UI.row(card, 32)
						UI.label(row, "Cliente " .. i .. ": compra $" .. q.Price .. " y paga con $" .. q.Paid .. ". Cambio:", { Size = UDim2.fromOffset(330, 28), TextSize = 13 })
						local box = UI.input(row, "$", answers[i] and tostring(answers[i]) or "", { Size = UDim2.fromOffset(80, 28) })
						box.FocusLost:Connect(function()
							answers[i] = tonumber(box.Text)
						end)
					else
						local cpu = require(Shared.ItemCatalog).get(q.Cpu)
						UI.label(card, i .. ". Procesador " .. cpu.Name .. " — ¿qué placa es compatible?", { TextSize = 13 })
						local row = UI.row(card, 30)
						for _, opt in ipairs(q.Options) do
							local mdef = require(Shared.ItemCatalog).get(opt)
							UI.button(row, (answers[i] == opt and "● " or "") .. mdef.Name, function()
								answers[i] = opt
								render()
							end, { Width = 190, Height = 26, TextSize = 11, Color = answers[i] == opt and T.Accent2 or T.Panel3 })
						end
					end
				end
				UI.button(card, "📤 Entregar", function()
					Net.call("Job.Submit", { answers = answers })
					answers = nil
				end, { Width = 150, Color = T.Ok })
			elseif job.Type == "camera" then
				UI.label(card, "Graba 2 escenas de calidad " .. job.MinQ .. "+ en " .. job.SpotName .. " (llevas " .. (job.Count or 0) .. "/2).", { TextSize = 13, Height = 36 })
				UI.button(card, "🚕 Taxi al lugar", function()
					Net.call("Travel.TaxiSpot", { spot = job.Spot })
				end, { Width = 150 })
			elseif job.Type == "thumbs" then
				UI.label(card, "El cliente quiere una miniatura con la palabra «" .. job.Keyword .. "» y puntuación " .. job.MinScore .. "+. Diséñala en la app Miniaturas.", { TextSize = 13, Height = 36 })
			elseif job.Type == "reporter" then
				UI.label(card, "Reportaje en " .. job.SpotName .. ": " .. (job.Photo and "✔" or "○") .. " foto · " .. (job.Scene and "✔" or "○") .. " escena", { TextSize = 13, Height = 36 })
				UI.button(card, "🚕 Ir al evento", function()
					Net.call("Travel.TaxiSpot", { spot = job.Spot })
				end, { Width = 150 })
			elseif job.Type == "photo" then
				UI.label(card, "Haz una foto «" .. job.ModeName .. "» en " .. job.SpotName .. ". Usa el taxi si queda lejos.", { TextSize = 13, Height = 36 })
				UI.button(card, "🚕 Taxi al lugar", function()
					Net.call("Travel.TaxiSpot", { spot = job.Spot })
				end, { Width = 150 })
			elseif job.Type == "delivery" then
				UI.label(card, "Entrega el paquete en " .. job.SpotName .. " (" .. job.Dist .. " studs).", { TextSize = 13 })
				UI.button(card, "📦 Entregar aquí", function()
					Net.call("Job.Submit", {})
				end, { Width = 150, Color = T.Ok })
			end
			UI.button(card, "Cancelar encargo", function()
				order = nil
				Net.call("Job.Cancel", {})
			end, { Width = 160, Color = Color3.fromRGB(110, 40, 40) })
		end
		UI.title(s, "💼 Empleos disponibles")
		local bonus = Util.indexOf(data.Derived.Passes, "VIP") and " (+10% VIP)" or ""
		for _, j in ipairs(jobInfo) do
			local n = data.Counters["job_" .. j.Id] or 0
			local promo = math.min(50, math.floor(n / 10) * 5)
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, j.Name, { Font = Enum.Font.GothamBold })
			UI.label(card, j.Desc, { TextSize = 12, Color = T.Sub })
			UI.label(card, "Requisito: " .. j.Req .. " · completados: " .. n .. " · ascenso: +" .. promo .. "% paga" .. bonus, { TextSize = 12, Color = T.Sub })
			UI.progress(card, (n % 10) / 10, T.Gold, { Height = 6 })
			if not job.Type then
				UI.button(card, "Aceptar encargo", function()
					order = nil
					Net.call("Job.Start", { type = j.Id })
				end, { Width = 150, Height = 28, Color = T.Accent2 })
			end
		end
		UI.label(s, "Los ingresos de empleos pagan un 8% de impuesto simulado.", { TextSize = 11, Color = T.Sub })
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Jobs)

---------------------------------------------------------------------------
-- ÁLBUM DE FOTOS
---------------------------------------------------------------------------
local Album = { Id = "album", Name = "Álbum", Icon = "🖼", Order = 13, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 560 }
function Album.build(container, ctx)
	local selected, albumIdx = nil, 1
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local albums = { "Todas" }
		for _, a in ipairs(data.Albums) do
			albums[#albums + 1] = a
		end
		local top = UI.row(container, 34)
		UI.cycle(top, "Álbum", albums, albumIdx, function(i)
			albumIdx = i
			render()
		end, { LabelWidth = 50, ValueWidth = 120 })
		UI.label(top, #data.Photos .. "/" .. data.Derived.PhotoCap .. " fotos", { Size = UDim2.fromOffset(110, 28), TextSize = 12, Color = T.Sub })
		local nb = UI.input(top, "Nuevo álbum", "", { Size = UDim2.fromOffset(120, 28) })
		UI.button(top, "+", function()
			Net.call("Photo.CreateAlbum", { name = nb.Text })
		end, { Width = 30, Height = 28 })
		local narrow = ctx.kind == "phone"
		local list = UI.scroll(container, { Size = narrow and UDim2.new(1, 0, 0.45, -40) or UDim2.new(0.45, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 4 })
		for _, ph in ipairs(data.Photos) do
			if albumIdx == 1 or ph.Album == albums[albumIdx] then
				local mode = VideoData.PhotoModeById[ph.Mode]
				UI.button(list, (mode and mode.Name or "") .. " · " .. ph.SpotName .. " · Q" .. math.floor(ph.Q), function()
					selected = ph.Id
					render()
				end, { Size = UDim2.new(1, -8, 0, 30), TextSize = 12, Color = selected == ph.Id and T.Accent2 or T.Panel2 })
			end
		end
		if #data.Photos == 0 then
			UI.label(list, "Aún no hay fotos. Pulsa F (o el botón FOTO) para el modo fotógrafo.", { Color = T.Sub, Height = 40 })
		end
		if data.Posts and #data.Posts > 0 then
			UI.label(list, "📲 Tus publicaciones", { Font = Enum.Font.GothamBold })
			for _, post in ipairs(data.Posts) do
				UI.label(list, "«" .. post.Caption .. "» · " .. post.Spot .. " · ❤️ " .. post.Likes .. " · +" .. post.Subs, { TextSize = 11, Color = T.Sub })
			end
		end
		local ph = nil
		for _, p in ipairs(data.Photos) do
			if p.Id == selected then
				ph = p
			end
		end
		if ph then
			local right = UI.scroll(container, { Size = narrow and UDim2.new(1, 0, 0.55, 0) or UDim2.new(0.55, -8, 1, -40), Position = narrow and UDim2.fromScale(0, 0.45) or UDim2.new(0.45, 8, 0, 40) })
			PhotoView.render(right, ph, UDim2.fromOffset(narrow and 280 or 400, narrow and 158 or 225))
			local mode = VideoData.PhotoModeById[ph.Mode]
			UI.label(right, (mode and mode.Name or "") .. " en " .. ph.SpotName .. " · calidad " .. math.floor(ph.Q) .. " · " .. string.format("%02d:%02d", math.floor(ph.Hour), math.floor((ph.Hour % 1) * 60)) .. " · " .. (VideoData.PhotoFilters[ph.Filter] or ""), { TextSize = 12, Height = 30 })
			if ph.Probs and #ph.Probs > 0 then
				UI.label(right, "⚠ " .. table.concat(ph.Probs, ", "), { TextSize = 12, Color = T.Warn })
			end
			UI.cycle(right, "Mover a", data.Albums, Util.indexOf(data.Albums, ph.Album) or 1, function(i)
				Net.call("Photo.SetAlbum", { id = ph.Id, album = data.Albums[i] })
			end, { LabelWidth = 70 })
			local cap = UI.input(right, "Texto para la publicación en redes", "")
			UI.button(right, "📲 Publicar en redes", function()
				Net.call("Social.Post", { photoId = ph.Id, caption = cap.Text })
			end, { Width = 200, Color = T.Accent2 })
			local row = UI.row(right, 34)
			UI.button(row, "🖼 Usar en miniatura", function()
				ctx.open("thumbs", { photoId = ph.Id })
			end, { Width = 170 })
			UI.button(row, "🗑 Borrar", function()
				Notify.confirm("¿Borrar esta foto?", function()
					selected = nil
					Net.call("Photo.Delete", { id = ph.Id })
				end)
			end, { Width = 100, Color = Color3.fromRGB(110, 40, 40) })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Album)

---------------------------------------------------------------------------
-- CÁMARA (teléfono) y VESTIDOR
---------------------------------------------------------------------------
local Camera = { Id = "camera", Name = "Cámara", Icon = "📷", Order = 14, Surfaces = { phone = true } }
function Camera.build(container, ctx)
	UI.label(container, "📷 Cámara", { Font = Enum.Font.GothamBlack, TextSize = 20, Height = 30 })
	UI.label(container, "Modo fotógrafo: elige tipo de foto, encuadre, zoom y filtro. Las fotos se guardan en el álbum.", { TextSize = 13, Height = 50, Position = UDim2.fromOffset(0, 34) })
	UI.button(container, "📸 Abrir modo fotógrafo", function()
		ctx.close()
		require(Client.Shell).close()
		Actions.photoMode()
	end, { Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 90), Color = T.Accent })
	UI.button(container, "🎬 Grabar vídeo", function()
		require(Client.Shell).close()
		Actions.record()
	end, { Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 142) })
end
table.insert(apps, Camera)

local Style = { Id = "style", Name = "Estilo", Icon = "👕", Order = 15, Surfaces = { phone = true, panel = true }, Width = 520, Height = 480 }
local styleColors = {
	{ 240, 240, 240 }, { 30, 30, 35 }, { 200, 40, 40 }, { 40, 90, 200 }, { 50, 160, 90 }, { 250, 200, 40 },
	{ 255, 120, 0 }, { 140, 70, 200 }, { 255, 110, 170 }, { 120, 85, 60 }, { 90, 100, 110 }, { 0, 170, 190 },
}
function Style.build(container, ctx)
	local data = State.Data
	local shirt = data and data.Appearance.Shirt or 5
	local pants = data and data.Appearance.Pants or 2
	local function render()
		UI.clear(container)
		local s = UI.scroll(container, { Pad = 8 })
		UI.label(s, "Elige los colores de tu ropa. No cambia tu tono de piel. La ropa es estética: no hace falta para progresar.", { TextSize = 13, Height = 36, Color = T.Sub })
		local preview = UI.frame(s, { Height = 120, Color = T.Bg })
		UI.frame(preview, { Size = UDim2.fromOffset(60, 50), Position = UDim2.new(0.5, -30, 0, 10), Color = UI.rgb(styleColors[shirt]) })
		UI.frame(preview, { Size = UDim2.fromOffset(60, 50), Position = UDim2.new(0.5, -30, 0, 62), Color = UI.rgb(styleColors[pants]) })
		local function palette(label, current, set)
			UI.label(s, label, { Font = Enum.Font.GothamBold })
			local row = UI.frame(s, { Height = 34, Transparency = 1, Radius = false })
			UI.list(row, Enum.FillDirection.Horizontal, 4)
			for i, c in ipairs(styleColors) do
				UI.button(row, current == i and "●" or "", function()
					set(i)
					render()
				end, { Width = 30, Height = 30, Color = UI.rgb(c), TextColor = Color3.new(0.5, 0.5, 0.5) })
			end
		end
		palette("Camiseta / chaqueta", shirt, function(i)
			shirt = i
		end)
		palette("Pantalón", pants, function(i)
			pants = i
		end)
		local row = UI.row(s, 38)
		UI.button(row, "✅ Aplicar estilo", function()
			Net.call("Style.Set", { shirt = shirt, pants = pants })
		end, { Width = 160, Color = T.Ok })
		UI.button(row, "Usar mi avatar de Roblox", function()
			Net.call("Style.Set", { mode = "roblox" })
		end, { Width = 210 })
		UI.label(s, "Conjuntos guardados:", { Font = Enum.Font.GothamBold })
		local outfits = State.Data and State.Data.Appearance.Outfits or {}
		for slot = 1, 3 do
			local o = outfits[tostring(slot)]
			local r = UI.row(s, 32)
			UI.label(r, "Conjunto " .. slot .. (o and "" or " (vacío)"), { Size = UDim2.fromOffset(140, 28) })
			UI.button(r, "Guardar actual", function()
				Net.call("Style.SaveOutfit", { slot = slot })
			end, { Width = 130, Height = 28, TextSize = 12 })
			if o then
				UI.button(r, "Ponerse", function()
					shirt, pants = o.Shirt, o.Pants
					Net.call("Style.Set", { shirt = shirt, pants = pants })
					render()
				end, { Width = 90, Height = 28, TextSize = 12 })
			end
		end
	end
	render()
end
table.insert(apps, Style)

---------------------------------------------------------------------------
-- MENSAJES, CALENDARIO, TENDENCIAS, NOTICIAS, TAREAS
---------------------------------------------------------------------------
local Messages = { Id = "messages", Name = "Mensajes", Icon = "💬", Order = 16, Surfaces = { pc = true, phone = true }, Width = 600, Height = 480 }
function Messages.build(container, ctx)
	local function render()
		UI.clear(container)
		local s = UI.scroll(container, { Pad = 4 })
		UI.label(s, "Notificaciones y mensajes de esta sesión (" .. #State.Messages .. ")", { Font = Enum.Font.GothamBold })
		for _, m in ipairs(State.Messages) do
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, os.date("%H:%M", m.T) .. " · " .. m.Text, { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Messages)

local Calendar = { Id = "calendar", Name = "Calendario", Icon = "📅", Order = 17, Surfaces = { pc = true, phone = true }, Width = 600, Height = 480 }
function Calendar.build(container, ctx)
	local data = State.Data
	if not data then
		return
	end
	local s = UI.scroll(container, { Pad = 6 })
	local day = workspace:GetAttribute("GameDay") or 1
	local hour = workspace:GetAttribute("GameHour") or 12
	UI.title(s, "📅 Día " .. day .. " · Mes " .. data.Derived.Month .. " · " .. (workspace:GetAttribute("TimeLabel") or ""))
	UI.label(s, string.format("Hora: %02d:%02d · Clima: %s", math.floor(hour), math.floor((hour % 1) * 60), workspace:GetAttribute("Weather") or "Clear"), { TextSize = 13 })
	local h = data.Home
	UI.label(s, "🏠 Alquiler en " .. math.max(0, h.NextDue - h.PlayDays) .. " días de juego ($" .. h.Rent .. ")", { TextSize = 13 })
	for _, o in ipairs(data.Orders) do
		if o.Status == "En camino" then
			UI.label(s, "📦 Pedido #" .. o.Num .. " llega en " .. math.max(0, math.ceil(o.Eta - workspace:GetServerTimeNow())) .. " s", { TextSize = 13 })
		end
	end
	for _, p in pairs(data.Projects) do
		if p.Plan.Time ~= "" and p.Plan.Time ~= "Cualquiera" then
			UI.label(s, "🎬 «" .. p.Name .. "» planificado para: " .. p.Plan.Time, { TextSize = 13 })
		end
	end
	UI.label(s, "🌅 Hora dorada: 5:30-7:00 y 17:00-19:00 (mejores tomas exteriores).", { TextSize = 12, Color = T.Gold })
	UI.label(s, "Las tendencias cambian cada día. Un día dura " .. math.floor(Config.DayLengthSeconds / 60) .. " minutos reales.", { TextSize = 12, Color = T.Sub })
end
table.insert(apps, Calendar)

local Trends = { Id = "trends", Name = "Tendencias", Icon = "🔥", Order = 18, Surfaces = { pc = true, phone = true }, Width = 620, Height = 500 }
function Trends.build(container, ctx)
	local data = State.Data
	if not data then
		return
	end
	local tr = data.Derived.Trends
	local s = UI.scroll(container, { Pad = 6 })
	UI.title(s, "🔥 En tendencia hoy (x1,4 de alcance)")
	for _, id in ipairs(tr.Hot or {}) do
		local c = VideoData.CategoryById[id]
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, c.Name, { Font = Enum.Font.GothamBold })
		local spots = {}
		for _, sp in ipairs(WorldData.Spots) do
			if not sp.Secret and F.overlap(sp.Tags, c.Tags) > 0 and #spots < 4 then
				spots[#spots + 1] = sp.Name
			end
		end
		UI.label(card, "Dónde grabar: " .. table.concat(spots, ", "), { TextSize = 12, Color = T.Sub, Height = 30 })
		UI.button(card, "💡 Crear proyecto", function()
			Net.call("Video.CreateProject", { category = id })
		end, { Width = 160, Height = 26, TextSize = 12 })
	end
	if tr.Cold and tr.Cold ~= "" then
		UI.label(s, "🧊 De capa caída: " .. catName(tr.Cold) .. " (x0,85)", { Color = T.Accent2 })
	end
	UI.label(s, "Competencia hoy: " .. math.floor((1 - (tr.Competition or 1)) * 100) .. "% de visitas repartidas con otros creadores.", { TextSize = 12, Color = T.Sub })
end
table.insert(apps, Trends)

local News = { Id = "news", Name = "Noticias", Icon = "📰", Order = 19, Surfaces = { pc = true, phone = true }, Width = 620, Height = 500 }
function News.build(container, ctx)
	local data = State.Data
	if not data then
		return
	end
	local s = UI.scroll(container, { Pad = 8 })
	UI.title(s, "📰 Diario de la Ciudad")
	local tr = data.Derived.Trends
	local headlines = {}
	for _, id in ipairs(tr.Hot or {}) do
		headlines[#headlines + 1] = "Furor por los vídeos de " .. catName(id):lower() .. ": el público pide más."
	end
	local w = workspace:GetAttribute("Weather") or "Clear"
	local wText = { Clear = "Cielo despejado: día ideal para grabar en exteriores.", Cloudy = "Nubes sobre la ciudad: luz suave para retratos.", Rain = "Lluvia en la ciudad: protege tu cámara.", Fog = "Niebla matinal: fotos misteriosas en el lago y el bosque.", Storm = "Tormenta pasajera: mejor grabar en interiores un rato." }
	headlines[#headlines + 1] = wText[w] or ""
	headlines[#headlines + 1] = "MegaTec y FotoPro amplían su catálogo con " .. #Catalog.Order .. " productos."
	headlines[#headlines + 1] = "Rumores de lugares secretos: vecinos hablan de destellos dorados en " .. #WorldData.Secrets .. " rincones."
	if data.Channel.Subs >= 100 then
		headlines[#headlines + 1] = "El canal «" .. (data.Channel.Name ~= "" and data.Channel.Name or player.DisplayName) .. "» supera los " .. Util.formatInt(data.Channel.Subs) .. " suscriptores."
	end
	for _, hl in ipairs(headlines) do
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, hl, { TextSize = 14, Height = 0, Auto = Enum.AutomaticSize.Y })
	end
end
table.insert(apps, News)

local Tasks = { Id = "tasks", Name = "Tareas", Icon = "✅", Order = 20, Surfaces = { pc = true, phone = true }, Width = 600, Height = 480 }
function Tasks.build(container, ctx)
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local s = UI.scroll(container, { Pad = 6 })
		UI.title(s, "✅ Tus tareas")
		local items = {}
		local step = QuestDefs.Tutorial[data.Quests.Step]
		if step and not data.Quests.Skipped then
			items[#items + 1] = "🎓 " .. step.Name
		end
		for _, p in pairs(data.Projects) do
			if p.Status == "planning" then
				items[#items + 1] = "🎬 Graba escenas para «" .. p.Name .. "»"
			elseif p.Status == "recording" then
				items[#items + 1] = "🏠 Importa y edita «" .. p.Name .. "»"
			elseif p.Status == "editing" then
				items[#items + 1] = "⬆ Exporta «" .. p.Name .. "»"
			elseif p.Status == "exported" then
				items[#items + 1] = "🚀 Publica «" .. p.Name .. "» en ViewTube Studio"
			end
		end
		if data.Job and data.Job.Type then
			items[#items + 1] = "💼 Termina tu encargo de trabajo"
		end
		if data.Home.Debt > 0 then
			items[#items + 1] = "⚠ Paga la deuda del alquiler ($" .. data.Home.Debt .. ")"
		end
		local pending = 0
		for id in pairs(data.Quests.Completed) do
			if not data.Quests.Claimed[id] then
				pending = pending + 1
			end
		end
		if pending > 0 then
			items[#items + 1] = "🎁 Cobra " .. pending .. " recompensas en Misiones"
		end
		if #items == 0 then
			items[1] = "Todo al día. ¿Una nueva idea?"
		end
		for _, it in ipairs(items) do
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, it, { TextSize = 13 })
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Tasks)

---------------------------------------------------------------------------
-- MÚSICA Y ARCHIVOS
---------------------------------------------------------------------------
local Music = { Id = "music", Name = "Música", Icon = "🎵", Order = 21, Surfaces = { pc = true, phone = true }, Width = 640, Height = 500 }
function Music.build(container, ctx)
	local s = UI.scroll(container, { Pad = 6 })
	UI.label(s, "Biblioteca de música libre (ficticia). Asigna una pista a un proyecto: se guarda en su edición.", { TextSize = 12, Color = T.Sub, Height = 30 })
	for _, m in ipairs(VideoData.Music) do
		if m.Id ~= "none" then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "🎵 " .. m.Name .. " — " .. m.Artist .. " · " .. m.Mood, { Font = Enum.Font.GothamBold, TextSize = 13 })
			local fits = {}
			for _, id in ipairs(m.Fits) do
				fits[#fits + 1] = catName(id)
			end
			UI.label(card, "Encaja con: " .. table.concat(fits, ", "), { TextSize = 11, Color = T.Sub, Height = 28 })
			local row = UI.row(card, 28)
			for pid, p in pairs(State.Data and State.Data.Projects or {}) do
				UI.button(row, "→ " .. p.Name, function()
					local edit = Util.deepCopy(p.Edit)
					edit.Music = m.Id
					Net.call("Video.SaveEdit", { pid = pid, edit = edit })
				end, { Width = 150, Height = 26, TextSize = 11 })
			end
		end
	end
end
table.insert(apps, Music)

local Files = { Id = "files", Name = "Archivos", Icon = "📁", Order = 22, Surfaces = { pc = true }, Width = 720, Height = 520 }
function Files.build(container, ctx)
	local folder = "projects"
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local session = ctx.session() or {}
		local top = UI.row(container, 34)
		for _, f in ipairs({ { "projects", "📁 Proyectos" }, { "photos", "🖼 Fotos" }, { "thumbs", "🎨 Miniaturas" }, { "videos", "▶ Publicados" } }) do
			UI.button(top, f[2], function()
				folder = f[1]
				render()
			end, { Width = 130, Height = 28, Color = folder == f[1] and T.Accent or T.Panel3 })
		end
		local used = data.Derived.StorageUsed
		local cap = session.StorageGb or 0
		local srow = UI.row(container, 22)
		srow.Position = UDim2.fromOffset(0, 38)
		UI.label(srow, "💾 Almacenamiento: " .. used .. " / " .. Util.formatInt(cap) .. " GB", { Size = UDim2.fromOffset(260, 20), TextSize = 12 })
		UI.progress(srow, cap > 0 and used / cap or 0, used / math.max(cap, 1) > 0.85 and T.Err or T.Ok, { Size = UDim2.fromOffset(300, 10) })
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -66), Position = UDim2.fromOffset(0, 66), Pad = 4 })
		if folder == "projects" then
			for pid, p in pairs(data.Projects) do
				local gb = 0
				for _, sc in ipairs(p.Scenes) do
					if sc.Imp then
						gb = gb + sc.Gb
					end
				end
				local row = UI.row(s, 30)
				UI.label(row, "📁 " .. p.Name .. " · " .. #p.Scenes .. " escenas · " .. math.floor(gb * 10) / 10 .. " GB", { Size = UDim2.new(1, -110, 1, 0), TextSize = 12 })
				UI.button(row, "🗑 Papelera", function()
					Notify.confirm("¿Eliminar el proyecto «" .. p.Name .. "»?", function()
						Net.call("Video.DeleteProject", { pid = pid })
					end)
				end, { Width = 100, Height = 26, TextSize = 11 })
			end
		elseif folder == "photos" then
			for _, ph in ipairs(data.Photos) do
				local row = UI.row(s, 28)
				UI.label(row, "🖼 [" .. ph.Album .. "] " .. ph.SpotName .. " · Q" .. math.floor(ph.Q), { Size = UDim2.new(1, -110, 1, 0), TextSize = 12 })
				UI.button(row, "🗑 Papelera", function()
					Net.call("Photo.Delete", { id = ph.Id })
				end, { Width = 100, Height = 24, TextSize = 11 })
			end
		elseif folder == "thumbs" then
			for _, t in pairs(data.Thumbnails) do
				local row = UI.row(s, 28)
				UI.label(row, "🎨 «" .. t.Design.text .. "» ⭐" .. math.floor(t.Score), { Size = UDim2.new(1, -110, 1, 0), TextSize = 12 })
				UI.button(row, "🗑 Papelera", function()
					Net.call("Thumb.Delete", { id = t.Id })
				end, { Width = 100, Height = 24, TextSize = 11 })
			end
		else
			for _, v in ipairs(data.Videos) do
				UI.label(s, "▶ " .. v.Title .. " · " .. Util.formatInt(v.Views) .. " visitas", { TextSize = 12 })
			end
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Files)

---------------------------------------------------------------------------
-- AJUSTES (incluye tienda de Robux opcional)
---------------------------------------------------------------------------
local Settings = { Id = "settings", Name = "Ajustes", Icon = "⚙", Order = 30, Surfaces = { pc = true, phone = true, panel = true }, Width = 720, Height = 560 }
function Settings.build(container, ctx)
	local data = State.Data
	if not data then
		return
	end
	local st = Util.deepCopy(data.Settings)
	local s = UI.scroll(container, { Pad = 6 })
	local function save(key, value)
		st[key] = value
		Net.call("Settings.Set", { key = key, value = value }, { quietOk = true })
	end
	UI.title(s, "🔊 Sonido")
	UI.stepper(s, "Efectos", st.Sfx, 0, 1, 0.1, function(v)
		save("Sfx", v)
	end)
	UI.stepper(s, "Música", st.Music, 0, 1, 0.1, function(v)
		save("Music", v)
	end)
	UI.title(s, "🖥 Pantalla y accesibilidad")
	UI.stepper(s, "Tamaño interfaz", st.UIScale, 0.7, 1.4, 0.1, function(v)
		save("UIScale", v)
	end)
	UI.toggle(s, "Reducir animaciones", st.ReduceMotion, function(v)
		save("ReduceMotion", v)
	end)
	UI.toggle(s, "Sombras (gráficos)", st.Shadows ~= false, function(v)
		save("Shadows", v)
	end)
	UI.toggle(s, "Mostrar pistas del tutorial", st.Hints ~= false, function(v)
		save("Hints", v)
	end)
	local wps = {}
	for i = 1, 5 do
		wps[i] = "Fondo " .. i
	end
	UI.cycle(s, "Fondo del escritorio", wps, st.Wallpaper or 1, function(i)
		save("Wallpaper", i)
	end)
	UI.title(s, "🎮 Controles")
	UI.label(s, "PC: WASD moverse · Shift correr · E interactuar · P teléfono · I inventario · M misiones · R grabar · F foto · V estilo · C computador portátil · Esc cerrar.\nMóvil: joystick y botones de la parte inferior; toca los avisos para interactuar.", { TextSize = 12, Height = 70, VAlign = Enum.TextYAlignment.Top })
	if data.Derived.ReadOnly then
		UI.label(s, "⚠ Modo de prueba: los datos NO se guardan (Studio sin acceso a la API).", { Color = T.Warn, TextSize = 12 })
	end
	UI.title(s, "⭐ Apoya el juego (opcional, Robux)")
	UI.label(s, "Todo el juego se puede disfrutar sin pagar. Los pases dan comodidad o cosméticos, nunca contenido bloqueado.", { TextSize = 12, Color = T.Sub, Height = 30 })
	task.spawn(function()
		local r = Net.call("Shop.PassInfo", {}, { silent = true })
		if not r.ok or not s.Parent then
			return
		end
		for _, pass in ipairs(r.data.passes) do
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, pass.Name .. (pass.Owned and " ✔" or ""), { Font = Enum.Font.GothamBold, TextSize = 13 })
			UI.label(card, pass.Desc, { TextSize = 12, Color = T.Sub, Height = 30 })
			if not pass.Configured then
				UI.label(card, "No configurado (falta el ID en MonetizationConfig).", { TextSize = 11, Color = T.Warn })
			elseif not pass.Owned then
				UI.button(card, "Comprar", function()
					MarketplaceService:PromptGamePassPurchase(player, pass.Id)
				end, { Width = 100, Height = 26 })
			end
		end
		for _, prod in ipairs(r.data.products) do
			local row = UI.row(s, 30)
			UI.label(row, prod.Name, { Size = UDim2.fromOffset(280, 26), TextSize = 12 })
			if prod.Configured then
				UI.button(row, "Comprar", function()
					MarketplaceService:PromptProductPurchase(player, prod.Id)
				end, { Width = 100, Height = 26 })
			else
				UI.label(row, "No configurado", { Size = UDim2.fromOffset(140, 26), TextSize = 11, Color = T.Warn })
			end
		end
	end)
end
table.insert(apps, Settings)

return apps
