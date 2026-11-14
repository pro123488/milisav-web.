-- ArenaConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/ArenaConfig
--
-- PARTIDOS EN GRUPO: fútbol jugable en tiempo real (equipos Rojo y Azul).
-- Los huecos de cada equipo se rellenan con bots para poder jugar solo o con pocos amigos.

local ArenaConfig = {}

-- El estadio de partidos está fuera de la zona de terrenos (al sur de la avenida).
ArenaConfig.ORIGIN = CFrame.new(0, 0, 720)

-- Campo: el eje X es el largo (porterías en ±X).
ArenaConfig.FIELD_LENGTH = 150
ArenaConfig.FIELD_WIDTH = 96
ArenaConfig.GOAL_WIDTH = 26
ArenaConfig.GOAL_HEIGHT = 11
ArenaConfig.GOAL_DEPTH = 7
ArenaConfig.WALL_HEIGHT = 40

ArenaConfig.BALL_SIZE = 3
ArenaConfig.BALL_ELASTICITY = 0.55

-- Duración y ritmo
ArenaConfig.MATCH_SECONDS = 180
ArenaConfig.QUEUE_COUNTDOWN = 15 -- cuenta atrás cuando hay alguien en la cola
ArenaConfig.QUEUE_COUNTDOWN_FULL = 5 -- si la cola está llena
ArenaConfig.KICKOFF_FREEZE = 3 -- segundos quietos antes de cada saque
ArenaConfig.GOAL_CELEBRATION = 3
ArenaConfig.RESULT_SECONDS = 6

-- Equipos
ArenaConfig.MAX_PER_TEAM = 5
ArenaConfig.MIN_PER_TEAM = 3 -- se completa con bots hasta este número
ArenaConfig.TEAMS = {
	{ id = "red", name = "Rojo", color = Color3.fromRGB(230, 60, 60), brick = "Bright red" },
	{ id = "blue", name = "Azul", color = Color3.fromRGB(50, 120, 240), brick = "Bright blue" },
}

-- Chut (validado en el servidor)
ArenaConfig.KICK_RANGE = 7.5 -- distancia máxima del jugador al balón
ArenaConfig.KICK_COOLDOWN = 0.3
ArenaConfig.KICK_MIN_SPEED = 45
ArenaConfig.KICK_MAX_SPEED = 115
ArenaConfig.KICK_MIN_LIFT = 6
ArenaConfig.KICK_MAX_LIFT = 32
ArenaConfig.DRIBBLE_SPEED = 20 -- empujón al tocar el balón corriendo

-- Bots
ArenaConfig.BOT_SPEED = 17
ArenaConfig.BOT_KEEPER_SPEED = 15
ArenaConfig.BOT_KICK_COOLDOWN = 0.9
ArenaConfig.BOT_NAMES = { "Bot Rayo", "Bot Muralla", "Bot Crack", "Bot Tornado", "Bot Pibe", "Bot Toro", "Bot Mago", "Bot Flecha" }

-- Recompensas (dinero del club; no hay ventajas de pago)
ArenaConfig.REWARD_WIN = 3000
ArenaConfig.REWARD_DRAW = 1500
ArenaConfig.REWARD_LOSS = 800
ArenaConfig.REWARD_GOAL = 400
ArenaConfig.MAX_REWARDED_PER_HOUR = 12 -- evita granjear dinero sin límite

-- Plataforma de entrada en la avenida (junto al punto de aparición)
ArenaConfig.LOBBY_PAD = CFrame.new(40, 0, 0)

return ArenaConfig
