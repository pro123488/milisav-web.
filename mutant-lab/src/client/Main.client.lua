--!nonstrict
-- Arranque del cliente: interfaz, avisos del servidor y atajos de teclado.

local UserInputService = game:GetService("UserInputService")

local Net = require(script.Parent.Net)
local UI = require(script.Parent.UI)

UI.build()
Net.onMessage = function(msg, style)
	UI.notify(msg, style)
end

Net.on("state", function(data)
	UI.setState(data)
end)
Net.on("notify", function(data)
	UI.notify(data.text, data.style)
end)
Net.on("openPanel", function(data)
	UI.openPanel(data and data.tab)
end)
Net.on("alert", function(data)
	UI.alert(data)
end)
Net.on("carry", function()
	UI.refresh(true)
end)
Net.on("event", function(ev)
	if UI.state then
		UI.state.Event = ev
		UI.refresh(false)
	end
end)
Net.on("discover", function(d)
	UI.notify("📖 ¡Nueva especie descubierta: " .. tostring(d.name) .. "! +" .. tostring(d.reward) .. " créditos", "gold")
end)
Net.on("ready", function(d)
	if d and d.first then
		UI.notify("🧪 ¡Bienvenido a tu laboratorio! Compra tu primera cápsula en la cinta del centro.", "gold")
	end
end)

-- Atajos: L laboratorio, F fusión, B bestiario, G láser, H ayuda
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	local k = input.KeyCode
	if k == Enum.KeyCode.L then
		if UI.open then
			UI.closePanel()
		else
			UI.openPanel("mutants")
		end
	elseif k == Enum.KeyCode.F then
		UI.openPanel("fusion")
	elseif k == Enum.KeyCode.B then
		UI.openPanel("index")
	elseif k == Enum.KeyCode.G then
		Net.call("Lab.Laser")
	elseif k == Enum.KeyCode.H then
		UI.openPanel("help")
	end
end)

-- Primer estado (por si se pierde el primer aviso)
task.spawn(function()
	local r = Net.call("State.Get")
	if r.ok and r.data then
		UI.setState(r.data)
	end
end)
