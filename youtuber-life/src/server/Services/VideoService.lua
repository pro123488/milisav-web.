--!nonstrict
-- VideoService: ciclo completo de creación de vídeos.
--   IDEA -> PLAN -> MOCHILA -> VIAJE -> GRABACIÓN (escenas) / FOTOS -> IMPORTAR -> EDICIÓN
--   -> EXPORTACIÓN -> MINIATURA -> PUBLICACIÓN -> RESULTADOS (ChannelService)
-- Todo se calcula en el servidor con VideoFormulas y el equipo REAL que lleva el jugador.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Catalog = require(Shared.ItemCatalog)
local VideoData = require(Shared.VideoData)
local F = require(Shared.VideoFormulas)
local Util = require(Shared.Util)

local Video = {}
local S
local recording = {} -- [player] = { Pid, UseCamera, Last }
local collabRec = {} -- [player] = { UseCamera, Last } al grabar en el proyecto de otro (colaboración)
local lastPhoto = {}

Video.GbScale = 10

function Video.Init(services)
	S = services
end

local function projectSlots(player)
	return Config.BaseProjectSlots + S.Monetization.perk(player, "ProjectSlots")
end

local function getProject(player, pid)
	local data = S.Data.get(player)
	return type(pid) == "string" and data.Projects[pid] or nil
end

local function newEdit()
	return { Timeline = {}, Titles = false, TitleText = "", Subtitles = false, Music = "none", MusicVol = 0.3, VoiceVol = 1,
		Effects = {}, Color = { b = 0, c = 0, s = 0 }, Intro = "none", Outro = "none" }
end

---------------------------------------------------------------------------
-- Equipo usado para grabar
---------------------------------------------------------------------------
-- Devuelve una descripción del equipo disponible ahora mismo (según dónde esté el jugador)
function Video.gear(player, preferPhone)
	local atHome = S.Home.isAtHome(player)
	local gear = {}
	local camUid, camRec, camDef = S.Inventory.best(player, "camera", "backpack", "Video")
	if not camUid and atHome then
		camUid, camRec, camDef = S.Inventory.best(player, "camera", "home", "Video")
	end
	local phoneRec, phoneDef, phoneUid = S.Inventory.phone(player)
	if camUid and not preferPhone then
		gear.DeviceUid, gear.DeviceRec, gear.Device, gear.IsPhone = camUid, camRec, camDef, false
	elseif phoneRec then
		gear.DeviceUid, gear.DeviceRec, gear.Device, gear.IsPhone = phoneUid, phoneRec, phoneDef, true
	end
	local function pick(slot, stat)
		local uid, rec, def = S.Inventory.best(player, slot, "backpack", stat)
		if not uid and atHome then
			uid, rec, def = S.Inventory.best(player, slot, "home", stat)
		end
		return def, rec, uid
	end
	gear.Mic = pick("mic", "Audio")
	if gear.Mic and not gear.Mic.Portable and not atHome then
		gear.Mic = nil
	end
	gear.Tripod = pick("tripod", "Stability")
	gear.Gimbal = pick("gimbal", "Stab")
	gear.Mount = gear.IsPhone and pick("mount", "Stab") or nil
	gear.Light = pick("light", "Light")
	gear.Drone = pick("drone")
	if atHome then
		gear.HomeLight = S.Inventory.best(player, "homelight", "home", "Light") and select(3, S.Inventory.best(player, "homelight", "home", "Light"))
		gear.Decor = select(3, S.Inventory.best(player, "homeextra", "home", "Decor"))
		local tp = nil
		for _, rec in pairs(S.Data.get(player).Inventory) do
			if rec.Id == "teleprompter" and rec.Loc == "home" then
				tp = Catalog.get("teleprompter")
			end
		end
		gear.Teleprompter = tp
	end
	gear.AtHome = atHome
	return gear
end

local function drainBattery(player, gear)
	local rec, def = gear.DeviceRec, gear.Device
	local drain = 100 / math.max(1, def.Stats.Battery or 10)
	if rec.Charge >= drain - 0.01 then
		rec.Charge = math.max(0, rec.Charge - drain)
		return true, rec.Charge < drain
	end
	if not gear.IsPhone then
		-- usar una batería de repuesto de la mochila
		local data = S.Data.get(player)
		for _, brec in pairs(data.Inventory) do
			local bdef = Catalog.get(brec.Id)
			if bdef.Slot == "battery" and brec.Loc == "backpack" and brec.Charge > 1 then
				brec.Charge = math.max(0, brec.Charge - 100 / bdef.Stats.Charges)
				rec.Charge = 100 - drain
				S.Net.notify(player, "🔋 Batería de repuesto colocada.", "info")
				return true, false
			end
		end
	end
	return false
end

---------------------------------------------------------------------------
-- Escena
---------------------------------------------------------------------------
local function featuredFrom(player, p, spot, gear)
	-- Producto propio (en la mochila o en casa si grabas en casa)
	local data = S.Data.get(player)
	if type(p.featuredUid) == "string" and data.Inventory[p.featuredUid] then
		local rec = data.Inventory[p.featuredUid]
		if rec.Loc == "backpack" or (gear.AtHome and rec.Loc == "home") then
			local def = Catalog.get(rec.Id)
			return def, true
		end
		return nil, nil, "Ese producto no está contigo: llévalo en la mochila."
	end
	-- Producto de exposición en la tienda donde estás (prueba en tienda, sin poseerlo)
	if type(p.featuredStoreItem) == "string" then
		local def = Catalog.get(p.featuredStoreItem)
		local storeId = S.Shop.storeNear(player)
		if def and storeId and Util.indexOf(def.Stores, storeId) then
			return def, false
		end
		return nil, nil, "Solo puedes probar productos de exposición dentro de la tienda que los vende."
	end
	return nil
end

function Video.recordScene(player, p)
	local data = S.Data.get(player)
	local rec = recording[player]
	local proj, owner
	local ownerId = tonumber(p.owner)
	if ownerId and ownerId ~= player.UserId then
		-- Colaboración: grabar en el proyecto de otro jugador (con permiso y cerca de él)
		if not S.Collab then
			return false, "Las colaboraciones no están disponibles."
		end
		local ok, err
		ok, err, proj, owner = S.Collab.canRecord(player, ownerId, p.pid)
		if not ok then
			return false, err
		end
		collabRec[player] = collabRec[player] or { Last = 0 }
		rec = collabRec[player]
		rec.UseCamera = p.usePhone ~= true
	else
		if not rec then
			return false, "No estás grabando. Pulsa GRABAR primero."
		end
		proj = data.Projects[rec.Pid]
		if not proj then
			recording[player] = nil
			return false, "El proyecto ya no existe."
		end
	end
	if #proj.Scenes >= Config.MaxScenesPerProject then
		return false, "Este proyecto ya tiene el máximo de escenas (" .. Config.MaxScenesPerProject .. ")."
	end
	if os.clock() - (rec.Last or 0) < Config.SceneCooldown then
		return false, "Espera un momento entre tomas."
	end
	local shot = VideoData.ShotById[p.shot or ""]
	if not shot then
		return false, "Tipo de toma no válido."
	end
	local spot = S.Travel.currentSpot(player)
	if not spot then
		return false, "Aquí no hay nada interesante que grabar. Busca un lugar 🎥, una tienda o tu casa."
	end
	local gear = Video.gear(player, not rec.UseCamera)
	if not gear.Device then
		return false, "No tienes con qué grabar."
	end
	if shot.NeedsTripod and not gear.Tripod then
		return false, "El time-lapse necesita un trípode en la mochila."
	end
	if shot.NeedsDrone and (not gear.Drone or spot.Indoor) then
		return false, "La toma aérea necesita un dron en la mochila y estar al aire libre."
	end
	if shot.NeedsPeople and (spot.Busy or 0) < 4 and not Util.indexOf(spot.Tags, "event") then
		return false, "No hay nadie para entrevistar aquí. Prueba en un lugar concurrido."
	end
	local product, owned, perr = featuredFrom(player, p, spot, gear)
	if perr then
		return false, perr
	end
	if shot.NeedsProduct and not product then
		return false, "El plano de producto necesita un producto: elige uno de tu mochila o uno expuesto en la tienda."
	end
	local okBattery, low = drainBattery(player, gear)
	if not okBattery then
		return false, "Batería agotada. Vuelve a casa a cargar, lleva baterías de repuesto o cambia al teléfono."
	end

	local cat = VideoData.CategoryById[proj.Category]
	local hour = S.Time.hour()
	local stats = {}
	for k, v in pairs(gear.Device.Stats) do
		stats[k] = v
	end
	local cf = S.Inventory.condFactor(gear.DeviceRec)
	stats.Video = stats.Video * cf
	stats.Audio = gear.IsPhone and 25 or (gear.Device.Sub == "Vlog" and 42 or 30)
	local result = F.scene({
		shot = shot,
		device = stats,
		micAudio = gear.Mic and gear.Mic.Stats.Audio or nil,
		micPortable = gear.Mic and gear.Mic.Portable or false,
		tripod = gear.Tripod and gear.Tripod.Stats.Stability or 0,
		gimbal = gear.Gimbal and gear.Gimbal.Stats.Stab or 0,
		mount = gear.Mount and gear.Mount.Stats.Stab or 0,
		portableLight = gear.Light and gear.Light.Stats.Light or 0,
		homeLight = spot.IsHome and ((gear.HomeLight and gear.HomeLight.Stats.Light or 0) + (spot.ExtraLight or 0)) or 0,
		decor = spot.Decor or (spot.IsHome and (5 + (gear.Decor and gear.Decor.Stats.Decor or 0))) or 0,
		presentation = spot.IsHome and gear.Teleprompter and gear.Teleprompter.Stats.Presentation or 0,
		indoor = spot.Indoor,
		hour = hour,
		goldenHour = F.isGoldenHour(hour),
		weather = S.Time.Weather,
		spotTags = spot.Tags,
		spotInterest = spot.Interest * S.Events.sceneBonus(spot) + (S.Needs and S.Needs.interestBonus(player) or 0) + (S.Pet and S.Pet.interestBonus(player) or 0) + (S.Friend and S.Friend.interestBonus(player, rec.Pid) or 0),
		spotNoise = spot.Noise,
		busy = spot.Busy,
		categoryTags = cat.Tags,
		productQuality = product and product.Quality or nil,
		batteryLow = low,
	})

	local idData = owner and S.Data.get(owner) or data -- los ids de escena son del dueño del proyecto
	idData.Counters.scene_id = (idData.Counters.scene_id or 0) + 1
	local scene = {
		Id = "s" .. idData.Counters.scene_id,
		By = player.UserId,
		Shot = shot.Id,
		Spot = spot.Id,
		SpotName = spot.Name,
		District = spot.District,
		Q = math.min(100, Util.round(result.Quality + (S.Company and S.Company.sceneBonus(player) or 0), 1)),
		Img = result.Image,
		Aud = result.Audio,
		Light = result.Lighting,
		Int = result.Interest,
		Probs = result.Problems,
		Sec = result.Seconds,
		Dev = gear.Device.Name,
		Gb = Util.round((gear.Device.Stats.GbPerMin or 1) * result.Seconds / 60 * Video.GbScale, 1),
		Imp = false,
		Feat = product and product.Id or nil,
		Own = owned,
		Hour = Util.round(hour, 1),
		W = S.Time.Weather,
	}
	table.insert(proj.Scenes, scene)
	if proj.Status == "planning" then
		proj.Status = "recording"
	end
	rec.Last = os.clock()
	-- desgaste leve del equipo
	gear.DeviceRec.Cond = math.max(30, gear.DeviceRec.Cond - 0.15)

	data.Counters.scenes = (data.Counters.scenes or 0) + 1
	if F.isGoldenHour(hour) and not spot.Indoor then
		data.Counters.golden_scenes = (data.Counters.golden_scenes or 0) + 1
	end
	if spot.District then
		data.Visited.Recorded[spot.District] = true
	end
	S.Progress.addXp(player, S.Progress.Xp.Scene)
	S.Events.onScene(player, spot)
	S.Jobs.onScene(player, scene)
	if S.Friend then
		S.Friend.onScene(player, scene, rec.Pid)
	end
	if S.Needs then
		S.Needs.spend(player, 1)
	end
	if owner and S.Collab then
		S.Collab.onScene(player, owner, proj, scene)
	end
	S.Quest.tutorialEvent(player, "record_scene")
	S.Quest.check(player)
	local msg = "🎬 " .. shot.Name .. " en " .. spot.Name .. " — calidad " .. math.floor(scene.Q)
	if owner then
		msg = msg .. " · para «" .. proj.Name .. "»"
	end
	if #scene.Probs > 0 then
		msg = msg .. " (" .. table.concat(scene.Probs, ", ") .. ")"
	end
	return true, msg, { scene = scene, charge = gear.DeviceRec.Charge }
end

---------------------------------------------------------------------------
-- Fotografías
---------------------------------------------------------------------------
function Video.photoCapacity(player)
	local phoneRec, phoneDef = S.Inventory.phone(player)
	local cap = phoneDef and phoneDef.Stats.PhotoStorage or 40
	if S.Inventory.best(player, "camera", "any", "Photo") then
		cap = cap + 60
	end
	return math.min(Config.MaxPhotos, cap)
end

local function num(v, lo, hi)
	v = tonumber(v)
	if not v or v ~= v then
		return nil
	end
	return Util.clamp(v, lo, hi)
end

function Video.takePhoto(player, p)
	local data = S.Data.get(player)
	if os.clock() - (lastPhoto[player] or 0) < Config.PhotoCooldown then
		return false, "Espera un momento."
	end
	local mode = VideoData.PhotoModeById[p.mode or ""]
	if not mode then
		return false, "Modo de foto no válido."
	end
	-- Modo mascota: solo con tu mascota cerca (+8 de calidad)
	local petBonus, petRec = 0, nil
	if mode.Id == "pet" then
		if not S.Pet then
			return false, "Necesitas una mascota contigo para hacer una foto de mascota."
		end
		local bonus, info = S.Pet.photoBonus(player)
		if not bonus then
			return false, info
		end
		petBonus, petRec = bonus, info
	end
	if #data.Photos >= Video.photoCapacity(player) then
		return false, "Álbum lleno (" .. #data.Photos .. " fotos). Borra fotos o consigue más almacenamiento (mejor teléfono o una cámara)."
	end
	local spot = S.Travel.currentSpot(player) or S.Travel.genericSpot(player)
	local gear = Video.gear(player, false)
	-- Para fotos se usa el dispositivo con mejor calidad fotográfica
	local camUid, camRec, camDef = S.Inventory.best(player, "camera", "backpack", "Photo")
	local phoneRec, phoneDef = S.Inventory.phone(player)
	local dev, devRec = phoneDef, phoneRec
	if camDef and (not phoneDef or camDef.Stats.Photo > phoneDef.Stats.Photo) then
		dev, devRec = camDef, camRec
	end
	if not dev then
		return false, "No tienes cámara ni teléfono."
	end
	local product = nil
	if mode.NeedsProduct then
		local def, owned, perr = featuredFrom(player, p, spot, gear)
		if not def then
			return false, perr or "Elige un producto para la foto de producto."
		end
		product = def
	end
	local hour = S.Time.hour()
	local stats = {}
	for k, v in pairs(dev.Stats) do
		stats[k] = v
	end
	stats.Photo = stats.Photo * S.Inventory.condFactor(devRec)
	local result = F.photo({
		mode = mode,
		device = stats,
		indoor = spot.Indoor,
		hour = hour,
		goldenHour = F.isGoldenHour(hour),
		weather = S.Time.Weather,
		spotTags = spot.Tags,
		homeLight = spot.IsHome and ((gear.HomeLight and gear.HomeLight.Stats.Light or 0) + (spot.ExtraLight or 0)) or 0,
		portableLight = gear.Light and gear.Light.Stats.Light or 0,
		tripod = gear.Tripod and gear.Tripod.Stats.Stability or 0,
		composition = num(p.composition, 0, 10) or 5,
	})
	if petBonus > 0 then
		result.Quality = Util.round(Util.clamp(result.Quality + petBonus, 1, 100), 1)
	end
	data.Counters.photo_id = (data.Counters.photo_id or 0) + 1
	local cam = nil
	if type(p.cam) == "table" then
		local c = {}
		for i = 1, 6 do
			c[i] = num(p.cam[i], -5000, 5000)
		end
		if c[6] then
			cam = c
		end
	end
	local filter = math.floor(num(p.filter, 1, #VideoData.PhotoFilters) or 1)
	local photo = {
		Id = "f" .. data.Counters.photo_id,
		Mode = mode.Id,
		Q = result.Quality,
		Spot = spot.Id,
		SpotName = spot.Name,
		District = spot.District,
		Tags = spot.Tags,
		Hour = Util.round(hour, 1),
		W = S.Time.Weather,
		T = os.time(),
		Filter = filter,
		Cam = cam,
		Fov = num(p.fov, 20, 100) or 70,
		Album = "General",
		Dev = dev.Name,
		Prod = product and product.Id or nil,
		Pet = petRec and petRec.Name or nil,
		Probs = result.Problems,
	}
	table.insert(data.Photos, 1, photo)
	lastPhoto[player] = os.clock()
	data.Counters.photos = (data.Counters.photos or 0) + 1
	if petRec then
		data.Counters.pet_photos = (data.Counters.pet_photos or 0) + 1
	end
	if mode.Night and S.Time.isNight() then
		data.Counters.night_photos = (data.Counters.night_photos or 0) + 1
	end
	S.Progress.addXp(player, S.Progress.Xp.Photo)
	S.Quest.check(player)
	-- Encargos de fotógrafo (JobsService) y concursos de eventos
	S.Jobs.onPhoto(player, photo)
	S.Events.onPhoto(player, photo)
	return true, "📸 Foto guardada (" .. mode.Name .. ", calidad " .. math.floor(photo.Q) .. ")", { photo = photo }
end

---------------------------------------------------------------------------
-- Edición
---------------------------------------------------------------------------
local function canEdit(player)
	if S.Computer.hasSession(player) then
		return true, S.Computer.sessionStats(player)
	end
	local _, _, tab = S.Inventory.best(player, "tablet", "backpack", "EditLite")
	if tab and (tab.Stats.EditLite or 0) > 0 then
		return true, { MaxScenes = tab.Stats.EditLite, ColorAcc = 55, ProColor = 0, AudioMix = 10, Kind = "tablet", RenderMult = 0.8, EditSpeed = 0, Comfort = 0 }
	end
	return false
end

local function validEdit(proj, data, edit, maxScenes)
	if type(edit) ~= "table" or type(edit.Timeline) ~= "table" then
		return nil, "Edición no válida."
	end
	if #edit.Timeline > maxScenes then
		return nil, "Tu equipo solo puede manejar " .. maxScenes .. " clips. Mejora el computador para proyectos más grandes."
	end
	local scenes = {}
	for _, sc in ipairs(proj.Scenes) do
		scenes[sc.Id] = sc
	end
	local photos = {}
	for _, ph in ipairs(data.Photos) do
		photos[ph.Id] = ph
	end
	local transitions = {}
	for _, t in ipairs(VideoData.Transitions) do
		transitions[t.Id] = true
	end
	local out = newEdit()
	for _, e in ipairs(edit.Timeline) do
		if type(e) ~= "table" then
			return nil, "Clip no válido."
		end
		if e.k == "s" then
			local sc = scenes[e.id]
			if not sc then
				return nil, "Una escena ya no existe."
			end
			if not sc.Imp then
				return nil, "Importa el material antes de editarlo."
			end
		elseif e.k == "p" then
			if not photos[e.id] then
				return nil, "Una foto ya no existe."
			end
		else
			return nil, "Clip no válido."
		end
		table.insert(out.Timeline, { k = e.k, id = e.id, trim = num(e.trim, 0.3, 1) or 1, tr = transitions[e.tr] and e.tr or "cut" })
	end
	out.Titles = edit.Titles == true
	out.TitleText = Util.cleanText(edit.TitleText or "", 40) or ""
	out.Subtitles = edit.Subtitles == true
	out.Music = VideoData.MusicById[edit.Music or ""] and edit.Music or "none"
	out.MusicVol = num(edit.MusicVol, 0, 1) or 0.3
	out.VoiceVol = num(edit.VoiceVol, 0, 1) or 1
	local fx = {}
	for _, id in ipairs(type(edit.Effects) == "table" and edit.Effects or {}) do
		for _, def in ipairs(VideoData.Effects) do
			if def.Id == id and not Util.indexOf(fx, id) then
				fx[#fx + 1] = id
			end
		end
	end
	out.Effects = fx
	local c = type(edit.Color) == "table" and edit.Color or {}
	out.Color = { b = math.floor(num(c.b, -100, 100) or 0), c = math.floor(num(c.c, -100, 100) or 0), s = math.floor(num(c.s, -100, 100) or 0) }
	local function validId(list, id)
		for _, it in ipairs(list) do
			if it.Id == id then
				return id
			end
		end
		return "none"
	end
	out.Intro = validId(VideoData.Intros, edit.Intro)
	out.Outro = validId(VideoData.Outros, edit.Outro)
	return out
end

function Video.evaluate(player, proj, stats)
	local data = S.Data.get(player)
	local scenes, photos = {}, {}
	for _, sc in ipairs(proj.Scenes) do
		scenes[sc.Id] = sc
	end
	for _, ph in ipairs(data.Photos) do
		photos[ph.Id] = ph
	end
	local entries, nPhotos, nTrans = {}, 0, 0
	for i, e in ipairs(proj.Edit.Timeline) do
		if e.k == "s" and scenes[e.id] then
			local sc = scenes[e.id]
			entries[#entries + 1] = { q = sc.Q, seconds = sc.Sec, trim = e.trim, shot = sc.Shot, transition = e.tr }
		elseif e.k == "p" and photos[e.id] then
			nPhotos = nPhotos + 1
			entries[#entries + 1] = { q = photos[e.id].Q * 0.8, seconds = 4, trim = 1, shot = "photo", transition = e.tr }
		end
		if i > 1 and e.tr ~= "cut" then
			nTrans = nTrans + 1
		end
	end
	local dur = VideoData.Durations[1]
	for _, d in ipairs(VideoData.Durations) do
		if d.Id == proj.Plan.Duration then
			dur = d
		end
	end
	local ed = proj.Edit
	local res = F.edit({
		entries = entries,
		targetSeconds = dur.Seconds,
		titles = ed.Titles,
		subtitles = ed.Subtitles,
		music = ed.Music,
		musicVol = ed.MusicVol,
		voiceVol = ed.VoiceVol,
		effects = ed.Effects,
		color = ed.Color,
		intro = ed.Intro,
		outro = ed.Outro,
		category = proj.Category,
		colorAcc = stats and stats.ColorAcc or 40,
		proColor = stats and stats.ProColor or 0,
		audioMix = stats and stats.AudioMix or 0,
	})
	local c = ed.Color
	local graded = (math.abs(c.b) + math.abs(c.c) + math.abs(c.s)) > 0
	return res, { seconds = res.Seconds, effects = ed.Effects, transitions = nTrans, photos = nPhotos, colorGraded = graded }
end

---------------------------------------------------------------------------
-- Publicación
---------------------------------------------------------------------------
local function classify(proj, cat)
	local owned, store = {}, {}
	local talking = false
	for _, sc in ipairs(proj.Scenes) do
		if sc.Feat then
			if sc.Own then
				owned[sc.Feat] = true
			else
				store[sc.Feat] = true
			end
		end
		if sc.Shot == "talking" then
			talking = true
		end
	end
	local nOwned, nStore = Util.count(owned), Util.count(store)
	local need = cat.NeedsProducts or 0
	local label, mult = nil, 1
	if need > 0 or cat.ProductBonus then
		if nOwned >= math.max(1, need) then
			label, mult = "Prueba real", 1.1
		elseif nOwned + nStore >= math.max(1, need) then
			label, mult = "Prueba en tienda", 1.0
		elseif need > 0 then
			label, mult = "Comparación de especificaciones", 0.8
		end
	end
	local tags = {}
	if label then
		tags[#tags + 1] = label
	end
	if talking then
		tags[#tags + 1] = "Opinión personal"
	end
	local products = {}
	for id in pairs(owned) do
		products[#products + 1] = id
	end
	for id in pairs(store) do
		products[#products + 1] = id
	end
	return label, mult, tags, products, nOwned
end

function Video.publish(player, p)
	local data = S.Data.get(player)
	if tonumber(p.owner) and tonumber(p.owner) ~= player.UserId then
		return false, "Solo el dueño del proyecto puede publicarlo."
	end
	local proj = getProject(player, p.pid)
	if not proj then
		return false, "Proyecto no encontrado."
	end
	if not proj.Export or proj.Export.ReadyAt == nil then
		return false, "Primero exporta el vídeo en el Editor."
	end
	if os.time() < proj.Export.ReadyAt then
		return false, "La exportación aún no ha terminado."
	end
	local title = Util.cleanText(p.title, Config.MaxTextTitle)
	if not title or #title < 3 then
		return false, "Escribe un título (mínimo 3 caracteres)."
	end
	local desc = Util.cleanText(p.description or "", Config.MaxTextDescription) or ""
	local tagList = {}
	if type(p.tags) == "table" then
		for i = 1, math.min(8, #p.tags) do
			local t = Util.cleanText(p.tags[i], 20)
			if t and #t > 0 then
				tagList[#tagList + 1] = t
			end
		end
	end
	local fTitle = S.Text.filter(player, title)
	local fDesc = S.Text.filter(player, desc)
	local fTags = S.Text.filter(player, table.concat(tagList, ","))
	if not fTitle or not fDesc or not fTags then
		return false, "No se pudo comprobar el texto. Inténtalo de nuevo."
	end
	local thumb = type(p.thumbId) == "string" and data.Thumbnails[p.thumbId] or nil
	local cat = VideoData.CategoryById[proj.Category]
	local res = proj.Export.Res
	local label, labelMult, labels, products, nOwned = classify(proj, cat)

	-- Formato
	local fmt = VideoData.FormatById[p.format or "video"] or VideoData.FormatById.video
	if fmt.MaxSeconds and res.Seconds > fmt.MaxSeconds then
		return false, "Un Short dura como máximo " .. fmt.MaxSeconds .. " s (el tuyo dura " .. res.Seconds .. " s). Recorta en el Editor."
	end
	if fmt.MinTalk then
		local talk, audio = 0, 0
		for _, sc in ipairs(proj.Scenes) do
			if sc.Shot == "talking" or sc.Shot == "interview" then
				talk = talk + 1
				audio = audio + sc.Aud
			end
		end
		if talk < fmt.MinTalk then
			return false, "Un podcast necesita al menos " .. fmt.MinTalk .. " tomas de presentación o entrevista."
		end
		if audio / talk < fmt.MinAudio then
			return false, "El audio de las tomas habladas es demasiado bajo para un podcast (usa un buen micrófono)."
		end
	end
	if fmt.MinScenes and (#proj.Scenes < fmt.MinScenes or res.Seconds < fmt.MinSeconds) then
		return false, "Un documental necesita al menos " .. fmt.MinScenes .. " escenas y " .. math.floor(fmt.MinSeconds / 60) .. " minutos."
	end
	local seriesName, episode, loyal = nil, nil, 1
	if fmt.Series then
		local n = Util.cleanText(p.series or "", 30)
		if not n or #n < 2 then
			return false, "Escribe el nombre de la serie."
		end
		seriesName = S.Text.filter(player, n)
		if not seriesName then
			return false, "No se pudo comprobar el nombre de la serie."
		end
		data.Series = data.Series or {}
		episode = (data.Series[seriesName] or 0) + 1
		loyal = 1 + math.min(0.3, 0.06 * (episode - 1))
	end
	-- Patrocinio
	local contract, contractId = nil, nil
	if type(p.sponsor) == "string" and p.sponsor ~= "" then
		local c, err = S.Sponsor.fulfill(player, p.sponsor, proj, res.Final)
		if not c then
			return false, "No cumple el contrato: " .. err
		end
		contract, contractId = c, p.sponsor
		labels[#labels + 1] = "Contenido patrocinado"
	end
	-- Encargo de un cliente de tu empresa
	local client, clientId = nil, nil
	if type(p.client) == "string" and p.client ~= "" then
		if not S.Company then
			return false, "Las empresas no están disponibles."
		end
		local k, err = S.Company.checkClient(player, p.client, proj, res.Final)
		if not k then
			return false, "No cumple el encargo del cliente: " .. err
		end
		client, clientId = k, p.client
		labels[#labels + 1] = "Producción para cliente"
	end

	data.Counters.video_id = (data.Counters.video_id or 0) + 1
	local vid = "v" .. data.Counters.video_id
	local seed = vid .. ":" .. player.UserId
	local luck = Util.seededRandom(seed, 0.8, 1.25)
	local viral = nil
	if res.Final >= 75 and Util.seededRandom(seed .. ":viral", 0, 1) > 0.96 then
		viral = Util.seededRandom(seed .. ":mult", 2.5, 4)
	end
	local fatigue = 1
	local same = 0
	for i = 1, math.min(3, #data.Videos) do
		if data.Videos[i].Cat == proj.Category then
			same = same + 1
		end
	end
	if same >= 3 then
		fatigue = 0.85
	end
	local thumbScore = thumb and thumb.Score or 30
	local titleScore = F.title(fTitle, proj.Category)
	local ctr = F.ctr(thumbScore, titleScore)
	local trend = S.Channel.trendFor(proj.Category)
	local expected = F.expectedViews({
		subs = data.Channel.Subs,
		quality = res.Final,
		ctr = ctr,
		interest = cat.Interest * labelMult,
		trend = trend,
		reputation = data.Reputation,
		luck = luck,
		competition = S.Channel.competition(),
		fatigue = fatigue,
		viral = viral,
	})
	expected = math.floor(expected * (fmt.ViewMult or 1) * loyal * S.Events.viewMultiplier(proj.Category))
	-- Colaboración: el vídeo guarda el colaborador; bonus si grabó al menos una escena
	local collab = nil
	if S.Collab then
		collab = S.Collab.forPublish(player, p.pid, proj)
		if collab then
			labels[#labels + 1] = "Colaboración con " .. collab.name
			if collab.bonus then
				expected = math.floor(expected * S.Collab.ViewBonus)
			end
		end
	end
	local unlisted = p.visibility == "unlisted"
	if unlisted then
		expected = math.floor(expected * 0.1)
	end

	local video = {
		Id = vid,
		Title = fTitle,
		Desc = fDesc,
		Tags = fTags,
		Cat = proj.Category,
		Q = res.Final,
		EditQ = res.EditQuality,
		Footage = res.Footage,
		Sec = res.Seconds,
		Thumb = thumbScore,
		ThumbDesign = thumb and thumb.Design or nil,
		TitleScore = titleScore,
		Ctr = Util.round(ctr * 100, 2),
		Expected = expected,
		Views = 0,
		Likes = 0,
		Comments = 0,
		CommentList = {},
		Revenue = 0,
		SubsGained = 0,
		At = os.time(),
		Hist = {},
		Label = label,
		Labels = labels,
		Products = products,
		Trend = trend > 1,
		Viral = viral ~= nil,
		Unlisted = unlisted,
		Format = fmt.Id,
		RpmMult = fmt.RpmMult or 1,
		SubMult = (fmt.SubMult or 1) * ((collab and collab.bonus) and S.Collab.SubBonus or 1),
		Collab = collab,
		Series = seriesName,
		Episode = episode,
		Sponsor = contract and contract.Brand or nil,
		Client = client and S.Company.clientLabel(client) or nil,
	}
	table.insert(data.Videos, 1, video)
	while #data.Videos > Config.MaxVideosKept do
		table.remove(data.Videos)
	end
	data.Projects[p.pid] = nil
	if recording[player] and recording[player].Pid == p.pid then
		recording[player] = nil
	end

	-- Progreso
	if seriesName then
		data.Series[seriesName] = episode
		data.Counters.series_eps = (data.Counters.series_eps or 0) + 1
	end
	if fmt.Id == "short" then
		data.Counters.shorts = (data.Counters.shorts or 0) + 1
	elseif fmt.Id == "podcast" then
		data.Counters.podcasts = (data.Counters.podcasts or 0) + 1
	elseif fmt.Id == "doc" then
		data.Counters.docs = (data.Counters.docs or 0) + 1
		if res.Final >= 65 then
			data.Reputation = math.min(100, data.Reputation + 1)
		end
	end
	if contractId then
		S.Sponsor.complete(player, contractId, res.Final)
	end
	if clientId then
		S.Company.completeClient(player, clientId, res.Final, vid)
	end
	S.Events.onPublish(player, video)
	data.Counters.published = (data.Counters.published or 0) + 1
	data.Visited.Categories[proj.Category] = true
	data.Counters.max_quality = math.max(data.Counters.max_quality or 0, math.floor(res.Final))
	if proj.Category == "compare" then
		data.Counters.comparisons = (data.Counters.comparisons or 0) + 1
	end
	if label == "Prueba real" and (proj.Category == "review" or proj.Category == "unboxing" or proj.Category == "tech" or proj.Category == "compare") then
		data.Counters.reviews = (data.Counters.reviews or 0) + 1
	end
	if res.Final >= 70 then
		data.Reputation = math.min(100, data.Reputation + 1)
	elseif res.Final < 30 then
		data.Reputation = math.max(0, data.Reputation - 1)
	end
	if collab and S.Collab then
		S.Collab.onPublished(player, p.pid, video)
	end
	S.Progress.addXp(player, S.Progress.Xp.PublishBase + math.floor(res.Final / 2))
	S.Quest.tutorialEvent(player, "publish")
	S.Quest.check(player)
	S.Channel.tickPlayer(player)
	return true, "🎉 ¡Vídeo publicado! Calidad final " .. math.floor(res.Final) .. "/100. Mira cómo crece en Estadísticas.", { videoId = vid }
end

---------------------------------------------------------------------------
-- Registro de acciones
---------------------------------------------------------------------------
function Video.Start()
	local Net = S.Net

	Net.on("Video.CreateProject", function(player, p)
		local data = S.Data.get(player)
		local cat = VideoData.CategoryById[p.category or ""]
		if not cat then
			return false, "Elige una categoría."
		end
		if Util.count(data.Projects) >= projectSlots(player) then
			return false, "Tienes " .. projectSlots(player) .. " proyectos abiertos. Publica o borra alguno."
		end
		local name = Util.cleanText(p.name or "", 40)
		if not name or #name == 0 then
			name = cat.Name .. " #" .. ((data.Counters.project_id or 0) + 1)
		end
		name = S.Text.filter(player, name) or (cat.Name .. " #" .. ((data.Counters.project_id or 0) + 1))
		data.Counters.project_id = (data.Counters.project_id or 0) + 1
		local pid = "p" .. data.Counters.project_id
		data.Projects[pid] = {
			Id = pid,
			Name = name,
			Category = cat.Id,
			Status = "planning",
			Created = os.time(),
			Plan = { Style = 1, Duration = "short", Budget = 0, Goal = 1, Transport = 1, Location = "", Featured = {}, Time = "", Notes = "" },
			Scenes = {},
			Edit = newEdit(),
			Versions = {},
			Export = nil,
			ThumbId = "",
		}
		S.Quest.tutorialEvent(player, "create_project")
		return true, "Proyecto «" .. name .. "» creado. Planifícalo y sal a grabar.", { pid = pid }
	end)

	Net.on("Video.UpdatePlan", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		local plan = proj.Plan
		local q = type(p.plan) == "table" and p.plan or {}
		plan.Style = math.floor(num(q.Style, 1, #VideoData.Styles) or plan.Style)
		plan.Goal = math.floor(num(q.Goal, 1, #VideoData.Goals) or plan.Goal)
		plan.Transport = math.floor(num(q.Transport, 1, #VideoData.Transport) or plan.Transport)
		plan.Budget = math.floor(num(q.Budget, 0, 1000000) or plan.Budget)
		for _, d in ipairs(VideoData.Durations) do
			if d.Id == q.Duration then
				plan.Duration = d.Id
			end
		end
		if type(q.Location) == "string" and (q.Location == "" or S.World.SpotById[q.Location] or q.Location == "home") then
			plan.Location = q.Location
		end
		if type(q.Time) == "string" and #q.Time <= 20 then
			plan.Time = q.Time
		end
		if type(q.Featured) == "table" then
			local f = {}
			for i = 1, math.min(4, #q.Featured) do
				if Catalog.get(q.Featured[i]) then
					f[#f + 1] = q.Featured[i]
				end
			end
			plan.Featured = f
		end
		return true, "Plan guardado."
	end)

	Net.on("Video.DeleteProject", function(player, p)
		local data = S.Data.get(player)
		if not getProject(player, p.pid) then
			return false, "Proyecto no encontrado."
		end
		data.Projects[p.pid] = nil
		if recording[player] and recording[player].Pid == p.pid then
			recording[player] = nil
		end
		return true, "Proyecto movido a la papelera y eliminado."
	end)

	Net.on("Video.DuplicateProject", function(player, p)
		local data = S.Data.get(player)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		if Util.count(data.Projects) >= projectSlots(player) then
			return false, "No quedan espacios para proyectos."
		end
		data.Counters.project_id = (data.Counters.project_id or 0) + 1
		local pid = "p" .. data.Counters.project_id
		local copy = Util.deepCopy(proj)
		copy.Id = pid
		copy.Name = (proj.Name .. " (copia)"):sub(1, 40)
		copy.Export = nil
		copy.Versions = {}
		data.Projects[pid] = copy
		return true, "Proyecto duplicado.", { pid = pid }
	end)

	Net.on("Video.StartRecording", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Elige un proyecto."
		end
		local gear = Video.gear(player, p.usePhone == true)
		if not gear.Device then
			return false, "No tienes cámara ni teléfono."
		end
		recording[player] = { Pid = p.pid, UseCamera = p.usePhone ~= true, Last = 0 }
		local spot = S.Travel.currentSpot(player)
		return true, "Grabando «" .. proj.Name .. "» con " .. gear.Device.Name .. ".", {
			device = gear.Device.Name,
			charge = gear.DeviceRec.Charge,
			spot = spot and spot.Name or nil,
			mic = gear.Mic and gear.Mic.Name or "Micrófono interno",
			tripod = gear.Tripod ~= nil,
			gimbal = gear.Gimbal ~= nil,
			light = gear.Light ~= nil,
			drone = gear.Drone ~= nil,
		}
	end)

	Net.on("Video.StopRecording", function(player)
		recording[player] = nil
		return true, "Grabación terminada. Vuelve a casa para importar y editar."
	end)

	Net.on("Video.RecordScene", Video.recordScene)
	Net.on("Video.DeleteScene", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		for i, sc in ipairs(proj.Scenes) do
			if sc.Id == p.sceneId then
				table.remove(proj.Scenes, i)
				local tl = {}
				for _, e in ipairs(proj.Edit.Timeline) do
					if not (e.k == "s" and e.id == p.sceneId) then
						tl[#tl + 1] = e
					end
				end
				proj.Edit.Timeline = tl
				proj.Export = nil
				return true, "Escena eliminada."
			end
		end
		return false, "Escena no encontrada."
	end)

	Net.on("Photo.Take", Video.takePhoto)
	Net.on("Photo.Delete", function(player, p)
		local data = S.Data.get(player)
		for i, ph in ipairs(data.Photos) do
			if ph.Id == p.id then
				table.remove(data.Photos, i)
				return true, "Foto eliminada."
			end
		end
		return false, "Foto no encontrada."
	end)
	Net.on("Photo.SetAlbum", function(player, p)
		local data = S.Data.get(player)
		if not Util.indexOf(data.Albums, p.album) then
			return false, "Álbum no válido."
		end
		for _, ph in ipairs(data.Photos) do
			if ph.Id == p.id then
				ph.Album = p.album
				return true, "Foto movida a «" .. p.album .. "»."
			end
		end
		return false, "Foto no encontrada."
	end)
	Net.on("Photo.CreateAlbum", function(player, p)
		local data = S.Data.get(player)
		local name = Util.cleanText(p.name, 20)
		if not name or #name == 0 or #data.Albums >= 10 or Util.indexOf(data.Albums, name) then
			return false, "Nombre no válido o demasiados álbumes."
		end
		name = S.Text.filter(player, name)
		if not name then
			return false, "Nombre no permitido."
		end
		table.insert(data.Albums, name)
		return true, "Álbum creado."
	end)

	Net.on("Video.Import", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		if not S.Computer.hasSession(player) then
			return false, "Importa el material desde un computador o un portátil."
		end
		local stats = S.Computer.sessionStats(player)
		local used = S.Computer.storageUsed(player)
		local need = 0
		local count = 0
		for _, sc in ipairs(proj.Scenes) do
			if not sc.Imp then
				need = need + sc.Gb
				count = count + 1
			end
		end
		if count == 0 then
			return false, "No hay material nuevo que importar."
		end
		if used + need > stats.StorageGb then
			return false, "Sin espacio: necesitas " .. math.ceil(need) .. " GB y quedan " .. math.floor(stats.StorageGb - used) .. " GB. Publica proyectos, borra escenas o compra almacenamiento."
		end
		for _, sc in ipairs(proj.Scenes) do
			sc.Imp = true
		end
		if proj.Status == "recording" or proj.Status == "planning" then
			proj.Status = "editing"
		end
		return true, count .. " escenas importadas (" .. math.ceil(need) .. " GB)."
	end)

	Net.on("Video.SaveEdit", function(player, p)
		local data = S.Data.get(player)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		local ok, stats = canEdit(player)
		if not ok then
			return false, "Necesitas un computador, un portátil o una tableta Pro para editar."
		end
		local edit, err = validEdit(proj, data, p.edit, math.min(stats.MaxScenes, Config.MaxScenesPerProject))
		if not edit then
			return false, err
		end
		proj.Edit = edit
		proj.Export = nil
		proj.Status = "editing"
		local res = Video.evaluate(player, proj, stats)
		S.Quest.tutorialEvent(player, "save_edit")
		return true, "Proyecto guardado. Calidad estimada " .. math.floor(res.Final) .. "/100.", { eval = res }
	end)

	Net.on("Video.Evaluate", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		local _, stats = canEdit(player)
		return true, nil, { eval = Video.evaluate(player, proj, stats) }
	end)

	Net.on("Video.SaveVersion", function(player, p)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		local label = Util.cleanText(p.label or "", 24) or ""
		if #label == 0 then
			label = "Versión " .. (#proj.Versions + 1)
		end
		table.insert(proj.Versions, 1, { Label = label, T = os.time(), Edit = Util.deepCopy(proj.Edit) })
		while #proj.Versions > Config.MaxVersionsPerProject do
			table.remove(proj.Versions)
		end
		return true, "Versión «" .. label .. "» guardada."
	end)

	Net.on("Video.RestoreVersion", function(player, p)
		local proj = getProject(player, p.pid)
		local idx = tonumber(p.index)
		if not proj or not idx or not proj.Versions[idx] then
			return false, "Versión no encontrada."
		end
		proj.Edit = Util.deepCopy(proj.Versions[idx].Edit)
		proj.Export = nil
		return true, "Versión restaurada."
	end)

	Net.on("Video.Export", function(player, p)
		local data = S.Data.get(player)
		local proj = getProject(player, p.pid)
		if not proj then
			return false, "Proyecto no encontrado."
		end
		if not S.Computer.hasSession(player) then
			return false, "Exporta desde un computador o un portátil."
		end
		if #proj.Edit.Timeline == 0 then
			return false, "La línea de tiempo está vacía."
		end
		if proj.Export and proj.Export.ReadyAt and os.time() < proj.Export.ReadyAt then
			return false, "Ya se está exportando."
		end
		local stats = S.Computer.sessionStats(player)
		local res, cx = Video.evaluate(player, proj, stats)
		-- Editor de tu empresa: exportación más rápida
		local secs = math.floor(F.exportSeconds(cx, stats, stats.EditSpeed, stats.Comfort) * (S.Needs and S.Needs.exportMult(player) or 1) * (S.Company and S.Company.exportMult(player) or 1) + 0.5)
		secs = math.max(1, secs)
		if p.useToken and data.ExportTokens > 0 then
			data.ExportTokens = data.ExportTokens - 1
			secs = 1
		end
		proj.Export = { Started = os.time(), ReadyAt = os.time() + secs, Secs = secs, Res = res }
		proj.Status = "exported"
		data.Counters.exports = (data.Counters.exports or 0) + 1
		S.Progress.addXp(player, S.Progress.Xp.Export)
		S.Quest.check(player)
		return true, "Exportando... tiempo estimado " .. secs .. " s (" .. stats.TierName .. ").", { secs = secs, readyAt = proj.Export.ReadyAt, eval = res }
	end)

	Net.on("Thumb.Save", function(player, p)
		local data = S.Data.get(player)
		local _, _, tab = S.Inventory.best(player, "tablet", "backpack")
		if not S.Computer.hasSession(player) and not tab then
			return false, "Diseña miniaturas en un computador o con una tableta en la mochila."
		end
		local d = type(p.design) == "table" and p.design or {}
		local text = Util.cleanText(d.text or "", 40) or ""
		local fText = S.Text.filter(player, text)
		if not fText then
			return false, "No se pudo comprobar el texto."
		end
		local design = {
			text = fText,
			font = VideoData.FontById[d.font or ""] and d.font or "GothamBlack",
			textColor = math.floor(num(d.textColor, 1, #VideoData.Palette) or 1),
			bg = math.floor(num(d.bg, 1, #VideoData.Palette) or 2),
			outline = d.outline == true,
			frame = "none",
			template = VideoData.ThumbTemplateById[d.template or ""] and d.template or "center",
			stickers = {},
			photoId = nil,
			textSize = num(d.textSize, 0.5, 1.5) or 1,
		}
		for _, f in ipairs(VideoData.Frames) do
			if f.Id == d.frame then
				design.frame = f.Id
			end
		end
		if type(d.stickers) == "table" then
			for i = 1, math.min(6, #d.stickers) do
				for _, st in ipairs(VideoData.Stickers) do
					if st.Id == d.stickers[i] then
						table.insert(design.stickers, st.Id)
					end
				end
			end
		end
		local photo = nil
		if type(d.photoId) == "string" then
			for _, ph in ipairs(data.Photos) do
				if ph.Id == d.photoId then
					photo = ph
				end
			end
			if not photo then
				return false, "La foto elegida no existe."
			end
			design.photoId = photo.Id
			design.photoCam = photo.Cam
			design.photoFilter = photo.Filter
			design.photoSpot = photo.SpotName
		end
		local proj = getProject(player, p.pid)
		local cat = proj and VideoData.CategoryById[proj.Category] or nil
		local kw = proj and F.categoryKeyword(proj.Category) or nil
		local score = F.thumbnail(design, {
			photoQuality = photo and photo.Q or nil,
			photoMatches = photo and cat and F.overlap(photo.Tags, cat.Tags) > 0 or false,
			keywordInText = kw ~= nil and fText:lower():find(kw, 1, true) ~= nil,
		})
		-- Diseñador de tu empresa: miniaturas mejores
		if S.Company then
			local tb = S.Company.thumbBonus(player)
			if tb > 0 then
				score.Score = math.min(100, Util.round(score.Score + tb, 1))
			end
		end
		if Util.count(data.Thumbnails) >= Config.MaxThumbnails then
			-- eliminar la más antigua
			local oldestId, oldestT = nil, math.huge
			for id, t in pairs(data.Thumbnails) do
				if t.T < oldestT then
					oldestId, oldestT = id, t.T
				end
			end
			data.Thumbnails[oldestId] = nil
		end
		data.Counters.thumb_id = (data.Counters.thumb_id or 0) + 1
		local tid = "t" .. data.Counters.thumb_id
		data.Thumbnails[tid] = { Id = tid, Design = design, Score = score.Score, Read = score.Readability, Comp = score.Composition, Rel = score.Relevance, Details = score.Details, Pid = proj and proj.Id or nil, T = os.time() }
		if proj then
			proj.ThumbId = tid
		end
		data.Counters.thumbnails = (data.Counters.thumbnails or 0) + 1
		S.Jobs.onThumb(player, design, score.Score)
		S.Progress.addXp(player, S.Progress.Xp.Thumbnail)
		S.Quest.tutorialEvent(player, "thumbnail")
		S.Quest.check(player)
		return true, "Miniatura guardada: " .. math.floor(score.Score) .. "/100.", { thumbId = tid, score = score }
	end)

	Net.on("Thumb.Delete", function(player, p)
		local data = S.Data.get(player)
		if type(p.id) ~= "string" or not data.Thumbnails[p.id] then
			return false, "Miniatura no encontrada."
		end
		data.Thumbnails[p.id] = nil
		return true, "Miniatura eliminada."
	end)

	Net.on("Video.Publish", Video.publish)

	Players.PlayerRemoving:Connect(function(player)
		recording[player] = nil
		lastPhoto[player] = nil
		collabRec[player] = nil
	end)
end

function Video.isRecording(player)
	return recording[player] ~= nil
end

return Video
