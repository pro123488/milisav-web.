--!nonstrict
-- DataService: carga y guardado seguro con DataStoreService.
--  * Reintentos limitados con espera creciente.
--  * Bloqueo de sesión: si otro servidor tiene los datos abiertos, se espera en lugar de sobrescribir.
--  * Si la carga falla en un servidor real, NUNCA se guarda encima: el jugador es expulsado con un mensaje claro.
--  * En Studio sin acceso a API, se usa un perfil temporal que no se guarda (modo de prueba).
--  * Guardado automático, al salir y al cerrar el servidor.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Util = require(Shared.Util)

local DataService = {}
local S
local profiles = {}
local dirty = {}
local store = nil
local SCHEMA_VERSION = 1

DataService.Template = {
	Version = SCHEMA_VERSION,
	Money = Config.StartingMoney,
	LifetimeEarned = 0,
	XP = 0,
	Level = 1,
	Reputation = 10,
	BizRep = 50,
	Channel = { Name = "", Description = "", Banner = 1, Avatar = 1, Subs = 0, SubFrac = 0, TotalViews = 0, TotalRevenue = 0, Monetized = false },
	Inventory = {},
	Equipped = { Phone = "" },
	Rigs = {},
	ActiveRig = "",
	Orders = {},
	Processed = {},
	ProcessedOrder = {},
	Transactions = {},
	Monthly = {},
	Bank = { Savings = 0, Loan = 0, LoanRate = 0.1, Goals = {}, LastInterestDay = 0 },
	Projects = {},
	Photos = {},
	Albums = { "General", "Miniaturas", "Personal" },
	Thumbnails = {},
	Videos = {},
	Counters = {},
	Visited = { Districts = {}, Recorded = {}, Stores = {}, Categories = {}, Secrets = {}, Cameras = {}, Collectibles = {}, Destinations = {} },
	Trip = { At = "", Since = 0 },
	Quests = { Completed = {}, Claimed = {}, Step = 1, StepProgress = 0, Skipped = false },
	Titles = {},
	EquippedTitle = "",
	Home = { Type = "room_cheap", Rent = Config.StarterRent, PlayDays = 0, NextDue = Config.RentPeriodDays, Debt = 0, Missed = 0, Paid = 0 },
	Appearance = { Shirt = 5, Pants = 2, Chosen = false },
	Settings = { Music = 0.5, Sfx = 0.7, ReduceMotion = false, UIScale = 1, Wallpaper = 1, Hints = true, Shadows = true },
	Receipts = {},
	ReceiptOrder = {},
	ExportTokens = 0,
	Job = {},
	Properties = {},
	Vehicles = {},
	HomeProperty = "",
	Sponsors = { Offers = {}, Active = {}, History = {}, Seq = 0, OffersDay = -1 },
	EventProg = { Day = 0, Done = {}, Scenes = 0, Published = 0, Joined = false },
	Lives = {},
	Needs = { Energy = 100, Mood = 70 },
	FoodOrders = {},
	Posts = {},
	Series = {},
	Pets = {},
	ActivePet = "",
	PetGear = { Acc = {}, Toys = {} },
	UsedBought = { Day = -1, Units = {} },
	LastLive = 0,
	Company = {},
	LastPost = 0,
	Uid = 0,
	CreatedAt = 0,
	LastSeen = 0,
}

function DataService.Init(services)
	S = services
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[YTLife] DataStore no disponible: " .. tostring(result))
	end
end

local function lockIsForeign(lock)
	return lock ~= nil and lock.Job ~= game.JobId and (os.time() - (lock.T or 0)) < Config.SessionLockTimeout
end

local function migrate(data)
	-- Aquí se añadirán migraciones cuando cambie el esquema (data.Version < SCHEMA_VERSION).
	Util.reconcile(data, DataService.Template)
	data.Version = SCHEMA_VERSION
	return data
end

-- Devuelve data, estado ("ok" | "new" | "locked" | "error")
local function tryLoad(key)
	local status = "error"
	local loaded = nil
	local ok, err = pcall(function()
		store:UpdateAsync(key, function(old)
			if old ~= nil and lockIsForeign(old.__lock) then
				status = "locked"
				return nil -- cancela la escritura
			end
			if old == nil then
				status = "new"
				old = Util.deepCopy(DataService.Template)
				old.CreatedAt = os.time()
			else
				status = "ok"
			end
			old.__lock = { Job = game.JobId, T = os.time() }
			loaded = old
			return old
		end)
	end)
	if not ok then
		return nil, "error", err
	end
	return loaded, status
end

function DataService.load(player)
	local key = "u_" .. player.UserId
	local data, status, lastErr
	if store then
		for attempt = 1, Config.LoadRetries do
			data, status, lastErr = tryLoad(key)
			if data then
				break
			end
			if not player.Parent then
				return
			end
			task.wait(attempt * 2 + (status == "locked" and 4 or 0))
		end
	end

	local readOnly = false
	if not data then
		if RunService:IsStudio() then
			-- Modo de prueba: perfil temporal que NO se guarda.
			data = Util.deepCopy(DataService.Template)
			data.CreatedAt = os.time()
			readOnly = true
			warn("[YTLife] Studio: usando perfil temporal (activa 'Studio Access to API Services' para guardar). " .. tostring(lastErr or status))
		else
			S.Net.logError("load " .. player.UserId, tostring(lastErr or status))
			player:Kick("No se pudieron cargar tus datos de forma segura (" .. tostring(status) .. "). Tu progreso está a salvo: vuelve a entrar en unos minutos.")
			return
		end
	end
	if not player.Parent then
		-- Se fue durante la carga: liberar el bloqueo sin cambiar nada más.
		if not readOnly then
			pcall(function()
				store:UpdateAsync(key, function(old)
					if old and old.__lock and old.__lock.Job == game.JobId then
						old.__lock = nil
						return old
					end
					return nil
				end)
			end)
		end
		return
	end

	data.__lock = nil
	migrate(data)
	local isNew = status == "new" or readOnly
	profiles[player] = { Data = data, ReadOnly = readOnly, Key = key, IsNew = isNew, LoadedAt = os.time() }
	return profiles[player]
end

-- Recorta listas para no superar el límite de tamaño del DataStore.
local function trimForSize(data)
	local ok, json = pcall(HttpService.JSONEncode, HttpService, data)
	if ok and #json > 3500000 then
		while #data.Videos > 50 do
			table.remove(data.Videos)
		end
		while #data.Photos > 60 do
			table.remove(data.Photos)
		end
		while #data.Transactions > 50 do
			table.remove(data.Transactions)
		end
	end
end

function DataService.save(player, release)
	local profile = profiles[player]
	if not profile or profile.ReadOnly or not store then
		return true
	end
	local data = profile.Data
	data.LastSeen = os.time()
	trimForSize(data)
	local success = false
	for attempt = 1, 3 do
		local ok, err = pcall(function()
			store:UpdateAsync(profile.Key, function(old)
				if old ~= nil and lockIsForeign(old.__lock) then
					-- Otro servidor tiene la sesión: no sobrescribir.
					return nil
				end
				local copy = data
				copy.__lock = (not release) and { Job = game.JobId, T = os.time() } or nil
				return copy
			end)
		end)
		data.__lock = nil
		if ok then
			success = true
			break
		end
		S.Net.logError("save " .. player.UserId, err)
		task.wait(attempt)
	end
	return success
end

function DataService.get(player)
	local p = profiles[player]
	return p and p.Data or nil
end

function DataService.getProfile(player)
	return profiles[player]
end

function DataService.isNew(player)
	local p = profiles[player]
	return p ~= nil and p.IsNew
end

function DataService.markDirty(player)
	dirty[player] = true
end

function DataService.nextUid(player, prefix)
	local data = DataService.get(player)
	data.Uid = data.Uid + 1
	return (prefix or "i") .. data.Uid
end

function DataService.release(player)
	if profiles[player] then
		DataService.save(player, true)
		profiles[player] = nil
		dirty[player] = nil
	end
end

function DataService.Start()
	-- Sincronización con el cliente (agrupa cambios cada 0,3 s)
	task.spawn(function()
		while true do
			task.wait(0.3)
			for player in pairs(dirty) do
				dirty[player] = nil
				if profiles[player] and player.Parent then
					local ok, err = pcall(S.Sync.send, player)
					if not ok then
						S.Net.logError("sync", err)
					end
				end
			end
		end
	end)

	-- Guardado automático
	task.spawn(function()
		while true do
			task.wait(Config.AutosaveInterval)
			for player in pairs(profiles) do
				task.spawn(DataService.save, player, false)
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for player in pairs(profiles) do
			pending = pending + 1
			task.spawn(function()
				DataService.save(player, true)
				pending = pending - 1
			end)
		end
		local start = os.clock()
		while pending > 0 and os.clock() - start < 25 do
			task.wait(0.2)
		end
	end)
end

return DataService
