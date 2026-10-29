-- Main (LocalScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Main
--
-- Interfaz principal: barra superior, menú principal adaptable (PC / móvil / tableta),
-- pantallas y notificaciones. El cliente SOLO muestra datos y envía intenciones;
-- el servidor valida todo y responde con el estado real.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local MenuConfig = require(Shared.Config.MenuConfig)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Modules.Remotes)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)

local UI = script.Parent:WaitForChild("UI")
local Theme = require(UI.Theme)
local C = require(UI.Components)
local Notifier = require(UI.Notifier)

local ScreensFolder = script.Parent:WaitForChild("Screens")
local Screens = {
	home = require(ScreensFolder.Home),
	club = require(ScreensFolder.Club),
	stadium = require(ScreensFolder.Stadium),
	build = require(ScreensFolder.Build),
	economy = require(ScreensFolder.Economy),
	shop = require(ScreensFolder.Shop),
	settings = require(ScreensFolder.Settings),
	squad = require(ScreensFolder.Squad),
	academy = require(ScreensFolder.Academy),
	matches = require(ScreensFolder.Matches),
	transfers = require(ScreensFolder.Transfers),
	leagues = require(ScreensFolder.Leagues),
	universe = require(ScreensFolder.Universe),
	history = require(ScreensFolder.History),
}
local ComingSoon = require(ScreensFolder.ComingSoon)
local PlacementController = require(script.Parent:WaitForChild("Controllers"):WaitForChild("PlacementController"))

local actionRemote = Remotes.Get("Action")
local stateRemote = Remotes.Get("State")
local notifyRemote = Remotes.Get("Notify")
local shopRemote = Remotes.Get("Shop")

-- ===== Estado del cliente =====
local ctx = {
	state = nil,
	shop = nil,
	stateReceivedAt = os.clock(),
	drafts = {},
	params = {},
	current = "home",
	compact = false,
	C = C,
	Theme = Theme,
	Format = Format,
}

local gui, panel, content, navFrame, topBar, uiScale, countdownLabel
local panelOpen = false -- se empieza jugando en el estadio; el menú se abre con M o el botón MENÚ

local function notify(kind, message)
	if ctx.state and ctx.state.settings and ctx.state.settings.notifications == false and kind == "success" then
		return
	end
	Notifier.Show(kind, message)
end
ctx.notify = notify

function ctx.act(actionName, payload)
	local ok, result = pcall(function()
		return actionRemote:InvokeServer(actionName, payload)
	end)
	if not ok or type(result) ~= "table" then
		Notifier.Show("error", "No hay conexión con el servidor. Inténtalo de nuevo.")
		return { ok = false }
	end
	if result.message then
		Notifier.Show(result.ok and "success" or "error", result.message)
	end
	return result
end

local renderCurrent -- declarada más abajo
local buildTopBar -- declarada más abajo

function ctx.navigate(screenId, params)
	ctx.current = screenId
	ctx.params = params or {}
	if not panelOpen then
		panelOpen = true
		panel.Visible = true
	end
	renderCurrent(false)
end

function ctx.close()
	panelOpen = false
	panel.Visible = false
end

-- Modo construcción: cierra el menú, coloca en el mundo y vuelve a Construcción › Decoración.
function ctx.startPlacement(opts)
	ctx.close()
	buildTopBar()
	local started = PlacementController.Start(ctx, {
		decoId = opts.decoId,
		moveIndex = opts.moveIndex,
		onFinish = function()
			ctx.navigate("build", { tab = "decor" })
			buildTopBar()
		end,
	})
	if not started then
		ctx.navigate("build", { tab = "decor" })
	end
end

function ctx.secondsToNextCycle()
	if not ctx.state then
		return 0
	end
	local elapsed = os.clock() - ctx.stateReceivedAt
	local remaining = ctx.state.economy.nextCycleIn - elapsed
	local cycle = ctx.state.economy.cycleSeconds
	while remaining < 0 do
		remaining += cycle
	end
	return remaining
end

-- ===== Barra superior =====
buildTopBar = function()
	if topBar then
		topBar:Destroy()
	end
	local state = ctx.state
	topBar = C.New("Frame", {
		Name = "TopBar",
		BackgroundColor3 = Theme.Background,
		BackgroundTransparency = 0.1,
		Size = UDim2.new(1, 0, 0, 56),
		BorderSizePixel = 0,
		Children = { C.Padding(8, 12), C.Stroke(Theme.Stroke, 1, 0.5) },
	}, gui)
	local row = C.New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, -110, 1, 0),
		Children = {
			C.New("UIListLayout", {
				FillDirection = Enum.FillDirection.Horizontal,
				Padding = UDim.new(0, 14),
				VerticalAlignment = Enum.VerticalAlignment.Center,
				SortOrder = Enum.SortOrder.LayoutOrder,
			}),
		},
	}, topBar)
	local add = C.Stack(row)

	if state then
		local crest = CosmeticConfig.ById.crest[state.club.effectiveAppearance.crest]
		add(C.Label((crest and crest.symbol or "⚽") .. "  " .. state.club.name, {
			Font = Theme.FontBlack, TextSize = 18, Size = UDim2.new(0, 0, 1, 0),
			AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false, Visible = not ctx.compact,
		}))
		if state.premium.owned.VIP_CLUB then
			add(C.Badge("👑 VIP", Theme.Gold, Color3.fromRGB(35, 25, 0)))
		end
		local function stat(text, color)
			return C.Label(text, {
				Font = Theme.FontBold, TextSize = 16, TextColor3 = color or Theme.Text,
				Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false,
			})
		end
		add(stat("💰 " .. Format.Money(state.economy.money), Theme.Gold))
		if state.economy.debt > 0 then
			add(stat("📉 " .. Format.Money(state.economy.debt), Theme.Danger))
		end
		if not ctx.compact then
			add(stat("👥 " .. Format.Short(state.club.fans)))
			add(stat("⭐ " .. tostring(state.economy.reputation)))
			add(stat("😊 " .. tostring(math.floor((state.club.satisfaction or 0) + 0.5))))
		end
		countdownLabel = add(stat("⏱️ --:--", Theme.TextDim))
		if state.halloween and state.halloween.active then
			add(stat("🍬 " .. tostring(state.halloween.candy), Color3.fromRGB(255, 150, 40)))
		end
		if not state.saveEnabled then
			add(C.Badge("⚠️ Sin guardado", Theme.Warning, Color3.fromRGB(40, 20, 0)))
		end
	else
		add(C.Label("⚽ " .. GameConfig.GAME_NAME .. " · Cargando tu club…", {
			Font = Theme.FontBlack, TextSize = 18, Size = UDim2.new(0, 0, 1, 0),
			AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false,
		}))
	end

	C.Button(panelOpen and "✕ MENÚ" or "☰ MENÚ", "primary", function()
		panelOpen = not panelOpen
		panel.Visible = panelOpen
		buildTopBar()
		if panelOpen then
			renderCurrent(false)
		end
	end, {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.new(0, 100, 0, 40),
		AutomaticSize = Enum.AutomaticSize.None,
	}).Parent = topBar
end

-- ===== Menú principal =====
local function buildNav()
	navFrame:ClearAllChildren()
	local horizontal = ctx.compact
	local iconsOnly = (not horizontal) and ctx.state and ctx.state.settings.compactMenu
	C.New("UIListLayout", {
		FillDirection = horizontal and Enum.FillDirection.Horizontal or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, 4),
		SortOrder = Enum.SortOrder.LayoutOrder,
	}, navFrame)
	C.Padding(6).Parent = navFrame
	for i, entry in ipairs(MenuConfig) do
		local available = entry.phase <= MenuConfig.CURRENT_PHASE
		local selected = ctx.current == entry.id
		local text
		if horizontal then
			text = entry.icon .. "\n" .. entry.label
		elseif iconsOnly then
			text = entry.icon
		else
			text = entry.icon .. "  " .. entry.label .. (available and "" or ("  · F" .. entry.phase))
		end
		local button = C.New("TextButton", {
			LayoutOrder = i,
			Text = text,
			Font = selected and Theme.FontBold or Theme.Font,
			TextSize = horizontal and 12 or 15,
			TextColor3 = available and Theme.Text or Theme.TextMuted,
			TextXAlignment = (horizontal or iconsOnly) and Enum.TextXAlignment.Center or Enum.TextXAlignment.Left,
			BackgroundColor3 = selected and Theme.AccentDark or (entry.highlight and Color3.fromRGB(60, 45, 10) or Theme.Panel),
			BackgroundTransparency = selected and 0 or (available and 0.2 or 0.6),
			Size = horizontal and UDim2.new(0, 84, 1, -12) or UDim2.new(1, 0, 0, 38),
			BorderSizePixel = 0,
			Children = { C.Corner(Theme.RadiusSmall), C.Padding(4, 10) },
		}, navFrame)
		if entry.highlight then
			C.Stroke(Theme.Gold, 1, 0.3).Parent = button
		end
		button.Activated:Connect(function()
			ctx.navigate(entry.id)
		end)
	end
end

-- ===== Panel principal =====
local function buildShell()
	if panel then
		panel:Destroy()
	end
	local viewport = Workspace.CurrentCamera.ViewportSize
	ctx.compact = viewport.X < 900
	local userScale = (ctx.state and ctx.state.settings.uiScale) or 1
	uiScale.Scale = math.clamp(math.min(viewport.X / 1280, viewport.Y / 720) * 1.15, 0.6, 1.1) * userScale
	-- En pantallas pequeñas trabajamos con el espacio "sin escalar"
	local navWidth = (ctx.state and ctx.state.settings.compactMenu) and 64 or 200

	panel = C.New("Frame", {
		Name = "Panel",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 64),
		Size = UDim2.new(1, -16, 1, -72),
		BackgroundColor3 = Theme.Background,
		BackgroundTransparency = 0.04,
		Visible = panelOpen,
		BorderSizePixel = 0,
		Children = {
			C.Corner(UDim.new(0, 14)),
			C.Stroke(Theme.Stroke, 1),
			C.New("UISizeConstraint", { MaxSize = Vector2.new(1180, 760) }),
		},
	}, gui)

	if ctx.compact then
		navFrame = C.New("ScrollingFrame", {
			Name = "Nav",
			BackgroundColor3 = Theme.Panel,
			BorderSizePixel = 0,
			AnchorPoint = Vector2.new(0, 1),
			Position = UDim2.new(0, 0, 1, 0),
			Size = UDim2.new(1, 0, 0, 70),
			CanvasSize = UDim2.new(),
			AutomaticCanvasSize = Enum.AutomaticSize.X,
			ScrollingDirection = Enum.ScrollingDirection.X,
			ScrollBarThickness = 3,
			Children = { C.Corner(UDim.new(0, 14)) },
		}, panel)
		content = C.New("Frame", {
			Name = "Content",
			BackgroundTransparency = 1,
			Position = UDim2.new(0, 10, 0, 10),
			Size = UDim2.new(1, -20, 1, -90),
			ClipsDescendants = true,
		}, panel)
	else
		navFrame = C.New("ScrollingFrame", {
			Name = "Nav",
			BackgroundColor3 = Theme.Panel,
			BorderSizePixel = 0,
			Size = UDim2.new(0, navWidth, 1, 0),
			CanvasSize = UDim2.new(),
			AutomaticCanvasSize = Enum.AutomaticSize.Y,
			ScrollBarThickness = 3,
			Children = { C.Corner(UDim.new(0, 14)) },
		}, panel)
		content = C.New("Frame", {
			Name = "Content",
			BackgroundTransparency = 1,
			Position = UDim2.new(0, navWidth + 14, 0, 12),
			Size = UDim2.new(1, -(navWidth + 26), 1, -24),
			ClipsDescendants = true,
		}, panel)
	end
	buildNav()
end

local lastRendered
renderCurrent = function(keepScroll)
	if not content or not panelOpen then
		return
	end
	local previousScroll
	local oldScroll = content:FindFirstChild("Scroll", true)
	if keepScroll and lastRendered == ctx.current and oldScroll then
		previousScroll = oldScroll.CanvasPosition
	end
	content:ClearAllChildren()
	buildNav()

	if not ctx.state then
		C.Label("Cargando tu club…", { Font = Theme.FontBold, TextSize = 20 }).Parent = content
		return
	end

	local screen = Screens[ctx.current]
	local ok, err = pcall(function()
		if screen then
			screen.Render(content, ctx)
		else
			ComingSoon.Render(content, ctx)
		end
	end)
	if not ok then
		warn("[UI] Error mostrando la pantalla ", ctx.current, ": ", err)
		C.Label("⚠️ No se pudo mostrar esta pantalla.", { TextColor3 = Theme.Danger }).Parent = content
	end
	lastRendered = ctx.current
	if previousScroll then
		local newScroll = content:FindFirstChild("Scroll", true)
		if newScroll then
			task.defer(function()
				newScroll.CanvasPosition = previousScroll
			end)
		end
	end
end

-- ===== Inicialización =====
gui = C.New("ScreenGui", {
	Name = "FEU_UI",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	IgnoreGuiInset = false,
}, player:WaitForChild("PlayerGui"))
uiScale = C.New("UIScale", {}, gui)
Notifier.Init(gui)
buildShell()
buildTopBar()
renderCurrent(false)

stateRemote.OnClientEvent:Connect(function(state)
	local firstState = ctx.state == nil
	if firstState then
		task.delay(2, function()
			Notifier.Show("info", "🏟️ ¡Bienvenido a tu estadio! Camina, chuta el balón y acércate a los edificios (tecla E). Pulsa M o MENÚ para gestionar tu club.", 8)
		end)
	end
	local layoutChanged = ctx.state == nil
		or ctx.state.settings.compactMenu ~= state.settings.compactMenu
		or ctx.state.settings.uiScale ~= state.settings.uiScale
	ctx.state = state
	ctx.stateReceivedAt = os.clock()
	if layoutChanged then
		buildShell()
	end
	buildTopBar()
	-- No se reconstruye la pantalla mientras el jugador escribe en un cuadro de texto.
	if not UserInputService:GetFocusedTextBox() then
		renderCurrent(not firstState)
	end
end)

shopRemote.OnClientEvent:Connect(function(shop)
	ctx.shop = shop
	ctx.pendingPurchase = nil -- cualquier cambio de estado cierra la espera de compra
	if ctx.current == "shop" and not UserInputService:GetFocusedTextBox() then
		renderCurrent(true)
	end
end)

-- Efectos visuales de los «trucos» del evento de Halloween (solo en este cliente)
local function playTrick(info)
	if info.id == "scare" then
		local scare = C.New("TextLabel", {
			Size = UDim2.fromScale(1, 1),
			BackgroundColor3 = Color3.new(0, 0, 0),
			BackgroundTransparency = 0.2,
			Text = "👻",
			TextScaled = true,
			ZIndex = 100,
		}, gui)
		task.delay(1.2, function()
			scare:Destroy()
		end)
	elseif info.id == "fog" then
		local Lighting = game:GetService("Lighting")
		local fogEnd, fogColor = Lighting.FogEnd, Lighting.FogColor
		Lighting.FogColor = Color3.fromRGB(60, 50, 80)
		Lighting.FogEnd = 45
		task.delay(info.seconds or 10, function()
			Lighting.FogEnd = fogEnd
			Lighting.FogColor = fogColor
		end)
	end
end

notifyRemote.OnClientEvent:Connect(function(kind, message)
	if kind == "open" and type(message) == "table" then
		-- Indicación (tecla E) en una instalación del propio estadio
		ctx.navigate(message.screen, message.params)
		buildTopBar()
		return
	elseif kind == "candy" and type(message) == "table" then
		if ctx.state and ctx.state.halloween then
			ctx.state.halloween.candy = message.candy
			buildTopBar()
		end
		Notifier.Show("success", string.format("%s +%d 🍬 (tienes %d)", message.treat and "🎃 ¡Trato!" or "🍬", message.gained, message.candy), 2)
		return
	elseif kind == "trick" and type(message) == "table" then
		Notifier.Show("warning", message.text or "¡Truco!")
		playTrick(message)
		return
	end
	if kind == "match" and type(message) == "table" then
		-- Resumen de un partido de liga o copa: se guarda para verlo en Partidos
		ctx.lastMatch = message
		Notifier.Show("info", "Partido simulado disponible en Partidos › Ver último partido.")
		return
	end
	notify(kind, message)
end)

Workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
	local wasCompact = ctx.compact
	local viewport = Workspace.CurrentCamera.ViewportSize
	if (viewport.X < 900) ~= wasCompact then
		buildShell()
		buildTopBar()
		renderCurrent(false)
	else
		local userScale = (ctx.state and ctx.state.settings.uiScale) or 1
		uiScale.Scale = math.clamp(math.min(viewport.X / 1280, viewport.Y / 720) * 1.15, 0.6, 1.1) * userScale
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.M and not PlacementController.Active then
		panelOpen = not panelOpen
		panel.Visible = panelOpen
		buildTopBar()
		if panelOpen then
			renderCurrent(false)
		end
	end
end)

-- Cuenta atrás de la próxima jornada
task.spawn(function()
	while true do
		task.wait(1)
		if ctx.state and countdownLabel and countdownLabel.Parent then
			countdownLabel.Text = "⏱️ " .. Format.Duration(ctx.secondsToNextCycle())
		end
	end
end)

-- Pedimos el estado por si el servidor lo envió antes de conectar los eventos.
task.spawn(function()
	while not ctx.state do
		local ok, result = pcall(function()
			return actionRemote:InvokeServer("GetState")
		end)
		if ok and type(result) == "table" and result.ok then
			break
		end
		task.wait(2)
	end
	pcall(function()
		actionRemote:InvokeServer("RefreshShop")
	end)
end)
