--!nonstrict
-- TradeService: intercambio seguro de objetos y dinero entre dos jugadores cercanos.
--  Flujo: solicitar (≤ 20 studs) → el otro acepta → cada uno prepara su oferta (máx. 8 objetos + dinero) → ambos confirman.
--  * Cualquier cambio en una oferta anula las confirmaciones; confirmar exige la versión actual de las ofertas.
--  * Al ejecutar, el servidor vuelve a validar TODO (que cada objeto siga siendo de quien lo ofrece y se pueda dar,
--    el dinero y el espacio del receptor) y transfiere de forma atómica: el objeto pasa al receptor con un uid nuevo
--    y desaparece del emisor; si algo falla se restaura todo y no se transfiere nada.
--  * Se puede cancelar en cualquier momento; se cancela solo si alguien se aleja (> 25 studs) o sale del juego.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Catalog = require(Shared.ItemCatalog)
local MarketData = require(Shared.MarketData)
local Util = require(Shared.Util)

local Trade = {}
local S
local byPlayer = {} -- player -> intercambio en curso (pendiente o abierto)
local lastSeq = {} -- player -> número de la última versión enviada al cliente
local lastResult = {} -- player -> { Status, Msg } del último intercambio terminado
local lastRequest = {} -- player -> os.clock() de su última solicitud
local seq = 0
local nextId = 0

function Trade.Init(services)
	S = services
end

local function nameOf(p)
	return p.DisplayName or p.Name
end

local function other(t, player)
	return t.A == player and t.B or t.A
end

local function dist(a, b)
	local ra = a.Character and a.Character:FindFirstChild("HumanoidRootPart")
	local rb = b.Character and b.Character:FindFirstChild("HumanoidRootPart")
	if not ra or not rb then
		return math.huge
	end
	local pa, pb = ra.Position, rb.Position
	local dx, dy, dz = pa.X - pb.X, pa.Y - pb.Y, pa.Z - pb.Z
	return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function online(p)
	return p and p.Parent ~= nil and S.Data.get(p) ~= nil
end

local function offerView(data, offer, mine)
	local items = {}
	for _, uid in ipairs(offer.Items) do
		local rec = data and data.Inventory[uid]
		local def = rec and Catalog.get(rec.Id)
		items[#items + 1] = {
			Uid = mine and uid or nil,
			Id = rec and rec.Id or "",
			Name = def and def.Name or "(ya no lo tiene)",
			Cond = rec and math.floor(rec.Cond or 100) or 0,
			Collectible = def and def.Collectible == true or false,
			Missing = rec == nil,
		}
	end
	return { Items = items, Money = offer.Money }
end

-- Vista del intercambio para un jugador (la incluye SyncService en Derived.Trade y se envía con push "trade")
function Trade.view(player)
	local v = { Seq = lastSeq[player] or 0, Status = "none", Last = lastResult[player] }
	local t = byPlayer[player]
	if not t then
		return v
	end
	local o = other(t, player)
	v.Status = t.Status
	v.Id = t.Id
	v.Incoming = t.Status == "pending" and t.B == player
	v.Partner = { Name = nameOf(o), UserId = o.UserId }
	v.Version = t.Version
	v.Mine = offerView(S.Data.get(player), t.Offers[player], true)
	v.Theirs = offerView(S.Data.get(o), t.Offers[o], false)
	v.MyConfirmed = t.Confirmed[player] == true
	v.TheirConfirmed = t.Confirmed[o] == true
	v.MaxItems = MarketData.TradeMaxItems
	return v
end

local function pushState(p)
	seq = seq + 1
	lastSeq[p] = seq
	S.Net.push(p, "trade", Trade.view(p))
	S.Data.markDirty(p)
end

local function pushBoth(t)
	pushState(t.A)
	pushState(t.B)
end

local function close(t, status, msg, style)
	t.Status = status
	for _, p in ipairs({ t.A, t.B }) do
		if byPlayer[p] == t then
			byPlayer[p] = nil
		end
		lastResult[p] = { Status = status, Msg = msg }
		S.Net.notify(p, msg, style or (status == "done" and "success" or "warn"))
		pushState(p)
	end
end

-- Un cambio en una oferta: nueva versión y confirmaciones anuladas
local function changed(t, by)
	t.Version = t.Version + 1
	local had = t.Confirmed[t.A] or t.Confirmed[t.B]
	t.Confirmed = {}
	if had then
		S.Net.notify(other(t, by), "🤝 " .. nameOf(by) .. " cambió su oferta: las confirmaciones se han anulado.", "warn")
	end
	pushBoth(t)
end

function Trade.isOffered(player, uid)
	local t = byPlayer[player]
	if not t or t.Status ~= "open" then
		return false
	end
	return Util.indexOf(t.Offers[player].Items, uid) ~= nil
end

function Trade.get(player)
	return byPlayer[player]
end

-- Validación de la oferta de un jugador (al confirmar y otra vez al ejecutar)
local function validateOffer(t, p)
	local data = S.Data.get(p)
	if not data then
		return "sus datos no están disponibles."
	end
	local offer = t.Offers[p]
	local leaving = {}
	for _, uid in ipairs(offer.Items) do
		leaving[uid] = true
	end
	for _, uid in ipairs(offer.Items) do
		local rec = data.Inventory[uid]
		if not rec then
			return "ya no tiene uno de los objetos ofrecidos."
		end
		local err = S.Market.lockReason(p, uid, { leaving = leaving })
		if err then
			return err
		end
	end
	if type(offer.Money) ~= "number" or offer.Money < 0 or offer.Money ~= math.floor(offer.Money) then
		return "la cantidad de dinero no es válida."
	end
	if data.Money < offer.Money then
		return "ya no tiene los $" .. Util.formatInt(offer.Money) .. " ofrecidos."
	end
	return nil
end

-- ¿Le caben al receptor los objetos que recibe?
local function capacityError(t, receiver, giver)
	local data = S.Data.get(receiver)
	local incoming = #t.Offers[giver].Items
	if incoming == 0 then
		return nil
	end
	local outgoing = t.Offers[receiver].Items
	if Util.count(data.Inventory) - #outgoing + incoming > S.Inventory.MaxItems then
		return nameOf(receiver) .. " no tiene sitio en el inventario (máx. " .. S.Inventory.MaxItems .. " objetos)."
	end
	local outStored = 0
	for _, uid in ipairs(outgoing) do
		local rec = data.Inventory[uid]
		if rec and rec.Loc ~= "backpack" then
			outStored = outStored + 1
		end
	end
	if S.Property.storedCount(receiver) - outStored + incoming > S.Property.storageCap(receiver) then
		return nameOf(receiver) .. " no tiene espacio en su vivienda para lo que recibe."
	end
	return nil
end

local SNAP_KEYS = { "Inventory", "Equipped", "Money", "LifetimeEarned", "Uid", "Transactions", "Monthly", "Visited", "Counters" }
local function snapshot(data)
	local snap = {}
	for _, k in ipairs(SNAP_KEYS) do
		snap[k] = Util.deepCopy(data[k])
	end
	return snap
end
local function restore(data, snap)
	for _, k in ipairs(SNAP_KEYS) do
		data[k] = snap[k]
	end
end

-- Quita de las ofertas lo que ya no se puede dar (tras un fallo al ejecutar)
local function prune(t)
	for _, p in ipairs({ t.A, t.B }) do
		local offer = t.Offers[p]
		local keep = {}
		local leaving = {}
		for _, uid in ipairs(offer.Items) do
			leaving[uid] = true
		end
		for _, uid in ipairs(offer.Items) do
			if not S.Market.lockReason(p, uid, { leaving = leaving }) then
				keep[#keep + 1] = uid
			end
		end
		offer.Items = keep
		local data = S.Data.get(p)
		if data and offer.Money > data.Money then
			offer.Money = 0
		end
	end
end

-- Ejecuta el intercambio. Devuelve ok, mensaje de error
local function execute(t)
	local A, B = t.A, t.B
	if not online(A) or not online(B) then
		return false, "uno de los dos ya no está conectado."
	end
	if dist(A, B) > MarketData.TradeLeaveRadius then
		return false, "estáis demasiado lejos el uno del otro."
	end
	for _, p in ipairs({ A, B }) do
		local err = validateOffer(t, p)
		if err then
			return false, nameOf(p) .. " " .. err
		end
	end
	local capErr = capacityError(t, A, B) or capacityError(t, B, A)
	if capErr then
		return false, capErr
	end
	local dA, dB = S.Data.get(A), S.Data.get(B)
	local snapA, snapB = snapshot(dA), snapshot(dB)
	local received = { [A] = {}, [B] = {} }
	local ok, err = pcall(function()
		-- 1) Sacar los objetos de cada emisor
		local moving = { [A] = {}, [B] = {} }
		for _, p in ipairs({ A, B }) do
			local d = S.Data.get(p)
			for _, uid in ipairs(t.Offers[p].Items) do
				local rec = d.Inventory[uid]
				assert(rec, "objeto desaparecido durante el intercambio")
				moving[p][#moving[p] + 1] = Util.deepCopy(rec)
				d.Inventory[uid] = nil
				if d.Equipped.Phone == uid then
					d.Equipped.Phone = ""
				end
			end
		end
		-- 2) Dinero
		for _, p in ipairs({ A, B }) do
			local o = other(t, p)
			local amount = t.Offers[p].Money
			if amount > 0 then
				assert(S.Economy.spend(p, amount, "Intercambios", "Pago a " .. nameOf(o) .. " en un intercambio"), "dinero insuficiente")
				S.Economy.add(o, amount, "Intercambios", "Recibido de " .. nameOf(p) .. " en un intercambio", { silent = true })
				local od = S.Data.get(o)
				od.LifetimeEarned = od.LifetimeEarned - amount -- un intercambio no es dinero ganado
			end
		end
		-- 3) Entregar los objetos al receptor con uid nuevo
		for _, p in ipairs({ A, B }) do
			local o = other(t, p)
			local od = S.Data.get(o)
			for _, rec in ipairs(moving[p]) do
				local newUid = S.Data.nextUid(o, "i")
				assert(od.Inventory[newUid] == nil, "uid repetido")
				rec.Loc = "home"
				rec.Src = "trade"
				rec.Got = os.time()
				rec.GotDay = S.Time.day()
				rec.CleanDay = nil
				rec.Loan = nil
				od.Inventory[newUid] = rec
				local def = Catalog.get(rec.Id)
				if def and def.Cat == "camera" then
					od.Visited.Cameras[rec.Id] = true
				end
				received[o][#received[o] + 1] = { uid = newUid, id = rec.Id }
			end
		end
		for _, p in ipairs({ A, B }) do
			local d = S.Data.get(p)
			d.Counters.trades = (d.Counters.trades or 0) + 1
			d.Counters.trade_items = (d.Counters.trade_items or 0) + #received[p]
		end
	end)
	if not ok then
		restore(dA, snapA)
		restore(dB, snapB)
		S.Net.logError("trade execute", err)
		return false, "error interno: no se ha transferido nada."
	end
	-- Avisos y efectos posteriores (ya confirmado)
	for _, p in ipairs({ A, B }) do
		local o = other(t, p)
		local money = t.Offers[o].Money
		if money > 0 then
			S.Net.push(p, "cash", { amount = money, desc = "Intercambio con " .. nameOf(o) })
		end
		for _, r in ipairs(received[p]) do
			S.Market.registerCollectible(p, r.id)
		end
		S.Quest.check(p)
		S.Data.markDirty(p)
	end
	return true, received
end

local function summary(t, p)
	local o = other(t, p)
	local got, gave = #t.Offers[o].Items, #t.Offers[p].Items
	local txt = "recibiste " .. got .. (got == 1 and " objeto" or " objetos")
	if t.Offers[o].Money > 0 then
		txt = txt .. " y $" .. Util.formatInt(t.Offers[o].Money)
	end
	txt = txt .. "; diste " .. gave .. (gave == 1 and " objeto" or " objetos")
	if t.Offers[p].Money > 0 then
		txt = txt .. " y $" .. Util.formatInt(t.Offers[p].Money)
	end
	return txt
end

-- Comprobación periódica: solicitudes caducadas, jugadores que se van o se alejan
function Trade.tick(t)
	if byPlayer[t.A] ~= t and byPlayer[t.B] ~= t then
		return
	end
	if not online(t.A) or not online(t.B) then
		local gone = online(t.A) and t.B or t.A
		close(t, "cancelled", "🤝 Intercambio cancelado: " .. nameOf(gone) .. " se ha ido.")
	elseif t.Status == "pending" and os.time() - t.Created > MarketData.TradeRequestSeconds then
		close(t, "cancelled", "🤝 La solicitud de intercambio caducó.", "info")
	elseif dist(t.A, t.B) > MarketData.TradeLeaveRadius then
		close(t, "cancelled", "🤝 Intercambio cancelado: os habéis alejado demasiado.")
	end
end

local function openTrade(player)
	local t = byPlayer[player]
	if not t then
		return nil, "No tienes ningún intercambio en curso."
	end
	if t.Status ~= "open" then
		return nil, "El intercambio aún no ha sido aceptado."
	end
	return t
end

local function accept(t)
	t.Status = "open"
	S.Net.notify(t.A, "🤝 " .. nameOf(t.B) .. " aceptó el intercambio. Preparad vuestras ofertas.", "success")
	pushBoth(t)
	return true, "Intercambio con " .. nameOf(t.A) .. " abierto."
end

function Trade.Start()
	local Net = S.Net

	Net.on("Trade.Nearby", function(player)
		local list = {}
		for _, o in ipairs(Players:GetPlayers()) do
			if o ~= player and online(o) then
				local d = dist(player, o)
				if d <= MarketData.TradeRadius then
					list[#list + 1] = { userId = o.UserId, name = nameOf(o), busy = byPlayer[o] ~= nil, dist = math.floor(d + 0.5) }
				end
			end
		end
		table.sort(list, function(a, b)
			return a.dist < b.dist
		end)
		return true, nil, { players = list }
	end)

	Net.on("Trade.Request", function(player, p)
		local target = Players:GetPlayerByUserId(math.floor(tonumber(p.userId) or 0))
		if not target or not online(target) then
			return false, "Ese jugador no está disponible."
		end
		if target == player then
			return false, "No puedes intercambiar contigo mismo."
		end
		local mine = byPlayer[player]
		if mine then
			if mine.Status == "pending" and mine.B == player and mine.A == target then
				return accept(mine)
			end
			return false, "Ya tienes un intercambio en curso. Termínalo o cancélalo primero."
		end
		if byPlayer[target] then
			return false, nameOf(target) .. " ya está en otro intercambio."
		end
		if dist(player, target) > MarketData.TradeRadius then
			return false, "Acércate a " .. nameOf(target) .. " (máximo " .. MarketData.TradeRadius .. " studs) para proponer un intercambio."
		end
		if lastRequest[player] and os.clock() - lastRequest[player] < 2 then
			return false, "Espera un momento antes de enviar otra solicitud."
		end
		lastRequest[player] = os.clock()
		nextId = nextId + 1
		local t = {
			Id = nextId,
			A = player,
			B = target,
			Status = "pending",
			Created = os.time(),
			Version = 1,
			Offers = { [player] = { Items = {}, Money = 0 }, [target] = { Items = {}, Money = 0 } },
			Confirmed = {},
		}
		byPlayer[player] = t
		byPlayer[target] = t
		S.Net.notify(target, "🤝 " .. nameOf(player) .. " quiere intercambiar contigo. Abre la app Intercambio para aceptar.", "info")
		pushBoth(t)
		return true, "Solicitud de intercambio enviada a " .. nameOf(target) .. "."
	end)

	Net.on("Trade.Accept", function(player)
		local t = byPlayer[player]
		if not t or t.Status ~= "pending" or t.B ~= player then
			return false, "No tienes ninguna solicitud de intercambio pendiente."
		end
		if not online(t.A) then
			close(t, "cancelled", "🤝 Intercambio cancelado: " .. nameOf(t.A) .. " se ha ido.")
			return false, "Esa persona ya no está."
		end
		if dist(player, t.A) > MarketData.TradeLeaveRadius then
			return false, "Acércate a " .. nameOf(t.A) .. " para aceptar."
		end
		return accept(t)
	end)

	Net.on("Trade.Cancel", function(player)
		local t = byPlayer[player]
		if not t then
			return false, "No tienes ningún intercambio en curso."
		end
		local declined = t.Status == "pending" and t.B == player
		close(t, "cancelled", "🤝 " .. nameOf(player) .. (declined and " rechazó" or " canceló") .. " el intercambio. No se ha transferido nada.", "info")
		return true
	end)

	Net.on("Trade.AddItem", function(player, p)
		local t, err = openTrade(player)
		if not t then
			return false, err
		end
		local offer = t.Offers[player]
		if type(p.uid) ~= "string" then
			return false, "Objeto no válido."
		end
		if Util.indexOf(offer.Items, p.uid) then
			return false, "Ya está en tu oferta."
		end
		if #offer.Items >= MarketData.TradeMaxItems then
			return false, "Máximo " .. MarketData.TradeMaxItems .. " objetos por oferta."
		end
		local leaving = { [p.uid] = true }
		for _, uid in ipairs(offer.Items) do
			leaving[uid] = true
		end
		local lock = S.Market.lockReason(player, p.uid, { leaving = leaving })
		if lock then
			return false, lock
		end
		table.insert(offer.Items, p.uid)
		changed(t, player)
		local rec = S.Data.get(player).Inventory[p.uid]
		return true, Catalog.get(rec.Id).Name .. " añadido a tu oferta."
	end)

	Net.on("Trade.RemoveItem", function(player, p)
		local t, err = openTrade(player)
		if not t then
			return false, err
		end
		local offer = t.Offers[player]
		local i = Util.indexOf(offer.Items, p.uid)
		if not i then
			return false, "Ese objeto no está en tu oferta."
		end
		table.remove(offer.Items, i)
		changed(t, player)
		return true, "Objeto quitado de tu oferta."
	end)

	Net.on("Trade.SetMoney", function(player, p)
		local t, err = openTrade(player)
		if not t then
			return false, err
		end
		local amount = tonumber(p.amount)
		if not amount or amount ~= amount or amount < 0 or amount > MarketData.TradeMaxMoney then
			return false, "Cantidad no válida."
		end
		amount = math.floor(amount)
		local data = S.Data.get(player)
		if amount > data.Money then
			return false, "Solo tienes $" .. Util.formatInt(data.Money) .. "."
		end
		local offer = t.Offers[player]
		if offer.Money == amount then
			return true, "Tu oferta ya incluye $" .. Util.formatInt(amount) .. "."
		end
		offer.Money = amount
		changed(t, player)
		return true, "Ofreces $" .. Util.formatInt(amount) .. "."
	end)

	Net.on("Trade.Confirm", function(player, p)
		local t, err = openTrade(player)
		if not t then
			return false, err
		end
		if tonumber(p.version) ~= t.Version then
			return false, "Las ofertas han cambiado: revísalas antes de confirmar."
		end
		local o = other(t, player)
		if #t.Offers[player].Items == 0 and #t.Offers[o].Items == 0 and t.Offers[player].Money == 0 and t.Offers[o].Money == 0 then
			return false, "No hay nada que intercambiar todavía."
		end
		local own = validateOffer(t, player)
		if own then
			return false, "Tu oferta no es válida: " .. own
		end
		t.Confirmed[player] = true
		if not t.Confirmed[o] then
			S.Net.notify(o, "🤝 " .. nameOf(player) .. " confirmó el intercambio. Revisa y confirma tú también.", "info")
			pushBoth(t)
			return true, "Has confirmado. Esperando a " .. nameOf(o) .. "."
		end
		local done, res = execute(t)
		if not done then
			-- No se ha movido nada: se quitan de las ofertas los objetos que ya no son válidos y hay que volver a confirmar
			prune(t)
			t.Version = t.Version + 1
			t.Confirmed = {}
			local msg = "⚠ El intercambio no se pudo completar: " .. tostring(res) .. " No se ha transferido nada; revisad las ofertas."
			S.Net.notify(o, msg, "error")
			pushBoth(t)
			return false, msg
		end
		local msgA = "🤝 Intercambio completado con " .. nameOf(o) .. ": " .. summary(t, player) .. "."
		local msgB = "🤝 Intercambio completado con " .. nameOf(player) .. ": " .. summary(t, o) .. "."
		t.Status = "done"
		byPlayer[player], byPlayer[o] = nil, nil
		lastResult[player] = { Status = "done", Msg = msgA }
		lastResult[o] = { Status = "done", Msg = msgB }
		S.Net.notify(o, msgB, "success")
		pushState(player)
		pushState(o)
		return true, msgA, { received = res[player] }
	end)

	Players.PlayerRemoving:Connect(function(player)
		local t = byPlayer[player]
		if t then
			close(t, "cancelled", "🤝 Intercambio cancelado: " .. nameOf(player) .. " salió del juego.")
		end
		lastSeq[player], lastResult[player], lastRequest[player] = nil, nil, nil
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			local list, seen = {}, {}
			for _, t in pairs(byPlayer) do
				if not seen[t] then
					seen[t] = true
					list[#list + 1] = t
				end
			end
			for _, t in ipairs(list) do
				local ok, err = pcall(Trade.tick, t)
				if not ok then
					S.Net.logError("trade tick", err)
				end
			end
		end
	end)
end

return Trade
