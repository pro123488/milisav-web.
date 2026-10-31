--!nonstrict
-- PCBuild: compatibilidad y rendimiento de computadores.
-- Recibe tablas de IDs de catálogo: { case=, cpu=, mobo=, ram=, gpu=, psu=, cooling=, storage={...}, fans={...} }
-- El servidor SIEMPRE vuelve a validar; el cliente lo usa solo para la vista previa.

local ItemCatalog = require(script.Parent.ItemCatalog)

local PCBuild = {}

PCBuild.Slots = {
	{ Key = "case", Name = "Gabinete", Sub = "case", Required = true },
	{ Key = "mobo", Name = "Placa base", Sub = "mobo", Required = true },
	{ Key = "cpu", Name = "Procesador", Sub = "cpu", Required = true },
	{ Key = "ram", Name = "Memoria RAM", Sub = "ram", Required = true },
	{ Key = "gpu", Name = "Tarjeta gráfica", Sub = "gpu", Required = false },
	{ Key = "storage", Name = "Almacenamiento", Sub = "internal", Multi = true, Required = true },
	{ Key = "cooling", Name = "Refrigeración", Sub = "cooling", Required = true },
	{ Key = "psu", Name = "Fuente de alimentación", Sub = "psu", Required = true },
	{ Key = "fans", Name = "Ventiladores", Sub = "fan", Multi = true, Required = false },
}

PCBuild.BaseWatts = 60
PCBuild.MaxScenesByTier = { 6, 10, 16, 22, 30, 40 }
PCBuild.TierNames = { "Básico", "Oficina", "Medio", "Avanzado", "Profesional", "Estación de trabajo" }

local function get(id)
	if id == nil then
		return nil
	end
	return ItemCatalog.get(id)
end

local function slotMatches(item, slot)
	if item == nil then
		return false
	end
	if slot.Key == "storage" then
		return item.Cat == "storage" and item.Sub == "internal"
	end
	return item.Cat == "component" and item.Sub == slot.Sub
end

function PCBuild.slotFor(item)
	for _, slot in ipairs(PCBuild.Slots) do
		if slotMatches(item, slot) then
			return slot
		end
	end
	return nil
end

local function contains(list, v)
	for _, x in ipairs(list) do
		if x == v then
			return true
		end
	end
	return false
end

function PCBuild.totalWatts(parts)
	local w = PCBuild.BaseWatts
	local cpu, gpu = get(parts.cpu), get(parts.gpu)
	if cpu then
		w = w + cpu.Stats.Tdp
	end
	if gpu then
		w = w + gpu.Stats.Watts
	end
	w = w + #(parts.storage or {}) * 6 + #(parts.fans or {}) * 3
	return w
end

-- Devuelve ok, errores (impiden montar), avisos (se puede montar pero con penalización)
function PCBuild.validate(parts)
	local errors, warnings = {}, {}
	parts = parts or {}

	for _, slot in ipairs(PCBuild.Slots) do
		local v = parts[slot.Key]
		if slot.Multi then
			v = v or {}
			if slot.Required and #v == 0 then
				errors[#errors + 1] = "Falta: " .. slot.Name
			end
			for _, id in ipairs(v) do
				if not slotMatches(get(id), slot) then
					errors[#errors + 1] = "Pieza no válida en " .. slot.Name
				end
			end
		else
			if v == nil then
				if slot.Required then
					errors[#errors + 1] = "Falta: " .. slot.Name
				end
			elseif not slotMatches(get(v), slot) then
				errors[#errors + 1] = "Pieza no válida en " .. slot.Name
			end
		end
	end

	local case, mobo, cpu, ram, gpu, psu, cool = get(parts.case), get(parts.mobo), get(parts.cpu), get(parts.ram), get(parts.gpu), get(parts.psu), get(parts.cooling)

	if cpu and mobo and cpu.Compat.Socket ~= mobo.Compat.Socket then
		errors[#errors + 1] = "El procesador (" .. cpu.Compat.Socket .. ") no encaja en la placa (" .. mobo.Compat.Socket .. ")."
	end
	if ram and mobo and ram.Compat.RamType ~= mobo.Compat.RamType then
		errors[#errors + 1] = "La placa usa " .. mobo.Compat.RamType .. " y la memoria es " .. ram.Compat.RamType .. "."
	end
	if case and mobo and not contains(case.Compat.Forms, mobo.Compat.Form) then
		errors[#errors + 1] = "La placa " .. mobo.Compat.Form .. " no cabe en el gabinete " .. case.Name .. "."
	end
	if case and gpu and gpu.Compat.Length > case.Compat.MaxGpu then
		errors[#errors + 1] = "La gráfica mide " .. gpu.Compat.Length .. " cm y el gabinete admite " .. case.Compat.MaxGpu .. " cm."
	end
	if mobo and parts.storage and #parts.storage > mobo.Compat.StorageSlots then
		errors[#errors + 1] = "La placa solo admite " .. mobo.Compat.StorageSlots .. " unidades de almacenamiento."
	end
	if case and parts.fans and #parts.fans > case.Stats.FanSlots then
		errors[#errors + 1] = "El gabinete solo admite " .. case.Stats.FanSlots .. " ventiladores."
	end
	if cpu and not gpu and (cpu.Stats.IGpu or 0) <= 0 then
		errors[#errors + 1] = "Este procesador no tiene gráficos integrados: añade una tarjeta gráfica."
	end
	if psu then
		local watts = PCBuild.totalWatts(parts)
		if watts > psu.Stats.Watts then
			errors[#errors + 1] = "Consumo " .. watts .. " W supera la fuente de " .. psu.Stats.Watts .. " W."
		elseif watts > psu.Stats.Watts * 0.85 then
			warnings[#warnings + 1] = "La fuente va al límite (" .. watts .. "/" .. psu.Stats.Watts .. " W)."
		end
	end
	if cpu and cool and cool.Stats.Capacity < cpu.Stats.Tdp then
		warnings[#warnings + 1] = "Refrigeración insuficiente: el procesador reducirá su velocidad (-20%)."
	end

	return #errors == 0, errors, warnings
end

local function ramFactor(gb)
	if gb >= 128 then
		return 1.25
	elseif gb >= 64 then
		return 1.18
	elseif gb >= 32 then
		return 1.1
	elseif gb >= 16 then
		return 1.0
	end
	return 0.8
end

function PCBuild.tierFromScore(score)
	if score < 25 then
		return 1
	elseif score < 40 then
		return 2
	elseif score < 55 then
		return 3
	elseif score < 70 then
		return 4
	elseif score < 85 then
		return 5
	end
	return 6
end

local function finish(stats)
	stats.Tier = PCBuild.tierFromScore(stats.Score)
	stats.TierName = PCBuild.TierNames[stats.Tier]
	stats.MaxScenes = PCBuild.MaxScenesByTier[stats.Tier]
	-- multiplicador de velocidad de render (más alto = exporta más rápido)
	stats.RenderMult = (0.6 + stats.Score / 50) * (1 + ((stats.StorageSpeed or 1) - 1) * 0.04)
	return stats
end

-- Estadísticas de un montaje (asume que validate() ya pasó o devuelve valores parciales)
function PCBuild.stats(parts, conditionFactor)
	parts = parts or {}
	local cpu, gpu, ram, cool, case = get(parts.cpu), get(parts.gpu), get(parts.ram), get(parts.cooling), get(parts.case)
	local cpuScore = cpu and cpu.Stats.Score or 0
	local gpuScore = gpu and gpu.Stats.Score or ((cpu and cpu.Stats.IGpu or 0) * 1.5)
	local ramGb = ram and ram.Stats.Gb or 0
	local score = (cpuScore * 0.55 + gpuScore * 0.45) * ramFactor(ramGb)

	local throttled = false
	if cpu and cool and cool.Stats.Capacity < cpu.Stats.Tdp then
		score = score * 0.8
		throttled = true
	end
	score = score * (conditionFactor or 1)

	local airflow = case and case.Stats.Airflow or 3
	local noise = cool and cool.Stats.Noise or 6
	for _, f in ipairs(parts.fans or {}) do
		local fan = get(f)
		if fan then
			airflow = airflow + fan.Stats.Airflow
			noise = noise + fan.Stats.Noise
		end
	end
	if gpu then
		noise = noise + gpu.Stats.Watts / 120
	end
	local tdp = cpu and cpu.Stats.Tdp or 50
	local capacity = cool and cool.Stats.Capacity or 50
	local temp = 30 + 50 * (tdp / capacity) - airflow * 1.6
	if temp < 32 then
		temp = 32
	end
	if temp > 98 then
		temp = 98
	end

	local gb, speed = 0, 1
	for _, s in ipairs(parts.storage or {}) do
		local d = get(s)
		if d then
			gb = gb + d.Stats.Gb
			if d.Stats.Speed > speed then
				speed = d.Stats.Speed
			end
		end
	end

	local value = 0
	for _, slot in ipairs(PCBuild.Slots) do
		local v = parts[slot.Key]
		if type(v) == "table" then
			for _, id in ipairs(v) do
				local it = get(id)
				value = value + (it and it.Price or 0)
			end
		elseif v then
			local it = get(v)
			value = value + (it and it.Price or 0)
		end
	end

	return finish({
		Score = math.floor(score * 10 + 0.5) / 10,
		Watts = PCBuild.totalWatts(parts),
		Temp = math.floor(temp + 0.5),
		Noise = math.floor(math.min(10, noise) * 10 + 0.5) / 10,
		Throttled = throttled,
		Ram = ramGb,
		StorageGb = gb,
		StorageSpeed = speed,
		ProColor = gpu and gpu.Stats.ProColor or 0,
		PartsValue = value,
	})
end

function PCBuild.laptopStats(item, conditionFactor)
	local s = item.Stats
	local score = (s.CpuScore * 0.55 + s.GpuScore * 0.45) * ramFactor(s.Ram) * (conditionFactor or 1)
	return finish({
		Score = math.floor(score * 10 + 0.5) / 10,
		Watts = 90,
		Temp = 60,
		Noise = 3,
		Throttled = false,
		Ram = s.Ram,
		StorageGb = s.Gb,
		StorageSpeed = 6,
		ProColor = s.ProColor or 0,
		PartsValue = item.Price,
	})
end

-- Equipo público (cibercafé / biblioteca)
function PCBuild.publicStats()
	return finish({ Score = 18, Watts = 0, Temp = 50, Noise = 5, Throttled = false, Ram = 8, StorageGb = 200, StorageSpeed = 1, ProColor = 0, PartsValue = 0 })
end

return PCBuild
