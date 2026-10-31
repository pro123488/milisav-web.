--!nonstrict
-- UIKit: componentes de interfaz reutilizables con un estilo coherente (tema oscuro, acentos de color),
-- animaciones de botones, sonidos y diseño adaptable a distintas resoluciones.

local TweenService = game:GetService("TweenService")

local UI = {}

UI.Theme = {
	Bg = Color3.fromRGB(16, 17, 22),
	Panel = Color3.fromRGB(26, 28, 36),
	Panel2 = Color3.fromRGB(36, 39, 50),
	Panel3 = Color3.fromRGB(48, 52, 66),
	Text = Color3.fromRGB(240, 242, 248),
	Sub = Color3.fromRGB(160, 166, 184),
	Accent = Color3.fromRGB(255, 52, 82),
	Accent2 = Color3.fromRGB(0, 190, 255),
	Ok = Color3.fromRGB(60, 210, 120),
	Warn = Color3.fromRGB(255, 190, 40),
	Err = Color3.fromRGB(255, 80, 80),
	Gold = Color3.fromRGB(255, 214, 0),
}
local T = UI.Theme

UI.ReduceMotion = false
UI.Sound = nil -- lo asigna Main (módulo Sound)

function UI.new(class, props, children)
	local inst = Instance.new(class)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, c in ipairs(children or {}) do
		c.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function UI.tween(inst, props, t, style)
	if UI.ReduceMotion then
		for k, v in pairs(props) do
			inst[k] = v
		end
		return
	end
	local tw = TweenService:Create(inst, TweenInfo.new(t or 0.15, style or Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end

function UI.corner(inst, r)
	UI.new("UICorner", { CornerRadius = UDim.new(0, r or 8), Parent = inst })
	return inst
end

function UI.stroke(inst, color, thickness, transparency)
	UI.new("UIStroke", { Color = color or T.Panel3, Thickness = thickness or 1, Transparency = transparency or 0, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = inst })
	return inst
end

function UI.padding(inst, px)
	UI.new("UIPadding", { PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px), PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px), Parent = inst })
	return inst
end

function UI.list(inst, dir, pad, halign)
	UI.new("UIListLayout", {
		FillDirection = dir or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, pad or 6),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = halign or Enum.HorizontalAlignment.Left,
		Parent = inst,
	})
	return inst
end

function UI.grid(inst, w, h, pad)
	UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(w, h), CellPadding = UDim2.fromOffset(pad or 8, pad or 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = inst })
	return inst
end

function UI.frame(parent, props)
	props = props or {}
	local f = UI.new("Frame", {
		BackgroundColor3 = props.Color or T.Panel,
		BackgroundTransparency = props.Transparency or 0,
		BorderSizePixel = 0,
		Size = props.Size or UDim2.new(1, 0, 0, props.Height or 40),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.Anchor or Vector2.new(),
		LayoutOrder = props.Order or 0,
		AutomaticSize = props.Auto or Enum.AutomaticSize.None,
		ClipsDescendants = props.Clip or false,
		Name = props.Name or "Frame",
		Parent = parent,
	})
	if props.Radius ~= false then
		UI.corner(f, props.Radius or 8)
	end
	return f
end

function UI.label(parent, text, props)
	props = props or {}
	return UI.new("TextLabel", {
		Text = text or "",
		BackgroundTransparency = 1,
		TextColor3 = props.Color or T.Text,
		Font = props.Font or Enum.Font.Gotham,
		TextSize = props.TextSize or 14,
		TextWrapped = props.Wrap ~= false,
		TextXAlignment = props.Align or Enum.TextXAlignment.Left,
		TextYAlignment = props.VAlign or Enum.TextYAlignment.Center,
		Size = props.Size or UDim2.new(1, 0, 0, props.Height or 20),
		Position = props.Position or UDim2.new(),
		AutomaticSize = props.Auto or Enum.AutomaticSize.None,
		RichText = props.Rich or false,
		LayoutOrder = props.Order or 0,
		TextScaled = props.Scaled or false,
		Name = props.Name or "Label",
		Parent = parent,
	})
end

function UI.title(parent, text, order)
	return UI.label(parent, text, { Font = Enum.Font.GothamBlack, TextSize = 18, Height = 26, Order = order })
end

function UI.button(parent, text, onClick, props)
	props = props or {}
	local base = props.Color or T.Panel3
	local b = UI.new("TextButton", {
		Text = text,
		AutoButtonColor = false,
		BackgroundColor3 = base,
		TextColor3 = props.TextColor or T.Text,
		Font = props.Font or Enum.Font.GothamBold,
		TextSize = props.TextSize or 14,
		TextWrapped = true,
		Size = props.Size or UDim2.new(0, props.Width or 120, 0, props.Height or 34),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.Anchor or Vector2.new(),
		LayoutOrder = props.Order or 0,
		AutomaticSize = props.Auto or Enum.AutomaticSize.None,
		Name = props.Name or text,
		Parent = parent,
	})
	UI.corner(b, props.Radius or 8)
	local scale = UI.new("UIScale", { Parent = b })
	b.MouseEnter:Connect(function()
		UI.tween(b, { BackgroundColor3 = base:Lerp(Color3.new(1, 1, 1), 0.12) }, 0.1)
	end)
	b.MouseLeave:Connect(function()
		UI.tween(b, { BackgroundColor3 = base }, 0.1)
		UI.tween(scale, { Scale = 1 }, 0.1)
	end)
	b.MouseButton1Down:Connect(function()
		UI.tween(scale, { Scale = 0.95 }, 0.06)
	end)
	b.MouseButton1Up:Connect(function()
		UI.tween(scale, { Scale = 1 }, 0.08)
	end)
	if onClick then
		b.Activated:Connect(function()
			if props.Disabled then
				return
			end
			if UI.Sound then
				UI.Sound.play("Click")
			end
			onClick(b)
		end)
	end
	if props.Disabled then
		b.BackgroundTransparency = 0.5
		b.TextTransparency = 0.4
	end
	return b
end

function UI.scroll(parent, props)
	props = props or {}
	local s = UI.new("ScrollingFrame", {
		BackgroundTransparency = props.Transparency or 1,
		BackgroundColor3 = props.Color or T.Panel,
		BorderSizePixel = 0,
		Size = props.Size or UDim2.fromScale(1, 1),
		Position = props.Position or UDim2.new(),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = props.Horizontal and Enum.AutomaticSize.X or Enum.AutomaticSize.Y,
		ScrollBarThickness = 6,
		ScrollBarImageColor3 = T.Panel3,
		ScrollingDirection = props.Horizontal and Enum.ScrollingDirection.X or Enum.ScrollingDirection.Y,
		LayoutOrder = props.Order or 0,
		Name = props.Name or "Scroll",
		Parent = parent,
	})
	if props.Grid then
		UI.grid(s, props.Grid[1], props.Grid[2], props.Pad)
	elseif props.NoLayout ~= true then
		UI.list(s, props.Horizontal and Enum.FillDirection.Horizontal or Enum.FillDirection.Vertical, props.Pad or 6)
	end
	UI.padding(s, props.Padding or 4)
	return s
end

function UI.row(parent, height, order, pad)
	local r = UI.frame(parent, { Height = height or 34, Transparency = 1, Order = order, Radius = false })
	UI.list(r, Enum.FillDirection.Horizontal, pad or 6)
	r.UIListLayout.VerticalAlignment = Enum.VerticalAlignment.Center
	return r
end

function UI.input(parent, placeholder, default, props)
	props = props or {}
	local box = UI.new("TextBox", {
		PlaceholderText = placeholder or "",
		Text = default or "",
		ClearTextOnFocus = false,
		BackgroundColor3 = T.Bg,
		TextColor3 = T.Text,
		PlaceholderColor3 = T.Sub,
		Font = Enum.Font.Gotham,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextWrapped = props.Multi or false,
		MultiLine = props.Multi or false,
		Size = props.Size or UDim2.new(1, 0, 0, props.Height or 34),
		LayoutOrder = props.Order or 0,
		Parent = parent,
	})
	UI.corner(box, 6)
	UI.padding(box, 6)
	UI.stroke(box, T.Panel3)
	return box
end

-- Selector cíclico: [◀ texto ▶]
function UI.cycle(parent, label, options, index, onChange, props)
	props = props or {}
	local row = UI.row(parent, 32, props.Order)
	UI.label(row, label, { Size = UDim2.new(0, props.LabelWidth or 120, 1, 0), Color = T.Sub, TextSize = 13 })
	local idx = index or 1
	local value
	UI.button(row, "◀", function()
		idx = idx - 1
		if idx < 1 then
			idx = #options
		end
		value.Text = options[idx]
		onChange(idx)
	end, { Width = 30, Height = 28 })
	value = UI.label(row, options[idx] or "-", { Size = UDim2.new(0, props.ValueWidth or 170, 1, 0), Align = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold, TextSize = 13 })
	UI.button(row, "▶", function()
		idx = idx + 1
		if idx > #options then
			idx = 1
		end
		value.Text = options[idx]
		onChange(idx)
	end, { Width = 30, Height = 28 })
	return row
end

function UI.stepper(parent, label, value, min, max, step, onChange, props)
	props = props or {}
	local row = UI.row(parent, 32, props.Order)
	UI.label(row, label, { Size = UDim2.new(0, props.LabelWidth or 120, 1, 0), Color = T.Sub, TextSize = 13 })
	local v = value
	local txt
	local function fmt(x)
		return props.Format and props.Format(x) or tostring(x)
	end
	UI.button(row, "−", function()
		v = math.max(min, v - step)
		v = math.floor(v * 100 + 0.5) / 100
		txt.Text = fmt(v)
		onChange(v)
	end, { Width = 30, Height = 28 })
	txt = UI.label(row, fmt(v), { Size = UDim2.new(0, 70, 1, 0), Align = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold, TextSize = 13 })
	UI.button(row, "+", function()
		v = math.min(max, v + step)
		v = math.floor(v * 100 + 0.5) / 100
		txt.Text = fmt(v)
		onChange(v)
	end, { Width = 30, Height = 28 })
	return row
end

function UI.toggle(parent, label, value, onChange, props)
	props = props or {}
	local row = UI.row(parent, 32, props.Order)
	local state = value
	local b
	b = UI.button(row, (state and "✔ " or "✖ ") .. label, function()
		state = not state
		b.Text = (state and "✔ " or "✖ ") .. label
		b.BackgroundColor3 = state and T.Ok or T.Panel3
		onChange(state)
	end, { Width = props.Width or 220, Height = 28, Color = state and T.Ok or T.Panel3 })
	return row
end

function UI.progress(parent, ratio, color, props)
	props = props or {}
	local bg = UI.frame(parent, { Height = props.Height or 10, Color = T.Bg, Order = props.Order, Radius = 5, Size = props.Size })
	local fill = UI.frame(bg, { Size = UDim2.new(math.clamp(ratio or 0, 0, 1), 0, 1, 0), Color = color or T.Accent, Radius = 5, Name = "Fill" })
	return bg, fill
end

-- Gráfico de barras sencillo
function UI.bars(parent, values, labels, color, props)
	props = props or {}
	local box = UI.frame(parent, { Height = props.Height or 140, Color = T.Bg, Order = props.Order })
	UI.padding(box, 8)
	local maxV = 0
	for _, v in ipairs(values) do
		if v > maxV then
			maxV = v
		end
	end
	if maxV <= 0 then
		maxV = 1
	end
	local n = math.max(1, #values)
	for i, v in ipairs(values) do
		local col = UI.frame(box, { Size = UDim2.new(1 / n, -4, 1, -16), Position = UDim2.new((i - 1) / n, 2, 0, 0), Transparency = 1, Radius = false })
		local h = v / maxV
		UI.frame(col, { Size = UDim2.new(1, 0, h, 0), Position = UDim2.new(0, 0, 1 - h, 0), Color = color or T.Accent2, Radius = 3 })
		if labels and labels[i] then
			UI.label(box, labels[i], { Size = UDim2.new(1 / n, 0, 0, 14), Position = UDim2.new((i - 1) / n, 0, 1, -14), TextSize = 10, Color = T.Sub, Align = Enum.TextXAlignment.Center, Wrap = false })
		end
	end
	if #values == 0 then
		UI.label(box, "Sin datos todavía", { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, Color = T.Sub })
	end
	return box
end

function UI.clear(frame)
	for _, c in ipairs(frame:GetChildren()) do
		if not c:IsA("UIListLayout") and not c:IsA("UIGridLayout") and not c:IsA("UIPadding") and not c:IsA("UICorner") and not c:IsA("UIStroke") then
			c:Destroy()
		end
	end
end

function UI.card(parent, props)
	props = props or {}
	local f = UI.frame(parent, { Height = props.Height or 60, Color = props.Color or T.Panel2, Order = props.Order, Auto = props.Auto })
	UI.padding(f, props.Pad or 8)
	if props.List ~= false then
		UI.list(f, Enum.FillDirection.Vertical, props.Gap or 4)
	end
	return f
end

function UI.rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

-- Escala automática de la interfaz según la pantalla
function UI.attachScale(gui, userScale)
	local scale = gui:FindFirstChild("AutoScale") or UI.new("UIScale", { Name = "AutoScale", Parent = gui })
	local camera = workspace.CurrentCamera
	local function update()
		local vp = camera.ViewportSize
		local s = math.clamp(math.min(vp.X / 1280, vp.Y / 760), 0.55, 1.25)
		scale.Scale = s * (userScale and userScale() or 1)
	end
	camera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
	update()
	return update
end

return UI
