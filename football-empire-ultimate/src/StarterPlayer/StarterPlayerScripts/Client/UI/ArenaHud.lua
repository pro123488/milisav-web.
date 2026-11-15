-- ArenaHud (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/ArenaHud
--
-- Interfaz de los PARTIDOS EN GRUPO:
--   * Botón «⚽ JUGAR PARTIDO» / salir de la cola / abandonar.
--   * Cola con cuenta atrás, marcador, tiempo y equipos.
--   * CHUT: mantener clic izquierdo (PC), gatillo R2 (mando) o el botón «CHUTAR» (móvil) para cargar
--     la potencia y soltar para chutar. El balón sale hacia donde apunta la cámara.
--   * PASE: tecla E (PC), botón X (mando) o el botón «PASE» (móvil): el servidor busca al compañero
--     mejor colocado en esa dirección. El servidor decide si el chut o el pase valen.
--   * Sonidos: silbato en cada saque y al final, y público en los goles.
--   * Carteles de gol y de resultado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared.Modules.Remotes)
local SoundConfig = require(Shared.Config.SoundConfig)

local ArenaHud = {}

local CHARGE_SECONDS = 0.8
local TEAM_COLORS = { red = Color3.fromRGB(230, 70, 70), blue = Color3.fromRGB(60, 130, 245) }
local TEAM_NAMES = { red = "ROJO", blue = "AZUL" }

local arenaRemote
local C, Theme, act, Format
local state = { phase = "idle", role = "none" }
local joinButton, queueLabel, scoreFrame, scoreLabel, timeLabel, teamsLabel, banner, bannerText
local powerFrame, powerFill, kickButton, passButton
local chargingSince = nil
local whistleSound, cheerSound
local watchButton, countLabel, confettiLayer
local watching = false
local countToken = 0
local CONFETTI_COLORS = {
	Color3.fromRGB(255, 80, 80), Color3.fromRGB(255, 210, 60), Color3.fromRGB(80, 220, 120),
	Color3.fromRGB(80, 160, 255), Color3.fromRGB(220, 120, 255), Color3.fromRGB(255, 255, 255),
}

-- Cuenta atrás 3, 2, 1 antes de cada saque
local function countdown()
	countToken += 1
	local token = countToken
	task.spawn(function()
		for number = 3, 1, -1 do
			if token ~= countToken then
				return
			end
			countLabel.Text = tostring(number)
			countLabel.Visible = true
			task.wait(1)
		end
		if token == countToken then
			countLabel.Text = "¡YA!"
			task.wait(0.6)
			if token == countToken then
				countLabel.Visible = false
			end
		end
	end)
end

-- Confeti en pantalla al marcar un gol
local function confetti()
	for _ = 1, 40 do
		local size = math.random(8, 15)
		local piece = Instance.new("Frame")
		piece.Size = UDim2.fromOffset(size, size)
		piece.Position = UDim2.new(math.random(), 0, 0, -20)
		piece.BackgroundColor3 = CONFETTI_COLORS[math.random(1, #CONFETTI_COLORS)]
		piece.BorderSizePixel = 0
		piece.Rotation = math.random(0, 360)
		piece.Parent = confettiLayer
		local seconds = 1.5 + math.random() * 1.3
		local tween = TweenService:Create(piece, TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Position = UDim2.new(piece.Position.X.Scale + (math.random() - 0.5) * 0.2, 0, 1, 40),
			Rotation = piece.Rotation + math.random(-360, 360),
		})
		tween:Play()
		task.delay(seconds + 0.1, function()
			piece:Destroy()
		end)
	end
end

local function makeSound(id, volume)
	local sound = Instance.new("Sound")
	sound.SoundId = "rbxassetid://" .. id
	sound.Volume = volume
	sound.Parent = SoundService
	return sound
end

local function playCheer()
	cheerSound.TimePosition = 0
	cheerSound.Volume = 0.7
	cheerSound:Play()
	local startedAt = os.clock()
	cheerSound:SetAttribute("StartedAt", startedAt)
	task.delay(SoundConfig.CROWD_SECONDS, function()
		if cheerSound:GetAttribute("StartedAt") == startedAt then
			cheerSound:Stop()
		end
	end)
end

-- Dirección horizontal de la cámara: hacia ahí salen el chut y el pase.
local function aim()
	local camera = Workspace.CurrentCamera
	return camera and camera.CFrame.LookVector or Vector3.new(0, 0, -1)
end

local function formatTime(seconds)
	return string.format("%d:%02d", math.floor(seconds / 60), seconds % 60)
end

local function showBanner(text, color, seconds)
	bannerText.Text = text
	banner.BackgroundColor3 = color or Theme.Panel
	banner.Visible = true
	local shownAt = os.clock()
	banner:SetAttribute("ShownAt", shownAt)
	task.delay(seconds or 3, function()
		if banner:GetAttribute("ShownAt") == shownAt then
			banner.Visible = false
		end
	end)
end

local penalty = nil -- { shot, shots, goals } mientras tiras penaltis en la plaza

local function canKick()
	return (state.role == "playing" and state.phase == "playing") or penalty ~= nil
end

local function startCharge()
	if canKick() and not chargingSince then
		chargingSince = os.clock()
	end
end

local function releaseCharge()
	if not chargingSince then
		return
	end
	local power = math.clamp((os.clock() - chargingSince) / CHARGE_SECONDS, 0, 1)
	chargingSince = nil
	if canKick() then
		arenaRemote:FireServer("kick", power, aim())
	end
end

local function pass()
	if canKick() then
		chargingSince = nil
		arenaRemote:FireServer("pass", aim())
	end
end

local function refresh()
	local playing = state.role == "playing"
	local queued = state.role == "queued"
	-- Botón principal
	if playing then
		joinButton.Text = "🏳️ Abandonar"
		joinButton.BackgroundColor3 = Color3.fromRGB(120, 40, 40)
		joinButton.Size = UDim2.fromOffset(130, 38)
	elseif queued then
		joinButton.Text = "❌ Salir de la cola"
		joinButton.BackgroundColor3 = Color3.fromRGB(90, 60, 30)
		joinButton.Size = UDim2.fromOffset(170, 46)
	else
		joinButton.Text = "⚽ JUGAR PARTIDO"
		joinButton.BackgroundColor3 = Color3.fromRGB(30, 170, 90)
		joinButton.Size = UDim2.fromOffset(190, 52)
	end
	-- Cola (o, si estás en la tanda de penaltis, su marcador)
	if penalty then
		queueLabel.Text = string.format("⚽ Penalti %d de %d · goles: %d", penalty.shot, penalty.shots, penalty.goals)
		queueLabel.Visible = true
	elseif queued then
		local countdown = state.countdown and string.format(" · empieza en %d s", state.countdown) or " · esperando a que acabe el partido actual"
		queueLabel.Text = string.format("⏳ En cola: %d jugador%s%s", state.queue, state.queue == 1 and "" or "es", countdown)
		queueLabel.Visible = true
	elseif not playing and (state.queue or 0) > 0 and state.phase == "countdown" then
		queueLabel.Text = string.format("⚽ %d jugador%s en la cola · ¡únete!", state.queue, state.queue == 1 and "" or "es")
		queueLabel.Visible = true
	else
		queueLabel.Visible = false
	end
	-- Marcador
	scoreFrame.Visible = playing
	if playing and state.score then
		scoreLabel.Text = string.format("<font color='#FF7B7B'>ROJO %d</font>  -  <font color='#7BB0FF'>%d AZUL</font>%s",
			state.score.red, state.score.blue, state.goldBall and "  🏆" or "")
		local phaseText = state.phase == "kickoff" and " · ¡prepárate!" or (state.phase == "goal" and " · ¡GOL!" or "")
		if state.goldenGoal then
			phaseText = " · ⚡ GOL DE ORO" .. phaseText
		end
		timeLabel.Text = "⏱ " .. formatTime(state.timeLeft or 0) .. phaseText
		local team = state.team
		if team and state.teams then
			teamsLabel.Text = string.format("Tu equipo: <font color='%s'><b>%s</b></font> · %s", team == "red" and "#FF7B7B" or "#7BB0FF",
				TEAM_NAMES[team], table.concat(state.teams[team] or {}, ", "))
		end
	end
	if kickButton then
		kickButton.Visible = playing or penalty ~= nil
		passButton.Visible = playing
	end
	-- Espectador: ver el partido desde la grada (y volver)
	local matchOn = state.phase == "kickoff" or state.phase == "playing" or state.phase == "goal"
	if playing then
		watching = false
	end
	watchButton.Visible = not playing and (watching or matchOn)
	watchButton.Text = watching and "🏠 Volver a mi estadio" or "👀 Ver el partido"
end

function ArenaHud.Init(gui, deps)
	C, Theme, act, Format = deps.C, deps.Theme, deps.act, deps.Format
	arenaRemote = Remotes.Get("Arena")

	-- En móvil va a la derecha, a media altura, para no tapar el botón de saltar de Roblox
	local touch = UserInputService.TouchEnabled
	joinButton = C.New("TextButton", {
		Name = "ArenaButton",
		AnchorPoint = touch and Vector2.new(1, 0.5) or Vector2.new(1, 1),
		Position = touch and UDim2.new(1, -16, 0.42, 0) or UDim2.new(1, -16, 1, -16),
		Size = UDim2.fromOffset(190, 52),
		BackgroundColor3 = Color3.fromRGB(30, 170, 90),
		Text = "⚽ JUGAR PARTIDO",
		Font = Theme.FontBold,
		TextSize = 17,
		TextColor3 = Color3.new(1, 1, 1),
		Children = { C.Corner(), C.Stroke(Color3.new(1, 1, 1), 2, 0.5) },
	}, gui)
	joinButton.Activated:Connect(function()
		if state.role == "none" then
			task.spawn(act, "JoinArena")
		else
			task.spawn(act, "LeaveArena")
		end
	end)

	watchButton = C.New("TextButton", {
		Name = "WatchButton",
		AnchorPoint = touch and Vector2.new(1, 0) or Vector2.new(1, 1),
		Position = touch and UDim2.new(1, -16, 0.42, 70) or UDim2.new(1, -16, 1, -112),
		Size = UDim2.fromOffset(190, 34),
		BackgroundColor3 = Color3.fromRGB(40, 60, 110),
		Text = "👀 Ver el partido",
		Font = Theme.FontBold,
		TextSize = 14,
		TextColor3 = Color3.new(1, 1, 1),
		Visible = false,
		Children = { C.Corner(), C.Stroke(Color3.new(1, 1, 1), 1, 0.6) },
	}, gui)
	watchButton.Activated:Connect(function()
		task.spawn(function()
			local result = act(watching and "TeleportHome" or "WatchArena")
			if result and result.ok then
				watching = not watching
				refresh()
			end
		end)
	end)
	countLabel = C.New("TextLabel", {
		Name = "Countdown",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Size = UDim2.fromOffset(260, 120),
		BackgroundTransparency = 1,
		Text = "",
		Font = Theme.FontBlack,
		TextSize = 96,
		TextColor3 = Color3.new(1, 1, 1),
		TextStrokeTransparency = 0.2,
		Visible = false,
	}, gui)
	confettiLayer = C.New("Frame", {
		Name = "Confetti",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ClipsDescendants = true,
		ZIndex = 30,
	}, gui)

	queueLabel = C.New("TextLabel", {
		AnchorPoint = touch and Vector2.new(1, 0) or Vector2.new(1, 1),
		Position = touch and UDim2.new(1, -16, 0.42, 34) or UDim2.new(1, -16, 1, -76),
		Size = UDim2.fromOffset(340, 30),
		BackgroundColor3 = Color3.fromRGB(15, 20, 32),
		BackgroundTransparency = 0.2,
		Font = Theme.FontBold,
		TextSize = 14,
		TextColor3 = Color3.new(1, 1, 1),
		Visible = false,
		Children = { C.Corner(), C.Padding(4, 10) },
	}, gui)

	scoreFrame = C.New("Frame", {
		Name = "Scoreboard",
		Position = UDim2.fromOffset(16, 64), -- arriba a la izquierda: el centro es para los avisos
		Size = UDim2.fromOffset(380, 92),
		BackgroundColor3 = Color3.fromRGB(12, 16, 28),
		BackgroundTransparency = 0.15,
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 2, 0.3), C.Padding(6, 10) },
	}, gui)
	scoreLabel = C.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 34), BackgroundTransparency = 1, RichText = true,
		Font = Theme.FontBlack or Theme.FontBold, TextSize = 28, TextColor3 = Color3.new(1, 1, 1),
	}, scoreFrame)
	timeLabel = C.New("TextLabel", {
		Position = UDim2.fromOffset(0, 36), Size = UDim2.new(1, 0, 0, 20), BackgroundTransparency = 1,
		Font = Theme.FontBold, TextSize = 16, TextColor3 = Theme.Gold,
	}, scoreFrame)
	teamsLabel = C.New("TextLabel", {
		Position = UDim2.fromOffset(0, 58), Size = UDim2.new(1, 0, 0, 18), BackgroundTransparency = 1, RichText = true,
		Font = Theme.Font, TextSize = 12, TextColor3 = Theme.TextDim, TextTruncate = Enum.TextTruncate.AtEnd,
	}, scoreFrame)

	banner = C.New("Frame", {
		Name = "ArenaBanner",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.36),
		Size = UDim2.fromOffset(520, 96),
		Visible = false,
		Children = { C.Corner(), C.Stroke(Color3.new(1, 1, 1), 3, 0.2), C.Padding(8, 14) },
	}, gui)
	bannerText = C.New("TextLabel", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, RichText = true, TextWrapped = true,
		Font = Theme.FontBlack or Theme.FontBold, TextSize = 30, TextColor3 = Color3.new(1, 1, 1),
		TextStrokeTransparency = 0.5,
	}, banner)

	-- Barra de potencia del chut
	powerFrame = C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -44),
		Size = UDim2.fromOffset(260, 14),
		BackgroundColor3 = Color3.fromRGB(20, 24, 34),
		Visible = false,
		Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Color3.new(1, 1, 1), 1, 0.5) },
	}, gui)
	powerFill = C.New("Frame", {
		Size = UDim2.fromScale(0, 1),
		BackgroundColor3 = Color3.fromRGB(255, 200, 40),
		Children = { C.Corner(UDim.new(1, 0)) },
	}, powerFrame)

	if UserInputService.TouchEnabled then
		kickButton = C.New("TextButton", {
			Name = "KickButton",
			AnchorPoint = Vector2.new(1, 1),
			Position = UDim2.new(1, -40, 1, -240),
			Size = UDim2.fromOffset(96, 96),
			BackgroundColor3 = Color3.fromRGB(240, 170, 30),
			BackgroundTransparency = 0.1,
			Text = "⚽\nCHUTAR",
			Font = Theme.FontBold,
			TextSize = 15,
			TextColor3 = Color3.new(1, 1, 1),
			Visible = false,
			Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Color3.new(1, 1, 1), 2, 0.3) },
		}, gui)
		kickButton.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
				startCharge()
			end
		end)
		kickButton.InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
				releaseCharge()
			end
		end)
		passButton = C.New("TextButton", {
			Name = "PassButton",
			AnchorPoint = Vector2.new(1, 1),
			Position = UDim2.new(1, -150, 1, -250),
			Size = UDim2.fromOffset(78, 78),
			BackgroundColor3 = Color3.fromRGB(40, 170, 100),
			BackgroundTransparency = 0.1,
			Text = "🤝\nPASE",
			Font = Theme.FontBold,
			TextSize = 14,
			TextColor3 = Color3.new(1, 1, 1),
			Visible = false,
			Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Color3.new(1, 1, 1), 2, 0.3) },
		}, gui)
		passButton.Activated:Connect(pass)
	end
	whistleSound = makeSound(SoundConfig.WHISTLE, 0.6)
	cheerSound = makeSound(SoundConfig.CROWD_CHEER, 0.7)

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonR2 then
			startCharge()
		elseif input.KeyCode == Enum.KeyCode.E or input.KeyCode == Enum.KeyCode.ButtonX then
			pass()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonR2 then
			releaseCharge()
		end
	end)
	RunService.RenderStepped:Connect(function()
		if chargingSince and canKick() then
			powerFrame.Visible = true
			powerFill.Size = UDim2.fromScale(math.clamp((os.clock() - chargingSince) / CHARGE_SECONDS, 0, 1), 1)
		else
			powerFrame.Visible = false
			if chargingSince and not canKick() then
				chargingSince = nil
			end
		end
	end)

	arenaRemote.OnClientEvent:Connect(function(kind, data)
		if type(data) ~= "table" then
			return
		end
		if kind == "state" then
			-- Silbato cuando el balón se pone en juego
			if data.role == "playing" and state.phase == "kickoff" and data.phase == "playing" then
				whistleSound:Play()
			end
			if data.role == "playing" and data.phase == "kickoff" and state.phase ~= "kickoff" then
				countdown()
			elseif data.phase ~= "kickoff" and data.phase ~= "playing" and countLabel.Visible then
				countToken += 1 -- el partido se ha parado: se quita la cuenta atrás
				countLabel.Visible = false
			end
			state = data
			refresh()
		elseif kind == "joined" then
			showBanner(string.format("%s · equipo <font color='%s'>%s</font>\nClic: chutar · E: pase · Shift: esprintar",
				type(data.theme) == "string" and data.theme or "⚽ ¡A jugar!", data.team == "red" and "#FF9B9B" or "#9BC4FF",
				TEAM_NAMES[data.team] or "?"), Color3.fromRGB(20, 60, 40), 4)
		elseif kind == "goal" then
			local who = data.scorer and (data.ownGoal and ("en propia de " .. data.scorer) or data.scorer) or ""
			showBanner(string.format("⚽ ¡GOOOOL DEL %s!\n%s", TEAM_NAMES[data.team] or "?", who), TEAM_COLORS[data.team], 3)
			playCheer()
			confetti()
		elseif kind == "penalty" then
			penalty = data.active and { shot = data.shot or 1, shots = data.shots or 5, goals = data.goals or 0 } or nil
			if data.finished then
				local text = string.format("⚽ Tanda terminada: %d de %d", data.goals, data.shots)
				if data.reward and data.reward > 0 then
					text ..= "\n+" .. Format.Money(data.reward)
				elseif data.cooldown then
					text ..= string.format("\nPróximo premio en %d min", math.ceil(data.cooldown / 60))
				end
				whistleSound:Play()
				showBanner(text, data.goals == data.shots and Color3.fromRGB(150, 110, 10) or Color3.fromRGB(40, 50, 70), 4)
			end
			refresh()
		elseif kind == "penaltyshot" then
			if data.result == "goal" then
				showBanner(string.format("⚽ ¡GOOOL! (%d de %d)", data.goals, data.shot), Color3.fromRGB(30, 140, 70), 1.6)
				playCheer()
				confetti()
			elseif data.result == "saved" then
				showBanner("🧤 ¡PARADÓN del portero!", Color3.fromRGB(120, 40, 40), 1.6)
			elseif data.result == "timeout" then
				showBanner("⏱ Se acabó el tiempo para tirar", Color3.fromRGB(70, 60, 40), 1.6)
			else
				showBanner("❌ ¡Fuera!", Color3.fromRGB(80, 50, 50), 1.6)
			end
		elseif kind == "powerup" then
			local color = data.team == "red" and Color3.fromRGB(150, 50, 50) or Color3.fromRGB(40, 80, 160)
			showBanner(string.format("%s %s coge %s\n%s", data.icon or "⚡", data.player or "?", data.name or "", data.text or ""), color, 2)
		elseif kind == "goldengoal" then
			showBanner("⚡ ¡GOL DE ORO!\nEmpate: el primer gol gana", Color3.fromRGB(150, 110, 10), 3)
		elseif kind == "result" then
			local title = data.result == "win" and "🏆 ¡VICTORIA!" or (data.result == "draw" and "🤝 EMPATE" or "😓 DERROTA")
			local reward = data.capped and "Límite de recompensas por hora alcanzado"
				or ("+" .. Format.Money(data.reward) .. (data.goals > 0 and string.format(" · %d gol%s tuyo%s", data.goals, data.goals == 1 and "" or "es", data.goals == 1 and "" or "s") or ""))
			if (data.petBonus or 0) > 0 and not data.capped then
				reward ..= string.format(" · 🐾 +%d%%", math.floor(data.petBonus * 100 + 0.5))
			end
			if data.isMvp then
				reward ..= " · ⭐ ¡ERES EL MVP!"
			elseif data.mvp then
				reward ..= " · ⭐ MVP: " .. data.mvp
			end
			whistleSound:Play()
			showBanner(string.format("%s  %d - %d\n%s", title, data.score.red, data.score.blue, reward),
				data.result == "win" and Color3.fromRGB(150, 110, 10) or Color3.fromRGB(40, 50, 70), 6)
		end
	end)
	refresh()
end

return ArenaHud
