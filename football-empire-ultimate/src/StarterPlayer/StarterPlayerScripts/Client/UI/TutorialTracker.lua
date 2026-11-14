-- TutorialTracker (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/TutorialTracker
--
-- Indicador de «Primeros pasos» en pantalla: muestra el paso actual de la guía y su premio.
-- Al pulsarlo abre la pantalla donde se hace ese paso. El progreso y los premios los lleva el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TutorialConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.TutorialConfig)

local TutorialTracker = {}

local button
local current -- paso que se está mostrando
local navigate, notify

function TutorialTracker.Update(state)
	if not button then
		return
	end
	local tutorial = state and state.tutorial
	local step = tutorial and not tutorial.finished and TutorialConfig.Steps[tutorial.step]
	current = step or nil
	button.Visible = step ~= nil
	if step then
		button.Text = string.format("📌 Primeros pasos (%d/%d): %s  ·  +%d $", tutorial.step, #TutorialConfig.Steps, step.text, step.money)
	end
end

-- deps = { C, Theme, navigate(screen, params), notify(kind, text) }
function TutorialTracker.Init(gui, deps)
	local C, Theme = deps.C, deps.Theme
	navigate, notify = deps.navigate, deps.notify
	button = C.New("TextButton", {
		Name = "TutorialTracker",
		Position = UDim2.fromOffset(16, 164),
		Size = UDim2.fromOffset(360, 46),
		BackgroundColor3 = Color3.fromRGB(24, 44, 78),
		BackgroundTransparency = 0.1,
		Text = "",
		Font = Theme.FontBold,
		TextSize = 14,
		TextWrapped = true,
		TextColor3 = Color3.new(1, 1, 1),
		TextXAlignment = Enum.TextXAlignment.Left,
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 1, 0.4), C.Padding(4, 10) },
	}, gui)
	button.Activated:Connect(function()
		if not current then
			return
		end
		if current.screen then
			navigate(current.screen, current.params)
		else
			notify("info", "👉 " .. current.text)
		end
	end)
end

return TutorialTracker
