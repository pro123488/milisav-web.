-- Notifier (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/Notifier
-- Notificaciones emergentes (toasts) apiladas en la esquina superior.

local TweenService = game:GetService("TweenService")

local Theme = require(script.Parent.Theme)
local C = require(script.Parent.Components)

local Notifier = {}

local holder

function Notifier.Init(screenGui)
	holder = C.New("Frame", {
		Name = "Toasts",
		BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 70),
		Size = UDim2.new(0, 420, 1, -80),
		ZIndex = 50,
		Children = {
			C.New("UIListLayout", {
				Padding = UDim.new(0, 6),
				SortOrder = Enum.SortOrder.LayoutOrder,
				HorizontalAlignment = Enum.HorizontalAlignment.Center,
			}),
			C.New("UISizeConstraint", { MaxSize = Vector2.new(420, math.huge) }),
		},
	}, screenGui)
end

local counter = 0
function Notifier.Show(kind, message, duration)
	if not holder or not message or message == "" then
		return
	end
	counter += 1
	local color = Theme.NotifyColors[kind] or Theme.Info
	local icons = { success = "✅", error = "⛔", warning = "⚠️", info = "ℹ️" }
	local toast = C.New("Frame", {
		LayoutOrder = counter,
		BackgroundColor3 = Theme.Panel,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		ZIndex = 50,
		Children = {
			C.Corner(),
			C.Stroke(color, 2),
			C.Padding(10, 12),
			C.Label((icons[kind] or "ℹ️") .. "  " .. message, { TextSize = 15, ZIndex = 51 }),
		},
	}, holder)
	task.delay(duration or 4.5, function()
		if toast.Parent then
			local tween = TweenService:Create(toast, TweenInfo.new(0.3), { BackgroundTransparency = 1 })
			tween:Play()
			tween.Completed:Wait()
			toast:Destroy()
		end
	end)
	-- Máximo 4 a la vez
	local toasts = {}
	for _, child in ipairs(holder:GetChildren()) do
		if child:IsA("Frame") then
			table.insert(toasts, child)
		end
	end
	table.sort(toasts, function(a, b)
		return a.LayoutOrder < b.LayoutOrder
	end)
	while #toasts > 4 do
		table.remove(toasts, 1):Destroy()
	end
end

return Notifier
