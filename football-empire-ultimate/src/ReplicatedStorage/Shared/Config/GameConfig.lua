-- GameConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/GameConfig
--
-- Constantes generales del juego y del equilibrio económico.
-- Todo el equilibrio se ajusta desde aquí, sin tocar la lógica.

local GameConfig = {}

GameConfig.GAME_NAME = "FOOTBALL EMPIRE ULTIMATE"
GameConfig.VERSION = "0.6.0-fase6"
GameConfig.CURRENCY = "$"

-- ===== Guardado =====
GameConfig.DATASTORE_NAME = "FEU_Clubs_v1"
GameConfig.DATA_VERSION = 6 -- v6: mercado de fichajes, ofertas y cesiones
GameConfig.AUTOSAVE_SECONDS = 120
GameConfig.SESSION_LOCK_SECONDS = 600 -- un bloqueo más antiguo se considera abandonado
GameConfig.MAX_TRANSACTIONS = 60

-- ===== Economía =====
GameConfig.STARTING_MONEY = 15000
GameConfig.ECONOMY_CYCLE_SECONDS = 60 -- cada ciclo = una jornada de actividad del estadio
GameConfig.STARTING_FANS = 250

-- Precio de entradas: decisión del jugador con efecto real sobre la asistencia.
GameConfig.TICKET_PRICES = {
	{ id = "LOW", name = "Económico", price = 3, demand = 1.20, satisfaction = 10 },
	{ id = "NORMAL", name = "Normal", price = 5, demand = 1.00, satisfaction = 0 },
	{ id = "HIGH", name = "Premium", price = 8, demand = 0.72, satisfaction = -12 },
}
GameConfig.DEFAULT_TICKET = "NORMAL"

-- Parte de los aficionados que acude en cada jornada (antes de aplicar demanda y atractivo).
GameConfig.TURNOUT_RATE = 0.5
-- Crecimiento de aficionados hacia su techo en cada ciclo.
GameConfig.FAN_GROWTH_RATE = 0.03
GameConfig.FAN_CAP_PER_SEAT = 2
GameConfig.FAN_CAP_PER_REPUTATION = 20

-- Patrocinio local básico (además de los contratos de SponsorConfig).
GameConfig.SPONSOR_BASE = 50
GameConfig.SPONSOR_PER_REPUTATION = 2

-- ===== Aficionados (FASE 3) =====
GameConfig.SATISFACTION_START = 60
GameConfig.SATISFACTION_SPEED = 0.10 -- se acerca un 10 % a su objetivo en cada jornada
GameConfig.SATISFACTION_BASE = 50
GameConfig.SATISFACTION_PER_STAGE = 2
GameConfig.SATISFACTION_ATTRACTIVENESS = 40 -- por cada +100 % de atractivo
GameConfig.SATISFACTION_ATTRACTIVENESS_MAX = 30
GameConfig.OVERCROWD_THRESHOLD = 1.2 -- demanda > 120 % del aforo
GameConfig.OVERCROWD_PENALTY = 8
GameConfig.FAN_DECLINE_SATISFACTION = 25 -- por debajo, los aficionados se van
GameConfig.FAN_DECLINE_RATE = 0.01
-- Socios (abonados): pagan cuota en cada jornada y siempre ocupan su asiento.
GameConfig.MEMBER_RATE_MIN = 0.08 -- proporción de aficionados que se hacen socios con satisfacción 0
GameConfig.MEMBER_RATE_MAX = 0.35 -- ... y con satisfacción 100
GameConfig.MEMBER_SEAT_SHARE = 0.6 -- como máximo el 60 % de los asientos son de socios
GameConfig.MEMBER_SPEED = 0.05
GameConfig.MEMBER_PRICES = {
	{ id = "LOW", name = "Económica", fee = 1, demand = 1.25, satisfaction = 5 },
	{ id = "NORMAL", name = "Normal", fee = 2, demand = 1.00, satisfaction = 0 },
	{ id = "HIGH", name = "Premium", fee = 3.5, demand = 0.70, satisfaction = -10 },
}

-- Personal: coste fijo + coste por instalación construida.
GameConfig.STAFF_BASE = 60

-- Deuda
GameConfig.DEBT_INTEREST_PER_CYCLE = 0.01 -- 1 % por ciclo
GameConfig.DEBT_AUTO_REPAY_SHARE = 0.25 -- parte del beneficio que amortiza deuda automáticamente
GameConfig.DEBT_BUILD_LIMIT = 10000 -- por encima de esta deuda no se permiten construcciones

-- Valor del club
GameConfig.VALUE_INVESTMENT_SHARE = 0.7
GameConfig.VALUE_PER_FAN = 8
GameConfig.VALUE_PER_REPUTATION = 400

-- Presupuestos (se usarán con plantilla y fichajes en las FASES 4 y 6)
GameConfig.WAGE_BUDGET_SHARE_OF_INCOME = 0.4
GameConfig.TRANSFER_BUDGET_SHARE_OF_MONEY = 0.25

-- ===== Club =====
GameConfig.CLUB_NAME_MIN = 3
GameConfig.CLUB_NAME_MAX = 24
GameConfig.SHORT_NAME_LEN = 3

-- ===== Construcción =====
-- Límite de decoraciones: lo marca la etapa del estadio (StadiumStages.effects.freeDecorations).
-- Constructor Pro añade PRO_EXTRA_DECORATIONS, siempre dentro de las zonas del propio terreno.
GameConfig.PRO_EXTRA_DECORATIONS = 6
GameConfig.MAX_DECORATIONS = 18 -- tope absoluto (12 de la etapa 7 + 6 de Constructor Pro)
-- Herramientas de colocación
GameConfig.FREE_GRID = 4 -- studs
GameConfig.PRO_GRID = 1 -- Constructor Pro: rejilla fina
GameConfig.FREE_ROTATION_STEP = 90 -- grados
GameConfig.PRO_ROTATION_STEP = 45 -- Constructor Pro: rotación a 45°
GameConfig.MAX_HISTORY_EVENTS = 100

-- ===== Terrenos =====
GameConfig.PLOT_COUNT = 8
GameConfig.PLOT_SIZE = Vector3.new(300, 1, 210)
GameConfig.PLOT_SPACING = 40

-- ===== Seguridad =====
GameConfig.ACTION_RATE_LIMIT = 12 -- acciones por ventana
GameConfig.ACTION_RATE_WINDOW = 5 -- segundos

-- ===== Game Passes =====
GameConfig.OWNERSHIP_RETRY_ATTEMPTS = 3
GameConfig.OWNERSHIP_RECHECK_SECONDS = 90 -- reintento en segundo plano cuando Roblox no responde
GameConfig.PRICE_CACHE_SECONDS = 600

return GameConfig
