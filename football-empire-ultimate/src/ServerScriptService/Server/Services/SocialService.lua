-- SocialService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/SocialService
--
-- SOCIAL:
--   * BONUS DE AMIGOS: por cada amigo de Roblox conectado en el mismo servidor, +10 % en las
--     recompensas de los partidos en grupo (máximo +30 %). Lo comprueba el servidor con Roblox.
--   * «ME GUSTA» A LOS ESTADIOS: en el cartel de cada estadio (tecla L). Un «me gusta» por
--     estadio y día, y como mucho LIKES_PER_DAY al día. Da un pequeño premio a los dos.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)

local SocialService = {}

SocialService.FRIEND_BONUS = 0.10
SocialService.MAX_FRIENDS_BONUS = 3
SocialService.LIKES_PER_DAY = 20
SocialService.LIKE_REWARD_OWNER = 300
SocialService.LIKE_REWARD_GIVER = 150

local notifyRemote = Remotes.Get("Notify")
local friends = {} -- [player] = { [otroPlayer] = true }
local likeCallbacks = {}

local function today()
	return math.floor(os.time() / 86400)
end

-- ===== Amigos =====

function SocialService.PlayerAdded(player)
	friends[player] = friends[player] or {}
	for _, other in ipairs(Players:GetPlayers()) do
		if other ~= player then
			local ok, isFriend = pcall(function()
				return player:IsFriendsWith(other.UserId)
			end)
			if ok and isFriend and player.Parent and other.Parent then
				friends[player][other] = true
				friends[other] = friends[other] or {}
				friends[other][player] = true
				notifyRemote:FireClient(other, "info", string.format("👥 Tu amigo %s ha entrado: +10 %% en los partidos en grupo", player.DisplayName))
				notifyRemote:FireClient(player, "info", string.format("👥 Tu amigo %s está en este servidor: +10 %% en los partidos en grupo", other.DisplayName))
			end
		end
	end
end

function SocialService.PlayerRemoving(player)
	for other in pairs(friends[player] or {}) do
		if friends[other] then
			friends[other][player] = nil
		end
	end
	friends[player] = nil
end

function SocialService.FriendsOnline(player)
	local count = 0
	for other in pairs(friends[player] or {}) do
		if other.Parent then
			count += 1
		end
	end
	return count
end

-- Fracción extra para las recompensas de los partidos en grupo
function SocialService.FriendBonus(player)
	return math.min(SocialService.FriendsOnline(player), SocialService.MAX_FRIENDS_BONUS) * SocialService.FRIEND_BONUS
end

-- ===== «Me gusta» =====

function SocialService.OnLike(callback)
	table.insert(likeCallbacks, callback)
end

function SocialService.Like(player, owner)
	local data = DataService.Get(player)
	local ownerData = owner and DataService.Get(owner)
	if not data or not ownerData then
		return false, "Ese estadio no está disponible ahora."
	end
	if owner == player then
		return false, "No puedes darte «me gusta» a ti mismo. 😉"
	end
	local social = data.social
	if social.likeDay ~= today() then
		social.likeDay = today()
		social.likedToday = {}
	end
	local key = tostring(owner.UserId)
	if social.likedToday[key] then
		return false, "Ya le diste «me gusta» a este estadio hoy."
	end
	local given = 0
	for _ in pairs(social.likedToday) do
		given += 1
	end
	if given >= SocialService.LIKES_PER_DAY then
		return false, string.format("Ya has dado %d «me gusta» hoy. ¡Vuelve mañana!", SocialService.LIKES_PER_DAY)
	end
	social.likedToday[key] = true
	ownerData.club.likes += 1
	EconomyService.Earn(owner, SocialService.LIKE_REWARD_OWNER, EconomyService.Category.PRIZE, "«Me gusta» de " .. player.DisplayName)
	EconomyService.Earn(player, SocialService.LIKE_REWARD_GIVER, EconomyService.Category.PRIZE, "Visitar estadios")
	notifyRemote:FireClient(owner, "success", string.format("👍 A %s le gusta tu estadio (+%d $). Total: %d", player.DisplayName,
		SocialService.LIKE_REWARD_OWNER, ownerData.club.likes))
	for _, callback in ipairs(likeCallbacks) do
		task.spawn(callback, owner)
	end
	return true, string.format("👍 ¡Te gusta el estadio de %s! (+%d $)", owner.DisplayName, SocialService.LIKE_REWARD_GIVER)
end

function SocialService.BuildState(player, data)
	local given = 0
	if data.social.likeDay == today() then
		for _ in pairs(data.social.likedToday) do
			given += 1
		end
	end
	return {
		friends = SocialService.FriendsOnline(player),
		friendBonus = SocialService.FriendBonus(player),
		likes = data.club.likes,
		likesLeft = SocialService.LIKES_PER_DAY - given,
	}
end

return SocialService
