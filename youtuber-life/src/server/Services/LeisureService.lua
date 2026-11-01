--!nonstrict
-- LeisureService: ocio en la ciudad.
--  * Gimnasio Pulso Fit (Barrio residencial): entrenar gasta energía, sube el ánimo y la forma física
--    (data.Fitness 0-100), que da +1 a +3 de interés en vídeos de deporte / fitness.
--  * Cines Lumière (Distrito de entretenimiento): ver una película sube el ánimo, bloquea el cine 10 minutos
--    (no puedes ver otra hasta entonces) y te da una idea de vídeo (categoría + título) para crear un proyecto.
--  * Karaoke Micrófono de Oro (Distrito de restaurantes): sube el ánimo; con un micrófono en la mochila tu
--    actuación es una escena especial de música (si estás grabando, se añade a tu proyecto con bonus).
--  * Bolera Strike & Recreativos (Distrito de entretenimiento): minijuego de bolos (puntuación aleatoria +
--    habilidad: leer la pista, forma física y experiencia) con premio pequeño y límite diario de partidas.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local StudioData = require(Shared.StudioData)
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)

local Leisure = {}
local S
local lastGym = {}
local lastKaraoke = {}

local PLACES = {
	gym = { Type = "gym", Name = StudioData.Gym.Name, Where = "Barrio residencial" },
	cinema = { Type = "cinema", Name = StudioData.Cinema.Name, Where = "Distrito de entretenimiento" },
	karaoke = { Type = "karaoke", Name = StudioData.Karaoke.Name, Where = "Distrito de restaurantes" },
	bowling = { Type = "bowling", Name = StudioData.Bowling.Name, Where = "Distrito de entretenimiento" },
}

function Leisure.Init(services)
	S = services
end

local function state(data)
	if type(data.Leisure) ~= "table" then
		data.Leisure = {}
	end
	local l = data.Leisure
	l.CinemaNext = l.CinemaNext or 0
	l.BowlDay = l.BowlDay or 0
	l.BowlGames = l.BowlGames or 0
	l.BowlBest = l.BowlBest or 0
	l.BowlTotal = l.BowlTotal or 0
	if type(l.Idea) ~= "table" then
		l.Idea = { Category = "", Title = "" }
	end
	return l
end

local function near(player, kind)
	return S.World.nearSpecial(player, PLACES[kind].Type, 35) ~= nil
end

local function notHere(kind)
	local p = PLACES[kind]
	return "Ve a " .. p.Name .. " (" .. p.Where .. ")."
end

-- ¿En qué lugar de ocio estás? (para la app)
function Leisure.where(player)
	for kind in pairs(PLACES) do
		if near(player, kind) then
			return kind
		end
	end
	return nil
end

local function counted(player, data)
	data.Counters.leisure = (data.Counters.leisure or 0) + 1
	S.Quest.check(player)
	S.Data.markDirty(player)
end

-- Interés extra en escenas de vídeos de deporte / fitness según la forma física
function Leisure.interestBonus(player, cat)
	local data = S.Data.get(player)
	if not data or not StudioData.isFitnessCategory(cat) then
		return 0
	end
	return StudioData.fitnessInterest(data.Fitness or 0)
end

function Leisure.bowlLeft(data)
	local l = state(data)
	if l.BowlDay ~= S.Time.day() then
		return StudioData.Bowling.DailyLimit
	end
	return math.max(0, StudioData.Bowling.DailyLimit - l.BowlGames)
end

function Leisure.view(player)
	local data = S.Data.get(player)
	if not data then
		return nil
	end
	local l = state(data)
	return {
		At = Leisure.where(player),
		Fitness = data.Fitness or 0,
		CinemaIn = math.max(0, l.CinemaNext - os.time()),
		BowlLeft = Leisure.bowlLeft(data),
		Lane = StudioData.lane(S.Time.day()),
		HasMic = S.Inventory.best(player, "mic", "backpack", "Audio") ~= nil,
		Recording = S.Video.isRecording(player),
	}
end

function Leisure.workout(player)
	local data = S.Data.get(player)
	local cfg = StudioData.Gym
	if not near(player, "gym") then
		return false, notHere("gym")
	end
	if lastGym[player] and os.clock() - lastGym[player] < cfg.Cooldown then
		return false, "Descansa un poco entre series (" .. math.ceil(cfg.Cooldown - (os.clock() - lastGym[player])) .. " s)."
	end
	local n = S.Needs.get(data)
	if n.Energy < cfg.MinEnergy then
		return false, "Estás sin energía para entrenar. Come algo o descansa primero."
	end
	if not S.Economy.spend(player, cfg.Price, "Ocio", "Sesión en " .. cfg.Name) then
		return false, "La sesión cuesta $" .. cfg.Price .. "."
	end
	lastGym[player] = os.clock()
	local gain = StudioData.fitnessGain(data.Fitness)
	data.Fitness = Util.clamp((data.Fitness or 0) + gain, 0, 100)
	S.Needs.change(player, -cfg.Energy, cfg.Mood)
	data.Counters.workouts = (data.Counters.workouts or 0) + 1
	counted(player, data)
	return true, "🏋 ¡Buen entrenamiento! Forma física " .. math.floor(data.Fitness) .. "/100 (+" .. gain .. "), energía -" .. cfg.Energy .. ", ánimo +" .. cfg.Mood .. ".", { fitness = data.Fitness }
end

function Leisure.watch(player, movieId)
	local data = S.Data.get(player)
	local movie = StudioData.MovieById[movieId or ""]
	if not movie then
		return false, "Elige una película de la cartelera."
	end
	if not near(player, "cinema") then
		return false, notHere("cinema")
	end
	local l = state(data)
	local wait = l.CinemaNext - os.time()
	if wait > 0 then
		return false, "Acabas de salir del cine. Vuelve en " .. StudioData.gameMinutes(wait) .. " min."
	end
	if not S.Economy.spend(player, movie.Price, "Ocio", "Entrada de cine: " .. movie.Name) then
		return false, "La entrada cuesta $" .. movie.Price .. "."
	end
	local cfg = StudioData.Cinema
	l.CinemaNext = os.time() + cfg.Hours * StudioData.HourSeconds
	S.Needs.change(player, cfg.Energy, cfg.Mood)
	local cat = VideoData.CategoryById[movie.Idea[1]]
	l.Idea = { Category = cat and cat.Id or "vlog", Title = movie.Idea[2] }
	-- Si existe un sistema de ideas, la idea también se guarda allí
	if type(data.Ideas) == "table" then
		table.insert(data.Ideas, { Category = l.Idea.Category, Title = l.Idea.Title, Src = "cine", T = os.time() })
	end
	data.Counters.movies = (data.Counters.movies or 0) + 1
	counted(player, data)
	return true, "🎬 Has visto «" .. movie.Name .. "» (" .. cfg.Hours .. " h de juego): ánimo +" .. cfg.Mood .. ". 💡 Idea: «" .. l.Idea.Title .. "» (" .. (cat and cat.Name or "Vlog") .. ").", { idea = l.Idea }
end

function Leisure.sing(player)
	local data = S.Data.get(player)
	local cfg = StudioData.Karaoke
	if not near(player, "karaoke") then
		return false, notHere("karaoke")
	end
	if lastKaraoke[player] and os.clock() - lastKaraoke[player] < cfg.Cooldown then
		return false, "Deja cantar a los demás un momento (" .. math.ceil(cfg.Cooldown - (os.clock() - lastKaraoke[player])) .. " s)."
	end
	if not S.Economy.spend(player, cfg.Price, "Ocio", "Canción en " .. cfg.Name) then
		return false, "Cada canción cuesta $" .. cfg.Price .. "."
	end
	lastKaraoke[player] = os.clock()
	local _, _, mic = S.Inventory.best(player, "mic", "backpack", "Audio")
	local mood = cfg.Mood + (mic and cfg.MicMood or 0)
	S.Needs.change(player, -cfg.Energy, mood)
	local msg = "🎤 ¡Qué actuación! Ánimo +" .. mood .. "."
	local extra = {}
	if mic then
		-- Escena especial de música: con tu micrófono, la actuación se graba como escena del proyecto
		data.Counters.karaoke_mic = (data.Counters.karaoke_mic or 0) + 1
		S.Progress.addXp(player, 8)
		if S.Video.isRecording(player) then
			local ok, smsg, res = S.Video.recordScene(player, { shot = "talking" })
			if ok and res and res.scene then
				local sc = res.scene
				sc.Q = math.min(100, Util.round(sc.Q + cfg.SceneBonus, 1))
				sc.Special = "karaoke"
				sc.SpotName = "🎤 Actuación en " .. cfg.Name
				extra.scene = sc
				msg = msg .. " 🎶 Escena especial de música grabada con tu " .. mic.Name .. " (calidad " .. math.floor(sc.Q) .. ")."
			else
				msg = msg .. " (No se pudo grabar la escena: " .. tostring(smsg) .. ")"
			end
		else
			msg = msg .. " Con tu " .. mic.Name .. " suena de cine: graba un proyecto y será una escena especial de música."
		end
	else
		msg = msg .. " Lleva un micrófono en la mochila para convertirlo en una escena especial de música."
	end
	counted(player, data)
	return true, msg, extra
end

function Leisure.bowl(player, p)
	local data = S.Data.get(player)
	local cfg = StudioData.Bowling
	if not near(player, "bowling") then
		return false, notHere("bowling")
	end
	local aim = math.floor(tonumber(p.aim) or 0)
	local power = math.floor(tonumber(p.power) or 0)
	if aim ~= aim or power ~= power or aim < 1 or aim > 5 or power < 1 or power > 5 then
		return false, "Elige efecto y potencia (1-5)."
	end
	local l = state(data)
	local day = S.Time.day()
	if l.BowlDay ~= day then
		l.BowlDay, l.BowlGames = day, 0
	end
	if l.BowlGames >= cfg.DailyLimit then
		return false, "Ya has jugado " .. cfg.DailyLimit .. " partidas hoy. ¡Vuelve mañana!"
	end
	if not S.Economy.spend(player, cfg.Price, "Ocio", "Partida en " .. cfg.Name) then
		return false, "La partida cuesta $" .. cfg.Price .. "."
	end
	l.BowlGames = l.BowlGames + 1
	l.BowlTotal = l.BowlTotal + 1
	local lane = StudioData.lane(day)
	local skill = StudioData.bowlSkill(aim, power, lane, data.Fitness, l.BowlTotal)
	local score, frames, strikes = StudioData.bowlScore(skill)
	local prize = StudioData.bowlPrize(score)
	local best = score > l.BowlBest
	if best then
		l.BowlBest = score
	end
	if prize > 0 then
		S.Economy.add(player, prize, "Ocio", "Premio de la bolera (" .. score .. " puntos)")
	end
	S.Needs.change(player, -2, strikes >= 3 and 8 or 4)
	data.Counters.bowling = (data.Counters.bowling or 0) + 1
	counted(player, data)
	local msg = "🎳 " .. score .. " puntos (" .. strikes .. " plenos)" .. (best and " · ¡récord personal!" or "")
	msg = msg .. (prize > 0 and (" · premio $" .. prize) or " · sin premio esta vez")
	return true, msg, { score = score, frames = frames, prize = prize, left = cfg.DailyLimit - l.BowlGames }
end

function Leisure.Start()
	local Net = S.Net
	Net.on("Leisure.Workout", function(player)
		return Leisure.workout(player)
	end)
	Net.on("Leisure.Movie", function(player, p)
		return Leisure.watch(player, type(p) == "table" and p.movie or nil)
	end)
	Net.on("Leisure.Karaoke", function(player)
		return Leisure.sing(player)
	end)
	Net.on("Leisure.Bowl", function(player, p)
		return Leisure.bowl(player, type(p) == "table" and p or {})
	end)
	Players.PlayerRemoving:Connect(function(player)
		lastGym[player] = nil
		lastKaraoke[player] = nil
	end)
end

return Leisure
