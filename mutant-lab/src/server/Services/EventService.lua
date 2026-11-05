--!nonstrict
-- EventService: eventos de todo el servidor que se repiten (tormenta radiactiva, fiebre de cápsulas,
-- hora legendaria, doble producción). Cambian el tono del cielo y se anuncian a todos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local LabData = require(ReplicatedStorage.Shared.LabData)

local Event = {}
local S
Event.current = nil
Event.endsAt = 0
Event.nextAt = 0
local order = 0

function Event.Init(services)
	S = services
end

function Event.luck()
	return Event.current and Event.current.Luck or 1
end
function Event.mutMult()
	return Event.current and Event.current.MutMult or 1
end
function Event.spawnMult()
	return Event.current and Event.current.SpawnMult or 1
end
function Event.incomeMult()
	return Event.current and Event.current.IncomeMult or 1
end

function Event.view()
	if not Event.current then
		return { Name = nil, NextIn = math.max(0, Event.nextAt - os.clock()) }
	end
	return { Id = Event.current.Id, Name = Event.current.Name, Desc = Event.current.Desc, Left = math.max(0, Event.endsAt - os.clock()) }
end

local function tint(color)
	if S.World.Tint then
		S.World.Tint.TintColor = color and Color3.fromRGB(200 + math.floor(color[1] / 5), 200 + math.floor(color[2] / 5), 200 + math.floor(color[3] / 5)) or Color3.new(1, 1, 1)
	end
end

function Event.begin(ev)
	Event.current = ev
	Event.endsAt = os.clock() + Config.EventDuration
	tint(ev.Sky)
	S.Net.pushAll("event", Event.view())
	S.Net.pushAll("notify", { text = "⚡ EVENTO: " .. ev.Name .. " — " .. ev.Desc, style = "gold" })
end

function Event.finish()
	if Event.current then
		S.Net.pushAll("notify", { text = "El evento " .. Event.current.Name .. " ha terminado.", style = "info" })
	end
	Event.current = nil
	Event.nextAt = os.clock() + Config.EventEvery
	tint(nil)
	S.Net.pushAll("event", Event.view())
end

function Event.Start()
	Event.nextAt = os.clock() + Config.EventEvery
	task.spawn(function()
		while true do
			task.wait(1)
			local now = os.clock()
			if Event.current and now >= Event.endsAt then
				Event.finish()
			elseif not Event.current and now >= Event.nextAt then
				order = order % #LabData.Events + 1
				Event.begin(LabData.Events[order])
			end
		end
	end)
end

return Event
