-- NetworkService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/NetworkService
--
-- RED DE CLUBES (FASE 9):
--   * Invitaciones a partidos entre clubes conectados al mismo servidor (en directo).
--   * Retos contra la hoja PÚBLICA de cualquier club del universo (aunque esté en otro
--     servidor); el club retado recibe el aviso en su buzón la próxima vez que entra.
--   * Clasificación entre amigos, comparación de clubes e historial de enfrentamientos.
-- Solo se usan datos públicos de otros clubes (perfil y once titular), nunca su economía.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local NetworkConfig = require(Shared.Config.NetworkConfig)
local TacticsConfig = require(Shared.Config.TacticsConfig)
local FootballConfig = require(Shared.Config.FootballConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local ClubService = require(script.Parent.ClubService)
local MatchService = require(script.Parent.MatchService)
local UniverseService = require(script.Parent.UniverseService)

local NetworkService = {}

local notifyRemote = Remotes.Get("Notify")
local invites = {} -- [jugador invitado] = { from, expires }
local friendsCache = {} -- [player] = { time, list }
local inboxStore, rankStore
pcall(function()
	inboxStore = DataStoreService:GetDataStore(NetworkConfig.INBOX_STORE)
	rankStore = DataStoreService:GetOrderedDataStore(NetworkConfig.NETWORK_RANK_STORE)
end)

local function clubInfo(player, data)
	return { name = ClubService.DisplayName(data), short = ClubService.ShortName(data) }
end

local function countAvailable(data)
	local n = 0
	for _, p in ipairs(data.squad) do
		if (p.injury or 0) <= 0 and not (p.loan and p.loan.type == "out") then
			n += 1
		end
	end
	return n
end

-- ===== Hoja pública del equipo (se publica en el perfil del universo) =====

local function publicSheet(data, name, short)
	local sheet = MatchService.BuildUserSheet(data, name, short)
	local players = {}
	for i, p in ipairs(sheet.players) do
		local attrs = {}
		for id, v in pairs(p.attrs) do
			attrs[id] = math.floor(v + 0.5)
		end
		table.insert(players, { id = "u" .. i, name = p.name, pos = p.pos, slotPos = p.slotPos, attrs = attrs })
	end
	return { formation = sheet.formation, mentality = sheet.mentality, style = sheet.style, players = players }
end

local VALID_POS = { GK = true, DEF = true, MID = true, FWD = true }

-- Nunca se confía en una hoja leída de DataStore sin revisarla.
local function sanitizeSheet(sheet, name, short)
	if type(sheet) ~= "table" or type(sheet.players) ~= "table" or #sheet.players ~= 11 then
		return nil
	end
	local players = {}
	for i, p in ipairs(sheet.players) do
		if type(p) ~= "table" or type(p.name) ~= "string" or not VALID_POS[p.pos] or not VALID_POS[p.slotPos] or type(p.attrs) ~= "table" then
			return nil
		end
		local attrs = {}
		for _, attr in ipairs(FootballConfig.Attributes) do
			local v = tonumber(p.attrs[attr.id])
			if not v or v ~= v then
				return nil
			end
			attrs[attr.id] = math.clamp(v, 1, 99)
		end
		table.insert(players, { id = "r" .. i, name = p.name:sub(1, 40), pos = p.pos, slotPos = p.slotPos, attrs = attrs, fitness = 100 })
	end
	return {
		name = name, short = short,
		formation = TacticsConfig.Formation(sheet.formation).id,
		mentality = TacticsConfig.Mentality(sheet.mentality).id,
		style = TacticsConfig.Style(sheet.style).id,
		players = players,
	}
end

UniverseService.ExtendProfile(function(_, data, profile)
	profile.sheet = publicSheet(data, profile.clubName, profile.short)
	profile.strength = math.floor(MatchService.TeamStrength(data) + 0.5)
	profile.networkPoints = data.network.points
end)

-- ===== Historial de enfrentamientos =====

local function recordH2H(data, userId, name, gf, ga, kind)
	local key = tostring(userId)
	local h = data.network.h2h[key]
	if not h then
		h = { name = name, w = 0, d = 0, l = 0, gf = 0, ga = 0 }
		data.network.h2h[key] = h
	end
	h.name = name
	h.gf += gf
	h.ga += ga
	if gf > ga then
		h.w += 1
	elseif gf == ga then
		h.d += 1
	else
		h.l += 1
	end
	h.last = { gf = gf, ga = ga, t = os.time(), kind = kind }
	-- Límite: se olvida el rival más antiguo
	local count, oldestKey, oldestT = 0, nil, math.huge
	for k, v in pairs(data.network.h2h) do
		count += 1
		local t = v.last and v.last.t or 0
		if t < oldestT then
			oldestKey, oldestT = k, t
		end
	end
	if count > NetworkConfig.H2H_MAX_OPPONENTS and oldestKey then
		data.network.h2h[oldestKey] = nil
	end
end

local function addPoints(player, data, points)
	if points <= 0 then
		return
	end
	data.network.points += points
	if rankStore then
		task.spawn(pcall, function()
			rankStore:SetAsync(tostring(player.UserId), data.network.points)
		end)
	end
end

-- ===== Invitaciones (mismo servidor) =====

function NetworkService.Invite(player, payload)
	local data = DataService.Get(player)
	local target = Players:GetPlayerByUserId(tonumber(type(payload) == "table" and payload.userId) or 0)
	local targetData = target and DataService.Get(target)
	if not targetData or target == player then
		return false, "Ese club no está en este servidor."
	end
	local pending = invites[target]
	if pending and pending.expires > os.clock() then
		return false, "Ese club ya tiene una invitación pendiente."
	end
	if countAvailable(data) < 11 then
		return false, "No tienes 11 jugadores disponibles."
	end
	invites[target] = { from = player, expires = os.clock() + NetworkConfig.INVITE_SECONDS }
	local info = clubInfo(player, data)
	notifyRemote:FireClient(target, "invite", {
		fromUserId = player.UserId, fromName = player.DisplayName, clubName = info.name, short = info.short,
		strength = math.floor(MatchService.TeamStrength(data) + 0.5), seconds = NetworkConfig.INVITE_SECONDS,
	})
	return true, string.format("📨 Invitación enviada a %s. Tiene %d segundos para aceptar.", target.DisplayName, NetworkConfig.INVITE_SECONDS)
end

function NetworkService.RespondInvite(player, payload)
	local invite = invites[player]
	invites[player] = nil
	if not invite or invite.expires < os.clock() or not invite.from.Parent then
		return false, "La invitación ya no está disponible."
	end
	local inviter = invite.from
	if type(payload) ~= "table" or payload.accept ~= true then
		notifyRemote:FireClient(inviter, "info", player.DisplayName .. " ha rechazado tu invitación.")
		return true, "Invitación rechazada."
	end
	local homeData, awayData = DataService.Get(inviter), DataService.Get(player)
	if not homeData or not awayData then
		return false, "Uno de los clubes no está disponible."
	end
	local homeInfo, awayInfo = clubInfo(inviter, homeData), clubInfo(player, awayData)
	local result, err = MatchService.PlayUsers(inviter, player, "Amistoso entre clubes", homeInfo, awayInfo)
	if not result then
		return false, err
	end
	recordH2H(homeData, player.UserId, awayInfo.name, result.home.goals, result.away.goals, "amistoso")
	recordH2H(awayData, inviter.UserId, homeInfo.name, result.away.goals, result.home.goals, "amistoso")
	-- Cada cliente recibe el resumen con su lado marcado
	for side, p in ipairs({ inviter, player }) do
		local copy = table.clone(result)
		copy.userSide = side
		local us = side == 1 and result.home.goals or result.away.goals
		local them = side == 1 and result.away.goals or result.home.goals
		copy.outcome = us > them and "W" or (us == them and "D" or "L")
		notifyRemote:FireClient(p, "match", copy)
	end
	return true, string.format("⚽ %s %d - %d %s", homeInfo.short, result.home.goals, result.away.goals, awayInfo.short)
end

-- ===== Retos (cualquier club del universo) =====

local function today()
	return math.floor(os.time() / 86400)
end

function NetworkService.Challenge(player, payload)
	local data = DataService.Get(player)
	local userId = tonumber(type(payload) == "table" and payload.userId)
	if not userId or userId == player.UserId then
		return false, "Club no válido."
	end
	local c = data.network.challenges
	if c.day ~= today() then
		c.day, c.count, c.targets = today(), 0, {}
	end
	if c.count >= NetworkConfig.CHALLENGES_PER_DAY then
		return false, string.format("Ya has hecho tus %d retos de hoy.", NetworkConfig.CHALLENGES_PER_DAY)
	end
	if (c.targets[tostring(userId)] or 0) >= NetworkConfig.CHALLENGE_SAME_TARGET_PER_DAY then
		return false, "Ya has retado a ese club hoy."
	end
	if countAvailable(data) < 11 then
		return false, "No tienes 11 jugadores disponibles."
	end
	-- Perfil del rival: en directo si está en este servidor, si no el publicado en el universo
	local profile
	local live = Players:GetPlayerByUserId(userId)
	if live and DataService.Get(live) then
		profile = UniverseService.PublicProfile(live, DataService.Get(live))
	else
		profile = UniverseService.FetchProfile(userId)
	end
	local sheet = profile and sanitizeSheet(profile.sheet, profile.clubName, profile.short)
	if not sheet then
		return false, "Ese club todavía no ha publicado su once (o el universo no está disponible)."
	end
	c.count += 1
	c.targets[tostring(userId)] = (c.targets[tostring(userId)] or 0) + 1
	local info = clubInfo(player, data)
	local opponent = { name = profile.clubName, short = profile.short, strength = tonumber(profile.strength) or 50 }
	local result = MatchService.Play(player, opponent, {
		clubName = info.name, clubShort = info.short, home = true, competition = "Reto", noEconomy = true, opponentSheet = sheet,
	})
	local gf, ga = result.home.goals, result.away.goals
	recordH2H(data, userId, profile.clubName, gf, ga, "reto")
	local points = gf > ga and NetworkConfig.POINTS_WIN or (gf == ga and NetworkConfig.POINTS_DRAW or 0)
	addPoints(player, data, points)
	result.networkPoints = points
	-- Aviso al club retado (buzón), sin tocar sus datos guardados
	if inboxStore then
		task.spawn(pcall, function()
			inboxStore:UpdateAsync(tostring(userId), function(list)
				list = type(list) == "table" and list or {}
				table.insert(list, { t = os.time(), fromId = player.UserId, fromName = player.DisplayName, fromClub = info.name, gf = ga, ga = gf })
				while #list > NetworkConfig.INBOX_MAX do
					table.remove(list, 1)
				end
				return list
			end)
		end)
	end
	if live and live.Parent then
		notifyRemote:FireClient(live, "info", string.format("⚔️ %s ha retado a tu club: %s %d - %d %s.", info.name, info.short, gf, ga, profile.short))
	end
	return true, string.format("⚔️ Reto contra %s: %d - %d%s", profile.clubName, gf, ga, points > 0 and string.format(" (+%d puntos de red)", points) or ""), result
end

-- Avisos de retos recibidos mientras estabas desconectado.
function NetworkService.ProcessInbox(player)
	local data = DataService.Get(player)
	if not data or not inboxStore then
		return {}
	end
	local entries = {}
	local ok = pcall(function()
		inboxStore:UpdateAsync(tostring(player.UserId), function(list)
			entries = type(list) == "table" and list or {}
			return {}
		end)
	end)
	if not ok then
		return {}
	end
	local messages = {}
	for _, e in ipairs(entries) do
		if type(e) == "table" and tonumber(e.fromId) and tonumber(e.gf) and tonumber(e.ga) then
			recordH2H(data, e.fromId, tostring(e.fromClub), e.gf, e.ga, "reto recibido")
			table.insert(messages, string.format("⚔️ %s retó a tu club mientras no estabas: %d - %d para ti.", tostring(e.fromClub), e.gf, e.ga))
		end
	end
	return messages
end

-- ===== Amigos =====

function NetworkService.RefreshFriends(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local ids = {}
	pcall(function()
		local pages = Players:GetFriendsAsync(player.UserId)
		while #ids < NetworkConfig.MAX_FRIENDS_SHOWN do
			for _, friend in ipairs(pages:GetCurrentPage()) do
				if #ids < NetworkConfig.MAX_FRIENDS_SHOWN then
					table.insert(ids, friend.Id)
				end
			end
			if pages.IsFinished then
				break
			end
			pages:AdvanceToNextPageAsync()
		end
	end)
	local list = { UniverseService.PublicProfile(player, data) }
	list[1].isMe = true
	for _, id in ipairs(ids) do
		local live = Players:GetPlayerByUserId(id)
		local profile = (live and DataService.Get(live)) and UniverseService.PublicProfile(live, DataService.Get(live)) or UniverseService.FetchProfile(id)
		if profile then
			profile.inServer = live ~= nil
			table.insert(list, profile)
		end
	end
	for _, p in ipairs(list) do
		p.sheet = nil -- no hace falta en la interfaz
	end
	friendsCache[player] = { time = os.clock(), list = list }
end

-- ===== Comparar clubes =====

function NetworkService.Compare(player, payload)
	local data = DataService.Get(player)
	local userId = tonumber(type(payload) == "table" and payload.userId)
	if not userId then
		return false, "Club no válido."
	end
	local live = Players:GetPlayerByUserId(userId)
	local other = (live and DataService.Get(live)) and UniverseService.PublicProfile(live, DataService.Get(live)) or UniverseService.FetchProfile(userId)
	if not other then
		return false, "No se encontró el perfil público de ese club."
	end
	local me = UniverseService.PublicProfile(player, data)
	me.sheet, other.sheet = nil, nil
	return true, nil, { me = me, other = other, h2h = data.network.h2h[tostring(userId)] }
end

-- ===== Estado =====

function NetworkService.BuildState(player, data)
	local h2h = {}
	for userId, h in pairs(data.network.h2h) do
		table.insert(h2h, { userId = tonumber(userId), name = h.name, w = h.w, d = h.d, l = h.l, gf = h.gf, ga = h.ga, last = h.last })
	end
	table.sort(h2h, function(a, b)
		return (a.last and a.last.t or 0) > (b.last and b.last.t or 0)
	end)
	local c = data.network.challenges
	local used = c.day == today() and c.count or 0
	local cache = friendsCache[player]
	return {
		points = data.network.points,
		challengesLeft = NetworkConfig.CHALLENGES_PER_DAY - used,
		h2h = h2h,
		friends = cache and cache.list or nil,
		hasInvite = invites[player] ~= nil and invites[player].expires > os.clock(),
	}
end

function NetworkService.PlayerReady(player)
	task.spawn(function()
		NetworkService.RefreshFriends(player)
		for _, message in ipairs(NetworkService.ProcessInbox(player)) do
			notifyRemote:FireClient(player, "info", message)
		end
	end)
end

function NetworkService.PlayerRemoving(player)
	invites[player] = nil
	friendsCache[player] = nil
	for target, invite in pairs(invites) do
		if invite.from == player then
			invites[target] = nil
		end
	end
end

return NetworkService
