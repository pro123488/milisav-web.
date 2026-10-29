-- Shop (ModuleScript) · TIENDA PREMIUM
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Shop
--
-- Muestra los Game Passes con su estado REAL enviado por el servidor:
--   pendiente de configuración · comprobando · disponible · adquirido · error · próximamente.
-- El botón de compra solo pide al servidor que abra la ventana oficial de Roblox.
-- La interfaz nunca marca un pase como comprado por sí misma.

local Shop = {}

local STATUS = {
	pending_config = { text = "⚙️ Pendiente de configuración", color = "Warning" },
	checking = { text = "⏳ Comprobando con Roblox…", color = "Info" },
	owned = { text = "✅ ADQUIRIDO", color = "Accent" },
	not_owned = { text = "Disponible", color = "CardAlt" },
	error = { text = "⚠️ No verificado · reintentando", color = "Danger" },
	inactive = { text = "Próximamente", color = "Locked" },
}

local function priceText(pass, Format)
	if pass.status == "pending_config" then
		return "Precio: se mostrará cuando el pase esté configurado"
	elseif pass.status == "inactive" then
		return "Llegará en la FASE " .. pass.phase
	elseif pass.priceKnown and pass.forSale and pass.price then
		return "R$ " .. Format.Thousands(pass.price)
	elseif pass.priceKnown and not pass.forSale then
		return "No está a la venta en este momento"
	end
	return "Precio no disponible ahora mismo"
end

local function passCard(ctx, pass, focused)
	local C, Theme, Format = ctx.C, ctx.Theme, ctx.Format
	local status = STATUS[pass.status] or STATUS.pending_config
	local owned = pass.status == "owned"
	local active = pass.active

	local card = C.New("Frame", {
		BackgroundColor3 = active and Theme.Card or Theme.Panel,
		BorderSizePixel = 0,
		Children = {
			C.Corner(UDim.new(0, 14)),
			C.Stroke(focused and Theme.Gold or (owned and Theme.Accent or Theme.Stroke), (focused or owned) and 3 or 1),
		},
	})
	-- Franja superior con el color del pase
	C.New("Frame", {
		BackgroundColor3 = pass.accent,
		BackgroundTransparency = active and 0 or 0.6,
		Size = UDim2.new(1, 0, 0, 78),
		BorderSizePixel = 0,
		Children = {
			C.Corner(UDim.new(0, 14)),
			C.New("UIGradient", {
				Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromRGB(120, 120, 120)),
				Rotation = 90,
			}),
		},
	}, card)
	if pass.iconImage then
		C.New("ImageLabel", {
			BackgroundTransparency = 1, Image = pass.iconImage,
			Position = UDim2.fromOffset(14, 10), Size = UDim2.fromOffset(58, 58),
		}, card)
	else
		C.New("TextLabel", {
			BackgroundTransparency = 1, Text = pass.icon, TextScaled = true,
			Position = UDim2.fromOffset(14, 10), Size = UDim2.fromOffset(58, 58),
		}, card)
	end
	C.Label(pass.name, {
		Font = Theme.FontBlack, TextSize = 22, Position = UDim2.fromOffset(84, 14),
		Size = UDim2.new(1, -96, 0, 26), AutomaticSize = Enum.AutomaticSize.None, TextWrapped = false,
		TextColor3 = Color3.new(1, 1, 1), TextStrokeTransparency = 0.6,
	}).Parent = card
	local badge = C.Badge(status.text, Theme[status.color] or Theme.CardAlt,
		status.color == "Accent" and Color3.fromRGB(0, 40, 20) or Theme.Text)
	badge.Position = UDim2.fromOffset(84, 44)
	badge.Parent = card

	local body = C.New("Frame", {
		BackgroundTransparency = 1,
		Position = UDim2.fromOffset(14, 88),
		Size = UDim2.new(1, -28, 1, -150),
		Children = { C.List(nil, 6) },
	}, card)
	local add = C.Stack(body)
	add(C.Label(pass.description, { TextColor3 = Theme.TextDim, TextSize = 14 }))
	for _, benefit in ipairs(pass.benefits) do
		add(C.Label("✔  " .. benefit, { TextSize = 14, TextColor3 = active and Theme.Text or Theme.TextMuted }))
	end

	-- Pie: precio + botón
	C.Label(priceText(pass, Format), {
		Font = Theme.FontBold, TextSize = 15, TextColor3 = Theme.Gold,
		Position = UDim2.new(0, 14, 1, -96), Size = UDim2.new(1, -28, 0, 20),
		AutomaticSize = Enum.AutomaticSize.None, TextWrapped = false, TextTruncate = Enum.TextTruncate.AtEnd,
	}).Parent = card

	local waiting = ctx.pendingPurchase == pass.key
	local button = C.Button(waiting and "Esperando a Roblox…" or "Comprar", "gold", function()
		local result = ctx.act("PurchasePass", { pass = pass.key })
		if result.ok then
			ctx.pendingPurchase = pass.key
			task.delay(60, function()
				if ctx.pendingPurchase == pass.key then
					ctx.pendingPurchase = nil
				end
			end)
		end
	end, {
		Position = UDim2.new(0, 14, 1, -60),
		Size = UDim2.new(1, -28, 0, 44),
		AutomaticSize = Enum.AutomaticSize.None,
		TextSize = 18,
	})
	button.Parent = card

	if owned then
		C.SetEnabled(button, false, "✔ Pase adquirido · ventajas activas")
		button.BackgroundColor3 = Theme.AccentDark
	elseif not active then
		C.SetEnabled(button, false, "Próximamente")
	elseif pass.status == "pending_config" then
		C.SetEnabled(button, false, "Compra desactivada · falta el ID")
	elseif pass.status == "checking" then
		C.SetEnabled(button, false, "Comprobando…")
	elseif pass.status == "error" then
		C.SetEnabled(button, false, "Roblox no responde · reintentando")
	elseif pass.priceKnown and not pass.forSale then
		C.SetEnabled(button, false, "No disponible")
	elseif waiting then
		C.SetEnabled(button, false, "Esperando a Roblox…")
	end
	return card
end

function Shop.Render(container, ctx)
	local C, Theme = ctx.C, ctx.Theme
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	-- Cabecera
	local header = C.New("Frame", {
		BackgroundColor3 = Color3.fromRGB(40, 30, 8),
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Children = {
			C.Corner(UDim.new(0, 14)), C.Stroke(Theme.Gold, 2), C.Padding(14), C.List(nil, 6),
			C.New("UIGradient", {
				Color = ColorSequence.new(Color3.fromRGB(255, 220, 120), Color3.fromRGB(140, 100, 20)),
				Rotation = 0,
				Transparency = NumberSequence.new(0.75),
			}),
		},
	})
	local addH = C.Stack(header)
	addH(C.Row({
		C.Title("💎 TIENDA PREMIUM", 30),
		C.Button("🔄 Comprobar mis pases", "secondary", function()
			ctx.act("RecheckPasses")
		end),
		C.Button("✕ Cerrar tienda", "secondary", function()
			ctx.close()
		end),
	}, 16))
	addH(C.Label("Ventajas cosméticas y de personalización para tu club. Ningún pase es necesario para jugar ni para progresar: "
		.. "la economía, la construcción y la competición son iguales para todos.", { TextColor3 = Theme.Text, TextSize = 14 }))
	add(header)

	local shop = ctx.shop
	if not shop then
		add(C.Label("Cargando la tienda…", { TextColor3 = Theme.TextDim }))
		task.spawn(ctx.act, "RefreshShop")
		return
	end

	local anyPending = false
	for _, pass in ipairs(shop) do
		if pass.active and pass.status == "pending_config" then
			anyPending = true
		end
	end
	if anyPending then
		add(C.Card({ BackgroundColor3 = Color3.fromRGB(70, 45, 10) }, {
			C.Label("⚙️ <b>Pases pendientes de configuración.</b> Estos Game Passes todavía no tienen un identificador de Roblox. "
				.. "La compra está desactivada hasta que el desarrollador cree los pases en el Creator Dashboard y añada sus IDs en "
				.. "<i>ReplicatedStorage › Shared › Config › GamePassConfig</i>.", { TextSize = 14 }),
		}))
	end

	add(C.Title("⭐ Pases disponibles", 20))
	local grid = C.Grid(300, 470, 12)
	add(grid)
	local i = 0
	for _, pass in ipairs(shop) do
		if pass.active then
			i += 1
			local card = passCard(ctx, pass, ctx.params.focus == pass.key)
			card.LayoutOrder = i
			card.Parent = grid
		end
	end

	add(C.Title("🔜 Próximamente", 20))
	add(C.Label("La tienda ya está preparada para estos pases; se activarán en las fases correspondientes.",
		{ TextColor3 = Theme.TextMuted, TextSize = 13 }))
	local future = C.Grid(300, 330, 12)
	add(future)
	i = 0
	for _, pass in ipairs(shop) do
		if not pass.active then
			i += 1
			local card = passCard(ctx, pass, false)
			card.LayoutOrder = i
			card.Parent = future
		end
	end
end

return Shop
