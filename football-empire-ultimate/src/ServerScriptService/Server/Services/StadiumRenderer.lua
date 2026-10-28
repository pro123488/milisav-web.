-- StadiumRenderer (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/StadiumRenderer
--
-- Construye el estadio físico a partir de los datos del club.
-- Optimización: cada grada es un bloque por fila (no un asiento por pieza),
-- las esquinas son 3 bloques escalonados, las instalaciones son volúmenes simples
-- y todo es Anchored. Un estadio legendario completo ronda las 300 piezas.
--
-- El plano (posiciones de todo) está en ReplicatedStorage/Shared/Modules/StadiumLayout.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local KitPattern = require(Shared.Modules.KitPattern)
local Layout = require(Shared.Modules.StadiumLayout)

local StadiumRenderer = {}

local PITCH_CENTER_Z = Layout.PITCH_CENTER_Z
local PITCH_LENGTH = Layout.PITCH_LENGTH
local PITCH_WIDTH = Layout.PITCH_WIDTH
local ROW_DEPTH = Layout.ROW_DEPTH
local ROW_STEP = Layout.ROW_STEP
local ROWS_BY_LEVEL = Layout.ROWS_BY_LEVEL

local GOLD = Color3.fromRGB(255, 200, 70)
local WHITE = Color3.fromRGB(245, 245, 245)

StadiumRenderer.SpawnOffset = CFrame.new(Layout.SPAWN)

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
	-- Torres en las esquinas exteriores del estadio (fuera de gradas y esquinas)
	local positions = { Vector3.new(-100, 0, -97), Vector3.new(100, 0, -97) }
	if level >= 2 then
		table.insert(positions, Vector3.new(-100, 0, 72))
		table.insert(positions, Vector3.new(100, 0, 72))
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
		spot.Angle = 90
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
	-- Detrás de la grada norte, por encima de su cubierta
	local baseY = 32
	local z = -100
	local pos = Vector3.new(0, baseY + height / 2, z)
	for _, dx in ipairs({ -width / 3, width / 3 }) do
		part(folder, origin, CFrame.new(dx, baseY / 2, z), Vector3.new(1, baseY, 1), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
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
		local last = info.lastMatch
		if last then
			score.Text = last.home and string.format("%s  %d - %d  %s", info.shortName, last.gf, last.ga, last.short)
				or string.format("%s  %d - %d  %s", last.short, last.ga, last.gf, info.shortName)
		else
			score.Text = info.shortName .. "  0 - 0  ---"
		end
		score.Parent = bg
		local bottom = Instance.new("TextLabel")
		bottom.Position = UDim2.fromScale(0, 0.8)
		bottom.Size = UDim2.fromScale(1, 0.2)
		bottom.BackgroundTransparency = 1
		bottom.Font = Enum.Font.Gotham
		bottom.TextScaled = true
		bottom.TextColor3 = Color3.fromRGB(180, 190, 200)
		bottom.Text = last and string.format("Último partido · %s · Temporada %d", last.competition or "", last.season or 1) or "Sin partidos todavía"
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
	return body, size
end

-- Campo de entrenamiento pequeño (centro de entrenamiento y academia)
local function miniPitch(folder, origin, pos, length, width, withGoals)
	part(folder, origin, CFrame.new(pos.X, 0.1, pos.Z), Vector3.new(length, 0.2, width), Color3.fromRGB(60, 160, 65), Enum.Material.Grass)
	part(folder, origin, CFrame.new(pos.X, 0.22, pos.Z), Vector3.new(0.4, 0.02, width), WHITE, nil, { CanCollide = false })
	if withGoals then
		for _, side in ipairs({ -1, 1 }) do
			local x = pos.X + side * length / 2
			for _, dz in ipairs({ -3, 3 }) do
				part(folder, origin, CFrame.new(x, 1.5, pos.Z + dz), Vector3.new(0.3, 3, 0.3), WHITE)
			end
			part(folder, origin, CFrame.new(x, 3, pos.Z), Vector3.new(0.3, 0.3, 6.3), WHITE)
		end
	end
end

local GLASS_DESIGN = { material = "Glass" }

local function buildLaneFacilities(folder, origin, facilities, design, info)
	local F = Layout.Facilities
	local function title(id)
		local def = FacilityConfig.Get(id)
		return def.icon .. " " .. def.name
	end
	buildBuilding(folder, origin, F.lockers, facilities.lockers or 0, design, info.primary, info.secondary, title("lockers"))
	buildBuilding(folder, origin, F.shop, facilities.shop or 0, design, info.primary, info.secondary, title("shop"))
	buildBuilding(folder, origin, F.restaurant, facilities.restaurant or 0, design, info.primary, info.secondary, title("restaurant"))

	-- Zona VIP: pabellón de cristal con remate dorado
	local vipLevel = facilities.vip or 0
	if vipLevel > 0 then
		local body, size = buildBuilding(folder, origin, F.vip, vipLevel, GLASS_DESIGN, info.primary, info.secondary, title("vip"))
		part(folder, origin, CFrame.new(F.vip.X, size.Y + 1.2, F.vip.Z), Vector3.new(size.X + 1.4, 0.4, size.Z + 1.4), GOLD, Enum.Material.Neon, { CanCollide = false })
		body.Color = Color3.fromRGB(190, 220, 240)
	end

	-- Centro de entrenamiento: edificio + campo de entrenamiento
	local trainingLevel = facilities.training or 0
	if trainingLevel > 0 then
		buildBuilding(folder, origin, F.training + Vector3.new(0, 0, 12), trainingLevel, design, info.primary, info.secondary, title("training"))
		miniPitch(folder, origin, F.training + Vector3.new(0, 0, -18), 20 + trainingLevel * 3, 14, trainingLevel >= 2)
	end

	-- Academia juvenil: edificio + campo pequeño
	local academyLevel = facilities.academy or 0
	if academyLevel > 0 then
		buildBuilding(folder, origin, F.academy + Vector3.new(0, 0, -6), academyLevel, design, info.primary, info.secondary, title("academy"))
		miniPitch(folder, origin, F.academy + Vector3.new(0, 0, 12), 18 + academyLevel * 2, 8, academyLevel >= 2)
	end

	-- Sala de trofeos: edificio con copa y contador REAL de títulos
	local trophyLevel = facilities.trophyRoom or 0
	if trophyLevel > 0 then
		local _, size = buildBuilding(folder, origin, F.trophyRoom, trophyLevel, design, info.primary, info.secondary, title("trophyRoom"))
		local cup = part(folder, origin, CFrame.new(F.trophyRoom.X, size.Y + 3, F.trophyRoom.Z) * CFrame.Angles(0, 0, math.rad(90)),
			Vector3.new(4, 3, 3), GOLD, Enum.Material.Metal, { Reflectance = 0.3 })
		cup.Shape = Enum.PartType.Cylinder
		label(cup, string.format("🏆 Títulos: %d", info.trophyCount or 0), 4, GOLD).MaxDistance = 90
		-- Vitrina física: una copa por título real (las 12 más recientes) y una placa con la lista
		local trophies = info.trophies or {}
		local shelfX = F.trophyRoom.X + size.X / 2 + 4
		part(folder, origin, CFrame.new(shelfX, 1, F.trophyRoom.Z), Vector3.new(3, 2, 26), Color3.fromRGB(60, 40, 25), Enum.Material.Wood)
		local shown = 0
		for i = #trophies, math.max(1, #trophies - 11), -1 do
			local t = trophies[i]
			shown += 1
			local z = F.trophyRoom.Z - 12 + (shown - 1) * 2.2
			local trophyCup = part(folder, origin, CFrame.new(shelfX, 3, z) * CFrame.Angles(0, 0, math.rad(90)),
				Vector3.new(2, 1.2, 1.2), t.kind == "cup" and Color3.fromRGB(220, 220, 230) or GOLD, Enum.Material.Metal, { Reflectance = 0.3 })
			trophyCup.Shape = Enum.PartType.Cylinder
		end
		local plaque = part(folder, origin, CFrame.new(shelfX + 1.6, 5, F.trophyRoom.Z) * CFrame.Angles(0, math.rad(90), 0),
			Vector3.new(26, 4, 0.3), Color3.fromRGB(30, 25, 15), Enum.Material.Wood)
		local lines = {}
		for i = #trophies, math.max(1, #trophies - 5), -1 do
			table.insert(lines, string.format("%s %s (T%d)", trophies[i].kind == "cup" and "🥇" or "🏆", trophies[i].name, trophies[i].season))
		end
		local function plaqueText(gui)
			local t = Instance.new("TextLabel")
			t.Size = UDim2.fromScale(1, 1)
			t.BackgroundTransparency = 1
			t.TextColor3 = GOLD
			t.Font = Enum.Font.GothamBold
			t.TextScaled = true
			t.Text = #lines > 0 and table.concat(lines, "   ·   ") or "La vitrina espera su primer título"
			t.Parent = gui
		end
		surfaceText(plaque, Enum.NormalId.Front, plaqueText)
		surfaceText(plaque, Enum.NormalId.Back, plaqueText)
	end
end

local function buildSign(folder, origin, info)
	for _, x in ipairs({ -12, 12 }) do
		part(folder, origin, CFrame.new(x, 4, Layout.SIGN.Z), Vector3.new(1, 8, 1), info.vip and GOLD or Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	end
	local board = part(folder, origin, CFrame.new(0, 11, Layout.SIGN.Z), Vector3.new(26, 10, 1), info.primary, Enum.Material.SmoothPlastic, { Name = "ClubSign" })
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
		local naming = info.sponsors and info.sponsors.naming
		sub.Text = (naming and ("🏟️ Estadio " .. naming .. " · ") or "") .. "Presidente: " .. info.ownerName .. " · " .. info.stageName
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
	part(folder, origin, CFrame.new(Layout.KIT_DISPLAY.X, 3, Layout.KIT_DISPLAY.Z), Vector3.new(0.6, 6, 0.6), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
	local kitBoard = part(folder, origin, CFrame.new(Layout.KIT_DISPLAY.X, 8, Layout.KIT_DISPLAY.Z), Vector3.new(5, 5, 0.4), info.primary)
	local function kit(gui)
		local holder = Instance.new("Frame")
		holder.Size = UDim2.fromScale(1, 1)
		holder.BorderSizePixel = 0
		holder.Parent = gui
		KitPattern.Build(holder, info.kitPattern, info.primary, info.secondary)
		local shirtSponsor = info.sponsors and info.sponsors.shirt
		if shirtSponsor then
			local t = Instance.new("TextLabel")
			t.Name = "KitPart"
			t.BackgroundTransparency = 1
			t.Position = UDim2.fromScale(0.1, 0.35)
			t.Size = UDim2.fromScale(0.8, 0.25)
			t.Font = Enum.Font.GothamBlack
			t.TextScaled = true
			t.TextColor3 = info.secondaryText
			t.TextStrokeTransparency = 0.5
			t.Text = string.upper(shirtSponsor)
			t.ZIndex = 5
			t.Parent = holder
		end
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

-- Decoraciones en posición libre: cada una se construye en su propio marco local
-- (posición + rotación), así los constructores no necesitan saber de rotaciones.
local function buildDecorations(folder, origin, decorations, visibleFlags, info)
	for index, entry in ipairs(decorations) do
		local builder = DecorationBuilders[entry.id]
		if builder and visibleFlags[index] then
			local sub = Instance.new("Folder")
			sub.Name = "Decoration_" .. index
			sub.Parent = folder
			local frame = origin * CFrame.new(entry.x, 0, entry.z) * CFrame.Angles(0, math.rad(entry.r or 0), 0)
			builder(sub, frame, Vector3.zero, info)
		end
	end
end

-- ===== Comercial y patrocinio (FASE 3) =====

-- Vallas publicitarias alrededor del campo: muestran el patrocinador de vallas real.
local function buildAdBoards(folder, origin, info)
	local brand = info.sponsors and info.sponsors.boards
	local text = brand and string.upper(brand) or "¡ANÚNCIATE AQUÍ!"
	for _, sz in ipairs({ -1, 1 }) do
		for _, x in ipairs({ -25, 25 }) do
			local z = PITCH_CENTER_Z + sz * (PITCH_WIDTH / 2 + 2.5)
			local board = part(folder, origin, CFrame.new(x, 0.8, z), Vector3.new(40, 1.6, 0.4), Color3.fromRGB(15, 15, 20),
				Enum.Material.SmoothPlastic, { Name = "AdBoard" })
			local function content(gui)
				local t = Instance.new("TextLabel")
				t.Size = UDim2.fromScale(1, 1)
				t.BackgroundColor3 = brand and info.primary or Color3.fromRGB(30, 30, 40)
				t.TextColor3 = brand and info.secondaryText or Color3.fromRGB(200, 200, 210)
				t.Font = Enum.Font.GothamBlack
				t.TextScaled = true
				t.Text = text
				t.Parent = gui
			end
			surfaceText(board, Enum.NormalId.Front, content)
			surfaceText(board, Enum.NormalId.Back, content)
		end
	end
end

local function buildKiosks(folder, origin, level, info)
	if level < 1 then
		return
	end
	local xs = { -60, 60 }
	if level >= 2 then
		table.insert(xs, -80)
		table.insert(xs, 80)
	end
	if level >= 3 then
		table.insert(xs, -40)
		table.insert(xs, 40)
	end
	for i, x in ipairs(xs) do
		local counter = part(folder, origin, CFrame.new(x, 1.5, 72), Vector3.new(5, 3, 3), Color3.fromRGB(200, 170, 120), Enum.Material.WoodPlanks)
		part(folder, origin, CFrame.new(x, 4.2, 72), Vector3.new(6, 0.4, 4), info.primary, Enum.Material.Fabric)
		if i == 1 then
			label(counter, string.format("🌭 Quioscos · Nv %d", level), 4).MaxDistance = 80
		end
	end
end

local function buildTourBooth(folder, origin, level, info)
	if level < 1 then
		return
	end
	local booth = part(folder, origin, CFrame.new(20, 2.5, 72), Vector3.new(6, 5, 3), Color3.fromRGB(240, 240, 235), Enum.Material.SmoothPlastic)
	part(folder, origin, CFrame.new(20, 5.3, 72), Vector3.new(7, 0.6, 4), info.secondary, Enum.Material.SmoothPlastic)
	label(booth, string.format("🗺️ Tour del estadio · Nv %d", level), 4).MaxDistance = 80
end

-- Afición en las gradas (se dibuja en una carpeta aparte y solo cuando cambia la ocupación).
function StadiumRenderer.RenderCrowd(folder, origin, standsLevel, occupancy, info)
	folder:ClearAllChildren()
	if standsLevel < 1 or occupancy <= 0 then
		return
	end
	local rows = ROWS_BY_LEVEL[math.clamp(standsLevel, 1, #ROWS_BY_LEVEL)]
	local filled = math.clamp(math.floor(rows * occupancy + 0.5), 1, rows)
	local sides = { "N" }
	if standsLevel >= 2 then
		sides = { "N", "S" }
	end
	if standsLevel >= 3 then
		sides = { "N", "S", "W", "E" }
	end
	local colors = { info.primary, info.secondary, Color3.fromRGB(235, 235, 235) }
	local props = { CanCollide = false, CanQuery = false, CastShadow = false, Name = "Crowd" }
	for _, side in ipairs(sides) do
		local length = (side == "N" or side == "S") and PITCH_LENGTH - 2 or PITCH_WIDTH - 2
		for r = 1, filled do
			local y = r * ROW_STEP + 0.35
			local dist = 4 + (r - 0.5) * ROW_DEPTH
			local cf, size
			if side == "N" then
				cf, size = CFrame.new(0, y, PITCH_CENTER_Z - PITCH_WIDTH / 2 - dist), Vector3.new(length, 0.7, 1.6)
			elseif side == "S" then
				cf, size = CFrame.new(0, y, PITCH_CENTER_Z + PITCH_WIDTH / 2 + dist), Vector3.new(length, 0.7, 1.6)
			elseif side == "W" then
				cf, size = CFrame.new(-PITCH_LENGTH / 2 - dist, y, PITCH_CENTER_Z), Vector3.new(1.6, 0.7, length)
			else
				cf, size = CFrame.new(PITCH_LENGTH / 2 + dist, y, PITCH_CENTER_Z), Vector3.new(1.6, 0.7, length)
			end
			part(folder, origin, cf, size, colors[(r % 3) + 1], Enum.Material.Fabric, props)
		end
	end
end

-- ===== Estadio evolutivo: elementos de cada etapa =====

local function stageColor(name)
	local colors = {
		Concrete = Color3.fromRGB(175, 175, 170),
		Cobblestone = Color3.fromRGB(150, 140, 130),
		Slate = Color3.fromRGB(110, 115, 125),
		Marble = Color3.fromRGB(230, 228, 222),
		WoodPlanks = Color3.fromRGB(150, 110, 70),
		Brick = Color3.fromRGB(160, 80, 60),
		Glass = Color3.fromRGB(170, 210, 235),
	}
	return colors[name] or Color3.fromRGB(170, 170, 170)
end

local function buildWalls(folder, origin, visual, info)
	local wall = visual.wall
	local h = wall.height
	local mat = material(wall.material, Enum.Material.Concrete)
	local color = stageColor(wall.material)
	local props = { Transparency = wall.material == "Glass" and 0.4 or 0, Name = "Wall" }
	local hx, hz = Layout.HALF_X, Layout.HALF_Z
	local t = 1.5
	local gateHalf = 10
	local segments = {
		{ CFrame.new(0, h / 2, -hz + t / 2), Vector3.new(hx * 2, h, t) }, -- norte
		{ CFrame.new(-hx + t / 2, h / 2, 0), Vector3.new(t, h, hz * 2) }, -- oeste
		{ CFrame.new(hx - t / 2, h / 2, 0), Vector3.new(t, h, hz * 2) }, -- este
		{ CFrame.new(-(hx + gateHalf) / 2, h / 2, hz - t / 2), Vector3.new(hx - gateHalf, h, t) }, -- sur izq.
		{ CFrame.new((hx + gateHalf) / 2, h / 2, hz - t / 2), Vector3.new(hx - gateHalf, h, t) }, -- sur dcha.
	}
	for _, seg in ipairs(segments) do
		part(folder, origin, seg[1], seg[2], color, mat, props)
		-- Remate superior: franja del club, neón o dorado según la etapa
		if wall.stripe or wall.neon or wall.gold then
			local capColor = wall.gold and GOLD or (wall.neon and info.secondary or info.primary)
			local capMat = (wall.neon or wall.gold) and Enum.Material.Neon or Enum.Material.SmoothPlastic
			part(folder, origin, seg[1] * CFrame.new(0, h / 2 + 0.3, 0), Vector3.new(seg[2].X, 0.6, seg[2].Z), capColor, capMat, { CanCollide = false })
		end
	end
end

local function buildGate(folder, origin, visual, info)
	local h = (visual.wall and visual.wall.height or 4) + 6
	local z = Layout.HALF_Z - 0.75
	local pillarColor = (visual.wall and visual.wall.gold) and GOLD or info.primary
	for _, x in ipairs({ -11, 11 }) do
		part(folder, origin, CFrame.new(x, h / 2, z), Vector3.new(2.5, h, 2.5), pillarColor, Enum.Material.SmoothPlastic)
	end
	local beam = part(folder, origin, CFrame.new(0, h + 1.5, z), Vector3.new(25, 3, 2.5), info.secondary, Enum.Material.SmoothPlastic, { Name = "Gate" })
	if visual.gateText then
		local function content(gui)
			local t = Instance.new("TextLabel")
			t.Size = UDim2.fromScale(1, 1)
			t.BackgroundColor3 = info.primary
			t.TextColor3 = info.secondaryText
			t.Font = Enum.Font.GothamBlack
			t.TextScaled = true
			local naming = info.sponsors and info.sponsors.naming
			t.Text = info.crestSymbol .. " " .. string.upper(info.clubName) .. " · "
				.. (naming and ("ESTADIO " .. string.upper(naming)) or info.stageName)
			t.Parent = gui
		end
		surfaceText(beam, Enum.NormalId.Front, content)
		surfaceText(beam, Enum.NormalId.Back, content)
	end
end

-- Esquinas cerradas: 3 bloques escalonados por esquina, anclados en la esquina exterior.
local function buildCorners(folder, origin, standsLevel, design, info)
	if standsLevel < 3 then
		return -- hacen falta las 4 gradas
	end
	local rows = ROWS_BY_LEVEL[math.clamp(standsLevel, 1, #ROWS_BY_LEVEL)]
	local a, b = 4, 4 + rows * ROW_DEPTH
	local topY = rows * ROW_STEP
	local mat = material(design.material, Enum.Material.Concrete)
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			local zEdge = PITCH_CENTER_Z + sz * PITCH_WIDTH / 2
			for k = 1, 3 do
				local size = (b - a) * k / 3
				local height = topY * (4 - k) / 3
				local cx = sx * (PITCH_LENGTH / 2 + b - size / 2)
				local cz = zEdge + sz * (b - size / 2)
				part(folder, origin, CFrame.new(cx, height / 2, cz), Vector3.new(size, height, size),
					(k % 2 == 0) and info.secondary or info.primary, mat, { Name = "CornerStand" })
			end
		end
	end
end

local function buildScreens(folder, origin, info)
	for _, sx in ipairs({ -1, 1 }) do
		local pos = Vector3.new(sx * 75, 30, -78)
		part(folder, origin, CFrame.new(pos.X, 12, pos.Z), Vector3.new(1.5, 24, 1.5), Color3.fromRGB(60, 60, 70), Enum.Material.Metal)
		local worldPos = (origin * CFrame.new(pos)).Position
		local target = (origin * CFrame.new(0, pos.Y, PITCH_CENTER_Z)).Position
		local screen = Instance.new("Part")
		screen.Name = "BigScreen"
		screen.Anchored = true
		screen.Size = Vector3.new(20, 11, 1)
		screen.CFrame = CFrame.lookAt(worldPos, target)
		screen.Color = Color3.fromRGB(10, 10, 15)
		screen.Parent = folder
		surfaceText(screen, Enum.NormalId.Front, function(gui)
			local t = Instance.new("TextLabel")
			t.Size = UDim2.fromScale(1, 1)
			t.BackgroundColor3 = info.primary
			t.TextColor3 = info.secondaryText
			t.Font = Enum.Font.GothamBlack
			t.TextScaled = true
			t.Text = info.crestSymbol .. "\n" .. info.clubName
			t.Parent = gui
		end)
	end
end

local function buildLightRing(folder, origin, standsLevel, info)
	local rows = ROWS_BY_LEVEL[math.clamp(standsLevel, 1, #ROWS_BY_LEVEL)]
	local b = 4 + rows * ROW_DEPTH
	local y = rows * ROW_STEP + 12
	local color = info.vip and GOLD or Color3.fromRGB(170, 220, 255)
	local outerX = PITCH_LENGTH / 2 + b
	local north, south = PITCH_CENTER_Z - PITCH_WIDTH / 2 - b, PITCH_CENTER_Z + PITCH_WIDTH / 2 + b
	local props = { CanCollide = false, CanQuery = false, Name = "LightRing" }
	part(folder, origin, CFrame.new(0, y, north), Vector3.new(outerX * 2, 0.6, 0.6), color, Enum.Material.Neon, props)
	part(folder, origin, CFrame.new(0, y, south), Vector3.new(outerX * 2, 0.6, 0.6), color, Enum.Material.Neon, props)
	part(folder, origin, CFrame.new(-outerX, y, (north + south) / 2), Vector3.new(0.6, 0.6, south - north), color, Enum.Material.Neon, props)
	part(folder, origin, CFrame.new(outerX, y, (north + south) / 2), Vector3.new(0.6, 0.6, south - north), color, Enum.Material.Neon, props)
end

local function buildMonument(folder, origin, info)
	local p = Layout.MONUMENT
	part(folder, origin, CFrame.new(p.X, 2, p.Z), Vector3.new(6, 4, 6), Color3.fromRGB(235, 232, 225), Enum.Material.Marble)
	local ball = part(folder, origin, CFrame.new(p.X, 7, p.Z), Vector3.new(6, 6, 6), GOLD, Enum.Material.Metal, { Reflectance = 0.35 })
	ball.Shape = Enum.PartType.Ball
	local sparkle = Instance.new("Sparkles")
	sparkle.SparkleColor = GOLD
	sparkle.Parent = ball
	label(ball, info.crestSymbol .. " Monumento " .. info.clubName, 5, GOLD).MaxDistance = 100
end

local function buildStageExtras(folder, origin, info, standsLevel, standsDesign)
	local visual = info.stageVisual or {}
	if visual.plaza then
		part(folder, origin, CFrame.new(0, 0.05, 87.5), Vector3.new(190, 0.1, 35), stageColor(visual.plaza),
			material(visual.plaza, Enum.Material.Concrete), { Name = "Plaza" })
	end
	if visual.wall then
		buildWalls(folder, origin, visual, info)
	end
	if visual.gate then
		buildGate(folder, origin, visual, info)
	end
	if visual.corners then
		buildCorners(folder, origin, standsLevel, standsDesign, info)
	end
	if visual.screens then
		buildScreens(folder, origin, info)
	end
	if visual.lightRing then
		buildLightRing(folder, origin, standsLevel, info)
	end
	if visual.monument then
		buildMonument(folder, origin, info)
	end
end

-- ===== API =====

-- info: ver PlotService.BuildRenderInfo
function StadiumRenderer.Render(folder, origin, info)
	folder:ClearAllChildren()
	local facilities = info.facilities
	local standsDesign = CosmeticConfig.ById.design[info.appearance.standsDesign] or CosmeticConfig.ById.design.classic
	local buildingDesign = CosmeticConfig.ById.design[info.appearance.buildingDesign] or CosmeticConfig.ById.design.brick
	local standsLevel = facilities.stands or 1

	buildStageExtras(folder, origin, info, standsLevel, standsDesign)
	buildPitch(folder, origin, facilities.pitch or 1)
	buildStands(folder, origin, standsLevel, standsDesign, info.primary, info.secondary)
	buildLighting(folder, origin, facilities.lighting or 0, info.vip)
	buildScoreboard(folder, origin, facilities.scoreboard or 0, info)
	buildLaneFacilities(folder, origin, facilities, buildingDesign, info)
	buildKiosks(folder, origin, facilities.kiosks or 0, info)
	buildTourBooth(folder, origin, facilities.tour or 0, info)
	buildAdBoards(folder, origin, info)
	buildSign(folder, origin, info)
	buildEffect(folder, origin, info.appearance.effect, info.primary, info.secondary)
	buildDecorations(folder, origin, info.decorations, info.decorationVisible, info)
end

return StadiumRenderer
