-- PetService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/PetService
--
-- MASCOTAS Y BALONES COLECCIONABLES.
--   * Huevos y cajas: se pagan con dinero del club; el SERVIDOR sortea la rareza con las
--     probabilidades de CollectionConfig (las mismas que ve el jugador) y guarda el resultado.
--   * Mascotas equipadas (máx. 3): siguen al jugador y suman un bonus a las recompensas de los
--     partidos en grupo. Se pueden vender las repetidas.
--   * Balones: aspecto del balón de tu estadio y del balón de los partidos cuando lo tocas tú.
-- El cliente solo envía «abre este huevo» o «equipa esto»: nunca decide qué le toca.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local CollectionConfig = require(Shared.Config.CollectionConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)
local RebirthConfig = require(Shared.Config.RebirthConfig)
local Remotes = require(Shared.Modules.Remotes)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local AdminService = require(script.Parent.AdminService)

local PetService = {}

local notifyRemote = Remotes.Get("Notify")
local rng = Random.new()
local petFolder
local models = {} -- [player] = { Model, ... }
local ballCallbacks = {}

-- Posición de cada mascota respecto al jugador (detrás y a los lados; el frente es -Z)
local OFFSETS = {
	Vector3.new(-3.4, -0.8, 3.6), Vector3.new(3.4, -0.8, 3.6), Vector3.new(0, -0.8, 5.8),
	Vector3.new(-5.6, -0.8, 6.4), Vector3.new(5.6, -0.8, 6.4),
}
local SCALE = { common = 1, rare = 1.06, epic = 1.14, legendary = 1.24, mythic = 1.34 }

-- Mascotas por grupo (pool) y rareza: cada huevo solo da mascotas de su grupo
local DEFAULT_POOL = "classic"
local petsByPool, ballsByRarity = {}, {}
for _, pet in ipairs(CollectionConfig.Pets) do
	local pool = pet.pool or DEFAULT_POOL
	petsByPool[pool] = petsByPool[pool] or {}
	petsByPool[pool][pet.rarity] = petsByPool[pool][pet.rarity] or {}
	table.insert(petsByPool[pool][pet.rarity], pet)
end
-- Aviso en Output si un huevo puede sacar una rareza sin mascotas en su grupo
for _, egg in ipairs(CollectionConfig.Eggs) do
	local pool = petsByPool[egg.pool or DEFAULT_POOL] or {}
	for rarityId, weight in pairs(egg.weights) do
		if weight > 0 and not pool[rarityId] then
			warn(string.format("[PetService] El huevo %s puede dar %s pero su grupo no tiene mascotas de esa rareza", egg.id, rarityId))
		end
	end
end
for _, ball in ipairs(CollectionConfig.Balls) do
	if not ball.exclusive then -- los exclusivos del pase de temporada no salen en las cajas
		ballsByRarity[ball.rarity] = ballsByRarity[ball.rarity] or {}
		table.insert(ballsByRarity[ball.rarity], ball)
	end
end

-- Precios con el descuento de la semana (si esta semana toca huevos o cajas)
function PetService.EggCost(egg)
	return WeeklyConfig.Price(egg.cost, WeeklyConfig.ActiveBonus().eggDiscount)
end

function PetService.CrateCost(crate)
	return WeeklyConfig.Price(crate.cost, WeeklyConfig.ActiveBonus().crateDiscount)
end

-- ===== Sorteo =====

local function rollRarity(weights)
	local odds = CollectionConfig.Odds(weights, AdminService.LuckMultiplier())
	local roll = rng:NextNumber(0, 100)
	local accumulated, last = 0, nil
	for _, rarity in ipairs(CollectionConfig.Rarities) do
		local chance = odds[rarity.id] or 0
		if chance > 0 then
			last = rarity.id
			accumulated += chance
			if roll < accumulated then
				return rarity.id
			end
		end
	end
	return last
end

local function announce(player, text)
	notifyRemote:FireAllClients("info", string.format("🎉 %s %s", player.DisplayName, text))
end

-- Mascotas posibles para esa rareza en el grupo del huevo. Si no hubiera ninguna (error de
-- configuración), se usa la rareza más cercana hacia abajo y, si no, hacia arriba.
local function poolFor(egg, rarityId)
	local groups = petsByPool[egg.pool or DEFAULT_POOL] or petsByPool[DEFAULT_POOL]
	if groups[rarityId] then
		return groups[rarityId]
	end
	local order = {}
	for i, rarity in ipairs(CollectionConfig.Rarities) do
		order[rarity.id] = i
	end
	local start = order[rarityId] or 1
	for distance = 1, #CollectionConfig.Rarities do
		for _, index in ipairs({ start - distance, start + distance }) do
			local rarity = CollectionConfig.Rarities[index]
			if rarity and groups[rarity.id] then
				return groups[rarity.id]
			end
		end
	end
	return petsByPool[DEFAULT_POOL].common
end

-- Huecos de mascota equipada de este jugador (3, más los que dan los renacimientos)
function PetService.MaxPets(data)
	return math.min(CollectionConfig.ABSOLUTE_MAX_PETS,
		RebirthConfig.PetSlots(data.rebirth and data.rebirth.count, CollectionConfig.MAX_EQUIPPED_PETS))
end

-- Sortea una mascota de ese huevo y la guarda. Devuelve la mascota, su rareza y si es nueva.
local function hatchInto(player, data, egg)
	local pool = poolFor(egg, rollRarity(egg.weights))
	local pet = pool[rng:NextInteger(1, #pool)]
	local rarityId = pet.rarity
	local collection = data.collection
	collection.pets[pet.id] = math.min(999, (collection.pets[pet.id] or 0) + 1)
	collection.hatched += 1
	local rarity = CollectionConfig.RarityById[rarityId]
	local isNew = collection.pets[pet.id] == 1
	if rarityId == "legendary" or rarityId == "mythic" then
		announce(player, string.format("ha conseguido la mascota %s %s (%s)", pet.icon, pet.name, rarity.name))
	end
	return pet, rarity, isNew
end

function PetService.Hatch(player, payload)
	local data = DataService.Get(player)
	local egg = type(payload) == "table" and type(payload.egg) == "string" and CollectionConfig.EggById[payload.egg]
	if not egg then
		return false, "Ese huevo no existe."
	end
	if egg.requiresRebirth and data.rebirth.count < egg.requiresRebirth then
		return false, string.format("El %s se desbloquea al renacer %d vez.", egg.name, egg.requiresRebirth)
	end
	local paid, payError = EconomyService.Spend(player, PetService.EggCost(egg), EconomyService.Category.COLLECTION, egg.name)
	if not paid then
		return false, payError
	end
	local pet, rarity, isNew = hatchInto(player, data, egg)
	return true, string.format("%s ¡%s! Mascota %s%s.", pet.icon, pet.name, rarity.name, isNew and " · ¡NUEVA!" or ""), false,
		{ kind = "pet", id = pet.id, isNew = isNew }
end

-- Huevo regalado (recompensa del pase de temporada): se abre al momento, sin cobrar.
function PetService.GrantEgg(player, eggId)
	local data = DataService.Get(player)
	local egg = CollectionConfig.EggById[eggId]
	if not data or not egg then
		return nil
	end
	local pet, rarity, isNew = hatchInto(player, data, egg)
	return string.format("%s %s (%s)%s", pet.icon, pet.name, rarity.name, isNew and " · ¡nueva!" or "")
end

-- Balón regalado (recompensa del pase): sortea la rareza de esa caja y da un balón que NO tengas.
-- Si ya tienes todos los de esa rareza, busca en las demás; devuelve nil si ya los tienes todos.
function PetService.GrantBall(player, crateId)
	local data = DataService.Get(player)
	local crate = CollectionConfig.CrateById[crateId]
	if not data or not crate then
		return nil
	end
	local collection = data.collection
	local function missing(rarityId)
		local list = {}
		for _, ball in ipairs(ballsByRarity[rarityId] or {}) do
			if ball.id ~= CollectionConfig.DEFAULT_BALL and not collection.balls[ball.id] then
				table.insert(list, ball)
			end
		end
		return list
	end
	local candidates = missing(rollRarity(crate.weights))
	if #candidates == 0 then
		for _, rarity in ipairs(CollectionConfig.Rarities) do
			for _, ball in ipairs(missing(rarity.id)) do
				table.insert(candidates, ball)
			end
		end
	end
	if #candidates == 0 then
		return nil
	end
	local ball = candidates[rng:NextInteger(1, #candidates)]
	collection.balls[ball.id] = true
	return string.format("%s Balón %s (%s)", ball.icon, ball.name, CollectionConfig.RarityById[ball.rarity].name)
end

function PetService.OpenCrate(player, payload)
	local data = DataService.Get(player)
	local crate = type(payload) == "table" and type(payload.crate) == "string" and CollectionConfig.CrateById[payload.crate]
	if not crate then
		return false, "Esa caja no existe."
	end
	local cost = PetService.CrateCost(crate)
	local paid, payError = EconomyService.Spend(player, cost, EconomyService.Category.COLLECTION, crate.name)
	if not paid then
		return false, payError
	end
	local rarityId = rollRarity(crate.weights)
	local pool = ballsByRarity[rarityId]
	local ball = pool[rng:NextInteger(1, #pool)]
	local collection = data.collection
	local rarity = CollectionConfig.RarityById[rarityId]
	local owned = ball.id == CollectionConfig.DEFAULT_BALL or collection.balls[ball.id] == true
	collection.crates += 1
	if owned then
		local refund = math.floor(cost * CollectionConfig.DUPLICATE_BALL_REFUND)
		EconomyService.Earn(player, refund, EconomyService.Category.REFUND, "Balón repetido: " .. ball.name)
		return true, string.format("%s %s (%s) repetido: te devolvemos %d $.", ball.icon, ball.name, rarity.name, refund), false,
			{ kind = "ball", id = ball.id, isNew = false, refund = refund }
	end
	collection.balls[ball.id] = true
	if rarityId == "legendary" or rarityId == "mythic" then
		announce(player, string.format("ha conseguido el balón %s %s (%s)", ball.icon, ball.name, rarity.name))
	end
	return true, string.format("%s ¡%s! Balón %s · ¡NUEVO!", ball.icon, ball.name, rarity.name), false,
		{ kind = "ball", id = ball.id, isNew = true }
end

-- ===== Equipar y vender =====

function PetService.EquipPet(player, payload)
	local data = DataService.Get(player)
	local pet = type(payload) == "table" and type(payload.pet) == "string" and CollectionConfig.PetById[payload.pet]
	if not pet then
		return false, "Esa mascota no existe."
	end
	local collection = data.collection
	local index = table.find(collection.equippedPets, pet.id)
	if payload.equip == true then
		if (collection.pets[pet.id] or 0) < 1 then
			return false, "No tienes esa mascota."
		end
		if index then
			return false, "Ya la llevas equipada."
		end
		local maxPets = PetService.MaxPets(data)
		if #collection.equippedPets >= maxPets then
			return false, string.format("Solo puedes llevar %d mascotas a la vez. Quita una primero (renacer da más huecos).", maxPets)
		end
		table.insert(collection.equippedPets, pet.id)
		PetService.Refresh(player)
		return true, string.format("%s %s te acompaña (+%d%% en partidos).", pet.icon, pet.name, math.floor(pet.bonus * 100 + 0.5))
	end
	if not index then
		return false, "No la llevas equipada."
	end
	table.remove(collection.equippedPets, index)
	PetService.Refresh(player)
	return true, string.format("%s %s descansa.", pet.icon, pet.name)
end

function PetService.SellPet(player, payload)
	local data = DataService.Get(player)
	local pet = type(payload) == "table" and type(payload.pet) == "string" and CollectionConfig.PetById[payload.pet]
	if not pet then
		return false, "Esa mascota no existe."
	end
	local collection = data.collection
	local count = collection.pets[pet.id] or 0
	if count < 1 then
		return false, "No tienes esa mascota."
	end
	count -= 1
	collection.pets[pet.id] = count > 0 and count or nil
	if count == 0 then
		local index = table.find(collection.equippedPets, pet.id)
		if index then
			table.remove(collection.equippedPets, index)
			PetService.Refresh(player)
		end
	end
	local value = CollectionConfig.RarityById[pet.rarity].sell
	EconomyService.Earn(player, value, EconomyService.Category.COLLECTION, "Venta: " .. pet.name)
	return true, string.format("%s %s vendida por %d $.", pet.icon, pet.name, value)
end

function PetService.EquipBall(player, payload)
	local data = DataService.Get(player)
	local ball = type(payload) == "table" and type(payload.ball) == "string" and CollectionConfig.BallById[payload.ball]
	if not ball then
		return false, "Ese balón no existe."
	end
	local collection = data.collection
	if ball.id ~= CollectionConfig.DEFAULT_BALL and collection.balls[ball.id] ~= true then
		return false, "Todavía no tienes ese balón."
	end
	collection.ball = ball.id
	for _, callback in ipairs(ballCallbacks) do
		task.spawn(callback, player, ball.id)
	end
	return true, string.format("%s Balón %s equipado.", ball.icon, ball.name)
end

function PetService.OnBallChanged(callback)
	table.insert(ballCallbacks, callback)
end

-- ===== Consultas =====

local function bonusOf(data)
	local total = 0
	for _, petId in ipairs(data.collection.equippedPets) do
		local pet = CollectionConfig.PetById[petId]
		if pet then
			total += pet.bonus
		end
	end
	return total
end

-- Bonus (fracción) que las mascotas equipadas suman a las recompensas de los partidos en grupo.
function PetService.Bonus(player)
	local data = DataService.Get(player)
	return data and bonusOf(data) or 0
end

function PetService.BallOf(player)
	local data = DataService.Get(player)
	return data and data.collection.ball or CollectionConfig.DEFAULT_BALL
end

function PetService.BuildState(data)
	local collection = data.collection
	return {
		pets = collection.pets,
		equippedPets = collection.equippedPets,
		balls = collection.balls,
		ball = collection.ball,
		bonus = bonusOf(data),
		maxPets = PetService.MaxPets(data),
		rebirths = data.rebirth.count,
		hatched = collection.hatched,
		luck = AdminService.LuckMultiplier(),
	}
end

-- ===== Mascotas en el mundo =====

local function petPart(model, className, size, color, material)
	local p = Instance.new(className)
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = model
	return p
end

local function buildPet(def, cframe)
	local s = SCALE[def.rarity] or 1
	local material = def.neon and Enum.Material.Neon or Enum.Material.SmoothPlastic
	local model = Instance.new("Model")
	model.Name = "Pet_" .. def.id
	local root = petPart(model, "Part", Vector3.new(2.2, 2.2, 2.2) * s, def.body, material)
	root.Name = "Body"
	root.Shape = Enum.PartType.Ball
	root.CFrame = cframe
	model.PrimaryPart = root

	local function add(className, size, offset, color, shape, partMaterial)
		local p = petPart(model, className, size * s, color, partMaterial or material)
		if shape then
			p.Shape = shape
		end
		p.CFrame = cframe * CFrame.new(offset.Position * s) * offset.Rotation
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = p
		weld.Parent = p
		return p
	end
	local ball = Enum.PartType.Ball
	local plastic = Enum.Material.SmoothPlastic
	add("Part", Vector3.new(1.6, 1.6, 1.6), CFrame.new(0, 0.9, -0.9), def.body, ball)
	add("Part", Vector3.new(0.5, 0.5, 0.5), CFrame.new(0, 0.1, 1.15), def.accent, ball)
	for _, side in ipairs({ -1, 1 }) do
		add("Part", Vector3.new(0.28, 0.28, 0.28), CFrame.new(side * 0.38, 1.15, -1.58), Color3.fromRGB(20, 20, 25), ball, plastic)
	end
	if def.beak then
		add("Part", Vector3.new(0.45, 0.35, 0.7), CFrame.new(0, 0.8, -1.8), Color3.fromRGB(255, 150, 40), nil, plastic)
	else
		add("Part", Vector3.new(0.7, 0.6, 0.6), CFrame.new(0, 0.7, -1.55), def.accent, ball, plastic)
	end
	for _, side in ipairs({ -1, 1 }) do
		if def.ears == "floppy" then
			add("Part", Vector3.new(0.3, 0.9, 0.6), CFrame.new(side * 0.85, 0.85, -0.9), def.accent, nil, plastic)
		elseif def.ears == "pointy" then
			add("Part", Vector3.new(0.5, 0.75, 0.25), CFrame.new(side * 0.5, 1.8, -0.9) * CFrame.Angles(0, 0, math.rad(-side * 18)), def.body)
		elseif def.ears == "long" then
			add("Part", Vector3.new(0.35, 1.4, 0.25), CFrame.new(side * 0.4, 2.2, -0.9), def.body)
		elseif def.ears == "round" then
			add("Part", Vector3.new(0.6, 0.6, 0.6), CFrame.new(side * 0.6, 1.7, -0.9), def.accent, ball, plastic)
		end
		if def.wings then
			add("Part", Vector3.new(0.15, 0.9, 1.3), CFrame.new(side * 1.3, 0.45, 0.1) * CFrame.Angles(0, 0, math.rad(-side * 28)), def.accent, nil, plastic)
		end
	end
	if def.mane then
		-- Disco detrás de la cara (el eje del cilindro es X: se gira para ponerlo de frente)
		add("Part", Vector3.new(0.5, 2.3, 2.3), CFrame.new(0, 0.9, -0.55) * CFrame.Angles(0, math.rad(90), 0), def.accent, Enum.PartType.Cylinder, plastic)
	end
	if def.horn then
		add("Part", Vector3.new(0.22, 0.9, 0.22), CFrame.new(0, 1.95, -1.2) * CFrame.Angles(math.rad(-20), 0, 0), Color3.fromRGB(255, 205, 70), nil, Enum.Material.Neon)
	end
	if def.fin then
		add("WedgePart", Vector3.new(0.15, 0.9, 1), CFrame.new(0, 1.4, 0.2), def.body:Lerp(Color3.new(0, 0, 0), 0.25), nil, plastic)
	end
	if def.sparkles then
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = def.sparkles
		sparkles.Parent = root
	end
	if def.fire then
		local fire = Instance.new("Fire")
		fire.Size = 3 * s
		fire.Heat = 5
		fire.Color = Color3.fromRGB(255, 170, 40)
		fire.SecondaryColor = Color3.fromRGB(255, 230, 120)
		fire.Parent = root
	end

	local rarity = CollectionConfig.RarityById[def.rarity]
	local tag = Instance.new("BillboardGui")
	tag.Size = UDim2.fromOffset(130, 22)
	tag.StudsOffset = Vector3.new(0, 2.6 * s, 0)
	tag.MaxDistance = 45
	tag.Parent = root
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.TextColor3 = rarity.color
	label.TextStrokeTransparency = 0.3
	label.Text = def.name
	label.Parent = tag
	return model, root
end

local function clear(player)
	for _, model in ipairs(models[player] or {}) do
		model:Destroy()
	end
	models[player] = nil
end

-- Vuelve a crear las mascotas equipadas junto al personaje actual del jugador.
function PetService.Refresh(player)
	clear(player)
	local data = DataService.Get(player)
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart")
	if not data or not hrp or not petFolder then
		return
	end
	local list = {}
	for i, petId in ipairs(data.collection.equippedPets) do
		local def = CollectionConfig.PetById[petId]
		local offset = OFFSETS[i]
		if def and offset then
			local model, root = buildPet(def, hrp.CFrame * CFrame.new(offset))
			-- La mascota sigue un punto fijo junto al jugador (sin empujarlo: no hay fuerza de reacción)
			local target = Instance.new("Attachment")
			target.Name = "PetTarget" .. i
			target.Position = offset
			target.Parent = hrp
			local anchor = Instance.new("Attachment")
			anchor.Parent = root
			local position = Instance.new("AlignPosition")
			position.Attachment0 = anchor
			position.Attachment1 = target
			position.MaxForce = 100000
			position.Responsiveness = 22
			position.Parent = root
			local orientation = Instance.new("AlignOrientation")
			orientation.Attachment0 = anchor
			orientation.Attachment1 = target
			orientation.MaxTorque = 100000
			orientation.Responsiveness = 16
			orientation.Parent = root
			model.Destroying:Connect(function()
				target:Destroy()
			end)
			model.Parent = petFolder
			pcall(function()
				root:SetNetworkOwner(player) -- movimiento fluido en la pantalla de su dueño
			end)
			table.insert(list, model)
		end
	end
	models[player] = list
end

function PetService.CharacterAdded(player)
	task.wait(0.6) -- deja que el personaje se coloque en su estadio
	if player.Parent then
		PetService.Refresh(player)
	end
end

function PetService.PlayerRemoving(player)
	clear(player)
end

function PetService.Start()
	petFolder = Instance.new("Folder")
	petFolder.Name = "FEU_Pets"
	petFolder.Parent = Workspace
end

return PetService
