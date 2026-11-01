--!nonstrict
-- VehicleService: concesionario, alquiler, garaje, colores, mejoras, combustible/batería, mantenimiento.
--  * Cada vehículo es un modelo con VehicleSeat. Al sentarse, el conductor recibe la propiedad de red y
--    VehicleController (cliente) aplica velocidad y giro con LinearVelocity/AngularVelocity (control suave).
--  * Las ruedas son las únicas piezas que tocan el suelo (sin fricción): el movimiento lo dan las
--    restricciones, así que el control es preciso y el vehículo sube bordillos sin atascarse.
--  * El servidor mide la distancia recorrida: gasta combustible/batería y desgasta el vehículo.
--  * Sin combustible se avanza muy despacio (nunca te quedas atrapado). Repostar en la gasolinera.
--  * Maletero: mientras estás cerca de tu vehículo, la mochila gana espacios (transporte de equipos).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local LifeData = require(Shared.LifeData)
local Util = require(Shared.Util)

local Vehicle = {}
local S
local spawned = {} -- [player] = { Id, Model, Seat, Chassis, Body, Last, Near, FuelStep }

Vehicle.MaxOwned = LifeData.MaxVehicles
Vehicle.TrunkRadius = 30
Vehicle.PaintCost = LifeData.PaintCost
Vehicle.KmPerStud = 0.001 -- 1 stud = 1 m (distancias del juego)

function Vehicle.Init(services)
	S = services
end

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

local function vehicles(data)
	data.Vehicles = data.Vehicles or {}
	return data.Vehicles
end

local function rentalActive(data)
	return data.Rental ~= nil and data.Rental.Rec ~= nil and S.Time.day() <= (data.Rental.Until or 0)
end

-- Registro de un vehículo del jugador ("rental" = alquiler activo)
local function recOf(data, id)
	if type(id) ~= "string" then
		return nil
	end
	if id == "rental" then
		return rentalActive(data) and data.Rental.Rec or nil
	end
	return vehicles(data)[id]
end
Vehicle.recOf = recOf

Vehicle.stats = LifeData.vehicleStats
Vehicle.fuelCost = LifeData.fuelCost
Vehicle.sellValue = LifeData.sellValue
Vehicle.rentPrice = LifeData.rentPrice

function Vehicle.repairCost(player, def, rec)
	local mult = 1
	if S.Company and S.Company.repairMult then
		mult = S.Company.repairMult(player) or 1
	end
	return math.ceil(LifeData.repairCost(def, rec) * mult)
end

function Vehicle.upgradeCost(rec, key)
	return LifeData.upgradeCost(LifeData.VehicleById[rec.Model], key)
end

function Vehicle.spawnedId(player)
	local sp = spawned[player]
	return sp and sp.Id or nil
end

function Vehicle.spawnedModel(player)
	local sp = spawned[player]
	return sp and sp.Model or nil
end

-- ¿Está el jugador cerca de su vehículo? Devuelve el registro activo.
local function nearRec(player)
	local sp = spawned[player]
	local data = S.Data.get(player)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not sp or not data or not root or not sp.Model.Parent then
		return nil
	end
	local a, b = sp.Chassis.Position, root.Position
	local dx, dz = a.X - b.X, a.Z - b.Z
	if dx * dx + dz * dz > Vehicle.TrunkRadius * Vehicle.TrunkRadius then
		return nil
	end
	return recOf(data, sp.Id)
end

-- Espacios extra de mochila si tu vehículo está cerca
function Vehicle.trunkBonus(player)
	local rec = nearRec(player)
	return rec and Vehicle.stats(rec).Trunk or 0
end

function Vehicle.despawn(player)
	local sp = spawned[player]
	if sp and sp.Model then
		sp.Model:Destroy()
	end
	spawned[player] = nil
end

local function part(parent, name, size, cf, color, material, collide)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = typeof(color) == "Color3" and color or rgb(color)
	p.Material = material or Enum.Material.SmoothPlastic
	p.CanCollide = collide == true
	p.Massless = not collide
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function weld(a, b)
	local w = Instance.new("WeldConstraint")
	w.Part0 = a
	w.Part1 = b
	w.Parent = a
end

-- Rueda: cilindro con el eje en X (lateral). Choca con el suelo sin fricción.
local function wheel(m, chassis, size, cf)
	local w = part(m, "Wheel", size, cf, { 20, 20, 22 }, Enum.Material.SmoothPlastic, true)
	w.Shape = Enum.PartType.Cylinder
	w.CustomPhysicalProperties = PhysicalProperties.new(0.7, 0, 0, 100, 1)
	weld(chassis, w)
	return w
end

local function applyAttributes(model, rec)
	local st = Vehicle.stats(rec)
	model:SetAttribute("MaxSpeed", st.Speed)
	model:SetAttribute("Turn", st.Turn)
	model:SetAttribute("Fuel", rec.Fuel)
	model:SetAttribute("Cond", rec.Cond)
end

function Vehicle.buildModel(def, rec, cf, owner, id)
	local m = Instance.new("Model")
	m.Name = def.Name
	local w, h, l = def.Size[1], def.Size[2], def.Size[3]
	local color = rgb((LifeData.VehicleColors[rec.Color] or LifeData.VehicleColors[1])[2])
	-- El chasis es la pieza raíz (con masa); no choca: solo las ruedas tocan el suelo.
	local chassis = part(m, "Chassis", Vector3.new(w, 0.6, l), cf * CFrame.new(0, 1.4, 0), { 40, 40, 44 }, Enum.Material.Metal, false)
	chassis.Massless = false
	chassis.CustomPhysicalProperties = PhysicalProperties.new(2, 0, 0, 1, 1)
	m.PrimaryPart = chassis
	local two = def.Type == "Bicicleta" or def.Type == "Patinete" or def.Type == "Motocicleta"
	local seatCF = cf * CFrame.new(0, 2.6, two and 0.4 or 1)
	local body
	if two then
		body = part(m, "Body", Vector3.new(0.8, 1.2, l * 0.7), cf * CFrame.new(0, 2, 0), color, Enum.Material.Metal)
		weld(chassis, body)
		for _, z in ipairs({ -l / 2 + 1.1, l / 2 - 1.1 }) do
			wheel(m, chassis, Vector3.new(0.5, 2.2, 2.2), cf * CFrame.new(0, 1.1, z))
		end
		local bar = part(m, "Handlebar", Vector3.new(2.2, 0.3, 0.3), cf * CFrame.new(0, 3.4, -l / 2 + 1.3), { 60, 60, 66 }, Enum.Material.Metal)
		weld(chassis, bar)
		if def.Type == "Motocicleta" then
			local light = part(m, "Headlight", Vector3.new(0.8, 0.6, 0.2), cf * CFrame.new(0, 2.8, -l / 2 + 0.9), { 255, 250, 220 }, Enum.Material.Neon)
			weld(chassis, light)
		end
	else
		-- Carrocería sólida (los peatones no la atraviesan); está por encima del suelo y no roza bordillos
		body = part(m, "Body", Vector3.new(w, h * 0.42, l), cf * CFrame.new(0, 1.7 + h * 0.21, 0), color, Enum.Material.SmoothPlastic, true)
		body.Massless = true
		weld(chassis, body)
		local cargo = def.Type == "Furgoneta" or def.Type == "Vehículo de carga"
		local cabinLen = cargo and l * 0.85 or l * 0.5
		local cabin = part(m, "Cabin", Vector3.new(w - 0.4, h * 0.4, cabinLen), cf * CFrame.new(0, 1.7 + h * 0.62, def.Type == "Vehículo de carga" and -l * 0.05 or 0.6), { 40, 50, 60 }, Enum.Material.Glass)
		cabin.Transparency = 0.25
		weld(chassis, cabin)
		for _, x in ipairs({ -w / 2 + 0.4, w / 2 - 0.4 }) do
			for _, z in ipairs({ -l / 2 + 2, l / 2 - 2 }) do
				wheel(m, chassis, Vector3.new(1.2, 2.4, 2.4), cf * CFrame.new(x, 1.2, z))
			end
		end
		for _, x in ipairs({ -w / 2 + 1, w / 2 - 1 }) do
			local light = part(m, "Headlight", Vector3.new(1, 0.6, 0.2), cf * CFrame.new(x, 1.7 + h * 0.21, -l / 2 - 0.1), { 255, 250, 220 }, Enum.Material.Neon)
			weld(chassis, light)
			local back = part(m, "Taillight", Vector3.new(1, 0.5, 0.2), cf * CFrame.new(x, 1.7 + h * 0.21, l / 2 + 0.1), { 220, 30, 30 }, Enum.Material.Neon)
			weld(chassis, back)
		end
	end
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriveSeat"
	seat.Size = Vector3.new(2, 0.6, 2)
	seat.CFrame = seatCF
	seat.Transparency = two and 0 or 1
	seat.Color = Color3.fromRGB(30, 30, 34)
	seat.MaxSpeed = 0
	seat.Torque = 0
	seat.HeadsUpDisplay = false
	seat.Massless = true
	seat.Parent = m
	weld(chassis, seat)
	-- Movimiento controlado por el conductor (ver cliente VehicleController)
	local att = Instance.new("Attachment")
	att.Name = "DriveAttachment"
	att.Parent = chassis
	local lv = Instance.new("LinearVelocity")
	lv.Name = "Drive"
	lv.Attachment0 = att
	lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	lv.PrimaryTangentAxis = Vector3.new(1, 0, 0)
	lv.SecondaryTangentAxis = Vector3.new(0, 0, 1)
	lv.RelativeTo = Enum.ActuatorRelativeTo.World
	lv.MaxForce = 1e6
	lv.PlaneVelocity = Vector2.new(0, 0)
	lv.Parent = chassis
	local av = Instance.new("AngularVelocity")
	av.Name = "Steer"
	av.Attachment0 = att
	av.RelativeTo = Enum.ActuatorRelativeTo.World
	av.MaxTorque = 1e7
	av.AngularVelocity = Vector3.new(0, 0, 0)
	av.Parent = chassis
	m:SetAttribute("YTVehicle", true)
	m:SetAttribute("VehicleId", id)
	m:SetAttribute("Model", def.Id)
	m:SetAttribute("FuelType", def.Fuel)
	m:SetAttribute("Owner", owner.UserId)
	applyAttributes(m, rec)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(180, 28)
	bb.StudsOffset = Vector3.new(0, h + 2, 0)
	bb.MaxDistance = 60
	bb.Parent = chassis
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 0.4
	t.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.Text = (two and "🛵 " or "🚗 ") .. owner.DisplayName
	t.Parent = bb
	m.Parent = workspace
	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		local hum = seat.Occupant
		if hum then
			local p = Players:GetPlayerFromCharacter(hum.Parent)
			if p ~= owner then
				-- solo el dueño conduce; los demás bajan
				task.defer(function()
					hum.Sit = false
				end)
				return
			end
			pcall(function()
				chassis:SetNetworkOwner(p)
			end)
		else
			lv.PlaneVelocity = Vector2.new(0, 0)
			av.AngularVelocity = Vector3.new(0, 0, 0)
		end
	end)
	return m, seat, chassis, body
end

-- Dónde aparece el vehículo: en la zona de entrega si estás en el concesionario; si no, delante de ti.
local function spawnCFrame(player, root)
	local dealer = S.World.nearSpecial(player, "dealer", 45)
	if dealer then
		local p = Vector3.new(dealer.WX + 14, 1.2, dealer.WZ + 40)
		return CFrame.lookAt(p, p + Vector3.new(0, 0, 1))
	end
	local look = root.CFrame and root.CFrame.LookVector or Vector3.new(0, 0, -1)
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude < 0.1 then
		flat = Vector3.new(0, 0, -1)
	end
	flat = flat.Unit
	local pos = root.Position + flat * 10
	local base = Vector3.new(pos.X, 1.2, pos.Z)
	return CFrame.lookAt(base, base + flat)
end

function Vehicle.spawn(player, id, rec)
	local def = LifeData.VehicleById[rec.Model]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not def or not root then
		return false, "No puedes sacar el vehículo ahora."
	end
	if S.Home.isAtHome(player) or S.Property.inside(player) then
		return false, "Sal a la calle para usar tu vehículo."
	end
	Vehicle.despawn(player)
	local cf = spawnCFrame(player, root)
	local model, seat, chassis, body = Vehicle.buildModel(def, rec, cf, player, id)
	spawned[player] = { Id = id, Model = model, Seat = seat, Chassis = chassis, Body = body, Last = chassis.Position, Near = nil, FuelStep = math.floor(rec.Fuel / 5) }
	S.Data.markDirty(player)
	return true, (def.Fuel == "none" and "🚲 " or "🚗 ") .. def.Name .. " listo. Siéntate (E) para conducir: W/S acelerar y frenar, A/D girar, Espacio para bajar.", { id = id }
end

-- Recorrido de un segundo: combustible, desgaste, cuentakilómetros y logros
function Vehicle.trackDistance(player, sp, data)
	local pos = sp.Chassis.Position
	local d = (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(sp.Last.X, 0, sp.Last.Z)).Magnitude
	sp.Last = pos
	if d <= 0.5 or d >= 400 then
		return 0
	end
	local rec = recOf(data, sp.Id)
	if not rec then
		return 0
	end
	local def = LifeData.VehicleById[rec.Model]
	rec.Odo = (rec.Odo or 0) + d
	if def.Fuel ~= "none" then
		local before = rec.Fuel
		rec.Fuel = math.max(0, rec.Fuel - d * def.Use / 300)
		if before > 0 and rec.Fuel <= 0 then
			S.Net.notify(player, def.Fuel == "battery" and "🔋 Batería agotada: vas muy despacio. Carga en una gasolinera o en casa." or "⛽ Sin combustible: vas muy despacio. Reposta en una gasolinera.", "warn")
		elseif before >= 15 and rec.Fuel < 15 then
			S.Net.notify(player, def.Fuel == "battery" and "🔋 Batería baja (" .. math.floor(rec.Fuel) .. "%)." or "⛽ Queda poco combustible (" .. math.floor(rec.Fuel) .. "%).", "warn")
		end
	end
	rec.Cond = math.max(20, rec.Cond - d / 2000)
	local km0 = data.Counters.drive_km or 0
	data.Counters.drive_m = (data.Counters.drive_m or 0) + d
	data.Counters.drive_km = math.floor(data.Counters.drive_m * Vehicle.KmPerStud)
	applyAttributes(sp.Model, rec)
	local step = math.floor(rec.Fuel / 5)
	if data.Counters.drive_km > km0 then
		S.Quest.check(player)
		S.Data.markDirty(player)
	elseif step ~= sp.FuelStep then
		S.Data.markDirty(player)
	end
	sp.FuelStep = step
	return d
end

function Vehicle.tick()
	for player, sp in pairs(spawned) do
		local data = S.Data.get(player)
		if not data or not player.Parent or not sp.Model.Parent or not sp.Chassis.Parent then
			if sp.Model then
				sp.Model:Destroy()
			end
			spawned[player] = nil
		elseif sp.Id == "rental" and not rentalActive(data) then
			Vehicle.despawn(player)
			data.Rental = nil
			S.Data.markDirty(player)
			S.Net.notify(player, "🔑 El alquiler ha terminado: el vehículo vuelve al concesionario.", "info")
		else
			Vehicle.trackDistance(player, sp, data)
			-- El maletero cambia la capacidad de la mochila: avisar al cliente al acercarse/alejarse
			local near = nearRec(player) ~= nil
			if near ~= sp.Near then
				sp.Near = near
				S.Data.markDirty(player)
			end
		end
	end
end

function Vehicle.Start()
	local Net = S.Net

	Net.on("Veh.Buy", function(player, p)
		local data = S.Data.get(player)
		local def = LifeData.VehicleById[p.model or ""]
		if not def then
			return false, "Modelo no válido."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Compra vehículos en el Concesionario Motor City (Distrito de concesionarios)."
		end
		if data.Level < def.Level then
			return false, "Necesitas nivel " .. def.Level .. "."
		end
		if Util.count(vehicles(data)) >= Vehicle.MaxOwned then
			return false, "Tu garaje está lleno (" .. Vehicle.MaxOwned .. " vehículos). Vende alguno primero."
		end
		local color = Util.clamp(math.floor(tonumber(p.color) or 1), 1, #LifeData.VehicleColors)
		local price = math.floor(def.Price * S.Events.priceMultiplier({ Cat = "vehicle" }) + 0.5)
		if not S.Economy.spend(player, price, "Vehículos", "Compra de " .. def.Name) then
			return false, "Cuesta $" .. Util.formatInt(price) .. ". Puedes alquilarlo mientras ahorras."
		end
		local id = S.Data.nextUid(player, "car")
		vehicles(data)[id] = { Model = def.Id, Color = color, Fuel = 100, Cond = 100, Upgrades = {}, Odo = 0, Paid = price, Extra = 0, Bought = S.Time.day() }
		data.Counters.vehicles_bought = (data.Counters.vehicles_bought or 0) + 1
		S.Quest.check(player)
		return true, "🔑 ¡" .. def.Name .. " es tuyo! Sácalo desde la app Vehículos (pestaña Mi garaje).", { id = id }
	end)

	Net.on("Veh.Rent", function(player, p)
		local data = S.Data.get(player)
		local def = LifeData.VehicleById[p.model or ""]
		if not def then
			return false, "Modelo no válido."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Alquila en el Concesionario Motor City."
		end
		if data.Level < def.Level then
			return false, "Necesitas nivel " .. def.Level .. " para conducirlo."
		end
		local color = Util.clamp(math.floor(tonumber(p.color) or 1), 1, #LifeData.VehicleColors)
		local price = Vehicle.rentPrice(def)
		if not S.Economy.spend(player, price, "Vehículos", "Alquiler de " .. def.Name .. " (1 día)") then
			return false, "El alquiler cuesta $" .. Util.formatInt(price) .. "."
		end
		if spawned[player] and spawned[player].Id == "rental" then
			Vehicle.despawn(player)
		end
		data.Rental = { Until = S.Time.day() + 1, Rec = { Model = def.Id, Color = color, Fuel = 100, Cond = 100, Upgrades = {}, Odo = 0 } }
		data.Counters.rentals_car = (data.Counters.rentals_car or 0) + 1
		local ok, msg = Vehicle.spawn(player, "rental", data.Rental.Rec)
		return true, "Alquilado hasta el día " .. data.Rental.Until .. ". " .. (ok and msg or ""), { id = "rental" }
	end)

	Net.on("Veh.Spawn", function(player, p)
		local data = S.Data.get(player)
		if p.id == "rental" and not rentalActive(data) then
			data.Rental = nil
			return false, "No tienes un alquiler activo."
		end
		local rec = recOf(data, p.id)
		if not rec then
			return false, "No tienes ese vehículo."
		end
		return Vehicle.spawn(player, p.id, rec)
	end)

	Net.on("Veh.Store", function(player)
		if not spawned[player] then
			return false, "No tienes ningún vehículo fuera."
		end
		Vehicle.despawn(player)
		return true, "Vehículo guardado en el garaje."
	end)

	local function refuelOrRepair(player, p, kind)
		local data = S.Data.get(player)
		local rec = recOf(data, p.id)
		if not rec then
			return false, "No tienes ese vehículo."
		end
		local def = LifeData.VehicleById[rec.Model]
		local msg
		if kind == "fuel" then
			if def.Fuel == "none" then
				return false, "La bicicleta no necesita combustible."
			end
			if not S.World.nearSpecial(player, "gas", 40) and not (def.Fuel == "battery" and S.Home.isAtHome(player)) then
				return false, def.Fuel == "battery" and "Carga en una gasolinera (tienen cargadores) o desde casa." or "Reposta en una gasolinera (Distrito industrial, Zona de apartamentos o Zona costera)."
			end
			if rec.Fuel > 99 then
				return false, def.Fuel == "battery" and "La batería ya está llena." or "El depósito ya está lleno."
			end
			local cost = Vehicle.fuelCost(def, rec)
			if not S.Economy.spend(player, cost, "Transporte", (def.Fuel == "battery" and "Carga de " or "Combustible para ") .. def.Name) then
				return false, "Cuesta $" .. cost .. "."
			end
			rec.Fuel = 100
			data.Counters.refuels = (data.Counters.refuels or 0) + 1
			msg = def.Fuel == "battery" and "🔋 Batería cargada al 100 % ($" .. cost .. ")." or "⛽ Depósito lleno ($" .. cost .. ")."
		else
			if rec.Cond >= 100 then
				return false, "Está perfecto."
			end
			if not S.World.nearSpecial(player, "gas", 40) and not S.World.nearSpecial(player, "dealer", 45) then
				return false, "El taller está en las gasolineras y en el concesionario."
			end
			local cost = Vehicle.repairCost(player, def, rec)
			if not S.Economy.spend(player, cost, "Reparaciones", "Taller: " .. def.Name) then
				return false, "La reparación cuesta $" .. Util.formatInt(cost) .. "."
			end
			rec.Cond = 100
			msg = "🔧 Vehículo reparado ($" .. Util.formatInt(cost) .. ")."
		end
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			applyAttributes(sp.Model, rec)
		end
		return true, msg
	end
	Net.on("Veh.Refuel", function(player, p)
		return refuelOrRepair(player, p, "fuel")
	end)
	Net.on("Veh.Repair", function(player, p)
		return refuelOrRepair(player, p, "repair")
	end)

	Net.on("Veh.Upgrade", function(player, p)
		local data = S.Data.get(player)
		local rec = vehicles(data)[p.id or ""]
		local up = LifeData.VehicleUpgrades[p.key or ""]
		if not rec or not up then
			return false, "Mejora no válida."
		end
		rec.Upgrades = rec.Upgrades or {}
		if rec.Upgrades[p.key] then
			return false, "Ya instalada."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Las mejoras se instalan en el taller del concesionario."
		end
		local cost = Vehicle.upgradeCost(rec, p.key)
		if not S.Economy.spend(player, cost, "Vehículos", up.Name .. " (" .. LifeData.VehicleById[rec.Model].Name .. ")") then
			return false, "Cuesta $" .. Util.formatInt(cost) .. "."
		end
		rec.Upgrades[p.key] = true
		rec.Extra = (rec.Extra or 0) + cost
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			applyAttributes(sp.Model, rec)
		end
		return true, "Mejora instalada: " .. up.Name .. " (" .. up.Desc .. ")."
	end)

	Net.on("Veh.Paint", function(player, p)
		local data = S.Data.get(player)
		local rec = vehicles(data)[p.id or ""]
		local c = tonumber(p.color)
		if not rec or not c or not LifeData.VehicleColors[c] then
			return false, "Color no válido."
		end
		c = math.floor(c)
		if rec.Color == c then
			return false, "Ya tiene ese color."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Pinta tu vehículo en el taller del concesionario."
		end
		if not S.Economy.spend(player, Vehicle.PaintCost, "Vehículos", "Pintura") then
			return false, "La pintura cuesta $" .. Vehicle.PaintCost .. "."
		end
		rec.Color = c
		local sp = spawned[player]
		if sp and sp.Id == p.id and sp.Body then
			sp.Body.Color = rgb(LifeData.VehicleColors[c][2])
		end
		return true, "🎨 Color cambiado a " .. LifeData.VehicleColors[c][1] .. "."
	end)

	Net.on("Veh.Sell", function(player, p)
		local data = S.Data.get(player)
		local rec = vehicles(data)[p.id or ""]
		if not rec then
			return false, "No tienes ese vehículo."
		end
		if spawned[player] and spawned[player].Id == p.id then
			Vehicle.despawn(player)
		end
		local value = Vehicle.sellValue(rec)
		vehicles(data)[p.id] = nil
		S.Economy.add(player, value, "Vehículos", "Venta de " .. LifeData.VehicleById[rec.Model].Name, {})
		return true, "Vendido por $" .. Util.formatInt(value) .. "."
	end)

	Players.PlayerRemoving:Connect(Vehicle.despawn)

	-- Consumo y desgaste según la distancia recorrida
	task.spawn(function()
		while true do
			task.wait(1)
			local ok, err = pcall(Vehicle.tick)
			if not ok then
				S.Net.logError("vehicles", err)
			end
		end
	end)
end

return Vehicle
