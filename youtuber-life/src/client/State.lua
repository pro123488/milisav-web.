--!nonstrict
-- State (cliente): copia de solo lectura del perfil enviada por el servidor + avisos de cambio.

local State = {}
State.Data = nil
State.Messages = {} -- historial de notificaciones de esta sesión (app Mensajes)
State.Context = {} -- tienda física actual, etc.

local listeners = {}
local nextId = 0

function State.set(data)
	State.Data = data
	for _, fn in pairs(listeners) do
		task.spawn(fn, data)
	end
end

-- Devuelve una función para dejar de escuchar
function State.on(fn)
	nextId = nextId + 1
	local id = nextId
	listeners[id] = fn
	return function()
		listeners[id] = nil
	end
end

-- Directo en curso (eventos "live" del servidor)
State.Live = nil
local liveListeners = {}
function State.setLive(d)
	State.Live = d
	for _, fn in pairs(liveListeners) do
		task.spawn(fn, d)
	end
end
function State.onLive(fn)
	nextId = nextId + 1
	local id = nextId
	liveListeners[id] = fn
	return function()
		liveListeners[id] = nil
	end
end

function State.addMessage(text, style)
	table.insert(State.Messages, 1, { Text = text, Style = style, T = os.time() })
	while #State.Messages > 60 do
		table.remove(State.Messages)
	end
end

function State.count(t)
	local n = 0
	for _ in pairs(t or {}) do
		n = n + 1
	end
	return n
end

-- Objetos del inventario como lista ordenada
function State.items(filterFn)
	local out = {}
	local Catalog = require(game:GetService("ReplicatedStorage").Shared.ItemCatalog)
	for uid, rec in pairs(State.Data and State.Data.Inventory or {}) do
		local def = Catalog.get(rec.Id)
		if def and (not filterFn or filterFn(rec, def, uid)) then
			out[#out + 1] = { Uid = uid, Rec = rec, Def = def }
		end
	end
	table.sort(out, function(a, b)
		if a.Def.Cat ~= b.Def.Cat then
			return a.Def.Cat < b.Def.Cat
		end
		return a.Def.Name < b.Def.Name
	end)
	return out
end

return State
