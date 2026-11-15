-- PlaytimeGifts (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/PlaytimeGifts
--
-- Botón «🎁 Regalos por jugar»: cuenta atrás hasta el siguiente regalo de la sesión y, cuando
-- hay alguno listo, lo reclama al pulsarlo. El tiempo y los premios los decide el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RewardConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.RewardConfig)

local PlaytimeGifts = {}

local button
local info -- { elapsed, claimed } del último estado
local receivedAt = os.clock()

local function refresh()
	if not button then
		return
	end
	if not info then
		button.Visible = false
		return
	end
	local elapsed = info.elapsed + (os.clock() - receivedAt)
	local ready, nextGift = 0, nil
	for index, gift in ipairs(RewardConfig.Playtime) do
		if not info.claimed[index] then
			if elapsed >= gift.minutes * 60 then
				ready += 1
			elseif not nextGift then
				nextGift = gift
			end
		end
	end
	if ready > 0 then
		button.Visible = true
		button.Text = string.format("🎁 ¡%d regalo%s listo%s! Pulsa", ready, ready == 1 and "" or "s", ready == 1 and "" or "s")
		button.BackgroundColor3 = Color3.fromRGB(200, 140, 20)
	elseif nextGift then
		local left = math.max(0, math.ceil(nextGift.minutes * 60 - elapsed))
		button.Visible = true
		button.Text = string.format("🎁 Regalo en %d:%02d · %s", math.floor(left / 60), left % 60, RewardConfig.Describe(nextGift))
		button.BackgroundColor3 = Color3.fromRGB(40, 50, 80)
	else
		button.Visible = false -- todos los regalos de esta sesión reclamados
	end
end

function PlaytimeGifts.Update(state)
	info = state and state.playtime or nil
	receivedAt = os.clock()
	refresh()
end

-- deps = { C, Theme, act }
function PlaytimeGifts.Init(gui, deps)
	local C, Theme = deps.C, deps.Theme
	button = C.New("TextButton", {
		Name = "PlaytimeGifts",
		Position = UDim2.fromOffset(16, 216),
		Size = UDim2.fromOffset(300, 36),
		BackgroundColor3 = Color3.fromRGB(40, 50, 80),
		BackgroundTransparency = 0.1,
		Text = "",
		Font = Theme.FontBold,
		TextSize = 13,
		TextColor3 = Color3.new(1, 1, 1),
		TextTruncate = Enum.TextTruncate.AtEnd,
		Visible = false,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 1, 0.5), C.Padding(4, 10) },
	}, gui)
	button.Activated:Connect(function()
		task.spawn(deps.act, "ClaimPlaytime")
	end)
	task.spawn(function()
		while true do
			refresh()
			task.wait(1)
		end
	end)
end

return PlaytimeGifts
