-- TacticsConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/TacticsConfig
--
-- Formaciones, tácticas y constantes del MOTOR DE PARTIDOS SIMULADOS (FASE 5).
-- Los partidos son SIMULACIONES: el resultado lo calcula el servidor y la interfaz
-- lo reproduce como resumen. El modo jugable en tiempo real se añadirá más adelante
-- (MatchConfig.MODES deja preparada esa ampliación).

local TacticsConfig = {}

-- slots: posición de cada uno de los 11 puestos (en orden: portero, defensas, medios, delanteros)
TacticsConfig.Formations = {
	{ id = "442", name = "4-4-2", slots = { "GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD" } },
	{ id = "433", name = "4-3-3", slots = { "GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD" } },
	{ id = "4231", name = "4-2-3-1", slots = { "GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD" } },
	{ id = "352", name = "3-5-2", slots = { "GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD" } },
	{ id = "532", name = "5-3-2", slots = { "GK", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD" } },
}
TacticsConfig.DEFAULT_FORMATION = "442"

TacticsConfig.Mentalities = {
	{ id = "DEFENSIVE", name = "Defensiva", attack = 0.90, defense = 1.10, description = "Menos ocasiones a favor y en contra." },
	{ id = "BALANCED", name = "Equilibrada", attack = 1.00, defense = 1.00, description = "Sin modificadores." },
	{ id = "OFFENSIVE", name = "Ofensiva", attack = 1.10, defense = 0.92, description = "Más ocasiones a favor, pero más riesgo atrás." },
}

TacticsConfig.Styles = {
	{ id = "POSSESSION", name = "Posesión", possession = 0.06, chances = 1.00, quality = 0.97, description = "Controlar el balón: más posesión." },
	{ id = "COUNTER", name = "Contraataque", possession = -0.06, chances = 0.90, quality = 1.12, description = "Menos ocasiones, pero más claras." },
	{ id = "DIRECT", name = "Juego directo", possession = -0.02, chances = 1.20, quality = 0.95, description = "Muchas ocasiones de menor calidad." },
}

-- Penalización por jugar fuera de posición
TacticsConfig.OUT_OF_POSITION = 0.80
TacticsConfig.GK_OUT_OF_POSITION = 0.40

-- ===== Motor =====
TacticsConfig.CHUNKS = 18 -- tramos de 5 minutos
TacticsConfig.CHANCE_BASE = 0.55 -- probabilidad base de ocasión por tramo con posesión e igualdad al 50 %
TacticsConfig.BALANCE_EXPONENT = 3 -- cuánto pesa la diferencia ataque/defensa (calibrado: ~2,3 goles por partido)
TacticsConfig.ON_TARGET_BASE = 0.45
TacticsConfig.GOAL_BASE = 0.42
TacticsConfig.HOME_ADVANTAGE = 0.02 -- +2 % de base para el local
TacticsConfig.CROWD_ADVANTAGE = 0.03 -- hasta +3 % más con el estadio lleno
TacticsConfig.FATIGUE_MINUTE = 60 -- desde aquí pesa la resistencia
TacticsConfig.ASSIST_CHANCE = 0.75

-- ===== Forma física y lesiones =====
TacticsConfig.FITNESS_COST_MAX = 20 -- un titular con resistencia 0 pierde 20
TacticsConfig.FITNESS_COST_MIN = 10 -- ... y con resistencia 99 pierde 10
TacticsConfig.FITNESS_RECOVERY = 12 -- por jornada
TacticsConfig.INJURY_CHANCE = 0.015 -- por titular y partido
TacticsConfig.INJURY_CHANCE_INTENSE = 0.01 -- extra con entrenamiento intenso
TacticsConfig.INJURY_MIN = 2 -- jornadas de baja
TacticsConfig.INJURY_MAX = 6

-- ===== Amistosos (FASE 5; las ligas llegan en la FASE 7) =====
TacticsConfig.FRIENDLY_OFFERS = 3
TacticsConfig.FRIENDLY_DIFFICULTY = {
	{ id = "EASY", name = "Asequible", delta = -6 },
	{ id = "EVEN", name = "Igualado", delta = 0 },
	{ id = "HARD", name = "Exigente", delta = 6 },
}
TacticsConfig.FRIENDLY_PRIZE_BASE = 500 -- premio por victoria con rival de media 50
TacticsConfig.PRIZE_DRAW = 0.4
TacticsConfig.PRIZE_LOSS = 0.15
TacticsConfig.SATISFACTION_WIN = 2
TacticsConfig.SATISFACTION_LOSS = -2
TacticsConfig.REPUTATION_WIN = 1 -- reputación ganada al vencer a un rival igual o mejor (−3)
TacticsConfig.MAX_MATCH_HISTORY = 20

-- Nombres de clubes rivales (ficticios)
TacticsConfig.ClubPrefixes = { "Atlético", "Deportivo", "Racing", "Unión", "Sporting", "Real", "Club", "Juventud", "Olímpico", "Estrella" }
TacticsConfig.ClubTowns = {
	"Villaverde", "Montesol", "Puerto Azul", "Valdeluz", "Rocanegra", "San Fermín del Río", "Altamira", "Costaflor",
	"Torrebrava", "Lagoverde", "Peñalba", "Bahía Clara", "Campoalto", "Sierramar", "Fuentevieja", "Robledo",
}

function TacticsConfig.Formation(id)
	for _, f in ipairs(TacticsConfig.Formations) do
		if f.id == id then
			return f
		end
	end
	return TacticsConfig.Formations[1]
end

function TacticsConfig.Mentality(id)
	for _, m in ipairs(TacticsConfig.Mentalities) do
		if m.id == id then
			return m
		end
	end
	return TacticsConfig.Mentalities[2]
end

function TacticsConfig.Style(id)
	for _, s in ipairs(TacticsConfig.Styles) do
		if s.id == id then
			return s
		end
	end
	return TacticsConfig.Styles[1]
end

return TacticsConfig
