--!nonstrict
-- QuestService: tutorial guiado (eventos) + logros (contadores).
--  * Un logro se marca completado una vez y su recompensa se cobra una sola vez (Claimed).
--  * Los pasos del tutorial se pueden saltar; los saltados no dan recompensa.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local QuestDefs = require(Shared.QuestDefs)
local Util = require(Shared.Util)

local Quest = {}
local S

function Quest.Init(services)
	S = services
end

-- Valor actual de un contador de logros
function Quest.valueOf(data, key)
	if key == "subs" then
		return data.Channel.Subs
	elseif key == "total_views" then
		return data.Channel.TotalViews
	elseif key == "revenue" then
		return data.Channel.TotalRevenue
	elseif key == "level" then
		return data.Level
	elseif key == "districts_visited" then
		return Util.count(data.Visited.Districts)
	elseif key == "districts_recorded" then
		return Util.count(data.Visited.Recorded)
	elseif key == "stores_visited" then
		return Util.count(data.Visited.Stores)
	elseif key == "categories_published" then
		return Util.count(data.Visited.Categories)
	elseif key == "secrets_found" then
		return Util.count(data.Visited.Secrets)
	elseif key == "cameras_owned" then
		return Util.count(data.Visited.Cameras)
	elseif key == "destinations_visited" then
		return Util.count(data.Visited.Destinations)
	elseif key == "properties_owned" then
		local n = 0
		for _, rec in pairs(data.Properties or {}) do
			if rec.Mode == "own" then
				n = n + 1
			end
		end
		return n
	end
	return data.Counters[key] or 0
end

function Quest.check(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local q = data.Quests
	for _, a in ipairs(QuestDefs.Achievements) do
		if not q.Completed[a.Id] and Quest.valueOf(data, a.Counter) >= a.Target then
			q.Completed[a.Id] = os.time()
			S.Net.push(player, "achievement", { id = a.Id, name = a.Name })
		end
	end
	S.Data.markDirty(player)
end

local function grant(player, reward, why)
	local data = S.Data.get(player)
	if reward.Money and reward.Money > 0 then
		S.Economy.add(player, reward.Money, "Recompensas", why, {})
	end
	if reward.Xp and reward.Xp > 0 then
		S.Progress.addXp(player, reward.Xp)
	end
	if reward.Title then
		data.Titles[reward.Title] = true
		S.Net.notify(player, "🏷 Nuevo título desbloqueado: «" .. reward.Title .. "»", "success")
	end
end

function Quest.tutorialEvent(player, event)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local q = data.Quests
	if q.Skipped then
		return
	end
	local step = QuestDefs.Tutorial[q.Step]
	if not step or step.Event ~= event then
		return
	end
	q.StepProgress = q.StepProgress + 1
	if q.StepProgress >= (step.Target or 1) then
		q.Step = q.Step + 1
		q.StepProgress = 0
		grant(player, step.Reward, "Tutorial: " .. step.Name)
		local nxt = QuestDefs.Tutorial[q.Step]
		S.Net.push(player, "tutorial", { done = step.Name, next = nxt and nxt.Name or nil, finished = nxt == nil })
		if not nxt then
			S.Net.notify(player, "🎓 ¡Tutorial completado! El mundo es tuyo: elige tu propio camino.", "success")
		end
	end
	S.Data.markDirty(player)
end

function Quest.Start()
	local Net = S.Net

	Net.on("Quest.Claim", function(player, p)
		local data = S.Data.get(player)
		local def = QuestDefs.ById[p.id or ""]
		if not def or not def.Counter then
			return false, "Logro no encontrado."
		end
		if not data.Quests.Completed[def.Id] then
			return false, "Aún no has completado este logro."
		end
		if data.Quests.Claimed[def.Id] then
			return false, "Ya cobraste esta recompensa."
		end
		data.Quests.Claimed[def.Id] = os.time()
		grant(player, def.Reward, "Logro: " .. def.Name)
		Quest.tutorialEvent(player, "claim_reward")
		return true, "Recompensa cobrada: $" .. Util.formatInt(def.Reward.Money) .. " y " .. def.Reward.Xp .. " XP."
	end)

	Net.on("Quest.ClaimAll", function(player)
		local data = S.Data.get(player)
		local n = 0
		for _, def in ipairs(QuestDefs.Achievements) do
			if data.Quests.Completed[def.Id] and not data.Quests.Claimed[def.Id] then
				data.Quests.Claimed[def.Id] = os.time()
				grant(player, def.Reward, "Logro: " .. def.Name)
				n = n + 1
			end
		end
		if n == 0 then
			return false, "No hay recompensas pendientes."
		end
		Quest.tutorialEvent(player, "claim_reward")
		return true, n .. " recompensas cobradas."
	end)

	Net.on("Phone.Opened", function(player)
		Quest.tutorialEvent(player, "open_phone")
		return true
	end)

	Net.on("Quest.SkipTutorial", function(player)
		local data = S.Data.get(player)
		data.Quests.Skipped = true
		return true, "Tutorial omitido. Puedes ver las misiones en cualquier momento (tecla M)."
	end)

	Net.on("Quest.SkipStep", function(player)
		local data = S.Data.get(player)
		local q = data.Quests
		if QuestDefs.Tutorial[q.Step] then
			q.Step = q.Step + 1
			q.StepProgress = 0
			return true, "Paso saltado (sin recompensa)."
		end
		return false, "No hay paso que saltar."
	end)

	Net.on("Quest.RestartTutorial", function(player)
		local data = S.Data.get(player)
		-- Reactivar las explicaciones no vuelve a dar recompensas de pasos ya completados
		data.Quests.Skipped = false
		return true, "Explicaciones del tutorial reactivadas."
	end)

	Net.on("Title.Equip", function(player, p)
		local data = S.Data.get(player)
		if p.title ~= "" and not data.Titles[p.title or ""] then
			return false, "No tienes ese título."
		end
		data.EquippedTitle = p.title or ""
		S.Avatar.refreshOverhead(player)
		return true, p.title == "" and "Título quitado." or ("Título «" .. p.title .. "» equipado.")
	end)
end

return Quest
