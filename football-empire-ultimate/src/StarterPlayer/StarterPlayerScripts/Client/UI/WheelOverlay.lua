-- WheelOverlay (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/WheelOverlay
--
-- Animación de la RULETA DE LA SUERTE: la rueda gira varias vueltas y se para en el premio que
-- YA ha elegido y entregado el servidor (index). Solo es una animación.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local RewardConfig = require(Shared.Config.RewardConfig)
local SoundConfig = require(Shared.Config.SoundConfig)

local WheelOverlay = {}

local RADIUS = 150
local sound

function WheelOverlay.Play(gui, deps, index, resultText)
	local C, Theme = deps.C, deps.Theme
	local old = gui:FindFirstChild("WheelOverlay")
	if old then
		old:Destroy()
	end
	local segments = RewardConfig.Wheel
	local step = 360 / #segments

	local overlay = C.New("TextButton", {
		Name = "WheelOverlay",
		Text = "",
		AutoButtonColor = false,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.35,
		ZIndex = 60,
	}, gui)
	local wheel = C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.45),
		Size = UDim2.fromOffset(RADIUS * 2, RADIUS * 2),
		BackgroundColor3 = Color3.fromRGB(25, 28, 40),
		ZIndex = 61,
		Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Theme.Gold, 4, 0) },
	}, overlay)
	-- Cada premio es una «porción» (rectángulo de color desde el centro) con su texto
	for i, segment in ipairs(segments) do
		local angle = (i - 1) * step
		-- Ángulo 0 = arriba, creciendo en sentido horario (igual que la rotación de la rueda)
		local rad = math.rad(angle)
		local half = (RADIUS - 8) / 2
		local spoke = C.New("Frame", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.new(0.5, math.sin(rad) * half, 0.5, -math.cos(rad) * half),
			Size = UDim2.fromOffset(math.floor(2 * math.pi * RADIUS / #segments) - 6, RADIUS - 8),
			Rotation = angle,
			BackgroundColor3 = segment.color,
			BackgroundTransparency = 0.05,
			ZIndex = 62,
			Children = { C.Corner(UDim.new(0, 10)) },
		}, wheel)
		C.New("TextLabel", {
			Size = UDim2.new(1, 0, 0.45, 0),
			BackgroundTransparency = 1,
			Text = segment.label,
			Font = Theme.FontBlack,
			TextScaled = true,
			TextColor3 = Color3.new(1, 1, 1),
			TextStrokeTransparency = 0.3,
			ZIndex = 63,
		}, spoke)
	end
	C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(46, 46),
		BackgroundColor3 = Theme.Gold,
		ZIndex = 64,
		Children = { C.Corner(UDim.new(1, 0)) },
	}, wheel)
	-- Puntero fijo arriba
	C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 0.45, -RADIUS + 14),
		Size = UDim2.fromOffset(60, 50),
		BackgroundTransparency = 1,
		Text = "🔻",
		TextSize = 44,
		ZIndex = 65,
	}, overlay)
	local result = C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0.45, RADIUS + 18),
		Size = UDim2.fromOffset(600, 40),
		BackgroundTransparency = 1,
		Text = "🎡 Girando…",
		TextSize = 26,
		Font = Theme.FontBlack,
		TextColor3 = Color3.new(1, 1, 1),
		TextStrokeTransparency = 0.4,
		ZIndex = 65,
	}, overlay)

	-- El premio «index» tiene que acabar arriba: la rueda gira -ángulo del premio (+ vueltas)
	local target = 360 * 5 - (index - 1) * step
	local tween = TweenService:Create(wheel, TweenInfo.new(3.6, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Rotation = target })
	tween:Play()
	local closed = false
	overlay.Activated:Connect(function()
		if overlay:GetAttribute("Done") then
			closed = true
			overlay:Destroy()
		end
	end)
	tween.Completed:Connect(function()
		if closed then
			return
		end
		result.Text = resultText
		overlay:SetAttribute("Done", true)
		if not sound then
			sound = Instance.new("Sound")
			sound.SoundId = "rbxassetid://" .. SoundConfig.REVEAL
			sound.Volume = 0.7
			sound.Parent = SoundService
		end
		sound:Play()
		task.delay(3, function()
			if not closed and overlay.Parent then
				overlay:Destroy()
			end
		end)
	end)
end

return WheelOverlay
