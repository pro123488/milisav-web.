-- MovementController (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Controllers/MovementController
--
-- Velocidad del personaje y SPRINT con resistencia:
--   * PC: mantener Shift · Mando: L3 · Móvil: botón «⚡ SPRINT».
--   * REGATE: tecla Q · mando B · móvil botón «💨»: impulso corto hacia donde corres (gasta resistencia).
--   * Es el único sitio que cambia WalkSpeed. Tiene en cuenta los atributos que pone el servidor:
--       Humanoid «Arena» (partido en grupo), «Frozen» (saque), «TrickSpeed» (truco de Halloween)
--       y Workspace «FEU_SpeedMultiplier» (evento admin de supervelocidad).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local MovementConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.MovementConfig)

local MovementController = {}

local player = Players.LocalPlayer
local stamina = MovementConfig.STAMINA_MAX
local sprintHeld = false
local sprinting = false
local lastSprint = 0
local barFrame, barFill
local lastDash = 0
local DASH_COOLDOWN = 2.5
local DASH_SPEED = 62
local DASH_COST = 25
local DASH_KEYS = { [Enum.KeyCode.Q] = true, [Enum.KeyCode.ButtonB] = true }

-- Impulso corto hacia donde se mueve el jugador (el personaje es del cliente: su física es local)
local function dash()
	local character = player.Character
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not hum or not root or hum:GetAttribute("Frozen") or hum.Health <= 0 then
		return
	end
	if os.clock() - lastDash < DASH_COOLDOWN or stamina < DASH_COST then
		return
	end
	local direction = hum.MoveDirection.Magnitude > 0.1 and hum.MoveDirection or root.CFrame.LookVector
	direction = direction * Vector3.new(1, 0, 1)
	if direction.Magnitude < 0.01 then
		return
	end
	lastDash = os.clock()
	stamina -= DASH_COST
	lastSprint = os.clock()
	local multiplier = Workspace:GetAttribute("FEU_SpeedMultiplier")
	multiplier = type(multiplier) == "number" and math.clamp(multiplier, 0.5, 2) or 1
	root.AssemblyLinearVelocity = direction.Unit * DASH_SPEED * multiplier + Vector3.new(0, root.AssemblyLinearVelocity.Y, 0)
end

local SPRINT_KEYS = {
	[Enum.KeyCode.LeftShift] = true,
	[Enum.KeyCode.RightShift] = true,
	[Enum.KeyCode.ButtonL3] = true,
}

local function humanoid()
	local character = player.Character
	return character and character:FindFirstChildOfClass("Humanoid")
end

local function speeds(hum)
	if hum:GetAttribute("Arena") then
		return MovementConfig.ARENA_WALK_SPEED, MovementConfig.ARENA_SPRINT_SPEED
	end
	return MovementConfig.WALK_SPEED, MovementConfig.SPRINT_SPEED
end

local function step(dt)
	local hum = humanoid()
	if not hum then
		return
	end
	local moving = hum.MoveDirection.Magnitude > 0.1
	local wantSprint = sprintHeld and moving
	if wantSprint and not sprinting and stamina >= MovementConfig.STAMINA_MIN_TO_START then
		sprinting = true
	elseif not wantSprint or stamina <= 0 then
		sprinting = false
	end
	if sprinting then
		stamina = math.max(0, stamina - MovementConfig.STAMINA_DRAIN * dt)
		lastSprint = os.clock()
	elseif os.clock() - lastSprint > MovementConfig.STAMINA_REGEN_DELAY then
		stamina = math.min(MovementConfig.STAMINA_MAX, stamina + MovementConfig.STAMINA_REGEN * dt)
	end

	local walk, sprint = speeds(hum)
	local multiplier = Workspace:GetAttribute("FEU_SpeedMultiplier")
	multiplier = type(multiplier) == "number" and math.clamp(multiplier, 0.5, 2) or 1
	local target
	if hum:GetAttribute("Frozen") then
		target = 0
	elseif type(hum:GetAttribute("TrickSpeed")) == "number" then
		target = hum:GetAttribute("TrickSpeed")
	else
		target = (sprinting and sprint or walk) * multiplier
	end
	if hum.WalkSpeed ~= target then
		hum.WalkSpeed = target
	end

	if barFrame then
		local ratio = stamina / MovementConfig.STAMINA_MAX
		barFill.Size = UDim2.fromScale(ratio, 1)
		barFill.BackgroundColor3 = ratio > 0.3 and Color3.fromRGB(80, 220, 255) or Color3.fromRGB(255, 120, 80)
		barFrame.Visible = sprinting or ratio < 0.999
	end
end

function MovementController.Init(gui, C, Theme)
	-- Barra de resistencia (abajo, centrada)
	barFrame = C.New("Frame", {
		Name = "Stamina",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -18),
		Size = UDim2.fromOffset(220, 10),
		BackgroundColor3 = Color3.fromRGB(20, 24, 34),
		BackgroundTransparency = 0.2,
		Visible = false,
		Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Theme.Stroke) },
	}, gui)
	barFill = C.New("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(80, 220, 255),
		Children = { C.Corner(UDim.new(1, 0)) },
	}, barFrame)
	C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 0, -2),
		Size = UDim2.fromOffset(220, 16),
		BackgroundTransparency = 1,
		Text = "⚡ SPRINT",
		Font = Theme.FontBold,
		TextSize = 12,
		TextColor3 = Color3.new(1, 1, 1),
		TextStrokeTransparency = 0.5,
	}, barFrame)

	-- Botón para móvil (mantener pulsado)
	if UserInputService.TouchEnabled then
		local button = C.New("TextButton", {
			Name = "SprintButton",
			AnchorPoint = Vector2.new(1, 1),
			Position = UDim2.new(1, -150, 1, -150),
			Size = UDim2.fromOffset(78, 78),
			BackgroundColor3 = Color3.fromRGB(30, 140, 220),
			BackgroundTransparency = 0.15,
			Text = "⚡\nSPRINT",
			Font = Theme.FontBold,
			TextSize = 14,
			TextColor3 = Color3.new(1, 1, 1),
			AutoButtonColor = true,
			Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Color3.new(1, 1, 1), 2, 0.4) },
		}, gui)
		button.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
				sprintHeld = true
			end
		end)
		button.InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
				sprintHeld = false
			end
		end)
		local dashButton = C.New("TextButton", {
			Name = "DashButton",
			AnchorPoint = Vector2.new(1, 1),
			Position = UDim2.new(1, -150, 1, -66),
			Size = UDim2.fromOffset(70, 70),
			BackgroundColor3 = Color3.fromRGB(120, 80, 220),
			BackgroundTransparency = 0.15,
			Text = "💨\nREGATE",
			Font = Theme.FontBold,
			TextSize = 12,
			TextColor3 = Color3.new(1, 1, 1),
			Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Color3.new(1, 1, 1), 2, 0.4) },
		}, gui)
		dashButton.Activated:Connect(dash)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if SPRINT_KEYS[input.KeyCode] and not (processed and UserInputService:GetFocusedTextBox()) then
			sprintHeld = true
		elseif DASH_KEYS[input.KeyCode] and not processed then
			dash()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if SPRINT_KEYS[input.KeyCode] then
			sprintHeld = false
		end
	end)
	RunService.RenderStepped:Connect(step)
end

return MovementController
