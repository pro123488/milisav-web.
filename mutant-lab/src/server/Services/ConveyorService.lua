--!nonstrict
-- ConveyorService: el generador suelta cápsulas con mutantes que avanzan por la cinta central.
-- Cualquiera puede comprar una cápsula si está cerca, tiene créditos y un pedestal libre.
-- La compra se valida y se marca en el servidor sin esperas intermedias (dos jugadores nunca compran la misma).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local MM = require(script.Parent.MutantModel)

local Conveyor = {}
local S
Conveyor.capsules = {} -- [id] = { Id, S, M, X, Price, Model, Sold }
local nextId = 0
local rng = Random.new()

function Conveyor.Init(services)
	S = services
end

local function capsuleCF(x)
	return CFrame.new(x, Config.BeltY, Config.BeltZ)
end

-- Precio de la cápsula (el precio base de la especie con su mutación)
function Conveyor.basePrice(speciesId, mutationId)
	local sp = MutantData.SpeciesById[speciesId]
	local mut = mutationId and MutantData.MutationById[mutationId]
	return math.floor(sp.Price * (mut and (1 + (mut.Mult - 1) * 0.6) or 1))
end

function Conveyor.priceFor(player, cap)
	local data = S.Data.get(player)
	local disc = data and (data.Research.discount or 0) or 0
	local ev = S.Event and S.Event.priceMult() or 1
	return math.max(1, math.floor(cap.Price * (1 - 0.04 * disc) * ev))
end

local function buildCapsule(cap)
	local m = Instance.new("Model")
	m.Name = "Capsule" .. cap.Id
	local base = S.World.P(m, "Base", Vector3.new(6, 0.6, 6), capsuleCF(cap.X), { 40, 40, 50 }, Enum.Material.Metal, { CanCollide = false })
	base.Shape = Enum.PartType.Block
	local sp = MutantData.SpeciesById[cap.S]
	local rar = MutantData.RarityById[sp.Rarity]
	local glass = S.World.P(m, "Glass", Vector3.new(7.5, 5.6, 5.6), capsuleCF(cap.X) * CFrame.new(0, 3.9, 0) * CFrame.Angles(0, 0, math.pi / 2), rar.Color, Enum.Material.Glass, { Transparency = 0.7, CanCollide = false, Shape = Enum.PartType.Cylinder })
	local creature = MM.build({ S = cap.S, M = cap.M, L = 1 }, capsuleCF(cap.X) * CFrame.new(0, 0.3, 0) * CFrame.Angles(0, math.pi / 2, 0), { scale = 0.7, price = cap.Price, maxDistance = 90 })
	creature.Parent = m
	m.PrimaryPart = base
	local pp = S.World.prompt(glass, "buy", "Comprar", sp.Name .. " · $" .. Util.short(cap.Price), { Capsule = cap.Id })
	pp.MaxActivationDistance = Config.BuyRadius
	-- todas las piezas soldadas a la base: para moverla basta con cambiar el CFrame de la base
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") and p ~= base then
			p.Anchored = false
			p.CanCollide = false
			p.Massless = true
			local w = Instance.new("WeldConstraint")
			w.Part0 = base
			w.Part1 = p
			w.Parent = p
		end
	end
	m.Parent = S.World.dynamic
	cap.Model = m
	cap.Root = base
end

function Conveyor.spawn(speciesId, mutationId)
	nextId = nextId + 1
	local luck = S.Event and S.Event.luck() or 1
	local mutLuck = S.Event and S.Event.mutMult() or 1
	local sid, mid = speciesId, mutationId
	if not sid then
		sid, mid = MutantData.roll(rng, luck, mutLuck)
	end
	local cap = { Id = nextId, S = sid, M = mid, X = Config.BeltStartX, Sold = false }
	cap.Price = Conveyor.basePrice(sid, mid)
	buildCapsule(cap)
	Conveyor.capsules[cap.Id] = cap
	local rar = MutantData.SpeciesById[sid].Rarity
	if rar == "legendary" or rar == "mythic" or rar == "secret" then
		S.Net.pushAll("notify", { text = "⚠ ¡Ha salido un " .. MutantData.label({ S = sid, M = mid }) .. " (" .. MutantData.RarityById[rar].Name .. ") en la cinta!", style = "gold" })
	end
	return cap
end

local function removeCapsule(cap)
	Conveyor.capsules[cap.Id] = nil
	if cap.Model then
		cap.Model:Destroy()
	end
end

local function moveCapsule(cap)
	cap.Root.CFrame = capsuleCF(cap.X)
end

function Conveyor.buy(player, capId)
	local cap = Conveyor.capsules[capId]
	if not cap or cap.Sold then
		return false, "Esa cápsula ya no está disponible."
	end
	local data = S.Data.get(player)
	if not data or not S.Lab.state(player) then
		return false, "No tienes laboratorio asignado."
	end
	if not S.Lab.near(player, Vector3.new(cap.X, Config.BeltY, Config.BeltZ), Config.BuyRadius) then
		return false, "Acércate a la cápsula para comprarla."
	end
	local price = Conveyor.priceFor(player, cap)
	if data.Credits < price then
		return false, "Te faltan " .. Util.short(price - data.Credits) .. " créditos."
	end
	local slot = S.Lab.freeSlot(player)
	if not slot then
		return false, "Tu laboratorio está lleno. Vende, fusiona o mejora el laboratorio."
	end
	-- a partir de aquí no hay esperas: la cápsula queda vendida a este jugador
	cap.Sold = true
	data.Credits = data.Credits - price
	local rec = { S = cap.S, M = cap.M, L = 1 }
	-- Reactor de mutación: una cápsula sin mutación puede mutar al comprarla
	local mlvl = data.Research.mutate or 0
	if not rec.M and mlvl > 0 then
		for i = #MutantData.Mutations, 1, -1 do
			local m = MutantData.Mutations[i]
			if rng:NextNumber() < m.Chance * 0.6 * mlvl then
				rec.M = m.Id
				break
			end
		end
	end
	S.Lab.addMutant(player, rec, slot)
	data.Stats.Bought = data.Stats.Bought + 1
	S.Daily.progress(player, "buy", 1)
	removeCapsule(cap)
	local extra = (rec.M and not cap.M) and (" ¡Ha mutado a " .. MutantData.MutationById[rec.M].Name .. "!") or ""
	return true, "🧪 Has comprado " .. MutantData.label(rec) .. ". Ya está en tu laboratorio." .. extra, { slot = slot }
end

function Conveyor.step(dt)
	for _, cap in pairs(Conveyor.capsules) do
		cap.X = cap.X + Config.BeltSpeed * dt
		if cap.X > Config.BeltEndX then
			removeCapsule(cap)
		else
			moveCapsule(cap)
		end
	end
end

function Conveyor.list()
	local out = {}
	for _, cap in pairs(Conveyor.capsules) do
		out[#out + 1] = cap
	end
	table.sort(out, function(a, b)
		return a.X > b.X
	end)
	return out
end

function Conveyor.Start()
	S.World.onPrompt("buy", function(player, pp)
		local ok, msg = Conveyor.buy(player, pp:GetAttribute("Capsule"))
		S.Net.notify(player, msg, ok and "success" or "error")
		if ok then
			S.Data.markDirty(player)
		end
	end)
	S.Net.on("Capsule.Buy", function(player, p)
		return Conveyor.buy(player, tonumber(p.id))
	end)
	-- generador
	task.spawn(function()
		while true do
			local mult = S.Event and S.Event.spawnMult() or 1
			task.wait(Config.CapsuleInterval * mult)
			if Util.count(Conveyor.capsules) < Config.MaxCapsules then
				local ok, err = pcall(Conveyor.spawn)
				if not ok then
					warn("[LabMutante] generador: " .. tostring(err))
				end
			end
		end
	end)
	-- movimiento de la cinta
	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(0.05)
			local now = os.clock()
			local ok, err = pcall(Conveyor.step, math.min(1, now - last))
			if not ok then
				warn("[LabMutante] cinta: " .. tostring(err))
			end
			last = now
		end
	end)
end

return Conveyor
