-- DefaultData (ModuleScript)
-- Ubicación: ServerScriptService/Server/Util/DefaultData
--
-- Plantilla de datos de un club y validación/reparación de datos cargados.
-- Los campos de fases futuras (plantilla, temporada, trofeos...) ya existen
-- para que la Versión B amplíe estos datos sin migraciones destructivas.
--
-- NOTA: aquí NO se guarda la propiedad de Game Passes. `premium.purchaseLog`
-- es solo un registro informativo y nunca se usa para conceder ventajas.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local StadiumStages = require(Shared.Config.StadiumStages)
local CommercialConfig = require(Shared.Config.CommercialConfig)
local SponsorConfig = require(Shared.Config.SponsorConfig)

local DefaultData = {}

function DefaultData.Create(player)
	local facilities = {}
	for id, def in pairs(FacilityConfig.Facilities) do
		if def.startLevel > 0 then
			facilities[id] = def.startLevel
		end
	end
	local displayName = player and player.DisplayName or "Jugador"
	return {
		version = GameConfig.DATA_VERSION,
		createdAt = os.time(),
		club = {
			name = "",
			shortName = "",
			named = false,
			founded = os.time(),
			fans = GameConfig.STARTING_FANS,
			members = 0, -- socios (FASE 3)
			satisfaction = GameConfig.SATISFACTION_START, -- 0-100 (FASE 3)
			reputationEarned = 0,
			ownerName = displayName,
			appearance = table.clone(CosmeticConfig.Defaults),
		},
		stadium = {
			stage = 1,
			facilities = facilities,
			decorations = {}, -- lista de { id = "flags", x = 40, z = 88, r = 0 } (coordenadas locales)
		},
		economy = {
			money = GameConfig.STARTING_MONEY,
			debt = 0,
			ticketPrice = GameConfig.DEFAULT_TICKET,
			memberPrice = "NORMAL",
			shopPrice = CommercialConfig.DEFAULT_POLICY,
			foodPrice = CommercialConfig.DEFAULT_POLICY,
			totalEarned = 0,
			totalSpent = 0,
			lastCycle = nil,
			transactions = {},
		},
		stats = {
			cycles = 0,
			playSeconds = 0,
			buildings = 0,
		},
		settings = {
			notifications = true,
			compactMenu = false,
			uiScale = 1,
		},
		premium = {
			purchaseLog = {}, -- solo informativo
		},
		sponsors = {
			contracts = {}, -- [huecoId] = { brand, payment, objective, cyclesLeft, duration, signedAt }
			offers = {}, -- [huecoId] = { { id, brand, payment, bonus, duration, objective } }
			nextRefresh = 0, -- nº de jornada en la que se renuevan las ofertas
		},
		-- ===== Reservado para fases posteriores =====
		squad = {},
		academy = {},
		season = { number = 1 },
		trophies = {},
		records = {},
		missions = {},
		history = {}, -- eventos reales del club: { t, kind, ... } (base de la HISTORIA DEL CLUB)
	}
end

-- Posiciones a las que se migran las decoraciones de la v1 (espacios fijos 1-8).
local V1_SLOT_POSITIONS = {
	{ -36, 86 }, { 36, 86 }, { -60, 86 }, { 60, 86 },
	{ -84, 86 }, { 84, 86 }, { -48, 97 }, { 48, 97 },
}

local function finiteNumber(n)
	return type(n) == "number" and n == n and n ~= math.huge and n ~= -math.huge
end

local function validObjective(objective)
	if type(objective) ~= "table" or not finiteNumber(objective.target) then
		return false
	end
	for _, def in ipairs(SponsorConfig.Objectives) do
		if def.id == objective.type then
			return true
		end
	end
	return false
end

local function validOffer(offer)
	return type(offer) == "table" and type(offer.id) == "string" and type(offer.brand) == "string"
		and #offer.brand <= 40 and finiteNumber(offer.payment) and offer.payment >= 0
		and finiteNumber(offer.bonus) and offer.bonus >= 0
		and finiteNumber(offer.duration) and offer.duration >= 1 and validObjective(offer.objective)
end

local function cleanSponsors(raw)
	local clean = { contracts = {}, offers = {}, nextRefresh = 0 }
	if type(raw) ~= "table" then
		return clean
	end
	clean.nextRefresh = math.max(0, math.floor(tonumber(raw.nextRefresh) or 0))
	for _, slot in ipairs(SponsorConfig.Slots) do
		local contract = type(raw.contracts) == "table" and raw.contracts[slot.id]
		if type(contract) == "table" and type(contract.brand) == "string" and #contract.brand <= 40
			and finiteNumber(contract.payment) and contract.payment >= 0
			and finiteNumber(contract.cyclesLeft) and contract.cyclesLeft >= 1
			and validObjective(contract.objective) then
			clean.contracts[slot.id] = {
				brand = contract.brand,
				payment = math.floor(contract.payment),
				objective = { type = contract.objective.type, target = contract.objective.target },
				cyclesLeft = math.floor(contract.cyclesLeft),
				duration = math.floor(tonumber(contract.duration) or contract.cyclesLeft),
				signedAt = tonumber(contract.signedAt) or os.time(),
			}
		end
		local offers = type(raw.offers) == "table" and raw.offers[slot.id]
		if type(offers) == "table" then
			local list = {}
			for _, offer in ipairs(offers) do
				if validOffer(offer) and #list < SponsorConfig.OFFERS_PER_SLOT then
					table.insert(list, offer)
				end
			end
			clean.offers[slot.id] = list
		end
	end
	return clean
end

local function cleanDecorations(raw)
	local list = {}
	if type(raw) ~= "table" then
		return list
	end
	-- v1: { ["1"] = "flags", ... }  ->  v2: { { id, x, z, r }, ... }
	local v1 = {}
	for key, value in pairs(raw) do
		if type(value) == "string" and tonumber(key) then
			table.insert(v1, { slot = tonumber(key), id = value })
		end
	end
	if #v1 > 0 then
		table.sort(v1, function(a, b)
			return a.slot < b.slot
		end)
		for _, entry in ipairs(v1) do
			local pos = V1_SLOT_POSITIONS[entry.slot]
			if pos and CosmeticConfig.ById.decoration[entry.id] then
				table.insert(list, { id = entry.id, x = pos[1], z = pos[2], r = 0 })
			end
		end
		return list
	end
	for _, entry in ipairs(raw) do
		if type(entry) == "table" and CosmeticConfig.ById.decoration[entry.id]
			and finiteNumber(entry.x) and finiteNumber(entry.z) and finiteNumber(entry.r)
			and math.abs(entry.x) <= 150 and math.abs(entry.z) <= 105 then
			table.insert(list, { id = entry.id, x = entry.x, z = entry.z, r = entry.r % 360 })
		end
		if #list >= GameConfig.MAX_DECORATIONS then
			break
		end
	end
	return list
end

local function fillMissing(target, template)
	for key, value in pairs(template) do
		if target[key] == nil then
			target[key] = (type(value) == "table") and table.clone(value) or value
		elseif type(value) == "table" and type(target[key]) == "table" and next(value) ~= nil then
			-- solo se rellenan subtablas de tipo diccionario de la plantilla
			if #value == 0 then
				fillMissing(target[key], value)
			end
		end
	end
end

local function clampNumber(value, min, max, default)
	value = tonumber(value)
	if value == nil or value ~= value then -- NaN
		return default
	end
	return math.clamp(value, min, max)
end

local function validItem(catalog, id, appliesTo)
	local item = CosmeticConfig.ById[catalog][id]
	if not item then
		return false
	end
	if appliesTo and item.appliesTo ~= appliesTo then
		return false
	end
	return true
end

-- Repara y valida datos cargados (nunca confía en que estén bien formados).
function DefaultData.Reconcile(data, player)
	if type(data) ~= "table" then
		return DefaultData.Create(player)
	end
	local template = DefaultData.Create(player)
	fillMissing(data, template)

	-- Club
	local club = data.club
	club.fans = math.floor(clampNumber(club.fans, 0, 1e9, GameConfig.STARTING_FANS))
	club.reputationEarned = math.floor(clampNumber(club.reputationEarned, 0, 1e6, 0))
	club.members = math.floor(clampNumber(club.members, 0, club.fans, 0))
	club.satisfaction = clampNumber(club.satisfaction, 0, 100, GameConfig.SATISFACTION_START)
	if type(club.name) ~= "string" then
		club.name = ""
	end
	if type(club.shortName) ~= "string" then
		club.shortName = ""
	end
	if player then
		club.ownerName = player.DisplayName
	end
	for slot, rule in pairs(CosmeticConfig.AppearanceSlots) do
		if not validItem(rule.catalog, club.appearance[slot], rule.appliesTo) then
			club.appearance[slot] = CosmeticConfig.Defaults[slot]
		end
	end

	-- Estadio
	local stadium = data.stadium
	stadium.stage = math.floor(clampNumber(stadium.stage, 1, #StadiumStages, 1))
	local cleanFacilities = {}
	for id, def in pairs(FacilityConfig.Facilities) do
		local level = math.floor(clampNumber(stadium.facilities[id], 0, #def.levels, def.startLevel))
		level = math.max(level, def.startLevel)
		if level > 0 then
			cleanFacilities[id] = level
		end
	end
	stadium.facilities = cleanFacilities
	stadium.decorations = cleanDecorations(stadium.decorations)

	-- Historial de eventos
	if type(data.history) ~= "table" then
		data.history = {}
	end
	while #data.history > GameConfig.MAX_HISTORY_EVENTS do
		table.remove(data.history, 1)
	end

	-- Economía
	local economy = data.economy
	economy.money = math.floor(clampNumber(economy.money, 0, 1e12, GameConfig.STARTING_MONEY))
	economy.debt = math.floor(clampNumber(economy.debt, 0, 1e12, 0))
	local validTicket = false
	for _, option in ipairs(GameConfig.TICKET_PRICES) do
		if option.id == economy.ticketPrice then
			validTicket = true
		end
	end
	if not validTicket then
		economy.ticketPrice = GameConfig.DEFAULT_TICKET
	end
	local function validId(list, id)
		for _, option in ipairs(list) do
			if option.id == id then
				return true
			end
		end
		return false
	end
	if not validId(GameConfig.MEMBER_PRICES, economy.memberPrice) then
		economy.memberPrice = "NORMAL"
	end
	if not validId(CommercialConfig.PricePolicies, economy.shopPrice) then
		economy.shopPrice = CommercialConfig.DEFAULT_POLICY
	end
	if not validId(CommercialConfig.PricePolicies, economy.foodPrice) then
		economy.foodPrice = CommercialConfig.DEFAULT_POLICY
	end

	-- Patrocinadores
	data.sponsors = cleanSponsors(data.sponsors)
	if type(economy.transactions) ~= "table" then
		economy.transactions = {}
	end
	while #economy.transactions > GameConfig.MAX_TRANSACTIONS do
		table.remove(economy.transactions, 1)
	end

	-- Ajustes
	data.settings.uiScale = clampNumber(data.settings.uiScale, 0.8, 1.3, 1)
	data.settings.notifications = data.settings.notifications ~= false
	data.settings.compactMenu = data.settings.compactMenu == true

	data.version = GameConfig.DATA_VERSION
	return data
end

return DefaultData
