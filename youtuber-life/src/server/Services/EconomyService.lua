--!nonstrict
-- EconomyService: dinero virtual, movimientos, informes mensuales, ahorro, metas y préstamos.
-- El dinero del juego es independiente de Robux. Solo el servidor modifica el saldo.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Util = require(Shared.Util)

local Economy = {}
local S

local function monthKey()
	return "M" .. S.Time.monthIndex()
end

local function bucket(data)
	local key = monthKey()
	local m = data.Monthly[key]
	if not m then
		m = { Inc = {}, Exp = {} }
		data.Monthly[key] = m
		-- conservar solo los últimos meses
		local keys = {}
		for k in pairs(data.Monthly) do
			keys[#keys + 1] = k
		end
		table.sort(keys, function(a, b)
			return tonumber(a:sub(2)) > tonumber(b:sub(2))
		end)
		for i = Config.MonthsKept + 1, #keys do
			data.Monthly[keys[i]] = nil
		end
	end
	return m
end

local function log(data, amount, category, desc)
	Util.pushCapped(data.Transactions, { T = os.time(), A = amount, C = category, D = desc, B = data.Money }, Config.MaxTransactions)
	local m = bucket(data)
	if amount >= 0 then
		m.Inc[category] = (m.Inc[category] or 0) + amount
	else
		m.Exp[category] = (m.Exp[category] or 0) - amount
	end
end

function Economy.Init(services)
	S = services
end

-- Suma dinero. opts.taxable aplica el impuesto simulado; opts.silent no avisa.
function Economy.add(player, amount, category, desc, opts)
	local data = S.Data.get(player)
	if not data or amount <= 0 then
		return 0
	end
	amount = math.floor(amount + 0.5)
	opts = opts or {}
	data.Money = data.Money + amount
	data.LifetimeEarned = data.LifetimeEarned + amount
	log(data, amount, category, desc)
	local net = amount
	if opts.taxable then
		local tax = math.floor(amount * Config.IncomeTaxRate + 0.5)
		if tax > 0 then
			data.Money = data.Money - tax
			log(data, -tax, "Impuestos", "Impuesto (" .. math.floor(Config.IncomeTaxRate * 100) .. "%) sobre " .. desc)
			net = amount - tax
		end
	end
	-- Pago automático del préstamo: 10% de los ingresos imponibles
	if opts.taxable and data.Bank.Loan > 0 then
		local pay = math.min(data.Bank.Loan, math.floor(net * 0.1 + 0.5), data.Money)
		if pay > 0 then
			data.Money = data.Money - pay
			data.Bank.Loan = data.Bank.Loan - pay
			log(data, -pay, "Préstamo", "Cuota automática del préstamo")
		end
	end
	S.Data.markDirty(player)
	if not opts.silent then
		S.Net.push(player, "cash", { amount = net, desc = desc })
	end
	return net
end

function Economy.canAfford(player, amount)
	local data = S.Data.get(player)
	return data ~= nil and data.Money >= amount
end

-- Cobra dinero. Devuelve false si no alcanza (no deja saldo negativo).
function Economy.spend(player, amount, category, desc)
	local data = S.Data.get(player)
	amount = math.floor(amount + 0.5)
	if not data or amount < 0 or data.Money < amount then
		return false
	end
	if amount == 0 then
		return true
	end
	data.Money = data.Money - amount
	log(data, -amount, category, desc)
	S.Data.markDirty(player)
	return true
end

function Economy.balanceSummary(data)
	local m = data.Monthly[monthKey()] or { Inc = {}, Exp = {} }
	local inc, exp = 0, 0
	for _, v in pairs(m.Inc) do
		inc = inc + v
	end
	for _, v in pairs(m.Exp) do
		exp = exp + v
	end
	return inc, exp
end

function Economy.loanLimit(data)
	return 1000 + data.Level * 500
end

-- Interés semanal de ahorros (1% por semana de juego, hasta 500 por semana)
function Economy.onNewDay(player, day)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local bank = data.Bank
	if day - bank.LastInterestDay >= Config.DaysPerMonth then
		bank.LastInterestDay = day
		local interest = math.min(500, math.floor(bank.Savings * 0.01))
		if interest > 0 then
			bank.Savings = bank.Savings + interest
			log(data, 0, "Ahorros", "Intereses de ahorro: +" .. interest .. " (en la cuenta de ahorro)")
			S.Net.notify(player, "Tus ahorros generaron $" .. interest .. " de interés.", "success")
		end
	end
end

function Economy.Start()
	local Net = S.Net

	Net.on("Bank.Deposit", function(player, p)
		local amount = math.floor(tonumber(p.amount) or 0)
		if amount <= 0 then
			return false, "Cantidad no válida."
		end
		if not Economy.spend(player, amount, "Ahorros", "Depósito en la cuenta de ahorro") then
			return false, "No tienes suficiente dinero."
		end
		local data = S.Data.get(player)
		data.Bank.Savings = data.Bank.Savings + amount
		return true, "Depositaste $" .. Util.formatInt(amount) .. " en ahorros."
	end)

	Net.on("Bank.Withdraw", function(player, p)
		local data = S.Data.get(player)
		local amount = math.floor(tonumber(p.amount) or 0)
		if amount <= 0 or amount > data.Bank.Savings then
			return false, "Cantidad no válida."
		end
		data.Bank.Savings = data.Bank.Savings - amount
		data.Money = data.Money + amount
		log(data, amount, "Ahorros", "Retiro de la cuenta de ahorro")
		return true, "Retiraste $" .. Util.formatInt(amount) .. "."
	end)

	Net.on("Bank.TakeLoan", function(player, p)
		local data = S.Data.get(player)
		local amount = math.floor(tonumber(p.amount) or 0)
		local limit = Economy.loanLimit(data)
		if amount < 100 then
			return false, "El préstamo mínimo es de $100."
		end
		if data.Bank.Loan + amount * (1 + data.Bank.LoanRate) > limit * (1 + data.Bank.LoanRate) then
			return false, "Superarías tu límite de préstamo ($" .. Util.formatInt(limit) .. ")."
		end
		local owed = math.floor(amount * (1 + data.Bank.LoanRate) + 0.5)
		data.Bank.Loan = data.Bank.Loan + owed
		data.Money = data.Money + amount
		log(data, amount, "Préstamo", "Préstamo recibido (devolverás $" .. owed .. ")")
		return true, "Préstamo concedido. Devolverás $" .. Util.formatInt(owed) .. " (10% fijo). Se descuenta el 10% de tus ingresos hasta saldarlo."
	end)

	Net.on("Bank.RepayLoan", function(player, p)
		local data = S.Data.get(player)
		local amount = math.min(math.floor(tonumber(p.amount) or 0), data.Bank.Loan)
		if amount <= 0 then
			return false, "No tienes deuda o la cantidad no es válida."
		end
		if not Economy.spend(player, amount, "Préstamo", "Pago manual del préstamo") then
			return false, "No tienes suficiente dinero."
		end
		data.Bank.Loan = data.Bank.Loan - amount
		return true, data.Bank.Loan == 0 and "¡Préstamo saldado!" or ("Quedan $" .. Util.formatInt(data.Bank.Loan) .. " por pagar.")
	end)

	Net.on("Bank.SetGoal", function(player, p)
		local data = S.Data.get(player)
		local name = Util.cleanText(p.name, 40)
		local target = math.floor(tonumber(p.target) or 0)
		if p.remove then
			local idx = tonumber(p.remove)
			if idx and data.Bank.Goals[idx] then
				table.remove(data.Bank.Goals, idx)
				return true, "Meta eliminada."
			end
			return false, "Meta no encontrada."
		end
		if not name or #name == 0 or target <= 0 then
			return false, "Escribe un nombre y una cantidad."
		end
		if #data.Bank.Goals >= 5 then
			return false, "Máximo 5 metas."
		end
		name = S.Text.filter(player, name)
		if not name then
			return false, "Ese nombre no está permitido."
		end
		table.insert(data.Bank.Goals, { Name = name, Target = target })
		return true, "Meta creada."
	end)
end

return Economy
