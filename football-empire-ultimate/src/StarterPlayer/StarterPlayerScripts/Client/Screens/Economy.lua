-- Economy (ModuleScript) · Pantalla "Economía"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Economy
-- Pestañas: Resumen (dinero, deuda, entradas, previsión, historial) · Aficionados (FASE 3)
-- · Comercial (FASE 3) · Patrocinios (FASE 3).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local CommercialConfig = require(Shared.Config.CommercialConfig)
local SponsorConfig = require(Shared.Config.SponsorConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)

local Economy = {}

local INCOME_LABELS = {
	{ "tickets", "🎟️ Entradas" },
	{ "members", "🎫 Cuotas de socios" },
	{ "shop", "🛍️ Tienda" },
	{ "restaurant", "🍔 Restauración" },
	{ "sponsors", "🏢 Patrocinio local" },
	{ "contracts", "🤝 Contratos de patrocinio" },
	{ "vip", "🥂 Zona VIP" },
	{ "tour", "🗺️ Tour del estadio" },
	{ "loans", "🔁 Cesiones a otros clubes" },
}
local EXPENSE_LABELS = {
	{ "maintenance", "🔧 Mantenimiento" },
	{ "staff", "👷 Personal" },
	{ "stadium", "🏟️ Operación del estadio" },
	{ "wages", "👕 Salarios de la plantilla" },
	{ "scouts", "🔎 Ojeadores" },
	{ "loans", "🔁 Cuotas de cesiones recibidas" },
	{ "interest", "📉 Intereses de deuda" },
}

local function breakdown(ctx, title, cycle)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local card = C.Card({}, { C.Title(title, 18) })
	local function line(text, amount, color)
		local row = C.New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22) })
		C.Label(text, { Size = UDim2.new(0.6, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 }).Parent = row
		C.Label(Format.SignedMoney(amount), {
			Position = UDim2.fromScale(0.6, 0), Size = UDim2.new(0.4, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
			TextXAlignment = Enum.TextXAlignment.Right, TextSize = 14, TextColor3 = color, Font = Theme.FontBold,
		}).Parent = row
		row.Parent = card
	end
	for _, entry in ipairs(INCOME_LABELS) do
		line(entry[2], cycle.income[entry[1]] or 0, Theme.Accent)
	end
	for _, entry in ipairs(EXPENSE_LABELS) do
		line(entry[2], -(cycle.expenses[entry[1]] or 0), Theme.Danger)
	end
	line("<b>Balance</b>", cycle.net, cycle.net >= 0 and Theme.Accent or Theme.Danger)
	C.Label(string.format("Asistencia: %s / %s espectadores", Format.Thousands(cycle.attendance), Format.Thousands(cycle.capacity)),
		{ TextColor3 = Theme.TextDim, TextSize = 13 }).Parent = card
	return card
end

local function renderSummary(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local eco = state.economy

	local grid = C.Grid(200, 78, 10)
	add(grid)
	local stats = {
		{ "💰", "Dinero", Format.Money(eco.money), Theme.Gold },
		{ "📉", "Deuda", Format.Money(eco.debt), eco.debt > 0 and Theme.Danger or nil },
		{ "🏦", "Valor del club", Format.Money(eco.clubValue) },
		{ "👕", "Presupuesto salarial", Format.Money(eco.wageBudget) },
		{ "🔁", "Presupuesto de fichajes", Format.Money(eco.transferBudget) },
		{ "📊", "Ingresado / gastado", Format.Short(eco.totalEarned) .. " / " .. Format.Short(eco.totalSpent) },
	}
	for i, s in ipairs(stats) do
		local stat = C.Stat(s[1], s[2], s[3], s[4])
		stat.LayoutOrder = i
		stat.Parent = grid
	end
	add(C.Label("El presupuesto salarial orienta cuánto gastar en salarios. El de fichajes (25 %) es orientativo: el límite real se elige en Fichajes.",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }))

	-- Precio de entradas
	local ticketCard = C.Card({}, {
		C.Title("🎟️ Precio de las entradas", 18),
		C.Label("Precios más altos dan más ingresos por espectador pero reducen la asistencia.", { TextColor3 = Theme.TextDim, TextSize = 14 }),
	})
	local buttons = {}
	for _, option in ipairs(GameConfig.TICKET_PRICES) do
		local selected = eco.ticketPrice == option.id
		table.insert(buttons, C.Button(string.format("%s · %s · demanda %s", option.name, Format.Money(option.price), Format.Percent(option.demand)),
			selected and "primary" or "secondary", function()
				if not selected then
					ctx.act("SetTicketPrice", { option = option.id })
				end
			end))
	end
	C.Row(buttons, 8).Parent = ticketCard
	add(ticketCard)

	-- Deuda
	local debtCard = C.Card({}, {
		C.Title("📉 Deuda", 18),
		C.Label(string.format("Si una jornada acaba en negativo, el déficit pasa a deuda con un interés del %s por jornada. "
			.. "El %s del beneficio de cada jornada amortiza deuda automáticamente. Con más de %s de deuda no puedes construir.",
			Format.Percent(GameConfig.DEBT_INTEREST_PER_CYCLE), Format.Percent(GameConfig.DEBT_AUTO_REPAY_SHARE), Format.Money(eco.debtLimit)),
			{ TextColor3 = Theme.TextDim, TextSize = 14 }),
	})
	if eco.debt > 0 then
		local payAll = C.Button("Pagar todo lo posible", "danger", function()
			ctx.act("RepayDebt", { amount = 0 })
		end)
		local pay1k = C.Button("Pagar " .. Format.Money(1000), "secondary", function()
			ctx.act("RepayDebt", { amount = 1000 })
		end)
		C.SetEnabled(payAll, eco.money > 0)
		C.SetEnabled(pay1k, eco.money > 0)
		C.Row({ payAll, pay1k }, 8).Parent = debtCard
	else
		C.Label("✅ Tu club no tiene deuda.", { TextColor3 = Theme.Accent }).Parent = debtCard
	end
	add(debtCard)

	add(breakdown(ctx, string.format("📈 Previsión de la próxima jornada (en %s)", Format.Duration(ctx.secondsToNextCycle())), eco.forecast))
	if eco.lastCycle then
		add(breakdown(ctx, "🧾 Última jornada " .. os.date("(%H:%M)", eco.lastCycle.t), eco.lastCycle))
	end

	-- Historial
	local history = C.Card({}, { C.Title("📜 Historial de transacciones", 18) })
	local list = eco.transactions or {}
	if #list == 0 then
		C.Label("Todavía no hay movimientos.", { TextColor3 = Theme.TextMuted }).Parent = history
	end
	for i = #list, math.max(1, #list - 29), -1 do
		local t = list[i]
		local row = C.New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22) })
		C.Label(string.format("<font color='#8C9BB4'>%s</font>  %s · %s", os.date("%H:%M", t.t), t.category, t.note or ""), {
			Size = UDim2.new(0.72, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13,
			TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false,
		}).Parent = row
		C.Label(Format.SignedMoney(t.amount), {
			Position = UDim2.fromScale(0.72, 0), Size = UDim2.new(0.28, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
			TextXAlignment = Enum.TextXAlignment.Right, TextSize = 13, Font = Theme.FontBold,
			TextColor3 = t.amount >= 0 and Theme.Accent or Theme.Danger,
		}).Parent = row
		row.Parent = history
	end
	add(history)
end

local function optionRow(ctx, list, current, kind, describe)
	local buttons = {}
	for _, option in ipairs(list) do
		local selected = current == option.id
		table.insert(buttons, ctx.C.Button(describe(option), selected and "primary" or "secondary", function()
			if not selected then
				ctx.act("SetPricePolicy", { kind = kind, option = option.id })
			end
		end))
	end
	return ctx.C.Row(buttons, 8)
end

local function signed(n)
	return (n >= 0 and "+" or "") .. tostring(n)
end

local function renderFans(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local eco, club = state.economy, state.club
	local f = eco.forecast

	local grid = C.Grid(200, 78, 10)
	add(grid)
	local stats = {
		{ "👥", "Aficionados", Format.Thousands(club.fans) .. " / " .. Format.Thousands(f.fanCap) },
		{ "🎫", "Socios", Format.Thousands(club.members) .. " → " .. Format.Thousands(f.memberTarget) },
		{ "😊", "Satisfacción", string.format("%d → %d", math.floor(club.satisfaction + 0.5), f.satisfactionTarget) },
		{ "🏟️", "Ocupación prevista", Format.Percent(f.occupancy) },
		{ "🛒", "Gasto por satisfacción", "×" .. string.format("%.2f", f.spendMultiplier) },
	}
	for i, st in ipairs(stats) do
		local stat = C.Stat(st[1], st[2], st[3])
		stat.LayoutOrder = i
		stat.Parent = grid
	end

	local satCard = C.Card({}, {
		C.Title("😊 Satisfacción de la afición", 18),
		C.ProgressBar(club.satisfaction / 100, club.satisfaction >= 50 and Theme.Accent or Theme.Warning, 12),
		C.Label("La satisfacción se acerca un 10 % a su objetivo en cada jornada. Hace crecer a la afición, aumenta los socios "
			.. "y multiplica el gasto en tienda y restauración. Por debajo de 25, los aficionados empiezan a irse.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	for _, factor in ipairs(f.satisfactionFactors or {}) do
		local color = factor.value > 0 and Theme.Accent or (factor.value < 0 and Theme.Danger or Theme.TextDim)
		C.Label(string.format("%s: <b>%s</b>", factor.label, signed(factor.value)), { TextSize = 14, TextColor3 = color }).Parent = satCard
	end
	C.Label(string.format("Objetivo: <b>%d</b> / 100", f.satisfactionTarget), { TextSize = 14 }).Parent = satCard
	add(satCard)

	local memberCard = C.Card({}, {
		C.Title("🎫 Abonos de socios", 18),
		C.Label(string.format("Los socios pagan su cuota en cada jornada y siempre tienen asiento (como máximo el %s del aforo). "
			.. "Asisten %s socios y %s aficionados con entrada.",
			Format.Percent(GameConfig.MEMBER_SEAT_SHARE), Format.Thousands(f.membersAttending), Format.Thousands(f.casual)),
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	optionRow(ctx, GameConfig.MEMBER_PRICES, eco.memberPrice, "member", function(option)
		return string.format("%s · %s/jornada · demanda %s · %s😊", option.name, Format.Money(option.fee),
			Format.Percent(option.demand), signed(option.satisfaction))
	end).Parent = memberCard
	add(memberCard)
end

local function productCard(ctx, title, products, level, revenue, facilityId)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local def = FacilityConfig.Get(facilityId)
	local card = C.Card({}, {
		C.Title(title, 18),
		C.Label(level > 0 and string.format("%s nivel %d · ventas previstas %s por jornada", def.name, level, Format.Money(revenue))
			or (def.name .. " sin construir. Constrúyela en Construcción."), { TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	for _, entry in ipairs(CommercialConfig.Breakdown(products, level, revenue)) do
		local p = entry.product
		local text = entry.unlocked
			and string.format("%s %s · <b>%s</b>", p.icon, p.name, Format.Money(entry.revenue))
			or string.format("🔒 %s %s · se desbloquea en el nivel %d", p.icon, p.name, p.minLevel)
		C.Label(text, { TextSize = 14, TextColor3 = entry.unlocked and Theme.Text or Theme.TextMuted }).Parent = card
	end
	return card
end

local function renderCommercial(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local eco = state.economy
	local f = eco.forecast
	local facilities = state.stadium.facilities

	local policies = C.Card({}, {
		C.Title("🏷️ Política de precios", 18),
		C.Label("Precios altos aumentan el gasto por espectador pero reducen la satisfacción de la afición.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
		C.Label("<b>Tienda</b>", { TextSize = 14 }),
	})
	local function describe(option)
		return string.format("%s · gasto ×%.2f · %s😊", option.name, option.spend, signed(option.satisfaction))
	end
	optionRow(ctx, CommercialConfig.PricePolicies, eco.shopPrice, "shop", describe).Parent = policies
	C.Label("<b>Restauración</b> (restaurante y quioscos)", { TextSize = 14 }).Parent = policies
	optionRow(ctx, CommercialConfig.PricePolicies, eco.foodPrice, "food", describe).Parent = policies
	add(policies)

	add(productCard(ctx, "🛍️ Productos de la tienda", CommercialConfig.ShopProducts, facilities.shop or 0, f.income.shop or 0, "shop"))
	add(productCard(ctx, "🍔 Oferta de restauración", CommercialConfig.FoodProducts, facilities.restaurant or 0, f.income.restaurant or 0, "restaurant"))

	local other = C.Card({}, {
		C.Title("🏪 Otras instalaciones comerciales", 18),
		C.Label(string.format("🌭 Quioscos: nivel %d (suman gasto en restauración)", facilities.kiosks or 0), { TextSize = 14 }),
		C.Label(string.format("🗺️ Tour del estadio: nivel %d · %s por jornada", facilities.tour or 0, Format.Money(f.income.tour or 0)), { TextSize = 14 }),
		C.Label(string.format("🥂 Zona VIP: nivel %d · %s por jornada", facilities.vip or 0, Format.Money(f.income.vip or 0)), { TextSize = 14 }),
		C.Button("Ir a Construcción", "secondary", function()
			ctx.navigate("build")
		end),
	})
	add(other)
end

local function renderSponsors(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local sponsors = state.sponsors
	local f = state.economy.forecast
	local cyclesToRefresh = math.max(0, sponsors.nextRefresh - state.stats.cycles)

	add(C.Label(string.format("Las marcas son ficticias. Las ofertas dependen de tu reputación y tus aficionados y se renuevan cada %d jornadas "
		.. "(próxima renovación en %d). Si cumples el objetivo de un contrato, cobras un %s extra en esa jornada.",
		SponsorConfig.OFFER_REFRESH_CYCLES, cyclesToRefresh, Format.Percent(SponsorConfig.OBJECTIVE_BONUS)),
		{ TextColor3 = Theme.TextDim, TextSize = 13 }))

	for _, slot in ipairs(SponsorConfig.Slots) do
		local card = C.Card({}, { C.Title(slot.icon .. " " .. slot.name, 18) })
		local contract = sponsors.contracts[slot.id]
		if state.stadium.stage < slot.minStage then
			C.Label(string.format("🔒 Se desbloquea con el estadio en etapa %d.", slot.minStage), { TextColor3 = Theme.TextMuted }).Parent = card
		elseif contract then
			local detail = f.contracts and f.contracts[slot.id]
			local met = detail and detail.objectiveMet
			C.Label(string.format("<b>%s</b> · %s por jornada · quedan %d de %d jornadas",
				contract.brand, Format.Money(contract.payment), contract.cyclesLeft, contract.duration), { TextSize = 15 }).Parent = card
			C.Label((met and "✅ " or "⏳ ") .. "Objetivo: " .. SponsorConfig.ObjectiveText(contract.objective)
				.. (met and " (cumplido: +" .. Format.Percent(SponsorConfig.OBJECTIVE_BONUS) .. ")" or " (no cumplido ahora)"),
				{ TextSize = 14, TextColor3 = met and Theme.Accent or Theme.Warning }).Parent = card
			local penalty = contract.payment * SponsorConfig.TERMINATION_PENALTY
			local button = C.Button("Rescindir · penalización " .. Format.Money(penalty), "danger", function()
				ctx.act("TerminateSponsor", { slot = slot.id })
			end)
			C.SetEnabled(button, state.economy.money >= penalty)
			button.Parent = card
		else
			local offers = sponsors.offers[slot.id] or {}
			if #offers == 0 then
				C.Label("Sin ofertas ahora mismo. Llegarán en la próxima jornada.", { TextColor3 = Theme.TextMuted }).Parent = card
			end
			for _, offer in ipairs(offers) do
				C.Row({
					C.Label(string.format("<b>%s</b> · %s/jornada · %d jornadas · prima %s<br/><font color='#A0AFC8'>Objetivo: %s</font>",
						offer.brand, Format.Money(offer.payment), offer.duration, Format.Money(offer.bonus),
						SponsorConfig.ObjectiveText(offer.objective)), { Size = UDim2.new(1, -130, 0, 0), TextSize = 14 }),
					C.Button("Firmar", "primary", function()
						ctx.act("AcceptSponsor", { slot = slot.id, offer = offer.id })
					end, { Size = UDim2.new(0, 110, 0, 36), AutomaticSize = Enum.AutomaticSize.None }),
				}).Parent = card
			end
		end
		add(card)
	end
end

function Economy.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "summary"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Title("💰 Economía", 26))
	local tabs = {
		{ id = "summary", label = "Resumen" },
		{ id = "fans", label = "Aficionados" },
		{ id = "commercial", label = "Comercial" },
		{ id = "sponsors", label = "Patrocinios" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("economy", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))

	if tab == "fans" then
		renderFans(add, ctx)
	elseif tab == "commercial" then
		renderCommercial(add, ctx)
	elseif tab == "sponsors" then
		renderSponsors(add, ctx)
	else
		renderSummary(add, ctx)
	end
end

return Economy
