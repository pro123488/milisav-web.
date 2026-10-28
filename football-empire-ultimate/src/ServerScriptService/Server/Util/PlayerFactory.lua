-- PlayerFactory (ModuleScript)
-- Ubicación: ServerScriptService/Server/Util/PlayerFactory
-- Genera futbolistas ficticios en el SERVIDOR (el cliente nunca crea jugadores).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local FootballConfig = require(Shared.Config.FootballConfig)
local FootballFormulas = require(Shared.Modules.FootballFormulas)

local PlayerFactory = {}

local rng = Random.new()

function PlayerFactory.RandomName()
	local first = FootballConfig.FirstNames[rng:NextInteger(1, #FootballConfig.FirstNames)]
	local last = FootballConfig.LastNames[rng:NextInteger(1, #FootballConfig.LastNames)]
	return first .. " " .. last
end

function PlayerFactory.NextId(data)
	data.nextPlayerId = (data.nextPlayerId or 0) + 1
	return "p" .. data.nextPlayerId
end

-- Atributos alrededor de una media objetivo con el perfil de la posición.
local function makeAttrs(pos, target)
	local attrs = {}
	local bias = FootballConfig.Bias[pos] or FootballConfig.Bias.MID
	for _, attr in ipairs(FootballConfig.Attributes) do
		attrs[attr.id] = math.clamp(target + bias[attr.id] + rng:NextInteger(-6, 6), 5, 95)
	end
	-- Ajuste fino para que la media quede en el objetivo
	local probe = { pos = pos, attrs = attrs }
	local diff = target - FootballFormulas.Overall(probe)
	for id, value in pairs(attrs) do
		attrs[id] = math.clamp(value + diff, 5, 95)
	end
	return attrs
end

local function potentialFor(age, ovr)
	local gap
	if age <= 21 then
		gap = rng:NextInteger(5, 25)
	elseif age <= 25 then
		gap = rng:NextInteger(2, 12)
	elseif age <= 28 then
		gap = rng:NextInteger(0, 5)
	else
		gap = 0
	end
	return math.clamp(math.floor(ovr + gap + 0.5), 1, 97)
end

-- opts: { pos, overall, age, potential?, origin, contract? }
function PlayerFactory.Create(data, opts)
	local attrs = makeAttrs(opts.pos, opts.overall)
	local player = {
		id = PlayerFactory.NextId(data),
		name = PlayerFactory.RandomName(),
		age = opts.age,
		pos = opts.pos,
		attrs = attrs,
		focus = nil,
		origin = opts.origin or "start",
		joinedSeason = data.season.number,
		stats = { apps = 0, goals = 0, assists = 0 },
	}
	local ovr = FootballFormulas.Overall(player)
	player.potential = opts.potential or potentialFor(opts.age, ovr)
	player.peak = ovr
	player.salary = FootballFormulas.SalaryDemand(player)
	player.contract = opts.contract or rng:NextInteger(1, 3)
	return player
end

function PlayerFactory.StartingSquad(data)
	local squad = {}
	local range = FootballConfig.STARTING_OVERALL
	for _, position in ipairs(FootballConfig.Positions) do
		for _ = 1, FootballConfig.STARTING_SQUAD[position.id] or 0 do
			table.insert(squad, PlayerFactory.Create(data, {
				pos = position.id,
				overall = rng:NextInteger(range.min, range.max),
				age = rng:NextInteger(18, 33),
				origin = "start",
			}))
		end
	end
	return squad
end

-- Juvenil para la cantera. academyLevel y scouts condicionan el potencial.
function PlayerFactory.Youth(data, academyLevel, scouts)
	local academy = FootballConfig.Academy(academyLevel)
	local bonus = (scouts or 0) * FootballConfig.SCOUT_POTENTIAL_BONUS
	local potential = rng:NextInteger(academy.potentialMin + bonus, academy.potentialMax + bonus)
	local gem = rng:NextNumber() < FootballConfig.GEM_CHANCE + (scouts or 0) * FootballConfig.GEM_CHANCE_PER_SCOUT
	if gem then
		potential += FootballConfig.GEM_BONUS
	end
	local positions = FootballConfig.Positions
	local youth = PlayerFactory.Create(data, {
		pos = positions[rng:NextInteger(1, #positions)].id,
		overall = rng:NextInteger(FootballConfig.YOUTH_OVERALL.min, FootballConfig.YOUTH_OVERALL.max),
		age = rng:NextInteger(FootballConfig.YOUTH_START_AGE.min, FootballConfig.YOUTH_START_AGE.max),
		potential = math.clamp(potential, 40, 97),
		origin = "academy",
		contract = 0,
	})
	youth.salary = 0 -- los juveniles no cobran salario de primer equipo
	return youth
end

return PlayerFactory
