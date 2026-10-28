-- TransferService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/TransferService
--
-- MERCADO DE FICHAJES (FASE 6). Todo se valida en el servidor:
--   * Comprar: el anuncio debe existir, la oferta respeta el presupuesto de fichajes,
--     hay plaza en la plantilla y la negociación se resuelve con el Random del servidor.
--   * Vender: solo jugadores propios, solo ofertas existentes y sin bajar del mínimo.
--   * Cesiones: recibidas (pagas cuota + salario) y cedidas (cobras cuota; su club paga
--     el salario). Terminan al acabar la temporada.
--   * Fichajes y ventas destacados quedan en el historial y en los récords del club.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local FootballConfig = require(Shared.Config.FootballConfig)
local TransferConfig = require(Shared.Config.TransferConfig)
local FootballFormulas = require(Shared.Modules.FootballFormulas)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)
local MatchService = require(script.Parent.MatchService)
local PlayerFactory = require(script.Parent.Parent.Util.PlayerFactory)

local TransferService = {}

local rng = Random.new()

local function isAway(p)
	return p.loan ~= nil and p.loan.type == "out"
end

-- Jugadores que ocupan plaza en la plantilla (los cedidos a otros clubes no cuentan).
function TransferService.ActiveCount(data)
	local n = 0
	for _, p in ipairs(data.squad) do
		if not isAway(p) then
			n += 1
		end
	end
	return n
end

function TransferService.Budget(data)
	return math.floor(data.economy.money * (data.economy.transferShare or TransferConfig.DEFAULT_BUDGET_SHARE))
end

local function findSquad(data, id)
	if type(id) ~= "string" then
		return nil
	end
	for index, p in ipairs(data.squad) do
		if p.id == id then
			return p, index
		end
	end
	return nil
end

-- ===== Generación del mercado =====

local function generateMarket(data)
	local strength = MatchService.TeamStrength(data)
	local listings = {}
	for i = 1, TransferConfig.MARKET_SIZE do
		local kind = "buy"
		if i <= TransferConfig.FREE_AGENTS then
			kind = "free"
		elseif i <= TransferConfig.FREE_AGENTS + TransferConfig.LOAN_LISTINGS then
			kind = "loan"
		end
		local positions = FootballConfig.Positions
		local age = rng:NextInteger(18, 32)
		local overall = math.clamp(strength + rng:NextInteger(TransferConfig.STRENGTH_MIN, TransferConfig.STRENGTH_MAX), 35, 92)
		if kind == "free" then
			age = rng:NextInteger(27, 34) -- los libres suelen ser veteranos
			overall = math.clamp(overall - 3, 35, 90)
		end
		local p = PlayerFactory.Create(data, {
			pos = positions[rng:NextInteger(1, #positions)].id,
			overall = overall,
			age = age,
			origin = "transfer",
			contract = TransferConfig.DEFAULT_CONTRACT,
		})
		local value = FootballFormulas.MarketValue(p)
		local club = kind == "free" and "Sin club" or (MatchService.RandomClubName())
		table.insert(listings, {
			id = string.format("m%d-%d", data.stats.cycles, i),
			kind = kind,
			club = club,
			asking = kind == "buy" and math.floor(value * (TransferConfig.ASK_MIN + rng:NextNumber() * (TransferConfig.ASK_MAX - TransferConfig.ASK_MIN)) / 100 + 0.5) * 100 or 0,
			loanFee = kind == "loan" and math.max(10, math.floor(value * TransferConfig.LOAN_IN_FEE)) or 0,
			bonus = kind == "free" and math.floor(value * TransferConfig.FREE_AGENT_BONUS) or 0,
			player = p,
		})
	end
	data.market.listings = listings
	data.market.rejected = {}
	data.market.nextRefresh = data.stats.cycles + TransferConfig.REFRESH_CYCLES
end

function TransferService.RefreshMarket(data, force)
	if force or #data.market.listings == 0 or data.stats.cycles >= (data.market.nextRefresh or 0) then
		generateMarket(data)
	end
end

local function findListing(data, id)
	if type(id) ~= "string" then
		return nil
	end
	for index, l in ipairs(data.market.listings) do
		if l.id == id then
			return l, index
		end
	end
	return nil
end

local function recordSigning(data, p, fee, club, kind)
	StadiumService.LogEvent(data, kind == "loan" and "loan_in" or "transfer_in",
		{ name = p.name, fee = fee, club = club, ovr = FootballFormulas.OverallInt(p) })
	if kind ~= "loan" and (data.records.biggestSigning == nil or fee > data.records.biggestSigning.fee) then
		data.records.biggestSigning = { name = p.name, fee = fee, club = club, season = data.season.number }
	end
end

-- ===== Comprar / fichar libre / cesión recibida =====

function TransferService.Buy(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local listing, index = findListing(data, payload.listing)
	if not listing then
		return false, "Ese jugador ya no está en el mercado."
	end
	if TransferService.ActiveCount(data) >= FootballConfig.MAX_SQUAD then
		return false, string.format("Tu plantilla está llena (%d).", FootballConfig.MAX_SQUAD)
	end
	if data.economy.debt > GameConfig.DEBT_BUILD_LIMIT then
		return false, "Tu deuda es demasiado alta para fichar."
	end
	local years = tonumber(payload.years) or TransferConfig.DEFAULT_CONTRACT
	if years ~= math.floor(years) or years < 1 or years > FootballConfig.CONTRACT_MAX_SEASONS then
		return false, "Duración de contrato no válida."
	end
	local p = listing.player
	local message

	if listing.kind == "buy" then
		if data.market.rejected[listing.id] then
			return false, listing.club .. " ya rechazó tu oferta. Espera a la próxima renovación del mercado."
		end
		local level
		for _, l in ipairs(TransferConfig.OfferLevels) do
			if l.id == payload.offer then
				level = l
			end
		end
		if not level then
			return false, "Oferta no válida."
		end
		local fee = math.floor(listing.asking * level.share)
		if fee > TransferService.Budget(data) then
			return false, string.format("La oferta (%d %s) supera tu presupuesto de fichajes.", fee, GameConfig.CURRENCY)
		end
		if rng:NextNumber() >= level.chance then
			data.market.rejected[listing.id] = true
			return false, string.format("❌ %s rechaza tu oferta de %d %s por %s.", listing.club, fee, GameConfig.CURRENCY, p.name)
		end
		local paid, err = EconomyService.Spend(player, fee, EconomyService.Category.TRANSFER, "Fichaje: " .. p.name)
		if not paid then
			return false, err
		end
		recordSigning(data, p, fee, listing.club, "buy")
		message = string.format("✍️ ¡%s ficha por tu club! Traspaso: %d %s.", p.name, fee, GameConfig.CURRENCY)
	elseif listing.kind == "free" then
		if listing.bonus > data.economy.money then
			return false, "No puedes pagar la prima de fichaje."
		end
		EconomyService.Spend(player, listing.bonus, EconomyService.Category.TRANSFER, "Prima de fichaje: " .. p.name)
		recordSigning(data, p, 0, "libre", "free")
		message = string.format("✍️ %s llega libre (prima %d %s).", p.name, listing.bonus, GameConfig.CURRENCY)
	else
		-- Cesión recibida: hasta final de temporada
		p.loan = { type = "in", club = listing.club, fee = listing.loanFee, endSeason = data.season.number }
		years = 2 -- el contrato no vence antes de que termine la cesión
		recordSigning(data, p, 0, listing.club, "loan")
		message = string.format("🔁 %s llega cedido por %s hasta final de temporada (%d %s/jornada + salario).",
			p.name, listing.club, listing.loanFee, GameConfig.CURRENCY)
	end

	p.salary = math.max(2, math.floor(FootballFormulas.SalaryDemand(p) * TransferConfig.SALARY_PREMIUM))
	p.contract = years
	p.joinedSeason = data.season.number
	p.listed = nil
	table.remove(data.market.listings, index)
	table.insert(data.squad, p)
	return true, message
end

-- ===== Vender / ceder =====

function TransferService.SetListing(player, payload)
	local data = DataService.Get(player)
	local p = findSquad(data, type(payload) == "table" and payload.id)
	if not p then
		return false, "Ese jugador no es de tu plantilla."
	end
	if p.loan then
		return false, "No puedes poner en el mercado a un jugador cedido."
	end
	local mode = payload.mode
	if mode == "none" then
		p.listed = nil
		return true, p.name .. " ya no está en el mercado."
	elseif mode == "sale" then
		p.listed = "sale"
		return true, p.name .. " está en venta. Los clubes interesados enviarán ofertas."
	elseif mode == "loan" then
		if p.age > 25 then
			return false, "Solo se ceden jugadores de 25 años o menos."
		end
		p.listed = "loan"
		return true, p.name .. " está disponible para cesión."
	end
	return false, "Opción no válida."
end

function TransferService.AcceptOffer(player, payload)
	local data = DataService.Get(player)
	local offerId = type(payload) == "table" and payload.offer
	local offer, offerIndex
	for i, o in ipairs(data.transferOffers) do
		if o.id == offerId then
			offer, offerIndex = o, i
		end
	end
	if not offer then
		return false, "Esa oferta ya no existe."
	end
	local p, index = findSquad(data, offer.playerId)
	if not p or p.loan then
		table.remove(data.transferOffers, offerIndex)
		return false, "El jugador ya no está disponible."
	end
	if TransferService.ActiveCount(data) <= FootballConfig.MIN_SQUAD then
		return false, string.format("Necesitas al menos %d jugadores. Ficha o sube a un canterano antes de vender.", FootballConfig.MIN_SQUAD)
	end
	table.remove(data.squad, index)
	table.remove(data.transferOffers, offerIndex)
	-- Las demás ofertas por ese jugador caducan
	for i = #data.transferOffers, 1, -1 do
		if data.transferOffers[i].playerId == p.id then
			table.remove(data.transferOffers, i)
		end
	end
	EconomyService.Earn(player, offer.fee, EconomyService.Category.TRANSFER, "Venta: " .. p.name .. " a " .. offer.club)
	StadiumService.LogEvent(data, "transfer_out", { name = p.name, fee = offer.fee, club = offer.club, ovr = FootballFormulas.OverallInt(p) })
	if data.records.biggestSale == nil or offer.fee > data.records.biggestSale.fee then
		data.records.biggestSale = { name = p.name, fee = offer.fee, club = offer.club, season = data.season.number }
	end
	return true, string.format("💰 %s vendido a %s por %d %s.", p.name, offer.club, offer.fee, GameConfig.CURRENCY)
end

function TransferService.RejectOffer(player, payload)
	local data = DataService.Get(player)
	local offerId = type(payload) == "table" and payload.offer
	for i, o in ipairs(data.transferOffers) do
		if o.id == offerId then
			table.remove(data.transferOffers, i)
			return true, "Oferta rechazada."
		end
	end
	return false, "Esa oferta ya no existe."
end

function TransferService.SetBudgetShare(player, payload)
	local data = DataService.Get(player)
	local share = tonumber(type(payload) == "table" and payload.share)
	for _, allowed in ipairs(TransferConfig.BudgetShares) do
		if share == allowed then
			data.economy.transferShare = allowed
			return true, string.format("Presupuesto de fichajes: %d%% del dinero.", math.floor(allowed * 100))
		end
	end
	return false, "Valor no válido."
end

-- ===== Jornada =====

local function addOffer(data, p, fee, unsolicited)
	if #data.transferOffers >= TransferConfig.MAX_OFFERS then
		return nil
	end
	local club = MatchService.RandomClubName()
	local offer = {
		id = string.format("o%d-%s-%d", data.stats.cycles, p.id, rng:NextInteger(1, 9999)),
		playerId = p.id,
		playerName = p.name,
		club = club,
		fee = math.floor(fee / 100 + 0.5) * 100,
		expires = data.stats.cycles + TransferConfig.OFFER_EXPIRY,
		unsolicited = unsolicited == true,
	}
	table.insert(data.transferOffers, offer)
	return offer
end

function TransferService.AfterCycle(player)
	local data = DataService.Get(player)
	if not data then
		return {}
	end
	local messages = {}
	local cycles = data.stats.cycles

	-- Ofertas caducadas
	for i = #data.transferOffers, 1, -1 do
		if data.transferOffers[i].expires <= cycles then
			table.remove(data.transferOffers, i)
		end
	end

	-- Ofertas por jugadores en venta y cesiones aceptadas
	for _, p in ipairs(data.squad) do
		if p.listed == "sale" and rng:NextNumber() < TransferConfig.LISTED_OFFER_CHANCE then
			local value = FootballFormulas.MarketValue(p)
			local offer = addOffer(data, p, value * (TransferConfig.OFFER_MIN + rng:NextNumber() * (TransferConfig.OFFER_MAX - TransferConfig.OFFER_MIN)), false)
			if offer then
				table.insert(messages, string.format("📨 %s ofrece %d %s por %s.", offer.club, offer.fee, GameConfig.CURRENCY, p.name))
			end
		elseif p.listed == "loan" and not p.loan and rng:NextNumber() < TransferConfig.LOAN_OUT_CHANCE then
			local club = MatchService.RandomClubName()
			p.loan = { type = "out", club = club, fee = math.max(5, math.floor(FootballFormulas.MarketValue(p) * TransferConfig.LOAN_OUT_FEE)), endSeason = data.season.number }
			p.listed = nil
			StadiumService.LogEvent(data, "loan_out", { name = p.name, club = club })
			table.insert(messages, string.format("🔁 %s se va cedido a %s hasta final de temporada.", p.name, club))
		end
	end

	-- Oferta espontánea por uno de los mejores
	if rng:NextNumber() < TransferConfig.UNSOLICITED_CHANCE then
		local candidates = {}
		for _, p in ipairs(data.squad) do
			if not p.loan then
				table.insert(candidates, p)
			end
		end
		table.sort(candidates, function(a, b)
			return FootballFormulas.Overall(a) > FootballFormulas.Overall(b)
		end)
		local target = candidates[rng:NextInteger(1, math.min(3, math.max(1, #candidates)))]
		if target then
			local offer = addOffer(data, target, FootballFormulas.MarketValue(target) * TransferConfig.UNSOLICITED_PREMIUM, true)
			if offer then
				table.insert(messages, string.format("📨 ¡Oferta inesperada! %s ofrece %d %s por %s.", offer.club, offer.fee, GameConfig.CURRENCY, target.name))
			end
		end
	end

	-- Fin de las cesiones al cambiar de temporada
	for i = #data.squad, 1, -1 do
		local p = data.squad[i]
		if p.loan and data.season.number > (p.loan.endSeason or 0) then
			if p.loan.type == "in" then
				table.remove(data.squad, i)
				table.insert(messages, string.format("🔁 Termina la cesión de %s, que vuelve a %s.", p.name, p.loan.club))
			else
				table.insert(messages, string.format("🔁 %s vuelve de su cesión en %s.", p.name, p.loan.club))
				p.loan = nil
			end
		end
	end

	TransferService.RefreshMarket(data, false)
	return messages
end

function TransferService.PlayerReady(player)
	local data = DataService.Get(player)
	if data then
		TransferService.RefreshMarket(data, false)
	end
end

-- ===== Estado para el cliente =====

function TransferService.BuildState(data, publicPlayer)
	local listings = {}
	for _, l in ipairs(data.market.listings) do
		table.insert(listings, {
			id = l.id, kind = l.kind, club = l.club, asking = l.asking, loanFee = l.loanFee, bonus = l.bonus,
			rejected = data.market.rejected[l.id] == true,
			salary = math.max(2, math.floor(FootballFormulas.SalaryDemand(l.player) * TransferConfig.SALARY_PREMIUM)),
			player = publicPlayer(l.player),
		})
	end
	return {
		listings = listings,
		offers = data.transferOffers,
		nextRefresh = math.max(0, (data.market.nextRefresh or 0) - data.stats.cycles),
		budget = TransferService.Budget(data),
		budgetShare = data.economy.transferShare or TransferConfig.DEFAULT_BUDGET_SHARE,
		activeCount = TransferService.ActiveCount(data),
	}
end

return TransferService
