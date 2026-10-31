--!nonstrict
-- WorldFX (cliente): lluvia, relámpagos moderados, objetos giratorios, flecha guía del tutorial,
-- correr con Shift y ajustes gráficos locales.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local WorldData = require(Shared.WorldData)
local QuestDefs = require(Shared.QuestDefs)
local State = require(script.Parent.State)

local FX = {}
local player = Players.LocalPlayer
local rainPart, rainEmitter
local guidePart, beam, guideTarget

local function ensureRain()
	if rainPart then
		return
	end
	rainPart = Instance.new("Part")
	rainPart.Name = "LocalRain"
	rainPart.Anchored = true
	rainPart.CanCollide = false
	rainPart.CanQuery = false
	rainPart.Transparency = 1
	rainPart.Size = Vector3.new(80, 1, 80)
	rainPart.Parent = workspace.CurrentCamera
	rainEmitter = Instance.new("ParticleEmitter")
	rainEmitter.Color = ColorSequence.new(Color3.fromRGB(190, 210, 240))
	rainEmitter.Size = NumberSequence.new(0.12)
	rainEmitter.Transparency = NumberSequence.new(0.3)
	rainEmitter.Speed = NumberRange.new(70, 90)
	rainEmitter.Lifetime = NumberRange.new(0.6, 0.9)
	rainEmitter.EmissionDirection = Enum.NormalId.Bottom
	rainEmitter.SpreadAngle = Vector2.new(4, 4)
	rainEmitter.LightEmission = 0.2
	rainEmitter.Rate = 0
	rainEmitter.Parent = rainPart
end

local function updateWeather()
	ensureRain()
	local w = workspace:GetAttribute("Weather") or "Clear"
	rainEmitter.Rate = (w == "Storm" and 900) or (w == "Rain" and 500) or 0
end

local function guidePosition()
	local data = State.Data
	if not data or data.Quests.Skipped then
		return nil
	end
	local step = QuestDefs.Tutorial[data.Quests.Step]
	if not step or not step.Marker then
		return nil
	end
	if step.Marker == "home" then
		local p = player:GetAttribute("HomePos")
		if data.Derived.AtHome then
			return nil
		end
		return p
	elseif step.Marker:sub(1, 6) == "store_" then
		local id = step.Marker:sub(7)
		for _, sp in ipairs(WorldData.Specials) do
			if sp.StoreId == id then
				return Vector3.new(sp.WX, 4, sp.WZ + 26)
			end
		end
	end
	return nil
end

local function updateGuide()
	local pos = guidePosition()
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not pos or not root then
		if beam then
			beam.Enabled = false
		end
		if guidePart then
			guidePart.Billboard.Enabled = false
		end
		return
	end
	if not guidePart then
		guidePart = Instance.new("Part")
		guidePart.Name = "TutorialTarget"
		guidePart.Anchored = true
		guidePart.CanCollide = false
		guidePart.CanQuery = false
		guidePart.Transparency = 1
		guidePart.Size = Vector3.new(1, 1, 1)
		guidePart.Parent = workspace.CurrentCamera
		local a1 = Instance.new("Attachment")
		a1.Name = "Target"
		a1.Parent = guidePart
		local bb = Instance.new("BillboardGui")
		bb.Name = "Billboard"
		bb.Size = UDim2.fromOffset(160, 40)
		bb.AlwaysOnTop = true
		bb.StudsOffset = Vector3.new(0, 6, 0)
		bb.Parent = guidePart
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 0.2
		t.BackgroundColor3 = Color3.fromRGB(255, 52, 82)
		t.TextColor3 = Color3.new(1, 1, 1)
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Text = "📍 Objetivo"
		t.Parent = bb
	end
	guidePart.Position = pos
	guidePart.Billboard.Enabled = true
	local a0 = root:FindFirstChild("GuideAttachment")
	if not a0 then
		a0 = Instance.new("Attachment")
		a0.Name = "GuideAttachment"
		a0.Parent = root
	end
	if not beam or beam.Attachment0 ~= a0 then
		if beam then
			beam:Destroy()
		end
		beam = Instance.new("Beam")
		beam.Attachment0 = a0
		beam.Attachment1 = guidePart.Target
		beam.Color = ColorSequence.new(Color3.fromRGB(255, 52, 82), Color3.fromRGB(255, 214, 0))
		beam.Width0 = 0.6
		beam.Width1 = 0.6
		beam.FaceCamera = true
		beam.LightEmission = 1
		beam.Segments = 10
		beam.Parent = guidePart
	end
	beam.Enabled = true
end

function FX.applySettings()
	local data = State.Data
	if not data then
		return
	end
	Lighting.GlobalShadows = data.Settings.Shadows ~= false
end

function FX.start()
	updateWeather()
	workspace:GetAttributeChangedSignal("Weather"):Connect(updateWeather)
	-- Relámpagos moderados durante tormentas
	task.spawn(function()
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Name = "Lightning"
		cc.Parent = Lighting
		while true do
			task.wait(math.random(12, 25))
			if workspace:GetAttribute("Weather") == "Storm" and not (State.Data and State.Data.Settings.ReduceMotion) then
				cc.Brightness = 0.35
				task.wait(0.08)
				cc.Brightness = 0
				task.wait(0.12)
				cc.Brightness = 0.2
				task.wait(0.06)
				cc.Brightness = 0
			end
		end
	end)
	-- Lluvia siguiendo a la cámara + objetos giratorios
	local spinAngle = 0
	RunService.RenderStepped:Connect(function(dt)
		if rainPart then
			rainPart.CFrame = CFrame.new(workspace.CurrentCamera.CFrame.Position + Vector3.new(0, 35, 0))
		end
		spinAngle = spinAngle + dt
		for _, obj in ipairs(CollectionService:GetTagged("Spin")) do
			if obj:IsA("Model") and obj.PrimaryPart then
				local base = obj:GetAttribute("BaseCF")
				if not base then
					obj:SetAttribute("BaseCF", obj.PrimaryPart.CFrame)
					base = obj.PrimaryPart.CFrame
				end
				obj:PivotTo(base * CFrame.Angles(0, 0, spinAngle * 0.15))
			elseif obj:IsA("BasePart") then
				obj.CFrame = obj.CFrame * CFrame.Angles(0, dt * 1.5, 0)
			end
		end
	end)
	-- Flecha guía
	task.spawn(function()
		while true do
			pcall(updateGuide)
			task.wait(0.5)
		end
	end)
	-- Correr con Shift
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.LeftShift then
			local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if hum then
				hum.WalkSpeed = 28
			end
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftShift then
			local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if hum then
				hum.WalkSpeed = 18
			end
		end
	end)
	State.on(FX.applySettings)
end

return FX
