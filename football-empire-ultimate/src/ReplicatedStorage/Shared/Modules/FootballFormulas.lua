-- FootballFormulas (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/FootballFormulas
-- Fórmulas puras de futbolistas: media, valor, salario, potencial estimado y evolución.
-- Las usa el servidor (autoridad) y el cliente (solo para mostrar).

local FootballConfig = require(script.Parent.Parent.Config.FootballConfig)

local FootballFormulas = {}

function FootballFormulas.Overall(player)
	local weights = FootballConfig.Weights[player.pos] or FootballConfig.Weights.MID
	local total = 0
	for attr, w in pairs(weights) do
		total += (player.attrs[attr] or 0) * w
	end
	return total
end

function FootballFormulas.OverallInt(player)
	return math.floor(FootballFormulas.Overall(player) + 0.5)
end

local function ageFactor(age)
	if age <= 21 then
		return 1.3
	elseif age <= 26 then
		return 1.15
	elseif age <= 29 then
		return 1.0
	elseif age <= 32 then
		return 0.7
	end
	return 0.4
end

function FootballFormulas.MarketValue(player)
	local ovr = FootballFormulas.Overall(player)
	local margin = math.max(0, (player.potential or ovr) - ovr)
	local value = FootballConfig.VALUE_BASE * FootballConfig.VALUE_GROWTH ^ (ovr - 45)
		* ageFactor(player.age) * (1 + margin / 40)
	return math.max(100, math.floor(value / 100 + 0.5) * 100)
end

function FootballFormulas.SalaryDemand(player)
	local ovr = FootballFormulas.Overall(player)
	return math.max(2, math.floor(FootballConfig.SALARY_BASE * FootballConfig.SALARY_GROWTH ^ (ovr - 45) + 0.5))
end

-- Rango de potencial que se muestra según el número de ojeadores.
-- Es estable para cada jugador (no cambia al recargar) y siempre contiene el valor real.
function FootballFormulas.PotentialRange(player, scouts)
	local err = FootballConfig.SCOUT_ERROR[math.clamp(scouts or 0, 0, 3)]
	if err == 0 then
		return player.potential, player.potential
	end
	local hash = 0
	for i = 1, #player.id do
		hash = (hash * 31 + string.byte(player.id, i)) % 9973
	end
	local shift = hash % (err + 1) -- el valor real queda en una posición fija dentro del rango
	local low = player.potential - shift
	local high = low + err
	return math.max(1, low), math.min(99, high)
end

-- Evolución de un jugador en UNA jornada (devuelve el cambio de media previsto).
function FootballFormulas.GrowthPerCycle(player, multiplier)
	local rate = FootballConfig.AgeRate(player.age)
	if rate <= 0 then
		return FootballConfig.BASE_GROWTH * rate
	end
	local gap = (player.potential or 0) - FootballFormulas.Overall(player)
	if gap <= 0 then
		return 0
	end
	return FootballConfig.BASE_GROWTH * rate * math.clamp(gap / FootballConfig.GROWTH_GAP, 0, 1) * (multiplier or 1)
end

-- Aplica un cambio de media repartiéndolo entre atributos (según posición y foco).
function FootballFormulas.ApplyGrowth(player, delta)
	if delta == 0 then
		return
	end
	local weights = FootballConfig.Weights[player.pos] or FootballConfig.Weights.MID
	local share, denominator = {}, 0
	for attr, w in pairs(weights) do
		local s = w + (player.focus == attr and FootballConfig.FOCUS_WEIGHT or 0) + 0.02
		share[attr] = s
		denominator += w * s
	end
	if denominator <= 0 then
		return
	end
	local k = delta / denominator
	for attr, s in pairs(share) do
		player.attrs[attr] = math.clamp((player.attrs[attr] or 0) + k * s, 1, 99)
	end
end

function FootballFormulas.YouthSignFee(potential)
	return math.floor(FootballConfig.SCOUT_SIGN_BASE + potential * potential * FootballConfig.SCOUT_SIGN_PER_POTENTIAL2)
end

function FootballFormulas.ReleaseCost(player)
	return math.floor((player.salary or 0) * FootballConfig.SEASON_LENGTH * (player.contract or 0) * FootballConfig.RELEASE_COST_SHARE)
end

return FootballFormulas
