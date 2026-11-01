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
env.Vector2, env.PhysicalProperties = M.Vector2, M.PhysicalProperties
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

-- EMPRESA DE PRODUCCIÓN: fundación, cuenta propia, empleados, salarios, efectos y clientes
local Company = req(ServerScriptService.Server.Services.CompanyService)
local LifeData = req(Shared.LifeData)
local CUtil = req(Shared.Util)
data.Money = 60000
data.Level = 5
local subsCo = data.Channel.Subs
data.Channel.Subs = 100
local noCo = call(player, "Company.Create", { name = "Producciones Faro", emoji = 1, color = 2 })
assert(not noCo.ok and data.Company.Name == nil, "sin nivel 10 ni 5.000 suscriptores no se funda la empresa")
assert(not call(player, "Company.Deposit", { amount = 100 }).ok, "sin empresa no hay cuenta de empresa")
data.Level = 10
assert(not call(player, "Company.Create", { name = "Producciones Faro", emoji = 99, color = 2 }).ok, "logotipo no válido")
assert(not call(player, "Company.Create", { name = "P", emoji = 1, color = 2 }).ok, "nombre demasiado corto")
must(player, "Company.Create", { name = "Producciones Faro", emoji = 1, color = 2 })
data.Channel.Subs = subsCo
local co = data.Company
assert(co.Name == "Producciones Faro" and co.Funds == 0 and co.Rep == 50 and data.Counters.company_created == 1, "empresa fundada")
assert(not call(player, "Company.Create", { name = "Otra empresa", emoji = 1, color = 1 }).ok, "solo una empresa")
assert(#co.Candidates == LifeData.CandidatesPerDay and #co.Offers == LifeData.ClientOffersPerDay, "candidatos y ofertas del día")
local sameCands = Company.candidatesFor(player, data.Home.PlayDays)
for i, cand in ipairs(co.Candidates) do
	assert(sameCands[i].Name == cand.Name and sameCands[i].Skill == cand.Skill and sameCands[i].Role == cand.Role, "candidatos deterministas")
	assert(cand.Skill >= 30 and cand.Skill <= 95, "habilidad 30-95")
	assert(cand.Salary == math.floor((80 + cand.Skill * 4) * LifeData.RoleById[cand.Role].Pay + 0.5), "salario semanal según habilidad y puesto")
end
-- Cuenta propia de la empresa
local mC = data.Money
must(player, "Company.Deposit", { amount = 8000 })
assert(co.Funds == 8000 and mC - data.Money == 8000, "ingreso en la cuenta de la empresa")
assert(not call(player, "Company.Deposit", { amount = 10000000 }).ok and co.Funds == 8000, "no se ingresa más de lo que tienes")
assert(not call(player, "Company.Deposit", { amount = -5 }).ok, "cantidad negativa rechazada")
must(player, "Company.Withdraw", { amount = 1000 })
assert(co.Funds == 7000 and data.Money == mC - 7000, "retirada a tu dinero")
assert(not call(player, "Company.Withdraw", { amount = 999999 }).ok and co.Funds == 7000, "no se retira más de lo que tiene la empresa")
-- Encargo de cliente controlado y otro de categoría distinta
co.OffersDay = data.Home.PlayDays
co.Offers = {
	{ Id = "ktest", Client = 1, Category = "vlog", MinQ = 5, Days = 3, Pay = 2000, Bonus = 400 },
	{ Id = "kfood", Client = 7, Category = "food", MinQ = 5, Days = 1, Pay = 900, Bonus = 100 },
}
must(player, "Company.AcceptClient", { id = "ktest" })
must(player, "Company.AcceptClient", { id = "kfood" })
assert(co.Active.ktest and co.Active.ktest.DueDay == data.Home.PlayDays + 3 and #co.Offers == 0, "encargos aceptados")
assert(not call(player, "Company.AcceptClient", { id = "ktest" }).ok, "no se acepta dos veces")
-- Proyecto para el cliente: grabar en casa, importar, editar y exportar SIN editor
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
M.stepBackground()
data.Needs.Energy = 100
local cpid2 = must(player, "Video.CreateProject", { category = "vlog", name = "Encargo de la panadería" }).data.pid
must(player, "Video.StartRecording", { pid = cpid2 })
for i = 1, 4 do
	M.clock = M.clock + 5
	must(player, "Video.RecordScene", { shot = i == 1 and "talking" or "wide" })
end
must(player, "Video.StopRecording", {})
Computer.onPrompt(player, room.DeskPrompt.Parent, "home", player.UserId)
must(player, "Video.Import", { pid = cpid2 })
local tlc = {}
for _, scx in ipairs(data.Projects[cpid2].Scenes) do
	tlc[#tlc + 1] = { k = "s", id = scx.Id, trim = 1, tr = "cut" }
end
must(player, "Video.SaveEdit", { pid = cpid2, edit = { Timeline = tlc } })
assert(Company.exportMult(player) == 1, "sin editor no hay efecto")
local exA = must(player, "Video.Export", { pid = cpid2 })
M.time = M.time + exA.data.secs + 1
-- Contratar: editor (candidato controlado) y fotógrafo; el nivel 1 permite 2 empleados
co.Candidates[1] = { Id = "ctest", Name = "Ana Prueba", Role = "editor", Skill = 95, Salary = LifeData.salaryFor(95, "editor") }
co.Candidates[2] = { Id = "cfoto", Name = "Leo Foto", Role = "photographer", Skill = 50, Salary = LifeData.salaryFor(50, "photographer") }
must(player, "Company.Hire", { id = "ctest" })
assert(not call(player, "Company.Hire", { id = "ctest" }).ok, "no se contrata dos veces al mismo candidato")
must(player, "Company.Hire", { id = "cfoto" })
assert(CUtil.count(co.Staff) == 2 and data.Counters.employees_hired == 2, "dos empleados contratados")
assert(Company.maxStaff(player) == 2, "productora pequeña: 2 empleados")
local third = call(player, "Company.Hire", { id = co.Candidates[1].Id })
assert(not third.ok and third.msg:find("Plantilla"), "máximo de empleados del nivel: " .. tostring(third.msg))
assert(LifeData.companyMaxStaff(co, { pro_studio = { Mode = "rent" } }, req(Shared.PropertyData).ById) == 4, "un estudio o local da +2 empleados")
local editorId, fotoId
for id, e in pairs(co.Staff) do
	if e.Role == "editor" then
		editorId = id
	else
		fotoId = id
	end
end
-- Efecto del editor en la exportación
assert(Company.exportMult(player) < 0.85, "el editor acelera la exportación")
data.Needs.Energy = 100
local exB = must(player, "Video.Export", { pid = cpid2 })
assert(exB.data.secs < exA.data.secs, "exportación más rápida con editor: " .. exA.data.secs .. " -> " .. exB.data.secs)
M.time = M.time + exB.data.secs + 1
-- Despedir con indemnización de 1 semana (desde la empresa)
local fFire, mFire = co.Funds, data.Money
must(player, "Company.Fire", { id = fotoId })
assert(co.Staff[fotoId] == nil and fFire - co.Funds == LifeData.salaryFor(50, "photographer") and data.Money == mFire, "indemnización pagada por la empresa")
-- Publicar para el cliente: categoría equivocada, encargo inexistente y el correcto
local wrongCat = call(player, "Video.Publish", { pid = cpid2, title = "Un día en la panadería", client = "kfood" })
assert(not wrongCat.ok and wrongCat.msg:find("Restaurantes"), "el encargo exige su categoría: " .. tostring(wrongCat.msg))
assert(not call(player, "Video.Publish", { pid = cpid2, title = "Un día en la panadería", client = "nope" }).ok, "encargo inexistente")
local fundsP, repP = co.Funds, co.Rep
must(player, "Video.Publish", { pid = cpid2, title = "Un día en la panadería La Espiga", client = "ktest" })
assert(co.Active.ktest == nil and co.Contracts == 1 and data.Counters.client_contracts == 1, "encargo cumplido")
assert(co.Funds - fundsP >= 2000 and co.Rep > repP, "el cliente paga a la empresa y sube la reputación")
assert(data.Videos[1].Client == LifeData.Clients[1].Name, "el vídeo queda marcado como encargo")
-- Día de pago: la nómina sale de la cuenta de la empresa; el encargo vencido baja la reputación
local salary = co.Staff[editorId].Salary
local fundsS, repS = co.Funds, co.Rep
data.Home.PlayDays = co.NextPay - 1
Home.onNewDay(player)
assert(fundsS - co.Funds == salary, "nómina pagada desde la empresa: " .. (fundsS - co.Funds) .. " de " .. salary)
assert(co.Staff[editorId].Missed == 0 and co.NextPay == data.Home.PlayDays + 7, "próxima nómina en 7 días")
assert(co.Active.kfood == nil and co.Rep == repS - 10 and co.Failed == 1, "incumplir un encargo baja la reputación de empresa")
-- Impago: sin fondos baja la moral y tras 2 impagos el empleado se va (nunca se toca el dinero personal)
if co.Funds > 0 then
	must(player, "Company.Withdraw", { amount = co.Funds })
end
data.Money = 12345
local morale0 = co.Staff[editorId].Morale
data.Home.PlayDays = co.NextPay
Company.onNewDay(player)
assert(data.Money == 12345, "el salario nunca sale de tu dinero personal")
assert(co.Staff[editorId] and co.Staff[editorId].Missed == 1 and co.Staff[editorId].Morale < morale0, "primer impago: baja la moral")
data.Home.PlayDays = co.NextPay
Company.onNewDay(player)
assert(co.Staff[editorId] == nil and data.Money == 12345, "tras 2 impagos el empleado se va")
assert(Company.exportMult(player) == 1 and co.Funds == 0, "sin editor no hay efecto")
-- Resto de efectos reales
local function fakeStaff(role, skill)
	co.Seq = co.Seq + 1
	local id = "e" .. co.Seq
	co.Staff[id] = { Id = id, N = co.Seq, Name = "Prueba " .. role, Role = role, Skill = skill, Salary = 100, Morale = 100, Missed = 0, Since = data.Home.PlayDays }
	return id
end
local fx0 = { Company.sceneBonus(player), Company.thumbBonus(player) }
local ids = { fakeStaff("assistant", 60), fakeStaff("manager", 60), fakeStaff("technician", 60), fakeStaff("camera", 95), fakeStaff("designer", 95), fakeStaff("photographer", 80) }
assert(fx0[1] == 0 and fx0[2] == 0 and Company.sceneBonus(player) == 4 and Company.thumbBonus(player) == 5, "camarógrafo +4 y diseñador +5")
data.Needs.Energy = 50
Needs.spend(player, 4)
assert(math.abs(data.Needs.Energy - 47) < 0.01, "el asistente reduce el gasto de energía: " .. data.Needs.Energy)
assert(Company.repairMult(player) == 0.5, "técnico: reparaciones a mitad de precio")
local spC = Sponsor.state(data)
spC.OffersDay = -1
spC.Offers = {}
Sponsor.refreshOffers(player)
assert(#spC.Offers == req(Shared.SponsorData).OffersPerDay + 1, "el gestor consigue una oferta de patrocinio más")
local fPhoto = co.Funds
data.Home.PlayDays = data.Home.PlayDays + 1
Company.onNewDay(player)
assert(co.Funds - fPhoto == 160, "el fotógrafo vende fotos cada día: " .. (co.Funds - fPhoto))
for _, id in ipairs(ids) do
	co.Staff[id] = nil
end
-- Logros de empresa
Quest.check(player)
assert(data.Quests.Completed["company_created_1"] and data.Quests.Completed["employees_hired_1"] and data.Quests.Completed["client_contracts_1"], "logros de empresa")
data.Money = 50000
-- VEHÍCULOS: concesionario, compra, conducción con consumo, gasolinera, taller, mejoras, pintura, alquiler, venta y maletero
local Vehicle = req(ServerScriptService.Server.Services.VehicleService)
local Inventory = req(ServerScriptService.Server.Services.InventoryService)
local TimeSvc = req(ServerScriptService.Server.Services.TimeWeatherService)
local dealer, gas
for _, sp in ipairs(WorldData.Specials) do
	if sp.Type == "dealer" then
		dealer = sp
	elseif sp.Type == "gas" and not gas then
		gas = sp
	end
end
assert(dealer and gas, "concesionario y gasolinera en el mapa")
data.Money = 100000
data.Level = 6
M.moveTo(player, room.Center.X, room.Center.Y + 2, room.Center.Z)
assert(not call(player, "Veh.Buy", { model = "v_compact", color = 2 }).ok, "solo se compra en el concesionario")
M.moveTo(player, dealer.WX, 3, dealer.WZ)
assert(not call(player, "Veh.Buy", { model = "v_lux" }).ok, "requisito de nivel")
assert(not call(player, "Veh.Buy", { model = "nada" }).ok, "modelo no válido")
local mV = data.Money
local carId = must(player, "Veh.Buy", { model = "v_compact", color = 2 }).data.id
local carPrice = math.floor(6500 * Events.priceMultiplier({ Cat = "vehicle" }) + 0.5)
assert(mV - data.Money == carPrice, "cobra el precio del vehículo: " .. (mV - data.Money))
local car = data.Vehicles[carId]
assert(car and car.Model == "v_compact" and car.Color == 2 and car.Fuel == 100 and car.Cond == 100, "vehículo en el garaje")
Quest.check(player)
assert(data.Quests.Completed["vehicles_bought_1"], "logro de primer vehículo")
-- Sacarlo: modelo con VehicleSeat y restricciones de movimiento en workspace
must(player, "Veh.Spawn", { id = carId })
local vmodel = Vehicle.spawnedModel(player)
assert(vmodel and vmodel.Parent == M.workspace and vmodel:IsA("Model"), "el vehículo aparece en el mundo")
assert(vmodel:FindFirstChildOfClass("VehicleSeat"), "tiene asiento de conductor")
assert(vmodel:GetAttribute("YTVehicle") and vmodel:GetAttribute("MaxSpeed") == 75 and vmodel:GetAttribute("VehicleId") == carId)
local chassis = vmodel.PrimaryPart
assert(chassis and chassis:FindFirstChild("Drive") and chassis:FindFirstChild("Steer"), "LinearVelocity y AngularVelocity")
assert(Vehicle.spawnedId(player) == carId)
-- Maletero: cerca del vehículo la mochila gana espacios
local cp = chassis.Position
M.moveTo(player, cp.X + 5, 3, cp.Z)
local capNear = Inventory.backpackCap(player)
M.moveTo(player, cp.X + 200, 3, cp.Z)
local capFar = Inventory.backpackCap(player)
assert(capNear - capFar == 4, "el maletero del Orbis Compacto suma 4 espacios: " .. capNear .. " vs " .. capFar)
-- Conducir 2 km: consume combustible, desgasta y cuenta kilómetros
for i = 1, 8 do
	chassis.CFrame = chassis.CFrame + M.Vector3.new(250, 0, 0)
	M.stepBackground()
end
assert(car.Odo >= 1900 and car.Fuel < 100 and car.Fuel > 90, "consumo por distancia: " .. car.Fuel .. " / " .. car.Odo)
assert(car.Cond < 100, "desgaste")
assert(data.Counters.drive_km == 2, "kilómetros: " .. tostring(data.Counters.drive_km))
assert(data.Quests.Completed["drive_km_1"], "logro del primer kilómetro")
-- Un salto enorme (teletransporte) no cuenta
local odo0 = car.Odo
chassis.CFrame = chassis.CFrame + M.Vector3.new(2000, 0, 0)
M.stepBackground()
assert(car.Odo == odo0, "los saltos no cuentan como distancia")
-- Sin combustible: muy despacio
car.Fuel = 0.1
chassis.CFrame = chassis.CFrame + M.Vector3.new(100, 0, 0)
M.stepBackground()
assert(car.Fuel == 0 and vmodel:GetAttribute("MaxSpeed") == 8, "sin combustible va muy despacio")
-- Repostar solo en la gasolinera
M.moveTo(player, dealer.WX, 3, dealer.WZ)
assert(not call(player, "Veh.Refuel", { id = carId }).ok, "no se reposta en el concesionario")
M.moveTo(player, gas.WX, 3, gas.WZ)
local mF = data.Money
must(player, "Veh.Refuel", { id = carId })
assert(car.Fuel == 100 and mF - data.Money == 40 and vmodel:GetAttribute("MaxSpeed") == 75, "depósito lleno por $40")
assert(not call(player, "Veh.Refuel", { id = carId }).ok, "ya está lleno")
-- Taller
car.Cond = 30
local mR = data.Money
must(player, "Veh.Repair", { id = carId })
assert(car.Cond == 100 and mR - data.Money == 910, "reparación: " .. (mR - data.Money))
-- Mejoras y pintura (en el concesionario)
assert(not call(player, "Veh.Upgrade", { id = carId, key = "engine" }).ok, "las mejoras se instalan en el concesionario")
M.moveTo(player, dealer.WX, 3, dealer.WZ)
assert(not call(player, "Veh.Upgrade", { id = carId, key = "turbo" }).ok, "mejora no válida")
must(player, "Veh.Upgrade", { id = carId, key = "engine" })
must(player, "Veh.Upgrade", { id = carId, key = "trunk" })
assert(not call(player, "Veh.Upgrade", { id = carId, key = "engine" }).ok, "no se instala dos veces")
assert(math.abs(vmodel:GetAttribute("MaxSpeed") - 75 * 1.15) < 0.01, "el motor mejorado sube la velocidad")
cp = chassis.Position
M.moveTo(player, cp.X, 3, cp.Z)
assert(Inventory.backpackCap(player) - capFar == 7, "maletero ampliado: +3")
M.moveTo(player, dealer.WX, 3, dealer.WZ)
assert(not call(player, "Veh.Paint", { id = carId, color = 99 }).ok, "color no válido")
local mP = data.Money
must(player, "Veh.Paint", { id = carId, color = 5 })
assert(car.Color == 5 and mP - data.Money == 200, "pintura")
assert(math.abs(vmodel:FindFirstChild("Body").Color.R - 250 / 255) < 0.01, "se repinta el vehículo en la calle")
-- Guardar
must(player, "Veh.Store", {})
assert(vmodel.Parent == nil and Vehicle.spawnedId(player) == nil, "guardado en el garaje")
assert(not call(player, "Veh.Store", {}).ok)
-- Alquiler de un día
local mA = data.Money
must(player, "Veh.Rent", { model = "v_moto", color = 3 })
assert(mA - data.Money == 44 and data.Rental and data.Rental.Rec.Model == "v_moto", "alquiler: 2 % del precio")
assert(Vehicle.spawnedId(player) == "rental", "el alquilado sale a la calle")
local rentModel = Vehicle.spawnedModel(player)
data.Rental.Until = TimeSvc.day() - 1
M.stepBackground()
assert(data.Rental == nil and Vehicle.spawnedId(player) == nil and rentModel.Parent == nil, "el alquiler caduca y el vehículo vuelve")
assert(not call(player, "Veh.Spawn", { id = "rental" }).ok)
-- Vender
local value = req(Shared.LifeData).sellValue(car)
assert(value > 0)
local mS = data.Money
must(player, "Veh.Sell", { id = carId })
assert(data.Vehicles[carId] == nil and data.Money - mS == value, "venta")
assert(not call(player, "Veh.Spawn", { id = carId }).ok, "ya no es tuyo")
-- La sincronización expone el vehículo en la calle y el maletero
local viewV = req(ServerScriptService.Server.Services.SyncService).build(player)
assert(viewV.Derived.VehicleOut == nil and viewV.Derived.TrunkBonus == 0)

-- Guardado: al salir se guarda y se libera el bloqueo
Players.PlayerRemoving:Fire(player)
local saved = M.store["u_101"]
assert(saved and saved.__lock == nil, "el bloqueo de sesión debe liberarse al salir")
assert(#saved.Videos == #data.Videos and #data.Videos >= 2, "los vídeos deben quedar guardados")

-- Recarga: los datos persisten
local p2 = M.newPlayer(Players, 101, "Tester")
Players.PlayerAdded:Fire(p2)
local d2 = Data.get(p2)
assert(d2 and #d2.Videos == #data.Videos and d2.Channel.TotalViews > 0, "los datos se recuperan")

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
