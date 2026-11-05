-- Prueba de integración del servidor: arranca todos los servicios con la API de Roblox simulada
-- y recorre el juego: compras en la cinta, producción, colector, láser, robos, recuperar, trampas, dron,
-- fusión, investigación, mejoras, ventas, compras con Robux idempotentes, guardado y bloqueo de sesión.

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
local warnings = {}
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

-- Arrancar el servidor
local SSS = services.ServerScriptService
local mainScript = SSS.Server.Main
local mainFn = assert(loadstring(READ(mainScript.Path), "@Main"))
setfenv(mainFn, setmetatable({ script = mainScript }, { __index = env }))
mainFn()

local Shared = services.ReplicatedStorage.Shared
local Svc = SSS.Server.Services
local Data = req(Svc.DataService)
local World = req(Svc.WorldService)
local Lab = req(Svc.LabService)
local Conveyor = req(Svc.ConveyorService)
local Raid = req(Svc.RaidService)
local Fusion = req(Svc.FusionService)
local Event = req(Svc.EventService)
local Mon = req(Svc.MonetizationService)
local Sync = req(Svc.SyncService)
local Config = req(Shared.Config)
local MutantData = req(Shared.MutantData)
local LabData = req(Shared.LabData)
local MC = req(Shared.MonetizationConfig)
local Remote = services.ReplicatedStorage.Remotes.Request

local function call(player, action, payload)
	M.clock = M.clock + 0.3
	return Remote.OnServerInvoke(player, action, payload)
end
local function must(player, action, payload)
	local r = call(player, action, payload)
	assert(r.ok, action .. ": " .. tostring(r.msg))
	return r
end

-- Mapa
local map = M.workspace:FindFirstChild("Map")
assert(map and map:FindFirstChild("Belt") and map:FindFirstChild("Lab8"), "mapa con cinta y 8 laboratorios")
local mapParts = #map:GetDescendants()
assert(#World.labs == 8 and #World.labs[1].Pedestals == 18, "18 pedestales por laboratorio")

-- Datos compartidos coherentes
for _, sp in ipairs(MutantData.Species) do
	assert(MutantData.RarityById[sp.Rarity], "rareza de " .. sp.Id)
	assert(sp.Price > 0 and sp.Income > 0, "precio y producción de " .. sp.Id)
end

-- Jugadores
local Players = services.Players
local ana = M.newPlayer(Players, 101, "Ana")
local beto = M.newPlayer(Players, 202, "Beto")
Players.PlayerAdded:Fire(ana)
Players.PlayerAdded:Fire(beto)
local da, db = Data.get(ana), Data.get(beto)
assert(da and db and da.Credits == Config.StartingCredits, "perfiles cargados con créditos iniciales")
assert(Lab.indexOf(ana) == 1 and Lab.indexOf(beto) == 2, "cada jugador recibe un laboratorio")
assert(World.labs[1].SignText.Text == "Laboratorio de Ana", "cartel con el dueño")
assert(ana:FindFirstChild("leaderstats"), "tabla de clasificación")

local function near(player, pos)
	M.moveTo(player, pos.X, 3, pos.Z)
end
local function capPos(cap)
	return M.Vector3.new(cap.X, 3, Config.BeltZ + 6)
end

-- Comprar en la cinta
local cap = Conveyor.spawn("blobito")
assert(cap.Model and cap.Model.Parent == World.dynamic, "la cápsula aparece en la cinta")
M.moveTo(ana, 0, 3, 120)
assert(not Conveyor.buy(ana, cap.Id), "lejos de la cápsula no se compra")
near(ana, capPos(cap))
near(beto, capPos(cap))
local ok, msg = Conveyor.buy(ana, cap.Id)
assert(ok, msg)
assert(not Conveyor.buy(beto, cap.Id), "la misma cápsula no se vende dos veces")
assert(da.Lab.Slots["1"] and da.Lab.Slots["1"].S == "blobito", "el mutante va al primer pedestal")
local reward = math.floor(25 * Config.DiscoverReward)
assert(da.Credits == Config.StartingCredits - 25 + reward, "precio cobrado y recompensa del bestiario: " .. da.Credits)
assert(da.Index.blobito == 1, "especie descubierta")
assert(Lab.state(ana).Models[1], "modelo sobre el pedestal")
local expensive = Conveyor.spawn("titangel")
near(ana, capPos(expensive))
assert(not Conveyor.buy(ana, expensive.Id), "sin créditos suficientes no se compra")
-- la cinta avanza y el reciclador se lleva lo que nadie compra
local x0 = expensive.X
Conveyor.step(2)
assert(math.abs(expensive.X - (x0 + Config.BeltSpeed * 2)) < 1e-6, "la cinta mueve las cápsulas")
expensive.X = Config.BeltEndX + 1
Conveyor.step(0.1)
assert(Conveyor.capsules[expensive.Id] == nil, "al final de la cinta se recicla")

-- Producción en el tanque y colector
Lab.tick(10)
assert(math.abs(da.Lab.Tank - 10) < 1e-6, "el tanque se llena con la producción: " .. da.Lab.Tank)
M.moveTo(ana, 0, 3, 0)
assert(not call(ana, "Lab.Collect").ok, "hay que ir al colector")
local colPos = World.labPos(1, World.CollectorLocal[1], 1, World.CollectorLocal[2])
near(ana, colPos)
local c0 = da.Credits
must(ana, "Lab.Collect")
assert(da.Credits == c0 + 10 and da.Lab.Tank < 1, "créditos recogidos")
Lab.tick(100000)
assert(da.Lab.Tank == Lab.tankCap(ana, da), "el tanque tiene un límite")
must(ana, "Lab.Collect")

-- Robo con la puerta láser
local gato = { S = "gatoplasma", L = 1 }
assert(Lab.addMutant(ana, gato, 2) == 2, "mutante en el pedestal 2")
local inside = World.labPos(1, 0, 3, 0)
M.moveTo(ana, inside.X, 3, inside.Z)
must(ana, "Lab.Laser")
assert(World.labs[1].LaserOn and World.labs[1].LaserWall.CanCollide, "láser activo")
assert(not call(ana, "Lab.Laser").ok, "no se puede encender dos veces")
near(beto, World.labs[1].Pedestals[2].Top)
local g, gmsg = Raid.grab(beto, 1, 2)
assert(not g and gmsg:find("láser"), "con el láser activo no se puede robar")
Lab.state(ana).LaserUntil = M.clock - 1
Lab.tick(0.1)
assert(not World.labs[1].LaserOn, "el láser se apaga solo")
assert(not call(ana, "Lab.Laser").ok, "el láser se recarga antes de volver a usarse")

-- Robo completo
local incomeBefore = Lab.incomePerSecond(ana)
M.moveTo(beto, 0, 3, 150)
assert(not Raid.grab(beto, 1, 2), "hay que estar cerca del pedestal")
near(beto, World.labs[1].Pedestals[2].Top)
assert(Raid.grab(beto, 1, 2))
assert(Raid.carrying[beto], "Beto lleva el mutante")
assert(beto.Character.Humanoid.WalkSpeed == Config.CarryWalkSpeed, "cargando se va más despacio")
assert(Lab.incomePerSecond(ana) < incomeBefore, "el mutante robado deja de producir")
assert(not call(ana, "Lab.Sell", { slot = 2 }).ok, "no se puede vender lo que te están robando")
assert(not Fusion.start(ana, 1, 2), "ni fusionarlo")
assert(not Raid.grab(beto, 1, 1), "solo se lleva uno a la vez")
local entry = World.labs[2].EntryPos
near(beto, entry)
Raid.step()
assert(not Raid.carrying[beto], "entregado")
assert(da.Lab.Slots["2"] == nil, "Ana ya no lo tiene")
local found = nil
for k, rec in pairs(db.Lab.Slots) do
	if rec.S == "gatoplasma" then
		found = rec
	end
end
assert(found and found.Id:find("^202%-"), "ahora es de Beto con un identificador nuevo")
assert(db.Stats.Stolen == 1 and da.Stats.Lost == 1, "estadísticas de robos")
assert(beto.Character.Humanoid.WalkSpeed == Config.NormalWalkSpeed, "vuelve a la velocidad normal")

-- Recuperar tocando al ladrón
near(beto, World.labs[1].Pedestals[1].Top)
assert(Raid.grab(beto, 1, 1))
local rb = beto.Character.HumanoidRootPart.Position
M.moveTo(ana, rb.X + 2, 3, rb.Z)
local okR, msgR = Raid.recapture(ana, beto)
assert(okR, msgR)
assert(not Raid.carrying[beto] and da.Lab.Slots["1"] and Lab.state(ana).Models[1], "recuperado y de vuelta en su pedestal")
assert(not Raid.recapture(beto, beto), "solo el dueño puede recuperar")

-- Trampa de baba
assert(not call(ana, "Lab.Defense", { id = "trap" }).ok, "sin créditos no hay trampa")
da.Credits = 1000000
must(ana, "Lab.Defense", { id = "trap" })
assert(not call(ana, "Lab.Defense", { id = "trap" }).ok, "una trampa por nivel del laboratorio")
must(ana, "Lab.Defense", { id = "alarm" })
near(beto, World.labs[1].Pedestals[1].Top)
assert(Raid.grab(beto, 1, 1))
near(beto, World.labs[1].Traps[1].Pos)
Raid.step()
assert(not Raid.carrying[beto], "la trampa le hace soltarlo")
assert(beto.Character.Humanoid.WalkSpeed == Config.TrapWalkSpeed, "y le frena")
M.clock = M.clock + Config.TrapSlowSeconds + 1
M.moveTo(beto, 0, 3, 0)
Raid.step()
assert(beto.Character.Humanoid.WalkSpeed == Config.NormalWalkSpeed, "el frenazo se pasa")

-- Dron guardián (requiere nivel 3)
assert(not call(ana, "Lab.Defense", { id = "drone" }).ok, "el dron necesita laboratorio nivel 3")
must(ana, "Lab.Upgrade")
must(ana, "Lab.Upgrade")
assert(da.Lab.Tier == 3 and World.labs[1].Pedestals[12].Part.Transparency == 0, "laboratorio nivel 3 con 12 pedestales")
must(ana, "Lab.Defense", { id = "drone" })
near(beto, World.labs[1].Pedestals[1].Top)
assert(Raid.grab(beto, 1, 1))
M.clock = M.clock + 2
Raid.step()
assert(not Raid.carrying[beto], "el dron recupera el mutante dentro del laboratorio")

-- Fusión
local s1 = Lab.addMutant(ana, { S = "saltarrana", L = 1 })
local s2 = Lab.addMutant(ana, { S = "saltarrana", L = 1, M = "rad" })
assert(not call(ana, "Fusion.Start", { a = s1, b = 1 }).ok, "especies distintas no se fusionan")
must(ana, "Fusion.Start", { a = s1, b = s2 })
assert(da.Lab.Slots[tostring(s1)] == nil and da.Lab.Slots[tostring(s2)] == nil, "entran en la cámara")
assert(not call(ana, "Fusion.Claim").ok, "hay que esperar")
M.time = M.time + 1000
must(ana, "Fusion.Claim")
local fused = nil
for _, rec in pairs(da.Lab.Slots) do
	if rec.S == "saltarrana" then
		fused = rec
	end
end
assert(fused and fused.L == 2 and fused.M == "rad", "nivel 2 conservando la mejor mutación")
assert(math.abs(MutantData.income(fused) - 1.5 * 2 * Config.LevelIncomeMult) < 1e-6, "produce más")
assert(da.Stats.Fusions == 1)

-- Investigación, mejoras y venta
local inc0 = Lab.incomePerSecond(ana)
must(ana, "Lab.Research", { id = "income" })
assert(da.Research.income == 1 and math.abs(Lab.incomePerSecond(ana) - inc0 * 1.1) < 1e-6, "investigación de producción")
must(ana, "Lab.Research", { id = "discount" })
local cheap = Conveyor.spawn("champibaile")
assert(Conveyor.priceFor(ana, cheap) == math.floor(90 * 0.96), "descuento del generador")
assert(not call(ana, "Lab.Research", { id = "nope" }).ok)
local cr = da.Credits
local sold = must(ana, "Lab.Sell", { slot = 1 })
assert(da.Credits == cr + sold.data.value and da.Lab.Slots["1"] == nil, "venta")
local fromSlot = nil
for k in pairs(da.Lab.Slots) do
	fromSlot = tonumber(k)
end
must(ana, "Lab.Move", { from = fromSlot, to = 1 })
assert(da.Lab.Slots["1"] ~= nil, "mover entre pedestales")

-- Lleno: no se puede comprar ni robar sin sitio
db.Credits = 100
local free = {}
while Lab.freeSlot(beto) do
	Lab.addMutant(beto, { S = "blobito", L = 1 })
end
local c2 = Conveyor.spawn("blobito")
near(beto, capPos(c2))
assert(not Conveyor.buy(beto, c2.Id), "laboratorio lleno")
near(beto, World.labs[1].Pedestals[1].Top)
assert(not Raid.grab(beto, 1, 1), "sin sitio no se puede robar")

-- Eventos
local baseInc = Lab.incomePerSecond(ana)
Event.begin(LabData.Events[4])
assert(Event.incomeMult() == 2 and math.abs(Lab.incomePerSecond(ana) - baseInc * 2) < 1e-6, "doble producción")
Event.finish()
assert(Event.incomeMult() == 1)
-- Rebajas del generador
Event.begin(LabData.Events[6])
assert(Conveyor.priceFor(ana, cheap) == math.floor(90 * 0.96 * 0.7), "rebajas del generador")
Event.finish()

-- Tubería de créditos
da.Research.pipe = 2
da.Lab.Tank = 1000
Lab.state(ana).PipeAt = 0
local crPipe = da.Credits
Lab.tick(0)
assert(da.Lab.Tank == 800 and da.Credits == crPipe + 200, "la tubería pasa el 20% del tanque a tus créditos")

-- Misiones diarias y premio por entrar
local Daily = req(Svc.DailyService)
local dv = Daily.view(ana)
assert(dv and #dv.Missions == 3 and dv.Streak == 1, "3 misiones diarias y racha de 1 día")
must(ana, "Daily.Login")
assert(not call(ana, "Daily.Login").ok, "el premio diario se cobra una vez")
local m1 = da.Daily.Missions[1]
m1.Progress = 0
assert(not call(ana, "Daily.Claim", { i = 1 }).ok, "sin completar no se cobra")
Daily.progress(ana, m1.Kind, m1.Target)
local crD = da.Credits
must(ana, "Daily.Claim", { i = 1 })
assert(da.Credits == crD + m1.Reward and not call(ana, "Daily.Claim", { i = 1 }).ok, "misión cobrada una sola vez")
da.Daily.Day = "otro"
da.Daily.LastLogin = os.date("!%Y-%m-%d", M.time - 86400)
Daily.refresh(ana)
assert(da.Daily.Streak == 2 and da.Daily.LoginClaimed == false and da.Daily.Missions[1].Claimed == false, "al día siguiente: racha +1 y misiones nuevas")
da.Daily.Day = "otro"
da.Daily.LastLogin = "2000-01-01"
Daily.refresh(ana)
assert(da.Daily.Streak == 1, "si faltas un día la racha vuelve a empezar")

-- Clasificación
local Board = req(Svc.LeaderboardService)
local top = Board.update()
assert(map:FindFirstChild("Leaderboard") and top[1] and top[1].name == "Ana", "panel de clasificación con los mejores")
assert(Sync.build(ana).Daily and Sync.build(ana).Top, "el cliente recibe diario y clasificación")

-- Vista para el cliente
local view = Sync.build(ana)
assert(view.Lab and view.Lab.Tier == 3 and #view.Index == #MutantData.Species and view.Shop, "vista del cliente")
assert(view.Shop.Passes[1].Configured == false, "sin IDs no se ofrece el pase")
assert(not call(ana, "Shop.Prompt", { key = "VIP" }).ok, "no hay botones de compra falsos")

-- Compras con Robux: idempotentes
assert(Mon.processReceipt({ PlayerId = 101, PurchaseId = "x1", ProductId = 999 }) == M.Enum.ProductPurchaseDecision.NotProcessedYet, "producto sin configurar")
MC.Products[1].Id = 555
local before = da.Credits
assert(Mon.processReceipt({ PlayerId = 101, PurchaseId = "p1", ProductId = 555 }) == M.Enum.ProductPurchaseDecision.PurchaseGranted)
local after = da.Credits
assert(after > before, "créditos entregados")
assert(Mon.processReceipt({ PlayerId = 101, PurchaseId = "p1", ProductId = 555 }) == M.Enum.ProductPurchaseDecision.PurchaseGranted)
assert(da.Credits == after, "la misma compra no se entrega dos veces")
MC.Products[1].Id = 0

-- Robo en curso y el dueño se va: el mutante se queda en su perfil (sin duplicar)
db.Lab.Slots["1"] = nil
Lab.placeModel(beto, 1)
near(beto, World.labs[1].Pedestals[2].Top)
local targetSlot = nil
for k in pairs(da.Lab.Slots) do
	targetSlot = tonumber(k)
end
near(beto, World.labs[1].Pedestals[targetSlot].Top)
assert(Raid.grab(beto, 1, targetSlot))
local countAna = 0
for _ in pairs(da.Lab.Slots) do
	countAna = countAna + 1
end
Players.PlayerRemoving:Fire(ana)
ana.Parent = nil
assert(not Raid.carrying[beto], "el robo se cancela si el dueño se va")
local saved = M.store["u_101"]
assert(saved and saved.__lock == nil, "guardado y bloqueo liberado")
local savedCount = 0
for _ in pairs(saved.Lab.Slots) do
	savedCount = savedCount + 1
end
assert(savedCount == countAna, "el mutante sigue en el perfil del dueño")
assert(Lab.ownerOf(1) == nil and World.labs[1].SignText.Text == "Laboratorio libre", "laboratorio liberado")

-- Recarga
local ana2 = M.newPlayer(Players, 101, "Ana")
Players.PlayerAdded:Fire(ana2)
local d2 = Data.get(ana2)
assert(d2 and d2.Lab.Tier == 3 and d2.Research.income == 1 and d2.Lab.Drone, "los datos se recuperan")
assert(Lab.indexOf(ana2) == 1, "vuelve a tener laboratorio")

-- Bloqueo de sesión de otro servidor: no se sobrescribe y se expulsa
M.store["u_303"] = { Credits = 999, __lock = { job = "otro", t = M.time } }
local carla = M.newPlayer(Players, 303, "Carla")
Players.PlayerAdded:Fire(carla)
assert(Data.get(carla) == nil and #M.kicked >= 1 and M.store["u_303"].Credits == 999, "perfil bloqueado: expulsión sin pisar datos")

-- Studio sin acceso a DataStore: perfil temporal
M.isStudio = true
M.storeFails = true
local dani = M.newPlayer(Players, 404, "Dani")
Players.PlayerAdded:Fire(dani)
assert(Data.get(dani) and Lab.indexOf(dani), "en Studio se juega con perfil temporal")
M.storeFails = false
M.isStudio = false

-- Bucles en segundo plano sin errores
for _ = 1, 30 do
	M.stepBackground()
end
for _, w in ipairs(warnings) do
	assert(not w:find("producción:") and not w:find("cinta:") and not w:find("asaltos:") and not w:find("sync:") and not w:find("generador:") and not w:find("error en"), "error oculto: " .. w)
end

return "(mapa: " .. mapParts .. " piezas, " .. #MutantData.Species .. " especies)"
