--!nonstrict
-- ChannelService: crecimiento progresivo de cada vídeo publicado (visitas, me gusta, comentarios,
-- suscriptores, ingresos), tendencias diarias, competencia, programa de socios y ajustes del canal.
-- Las cifras siguen curvas con límite (VideoFormulas.expectedViews), nunca números aleatorios absurdos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local VideoData = require(Shared.VideoData)
local F = require(Shared.VideoFormulas)
local Util = require(Shared.Util)

local Channel = {}
local S
local trends = { Hot = {}, Cold = "", Competition = 0.95, Day = 0 }
local commenters = { "AnaVlogs", "PixelPedro", "LuciaTech", "Mateo_Viajes", "SofiCocina", "Leo2010", "CreadorX", "MarioFoto", "NoraGamer", "TomásReseñas", "Valen_Moda", "Diego_Motor" }

function Channel.Init(services)
	S = services
end

function Channel.onNewDay(day)
	trends.Day = day
	local ids = {}
	for _, c in ipairs(VideoData.Categories) do
		ids[#ids + 1] = c.Id
	end
	local hot = {}
	local salt = 0
	while #hot < 3 and salt < 100 do
		local idx = (Util.hashString("hot" .. day .. ":" .. salt) % #ids) + 1
		if not Util.indexOf(hot, ids[idx]) then
			hot[#hot + 1] = ids[idx]
		end
		salt = salt + 1
	end
	trends.Hot = hot
	local cold = ids[(Util.hashString("cold" .. day) % #ids) + 1]
	if Util.indexOf(hot, cold) then
		cold = ""
	end
	trends.Cold = cold
	trends.Competition = Util.seededRandom("comp" .. day, 0.85, 1.0)
	workspace:SetAttribute("TrendHot", table.concat(hot, ","))
	for _, player in ipairs(Players:GetPlayers()) do
		S.Data.markDirty(player)
	end
end

function Channel.trends()
	return trends
end

function Channel.trendFor(categoryId)
	if Util.indexOf(trends.Hot, categoryId) then
		return 1.4
	elseif trends.Cold == categoryId then
		return 0.85
	end
	return 1
end

function Channel.competition()
	return trends.Competition
end

local function pickComment(video, n)
	local pool = video.Q >= 70 and VideoData.Comments.high or (video.Q >= 40 and VideoData.Comments.mid or VideoData.Comments.low)
	local h = Util.hashString(video.Id .. ":" .. n)
	return { U = commenters[(h % #commenters) + 1], Txt = pool[(math.floor(h / 7) % #pool) + 1] }
end

-- Avanza las estadísticas de todos los vídeos del jugador hasta "ahora" (máximo `capSeconds` de retraso).
function Channel.tickPlayer(player, capSeconds)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local now = os.time()
	local ch = data.Channel
	local partner = ch.Monetized
	local totalRevenue, totalNew = 0, 0
	for _, v in ipairs(data.Videos) do
		local age = now - v.At
		if capSeconds and data.LastSeen > 0 and v.At < data.LastSeen then
			-- recuperación tras estar desconectado: se limita el tiempo que cuenta
			local offline = now - data.LastSeen
			if offline > capSeconds then
				age = age - (offline - capSeconds)
			end
		end
		local minutes = math.max(0, age / 60)
		local target = v.Expected * F.viewCurve(minutes, Config.ViewCurveMinutes)
		-- cola larga: vídeos de calidad siguen sumando un poco durante varios días
		local days = minutes / (Config.DayLengthSeconds / 60)
		if v.Q >= 50 then
			target = target + v.Expected * 0.05 * math.min(days, 7) * (v.Q / 100)
		end
		target = math.floor(target)
		local new = target - v.Views
		if new > 0 then
			v.Views = target
			totalNew = totalNew + new
			local rate = F.likeRate(v.Q)
			v.Likes = math.floor(v.Views * rate)
			local comments = math.floor(v.Views * 0.004)
			while v.Comments < comments do
				v.Comments = v.Comments + 1
				if #v.CommentList < 6 then
					table.insert(v.CommentList, pickComment(v, v.Comments))
				end
			end
			local subs = new * F.subConversion(v.Q) * (v.SubMult or 1)
			ch.SubFrac = ch.SubFrac + subs
			local whole = math.floor(ch.SubFrac)
			ch.SubFrac = ch.SubFrac - whole
			ch.Subs = ch.Subs + whole
			v.SubsGained = (v.SubsGained or 0) + whole
			local rev = new * F.revenuePerView(v.Cat, partner) * (v.RpmMult or 1)
			if v.Unlisted then
				rev = 0
			end
			v.Revenue = Util.round((v.Revenue or 0) + rev, 2)
			totalRevenue = totalRevenue + rev
			ch.TotalViews = ch.TotalViews + new
		end
		-- historial (un punto cada 2 minutos durante las primeras horas)
		local slot = math.floor(minutes / 2)
		if slot < Config.HistoryPoints and (#v.Hist <= slot) then
			while #v.Hist <= slot do
				table.insert(v.Hist, v.Views)
			end
		end
	end
	ch.PendingRev = (ch.PendingRev or 0) + totalRevenue
	if ch.PendingRev >= 1 then
		local pay = math.floor(ch.PendingRev)
		ch.PendingRev = ch.PendingRev - pay
		ch.TotalRevenue = ch.TotalRevenue + pay
		S.Economy.add(player, pay, "Ingresos de vídeos", partner and "Publicidad del canal" or "Fondo para creadores", { taxable = true, silent = pay < 5 })
	end
	if not ch.Monetized and ch.Subs >= Config.PartnerSubs and (data.Counters.published or 0) >= Config.PartnerVideos then
		ch.Monetized = true
		S.Net.notify(player, "🎉 ¡Ya eres socio del programa de creadores! Tus vídeos ganan más por cada visita.", "success")
	end
	if totalNew > 0 then
		S.Data.markDirty(player)
		S.Quest.check(player)
	end
end

function Channel.Start()
	Channel.onNewDay(S.Time.day())
	local Net = S.Net

	Net.on("Channel.Update", function(player, p)
		local data = S.Data.get(player)
		local ch = data.Channel
		if p.name ~= nil then
			local name = Util.cleanText(p.name, 30)
			if not name or #name < 3 then
				return false, "El nombre del canal necesita al menos 3 caracteres."
			end
			local f = S.Text.filter(player, name)
			if not f then
				return false, "Ese nombre no está permitido."
			end
			ch.Name = f
		end
		if p.description ~= nil then
			local d = Util.cleanText(p.description, 200) or ""
			local f = S.Text.filter(player, d)
			if not f then
				return false, "No se pudo comprobar la descripción."
			end
			ch.Description = f
		end
		local banners = #VideoData.Banners
		local avatars = #VideoData.Avatars
		if tonumber(p.banner) then
			ch.Banner = Util.clamp(math.floor(tonumber(p.banner)), 1, banners)
		end
		if tonumber(p.avatar) then
			ch.Avatar = Util.clamp(math.floor(tonumber(p.avatar)), 1, avatars)
		end
		S.Avatar.refreshOverhead(player)
		return true, "Canal actualizado."
	end)

	Net.on("Channel.OpenAnalytics", function(player)
		S.Quest.tutorialEvent(player, "open_analytics")
		return true
	end)

	task.spawn(function()
		while true do
			task.wait(Config.StatsTickSeconds)
			for _, player in ipairs(Players:GetPlayers()) do
				local ok, err = pcall(Channel.tickPlayer, player)
				if not ok then
					S.Net.logError("channel", err)
				end
			end
		end
	end)
end

return Channel
