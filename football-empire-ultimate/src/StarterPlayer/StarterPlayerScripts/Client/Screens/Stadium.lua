-- Stadium (ModuleScript) · Pantalla "Mi estadio"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Stadium
-- Resumen del estadio: etapa evolutiva, aforo, atractivo e instalaciones.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FacilityConfig = require(Shared.Config.FacilityConfig)
local StadiumStages = require(Shared.Config.StadiumStages)

local Stadium = {}

function Stadium.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🏟️ Mi estadio", 26),
		C.Button("📍 Ir a mi estadio", "primary", function()
			ctx.act("TeleportHome")
			ctx.close()
		end),
	}, 16))

	-- Etapa evolutiva
	local stageCard = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label("ETAPA " .. state.stadium.stage .. " DE " .. #StadiumStages, { TextColor3 = Theme.Accent, Font = Theme.FontBold, TextSize = 13 }),
		C.Title(state.stadium.stageName, 24),
		C.Label(state.stadium.stageDescription, { TextColor3 = Theme.TextDim }),
	})
	local track = C.Row({}, 6)
	for i, stage in ipairs(StadiumStages) do
		local reached = i <= state.stadium.stage
		local badge = C.Badge(string.format("%d · %s", i, stage.name), reached and Theme.AccentDark or Theme.Locked,
			reached and Theme.Text or Theme.TextMuted)
		badge.LayoutOrder = i
		badge.Parent = track
	end
	track.Parent = stageCard
	C.Label("El ascenso a las siguientes etapas (con costes, requisitos y nuevas instalaciones) se implementa en la FASE 2: ESTADIO EVOLUTIVO.",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }).Parent = stageCard
	add(stageCard)

	-- Métricas
	local eco = state.economy
	local f = eco.forecast
	local grid = C.Grid(200, 78, 10)
	add(grid)
	local stats = {
		{ "🪑", "Aforo", Format.Thousands(f.capacity) },
		{ "🎟️", "Asistencia prevista", Format.Thousands(f.attendance) },
		{ "✨", "Atractivo", Format.Percent(f.attractiveness) },
		{ "👥", "Aficionados / techo", Format.Short(state.club.fans) .. " / " .. Format.Short(f.fanCap) },
		{ "⭐", "Reputación", tostring(eco.reputation) },
		{ "🧱", "Construcciones", tostring(state.stats.buildings) },
	}
	for i, s in ipairs(stats) do
		local stat = C.Stat(s[1], s[2], s[3])
		stat.LayoutOrder = i
		stat.Parent = grid
	end
	local occupancy = f.capacity > 0 and f.attendance / f.capacity or 0
	add(C.Card({}, {
		C.Label("Ocupación prevista: " .. Format.Percent(occupancy), { Font = Theme.FontBold }),
		C.ProgressBar(occupancy, occupancy >= 1 and Theme.Gold or Theme.Accent, 12),
		C.Label(occupancy >= 1 and "Lleno: más gradas = más ingresos." or "Más atractivo y aficionados llenarán el estadio.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))

	-- Instalaciones
	local list = C.Card({}, { C.Title("🏗️ Instalaciones", 18) })
	for _, id in ipairs(FacilityConfig.Order) do
		local def = FacilityConfig.Get(id)
		local level = state.stadium.facilities[id] or 0
		local max = #def.levels
		local row = C.New("Frame", {
			BackgroundTransparency = 1,
			Size = UDim2.new(1, 0, 0, 34),
		})
		C.Label(def.icon .. "  " .. def.name, { Size = UDim2.new(0.45, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.None,
			TextColor3 = level > 0 and Theme.Text or Theme.TextMuted }).Parent = row
		local bar = C.ProgressBar(level / max, level > 0 and Theme.Accent or Theme.Locked, 10)
		bar.Position = UDim2.new(0.45, 0, 0.5, -5)
		bar.Size = UDim2.new(0.35, 0, 0, 10)
		bar.Parent = row
		C.Label(level > 0 and string.format("Nv %d/%d", level, max) or "Sin construir", {
			Position = UDim2.new(0.82, 0, 0, 0), Size = UDim2.new(0.18, 0, 1, 0),
			AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Right,
			TextColor3 = Theme.TextDim, TextSize = 13,
		}).Parent = row
		row.Parent = list
	end
	C.Button("Ir a Construcción", "secondary", function()
		ctx.navigate("build")
	end).Parent = list
	add(list)
end

return Stadium
