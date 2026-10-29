-- NetworkConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/NetworkConfig
-- RED DE CLUBES Y MULTIJUGADOR (FASE 9).

local NetworkConfig = {}

-- ===== Invitaciones a partidos (jugadores del mismo servidor) =====
NetworkConfig.INVITE_SECONDS = 60 -- tiempo para aceptar una invitación
-- Los amistosos entre usuarios no dan dinero ni puntos (evita que dos amigos "farmeen").

-- ===== Retos (contra la hoja pública de cualquier club, aunque esté en otro servidor) =====
NetworkConfig.CHALLENGES_PER_DAY = 5
NetworkConfig.CHALLENGE_SAME_TARGET_PER_DAY = 1
NetworkConfig.POINTS_WIN = 3 -- puntos de red
NetworkConfig.POINTS_DRAW = 1
NetworkConfig.INBOX_STORE = "FEU_Network_Inbox_v1" -- avisos para el club retado
NetworkConfig.INBOX_MAX = 20
NetworkConfig.NETWORK_RANK_STORE = "FEU_Rank_Network_v1"

-- ===== Amigos =====
NetworkConfig.MAX_FRIENDS_SHOWN = 20
NetworkConfig.FRIENDS_CACHE_SECONDS = 300

-- ===== Historial de enfrentamientos =====
NetworkConfig.H2H_MAX_OPPONENTS = 50

-- ===== Torneos del servidor =====
NetworkConfig.TOURNAMENT_SIZES = { 4, 8 }
NetworkConfig.TOURNAMENT_JOIN_SECONDS = 45 -- inscripción abierta
NetworkConfig.TOURNAMENT_ROUND_SECONDS = 8 -- pausa entre rondas
NetworkConfig.TOURNAMENT_COOLDOWN = 1800 -- un torneo creado por jugador cada 30 min
NetworkConfig.TOURNAMENT_PRIZE = 5000 -- × premio de la división del campeón; solo con 2+ clubes humanos
NetworkConfig.TOURNAMENT_POINTS = 10
NetworkConfig.TOURNAMENT_NAME = "Torneo de la Red"

-- ===== Eventos comunitarios (objetivo compartido por todos los clubes del servidor) =====
NetworkConfig.COMMUNITY_GOALS = {
	{ id = "goals", metric = "goals", target = 40, text = "Entre todos los clubes del servidor, marcar %d goles", reward = 4000 },
	{ id = "wins", metric = "wins", target = 15, text = "Entre todos, ganar %d partidos", reward = 4000 },
	{ id = "matches", metric = "matches", target = 25, text = "Entre todos, jugar %d partidos", reward = 3000 },
}
NetworkConfig.COMMUNITY_PERIOD = 3600 -- un objetivo nuevo cada hora

return NetworkConfig
