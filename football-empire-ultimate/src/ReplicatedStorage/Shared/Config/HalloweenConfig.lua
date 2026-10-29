-- HalloweenConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/HalloweenConfig
--
-- EVENTO «DOCES OU TRAVESSURAS» (truco o trato) en el estadio:
--   * Caramelos repartidos por todos los estadios: se recogen caminando sobre ellos.
--   * Puertas de las instalaciones (de cualquier club): «¿Truco o trato?» con la tecla F.
--   * Los caramelos se canjean por premios (dinero y cosméticos de Halloween gratuitos).
-- El evento se activa solo en las fechas indicadas. FORCE_ACTIVE = true lo activa siempre (pruebas).

local HalloweenConfig = {}

HalloweenConfig.FORCE_ACTIVE = false
-- Ventana del evento (mes, día) en hora UTC, ambos incluidos.
HalloweenConfig.START = { month = 10, day = 15 }
HalloweenConfig.FINISH = { month = 11, day = 7 }

HalloweenConfig.NAME = "Doces ou Travessuras"
HalloweenConfig.ICON = "🎃"

-- Caramelos en el mundo
HalloweenConfig.CANDIES_PER_PLOT = 12
HalloweenConfig.CANDY_RESPAWN_SECONDS = 20
HalloweenConfig.GOLDEN_CHANCE = 0.06 -- caramelo dorado
HalloweenConfig.CANDY_VALUE = 1
HalloweenConfig.GOLDEN_VALUE = 5

-- Puertas: «¿Truco o trato?»
HalloweenConfig.DOOR_COOLDOWN = 45 -- segundos por jugador y puerta
HalloweenConfig.TREAT_CHANCE = 0.7
HalloweenConfig.TREAT_MIN = 3
HalloweenConfig.TREAT_MAX = 8
HalloweenConfig.Tricks = {
	{ id = "scare", text = "👻 ¡BUUH! Te han dado un buen susto." },
	{ id = "speed", text = "🏃 ¡Truco! Pies de fantasma: corres muy rápido unos segundos.", walkSpeed = 34, seconds = 8 },
	{ id = "jump", text = "🦇 ¡Truco! Saltos de murciélago durante unos segundos.", jumpPower = 90, seconds = 8 },
	{ id = "fog", text = "🌫️ ¡Truco! Una niebla espesa cubre el estadio.", seconds = 10 },
}

-- Premios a cambio de caramelos
HalloweenConfig.Rewards = {
	{ id = "money_small", name = "Bolsa de monedas", icon = "💰", cost = 30, money = 2000 },
	{ id = "money_big", name = "Cofre del tesoro", icon = "💎", cost = 120, money = 10000 },
	{ id = "deco_pumpkin", name = "Decoración: Calabaza gigante", icon = "🎃", cost = 60, unlock = "deco_pumpkin" },
	{ id = "crest_pumpkin", name = "Escudo: Calabaza", icon = "🛡️", cost = 100, unlock = "crest_pumpkin" },
	{ id = "palette_halloween", name = "Colores: Noche de Halloween", icon = "🎨", cost = 150, unlock = "palette_halloween" },
	{ id = "effect_bats", name = "Efecto: Murciélagos", icon = "🦇", cost = 200, unlock = "effect_bats" },
}

-- Qué facilidades tienen puerta para pedir caramelos
HalloweenConfig.DOOR_FACILITIES = {
	lockers = true, shop = true, restaurant = true, vip = true, training = true,
	academy = true, trophyRoom = true, kiosks = true, tour = true,
}

local function dayNumber(month, day)
	return month * 100 + day
end

function HalloweenConfig.IsActive(now)
	if HalloweenConfig.FORCE_ACTIVE then
		return true
	end
	local t = os.date("!*t", now or os.time())
	local today = dayNumber(t.month, t.day)
	local startDay = dayNumber(HalloweenConfig.START.month, HalloweenConfig.START.day)
	local finishDay = dayNumber(HalloweenConfig.FINISH.month, HalloweenConfig.FINISH.day)
	return today >= startDay and today <= finishDay
end

function HalloweenConfig.Reward(id)
	for _, reward in ipairs(HalloweenConfig.Rewards) do
		if reward.id == id then
			return reward
		end
	end
	return nil
end

return HalloweenConfig
