-- MenuConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/MenuConfig
--
-- Entradas del menú principal. `phase` indica en qué fase del plan se
-- implementa la sección. Las secciones de fases futuras se muestran
-- desactivadas con el texto "Disponible en la FASE N": no son botones
-- decorativos que finjan funcionar.

local MenuConfig = {
	{ id = "home", label = "Inicio", icon = "🏠", phase = 1 },
	{ id = "club", label = "Mi club", icon = "🛡️", phase = 1 },
	{ id = "stadium", label = "Mi estadio", icon = "🏟️", phase = 1 },
	{ id = "build", label = "Construcción", icon = "🏗️", phase = 1 },
	{ id = "economy", label = "Economía", icon = "💰", phase = 1 },
	{ id = "shop", label = "Tienda Premium", icon = "💎", phase = 1, highlight = true },
	{ id = "squad", label = "Plantilla", icon = "👕", phase = 4 },
	{ id = "academy", label = "Academia", icon = "🧬", phase = 4 },
	{ id = "matches", label = "Partidos", icon = "⚽", phase = 5 },
	{ id = "transfers", label = "Fichajes", icon = "🔁", phase = 6 },
	{ id = "leagues", label = "Ligas", icon = "🏆", phase = 7 },
	{ id = "history", label = "Historia", icon = "📜", phase = 8 },
	{ id = "universe", label = "Universo", icon = "🌎", phase = 8 },
	{ id = "network", label = "Red de clubes", icon = "🤝", phase = 9 },
	{ id = "missions", label = "Misiones", icon = "🎯", phase = 10 },
	{ id = "achievements", label = "Logros", icon = "🎖️", phase = 10 },
	{ id = "settings", label = "Configuración", icon = "⚙️", phase = 1 },
}

-- Fase actualmente implementada: las entradas con phase <= CURRENT_PHASE están activas.
MenuConfig.CURRENT_PHASE = 3

return MenuConfig
