--!nonstrict
-- SponsorService: patrocinios con marcas ficticias.
--  * Cada día de juego llegan ofertas nuevas según tu reputación y suscriptores.
--  * Revisa requisitos, duración, pago, condiciones, producto y fecha de entrega antes de aceptar.
--  * Regalo: el producto es tuyo. Préstamo: se devuelve al terminar. Campaña: sin producto.
--  * Se cumple publicando un vídeo que respete el contrato (el servidor lo comprueba).
--  * Incumplir (pasar la fecha) baja la reputación comercial y devuelve el equipo prestado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local SponsorData = require(Shared.SponsorData)
local VideoData = require(Shared.VideoData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Sponsor = {}
local S

function Sponsor.Init(services)
	S = services
end

local function state(data)
	data.Sponsors = data.Sponsors or {}
	local sp = data.Sponsors
	sp.Offers = sp.Offers or {}
	sp.Active = sp.Active or {}
	sp.History = sp.History or {}
	sp.Seq = sp.Seq or 0
	sp.OffersDay = sp.OffersDay or 0
	return sp
end
Sponsor.state = state

function Sponsor.refreshOffers(player)
	local data = S.Data.get(player)
	local sp = state(data)
	local day = data.Home.PlayDays
	if sp.OffersDay == day and #sp.Offers > 0 then
		return
	end
	sp.OffersDay = day
	sp.Offers = {}
	local rng = Random.new(player.UserId * 1009 + day * 7919)
	local eligible = {}
	for _, b in ipairs(SponsorData.Brands) do
		if data.Reputation >= b.MinRep then
			eligible[#eligible + 1] = b
		end
	end
	if #eligible == 0 or data.BizRep < 10 then
		return
	end
	local subs = data.Channel.Subs
	-- Gestor de tu empresa: +1 oferta y mejor pago
	local extra = S.Company and S.Company.sponsorExtra(player) or 0
	local payMult = S.Company and S.Company.sponsorMult(player) or 1
	for i = 1, SponsorData.OffersPerDay + extra do
		local b = eligible[rng:NextInteger(1, #eligible)]
		local cat = b.Cats[rng:NextInteger(1, #b.Cats)]
		local product = (#b.Products > 0 and rng:NextNumber() < 0.75) and b.Products[rng:NextInteger(1, #b.Products)] or nil
		local def = product and Catalog.get(product)
		local kind = "campaign"
		if def then
			kind = def.Price >= 700 and "loan" or "gift"
		end
		local pay = math.floor((120 + 6 * math.sqrt(subs)) * (1 + data.Reputation / 100) * (0.5 + data.BizRep / 100) * (kind == "loan" and 1.3 or 1) * payMult * rng:NextNumber(0.85, 1.15))
		sp.Seq = sp.Seq + 1
		table.insert(sp.Offers, {
			Id = "o" .. sp.Seq,
			Brand = b.Id,
			Kind = kind,
			Category = cat,
			Product = product,
			MinQ = math.floor(math.min(85, 35 + math.sqrt(subs) * 0.3 + rng:NextInteger(0, 10))),
			Days = rng:NextInteger(2, 4),
			Pay = math.floor(pay / 5) * 5,
			Bonus = math.floor(pay * 0.3 / 5) * 5,
		})
	end
end

local function brandName(id)
	local b = SponsorData.BrandById[id]
	return b and b.Name or id
end

-- Comprueba si un proyecto cumple un contrato. Devuelve nil o el motivo.
function Sponsor.check(contract, proj, quality)
	if proj.Category ~= contract.Category then
		return "El contrato pide un vídeo de " .. (VideoData.CategoryById[contract.Category] or {}).Name .. "."
	end
	if quality < contract.MinQ then
		return "El contrato exige calidad " .. contract.MinQ .. " (tu vídeo tiene " .. math.floor(quality) .. ")."
	end
	if contract.Product then
		local shown = false
		for _, sc in ipairs(proj.Scenes) do
			if sc.Feat == contract.Product and sc.Own then
				shown = true
			end
		end
		if not shown then
			return "Debes mostrar el producto patrocinado (" .. Catalog.get(contract.Product).Name .. ") en un plano de producto, con el producto en tu mochila."
		end
	end
	return nil
end

-- Lo llama VideoService al publicar con contrato. Devuelve etiqueta o error.
function Sponsor.fulfill(player, contractId, proj, quality)
	local data = S.Data.get(player)
	local sp = state(data)
	local c = sp.Active[contractId]
	if not c then
		return nil, "Ese contrato no existe o ya terminó."
	end
	local err = Sponsor.check(c, proj, quality)
	if err then
		return nil, err
	end
	return c
end

function Sponsor.complete(player, contractId, quality)
	local data = S.Data.get(player)
	local sp = state(data)
	local c = sp.Active[contractId]
	if not c then
		return
	end
	sp.Active[contractId] = nil
	local total = c.Pay + (quality >= c.MinQ + 15 and c.Bonus or 0)
	if c.Kind == "loan" and c.ItemUid and data.Inventory[c.ItemUid] then
		S.Inventory.remove(player, c.ItemUid)
	end
	data.BizRep = math.min(100, data.BizRep + 5)
	data.Counters.sponsors_done = (data.Counters.sponsors_done or 0) + 1
	Util.pushCapped(sp.History, { Brand = c.Brand, Result = "Cumplido", Pay = total, T = os.time() }, 20)
	S.Economy.add(player, total, "Patrocinios", "Contrato con " .. brandName(c.Brand), { taxable = true })
	S.Net.notify(player, "🤝 Contrato con " .. brandName(c.Brand) .. " cumplido: +$" .. total .. (c.Kind == "loan" and " (equipo prestado devuelto)" or ""), "success")
	S.Quest.check(player)
end

function Sponsor.onNewDay(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local sp = state(data)
	for id, c in pairs(sp.Active) do
		if data.Home.PlayDays > c.DueDay then
			sp.Active[id] = nil
			if c.Kind == "loan" and c.ItemUid and data.Inventory[c.ItemUid] then
				S.Inventory.remove(player, c.ItemUid)
			end
			data.BizRep = math.max(0, data.BizRep - 10)
			data.Reputation = math.max(0, data.Reputation - 2)
			Util.pushCapped(sp.History, { Brand = c.Brand, Result = "Incumplido", Pay = 0, T = os.time() }, 20)
			S.Net.notify(player, "⚠️ No cumpliste el contrato con " .. brandName(c.Brand) .. ". Reputación comercial −10." .. (c.Kind == "loan" and " El equipo prestado se ha devuelto." or ""), "warn")
		end
	end
	Sponsor.refreshOffers(player)
	S.Data.markDirty(player)
end

function Sponsor.Start()
	local Net = S.Net

	Net.on("Sponsor.Refresh", function(player)
		Sponsor.refreshOffers(player)
		return true
	end)

	Net.on("Sponsor.Accept", function(player, p)
		local data = S.Data.get(player)
		local sp = state(data)
		local offer, idx = nil, nil
		for i, o in ipairs(sp.Offers) do
			if o.Id == p.id then
				offer, idx = o, i
			end
		end
		if not offer then
			return false, "Esa oferta ya no está disponible."
		end
		if Util.count(sp.Active) >= 3 then
			return false, "Ya tienes 3 contratos activos. Cúmplelos antes de aceptar más."
		end
		if offer.Product then
			local def = Catalog.get(offer.Product)
			if def.Cat == "pc" then
				return false, "Esta oferta no está disponible."
			end
			if not S.Property.canStore(player, 1) then
				return false, "No tienes espacio en casa para recibir el producto."
			end
		end
		table.remove(sp.Offers, idx)
		local c = Util.deepCopy(offer)
		c.Accepted = os.time()
		c.DueDay = data.Home.PlayDays + offer.Days
		if offer.Product then
			local uid = S.Inventory.add(player, offer.Product, { src = offer.Kind == "loan" and "loan" or "sponsor", paid = 0, loc = "home" })
			c.ItemUid = uid
			if uid and offer.Kind == "loan" then
				data.Inventory[uid].Loan = offer.Id
			end
		end
		sp.Active[offer.Id] = c
		return true, "🤝 Contrato aceptado con " .. brandName(offer.Brand) .. ". Entrega antes de " .. offer.Days .. " días de juego." .. (offer.Product and (" Producto enviado a tu casa: " .. Catalog.get(offer.Product).Name .. (offer.Kind == "loan" and " (prestado)." or " (regalo).")) or "")
	end)

	Net.on("Sponsor.Decline", function(player, p)
		local data = S.Data.get(player)
		local sp = state(data)
		for i, o in ipairs(sp.Offers) do
			if o.Id == p.id then
				table.remove(sp.Offers, i)
				return true, "Oferta rechazada (sin penalización)."
			end
		end
		return false, "Oferta no encontrada."
	end)

	Net.on("Sponsor.Cancel", function(player, p)
		local data = S.Data.get(player)
		local sp = state(data)
		local c = sp.Active[p.id or ""]
		if not c then
			return false, "Contrato no encontrado."
		end
		sp.Active[p.id] = nil
		if c.Kind == "loan" and c.ItemUid and data.Inventory[c.ItemUid] then
			S.Inventory.remove(player, c.ItemUid)
		end
		data.BizRep = math.max(0, data.BizRep - 4)
		Util.pushCapped(sp.History, { Brand = c.Brand, Result = "Cancelado", Pay = 0, T = os.time() }, 20)
		return true, "Contrato cancelado. Reputación comercial −4 (menos que incumplirlo)."
	end)
end

return Sponsor
