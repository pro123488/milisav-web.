-- UniverseService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/UniverseService
--
-- UNIVERSO FUTBOLÍSTICO (FASE 8), compartido entre todos los servidores:
--   * Perfil PÚBLICO de cada club (DataStore) — sin dinero, deuda ni datos privados.
--   * Rankings globales de reputación, valor y títulos (OrderedDataStore).
--   * Competición semanal entre usuarios (puntos por resultados) con recompensas.
--   * Directorio: clubes de este servidor (visitables) y clubes destacados del universo.
-- Nada de esto bloquea el juego: si Roblox no responde, se muestra "universo sin conexión"
-- y se reintenta más tarde. Las lecturas se cachean para respetar los límites de DataStore.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local UniverseConfig = require(Shared.Config.UniverseConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local StadiumStages = require(Shared.Config.StadiumStages)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)
local ClubService = require(script.Parent.ClubService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)
local Retry = require(script.Parent.Parent.Util.Retry)

local UniverseService = {}

local online = true -- se pone a false si DataStore no está disponible (p. ej. Studio sin API)
local lastOfflineAt = 0
local profileStore
local rankStores = {}
local rankingCache = {} -- [rankingId] = { time, entries }
local profileCache = {} -- [userId] = { time, profile }
local weeklyCache = { time = -math.huge, week = -1, entries = {} }
local lastPublish = {} -- [player] = os.clock()
local pendingWeekly = {} -- [player] = puntos sin enviar
local extraProfileFields = {} -- ampliaciones (FASE 9 añade la hoja del equipo)

local function markOffline(err)
	if online then
		warn("[UniverseService] Universo sin conexión: ", err)
	end
	online = false
	lastOfflineAt = os.clock()
end

local function canTry()
	if online then
		return true
	end
	if os.clock() - lastOfflineAt > UniverseConfig.PUBLISH_SECONDS then
		online = true -- reintento periódico
		return true
	end
	return false
end

do
	local ok, err = pcall(function()
		profileStore = DataStoreService:GetDataStore(UniverseConfig.PROFILE_STORE)
		for _, ranking in ipairs(UniverseConfig.RANKINGS) do
			rankStores[ranking.id] = DataStoreService:GetOrderedDataStore(ranking.store)
		end
	end)
	if not ok then
		markOffline(err)
	end
end

local function weeklyStore(week)
	return DataStoreService:GetOrderedDataStore(UniverseConfig.WEEKLY_STORE_PREFIX .. tostring(week))
end

local function colorHex(color)
	return string.format("#%02X%02X%02X", math.floor(color.R * 255 + 0.5), math.floor(color.G * 255 + 0.5), math.floor(color.B * 255 + 0.5))
end

-- Perfil público: lo que cualquier otro jugador puede ver del club.
function UniverseService.PublicProfile(player, data)
	local appearance = ClubService.EffectiveAppearance(player, data)
	local palette = CosmeticConfig.ById.palette[appearance.palette]
	local crest = CosmeticConfig.ById.crest[appearance.crest]
	local league = data.league or {}
	local profile = {
		userId = player.UserId,
		ownerName = player.DisplayName,
		clubName = ClubService.DisplayName(data),
		short = ClubService.ShortName(data),
		crest = crest and crest.symbol or "⚽",
		primary = colorHex(palette.primary),
		secondary = colorHex(palette.secondary),
		vip = ClubService.IsVip(player),
		reputation = EconomyFormulas.Reputation(data),
		value = EconomyFormulas.ClubValue(data),
		titles = #data.trophies,
		fans = data.club.fans,
		stage = data.stadium.stage,
		stageName = StadiumStages.Get(data.stadium.stage).name,
		division = league.division or 1,
		season = data.season.number,
		updated = os.time(),
	}
	for _, extend in ipairs(extraProfileFields) do
		extend(player, data, profile)
	end
	return profile
end

-- Permite a otros servicios añadir campos públicos al perfil (p. ej. la hoja de equipo en la FASE 9).
function UniverseService.ExtendProfile(fn)
	table.insert(extraProfileFields, fn)
end

function UniverseService.Publish(player, force)
	local data = DataService.Get(player)
	if not data or not canTry() then
		return false
	end
	if not force and lastPublish[player] and os.clock() - lastPublish[player] < UniverseConfig.PUBLISH_SECONDS then
		return false
	end
	lastPublish[player] = os.clock()
	local profile = UniverseService.PublicProfile(player, data)
	local key = tostring(player.UserId)
	local ok, err = Retry.Call(2, 1, function()
		profileStore:SetAsync(key, profile)
		rankStores.reputation:SetAsync(key, math.floor(profile.reputation))
		rankStores.value:SetAsync(key, math.floor(profile.value))
		rankStores.titles:SetAsync(key, profile.titles)
	end)
	if not ok then
		markOffline(err)
		return false
	end
	profileCache[player.UserId] = { time = os.clock(), profile = profile }
	return true
end

-- Puntos de la competición semanal (se agrupan y se envían cada minuto).
function UniverseService.AddWeeklyPoints(player, points)
	if points and points > 0 then
		pendingWeekly[player] = (pendingWeekly[player] or 0) + points
		local data = DataService.Get(player)
		if data then
			local week = UniverseConfig.WeekIndex()
			if data.universe.week ~= week then
				data.universe.week = week
				data.universe.weekPoints = 0
			end
			data.universe.weekPoints += points
		end
	end
end

local function flushWeekly()
	if not canTry() then
		return
	end
	local week = UniverseConfig.WeekIndex()
	for player, points in pairs(pendingWeekly) do
		pendingWeekly[player] = nil
		local ok, err = pcall(function()
			weeklyStore(week):IncrementAsync(tostring(player.UserId), points)
		end)
		if not ok then
			markOffline(err)
			pendingWeekly[player] = (pendingWeekly[player] or 0) + points
			return
		end
	end
end

local function fetchProfile(userId)
	local cached = profileCache[userId]
	if cached and os.clock() - cached.time < UniverseConfig.PROFILE_CACHE_SECONDS then
		return cached.profile
	end
	local ok, profile = pcall(function()
		return profileStore:GetAsync(tostring(userId))
	end)
	if not ok then
		markOffline(profile)
		return cached and cached.profile or nil
	end
	if type(profile) == "table" then
		profileCache[userId] = { time = os.clock(), profile = profile }
	end
	return type(profile) == "table" and profile or nil
end
UniverseService.FetchProfile = fetchProfile

local function readTop(store, size)
	local ok, pages = pcall(function()
		return store:GetSortedAsync(false, size)
	end)
	if not ok then
		markOffline(pages)
		return nil
	end
	local entries = {}
	for rank, item in ipairs(pages:GetCurrentPage()) do
		table.insert(entries, { rank = rank, userId = tonumber(item.key), value = item.value })
	end
	return entries
end

local function refreshCaches()
	if not canTry() then
		return
	end
	for _, ranking in ipairs(UniverseConfig.RANKINGS) do
		local entries = readTop(rankStores[ranking.id], UniverseConfig.RANKING_SIZE)
		if entries then
			for _, e in ipairs(entries) do
				local profile = e.userId and fetchProfile(e.userId)
				e.clubName = profile and profile.clubName or ("Club " .. tostring(e.userId))
				e.short = profile and profile.short or "???"
				e.crest = profile and profile.crest or "⚽"
				e.ownerName = profile and profile.ownerName or "?"
				e.division = profile and profile.division or nil
			end
			rankingCache[ranking.id] = { time = os.clock(), entries = entries }
		end
	end
	local week = UniverseConfig.WeekIndex()
	local weekly = readTop(weeklyStore(week), 10)
	if weekly then
		for _, e in ipairs(weekly) do
			local profile = e.userId and fetchProfile(e.userId)
			e.clubName = profile and profile.clubName or ("Club " .. tostring(e.userId))
			e.crest = profile and profile.crest or "⚽"
		end
		weeklyCache = { time = os.clock(), week = week, entries = weekly }
	end
end

-- Recompensa de la semana anterior (se comprueba al entrar).
function UniverseService.ClaimWeekly(player)
	local data = DataService.Get(player)
	if not data or not canTry() then
		return nil
	end
	local lastWeek = UniverseConfig.WeekIndex() - 1
	if (data.universe.claimedWeek or -1) >= lastWeek then
		return nil
	end
	local top = readTop(weeklyStore(lastWeek), 10)
	if not top then
		return nil -- se reintentará en la próxima sesión
	end
	data.universe.claimedWeek = lastWeek
	for _, e in ipairs(top) do
		if e.userId == player.UserId then
			local reward = UniverseConfig.WeeklyReward(e.rank)
			if reward then
				EconomyService.Earn(player, reward.money, EconomyService.Category.PRIZE, reward.label)
				data.club.reputationEarned += reward.reputation
				StadiumService.LogEvent(data, "weekly_reward", { rank = e.rank, week = lastWeek })
				return string.format("%s · puesto %d la semana pasada: +%d %s y +%d de reputación.", reward.label, e.rank,
					reward.money, GameConfig.CURRENCY, reward.reputation)
			end
		end
	end
	return nil
end

-- Visitar el estadio de otro club que esté en este servidor.
function UniverseService.Visit(player, payload, PlotService)
	local userId = tonumber(type(payload) == "table" and payload.userId)
	local target = userId and Players:GetPlayerByUserId(userId)
	if not target or target == player then
		return false, "Ese club no está en este servidor."
	end
	local plot = PlotService.GetPlot(target)
	local character = player.Character
	if not plot or not character then
		return false, "No se puede visitar ahora."
	end
	character:PivotTo(plot.origin * CFrame.new(0, 4, 92) * CFrame.Angles(0, math.pi, 0))
	return true, string.format("🏟️ Visitando el estadio de %s. Como visitante no puedes modificar nada.", target.DisplayName)
end

function UniverseService.BuildState(player, data)
	local event, eventLeft = UniverseConfig.CurrentEvent()
	local directory = {}
	for _, other in ipairs(Players:GetPlayers()) do
		local otherData = DataService.Get(other)
		if otherData then
			local profile = UniverseService.PublicProfile(other, otherData)
			profile.sheet = nil -- la hoja del equipo no hace falta en la interfaz
			profile.inServer = true
			profile.isMe = other == player
			table.insert(directory, profile)
		end
	end
	table.sort(directory, function(a, b)
		return a.reputation > b.reputation
	end)
	local rankings = {}
	for _, ranking in ipairs(UniverseConfig.RANKINGS) do
		rankings[ranking.id] = rankingCache[ranking.id] and rankingCache[ranking.id].entries or {}
	end
	local week = UniverseConfig.WeekIndex()
	return {
		online = online,
		event = { id = event.id, name = event.name, icon = event.icon, description = event.description, secondsLeft = eventLeft },
		rankings = rankings,
		weekly = {
			week = week,
			secondsLeft = UniverseConfig.WeekSecondsLeft(),
			top = weeklyCache.week == week and weeklyCache.entries or {},
			myPoints = data.universe.week == week and data.universe.weekPoints or 0,
		},
		directory = directory,
	}
end

function UniverseService.PlayerReady(player)
	task.spawn(function()
		UniverseService.Publish(player, true)
	end)
end

function UniverseService.PlayerRemoving(player)
	-- Último envío de puntos y perfil
	local points = pendingWeekly[player]
	pendingWeekly[player] = nil
	if points and canTry() then
		pcall(function()
			weeklyStore(UniverseConfig.WeekIndex()):IncrementAsync(tostring(player.UserId), points)
		end)
	end
	if DataService.Get(player) then
		UniverseService.Publish(player, true)
	end
	lastPublish[player] = nil
end

function UniverseService.Start()
	task.spawn(function()
		task.wait(5)
		refreshCaches()
		while true do
			task.wait(60)
			flushWeekly()
			for _, player in ipairs(Players:GetPlayers()) do
				task.spawn(UniverseService.Publish, player, false)
			end
			if os.clock() - (weeklyCache.time or 0) > UniverseConfig.RANKING_CACHE_SECONDS then
				refreshCaches()
			end
		end
	end)
end

return UniverseService
