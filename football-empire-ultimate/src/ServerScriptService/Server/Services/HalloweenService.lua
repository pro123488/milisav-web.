-- HalloweenService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/HalloweenService
--
-- EVENTO «DOCES OU TRAVESSURAS» (truco o trato):
--   * Caramelos por el campo, la plaza y los carriles de cada estadio. Se recogen tocándolos
--     (también en estadios ajenos: ¡a visitar a los vecinos!).
--   * En las puertas de las instalaciones (tecla F): trato = caramelos, truco = efecto divertido.
--   * Canje de caramelos por dinero o cosméticos de Halloween (gratuitos, sin Game Pass).
-- Todo se valida en el servidor: el cliente nunca decide cuántos caramelos tiene.

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local HalloweenConfig = require(Shared.Config.HalloweenConfig)
local Remotes = require(Shared.Modules.Remotes)
local Layout = require(Shared.Modules.StadiumLayout)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StadiumService = require(script.Parent.StadiumService)

local HalloweenService = {}

local notifyRemote = Remotes.Get("Notify")
local rng = Random.new()
local doorCooldowns = {} -- [player] = { [clave de puerta] = os.clock() }
local plotFolders = {} -- [plot] = Folder

function HalloweenService.IsActive()
	return HalloweenConfig.IsActive()
end

-- ===== Caramelos =====

-- Punto aleatorio por donde se puede caminar: césped, plaza o huecos de los carriles.
local function randomSpot()
	local roll = rng:NextNumber()
	if roll < 0.4 then
		return Vector3.new(rng:NextInteger(-45, 45), 1.6, Layout.PITCH_CENTER_Z + rng:NextInteger(-28, 28))
	elseif roll < 0.8 then
		local x = rng:NextInteger(-90, 90)
		if math.abs(x) < 16 then
			x = 16 * (x < 0 and -1 or 1) + x -- deja libre el cartel
		end
		return Vector3.new(x, 1.6, rng:NextInteger(74, 100))
	end
	local gaps = { -40, 13, 63 }
	local side = rng:NextNumber() < 0.5 and -1 or 1
	return Vector3.new(side * rng:NextInteger(100, 140), 1.6, gaps[rng:NextInteger(1, #gaps)] + rng:NextInteger(-6, 6))
end

local spawnCandy -- declarada más abajo

local function collect(player, candy, plot)
	local data = DataService.Get(player)
	if not data or not candy.Parent then
		return
	end
	local value = candy:GetAttribute("Value") or HalloweenConfig.CANDY_VALUE
	candy:Destroy()
	data.halloween.candy += value
	data.halloween.total += value
	notifyRemote:FireClient(player, "candy", { candy = data.halloween.candy, gained = value })
	task.delay(HalloweenConfig.CANDY_RESPAWN_SECONDS, function()
		if plotFolders[plot] and plotFolders[plot].Parent then
			spawnCandy(plot)
		end
	end)
end

spawnCandy = function(plot)
	local folder = plotFolders[plot]
	if not folder then
		return
	end
	local golden = rng:NextNumber() < HalloweenConfig.GOLDEN_CHANCE
	local candy = Instance.new("Part")
	candy.Name = "Candy"
	candy.Shape = Enum.PartType.Ball
	candy.Size = golden and Vector3.new(2.2, 2.2, 2.2) or Vector3.new(1.6, 1.6, 1.6)
	candy.Anchored = true
	candy.CanCollide = false
	candy.Material = Enum.Material.Neon
	candy.Color = golden and Color3.fromRGB(255, 215, 60) or (rng:NextNumber() < 0.5 and Color3.fromRGB(255, 120, 20) or Color3.fromRGB(170, 70, 220))
	candy.CFrame = plot.origin * CFrame.new(randomSpot())
	candy:SetAttribute("Value", golden and HalloweenConfig.GOLDEN_VALUE or HalloweenConfig.CANDY_VALUE)
	local light = Instance.new("PointLight")
	light.Color = candy.Color
	light.Range = 6
	light.Brightness = 1.5
	light.Parent = candy
	local sparkle = Instance.new("Sparkles")
	sparkle.SparkleColor = candy.Color
	sparkle.Enabled = golden
	sparkle.Parent = candy
	candy.Touched:Connect(function(hit)
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if player and humanoid and humanoid.Health > 0 then
			collect(player, candy, plot)
		end
	end)
	candy.Parent = folder
end

-- Ambientación: calabazas en la puerta y en las esquinas de la plaza.
local function decoratePlot(plot, folder)
	local spots = { Vector3.new(-14, 0, 103), Vector3.new(14, 0, 103), Vector3.new(-95, 0, 75), Vector3.new(95, 0, 75) }
	for _, pos in ipairs(spots) do
		local pumpkin = Instance.new("Part")
		pumpkin.Shape = Enum.PartType.Ball
		pumpkin.Size = Vector3.new(4, 3.4, 4)
		pumpkin.Anchored = true
		pumpkin.Color = Color3.fromRGB(240, 120, 20)
		pumpkin.Material = Enum.Material.SmoothPlastic
		pumpkin.CFrame = plot.origin * CFrame.new(pos + Vector3.new(0, 1.7, 0))
		pumpkin.Parent = folder
		local glow = Instance.new("PointLight")
		glow.Color = Color3.fromRGB(255, 150, 50)
		glow.Range = 12
		glow.Brightness = 2
		glow.Parent = pumpkin
	end
end

function HalloweenService.SetupPlot(plot)
	if not HalloweenService.IsActive() or plotFolders[plot] then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "Halloween"
	folder.Parent = plot.model
	plotFolders[plot] = folder
	decoratePlot(plot, folder)
	for _ = 1, HalloweenConfig.CANDIES_PER_PLOT do
		spawnCandy(plot)
	end
end

function HalloweenService.ClearPlot(plot)
	local folder = plotFolders[plot]
	if folder then
		folder:Destroy()
		plotFolders[plot] = nil
	end
end

-- ===== Puertas: ¿truco o trato? =====

local function applyTrick(player, trick)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if humanoid and trick.walkSpeed then
		local previous = humanoid.WalkSpeed
		humanoid.WalkSpeed = trick.walkSpeed
		task.delay(trick.seconds, function()
			if humanoid.Parent then
				humanoid.WalkSpeed = previous
			end
		end)
	elseif humanoid and trick.jumpPower then
		local usedPower, power, height = humanoid.UseJumpPower, humanoid.JumpPower, humanoid.JumpHeight
		humanoid.UseJumpPower = true
		humanoid.JumpPower = trick.jumpPower
		task.delay(trick.seconds, function()
			if humanoid.Parent then
				humanoid.UseJumpPower = usedPower
				humanoid.JumpPower = power
				humanoid.JumpHeight = height
			end
		end)
	end
	notifyRemote:FireClient(player, "trick", { id = trick.id, seconds = trick.seconds or 2, text = trick.text })
end

local function knock(player, plot, facilityId)
	local data = DataService.Get(player)
	if not data or not HalloweenService.IsActive() then
		return
	end
	local key = tostring(plot.index) .. ":" .. facilityId
	doorCooldowns[player] = doorCooldowns[player] or {}
	local last = doorCooldowns[player][key]
	if last and os.clock() - last < HalloweenConfig.DOOR_COOLDOWN then
		notifyRemote:FireClient(player, "info", string.format("🚪 Ya llamaste a esta puerta. Vuelve en %d s.",
			math.ceil(HalloweenConfig.DOOR_COOLDOWN - (os.clock() - last))))
		return
	end
	doorCooldowns[player][key] = os.clock()
	if rng:NextNumber() < HalloweenConfig.TREAT_CHANCE then
		local amount = rng:NextInteger(HalloweenConfig.TREAT_MIN, HalloweenConfig.TREAT_MAX)
		data.halloween.candy += amount
		data.halloween.total += amount
		notifyRemote:FireClient(player, "candy", { candy = data.halloween.candy, gained = amount, treat = true })
	else
		applyTrick(player, HalloweenConfig.Tricks[rng:NextInteger(1, #HalloweenConfig.Tricks)])
	end
end

function HalloweenService.AttachDoor(part, plot, _, facilityId)
	if not HalloweenService.IsActive() or not HalloweenConfig.DOOR_FACILITIES[facilityId] then
		return
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "TrickOrTreat"
	prompt.ActionText = "🎃 ¿Truco o trato?"
	prompt.ObjectText = HalloweenConfig.NAME
	prompt.KeyboardKeyCode = Enum.KeyCode.F
	prompt.UIOffset = Vector2.new(0, 70)
	prompt.HoldDuration = 0.3
	prompt.MaxActivationDistance = 16
	prompt.RequiresLineOfSight = false
	prompt.Parent = part
	prompt.Triggered:Connect(function(player)
		knock(player, plot, facilityId)
	end)
end

-- ===== Canje =====

function HalloweenService.Exchange(player, payload)
	local data = DataService.Get(player)
	local reward = HalloweenConfig.Reward(type(payload) == "table" and payload.reward)
	if not reward then
		return false, "Premio no válido."
	end
	if reward.unlock and data.unlocks[reward.unlock] then
		return false, "Ya tienes este premio."
	end
	if data.halloween.candy < reward.cost then
		return false, string.format("Necesitas %d caramelos (tienes %d).", reward.cost, data.halloween.candy)
	end
	data.halloween.candy -= reward.cost
	if reward.money then
		EconomyService.Earn(player, reward.money, EconomyService.Category.PRIZE, HalloweenConfig.NAME .. ": " .. reward.name)
	end
	if reward.unlock then
		data.unlocks[reward.unlock] = true
	end
	StadiumService.LogEvent(data, "halloween_reward", { name = reward.name })
	return true, string.format("%s ¡%s conseguido! (−%d 🍬)", reward.icon, reward.name, reward.cost)
end

function HalloweenService.BuildState(data)
	local rewards = {}
	for _, reward in ipairs(HalloweenConfig.Rewards) do
		table.insert(rewards, {
			id = reward.id, name = reward.name, icon = reward.icon, cost = reward.cost, money = reward.money,
			owned = reward.unlock ~= nil and data.unlocks[reward.unlock] == true,
		})
	end
	return {
		active = HalloweenService.IsActive(),
		name = HalloweenConfig.NAME,
		candy = data.halloween.candy,
		total = data.halloween.total,
		rewards = rewards,
	}
end

function HalloweenService.PlayerRemoving(player)
	doorCooldowns[player] = nil
end

function HalloweenService.Start()
	if HalloweenService.IsActive() then
		-- Atardecer de Halloween para que luzcan las calabazas y los focos
		Lighting.ClockTime = 18.6
		Lighting.Ambient = Color3.fromRGB(70, 50, 90)
		Lighting.OutdoorAmbient = Color3.fromRGB(90, 70, 110)
	end
end

return HalloweenService
