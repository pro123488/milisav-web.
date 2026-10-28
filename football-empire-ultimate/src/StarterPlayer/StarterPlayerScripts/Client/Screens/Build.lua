-- Build (ModuleScript) · Pantalla "Construcción"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Build
-- Pestañas: Instalaciones · Decoración (comprar y colocar) · Diseños (Constructor Pro).
-- La interfaz calcula requisitos solo para informar; el servidor valida cada compra.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local FacilityConfig = require(Shared.Config.FacilityConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

local UI = script.Parent.Parent:WaitForChild("UI")
local Premium = require(UI.Premium)

local Build = {}

local EFFECT_TEXT = {
	capacity = function(v, F) return "Aforo " .. F.Thousands(v) end,
	attractiveness = function(v, F) return "Atractivo +" .. F.Percent(v) end,
	shopSpend = function(v) return string.format("Gasto en tienda %.1f/aficionado", v) end,
	foodSpend = function(v) return string.format("Gasto en comida %.1f/aficionado", v) end,
	vipIncome = function(v, F) return "Ingresos VIP " .. F.Money(v) end,
	reputation = function(v) return "Reputación " .. v end,
}
local EFFECT_ORDER = { "capacity", "attractiveness", "shopSpend", "foodSpend", "vipIncome", "reputation" }

local function effectsText(levelData, Format)
	local parts = {}
	for _, key in ipairs(EFFECT_ORDER) do
		if levelData[key] and levelData[key] ~= 0 then
			table.insert(parts, EFFECT_TEXT[key](levelData[key], Format))
		end
	end
	table.insert(parts, "Mantenimiento " .. Format.Money(levelData.upkeep + levelData.staff) .. "/jornada")
	return table.concat(parts, " · ")
end

local function pseudoData(state)
	return {
		stadium = state.stadium,
		economy = { money = state.economy.money, debt = state.economy.debt },
		club = { reputationEarned = 0 },
	}
end

local function renderFacilities(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local data = pseudoData(state)
	for _, id in ipairs(FacilityConfig.Order) do
		local def = FacilityConfig.Get(id)
		local level = state.stadium.facilities[id] or 0
		local max = #def.levels
		local ok, reason, nextData = EconomyFormulas.CanUpgrade(data, id)
		local stageLocked = nextData and nextData.minStage > state.stadium.stage

		local card = C.Card({ BackgroundColor3 = stageLocked and Theme.Panel or Theme.Card }, {
			C.Row({
				C.Label(def.icon .. "  <b>" .. def.name .. "</b>", { TextSize = 18, Size = UDim2.new(0, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false }),
				C.Badge(level > 0 and string.format("Nivel %d/%d", level, max) or "Sin construir", level > 0 and Theme.AccentDark or Theme.Locked),
				C.Badge(def.category, Theme.CardAlt, Theme.TextDim),
			}),
			C.Label(def.description, { TextColor3 = Theme.TextDim, TextSize = 14 }),
		})
		if level > 0 then
			C.Label("Ahora: " .. effectsText(def.levels[level], Format), { TextSize = 13, TextColor3 = Theme.Text }).Parent = card
		end
		if nextData then
			C.Label(string.format("Siguiente (Nv %d): %s", level + 1, effectsText(nextData, Format)), { TextSize = 13, TextColor3 = Theme.Accent }).Parent = card
			local label = string.format("%s · %s", level == 0 and "Construir" or "Mejorar", Format.Money(nextData.cost))
			local button = C.Button(label, "primary", function()
				ctx.act("UpgradeFacility", { facility = id })
			end)
			C.SetEnabled(button, ok)
			local row = C.Row({ button }, 10)
			if not ok and reason then
				C.Label("🔒 " .. reason, { TextColor3 = stageLocked and Theme.TextMuted or Theme.Warning, TextSize = 13,
					Size = UDim2.new(0, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.XY, TextWrapped = false }).Parent = row
			end
			row.Parent = card
		else
			C.Label("✅ Nivel máximo alcanzado.", { TextColor3 = Theme.Accent, TextSize = 13 }).Parent = card
		end
		add(card)
	end
end

local function renderDecorations(add, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local stadium = state.stadium
	local list = stadium.decorations
	local max = stadium.maxDecorations
	local isPro = state.premium.owned.CONSTRUCTOR_PRO == true
	local freeLimit = EconomyFormulas.FreeDecorationLimit(stadium.stage)

	-- Resumen y herramientas
	local info = C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Row({
			C.Title(string.format("🌳 Decoraciones %d / %d", #list, max), 18),
			C.Badge(string.format("Rejilla %d · Rotación %d°", stadium.tools.grid, stadium.tools.rotationStep),
				isPro and Theme.Info or Theme.CardAlt),
		}, 10),
		C.Label(string.format("Coloca decoraciones libremente en la plaza de tu terreno (zona azul en el modo construcción). "
			.. "Tu etapa de estadio permite %d; cada ascenso de etapa añade más. Retirar devuelve el %d%% del precio. "
			.. "Cada decoración (hasta %d) suma +%s de atractivo.",
			freeLimit, math.floor(CosmeticConfig.DECORATION_REFUND * 100), freeLimit,
			Format.Percent(CosmeticConfig.DECORATION_ATTRACTIVENESS)), { TextColor3 = Theme.TextDim, TextSize = 13 }),
	})
	if not isPro then
		local upsell = C.Row({
			C.Label(string.format("🏗️ Constructor Pro: rejilla fina de %d stud, rotación a %d° y +%d decoraciones (sin ventaja económica).",
				GameConfig.PRO_GRID, GameConfig.PRO_ROTATION_STEP, GameConfig.PRO_EXTRA_DECORATIONS),
				{ TextColor3 = Theme.Gold, TextSize = 13, Size = UDim2.new(1, -130, 0, 0) }),
			C.Button("Ver pase", "gold", function()
				ctx.navigate("shop", { focus = "CONSTRUCTOR_PRO" })
			end, { Size = UDim2.new(0, 110, 0, 32), AutomaticSize = Enum.AutomaticSize.None }),
		}, 8)
		upsell.Parent = info
	end
	add(info)

	-- Catálogo
	local full = #list >= max
	local catalog = C.Card({}, { C.Title("🛒 Colocar una decoración nueva", 18) })
	if full then
		C.Label("Has alcanzado tu límite. Asciende tu estadio para colocar más, o retira alguna.", { TextColor3 = Theme.Warning, TextSize = 13 }).Parent = catalog
	end
	for _, item in ipairs(CosmeticConfig.Decorations) do
		local locked = Premium.IsLocked(state, item)
		local button = C.Button(locked and "🔒 Ver pase" or ("Colocar · " .. Format.Money(item.cost)), locked and "gold" or "primary", function()
			if locked then
				Premium.OnLockedClick(ctx, item)
			else
				ctx.startPlacement({ decoId = item.id })
			end
		end, { Size = UDim2.new(0, 170, 0, 34), AutomaticSize = Enum.AutomaticSize.None })
		if not locked then
			if state.economy.money < item.cost then
				C.SetEnabled(button, false, "Sin dinero · " .. Format.Money(item.cost))
			elseif full then
				C.SetEnabled(button, false, "Límite alcanzado")
			end
		end
		C.Row({
			C.Label(string.format("%s  <font color='#8C9BB4'>(%dx%d)</font>%s", item.name, item.w, item.d,
				item.requiredPass and ("  <font color='#FFC400'>" .. Premium.PassName(item.requiredPass) .. "</font>") or ""),
				{ Size = UDim2.new(1, -190, 0, 0) }),
			button,
		}).Parent = catalog
	end
	add(catalog)

	-- Decoraciones colocadas
	local placed = C.Card({}, { C.Title("📍 Tus decoraciones", 18) })
	if #list == 0 then
		C.Label("Todavía no has colocado ninguna.", { TextColor3 = Theme.TextMuted }).Parent = placed
	end
	for index, entry in ipairs(list) do
		local item = CosmeticConfig.ById.decoration[entry.id]
		local hidden = stadium.decorationVisible[index] ~= true
		local name = item and item.name or entry.id
		local moveButton = C.Button("Mover", "secondary", function()
			ctx.startPlacement({ decoId = entry.id, moveIndex = index })
		end, { Size = UDim2.new(0, 80, 0, 32), AutomaticSize = Enum.AutomaticSize.None })
		if hidden then
			C.SetEnabled(moveButton, false)
		end
		C.Row({
			C.Label(string.format("%d. %s  <font color='#8C9BB4'>x %d · z %d · %d°</font>%s", index, name, entry.x, entry.z, entry.r,
				hidden and "  <font color='#FFA028'>(oculta: requiere pase o supera tu límite)</font>" or ""),
				{ Size = UDim2.new(1, -200, 0, 0), TextSize = 14 }),
			moveButton,
			C.Button("Retirar", "danger", function()
				ctx.act("RemoveDecoration", { index = index, decoration = entry.id })
			end, { Size = UDim2.new(0, 90, 0, 32), AutomaticSize = Enum.AutomaticSize.None }),
		}).Parent = placed
	end
	add(placed)
end

local function renderDesigns(add, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	add(C.Label("Los diseños cambian el aspecto de gradas y edificios. No modifican la economía ni permiten construir fuera de tu terreno.",
		{ TextColor3 = Theme.TextDim, TextSize = 14 }))
	for _, group in ipairs({
		{ slot = "standsDesign", appliesTo = "stands", title = "🏟️ Diseño de gradas" },
		{ slot = "buildingDesign", appliesTo = "building", title = "🏢 Diseño de edificios" },
	}) do
		local card = C.Card({}, { C.Title(group.title, 18) })
		local grid = C.Grid(150, 100, 8)
		grid.Parent = card
		local i = 0
		for _, item in ipairs(CosmeticConfig.BuildDesigns) do
			if item.appliesTo == group.appliesTo then
				i += 1
				local locked = Premium.IsLocked(state, item)
				local selected = state.club.appearance[group.slot] == item.id
				local tile = C.OptionTile(item.name, item.requiredPass and "Constructor Pro" or "Gratis", {
					selected = selected,
					locked = locked,
					lockText = Premium.LockText(item),
					onClick = function()
						if locked then
							Premium.OnLockedClick(ctx, item)
						elseif not selected then
							ctx.act("SetAppearance", { slot = group.slot, id = item.id })
						end
					end,
				}, C.Label(item.material, {
					Position = UDim2.fromOffset(6, 14), Size = UDim2.new(1, -12, 0, 30),
					AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center,
					TextColor3 = Theme.TextDim, TextSize = 13,
				}))
				tile.LayoutOrder = i
				tile.Parent = grid
			end
		end
		add(card)
	end
end

function Build.Render(container, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local tab = ctx.params.tab or "facilities"
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🏗️ Construcción", 26),
		C.Badge("💰 " .. Format.Money(ctx.state.economy.money), Theme.Panel, Theme.Gold),
	}, 14))
	local tabs = {
		{ id = "facilities", label = "Instalaciones" },
		{ id = "decor", label = "Decoración" },
		{ id = "designs", label = "Diseños" },
	}
	local tabButtons = {}
	for _, t in ipairs(tabs) do
		table.insert(tabButtons, C.Button(t.label, tab == t.id and "primary" or "secondary", function()
			ctx.navigate("build", { tab = t.id })
		end))
	end
	add(C.Row(tabButtons, 8))

	if tab == "decor" then
		renderDecorations(add, ctx)
	elseif tab == "designs" then
		renderDesigns(add, ctx)
	else
		renderFacilities(add, ctx)
	end
end

return Build
