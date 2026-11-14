-- MusicController (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Controllers/MusicController
--
-- Música de fondo (solo en el cliente de cada jugador): reproduce la lista de MusicConfig en bucle.
-- El botón 🎵 la silencia o la activa; la preferencia se guarda en la configuración del club.
-- Si una pista no carga (ID retirado, sin conexión…), se salta a la siguiente sin romper nada.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")

local MusicConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.MusicConfig)

local MusicController = {}

local sound
local button
local enabled = false -- empieza en silencio hasta saber la preferencia guardada del jugador
local index = 0
local token = 0 -- cambia en cada pista: invalida las esperas de la anterior

local function refreshButton()
	if button then
		button.Text = enabled and "🎵" or "🔇"
		button.BackgroundTransparency = enabled and 0.15 or 0.45
	end
end

local function playNext()
	if #MusicConfig.Tracks == 0 then
		return
	end
	index = index % #MusicConfig.Tracks + 1
	token += 1
	local current = token
	sound:Stop()
	sound.SoundId = "rbxassetid://" .. MusicConfig.Tracks[index].id
	sound.TimePosition = 0
	if enabled then
		sound:Play()
	end
	-- Si no llega a cargar, se prueba la siguiente (como mucho una vuelta completa)
	task.delay(12, function()
		if current == token and enabled and not sound.IsLoaded then
			MusicController._failed = (MusicController._failed or 0) + 1
			if MusicController._failed < #MusicConfig.Tracks then
				playNext()
			end
		elseif current == token and sound.IsLoaded then
			MusicController._failed = 0
		end
	end)
end

function MusicController.SetEnabled(value)
	value = value ~= false
	if value == enabled then
		return
	end
	enabled = value
	refreshButton()
	if not sound then
		return
	end
	if enabled then
		if sound.SoundId == "" then
			playNext()
		else
			sound:Resume()
		end
	else
		sound:Pause()
	end
end

-- deps = { C, Theme, onToggle(enabled) }
function MusicController.Init(gui, deps)
	local C, Theme = deps.C, deps.Theme
	sound = Instance.new("Sound")
	sound.Name = "FEU_Music"
	sound.Volume = MusicConfig.VOLUME
	sound.Looped = false
	sound.Parent = SoundService
	sound.Ended:Connect(playNext)

	button = C.New("TextButton", {
		Name = "MusicButton",
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 64),
		Size = UDim2.fromOffset(40, 40),
		BackgroundColor3 = Theme.Panel,
		BackgroundTransparency = 0.15,
		Text = "🎵",
		Font = Theme.FontBold,
		TextSize = 20,
		TextColor3 = Color3.new(1, 1, 1),
		Children = { C.Corner(UDim.new(1, 0)), C.Stroke(Theme.Stroke) },
	}, gui)
	button.Activated:Connect(function()
		MusicController.SetEnabled(not enabled)
		if deps.onToggle then
			task.spawn(deps.onToggle, enabled)
		end
	end)
	refreshButton()
end

return MusicController
