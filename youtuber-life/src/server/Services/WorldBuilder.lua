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

local World = {}
local S
local city

World.Specials = WorldData.Specials
World.SpotById = WorldData.SpotById
World.HomeRooms = {}
World.NpcPoints = {}
World.TrafficLights = {}

local CELL = WorldData.CellSize
local ROAD = WorldData.RoadWidth
local GROUND_TOP = 0.5

function World.Init(services)
	S = services
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
	sign(board, Enum.NormalId.Front, list[rng:NextInteger(1, #list)], nil, Color3.new(1, 1, 1), Enum.Font.FredokaOne)
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
	sign(board, Enum.NormalId.Front, "HOTEL ✦", nil, Color3.fromRGB(255, 214, 120))
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
	sign(screen, Enum.NormalId.Front, "FESTIVAL DE CREADORES", Color3.fromRGB(40, 0, 70), Color3.fromRGB(255, 220, 255))
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
	sign(board, Enum.NormalId.Front, store.Name, Color3.fromRGB(255, 40, 70), Color3.new(1, 1, 1))
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
		sign(tag, Enum.NormalId.Front, "$" .. Util.formatInt(def.Price), nil, Color3.fromRGB(20, 20, 24))
		prompt(pedestal, "inspect", "Inspeccionar", def.Name, { ItemId = def.Id, StoreId = sp.StoreId })
	end
end

local function buildCafe(parent, sp)
	local m = model(parent, "Cibercafe")
	local w, d, h = 48, 36, 14
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 250, 230, 200 }, { 150, 110, 80 })
	local board = P(m, "CafeSign", Vector3.new(24, 3.5, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 20, 24 })
	sign(board, Enum.NormalId.Front, "☕ " .. sp.Name, Color3.fromRGB(90, 50, 30), Color3.fromRGB(255, 230, 190))
	for i = 1, 4 do
		local x = -18 + (i - 1) * 12
		local desk = P(m, "PublicDesk", Vector3.new(7, 0.5, 3.5), base * CFrame.new(x, 3, -d / 2 + 4), { 120, 85, 60 }, Enum.Material.WoodPlanks)
		P(m, "PublicMonitor", Vector3.new(3, 2, 0.3), base * CFrame.new(x, 4.6, -d / 2 + 3), { 20, 20, 24 })
		P(m, "PublicScreen", Vector3.new(2.7, 1.7, 0.05), base * CFrame.new(x, 4.6, -d / 2 + 3.2), { 70, 140, 255 }, Enum.Material.Neon, { NoShadow = true })
		prompt(desk, "computer_public", "Usar computador público", "Cibercafé")
	end
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(14, 0, 8)).Position, Look = (base * CFrame.new(0, 0, 8)).Position, Name = "Barista", Role = "barista" })
end

local function buildBank(parent, sp)
	local m = model(parent, "Banco")
	local w, d, h = 50, 36, 18
	local base = shell(m, sp.WX, sp.WZ, w, d, h, { 230, 225, 210 }, { 240, 240, 240 })
	local board = P(m, "BankSign", Vector3.new(28, 4, 0.6), base * CFrame.new(0, h - 2.5, d / 2 + 0.6), { 20, 40, 70 })
	sign(board, Enum.NormalId.Front, "🏦 " .. sp.Name, Color3.fromRGB(20, 40, 70), Color3.fromRGB(255, 214, 120))
	for i = 1, 3 do
		local atm = P(m, "ATM", Vector3.new(3, 6, 2), base * CFrame.new(-14 + (i - 1) * 14, 3, -d / 2 + 2), { 60, 70, 90 }, Enum.Material.Metal)
		P(m, "ATMScreen", Vector3.new(2, 1.4, 0.1), base * CFrame.new(-14 + (i - 1) * 14, 4.2, -d / 2 + 3.05), { 80, 220, 140 }, Enum.Material.Neon, { NoShadow = true })
		prompt(atm, "atm", "Abrir banco", "Cajero automático")
	end
	table.insert(World.NpcPoints, { Pos = (base * CFrame.new(16, 0, 6)).Position, Look = (base * CFrame.new(0, 0, 6)).Position, Name = "Asesora del banco", Role = "banker" })
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
			P(m, "Bed", Vector3.new(6, 1.6, 9), rbase * CFrame.new(-7, 1.4, inward * 4), { 250, 250, 255 }, Enum.Material.Fabric)
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
			P(m, "Fridge", Vector3.new(3, 6, 3), rbase * CFrame.new(roomW / 2 - 2, 3, inward * 6), { 230, 235, 240 }, Enum.Material.Metal)
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
	sign(s, Enum.NormalId.Front, "⭐ SALA VIP", nil, Color3.fromRGB(255, 214, 0))
	prompt(door, "vip_enter", "Entrar", "Sala VIP (Game Pass VIP)")
	World.VipLounge = { Center = center + Vector3.new(0, 3, 0), Size = Vector3.new(w, h, d), Entry = Vector3.new(cx, GROUND_TOP + 3, cz + 26) }
end

---------------------------------------------------------------------------
-- Distritos
---------------------------------------------------------------------------
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
	sign(board, Enum.NormalId.Front, d.Name, Color3.fromRGB(20, 30, 50), Color3.new(1, 1, 1))
	sign(board, Enum.NormalId.Back, d.Name, Color3.fromRGB(20, 30, 50), Color3.new(1, 1, 1))
	local taxi = P(m, "TaxiSign", Vector3.new(3, 1.6, 0.3), Vector3.new(stop.X + 4, GROUND_TOP + 6, stop.Z + 4), { 255, 210, 0 })
	sign(taxi, Enum.NormalId.Front, "TAXI", Color3.fromRGB(255, 210, 0), Color3.fromRGB(20, 20, 20))

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
		blocked[#blocked + 1] = { cx + sp.X, cz + sp.Z, sp.Type == "home" and 80 or 50 }
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
			elseif sp.Type == "home" then
				buildResidence(m, sp)
			end
		end
	end
	if d.Id == "events" then
		buildVipLounge(m, cx + 90, cz - 90)
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
	World.build()
	for _, pp in ipairs(CollectionService:GetTagged("YTPrompt")) do
		pp.Triggered:Connect(function(player)
			local ok, err = pcall(onPrompt, pp, player)
			if not ok then
				S.Net.logError("prompt", err)
			end
		end)
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
