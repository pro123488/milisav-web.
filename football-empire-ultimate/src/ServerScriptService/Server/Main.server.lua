-- Main (Script de servidor)
-- Ubicación: ServerScriptService/Server/Main
--
-- Arranque del servidor y enrutado de acciones del cliente.
-- Toda acción pasa por: límite de frecuencia -> datos cargados -> validación del
-- servicio correspondiente -> envío del estado actualizado al jugador.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local StadiumStages = require(Shared.Config.StadiumStages)
local MenuConfig = require(Shared.Config.MenuConfig)
local Remotes = require(Shared.Modules.Remotes)

local Services = script.Parent.Services
local DataService = require(Services.DataService)
local GamePassService = require(Services.GamePassService)
local ClubService = require(Services.ClubService)
local EconomyService = require(Services.EconomyService)
local BuildService = require(Services.BuildService)
local StadiumService = require(Services.StadiumService)
local SponsorService = require(Services.SponsorService)
local SquadService = require(Services.SquadService)
local PlotService = require(Services.PlotService)
local RateLimiter = require(script.Parent.Util.RateLimiter)

local actionRemote = Remotes.Get("Action")
local stateRemote = Remotes.Get("State")
local notifyRemote = Remotes.Get("Notify")

local limiter = RateLimiter.new(GameConfig.ACTION_RATE_LIMIT, GameConfig.ACTION_RATE_WINDOW)

-- ===== Estado que se envía al cliente (solo los datos del propio jugador) =====

local function buildState(player)
	local data = DataService.Get(player)
	if not data then
		return nil
	end
	local stage = StadiumStages.Get(data.stadium.stage)
	local plot = PlotService.GetPlot(player)
	return {
		version = GameConfig.VERSION,
		phase = MenuConfig.CURRENT_PHASE,
		saveEnabled = DataService.IsSaveEnabled(player),
		club = {
			name = ClubService.DisplayName(data),
			shortName = ClubService.ShortName(data),
			named = data.club.named,
			ownerName = player.DisplayName,
			founded = data.club.founded,
			fans = data.club.fans,
			members = data.club.members,
			satisfaction = data.club.satisfaction,
			appearance = data.club.appearance, -- selección guardada
			effectiveAppearance = ClubService.EffectiveAppearance(player, data), -- lo que se muestra
		},
		stadium = {
			stage = data.stadium.stage,
			stageName = stage.name,
			stageDescription = stage.description,
			maxStageThisPhase = StadiumStages.MAX_STAGE_THIS_PHASE,
			facilities = data.stadium.facilities,
			decorations = data.stadium.decorations, -- lista { id, x, z, r }
			decorationVisible = BuildService.DecorationVisibility(player, data), -- lista de booleanos
			maxDecorations = BuildService.MaxDecorations(player, data),
			tools = BuildService.Tools(player), -- rejilla y paso de rotación permitidos
			plotIndex = plot and plot.index or nil,
		},
		history = data.history,
		sponsors = data.sponsors,
		football = SquadService.BuildState(data), -- plantilla, cantera, temporada, leyendas (FASE 4)
		economy = EconomyService.Summary(player, data),
		premium = {
			owned = GamePassService.OwnedList(player),
		},
		stats = data.stats,
		settings = data.settings,
	}
end

local function pushState(player)
	if player.Parent then
		local state = buildState(player)
		if state then
			stateRemote:FireClient(player, state)
		end
	end
end

-- ===== Acciones =====
-- Cada manejador devuelve ok, mensaje, necesitaReconstruirEstadio

local Actions = {}

Actions.GetState = function(player)
	return true, nil, false
end

Actions.SetClubName = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local ok, msg = ClubService.SetName(player, payload.name, payload.shortName)
	return ok, msg, ok
end

Actions.SetAppearance = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local ok, msg = ClubService.SetAppearance(player, payload.slot, payload.id)
	return ok, msg, ok
end

Actions.UpgradeFacility = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local ok, msg = BuildService.Upgrade(player, payload.facility)
	return ok, msg, ok
end

Actions.PlaceDecoration = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local ok, msg = BuildService.PlaceDecoration(player, payload)
	return ok, msg, ok
end

Actions.MoveDecoration = function(player, payload)
	local ok, msg = BuildService.MoveDecoration(player, payload)
	return ok, msg, ok
end

Actions.RemoveDecoration = function(player, payload)
	local ok, msg = BuildService.RemoveDecoration(player, payload)
	return ok, msg, ok
end

Actions.UpgradeStage = function(player)
	local ok, msg = StadiumService.UpgradeStage(player)
	if ok then
		SponsorService.RefreshOffers(DataService.Get(player), false) -- nuevos huecos desbloqueados
	end
	return ok, msg, ok
end

-- ===== Plantilla y cantera (FASE 4) =====
Actions.SetTrainingIntensity = function(player, payload)
	return SquadService.SetIntensity(player, payload)
end

Actions.SetTrainingFocus = function(player, payload)
	return SquadService.SetFocus(player, payload)
end

Actions.RenewContract = function(player, payload)
	return SquadService.Renew(player, payload)
end

Actions.ReleasePlayer = function(player, payload)
	return SquadService.Release(player, payload)
end

Actions.PromoteYouth = function(player, payload)
	return SquadService.PromoteYouth(player, payload)
end

Actions.ReleaseYouth = function(player, payload)
	return SquadService.ReleaseYouth(player, payload)
end

Actions.SetScouts = function(player, payload)
	return SquadService.SetScouts(player, payload)
end

Actions.SignYouthReport = function(player, payload)
	return SquadService.SignReport(player, payload)
end

Actions.SetPricePolicy = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	return EconomyService.SetPricePolicy(player, payload.kind, payload.option)
end

Actions.AcceptSponsor = function(player, payload)
	local ok, msg = SponsorService.Accept(player, payload)
	return ok, msg, ok
end

Actions.TerminateSponsor = function(player, payload)
	local ok, msg = SponsorService.Terminate(player, payload)
	return ok, msg, ok
end

Actions.SetTicketPrice = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	return EconomyService.SetTicketPrice(player, payload.option)
end

Actions.RepayDebt = function(player, payload)
	local amount = type(payload) == "table" and payload.amount or 0
	return EconomyService.RepayDebt(player, amount)
end

Actions.TeleportHome = function(player)
	return PlotService.TeleportHome(player)
end

Actions.SaveSettings = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local settings = DataService.Get(player).settings
	if type(payload.notifications) == "boolean" then
		settings.notifications = payload.notifications
	end
	if type(payload.compactMenu) == "boolean" then
		settings.compactMenu = payload.compactMenu
	end
	if type(payload.uiScale) == "number" and payload.uiScale == payload.uiScale then
		settings.uiScale = math.clamp(payload.uiScale, 0.8, 1.3)
	end
	return true, "Configuración guardada."
end

Actions.SaveNow = function(player)
	if not DataService.IsSaveEnabled(player) then
		return false, "El guardado no está disponible en esta sesión."
	end
	local ok = DataService.Save(player, false)
	return ok, ok and "Partida guardada." or "No se pudo guardar. Se reintentará automáticamente."
end

Actions.PurchasePass = function(player, payload)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	return GamePassService.RequestPurchase(player, payload.pass)
end

Actions.RefreshShop = function(player)
	task.spawn(GamePassService.PushShop, player)
	return true
end

local busy = {} -- evita que un jugador ejecute dos acciones a la vez

actionRemote.OnServerInvoke = function(player, actionName, payload)
	if type(actionName) ~= "string" or not Actions[actionName] then
		return { ok = false, message = "Acción desconocida." }
	end
	if not limiter:Allow(player) then
		return { ok = false, message = "Vas demasiado rápido. Espera un momento." }
	end
	if not DataService.Get(player) then
		return { ok = false, message = "Tu club todavía se está cargando." }
	end
	if busy[player] then
		return { ok = false, message = "Procesando la acción anterior…" }
	end
	busy[player] = true
	local success, ok, message, rerender = pcall(Actions[actionName], player, payload)
	busy[player] = nil
	if not success then
		warn("[Main] Error en la acción ", actionName, " de ", player.Name, ": ", ok)
		return { ok = false, message = "Error del servidor. Inténtalo de nuevo." }
	end
	if rerender then
		PlotService.RequestRender(player)
	end
	pushState(player)
	return { ok = ok == true, message = message }
end

-- ===== Ciclo de vida de los jugadores =====

local function onPlayerAdded(player)
	PlotService.Assign(player)
	GamePassService.PlayerAdded(player)
	player.CharacterAdded:Connect(function()
		PlotService.CharacterAdded(player)
	end)

	local data = DataService.Load(player)
	if not data or not player.Parent then
		return
	end
	if not PlotService.GetPlot(player) then
		notifyRemote:FireClient(player, "error", "El servidor está lleno de estadios. Tu club funciona, pero tu estadio no se mostrará en este servidor.")
	end
	SquadService.EnsureSquad(data)
	EconomyService.PlayerReady(player)
	SponsorService.PlayerReady(player)
	PlotService.Render(player)
	if player.Character then
		PlotService.TeleportHome(player)
	end
	pushState(player)
	if not DataService.IsSaveEnabled(player) then
		notifyRemote:FireClient(player, "warning", "Guardado desactivado en esta sesión (DataStore no disponible). Tu progreso no se guardará.")
	end
	if DataService.IsNew(player) then
		notifyRemote:FireClient(player, "info", "¡Bienvenido, presidente! Ponle nombre a tu club en «Mi club».")
	end
end

local function onPlayerRemoving(player)
	EconomyService.PlayerRemoving(player)
	GamePassService.PlayerRemoving(player)
	limiter:Remove(player)
	busy[player] = nil
	DataService.Release(player)
	PlotService.Release(player)
end

-- Cuando cambia la propiedad de un pase: se reconstruye el estadio y se actualiza la interfaz.
GamePassService.OnOwnershipChanged(function(player)
	if DataService.Get(player) then
		PlotService.RequestRender(player)
		pushState(player)
	end
end)

GamePassService.OnPurchaseConfirmed(function(player, passKey)
	local data = DataService.Get(player)
	if data then
		-- Registro informativo; NUNCA se usa como prueba de propiedad.
		table.insert(data.premium.purchaseLog, { pass = passKey, t = os.time() })
		while #data.premium.purchaseLog > 20 do
			table.remove(data.premium.purchaseLog, 1)
		end
	end
end)

EconomyService.OnCycle(function(player, cycle)
	local sponsorMessages = SponsorService.AfterCycle(player)
	for _, message in ipairs(sponsorMessages) do
		notifyRemote:FireClient(player, "info", message)
	end
	if #sponsorMessages > 0 then
		PlotService.RequestRender(player) -- quita vallas o nombre del estadio caducados
	end
	for _, message in ipairs(SquadService.AfterCycle(player)) do
		notifyRemote:FireClient(player, "info", message)
	end
	PlotService.UpdateCrowd(player, cycle.occupancy)
	pushState(player)
	local data = DataService.Get(player)
	if data and data.settings.notifications then
		notifyRemote:FireClient(player, cycle.net >= 0 and "success" or "warning",
			string.format("Jornada: %d espectadores · balance %s%d %s", cycle.attendance,
				cycle.net >= 0 and "+" or "", cycle.net, GameConfig.CURRENCY))
	end
end)

-- ===== Arranque =====
PlotService.CreateWorld()
DataService.Start()
GamePassService.Start()
EconomyService.Start()

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

-- Envío periódico ligero del estado (cuenta atrás del ciclo, etc.)
task.spawn(function()
	while true do
		task.wait(15)
		for _, player in ipairs(Players:GetPlayers()) do
			pushState(player)
		end
	end
end)

print(string.format("[%s] Servidor iniciado · versión %s", GameConfig.GAME_NAME, GameConfig.VERSION))
