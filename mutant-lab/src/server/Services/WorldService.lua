--!nonstrict
-- WorldService: construye el mapa (cinta central de cápsulas y 8 laboratorios) y gestiona los avisos
-- (ProximityPrompt). Cada laboratorio tiene 18 pedestales, colector de créditos, terminal, cámara de fusión,
-- botón del láser, puerta láser, zona de llegada y trampas de baba.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage.Shared.Config)
local LabData = require(ReplicatedStorage.Shared.LabData)

local World = {}
local S
World.labs = {}
local promptHandlers = {}

local function c3(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

local function P(parent, name, size, cf, color, material, props)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = c3(color)
	p.Material = material or Enum.Material.SmoothPlastic
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
World.P = P

local function cylinder(parent, name, diameter, height, cf, color, material, props)
	local p = P(parent, name, Vector3.new(height, diameter, diameter), cf * CFrame.Angles(0, 0, math.pi / 2), color, material, props)
	p.Shape = Enum.PartType.Cylinder
	return p
end

local function label(part, text, color, size)
	local bb = Instance.new("BillboardGui")
	bb.Name = "Label"
	bb.Size = size or UDim2.new(0, 260, 0, 46)
	bb.StudsOffset = Vector3.new(0, 3, 0)
	bb.MaxDistance = 160
	bb.Parent = part
	local t = Instance.new("TextLabel")
	t.Name = "Text"
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextColor3 = color or Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0.2
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Parent = bb
	return t
end
World.label = label

function World.prompt(part, kind, actionText, objectText, attrs, hold)
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = actionText
	pp.ObjectText = objectText or ""
	pp.HoldDuration = hold or 0
	pp.MaxActivationDistance = 12
	pp.RequiresLineOfSight = false
	pp:SetAttribute("Kind", kind)
	for k, v in pairs(attrs or {}) do
		pp:SetAttribute(k, v)
	end
	pp.Parent = part
	pp.Triggered:Connect(function(player)
		local fn = promptHandlers[kind]
		if fn then
			local ok, err = pcall(fn, player, pp)
			if not ok then
				warn("[LabMutante] aviso " .. kind .. ": " .. tostring(err))
			end
		end
	end)
	return pp
end

function World.onPrompt(kind, fn)
	promptHandlers[kind] = fn
end

-- Posición del laboratorio i: 4 al norte (miran al sur, hacia la cinta) y 4 al sur
function World.labOrigin(i)
	local col = (i - 1) % 4
	local north = i <= 4
	local x = -165 + col * 110
	local z = north and -100 or 100
	return x, z, north and 1 or -1
end

-- Coordenadas locales del laboratorio (x a lo ancho, z hacia la puerta) -> mundo
function World.labPos(i, lx, ly, lz)
	local x, z, s = World.labOrigin(i)
	return Vector3.new(x + s * lx, ly, z + s * lz)
end
function World.labCF(i, lx, ly, lz)
	local x, z, s = World.labOrigin(i)
	return CFrame.new(x + s * lx, ly, z + s * lz) * CFrame.Angles(0, s == 1 and 0 or math.pi, 0)
end
-- Índice del laboratorio que contiene una posición (o nil)
function World.labIndexAt(pos)
	for i = 1, Config.MaxLabs or 8 do
		local x, z, s = World.labOrigin(i)
		local lx, lz = (pos.X - x) * s, (pos.Z - z) * s
		if math.abs(lx) <= 32 and math.abs(lz) <= 31 then
			return i, lx, lz
		end
	end
	return nil
end

World.SlotLocal = {}
for r = 1, 3 do
	for c = 1, 6 do
		World.SlotLocal[#World.SlotLocal + 1] = { -25 + (c - 1) * 10, -21 + (r - 1) * 9 }
	end
end
World.TrapLocal = { { -6, 23 }, { 6, 23 }, { -14, 17 }, { 14, 17 }, { 0, 27 } }
World.CollectorLocal = { 0, 9 }
World.TerminalLocal = { -23, 10 }
World.FusionLocal = { 23, 10 }
World.LaserButtonLocal = { -14, 26 }
World.EntryLocal = { 0, 21 }

local function buildLab(root, i)
	local color = LabData.PlotColors[i]
	local m = Instance.new("Model")
	m.Name = "Lab" .. i
	m.Parent = root
	local lab = { Index = i, Model = m, Pedestals = {}, Slots = {}, LaserParts = {}, Traps = {} }
	local function cf(lx, ly, lz)
		return World.labCF(i, lx, ly, lz)
	end
	-- suelo, paredes (abajo metal, arriba cristal) y franja de neón
	P(m, "Floor", Vector3.new(64, 1, 62), cf(0, 0.5, 0), { 38, 40, 48 }, Enum.Material.DiamondPlate)
	P(m, "FloorTrim", Vector3.new(66, 0.3, 64), cf(0, 0.15, 0), color, Enum.Material.Neon)
	local walls = { { 0, -30.5, 64, 1 }, { -32.5, 0, 1, 62 }, { 32.5, 0, 1, 62 }, { -20.5, 30.5, 24, 1 }, { 20.5, 30.5, 24, 1 } }
	for _, w in ipairs(walls) do
		P(m, "Wall", Vector3.new(w[3], 5, w[4]), cf(w[1], 3.5, w[2]), { 70, 75, 88 }, Enum.Material.Metal)
		P(m, "Glass", Vector3.new(w[3], 9, w[4]), cf(w[1], 10.5, w[2]), { 150, 220, 255 }, Enum.Material.Glass, { Transparency = 0.55 })
		P(m, "Cap", Vector3.new(w[3] + 0.4, 0.5, w[4] + 0.4), cf(w[1], 15.2, w[2]), color, Enum.Material.Neon)
	end
	-- dintel de la puerta y cartel con el dueño
	P(m, "Lintel", Vector3.new(18, 3, 1.2), cf(0, 13.5, 30.5), { 50, 55, 66 }, Enum.Material.Metal)
	local signPart = P(m, "Sign", Vector3.new(16, 2.4, 0.4), cf(0, 13.5, 31.3), color, Enum.Material.Neon)
	lab.SignText = label(signPart, "Laboratorio libre", Color3.new(1, 1, 1), UDim2.new(0, 320, 0, 54))
	-- puerta láser: rayos + muro invisible que bloquea cuando está activa
	for k = 1, 6 do
		local beam = P(m, "LaserBeam", Vector3.new(18, 0.25, 0.25), cf(0, 1.6 + k * 1.7, 30.5), { 255, 40, 60 }, Enum.Material.Neon, { CanCollide = false, Transparency = 1 })
		lab.LaserParts[#lab.LaserParts + 1] = beam
	end
	lab.LaserWall = P(m, "LaserWall", Vector3.new(18, 12, 1), cf(0, 7, 30.5), { 255, 40, 60 }, Enum.Material.ForceField, { CanCollide = false, Transparency = 1 })
	-- pedestales (18). Los que no están desbloqueados se ven apagados
	for s, pos in ipairs(World.SlotLocal) do
		local ped = cylinder(m, "Pedestal" .. s, 6, 1.2, cf(pos[1], 1.6, pos[2]), { 60, 64, 76 }, Enum.Material.Metal)
		local ring = cylinder(m, "Ring" .. s, 6.6, 0.3, cf(pos[1], 1.1, pos[2]), { 40, 40, 46 }, Enum.Material.Neon)
		local pp = World.prompt(ped, "steal", "Robar", "Mutante", { Lab = i, Slot = s }, Config.GrabHoldSeconds)
		pp.Enabled = false
		lab.Pedestals[s] = { Part = ped, Ring = ring, Prompt = pp, Top = World.labPos(i, pos[1], 2.2, pos[2]) }
	end
	-- colector con tanque de vidrio que se llena
	local col = World.CollectorLocal
	P(m, "CollectorPad", Vector3.new(8, 0.4, 8), cf(col[1], 1.2, col[2]), { 255, 220, 60 }, Enum.Material.Neon)
	cylinder(m, "TankGlass", 4, 6, cf(col[1], 4.4, col[2]), { 180, 255, 200 }, Enum.Material.Glass, { Transparency = 0.6, CanCollide = false })
	lab.TankFill = cylinder(m, "TankFill", 3.4, 0.2, cf(col[1], 1.6, col[2]), { 120, 255, 120 }, Enum.Material.Neon, { CanCollide = false })
	lab.Collector = P(m, "Collector", Vector3.new(4, 1, 4), cf(col[1], 1.9, col[2]), { 60, 60, 70 }, Enum.Material.Metal)
	World.prompt(lab.Collector, "collect", "Recoger créditos", "Colector", { Lab = i })
	lab.CollectorText = label(lab.Collector, "Tanque: 0", Color3.fromRGB(150, 255, 150))
	lab.CollectorText.Parent.StudsOffset = Vector3.new(0, 7, 0)
	-- terminal de mejoras
	local t = World.TerminalLocal
	local term = P(m, "Terminal", Vector3.new(4, 5, 2), cf(t[1], 3.5, t[2]), { 40, 44, 56 }, Enum.Material.Metal)
	P(m, "Screen", Vector3.new(3.4, 2.4, 0.2), cf(t[1], 4.5, t[2] + 1.05), { 60, 200, 255 }, Enum.Material.Neon)
	World.prompt(term, "terminal", "Abrir terminal", "Mejoras e investigación", { Lab = i })
	label(term, "🖥 Terminal", Color3.fromRGB(150, 220, 255), UDim2.new(0, 160, 0, 34)).Parent.StudsOffset = Vector3.new(0, 4.5, 0)
	-- cámara de fusión
	local f = World.FusionLocal
	cylinder(m, "FusionBase", 8, 1, cf(f[1], 1.5, f[2]), { 60, 50, 80 }, Enum.Material.Metal)
	lab.FusionGlass = cylinder(m, "FusionGlass", 6, 7, cf(f[1], 5.5, f[2]), { 200, 120, 255 }, Enum.Material.Glass, { Transparency = 0.6, CanCollide = false })
	lab.FusionCore = P(m, "FusionCore", Vector3.new(1.4, 1.4, 1.4), cf(f[1], 5, f[2]), { 210, 120, 255 }, Enum.Material.Neon, { Shape = Enum.PartType.Ball, CanCollide = false, Transparency = 0.5 })
	World.prompt(lab.FusionGlass, "fusion", "Cámara de fusión", "Fusiona dos mutantes iguales", { Lab = i })
	label(lab.FusionGlass, "🧬 Fusión", Color3.fromRGB(220, 160, 255), UDim2.new(0, 160, 0, 34)).Parent.StudsOffset = Vector3.new(0, 5, 0)
	-- botón del láser
	local lb = World.LaserButtonLocal
	P(m, "LaserPost", Vector3.new(1.2, 4, 1.2), cf(lb[1], 3, lb[2]), { 50, 50, 60 }, Enum.Material.Metal)
	lab.LaserButton = P(m, "LaserButton", Vector3.new(1.8, 1, 1.8), cf(lb[1], 5.4, lb[2]), { 255, 50, 70 }, Enum.Material.Neon)
	World.prompt(lab.LaserButton, "laser", "Activar láser", "Puerta láser", { Lab = i })
	-- zona de llegada (donde se entregan los mutantes robados)
	local e = World.EntryLocal
	lab.EntryPos = World.labPos(i, e[1], 1, e[2])
	cylinder(m, "EntryZone", Config.DeliverRadius * 2, 0.1, cf(e[1], 1.05, e[2]), color, Enum.Material.Neon, { Transparency = 0.75, CanCollide = false })
	-- trampas (se muestran según las que tenga el dueño)
	for k, tp in ipairs(World.TrapLocal) do
		local trap = cylinder(m, "Trap" .. k, 4, 0.2, cf(tp[1], 1.1, tp[2]), { 120, 255, 60 }, Enum.Material.Neon, { CanCollide = false, Transparency = 1 })
		lab.Traps[k] = { Part = trap, Pos = World.labPos(i, tp[1], 1, tp[2]), ReadyAt = 0 }
	end
	lab.SpawnCF = cf(0, 4, 16)
	World.labs[i] = lab
	return lab
end

local function buildBelt(root)
	local m = Instance.new("Model")
	m.Name = "Belt"
	m.Parent = root
	local len = Config.BeltEndX - Config.BeltStartX + 20
	local cx = (Config.BeltStartX + Config.BeltEndX) / 2
	P(m, "BeltBase", Vector3.new(len, 1.6, 10), CFrame.new(cx, 1.2, Config.BeltZ), { 30, 30, 36 }, Enum.Material.Metal)
	P(m, "BeltTop", Vector3.new(len, 0.2, 8), CFrame.new(cx, 2.1, Config.BeltZ), { 55, 55, 60 }, Enum.Material.DiamondPlate)
	for _, s in ipairs({ -1, 1 }) do
		P(m, "Rail", Vector3.new(len, 0.6, 0.6), CFrame.new(cx, 2.5, Config.BeltZ + s * 4.6), { 0, 220, 255 }, Enum.Material.Neon)
	end
	for x = Config.BeltStartX, Config.BeltEndX, 12 do
		P(m, "Stripe", Vector3.new(0.6, 0.05, 7.6), CFrame.new(x, 2.22, Config.BeltZ), { 255, 210, 40 }, Enum.Material.Neon, { CanCollide = false })
	end
	-- generador y reciclador
	local gen = P(m, "Generator", Vector3.new(16, 18, 18), CFrame.new(Config.BeltStartX - 14, 9, Config.BeltZ), { 50, 40, 70 }, Enum.Material.Metal)
	P(m, "GenGlow", Vector3.new(16.4, 2, 18.4), CFrame.new(Config.BeltStartX - 14, 14, Config.BeltZ), { 200, 80, 255 }, Enum.Material.Neon)
	label(gen, "⚗ GENERADOR DE CÁPSULAS", Color3.fromRGB(230, 180, 255), UDim2.new(0, 360, 0, 50)).Parent.StudsOffset = Vector3.new(0, 11, 0)
	local rec = P(m, "Recycler", Vector3.new(14, 12, 16), CFrame.new(Config.BeltEndX + 13, 6, Config.BeltZ), { 60, 60, 60 }, Enum.Material.CorrodedMetal)
	label(rec, "♻ RECICLADOR", Color3.fromRGB(200, 200, 200), UDim2.new(0, 260, 0, 44)).Parent.StudsOffset = Vector3.new(0, 8, 0)
	-- carteles de la plaza
	local title = P(m, "Title", Vector3.new(2, 2, 2), CFrame.new(0, 26, Config.BeltZ), { 0, 0, 0 }, Enum.Material.SmoothPlastic, { Transparency = 1, CanCollide = false })
	label(title, "🧪 LABORATORIO MUTANTE", Color3.fromRGB(120, 255, 120), UDim2.new(0, 520, 0, 70)).Parent.MaxDistance = 600
end

local function buildScenery(root)
	local m = Instance.new("Model")
	m.Name = "Scenery"
	m.Parent = root
	P(m, "Ground", Vector3.new(620, 2, 360), CFrame.new(0, -1, 0), { 28, 30, 38 }, Enum.Material.Concrete)
	P(m, "Walkway", Vector3.new(520, 0.2, 34), CFrame.new(0, 0.1, 0), { 50, 52, 62 }, Enum.Material.Slate)
	-- caminos de neón de la cinta a cada puerta y farolas
	for i = 1, 8 do
		local x, z, s = World.labOrigin(i)
		local color = LabData.PlotColors[i]
		P(m, "Path", Vector3.new(14, 0.2, 52), CFrame.new(x, 0.15, z + s * 57), { 60, 62, 72 }, Enum.Material.Slate)
		for _, side in ipairs({ -1, 1 }) do
			P(m, "PathLine", Vector3.new(0.4, 0.05, 52), CFrame.new(x + side * 7, 0.28, z + s * 57), color, Enum.Material.Neon, { CanCollide = false })
			local post = P(m, "Lamp", Vector3.new(0.8, 10, 0.8), CFrame.new(x + side * 9, 5, z + s * 45), { 40, 40, 48 }, Enum.Material.Metal)
			local bulb = P(m, "Bulb", Vector3.new(1.6, 1.6, 1.6), CFrame.new(x + side * 9, 10.4, z + s * 45), color, Enum.Material.Neon, { Shape = Enum.PartType.Ball })
			local l = Instance.new("PointLight")
			l.Range = 22
			l.Brightness = 1.6
			l.Color = c3(color)
			l.Parent = bulb
			post.CanCollide = true
		end
	end
	-- bordes del mapa
	for _, b in ipairs({ { 0, -181, 620, 2 }, { 0, 181, 620, 2 }, { -311, 0, 2, 360 }, { 311, 0, 2, 360 } }) do
		P(m, "Border", Vector3.new(b[3], 30, b[4]), CFrame.new(b[1], 15, b[2]), { 20, 20, 26 }, Enum.Material.ForceField, { Transparency = 0.8 })
	end
end

local function setupLighting()
	pcall(function()
		Lighting.ClockTime = 20.5
		Lighting.Brightness = 2
		Lighting.Ambient = Color3.fromRGB(70, 60, 100)
		Lighting.OutdoorAmbient = Color3.fromRGB(110, 100, 150)
		Lighting.FogEnd = 1400
		Lighting.FogColor = Color3.fromRGB(30, 20, 50)
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Name = "EventTint"
		cc.Saturation = 0.15
		cc.Contrast = 0.08
		cc.Parent = Lighting
		World.Tint = cc
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 0.6
		bloom.Size = 30
		bloom.Threshold = 1.4
		bloom.Parent = Lighting
	end)
end

function World.Init(services)
	S = services
	local root = Instance.new("Folder")
	root.Name = "Map"
	root.Parent = workspace
	World.root = root
	World.dynamic = Instance.new("Folder")
	World.dynamic.Name = "Dynamic"
	World.dynamic.Parent = workspace
	buildScenery(root)
	buildBelt(root)
	for i = 1, 8 do
		buildLab(root, i)
	end
	setupLighting()
end

-- Dueño del laboratorio (cartel y color)
function World.setOwner(i, player)
	local lab = World.labs[i]
	lab.Owner = player
	lab.SignText.Text = player and ("Laboratorio de " .. player.DisplayName) or "Laboratorio libre"
end

function World.setLaser(i, on)
	local lab = World.labs[i]
	lab.LaserOn = on
	for _, b in ipairs(lab.LaserParts) do
		b.Transparency = on and 0.05 or 1
	end
	lab.LaserWall.CanCollide = on
	lab.LaserWall.Transparency = on and 0.6 or 1
	lab.LaserButton.Color = on and Color3.fromRGB(60, 255, 120) or Color3.fromRGB(255, 50, 70)
end

-- Muestra pedestales desbloqueados y trampas compradas
function World.setTier(i, slots, traps)
	local lab = World.labs[i]
	for s, ped in ipairs(lab.Pedestals) do
		local unlocked = s <= slots
		ped.Part.Transparency = unlocked and 0 or 0.7
		ped.Ring.Color = unlocked and Color3.fromRGB(70, 80, 100) or Color3.fromRGB(30, 30, 34)
	end
	for k, tr in ipairs(lab.Traps) do
		tr.Part.Transparency = k <= (traps or 0) and 0.3 or 1
	end
end

function World.setTank(i, amount, cap)
	local lab = World.labs[i]
	local frac = cap > 0 and math.min(1, amount / cap) or 0
	local h = 0.2 + 5.6 * frac
	local col = World.CollectorLocal
	lab.TankFill.Size = Vector3.new(h, 3.4, 3.4)
	lab.TankFill.CFrame = World.labCF(i, col[1], 1.5 + h / 2, col[2]) * CFrame.Angles(0, 0, math.pi / 2)
	lab.CollectorText.Text = "Tanque: " .. require(ReplicatedStorage.Shared.Util).short(amount) .. (frac >= 1 and " (¡LLENO!)" or "")
end

function World.Start() end

return World
