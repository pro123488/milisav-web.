-- RevealOverlay (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/RevealOverlay
--
-- Animación al abrir un huevo o una caja: el huevo tiembla, hay un destello y aparece lo que
-- ha tocado con el color de su rareza. Es solo una animación: el resultado ya lo ha decidido
-- y guardado el servidor antes de mostrarla. Se cierra sola o al hacer clic.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local SoundConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.SoundConfig)

local RevealOverlay = {}

local sound
local token = 0

-- info = { opener = "🥚", icon, name, rarityName, color, detail }
function RevealOverlay.Play(gui, deps, info)
	local C, Theme = deps.C, deps.Theme
	token += 1
	local current = token
	local old = gui:FindFirstChild("RevealOverlay")
	if old then
		old:Destroy()
	end
	if not sound then
		sound = Instance.new("Sound")
		sound.SoundId = "rbxassetid://" .. SoundConfig.REVEAL
		sound.Volume = 0.7
		sound.Parent = SoundService
	end

	local overlay = C.New("TextButton", {
		Name = "RevealOverlay",
		Text = "",
		AutoButtonColor = false,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 1,
		ZIndex = 60,
	}, gui)
	local big = C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Size = UDim2.fromOffset(220, 220),
		BackgroundTransparency = 1,
		Text = info.opener or "🥚",
		TextSize = 150,
		Font = Theme.FontBlack,
		TextColor3 = Color3.new(1, 1, 1),
		ZIndex = 61,
	}, overlay)
	local title = C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0.42, 120),
		Size = UDim2.fromOffset(600, 44),
		BackgroundTransparency = 1,
		Text = "",
		RichText = true,
		TextSize = 34,
		Font = Theme.FontBlack,
		TextColor3 = Color3.new(1, 1, 1),
		TextStrokeTransparency = 0.4,
		ZIndex = 61,
	}, overlay)
	local subtitle = C.New("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0.42, 168),
		Size = UDim2.fromOffset(600, 30),
		BackgroundTransparency = 1,
		Text = "",
		TextSize = 20,
		Font = Theme.FontBold,
		TextColor3 = info.color,
		TextStrokeTransparency = 0.5,
		ZIndex = 61,
	}, overlay)
	local flash = C.New("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = info.color,
		BackgroundTransparency = 1,
		ZIndex = 62,
	}, overlay)

	local closed = false
	local function close()
		if closed then
			return
		end
		closed = true
		overlay:Destroy()
	end
	overlay.Activated:Connect(function()
		if overlay:GetAttribute("Revealed") then
			close()
		end
	end)

	task.spawn(function()
		TweenService:Create(overlay, TweenInfo.new(0.25), { BackgroundTransparency = 0.35 }):Play()
		-- El huevo (o la caja) tiembla cada vez más
		for shake = 1, 7 do
			if closed or current ~= token then
				return
			end
			local angle = (shake % 2 == 0 and 1 or -1) * (6 + shake * 2)
			TweenService:Create(big, TweenInfo.new(0.12, Enum.EasingStyle.Sine), { Rotation = angle }):Play()
			task.wait(0.14)
		end
		if closed or current ~= token then
			return
		end
		-- Destello y aparece el premio
		flash.BackgroundTransparency = 0.1
		TweenService:Create(flash, TweenInfo.new(0.5), { BackgroundTransparency = 1 }):Play()
		big.Rotation = 0
		big.Text = info.icon
		big.TextSize = 60
		TweenService:Create(big, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { TextSize = 150 }):Play()
		title.Text = info.name
		subtitle.Text = string.upper(info.rarityName) .. (info.detail and (" · " .. info.detail) or "")
		sound:Play()
		overlay:SetAttribute("Revealed", true)
		task.wait(3)
		close()
	end)
end

return RevealOverlay
