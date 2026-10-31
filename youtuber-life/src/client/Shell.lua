--!nonstrict
-- Shell (cliente): el "sistema operativo" del juego.
--  * Computador: escritorio con fondo, iconos, barra de tareas, menú de inicio, reloj, notificaciones y
--    ventanas que se pueden mover, minimizar, enfocar y cerrar. Las apps recuerdan su estado mientras la
--    ventana está abierta.
--  * Teléfono: pantalla de inicio con apps, una app a la vez con botón atrás.
--  * Panel: una app suelta (catálogo de tienda física, cajero, vestidor...).
-- Solo una de las tres superficies está abierta a la vez para no saturar la pantalla.

local UserInputService = game:GetService("UserInputService")
local UI = require(script.Parent.UIKit)
local State = require(script.Parent.State)
local Net = require(script.Parent.Net)
local Registry = require(script.Parent.AppRegistry)
local T = UI.Theme

local Shell = {}
local gui
local surface = nil -- "pc" | "phone" | "panel"
local root
local windows = {}
local zTop = 10
local session = nil

Shell.Wallpapers = {
	{ Color3.fromRGB(20, 30, 70), Color3.fromRGB(120, 20, 90) },
	{ Color3.fromRGB(10, 60, 60), Color3.fromRGB(10, 20, 30) },
	{ Color3.fromRGB(70, 20, 20), Color3.fromRGB(20, 10, 10) },
	{ Color3.fromRGB(40, 40, 50), Color3.fromRGB(10, 10, 14) },
	{ Color3.fromRGB(255, 140, 60), Color3.fromRGB(120, 30, 120) },
}

function Shell.init(screenGui)
	gui = screenGui
end

function Shell.surface()
	return surface
end

function Shell.session()
	return session
end

local function closeSurface()
	if root then
		for _, w in pairs(windows) do
			if w.cleanup then
				w.cleanup()
			end
		end
		windows = {}
		root:Destroy()
		root = nil
	end
	if surface == "pc" then
		Net.call("PC.Close", {}, { silent = true })
		session = nil
	end
	surface = nil
end
Shell.close = closeSurface

-- Construye una app dentro de un contenedor y devuelve la función de limpieza
local function mountApp(appId, container, kind, params, closeFn)
	local app = Registry.get(appId)
	local unsubs = {}
	local ctx = {
		kind = kind,
		params = params or {},
		close = closeFn,
		session = function()
			return session
		end,
		open = function(id, p)
			Shell.openApp(id, p)
		end,
		onState = function(fn)
			table.insert(unsubs, State.on(fn))
		end,
	}
	local ok, err = pcall(app.build, container, ctx)
	if not ok then
		UI.label(container, "Error en la app: " .. tostring(err), { Color = T.Err, Height = 60 })
		warn(err)
	end
	return function()
		for _, u in ipairs(unsubs) do
			u()
		end
		if ctx.cleanup then
			pcall(ctx.cleanup)
		end
	end
end

---------------------------------------------------------------------------
-- Ventanas del escritorio
---------------------------------------------------------------------------
local taskbarButtons
local function refreshTaskbar()
	if not taskbarButtons then
		return
	end
	UI.clear(taskbarButtons)
	for id, w in pairs(windows) do
		local app = Registry.get(id)
		UI.button(taskbarButtons, app.Icon .. " " .. app.Name, function()
			w.frame.Visible = true
			zTop = zTop + 1
			w.frame.ZIndex = zTop
		end, { Width = 140, Height = 30, TextSize = 12, Color = w.frame.Visible and T.Panel3 or T.Panel2 })
	end
end

local function makeDraggable(handle, frame)
	local dragging, startPos, startInput
	handle.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			startPos = frame.Position
			startInput = input.Position
			input.Changed:Connect(function()
				if input.UserInputState == Enum.UserInputState.End then
					dragging = false
				end
			end)
		end
	end)
	UserInputService.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			local scale = gui:FindFirstChild("AutoScale") and gui.AutoScale.Scale or 1
			local delta = (input.Position - startInput) / scale
			frame.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
		end
	end)
end

local function openWindow(appId, params)
	local app = Registry.get(appId)
	if not app then
		return
	end
	if windows[appId] then
		local w = windows[appId]
		w.frame.Visible = true
		zTop = zTop + 1
		w.frame.ZIndex = zTop
		return
	end
	local count = State.count(windows)
	if count >= 5 then
		require(script.Parent.Notify).toast("Demasiadas ventanas abiertas. Cierra alguna.", "warn")
		return
	end
	local desk = root:FindFirstChild("Desk")
	local w = UI.frame(desk, { Size = UDim2.new(0, app.Width or 720, 0, app.Height or 470), Position = UDim2.new(0, 60 + count * 30, 0, 20 + count * 26), Color = T.Panel, Clip = true, Name = "Window_" .. appId })
	zTop = zTop + 1
	w.ZIndex = zTop
	UI.stroke(w, T.Panel3, 1)
	local bar = UI.frame(w, { Height = 34, Color = T.Panel2, Radius = false, Name = "TitleBar" })
	UI.label(bar, app.Icon .. "  " .. app.Name, { Position = UDim2.fromOffset(12, 0), Size = UDim2.new(1, -110, 1, 0), Font = Enum.Font.GothamBold })
	local content = UI.frame(w, { Size = UDim2.new(1, 0, 1, -34), Position = UDim2.fromOffset(0, 34), Transparency = 1, Radius = false, Name = "Content", Clip = true })
	UI.padding(content, 10)
	local entry = { frame = w }
	windows[appId] = entry
	UI.button(bar, "✕", function()
		if entry.cleanup then
			entry.cleanup()
		end
		windows[appId] = nil
		w:Destroy()
		refreshTaskbar()
	end, { Width = 34, Height = 34, Position = UDim2.new(1, 0, 0, 0), Anchor = Vector2.new(1, 0), Color = T.Accent, Radius = 0 })
	UI.button(bar, "—", function()
		w.Visible = false
		refreshTaskbar()
	end, { Width = 34, Height = 34, Position = UDim2.new(1, -36, 0, 0), Anchor = Vector2.new(1, 0), Radius = 0 })
	w.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			zTop = zTop + 1
			w.ZIndex = zTop
		end
	end)
	makeDraggable(bar, w)
	entry.cleanup = mountApp(appId, content, "pc", params, function()
		if entry.cleanup then
			entry.cleanup()
		end
		windows[appId] = nil
		w:Destroy()
		refreshTaskbar()
	end)
	refreshTaskbar()
	if require(script.Parent.Notify).Sound then
		require(script.Parent.Notify).Sound.play("Open")
	end
end

function Shell.openComputer(stats)
	closeSurface()
	session = stats
	surface = "pc"
	local data = State.Data
	local wp = Shell.Wallpapers[(data and data.Settings.Wallpaper) or 1] or Shell.Wallpapers[1]
	root = UI.frame(gui, { Size = UDim2.new(1, -40, 1, -40), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), Color = wp[1], Clip = true, Name = "Computer" })
	root.ZIndex = 5
	UI.new("UIGradient", { Color = ColorSequence.new(wp[1], wp[2]), Rotation = 45, Parent = root })
	UI.stroke(root, Color3.fromRGB(0, 0, 0), 4)
	local desk = UI.frame(root, { Size = UDim2.new(1, 0, 1, -44), Transparency = 1, Radius = false, Name = "Desk" })
	-- Iconos del escritorio
	local icons = UI.frame(desk, { Size = UDim2.new(0, 330, 1, -10), Position = UDim2.fromOffset(10, 10), Transparency = 1, Radius = false, Name = "Icons" })
	UI.grid(icons, 76, 76, 6)
	for _, app in ipairs(Registry.list("pc")) do
		local b = UI.button(icons, app.Icon .. "\n" .. app.Name, function()
			openWindow(app.Id)
		end, { Color = Color3.fromRGB(0, 0, 0), TextSize = 11 })
		b.BackgroundTransparency = 0.6
	end
	-- Barra de tareas
	local bar = UI.frame(root, { Height = 44, Position = UDim2.new(0, 0, 1, -44), Color = Color3.fromRGB(12, 12, 16), Radius = false, Name = "Taskbar" })
	bar.ZIndex = 1000
	local startMenu
	UI.button(bar, "⊞ Inicio", function()
		if startMenu then
			startMenu:Destroy()
			startMenu = nil
			return
		end
		startMenu = UI.frame(root, { Size = UDim2.fromOffset(260, 380), Position = UDim2.new(0, 6, 1, -50), Anchor = Vector2.new(0, 1), Color = T.Panel, Name = "StartMenu" })
		startMenu.ZIndex = 1001
		local s = UI.scroll(startMenu, { Pad = 4 })
		local stats = session or {}
		UI.label(s, "💻 " .. (stats.Kind == "laptop" and "Portátil" or (stats.Kind == "public" and "Computador público" or "Tu computador")), { Font = Enum.Font.GothamBold })
		UI.label(s, "Rendimiento: " .. tostring(stats.TierName or "?") .. " · " .. tostring(stats.MaxScenes or "?") .. " clips máx.", { Color = T.Sub, TextSize = 12 })
		for _, app in ipairs(Registry.list("pc")) do
			UI.button(s, app.Icon .. "  " .. app.Name, function()
				startMenu:Destroy()
				startMenu = nil
				openWindow(app.Id)
			end, { Size = UDim2.new(1, -8, 0, 30), TextSize = 13, Color = T.Panel2 })
		end
		UI.button(s, "⏻ Apagar", function()
			closeSurface()
		end, { Size = UDim2.new(1, -8, 0, 30), Color = T.Accent })
	end, { Width = 100, Height = 36, Position = UDim2.fromOffset(4, 4), Color = T.Accent })
	taskbarButtons = UI.frame(bar, { Size = UDim2.new(1, -330, 1, -8), Position = UDim2.fromOffset(110, 4), Transparency = 1, Radius = false })
	UI.list(taskbarButtons, Enum.FillDirection.Horizontal, 4)
	local clock = UI.label(bar, "", { Size = UDim2.new(0, 200, 1, 0), Position = UDim2.new(1, -210, 0, 0), Align = Enum.TextXAlignment.Right, TextSize = 13 })
	task.spawn(function()
		while root and root.Parent and clock.Parent do
			local h = workspace:GetAttribute("GameHour") or 12
			clock.Text = string.format("🔔 %d   %02d:%02d · Día %d", #State.Messages, math.floor(h), math.floor((h % 1) * 60), workspace:GetAttribute("GameDay") or 1)
			task.wait(1)
		end
	end)
	UI.button(bar, "✕", function()
		closeSurface()
	end, { Width = 40, Height = 36, Position = UDim2.new(1, -4, 0, 4), Anchor = Vector2.new(1, 0), Color = T.Panel3 })
	-- Bienvenida
	local hello = UI.label(desk, "Bienvenido a TuboOS · haz doble clic... o un clic 😉 en una app", { Size = UDim2.new(0, 500, 0, 30), Position = UDim2.new(1, -20, 1, -10), Anchor = Vector2.new(1, 1), Align = Enum.TextXAlignment.Right, Color = Color3.fromRGB(220, 220, 230), TextSize = 13 })
	hello.TextTransparency = 0.3
	if stats and stats.openApp then
		openWindow(stats.openApp)
	end
end

---------------------------------------------------------------------------
-- Teléfono
---------------------------------------------------------------------------
function Shell.openPhone(appId, params)
	closeSurface()
	surface = "phone"
	root = UI.frame(gui, { Size = UDim2.fromOffset(330, 620), Position = UDim2.new(1, -20, 0.5, 0), Anchor = Vector2.new(1, 0.5), Color = Color3.fromRGB(8, 8, 10), Name = "Phone", Radius = 30 })
	root.ZIndex = 5
	UI.stroke(root, Color3.fromRGB(70, 70, 80), 3)
	local screen = UI.frame(root, { Size = UDim2.new(1, -20, 1, -50), Position = UDim2.fromOffset(10, 30), Color = T.Bg, Radius = 20, Clip = true, Name = "Screen" })
	local status = UI.label(root, "", { Size = UDim2.new(1, -40, 0, 22), Position = UDim2.fromOffset(20, 6), TextSize = 12, Color = T.Sub })
	task.spawn(function()
		while root and root.Parent and status.Parent do
			local h = workspace:GetAttribute("GameHour") or 12
			local weather = ({ Clear = "☀️", Cloudy = "☁️", Rain = "🌧", Fog = "🌫", Storm = "⛈" })[workspace:GetAttribute("Weather") or "Clear"] or ""
			status.Text = string.format("%02d:%02d  %s   ·   %s", math.floor(h), math.floor((h % 1) * 60), weather, (State.Data and State.Data.Derived and "$" .. State.Data.Money) or "")
			task.wait(1)
		end
	end)
	local current
	local function home()
		if current then
			current()
			current = nil
		end
		UI.clear(screen)
		local grid = UI.scroll(screen, { Grid = { 86, 82 }, Pad = 6, Padding = 10 })
		for _, app in ipairs(Registry.list("phone")) do
			local b = UI.button(grid, app.Icon .. "\n" .. app.Name, function()
				UI.clear(screen)
				local content = UI.frame(screen, { Size = UDim2.new(1, 0, 1, -40), Transparency = 1, Radius = false, Clip = true })
				UI.padding(content, 8)
				local back = UI.button(screen, "◀ Inicio", home, { Size = UDim2.new(1, -16, 0, 32), Position = UDim2.new(0, 8, 1, -36), Color = T.Panel2 })
				current = mountApp(app.Id, content, "phone", params, home)
			end, { Color = T.Panel2, TextSize = 12 })
		end
	end
	home()
	UI.button(root, "✕", function()
		if current then
			current()
		end
		closeSurface()
	end, { Width = 30, Height = 22, Position = UDim2.new(1, -16, 0, 4), Anchor = Vector2.new(1, 0), Color = T.Accent, TextSize = 12 })
	Net.call("Phone.Opened", {}, { silent = true })
	if appId then
		local app = Registry.get(appId)
		if app then
			UI.clear(screen)
			local content = UI.frame(screen, { Size = UDim2.new(1, 0, 1, -40), Transparency = 1, Radius = false, Clip = true })
			UI.padding(content, 8)
			UI.button(screen, "◀ Inicio", home, { Size = UDim2.new(1, -16, 0, 32), Position = UDim2.new(0, 8, 1, -36), Color = T.Panel2 })
			current = mountApp(appId, content, "phone", params, home)
		end
	end
end

---------------------------------------------------------------------------
-- Panel suelto
---------------------------------------------------------------------------
function Shell.openPanel(appId, params)
	local app = Registry.get(appId)
	if not app then
		return
	end
	closeSurface()
	surface = "panel"
	root = UI.frame(gui, { Size = UDim2.fromOffset(app.Width or 760, app.Height or 500), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), Color = T.Panel, Clip = true, Name = "Panel" })
	root.ZIndex = 5
	UI.stroke(root, T.Panel3, 2)
	local bar = UI.frame(root, { Height = 38, Color = T.Panel2, Radius = false })
	UI.label(bar, app.Icon .. "  " .. ((params and params.title) or app.Name), { Position = UDim2.fromOffset(12, 0), Size = UDim2.new(1, -60, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 16 })
	local content = UI.frame(root, { Size = UDim2.new(1, 0, 1, -38), Position = UDim2.fromOffset(0, 38), Transparency = 1, Radius = false, Clip = true })
	UI.padding(content, 10)
	local cleanup = mountApp(appId, content, "panel", params, closeSurface)
	windows[appId] = { frame = root, cleanup = cleanup }
	UI.button(bar, "✕", function()
		closeSurface()
	end, { Width = 38, Height = 38, Position = UDim2.new(1, 0, 0, 0), Anchor = Vector2.new(1, 0), Color = T.Accent, Radius = 0 })
end

-- Abre una app en la superficie más adecuada
function Shell.openApp(appId, params)
	local app = Registry.get(appId)
	if not app then
		return
	end
	if surface == "pc" and Registry.allowed(app, "pc") then
		openWindow(appId, params)
	elseif surface == "phone" and Registry.allowed(app, "phone") then
		Shell.openPhone(appId, params)
	elseif Registry.allowed(app, "panel") then
		Shell.openPanel(appId, params)
	elseif Registry.allowed(app, "phone") then
		Shell.openPhone(appId, params)
	else
		require(script.Parent.Notify).toast(app.Name .. " solo funciona en un computador.", "warn")
	end
end

function Shell.togglePhone()
	if surface == "phone" then
		closeSurface()
	else
		Shell.openPhone()
	end
end

return Shell
