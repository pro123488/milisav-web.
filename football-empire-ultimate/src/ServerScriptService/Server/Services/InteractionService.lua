-- InteractionService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/InteractionService
--
-- ESTADIO INTERACTIVO: el estadio se juega caminando, como cualquier juego de Roblox.
--   * Cada instalación tiene una indicación (ProximityPrompt, tecla E): el dueño abre
--     su menú directamente; un visitante ve de quién es el estadio (sin datos privados).
--   * Un balón físico en cada campo: se chuta al tocarlo y los goles se celebran.
-- Otros servicios (p. ej. el evento de Halloween) pueden añadir más indicaciones con OnFacility.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Remotes = require(Shared.Modules.Remotes)
local Layout = require(Shared.Modules.StadiumLayout)

local InteractionService = {}

local notifyRemote = Remotes.Get("Notify")

-- Qué abre cada instalación: { texto, pantalla, parámetros }
local ACTIONS = {
	lockers = { "Vestuario: ver la plantilla", "squad" },
	training = { "Entrenamiento: plantilla", "squad" },
	academy = { "Academia: ver la cantera", "academy" },
	trophyRoom = { "Sala de trofeos: historia", "history" },
	shop = { "Tienda: gestión comercial", "economy", { tab = "commercial" } },
	restaurant = { "Restaurante: gestión comercial", "economy", { tab = "commercial" } },
	kiosks = { "Quioscos: gestión comercial", "economy", { tab = "commercial" } },
	tour = { "Tour del estadio", "economy", { tab = "commercial" } },
	vip = { "Zona VIP: patrocinadores", "economy", { tab = "sponsors" } },
	sign = { "Mi club", "club" },
}

local facilityHooks = {}
local balls = {} -- [plot] = { ball, origin, lastKicker, cooldown }

function InteractionService.OnFacility(fn)
	table.insert(facilityHooks, fn)
end

-- Añade las indicaciones a las instalaciones recién construidas de un terreno.
function InteractionService.Attach(plot, owner, clubName)
	for _, part in ipairs(plot.stadium:GetDescendants()) do
		local facilityId = part:IsA("BasePart") and part:GetAttribute("Facility")
		local action = facilityId and ACTIONS[facilityId]
		if action then
			local prompt = Instance.new("ProximityPrompt")
			prompt.Name = "OpenPrompt"
			prompt.ActionText = action[1]
			prompt.ObjectText = clubName
			prompt.KeyboardKeyCode = Enum.KeyCode.E
			prompt.HoldDuration = 0
			prompt.MaxActivationDistance = 16
			prompt.RequiresLineOfSight = false
			prompt.Parent = part
			prompt.Triggered:Connect(function(player)
				if player == owner then
					notifyRemote:FireClient(player, "open", { screen = action[2], params = action[3] })
				else
					notifyRemote:FireClient(player, "info", string.format("🏟️ Estás visitando el estadio de %s (%s). Solo su dueño puede gestionarlo.",
						clubName, owner.DisplayName))
				end
			end)
			for _, hook in ipairs(facilityHooks) do
				hook(part, plot, owner, facilityId, clubName)
			end
		end
	end
end

-- ===== Balón =====

local KICK_SPEED = 55
local KICK_LIFT = 16
local BALL_SIZE = 2.6

local function centerCFrame(origin)
	return origin * CFrame.new(0, 3, Layout.PITCH_CENTER_Z)
end

local function resetBall(entry)
	entry.ball.AssemblyLinearVelocity = Vector3.zero
	entry.ball.AssemblyAngularVelocity = Vector3.zero
	entry.ball.CFrame = centerCFrame(entry.origin)
end

function InteractionService.EnsureBall(plot, owner)
	if balls[plot] and balls[plot].ball.Parent then
		balls[plot].owner = owner
		return
	end
	local ball = Instance.new("Part")
	ball.Name = "Ball"
	ball.Shape = Enum.PartType.Ball
	ball.Size = Vector3.new(BALL_SIZE, BALL_SIZE, BALL_SIZE)
	ball.Color = Color3.fromRGB(250, 250, 250)
	ball.Material = Enum.Material.SmoothPlastic
	ball.CustomPhysicalProperties = PhysicalProperties.new(0.25, 0.4, 0.5, 1, 1)
	ball.CFrame = centerCFrame(plot.origin)
	ball.Parent = plot.model
	ball:SetNetworkOwner(nil) -- el servidor controla el balón (goles fiables)
	local entry = { ball = ball, origin = plot.origin, owner = owner, kickCooldown = {}, celebrating = false }
	balls[plot] = entry
	ball.Touched:Connect(function(hit)
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not player or not root or entry.celebrating then
			return
		end
		local now = os.clock()
		if entry.kickCooldown[player] and now - entry.kickCooldown[player] < 0.25 then
			return
		end
		entry.kickCooldown[player] = now
		entry.lastKicker = player
		local direction = (ball.Position - root.Position) * Vector3.new(1, 0, 1)
		if direction.Magnitude < 0.1 then
			direction = root.CFrame.LookVector
		end
		ball.AssemblyLinearVelocity = direction.Unit * KICK_SPEED + Vector3.new(0, KICK_LIFT, 0)
	end)
end

function InteractionService.RemoveBall(plot)
	local entry = balls[plot]
	if entry then
		entry.ball:Destroy()
		balls[plot] = nil
	end
end

local function celebrate(entry, side)
	entry.celebrating = true
	local kicker = entry.lastKicker
	local goalPos = entry.origin * CFrame.new(side * Layout.PITCH_LENGTH / 2, 4, Layout.PITCH_CENTER_Z)
	local burst = Instance.new("Part")
	burst.Anchored = true
	burst.CanCollide = false
	burst.Transparency = 1
	burst.CFrame = goalPos
	burst.Parent = entry.ball.Parent
	local confetti = Instance.new("ParticleEmitter")
	confetti.Color = ColorSequence.new(Color3.fromRGB(255, 200, 40), Color3.fromRGB(40, 200, 120))
	confetti.Size = NumberSequence.new(0.5)
	confetti.Speed = NumberRange.new(15, 25)
	confetti.SpreadAngle = Vector2.new(60, 60)
	confetti.Lifetime = NumberRange.new(2, 3)
	confetti.Acceleration = Vector3.new(0, -20, 0)
	confetti.Rate = 0
	confetti.Parent = burst
	confetti:Emit(120)
	local text = string.format("⚽ ¡GOOOL%s en el estadio de %s!", kicker and (" de " .. kicker.DisplayName) or "",
		entry.owner and entry.owner.DisplayName or "?")
	local notified = {}
	for _, p in ipairs({ kicker or false, entry.owner or false }) do
		if p and p.Parent and not notified[p] then
			notified[p] = true
			notifyRemote:FireClient(p, "success", text)
		end
	end
	task.delay(3, function()
		burst:Destroy()
		if entry.ball.Parent then
			resetBall(entry)
		end
		entry.celebrating = false
	end)
end

function InteractionService.Start()
	RunService.Heartbeat:Connect(function()
		for _, entry in pairs(balls) do
			local ball = entry.ball
			if ball.Parent and not entry.celebrating then
				local p = entry.origin:PointToObjectSpace(ball.Position)
				local dz = math.abs(p.Z - Layout.PITCH_CENTER_Z)
				if math.abs(p.X) > Layout.PITCH_LENGTH / 2 + 0.5 and dz < 6 and p.Y < 6.5 then
					celebrate(entry, p.X > 0 and 1 or -1)
				elseif math.abs(p.X) > Layout.PITCH_LENGTH / 2 + 10 or dz > Layout.PITCH_WIDTH / 2 + 6 or p.Y < -10 or p.Y > 120 then
					resetBall(entry) -- fuera del campo: vuelve al centro
				end
			end
		end
	end)
end

return InteractionService
