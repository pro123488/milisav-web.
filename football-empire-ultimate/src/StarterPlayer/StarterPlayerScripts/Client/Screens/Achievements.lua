-- Achievements (ModuleScript) · Pantalla "Logros" (FASE 10)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Achievements

local Achievements = {}

function Achievements.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local list = state.missions.achievements
	local unlocked = 0
	for _, a in ipairs(list) do
		if a.unlockedAt then
			unlocked += 1
		end
	end
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)
	add(C.Title(string.format("🎖️ Logros · %d / %d", unlocked, #list), 26))
	add(C.ProgressBar(unlocked / math.max(1, #list), Theme.Gold, 12))
	add(C.Label("Los logros se desbloquean solos al alcanzar cada hito con tu club y dan dinero y reputación una única vez.",
		{ TextColor3 = Theme.TextDim, TextSize = 13 }))
	local grid = C.Grid(220, 120, 10)
	add(grid)
	for i, a in ipairs(list) do
		local done = a.unlockedAt ~= nil
		local tile = C.New("Frame", {
			LayoutOrder = done and i or (i + 1000),
			BackgroundColor3 = done and Theme.CardAlt or Theme.Panel,
			Children = { C.Corner(), C.Stroke(done and Theme.Gold or Theme.Stroke, done and 2 or 1), C.Padding(8), C.List(nil, 3) },
		})
		local addTile = C.Stack(tile)
		addTile(C.Label(string.format("%s <b>%s</b>", done and a.icon or "🔒", a.name), { TextSize = 14, TextColor3 = done and Theme.Text or Theme.TextMuted }))
		addTile(C.ProgressBar(a.progress / math.max(1, a.target), done and Theme.Gold or Theme.Accent, 6))
		addTile(C.Label(string.format("%s / %s", Format.Short(a.progress), Format.Short(a.target)), { TextSize = 12, TextColor3 = Theme.TextDim }))
		addTile(C.Label(done and ("✅ " .. os.date("%d/%m/%Y", a.unlockedAt))
			or string.format("%s%s", a.money > 0 and Format.Money(a.money) or "", a.reputation > 0 and string.format(" · +%d ⭐", a.reputation) or ""),
			{ TextSize = 12, TextColor3 = done and Theme.Accent or Theme.TextDim }))
		tile.Parent = grid
	end
end

return Achievements
