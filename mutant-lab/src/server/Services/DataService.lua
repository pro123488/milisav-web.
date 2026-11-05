--!nonstrict
-- DataService: guardado seguro con DataStore.
--  * UpdateAsync con bloqueo de sesión (evita que dos servidores escriban el mismo perfil).
--  * Reintentos limitados; si la carga falla NUNCA se sobrescribe: en un servidor real se expulsa con un
--    mensaje claro y en Studio se usa un perfil temporal que no se guarda.
--  * Autoguardado, guardado al salir y en BindToClose.

local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Util = require(ReplicatedStorage.Shared.Util)

local Data = {}
local S
local profiles = {} -- [player] = { data, temp, dirty }
local store

Data.Template = {
	Version = 1,
	Credits = Config.StartingCredits,
	Lab = { Tier = 1, Slots = {}, Tank = 0, Traps = 0, Alarm = false, Drone = false, Fusion = nil },
	Research = {},
	Index = {},
	Stats = { Bought = 0, Stolen = 0, Lost = 0, Recovered = 0, Fusions = 0, Earned = 0, Sold = 0 },
	Receipts = {},
	Daily = {},
	NextUid = 1,
}

function Data.Init(services)
	S = services
	local ok, ds = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	store = ok and ds or nil
end

local function key(player)
	return "u_" .. tostring(player.UserId)
end

local function tryLoad(player)
	local result, locked
	local ok, err = pcall(function()
		store:UpdateAsync(key(player), function(old)
			old = old or Util.deepCopy(Data.Template)
			local lock = old.__lock
			if lock and lock.job ~= game.JobId and os.time() - (lock.t or 0) < Config.SessionLockTimeout then
				locked = true
				result = nil
				return nil -- no escribir nada
			end
			old.__lock = { job = game.JobId, t = os.time() }
			result = old
			return old
		end)
	end)
	if not ok then
		return nil, "error", err
	end
	if locked then
		return nil, "locked"
	end
	return result
end

function Data.load(player)
	local data, why, err
	if store then
		for attempt = 1, Config.LoadRetries do
			data, why, err = tryLoad(player)
			if data or why == "locked" then
				break
			end
			task.wait(1.5 * attempt)
		end
	else
		why = "error"
	end
	local temp = false
	if not data then
		if RunService:IsStudio() then
			warn("[LabMutante] Studio: usando perfil temporal (activa 'Studio Access to API Services' para guardar). " .. tostring(err or why))
			data = Util.deepCopy(Data.Template)
			temp = true
		else
			warn("[LabMutante] [load] " .. tostring(why) .. " " .. tostring(err))
			player:Kick(why == "locked"
				and "Tu partida sigue abierta en otro servidor. Espera un momento y vuelve a entrar."
				or "No se pudieron cargar tus datos. Vuelve a entrar en unos segundos (tu progreso está a salvo).")
			return nil
		end
	end
	data.__lock = nil
	Util.reconcile(data, Data.Template)
	profiles[player] = { data = data, temp = temp, dirty = true }
	return data
end

function Data.get(player)
	local p = profiles[player]
	return p and p.data
end

function Data.markDirty(player)
	local p = profiles[player]
	if p then
		p.dirty = true
	end
end

function Data.nextUid(player)
	local d = Data.get(player)
	local id = tostring(player.UserId) .. "-" .. tostring(d.NextUid)
	d.NextUid = d.NextUid + 1
	return id
end

function Data.save(player, release)
	local p = profiles[player]
	if not p or p.temp or not store then
		return true
	end
	local copy = Util.deepCopy(p.data)
	local ok, err = pcall(function()
		store:UpdateAsync(key(player), function(old)
			if old and old.__lock and old.__lock.job ~= game.JobId and os.time() - (old.__lock.t or 0) < Config.SessionLockTimeout then
				return nil -- otro servidor tiene el perfil: no pisarlo
			end
			if not release then
				copy.__lock = { job = game.JobId, t = os.time() }
			end
			return copy
		end)
	end)
	if not ok then
		warn("[LabMutante] [save] " .. tostring(err))
	end
	return ok
end

function Data.release(player)
	Data.save(player, true)
	profiles[player] = nil
end

function Data.Start()
	task.spawn(function()
		while true do
			task.wait(Config.AutosaveInterval)
			for player in pairs(profiles) do
				Data.save(player, false)
			end
		end
	end)
	game:BindToClose(function()
		for player in pairs(profiles) do
			Data.save(player, true)
		end
	end)
end

return Data
