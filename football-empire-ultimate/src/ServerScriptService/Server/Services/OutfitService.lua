-- OutfitService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/OutfitService
--
-- TRAJES DE FUTBOLISTA: pinta una equipación sobre el personaje (camiseta, pantalón, medias,
-- botas y dorsal en la espalda). Se compran con dinero del club o salen del pase de temporada.
-- Para que la equipación se vea, se quitan la ropa clásica (Shirt/Pants) y la ropa 3D del avatar;
-- el pelo, los gorros y el resto de accesorios se conservan. «Tu avatar» devuelve el aspecto normal.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local OutfitConfig = require(Shared.Config.OutfitConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local ClubService = require(script.Parent.ClubService)

local OutfitService = {}

-- Ropa 3D (layered clothing) que taparía la equipación
local LAYERED = {
	[Enum.AccessoryType.Shirt] = true, [Enum.AccessoryType.TShirt] = true, [Enum.AccessoryType.Jacket] = true,
	[Enum.AccessoryType.Sweater] = true, [Enum.AccessoryType.Pants] = true, [Enum.AccessoryType.Shorts] = true,
	[Enum.AccessoryType.DressSkirt] = true, [Enum.AccessoryType.LeftShoe] = true, [Enum.AccessoryType.RightShoe] = true,
}
local DARK_BOOTS = Color3.fromRGB(25, 25, 30)

local function readable(color)
	local luminance = 0.299 * color.R + 0.587 * color.G + 0.114 * color.B
	return luminance > 0.6 and Color3.fromRGB(20, 20, 25) or Color3.fromRGB(255, 255, 255)
end

-- Colores finales del traje (el del club usa la paleta real del club)
local function resolve(player, data, def)
	if def.club then
		local appearance = ClubService.EffectiveAppearance(player, data)
		local palette = CosmeticConfig.ById.palette[appearance.palette]
		return { shirt = palette.primary, shorts = palette.secondary, socks = palette.primary, boots = DARK_BOOTS, trim = readable(palette.primary) }
	end
	return def
end

function OutfitService.Owns(data, outfitId)
	local def = OutfitConfig.ById[outfitId]
	if not def then
		return false
	end
	return def.id == OutfitConfig.DEFAULT or def.club == true or data.collection.outfits[outfitId] == true
end

local function paint(character, names, color)
	for _, name in ipairs(names) do
		local limb = character:FindFirstChild(name)
		if limb and limb:IsA("BasePart") then
			limb.Color = color
			if limb:IsA("MeshPart") then
				limb.TextureID = ""
			end
		end
	end
end

local function applyTo(player, character, def, data)
	for _, child in ipairs(character:GetChildren()) do
		if child:IsA("Shirt") or child:IsA("Pants") or child:IsA("ShirtGraphic") or child:IsA("BodyColors") then
			child:Destroy()
		elseif child:IsA("Accessory") and LAYERED[child.AccessoryType] then
			child:Destroy()
		end
	end
	local colors = resolve(player, data, def)
	-- Nombres de R15 y de R6 (los que no existan se ignoran)
	paint(character, { "UpperTorso", "Torso", "LeftUpperArm", "RightUpperArm" }, colors.shirt)
	paint(character, { "LowerTorso", "LeftUpperLeg", "RightUpperLeg", "Left Leg", "Right Leg" }, colors.shorts)
	paint(character, { "LeftLowerLeg", "RightLowerLeg" }, colors.socks)
	paint(character, { "LeftFoot", "RightFoot" }, colors.boots)
	if colors.gloves then
		paint(character, { "LeftHand", "RightHand" }, colors.gloves)
	end

	local torso = character:FindFirstChild("UpperTorso") or character:FindFirstChild("Torso")
	local old = torso and torso:FindFirstChild("FEU_Dorsal")
	if old then
		old:Destroy()
	end
	local number = data.collection.dorsal or def.number
	if torso and number then
		local gui = Instance.new("SurfaceGui")
		gui.Name = "FEU_Dorsal"
		gui.Face = Enum.NormalId.Back
		gui.SizingMode = Enum.SurfaceGuiSizingMode.FixedSize
		gui.CanvasSize = Vector2.new(120, 120)
		gui.LightInfluence = 0.3
		gui.Parent = torso
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(0.8, 0.7)
		label.Position = UDim2.fromScale(0.1, 0.12)
		label.BackgroundTransparency = 1
		label.Font = Enum.Font.GothamBlack
		label.TextScaled = true
		label.TextColor3 = colors.trim
		label.Text = tostring(number)
		label.Parent = gui
	end
	character:SetAttribute("Outfit", def.id)
end

-- Aplica al personaje actual el traje equipado (o devuelve el avatar normal si es «Tu avatar»).
function OutfitService.Apply(player)
	local data = DataService.Get(player)
	local character = player.Character
	if not data or not character then
		return
	end
	local def = OutfitConfig.ById[data.collection.outfit] or OutfitConfig.ById[OutfitConfig.DEFAULT]
	if def.id == OutfitConfig.DEFAULT then
		if character:GetAttribute("Outfit") then
			-- Volver al avatar normal: Roblox lo vuelve a cargar entero
			task.spawn(function()
				pcall(function()
					player:LoadCharacter()
				end)
			end)
		end
		return
	end
	-- La ropa del avatar llega un momento después de aparecer: se espera para poder quitarla
	if not player:HasAppearanceLoaded() then
		local loaded = false
		local connection = player.CharacterAppearanceLoaded:Connect(function()
			loaded = true
		end)
		local startedAt = os.clock()
		while not loaded and os.clock() - startedAt < 8 and player.Parent do
			task.wait(0.2)
		end
		connection:Disconnect()
	end
	if player.Character ~= character or not character.Parent then
		return
	end
	local current = DataService.Get(player)
	if current then
		applyTo(player, character, OutfitConfig.ById[current.collection.outfit] or def, current)
	end
end

function OutfitService.CharacterAdded(player)
	local data = DataService.Get(player)
	if data and data.collection.outfit ~= OutfitConfig.DEFAULT then
		OutfitService.Apply(player)
	end
end

-- ===== Acciones =====

function OutfitService.Buy(player, payload)
	local data = DataService.Get(player)
	local def = type(payload) == "table" and type(payload.outfit) == "string" and OutfitConfig.ById[payload.outfit]
	if not def then
		return false, "Ese traje no existe."
	end
	if OutfitService.Owns(data, def.id) then
		return false, "Ya tienes ese traje."
	end
	if def.exclusive then
		return false, "Ese traje solo se consigue en el pase de temporada."
	end
	local paid, payError = EconomyService.Spend(player, def.cost, EconomyService.Category.COLLECTION, "Traje: " .. def.name)
	if not paid then
		return false, payError
	end
	data.collection.outfits[def.id] = true
	return true, string.format("%s Traje «%s» comprado. ¡Equípatelo!", def.icon, def.name)
end

function OutfitService.Equip(player, payload)
	local data = DataService.Get(player)
	local def = type(payload) == "table" and type(payload.outfit) == "string" and OutfitConfig.ById[payload.outfit]
	if not def then
		return false, "Ese traje no existe."
	end
	if not OutfitService.Owns(data, def.id) then
		return false, "Todavía no tienes ese traje."
	end
	data.collection.outfit = def.id
	task.spawn(OutfitService.Apply, player)
	return true, def.id == OutfitConfig.DEFAULT and "Vuelves a llevar tu avatar." or string.format("%s Llevas «%s».", def.icon, def.name)
end

-- Dorsal personalizado (1-99). Con 0 o vacío se usa el número propio de cada traje.
function OutfitService.SetDorsal(player, payload)
	local data = DataService.Get(player)
	if type(payload) ~= "table" then
		return false, "Solicitud no válida."
	end
	local number = tonumber(payload.number) or 0
	if number ~= number or number ~= math.floor(number) or number < 0 or number > OutfitConfig.MAX_NUMBER then
		return false, string.format("El dorsal debe ser un número entre %d y %d.", OutfitConfig.MIN_NUMBER, OutfitConfig.MAX_NUMBER)
	end
	data.collection.dorsal = number >= OutfitConfig.MIN_NUMBER and number or nil
	if data.collection.outfit ~= OutfitConfig.DEFAULT then
		task.spawn(OutfitService.Apply, player)
	end
	return true, data.collection.dorsal and string.format("Dorsal %d guardado.", number) or "Dorsal por defecto de cada traje."
end

function OutfitService.BuildState(data)
	return {
		owned = data.collection.outfits,
		equipped = data.collection.outfit,
		dorsal = data.collection.dorsal,
	}
end

return OutfitService
