-- Transfers (ModuleScript) · Pantalla "Fichajes" (FASE 6)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Transfers
-- Pestañas: Mercado · Ofertas recibidas · Vender y ceder.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FootballConfig = require(Shared.Config.FootballConfig)
local TransferConfig = require(Shared.Config.TransferConfig)

local Squad = require(script.Parent.Squad)

local Transfers = {}

local function renderMarket(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local tr = state.transfers
	local years = ctx.params.years or TransferConfig.DEFAULT_CONTRACT

	local budget = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label(string.format("💼 Presupuesto de fichajes: <b>%s</b> (%d%% de tu dinero) · Plantilla %d/%d · El mercado se renueva en %d jornada(s).",
			Format.Money(tr.budget), math.floor(tr.budgetShare * 100), tr.activeCount, FootballConfig.MAX_SQUAD, tr.nextRefresh), { TextSize = 14 }),
	})
	local shareButtons = {}
	for _, share in ipairs(TransferConfig.BudgetShares) do
		table.insert(shareButtons, C.Button(math.floor(share * 100) .. " %", tr.budgetShare == share and "primary" or "secondary", function()
			if tr.budgetShare ~= share then
				ctx.act("SetTransferBudget", { share = share })
			end
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
	end
	C.Row(shareButtons, 6).Parent = budget
	local yearButtons = { C.Label("Contrato para los fichajes:", { Size = UDim2.new(0, 0, 0, 30), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false, TextSize = 13 }) }
	for y = 1, FootballConfig.CONTRACT_MAX_SEASONS do
		table.insert(yearButtons, C.Button(y .. " temp.", years == y and "primary" or "secondary", function()
			ctx.navigate("transfers", { tab = "market", years = y, selected = ctx.params.selected })
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
	end
	C.Row(yearButtons, 6).Parent = budget
	add(budget)

	local full = tr.activeCount >= FootballConfig.MAX_SQUAD
	for _, l in ipairs(tr.listings) do
		local p = l.player
		local expanded = ctx.params.selected == l.id
		local kindText = l.kind == "free" and "🆓 Libre" or (l.kind == "loan" and ("🔁 Cesión · " .. l.club) or ("🏟️ " .. l.club))
		add(C.Label(string.format("<font color='#A0AFC8'>%s · pide salario %s/jornada</font>", kindText, Format.Money(l.salary)), { TextSize = 12 }))
		add(Squad.PlayerCard(ctx, p, {
			expanded = expanded,
			onToggle = function()
				ctx.navigate("transfers", { tab = "market", years = years, selected = (not expanded) and l.id or nil })
			end,
			actions = function(card)
				if l.kind == "buy" then
					if l.rejected then
						C.Label("❌ Su club rechazó tu oferta. Podrás volver a intentarlo cuando se renueve el mercado.", { TextSize = 13, TextColor3 = Theme.Warning }).Parent = card
					end
					local buttons = {}
					for _, level in ipairs(TransferConfig.OfferLevels) do
						local fee = math.floor(l.asking * level.share)
						local b = C.Button(string.format("%s · %s (%d%%)", level.name, Format.Money(fee), math.floor(level.chance * 100)), "primary", function()
							ctx.act("BuyPlayer", { listing = l.id, offer = level.id, years = years })
						end, { Size = UDim2.new(0, 0, 0, 32), TextSize = 13 })
						C.SetEnabled(b, not l.rejected and not full and fee <= tr.budget)
						table.insert(buttons, b)
					end
					C.Label("Oferta (probabilidad de que acepten):", { TextSize = 13, TextColor3 = Theme.TextDim }).Parent = card
					C.Row(buttons, 6).Parent = card
				elseif l.kind == "free" then
					local b = C.Button("Fichar libre · prima " .. Format.Money(l.bonus), "primary", function()
						ctx.act("BuyPlayer", { listing = l.id, years = years })
					end)
					C.SetEnabled(b, not full and state.economy.money >= l.bonus)
					b.Parent = card
				else
					local b = C.Button(string.format("Cesión hasta final de temporada · %s/jornada", Format.Money(l.loanFee)), "primary", function()
						ctx.act("BuyPlayer", { listing = l.id })
					end)
					C.SetEnabled(b, not full)
					b.Parent = card
				end
			end,
		}))
	end
	add(C.Label("Toca un jugador para ver sus atributos y hacer una oferta. El potencial se muestra como rango según tus ojeadores.",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }))
end

local function renderOffers(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local offers = state.transfers.offers
	if #offers == 0 then
		add(C.Label("No tienes ofertas. Pon jugadores en venta en «Vender y ceder». A veces llegan ofertas inesperadas por tus mejores jugadores.",
			{ TextColor3 = Theme.TextMuted }))
	end
	for _, o in ipairs(offers) do
		local value = 0
		for _, p in ipairs(state.football.squad) do
			if p.id == o.playerId then
				value = p.value
			end
		end
		add(C.Card({}, {
			C.Label(string.format("%s<b>%s</b> ofrece <b>%s</b> por <b>%s</b> (valor %s) · caduca en %d jornada(s)",
				o.unsolicited and "⚡ " or "", o.club, Format.Money(o.fee), o.playerName, Format.Money(value),
				math.max(0, o.expires - state.stats.cycles)), { TextSize = 14 }),
			C.Row({
				C.Button("Aceptar venta", "primary", function()
					ctx.act("AcceptTransferOffer", { offer = o.id })
				end),
				C.Button("Rechazar", "danger", function()
					ctx.act("RejectTransferOffer", { offer = o.id })
				end),
			}, 8),
		}))
	end
end

local function renderSell(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local loans = C.Card({}, { C.Title("🔁 Cesiones activas", 18) })
	local any = false
	for _, p in ipairs(state.football.squad) do
		if p.loan then
			any = true
			C.Label(p.loan.type == "in"
				and string.format("⬅️ %s, cedido por %s · %s/jornada · vuelve a su club al final de la temporada %d", p.name, p.loan.club, Format.Money(p.loan.fee), p.loan.endSeason)
				or string.format("➡️ %s, cedido a %s · ingresas %s/jornada · vuelve al final de la temporada %d", p.name, p.loan.club, Format.Money(p.loan.fee), p.loan.endSeason),
				{ TextSize = 14 }).Parent = loans
		end
	end
	if not any then
		C.Label("No hay cesiones activas.", { TextColor3 = Theme.TextMuted }).Parent = loans
	end
	add(loans)

	add(C.Label("Pon jugadores en venta para recibir ofertas, u ofrece en cesión a jóvenes (≤25 años): su nuevo club paga el salario y te paga una cuota por jornada.",
		{ TextColor3 = Theme.TextDim, TextSize = 13 }))
	for _, p in ipairs(state.football.squad) do
		if not p.loan then
			local pos = FootballConfig.Position(p.pos)
			local status = p.listed == "sale" and "🏷️ En venta" or (p.listed == "loan" and "🔁 Disponible para cesión" or "")
			local buttons = {}
			if p.listed then
				table.insert(buttons, C.Button("Quitar del mercado", "secondary", function()
					ctx.act("SetTransferListing", { id = p.id, mode = "none" })
				end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
			else
				table.insert(buttons, C.Button("Poner en venta", "secondary", function()
					ctx.act("SetTransferListing", { id = p.id, mode = "sale" })
				end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
				if p.age <= 25 then
					table.insert(buttons, C.Button("Ofrecer cesión", "secondary", function()
						ctx.act("SetTransferListing", { id = p.id, mode = "loan" })
					end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
				end
			end
			local row = C.Card({}, {
				C.Label(string.format("<b>%s</b> · %s · %d años · media %d · valor %s %s", p.name, pos.short, p.age, p.ovr, Format.Money(p.value), status),
					{ TextSize = 14 }),
				C.Row(buttons, 6),
			})
			add(row)
		end
	end
end

function Transfers.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "market"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("🔁 Fichajes", 26))
	local offers = #ctx.state.transfers.offers
	local tabs = {
		{ id = "market", label = "Mercado" },
		{ id = "offers", label = offers > 0 and string.format("Ofertas (%d)", offers) or "Ofertas" },
		{ id = "sell", label = "Vender y ceder" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("transfers", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	if tab == "offers" then
		renderOffers(add, ctx)
	elseif tab == "sell" then
		renderSell(add, ctx)
	else
		renderMarket(add, ctx)
	end
end

return Transfers
