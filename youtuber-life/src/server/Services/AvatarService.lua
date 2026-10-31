--!nonstrict
-- AvatarService: aparición en casa, apariencia (colores de ropa) y cartel sobre la cabeza
-- (nombre, rango, título y suscriptores). Respeta el avatar de Roblox si el jugador lo prefiere.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Util = require(Shared.Util)
local VideoData = require(Shared.VideoData)

local Avatar = {}
local S

-- Colores disponibles para ropa (no se cambia el tono de piel)
Avatar.Colors = {
	{ 240, 240, 240 }, { 30, 30, 35 }, { 200, 40, 40 }, { 40, 90, 200 }, { 50, 160, 90 }, { 250, 200, 40 },
	{ 255, 120, 0 }, { 140, 70, 200 }, { 255, 110, 170 }, { 120, 85, 60 }, { 90, 100, 110 }, { 0, 170, 190 },
}

function Avatar.Init(services)
	S = services
end

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

function Avatar.applyAppearance(player)
	local data = S.Data.get(player)
	local char = player.Character
	if not data or not char then
		return
	end
	local a = data.Appearance
	if a.Mode ~= "custom" then
		return
	end
	for _, c in ipairs(char:GetChildren()) do
		if c:IsA("Shirt") or c:IsA("Pants") or c:IsA("ShirtGraphic") then
			c:Destroy()
		end
	end
	local shirt = rgb(Avatar.Colors[a.Shirt] or Avatar.Colors[5])
	local pants = rgb(Avatar.Colors[a.Pants] or Avatar.Colors[2])
	for _, part in ipairs(char:GetChildren()) do
		if part:IsA("BasePart") then
			local n = part.Name
			if n == "UpperTorso" or n == "LowerTorso" or n == "Torso" or n:find("UpperArm") or n == "Left Arm" or n == "Right Arm" then
				part.Color = shirt
			elseif n:find("Leg") or n:find("Foot") then
				part.Color = pants
			end
		end
	end
	local bc = char:FindFirstChildOfClass("BodyColors")
	if bc then
		bc.TorsoColor3 = shirt
		bc.LeftLegColor3 = pants
		bc.RightLegColor3 = pants
	end
end

function Avatar.refreshOverhead(player)
	local data = S.Data.get(player)
	local char = player.Character
	local head = char and char:FindFirstChild("Head")
	if not data or not head then
		return
	end
	local gui = head:FindFirstChild("CreatorTag")
	if not gui then
		gui = Instance.new("BillboardGui")
		gui.Name = "CreatorTag"
		gui.Size = UDim2.fromOffset(220, 64)
		gui.StudsOffset = Vector3.new(0, 2.6, 0)
		gui.MaxDistance = 80
		gui.AlwaysOnTop = false
		gui.Parent = head
		local name = Instance.new("TextLabel")
		name.Name = "NameLabel"
		name.BackgroundTransparency = 1
		name.Size = UDim2.new(1, 0, 0.45, 0)
		name.Font = Enum.Font.GothamBlack
		name.TextScaled = true
		name.TextColor3 = Color3.new(1, 1, 1)
		name.TextStrokeTransparency = 0.4
		name.Parent = gui
		local sub = Instance.new("TextLabel")
		sub.Name = "SubLabel"
		sub.BackgroundTransparency = 1
		sub.Position = UDim2.new(0, 0, 0.45, 0)
		sub.Size = UDim2.new(1, 0, 0.3, 0)
		sub.Font = Enum.Font.GothamBold
		sub.TextScaled = true
		sub.TextColor3 = Color3.fromRGB(255, 214, 0)
		sub.TextStrokeTransparency = 0.5
		sub.Parent = gui
		local title = Instance.new("TextLabel")
		title.Name = "TitleLabel"
		title.BackgroundTransparency = 1
		title.Position = UDim2.new(0, 0, 0.75, 0)
		title.Size = UDim2.new(1, 0, 0.25, 0)
		title.Font = Enum.Font.GothamMedium
		title.TextScaled = true
		title.TextColor3 = Color3.fromRGB(150, 220, 255)
		title.TextStrokeTransparency = 0.5
		title.Parent = gui
	end
	local _, rank = S.Progress.rank(data)
	local channel = data.Channel.Name ~= "" and data.Channel.Name or player.DisplayName
	local vip = S.Monetization.owns(player, "VIP") and "⭐ " or ""
	gui.NameLabel.Text = vip .. VideoData.Avatars[data.Channel.Avatar] .. " " .. channel
	gui.SubLabel.Text = rank.Name .. " · " .. Util.formatShort(data.Channel.Subs) .. " subs"
	gui.TitleLabel.Text = data.EquippedTitle ~= "" and ("«" .. data.EquippedTitle .. "»") or ""
	-- ocultar el nombre por defecto de Roblox
	local hum = char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	end
end

function Avatar.onCharacter(player, char)
	local hum = char:WaitForChild("Humanoid", 10)
	char:WaitForChild("HumanoidRootPart", 10)
	if not hum then
		return
	end
	hum.WalkSpeed = 18
	local cf = S.Home.spawnCFrame(player)
	if cf then
		task.wait(0.1)
		char:PivotTo(cf)
	end
	Avatar.applyAppearance(player)
	Avatar.refreshOverhead(player)
end

function Avatar.Start()
	local Net = S.Net

	Net.on("Style.Set", function(player, p)
		local data = S.Data.get(player)
		local a = data.Appearance
		if p.mode == "roblox" then
			a.Mode = "roblox"
			a.Chosen = true
			S.Quest.tutorialEvent(player, "appearance")
			player:LoadCharacter()
			return true, "Usarás tu avatar de Roblox."
		end
		local shirt, pants = tonumber(p.shirt), tonumber(p.pants)
		if not shirt or not pants or not Avatar.Colors[shirt] or not Avatar.Colors[pants] then
			return false, "Colores no válidos."
		end
		a.Mode = "custom"
		a.Shirt, a.Pants = shirt, pants
		a.Chosen = true
		Avatar.applyAppearance(player)
		S.Quest.tutorialEvent(player, "appearance")
		return true, "¡Nuevo estilo aplicado!"
	end)

	Net.on("Style.SaveOutfit", function(player, p)
		local data = S.Data.get(player)
		local slot = tonumber(p.slot)
		if not slot or slot < 1 or slot > 3 then
			return false, "Espacio no válido."
		end
		data.Appearance.Outfits = data.Appearance.Outfits or {}
		data.Appearance.Outfits[tostring(slot)] = { Shirt = data.Appearance.Shirt, Pants = data.Appearance.Pants }
		return true, "Conjunto guardado en el espacio " .. slot .. "."
	end)
end

return Avatar
