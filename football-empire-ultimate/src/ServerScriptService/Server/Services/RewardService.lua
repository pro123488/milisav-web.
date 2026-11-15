-- RewardService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/RewardService
--
-- RECOMPENSA DIARIA con racha y CÓDIGOS DE REGALO. Todo se decide en el servidor:
--   * La diaria se puede reclamar una vez por día (UTC). Si entras días seguidos la racha sube;
--     si te saltas un día, vuelve al día 1.
--   * Cada código se canjea una sola vez por jugador y solo si existe en RewardConfig.Codes.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RewardConfig = require(ReplicatedStorage.Shared.Config.RewardConfig)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PetService = require(script.Parent.PetService)
local SeasonService = require(script.Parent.SeasonService)

local RewardService = {}

local function today()
	return math.floor(os.time() / 86400)
end

-- Racha que tendría el jugador si reclamara hoy
local function nextStreak(rewards)
	if rewards.lastClaimDay == today() - 1 then
		return rewards.streak + 1
	end
	return 1
end

local function grant(player, reward, note)
	local got = {}
	if reward.crate then
		table.insert(got, PetService.GrantBall(player, reward.crate) or "📦 Ya tienes todos los balones de las cajas")
	end
	if reward.money then
		EconomyService.Earn(player, reward.money, EconomyService.Category.PRIZE, note)
		table.insert(got, string.format("💰 +%d $", reward.money))
	end
	if reward.egg then
		table.insert(got, PetService.GrantEgg(player, reward.egg) or "🥚 Huevo")
	end
	if reward.xp then
		SeasonService.AddXP(player, reward.xp)
		table.insert(got, string.format("🎟️ +%d puntos del pase", reward.xp))
	end
	return table.concat(got, " · ")
end

function RewardService.ClaimDaily(player)
	local data = DataService.Get(player)
	local rewards = data.rewards
	if rewards.lastClaimDay >= today() then
		return false, "Ya has reclamado la recompensa de hoy. ¡Vuelve mañana!"
	end
	local streak = nextStreak(rewards)
	local day = RewardConfig.DayOf(streak)
	rewards.streak = streak
	rewards.lastClaimDay = today()
	local text = grant(player, RewardConfig.Daily[day], "Recompensa diaria")
	return true, string.format("🎁 Día %d de racha: %s", day, text)
end

function RewardService.RedeemCode(player, payload)
	local data = DataService.Get(player)
	local code = type(payload) == "table" and payload.code
	if type(code) ~= "string" or #code > RewardConfig.MAX_CODE_LENGTH then
		return false, "Código no válido."
	end
	code = string.upper((code:gsub("%s", "")))
	local reward = RewardConfig.Codes[code]
	if not reward then
		return false, "Ese código no existe."
	end
	if reward.expires and os.time() > reward.expires then
		return false, "Ese código ha caducado."
	end
	if data.rewards.codes[code] then
		return false, "Ya has canjeado ese código."
	end
	data.rewards.codes[code] = true
	return true, string.format("🎁 Código %s canjeado: %s", code, grant(player, reward, "Código " .. code))
end

-- ===== REGALOS POR JUGAR (por sesión, no se guardan) =====
local sessions = {} -- [player] = { start = os.clock(), claimed = { [índice] = true } }

function RewardService.PlayerReady(player)
	sessions[player] = { start = os.clock(), claimed = {} }
end

function RewardService.PlayerRemoving(player)
	sessions[player] = nil
end

-- Reclama todos los regalos ya desbloqueados en esta sesión
function RewardService.ClaimPlaytime(player)
	local session = sessions[player]
	if not session then
		return false, "Tu sesión todavía se está cargando."
	end
	local minutes = (os.clock() - session.start) / 60
	local got = {}
	for index, gift in ipairs(RewardConfig.Playtime) do
		if minutes >= gift.minutes and not session.claimed[index] then
			session.claimed[index] = true
			table.insert(got, grant(player, gift, string.format("Regalo por jugar (%d min)", gift.minutes)))
		end
	end
	if #got == 0 then
		return false, "Todavía no hay regalos listos. ¡Sigue jugando!"
	end
	return true, "🎁 " .. table.concat(got, " · ")
end

function RewardService.PlaytimeState(player)
	local session = sessions[player]
	if not session then
		return nil
	end
	local claimed = {}
	for index in ipairs(RewardConfig.Playtime) do
		claimed[index] = session.claimed[index] == true
	end
	-- Se envían segundos enteros: el cliente cuenta el tiempo por su cuenta entre envíos
	return { elapsed = math.floor(os.clock() - session.start), claimed = claimed }
end

-- RULETA: el servidor elige el premio (por peso) y lo entrega; el cliente solo anima el giro.
local rng = Random.new()

function RewardService.Spin(player)
	local data = DataService.Get(player)
	local rewards = data.rewards
	if rewards.lastSpinDay >= today() then
		return false, "Ya has girado la ruleta hoy. ¡Vuelve mañana!"
	end
	local total = 0
	for _, segment in ipairs(RewardConfig.Wheel) do
		total += segment.weight
	end
	local roll = rng:NextNumber(0, total)
	local index = #RewardConfig.Wheel
	for i, segment in ipairs(RewardConfig.Wheel) do
		roll -= segment.weight
		if roll < 0 then
			index = i
			break
		end
	end
	rewards.lastSpinDay = today()
	local text = grant(player, RewardConfig.Wheel[index], "Ruleta de la suerte")
	return true, "🎡 Ruleta: " .. text, false, { index = index }
end

function RewardService.BuildState(data)
	local rewards = data.rewards
	local canClaim = rewards.lastClaimDay < today()
	local streak = canClaim and nextStreak(rewards) or rewards.streak
	return {
		canClaim = canClaim,
		streak = streak,
		day = RewardConfig.DayOf(streak), -- día (1-7) de la recompensa de hoy
		canSpin = rewards.lastSpinDay < today(),
	}
end

return RewardService
