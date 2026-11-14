-- AdminService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/AdminService
--
-- EVENTOS «ADMIN ABUSE». Solo los admins (decidido aquí, en el servidor) pueden lanzarlos.
-- Cada evento se aplica en este servidor y se publica con MessagingService para que llegue
-- a TODOS los servidores del juego a la vez.
--   * Recompensas x2     -> multiplica las recompensas de los partidos en grupo y las monedas.
--   * Supervelocidad     -> atributo global que el cliente aplica a su velocidad.
--   * Lluvia de monedas  -> monedas por los estadios; cada una da dinero al club (validado aquí).
--   * Balón de oro       -> los goles de los partidos en grupo dan x3 de recompensa.
--   * Anuncio            -> mensaje (filtrado por Roblox) en pantalla para todos.

local MessagingService = game:GetService("MessagingService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TextService = game:GetService("TextService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local AdminConfig = require(Shared.Config.AdminConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)

local AdminService = {}

local notifyRemote = Remotes.Get("Notify")
local admins = {} -- [player] = true
local activeUntil = {} -- [id del evento] = os.time() en que termina
local lastLaunch = {} -- [id del evento] = os.clock() (espera entre lanzamientos en este servidor)
local lastAnnounce = 0
local rng = Random.new()
local coinFolder

local function attributeName(id)
	return "FEU_Event_" .. id
end

-- ===== ¿Quién es admin? =====

local function computeIsAdmin(player)
	if RunService:IsStudio() then
		return true
	end
	if table.find(AdminConfig.ADMIN_USER_IDS, player.UserId) then
		return true
	end
	if game.CreatorType == Enum.CreatorType.User then
		return player.UserId == game.CreatorId
	end
	local ok, rank = pcall(function()
		return player:GetRankInGroup(game.CreatorId)
	end)
	return ok and type(rank) == "number" and rank >= AdminConfig.GROUP_MIN_RANK
end

function AdminService.IsAdmin(player)
	return admins[player] == true
end

-- ===== Efectos =====

function AdminService.IsActive(id)
	local untilTime = activeUntil[id]
	return untilTime ~= nil and os.time() < untilTime
end

function AdminService.RewardMultiplier()
	return AdminService.IsActive("double") and 2 or 1
end

function AdminService.GoalMultiplier()
	local event = AdminConfig.Event("goldball")
	return AdminService.IsActive("goldball") and event.goalMultiplier or 1
end

local function spawnCoin(origin, value)
	local coin = Instance.new("Part")
	coin.Name = "AdminCoin"
	coin.Shape = Enum.PartType.Cylinder
	coin.Size = Vector3.new(0.4, 2.4, 2.4)
	coin.Material = Enum.Material.Neon
	coin.Color = Color3.fromRGB(255, 205, 40)
	coin.Anchored = true
	coin.CanCollide = false
	local spot = Vector3.new(rng:NextInteger(-60, 60), 2, rng:NextInteger(-30, 95))
	coin.CFrame = origin * CFrame.new(spot) * CFrame.Angles(0, rng:NextNumber(0, math.pi), math.pi / 2)
	coin:SetAttribute("Value", value)
	coin.Parent = coinFolder
	local taken = false
	coin.Touched:Connect(function(hit)
		if taken then
			return
		end
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if not player or not humanoid or humanoid.Health <= 0 or not DataService.Get(player) then
			return
		end
		taken = true
		coin:Destroy()
		local amount = value * AdminService.RewardMultiplier()
		EconomyService.Earn(player, amount, EconomyService.Category.ADMIN_EVENT, "Lluvia de monedas")
		notifyRemote:FireClient(player, "coin", { gained = amount })
	end)
	task.delay(90, function()
		if coin.Parent then
			coin:Destroy()
		end
	end)
end

local function coinRain(event)
	local origins = {}
	for _, player in ipairs(Players:GetPlayers()) do
		local plot = PlotService.GetPlot(player)
		if plot then
			table.insert(origins, plot.origin)
		end
	end
	if #origins == 0 then
		return
	end
	-- Las monedas caen poco a poco durante el minuto del evento
	task.spawn(function()
		for wave = 1, 5 do
			for _, origin in ipairs(origins) do
				for _ = 1, math.ceil(event.coinsPerPlot / 5) do
					spawnCoin(origin, event.coinValue)
				end
			end
			if wave < 5 then
				task.wait(event.minutes * 60 / 5)
			end
		end
	end)
end

-- Aplica un evento en ESTE servidor (llamado al lanzarlo aquí o al recibirlo de otro servidor).
local function apply(id, byName)
	local event = AdminConfig.Event(id)
	if not event then
		return
	end
	local endsAt = os.time() + event.minutes * 60
	activeUntil[id] = endsAt
	Workspace:SetAttribute(attributeName(id), endsAt)
	if event.speedMultiplier then
		Workspace:SetAttribute("FEU_SpeedMultiplier", event.speedMultiplier)
	end
	if id == "coinrain" then
		coinRain(event)
	end
	notifyRemote:FireAllClients("admin", { icon = event.icon, text = event.text, by = byName })
	task.delay(event.minutes * 60, function()
		if activeUntil[id] == endsAt then
			activeUntil[id] = nil
			Workspace:SetAttribute(attributeName(id), nil)
			if event.speedMultiplier then
				Workspace:SetAttribute("FEU_SpeedMultiplier", nil)
			end
		end
	end)
end

local function publish(message)
	message.server = game.JobId
	task.spawn(function()
		local ok, err = pcall(function()
			MessagingService:PublishAsync(AdminConfig.MESSAGING_TOPIC, message)
		end)
		if not ok then
			warn("[AdminService] No se pudo enviar el evento a otros servidores: ", err)
		end
	end)
end

-- ===== Acciones (Action remote) =====

function AdminService.Launch(player, payload)
	if not AdminService.IsAdmin(player) then
		return false, "Solo los admins pueden lanzar eventos."
	end
	local id = type(payload) == "table" and payload.id
	local event = type(id) == "string" and AdminConfig.Event(id)
	if not event then
		return false, "Evento no válido."
	end
	local last = lastLaunch[id]
	if last and os.clock() - last < event.cooldown then
		return false, string.format("Espera %d s para volver a lanzar %s.", math.ceil(event.cooldown - (os.clock() - last)), event.name)
	end
	lastLaunch[id] = os.clock()
	apply(id, player.DisplayName)
	publish({ kind = "event", id = id, by = player.DisplayName })
	return true, string.format("%s %s lanzado en todos los servidores.", event.icon, event.name)
end

local function filterBroadcast(player, text)
	local ok, result = pcall(function()
		local filtered = TextService:FilterStringAsync(text, player.UserId, Enum.TextFilterContext.PublicChat)
		return filtered:GetNonChatStringForBroadcastAsync()
	end)
	return ok and result or nil
end

function AdminService.Announce(player, payload)
	if not AdminService.IsAdmin(player) then
		return false, "Solo los admins pueden enviar anuncios."
	end
	local text = type(payload) == "table" and payload.text
	if type(text) ~= "string" then
		return false, "Escribe un mensaje."
	end
	text = text:gsub("[%c]", " "):gsub("^%s+", ""):gsub("%s+$", "")
	local length = utf8.len(text)
	if not length or length == 0 or length > AdminConfig.ANNOUNCE_MAX_LENGTH then
		return false, string.format("El anuncio debe tener entre 1 y %d caracteres.", AdminConfig.ANNOUNCE_MAX_LENGTH)
	end
	if os.clock() - lastAnnounce < 10 then
		return false, "Espera unos segundos entre anuncios."
	end
	local filtered = filterBroadcast(player, text)
	if not filtered then
		return false, "Roblox no pudo revisar el mensaje. Inténtalo de nuevo."
	end
	lastAnnounce = os.clock()
	notifyRemote:FireAllClients("admin", { icon = "📢", text = filtered, by = player.DisplayName })
	publish({ kind = "announce", text = filtered, by = player.DisplayName })
	return true, "Anuncio enviado a todos los servidores."
end

-- Estado para el panel (solo se envía a los admins).
function AdminService.BuildState(player)
	if not AdminService.IsAdmin(player) then
		return nil
	end
	local events = {}
	for _, event in ipairs(AdminConfig.Events) do
		local last = lastLaunch[event.id]
		table.insert(events, {
			id = event.id, icon = event.icon, name = event.name, minutes = event.minutes,
			activeUntil = activeUntil[event.id],
			cooldownLeft = last and math.max(0, math.ceil(event.cooldown - (os.clock() - last))) or 0,
		})
	end
	return { events = events, maxAnnounce = AdminConfig.ANNOUNCE_MAX_LENGTH }
end

function AdminService.PlayerAdded(player)
	admins[player] = computeIsAdmin(player)
end

function AdminService.PlayerRemoving(player)
	admins[player] = nil
end

function AdminService.Start()
	coinFolder = Instance.new("Folder")
	coinFolder.Name = "AdminCoins"
	coinFolder.Parent = Workspace
	task.spawn(function()
		local ok, err = pcall(function()
			MessagingService:SubscribeAsync(AdminConfig.MESSAGING_TOPIC, function(message)
				local data = type(message) == "table" and message.Data
				if type(data) ~= "table" or data.server == game.JobId then
					return
				end
				local by = type(data.by) == "string" and data.by or "Admin"
				if data.kind == "event" and type(data.id) == "string" then
					apply(data.id, by)
				elseif data.kind == "announce" and type(data.text) == "string" then
					notifyRemote:FireAllClients("admin", { icon = "📢", text = data.text, by = by })
				end
			end)
		end)
		if not ok then
			warn("[AdminService] Sin eventos entre servidores (MessagingService): ", err)
		end
	end)
end

return AdminService
