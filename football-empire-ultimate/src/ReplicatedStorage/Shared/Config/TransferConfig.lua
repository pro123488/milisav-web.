-- TransferConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/TransferConfig
-- MERCADO DE FICHAJES (FASE 6): compras, ventas, ofertas y cesiones.
-- Todos los clubes y jugadores del mercado son ficticios y los genera el servidor.

local TransferConfig = {}

-- ===== Mercado =====
TransferConfig.MARKET_SIZE = 10 -- jugadores en venta
TransferConfig.LOAN_LISTINGS = 3 -- de ellos, disponibles como cesión
TransferConfig.FREE_AGENTS = 2 -- de ellos, libres (sin traspaso, con prima de fichaje)
TransferConfig.REFRESH_CYCLES = 5 -- jornadas entre renovaciones del mercado
TransferConfig.STRENGTH_MIN = -10 -- media respecto a tu mejor once
TransferConfig.STRENGTH_MAX = 12

-- Precio pedido = valor de mercado × [ASK_MIN, ASK_MAX]
TransferConfig.ASK_MIN = 0.95
TransferConfig.ASK_MAX = 1.35

-- Negociación: proporción del precio pedido que ofreces -> probabilidad de aceptación.
-- Un rechazo bloquea nuevas ofertas por ese jugador hasta la siguiente renovación del mercado.
TransferConfig.OfferLevels = {
	{ id = "FULL", name = "Precio pedido", share = 1.00, chance = 1.00 },
	{ id = "MINUS10", name = "−10 %", share = 0.90, chance = 0.50 },
	{ id = "MINUS20", name = "−20 %", share = 0.80, chance = 0.20 },
}

TransferConfig.SALARY_PREMIUM = 1.1 -- un fichaje pide un 10 % más de salario
TransferConfig.FREE_AGENT_BONUS = 0.2 -- prima de un jugador libre = 20 % de su valor
TransferConfig.DEFAULT_CONTRACT = 3

-- Presupuesto de fichajes: parte del dinero que el club permite gastar en traspasos
TransferConfig.BudgetShares = { 0.25, 0.5, 0.75, 1.0 }
TransferConfig.DEFAULT_BUDGET_SHARE = 0.5

-- ===== Cesiones =====
TransferConfig.LOAN_IN_FEE = 0.01 -- coste por jornada de una cesión recibida = 1 % del valor (más su salario)
TransferConfig.LOAN_OUT_FEE = 0.008 -- ingreso por jornada al ceder a un jugador = 0,8 % de su valor
TransferConfig.LOAN_OUT_CHANCE = 0.5 -- probabilidad por jornada de que un club acepte la cesión ofrecida

-- ===== Ofertas por tus jugadores =====
TransferConfig.LISTED_OFFER_CHANCE = 0.35 -- por jornada y jugador en venta
TransferConfig.UNSOLICITED_CHANCE = 0.05 -- por jornada, oferta espontánea por uno de tus 3 mejores
TransferConfig.OFFER_MIN = 0.8 -- proporción del valor de mercado
TransferConfig.OFFER_MAX = 1.2
TransferConfig.UNSOLICITED_PREMIUM = 1.15 -- las ofertas espontáneas pagan más
TransferConfig.OFFER_EXPIRY = 3 -- jornadas
TransferConfig.MAX_OFFERS = 6

return TransferConfig
