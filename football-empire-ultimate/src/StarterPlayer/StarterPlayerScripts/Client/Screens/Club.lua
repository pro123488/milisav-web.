-- Club (ModuleScript) · Pantalla "Mi club"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Club
-- Nombre, abreviatura y apariencia del club (escudo, colores, equipación, efectos).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared.Config.GameConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local KitPattern = require(Shared.Modules.KitPattern)

local UI = script.Parent.Parent:WaitForChild("UI")
local Premium = require(UI.Premium)

local Club = {}

local function appearanceSection(ctx, title, slot, items, makeVisual)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local card = C.Card({}, { C.Title(title, 18) })
	local grid = C.Grid(120, 120, 8)
	grid.Parent = card
	for i, item in ipairs(items) do
		local locked = Premium.IsLocked(state, item)
		local selected = state.club.appearance[slot] == item.id
		local tile = C.OptionTile(item.name, item.requiredPass and Premium.PassName(item.requiredPass) or "Gratis", {
			selected = selected,
			locked = locked,
			lockText = Premium.LockText(item),
			onClick = function()
				if locked then
					Premium.OnLockedClick(ctx, item)
				elseif not selected then
					ctx.act("SetAppearance", { slot = slot, id = item.id })
				end
			end,
		}, makeVisual(item))
		tile.LayoutOrder = i
		tile.Parent = grid
	end
	-- Aviso si la selección guardada no puede mostrarse (pase no confirmado ahora mismo)
	if state.club.appearance[slot] ~= state.club.effectiveAppearance[slot] then
		C.Label("⚠️ Tu selección guardada requiere un pase cuya propiedad no está confirmada ahora mismo. Se muestra la opción gratuita hasta que Roblox lo confirme.",
			{ TextColor3 = Theme.Warning, TextSize = 13 }).Parent = card
	end
	return card
end

function Club.Render(container, ctx)
	local C, Theme, state = ctx.C, ctx.Theme, ctx.state
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Title("🛡️ Mi club", 26))

	-- Tarjeta de perfil
	local eff = state.club.effectiveAppearance
	local palette = CosmeticConfig.ById.palette[eff.palette]
	local crest = CosmeticConfig.ById.crest[eff.crest]
	local kit = CosmeticConfig.ById.kit[eff.kit]
	local profile = C.New("Frame", {
		BackgroundColor3 = Theme.Panel,
		Size = UDim2.new(1, 0, 0, 130),
		Children = { C.Corner(), C.Stroke(state.premium.owned.VIP_CLUB and Theme.Gold or palette.primary, 2) },
	})
	C.New("TextLabel", {
		BackgroundColor3 = palette.primary,
		Position = UDim2.fromOffset(15, 15),
		Size = UDim2.fromOffset(100, 100),
		Text = crest.symbol,
		TextScaled = true,
		Children = { C.Corner(UDim.new(0.5, 0)), C.Stroke(palette.secondary, 4) },
	}, profile)
	local kitFrame = C.New("Frame", {
		Position = UDim2.new(1, -95, 0, 20),
		Size = UDim2.fromOffset(80, 90),
		BorderSizePixel = 0,
		Children = { C.Corner(UDim.new(0, 8)) },
	}, profile)
	KitPattern.Build(kitFrame, kit.pattern, palette.primary, palette.secondary)
	local info = C.New("Frame", {
		BackgroundTransparency = 1,
		Position = UDim2.fromOffset(130, 15),
		Size = UDim2.new(1, -240, 1, -30),
		Children = { C.List(nil, 4) },
	}, profile)
	local addInfo = C.Stack(info)
	addInfo(C.Label(state.club.name, { Font = Theme.FontBlack, TextSize = 24 }))
	addInfo(C.Label(string.format("%s · Presidente: %s", state.club.shortName, state.club.ownerName), { TextColor3 = Theme.TextDim }))
	if state.premium.owned.VIP_CLUB then
		addInfo(C.Badge("👑 VIP CLUB", Theme.Gold, Color3.fromRGB(35, 25, 0)))
	end
	add(profile)

	-- Nombre del club
	ctx.drafts.clubName = ctx.drafts.clubName or (state.club.named and state.club.name or "")
	ctx.drafts.shortName = ctx.drafts.shortName or (state.club.named and state.club.shortName or "")
	local function textBox(placeholder, key, maxLen, width)
		local box = C.New("TextBox", {
			PlaceholderText = placeholder,
			Text = ctx.drafts[key],
			ClearTextOnFocus = false,
			Font = Theme.Font,
			TextSize = 16,
			TextColor3 = Theme.Text,
			PlaceholderColor3 = Theme.TextMuted,
			BackgroundColor3 = Theme.Panel,
			Size = UDim2.new(0, width, 0, 40),
			TextXAlignment = Enum.TextXAlignment.Left,
			Children = { C.Corner(Theme.RadiusSmall), C.Stroke(), C.Padding(4, 10) },
		})
		box:GetPropertyChangedSignal("Text"):Connect(function()
			if utf8.len(box.Text) and utf8.len(box.Text) > maxLen then
				box.Text = string.sub(box.Text, 1, utf8.offset(box.Text, maxLen + 1) - 1)
			end
			ctx.drafts[key] = box.Text
		end)
		return box
	end
	add(C.Card({}, {
		C.Title("✏️ Nombre del club", 18),
		C.Label(string.format("Entre %d y %d caracteres. Abreviatura de %d letras o números. Se aplica el filtro de texto de Roblox.",
			GameConfig.CLUB_NAME_MIN, GameConfig.CLUB_NAME_MAX, GameConfig.SHORT_NAME_LEN), { TextColor3 = Theme.TextDim, TextSize = 13 }),
		C.Row({
			textBox("Nombre del club", "clubName", GameConfig.CLUB_NAME_MAX, 260),
			textBox("ABC", "shortName", GameConfig.SHORT_NAME_LEN, 80),
			C.Button("Guardar nombre", "primary", function()
				local result = ctx.act("SetClubName", { name = ctx.drafts.clubName, shortName = ctx.drafts.shortName })
				if result.ok then
					ctx.drafts.clubName, ctx.drafts.shortName = nil, nil
				end
			end),
		}, 10),
	}))

	-- Apariencia
	add(appearanceSection(ctx, "🛡️ Escudo", "crest", CosmeticConfig.Crests, function(item)
		return C.New("TextLabel", {
			BackgroundTransparency = 1,
			Position = UDim2.fromOffset(0, 6),
			Size = UDim2.new(1, 0, 1, -50),
			Text = item.symbol,
			TextScaled = true,
		})
	end))
	add(appearanceSection(ctx, "🎨 Colores", "palette", CosmeticConfig.Palettes, function(item)
		return C.New("Frame", {
			BackgroundTransparency = 1,
			Position = UDim2.new(0.15, 0, 0, 12),
			Size = UDim2.new(0.7, 0, 1, -60),
			Children = {
				C.New("Frame", { BackgroundColor3 = item.primary, Size = UDim2.fromScale(0.5, 1), BorderSizePixel = 0 }),
				C.New("Frame", { BackgroundColor3 = item.secondary, Position = UDim2.fromScale(0.5, 0), Size = UDim2.fromScale(0.5, 1), BorderSizePixel = 0 }),
			},
		})
	end))
	add(appearanceSection(ctx, "👕 Equipación", "kit", CosmeticConfig.Kits, function(item)
		local frame = C.New("Frame", {
			Position = UDim2.new(0.25, 0, 0, 10),
			Size = UDim2.new(0.5, 0, 1, -56),
			BorderSizePixel = 0,
		})
		KitPattern.Build(frame, item.pattern, palette.primary, palette.secondary)
		return frame
	end))
	add(appearanceSection(ctx, "✨ Efectos visuales del estadio", "effect", CosmeticConfig.Effects, function(item)
		local icons = { none = "➖", confetti = "🎊", sparkles = "✨", smoke = "🌫️", vip_gold = "🌟" }
		return C.New("TextLabel", {
			BackgroundTransparency = 1,
			Position = UDim2.fromOffset(0, 8),
			Size = UDim2.new(1, 0, 1, -54),
			Text = icons[item.id] or "✨",
			TextScaled = true,
		})
	end))
end

return Club
