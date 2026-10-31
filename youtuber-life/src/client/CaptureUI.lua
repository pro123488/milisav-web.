--!nonstrict
-- CaptureUI (cliente): sesión de grabación por escenas y modo fotógrafo profesional.
-- El cliente solo elige la toma/encuadre; la calidad la calcula el servidor con el equipo real.

local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local UI = require(script.Parent.UIKit)
local State = require(script.Parent.State)
local Net = require(script.Parent.Net)
local Notify = require(script.Parent.Notify)
local VideoData = require(Shared.VideoData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)
local T = UI.Theme

local Capture = {}
local player = Players.LocalPlayer
local gui
local recFrame, photoFrame, pickFrame
local sound
local colorFx

function Capture.init(screenGui, snd)
	gui = screenGui
	sound = snd
end

-- Productos disponibles para planos de producto: los tuyos en la mochila + expuestos en la tienda donde estás
local function productOptions()
	local opts = { { Name = "Sin producto" } }
	for _, it in ipairs(State.items(function(rec, def)
		return (rec.Loc == "backpack" or (State.Data.Derived.AtHome and rec.Loc == "home")) and def.Cat ~= "component" and def.Slot ~= "battery" and def.Slot ~= "bag"
	end)) do
		opts[#opts + 1] = { Name = "📦 " .. it.Def.Name .. " (tuyo)", Uid = it.Uid }
	end
	local store = player:GetAttribute("InStore")
	if store then
		for _, def in ipairs(Catalog.list({ Store = store })) do
			if #opts < 40 then
				opts[#opts + 1] = { Name = "🏬 " .. def.Name .. " (exposición)", StoreItem = def.Id }
			end
		end
	end
	return opts
end

---------------------------------------------------------------------------
-- Grabación
---------------------------------------------------------------------------
local function closeRec()
	if recFrame then
		recFrame:Destroy()
		recFrame = nil
	end
end

local function showRecorder(info, pid)
	closeRec()
	local proj = State.Data.Projects[pid]
	recFrame = UI.frame(gui, { Size = UDim2.fromOffset(560, 0), Auto = Enum.AutomaticSize.Y, Position = UDim2.new(0.5, 0, 0, 66), Anchor = Vector2.new(0.5, 0), Color = T.Panel, Transparency = 0.05, Name = "Recorder" })
	UI.stroke(recFrame, T.Accent, 2)
	UI.padding(recFrame, 10)
	UI.list(recFrame, Enum.FillDirection.Vertical, 6)
	local head = UI.label(recFrame, "", { Font = Enum.Font.GothamBlack, TextSize = 15, Color = T.Accent })
	local sub = UI.label(recFrame, "", { TextSize = 12, Color = T.Sub })
	local spotL = UI.label(recFrame, "", { TextSize = 13 })
	local productIdx = 1
	local options = productOptions()
	local names = {}
	for i, o in ipairs(options) do
		names[i] = o.Name
	end
	UI.cycle(recFrame, "Producto", names, 1, function(i)
		productIdx = i
	end, { ValueWidth = 300, LabelWidth = 70 })
	local grid = UI.frame(recFrame, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
	UI.grid(grid, 128, 40, 6)
	local result = UI.label(recFrame, "Elige una toma para grabar una escena.", { TextSize = 12, Height = 34, Color = T.Sub })
	for _, shot in ipairs(VideoData.Shots) do
		local missing = (shot.NeedsTripod and not info.tripod) or (shot.NeedsDrone and not info.drone)
		UI.button(grid, shot.Name .. (missing and " 🔒" or ""), function()
			local o = options[productIdx]
			local r = Net.call("Video.RecordScene", { shot = shot.Id, featuredUid = o.Uid, featuredStoreItem = o.StoreItem }, { quietOk = true })
			if r.ok then
				if sound then
					sound.play("Shutter")
				end
				local sc = r.data.scene
				info.charge = r.data.charge
				result.Text = "✅ " .. shot.Name .. " · calidad " .. math.floor(sc.Q) .. " (imagen " .. math.floor(sc.Img) .. ", audio " .. math.floor(sc.Aud) .. ", luz " .. math.floor(sc.Light) .. ", interés " .. math.floor(sc.Int) .. ")" .. (#sc.Probs > 0 and ("\n⚠ " .. table.concat(sc.Probs, ", ")) or "")
				result.TextColor3 = #sc.Probs > 0 and T.Warn or T.Ok
			end
		end, { Size = UDim2.fromOffset(128, 40), TextSize = 11, Color = missing and T.Panel2 or Color3.fromRGB(120, 30, 45) })
	end
	local row = UI.row(recFrame, 34)
	UI.button(row, "⏹ Detener grabación", function()
		Net.call("Video.StopRecording", {})
		closeRec()
	end, { Width = 180, Color = T.Panel3 })
	task.spawn(function()
		local blink = true
		while recFrame and head.Parent do
			local p = State.Data and State.Data.Projects[pid]
			blink = not blink
			head.Text = (blink and "● " or "○ ") .. "REC · " .. (p and p.Name or "?") .. " · " .. (p and #p.Scenes or 0) .. " escenas"
			sub.Text = "🎥 " .. info.device .. " · 🔋 " .. math.floor(info.charge or 100) .. "% · 🎙 " .. info.mic .. (info.tripod and " · trípode" or "") .. (info.gimbal and " · estabilizador" or "") .. (info.light and " · luz" or "")
			local spot = player:GetAttribute("Spot")
			spotL.Text = spot and ("📍 Lugar: " .. spot) or "⚠ No estás en un lugar de grabación (busca 🎥, una tienda o tu casa)"
			spotL.TextColor3 = spot and T.Text or T.Warn
			task.wait(0.5)
		end
	end)
end

local function closePick()
	if pickFrame then
		pickFrame:Destroy()
		pickFrame = nil
	end
end

function Capture.toggleRecord(openIdeas)
	if recFrame then
		Net.call("Video.StopRecording", {})
		closeRec()
		return
	end
	if pickFrame then
		closePick()
		return
	end
	local data = State.Data
	if not data then
		return
	end
	pickFrame = UI.frame(gui, { Size = UDim2.fromOffset(440, 0), Auto = Enum.AutomaticSize.Y, Position = UDim2.fromScale(0.5, 0.45), Anchor = Vector2.new(0.5, 0.5), Color = T.Panel, Name = "RecordPicker" })
	UI.padding(pickFrame, 12)
	UI.list(pickFrame, Enum.FillDirection.Vertical, 6)
	UI.label(pickFrame, "🎬 ¿Qué proyecto vas a grabar?", { Font = Enum.Font.GothamBlack, TextSize = 16 })
	local usePhone = false
	UI.toggle(pickFrame, "Grabar con el teléfono (si no, la mejor cámara de la mochila)", false, function(v)
		usePhone = v
	end, { Width = 400 })
	local any = false
	for pid, p in pairs(data.Projects) do
		any = true
		UI.button(pickFrame, p.Name .. " · " .. (VideoData.CategoryById[p.Category] or {}).Name .. " · " .. #p.Scenes .. " escenas", function()
			local r = Net.call("Video.StartRecording", { pid = pid, usePhone = usePhone }, { quietOk = true })
			closePick()
			if r.ok then
				showRecorder(r.data, pid)
			end
		end, { Size = UDim2.new(1, 0, 0, 34), TextSize = 12, Color = T.Panel2 })
	end
	if not any then
		UI.label(pickFrame, "No tienes proyectos. Crea una idea primero.", { Color = T.Sub })
	end
	local row = UI.row(pickFrame, 34)
	UI.button(row, "💡 Nueva idea", function()
		closePick()
		openIdeas()
	end, { Width = 140, Color = T.Accent2 })
	UI.button(row, "Cancelar", closePick, { Width = 100 })
end

---------------------------------------------------------------------------
-- Modo fotógrafo
---------------------------------------------------------------------------
local framings = { { "Centrado", 5 }, { "Regla de tercios", 8 }, { "Contrapicado", 7 }, { "Picado", 6 }, { "Ángulo holandés", 4 }, { "Simétrico", 7 } }

function Capture.togglePhoto()
	if photoFrame then
		photoFrame:Destroy()
		photoFrame = nil
		if colorFx then
			colorFx:Destroy()
			colorFx = nil
		end
		workspace.CurrentCamera.FieldOfView = 70
		return
	end
	local camera = workspace.CurrentCamera
	local modeIdx, framingIdx, filterIdx, productIdx = 1, 2, 1, 1
	local fov = 70
	colorFx = Instance.new("ColorCorrectionEffect")
	colorFx.Name = "PhotoFilter"
	colorFx.Parent = Lighting
	local function applyFilter()
		if not colorFx then
			return
		end
		local f = filterIdx
		colorFx.Saturation = (f == 2 and 0.4) or (f == 5 and -1) or (f == 6 and -0.4) or 0
		colorFx.Contrast = (f == 7 and 0.25) or (f == 2 and 0.1) or 0
		colorFx.TintColor = (f == 3 and Color3.fromRGB(255, 225, 190)) or (f == 4 and Color3.fromRGB(200, 225, 255)) or (f == 6 and Color3.fromRGB(255, 235, 200)) or Color3.new(1, 1, 1)
	end
	photoFrame = UI.frame(gui, { Size = UDim2.fromScale(1, 1), Transparency = 1, Radius = false, Name = "PhotoMode" })
	-- Cuadrícula de tercios
	for i = 1, 2 do
		local v = UI.frame(photoFrame, { Size = UDim2.new(0, 1, 1, 0), Position = UDim2.fromScale(i / 3, 0), Color = Color3.new(1, 1, 1), Transparency = 0.6, Radius = false })
		local h = UI.frame(photoFrame, { Size = UDim2.new(1, 0, 0, 1), Position = UDim2.fromScale(0, i / 3), Color = Color3.new(1, 1, 1), Transparency = 0.6, Radius = false })
		v.Active = false
		h.Active = false
	end
	local panel = UI.frame(photoFrame, { Size = UDim2.fromOffset(620, 0), Auto = Enum.AutomaticSize.Y, Position = UDim2.new(0.5, 0, 1, -90), Anchor = Vector2.new(0.5, 1), Color = T.Panel, Transparency = 0.1 })
	UI.padding(panel, 10)
	UI.list(panel, Enum.FillDirection.Vertical, 4)
	UI.label(panel, "📸 Modo fotógrafo · mueve la cámara con el ratón/dedo y dispara", { Font = Enum.Font.GothamBold, TextSize = 13 })
	local modeNames = {}
	for i, m in ipairs(VideoData.PhotoModes) do
		modeNames[i] = m.Name
	end
	UI.cycle(panel, "Tipo", modeNames, modeIdx, function(i)
		modeIdx = i
	end, { ValueWidth = 220 })
	local frNames = {}
	for i, f in ipairs(framings) do
		frNames[i] = f[1]
	end
	UI.cycle(panel, "Encuadre", frNames, framingIdx, function(i)
		framingIdx = i
	end, { ValueWidth = 220 })
	UI.cycle(panel, "Filtro", VideoData.PhotoFilters, filterIdx, function(i)
		filterIdx = i
		applyFilter()
	end, { ValueWidth = 220 })
	UI.stepper(panel, "Zoom (FOV)", fov, 20, 100, 5, function(v)
		fov = v
		camera.FieldOfView = v
	end)
	local options = productOptions()
	local pNames = {}
	for i, o in ipairs(options) do
		pNames[i] = o.Name
	end
	UI.cycle(panel, "Producto", pNames, 1, function(i)
		productIdx = i
	end, { ValueWidth = 300 })
	local row = UI.row(panel, 40)
	local flash = UI.frame(photoFrame, { Size = UDim2.fromScale(1, 1), Color = Color3.new(1, 1, 1), Transparency = 1, Radius = false })
	flash.ZIndex = 50
	UI.button(row, "📸 Disparar", function()
		local cf = camera.CFrame
		local look = cf.Position + cf.LookVector * 20
		local o = options[productIdx]
		local r = Net.call("Photo.Take", {
			mode = VideoData.PhotoModes[modeIdx].Id,
			composition = framings[framingIdx][2],
			filter = filterIdx,
			cam = { cf.Position.X, cf.Position.Y, cf.Position.Z, look.X, look.Y, look.Z },
			fov = fov,
			featuredUid = o.Uid,
			featuredStoreItem = o.StoreItem,
		})
		if r.ok and sound then
			sound.play("Shutter")
			flash.BackgroundTransparency = 0.1
			UI.tween(flash, { BackgroundTransparency = 1 }, 0.4)
		end
	end, { Width = 160, Height = 36, Color = T.Accent })
	UI.button(row, "✕ Salir (F)", function()
		Capture.togglePhoto()
	end, { Width = 120, Height = 36 })
	applyFilter()
end

function Capture.isRecording()
	return recFrame ~= nil
end

return Capture
