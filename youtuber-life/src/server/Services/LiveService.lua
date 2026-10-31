--!nonstrict
-- LiveService: directos simulados y publicaciones en redes sociales ficticias.
--  * Directo: desde un computador (casa, propiedad o portátil) con cámara o cámara web.
--    Los espectadores dependen de tus suscriptores, del equipo, de la decoración y de cómo respondas
--    a las preguntas del chat. Hay donaciones, nuevos suscriptores e ingresos al terminar.
--  * Publicación social: una foto del álbum con texto; consigue "me gusta" y algunos seguidores.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Util = require(Shared.Util)

local Live = {}
local S
local sessions = {}

Live.Duration = 75
Live.Cooldown = 180

Live.Topics = {
	{ Id = "gaming", Name = "Partida en directo", Cat = "gaming" },
	{ Id = "qa", Name = "Preguntas y respuestas", Cat = "vlog" },
	{ Id = "tech", Name = "Charla de tecnología", Cat = "tech" },
	{ Id = "cooking", Name = "Cocinando en directo", Cat = "cooking" },
	{ Id = "edit", Name = "Editando en directo", Cat = "tutorial" },
}

-- Preguntas del chat: la respuesta Best es la más adecuada para la comunidad
Live.Questions = {
	{ Q = "¿Qué cámara usas?", A = { "Te cuento mi equipo y por qué lo elegí", "Secreto", "La más cara, obvio" }, Best = 1 },
	{ Q = "¿Cada cuánto subes vídeos?", A = { "Cuando me apetece", "Intento publicar con constancia cada semana", "No sé" }, Best = 2 },
	{ Q = "¡Saludos desde la playa!", A = { "¡Hola! Gracias por pasarte 😊", "…", "Silencio, que me concentro" }, Best = 1 },
	{ Q = "¿Algún consejo para empezar?", A = { "Compra equipo caro", "Empieza con el teléfono y mejora poco a poco", "Copia a otros" }, Best = 2 },
	{ Q = "¿Harás un vídeo en la montaña?", A = { "¡Buena idea! Lo apunto", "Nunca", "Pregunta otra cosa" }, Best = 1 },
	{ Q = "Tu audio suena un poco bajo", A = { "Gracias por avisar, lo subo", "Será tu altavoz", "Ignorar" }, Best = 1 },
	{ Q = "¿Cuál es tu vídeo favorito?", A = { "Todos son malos", "El último, me costó mucho editarlo", "No me acuerdo" }, Best = 2 },
	{ Q = "¿Qué PC recomiendas para editar?", A = { "Depende del presupuesto; te explico", "El que sea", "No respondo eso" }, Best = 1 },
	{ Q = "¡Primera vez en tu directo!", A = { "¡Bienvenido a la comunidad!", "Vale", "¿Y?" }, Best = 1 },
	{ Q = "¿Cómo haces las miniaturas?", A = { "Texto corto, buen contraste y una foto clara", "Pongo mucho texto", "Al azar" }, Best = 1 },
}

function Live.Init(services)
	S = services
end

local function setupQuality(player)
	local stats = S.Computer.sessionStats(player) or {}
	local data = S.Data.get(player)
	local cam = S.Inventory.bestCatAtHome(player, "peripheral", "Cámara web", "Video")
	local video = cam and cam.Stats.Video or 0
	local _, _, camera = S.Inventory.best(player, "camera", "any", "Video")
	if camera then
		video = math.max(video, camera.Stats.Video * 0.9)
	end
	local _, _, mic = S.Inventory.best(player, "mic", "any", "Audio")
	local audio = mic and mic.Stats.Audio or 25
	local spot = S.Travel.currentSpot(player)
	local decor = spot and spot.Decor or 5
	local q = video * 0.4 + audio * 0.35 + math.min(45, decor) * 0.5 + math.min(20, (stats.Score or 20) / 5)
	return Util.clamp(q, 5, 100), video
end

local function pushState(player, s, kind, extra)
	local payload = { kind = kind, viewers = s.Viewers, peak = s.Peak, donations = s.Donations, subs = s.Subs, engagement = math.floor(s.Engagement * 100), left = math.max(0, math.floor(s.Ends - os.time())), topic = s.Topic.Name }
	for k, v in pairs(extra or {}) do
		payload[k] = v
	end
	S.Net.push(player, "live", payload)
end

local function finish(player)
	local s = sessions[player]
	if not s then
		return
	end
	sessions[player] = nil
	local data = S.Data.get(player)
	if not data then
		return
	end
	local avg = s.Ticks > 0 and math.floor(s.ViewerSum / s.Ticks) or 0
	local ads = math.floor(avg * 0.6)
	local total = ads + s.Donations
	data.Channel.Subs = data.Channel.Subs + s.Subs
	data.Counters.lives = (data.Counters.lives or 0) + 1
	data.Lives = data.Lives or {}
	Util.pushCapped(data.Lives, { Topic = s.Topic.Name, Peak = s.Peak, Avg = avg, Donations = s.Donations, Ads = ads, Subs = s.Subs, Engagement = math.floor(s.Engagement * 100), T = os.time() }, 20)
	if total > 0 then
		S.Economy.add(player, total, "Directos", "Directo: " .. s.Topic.Name, { taxable = true })
	end
	S.Progress.addXp(player, 30 + math.floor(s.Engagement * 30))
	S.Quest.check(player)
	pushState(player, s, "end", { avg = avg, ads = ads, total = total })
	S.Data.markDirty(player)
end

function Live.Start()
	local Net = S.Net

	Net.on("Live.Start", function(player, p)
		local data = S.Data.get(player)
		if sessions[player] then
			return false, "Ya estás en directo."
		end
		if not S.Computer.hasSession(player) then
			return false, "Haz el directo desde un computador o un portátil."
		end
		if os.time() - (data.LastLive or 0) < Live.Cooldown then
			return false, "Descansa un poco: podrás volver a emitir en " .. (Live.Cooldown - (os.time() - (data.LastLive or 0))) .. " s."
		end
		local topic = nil
		for _, t in ipairs(Live.Topics) do
			if t.Id == p.topic then
				topic = t
			end
		end
		if not topic then
			return false, "Elige un tema."
		end
		local q, video = setupQuality(player)
		if video <= 0 then
			return false, "Necesitas una cámara web en casa o una cámara para emitir."
		end
		data.LastLive = os.time()
		local s = { Topic = topic, Quality = q, Started = os.time(), Ends = os.time() + Live.Duration, Viewers = 1, Peak = 1, Donations = 0, Subs = 0, SubFrac = 0, Engagement = 0.5, Ticks = 0, ViewerSum = 0, Question = nil, NextQ = os.time() + 8 }
		sessions[player] = s
		pushState(player, s, "start", { quality = math.floor(q) })
		return true, "🔴 ¡Estás en directo! Responde al chat para mantener a la audiencia."
	end)

	Net.on("Live.Answer", function(player, p)
		local s = sessions[player]
		if not s or not s.Question then
			return false, "No hay ninguna pregunta pendiente."
		end
		local q = s.Question
		s.Question = nil
		local choice = tonumber(p.choice)
		if choice == q.Best then
			s.Engagement = math.min(1, s.Engagement + 0.12)
			return true, "💬 ¡Buena respuesta! El chat se anima."
		end
		s.Engagement = math.max(0, s.Engagement - 0.06)
		return true, "💬 Al chat no le convenció mucho esa respuesta."
	end)

	Net.on("Live.Stop", function(player)
		if not sessions[player] then
			return false, "No estás en directo."
		end
		finish(player)
		return true, "Directo terminado."
	end)

	Net.on("Social.Post", function(player, p)
		local data = S.Data.get(player)
		if os.time() - (data.LastPost or 0) < 45 then
			return false, "Espera un poco antes de publicar otra vez."
		end
		local photo
		for _, ph in ipairs(data.Photos) do
			if ph.Id == p.photoId then
				photo = ph
			end
		end
		if not photo then
			return false, "Elige una foto del álbum."
		end
		local caption = Util.cleanText(p.caption or "", 80) or ""
		caption = S.Text.filter(player, caption)
		if not caption then
			return false, "No se pudo comprobar el texto."
		end
		data.LastPost = os.time()
		data.Counters.post_id = (data.Counters.post_id or 0) + 1
		local luck = Util.seededRandom("post" .. data.Counters.post_id .. player.UserId, 0.8, 1.2)
		local likes = math.floor((10 + data.Channel.Subs * 0.04 + math.sqrt(data.Channel.Subs) * 2) * (photo.Q / 60) * luck)
		local subs = math.floor(likes * 0.02 * (photo.Q / 70))
		data.Channel.Subs = data.Channel.Subs + subs
		data.Posts = data.Posts or {}
		Util.pushCapped(data.Posts, { Id = "s" .. data.Counters.post_id, PhotoId = photo.Id, Caption = caption, Likes = likes, Subs = subs, T = os.time(), Spot = photo.SpotName }, 30)
		data.Counters.posts = (data.Counters.posts or 0) + 1
		S.Progress.addXp(player, 5)
		S.Quest.check(player)
		return true, "📲 Publicado: ❤️ " .. likes .. " me gusta y +" .. subs .. " suscriptores."
	end)

	Players.PlayerRemoving:Connect(function(player)
		sessions[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(3)
			for player, s in pairs(sessions) do
				local ok, err = pcall(function()
					local data = S.Data.get(player)
					if not data or not player.Parent then
						sessions[player] = nil
						return
					end
					if not S.Computer.hasSession(player) then
						finish(player)
						return
					end
					local subs = data.Channel.Subs
					local trend = S.Channel.trendFor(s.Topic.Cat)
					local target = (4 + subs * 0.03 + math.sqrt(subs) * 2) * (0.5 + s.Quality / 100) * (0.6 + s.Engagement * 0.8) * trend
					s.Viewers = math.max(0, math.floor(s.Viewers + (target - s.Viewers) * 0.35 + (math.random() - 0.5) * target * 0.1))
					s.Peak = math.max(s.Peak, s.Viewers)
					s.Ticks = s.Ticks + 1
					s.ViewerSum = s.ViewerSum + s.Viewers
					s.SubFrac = s.SubFrac + s.Viewers * 0.004 * (0.5 + s.Engagement)
					local whole = math.floor(s.SubFrac)
					s.SubFrac = s.SubFrac - whole
					s.Subs = s.Subs + whole
					local extra = {}
					if math.random() < math.min(0.6, s.Viewers * 0.01) * (0.5 + s.Engagement) then
						local d = math.floor((1 + math.random() * 9) * (1 + subs / 5000))
						s.Donations = s.Donations + d
						extra.donation = d
					end
					if s.Question and os.time() > s.QuestionUntil then
						s.Question = nil
						s.Engagement = math.max(0, s.Engagement - 0.05)
					end
					if not s.Question and os.time() >= s.NextQ then
						local q = Live.Questions[math.random(1, #Live.Questions)]
						s.Question = q
						s.QuestionUntil = os.time() + 12
						s.NextQ = os.time() + 14
						extra.question = q.Q
						extra.answers = q.A
					end
					if os.time() >= s.Ends then
						finish(player)
					else
						pushState(player, s, "tick", extra)
					end
				end)
				if not ok then
					sessions[player] = nil
					S.Net.logError("live", err)
				end
			end
		end
	end)
end

return Live
