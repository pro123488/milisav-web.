--!nonstrict
-- VehicleController (cliente): conducción de los vehículos del juego.
--  * Cuando el Humanoid local está sentado en un VehicleSeat de un modelo con atributo YTVehicle,
--    cada fotograma lee Throttle/Steer del asiento y acelera o frena con suavidad hasta MaxSpeed.
--  * Aplica Drive.PlaneVelocity (X/Z del mundo según el LookVector del chasis) y Steer.AngularVelocity
--    (giro con el atributo Turn, invertido en marcha atrás y solo si hay velocidad).
--  * El conductor es el propietario de red del chasis, así que el movimiento es inmediato.
--  * Muestra un velocímetro con km/h ficticios y el combustible/batería. Al bajarse, velocidad 0.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local State = require(script.Parent.State)

local VC = {}
local player = Players.LocalPlayer

VC.KmhPerStud = 1.6 -- km/h ficticios por stud/s
VC.ReverseFactor = 0.4
VC.SteerMinSpeed = 12 -- por debajo de esta velocidad el giro se reduce

local speed = 0
local current -- { Seat, Model, Drive, Steer }
local hud, speedLabel, fuelLabel, fuelFill, nameLabel

local function clamp(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end

local function approach(v, target, delta)
	if v < target then
		return math.min(target, v + delta)
	end
	return math.max(target, v - delta)
end

-- Asiento de vehículo del juego en el que está sentado el jugador (o nil)
function VC.seat()
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local seat = hum and hum.SeatPart
	if not seat or not seat:IsA("VehicleSeat") then
		return nil
	end
	local model = seat.Parent
	if not model or not model:GetAttribute("YTVehicle") then
		return nil
	end
	return seat, model
end

local function stopVehicle(c)
	if not c then
		return
	end
	pcall(function()
		if c.Drive then
			c.Drive.PlaneVelocity = Vector2.new(0, 0)
		end
		if c.Steer then
			c.Steer.AngularVelocity = Vector3.new(0, 0, 0)
		end
	end)
end

local function ensureHud()
	if hud then
		return
	end
	local gui = player:FindFirstChild("PlayerGui")
	if not gui then
		return
	end
	hud = Instance.new("ScreenGui")
	hud.Name = "VehicleHUD"
	hud.ResetOnSpawn = false
	hud.IgnoreGuiInset = true
	hud.Enabled = false
	hud.Parent = gui
	local box = Instance.new("Frame")
	box.Name = "Speedometer"
	box.Size = UDim2.fromOffset(230, 92)
	box.Position = UDim2.new(1, -16, 1, -150)
	box.AnchorPoint = Vector2.new(1, 1)
	box.BackgroundColor3 = Color3.fromRGB(16, 17, 22)
	box.BackgroundTransparency = 0.15
	box.BorderSizePixel = 0
	box.Parent = hud
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = box
	nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, -16, 0, 18)
	nameLabel.Position = UDim2.fromOffset(8, 4)
	nameLabel.BackgroundTransparency = 1
	nameLabel.TextColor3 = Color3.fromRGB(160, 166, 184)
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.TextSize = 12
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left
	nameLabel.Parent = box
	speedLabel = Instance.new("TextLabel")
	speedLabel.Size = UDim2.new(1, -16, 0, 40)
	speedLabel.Position = UDim2.fromOffset(8, 20)
	speedLabel.BackgroundTransparency = 1
	speedLabel.TextColor3 = Color3.fromRGB(240, 242, 248)
	speedLabel.Font = Enum.Font.GothamBlack
	speedLabel.TextSize = 34
	speedLabel.TextXAlignment = Enum.TextXAlignment.Left
	speedLabel.Parent = box
	fuelLabel = Instance.new("TextLabel")
	fuelLabel.Size = UDim2.new(1, -16, 0, 14)
	fuelLabel.Position = UDim2.fromOffset(8, 60)
	fuelLabel.BackgroundTransparency = 1
	fuelLabel.TextColor3 = Color3.fromRGB(240, 242, 248)
	fuelLabel.Font = Enum.Font.Gotham
	fuelLabel.TextSize = 12
	fuelLabel.TextXAlignment = Enum.TextXAlignment.Left
	fuelLabel.Parent = box
	local bar = Instance.new("Frame")
	bar.Size = UDim2.new(1, -16, 0, 6)
	bar.Position = UDim2.fromOffset(8, 78)
	bar.BackgroundColor3 = Color3.fromRGB(48, 52, 66)
	bar.BorderSizePixel = 0
	bar.Parent = box
	fuelFill = Instance.new("Frame")
	fuelFill.Size = UDim2.fromScale(1, 1)
	fuelFill.BackgroundColor3 = Color3.fromRGB(60, 210, 120)
	fuelFill.BorderSizePixel = 0
	fuelFill.Parent = bar
end

-- Combustible: del perfil sincronizado (si está) o del atributo que actualiza el servidor
local function fuelOf(model)
	local attr = model:GetAttribute("Fuel")
	if attr then
		return attr
	end
	local id = model:GetAttribute("VehicleId")
	local data = State.Data
	local rec
	if data and id == "rental" then
		rec = data.Rental and data.Rental.Rec
	elseif data and id and data.Vehicles then
		rec = data.Vehicles[id]
	end
	return rec and rec.Fuel or nil
end

local function updateHud(model, maxSpeed)
	ensureHud()
	if not hud then
		return
	end
	hud.Enabled = true
	nameLabel.Text = model.Name .. (speed < -0.5 and " · R" or "")
	speedLabel.Text = math.floor(math.abs(speed) * VC.KmhPerStud + 0.5) .. " km/h"
	local kind = model:GetAttribute("FuelType")
	local fuel = fuelOf(model)
	if kind == "none" or fuel == nil then
		fuelLabel.Text = "🚲 Sin combustible · máx. " .. math.floor(maxSpeed * VC.KmhPerStud) .. " km/h"
		fuelFill.Size = UDim2.fromScale(1, 1)
		fuelFill.BackgroundColor3 = Color3.fromRGB(0, 190, 255)
	else
		local pct = clamp(fuel, 0, 100)
		fuelLabel.Text = (kind == "battery" and "🔋 Batería " or "⛽ Combustible ") .. math.floor(pct + 0.5) .. "%"
		fuelFill.Size = UDim2.fromScale(pct / 100, 1)
		if pct < 15 then
			fuelFill.BackgroundColor3 = Color3.fromRGB(255, 80, 80)
		elseif pct < 35 then
			fuelFill.BackgroundColor3 = Color3.fromRGB(255, 190, 40)
		else
			fuelFill.BackgroundColor3 = Color3.fromRGB(60, 210, 120)
		end
	end
end

local function hideHud()
	if hud then
		hud.Enabled = false
	end
end

function VC.speed()
	return speed
end

-- Un paso de conducción (se llama en cada RenderStepped)
function VC.step(dt)
	local seat, model = VC.seat()
	if not seat then
		if current then
			stopVehicle(current)
			current = nil
		end
		speed = 0
		hideHud()
		return
	end
	if not current or current.Seat ~= seat then
		stopVehicle(current)
		local chassis = model.PrimaryPart or model:FindFirstChild("Chassis")
		current = {
			Seat = seat,
			Model = model,
			Chassis = chassis,
			Drive = chassis and chassis:FindFirstChild("Drive"),
			Steer = chassis and chassis:FindFirstChild("Steer"),
		}
		speed = 0
	end
	local c = current
	if not c.Chassis or not c.Drive or not c.Steer then
		return
	end
	dt = clamp(dt or 1 / 60, 0, 0.1)
	local maxSpeed = model:GetAttribute("MaxSpeed") or 40
	local turn = model:GetAttribute("Turn") or 1.5
	local throttle = seat.Throttle or 0
	local steerIn = seat.Steer or 0
	-- Aceleración suave; frenar es más rápido que acelerar; marcha atrás más lenta
	local target = throttle * maxSpeed
	if throttle < 0 then
		target = throttle * maxSpeed * VC.ReverseFactor
	end
	local accel
	if throttle == 0 then
		accel = maxSpeed * 0.7
	elseif (speed > 0.5 and throttle < 0) or (speed < -0.5 and throttle > 0) then
		accel = maxSpeed * 2.2
	else
		accel = math.max(14, maxSpeed * 0.55)
	end
	speed = approach(speed, target, accel * dt)
	-- Si la velocidad máxima baja (sin combustible), se ajusta enseguida
	if speed > maxSpeed then
		speed = maxSpeed
	elseif speed < -maxSpeed * VC.ReverseFactor then
		speed = -maxSpeed * VC.ReverseFactor
	end
	local look = c.Chassis.CFrame.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude > 0.01 then
		flat = flat.Unit
	else
		flat = Vector3.new(0, 0, -1)
	end
	c.Drive.PlaneVelocity = Vector2.new(flat.X * speed, flat.Z * speed)
	-- Giro: proporcional a la velocidad (no gira parado) e invertido en marcha atrás
	local factor = clamp(math.abs(speed) / VC.SteerMinSpeed, 0, 1)
	local dir = speed >= 0 and 1 or -1
	c.Steer.AngularVelocity = Vector3.new(0, -steerIn * turn * factor * dir, 0)
	updateHud(model, maxSpeed)
end

function VC.start()
	local warned = false
	RunService.RenderStepped:Connect(function(dt)
		local ok, err = pcall(VC.step, dt)
		if not ok and not warned then
			warned = true
			warn("[YTLife] Vehículo: " .. tostring(err))
		end
	end)
	player.CharacterAdded:Connect(function()
		stopVehicle(current)
		current = nil
		speed = 0
		hideHud()
	end)
end

return VC
