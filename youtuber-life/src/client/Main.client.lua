--!nonstrict
-- Main (LocalScript): crea la interfaz, conecta los mensajes del servidor y los controles (PC y móvil).

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local StarterGui = game:GetService("StarterGui")

local Client = script.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Sound = require(Client.Sound)
local Notify = require(Client.Notify)
local Actions = require(Client.Actions)
local Shell = require(Client.Shell)
local HUD = require(Client.HUD)
local Capture = require(Client.CaptureUI)
local WorldFX = require(Client.WorldFX)
local Build = require(Client.BuildUI)
local T = UI.Theme

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

local gui = Instance.new("ScreenGui")
gui.Name = "YoutuberLifeUI"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

UI.Sound = Sound
Net.Notify = Notify
Notify.init(gui, Sound)
Shell.init(gui)
Capture.init(gui, Sound)
Build.init(gui)
UI.attachScale(gui, function()
	return State.Data and State.Data.Settings.UIScale or 1
end)

-- Acciones globales
Actions.photoMode = function()
	Shell.close()
	Capture.togglePhoto()
end
Actions.record = function()
	Capture.toggleRecord(function()
		Shell.openApp("ideas")
	end)
end
Actions.openStyle = function()
	Shell.openPanel("style")
end

local function toggleApp(appId)
	if Shell.surface() == "panel" then
		Shell.close()
		return
	end
	if Shell.surface() == "pc" then
		Shell.openApp(appId)
	else
		Shell.openPanel(appId)
	end
end

HUD.build(gui, {
	phone = function()
		Shell.togglePhone()
	end,
	inventory = function()
		toggleApp("inventory")
	end,
	missions = function()
		toggleApp("missions")
	end,
	record = Actions.record,
	photo = Actions.photoMode,
	style = Actions.openStyle,
	laptop = function()
		Net.call("PC.OpenLaptop", {}, { quietOk = true })
	end,
	settings = function()
		toggleApp("settings")
	end,
	build = function()
		Build.toggle()
	end,
	realty = function()
		toggleApp("realty")
	end,
})
WorldFX.start()
require(Client.VehicleController).start()

---------------------------------------------------------------------------
-- Mensajes del servidor
---------------------------------------------------------------------------
local lastSettings
Net.on("profile", function(data)
	State.set(data)
	local st = data.Settings
	local key = st.Sfx .. ":" .. st.Music .. ":" .. tostring(st.ReduceMotion)
	if key ~= lastSettings then
		lastSettings = key
		Sound.setVolumes(st.Sfx, st.Music)
		UI.ReduceMotion = st.ReduceMotion
	end
end)
local liveFrame
local function liveOverlay(d)
	State.setLive(d)
	if d.kind == "end" then
		if liveFrame then
			liveFrame:Destroy()
			liveFrame = nil
		end
		Notify.banner("🔴 Directo terminado", "Pico " .. d.peak .. " · $" .. (d.total or 0) .. " ganados · +" .. d.subs .. " subs", T.Accent)
		return
	end
	if not liveFrame then
		liveFrame = UI.frame(gui, { Size = UDim2.fromOffset(380, 0), Auto = Enum.AutomaticSize.Y, Position = UDim2.new(1, -12, 0, 84), Anchor = Vector2.new(1, 0), Color = T.Panel, Name = "LiveOverlay" })
		UI.stroke(liveFrame, T.Accent, 2)
		UI.padding(liveFrame, 8)
		UI.list(liveFrame, Enum.FillDirection.Vertical, 4)
	end
	UI.clear(liveFrame)
	UI.label(liveFrame, "🔴 EN DIRECTO · 👀 " .. d.viewers .. " · 💸 $" .. d.donations .. " · +" .. d.subs .. " subs · " .. d.left .. " s", { Font = Enum.Font.GothamBold, TextSize = 13 })
	if d.donation then
		Notify.toast("💸 Donación de $" .. d.donation .. " en el directo", "gold")
	end
	if d.question then
		UI.label(liveFrame, "💬 " .. d.question, { TextSize = 13, Color = T.Gold, Height = 0, Auto = Enum.AutomaticSize.Y })
		for i, a in ipairs(d.answers) do
			UI.button(liveFrame, a, function()
				Net.call("Live.Answer", { choice = i })
				for _, c in ipairs(liveFrame:GetChildren()) do
					if c:IsA("TextButton") then
						c:Destroy()
					end
				end
			end, { Size = UDim2.new(1, 0, 0, 30), TextSize = 12, Color = T.Panel2 })
		end
	end
end
Net.on("live", liveOverlay)

Net.on("notify", function(d)
	Notify.toast(d.text, d.style)
end)
Net.on("cash", function(d)
	HUD.cash(d.amount)
	if d.amount >= 5 then
		Sound.play("Cash")
	end
end)
Net.on("openUI", function(d)
	if d.ui == "style" then
		Shell.openPanel("style")
	elseif d.ui == "store" then
		Shell.openPanel("shop", { store = d.store })
	elseif d.ui == "product" then
		Shell.openPanel("product", { item = d.item, store = d.store })
	elseif d.ui == "app" then
		Shell.openPanel(d.app)
	elseif d.ui == "food" then
		Shell.openPanel("food", { tab = d.tab, place = d.place })
	elseif d.ui == "realty" then
		Shell.openPanel("realty", { listing = d.listing })
	end
end)
Net.on("openComputer", function(d)
	Shell.openComputer(d.stats)
end)
Net.on("closeComputer", function()
	if Shell.surface() == "pc" then
		Shell.close()
		Notify.toast("Te alejaste del computador.", "info")
	end
end)
Net.on("achievement", function(d)
	Notify.banner("🏆 ¡Logro completado!", d.name .. " · cóbralo en Misiones (M)", T.Gold)
end)
Net.on("levelUp", function(d)
	Notify.banner("⬆ ¡Nivel " .. d.level .. "!", "Nuevos productos y oportunidades desbloqueados", T.Accent2)
end)
Net.on("rankUp", function(d)
	Notify.banner("🎖 Nuevo rango: " .. d.name, "Desbloqueado: " .. tostring(d.unlock), T.Gold)
end)
Net.on("tutorial", function(d)
	if d.finished then
		Notify.banner("🎓 ¡Tutorial completado!", "Ahora elige tu propio camino", T.Ok)
	else
		Notify.toast("✅ " .. d.done .. (d.next and (" → Siguiente: " .. d.next) or ""), "success")
	end
end)
Net.on("secret", function(d)
	Notify.banner("✨ Lugar secreto: " .. d.name, "+$" .. d.reward .. " · ahora puedes grabar aquí", T.Gold)
end)
Net.on("dialog", function(d)
	Notify.dialog(d.name, d.text, d.options, function(opt)
		if opt.ui == "store" then
			Shell.openPanel("shop", { store = opt.store })
		elseif opt.ui == "app" then
			Shell.openPanel(opt.app)
		end
	end)
end)
Net.on("travelFade", function(d)
	local f = UI.frame(gui, { Size = UDim2.fromScale(1, 1), Color = Color3.new(0, 0, 0), Transparency = 1, Radius = false })
	f.ZIndex = 100
	UI.label(f, (type(d) == "table" and type(d.text) == "string") and d.text or "🚕 Viajando...", { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, TextSize = 28, Font = Enum.Font.GothamBlack })
	UI.tween(f, { BackgroundTransparency = 0 }, 0.3)
	task.wait(0.9)
	UI.tween(f, { BackgroundTransparency = 1 }, 0.4)
	for _, c in ipairs(f:GetChildren()) do
		if c:IsA("TextLabel") then
			UI.tween(c, { TextTransparency = 1 }, 0.4)
		end
	end
	task.wait(0.45)
	f:Destroy()
end)

---------------------------------------------------------------------------
-- Menú principal (al entrar)
---------------------------------------------------------------------------
local function mainMenu(isNew)
	local overlay = UI.frame(gui, { Size = UDim2.fromScale(1, 1), Color = Color3.fromRGB(8, 8, 14), Transparency = 0.15, Radius = false, Name = "MainMenu" })
	overlay.ZIndex = 90
	UI.new("UIGradient", { Color = ColorSequence.new(Color3.fromRGB(60, 10, 40), Color3.fromRGB(10, 20, 60)), Rotation = 30, Parent = overlay })
	local box = UI.frame(overlay, { Size = UDim2.fromOffset(560, 420), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), Transparency = 1, Radius = false })
	UI.label(box, "▶ YOUTUBER LIFE", { Size = UDim2.new(1, 0, 0, 60), Font = Enum.Font.GothamBlack, TextSize = 46, Align = Enum.TextXAlignment.Center, Color = T.Accent })
	UI.label(box, "REAL WORLD ULTIMATE", { Size = UDim2.new(1, 0, 0, 30), Position = UDim2.fromOffset(0, 58), Font = Enum.Font.GothamBold, TextSize = 22, Align = Enum.TextXAlignment.Center })
	UI.label(box, "Vive, explora, compra, graba, edita y publica. 30 distritos, cientos de productos y tu propio canal.", { Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 96), TextSize = 15, Align = Enum.TextXAlignment.Center, Color = T.Sub })
	local function close()
		UI.tween(overlay, { BackgroundTransparency = 1 }, 0.3)
		task.wait(0.3)
		overlay:Destroy()
	end
	UI.button(box, "▶ JUGAR", function()
		close()
		if isNew then
			Notify.banner("¡Bienvenido a la ciudad!", "Sigue el objetivo de la izquierda: te guiará paso a paso", T.Accent2)
		end
	end, { Size = UDim2.fromOffset(300, 56), Position = UDim2.fromOffset(130, 160), Color = T.Accent, TextSize = 22 })
	UI.button(box, "⚙ Ajustes", function()
		close()
		Shell.openPanel("settings")
	end, { Size = UDim2.fromOffset(300, 44), Position = UDim2.fromOffset(130, 228) })
	UI.button(box, "❓ Cómo jugar", function()
		Notify.confirm("1) Elige una idea en el computador o teléfono.\n2) Prepara la mochila en casa y viaja a un lugar 🎥.\n3) Graba escenas (R) y fotos (F).\n4) Vuelve a casa: importa, edita, exporta.\n5) Diseña una miniatura y publica en ViewTube Studio.\nCompra mejor equipo, trabaja, explora y descubre secretos.", function() end, "¡Entendido!")
	end, { Size = UDim2.fromOffset(300, 44), Position = UDim2.fromOffset(130, 284) })
	UI.label(box, "Teclas: P teléfono · I inventario · M misiones · R grabar · F foto · V estilo · C portátil · Shift correr", { Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 350), TextSize = 12, Align = Enum.TextXAlignment.Center, Color = T.Sub })
end

local menuShown = false
local function maybeMenu(isNew)
	if not menuShown then
		menuShown = true
		mainMenu(isNew)
	end
end
Net.on("ready", function(d)
	maybeMenu(d.isNew)
end)
State.on(function(data)
	if not menuShown then
		maybeMenu((data.Counters.published or 0) == 0 and data.Quests.Step <= 1)
	end
end)

---------------------------------------------------------------------------
-- Teclado (PC). En móvil se usan los botones del HUD.
---------------------------------------------------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or UserInputService:GetFocusedTextBox() then
		return
	end
	local k = input.KeyCode
	if Build.isPlacing() then
		return -- R/Q/clic los gestiona el modo construcción
	end
	if k == Enum.KeyCode.B then
		Build.toggle()
		return
	end
	if k == Enum.KeyCode.P then
		Shell.togglePhone()
	elseif k == Enum.KeyCode.I then
		toggleApp("inventory")
	elseif k == Enum.KeyCode.M then
		toggleApp("missions")
	elseif k == Enum.KeyCode.R then
		Actions.record()
	elseif k == Enum.KeyCode.F then
		Actions.photoMode()
	elseif k == Enum.KeyCode.V then
		Actions.openStyle()
	elseif k == Enum.KeyCode.C then
		Net.call("PC.OpenLaptop", {}, { quietOk = true })
	elseif k == Enum.KeyCode.Escape or k == Enum.KeyCode.Backspace then
		if Shell.surface() then
			Shell.close()
		end
	end
end)

-- Pedir el estado por si el primer envío llegó antes de conectar
task.spawn(function()
	task.wait(2)
	if not State.Data then
		Net.call("Sync.Request", {}, { silent = true })
	end
end)
