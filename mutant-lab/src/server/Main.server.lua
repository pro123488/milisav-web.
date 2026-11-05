--!nonstrict
-- Arranque del servidor de Laboratorio Mutante.

local Players = game:GetService("Players")
local Services = script.Parent.Services

local S = {}
local order = {
	{ "Net", "Net" },
	{ "Data", "DataService" },
	{ "World", "WorldService" },
	{ "Event", "EventService" },
	{ "Monetization", "MonetizationService" },
	{ "Lab", "LabService" },
	{ "Conveyor", "ConveyorService" },
	{ "Raid", "RaidService" },
	{ "Fusion", "FusionService" },
	{ "Sync", "SyncService" },
}
for _, e in ipairs(order) do
	S[e[1]] = require(Services[e[2]])
end
for _, e in ipairs(order) do
	S[e[1]].Init(S)
end
for _, e in ipairs(order) do
	if S[e[1]].Start then
		S[e[1]].Start()
	end
end

local function onPlayerAdded(player)
	local data = S.Data.load(player)
	if not data or not player.Parent then
		return
	end
	S.Monetization.onPlayerReady(player)
	if not S.Lab.assign(player) then
		player:Kick("El servidor está lleno (8 laboratorios). Prueba en otro servidor.")
		return
	end
	S.Fusion.onReady(player)
	S.Sync.send(player)
	S.Net.push(player, "ready", { first = data.Stats.Bought == 0 })
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, p in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, p)
end

Players.PlayerRemoving:Connect(function(player)
	S.Raid.onLeave(player)
	S.Fusion.onLeave(player)
	S.Lab.release(player)
	S.Monetization.onLeave(player)
	S.Data.release(player)
end)
