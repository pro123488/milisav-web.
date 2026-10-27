-- GameConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/GameConfig
--
-- Constantes generales del juego y del equilibrio económico.
-- Todo el equilibrio se ajusta desde aquí, sin tocar la lógica.

local GameConfig = {}

GameConfig.GAME_NAME = "FOOTBALL EMPIRE ULTIMATE"
GameConfig.VERSION = "0.1.0-fase1"
GameConfig.CURRENCY = "$"

-- ===== Guardado =====
GameConfig.DATASTORE_NAME = "FEU_Clubs_v1"
GameConfig.DATA_VERSION = 1
GameConfig.AUTOSAVE_SECONDS = 120
GameConfig.SESSION_LOCK_SECONDS = 600 -- un bloqueo más antiguo se considera abandonado
GameConfig.MAX_TRANSACTIONS = 60

-- ===== Economía =====
GameConfig.STARTING_MONEY = 15000
GameConfig.ECONOMY_CYCLE_SECONDS = 60 -- cada ciclo = una jornada de actividad del estadio
GameConfig.STARTING_FANS = 250

-- Precio de entradas: decisión del jugador con efecto real sobre la asistencia.
GameConfig.TICKET_PRICES = {
	{ id = "LOW", name = "Económico", price = 3, demand = 1.20 },
	{ id = "NORMAL", name = "Normal", price = 5, demand = 1.00 },
	{ id = "HIGH", name = "Premium", price = 8, demand = 0.72 },
}
GameConfig.DEFAULT_TICKET = "NORMAL"

-- Parte de los aficionados que acude en cada jornada (antes de aplicar demanda y atractivo).
GameConfig.TURNOUT_RATE = 0.5
-- Crecimiento de aficionados hacia su techo en cada ciclo.
GameConfig.FAN_GROWTH_RATE = 0.03
GameConfig.FAN_CAP_PER_SEAT = 2
GameConfig.FAN_CAP_PER_REPUTATION = 20

-- Patrocinio básico (los contratos completos llegan en la FASE 3).
GameConfig.SPONSOR_BASE = 100
GameConfig.SPONSOR_PER_REPUTATION = 4

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
GameConfig.FREE_DECORATION_SLOTS = 4
GameConfig.PRO_DECORATION_SLOTS = 8 -- con Constructor Pro (siempre dentro del terreno)

-- ===== Terrenos =====
GameConfig.PLOT_COUNT = 8
GameConfig.PLOT_SIZE = Vector3.new(220, 1, 170)
GameConfig.PLOT_SPACING = 40

-- ===== Seguridad =====
GameConfig.ACTION_RATE_LIMIT = 12 -- acciones por ventana
GameConfig.ACTION_RATE_WINDOW = 5 -- segundos

-- ===== Game Passes =====
GameConfig.OWNERSHIP_RETRY_ATTEMPTS = 3
GameConfig.OWNERSHIP_RECHECK_SECONDS = 90 -- reintento en segundo plano cuando Roblox no responde
GameConfig.PRICE_CACHE_SECONDS = 600

return GameConfig
