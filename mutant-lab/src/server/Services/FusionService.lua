--!nonstrict
-- FusionService: la cámara de fusión une dos mutantes de la misma especie y nivel en uno de nivel superior.
-- Los dos entran en la cámara (dejan libres sus pedestales) y, al terminar, el resultado se recoge en un pedestal libre.
-- La mejor mutación de los dos se conserva. Nadie puede robar lo que está dentro de la cámara.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local MM = require(script.Parent.MutantModel)

local Fusion = {}
local S
local shown = {} -- [player] = modelo en la cámara

function Fusion.Init(services)
	S = services
end

function Fusion.duration(data, level)
	return math.floor(Config.FusionBaseSeconds * level * (1 - 0.1 * (data.Research.fusion or 0)))
end

local function bestMutation(a, b)
	local ma = a and MutantData.MutationById[a]
	local mb = b and MutantData.MutationById[b]
	if ma and mb then
		return ma.Mult >= mb.Mult and a or b
	end
	return a or b
end

local function showInChamber(player)
	if shown[player] then
		shown[player]:Destroy()
		shown[player] = nil
	end
	local data = S.Data.get(player)
	local index = S.Lab.indexOf(player)
	local f = data and data.Lab.Fusion
	if not f or not index then
		return
	end
	local fl = S.World.FusionLocal
	local rec = { S = f.S, M = f.M, L = f.L }
	local model = MM.build(rec, S.World.labCF(index, fl[1], 2.1, fl[2]), { scale = 0.7, maxDistance = 50 })
	model.Parent = S.World.labs[index].Model
	shown[player] = model
end

function Fusion.start(player, a, b)
	local data = S.Data.get(player)
	local st = S.Lab.state(player)
	if type(a) ~= "number" or type(b) ~= "number" or a == b or not st then
		return false, "Elige dos mutantes distintos."
	end
	if data.Lab.Fusion then
		return false, "La cámara de fusión ya está ocupada."
	end
	if st.Carried[a] or st.Carried[b] then
		return false, "No puedes fusionar un mutante que te están robando."
	end
	local ra, rb = S.Lab.getMutant(player, a), S.Lab.getMutant(player, b)
	if not ra or not rb then
		return false, "Faltan mutantes en esos pedestales."
	end
	if ra.S ~= rb.S then
		return false, "Solo se fusionan mutantes de la misma especie."
	end
	local level = ra.L or 1
	if (rb.L or 1) ~= level then
		return false, "Los dos deben tener el mismo nivel."
	end
	if level >= Config.MaxLevel then
		return false, "Ya está al nivel máximo (" .. Config.MaxLevel .. ")."
	end
	S.Lab.removeMutant(player, a)
	S.Lab.removeMutant(player, b)
	local secs = Fusion.duration(data, level)
	data.Lab.Fusion = { S = ra.S, M = bestMutation(ra.M, rb.M), L = level + 1, Ends = os.time() + secs, From = { ra, rb } }
	showInChamber(player)
	return true, "🧬 Fusión en marcha: " .. MutantData.label({ S = ra.S, L = level + 1 }) .. " en " .. Util.time(secs) .. ".", { seconds = secs }
end

function Fusion.claim(player)
	local data = S.Data.get(player)
	local f = data.Lab.Fusion
	if not f then
		return false, "La cámara de fusión está vacía."
	end
	if os.time() < f.Ends then
		return false, "Aún faltan " .. Util.time(f.Ends - os.time()) .. "."
	end
	local slot = S.Lab.freeSlot(player)
	if not slot then
		return false, "No tienes pedestales libres para el resultado."
	end
	data.Lab.Fusion = nil
	local rec = { S = f.S, M = f.M, L = f.L }
	S.Lab.addMutant(player, rec, slot)
	data.Stats.Fusions = data.Stats.Fusions + 1
	showInChamber(player)
	return true, "✨ ¡Fusión completada! " .. MutantData.label(rec) .. " produce +" .. Util.short(MutantData.income(rec)) .. "/s."
end

function Fusion.cancel(player)
	local data = S.Data.get(player)
	local f = data.Lab.Fusion
	if not f then
		return false, "La cámara de fusión está vacía."
	end
	local free = S.Lab.tier(data).Slots - Util.count(data.Lab.Slots) - S.Lab.state(player).Reserved
	if free < 2 then
		return false, "Necesitas dos pedestales libres para recuperar a los dos mutantes."
	end
	data.Lab.Fusion = nil
	for _, r in ipairs(f.From or {}) do
		S.Lab.addMutant(player, { S = r.S, M = r.M, L = r.L })
	end
	showInChamber(player)
	return true, "Fusión cancelada: los dos mutantes vuelven a sus pedestales."
end

function Fusion.view(player)
	local data = S.Data.get(player)
	local f = data and data.Lab.Fusion
	if not f then
		return nil
	end
	return { Name = MutantData.label({ S = f.S, M = f.M, L = f.L }), Left = math.max(0, f.Ends - os.time()), Ready = os.time() >= f.Ends }
end

function Fusion.onReady(player)
	showInChamber(player)
end
function Fusion.onLeave(player)
	if shown[player] then
		shown[player]:Destroy()
		shown[player] = nil
	end
end

function Fusion.Start()
	S.Net.on("Fusion.Start", function(player, p)
		return Fusion.start(player, tonumber(p.a), tonumber(p.b))
	end)
	S.Net.on("Fusion.Claim", function(player)
		return Fusion.claim(player)
	end)
	S.Net.on("Fusion.Cancel", function(player)
		return Fusion.cancel(player)
	end)
end

return Fusion
