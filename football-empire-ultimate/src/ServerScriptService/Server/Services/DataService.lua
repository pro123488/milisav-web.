-- DataService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/DataService
--
-- Guardado persistente con DataStoreService:
--   * UpdateAsync con BLOQUEO DE SESIÓN (evita que dos servidores pisen los datos).
--   * Reintentos controlados con espera exponencial.
--   * Validación/reparación de datos al cargar (DefaultData.Reconcile).
--   * Guardado periódico, al salir y al cerrar el servidor (BindToClose).
--   * Si DataStore no está disponible (p. ej. Studio sin "API Services"), el juego
--     sigue funcionando en MODO SIN GUARDADO y se avisa al jugador.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local Util = script.Parent.Parent.Util
local DefaultData = require(Util.DefaultData)
local Retry = require(Util.Retry)

local DataService = {}

local profiles = {} -- [player] = { data = table, saveEnabled = bool, lastSave = number }
local loadedCallbacks = {}
local store = nil
local storeAvailable = true

local LOCK_WAIT_SECONDS = 5
local LOCK_WAIT_ATTEMPTS = 6

local function jobId()
	-- En Studio el JobId está vacío: usamos un identificador fijo por sesión.
	if game.JobId == "" then
		return "studio-session"
	end
	return game.JobId
end

local function key(userId)
	return "club_" .. tostring(userId)
end

local function isAccessError(err)
	local msg = tostring(err)
	return msg:find("403") ~= nil
		or msg:find("API Services") ~= nil
		or msg:find("API access") ~= nil
		or msg:find("Studio") ~= nil
end

do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(GameConfig.DATASTORE_NAME)
	end)
	if ok then
		store = result
	else
		storeAvailable = false
		warn("[DataService] DataStore no disponible: ", result)
	end
end

-- Intenta cargar y bloquear los datos. Devuelve: estado ("ok" | "locked" | "error" | "noaccess"), datos
local function tryLoad(player)
	local status, loaded = "ok", nil
	local ok, err = Retry.Call(3, 1, function()
		store:UpdateAsync(key(player.UserId), function(stored)
			local now = os.time()
			if type(stored) == "table" and type(stored.lock) == "table"
				and stored.lock.jobId ~= jobId()
				and now - (tonumber(stored.lock.time) or 0) < GameConfig.SESSION_LOCK_SECONDS then
				status = "locked"
				return nil -- cancela la escritura
			end
			status = "ok"
			local data = (type(stored) == "table" and stored.data) or nil
			loaded = data
			return {
				data = data,
				lock = { jobId = jobId(), time = now },
			}
		end)
	end)
	if not ok then
		if isAccessError(err) then
			return "noaccess", nil
		end
		warn("[DataService] Error cargando datos de ", player.Name, ": ", err)
		return "error", nil
	end
	return status, loaded
end

function DataService.Load(player)
	local saveEnabled = storeAvailable
	local rawData = nil

	if storeAvailable then
		local status
		for _ = 1, LOCK_WAIT_ATTEMPTS do
			status, rawData = tryLoad(player)
			if status ~= "locked" then
				break
			end
			if not player.Parent then
				return nil
			end
			task.wait(LOCK_WAIT_SECONDS)
		end
		if status == "locked" then
			player:Kick("Tus datos siguen abiertos en otro servidor. Vuelve a entrar en un minuto.")
			return nil
		elseif status == "noaccess" then
			warn("[DataService] Sin acceso a DataStore (activa 'Enable Studio Access to API Services'). MODO SIN GUARDADO.")
			saveEnabled = false
		elseif status == "error" then
			-- No sobrescribimos datos que no hemos podido leer: sesión sin guardado.
			saveEnabled = false
		end
	end

	local data = DefaultData.Reconcile(rawData, player)
	profiles[player] = { data = data, saveEnabled = saveEnabled, lastSave = os.clock(), isNew = rawData == nil }

	if not player.Parent then
		-- Se fue mientras cargaba: liberamos el bloqueo que acabamos de tomar.
		DataService.Release(player)
		return nil
	end
	for _, callback in ipairs(loadedCallbacks) do
		task.spawn(callback, player, data)
	end
	return data
end

function DataService.Save(player, release)
	local profile = profiles[player]
	if not profile or not profile.saveEnabled then
		return false
	end
	profile.data.lastSave = os.time()
	local lostLock = false
	local ok, err = Retry.Call(3, 1, function()
		store:UpdateAsync(key(player.UserId), function(stored)
			if type(stored) == "table" and type(stored.lock) == "table" and stored.lock.jobId ~= jobId() then
				lostLock = true
				return nil -- otro servidor tiene la sesión: no sobrescribimos
			end
			return {
				data = profile.data,
				lock = (not release) and { jobId = jobId(), time = os.time() } or nil,
			}
		end)
	end)
	if not ok then
		warn("[DataService] Error guardando datos de ", player.Name, ": ", err)
		return false
	end
	if lostLock then
		warn("[DataService] Bloqueo de sesión perdido para ", player.Name, "; no se guardó.")
		profile.saveEnabled = false
		return false
	end
	profile.lastSave = os.clock()
	return true
end

function DataService.Get(player)
	local profile = profiles[player]
	return profile and profile.data or nil
end

function DataService.IsSaveEnabled(player)
	local profile = profiles[player]
	return profile ~= nil and profile.saveEnabled
end

function DataService.IsNew(player)
	local profile = profiles[player]
	return profile ~= nil and profile.isNew
end

function DataService.OnLoaded(callback)
	table.insert(loadedCallbacks, callback)
end

function DataService.Release(player)
	if profiles[player] then
		DataService.Save(player, true)
		profiles[player] = nil
	end
end

function DataService.Start()
	-- Guardado periódico
	task.spawn(function()
		while true do
			task.wait(GameConfig.AUTOSAVE_SECONDS)
			for player in pairs(profiles) do
				if player.Parent then
					task.spawn(DataService.Save, player, false)
				end
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for player in pairs(profiles) do
			pending += 1
			task.spawn(function()
				DataService.Save(player, true)
				pending -= 1
			end)
		end
		local start = os.clock()
		while pending > 0 and os.clock() - start < 25 do
			task.wait(0.2)
		end
		if RunService:IsStudio() then
			task.wait(1)
		end
	end)
end

return DataService
