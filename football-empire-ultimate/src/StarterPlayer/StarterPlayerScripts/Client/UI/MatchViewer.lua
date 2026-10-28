-- MatchViewer (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/MatchViewer
--
-- Reproduce el RESUMEN de un partido simulado que ya ha calculado el servidor.
-- Se identifica siempre como "SIMULACIÓN": no es un partido controlable.

local Players = game:GetService("Players")

local Theme = require(script.Parent.Theme)
local C = require(script.Parent.Components)
local Format = require(game:GetService("ReplicatedStorage"):WaitForChild("Shared").Modules.Format)

local MatchViewer = {}

local PLAYBACK_SECONDS = 15
local current

function MatchViewer.Close()
	if current then
		current.closed = true
		current.gui:Destroy()
		current = nil
	end
end

function MatchViewer.Show(result)
	MatchViewer.Close()
	local session = { closed = false }
	current = session
	local gui = C.New("ScreenGui", {
		Name = "FEU_MatchViewer",
		ResetOnSpawn = false,
		DisplayOrder = 10,
	}, Players.LocalPlayer:WaitForChild("PlayerGui"))
	session.gui = gui
	C.New("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, Size = UDim2.fromScale(1, 1) }, gui)
	local panel = C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(0.92, 0, 0.86, 0),
		BackgroundColor3 = Theme.Background,
		Children = {
			C.Corner(UDim.new(0, 16)), C.Stroke(Theme.Accent, 2), C.Padding(16),
			C.New("UISizeConstraint", { MaxSize = Vector2.new(640, 720) }),
		},
	}, gui)

	C.Badge("⚽ PARTIDO SIMULADO · " .. tostring(result.competition or "Amistoso"), Theme.Info).Parent = panel
	local scoreLabel = C.Label("", {
		Font = Theme.FontBlack, TextSize = 30, TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 34), Size = UDim2.new(1, 0, 0, 40), AutomaticSize = Enum.AutomaticSize.None,
	})
	scoreLabel.Parent = panel
	local namesLabel = C.Label(string.format("%s  vs  %s", result.home.name, result.away.name), {
		TextSize = 14, TextColor3 = Theme.TextDim, TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 74), Size = UDim2.new(1, 0, 0, 20), AutomaticSize = Enum.AutomaticSize.None,
	})
	namesLabel.Parent = panel
	local minuteLabel = C.Label("0'", {
		Font = Theme.FontBold, TextSize = 16, TextColor3 = Theme.Gold, TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 96), Size = UDim2.new(1, 0, 0, 20), AutomaticSize = Enum.AutomaticSize.None,
	})
	minuteLabel.Parent = panel

	local log = C.Scroll({
		Position = UDim2.fromOffset(0, 124),
		Size = UDim2.new(1, 0, 1, -190),
	})
	log.Parent = panel
	local addLog = C.Stack(log)

	local footer = C.Row({}, 10, {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, 0),
		Size = UDim2.new(1, 0, 0, 50),
		AutomaticSize = Enum.AutomaticSize.None,
	})
	footer.Parent = panel
	local finished = false
	local skipButton
	local function finish()
		if finished or session.closed then
			return
		end
		finished = true
		minuteLabel.Text = "Final del partido"
		scoreLabel.Text = string.format("%s  %d - %d  %s", result.home.short, result.home.goals, result.away.goals, result.away.short)
		local us = result.userSide == 1 and result.home or result.away
		local them = result.userSide == 1 and result.away or result.home
		local outcomeText = result.outcome == "W" and "🏆 ¡Victoria!" or (result.outcome == "D" and "🤝 Empate" or "😞 Derrota")
		addLog(C.Card({ BackgroundColor3 = Theme.Panel }, {
			C.Title(outcomeText, 20),
			C.Label(string.format("Posesión %d%% - %d%% · Tiros %d - %d · A puerta %d - %d",
				result.home.possession, result.away.possession, result.home.shots, result.away.shots,
				result.home.onTarget, result.away.onTarget), { TextSize = 14 }),
			C.Label(result.mvp and string.format("⭐ Mejor jugador: %s (%.1f)", result.mvp.name, result.mvp.rating) or "", { TextSize = 14 }),
			C.Label(string.format("Premio: %s · Reputación %+d · Satisfacción %+d · Tu equipo: %d tiros, rival: %d",
				Format.Money(result.prize or 0), result.reputation or 0, result.satisfaction or 0, us.shots, them.shots), { TextSize = 13, TextColor3 = Theme.TextDim }),
		}))
		if skipButton then
			skipButton:Destroy()
		end
	end

	local shown = 0
	local function showUntil(minute)
		local home, away = 0, 0
		for i, event in ipairs(result.events) do
			if event.minute <= minute then
				if event.type == "goal" then
					if event.side == 1 then
						home += 1
					else
						away += 1
					end
				end
				if i > shown then
					shown = i
					local team = event.side == 1 and result.home.short or result.away.short
					local text
					if event.type == "goal" then
						text = string.format("<b>%d'  ⚽ ¡GOL de %s! (%s)</b>%s", event.minute, event.player, team,
							event.assist and ("  · asistencia de " .. event.assist) or "")
					elseif event.type == "save" then
						text = string.format("%d'  🧤 Parada al disparo de %s (%s)", event.minute, event.player, team)
					else
						text = string.format("%d'  ❌ %s (%s) dispara fuera", event.minute, event.player, team)
					end
					addLog(C.Label(text, { TextSize = 14, TextColor3 = event.type == "goal" and Theme.Gold or Theme.Text }))
					task.defer(function()
						if log.Parent then
							log.CanvasPosition = Vector2.new(0, math.huge)
						end
					end)
				end
			end
		end
		scoreLabel.Text = string.format("%s  %d - %d  %s", result.home.short, home, away, result.away.short)
		minuteLabel.Text = string.format("%d'", math.floor(minute))
	end

	skipButton = C.Button("⏭ Ver resultado final", "secondary", function()
		showUntil(90)
		finish()
	end)
	skipButton.Parent = footer
	C.Button("Cerrar", "primary", MatchViewer.Close).Parent = footer

	task.spawn(function()
		local start = os.clock()
		while not session.closed and not finished do
			local minute = math.min(90, (os.clock() - start) / PLAYBACK_SECONDS * 90)
			showUntil(minute)
			if minute >= 90 then
				finish()
				break
			end
			task.wait(0.2)
		end
	end)
end

return MatchViewer
