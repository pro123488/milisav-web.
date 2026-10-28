-- Academy (ModuleScript) · Pantalla "Academia" · CANTERA GENERACIONAL (FASE 4)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Academy

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FootballConfig = require(Shared.Config.FootballConfig)

local Squad = require(script.Parent.Squad)

local Academy = {}

function Academy.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local football = state.football
	local academy = football.academy
	local levelData = FootballConfig.Academy(academy.level)
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Title("🧬 Cantera generacional", 26))

	local remaining = football.season.length - football.season.cycle
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label(string.format("<b>Academia juvenil nivel %d</b>%s", academy.level, academy.level == 0 and " (cantera básica)" or ""), { TextSize = 16 }),
		C.Label(string.format("Plazas %d/%d · %d juvenil(es) por hornada · evolución ×%.2f · potencial base %d-%d",
			#academy.youths, academy.capacity, academy.intake, levelData.growth, levelData.potentialMin, levelData.potentialMax), { TextSize = 14 }),
		C.Label(string.format("Próxima hornada al final de la temporada: dentro de %d jornada(s). Con %d años los juveniles dejan la academia si no suben al primer equipo.",
			remaining, FootballConfig.YOUTH_MAX_AGE + 1), { TextColor3 = Theme.TextDim, TextSize = 13 }),
		C.Button("Mejorar la Academia juvenil", "secondary", function()
			ctx.navigate("build")
		end),
	}))

	-- Ojeadores
	local err = FootballConfig.SCOUT_ERROR[academy.scouts]
	local scoutCard = C.Card({}, {
		C.Title(string.format("🔎 Ojeadores: %d / %d", academy.scouts, FootballConfig.MAX_SCOUTS), 18),
		C.Label(string.format("Coste: %s por jornada. Potencial estimado con margen de ±%d. +%d al potencial de la cantera y más probabilidad de joyas. "
			.. "Cada %d jornadas traen un informe con juveniles que puedes fichar%s.",
			Format.Money(FootballConfig.SCOUT_COSTS[academy.scouts] or 0), err, academy.scouts * FootballConfig.SCOUT_POTENTIAL_BONUS,
			FootballConfig.SCOUT_REPORT_CYCLES, academy.scouts > 0 and string.format(" (próximo en %d)", academy.nextReportIn) or ""),
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	local minus = C.Button("− Despedir", "secondary", function()
		ctx.act("SetScouts", { count = academy.scouts - 1 })
	end)
	local plus = C.Button(string.format("+ Contratar (%s/jornada)", Format.Money(FootballConfig.SCOUT_COSTS[math.min(FootballConfig.MAX_SCOUTS, academy.scouts + 1)] or 0)), "primary", function()
		ctx.act("SetScouts", { count = academy.scouts + 1 })
	end)
	C.SetEnabled(minus, academy.scouts > 0)
	C.SetEnabled(plus, academy.scouts < FootballConfig.MAX_SCOUTS)
	C.Row({ minus, plus }, 8).Parent = scoutCard
	add(scoutCard)

	-- Juveniles
	add(C.Title(string.format("👦 Juveniles (%d)", #academy.youths), 20))
	if #academy.youths == 0 then
		add(C.Label("La academia está vacía. Llegarán juveniles al final de la temporada.", { TextColor3 = Theme.TextMuted }))
	end
	for _, y in ipairs(academy.youths) do
		local expanded = ctx.params.selected == y.id
		add(Squad.PlayerCard(ctx, y, {
			expanded = expanded,
			onToggle = function()
				ctx.navigate("academy", { selected = (not expanded) and y.id or nil })
			end,
			actions = function(card)
				local promote = C.Button("⬆️ Subir al primer equipo", "primary", function()
					ctx.act("PromoteYouth", { id = y.id })
				end)
				C.SetEnabled(promote, y.age >= FootballConfig.YOUTH_MIN_PROMOTE_AGE and #football.squad < FootballConfig.MAX_SQUAD)
				local release = C.Button("Liberar", "danger", function()
					ctx.act("ReleaseYouth", { id = y.id })
				end)
				C.Row({ promote, release }, 8).Parent = card
				if y.age < FootballConfig.YOUTH_MIN_PROMOTE_AGE then
					C.Label(string.format("Podrá subir al primer equipo con %d años.", FootballConfig.YOUTH_MIN_PROMOTE_AGE), { TextSize = 13, TextColor3 = Theme.TextDim }).Parent = card
				end
			end,
		}))
	end

	-- Informes de ojeadores
	if academy.scouts > 0 then
		local reports = C.Card({}, { C.Title("📋 Informe de los ojeadores", 18) })
		if #academy.reports == 0 then
			C.Label("Sin candidatos todavía. El informe llega en la próxima jornada.", { TextColor3 = Theme.TextMuted }).Parent = reports
		end
		for _, r in ipairs(academy.reports) do
			local pos = FootballConfig.Position(r.pos)
			local sign = C.Button("Fichar · " .. Format.Money(r.signFee or 0), "primary", function()
				ctx.act("SignYouthReport", { id = r.id })
			end, { Size = UDim2.new(0, 160, 0, 34), AutomaticSize = Enum.AutomaticSize.None })
			C.SetEnabled(sign, #academy.youths < academy.capacity and state.economy.money >= (r.signFee or 0))
			C.Row({
				C.Label(string.format("<b>%s</b>%s · %s %s · %d años · media %d · potencial %d-%d",
					r.name, r.star and " ⭐" or "", pos.icon, pos.short, r.age, r.ovr, r.potentialLow, r.potentialHigh),
					{ Size = UDim2.new(1, -180, 0, 0), TextSize = 14 }),
				sign,
			}).Parent = reports
		end
		add(reports)
	end

	-- Leyendas
	local legends = C.Card({}, {
		C.Title("🏛️ Jugadores legendarios", 18),
		C.Label(string.format("Canteranos que han subido al primer equipo: %d", football.graduates), { TextSize = 14 }),
	})
	if #football.legends == 0 then
		C.Label("Todavía no hay leyendas. Los jugadores que se retiren tras una gran carrera aparecerán aquí.", { TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = legends
	end
	for i = #football.legends, 1, -1 do
		local l = football.legends[i]
		local pos = FootballConfig.Position(l.pos)
		C.Label(string.format("🏅 <b>%s</b> · %s · media máx. %d · %d temporadas · %s · retirado en la temporada %d",
			l.name, pos.short, l.peak, l.seasons, l.origin == "academy" and "canterano" or "fichaje", l.retiredSeason), { TextSize = 14 }).Parent = legends
	end
	add(legends)
end

return Academy
