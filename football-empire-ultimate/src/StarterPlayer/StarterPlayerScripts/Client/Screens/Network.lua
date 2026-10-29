-- Network (ModuleScript) · Pantalla "Red de clubes" (FASE 9)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Network
-- Pestañas: Amigos · Torneo · Comunidad · Enfrentamientos · Comparar.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local NetworkConfig = require(Shared.Config.NetworkConfig)

local UI = script.Parent.Parent:WaitForChild("UI")
local MatchViewer = require(UI.MatchViewer)

local Network = {}

-- Botones de acción sobre otro club (los usan otras pantallas, como Universo)
function Network.ClubActions(ctx, club)
	local C = ctx.C
	local buttons = {}
	if club.inServer and not club.isMe then
		table.insert(buttons, C.Button("⚽ Invitar", "primary", function()
			ctx.act("InviteMatch", { userId = club.userId })
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
	end
	if not club.isMe then
		table.insert(buttons, C.Button("⚔️ Retar", "secondary", function()
			local result = ctx.act("ChallengeClub", { userId = club.userId })
			if result.ok and result.data then
				MatchViewer.Show(result.data)
			end
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
		table.insert(buttons, C.Button("📊 Comparar", "secondary", function()
			local result = ctx.act("CompareClub", { userId = club.userId })
			if result.ok and result.data then
				ctx.comparison = result.data
				ctx.navigate("network", { tab = "compare" })
			end
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
	end
	return C.Row(buttons, 6)
end

local function renderFriends(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local friends = state.network.friends
	local metric = ctx.params.metric or "reputation"
	local metrics = {
		{ id = "reputation", label = "⭐ Reputación" },
		{ id = "value", label = "🏦 Valor" },
		{ id = "titles", label = "🏆 Títulos" },
		{ id = "networkPoints", label = "🤝 Puntos de red" },
	}
	local buttons = {}
	for _, m in ipairs(metrics) do
		table.insert(buttons, C.Button(m.label, metric == m.id and "primary" or "secondary", function()
			ctx.navigate("network", { tab = "friends", metric = m.id })
		end, { Size = UDim2.new(0, 0, 0, 30), TextSize = 13 }))
	end
	table.insert(buttons, C.Button("🔄", "secondary", function()
		ctx.act("RefreshFriends")
	end, { Size = UDim2.new(0, 40, 0, 30), AutomaticSize = Enum.AutomaticSize.None }))
	add(C.Row(buttons, 6))
	if not friends then
		add(C.Label("Cargando tus amigos de Roblox…", { TextColor3 = Theme.TextMuted }))
		return
	end
	if #friends <= 1 then
		add(C.Label("Ninguno de tus amigos de Roblox tiene club todavía (o el universo no está disponible). ¡Invítalos a jugar!", { TextColor3 = Theme.TextMuted, TextSize = 13 }))
	end
	local sorted = table.clone(friends)
	table.sort(sorted, function(a, b)
		return (a[metric] or 0) > (b[metric] or 0)
	end)
	for i, club in ipairs(sorted) do
		local value = metric == "value" and Format.Money(club.value or 0) or tostring(club[metric] or 0)
		local card = C.Card({ BackgroundColor3 = club.isMe and Theme.AccentDark or Theme.Card }, {
			C.Label(string.format("%d. %s <b>%s</b> · %s%s · <b>%s</b>", i, club.crest or "⚽", club.clubName or "?", club.ownerName or "?",
				club.inServer and " · 🟢 en este servidor" or "", value), { TextSize = 14 }),
		})
		if not club.isMe then
			Network.ClubActions(ctx, club).Parent = card
		end
		add(card)
	end
end

local function renderTournament(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local t = state.tournament
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("🏆 " .. NetworkConfig.TOURNAMENT_NAME, 20),
		C.Label(string.format("Torneos del servidor de 4 u 8 clubes. Inscripción abierta %d s; los huecos se completan con clubes ficticios. "
			.. "El campeón gana trofeo y premio solo si participan al menos 2 clubes humanos.", NetworkConfig.TOURNAMENT_JOIN_SECONDS),
			{ TextSize = 13, TextColor3 = Theme.TextDim }),
	}))
	if not t or t.status == "done" then
		if t and t.champion then
			add(C.Label("🏆 Último campeón: <b>" .. t.champion .. "</b>", { TextSize = 15 }))
		end
		local buttons = {}
		for _, size in ipairs(NetworkConfig.TOURNAMENT_SIZES) do
			table.insert(buttons, C.Button(string.format("Crear torneo de %d", size), "primary", function()
				ctx.act("CreateTournament", { size = size })
			end))
		end
		add(C.Row(buttons, 8))
	elseif t.status == "open" then
		local join = C.Button(t.joined and "✔ Inscrito" or "Apuntarme", "primary", function()
			ctx.act("JoinTournament")
		end)
		C.SetEnabled(join, not t.joined and #t.entrants < t.size)
		add(C.Card({}, {
			C.Label(string.format("Torneo de %d creado por %s · inscripción: %d/%d · empieza en %d s", t.size, t.creator, #t.entrants, t.size, t.secondsLeft), { TextSize = 15 }),
			join,
		}))
	end
	if t then
		local entrants = C.Card({}, { C.Title("Participantes", 16) })
		for _, e in ipairs(t.entrants) do
			C.Label(string.format("%s %s · media %d", e.human and "🧑" or "🤖", e.name, e.strength), { TextSize = 13 }).Parent = entrants
		end
		add(entrants)
		for _, round in ipairs(t.rounds) do
			local card = C.Card({}, { C.Title(round.name, 16) })
			for _, line in ipairs(round.lines) do
				C.Label(line, { TextSize = 13 }).Parent = card
			end
			add(card)
		end
	end
end

local function renderCommunity(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local c = state.community
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label("OBJETIVO COMUNITARIO DE ESTE SERVIDOR", { TextColor3 = Theme.Accent, Font = Theme.FontBold, TextSize = 13 }),
		C.Title("🤝 " .. c.text, 20),
		C.ProgressBar(c.progress / math.max(1, c.target), c.completed and Theme.Gold or Theme.Accent, 14),
		C.Label(string.format("%d / %d%s · recompensa %s para quienes contribuyan · nuevo objetivo en %s",
			c.progress, c.target, c.completed and " · ✅ ¡Cumplido!" or "", Format.Money(c.reward), Format.Duration(c.secondsLeft)), { TextSize = 14 }),
		C.Label(c.contributed and "✅ Has contribuido a este objetivo." or "Juega partidos (liga, copa, amistosos, retos o torneos) para contribuir.",
			{ TextSize = 13, TextColor3 = Theme.TextDim }),
	}))
end

local function renderH2H(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local list = state.network.h2h
	add(C.Label(string.format("🤝 Puntos de red: <b>%d</b> · Retos disponibles hoy: <b>%d</b>", state.network.points, state.network.challengesLeft), { TextSize = 15 }))
	local card = C.Card({}, { C.Title("⚔️ Historial de enfrentamientos", 18) })
	if #list == 0 then
		C.Label("Todavía no te has enfrentado a otros clubes. Invita a alguien del servidor o reta a un club del universo.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = card
	end
	for _, h in ipairs(list) do
		C.Label(string.format("<b>%s</b> · %dV %dE %dD · goles %d:%d%s", h.name, h.w, h.d, h.l, h.gf, h.ga,
			h.last and string.format(" · último: %d-%d (%s)", h.last.gf, h.last.ga, tostring(h.last.kind)) or ""), { TextSize = 14 }).Parent = card
	end
	add(card)
end

local function renderCompare(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local cmp = ctx.comparison
	if not cmp then
		add(C.Label("Elige un club en Universo › Directorio o en tus Amigos y pulsa «Comparar».", { TextColor3 = Theme.TextMuted }))
		return
	end
	local me, other = cmp.me, cmp.other
	local rows = {
		{ "⭐ Reputación", me.reputation, other.reputation },
		{ "🏦 Valor", me.value, other.value, true },
		{ "🏆 Títulos", me.titles, other.titles },
		{ "👥 Aficionados", me.fans, other.fans },
		{ "🏟️ Etapa del estadio", me.stage, other.stage },
		{ "📊 División", me.division, other.division },
		{ "⚽ Media del once", me.strength, other.strength },
		{ "🤝 Puntos de red", me.networkPoints, other.networkPoints },
	}
	local card = C.Card({}, {
		C.Title(string.format("%s %s  vs  %s %s", me.crest or "", me.clubName or "", other.crest or "", other.clubName or ""), 18),
		C.Label("Solo datos públicos de cada club.", { TextSize = 12, TextColor3 = Theme.TextMuted }),
	})
	for _, r in ipairs(rows) do
		local a, b = tonumber(r[2]) or 0, tonumber(r[3]) or 0
		local fa = r[4] and Format.Money(a) or tostring(a)
		local fb = r[4] and Format.Money(b) or tostring(b)
		C.Label(string.format("%s: <b>%s</b>%s  ·  <b>%s</b>%s", r[1], fa, a > b and " ✅" or "", fb, b > a and " ✅" or ""), { TextSize = 14 }).Parent = card
	end
	local h = cmp.h2h
	C.Label(h and string.format("⚔️ Cara a cara: %dV %dE %dD (goles %d:%d)", h.w, h.d, h.l, h.gf, h.ga) or "⚔️ Todavía no os habéis enfrentado.", { TextSize = 14 }).Parent = card
	add(card)
	other.isMe = false
	add(Network.ClubActions(ctx, other))
end

function Network.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "friends"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("🤝 Red de clubes", 26))
	local tabs = {
		{ id = "friends", label = "Amigos" },
		{ id = "tournament", label = "Torneo" },
		{ id = "community", label = "Comunidad" },
		{ id = "h2h", label = "Enfrentamientos" },
		{ id = "compare", label = "Comparar" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("network", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	if tab == "tournament" then
		renderTournament(add, ctx)
	elseif tab == "community" then
		renderCommunity(add, ctx)
	elseif tab == "h2h" then
		renderH2H(add, ctx)
	elseif tab == "compare" then
		renderCompare(add, ctx)
	else
		renderFriends(add, ctx)
	end
end

return Network
