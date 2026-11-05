--!nonstrict
-- DailyService: premio por entrar cada día (racha de 7 días que se repite) y 3 misiones diarias.
-- El día se calcula en el servidor (UTC). Cada premio se cobra una sola vez.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)

local Daily = {}
local S

-- Tipos de misión: Target se escala con el nivel del laboratorio; Reward en créditos (también escalado)
Daily.Kinds = {
	{ Id = "buy", Text = "Compra %s cápsulas", Target = 5, Reward = 150 },
	{ Id = "collect", Text = "Recoge %s créditos del colector", Target = 500, Reward = 200, ScaleTarget = true },
	{ Id = "fuse", Text = "Completa %s fusión", Target = 1, Reward = 400 },
	{ Id = "steal", Text = "Roba %s mutante y llévalo a tu laboratorio", Target = 1, Reward = 500 },
	{ Id = "recover", Text = "Recupera %s mutante robado (tocando al ladrón, con trampas o con el dron)", Target = 1, Reward = 300 },
	{ Id = "discover", Text = "Descubre %s especie nueva", Target = 1, Reward = 350 },
	{ Id = "sell", Text = "Vende %s mutantes", Target = 2, Reward = 120 },
}
Daily.KindById = {}
for _, k in ipairs(Daily.Kinds) do
	Daily.KindById[k.Id] = k
end
Daily.LoginRewards = { 100, 150, 250, 400, 600, 900, 1500 }

function Daily.Init(services)
	S = services
end

function Daily.today()
	return os.date("!%Y-%m-%d", os.time())
end
local function yesterday()
	return os.date("!%Y-%m-%d", os.time() - 86400)
end

-- Multiplicador según el nivel del laboratorio (las recompensas crecen con el progreso)
local function scale(data)
	return ({ 1, 4, 25, 180, 1500 })[data.Lab.Tier] or 1
end

local function newMissions(player, data, day)
	-- 3 misiones distintas, deterministas para ese jugador y día
	local seed = 0
	for i = 1, #day do
		seed = (seed * 31 + day:byte(i)) % 2147483647
	end
	local rng = Random.new(seed + player.UserId)
	local pool = {}
	for _, k in ipairs(Daily.Kinds) do
		pool[#pool + 1] = k
	end
	local out = {}
	for _ = 1, 3 do
		local idx = rng:NextInteger(1, #pool)
		local k = table.remove(pool, idx)
		local sc = scale(data)
		out[#out + 1] = { Kind = k.Id, Target = k.ScaleTarget and k.Target * sc or k.Target, Progress = 0, Reward = k.Reward * sc, Claimed = false }
	end
	return out
end

-- Al entrar (y al cambiar de día): racha y misiones nuevas
function Daily.refresh(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	data.Daily = data.Daily or {}
	local d = data.Daily
	local today = Daily.today()
	if d.Day ~= today then
		if d.LastLogin == yesterday() then
			d.Streak = (d.Streak or 0) + 1
		elseif d.LastLogin ~= today then
			d.Streak = 1
		end
		d.Day = today
		d.LoginClaimed = false
		d.Missions = newMissions(player, data, today)
	end
	d.LastLogin = today
end

function Daily.progress(player, kind, amount)
	local data = S.Data.get(player)
	local d = data and data.Daily
	if not d or not d.Missions then
		return
	end
	if d.Day ~= Daily.today() then
		Daily.refresh(player)
	end
	for _, m in ipairs(d.Missions) do
		if m.Kind == kind and not m.Claimed and m.Progress < m.Target then
			m.Progress = math.min(m.Target, m.Progress + (amount or 1))
			if m.Progress >= m.Target then
				S.Net.notify(player, "📅 Misión diaria completada: cóbrala en la pestaña Diario.", "gold")
			end
		end
	end
end

function Daily.claimLogin(player)
	local data = S.Data.get(player)
	Daily.refresh(player)
	local d = data.Daily
	if d.LoginClaimed then
		return false, "Ya has cobrado el premio de hoy. ¡Vuelve mañana!"
	end
	local dayInCycle = ((d.Streak or 1) - 1) % #Daily.LoginRewards + 1
	local amount = Daily.LoginRewards[dayInCycle] * scale(data)
	d.LoginClaimed = true
	data.Credits = data.Credits + amount
	return true, "🎁 Premio del día " .. dayInCycle .. ": +" .. Util.short(amount) .. " créditos (racha de " .. d.Streak .. " días)", { amount = amount }
end

function Daily.claim(player, i)
	local data = S.Data.get(player)
	Daily.refresh(player)
	local m = type(i) == "number" and data.Daily.Missions[math.floor(i)]
	if not m then
		return false, "Misión no válida."
	end
	if m.Claimed then
		return false, "Ya la has cobrado."
	end
	if m.Progress < m.Target then
		return false, "Aún no está completada (" .. Util.short(m.Progress) .. "/" .. Util.short(m.Target) .. ")."
	end
	m.Claimed = true
	data.Credits = data.Credits + m.Reward
	return true, "✅ +" .. Util.short(m.Reward) .. " créditos", { amount = m.Reward }
end

function Daily.view(player)
	local data = S.Data.get(player)
	local d = data and data.Daily
	if not d or not d.Missions then
		return nil
	end
	local missions = {}
	for i, m in ipairs(d.Missions) do
		local k = Daily.KindById[m.Kind]
		missions[i] = { Text = string.format(k.Text, Util.short(m.Target)), Progress = m.Progress, Target = m.Target, Reward = m.Reward, Claimed = m.Claimed }
	end
	local dayInCycle = ((d.Streak or 1) - 1) % #Daily.LoginRewards + 1
	return { Streak = d.Streak or 1, LoginClaimed = d.LoginClaimed, LoginReward = Daily.LoginRewards[dayInCycle] * scale(data), DayInCycle = dayInCycle, Missions = missions }
end

function Daily.Start()
	S.Net.on("Daily.Login", function(player)
		return Daily.claimLogin(player)
	end)
	S.Net.on("Daily.Claim", function(player, p)
		return Daily.claim(player, tonumber(p.i))
	end)
end

return Daily
