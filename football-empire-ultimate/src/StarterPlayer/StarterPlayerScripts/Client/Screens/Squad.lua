-- Squad (ModuleScript) · Pantalla "Plantilla" (FASE 4)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Squad
-- Jugadores con estadísticas, contratos, entrenamiento, renovaciones y rescisiones.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FootballConfig = require(Shared.Config.FootballConfig)

local Squad = {}

local function ovrColor(Theme, ovr)
	if ovr >= 80 then
		return Theme.Gold
	elseif ovr >= 65 then
		return Theme.Accent
	elseif ovr >= 50 then
		return Theme.Info
	end
	return Theme.TextDim
end
Squad.OvrColor = ovrColor

-- Fila de atributo con barra
local function attrBar(ctx, attr, value)
	local C, Theme = ctx.C, ctx.Theme
	local row = C.New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20) })
	C.Label(attr.name, { Size = UDim2.new(0, 95, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13, TextColor3 = Theme.TextDim }).Parent = row
	local bar = C.ProgressBar(value / 99, ovrColor(Theme, value), 8)
	bar.Position = UDim2.new(0, 100, 0.5, -4)
	bar.Size = UDim2.new(1, -140, 0, 8)
	bar.Parent = row
	C.Label(tostring(value), { Position = UDim2.new(1, -34, 0, 0), Size = UDim2.new(0, 34, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
		TextXAlignment = Enum.TextXAlignment.Right, Font = Theme.FontBold, TextSize = 13 }).Parent = row
	return row
end
Squad.AttrBar = attrBar

-- Tarjeta de jugador reutilizable (también la usa la Academia).
-- opts = { expanded, onToggle, actions = function(card) }
function Squad.PlayerCard(ctx, p, opts)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local pos = FootballConfig.Position(p.pos)
	local card = C.Card({ BackgroundColor3 = opts.expanded and Theme.CardAlt or Theme.Card })
	local header = C.New("TextButton", {
		Text = "",
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 44),
		AutoButtonColor = false,
	})
	C.Label(tostring(p.ovr), {
		Font = Theme.FontBlack, TextSize = 26, TextColor3 = ovrColor(Theme, p.ovr),
		Size = UDim2.new(0, 46, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center,
	}).Parent = header
	local potential = p.potentialLow == p.potentialHigh and tostring(p.potentialLow) or (p.potentialLow .. "-" .. p.potentialHigh)
	local condition = ""
	if p.loan then
		condition = p.loan.type == "out" and (" · ➡️ cedido a " .. p.loan.club) or (" · ⬅️ cedido por " .. p.loan.club)
	elseif p.listed == "sale" then
		condition = " · 🏷️ en venta"
	elseif (p.injury or 0) > 0 then
		condition = string.format(" · 🚑 %d j.", p.injury)
	elseif p.fitness and p.fitness < 100 then
		condition = string.format(" · 💪 %d", p.fitness)
	end
	C.Label(string.format("<b>%s</b>%s\n<font color='#A0AFC8'>%s %s · %d años · potencial %s%s</font>",
		p.name, p.star and "  ⭐" or "", pos.icon, pos.short, p.age, potential, condition), {
		Position = UDim2.fromOffset(54, 0), Size = UDim2.new(1, -170, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14,
	}).Parent = header
	local right = p.contract and p.contract > 0
		and string.format("%s/jornada\n%d temp.%s", Format.Money(p.salary), p.contract, p.contract <= 1 and " ⚠️" or "")
		or string.format("+%s/temp.", tostring(p.growth))
	C.Label(right, { Position = UDim2.new(1, -112, 0, 0), Size = UDim2.new(0, 112, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
		TextXAlignment = Enum.TextXAlignment.Right, TextSize = 12, TextColor3 = Theme.TextDim }).Parent = header
	header.Activated:Connect(opts.onToggle)
	header.Parent = card

	if opts.expanded then
		for _, attr in ipairs(FootballConfig.Attributes) do
			attrBar(ctx, attr, p.attrs[attr.id] or 0).Parent = card
		end
		C.Label(string.format("Valor de mercado: <b>%s</b> · Evolución prevista: <b>%+.1f</b> de media por temporada · Partidos %d · Goles %d · Asistencias %d",
			Format.Money(p.value), p.growth, p.stats.apps, p.stats.goals, p.stats.assists), { TextSize = 13 }).Parent = card
		-- Foco de entrenamiento
		local focusButtons = { C.Button("Equilibrado", p.focus == nil and "primary" or "secondary", function()
			if p.focus ~= nil then
				ctx.act("SetTrainingFocus", { id = p.id, focus = "" })
			end
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }) }
		for _, attr in ipairs(FootballConfig.Attributes) do
			table.insert(focusButtons, C.Button(attr.short, p.focus == attr.id and "primary" or "secondary", function()
				if p.focus ~= attr.id then
					ctx.act("SetTrainingFocus", { id = p.id, focus = attr.id })
				end
			end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
		end
		C.Label("🎯 Foco de entrenamiento:", { TextSize = 13, TextColor3 = Theme.TextDim }).Parent = card
		C.Row(focusButtons, 6).Parent = card
		if opts.actions then
			opts.actions(card)
		end
	end
	return card
end

function Squad.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local football = state.football
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("👕 Plantilla", 26),
		C.Badge(string.format("Temporada %d · jornada %d/%d", football.season.number, football.season.cycle + 1, football.season.length), Theme.Panel, Theme.TextDim),
	}, 12))

	-- Resumen
	local squad = football.squad
	local wages, value, best = 0, 0, {}
	for _, p in ipairs(squad) do
		wages += p.salary
		value += p.value
		table.insert(best, p.ovr)
	end
	table.sort(best, function(a, b)
		return a > b
	end)
	local top = 0
	for i = 1, math.min(11, #best) do
		top += best[i]
	end
	local grid = C.Grid(200, 78, 10)
	add(grid)
	local stats = {
		{ "👥", "Jugadores", string.format("%d / %d", #squad, FootballConfig.MAX_SQUAD) },
		{ "⭐", "Media del mejor 11", tostring(math.floor(top / math.max(1, math.min(11, #best)) + 0.5)) },
		{ "💸", "Salarios por jornada", Format.Money(wages) },
		{ "💎", "Valor de la plantilla", Format.Money(value) },
	}
	for i, st in ipairs(stats) do
		local stat = C.Stat(st[1], st[2], st[3])
		stat.LayoutOrder = i
		stat.Parent = grid
	end

	-- Entrenamiento
	local training = C.Card({}, {
		C.Title("🏋️ Entrenamiento", 18),
		C.Label(string.format("La evolución depende del potencial, la edad, la intensidad y el Centro de entrenamiento (multiplicador actual ×%.2f). "
			.. "Los jugadores mayores de 30 empiezan a declinar.", football.training.multiplier), { TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	local intensityButtons = {}
	for _, option in ipairs(FootballConfig.TrainingIntensities) do
		local selected = football.training.intensity == option.id
		table.insert(intensityButtons, C.Button(string.format("%s · ×%.1f", option.name, option.growth), selected and "primary" or "secondary", function()
			if not selected then
				ctx.act("SetTrainingIntensity", { intensity = option.id })
			end
		end))
	end
	C.Row(intensityButtons, 8).Parent = training
	add(training)

	-- Filtros
	local filter = ctx.params.filter or "ALL"
	local filterButtons = { C.Button("Todos", filter == "ALL" and "primary" or "secondary", function()
		ctx.navigate("squad", { filter = "ALL" })
	end) }
	for _, position in ipairs(FootballConfig.Positions) do
		table.insert(filterButtons, C.Button(position.icon .. " " .. position.short, filter == position.id and "primary" or "secondary", function()
			ctx.navigate("squad", { filter = position.id })
		end))
	end
	add(C.Row(filterButtons, 6))

	local sorted = table.clone(squad)
	table.sort(sorted, function(a, b)
		if a.pos ~= b.pos then
			local order = { GK = 1, DEF = 2, MID = 3, FWD = 4 }
			return order[a.pos] < order[b.pos]
		end
		return a.ovr > b.ovr
	end)
	for _, p in ipairs(sorted) do
		if filter == "ALL" or p.pos == filter then
			local expanded = ctx.params.selected == p.id
			add(Squad.PlayerCard(ctx, p, {
				expanded = expanded,
				onToggle = function()
					ctx.navigate("squad", { filter = filter, selected = (not expanded) and p.id or nil })
				end,
				actions = function(card)
					if p.contract <= FootballConfig.RENEW_WINDOW then
						C.Label(string.format("📝 Renovación: pide %s/jornada (ahora cobra %s).", Format.Money(p.salaryDemand), Format.Money(p.salary)),
							{ TextSize = 13 }).Parent = card
						local renewButtons = {}
						for years = 1, FootballConfig.CONTRACT_MAX_SEASONS do
							table.insert(renewButtons, C.Button(years .. " temp.", "secondary", function()
								ctx.act("RenewContract", { id = p.id, years = years })
							end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
						end
						C.Row(renewButtons, 6).Parent = card
					else
						C.Label(string.format("📝 Contrato: %d temporadas. Podrás renovar cuando queden %d o menos.", p.contract, FootballConfig.RENEW_WINDOW),
							{ TextSize = 13, TextColor3 = Theme.TextDim }).Parent = card
					end
					local release = C.Button("Rescindir · " .. Format.Money(p.releaseCost), "danger", function()
						ctx.act("ReleasePlayer", { id = p.id })
					end)
					C.SetEnabled(release, not p.loan and #squad > FootballConfig.MIN_SQUAD and state.economy.money >= p.releaseCost)
					release.Parent = card
				end,
			}))
		end
	end
	add(C.Label("Toca un jugador para ver sus atributos, su foco de entrenamiento y su contrato. Compra, vende y cede en «Fichajes».",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }))
end

return Squad
