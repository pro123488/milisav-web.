--!nonstrict
-- StudioData: Complejo de Estudios Prisma (6 platós especializados de alquiler) y ocio
-- (gimnasio, cine, karaoke, bolera y recreativos). Datos y fórmulas compartidos por servidor y cliente.

local Config = require(script.Parent.Config)

local StudioData = {}

---------------------------------------------------------------------------
-- ESTUDIOS
---------------------------------------------------------------------------
StudioData.Name = "Complejo de Estudios Prisma"
StudioData.HourSeconds = Config.DayLengthSeconds / 24 -- 1 hora de juego en segundos reales
StudioData.WarnSeconds = StudioData.HourSeconds * 5 / 60 -- aviso 5 minutos de juego antes del final
StudioData.MaxHours = 4 -- horas de alquiler pendientes como máximo
StudioData.DeskRadius = 32 -- distancia máxima al centro del vestíbulo para alquilar (recepción)
StudioData.SetSize = { W = 60, D = 44, H = 18 }
StudioData.ZoneZ = -4200 -- zona de interiores de los platós (lejos de la ciudad y de los destinos de viaje)

-- Scene = +calidad de escena, Light = +luz de plató, Photo = +calidad de fotos (solo con alquiler activo y dentro)
StudioData.Sets = {
	{ Id = "gaming", Name = "Plató Gaming", Icon = "🎮", Price = 90, Level = 1, Scene = 5, Light = 14, Photo = 3,
		Interest = 12, Noise = 1, Decor = 22, Tags = { "studio", "tech", "home", "event" },
		Desc = "Pantallas gigantes, sillas RGB y tiras de neón. Ideal para videojuegos y tecnología.", Wall = { 30, 30, 44 }, Floor = { 40, 40, 52 } },
	{ Id = "music", Name = "Estudio de Música", Icon = "🎸", Price = 110, Level = 2, Scene = 6, Light = 12, Photo = 3,
		Interest = 12, Noise = 0, Decor = 20, Tags = { "studio", "event", "fun" },
		Desc = "Cabina insonorizada, batería, teclado y guitarras. Audio impecable.", Wall = { 70, 50, 40 }, Floor = { 120, 85, 60 } },
	{ Id = "kitchen", Name = "Cocina Profesional", Icon = "🍳", Price = 100, Level = 2, Scene = 5, Light = 18, Photo = 5,
		Interest = 12, Noise = 1, Decor = 22, Tags = { "food", "home", "studio" },
		Desc = "Isla de mármol, fogones de restaurante y campana de acero. Para recetas y restaurantes.", Wall = { 235, 235, 230 }, Floor = { 60, 60, 66 } },
	{ Id = "podcast", Name = "Plató Podcast", Icon = "🎙", Price = 80, Level = 1, Scene = 6, Light = 12, Photo = 2,
		Interest = 11, Noise = 0, Decor = 18, Tags = { "studio", "business", "education", "urban" },
		Desc = "Mesa redonda con cuatro micrófonos de brazo y cartel ON AIR. Entrevistas y charlas.", Wall = { 50, 40, 60 }, Floor = { 90, 70, 60 } },
	{ Id = "chroma", Name = "Plató Croma", Icon = "🟩", Price = 130, Level = 3, Scene = 4, Light = 20, Photo = 4,
		Interest = 13, Noise = 0, Decor = 10, Tags = { "studio" }, Chroma = true,
		Desc = "Pantalla verde: elige un fondo y la escena cuenta como si grabaras en ese tipo de lugar.", Wall = { 40, 200, 70 }, Floor = { 40, 200, 70 } },
	{ Id = "photo", Name = "Estudio Fotográfico", Icon = "📸", Price = 120, Level = 3, Scene = 3, Light = 22, Photo = 12,
		Interest = 10, Noise = 0, Decor = 18, Tags = { "studio", "luxury", "shop", "home" },
		Desc = "Fondos de papel, ventanas de luz y paraguas. Tus fotos ganan mucha calidad.", Wall = { 245, 245, 245 }, Floor = { 230, 230, 230 } },
}
StudioData.ById = {}
for i, s in ipairs(StudioData.Sets) do
	StudioData.ById[s.Id] = s
	s.Index = i
	-- Centro del plató (zona de interiores, en fila a lo largo del eje X)
	s.OX = (i - 3.5) * 110
	s.OZ = StudioData.ZoneZ
end

-- Fondo por defecto del croma (id de categoría de VideoData)
StudioData.DefaultBackdrop = "tourism"

function StudioData.price(set, hours)
	return set.Price * (hours or 1)
end

-- Minutos de juego que quedan a partir de segundos reales
function StudioData.gameMinutes(seconds)
	return math.max(0, math.floor(seconds / StudioData.HourSeconds * 60 + 0.5))
end

---------------------------------------------------------------------------
-- OCIO
---------------------------------------------------------------------------
StudioData.Gym = { Name = "Gimnasio Pulso Fit", Price = 10, Energy = 15, MinEnergy = 20, Mood = 8, Cooldown = 15 }
StudioData.Cinema = { Name = "Cines Lumière", Mood = 15, Energy = 4, Hours = 2 }
StudioData.Karaoke = { Name = "Karaoke Micrófono de Oro", Price = 8, Mood = 10, MicMood = 5, Energy = 3, Cooldown = 20, SceneBonus = 6 }
StudioData.Bowling = { Name = "Bolera Strike & Recreativos", Price = 5, DailyLimit = 5,
	Prizes = { { 160, 30 }, { 130, 15 }, { 100, 8 } } } -- { puntuación mínima, premio }

-- Cartelera: cada película da una idea de vídeo (categoría + título)
StudioData.Movies = {
	{ Id = "neo_chase", Name = "Persecución en Neo Distrito", Genre = "Acción", Price = 15, Idea = { "cars", "Recreo la persecución de Neo Distrito" } },
	{ Id = "grandma", Name = "La cocina de la abuela Lumi", Genre = "Comedia", Price = 12, Idea = { "cooking", "Cocino el plato de la abuela Lumi" } },
	{ Id = "summit", Name = "Expedición Cumbre Helada", Genre = "Aventura", Price = 15, Idea = { "adventure", "Mi propia expedición a la montaña" } },
	{ Id = "ghost_code", Name = "Código Fantasma", Genre = "Ciencia ficción", Price = 16, Idea = { "tech", "¿Podría existir la IA de Código Fantasma?" } },
	{ Id = "queen", Name = "La reina del torneo", Genre = "Deportes electrónicos", Price = 14, Idea = { "gaming", "Juego como en La reina del torneo" } },
	{ Id = "holidays", Name = "Ciudad de vacaciones", Genre = "Romance", Price = 12, Idea = { "tourism", "Visito los lugares de Ciudad de vacaciones" } },
}
StudioData.MovieById = {}
for _, m in ipairs(StudioData.Movies) do
	StudioData.MovieById[m.Id] = m
end

-- Mejora de forma física por sesión (rinde menos cuanto más en forma estás)
function StudioData.fitnessGain(fitness)
	return math.max(1, 4 - math.floor((fitness or 0) / 35))
end

-- Interés extra (+1 a +3) en vídeos de deporte / fitness según la forma física
function StudioData.isFitnessCategory(cat)
	if not cat then
		return false
	end
	local ids = { sports = true, sport = true, fitness = true, deporte = true, deportes = true, gym = true }
	if ids[cat.Id] then
		return true
	end
	for _, t in ipairs(cat.Tags or {}) do
		if ids[t] then
			return true
		end
	end
	return false
end

function StudioData.fitnessInterest(fitness)
	fitness = fitness or 0
	if fitness >= 80 then
		return 3
	elseif fitness >= 40 then
		return 2
	elseif fitness >= 1 then
		return 1
	end
	return 0
end

-- Estado de la pista de bolos del día (efecto ideal 1-5 y potencia ideal 1-5)
StudioData.AimNames = { "Muy a la izquierda", "Izquierda", "Centro", "Derecha", "Muy a la derecha" }
StudioData.PowerNames = { "Suave", "Media-baja", "Media", "Fuerte", "Máxima" }
function StudioData.lane(day)
	day = day or 1
	local aim = (day * 7) % 5 + 1
	local power = (day * 3) % 3 + 2
	local hints = { "La pista resbala hacia la derecha", "La pista va algo a la derecha", "La pista está recta", "La pista va algo a la izquierda", "La pista resbala hacia la izquierda" }
	return { Aim = aim, Power = power, Hint = hints[aim] .. " · bolos " .. (power >= 4 and "pesados" or "ligeros") }
end

-- Habilidad 0-1 de una tirada según lo bien que lees la pista, tu forma física y tu experiencia
function StudioData.bowlSkill(aim, power, lane, fitness, games)
	local aimMatch = 1 - math.abs(aim - lane.Aim) / 4
	local powerMatch = 1 - math.abs(power - lane.Power) / 3
	return 0.3 + 0.28 * aimMatch + 0.12 * math.max(0, powerMatch) + (fitness or 0) / 500 + math.min(0.08, (games or 0) * 0.004)
end

-- 10 tiradas: cada una suma bolos + 10 por pleno o + 5 por semipleno (máximo 200)
function StudioData.bowlScore(skill, rng)
	rng = rng or math.random
	local frames, total, strikes = {}, 0, 0
	for i = 1, 10 do
		local first = math.floor(10 * math.max(0, math.min(1, skill + (rng() - 0.5) * 0.7)) + 0.5)
		local pts, mark = first, ""
		if first >= 10 then
			pts, mark = 20, "X"
			strikes = strikes + 1
		else
			local second = math.floor((10 - first) * math.max(0, math.min(1, skill + (rng() - 0.5) * 0.6)) + 0.5)
			if first + second >= 10 then
				pts, mark = 15, "/"
			else
				pts, mark = first + second, tostring(first + second)
			end
		end
		total = total + pts
		frames[i] = mark
	end
	return total, frames, strikes
end

function StudioData.bowlPrize(score)
	for _, p in ipairs(StudioData.Bowling.Prizes) do
		if score >= p[1] then
			return p[2]
		end
	end
	return 0
end

return StudioData
