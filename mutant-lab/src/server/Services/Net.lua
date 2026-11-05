--!nonstrict
-- Net: un único RemoteFunction ("Request") para las acciones del cliente y un RemoteEvent ("Push")
-- para avisos del servidor. Límite de peticiones por jugador y errores registrados sin tumbar el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Config = require(ReplicatedStorage.Shared.Config)

local Net = {}
local S
local handlers = {}
local rate = {}

function Net.Init(services)
	S = services
	local folder = Instance.new("Folder")
	folder.Name = "Remotes"
	folder.Parent = ReplicatedStorage
	Net.Request = Instance.new("RemoteFunction")
	Net.Request.Name = "Request"
	Net.Request.Parent = folder
	Net.Push = Instance.new("RemoteEvent")
	Net.Push.Name = "Push"
	Net.Push.Parent = folder

	Net.Request.OnServerInvoke = function(player, action, payload)
		if type(action) ~= "string" or #action > 40 then
			return { ok = false, msg = "Petición no válida." }
		end
		if payload ~= nil and type(payload) ~= "table" then
			return { ok = false, msg = "Datos no válidos." }
		end
		-- límite de peticiones por segundo
		local now = os.clock()
		local r = rate[player]
		if not r or now - r.t >= 1 then
			r = { t = now, n = 0 }
			rate[player] = r
		end
		r.n = r.n + 1
		if r.n > Config.RequestsPerSecond then
			return { ok = false, msg = "Demasiadas acciones seguidas. Espera un momento." }
		end
		local fn = handlers[action]
		if not fn then
			return { ok = false, msg = "Acción desconocida." }
		end
		if not S.Data.get(player) then
			return { ok = false, msg = "Tus datos aún se están cargando." }
		end
		local ok, a, b, c = pcall(fn, player, payload or {})
		if not ok then
			warn("[LabMutante] error en " .. action .. ": " .. tostring(a))
			return { ok = false, msg = "Algo salió mal. Inténtalo de nuevo." }
		end
		if a then
			S.Data.markDirty(player)
		end
		return { ok = a and true or false, msg = b, data = c }
	end
	Players.PlayerRemoving:Connect(function(p)
		rate[p] = nil
	end)
end

function Net.on(action, fn)
	handlers[action] = fn
end

function Net.push(player, kind, data)
	if player and player.Parent then
		Net.Push:FireClient(player, kind, data)
	end
end

function Net.pushAll(kind, data)
	for _, p in ipairs(Players:GetPlayers()) do
		Net.push(p, kind, data)
	end
end

function Net.notify(player, text, style)
	Net.push(player, "notify", { text = text, style = style or "info" })
end

return Net
