-- Season (ModuleScript) · Pantalla "Pase de temporada"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Season
--
-- Niveles del pase con sus dos pistas (gratis y premium). Las recompensas se leen de
-- SeasonConfig (las mismas que usa el servidor) y el servidor valida cada reclamación.
-- El premium solo se puede comprar cuando su producto de Roblox está configurado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local SeasonConfig = require(Shared.Config.SeasonConfig)

local Season = {}

local function timeLeft(seconds)
	seconds = math.max(0, seconds)
	local days = math.floor(seconds / 86400)
	local hours = math.floor((seconds % 86400) / 3600)
	if days > 0 then
		return string.format("%d d %d h", days, hours)
	end
	return string.format("%d h %d min", hours, math.floor((seconds % 3600) / 60))
end
Season.TimeLeft = timeLeft

function Season.Render(container, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local season = state.season
	local rewards = SeasonConfig.Rewards(season.number)
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🎟️ Pase de temporada", 26),
		C.Badge(string.format("Temporada %d", season.number), Theme.Panel, Theme.Gold),
	}, 14))

	-- Progreso
	local maxed = season.level >= SeasonConfig.TIERS
	local inTier = season.xp - season.level * SeasonConfig.XP_PER_TIER
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title(season.icon .. " " .. season.name, 22),
		C.Label(string.format("Termina en %s. Al acabar empieza una temporada nueva con otros exclusivos y el progreso vuelve a cero.",
			timeLeft(season.endsAt - os.time())), { TextColor3 = Theme.TextDim, TextSize = 13 }),
		C.Label(maxed and string.format("<b>Nivel %d / %d</b> · ¡pase completado!", season.level, SeasonConfig.TIERS)
			or string.format("<b>Nivel %d / %d</b> · %d / %d puntos para el siguiente", season.level, SeasonConfig.TIERS, inTier, SeasonConfig.XP_PER_TIER),
			{ TextSize = 16 }),
		C.ProgressBar(maxed and 1 or inTier / SeasonConfig.XP_PER_TIER, Theme.Gold, 12),
		C.Label(string.format("Cómo ganar puntos: partido en grupo +%d (victoria +%d, cada gol +%d) · misión diaria +%d · misión de progreso +%d · "
			.. "conexión diaria +%d · huevo o caja +%d · cada jornada +%d.",
			SeasonConfig.XP.match, SeasonConfig.XP.win, SeasonConfig.XP.goal, SeasonConfig.XP.dailyMission, SeasonConfig.XP.chainMission,
			SeasonConfig.XP.dailyLogin, SeasonConfig.XP.hatch, SeasonConfig.XP.cycle), { TextColor3 = Theme.TextDim, TextSize = 12 }),
	}))

	-- Premium
	if season.premium then
		add(C.Card({ BackgroundColor3 = Color3.fromRGB(60, 45, 10) }, {
			C.Label("💎 <b>Pista premium ACTIVADA</b> para esta temporada. Reclama abajo tus exclusivos.", { TextColor3 = Theme.Gold }),
		}))
	else
		local button
		if season.productConfigured then
			button = C.Button(season.price and string.format("Comprar premium · %d R$", season.price) or "Comprar premium", "gold", function()
				ctx.act("BuySeasonPass")
			end)
		else
			button = C.Button("Pendiente de configuración", "secondary", nil)
			C.SetEnabled(button, false)
		end
		add(C.Card({}, {
			C.Title("💎 Pista premium", 18),
			C.Label("Una compra por temporada. Solo da <b>cosméticos</b>: balones y traje exclusivos de la temporada y cajas de balones. "
				.. "No da dinero ni mascotas, así que no es una ventaja para ganar."
				.. (season.productConfigured and "" or " Todavía no está a la venta: falta crear su producto en Roblox."),
				{ TextColor3 = Theme.TextDim, TextSize = 13 }),
			C.Row({ button }, 8),
		}))
	end

	-- Reclamar todo
	local pending = 0
	for tier = 1, season.level do
		local reward = rewards[tier]
		if reward.free and not season.claimedFree[tier] then
			pending += 1
		end
		if reward.premium and season.premium and not season.claimedPremium[tier] then
			pending += 1
		end
	end
	if pending > 0 then
		add(C.Row({ C.Button(string.format("🎁 Reclamar todo (%d)", pending), "gold", function()
			ctx.act("ClaimPassAll")
		end) }, 8))
	end

	local function claimButton(tier, track, claimed, allowed)
		local unlocked = tier <= season.level
		local text = claimed and "✔ Reclamada" or (not unlocked and ("🔒 Nivel " .. tier)) or (not allowed and "💎 Premium") or "Reclamar"
		local ready = unlocked and allowed and not claimed
		local button = C.Button(text, ready and "gold" or "secondary", function()
			ctx.act("ClaimPassReward", { tier = tier, track = track })
		end, { Size = UDim2.new(0, 130, 0, 32), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		C.SetEnabled(button, ready)
		return button
	end

	for tier, reward in ipairs(rewards) do
		local unlocked = tier <= season.level
		local card = C.Card({ BackgroundColor3 = unlocked and Theme.Card or Theme.Panel }, {
			C.Label(string.format("<b>Nivel %d</b>%s", tier, unlocked and "" or "  🔒"), { TextSize = 15, TextColor3 = unlocked and Theme.Gold or Theme.TextMuted }),
			C.Row({
				C.Label("🆓 " .. SeasonConfig.Describe(reward.free), { Size = UDim2.new(1, -150, 0, 0), TextSize = 14 }),
				claimButton(tier, "free", season.claimedFree[tier] == true, true),
			}),
		})
		if reward.premium then
			C.Row({
				C.Label("💎 " .. SeasonConfig.Describe(reward.premium), { Size = UDim2.new(1, -150, 0, 0), TextSize = 14, TextColor3 = Theme.Gold }),
				claimButton(tier, "premium", season.claimedPremium[tier] == true, season.premium == true),
			}).Parent = card
		end
		add(card)
	end
end

return Season
