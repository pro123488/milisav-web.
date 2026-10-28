-- History (ModuleScript) · Pantalla "Historia del club" (FASE 8)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/History
-- Pestañas: Resumen · Temporadas · Jugadores · Récords · Cronología.
-- Todo procede de acontecimientos reales del juego registrados por el servidor.

local History = {}

local function reputationChart(ctx, points)
	local C, Theme = ctx.C, ctx.Theme
	local frame = C.New("Frame", {
		BackgroundColor3 = Theme.Panel,
		Size = UDim2.new(1, 0, 0, 120),
		Children = { C.Corner(), C.Padding(8) },
	})
	if #points == 0 then
		C.Label("La gráfica aparecerá tras unas jornadas.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = frame
		return frame
	end
	local max = 1
	for _, p in ipairs(points) do
		max = math.max(max, p.value)
	end
	local width = 1 / #points
	for i, p in ipairs(points) do
		local h = p.value / max
		C.New("Frame", {
			BackgroundColor3 = Theme.Accent,
			BorderSizePixel = 0,
			AnchorPoint = Vector2.new(0, 1),
			Position = UDim2.new((i - 1) * width, 1, 1, 0),
			Size = UDim2.new(width, -2, h, 0),
		}, frame)
	end
	return frame
end

local function renderSummary(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local h = state.clubHistory
	local t = h.totals
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("📜 " .. state.club.name, 22),
		C.Label(string.format("Fundado el %s · %d temporadas completadas · %d títulos", os.date("%d/%m/%Y", h.founded), #h.seasons, #h.trophies), { TextSize = 14 }),
		C.Label(string.format("%d partidos (%d V · %d E · %d D) · %d goles a favor y %d en contra · %d canteranos debutados · %d construcciones",
			t.matches, t.wins, t.draws, t.losses, t.goalsFor, t.goalsAgainst, t.graduates, t.buildings), { TextSize = 13, TextColor3 = Theme.TextDim }),
	}))
	add(C.Card({}, {
		C.Title(string.format("⭐ Evolución de la reputación (actual: %d)", h.reputationNow), 18),
		reputationChart(ctx, h.reputationHistory),
		C.Label("Un punto cada 5 jornadas (últimos 60).", { TextSize = 12, TextColor3 = Theme.TextMuted }),
	}))
	local trophies = C.Card({}, { C.Title("🏆 Sala de trofeos", 18) })
	if #h.trophies == 0 then
		C.Label("Sin títulos todavía. Cada título aparece también en la vitrina física de tu Sala de trofeos.", { TextSize = 13, TextColor3 = Theme.TextMuted }).Parent = trophies
	end
	for i = #h.trophies, 1, -1 do
		local tr = h.trophies[i]
		C.Label(string.format("%s %s · temporada %d", tr.kind == "cup" and "🥇" or "🏆", tr.name, tr.season), { TextSize = 14 }).Parent = trophies
	end
	add(trophies)
end

local function renderSeasons(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local seasons = state.clubHistory.seasons
	if #seasons == 0 then
		add(C.Label("Aún no ha terminado ninguna temporada de liga.", { TextColor3 = Theme.TextMuted }))
	end
	for i = #seasons, 1, -1 do
		local s = seasons[i]
		local tags = {}
		if s.champion then
			table.insert(tags, "🏆 Campeón")
		end
		if s.promoted then
			table.insert(tags, "⬆️ Ascenso")
		end
		if s.relegated then
			table.insert(tags, "⬇️ Descenso")
		end
		add(C.Card({}, {
			C.Title(string.format("Temporada %d · %s", s.season, s.divisionName), 16),
			C.Label(string.format("<b>%dº</b> · %d pts · %d-%d-%d · %d:%d · Copa: %s %s", s.position, s.points, s.w, s.d, s.l, s.gf, s.ga, tostring(s.cup),
				table.concat(tags, " · ")), { TextSize = 14 }),
			C.Label(string.format("⚽ Máximo goleador: %s · 🎯 Mejor asistente: %s",
				s.topScorer and (s.topScorer.name .. " (" .. s.topScorer.goals .. ")") or "—",
				s.topAssist and (s.topAssist.name .. " (" .. s.topAssist.assists .. ")") or "—"), { TextSize = 13, TextColor3 = Theme.TextDim }),
		}))
	end
end

local function leaderboard(ctx, title, list, unit)
	local C, Theme = ctx.C, ctx.Theme
	local card = C.Card({}, { C.Title(title, 18) })
	if #list == 0 then
		C.Label("Sin datos todavía.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = card
	end
	for i, e in ipairs(list) do
		C.Label(string.format("%d. <b>%s</b> (%s%s) · %d %s", i, e.name, e.pos, e.origin == "academy" and ", canterano" or "", e.value, unit), { TextSize = 14 }).Parent = card
	end
	return card
end

local function renderPlayers(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local h = state.clubHistory
	add(leaderboard(ctx, "⚽ Máximos goleadores de la historia", h.topScorers, "goles"))
	add(leaderboard(ctx, "🎯 Máximos asistentes", h.topAssists, "asistencias"))
	add(leaderboard(ctx, "👕 Más partidos", h.topApps, "partidos"))
	local legends = C.Card({}, { C.Title("🏛️ Jugadores legendarios", 18) })
	if #h.legends == 0 then
		C.Label("Todavía no hay leyendas retiradas.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = legends
	end
	for i = #h.legends, 1, -1 do
		local l = h.legends[i]
		C.Label(string.format("🏅 <b>%s</b> · media máx. %d · %d partidos · %d goles · %s · retirado en la T%d", l.name, l.peak, l.apps or 0, l.goals or 0,
			l.origin == "academy" and "canterano" or "fichaje", l.retiredSeason), { TextSize = 13 }).Parent = legends
	end
	add(legends)
end

local function renderRecords(add, ctx)
	local C, Format, state = ctx.C, ctx.Format, ctx.state
	local r = state.clubHistory.records
	local function line(label, value)
		return C.Label(string.format("%s: <b>%s</b>", label, value), { TextSize = 14 })
	end
	add(C.Card({}, {
		C.Title("🏅 Récords del club", 18),
		line("Mayor victoria", r.biggestWin and string.format("%d-%d contra %s (T%d)", r.biggestWin.gf, r.biggestWin.ga, r.biggestWin.opponent, r.biggestWin.season) or "—"),
		line("Peor derrota", r.worstDefeat and string.format("%d-%d contra %s (T%d)", r.worstDefeat.gf, r.worstDefeat.ga, r.worstDefeat.opponent, r.worstDefeat.season) or "—"),
		line("Mejor racha invicta", tostring(r.unbeatenBest or 0) .. " partidos"),
		line("Más puntos en una temporada", r.bestSeasonPoints and string.format("%d (T%d, %s)", r.bestSeasonPoints.points, r.bestSeasonPoints.season, r.bestSeasonPoints.division) or "—"),
		line("Más goles de un jugador en una temporada", r.mostGoalsSeason and string.format("%s, %d (T%d)", r.mostGoalsSeason.name, r.mostGoalsSeason.goals, r.mostGoalsSeason.season) or "—"),
		line("Fichaje más caro", r.biggestSigning and string.format("%s por %s (T%d)", r.biggestSigning.name, Format.Money(r.biggestSigning.fee), r.biggestSigning.season) or "—"),
		line("Venta más cara", r.biggestSale and string.format("%s a %s por %s (T%d)", r.biggestSale.name, r.biggestSale.club, Format.Money(r.biggestSale.fee), r.biggestSale.season) or "—"),
		line("Reputación máxima", r.highestReputation and string.format("%d (T%d)", r.highestReputation.value, r.highestReputation.season) or "—"),
	}))
end

local function renderTimeline(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local timeline = state.clubHistory.timeline
	local card = C.Card({}, { C.Title("🕰️ Cronología", 18) })
	if #timeline == 0 then
		C.Label("Los acontecimientos importantes del club aparecerán aquí.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = card
	end
	for _, e in ipairs(timeline) do
		C.Label(string.format("<font color='#8C9BB4'>%s</font>  %s %s", os.date("%d/%m %H:%M", e.t or 0), e.icon, e.text), { TextSize = 13 }).Parent = card
	end
	add(card)
end

function History.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "summary"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("📜 Historia del club", 26))
	local tabs = {
		{ id = "summary", label = "Resumen" },
		{ id = "seasons", label = "Temporadas" },
		{ id = "players", label = "Jugadores" },
		{ id = "records", label = "Récords" },
		{ id = "timeline", label = "Cronología" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("history", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	if tab == "seasons" then
		renderSeasons(add, ctx)
	elseif tab == "players" then
		renderPlayers(add, ctx)
	elseif tab == "records" then
		renderRecords(add, ctx)
	elseif tab == "timeline" then
		renderTimeline(add, ctx)
	else
		renderSummary(add, ctx)
	end
end

return History
