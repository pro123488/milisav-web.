--!nonstrict
-- LabService: tu laboratorio. Asignación de parcela, pedestales con mutantes, producción en el tanque,
-- colector, puerta láser, mejoras de nivel, investigación, defensas, venta y bestiario.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Config = require(ReplicatedStorage.Shared.Config)
local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local LabData = require(ReplicatedStorage.Shared.LabData)
local MM = require(script.Parent.MutantModel)

local Lab = {}
local S
local owners = {} -- [labIndex] = player
local state = {} -- [player] = { Index, Models = {[slot]=model}, Carried = {[slot]=true}, Reserved = n, LaserUntil, LaserReadyAt, DroneReadyAt, AlarmAt }

function Lab.Init(services)
	S = services
end

local function rkey(slot)
	return tostring(slot)
end

function Lab.state(player)
	return state[player]
end
function Lab.indexOf(player)
	local st = state[player]
	return st and st.Index
end
function Lab.ownerOf(index)
	return owners[index]
end

function Lab.tier(data)
	return LabData.Tiers[data.Lab.Tier] or LabData.Tiers[1]
end
function Lab.research(data, id)
	return data.Research[id] or 0
end

function Lab.tankCap(player, data)
	local cap = Lab.tier(data).Tank * (1 + 0.25 * Lab.research(data, "tank"))
	if S.Monetization and S.Monetization.has(player, "BigTank") then
		cap = cap * 1.5
	end
	return math.floor(cap)
end

function Lab.incomeMult(player, data)
	local m = 1 + 0.1 * Lab.research(data, "income")
	if S.Monetization and S.Monetization.has(player, "VIP") then
		m = m * 1.1
	end
	if S.Event then
		m = m * S.Event.incomeMult()
	end
	return m
end

-- Producción total por segundo (los mutantes que te están robando no producen)
function Lab.incomePerSecond(player)
	local data = S.Data.get(player)
	local st = state[player]
	if not data or not st then
		return 0
	end
	local sum = 0
	for k, rec in pairs(data.Lab.Slots) do
		if not st.Carried[tonumber(k)] then
			sum = sum + MutantData.income(rec)
		end
	end
	return sum * Lab.incomeMult(player, data)
end

-- Primer hueco libre (sin contar reservas de mutantes que vienen de camino)
function Lab.freeSlot(player, ignoreReserved)
	local data = S.Data.get(player)
	local st = state[player]
	if not data or not st then
		return nil
	end
	local slots = Lab.tier(data).Slots
	local used = Util.count(data.Lab.Slots) + (ignoreReserved and 0 or st.Reserved)
	if used >= slots then
		return nil
	end
	for s = 1, slots do
		if not data.Lab.Slots[rkey(s)] then
			return s
		end
	end
	return nil
end

-- Modelo del mutante sobre su pedestal
function Lab.placeModel(player, slot)
	local st = state[player]
	local data = S.Data.get(player)
	if not st or not data then
		return
	end
	if st.Models[slot] then
		st.Models[slot]:Destroy()
		st.Models[slot] = nil
	end
	local ped = S.World.labs[st.Index].Pedestals[slot]
	local rec = data.Lab.Slots[rkey(slot)]
	if rec then
		local cf = S.World.labCF(st.Index, S.World.SlotLocal[slot][1], 2.2, S.World.SlotLocal[slot][2])
		local model = MM.build(rec, cf, { maxDistance = 60 })
		model.Parent = S.World.labs[st.Index].Model
		st.Models[slot] = model
		local rar = MutantData.RarityById[MutantData.SpeciesById[rec.S].Rarity]
		ped.Ring.Color = Color3.fromRGB(rar.Color[1], rar.Color[2], rar.Color[3])
		ped.Prompt.Enabled = true
		ped.Prompt.ObjectText = MutantData.label(rec)
	else
		ped.Prompt.Enabled = false
		ped.Ring.Color = slot <= Lab.tier(data).Slots and Color3.fromRGB(70, 80, 100) or Color3.fromRGB(30, 30, 34)
	end
end

function Lab.refresh(player)
	local st = state[player]
	local data = S.Data.get(player)
	if not st or not data then
		return
	end
	S.World.setTier(st.Index, Lab.tier(data).Slots, data.Lab.Traps)
	for s = 1, LabData.MaxSlots do
		Lab.placeModel(player, s)
	end
	S.World.setTank(st.Index, data.Lab.Tank, Lab.tankCap(player, data))
end

-- Añade un mutante al laboratorio (devuelve el hueco o nil si no cabe)
function Lab.addMutant(player, rec, slot)
	local data = S.Data.get(player)
	slot = slot or Lab.freeSlot(player, true)
	if not data or not slot or data.Lab.Slots[rkey(slot)] then
		return nil
	end
	rec.Id = S.Data.nextUid(player)
	data.Lab.Slots[rkey(slot)] = rec
	-- bestiario: recompensa única por especie descubierta
	if not data.Index[rec.S] then
		data.Index[rec.S] = 1
		local sp = MutantData.SpeciesById[rec.S]
		local reward = math.floor(sp.Price * Config.DiscoverReward)
		data.Credits = data.Credits + reward
		S.Net.push(player, "discover", { name = sp.Name, rarity = sp.Rarity, reward = reward })
	else
		data.Index[rec.S] = data.Index[rec.S] + 1
	end
	Lab.placeModel(player, slot)
	S.Data.markDirty(player)
	return slot
end

function Lab.removeMutant(player, slot)
	local data = S.Data.get(player)
	local rec = data and data.Lab.Slots[rkey(slot)]
	if not rec then
		return nil
	end
	data.Lab.Slots[rkey(slot)] = nil
	Lab.placeModel(player, slot)
	S.Data.markDirty(player)
	return rec
end

function Lab.getMutant(player, slot)
	local data = S.Data.get(player)
	return data and data.Lab.Slots[rkey(slot)]
end

function Lab.isInside(player, index)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	local i = S.World.labIndexAt(root.Position)
	return i ~= nil and (index == nil or i == index), i
end

function Lab.near(player, pos, radius)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	local d = root.Position - pos
	return d.X * d.X + d.Z * d.Z <= radius * radius and math.abs(d.Y) < 20
end

function Lab.laserActive(index)
	local p = owners[index]
	local st = p and state[p]
	return st ~= nil and st.LaserUntil > os.clock()
end

function Lab.teleportHome(player)
	local st = state[player]
	local char = player.Character
	if st and char then
		char:PivotTo(S.World.labs[st.Index].SpawnCF)
	end
end

-- Asigna una parcela libre al entrar
function Lab.assign(player)
	for i = 1, 8 do
		if not owners[i] then
			owners[i] = player
			state[player] = { Index = i, Models = {}, Carried = {}, Reserved = 0, LaserUntil = 0, LaserReadyAt = 0, DroneReadyAt = 0, AlarmAt = 0 }
			S.World.setOwner(i, player)
			Lab.refresh(player)
			Lab.teleportHome(player)
			player.CharacterAdded:Connect(function()
				task.wait(0.2)
				Lab.teleportHome(player)
			end)
			-- tabla de clasificación
			local ls = Instance.new("Folder")
			ls.Name = "leaderstats"
			local credits = Instance.new("NumberValue")
			credits.Name = "Créditos"
			credits.Parent = ls
			local count = Instance.new("IntValue")
			count.Name = "Mutantes"
			count.Parent = ls
			ls.Parent = player
			return i
		end
	end
	return nil
end

function Lab.release(player)
	local st = state[player]
	if not st then
		return
	end
	for _, m in pairs(st.Models) do
		m:Destroy()
	end
	S.World.setLaser(st.Index, false)
	S.World.setOwner(st.Index, nil)
	S.World.setTier(st.Index, 0, 0)
	for _, ped in ipairs(S.World.labs[st.Index].Pedestals) do
		ped.Prompt.Enabled = false
	end
	S.World.setTank(st.Index, 0, 1)
	owners[st.Index] = nil
	state[player] = nil
end

-- Bucle de producción: llena el tanque, actualiza el láser y la clasificación
local function tick(dt)
	for player, st in pairs(state) do
		local data = S.Data.get(player)
		if data then
			local cap = Lab.tankCap(player, data)
			local inc = Lab.incomePerSecond(player)
			data.Lab.Tank = math.min(cap, data.Lab.Tank + inc * dt)
			S.World.setTank(st.Index, data.Lab.Tank, cap)
			if S.World.labs[st.Index].LaserOn and st.LaserUntil <= os.clock() then
				S.World.setLaser(st.Index, false)
				S.Net.notify(player, "🔴 Tu puerta láser se ha apagado.", "warn")
			end
			local ls = player:FindFirstChild("leaderstats")
			if ls then
				ls["Créditos"].Value = math.floor(data.Credits)
				ls.Mutantes.Value = Util.count(data.Lab.Slots)
			end
		end
	end
end

Lab.tick = tick

function Lab.collect(player)
	local data = S.Data.get(player)
	local st = state[player]
	if not st then
		return false, "No tienes laboratorio."
	end
	local col = S.World.CollectorLocal
	if not Lab.near(player, S.World.labPos(st.Index, col[1], 1, col[2]), 10) then
		return false, "Ve al colector de tu laboratorio para recoger los créditos."
	end
	local amount = math.floor(data.Lab.Tank)
	if amount <= 0 then
		return false, "El tanque está vacío. Tus mutantes lo irán llenando."
	end
	data.Lab.Tank = data.Lab.Tank - amount
	data.Credits = data.Credits + amount
	data.Stats.Earned = data.Stats.Earned + amount
	S.World.setTank(st.Index, data.Lab.Tank, Lab.tankCap(player, data))
	return true, "💰 +" .. Util.short(amount) .. " créditos", { amount = amount }
end

function Lab.activateLaser(player)
	local data = S.Data.get(player)
	local st = state[player]
	if not st then
		return false, "No tienes laboratorio."
	end
	if not Lab.isInside(player, st.Index) then
		return false, "Solo puedes activar el láser dentro de tu laboratorio."
	end
	local now = os.clock()
	if st.LaserUntil > now then
		return false, "El láser ya está activo (" .. Util.time(st.LaserUntil - now) .. ")."
	end
	if st.LaserReadyAt > now then
		return false, "El láser se está recargando: " .. Util.time(st.LaserReadyAt - now) .. "."
	end
	local dur = Lab.tier(data).Laser
	st.LaserUntil = now + dur
	st.LaserReadyAt = now + dur + Config.LaserCooldown
	S.World.setLaser(st.Index, true)
	return true, "🟢 Puerta láser activa durante " .. dur .. " s. Nadie puede robarte mientras tanto.", { untilIn = dur }
end

function Lab.upgrade(player)
	local data = S.Data.get(player)
	local nextTier = LabData.Tiers[data.Lab.Tier + 1]
	if not nextTier then
		return false, "Tu laboratorio ya está al máximo."
	end
	if data.Credits < nextTier.Cost then
		return false, "Necesitas " .. Util.short(nextTier.Cost) .. " créditos."
	end
	data.Credits = data.Credits - nextTier.Cost
	data.Lab.Tier = data.Lab.Tier + 1
	Lab.refresh(player)
	return true, "🏗 ¡Ahora tienes un " .. nextTier.Name .. "! (" .. nextTier.Slots .. " pedestales)"
end

function Lab.buyResearch(player, id)
	local data = S.Data.get(player)
	local r = LabData.ResearchById[id]
	if not r then
		return false, "Investigación desconocida."
	end
	local lvl = Lab.research(data, id)
	if lvl >= r.Max then
		return false, r.Name .. " ya está al máximo."
	end
	local cost = LabData.researchCost(id, lvl)
	if data.Credits < cost then
		return false, "Necesitas " .. Util.short(cost) .. " créditos."
	end
	data.Credits = data.Credits - cost
	data.Research[id] = lvl + 1
	if id == "tank" then
		Lab.refresh(player)
	end
	return true, "🔬 " .. r.Name .. " nivel " .. (lvl + 1)
end

function Lab.buyDefense(player, id)
	local data = S.Data.get(player)
	local def = LabData.Defenses[id]
	if not def then
		return false, "Defensa desconocida."
	end
	if id == "trap" then
		if data.Lab.Traps >= math.min(data.Lab.Tier, #S.World.TrapLocal) then
			return false, "Ya tienes todas las trampas que permite tu laboratorio (una por nivel)."
		end
	elseif data.Lab[id == "alarm" and "Alarm" or "Drone"] then
		return false, "Ya tienes " .. def.Name .. "."
	end
	if def.Tier and data.Lab.Tier < def.Tier then
		return false, def.Name .. " requiere laboratorio de nivel " .. def.Tier .. "."
	end
	if data.Credits < def.Cost then
		return false, "Necesitas " .. Util.short(def.Cost) .. " créditos."
	end
	data.Credits = data.Credits - def.Cost
	if id == "trap" then
		data.Lab.Traps = data.Lab.Traps + 1
	elseif id == "alarm" then
		data.Lab.Alarm = true
	else
		data.Lab.Drone = true
	end
	Lab.refresh(player)
	return true, "🛡 " .. def.Name .. " instalada."
end

function Lab.sell(player, slot)
	local st = state[player]
	local data = S.Data.get(player)
	if type(slot) ~= "number" or not st then
		return false, "Hueco no válido."
	end
	slot = math.floor(slot)
	if st.Carried[slot] then
		return false, "¡Te lo están robando! Recupéralo primero."
	end
	local rec = data.Lab.Slots[rkey(slot)]
	if not rec then
		return false, "Ese pedestal está vacío."
	end
	local value = math.floor(MutantData.value(rec) * Config.SellRate)
	Lab.removeMutant(player, slot)
	data.Credits = data.Credits + value
	data.Stats.Sold = data.Stats.Sold + 1
	return true, "Vendido " .. MutantData.label(rec) .. " por " .. Util.short(value) .. " créditos.", { value = value }
end

-- Mueve un mutante a otro pedestal propio (para ordenar)
function Lab.move(player, from, to)
	local data = S.Data.get(player)
	local st = state[player]
	if type(from) ~= "number" or type(to) ~= "number" or not st then
		return false, "Datos no válidos."
	end
	if st.Carried[from] or st.Carried[to] then
		return false, "No se puede mover un mutante que te están robando."
	end
	if to < 1 or to > Lab.tier(data).Slots then
		return false, "Ese pedestal no está desbloqueado."
	end
	local a, b = data.Lab.Slots[rkey(from)], data.Lab.Slots[rkey(to)]
	if not a then
		return false, "No hay mutante en ese pedestal."
	end
	data.Lab.Slots[rkey(from)], data.Lab.Slots[rkey(to)] = b, a
	Lab.placeModel(player, from)
	Lab.placeModel(player, to)
	return true, "Mutante movido."
end

function Lab.view(player)
	local data = S.Data.get(player)
	local st = state[player]
	if not data or not st then
		return nil
	end
	local slots = {}
	for k, rec in pairs(data.Lab.Slots) do
		local sp = MutantData.SpeciesById[rec.S]
		slots[#slots + 1] = {
			Slot = tonumber(k), Id = rec.Id, S = rec.S, M = rec.M, L = rec.L or 1, Name = MutantData.label(rec), Rarity = sp.Rarity,
			Income = MutantData.income(rec) * Lab.incomeMult(player, data), Value = math.floor(MutantData.value(rec) * Config.SellRate),
			Carried = st.Carried[tonumber(k)] or false,
		}
	end
	table.sort(slots, function(a, b)
		return a.Slot < b.Slot
	end)
	local now = os.clock()
	return {
		Index = st.Index, Tier = data.Lab.Tier, TierName = Lab.tier(data).Name, Slots = Lab.tier(data).Slots, Mutants = slots,
		Tank = math.floor(data.Lab.Tank), TankCap = Lab.tankCap(player, data), Income = Lab.incomePerSecond(player),
		LaserLeft = math.max(0, st.LaserUntil - now), LaserReady = math.max(0, st.LaserReadyAt - now), LaserTime = Lab.tier(data).Laser,
		Traps = data.Lab.Traps, Alarm = data.Lab.Alarm, Drone = data.Lab.Drone,
	}
end

function Lab.Start()
	S.World.onPrompt("collect", function(player, pp)
		if pp:GetAttribute("Lab") ~= Lab.indexOf(player) then
			return S.Net.notify(player, "Este colector no es tuyo.", "error")
		end
		local ok, msg = Lab.collect(player)
		S.Net.notify(player, msg, ok and "gold" or "error")
		S.Data.markDirty(player)
	end)
	S.World.onPrompt("laser", function(player, pp)
		if pp:GetAttribute("Lab") ~= Lab.indexOf(player) then
			return S.Net.notify(player, "Este botón no es tuyo.", "error")
		end
		local ok, msg = Lab.activateLaser(player)
		S.Net.notify(player, msg, ok and "success" or "error")
	end)
	S.World.onPrompt("terminal", function(player, pp)
		if pp:GetAttribute("Lab") ~= Lab.indexOf(player) then
			return S.Net.notify(player, "Esta terminal no es tuya.", "error")
		end
		S.Net.push(player, "openPanel", { tab = "upgrades" })
	end)
	S.World.onPrompt("fusion", function(player, pp)
		if pp:GetAttribute("Lab") ~= Lab.indexOf(player) then
			return S.Net.notify(player, "Esta cámara de fusión no es tuya.", "error")
		end
		S.Net.push(player, "openPanel", { tab = "fusion" })
	end)
	-- el dueño atraviesa su propia puerta láser (entra o sale según de qué lado la toque)
	for i, labW in ipairs(S.World.labs) do
		labW.LaserWall.Touched:Connect(function(hit)
			local owner = owners[i]
			local char = hit and hit.Parent
			if not owner or not char or owner.Character ~= char or not labW.LaserOn then
				return
			end
			local root = char:FindFirstChild("HumanoidRootPart")
			if not root then
				return
			end
			local _, _, s = S.World.labOrigin(i)
			local x, z = S.World.labOrigin(i)
			local lz = (root.Position.Z - z) * s
			local target = lz < 30.5 and S.World.labCF(i, 0, 4, 36) or S.World.labCF(i, 0, 4, 24)
			char:PivotTo(target)
		end)
	end
	S.Net.on("Lab.Collect", function(player)
		return Lab.collect(player)
	end)
	S.Net.on("Lab.Laser", function(player)
		return Lab.activateLaser(player)
	end)
	S.Net.on("Lab.Upgrade", function(player)
		return Lab.upgrade(player)
	end)
	S.Net.on("Lab.Research", function(player, p)
		return Lab.buyResearch(player, tostring(p.id))
	end)
	S.Net.on("Lab.Defense", function(player, p)
		return Lab.buyDefense(player, tostring(p.id))
	end)
	S.Net.on("Lab.Sell", function(player, p)
		return Lab.sell(player, tonumber(p.slot))
	end)
	S.Net.on("Lab.Move", function(player, p)
		return Lab.move(player, tonumber(p.from), tonumber(p.to))
	end)
	S.Net.on("Lab.Home", function(player)
		Lab.teleportHome(player)
		return true, "🏠 De vuelta a tu laboratorio."
	end)
	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(Config.IncomeTick)
			local now = os.clock()
			local ok, err = pcall(tick, math.min(5, now - last))
			if not ok then
				warn("[LabMutante] producción: " .. tostring(err))
			end
			last = now
		end
	end)
end

return Lab
