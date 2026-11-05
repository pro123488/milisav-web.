--!nonstrict
-- RaidService: asaltos a otros laboratorios.
--  * Robar: mantener pulsado el aviso de un pedestal ajeno (puerta láser apagada, sitio libre en tu laboratorio).
--  * El ladrón lleva el mutante sobre la cabeza, más despacio, hasta la zona de llegada de SU laboratorio.
--  * El dueño puede recuperarlo tocando al ladrón; también lo devuelven las trampas, el dron, morir o salir del juego.
--  * Nunca se duplica: el mutante sigue en el perfil del dueño hasta la entrega, que lo mueve en un solo paso.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Config = require(ReplicatedStorage.Shared.Config)
local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local MM = require(script.Parent.MutantModel)

local Raid = {}
local S
Raid.carrying = {} -- [thief] = { Owner, OwnerIndex, Slot, Rec, Model, Prompt }
local slowedUntil = {} -- [player] = clock

function Raid.Init(services)
	S = services
end

local function humanoid(player)
	local char = player.Character
	return char and char:FindFirstChildOfClass("Humanoid")
end

function Raid.walkSpeed(player)
	local data = S.Data.get(player)
	local hum = humanoid(player)
	if not hum then
		return
	end
	local speed = Config.NormalWalkSpeed
	if Raid.carrying[player] then
		speed = Config.CarryWalkSpeed + (data and (data.Research.sprint or 0) or 0)
	end
	if (slowedUntil[player] or 0) > os.clock() then
		speed = math.min(speed, Config.TrapWalkSpeed)
	end
	hum.WalkSpeed = speed
end

local function attachModel(thief, rec)
	local char = thief.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	local model = MM.build(rec, root.CFrame * CFrame.new(0, 3.2, 0), { scale = 0.6, maxDistance = 120 })
	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = false
			p.CanCollide = false
			p.Massless = true
			local w = Instance.new("WeldConstraint")
			w.Part0 = root
			w.Part1 = p
			w.Parent = p
		end
	end
	model.Name = "Robado"
	model.Parent = char
	return model
end

-- Devuelve el mutante a su dueño (cancela el robo)
function Raid.returnCarried(thief, reason)
	local c = Raid.carrying[thief]
	if not c then
		return false
	end
	Raid.carrying[thief] = nil
	if c.Model then
		c.Model:Destroy()
	end
	if c.Prompt then
		c.Prompt:Destroy()
	end
	local tst = S.Lab.state(thief)
	if tst then
		tst.Reserved = math.max(0, tst.Reserved - 1)
	end
	local ost = S.Lab.state(c.Owner)
	if ost then
		ost.Carried[c.Slot] = nil
		S.Lab.placeModel(c.Owner, c.Slot)
	end
	Raid.walkSpeed(thief)
	local name = MutantData.label(c.Rec)
	if thief.Parent then
		S.Net.notify(thief, "❌ " .. (reason or "Has perdido el mutante") .. ": " .. name .. " vuelve a su laboratorio.", "error")
		S.Net.push(thief, "carry", { on = false })
	end
	if c.Owner.Parent then
		S.Net.notify(c.Owner, "✅ " .. name .. " ha vuelto a tu laboratorio.", "success")
		S.Net.push(c.Owner, "alert", { on = false })
		S.Data.markDirty(c.Owner)
	end
	return true
end

function Raid.grab(thief, labIndex, slot)
	if type(labIndex) ~= "number" or type(slot) ~= "number" then
		return false, "Datos no válidos."
	end
	local owner = S.Lab.ownerOf(labIndex)
	if not owner then
		return false, "Este laboratorio está vacío."
	end
	if owner == thief then
		local rec = S.Lab.getMutant(thief, slot)
		if rec then
			S.Net.push(thief, "openPanel", { tab = "mutants", slot = slot })
			return true, MutantData.label(rec)
		end
		return false, "Pedestal vacío."
	end
	if Raid.carrying[thief] then
		return false, "Ya llevas un mutante. Llévalo primero a tu laboratorio."
	end
	if S.Lab.laserActive(labIndex) then
		return false, "La puerta láser está activa: espera a que se apague."
	end
	local ost = S.Lab.state(owner)
	local rec = S.Lab.getMutant(owner, slot)
	if not rec or not ost then
		return false, "Ese pedestal está vacío."
	end
	if ost.Carried[slot] then
		return false, "Alguien ya se lo está llevando."
	end
	local tst = S.Lab.state(thief)
	if not tst then
		return false, "Necesitas un laboratorio propio."
	end
	if not S.Lab.freeSlot(thief) then
		return false, "Tu laboratorio está lleno: no tendrías dónde dejarlo."
	end
	if not S.Lab.near(thief, S.World.labs[labIndex].Pedestals[slot].Top, Config.StealRadius) then
		return false, "Acércate más al pedestal."
	end
	-- reservar: el mutante sigue siendo del dueño hasta la entrega
	ost.Carried[slot] = true
	tst.Reserved = tst.Reserved + 1
	if ost.Models[slot] then
		ost.Models[slot]:Destroy()
		ost.Models[slot] = nil
	end
	S.World.labs[labIndex].Pedestals[slot].Prompt.Enabled = false
	local c = { Owner = owner, OwnerIndex = labIndex, Slot = slot, Rec = Util.deepCopy(rec), Since = os.clock() }
	c.Model = attachModel(thief, c.Rec)
	-- aviso para que el dueño lo recupere tocando al ladrón
	local root = thief.Character and thief.Character:FindFirstChild("HumanoidRootPart")
	if root then
		local pp = S.World.prompt(root, "recapture", "Recuperar", "Mutante robado", { Thief = thief.UserId })
		pp.MaxActivationDistance = Config.RecaptureRadius
		c.Prompt = pp
	end
	Raid.carrying[thief] = c
	Raid.walkSpeed(thief)
	local name = MutantData.label(c.Rec)
	S.Net.notify(owner, "🚨 ¡" .. thief.DisplayName .. " te está robando " .. name .. "! Tócale para recuperarlo.", "error")
	S.Net.push(owner, "alert", { on = true, thief = thief.DisplayName, name = name })
	S.Net.push(thief, "carry", { on = true, name = name })
	return true, "🏃 ¡Lo tienes! Llévalo a la zona de llegada de tu laboratorio."
end

-- Entrega: el mutante pasa del dueño al ladrón en un único paso
function Raid.deliver(thief)
	local c = Raid.carrying[thief]
	if not c then
		return false
	end
	local owner = c.Owner
	local ost = S.Lab.state(owner)
	local tst = S.Lab.state(thief)
	if not ost or not tst then
		return Raid.returnCarried(thief, "El robo se ha cancelado")
	end
	local current = S.Lab.getMutant(owner, c.Slot)
	if not current or current.Id ~= c.Rec.Id then
		return Raid.returnCarried(thief, "Ese mutante ya no está")
	end
	Raid.carrying[thief] = nil
	if c.Prompt then
		c.Prompt:Destroy()
	end
	if c.Model then
		c.Model:Destroy()
	end
	ost.Carried[c.Slot] = nil
	tst.Reserved = math.max(0, tst.Reserved - 1)
	local rec = S.Lab.removeMutant(owner, c.Slot)
	local newRec = { S = rec.S, M = rec.M, L = rec.L }
	local slot = S.Lab.addMutant(thief, newRec)
	local od, td = S.Data.get(owner), S.Data.get(thief)
	od.Stats.Lost = od.Stats.Lost + 1
	td.Stats.Stolen = td.Stats.Stolen + 1
	S.Daily.progress(thief, "steal", 1)
	Raid.walkSpeed(thief)
	local name = MutantData.label(newRec)
	S.Net.notify(thief, "🎉 ¡Robo completado! " .. name .. " ya es tuyo.", "gold")
	S.Net.push(thief, "carry", { on = false })
	S.Net.notify(owner, "💔 " .. thief.DisplayName .. " se ha llevado tu " .. name .. ".", "error")
	S.Net.push(owner, "alert", { on = false })
	S.Data.markDirty(owner)
	S.Data.markDirty(thief)
	return true, slot
end

function Raid.recapture(owner, thief)
	local c = thief and Raid.carrying[thief]
	if not c then
		return false, "Esa persona no lleva nada."
	end
	if c.Owner ~= owner then
		return false, "Ese mutante no es tuyo."
	end
	local root = thief.Character and thief.Character:FindFirstChild("HumanoidRootPart")
	if not root or not S.Lab.near(owner, root.Position, Config.RecaptureRadius) then
		return false, "Estás demasiado lejos."
	end
	local od = S.Data.get(owner)
	od.Stats.Recovered = od.Stats.Recovered + 1
	S.Daily.progress(owner, "recover", 1)
	Raid.returnCarried(thief, thief == owner and "" or (owner.DisplayName .. " te ha atrapado"))
	return true, "💪 ¡Recuperado!"
end

-- Bucle: entregas, trampas, dron, alarma y cancelaciones
local function step()
	local now = os.clock()
	for thief, c in pairs(Raid.carrying) do
		local hum = humanoid(thief)
		local root = thief.Character and thief.Character:FindFirstChild("HumanoidRootPart")
		if not thief.Parent or not root or (hum and hum.Health ~= nil and hum.Health <= 0) then
			Raid.returnCarried(thief, "Has caído")
		elseif not c.Owner.Parent then
			Raid.returnCarried(thief, "El dueño se ha ido")
		else
			local tIndex = S.Lab.indexOf(thief)
			local entry = tIndex and S.World.labs[tIndex].EntryPos
			if entry and S.Lab.near(thief, entry, Config.DeliverRadius) then
				Raid.deliver(thief)
			else
				-- dron guardián del dueño: si el ladrón sigue dentro de su laboratorio
				local od = S.Data.get(c.Owner)
				local ost = S.Lab.state(c.Owner)
				local inside = S.World.labIndexAt(root.Position) == c.OwnerIndex
				if od and ost and od.Lab.Drone and inside and ost.DroneReadyAt <= now and now - c.Since > 1.5 then
					ost.DroneReadyAt = now + Config.DroneCooldown
					od.Stats.Recovered = od.Stats.Recovered + 1
					S.Daily.progress(c.Owner, "recover", 1)
					Raid.returnCarried(thief, "El dron guardián te lo ha quitado")
				end
			end
		end
	end
	-- trampas y alarma: afectan a quien no es el dueño
	for _, player in ipairs(Players:GetPlayers()) do
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		local i = root and S.World.labIndexAt(root.Position)
		local owner = i and S.Lab.ownerOf(i)
		if owner and owner ~= player then
			local od = S.Data.get(owner)
			local ost = S.Lab.state(owner)
			if od and ost then
				if od.Lab.Alarm and ost.AlarmAt <= now then
					ost.AlarmAt = now + Config.AlarmCooldown
					S.Net.notify(owner, "🔔 Alarma: " .. player.DisplayName .. " ha entrado en tu laboratorio.", "warn")
				end
				for k = 1, math.min(od.Lab.Traps, #S.World.labs[i].Traps) do
					local trap = S.World.labs[i].Traps[k]
					if trap.ReadyAt <= now and S.Lab.near(player, trap.Pos, Config.TrapRadius) then
						trap.ReadyAt = now + Config.TrapRearm
						slowedUntil[player] = now + Config.TrapSlowSeconds
						S.Net.notify(player, "🟢 ¡Has pisado una trampa de baba!", "warn")
						if Raid.carrying[player] then
							od.Stats.Recovered = od.Stats.Recovered + 1
							S.Daily.progress(owner, "recover", 1)
							Raid.returnCarried(player, "La trampa de baba te ha hecho soltarlo")
						end
						Raid.walkSpeed(player)
					end
				end
			end
		end
		if slowedUntil[player] and slowedUntil[player] <= now then
			slowedUntil[player] = nil
			Raid.walkSpeed(player)
		end
	end
end
Raid.step = step

function Raid.onLeave(player)
	if Raid.carrying[player] then
		Raid.returnCarried(player, "Has salido del juego")
	end
	-- si el dueño se va, se cancelan los robos a su laboratorio (su perfil se guarda con el mutante dentro)
	for thief, c in pairs(Raid.carrying) do
		if c.Owner == player then
			Raid.returnCarried(thief, "El dueño se ha ido")
		end
	end
	slowedUntil[player] = nil
end

function Raid.isCarrying(player)
	return Raid.carrying[player] ~= nil
end

function Raid.Start()
	S.World.onPrompt("steal", function(player, pp)
		local ok, msg = Raid.grab(player, pp:GetAttribute("Lab"), pp:GetAttribute("Slot"))
		if msg then
			S.Net.notify(player, msg, ok and "success" or "error")
		end
	end)
	S.World.onPrompt("recapture", function(player, pp)
		local thief = Players:GetPlayerByUserId(pp:GetAttribute("Thief"))
		local ok, msg = Raid.recapture(player, thief)
		S.Net.notify(player, msg, ok and "success" or "error")
	end)
	task.spawn(function()
		while true do
			task.wait(0.2)
			local ok, err = pcall(step)
			if not ok then
				warn("[LabMutante] asaltos: " .. tostring(err))
			end
		end
	end)
end

return Raid
