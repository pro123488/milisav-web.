-- Main (Script de servidor)
-- Ubicación: ServerScriptService/Server/Main
--
-- Arranque del servidor y enrutado de acciones del cliente.
-- Toda acción pasa por: límite de frecuencia -> datos cargados -> validación del
-- servicio correspondiente -> envío del estado actualizado al jugador.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local StadiumStages = require(Shared.Config.StadiumStages)
local MenuConfig = require(Shared.Config.MenuConfig)
local SeasonConfig = require(Shared.Config.SeasonConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)
local StadiumPieces = require(Shared.Config.StadiumPieces)
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
local MatchService = require(Services.MatchService)
local TransferService = require(Services.TransferService)
local LeagueService = require(Services.LeagueService)
local UniverseService = require(Services.UniverseService)
local HistoryService = require(Services.HistoryService)
local InteractionService = require(Services.InteractionService)
local HalloweenService = require(Services.HalloweenService)
local NetworkService = require(Services.NetworkService)
local TournamentService = require(Services.TournamentService)
local CommunityService = require(Services.CommunityService)
local MissionService = require(Services.MissionService)
local PlotService = require(Services.PlotService)
local AdminService = require(Services.AdminService)
local PetService = require(Services.PetService)
local OutfitService = require(Services.OutfitService)
local SeasonService = require(Services.SeasonService)
local RewardService = require(Services.RewardService)
local TutorialService = require(Services.TutorialService)
local RebirthService = require(Services.RebirthService)
local TrophyService = require(Services.TrophyService)
local LeaderboardService = require(Services.LeaderboardService)
local HubService = require(Services.HubService)
local ArenaService = require(Services.ArenaService)
local PenaltyService = require(Services.PenaltyService)
local RateLimiter = require(script.Parent.Util.RateLimiter)
local SelfTest = require(script.Parent.Tests.SelfTest)
local selfTestStarted = false

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
			pieces = data.stadium.pieces, -- construcción libre
			freeBuild = data.stadium.freeBuild,
			maxPieces = StadiumPieces.MAX_PIECES,
			decorationVisible = BuildService.DecorationVisibility(player, data), -- lista de booleanos
			maxDecorations = BuildService.MaxDecorations(player, data),
			tools = BuildService.Tools(player), -- rejilla y paso de rotación permitidos
			plotIndex = plot and plot.index or nil,
		},
		history = data.history,
		sponsors = data.sponsors,
		football = SquadService.BuildState(data), -- plantilla, cantera, temporada, leyendas (FASE 4)
		matchday = MatchService.BuildState(data), -- tácticas, amistosos, historial, récords (FASE 5)
		league = LeagueService.BuildState(data, ClubService.DisplayName(data), ClubService.ShortName(data)), -- ligas, copa y carrera (FASE 7)
		universe = UniverseService.BuildState(player, data), -- universo futbolístico (FASE 8)
		clubHistory = HistoryService.BuildState(data), -- historia del club (FASE 8)
		halloween = HalloweenService.BuildState(data), -- evento «Doces ou Travessuras»
		network = NetworkService.BuildState(player, data), -- red de clubes (FASE 9)
		tournament = TournamentService.BuildState(player),
		community = CommunityService.BuildState(player),
		missions = MissionService.BuildState(data), -- misiones y logros (FASE 10)
		unlocks = data.unlocks,
		transfers = TransferService.BuildState(data, function(p) -- mercado, ofertas y presupuesto (FASE 6)
			return SquadService.PublicPlayer(p, data.academy.scouts)
		end),
		economy = EconomyService.Summary(player, data),
		admin = AdminService.BuildState(player), -- solo para admins (eventos «admin abuse»)
		collection = PetService.BuildState(data), -- mascotas y balones coleccionables
		outfits = OutfitService.BuildState(data), -- trajes de futbolista
		season = SeasonService.BuildState(data), -- pase de temporada
		weekly = WeeklyConfig.Current(), -- bonus y estadio destacado de la semana
		rewards = RewardService.BuildState(data), -- recompensa diaria con racha
		playtime = RewardService.PlaytimeState(player), -- regalos por jugar (esta sesión)
		tutorial = TutorialService.BuildState(data), -- primeros pasos guiados
		rebirth = RebirthService.BuildState(data), -- renacimientos
		trophies = TrophyService.BuildState(data), -- camino de trofeos
		premium = {
			owned = GamePassService.OwnedList(player),
		},
		stats = data.stats,
		settings = data.settings,
	}
end

-- Tabla de líderes de Roblox (arriba a la derecha): goles y victorias en partidos en grupo, y dinero.
local LEADERSTATS = {
	{ name = "🏆 Trofeos", value = function(data) return data.arena.trophies end },
	{ name = "⚽ Goles", value = function(data) return data.stats.arenaGoals end },
	{ name = "🔄 Renac.", value = function(data) return data.rebirth.count end },
	{ name = "💰 Dinero", value = function(data) return math.floor(data.economy.money) end },
}

local function updateLeaderstats(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local folder = player:FindFirstChild("leaderstats")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "leaderstats"
		for _, stat in ipairs(LEADERSTATS) do
			local value = Instance.new("IntValue")
			value.Name = stat.name
			value.Parent = folder
		end
		folder.Parent = player
	end
	for _, stat in ipairs(LEADERSTATS) do
		local value = folder:FindFirstChild(stat.name)
		if value then
			value.Value = stat.value(data)
		end
	end
end

-- FASE 12 · Envío incremental: solo viajan las secciones de primer nivel que han cambiado
-- desde el último envío. El primero (y tras GetState) es siempre completo.
local lastSent = {} -- [player] = { [sección] = JSON enviado }

local function pushState(player)
	if not player.Parent then
		return
	end
	TutorialService.Check(player) -- premia los pasos de la guía que se acaben de completar
	local state = buildState(player)
	if not state then
		return
	end
	updateLeaderstats(player)
	local previous = lastSent[player]
	local signatures, delta, changed = {}, { _partial = true }, false
	for section, value in pairs(state) do
		local ok, encoded = pcall(HttpService.JSONEncode, HttpService, value)
		signatures[section] = ok and encoded or "?"
		if not previous or not ok or previous[section] ~= encoded then
			delta[section] = value
			changed = true
		end
	end
	if previous then
		-- Secciones que han dejado de existir (p. ej. el torneo terminó)
		for section in pairs(previous) do
			if state[section] == nil then
				delta._removed = delta._removed or {}
				table.insert(delta._removed, section)
				changed = true
			end
		end
	end
	lastSent[player] = signatures
	if not previous then
		stateRemote:FireClient(player, state)
	elseif changed then
		stateRemote:FireClient(player, delta)
	end
end

-- ===== Acciones =====
-- Cada manejador devuelve ok, mensaje, necesitaReconstruirEstadio

local Actions = {}

Actions.GetState = function(player)
	lastSent[player] = nil -- el siguiente envío será completo
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

-- ===== Partidos y tácticas (FASE 5) =====
Actions.SetFormation = function(player, payload)
	return MatchService.SetFormation(player, payload)
end

Actions.SetTactic = function(player, payload)
	return MatchService.SetTactic(player, payload)
end

Actions.SetLineupSlot = function(player, payload)
	return MatchService.SetLineupSlot(player, payload)
end

Actions.AutoLineup = function(player)
	return MatchService.AutoLineupAction(player)
end

Actions.PlayFriendly = function(player, payload)
	local data = DataService.Get(player)
	local ok, msg, result = MatchService.PlayFriendly(player, payload, ClubService.DisplayName(data), ClubService.ShortName(data))
	if ok then
		for _, message in ipairs(result.messages) do
			notifyRemote:FireClient(player, "warning", message)
		end
	end
	return ok, msg, ok, result -- el 4.º valor viaja al cliente como "data" (resumen del partido)
end

-- ===== Mercado de fichajes (FASE 6) =====
Actions.BuyPlayer = function(player, payload)
	return TransferService.Buy(player, payload)
end

Actions.SetTransferListing = function(player, payload)
	return TransferService.SetListing(player, payload)
end

Actions.AcceptTransferOffer = function(player, payload)
	return TransferService.AcceptOffer(player, payload)
end

Actions.RejectTransferOffer = function(player, payload)
	return TransferService.RejectOffer(player, payload)
end

Actions.SetTransferBudget = function(player, payload)
	return TransferService.SetBudgetShare(player, payload)
end

-- ===== Misiones y logros (FASE 10) =====
Actions.ClaimDailyMission = function(player, payload)
	return MissionService.ClaimDaily(player, payload)
end

Actions.ClaimChainMission = function(player, payload)
	return MissionService.ClaimChain(player, payload)
end

-- Acciones que cuentan para las misiones cuando salen bien
local ACTION_METRICS = {
	UpgradeFacility = "build",
	PlaceDecoration = "decorate",
	PlacePiece = "decorate",
	AcceptSponsor = "sponsor",
	PromoteYouth = "promote",
	BuyPlayer = "sign",
	UpgradeStage = "stage",
	PlayFriendly = "friendly",
	ChallengeClub = "challenge",
}

-- Acciones que dan puntos del pase de temporada cuando terminan bien (clave de SeasonConfig.XP)
local ACTION_XP = {
	ClaimDailyMission = "dailyMission",
	ClaimChainMission = "chainMission",
	HatchEgg = "hatch",
	OpenBallCrate = "crate",
}

-- ===== Red de clubes (FASE 9) =====
Actions.InviteMatch = function(player, payload)
	return NetworkService.Invite(player, payload)
end

Actions.RespondInvite = function(player, payload)
	local ok, msg = NetworkService.RespondInvite(player, payload)
	return ok, msg, ok
end

Actions.ChallengeClub = function(player, payload)
	local ok, msg, result = NetworkService.Challenge(player, payload)
	return ok, msg, ok, result
end

Actions.CompareClub = function(player, payload)
	local ok, msg, comparison = NetworkService.Compare(player, payload)
	return ok, msg, false, comparison
end

Actions.RefreshFriends = function(player)
	task.spawn(NetworkService.RefreshFriends, player)
	return true, "Actualizando la lista de amigos…"
end

Actions.CreateTournament = function(player, payload)
	return TournamentService.Create(player, payload)
end

Actions.JoinTournament = function(player)
	return TournamentService.Join(player)
end

-- ===== Evento de Halloween =====
Actions.HalloweenExchange = function(player, payload)
	local ok, msg = HalloweenService.Exchange(player, payload)
	return ok, msg, ok
end

-- ===== Universo (FASE 8) =====
Actions.VisitClub = function(player, payload)
	return UniverseService.Visit(player, payload, PlotService)
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
	if type(payload.music) == "boolean" then
		settings.music = payload.music
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

-- ===== Construcción libre del estadio =====
Actions.PlacePiece = function(player, payload)
	return BuildService.PlacePiece(player, payload)
end

Actions.MovePiece = function(player, payload)
	return BuildService.MovePiece(player, payload)
end

Actions.RemovePiece = function(player, payload)
	return BuildService.RemovePiece(player, payload)
end

Actions.SetFreeBuild = function(player, payload)
	return BuildService.SetFreeBuild(player, payload)
end

-- ===== Mascotas y balones coleccionables =====
Actions.HatchEgg = function(player, payload)
	return PetService.Hatch(player, payload)
end

Actions.OpenBallCrate = function(player, payload)
	return PetService.OpenCrate(player, payload)
end

Actions.EquipPet = function(player, payload)
	return PetService.EquipPet(player, payload)
end

Actions.SellPet = function(player, payload)
	return PetService.SellPet(player, payload)
end

Actions.FusePet = function(player, payload)
	return PetService.Fuse(player, payload)
end

Actions.SellDuplicatePets = function(player)
	return PetService.SellDuplicates(player)
end

Actions.ClaimPetIndex = function(player, payload)
	return PetService.ClaimIndex(player, payload)
end

Actions.EquipBall = function(player, payload)
	return PetService.EquipBall(player, payload)
end

-- ===== Trajes de futbolista =====
Actions.BuyOutfit = function(player, payload)
	return OutfitService.Buy(player, payload)
end

Actions.EquipOutfit = function(player, payload)
	return OutfitService.Equip(player, payload)
end

Actions.SetDorsal = function(player, payload)
	return OutfitService.SetDorsal(player, payload)
end

-- ===== Pase de temporada =====
Actions.ClaimPassReward = function(player, payload)
	return SeasonService.Claim(player, payload)
end

Actions.ClaimPassAll = function(player)
	return SeasonService.ClaimAll(player)
end

Actions.BuySeasonPass = function(player)
	return SeasonService.RequestPremium(player)
end

-- ===== Partidos en grupo =====
Actions.JoinArena = function(player)
	return ArenaService.Join(player)
end

Actions.WatchArena = function(player)
	return ArenaService.Watch(player)
end

-- ===== Camino de trofeos =====
Actions.ClaimTrophyReward = function(player, payload)
	return TrophyService.Claim(player, payload)
end

-- ===== Renacimientos =====
Actions.Rebirth = function(player, payload)
	local ok, message, rerender = RebirthService.Rebirth(player, payload)
	if ok then
		PlotService.RefreshNameTag(player)
	end
	return ok, message, rerender
end

-- ===== Recompensa diaria y códigos de regalo =====
Actions.ClaimDaily = function(player)
	return RewardService.ClaimDaily(player)
end

Actions.ClaimPlaytime = function(player)
	return RewardService.ClaimPlaytime(player)
end

Actions.SpinWheel = function(player)
	return RewardService.Spin(player)
end

Actions.RedeemCode = function(player, payload)
	return RewardService.RedeemCode(player, payload)
end

Actions.LeaveArena = function(player)
	return ArenaService.Leave(player)
end

-- ===== Eventos «admin abuse» (el servicio comprueba que el jugador es admin) =====
Actions.AdminEvent = function(player, payload)
	return AdminService.Launch(player, payload)
end

Actions.AdminAnnounce = function(player, payload)
	return AdminService.Announce(player, payload)
end

Actions.RecheckPasses = function(player)
	return GamePassService.Recheck(player)
end

Actions.SetNickname = function(player, payload)
	return SquadService.SetNickname(player, payload)
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
	local success, ok, message, rerender, extra = pcall(Actions[actionName], player, payload)
	busy[player] = nil
	if not success then
		warn("[Main] Error en la acción ", actionName, " de ", player.Name, ": ", ok)
		return { ok = false, message = "Error del servidor. Inténtalo de nuevo." }
	end
	if rerender then
		PlotService.RequestRender(player)
	end
	if ok == true and ACTION_METRICS[actionName] then
		MissionService.Track(player, ACTION_METRICS[actionName], 1)
	end
	if ok == true and actionName == "HatchEgg" then
		MissionService.Track(player, "hatch", type(payload) == "table" and payload.amount == 3 and 3 or 1)
	end
	if ok == true and ACTION_XP[actionName] then
		SeasonService.AddXP(player, SeasonConfig.XP[ACTION_XP[actionName]])
	end
	if ok == true then
		MissionService.EvaluateAchievements(player)
	end
	pushState(player)
	return { ok = ok == true, message = message, data = extra }
end

-- ===== Ciclo de vida de los jugadores =====

local function onPlayerAdded(player)
	PlotService.Assign(player)
	GamePassService.PlayerAdded(player)
	task.spawn(AdminService.PlayerAdded, player)
	player.CharacterAdded:Connect(function()
		-- En pleno partido en grupo se reaparece en el campo, no en el estadio propio
		if not ArenaService.HandleRespawn(player) then
			PlotService.CharacterAdded(player)
		end
		task.spawn(OutfitService.CharacterAdded, player) -- vuelve a ponerse su traje de futbolista
		PetService.CharacterAdded(player) -- las mascotas equipadas vuelven a seguir al personaje nuevo
	end)

	local data = DataService.Load(player)
	if not data or not player.Parent then
		return
	end
	if not PlotService.GetPlot(player) then
		notifyRemote:FireClient(player, "error", "El servidor está lleno de estadios. Tu club funciona, pero tu estadio no se mostrará en este servidor.")
	end
	SquadService.EnsureSquad(data)
	MatchService.PlayerReady(player)
	TransferService.PlayerReady(player)
	LeagueService.PlayerReady(player)
	UniverseService.PlayerReady(player)
	NetworkService.PlayerReady(player)
	task.spawn(function()
		local rewardMessage = UniverseService.ClaimWeekly(player)
		if rewardMessage then
			notifyRemote:FireClient(player, "success", rewardMessage)
			pushState(player)
		end
	end)
	EconomyService.PlayerReady(player)
	SponsorService.PlayerReady(player)
	PlotService.Render(player)
	InteractionService.SetBallSkin(PlotService.GetPlot(player), data.collection.ball)
	if player.Character then
		PlotService.TeleportHome(player)
		task.spawn(PetService.CharacterAdded, player)
		task.spawn(OutfitService.CharacterAdded, player)
	end
	SeasonService.DailyLogin(player)
	RewardService.PlayerReady(player)
	-- Autoprueba (solo en Studio, una vez por sesión): informe en la ventana Output
	if RunService:IsStudio() and not selfTestStarted then
		selfTestStarted = true
		task.delay(3, function()
			local ok, err = pcall(SelfTest.Run, player)
			if not ok then
				warn("[AUTOPRUEBA] ❌ La autoprueba se detuvo: ", err)
			end
		end)
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
	lastSent[player] = nil
	UniverseService.PlayerRemoving(player) -- último perfil público antes de liberar los datos
	HalloweenService.PlayerRemoving(player)
	NetworkService.PlayerRemoving(player)
	ArenaService.PlayerRemoving(player)
	LeaderboardService.PlayerRemoving(player) -- guarda sus goles antes de liberar los datos
	AdminService.PlayerRemoving(player)
	PetService.PlayerRemoving(player)
	RewardService.PlayerRemoving(player)
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
	-- Liga y copa ANTES de que SquadService avance el reloj de la temporada
	local clubData = DataService.Get(player)
	if clubData then
		local leagueOut = LeagueService.AfterCycle(player, ClubService.DisplayName(clubData), ClubService.ShortName(clubData))
		for _, message in ipairs(leagueOut.messages) do
			notifyRemote:FireClient(player, "info", message)
		end
		UniverseService.AddWeeklyPoints(player, leagueOut.points)
		if leagueOut.result then
			notifyRemote:FireClient(player, "match", leagueOut.result) -- resumen para el visor de partidos
			PlotService.RequestRender(player) -- marcador y sala de trofeos
		end
	end
	for _, message in ipairs(SquadService.AfterCycle(player)) do
		notifyRemote:FireClient(player, "info", message)
	end
	for _, message in ipairs(TransferService.AfterCycle(player)) do -- después de SquadService (fin de cesiones)
		notifyRemote:FireClient(player, "info", message)
	end
	for _, message in ipairs(MatchService.AfterCycle(player)) do
		notifyRemote:FireClient(player, "info", message)
	end
	HistoryService.AfterCycle(player)
	MissionService.Track(player, "cycles", 1)
	SeasonService.AddXP(player, SeasonConfig.XP.cycle)
	MissionService.EvaluateAchievements(player)
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
UniverseService.Start()
InteractionService.OnFacility(HalloweenService.AttachDoor)
InteractionService.Start()
TournamentService.Start()
CommunityService.Start()
MatchService.OnUserMatch(function(player, _, goalsFor, goalsAgainst)
	MissionService.Track(player, "matches", 1)
	MissionService.Track(player, "goals", goalsFor)
	if goalsFor > goalsAgainst then
		MissionService.Track(player, "wins", 1)
	end
end)
HalloweenService.OnCandy(function(player, amount)
	MissionService.Track(player, "candy", amount)
end)
HalloweenService.Start()
ArenaService.OnMatchEnd(function(player, goals, teamGoals, otherGoals, result, isMvp)
	local trophyDelta = TrophyService.AfterMatch(player, result, goals, isMvp)
	if trophyDelta > 0 then
		MissionService.Track(player, "trophies", trophyDelta)
	end
	MissionService.Track(player, "arena", 1)
	PlotService.RefreshNameTag(player)
	MissionService.Track(player, "matches", 1)
	MissionService.Track(player, "goals", goals)
	if teamGoals > otherGoals then
		MissionService.Track(player, "wins", 1)
	end
	MissionService.EvaluateAchievements(player)
	local data = DataService.Get(player)
	if data then
		data.stats.arenaMatches += 1
		data.stats.arenaGoals += goals
		if teamGoals > otherGoals then
			data.stats.arenaWins += 1
		end
	end
	SeasonService.AddXP(player, SeasonConfig.XP.match + (teamGoals > otherGoals and SeasonConfig.XP.win or 0)
		+ math.min(goals, SeasonConfig.MAX_GOALS_XP) * SeasonConfig.XP.goal)
	LeaderboardService.Submit(player) -- clasificación mundial de goleadores
	pushState(player) -- dinero, misiones, pase y tabla de líderes al momento
end)
AdminService.Start()
HubService.Start()
LeaderboardService.OnUpdate(HubService.SetLeaderboard)
LeaderboardService.Start()
SeasonService.Start()
SeasonService.OnChanged(function(player)
	if DataService.Get(player) then
		pushState(player)
	end
end)
PetService.Start()
PetService.OnBallChanged(function(player, ballId)
	InteractionService.SetBallSkin(PlotService.GetPlot(player), ballId)
end)
ArenaService.Start()
PenaltyService.Init()

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
