-- Prueba del cliente: arranca el servidor simulado y el cliente real conectados entre sí, abre todas las pestañas
-- y pulsa todos los botones. Cualquier error de Lua en el cliente o en el servidor hace fallar la prueba.

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

local warnings = {}
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
	env.Vector2 = M.Vector2
	env.task = M.makeTask(mainCo)
	env.typeof = function(v)
		if type(v) == "table" and rawget(v, "__type") then
			return rawget(v, "__type")
		end
		return type(v)
	end
	env.warn = function(...)
		local msg = table.concat({ ... }, " ")
		warnings[#warnings + 1] = msg
		io.write("[warn] ", msg, "\n")
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

-- Cliente
local Players = services.Players
local player = M.newPlayer(Players, 777, "Tester")
M.localPlayer = player
M.newInstance("PlayerGui", { Name = "PlayerGui" }).Parent = player
rawset(Players, "LocalPlayer", player)
local camera = M.newInstance("Camera", { Name = "Camera", ViewportSize = M.Vector2.new(1280, 720) })
camera.Parent = M.workspace
M.workspace.CurrentCamera = camera

local cenv = makeEnv()
local Client = services.StarterPlayer.StarterPlayerScripts.Client
local cfn = assert(loadstring(READ(Client.Main.Path), "@Main.client"))
setfenv(cfn, setmetatable({ script = Client.Main }, { __index = cenv }))
cfn()

Players.PlayerAdded:Fire(player)
M.stepBackground()
local UI = cenv.require(Client.UI)
assert(UI.state and UI.state.Lab, "el cliente recibe el estado del servidor")

-- Contenido para que todas las pestañas tengan datos
local Svc = services.ServerScriptService.Server.Services
local Data = senv.require(Svc.DataService)
local Lab = senv.require(Svc.LabService)
local Sync = senv.require(Svc.SyncService)
local d = Data.get(player)
d.Credits = 50000000
for _, sp in ipairs({ "blobito", "blobito", "ojoton", "gatoplasma", "gatoplasma", "lavapuff" }) do
	Lab.addMutant(player, { S = sp, L = 1 })
end
local function sync()
	M.clock = M.clock + 1
	Sync.send(player)
end
sync()

local gui = player.PlayerGui:FindFirstChild("LabMutanteUI")
assert(gui and gui:FindFirstChild("HUD"), "interfaz creada")

local clicked = 0
local function clickAll(root, tag, limit)
	local seen = 0
	local guard = 0
	local done = {}
	while guard < (limit or 80) do
		guard = guard + 1
		local target = nil
		for _, o in ipairs(root:GetDescendants()) do
			if o:IsA("TextButton") and not done[o] and o.Parent then
				target = o
				break
			end
		end
		if not target then
			break
		end
		done[target] = true
		M.clock = M.clock + 0.2
		target.Activated:Fire()
		clicked = clicked + 1
		seen = seen + 1
		sync()
	end
	return seen
end

-- Pestañas del panel
local tabs = 0
for _, t in ipairs(UI.TABS) do
	UI.openPanel(t[1])
	tabs = tabs + 1
	local panel = gui:FindFirstChild("Panel")
	assert(panel and panel.Visible, "panel abierto en " .. t[1])
	-- pulsa uno a uno los botones del contenido (cada pulsación vuelve a dibujar la pestaña)
	local done = {}
	for _ = 1, 40 do
		UI.openPanel(t[1])
		local target = nil
		for _, o in ipairs(panel.Body:GetDescendants()) do
			if o:IsA("TextButton") and not done[o.Text .. "#" .. tostring(o.Position)] then
				target = o
				break
			end
		end
		if not target then
			break
		end
		done[target.Text .. "#" .. tostring(target.Position)] = true
		M.clock = M.clock + 0.2
		target.Activated:Fire()
		clicked = clicked + 1
		sync()
	end
	clickAll(panel.Tabs, t[1], 10)
	d.Credits = 50000000
	sync()
end
-- Botones del HUD
clickAll(gui:FindFirstChild("HUD"), "hud", 20)

-- Avisos del servidor al cliente
local Net = senv.require(Svc.Net)
Net.push(player, "alert", { on = true, thief = "Beto", name = "Blobito" })
assert(gui.HUD.Alert.Visible, "alerta de robo visible")
Net.push(player, "alert", { on = false })
Net.push(player, "openPanel", { tab = "fusion" })
assert(UI.tab == "fusion" and UI.open, "el servidor puede abrir el panel")

for _ = 1, 10 do
	M.stepBackground()
end
for _, w in ipairs(warnings) do
	assert(not w:find("cliente") and not w:find("error en") and not w:find("sync:") and not w:find("producción:"), "error oculto: " .. w)
end
return "(" .. tabs .. " pestañas, " .. clicked .. " botones pulsados)"
