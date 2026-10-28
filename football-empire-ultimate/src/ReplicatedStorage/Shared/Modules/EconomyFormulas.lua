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
local StadiumStages = require(Config.StadiumStages)

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

-- Efectos funcionales de la etapa actual del estadio evolutivo.
function EconomyFormulas.StageEffects(stage)
	return StadiumStages.Get(stage).effects
end

-- Límite gratuito de decoraciones según la etapa.
function EconomyFormulas.FreeDecorationLimit(stage)
	return EconomyFormulas.StageEffects(stage).freeDecorations
end

-- Bonificación por decoraciones: solo cuentan hasta el límite GRATUITO de la etapa
-- (las decoraciones extra de Constructor Pro no dan ventaja económica).
function EconomyFormulas.DecorationBonus(decorations, stage)
	local count = math.min(#(decorations or {}), EconomyFormulas.FreeDecorationLimit(stage))
	return count * CosmeticConfig.DECORATION_ATTRACTIVENESS
end

-- Coste acumulado de todas las etapas alcanzadas (forma parte del valor del club).
function EconomyFormulas.StageInvestment(stage)
	local total = 0
	for s = 2, math.clamp(stage or 1, 1, #StadiumStages) do
		total += StadiumStages[s].upgradeCost
	end
	return total
end

function EconomyFormulas.Reputation(data)
	local totals = EconomyFormulas.FacilityTotals(data.stadium.facilities)
	return totals.reputation + EconomyFormulas.StageEffects(data.stadium.stage).reputation + (data.club.reputationEarned or 0)
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
	local stageEffects = EconomyFormulas.StageEffects(data.stadium.stage)
	local attractiveness = totals.attractiveness + stageEffects.attractiveness
		+ EconomyFormulas.DecorationBonus(data.stadium.decorations, data.stadium.stage)
	local reputation = totals.reputation + stageEffects.reputation + (data.club.reputationEarned or 0)
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
		sponsors = GameConfig.SPONSOR_BASE + reputation * GameConfig.SPONSOR_PER_REPUTATION + stageEffects.sponsorBonus,
		vip = totals.vipIncome,
	}
	local expenses = {
		maintenance = totals.upkeep,
		staff = GameConfig.STAFF_BASE + totals.staff,
		stadium = stageEffects.upkeep, -- operación del estadio según su etapa
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
	local reputation = EconomyFormulas.Reputation(data)
	local value = data.economy.money - data.economy.debt
		+ (totals.invested + EconomyFormulas.StageInvestment(data.stadium.stage)) * GameConfig.VALUE_INVESTMENT_SHARE
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
		return false, string.format("Requiere estadio de etapa %d (%s).", levelData.minStage, StadiumStages.Get(levelData.minStage).name), levelData
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

-- Comprueba el ascenso a la siguiente etapa del estadio evolutivo.
-- Devuelve ok, motivo, siguienteEtapa, listaDeRequisitos { { text, met } }
function EconomyFormulas.CanUpgradeStage(data)
	local current = data.stadium.stage or 1
	local nextStage = StadiumStages[current + 1]
	if not nextStage then
		return false, "Tu estadio ya es legendario: etapa máxima alcanzada.", nil, {}
	end
	if nextStage.stage > StadiumStages.MAX_STAGE_THIS_PHASE then
		return false, "Esta etapa llegará en una fase posterior.", nextStage, {}
	end
	local checks = {}
	local allMet = true
	local reputation = EconomyFormulas.Reputation(data)
	local repNeeded = nextStage.requirements.reputation or 0
	local repMet = reputation >= repNeeded
	table.insert(checks, { text = string.format("Reputación %d / %d", reputation, repNeeded), met = repMet })
	allMet = allMet and repMet
	local facilityIds = {}
	for id in pairs(nextStage.requirements.facilities or {}) do
		table.insert(facilityIds, id)
	end
	table.sort(facilityIds)
	for _, id in ipairs(facilityIds) do
		local needed = nextStage.requirements.facilities[id]
		local have = data.stadium.facilities[id] or 0
		local def = FacilityConfig.Get(id)
		local met = have >= needed
		table.insert(checks, { text = string.format("%s nivel %d (tienes %d)", def and def.name or id, needed, have), met = met })
		allMet = allMet and met
	end
	local moneyMet = data.economy.money >= nextStage.upgradeCost
	table.insert(checks, { text = "Coste " .. tostring(nextStage.upgradeCost) .. " " .. GameConfig.CURRENCY, met = moneyMet })
	local debtMet = data.economy.debt <= GameConfig.DEBT_BUILD_LIMIT
	if not debtMet then
		table.insert(checks, { text = "Deuda por debajo de " .. GameConfig.DEBT_BUILD_LIMIT, met = false })
	end
	if not allMet then
		return false, "No cumples todos los requisitos.", nextStage, checks
	end
	if not debtMet then
		return false, "Tu deuda es demasiado alta para construir. Págala primero.", nextStage, checks
	end
	if not moneyMet then
		return false, "Dinero insuficiente.", nextStage, checks
	end
	return true, nil, nextStage, checks
end

return EconomyFormulas
