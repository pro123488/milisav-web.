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
local CommercialConfig = require(Config.CommercialConfig)
local SponsorConfig = require(Config.SponsorConfig)
local FootballConfig = require(Config.FootballConfig)
local UniverseConfig = require(Config.UniverseConfig)

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
		tourRate = 0,
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
			totals.tourRate += data.tourRate or 0
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

-- Salarios de la plantilla por jornada (la plantilla llega en la FASE 4).
function EconomyFormulas.Wages(data)
	local total = 0
	for _, playerData in ipairs(data.squad or {}) do
		-- Los jugadores cedidos a otro club cobran de ese club
		if not (playerData.loan and playerData.loan.type == "out") then
			total += tonumber(playerData.salary) or 0
		end
	end
	return math.floor(total)
end

-- Cuotas de cesión por jornada: { ingresos (cedidos), gastos (recibidos) } (FASE 6)
function EconomyFormulas.LoanFees(data)
	local income, expense = 0, 0
	for _, playerData in ipairs(data.squad or {}) do
		local loan = playerData.loan
		if loan then
			if loan.type == "out" then
				income += tonumber(loan.fee) or 0
			elseif loan.type == "in" then
				expense += tonumber(loan.fee) or 0
			end
		end
	end
	return math.floor(income), math.floor(expense)
end

function EconomyFormulas.FanCap(capacity, attractiveness, reputation)
	return math.floor(capacity * GameConfig.FAN_CAP_PER_SEAT * attractiveness
		+ reputation * GameConfig.FAN_CAP_PER_REPUTATION)
end

local function memberOption(id)
	for _, option in ipairs(GameConfig.MEMBER_PRICES) do
		if option.id == id then
			return option
		end
	end
	return GameConfig.MEMBER_PRICES[2]
end
EconomyFormulas.MemberOption = memberOption

-- Ingresos por contratos de patrocinio activos (pago + bonus si se cumple el objetivo).
function EconomyFormulas.ContractIncome(sponsors, occupancy, satisfaction, members)
	local total, details = 0, {}
	for slotId, contract in pairs((sponsors and sponsors.contracts) or {}) do
		local met = SponsorConfig.ObjectiveMet(contract.objective, occupancy, satisfaction, members)
		local amount = contract.payment + (met and math.floor(contract.payment * SponsorConfig.OBJECTIVE_BONUS) or 0)
		total += amount
		details[slotId] = { amount = amount, objectiveMet = met }
	end
	return total, details
end

-- Satisfacción objetivo de la afición y sus factores (para mostrarlos en la interfaz).
function EconomyFormulas.SatisfactionTarget(data, attractiveness, overcrowded)
	local economy = data.economy
	local ticket = ticketOption(economy.ticketPrice)
	local member = memberOption(economy.memberPrice)
	local shopPolicy = CommercialConfig.Policy(economy.shopPrice)
	local foodPolicy = CommercialConfig.Policy(economy.foodPrice)
	local factors = {
		{ label = "Base", value = GameConfig.SATISFACTION_BASE },
		{ label = "Precio de entradas", value = ticket.satisfaction or 0 },
		{ label = "Precio de abonos", value = member.satisfaction or 0 },
		{ label = "Precios de la tienda", value = shopPolicy.satisfaction },
		{ label = "Precios de restauración", value = foodPolicy.satisfaction },
		{ label = "Atractivo del estadio", value = math.floor(math.clamp((attractiveness - 1) * GameConfig.SATISFACTION_ATTRACTIVENESS, 0, GameConfig.SATISFACTION_ATTRACTIVENESS_MAX)) },
		{ label = "Etapa del estadio", value = (data.stadium.stage or 1) * GameConfig.SATISFACTION_PER_STAGE },
	}
	if overcrowded then
		table.insert(factors, { label = "Aficionados sin entrada", value = -GameConfig.OVERCROWD_PENALTY })
	end
	local target = 0
	for _, f in ipairs(factors) do
		target += f.value
	end
	return math.clamp(target, 0, 100), factors
end

-- Calcula un ciclo económico completo a partir de los datos del club.
-- Devuelve un desglose; el servidor es quien lo aplica.
function EconomyFormulas.Cycle(data)
	local facilities = data.stadium.facilities
	local economy = data.economy
	local club = data.club
	local totals = EconomyFormulas.FacilityTotals(facilities)
	local stageEffects = EconomyFormulas.StageEffects(data.stadium.stage)
	local attractiveness = totals.attractiveness + stageEffects.attractiveness
		+ EconomyFormulas.DecorationBonus(data.stadium.decorations, data.stadium.stage)
	local reputation = totals.reputation + stageEffects.reputation + (club.reputationEarned or 0)
	local ticket = ticketOption(economy.ticketPrice)
	local member = memberOption(economy.memberPrice)
	local shopPolicy = CommercialConfig.Policy(economy.shopPrice)
	local foodPolicy = CommercialConfig.Policy(economy.foodPrice)
	local satisfaction = club.satisfaction or GameConfig.SATISFACTION_START

	-- Asistencia: los socios ocupan primero su asiento; el resto compra entrada.
	local fans = club.fans
	local members = math.min(club.members or 0, fans)
	local capacity = totals.capacity
	local membersAttending = math.min(members, capacity)
	local casualDemand = (fans - members) * GameConfig.TURNOUT_RATE * ticket.demand * attractiveness
	local casual = math.floor(math.max(0, math.min(capacity - membersAttending, casualDemand)))
	local attendance = membersAttending + casual
	local occupancy = capacity > 0 and attendance / capacity or 0
	local overcrowded = membersAttending + casualDemand > capacity * GameConfig.OVERCROWD_THRESHOLD

	-- La satisfacción multiplica el gasto en tienda y restauración (0,75 a 1,25).
	local spendMultiplier = 0.75 + satisfaction / 200
	local contractTotal, contractDetails = EconomyFormulas.ContractIncome(data.sponsors, occupancy, satisfaction, members)
	local loanIncome, loanExpense = EconomyFormulas.LoanFees(data)

	local income = {
		tickets = casual * ticket.price,
		members = math.floor(members * member.fee),
		shop = math.floor(attendance * totals.shopSpend * shopPolicy.spend * spendMultiplier),
		restaurant = math.floor(attendance * totals.foodSpend * foodPolicy.spend * spendMultiplier),
		sponsors = GameConfig.SPONSOR_BASE + reputation * GameConfig.SPONSOR_PER_REPUTATION + stageEffects.sponsorBonus,
		contracts = math.floor(contractTotal * UniverseConfig.Multiplier("contracts")), -- evento del universo
		vip = totals.vipIncome,
		tour = math.floor(reputation * totals.tourRate * UniverseConfig.Multiplier("tour")),
		loans = loanIncome, -- cesiones a otros clubes (FASE 6)
	}
	local expenses = {
		maintenance = totals.upkeep,
		staff = GameConfig.STAFF_BASE + totals.staff,
		stadium = stageEffects.upkeep, -- operación del estadio según su etapa
		wages = EconomyFormulas.Wages(data), -- salarios de la plantilla (FASE 4)
		scouts = FootballConfig.SCOUT_COSTS[(data.academy and data.academy.scouts) or 0] or 0, -- ojeadores (FASE 4)
		loans = loanExpense, -- jugadores recibidos en cesión (FASE 6)
		interest = math.floor((economy.debt or 0) * GameConfig.DEBT_INTEREST_PER_CYCLE),
	}

	local totalIncome, totalExpenses = 0, 0
	for _, v in pairs(income) do
		totalIncome += v
	end
	for _, v in pairs(expenses) do
		totalExpenses += v
	end

	-- Afición: satisfacción, socios y crecimiento
	local satisfactionTarget, satisfactionFactors = EconomyFormulas.SatisfactionTarget(data, attractiveness, overcrowded)
	local satisfactionDelta = (satisfactionTarget - satisfaction) * GameConfig.SATISFACTION_SPEED

	local fanCap = EconomyFormulas.FanCap(capacity, attractiveness, reputation)
	local fanDelta
	if satisfaction < GameConfig.FAN_DECLINE_SATISFACTION then
		fanDelta = -math.ceil(fans * GameConfig.FAN_DECLINE_RATE)
	else
		local growth = (0.5 + satisfaction / 100) * UniverseConfig.Multiplier("fanGrowth")
		fanDelta = math.floor((fanCap - fans) * GameConfig.FAN_GROWTH_RATE * growth)
		if fanDelta == 0 and fans < fanCap then
			fanDelta = 1
		end
	end

	local memberRate = GameConfig.MEMBER_RATE_MIN + (GameConfig.MEMBER_RATE_MAX - GameConfig.MEMBER_RATE_MIN) * satisfaction / 100
	local memberTarget = math.floor(math.min(fans * memberRate * member.demand, capacity * GameConfig.MEMBER_SEAT_SHARE))
	local memberDelta = math.floor((memberTarget - members) * GameConfig.MEMBER_SPEED + 0.5)
	if memberDelta == 0 and memberTarget ~= members then
		memberDelta = memberTarget > members and 1 or -1
	end

	return {
		attendance = attendance,
		membersAttending = membersAttending,
		casual = casual,
		capacity = capacity,
		occupancy = occupancy,
		overcrowded = overcrowded,
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
		satisfaction = satisfaction,
		satisfactionTarget = satisfactionTarget,
		satisfactionDelta = satisfactionDelta,
		satisfactionFactors = satisfactionFactors,
		spendMultiplier = spendMultiplier,
		members = members,
		memberTarget = memberTarget,
		memberDelta = memberDelta,
		contracts = contractDetails,
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
