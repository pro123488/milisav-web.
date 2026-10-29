-- InvitePrompt (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/InvitePrompt
-- Ventana para aceptar o rechazar una invitación a partido de otro club del servidor (FASE 9).

local Players = game:GetService("Players")

local Theme = require(script.Parent.Theme)
local C = require(script.Parent.Components)

local InvitePrompt = {}

local current

function InvitePrompt.Show(ctx, info, onResult)
	if current then
		current:Destroy()
	end
	local gui = C.New("ScreenGui", { Name = "FEU_Invite", ResetOnSpawn = false, DisplayOrder = 8 }, Players.LocalPlayer:WaitForChild("PlayerGui"))
	current = gui
	local panel = C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 130),
		Size = UDim2.new(0.9, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Panel,
		Children = { C.Corner(), C.Stroke(Theme.Gold, 2), C.Padding(14), C.List(nil, 8),
			C.New("UISizeConstraint", { MaxSize = Vector2.new(460, math.huge) }) },
	}, gui)
	C.Label(string.format("⚽ <b>%s</b> (%s) te invita a un partido amistoso entre clubes.", info.clubName, info.fromName), { TextSize = 16, LayoutOrder = 1 }).Parent = panel
	C.Label(string.format("Media de su once: %d · Partido simulado en su estadio · sin premios en juego.", info.strength), { TextSize = 13, TextColor3 = Theme.TextDim, LayoutOrder = 2 }).Parent = panel
	local function respond(accept)
		if gui.Parent then
			gui:Destroy()
		end
		local result = ctx.act("RespondInvite", { accept = accept })
		if onResult then
			onResult(result)
		end
	end
	local row = C.Row({
		C.Button("✅ Aceptar", "primary", function()
			respond(true)
		end),
		C.Button("❌ Rechazar", "danger", function()
			respond(false)
		end),
	}, 10)
	row.LayoutOrder = 3
	row.Parent = panel
	task.delay(info.seconds or 60, function()
		if gui.Parent then
			gui:Destroy()
		end
	end)
end

return InvitePrompt
