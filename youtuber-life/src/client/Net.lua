--!nonstrict
-- Net (cliente): envía peticiones al servidor y reparte los mensajes que llegan.
-- El cliente nunca decide resultados: solo pide acciones y muestra lo que responde el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local Net = {}
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local request = remotes:WaitForChild("Request")
local push = remotes:WaitForChild("Push")
local listeners = {}
local busy = 0

Net.Notify = nil -- lo asigna Main
Net.OnBusy = nil

function Net.nonce()
	return HttpService:GenerateGUID(false):sub(1, 30)
end

-- opts.silent: no mostrar mensajes; opts.quietOk: mostrar solo errores
function Net.call(action, payload, opts)
	opts = opts or {}
	busy = busy + 1
	if Net.OnBusy then
		Net.OnBusy(busy > 0)
	end
	local ok, result = pcall(function()
		return request:InvokeServer(action, payload)
	end)
	busy = busy - 1
	if Net.OnBusy then
		Net.OnBusy(busy > 0)
	end
	if not ok or type(result) ~= "table" then
		result = { ok = false, msg = "Sin conexión con el servidor. Inténtalo de nuevo." }
	end
	if Net.Notify and not opts.silent and result.msg then
		if result.ok then
			if not opts.quietOk then
				Net.Notify.toast(result.msg, "success")
			end
		else
			Net.Notify.toast(result.msg, "error")
		end
	end
	return result
end

function Net.on(kind, fn)
	listeners[kind] = listeners[kind] or {}
	table.insert(listeners[kind], fn)
end

push.OnClientEvent:Connect(function(kind, data)
	for _, fn in ipairs(listeners[kind] or {}) do
		task.spawn(fn, data)
	end
end)

return Net
