-- Economy (ModuleScript) · Pantalla "Economía"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Economy
-- Dinero, deuda, presupuestos, precio de entradas, previsión, última jornada e historial.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)

local Economy = {}

local INCOME_LABELS = {
	{ "tickets", "🎟️ Entradas" },
	{ "shop", "🛍️ Tienda" },
	{ "restaurant", "🍔 Restaurante" },
	{ "sponsors", "🤝 Patrocinadores" },
	{ "vip", "🥂 Zona VIP" },
}
local EXPENSE_LABELS = {
	{ "maintenance", "🔧 Mantenimiento" },
	{ "staff", "👷 Personal" },
	{ "stadium", "🏟️ Operación del estadio" },
	{ "wages", "👕 Salarios (FASE 4)" },
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

function Economy.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local eco = state.economy
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Title("💰 Economía", 26))

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
	add(C.Label("Los presupuestos salarial y de fichajes se calculan con tus ingresos y tu dinero; se usarán con la plantilla (FASE 4) y el mercado (FASE 6).",
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

return Economy
