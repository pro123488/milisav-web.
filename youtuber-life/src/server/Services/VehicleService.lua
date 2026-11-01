--!nonstrict
-- VehicleService: concesionario, alquiler, garaje, colores, mejoras, combustible/batería, mantenimiento.
--  * Cada vehículo es un modelo con VehicleSeat. Al sentarse, el conductor recibe la propiedad de red y
--    VehicleController (cliente) aplica velocidad y giro con LinearVelocity/AngularVelocity (control suave).
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
local spawned = {} -- [player] = { Id, Model, Seat, Chassis, Last }

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

function Vehicle.stats(rec)
	local def = LifeData.VehicleById[rec.Model]
	local speed = def.Speed * (rec.Upgrades.engine and 1.15 or 1)
	if rec.Cond < 40 then
		speed = speed * 0.8
	end
	if def.Fuel ~= "none" and rec.Fuel <= 0 then
		speed = 8
	end
	return {
		Speed = speed,
		Turn = def.Turn * (rec.Upgrades.handling and 1.2 or 1),
		Trunk = def.Trunk + (rec.Upgrades.trunk and 3 or 0),
	}
end

-- Espacios extra de mochila si tu vehículo está cerca
function Vehicle.trunkBonus(player)
	local sp = spawned[player]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not sp or not root or not sp.Chassis.Parent then
		return 0
	end
	if (sp.Chassis.Position - root.Position).Magnitude > 30 then
		return 0
	end
	local data = S.Data.get(player)
	local rec = vehicles(data)[sp.Id] or (data.Rental and data.Rental.Rec)
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

function Vehicle.buildModel(def, rec, cf, owner)
	local m = Instance.new("Model")
	m.Name = def.Name
	local w, h, l = def.Size[1], def.Size[2], def.Size[3]
	local color = rgb((LifeData.VehicleColors[rec.Color] or LifeData.VehicleColors[1])[2])
	local chassis = part(m, "Chassis", Vector3.new(w, 1, l), cf * CFrame.new(0, 1.2, 0), { 40, 40, 44 }, Enum.Material.Metal, true)
	chassis.CustomPhysicalProperties = PhysicalProperties.new(2, 0, 0, 1, 1)
	m.PrimaryPart = chassis
	local two = def.Type == "Bicicleta" or def.Type == "Patinete" or def.Type == "Motocicleta"
	local seatCF = cf * CFrame.new(0, 2.3, two and 0 or 1)
	if two then
		local body = part(m, "Body", Vector3.new(0.8, 1.4, l * 0.7), cf * CFrame.new(0, 2, 0), color, Enum.Material.Metal)
		weld(chassis, body)
		for _, z in ipairs({ -l / 2 + 1, l / 2 - 1 }) do
			local wheel = part(m, "Wheel", Vector3.new(0.4, 2.2, 2.2), cf * CFrame.new(0, 1.1, z) * CFrame.Angles(0, 0, math.rad(90)), { 20, 20, 22 })
			wheel.Shape = Enum.PartType.Cylinder
			weld(chassis, wheel)
		end
		local bar = part(m, "Handlebar", Vector3.new(2, 0.3, 0.3), cf * CFrame.new(0, 3.3, -l / 2 + 1.2), { 60, 60, 66 }, Enum.Material.Metal)
		weld(chassis, bar)
	else
		local body = part(m, "Body", Vector3.new(w, h * 0.45, l), cf * CFrame.new(0, 1.2 + h * 0.3, 0), color, Enum.Material.SmoothPlastic)
		weld(chassis, body)
		local cabinLen = (def.Type == "Furgoneta" or def.Type == "Vehículo de carga") and l * 0.85 or l * 0.5
		local cabin = part(m, "Cabin", Vector3.new(w - 0.4, h * 0.4, cabinLen), cf * CFrame.new(0, 1.2 + h * 0.72, def.Type == "Vehículo de carga" and -l * 0.05 or 0.6), { 40, 50, 60 }, Enum.Material.Glass)
		cabin.Transparency = 0.25
		weld(chassis, cabin)
		for _, x in ipairs({ -w / 2, w / 2 }) do
			for _, z in ipairs({ -l / 2 + 2, l / 2 - 2 }) do
				local wheel = part(m, "Wheel", Vector3.new(1.2, 2.4, 2.4), cf * CFrame.new(x, 1.2, z) * CFrame.Angles(0, 0, math.rad(90)), { 20, 20, 22 })
				wheel.Shape = Enum.PartType.Cylinder
				weld(chassis, wheel)
			end
		end
		for _, x in ipairs({ -w / 2 + 1, w / 2 - 1 }) do
			local light = part(m, "Headlight", Vector3.new(1, 0.6, 0.2), cf * CFrame.new(x, 1.2 + h * 0.3, -l / 2 - 0.05), { 255, 250, 220 }, Enum.Material.Neon)
			weld(chassis, light)
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
	local st = Vehicle.stats(rec)
	m:SetAttribute("YTVehicle", true)
	m:SetAttribute("MaxSpeed", st.Speed)
	m:SetAttribute("Turn", st.Turn)
	m:SetAttribute("Owner", owner.UserId)
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
	t.Text = "🚗 " .. owner.DisplayName
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
	return m, seat, chassis
end

function Vehicle.spawn(player, id, rec)
	local def = LifeData.VehicleById[rec.Model]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false, "No puedes sacar el vehículo ahora."
	end
	if S.Home.isAtHome(player) or S.Property.inside(player) then
		return false, "Sal a la calle para usar tu vehículo."
	end
	Vehicle.despawn(player)
	local look = root.CFrame.LookVector
	local pos = root.Position + Vector3.new(look.X, 0, look.Z).Unit * 10
	local cf = CFrame.lookAt(Vector3.new(pos.X, 0.5, pos.Z), Vector3.new(pos.X + look.X, 0.5, pos.Z + look.Z))
	local model, seat, chassis = Vehicle.buildModel(def, rec, cf, player)
	spawned[player] = { Id = id, Model = model, Seat = seat, Chassis = chassis, Last = chassis.Position }
	return true, "🚗 " .. def.Name .. " listo. Siéntate (E) para conducir: W/S acelerar y frenar, A/D girar."
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
			return false, "Compra vehículos en el concesionario (Distrito de concesionarios)."
		end
		if data.Level < def.Level then
			return false, "Necesitas nivel " .. def.Level .. "."
		end
		if Util.count(vehicles(data)) >= 6 then
			return false, "Tu garaje está lleno (6 vehículos)."
		end
		local color = Util.clamp(math.floor(tonumber(p.color) or 1), 1, #LifeData.VehicleColors)
		local price = math.floor(def.Price * S.Events.priceMultiplier({ Cat = "vehicle" }) + 0.5)
		if not S.Economy.spend(player, price, "Vehículos", "Compra de " .. def.Name) then
			return false, "Cuesta $" .. Util.formatInt(price) .. ". Puedes alquilarlo mientras ahorras."
		end
		local id = S.Data.nextUid(player, "car")
		vehicles(data)[id] = { Model = def.Id, Color = color, Fuel = 100, Cond = 100, Upgrades = {}, Odo = 0, Paid = price }
		data.Counters.vehicles_bought = (data.Counters.vehicles_bought or 0) + 1
		S.Quest.check(player)
		return true, "🔑 ¡" .. def.Name .. " es tuyo! Sácalo desde la app Vehículos (en la calle).", { id = id }
	end)

	Net.on("Veh.Rent", function(player, p)
		local data = S.Data.get(player)
		local def = LifeData.VehicleById[p.model or ""]
		if not def then
			return false, "Modelo no válido."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Alquila en el concesionario."
		end
		local price = math.max(20, math.floor(def.Price * 0.02))
		if not S.Economy.spend(player, price, "Vehículos", "Alquiler de " .. def.Name .. " (1 día)") then
			return false, "El alquiler cuesta $" .. price .. "."
		end
		data.Rental = { Until = S.Time.day() + 1, Rec = { Model = def.Id, Color = 1, Fuel = 100, Cond = 100, Upgrades = {}, Odo = 0 } }
		data.Counters.rentals_car = (data.Counters.rentals_car or 0) + 1
		local ok, msg = Vehicle.spawn(player, "rental", data.Rental.Rec)
		return true, "Alquilado hasta el día " .. data.Rental.Until .. ". " .. (ok and msg or "")
	end)

	Net.on("Veh.Spawn", function(player, p)
		local data = S.Data.get(player)
		if p.id == "rental" then
			if not data.Rental or S.Time.day() > data.Rental.Until then
				data.Rental = nil
				return false, "No tienes un alquiler activo."
			end
			return Vehicle.spawn(player, "rental", data.Rental.Rec)
		end
		local rec = vehicles(data)[p.id or ""]
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
		local rec = vehicles(data)[p.id or ""]
		if not rec then
			return false, "No tienes ese vehículo."
		end
		local def = LifeData.VehicleById[rec.Model]
		if kind == "fuel" then
			if def.Fuel == "none" then
				return false, "La bicicleta no necesita combustible."
			end
			if not S.World.nearSpecial(player, "gas", 40) and not (def.Fuel == "battery" and S.Home.isAtHome(player)) then
				return false, def.Fuel == "battery" and "Carga en la gasolinera (tiene cargadores) o desde casa." or "Reposta en una gasolinera."
			end
			local need = 100 - rec.Fuel
			local cost = math.ceil(need * (def.Fuel == "battery" and 0.15 or 0.4))
			if need < 1 then
				return false, "Depósito lleno."
			end
			if not S.Economy.spend(player, cost, "Transporte", (def.Fuel == "battery" and "Carga de " or "Combustible para ") .. def.Name) then
				return false, "Cuesta $" .. cost .. "."
			end
			rec.Fuel = 100
		else
			if rec.Cond >= 100 then
				return false, "Está perfecto."
			end
			if not S.World.nearSpecial(player, "gas", 40) and not S.World.nearSpecial(player, "dealer", 45) then
				return false, "El taller está en la gasolinera y en el concesionario."
			end
			local cost = math.ceil(def.Price * 0.002 * (100 - rec.Cond) * (S.Company and S.Company.repairMult(player) or 1))
			if not S.Economy.spend(player, cost, "Reparaciones", "Taller: " .. def.Name) then
				return false, "La reparación cuesta $" .. cost .. "."
			end
			rec.Cond = 100
		end
		local sp = spawned[player]
		if sp and sp.Id == p.id then
			sp.Model:SetAttribute("MaxSpeed", Vehicle.stats(rec).Speed)
		end
		return true, kind == "fuel" and "⛽ Depósito lleno." or "🔧 Vehículo reparado."
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
		if rec.Upgrades[p.key] then
			return false, "Ya instalada."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Las mejoras se instalan en el concesionario."
		end
		local cost = math.floor(LifeData.VehicleById[rec.Model].Price * up.Rate)
		if not S.Economy.spend(player, cost, "Vehículos", up.Name) then
			return false, "Cuesta $" .. Util.formatInt(cost) .. "."
		end
		rec.Upgrades[p.key] = true
		return true, "Mejora instalada: " .. up.Name .. "."
	end)

	Net.on("Veh.Paint", function(player, p)
		local data = S.Data.get(player)
		local rec = vehicles(data)[p.id or ""]
		local c = tonumber(p.color)
		if not rec or not c or not LifeData.VehicleColors[c] then
			return false, "Color no válido."
		end
		if not S.World.nearSpecial(player, "dealer", 45) then
			return false, "Pinta tu vehículo en el concesionario."
		end
		if not S.Economy.spend(player, 200, "Vehículos", "Pintura") then
			return false, "La pintura cuesta $200."
		end
		rec.Color = c
		return true, "Color cambiado a " .. LifeData.VehicleColors[c][1] .. " (se verá al sacarlo de nuevo)."
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
		local value = math.floor((rec.Paid or 0) * 0.6 * rec.Cond / 100)
		vehicles(data)[p.id] = nil
		S.Economy.add(player, value, "Vehículos", "Venta de " .. LifeData.VehicleById[rec.Model].Name, {})
		return true, "Vendido por $" .. Util.formatInt(value) .. "."
	end)

	Players.PlayerRemoving:Connect(Vehicle.despawn)

	-- Consumo y desgaste según la distancia recorrida
	task.spawn(function()
		while true do
			task.wait(1)
			for player, sp in pairs(spawned) do
				local data = S.Data.get(player)
				if not data or not sp.Chassis.Parent then
					spawned[player] = nil
				else
					local pos = sp.Chassis.Position
					local d = (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(sp.Last.X, 0, sp.Last.Z)).Magnitude
					sp.Last = pos
					if d > 0.5 and d < 400 then
						local rec = sp.Id == "rental" and data.Rental and data.Rental.Rec or vehicles(data)[sp.Id]
						if rec then
							local def = LifeData.VehicleById[rec.Model]
							rec.Odo = rec.Odo + d
							if def.Fuel ~= "none" then
								local before = rec.Fuel
								rec.Fuel = math.max(0, rec.Fuel - d * def.Use / 300)
								if before > 0 and rec.Fuel <= 0 then
									S.Net.notify(player, "⛽ Sin combustible: vas muy despacio. Reposta en una gasolinera.", "warn")
								end
							end
							rec.Cond = math.max(20, rec.Cond - d / 6000)
							data.Counters.drive_km = math.floor(((data.Counters.drive_m or 0) + d) / 1000)
							data.Counters.drive_m = (data.Counters.drive_m or 0) + d
							sp.Model:SetAttribute("MaxSpeed", Vehicle.stats(rec).Speed)
						end
					end
				end
			end
		end
	end)
end

return Vehicle
