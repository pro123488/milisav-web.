--!nonstrict
-- Net: único punto de entrada de peticiones del cliente.
--   Remotes/Request (RemoteFunction): el cliente pide una acción -> { ok, msg, data }
--   Remotes/Push (RemoteEvent): el servidor envía estado, avisos y aperturas de interfaz.
-- Todas las acciones se validan en el servidor. Hay límite de peticiones por jugador
-- y los errores se registran sin tumbar el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Config = require(ReplicatedStorage.Shared.Config)

local Net = {}
local S
local handlers = {}
local buckets = {}
local errorLog = {}

Net.ErrorLog = errorLog

function Net.Init(services)
	S = services
	local folder = ReplicatedStorage:FindFirstChild("Remotes")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "Remotes"
		folder.Parent = ReplicatedStorage
	end
	local request = folder:FindFirstChild("Request") or Instance.new("RemoteFunction")
	request.Name = "Request"
	request.Parent = folder
	local push = folder:FindFirstChild("Push") or Instance.new("RemoteEvent")
	push.Name = "Push"
	push.Parent = folder
	Net.RequestRemote = request
	Net.PushRemote = push

	request.OnServerInvoke = function(player, action, payload)
		return Net.dispatch(player, action, payload)
	end
	Players.PlayerRemoving:Connect(function(player)
		buckets[player] = nil
	end)
end

function Net.logError(where, err)
	local entry = os.date("!%H:%M:%S") .. " [" .. tostring(where) .. "] " .. tostring(err)
	table.insert(errorLog, 1, entry)
	while #errorLog > 50 do
		table.remove(errorLog)
	end
	warn("[YTLife] " .. entry)
end

-- Registra una acción. opts.noProfile = no requiere datos cargados.
function Net.on(action, fn, opts)
	assert(handlers[action] == nil, "Acción duplicada: " .. action)
	handlers[action] = { fn = fn, opts = opts or {} }
end

local function allow(player)
	local now = os.clock()
	local b = buckets[player]
	if not b then
		b = { tokens = Config.RequestsPerSecond, last = now }
		buckets[player] = b
	end
	b.tokens = math.min(Config.RequestsPerSecond, b.tokens + (now - b.last) * Config.RequestsPerSecond)
	b.last = now
	if b.tokens < 1 then
		return false
	end
	b.tokens = b.tokens - 1
	return true
end

function Net.dispatch(player, action, payload)
	if type(action) ~= "string" then
		return { ok = false, msg = "Petición no válida." }
	end
	local h = handlers[action]
	if not h then
		return { ok = false, msg = "Acción desconocida: " .. action }
	end
	if not allow(player) then
		return { ok = false, msg = "Vas demasiado rápido. Espera un momento." }
	end
	if not h.opts.noProfile and not S.Data.get(player) then
		return { ok = false, msg = "Tus datos aún se están cargando." }
	end
	if payload ~= nil and type(payload) ~= "table" then
		payload = {}
	end
	payload = payload or {}
	local success, ok, msg, data = pcall(h.fn, player, payload)
	if not success then
		Net.logError(action, ok)
		return { ok = false, msg = "Ha ocurrido un error. Inténtalo de nuevo." }
	end
	if ok ~= false then
		S.Data.markDirty(player)
	end
	return { ok = ok ~= false, msg = msg, data = data }
end

function Net.push(player, kind, data)
	if player and player.Parent then
		Net.PushRemote:FireClient(player, kind, data)
	end
end

function Net.pushAll(kind, data)
	Net.PushRemote:FireAllClients(kind, data)
end

-- Atajos de notificación
function Net.notify(player, text, style)
	Net.push(player, "notify", { text = text, style = style or "info" })
end

return Net
