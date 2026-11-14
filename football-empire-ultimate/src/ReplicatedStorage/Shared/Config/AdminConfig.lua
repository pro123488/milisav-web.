-- AdminConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/AdminConfig
--
-- EVENTOS «ADMIN ABUSE»: el dueño del juego lanza eventos para todos los servidores.
-- Quién es admin lo decide SOLO el servidor (AdminService):
--   * el creador del juego (game.CreatorId si el juego es de un usuario),
--   * los UserId de ADMIN_USER_IDS,
--   * si el juego es de un grupo, los miembros con rango >= GROUP_MIN_RANK.
--   * En Roblox Studio, quien prueba (para poder ensayar los eventos).

local AdminConfig = {}

AdminConfig.ADMIN_USER_IDS = {
	-- 123456789, -- añade aquí UserIds de otros admins
}
AdminConfig.GROUP_MIN_RANK = 254

AdminConfig.Events = {
	{ id = "double", icon = "💰", name = "Recompensas x2", minutes = 15, cooldown = 60,
		text = "¡ADMIN ABUSE! Recompensas x2 durante 15 minutos" },
	{ id = "speed", icon = "⚡", name = "Supervelocidad", minutes = 5, cooldown = 30,
		text = "¡ADMIN ABUSE! Todos corren x1.5 durante 5 minutos", speedMultiplier = 1.5 },
	{ id = "coinrain", icon = "🪙", name = "Lluvia de monedas", minutes = 1, cooldown = 30,
		text = "¡ADMIN ABUSE! Lluvia de monedas en todos los estadios: ¡corre a recogerlas!", coinValue = 300, coinsPerPlot = 25 },
	{ id = "goldball", icon = "🏆", name = "Balón de oro", minutes = 10, cooldown = 60,
		text = "¡ADMIN ABUSE! Balón dorado en los partidos en grupo: cada gol vale x3", goalMultiplier = 3 },
	{ id = "luck", icon = "🍀", name = "Suerte x2", minutes = 10, cooldown = 60,
		text = "¡ADMIN ABUSE! Suerte x2 en huevos y cajas de balones durante 10 minutos", luckMultiplier = 2 },
}

AdminConfig.ANNOUNCE_MAX_LENGTH = 120
AdminConfig.MESSAGING_TOPIC = "FEU_AdminEvents"

function AdminConfig.Event(id)
	for _, event in ipairs(AdminConfig.Events) do
		if event.id == id then
			return event
		end
	end
	return nil
end

return AdminConfig
