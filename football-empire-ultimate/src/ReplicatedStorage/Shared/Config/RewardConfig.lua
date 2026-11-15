-- RewardConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/RewardConfig
--
-- RECOMPENSA DIARIA (racha de 7 días que se repite) y CÓDIGOS DE REGALO.
-- Una recompensa puede llevar: money (dinero del club), egg (huevo que se abre al momento)
-- y xp (puntos del pase de temporada).
--
-- Códigos: añade aquí los que quieras regalar (en MAYÚSCULAS, sin espacios) y publica el juego.
-- Cada jugador puede canjear cada código una sola vez. «expires» es opcional (fecha os.time()).

local CollectionConfig = require(script.Parent.CollectionConfig)

local RewardConfig = {}

RewardConfig.Daily = {
	{ money = 2000 },
	{ money = 3000 },
	{ money = 4000 },
	{ egg = "basic" },
	{ money = 6000 },
	{ money = 8000 },
	{ money = 5000, egg = "golden" },
}

RewardConfig.Codes = {
	BIENVENIDO = { money = 10000, egg = "basic" },
	FUTBOL = { money = 5000, xp = 60 },
	MASCOTAS = { egg = "basic" },
}
RewardConfig.MAX_CODE_LENGTH = 24

-- RULETA DE LA SUERTE: un giro gratis al día (UTC). weight = probabilidad relativa.
-- La interfaz muestra las probabilidades reales (weight / suma de weights).
RewardConfig.Wheel = {
	{ label = "2.000 $", color = Color3.fromRGB(70, 160, 90), weight = 28, money = 2000 },
	{ label = "Huevo", color = Color3.fromRGB(240, 220, 170), weight = 14, egg = "basic" },
	{ label = "5.000 $", color = Color3.fromRGB(60, 130, 220), weight = 20, money = 5000 },
	{ label = "Caja", color = Color3.fromRGB(170, 110, 60), weight = 10, crate = "crate" },
	{ label = "15.000 $", color = Color3.fromRGB(150, 80, 220), weight = 10, money = 15000 },
	{ label = "Pase +60", color = Color3.fromRGB(230, 120, 40), weight = 12, xp = 60 },
	{ label = "Huevo dorado", color = Color3.fromRGB(255, 200, 50), weight = 5, egg = "golden" },
	{ label = "¡100.000 $!", color = Color3.fromRGB(220, 40, 70), weight = 1, money = 100000 },
}

-- REGALOS POR JUGAR: se desbloquean con los minutos de esta sesión (vuelven a empezar al entrar).
RewardConfig.Playtime = {
	{ minutes = 5, money = 1500 },
	{ minutes = 10, egg = "basic" },
	{ minutes = 15, money = 4000 },
	{ minutes = 25, crate = "crate" },
	{ minutes = 40, money = 10000 },
	{ minutes = 60, egg = "golden" },
}

function RewardConfig.WheelChance(index)
	local total = 0
	for _, segment in ipairs(RewardConfig.Wheel) do
		total += segment.weight
	end
	return RewardConfig.Wheel[index].weight / total * 100
end

function RewardConfig.Describe(reward)
	local parts = {}
	if reward.crate then
		local crate = CollectionConfig.CrateById[reward.crate]
		table.insert(parts, string.format("%s %s", crate.icon, crate.name))
	end
	if reward.money then
		table.insert(parts, string.format("💰 %d $", reward.money))
	end
	if reward.egg then
		local egg = CollectionConfig.EggById[reward.egg]
		table.insert(parts, string.format("%s %s", egg.icon, egg.name))
	end
	if reward.xp then
		table.insert(parts, string.format("🎟️ %d puntos del pase", reward.xp))
	end
	return table.concat(parts, " + ")
end

-- Día de la racha (1-7) que toca con esa racha acumulada
function RewardConfig.DayOf(streak)
	return (math.max(1, streak) - 1) % #RewardConfig.Daily + 1
end

return RewardConfig
