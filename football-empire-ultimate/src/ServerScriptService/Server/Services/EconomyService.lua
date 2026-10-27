-- EconomyService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/EconomyService
--
-- Economía AUTORITATIVA del servidor:
--   * Ciclo económico periódico (jornada) con ingresos y gastos reales.
--   * Gastos puntuales (construcción) validados.
--   * Deuda con intereses y amortización.
--   * Historial de transacciones.
-- El cliente nunca envía cantidades de dinero: solo intenciones (p. ej. "mejorar gradas").

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)

local EconomyService = {}

local nextCycleAt = {} -- [player] = os.clock() del próximo ciclo
local cycleCallbacks = {}

EconomyService.Category = {
	TICKETS = "Entradas",
	SHOP = "Tienda",
	RESTAURANT = "Restaurante",
	SPONSORS = "Patrocinadores",
	VIP = "Zona VIP",
	MAINTENANCE = "Mantenimiento",
	STAFF = "Personal",
	WAGES = "Salarios",
	INTEREST = "Intereses",
	CONSTRUCTION = "Construcción",
	DECORATION = "Decoración",
	DEBT = "Deuda",
	REFUND = "Reembolso",
}
local C = EconomyService.Category

function EconomyService.AddTransaction(data, amount, category, note)
	local list = data.economy.transactions
	table.insert(list, {
		t = os.time(),
		amount = math.floor(amount),
		category = category,
		note = note,
	})
	while #list > GameConfig.MAX_TRANSACTIONS do
		table.remove(list, 1)
	end
end

-- Gasto puntual validado. Devuelve ok, mensaje.
function EconomyService.Spend(player, amount, category, note)
	local data = DataService.Get(player)
	amount = math.floor(tonumber(amount) or -1)
	if amount < 0 then
		return false, "Cantidad no válida."
	end
	if data.economy.money < amount then
		return false, "Dinero insuficiente."
	end
	data.economy.money -= amount
	data.economy.totalSpent += amount
	EconomyService.AddTransaction(data, -amount, category, note)
	return true
end

function EconomyService.Earn(player, amount, category, note)
	local data = DataService.Get(player)
	amount = math.floor(tonumber(amount) or 0)
	if amount <= 0 then
		return
	end
	data.economy.money += amount
	data.economy.totalEarned += amount
	EconomyService.AddTransaction(data, amount, category, note)
end

function EconomyService.RunCycle(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local result = EconomyFormulas.Cycle(data)
	local economy = data.economy

	economy.money += result.totalIncome
	economy.totalEarned += result.totalIncome
	economy.money -= result.totalExpenses
	economy.totalSpent += result.totalExpenses

	-- Déficit -> deuda
	local newDebt = 0
	if economy.money < 0 then
		newDebt = -economy.money
		economy.debt += newDebt
		economy.money = 0
	end

	-- Amortización automática con parte del beneficio
	local repaid = 0
	if result.net > 0 and economy.debt > 0 then
		repaid = math.min(economy.debt, math.floor(result.net * GameConfig.DEBT_AUTO_REPAY_SHARE), economy.money)
		economy.debt -= repaid
		economy.money -= repaid
	end

	data.club.fans = math.max(0, data.club.fans + result.fanDelta)
	data.stats.cycles += 1

	economy.lastCycle = {
		t = os.time(),
		attendance = result.attendance,
		capacity = result.capacity,
		income = result.income,
		expenses = result.expenses,
		totalIncome = result.totalIncome,
		totalExpenses = result.totalExpenses,
		net = result.net,
		fanDelta = result.fanDelta,
		newDebt = newDebt,
		repaid = repaid,
	}

	local summary = string.format("%d espectadores", result.attendance)
	EconomyService.AddTransaction(data, result.totalIncome, "Jornada", "Ingresos · " .. summary)
	EconomyService.AddTransaction(data, -result.totalExpenses, "Jornada", "Gastos (mantenimiento, personal, intereses)")
	if newDebt > 0 then
		EconomyService.AddTransaction(data, 0, C.DEBT, string.format("Déficit de %d convertido en deuda", newDebt))
	end
	if repaid > 0 then
		EconomyService.AddTransaction(data, -repaid, C.DEBT, "Amortización automática de deuda")
	end

	for _, callback in ipairs(cycleCallbacks) do
		task.spawn(callback, player, economy.lastCycle)
	end
end

function EconomyService.RepayDebt(player, amount)
	local data = DataService.Get(player)
	local economy = data.economy
	if economy.debt <= 0 then
		return false, "No tienes deuda."
	end
	amount = math.floor(tonumber(amount) or 0)
	if amount <= 0 then
		amount = economy.debt -- 0 o vacío = pagar todo lo posible
	end
	amount = math.min(amount, economy.debt, economy.money)
	if amount <= 0 then
		return false, "No tienes dinero para pagar la deuda."
	end
	economy.money -= amount
	economy.debt -= amount
	economy.totalSpent += amount
	EconomyService.AddTransaction(data, -amount, C.DEBT, "Pago de deuda")
	return true, "Has pagado " .. amount .. " " .. GameConfig.CURRENCY .. " de deuda."
end

function EconomyService.SetTicketPrice(player, optionId)
	local data = DataService.Get(player)
	for _, option in ipairs(GameConfig.TICKET_PRICES) do
		if option.id == optionId then
			data.economy.ticketPrice = option.id
			return true, "Precio de entradas: " .. option.name
		end
	end
	return false, "Precio no válido."
end

function EconomyService.SecondsToNextCycle(player)
	local at = nextCycleAt[player]
	if not at then
		return GameConfig.ECONOMY_CYCLE_SECONDS
	end
	return math.max(0, at - os.clock())
end

-- Resumen económico para la interfaz.
function EconomyService.Summary(player, data)
	local forecast = EconomyFormulas.Cycle(data)
	local averageIncome = forecast.totalIncome
	return {
		money = data.economy.money,
		debt = data.economy.debt,
		debtLimit = GameConfig.DEBT_BUILD_LIMIT,
		ticketPrice = data.economy.ticketPrice,
		totalEarned = data.economy.totalEarned,
		totalSpent = data.economy.totalSpent,
		clubValue = EconomyFormulas.ClubValue(data),
		wageBudget = math.floor(averageIncome * GameConfig.WAGE_BUDGET_SHARE_OF_INCOME),
		transferBudget = math.floor(data.economy.money * GameConfig.TRANSFER_BUDGET_SHARE_OF_MONEY),
		lastCycle = data.economy.lastCycle,
		forecast = {
			attendance = forecast.attendance,
			capacity = forecast.capacity,
			attractiveness = forecast.attractiveness,
			income = forecast.income,
			expenses = forecast.expenses,
			totalIncome = forecast.totalIncome,
			totalExpenses = forecast.totalExpenses,
			net = forecast.net,
			fanCap = forecast.fanCap,
		},
		reputation = forecast.reputation,
		cycleSeconds = GameConfig.ECONOMY_CYCLE_SECONDS,
		nextCycleIn = EconomyService.SecondsToNextCycle(player),
		transactions = data.economy.transactions,
	}
end

function EconomyService.OnCycle(callback)
	table.insert(cycleCallbacks, callback)
end

function EconomyService.PlayerReady(player)
	nextCycleAt[player] = os.clock() + GameConfig.ECONOMY_CYCLE_SECONDS
end

function EconomyService.PlayerRemoving(player)
	nextCycleAt[player] = nil
end

function EconomyService.Start()
	task.spawn(function()
		while true do
			task.wait(1)
			local now = os.clock()
			for player, at in pairs(nextCycleAt) do
				if now >= at then
					nextCycleAt[player] = at + GameConfig.ECONOMY_CYCLE_SECONDS
					if player.Parent and DataService.Get(player) then
						local ok, err = pcall(EconomyService.RunCycle, player)
						if not ok then
							warn("[EconomyService] Error en el ciclo de ", player.Name, ": ", err)
						end
					end
				end
			end
		end
	end)
end

return EconomyService
