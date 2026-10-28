-- Matches (ModuleScript) · Pantalla "Partidos" (FASE 5)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Matches
-- Pestañas: Alineación · Tácticas · Amistosos · Historial.
-- Todos los partidos son SIMULADOS por el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FootballConfig = require(Shared.Config.FootballConfig)
local TacticsConfig = require(Shared.Config.TacticsConfig)
local MatchEngine = require(Shared.Modules.MatchEngine)

local UI = script.Parent.Parent:WaitForChild("UI")
local MatchViewer = require(UI.MatchViewer)

local Matches = {}

local function playersById(state)
	local map = {}
	for _, p in ipairs(state.football.squad) do
		map[p.id] = p
	end
	return map
end

local function playerLine(p)
	if not p then
		return "— vacío —"
	end
	local pos = FootballConfig.Position(p.pos)
	return string.format("<b>%s</b> · %s · media %d · 💪 %d%s", p.name, pos.short, p.ovr, p.fitness or 100,
		(p.injury or 0) > 0 and string.format(" · 🚑 %d j.", p.injury) or "")
end

local function renderLineup(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local md = state.matchday
	local byId = playersById(state)

	local formationButtons = {}
	for _, f in ipairs(TacticsConfig.Formations) do
		table.insert(formationButtons, C.Button(f.name, md.tactics.formation == f.id and "primary" or "secondary", function()
			if md.tactics.formation ~= f.id then
				ctx.act("SetFormation", { formation = f.id })
			end
		end))
	end
	add(C.Row(formationButtons, 6))
	add(C.Button("⚡ Alineación automática (mejor once disponible)", "secondary", function()
		ctx.act("AutoLineup")
	end))

	local selectedSlot = ctx.params.slot
	local card = C.Card({}, { C.Title("📋 Once titular", 18) })
	local inLineup = {}
	for index, slot in ipairs(md.tactics.lineup) do
		inLineup[slot.id] = index
		local p = byId[slot.id]
		local pos = FootballConfig.Position(slot.slotPos)
		local outOfPosition = p and p.pos ~= slot.slotPos
		C.Row({
			C.Label(string.format("%d. %s %s · %s%s", index, pos.icon, pos.short, playerLine(p),
				outOfPosition and "  <font color='#FFA028'>(fuera de posición)</font>" or ""), { Size = UDim2.new(1, -110, 0, 0), TextSize = 14 }),
			C.Button(selectedSlot == index and "Cancelar" or "Cambiar", selectedSlot == index and "danger" or "secondary", function()
				ctx.navigate("matches", { tab = "lineup", slot = selectedSlot ~= index and index or nil })
			end, { Size = UDim2.new(0, 96, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13 }),
		}).Parent = card
	end
	add(card)

	if selectedSlot then
		local slotPos = md.tactics.lineup[selectedSlot].slotPos
		local picker = C.Card({ BackgroundColor3 = Theme.CardAlt }, {
			C.Title(string.format("Elegir jugador para el puesto %d (%s)", selectedSlot, FootballConfig.Position(slotPos).short), 16),
		})
		local candidates = {}
		for _, p in ipairs(state.football.squad) do
			local score = p.ovr * MatchEngine.PlayerFactor({ pos = p.pos, slotPos = slotPos, fitness = p.fitness })
			table.insert(candidates, { p = p, score = score })
		end
		table.sort(candidates, function(a, b)
			return a.score > b.score
		end)
		for _, entry in ipairs(candidates) do
			local p = entry.p
			local injured = (p.injury or 0) > 0
			local choose = C.Button(inLineup[p.id] and "Intercambiar" or "Elegir", "primary", function()
				ctx.act("SetLineupSlot", { slot = selectedSlot, id = p.id })
				ctx.navigate("matches", { tab = "lineup" })
			end, { Size = UDim2.new(0, 110, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13 })
			C.SetEnabled(choose, not injured and inLineup[p.id] ~= selectedSlot)
			C.Row({
				C.Label(string.format("%s · rendimiento en el puesto %d", playerLine(p), math.floor(entry.score + 0.5)),
					{ Size = UDim2.new(1, -125, 0, 0), TextSize = 13 }),
				choose,
			}).Parent = picker
		end
		add(picker)
	end

	local bench = C.Card({}, { C.Title("🪑 Suplentes", 16) })
	for _, p in ipairs(state.football.squad) do
		if not inLineup[p.id] then
			C.Label(playerLine(p), { TextSize = 13, TextColor3 = Theme.TextDim }).Parent = bench
		end
	end
	add(bench)
	add(C.Label("💪 = forma física (baja al jugar y se recupera cada jornada). Jugar fuera de posición reduce el rendimiento un 20 % (60 % si es un portero).",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }))
end

local function ratingBar(ctx, label, value)
	local C, Theme = ctx.C, ctx.Theme
	local row = C.New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22) })
	C.Label(label, { Size = UDim2.new(0, 110, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 }).Parent = row
	local bar = C.ProgressBar(value / 100, Theme.Accent, 10)
	bar.Position = UDim2.new(0, 115, 0.5, -5)
	bar.Size = UDim2.new(1, -165, 0, 10)
	bar.Parent = row
	C.Label(tostring(math.floor(value + 0.5)), { Position = UDim2.new(1, -44, 0, 0), Size = UDim2.new(0, 44, 1, 0),
		AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Right, Font = Theme.FontBold, TextSize = 14 }).Parent = row
	return row
end

local function renderTactics(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local md = state.matchday
	local byId = playersById(state)

	-- Previsualización con la misma fórmula que el motor del servidor
	local sheet = { mentality = md.tactics.mentality, style = md.tactics.style, players = {} }
	for _, slot in ipairs(md.tactics.lineup) do
		local p = byId[slot.id]
		if p then
			table.insert(sheet.players, { id = p.id, name = p.name, pos = p.pos, slotPos = slot.slotPos, attrs = p.attrs, fitness = p.fitness })
		end
	end
	local ratings = MatchEngine.TeamRatings(sheet, false)
	add(C.Card({}, {
		C.Title("📊 Valoración del once", 18),
		ratingBar(ctx, "⚔️ Ataque", ratings.attack),
		ratingBar(ctx, "🎯 Medio campo", ratings.midfield),
		ratingBar(ctx, "🛡️ Defensa", ratings.defense),
		ratingBar(ctx, "🧤 Portería", ratings.keeper),
		C.Label("El medio campo decide la posesión; el ataque contra la defensa rival, las ocasiones; el tiro contra el portero, los goles. La resistencia pesa a partir del minuto 60.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))

	local mentalityCard = C.Card({}, { C.Title("🧠 Mentalidad", 18) })
	for _, m in ipairs(TacticsConfig.Mentalities) do
		local selected = md.tactics.mentality == m.id
		C.Row({
			C.Button(m.name, selected and "primary" or "secondary", function()
				if not selected then
					ctx.act("SetTactic", { kind = "mentality", value = m.id })
				end
			end, { Size = UDim2.new(0, 130, 0, 34), AutomaticSize = Enum.AutomaticSize.None }),
			C.Label(string.format("%s (ataque ×%.2f, defensa ×%.2f)", m.description, m.attack, m.defense), { Size = UDim2.new(1, -150, 0, 0), TextSize = 13 }),
		}).Parent = mentalityCard
	end
	add(mentalityCard)

	local styleCard = C.Card({}, { C.Title("🎨 Estilo de juego", 18) })
	for _, st in ipairs(TacticsConfig.Styles) do
		local selected = md.tactics.style == st.id
		C.Row({
			C.Button(st.name, selected and "primary" or "secondary", function()
				if not selected then
					ctx.act("SetTactic", { kind = "style", value = st.id })
				end
			end, { Size = UDim2.new(0, 130, 0, 34), AutomaticSize = Enum.AutomaticSize.None }),
			C.Label(st.description, { Size = UDim2.new(1, -150, 0, 0), TextSize = 13 }),
		}).Parent = styleCard
	end
	add(styleCard)
end

local function renderFriendlies(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local md = state.matchday
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label("ℹ️ Los partidos son <b>simulaciones</b>: el servidor calcula el resultado a partir de la calidad de tus jugadores, su forma física, la alineación, la táctica y el factor campo, y después lo ves como resumen. El modo jugable en tiempo real llegará en una fase posterior.",
			{ TextSize = 13 }),
		C.Label(string.format("Media de tu mejor once: <b>%.1f</b> · Un amistoso por jornada, además de los partidos de liga y copa (se juegan solos en cada jornada).", md.strength), { TextSize = 13, TextColor3 = Theme.TextDim }),
	}))
	if md.friendlyPlayed then
		add(C.Label(string.format("Ya has jugado el amistoso de esta jornada. Nuevos rivales en %s.", Format.Duration(ctx.secondsToNextCycle())),
			{ TextColor3 = Theme.Warning }))
	end
	for _, offer in ipairs(md.friendlies or {}) do
		local difficulty
		for _, d in ipairs(TacticsConfig.FRIENDLY_DIFFICULTY) do
			if d.id == offer.difficulty then
				difficulty = d
			end
		end
		local prize = math.floor(TacticsConfig.FRIENDLY_PRIZE_BASE * (offer.strength / 50) ^ 2)
		local play = C.Button("▶ Simular partido", "primary", function()
			local result = ctx.act("PlayFriendly", { offer = offer.id })
			if result.ok and result.data then
				MatchViewer.Show(result.data)
			end
		end)
		C.SetEnabled(play, not md.friendlyPlayed)
		add(C.Card({}, {
			C.Row({
				C.Title(offer.name, 18),
				C.Badge(difficulty and difficulty.name or "", difficulty and difficulty.id == "HARD" and Theme.Danger or (difficulty and difficulty.id == "EASY" and Theme.AccentDark or Theme.Info)),
			}, 10),
			C.Label(string.format("Media %d · %s · %s · %s · premio por victoria %s",
				offer.strength, TacticsConfig.Formation(offer.formation).name, TacticsConfig.Mentality(offer.mentality).name,
				TacticsConfig.Style(offer.style).name, Format.Money(prize)), { TextSize = 13, TextColor3 = Theme.TextDim }),
			play,
		}))
	end
end

local function renderHistory(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local md = state.matchday
	local t = md.totals
	local grid = C.Grid(160, 78, 10)
	add(grid)
	local stats = {
		{ "⚽", "Partidos", tostring(t.played) },
		{ "✅", "V / E / D", string.format("%d / %d / %d", t.wins, t.draws, t.losses) },
		{ "🥅", "Goles", string.format("%d - %d", t.goalsFor, t.goalsAgainst) },
		{ "🔥", "Mejor racha invicta", tostring(md.records.unbeatenBest or 0) },
	}
	for i, st in ipairs(stats) do
		local stat = C.Stat(st[1], st[2], st[3])
		stat.LayoutOrder = i
		stat.Parent = grid
	end
	local r = md.records
	add(C.Card({}, {
		C.Title("🏅 Récords", 18),
		C.Label(r.biggestWin and string.format("Mayor victoria: %d-%d contra %s (temporada %d)", r.biggestWin.gf, r.biggestWin.ga, r.biggestWin.opponent, r.biggestWin.season) or "Mayor victoria: —", { TextSize = 14 }),
		C.Label(r.worstDefeat and string.format("Peor derrota: %d-%d contra %s (temporada %d)", r.worstDefeat.gf, r.worstDefeat.ga, r.worstDefeat.opponent, r.worstDefeat.season) or "Peor derrota: —", { TextSize = 14 }),
	}))
	local list = C.Card({}, { C.Title("📜 Últimos partidos", 18) })
	if #md.matches == 0 then
		C.Label("Todavía no has jugado ningún partido.", { TextColor3 = Theme.TextMuted }).Parent = list
	end
	for i = #md.matches, 1, -1 do
		local m = md.matches[i]
		local icon = m.outcome == "W" and "✅" or (m.outcome == "D" and "➖" or "❌")
		C.Label(string.format("%s <b>%d-%d</b> vs %s · %s · temporada %d%s%s · %s",
			icon, m.gf, m.ga, m.opponent, m.competition or "", m.season or 1,
			#m.scorers > 0 and ("<br/><font color='#A0AFC8'>⚽ " .. table.concat(m.scorers, ", ") .. "</font>") or "",
			m.mvp and ("<br/><font color='#FFC400'>⭐ " .. m.mvp .. "</font>") or "",
			Format.Money(m.prize or 0)), { TextSize = 14 }).Parent = list
	end
	add(list)
end

function Matches.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "friendlies"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("⚽ Partidos", 26))
	if ctx.lastMatch then
		local m = ctx.lastMatch
		add(C.Button(string.format("▶ Ver último partido simulado (%s: %s %d - %d %s)", m.competition or "", m.home.short, m.home.goals, m.away.goals, m.away.short),
			"gold", function()
				MatchViewer.Show(ctx.lastMatch)
			end))
	end
	local tabs = {
		{ id = "friendlies", label = "Amistosos" },
		{ id = "lineup", label = "Alineación" },
		{ id = "tactics", label = "Tácticas" },
		{ id = "history", label = "Historial" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("matches", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	if tab == "lineup" then
		renderLineup(add, ctx)
	elseif tab == "tactics" then
		renderTactics(add, ctx)
	elseif tab == "history" then
		renderHistory(add, ctx)
	else
		renderFriendlies(add, ctx)
	end
end

return Matches
