-- Collection (ModuleScript) · Pantalla "Mascotas, balones y trajes"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Collection
--
-- Huevos de mascotas y cajas de balones (con sus probabilidades siempre a la vista),
-- inventario, equipar, vender repetidas. El servidor sortea y valida todo: aquí solo se
-- piden las acciones y se muestra lo que el servidor ha guardado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local CollectionConfig = require(Shared.Config.CollectionConfig)
local OutfitConfig = require(Shared.Config.OutfitConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)

local Collection = {}

-- Descuento de la semana que envía el servidor (0 si esta semana no toca)
local function weeklyDiscount(ctx, field)
	local weekly = ctx.state.weekly
	local bonus = weekly and WeeklyConfig.Bonus(weekly.bonusId)
	return bonus and bonus[field] or 0
end

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
-- multi = true para los huevos: añade el botón «x3» (abre tres seguidos)
local function openRow(ctx, item, action, key, luck, discount, multi)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local cost = WeeklyConfig.Price(item.cost, discount)
	local function open(amount)
		local result = ctx.act(action, { [key] = item.id, amount = amount })
		if result.ok and result.data then
			ctx.drafts.lastReveal = result.data
			ctx.reveal(result.data, item.icon)
			ctx.navigate("collection", { tab = ctx.params.tab })
		end
	end
	local button = C.Button("Abrir · " .. Format.Money(cost), "gold", function()
		open(1)
	end, { Size = UDim2.new(0, 170, 0, 38), AutomaticSize = Enum.AutomaticSize.None })
	local triple = multi and C.Button("x3 · " .. Format.Short(cost * 3), "gold", function()
		open(3)
	end, { Size = UDim2.new(0, 110, 0, 38), AutomaticSize = Enum.AutomaticSize.None }) or nil
	local rebirths = ctx.state.rebirth and ctx.state.rebirth.count or 0
	if item.requiresRebirth and rebirths < item.requiresRebirth then
		C.SetEnabled(button, false, string.format("🔒 Renace %d vez", item.requiresRebirth))
		if triple then
			C.SetEnabled(triple, false, "🔒")
		end
	else
		if ctx.state.economy.money < cost then
			C.SetEnabled(button, false, "Sin dinero · " .. Format.Money(cost))
		end
		if triple and ctx.state.economy.money < cost * 3 then
			C.SetEnabled(triple, false)
		end
	end
	local offer = discount > 0 and string.format("  <font color='#FFC400'>−%d %% esta semana</font>", math.floor(discount * 100 + 0.5)) or ""
	return C.Row({
		C.Label(string.format("%s <b>%s</b>%s\n<font size='13'>%s</font>", item.icon, item.name, offer, oddsText(item.weights, luck)),
			{ Size = UDim2.new(1, triple and -310 or -190, 0, 0), TextColor3 = Theme.Text }),
		button,
		triple,
	})
end

-- Índice: premios por descubrir todas las mascotas normales de cada grupo
local function renderIndex(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local collection = ctx.state.collection
	local card = C.Card({}, { C.Title("📖 Índice de mascotas", 18),
		C.Label("Descubre todas las mascotas normales de un grupo para ganar su premio (una vez). Venderlas no las quita del índice.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }) })
	for _, entry in ipairs(CollectionConfig.IndexRewards) do
		local pets = CollectionConfig.PetsOfPool(entry.pool)
		local found, icons = 0, {}
		for _, pet in ipairs(pets) do
			local seen = collection.discovered and collection.discovered[pet.id]
			if seen then
				found += 1
			end
			table.insert(icons, seen and pet.icon or "❔")
		end
		local claimed = collection.indexClaimed and collection.indexClaimed[entry.pool]
		local complete = found == #pets
		local button = C.Button(claimed and "✔ Reclamado" or (complete and "Reclamar" or string.format("%d / %d", found, #pets)),
			complete and not claimed and "gold" or "secondary", function()
				ctx.act("ClaimPetIndex", { pool = entry.pool })
			end, { Size = UDim2.new(0, 120, 0, 32), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		C.SetEnabled(button, complete and not claimed)
		local egg = entry.egg and CollectionConfig.EggById[entry.egg]
		C.Row({
			C.Label(string.format("%s <b>%s</b>  %s\n<font size='12' color='#8C9BB4'>Premio: %s%s</font>", entry.icon, entry.name, table.concat(icons, ""),
				Format.Money(entry.money), egg and (" + " .. egg.icon .. " " .. egg.name) or ""), { Size = UDim2.new(1, -140, 0, 0), TextSize = 15 }),
			button,
		}).Parent = card
	end
	add(card)
end

local function renderPets(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local collection = ctx.state.collection
	local equipped = collection.equippedPets
	local discovered, total = 0, 0
	for _, pet in ipairs(CollectionConfig.Pets) do
		if not pet.golden then
			total += 1
			if collection.discovered and collection.discovered[pet.id] then
				discovered += 1
			end
		end
	end
	local owned = 0
	for _ in pairs(collection.pets) do
		owned += 1
	end

	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Row({
			C.Title(string.format("🐾 Equipadas %d / %d", #equipped, (collection.maxPets or CollectionConfig.MAX_EQUIPPED_PETS)), 18),
			C.Badge(string.format("Bonus en partidos: +%d%%", math.floor(collection.bonus * 100 + 0.5)), Theme.AccentDark),
			C.Badge(string.format("Descubiertas %d / %d", discovered, total), Theme.CardAlt, Theme.TextDim),
		}, 10),
		C.Label("Las mascotas equipadas te siguen y suman su bonus a las recompensas de los partidos en grupo. "
			.. "Se consiguen abriendo huevos con el dinero del club: no se compran con Robux.", { TextColor3 = Theme.TextDim, TextSize = 13 }),
	}))

	local eggs = C.Card({}, { C.Title("🥚 Huevos", 18) })
	if collection.luck > 1 then
		C.Label(string.format("🍀 ¡Suerte x%d activa! Las probabilidades de abajo ya la incluyen.", collection.luck), { TextColor3 = Theme.Gold, TextSize = 13 }).Parent = eggs
	end
	for _, egg in ipairs(CollectionConfig.Eggs) do
		openRow(ctx, egg, "HatchEgg", "egg", collection.luck, weeklyDiscount(ctx, "eggDiscount"), true).Parent = eggs
	end
	add(eggs)
	renderIndex(add, ctx)

	add(C.Row({
		C.Title("🎒 Tus mascotas", 18),
		C.Button("💰 Vender repetidas (comunes y raras)", "ghost", function()
			ctx.act("SellDuplicatePets")
		end, { TextSize = 13 }),
	}, 10))
	add(C.Label(string.format("✨ Junta %d copias de una mascota y fusiónalas en su versión <b>dorada</b> (x%.1f de bonus).",
		CollectionConfig.FUSE_COUNT, CollectionConfig.GOLDEN_BONUS), { TextColor3 = Theme.Gold, TextSize = 13 }))
	if owned == 0 then
		add(C.Label("Todavía no tienes ninguna. ¡Abre tu primer huevo!", { TextColor3 = Theme.TextMuted }))
		return
	end
	local grid = C.Grid(210, 200, 10)
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
			if not isEquipped and #equipped >= (collection.maxPets or CollectionConfig.MAX_EQUIPPED_PETS) then
				C.SetEnabled(equipButton, false, "Máx. " .. (collection.maxPets or CollectionConfig.MAX_EQUIPPED_PETS))
			end
			local sellValue = rarity.sell * (pet.golden and CollectionConfig.GOLDEN_SELL or 1)
			addTile(C.Row({
				equipButton,
				C.Button("Vender " .. Format.Short(sellValue), "ghost", function()
					ctx.act("SellPet", { pet = pet.id })
				end, { Size = UDim2.new(0, 96, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13 }),
			}, 6))
			if not pet.golden and count >= CollectionConfig.FUSE_COUNT then
				addTile(C.Button(string.format("✨ Fusionar %d → dorada", CollectionConfig.FUSE_COUNT), "gold", function()
					local result = ctx.act("FusePet", { pet = pet.id })
					if result.ok and result.data then
						ctx.reveal(result.data, "✨")
					end
				end, { Size = UDim2.new(1, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None, TextSize = 13 }))
			end
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
		openRow(ctx, crate, "OpenBallCrate", "crate", collection.luck, weeklyDiscount(ctx, "crateDiscount")).Parent = crates
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
		local button = C.Button(isEquipped and "Equipado" or (has and "Equipar" or (ball.exclusive and "🎟️ Del pase" or "Sin conseguir")), isEquipped and "secondary" or "primary", function()
			ctx.act("EquipBall", { ball = ball.id })
		end, { Size = UDim2.new(0, 120, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		C.SetEnabled(button, has and not isEquipped)
		addTile(button)
		frame.Parent = grid
	end
end

-- Muestra de colores de un traje (camiseta, pantalón, medias y botas)
local function swatches(ctx, outfit)
	local C, Theme = ctx.C, ctx.Theme
	if outfit.club then
		return C.Label("Con los colores de tu club", { TextSize = 12, TextColor3 = Theme.TextDim })
	end
	if not outfit.shirt then
		return C.Label("Tu aspecto normal de Roblox", { TextSize = 12, TextColor3 = Theme.TextDim })
	end
	local chips = {}
	for _, color in ipairs({ outfit.shirt, outfit.shorts, outfit.socks, outfit.boots }) do
		table.insert(chips, C.New("Frame", {
			Size = UDim2.fromOffset(22, 22),
			BackgroundColor3 = color,
			Children = { C.Corner(UDim.new(0, 5)), C.Stroke(Theme.Stroke) },
		}))
	end
	return C.Row(chips, 4)
end

local function renderOutfits(add, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local outfits = ctx.state.outfits

	ctx.drafts.dorsal = ctx.drafts.dorsal or (outfits.dorsal and tostring(outfits.dorsal) or "")
	local box = C.New("TextBox", {
		PlaceholderText = "1-99",
		Text = ctx.drafts.dorsal,
		ClearTextOnFocus = false,
		Font = Theme.FontBold,
		TextSize = 16,
		TextColor3 = Theme.Text,
		PlaceholderColor3 = Theme.TextMuted,
		BackgroundColor3 = Theme.CardAlt,
		Size = UDim2.new(0, 70, 0, 34),
		Children = { C.Corner(Theme.RadiusSmall), C.Stroke() },
	})
	box:GetPropertyChangedSignal("Text"):Connect(function()
		local digits = box.Text:gsub("%D", ""):sub(1, 2)
		if digits ~= box.Text then
			box.Text = digits
		end
		ctx.drafts.dorsal = digits
	end)
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("👕 Trajes de futbolista", 18),
		C.Label("Equipaciones que se pintan sobre tu personaje, con dorsal en la espalda. Tu pelo y tus accesorios se conservan; "
			.. "la ropa de tu avatar se quita mientras llevas un traje. «Tu avatar» te devuelve tu aspecto normal.",
			{ TextColor3 = Theme.TextDim, TextSize = 13 }),
		C.Row({
			C.Label("Tu dorsal:", { Size = UDim2.new(0, 90, 0, 0), AutomaticSize = Enum.AutomaticSize.Y }),
			box,
			C.Button("Guardar dorsal", "primary", function()
				ctx.act("SetDorsal", { number = tonumber(ctx.drafts.dorsal) or 0 })
			end, { Size = UDim2.new(0, 150, 0, 34), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 }),
			C.Label("(vacío = el número de cada traje)", { Size = UDim2.new(0, 230, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextSize = 12, TextColor3 = Theme.TextMuted }),
		}, 8),
	}))

	local grid = C.Grid(210, 156, 10)
	add(grid)
	local common = CollectionConfig.RarityById.common
	local legendary = CollectionConfig.RarityById.legendary
	for order, outfit in ipairs(OutfitConfig.List) do
		local has = outfit.id == OutfitConfig.DEFAULT or outfit.club == true or outfits.owned[outfit.id] == true
		local isEquipped = outfits.equipped == outfit.id
		local frame, addTile = tile(ctx, outfit.exclusive and legendary or common, has and order or order + 100, not has)
		addTile(C.Label(outfit.icon .. (isEquipped and "  ✅" or ""), { TextSize = 28 }))
		addTile(C.Label(string.format("<b>%s</b>%s", outfit.name, outfit.number and string.format("  <font color='#8C9BB4'>nº %d</font>", outfit.number) or ""),
			{ TextSize = 14, TextColor3 = has and Theme.Text or Theme.TextDim }))
		addTile(swatches(ctx, outfit))
		local button
		if has then
			button = C.Button(isEquipped and "Puesto" or "Equipar", isEquipped and "secondary" or "primary", function()
				ctx.act("EquipOutfit", { outfit = outfit.id })
			end, { Size = UDim2.new(0, 130, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
			C.SetEnabled(button, not isEquipped)
		elseif outfit.exclusive then
			button = C.Button("🎟️ Del pase", "secondary", function()
				ctx.navigate("season")
			end, { Size = UDim2.new(0, 130, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
		else
			button = C.Button("Comprar · " .. Format.Short(outfit.cost), "gold", function()
				ctx.act("BuyOutfit", { outfit = outfit.id })
			end, { Size = UDim2.new(0, 150, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
			if ctx.state.economy.money < outfit.cost then
				C.SetEnabled(button, false, "Faltan $ · " .. Format.Short(outfit.cost))
			end
		end
		addTile(button)
		frame.Parent = grid
	end
end

function Collection.Render(container, ctx)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local tab = (ctx.params.tab == "balls" or ctx.params.tab == "outfits") and ctx.params.tab or "pets"
	ctx.params.tab = tab
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🐾 Mascotas, balones y trajes", 26),
		C.Badge("💰 " .. Format.Money(ctx.state.economy.money), Theme.Panel, Theme.Gold),
	}, 14))
	add(C.Row({
		C.Button("🐾 Mascotas", tab == "pets" and "primary" or "secondary", function()
			ctx.navigate("collection", { tab = "pets" })
		end),
		C.Button("⚽ Balones", tab == "balls" and "primary" or "secondary", function()
			ctx.navigate("collection", { tab = "balls" })
		end),
		C.Button("👕 Trajes", tab == "outfits" and "primary" or "secondary", function()
			ctx.navigate("collection", { tab = "outfits" })
		end),
	}, 8))
	renderReveal(add, ctx)
	if tab == "outfits" then
		renderOutfits(add, ctx)
	elseif tab == "balls" then
		renderBalls(add, ctx)
	else
		renderPets(add, ctx)
	end
end

return Collection
