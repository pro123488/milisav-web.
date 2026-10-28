-- SponsorService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/SponsorService
--
-- Contratos de patrocinio (FASE 3):
--   * Ofertas generadas en el SERVIDOR según reputación y aficionados, guardadas en los
--     datos (no se pueden "volver a tirar" saliendo y entrando).
--   * Aceptar: cobra la prima de fichaje y empieza a pagar en cada jornada (EconomyFormulas).
--   * Objetivo del contrato evaluado con datos reales en cada jornada (+25 % si se cumple).
--   * Rescindir: penalización. Al terminar la duración, el contrato expira.
-- Todas las marcas son ficticias (SponsorConfig).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local SponsorConfig = require(Shared.Config.SponsorConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)

local SponsorService = {}

local rng = Random.new()

local function brandName()
	local prefix = SponsorConfig.BrandPrefixes[rng:NextInteger(1, #SponsorConfig.BrandPrefixes)]
	local suffix = SponsorConfig.BrandSuffixes[rng:NextInteger(1, #SponsorConfig.BrandSuffixes)]
	return prefix .. " " .. suffix
end

local function makeObjective(data)
	local def = SponsorConfig.Objectives[rng:NextInteger(1, #SponsorConfig.Objectives)]
	if def.id == "occupancy" then
		return { type = "occupancy", target = rng:NextInteger(60, 95) / 100 }
	elseif def.id == "satisfaction" then
		return { type = "satisfaction", target = rng:NextInteger(50, 80) }
	end
	local members = math.max(20, data.club.members or 0)
	return { type = "members", target = math.floor(members * (1 + rng:NextInteger(5, 30) / 100)) }
end

function SponsorService.OfferValue(data, slot)
	local reputation = EconomyFormulas.Reputation(data)
	local base = SponsorConfig.BASE_VALUE + reputation * SponsorConfig.PER_REPUTATION
		+ math.sqrt(math.max(0, data.club.fans)) * SponsorConfig.PER_SQRT_FAN
	return base * slot.value
end

local function generateOffers(data, slot)
	local offers = {}
	local value = SponsorService.OfferValue(data, slot)
	for i = 1, SponsorConfig.OFFERS_PER_SLOT do
		local payment = math.floor(value * (SponsorConfig.RANDOM_MIN + rng:NextNumber() * (SponsorConfig.RANDOM_MAX - SponsorConfig.RANDOM_MIN)))
		local duration = rng:NextInteger(SponsorConfig.DURATION_MIN, SponsorConfig.DURATION_MAX)
		table.insert(offers, {
			id = string.format("%s-%d-%d", slot.id, data.stats.cycles, i),
			brand = brandName(),
			payment = payment,
			bonus = payment * rng:NextInteger(SponsorConfig.SIGNING_BONUS_MIN, SponsorConfig.SIGNING_BONUS_MAX),
			duration = duration,
			objective = makeObjective(data),
		})
	end
	return offers
end

function SponsorService.SlotUnlocked(data, slot)
	return (data.stadium.stage or 1) >= slot.minStage
end

-- Renueva las ofertas de los huecos libres cuando toca (o si no hay ninguna).
function SponsorService.RefreshOffers(data, force)
	local sponsors = data.sponsors
	local due = force or data.stats.cycles >= sponsors.nextRefresh
	for _, slot in ipairs(SponsorConfig.Slots) do
		local empty = sponsors.offers[slot.id] == nil or #sponsors.offers[slot.id] == 0
		if SponsorService.SlotUnlocked(data, slot) and not sponsors.contracts[slot.id] and (due or empty) then
			sponsors.offers[slot.id] = generateOffers(data, slot)
		end
	end
	if due then
		sponsors.nextRefresh = data.stats.cycles + SponsorConfig.OFFER_REFRESH_CYCLES
	end
end

function SponsorService.Accept(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" or type(payload.slot) ~= "string" or type(payload.offer) ~= "string" then
		return false, "Solicitud no válida."
	end
	local slot = SponsorConfig.Slot(payload.slot)
	if not slot then
		return false, "Ese hueco de patrocinio no existe."
	end
	if not SponsorService.SlotUnlocked(data, slot) then
		return false, string.format("Este hueco se desbloquea en la etapa %d del estadio.", slot.minStage)
	end
	if data.sponsors.contracts[slot.id] then
		return false, "Ya tienes un contrato en este hueco."
	end
	local chosen
	for _, offer in ipairs(data.sponsors.offers[slot.id] or {}) do
		if offer.id == payload.offer then
			chosen = offer
		end
	end
	if not chosen then
		return false, "Esa oferta ya no está disponible."
	end
	data.sponsors.contracts[slot.id] = {
		brand = chosen.brand,
		payment = chosen.payment,
		objective = chosen.objective,
		cyclesLeft = chosen.duration,
		duration = chosen.duration,
		signedAt = os.time(),
	}
	data.sponsors.offers[slot.id] = {}
	EconomyService.Earn(player, chosen.bonus, EconomyService.Category.SPONSOR, "Prima de fichaje: " .. chosen.brand)
	StadiumService.LogEvent(data, "sponsor_signed", { slot = slot.id, brand = chosen.brand, payment = chosen.payment })
	return true, string.format("🤝 Contrato firmado con %s (%s). Prima: %d %s.", chosen.brand, slot.name, chosen.bonus, GameConfig.CURRENCY)
end

function SponsorService.TerminationPenalty(contract)
	return contract.payment * SponsorConfig.TERMINATION_PENALTY
end

function SponsorService.Terminate(player, payload)
	local data = DataService.Get(player)
	local slotId = type(payload) == "table" and payload.slot
	local contract = type(slotId) == "string" and data.sponsors.contracts[slotId]
	if not contract then
		return false, "No hay contrato en ese hueco."
	end
	local penalty = SponsorService.TerminationPenalty(contract)
	local paid, err = EconomyService.Spend(player, penalty, EconomyService.Category.SPONSOR, "Rescisión: " .. contract.brand)
	if not paid then
		return false, "No puedes pagar la penalización (" .. penalty .. " " .. GameConfig.CURRENCY .. "): " .. tostring(err)
	end
	data.sponsors.contracts[slotId] = nil
	StadiumService.LogEvent(data, "sponsor_terminated", { slot = slotId, brand = contract.brand })
	SponsorService.RefreshOffers(data, false)
	return true, "Contrato con " .. contract.brand .. " rescindido."
end

-- Se llama después de cada jornada: descuenta duración y expira contratos.
-- Devuelve una lista de mensajes para el jugador.
function SponsorService.AfterCycle(player)
	local data = DataService.Get(player)
	if not data then
		return {}
	end
	local messages = {}
	for slotId, contract in pairs(data.sponsors.contracts) do
		contract.cyclesLeft -= 1
		if contract.cyclesLeft <= 0 then
			data.sponsors.contracts[slotId] = nil
			StadiumService.LogEvent(data, "sponsor_expired", { slot = slotId, brand = contract.brand })
			table.insert(messages, "El contrato con " .. contract.brand .. " ha terminado. Tienes nuevas ofertas en Economía › Patrocinios.")
		end
	end
	SponsorService.RefreshOffers(data, false)
	return messages
end

function SponsorService.PlayerReady(player)
	local data = DataService.Get(player)
	if data then
		SponsorService.RefreshOffers(data, false)
	end
end

return SponsorService
