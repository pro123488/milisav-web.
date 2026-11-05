--!nonstrict
-- MutantData: rarezas, mutaciones y especies de criaturas (todas inventadas para este juego).
-- Cada especie describe su cuerpo con piezas sencillas: el servidor construye el modelo a partir de esto.

local Config = require(script.Parent.Config)

local MutantData = {}

MutantData.Rarities = {
	{ Id = "common", Name = "Común", Color = { 190, 200, 205 }, Weight = 60 },
	{ Id = "uncommon", Name = "Poco común", Color = { 90, 220, 110 }, Weight = 25 },
	{ Id = "rare", Name = "Raro", Color = { 70, 150, 255 }, Weight = 10 },
	{ Id = "epic", Name = "Épico", Color = { 180, 90, 255 }, Weight = 3.5 },
	{ Id = "legendary", Name = "Legendario", Color = { 255, 180, 40 }, Weight = 1.2 },
	{ Id = "mythic", Name = "Mítico", Color = { 255, 70, 120 }, Weight = 0.25 },
	{ Id = "secret", Name = "Secreto", Color = { 20, 255, 230 }, Weight = 0.05 },
}
MutantData.RarityById = {}
for i, r in ipairs(MutantData.Rarities) do
	r.Order = i
	MutantData.RarityById[r.Id] = r
end

-- Mutaciones: multiplican producción y valor
MutantData.Mutations = {
	{ Id = "rad", Name = "Radiactivo", Mult = 2, Color = { 120, 255, 60 }, Chance = 0.06 },
	{ Id = "crystal", Name = "Cristalino", Mult = 3, Color = { 160, 230, 255 }, Chance = 0.025 },
	{ Id = "shadow", Name = "Sombrío", Mult = 4, Color = { 90, 40, 140 }, Chance = 0.01 },
	{ Id = "galaxy", Name = "Galáctico", Mult = 6, Color = { 255, 110, 230 }, Chance = 0.004 },
}
MutantData.MutationById = {}
for _, m in ipairs(MutantData.Mutations) do
	MutantData.MutationById[m.Id] = m
end

-- Body: "ball" | "block" | "cyl"; Scale = {x, y, z}; Eyes = número de ojos; Parts = piezas extra
local S = {
	-- Comunes
	{ Id = "blobito", Name = "Blobito", Rarity = "common", Price = 25, Income = 1, Body = "ball", Scale = { 2.4, 1.8, 2.4 }, Eyes = 2, Parts = {}, C1 = { 120, 220, 120 }, C2 = { 60, 160, 60 } },
	{ Id = "saltarrana", Name = "Saltarrana", Rarity = "common", Price = 40, Income = 1.5, Body = "ball", Scale = { 2.4, 1.6, 2.6 }, Eyes = 2, Parts = { "legs", "eyestalks" }, C1 = { 80, 200, 90 }, C2 = { 240, 230, 80 } },
	{ Id = "gusarrin", Name = "Gusarrín", Rarity = "common", Price = 55, Income = 2, Body = "ball", Scale = { 1.6, 1.6, 1.6 }, Eyes = 2, Parts = { "segments" }, C1 = { 240, 150, 170 }, C2 = { 200, 90, 120 } },
	{ Id = "burbujon", Name = "Burbujón", Rarity = "common", Price = 70, Income = 2.5, Body = "ball", Scale = { 2.6, 2.6, 2.6 }, Eyes = 2, Parts = { "bubbles" }, C1 = { 140, 210, 255 }, C2 = { 255, 255, 255 }, Glass = true },
	{ Id = "champibaile", Name = "Champibaile", Rarity = "common", Price = 90, Income = 3, Body = "cyl", Scale = { 1.4, 2, 1.4 }, Eyes = 2, Parts = { "cap" }, C1 = { 240, 230, 210 }, C2 = { 220, 50, 50 } },
	-- Poco comunes
	{ Id = "tentaculin", Name = "Tentaculín", Rarity = "uncommon", Price = 180, Income = 6, Body = "ball", Scale = { 2.2, 2.2, 2.2 }, Eyes = 2, Parts = { "tentacles" }, C1 = { 170, 90, 220 }, C2 = { 120, 50, 170 } },
	{ Id = "ojoton", Name = "Ojotón", Rarity = "uncommon", Price = 260, Income = 8, Body = "ball", Scale = { 2.8, 2.8, 2.8 }, Eyes = 1, Parts = { "bigeye", "legs" }, C1 = { 250, 120, 60 }, C2 = { 255, 255, 255 } },
	{ Id = "murcineon", Name = "Murcineón", Rarity = "uncommon", Price = 340, Income = 10, Body = "ball", Scale = { 1.8, 1.8, 1.8 }, Eyes = 2, Parts = { "wings", "ears" }, C1 = { 50, 50, 70 }, C2 = { 0, 255, 200 } },
	{ Id = "pinchito", Name = "Pinchito", Rarity = "uncommon", Price = 420, Income = 12, Body = "cyl", Scale = { 1.6, 2.8, 1.6 }, Eyes = 2, Parts = { "arms", "spikes" }, C1 = { 60, 170, 90 }, C2 = { 250, 240, 200 } },
	{ Id = "rocaflip", Name = "Rocaflip", Rarity = "uncommon", Price = 520, Income = 14, Body = "block", Scale = { 2.6, 2.2, 2.6 }, Eyes = 2, Parts = { "spikes" }, C1 = { 130, 120, 115 }, C2 = { 255, 140, 40 } },
	-- Raros
	{ Id = "calamarciano", Name = "Calamarciano", Rarity = "rare", Price = 1400, Income = 30, Body = "cyl", Scale = { 2, 3, 2 }, Eyes = 2, Parts = { "tentacles", "antenna" }, C1 = { 90, 230, 200 }, C2 = { 255, 80, 160 } },
	{ Id = "gatoplasma", Name = "Gatoplasma", Rarity = "rare", Price = 2100, Income = 40, Body = "block", Scale = { 2.2, 2, 3 }, Eyes = 2, Parts = { "ears", "tail", "legs" }, C1 = { 200, 120, 255 }, C2 = { 255, 220, 255 }, Glass = true },
	{ Id = "medusazap", Name = "Medusazap", Rarity = "rare", Price = 2900, Income = 52, Body = "ball", Scale = { 2.8, 2, 2.8 }, Eyes = 2, Parts = { "tentacles", "glow" }, C1 = { 120, 200, 255 }, C2 = { 255, 255, 120 }, Glass = true },
	{ Id = "hongozilla", Name = "Hongozilla Mini", Rarity = "rare", Price = 3600, Income = 62, Body = "cyl", Scale = { 2, 2.6, 2 }, Eyes = 2, Parts = { "cap", "arms", "spikes" }, C1 = { 230, 220, 200 }, C2 = { 120, 60, 200 } },
	{ Id = "pulpotron", Name = "Pulpotrón", Rarity = "rare", Price = 4400, Income = 75, Body = "ball", Scale = { 2.6, 2.6, 2.6 }, Eyes = 2, Parts = { "tentacles", "visor", "antenna" }, C1 = { 180, 190, 200 }, C2 = { 255, 60, 60 } },
	-- Épicos
	{ Id = "dragoacido", Name = "Dragoácido", Rarity = "epic", Price = 11000, Income = 160, Body = "block", Scale = { 2.4, 2.2, 4 }, Eyes = 2, Parts = { "wings", "tail", "horns", "legs" }, C1 = { 140, 230, 40 }, C2 = { 255, 255, 80 } },
	{ Id = "cristalodonte", Name = "Cristalodonte", Rarity = "epic", Price = 16000, Income = 220, Body = "block", Scale = { 2.8, 2.4, 3.4 }, Eyes = 2, Parts = { "crystals", "legs", "tail" }, C1 = { 150, 220, 255 }, C2 = { 255, 255, 255 }, Glass = true },
	{ Id = "fantasmon", Name = "Fantasmón Glotón", Rarity = "epic", Price = 22000, Income = 290, Body = "ball", Scale = { 3, 3.4, 3 }, Eyes = 2, Parts = { "skirt", "mouth" }, C1 = { 235, 235, 255 }, C2 = { 120, 120, 200 }, Ghost = true },
	{ Id = "lavapuff", Name = "Lavapuff", Rarity = "epic", Price = 30000, Income = 370, Body = "ball", Scale = { 3, 2.6, 3 }, Eyes = 2, Parts = { "cracks", "horns" }, C1 = { 60, 30, 30 }, C2 = { 255, 110, 20 } },
	-- Legendarios
	{ Id = "hidraneon", Name = "Hidra Neón", Rarity = "legendary", Price = 90000, Income = 1000, Body = "block", Scale = { 3.4, 2.6, 4 }, Eyes = 0, Parts = { "necks", "tail", "legs" }, C1 = { 40, 60, 120 }, C2 = { 0, 255, 255 } },
	{ Id = "titangel", Name = "Titán de Gelatina", Rarity = "legendary", Price = 150000, Income = 1500, Body = "block", Scale = { 4.4, 4.4, 4.4 }, Eyes = 2, Parts = { "mouth", "bubbles" }, C1 = { 255, 90, 140 }, C2 = { 255, 200, 220 }, Glass = true },
	{ Id = "fenixrad", Name = "Fénix Radiactivo", Rarity = "legendary", Price = 240000, Income = 2300, Body = "ball", Scale = { 2.4, 2.8, 2.4 }, Eyes = 2, Parts = { "bigwings", "tail", "crest", "glow" }, C1 = { 255, 140, 30 }, C2 = { 140, 255, 60 } },
	-- Míticos
	{ Id = "krakenbolsillo", Name = "Kraken de Bolsillo", Rarity = "mythic", Price = 900000, Income = 8500, Body = "ball", Scale = { 3.6, 3.6, 3.6 }, Eyes = 2, Parts = { "tentacles", "tentacles2", "crest" }, C1 = { 120, 30, 80 }, C2 = { 255, 220, 60 } },
	{ Id = "quimeracuantica", Name = "Quimera Cuántica", Rarity = "mythic", Price = 1800000, Income = 16000, Body = "block", Scale = { 3, 2.6, 4.6 }, Eyes = 3, Parts = { "bigwings", "horns", "tail", "legs", "glow" }, C1 = { 30, 30, 50 }, C2 = { 180, 90, 255 } },
	-- Secretos
	{ Id = "experimentox", Name = "Experimento X", Rarity = "secret", Price = 7000000, Income = 65000, Body = "cyl", Scale = { 2.6, 4.2, 2.6 }, Eyes = 1, Parts = { "bigeye", "rings", "antenna", "glow" }, C1 = { 20, 20, 24 }, C2 = { 0, 255, 120 } },
	{ Id = "nucleovivo", Name = "Núcleo Viviente", Rarity = "secret", Price = 14000000, Income = 120000, Body = "ball", Scale = { 3.4, 3.4, 3.4 }, Eyes = 2, Parts = { "rings", "glow", "crystals" }, C1 = { 255, 255, 255 }, C2 = { 255, 60, 220 }, Glass = true },
}
MutantData.Species = S
MutantData.SpeciesById = {}
for i, sp in ipairs(S) do
	sp.Order = i
	MutantData.SpeciesById[sp.Id] = sp
end

-- Producción por segundo de un mutante concreto (sin mejoras del jugador)
function MutantData.income(rec)
	local sp = MutantData.SpeciesById[rec.S]
	if not sp then
		return 0
	end
	local mut = rec.M and MutantData.MutationById[rec.M]
	return sp.Income * (mut and mut.Mult or 1) * Config.LevelIncomeMult ^ ((rec.L or 1) - 1)
end

-- Valor de referencia (para vender)
function MutantData.value(rec)
	local sp = MutantData.SpeciesById[rec.S]
	if not sp then
		return 0
	end
	local mut = rec.M and MutantData.MutationById[rec.M]
	return sp.Price * (mut and mut.Mult or 1) * Config.LevelValueMult ^ ((rec.L or 1) - 1)
end

function MutantData.label(rec)
	local sp = MutantData.SpeciesById[rec.S]
	local mut = rec.M and MutantData.MutationById[rec.M]
	local name = (mut and (mut.Name .. " ") or "") .. (sp and sp.Name or "?")
	if (rec.L or 1) > 1 then
		name = name .. " Nv." .. rec.L
	end
	return name
end

-- Elige especie y mutación para una cápsula. luck > 1 favorece rarezas altas; mutLuck multiplica mutaciones.
function MutantData.roll(rng, luck, mutLuck)
	luck = luck or 1
	mutLuck = mutLuck or 1
	local rarity = nil
	local total = 0
	for _, r in ipairs(MutantData.Rarities) do
		total = total + (r.Order == 1 and r.Weight or r.Weight * luck)
	end
	local x = rng:NextNumber() * total
	for _, r in ipairs(MutantData.Rarities) do
		x = x - (r.Order == 1 and r.Weight or r.Weight * luck)
		if x <= 0 then
			rarity = r
			break
		end
	end
	rarity = rarity or MutantData.Rarities[1]
	local pool = {}
	for _, sp in ipairs(S) do
		if sp.Rarity == rarity.Id then
			pool[#pool + 1] = sp
		end
	end
	local sp = pool[rng:NextInteger(1, #pool)]
	local mutation = nil
	for i = #MutantData.Mutations, 1, -1 do
		local m = MutantData.Mutations[i]
		if rng:NextNumber() < m.Chance * mutLuck then
			mutation = m.Id
			break
		end
	end
	return sp.Id, mutation
end

return MutantData
