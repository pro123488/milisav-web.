--!nonstrict
-- PropertyService (Fase 2): inmobiliaria, contratos, interiores y modo construcción.
--  * Alquilar (primera semana + fianza), comprar, convertir alquiler en compra, terminar contrato, vender.
--  * Pagos cada 7 días JUGADOS: alquiler o mantenimiento. Impago = deuda + recargo. Tras 3 impagos un
--    alquiler se rescinde, pero los muebles vuelven al inventario (nunca se pierde nada).
--  * Cada jugador tiene un interior privado que se construye al entrar, con su decoración y muebles.
--  * Modo construcción: colocar, mover, rotar y recoger muebles; paredes, suelo, luz, cortinas, estilos,
--    mejoras (aislamiento, seguridad, almacenaje, iluminación) y diseños guardados.
--  * La decoración y las mejoras afectan de verdad a las grabaciones hechas dentro.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Catalog = require(Shared.ItemCatalog)
local PropertyData = require(Shared.PropertyData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)

local Property = {}
local S
local interiors = {} -- [player] = { Id, Origin, Model, W, D }
local slots = {} -- [index] = player
local folderRoot

Property.WallHeight = 14

function Property.Init(services)
	S = services
end

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

---------------------------------------------------------------------------
-- Posiciones exteriores (carteles en cada distrito)
---------------------------------------------------------------------------
function Property.signPosition(listing)
	local d = WorldData.DistrictById[listing.District]
	local cx, cz = WorldData.center(d)
	local idx = 0
	for _, l in ipairs(PropertyData.Listings) do
		if l.District == listing.District then
			idx = idx + 1
		end
		if l == listing then
			break
		end
	end
	return Vector3.new(cx - 66 + (idx - 1) * 26, 0.5, cz + 121)
end

---------------------------------------------------------------------------
-- Consultas
---------------------------------------------------------------------------
local function held(data, id)
	return data.Properties[id]
end

function Property.count(data)
	return Util.count(data.Properties)
end

function Property.storageCap(player)
	local data = S.Data.get(player)
	local cap = PropertyData.StarterStorage
	for id, rec in pairs(data.Properties) do
		local l = PropertyData.ById[id]
		if l then
			cap = cap + math.floor(l.Storage * (rec.Upgrades.storage and 1.5 or 1))
		end
	end
	return cap
end

function Property.storedCount(player)
	local data = S.Data.get(player)
	local n = 0
	for _, rec in pairs(data.Inventory) do
		if rec.Loc ~= "backpack" then
			n = n + 1
		end
	end
	return n
end

function Property.canStore(player, n)
	return Property.storedCount(player) + (n or 1) <= Property.storageCap(player)
end

function Property.inside(player)
	local it = interiors[player]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not it or not root then
		return nil
	end
	local rel = root.Position - it.Origin
	if math.abs(rel.X) <= it.W / 2 + 2 and math.abs(rel.Z) <= it.D / 2 + 2 and rel.Y > -5 and rel.Y < 30 then
		return it.Id
	end
	return nil
end

function Property.interiorInfo(player)
	local it = interiors[player]
	if not it then
		return nil
	end
	return { Id = it.Id, Origin = { it.Origin.X, it.Origin.Y, it.Origin.Z }, W = it.W, D = it.D }
end

-- Puntuación de decoración de una propiedad (0-45)
function Property.decorScore(player, id)
	local data = S.Data.get(player)
	local rec = data.Properties[id]
	if not rec then
		return 0
	end
	local score, styles = 0, {}
	for uid in pairs(rec.Placed) do
		local item = data.Inventory[uid]
		local def = item and Catalog.get(item.Id)
		if def then
			score = score + (def.Stats.Decor or 0) * (0.7 + 0.3 * def.Quality / 100)
			if def.Style then
				styles[def.Style] = (styles[def.Style] or 0) + 1
			end
		end
	end
	local bonus = 0
	for _, n in pairs(styles) do
		if n >= 3 then
			bonus = bonus + 5
		end
	end
	score = score + math.min(10, bonus)
	-- Paredes/suelo/luz que coinciden con un estilo
	for _, st in ipairs(PropertyData.Styles) do
		if st.Wall == rec.Decor.Wall and st.Floor == rec.Decor.Floor and st.Light == rec.Decor.Light then
			score = score + 4
			break
		end
	end
	if rec.Decor.Curtain then
		score = score + 1
	end
	return math.floor(math.min(45, score) * 10 + 0.5) / 10
end

-- Lugar de grabación cuando estás dentro de una propiedad
function Property.spot(player)
	local id = Property.inside(player)
	if not id then
		return nil
	end
	local data = S.Data.get(player)
	local l = PropertyData.ById[id]
	local rec = data.Properties[id]
	local tags = { "home" }
	for _, t in ipairs(l.Tags or {}) do
		if not Util.indexOf(tags, t) then
			tags[#tags + 1] = t
		end
	end
	if l.Kind == "studio" and not Util.indexOf(tags, "studio") then
		tags[#tags + 1] = "studio"
	end
	local decor = Property.decorScore(player, id)
	if decor >= 15 and not Util.indexOf(tags, "studio") then
		tags[#tags + 1] = "studio"
	end
	local acoustic = 0
	for uid in pairs(rec.Placed) do
		local item = data.Inventory[uid]
		local def = item and Catalog.get(item.Id)
		if def and def.Stats.Acoustic then
			acoustic = acoustic + def.Stats.Acoustic
		end
	end
	local noise = math.max(0, 2 - (rec.Upgrades.soundproof and 3 or 0) - math.min(4, acoustic))
	local light = (rec.Upgrades.lightrig and 20 or 0) + (rec.Decor.Light == 5 and 8 or 0)
	return {
		Id = "prop_" .. id,
		Name = l.Name,
		Tags = tags,
		Indoor = true,
		Interest = 5 + math.floor((l.Env + (rec.Upgrades.security and 5 or 0)) / 10) + math.floor(l.Studio / 3),
		Noise = noise,
		Busy = 0,
		IsHome = true,
		Decor = 5 + decor,
		ExtraLight = light,
		District = l.District,
	}
end

---------------------------------------------------------------------------
-- Construcción de interiores
---------------------------------------------------------------------------
local function P(parent, name, size, cf, color, material, opts)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
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
	end
	p.Parent = parent
	return p
end

local function addPrompt(part, action, text, objectText, attrs)
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = text
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

-- Modelo de un mueble (huella en el suelo centrada en cf)
function Property.furnitureModel(parent, def, cf, uid)
	local m = Instance.new("Model")
	m.Name = def.Name
	m:SetAttribute("FurnitureUid", uid)
	local c = rgb(def.Color)
	local f = def.Foot or { 4, 4, 3 }
	local w, d, h = f[1], f[2], f[3]
	local shape = def.Shape
	if shape == "sofa" then
		P(m, "Seat", Vector3.new(w, 1.4, d), cf * CFrame.new(0, 0.9, 0), c, Enum.Material.Fabric)
		P(m, "Back", Vector3.new(w, 2.2, 0.8), cf * CFrame.new(0, 2.4, -d / 2 + 0.4), c, Enum.Material.Fabric)
		P(m, "ArmL", Vector3.new(0.8, 1.8, d), cf * CFrame.new(-w / 2 + 0.4, 1.6, 0), c, Enum.Material.Fabric)
		P(m, "ArmR", Vector3.new(0.8, 1.8, d), cf * CFrame.new(w / 2 - 0.4, 1.6, 0), c, Enum.Material.Fabric)
	elseif shape == "lamp" then
		P(m, "Pole", Vector3.new(0.3, h - 1, 0.3), cf * CFrame.new(0, (h - 1) / 2, 0), { 40, 40, 44 }, Enum.Material.Metal)
		local shade = P(m, "Shade", Vector3.new(w, 1.2, d), cf * CFrame.new(0, h - 0.6, 0), c, Enum.Material.Neon)
		local l = Instance.new("PointLight")
		l.Range = 16
		l.Brightness = 1.2
		l.Color = c
		l.Parent = shade
	elseif shape == "painting" then
		P(m, "Stand", Vector3.new(0.3, 3, 0.3), cf * CFrame.new(0, 1.5, 0), { 60, 45, 35 }, Enum.Material.Wood)
		P(m, "Frame", Vector3.new(w, h, 0.3), cf * CFrame.new(0, 3 + h / 2 - 1, 0), { 60, 45, 35 }, Enum.Material.Wood)
		P(m, "Canvas", Vector3.new(w - 0.6, h - 0.6, 0.1), cf * CFrame.new(0, 3 + h / 2 - 1, 0.2), c, Enum.Material.SmoothPlastic)
	elseif shape == "plant" then
		P(m, "Pot", Vector3.new(w * 0.7, 1.4, d * 0.7), cf * CFrame.new(0, 0.7, 0), { 170, 90, 60 }, Enum.Material.Slate)
		P(m, "Leaves", Vector3.new(w, h - 1.4, d), cf * CFrame.new(0, 1.4 + (h - 1.4) / 2, 0), c, Enum.Material.Grass, { Shape = Enum.PartType.Ball })
	elseif shape == "rug" then
		P(m, "Rug", Vector3.new(w, 0.15, d), cf * CFrame.new(0, 0.08, 0), c, Enum.Material.Fabric, { NoCollide = true })
	elseif shape == "shelf" then
		P(m, "Shelf", Vector3.new(w, h, d), cf * CFrame.new(0, h / 2, 0), c, Enum.Material.WoodPlanks)
		for i = 1, 3 do
			P(m, "Items", Vector3.new(w - 1, 1, d * 0.6), cf * CFrame.new(0, i * h / 4, d * 0.15), { 200, 60 + i * 40, 80 }, Enum.Material.SmoothPlastic)
		end
	elseif shape == "bed" then
		P(m, "Frame", Vector3.new(w, 1, d), cf * CFrame.new(0, 0.5, 0), { 110, 80, 60 }, Enum.Material.Wood)
		P(m, "Mattress", Vector3.new(w - 0.4, 1, d - 0.4), cf * CFrame.new(0, 1.5, 0), c, Enum.Material.Fabric)
		P(m, "Pillow", Vector3.new(w - 1.5, 0.6, 1.4), cf * CFrame.new(0, 2.2, -d / 2 + 1.2), { 255, 255, 255 }, Enum.Material.Fabric)
	elseif shape == "table" or shape == "desk" then
		P(m, "Top", Vector3.new(w, 0.4, d), cf * CFrame.new(0, h - 0.2, 0), c, Enum.Material.WoodPlanks)
		for _, sx in ipairs({ -1, 1 }) do
			for _, sz in ipairs({ -1, 1 }) do
				P(m, "Leg", Vector3.new(0.4, h - 0.4, 0.4), cf * CFrame.new(sx * (w / 2 - 0.4), (h - 0.4) / 2, sz * (d / 2 - 0.4)), c, Enum.Material.Wood)
			end
		end
	elseif shape == "curtain" then
		P(m, "Rod", Vector3.new(w, 0.3, 0.3), cf * CFrame.new(0, h, 0), { 50, 50, 55 }, Enum.Material.Metal)
		P(m, "Curtain", Vector3.new(w, h, 0.3), cf * CFrame.new(0, h / 2, 0.2), c, Enum.Material.Fabric)
	elseif shape == "panel" then
		for i = 0, 2 do
			P(m, "Foam", Vector3.new(w / 3 - 0.2, h, 0.6), cf * CFrame.new(-w / 3 + i * w / 3, h / 2 + 1, 0), c, Enum.Material.Fabric)
		end
	elseif shape == "partition" then
		P(m, "Partition", Vector3.new(w, h, d), cf * CFrame.new(0, h / 2, 0), c, Enum.Material.Plaster)
	elseif shape == "neon" then
		P(m, "Stand", Vector3.new(0.3, 4, 0.3), cf * CFrame.new(0, 2, 0), { 30, 30, 34 }, Enum.Material.Metal)
		local sign = P(m, "Neon", Vector3.new(w, h, 0.3), cf * CFrame.new(0, 4 + h / 2, 0), c, Enum.Material.Neon)
		local gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Front
		gui.Parent = sign
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.TextScaled = true
		t.Font = Enum.Font.GothamBlack
		t.TextColor3 = Color3.new(1, 1, 1)
		t.Text = "ON AIR"
		t.Parent = gui
	elseif shape == "beanbag" then
		P(m, "Bag", Vector3.new(w, w, w), cf * CFrame.new(0, w / 2 - 0.4, 0), c, Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	elseif shape == "seccam" then
		P(m, "Pole", Vector3.new(0.3, 9, 0.3), cf * CFrame.new(0, 4.5, 0), { 40, 40, 44 }, Enum.Material.Metal)
		local cam = P(m, "Camera", Vector3.new(1, 0.8, 1.4), cf * CFrame.new(0, 9.4, 0), c, Enum.Material.Metal)
		P(m, "Led", Vector3.new(0.2, 0.2, 0.1), cam.CFrame * CFrame.new(0.3, 0.2, -0.72), { 255, 30, 30 }, Enum.Material.Neon)
	elseif shape == "chair" then
		P(m, "Seat", Vector3.new(w, 0.5, d), cf * CFrame.new(0, 1.8, 0), c)
		P(m, "Back", Vector3.new(w, 2.6, 0.4), cf * CFrame.new(0, 3.2, -d / 2 + 0.2), c)
		P(m, "Base", Vector3.new(0.5, 1.6, 0.5), cf * CFrame.new(0, 0.8, 0), { 40, 40, 44 }, Enum.Material.Metal)
	else
		P(m, "Body", Vector3.new(w, h, d), cf * CFrame.new(0, h / 2, 0), c)
	end
	m.Parent = parent
	return m
end

local function slotFor(player)
	for i = 1, 60 do
		if slots[i] == player then
			return i
		end
	end
	for i = 1, 60 do
		if slots[i] == nil then
			slots[i] = player
			return i
		end
	end
	return 60
end

function Property.buildInterior(player, id)
	local data = S.Data.get(player)
	local rec = data.Properties[id]
	local l = PropertyData.ById[id]
	if not rec or not l then
		return nil
	end
	if not folderRoot then
		folderRoot = workspace:FindFirstChild("Interiors") or Instance.new("Folder")
		folderRoot.Name = "Interiors"
		folderRoot.Parent = workspace
	end
	local old = interiors[player]
	if old and old.Model then
		old.Model:Destroy()
	end
	local index = slotFor(player)
	local origin = Vector3.new(-4200 - (index - 1) % 6 * 260, 0, (math.floor((index - 1) / 6)) * 260)
	local base = CFrame.new(origin)
	local m = Instance.new("Model")
	m.Name = "Interior_" .. player.UserId
	local W, D, H = l.W, l.D, Property.WallHeight
	local wall = PropertyData.Walls[rec.Decor.Wall] or PropertyData.Walls[1]
	local floor = PropertyData.Floors[rec.Decor.Floor] or PropertyData.Floors[1]
	local light = PropertyData.Lights[rec.Decor.Light] or PropertyData.Lights[2]
	local isLand = l.Kind == "land"
	P(m, "Floor", Vector3.new(W, 1, D), base * CFrame.new(0, -0.5, 0), isLand and { 90, 150, 80 } or floor[3], isLand and Enum.Material.Grass or Enum.Material[floor[2]])
	if isLand then
		for _, side in ipairs({ { 0, -D / 2, W, 0.5 }, { 0, D / 2, W, 0.5 }, { -W / 2, 0, 0.5, D }, { W / 2, 0, 0.5, D } }) do
			P(m, "Fence", Vector3.new(side[3], 3, side[4]), base * CFrame.new(side[1], 1.5, side[2]), { 240, 240, 240 }, Enum.Material.WoodPlanks)
		end
		P(m, "OuterGround", Vector3.new(W + 200, 1, D + 200), base * CFrame.new(0, -0.6, 0), { 80, 140, 70 }, Enum.Material.Grass)
	else
		P(m, "Ceiling", Vector3.new(W, 1, D), base * CFrame.new(0, H + 0.5, 0), { 245, 245, 245 }, Enum.Material.SmoothPlastic)
		for _, side in ipairs({ { 0, -D / 2, W, 1 }, { 0, D / 2, W, 1 }, { -W / 2, 0, 1, D }, { W / 2, 0, 1, D } }) do
			P(m, "Wall", Vector3.new(side[3], H, side[4]), base * CFrame.new(side[1], H / 2, side[2]), wall[2], Enum.Material.Plaster)
		end
		for i = -1, 1, 2 do
			local lamp = P(m, "CeilingLight", Vector3.new(4, 0.3, 4), base * CFrame.new(i * W / 4, H - 0.2, 0), light[2], Enum.Material.Neon)
			local pl = Instance.new("PointLight")
			pl.Range = math.max(W, D) * 0.7
			pl.Brightness = light[3]
			pl.Color = rgb(light[2])
			pl.Parent = lamp
		end
		-- Ventana con vista
		local win = P(m, "Window", Vector3.new(math.min(16, W - 8), 6, 0.3), base * CFrame.new(0, 7, -D / 2 + 0.7), { 150, 200, 240 }, Enum.Material.Glass, { Transparency = 0.2 })
		local gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Back
		gui.Parent = win
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.TextScaled = true
		t.Font = Enum.Font.GothamBold
		t.TextColor3 = Color3.fromRGB(255, 255, 255)
		t.TextTransparency = 0.4
		t.Text = l.View or "Vista a la ciudad"
		t.Parent = gui
		if rec.Decor.Curtain then
			P(m, "WindowCurtain", Vector3.new(3, 8, 0.3), base * CFrame.new(-math.min(16, W - 8) / 2 - 1.5, 7, -D / 2 + 1), { 140, 30, 50 }, Enum.Material.Fabric)
			P(m, "WindowCurtain", Vector3.new(3, 8, 0.3), base * CFrame.new(math.min(16, W - 8) / 2 + 1.5, 7, -D / 2 + 1), { 140, 30, 50 }, Enum.Material.Fabric)
		end
	end
	if l.Pool then
		local pool = P(m, "Pool", Vector3.new(W * 0.35, 0.4, D * 0.25), base * CFrame.new(W * 0.25, 0.05, D * 0.25), { 60, 180, 230 }, Enum.Material.Glass, { Transparency = 0.2, NoCollide = true })
		pool.Name = "Pool"
	end
	-- Puerta de salida
	local door = P(m, "ExitDoor", Vector3.new(6, 9, 0.6), base * CFrame.new(0, 4.5, D / 2 - 0.6), { 90, 60, 40 }, Enum.Material.Wood)
	addPrompt(door, "prop_exit", "Salir", l.Name)
	-- Puesto de trabajo y vestidor (viviendas, estudios y negocios)
	if l.Kind ~= "garage" and l.Kind ~= "land" then
		local deskCF = base * CFrame.new(-W / 2 + 6, 3.4, -D / 2 + 4)
		P(m, "Workdesk", Vector3.new(8, 0.5, 4), deskCF, { 120, 85, 60 }, Enum.Material.WoodPlanks)
		P(m, "Monitor", Vector3.new(3.2, 2, 0.25), deskCF * CFrame.new(0, 1.4, -1.2), { 20, 20, 24 })
		P(m, "Screen", Vector3.new(3, 1.8, 0.05), deskCF * CFrame.new(0, 1.4, -1.05), { 70, 140, 255 }, Enum.Material.Neon)
		local anchor = P(m, "DeskAnchor", Vector3.new(8, 4, 4), deskCF * CFrame.new(0, -1.5, 0), { 0, 0, 0 }, nil, { Transparency = 1, NoCollide = true })
		addPrompt(anchor, "computer_home", "Usar computador", l.Name, { Owner = player.UserId })
		local wardrobe = P(m, "Wardrobe", Vector3.new(2, 8, 5), base * CFrame.new(W / 2 - 1.6, 4, -D / 2 + 5), { 160, 120, 90 }, Enum.Material.WoodPlanks)
		addPrompt(wardrobe, "wardrobe", "Vestidor", "Cambiar estilo", { Owner = player.UserId })
	end
	-- Muebles colocados
	local furn = Instance.new("Folder")
	furn.Name = "Furniture"
	furn.Parent = m
	for uid, pos in pairs(rec.Placed) do
		local item = data.Inventory[uid]
		local def = item and Catalog.get(item.Id)
		if def then
			Property.furnitureModel(furn, def, base * CFrame.new(pos.X, 0, pos.Z) * CFrame.Angles(0, math.rad(pos.R or 0), 0), uid)
		end
	end
	m.Parent = folderRoot
	interiors[player] = { Id = id, Origin = origin, Model = m, W = W, D = D }
	S.Data.markDirty(player)
	return origin
end

function Property.enterCFrame(player, id)
	local origin = Property.buildInterior(player, id)
	if not origin then
		return nil
	end
	local l = PropertyData.ById[id]
	return CFrame.new(origin + Vector3.new(0, 3, l.D / 2 - 5))
end

---------------------------------------------------------------------------
-- Pagos periódicos
---------------------------------------------------------------------------
local function releaseFurniture(data, id)
	local rec = data.Properties[id]
	for uid in pairs(rec.Placed) do
		if data.Inventory[uid] then
			data.Inventory[uid].Loc = "home"
		end
	end
	rec.Placed = {}
end

function Property.onNewDay(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local day = data.Home.PlayDays
	for id, rec in pairs(data.Properties) do
		local l = PropertyData.ById[id]
		if l and day >= rec.NextDue then
			rec.NextDue = day + Config.RentPeriodDays
			local amount = rec.Mode == "rent" and l.Rent or l.Upkeep
			local label = (rec.Mode == "rent" and "Alquiler de " or "Mantenimiento de ") .. l.Name
			if amount > 0 and S.Economy.spend(player, amount, rec.Mode == "rent" and "Alquiler" or "Mantenimiento", label) then
				rec.Missed = 0
			elseif amount > 0 then
				local fee = math.floor(amount * Config.LateFeeRate + 0.5)
				rec.Debt = rec.Debt + amount + fee
				rec.Missed = rec.Missed + 1
				S.Net.notify(player, "⚠️ Impago: " .. label .. ". Deuda $" .. rec.Debt .. ". Págala en la app Inmobiliaria.", "warn")
				if rec.Mode == "rent" and rec.Missed >= 3 then
					releaseFurniture(data, id)
					data.Properties[id] = nil
					if data.HomeProperty == id then
						data.HomeProperty = ""
					end
					S.Net.notify(player, "📄 Contrato de «" .. l.Name .. "» rescindido por impago. Tus muebles están en tu inventario.", "error")
				end
			end
		end
	end
	S.Data.markDirty(player)
end

---------------------------------------------------------------------------
-- Validación de colocación
---------------------------------------------------------------------------
local function footprint(def, r)
	local f = def.Foot or { 4, 4, 3 }
	local w, d = f[1], f[2]
	if math.floor((r or 0) / 90) % 2 == 1 then
		w, d = d, w
	end
	return w, d
end

local function overlaps(data, rec, uid, def, x, z, r)
	local w, d = footprint(def, r)
	if def.Shape == "rug" then
		return false
	end
	for other, pos in pairs(rec.Placed) do
		if other ~= uid then
			local item = data.Inventory[other]
			local odef = item and Catalog.get(item.Id)
			if odef and odef.Shape ~= "rug" then
				local ow, od = footprint(odef, pos.R)
				if math.abs(x - pos.X) * 2 < (w + ow) - 0.2 and math.abs(z - pos.Z) * 2 < (d + od) - 0.2 then
					return true
				end
			end
		end
	end
	return false
end

local function placeValid(player, id, uid, x, z, r)
	local data = S.Data.get(player)
	local rec = data.Properties[id]
	local l = PropertyData.ById[id]
	local item = data.Inventory[uid]
	local def = item and Catalog.get(item.Id)
	if not def or not def.Placeable then
		return "Ese objeto no se puede colocar."
	end
	local w, d = footprint(def, r)
	if math.abs(x) + w / 2 > l.W / 2 - 0.5 or math.abs(z) + d / 2 > l.D / 2 - 0.5 then
		return "No cabe ahí: queda fuera de la sala."
	end
	-- dejar libre la puerta y el puesto de trabajo
	if math.abs(x) < 5 and z > l.D / 2 - 6 then
		return "No bloquees la puerta."
	end
	if l.Kind ~= "garage" and l.Kind ~= "land" and x < -l.W / 2 + 12 and z < -l.D / 2 + 8 then
		return "Ese espacio es el puesto de trabajo."
	end
	if overlaps(data, rec, uid, def, x, z, r) then
		return "Choca con otro mueble."
	end
	return nil
end

local function insideOwn(player)
	local id = Property.inside(player)
	if not id then
		return nil, "Entra en tu propiedad para usar el modo construcción."
	end
	return id
end

---------------------------------------------------------------------------
-- Acciones
---------------------------------------------------------------------------
local function newRecord(mode, day)
	return { Mode = mode, Since = os.time(), NextDue = day + Config.RentPeriodDays, Debt = 0, Missed = 0, Deposit = 0,
		Decor = { Wall = 1, Floor = 1, Light = 2, Curtain = false }, Placed = {}, Upgrades = {}, Presets = {}, Spent = 0 }
end

local function checkReq(data, l)
	if data.Level < (l.Req.Level or 1) then
		return "Necesitas nivel " .. l.Req.Level .. "."
	end
	if data.Channel.Subs < (l.Req.Subs or 0) then
		return "Necesitas " .. Util.formatInt(l.Req.Subs) .. " suscriptores."
	end
	return nil
end

local function totalDebt(data)
	local n = 0
	for _, rec in pairs(data.Properties) do
		n = n + rec.Debt
	end
	return n
end

function Property.exteriorOf(id)
	local l = PropertyData.ById[id]
	return l and Property.signPosition(l) + Vector3.new(0, 3, -6) or nil
end

function Property.Start()
	local Net = S.Net

	Net.on("Prop.Rent", function(player, p)
		local data = S.Data.get(player)
		local l = PropertyData.ById[p.id or ""]
		if not l or not l.Rent then
			return false, "Esta propiedad no se alquila."
		end
		if held(data, l.Id) then
			return false, "Ya tienes esta propiedad."
		end
		local err = checkReq(data, l)
		if err then
			return false, err
		end
		if Property.count(data) >= PropertyData.maxProperties(data.Level) then
			return false, "Has alcanzado el máximo de propiedades para tu nivel (" .. PropertyData.maxProperties(data.Level) .. ")."
		end
		if totalDebt(data) > 0 then
			return false, "Paga primero tus deudas inmobiliarias."
		end
		local cost = l.Rent * 2
		if not S.Economy.spend(player, cost, "Alquiler", "Contrato de alquiler: " .. l.Name .. " (semana + fianza)") then
			return false, "Necesitas $" .. Util.formatInt(cost) .. " (primera semana + fianza)."
		end
		local rec = newRecord("rent", data.Home.PlayDays)
		rec.Deposit = l.Rent
		data.Properties[l.Id] = rec
		if (l.Kind == "home" or l.Kind == "studio") and data.HomeProperty == "" then
			data.HomeProperty = l.Id
		end
		data.Counters.rentals = (data.Counters.rentals or 0) + 1
		S.Quest.check(player)
		return true, "📄 Contrato firmado: " .. l.Name .. ". Alquiler $" .. l.Rent .. " cada 7 días jugados; fianza $" .. l.Rent .. " (se devuelve al terminar sin deudas)."
	end)

	Net.on("Prop.Buy", function(player, p)
		local data = S.Data.get(player)
		local l = PropertyData.ById[p.id or ""]
		if not l or not l.Buy then
			return false, "Esta propiedad no está a la venta."
		end
		local current = held(data, l.Id)
		if current and current.Mode == "own" then
			return false, "Ya es tuya."
		end
		local err = checkReq(data, l)
		if err then
			return false, err
		end
		if not current and Property.count(data) >= PropertyData.maxProperties(data.Level) then
			return false, "Has alcanzado el máximo de propiedades para tu nivel (" .. PropertyData.maxProperties(data.Level) .. ")."
		end
		if totalDebt(data) > 0 then
			return false, "Paga primero tus deudas inmobiliarias."
		end
		if not S.Economy.spend(player, l.Buy, "Inmuebles", "Compra de " .. l.Name) then
			return false, "Necesitas $" .. Util.formatInt(l.Buy) .. ". Puedes alquilarla mientras ahorras."
		end
		if current then
			-- de alquiler a propiedad: se devuelve la fianza
			if current.Deposit > 0 then
				S.Economy.add(player, current.Deposit, "Fianzas", "Devolución de fianza de " .. l.Name, {})
			end
			current.Mode = "own"
			current.Deposit = 0
		else
			data.Properties[l.Id] = newRecord("own", data.Home.PlayDays)
			if (l.Kind == "home" or l.Kind == "studio") and data.HomeProperty == "" then
				data.HomeProperty = l.Id
			end
		end
		data.Counters.properties_bought = (data.Counters.properties_bought or 0) + 1
		S.Quest.check(player)
		return true, "🔑 ¡" .. l.Name .. " es tuya! Mantenimiento: $" .. l.Upkeep .. " cada 7 días."
	end)

	Net.on("Prop.EndRent", function(player, p)
		local data = S.Data.get(player)
		local rec = held(data, p.id or "")
		local l = PropertyData.ById[p.id or ""]
		if not rec or rec.Mode ~= "rent" then
			return false, "No tienes un alquiler aquí."
		end
		if Property.inside(player) == p.id then
			return false, "Sal de la propiedad antes de terminar el contrato."
		end
		local back = rec.Deposit - rec.Debt
		releaseFurniture(data, p.id)
		data.Properties[p.id] = nil
		if data.HomeProperty == p.id then
			data.HomeProperty = ""
		end
		if back > 0 then
			S.Economy.add(player, back, "Fianzas", "Devolución de fianza de " .. l.Name, {})
		elseif back < 0 then
			S.Economy.spend(player, math.min(-back, data.Money), "Alquiler", "Deuda pendiente de " .. l.Name)
		end
		return true, "Contrato terminado. Muebles devueltos a tu inventario." .. (back > 0 and (" Fianza devuelta: $" .. back) or "")
	end)

	Net.on("Prop.Sell", function(player, p)
		local data = S.Data.get(player)
		local rec = held(data, p.id or "")
		local l = PropertyData.ById[p.id or ""]
		if not rec or rec.Mode ~= "own" then
			return false, "No eres propietario de esta propiedad."
		end
		if Property.inside(player) == p.id then
			return false, "Sal de la propiedad antes de venderla."
		end
		local value = math.floor(l.Buy * l.Resale + (rec.Spent or 0) * 0.5 - rec.Debt)
		releaseFurniture(data, p.id)
		data.Properties[p.id] = nil
		if data.HomeProperty == p.id then
			data.HomeProperty = ""
		end
		S.Economy.add(player, math.max(0, value), "Inmuebles", "Venta de " .. l.Name, {})
		return true, "Vendiste " .. l.Name .. " por $" .. Util.formatInt(math.max(0, value)) .. "."
	end)

	Net.on("Prop.PayDebt", function(player, p)
		local data = S.Data.get(player)
		local rec = held(data, p.id or "")
		if not rec or rec.Debt <= 0 then
			return false, "No hay deuda en esta propiedad."
		end
		if not S.Economy.spend(player, rec.Debt, "Alquiler", "Pago de deuda inmobiliaria") then
			return false, "Necesitas $" .. Util.formatInt(rec.Debt) .. "."
		end
		rec.Debt = 0
		rec.Missed = 0
		return true, "Deuda pagada."
	end)

	Net.on("Prop.MoveIn", function(player, p)
		local data = S.Data.get(player)
		local id = p.id or ""
		if id == "" then
			data.HomeProperty = ""
			return true, "Vuelves a vivir en la Residencia Económica."
		end
		local l = PropertyData.ById[id]
		if not held(data, id) or (l.Kind ~= "home" and l.Kind ~= "studio") then
			return false, "Solo puedes vivir en viviendas o estudios que tengas."
		end
		data.HomeProperty = id
		return true, "🏠 Ahora vives en " .. l.Name .. ". Aparecerás aquí al entrar al juego."
	end)

	Net.on("Prop.Enter", function(player, p)
		local data = S.Data.get(player)
		local id = p.id or ""
		if not held(data, id) then
			return false, "No tienes acceso a esta propiedad."
		end
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		local ext = Property.exteriorOf(id)
		if not root or (root.Position - ext).Magnitude > 30 then
			return false, "Ve a la entrada de la propiedad (usa el taxi de la app Inmobiliaria)."
		end
		local cf = Property.enterCFrame(player, id)
		S.Travel.teleport(player, cf.Position)
		S.Quest.tutorialEvent(player, "enter_home")
		return true
	end)

	Net.on("Prop.Exit", function(player)
		local id = Property.inside(player)
		if not id then
			return false, "No estás dentro de una propiedad."
		end
		S.Travel.teleport(player, Property.exteriorOf(id))
		return true
	end)

	Net.on("Prop.Go", function(player, p)
		local l = PropertyData.ById[p.id or ""]
		if not l then
			return false, "Propiedad no encontrada."
		end
		return S.Travel.taxiTo(player, Property.exteriorOf(l.Id), l.Name)
	end)

	-- Modo construcción
	Net.on("Prop.Place", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local rec = data.Properties[id]
		local l = PropertyData.ById[id]
		local item = data.Inventory[p.uid or ""]
		if not item then
			return false, "No tienes ese objeto."
		end
		local already = rec.Placed[p.uid] ~= nil
		if not already and item.Loc ~= "home" then
			return false, "El objeto debe estar en casa (no en la mochila ni en otra propiedad)."
		end
		if not already and Util.count(rec.Placed) >= l.Slots then
			return false, "No hay más espacio para muebles aquí (" .. l.Slots .. ")."
		end
		local x, z = tonumber(p.x), tonumber(p.z)
		local r = math.floor((tonumber(p.r) or 0) / 90 + 0.5) % 4 * 90
		if not x or not z or x ~= x or z ~= z then
			return false, "Posición no válida."
		end
		x = math.floor(x * 2 + 0.5) / 2
		z = math.floor(z * 2 + 0.5) / 2
		local verr = placeValid(player, id, p.uid, x, z, r)
		if verr then
			return false, verr
		end
		rec.Placed[p.uid] = { X = x, Z = z, R = r }
		item.Loc = "prop:" .. id
		if not already then
			data.Counters.furniture_placed = (data.Counters.furniture_placed or 0) + 1
		end
		data.Counters.decor_max = math.max(data.Counters.decor_max or 0, math.floor(Property.decorScore(player, id)))
		Property.buildInterior(player, id)
		S.Quest.check(player)
		return true, (already and "Mueble movido." or "Mueble colocado.") .. " Decoración: " .. Property.decorScore(player, id) .. "/45"
	end)

	Net.on("Prop.Pick", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local rec = data.Properties[id]
		if not rec.Placed[p.uid or ""] then
			return false, "Ese mueble no está colocado aquí."
		end
		rec.Placed[p.uid] = nil
		if data.Inventory[p.uid] then
			data.Inventory[p.uid].Loc = "home"
		end
		Property.buildInterior(player, id)
		return true, "Mueble guardado en el inventario."
	end)

	Net.on("Prop.Rotate", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local pos = data.Properties[id].Placed[p.uid or ""]
		if not pos then
			return false, "Ese mueble no está colocado aquí."
		end
		local r = (pos.R + 90) % 360
		local verr = placeValid(player, id, p.uid, pos.X, pos.Z, r)
		if verr then
			return false, "No se puede girar: " .. verr
		end
		pos.R = r
		Property.buildInterior(player, id)
		return true
	end)

	Net.on("Prop.Decor", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local rec = data.Properties[id]
		local l = PropertyData.ById[id]
		local d = rec.Decor
		local cost, changed = 0, {}
		local function setIdx(key, list, value)
			local v = tonumber(value)
			if v and list[v] and d[key] ~= v then
				d[key] = v
				cost = cost + 50
				changed[#changed + 1] = key
			end
		end
		if p.style then
			local st = PropertyData.StyleById[p.style]
			if not st then
				return false, "Estilo no válido."
			end
			if not l.Remodel then
				return false, "En esta propiedad no se permite remodelar (solo la luz y las cortinas)."
			end
			local before = Util.deepCopy(d)
			d.Wall, d.Floor, d.Light = st.Wall, st.Floor, st.Light
			cost = 120
			if not S.Economy.spend(player, cost, "Remodelación", "Estilo " .. st.Name .. " en " .. l.Name) then
				rec.Decor = before
				return false, "Aplicar un estilo cuesta $" .. cost .. "."
			end
		else
			if (p.wall or p.floor) and not l.Remodel then
				return false, "En esta propiedad no se permite cambiar paredes ni suelos."
			end
			local before = Util.deepCopy(d)
			setIdx("Wall", PropertyData.Walls, p.wall)
			setIdx("Floor", PropertyData.Floors, p.floor)
			setIdx("Light", PropertyData.Lights, p.light)
			if p.curtain ~= nil and (p.curtain == true) ~= d.Curtain then
				d.Curtain = p.curtain == true
				cost = cost + 50
			end
			if cost == 0 then
				return false, "No hay cambios."
			end
			if not S.Economy.spend(player, cost, "Remodelación", "Decoración de " .. l.Name) then
				rec.Decor = before
				return false, "Cuesta $" .. cost .. "."
			end
		end
		rec.Spent = (rec.Spent or 0) + cost
		data.Counters.remodels = (data.Counters.remodels or 0) + 1
		data.Counters.decor_max = math.max(data.Counters.decor_max or 0, math.floor(Property.decorScore(player, id)))
		Property.buildInterior(player, id)
		S.Quest.check(player)
		return true, "Remodelación hecha ($" .. cost .. "). Decoración: " .. Property.decorScore(player, id) .. "/45"
	end)

	Net.on("Prop.Upgrade", function(player, p)
		local data = S.Data.get(player)
		local id = p.id or ""
		local rec = held(data, id)
		local up = PropertyData.Upgrades[p.key or ""]
		if not rec or not up then
			return false, "Mejora no válida."
		end
		if rec.Mode ~= "own" and p.key ~= "lightrig" then
			return false, "En un alquiler solo puedes instalar el rig de iluminación (es desmontable)."
		end
		if rec.Upgrades[p.key] then
			return false, "Ya está instalada."
		end
		if not S.Economy.spend(player, up.Cost, "Mejoras", up.Name .. " en " .. PropertyData.ById[id].Name) then
			return false, "Cuesta $" .. Util.formatInt(up.Cost) .. "."
		end
		rec.Upgrades[p.key] = true
		rec.Spent = (rec.Spent or 0) + up.Cost
		if interiors[player] and interiors[player].Id == id then
			Property.buildInterior(player, id)
		end
		return true, "Mejora instalada: " .. up.Name .. "."
	end)

	Net.on("Prop.SavePreset", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local rec = data.Properties[id]
		local name = Util.cleanText(p.name or "", 24) or ""
		if #name == 0 then
			name = "Diseño " .. (#rec.Presets + 1)
		end
		name = S.Text.filter(player, name) or ("Diseño " .. (#rec.Presets + 1))
		if #rec.Presets >= 3 then
			table.remove(rec.Presets, 1)
		end
		table.insert(rec.Presets, { Name = name, Layout = Util.deepCopy(rec.Placed), Decor = Util.deepCopy(rec.Decor) })
		return true, "Diseño «" .. name .. "» guardado."
	end)

	Net.on("Prop.LoadPreset", function(player, p)
		local data = S.Data.get(player)
		local id, err = insideOwn(player)
		if not id then
			return false, err
		end
		local rec = data.Properties[id]
		local preset = rec.Presets[tonumber(p.index) or 0]
		if not preset then
			return false, "Diseño no encontrado."
		end
		-- recoger todo y volver a colocar lo que siga disponible
		releaseFurniture(data, id)
		local placed, skipped = 0, 0
		for uid, pos in pairs(preset.Layout) do
			local item = data.Inventory[uid]
			if item and item.Loc == "home" and not placeValid(player, id, uid, pos.X, pos.Z, pos.R) then
				rec.Placed[uid] = { X = pos.X, Z = pos.Z, R = pos.R }
				item.Loc = "prop:" .. id
				placed = placed + 1
			else
				skipped = skipped + 1
			end
		end
		Property.buildInterior(player, id)
		return true, "Diseño aplicado: " .. placed .. " muebles colocados" .. (skipped > 0 and (", " .. skipped .. " no disponibles") or "") .. "."
	end)

	Players.PlayerRemoving:Connect(function(player)
		local it = interiors[player]
		if it and it.Model then
			it.Model:Destroy()
		end
		interiors[player] = nil
		for i = 1, 60 do
			if slots[i] == player then
				slots[i] = nil
			end
		end
	end)
end

return Property
