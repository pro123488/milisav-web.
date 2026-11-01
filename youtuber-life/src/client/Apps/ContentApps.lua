--!nonstrict
-- Apps de creación: Ideas y proyectos, Editor de vídeo, Miniaturas, ViewTube Studio y Estadísticas.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local PhotoView = require(Client.PhotoView)
local VideoData = require(Shared.VideoData)
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)
local F = require(Shared.VideoFormulas)
local LifeData = require(Shared.LifeData)
local T = UI.Theme

local apps = {}

local function projectsList()
	local out = {}
	for pid, p in pairs(State.Data and State.Data.Projects or {}) do
		out[#out + 1] = p
	end
	table.sort(out, function(a, b)
		return a.Created > b.Created
	end)
	return out
end

local statusNames = { planning = "Planificando", recording = "Grabando", editing = "Editando", exported = "Exportado" }

local function catName(id)
	local c = VideoData.CategoryById[id]
	return c and c.Name or id
end

local function photoById(id)
	for _, ph in ipairs(State.Data and State.Data.Photos or {}) do
		if ph.Id == id then
			return ph
		end
	end
	return nil
end

---------------------------------------------------------------------------
-- Miniatura: dibujo del diseño (lo usan Miniaturas, Studio y Estadísticas)
---------------------------------------------------------------------------
local function drawThumb(parent, design, size)
	local box = UI.frame(parent, { Size = size or UDim2.fromOffset(320, 180), Color = UI.rgb(VideoData.Palette[design.bg or 2] or { 20, 20, 24 }), Clip = true, Radius = 6 })
	local photo = design.photoId and photoById(design.photoId) or (design.photoCam and { Cam = design.photoCam, Filter = design.photoFilter, SpotName = design.photoSpot, Hour = 12 }) or nil
	local tpl = design.template or "center"
	local photoSize, photoPos = UDim2.fromScale(1, 1), UDim2.new()
	if tpl == "left" then
		photoSize, photoPos = UDim2.fromScale(0.6, 1), UDim2.fromScale(0.4, 0)
	elseif tpl == "split" then
		photoSize = UDim2.fromScale(0.5, 1)
	end
	if photo then
		PhotoView.render(box, photo, photoSize).Position = photoPos
		if tpl == "split" then
			local second = PhotoView.render(box, photo, UDim2.fromScale(0.5, 1))
			second.Position = UDim2.fromScale(0.5, 0)
			local tint = UI.frame(second, { Size = UDim2.fromScale(1, 1), Color = Color3.fromRGB(255, 200, 0), Transparency = 0.75, Radius = false })
			tint.ZIndex = 5
		end
	end
	-- {x, y, ancho, alto} en escala
	local box4, align = { 0.05, 0.3, 0.9, 0.4 }, Enum.TextXAlignment.Center
	if tpl == "left" then
		box4, align = { 0.03, 0.1, 0.4, 0.8 }, Enum.TextXAlignment.Left
	elseif tpl == "top" then
		box4 = { 0.03, 0.03, 0.94, 0.3 }
	elseif tpl == "split" then
		box4 = { 0.03, 0.68, 0.94, 0.28 }
	elseif tpl == "corner" then
		box4, align = { 0.03, 0.62, 0.6, 0.34 }, Enum.TextXAlignment.Left
	end
	local s = design.textSize or 1
	local lbl = UI.label(box, design.text or "", { Size = UDim2.fromScale(box4[3], math.min(0.95, box4[4] * s)), Position = UDim2.fromScale(box4[1], box4[2]), Scaled = true, Align = align, Font = Enum.Font[design.font or "GothamBlack"] or Enum.Font.GothamBlack, Color = UI.rgb(VideoData.Palette[design.textColor or 1] or { 255, 255, 255 }) })
	lbl.ZIndex = 8
	if design.outline then
		lbl.TextStrokeTransparency = 0
		lbl.TextStrokeColor3 = Color3.new(0, 0, 0)
	end
	for i, st in ipairs(design.stickers or {}) do
		for _, def in ipairs(VideoData.Stickers) do
			if def.Id == st then
				local sl = UI.label(box, def.Glyph, { Size = UDim2.fromScale(0.16, 0.22), Position = UDim2.fromScale(0.82 - (i - 1) * 0.15, 0.04), Scaled = true, Font = Enum.Font.GothamBlack, Color = T.Gold, Align = Enum.TextXAlignment.Center })
				sl.ZIndex = 9
				sl.TextStrokeTransparency = 0
			end
		end
	end
	if design.frame and design.frame ~= "none" then
		local col = design.frame == "neon" and Color3.fromRGB(0, 255, 220) or Color3.new(1, 1, 1)
		UI.stroke(box, col, design.frame == "double" and 6 or 3)
	end
	return box
end
apps.drawThumb = drawThumb

---------------------------------------------------------------------------
-- IDEAS Y PROYECTOS
---------------------------------------------------------------------------
local Ideas = { Id = "ideas", Name = "Ideas", Icon = "💡", Order = 1, Surfaces = { pc = true, phone = true, panel = true }, Width = 820, Height = 540 }

function Ideas.build(container, ctx)
	local editing = nil
	local draft = nil
	local nameBox
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local s = UI.scroll(container, { Pad = 8 })
		local hot = data.Derived.Trends.Hot or {}
		local hotNames = {}
		for _, id in ipairs(hot) do
			hotNames[#hotNames + 1] = catName(id)
		end
		UI.label(s, "🔥 Tendencias de hoy: " .. table.concat(hotNames, ", ") .. "   (vídeos de estas categorías llegan a más gente)", { Color = T.Gold, TextSize = 13, Height = 34 })
		if editing and data.Projects[editing] then
			local proj = data.Projects[editing]
			UI.title(s, "📝 Plan de «" .. proj.Name .. "» (" .. catName(proj.Category) .. ")")
			local plan = draft
			UI.cycle(s, "Estilo", VideoData.Styles, plan.Style, function(i)
				plan.Style = i
			end)
			local durNames, durIdx = {}, 1
			for i, d in ipairs(VideoData.Durations) do
				durNames[i] = d.Name
				if d.Id == plan.Duration then
					durIdx = i
				end
			end
			UI.cycle(s, "Duración objetivo", durNames, durIdx, function(i)
				plan.Duration = VideoData.Durations[i].Id
			end)
			UI.cycle(s, "Objetivo", VideoData.Goals, plan.Goal, function(i)
				plan.Goal = i
			end)
			UI.cycle(s, "Transporte", VideoData.Transport, plan.Transport, function(i)
				plan.Transport = i
			end)
			local times = { "Cualquiera", "Mañana", "Mediodía", "Hora dorada", "Noche" }
			UI.cycle(s, "Hora de grabación", times, math.max(1, Util.indexOf(times, plan.Time) or 1), function(i)
				plan.Time = times[i]
			end)
			UI.stepper(s, "Presupuesto", plan.Budget or 0, 0, 100000, 50, function(v)
				plan.Budget = v
			end, { Format = function(v)
				return "$" .. v
			end })
			-- Lugar: recomendados primero
			local cat = VideoData.CategoryById[proj.Category]
			local spots = { { Id = "", Name = "Sin definir" }, { Id = "home", Name = "Tu habitación" } }
			for _, sp in ipairs(WorldData.Spots) do
				if not sp.Secret and F.overlap(sp.Tags, cat.Tags) > 0 then
					spots[#spots + 1] = { Id = sp.Id, Name = "⭐ " .. sp.Name }
				end
			end
			for _, sp in ipairs(WorldData.Spots) do
				if not sp.Secret and F.overlap(sp.Tags, cat.Tags) == 0 then
					spots[#spots + 1] = { Id = sp.Id, Name = sp.Name }
				end
			end
			local names, idx = {}, 1
			for i, sp in ipairs(spots) do
				names[i] = sp.Name
				if sp.Id == plan.Location then
					idx = i
				end
			end
			UI.cycle(s, "Lugar (⭐ = encaja)", names, idx, function(i)
				plan.Location = spots[i].Id
			end, { ValueWidth = 260 })
			-- Productos a mostrar (de tu inventario)
			UI.label(s, "Productos del vídeo (para reseñas/comparativas, llévalos en la mochila):", { Color = T.Sub, TextSize = 13 })
			local prodRow = UI.frame(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
			UI.grid(prodRow, 200, 30, 4)
			local seen = {}
			for _, it in ipairs(State.items(function(rec, def)
				return def.Cat ~= "component" and def.Cat ~= "storage" and def.Slot ~= "battery"
			end)) do
				if not seen[it.Def.Id] then
					seen[it.Def.Id] = true
					local on = Util.indexOf(plan.Featured, it.Def.Id) ~= nil
					local b
					b = UI.button(prodRow, (on and "✔ " or "") .. it.Def.Name, function()
						local i = Util.indexOf(plan.Featured, it.Def.Id)
						if i then
							table.remove(plan.Featured, i)
						elseif #plan.Featured < 4 then
							table.insert(plan.Featured, it.Def.Id)
						end
						render()
					end, { Size = UDim2.fromOffset(200, 30), TextSize = 11, Color = on and T.Ok or T.Panel3 })
				end
			end
			local row = UI.row(s, 38)
			UI.button(row, "💾 Guardar plan", function()
				Net.call("Video.UpdatePlan", { pid = editing, plan = draft })
			end, { Color = T.Ok, Width = 150 })
			if plan.Location ~= "" and plan.Location ~= "home" then
				UI.button(row, "🚕 Taxi al lugar", function()
					Net.call("Travel.TaxiSpot", { spot = plan.Location })
				end, { Width = 150 })
			end
			UI.button(row, "◀ Volver", function()
				editing = nil
				render()
			end, { Width = 110 })
			-- Lista de comprobación de la mochila
			local bag = {}
			for _, it in ipairs(State.items(function(rec)
				return rec.Loc == "backpack"
			end)) do
				bag[#bag + 1] = it.Def.Name
			end
			UI.label(s, "🎒 En tu mochila: " .. (#bag > 0 and table.concat(bag, ", ") or "nada (prepárala en casa con el Inventario)"), { Color = T.Sub, TextSize = 13, Height = 40 })
			return
		end
		UI.title(s, "💡 Nueva idea")
		nameBox = UI.input(s, "Nombre del proyecto (opcional)", "")
		local grid = UI.frame(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
		UI.grid(grid, ctx.kind == "phone" and 128 or 150, 34, 6)
		for _, c in ipairs(VideoData.Categories) do
			local isHot = Util.indexOf(hot, c.Id) ~= nil
			UI.button(grid, (isHot and "🔥 " or "") .. c.Name, function()
				local r = Net.call("Video.CreateProject", { category = c.Id, name = nameBox.Text })
				if r.ok then
					nameBox.Text = ""
				end
			end, { Size = UDim2.fromOffset(150, 34), TextSize = 12, Color = isHot and Color3.fromRGB(120, 40, 50) or T.Panel3 })
		end
		local projects = projectsList()
		UI.title(s, "📁 Tus proyectos (" .. #projects .. ")")
		if #projects == 0 then
			UI.label(s, "Aún no tienes proyectos. Elige una idea arriba.", { Color = T.Sub })
		end
		for _, p in ipairs(projects) do
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, p.Name .. "  ·  " .. catName(p.Category), { Font = Enum.Font.GothamBold })
			local imported = 0
			for _, sc in ipairs(p.Scenes) do
				if sc.Imp then
					imported = imported + 1
				end
			end
			local loc = p.Plan.Location ~= "" and (p.Plan.Location == "home" and "Tu habitación" or (WorldData.SpotById[p.Plan.Location] and WorldData.SpotById[p.Plan.Location].Name or "?")) or "sin lugar"
			UI.label(card, (statusNames[p.Status] or p.Status) .. " · " .. #p.Scenes .. " escenas (" .. imported .. " importadas) · " .. loc, { Color = T.Sub, TextSize = 12 })
			local row = UI.row(card, 32)
			UI.button(row, "📝 Planificar", function()
				editing = p.Id
				draft = Util.deepCopy(p.Plan)
				render()
			end, { Width = 120, Height = 28, TextSize = 12 })
			UI.button(row, "⧉ Duplicar", function()
				Net.call("Video.DuplicateProject", { pid = p.Id })
			end, { Width = 100, Height = 28, TextSize = 12 })
			UI.button(row, "🗑 Eliminar", function()
				Notify.confirm("¿Eliminar «" .. p.Name .. "» y todas sus escenas? No se puede deshacer.", function()
					Net.call("Video.DeleteProject", { pid = p.Id })
				end, "Eliminar")
			end, { Width = 100, Height = 28, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		end
	end
	render()
	ctx.onState(function()
		if not editing then
			render()
		end
	end)
end
table.insert(apps, Ideas)

---------------------------------------------------------------------------
-- EDITOR DE VÍDEO
---------------------------------------------------------------------------
local Editor = { Id = "editor", Name = "Editor", Icon = "🎞", Order = 2, Surfaces = { pc = true, phone = true, panel = false }, Width = 960, Height = 580 }

local function entryInfo(proj, e)
	if e.k == "s" then
		for _, sc in ipairs(proj.Scenes) do
			if sc.Id == e.id then
				local shot = VideoData.ShotById[sc.Shot]
				return (shot and shot.Name or sc.Shot), sc.SpotName, sc.Q, sc.Sec, sc
			end
		end
	else
		local ph = photoById(e.id)
		if ph then
			return "Foto", ph.SpotName, ph.Q, 4, ph
		end
	end
	return "?", "", 0, 0
end

function Editor.build(container, ctx)
	local pid, draft, dirty, lastEval = nil, nil, false, nil
	local transIds = {}
	for _, t in ipairs(VideoData.Transitions) do
		transIds[#transIds + 1] = t.Id
	end

	local function loadProject(id)
		pid = id
		local proj = State.Data.Projects[id]
		draft = proj and Util.deepCopy(proj.Edit) or nil
		dirty = false
		lastEval = nil
	end

	local render
	local function preview(proj)
		local overlay = UI.frame(container, { Size = UDim2.fromScale(1, 1), Color = Color3.new(0, 0, 0), Radius = false })
		overlay.ZIndex = 20
		local screen = UI.frame(overlay, { Size = UDim2.new(0.8, 0, 0.75, 0), Position = UDim2.fromScale(0.5, 0.45), Anchor = Vector2.new(0.5, 0.5), Color = T.Bg, Clip = true })
		local info = UI.label(overlay, "", { Size = UDim2.new(1, -20, 0, 24), Position = UDim2.new(0, 10, 1, -64), Align = Enum.TextXAlignment.Center })
		local bar, fill = UI.progress(overlay, 0, T.Accent, { Size = UDim2.new(0.8, 0, 0, 8) })
		bar.Position = UDim2.new(0.1, 0, 1, -30)
		UI.button(overlay, "✕ Cerrar vista previa", function()
			overlay:Destroy()
		end, { Position = UDim2.new(1, -10, 0, 10), Anchor = Vector2.new(1, 0), Width = 180, Color = T.Accent })
		local music = VideoData.MusicById[draft.Music]
		task.spawn(function()
			local total = #draft.Timeline
			for i, e in ipairs(draft.Timeline) do
				if not overlay.Parent then
					return
				end
				UI.clear(screen)
				local name, spot, q, sec, obj = entryInfo(proj, e)
				if e.k == "p" then
					PhotoView.render(screen, obj)
				else
					local hue = (Util.hashString(spot or "") % 360) / 360
					local bg = UI.frame(screen, { Size = UDim2.fromScale(1, 1), Color = Color3.fromHSV(hue, 0.5, 0.45), Radius = false })
					UI.label(bg, "🎬 " .. name .. "\n📍 " .. tostring(spot), { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBlack, TextSize = 26 })
				end
				local c = draft.Color
				if c.b ~= 0 or c.s ~= 0 then
					local ov = UI.frame(screen, { Size = UDim2.fromScale(1, 1), Color = c.b > 0 and Color3.new(1, 1, 1) or Color3.new(0, 0, 0), Transparency = 1 - math.min(0.4, math.abs(c.b) / 200), Radius = false })
					ov.ZIndex = 5
				end
				if i == 1 and draft.Titles and draft.TitleText ~= "" then
					local tl = UI.label(screen, draft.TitleText, { Size = UDim2.new(1, 0, 0.2, 0), Position = UDim2.fromScale(0, 0.05), Scaled = true, Font = Enum.Font.GothamBlack, Align = Enum.TextXAlignment.Center })
					tl.ZIndex = 6
					tl.TextStrokeTransparency = 0
				end
				if draft.Subtitles then
					local sub = UI.label(screen, "[Subtítulos] " .. name .. " en " .. tostring(spot), { Size = UDim2.new(1, 0, 0.1, 0), Position = UDim2.fromScale(0, 0.86), Align = Enum.TextXAlignment.Center, TextSize = 16 })
					sub.ZIndex = 6
					sub.BackgroundTransparency = 0.4
					sub.BackgroundColor3 = Color3.new(0, 0, 0)
				end
				info.Text = string.format("%d/%d · %s · transición: %s · música: %s", i, total, name, e.tr, music and music.Name or "ninguna")
				fill.Size = UDim2.new(i / total, 0, 1, 0)
				if e.tr ~= "cut" then
					screen.BackgroundTransparency = 1
					UI.tween(screen, { BackgroundTransparency = 0 }, 0.3)
				end
				task.wait(math.clamp((sec or 4) * (e.trim or 1) / 12, 0.8, 3))
			end
			info.Text = "Fin de la vista previa"
		end)
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local session = ctx.session()
		local projects = projectsList()
		if #projects == 0 then
			UI.label(container, "No tienes proyectos. Crea uno en la app Ideas y graba escenas.", { Color = T.Sub, Height = 40 })
			return
		end
		if not pid or not data.Projects[pid] then
			loadProject(projects[1].Id)
		end
		local proj = data.Projects[pid]
		local maxClips = session and session.MaxScenes or 8
		-- Barra superior
		local top = UI.row(container, 36)
		local names, idx = {}, 1
		for i, p in ipairs(projects) do
			names[i] = p.Name
			if p.Id == pid then
				idx = i
			end
		end
		UI.cycle(top, "Proyecto", names, idx, function(i)
			if dirty then
				Notify.toast("Cambios sin guardar descartados.", "warn")
			end
			loadProject(projects[i].Id)
			render()
		end, { LabelWidth = 70, ValueWidth = 170 })
		local notImported = 0
		for _, sc in ipairs(proj.Scenes) do
			if not sc.Imp then
				notImported = notImported + 1
			end
		end
		UI.button(top, "⤓ Importar (" .. notImported .. ")", function()
			Net.call("Video.Import", { pid = pid })
		end, { Width = 120, Height = 30, TextSize = 12, Color = notImported > 0 and T.Accent2 or T.Panel3 })
		UI.button(top, "💾 Guardar" .. (dirty and " *" or ""), function()
			local r = Net.call("Video.SaveEdit", { pid = pid, edit = draft })
			if r.ok then
				dirty = false
				lastEval = r.data.eval
				render()
			end
		end, { Width = 100, Height = 30, TextSize = 12, Color = T.Ok })
		UI.button(top, "▶ Vista previa", function()
			if #draft.Timeline > 0 then
				preview(proj)
			end
		end, { Width = 110, Height = 30, TextSize = 12 })
		UI.button(top, "⧉ Versión", function()
			Net.call("Video.SaveVersion", { pid = pid })
		end, { Width = 90, Height = 30, TextSize = 12 })
		local exportBtn = UI.button(top, "⬆ Exportar", function()
			if dirty then
				Notify.toast("Guarda los cambios antes de exportar.", "warn")
				return
			end
			Net.call("Video.Export", { pid = pid })
		end, { Width = 100, Height = 30, TextSize = 12, Color = T.Accent })
		-- Progreso de exportación
		if proj.Export and proj.Export.ReadyAt then
			local prow = UI.row(container, 22)
			local bar, fill = UI.progress(prow, 0, T.Accent, { Size = UDim2.new(0.6, 0, 0, 10) })
			local lbl = UI.label(prow, "", { Size = UDim2.new(0.38, 0, 1, 0), TextSize = 12 })
			task.spawn(function()
				while lbl.Parent do
					local now = workspace:GetServerTimeNow()
					local total = math.max(1, proj.Export.Secs or 1)
					local remaining = proj.Export.ReadyAt - now
					fill.Size = UDim2.new(math.clamp(1 - remaining / total, 0, 1), 0, 1, 0)
					if remaining <= 0 then
						lbl.Text = "✅ Exportado (calidad " .. math.floor(proj.Export.Res.Final) .. "). Publícalo en ViewTube Studio."
						break
					end
					lbl.Text = "Exportando... " .. math.ceil(remaining) .. " s"
					task.wait(0.25)
				end
			end)
		end
		-- Cuerpo: biblioteca | línea de tiempo | ajustes
		local body = UI.frame(container, { Size = UDim2.new(1, 0, 1, -(proj.Export and 90 or 66)), Position = UDim2.fromOffset(0, proj.Export and 64 or 42), Transparency = 1, Radius = false })
		local narrow = ctx.kind == "phone"
		local lib = UI.scroll(body, { Size = narrow and UDim2.new(1, 0, 0.3, 0) or UDim2.new(0.26, -6, 1, 0), Color = T.Panel2, Transparency = 0 })
		UI.label(lib, "📚 Biblioteca de clips", { Font = Enum.Font.GothamBold })
		for _, sc in ipairs(proj.Scenes) do
			local shot = VideoData.ShotById[sc.Shot]
			local card = UI.card(lib, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel3 })
			UI.label(card, (shot and shot.Name or sc.Shot) .. " · Q" .. math.floor(sc.Q), { Font = Enum.Font.GothamBold, TextSize = 12 })
			UI.label(card, "📍 " .. sc.SpotName .. " · " .. sc.Dev .. (sc.Feat and (" · 📦 " .. (Catalog.get(sc.Feat) and Catalog.get(sc.Feat).Name or "")) or ""), { TextSize = 11, Color = T.Sub, Height = 28 })
			if #sc.Probs > 0 then
				UI.label(card, "⚠ " .. table.concat(sc.Probs, ", "), { TextSize = 11, Color = T.Warn })
			end
			local row = UI.row(card, 26)
			if sc.Imp then
				UI.button(row, "+ Añadir", function()
					if #draft.Timeline >= maxClips then
						Notify.toast("Tu equipo admite " .. maxClips .. " clips. Mejora el computador.", "warn")
						return
					end
					table.insert(draft.Timeline, { k = "s", id = sc.Id, trim = 1, tr = "cut" })
					dirty = true
					render()
				end, { Width = 80, Height = 24, TextSize = 11, Color = T.Accent2 })
			else
				UI.label(row, "Sin importar", { Size = UDim2.fromOffset(80, 24), TextSize = 11, Color = T.Warn })
			end
			UI.button(row, "🗑", function()
				Notify.confirm("¿Borrar esta escena del proyecto?", function()
					Net.call("Video.DeleteScene", { pid = pid, sceneId = sc.Id })
				end)
			end, { Width = 30, Height = 24, TextSize = 11 })
		end
		UI.label(lib, "🖼 Fotos del álbum", { Font = Enum.Font.GothamBold })
		for i, ph in ipairs(data.Photos) do
			if i <= 20 then
				local row = UI.row(lib, 26)
				UI.label(row, ph.SpotName .. " Q" .. math.floor(ph.Q), { Size = UDim2.new(1, -60, 1, 0), TextSize = 11 })
				UI.button(row, "+", function()
					if #draft.Timeline >= maxClips then
						return
					end
					table.insert(draft.Timeline, { k = "p", id = ph.Id, trim = 1, tr = "cut" })
					dirty = true
					render()
				end, { Width = 40, Height = 24, TextSize = 12 })
			end
		end
		-- Línea de tiempo
		local tlFrame = UI.frame(body, { Size = narrow and UDim2.new(1, 0, 0.3, 0) or UDim2.new(0.44, -6, 1, 0), Position = narrow and UDim2.fromScale(0, 0.32) or UDim2.new(0.26, 0, 0, 0), Color = T.Bg })
		UI.padding(tlFrame, 6)
		UI.label(tlFrame, "🎬 Línea de tiempo · " .. #draft.Timeline .. "/" .. maxClips .. " clips · pista de vídeo + pista de audio (" .. ((VideoData.MusicById[draft.Music] or {}).Name or "-") .. ")", { TextSize = 12, Font = Enum.Font.GothamBold, Height = 20 })
		local tl = UI.scroll(tlFrame, { Size = UDim2.new(1, 0, 1, -24), Position = UDim2.fromOffset(0, 24), Pad = 4 })
		local totalSec = 0
		for i, e in ipairs(draft.Timeline) do
			local name, spot, q, sec = entryInfo(proj, e)
			totalSec = totalSec + (sec or 0) * e.trim
			local card = UI.card(tl, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = e.k == "p" and Color3.fromRGB(50, 45, 80) or T.Panel2 })
			UI.label(card, i .. ". " .. name .. " · " .. tostring(spot) .. " · Q" .. math.floor(q or 0), { TextSize = 12, Font = Enum.Font.GothamBold })
			local row = UI.row(card, 26, nil, 3)
			UI.button(row, "▲", function()
				if i > 1 then
					draft.Timeline[i], draft.Timeline[i - 1] = draft.Timeline[i - 1], draft.Timeline[i]
					dirty = true
					render()
				end
			end, { Width = 26, Height = 24, TextSize = 11 })
			UI.button(row, "▼", function()
				if i < #draft.Timeline then
					draft.Timeline[i], draft.Timeline[i + 1] = draft.Timeline[i + 1], draft.Timeline[i]
					dirty = true
					render()
				end
			end, { Width = 26, Height = 24, TextSize = 11 })
			UI.button(row, "✂−", function()
				e.trim = math.max(0.3, math.floor((e.trim - 0.1) * 10 + 0.5) / 10)
				dirty = true
				render()
			end, { Width = 32, Height = 24, TextSize = 11 })
			UI.label(row, math.floor(e.trim * 100) .. "%", { Size = UDim2.fromOffset(38, 24), TextSize = 11, Align = Enum.TextXAlignment.Center })
			UI.button(row, "✂+", function()
				e.trim = math.min(1, math.floor((e.trim + 0.1) * 10 + 0.5) / 10)
				dirty = true
				render()
			end, { Width = 32, Height = 24, TextSize = 11 })
			if i > 1 then
				UI.button(row, "⇄ " .. e.tr, function()
					local j = (Util.indexOf(transIds, e.tr) or 1) % #transIds + 1
					e.tr = transIds[j]
					dirty = true
					render()
				end, { Width = 80, Height = 24, TextSize = 11 })
			end
			UI.button(row, "✕", function()
				table.remove(draft.Timeline, i)
				dirty = true
				render()
			end, { Width = 26, Height = 24, TextSize = 11, Color = Color3.fromRGB(110, 40, 40) })
		end
		local durTarget = 120
		for _, d in ipairs(VideoData.Durations) do
			if d.Id == proj.Plan.Duration then
				durTarget = d.Seconds
			end
		end
		UI.label(tl, "Duración: " .. math.floor(totalSec) .. " s (objetivo " .. durTarget .. " s)", { TextSize = 12, Color = T.Sub })
		-- Ajustes
		local set = UI.scroll(body, { Size = narrow and UDim2.new(1, 0, 0.36, 0) or UDim2.new(0.3, 0, 1, 0), Position = narrow and UDim2.fromScale(0, 0.64) or UDim2.new(0.7, 0, 0, 0), Color = T.Panel2, Transparency = 0 })
		local function mark()
			dirty = true
		end
		UI.toggle(set, "Títulos", draft.Titles, function(v)
			draft.Titles = v
			mark()
		end)
		local tbox = UI.input(set, "Texto del título", draft.TitleText)
		tbox.FocusLost:Connect(function()
			draft.TitleText = tbox.Text
			mark()
		end)
		UI.toggle(set, "Subtítulos", draft.Subtitles, function(v)
			draft.Subtitles = v
			mark()
		end)
		local musicNames, mIdx = {}, 1
		for i, m in ipairs(VideoData.Music) do
			musicNames[i] = m.Name .. (m.Mood ~= "Neutral" and (" (" .. m.Mood .. ")") or "")
			if m.Id == draft.Music then
				mIdx = i
			end
		end
		UI.cycle(set, "Música", musicNames, mIdx, function(i)
			draft.Music = VideoData.Music[i].Id
			mark()
		end, { LabelWidth = 60, ValueWidth = 150 })
		UI.stepper(set, "Vol. música", draft.MusicVol, 0, 1, 0.05, function(v)
			draft.MusicVol = v
			mark()
		end, { LabelWidth = 90 })
		UI.stepper(set, "Vol. voz", draft.VoiceVol, 0, 1, 0.05, function(v)
			draft.VoiceVol = v
			mark()
		end, { LabelWidth = 90 })
		UI.label(set, "Efectos:", { Color = T.Sub, TextSize = 12 })
		for _, fx in ipairs(VideoData.Effects) do
			UI.toggle(set, fx.Name, Util.indexOf(draft.Effects, fx.Id) ~= nil, function(v)
				local i = Util.indexOf(draft.Effects, fx.Id)
				if v and not i then
					table.insert(draft.Effects, fx.Id)
				elseif not v and i then
					table.remove(draft.Effects, i)
				end
				mark()
			end, { Width = 200 })
		end
		UI.stepper(set, "Brillo", draft.Color.b, -100, 100, 5, function(v)
			draft.Color.b = v
			mark()
		end, { LabelWidth = 90 })
		UI.stepper(set, "Contraste", draft.Color.c, -100, 100, 5, function(v)
			draft.Color.c = v
			mark()
		end, { LabelWidth = 90 })
		UI.stepper(set, "Saturación", draft.Color.s, -100, 100, 5, function(v)
			draft.Color.s = v
			mark()
		end, { LabelWidth = 90 })
		local function idsNames(list)
			local n, ids = {}, {}
			for i, it in ipairs(list) do
				n[i] = it.Name
				ids[i] = it.Id
			end
			return n, ids
		end
		local iN, iIds = idsNames(VideoData.Intros)
		UI.cycle(set, "Intro", iN, Util.indexOf(iIds, draft.Intro) or 1, function(i)
			draft.Intro = iIds[i]
			mark()
		end, { LabelWidth = 50, ValueWidth = 160 })
		local oN, oIds = idsNames(VideoData.Outros)
		UI.cycle(set, "Cierre", oN, Util.indexOf(oIds, draft.Outro) or 1, function(i)
			draft.Outro = oIds[i]
			mark()
		end, { LabelWidth = 50, ValueWidth = 160 })
		if lastEval then
			local card = UI.card(set, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel3 })
			UI.label(card, "📊 Calidad estimada: " .. math.floor(lastEval.Final) .. "/100", { Font = Enum.Font.GothamBold })
			UI.label(card, "Material " .. math.floor(lastEval.Footage) .. " · Edición " .. math.floor(lastEval.EditQuality), { TextSize = 12, Color = T.Sub })
			for _, d in ipairs(lastEval.Details or {}) do
				UI.label(card, "• " .. d, { TextSize = 11, Color = T.Sub })
			end
		end
		if #proj.Versions > 0 then
			UI.label(set, "Versiones guardadas:", { Color = T.Sub, TextSize = 12 })
			for i, v in ipairs(proj.Versions) do
				UI.button(set, "↺ " .. v.Label, function()
					Net.call("Video.RestoreVersion", { pid = pid, index = i })
				end, { Size = UDim2.new(1, -8, 0, 26), TextSize = 11 })
			end
		end
	end
	render()
	ctx.onState(function()
		local data = State.Data
		if pid and data and data.Projects[pid] then
			local srv = data.Projects[pid]
			if not dirty then
				draft = Util.deepCopy(srv.Edit)
			end
		end
		render()
	end)
end
table.insert(apps, Editor)

---------------------------------------------------------------------------
-- MINIATURAS
---------------------------------------------------------------------------
local Thumbs = { Id = "thumbs", Name = "Miniaturas", Icon = "🖼", Order = 3, Surfaces = { pc = true, phone = true, panel = false }, Width = 900, Height = 560 }

function Thumbs.build(container, ctx)
	local design = { text = "", font = "GothamBlack", textColor = 1, bg = 2, outline = true, frame = "none", template = "left", stickers = {}, photoId = nil, textSize = 1 }
	if ctx.params.photoId then
		design.photoId = ctx.params.photoId
	end
	local linkPid = nil
	local lastScore = nil
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local narrow = ctx.kind == "phone"
		local left = UI.frame(container, { Size = narrow and UDim2.new(1, 0, 0, 200) or UDim2.new(0.5, -6, 1, 0), Transparency = 1, Radius = false })
		drawThumb(left, design, narrow and UDim2.fromOffset(290, 163) or UDim2.fromOffset(420, 236))
		if lastScore then
			local sc = UI.card(left, { Height = 0, Auto = Enum.AutomaticSize.Y })
			sc.Position = UDim2.fromOffset(0, 246)
			sc.Size = UDim2.new(1, 0, 0, 0)
			UI.label(sc, "⭐ Puntuación " .. math.floor(lastScore.Score) .. "/100", { Font = Enum.Font.GothamBold })
			UI.label(sc, "Legibilidad " .. math.floor(lastScore.Readability) .. " · Composición " .. math.floor(lastScore.Composition) .. " · Relevancia " .. math.floor(lastScore.Relevance), { TextSize = 12, Color = T.Sub })
			for _, d in ipairs(lastScore.Details or {}) do
				UI.label(sc, "• " .. d, { TextSize = 12, Color = T.Warn })
			end
			UI.label(sc, "Una buena miniatura mejora la tasa de clics, pero no garantiza visitas.", { TextSize = 11, Color = T.Sub })
		end
		local right = UI.scroll(container, { Size = narrow and UDim2.new(1, 0, 1, -210) or UDim2.new(0.5, 0, 1, 0), Position = narrow and UDim2.fromOffset(0, 210) or UDim2.fromScale(0.5, 0), Color = T.Panel2, Transparency = 0 })
		local tbox = UI.input(right, "Texto (corto y legible)", design.text)
		tbox.FocusLost:Connect(function()
			design.text = tbox.Text
			render()
		end)
		local fonts = {}
		for i, f in ipairs(VideoData.Fonts) do
			fonts[i] = f.Id
		end
		UI.cycle(right, "Tipografía", fonts, Util.indexOf(fonts, design.font) or 1, function(i)
			design.font = fonts[i]
			render()
		end)
		local tplNames, tplIds = {}, {}
		for i, t in ipairs(VideoData.ThumbTemplates) do
			tplNames[i] = t.Name
			tplIds[i] = t.Id
		end
		UI.cycle(right, "Plantilla", tplNames, Util.indexOf(tplIds, design.template) or 1, function(i)
			design.template = tplIds[i]
			render()
		end)
		UI.stepper(right, "Tamaño texto", design.textSize, 0.5, 1.5, 0.1, function(v)
			design.textSize = v
			render()
		end)
		local function palette(label, key)
			UI.label(right, label, { Color = T.Sub, TextSize = 12 })
			local row = UI.frame(right, { Height = 30, Transparency = 1, Radius = false })
			UI.list(row, Enum.FillDirection.Horizontal, 4)
			for i, c in ipairs(VideoData.Palette) do
				local b = UI.button(row, design[key] == i and "●" or "", function()
					design[key] = i
					render()
				end, { Width = 26, Height = 26, Color = UI.rgb(c), TextColor = Color3.new(0.5, 0.5, 0.5) })
			end
		end
		palette("Color del texto", "textColor")
		palette("Color de fondo", "bg")
		UI.toggle(right, "Contorno del texto", design.outline, function(v)
			design.outline = v
			render()
		end)
		local frameNames, frameIds = {}, {}
		for i, f in ipairs(VideoData.Frames) do
			frameNames[i] = f.Name
			frameIds[i] = f.Id
		end
		UI.cycle(right, "Marco", frameNames, Util.indexOf(frameIds, design.frame) or 1, function(i)
			design.frame = frameIds[i]
			render()
		end)
		UI.label(right, "Elementos decorativos (1-2 es lo ideal):", { Color = T.Sub, TextSize = 12 })
		local st = UI.frame(right, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
		UI.grid(st, 96, 28, 4)
		for _, sdef in ipairs(VideoData.Stickers) do
			local on = Util.indexOf(design.stickers, sdef.Id) ~= nil
			UI.button(st, sdef.Glyph .. " " .. sdef.Name, function()
				local i = Util.indexOf(design.stickers, sdef.Id)
				if i then
					table.remove(design.stickers, i)
				else
					table.insert(design.stickers, sdef.Id)
				end
				render()
			end, { Size = UDim2.fromOffset(96, 28), TextSize = 11, Color = on and T.Ok or T.Panel3 })
		end
		UI.label(right, "Fotografía:", { Color = T.Sub, TextSize = 12 })
		UI.button(right, (design.photoId == nil and "● " or "") .. "Sin foto", function()
			design.photoId = nil
			render()
		end, { Size = UDim2.new(1, -8, 0, 26), TextSize = 12 })
		for i, ph in ipairs(data.Photos) do
			if i <= 25 then
				local mode = VideoData.PhotoModeById[ph.Mode]
				UI.button(right, (design.photoId == ph.Id and "● " or "") .. ph.SpotName .. " · " .. (mode and mode.Name or "") .. " · Q" .. math.floor(ph.Q), function()
					design.photoId = ph.Id
					render()
				end, { Size = UDim2.new(1, -8, 0, 26), TextSize = 11, Color = design.photoId == ph.Id and T.Accent2 or T.Panel3 })
			end
		end
		local projects = projectsList()
		local pNames, pIds = { "Sin proyecto" }, { false }
		for _, p in ipairs(projects) do
			pNames[#pNames + 1] = p.Name
			pIds[#pIds + 1] = p.Id
		end
		UI.cycle(right, "Para el proyecto", pNames, Util.indexOf(pIds, linkPid or false) or 1, function(i)
			linkPid = pIds[i] or nil
		end, { ValueWidth = 200 })
		UI.button(right, "💾 Guardar miniatura", function()
			local r = Net.call("Thumb.Save", { design = design, pid = linkPid })
			if r.ok then
				lastScore = r.data.score
				render()
			end
		end, { Size = UDim2.new(1, -8, 0, 36), Color = T.Ok })
		UI.label(right, "Diseños guardados:", { Font = Enum.Font.GothamBold })
		local saved = {}
		for _, t in pairs(data.Thumbnails) do
			saved[#saved + 1] = t
		end
		table.sort(saved, function(a, b)
			return a.T > b.T
		end)
		for _, t in ipairs(saved) do
			local row = UI.row(right, 28)
			UI.label(row, "«" .. (t.Design.text ~= "" and t.Design.text or "(sin texto)") .. "» ⭐" .. math.floor(t.Score), { Size = UDim2.new(1, -130, 1, 0), TextSize = 12 })
			UI.button(row, "Editar", function()
				design = Util.deepCopy(t.Design)
				render()
			end, { Width = 60, Height = 24, TextSize = 11 })
			UI.button(row, "🗑", function()
				Net.call("Thumb.Delete", { id = t.Id })
			end, { Width = 30, Height = 24, TextSize = 11 })
		end
	end
	render()
	ctx.onState(function() end)
end
table.insert(apps, Thumbs)

---------------------------------------------------------------------------
-- VIEWTUBE STUDIO (canal + publicación)
---------------------------------------------------------------------------
local Studio = { Id = "studio", Name = "ViewTube Studio", Icon = "▶️", Order = 0, Surfaces = { pc = true, phone = true, panel = false }, Width = 900, Height = 580 }

function Studio.build(container, ctx)
	local publishing = nil
	local form = {}
	local editingChannel = false
	local render
	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local ch = data.Channel
		local s = UI.scroll(container, { Pad = 8 })
		-- Cabecera del canal
		local banner = VideoData.Banners[ch.Banner] or VideoData.Banners[1]
		local head = UI.frame(s, { Height = 110, Color = UI.rgb(banner[1]) })
		UI.new("UIGradient", { Color = ColorSequence.new(UI.rgb(banner[1]), UI.rgb(banner[2])), Parent = head })
		UI.label(head, VideoData.Avatars[ch.Avatar] or "🎬", { Size = UDim2.fromOffset(80, 80), Position = UDim2.fromOffset(14, 15), TextSize = 56, Align = Enum.TextXAlignment.Center })
		UI.label(head, ch.Name ~= "" and ch.Name or "Tu canal (sin nombre)", { Size = UDim2.new(1, -120, 0, 34), Position = UDim2.fromOffset(104, 14), Font = Enum.Font.GothamBlack, TextSize = 24 })
		UI.label(head, Util.formatInt(ch.Subs) .. " suscriptores · " .. Util.formatInt(ch.TotalViews) .. " visitas · $" .. Util.formatInt(ch.TotalRevenue) .. " ganados", { Size = UDim2.new(1, -120, 0, 22), Position = UDim2.fromOffset(104, 50), TextSize = 14 })
		UI.label(head, ch.Monetized and "✅ Socio del programa de creadores" or ("Programa de socios: " .. ch.Subs .. "/100 suscriptores y " .. (data.Counters.published or 0) .. "/3 vídeos"), { Size = UDim2.new(1, -120, 0, 20), Position = UDim2.fromOffset(104, 74), TextSize = 12, Color = ch.Monetized and T.Ok or Color3.fromRGB(230, 230, 230) })
		if editingChannel then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			local nb = UI.input(card, "Nombre del canal", ch.Name)
			local db = UI.input(card, "Descripción", ch.Description, { Height = 60, Multi = true })
			local bIdx, aIdx = ch.Banner, ch.Avatar
			local bannerNames = {}
			for i = 1, #VideoData.Banners do
				bannerNames[i] = "Banner " .. i
			end
			UI.cycle(card, "Banner", bannerNames, bIdx, function(i)
				bIdx = i
			end)
			UI.cycle(card, "Foto de perfil", VideoData.Avatars, aIdx, function(i)
				aIdx = i
			end)
			local row = UI.row(card, 34)
			UI.button(row, "💾 Guardar canal", function()
				local r = Net.call("Channel.Update", { name = nb.Text, description = db.Text, banner = bIdx, avatar = aIdx })
				if r.ok then
					editingChannel = false
					render()
				end
			end, { Width = 150, Color = T.Ok })
			UI.button(row, "Cancelar", function()
				editingChannel = false
				render()
			end, { Width = 100 })
		else
			UI.button(s, "✏ Personalizar canal", function()
				editingChannel = true
				render()
			end, { Width = 180 })
		end
		-- Publicación
		UI.title(s, "⬆ Listos para publicar")
		local ready = 0
		for _, p in ipairs(projectsList()) do
			if p.Export and p.Export.ReadyAt then
				ready = ready + 1
				local done = workspace:GetServerTimeNow() >= p.Export.ReadyAt
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, p.Name .. " · " .. catName(p.Category) .. " · calidad " .. math.floor(p.Export.Res.Final) .. (done and "" or " (exportando...)"), { Font = Enum.Font.GothamBold })
				if publishing == p.Id then
					form.title = form.title or p.Name
					local tb = UI.input(card, "Título (20-60 caracteres funciona mejor)", form.title)
					tb:GetPropertyChangedSignal("Text"):Connect(function()
						form.title = tb.Text
					end)
					local db = UI.input(card, "Descripción", form.description or "", { Height = 50, Multi = true })
					db:GetPropertyChangedSignal("Text"):Connect(function()
						form.description = db.Text
					end)
					local tg = UI.input(card, "Etiquetas separadas por comas", form.tags or catName(p.Category):lower())
					tg:GetPropertyChangedSignal("Text"):Connect(function()
						form.tags = tg.Text
					end)
					local thumbs = { { Id = false, Name = "Fotograma automático (⭐30)" } }
					for _, t in pairs(data.Thumbnails) do
						thumbs[#thumbs + 1] = { Id = t.Id, Name = "«" .. (t.Design.text ~= "" and t.Design.text or "sin texto") .. "» ⭐" .. math.floor(t.Score) }
					end
					local tNames, tIdx = {}, 1
					for i, t in ipairs(thumbs) do
						tNames[i] = t.Name
						if t.Id == (form.thumbId or (p.ThumbId ~= "" and p.ThumbId) or false) then
							tIdx = i
						end
					end
					form.thumbId = thumbs[tIdx].Id or nil
					UI.cycle(card, "Miniatura", tNames, tIdx, function(i)
						form.thumbId = thumbs[i].Id or nil
					end, { ValueWidth = 260 })
					local vis = { "Público", "Oculto (pocas visitas)" }
					UI.cycle(card, "Visibilidad", vis, form.unlisted and 2 or 1, function(i)
						form.unlisted = i == 2
					end)
					local fmtNames = {}
					for i, f in ipairs(VideoData.Formats) do
						fmtNames[i] = f.Name
					end
					form.formatIdx = form.formatIdx or 1
					UI.cycle(card, "Formato", fmtNames, form.formatIdx, function(i)
						form.formatIdx = i
						render()
					end, { ValueWidth = 200 })
					local fdef = VideoData.Formats[form.formatIdx]
					UI.label(card, fdef.Desc, { TextSize = 11, Color = T.Sub })
					if fdef.Series then
						local sb = UI.input(card, "Nombre de la serie (los episodios suman público fiel)", form.series or "")
						sb:GetPropertyChangedSignal("Text"):Connect(function()
							form.series = sb.Text
						end)
					end
					local contracts = { { Id = false, Name = "Sin patrocinio" } }
					for cid, c in pairs(data.Sponsors and data.Sponsors.Active or {}) do
						contracts[#contracts + 1] = { Id = cid, Name = "🤝 " .. c.Brand:upper() .. " · " .. catName(c.Category) .. " Q" .. c.MinQ }
					end
					local cNames, cIdx = {}, 1
					for i, c in ipairs(contracts) do
						cNames[i] = c.Name
						if c.Id == (form.sponsor or false) then
							cIdx = i
						end
					end
					UI.cycle(card, "Patrocinio", cNames, cIdx, function(i)
						form.sponsor = contracts[i].Id or nil
					end, { ValueWidth = 260 })
					-- Encargos de clientes de tu empresa
					local company = data.Company
					if type(company) == "table" and type(company.Name) == "string" then
						local jobs = { { Id = false, Name = "Sin cliente" } }
						for kid, k in pairs(company.Active or {}) do
							local cl = LifeData.Clients[k.Client]
							jobs[#jobs + 1] = { Id = kid, Name = "🏢 " .. (cl and cl.Name or "Cliente") .. " · " .. catName(k.Category) .. " Q" .. k.MinQ }
						end
						local kNames, kIdx = {}, 1
						for i, k in ipairs(jobs) do
							kNames[i] = k.Name
							if k.Id == (form.client or false) then
								kIdx = i
							end
						end
						UI.cycle(card, "Cliente de la empresa", kNames, kIdx, function(i)
							form.client = jobs[i].Id or nil
						end, { ValueWidth = 260, LabelWidth = 150 })
					end
					UI.label(card, "Puntuación del título: " .. math.floor(F.title(form.title or "", p.Category)) .. "/100", { TextSize = 12, Color = T.Sub })
					local row = UI.row(card, 36)
					UI.button(row, "🚀 Publicar", function()
						local tags = {}
						for t in (form.tags or ""):gmatch("[^,]+") do
							tags[#tags + 1] = Util.trim(t)
						end
						local r = Net.call("Video.Publish", { pid = p.Id, title = form.title, description = form.description or "", tags = tags, thumbId = form.thumbId, visibility = form.unlisted and "unlisted" or "public",
							format = VideoData.Formats[form.formatIdx or 1].Id, series = form.series, sponsor = form.sponsor, client = form.client })
						if r.ok then
							publishing = nil
							form = {}
						end
					end, { Width = 140, Color = T.Accent })
					UI.button(row, "Cancelar", function()
						publishing = nil
						render()
					end, { Width = 100 })
				elseif done then
					UI.button(card, "Preparar publicación", function()
						publishing = p.Id
						form = {}
						render()
					end, { Width = 180, Color = T.Accent })
				end
			end
		end
		if ready == 0 then
			UI.label(s, "Nada listo. Exporta un proyecto en el Editor para publicarlo aquí.", { Color = T.Sub })
		end
		-- Vídeos publicados
		UI.title(s, "📺 Tus vídeos (" .. #data.Videos .. ")")
		for i, v in ipairs(data.Videos) do
			if i <= 30 then
				local card = UI.frame(s, { Height = 96, Color = T.Panel2 })
				if v.ThumbDesign then
					drawThumb(card, v.ThumbDesign, UDim2.fromOffset(150, 84)).Position = UDim2.fromOffset(6, 6)
				else
					local ph = UI.frame(card, { Size = UDim2.fromOffset(150, 84), Position = UDim2.fromOffset(6, 6), Color = T.Panel3 })
					UI.label(ph, "▶ " .. catName(v.Cat), { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, TextSize = 12 })
				end
				UI.label(card, v.Title, { Position = UDim2.fromOffset(166, 6), Size = UDim2.new(1, -176, 0, 22), Font = Enum.Font.GothamBold })
				UI.label(card, Util.formatInt(v.Views) .. " visitas · 👍 " .. Util.formatInt(v.Likes) .. " · 💬 " .. v.Comments .. " · $" .. string.format("%.2f", v.Revenue) .. " · +" .. (v.SubsGained or 0) .. " subs",
					{ Position = UDim2.fromOffset(166, 30), Size = UDim2.new(1, -176, 0, 20), TextSize = 13 })
				UI.label(card, "Calidad " .. math.floor(v.Q) .. " · CTR " .. v.Ctr .. "% · " .. catName(v.Cat) .. ((v.Format and v.Format ~= "video") and (" · " .. VideoData.FormatById[v.Format].Name .. (v.Episode and (" #" .. v.Episode) or "")) or "") .. (v.Sponsor and " · 🤝 patrocinado" or "") .. (v.Client and (" · 🏢 " .. v.Client) or "") .. (v.Label and (" · " .. v.Label) or "") .. (v.Trend and " · 🔥 tendencia" or "") .. (v.Viral and " · 🚀 viral" or "") .. (v.Unlisted and " · oculto" or ""),
					{ Position = UDim2.fromOffset(166, 52), Size = UDim2.new(1, -176, 0, 20), TextSize = 12, Color = T.Sub })
				local c = v.CommentList and v.CommentList[1]
				if c then
					UI.label(card, "💬 " .. c.U .. ": " .. c.Txt, { Position = UDim2.fromOffset(166, 72), Size = UDim2.new(1, -176, 0, 18), TextSize = 11, Color = T.Sub })
				end
			end
		end
	end
	render()
	ctx.onState(function()
		if not publishing and not editingChannel then
			render()
		end
	end)
end
table.insert(apps, Studio)

---------------------------------------------------------------------------
-- ESTADÍSTICAS
---------------------------------------------------------------------------
local Analytics = { Id = "analytics", Name = "Estadísticas", Icon = "📊", Order = 4, Surfaces = { pc = true, phone = true, panel = false }, Width = 860, Height = 560 }

function Analytics.build(container, ctx)
	task.spawn(Net.call, "Channel.OpenAnalytics", {}, { silent = true })
	local selected, compareWith = 1, nil
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local s = UI.scroll(container, { Pad = 8 })
		local ch = data.Channel
		local d = data.Derived
		UI.title(s, "📊 Resumen del canal")
		local row = UI.frame(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
		UI.grid(row, ctx.kind == "phone" and 140 or 190, 60, 6)
		local function stat(label, value, color)
			local c = UI.card(row, { Height = 60 })
			UI.label(c, label, { TextSize = 12, Color = T.Sub })
			UI.label(c, value, { Font = Enum.Font.GothamBlack, TextSize = 20, Color = color or T.Text })
		end
		stat("Suscriptores", Util.formatInt(ch.Subs), T.Accent)
		stat("Visitas totales", Util.formatInt(ch.TotalViews), T.Accent2)
		stat("Ingresos del canal", "$" .. Util.formatInt(ch.TotalRevenue), T.Ok)
		stat("Reputación", tostring(data.Reputation) .. "/100", T.Gold)
		stat("Rango", d.RankName)
		stat("Vídeos", tostring(#data.Videos))
		local vids = data.Videos
		if #vids == 0 then
			UI.label(s, "Publica tu primer vídeo para ver estadísticas.", { Color = T.Sub })
			return
		end
		-- Visitas de los últimos 10 vídeos
		local values, labels = {}, {}
		for i = math.min(10, #vids), 1, -1 do
			values[#values + 1] = vids[i].Views
			labels[#labels + 1] = "#" .. i
		end
		UI.label(s, "Visitas de los últimos vídeos (el #1 es el más reciente)", { Font = Enum.Font.GothamBold })
		UI.bars(s, values, labels, T.Accent2)
		-- Detalle del vídeo seleccionado
		local names = {}
		for i, v in ipairs(vids) do
			names[i] = "#" .. i .. " " .. v.Title
		end
		UI.cycle(s, "Vídeo", names, selected, function(i)
			selected = i
			render()
		end, { ValueWidth = 320, LabelWidth = 60 })
		local v = vids[selected]
		if v then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, v.Title, { Font = Enum.Font.GothamBold })
			UI.label(card, Util.formatInt(v.Views) .. " visitas (previstas ~" .. Util.formatInt(v.Expected) .. ") · CTR " .. v.Ctr .. "% · 👍 " .. v.Likes .. " · 💬 " .. v.Comments .. " · $" .. string.format("%.2f", v.Revenue), { TextSize = 13 })
			UI.label(card, "Calidad " .. math.floor(v.Q) .. " (material " .. math.floor(v.Footage or 0) .. ", edición " .. math.floor(v.EditQ or 0) .. ") · Miniatura ⭐" .. math.floor(v.Thumb) .. " · Título " .. math.floor(v.TitleScore or 0), { TextSize = 12, Color = T.Sub })
			if v.Labels and #v.Labels > 0 then
				UI.label(card, "Tipo: " .. table.concat(v.Labels, " · "), { TextSize = 12, Color = T.Gold })
			end
			UI.label(card, "Evolución de visitas (cada punto = 2 min tras publicar):", { TextSize = 12, Color = T.Sub })
			UI.bars(card, v.Hist or {}, nil, T.Accent, { Height = 100 })
			for _, c in ipairs(v.CommentList or {}) do
				UI.label(card, "💬 " .. c.U .. ": " .. c.Txt, { TextSize = 12 })
			end
		end
		-- Comparación entre publicaciones
		UI.label(s, "⚖ Comparar con otro vídeo", { Font = Enum.Font.GothamBold })
		local cmpNames = { "—" }
		for i, vv in ipairs(vids) do
			cmpNames[i + 1] = "#" .. i .. " " .. vv.Title
		end
		UI.cycle(s, "Comparar", cmpNames, (compareWith or 0) + 1, function(i)
			compareWith = i > 1 and (i - 1) or nil
			render()
		end, { ValueWidth = 320, LabelWidth = 70 })
		if compareWith and vids[compareWith] and v then
			local o = vids[compareWith]
			local function line(label, a, b)
				local r = UI.row(s, 22)
				UI.label(r, label, { Size = UDim2.new(0.3, 0, 1, 0), Color = T.Sub, TextSize = 12 })
				UI.label(r, tostring(a), { Size = UDim2.new(0.35, 0, 1, 0), TextSize = 12, Color = (tonumber(a) or 0) >= (tonumber(b) or 0) and T.Ok or T.Text })
				UI.label(r, tostring(b), { Size = UDim2.new(0.35, 0, 1, 0), TextSize = 12, Color = (tonumber(b) or 0) > (tonumber(a) or 0) and T.Ok or T.Text })
			end
			line("Visitas", v.Views, o.Views)
			line("Calidad", math.floor(v.Q), math.floor(o.Q))
			line("CTR %", v.Ctr, o.Ctr)
			line("Me gusta", v.Likes, o.Likes)
			line("Ingresos $", math.floor(v.Revenue), math.floor(o.Revenue))
			line("Suscriptores", v.SubsGained or 0, o.SubsGained or 0)
		end
	end
	render()
	ctx.onState(render)
end
table.insert(apps, Analytics)

apps.drawThumbFn = drawThumb
return apps
