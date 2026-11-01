-- Prueba del cliente: arranca el servidor simulado y el cliente real conectados entre sí,
-- abre TODAS las apps en cada superficie (computador, teléfono, panel) y pulsa todos sus botones.
-- Cualquier error de Lua en el código del cliente hace fallar la prueba.

local mainCo = coroutine.running()
local M = loadstring(MOCKS_SRC, "@mocks.lua")()
local game = M.newInstance("DataModel", { Name = "game" })
local services = M.build(game)

for i = 1, #ENTRIES do
	local e = ENTRIES[i]
	local parts = {}
	for p in e.logical:gmatch("[^/]+") do
		parts[#parts + 1] = p
	end
	local cur = services[parts[1]] or game:GetService(parts[1])
	for j = 2, #parts do
		local nxt = cur:FindFirstChild(parts[j])
		if not nxt then
			nxt = M.newInstance(j == #parts and "ModuleScript" or "Folder", { Name = parts[j] })
			nxt.Parent = cur
		end
		if j == #parts then
			nxt.Path = e.path
		end
		cur = nxt
	end
end

local mathx = setmetatable({ clamp = function(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end }, { __index = math })

local function makeEnv()
	local env = setmetatable({}, { __index = _G })
	local cache = {}
	env.require = function(inst)
		if cache[inst] ~= nil then
			return cache[inst]
		end
		assert(inst and inst.Path, "require de algo que no es módulo: " .. tostring(inst))
		local fn = assert(loadstring(READ(inst.Path), "@" .. inst.Path))
		setfenv(fn, setmetatable({ script = inst }, { __index = env }))
		local r = fn()
		cache[inst] = r
		return r
	end
	env.game = game
	env.workspace = M.workspace
	env.Instance = { new = function(class)
		return M.newInstance(class)
	end }
	env.Vector3, env.CFrame, env.Color3, env.UDim2, env.UDim, env.Enum, env.Random = M.Vector3, M.CFrame, M.Color3, M.UDim2, M.UDim, M.Enum, M.Random
	env.Vector2, env.ColorSequence, env.NumberSequence, env.NumberRange, env.TweenInfo = M.Vector2, M.ColorSequence, M.NumberSequence, M.NumberRange, M.TweenInfo
	env.PhysicalProperties = M.PhysicalProperties
	env.task = M.makeTask(mainCo)
	env.RaycastParams = { new = function()
		return {}
	end }
	env.math = mathx
	env.typeof = function(v)
		if type(v) == "table" and rawget(v, "__type") then
			return rawget(v, "__type")
		end
		return type(v)
	end
	env.warn = function(...)
		io.write("[warn] ", table.concat({ ... }, " "), "\n")
	end
	env.print = function() end
	env.os = { time = function()
		return M.time
	end, clock = function()
		return M.clock
	end, date = os.date }
	return env
end

-- Servidor
local senv = makeEnv()
local mainScript = services.ServerScriptService.Server.Main
local mainFn = assert(loadstring(READ(mainScript.Path), "@Main"))
setfenv(mainFn, setmetatable({ script = mainScript }, { __index = senv }))
mainFn()

-- Servicios del cliente
local Players = services.Players
local player = M.newPlayer(Players, 777, "ClientTester")
M.localPlayer = player
M.newInstance("PlayerGui", { Name = "PlayerGui" }).Parent = player
rawset(Players, "LocalPlayer", player)
local camera = M.newInstance("Camera", { Name = "Camera", ViewportSize = M.Vector2.new(1280, 720), CFrame = M.CFrame.new(0, 10, 0), FieldOfView = 70 })
camera.Parent = M.workspace
M.workspace.CurrentCamera = camera
rawset(M.workspace, "GetServerTimeNow", function()
	return M.time
end)
rawset(game:GetService("TweenService"), "Create", function()
	return { Play = function() end }
end)
rawset(game:GetService("UserInputService"), "GetFocusedTextBox", function()
	return nil
end)
rawset(game:GetService("StarterGui"), "SetCoreGuiEnabled", function() end)
rawset(game:GetService("SoundService"), "PlayLocalSound", function() end)
local mps = game:GetService("MarketplaceService")
rawset(mps, "PromptGamePassPurchase", function() end)
rawset(mps, "PromptProductPurchase", function() end)
rawset(game:GetService("HttpService"), "GenerateGUID", function()
	M.guid = (M.guid or 0) + 1
	return string.format("guid-%08d-abcdefghijklmnopqrstuvwxyz", M.guid)
end)

-- Cliente
local cenv = makeEnv()
local clientMain = services.StarterPlayer.StarterPlayerScripts.Client.Main
local cfn = assert(loadstring(READ(clientMain.Path), "@Main.client"))
setfenv(cfn, setmetatable({ script = clientMain }, { __index = cenv }))
cfn()

-- Entra el jugador: el servidor envía el perfil al cliente real
Players.PlayerAdded:Fire(player)
M.stepBackground()
local Client = services.StarterPlayer.StarterPlayerScripts.Client
local State = cenv.require(Client.State)
assert(State.Data and State.Data.Money, "el cliente debe recibir el perfil")

-- Preparar contenido real para que las apps tengan datos
local Remote = services.ReplicatedStorage.Remotes.Request
local function call(action, payload)
	M.clock = M.clock + 0.3
	return Remote.OnServerInvoke(player, action, payload)
end
local WB = senv.require(services.ServerScriptService.Server.Services.WorldBuilder)
local room
for _, r in ipairs(WB.HomeRooms) do
	if r.Owner == player then
		room = r
	end
end
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
local pid = call("Video.CreateProject", { category = "tech" }).data.pid
for i = 1, 3 do
	M.clock = M.clock + 5
	assert(call("Video.RecordScene", { shot = "wide" }).ok == false) -- sin sesión de grabación
end
call("Video.StartRecording", { pid = pid })
for i = 1, 3 do
	M.clock = M.clock + 5
	assert(call("Video.RecordScene", { shot = i == 1 and "talking" or "closeup" }).ok)
end
M.clock = M.clock + 3
assert(call("Photo.Take", { mode = "interior", cam = { 0, 5, 0, 0, 5, -10 } }).ok)
local Computer = senv.require(services.ServerScriptService.Server.Services.ComputerService)
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
call("Video.Import", { pid = pid })
local proj = senv.require(services.ServerScriptService.Server.Services.DataService).get(player).Projects[pid]
local tl = {}
for _, sc in ipairs(proj.Scenes) do
	tl[#tl + 1] = { k = "s", id = sc.Id, trim = 0.8, tr = "cut" }
end
assert(call("Video.SaveEdit", { pid = pid, edit = { Timeline = tl } }).ok)
local ex = call("Video.Export", { pid = pid })
M.time = M.time + ex.data.secs + 1
assert(call("Video.Publish", { pid = pid, title = "Mi primer vídeo de tecnología" }).ok)
call("Video.CreateProject", { category = "compare" })
M.time = M.time + 300
senv.require(services.ServerScriptService.Server.Services.ChannelService).tickPlayer(player)
M.stepBackground()

-- Pulsar todos los botones de un árbol de interfaz
local errors = {}
local clicks = 0
local function clickAll(root, label, limit)
	local buttons = {}
	for _, d in ipairs(root:GetDescendants()) do
		if d.__props.ClassName == "TextButton" and d.__props.Activated then
			buttons[#buttons + 1] = d
		end
	end
	for i, b in ipairs(buttons) do
		if i > (limit or 300) then
			break
		end
		local ok, err = pcall(function()
			b.__props.Activated:Fire(b)
		end)
		clicks = clicks + 1
		if not ok then
			errors[#errors + 1] = label .. " → «" .. tostring(b.__props.Text) .. "»: " .. tostring(err)
		end
		M.clock = M.clock + 0.2
	end
	local ok, err = pcall(M.stepBackground)
	if not ok then
		errors[#errors + 1] = label .. " (bucles): " .. tostring(err)
	end
end

local Registry = cenv.require(Client.AppRegistry)
local Shell = cenv.require(Client.Shell)
local UI = cenv.require(Client.UIKit)
local gui = player.PlayerGui.YoutuberLifeUI
assert(gui, "la interfaz principal debe existir")

-- Un vehículo en el garaje para que la app Vehículos muestre y pruebe todas sus acciones
senv.require(services.ServerScriptService.Server.Services.DataService).get(player).Vehicles = {
	car900 = { Model = "v_ev", Color = 3, Fuel = 40, Cond = 70, Upgrades = { engine = true }, Odo = 1234, Paid = 14000, Extra = 0 },
}
M.stepBackground()

local appCount = 0
for _, surface in ipairs({ "pc", "phone", "panel" }) do
	for _, app in ipairs(Registry.list(surface)) do
		appCount = appCount + 1
		local container = M.newInstance("Frame", { Name = "TestContainer" })
		container.Parent = gui
		local ctx = {
			kind = surface,
			params = {},
			close = function() end,
			session = function()
				return State.Data.Derived.Session or { MaxScenes = 6, StorageGb = 1000, TierName = "Básico" }
			end,
			open = function() end,
			onState = function() end,
		}
		local ok, err = pcall(app.build, container, ctx)
		if not ok then
			errors[#errors + 1] = app.Id .. "@" .. surface .. " build: " .. tostring(err)
		else
			clickAll(container, app.Id .. "@" .. surface, 120)
		end
		container:Destroy()
		-- volver a casa y reabrir el computador por si un botón movió al jugador
		M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
		Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
		M.stepBackground()
	end
end

-- Paneles especiales y superficies del Shell
local okP, errP = pcall(function()
	Shell.openPanel("product", { item = "cam_pro", store = "camera" })
	clickAll(gui, "panel producto", 40)
	Shell.openPhone()
	clickAll(gui, "teléfono", 60)
	Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
	M.stepBackground()
	clickAll(gui, "escritorio", 80)
	Shell.close()
end)
if not okP then
	errors[#errors + 1] = "shell: " .. tostring(errP)
end

-- Modo construcción dentro de una propiedad
local okB, errB = pcall(function()
	local Data = senv.require(services.ServerScriptService.Server.Services.DataService)
	local Property = senv.require(services.ServerScriptService.Server.Services.PropertyService)
	local d = Data.get(player)
	d.Money = 50000
	d.Level = 5
	Shell.close()
	assert(call("Prop.Rent", { id = "apt_modern" }).ok, "alquiler")
	local ext = Property.exteriorOf("apt_modern")
	M.moveTo(player, ext.X, ext.Y, ext.Z)
	assert(call("Prop.Enter", { id = "apt_modern" }).ok, "entrar")
	local inv = senv.require(services.ServerScriptService.Server.Services.InventoryService)
	inv.add(player, "dec_sofa_modern", { loc = "home" })
	inv.add(player, "dec_lamp_modern", { loc = "home" })
	M.stepBackground()
	local Build = cenv.require(Client.BuildUI)
	Build.toggle()
	assert(Build.isOpen(), "el panel de construcción debe abrirse dentro de la propiedad")
	clickAll(gui, "construcción", 120)
	Build.cancelPlacing()
end)
if not okB then
	errors[#errors + 1] = "construcción: " .. tostring(errB)
end

-- App Empresa con empresa fundada: todas las pestañas y botones
local okC, errC = pcall(function()
	local Data = senv.require(services.ServerScriptService.Server.Services.DataService)
	local d = Data.get(player)
	d.Level = 10
	d.Money = 50000
	assert(call("Company.Create", { name = "Estudio Cliente", emoji = 2, color = 3 }).ok, "fundar empresa")
	assert(call("Company.Deposit", { amount = 20000 }).ok, "ingresar fondos")
	assert(call("Company.Hire", { id = d.Company.Candidates[1].Id }).ok, "contratar")
	assert(call("Company.AcceptClient", { id = d.Company.Offers[1].Id }).ok, "aceptar encargo")
	M.stepBackground()
	local app = Registry.get("company")
	for _, tabId in ipairs({ "panel", "staff", "clients", "report" }) do
		local container = M.newInstance("Frame", { Name = "TestContainer" })
		container.Parent = gui
		app.build(container, { kind = "panel", params = { tab = tabId }, close = function() end, open = function() end, onState = function() end, session = function()
			return State.Data.Derived.Session
		end })
		clickAll(container, "company@" .. tabId, 120)
		container:Destroy()
	end
end)
if not okC then
	errors[#errors + 1] = "empresa: " .. tostring(errC)
end

-- Conducción (VehicleController): sentarse, acelerar, girar, frenar y bajarse
local okV, errV = pcall(function()
	local VC = cenv.require(Client.VehicleController)
	local WorldDataS = senv.require(services.ReplicatedStorage.Shared.WorldData)
	local Veh = senv.require(services.ServerScriptService.Server.Services.VehicleService)
	local d = senv.require(services.ServerScriptService.Server.Services.DataService).get(player)
	d.Vehicles.car900 = d.Vehicles.car900 or { Model = "v_ev", Color = 3, Fuel = 40, Cond = 70, Upgrades = {}, Odo = 0, Paid = 14000, Extra = 0 }
	Shell.close()
	for _, sp in ipairs(WorldDataS.Specials) do
		if sp.Type == "dealer" then
			M.moveTo(player, sp.WX, 3, sp.WZ)
		end
	end
	local r = call("Veh.Spawn", { id = "car900" })
	assert(r.ok, "sacar el vehículo: " .. tostring(r.msg))
	local model = Veh.spawnedModel(player)
	local seat = model:FindFirstChildOfClass("VehicleSeat")
	local drive = model.PrimaryPart:FindFirstChild("Drive")
	local steer = model.PrimaryPart:FindFirstChild("Steer")
	local hum = player.Character:FindFirstChildOfClass("Humanoid")
	hum.SeatPart = seat
	seat.Throttle = 1
	seat.Steer = 1
	VC.step(0.1)
	local v1 = VC.speed()
	for i = 1, 40 do
		VC.step(0.1)
	end
	local maxS = model:GetAttribute("MaxSpeed")
	assert(v1 > 0 and VC.speed() > v1 and VC.speed() <= maxS + 0.001, "acelera suavemente hasta la velocidad máxima")
	assert(math.abs(drive.PlaneVelocity.Y + VC.speed()) < 0.01, "avanza según el LookVector del chasis")
	assert(steer.AngularVelocity.Y < 0, "gira a la derecha con D")
	assert(player.PlayerGui.VehicleHUD.Enabled, "velocímetro visible")
	seat.Throttle = -1
	for i = 1, 60 do
		VC.step(0.1)
	end
	assert(VC.speed() < 0 and steer.AngularVelocity.Y > 0, "marcha atrás: giro invertido")
	hum.SeatPart = nil
	VC.step(0.1)
	assert(drive.PlaneVelocity.X == 0 and drive.PlaneVelocity.Y == 0 and VC.speed() == 0, "al bajarse se detiene")
	assert(not player.PlayerGui.VehicleHUD.Enabled, "el velocímetro se oculta")
	assert(call("Veh.Store", {}).ok)
	-- Pestañas Concesionario y Maletero de la app, ya dentro del concesionario (compras y alquileres reales)
	local vapp = Registry.get("vehicles")
	for _, tabName in ipairs({ "dealer", "help" }) do
		local cont = M.newInstance("Frame", { Name = "VehiclesTest" })
		cont.Parent = gui
		vapp.build(cont, { kind = "panel", params = { tab = tabName }, close = function() end, open = function() end, onState = function() end, session = function()
			return {}
		end })
		clickAll(cont, "vehicles@" .. tabName, 120)
		cont:Destroy()
	end
	assert((d.Counters.vehicles_bought or 0) >= 1, "se puede comprar desde la app en el concesionario")
end)
if not okV then
	errors[#errors + 1] = "vehículo: " .. tostring(errV)
end

if #errors > 0 then
	local shown = {}
	for i = 1, math.min(12, #errors) do
		shown[i] = errors[i]
	end
	error(#errors .. " errores en el cliente:\n" .. table.concat(shown, "\n"))
end
return "(" .. appCount .. " apps abiertas, " .. clicks .. " botones pulsados)"
