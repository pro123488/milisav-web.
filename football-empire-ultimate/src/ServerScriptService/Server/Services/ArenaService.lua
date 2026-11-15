-- ArenaService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/ArenaService
--
-- PARTIDOS EN GRUPO: fútbol jugable en tiempo real.
--   * Cola: botón «JUGAR PARTIDO» o la plataforma de la avenida (tecla E). Cuenta atrás y a jugar.
--   * Equipos Rojo y Azul repartidos al azar; los huecos se rellenan con bots.
--   * Balón controlado por el SERVIDOR: el cliente solo pide «chutar con esta fuerza»;
--     aquí se comprueba que está cerca del balón, en partido y sin abusar del botón.
--   * Goles, marcador, tiempo, celebración y recompensas en dinero del club (con límite por hora).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Teams = game:GetService("Teams")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Cfg = require(Shared.Config.ArenaConfig)
local SoundConfig = require(Shared.Config.SoundConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)
local RebirthConfig = require(Shared.Config.RebirthConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)
local AdminService = require(script.Parent.AdminService)
local PetService = require(script.Parent.PetService)
local SocialService = require(script.Parent.SocialService)
local BallSkin = require(script.Parent.Parent.Util.BallSkin)

local ArenaService = {}

local arenaRemote = Remotes.Get("Arena")
local notifyRemote = Remotes.Get("Notify")

local HALF_L = Cfg.FIELD_LENGTH / 2
local HALF_W = Cfg.FIELD_WIDTH / 2
local WHITE = Color3.fromRGB(245, 245, 245)

local folder -- Folder del estadio de partidos
local scoreboardLabel
local teamObjects = {} -- [teamId] = Team
local floorPart
local pitchParts = {} -- franjas del césped (para cambiar de estadio)
local lineParts = {}
local currentTheme = Cfg.Themes[1]
local ball
local kickSound
local rng = Random.new()

-- Estado del partido
local queue = {} -- lista de jugadores
local phase = "idle" -- idle | countdown | kickoff | playing | goal | result
local countdownEnds = 0
local remaining = 0
local goldenGoal = false -- prórroga a gol de oro tras un empate
local score = { red = 0, blue = 0 }
local participants = {} -- [player] = { team, goals }
local bots = {} -- lista { model, team, name, keeper, lastKick, slot }
local lastTouch = nil -- { name, team, player? }
local pendingGoal = nil -- equipo que ha marcado y aún no se ha celebrado
local lastResult = nil
local kickCooldown = {} -- [player] = os.clock()
local dribbleCooldown = {} -- [player] = os.clock()
local rewardLog = {} -- [userId] = { os.time() de partidos premiados }
local endCallbacks = {}
local kickFallback = nil
local powerUps = {} -- piezas de potenciador en el campo
local lastPowerUp = 0

local passBall, findMate, updatePowerUps -- definidas más abajo

local function teamInfo(id)
	return id == "red" and Cfg.TEAMS[1] or Cfg.TEAMS[2]
end

-- Rojo defiende la portería de -X y ataca hacia +X; Azul al revés.
local function defendSign(team)
	return team == "red" and -1 or 1
end

local function toWorld(x, y, z)
	return (Cfg.ORIGIN * CFrame.new(x, y, z)).Position
end

local function toLocal(position)
	return Cfg.ORIGIN:PointToObjectSpace(position)
end

-- ===== Construcción del estadio =====

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		if key ~= "Parent" then
			p[key] = value
		end
	end
	p.Parent = props.Parent or folder
	return p
end

local function line(x, z, sx, sz)
	table.insert(lineParts, part({ Name = "Line", Size = Vector3.new(sx, 0.06, sz), CFrame = Cfg.ORIGIN * CFrame.new(x, 0.03, z),
		Color = WHITE, Material = Enum.Material.SmoothPlastic, CanCollide = false, CanQuery = false }))
end

local function materialOf(name, fallback)
	local ok, value = pcall(function()
		return Enum.Material[name]
	end)
	return ok and value or fallback
end

-- Cambia el aspecto del estadio (césped, suelo y líneas). No toca medidas ni física.
local function applyTheme(theme)
	currentTheme = theme
	local pitchMaterial = materialOf(theme.pitchMaterial, Enum.Material.Grass)
	for i, stripe in ipairs(pitchParts) do
		stripe.Color = i % 2 == 1 and theme.pitchA or theme.pitchB
		stripe.Material = pitchMaterial
	end
	if floorPart then
		floorPart.Color = theme.floor
		floorPart.Material = materialOf(theme.floorMaterial, Enum.Material.Grass)
	end
	local lineMaterial = materialOf(theme.lineMaterial or "SmoothPlastic", Enum.Material.SmoothPlastic)
	for _, linePart in ipairs(lineParts) do
		linePart.Color = theme.line
		linePart.Material = lineMaterial
	end
end

-- El estadio destacado de la semana sale la mitad de las veces; el resto, uno al azar.
local function pickTheme()
	if rng:NextNumber() < Cfg.FEATURED_THEME_CHANCE then
		return Cfg.Theme(WeeklyConfig.Current().themeId)
	end
	return Cfg.Themes[rng:NextInteger(1, #Cfg.Themes)]
end

local function buildGoal(sign)
	local x = sign * (HALF_L + Cfg.GOAL_DEPTH / 2)
	local backX = sign * (HALF_L + Cfg.GOAL_DEPTH)
	local net = { Color = WHITE, Material = Enum.Material.ForceField, Transparency = 0.2 }
	local function netPart(name, size, cf)
		local p = part({ Name = name, Size = size, CFrame = cf, Color = net.Color, Material = net.Material, Transparency = net.Transparency })
		return p
	end
	netPart("NetBack", Vector3.new(0.5, Cfg.GOAL_HEIGHT, Cfg.GOAL_WIDTH), Cfg.ORIGIN * CFrame.new(backX, Cfg.GOAL_HEIGHT / 2, 0))
	netPart("NetTop", Vector3.new(Cfg.GOAL_DEPTH, 0.5, Cfg.GOAL_WIDTH), Cfg.ORIGIN * CFrame.new(x, Cfg.GOAL_HEIGHT, 0))
	for _, side in ipairs({ -1, 1 }) do
		netPart("NetSide", Vector3.new(Cfg.GOAL_DEPTH, Cfg.GOAL_HEIGHT, 0.5), Cfg.ORIGIN * CFrame.new(x, Cfg.GOAL_HEIGHT / 2, side * Cfg.GOAL_WIDTH / 2))
		part({ Name = "Post", Shape = Enum.PartType.Cylinder, Size = Vector3.new(Cfg.GOAL_HEIGHT, 1, 1),
			CFrame = Cfg.ORIGIN * CFrame.new(sign * HALF_L, Cfg.GOAL_HEIGHT / 2, side * Cfg.GOAL_WIDTH / 2) * CFrame.Angles(0, 0, math.pi / 2),
			Color = WHITE, Material = Enum.Material.SmoothPlastic })
	end
	part({ Name = "Crossbar", Shape = Enum.PartType.Cylinder, Size = Vector3.new(Cfg.GOAL_WIDTH + 1, 1, 1),
		CFrame = Cfg.ORIGIN * CFrame.new(sign * HALF_L, Cfg.GOAL_HEIGHT, 0) * CFrame.Angles(0, math.pi / 2, 0),
		Color = WHITE, Material = Enum.Material.SmoothPlastic })
	-- Suelo dentro de la portería
	part({ Name = "GoalFloor", Size = Vector3.new(Cfg.GOAL_DEPTH, 1, Cfg.GOAL_WIDTH), CFrame = Cfg.ORIGIN * CFrame.new(x, -0.5, 0),
		Color = Color3.fromRGB(60, 140, 60), Material = Enum.Material.Grass })
end

local function buildWalls()
	local glass = { Transparency = 0.85, Color = Color3.fromRGB(200, 230, 255), Material = Enum.Material.Glass }
	local h = Cfg.WALL_HEIGHT
	-- Laterales (a lo largo de X)
	for _, side in ipairs({ -1, 1 }) do
		part({ Name = "Wall", Size = Vector3.new(Cfg.FIELD_LENGTH + 2, h, 1), CFrame = Cfg.ORIGIN * CFrame.new(0, h / 2, side * (HALF_W + 0.5)),
			Transparency = glass.Transparency, Color = glass.Color, Material = glass.Material })
	end
	-- Fondos, con hueco para la portería
	local segment = HALF_W - Cfg.GOAL_WIDTH / 2
	for _, sign in ipairs({ -1, 1 }) do
		for _, side in ipairs({ -1, 1 }) do
			part({ Name = "Wall", Size = Vector3.new(1, h, segment), CFrame = Cfg.ORIGIN * CFrame.new(sign * (HALF_L + 0.5), h / 2, side * (Cfg.GOAL_WIDTH / 2 + segment / 2)),
				Transparency = glass.Transparency, Color = glass.Color, Material = glass.Material })
		end
		part({ Name = "Wall", Size = Vector3.new(1, h - Cfg.GOAL_HEIGHT, Cfg.GOAL_WIDTH), CFrame = Cfg.ORIGIN * CFrame.new(sign * (HALF_L + 0.5), Cfg.GOAL_HEIGHT + (h - Cfg.GOAL_HEIGHT) / 2, 0),
			Transparency = glass.Transparency, Color = glass.Color, Material = glass.Material })
	end
	-- Techo invisible: el balón nunca sale del campo
	part({ Name = "Ceiling", Size = Vector3.new(Cfg.FIELD_LENGTH + 2 * Cfg.GOAL_DEPTH + 4, 1, Cfg.FIELD_WIDTH + 4), CFrame = Cfg.ORIGIN * CFrame.new(0, h, 0),
		Transparency = 1, CanQuery = false })
end

local function buildStands()
	for _, side in ipairs({ -1, 1 }) do
		for row = 1, 6 do
			local team = side < 0 and Cfg.TEAMS[1] or Cfg.TEAMS[2]
			part({ Name = "Stand", Size = Vector3.new(Cfg.FIELD_LENGTH + 20, 2, 4),
				CFrame = Cfg.ORIGIN * CFrame.new(0, row * 2 - 1, side * (HALF_W + 4 + row * 4)),
				Color = row % 2 == 0 and team.color or Color3.fromRGB(40, 45, 60), Material = Enum.Material.SmoothPlastic })
		end
	end
	for _, cx in ipairs({ -1, 1 }) do
		for _, cz in ipairs({ -1, 1 }) do
			local base = Cfg.ORIGIN * CFrame.new(cx * (HALF_L + 18), 0, cz * (HALF_W + 34))
			part({ Name = "LightPole", Size = Vector3.new(2, 60, 2), CFrame = base * CFrame.new(0, 30, 0), Color = Color3.fromRGB(30, 30, 40) })
			local lamp = part({ Name = "Lamp", Size = Vector3.new(10, 4, 2), CFrame = base * CFrame.new(0, 61, 0), Color = Color3.fromRGB(255, 250, 220), Material = Enum.Material.Neon })
			local light = Instance.new("SpotLight")
			light.Face = Enum.NormalId.Bottom
			light.Range = 60
			light.Angle = 120
			light.Brightness = 3
			light.Parent = lamp
		end
	end
end

local function buildScoreboard()
	local board = part({ Name = "Scoreboard", Size = Vector3.new(44, 14, 1),
		CFrame = Cfg.ORIGIN * CFrame.new(0, 34, -(HALF_W + 34)) , Color = Color3.fromRGB(15, 18, 28) })
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Back
	gui.CanvasSize = Vector2.new(880, 280)
	gui.Parent = board
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.new(1, 1, 1)
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.RichText = true
	label.Text = "⚽ PARTIDOS EN GRUPO"
	label.Parent = gui
	scoreboardLabel = label
end

local function buildArena()
	folder = Instance.new("Folder")
	folder.Name = "PartidosEnGrupo"
	folder.Parent = Workspace
	-- Suelo y franjas
	floorPart = part({ Name = "Floor", Size = Vector3.new(Cfg.FIELD_LENGTH + 120, 1, Cfg.FIELD_WIDTH + 120), CFrame = Cfg.ORIGIN * CFrame.new(0, -0.6, 0),
		Color = Color3.fromRGB(70, 110, 60), Material = Enum.Material.Grass })
	local stripes = 10
	for i = 0, stripes - 1 do
		table.insert(pitchParts, part({ Name = "Pitch", Size = Vector3.new(Cfg.FIELD_LENGTH / stripes, 1, Cfg.FIELD_WIDTH),
			CFrame = Cfg.ORIGIN * CFrame.new(-HALF_L + (i + 0.5) * Cfg.FIELD_LENGTH / stripes, -0.5, 0),
			Color = i % 2 == 0 and Color3.fromRGB(52, 150, 64) or Color3.fromRGB(62, 168, 74), Material = Enum.Material.Grass }))
	end
	-- Líneas
	line(0, -HALF_W + 0.5, Cfg.FIELD_LENGTH, 0.6)
	line(0, HALF_W - 0.5, Cfg.FIELD_LENGTH, 0.6)
	line(-HALF_L + 0.5, 0, 0.6, Cfg.FIELD_WIDTH)
	line(HALF_L - 0.5, 0, 0.6, Cfg.FIELD_WIDTH)
	line(0, 0, 0.6, Cfg.FIELD_WIDTH)
	for i = 0, 23 do
		local a = i / 24 * math.pi * 2
		local p = part({ Name = "Line", Size = Vector3.new(0.6, 0.06, 4.2), Color = WHITE, CanCollide = false, CanQuery = false,
			CFrame = Cfg.ORIGIN * CFrame.new(math.cos(a) * 15, 0.03, math.sin(a) * 15) * CFrame.Angles(0, -a, 0) })
		p.Material = Enum.Material.SmoothPlastic
		table.insert(lineParts, p)
	end
	for _, sign in ipairs({ -1, 1 }) do
		line(sign * (HALF_L - 18), 0, 0.6, 50)
		line(sign * (HALF_L - 9), -25, 18, 0.6)
		line(sign * (HALF_L - 9), 25, 18, 0.6)
		buildGoal(sign)
	end
	buildWalls()
	buildStands()
	buildScoreboard()
end

-- Plataforma en la avenida para apuntarse con la tecla E
local function buildLobbyPad()
	local pad = part({ Name = "ArenaPad", Parent = folder, Size = Vector3.new(16, 0.6, 16), CFrame = Cfg.LOBBY_PAD * CFrame.new(0, 0.3, 0),
		Color = Color3.fromRGB(40, 220, 120), Material = Enum.Material.Neon, CanCollide = false })
	local sign = Instance.new("BillboardGui")
	sign.Size = UDim2.fromOffset(260, 70)
	sign.StudsOffset = Vector3.new(0, 7, 0)
	sign.AlwaysOnTop = false
	sign.MaxDistance = 140
	sign.Parent = pad
	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(1, 1)
	text.BackgroundTransparency = 1
	text.Font = Enum.Font.GothamBlack
	text.TextScaled = true
	text.TextColor3 = Color3.new(1, 1, 1)
	text.TextStrokeTransparency = 0.3
	text.Text = "⚽ PARTIDOS EN GRUPO"
	text.Parent = sign
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Jugar partido"
	prompt.ObjectText = "Partidos en grupo"
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt.Parent = pad
	prompt.Triggered:Connect(function(player)
		local ok, message = ArenaService.Join(player)
		notifyRemote:FireClient(player, ok and "success" or "error", message)
	end)
end

-- ===== Jugadores =====

local function characterOf(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if root and humanoid and humanoid.Health > 0 then
		return character, root, humanoid
	end
	return nil
end

local function setFrozen(frozen)
	for player in pairs(participants) do
		local _, _, humanoid = characterOf(player)
		if humanoid then
			humanoid:SetAttribute("Frozen", frozen or nil)
		end
	end
end

local function slotPosition(team, slot, total)
	-- Formación sencilla en su mitad del campo
	local sign = defendSign(team)
	local spots = {
		{ x = 0.85, z = 0 }, -- portero
		{ x = 0.55, z = -0.3 }, { x = 0.55, z = 0.3 },
		{ x = 0.25, z = -0.45 }, { x = 0.25, z = 0.45 },
	}
	local spot = spots[((slot - 1) % #spots) + 1]
	if total == 1 then
		spot = { x = 0.4, z = 0 }
	end
	return sign * spot.x * HALF_L, spot.z * HALF_W
end

local function placeParticipant(player)
	local info = participants[player]
	local character, _, humanoid = characterOf(player)
	if not info or not character then
		return
	end
	local x, z = slotPosition(info.team, info.slot, info.teamSize)
	local lookX = -defendSign(info.team) * 100
	character:PivotTo(CFrame.lookAt(toWorld(x, 4, z), toWorld(lookX, 4, z)))
	humanoid:SetAttribute("Arena", true)
	-- Contorno del color del equipo: se distingue a los compañeros aunque lleven trajes distintos
	if not character:FindFirstChild("FEU_TeamHighlight") then
		local highlight = Instance.new("Highlight")
		highlight.Name = "FEU_TeamHighlight"
		highlight.FillTransparency = 1
		highlight.OutlineColor = teamInfo(info.team).color
		highlight.OutlineTransparency = 0
		highlight.DepthMode = Enum.HighlightDepthMode.Occluded
		highlight.Parent = character
	end
end

local function releaseParticipant(player, teleport)
	participants[player] = nil
	kickCooldown[player] = nil
	dribbleCooldown[player] = nil
	if player.Parent then
		player.Team = nil
		player.Neutral = true
		local character, _, humanoid = characterOf(player)
		if humanoid then
			humanoid:SetAttribute("Arena", nil)
			humanoid:SetAttribute("Frozen", nil)
			humanoid:SetAttribute("Boost", nil)
		end
		local highlight = character and character:FindFirstChild("FEU_TeamHighlight")
		if highlight then
			highlight:Destroy()
		end
		if teleport then
			PlotService.TeleportHome(player)
		end
	end
end

local function humansInMatch()
	local count = 0
	for player in pairs(participants) do
		if player.Parent then
			count += 1
		end
	end
	return count
end

-- ===== Bots =====

local function makeBot(team, name)
	local info = teamInfo(team)
	local model = Instance.new("Model")
	model.Name = name
	local function botPart(partName, size, offset, color, shape)
		local p = Instance.new("Part")
		p.Name = partName
		p.Size = size
		p.Color = color
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.CanQuery = false
		p.Material = Enum.Material.SmoothPlastic
		if shape then
			p.Shape = shape
		end
		p:SetAttribute("Offset", offset)
		p.Parent = model
		return p
	end
	local torso = botPart("Torso", Vector3.new(2, 2.2, 1.1), Vector3.new(0, 3.1, 0), info.color)
	botPart("Head", Vector3.new(1.5, 1.5, 1.5), Vector3.new(0, 4.95, 0), Color3.fromRGB(240, 200, 160), Enum.PartType.Ball)
	botPart("Legs", Vector3.new(1.8, 2, 0.9), Vector3.new(0, 1, 0), Color3.fromRGB(30, 30, 40))
	model.PrimaryPart = torso
	local tag = Instance.new("BillboardGui")
	tag.Size = UDim2.fromOffset(120, 24)
	tag.StudsOffset = Vector3.new(0, 3.2, 0)
	tag.MaxDistance = 90
	tag.Parent = torso
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.4
	label.Text = "🤖 " .. name
	label.Parent = tag
	model.Parent = folder
	return model
end

local function placeBot(bot, x, z, faceX, faceZ)
	bot.x, bot.z = x, z
	local from, to = Vector3.new(x, 0, z), Vector3.new(faceX, 0, faceZ)
	if (to - from).Magnitude < 0.05 then
		to = from + Vector3.new(-defendSign(bot.team), 0, 0) -- mirando a la portería rival
	end
	local base = Cfg.ORIGIN * CFrame.lookAt(from, to)
	for _, p in ipairs(bot.model:GetChildren()) do
		if p:IsA("BasePart") then
			p.CFrame = base * CFrame.new(p:GetAttribute("Offset"))
		end
	end
end

local function clearBots()
	for _, bot in ipairs(bots) do
		bot.model:Destroy()
	end
	bots = {}
end

-- ===== Balón =====

-- El balón toma el aspecto del balón coleccionable del último jugador que lo toca.
-- Con el evento admin «Balón de oro» siempre es dorado.
local function applySkin(player)
	if AdminService.GoalMultiplier() > 1 then
		BallSkin.Apply(ball, "gold")
	elseif player then
		BallSkin.Apply(ball, PetService.BallOf(player))
	end
end

local function resetBall()
	ball.Anchored = true
	ball.AssemblyLinearVelocity = Vector3.zero
	ball.AssemblyAngularVelocity = Vector3.zero
	ball.CFrame = Cfg.ORIGIN * CFrame.new(0, Cfg.BALL_SIZE / 2 + 0.2, 0)
	applySkin(nil)
end

local function releaseBall()
	ball.Anchored = false
	pcall(function()
		ball:SetNetworkOwner(nil) -- el servidor controla el balón (goles fiables)
	end)
end

local function kickBall(direction, power)
	power = math.clamp(power, 0, 1)
	local speed = Cfg.KICK_MIN_SPEED + (Cfg.KICK_MAX_SPEED - Cfg.KICK_MIN_SPEED) * power
	local lift = Cfg.KICK_MIN_LIFT + (Cfg.KICK_MAX_LIFT - Cfg.KICK_MIN_LIFT) * power * power
	ball.AssemblyLinearVelocity = direction.Unit * speed + Vector3.new(0, lift, 0)
	kickSound:Play()
end

local function createBall()
	ball = Instance.new("Part")
	ball.Name = "ArenaBall"
	ball.Shape = Enum.PartType.Ball
	ball.Size = Vector3.new(Cfg.BALL_SIZE, Cfg.BALL_SIZE, Cfg.BALL_SIZE)
	ball.Material = Enum.Material.SmoothPlastic
	ball.CustomPhysicalProperties = PhysicalProperties.new(0.3, 0.35, Cfg.BALL_ELASTICITY, 1, 1)
	kickSound = Instance.new("Sound")
	kickSound.Name = "Kick"
	kickSound.SoundId = "rbxassetid://" .. SoundConfig.KICK
	kickSound.Volume = 0.9
	kickSound.RollOffMaxDistance = 160
	kickSound.Parent = ball
	ball.Parent = folder
	BallSkin.Apply(ball, "classic")
	resetBall()
	-- Conducción: al tocarlo corriendo, el balón sale en la dirección de la carrera
	ball.Touched:Connect(function(hit)
		if phase ~= "playing" then
			return
		end
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		local info = player and participants[player]
		if not info then
			return
		end
		local _, root = characterOf(player)
		if not root then
			return
		end
		local now = os.clock()
		if dribbleCooldown[player] and now - dribbleCooldown[player] < 0.15 then
			return
		end
		dribbleCooldown[player] = now
		lastTouch = { name = player.DisplayName, team = info.team, player = player }
		applySkin(player)
		-- Cabezazo: el balón llega alto y toca la cabeza -> sale hacia donde mira el jugador
		if hit.Name == "Head" and ball.Position.Y > root.Position.Y + 1.2 then
			local look = root.CFrame.LookVector * Vector3.new(1, 0, 1)
			if look.Magnitude > 0.01 then
				ball.AssemblyLinearVelocity = look.Unit * Cfg.HEADER_SPEED + Vector3.new(0, Cfg.HEADER_LIFT, 0)
				kickSound:Play()
				return
			end
		end
		local velocity = root.AssemblyLinearVelocity * Vector3.new(1, 0, 1)
		local direction = velocity.Magnitude > 4 and velocity.Unit or ((ball.Position - root.Position) * Vector3.new(1, 0, 1))
		if direction.Magnitude < 0.01 then
			return
		end
		ball.AssemblyLinearVelocity = direction.Unit * math.max(Cfg.DRIBBLE_SPEED, velocity.Magnitude * 1.15) + Vector3.new(0, 2, 0)
	end)
end

-- Envía el balón a un compañero con la fuerza justa, adelantado a su carrera.
-- offset = vector horizontal del balón al compañero
passBall = function(offset, distance, velocity)
	local speed = math.clamp(distance * 1.5 + 28, Cfg.PASS_MIN_SPEED, Cfg.PASS_MAX_SPEED)
	local target = offset + velocity * math.min(distance / speed, 1.2)
	ball.AssemblyLinearVelocity = target.Unit * speed + Vector3.new(0, 3 + distance * 0.06, 0)
	kickSound:Play()
end

-- Comprobaciones comunes de chut y pase: en partido, cerca del balón y sin abusar del botón.
-- Devuelve la ficha del jugador y su HumanoidRootPart, o nil si la acción no vale.
local function validTouch(player)
	if phase ~= "playing" or not ball then
		return nil
	end
	local info = participants[player]
	if not info then
		return nil
	end
	local _, root = characterOf(player)
	if not root then
		return nil
	end
	local now = os.clock()
	if kickCooldown[player] and now - kickCooldown[player] < Cfg.KICK_COOLDOWN then
		return nil
	end
	if (ball.Position - root.Position).Magnitude > Cfg.KICK_RANGE then
		return nil
	end
	kickCooldown[player] = now
	lastTouch = { name = player.DisplayName, team = info.team, player = player }
	applySkin(player)
	return info, root
end

-- Dirección horizontal del chut: hacia donde apunta la cámara del jugador (lo envía el cliente).
-- Si no es un vector válido, se usa hacia donde mira el personaje.
local function aimDirection(root, aim)
	if typeof(aim) == "Vector3" then
		local flat = aim * Vector3.new(1, 0, 1)
		if flat.Magnitude > 0.1 and flat.Magnitude < 10 then
			return flat.Unit
		end
	end
	local look = root.CFrame.LookVector * Vector3.new(1, 0, 1)
	return look.Magnitude > 0.01 and look.Unit or nil
end

-- Chut pedido por un cliente: todo se valida aquí.
local function onKick(player, power, aim)
	if type(power) ~= "number" or power ~= power then
		return
	end
	local info, root = validTouch(player)
	if not info then
		return
	end
	local direction = aimDirection(root, aim)
	if direction then
		kickBall(direction, power)
		if info.superkick then
			-- Supertiro: más fuerte y con fuego durante un momento
			info.superkick = nil
			ball.AssemblyLinearVelocity *= Cfg.SUPERKICK_MULTIPLIER
			local fire = Instance.new("Fire")
			fire.Size = 6
			fire.Heat = 8
			fire.Color = Color3.fromRGB(255, 120, 30)
			fire.SecondaryColor = Color3.fromRGB(255, 220, 90)
			fire.Parent = ball
			task.delay(1.5, function()
				fire:Destroy()
			end)
		end
	end
end

-- Pase: el servidor busca al compañero mejor colocado en la dirección a la que apuntas
-- y le envía el balón con la fuerza justa para que le llegue.
local function onPass(player, aim)
	local info, root = validTouch(player)
	if not info then
		return
	end
	local direction = aimDirection(root, aim)
	if not direction then
		return
	end
	local best, bestScore = nil, 0.3 -- solo compañeros dentro de un cono de unos 70° a cada lado
	local function consider(position, velocity)
		local offset = (position - ball.Position) * Vector3.new(1, 0, 1)
		local distance = offset.Magnitude
		if distance < 6 or distance > 110 then
			return
		end
		local score = offset.Unit:Dot(direction)
		if score > bestScore then
			best, bestScore = { offset = offset, distance = distance, velocity = velocity }, score
		end
	end
	for other, otherInfo in pairs(participants) do
		if other ~= player and otherInfo.team == info.team then
			local _, otherRoot = characterOf(other)
			if otherRoot then
				consider(otherRoot.Position, otherRoot.AssemblyLinearVelocity * Vector3.new(1, 0, 1))
			end
		end
	end
	for _, bot in ipairs(bots) do
		if bot.team == info.team then
			consider(toWorld(bot.x, 0, bot.z), Vector3.zero)
		end
	end
	if not best then
		kickBall(direction, 0.3) -- nadie a quien pasar: toque corto hacia delante
		return
	end
	passBall(best.offset, best.distance, best.velocity)
end

-- ===== Retransmisión al cliente =====

local function teamLists()
	local lists = { red = {}, blue = {} }
	for player, info in pairs(participants) do
		table.insert(lists[info.team], player.DisplayName)
	end
	for _, bot in ipairs(bots) do
		table.insert(lists[bot.team], "🤖 " .. bot.name)
	end
	return lists
end

local function broadcast()
	local lists = (phase ~= "idle" and phase ~= "countdown") and teamLists() or nil
	local base = {
		phase = phase,
		queue = #queue,
		countdown = phase == "countdown" and math.max(0, math.ceil(countdownEnds - os.clock())) or nil,
		timeLeft = math.max(0, math.ceil(remaining)),
		goldenGoal = goldenGoal,
		score = { red = score.red, blue = score.blue },
		teams = lists,
		goldBall = AdminService.GoalMultiplier() > 1,
		theme = currentTheme.icon .. " " .. currentTheme.name,
	}
	for _, player in ipairs(Players:GetPlayers()) do
		local info = participants[player]
		local message = table.clone(base)
		message.role = info and "playing" or (table.find(queue, player) and "queued" or "none")
		message.team = info and info.team or nil
		arenaRemote:FireClient(player, "state", message)
	end
	if scoreboardLabel then
		if phase == "idle" or phase == "countdown" then
			scoreboardLabel.Text = "⚽ PARTIDOS EN GRUPO"
		else
			scoreboardLabel.Text = string.format("<font color='#FF6B6B'>ROJO %d</font>  -  <font color='#6BA8FF'>%d AZUL</font>\n⏱ %d:%02d",
				score.red, score.blue, math.floor(base.timeLeft / 60), base.timeLeft % 60)
		end
	end
end

local function event(kind, data)
	for player in pairs(participants) do
		arenaRemote:FireClient(player, kind, data)
	end
end

-- ===== Lógica de los bots (cada frame) =====

-- Compañero (humano o bot) más adelantado hacia la portería rival, a distancia de pase.
findMate = function(bot, ballLocal, attackX, distanceToGoal)
	local best, bestGain = nil, Cfg.BOT_PASS_MIN_GAIN
	local function consider(position, velocity)
		local localPos = toLocal(position)
		local gain = distanceToGoal - math.abs(attackX - localPos.X)
		local offset = (position - ball.Position) * Vector3.new(1, 0, 1)
		local distance = offset.Magnitude
		if gain > bestGain and distance > 12 and distance < 60 then
			best, bestGain = { offset = offset, distance = distance, velocity = velocity }, gain
		end
	end
	for player, info in pairs(participants) do
		if info.team == bot.team then
			local _, root = characterOf(player)
			if root then
				consider(root.Position, root.AssemblyLinearVelocity * Vector3.new(1, 0, 1))
			end
		end
	end
	for _, other in ipairs(bots) do
		if other ~= bot and other.team == bot.team and not other.keeper then
			consider(toWorld(other.x, 0, other.z), Vector3.zero)
		end
	end
	return best
end

local function updateBots(dt)
	if phase ~= "playing" or not ball then
		return
	end
	local b = toLocal(ball.Position)
	-- El bot de campo más cercano al balón de cada equipo va a por él
	local chaser = {}
	for _, team in ipairs({ "red", "blue" }) do
		local best, bestDist = nil, math.huge
		for _, bot in ipairs(bots) do
			if bot.team == team and not bot.keeper then
				local d = (Vector2.new(bot.x, bot.z) - Vector2.new(b.X, b.Z)).Magnitude
				if d < bestDist then
					best, bestDist = bot, d
				end
			end
		end
		chaser[team] = best
	end
	for _, bot in ipairs(bots) do
		if (bot.frozenUntil or 0) > os.clock() then
			continue -- congelado por un potenciador
		end
		local sign = defendSign(bot.team)
		local attackX = -sign * HALF_L
		local tx, tz, speed
		if bot.keeper then
			speed = Cfg.BOT_KEEPER_SPEED
			local near = math.abs(b.X - sign * HALF_L) < 22 and math.abs(b.Z) < HALF_W * 0.6
			if near then
				tx, tz = b.X, b.Z
			else
				tx = sign * (HALF_L - 4)
				tz = math.clamp(b.Z, -Cfg.GOAL_WIDTH / 2 + 2, Cfg.GOAL_WIDTH / 2 - 2)
			end
		elseif chaser[bot.team] == bot then
			speed = Cfg.BOT_SPEED
			-- Se coloca detrás del balón respecto a la portería rival
			local toGoal = Vector2.new(attackX - b.X, -b.Z)
			local behind = toGoal.Magnitude > 0 and toGoal.Unit * -2.2 or Vector2.zero
			tx, tz = b.X + behind.X, b.Z + behind.Y
		else
			speed = Cfg.BOT_SPEED * 0.8
			local hx, hz = slotPosition(bot.team, bot.slot, bot.teamSize)
			tx = (hx + b.X) / 2
			tz = hz
		end
		local delta = Vector2.new(tx - bot.x, tz - bot.z)
		local step = math.min(speed * dt, delta.Magnitude)
		local nx, nz = bot.x, bot.z
		if delta.Magnitude > 0.05 then
			nx += delta.Unit.X * step
			nz += delta.Unit.Y * step
		end
		nx = math.clamp(nx, -HALF_L + 1, HALF_L - 1)
		nz = math.clamp(nz, -HALF_W + 1, HALF_W - 1)
		placeBot(bot, nx, nz, b.X, b.Z)
		-- Chut
		local dist = (Vector2.new(nx, nz) - Vector2.new(b.X, b.Z)).Magnitude
		local now = os.clock()
		if dist < 4.5 and b.Y < 6 and now - (bot.lastKick or 0) > Cfg.BOT_KICK_COOLDOWN then
			bot.lastKick = now
			local aimZ = rng:NextNumber(-Cfg.GOAL_WIDTH * 0.4, Cfg.GOAL_WIDTH * 0.4)
			local aim = toWorld(attackX, 0, aimZ) - toWorld(b.X, 0, b.Z)
			local distanceToGoal = math.abs(attackX - b.X)
			local power = bot.keeper and 0.9 or (distanceToGoal > 60 and rng:NextNumber(0.45, 0.65) or rng:NextNumber(0.7, 0.95))
			lastTouch = { name = bot.name, team = bot.team }
			-- Lejos de la portería, a veces pasa a un compañero mejor colocado (más cerca del área rival)
			local mate = nil
			if not bot.keeper and distanceToGoal > Cfg.BOT_PASS_MIN_DISTANCE and rng:NextNumber() < Cfg.BOT_PASS_CHANCE then
				mate = findMate(bot, b, attackX, distanceToGoal)
			end
			local flatAim = aim * Vector3.new(1, 0, 1)
			if mate then
				passBall(mate.offset, mate.distance, mate.velocity)
			elseif flatAim.Magnitude > 0.01 then
				kickBall(flatAim, power)
			end
		end
	end
end

-- ===== Goles =====

local function checkBall()
	if not ball or phase ~= "playing" then
		return
	end
	local p = toLocal(ball.Position)
	if math.abs(p.X) > HALF_L + Cfg.BALL_SIZE / 2 and math.abs(p.Z) < Cfg.GOAL_WIDTH / 2 and p.Y < Cfg.GOAL_HEIGHT then
		-- En la portería de +X defiende Azul: marca Rojo, y al revés
		pendingGoal = p.X > 0 and "red" or "blue"
		score[pendingGoal] += 1
		phase = "goal"
		local scorer = lastTouch
		local ownGoal = scorer ~= nil and scorer.team ~= pendingGoal
		if scorer and scorer.player and not ownGoal and participants[scorer.player] then
			participants[scorer.player].goals += 1
			ArenaService.Celebrate(scorer.player)
		end
		event("goal", {
			team = pendingGoal,
			scorer = scorer and scorer.name or nil,
			ownGoal = ownGoal,
			score = { red = score.red, blue = score.blue },
		})
		broadcast()
	elseif p.Y < -25 or math.abs(p.X) > HALF_L + 40 or math.abs(p.Z) > HALF_W + 40 then
		resetBall() -- se escapó por un fallo de física: vuelve al centro
		releaseBall()
	end
end

-- ===== Potenciadores =====

local function applyPowerUp(player, def)
	local info = participants[player]
	local _, _, humanoid = characterOf(player)
	if not info or not humanoid then
		return
	end
	if def.id == "superkick" then
		info.superkick = true
	elseif def.id == "turbo" then
		humanoid:SetAttribute("Boost", def.speed)
		task.delay(def.seconds, function()
			if humanoid.Parent and humanoid:GetAttribute("Boost") == def.speed then
				humanoid:SetAttribute("Boost", nil)
			end
		end)
	elseif def.id == "freeze" then
		local untilTime = os.clock() + def.seconds
		for other, otherInfo in pairs(participants) do
			if otherInfo.team ~= info.team then
				local _, _, otherHumanoid = characterOf(other)
				if otherHumanoid and not otherHumanoid:GetAttribute("Frozen") then
					otherHumanoid:SetAttribute("Frozen", true)
					task.delay(def.seconds, function()
						-- Solo se descongela si no ha empezado un saque (que también congela)
						if otherHumanoid.Parent and phase == "playing" then
							otherHumanoid:SetAttribute("Frozen", nil)
						end
					end)
				end
			end
		end
		for _, bot in ipairs(bots) do
			if bot.team ~= info.team then
				bot.frozenUntil = untilTime
			end
		end
	end
	event("powerup", { player = player.DisplayName, team = info.team, icon = def.icon, name = def.name, text = def.text })
end

local function spawnPowerUp()
	local def = Cfg.PowerUps[rng:NextInteger(1, #Cfg.PowerUps)]
	local x = rng:NextNumber(-HALF_L * 0.65, HALF_L * 0.65)
	local z = rng:NextNumber(-HALF_W * 0.7, HALF_W * 0.7)
	local piece = part({ Name = "PowerUp", Shape = Enum.PartType.Ball, Size = Vector3.new(3.2, 3.2, 3.2),
		CFrame = Cfg.ORIGIN * CFrame.new(x, 2.4, z), Color = def.color, Material = Enum.Material.Neon,
		CanCollide = false, Transparency = 0.15 })
	piece:SetAttribute("BaseY", 2.4)
	local light = Instance.new("PointLight")
	light.Color = def.color
	light.Range = 14
	light.Parent = piece
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(110, 40)
	gui.StudsOffset = Vector3.new(0, 3, 0)
	gui.MaxDistance = 120
	gui.Parent = piece
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.3
	label.Text = def.icon .. " " .. def.name
	label.Parent = gui
	local taken = false
	piece.Touched:Connect(function(hit)
		if taken or phase ~= "playing" then
			return
		end
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		if player and participants[player] then
			taken = true
			local index = table.find(powerUps, piece)
			if index then
				table.remove(powerUps, index)
			end
			piece:Destroy()
			applyPowerUp(player, def)
		end
	end)
	table.insert(powerUps, piece)
end

-- Aparición periódica y animación (flotan arriba y abajo)
updatePowerUps = function(dt)
	if phase ~= "playing" then
		return
	end
	if #powerUps < Cfg.POWERUP_MAX and os.clock() - lastPowerUp > Cfg.POWERUP_INTERVAL then
		lastPowerUp = os.clock()
		spawnPowerUp()
	end
	local t = os.clock()
	for _, piece in ipairs(powerUps) do
		local position = piece.Position
		piece.CFrame = CFrame.new(position.X, Cfg.ORIGIN.Position.Y + piece:GetAttribute("BaseY") + math.sin(t * 3) * 0.6, position.Z)
	end
end

-- Celebración: el goleador hace una animación oficial de Roblox (si su avatar es R15)
function ArenaService.Celebrate(player)
	local _, _, humanoid = characterOf(player)
	local animator = humanoid and humanoid:FindFirstChildOfClass("Animator")
	if not animator or humanoid.RigType ~= Enum.HumanoidRigType.R15 then
		return
	end
	pcall(function()
		local animation = Instance.new("Animation")
		animation.AnimationId = "rbxassetid://" .. Cfg.Celebrations[rng:NextInteger(1, #Cfg.Celebrations)]
		local track = animator:LoadAnimation(animation)
		track.Priority = Enum.AnimationPriority.Action
		track:Play()
		task.delay(Cfg.GOAL_CELEBRATION, function()
			track:Stop(0.3)
		end)
	end)
end

-- ===== Desarrollo del partido =====

local function clearPowerUps()
	for _, piece in ipairs(powerUps) do
		piece:Destroy()
	end
	powerUps = {}
	lastPowerUp = os.clock()
end

local function kickoff()
	phase = "kickoff"
	clearPowerUps()
	resetBall()
	for player in pairs(participants) do
		placeParticipant(player)
	end
	for _, bot in ipairs(bots) do
		local x, z = slotPosition(bot.team, bot.slot, bot.teamSize)
		placeBot(bot, x, z, 0, z)
	end
	setFrozen(true)
	broadcast()
	task.wait(Cfg.KICKOFF_FREEZE)
	setFrozen(false)
	releaseBall()
	phase = "playing"
	broadcast()
end

local function rewardFor(player, result, goals)
	local base = result == "win" and Cfg.REWARD_WIN or (result == "draw" and Cfg.REWARD_DRAW or Cfg.REWARD_LOSS)
	-- Las mascotas equipadas suman su bonus (se consiguen jugando, no pagando)
	-- El bonus de la semana (partidos x1,5 o goles x2) también cuenta
	local weekly = WeeklyConfig.ActiveBonus()
	-- Y los renacimientos (+10 % por cada uno)
	local data = DataService.Get(player)
	local rebirthBonus = RebirthConfig.ArenaBonus(data and data.rebirth.count or 0)
	local amount = math.floor((base + goals * Cfg.REWARD_GOAL * AdminService.GoalMultiplier() * (weekly.goalMultiplier or 1))
		* AdminService.RewardMultiplier() * (weekly.matchMultiplier or 1)
		* (1 + PetService.Bonus(player) + rebirthBonus + SocialService.FriendBonus(player)))
	local now = os.time()
	local log = rewardLog[player.UserId] or {}
	local recent = {}
	for _, t in ipairs(log) do
		if now - t < 3600 then
			table.insert(recent, t)
		end
	end
	if #recent >= Cfg.MAX_REWARDED_PER_HOUR then
		rewardLog[player.UserId] = recent
		return 0
	end
	table.insert(recent, now)
	rewardLog[player.UserId] = recent
	return amount
end

-- Mejor jugador: el humano con más goles (si empatan, uno del equipo ganador)
local function pickMvp(winner)
	local mvp, best = nil, 0
	for player, info in pairs(participants) do
		if player.Parent then
			local points = info.goals * 2 + (info.team == winner and 1 or 0)
			if info.goals > 0 and points > best then
				mvp, best = player, points
			end
		end
	end
	return mvp
end

local function finish(aborted)
	phase = "result"
	local winner = score.red > score.blue and "red" or (score.blue > score.red and "blue" or nil)
	lastResult = { winner = winner, score = { red = score.red, blue = score.blue } }
	local mvp = not aborted and pickMvp(winner) or nil
	for player, info in pairs(participants) do
		if player.Parent and not aborted and DataService.Get(player) then
			local result = winner == nil and "draw" or (winner == info.team and "win" or "loss")
			local reward = rewardFor(player, result, info.goals)
			if reward > 0 and player == mvp then
				reward += Cfg.REWARD_MVP
			end
			if reward > 0 then
				EconomyService.Earn(player, reward, EconomyService.Category.ARENA, "Partido en grupo")
			end
			arenaRemote:FireClient(player, "result", {
				result = result, winner = winner, score = lastResult.score, goals = info.goals, reward = reward,
				capped = reward == 0, petBonus = PetService.Bonus(player), friendBonus = SocialService.FriendBonus(player),
				mvp = mvp and mvp.DisplayName or nil, isMvp = player == mvp,
			})
			local own = info.team == "red" and score.red or score.blue
			local other = info.team == "red" and score.blue or score.red
			for _, callback in ipairs(endCallbacks) do
				task.spawn(callback, player, info.goals, own, other, result, player == mvp)
			end
		end
	end
	broadcast()
	task.wait(aborted and 0 or Cfg.RESULT_SECONDS)
	for player in pairs(participants) do
		releaseParticipant(player, true)
	end
	clearBots()
	clearPowerUps()
	if ball then
		ball:Destroy()
		ball = nil
	end
	phase = "idle"
	broadcast()
end

local function runMatch(players)
	score = { red = 0, blue = 0 }
	lastTouch = nil
	pendingGoal = nil
	applyTheme(pickTheme())
	-- Reparto al azar y equilibrado
	for i = #players, 2, -1 do
		local j = rng:NextInteger(1, i)
		players[i], players[j] = players[j], players[i]
	end
	local teamSize = math.max(Cfg.MIN_PER_TEAM, math.ceil(#players / 2))
	local counts = { red = 0, blue = 0 }
	for i, player in ipairs(players) do
		local team = i % 2 == 1 and "red" or "blue"
		counts[team] += 1
		participants[player] = { team = team, goals = 0, slot = counts[team] + 1, teamSize = teamSize }
		player.Neutral = false
		player.Team = teamObjects[team]
		arenaRemote:FireClient(player, "joined", { team = team, theme = currentTheme.icon .. " " .. currentTheme.name })
	end
	-- Los humanos ocupan los puestos de campo; el primer bot de un equipo es el portero.
	local names = table.clone(Cfg.BOT_NAMES)
	for _, team in ipairs({ "red", "blue" }) do
		local missing = teamSize - counts[team]
		for k = 1, missing do
			local name = table.remove(names, rng:NextInteger(1, #names)) or ("Bot " .. k)
			local bot = { model = makeBot(team, name), team = team, name = name, keeper = (k == 1), teamSize = teamSize }
			bot.slot = bot.keeper and 1 or (counts[team] + k)
			table.insert(bots, bot)
		end
	end
	createBall()
	goldenGoal = false
	remaining = Cfg.MATCH_SECONDS
	local function play()
		while remaining > 0 and humansInMatch() > 0 do
			local dt = task.wait(0.1)
			if phase == "playing" then
				remaining -= dt
			elseif phase == "goal" then
				task.wait(Cfg.GOAL_CELEBRATION)
				pendingGoal = nil
				if goldenGoal then
					remaining = 0 -- en el gol de oro, el primer gol gana
				elseif humansInMatch() > 0 then
					kickoff()
				end
			end
		end
	end
	kickoff()
	play()
	-- Empate al final: prórroga a gol de oro (una sola vez)
	if score.red == score.blue and humansInMatch() > 0 then
		goldenGoal = true
		remaining = Cfg.GOLDEN_GOAL_SECONDS
		event("goldengoal", { seconds = Cfg.GOLDEN_GOAL_SECONDS })
		kickoff()
		play()
	end
	finish(humansInMatch() == 0)
	goldenGoal = false
end

-- ===== API pública =====

-- ¿Está jugando o en la cola? (para no mezclarlo con otros minijuegos)
function ArenaService.IsBusy(player)
	return participants[player] ~= nil or table.find(queue, player) ~= nil
end

-- Chuts de jugadores que no están en un partido: los recibe otro minijuego (validado allí)
function ArenaService.SetKickFallback(callback)
	kickFallback = callback
end

function ArenaService.Join(player)
	if not DataService.Get(player) then
		return false, "Tu club todavía se está cargando."
	end
	if participants[player] then
		return false, "Ya estás jugando un partido."
	end
	if table.find(queue, player) then
		return false, "Ya estás en la cola."
	end
	if player:GetAttribute("InPenalty") then
		return false, "Termina primero la tanda de penaltis."
	end
	table.insert(queue, player)
	broadcast()
	if phase == "idle" or phase == "countdown" then
		return true, "⚽ ¡Te has apuntado! El partido empieza en unos segundos."
	end
	return true, "⚽ Estás en la cola: jugarás el próximo partido."
end

function ArenaService.Leave(player)
	local index = table.find(queue, player)
	if index then
		table.remove(queue, index)
		broadcast()
		return true, "Has salido de la cola."
	end
	if participants[player] then
		releaseParticipant(player, true)
		broadcast()
		return true, "Has abandonado el partido."
	end
	return false, "No estás en ningún partido."
end

-- Espectador: te lleva a la grada del estadio de partidos (para volver: «Volver a mi estadio»).
function ArenaService.Watch(player)
	if participants[player] then
		return false, "Ya estás jugando el partido."
	end
	local character = characterOf(player)
	if not character then
		return false, "No se pudo teletransportar ahora."
	end
	local side = rng:NextNumber() < 0.5 and -1 or 1
	character:PivotTo(CFrame.lookAt(toWorld(rng:NextInteger(-40, 40), 15, side * (HALF_W + 26)), toWorld(0, 2, 0)))
	return true, "👀 Estás en la grada. Para volver, pulsa «Volver a mi estadio»."
end

-- Al reaparecer durante un partido, vuelve al campo en vez de a su estadio.
function ArenaService.HandleRespawn(player)
	if not participants[player] then
		return false
	end
	task.wait(0.2)
	placeParticipant(player)
	local _, _, humanoid = characterOf(player)
	if humanoid and phase == "kickoff" then
		humanoid:SetAttribute("Frozen", true)
	end
	return true
end

function ArenaService.OnMatchEnd(callback)
	table.insert(endCallbacks, callback)
end

function ArenaService.PlayerRemoving(player)
	local index = table.find(queue, player)
	if index then
		table.remove(queue, index)
	end
	if participants[player] then
		releaseParticipant(player, false)
	end
	kickCooldown[player] = nil
	dribbleCooldown[player] = nil
end

function ArenaService.Start()
	buildArena()
	buildLobbyPad()
	for _, info in ipairs(Cfg.TEAMS) do
		local team = Instance.new("Team")
		team.Name = info.name
		team.TeamColor = BrickColor.new(info.brick)
		team.AutoAssignable = false
		team.Parent = Teams
		teamObjects[info.id] = team
	end
	arenaRemote.OnServerEvent:Connect(function(player, kind, a, b)
		if kind == "kick" then
			if participants[player] then
				onKick(player, a, b) -- potencia (0..1) y dirección de la cámara
			elseif kickFallback then
				kickFallback(player, a, b) -- p. ej. la tanda de penaltis de la plaza
			end
		elseif kind == "pass" then
			onPass(player, a) -- dirección de la cámara
		end
	end)
	RunService.Heartbeat:Connect(function(dt)
		checkBall()
		updateBots(dt)
		updatePowerUps(dt)
	end)
	-- Bucle de la cola y de los partidos
	task.spawn(function()
		while true do
			if phase == "idle" and #queue > 0 then
				phase = "countdown"
				countdownEnds = os.clock() + Cfg.QUEUE_COUNTDOWN
			end
			if phase == "countdown" then
				if #queue == 0 then
					phase = "idle"
				else
					if #queue >= Cfg.MAX_PER_TEAM * 2 then
						countdownEnds = math.min(countdownEnds, os.clock() + Cfg.QUEUE_COUNTDOWN_FULL)
					end
					if os.clock() >= countdownEnds then
						local players = {}
						while #queue > 0 and #players < Cfg.MAX_PER_TEAM * 2 do
							local player = table.remove(queue, 1)
							if player.Parent and characterOf(player) then
								table.insert(players, player)
							end
						end
						if #players > 0 then
							local ok, err = pcall(runMatch, players)
							if not ok then
								warn("[ArenaService] Error en el partido: ", err)
								pcall(finish, true)
							end
						else
							phase = "idle"
						end
					end
				end
			end
			task.wait(0.25)
		end
	end)
	-- Marcador y cola en pantalla dos veces por segundo
	task.spawn(function()
		while true do
			broadcast()
			task.wait(0.5)
		end
	end)
end

return ArenaService
