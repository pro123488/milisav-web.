--!nonstrict
-- ProgressService: experiencia, niveles y rango de creador.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Progression = require(ReplicatedStorage.Shared.Progression)

local Progress = {}
local S

Progress.Xp = Progression.Xp

function Progress.Init(services)
	S = services
end

function Progress.rank(data)
	return Progression.rankFor(data.Level, data.Channel.Subs, data.Counters.published or 0, data.Reputation)
end

function Progress.addXp(player, amount)
	local data = S.Data.get(player)
	if not data or amount <= 0 then
		return
	end
	local oldRank = Progress.rank(data)
	local level, xp, ups = Progression.applyXp(data.Level, data.XP, amount)
	data.Level, data.XP = level, xp
	if ups > 0 then
		S.Net.push(player, "levelUp", { level = level })
		S.Quest.check(player)
	end
	local newRank, rank = Progress.rank(data)
	if newRank > oldRank then
		S.Net.push(player, "rankUp", { name = rank.Name, unlock = rank.Unlock })
		S.Avatar.refreshOverhead(player)
	end
	S.Data.markDirty(player)
end

function Progress.Start() end

return Progress
