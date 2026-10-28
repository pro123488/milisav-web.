-- FootballConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/FootballConfig
--
-- Futbolistas, contratos, temporadas y CANTERA GENERACIONAL (FASE 4).
-- Todos los nombres se generan combinando listas: son jugadores ficticios.

local FootballConfig = {}

-- ===== Temporada =====
-- Una temporada dura SEASON_LENGTH jornadas (ciclos económicos). Al terminar:
-- los jugadores cumplen años, los contratos avanzan, hay retiradas y llega una
-- nueva hornada a la cantera. Las ligas (FASE 7) usarán este mismo reloj.
FootballConfig.SEASON_LENGTH = 30

-- ===== Plantilla =====
FootballConfig.MAX_SQUAD = 25
FootballConfig.MIN_SQUAD = 14 -- no se puede bajar de aquí al rescindir o vender
FootballConfig.CONTRACT_MAX_SEASONS = 5
FootballConfig.RENEW_WINDOW = 2 -- se puede renovar cuando quedan 2 temporadas o menos
FootballConfig.RELEASE_COST_SHARE = 0.25 -- rescindir cuesta el 25 % del salario restante

FootballConfig.Positions = {
	{ id = "GK", name = "Portero", short = "POR", icon = "🧤" },
	{ id = "DEF", name = "Defensa", short = "DEF", icon = "🛡️" },
	{ id = "MID", name = "Centrocampista", short = "MED", icon = "🎯" },
	{ id = "FWD", name = "Delantero", short = "DEL", icon = "⚽" },
}

FootballConfig.Attributes = {
	{ id = "pace", name = "Velocidad", short = "VEL" },
	{ id = "shooting", name = "Tiro", short = "TIR" },
	{ id = "passing", name = "Pase", short = "PAS" },
	{ id = "dribbling", name = "Regate", short = "REG" },
	{ id = "defending", name = "Defensa", short = "DEF" },
	{ id = "stamina", name = "Resistencia", short = "RES" },
}

-- Peso de cada atributo en la media según la posición (cada fila suma 1).
-- Para el portero, "Defensa" representa sus paradas.
FootballConfig.Weights = {
	GK = { pace = 0.15, shooting = 0.00, passing = 0.15, dribbling = 0.05, defending = 0.55, stamina = 0.10 },
	DEF = { pace = 0.15, shooting = 0.05, passing = 0.15, dribbling = 0.05, defending = 0.45, stamina = 0.15 },
	MID = { pace = 0.10, shooting = 0.15, passing = 0.30, dribbling = 0.20, defending = 0.10, stamina = 0.15 },
	FWD = { pace = 0.20, shooting = 0.35, passing = 0.10, dribbling = 0.20, defending = 0.05, stamina = 0.10 },
}

-- Perfil típico de cada posición al generar jugadores (desviación sobre la media objetivo).
FootballConfig.Bias = {
	GK = { pace = -8, shooting = -25, passing = -5, dribbling = -15, defending = 8, stamina = -3 },
	DEF = { pace = -2, shooting = -15, passing = -3, dribbling = -10, defending = 8, stamina = 2 },
	MID = { pace = -2, shooting = -2, passing = 6, dribbling = 3, defending = -8, stamina = 3 },
	FWD = { pace = 4, shooting = 7, passing = -4, dribbling = 3, defending = -25, stamina = -2 },
}

-- Plantilla inicial de un club nuevo
FootballConfig.STARTING_SQUAD = { GK = 2, DEF = 5, MID = 5, FWD = 4 }
FootballConfig.STARTING_OVERALL = { min = 42, max = 54 }

-- ===== Valor y salario (exponenciales con la media) =====
FootballConfig.VALUE_BASE = 1000 -- valor de un jugador de media 45
FootballConfig.VALUE_GROWTH = 1.14
FootballConfig.SALARY_BASE = 8 -- salario por jornada de un jugador de media 45
FootballConfig.SALARY_GROWTH = 1.09
FootballConfig.YOUTH_SALARY_SHARE = 0.6 -- salario del primer contrato de un canterano

-- ===== Entrenamiento y evolución =====
FootballConfig.BASE_GROWTH = 0.17 -- puntos de media por jornada en las mejores condiciones
FootballConfig.GROWTH_GAP = 15 -- con 15 o más puntos de margen hasta el potencial se crece al máximo
FootballConfig.AgeRates = { -- multiplicador de evolución por edad (negativo = declive)
	{ maxAge = 17, rate = 1.2 },
	{ maxAge = 21, rate = 1.0 },
	{ maxAge = 24, rate = 0.7 },
	{ maxAge = 27, rate = 0.35 },
	{ maxAge = 30, rate = 0.1 },
	{ maxAge = 32, rate = -0.2 },
	{ maxAge = 99, rate = -0.5 },
}
FootballConfig.TrainingIntensities = {
	{ id = "LIGHT", name = "Suave", growth = 0.7 },
	{ id = "NORMAL", name = "Normal", growth = 1.0 },
	{ id = "INTENSE", name = "Intensa", growth = 1.3 },
}
FootballConfig.TRAINING_FACILITY_BONUS = 0.2 -- +20 % por nivel del Centro de entrenamiento
FootballConfig.FOCUS_WEIGHT = 0.4 -- peso extra del atributo en el que se centra el entrenamiento

-- ===== Retirada y leyendas =====
FootballConfig.RETIRE_MIN_AGE = 33
FootballConfig.RETIRE_CHANCE_PER_YEAR = 0.25 -- 33 años: 25 %, 34: 50 %, ...
FootballConfig.RETIRE_FORCED_AGE = 37
FootballConfig.LEGEND_MIN_PEAK = 72 -- media máxima para entrar en las leyendas del club
FootballConfig.LEGEND_MIN_ACADEMY_PEAK = 65 -- los canteranos entran antes
FootballConfig.LEGEND_MIN_APPS = 150

-- ===== Cantera =====
FootballConfig.YOUTH_MIN_PROMOTE_AGE = 16
FootballConfig.YOUTH_MAX_AGE = 18 -- con 19 años dejan la academia si no suben al primer equipo
FootballConfig.YOUTH_START_AGE = { min = 15, max = 16 }
FootballConfig.YOUTH_OVERALL = { min = 28, max = 44 }
-- Por nivel de la Academia juvenil (0 = cantera básica sin instalación)
FootballConfig.AcademyLevels = {
	[0] = { capacity = 4, intake = 1, potentialMin = 50, potentialMax = 72, growth = 1.0 },
	[1] = { capacity = 6, intake = 2, potentialMin = 55, potentialMax = 78, growth = 1.25 },
	[2] = { capacity = 8, intake = 3, potentialMin = 60, potentialMax = 84, growth = 1.5 },
	[3] = { capacity = 10, intake = 4, potentialMin = 65, potentialMax = 90, growth = 1.75 },
}
FootballConfig.GEM_CHANCE = 0.05 -- probabilidad de "joya" (+8 de potencial)
FootballConfig.GEM_CHANCE_PER_SCOUT = 0.02
FootballConfig.GEM_BONUS = 8
FootballConfig.STAR_POTENTIAL = 85 -- se marca como ⭐ si el potencial estimado mínimo llega aquí

-- ===== Ojeadores =====
FootballConfig.MAX_SCOUTS = 3
FootballConfig.SCOUT_COSTS = { 150, 400, 800 } -- coste total por jornada con 1, 2 o 3 ojeadores
FootballConfig.SCOUT_POTENTIAL_BONUS = 2 -- +2 al rango de potencial por ojeador
FootballConfig.SCOUT_REPORT_CYCLES = 10 -- cada cuántas jornadas llega un informe
FootballConfig.SCOUT_ERROR = { [0] = 12, [1] = 8, [2] = 4, [3] = 0 } -- margen del potencial estimado
FootballConfig.SCOUT_SIGN_BASE = 500
FootballConfig.SCOUT_SIGN_PER_POTENTIAL2 = 0.8 -- fichaje de un juvenil = base + potencial² × 0,8

-- ===== Nombres ficticios =====
FootballConfig.FirstNames = {
	"Álex", "Bruno", "Carlos", "Dani", "Emilio", "Fabián", "Gonzalo", "Héctor", "Iker", "Javier",
	"Kevin", "Lucas", "Mateo", "Nico", "Óscar", "Pablo", "Rafa", "Santi", "Tomás", "Unai",
	"Víctor", "Yago", "Adrián", "Bastián", "Cristian", "Diego", "Enzo", "Facundo", "Gael", "Hugo",
	"Iván", "Joaquín", "Leo", "Marco", "Nahuel", "Rodrigo", "Samuel", "Thiago", "Valentín", "Martín",
	"André", "João", "Luca", "Mamadou", "Kenji", "Omar", "Erik", "Jonas", "Malik", "Sergi",
}
FootballConfig.LastNames = {
	"García", "Rodríguez", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Ruiz", "Díaz",
	"Moreno", "Álvarez", "Romero", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Serrano",
	"Molina", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Núñez", "Iglesias",
	"Medina", "Garrido", "Cortés", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto", "Méndez",
	"Silva", "Costa", "Rossi", "Diallo", "Tanaka", "Haddad", "Larsen", "Weber", "Okafor", "Vidal",
}

function FootballConfig.Position(id)
	for _, p in ipairs(FootballConfig.Positions) do
		if p.id == id then
			return p
		end
	end
	return FootballConfig.Positions[3]
end

function FootballConfig.Intensity(id)
	for _, i in ipairs(FootballConfig.TrainingIntensities) do
		if i.id == id then
			return i
		end
	end
	return FootballConfig.TrainingIntensities[2]
end

function FootballConfig.AgeRate(age)
	for _, entry in ipairs(FootballConfig.AgeRates) do
		if age <= entry.maxAge then
			return entry.rate
		end
	end
	return -0.5
end

function FootballConfig.Academy(level)
	return FootballConfig.AcademyLevels[math.clamp(level or 0, 0, 3)]
end

return FootballConfig
