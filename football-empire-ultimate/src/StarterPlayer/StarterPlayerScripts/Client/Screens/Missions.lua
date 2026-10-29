-- Missions (ModuleScript) · Pantalla "Misiones" (FASE 10)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Missions

local Missions = {}

local function hours(seconds)
	seconds = math.max(0, math.floor(seconds))
	return string.format("%dh %02dm", math.floor(seconds / 3600), math.floor((seconds % 3600) / 60))
end

function Missions.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local m = state.missions
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title("🎯 Misiones", 26))

	add(C.Label(string.format("Misiones diarias · se renuevan en %s (00:00 UTC). El progreso lo cuenta el servidor con lo que haces en el juego.",
		hours(m.resetIn - (os.clock() - ctx.stateReceivedAt))), { TextColor3 = Theme.TextDim, TextSize = 13 }))
	for _, d in ipairs(m.daily) do
		local done = d.progress >= d.target
		local button = C.Button(d.claimed and "✔ Reclamada" or (done and "Reclamar" or "En curso"), done and not d.claimed and "gold" or "secondary", function()
			ctx.act("ClaimDailyMission", { id = d.id })
		end, { Size = UDim2.new(0, 120, 0, 34), AutomaticSize = Enum.AutomaticSize.None })
		C.SetEnabled(button, done and not d.claimed)
		add(C.Card({ BackgroundColor3 = d.claimed and Theme.Panel or Theme.Card }, {
			C.Row({
				C.Label(string.format("<b>%s</b><br/><font color='#A0AFC8'>Recompensa: %s%s</font>", d.text, Format.Money(d.money),
					d.reputation > 0 and string.format(" · +%d ⭐", d.reputation) or ""), { Size = UDim2.new(1, -140, 0, 0), TextSize = 15 }),
				button,
			}),
			C.ProgressBar(d.progress / d.target, done and Theme.Gold or Theme.Accent, 10),
			C.Label(string.format("%d / %d", d.progress, d.target), { TextSize = 12, TextColor3 = Theme.TextDim }),
		}))
	end

	add(C.Title("🏁 Misiones de progreso", 20))
	for _, chain in ipairs(m.chains) do
		local complete = chain.target == nil
		local ready = not complete and chain.progress >= chain.target
		local button = C.Button(complete and "✔ Completada" or (ready and "Reclamar" or "En curso"), ready and "gold" or "secondary", function()
			ctx.act("ClaimChainMission", { id = chain.id })
		end, { Size = UDim2.new(0, 120, 0, 34), AutomaticSize = Enum.AutomaticSize.None })
		C.SetEnabled(button, ready)
		add(C.Card({}, {
			C.Row({
				C.Label(string.format("<b>%s</b> · nivel %d/%d<br/><font color='#A0AFC8'>%s: %s%s</font>", chain.name, chain.level, chain.levels,
					chain.metric, Format.Thousands(chain.progress), complete and "" or (" / " .. Format.Thousands(chain.target) .. " · " .. Format.Money(chain.money))),
					{ Size = UDim2.new(1, -140, 0, 0), TextSize = 14 }),
				button,
			}),
			C.ProgressBar(complete and 1 or chain.progress / chain.target, Theme.Accent, 8),
		}))
	end
end

return Missions
