-- LeaderboardService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/LeaderboardService
--
-- CLASIFICACIÓN MUNDIAL DE GOLEADORES (entre todos los servidores) con OrderedDataStore.
--   * Se guarda el total de goles en partidos en grupo de cada jugador (dato del servidor).
--   * Se escribe como mucho una vez por minuto por jugador y al salir, para no gastar el cupo.
--   * Cada 2 minutos se lee el top 10 y se avisa a quien lo muestre (el tablón de la plaza).
-- Si DataStore no está disponible (Studio sin acceso a la API), el juego sigue y el tablón lo indica.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local DataService = require(script.Parent.DataService)

local LeaderboardService = {}

local STORE_NAME = "FEU_TopGoals_v1"
local WRITE_SECONDS = 60
local READ_SECONDS = 120
local TOP = 10

local store
local lastWritten = {} -- [player] = { value, time }
local names = {} -- [userId] = nombre (caché)
local listeners = {}
local top, available = {}, false

local function getStore()
	if store == nil then
		local ok, result = pcall(function()
			return DataStoreService:GetOrderedDataStore(STORE_NAME)
		end)
		store = ok and result or false
	end
	return store or nil
end

local function nameOf(userId)
	if names[userId] then
		return names[userId]
	end
	local player = Players:GetPlayerByUserId(userId)
	if player then
		names[userId] = player.Name
		return player.Name
	end
	local ok, result = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	names[userId] = ok and result or ("Jugador " .. userId)
	return names[userId]
end

-- Guarda los goles del jugador si han cambiado (force = sin esperar al minuto, p. ej. al salir).
function LeaderboardService.Submit(player, force)
	local data = DataService.Get(player)
	local ordered = getStore()
	if not data or not ordered or not DataService.IsSaveEnabled(player) then
		return
	end
	local value = data.stats.arenaGoals
	local last = lastWritten[player]
	if value <= 0 or (last and last.value == value) then
		return
	end
	if not force and last and os.clock() - last.time < WRITE_SECONDS then
		return
	end
	lastWritten[player] = { value = value, time = os.clock() }
	local userId = player.UserId
	task.spawn(function()
		local ok, err = pcall(function()
			ordered:SetAsync(tostring(userId), value)
		end)
		if not ok then
			warn("[LeaderboardService] No se pudo guardar la clasificación: ", err)
		end
	end)
end

local function refresh()
	local ordered = getStore()
	if not ordered then
		available = false
		return
	end
	local ok, result = pcall(function()
		local pages = ordered:GetSortedAsync(false, TOP)
		return pages:GetCurrentPage()
	end)
	if not ok then
		available = false
		return
	end
	local list = {}
	for _, entry in ipairs(result) do
		local userId = tonumber(entry.key)
		if userId then
			table.insert(list, { name = nameOf(userId), value = entry.value })
		end
	end
	top, available = list, true
end

-- callback(lista { name, value }, disponible)
function LeaderboardService.OnUpdate(callback)
	table.insert(listeners, callback)
end

function LeaderboardService.PlayerRemoving(player)
	LeaderboardService.Submit(player, true)
	lastWritten[player] = nil
end

function LeaderboardService.Start()
	task.spawn(function()
		while true do
			refresh()
			for _, callback in ipairs(listeners) do
				task.spawn(callback, top, available)
			end
			task.wait(READ_SECONDS)
		end
	end)
end

return LeaderboardService
