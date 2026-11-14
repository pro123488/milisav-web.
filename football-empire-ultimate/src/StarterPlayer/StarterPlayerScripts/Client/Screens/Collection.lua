-- Collection (ModuleScript) · Pantalla "Mascotas y balones"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Collection
--
-- Huevos de mascotas y cajas de balones (con sus probabilidades siempre a la vista),
-- inventario, equipar, vender repetidas. El servidor sortea y valida todo: aquí solo se
-- piden las acciones y se muestra lo que el servidor ha guardado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local CollectionConfig = require(Shared.Config.CollectionConfig)

local Collection = {}

local function percent(value)
	if value >= 10 or value == math.floor(value) then
		return string.format("%d%%", math.floor(value + 0.5))
	end
	return string.format("%.1f%%", value)
end

-- «Común 70% · Raro 24% · …» con el color de cada rareza
local function oddsText(weights, luck)
	local odds = CollectionConfig.Odds(weights, luck)
	local parts = {}
	for _, rarity in ipairs(CollectionConfig.Rarities) do
		local chance = odds[rarity.id] or 0
		if chance > 0 then
			table.insert(parts, string.format("<font color='%s'>%s %s</font>", rarity.hex, rarity.name, percent(chance)))
		end
	end
	return table.concat(parts, " · ")
end

local function tile(ctx, rarity, order, dimmed)
	local C, Theme = ctx.C, ctx.Theme
	local frame = C.New("Frame", {
		LayoutOrder = order,
		BackgroundColor3 = dimmed and Theme.Panel or Theme.CardAlt,
		Children = { C.Corner(), C.Stroke(dimmed and Theme.Stroke or rarity.color, dimmed and 1 or 2), C.Padding(8), C.List(nil, 3) },
	})
	return frame, C.Stack(frame)
end

-- Tarjeta con lo último que ha salido de un huevo o de una caja
local function renderReveal(add, ctx)
	local C, Theme = ctx.C, ctx.Theme
	local reveal = ctx.drafts.lastReveal
	if not reveal then
		return
	end
	local item = reveal.kind == "pet" and CollectionConfig.PetById[reveal.id] or CollectionConfig.BallById[reveal.id]
	if not item then
		return
	end
	local rarity = CollectionConfig.RarityById[item.rarity]
	local detail
	if reveal.kind == "pet" then
		detail = string.format("Mascota · +%d%% en partidos%s", math.floor(item.bonus * 100 + 0.5), reveal.isNew and " · ¡NUEVA!" or " · repetida (puedes venderla)")
	else
		detail = reveal.isNew and "Balón · ¡NUEVO! Equípalo abajo." or string.format("Balón repetido · te devolvemos %s", ctx.Format.Money(reveal.refund or 0))
	end
	local card = C.Card({ BackgroundColor3 = rarity.color:Lerp(Color3.new(0, 0, 0), 0.65) }, {
		C.Label(string.format("%s  <b>%s</b>", item.icon, item.name), { TextSize = 28 }),
		C.Label(string.format("<font color='%s'><b>%s</b></font> · %s", rarity.hex, string.upper(rarity.name), detail), { TextSize = 15 }),
		C.Row({ C.Button("Vale", "secondary", function()
			ctx.drafts.lastReveal = nil
			ctx.navigate("collection", { tab = ctx.params.tab })
		end, { Size = UDim2.new(0, 90, 0, 32), AutomaticSize = Enum.AutomaticSize.None }) }, 8),
	})
	local stroke = card:FindFirstChildOfClass("UIStroke")
	if stroke then
		stroke.Color = rarity.color
		stroke.Thickness = 3
	end
	add(card)
end

-- Fila de un huevo o de una caja: nombre, probabilidades y botón de abrir
local function openRow(ctx, item, action, key, luck)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local button = C.Button("Abrir · " .. Format.Money(item.cost), "gold", function()
		local result = ctx.act(action, { [key] = item.id })
		if result.ok and result.data then
			ctx.drafts.lastReveal = result.data
			ctx.navigate("collection", { tab = ctx.params.tab })
		end
	end, { Size = UDim2.new(0, 170, 0, 38), AutomaticSize = Enum.AutomaticSize.None })
	if ctx.state.economy.money < item.cost then
		C.SetEnabled(button, false, "Sin dinero · " .. Format.Money(item.cost))
	end
	return C.Row({
		C.Label(string.format("%s <b>%s</b>\n<font size='13'>%s</font>", item.icon, item.name, oddsText(item.weights, luck)),
			{ Size = UDim2.new(1, -190, 0, 0), TextColor3 = Theme.Text }),
		button,
	})
end

local function renderPets(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local collection = ctx.state.collection
	local equipped = collection.equippedPets
	local discovered = 0
	for _ in pairs(collection.pets) do
		discovered += 1
	end

	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Row({
			C.Title(string.format("🐾 Equipadas %d / %d", #equipped, CollectionConfig.MAX_EQUIPPED_PETS), 18),
			C.Badge(string.format("Bonus en partidos: +%d%%", math.floor(collection.bonus * 100 + 0.5)), Theme.AccentDark),
			C.Badge(string.format("Descubiertas %d / %d", discovered, #CollectionConfig.Pets), Theme.CardAlt, Theme.TextDim),
		}, 10),
		C.Label("Las mascotas equipadas te siguen y suman su bonus a las recompensas de los partidos en grupo. "
			.. "Se consiguen abriendo huevos con el dinero del club: no se compran con Robux.", { TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))

	local eggs = C.Card({}, { C.Title("🥚 Huevos", 18) })
	if collection.luck > 1 then
		C.Label(string.format("🍀 ¡Suerte x%d activa! Las probabilidades de abajo ya la incluyen.", collection.luck), { TextColor3 = Theme.Gold, TextSize = 13 }).Parent = eggs
	end
	for _, egg in ipairs(CollectionConfig.Eggs) do
		openRow(ctx, egg, "HatchEgg", "egg", collection.luck).Parent = eggs
	end
	add(eggs)

	add(C.Title("🎒 Tus mascotas", 18))
	if discovered == 0 then
		add(C.Label("Todavía no tienes ninguna. ¡Abre tu primer huevo!", { TextColor3 = Theme.TextMuted }))
		return
	end
	local grid = C.Grid(210, 168, 10)
	add(grid)
	for order, pet in ipairs(CollectionConfig.Pets) do
		local count = collection.pets[pet.id] or 0
		if count > 0 then
			local rarity = CollectionConfig.RarityById[pet.rarity]
			local isEquipped = table.find(equipped, pet.id) ~= nil
			local frame, addTile = tile(ctx, rarity, isEquipped and order or order + 100, false)
			addTile(C.Label(pet.icon .. (isEquipped and "  ✅" or ""), { TextSize = 30 }))
			addTile(C.Label(string.format("<b>%s</b>%s", pet.name, count > 1 and string.format("  <font color='#8C9BB4'>x%d</font>", count) or ""), { TextSize = 15 }))
			addTile(C.Label(string.format("<font color='%s'>%s</font> · +%d%%", rarity.hex, rarity.name, math.floor(pet.bonus * 100 + 0.5)), { TextSize = 13 }))
			local equipButton = C.Button(isEquipped and "Quitar" or "Equipar", isEquipped and "secondary" or "primary", function()
				ctx.act("EquipPet", { pet = pet.id, equip = not isEquipped })
			end, { Size = UDim2.new(0, 88, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
			if not isEquipped and #equipped >= CollectionConfig.MAX_EQUIPPED_PETS then
				C.SetEnabled(equipButton, false, "Máx. 3")
			end
			addTile(C.Row({
				equipButton,
				C.Button("Vender " .. Format.Short(rarity.sell), "ghost", function()
					ctx.act("SellPet", { pet = pet.id })
				end, { Size = UDim2.new(0, 96, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13 }),
			}, 6))
			frame.Parent = grid
		end
	end
end

local function renderBalls(add, ctx)
	local C, Theme = ctx.C, ctx.Theme
	local collection = ctx.state.collection
	local owned = 1 -- el clásico
	for _ in pairs(collection.balls) do
		owned += 1
	end

	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Row({
			C.Title("⚽ Balones", 18),
			C.Badge(string.format("Conseguidos %d / %d", owned, #CollectionConfig.Balls), Theme.CardAlt, Theme.TextDim),
		}, 10),
		C.Label("Tu balón equipado se ve en el balón de tu estadio y en el de los partidos en grupo cuando lo tocas tú. "
			.. "Solo cambia el aspecto (color, estela y brillos): todos los balones se juegan igual.", { TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))

	local crates = C.Card({}, { C.Title("📦 Cajas de balones", 18) })
	if collection.luck > 1 then
		C.Label(string.format("🍀 ¡Suerte x%d activa! Las probabilidades de abajo ya la incluyen.", collection.luck), { TextColor3 = Theme.Gold, TextSize = 13 }).Parent = crates
	end
	for _, crate in ipairs(CollectionConfig.Crates) do
		openRow(ctx, crate, "OpenBallCrate", "crate", collection.luck).Parent = crates
	end
	C.Label(string.format("Si te toca un balón que ya tienes, se te devuelve el %d%% del precio de la caja.",
		math.floor(CollectionConfig.DUPLICATE_BALL_REFUND * 100)), { TextColor3 = Theme.TextMuted, TextSize = 12 }).Parent = crates
	add(crates)

	add(C.Title("🎒 Tu colección", 18))
	local grid = C.Grid(190, 138, 10)
	add(grid)
	for order, ball in ipairs(CollectionConfig.Balls) do
		local rarity = CollectionConfig.RarityById[ball.rarity]
		local has = ball.id == CollectionConfig.DEFAULT_BALL or collection.balls[ball.id] == true
		local isEquipped = collection.ball == ball.id
		local frame, addTile = tile(ctx, rarity, has and order or order + 100, not has)
		addTile(C.Label((has and ball.icon or "🔒") .. (isEquipped and "  ✅" or ""), { TextSize = 28 }))
		addTile(C.Label("<b>" .. ball.name .. "</b>", { TextSize = 14, TextColor3 = has and Theme.Text or Theme.TextMuted }))
		addTile(C.Label(string.format("<font color='%s'>%s</font>", rarity.hex, rarity.name), { TextSize = 13 }))
		local button = C.Button(isEquipped and "Equipado" or (has and "Equipar" or "Sin conseguir"), isEquipped and "secondary" or "primary", function()
			ctx.act("EquipBall", { ball = ball.id })
		end, { Size = UDim2.new(0, 120, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		C.SetEnabled(button, has and not isEquipped)
		addTile(button)
		frame.Parent = grid
	end
end

function Collection.Render(container, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local tab = ctx.params.tab == "balls" and "balls" or "pets"
	ctx.params.tab = tab
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🐾 Mascotas y balones", 26),
		C.Badge("💰 " .. Format.Money(ctx.state.economy.money), Theme.Panel, Theme.Gold),
	}, 14))
	add(C.Row({
		C.Button("🐾 Mascotas", tab == "pets" and "primary" or "secondary", function()
			ctx.navigate("collection", { tab = "pets" })
		end),
		C.Button("⚽ Balones", tab == "balls" and "primary" or "secondary", function()
			ctx.navigate("collection", { tab = "balls" })
		end),
	}, 8))
	renderReveal(add, ctx)
	if tab == "balls" then
		renderBalls(add, ctx)
	else
		renderPets(add, ctx)
	end
end

return Collection
