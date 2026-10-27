-- StadiumRenderer (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/StadiumRenderer
--
-- Construye el estadio físico a partir de los datos del club.
-- Optimización: cada grada es un bloque por fila (no un asiento por pieza),
-- las instalaciones son volúmenes simples y todo es Anchored. Un estadio completo
-- de la FASE 1 ronda las 150 piezas.
--
-- Coordenadas locales del terreno (220 x 170):
--   X: -110..110 (largo del campo), Z: -85..85 (Z+ = plaza de entrada)
--   Campo de juego centrado en (0, -10), 100 x 64.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local KitPattern = require(Shared.Modules.KitPattern)

local StadiumRenderer = {}

local PITCH_CENTER_Z = -10
local PITCH_LENGTH = 100
local PITCH_WIDTH = 64
local ROW_DEPTH = 3
local ROW_STEP = 1.5
local ROWS_BY_LEVEL = { 4, 5, 6, 8, 10, 12 }

local GOLD = Color3.fromRGB(255, 200, 70)
local WHITE = Color3.fromRGB(245, 245, 245)

-- Espacios de decoración (1-4 gratuitos, 5-8 Constructor Pro). Todos dentro del terreno.
StadiumRenderer.DecorationSlots = {
	Vector3.new(-40, 0, 72),
	Vector3.new(40, 0, 72),
	Vector3.new(-65, 0, 72),
	Vector3.new(65, 0, 72),
	Vector3.new(-90, 0, 72),
	Vector3.new(90, 0, 72),
	Vector3.new(-100, 0, -30),
	Vector3.new(100, 0, -30),
}
assert(#StadiumRenderer.DecorationSlots >= GameConfig.PRO_DECORATION_SLOTS, "Faltan posiciones de decoración")

StadiumRenderer.SpawnOffset = CFrame.new(0, 4, 64) * CFrame.Angles(0, 0, 0)

-- ===== Utilidades de construcción =====

local function part(parent, origin, offset, size, color, material, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.CFrame = origin * offset
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if props then
		for k, v in pairs(props) do
			p[k] = v
		end
	end
	p.Parent = parent
	return p
end

local function label(adornee, text, offsetY, color)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(220, 46)
	gui.StudsOffset = Vector3.new(0, offsetY or 4, 0)
	gui.MaxDistance = 140
	gui.AlwaysOnTop = false
	gui.Adornee = adornee
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 0.35
	t.BackgroundColor3 = Color3.fromRGB(15, 20, 30)
	t.TextColor3 = color or WHITE
	t.Font = Enum.Font.GothamBold
	t.TextScaled = true
	t.Text = text
	t.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = t
	gui.Parent = adornee
	return gui
end

local function surfaceText(partInstance, face, build)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 20
	gui.LightInfluence = 0.2
	gui.Parent = partInstance
	build(gui)
	return gui
end

local function material(name, fallback)
	local ok, value = pcall(function()
		return Enum.Material[name]
	end)
	return ok and value or fallback
end

-- ===== Elementos del estadio =====

local function buildPitch(folder, origin, level)
	local greens = {
		Color3.fromRGB(96, 140, 64),
		Color3.fromRGB(78, 150, 62),
		Color3.fromRGB(62, 160, 62),
		Color3.fromRGB(52, 168, 64),
		Color3.fromRGB(44, 176, 70),
	}
	local base = greens[math.clamp(level, 1, #greens)]
	local c = CFrame.new(0, 0.1, PITCH_CENTER_Z)
	part(folder, origin, c, Vector3.new(PITCH_LENGTH + 8, 0.2, PITCH_WIDTH + 8), base, Enum.Material.Grass, { Name = "Pitch" })
	-- Franjas de corte a partir del nivel 3
	if level >= 3 then
		local stripe = base:Lerp(Color3.new(0, 0, 0), 0.12)
		for i = 0, 4 do
			local x = -PITCH_LENGTH / 2 + 10 + i * 20
			part(folder, origin, CFrame.new(x, 0.21, PITCH_CENTER_Z), Vector3.new(10, 0.02, PITCH_WIDTH), stripe, Enum.Material.Grass, { CanCollide = false })
		end
	end
	-- Líneas
	local y, w = 0.23, 0.5
	local lineProps = { CanCollide = false, Name = "Line" }
	local hl, hw = PITCH_LENGTH / 2, PITCH_WIDTH / 2
	part(folder, origin, CFrame.new(0, y, PITCH_CENTER_Z - hw), Vector3.new(PITCH_LENGTH, 0.02, w), WHITE, nil, lineProps)
	part(folder, origin, CFrame.new(0, y, PITCH_CENTER_Z + hw), Vector3.new(PITCH_LENGTH, 0.02, w), WHITE, nil, lineProps)
	part(folder, origin, CFrame.new(-hl, y, PITCH_CENTER_Z), Vector3.new(w, 0.02, PITCH_WIDTH), WHITE, nil, lineProps)
	part(folder, origin, CFrame.new(hl, y, PITCH_CENTER_Z), Vector3.new(w, 0.02, PITCH_WIDTH), WHITE, nil, lineProps)
	part(folder, origin, CFrame.new(0, y, PITCH_CENTER_Z), Vector3.new(w, 0.02, PITCH_WIDTH), WHITE, nil, lineProps)
	local circle = part(folder, origin, CFrame.new(0, y, PITCH_CENTER_Z) * CFrame.Angles(0, 0, math.rad(90)),
		Vector3.new(0.02, 18, 18), WHITE, nil, lineProps)
	circle.Shape = Enum.PartType.Cylinder
	part(folder, origin, CFrame.new(0, y + 0.01, PITCH_CENTER_Z) * CFrame.Angles(0, 0, math.rad(90)),
		Vector3.new(0.02, 17, 17), base, Enum.Material.Grass, lineProps).Shape = Enum.PartType.Cylinder
	-- Porterías
	for _, side in ipairs({ -1, 1 }) do
		local x = side * hl
		for _, dz in ipairs({ -6, 6 }) do
			part(folder, origin, CFrame.new(x, 3, PITCH_CENTER_Z + dz), Vector3.new(0.5, 6, 0.5), WHITE)
		end
		part(folder, origin, CFrame.new(x, 6, PITCH_CENTER_Z), Vector3.new(0.5, 0.5, 12.5), WHITE)
		part(folder, origin, CFrame.new(x + side * 2, 3, PITCH_CENTER_Z), Vector3.new(4, 6, 12), WHITE,
			Enum.Material.ForceField, { CanCollide = false, Transparency = 0.6 })
	end
end

-- side: "N", "S", "W", "E"
local function buildStandSide(folder, origin, side, rows, design, primary, secondary)
	local length = (side == "N" or side == "S") and PITCH_LENGTH or PITCH_WIDTH
	local mat = material(design.material, Enum.Material.Concrete)
	for r = 1, rows do
		local height = r * ROW_STEP
		local dist = 4 + (r - 0.5) * ROW_DEPTH
		local cf, size
		if side == "N" then
			cf = CFrame.new(0, height / 2, PITCH_CENTER_Z - PITCH_WIDTH / 2 - dist)
			size = Vector3.new(length, height, ROW_DEPTH)
		elseif side == "S" then
			cf = CFrame.new(0, height / 2, PITCH_CENTER_Z + PITCH_WIDTH / 2 + dist)
			size = Vector3.new(length, height, ROW_DEPTH)
		elseif side == "W" then
			cf = CFrame.new(-PITCH_LENGTH / 2 - dist, height / 2, PITCH_CENTER_Z)
			size = Vector3.new(ROW_DEPTH, height, length)
		else
			cf = CFrame.new(PITCH_LENGTH / 2 + dist, height / 2, PITCH_CENTER_Z)
			size = Vector3.new(ROW_DEPTH, height, length)
		end
		part(folder, origin, cf, size, (r % 2 == 0) and secondary or primary, mat, { Name = "StandRow" })
	end

	local backDist = 4 + rows * ROW_DEPTH
	local topY = rows * ROW_STEP
	-- Barandilla de neón (diseño Arena Futurista)
	if design.neon then
		local cf = (side == "N" and CFrame.new(0, 1, PITCH_CENTER_Z - PITCH_WIDTH / 2 - 3.6))
			or (side == "S" and CFrame.new(0, 1, PITCH_CENTER_Z + PITCH_WIDTH / 2 + 3.6))
			or (side == "W" and CFrame.new(-PITCH_LENGTH / 2 - 3.6, 1, PITCH_CENTER_Z))
			or CFrame.new(PITCH_LENGTH / 2 + 3.6, 1, PITCH_CENTER_Z)
		local size = (side == "N" or side == "S") and Vector3.new(length, 0.4, 0.4) or Vector3.new(0.4, 0.4, length)
		part(folder, origin, cf, size, secondary, Enum.Material.Neon, { CanCollide = false })
	end
	-- Cubierta
	if design.roof then
		local depth = rows * ROW_DEPTH + 2
		local mid = 4 + depth / 2
		local roofY = topY + 9
		local tilt = design.canopy and math.rad(8) or 0
		local cf, size
		if side == "N" then
			cf = CFrame.new(0, roofY, PITCH_CENTER_Z - PITCH_WIDTH / 2 - mid) * CFrame.Angles(-tilt, 0, 0)
			size = Vector3.new(length + 2, 0.6, depth)
		elseif side == "S" then
			cf = CFrame.new(0, roofY, PITCH_CENTER_Z + PITCH_WIDTH / 2 + mid) * CFrame.Angles(tilt, 0, 0)
			size = Vector3.new(length + 2, 0.6, depth)
		elseif side == "W" then
			cf = CFrame.new(-PITCH_LENGTH / 2 - mid, roofY, PITCH_CENTER_Z) * CFrame.Angles(0, 0, tilt)
			size = Vector3.new(depth, 0.6, length + 2)
		else
			cf = CFrame.new(PITCH_LENGTH / 2 + mid, roofY, PITCH_CENTER_Z) * CFrame.Angles(0, 0, -tilt)
			size = Vector3.new(depth, 0.6, length + 2)
		end
		local roofMat = design.canopy and Enum.Material.Metal or Enum.Material.SmoothPlastic
		part(folder, origin, cf, size, Color3.fromRGB(230, 232, 236), roofMat,
			{ Name = "StandRoof", Transparency = design.material == "Glass" and 0.35 or 0 })
		-- Pilares en la parte trasera
		for _, t in ipairs({ -0.45, 0.45 }) do
			local px, pz
			if side == "N" or side == "S" then
				px = t * length
				pz = PITCH_CENTER_Z + (side == "N" and -1 or 1) * (PITCH_WIDTH / 2 + backDist + 0.5)
			else
				pz = PITCH_CENTER_Z + t * length
				px = (side == "W" and -1 or 1) * (PITCH_LENGTH / 2 + backDist + 0.5)
			end
			part(folder, origin, CFrame.new(px, roofY / 2, pz), Vector3.new(1, roofY, 1), Color3.fromRGB(70, 75, 85), Enum.Material.Metal)
		end
	end
end

local function buildStands(folder, origin, level, design, primary, secondary)
	if level < 1 then
		return
	end
	local rows = ROWS_BY_LEVEL[math.clamp(level, 1, #ROWS_BY_LEVEL)]
	local sides = { "N" }
	if level >= 2 then
		sides = { "N", "S" }
	end
	if level >= 3 then
		sides = { "N", "S", "W", "E" }
	end
	for _, side in ipairs(sides) do
		buildStandSide(folder, origin, side, rows, design, primary, secondary)
	end
end

local function buildLighting(folder, origin, level, vip)
	if level < 1 then
		return
	end
	local positions = { Vector3.new(-58, 0, PITCH_CENTER_Z - 40), Vector3.new(58, 0, PITCH_CENTER_Z - 40) }
	if level >= 2 then
		table.insert(positions, Vector3.new(-58, 0, PITCH_CENTER_Z + 40))
		table.insert(positions, Vector3.new(58, 0, PITCH_CENTER_Z + 40))
	end
	local height = 26 + level * 5
	-- VIP Club: iluminación dorada (ventaja visual, sin efecto económico)
	local lightColor = vip and Color3.fromRGB(255, 214, 130) or Color3.fromRGB(255, 252, 240)
	for _, pos in ipairs(positions) do
		part(folder, origin, CFrame.new(pos.X, height / 2, pos.Z), Vector3.new(1.4, height, 1.4), Color3.fromRGB(90, 95, 105), Enum.Material.Metal)
		local worldHead = (origin * CFrame.new(pos.X, height + 1.5, pos.Z)).Position
		local target = (origin * CFrame.new(0, 0, PITCH_CENTER_Z)).Position
		local head = Instance.new("Part")
		head.Anchored = true
		head.Size = Vector3.new(6, 3, 1)
		head.CFrame = CFrame.lookAt(worldHead, target)
		head.Material = Enum.Material.Neon
		head.Color = lightColor
		head.Parent = folder
		local spot = Instance.new("SpotLight")
		spot.Face = Enum.NormalId.Front
		spot.Angle = 70
		spot.Brightness = 1.5 + level
		spot.Range = 60
		spot.Color = lightColor
		spot.Parent = head
	end
end

local function buildScoreboard(folder, origin, level, info)
	if level < 1 then
		return
	end
	local width, height = 14 + level * 4, 7 + level * 2
	local baseY = 22
	local pos = Vector3.new(104, baseY + height / 2, PITCH_CENTER_Z)
	for _, dz in ipairs({ -width / 3, width / 3 }) do
		part(folder, origin, CFrame.new(104, baseY / 2, PITCH_CENTER_Z + dz), Vector3.new(1, baseY, 1), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	end
	local worldPos = (origin * CFrame.new(pos)).Position
	local target = (origin * CFrame.new(0, pos.Y, PITCH_CENTER_Z)).Position
	local board = Instance.new("Part")
	board.Name = "Scoreboard"
	board.Anchored = true
	board.Size = Vector3.new(width, height, 1)
	board.CFrame = CFrame.lookAt(worldPos, target)
	board.Color = Color3.fromRGB(15, 15, 20)
	board.Parent = folder
	surfaceText(board, Enum.NormalId.Front, function(gui)
		local bg = Instance.new("Frame")
		bg.Size = UDim2.fromScale(1, 1)
		bg.BackgroundColor3 = Color3.fromRGB(8, 10, 16)
		bg.Parent = gui
		local top = Instance.new("TextLabel")
		top.Size = UDim2.fromScale(1, 0.3)
		top.BackgroundTransparency = 1
		top.Font = Enum.Font.GothamBlack
		top.TextScaled = true
		top.TextColor3 = info.secondaryText
		top.Text = info.crestSymbol .. "  " .. info.clubName
		top.Parent = bg
		local score = Instance.new("TextLabel")
		score.Position = UDim2.fromScale(0, 0.3)
		score.Size = UDim2.fromScale(1, 0.5)
		score.BackgroundTransparency = 1
		score.Font = Enum.Font.Code
		score.TextScaled = true
		score.TextColor3 = Color3.fromRGB(255, 190, 40)
		score.Text = info.shortName .. "  0 - 0  ---"
		score.Parent = bg
		local bottom = Instance.new("TextLabel")
		bottom.Position = UDim2.fromScale(0, 0.8)
		bottom.Size = UDim2.fromScale(1, 0.2)
		bottom.BackgroundTransparency = 1
		bottom.Font = Enum.Font.Gotham
		bottom.TextScaled = true
		bottom.TextColor3 = Color3.fromRGB(180, 190, 200)
		bottom.Text = "Partidos disponibles en la FASE 5"
		bottom.Parent = bg
	end)
end

local function buildBuilding(folder, origin, pos, level, design, primary, secondary, title)
	if level < 1 then
		return
	end
	local size = Vector3.new(12 + level * 3, 7 + level * 1.5, 10 + level * 2)
	local isNeon = design.material == "Neon"
	local bodyMat = isNeon and Enum.Material.SmoothPlastic or material(design.material, Enum.Material.Brick)
	local bodyColor = (design.material == "Glass") and Color3.fromRGB(170, 210, 230)
		or (design.material == "DiamondPlate" and Color3.fromRGB(150, 155, 165))
		or (isNeon and Color3.fromRGB(30, 30, 40))
		or Color3.fromRGB(170, 95, 70)
	local body = part(folder, origin, CFrame.new(pos.X, size.Y / 2, pos.Z), size, bodyColor, bodyMat,
		{ Transparency = design.material == "Glass" and 0.25 or 0 })
	part(folder, origin, CFrame.new(pos.X, size.Y + 0.5, pos.Z), Vector3.new(size.X + 1, 1, size.Z + 1),
		isNeon and secondary or primary, isNeon and Enum.Material.Neon or Enum.Material.SmoothPlastic)
	label(body, string.format("%s · Nv %d", title, level), size.Y / 2 + 3)
end

local function buildSign(folder, origin, info)
	for _, x in ipairs({ -12, 12 }) do
		part(folder, origin, CFrame.new(x, 4, 78), Vector3.new(1, 8, 1), info.vip and GOLD or Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	end
	local board = part(folder, origin, CFrame.new(0, 11, 78), Vector3.new(26, 10, 1), info.primary, Enum.Material.SmoothPlastic, { Name = "ClubSign" })
	local function content(gui)
		local frame = Instance.new("Frame")
		frame.Size = UDim2.fromScale(1, 1)
		frame.BackgroundColor3 = Color3.fromRGB(12, 18, 32)
		frame.Parent = gui
		local stroke = Instance.new("UIStroke")
		stroke.Thickness = 10
		stroke.Color = info.vip and GOLD or info.primary
		stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		stroke.Parent = frame
		local crest = Instance.new("TextLabel")
		crest.Size = UDim2.fromScale(0.25, 0.7)
		crest.Position = UDim2.fromScale(0.02, 0.15)
		crest.BackgroundTransparency = 1
		crest.TextScaled = true
		crest.Text = info.crestSymbol
		crest.Parent = frame
		local name = Instance.new("TextLabel")
		name.Size = UDim2.fromScale(0.7, 0.38)
		name.Position = UDim2.fromScale(0.28, 0.1)
		name.BackgroundTransparency = 1
		name.Font = Enum.Font.GothamBlack
		name.TextScaled = true
		name.TextXAlignment = Enum.TextXAlignment.Left
		name.TextColor3 = WHITE
		name.Text = info.clubName
		name.Parent = frame
		local sub = Instance.new("TextLabel")
		sub.Size = UDim2.fromScale(0.7, 0.2)
		sub.Position = UDim2.fromScale(0.28, 0.5)
		sub.BackgroundTransparency = 1
		sub.Font = Enum.Font.Gotham
		sub.TextScaled = true
		sub.TextXAlignment = Enum.TextXAlignment.Left
		sub.TextColor3 = Color3.fromRGB(190, 200, 215)
		sub.Text = "Presidente: " .. info.ownerName .. " · " .. info.stageName
		sub.Parent = frame
		if info.vip then
			local tag = Instance.new("TextLabel")
			tag.Size = UDim2.fromScale(0.3, 0.2)
			tag.Position = UDim2.fromScale(0.28, 0.74)
			tag.BackgroundColor3 = GOLD
			tag.Font = Enum.Font.GothamBlack
			tag.TextScaled = true
			tag.TextColor3 = Color3.fromRGB(30, 20, 0)
			tag.Text = "👑 VIP CLUB"
			tag.Parent = frame
			local corner = Instance.new("UICorner")
			corner.CornerRadius = UDim.new(0.3, 0)
			corner.Parent = tag
		end
	end
	surfaceText(board, Enum.NormalId.Front, content)
	surfaceText(board, Enum.NormalId.Back, content)

	-- Expositor de equipación
	part(folder, origin, CFrame.new(-22, 3, 80), Vector3.new(0.6, 6, 0.6), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	local kitBoard = part(folder, origin, CFrame.new(-22, 8, 80), Vector3.new(5, 5, 0.4), info.primary)
	local function kit(gui)
		local holder = Instance.new("Frame")
		holder.Size = UDim2.fromScale(1, 1)
		holder.BorderSizePixel = 0
		holder.Parent = gui
		KitPattern.Build(holder, info.kitPattern, info.primary, info.secondary)
	end
	surfaceText(kitBoard, Enum.NormalId.Front, kit)
	surfaceText(kitBoard, Enum.NormalId.Back, kit)
end

local function buildEffect(folder, origin, effectId, primary, secondary)
	if effectId == "none" then
		return
	end
	local emitterPart = part(folder, origin, CFrame.new(0, 28, PITCH_CENTER_Z), Vector3.new(PITCH_LENGTH, 1, PITCH_WIDTH),
		WHITE, nil, { Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, Name = "EffectEmitter" })
	local e = Instance.new("ParticleEmitter")
	e.Shape = Enum.ParticleEmitterShape.Box
	e.EmissionDirection = Enum.NormalId.Bottom
	if effectId == "confetti" then
		e.Color = ColorSequence.new(primary, secondary)
		e.Size = NumberSequence.new(0.4)
		e.Rate = 25
		e.Lifetime = NumberRange.new(6, 8)
		e.Speed = NumberRange.new(2, 4)
		e.RotSpeed = NumberRange.new(-180, 180)
		e.Acceleration = Vector3.new(0, -2, 0)
	elseif effectId == "sparkles" then
		e.Color = ColorSequence.new(WHITE, secondary)
		e.LightEmission = 1
		e.Size = NumberSequence.new(0.6, 0)
		e.Rate = 30
		e.Lifetime = NumberRange.new(2, 3)
		e.Speed = NumberRange.new(1, 3)
	elseif effectId == "smoke" then
		emitterPart.CFrame = origin * CFrame.new(0, 2, PITCH_CENTER_Z)
		e.EmissionDirection = Enum.NormalId.Top
		e.Color = ColorSequence.new(primary, secondary)
		e.Size = NumberSequence.new(3, 8)
		e.Transparency = NumberSequence.new(0.5, 1)
		e.Rate = 6
		e.Lifetime = NumberRange.new(4, 6)
		e.Speed = NumberRange.new(2, 4)
	elseif effectId == "vip_gold" then
		e.Color = ColorSequence.new(GOLD)
		e.LightEmission = 1
		e.Size = NumberSequence.new(0.5, 0)
		e.Rate = 35
		e.Lifetime = NumberRange.new(3, 4)
		e.Speed = NumberRange.new(1, 2)
	end
	e.Parent = emitterPart
end

-- ===== Decoraciones =====

local DecorationBuilders = {}

DecorationBuilders.flags = function(f, o, p, info)
	for i, dx in ipairs({ -3, 3 }) do
		part(f, o, CFrame.new(p.X + dx, 6, p.Z), Vector3.new(0.4, 12, 0.4), Color3.fromRGB(200, 200, 205), Enum.Material.Metal)
		part(f, o, CFrame.new(p.X + dx + 1.6, 10.5, p.Z), Vector3.new(3, 2, 0.1), i == 1 and info.primary or info.secondary, Enum.Material.Fabric)
	end
end
DecorationBuilders.planters = function(f, o, p)
	part(f, o, CFrame.new(p.X, 1, p.Z), Vector3.new(6, 2, 3), Color3.fromRGB(120, 80, 60), Enum.Material.Wood)
	local bush = part(f, o, CFrame.new(p.X, 3, p.Z), Vector3.new(5, 3, 3), Color3.fromRGB(50, 130, 50), Enum.Material.Grass)
	bush.Shape = Enum.PartType.Ball
end
DecorationBuilders.bench = function(f, o, p, info)
	part(f, o, CFrame.new(p.X, 1.4, p.Z), Vector3.new(7, 0.4, 2), info.primary, Enum.Material.Wood)
	part(f, o, CFrame.new(p.X, 2.6, p.Z + 0.9), Vector3.new(7, 2, 0.3), info.secondary, Enum.Material.Wood)
	part(f, o, CFrame.new(p.X, 0.6, p.Z), Vector3.new(6, 1.2, 1), Color3.fromRGB(70, 70, 75), Enum.Material.Metal)
end
DecorationBuilders.ball_statue = function(f, o, p)
	part(f, o, CFrame.new(p.X, 1.5, p.Z), Vector3.new(5, 3, 5), Color3.fromRGB(150, 150, 155), Enum.Material.Marble)
	local ball = part(f, o, CFrame.new(p.X, 5.5, p.Z), Vector3.new(5, 5, 5), WHITE, Enum.Material.SmoothPlastic)
	ball.Shape = Enum.PartType.Ball
end
DecorationBuilders.pro_arch = function(f, o, p, info)
	for _, dx in ipairs({ -4.5, 4.5 }) do
		part(f, o, CFrame.new(p.X + dx, 6, p.Z), Vector3.new(1.5, 12, 1.5), info.primary, Enum.Material.Metal)
	end
	part(f, o, CFrame.new(p.X, 12.5, p.Z), Vector3.new(11, 1.5, 1.5), info.secondary, Enum.Material.Metal)
	part(f, o, CFrame.new(p.X, 11.5, p.Z), Vector3.new(9, 0.3, 0.3), info.secondary, Enum.Material.Neon, { CanCollide = false })
end
DecorationBuilders.pro_fountain = function(f, o, p)
	local basin = part(f, o, CFrame.new(p.X, 0.8, p.Z) * CFrame.Angles(0, 0, math.rad(90)), Vector3.new(1.6, 9, 9), Color3.fromRGB(200, 200, 205), Enum.Material.Marble)
	basin.Shape = Enum.PartType.Cylinder
	local water = part(f, o, CFrame.new(p.X, 1.4, p.Z) * CFrame.Angles(0, 0, math.rad(90)), Vector3.new(0.4, 8, 8), Color3.fromRGB(80, 160, 230), Enum.Material.Glass, { Transparency = 0.3, CanCollide = false })
	water.Shape = Enum.PartType.Cylinder
	part(f, o, CFrame.new(p.X, 3, p.Z), Vector3.new(1.2, 4, 1.2), Color3.fromRGB(200, 200, 205), Enum.Material.Marble)
	local spray = Instance.new("ParticleEmitter")
	spray.Color = ColorSequence.new(Color3.fromRGB(170, 220, 255))
	spray.Size = NumberSequence.new(0.4, 0.1)
	spray.Rate = 20
	spray.Speed = NumberRange.new(5, 7)
	spray.Acceleration = Vector3.new(0, -12, 0)
	spray.SpreadAngle = Vector2.new(15, 15)
	spray.Lifetime = NumberRange.new(1, 1.2)
	spray.Parent = water
end
DecorationBuilders.pro_screen = function(f, o, p, info)
	part(f, o, CFrame.new(p.X, 4, p.Z), Vector3.new(1, 8, 1), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	local screen = part(f, o, CFrame.new(p.X, 10, p.Z), Vector3.new(10, 5.5, 0.6), Color3.fromRGB(10, 10, 15))
	local function content(gui)
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundColor3 = info.primary
		t.TextColor3 = info.secondaryText
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Text = info.crestSymbol .. " " .. info.shortName
		t.Parent = gui
	end
	surfaceText(screen, Enum.NormalId.Front, content)
	surfaceText(screen, Enum.NormalId.Back, content)
end
DecorationBuilders.cos_banner = function(f, o, p, info)
	for _, dx in ipairs({ -4.5, 4.5 }) do
		part(f, o, CFrame.new(p.X + dx, 5, p.Z), Vector3.new(0.5, 10, 0.5), Color3.fromRGB(200, 200, 205), Enum.Material.Metal)
	end
	local banner = part(f, o, CFrame.new(p.X, 7, p.Z), Vector3.new(9, 4, 0.1), info.primary, Enum.Material.Fabric)
	local function content(gui)
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundColor3 = info.primary
		t.TextColor3 = info.secondaryText
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Text = "¡VAMOS " .. string.upper(info.shortName) .. "!"
		t.Parent = gui
	end
	surfaceText(banner, Enum.NormalId.Front, content)
	surfaceText(banner, Enum.NormalId.Back, content)
end
DecorationBuilders.cos_fireworks = function(f, o, p, info)
	local tower = part(f, o, CFrame.new(p.X, 3, p.Z), Vector3.new(2, 6, 2), Color3.fromRGB(40, 40, 50), Enum.Material.Metal)
	local fx = Instance.new("ParticleEmitter")
	fx.EmissionDirection = Enum.NormalId.Top
	fx.Color = ColorSequence.new(info.primary, info.secondary)
	fx.LightEmission = 1
	fx.Size = NumberSequence.new(0.6, 0)
	fx.Rate = 15
	fx.Speed = NumberRange.new(20, 28)
	fx.SpreadAngle = Vector2.new(10, 10)
	fx.Acceleration = Vector3.new(0, -10, 0)
	fx.Lifetime = NumberRange.new(2, 2.5)
	fx.Parent = tower
end
DecorationBuilders.vip_carpet = function(f, o, p)
	part(f, o, CFrame.new(p.X, 0.1, p.Z), Vector3.new(4, 0.2, 12), Color3.fromRGB(170, 15, 30), Enum.Material.Fabric, { CanCollide = false })
	for _, dz in ipairs({ -5, 0, 5 }) do
		for _, dx in ipairs({ -2.6, 2.6 }) do
			part(f, o, CFrame.new(p.X + dx, 1.2, p.Z + dz), Vector3.new(0.4, 2.4, 0.4), GOLD, Enum.Material.Metal)
		end
	end
end
DecorationBuilders.vip_statue = function(f, o, p)
	part(f, o, CFrame.new(p.X, 1.5, p.Z), Vector3.new(4, 3, 4), Color3.fromRGB(30, 30, 35), Enum.Material.Marble)
	part(f, o, CFrame.new(p.X, 6, p.Z), Vector3.new(2, 6, 1.2), GOLD, Enum.Material.Metal, { Reflectance = 0.3 })
	local head = part(f, o, CFrame.new(p.X, 9.8, p.Z), Vector3.new(1.6, 1.6, 1.6), GOLD, Enum.Material.Metal, { Reflectance = 0.3 })
	head.Shape = Enum.PartType.Ball
	local sparkle = Instance.new("Sparkles")
	sparkle.SparkleColor = GOLD
	sparkle.Parent = head
end

local function buildDecorations(folder, origin, visible, maxSlots, info)
	for slot = 1, GameConfig.PRO_DECORATION_SLOTS do
		local pos = StadiumRenderer.DecorationSlots[slot]
		local decoId = visible[slot]
		if decoId and DecorationBuilders[decoId] then
			local sub = Instance.new("Folder")
			sub.Name = "Decoration_" .. slot
			sub.Parent = folder
			DecorationBuilders[decoId](sub, origin, pos, info)
		elseif slot <= maxSlots then
			-- Marca de espacio libre (solo visual)
			local marker = part(folder, origin, CFrame.new(pos.X, 0.05, pos.Z), Vector3.new(8, 0.1, 8),
				Color3.fromRGB(255, 255, 255), Enum.Material.SmoothPlastic,
				{ Transparency = 0.7, CanCollide = false, Name = "FreeSlot_" .. slot })
			label(marker, "Espacio " .. slot .. " libre", 2, Color3.fromRGB(200, 220, 255)).MaxDistance = 50
		end
	end
end

-- ===== API =====

-- info: ver PlotService.BuildRenderInfo
function StadiumRenderer.Render(folder, origin, info)
	folder:ClearAllChildren()
	local facilities = info.facilities
	local standsDesign = CosmeticConfig.ById.design[info.appearance.standsDesign] or CosmeticConfig.ById.design.classic
	local buildingDesign = CosmeticConfig.ById.design[info.appearance.buildingDesign] or CosmeticConfig.ById.design.brick

	buildPitch(folder, origin, facilities.pitch or 1)
	buildStands(folder, origin, facilities.stands or 1, standsDesign, info.primary, info.secondary)
	buildLighting(folder, origin, facilities.lighting or 0, info.vip)
	buildScoreboard(folder, origin, facilities.scoreboard or 0, info)
	local lockers = FacilityConfig.Get("lockers")
	local shop = FacilityConfig.Get("shop")
	local restaurant = FacilityConfig.Get("restaurant")
	buildBuilding(folder, origin, Vector3.new(-88, 0, -68), facilities.lockers or 0, buildingDesign, info.primary, info.secondary, lockers.icon .. " " .. lockers.name)
	buildBuilding(folder, origin, Vector3.new(-85, 0, 45), facilities.shop or 0, buildingDesign, info.primary, info.secondary, shop.icon .. " " .. shop.name)
	buildBuilding(folder, origin, Vector3.new(85, 0, 45), facilities.restaurant or 0, buildingDesign, info.primary, info.secondary, restaurant.icon .. " " .. restaurant.name)
	buildSign(folder, origin, info)
	buildEffect(folder, origin, info.appearance.effect, info.primary, info.secondary)
	buildDecorations(folder, origin, info.decorations, info.maxSlots, info)
end

return StadiumRenderer
