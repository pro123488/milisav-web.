-- Components (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/Components
-- Fábrica de elementos de interfaz reutilizables (todo por código, sin assets externos).

local Theme = require(script.Parent.Theme)

local C = {}

-- Crea una instancia con propiedades. props.Children = { instancias hijas }
function C.New(className, props, parent)
	local inst = Instance.new(className)
	local children
	for key, value in pairs(props or {}) do
		if key == "Children" then
			children = value
		else
			inst[key] = value
		end
	end
	if children then
		for _, child in ipairs(children) do
			child.Parent = inst
		end
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

function C.Corner(radius)
	return C.New("UICorner", { CornerRadius = radius or Theme.Radius })
end

function C.Stroke(color, thickness, transparency)
	return C.New("UIStroke", {
		Color = color or Theme.Stroke,
		Thickness = thickness or 1,
		Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function C.Padding(all, horizontal)
	local v = UDim.new(0, all or 8)
	local h = UDim.new(0, horizontal or all or 8)
	return C.New("UIPadding", { PaddingTop = v, PaddingBottom = v, PaddingLeft = h, PaddingRight = h })
end

function C.List(direction, padding, align)
	return C.New("UIListLayout", {
		FillDirection = direction or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, padding or 8),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = align or Enum.HorizontalAlignment.Left,
	})
end

function C.Label(text, props)
	local base = {
		BackgroundTransparency = 1,
		Font = Theme.Font,
		Text = text or "",
		TextColor3 = Theme.Text,
		TextSize = 16,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		RichText = true,
	}
	for k, v in pairs(props or {}) do
		base[k] = v
	end
	return C.New("TextLabel", base)
end

function C.Title(text, size)
	return C.Label(text, { Font = Theme.FontBlack, TextSize = size or 24 })
end

-- Asigna LayoutOrder según el orden de inserción a los hijos que no lo tengan,
-- para que los UIListLayout respeten el orden en que se añaden los elementos.
function C.AutoOrder(frame)
	local counter = 0
	for _, child in ipairs(frame:GetChildren()) do
		if child:IsA("GuiObject") then
			counter = math.max(counter, child.LayoutOrder)
		end
	end
	frame.ChildAdded:Connect(function(child)
		if child:IsA("GuiObject") then
			if child.LayoutOrder == 0 then
				counter += 1
				child.LayoutOrder = counter
			else
				counter = math.max(counter, child.LayoutOrder)
			end
		end
	end)
	return frame
end

-- Tarjeta con disposición vertical automática.
function C.Card(props, children)
	local base = {
		BackgroundColor3 = Theme.Card,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BorderSizePixel = 0,
		Children = { C.Corner(), C.Stroke(), C.Padding(12), C.List(nil, 8) },
	}
	for k, v in pairs(props or {}) do
		base[k] = v
	end
	local card = C.AutoOrder(C.New("Frame", base))
	for _, child in ipairs(children or {}) do
		child.Parent = card
	end
	return card
end

-- Devuelve una función que añade hijos a `parent` respetando el orden de llamada.
function C.Stack(parent)
	local order = 0
	return function(child)
		order += 1
		child.LayoutOrder = order
		child.Parent = parent
		return child
	end
end

-- style: "primary" | "secondary" | "danger" | "gold" | "ghost"
function C.Button(text, style, onClick, props)
	local colors = {
		primary = Theme.Accent,
		secondary = Theme.CardAlt,
		danger = Theme.Danger,
		gold = Theme.Gold,
		ghost = Theme.Panel,
		info = Theme.Info,
	}
	local base = {
		Text = text,
		Font = Theme.FontBold,
		TextSize = 16,
		TextColor3 = (style == "gold") and Color3.fromRGB(35, 25, 0) or Theme.Text,
		BackgroundColor3 = colors[style or "primary"] or Theme.Accent,
		AutoButtonColor = true,
		Size = UDim2.new(0, 0, 0, 40),
		AutomaticSize = Enum.AutomaticSize.X,
		BorderSizePixel = 0,
		Children = { C.Corner(Theme.RadiusSmall), C.Padding(6, 14) },
	}
	for k, v in pairs(props or {}) do
		base[k] = v
	end
	local button = C.New("TextButton", base)
	if onClick then
		button.Activated:Connect(function()
			if button.Active then
				onClick(button)
			end
		end)
	end
	return button
end

-- Desactiva un botón mostrando un texto alternativo.
function C.SetEnabled(button, enabled, disabledText)
	enabled = enabled == true
	button.Active = enabled
	button.AutoButtonColor = enabled
	button.BackgroundTransparency = enabled and 0 or 0.55
	button.TextTransparency = enabled and 0 or 0.35
	if not enabled and disabledText then
		button.Text = disabledText
	end
end

function C.Badge(text, color, textColor)
	return C.New("TextLabel", {
		Text = text,
		Font = Theme.FontBold,
		TextSize = 13,
		TextColor3 = textColor or Theme.Text,
		BackgroundColor3 = color or Theme.CardAlt,
		Size = UDim2.new(0, 0, 0, 24),
		AutomaticSize = Enum.AutomaticSize.X,
		Children = { C.Corner(UDim.new(0, 12)), C.Padding(2, 10) },
	})
end

function C.Row(children, padding, props)
	local base = {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Children = {
			C.New("UIListLayout", {
				FillDirection = Enum.FillDirection.Horizontal,
				Padding = UDim.new(0, padding or 8),
				SortOrder = Enum.SortOrder.LayoutOrder,
				VerticalAlignment = Enum.VerticalAlignment.Center,
				Wraps = true,
			}),
		},
	}
	for k, v in pairs(props or {}) do
		base[k] = v
	end
	local row = C.New("Frame", base)
	for i, child in ipairs(children or {}) do
		child.LayoutOrder = i
		child.Parent = row
	end
	return row
end

-- Rejilla adaptable: celdas de ancho mínimo `cellWidth`.
function C.Grid(cellWidth, cellHeight, padding)
	local frame = C.New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
	})
	local grid = C.New("UIGridLayout", {
		CellSize = UDim2.fromOffset(cellWidth, cellHeight),
		CellPadding = UDim2.fromOffset(padding or 8, padding or 8),
		SortOrder = Enum.SortOrder.LayoutOrder,
	}, frame)
	return frame, grid
end

function C.ProgressBar(fraction, color, height)
	fraction = math.clamp(fraction or 0, 0, 1)
	return C.New("Frame", {
		BackgroundColor3 = Theme.Panel,
		Size = UDim2.new(1, 0, 0, height or 8),
		BorderSizePixel = 0,
		Children = {
			C.Corner(UDim.new(1, 0)),
			C.New("Frame", {
				BackgroundColor3 = color or Theme.Accent,
				Size = UDim2.fromScale(fraction, 1),
				BorderSizePixel = 0,
				Children = { C.Corner(UDim.new(1, 0)) },
			}),
		},
	})
end

-- Tarjeta de estadística (KPI).
function C.Stat(icon, label, value, accent)
	return C.New("Frame", {
		BackgroundColor3 = Theme.Card,
		BorderSizePixel = 0,
		Children = {
			C.Corner(),
			C.Stroke(accent or Theme.Stroke, 1, 0.3),
			C.Padding(10),
			C.List(nil, 2),
			C.Label(icon .. "  " .. label, { TextColor3 = Theme.TextDim, TextSize = 13, LayoutOrder = 1 }),
			C.Label(value, { Font = Theme.FontBlack, TextSize = 22, LayoutOrder = 2, Name = "Value" }),
		},
	})
end

-- ScrollingFrame que ajusta su lienzo al contenido.
function C.Scroll(props)
	local base = {
		Name = "Scroll",
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 6,
		ScrollBarImageColor3 = Theme.Stroke,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		Children = { C.List(nil, 12), C.Padding(4, 4) },
	}
	for k, v in pairs(props or {}) do
		base[k] = v
	end
	return C.AutoOrder(C.New("ScrollingFrame", base))
end

-- Selector de opción (para escudos, paletas, diseños...).
-- opts: { selected, locked, lockText, onClick, height }
function C.OptionTile(title, subtitle, opts, extra)
	local stroke = C.Stroke(opts.selected and Theme.Accent or Theme.Stroke, opts.selected and 3 or 1)
	local tile = C.New("TextButton", {
		Text = "",
		AutoButtonColor = true,
		BackgroundColor3 = opts.locked and Theme.Panel or Theme.CardAlt,
		BorderSizePixel = 0,
		Children = { C.Corner(), stroke },
	})
	if extra then
		extra.Parent = tile
	end
	C.Label(title, {
		Font = Theme.FontBold,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.new(0, 4, 1, -40),
		Size = UDim2.new(1, -8, 0, 18),
		AutomaticSize = Enum.AutomaticSize.None,
		TextTruncate = Enum.TextTruncate.AtEnd,
		TextWrapped = false,
	}, nil).Parent = tile
	C.Label(opts.locked and ("🔒 " .. (opts.lockText or "")) or (subtitle or ""), {
		TextSize = 11,
		TextColor3 = opts.locked and Theme.Gold or Theme.TextDim,
		TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.new(0, 4, 1, -20),
		Size = UDim2.new(1, -8, 0, 16),
		AutomaticSize = Enum.AutomaticSize.None,
		TextTruncate = Enum.TextTruncate.AtEnd,
		TextWrapped = false,
	}).Parent = tile
	if opts.selected then
		C.Badge("✔", Theme.Accent).Parent = tile
	end
	if opts.onClick then
		tile.Activated:Connect(opts.onClick)
	end
	return tile
end

return C
