-- WeeklyConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/WeeklyConfig
--
-- CONTENIDO SEMANAL: cada lunes a las 00:00 UTC cambian solos el bonus de la semana y el
-- estadio destacado de los partidos en grupo. No hace falta publicar nada: se calcula con la fecha.
-- El servidor aplica los bonus; el cliente solo los muestra (recibe la semana en el estado).

local WeeklyConfig = {}

WeeklyConfig.EPOCH = 1793577600 -- lunes 2/11/2026 00:00 UTC
WeeklyConfig.WEEK_SECONDS = 7 * 86400

WeeklyConfig.Bonuses = {
	{ id = "match", icon = "💰", name = "Partidos x1,5", text = "Las recompensas de los partidos en grupo valen x1,5.", matchMultiplier = 1.5 },
	{ id = "eggs", icon = "🥚", name = "Huevos −20 %", text = "Todos los huevos de mascotas cuestan un 20 % menos.", eggDiscount = 0.2 },
	{ id = "goals", icon = "⚽", name = "Goles x2", text = "Cada gol tuyo en los partidos en grupo da el doble de dinero.", goalMultiplier = 2 },
	{ id = "crates", icon = "📦", name = "Cajas −20 %", text = "Las cajas de balones cuestan un 20 % menos.", crateDiscount = 0.2 },
	{ id = "passxp", icon = "🎟️", name = "Pase x1,5", text = "Ganas x1,5 puntos del pase de temporada.", xpMultiplier = 1.5 },
}

-- Estadio destacado de cada semana (ids de ArenaConfig.Themes)
WeeklyConfig.Themes = { "classic", "beach", "street", "snow", "volcano", "neon" }

function WeeklyConfig.Bonus(id)
	for _, bonus in ipairs(WeeklyConfig.Bonuses) do
		if bonus.id == id then
			return bonus
		end
	end
	return nil
end

-- Semana en curso: { index, number, endsAt, bonusId, themeId }
function WeeklyConfig.Current(now)
	now = now or os.time()
	local index = math.max(0, math.floor((now - WeeklyConfig.EPOCH) / WeeklyConfig.WEEK_SECONDS))
	return {
		index = index,
		number = index + 1,
		endsAt = WeeklyConfig.EPOCH + (index + 1) * WeeklyConfig.WEEK_SECONDS,
		bonusId = WeeklyConfig.Bonuses[index % #WeeklyConfig.Bonuses + 1].id,
		themeId = WeeklyConfig.Themes[index % #WeeklyConfig.Themes + 1],
	}
end

function WeeklyConfig.ActiveBonus(now)
	return WeeklyConfig.Bonus(WeeklyConfig.Current(now).bonusId)
end

-- Precio con el descuento de la semana (si lo hay). La usan el servidor y la interfaz.
function WeeklyConfig.Price(cost, discount)
	return math.floor(cost * (1 - (discount or 0)) + 0.5)
end

return WeeklyConfig
