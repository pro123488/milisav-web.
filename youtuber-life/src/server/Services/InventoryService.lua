--!nonstrict
-- InventoryService: cada objeto comprado es una unidad con su propio identificador (uid),
-- condición, carga de batería y ubicación: "home" (en casa), "backpack" (mochila) o "rig:<id>" (instalado en un PC).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Inventory = {}
local S

Inventory.MaxItems = 300

function Inventory.Init(services)
	S = services
end

function Inventory.add(player, itemId, opts)
	local data = S.Data.get(player)
	local def = Catalog.get(itemId)
	if not data or not def then
		return nil, "Objeto desconocido."
	end
	if Util.count(data.Inventory) >= Inventory.MaxItems then
		return nil, "Tu inventario está lleno (" .. Inventory.MaxItems .. " objetos). Vende algo primero."
	end
	opts = opts or {}
	local uid = S.Data.nextUid(player, "i")
	local loc = opts.loc or "home"
	if loc == "backpack" and not (def.Portable and Inventory.canFit(player, def)) then
		loc = "home"
	end
	data.Inventory[uid] = {
		Id = itemId,
		Cond = opts.cond or 100,
		Loc = loc,
		Got = os.time(),
		GotDay = S.Time.day(),
		Src = opts.src or "shop",
		Paid = opts.paid or def.Price,
		Charge = 100,
	}
	if def.Cat == "camera" then
		data.Visited.Cameras[itemId] = true
	end
	S.Data.markDirty(player)
	return uid, loc
end

function Inventory.remove(player, uid)
	local data = S.Data.get(player)
	if data and data.Inventory[uid] then
		data.Inventory[uid] = nil
		if data.Equipped.Phone == uid then
			data.Equipped.Phone = ""
		end
		S.Data.markDirty(player)
		return true
	end
	return false
end

function Inventory.get(player, uid)
	local data = S.Data.get(player)
	local rec = data and data.Inventory[uid]
	if not rec then
		return nil
	end
	return rec, Catalog.get(rec.Id)
end

function Inventory.owns(player, itemId)
	local data = S.Data.get(player)
	for _, rec in pairs(data.Inventory) do
		if rec.Id == itemId then
			return true
		end
	end
	return false
end

function Inventory.backpackCap(player)
	local data = S.Data.get(player)
	local cap = Config.BaseBackpackSlots + S.Monetization.perk(player, "BackpackSlots")
	for _, rec in pairs(data.Inventory) do
		if rec.Loc == "backpack" then
			local def = Catalog.get(rec.Id)
			if def and def.Slot == "bag" then
				cap = cap + def.Stats.Slots
			end
		end
	end
	-- Maletero: con tu vehículo cerca puedes transportar más equipo
	cap = cap + (S.Vehicle and S.Vehicle.trunkBonus(player) or 0)
	return cap
end

function Inventory.backpackUsed(player)
	local data = S.Data.get(player)
	local used = 0
	for _, rec in pairs(data.Inventory) do
		if rec.Loc == "backpack" then
			local def = Catalog.get(rec.Id)
			used = used + (def and def.Size or 1)
		end
	end
	return used
end

function Inventory.canFit(player, def)
	return Inventory.backpackUsed(player) + def.Size <= Inventory.backpackCap(player)
end

-- Mejor objeto de un tipo (Slot) en una ubicación según una estadística.
function Inventory.best(player, slot, where, stat)
	local data = S.Data.get(player)
	local bestUid, bestRec, bestDef, bestVal = nil, nil, nil, -1
	for uid, rec in pairs(data.Inventory) do
		local def = Catalog.get(rec.Id)
		local here = where == "any" or rec.Loc == where or (where == "home" and rec.Loc:sub(1, 5) == "prop:")
		if def and def.Slot == slot and here then
			local v = stat and (def.Stats[stat] or 0) or def.Quality
			if type(v) ~= "number" then
				v = def.Quality
			end
			v = v * (0.85 + 0.15 * rec.Cond / 100)
			if v > bestVal then
				bestUid, bestRec, bestDef, bestVal = uid, rec, def, v
			end
		end
	end
	return bestUid, bestRec, bestDef
end

-- Mejor objeto de una categoría en casa (monitores, sillas...)
function Inventory.bestCatAtHome(player, cat, sub, stat)
	local data = S.Data.get(player)
	local best, bestVal = nil, -1
	for _, rec in pairs(data.Inventory) do
		local def = Catalog.get(rec.Id)
		if def and def.Cat == cat and (sub == nil or def.Sub == sub) and (rec.Loc == "home" or rec.Loc:sub(1, 5) == "prop:") then
			local v = def.Stats[stat] or 0
			if v > bestVal then
				best, bestVal = def, v
			end
		end
	end
	return best
end

function Inventory.phone(player)
	local data = S.Data.get(player)
	local uid = data.Equipped.Phone
	local rec = data.Inventory[uid]
	if not rec then
		-- elegir el mejor teléfono disponible
		local u, r = Inventory.best(player, "phone", "any", "Photo")
		if u then
			data.Equipped.Phone = u
			return r, Catalog.get(r.Id), u
		end
		return nil
	end
	return rec, Catalog.get(rec.Id), uid
end

function Inventory.condFactor(rec)
	return 0.85 + 0.15 * (rec.Cond or 100) / 100
end

-- Recarga baterías (al estar en casa)
function Inventory.chargeAll(player)
	local data = S.Data.get(player)
	local changed = false
	for _, rec in pairs(data.Inventory) do
		if rec.Charge ~= nil and rec.Charge < 100 then
			rec.Charge = 100
			changed = true
		end
	end
	if changed then
		S.Data.markDirty(player)
	end
	return changed
end

function Inventory.sellValue(rec, def)
	return math.floor((rec.Paid or def.Price) * Config.SellBackRate * (rec.Cond / 100) + 0.5)
end

function Inventory.canReturn(rec)
	return (rec.Src == "shop" or rec.Src == "online") and rec.Cond >= 90
		and (S.Time.day() - (rec.GotDay or 0)) <= Config.ReturnWindowDays
end

function Inventory.Start()
	local Net = S.Net

	Net.on("Inv.Move", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		if not rec then
			return false, "No tienes ese objeto."
		end
		local def = Catalog.get(rec.Id)
		local to = p.to
		if to ~= "home" and to ~= "backpack" then
			return false, "Destino no válido."
		end
		if rec.Loc:sub(1, 4) == "rig:" then
			return false, "Está instalado en un computador. Desmóntalo en el Montador de PC."
		end
		if rec.Loc:sub(1, 5) == "prop:" then
			return false, "Está colocado en una propiedad. Recógelo con el modo construcción."
		end
		if rec.Loc == to then
			return true
		end
		if not S.Home.isAtHome(player) then
			return false, "Solo puedes preparar la mochila en casa."
		end
		if to == "backpack" then
			if not def.Portable then
				return false, def.Name .. " no es portátil."
			end
			if not Inventory.canFit(player, def) then
				return false, "La mochila está llena (" .. Inventory.backpackUsed(player) .. "/" .. Inventory.backpackCap(player) .. ")."
			end
		else
			-- Sacar una bolsa no puede dejar la mochila por encima de su capacidad
			if def.Slot == "bag" then
				local after = Inventory.backpackCap(player) - def.Stats.Slots
				if Inventory.backpackUsed(player) - def.Size > after then
					return false, "Primero saca otros objetos: no cabrían sin esta bolsa."
				end
			end
		end
		rec.Loc = to
		if to == "backpack" then
			S.Quest.tutorialEvent(player, "pack")
		end
		return true, (to == "backpack") and (def.Name .. " → mochila") or (def.Name .. " → casa")
	end)

	Net.on("Inv.EquipPhone", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		if not rec or Catalog.get(rec.Id).Slot ~= "phone" then
			return false, "Eso no es un teléfono."
		end
		data.Equipped.Phone = p.uid
		return true, "Ahora usas " .. Catalog.get(rec.Id).Name .. "."
	end)

	local function checkSellable(player, rec, def, uid)
		local data = S.Data.get(player)
		if not rec then
			return "No tienes ese objeto."
		end
		if rec.Loc:sub(1, 4) == "rig:" then
			return "Está instalado en un computador. Desmóntalo primero."
		end
		if rec.Loc:sub(1, 5) == "prop:" then
			return "Está colocado en una propiedad. Recógelo primero con el modo construcción."
		end
		if rec.Loan then
			return "Es equipo prestado por un patrocinador: se devuelve al terminar el contrato."
		end
		if def.Slot == "phone" then
			local phones = 0
			for _, r in pairs(data.Inventory) do
				if Catalog.get(r.Id).Slot == "phone" then
					phones = phones + 1
				end
			end
			if phones <= 1 then
				return "No puedes quedarte sin teléfono."
			end
		end
		if def.Slot == "bag" and rec.Loc == "backpack" then
			return "Saca la bolsa de la mochila antes de venderla."
		end
		return nil
	end

	Net.on("Inv.Sell", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		local def = rec and Catalog.get(rec.Id)
		local err = checkSellable(player, rec, def, p.uid)
		if err then
			return false, err
		end
		local value = Inventory.sellValue(rec, def)
		Inventory.remove(player, p.uid)
		S.Economy.add(player, value, "Ventas", "Venta de " .. def.Name, { silent = false })
		return true, "Vendiste " .. def.Name .. " por $" .. Util.formatInt(value) .. "."
	end)

	Net.on("Inv.Return", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		local def = rec and Catalog.get(rec.Id)
		local err = checkSellable(player, rec, def, p.uid)
		if err then
			return false, err
		end
		if not Inventory.canReturn(rec) then
			return false, "Ya no se puede devolver (máximo " .. Config.ReturnWindowDays .. " días y en buen estado)."
		end
		local value = math.floor(rec.Paid * Config.ReturnRefundRate + 0.5)
		Inventory.remove(player, p.uid)
		S.Economy.add(player, value, "Devoluciones", "Devolución de " .. def.Name, {})
		return true, "Devolución aceptada: +$" .. Util.formatInt(value) .. "."
	end)

	Net.on("Inv.Clean", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		if not rec then
			return false, "No tienes ese objeto."
		end
		if not S.Home.isAtHome(player) then
			return false, "Limpia tu equipo en casa."
		end
		if rec.Cond >= 90 then
			return false, "Ya está limpio y en buen estado."
		end
		if rec.CleanDay == S.Time.day() then
			return false, "Ya lo limpiaste hoy."
		end
		rec.CleanDay = S.Time.day()
		rec.Cond = math.min(90, rec.Cond + 10)
		return true, "Equipo limpiado: condición " .. math.floor(rec.Cond) .. "%."
	end)

	Net.on("Inv.Repair", function(player, p)
		local data = S.Data.get(player)
		local rec = data.Inventory[p.uid]
		if not rec then
			return false, "No tienes ese objeto."
		end
		local def = Catalog.get(rec.Id)
		if rec.Cond >= 100 then
			return false, "No necesita reparación."
		end
		-- Técnico de tu empresa: reparaciones a mitad de precio
		local mult = S.Company and S.Company.repairMult(player) or 1
		local cost = math.max(5, math.floor(def.Price * 0.15 * (100 - rec.Cond) / 50 * mult + 0.5))
		if not S.Economy.spend(player, cost, "Reparaciones", "Reparación de " .. def.Name) then
			return false, "La reparación cuesta $" .. cost .. "."
		end
		rec.Cond = 100
		return true, def.Name .. " reparado por $" .. cost .. "."
	end)
end

return Inventory
