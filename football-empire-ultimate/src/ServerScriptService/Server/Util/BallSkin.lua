-- BallSkin (ModuleScript)
-- Ubicación: ServerScriptService/Server/Util/BallSkin
--
-- Aplica a un balón el aspecto de un balón coleccionable (color, material, estela, brillos).
-- Es solo estética: no cambia la física del balón.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionConfig = require(ReplicatedStorage.Shared.Config.CollectionConfig)

local BallSkin = {}

local function mark(instance)
	instance:SetAttribute("SkinEffect", true)
	return instance
end

local function colorSequence(colors)
	if #colors == 1 then
		return ColorSequence.new(colors[1])
	end
	local keypoints = {}
	for i, color in ipairs(colors) do
		table.insert(keypoints, ColorSequenceKeypoint.new((i - 1) / (#colors - 1), color))
	end
	return ColorSequence.new(keypoints)
end

function BallSkin.Apply(ball, skinId)
	local skin = CollectionConfig.BallById[skinId] or CollectionConfig.BallById[CollectionConfig.DEFAULT_BALL]
	if ball:GetAttribute("Skin") == skin.id then
		return
	end
	ball:SetAttribute("Skin", skin.id)
	for _, child in ipairs(ball:GetChildren()) do
		if child:GetAttribute("SkinEffect") then
			child:Destroy()
		end
	end
	ball.Color = skin.color
	local ok, material = pcall(function()
		return Enum.Material[skin.material]
	end)
	ball.Material = ok and material or Enum.Material.SmoothPlastic

	if skin.trail then
		local radius = ball.Size.Y / 2
		local top = mark(Instance.new("Attachment"))
		top.Position = Vector3.new(0, radius * 0.8, 0)
		top.Parent = ball
		local bottom = mark(Instance.new("Attachment"))
		bottom.Position = Vector3.new(0, -radius * 0.8, 0)
		bottom.Parent = ball
		local trail = mark(Instance.new("Trail"))
		trail.Attachment0 = top
		trail.Attachment1 = bottom
		trail.Lifetime = 0.45
		trail.MinLength = 0.2
		trail.LightEmission = 0.6
		trail.Color = colorSequence(skin.trail)
		trail.Transparency = NumberSequence.new(0.15, 1)
		trail.Parent = ball
	end
	if skin.sparkles then
		local sparkles = mark(Instance.new("Sparkles"))
		sparkles.SparkleColor = skin.sparkles
		sparkles.Parent = ball
	end
	if skin.fire then
		local fire = mark(Instance.new("Fire"))
		fire.Size = 4
		fire.Heat = 6
		fire.Color = Color3.fromRGB(255, 170, 40)
		fire.SecondaryColor = Color3.fromRGB(255, 230, 120)
		fire.Parent = ball
	end
	if skin.light then
		local light = mark(Instance.new("PointLight"))
		light.Color = skin.light
		light.Range = 14
		light.Brightness = 1.5
		light.Parent = ball
	end
end

return BallSkin
