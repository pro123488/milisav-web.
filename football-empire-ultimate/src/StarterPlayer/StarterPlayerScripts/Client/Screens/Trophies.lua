-- Trophies (ModuleScript) · Pantalla "Camino de trofeos"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Trophies
--
-- Rango actual, progreso al siguiente y premios del camino. Los trofeos los suma o resta el
-- servidor al terminar cada partido en grupo; reclamar también lo valida el servidor.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local TrophyConfig = require(Shared.Config.TrophyConfig)
local CollectionConfig = require(Shared.Config.CollectionConfig)

local Trophies = {}

local function describe(step, Format)
	if step.money then
		return "💰 " .. Format.Money(step.money)
	elseif step.egg then
		local egg = CollectionConfig.EggById[step.egg]
		return string.format("%s %s (se abre al reclamar)", egg.icon, egg.name)
	elseif step.crate then
		local crate = CollectionConfig.CrateById[step.crate]
		return string.format("%s %s (balón nuevo)", crate.icon, crate.name)
	end
	return "?"
end

function Trophies.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local info = state.trophies
	local rank = TrophyConfig.Rank(info.trophies)
	local nextRank = TrophyConfig.NextRank(info.trophies)
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🏆 Camino de trofeos", 26),
		C.Badge(string.format("%s %s", rank.icon, rank.name), rank.color, Color3.fromRGB(20, 20, 25)),
	}, 14))

	local header = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title(string.format("%d 🏆", info.trophies), 32),
		C.Label(string.format("Máximo alcanzado: %d · Los premios se desbloquean con tu máximo, así que no se pierden si bajas.", info.best),
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	if nextRank then
		local fraction = (info.trophies - rank.min) / (nextRank.min - rank.min)
		C.Label(string.format("Siguiente rango: %s %s a los %d trofeos (te faltan %d)", nextRank.icon, nextRank.name, nextRank.min, nextRank.min - info.trophies),
			{ TextSize = 15 }).Parent = header
		C.ProgressBar(fraction, nextRank.color, 12).Parent = header
	else
		C.Label("👑 ¡Has llegado al rango más alto!", { TextColor3 = Theme.Gold, TextSize = 15 }).Parent = header
	end
	C.Label(string.format("Cómo se ganan: victoria +%d · empate +%d · derrota %d · cada gol +%d (máx. %d) · MVP +%d. Se juegan en los partidos en grupo (botón ⚽ JUGAR PARTIDO).",
		TrophyConfig.WIN, TrophyConfig.DRAW, TrophyConfig.LOSS, TrophyConfig.PER_GOAL, TrophyConfig.MAX_GOAL_BONUS, TrophyConfig.MVP),
		{ TextColor3 = Theme.TextDim, TextSize = 12 }).Parent = header
	add(header)

	-- Rangos
	local ranks = {}
	for _, r in ipairs(TrophyConfig.Ranks) do
		local reached = info.trophies >= r.min
		table.insert(ranks, C.Badge(string.format("%s %s · %d", r.icon, r.name, r.min), reached and r.color or Theme.CardAlt,
			reached and Color3.fromRGB(20, 20, 25) or Theme.TextDim))
	end
	add(C.Row(ranks, 6))

	-- Camino
	local road = C.Card({}, { C.Title("🎁 Premios del camino", 18) })
	local pending = false
	for _, step in ipairs(TrophyConfig.Road) do
		local unlocked = info.best >= step.at
		local claimed = info.claimed[tostring(step.at)] == true
		pending = pending or (unlocked and not claimed)
		local button = C.Button(claimed and "✔ Reclamado" or (unlocked and "Reclamar" or ("🔒 " .. step.at)), unlocked and not claimed and "gold" or "secondary", function()
			ctx.act("ClaimTrophyReward", { at = step.at })
		end, { Size = UDim2.new(0, 120, 0, 32), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		C.SetEnabled(button, unlocked and not claimed)
		C.Row({
			C.Label(string.format("<b>%d 🏆</b>  ·  %s", step.at, describe(step, Format)), { Size = UDim2.new(1, -140, 0, 0), TextSize = 15,
				TextColor3 = unlocked and Theme.Text or Theme.TextDim }),
			button,
		}).Parent = road
	end
	add(road)
	if pending then
		add(C.Label("👆 Tienes premios del camino por reclamar.", { TextColor3 = Theme.Gold, TextSize = 14 }))
	end
end

return Trophies
