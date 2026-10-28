-- Home (ModuleScript) · Pantalla "Inicio"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Home

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local Home = {}

-- Sugiere los siguientes pasos a partir del estado real del club.
local function nextSteps(state, Format)
	local steps = {}
	if not state.club.named then
		table.insert(steps, { text = "Ponle nombre y abreviatura a tu club.", screen = "club" })
	end
	local pseudo = {
		stadium = state.stadium,
		economy = { money = state.economy.money, debt = state.economy.debt },
		club = { reputationEarned = 0 },
	}
	local cheapest, cheapestCost
	for _, id in ipairs(FacilityConfig.Order) do
		local ok, _, levelData = EconomyFormulas.CanUpgrade(pseudo, id)
		if levelData and (ok or (levelData.minStage <= state.stadium.stage)) then
			if not cheapestCost or levelData.cost < cheapestCost then
				cheapest, cheapestCost = id, levelData.cost
			end
		end
	end
	if cheapest then
		local def = FacilityConfig.Get(cheapest)
		table.insert(steps, {
			text = string.format("Mejora %s %s (%s).", def.icon, def.name, Format.Money(cheapestCost)),
			screen = "build",
		})
	end
	local stageOk, _, nextStage = EconomyFormulas.CanUpgradeStage(pseudo)
	if stageOk and nextStage then
		table.insert(steps, 1, {
			text = string.format("¡Puedes ascender tu estadio a %s! (%s)", nextStage.name, Format.Money(nextStage.upgradeCost)),
			screen = "stadium",
		})
	end
	if state.economy.debt > 0 then
		table.insert(steps, { text = "Tienes deuda: págala en Economía para evitar intereses.", screen = "economy" })
	end
	if state.economy.forecast.attendance >= state.economy.forecast.capacity then
		table.insert(steps, { text = "¡Estadio lleno! Amplía las gradas o sube el precio de las entradas.", screen = "build" })
	end
	table.insert(steps, { text = "Personaliza escudo, colores y equipación.", screen = "club" })
	return steps
end

function Home.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local scroll = C.Scroll({}, nil)
	scroll.Parent = container
	local add = C.Stack(scroll)

	local crest = CosmeticConfig.ById.crest[state.club.effectiveAppearance.crest]
	local header = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Label("BIENVENIDO, PRESIDENTE", { TextColor3 = Theme.Accent, Font = Theme.FontBold, TextSize = 13 }),
		C.Title((crest and crest.symbol or "⚽") .. "  " .. state.club.name, 28),
		C.Label(string.format("🏟️ %s · Terreno %s · Fundado en %s",
			state.stadium.stageName,
			tostring(state.stadium.plotIndex or "—"),
			os.date("%d/%m/%Y", state.club.founded)), { TextColor3 = Theme.TextDim }),
	})
	add(header)
	if state.premium.owned.VIP_CLUB then
		C.Badge("👑 MIEMBRO VIP CLUB", Theme.Gold, Color3.fromRGB(35, 25, 0)).Parent = header
	end

	if not state.saveEnabled then
		add(C.Card({ BackgroundColor3 = Color3.fromRGB(70, 45, 10) }, {
			C.Label("⚠️ <b>Guardado desactivado en esta sesión.</b> DataStore no está disponible "
				.. "(en Studio: Game Settings › Security › Enable Studio Access to API Services). "
				.. "Puedes jugar, pero el progreso no se guardará.", { TextSize = 14 }),
		}))
	end

	-- KPIs
	local grid = C.Grid(200, 78, 10)
	add(grid)
	local eco = state.economy
	local stats = {
		{ "💰", "Dinero", Format.Money(eco.money), Theme.Gold },
		{ "📈", "Balance por jornada", Format.SignedMoney(eco.forecast.net), eco.forecast.net >= 0 and Theme.Accent or Theme.Danger },
		{ "🏦", "Valor del club", Format.Money(eco.clubValue) },
		{ "👥", "Aficionados", Format.Thousands(state.club.fans) },
		{ "⭐", "Reputación", tostring(eco.reputation) },
		{ "🎟️", "Asistencia prevista", string.format("%s / %s", Format.Thousands(eco.forecast.attendance), Format.Thousands(eco.forecast.capacity)) },
	}
	for i, s in ipairs(stats) do
		local stat = C.Stat(s[1], s[2], s[3], s[4])
		stat.LayoutOrder = i
		stat.Parent = grid
	end

	-- Próximos pasos
	local steps = C.Card({}, { C.Title("🎯 Próximos pasos", 18) })
	for _, step in ipairs(nextSteps(state, Format)) do
		local row = C.Row({
			C.Label("• " .. step.text, { Size = UDim2.new(1, -110, 0, 0) }),
			C.Button("Ir", "secondary", function()
				ctx.navigate(step.screen)
			end, { Size = UDim2.new(0, 90, 0, 32), AutomaticSize = Enum.AutomaticSize.None }),
		})
		row.Parent = steps
	end
	add(steps)

	-- Accesos rápidos
	add(C.Row({
		C.Button("🏟️ Ir a mi estadio", "primary", function()
			ctx.act("TeleportHome")
			ctx.close()
		end),
		C.Button("🏗️ Construir", "secondary", function()
			ctx.navigate("build")
		end),
		C.Button("💎 Tienda Premium", "gold", function()
			ctx.navigate("shop")
		end),
	}, 10))

	add(C.Label(string.format("Próxima jornada en %s · Las jornadas generan ingresos de entradas, tienda, restaurante y patrocinio, y cobran mantenimiento y personal.",
		Format.Duration(ctx.secondsToNextCycle())), { TextColor3 = Theme.TextMuted, TextSize = 13 }))
end

return Home
