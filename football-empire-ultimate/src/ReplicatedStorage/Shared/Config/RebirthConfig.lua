-- RebirthConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/RebirthConfig
--
-- RENACIMIENTOS: cuando tu estadio es grande, puedes «renacer»: el estadio y el dinero vuelven
-- al principio a cambio de bonus PERMANENTES. Se conserva todo lo demás (plantilla, mascotas,
-- balones, trajes, piezas, pase, misiones, logros, historia…).
-- Funciones puras: las usan el servidor (para aplicar) y la interfaz (para mostrar lo mismo).

local RebirthConfig = {}

RebirthConfig.MAX = 25

-- Requisitos de cada renacimiento (el n-ésimo usa la fila n; del 6 en adelante, la fórmula)
RebirthConfig.Requirements = {
	{ stage = 3, money = 200000 },
	{ stage = 4, money = 600000 },
	{ stage = 5, money = 1500000 },
	{ stage = 6, money = 3500000 },
	{ stage = 7, money = 7000000 },
}

-- Bonus por cada renacimiento
RebirthConfig.INCOME_BONUS = 0.20 -- +20 % de los ingresos de cada jornada
RebirthConfig.ARENA_BONUS = 0.10 -- +10 % en las recompensas de los partidos en grupo

-- Desbloqueos por número de renacimientos
RebirthConfig.PET_SLOT_AT = { 2, 5 } -- +1 hueco de mascota equipada en cada uno (de 3 a 5)
RebirthConfig.Unlocks = {
	{ count = 1, icon = "🥚", text = "Huevo renacido (mascotas exclusivas)" },
	{ count = 2, icon = "🐾", text = "4.º hueco de mascota" },
	{ count = 3, icon = "👑", text = "Piezas doradas para tu estadio" },
	{ count = 5, icon = "🐾", text = "5.º hueco de mascota" },
	{ count = 5, icon = "⚽", text = "Balón «Fénix renacido»" },
}
RebirthConfig.BALL_AT = 5
RebirthConfig.BALL = "rebirth_phoenix"

-- Requisito para pasar de `count` renacimientos a `count + 1`
function RebirthConfig.Requirement(count)
	local row = RebirthConfig.Requirements[count + 1]
	if row then
		return row
	end
	local extra = count + 1 - #RebirthConfig.Requirements
	return { stage = 7, money = 7000000 + extra * 3000000 }
end

function RebirthConfig.IncomeBonus(count)
	return (count or 0) * RebirthConfig.INCOME_BONUS
end

function RebirthConfig.ArenaBonus(count)
	return (count or 0) * RebirthConfig.ARENA_BONUS
end

function RebirthConfig.PetSlots(count, base)
	local slots = base
	for _, at in ipairs(RebirthConfig.PET_SLOT_AT) do
		if (count or 0) >= at then
			slots += 1
		end
	end
	return slots
end

return RebirthConfig
