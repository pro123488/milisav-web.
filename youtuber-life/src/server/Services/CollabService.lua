--!nonstrict
-- CollabService: colaboraciones entre jugadores en proyectos de vídeo.
--  * El dueño invita a un jugador cercano (≤ 25 studs) a UNO de sus proyectos, con reparto (0-50 % para el invitado)
--    y permisos: grabar (escenas en el proyecto del dueño estando a ≤ 40 studs de él) y editar (mover/quitar clips).
--    Publicar es SIEMPRE exclusivo del dueño. La invitación caduca a los 60 s.
--  * Las colaboraciones viven solo en la sesión: se cancelan si uno sale del juego. Nunca se transfieren objetos ni
--    proyectos; el dueño conserva el proyecto (y las escenas grabadas por el invitado, marcadas con By = userId).
--  * Al publicar, el vídeo guarda Collab = { userId, name, share } y, si el invitado grabó al menos una escena,
--    gana +10 % de visitas esperadas y +15 % de conversión a suscriptores. ChannelService paga la parte del
--    colaborador (sacada de lo que genera ese vídeo, nunca más) solo mientras ambos están conectados.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)

local Collab = {}
local S

Collab.InviteRadius = 25
Collab.RecordRadius = 40
Collab.InviteSeconds = 60
Collab.MaxShare = 50
Collab.MaxActive = 3
Collab.ViewBonus = 1.10
Collab.SubBonus = 1.15
Collab.LogMax = 30

local invites = {} -- [id] = { Id, From, To, Pid, Share, Perms, Created }
local active = {} -- [id] = { Id, Owner, Guest, Pid, Share, Perms, Started }
local lastInvite = {}
local nextId = 0

function Collab.Init(services)
	S = services
end

local function nameOf(p)
	return p.DisplayName or p.Name
end

local function online(p)
	return p ~= nil and p.Parent ~= nil and S.Data.get(p) ~= nil
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

local function byUserId(id)
	for _, p in ipairs(Players:GetPlayers()) do
		if p.UserId == id and S.Data.get(p) then
			return p
		end
	end
end

local function projectOf(owner, pid)
	local data = online(owner) and S.Data.get(owner)
	return data and type(pid) == "string" and data.Projects[pid] or nil
end

local function permsText(perms)
	return (perms.record and "grabar" or "") .. (perms.record and perms.edit and " y " or "") .. (perms.edit and "editar" or "")
end

local function dirty(...)
	for _, p in ipairs({ ... }) do
		if online(p) then
			S.Data.markDirty(p)
		end
	end
end

local function countFor(player)
	local n = 0
	for _, c in pairs(active) do
		if c.Owner == player or c.Guest == player then
			n = n + 1
		end
	end
	return n
end

local function findActive(ownerUserId, pid)
	for _, c in pairs(active) do
		if c.Owner.UserId == ownerUserId and c.Pid == pid then
			return c
		end
	end
end

function Collab.get(id)
	return active[tonumber(id) or -1]
end

local function endCollab(c, msgOwner, msgGuest, style)
	if active[c.Id] ~= c then
		return
	end
	active[c.Id] = nil
	if msgOwner and online(c.Owner) then
		S.Net.notify(c.Owner, msgOwner, style or "warn")
	end
	if msgGuest and online(c.Guest) then
		S.Net.notify(c.Guest, msgGuest, style or "warn")
	end
	dirty(c.Owner, c.Guest)
end

local function dropInvite(inv, msgFrom, msgTo, style)
	if invites[inv.Id] ~= inv then
		return
	end
	invites[inv.Id] = nil
	if msgFrom and online(inv.From) then
		S.Net.notify(inv.From, msgFrom, style or "info")
	end
	if msgTo and online(inv.To) then
		S.Net.notify(inv.To, msgTo, style or "info")
	end
	dirty(inv.From, inv.To)
end

local function expired(inv)
	return os.time() - inv.Created > Collab.InviteSeconds
end

---------------------------------------------------------------------------
-- Vista para el cliente (Derived.Collab)
---------------------------------------------------------------------------
function Collab.view(player)
	local v = {
		Incoming = {},
		Outgoing = {},
		Active = {},
		InviteRadius = Collab.InviteRadius,
		RecordRadius = Collab.RecordRadius,
		MaxShare = Collab.MaxShare,
		InviteSeconds = Collab.InviteSeconds,
	}
	local now = os.time()
	for _, inv in pairs(invites) do
		if inv.To == player or inv.From == player then
			local proj = projectOf(inv.From, inv.Pid)
			local cat = proj and VideoData.CategoryById[proj.Category]
			local e = {
				Id = inv.Id,
				Pid = inv.Pid,
				Project = proj and proj.Name or "?",
				Category = cat and cat.Name or "",
				Share = inv.Share,
				Perms = { record = inv.Perms.record, edit = inv.Perms.edit },
				Left = math.max(0, inv.Created + Collab.InviteSeconds - now),
			}
			if inv.To == player then
				e.From, e.FromId = nameOf(inv.From), inv.From.UserId
				table.insert(v.Incoming, e)
			else
				e.To, e.ToId = nameOf(inv.To), inv.To.UserId
				table.insert(v.Outgoing, e)
			end
		end
	end
	for _, c in pairs(active) do
		if c.Owner == player or c.Guest == player then
			local proj = projectOf(c.Owner, c.Pid)
			local isOwner = c.Owner == player
			local partner = isOwner and c.Guest or c.Owner
			local e = {
				Id = c.Id,
				Role = isOwner and "owner" or "guest",
				Partner = nameOf(partner),
				PartnerId = partner.UserId,
				OwnerId = c.Owner.UserId,
				Pid = c.Pid,
				Project = proj and proj.Name or "?",
				Status = proj and proj.Status or "",
				Share = c.Share,
				Perms = { record = c.Perms.record, edit = c.Perms.edit },
				CanEdit = isOwner or c.Perms.edit,
				Dist = math.floor(math.min(9999, dist(c.Owner, c.Guest)) + 0.5),
				Scenes = {},
				Timeline = {},
				Mine = 0,
				Theirs = 0,
			}
			if proj then
				local names = {}
				for _, sc in ipairs(proj.Scenes) do
					local by = sc.By or c.Owner.UserId
					local byName = by == c.Guest.UserId and nameOf(c.Guest) or nameOf(c.Owner)
					local shot = VideoData.ShotById[sc.Shot]
					local label = (shot and shot.Name or sc.Shot) .. " en " .. tostring(sc.SpotName)
					names[sc.Id] = label .. " (" .. byName .. ")"
					table.insert(e.Scenes, { Id = sc.Id, Name = label, Q = math.floor(sc.Q or 0), By = by, ByName = byName })
					if by == player.UserId then
						e.Mine = e.Mine + 1
					else
						e.Theirs = e.Theirs + 1
					end
				end
				for i, clip in ipairs(proj.Edit and proj.Edit.Timeline or {}) do
					table.insert(e.Timeline, { Index = i, Name = clip.k == "s" and (names[clip.id] or "Escena") or "📷 Foto" })
				end
			end
			table.insert(v.Active, e)
		end
	end
	local function byId(a, b)
		return a.Id < b.Id
	end
	table.sort(v.Incoming, byId)
	table.sort(v.Outgoing, byId)
	table.sort(v.Active, byId)
	return v
end

---------------------------------------------------------------------------
-- Ganchos para VideoService y ChannelService
---------------------------------------------------------------------------
-- ¿Puede `player` grabar ahora en el proyecto `pid` del jugador `ownerUserId`? → ok, error, proyecto, dueño
function Collab.canRecord(player, ownerUserId, pid)
	local c = findActive(tonumber(ownerUserId) or -1, pid)
	if not c or c.Guest ~= player then
		return false, "No colaboras en ese proyecto."
	end
	local proj = projectOf(c.Owner, pid)
	if not proj then
		return false, "Ese proyecto ya no existe."
	end
	if not c.Perms.record then
		return false, "El dueño no te ha dado permiso para grabar en «" .. proj.Name .. "»."
	end
	if dist(player, c.Owner) > Collab.RecordRadius then
		return false, "Tienes que estar cerca de " .. nameOf(c.Owner) .. " (máximo " .. Collab.RecordRadius .. " studs) para grabar en su proyecto."
	end
	return true, nil, proj, c.Owner
end

-- Escena grabada por el invitado en el proyecto del dueño
function Collab.onScene(guest, owner, proj, scene)
	S.Net.notify(owner, "🤜 " .. nameOf(guest) .. " grabó «" .. tostring(scene.SpotName) .. "» para «" .. proj.Name .. "».", "info")
	dirty(owner)
end

-- Datos de colaboración que guardará el vídeo al publicar (o nil si no hay colaborador activo)
function Collab.forPublish(player, pid, proj)
	local c = findActive(player.UserId, pid)
	if not c or c.Owner ~= player or not online(c.Guest) then
		return nil
	end
	local scenes = 0
	for _, sc in ipairs(proj.Scenes) do
		if sc.By == c.Guest.UserId then
			scenes = scenes + 1
		end
	end
	return { userId = c.Guest.UserId, name = nameOf(c.Guest), share = c.Share, bonus = scenes > 0, scenes = scenes, paid = 0 }
end

local function addLog(data, entry)
	data.CollabLog = data.CollabLog or {}
	table.insert(data.CollabLog, 1, entry)
	while #data.CollabLog > Collab.LogMax do
		table.remove(data.CollabLog)
	end
end

local function bumpLog(data, vid, withId, amount)
	for _, e in ipairs(data.CollabLog or {}) do
		if e.Vid == vid and e.WithId == withId then
			e.Amount = (e.Amount or 0) + amount
			return
		end
	end
end

-- El dueño publicó el proyecto: termina la colaboración y queda en el historial de ambos
function Collab.onPublished(owner, pid, video)
	local c = findActive(owner.UserId, pid)
	if not c then
		return
	end
	active[c.Id] = nil
	local info = video.Collab
	local od, gd = S.Data.get(owner), S.Data.get(c.Guest)
	local base = { Vid = video.Id, Title = video.Title, Share = c.Share, Amount = 0, At = os.time(), Bonus = info and info.bonus or false }
	if od then
		local e = Util.deepCopy(base)
		e.Role, e.With, e.WithId = "owner", nameOf(c.Guest), c.Guest.UserId
		addLog(od, e)
		od.Counters.collabs = (od.Counters.collabs or 0) + 1
	end
	if gd then
		local e = Util.deepCopy(base)
		e.Role, e.With, e.WithId = "guest", nameOf(owner), owner.UserId
		addLog(gd, e)
		gd.Counters.collabs = (gd.Counters.collabs or 0) + 1
		S.Net.notify(c.Guest, "🎉 " .. nameOf(owner) .. " publicó «" .. video.Title .. "», vuestro vídeo colaborativo"
			.. (c.Share > 0 and (". Cobrarás el " .. c.Share .. " % de sus ingresos mientras los dos estéis conectados.") or "."), "success")
		S.Quest.check(c.Guest)
	end
	dirty(owner, c.Guest)
end

-- Reparto en el tick de ingresos: devuelve la parte de `rev` que corresponde al colaborador (0 si no está conectado)
function Collab.payShare(owner, v, rev)
	local info = v.Collab
	if not info or (tonumber(info.share) or 0) <= 0 or rev <= 0 then
		return 0
	end
	local guest = byUserId(info.userId)
	if not guest or guest == owner or not online(owner) then
		return 0
	end
	local part = math.min(rev, rev * Util.clamp(info.share, 0, Collab.MaxShare) / 100)
	info.pend = (info.pend or 0) + part
	if info.pend >= 1 then
		local pay = math.floor(info.pend)
		info.pend = info.pend - pay
		info.paid = (info.paid or 0) + pay
		local od, gd = S.Data.get(owner), S.Data.get(guest)
		S.Economy.add(guest, pay, "Colaboraciones", "Parte de «" .. tostring(v.Title) .. "» (colab con " .. nameOf(owner) .. ")", { taxable = true, silent = pay < 5 })
		gd.Counters.collab_earned = (gd.Counters.collab_earned or 0) + pay
		od.Counters.collab_paid = (od.Counters.collab_paid or 0) + pay
		bumpLog(gd, v.Id, owner.UserId, pay)
		bumpLog(od, v.Id, guest.UserId, pay)
		dirty(owner, guest)
	end
	return part
end

---------------------------------------------------------------------------
-- Comprobación periódica: invitaciones caducadas, jugadores que se van, proyectos borrados
---------------------------------------------------------------------------
function Collab.tick()
	for _, inv in pairs(invites) do
		if not online(inv.From) or not online(inv.To) then
			dropInvite(inv, "🤜 La invitación a colaborar se canceló: el otro jugador se ha ido.", "🤜 La invitación a colaborar se canceló: el otro jugador se ha ido.")
		elseif expired(inv) then
			dropInvite(inv, "🤜 " .. nameOf(inv.To) .. " no respondió: la invitación caducó.", "🤜 La invitación de " .. nameOf(inv.From) .. " caducó.")
		elseif not projectOf(inv.From, inv.Pid) then
			dropInvite(inv, nil, "🤜 La invitación de " .. nameOf(inv.From) .. " se canceló: el proyecto ya no existe.")
		end
	end
	for _, c in pairs(active) do
		if not online(c.Owner) or not online(c.Guest) then
			endCollab(c, "🤜 Colaboración terminada: " .. nameOf(c.Guest) .. " se ha ido.", "🤜 Colaboración terminada: " .. nameOf(c.Owner) .. " se ha ido.")
		elseif not projectOf(c.Owner, c.Pid) then
			endCollab(c, nil, "🤜 Colaboración terminada: " .. nameOf(c.Owner) .. " borró el proyecto.")
		end
	end
end

local function ownedCollab(player, id)
	local c = Collab.get(id)
	if not c or c.Owner ~= player then
		return nil, "No eres el dueño de esa colaboración."
	end
	return c
end

local function readPerms(p)
	return { record = p.record == true, edit = p.edit == true }
end

function Collab.Start()
	local Net = S.Net

	Net.on("Collab.Nearby", function(player)
		local list = {}
		for _, o in ipairs(Players:GetPlayers()) do
			if o ~= player and online(o) then
				local d = dist(player, o)
				if d <= Collab.InviteRadius then
					list[#list + 1] = { userId = o.UserId, name = nameOf(o), dist = math.floor(d + 0.5), busy = countFor(o) >= Collab.MaxActive }
				end
			end
		end
		table.sort(list, function(a, b)
			return a.dist < b.dist
		end)
		return true, nil, { players = list }
	end)

	Net.on("Collab.Invite", function(player, p)
		local data = S.Data.get(player)
		local target = byUserId(math.floor(tonumber(p.userId) or 0))
		if not target or not online(target) then
			return false, "Ese jugador no está disponible."
		end
		if target == player then
			return false, "No puedes colaborar contigo mismo."
		end
		local proj = type(p.pid) == "string" and data.Projects[p.pid] or nil
		if not proj then
			return false, "Elige uno de tus proyectos."
		end
		if p.publish == true then
			return false, "Publicar es siempre exclusivo del dueño: ese permiso no se puede dar."
		end
		local share = tonumber(p.share)
		if not share or share ~= share or share < 0 or share > Collab.MaxShare then
			return false, "El reparto para el colaborador debe estar entre 0 y " .. Collab.MaxShare .. " %."
		end
		share = math.floor(share)
		if findActive(player.UserId, p.pid) then
			return false, "Ese proyecto ya tiene colaborador."
		end
		for _, inv in pairs(invites) do
			if inv.From == player and inv.Pid == p.pid then
				return false, "Ya hay una invitación pendiente para ese proyecto."
			end
		end
		if countFor(player) >= Collab.MaxActive then
			return false, "Ya tienes " .. Collab.MaxActive .. " colaboraciones activas."
		end
		if countFor(target) >= Collab.MaxActive then
			return false, nameOf(target) .. " ya tiene demasiadas colaboraciones."
		end
		if dist(player, target) > Collab.InviteRadius then
			return false, "Acércate a " .. nameOf(target) .. " (máximo " .. Collab.InviteRadius .. " studs) para invitarle."
		end
		if lastInvite[player] and os.clock() - lastInvite[player] < 2 then
			return false, "Espera un momento antes de enviar otra invitación."
		end
		lastInvite[player] = os.clock()
		nextId = nextId + 1
		local perms = readPerms(p)
		local inv = { Id = nextId, From = player, To = target, Pid = p.pid, Share = share, Perms = perms, Created = os.time() }
		invites[inv.Id] = inv
		local pt = permsText(perms)
		S.Net.notify(target, "🤜 " .. nameOf(player) .. " te invita a colaborar en «" .. proj.Name .. "» (" .. share .. " % de los ingresos para ti"
			.. (pt ~= "" and (", puedes " .. pt) or "") .. "). Abre la app Colaborar.", "info")
		dirty(target)
		return true, "Invitación enviada a " .. nameOf(target) .. " (caduca en " .. Collab.InviteSeconds .. " s).", { id = inv.Id }
	end)

	Net.on("Collab.Respond", function(player, p)
		local inv = invites[tonumber(p.id) or -1]
		if not inv or inv.To ~= player then
			return false, "No tienes esa invitación."
		end
		if expired(inv) then
			dropInvite(inv, "🤜 La invitación a " .. nameOf(player) .. " caducó.", nil)
			return false, "La invitación ha caducado."
		end
		if not online(inv.From) then
			dropInvite(inv)
			return false, "Esa persona ya no está."
		end
		if p.accept ~= true then
			dropInvite(inv, "🤜 " .. nameOf(player) .. " rechazó colaborar contigo.", nil)
			return true, "Invitación rechazada."
		end
		local proj = projectOf(inv.From, inv.Pid)
		if not proj then
			dropInvite(inv)
			return false, "Ese proyecto ya no existe."
		end
		if findActive(inv.From.UserId, inv.Pid) then
			dropInvite(inv)
			return false, "Ese proyecto ya tiene colaborador."
		end
		if countFor(player) >= Collab.MaxActive or countFor(inv.From) >= Collab.MaxActive then
			return false, "Hay demasiadas colaboraciones activas."
		end
		invites[inv.Id] = nil
		nextId = nextId + 1
		local c = { Id = nextId, Owner = inv.From, Guest = player, Pid = inv.Pid, Share = inv.Share, Perms = inv.Perms, Started = os.time() }
		active[c.Id] = c
		S.Net.notify(c.Owner, "🤜 " .. nameOf(player) .. " aceptó colaborar en «" .. proj.Name .. "».", "success")
		dirty(c.Owner, player)
		return true, "¡Colaboras con " .. nameOf(c.Owner) .. " en «" .. proj.Name .. "»! Reparto: " .. c.Share .. " % para ti.", { id = c.Id }
	end)

	Net.on("Collab.CancelInvite", function(player, p)
		local inv = invites[tonumber(p.id) or -1]
		if not inv or inv.From ~= player then
			return false, "No tienes esa invitación."
		end
		dropInvite(inv, nil, "🤜 " .. nameOf(player) .. " retiró su invitación.")
		return true, "Invitación retirada."
	end)

	Net.on("Collab.SetPerms", function(player, p)
		local c, err = ownedCollab(player, p.id)
		if not c then
			return false, err
		end
		if p.publish == true then
			return false, "Publicar es siempre exclusivo del dueño."
		end
		c.Perms = readPerms(p)
		local pt = permsText(c.Perms)
		S.Net.notify(c.Guest, "🤜 " .. nameOf(player) .. " cambió tus permisos: " .. (pt ~= "" and ("puedes " .. pt) or "solo mirar") .. ".", "info")
		dirty(c.Guest)
		return true, "Permisos de " .. nameOf(c.Guest) .. " actualizados."
	end)

	Net.on("Collab.Kick", function(player, p)
		local c, err = ownedCollab(player, p.id)
		if not c then
			return false, err
		end
		endCollab(c, nil, "🤜 " .. nameOf(player) .. " terminó la colaboración contigo. Tus escenas se quedan en su proyecto.")
		return true, nameOf(c.Guest) .. " ya no colabora en el proyecto."
	end)

	Net.on("Collab.Leave", function(player, p)
		local c = Collab.get(p.id)
		if not c or c.Guest ~= player then
			return false, "No colaboras en ese proyecto."
		end
		endCollab(c, "🤜 " .. nameOf(player) .. " dejó la colaboración.", nil)
		return true, "Has salido de la colaboración."
	end)

	-- Mover/quitar clips de la línea de tiempo del proyecto del dueño (permiso de edición)
	Net.on("Collab.EditClip", function(player, p)
		local c = Collab.get(p.id)
		if not c or (c.Guest ~= player and c.Owner ~= player) then
			return false, "No colaboras en ese proyecto."
		end
		if c.Guest == player and not c.Perms.edit then
			return false, "El dueño no te ha dado permiso para editar."
		end
		local proj = projectOf(c.Owner, c.Pid)
		if not proj then
			return false, "Ese proyecto ya no existe."
		end
		local tl = proj.Edit and proj.Edit.Timeline
		local i = math.floor(tonumber(p.index) or 0)
		if not tl or i < 1 or i > #tl then
			return false, "Clip no válido."
		end
		local msg
		if p.op == "up" or p.op == "down" then
			local j = p.op == "up" and i - 1 or i + 1
			if j < 1 or j > #tl then
				return false, "Ese clip no se puede mover más."
			end
			tl[i], tl[j] = tl[j], tl[i]
			msg = "Clip movido."
		elseif p.op == "remove" then
			table.remove(tl, i)
			msg = "Clip quitado de la línea de tiempo."
		else
			return false, "Acción no válida."
		end
		proj.Export = nil
		if c.Guest == player then
			S.Net.notify(c.Owner, "✂ " .. nameOf(player) .. " editó la línea de tiempo de «" .. proj.Name .. "» (hay que volver a exportar).", "info")
		end
		dirty(c.Owner, c.Guest)
		return true, msg
	end)

	Players.PlayerRemoving:Connect(function(player)
		for _, inv in pairs(invites) do
			if inv.From == player or inv.To == player then
				local o = inv.From == player and inv.To or inv.From
				invites[inv.Id] = nil
				if online(o) and o ~= player then
					S.Net.notify(o, "🤜 La invitación a colaborar se canceló: " .. nameOf(player) .. " salió del juego.", "info")
					S.Data.markDirty(o)
				end
			end
		end
		for _, c in pairs(active) do
			if c.Owner == player or c.Guest == player then
				local o = c.Owner == player and c.Guest or c.Owner
				active[c.Id] = nil
				if online(o) and o ~= player then
					S.Net.notify(o, "🤜 Colaboración cancelada: " .. nameOf(player) .. " salió del juego.", "warn")
					S.Data.markDirty(o)
				end
			end
		end
		lastInvite[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			local ok, err = pcall(Collab.tick)
			if not ok then
				S.Net.logError("collab tick", err)
			end
		end
	end)
end

return Collab
