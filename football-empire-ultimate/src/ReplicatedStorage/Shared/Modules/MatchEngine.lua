-- MatchEngine (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/MatchEngine
--
-- MOTOR DE PARTIDOS SIMULADOS (FASE 5). Función pura: recibe dos alineaciones y un
-- generador aleatorio y devuelve el resultado completo. El SERVIDOR es el único que
-- la ejecuta para partidos reales (con su propio Random); el cliente solo usa
-- TeamRatings para previsualizar el efecto de la alineación y las tácticas.
--
-- Hoja de equipo (TeamSheet):
--   { name, short, formation, mentality, style,
--     players = { { id, name, pos, slotPos, attrs = {...}, fitness } × 11 } }

local Config = script.Parent.Parent.Config
local TacticsConfig = require(Config.TacticsConfig)

local MatchEngine = {}

-- Factor de un jugador en su puesto: forma física y posición.
function MatchEngine.PlayerFactor(p)
	local factor = 0.7 + 0.3 * math.clamp((p.fitness or 100) / 100, 0, 1)
	if p.slotPos and p.slotPos ~= p.pos then
		if p.slotPos == "GK" or p.pos == "GK" then
			factor *= TacticsConfig.GK_OUT_OF_POSITION
		else
			factor *= TacticsConfig.OUT_OF_POSITION
		end
	end
	return factor
end

local function avg(list)
	if #list == 0 then
		return 30
	end
	local total = 0
	for _, v in ipairs(list) do
		total += v
	end
	return total / #list
end

-- Valoraciones de línea (0-100 aprox.) de una alineación.
function MatchEngine.TeamRatings(sheet, fatigue)
	local att, mid, def, gk = {}, {}, {}, {}
	local counts = { GK = 0, DEF = 0, MID = 0, FWD = 0 }
	for _, p in ipairs(sheet.players) do
		local a = p.attrs
		local f = MatchEngine.PlayerFactor(p)
		if fatigue then
			f *= 0.9 + 0.1 * (a.stamina or 50) / 100
		end
		local slot = p.slotPos or p.pos
		counts[slot] = (counts[slot] or 0) + 1
		if slot == "FWD" then
			table.insert(att, (a.shooting * 0.45 + a.dribbling * 0.25 + a.pace * 0.30) * f)
		elseif slot == "MID" then
			table.insert(mid, (a.passing * 0.45 + a.stamina * 0.25 + a.dribbling * 0.15 + a.defending * 0.15) * f)
			table.insert(att, (a.passing * 0.5 + a.dribbling * 0.3 + a.shooting * 0.2) * f * 0.67) -- llegada desde segunda línea
		elseif slot == "DEF" then
			table.insert(def, (a.defending * 0.6 + a.pace * 0.2 + a.stamina * 0.2) * f)
		else
			table.insert(gk, a.defending * f)
		end
	end
	local mentality = TacticsConfig.Mentality(sheet.mentality)
	local attack = avg(att) * (0.85 + 0.06 * counts.FWD) * mentality.attack
	local midfield = avg(mid) * (0.85 + 0.05 * counts.MID)
	local keeper = avg(gk)
	local defense = (avg(def) * 0.7 + keeper * 0.3) * (0.85 + 0.04 * counts.DEF) * mentality.defense
	return { attack = attack, midfield = midfield, defense = defense, keeper = keeper, counts = counts }
end

local function weightedPick(rng, players, weightFn, exclude)
	local total = 0
	local weights = {}
	for i, p in ipairs(players) do
		local w = (p ~= exclude) and math.max(0, weightFn(p)) or 0
		weights[i] = w
		total += w
	end
	if total <= 0 then
		return nil
	end
	local roll = rng:NextNumber() * total
	for i, p in ipairs(players) do
		roll -= weights[i]
		if roll <= 0 then
			return p
		end
	end
	return players[#players]
end

local SCORER_WEIGHT = { FWD = 5, MID = 2, DEF = 0.5, GK = 0 }

-- opts = { crowd = 0..1 (ocupación del estadio local) }
function MatchEngine.Simulate(home, away, rng, opts)
	opts = opts or {}
	local sides = { home, away }
	local homeBoost = 1 + TacticsConfig.HOME_ADVANTAGE + TacticsConfig.CROWD_ADVANTAGE * math.clamp(opts.crowd or 0, 0, 1)
	local stats = {
		{ goals = 0, shots = 0, onTarget = 0, possessionChunks = 0 },
		{ goals = 0, shots = 0, onTarget = 0, possessionChunks = 0 },
	}
	local events = {}
	local playerStats = {} -- [id] = { goals, assists }
	local function ps(p)
		playerStats[p.id] = playerStats[p.id] or { goals = 0, assists = 0 }
		return playerStats[p.id]
	end

	for chunk = 1, TacticsConfig.CHUNKS do
		local minuteStart = (chunk - 1) * 5
		local fatigue = minuteStart >= TacticsConfig.FATIGUE_MINUTE
		local ratings = { MatchEngine.TeamRatings(home, fatigue), MatchEngine.TeamRatings(away, fatigue) }
		for key in pairs({ attack = true, midfield = true, defense = true, keeper = true }) do
			ratings[1][key] *= homeBoost
		end
		local styles = { TacticsConfig.Style(home.style), TacticsConfig.Style(away.style) }

		local m1, m2 = ratings[1].midfield ^ 2, ratings[2].midfield ^ 2
		local possession = math.clamp(m1 / (m1 + m2) + styles[1].possession - styles[2].possession, 0.25, 0.75)
		stats[1].possessionChunks += possession
		stats[2].possessionChunks += 1 - possession

		for s = 1, 2 do
			local o = 3 - s
			local share = (s == 1) and possession or (1 - possession)
			local style = styles[s]
			-- Contraataque: más peligroso cuanto más balón tiene el rival
			local quality = style.quality
			if style.id == "COUNTER" then
				quality *= 0.9 + (1 - share) * 0.4
			end
			local balance = ratings[s].attack / (ratings[s].attack + ratings[o].defense)
			local chanceProb = TacticsConfig.CHANCE_BASE * share * 2 * (balance * 2) ^ TacticsConfig.BALANCE_EXPONENT * style.chances
			if rng:NextNumber() < chanceProb then
				local minute = minuteStart + rng:NextInteger(1, 5)
				local side = sides[s]
				local shooter = weightedPick(rng, side.players, function(p)
					return (SCORER_WEIGHT[p.slotPos or p.pos] or 1) * (p.attrs.shooting or 1)
				end) or side.players[#side.players]
				stats[s].shots += 1
				local onTarget = rng:NextNumber() < math.clamp(TacticsConfig.ON_TARGET_BASE * quality * (0.7 + shooter.attrs.shooting / 160), 0.1, 0.85)
				if onTarget then
					stats[s].onTarget += 1
					local keeper = ratings[o].keeper
					local goalProb = TacticsConfig.GOAL_BASE * quality * (2 * shooter.attrs.shooting / (shooter.attrs.shooting + keeper)) ^ 1.5
					if rng:NextNumber() < math.clamp(goalProb, 0.05, 0.8) then
						stats[s].goals += 1
						ps(shooter).goals += 1
						local assist
						if rng:NextNumber() < TacticsConfig.ASSIST_CHANCE then
							assist = weightedPick(rng, side.players, function(p)
								return (p.attrs.passing or 1) * ((p.slotPos or p.pos) == "GK" and 0.05 or 1)
							end, shooter)
							if assist then
								ps(assist).assists += 1
							end
						end
						table.insert(events, { minute = minute, type = "goal", side = s, player = shooter.name, playerId = shooter.id,
							assist = assist and assist.name or nil, assistId = assist and assist.id or nil })
					else
						table.insert(events, { minute = minute, type = "save", side = s, player = shooter.name })
					end
				else
					table.insert(events, { minute = minute, type = "miss", side = s, player = shooter.name })
				end
			end
		end
	end
	table.sort(events, function(a, b)
		return a.minute < b.minute
	end)

	local goals = { stats[1].goals, stats[2].goals }
	local possessionHome = math.floor(stats[1].possessionChunks / TacticsConfig.CHUNKS * 100 + 0.5)

	-- Valoraciones individuales (6,0 - 10,0)
	local ratingsByPlayer = {}
	for s = 1, 2 do
		local diff = goals[s] - goals[3 - s]
		local resultBonus = diff > 0 and 0.5 or (diff < 0 and -0.4 or 0)
		for _, p in ipairs(sides[s].players) do
			local st = playerStats[p.id] or { goals = 0, assists = 0 }
			local r = 6.4 + st.goals * 1.0 + st.assists * 0.6 + resultBonus + (rng:NextNumber() - 0.5)
			if (p.slotPos or p.pos) == "GK" or (p.slotPos or p.pos) == "DEF" then
				r += goals[3 - s] == 0 and 0.4 or -0.15 * math.max(0, goals[3 - s] - 1)
			end
			ratingsByPlayer[p.id] = math.clamp(math.floor(r * 10 + 0.5) / 10, 4.0, 10.0)
		end
	end
	local mvp, best = nil, -1
	for s = 1, 2 do
		for _, p in ipairs(sides[s].players) do
			if ratingsByPlayer[p.id] > best then
				best = ratingsByPlayer[p.id]
				mvp = { name = p.name, side = s, rating = best }
			end
		end
	end

	return {
		home = { name = home.name, short = home.short, goals = goals[1], shots = stats[1].shots, onTarget = stats[1].onTarget, possession = possessionHome },
		away = { name = away.name, short = away.short, goals = goals[2], shots = stats[2].shots, onTarget = stats[2].onTarget, possession = 100 - possessionHome },
		events = events,
		playerStats = playerStats,
		ratings = ratingsByPlayer,
		mvp = mvp,
		mode = "simulated",
	}
end

return MatchEngine
