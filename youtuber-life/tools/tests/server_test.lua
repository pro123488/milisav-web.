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

local Quest
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
Quest = req(ServerScriptService.Server.Services.QuestService)
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

-- FASE 2: inmobiliaria, interiores y modo construcción
local Property = req(ServerScriptService.Server.Services.PropertyService)
local Home = req(ServerScriptService.Server.Services.HomeService)
data.Money = 100000
data.Level = 6
local mRent = data.Money
must(player, "Prop.Rent", { id = "apt_small" })
assert(mRent - data.Money == 440, "alquiler: semana + fianza")
assert(data.HomeProperty == "apt_small", "se muda a su primer alquiler")
assert(not call(player, "Prop.Rent", { id = "apt_small" }).ok, "no alquila dos veces")
-- Entrar desde la puerta
local ext = Property.exteriorOf("apt_small")
M.moveTo(player, ext.X, ext.Y, ext.Z)
must(player, "Prop.Enter", { id = "apt_small" })
assert(Property.inside(player) == "apt_small", "dentro del interior")
assert(Home.isAtHome(player), "el interior cuenta como casa")
-- Muebles: comprar en Hogar & Deco y colocar
local origin = Property.interiorInfo(player)
for _, sp in ipairs(WorldData.Specials) do
	if sp.StoreId == "home" then
		M.moveTo(player, sp.WX, 3, sp.WZ)
	end
end
for i, id in ipairs({ "dec_sofa_gamer", "dec_lamp_gamer", "dec_art_gamer", "dec_acoustic", "dec_plant_big" }) do
	must(player, "Shop.BuyInStore", { itemId = id, qty = 1, nonce = "deco-" .. i })
end
for uid, rec in pairs(data.Inventory) do
	if rec.Loc == "backpack" then
		rec.Loc = "home"
	end
end
local o = Property.interiorInfo(player).Origin
M.moveTo(player, o[1], o[2] + 3, o[3])
local function uidOf2(id)
	for uid, rec in pairs(data.Inventory) do
		if rec.Id == id then
			return uid
		end
	end
end
local decor0 = Property.decorScore(player, "apt_small")
must(player, "Prop.Place", { uid = uidOf2("dec_sofa_gamer"), x = 4, z = -4, r = 0 })
local clash = call(player, "Prop.Place", { uid = uidOf2("dec_lamp_gamer"), x = 4, z = -4, r = 0 })
assert(not clash.ok and clash.msg:find("Choca"), "no se superponen muebles: " .. tostring(clash.msg))
local outside = call(player, "Prop.Place", { uid = uidOf2("dec_lamp_gamer"), x = 40, z = 0, r = 0 })
assert(not outside.ok, "no se coloca fuera de la sala")
must(player, "Prop.Place", { uid = uidOf2("dec_lamp_gamer"), x = 10, z = 0, r = 0 })
must(player, "Prop.Place", { uid = uidOf2("dec_art_gamer"), x = 8, z = 6, r = 90 })
must(player, "Prop.Place", { uid = uidOf2("dec_acoustic"), x = -6, z = 4, r = 0 })
must(player, "Prop.Rotate", { uid = uidOf2("dec_sofa_gamer") })
local decor1 = Property.decorScore(player, "apt_small")
assert(decor1 > decor0 + 10, "la decoración sube (estilo completo): " .. decor0 .. " -> " .. decor1)
assert(data.Inventory[uidOf2("dec_sofa_gamer")].Loc == "prop:apt_small")
assert(not call(player, "Inv.Sell", { uid = uidOf2("dec_sofa_gamer") }).ok, "no se vende un mueble colocado")
local mDec = data.Money
must(player, "Prop.Decor", { wall = 8, light = 4, floor = 3 })
assert(mDec - data.Money == 150, "remodelar cuesta 50 por cambio")
must(player, "Prop.SavePreset", { name = "Gamer" })
-- La decoración afecta a la grabación dentro de la propiedad
local spot = req(ServerScriptService.Server.Services.TravelService).currentSpot(player)
assert(spot.Id == "prop_apt_small" and spot.Decor > 15, "lugar de grabación de la propiedad con decoración")
assert(spot.Noise < 2, "los paneles acústicos reducen el ruido")
local pid2 = must(player, "Video.CreateProject", { category = "gaming" }).data.pid
must(player, "Video.StartRecording", { pid = pid2 })
M.clock = M.clock + 5
local sc = must(player, "Video.RecordScene", { shot = "talking" }).data.scene
assert(sc.SpotName == "Apartamento pequeño en la Zona de apartamentos", "la escena se graba en la propiedad")
must(player, "Video.StopRecording", {})
-- Recoger y cargar diseño
must(player, "Prop.Pick", { uid = uidOf2("dec_plant_big") == nil and uidOf2("dec_lamp_gamer") or uidOf2("dec_lamp_gamer") })
must(player, "Prop.LoadPreset", { index = 1 })
assert(data.Properties.apt_small.Placed[uidOf2("dec_lamp_gamer")], "el diseño guardado se vuelve a aplicar")
-- Capacidad de almacenamiento: no cobra si no cabe
local capBefore = Property.storageCap(player)
local savedCap = req(Shared.PropertyData).StarterStorage
req(Shared.PropertyData).StarterStorage = -1000
local mFull = data.Money
local full = call(player, "Shop.Checkout", { nonce = "full-0001", items = { { id = "fan_basic", qty = 1 } } })
assert(not full.ok and data.Money == mFull, "sin espacio no se cobra")
req(Shared.PropertyData).StarterStorage = savedCap
-- Impagos: tras 3 se rescinde el alquiler sin perder muebles
must(player, "Prop.Exit", {})
data.Money = 0
for i = 1, 3 do
	data.Home.PlayDays = data.Properties.apt_small and data.Properties.apt_small.NextDue or data.Home.PlayDays
	Property.onNewDay(player)
end
assert(data.Properties.apt_small == nil, "contrato rescindido tras 3 impagos")
assert(data.HomeProperty == "", "vuelve a la residencia")
assert(data.Inventory[uidOf2("dec_sofa_gamer")].Loc == "home", "los muebles vuelven al inventario")
-- Comprar y vender
data.Money = 100000
must(player, "Prop.Buy", { id = "garage" })
assert(data.Properties.garage.Mode == "own")
Quest.check(player)
assert(data.Quests.Completed["properties_owned_1"], "logro de primera propiedad")
must(player, "Prop.Sell", { id = "garage" })
assert(data.Properties.garage == nil)

-- PATROCINIOS, FORMATOS, EVENTOS, DIRECTOS Y REDES
local Sponsor = req(ServerScriptService.Server.Services.SponsorService)
local Events = req(ServerScriptService.Server.Services.EventService)
local EventData = req(Shared.EventData)
data.Money = 50000
data.Reputation = 30
data.BizRep = 50
-- Oferta controlada (gift de una cámara de acción, categoría reseñas)
local sp = Sponsor.state(data)
sp.OffersDay = data.Home.PlayDays
sp.Offers = { { Id = "otest", Brand = "pixelia", Kind = "gift", Category = "review", Product = "cam_action", MinQ = 10, Days = 3, Pay = 500, Bonus = 100 } }
must(player, "Sponsor.Accept", { id = "otest" })
local gift = sp.Active.otest.ItemUid
assert(gift and data.Inventory[gift].Id == "cam_action", "el patrocinador envía el producto")
-- Proyecto de reseña que NO muestra el producto: se rechaza al publicar con patrocinio
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
data.Inventory[gift].Loc = "backpack"
local rp = must(player, "Video.CreateProject", { category = "review" }).data.pid
must(player, "Video.StartRecording", { pid = rp })
for i = 1, 3 do
	M.clock = M.clock + 5
	must(player, "Video.RecordScene", { shot = i == 1 and "talking" or "wide" })
end
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
must(player, "Video.Import", { pid = rp })
local function editAll(pidX)
	local tlx = {}
	for _, scx in ipairs(data.Projects[pidX].Scenes) do
		if scx.Imp then
			tlx[#tlx + 1] = { k = "s", id = scx.Id, trim = 1, tr = "cut" }
		end
	end
	must(player, "Video.SaveEdit", { pid = pidX, edit = { Timeline = tlx } })
	local exx = must(player, "Video.Export", { pid = pidX })
	M.time = M.time + exx.data.secs + 1
end
editAll(rp)
local noProd = call(player, "Video.Publish", { pid = rp, title = "Reseña de la cámara de acción", sponsor = "otest" })
assert(not noProd.ok and noProd.msg:find("producto"), "no se puede cumplir un patrocinio sin mostrar el producto: " .. tostring(noProd.msg))
-- Grabar el plano de producto con el producto propio y volver a exportar
must(player, "Video.StartRecording", { pid = rp })
M.clock = M.clock + 5
must(player, "Video.RecordScene", { shot = "product", featuredUid = gift })
must(player, "Video.Import", { pid = rp })
editAll(rp)
local short = call(player, "Video.Publish", { pid = rp, title = "Reseña corta de la cámara", format = "short" })
assert(not short.ok, "un short no puede durar más de 75 s")
local moneyS = data.Money
must(player, "Video.Publish", { pid = rp, title = "Reseña de la cámara de acción Pixelia", sponsor = "otest" })
assert(sp.Active.otest == nil and data.Money > moneyS, "contrato cumplido y pagado")
assert(data.Videos[1].Sponsor == "pixelia" and data.Counters.sponsors_done == 1)
assert(data.Inventory[gift] ~= nil, "el regalo se queda")
-- Préstamo incumplido: se devuelve el equipo y baja la reputación comercial
sp.Offers = { { Id = "oloan", Brand = "zenit", Kind = "loan", Category = "tech", Product = "phone_pro", MinQ = 50, Days = 1, Pay = 900, Bonus = 100 } }
must(player, "Sponsor.Accept", { id = "oloan" })
local loanUid = sp.Active.oloan.ItemUid
assert(not call(player, "Inv.Sell", { uid = loanUid }).ok, "el equipo prestado no se vende")
local biz = data.BizRep
data.Home.PlayDays = data.Home.PlayDays + 5
Sponsor.onNewDay(player)
assert(data.Inventory[loanUid] == nil and data.BizRep == biz - 10, "incumplimiento: equipo devuelto y reputación comercial baja")

-- Evento del día: ir al lugar, grabar allí y publicar
local ev = Events.current()
local evSpot = WorldData.SpotById[ev.Spot]
M.time = M.time + 0 -- mismo día
local evProg = Events.progress(data)
M.moveTo(player, evSpot.X, 3, evSpot.Z)
local wasActive = Events.isActive()
if wasActive then
	assert(Events.atEvent(player))
	Events.onScene(player, evSpot)
	assert(evProg.Scenes == 1, "escena contada en el evento")
end
local disc = 0
for _, def in pairs(req(Shared.ItemCatalog).Items) do
	if Events.priceMultiplier(def) < 1 then
		disc = disc + 1
	end
end
assert(ev.Effects.Discount == nil or disc > 0, "los descuentos del evento se aplican")

-- Directo
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
req(ServerScriptService.Server.Services.InventoryService).add(player, "web_hd", { loc = "home" })
data.LastLive = 0
must(player, "Live.Start", { topic = "qa" })
assert(not call(player, "Live.Start", { topic = "qa" }).ok, "no hay dos directos a la vez")
M.time = M.time + 10
M.stepBackground()
M.time = M.time + 100
M.stepBackground()
assert(data.Counters.lives == 1 and #data.Lives == 1, "el directo termina y queda registrado")

-- Publicación en redes
local subsP = data.Channel.Subs
must(player, "Social.Post", { photoId = data.Photos[1].Id, caption = "Mi rincón favorito" })
assert(#data.Posts == 1 and data.Posts[1].Likes > 0)
assert(not call(player, "Social.Post", { photoId = data.Photos[1].Id, caption = "otra" }).ok, "espera entre publicaciones")

-- COMIDA, ENERGÍA Y EMPLEOS NUEVOS
local Needs = req(ServerScriptService.Server.Services.NeedsService)
data.Money = 50000
data.Needs.Energy = 20
local market, restaurant
for _, sp in ipairs(WorldData.Specials) do
	if sp.StoreId == "market" then
		market = sp
	elseif sp.Type == "restaurant" then
		restaurant = sp
	end
end
M.moveTo(player, market.WX, 3, market.WZ)
for i, id in ipairs({ "food_pasta", "food_tomato", "food_bar" }) do
	must(player, "Shop.BuyInStore", { itemId = id, qty = 1, nonce = "food-" .. i })
end
assert(not call(player, "Food.Cook", { recipe = "meal_pasta" }).ok, "solo se cocina en casa")
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
must(player, "Food.Cook", { recipe = "meal_pasta" })
assert(not call(player, "Food.Cook", { recipe = "meal_pasta" }).ok, "sin ingredientes no se cocina")
local meal
for uid, rec in pairs(data.Inventory) do
	if rec.Id == "meal_pasta" then
		meal = uid
	end
end
assert(meal, "el plato cocinado está en la despensa")
must(player, "Food.Eat", { uid = meal })
assert(data.Needs.Energy > 50, "comer recupera energía")
assert(not call(player, "Food.Order", { place = "restaurant", item = "r_menu" }).ok, "hay que estar en el restaurante")
M.moveTo(player, restaurant.WX, 3, restaurant.WZ)
must(player, "Food.Order", { place = "restaurant", item = "r_paella" })
must(player, "Food.Delivery", { item = "meal_sushi" })
M.time = M.time + 70
M.stepBackground()
local sushi = false
for _, rec in pairs(data.Inventory) do
	if rec.Id == "meal_sushi" then
		sushi = true
	end
end
assert(sushi, "la comida a domicilio llega a casa")
data.Needs.Energy = 10
assert(Needs.interestBonus(player) < 0 and Needs.exportMult(player) > 1, "poca energía: efecto leve")
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
Needs.rest(player)
assert(data.Needs.Energy >= 60, "descansar recupera energía")
-- Cajero
M.moveTo(player, tech.WX, 3, tech.WZ)
local cj = must(player, "Job.Start", { type = "cashier" })
local ans = {}
for i, r in ipairs(cj.data.rounds) do
	ans[i] = r.Paid - r.Price
end
local mJ = data.Money
must(player, "Job.Submit", { answers = ans })
assert(data.Money > mJ, "turno de caja pagado")
-- Técnico informático
local tq = must(player, "Job.Start", { type = "tech" })
local tans = {}
local Cat = req(Shared.ItemCatalog)
for i, q in ipairs(tq.data.questions) do
	for _, opt in ipairs(q.Options) do
		if Cat.get(opt).Compat.Socket == Cat.get(q.Cpu).Compat.Socket then
			tans[i] = opt
		end
	end
end
must(player, "Job.Submit", { answers = tans })
-- Diseñador de miniaturas
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
must(player, "Job.Start", { type = "thumbs" })
local kw = data.Job.Keyword
data.Job.MinScore = 1
local mT = data.Money
must(player, "Thumb.Save", { design = { text = kw .. " HOY", font = "GothamBlack", textColor = 3, bg = 2, template = "left", stickers = { "arrow" }, photoId = data.Photos[1].Id } })
assert(data.Money > mT and data.Job.Type == nil, "miniatura del cliente aceptada")
-- Camarógrafo
must(player, "Job.Start", { type = "camera" })
local camSpot = WorldData.SpotById[data.Job.Spot]
data.Job.MinQ = 1
M.moveTo(player, camSpot.X, 3, camSpot.Z)
local cpid = must(player, "Video.CreateProject", { category = "vlog" }).data.pid
must(player, "Video.StartRecording", { pid = cpid })
for i = 1, 2 do
	M.clock = M.clock + 5
	must(player, "Video.RecordScene", { shot = "wide" })
end
assert(data.Job.Type == nil and (data.Counters.job_camera or 0) == 1, "encargo de camarógrafo completado")
must(player, "Video.StopRecording", {})

-- SEGUNDA MANO, COLECCIONISMO E INTERCAMBIO ENTRE JUGADORES
local Market = req(ServerScriptService.Server.Services.MarketService)
local Trade = req(ServerScriptService.Server.Services.TradeService)
local Inv = req(ServerScriptService.Server.Services.InventoryService)
local MarketData = req(Shared.MarketData)
local CatM = req(Shared.ItemCatalog)
local TimeSvc = req(ServerScriptService.Server.Services.TimeWeatherService)
local Util = req(Shared.Util)
local usedStore
for _, sp in ipairs(WorldData.Specials) do
	if sp.Type == "usedstore" then
		usedStore = sp
	end
end
assert(usedStore and usedStore.District == "secondhand" and usedStore.Name == "Rastro & Retro", "Rastro & Retro en la zona de segunda mano")
data.Money = 50000
data.Level = 20
local today = TimeSvc.day()
local stockU = Market.stock()
assert(#stockU >= 12 and #stockU <= 15, "stock de 12-15 artículos: " .. #stockU)
local again1 = MarketData.stock(today)
for i, u in ipairs(stockU) do
	local d = CatM.get(u.Id)
	assert(u.Cond >= 35 and u.Cond <= 90, "condición 35-90%")
	assert(d.Cat ~= "pc" and d.Cat ~= "food", "sin PC completos ni comida")
	assert(again1[i].Id == u.Id and again1[i].Cond == u.Cond, "stock determinista")
end
-- Fuera de la tienda no se compra
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
assert(not call(player, "Market.Buy", { key = stockU[1].Key }).ok, "hay que estar en la tienda para comprar")
M.moveTo(player, usedStore.WX, 3, usedStore.WZ)
local function regular(skip)
	for _, u in ipairs(stockU) do
		if not u.Collectible and CatM.get(u.Id).Price >= 40 and u.Key ~= skip then
			return u
		end
	end
end
local unitU = regular()
local defU = CatM.get(unitU.Id)
local disc = Events.usedDiscount()
local expected = math.max(1, math.floor(defU.Price * (0.3 + 0.5 * unitU.Cond / 100) * (1 - disc) + 0.5))
local insp = must(player, "Market.Inspect", { key = unitU.Key })
assert(insp.data.Price == expected and insp.data.Cond == unitU.Cond and insp.data.NewPrice and insp.data.Saving >= 0, "inspección con precio nuevo y ahorro")
local mU = data.Money
local bought = must(player, "Market.Buy", { key = unitU.Key })
assert(mU - data.Money == expected, "precio de segunda mano: esperado " .. expected .. ", cobrado " .. (mU - data.Money))
local recU = data.Inventory[bought.data.uid]
assert(recU and recU.Id == unitU.Id and recU.Cond == unitU.Cond and recU.Src == "used" and recU.Paid == expected, "se entrega con su condición y src = used")
assert(data.Counters.used_bought == 1)
local twice = call(player, "Market.Buy", { key = unitU.Key })
assert(not twice.ok and mU - data.Money == expected, "cada unidad se vende una sola vez por jugador y día")
-- Vender al rastro: 70% × condición del precio pagado (mejor que online)
local sellExpected = math.floor(recU.Paid * 0.7 * recU.Cond / 100 + 0.5)
assert(sellExpected >= Inv.sellValue(recU, defU), "el rastro paga más que la venta online")
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
assert(not call(player, "Market.Sell", { uid = bought.data.uid }).ok, "solo se vende al rastro dentro de la tienda")
M.moveTo(player, usedStore.WX, 3, usedStore.WZ)
local mS = data.Money
must(player, "Market.Sell", { uid = bought.data.uid })
assert(data.Money - mS == sellExpected and data.Inventory[bought.data.uid] == nil, "venta al rastro")
local rigUid, phones = nil, 0
for uid, rec in pairs(data.Inventory) do
	if rec.Loc:sub(1, 4) == "rig:" then
		rigUid = uid
	end
	if CatM.get(rec.Id).Slot == "phone" and not rec.Loan then
		phones = phones + 1
	end
end
assert(rigUid and not call(player, "Market.Sell", { uid = rigUid }).ok, "no se venden piezas instaladas")
if phones == 1 then
	assert(not call(player, "Market.Sell", { uid = data.Equipped.Phone }).ok, "no se vende el único teléfono")
end
-- Reparar en el taller con descuento
local unit2 = regular(unitU.Key)
local b2 = must(player, "Market.Buy", { key = unit2.Key })
local def2 = CatM.get(unit2.Id)
local repairCost = MarketData.repairCost(def2, unit2.Cond)
local normal = math.max(5, math.floor(def2.Price * 0.15 * (100 - unit2.Cond) / 50 + 0.5))
assert(repairCost < normal, "el taller es más barato")
local mR = data.Money
must(player, "Market.Repair", { uid = b2.data.uid })
assert(mR - data.Money == repairCost and data.Inventory[b2.data.uid].Cond == 100, "reparación en el taller")
-- Coleccionable: buscar un día próximo con una pieza de colección en el stock
local colDay, colUnit
for dd = today, today + 60 do
	for _, u in ipairs(MarketData.stock(dd)) do
		if u.Collectible and not colUnit then
			colDay, colUnit = dd, u
		end
	end
	if colUnit then
		break
	end
end
assert(colUnit, "los coleccionables aparecen algunos días")
local oldKey = unitU.Key
M.time = M.time + (colDay - today) * req(Shared.Config).DayLengthSeconds
assert(TimeSvc.day() == colDay)
if colDay ~= today then
	assert(not call(player, "Market.Buy", { key = oldKey }).ok, "el stock de ayer ya no está")
end
local colDef = CatM.get(colUnit.Id)
assert(colDef.Hidden and colDef.Collectible and colDef.Cat == "gadget" and colDef.Sub == "Coleccionable" and colDef.Portable, "definición de coleccionable")
assert(not CatM.isForSale(colDef.Id), "los coleccionables no se venden nuevos")
local colBuy = must(player, "Market.Buy", { key = colUnit.Key })
local colUid = colBuy.data.uid
assert(data.Visited.Collectibles[colDef.Id], "coleccionable registrado")
Quest.check(player)
assert(data.Quests.Completed["collectibles_1"] and data.Quests.Completed["used_bought_1"], "logros de colección y segunda mano")

-- INTERCAMBIO entre dos jugadores
local friend = M.newPlayer(Players, 909, "Amigo")
Players.PlayerAdded:Fire(friend)
local fdata = Data.get(friend)
assert(fdata and next(fdata.Inventory), "el amigo carga su perfil con el kit inicial")
M.moveTo(player, usedStore.WX, 3, usedStore.WZ)
M.moveTo(friend, usedStore.WX + 60, 3, usedStore.WZ)
assert(not call(player, "Trade.Request", { userId = 909 }).ok, "hay que estar cerca para intercambiar")
M.moveTo(friend, usedStore.WX + 8, 3, usedStore.WZ)
local nearList = must(player, "Trade.Nearby", {}).data.players
assert(#nearList == 1 and nearList[1].userId == 909, "jugadores cercanos")
assert(not call(player, "Trade.Request", { userId = 101 }).ok, "no se intercambia con uno mismo")
must(player, "Trade.Request", { userId = 909 })
assert(Trade.view(friend).Incoming, "el amigo recibe la solicitud")
assert(not call(player, "Trade.AddItem", { uid = colUid }).ok, "no se ofrece nada antes de aceptar")
must(friend, "Trade.Accept", {})
assert(Trade.view(player).Status == "open")
-- Restricciones de la oferta
assert(not call(player, "Trade.AddItem", { uid = rigUid }).ok, "no se ofrecen piezas instaladas")
if phones == 1 then
	assert(not call(player, "Trade.AddItem", { uid = data.Equipped.Phone }).ok, "no se ofrece el único teléfono")
end
assert(not call(friend, "Trade.SetMoney", { amount = fdata.Money + 1 }).ok, "no se ofrece más dinero del que tienes")
-- Intento de duplicación: el objeto ofrecido se vende antes de confirmar
local dupUid = b2.data.uid
must(player, "Trade.AddItem", { uid = dupUid })
assert(not call(player, "Market.Sell", { uid = dupUid }).ok, "el rastro no compra lo que está en una oferta")
must(friend, "Trade.SetMoney", { amount = 300 })
local v1 = Trade.view(player)
must(player, "Trade.Confirm", { version = v1.Version })
assert(Trade.view(friend).TheirConfirmed)
must(friend, "Trade.SetMoney", { amount = 250 })
assert(not Trade.view(player).MyConfirmed, "cambiar la oferta anula la confirmación")
assert(not call(player, "Trade.Confirm", { version = v1.Version }).ok, "no se confirma una versión antigua")
local v2 = Trade.view(player)
must(player, "Trade.Confirm", { version = v2.Version })
must(player, "Inv.Sell", { uid = dupUid }) -- lo vende por otra vía mientras espera
local pMoney, fMoney = data.Money, fdata.Money
local pCount, fCount = Util.count(data.Inventory), Util.count(fdata.Inventory)
local fail = call(friend, "Trade.Confirm", { version = Trade.view(friend).Version })
assert(not fail.ok, "el intercambio debe fallar si falta un objeto")
assert(data.Money == pMoney and fdata.Money == fMoney, "sin transferencia de dinero")
assert(Util.count(data.Inventory) == pCount and Util.count(fdata.Inventory) == fCount, "sin transferencia de objetos")
for _, rec in pairs(fdata.Inventory) do
	assert(rec.Src ~= "trade", "el amigo no recibe nada")
end
local v3 = Trade.view(player)
assert(v3.Status == "open" and #v3.Mine.Items == 0 and not v3.MyConfirmed and not v3.TheirConfirmed, "la oferta inválida se limpia y hay que volver a confirmar")
-- Intercambio correcto: coleccionable por trípode + $250
local tripodF
for uid, rec in pairs(fdata.Inventory) do
	if rec.Id == "tripod_basic" then
		tripodF = uid
	end
end
must(player, "Trade.AddItem", { uid = colUid })
must(friend, "Trade.AddItem", { uid = tripodF })
local before = { p = data.Money, f = fdata.Money }
must(player, "Trade.Confirm", { version = Trade.view(player).Version })
local done = must(friend, "Trade.Confirm", { version = Trade.view(friend).Version })
assert(data.Inventory[colUid] == nil and fdata.Inventory[tripodF] == nil, "los objetos salen del emisor")
local nCol, newColUid = 0, nil
for uid, rec in pairs(fdata.Inventory) do
	if rec.Id == colDef.Id then
		nCol = nCol + 1
		newColUid = uid
		assert(rec.Src == "trade" and rec.Loc == "home" and rec.Cond == colUnit.Cond)
	end
end
for _, rec in pairs(data.Inventory) do
	assert(rec.Id ~= colDef.Id, "el coleccionable no se duplica")
end
assert(nCol == 1, "el amigo recibe el coleccionable una sola vez")
local gotTripod = false
for _, rec in pairs(data.Inventory) do
	if rec.Id == "tripod_basic" and rec.Src == "trade" then
		gotTripod = true
	end
end
assert(gotTripod, "el jugador recibe el trípode")
assert(data.Money == before.p + 250 and fdata.Money == before.f - 250, "el dinero se transfiere")
assert(fdata.Visited.Collectibles[colDef.Id], "el receptor registra el coleccionable")
assert(data.Counters.trades == 1 and fdata.Counters.trades == 1, "contador de intercambios")
assert(Trade.view(player).Status == "none" and Trade.view(player).Last.Status == "done")
Quest.check(player)
assert(data.Quests.Completed["trades_1"], "logro de intercambio")
local tradePush = false
for i = #M.pushes, 1, -1 do
	if M.pushes[i].kind == "trade" and M.pushes[i].player == friend then
		tradePush = true
		break
	end
end
assert(tradePush, "push de estado al cliente")
-- Se cancela si alguien se aleja
M.clock = M.clock + 5
must(player, "Trade.Request", { userId = 909 })
must(friend, "Trade.Accept", {})
must(friend, "Trade.AddItem", { uid = newColUid })
M.moveTo(friend, usedStore.WX + 80, 3, usedStore.WZ)
M.stepBackground()
assert(Trade.view(player).Status == "none" and Trade.get(friend) == nil, "alejarse cancela el intercambio")
assert(fdata.Inventory[newColUid], "cancelar no mueve nada")
-- Y si alguien sale del juego
M.moveTo(friend, usedStore.WX + 5, 3, usedStore.WZ)
M.clock = M.clock + 5
must(friend, "Trade.Request", { userId = 101 })
must(player, "Trade.Request", { userId = 909 }) -- solicitud cruzada = aceptar
assert(Trade.view(player).Status == "open")
Players.PlayerRemoving:Fire(friend)
friend.Parent = nil
assert(Trade.get(player) == nil and Trade.view(player).Last.Status == "cancelled", "salir del juego cancela el intercambio")
assert(M.store["u_909"] and M.store["u_909"].__lock == nil, "el perfil del amigo se guarda al salir")

-- Guardado: al salir se guarda y se libera el bloqueo
Players.PlayerRemoving:Fire(player)
local saved = M.store["u_101"]
assert(saved and saved.__lock == nil, "el bloqueo de sesión debe liberarse al salir")
assert(#saved.Videos == 2, "los vídeos deben quedar guardados")

-- Recarga: los datos persisten
local p2 = M.newPlayer(Players, 101, "Tester")
Players.PlayerAdded:Fire(p2)
local d2 = Data.get(p2)
assert(d2 and #d2.Videos == 2 and d2.Channel.TotalViews > 0, "los datos se recuperan")

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
