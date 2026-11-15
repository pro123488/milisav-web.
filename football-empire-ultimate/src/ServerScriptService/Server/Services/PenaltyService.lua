-- PenaltyService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/PenaltyService
--
-- TANDA DE PENALTIS en la plaza: 5 tiros contra un portero bot.
--   * Se empieza con la tecla E en el punto de penalti. Solo juega una persona a la vez.
--   * Se chuta con el mismo control que en los partidos (el chut llega por el remote Arena y
--     ArenaService lo reenvía aquí si el jugador no está en un partido).
--   * El servidor valida el chut (distancia al balón, turno, valores), mueve al portero y decide
--     si es gol. Premio en dinero con una espera entre tandas premiadas.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Cfg = require(Shared.Config.PenaltyConfig)
local ArenaConfig = require(Shared.Config.ArenaConfig)
local SoundConfig = require(Shared.Config.SoundConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PetService = require(script.Parent.PetService)
local SeasonService = require(script.Parent.SeasonService)
local ArenaService = require(script.Parent.ArenaService)
local BallSkin = require(script.Parent.Parent.Util.BallSkin)

local PenaltyService = {}

local arenaRemote = Remotes.Get("Arena")
local notifyRemote = Remotes.Get("Notify")

local HALF_GOAL = Cfg.GOAL_WIDTH / 2
local WHITE = Color3.fromRGB(245, 245, 245)

local folder, ball, keeper, kickSound
local rng = Random.new()
local session = nil -- { player, shot, goals, waiting, kickedAt, keeperTarget, outcome, saved }
local lastReward = {} -- [userId] = os.time()

local function toWorld(x, y, z)
	return (Cfg.ORIGIN * CFrame.new(x, y, z)).Position
end

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		p[key] = value
	end
	p.Parent = folder
	return p
end

-- ===== Escenario =====

local function build()
	folder = Instance.new("Folder")
	folder.Name = "FEU_Penaltis"
	folder.Parent = Workspace
	local o = Cfg.ORIGIN
	-- Césped del área (de la portería hacia -X)
	part({ Name = "Grass", Size = Vector3.new(40, 0.2, 40), CFrame = o * CFrame.new(-18, 0.1, 0), Color = Color3.fromRGB(58, 160, 66), Material = Enum.Material.Grass })
	part({ Name = "Line", Size = Vector3.new(0.4, 0.05, Cfg.GOAL_WIDTH + 12), CFrame = o * CFrame.new(0, 0.22, 0), Color = WHITE, CanCollide = false })
	local spot = part({ Name = "Spot", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, 1.2, 1.2), CanCollide = false,
		CFrame = o * CFrame.new(-Cfg.SPOT_DISTANCE, 0.22, 0) * CFrame.Angles(0, 0, math.pi / 2), Color = WHITE })
	-- Portería: postes, larguero y red (la red de atrás para el balón)
	for _, side in ipairs({ -1, 1 }) do
		part({ Name = "Post", Size = Vector3.new(0.6, Cfg.GOAL_HEIGHT, 0.6), CFrame = o * CFrame.new(0, Cfg.GOAL_HEIGHT / 2, side * HALF_GOAL), Color = WHITE })
		part({ Name = "NetSide", Size = Vector3.new(4, Cfg.GOAL_HEIGHT, 0.3), CFrame = o * CFrame.new(2, Cfg.GOAL_HEIGHT / 2, side * HALF_GOAL),
			Color = WHITE, Material = Enum.Material.ForceField, Transparency = 0.3 })
	end
	part({ Name = "Crossbar", Size = Vector3.new(0.6, 0.6, Cfg.GOAL_WIDTH + 0.6), CFrame = o * CFrame.new(0, Cfg.GOAL_HEIGHT, 0), Color = WHITE })
	part({ Name = "NetBack", Size = Vector3.new(0.3, Cfg.GOAL_HEIGHT, Cfg.GOAL_WIDTH), CFrame = o * CFrame.new(4, Cfg.GOAL_HEIGHT / 2, 0),
		Color = WHITE, Material = Enum.Material.ForceField, Transparency = 0.3 })
	part({ Name = "NetTop", Size = Vector3.new(4, 0.3, Cfg.GOAL_WIDTH), CFrame = o * CFrame.new(2, Cfg.GOAL_HEIGHT, 0),
		Color = WHITE, Material = Enum.Material.ForceField, Transparency = 0.3 })
	-- Valla detrás para que el balón no se vaya lejos
	part({ Name = "Backstop", Size = Vector3.new(1, 14, 40), CFrame = o * CFrame.new(8, 7, 0), Transparency = 0.85,
		Color = Color3.fromRGB(200, 230, 255), Material = Enum.Material.Glass })

	-- Portero (bloque con el color de los porteros; bloquea el balón con su física)
	keeper = part({ Name = "Keeper", Size = Vector3.new(1.5, 6.5, 4.4), CFrame = o * CFrame.new(-1, 3.25, 0),
		Color = Color3.fromRGB(40, 170, 80), Material = Enum.Material.SmoothPlastic })
	local face = Instance.new("BillboardGui")
	face.Size = UDim2.fromOffset(120, 24)
	face.StudsOffset = Vector3.new(0, 4.5, 0)
	face.MaxDistance = 80
	face.Parent = keeper
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.4
	label.Text = "🧤 Bot Portero"
	label.Parent = face

	-- Cartel y punto de inicio
	local sign = Instance.new("BillboardGui")
	sign.Size = UDim2.fromOffset(260, 60)
	sign.StudsOffset = Vector3.new(0, 6, 0)
	sign.MaxDistance = 140
	sign.Parent = spot
	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromScale(1, 1)
	title.BackgroundTransparency = 1
	title.Font = Enum.Font.GothamBlack
	title.TextScaled = true
	title.TextColor3 = Color3.new(1, 1, 1)
	title.TextStrokeTransparency = 0.3
	title.Text = "⚽ TANDA DE PENALTIS"
	title.Parent = sign
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Tirar penaltis"
	prompt.ObjectText = "5 tiros contra el portero"
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt.Parent = spot
	prompt.Triggered:Connect(function(player)
		local ok, message = PenaltyService.Start(player)
		notifyRemote:FireClient(player, ok and "info" or "error", message)
	end)
end

-- ===== Balón y portero =====

local function setKeeper(z)
	keeper.CFrame = Cfg.ORIGIN * CFrame.new(-1, 3.25, math.clamp(z, -HALF_GOAL + 2.2, HALF_GOAL - 2.2))
end

local function placeBall(player)
	if not ball then
		ball = Instance.new("Part")
		ball.Name = "PenaltyBall"
		ball.Shape = Enum.PartType.Ball
		ball.Size = Vector3.new(ArenaConfig.BALL_SIZE, ArenaConfig.BALL_SIZE, ArenaConfig.BALL_SIZE)
		ball.CustomPhysicalProperties = PhysicalProperties.new(0.3, 0.35, ArenaConfig.BALL_ELASTICITY, 1, 1)
		kickSound = Instance.new("Sound")
		kickSound.SoundId = "rbxassetid://" .. SoundConfig.KICK
		kickSound.Volume = 0.9
		kickSound.Parent = ball
		ball.Touched:Connect(function(hit)
			if session and hit == keeper and not session.waiting then
				session.saved = true
			end
		end)
		ball.Parent = folder
	end
	BallSkin.Apply(ball, PetService.BallOf(player))
	ball.Anchored = true
	ball.AssemblyLinearVelocity = Vector3.zero
	ball.AssemblyAngularVelocity = Vector3.zero
	-- Quieto en el punto de penalti hasta el chut (así no se puede empujar hasta la portería)
	ball.CFrame = Cfg.ORIGIN * CFrame.new(-Cfg.SPOT_DISTANCE, ArenaConfig.BALL_SIZE / 2 + 0.25, 0)
end

local function characterOf(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if root and humanoid and humanoid.Health > 0 then
		return character, root
	end
	return nil
end

local function send(player, kind, data)
	if player.Parent then
		arenaRemote:FireClient(player, kind, data)
	end
end

-- ===== Chut (llega desde ArenaService) =====

local function onKick(player, power, aim)
	local s = session
	if not s or s.player ~= player or not s.waiting then
		return
	end
	if type(power) ~= "number" or power ~= power then
		return
	end
	local _, root = characterOf(player)
	if not root or (ball.Position - root.Position).Magnitude > Cfg.KICK_RANGE then
		return
	end
	local direction
	if typeof(aim) == "Vector3" then
		local flat = aim * Vector3.new(1, 0, 1)
		if flat.Magnitude > 0.1 and flat.Magnitude < 10 then
			direction = flat.Unit
		end
	end
	direction = direction or (root.CFrame.LookVector * Vector3.new(1, 0, 1)).Unit
	power = math.clamp(power, 0, 1)
	ball.Anchored = false
	pcall(function()
		ball:SetNetworkOwner(nil) -- el servidor controla el balón (resultado fiable)
	end)
	local speed = ArenaConfig.KICK_MIN_SPEED + (ArenaConfig.KICK_MAX_SPEED - ArenaConfig.KICK_MIN_SPEED) * power
	local lift = ArenaConfig.KICK_MIN_LIFT + (ArenaConfig.KICK_MAX_LIFT - ArenaConfig.KICK_MIN_LIFT) * power * power * 0.6
	ball.AssemblyLinearVelocity = direction * speed + Vector3.new(0, lift, 0)
	kickSound:Play()
	s.waiting = false
	s.kickedAt = os.clock()
	-- El portero calcula dónde cruzará el balón la línea de gol (y a veces se equivoca de lado)
	local localVelocity = Cfg.ORIGIN:VectorToObjectSpace(ball.AssemblyLinearVelocity)
	local localBall = Cfg.ORIGIN:PointToObjectSpace(ball.Position)
	local predicted = localBall.Z
	if localVelocity.X > 1 then
		predicted = localBall.Z + localVelocity.Z * ((-localBall.X) / localVelocity.X)
	end
	if rng:NextNumber() < Cfg.KEEPER_WRONG_SIDE then
		predicted = -predicted
	end
	s.keeperTarget = predicted
end

-- ===== Desarrollo de la tanda =====

local function step(dt)
	local s = session
	if not s or not ball then
		return
	end
	if s.waiting then
		-- Portero atento: se balancea un poco en el centro
		setKeeper(math.sin(os.clock() * 2) * 1.2)
		return
	end
	if s.outcome then
		return
	end
	local elapsed = os.clock() - s.kickedAt
	if elapsed > Cfg.KEEPER_REACTION and s.keeperTarget then
		local current = Cfg.ORIGIN:PointToObjectSpace(keeper.Position).Z
		local delta = s.keeperTarget - current
		local move = math.sign(delta) * math.min(math.abs(delta), Cfg.KEEPER_SPEED * dt)
		setKeeper(current + move)
	end
	local p = Cfg.ORIGIN:PointToObjectSpace(ball.Position)
	if p.X > 0.8 and math.abs(p.Z) < HALF_GOAL and p.Y < Cfg.GOAL_HEIGHT then
		s.outcome = "goal"
	elseif elapsed > 2.5 or p.X > 6 or math.abs(p.Z) > 24 or p.X < -45 then
		s.outcome = s.saved and "saved" or "miss"
	end
end

local function finish(s, completed)
	s.player:SetAttribute("InPenalty", nil)
	session = nil
	if not completed then
		send(s.player, "penalty", { active = false })
		return
	end
	local reward = 0
	local now = os.time()
	local last = lastReward[s.player.UserId]
	local onCooldown = last and now - last < Cfg.REWARD_COOLDOWN
	if not onCooldown and DataService.Get(s.player) then
		lastReward[s.player.UserId] = now
		reward = s.goals * Cfg.REWARD_PER_GOAL + (s.goals == Cfg.SHOTS and Cfg.REWARD_PERFECT or 0)
		if reward > 0 then
			EconomyService.Earn(s.player, reward, EconomyService.Category.PRIZE, "Tanda de penaltis")
		end
		SeasonService.AddXP(s.player, Cfg.XP_PER_SESSION)
	end
	send(s.player, "penalty", {
		active = false, finished = true, goals = s.goals, shots = Cfg.SHOTS, reward = reward,
		cooldown = onCooldown and math.ceil(Cfg.REWARD_COOLDOWN - (now - last)) or nil,
	})
end

local function run(s)
	local player = s.player
	for shot = 1, Cfg.SHOTS do
		if session ~= s or not player.Parent or not characterOf(player) then
			finish(s, false)
			return
		end
		s.shot, s.waiting, s.outcome, s.saved, s.keeperTarget = shot, true, nil, false, nil
		placeBall(player)
		setKeeper(0)
		local character = characterOf(player)
		if character then
			-- Detrás del balón, mirando a la portería
			character:PivotTo(CFrame.lookAt(toWorld(-Cfg.SPOT_DISTANCE - 5, 3, 0), toWorld(0, 3, 0)))
		end
		send(player, "penalty", { active = true, shot = shot, shots = Cfg.SHOTS, goals = s.goals })
		local deadline = os.clock() + Cfg.SHOT_TIMEOUT
		while session == s and not s.outcome do
			if s.waiting and os.clock() > deadline then
				s.outcome = "timeout"
			end
			task.wait(0.05)
		end
		if session ~= s then
			return
		end
		if s.outcome == "goal" then
			s.goals += 1
		end
		send(player, "penaltyshot", { result = s.outcome, shot = shot, goals = s.goals, shots = Cfg.SHOTS })
		task.wait(1.6)
	end
	finish(s, true)
end

-- ===== API pública =====

function PenaltyService.Start(player)
	if not DataService.Get(player) then
		return false, "Tu club todavía se está cargando."
	end
	if session then
		if session.player == player then
			return false, "Ya estás tirando penaltis."
		end
		return false, string.format("Ahora está tirando %s. Espera a que termine.", session.player.DisplayName)
	end
	if ArenaService.IsBusy(player) then
		return false, "Estás en un partido en grupo o en su cola."
	end
	if not characterOf(player) then
		return false, "No se pudo empezar ahora."
	end
	local s = { player = player, shot = 0, goals = 0, waiting = false }
	session = s
	player:SetAttribute("InPenalty", true)
	task.spawn(function()
		local ok, err = pcall(run, s)
		if not ok then
			warn("[PenaltyService] Error en la tanda: ", err)
			if session == s then
				finish(s, false)
			end
		end
	end)
	return true, "⚽ ¡Tanda de penaltis! Mantén clic (o CHUTAR) y suelta. Apunta con la cámara a una esquina."
end

function PenaltyService.PlayerRemoving(player)
	if session and session.player == player then
		session = nil -- el bucle de la tanda lo detecta y termina
	end
end

function PenaltyService.Init()
	build()
	ArenaService.SetKickFallback(onKick)
	RunService.Heartbeat:Connect(step)
	Players.PlayerRemoving:Connect(PenaltyService.PlayerRemoving)
end

return PenaltyService
