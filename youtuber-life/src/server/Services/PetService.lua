--!nonstrict
-- PetService: mascotas.
--  * Se adoptan en la Tienda de mascotas Huellitas (máximo 3). Nombre filtrado, color, accesorios y juguetes.
--  * Solo una mascota sale contigo a la vez. Los peces se quedan en casa, en su acuario.
--  * La mascota activa es un modelo de Parts distinto por especie que te sigue de forma suave
--    (AlignPosition/AlignOrientation hacia un Attachment de tu HumanoidRootPart, con la propiedad de red
--    del jugador). Si se queda lejos (taxi, reaparición), el servidor la acerca. Se elimina al salir.
--  * Felicidad 0-100: baja muy despacio mientras juegas y sube al jugar, comer y pasear.
--    Si está baja, la mascota solo se ve triste: NUNCA penaliza tu progreso.
--  * Integración: fotos en modo "mascota" (+8 calidad, requiere tu mascota cerca) y escenas grabadas
--    con tu mascota cerca (+3 de interés, ver Pet.interestBonus).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local LifeData = require(Shared.LifeData)
local Util = require(Shared.Util)

local Pet = {}
local S
local Care = LifeData.PetCare
local spawned = {} -- [player] = { Id, Model, Root, Att, Follow, Align, Orient, Tag, Offset, Last }
local lastPlay = {} -- [player] = { [petId] = os.clock() }

function Pet.Init(services)
	S = services
end

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

local function rootOf(player)
	return player.Character and player.Character:FindFirstChild("HumanoidRootPart")
end

local function pets(data)
	data.Pets = data.Pets or {}
	return data.Pets
end

local function gear(data)
	data.PetGear = data.PetGear or {}
	data.PetGear.Acc = data.PetGear.Acc or {}
	data.PetGear.Toys = data.PetGear.Toys or {}
	return data.PetGear
end

local function moodIcon(rec)
	if rec.Happy < Care.SadBelow then
		return "😢"
	elseif rec.Happy >= Care.HappyAbove then
		return "💖"
	end
	return "🙂"
end

-- ¿Tiene el jugador una cama o rascador colocado en alguna de sus propiedades?
local function hasPetBed(data)
	for _, rec in pairs(data.Inventory or {}) do
		if type(rec.Loc) == "string" and rec.Loc:sub(1, 5) == "prop:" and Util.indexOf(Care.BedItems, rec.Id) then
			return true
		end
	end
	return false
end
Pet.hasPetBed = hasPetBed

---------------------------------------------------------------------------
-- Modelos (Parts sin anclar, soldadas a una raíz invisible; sin colisiones para no empujar a nadie)
---------------------------------------------------------------------------
-- Geometría de cada especie en "unidades de escala 1"; se multiplica por def.Size.
-- Cada parte: { nombre, tamaño, posición, color ("body" = color elegido), opciones }
-- Anclajes de accesorios: Neck (cuello), Head (parte alta de la cabeza), Eyes, HeadW (ancho de cabeza).
local DARK = { 35, 30, 30 }
local SPECIES = {
	dog = {
		RootY = 1.2,
		Parts = {
			{ "Body", { 1.2, 1, 2.2 }, { 0, 1.2, 0 }, "body" },
			{ "Head", { 1, 1, 1 }, { 0, 1.9, -1.3 }, "body" },
			{ "Snout", { 0.6, 0.45, 0.5 }, { 0, 1.7, -1.95 }, "light" },
			{ "Nose", { 0.22, 0.2, 0.15 }, { 0, 1.85, -2.22 }, DARK },
			{ "EarL", { 0.3, 0.6, 0.2 }, { -0.42, 2.2, -1.25 }, "dark" },
			{ "EarR", { 0.3, 0.6, 0.2 }, { 0.42, 2.2, -1.25 }, "dark" },
			{ "EyeL", { 0.15, 0.15, 0.08 }, { -0.25, 2.05, -1.82 }, DARK },
			{ "EyeR", { 0.15, 0.15, 0.08 }, { 0.25, 2.05, -1.82 }, DARK },
			{ "Tail", { 0.2, 0.2, 0.9 }, { 0, 1.6, 1.4 }, "body", { Rot = { 35, 0, 0 } } },
			{ "LegFL", { 0.35, 0.8, 0.35 }, { -0.4, 0.4, -0.8 }, "body" },
			{ "LegFR", { 0.35, 0.8, 0.35 }, { 0.4, 0.4, -0.8 }, "body" },
			{ "LegBL", { 0.35, 0.8, 0.35 }, { -0.4, 0.4, 0.8 }, "body" },
			{ "LegBR", { 0.35, 0.8, 0.35 }, { 0.4, 0.4, 0.8 }, "body" },
		},
		Neck = { 0, 1.5, -0.95 }, Head = { 0, 2.4, -1.3 }, Eyes = { 0, 2.05, -1.86 }, HeadW = 1,
	},
	cat = {
		RootY = 1.1,
		Parts = {
			{ "Body", { 1, 0.85, 2 }, { 0, 1.1, 0 }, "body" },
			{ "Head", { 0.95, 0.85, 0.85 }, { 0, 1.75, -1.15 }, "body" },
			{ "EarL", { 0.3, 0.4, 0.3 }, { -0.28, 2.35, -1.1 }, "body", { Class = "WedgePart" } },
			{ "EarR", { 0.3, 0.4, 0.3 }, { 0.28, 2.35, -1.1 }, "body", { Class = "WedgePart" } },
			{ "Nose", { 0.15, 0.12, 0.08 }, { 0, 1.68, -1.6 }, { 255, 150, 170 } },
			{ "EyeL", { 0.16, 0.16, 0.08 }, { -0.22, 1.85, -1.59 }, { 120, 200, 90 } },
			{ "EyeR", { 0.16, 0.16, 0.08 }, { 0.22, 1.85, -1.59 }, { 120, 200, 90 } },
			{ "Tail", { 0.18, 1.3, 0.18 }, { 0, 1.75, 1.05 }, "body", { Rot = { -20, 0, 0 } } },
			{ "LegFL", { 0.28, 0.7, 0.28 }, { -0.32, 0.35, -0.7 }, "body" },
			{ "LegFR", { 0.28, 0.7, 0.28 }, { 0.32, 0.35, -0.7 }, "body" },
			{ "LegBL", { 0.28, 0.7, 0.28 }, { -0.32, 0.35, 0.7 }, "body" },
			{ "LegBR", { 0.28, 0.7, 0.28 }, { 0.32, 0.35, 0.7 }, "body" },
		},
		Neck = { 0, 1.4, -0.8 }, Head = { 0, 2.2, -1.15 }, Eyes = { 0, 1.85, -1.63 }, HeadW = 0.95,
	},
	bird = {
		RootY = 0, -- vuela: la raíz está en el centro del cuerpo
		Flies = true,
		Parts = {
			{ "Body", { 1.6, 1.6, 2 }, { 0, 0, 0 }, "body", { Ball = true } },
			{ "Head", { 1.1, 1.1, 1.1 }, { 0, 0.85, -0.85 }, "body", { Ball = true } },
			{ "Beak", { 0.3, 0.25, 0.55 }, { 0, 0.75, -1.5 }, { 255, 170, 40 } },
			{ "EyeL", { 0.16, 0.16, 0.08 }, { -0.3, 1, -1.3 }, DARK },
			{ "EyeR", { 0.16, 0.16, 0.08 }, { 0.3, 1, -1.3 }, DARK },
			{ "WingL", { 0.18, 0.9, 1.4 }, { -0.9, 0.1, 0 }, "dark", { Rot = { 0, 0, 25 } } },
			{ "WingR", { 0.18, 0.9, 1.4 }, { 0.9, 0.1, 0 }, "dark", { Rot = { 0, 0, -25 } } },
			{ "Tail", { 0.7, 0.15, 0.9 }, { 0, 0.1, 1.2 }, "dark", { Rot = { -15, 0, 0 } } },
		},
		Neck = { 0, 0.45, -0.7 }, Head = { 0, 1.45, -0.85 }, Eyes = { 0, 1, -1.36 }, HeadW = 1.1,
	},
	rabbit = {
		RootY = 1,
		Parts = {
			{ "Body", { 1.8, 1.6, 2.1 }, { 0, 1, 0.1 }, "body", { Ball = true } },
			{ "Head", { 1.3, 1.2, 1.2 }, { 0, 1.85, -0.8 }, "body", { Ball = true } },
			{ "EarL", { 0.3, 1.3, 0.18 }, { -0.25, 2.9, -0.75 }, "body", { Rot = { 0, 0, 8 } } },
			{ "EarR", { 0.3, 1.3, 0.18 }, { 0.25, 2.9, -0.75 }, "body", { Rot = { 0, 0, -8 } } },
			{ "Nose", { 0.18, 0.14, 0.1 }, { 0, 1.8, -1.42 }, { 255, 150, 170 } },
			{ "EyeL", { 0.16, 0.16, 0.08 }, { -0.3, 2, -1.33 }, DARK },
			{ "EyeR", { 0.16, 0.16, 0.08 }, { 0.3, 2, -1.33 }, DARK },
			{ "Tail", { 0.6, 0.6, 0.6 }, { 0, 1.1, 1.2 }, { 250, 250, 250 }, { Ball = true } },
			{ "FootL", { 0.4, 0.3, 0.9 }, { -0.5, 0.15, 0.3 }, "body" },
			{ "FootR", { 0.4, 0.3, 0.9 }, { 0.5, 0.15, 0.3 }, "body" },
		},
		Neck = { 0, 1.45, -0.6 }, Head = { 0, 2.45, -0.8 }, Eyes = { 0, 2, -1.38 }, HeadW = 1.3,
	},
	turtle = {
		RootY = 0.7,
		Slow = true,
		Parts = {
			{ "Shell", { 2.8, 1.5, 3.2 }, { 0, 0.85, 0 }, "body", { Ball = true } },
			{ "Belly", { 2.4, 0.35, 2.8 }, { 0, 0.45, 0 }, { 230, 210, 150 } },
			{ "Head", { 0.9, 0.8, 1 }, { 0, 0.8, -1.95 }, { 120, 170, 90 }, { Ball = true } },
			{ "EyeL", { 0.14, 0.14, 0.08 }, { -0.22, 0.95, -2.42 }, DARK },
			{ "EyeR", { 0.14, 0.14, 0.08 }, { 0.22, 0.95, -2.42 }, DARK },
			{ "LegFL", { 0.6, 0.4, 0.6 }, { -1.05, 0.2, -0.9 }, { 120, 170, 90 } },
			{ "LegFR", { 0.6, 0.4, 0.6 }, { 1.05, 0.2, -0.9 }, { 120, 170, 90 } },
			{ "LegBL", { 0.6, 0.4, 0.6 }, { -1.05, 0.2, 0.9 }, { 120, 170, 90 } },
			{ "LegBR", { 0.6, 0.4, 0.6 }, { 1.05, 0.2, 0.9 }, { 120, 170, 90 } },
		},
		Neck = { 0, 0.75, -1.5 }, Head = { 0, 1.2, -1.95 }, Eyes = { 0, 0.95, -2.46 }, HeadW = 0.9,
	},
}
Pet.Species = SPECIES

local function weld(a, b)
	local w = Instance.new("WeldConstraint")
	w.Part0 = a
	w.Part1 = b
	w.Parent = a
end

-- Crea una parte de la mascota soldada a la raíz
local function piece(m, root, name, size, cf, color, opts)
	opts = opts or {}
	local p = Instance.new(opts.Class or "Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = typeof(color) == "Color3" and color or rgb(color)
	p.Material = opts.Material or Enum.Material.SmoothPlastic
	if opts.Ball then
		p.Shape = Enum.PartType.Ball
	elseif opts.Cylinder then
		p.Shape = Enum.PartType.Cylinder
	end
	if opts.Transparency then
		p.Transparency = opts.Transparency
	end
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = m
	weld(root, p)
	return p
end

local function shade(c, k)
	return { math.floor(c[1] * k), math.floor(c[2] * k), math.floor(c[3] * k) }
end

local function rotOf(o)
	if o and o.Rot then
		return CFrame.Angles(math.rad(o.Rot[1]), math.rad(o.Rot[2]), math.rad(o.Rot[3]))
	end
	return CFrame.new()
end

-- Accesorio sobre los anclajes de la especie (base = CFrame del suelo bajo la mascota)
local function buildAccessory(m, root, spec, acc, base, k)
	local function at(anchor, dx, dy, dz)
		return base * CFrame.new((anchor[1] + (dx or 0)) * k, (anchor[2] + (dy or 0)) * k, (anchor[3] + (dz or 0)) * k)
	end
	local hw = spec.HeadW
	if acc == "Collar rojo" then
		piece(m, root, "AccCollar", Vector3.new(hw * 0.95 * k, 0.2 * k, hw * 0.7 * k), at(spec.Neck), { 210, 30, 40 })
		piece(m, root, "AccTag", Vector3.new(0.22 * k, 0.22 * k, 0.22 * k), at(spec.Neck, 0, -0.18, -hw * 0.38), { 255, 205, 60 }, { Ball = true, Material = Enum.Material.Metal })
	elseif acc == "Pajarita" then
		piece(m, root, "AccBowKnot", Vector3.new(0.18 * k, 0.18 * k, 0.12 * k), at(spec.Neck, 0, 0, -hw * 0.4), { 40, 40, 120 })
		piece(m, root, "AccBowL", Vector3.new(0.32 * k, 0.26 * k, 0.1 * k), at(spec.Neck, -0.22, 0, -hw * 0.4) * CFrame.Angles(0, 0, math.rad(15)), { 60, 60, 170 })
		piece(m, root, "AccBowR", Vector3.new(0.32 * k, 0.26 * k, 0.1 * k), at(spec.Neck, 0.22, 0, -hw * 0.4) * CFrame.Angles(0, 0, math.rad(-15)), { 60, 60, 170 })
	elseif acc == "Gorrito" then
		-- gorro de fiesta: cilindros cada vez más estrechos y un pompón
		for i = 0, 2 do
			local dia = hw * (0.6 - i * 0.17)
			piece(m, root, "AccHat", Vector3.new(0.25 * k, dia * k, dia * k), at(spec.Head, 0, 0.12 + i * 0.24, 0) * CFrame.Angles(0, 0, math.rad(90)), i % 2 == 0 and { 255, 210, 40 } or { 80, 170, 255 }, { Cylinder = true })
		end
		piece(m, root, "AccPompom", Vector3.new(0.22 * k, 0.22 * k, 0.22 * k), at(spec.Head, 0, 0.82, 0), { 255, 70, 110 }, { Ball = true })
	elseif acc == "Pañuelo" then
		piece(m, root, "AccScarf", Vector3.new(hw * 0.9 * k, 0.45 * k, 0.12 * k), at(spec.Neck, 0, -0.15, -hw * 0.38) * CFrame.Angles(0, math.rad(180), 0), { 60, 140, 230 }, { Class = "WedgePart", Material = Enum.Material.Fabric })
	elseif acc == "Gafas de sol" then
		piece(m, root, "AccLensL", Vector3.new(0.3 * k, 0.2 * k, 0.06 * k), at(spec.Eyes, -hw * 0.24, 0, -0.02), { 15, 15, 20 }, { Material = Enum.Material.Glass })
		piece(m, root, "AccLensR", Vector3.new(0.3 * k, 0.2 * k, 0.06 * k), at(spec.Eyes, hw * 0.24, 0, -0.02), { 15, 15, 20 }, { Material = Enum.Material.Glass })
		piece(m, root, "AccBridge", Vector3.new(hw * 0.25 * k, 0.05 * k, 0.05 * k), at(spec.Eyes, 0, 0.05, -0.02), { 15, 15, 20 })
	end
end

local function tagText(rec)
	local def = LifeData.PetById[rec.Species]
	return (def and def.Icon or "🐾") .. " " .. rec.Name .. " " .. moodIcon(rec)
end

-- Construye el modelo de una mascota. base = CFrame en el suelo bajo la mascota.
function Pet.buildModel(rec, base, owner)
	local def = LifeData.PetById[rec.Species]
	local spec = SPECIES[rec.Species]
	if not def or not spec then
		return nil
	end
	local k = def.Size
	local color = (LifeData.PetColors[rec.Color] or LifeData.PetColors[1])
	local m = Instance.new("Model")
	m.Name = "Mascota_" .. owner.Name
	local root = Instance.new("Part")
	root.Name = "PetRoot"
	root.Size = Vector3.new(1, 1, 1)
	root.CFrame = base * CFrame.new(0, spec.RootY * k, 0)
	root.Transparency = 1
	root.Anchored = false
	root.CanCollide = false
	root.CanTouch = false
	root.CanQuery = false
	root.Parent = m
	m.PrimaryPart = root
	for _, pd in ipairs(spec.Parts) do
		local c = pd[4]
		if c == "body" then
			c = color
		elseif c == "dark" then
			c = shade(color, 0.7)
		elseif c == "light" then
			c = { math.min(255, color[1] + 40), math.min(255, color[2] + 40), math.min(255, color[3] + 40) }
		end
		local size = Vector3.new(pd[2][1] * k, pd[2][2] * k, pd[2][3] * k)
		local cf = base * CFrame.new(pd[3][1] * k, pd[3][2] * k, pd[3][3] * k) * rotOf(pd[5])
		piece(m, root, pd[1], size, cf, c, pd[5])
	end
	buildAccessory(m, root, spec, rec.Acc, base, k)
	-- Seguimiento suave
	local att = Instance.new("Attachment")
	att.Name = "PetAttachment"
	att.Parent = root
	local align = Instance.new("AlignPosition")
	align.Name = "PetFollow"
	align.Attachment0 = att
	align.MaxForce = 30000
	align.MaxVelocity = spec.Slow and 20 or 45
	align.Responsiveness = spec.Slow and 10 or 22
	align.RigidityEnabled = false
	align.Parent = root
	local orient = Instance.new("AlignOrientation")
	orient.Name = "PetTurn"
	orient.Attachment0 = att
	orient.MaxTorque = 30000
	orient.Responsiveness = 14
	orient.Parent = root
	-- Nombre
	local bb = Instance.new("BillboardGui")
	bb.Name = "PetTag"
	bb.Size = UDim2.fromOffset(160, 26)
	bb.StudsOffset = Vector3.new(0, 2.6 * k + 1, 0)
	bb.MaxDistance = 60
	bb.AlwaysOnTop = false
	bb.Parent = root
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 0.35
	t.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.Text = tagText(rec)
	t.Parent = bb
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = t
	m:SetAttribute("YTPet", true)
	m:SetAttribute("Owner", owner.UserId)
	m:SetAttribute("Species", rec.Species)
	m:SetAttribute("Sad", rec.Happy < Care.SadBelow)
	return m, root, att, align, orient, t
end

-- Posición junto al jugador (detrás y a la derecha; el pájaro vuela a la altura del hombro)
local function offsetFor(rec)
	local def = LifeData.PetById[rec.Species]
	local spec = SPECIES[rec.Species]
	if spec.Flies then
		return Vector3.new(2.2, 1.8, 0.5)
	end
	return Vector3.new(3, -3 + spec.RootY * def.Size, 2.5)
end

-- Attachment de destino dentro del HumanoidRootPart (se recrea si el personaje reaparece)
local function ensureFollow(sp, hrp, player)
	if sp.Follow and sp.Follow.Parent == hrp then
		return false
	end
	if sp.Follow then
		sp.Follow:Destroy()
	end
	local f = Instance.new("Attachment")
	f.Name = "PetFollowTarget"
	f.Position = sp.Offset
	f.Parent = hrp
	sp.Follow = f
	sp.Align.Attachment1 = f
	sp.Orient.Attachment1 = f
	pcall(function()
		sp.Root:SetNetworkOwner(player)
	end)
	return true
end

local function placeNear(sp, hrp)
	local p = hrp.Position + sp.Offset
	sp.Model:PivotTo(CFrame.new(p.X, p.Y, p.Z))
end

function Pet.despawn(player)
	local sp = spawned[player]
	if sp then
		if sp.Model then
			sp.Model:Destroy()
		end
		if sp.Follow then
			sp.Follow:Destroy()
		end
	end
	spawned[player] = nil
end

-- Saca una mascota (sustituye a la que estuviera fuera)
function Pet.spawn(player, id)
	local data = S.Data.get(player)
	local rec = data and pets(data)[id]
	if not rec then
		return false, "No tienes esa mascota."
	end
	local def = LifeData.PetById[rec.Species]
	if not def or not def.Follows or not SPECIES[rec.Species] then
		return false, "Los peces se quedan en casa, en su acuario. Visítalos en casa para jugar con ellos o darles de comer."
	end
	local hrp = rootOf(player)
	if not hrp then
		return false, "No puedes sacar a tu mascota ahora."
	end
	Pet.despawn(player)
	local offset = offsetFor(rec)
	local p = hrp.Position + offset
	local base = CFrame.new(p.X, p.Y - SPECIES[rec.Species].RootY * def.Size, p.Z)
	local model, root, att, align, orient, tag = Pet.buildModel(rec, base, player)
	local sp = { Id = id, Model = model, Root = root, Att = att, Align = align, Orient = orient, Tag = tag, Offset = offset, Last = hrp.Position }
	spawned[player] = sp
	model.Parent = workspace
	ensureFollow(sp, hrp, player)
	data.ActivePet = id
	return true, def.Icon .. " " .. rec.Name .. " te acompaña. ¡Pasead juntos!"
end

function Pet.active(player)
	local sp = spawned[player]
	return sp and sp.Id or nil, sp and sp.Model or nil
end

-- Mascota visible junto al jugador: la activa si está cerca o, en casa, el acuario de peces.
function Pet.nearPet(player)
	local data = S.Data.get(player)
	if not data then
		return nil
	end
	local list = pets(data)
	local sp = spawned[player]
	local hrp = rootOf(player)
	if sp and hrp and sp.Model and sp.Model.Parent and list[sp.Id] then
		if (sp.Root.Position - hrp.Position).Magnitude <= Care.NearRadius then
			return sp.Id, list[sp.Id]
		end
	end
	if S.Home.isAtHome(player) then
		for id, rec in pairs(list) do
			if rec.Species == "fish" then
				return id, rec
			end
		end
	end
	return nil
end

-- +3 de interés en escenas grabadas con tu mascota cerca (lo suma VideoService)
function Pet.interestBonus(player)
	return Pet.nearPet(player) and Care.SceneInterest or 0
end

-- Foto en modo mascota: devuelve el bonus de calidad y la mascota, o nil y un mensaje claro
function Pet.photoBonus(player)
	local id, rec = Pet.nearPet(player)
	if id then
		return Care.PhotoBonus, rec
	end
	local data = S.Data.get(player)
	if not data or next(pets(data)) == nil then
		return nil, "Para una foto de mascota necesitas una mascota. Adopta una en la Tienda de mascotas Huellitas (Zona de apartamentos)."
	end
	return nil, "Tu mascota no está contigo: sácala desde la app Mascotas 🐾 para hacerle una foto."
end

local function refreshModel(player, id)
	local sp = spawned[player]
	if sp and sp.Id == id then
		Pet.spawn(player, id)
	end
end

local function updateTag(sp, rec)
	if sp.Tag then
		sp.Tag.Text = tagText(rec)
		sp.Tag.TextColor3 = rec.Happy < Care.SadBelow and Color3.fromRGB(170, 200, 255) or Color3.new(1, 1, 1)
	end
	sp.Model:SetAttribute("Sad", rec.Happy < Care.SadBelow)
end

-- ¿Puede cuidar a esta mascota aquí? (está contigo o estás en casa, donde viven tus mascotas)
local function canCare(player, id)
	local sp = spawned[player]
	local hrp = rootOf(player)
	if sp and sp.Id == id and hrp and (sp.Root.Position - hrp.Position).Magnitude <= Care.NearRadius then
		return true
	end
	return S.Home.isAtHome(player)
end

local function cleanName(player, raw)
	local name = Util.cleanText(raw, Care.NameMax)
	if not name or #name < 1 then
		return nil, "Escribe un nombre para tu mascota."
	end
	local f = S.Text.filter(player, name)
	if not f or f == "" then
		return nil, "No se pudo comprobar ese nombre. Prueba con otro."
	end
	return f
end

local function happyAdd(rec, n)
	rec.Happy = Util.clamp((rec.Happy or Care.StartHappy) + n, 0, 100)
end

local function bestToy(data)
	local best = nil
	for id in pairs(gear(data).Toys) do
		local t = LifeData.PetToyById[id]
		if t and (not best or t.Bonus > best.Bonus) then
			best = t
		end
	end
	return best
end

local function petOf(player, p)
	local data = S.Data.get(player)
	if type(p.id) ~= "string" then
		return nil, nil, data
	end
	return pets(data)[p.id], LifeData.PetById[(pets(data)[p.id] or {}).Species or ""], data
end

local function atShop(player)
	return S.World.nearSpecial(player, "petshop", 45) ~= nil
end

local SHOP_HINT = "Ve a la Tienda de mascotas Huellitas (Zona de apartamentos)."

---------------------------------------------------------------------------
-- Paseo, felicidad y seguimiento (bucle cada segundo)
---------------------------------------------------------------------------
local function addWalk(player, data, rec, d)
	rec.Walk = (rec.Walk or 0) + d
	local before = math.floor((data.Counters.pet_walk_m or 0) / 100)
	data.Counters.pet_walk_m = (data.Counters.pet_walk_m or 0) + d
	local after = math.floor(data.Counters.pet_walk_m / 100)
	data.Counters.pet_walk = after
	if after > before then
		happyAdd(rec, Care.WalkHappy * (after - before))
		if S.Needs then
			S.Needs.change(player, 0, 1)
		end
		S.Quest.check(player)
	end
end

local function tickPlayer(player, decay)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local list = pets(data)
	if decay and next(list) ~= nil and not hasPetBed(data) then
		for _, rec in pairs(list) do
			happyAdd(rec, -Care.DecayPerMinute)
		end
	end
	data.ActivePet = data.ActivePet or ""
	if data.ActivePet ~= "" and not list[data.ActivePet] then
		data.ActivePet = ""
	end
	local sp = spawned[player]
	-- Tu mascota vuelve contigo al reaparecer o al volver a entrar
	if data.ActivePet ~= "" and (not sp or sp.Id ~= data.ActivePet or not sp.Model.Parent) and rootOf(player) then
		Pet.spawn(player, data.ActivePet)
		sp = spawned[player]
	end
	if not sp or not sp.Model.Parent then
		return
	end
	local hrp = rootOf(player)
	if not hrp then
		return
	end
	local rec = list[sp.Id]
	if ensureFollow(sp, hrp, player) then
		placeNear(sp, hrp)
	end
	local pos = hrp.Position
	local last = sp.Last
	sp.Last = pos
	if last then
		local d = (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(last.X, 0, last.Z)).Magnitude
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		local seated = hum and (hum.Sit == true or hum.SeatPart ~= nil)
		if d > 0.5 and d <= Care.WalkMaxStep and not seated then
			addWalk(player, data, rec, d)
		end
	end
	if (sp.Root.Position - pos).Magnitude > Care.SnapDistance then
		placeNear(sp, hrp)
	end
	updateTag(sp, rec)
end

---------------------------------------------------------------------------
-- Acciones
---------------------------------------------------------------------------
function Pet.Start()
	local Net = S.Net

	Net.on("Pet.Adopt", function(player, p)
		local data = S.Data.get(player)
		local def = type(p.species) == "string" and LifeData.PetById[p.species] or nil
		if not def then
			return false, "Especie no válida."
		end
		if not atShop(player) then
			return false, "Para adoptar, " .. SHOP_HINT:sub(1, 1):lower() .. SHOP_HINT:sub(2)
		end
		if Util.count(pets(data)) >= Care.MaxPets then
			return false, "Ya cuidas de " .. Care.MaxPets .. " mascotas: es el máximo para poder darles todo el cariño que necesitan."
		end
		local color = Util.clamp(math.floor(tonumber(p.color) or 1), 1, #LifeData.PetColors)
		local name
		if type(p.name) == "string" and Util.trim(p.name) ~= "" then
			local err
			name, err = cleanName(player, p.name)
			if not name then
				return false, err
			end
		end
		local price = math.floor(def.Price * S.Events.priceMultiplier({ Cat = "pet" }) + 0.5)
		if not S.Economy.spend(player, price, "Mascotas", "Adopción: " .. def.Name) then
			return false, "Adoptar " .. def.Name:lower() .. " cuesta $" .. Util.formatInt(price) .. " (vacunas y chip incluidos)."
		end
		local id = S.Data.nextUid(player, "pet")
		if not name then
			name = LifeData.PetNames[(data.Uid % #LifeData.PetNames) + 1]
		end
		pets(data)[id] = { Species = def.Id, Name = name, Color = color, Acc = "Ninguno", Happy = Care.StartHappy, Walk = 0, Fed = 0, Since = os.time() }
		data.Counters.pets_adopted = (data.Counters.pets_adopted or 0) + 1
		S.Progress.addXp(player, 15)
		S.Quest.check(player)
		if def.Follows then
			return true, def.Icon .. " ¡Bienvenido a la familia, " .. name .. "! Sácalo a pasear desde la app Mascotas 🐾.", { id = id }
		end
		return true, def.Icon .. " ¡Tu acuario con " .. name .. " ya está en casa! Visítalos para jugar y darles de comer.", { id = id }
	end)

	Net.on("Pet.Rename", function(player, p)
		local rec = petOf(player, p)
		if not rec then
			return false, "No tienes esa mascota."
		end
		local name, err = cleanName(player, p.name)
		if not name then
			return false, err
		end
		rec.Name = name
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			updateTag(sp, rec)
		end
		return true, "Ahora se llama " .. name .. "."
	end)

	Net.on("Pet.Color", function(player, p)
		local rec = petOf(player, p)
		local c = tonumber(p.color)
		if not rec or not c or not LifeData.PetColors[math.floor(c)] then
			return false, "Color no válido."
		end
		rec.Color = math.floor(c)
		refreshModel(player, p.id)
		return true, "🎨 " .. rec.Name .. " luce color " .. LifeData.PetColorNames[rec.Color]:lower() .. "."
	end)

	-- Compra (en la tienda) y/o pone un accesorio. Una vez comprado sirve para todas tus mascotas.
	Net.on("Pet.Accessory", function(player, p)
		local rec, _, data = petOf(player, p)
		local acc = p.acc
		if not rec then
			return false, "No tienes esa mascota."
		end
		if type(acc) ~= "string" or not Util.indexOf(LifeData.PetAccessories, acc) then
			return false, "Accesorio no válido."
		end
		local g = gear(data)
		local bought = false
		if acc ~= "Ninguno" and not g.Acc[acc] then
			if not atShop(player) then
				return false, "Compra accesorios en la tienda. " .. SHOP_HINT
			end
			local price = LifeData.PetAccessoryPrices[acc] or 0
			if not S.Economy.spend(player, price, "Mascotas", "Accesorio: " .. acc) then
				return false, acc .. " cuesta $" .. price .. "."
			end
			g.Acc[acc] = true
			bought = true
		end
		rec.Acc = acc
		refreshModel(player, p.id)
		if acc == "Ninguno" then
			return true, rec.Name .. " ya no lleva accesorio."
		end
		return true, (bought and "🛍 Comprado. " or "") .. rec.Name .. " lleva " .. acc:lower() .. "."
	end)

	Net.on("Pet.BuyToy", function(player, p)
		local data = S.Data.get(player)
		local toy = type(p.toy) == "string" and LifeData.PetToyById[p.toy] or nil
		if not toy then
			return false, "Juguete no válido."
		end
		local g = gear(data)
		if g.Toys[toy.Id] then
			return false, "Ya tienes " .. toy.Name:lower() .. "."
		end
		if not atShop(player) then
			return false, "Compra juguetes en la tienda. " .. SHOP_HINT
		end
		if not S.Economy.spend(player, toy.Price, "Mascotas", "Juguete: " .. toy.Name) then
			return false, toy.Name .. " cuesta $" .. toy.Price .. "."
		end
		g.Toys[toy.Id] = true
		return true, "🧸 " .. toy.Name .. ": jugar con tus mascotas las hará aún más felices (+" .. toy.Bonus .. ")."
	end)

	Net.on("Pet.Spawn", function(player, p)
		local data = S.Data.get(player)
		if type(p.id) ~= "string" or not pets(data)[p.id] then
			return false, "No tienes esa mascota."
		end
		local sp = spawned[player]
		if sp and sp.Id == p.id and sp.Model.Parent then
			return false, pets(data)[p.id].Name .. " ya está contigo."
		end
		return Pet.spawn(player, p.id)
	end)

	Net.on("Pet.Store", function(player)
		local data = S.Data.get(player)
		local sp = spawned[player]
		local id = (sp and sp.Id) or (data.ActivePet ~= "" and data.ActivePet) or nil
		if not id then
			return false, "No tienes ninguna mascota fuera."
		end
		Pet.despawn(player)
		data.ActivePet = ""
		local rec = pets(data)[id]
		return true, rec and (rec.Name .. " vuelve a casa a descansar.") or "Tu mascota vuelve a casa."
	end)

	Net.on("Pet.Play", function(player, p)
		local rec, def, data = petOf(player, p)
		if not rec then
			return false, "No tienes esa mascota."
		end
		if not canCare(player, p.id) then
			return false, "Para jugar con " .. rec.Name .. ", sácalo contigo o ve a casa."
		end
		lastPlay[player] = lastPlay[player] or {}
		local wait = Care.PlayCooldown - (os.clock() - (lastPlay[player][p.id] or -1e9))
		if wait > 0 then
			return false, rec.Name .. " está descansando un poco. Vuelve a jugar en " .. math.ceil(wait) .. " s."
		end
		lastPlay[player][p.id] = os.clock()
		local toy = bestToy(data)
		happyAdd(rec, Care.PlayHappy + (toy and toy.Bonus or 0))
		if S.Needs then
			S.Needs.change(player, 0, Care.PlayMood)
		end
		data.Counters.pet_play = (data.Counters.pet_play or 0) + 1
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			updateTag(sp, rec)
			local fx = Instance.new("Sparkles")
			fx.Parent = sp.Root
			task.delay(3, function()
				fx:Destroy()
			end)
		end
		return true, (def and def.Icon or "🐾") .. " Jugaste con " .. rec.Name .. (toy and (" (" .. toy.Name:lower() .. ")") or "") .. ": felicidad " .. math.floor(rec.Happy) .. "/100 · tu ánimo +" .. Care.PlayMood
	end)

	Net.on("Pet.Feed", function(player, p)
		local rec, def = petOf(player, p)
		if not rec or not def then
			return false, "No tienes esa mascota."
		end
		if not canCare(player, p.id) then
			return false, "Para dar de comer a " .. rec.Name .. ", sácalo contigo o ve a casa."
		end
		local wait = Care.FeedCooldown - (os.time() - (rec.Fed or 0))
		if wait > 0 then
			return false, rec.Name .. " ya ha comido. Podrás darle más en " .. math.ceil(wait) .. " s."
		end
		if not S.Economy.spend(player, def.Food, "Mascotas", "Comida para " .. rec.Name) then
			return false, "La comida cuesta $" .. def.Food .. "."
		end
		rec.Fed = os.time()
		happyAdd(rec, Care.FeedHappy)
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			updateTag(sp, rec)
		end
		return true, "🍖 " .. rec.Name .. " ha comido ($" .. def.Food .. "): felicidad " .. math.floor(rec.Happy) .. "/100"
	end)

	-- Si ya no puedes cuidarla, Huellitas le busca una familia (sin reembolso, sin penalización)
	Net.on("Pet.Rehome", function(player, p)
		local rec, _, data = petOf(player, p)
		if not rec then
			return false, "No tienes esa mascota."
		end
		if not atShop(player) then
			return false, "Habla con la cuidadora de la tienda. " .. SHOP_HINT
		end
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			Pet.despawn(player)
		end
		if data.ActivePet == p.id then
			data.ActivePet = ""
		end
		pets(data)[p.id] = nil
		return true, "💞 " .. rec.Name .. " se va a vivir con una familia que lo cuidará muy bien."
	end)

	Players.PlayerRemoving:Connect(function(player)
		Pet.despawn(player)
		lastPlay[player] = nil
	end)

	task.spawn(function()
		local ticks = 0
		while true do
			task.wait(1)
			ticks = ticks + 1
			local decay = ticks % 60 == 0
			for _, player in ipairs(Players:GetPlayers()) do
				local ok, err = pcall(tickPlayer, player, decay)
				if not ok then
					S.Net.logError("PetTick", err)
				end
			end
			for player in pairs(spawned) do
				if not player.Parent then
					Pet.despawn(player)
				end
			end
		end
	end)
end

return Pet
