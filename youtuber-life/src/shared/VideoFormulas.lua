--!nonstrict
-- VideoFormulas: TODAS las fórmulas de calidad, edición, miniaturas y resultados.
-- Funciones puras: el servidor las usa como autoridad; el cliente solo para previsualizar.
-- `rng` es una función que devuelve un número entre 0 y 1 (math.random en el servidor).

local Util = require(script.Parent.Util)
local VideoData = require(script.Parent.VideoData)

local F = {}

local clamp = Util.clamp

local function overlap(a, b)
	local n = 0
	for _, x in ipairs(a or {}) do
		for _, y in ipairs(b or {}) do
			if x == y then
				n = n + 1
			end
		end
	end
	return n
end
F.overlap = overlap

-- Iluminación ambiental (0-100)
function F.lighting(ctx)
	local light
	if ctx.indoor then
		light = 62 + (ctx.homeLight or 0)
	else
		local hour = ctx.hour or 12
		if hour >= 7 and hour < 17 then
			light = 82
		elseif (hour >= 5.5 and hour < 7) or (hour >= 17 and hour < 19) then
			light = 74 -- hora dorada: algo menos de luz, pero bonita
		else
			light = 28
		end
		local w = ctx.weather or "Clear"
		if w == "Cloudy" then
			light = light - 8
		elseif w == "Rain" then
			light = light - 18
		elseif w == "Fog" then
			light = light - 14
		elseif w == "Storm" then
			light = light - 26
		end
	end
	light = light + (ctx.portableLight or 0)
	local low = ctx.lowLight or 30
	if light < 60 then
		light = light + (60 - light) * (low / 100) * 0.8
	end
	return clamp(light, 5, 100)
end

function F.isGoldenHour(hour)
	return (hour >= 5.5 and hour < 7) or (hour >= 17 and hour < 19)
end

-- Calidad de una escena grabada.
function F.scene(ctx, rng)
	rng = rng or math.random
	local shot = ctx.shot
	local device = ctx.device
	local problems = {}

	local lighting = F.lighting({ indoor = ctx.indoor, hour = ctx.hour, weather = ctx.weather, homeLight = ctx.homeLight,
		portableLight = ctx.portableLight, lowLight = device.LowLight })

	local image = device.Video * 0.6 + lighting * 0.4
	local stab = (device.Stab or 20) + (ctx.gimbal or 0) + (ctx.mount or 0)
	if shot.Moving then
		image = image - math.max(0, 60 - stab) * 0.3
		if stab < 40 and rng() < 0.5 then
			image = image - 10
			problems[#problems + 1] = "Imagen temblorosa"
		end
	elseif ctx.tripod and ctx.tripod > 0 then
		image = image + 5 * math.min(1, ctx.tripod / 75)
	end
	if not ctx.indoor and (ctx.weather == "Rain" or ctx.weather == "Storm") and not device.Weather then
		if rng() < 0.4 then
			image = image - 12
			problems[#problems + 1] = "Gotas en la lente"
		end
	end
	if lighting < 40 and rng() < 0.6 then
		image = image - 8
		problems[#problems + 1] = "Imagen con ruido por poca luz"
	end

	local noise = ctx.spotNoise or 3
	local audio = (ctx.micAudio or device.Audio or 28) - noise * 2.5
	if ctx.indoor then
		audio = audio + 6
	end
	if not ctx.indoor and not ctx.micPortable and noise >= 5 and rng() < 0.5 then
		audio = audio - 12
		problems[#problems + 1] = "Viento en el micrófono"
	end

	local match = overlap(ctx.categoryTags, ctx.spotTags)
	local interest = shot.Interest + (ctx.spotInterest or 5)
	if match > 0 then
		interest = interest + 12 + math.min(2, match - 1) * 3
	else
		interest = interest - 6
	end
	if ctx.productQuality then
		interest = interest + ctx.productQuality / 10
	end
	if ctx.indoor then
		interest = interest + (ctx.decor or 0) / 3
	end
	if shot.Presenter then
		interest = interest + (ctx.presentation or 0)
	end
	if ctx.goldenHour and not ctx.indoor then
		interest = interest + 4
	end
	if (ctx.busy or 0) >= 6 and rng() < 0.3 then
		interest = interest - 5
		problems[#problems + 1] = "Gente cruzando el plano"
	end
	if ctx.batteryLow then
		problems[#problems + 1] = "Batería baja"
	end

	image = clamp(image, 1, 100)
	audio = clamp(audio, 1, 100)
	interest = clamp(interest, 0, 40)
	local quality = image * 0.55 + audio * 0.25 + math.min(100, interest * 2.5) * 0.2
	quality = clamp(quality, 1, 100)

	return {
		Quality = Util.round(quality, 1),
		Image = Util.round(image, 1),
		Audio = Util.round(audio, 1),
		Lighting = Util.round(lighting, 1),
		Interest = Util.round(interest, 1),
		Noise = noise,
		Problems = problems,
		Seconds = shot.Seconds,
	}
end

-- Calidad de una fotografía.
function F.photo(ctx, rng)
	rng = rng or math.random
	local mode = ctx.mode
	local lighting = F.lighting({ indoor = ctx.indoor, hour = ctx.hour, weather = ctx.weather, homeLight = ctx.homeLight,
		portableLight = ctx.portableLight, lowLight = ctx.device.LowLight })
	local q = ctx.device.Photo * 0.6 + lighting * 0.4
	local problems = {}
	if overlap(mode.Tags, ctx.spotTags) > 0 then
		q = q + 10
	end
	if mode.Night then
		if ctx.device.Night or (ctx.device.LowLight or 0) >= 70 then
			q = q + 8
		elseif lighting < 45 then
			q = q - 10
			problems[#problems + 1] = "Foto movida por la oscuridad"
		end
	end
	if ctx.goldenHour and not ctx.indoor then
		q = q + 5
	end
	if ctx.tripod and ctx.tripod > 0 then
		q = q + 3
	end
	if not ctx.indoor and (ctx.weather == "Rain" or ctx.weather == "Storm") and not ctx.device.Weather and rng() < 0.3 then
		q = q - 10
		problems[#problems + 1] = "Gotas en la lente"
	end
	if ctx.weather == "Fog" and not ctx.indoor then
		q = q + 2 -- ambiente misterioso
	end
	-- Composición elegida por el jugador (ángulo/encuadre del modo fotógrafo, 0-10)
	q = q + (ctx.composition or 5) - 5
	return { Quality = Util.round(clamp(q, 1, 100), 1), Lighting = Util.round(lighting, 1), Problems = problems }
end

-- Evaluación de la edición. Devuelve calidad de edición (0-100), calidad final y detalles.
function F.edit(p)
	local details = {}
	local entries = p.entries or {}
	if #entries == 0 then
		return { EditQuality = 0, Footage = 0, Final = 0, Seconds = 0, Details = { "La línea de tiempo está vacía" } }
	end
	local totalW, footage, seconds, trimSum = 0, 0, 0, 0
	local shotsUsed, nonCut, glitch = {}, 0, 0
	for i, e in ipairs(entries) do
		local trim = clamp(e.trim or 1, 0.3, 1)
		local dur = (e.seconds or 10) * trim
		seconds = seconds + dur
		trimSum = trimSum + trim
		footage = footage + (e.q or 30) * dur
		totalW = totalW + dur
		if e.shot then
			shotsUsed[e.shot] = true
		end
		if i > 1 then
			if e.transition and e.transition ~= "cut" then
				nonCut = nonCut + 1
			end
			if e.transition == "glitch" then
				glitch = glitch + 1
			end
		end
	end
	footage = footage / math.max(totalW, 1)

	local score = 40
	-- Ritmo: duración frente al objetivo
	local target = p.targetSeconds or 120
	local ratio = seconds / target
	local pacing = 100 - math.abs(math.log(math.max(ratio, 0.05)) / math.log(2)) * 35
	pacing = clamp(pacing, 0, 100)
	score = score + (pacing - 50) * 0.2
	details[#details + 1] = "Ritmo " .. math.floor(pacing) .. "/100 (" .. math.floor(seconds) .. " s de " .. target .. " s)"

	local avgTrim = trimSum / #entries
	if avgTrim >= 0.55 and avgTrim <= 0.88 then
		score = score + 6
		details[#details + 1] = "Cortes ajustados (+6)"
	end

	-- Estructura
	local first = entries[1]
	if (first and first.shot == "talking") or p.intro == "hook" then
		score = score + 8
		details[#details + 1] = "Buen gancho inicial (+8)"
	elseif p.intro and p.intro ~= "none" then
		score = score + 3
	end
	if p.outro == "subscribe" or p.outro == "endscreen" then
		score = score + 5
		details[#details + 1] = "Cierre con llamada a la acción (+5)"
	elseif p.outro == "bloopers" then
		score = score + 3
	end
	local variety = Util.count(shotsUsed)
	score = score + math.min(5, variety) * 2
	details[#details + 1] = "Variedad de tomas: " .. variety

	-- Transiciones
	if #entries > 1 then
		local share = nonCut / (#entries - 1)
		if share > 0 and share <= 0.4 then
			score = score + 4
		elseif share > 0.7 then
			score = score - 5
			details[#details + 1] = "Demasiadas transiciones (-5)"
		end
	end
	if glitch > 2 then
		score = score - 4
		details[#details + 1] = "Abuso del efecto glitch (-4)"
	end

	-- Música y volumen
	local music = VideoData.MusicById[p.music or "none"]
	local voice = p.voiceVol or 1
	local mvol = p.musicVol or 0.3
	if music and music.Id ~= "none" then
		if Util.indexOf(music.Fits, p.category) then
			score = score + 8
			details[#details + 1] = "Música adecuada (+8)"
		else
			score = score + 1
		end
		if mvol > voice then
			score = score - 10
			details[#details + 1] = "La música tapa la voz (-10)"
		elseif mvol >= 0.12 and mvol <= 0.45 then
			score = score + 4
		end
	elseif p.category ~= "interview" and p.category ~= "documentary" then
		score = score - 3
	end

	-- Efectos
	local fitting, bad = 0, 0
	for _, fx in ipairs(p.effects or {}) do
		for _, def in ipairs(VideoData.Effects) do
			if def.Id == fx then
				if Util.indexOf(def.Fits, p.category) then
					fitting = fitting + 1
				else
					bad = bad + 1
				end
			end
		end
	end
	score = score + math.min(3, fitting) * 3 - bad * 2
	if #(p.effects or {}) > 4 then
		score = score - 5
		details[#details + 1] = "Demasiados efectos (-5)"
	end

	-- Color (la precisión del monitor y la gráfica profesional ayudan)
	local c = p.color or {}
	local b, ct, s = math.abs(c.b or 0), math.abs(c.c or 0), math.abs(c.s or 0)
	local sum = b + ct + s
	if b > 60 or ct > 60 or s > 60 then
		score = score - 6
		details[#details + 1] = "Color exagerado (-6)"
	elseif sum >= 5 and sum <= 45 then
		local acc = clamp(((p.colorAcc or 40) + (p.proColor or 0)) / 100, 0.2, 1.1)
		local bonus = 6 * acc
		score = score + bonus
		details[#details + 1] = "Etalonaje (+" .. Util.round(bonus, 1) .. ")"
	end

	if p.titles then
		score = score + 3
	end
	if p.subtitles then
		score = score + 5
		details[#details + 1] = "Subtítulos (+5)"
	end
	score = score + clamp((p.audioMix or 0) / 20, 0, 5)

	local editQ = clamp(score, 0, 100)
	local final = clamp(footage * 0.55 + editQ * 0.45, 1, 100)
	return {
		EditQuality = Util.round(editQ, 1),
		Footage = Util.round(footage, 1),
		Final = Util.round(final, 1),
		Seconds = math.floor(seconds),
		Details = details,
	}
end

-- Tiempo de exportación simulado en segundos reales.
function F.exportSeconds(p, pcStats, editSpeedPct, comfort)
	local complexity = (p.seconds or 60) / 60 + #(p.effects or {}) * 0.6 + (p.transitions or 0) * 0.2 + (p.photos or 0) * 0.1
	if p.colorGraded then
		complexity = complexity + 1
	end
	local speed = (pcStats and pcStats.RenderMult or 1)
	local reduction = clamp((editSpeedPct or 0) + (comfort or 0) / 4, 0, 30) / 100
	local secs = (8 + complexity * 7) / speed * (1 - reduction)
	return math.floor(clamp(secs, 4, 180) + 0.5)
end

-- Puntuación de miniatura (0-100) a partir del diseño.
function F.thumbnail(design, ctx)
	local details = {}
	ctx = ctx or {}
	local text = design.text or ""
	local words = 0
	for _ in text:gmatch("%S+") do
		words = words + 1
	end
	local read = 0
	if words >= 1 and words <= 5 then
		read = read + 35
	elseif words == 0 then
		read = read + 10
	else
		read = read + math.max(0, 35 - (words - 5) * 8)
		details[#details + 1] = "Demasiado texto"
	end
	if #text > 0 and #text <= 28 then
		read = read + 10
	end
	local font = VideoData.FontById[design.font or ""]
	read = read + (font and font.Readability or 5) * 2.5
	local tc = VideoData.Palette[design.textColor or 1] or { 255, 255, 255 }
	local bc = VideoData.Palette[design.bg or 2] or { 20, 20, 24 }
	local contrast = Util.colorDistance(tc, bc) / 441 * 30
	if design.outline then
		contrast = math.max(contrast, 22)
	end
	read = read + contrast
	if contrast < 10 then
		details[#details + 1] = "Poco contraste entre texto y fondo"
	end
	read = clamp(read, 0, 100)

	local tpl = VideoData.ThumbTemplateById[design.template or "center"]
	local comp = (tpl and tpl.Composition or 5) * 6
	local st = #(design.stickers or {})
	if st == 1 or st == 2 then
		comp = comp + 15
	elseif st == 3 then
		comp = comp + 8
	elseif st > 3 then
		comp = comp - 10
		details[#details + 1] = "Demasiados elementos"
	end
	if ctx.photoQuality then
		comp = comp + 20
	else
		details[#details + 1] = "Sin fotografía"
	end
	if design.frame and design.frame ~= "none" then
		comp = comp + 4
	end
	comp = clamp(comp, 0, 100)

	local rel = 20
	if ctx.photoQuality then
		rel = rel + ctx.photoQuality * 0.35
		if ctx.photoMatches then
			rel = rel + 30
		else
			details[#details + 1] = "La foto no tiene relación con el tema"
		end
	end
	if ctx.keywordInText then
		rel = rel + 10
	end
	rel = clamp(rel, 0, 100)

	local score = read * 0.4 + comp * 0.3 + rel * 0.3
	return {
		Score = Util.round(clamp(score, 0, 100), 1),
		Readability = Util.round(read, 1),
		Composition = Util.round(comp, 1),
		Relevance = Util.round(rel, 1),
		Details = details,
	}
end

function F.categoryKeyword(categoryId)
	local cat = VideoData.CategoryById[categoryId]
	if not cat then
		return nil
	end
	local w = cat.Name:lower():match("^(%S+)")
	return w
end

function F.title(title, categoryId)
	title = title or ""
	local len = #title
	local s
	if len >= 20 and len <= 60 then
		s = 75
	elseif len < 20 then
		s = 35 + len * 2
	else
		s = math.max(30, 75 - (len - 60) * 2)
	end
	if title:find("%d") then
		s = s + 5
	end
	local kw = F.categoryKeyword(categoryId)
	if kw and title:lower():find(kw, 1, true) then
		s = s + 10
	end
	local upper, letters = 0, 0
	for ch in title:gmatch("%a") do
		letters = letters + 1
		if ch:upper() == ch then
			upper = upper + 1
		end
	end
	if letters > 6 and upper / letters > 0.6 then
		s = s - 15
	end
	if title:find("!!!", 1, true) or title:find("???", 1, true) then
		s = s - 10
	end
	return clamp(s, 0, 100)
end

function F.ctr(thumbScore, titleScore)
	return 0.025 + (thumbScore or 30) / 100 * 0.05 + (titleScore or 40) / 100 * 0.02
end

-- Visitas esperadas totales de un vídeo (con límites razonables).
function F.expectedViews(p)
	local subs = p.subs or 0
	local impressions = 3000 + subs * 6 + (p.reputation or 10) * 40
	local q = clamp(p.quality or 30, 1, 100) / 100
	local qualityMult = 0.3 + (q ^ 1.5) * 1.7
	local interest = (p.interest or 50) / 50
	local v = impressions * (p.ctr or 0.05) * qualityMult * interest * (p.trend or 1) * (p.luck or 1) * (p.competition or 1)
	-- Fatiga: publicar muchos vídeos de la misma categoría seguidos rinde algo menos
	v = v * (p.fatigue or 1)
	if p.viral then
		v = v * p.viral
	end
	local cap = 50000 + subs * 40
	return math.floor(clamp(v, 5, cap))
end

function F.subConversion(quality)
	local q = clamp(quality or 30, 1, 100) / 100
	return 0.02 + q * q * 0.08
end

function F.likeRate(quality)
	return 0.02 + clamp(quality or 30, 1, 100) / 100 * 0.06
end

-- Ingresos por visita ($ virtuales). Antes de ser socio cobra el Fondo de creadores.
function F.revenuePerView(categoryId, partner)
	local cat = VideoData.CategoryById[categoryId]
	local rpm = (cat and cat.Rpm or 2) * 100 -- por cada 1000 visitas
	if not partner then
		rpm = rpm * 0.3
	end
	return rpm / 1000
end

-- Fracción de visitas esperadas alcanzada tras `minutes` minutos reales.
function F.viewCurve(minutes, curveMinutes)
	return 1 - math.exp(-minutes / (curveMinutes or 8))
end

return F
