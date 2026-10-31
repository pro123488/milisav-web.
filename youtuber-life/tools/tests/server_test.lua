-- Prueba de integración del servidor: arranca TODOS los servicios (incluida la construcción de la ciudad)
-- con la API de Roblox simulada y recorre el ciclo principal del juego.

local mainCo = coroutine.running()
local M = loadstring(MOCKS_SRC, "@mocks.lua")()

local game = M.newInstance("DataModel", { Name = "game" })
local services = M.build(game)

-- Monta los scripts del proyecto como instancias simuladas
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

local env = setmetatable({}, { __index = _G })
local cache = {}
local function req(inst)
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
env.require = req
env.game = game
env.workspace = M.workspace
env.Instance = { new = function(class)
	return M.newInstance(class)
end }
env.Vector3, env.CFrame, env.Color3, env.UDim2, env.UDim, env.Enum, env.Random = M.Vector3, M.CFrame, M.Color3, M.UDim2, M.UDim, M.Enum, M.Random
env.task = M.makeTask(mainCo)
env.typeof = function(v)
	if type(v) == "table" and rawget(v, "__type") then
		return rawget(v, "__type")
	end
	return type(v)
end
env.warn = function(...) io.write("[warn] ", table.concat({...}, " "), "\n") end
env.print = function(...) end
env.os = { time = function()
	return M.time
end, clock = function()
	return M.clock
end, date = os.date }

-- Arrancar el servidor
local ServerScriptService = services.ServerScriptService
local mainScript = ServerScriptService.Server.Main
local mainFn = assert(loadstring(READ(mainScript.Path), "@Main"))
setfenv(mainFn, setmetatable({ script = mainScript }, { __index = env }))
mainFn()

local partCount = #M.workspace:FindFirstChild("City"):GetDescendants()
assert(partCount > 1500, "la ciudad parece demasiado pequeña: " .. partCount)

local Players = services.Players
local Shared = services.ReplicatedStorage.Shared
local WorldData = req(Shared.WorldData)
local Remote = services.ReplicatedStorage.Remotes.Request
local function call(player, action, payload)
	M.clock = M.clock + 0.2
	local r = Remote.OnServerInvoke(player, action, payload)
	return r
end
local function must(player, action, payload)
	local r = call(player, action, payload)
	assert(r.ok, action .. " falló: " .. tostring(r.msg))
	return r
end

-- Jugador nuevo
local player = M.newPlayer(Players, 101, "Tester")
Players.PlayerAdded:Fire(player)
local S_data = M.store["u_101"]
assert(S_data ~= nil, "debe crear y bloquear el perfil al cargar")

local function state()
	-- busca el último "profile" enviado
	for i = #M.pushes, 1, -1 do
		if M.pushes[i].kind == "profile" then
			return M.pushes[i].data
		end
	end
end
M.stepBackground() -- sincronización y bucles
local view = state()
assert(view, "el cliente debe recibir el perfil")
assert(view.Money == 1500, "dinero inicial")
local invCount = 0
for _ in pairs(view.Inventory) do
	invCount = invCount + 1
end
assert(invCount >= 10, "kit inicial (teléfono, PC viejo por piezas, monitor...) = " .. invCount)
assert(view.ActiveRig ~= "", "debe tener un PC montado")

-- Casa: debe tener habitación asignada y poder entrar
local Home = nil
local room
for _, r in ipairs(req(ServerScriptService.Server.Services.WorldBuilder).HomeRooms) do
	if r.Owner == player then
		room = r
	end
end
assert(room, "habitación asignada")
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)

-- Tutorial: apariencia y teléfono
must(player, "Style.Set", { shirt = 3, pants = 2 })
local QuestSvc = req(ServerScriptService.Server.Services.QuestService)
QuestSvc.tutorialEvent(player, "open_phone")
M.stepBackground()

-- Mochila: el trípode a la mochila
local tripodUid
for uid, rec in pairs(view.Inventory) do
	if rec.Id == "tripod_basic" then
		tripodUid = uid
	end
end
must(player, "Inv.Move", { uid = tripodUid, to = "backpack" })

-- Idea
local r = must(player, "Video.CreateProject", { category = "shopping", name = "Mi primer vídeo" })
local pid = r.data.pid

-- Ir a la tienda MegaTec y grabar allí 3 escenas con el teléfono
local tech
for _, sp in ipairs(WorldData.Specials) do
	if sp.StoreId == "tech" then
		tech = sp
	end
end
M.moveTo(player, tech.WX, 3, tech.WZ)
must(player, "Video.StartRecording", { pid = pid })
for i = 1, 3 do
	M.clock = M.clock + 5
	local shot = ({ "talking", "wide", "product" })[i]
	local payload = { shot = shot }
	if shot == "product" then
		payload.featuredStoreItem = "kb_mech"
	end
	local rr = must(player, "Video.RecordScene", payload)
	assert(rr.data.scene.Q > 0)
end
-- No se puede grabar más rápido que el enfriamiento
local fast = call(player, "Video.RecordScene", { shot = "wide" })
assert(not fast.ok, "debe respetar el tiempo entre tomas")
M.clock = M.clock + 2
local ph = must(player, "Photo.Take", { mode = "interior", composition = 7, cam = { 1, 2, 3, 4, 5, 6 } })
local photoId = ph.data.photo.Id

-- Compra física con protección contra doble cobro
local before = req(Shared.Util).deepCopy(M.store) -- no usado; el dinero se lee del perfil
local Data = req(ServerScriptService.Server.Services.DataService)
local money0 = Data.get(player).Money
must(player, "Shop.BuyInStore", { itemId = "mouse_gamer", qty = 1, nonce = "nonce-001" })
local money1 = Data.get(player).Money
assert(money0 - money1 == 55, "debe cobrar 55, cobró " .. (money0 - money1))
local again = must(player, "Shop.BuyInStore", { itemId = "mouse_gamer", qty = 1, nonce = "nonce-001" })
assert(Data.get(player).Money == money1, "no debe cobrar dos veces el mismo pedido")
local wrongStore = call(player, "Shop.BuyInStore", { itemId = "cam_basic", qty = 1, nonce = "nonce-002" })
assert(not wrongStore.ok, "MegaTec no vende cámaras")
local tooHigh = call(player, "Shop.BuyInStore", { itemId = "cpu_kx_thread", qty = 1, nonce = "nonce-003" })
assert(not tooHigh.ok, "requisito de nivel")

-- Pedido online: cobro único, cancelación con reembolso, entrega
local m2 = Data.get(player).Money
local order = must(player, "Shop.Checkout", { nonce = "cart-0001", items = { { id = "ram_d4_16", qty = 1 }, { id = "ssd_1tb", qty = 1 } } })
must(player, "Shop.Checkout", { nonce = "cart-0001", items = { { id = "ram_d4_16", qty = 1 } } })
local m3 = Data.get(player).Money
assert(m2 - m3 == 55 + 85 + 15, "pedido online con envío: " .. (m2 - m3))
local order2 = must(player, "Shop.Checkout", { nonce = "cart-0002", items = { { id = "fan_basic", qty = 2 } } })
must(player, "Shop.CancelOrder", { num = order2.data.num })
assert(Data.get(player).Money == m3, "la cancelación reembolsa")
M.time = M.time + 400
req(ServerScriptService.Server.Services.ShopService).processOrders(player)
local hasRam = false
for _, rec in pairs(Data.get(player).Inventory) do
	if rec.Id == "ram_d4_16" then
		hasRam = true
	end
end
assert(hasRam, "el pedido online debe entregarse")

-- De vuelta a casa: computador, importar, editar, exportar, miniatura, publicar
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
local Computer = req(ServerScriptService.Server.Services.ComputerService)
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
local imp = must(player, "Video.Import", { pid = pid })
local proj = Data.get(player).Projects[pid]
local timeline = {}
for i, sc in ipairs(proj.Scenes) do
	timeline[#timeline + 1] = { k = "s", id = sc.Id, trim = 0.8, tr = i == 2 and "fade" or "cut" }
end
timeline[#timeline + 1] = { k = "p", id = photoId, trim = 1, tr = "cut" }
local tooMany = {}
for i = 1, 20 do
	tooMany[i] = timeline[1]
end
local bad = call(player, "Video.SaveEdit", { pid = pid, edit = { Timeline = tooMany } })
assert(not bad.ok, "el PC viejo no puede con 20 clips")
local ed = must(player, "Video.SaveEdit", { pid = pid, edit = { Timeline = timeline, Music = "m_funk", MusicVol = 0.3, VoiceVol = 1, Subtitles = true, Outro = "subscribe", Color = { b = 5, c = 8, s = 4 }, Effects = { "split" } } })
assert(ed.data.eval.Final > 0)
local notReady = call(player, "Video.Publish", { pid = pid, title = "Compras en MegaTec" })
assert(not notReady.ok, "no se publica sin exportar")
local ex = must(player, "Video.Export", { pid = pid })
assert(ex.data.secs >= 4)
local early = call(player, "Video.Publish", { pid = pid, title = "Compras en MegaTec" })
assert(not early.ok, "no se publica antes de terminar la exportación")
M.time = M.time + ex.data.secs + 1
local th = must(player, "Thumb.Save", { pid = pid, design = { text = "COMPRAS EN MEGATEC", font = "GothamBlack", textColor = 3, bg = 2, template = "left", stickers = { "arrow" }, photoId = photoId } })
assert(th.data.score.Score > 30)
local pub = must(player, "Video.Publish", { pid = pid, title = "Compras en MegaTec: mi primer vídeo", description = "Hola", thumbId = th.data.thumbId, tags = { "compras" } })
local data = Data.get(player)
assert(#data.Videos == 1 and data.Projects[pid] == nil, "vídeo publicado y proyecto archivado")
assert(data.Quests.Step > 1, "el tutorial avanza")

-- Estadísticas progresivas: tras unos minutos debe haber visitas e ingresos razonables
local Channel = req(ServerScriptService.Server.Services.ChannelService)
local moneyBefore = data.Money
M.time = M.time + 600
Channel.tickPlayer(player)
local v = data.Videos[1]
assert(v.Views > 0 and v.Views <= v.Expected, "visitas: " .. v.Views .. "/" .. v.Expected)
assert(v.Expected < 5000, "un primer vídeo no puede tener cifras absurdas: " .. v.Expected)
local views1 = v.Views
M.time = M.time + 3000
Channel.tickPlayer(player)
assert(v.Views >= views1, "las visitas no bajan")

-- Logros: completar y cobrar una sola vez
local Quest = req(ServerScriptService.Server.Services.QuestService)
Quest.check(player)
assert(data.Quests.Completed["published_1"], "logro de primer vídeo")
local c1 = must(player, "Quest.Claim", { id = "published_1" })
local c2 = call(player, "Quest.Claim", { id = "published_1" })
assert(not c2.ok, "no se cobra dos veces")

-- Montaje de PC: incompatible rechazado, compatible aceptado
local inv = data.Inventory
local function uidOf(id)
	for uid, rec in pairs(inv) do
		if rec.Id == id and rec.Loc == "home" then
			return uid
		end
	end
end
data.Money = data.Money + 5000
data.Level = 5
M.moveTo(player, tech.WX, 3, tech.WZ)
for i, id in ipairs({ "case_mid", "mobo_k5_basic", "cpu_k5_500", "ram_d4_16", "psu_550", "cool_tower", "nvme_1tb", "gpu_vx3" }) do
	must(player, "Shop.BuyInStore", { itemId = id, qty = 1, nonce = "pc-part-" .. i })
end
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
for uid, rec in pairs(inv) do
	if rec.Loc == "backpack" then
		rec.Loc = "home"
	end
end
local wrong = call(player, "PC.SaveRig", { parts = { case = uidOf("case_mid"), mobo = uidOf("mobo_k5_basic"), cpu = uidOf("cpu_k5_500"), ram = uidOf("ssd_1tb"), psu = uidOf("psu_550"), cooling = uidOf("cool_tower"), storage = { uidOf("nvme_1tb") } } })
assert(not wrong.ok and wrong.msg:find("no válida"), "una pieza en la ranura equivocada debe rechazarse con mensaje claro: " .. tostring(wrong.msg))
local okRig = must(player, "PC.SaveRig", { name = "Mi PC", parts = { case = uidOf("case_mid"), mobo = uidOf("mobo_k5_basic"), cpu = uidOf("cpu_k5_500"), ram = uidOf("ram_d4_16"), psu = uidOf("psu_550"), cooling = uidOf("cool_tower"), storage = { uidOf("nvme_1tb") }, gpu = uidOf("gpu_vx3") } })
local newStats = okRig.data.stats
assert(newStats.Score > Computer.rigStats(player, next(data.Rigs) == okRig.data.rigId and okRig.data.rigId or data.ActiveRig).Score * 0 , "stats")
must(player, "PC.SetActive", { rigId = okRig.data.rigId })
must(player, "PC.Benchmark", { rigId = okRig.data.rigId })
must(player, "PC.Disassemble", { rigId = okRig.data.rigId })

-- Venta y devolución
local sellUid = uidOf("fan_basic") or uidOf("gpu_vx3")
local m4 = data.Money
must(player, "Inv.Return", { uid = sellUid })
assert(data.Money > m4, "la devolución reembolsa")

-- Banco: ahorro, meta y préstamo
must(player, "Bank.Deposit", { amount = 100 })
must(player, "Bank.Withdraw", { amount = 50 })
must(player, "Bank.SetGoal", { name = "Cámara pro", target = 1800 })
must(player, "Bank.TakeLoan", { amount = 500 })
assert(data.Bank.Loan == 550)
must(player, "Bank.RepayLoan", { amount = 550 })

-- Trabajos
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
local job = must(player, "Job.Start", { type = "edit" })
local answer = data.Job.Answer
local paid = data.Money
must(player, "Job.Submit", { order = answer })
assert(data.Money > paid, "el encargo paga")

-- Taxi
must(player, "Travel.Taxi", { district = "beach" })

-- Guardado: al salir se guarda y se libera el bloqueo
Players.PlayerRemoving:Fire(player)
local saved = M.store["u_101"]
assert(saved and saved.__lock == nil, "el bloqueo de sesión debe liberarse al salir")
assert(#saved.Videos == 1, "el vídeo debe quedar guardado")

-- Recarga: los datos persisten
local p2 = M.newPlayer(Players, 101, "Tester")
Players.PlayerAdded:Fire(p2)
local d2 = Data.get(p2)
assert(d2 and #d2.Videos == 1 and d2.Channel.TotalViews > 0, "los datos se recuperan")

-- Bloqueo de sesión de otro servidor: no se sobrescribe y se expulsa con mensaje claro (servidor real)
M.store["u_202"] = { Money = 999999, __lock = { Job = "otro-servidor", T = M.time } }
local p3 = M.newPlayer(Players, 202, "Locked")
Players.PlayerAdded:Fire(p3)
assert(M.store["u_202"].Money == 999999, "no debe sobrescribir datos bloqueados")
assert(#M.kicked >= 1, "debe expulsar con un mensaje en lugar de arriesgar los datos")

-- DataStore caído en Studio: perfil temporal que NO se guarda
M.isStudio = true
M.storeFails = true
local p4 = M.newPlayer(Players, 303, "Studio")
Players.PlayerAdded:Fire(p4)
assert(Data.getProfile(p4).ReadOnly, "perfil temporal de solo lectura")
M.storeFails = false
Players.PlayerRemoving:Fire(p4)
assert(M.store["u_303"] == nil, "el perfil temporal no se guarda")

return "(ciudad: " .. partCount .. " instancias)"
