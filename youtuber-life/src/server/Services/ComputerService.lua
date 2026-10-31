--!nonstrict
-- ComputerService: montajes de PC (rigs), sesiones de computador y rendimiento real.
-- Un rig es un conjunto de piezas del inventario (uids) instaladas juntas. Comprar un PC completo crea un rig
-- con piezas reales, que se puede desmontar, mejorar o vender por piezas.
-- Solo las piezas reconocidas por PCBuild afectan al rendimiento.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Catalog = require(Shared.ItemCatalog)
local PCBuild = require(Shared.PCBuild)
local Util = require(Shared.Util)

local Computer = {}
local S
local sessions = {} -- [player] = { Kind = "home"|"public"|"laptop", Pos = Vector3?, Uid = laptop uid }

Computer.MaxRigs = 4
Computer.SessionRadius = 16

function Computer.Init(services)
	S = services
end

local function rigLoc(rigId)
	return "rig:" .. rigId
end

-- Convierte un rig (uids) en IDs de catálogo para PCBuild
function Computer.rigParts(player, rig)
	local data = S.Data.get(player)
	local out = {}
	local condSum, condN = 0, 0
	for slot, v in pairs(rig.Parts) do
		if type(v) == "table" then
			out[slot] = {}
			for _, uid in ipairs(v) do
				local rec = data.Inventory[uid]
				if rec then
					table.insert(out[slot], rec.Id)
					condSum = condSum + rec.Cond
					condN = condN + 1
				end
			end
		else
			local rec = data.Inventory[v]
			if rec then
				out[slot] = rec.Id
				condSum = condSum + rec.Cond
				condN = condN + 1
			end
		end
	end
	local cond = condN > 0 and condSum / condN or 100
	return out, 0.85 + 0.15 * cond / 100
end

function Computer.rigStats(player, rigId)
	local data = S.Data.get(player)
	local rig = data.Rigs[rigId]
	if not rig then
		return nil
	end
	local parts, cf = Computer.rigParts(player, rig)
	local ok = PCBuild.validate(parts)
	if not ok then
		return nil
	end
	return PCBuild.stats(parts, cf)
end

function Computer.createRigFromPrebuilt(player, def, opts)
	local data = S.Data.get(player)
	if Util.count(data.Rigs) >= Computer.MaxRigs then
		S.Net.notify(player, "Ya tienes " .. Computer.MaxRigs .. " computadores montados: las piezas se guardarán sueltas en casa.", "warn")
	end
	opts = opts or {}
	local rigId = S.Data.nextUid(player, "r")
	local partsValue = 0
	for _, v in pairs(def.Parts) do
		if type(v) == "table" then
			for _, id in ipairs(v) do
				partsValue = partsValue + Catalog.get(id).Price
			end
		else
			partsValue = partsValue + Catalog.get(v).Price
		end
	end
	local ratio = (opts.paid or def.Price) / math.max(1, partsValue)
	local canMount = Util.count(data.Rigs) < Computer.MaxRigs
	local rig = { Name = def.Name, Parts = {}, From = def.Id }
	for slot, v in pairs(def.Parts) do
		local ids = type(v) == "table" and v or { v }
		local uids = {}
		for _, id in ipairs(ids) do
			local uid = S.Inventory.add(player, id, { src = opts.src or "shop", paid = math.floor(Catalog.get(id).Price * ratio + 0.5), loc = "home" })
			if uid then
				if canMount then
					data.Inventory[uid].Loc = rigLoc(rigId)
				end
				uids[#uids + 1] = uid
			end
		end
		if type(v) == "table" then
			rig.Parts[slot] = uids
		else
			rig.Parts[slot] = uids[1]
		end
	end
	if not canMount then
		return nil
	end
	data.Rigs[rigId] = rig
	if data.ActiveRig == "" or not data.Rigs[data.ActiveRig] then
		data.ActiveRig = rigId
	end
	S.Home.refreshRoom(player)
	return rigId
end

-- Estadísticas del puesto de trabajo de la sesión actual (incluye periféricos de casa)
function Computer.sessionStats(player)
	local s = sessions[player]
	if not s then
		return nil
	end
	local data = S.Data.get(player)
	local stats
	if s.Kind == "home" then
		stats = Computer.rigStats(player, data.ActiveRig) or PCBuild.publicStats()
	elseif s.Kind == "laptop" then
		local rec, def = S.Inventory.get(player, s.Uid)
		stats = def and PCBuild.laptopStats(def, S.Inventory.condFactor(rec)) or PCBuild.publicStats()
	else
		stats = PCBuild.publicStats()
	end
	stats.Kind = s.Kind
	-- Periféricos y mobiliario (solo cuentan en casa)
	stats.ColorAcc, stats.Screens, stats.EditSpeed, stats.Comfort, stats.AudioMix = 40, 1, 0, 0, 0
	if s.Kind == "home" then
		local mon = S.Inventory.bestCatAtHome(player, "monitor", nil, "ColorAcc")
		if mon then
			stats.ColorAcc = mon.Stats.ColorAcc
			stats.Screens = mon.Stats.Screens
		end
		for _, sub in ipairs({ "Teclado", "Ratón", "Alfombrilla" }) do
			local d = S.Inventory.bestCatAtHome(player, "peripheral", sub, "EditSpeed")
			if d then
				stats.EditSpeed = stats.EditSpeed + d.Stats.EditSpeed
			end
		end
		stats.EditSpeed = stats.EditSpeed + (stats.Screens - 1) * 4
		local chair = S.Inventory.bestCatAtHome(player, "furniture", "Silla", "Comfort")
		local desk = S.Inventory.bestCatAtHome(player, "furniture", "Escritorio", "Comfort")
		stats.Comfort = (chair and chair.Stats.Comfort or 0) + (desk and desk.Stats.Comfort or 0)
		local head = S.Inventory.bestCatAtHome(player, "peripheral", "Auriculares", "AudioMix")
		local spk = S.Inventory.bestCatAtHome(player, "peripheral", "Altavoces", "AudioMix")
		stats.AudioMix = math.max(head and head.Stats.AudioMix or 0, spk and spk.Stats.AudioMix or 0)
	elseif s.Kind == "laptop" then
		stats.ColorAcc = 60
		stats.AudioMix = 20
	end
	-- Almacenamiento externo (en casa o en la mochila según dónde estés)
	local where = s.Kind == "home" and "home" or "backpack"
	for _, rec in pairs(data.Inventory) do
		local def = Catalog.get(rec.Id)
		if def and def.Slot == "external" and (rec.Loc == where) then
			stats.StorageGb = stats.StorageGb + def.Stats.Gb
		end
	end
	-- Tableta Pro: edición ligera
	return stats
end

function Computer.storageUsed(player)
	local data = S.Data.get(player)
	local used = 0
	for _, proj in pairs(data.Projects) do
		for _, sc in ipairs(proj.Scenes) do
			if sc.Imported then
				used = used + (sc.Gb or 0)
			end
		end
	end
	return math.floor(used * 10 + 0.5) / 10
end

function Computer.hasSession(player)
	local s = sessions[player]
	if not s then
		return false
	end
	if s.Kind == "laptop" then
		local rec = S.Inventory.get(player, s.Uid)
		if not rec or (rec.Loc ~= "backpack" and not S.Home.isAtHome(player)) then
			sessions[player] = nil
			return false
		end
		return true
	end
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root or (root.Position - s.Pos).Magnitude > Computer.SessionRadius then
		sessions[player] = nil
		S.Net.push(player, "closeComputer", {})
		return false
	end
	return true
end

function Computer.session(player)
	if Computer.hasSession(player) then
		return sessions[player]
	end
	return nil
end

function Computer.open(player, kind, pos, uid)
	sessions[player] = { Kind = kind, Pos = pos, Uid = uid }
	S.Quest.tutorialEvent(player, "open_computer")
	S.Net.push(player, "openComputer", { kind = kind, stats = Computer.sessionStats(player) })
	S.Data.markDirty(player)
end

function Computer.close(player)
	sessions[player] = nil
end

-- Lo llama WorldBuilder/Home cuando se activa el aviso de un escritorio.
function Computer.onPrompt(player, part, kind, ownerUserId)
	if kind == "home" and ownerUserId ~= player.UserId then
		S.Net.notify(player, "Este no es tu computador.", "error")
		return
	end
	Computer.open(player, kind, part.Position)
end

local function validateRigInput(player, parts, rigId)
	local data = S.Data.get(player)
	if type(parts) ~= "table" then
		return nil, "Montaje no válido."
	end
	local used = {}
	local ids, uidParts = {}, {}
	for _, slot in ipairs(PCBuild.Slots) do
		local v = parts[slot.Key]
		local list = {}
		if slot.Multi then
			if v ~= nil and type(v) ~= "table" then
				return nil, "Montaje no válido."
			end
			list = v or {}
			if #list > 8 then
				return nil, "Demasiadas piezas."
			end
		elseif v ~= nil then
			list = { v }
		end
		local slotIds, slotUids = {}, {}
		for _, uid in ipairs(list) do
			if type(uid) ~= "string" or used[uid] then
				return nil, "Pieza repetida o no válida."
			end
			used[uid] = true
			local rec = data.Inventory[uid]
			if not rec then
				return nil, "No tienes una de las piezas."
			end
			if rec.Loc ~= "home" and rec.Loc ~= rigLoc(rigId or "") then
				return nil, Catalog.get(rec.Id).Name .. " no está disponible en casa (está en la mochila o en otro PC)."
			end
			slotIds[#slotIds + 1] = rec.Id
			slotUids[#slotUids + 1] = uid
		end
		if slot.Multi then
			ids[slot.Key] = slotIds
			uidParts[slot.Key] = slotUids
		else
			ids[slot.Key] = slotIds[1]
			uidParts[slot.Key] = slotUids[1]
		end
	end
	local ok, errors, warnings = PCBuild.validate(ids)
	if not ok then
		return nil, "No se puede montar: " .. table.concat(errors, " ")
	end
	return uidParts, nil, warnings
end

function Computer.Start()
	local Net = S.Net

	Net.on("PC.OpenLaptop", function(player, p)
		local uid = S.Inventory.best(player, "laptop", "backpack", "CpuScore")
		if not uid and S.Home.isAtHome(player) then
			uid = S.Inventory.best(player, "laptop", "home", "CpuScore")
		end
		if not uid then
			return false, "No llevas un portátil en la mochila."
		end
		Computer.open(player, "laptop", nil, uid)
		return true
	end)

	Net.on("PC.Close", function(player)
		Computer.close(player)
		return true
	end)

	Net.on("PC.Stats", function(player)
		if not Computer.hasSession(player) then
			return false, "No estás usando un computador."
		end
		return true, nil, { stats = Computer.sessionStats(player), used = Computer.storageUsed(player) }
	end)

	Net.on("PC.SaveRig", function(player, p)
		local data = S.Data.get(player)
		if not S.Home.isAtHome(player) then
			return false, "Monta tus computadores en casa."
		end
		local rigId = p.rigId
		if rigId ~= nil and not data.Rigs[rigId] then
			return false, "Ese computador no existe."
		end
		if rigId == nil and Util.count(data.Rigs) >= Computer.MaxRigs then
			return false, "Máximo " .. Computer.MaxRigs .. " computadores montados."
		end
		local uidParts, err, warnings = validateRigInput(player, p.parts, rigId)
		if not uidParts then
			return false, err
		end
		local isNew = rigId == nil
		if isNew then
			rigId = S.Data.nextUid(player, "r")
			data.Rigs[rigId] = { Name = "PC personalizado", Parts = {}, From = "custom" }
		end
		local rig = data.Rigs[rigId]
		-- liberar piezas anteriores
		for _, rec in pairs(data.Inventory) do
			if rec.Loc == rigLoc(rigId) then
				rec.Loc = "home"
			end
		end
		for _, v in pairs(uidParts) do
			if type(v) == "table" then
				for _, uid in ipairs(v) do
					data.Inventory[uid].Loc = rigLoc(rigId)
				end
			elseif v then
				data.Inventory[v].Loc = rigLoc(rigId)
			end
		end
		rig.Parts = uidParts
		local name = Util.cleanText(p.name, 30)
		if name and #name > 0 then
			rig.Name = S.Text.filter(player, name) or rig.Name
		end
		if isNew then
			data.Counters.pcs_built = (data.Counters.pcs_built or 0) + 1
			S.Progress.addXp(player, S.Progress.Xp.PCBuilt)
			S.Quest.check(player)
		end
		if data.ActiveRig == "" or not data.Rigs[data.ActiveRig] then
			data.ActiveRig = rigId
		end
		S.Home.refreshRoom(player)
		local msg = isNew and "¡Computador montado!" or "Computador actualizado."
		if warnings and #warnings > 0 then
			msg = msg .. " Aviso: " .. table.concat(warnings, " ")
		end
		return true, msg, { rigId = rigId, stats = Computer.rigStats(player, rigId) }
	end)

	Net.on("PC.Disassemble", function(player, p)
		local data = S.Data.get(player)
		if not S.Home.isAtHome(player) then
			return false, "Desmonta tus computadores en casa."
		end
		local rig = data.Rigs[p.rigId]
		if not rig then
			return false, "Ese computador no existe."
		end
		for _, rec in pairs(data.Inventory) do
			if rec.Loc == rigLoc(p.rigId) then
				rec.Loc = "home"
			end
		end
		data.Rigs[p.rigId] = nil
		if data.ActiveRig == p.rigId then
			data.ActiveRig = next(data.Rigs) or ""
		end
		S.Home.refreshRoom(player)
		return true, "Computador desmontado: las piezas están en casa."
	end)

	Net.on("PC.SetActive", function(player, p)
		local data = S.Data.get(player)
		if not data.Rigs[p.rigId] then
			return false, "Ese computador no existe."
		end
		data.ActiveRig = p.rigId
		S.Home.refreshRoom(player)
		return true, "Ahora usas " .. data.Rigs[p.rigId].Name .. " en tu escritorio."
	end)

	local lastBench = {}
	Net.on("PC.Benchmark", function(player, p)
		local data = S.Data.get(player)
		local stats = Computer.rigStats(player, p.rigId)
		if not stats then
			return false, "Ese computador no es válido."
		end
		if lastBench[player] and os.clock() - lastBench[player] < 5 then
			return false, "Espera a que termine la prueba anterior."
		end
		lastBench[player] = os.clock()
		local points = math.floor(stats.Score * 137 * (0.97 + math.random() * 0.06))
		data.Counters.benchmarks = (data.Counters.benchmarks or 0) + 1
		S.Quest.check(player)
		return true, "Prueba completada: " .. Util.formatInt(points) .. " puntos.", { points = points, stats = stats }
	end)

	Players.PlayerRemoving:Connect(function(player)
		sessions[player] = nil
		lastBench[player] = nil
	end)
end

return Computer
