--!nonstrict
-- WorldBuilder: construye la ciudad con Parts a partir de WorldData al arrancar el servidor.
--  * 30 distritos con suelo, aceras, calles, línea central, semáforos, farolas, señales y edificios con estilo propio.
--  * Edificios importantes con interior funcional: Residencia Económica (12 habitaciones), 4 tiendas,
--    cibercafé, banco y sala VIP.
--  * Lugares de grabación 🎥, paradas de taxi, bancos de parque, coches aparcados, árboles, agua, montañas.
-- Todo es anclado y reutiliza las mismas funciones, así que añadir distritos solo requiere editar WorldData.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local Shared = ReplicatedStorage.Shared
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)
local PropertyData = require(Shared.PropertyData)
local LifeData = require(Shared.LifeData)
local StudioData = require(Shared.StudioData)

local World = {}
local S
local city

World.Specials = WorldData.Specials
World.SpotById = WorldData.SpotById
World.HomeRooms = {}
World.NpcPoints = {}
World.TrafficLights = {}
World.VendingMachines = {}

local CELL = WorldData.CellSize
local ROAD = WorldData.RoadWidth
local GROUND_TOP = 0.5

function World.Init(services)
	S = services
end

-- ¿Está el jugador cerca de un edificio especial de cierto tipo? (tienda, concesionario, gasolinera...)
function World.nearSpecial(player, specialType, radius)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	radius = radius or 45
	for _, sp in ipairs(World.Specials) do
		if sp.Type == specialType then
			local dx, dz = root.Position.X - sp.WX, root.Position.Z - sp.WZ
			if dx * dx + dz * dz <= radius * radius then
				return sp
			end
		end
	end
	return nil
end

---------------------------------------------------------------------------
-- Utilidades de construcción
---------------------------------------------------------------------------
local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

local function P(parent, name, size, cf, color, material, opts)
	local p = Instance.new(opts and opts.Class or "Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = typeof(cf) == "Vector3" and CFrame.new(cf) or cf
	p.Color = typeof(color) == "Color3" and color or rgb(color)
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if opts then
		if opts.Shape then
			p.Shape = opts.Shape
		end
		if opts.Transparency then
			p.Transparency = opts.Transparency
		end
		if opts.NoCollide then
			p.CanCollide = false
		end
		if opts.NoShadow then
			p.CastShadow = false
		end
	end
	p.Parent = parent
	return p
end

local function folder(parent, name)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

local function model(parent, name)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local function sign(part, face, text, bg, fg, font)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face or Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = bg or Color3.fromRGB(20, 20, 24)
	label.BackgroundTransparency = bg and 0 or 1
	label.TextColor3 = fg or Color3.new(1, 1, 1)
	label.Font = font or Enum.Font.GothamBlack
	label.TextScaled = true
	label.Text = text
	label.Parent = gui
	return label
end

-- Cartel legible por las dos caras (la cara Front de Roblox mira a -Z; las fachadas están en +Z)
local function signBoth(part, text, bg, fg, font)
	sign(part, Enum.NormalId.Front, text, bg, fg, font)
	return sign(part, Enum.NormalId.Back, text, bg, fg, font)
end

local function prompt(part, action, actionText, objectText, attrs)
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = actionText
	pp.ObjectText = objectText or ""
	pp.HoldDuration = 0
	pp.MaxActivationDistance = 10
	pp.RequiresLineOfSight = false
	pp:SetAttribute("Action", action)
	for k, v in pairs(attrs or {}) do
		pp:SetAttribute(k, v)
	end
	pp.Parent = part
	CollectionService:AddTag(pp, "YTPrompt")
	return pp
end

local function nightLight(part, range, color)
	local l = Instance.new("PointLight")
	l.Range = range or 24
	l.Brightness = 1.4
	l.Color = color or Color3.fromRGB(255, 220, 160)
	l.Enabled = false
	l.Parent = part
	CollectionService:AddTag(part, "NightLight")
	return l
end

local function tree(parent, x, z, scale, rng)
	scale = scale or 1
	local h = (10 + rng:NextNumber() * 6) * scale
	P(parent, "Trunk", Vector3.new(h, 1.6 * scale, 1.6 * scale), CFrame.new(x, GROUND_TOP + h / 2, z) * CFrame.Angles(0, 0, math.rad(90)),
		{ 110, 80, 55 }, Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	local leaf = { 60 + rng:NextInteger(0, 30), 130 + rng:NextInteger(0, 40), 60 }
	P(parent, "Leaves", Vector3.new(9, 9, 9) * scale, Vector3.new(x, GROUND_TOP + h + 2 * scale, z), leaf, Enum.Material.Grass,
		{ Shape = Enum.PartType.Ball, NoShadow = false })
end

local function bench(parent, x, z, rotY)
	local cf = CFrame.new(x, GROUND_TOP, z) * CFrame.Angles(0, rotY or 0, 0)
	P(parent, "BenchSeat", Vector3.new(6, 0.5, 2), cf * CFrame.new(0, 1.6, 0), { 140, 100, 60 }, Enum.Material.WoodPlanks)
	P(parent, "BenchBack", Vector3.new(6, 1.6, 0.4), cf * CFrame.new(0, 2.6, -0.9), { 140, 100, 60 }, Enum.Material.WoodPlanks)
	P(parent, "BenchLeg", Vector3.new(0.4, 1.4, 1.8), cf * CFrame.new(-2.6, 0.7, 0), { 50, 50, 55 }, Enum.Material.Metal)
	P(parent, "BenchLeg", Vector3.new(0.4, 1.4, 1.8), cf * CFrame.new(2.6, 0.7, 0), { 50, 50, 55 }, Enum.Material.Metal)
end

local function car(parent, x, z, color, rotY)
	local m = model(parent, "ParkedCar")
	local cf = CFrame.new(x, GROUND_TOP, z) * CFrame.Angles(0, rotY or 0, 0)
	P(m, "Body", Vector3.new(6, 2, 12), cf * CFrame.new(0, 1.8, 0), color, Enum.Material.SmoothPlastic)
	P(m, "Cabin", Vector3.new(5.6, 1.8, 6), cf * CFrame.new(0, 3.6, -0.5), { 40, 50, 60 }, Enum.Material.Glass, { Transparency = 0.2 })
	for _, w in ipairs({ { -3, 3.8 }, { 3, 3.8 }, { -3, -3.8 }, { 3, -3.8 } }) do
		P(m, "Wheel", Vector3.new(1.2, 2.2, 2.2), cf * CFrame.new(w[1], 1.1, w[2]), { 20, 20, 20 }, Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	end
	return m
end

local function streetLamp(parent, x, z)
	P(parent, "LampPole", Vector3.new(0.6, 14, 0.6), Vector3.new(x, GROUND_TOP + 7, z), { 60, 60, 66 }, Enum.Material.Metal)
	local head = P(parent, "LampHead", Vector3.new(1.6, 0.8, 1.6), Vector3.new(x, GROUND_TOP + 14.2, z), { 255, 240, 200 }, Enum.Material.Neon, { NoShadow = true })
	nightLight(head, 30)
end

---------------------------------------------------------------------------
-- Edificios genéricos por estilo
---------------------------------------------------------------------------
local shopNames = { "Panadería", "Café Central", "Moda Urbana", "Zapatería", "Librería", "Papelería", "Deportes", "Bicicletas",
	"Electrodomésticos", "Mascotas", "Jardinería", "Viajes", "Coleccionables", "Herramientas", "Juegos", "Instrumentos", "Supermercado", "Floristería" }
local foodNames = { "Pizzería Napoli", "Sushi Zen", "Tacos El Sol", "Hamburguesas 24", "Paella & Co.", "Ramen Nube", "Asador Brasa", "Heladería Polar", "Crepes París", "Arepas Doña Ana" }

local function windowBands(parent, cf, w, h, d, rng)
	local floors = math.min(10, math.floor(h / 10))
	for i = 1, floors do
		local y = -h / 2 + i * (h / (floors + 1))
		local band = P(parent, "Windows", Vector3.new(w + 0.3, 2.6, d + 0.3), cf * CFrame.new(0, y, 0), { 40, 60, 90 }, Enum.Material.Glass,
			{ Transparency = 0.1, NoShadow = true })
		band:SetAttribute("GlowNight", rng:NextNumber() < 0.7)
		band.Color = Color3.fromRGB(255, 225, 150)
		band.Material = Enum.Material.Glass
		CollectionService:AddTag(band, "NightLight")
	end
end

local styleBuilders = {}

styleBuilders.tower = function(parent, x, z, d, rng)
	local w, dd = rng:NextInteger(30, 42), rng:NextInteger(30, 42)
	local h = rng:NextInteger(60, 140)
	local cf = CFrame.new(x, GROUND_TOP + h / 2, z)
	local color = d.Palette[rng:NextInteger(1, #d.Palette)]
	P(parent, "Tower", Vector3.new(w, h, dd), cf, color, Enum.Material.Concrete)
	windowBands(parent, cf, w, h, dd, rng)
	if d.Neon then
		P(parent, "Crown", Vector3.new(w + 1, 1, dd + 1), cf * CFrame.new(0, h / 2 + 0.5, 0), d.Neon, Enum.Material.Neon, { NoShadow = true })
	end
end
styleBuilders.office = function(parent, x, z, d, rng)
	local w, dd, h = rng:NextInteger(34, 46), rng:NextInteger(28, 38), rng:NextInteger(28, 60)
	local cf = CFrame.new(x, GROUND_TOP + h / 2, z)
	P(parent, "Office", Vector3.new(w, h, dd), cf, d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.Concrete)
	windowBands(parent, cf, w, h, dd, rng)
	P(parent, "Entrance", Vector3.new(8, 8, 1), cf * CFrame.new(0, -h / 2 + 4, dd / 2 + 0.5), { 30, 40, 50 }, Enum.Material.Glass, { Transparency = 0.3 })
end
styleBuilders.apartment = function(parent, x, z, d, rng)
	local w, dd, h = rng:NextInteger(36, 44), rng:NextInteger(26, 32), rng:NextInteger(30, 54)
	local cf = CFrame.new(x, GROUND_TOP + h / 2, z)
	P(parent, "Apartments", Vector3.new(w, h, dd), cf, d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.Brick)
	windowBands(parent, cf, w, h, dd, rng)
	for i = 1, math.floor(h / 10) do
		P(parent, "Balcony", Vector3.new(w - 6, 0.6, 3), cf * CFrame.new(0, -h / 2 + i * 10, dd / 2 + 1.5), { 220, 220, 220 }, Enum.Material.Concrete)
	end
end
styleBuilders.house = function(parent, x, z, d, rng)
	local w, dd, h = rng:NextInteger(18, 24), rng:NextInteger(16, 22), 11
	local base = CFrame.new(x, GROUND_TOP, z)
	local color = d.Palette[rng:NextInteger(1, #d.Palette)]
	P(parent, "House", Vector3.new(w, h, dd), base * CFrame.new(0, h / 2, 0), color, Enum.Material.Plaster)
	local roofColor = { 150, 60, 50 }
	P(parent, "Roof", Vector3.new(w + 1, 5, dd / 2 + 0.5), base * CFrame.new(0, h + 2.5, dd / 4 + 0.25), roofColor, Enum.Material.Slate, { Class = "WedgePart" })
	P(parent, "Roof", Vector3.new(w + 1, 5, dd / 2 + 0.5), base * CFrame.new(0, h + 2.5, -dd / 4 - 0.25) * CFrame.Angles(0, math.pi, 0), roofColor, Enum.Material.Slate, { Class = "WedgePart" })
	P(parent, "Door", Vector3.new(4, 7, 0.4), base * CFrame.new(0, 3.5, dd / 2 + 0.2), { 90, 60, 40 }, Enum.Material.Wood)
	local win = P(parent, "Window", Vector3.new(4, 3, 0.4), base * CFrame.new(-w / 4 - 1, 6, dd / 2 + 0.2), { 255, 225, 150 }, Enum.Material.Glass)
	win:SetAttribute("GlowNight", true)
	CollectionService:AddTag(win, "NightLight")
	P(parent, "Fence", Vector3.new(w + 6, 2.5, 0.4), base * CFrame.new(0, 1.25, dd / 2 + 6), { 245, 245, 245 }, Enum.Material.WoodPlanks)
end
styleBuilders.mansion = function(parent, x, z, d, rng)
	local w, dd, h = 44, 30, 18
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Mansion", Vector3.new(w, h, dd), base * CFrame.new(0, h / 2, 0), d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.Marble)
	P(parent, "RoofTop", Vector3.new(w + 2, 1, dd + 2), base * CFrame.new(0, h + 0.5, 0), { 60, 60, 70 }, Enum.Material.Slate)
	for i = -2, 2 do
		P(parent, "Column", Vector3.new(h, 1.6, 1.6), base * CFrame.new(i * 8, h / 2, dd / 2 + 3) * CFrame.Angles(0, 0, math.rad(90)), { 250, 250, 245 }, Enum.Material.Marble, { Shape = Enum.PartType.Cylinder })
	end
	local pool = P(parent, "Pool", Vector3.new(20, 0.6, 10), base * CFrame.new(0, 0.4, dd / 2 + 14), { 60, 180, 230 }, Enum.Material.Glass, { Transparency = 0.25 })
	pool.CanCollide = false
	windowBands(parent, base * CFrame.new(0, h / 2, 0), w, h, dd, rng)
end
styleBuilders.shop = function(parent, x, z, d, rng)
	local w, dd, h = rng:NextInteger(26, 34), 22, rng:NextInteger(12, 18)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Shop", Vector3.new(w, h, dd), base * CFrame.new(0, h / 2, 0), d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.Brick)
	local glass = P(parent, "ShopWindow", Vector3.new(w - 4, 7, 0.4), base * CFrame.new(0, 4.5, dd / 2 + 0.2), { 255, 230, 170 }, Enum.Material.Glass, { Transparency = 0.2 })
	glass:SetAttribute("GlowNight", true)
	CollectionService:AddTag(glass, "NightLight")
	local awningColor = ({ { 220, 60, 60 }, { 40, 140, 90 }, { 40, 90, 180 }, { 230, 160, 30 } })[rng:NextInteger(1, 4)]
	P(parent, "Awning", Vector3.new(w, 1.5, 4), base * CFrame.new(0, 9, dd / 2 + 2), awningColor, Enum.Material.Fabric, { Class = "WedgePart" })
	local list = Util.indexOf(d.Tags, "food") and foodNames or shopNames
	local board = P(parent, "Sign", Vector3.new(w - 6, 2.4, 0.4), base * CFrame.new(0, h - 2, dd / 2 + 0.3), { 20, 20, 24 }, Enum.Material.SmoothPlastic)
	signBoth(board, list[rng:NextInteger(1, #list)], nil, Color3.new(1, 1, 1), Enum.Font.FredokaOne)
end
styleBuilders.warehouse = function(parent, x, z, d, rng)
	local w, dd, h = rng:NextInteger(44, 56), rng:NextInteger(34, 44), rng:NextInteger(16, 22)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Warehouse", Vector3.new(w, h, dd), base * CFrame.new(0, h / 2, 0), d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.CorrodedMetal)
	P(parent, "BigDoor", Vector3.new(16, 12, 0.4), base * CFrame.new(0, 6, dd / 2 + 0.2), { 70, 70, 75 }, Enum.Material.DiamondPlate)
	if d.Neon then
		P(parent, "NeonStrip", Vector3.new(w, 0.6, 0.4), base * CFrame.new(0, h - 1, dd / 2 + 0.3), d.Neon, Enum.Material.Neon, { NoShadow = true })
	end
end
styleBuilders.cabin = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Cabin", Vector3.new(16, 9, 14), base * CFrame.new(0, 4.5, 0), d.Palette[1] or { 120, 80, 50 }, Enum.Material.WoodPlanks)
	P(parent, "Roof", Vector3.new(17, 4, 7.5), base * CFrame.new(0, 11, 3.5), { 70, 50, 40 }, Enum.Material.Wood, { Class = "WedgePart" })
	P(parent, "Roof", Vector3.new(17, 4, 7.5), base * CFrame.new(0, 11, -3.5) * CFrame.Angles(0, math.pi, 0), { 70, 50, 40 }, Enum.Material.Wood, { Class = "WedgePart" })
end
styleBuilders.tent = function(parent, x, z, d, rng)
	local c = d.Palette[rng:NextInteger(1, #d.Palette)]
	local base = CFrame.new(x, GROUND_TOP, z) * CFrame.Angles(0, rng:NextNumber() * math.pi, 0)
	P(parent, "Tent", Vector3.new(8, 5, 4), base * CFrame.new(0, 2.5, 2), c, Enum.Material.Fabric, { Class = "WedgePart" })
	P(parent, "Tent", Vector3.new(8, 5, 4), base * CFrame.new(0, 2.5, -2) * CFrame.Angles(0, math.pi, 0), c, Enum.Material.Fabric, { Class = "WedgePart" })
end
styleBuilders.hotel = function(parent, x, z, d, rng)
	local w, dd, h = 40, 36, rng:NextInteger(60, 90)
	local cf = CFrame.new(x, GROUND_TOP + h / 2, z)
	P(parent, "Hotel", Vector3.new(w, h, dd), cf, d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.Concrete)
	windowBands(parent, cf, w, h, dd, rng)
	local board = P(parent, "HotelSign", Vector3.new(20, 4, 0.5), cf * CFrame.new(0, h / 2 - 4, dd / 2 + 0.4), { 30, 30, 40 }, Enum.Material.SmoothPlastic)
	signBoth(board, "HOTEL ✦", nil, Color3.fromRGB(255, 214, 120))
end
styleBuilders.kiosk = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Kiosk", Vector3.new(10, 7, 8), base * CFrame.new(0, 3.5, 0), d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.WoodPlanks)
	P(parent, "Umbrella", Vector3.new(0.6, 10, 10), base * CFrame.new(10, 8, 0) * CFrame.Angles(0, 0, math.rad(90)), { 255, 90, 90 }, Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
	P(parent, "Pole", Vector3.new(0.4, 8, 0.4), base * CFrame.new(10, 4, 0), { 240, 240, 240 }, Enum.Material.Metal)
end
styleBuilders.containers = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	for i = 0, rng:NextInteger(1, 3) do
		P(parent, "Container", Vector3.new(10, 9, 24), base * CFrame.new(0, 4.5 + i * 9, 0), d.Palette[rng:NextInteger(1, #d.Palette)], Enum.Material.CorrodedMetal)
	end
end
styleBuilders.showroom = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "ShowroomFloor", Vector3.new(44, 0.4, 30), base * CFrame.new(0, 0.2, 0), { 235, 235, 240 }, Enum.Material.Marble)
	P(parent, "ShowroomRoof", Vector3.new(44, 1, 30), base * CFrame.new(0, 14, 0), { 40, 40, 45 }, Enum.Material.Metal)
	for _, cx in ipairs({ -20, 20 }) do
		for _, cz in ipairs({ -13, 13 }) do
			P(parent, "Pillar", Vector3.new(1, 14, 1), base * CFrame.new(cx, 7, cz), { 200, 200, 210 }, Enum.Material.Metal)
		end
	end
	car(parent, x - 10, z, { 220, 30, 40 }, 0.4)
	car(parent, x + 10, z, { 20, 20, 25 }, -0.4)
end
styleBuilders.arena = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	P(parent, "Stage", Vector3.new(50, 3, 24), base * CFrame.new(0, 1.5, -40), { 30, 30, 36 }, Enum.Material.Wood)
	P(parent, "StageBack", Vector3.new(50, 24, 2), base * CFrame.new(0, 13, -52), { 20, 20, 26 }, Enum.Material.SmoothPlastic)
	local screen = P(parent, "Screen", Vector3.new(30, 14, 0.4), base * CFrame.new(0, 14, -50.8), { 255, 60, 200 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(screen, "FESTIVAL DE CREADORES", Color3.fromRGB(40, 0, 70), Color3.fromRGB(255, 220, 255))
	for i = 1, 4 do
		P(parent, "Bleacher", Vector3.new(60, 2 * i, 4), base * CFrame.new(0, i, 10 + i * 4), { 120, 120, 130 }, Enum.Material.Concrete)
	end
end
styleBuilders.rides = function(parent, x, z, d, rng)
	local base = CFrame.new(x, GROUND_TOP, z)
	local wheel = model(parent, "FerrisWheel")
	local hub = P(wheel, "Hub", Vector3.new(4, 4, 4), base * CFrame.new(0, 34, 0), { 240, 240, 240 }, Enum.Material.Metal, { Shape = Enum.PartType.Ball })
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		P(wheel, "Spoke", Vector3.new(0.6, 30, 0.6), hub.CFrame * CFrame.Angles(0, 0, a) * CFrame.new(0, 15, 0), { 255, 80, 80 }, Enum.Material.Metal)
		P(wheel, "Cabin", Vector3.new(4, 4, 4), hub.CFrame * CFrame.Angles(0, 0, a) * CFrame.new(0, 30, 0), d.Palette[(i % #d.Palette) + 1], Enum.Material.SmoothPlastic)
	end
	wheel.PrimaryPart = hub
	CollectionService:AddTag(wheel, "Spin")
	P(parent, "Support", Vector3.new(2, 36, 2), base * CFrame.new(-6, 17, 0) * CFrame.Angles(0, 0, math.rad(10)), { 200, 200, 210 }, Enum.Material.Metal)
	P(parent, "Support", Vector3.new(2, 36, 2), base * CFrame.new(6, 17, 0) * CFrame.Angles(0, 0, math.rad(-10)), { 200, 200, 210 }, Enum.Material.Metal)
end
styleBuilders.none = function() end

---------------------------------------------------------------------------
-- Interiores especiales
---------------------------------------------------------------------------
local function shell(parent, cx, cz, w, d, h, wallColor, floorColor, doorSide)
	-- doorSide: "S" (+Z) por defecto; hueco de puerta de 8 studs
	local base = CFrame.new(cx, GROUND_TOP, cz)
	P(parent, "Floor", Vector3.new(w, 0.6, d), base * CFrame.new(0, 0.3, 0), floorColor, Enum.Material.WoodPlanks)
	P(parent, "Roof", Vector3.new(w + 1, 1, d + 1), base * CFrame.new(0, h + 0.5, 0), { 60, 60, 66 }, Enum.Material.Concrete)
	P(parent, "WallN", Vector3.new(w, h, 1), base * CFrame.new(0, h / 2, -d / 2), wallColor, Enum.Material.Concrete)
	P(parent, "WallW", Vector3.new(1, h, d), base * CFrame.new(-w / 2, h / 2, 0), wallColor, Enum.Material.Concrete)
	P(parent, "WallE", Vector3.new(1, h, d), base * CFrame.new(w / 2, h / 2, 0), wallColor, Enum.Material.Concrete)
	local side = (w - 10) / 2
	P(parent, "WallS", Vector3.new(side, h, 1), base * CFrame.new(-w / 2 + side / 2, h / 2, d / 2), wallColor, Enum.Material.Concrete)
	P(parent, "WallS", Vector3.new(side, h, 1), base * CFrame.new(w / 2 - side / 2, h / 2, d / 2), wallColor, Enum.Material.Concrete)
	P(parent, "WallS", Vector3.new(10, h - 9, 1), base * CFrame.new(0, 9 + (h - 9) / 2, d / 2), wallColor, Enum.Material.Concrete)
	for _, lx in ipairs({ -w / 4, w / 4 }) do
		local lamp = P(parent, "CeilingLamp", Vector3.new(4, 0.4, 4), base * CFrame.new(lx, h - 0.3, 0), { 255, 250, 230 }, Enum.Material.Neon, { NoShadow = true })
		local l = Instance.new("PointLight")
		l.Range = 30
		l.Brightness = 1.2
		l.Parent = lamp
	end
	return base
end

-- Modelo de exposición de un objeto del catálogo
local function displayModel(parent, def, cf)
	local c = rgb(def.Color)
	local shape = def.Shape
	if shape == "monitor" then
		P(parent, "Display", Vector3.new(3.4, 2.2, 0.3), cf * CFrame.new(0, 1.4, 0), { 20, 20, 24 })
		P(parent, "DisplayScreen", Vector3.new(3.1, 1.9, 0.05), cf * CFrame.new(0, 1.4, 0.18), { 70, 140, 255 }, Enum.Material.Neon, { NoShadow = true })
	elseif shape == "tower" then
		local t = P(parent, "Display", Vector3.new(1.4, 3, 2.8), cf * CFrame.new(0, 1.5, 0), c)
		if def.Id == "pc_gamer" or def.Id == "pc_lux" then
			t.Material = Enum.Material.Glass
			t.Transparency = 0.25
			P(parent, "RGB", Vector3.new(1, 0.3, 2.4), cf * CFrame.new(0, 2.6, 0), { 200, 80, 255 }, Enum.Material.Neon, { NoShadow = true })
		end
	elseif shape == "camera" then
		P(parent, "Display", Vector3.new(1.6, 1.1, 0.9), cf * CFrame.new(0, 0.7, 0), { 25, 25, 28 })
		P(parent, "Lens", Vector3.new(0.9, 0.8, 0.8), cf * CFrame.new(0, 0.7, 0.8) * CFrame.Angles(0, math.rad(90), 0), { 40, 40, 45 }, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	elseif shape == "phone" then
		P(parent, "Display", Vector3.new(0.9, 1.7, 0.15), cf * CFrame.new(0, 1, 0) * CFrame.Angles(math.rad(-15), 0, 0), { 20, 20, 24 })
	elseif shape == "laptop" then
		P(parent, "Display", Vector3.new(2.6, 0.15, 1.8), cf * CFrame.new(0, 0.2, 0), { 160, 165, 175 }, Enum.Material.Metal)
		P(parent, "LaptopScreen", Vector3.new(2.6, 1.7, 0.1), cf * CFrame.new(0, 1, -0.9) * CFrame.Angles(math.rad(-15), 0, 0), { 70, 140, 255 }, Enum.Material.Neon, { NoShadow = true })
	elseif shape == "mic" then
		P(parent, "Display", Vector3.new(0.6, 1.4, 0.6), cf * CFrame.new(0, 0.9, 0), { 30, 30, 34 }, Enum.Material.Metal)
		P(parent, "MicHead", Vector3.new(0.9, 0.9, 0.9), cf * CFrame.new(0, 1.8, 0), { 120, 120, 125 }, Enum.Material.DiamondPlate, { Shape = Enum.PartType.Ball })
	elseif shape == "light" then
		P(parent, "Display", Vector3.new(0.3, 2, 2), cf * CFrame.new(0, 1.4, 0), { 255, 255, 240 }, Enum.Material.Neon, { NoShadow = true })
	elseif shape == "tripod" then
		for i = 0, 2 do
			P(parent, "Leg", Vector3.new(0.15, 2.6, 0.15), cf * CFrame.Angles(0, i * 2.1, 0) * CFrame.new(0, 1.2, 0.4) * CFrame.Angles(math.rad(15), 0, 0), { 40, 40, 44 }, Enum.Material.Metal)
		end
	elseif shape == "chair" then
		P(parent, "Display", Vector3.new(2, 0.4, 2), cf * CFrame.new(0, 1, 0), c)
		P(parent, "Back", Vector3.new(2, 2.2, 0.3), cf * CFrame.new(0, 2.2, -0.9), c)
	elseif shape == "desk" then
		P(parent, "Display", Vector3.new(4, 0.3, 2), cf * CFrame.new(0, 1.6, 0), c, Enum.Material.WoodPlanks)
	else
		P(parent, "Display", Vector3.new(1.4, 1, 1.4), cf * CFrame.new(0, 0.6, 0), c)
	end
end

local function buildStore(parent, sp, rng)
	local store = Catalog.Stores[sp.StoreId]
	local m = model(parent, "Store_" .. store.Name)
	m:SetAttribute("StoreId", sp.StoreId)
	local w, d, h = 64, 46, 16
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 235, 235, 240 }, { 200, 200, 205 })
	local board = P(m, "StoreSign", Vector3.new(30, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	signBoth(board, store.Name, Color3.fromRGB(255, 40, 70), Color3.new(1, 1, 1))
	-- Mostrador y dependiente
	local counter = P(m, "Counter", Vector3.new(18, 4, 3), base * CFrame.new(0, 2, -d / 2 + 7), { 40, 40, 48 }, Enum.Material.Wood)
	prompt(counter, "store_catalog", "Ver catálogo completo", store.Name, { StoreId = sp.StoreId })
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 4)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Dependiente de " .. store.Name, Role = "shopkeeper", Store = sp.StoreId })
	-- Expositores (8 productos variados de la tienda)
	local items = Catalog.list({ Store = sp.StoreId })
	local picks = {}
	local step = math.max(1, math.floor(#items / 8))
	for i = 1, #items, step do
		if #picks < 8 then
			picks[#picks + 1] = items[i]
		end
	end
	for i, def in ipairs(picks) do
		local col = (i - 1) % 4
		local row = math.floor((i - 1) / 4)
		local px = -21 + col * 14
		local pz = -2 + row * 12
		local pedestal = P(m, "Pedestal", Vector3.new(5, 3, 5), base * CFrame.new(px, 1.5, pz), { 250, 250, 252 }, Enum.Material.Marble)
		displayModel(m, def, base * CFrame.new(px, 3, pz))
		local tag = P(m, "PriceTag", Vector3.new(4.6, 1, 0.2), base * CFrame.new(px, 2.2, pz + 2.6), { 255, 214, 0 })
		signBoth(tag, "$" .. Util.formatInt(def.Price), nil, Color3.fromRGB(20, 20, 24))
		prompt(pedestal, "inspect", "Inspeccionar", def.Name, { ItemId = def.Id, StoreId = sp.StoreId })
	end
end

-- Rastro & Retro: tienda de segunda mano con estanterías, vitrina de coleccionables y taller
local function buildUsedStore(parent, sp)
	local m = model(parent, "RastroRetro")
	m:SetAttribute("Special", "usedstore")
	local w, d, h = 60, 44, 15
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 190, 140, 105 }, { 140, 100, 70 })
	local board = P(m, "UsedStoreSign", Vector3.new(30, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	signBoth(board, "♻ " .. sp.Name, Color3.fromRGB(70, 110, 70), Color3.fromRGB(255, 235, 190))
	P(m, "Awning", Vector3.new(22, 0.4, 5), base * CFrame.new(0, 10.6, d / 2 + 2.6) * CFrame.Angles(math.rad(12), 0, 0), { 200, 70, 60 }, Enum.Material.Fabric)
	P(m, "Rug", Vector3.new(26, 0.1, 16), base * CFrame.new(0, 0.65, 4), { 150, 60, 50 }, Enum.Material.Fabric, { NoCollide = true })
	-- Mostrador: abre la app de segunda mano
	local counter = P(m, "UsedCounter", Vector3.new(16, 4, 3), base * CFrame.new(0, 2, -d / 2 + 7), { 110, 75, 50 }, Enum.Material.Wood)
	prompt(counter, "usedstore", "Ver stock, vender y reparar", sp.Name)
	P(m, "CashRegister", Vector3.new(2, 1.2, 1.6), base * CFrame.new(5, 4.6, -d / 2 + 7), { 60, 60, 66 }, Enum.Material.Metal)
	local note = P(m, "CounterSign", Vector3.new(6, 1.4, 0.2), base * CFrame.new(-3, 4.8, -d / 2 + 5.4), { 255, 240, 200 })
	signBoth(note, "COMPRAMOS Y VENDEMOS USADOS", Color3.fromRGB(255, 240, 200), Color3.fromRGB(60, 40, 20))
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 4)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Dependienta de " .. sp.Name, Role = "shopkeeper" })
	-- Estanterías en las paredes laterales con objetos variados
	local rng = Random.new(Util.hashString(sp.Name))
	local colors = { { 200, 60, 50 }, { 60, 120, 200 }, { 230, 190, 60 }, { 80, 160, 90 }, { 40, 40, 44 }, { 220, 220, 225 }, { 150, 90, 160 } }
	for _, side in ipairs({ -1, 1 }) do
		for j = 0, 2 do
			local sx = side * (w / 2 - 1.8)
			local sz = -9 + j * 11
			P(m, "ShelfBack", Vector3.new(0.4, 9, 9), base * CFrame.new(sx + side * 1, 4.5, sz), { 110, 80, 55 }, Enum.Material.WoodPlanks)
			for level = 0, 2 do
				local y = 1.2 + level * 2.9
				P(m, "ShelfBoard", Vector3.new(2.6, 0.3, 9), base * CFrame.new(sx, y, sz), { 130, 95, 65 }, Enum.Material.WoodPlanks)
				for k = 0, 2 do
					local s = 0.8 + rng:NextNumber() * 0.9
					P(m, "UsedThing", Vector3.new(s, s * (0.7 + rng:NextNumber()), s), base * CFrame.new(sx - side * 0.2, y + 0.15 + s * 0.6, sz - 3 + k * 3) * CFrame.Angles(0, rng:NextNumber() * 0.8, 0),
						colors[rng:NextInteger(1, #colors)], Enum.Material.SmoothPlastic)
				end
			end
		end
	end
	-- Mesas centrales con productos de muestra (cámara, teléfono, consola, monitor...)
	local samples = {}
	for _, cat in ipairs({ "camera", "phone", "gadget", "monitor", "audio", "laptop" }) do
		local list = Catalog.list({ Cat = cat })
		if list[1] then
			samples[#samples + 1] = list[math.min(#list, 2)]
		end
	end
	for i, def in ipairs(samples) do
		local tx = -12 + ((i - 1) % 3) * 12
		local tz = -2 + math.floor((i - 1) / 3) * 10
		P(m, "UsedTable", Vector3.new(6, 0.4, 4), base * CFrame.new(tx, 2.8, tz), { 120, 85, 55 }, Enum.Material.Wood)
		P(m, "UsedTableLeg", Vector3.new(0.6, 2.6, 0.6), base * CFrame.new(tx, 1.4, tz), { 70, 50, 35 }, Enum.Material.Wood)
		displayModel(m, def, base * CFrame.new(tx, 3, tz))
		local tag = P(m, "UsedTag", Vector3.new(3.6, 0.9, 0.2), base * CFrame.new(tx, 2.2, tz + 2.1), { 255, 214, 0 })
		signBoth(tag, "USADO", nil, Color3.fromRGB(20, 20, 24))
	end
	-- Vitrina de coleccionables
	local vit = P(m, "CollectorCase", Vector3.new(10, 3, 3), base * CFrame.new(-16, 1.5, -d / 2 + 4), { 90, 60, 40 }, Enum.Material.Wood)
	P(m, "CollectorGlass", Vector3.new(10, 3, 3), base * CFrame.new(-16, 4.5, -d / 2 + 4), { 200, 230, 255 }, Enum.Material.Glass, { Transparency = 0.6 })
	local shown = 0
	for _, id in ipairs(Catalog.Order) do
		local def = Catalog.get(id)
		if def.Collectible and shown < 4 then
			P(m, "Collectible", Vector3.new(1.4, 1.2, 1), base * CFrame.new(-19.5 + shown * 2.4, 3.6, -d / 2 + 4), def.Color, Enum.Material.SmoothPlastic)
			shown = shown + 1
		end
	end
	local cs = P(m, "CollectorSign", Vector3.new(8, 1.2, 0.2), base * CFrame.new(-16, 6.6, -d / 2 + 2.5), { 30, 20, 10 })
	signBoth(cs, "⭐ COLECCIONABLES", Color3.fromRGB(30, 20, 10), Color3.fromRGB(255, 214, 0))
	prompt(vit, "usedstore", "Ver coleccionables", sp.Name)
	-- Taller de reparación
	local bench = P(m, "RepairBench", Vector3.new(8, 3.4, 3), base * CFrame.new(16, 1.7, -d / 2 + 4), { 80, 80, 86 }, Enum.Material.Metal)
	P(m, "Toolbox", Vector3.new(2, 1, 1), base * CFrame.new(14, 3.9, -d / 2 + 4), { 200, 40, 40 }, Enum.Material.Metal)
	P(m, "SolderLamp", Vector3.new(0.4, 2, 0.4), base * CFrame.new(18.5, 4.4, -d / 2 + 3.5), { 40, 40, 44 }, Enum.Material.Metal)
	local ts = P(m, "RepairSign", Vector3.new(6, 1.2, 0.2), base * CFrame.new(16, 6.4, -d / 2 + 2.5), { 30, 30, 34 })
	signBoth(ts, "🔧 TALLER −30%", Color3.fromRGB(30, 30, 34), Color3.fromRGB(120, 230, 255))
	prompt(bench, "usedstore", "Reparar equipo", sp.Name)
	-- Rincón retro: sofá viejo y caja de vinilos
	P(m, "OldSofa", Vector3.new(8, 2, 3), base * CFrame.new(12, 1.6, 14), { 120, 140, 90 }, Enum.Material.Fabric)
	P(m, "OldSofaBack", Vector3.new(8, 2.4, 0.8), base * CFrame.new(12, 3, 15.3), { 110, 130, 80 }, Enum.Material.Fabric)
	P(m, "VinylCrate", Vector3.new(3, 1.8, 2.4), base * CFrame.new(-14, 1.5, 14), { 150, 110, 70 }, Enum.Material.WoodPlanks)
	for k = 0, 4 do
		P(m, "Vinyl", Vector3.new(0.1, 1.6, 1.6), base * CFrame.new(-15 + k * 0.5, 2.6, 14), colors[(k % #colors) + 1], Enum.Material.SmoothPlastic)
	end
end

local function buildCafe(parent, sp)
	local m = model(parent, "Cibercafe")
	local w, d, h = 48, 36, 14
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 250, 230, 200 }, { 150, 110, 80 })
	local board = P(m, "CafeSign", Vector3.new(24, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	signBoth(board, "☕ " .. sp.Name, Color3.fromRGB(90, 50, 30), Color3.fromRGB(255, 230, 190))
	for i = 1, 4 do
		local x = -18 + (i - 1) * 12
		local desk = P(m, "PublicDesk", Vector3.new(7, 0.5, 3.5), base * CFrame.new(x, 3, -d / 2 + 4), { 120, 85, 60 }, Enum.Material.WoodPlanks)
		P(m, "PublicMonitor", Vector3.new(3, 2, 0.3), base * CFrame.new(x, 4.6, -d / 2 + 3), { 20, 20, 24 })
		P(m, "PublicScreen", Vector3.new(2.7, 1.7, 0.05), base * CFrame.new(x, 4.6, -d / 2 + 3.2), { 70, 140, 255 }, Enum.Material.Neon, { NoShadow = true })
		prompt(desk, "computer_public", "Usar computador público", "Cibercafé")
	end
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(14, 0, 8)).Position, Look = (base * CFrame.new(0, 0, 8)).Position, Name = "Barista", Role = "barista" })
	local bar = P(m, "CafeCounter", Vector3.new(10, 4, 3), base * CFrame.new(14, 2, 12), { 90, 60, 40 }, Enum.Material.Wood)
	prompt(bar, "cafe", "Pedir", "Cafetería")
end

local function buildRestaurant(parent, sp)
	local m = model(parent, "Restaurante")
	local w, d, h = 54, 40, 14
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 250, 235, 215 }, { 120, 70, 50 })
	local board = P(m, "RestaurantSign", Vector3.new(26, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	signBoth(board, "🍽 " .. sp.Name, Color3.fromRGB(130, 30, 30), Color3.fromRGB(255, 230, 190))
	for i = 0, 5 do
		local tx, tz = -16 + (i % 3) * 16, -2 + math.floor(i / 3) * 12
		P(m, "Table", Vector3.new(5, 0.4, 5), base * CFrame.new(tx, 3, tz), { 245, 245, 245 }, Enum.Material.Fabric)
		P(m, "TableLeg", Vector3.new(0.6, 3, 0.6), base * CFrame.new(tx, 1.5, tz), { 60, 40, 30 }, Enum.Material.Wood)
		for _, sx in ipairs({ -3.4, 3.4 }) do
			P(m, "Chair", Vector3.new(2, 2, 2), base * CFrame.new(tx + sx, 1.6, tz), { 140, 40, 40 }, Enum.Material.Fabric)
		end
	end
	local counter = P(m, "Counter", Vector3.new(16, 4, 3), base * CFrame.new(0, 2, -d / 2 + 6), { 90, 50, 35 }, Enum.Material.Wood)
	prompt(counter, "restaurant", "Ver menú", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 3)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Camarero", Role = "waiter" })
end

-- Tienda de mascotas: escaparate, jaulas y peceras decorativas, mostrador (app Mascotas) y cuidadora
local function buildPetShop(parent, sp)
	local m = model(parent, "TiendaMascotas")
	local w, d, h = 50, 38, 14
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 255, 244, 225 }, { 205, 185, 150 })
	local board = P(m, "PetShopSign", Vector3.new(30, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	signBoth(board, "🐾 " .. sp.Name, Color3.fromRGB(60, 160, 130), Color3.new(1, 1, 1))
	-- Escaparates a ambos lados de la puerta (vitrina con un rascador y un peluche de perro)
	for _, sx in ipairs({ -1, 1 }) do
		local cx = sx * 15
		P(m, "ShowcaseBase", Vector3.new(12, 1.5, 4), base * CFrame.new(cx, 0.75, d / 2 + 2.5), { 240, 240, 245 }, Enum.Material.Marble)
		P(m, "ShowcaseGlass", Vector3.new(12, 6, 4), base * CFrame.new(cx, 4.5, d / 2 + 2.5), { 200, 230, 255 }, Enum.Material.Glass, { Transparency = 0.6 })
		P(m, "CatTreePost", Vector3.new(0.8, 4.5, 0.8), base * CFrame.new(cx - 3, 3.75, d / 2 + 2.5), { 210, 180, 140 }, Enum.Material.Fabric)
		P(m, "CatTreeTop", Vector3.new(2.6, 0.4, 2.6), base * CFrame.new(cx - 3, 6, d / 2 + 2.5), { 170, 120, 90 }, Enum.Material.Fabric)
		P(m, "PlushBody", Vector3.new(2.4, 1.6, 1.4), base * CFrame.new(cx + 2.5, 2.3, d / 2 + 2.5), sx < 0 and { 200, 150, 90 } or { 240, 240, 240 }, Enum.Material.Fabric)
		P(m, "PlushHead", Vector3.new(1.3, 1.3, 1.3), base * CFrame.new(cx + 4, 3.4, d / 2 + 2.5), sx < 0 and { 200, 150, 90 } or { 240, 240, 240 }, Enum.Material.Fabric)
	end
	-- Jaulas decorativas (pared oeste) con conejitos y pájaros de exposición
	for i = 0, 2 do
		local z = -8 + i * 8
		local cage = base * CFrame.new(-w / 2 + 4, 0, z)
		P(m, "CageBase", Vector3.new(5, 0.4, 5), cage * CFrame.new(0, 2.2, 0), { 230, 230, 235 }, Enum.Material.Metal)
		P(m, "CageTable", Vector3.new(5.4, 2, 5.4), cage * CFrame.new(0, 1, 0), { 150, 110, 80 }, Enum.Material.Wood)
		P(m, "CageTop", Vector3.new(5, 0.3, 5), cage * CFrame.new(0, 6.4, 0), { 230, 230, 235 }, Enum.Material.Metal)
		for b = -2, 2 do
			P(m, "CageBar", Vector3.new(0.12, 4, 0.12), cage * CFrame.new(2.4, 4.4, b), { 200, 200, 210 }, Enum.Material.Metal, { NoShadow = true })
			P(m, "CageBar", Vector3.new(0.12, 4, 0.12), cage * CFrame.new(b, 4.4, 2.4), { 200, 200, 210 }, Enum.Material.Metal, { NoShadow = true })
		end
		local figure = i == 1 and { 255, 210, 60 } or { 245, 245, 245 }
		P(m, "CagePet", Vector3.new(1.4, 1.2, 1.6), cage * CFrame.new(0, 3, 0), figure, Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	end
	-- Peceras (pared este)
	for i = 0, 1 do
		local tank = base * CFrame.new(w / 2 - 4, 0, -6 + i * 12)
		P(m, "TankStand", Vector3.new(4, 3, 8), tank * CFrame.new(0, 1.5, 0), { 60, 60, 70 }, Enum.Material.Wood)
		P(m, "TankWater", Vector3.new(3.4, 3.4, 7.4), tank * CFrame.new(0, 4.8, 0), { 60, 170, 230 }, Enum.Material.Glass, { Transparency = 0.45, NoShadow = true })
		P(m, "TankGlass", Vector3.new(3.8, 4, 7.8), tank * CFrame.new(0, 5, 0), { 220, 240, 255 }, Enum.Material.Glass, { Transparency = 0.75 })
		P(m, "TankSand", Vector3.new(3.4, 0.4, 7.4), tank * CFrame.new(0, 3.3, 0), { 230, 210, 160 }, Enum.Material.Sand)
		P(m, "TankPlant", Vector3.new(0.5, 2.2, 0.5), tank * CFrame.new(0, 4.5, 2.5), { 60, 170, 80 }, Enum.Material.Grass)
		for f = 0, 2 do
			P(m, "TankFish", Vector3.new(0.3, 0.5, 0.8), tank * CFrame.new(0.3 - f * 0.3, 4.6 + f * 0.5, -2 + f * 1.6), f == 1 and { 255, 220, 60 } or { 255, 120, 30 }, Enum.Material.Neon, { NoShadow = true })
		end
		local light = P(m, "TankLight", Vector3.new(3.8, 0.3, 7.8), tank * CFrame.new(0, 7.15, 0), { 230, 245, 255 }, Enum.Material.Neon, { NoShadow = true })
		nightLight(light, 12, Color3.fromRGB(150, 210, 255))
	end
	-- Estantería de comida y juguetes
	P(m, "PetShelf", Vector3.new(10, 6, 2), base * CFrame.new(-8, 3, -d / 2 + 1.5), { 230, 220, 200 }, Enum.Material.WoodPlanks)
	for i = 0, 3 do
		P(m, "PetFoodBag", Vector3.new(1.6, 2, 1), base * CFrame.new(-11.5 + i * 2.3, 2.5, -d / 2 + 2.6), ({ { 230, 80, 60 }, { 60, 140, 230 }, { 90, 190, 100 }, { 250, 200, 60 } })[i + 1], Enum.Material.Fabric)
		P(m, "PetToyBall", Vector3.new(0.9, 0.9, 0.9), base * CFrame.new(-11.5 + i * 2.3, 5, -d / 2 + 2.6), ({ { 255, 80, 120 }, { 255, 220, 60 }, { 80, 200, 255 }, { 140, 230, 120 } })[i + 1], Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Ball })
	end
	-- Mostrador con aviso: abre la app Mascotas
	local counter = P(m, "PetCounter", Vector3.new(14, 4, 3), base * CFrame.new(6, 2, -d / 2 + 7), { 120, 80, 50 }, Enum.Material.Wood)
	local cs = P(m, "PetCounterSign", Vector3.new(8, 1.4, 0.2), base * CFrame.new(6, 3, -d / 2 + 8.6), { 60, 160, 130 })
	signBoth(cs, "ADOPCIONES · ACCESORIOS", Color3.fromRGB(60, 160, 130), Color3.new(1, 1, 1))
	prompt(counter, "petshop", "Ver mascotas", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(6, 0, -d / 2 + 4)).Position, Look = (base * CFrame.new(6, 0, 0)).Position, Name = "Cuidadora de Huellitas", Role = "petkeeper" })
end

local function vending(parent, x, z)
	local mach = P(parent, "VendingMachine", Vector3.new(4, 7, 3), Vector3.new(x, GROUND_TOP + 3.5, z), { 200, 30, 50 }, Enum.Material.SmoothPlastic)
	P(parent, "VendingGlass", Vector3.new(2.6, 4, 0.2), Vector3.new(x, GROUND_TOP + 4.5, z + 1.55), { 180, 220, 255 }, Enum.Material.Glass, { Transparency = 0.3 })
	prompt(mach, "vending", "Comprar", "Máquina expendedora")
	table.insert(World.VendingMachines, Vector3.new(x, 0, z))
end

local function buildBank(parent, sp)
	local m = model(parent, "Banco")
	local w, d, h = 50, 36, 18
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 230, 225, 210 }, { 240, 240, 240 })
	local board = P(m, "BankSign", Vector3.new(28, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 40, 70 })
	signBoth(board, "🏦 " .. sp.Name, Color3.fromRGB(20, 40, 70), Color3.fromRGB(255, 214, 120))
	for i = 1, 3 do
		local atm = P(m, "ATM", Vector3.new(3, 6, 2), base * CFrame.new(-14 + (i - 1) * 14, 3, -d / 2 + 2), { 60, 70, 90 }, Enum.Material.Metal)
		P(m, "ATMScreen", Vector3.new(2, 1.4, 0.1), base * CFrame.new(-14 + (i - 1) * 14, 4.2, -d / 2 + 3.05), { 80, 220, 140 }, Enum.Material.Neon, { NoShadow = true })
		prompt(atm, "atm", "Abrir banco", "Cajero automático")
	end
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(16, 0, 6)).Position, Look = (base * CFrame.new(0, 0, 6)).Position, Name = "Asesora del banco", Role = "banker" })
end

-- Concesionario: sala de exposición acristalada, coches de exposición, mostrador y zona de entrega
local function buildDealer(parent, sp)
	local m = model(parent, "Concesionario")
	local w, d, h = 64, 46, 16
	local base = CFrame.new(sp.WX, GROUND_TOP, sp.WZ)
	P(m, "Floor", Vector3.new(w, 0.6, d), base * CFrame.new(0, 0.3, 0), { 235, 236, 240 }, Enum.Material.Marble)
	P(m, "Roof", Vector3.new(w + 2, 1, d + 2), base * CFrame.new(0, h + 0.5, 0), { 40, 42, 48 }, Enum.Material.Metal)
	P(m, "WallN", Vector3.new(w, h, 1), base * CFrame.new(0, h / 2, -d / 2), { 50, 52, 60 }, Enum.Material.Concrete)
	-- Paredes de cristal (este, oeste y fachada con puerta de 12 studs)
	local glass = { 170, 210, 235 }
	P(m, "GlassW", Vector3.new(0.6, h, d), base * CFrame.new(-w / 2, h / 2, 0), glass, Enum.Material.Glass, { Transparency = 0.6 })
	P(m, "GlassE", Vector3.new(0.6, h, d), base * CFrame.new(w / 2, h / 2, 0), glass, Enum.Material.Glass, { Transparency = 0.6 })
	local side = (w - 12) / 2
	P(m, "GlassS", Vector3.new(side, h, 0.6), base * CFrame.new(-w / 2 + side / 2, h / 2, d / 2), glass, Enum.Material.Glass, { Transparency = 0.6 })
	P(m, "GlassS", Vector3.new(side, h, 0.6), base * CFrame.new(w / 2 - side / 2, h / 2, d / 2), glass, Enum.Material.Glass, { Transparency = 0.6 })
	P(m, "GlassS", Vector3.new(12, h - 10, 0.6), base * CFrame.new(0, 10 + (h - 10) / 2, d / 2), glass, Enum.Material.Glass, { Transparency = 0.6 })
	for _, x in ipairs({ -w / 2, -w / 4, 0, w / 4, w / 2 }) do
		P(m, "Mullion", Vector3.new(0.6, h, 0.8), base * CFrame.new(x, h / 2, d / 2), { 200, 200, 210 }, Enum.Material.Metal)
	end
	local board = P(m, "DealerSign", Vector3.new(34, 4, 0.6), base * CFrame.new(0, h + 3, d / 2), { 20, 20, 24 })
	signBoth(board, "🚗 " .. sp.Name, Color3.fromRGB(20, 30, 60), Color3.fromRGB(120, 220, 255))
	for _, lx in ipairs({ -w / 4, w / 4 }) do
		local lamp = P(m, "CeilingLamp", Vector3.new(10, 0.4, 3), base * CFrame.new(lx, h - 0.3, 0), { 255, 252, 240 }, Enum.Material.Neon, { NoShadow = true })
		local l = Instance.new("PointLight")
		l.Range = 34
		l.Brightness = 1.3
		l.Parent = lamp
	end
	-- Coches de exposición sobre plataformas giratorias, con su precio
	local shown = { "v_compact", "v_ev", "v_sport", "v_lux" }
	for i, id in ipairs(shown) do
		local def = LifeData.VehicleById[id]
		local x = -24 + (i - 1) * 16
		local col = LifeData.VehicleColors[({ 1, 6, 5, 4 })[i]][2]
		local plat = P(m, "Turntable", Vector3.new(0.4, 13, 13), base * CFrame.new(x, 0.75, 2) * CFrame.Angles(0, 0, math.rad(90)), { 210, 214, 222 }, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
		P(m, "TurntableRing", Vector3.new(0.2, 13.6, 13.6), base * CFrame.new(x, 0.62, 2) * CFrame.Angles(0, 0, math.rad(90)), { 0, 190, 255 }, Enum.Material.Neon, { Shape = Enum.PartType.Cylinder, NoShadow = true, NoCollide = true })
		local show = car(m, sp.WX + x, sp.WZ + 2, col, 0.35 * ((i % 2 == 0) and 1 or -1))
		show.Name = "ShowCar"
		for _, piece in ipairs(show:GetChildren()) do
			piece.CFrame = piece.CFrame + Vector3.new(0, 0.95, 0) -- sobre la plataforma
		end
		local tag = P(m, "PriceTag", Vector3.new(9, 2.2, 0.3), base * CFrame.new(x, 1.6, 10.5), { 255, 214, 0 })
		signBoth(tag, def.Name .. "\n$" .. Util.formatInt(def.Price), nil, Color3.fromRGB(20, 20, 24), Enum.Font.GothamBold)
		prompt(plat, "dealer", "Ver modelos", def.Name)
	end
	-- Mostrador del vendedor
	local counter = P(m, "Counter", Vector3.new(18, 4, 3), base * CFrame.new(0, 2, -d / 2 + 7), { 30, 34, 44 }, Enum.Material.Wood)
	P(m, "CounterTop", Vector3.new(18.4, 0.3, 3.4), base * CFrame.new(0, 4.15, -d / 2 + 7), { 235, 236, 240 }, Enum.Material.Marble)
	prompt(counter, "dealer", "Comprar o alquilar", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 4)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Vendedora de " .. sp.Name, Role = "dealer" })
	-- Taller (lateral): mejoras y pintura
	local garage = P(m, "WorkshopDoor", Vector3.new(0.6, 10, 12), base * CFrame.new(-w / 2 - 0.4, 5, -10), { 90, 95, 105 }, Enum.Material.DiamondPlate)
	local ws = P(m, "WorkshopSign", Vector3.new(0.4, 2, 10), base * CFrame.new(-w / 2 - 0.8, 11.5, -10), { 20, 20, 24 })
	sign(ws, Enum.NormalId.Left, "🔧 TALLER · MEJORAS · PINTURA", Color3.fromRGB(30, 30, 36), Color3.fromRGB(255, 214, 0))
	prompt(garage, "dealer", "Taller y mejoras", sp.Name)
	-- Zona de entrega (aquí aparecen los vehículos comprados o alquilados)
	local bay = P(m, "DeliveryBay", Vector3.new(26, 0.1, 22), base * CFrame.new(14, 0.13, d / 2 + 17), { 60, 62, 70 }, Enum.Material.Asphalt, { NoShadow = true })
	bay.CanCollide = false
	for _, bx in ipairs({ 1, 27 }) do
		P(m, "BayLine", Vector3.new(0.5, 0.06, 22), base * CFrame.new(bx, 0.18, d / 2 + 17), { 250, 250, 250 }, Enum.Material.SmoothPlastic, { NoShadow = true, NoCollide = true })
	end
	local bsign = P(m, "BaySign", Vector3.new(10, 2, 0.4), base * CFrame.new(14, 4, d / 2 + 6), { 20, 20, 24 })
	signBoth(bsign, "ENTREGA DE VEHÍCULOS", Color3.fromRGB(20, 110, 70), Color3.new(1, 1, 1))
	P(m, "BaySignPole", Vector3.new(0.4, 3, 0.4), base * CFrame.new(14, 1.5, d / 2 + 6), { 200, 200, 210 }, Enum.Material.Metal)
end

-- Gasolinera: marquesina, dos surtidores, cargador eléctrico y tienda/taller
local function buildGasStation(parent, sp)
	local m = model(parent, "Gasolinera")
	local base = CFrame.new(sp.WX, GROUND_TOP, sp.WZ)
	P(m, "Forecourt", Vector3.new(44, 0.3, 34), base * CFrame.new(0, 0.15, 0), { 120, 122, 128 }, Enum.Material.Concrete)
	-- Marquesina
	local roofH = 13
	P(m, "Canopy", Vector3.new(32, 1.6, 18), base * CFrame.new(0, roofH, 2), { 245, 245, 250 }, Enum.Material.SmoothPlastic)
	local trim = P(m, "CanopyTrim", Vector3.new(32.4, 0.8, 18.4), base * CFrame.new(0, roofH - 1, 2), { 230, 40, 50 }, Enum.Material.Neon, { NoShadow = true, NoCollide = true })
	local cs = P(m, "CanopySign", Vector3.new(20, 2.6, 0.4), base * CFrame.new(0, roofH + 2.2, 11.2), { 20, 20, 24 })
	signBoth(cs, "⛽ " .. sp.Name, Color3.fromRGB(200, 30, 40), Color3.new(1, 1, 1))
	for _, x in ipairs({ -13, 13 }) do
		for _, z in ipairs({ -4, 8 }) do
			P(m, "CanopyPillar", Vector3.new(1, roofH, 1), base * CFrame.new(x, roofH / 2, z), { 210, 210, 218 }, Enum.Material.Metal)
		end
	end
	for _, x in ipairs({ -8, 8 }) do
		local lamp = P(m, "CanopyLight", Vector3.new(6, 0.2, 2), base * CFrame.new(x, roofH - 0.9, 2), { 255, 250, 235 }, Enum.Material.Neon, { NoShadow = true })
		nightLight(lamp, 30)
	end
	-- Surtidores
	for i, x in ipairs({ -6, 6 }) do
		P(m, "PumpIsland", Vector3.new(4, 0.6, 9), base * CFrame.new(x, 0.6, 2), { 200, 200, 205 }, Enum.Material.Concrete)
		local pump = P(m, "FuelPump", Vector3.new(2.4, 5.2, 1.8), base * CFrame.new(x, 3.5, 2), { 230, 40, 50 }, Enum.Material.SmoothPlastic)
		P(m, "PumpScreen", Vector3.new(1.6, 1, 0.1), base * CFrame.new(x, 4.6, 2.95), { 80, 220, 140 }, Enum.Material.Neon, { NoShadow = true })
		P(m, "PumpHose", Vector3.new(0.3, 2.6, 0.3), base * CFrame.new(x + 1.35, 3, 2.6), { 20, 20, 22 }, Enum.Material.Rubber)
		local pn = P(m, "PumpNumber", Vector3.new(1.4, 0.8, 0.1), base * CFrame.new(x, 5.6, 2.95), { 255, 255, 255 })
		signBoth(pn, tostring(i), Color3.new(1, 1, 1), Color3.fromRGB(200, 30, 40))
		prompt(pump, "gas", "Repostar", "Surtidor " .. i)
	end
	-- Cargador eléctrico
	local charger = P(m, "EVCharger", Vector3.new(1.6, 5, 1.2), base * CFrame.new(17, 2.8, 4), { 240, 245, 245 }, Enum.Material.SmoothPlastic)
	local glow = P(m, "EVGlow", Vector3.new(1.7, 0.4, 1.3), base * CFrame.new(17, 4.6, 4), { 60, 230, 120 }, Enum.Material.Neon, { NoShadow = true, NoCollide = true })
	nightLight(glow, 12, Color3.fromRGB(80, 255, 140))
	local es = P(m, "EVSign", Vector3.new(4, 1.4, 0.2), base * CFrame.new(17, 6.4, 4), { 20, 20, 24 })
	signBoth(es, "🔋 CARGA", Color3.fromRGB(20, 110, 70), Color3.new(1, 1, 1))
	prompt(charger, "gas", "Cargar batería", "Cargador eléctrico")
	-- Tienda 24 h con taller
	P(m, "Shop", Vector3.new(16, 9, 9), base * CFrame.new(-10, 4.8, -12), { 245, 240, 230 }, Enum.Material.Concrete)
	P(m, "ShopWindow", Vector3.new(10, 4, 0.3), base * CFrame.new(-11, 4.5, -7.4), { 170, 210, 235 }, Enum.Material.Glass, { Transparency = 0.4 })
	local ss = P(m, "ShopSign", Vector3.new(14, 2, 0.4), base * CFrame.new(-10, 10.2, -7.4), { 20, 20, 24 })
	signBoth(ss, "TIENDA 24H · TALLER", Color3.fromRGB(30, 30, 36), Color3.fromRGB(255, 214, 0))
	local shopDoor = P(m, "WorkshopDoor", Vector3.new(8, 7, 0.4), base * CFrame.new(8, 3.8, -11.6), { 90, 95, 105 }, Enum.Material.DiamondPlate)
	P(m, "Workshop", Vector3.new(10, 9, 8), base * CFrame.new(8, 4.8, -16), { 200, 200, 205 }, Enum.Material.Concrete)
	prompt(shopDoor, "gas", "Taller", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(2, 0, -6)).Position, Look = (base * CFrame.new(0, 0, 2)).Position, Name = "Mecánico de " .. sp.Name, Role = "mechanic" })
	trim.CanQuery = false
end

local function buildResidence(parent, sp)
	local m = model(parent, "ResidenciaEconomica")
	local roomW, roomD, h = 22, 20, 12
	local perRow = 6
	local corridor = 10
	local totalW = roomW * perRow
	local totalD = roomD * 2 + corridor
	local base = CFrame.new(sp.WX, GROUND_TOP, sp.WZ)
	P(m, "Floor", Vector3.new(totalW, 0.6, totalD), base * CFrame.new(0, 0.3, 0), { 120, 110, 100 }, Enum.Material.WoodPlanks)
	P(m, "Roof", Vector3.new(totalW + 2, 1, totalD + 2), base * CFrame.new(0, h + 0.5, 0), { 90, 80, 75 }, Enum.Material.Slate)
	P(m, "WallN", Vector3.new(totalW, h, 1), base * CFrame.new(0, h / 2, -totalD / 2), { 200, 185, 160 }, Enum.Material.Brick)
	P(m, "WallS", Vector3.new(totalW, h, 1), base * CFrame.new(0, h / 2, totalD / 2), { 200, 185, 160 }, Enum.Material.Brick)
	-- extremos con puertas (pasillo a lo largo del eje X)
	for _, sx in ipairs({ -1, 1 }) do
		local ex = sx * totalW / 2
		local side = (totalD - 10) / 2
		P(m, "WallEnd", Vector3.new(1, h, side), base * CFrame.new(ex, h / 2, -totalD / 2 + side / 2), { 200, 185, 160 }, Enum.Material.Brick)
		P(m, "WallEnd", Vector3.new(1, h, side), base * CFrame.new(ex, h / 2, totalD / 2 - side / 2), { 200, 185, 160 }, Enum.Material.Brick)
		P(m, "WallEnd", Vector3.new(1, h - 9, 10), base * CFrame.new(ex, 9 + (h - 9) / 2, 0), { 200, 185, 160 }, Enum.Material.Brick)
	end
	local board = P(m, "ResidenceSign", Vector3.new(0.6, 3, 16), base * CFrame.new(totalW / 2 + 0.6, h - 2, 0), { 30, 30, 36 })
	sign(board, Enum.NormalId.Right, "🏠 " .. sp.Name, nil, Color3.fromRGB(255, 214, 120))
	local index = 0
	for row = 0, 1 do
		for col = 0, perRow - 1 do
			index = index + 1
			local rx = -totalW / 2 + roomW / 2 + col * roomW
			local rz = (row == 0) and (-totalD / 2 + roomD / 2) or (totalD / 2 - roomD / 2)
			local rbase = base * CFrame.new(rx, 0, rz)
			local towardCorridor = (row == 0) and 1 or -1 -- dirección Z hacia el pasillo
			-- tabiques entre habitaciones
			P(m, "Partition", Vector3.new(0.6, h, roomD), rbase * CFrame.new(-roomW / 2, h / 2, 0), { 230, 225, 215 }, Enum.Material.Plaster)
			-- pared del pasillo con puerta
			local wz = towardCorridor * roomD / 2
			P(m, "RoomWall", Vector3.new(8, h, 0.6), rbase * CFrame.new(-7, h / 2, wz), { 230, 225, 215 }, Enum.Material.Plaster)
			P(m, "RoomWall", Vector3.new(8, h, 0.6), rbase * CFrame.new(7, h / 2, wz), { 230, 225, 215 }, Enum.Material.Plaster)
			P(m, "RoomWall", Vector3.new(6, h - 8, 0.6), rbase * CFrame.new(0, 8 + (h - 8) / 2, wz), { 230, 225, 215 }, Enum.Material.Plaster)
			local plate = P(m, "DoorSign", Vector3.new(6, 1.4, 0.2), rbase * CFrame.new(0, 9.2, wz + towardCorridor * 0.45), { 30, 30, 36 })
			local face = (towardCorridor > 0) and Enum.NormalId.Back or Enum.NormalId.Front
			local label = sign(plate, face, "Hab. " .. index .. " · Libre", nil, Color3.new(1, 1, 1), Enum.Font.GothamBold)
			-- alfombra, cama, ventana, luz, vestidor
			local inward = -towardCorridor
			P(m, "Rug", Vector3.new(10, 0.1, 8), rbase * CFrame.new(0, 0.65, 0), { 140 + (index * 13) % 80, 90, 110 }, Enum.Material.Fabric, { NoCollide = true })
			local bed = P(m, "Bed", Vector3.new(6, 1.6, 9), rbase * CFrame.new(-7, 1.4, inward * 4), { 250, 250, 255 }, Enum.Material.Fabric)
			prompt(bed, "rest", "Descansar", "Cama")
			P(m, "BedFrame", Vector3.new(6.4, 1, 9.4), rbase * CFrame.new(-7, 0.9, inward * 4), { 110, 80, 60 }, Enum.Material.Wood)
			P(m, "Pillow", Vector3.new(4, 0.6, 1.6), rbase * CFrame.new(-7, 2.4, inward * 7.6), { 255, 255, 255 }, Enum.Material.Fabric)
			local lamp = P(m, "RoomLamp", Vector3.new(3, 0.3, 3), rbase * CFrame.new(0, h - 0.3, 0), { 255, 245, 220 }, Enum.Material.Neon, { NoShadow = true })
			local pl = Instance.new("PointLight")
			pl.Range = 18
			pl.Brightness = 1
			pl.Parent = lamp
			local win = P(m, "Window", Vector3.new(8, 4, 0.3), rbase * CFrame.new(0, 6.5, inward * (roomD / 2) + inward * -0.2), { 180, 220, 255 }, Enum.Material.Glass, { Transparency = 0.4 })
			win.CanCollide = true
			local wardrobe = P(m, "Wardrobe", Vector3.new(2, 8, 5), rbase * CFrame.new(roomW / 2 - 1.6, 4, inward * -4), { 160, 120, 90 }, Enum.Material.WoodPlanks)
			local wp = prompt(wardrobe, "wardrobe", "Vestidor", "Cambiar estilo", { Owner = 0 })
			local fridge = P(m, "Fridge", Vector3.new(3, 6, 3), rbase * CFrame.new(roomW / 2 - 2, 3, inward * 6), { 230, 235, 240 }, Enum.Material.Metal)
			prompt(fridge, "cook", "Cocinar", "Cocina")
			-- Escritorio: los muebles visibles los dibuja HomeService según el inventario
			local deskCF = rbase * CFrame.new(5, 3.4, inward * (roomD / 2 - 3)) * CFrame.Angles(0, (inward > 0) and 0 or math.pi, 0)
			local anchor = P(m, "DeskAnchor", Vector3.new(8, 4, 4), deskCF * CFrame.new(0, -1.5, 0), { 0, 0, 0 }, Enum.Material.SmoothPlastic, { Transparency = 1, NoCollide = true })
			anchor.CanQuery = false
			local dp = prompt(anchor, "computer_home", "Usar computador", "Tu escritorio", { Owner = 0 })
			local dynamic = folder(m, "Room" .. index .. "Furniture")
			table.insert(World.HomeRooms, {
				Index = index,
				Center = (rbase * CFrame.new(0, 1, 0)).Position,
				Size = Vector3.new(roomW, h, roomD),
				DeskCFrame = deskCF,
				Dynamic = dynamic,
				Sign = label,
				DeskPrompt = dp,
				Wardrobe = wp,
			})
		end
	end
	-- Marcador para la flecha del tutorial
	World.HomePosition = Vector3.new(sp.WX + totalW / 2 + 6, GROUND_TOP + 3, sp.WZ)
end

local function buildVipLounge(parent, cx, cz)
	local m = model(parent, "SalaVIP")
	-- La sala está elevada y cerrada: solo se entra con el aviso de la puerta.
	local center = Vector3.new(cx, -60, cz) -- bajo tierra: invisible desde la ciudad
	local base = CFrame.new(center)
	local w, d, h = 40, 30, 12
	P(m, "Floor", Vector3.new(w, 1, d), base, { 30, 20, 40 }, Enum.Material.Marble)
	P(m, "Ceiling", Vector3.new(w, 1, d), base * CFrame.new(0, h, 0), { 20, 15, 30 }, Enum.Material.Marble)
	for _, wall in ipairs({ { 0, -d / 2, w, 1 }, { 0, d / 2, w, 1 }, { -w / 2, 0, 1, d }, { w / 2, 0, 1, d } }) do
		P(m, "Wall", Vector3.new(wall[3], h, wall[4]), base * CFrame.new(wall[1], h / 2, wall[2]), { 60, 30, 80 }, Enum.Material.Fabric)
	end
	P(m, "Sofa", Vector3.new(14, 2, 4), base * CFrame.new(0, 1.5, -10), { 200, 160, 60 }, Enum.Material.Fabric)
	local neon = P(m, "Neon", Vector3.new(w - 2, 0.4, 0.4), base * CFrame.new(0, h - 1, -d / 2 + 0.8), { 255, 200, 80 }, Enum.Material.Neon, { NoShadow = true })
	local l = Instance.new("PointLight")
	l.Range = 40
	l.Color = Color3.fromRGB(255, 200, 120)
	l.Parent = neon
	local exit = P(m, "ExitDoor", Vector3.new(6, 9, 0.5), base * CFrame.new(0, 5, d / 2 - 0.6), { 40, 40, 44 }, Enum.Material.Metal)
	prompt(exit, "vip_exit", "Salir", "Sala VIP")
	local door = P(m, "VipDoor", Vector3.new(8, 10, 1), Vector3.new(cx, GROUND_TOP + 5, cz + 20), { 20, 20, 24 }, Enum.Material.Metal)
	local s = P(m, "VipSign", Vector3.new(8, 2, 0.4), Vector3.new(cx, GROUND_TOP + 11, cz + 20.6), { 20, 20, 24 })
	signBoth(s, "⭐ SALA VIP", nil, Color3.fromRGB(255, 214, 0))
	prompt(door, "vip_enter", "Entrar", "Sala VIP (Game Pass VIP)")
	World.VipLounge = { Center = center + Vector3.new(0, 3, 0), Size = Vector3.new(w, h, d), Entry = Vector3.new(cx, GROUND_TOP + 3, cz + 26) }
end

-- Cartel de una propiedad en venta / alquiler
local function buildPropertySign(parent, l)
	local pos = S.Property.signPosition(l)
	P(parent, "PropertyPost", Vector3.new(0.5, 7, 0.5), Vector3.new(pos.X, GROUND_TOP + 3.5, pos.Z), { 240, 240, 240 }, Enum.Material.Metal)
	local board = P(parent, "PropertySign", Vector3.new(10, 5, 0.4), Vector3.new(pos.X, GROUND_TOP + 7.5, pos.Z), { 255, 255, 255 })
	local price = {}
	if l.Rent then
		price[#price + 1] = "Alquiler $" .. Util.formatInt(l.Rent) .. "/sem"
	end
	if l.Buy then
		price[#price + 1] = "Venta $" .. Util.formatInt(l.Buy)
	end
	local text = "🏠 " .. l.Type:upper() .. "\n" .. table.concat(price, " · ")
	sign(board, Enum.NormalId.Back, text, Color3.fromRGB(20, 110, 70), Color3.new(1, 1, 1), Enum.Font.GothamBold)
	signBoth(board, text, Color3.fromRGB(20, 110, 70), Color3.new(1, 1, 1), Enum.Font.GothamBold)
	local base = P(parent, "PropertyDoor", Vector3.new(6, 8, 1), Vector3.new(pos.X, GROUND_TOP + 4, pos.Z - 4), { 90, 60, 40 }, Enum.Material.Wood)
	prompt(base, "prop_view", "Ver anuncio", l.Name, { PropId = l.Id })
	local enter = prompt(base, "prop_enter", "Entrar", l.Name, { PropId = l.Id })
	enter.KeyboardKeyCode = Enum.KeyCode.G
end

---------------------------------------------------------------------------
-- Aeropuerto (Terminal Internacional) y destinos de viaje (lejos de la ciudad)
---------------------------------------------------------------------------

-- Marcador 🎥 de un lugar de grabación (igual que los de la ciudad)
local function recordMarker(parent, x, z, name)
	local marker = P(parent, "RecordSpot", Vector3.new(0.3, 10, 10), CFrame.new(x, GROUND_TOP + 0.2, z) * CFrame.Angles(0, 0, math.rad(90)),
		{ 255, 50, 90 }, Enum.Material.Neon, { Shape = Enum.PartType.Cylinder, NoCollide = true, Transparency = 0.45, NoShadow = true })
	marker.CanQuery = false
	CollectionService:AddTag(marker, "RecordSpot")
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(220, 40)
	bb.StudsOffset = Vector3.new(0, 7, 0)
	bb.MaxDistance = 160
	bb.Parent = marker
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
	t.BackgroundTransparency = 0.25
	t.TextColor3 = Color3.new(1, 1, 1)
	t.Font = Enum.Font.GothamBold
	t.TextScaled = true
	t.Text = "🎥 " .. name
	t.Parent = bb
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = t
	return marker
end

local function buildAirport(parent, sp)
	local m = model(parent, "TerminalInternacional")
	local w, d, h = 56, 34, 16
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 225, 230, 238 }, { 205, 210, 218 })
	local board = P(m, "TerminalSign", Vector3.new(30, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 1.2), { 20, 40, 80 })
	signBoth(board, "✈ " .. sp.Name, Color3.fromRGB(20, 40, 80), Color3.new(1, 1, 1))
	-- Mostrador de facturación
	local counter = P(m, "CheckInCounter", Vector3.new(22, 4, 3), base * CFrame.new(0, 2, -d / 2 + 8), { 60, 70, 90 }, Enum.Material.Metal)
	P(m, "CounterTop", Vector3.new(22.4, 0.4, 3.4), base * CFrame.new(0, 4.2, -d / 2 + 8), { 235, 235, 240 }, Enum.Material.Marble)
	prompt(counter, "airport", "Ver vuelos", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 4)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Agente de viajes", Role = "travel" })
	-- Panel de salidas con todos los destinos
	local names = {}
	for _, dest in ipairs(LifeData.Destinations) do
		names[#names + 1] = "✈ " .. dest.Name .. "  $" .. Util.formatInt(dest.Cost)
	end
	local screen = P(m, "DeparturesBoard", Vector3.new(26, 9, 0.4), base * CFrame.new(0, 9.5, -d / 2 + 1), { 10, 14, 30 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(screen, "SALIDAS\n" .. table.concat(names, "\n"), Color3.fromRGB(10, 14, 30), Color3.fromRGB(255, 214, 80), Enum.Font.Code)
	-- Asientos de espera (pasillo central libre)
	for _, sx in ipairs({ -1, 1 }) do
		for row = 0, 1 do
			for i = 0, 2 do
				P(m, "Seat", Vector3.new(3, 1.2, 3), base * CFrame.new(sx * (10 + i * 4), 1.6, 5 + row * 6), { 40, 90, 160 }, Enum.Material.Fabric)
				P(m, "SeatBack", Vector3.new(3, 2, 0.4), base * CFrame.new(sx * (10 + i * 4), 2.8, 6.3 + row * 6), { 40, 90, 160 }, Enum.Material.Fabric)
			end
		end
	end
	-- Torre de control en el tejado
	P(m, "ControlTower", Vector3.new(4, 10, 4), base * CFrame.new(w / 2 - 6, h + 5, -d / 2 + 6), { 200, 205, 215 }, Enum.Material.Concrete)
	local cab = P(m, "ControlCab", Vector3.new(8, 4, 8), base * CFrame.new(w / 2 - 6, h + 12, -d / 2 + 6), { 120, 180, 220 }, Enum.Material.Glass, { Transparency = 0.3 })
	nightLight(cab, 30, Color3.fromRGB(120, 200, 255))
end

-- Edificio abierto por delante (+Z local): suelo, paredes trasera y laterales, techo y luz
local function destBooth(parent, cf, w, d, h, wallColor, floorColor)
	P(parent, "Floor", Vector3.new(w, 0.6, d), cf * CFrame.new(0, 0.3, 0), floorColor, Enum.Material.WoodPlanks)
	P(parent, "WallBack", Vector3.new(w, h, 1), cf * CFrame.new(0, h / 2, -d / 2), wallColor, Enum.Material.Concrete)
	P(parent, "WallSide", Vector3.new(1, h, d), cf * CFrame.new(-w / 2, h / 2, 0), wallColor, Enum.Material.Concrete)
	P(parent, "WallSide", Vector3.new(1, h, d), cf * CFrame.new(w / 2, h / 2, 0), wallColor, Enum.Material.Concrete)
	P(parent, "Roof", Vector3.new(w + 2, 1, d + 2), cf * CFrame.new(0, h + 0.5, 0), { 60, 60, 66 }, Enum.Material.Concrete)
	local lamp = P(parent, "CeilingLamp", Vector3.new(4, 0.4, 4), cf * CFrame.new(0, h - 0.3, 0), { 255, 250, 230 }, Enum.Material.Neon, { NoShadow = true })
	local l = Instance.new("PointLight")
	l.Range = 30
	l.Brightness = 1.2
	l.Parent = lamp
end

local function palm(parent, x, z, h, rng)
	local lean = math.rad(rng:NextInteger(-8, 8))
	P(parent, "PalmTrunk", Vector3.new(h, 1.4, 1.4), CFrame.new(x, GROUND_TOP + h / 2, z) * CFrame.Angles(lean, 0, math.rad(90)), { 150, 110, 70 }, Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2
		P(parent, "PalmFrond", Vector3.new(9, 0.4, 2.4), CFrame.new(x, GROUND_TOP + h + 0.5, z) * CFrame.Angles(0, a, 0) * CFrame.new(4, 0, 0) * CFrame.Angles(0, 0, math.rad(-18)),
			{ 60, 150, 70 }, Enum.Material.Grass)
	end
	for i = 1, 3 do
		P(parent, "Coconut", Vector3.new(1.1, 1.1, 1.1), Vector3.new(x + math.cos(i * 2.1), GROUND_TOP + h - 0.6, z + math.sin(i * 2.1)), { 110, 80, 40 }, Enum.Material.Wood, { Shape = Enum.PartType.Ball })
	end
end

local function pine(parent, x, z, s, snow)
	P(parent, "PineTrunk", Vector3.new(6 * s, 1.4 * s, 1.4 * s), CFrame.new(x, GROUND_TOP + 3 * s, z) * CFrame.Angles(0, 0, math.rad(90)), { 100, 70, 45 }, Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	for i = 0, 2 do
		local r = (9 - i * 2.5) * s
		P(parent, "PineLeaves", Vector3.new(r, r * 0.8, r), Vector3.new(x, GROUND_TOP + (7 + i * 4.5) * s, z), { 40, 95, 60 }, Enum.Material.Grass, { Shape = Enum.PartType.Ball })
	end
	if snow then
		P(parent, "SnowCap", Vector3.new(3 * s, 2 * s, 3 * s), Vector3.new(x, GROUND_TOP + 18.5 * s, z), { 250, 252, 255 }, Enum.Material.Snow, { Shape = Enum.PartType.Ball })
	end
end

-- Cable recto entre dos puntos (telesilla, guirnaldas)
local function cable(parent, a, b, thickness, color, material)
	local dx, dy, dz = b.X - a.X, b.Y - a.Y, b.Z - a.Z
	local len = math.sqrt(dx * dx + dy * dy + dz * dz)
	local yaw = math.atan2(dx, dz)
	local pitch = -math.asin(dy / len)
	local mid = Vector3.new((a.X + b.X) / 2, (a.Y + b.Y) / 2, (a.Z + b.Z) / 2)
	return P(parent, "Cable", Vector3.new(thickness, thickness, len), CFrame.new(mid) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(pitch, 0, 0), color, material or Enum.Material.Metal, { NoShadow = true })
end

local destThemes = {}

destThemes.island = function(m, dest, cx, cz, rng, free, block)
	-- Mar alrededor de la isla y laguna del arrecife junto a la playa
	workspace.Terrain:FillBlock(CFrame.new(cx, -4, cz), Vector3.new(820, 8, 820), Enum.Material.Water)
	workspace.Terrain:FillBlock(CFrame.new(cx, GROUND_TOP + 1, cz + 90), Vector3.new(110, 4, 28), Enum.Material.Water)
	block(cx - 30, cz + 90, 26)
	block(cx + 30, cz + 90, 26)
	for _, c in ipairs({ { -20, 86, { 255, 120, 120 } }, { 15, 94, { 255, 200, 80 } }, { 35, 84, { 200, 120, 255 } } }) do
		P(m, "Coral", Vector3.new(3, 3, 3), Vector3.new(cx + c[1], GROUND_TOP + 0.8, cz + c[2]), c[3], Enum.Material.Pebble, { Shape = Enum.PartType.Ball })
	end
	-- Playa: sombrillas y toallas
	for i, p in ipairs({ { -24, 48 }, { 22, 46 }, { 34, 70 }, { -30, 72 } }) do
		local x, z = cx + p[1], cz + p[2]
		P(m, "UmbrellaPole", Vector3.new(0.4, 8, 0.4), Vector3.new(x, GROUND_TOP + 4, z), { 240, 240, 240 }, Enum.Material.Metal)
		P(m, "Umbrella", Vector3.new(0.6, 10, 10), CFrame.new(x, GROUND_TOP + 8, z) * CFrame.Angles(0, 0, math.rad(90)), i % 2 == 0 and { 255, 90, 90 } or { 60, 180, 230 }, Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
		P(m, "Towel", Vector3.new(3, 0.1, 6), Vector3.new(x + 4, GROUND_TOP + 0.15, z), i % 2 == 0 and { 255, 220, 80 } or { 255, 140, 200 }, Enum.Material.Fabric, { NoCollide = true })
	end
	-- Muelle del pueblo pesquero, barcas y casas
	P(m, "Pier", Vector3.new(44, 1, 8), Vector3.new(cx - 120, GROUND_TOP + 1, cz - 40), { 130, 95, 65 }, Enum.Material.WoodPlanks)
	for _, b in ipairs({ { -150, -55 }, { -150, -25 } }) do
		P(m, "Boat", Vector3.new(14, 2.4, 5), Vector3.new(cx + b[1], GROUND_TOP + 1.2, cz + b[2]), { 240, 240, 245 }, Enum.Material.Wood)
		P(m, "BoatStripe", Vector3.new(14.2, 0.6, 5.2), Vector3.new(cx + b[1], GROUND_TOP + 1.8, cz + b[2]), { 30, 110, 200 }, Enum.Material.SmoothPlastic)
	end
	local village = { Palette = { { 250, 245, 230 }, { 120, 200, 220 }, { 255, 200, 150 } } }
	for _, hpos in ipairs({ { -150, -110 }, { -110, -140 }, { -160, 30 }, { -60, -150 } }) do
		if free(cx + hpos[1], cz + hpos[2], 14) then
			styleBuilders.house(m, cx + hpos[1], cz + hpos[2], village, rng)
			block(cx + hpos[1], cz + hpos[2], 18)
		end
	end
	-- Mirador: colina con una palmera gigante
	P(m, "Hill", Vector3.new(70, 40, 70), Vector3.new(cx + 150, GROUND_TOP - 10, cz - 120), { 200, 185, 130 }, Enum.Material.Sand, { Shape = Enum.PartType.Ball })
	block(cx + 150, cz - 120, 38)
	palm(m, cx + 104, cz - 84, 30, rng)
	for _ = 1, 60 do
		local x, z = cx + rng:NextInteger(-195, 195), cz + rng:NextInteger(-195, 195)
		if free(x, z, 6) then
			palm(m, x, z, rng:NextInteger(14, 22), rng)
			block(x, z, 10)
		end
	end
end

destThemes.neo = function(m, dest, cx, cz, rng, free, block)
	local neon = { { 0, 220, 255 }, { 255, 40, 200 }, { 140, 80, 255 }, { 60, 255, 160 } }
	-- Rejilla luminosa en el suelo
	for i = -3, 3 do
		P(m, "GridLine", Vector3.new(0.6, 0.1, 400), Vector3.new(cx + i * 60, GROUND_TOP + 0.12, cz), neon[1], Enum.Material.Neon, { NoCollide = true, NoShadow = true })
		P(m, "GridLine", Vector3.new(400, 0.1, 0.6), Vector3.new(cx, GROUND_TOP + 0.12, cz + i * 60), neon[2], Enum.Material.Neon, { NoCollide = true, NoShadow = true })
	end
	-- Avenida de hologramas: columnas holográficas
	for _, sx in ipairs({ -26, 26 }) do
		for k = -2, 2 do
			local col = P(m, "HoloPillar", Vector3.new(14, 3, 3), CFrame.new(cx + sx, GROUND_TOP + 7, cz + k * 26) * CFrame.Angles(0, 0, math.rad(90)),
				neon[(k + 3) % #neon + 1], Enum.Material.Neon, { Shape = Enum.PartType.Cylinder, Transparency = 0.35, NoShadow = true })
			col.CanCollide = false
		end
	end
	-- Torre de datos
	local tx, tz = cx + 125, cz - 100
	P(m, "DataTower", Vector3.new(30, 200, 30), Vector3.new(tx, GROUND_TOP + 100, tz), { 25, 25, 40 }, Enum.Material.Glass)
	for i = 1, 8 do
		P(m, "DataBand", Vector3.new(31, 1.2, 31), Vector3.new(tx, GROUND_TOP + i * 24, tz), neon[i % #neon + 1], Enum.Material.Neon, { NoShadow = true })
	end
	P(m, "Antenna", Vector3.new(1, 40, 1), Vector3.new(tx, GROUND_TOP + 220, tz), { 200, 200, 210 }, Enum.Material.Metal)
	block(tx, tz, 26)
	-- Mercado robótico: puestos con toldos de neón
	for i, s in ipairs({ { -110, 40 }, { -95, 80 }, { -40, 80 }, { -45, 35 } }) do
		local x, z = cx + s[1], cz + s[2]
		if free(x, z, 6) then
			P(m, "Stall", Vector3.new(10, 4, 6), Vector3.new(x, GROUND_TOP + 2, z), { 50, 50, 70 }, Enum.Material.Metal)
			P(m, "StallAwning", Vector3.new(11, 0.4, 7), Vector3.new(x, GROUND_TOP + 7, z), neon[i % #neon + 1], Enum.Material.Neon, { NoShadow = true })
			block(x, z, 8)
		end
	end
	-- Robots
	for _ = 1, 10 do
		local x, z = cx + rng:NextInteger(-150, 150), cz + rng:NextInteger(-150, 150)
		if free(x, z, 3) then
			P(m, "RobotBody", Vector3.new(2, 3, 1.4), Vector3.new(x, GROUND_TOP + 2.5, z), { 200, 205, 215 }, Enum.Material.Metal)
			P(m, "RobotHead", Vector3.new(1.6, 1.6, 1.6), Vector3.new(x, GROUND_TOP + 4.8, z), { 220, 225, 235 }, Enum.Material.Metal, { Shape = Enum.PartType.Ball })
			P(m, "RobotEye", Vector3.new(1.2, 0.3, 0.2), Vector3.new(x, GROUND_TOP + 5, z + 0.75), neon[1], Enum.Material.Neon, { NoShadow = true })
			block(x, z, 4)
		end
	end
	-- Rascacielos con franjas de neón y pantallas
	local screens = { "NEO 2099", "HOLOGRAMAS 24 h", "ROBÓTICA ORBIS", "NEO STORE", "VIAJA AL FUTURO" }
	local placed = 0
	for _ = 1, 80 do
		if placed >= 12 then
			break
		end
		local x, z = cx + rng:NextInteger(-185, 185), cz + rng:NextInteger(-185, 185)
		if free(x, z, 18) then
			local h = rng:NextInteger(70, 170)
			local w = rng:NextInteger(22, 32)
			P(m, "NeoTower", Vector3.new(w, h, w), Vector3.new(x, GROUND_TOP + h / 2, z), { 30 + rng:NextInteger(0, 20), 30, 50 }, Enum.Material.Glass)
			local c = neon[rng:NextInteger(1, #neon)]
			for k = 1, 4 do
				P(m, "NeonStrip", Vector3.new(w + 0.6, 0.8, w + 0.6), Vector3.new(x, GROUND_TOP + h * k / 5, z), c, Enum.Material.Neon, { NoShadow = true })
			end
			if placed < #screens then
				local scr = P(m, "HoloScreen", Vector3.new(w - 4, 10, 0.4), Vector3.new(x, GROUND_TOP + h * 0.5, z + w / 2 + 0.6), { 10, 10, 20 }, Enum.Material.Neon, { NoShadow = true })
				signBoth(scr, screens[placed + 1], Color3.fromRGB(10, 10, 30), rgb(c))
			end
			block(x, z, w * 0.8)
			placed = placed + 1
		end
	end
	-- Coches voladores (decoración)
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2
		P(m, "HoverCar", Vector3.new(5, 2, 10), CFrame.new(cx + math.cos(a) * 90, GROUND_TOP + 30 + i * 4, cz + math.sin(a) * 90) * CFrame.Angles(0, a, 0), neon[i % #neon + 1], Enum.Material.SmoothPlastic, { NoShadow = true })
	end
end

destThemes.ski = function(m, dest, cx, cz, rng, free, block)
	-- Pista principal: rampa nevada que baja hacia el lugar 🎥
	P(m, "SkiSlope", Vector3.new(60, 40, 160), Vector3.new(cx, GROUND_TOP + 20, cz - 60), { 245, 248, 255 }, Enum.Material.Snow, { Class = "WedgePart" })
	for i = -2, 2 do
		if i ~= 0 then
			P(m, "SlalomFlag", Vector3.new(0.3, 4, 0.3), Vector3.new(cx + i * 9, GROUND_TOP + 2, cz + 24), { 220, 40, 40 }, Enum.Material.SmoothPlastic)
		end
	end
	for z = -130, 10, 20 do
		block(cx, cz + z, 34)
	end
	-- Colinas nevadas alrededor
	for i = 1, 14 do
		local a = i / 14 * math.pi * 2
		local x, z = cx + math.cos(a) * 205, cz + math.sin(a) * 205
		local s = rng:NextInteger(60, 110)
		if math.sin(a) < 0.3 and free(x, z, s * 0.35) then
			P(m, "SnowHill", Vector3.new(s, s * 0.7, s), Vector3.new(x, GROUND_TOP - s * 0.1, z), { 245, 248, 255 }, Enum.Material.Snow, { Shape = Enum.PartType.Ball })
		end
	end
	-- Refugio de montaña
	local cabinStyle = { Palette = { { 120, 80, 50 }, { 150, 100, 60 } } }
	styleBuilders.cabin(m, cx - 100, cz - 80, cabinStyle, rng)
	P(m, "Chimney", Vector3.new(2, 6, 2), Vector3.new(cx - 95, GROUND_TOP + 14, cz - 80), { 120, 110, 100 }, Enum.Material.Brick)
	block(cx - 100, cz - 80, 14)
	-- Telesilla: estación, torres, cable y sillas
	local stations = { Vector3.new(cx + 100, GROUND_TOP + 14, cz - 70), Vector3.new(cx + 125, GROUND_TOP + 22, cz - 105), Vector3.new(cx + 150, GROUND_TOP + 30, cz - 140), Vector3.new(cx + 175, GROUND_TOP + 38, cz - 175) }
	P(m, "LiftStation", Vector3.new(12, 8, 10), Vector3.new(cx + 96, GROUND_TOP + 4, cz - 62), { 200, 60, 50 }, Enum.Material.WoodPlanks)
	for i, top in ipairs(stations) do
		P(m, "LiftTower", Vector3.new(1.4, top.Y - GROUND_TOP, 1.4), Vector3.new(top.X, (top.Y + GROUND_TOP) / 2, top.Z), { 90, 90, 100 }, Enum.Material.Metal)
		P(m, "LiftArm", Vector3.new(6, 0.8, 0.8), CFrame.new(top) * CFrame.Angles(0, math.rad(-35), 0), { 90, 90, 100 }, Enum.Material.Metal)
		block(top.X, top.Z, 6)
		if i > 1 then
			local a = stations[i - 1]
			cable(m, a, top, 0.3, { 40, 40, 44 })
			local mid = Vector3.new((a.X + top.X) / 2, (a.Y + top.Y) / 2 - 3, (a.Z + top.Z) / 2)
			P(m, "ChairHanger", Vector3.new(0.2, 3, 0.2), mid + Vector3.new(0, 1.5, 0), { 40, 40, 44 }, Enum.Material.Metal)
			P(m, "Chair", Vector3.new(4, 0.5, 2), mid, { 30, 90, 200 }, Enum.Material.SmoothPlastic)
		end
	end
	-- Cabañas, pinos nevados y muñecos de nieve
	local placed = 0
	for _ = 1, 40 do
		if placed >= 5 then
			break
		end
		local x, z = cx + rng:NextInteger(-170, 170), cz + rng:NextInteger(-170, 170)
		if free(x, z, 14) then
			styleBuilders.cabin(m, x, z, cabinStyle, rng)
			block(x, z, 16)
			placed = placed + 1
		end
	end
	for _ = 1, 70 do
		local x, z = cx + rng:NextInteger(-185, 185), cz + rng:NextInteger(-185, 185)
		if free(x, z, 5) then
			pine(m, x, z, 0.8 + rng:NextNumber() * 0.6, true)
			block(x, z, 8)
		end
	end
	for _, s in ipairs({ { -30, 70 }, { 40, 80 }, { -60, 10 } }) do
		local x, z = cx + s[1], cz + s[2]
		if free(x, z, 2) then
			P(m, "SnowmanBase", Vector3.new(4, 4, 4), Vector3.new(x, GROUND_TOP + 2, z), { 250, 252, 255 }, Enum.Material.Snow, { Shape = Enum.PartType.Ball })
			P(m, "SnowmanHead", Vector3.new(2.6, 2.6, 2.6), Vector3.new(x, GROUND_TOP + 5, z), { 250, 252, 255 }, Enum.Material.Snow, { Shape = Enum.PartType.Ball })
			P(m, "SnowmanNose", Vector3.new(0.3, 0.3, 1.2), Vector3.new(x, GROUND_TOP + 5, z + 1.5), { 255, 140, 40 }, Enum.Material.SmoothPlastic)
		end
	end
end

destThemes.expo = function(m, dest, cx, cz, rng, free, block)
	-- Pabellón principal: gran cubierta con columnas, pantalla gigante y stands de marcas ficticias
	P(m, "HallFloor", Vector3.new(130, 0.4, 90), Vector3.new(cx, GROUND_TOP + 0.2, cz - 10), { 235, 238, 245 }, Enum.Material.Marble)
	for _, x in ipairs({ -64, -32, 0, 32, 64 }) do
		for _, z in ipairs({ -54, 34 }) do
			P(m, "HallColumn", Vector3.new(2, 26, 2), Vector3.new(cx + x, GROUND_TOP + 13, cz + z), { 200, 205, 215 }, Enum.Material.Metal)
		end
	end
	P(m, "HallRoof", Vector3.new(134, 1.5, 94), Vector3.new(cx, GROUND_TOP + 26.5, cz - 10), { 230, 235, 245 }, Enum.Material.Glass, { Transparency = 0.4 })
	local screen = P(m, "MainScreen", Vector3.new(60, 18, 0.6), Vector3.new(cx, GROUND_TOP + 14, cz - 53), { 20, 40, 90 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(screen, "FERIA TECNOLÓGICA INTERNACIONAL", Color3.fromRGB(10, 20, 60), Color3.fromRGB(120, 220, 255))
	local brands = { "Nexo", "Kairo", "Zenit", "Lumina", "Orbis", "Stratos", "Pixelia", "Ferro" }
	local i = 0
	for _, z in ipairs({ -36, 20 }) do
		for _, x in ipairs({ -50, -25, 25, 50 }) do
			i = i + 1
			local bx, bz = cx + x, cz + z
			P(m, "Stand", Vector3.new(16, 0.6, 12), Vector3.new(bx, GROUND_TOP + 0.7, bz), { 40, 45, 60 }, Enum.Material.SmoothPlastic)
			P(m, "StandDesk", Vector3.new(8, 3.5, 2.5), Vector3.new(bx, GROUND_TOP + 2.75, bz + 3), { 250, 250, 252 }, Enum.Material.SmoothPlastic)
			local panel = P(m, "StandPanel", Vector3.new(14, 7, 0.4), Vector3.new(bx, GROUND_TOP + 5, bz - 5.5), { 30, 30, 40 }, Enum.Material.Neon, { NoShadow = true })
			signBoth(panel, brands[i], Color3.fromRGB(20 + i * 20, 30, 80), Color3.new(1, 1, 1))
			P(m, "StandGadget", Vector3.new(1.4, 1.4, 1.4), Vector3.new(bx, GROUND_TOP + 5.2, bz + 3), { 255, 214, 0 }, Enum.Material.Neon, { Shape = Enum.PartType.Ball, NoShadow = true })
			block(bx, bz, 10)
		end
	end
	-- Zona de prototipos: vitrinas brillantes en círculo
	for k = 1, 6 do
		local a = k / 6 * math.pi * 2
		local x, z = cx + 70 + math.cos(a) * 16, cz + 60 + math.sin(a) * 16
		P(m, "ProtoPedestal", Vector3.new(3, 3, 3), Vector3.new(x, GROUND_TOP + 1.5, z), { 250, 250, 252 }, Enum.Material.Marble)
		P(m, "ProtoGlass", Vector3.new(3, 3, 3), Vector3.new(x, GROUND_TOP + 4.5, z), { 200, 230, 255 }, Enum.Material.Glass, { Transparency = 0.6 })
		P(m, "ProtoItem", Vector3.new(1.2, 1.2, 1.2), Vector3.new(x, GROUND_TOP + 4.2, z), ({ { 0, 220, 255 }, { 255, 40, 200 }, { 60, 255, 160 } })[k % 3 + 1], Enum.Material.Neon, { NoShadow = true })
	end
	-- Banderas de países ficticios en la entrada
	for k = -3, 3 do
		local x, z = cx + k * 14, cz + 75
		if free(x, z, 1) then
			P(m, "FlagPole", Vector3.new(0.4, 14, 0.4), Vector3.new(x, GROUND_TOP + 7, z), { 220, 220, 225 }, Enum.Material.Metal)
			P(m, "Flag", Vector3.new(4, 2.6, 0.1), Vector3.new(x + 2, GROUND_TOP + 12.5, z), ({ { 220, 40, 40 }, { 40, 120, 220 }, { 250, 200, 40 }, { 60, 170, 90 } })[(k + 4) % 4 + 1], Enum.Material.Fabric)
		end
	end
	-- Jardines y bancos alrededor
	for _ = 1, 30 do
		local x, z = cx + rng:NextInteger(-190, 190), cz + rng:NextInteger(-190, 190)
		if free(x, z, 6) and (math.abs(x - cx) > 70 or math.abs(z - cz + 10) > 50) then
			tree(m, x, z, 0.8, rng)
			block(x, z, 9)
		end
	end
end

destThemes.valley = function(m, dest, cx, cz, rng, free, block)
	-- Lago del valle con orilla y embarcadero
	local lx, lz, lw, ld = cx + 140, cz - 30, 100, 90
	workspace.Terrain:FillBlock(CFrame.new(lx, GROUND_TOP + 1, lz), Vector3.new(lw, 4, ld), Enum.Material.Water)
	P(m, "Shore", Vector3.new(lw + 4, 2.4, 2), Vector3.new(lx, GROUND_TOP + 1.2, lz - ld / 2 - 1), { 120, 110, 100 }, Enum.Material.Slate)
	P(m, "Shore", Vector3.new(lw + 4, 2.4, 2), Vector3.new(lx, GROUND_TOP + 1.2, lz + ld / 2 + 1), { 120, 110, 100 }, Enum.Material.Slate)
	P(m, "Shore", Vector3.new(2, 2.4, ld), Vector3.new(lx - lw / 2 - 1, GROUND_TOP + 1.2, lz), { 120, 110, 100 }, Enum.Material.Slate)
	P(m, "Shore", Vector3.new(2, 2.4, ld), Vector3.new(lx + lw / 2 + 1, GROUND_TOP + 1.2, lz), { 120, 110, 100 }, Enum.Material.Slate)
	P(m, "Pier", Vector3.new(30, 1, 6), Vector3.new(lx - lw / 2 + 14, GROUND_TOP + 2.6, cz - 20), { 130, 95, 65 }, Enum.Material.WoodPlanks)
	block(lx, lz, 62)
	-- Cascada esmeralda: acantilado, caída de agua y poza
	P(m, "Cliff", Vector3.new(70, 50, 22), Vector3.new(cx - 60, GROUND_TOP + 25, cz - 117), { 110, 105, 95 }, Enum.Material.Slate)
	local fall = P(m, "Waterfall", Vector3.new(14, 46, 1), Vector3.new(cx - 60, GROUND_TOP + 24, cz - 105.6), { 120, 200, 255 }, Enum.Material.Glass, { Transparency = 0.35, NoCollide = true, NoShadow = true })
	fall.CanQuery = false
	workspace.Terrain:FillBlock(CFrame.new(cx - 60, GROUND_TOP + 1, cz - 92), Vector3.new(36, 4, 22), Enum.Material.Water)
	block(cx - 60, cz - 105, 40)
	-- Sendero de las secuoyas gigantes
	for _, sx in ipairs({ -26, 26 }) do
		for _, z in ipairs({ -10, 15, 65, 90 }) do
			local x, zz = cx + sx, cz + z
			local h = rng:NextInteger(40, 55)
			P(m, "SequoiaTrunk", Vector3.new(h, 4.5, 4.5), CFrame.new(x, GROUND_TOP + h / 2, zz) * CFrame.Angles(0, 0, math.rad(90)), { 140, 70, 45 }, Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
			P(m, "SequoiaLeaves", Vector3.new(18, 22, 18), Vector3.new(x, GROUND_TOP + h + 4, zz), { 40, 110, 55 }, Enum.Material.Grass, { Shape = Enum.PartType.Ball })
			block(x, zz, 8)
		end
	end
	-- Montañas en el horizonte
	for i = 1, 10 do
		local a = i / 10 * math.pi * 2
		local s = rng:NextInteger(90, 140)
		local x, z = cx + math.cos(a) * 215, cz + math.sin(a) * 215
		if math.sin(a) < 0.3 and free(x, z, s * 0.35) then
			P(m, "Mountain", Vector3.new(s, s, s), Vector3.new(x, GROUND_TOP - s * 0.15, z), { 100, 120, 90 }, Enum.Material.Rock, { Shape = Enum.PartType.Ball })
		end
	end
	-- Señal de los guardas, rocas y bosque
	local ranger = P(m, "RangerSign", Vector3.new(12, 4, 0.4), Vector3.new(cx + 30, GROUND_TOP + 5, cz + 110), { 90, 60, 35 }, Enum.Material.Wood)
	signBoth(ranger, "Parque Nacional · No dejes huella", Color3.fromRGB(90, 60, 35), Color3.fromRGB(255, 240, 200), Enum.Font.GothamBold)
	for _ = 1, 12 do
		local x, z = cx + rng:NextInteger(-180, 180), cz + rng:NextInteger(-180, 180)
		if free(x, z, 4) then
			P(m, "Rock", Vector3.new(5, 3.5, 4), CFrame.new(x, GROUND_TOP + 1.2, z) * CFrame.Angles(0, rng:NextNumber() * 6, 0), { 130, 125, 115 }, Enum.Material.Rock, { Shape = Enum.PartType.Ball })
			block(x, z, 5)
		end
	end
	for _ = 1, 80 do
		local x, z = cx + rng:NextInteger(-185, 185), cz + rng:NextInteger(-185, 185)
		if free(x, z, 5) then
			if rng:NextNumber() < 0.5 then
				pine(m, x, z, 0.9 + rng:NextNumber() * 0.5, false)
			else
				tree(m, x, z, 0.9 + rng:NextNumber() * 0.5, rng)
			end
			block(x, z, 8)
		end
	end
end

destThemes.fest = function(m, dest, cx, cz, rng, free, block)
	-- Escenario Aurora frente al lugar 🎥
	P(m, "Stage", Vector3.new(60, 4, 26), Vector3.new(cx, GROUND_TOP + 2, cz - 100), { 30, 30, 36 }, Enum.Material.Wood)
	P(m, "StageBack", Vector3.new(64, 32, 2), Vector3.new(cx, GROUND_TOP + 16, cz - 114), { 20, 20, 26 }, Enum.Material.SmoothPlastic)
	local screen = P(m, "StageScreen", Vector3.new(40, 16, 0.6), Vector3.new(cx, GROUND_TOP + 17, cz - 112.6), { 255, 60, 200 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(screen, "FESTIVAL DE CREADORES AURORA", Color3.fromRGB(40, 0, 70), Color3.fromRGB(255, 220, 255))
	for _, sx in ipairs({ -36, 36 }) do
		P(m, "LightTower", Vector3.new(2, 30, 2), Vector3.new(cx + sx, GROUND_TOP + 15, cz - 100), { 60, 60, 66 }, Enum.Material.Metal)
		local lamp = P(m, "StageLight", Vector3.new(4, 3, 4), Vector3.new(cx + sx, GROUND_TOP + 31, cz - 100), { 255, 240, 200 }, Enum.Material.Neon, { NoShadow = true })
		nightLight(lamp, 60, Color3.fromRGB(255, 120, 220))
		P(m, "Speaker", Vector3.new(5, 10, 4), Vector3.new(cx + sx * 0.75, GROUND_TOP + 9, cz - 90), { 25, 25, 28 }, Enum.Material.SmoothPlastic)
	end
	block(cx, cz - 100, 44)
	-- Zona de firmas: mesas, vallas y cartel
	for k = 0, 2 do
		local x, z = cx - 115, cz + 5 + k * 22
		P(m, "SigningTable", Vector3.new(4, 3, 12), Vector3.new(x, GROUND_TOP + 1.5, z), { 245, 245, 245 }, Enum.Material.Fabric)
		P(m, "QueueFence", Vector3.new(0.4, 2.4, 16), Vector3.new(x + 10, GROUND_TOP + 1.2, z), { 200, 40, 120 }, Enum.Material.Metal)
		block(x, z, 9)
	end
	local fb = P(m, "SigningBanner", Vector3.new(20, 5, 0.4), Vector3.new(cx - 115, GROUND_TOP + 10, cz - 15), { 140, 60, 220 }, Enum.Material.Fabric)
	signBoth(fb, "✍ ZONA DE FIRMAS", Color3.fromRGB(140, 60, 220), Color3.new(1, 1, 1))
	-- Calle de food trucks
	local truckColors = { { 255, 200, 40 }, { 60, 200, 220 }, { 255, 90, 90 }, { 120, 220, 120 } }
	local foods = { "Tacos Aurora", "Burger Live", "Crepes Stream", "Ramen Viral" }
	for k, tz in ipairs({ -15, 20, 55, 90 }) do
		local x, z = cx + 122, cz + tz
		if free(x, z, 8) then
			P(m, "FoodTruck", Vector3.new(8, 8, 16), Vector3.new(x, GROUND_TOP + 5, z), truckColors[k], Enum.Material.SmoothPlastic)
			local win = P(m, "TruckWindow", Vector3.new(0.3, 3, 8), Vector3.new(x - 4.1, GROUND_TOP + 6, z), { 255, 230, 160 }, Enum.Material.Neon, { NoShadow = true })
			signBoth(win, foods[k], Color3.fromRGB(40, 20, 10), Color3.fromRGB(255, 230, 160))
			for _, w in ipairs({ { -4, 5 }, { 4, 5 }, { -4, -5 }, { 4, -5 } }) do
				P(m, "Wheel", Vector3.new(1.2, 2.4, 2.4), Vector3.new(x + w[1], GROUND_TOP + 1.2, z + w[2]), { 20, 20, 20 }, Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
			end
			block(x, z, 12)
		end
	end
	-- Carpas de patrocinadores y guirnaldas de luces
	local placed = 0
	for _ = 1, 40 do
		if placed >= 8 then
			break
		end
		local x, z = cx + rng:NextInteger(-180, 180), cz + rng:NextInteger(-180, 180)
		if free(x, z, 8) then
			local c = ({ { 255, 80, 160 }, { 80, 160, 255 }, { 255, 200, 60 }, { 140, 80, 255 } })[rng:NextInteger(1, 4)]
			P(m, "Tent", Vector3.new(12, 6, 6), CFrame.new(x, GROUND_TOP + 3, z + 3), c, Enum.Material.Fabric, { Class = "WedgePart" })
			P(m, "Tent", Vector3.new(12, 6, 6), CFrame.new(x, GROUND_TOP + 3, z - 3) * CFrame.Angles(0, math.pi, 0), c, Enum.Material.Fabric, { Class = "WedgePart" })
			block(x, z, 12)
			placed = placed + 1
		end
	end
	local poles = {}
	for k = -3, 3 do
		local p = Vector3.new(cx + k * 24, GROUND_TOP + 12, cz - 30)
		P(m, "LightPole", Vector3.new(0.5, 12, 0.5), Vector3.new(p.X, GROUND_TOP + 6, p.Z), { 60, 60, 66 }, Enum.Material.Metal)
		poles[#poles + 1] = p
	end
	for k = 2, #poles do
		cable(m, poles[k - 1], poles[k], 0.4, { 255, 220, 120 }, Enum.Material.Neon)
	end
end

local function buildDestination(dest)
	local cx, cz = dest.Center[1], dest.Center[2]
	local rng = Random.new(Util.hashString(dest.Id))
	local m = model(city, "Destino " .. dest.Name)
	m:SetAttribute("Destination", dest.Id)
	local half = LifeData.DestHalf - 20
	local L = LifeData.DestLayout
	-- Suelo con su material, borde visible y muros invisibles en el límite
	P(m, "DestGround", Vector3.new(half * 2, 2, half * 2), Vector3.new(cx, GROUND_TOP - 0.9, cz), dest.Ground, Enum.Material[dest.Material] or Enum.Material.Grass)
	local edgeColor = { math.floor(dest.Ground[1] * 0.75), math.floor(dest.Ground[2] * 0.75), math.floor(dest.Ground[3] * 0.75) }
	for _, e in ipairs({ { 0, -half, half * 2 + 2, 2 }, { 0, half, half * 2 + 2, 2 }, { -half, 0, 2, half * 2 + 2 }, { half, 0, 2, half * 2 + 2 } }) do
		P(m, "DestEdge", Vector3.new(e[3], 2, e[4]), Vector3.new(cx + e[1], GROUND_TOP + 1, cz + e[2]), edgeColor, Enum.Material.Rock)
		local wall = P(m, "DestBarrier", Vector3.new(e[3], 80, e[4]), Vector3.new(cx + e[1], GROUND_TOP + 40, cz + e[2]), { 255, 255, 255 }, Enum.Material.SmoothPlastic, { Transparency = 1, NoShadow = true })
		wall.CanQuery = false
	end
	-- Zonas reservadas (lugares, edificios y llegada) para no poner decoración encima
	local keep = {}
	local function block(x, z, r)
		keep[#keep + 1] = { x, z, r }
	end
	local function free(x, z, r)
		for _, k in ipairs(keep) do
			if (x - k[1]) ^ 2 + (z - k[2]) ^ 2 < (k[3] + (r or 0)) ^ 2 then
				return false
			end
		end
		return true
	end
	for _, s in ipairs(dest.Spots) do
		block(cx + s[2], cz + s[3], 22)
	end
	local shopX, shopZ = cx + L.Shop[1], cz + L.Shop[2]
	local hotelX, hotelZ = cx + L.Hotel[1], cz + L.Hotel[2]
	local gateX, gateZ = cx + L.Gate[1], cz + L.Gate[2]
	local arrX, arrZ = cx + L.Arrival[1], cz + L.Arrival[2]
	block(shopX, shopZ, 28)
	block(hotelX + 12, hotelZ, 36)
	block(gateX, gateZ, 30)
	block(arrX, arrZ, 22)
	block(cx + 60, gateZ + 24, 26)

	-- Arco de bienvenida
	for _, sx in ipairs({ -10, 10 }) do
		P(m, "ArchPillar", Vector3.new(2, 14, 2), Vector3.new(arrX + sx, GROUND_TOP + 7, arrZ - 14), { 240, 240, 245 }, Enum.Material.Marble)
	end
	local arch = P(m, "ArchSign", Vector3.new(24, 4, 0.6), Vector3.new(arrX, GROUND_TOP + 15, arrZ - 14), { 20, 30, 50 })
	signBoth(arch, "Bienvenido a " .. dest.Name, Color3.fromRGB(20, 30, 50), Color3.fromRGB(255, 214, 120))

	-- Puerta de embarque (vuelo de vuelta), pista y avión
	local gcf = CFrame.new(gateX, GROUND_TOP, gateZ)
	P(m, "GateFloor", Vector3.new(36, 0.6, 18), gcf * CFrame.new(0, 0.3, 0), { 220, 222, 228 }, Enum.Material.Concrete)
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			P(m, "GateColumn", Vector3.new(1.2, 10, 1.2), gcf * CFrame.new(sx * 17, 5, sz * 8), { 200, 205, 215 }, Enum.Material.Metal)
		end
	end
	P(m, "GateRoof", Vector3.new(38, 1, 20), gcf * CFrame.new(0, 10.5, 0), { 40, 90, 160 }, Enum.Material.Metal)
	local gsign = P(m, "GateSign", Vector3.new(20, 3, 0.4), gcf * CFrame.new(0, 12.6, -9), { 20, 40, 80 })
	signBoth(gsign, "🛫 Puerta de embarque · Vuelo a la ciudad", Color3.fromRGB(20, 40, 80), Color3.new(1, 1, 1))
	local desk = P(m, "GateDesk", Vector3.new(10, 3.6, 2.5), gcf * CFrame.new(0, 1.8, 2), { 60, 70, 90 }, Enum.Material.Metal)
	prompt(desk, "dest_return", "Volar de vuelta", "Vuelo a la ciudad (incluido)")
	table.insert(World.NpcPoints, { Pos = (gcf * CFrame.new(0, 0, 5)).Position, Look = (gcf * CFrame.new(0, 0, -4)).Position, Name = "Auxiliar de vuelo", Role = "travel" })
	P(m, "Airstrip", Vector3.new(320, 0.3, 18), Vector3.new(cx, GROUND_TOP + 0.15, gateZ + 24), { 50, 50, 55 }, Enum.Material.Asphalt)
	local plane = model(m, "Plane")
	P(plane, "Fuselage", Vector3.new(30, 5, 5), Vector3.new(cx + 60, GROUND_TOP + 4, gateZ + 24), { 245, 245, 250 }, Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	P(plane, "Wings", Vector3.new(7, 0.8, 30), Vector3.new(cx + 58, GROUND_TOP + 3.5, gateZ + 24), { 220, 220, 230 }, Enum.Material.SmoothPlastic)
	P(plane, "Tail", Vector3.new(4, 6, 0.6), Vector3.new(cx + 73, GROUND_TOP + 8, gateZ + 24), { 255, 60, 80 }, Enum.Material.SmoothPlastic)

	-- Tienda exclusiva (abierta hacia el centro)
	local scf = CFrame.new(shopX, GROUND_TOP, shopZ) * CFrame.Angles(0, math.pi / 2, 0)
	destBooth(m, scf, 34, 24, 14, { 245, 240, 230 }, { 190, 170, 140 })
	local sboard = P(m, "ShopSign", Vector3.new(28, 2.6, 0.4), scf * CFrame.new(0, 12.4, 12.4), { 20, 20, 24 })
	signBoth(sboard, "🛍 " .. dest.ShopName .. " · exclusivos", Color3.fromRGB(255, 40, 70), Color3.new(1, 1, 1))
	local scounter = P(m, "ShopCounter", Vector3.new(14, 4, 3), scf * CFrame.new(0, 2, -6), { 40, 40, 48 }, Enum.Material.Wood)
	prompt(scounter, "dest_shop", "Ver tienda exclusiva", dest.ShopName)
	table.insert(World.NpcPoints, { Pos = (scf * CFrame.new(0, 0, -9.5)).Position, Look = (scf * CFrame.new(0, 0, 0)).Position, Name = "Dependiente de " .. dest.ShopName, Role = "dest_shop" })
	for i, id in ipairs(dest.Shop) do
		local def = Catalog.get(id)
		if def then
			local px = -11 + (i - 1) * 11
			local pedestal = P(m, "Pedestal", Vector3.new(4, 3, 4), scf * CFrame.new(px, 1.5, 4), { 250, 250, 252 }, Enum.Material.Marble)
			displayModel(m, def, scf * CFrame.new(px, 3, 4))
			local tag = P(m, "PriceTag", Vector3.new(4, 1, 0.2), scf * CFrame.new(px, 2.2, 6.2), { 255, 214, 0 })
			signBoth(tag, "$" .. Util.formatInt(def.Price), nil, Color3.fromRGB(20, 20, 24))
			prompt(pedestal, "dest_shop", "Ver exclusivo", def.Name)
		end
	end

	-- Hotel: vestíbulo abierto hacia el centro y torre de habitaciones detrás
	local hcf = CFrame.new(hotelX, GROUND_TOP, hotelZ) * CFrame.Angles(0, -math.pi / 2, 0)
	destBooth(m, hcf, 30, 20, 12, { 250, 235, 215 }, { 160, 120, 90 })
	local tower = hcf * CFrame.new(0, 20, -20)
	P(m, "HotelTower", Vector3.new(34, 40, 18), tower, { 235, 225, 205 }, Enum.Material.Concrete)
	windowBands(m, tower, 34, 40, 18, rng)
	local hboard = P(m, "HotelSign", Vector3.new(24, 4, 0.5), hcf * CFrame.new(0, 15, -9), { 30, 30, 40 })
	signBoth(hboard, "🏨 " .. dest.Hotel.Name, Color3.fromRGB(30, 30, 40), Color3.fromRGB(255, 214, 120))
	local reception = P(m, "Reception", Vector3.new(12, 4, 3), hcf * CFrame.new(0, 2, -4), { 120, 80, 50 }, Enum.Material.Wood)
	prompt(reception, "dest_hotel", "Dormir aquí ($" .. dest.Hotel.Price .. ")", dest.Hotel.Name)
	table.insert(World.NpcPoints, { Pos = (hcf * CFrame.new(0, 0, -7.5)).Position, Look = (hcf * CFrame.new(0, 0, 0)).Position, Name = "Recepcionista del " .. dest.Hotel.Name, Role = "hotel" })
	for _, sx in ipairs({ -9, 9 }) do
		P(m, "LobbySofa", Vector3.new(6, 2, 3), hcf * CFrame.new(sx, 1.6, 4), { 180, 60, 60 }, Enum.Material.Fabric)
	end

	-- Lugares de grabación con banco
	for _, s in ipairs(dest.Spots) do
		recordMarker(m, cx + s[2], cz + s[3], s[1])
		bench(m, cx + s[2] + 10, cz + s[3] + 10, rng:NextNumber() * 6)
	end
	-- Decoración temática
	local theme = destThemes[dest.Theme or dest.Id]
	if theme then
		theme(m, dest, cx, cz, rng, free, block)
	end
	-- Farolas y un vecino del lugar
	for _, p in ipairs({ { -40, 120 }, { 40, 120 }, { -40, 150 }, { 40, 150 } }) do
		streetLamp(m, cx + p[1], cz + p[2])
	end
	local s1 = dest.Spots[1]
	table.insert(World.NpcPoints, { Pos = Vector3.new(cx + s1[2] - 8, GROUND_TOP, cz + s1[3] - 6), Look = Vector3.new(cx + s1[2], GROUND_TOP, cz + s1[3]), Name = "Turista en " .. dest.Name, Role = "citizen" })
end

local function buildDestinations()
	for _, dest in ipairs(LifeData.Destinations) do
		buildDestination(dest)
	end
end

---------------------------------------------------------------------------
-- Distritos
---------------------------------------------------------------------------
---------------------------------------------------------------------------
-- Complejo de Estudios Prisma: vestíbulo con recepción en el Distrito de estudios y 6 platós
-- especializados en la zona de interiores (z ≈ -4200), cada uno con su decoración y puerta de salida.
---------------------------------------------------------------------------
World.StudioSets = {}

local function vcyl(parent, name, height, dia, cf, color, material, opts)
	-- Cilindro vertical (en Roblox el cilindro va a lo largo del eje X)
	local o = opts or {}
	o.Shape = Enum.PartType.Cylinder
	return P(parent, name, Vector3.new(height, dia, dia), cf * CFrame.Angles(0, 0, math.rad(90)), color, material, o)
end

local function lightStand(parent, cf, color, boxColor)
	P(parent, "StandPole", Vector3.new(0.3, 7, 0.3), cf * CFrame.new(0, 3.5, 0), { 30, 30, 34 }, Enum.Material.Metal)
	P(parent, "StandFoot", Vector3.new(3, 0.3, 3), cf * CFrame.new(0, 0.15, 0), { 30, 30, 34 }, Enum.Material.Metal)
	local box = P(parent, "Softbox", Vector3.new(3.4, 2.6, 1.2), cf * CFrame.new(0, 7.4, 0), boxColor or { 245, 245, 245 }, Enum.Material.Neon, { NoShadow = true })
	nightLight(box, 18, color and rgb(color) or Color3.fromRGB(255, 250, 235))
	return box
end

local function buildStudioComplex(parent, sp)
	local m = model(parent, "EstudiosPrisma")
	local w, d, h = 60, 44, 18
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 40, 40, 48 }, { 70, 70, 80 })
	local board = P(m, "PrismaSign", Vector3.new(34, 4, 0.6), base * CFrame.new(0, h - 3, d / 2 + 1.2), { 20, 20, 24 })
	signBoth(board, "🎛 " .. sp.Name, Color3.fromRGB(30, 20, 50), Color3.new(1, 1, 1))
	-- Franja de neón con los colores del prisma
	local colors = { { 255, 60, 60 }, { 255, 170, 40 }, { 255, 230, 60 }, { 60, 220, 120 }, { 60, 160, 255 }, { 170, 90, 255 } }
	for i, c in ipairs(colors) do
		local strip = P(m, "PrismaStrip", Vector3.new(w / 6, 0.6, 0.4), base * CFrame.new(-w / 2 + (i - 0.5) * w / 6, h - 0.6, d / 2 + 0.8), c, Enum.Material.Neon, { NoShadow = true })
		if i == 4 then
			nightLight(strip, 30, rgb(c))
		end
	end
	-- Recepción: aviso que abre la app Estudios
	local desk = P(m, "ReceptionDesk", Vector3.new(16, 4, 3), base * CFrame.new(0, 2, -d / 2 + 9), { 230, 230, 236 }, Enum.Material.Marble)
	P(m, "DeskTop", Vector3.new(16.4, 0.4, 3.4), base * CFrame.new(0, 4.2, -d / 2 + 9), { 30, 30, 36 }, Enum.Material.Glass)
	local ds = P(m, "DeskSign", Vector3.new(12, 1.4, 0.2), base * CFrame.new(0, 3, -d / 2 + 10.6), { 30, 20, 50 })
	signBoth(ds, "RECEPCIÓN · ALQUILER DE PLATÓS", Color3.fromRGB(30, 20, 50), Color3.new(1, 1, 1))
	prompt(desk, "studio_desk", "Alquilar plató", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(0, 0, -d / 2 + 6)).Position, Look = (base * CFrame.new(0, 0, 0)).Position, Name = "Recepcionista de Prisma", Role = "studio" })
	-- Pantalla con los platós y precios
	local lines = {}
	for _, set in ipairs(StudioData.Sets) do
		lines[#lines + 1] = set.Icon .. " " .. set.Name .. "  $" .. set.Price .. "/h"
	end
	local board2 = P(m, "SetsBoard", Vector3.new(22, 8, 0.4), base * CFrame.new(0, 10, -d / 2 + 1), { 10, 10, 20 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(board2, table.concat(lines, "\n"), Color3.fromRGB(10, 10, 20), Color3.fromRGB(120, 220, 255), Enum.Font.Code)
	-- Puertas de los platós (3 por lado) con su cartel y luz de «grabando»
	for i, set in ipairs(StudioData.Sets) do
		local sx = i <= 3 and -1 or 1
		local z = -10 + ((i - 1) % 3) * 10
		local doorCF = base * CFrame.new(sx * (w / 2 - 0.8), 0, z)
		P(m, "SetDoor", Vector3.new(0.4, 9, 5), doorCF * CFrame.new(0, 4.5, 0), { 50, 50, 60 }, Enum.Material.Metal)
		local plate = P(m, "SetDoorSign", Vector3.new(0.3, 1.4, 6), doorCF * CFrame.new(-sx * 0.3, 10, 0), { 30, 20, 50 })
		sign(plate, sx < 0 and Enum.NormalId.Right or Enum.NormalId.Left, set.Icon .. " " .. set.Name, Color3.fromRGB(30, 20, 50), Color3.new(1, 1, 1))
		P(m, "OnAirLamp", Vector3.new(0.4, 0.8, 1.6), doorCF * CFrame.new(-sx * 0.3, 11.5, 0), { 255, 40, 40 }, Enum.Material.Neon, { NoShadow = true })
	end
	-- Zona de espera
	for _, sx in ipairs({ -1, 1 }) do
		P(m, "LobbySofa", Vector3.new(8, 1.6, 3), base * CFrame.new(sx * 14, 1.2, 10), { 120, 60, 200 }, Enum.Material.Fabric)
		P(m, "LobbySofaBack", Vector3.new(8, 2.4, 0.8), base * CFrame.new(sx * 14, 2.6, 11.4), { 120, 60, 200 }, Enum.Material.Fabric)
		P(m, "LobbyPlant", Vector3.new(1.6, 4, 1.6), base * CFrame.new(sx * 22, 2.4, 14), { 60, 150, 70 }, Enum.Material.Grass)
	end
end

-- Decoración propia de cada plató
local studioDecor = {}

studioDecor.gaming = function(m, base, W, D, H)
	local screenColors = { { 255, 60, 180 }, { 60, 140, 255 }, { 60, 230, 140 } }
	for i, x in ipairs({ -18, 0, 18 }) do
		P(m, "GameScreenFrame", Vector3.new(15, 9, 0.4), base * CFrame.new(x, 8, -D / 2 + 1), { 15, 15, 18 }, Enum.Material.Metal)
		local scr = P(m, "GameScreen", Vector3.new(14, 8, 0.2), base * CFrame.new(x, 8, -D / 2 + 1.3), screenColors[i], Enum.Material.Neon, { NoShadow = true })
		nightLight(scr, 20, rgb(screenColors[i]))
	end
	P(m, "GamingDesk", Vector3.new(34, 0.6, 4), base * CFrame.new(0, 3.2, -D / 2 + 8), { 20, 20, 24 }, Enum.Material.Metal)
	for i, x in ipairs({ -11, 0, 11 }) do
		P(m, "DeskMonitor", Vector3.new(4, 2.4, 0.3), base * CFrame.new(x, 5, -D / 2 + 6.6), { 15, 15, 18 })
		P(m, "DeskScreen", Vector3.new(3.7, 2.1, 0.05), base * CFrame.new(x, 5, -D / 2 + 6.8), screenColors[i], Enum.Material.Neon, { NoShadow = true })
		P(m, "Keyboard", Vector3.new(3, 0.2, 1), base * CFrame.new(x, 3.6, -D / 2 + 8.4), { 30, 30, 34 })
		P(m, "KeyboardRGB", Vector3.new(3, 0.05, 1), base * CFrame.new(x, 3.72, -D / 2 + 8.4), screenColors[i], Enum.Material.Neon, { NoShadow = true })
		-- Silla gaming RGB
		local chair = base * CFrame.new(x, 0, -D / 2 + 12)
		P(m, "RGBChairSeat", Vector3.new(3, 0.8, 3), chair * CFrame.new(0, 2.2, 0), { 20, 20, 24 }, Enum.Material.Fabric)
		P(m, "RGBChairBack", Vector3.new(3, 4.5, 0.6), chair * CFrame.new(0, 4.6, 1.3), { 20, 20, 24 }, Enum.Material.Fabric)
		P(m, "RGBChairStripe", Vector3.new(0.5, 4.3, 0.1), chair * CFrame.new(0, 4.6, 0.95), screenColors[i], Enum.Material.Neon, { NoShadow = true })
		P(m, "RGBChairBase", Vector3.new(0.5, 1.8, 0.5), chair * CFrame.new(0, 0.9, 0), { 60, 60, 66 }, Enum.Material.Metal)
	end
	for _, side in ipairs({ -1, 1 }) do
		P(m, "LedStrip", Vector3.new(0.3, 0.3, D - 2), base * CFrame.new(side * (W / 2 - 1), 0.3, 0), { 200, 0, 255 }, Enum.Material.Neon, { NoShadow = true })
		P(m, "LedStripTop", Vector3.new(0.3, 0.3, D - 2), base * CFrame.new(side * (W / 2 - 1), H - 1, 0), { 0, 220, 255 }, Enum.Material.Neon, { NoShadow = true })
	end
	P(m, "GamerSofa", Vector3.new(10, 1.8, 3.5), base * CFrame.new(-14, 1.2, 8), { 60, 30, 90 }, Enum.Material.Fabric)
	P(m, "ConsoleTable", Vector3.new(6, 1.6, 2.5), base * CFrame.new(-14, 0.8, 3), { 20, 20, 24 }, Enum.Material.Wood)
	P(m, "Console", Vector3.new(1.6, 0.5, 1.2), base * CFrame.new(-14, 1.85, 3), { 240, 240, 245 })
end

studioDecor.music = function(m, base, W, D, H)
	-- Cabina insonorizada con cristal y micrófono
	local booth = base * CFrame.new(-W / 2 + 9, 0, -D / 2 + 8)
	P(m, "BoothFloor", Vector3.new(14, 0.4, 12), booth * CFrame.new(0, 0.2, 0), { 60, 50, 50 }, Enum.Material.Carpet)
	P(m, "BoothGlass", Vector3.new(14, 10, 0.4), booth * CFrame.new(0, 5, 6), { 180, 210, 230 }, Enum.Material.Glass, { Transparency = 0.5 })
	P(m, "BoothGlass", Vector3.new(0.4, 10, 12), booth * CFrame.new(7, 5, 0), { 180, 210, 230 }, Enum.Material.Glass, { Transparency = 0.5 })
	P(m, "BoothRoof", Vector3.new(14, 0.4, 12), booth * CFrame.new(0, 10.2, 0), { 40, 40, 44 }, Enum.Material.Metal)
	vcyl(m, "BoothMicStand", 5, 0.25, booth * CFrame.new(0, 2.7, 0), { 30, 30, 34 }, Enum.Material.Metal)
	P(m, "BoothMic", Vector3.new(0.5, 1, 0.5), booth * CFrame.new(0, 5.5, 0), { 200, 200, 210 }, Enum.Material.Metal)
	vcyl(m, "PopFilter", 0.1, 1.2, booth * CFrame.new(0, 5.5, 0.8) * CFrame.Angles(math.rad(90), 0, 0), { 20, 20, 24 }, Enum.Material.Fabric, { Transparency = 0.3 })
	local onAir = P(m, "RecLamp", Vector3.new(3, 1, 0.2), booth * CFrame.new(0, 11.3, 6), { 255, 40, 40 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(onAir, "REC", Color3.fromRGB(200, 20, 20), Color3.new(1, 1, 1))
	-- Paneles acústicos en las paredes
	for i = 0, 5 do
		for j = 0, 1 do
			P(m, "AcousticFoam", Vector3.new(3.4, 3.4, 0.6), base * CFrame.new(-W / 2 + 22 + i * 6, 6 + j * 5, -D / 2 + 0.9), (i + j) % 2 == 0 and { 50, 50, 56 } or { 120, 40, 40 }, Enum.Material.Fabric)
		end
	end
	-- Batería
	local drums = base * CFrame.new(10, 0, -4)
	vcyl(m, "BassDrum", 2.4, 3.6, drums * CFrame.new(0, 1.8, 0) * CFrame.Angles(math.rad(90), 0, 0), { 200, 30, 40 }, Enum.Material.SmoothPlastic)
	vcyl(m, "Snare", 1, 2, drums * CFrame.new(-2.4, 2.8, 1.6), { 230, 230, 235 }, Enum.Material.Metal)
	vcyl(m, "Tom", 1, 1.6, drums * CFrame.new(-0.8, 4.1, -0.4), { 200, 30, 40 }, Enum.Material.SmoothPlastic)
	vcyl(m, "Tom", 1, 1.6, drums * CFrame.new(0.9, 4.1, -0.4), { 200, 30, 40 }, Enum.Material.SmoothPlastic)
	for _, sx in ipairs({ -3, 3 }) do
		vcyl(m, "CymbalStand", 5, 0.2, drums * CFrame.new(sx, 2.5, -1), { 40, 40, 44 }, Enum.Material.Metal)
		vcyl(m, "Cymbal", 0.1, 2.6, drums * CFrame.new(sx, 5.1, -1), { 230, 190, 70 }, Enum.Material.Metal)
	end
	P(m, "DrumStool", Vector3.new(1.6, 2, 1.6), drums * CFrame.new(0, 1, 3), { 30, 30, 34 }, Enum.Material.Fabric)
	-- Teclado y guitarras
	local keys = base * CFrame.new(-6, 0, 4)
	P(m, "KeyboardStand", Vector3.new(6, 3, 0.4), keys * CFrame.new(0, 1.5, 0), { 30, 30, 34 }, Enum.Material.Metal)
	P(m, "SynthBody", Vector3.new(6.4, 0.5, 2), keys * CFrame.new(0, 3.25, 0), { 20, 20, 24 })
	P(m, "SynthKeys", Vector3.new(6, 0.1, 1.2), keys * CFrame.new(0, 3.55, 0.3), { 250, 250, 250 })
	for i = 0, 8 do
		P(m, "SynthBlackKey", Vector3.new(0.25, 0.12, 0.7), keys * CFrame.new(-2.6 + i * 0.65, 3.62, 0.05), { 10, 10, 12 }, Enum.Material.SmoothPlastic, { NoShadow = true })
	end
	for i, c in ipairs({ { 230, 120, 40 }, { 40, 120, 220 } }) do
		local gx = W / 2 - 4 - (i - 1) * 4
		P(m, "GuitarStand", Vector3.new(1.4, 0.4, 1.4), base * CFrame.new(gx, 0.2, 6), { 30, 30, 34 }, Enum.Material.Metal)
		P(m, "GuitarBody", Vector3.new(2.2, 2.6, 0.5), base * CFrame.new(gx, 2, 6), c, Enum.Material.Wood)
		P(m, "GuitarNeck", Vector3.new(0.35, 3.2, 0.25), base * CFrame.new(gx, 4.8, 6), { 90, 60, 40 }, Enum.Material.Wood)
	end
	P(m, "MixingDesk", Vector3.new(8, 3, 3), base * CFrame.new(-6, 1.5, -D / 2 + 18), { 40, 40, 46 }, Enum.Material.Metal)
	P(m, "MixerFaders", Vector3.new(7.4, 0.1, 2.4), base * CFrame.new(-6, 3.05, -D / 2 + 18), { 80, 200, 255 }, Enum.Material.Neon, { NoShadow = true })
end

studioDecor.kitchen = function(m, base, W, D, H)
	P(m, "BackCounter", Vector3.new(36, 3.6, 3.4), base * CFrame.new(0, 1.8, -D / 2 + 2.4), { 240, 240, 240 }, Enum.Material.Marble)
	for i = 0, 3 do
		vcyl(m, "Burner", 0.15, 1.6, base * CFrame.new(-6 + (i % 2) * 2.6, 3.7, -D / 2 + 1.6 + math.floor(i / 2) * 1.8), { 20, 20, 24 }, Enum.Material.Metal)
	end
	P(m, "Hood", Vector3.new(8, 2.4, 4), base * CFrame.new(-4.7, 9.5, -D / 2 + 2.6), { 190, 195, 205 }, Enum.Material.Metal)
	P(m, "HoodPipe", Vector3.new(2, 6, 2), base * CFrame.new(-4.7, 13.7, -D / 2 + 2), { 190, 195, 205 }, Enum.Material.Metal)
	P(m, "Fridge", Vector3.new(5, 10, 4), base * CFrame.new(W / 2 - 4, 5, -D / 2 + 3), { 210, 215, 225 }, Enum.Material.Metal)
	P(m, "Oven", Vector3.new(4, 3.4, 0.2), base * CFrame.new(-4.7, 1.8, -D / 2 + 4.2), { 20, 20, 24 }, Enum.Material.Glass)
	P(m, "Sink", Vector3.new(4, 0.3, 2), base * CFrame.new(8, 3.7, -D / 2 + 2.4), { 180, 185, 195 }, Enum.Material.Metal)
	-- Isla central con tabla, sartenes y platos
	P(m, "Island", Vector3.new(16, 3.6, 6), base * CFrame.new(0, 1.8, -2), { 245, 245, 245 }, Enum.Material.Marble)
	P(m, "CuttingBoard", Vector3.new(3, 0.2, 2), base * CFrame.new(-4, 3.7, -2), { 190, 140, 90 }, Enum.Material.Wood)
	vcyl(m, "Pan", 0.4, 2.2, base * CFrame.new(1, 3.8, -2), { 30, 30, 34 }, Enum.Material.Metal)
	vcyl(m, "Pot", 1.4, 1.8, base * CFrame.new(4.5, 4.3, -2.5), { 200, 200, 210 }, Enum.Material.Metal)
	for i = 0, 2 do
		vcyl(m, "Plate", 0.15, 1.5, base * CFrame.new(-6 + i * 1.8, 3.7, 0), { 250, 250, 250 }, Enum.Material.SmoothPlastic)
		P(m, "Veggie", Vector3.new(0.7, 0.7, 0.7), base * CFrame.new(-6 + i * 1.8, 4.1, 0), ({ { 230, 60, 40 }, { 90, 180, 60 }, { 250, 200, 40 } })[i + 1], Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Ball })
	end
	for _, x in ipairs({ -5, 5 }) do
		P(m, "PendantCord", Vector3.new(0.1, 6, 0.1), base * CFrame.new(x, H - 3, -2), { 20, 20, 24 }, Enum.Material.Metal)
		local lamp = P(m, "PendantLamp", Vector3.new(2, 1, 2), base * CFrame.new(x, H - 6.5, -2), { 255, 230, 160 }, Enum.Material.Neon, { NoShadow = true })
		nightLight(lamp, 16, Color3.fromRGB(255, 230, 170))
	end
	for i = 0, 2 do
		P(m, "Stool", Vector3.new(1.6, 3, 1.6), base * CFrame.new(-5 + i * 5, 1.5, 3), { 40, 40, 44 }, Enum.Material.Metal)
	end
end

studioDecor.podcast = function(m, base, W, D, H)
	vcyl(m, "Rug", 0.1, 18, base * CFrame.new(0, 0.05, -4), { 120, 60, 50 }, Enum.Material.Fabric)
	vcyl(m, "RoundTable", 0.5, 10, base * CFrame.new(0, 3.2, -4), { 60, 45, 35 }, Enum.Material.Wood)
	vcyl(m, "TableLeg", 3, 1.2, base * CFrame.new(0, 1.5, -4), { 30, 30, 34 }, Enum.Material.Metal)
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		local cx, cz = math.cos(a), math.sin(a)
		P(m, "PodChair", Vector3.new(2.6, 1, 2.6), base * CFrame.new(cx * 7, 2, -4 + cz * 7), { 30, 30, 34 }, Enum.Material.Fabric)
		P(m, "PodChairBack", Vector3.new(2.6, 3, 0.5), base * CFrame.new(cx * 8.3, 3.8, -4 + cz * 8.3) * CFrame.Angles(0, -a + math.rad(90), 0), { 30, 30, 34 }, Enum.Material.Fabric)
		-- Micrófono de brazo
		P(m, "MicArm", Vector3.new(0.2, 0.2, 3), base * CFrame.new(cx * 3.2, 4.6, -4 + cz * 3.2) * CFrame.Angles(0, -a + math.rad(90), 0), { 20, 20, 24 }, Enum.Material.Metal)
		P(m, "PodMic", Vector3.new(0.6, 1.2, 0.6), base * CFrame.new(cx * 4.4, 4.4, -4 + cz * 4.4), { 50, 50, 56 }, Enum.Material.Metal)
		P(m, "Headphones", Vector3.new(1.2, 0.4, 1), base * CFrame.new(cx * 3.6, 3.65, -4 + cz * 3.6), { 220, 60, 60 }, Enum.Material.SmoothPlastic)
	end
	local onAir = P(m, "OnAirSign", Vector3.new(10, 2.6, 0.3), base * CFrame.new(0, 12, -D / 2 + 1), { 200, 20, 30 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(onAir, "ON AIR", Color3.fromRGB(200, 20, 30), Color3.new(1, 1, 1))
	nightLight(onAir, 20, Color3.fromRGB(255, 60, 60))
	for i = 0, 3 do
		P(m, "AcousticPanel", Vector3.new(4, 6, 0.5), base * CFrame.new(-18 + i * 12, 7, -D / 2 + 0.9), i % 2 == 0 and { 90, 60, 110 } or { 50, 90, 110 }, Enum.Material.Fabric)
	end
	P(m, "Bookshelf", Vector3.new(10, 8, 2), base * CFrame.new(W / 2 - 7, 4, 6), { 110, 80, 55 }, Enum.Material.WoodPlanks)
	for i = 0, 3 do
		P(m, "Book", Vector3.new(0.6, 1.6, 1.4), base * CFrame.new(W / 2 - 10 + i * 0.8, 6, 5.6), ({ { 200, 60, 60 }, { 60, 120, 200 }, { 230, 190, 60 }, { 60, 170, 90 } })[i + 1], Enum.Material.SmoothPlastic)
	end
	P(m, "Plant", Vector3.new(2, 4, 2), base * CFrame.new(-W / 2 + 4, 2, 6), { 60, 150, 70 }, Enum.Material.Grass)
end

studioDecor.chroma = function(m, base, W, D, H)
	-- Curva de croma entre el suelo y la pared del fondo
	P(m, "ChromaCove", Vector3.new(W - 8, 0.4, 5), base * CFrame.new(0, 1.6, -D / 2 + 2.6) * CFrame.Angles(math.rad(-40), 0, 0), { 40, 200, 70 }, Enum.Material.SmoothPlastic)
	P(m, "ChromaMark", Vector3.new(2, 0.05, 2), base * CFrame.new(0, 0.03, -6), { 255, 255, 255 }, Enum.Material.SmoothPlastic, { NoShadow = true })
	for _, x in ipairs({ -14, 0, 14 }) do
		lightStand(m, base * CFrame.new(x, 0, 4))
	end
	-- Cámara en trípode
	local cam = base * CFrame.new(0, 0, 10)
	for i = 0, 2 do
		local a = math.rad(i * 120)
		P(m, "TripodLeg", Vector3.new(0.2, 5, 0.2), cam * CFrame.new(math.cos(a) * 0.9, 2.4, math.sin(a) * 0.9), { 30, 30, 34 }, Enum.Material.Metal)
	end
	P(m, "StudioCamera", Vector3.new(1.8, 1.6, 3), cam * CFrame.new(0, 5.6, 0), { 25, 25, 30 }, Enum.Material.Metal)
	-- Monitor de composición: muestra el fondo elegido
	P(m, "CompositeMonitorStand", Vector3.new(0.4, 5, 0.4), base * CFrame.new(8, 2.5, 10), { 30, 30, 34 }, Enum.Material.Metal)
	local mon = P(m, "CompositeMonitor", Vector3.new(6, 3.6, 0.3), base * CFrame.new(8, 6.6, 10), { 15, 15, 18 })
	local label = signBoth(mon, "FONDO: elige uno en el panel", Color3.fromRGB(15, 30, 20), Color3.fromRGB(120, 255, 150), Enum.Font.Code)
	return { Monitor = label }
end

studioDecor.photo = function(m, base, W, D, H)
	-- Rollos de papel de fondo con su barrido hasta el suelo
	local papers = { { 245, 245, 245 }, { 30, 30, 34 }, { 255, 170, 190 } }
	P(m, "BackdropBar", Vector3.new(W - 6, 0.5, 0.5), base * CFrame.new(0, H - 2, -D / 2 + 1.5), { 40, 40, 44 }, Enum.Material.Metal)
	for i, c in ipairs(papers) do
		local x = -16 + (i - 1) * 16
		P(m, "PaperRoll", Vector3.new(14, 1.2, 1.2), base * CFrame.new(x, H - 2, -D / 2 + 2), c, Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
		P(m, "Paper", Vector3.new(13, H - 3, 0.2), base * CFrame.new(x, (H - 3) / 2, -D / 2 + 2.2), c, Enum.Material.Fabric)
		P(m, "PaperSweep", Vector3.new(13, 0.1, 8), base * CFrame.new(x, 0.05, -D / 2 + 6), c, Enum.Material.Fabric, { NoShadow = true })
	end
	lightStand(m, base * CFrame.new(-10, 0, 2))
	lightStand(m, base * CFrame.new(10, 0, 2))
	-- Paraguas reflectores
	for _, x in ipairs({ -20, 20 }) do
		P(m, "UmbrellaPole", Vector3.new(0.3, 8, 0.3), base * CFrame.new(x, 4, 4), { 30, 30, 34 }, Enum.Material.Metal)
		P(m, "Umbrella", Vector3.new(5, 2.4, 5), base * CFrame.new(x, 8.6, 4), { 250, 250, 250 }, Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	end
	vcyl(m, "Reflector", 0.1, 4, base * CFrame.new(5, 2.5, -4) * CFrame.Angles(math.rad(90), 0, 0), { 230, 200, 120 }, Enum.Material.Foil)
	P(m, "PhotoStool", Vector3.new(2, 3, 2), base * CFrame.new(0, 1.5, -8), { 30, 30, 34 }, Enum.Material.Wood)
	P(m, "CameraTripod", Vector3.new(0.4, 5, 0.4), base * CFrame.new(0, 2.5, 8), { 30, 30, 34 }, Enum.Material.Metal)
	P(m, "PhotoCamera", Vector3.new(1.6, 1.2, 1.2), base * CFrame.new(0, 5.6, 8), { 20, 20, 24 }, Enum.Material.Metal)
end

local function buildStudioSets()
	local root = folder(city, "EstudiosPrismaPlatos")
	local size = StudioData.SetSize
	local W, D, H = size.W, size.D, size.H
	for _, set in ipairs(StudioData.Sets) do
		local m = model(root, "Plato_" .. set.Id)
		local base = CFrame.new(set.OX, 0, set.OZ)
		P(m, "Floor", Vector3.new(W, 1, D), base * CFrame.new(0, -0.5, 0), set.Floor, set.Id == "music" and Enum.Material.WoodPlanks or Enum.Material.SmoothPlastic)
		P(m, "Ceiling", Vector3.new(W, 1, D), base * CFrame.new(0, H + 0.5, 0), { 30, 30, 34 }, Enum.Material.SmoothPlastic)
		for _, side in ipairs({ { 0, -D / 2, W, 1 }, { 0, D / 2, W, 1 }, { -W / 2, 0, 1, D }, { W / 2, 0, 1, D } }) do
			P(m, "Wall", Vector3.new(side[3], H, side[4]), base * CFrame.new(side[1], H / 2, side[2]), set.Wall, Enum.Material.SmoothPlastic)
		end
		-- Parrilla de focos
		P(m, "LightTruss", Vector3.new(W - 6, 0.5, 0.5), base * CFrame.new(0, H - 1.2, -4), { 40, 40, 44 }, Enum.Material.Metal)
		for _, lx in ipairs({ -W / 4, 0, W / 4 }) do
			local lamp = P(m, "TrussLight", Vector3.new(2.4, 1.6, 2.4), base * CFrame.new(lx, H - 2.4, -4), { 255, 250, 235 }, Enum.Material.Neon, { NoShadow = true })
			local l = Instance.new("PointLight")
			l.Range = 34
			l.Brightness = 1.4
			l.Parent = lamp
		end
		local title = P(m, "SetTitle", Vector3.new(20, 2.6, 0.3), base * CFrame.new(0, H - 4.5, D / 2 - 0.8), { 20, 20, 24 })
		signBoth(title, set.Icon .. " " .. set.Name .. " · " .. StudioData.Name, Color3.fromRGB(20, 20, 24), Color3.new(1, 1, 1))
		-- Puerta de salida (aviso) y panel del plató (abre la app Estudios)
		local door = P(m, "ExitDoor", Vector3.new(6, 9, 0.6), base * CFrame.new(0, 4.5, D / 2 - 0.8), { 90, 60, 40 }, Enum.Material.Wood)
		prompt(door, "studio_exit", "Salir a la recepción", set.Name)
		local exitSign = P(m, "ExitSign", Vector3.new(4, 1, 0.2), base * CFrame.new(0, 9.8, D / 2 - 0.9), { 40, 200, 90 }, Enum.Material.Neon, { NoShadow = true })
		signBoth(exitSign, "SALIDA", Color3.fromRGB(40, 160, 80), Color3.new(1, 1, 1))
		local panel = P(m, "ControlPanel", Vector3.new(3, 4, 1), base * CFrame.new(8, 2, D / 2 - 2), { 30, 30, 36 }, Enum.Material.Metal)
		P(m, "ControlScreen", Vector3.new(2.6, 1.6, 0.1), base * CFrame.new(8, 3.2, D / 2 - 2.55), { 80, 200, 255 }, Enum.Material.Neon, { NoShadow = true })
		prompt(panel, "studio_panel", "Panel del plató", set.Name)
		local extra = studioDecor[set.Id] and studioDecor[set.Id](m, base, W, D, H) or nil
		World.StudioSets[set.Id] = { Model = m, Center = Vector3.new(set.OX, 0, set.OZ), Monitor = extra and extra.Monitor or nil }
	end
end

---------------------------------------------------------------------------
-- Ocio: gimnasio, cine, karaoke y bolera con recreativos (avisos que abren la app Ocio)
---------------------------------------------------------------------------
local function buildGym(parent, sp)
	local m = model(parent, "Gimnasio")
	local w, d, h = 52, 40, 16
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 235, 235, 240 }, { 60, 60, 66 })
	local board = P(m, "GymSign", Vector3.new(28, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 1.2), { 20, 20, 24 })
	signBoth(board, "🏋 " .. sp.Name, Color3.fromRGB(230, 80, 30), Color3.new(1, 1, 1))
	-- Cintas de correr frente a los espejos
	P(m, "MirrorWall", Vector3.new(w - 6, 8, 0.3), base * CFrame.new(0, 6, -d / 2 + 0.9), { 200, 220, 235 }, Enum.Material.Glass, { Transparency = 0.2 })
	for i = 0, 3 do
		local tm = base * CFrame.new(-15 + i * 6, 0, -d / 2 + 6)
		P(m, "TreadmillBase", Vector3.new(3, 0.8, 6), tm * CFrame.new(0, 0.4, 0), { 40, 40, 44 }, Enum.Material.Metal)
		P(m, "TreadmillBelt", Vector3.new(2.4, 0.1, 5.4), tm * CFrame.new(0, 0.85, 0), { 20, 20, 22 }, Enum.Material.Fabric, { NoShadow = true })
		P(m, "TreadmillPost", Vector3.new(0.3, 4, 0.3), tm * CFrame.new(0, 2.6, -2.8), { 60, 60, 66 }, Enum.Material.Metal)
		P(m, "TreadmillPanel", Vector3.new(2.4, 1, 0.4), tm * CFrame.new(0, 4.6, -2.8), { 230, 80, 30 }, Enum.Material.Neon, { NoShadow = true })
	end
	-- Pesas, banco y saco de boxeo
	P(m, "DumbbellRack", Vector3.new(10, 3, 2), base * CFrame.new(w / 2 - 6, 1.5, -6), { 40, 40, 44 }, Enum.Material.Metal)
	for i = 0, 4 do
		P(m, "Dumbbell", Vector3.new(1.6, 0.6, 0.6), base * CFrame.new(w / 2 - 10 + i * 2, 3.3, -6), { 30, 30, 34 }, Enum.Material.Metal)
	end
	P(m, "BenchPress", Vector3.new(2, 1.6, 6), base * CFrame.new(w / 2 - 8, 0.8, 4), { 200, 40, 40 }, Enum.Material.Fabric)
	P(m, "Barbell", Vector3.new(8, 0.3, 0.3), base * CFrame.new(w / 2 - 8, 4, 2), { 180, 180, 190 }, Enum.Material.Metal)
	for _, sx in ipairs({ -1, 1 }) do
		vcyl(m, "BarbellPlate", 0.5, 2.4, base * CFrame.new(w / 2 - 8 + sx * 3.4, 4, 2) * CFrame.Angles(0, 0, math.rad(90)), { 20, 20, 24 }, Enum.Material.Metal)
	end
	P(m, "BagChain", Vector3.new(0.2, 4, 0.2), base * CFrame.new(-w / 2 + 6, h - 2, 6), { 120, 120, 130 }, Enum.Material.Metal)
	vcyl(m, "PunchingBag", 5, 2.4, base * CFrame.new(-w / 2 + 6, h - 6.5, 6), { 150, 30, 30 }, Enum.Material.Fabric)
	for i = 0, 2 do
		P(m, "YogaMat", Vector3.new(2.4, 0.15, 6), base * CFrame.new(-8 + i * 4, 0.1, 8), ({ { 60, 160, 220 }, { 120, 200, 90 }, { 230, 120, 180 } })[i + 1], Enum.Material.Fabric, { NoShadow = true })
	end
	local counter = P(m, "GymCounter", Vector3.new(10, 4, 3), base * CFrame.new(12, 2, 10), { 230, 80, 30 }, Enum.Material.SmoothPlastic)
	prompt(counter, "gym", "Entrenar", sp.Name)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(12, 0, 7)).Position, Look = (base * CFrame.new(12, 0, 14)).Position, Name = "Entrenadora de Pulso Fit", Role = "leisure" })
end

local function buildCinema(parent, sp)
	local m = model(parent, "Cine")
	local w, d, h = 56, 44, 18
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 120, 20, 30 }, { 90, 20, 30 })
	local board = P(m, "CinemaSign", Vector3.new(30, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 1.2), { 20, 20, 24 })
	signBoth(board, "🎬 " .. sp.Name, Color3.fromRGB(20, 10, 10), Color3.fromRGB(255, 214, 80))
	-- Marquesina con la cartelera
	local names = {}
	for _, mv in ipairs(StudioData.Movies) do
		names[#names + 1] = mv.Name
	end
	local marquee = P(m, "Marquee", Vector3.new(24, 6, 0.4), base * CFrame.new(-w / 2 + 14, 13, d / 2 + 1.4), { 255, 240, 200 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(marquee, "EN CARTELERA\n" .. table.concat(names, " · "), Color3.fromRGB(255, 240, 200), Color3.fromRGB(120, 20, 30))
	-- Pantalla y butacas
	local screen = P(m, "MovieScreen", Vector3.new(36, 13, 0.3), base * CFrame.new(0, 9, -d / 2 + 1), { 240, 240, 255 }, Enum.Material.Neon, { NoShadow = true })
	nightLight(screen, 30, Color3.fromRGB(200, 210, 255))
	for row = 0, 2 do
		for i = 0, 7 do
			local x, z = -14 + i * 4, -6 + row * 5
			P(m, "Seat", Vector3.new(3, 1.4, 3), base * CFrame.new(x, 1.4 + row * 0.6, z), { 170, 20, 40 }, Enum.Material.Fabric)
			P(m, "SeatBack", Vector3.new(3, 2.6, 0.5), base * CFrame.new(x, 3.2 + row * 0.6, z + 1.4), { 170, 20, 40 }, Enum.Material.Fabric)
		end
	end
	-- Taquilla y palomitas
	local counter = P(m, "TicketCounter", Vector3.new(10, 4, 3), base * CFrame.new(w / 2 - 8, 2, 12), { 40, 20, 20 }, Enum.Material.Wood)
	prompt(counter, "cinema", "Comprar entrada", sp.Name)
	P(m, "PopcornMachine", Vector3.new(3, 4, 3), base * CFrame.new(w / 2 - 4, 6, 12), { 255, 220, 120 }, Enum.Material.Glass, { Transparency = 0.3 })
	P(m, "Popcorn", Vector3.new(2.6, 1.4, 2.6), base * CFrame.new(w / 2 - 4, 4.8, 12), { 255, 245, 200 }, Enum.Material.Sand)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(w / 2 - 8, 0, 9)).Position, Look = (base * CFrame.new(w / 2 - 8, 0, 16)).Position, Name = "Taquillero de Lumière", Role = "leisure" })
end

local function buildKaraoke(parent, sp)
	local m = model(parent, "Karaoke")
	local w, d, h = 46, 36, 14
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 60, 20, 80 }, { 40, 20, 50 })
	local board = P(m, "KaraokeSign", Vector3.new(26, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 1.2), { 20, 20, 24 })
	signBoth(board, "🎤 " .. sp.Name, Color3.fromRGB(80, 20, 110), Color3.fromRGB(255, 214, 80))
	-- Escenario con micrófono, pantalla de letras y bola de discoteca
	P(m, "Stage", Vector3.new(20, 1.4, 9), base * CFrame.new(0, 0.7, -d / 2 + 5), { 30, 20, 40 }, Enum.Material.WoodPlanks)
	local lyrics = P(m, "LyricsScreen", Vector3.new(16, 6, 0.3), base * CFrame.new(0, 7.5, -d / 2 + 0.9), { 20, 20, 60 }, Enum.Material.Neon, { NoShadow = true })
	signBoth(lyrics, "♪ Canta conmigo bajo las luces de la ciudad ♪", Color3.fromRGB(20, 20, 60), Color3.fromRGB(255, 230, 120))
	vcyl(m, "MicStand", 4.5, 0.25, base * CFrame.new(0, 3.6, -d / 2 + 6), { 200, 200, 210 }, Enum.Material.Metal)
	local mic = P(m, "StageMic", Vector3.new(0.6, 1.2, 0.6), base * CFrame.new(0, 6.3, -d / 2 + 6), { 230, 190, 70 }, Enum.Material.Metal)
	prompt(mic, "karaoke", "Cantar", sp.Name)
	local ball = P(m, "DiscoBall", Vector3.new(2.4, 2.4, 2.4), base * CFrame.new(0, h - 2.5, 0), { 220, 220, 230 }, Enum.Material.Foil, { Shape = Enum.PartType.Ball })
	nightLight(ball, 26, Color3.fromRGB(255, 120, 220))
	for i, c in ipairs({ { 255, 60, 160 }, { 60, 200, 255 }, { 255, 220, 60 } }) do
		local spot = P(m, "Spotlight", Vector3.new(1.4, 1.4, 1.4), base * CFrame.new(-8 + (i - 1) * 8, h - 1.2, -d / 2 + 8), c, Enum.Material.Neon, { NoShadow = true })
		nightLight(spot, 16, rgb(c))
	end
	-- Sofás, mesas y barra
	for i = 0, 2 do
		P(m, "Booth", Vector3.new(8, 1.6, 3), base * CFrame.new(-14 + i * 14, 1.2, 8), { 150, 30, 90 }, Enum.Material.Fabric)
		vcyl(m, "BoothTable", 0.4, 3, base * CFrame.new(-14 + i * 14, 2.6, 4.5), { 30, 20, 40 }, Enum.Material.Wood)
	end
	P(m, "KaraokeBar", Vector3.new(3, 4, 12), base * CFrame.new(w / 2 - 3, 2, 2), { 40, 20, 50 }, Enum.Material.Wood)
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(w / 2 - 6, 0, 2)).Position, Look = (base * CFrame.new(0, 0, 2)).Position, Name = "Anfitriona del karaoke", Role = "leisure" })
end

local function buildBowling(parent, sp)
	local m = model(parent, "Bolera")
	local w, d, h = 60, 44, 16
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 30, 40, 90 }, { 50, 50, 60 })
	local board = P(m, "BowlingSign", Vector3.new(32, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 1.2), { 20, 20, 24 })
	signBoth(board, "🎳 " .. sp.Name, Color3.fromRGB(20, 40, 120), Color3.fromRGB(255, 214, 80))
	-- Cuatro pistas con sus bolos
	for lane = 0, 3 do
		local x = -21 + lane * 7
		P(m, "Lane", Vector3.new(5, 0.2, 28), base * CFrame.new(x, 0.7, -d / 2 + 15), { 220, 180, 120 }, Enum.Material.WoodPlanks)
		P(m, "Gutter", Vector3.new(0.8, 0.2, 28), base * CFrame.new(x - 2.9, 0.55, -d / 2 + 15), { 40, 40, 44 }, Enum.Material.Metal)
		P(m, "LaneArrow", Vector3.new(0.6, 0.05, 1.4), base * CFrame.new(x, 0.82, -d / 2 + 20), { 200, 40, 40 }, Enum.Material.SmoothPlastic, { NoShadow = true })
		for r = 1, 4 do
			for k = 1, r do
				vcyl(m, "Pin", 1.4, 0.5, base * CFrame.new(x + (k - (r + 1) / 2) * 0.9, 1.5, -d / 2 + 2.5 + (4 - r) * 0.9), { 250, 250, 250 }, Enum.Material.SmoothPlastic, { NoShadow = true })
			end
		end
		local score = P(m, "ScoreScreen", Vector3.new(5, 2.4, 0.3), base * CFrame.new(x, 9, -d / 2 + 26), { 20, 30, 80 }, Enum.Material.Neon, { NoShadow = true })
		signBoth(score, "PISTA " .. (lane + 1), Color3.fromRGB(20, 30, 80), Color3.fromRGB(255, 214, 80))
	end
	-- Bolas en el retorno y mostrador de zapatos (aviso)
	for i = 0, 5 do
		P(m, "BowlingBall", Vector3.new(1.4, 1.4, 1.4), base * CFrame.new(-21 + i * 1.6, 2.2, -d / 2 + 31), ({ { 220, 40, 40 }, { 40, 90, 220 }, { 30, 30, 34 }, { 120, 40, 180 }, { 40, 170, 90 }, { 240, 160, 30 } })[i + 1], Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Ball })
	end
	P(m, "BallReturn", Vector3.new(10, 1.4, 2), base * CFrame.new(-17, 0.7, -d / 2 + 31), { 40, 40, 44 }, Enum.Material.Metal)
	local counter = P(m, "ShoeCounter", Vector3.new(10, 4, 3), base * CFrame.new(-14, 2, d / 2 - 5), { 20, 40, 120 }, Enum.Material.SmoothPlastic)
	prompt(counter, "bowling", "Jugar a los bolos", sp.Name)
	-- Recreativas junto a la pared este
	for i = 0, 3 do
		local cab = base * CFrame.new(w / 2 - 3, 0, -14 + i * 7)
		P(m, "ArcadeCabinet", Vector3.new(3, 7, 4), cab * CFrame.new(0, 3.5, 0), ({ { 200, 30, 60 }, { 30, 120, 220 }, { 240, 180, 30 }, { 120, 40, 200 } })[i + 1], Enum.Material.SmoothPlastic)
		local scr = P(m, "ArcadeScreen", Vector3.new(0.2, 2.4, 3), cab * CFrame.new(-1.6, 5, 0), { 80, 255, 160 }, Enum.Material.Neon, { NoShadow = true })
		nightLight(scr, 8, Color3.fromRGB(80, 255, 160))
	end
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(-14, 0, d / 2 - 8)).Position, Look = (base * CFrame.new(-14, 0, d / 2)).Position, Name = "Encargado de la bolera", Role = "leisure" })
end

local function buildDistrict(d)
	local cx, cz = WorldData.center(d)
	local rng = Random.new(Util.hashString(d.Id))
	local m = model(city, d.Name)
	local inner = CELL - ROAD
	-- Acera (borde) y suelo del distrito
	P(m, "Sidewalk", Vector3.new(inner, 1, inner), Vector3.new(cx, GROUND_TOP - 0.6, cz), { 175, 175, 180 }, Enum.Material.Concrete)
	local material = Enum.Material[d.Material] or Enum.Material.Grass
	P(m, "Ground", Vector3.new(inner - 10, 0.2, inner - 10), Vector3.new(cx, GROUND_TOP, cz), d.Ground, material)

	-- Señal del distrito + parada de taxi
	local stop = S.Travel.taxiStop(d)
	P(m, "TaxiPole", Vector3.new(0.5, 9, 0.5), Vector3.new(stop.X, GROUND_TOP + 4.5, stop.Z + 4), { 40, 40, 44 }, Enum.Material.Metal)
	local board = P(m, "DistrictSign", Vector3.new(14, 4, 0.4), Vector3.new(stop.X, GROUND_TOP + 9.5, stop.Z + 4), { 20, 30, 50 })
	signBoth(board, d.Name, Color3.fromRGB(20, 30, 50), Color3.new(1, 1, 1))
	local taxi = P(m, "TaxiSign", Vector3.new(3, 1.6, 0.3), Vector3.new(stop.X + 4, GROUND_TOP + 6, stop.Z + 4), { 255, 210, 0 })
	signBoth(taxi, "TAXI", Color3.fromRGB(255, 210, 0), Color3.fromRGB(20, 20, 20))

	if (d.Busy or 0) >= 5 then
		vending(m, stop.X - 14, stop.Z + 4)
	end

	-- Farolas en las aceras
	local half = inner / 2 - 3
	for _, pos in ipairs({ { -half, -half / 2 }, { half, half / 2 }, { half / 2, -half }, { -half / 2, half } }) do
		streetLamp(m, cx + pos[1], cz + pos[2])
	end

	-- Agua
	if d.Water then
		local wc = Vector3.new(cx + d.Water.X, GROUND_TOP + 1, cz + d.Water.Z)
		workspace.Terrain:FillBlock(CFrame.new(wc), Vector3.new(d.Water.W, 4, d.Water.D), Enum.Material.Water)
		local rim = Util.indexOf(d.Tags, "beach") and { 230, 210, 160 } or { 120, 110, 100 }
		local rimMat = Util.indexOf(d.Tags, "beach") and Enum.Material.Sand or Enum.Material.Slate
		P(m, "Shore", Vector3.new(d.Water.W + 4, 2.4, 2), Vector3.new(wc.X, GROUND_TOP + 1.2, wc.Z - d.Water.D / 2 - 1), rim, rimMat)
		P(m, "Shore", Vector3.new(2, 2.4, d.Water.D), Vector3.new(wc.X - d.Water.W / 2 - 1, GROUND_TOP + 1.2, wc.Z), rim, rimMat)
		P(m, "Shore", Vector3.new(2, 2.4, d.Water.D), Vector3.new(wc.X + d.Water.W / 2 + 1, GROUND_TOP + 1.2, wc.Z), rim, rimMat)
		P(m, "Shore", Vector3.new(d.Water.W + 4, 2.4, 2), Vector3.new(wc.X, GROUND_TOP + 1.2, wc.Z + d.Water.D / 2 + 1), rim, rimMat)
		if d.Id == "lake" or d.Id == "port" then
			P(m, "Pier", Vector3.new(8, 1, 40), Vector3.new(wc.X, GROUND_TOP + 3, wc.Z + d.Water.D / 2 - 18), { 130, 95, 65 }, Enum.Material.WoodPlanks)
		end
	end

	-- Montañas
	if d.Hills then
		for i = 1, 6 do
			local hx, hz = rng:NextInteger(-100, 100), rng:NextInteger(-100, 100)
			local s = rng:NextInteger(40, 80)
			P(m, "Hill", Vector3.new(s, s * 0.8, s), CFrame.new(cx + hx, GROUND_TOP + s * 0.2, cz + hz) * CFrame.Angles(0, rng:NextNumber() * 6, 0),
				{ 120, 115, 105 }, Enum.Material.Slate, { Shape = Enum.PartType.Ball })
		end
		P(m, "SnowCap", Vector3.new(40, 30, 40), Vector3.new(cx + 40, GROUND_TOP + 30, cz - 60), { 245, 248, 255 }, Enum.Material.Snow, { Shape = Enum.PartType.Ball })
	end
	if d.Fields then
		for i = -3, 3 do
			P(m, "Crops", Vector3.new(80, 1.2, 4), Vector3.new(cx - 40, GROUND_TOP + 0.6, cz - 50 + i * 8), { 200, 180, 60 }, Enum.Material.Grass)
		end
	end
	if d.Runway then
		P(m, "Runway", Vector3.new(30, 0.3, 230), Vector3.new(cx + 80, GROUND_TOP + 0.15, cz), { 50, 50, 55 }, Enum.Material.Asphalt)
		for i = -5, 5 do
			P(m, "RunwayMark", Vector3.new(1.5, 0.05, 10), Vector3.new(cx + 80, GROUND_TOP + 0.33, cz + i * 20), { 250, 250, 250 }, Enum.Material.SmoothPlastic, { NoShadow = true })
		end
		local plane = model(m, "Plane")
		P(plane, "Fuselage", Vector3.new(40, 6, 6), CFrame.new(cx + 80, GROUND_TOP + 5, cz - 60) * CFrame.Angles(0, math.rad(90), math.rad(90)), { 245, 245, 250 }, Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
		P(plane, "Wings", Vector3.new(44, 1, 8), Vector3.new(cx + 80, GROUND_TOP + 4, cz - 60), { 220, 220, 230 }, Enum.Material.SmoothPlastic)
	end
	if d.Monument then
		P(m, "MonumentBase", Vector3.new(16, 3, 16), Vector3.new(cx, GROUND_TOP + 1.5, cz - 18), { 200, 190, 170 }, Enum.Material.Marble)
		P(m, "Obelisk", Vector3.new(6, 40, 6), Vector3.new(cx, GROUND_TOP + 23, cz - 18), { 230, 220, 200 }, Enum.Material.Marble)
		local top = P(m, "ObeliskTop", Vector3.new(4, 4, 4), Vector3.new(cx, GROUND_TOP + 45, cz - 18), { 255, 214, 100 }, Enum.Material.Neon, { Shape = Enum.PartType.Ball })
		nightLight(top, 40)
	end

	-- Edificios: huecos en una cuadrícula 4x4 evitando lugares y edificios especiales
	local blocked = {}
	for _, s in ipairs(d.Spots) do
		blocked[#blocked + 1] = { cx + s.X, cz + s.Z, 40 }
	end
	for _, sp in ipairs(d.Specials or {}) do
		blocked[#blocked + 1] = { cx + sp.X, cz + sp.Z, (sp.Type == "home" and 80) or (sp.Type == "dealer" and 64) or 50 }
	end
	blocked[#blocked + 1] = { stop.X, stop.Z, 20 }
	if d.Water then
		blocked[#blocked + 1] = { cx + d.Water.X, cz + d.Water.Z, math.max(d.Water.W, d.Water.D) / 2 + 25 }
	end
	if d.Runway then
		blocked[#blocked + 1] = { cx + 80, cz, 60 }
		blocked[#blocked + 1] = { cx + 80, cz + 90, 50 }
		blocked[#blocked + 1] = { cx + 80, cz - 90, 50 }
	end
	local slots = {}
	for _, ox in ipairs({ -98, -33, 33, 98 }) do
		for _, oz in ipairs({ -98, -33, 33, 98 }) do
			local x, z = cx + ox, cz + oz
			local free = true
			for _, b in ipairs(blocked) do
				if (x - b[1]) ^ 2 + (z - b[2]) ^ 2 < b[3] ^ 2 then
					free = false
				end
			end
			if free then
				slots[#slots + 1] = { x, z }
			end
		end
	end
	for i = #slots, 2, -1 do
		local j = rng:NextInteger(1, i)
		slots[i], slots[j] = slots[j], slots[i]
	end
	local builder = styleBuilders[d.Style] or styleBuilders.none
	local built = 0
	local buildings = folder(m, "Buildings")
	for _, slot in ipairs(slots) do
		if built >= (d.Count or 0) then
			break
		end
		builder(buildings, slot[1], slot[2], d, rng)
		built = built + 1
	end
	-- Huecos sobrantes: árboles, bancos y coches para dar vida
	local deco = folder(m, "Decoration")
	local trees = d.Trees or 0
	local placed = 0
	local tries = 0
	while placed < trees and tries < trees * 6 do
		tries = tries + 1
		local x, z = cx + rng:NextInteger(-115, 115), cz + rng:NextInteger(-115, 115)
		local ok = true
		for _, b in ipairs(blocked) do
			if (x - b[1]) ^ 2 + (z - b[2]) ^ 2 < (b[3] * 0.6) ^ 2 then
				ok = false
			end
		end
		for _, slot in ipairs(slots) do
			if (x - slot[1]) ^ 2 + (z - slot[2]) ^ 2 < 26 ^ 2 and placed < built then
				ok = false
			end
		end
		if ok then
			tree(deco, x, z, 0.8 + rng:NextNumber() * 0.6, rng)
			placed = placed + 1
		end
	end
	for _, s in ipairs(d.Spots) do
		bench(deco, cx + s.X + 10, cz + s.Z + 10, rng:NextNumber() * 6)
	end
	if Util.indexOf(d.Tags, "urban") or Util.indexOf(d.Tags, "shop") or Util.indexOf(d.Tags, "vehicle") then
		local colors = { { 200, 30, 40 }, { 30, 90, 200 }, { 240, 240, 240 }, { 20, 20, 25 }, { 250, 200, 40 }, { 60, 160, 90 } }
		for i = 1, 3 do
			car(deco, cx - 110 + i * 9, cz + 112, colors[rng:NextInteger(1, #colors)], 0)
		end
	end

	-- Lugares de grabación
	for _, s in ipairs(d.Spots) do
		local marker = P(m, "RecordSpot", Vector3.new(0.3, 10, 10), CFrame.new(cx + s.X, GROUND_TOP + 0.2, cz + s.Z) * CFrame.Angles(0, 0, math.rad(90)),
			{ 255, 50, 90 }, Enum.Material.Neon, { Shape = Enum.PartType.Cylinder, NoCollide = true, Transparency = 0.45, NoShadow = true })
		marker.CanQuery = false
		CollectionService:AddTag(marker, "RecordSpot")
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.fromOffset(200, 40)
		bb.StudsOffset = Vector3.new(0, 7, 0)
		bb.MaxDistance = 140
		bb.Parent = marker
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
		t.BackgroundTransparency = 0.25
		t.TextColor3 = Color3.new(1, 1, 1)
		t.Font = Enum.Font.GothamBold
		t.TextScaled = true
		t.Text = "🎥 " .. s.Name
		t.Parent = bb
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 10)
		corner.Parent = t
	end

	-- Edificios especiales
	for _, sp in ipairs(WorldData.Specials) do
		if sp.District == d.Id then
			if sp.Type == "store" then
				buildStore(m, sp, rng)
			elseif sp.Type == "cafe" then
				buildCafe(m, sp)
			elseif sp.Type == "bank" then
				buildBank(m, sp)
			elseif sp.Type == "restaurant" then
				buildRestaurant(m, sp)
			elseif sp.Type == "home" then
				buildResidence(m, sp)
			elseif sp.Type == "dealer" then
				buildDealer(m, sp)
			elseif sp.Type == "gas" then
				buildGasStation(m, sp)
			elseif sp.Type == "petshop" then
				buildPetShop(m, sp)
			elseif sp.Type == "usedstore" then
				buildUsedStore(m, sp)
			elseif sp.Type == "airport" then
				buildAirport(m, sp)
			elseif sp.Type == "studios" then
				buildStudioComplex(m, sp)
			elseif sp.Type == "gym" then
				buildGym(m, sp)
			elseif sp.Type == "cinema" then
				buildCinema(m, sp)
			elseif sp.Type == "karaoke" then
				buildKaraoke(m, sp)
			elseif sp.Type == "bowling" then
				buildBowling(m, sp)
			end
		end
	end
	if d.Id == "events" then
		buildVipLounge(m, cx + 90, cz - 90)
	end
	for _, l in ipairs(PropertyData.Listings) do
		if l.District == d.Id then
			buildPropertySign(m, l)
		end
	end

	-- Ciudadanos (NPC) junto a lugares concurridos
	if (d.Busy or 0) >= 4 then
		local s = d.Spots[1]
		table.insert(World.NpcPoints, { Pos = Vector3.new(cx + s.X - 8, GROUND_TOP, cz + s.Z - 6), Look = Vector3.new(cx + s.X, GROUND_TOP, cz + s.Z), Name = "Vecino de " .. d.Name, Role = "citizen", District = d.Id })
	end
end

local function buildRoads()
	local roads = folder(city, "Roads")
	local W, H = WorldData.totalSize()
	for k = 0, WorldData.Cols do
		local x = -W / 2 + k * CELL
		P(roads, "RoadNS", Vector3.new(ROAD, 1, H + ROAD), Vector3.new(x, -0.5 + 0.05, 0), { 45, 45, 50 }, Enum.Material.Asphalt)
		P(roads, "LineNS", Vector3.new(0.5, 0.05, H), Vector3.new(x, 0.08, 0), { 240, 200, 40 }, Enum.Material.SmoothPlastic, { NoShadow = true, NoCollide = true })
	end
	for j = 0, WorldData.Rows do
		local z = -H / 2 + j * CELL
		P(roads, "RoadEW", Vector3.new(W + ROAD, 1, ROAD), Vector3.new(0, -0.5 + 0.06, z), { 45, 45, 50 }, Enum.Material.Asphalt)
		P(roads, "LineEW", Vector3.new(W, 0.05, 0.5), Vector3.new(0, 0.09, z), { 240, 200, 40 }, Enum.Material.SmoothPlastic, { NoShadow = true, NoCollide = true })
	end
	-- Semáforos en los cruces interiores
	for k = 1, WorldData.Cols - 1 do
		for j = 1, WorldData.Rows - 1 do
			local x = -W / 2 + k * CELL + ROAD / 2 + 2
			local z = -H / 2 + j * CELL + ROAD / 2 + 2
			P(roads, "TrafficPole", Vector3.new(0.6, 12, 0.6), Vector3.new(x, GROUND_TOP + 6, z), { 40, 40, 44 }, Enum.Material.Metal)
			P(roads, "TrafficBox", Vector3.new(1.4, 4.2, 1.4), Vector3.new(x, GROUND_TOP + 11, z), { 25, 25, 28 }, Enum.Material.Metal)
			local lights = {}
			for i, col in ipairs({ { 255, 40, 40 }, { 255, 200, 0 }, { 40, 255, 90 } }) do
				lights[i] = P(roads, "TrafficLight", Vector3.new(1, 1, 0.3), Vector3.new(x, GROUND_TOP + 12.4 - (i - 1) * 1.3, z - 0.75), col, Enum.Material.Neon, { NoShadow = true })
			end
			table.insert(World.TrafficLights, { Lights = lights, Phase = (k + j) % 2 })
			-- paso de cebra
			for s = -2, 2 do
				P(roads, "Crosswalk", Vector3.new(1.6, 0.05, 8), Vector3.new(x - ROAD / 2 - 2 + s * 3, 0.1, z + 8), { 240, 240, 240 }, Enum.Material.SmoothPlastic, { NoShadow = true, NoCollide = true })
			end
		end
	end
end

local function buildSecrets()
	local f = folder(city, "Secrets")
	for _, s in ipairs(WorldData.Secrets) do
		local star = P(f, "SecretGlow", Vector3.new(1.4, 1.4, 1.4), Vector3.new(s.WX, GROUND_TOP + 2.5, s.WZ), { 255, 240, 140 }, Enum.Material.Neon,
			{ Shape = Enum.PartType.Ball, NoCollide = true, NoShadow = true })
		local sp = Instance.new("Sparkles")
		sp.SparkleColor = Color3.fromRGB(255, 240, 140)
		sp.Parent = star
		CollectionService:AddTag(star, "Spin")
		if s.Id == "sec_studio" then
			P(f, "AbandonedStudio", Vector3.new(24, 12, 20), Vector3.new(s.WX - 14, GROUND_TOP + 6, s.WZ + 2), { 70, 65, 60 }, Enum.Material.CorrodedMetal)
		elseif s.Id == "sec_dock" then
			P(f, "GhostShip", Vector3.new(14, 6, 40), Vector3.new(s.WX - 16, GROUND_TOP + 3, s.WZ), { 60, 50, 45 }, Enum.Material.Wood)
			P(f, "Mast", Vector3.new(1, 22, 1), Vector3.new(s.WX - 16, GROUND_TOP + 15, s.WZ), { 60, 50, 45 }, Enum.Material.Wood)
		elseif s.Id == "sec_arcade" then
			local cab = P(f, "LegendArcade", Vector3.new(4, 7, 3), Vector3.new(s.WX - 4, GROUND_TOP + 3.5, s.WZ), { 40, 0, 80 }, Enum.Material.SmoothPlastic)
			P(f, "ArcadeScreen", Vector3.new(3, 2.4, 0.2), Vector3.new(s.WX - 4, GROUND_TOP + 5, s.WZ + 1.6), { 0, 255, 200 }, Enum.Material.Neon, { NoShadow = true })
			cab:SetAttribute("Secret", true)
		elseif s.Id == "sec_forest" then
			tree(f, s.WX - 8, s.WZ - 8, 2.6, Random.new(7))
		end
	end
end

---------------------------------------------------------------------------
-- Interacciones de los avisos (ProximityPrompt)
---------------------------------------------------------------------------
local function onPrompt(pp, player)
	local action = pp:GetAttribute("Action")
	if not S.Data.get(player) then
		return
	end
	if action == "computer_home" then
		S.Computer.onPrompt(player, pp.Parent, "home", pp:GetAttribute("Owner"))
	elseif action == "computer_public" then
		S.Computer.onPrompt(player, pp.Parent, "public")
	elseif action == "wardrobe" then
		if pp:GetAttribute("Owner") ~= player.UserId then
			S.Net.notify(player, "Este vestidor no es tuyo.", "error")
			return
		end
		S.Net.push(player, "openUI", { ui = "style" })
	elseif action == "store_catalog" then
		S.Travel.markStoreVisit(player, pp:GetAttribute("StoreId"))
		S.Net.push(player, "openUI", { ui = "store", store = pp:GetAttribute("StoreId") })
	elseif action == "inspect" then
		S.Travel.markStoreVisit(player, pp:GetAttribute("StoreId"))
		S.Net.push(player, "openUI", { ui = "product", item = pp:GetAttribute("ItemId"), store = pp:GetAttribute("StoreId") })
	elseif action == "atm" then
		S.Net.push(player, "openUI", { ui = "app", app = "bank" })
	elseif action == "npc" then
		S.NPC.talk(player, pp:GetAttribute("NpcId"))
	elseif action == "vip_enter" then
		if not S.Monetization.owns(player, "VIP") then
			S.Net.notify(player, "La sala VIP es para quienes tienen el Game Pass VIP (opcional). Hay muchos otros lugares para grabar gratis.", "info")
			return
		end
		S.Travel.teleport(player, World.VipLounge.Center)
	elseif action == "vip_exit" then
		S.Travel.teleport(player, World.VipLounge.Entry)
	elseif action == "rest" then
		S.Needs.rest(player)
	elseif action == "cook" then
		if not S.Home.isAtHome(player) then
			S.Net.notify(player, "Esta cocina no es tuya.", "error")
			return
		end
		S.Net.push(player, "openUI", { ui = "food", tab = "cook" })
	elseif action == "vending" or action == "restaurant" or action == "cafe" then
		S.Net.push(player, "openUI", { ui = "food", tab = "menu", place = action })
	elseif action == "dealer" or action == "gas" then
		S.Net.push(player, "openUI", { ui = "app", app = "vehicles" })
	elseif action == "petshop" then
		S.Net.push(player, "openUI", { ui = "app", app = "pets" })
	elseif action == "usedstore" then
		S.Travel.markStoreVisit(player, "usedstore")
		S.Net.push(player, "openUI", { ui = "app", app = "market" })
	elseif action == "prop_view" then
		S.Net.push(player, "openUI", { ui = "realty", listing = pp:GetAttribute("PropId") })
	elseif action == "prop_enter" then
		local id = pp:GetAttribute("PropId")
		local data = S.Data.get(player)
		if not data.Properties[id] then
			S.Net.notify(player, "No es tuya. Alquílala o cómprala desde el anuncio (E) o la app Inmobiliaria.", "info")
			return
		end
		local cf = S.Property.enterCFrame(player, id)
		S.Travel.teleport(player, cf.Position)
		S.Quest.tutorialEvent(player, "enter_home")
	elseif action == "airport" or action == "dest_shop" then
		S.Net.push(player, "openUI", { ui = "app", app = "travel" })
	elseif action == "dest_hotel" or action == "dest_return" then
		local ok, msg
		if action == "dest_hotel" then
			ok, msg = S.Destination.hotel(player)
		else
			ok, msg = S.Destination.goBack(player)
		end
		S.Net.notify(player, msg, ok and "success" or "error")
	elseif action == "studio_desk" or action == "studio_panel" then
		S.Net.push(player, "openUI", { ui = "app", app = "studios" })
	elseif action == "studio_exit" then
		if S.Studio then
			local ok, msg = S.Studio.leave(player)
			S.Net.notify(player, msg, ok and "success" or "info")
		end
	elseif action == "gym" or action == "cinema" or action == "karaoke" or action == "bowling" then
		S.Net.push(player, "openUI", { ui = "app", app = "leisure" })
	elseif action == "prop_exit" then
		local id = S.Property.inside(player)
		if id then
			S.Travel.teleport(player, S.Property.exteriorOf(id))
		end
	end
end
World.onPrompt = onPrompt

function World.build()
	city = workspace:FindFirstChild("City")
	if city then
		city:Destroy()
	end
	city = folder(workspace, "City")
	local W, H = WorldData.totalSize()
	local base = P(city, "Baseplate", Vector3.new(W + 600, 2, H + 600), Vector3.new(0, -2, 0), { 90, 140, 80 }, Enum.Material.Grass)
	base.Locked = true
	-- Mar al sur
	workspace.Terrain:FillBlock(CFrame.new(0, -3, H / 2 + 300), Vector3.new(W + 600, 6, 560), Enum.Material.Water)
	buildRoads()
	for _, d in ipairs(WorldData.Districts) do
		buildDistrict(d)
	end
	buildSecrets()
	buildDestinations()
	buildStudioSets()
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "FallbackSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(8, 1, 8)
	local hp = World.HomePosition or Vector3.new(0, 2, 0)
	spawn.CFrame = CFrame.new(hp + Vector3.new(8, -2, 0))
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = city
end

function World.Start()
	local function connect(pp)
		pp:SetAttribute("Connected", true)
		pp.Triggered:Connect(function(player)
			local ok, err = pcall(onPrompt, pp, player)
			if not ok then
				S.Net.logError("prompt", err)
			end
		end)
	end
	-- Avisos creados más tarde (interiores de propiedades)
	CollectionService:GetInstanceAddedSignal("YTPrompt"):Connect(connect)
	World.build()
	for _, pp in ipairs(CollectionService:GetTagged("YTPrompt")) do
		if not pp:GetAttribute("Connected") then
			pp:SetAttribute("Connected", true)
			connect(pp)
		end
	end
	-- Semáforos
	task.spawn(function()
		local tick = 0
		while true do
			tick = tick + 1
			local phase = math.floor(tick / 2) % 2
			local amber = tick % 2 == 1
			for _, tl in ipairs(World.TrafficLights) do
				local green = (phase + tl.Phase) % 2 == 0
				tl.Lights[1].Transparency = (not green and not amber) and 0 or 0.8
				tl.Lights[2].Transparency = amber and 0 or 0.8
				tl.Lights[3].Transparency = (green and not amber) and 0 or 0.8
			end
			task.wait(4)
		end
	end)
end

return World
