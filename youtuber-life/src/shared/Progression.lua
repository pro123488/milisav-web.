--!nonstrict
-- Progression: niveles de experiencia y rangos de creador.

local Progression = {}

function Progression.xpToNext(level)
	return math.floor(100 * level ^ 1.45)
end

-- Aplica XP y devuelve el nuevo nivel, la XP restante y cuántos niveles subió.
function Progression.applyXp(level, xp, gained)
	xp = xp + gained
	local ups = 0
	while xp >= Progression.xpToNext(level) and level < 100 do
		xp = xp - Progression.xpToNext(level)
		level = level + 1
		ups = ups + 1
	end
	return level, xp, ups
end

Progression.Ranks = {
	{ Name = "Creador principiante", Level = 1, Subs = 0, Videos = 0, Rep = 0, Unlock = "Funciones básicas" },
	{ Name = "Aficionado", Level = 2, Subs = 0, Videos = 1, Rep = 0, Unlock = "Tienda de tecnología completa" },
	{ Name = "Creador emergente", Level = 4, Subs = 50, Videos = 3, Rep = 12, Unlock = "Cámaras de vlog y equipo profesional" },
	{ Name = "Creador constante", Level = 6, Subs = 250, Videos = 8, Rep = 18, Unlock = "Componentes de gama alta" },
	{ Name = "Especialista", Level = 9, Subs = 1000, Videos = 15, Rep = 25, Unlock = "Cámaras de estudio" },
	{ Name = "Creador reconocido", Level = 12, Subs = 5000, Videos = 25, Rep = 35, Unlock = "Invitaciones a eventos" },
	{ Name = "Profesional", Level = 16, Subs = 20000, Videos = 40, Rep = 45, Unlock = "Estaciones de trabajo" },
	{ Name = "Estrella digital", Level = 20, Subs = 100000, Videos = 60, Rep = 55, Unlock = "Experiencias de lujo" },
	{ Name = "Empresario de contenido", Level = 25, Subs = 300000, Videos = 80, Rep = 65, Unlock = "Empresa de producción" },
	{ Name = "Magnate de medios", Level = 30, Subs = 1000000, Videos = 120, Rep = 75, Unlock = "Todo el contenido" },
}

function Progression.rankFor(level, subs, videos, rep)
	local best = 1
	for i, r in ipairs(Progression.Ranks) do
		if level >= r.Level and subs >= r.Subs and videos >= r.Videos and rep >= r.Rep then
			best = i
		end
	end
	return best, Progression.Ranks[best]
end

Progression.Xp = {
	Scene = 5,
	Photo = 2,
	Thumbnail = 8,
	Export = 10,
	PublishBase = 30,
	Purchase = 5,
	PCBuilt = 40,
	Job = 15,
	District = 10,
}

return Progression
