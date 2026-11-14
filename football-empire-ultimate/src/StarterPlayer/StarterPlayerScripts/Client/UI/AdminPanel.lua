-- AdminPanel (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/AdminPanel
--
-- * Panel «🛡️ ADMIN» (solo aparece si el SERVIDOR dice que eres admin): lanza eventos
--   «admin abuse» y anuncios. Cada botón es solo una petición: el servidor vuelve a comprobarlo todo.
-- * Cartel de eventos activos para TODOS los jugadores (lee los atributos que pone el servidor).
-- * Aviso grande cuando llega un evento o un anuncio.

local Workspace = game:GetService("Workspace")

local AdminPanel = {}

local C, Theme, act
local toggleButton, panel, list, announceBox
local eventsBar, eventsLabel
local bigBanner, bigText
local adminState = nil

local function formatLeft(seconds)
	seconds = math.max(0, seconds)
	return string.format("%d:%02d", math.floor(seconds / 60), seconds % 60)
end

local function renderPanel()
	if not panel then
		return
	end
	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("GuiObject") then
			child:Destroy()
		end
	end
	if not adminState then
		return
	end
	for i, event in ipairs(adminState.events) do
		local active = event.activeUntil and event.activeUntil > os.time()
		local label = string.format("%s %s (%d min)%s", event.icon, event.name, event.minutes,
			active and " · ACTIVO" or (event.cooldownLeft > 0 and string.format(" · espera %d s", event.cooldownLeft) or ""))
		local button = C.Button(label, active and "secondary" or "gold", function()
			task.spawn(act, "AdminEvent", { id = event.id })
		end, { Size = UDim2.new(1, 0, 0, 36), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14, LayoutOrder = i })
		button.Parent = list
	end
end

function AdminPanel.Update(state)
	adminState = state and state.admin or nil
	if toggleButton then
		toggleButton.Visible = adminState ~= nil
		if not adminState then
			panel.Visible = false
		end
	end
	renderPanel()
end

function AdminPanel.ShowEvent(info)
	if type(info) ~= "table" or type(info.text) ~= "string" then
		return
	end
	bigText.Text = string.format("%s %s\n<font size='16'>— %s</font>", info.icon or "📢", info.text, type(info.by) == "string" and info.by or "Admin")
	bigBanner.Visible = true
	local shownAt = os.clock()
	bigBanner:SetAttribute("ShownAt", shownAt)
	task.delay(6, function()
		if bigBanner:GetAttribute("ShownAt") == shownAt then
			bigBanner.Visible = false
		end
	end)
end

function AdminPanel.Init(gui, deps)
	C, Theme, act = deps.C, deps.Theme, deps.act

	-- Cartel de eventos activos (todos los jugadores)
	eventsBar = C.New("Frame", {
		Name = "AdminEvents",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -64),
		Size = UDim2.fromOffset(0, 30),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = Color3.fromRGB(120, 30, 160),
		BackgroundTransparency = 0.1,
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 2, 0.2), C.Padding(4, 12) },
	}, gui)
	eventsLabel = C.New("TextLabel", {
		Size = UDim2.fromScale(0, 1), AutomaticSize = Enum.AutomaticSize.X, BackgroundTransparency = 1,
		Font = Theme.FontBold, TextSize = 15, TextColor3 = Color3.new(1, 1, 1),
	}, eventsBar)

	bigBanner = C.New("Frame", {
		Name = "AdminBanner",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.24),
		Size = UDim2.fromOffset(620, 110),
		BackgroundColor3 = Color3.fromRGB(110, 20, 150),
		Visible = false,
		ZIndex = 40,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 3, 0), C.Padding(8, 14) },
	}, gui)
	bigText = C.New("TextLabel", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, RichText = true, TextWrapped = true, ZIndex = 41,
		Font = Theme.FontBlack, TextSize = 26, TextColor3 = Color3.new(1, 1, 1), TextStrokeTransparency = 0.4,
	}, bigBanner)

	-- Botón y panel de admin (ocultos hasta que el servidor confirme)
	toggleButton = C.New("TextButton", {
		Name = "AdminButton",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 16, 0.5, 0),
		Size = UDim2.fromOffset(96, 40),
		BackgroundColor3 = Color3.fromRGB(110, 20, 150),
		Text = "🛡️ ADMIN",
		Font = Theme.FontBold,
		TextSize = 15,
		TextColor3 = Color3.new(1, 1, 1),
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 2, 0.3) },
	}, gui)
	panel = C.New("Frame", {
		Name = "AdminPanel",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 120, 0.5, 0),
		Size = UDim2.fromOffset(320, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Panel,
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 2, 0.3), C.Padding(10), C.List(nil, 8) },
	}, gui)
	C.Title("🛡️ Admin abuse", 20).Parent = panel
	C.Label("Los eventos llegan a todos los servidores.", { TextSize = 12, TextColor3 = Theme.TextDim, LayoutOrder = 1 }).Parent = panel
	list = C.New("Frame", {
		LayoutOrder = 2, BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
		Children = { C.List(nil, 6) },
	}, panel)
	announceBox = C.New("TextBox", {
		LayoutOrder = 3,
		PlaceholderText = "📢 Anuncio para todos…",
		Text = "",
		ClearTextOnFocus = false,
		Font = Theme.Font,
		TextSize = 14,
		TextColor3 = Theme.Text,
		PlaceholderColor3 = Theme.TextMuted,
		BackgroundColor3 = Theme.CardAlt,
		Size = UDim2.new(1, 0, 0, 34),
		TextXAlignment = Enum.TextXAlignment.Left,
		Children = { C.Corner(Theme.RadiusSmall), C.Padding(2, 8) },
	}, panel)
	local send = C.Button("Enviar anuncio", "primary", function()
		local text = announceBox.Text
		task.spawn(function()
			local result = act("AdminAnnounce", { text = text })
			if result and result.ok then
				announceBox.Text = ""
			end
		end)
	end, { Size = UDim2.new(1, 0, 0, 34), AutomaticSize = Enum.AutomaticSize.None, LayoutOrder = 4 })
	send.Parent = panel
	toggleButton.Activated:Connect(function()
		panel.Visible = not panel.Visible
		renderPanel()
	end)

	-- Cartel de eventos activos: se actualiza cada segundo con el tiempo restante
	task.spawn(function()
		local names = {
			double = "💰 Recompensas x2", speed = "⚡ Supervelocidad", coinrain = "🪙 Lluvia de monedas", goldball = "🏆 Balón de oro",
		}
		while true do
			local parts = {}
			for id, name in pairs(names) do
				local endsAt = Workspace:GetAttribute("FEU_Event_" .. id)
				if type(endsAt) == "number" and endsAt > os.time() then
					table.insert(parts, name .. " " .. formatLeft(endsAt - os.time()))
				end
			end
			table.sort(parts)
			eventsBar.Visible = #parts > 0
			eventsLabel.Text = "🔥 ADMIN ABUSE: " .. table.concat(parts, "  ·  ")
			task.wait(1)
		end
	end)
end

return AdminPanel
