--!nonstrict
-- SyncService: envía al cliente una vista compacta de su estado (solo lectura; el cliente nunca decide nada).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local LabData = require(ReplicatedStorage.Shared.LabData)
local MutantData = require(ReplicatedStorage.Shared.MutantData)

local Sync = {}
local S

function Sync.Init(services)
	S = services
end

function Sync.build(player)
	local data = S.Data.get(player)
	if not data then
		return nil
	end
	local research = {}
	for _, r in ipairs(LabData.Research) do
		local lvl = data.Research[r.Id] or 0
		research[#research + 1] = { Id = r.Id, Name = r.Name, Desc = r.Desc, Level = lvl, Max = r.Max, Cost = lvl < r.Max and LabData.researchCost(r.Id, lvl) or nil }
	end
	local index = {}
	for _, sp in ipairs(MutantData.Species) do
		index[#index + 1] = { Id = sp.Id, Name = sp.Name, Rarity = sp.Rarity, Count = data.Index[sp.Id] or 0, Price = sp.Price, Income = sp.Income }
	end
	local carry = S.Raid and S.Raid.carrying[player]
	return {
		Credits = math.floor(data.Credits),
		Lab = S.Lab.view(player),
		Fusion = S.Fusion and S.Fusion.view(player) or nil,
		Research = research,
		Index = index,
		Stats = data.Stats,
		Event = S.Event and S.Event.view() or nil,
		Carrying = carry and MutantData.label(carry.Rec) or nil,
		Shop = S.Monetization and S.Monetization.view(player) or nil,
		Daily = S.Daily and S.Daily.view(player) or nil,
		Top = S.Board and S.Board.entries or nil,
		NextTier = LabData.Tiers[data.Lab.Tier + 1],
	}
end

function Sync.send(player)
	local view = Sync.build(player)
	if view then
		S.Net.push(player, "state", view)
	end
end

function Sync.Start()
	S.Net.on("State.Get", function(player)
		return true, nil, Sync.build(player)
	end)
	task.spawn(function()
		while true do
			task.wait(1)
			for _, player in ipairs(Players:GetPlayers()) do
				local ok, err = pcall(Sync.send, player)
				if not ok then
					warn("[LabMutante] sync: " .. tostring(err))
				end
			end
		end
	end)
end

return Sync
