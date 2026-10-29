-- Universe (ModuleScript) · Pantalla "Universo" (FASE 8)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Universe
-- Pestañas: Evento · Rankings · Semanal · Directorio.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UniverseConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.UniverseConfig)
local Network = require(script.Parent.Network)

local Universe = {}

local function duration(seconds)
	seconds = math.max(0, math.floor(seconds))
	local d = math.floor(seconds / 86400)
	local h = math.floor((seconds % 86400) / 3600)
	local m = math.floor((seconds % 3600) / 60)
	if d > 0 then
		return string.format("%dd %dh", d, h)
	end
	return string.format("%dh %02dm", h, m)
end

local function offlineNotice(add, ctx)
	local C = ctx.C
	if not ctx.state.universe.online then
		add(C.Card({ BackgroundColor3 = Color3.fromRGB(70, 45, 10) }, {
			C.Label("🌐 <b>Universo sin conexión.</b> No se puede acceder a DataStore (en Studio: publica el juego y activa API Services). Se ven los clubes de este servidor; los rankings globales se reintentan automáticamente.",
				{ TextSize = 13 }),
		}))
	end
end

local function renderEvent(add, ctx)
	local C, Theme = ctx.C, ctx.Theme
	local ev = ctx.state.universe.event
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label("EVENTO ACTIVO EN TODO EL UNIVERSO", { TextColor3 = Theme.Accent, Font = Theme.FontBold, TextSize = 13 }),
		C.Title(ev.icon .. " " .. ev.name, 24),
		C.Label(ev.description, { TextSize = 15 }),
		C.Label("Termina en " .. duration(ev.secondsLeft - (os.clock() - ctx.stateReceivedAt)), { TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))
	local list = C.Card({}, { C.Title("📅 Eventos que rotan", 18), C.Label(string.format("Cada evento dura %d horas y es el mismo en todos los servidores.", UniverseConfig.EVENT_HOURS), { TextSize = 13, TextColor3 = Theme.TextDim }) })
	for _, e in ipairs(UniverseConfig.Events) do
		C.Label(string.format("%s <b>%s</b> · %s", e.icon, e.name, e.description), { TextSize = 13, TextColor3 = e.id == ev.id and Theme.Gold or Theme.Text }).Parent = list
	end
	add(list)
end

local function renderRankings(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local which = ctx.params.ranking or "reputation"
	local buttons = {}
	for _, r in ipairs(UniverseConfig.RANKINGS) do
		table.insert(buttons, C.Button(r.icon .. " " .. r.name, which == r.id and "primary" or "secondary", function()
			ctx.navigate("universe", { tab = "rankings", ranking = r.id })
		end))
	end
	add(C.Row(buttons, 6))
	local entries = ctx.state.universe.rankings[which] or {}
	local card = C.Card({}, { C.Title("🌍 Clasificación global", 18) })
	if #entries == 0 then
		C.Label("Sin datos todavía. Los clubes publican su perfil cada 5 minutos.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = card
	end
	for _, e in ipairs(entries) do
		local value = which == "value" and Format.Money(e.value) or Format.Thousands(e.value)
		C.Label(string.format("%s%d. %s <b>%s</b> · %s · %s", e.userId == game:GetService("Players").LocalPlayer.UserId and "👉 " or "",
			e.rank, e.crest, e.clubName, e.ownerName, value), { TextSize = 14 }).Parent = card
		if e.userId and e.userId ~= game:GetService("Players").LocalPlayer.UserId then
			Network.ClubActions(ctx, { userId = e.userId, clubName = e.clubName }).Parent = card
		end
	end
	add(card)
end

local function renderWeekly(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local weekly = ctx.state.universe.weekly
	local pts = UniverseConfig.WeeklyPoints
	local info = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("⚔️ Competición semanal del universo", 20),
		C.Label(string.format("Todos los clubes compiten a la vez. Puntos: victoria de liga %d, empate %d, ronda de copa %d, título %d.",
			pts.win, pts.draw, pts.cupRound, pts.title), { TextSize = 13, TextColor3 = Theme.TextDim }),
		C.Label(string.format("Tus puntos esta semana: <b>%d</b> · Termina en %s", weekly.myPoints, duration(weekly.secondsLeft)), { TextSize = 15 }),
	})
	for _, reward in ipairs(UniverseConfig.WeeklyRewards) do
		C.Label(string.format("%s (hasta el puesto %d): %s y +%d de reputación", reward.label, reward.maxRank, Format.Money(reward.money), reward.reputation),
			{ TextSize = 13 }).Parent = info
	end
	C.Label("Las recompensas se entregan automáticamente al entrar durante la semana siguiente.", { TextSize = 12, TextColor3 = Theme.TextMuted }).Parent = info
	add(info)
	local top = C.Card({}, { C.Title("🏅 Top 10 de la semana", 18) })
	if #weekly.top == 0 then
		C.Label("Todavía no hay puntuaciones esta semana.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = top
	end
	for _, e in ipairs(weekly.top) do
		C.Label(string.format("%d. %s <b>%s</b> · %d pts", e.rank, e.crest, e.clubName, e.value), { TextSize = 14 }).Parent = top
	end
	add(top)
end

local function renderDirectory(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local directory = ctx.state.universe.directory
	add(C.Label("Clubes conectados en este servidor. Puedes visitar sus estadios: como visitante no puedes modificar nada ni ver sus datos privados.",
		{ TextColor3 = Theme.TextDim, TextSize = 13 }))
	for _, club in ipairs(directory) do
		local visit = C.Button(club.isMe and "Tu club" or "🏟️ Visitar estadio", "secondary", function()
			ctx.act("VisitClub", { userId = club.userId })
			ctx.close()
		end, { Size = UDim2.new(0, 160, 0, 34), AutomaticSize = Enum.AutomaticSize.None })
		C.SetEnabled(visit, not club.isMe)
		add(C.Card({}, {
			C.Row({
				C.Label(string.format("%s <b>%s</b>%s · %s", club.crest, club.clubName, club.vip and " 👑" or "", club.ownerName), { Size = UDim2.new(1, -180, 0, 0), TextSize = 15 }),
				visit,
			}),
			C.Label(string.format("⭐ %d · 🏦 %s · 🏆 %d · 👥 %s · 🏟️ %s · División %d", club.reputation, Format.Money(club.value), club.titles,
				Format.Short(club.fans), club.stageName, club.division), { TextSize = 13, TextColor3 = Theme.TextDim }),
			Network.ClubActions(ctx, club),
		}))
	end
end

function Universe.Render(container, ctx)
	local C = ctx.C
	local tab = ctx.params.tab or "event"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("🌎 Universo futbolístico", 26))
	local tabs = {
		{ id = "event", label = "Evento" },
		{ id = "rankings", label = "Rankings" },
		{ id = "weekly", label = "Semanal" },
		{ id = "directory", label = "Directorio" },
	}
	local buttons = {}
	for _, t in ipairs(tabs) do
		table.insert(buttons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("universe", { tab = t.id })
		end))
	end
	add(C.Row(buttons, 8))
	offlineNotice(add, ctx)
	if tab == "rankings" then
		renderRankings(add, ctx)
	elseif tab == "weekly" then
		renderWeekly(add, ctx)
	elseif tab == "directory" then
		renderDirectory(add, ctx)
	else
		renderEvent(add, ctx)
	end
end

return Universe
