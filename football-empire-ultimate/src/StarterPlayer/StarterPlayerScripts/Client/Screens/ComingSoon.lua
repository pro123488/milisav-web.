-- ComingSoon (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/ComingSoon
-- Pantalla honesta para secciones de fases futuras: explica qué incluirán y cuándo.
-- No contiene botones que finjan funcionar.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MenuConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.MenuConfig)

local ComingSoon = {}

local PLANS = {
	squad = "Futbolistas con estadísticas (velocidad, tiro, pase, regate, defensa, resistencia, potencial), salarios, contratos y alineaciones.",
	academy = "CANTERA GENERACIONAL: jóvenes generados dinámicamente, potencial, entrenamientos, ojeadores, ascenso al primer equipo y retiradas.",
	matches = "Motor de partidos SIMULADOS con formaciones, tácticas, goles, asistencias, posesión y estadísticas. Los partidos se presentarán como simulaciones, no como partidos controlables.",
	transfers = "Mercado de fichajes con compras, ventas y cesiones validadas por el servidor.",
	leagues = "Ligas, copas, calendarios, clasificaciones, ascensos, descensos y modo carrera.",
	history = "HISTORIA DEL CLUB: temporadas, títulos, goleadores, récords y sala de trofeos física generada con eventos reales.",
	universe = "UNIVERSO FUTBOLÍSTICO: directorio de clubes, rankings globales de reputación y valor, eventos y competiciones.",
	network = "RED DE CLUBES: visitas a estadios, invitaciones, torneos, retos y clasificaciones entre amigos.",
	missions = "Misiones diarias y de progreso con recompensas validadas por el servidor.",
	achievements = "Logros permanentes del club.",
}

function ComingSoon.Render(container, ctx)
	local C, Theme = ctx.C, ctx.Theme
	local entry
	for _, e in ipairs(MenuConfig) do
		if e.id == ctx.current then
			entry = e
		end
	end
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title((entry and entry.icon or "🔜") .. "  " .. (entry and entry.label or "Próximamente"), 26))
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Badge("🚧 EN DESARROLLO · FASE " .. tostring(entry and entry.phase or "?"), Theme.Warning, Color3.fromRGB(40, 20, 0)),
		C.Label("Esta sección todavía no está disponible en la versión actual (FASE " .. MenuConfig.CURRENT_PHASE .. ").",
			{ TextColor3 = Theme.TextDim }),
		C.Label("<b>Qué incluirá:</b> " .. (PLANS[ctx.current] or "Contenido planificado."), { TextSize = 15 }),
	}))
end

return ComingSoon
