-- Settings (ModuleScript) · Pantalla "Configuración"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Settings

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)

local Settings = {}

function Settings.Render(container, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local settings = state.settings
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Title("⚙️ Configuración", 26))

	local function toggle(title, description, key)
		local on = settings[key] == true
		return C.Card({}, {
			C.Row({
				C.Label("<b>" .. title .. "</b>", { Size = UDim2.new(1, -140, 0, 0) }),
				C.Button(on and "Activado" or "Desactivado", on and "primary" or "secondary", function()
					ctx.act("SaveSettings", { [key] = not on })
				end, { Size = UDim2.new(0, 120, 0, 36), AutomaticSize = Enum.AutomaticSize.None }),
			}),
			C.Label(description, { TextColor3 = Theme.TextDim, TextSize = 13 }),
		})
	end
	add(toggle("Notificaciones de jornada", "Muestra el resultado económico de cada jornada.", "notifications"))
	add(toggle("Menú compacto", "En PC, muestra solo los iconos del menú lateral.", "compactMenu"))

	add(C.Card({}, {
		C.Label(string.format("<b>Tamaño de la interfaz</b> · %d%%", math.floor(settings.uiScale * 100 + 0.5))),
		C.Row({
			C.Button("−", "secondary", function()
				ctx.act("SaveSettings", { uiScale = math.max(0.8, settings.uiScale - 0.1) })
			end, { Size = UDim2.new(0, 50, 0, 36), AutomaticSize = Enum.AutomaticSize.None }),
			C.Button("Restablecer", "secondary", function()
				ctx.act("SaveSettings", { uiScale = 1 })
			end),
			C.Button("+", "secondary", function()
				ctx.act("SaveSettings", { uiScale = math.min(1.3, settings.uiScale + 0.1) })
			end, { Size = UDim2.new(0, 50, 0, 36), AutomaticSize = Enum.AutomaticSize.None }),
		}, 8),
	}))

	add(C.Card({}, {
		C.Title("💾 Guardado", 18),
		C.Label(state.saveEnabled
			and string.format("Tu club se guarda automáticamente cada %d s, al salir y al cerrar el servidor.", GameConfig.AUTOSAVE_SECONDS)
			or "⚠️ El guardado no está disponible en esta sesión (DataStore inaccesible). El progreso no se guardará.",
			{ TextColor3 = state.saveEnabled and Theme.TextDim or Theme.Warning, TextSize = 14 }),
		C.Button("Guardar ahora", "primary", function()
			ctx.act("SaveNow")
		end),
	}))

	add(C.Card({}, {
		C.Title("ℹ️ Acerca de", 18),
		C.Label(string.format("%s · versión %s · FASE %d de 12", GameConfig.GAME_NAME, GameConfig.VERSION, state.phase), { TextColor3 = Theme.TextDim, TextSize = 14 }),
		C.Label("Atajo: tecla M para abrir o cerrar el menú.", { TextColor3 = Theme.TextMuted, TextSize = 13 }),
	}))
end

return Settings
