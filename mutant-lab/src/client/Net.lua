--!nonstrict
-- Net (cliente): llamadas al servidor y avisos que llegan del servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = {}
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local request = remotes:WaitForChild("Request")
local push = remotes:WaitForChild("Push")
local listeners = {}

-- Devuelve { ok, msg, data }. Los mensajes se muestran con Net.onMessage si está definido.
function Net.call(action, payload)
	local ok, result = pcall(function()
		return request:InvokeServer(action, payload or {})
	end)
	if not ok or type(result) ~= "table" then
		result = { ok = false, msg = "Sin conexión con el servidor." }
	end
	if result.msg and Net.onMessage then
		Net.onMessage(result.msg, result.ok and "success" or "error")
	end
	return result
end

function Net.on(kind, fn)
	listeners[kind] = listeners[kind] or {}
	table.insert(listeners[kind], fn)
end

push.OnClientEvent:Connect(function(kind, data)
	for _, fn in ipairs(listeners[kind] or {}) do
		local ok, err = pcall(fn, data)
		if not ok then
			warn("[LabMutante] cliente " .. tostring(kind) .. ": " .. tostring(err))
		end
	end
end)

return Net
