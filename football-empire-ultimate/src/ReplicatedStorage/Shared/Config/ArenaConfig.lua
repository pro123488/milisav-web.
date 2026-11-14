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
ArenaConfig.PASS_MIN_SPEED = 40 -- pase al compañero (la fuerza depende de la distancia)
ArenaConfig.PASS_MAX_SPEED = 100
ArenaConfig.HEADER_SPEED = 52 -- cabezazo
ArenaConfig.HEADER_LIFT = 9
ArenaConfig.GOLDEN_GOAL_SECONDS = 60 -- prórroga si hay empate: el primer gol gana

-- Bots
ArenaConfig.BOT_SPEED = 17
ArenaConfig.BOT_KEEPER_SPEED = 15
ArenaConfig.BOT_KICK_COOLDOWN = 0.9
ArenaConfig.BOT_PASS_CHANCE = 0.55 -- probabilidad de pasar en vez de chutar cuando está lejos
ArenaConfig.BOT_PASS_MIN_DISTANCE = 45 -- distancia a la portería a partir de la que piensa en pasar
ArenaConfig.BOT_PASS_MIN_GAIN = 12 -- el compañero debe estar al menos así de más cerca de la portería
ArenaConfig.BOT_NAMES = { "Bot Rayo", "Bot Muralla", "Bot Crack", "Bot Tornado", "Bot Pibe", "Bot Toro", "Bot Mago", "Bot Flecha" }

-- Recompensas (dinero del club; no hay ventajas de pago)
ArenaConfig.REWARD_WIN = 3000
ArenaConfig.REWARD_DRAW = 1500
ArenaConfig.REWARD_LOSS = 800
ArenaConfig.REWARD_GOAL = 400
ArenaConfig.REWARD_MVP = 1500 -- extra para el mejor jugador del partido
ArenaConfig.MAX_REWARDED_PER_HOUR = 12 -- evita granjear dinero sin límite

-- ESTADIOS: en cada partido se elige uno (el destacado de la semana sale la mitad de las veces).
-- Solo cambia el aspecto: el balón y las medidas son iguales en todos.
ArenaConfig.FEATURED_THEME_CHANCE = 0.5
ArenaConfig.Themes = {
	{ id = "classic", name = "Estadio clásico", icon = "🏟️", pitchMaterial = "Grass", floorMaterial = "Grass",
		pitchA = Color3.fromRGB(52, 150, 64), pitchB = Color3.fromRGB(62, 168, 74), floor = Color3.fromRGB(70, 110, 60), line = Color3.fromRGB(245, 245, 245) },
	{ id = "beach", name = "Playa", icon = "🏖️", pitchMaterial = "Sand", floorMaterial = "Sand",
		pitchA = Color3.fromRGB(236, 214, 160), pitchB = Color3.fromRGB(226, 200, 140), floor = Color3.fromRGB(245, 228, 185), line = Color3.fromRGB(255, 255, 255) },
	{ id = "street", name = "Cancha urbana", icon = "🏙️", pitchMaterial = "Asphalt", floorMaterial = "Concrete",
		pitchA = Color3.fromRGB(70, 74, 84), pitchB = Color3.fromRGB(80, 84, 96), floor = Color3.fromRGB(52, 54, 62), line = Color3.fromRGB(255, 220, 60) },
	{ id = "snow", name = "Nieve", icon = "🏔️", pitchMaterial = "Snow", floorMaterial = "Ice",
		pitchA = Color3.fromRGB(235, 242, 250), pitchB = Color3.fromRGB(215, 228, 245), floor = Color3.fromRGB(190, 215, 240), line = Color3.fromRGB(60, 120, 220) },
	{ id = "volcano", name = "Volcán", icon = "🌋", pitchMaterial = "Basalt", floorMaterial = "CrackedLava",
		pitchA = Color3.fromRGB(62, 46, 46), pitchB = Color3.fromRGB(76, 54, 50), floor = Color3.fromRGB(170, 50, 20), line = Color3.fromRGB(255, 170, 60) },
	{ id = "neon", name = "Arena neón", icon = "🌃", pitchMaterial = "SmoothPlastic", floorMaterial = "SmoothPlastic", lineMaterial = "Neon",
		pitchA = Color3.fromRGB(20, 22, 34), pitchB = Color3.fromRGB(28, 30, 46), floor = Color3.fromRGB(10, 10, 18), line = Color3.fromRGB(0, 255, 220) },
	{ id = "desert", name = "Desierto", icon = "🏜️", pitchMaterial = "Sandstone", floorMaterial = "Sand",
		pitchA = Color3.fromRGB(214, 170, 110), pitchB = Color3.fromRGB(200, 155, 95), floor = Color3.fromRGB(230, 190, 130), line = Color3.fromRGB(120, 60, 30) },
	{ id = "jungle", name = "Selva", icon = "🌴", pitchMaterial = "LeafyGrass", floorMaterial = "Mud",
		pitchA = Color3.fromRGB(60, 120, 50), pitchB = Color3.fromRGB(72, 136, 58), floor = Color3.fromRGB(80, 60, 40), line = Color3.fromRGB(255, 240, 180) },
	{ id = "moon", name = "Luna", icon = "🌙", pitchMaterial = "Slate", floorMaterial = "Rock",
		pitchA = Color3.fromRGB(150, 152, 160), pitchB = Color3.fromRGB(135, 137, 146), floor = Color3.fromRGB(90, 92, 100), line = Color3.fromRGB(120, 200, 255), lineMaterial = "Neon" },
	{ id = "candy", name = "Mundo dulce", icon = "🍭", pitchMaterial = "Plastic", floorMaterial = "SmoothPlastic",
		pitchA = Color3.fromRGB(255, 170, 210), pitchB = Color3.fromRGB(255, 195, 225), floor = Color3.fromRGB(170, 230, 255), line = Color3.fromRGB(255, 255, 255) },
	{ id = "castle", name = "Castillo", icon = "🏰", pitchMaterial = "Cobblestone", floorMaterial = "Granite",
		pitchA = Color3.fromRGB(120, 115, 105), pitchB = Color3.fromRGB(132, 126, 115), floor = Color3.fromRGB(80, 78, 74), line = Color3.fromRGB(255, 215, 80) },
	{ id = "glacier", name = "Glaciar", icon = "🧊", pitchMaterial = "Glacier", floorMaterial = "Ice",
		pitchA = Color3.fromRGB(170, 220, 245), pitchB = Color3.fromRGB(150, 205, 235), floor = Color3.fromRGB(210, 235, 250), line = Color3.fromRGB(30, 80, 160) },
}

function ArenaConfig.Theme(id)
	for _, theme in ipairs(ArenaConfig.Themes) do
		if theme.id == id then
			return theme
		end
	end
	return ArenaConfig.Themes[1]
end

-- Plataforma de entrada en la avenida (junto al punto de aparición)
ArenaConfig.LOBBY_PAD = CFrame.new(40, 0, 0)

return ArenaConfig
