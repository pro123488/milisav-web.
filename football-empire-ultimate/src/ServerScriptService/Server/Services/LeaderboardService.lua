-- LeaderboardService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/LeaderboardService
--
-- CLASIFICACIONES MUNDIALES (entre todos los servidores) con OrderedDataStore:
--   * «goals»: total de goles en partidos en grupo · «trophies»: trofeos actuales.
--   * Se guardan datos del servidor (nunca valores enviados por el cliente).
--   * Se escribe como mucho una vez por minuto por jugador y al salir, para no gastar el cupo.
--   * Cada 2 minutos se lee el top 10 y se avisa a quien lo muestre (el tablón de la plaza).
-- Si DataStore no está disponible (Studio sin acceso a la API), el juego sigue y el tablón lo indica.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local DataService = require(script.Parent.DataService)

local LeaderboardService = {}

local WRITE_SECONDS = 60
local READ_SECONDS = 120
local TOP = 10

-- Clasificaciones: id -> almacén y valor que se guarda
local BOARDS = {
	{ id = "goals", store = "FEU_TopGoals_v1", value = function(data) return data.stats.arenaGoals end },
	{ id = "trophies", store = "FEU_TopTrophies_v1", value = function(data) return data.arena.trophies end },
}

local stores = {} -- [id] = OrderedDataStore | false
local lastWritten = {} -- [player] = { [id] = { value, time } }
local names = {} -- [userId] = nombre (caché)
local listeners = {}

local function getStore(board)
	if stores[board.id] == nil then
		local ok, result = pcall(function()
			return DataStoreService:GetOrderedDataStore(board.store)
		end)
		stores[board.id] = ok and result or false
	end
	return stores[board.id] or nil
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

-- Guarda los valores del jugador que han cambiado (force = sin esperar al minuto, p. ej. al salir).
function LeaderboardService.Submit(player, force)
	local data = DataService.Get(player)
	if not data or not DataService.IsSaveEnabled(player) then
		return
	end
	lastWritten[player] = lastWritten[player] or {}
	for _, board in ipairs(BOARDS) do
		local ordered = getStore(board)
		local value = board.value(data)
		local last = lastWritten[player][board.id]
		local changed = not last or last.value ~= value
		local due = force or not last or os.clock() - last.time >= WRITE_SECONDS
		if ordered and changed and due and (value > 0 or last) then
			lastWritten[player][board.id] = { value = value, time = os.clock() }
			local userId = player.UserId
			task.spawn(function()
				local ok, err = pcall(function()
					ordered:SetAsync(tostring(userId), value)
				end)
				if not ok then
					warn("[LeaderboardService] No se pudo guardar la clasificación ", board.id, ": ", err)
				end
			end)
		end
	end
end

-- Devuelve el top de una clasificación, o nil si no está disponible
local function read(board)
	local ordered = getStore(board)
	if not ordered then
		return nil
	end
	local ok, result = pcall(function()
		local pages = ordered:GetSortedAsync(false, TOP)
		return pages:GetCurrentPage()
	end)
	if not ok then
		return nil
	end
	local list = {}
	for _, entry in ipairs(result) do
		local userId = tonumber(entry.key)
		if userId and entry.value > 0 then
			table.insert(list, { name = nameOf(userId), value = entry.value })
		end
	end
	return list
end

-- callback(idClasificación, lista { name, value }, disponible)
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
			for _, board in ipairs(BOARDS) do
				local list = read(board)
				for _, callback in ipairs(listeners) do
					task.spawn(callback, board.id, list or {}, list ~= nil)
				end
			end
			task.wait(READ_SECONDS)
		end
	end)
end

return LeaderboardService
