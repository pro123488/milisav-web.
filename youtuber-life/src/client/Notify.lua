--!nonstrict
-- Notify (cliente): avisos emergentes, diálogos de NPC, logros y confirmaciones.

local UI = require(script.Parent.UIKit)
local State = require(script.Parent.State)
local T = UI.Theme

local Notify = {}
local gui, stack, dialogFrame

function Notify.init(screenGui, sound)
	gui = screenGui
	Notify.Sound = sound
	stack = UI.frame(gui, { Size = UDim2.new(0, 360, 1, -140), Position = UDim2.new(1, -16, 0, 90), Anchor = Vector2.new(1, 0), Transparency = 1, Radius = false, Name = "Toasts" })
	stack.ZIndex = 50
	local layout = UI.list(stack, Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Right)
	stack.UIListLayout.VerticalAlignment = Enum.VerticalAlignment.Top
end

local colors = { success = T.Ok, error = T.Err, warn = T.Warn, info = T.Accent2, gold = T.Gold }

function Notify.toast(text, style)
	if not stack then
		return
	end
	style = style or "info"
	State.addMessage(text, style)
	if Notify.Sound then
		Notify.Sound.play(style == "error" and "Error" or "Notify")
	end
	local f = UI.frame(stack, { Size = UDim2.new(1, 0, 0, 0), Auto = Enum.AutomaticSize.Y, Color = T.Panel, Transparency = 0.05 })
	UI.stroke(f, colors[style] or T.Accent2, 2)
	UI.padding(f, 10)
	local l = UI.label(f, text, { Auto = Enum.AutomaticSize.Y, Height = 0, TextSize = 14 })
	l.Size = UDim2.new(1, 0, 0, 0)
	f.Position = UDim2.new(1, 40, 0, 0)
	task.delay(style == "error" and 5 or 4, function()
		if f.Parent then
			UI.tween(f, { BackgroundTransparency = 1 }, 0.3)
			UI.tween(l, { TextTransparency = 1 }, 0.3)
			task.wait(0.32)
			f:Destroy()
		end
	end)
	while #stack:GetChildren() > 7 do
		for _, c in ipairs(stack:GetChildren()) do
			if c:IsA("Frame") then
				c:Destroy()
				break
			end
		end
	end
end

-- Banner grande centrado (subida de nivel, logros, secretos)
function Notify.banner(title, subtitle, color)
	if not gui then
		return
	end
	if Notify.Sound then
		Notify.Sound.play("Cash")
	end
	local f = UI.frame(gui, { Size = UDim2.fromOffset(440, 90), Position = UDim2.new(0.5, 0, 0, -100), Anchor = Vector2.new(0.5, 0), Color = T.Panel })
	f.ZIndex = 60
	UI.stroke(f, color or T.Gold, 3)
	UI.label(f, title, { Size = UDim2.new(1, -20, 0, 40), Position = UDim2.fromOffset(10, 8), Font = Enum.Font.GothamBlack, TextSize = 24, Align = Enum.TextXAlignment.Center, Color = color or T.Gold })
	UI.label(f, subtitle or "", { Size = UDim2.new(1, -20, 0, 34), Position = UDim2.fromOffset(10, 48), TextSize = 15, Align = Enum.TextXAlignment.Center })
	UI.tween(f, { Position = UDim2.new(0.5, 0, 0, 90) }, 0.35, Enum.EasingStyle.Back)
	task.delay(3.2, function()
		UI.tween(f, { Position = UDim2.new(0.5, 0, 0, -100) }, 0.3)
		task.wait(0.35)
		f:Destroy()
	end)
end

-- Ventana de confirmación
function Notify.confirm(text, onYes, yesText)
	local overlay = UI.frame(gui, { Size = UDim2.fromScale(1, 1), Color = Color3.new(0, 0, 0), Transparency = 0.45, Radius = false, Name = "Confirm" })
	overlay.ZIndex = 80
	local box = UI.frame(overlay, { Size = UDim2.fromOffset(400, 170), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), Color = T.Panel })
	UI.padding(box, 16)
	UI.label(box, text, { Size = UDim2.new(1, 0, 0, 90), TextSize = 16, VAlign = Enum.TextYAlignment.Top })
	UI.button(box, yesText or "Confirmar", function()
		overlay:Destroy()
		onYes()
	end, { Position = UDim2.new(1, 0, 1, 0), Anchor = Vector2.new(1, 1), Color = T.Accent, Width = 150 })
	UI.button(box, "Cancelar", function()
		overlay:Destroy()
	end, { Position = UDim2.new(0, 0, 1, 0), Anchor = Vector2.new(0, 1), Width = 150 })
end

-- Diálogo de NPC con opciones
function Notify.dialog(name, text, options, onOption)
	if dialogFrame then
		dialogFrame:Destroy()
	end
	dialogFrame = UI.frame(gui, { Size = UDim2.fromOffset(560, 150), Position = UDim2.new(0.5, 0, 1, -110), Anchor = Vector2.new(0.5, 1), Color = T.Panel })
	dialogFrame.ZIndex = 40
	UI.stroke(dialogFrame, T.Accent2, 2)
	UI.padding(dialogFrame, 12)
	UI.label(dialogFrame, "💬 " .. name, { Font = Enum.Font.GothamBlack, TextSize = 16, Height = 22 })
	UI.label(dialogFrame, text, { Position = UDim2.fromOffset(0, 26), Size = UDim2.new(1, 0, 0, 60), TextSize = 15, VAlign = Enum.TextYAlignment.Top })
	local row = UI.row(dialogFrame, 34)
	row.Position = UDim2.new(0, 0, 1, -34)
	for _, opt in ipairs(options or {}) do
		UI.button(row, opt.label, function()
			dialogFrame:Destroy()
			dialogFrame = nil
			onOption(opt)
		end, { Width = 150, Color = T.Accent2 })
	end
	UI.button(row, "Adiós", function()
		dialogFrame:Destroy()
		dialogFrame = nil
	end, { Width = 100 })
	local mine = dialogFrame
	task.delay(12, function()
		if dialogFrame == mine and mine.Parent then
			mine:Destroy()
			dialogFrame = nil
		end
	end)
end

return Notify
