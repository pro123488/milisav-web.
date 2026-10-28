-- Leagues (ModuleScript) · Pantalla "Ligas" (FASE 7)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Leagues
-- Pestañas: Clasificación · Calendario · Copa · Carrera (objetivos, temporadas y palmarés).

local Leagues = {}

local function renderTable(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local lg = state.league
	if not lg.started then
		add(C.Card({ BackgroundColor3 = Theme.Panel }, {
			C.Label(string.format("📅 Tu club debuta en <b>%s</b> la temporada %d. La liga empieza con la próxima temporada; mientras tanto puedes jugar amistosos.",
				lg.divisionName, lg.season), { TextSize = 14 }),
		}))
	end
	local card = C.Card({}, {
		C.Row({
			C.Title(string.format("🏆 %s · Temporada %d", lg.divisionName, lg.season), 18),
			C.Badge(string.format("División %d de %d", lg.division, lg.divisions), Theme.Panel, Theme.TextDim),
		}, 10),
		C.Label(string.format("Ascienden los %d primeros · descienden los %d últimos · 3 puntos por victoria.",
			lg.promote, lg.relegate), { TextSize = 13, TextColor3 = Theme.TextDim }),
	})
	local header = C.Label("<b>#  Equipo</b>", { TextSize = 13, TextColor3 = Theme.TextDim })
	header.Parent = card
	for _, r in ipairs(lg.standings) do
		local zone = ""
		if lg.promote > 0 and r.position <= lg.promote then
			zone = "⬆️"
		elseif lg.relegate > 0 and r.position > #lg.standings - lg.relegate then
			zone = "⬇️"
		end
		local row = C.New("Frame", {
			BackgroundColor3 = r.isUser and Theme.AccentDark or Theme.Panel,
			BackgroundTransparency = r.isUser and 0.2 or 0.6,
			Size = UDim2.new(1, 0, 0, 26),
			Children = { C.Corner(Theme.RadiusSmall) },
		})
		C.Label(string.format(" %d %s <b>%s</b> <font color='#8C9BB4'>(media %s)</font>", r.position, zone, r.name, tostring(r.strength or "?")), {
			Size = UDim2.new(0.58, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13, TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false,
		}).Parent = row
		C.Label(string.format("%d PJ · %d-%d-%d · %d:%d · <b>%d pts</b> · %s", r.p, r.w, r.d, r.l, r.gf, r.ga, r.pts, table.concat(r.form, "")), {
			Position = UDim2.fromScale(0.58, 0), Size = UDim2.new(0.42, -6, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
			TextXAlignment = Enum.TextXAlignment.Right, TextSize = 12, TextWrapped = false,
		}).Parent = row
		row.Parent = card
	end
	add(card)
end

local function renderCalendar(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local lg = state.league
	add(C.Label(string.format("Los partidos de liga se simulan automáticamente en cada jornada (cada %s) con tu alineación y tu táctica.",
		Format.Duration(state.economy.cycleSeconds)), { TextColor3 = Theme.TextDim, TextSize = 13 }))
	local card = C.Card({}, { C.Title("📅 Tus partidos de liga", 18) })
	for _, f in ipairs(lg.fixtures) do
		local played = f.hg ~= nil
		local text
		if played then
			local us = f.home and f.hg or f.ag
			local them = f.home and f.ag or f.hg
			local icon = us > them and "✅" or (us == them and "➖" or "❌")
			text = string.format("%s J%d · %s <b>%d - %d</b> %s", icon, f.round, f.homeShort, f.hg, f.ag, f.awayShort)
		else
			local inCycles = f.cycle - lg.cycle
			text = string.format("🕒 J%d · %s vs %s · %s · %s", f.round, f.homeName, f.awayName, f.home and "en casa" or "fuera",
				(lg.started and inCycles >= 0) and (inCycles == 0 and "esta jornada" or ("en " .. inCycles .. " jornada(s)")) or "próxima temporada")
		end
		C.Label(text, { TextSize = 14, TextColor3 = played and Theme.Text or Theme.TextDim }).Parent = card
	end
	add(card)
end

local function renderCup(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local cup = state.league.cup
	local status = cup.champion and "🏆 ¡Campeón!" or (cup.alive and "✅ Sigues en competición" or ("❌ Eliminado en " .. tostring(cup.eliminatedIn)))
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("🏆 " .. cup.name, 20),
		C.Label(string.format("16 equipos · eliminatoria a partido único (penaltis si hay empate) · rondas en las jornadas %s de la temporada.",
			table.concat(cup.cycles, ", ")), { TextSize = 13, TextColor3 = Theme.TextDim }),
		C.Label(status, { TextSize = 15 }),
	}))
	for index, name in ipairs(cup.roundNames) do
		local round = cup.rounds[index]
		local card = C.Card({}, { C.Title(name, 16) })
		if not round then
			C.Label("Por disputar.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = card
		else
			for _, m in ipairs(round.matches) do
				C.Label(string.format("%s%s %d - %d %s%s", m.user and (m.userWon and "✅ " or "❌ ") or "", m.home, m.hg, m.ag, m.away,
					m.penalties and " (penaltis)" or ""), { TextSize = 13, TextColor3 = m.user and Theme.Text or Theme.TextDim }).Parent = card
			end
		end
		add(card)
	end
end

local function renderCareer(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local lg = state.league
	local confidenceColor = lg.boardConfidence >= 60 and Theme.Accent or (lg.boardConfidence >= 30 and Theme.Warning or Theme.Danger)
	add(C.Card({}, {
		C.Title("🎯 Objetivo de la junta directiva", 18),
		C.Label(string.format("<b>%s</b> (vuestra plantilla es la %dª más fuerte de la liga).", lg.objective and lg.objective.text or "—",
			lg.objective and lg.objective.expectedRank or 0), { TextSize = 15 }),
		C.Label(string.format("Confianza de la junta: %d / 100", lg.boardConfidence), { TextSize = 14 }),
		C.ProgressBar(lg.boardConfidence / 100, confidenceColor, 10),
		C.Label("Cumplir el objetivo da un premio y más confianza; fallarlo, la reduce.", { TextSize = 13, TextColor3 = Theme.TextDim }),
	}))

	local trophies = C.Card({}, { C.Title(string.format("🏆 Palmarés (%d)", #lg.trophies), 18) })
	if #lg.trophies == 0 then
		C.Label("Todavía no hay títulos. ¡Gana la liga o la copa!", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = trophies
	end
	for i = #lg.trophies, 1, -1 do
		local t = lg.trophies[i]
		C.Label(string.format("%s %s · temporada %d", t.kind == "cup" and "🥇" or "🏆", t.name, t.season), { TextSize = 14 }).Parent = trophies
	end
	add(trophies)

	local seasons = C.Card({}, { C.Title("📈 Temporadas", 18) })
	if #lg.history == 0 then
		C.Label("Aún no ha terminado ninguna temporada.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = seasons
	end
	for i = #lg.history, 1, -1 do
		local h = lg.history[i]
		local tags = {}
		if h.champion then
			table.insert(tags, "🏆 campeón")
		end
		if h.promoted then
			table.insert(tags, "⬆️ ascenso")
		end
		if h.relegated then
			table.insert(tags, "⬇️ descenso")
		end
		table.insert(tags, "copa: " .. tostring(h.cup))
		table.insert(tags, h.objectiveMet and "objetivo ✅" or "objetivo ❌")
		C.Label(string.format("T%d · %s · <b>%dº</b> · %d pts (%d-%d-%d, %d:%d) · %s", h.season, h.divisionName, h.position, h.points,
			h.w, h.d, h.l, h.gf, h.ga, table.concat(tags, " · ")), { TextSize = 13 }).Parent = seasons
	end
	add(seasons)
end

function Leagues.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "table"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("🏆 Ligas y modo carrera", 26))
	local tabs = {
		{ id = "table", label = "Clasificación" },
		{ id = "calendar", label = "Calendario" },
		{ id = "cup", label = "Copa" },
		{ id = "career", label = "Carrera" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("leagues", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	if tab == "calendar" then
		renderCalendar(add, ctx)
	elseif tab == "cup" then
		renderCup(add, ctx)
	elseif tab == "career" then
		renderCareer(add, ctx)
	else
		renderTable(add, ctx)
	end
end

return Leagues
