--!nonstrict
-- BuildUI (cliente): modo construcción dentro de tus propiedades.
-- Colocar muebles con una vista previa que sigue al ratón/dedo, girar (R o botón), mover, recoger,
-- cambiar paredes/suelo/luz/cortinas, aplicar estilos, mejoras y diseños guardados.
-- El servidor valida cada colocación (límites, choques, puerta, puesto de trabajo, número de muebles).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local UI = require(script.Parent.UIKit)
local State = require(script.Parent.State)
local Net = require(script.Parent.Net)
local Notify = require(script.Parent.Notify)
local Catalog = require(Shared.ItemCatalog)
local PropertyData = require(Shared.PropertyData)
local Util = require(Shared.Util)
local T = UI.Theme

local Build = {}
local player = Players.LocalPlayer
local gui, panel
local ghost, ghostConn
local placing = nil -- { uid, def, r }
local tab = "place"
local lastLocal = nil

function Build.init(screenGui)
	gui = screenGui
	UserInputService.InputBegan:Connect(function(input, processed)
		if not placing then
			return
		end
		if input.KeyCode == Enum.KeyCode.R then
			Build.rotate()
		elseif input.KeyCode == Enum.KeyCode.Q or input.UserInputType == Enum.UserInputType.MouseButton2 then
			Build.cancelPlacing()
		elseif not processed and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
			Build.confirm()
		end
	end)
end

function Build.isPlacing()
	return placing ~= nil
end

function Build.isOpen()
	return panel ~= nil
end

local function interior()
	local d = State.Data and State.Data.Derived
	return d and d.Interior and d.PropInside and d.Interior or nil
end

function Build.cancelPlacing()
	placing = nil
	if ghostConn then
		ghostConn:Disconnect()
		ghostConn = nil
	end
	if ghost then
		ghost:Destroy()
		ghost = nil
	end
end

function Build.rotate()
	if placing then
		placing.r = (placing.r + 90) % 360
	end
end

function Build.confirm()
	if not placing or not lastLocal then
		return
	end
	local p = placing
	local r = Net.call("Prop.Place", { uid = p.uid, x = lastLocal.X, z = lastLocal.Z, r = p.r }, { quietOk = false })
	if r.ok then
		Build.cancelPlacing()
	end
end

local function startPlacing(uid, def, r)
	Build.cancelPlacing()
	local info = interior()
	if not info then
		Notify.toast("Entra en tu propiedad para colocar muebles.", "warn")
		return
	end
	placing = { uid = uid, def = def, r = r or 0 }
	local f = def.Foot or { 4, 4, 3 }
	ghost = Instance.new("Part")
	ghost.Name = "BuildGhost"
	ghost.Anchored = true
	ghost.CanCollide = false
	ghost.CanQuery = false
	ghost.Transparency = 0.5
	ghost.Material = Enum.Material.ForceField
	ghost.Size = Vector3.new(f[1], math.max(0.4, f[3]), f[2])
	ghost.Parent = workspace.CurrentCamera
	local origin = Vector3.new(info.Origin[1], info.Origin[2], info.Origin[3])
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	ghostConn = RunService.RenderStepped:Connect(function()
		if not ghost then
			return
		end
		params.FilterDescendantsInstances = { player.Character, ghost }
		local mouse = UserInputService:GetMouseLocation()
		local ray = workspace.CurrentCamera:ViewportPointToRay(mouse.X, mouse.Y)
		local hit = workspace:Raycast(ray.Origin, ray.Direction * 300, params)
		if hit then
			local rel = hit.Position - origin
			local x = math.floor(rel.X * 2 + 0.5) / 2
			local z = math.floor(rel.Z * 2 + 0.5) / 2
			lastLocal = Vector3.new(x, 0, z)
			local w, d = f[1], f[2]
			if placing.r % 180 == 90 then
				w, d = d, w
			end
			local inside = math.abs(x) + w / 2 <= info.W / 2 - 0.5 and math.abs(z) + d / 2 <= info.D / 2 - 0.5
			ghost.Color = inside and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(255, 70, 70)
			ghost.CFrame = CFrame.new(origin + Vector3.new(x, ghost.Size.Y / 2, z)) * CFrame.Angles(0, math.rad(placing.r), 0)
		end
	end)
	Notify.toast("Mueve el ratón (o toca el suelo) para colocar · R girar · Q o clic derecho cancelar", "info")
end

local function render()
	if not panel then
		return
	end
	UI.clear(panel)
	local data = State.Data
	local info = interior()
	if not info then
		UI.label(panel, "Entra en una de tus propiedades para construir.", { Color = T.Sub, Height = 40 })
		return
	end
	local l = PropertyData.ById[info.Id]
	local rec = data.Properties[info.Id]
	if not rec then
		return
	end
	UI.label(panel, "🔨 " .. l.Name, { Font = Enum.Font.GothamBlack, TextSize = 15, Height = 22 })
	UI.label(panel, "Decoración " .. tostring(data.Derived.DecorScore or 0) .. "/45 · muebles " .. State.count(rec.Placed) .. "/" .. l.Slots, { TextSize = 12, Color = T.Gold, Height = 18, Position = UDim2.fromOffset(0, 22) })
	local tabs = UI.row(panel, 30)
	tabs.Position = UDim2.fromOffset(0, 44)
	for _, t in ipairs({ { "place", "Colocar" }, { "placed", "Colocados" }, { "room", "Sala" }, { "designs", "Diseños" } }) do
		UI.button(tabs, t[2], function()
			tab = t[1]
			render()
		end, { Width = 80, Height = 26, TextSize = 12, Color = tab == t[1] and T.Accent or T.Panel3 })
	end
	local s = UI.scroll(panel, { Size = UDim2.new(1, 0, 1, -116), Position = UDim2.fromOffset(0, 78), Pad = 4 })
	if tab == "place" then
		local items = State.items(function(r, def)
			return def.Placeable and r.Loc == "home"
		end)
		if #items == 0 then
			UI.label(s, "No tienes muebles en casa. Cómpralos en Hogar & Deco (Barrio residencial) o en la Tienda online.", { Color = T.Sub, Height = 50 })
		end
		for _, it in ipairs(items) do
			local styleName = it.Def.Style and PropertyData.StyleById[it.Def.Style] and (" · " .. PropertyData.StyleById[it.Def.Style].Name) or ""
			UI.button(s, it.Def.Name .. " (+" .. (it.Def.Stats.Decor or 0) .. ")" .. styleName, function()
				startPlacing(it.Uid, it.Def, 0)
			end, { Size = UDim2.new(1, -8, 0, 30), TextSize = 12, Color = T.Panel2 })
		end
	elseif tab == "placed" then
		for uid, pos in pairs(rec.Placed) do
			local item = data.Inventory[uid]
			local def = item and Catalog.get(item.Id)
			if def then
				local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
				UI.label(card, def.Name .. " · (" .. pos.X .. ", " .. pos.Z .. ") · " .. pos.R .. "°", { TextSize = 12 })
				local row = UI.row(card, 28, nil, 4)
				UI.button(row, "Mover", function()
					startPlacing(uid, def, pos.R)
				end, { Width = 70, Height = 24, TextSize = 11 })
				UI.button(row, "Girar", function()
					Net.call("Prop.Rotate", { uid = uid }, { quietOk = true })
				end, { Width = 60, Height = 24, TextSize = 11 })
				UI.button(row, "Recoger", function()
					Net.call("Prop.Pick", { uid = uid })
				end, { Width = 80, Height = 24, TextSize = 11, Color = Color3.fromRGB(110, 40, 40) })
			end
		end
	elseif tab == "room" then
		UI.label(s, l.Remodel and "Cada cambio cuesta $50 (estilo completo $120)." or "Propiedad no remodelable: solo luz y cortinas.", { TextSize = 12, Color = T.Sub, Height = 30 })
		local names = {}
		for i, st in ipairs(PropertyData.Styles) do
			names[i] = st.Name
		end
		local styleIdx = 1
		UI.cycle(s, "Estilo", names, 1, function(i)
			styleIdx = i
		end, { LabelWidth = 60, ValueWidth = 130 })
		UI.button(s, "Aplicar estilo", function()
			Net.call("Prop.Decor", { style = PropertyData.Styles[styleIdx].Id })
		end, { Width = 160, Height = 28 })
		local function paletteRow(label, list, key, current)
			UI.label(s, label, { TextSize = 12, Color = T.Sub })
			local grid = UI.frame(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Transparency = 1, Radius = false })
			UI.grid(grid, 26, 26, 4)
			for i, entry in ipairs(list) do
				local color = entry[3] and type(entry[3]) == "table" and entry[3] or entry[2]
				UI.button(grid, current == i and "●" or "", function()
					Net.call("Prop.Decor", { [key] = i })
				end, { Size = UDim2.fromOffset(26, 26), Color = UI.rgb(color), TextColor = Color3.new(0.5, 0.5, 0.5) })
			end
		end
		paletteRow("Paredes", PropertyData.Walls, "wall", rec.Decor.Wall)
		paletteRow("Suelo", PropertyData.Floors, "floor", rec.Decor.Floor)
		paletteRow("Iluminación", PropertyData.Lights, "light", rec.Decor.Light)
		UI.toggle(s, "Cortinas", rec.Decor.Curtain, function(v)
			Net.call("Prop.Decor", { curtain = v })
		end, { Width = 200 })
	elseif tab == "designs" then
		local nb = UI.input(s, "Nombre del diseño", "")
		UI.button(s, "💾 Guardar diseño actual", function()
			Net.call("Prop.SavePreset", { name = nb.Text })
		end, { Width = 220, Height = 28 })
		for i, preset in ipairs(rec.Presets) do
			local row = UI.row(s, 30)
			UI.label(row, preset.Name .. " (" .. State.count(preset.Layout) .. " muebles)", { Size = UDim2.fromOffset(180, 26), TextSize = 12 })
			UI.button(row, "Aplicar", function()
				Net.call("Prop.LoadPreset", { index = i })
			end, { Width = 80, Height = 26, TextSize = 12 })
		end
	end
	local bottom = UI.row(panel, 32)
	bottom.Position = UDim2.new(0, 0, 1, -34)
	UI.button(bottom, "↻ Girar (R)", function()
		Build.rotate()
	end, { Width = 100, Height = 28, TextSize = 12 })
	UI.button(bottom, "✕ Cerrar (B)", function()
		Build.toggle()
	end, { Width = 110, Height = 28, TextSize = 12 })
end

function Build.toggle()
	if panel then
		Build.cancelPlacing()
		panel:Destroy()
		panel = nil
		return
	end
	if not interior() then
		Notify.toast("Entra en una de tus propiedades para usar el modo construcción.", "warn")
		return
	end
	panel = UI.frame(gui, { Size = UDim2.fromOffset(360, 470), Position = UDim2.new(0, 12, 0.5, 20), Anchor = Vector2.new(0, 0.5), Color = T.Panel, Name = "BuildPanel" })
	UI.padding(panel, 10)
	render()
end

State.on(function()
	if panel then
		if not interior() then
			Build.toggle()
		else
			render()
		end
	end
end)

return Build
