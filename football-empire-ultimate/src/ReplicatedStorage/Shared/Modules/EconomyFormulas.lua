-- EconomyFormulas (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/EconomyFormulas
--
-- Fórmulas económicas PURAS (sin efectos secundarios).
-- El servidor las usa como única fuente de verdad para calcular ingresos y gastos.
-- El cliente las usa solo para mostrar previsiones; nunca decide nada.

local Config = script.Parent.Parent.Config
local GameConfig = require(Config.GameConfig)
local FacilityConfig = require(Config.FacilityConfig)
local CosmeticConfig = require(Config.CosmeticConfig)

local EconomyFormulas = {}

local function ticketOption(id)
	for _, option in ipairs(GameConfig.TICKET_PRICES) do
		if option.id == id then
			return option
		end
	end
	return GameConfig.TICKET_PRICES[2]
end
EconomyFormulas.TicketOption = ticketOption

-- Suma los efectos de todas las instalaciones construidas.
function EconomyFormulas.FacilityTotals(facilities)
	local totals = {
		capacity = 0,
		attractiveness = 1.0,
		shopSpend = 0,
		foodSpend = 0,
		vipIncome = 0,
		upkeep = 0,
		staff = 0,
		reputation = 0,
		invested = 0,
		builtCount = 0,
	}
	for id, def in pairs(FacilityConfig.Facilities) do
		local level = facilities[id] or 0
		if level > 0 then
			totals.builtCount += 1
			for l = 1, math.min(level, #def.levels) do
				totals.invested += def.levels[l].cost
			end
			local data = def.levels[math.min(level, #def.levels)]
			totals.capacity += data.capacity or 0
			totals.attractiveness += data.attractiveness or 0
			totals.shopSpend += data.shopSpend or 0
			totals.foodSpend += data.foodSpend or 0
			totals.vipIncome += data.vipIncome or 0
			totals.upkeep += data.upkeep or 0
			totals.staff += data.staff or 0
			totals.reputation += data.reputation or 0
		end
	end
	return totals
end

-- Bonificación por decoraciones: solo cuentan los espacios gratuitos (sin ventaja de pago).
function EconomyFormulas.DecorationBonus(decorations)
	local count = 0
	for slot, decoId in pairs(decorations or {}) do
		local slotIndex = tonumber(slot)
		if slotIndex and slotIndex <= GameConfig.FREE_DECORATION_SLOTS and decoId ~= nil then
			count += 1
		end
	end
	return count * CosmeticConfig.DECORATION_ATTRACTIVENESS
end

function EconomyFormulas.Reputation(data)
	local totals = EconomyFormulas.FacilityTotals(data.stadium.facilities)
	return totals.reputation + (data.club.reputationEarned or 0)
end

function EconomyFormulas.FanCap(capacity, attractiveness, reputation)
	return math.floor(capacity * GameConfig.FAN_CAP_PER_SEAT * attractiveness
		+ reputation * GameConfig.FAN_CAP_PER_REPUTATION)
end

-- Calcula un ciclo económico completo a partir de los datos del club.
-- Devuelve un desglose; el servidor es quien lo aplica.
function EconomyFormulas.Cycle(data)
	local facilities = data.stadium.facilities
	local totals = EconomyFormulas.FacilityTotals(facilities)
	local attractiveness = totals.attractiveness + EconomyFormulas.DecorationBonus(data.stadium.decorations)
	local reputation = totals.reputation + (data.club.reputationEarned or 0)
	local ticket = ticketOption(data.economy.ticketPrice)

	local fans = data.club.fans
	local attendance = math.floor(math.min(
		totals.capacity,
		fans * GameConfig.TURNOUT_RATE * ticket.demand * attractiveness
	))

	local income = {
		tickets = attendance * ticket.price,
		shop = math.floor(attendance * totals.shopSpend),
		restaurant = math.floor(attendance * totals.foodSpend),
		sponsors = GameConfig.SPONSOR_BASE + reputation * GameConfig.SPONSOR_PER_REPUTATION,
		vip = totals.vipIncome,
	}
	local expenses = {
		maintenance = totals.upkeep,
		staff = GameConfig.STAFF_BASE + totals.staff,
		wages = 0, -- salarios de la plantilla: FASE 4
		interest = math.floor((data.economy.debt or 0) * GameConfig.DEBT_INTEREST_PER_CYCLE),
	}

	local totalIncome, totalExpenses = 0, 0
	for _, v in pairs(income) do
		totalIncome += v
	end
	for _, v in pairs(expenses) do
		totalExpenses += v
	end

	local fanCap = EconomyFormulas.FanCap(totals.capacity, attractiveness, reputation)
	local fanDelta = math.floor((fanCap - fans) * GameConfig.FAN_GROWTH_RATE)
	if fanDelta == 0 and fans < fanCap then
		fanDelta = 1
	end

	return {
		attendance = attendance,
		capacity = totals.capacity,
		attractiveness = attractiveness,
		reputation = reputation,
		ticket = ticket,
		income = income,
		expenses = expenses,
		totalIncome = totalIncome,
		totalExpenses = totalExpenses,
		net = totalIncome - totalExpenses,
		fanCap = fanCap,
		fanDelta = fanDelta,
	}
end

function EconomyFormulas.ClubValue(data)
	local totals = EconomyFormulas.FacilityTotals(data.stadium.facilities)
	local reputation = totals.reputation + (data.club.reputationEarned or 0)
	local value = data.economy.money - data.economy.debt
		+ totals.invested * GameConfig.VALUE_INVESTMENT_SHARE
		+ data.club.fans * GameConfig.VALUE_PER_FAN
		+ reputation * GameConfig.VALUE_PER_REPUTATION
	return math.max(0, math.floor(value))
end

-- Comprueba si una instalación puede subir al siguiente nivel.
-- Devuelve ok, motivo, datosDelNivel
function EconomyFormulas.CanUpgrade(data, facilityId)
	local def = FacilityConfig.Get(facilityId)
	if not def then
		return false, "Instalación desconocida."
	end
	local current = data.stadium.facilities[facilityId] or 0
	local nextLevel = current + 1
	local levelData = def.levels[nextLevel]
	if not levelData then
		return false, "Ya está al nivel máximo."
	end
	if (data.stadium.stage or 1) < levelData.minStage then
		return false, string.format("Requiere estadio de etapa %d (estadio evolutivo, FASE 2).", levelData.minStage), levelData
	end
	for reqId, reqLevel in pairs(levelData.requires or {}) do
		if (data.stadium.facilities[reqId] or 0) < reqLevel then
			local reqDef = FacilityConfig.Get(reqId)
			return false, string.format("Requiere %s nivel %d.", reqDef and reqDef.name or reqId, reqLevel), levelData
		end
	end
	if data.economy.debt > GameConfig.DEBT_BUILD_LIMIT then
		return false, "Tu deuda es demasiado alta para construir. Págala primero.", levelData
	end
	if data.economy.money < levelData.cost then
		return false, "Dinero insuficiente.", levelData
	end
	return true, nil, levelData
end

return EconomyFormulas
