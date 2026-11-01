--!nonstrict
-- FriendService: amistades con 12 personajes de la ciudad (FriendData). Solo amistad y relación profesional.
--  * Cada personaje está en la acera de su distrito, con su nombre y oficio encima y un aviso «Hablar».
--  * Charlar (1 vez al día por personaje), regalar un objeto de tu inventario (1 al día), pedir favores según el nivel.
--  * Al subir de nivel te escribe un mensaje al teléfono. Si pasas muchos días sin hablar, la amistad se enfría
--    muy despacio (nunca por debajo del nivel 1).
--  * Efectos reales: invitado en tu vídeo (+interés), descuento en su tienda (ShopService), tendencias de mañana,
--    encargos pagados, ofertas de patrocinio, recetas y rutas a lugares secretos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local FriendData = require(Shared.FriendData)
local WorldData = require(Shared.WorldData)
local VideoData = require(Shared.VideoData)
local Catalog = require(Shared.ItemCatalog)
local SponsorData = require(Shared.SponsorData)
local PropertyData = require(Shared.PropertyData)
local Util = require(Shared.Util)

local Friend = {}
local S
local spawned = {} -- id -> { Model, Pos, Prompt }
Friend.Spawned = spawned

local GROUND_TOP = 0.5
local catNames = {}
for _, c in ipairs(Catalog.Categories) do
	catNames[c.Key] = c.Name
end

function Friend.Init(services)
	S = services
end

local function today()
	return S.Time.day()
end

local function friendsOf(data)
	if type(data.Friends) ~= "table" then
		data.Friends = {}
	end
	return data.Friends
end

local function districtName(id)
	local d = WorldData.DistrictById[id or ""]
	return d and d.Name or "la ciudad"
end

-- "v:tech" -> "vídeos de Tecnología"; "g:camera" -> "regalos: Cámaras"
function Friend.likeText(key)
	local kind, id = key:sub(1, 1), key:sub(3)
	if kind == "v" then
		local c = VideoData.CategoryById[id]
		return "vídeos de " .. (c and c.Name or id)
	end
	return "regalos de " .. (catNames[id] or id)
end

local function log(f, text)
	f.Log = f.Log or {}
	table.insert(f.Log, 1, { D = today(), T = text })
	while #f.Log > FriendData.MaxLog do
		table.remove(f.Log)
	end
end

local function newRecord(day)
	return { Pts = 0, Lvl = 1, Met = day, Last = day, Chat = -1, Gift = -1, Talks = 0, Gifts = 0, Known = {}, Favors = {}, Log = {} }
end

local function pick(list, seed)
	return list[(seed % #list) + 1]
end

---------------------------------------------------------------------------
-- Puntos, niveles y enfriamiento
---------------------------------------------------------------------------
local function addPts(player, id, f, n)
	local def = FriendData.ById[id]
	local before = FriendData.levelOf(f.Pts)
	f.Pts = f.Pts + n
	local after = FriendData.levelOf(f.Pts)
	f.Lvl = after
	if after > before then
		local pers = FriendData.Personalities[def.Personality]
		local lvlName = FriendData.Levels[after].Name
		local msg = "📱 " .. def.Name .. ": «" .. string.format(pers.Up, lvlName) .. "»"
		local fav = FriendData.favorAt(def, after)
		if fav then
			msg = msg .. " Ya puedes pedirle: " .. FriendData.FavorKinds[fav.Kind].Name .. "."
		end
		S.Net.notify(player, msg, "gold")
		log(f, "Ahora sois " .. lvlName .. ".")
		S.Quest.check(player)
	end
	S.Data.markDirty(player)
	return after > before
end

local function decay(player, id, f, day)
	local start = (f.Last or day) + FriendData.DecayAfterDays
	if f.DecayDay and f.DecayDay > start then
		start = f.DecayDay
	end
	if day <= start then
		return
	end
	local before = FriendData.levelOf(f.Pts)
	f.Pts = math.max(FriendData.Levels[1].Pts, f.Pts - (day - start) * FriendData.DecayPerDay)
	f.DecayDay = day
	local after = FriendData.levelOf(f.Pts)
	f.Lvl = after
	if after < before then
		local def = FriendData.ById[id]
		S.Net.notify(player, "📱 " .. def.Name .. ": «¡Hace mucho que no hablamos! Pásate por " .. districtName(def.District) .. " cuando puedas.»", "info")
		log(f, "La amistad se ha enfriado un poco (" .. FriendData.Levels[after].Name .. ").")
	end
	S.Data.markDirty(player)
end

-- Aplica el enfriamiento y caduca efectos terminados (descuentos, invitados de vídeos ya publicados).
function Friend.refresh(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local day = today()
	for id, f in pairs(friendsOf(data)) do
		if FriendData.ById[id] and type(f) == "table" then
			f.Pts = tonumber(f.Pts) or 0
			decay(player, id, f, day)
			if f.Discount and f.Discount.Until < day then
				f.Discount = nil
			end
			local g = f.Guest
			if g and g.Pid then
				local proj = data.Projects[g.Pid]
				if not proj or proj.Status == "published" then
					log(f, "Terminó su aparición como invitado (" .. (g.Scenes or 0) .. " escenas juntos).")
					f.Guest = nil
				end
			end
			if f.Tip and f.Tip.Day < day then
				f.Tip = nil
			end
		end
	end
	Friend.updatePlacement()
end

---------------------------------------------------------------------------
-- Personajes en el mundo
---------------------------------------------------------------------------
local function freePosition(d)
	local cx, cz = WorldData.center(d)
	local half = (WorldData.CellSize - WorldData.RoadWidth) / 2 - 3
	local blockers = {}
	local function block(x, z, r)
		blockers[#blockers + 1] = { x, z, r }
	end
	for _, s in ipairs(d.Spots) do
		block(cx + s.X, cz + s.Z, 18)
	end
	for _, sp in ipairs(WorldData.Specials) do
		if sp.District == d.Id then
			block(sp.WX, sp.WZ, (sp.Type == "home" and 80) or (sp.Type == "dealer" and 64) or 55)
		end
	end
	for _, s in ipairs(WorldData.Secrets) do
		if s.District == d.Id then
			block(s.WX, s.WZ, 14)
		end
	end
	local stop = S.Travel.taxiStop(d)
	block(stop.X, stop.Z, 22)
	block(stop.X - 40, stop.Z, 10) -- parada del autobús
	for _, p in ipairs({ { -half, -half / 2 }, { half, half / 2 }, { half / 2, -half }, { -half / 2, half } }) do
		block(cx + p[1], cz + p[2], 8) -- farolas
	end
	block(cx - 92, cz + 112, 18) -- coches aparcados
	if d.Id == "events" then
		block(cx + 90, cz - 90, 40) -- sala VIP
	end
	for _, np in ipairs(S.World.NpcPoints or {}) do
		block(np.Pos.X, np.Pos.Z, 8)
	end
	for _, l in ipairs(PropertyData.Listings or {}) do
		if l.District == d.Id and S.Property and S.Property.signPosition then
			local ok, pos = pcall(S.Property.signPosition, l)
			if ok and pos then
				block(pos.X, pos.Z, 12)
			end
		end
	end
	for _, other in pairs(spawned) do
		block(other.Pos.X, other.Pos.Z, 12)
	end
	local candidates = { { -40, half }, { half, -30 }, { -half, 30 }, { -30, -half }, { 95, half }, { half, 95 }, { -half, -95 }, { 95, -half }, { -95, -half }, { -half, 95 } }
	for _, c in ipairs(candidates) do
		local x, z = cx + c[1], cz + c[2]
		local free = true
		for _, b in ipairs(blockers) do
			if (x - b[1]) ^ 2 + (z - b[2]) ^ 2 < b[3] ^ 2 then
				free = false
				break
			end
		end
		if free and d.Water then
			local wx, wz = cx + d.Water.X, cz + d.Water.Z
			if math.abs(x - wx) <= d.Water.W / 2 + 8 and math.abs(z - wz) <= d.Water.D / 2 + 8 then
				free = false
			end
		end
		if free then
			return Vector3.new(x, GROUND_TOP, z), Vector3.new(cx, GROUND_TOP, cz)
		end
	end
	return Vector3.new(cx - 40, GROUND_TOP, cz + half), Vector3.new(cx, GROUND_TOP, cz)
end

local function label(parent, text, y, h, font, color)
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, h, 0)
	t.Position = UDim2.new(0, 0, y, 0)
	t.BackgroundTransparency = 1
	t.TextColor3 = color
	t.TextStrokeTransparency = 0.4
	t.Font = font
	t.TextScaled = true
	t.Text = text
	t.Parent = parent
	return t
end

local function place(sp, pos, look)
	sp.Pos = pos
	local at = Vector3.new(pos.X, pos.Y + 3, pos.Z)
	sp.Model:PivotTo(CFrame.lookAt(at, Vector3.new(look.X, at.Y, look.Z)))
end

local function spawnFriend(def, parent)
	local d = WorldData.DistrictById[def.District]
	local pos, center = freePosition(d)
	local shirt = Color3.fromRGB(def.Color[1], def.Color[2], def.Color[3])
	local m = S.NPC.makeModel(def.Name, shirt, Color3.fromRGB(45, 45, 60))
	local hum = m:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.NameDisplayDistance = 0 -- el cartel ya muestra nombre y oficio
	end
	m:SetAttribute("FriendId", def.Id)
	m.Parent = parent
	local root = m.PrimaryPart or m:FindFirstChild("HumanoidRootPart")
	local bb = Instance.new("BillboardGui")
	bb.Name = "FriendTag"
	bb.Size = UDim2.fromOffset(220, 48)
	bb.StudsOffset = Vector3.new(0, 4.4, 0)
	bb.MaxDistance = 90
	bb.Parent = root
	label(bb, def.Name, 0, 0.55, Enum.Font.GothamBlack, Color3.new(1, 1, 1))
	label(bb, def.Job, 0.55, 0.45, Enum.Font.GothamBold, Color3.fromRGB(255, 220, 140))
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = "Hablar"
	pp.ObjectText = def.Name
	pp.HoldDuration = 0
	pp.MaxActivationDistance = 10
	pp.RequiresLineOfSight = false
	pp:SetAttribute("Action", "friend")
	pp:SetAttribute("FriendId", def.Id)
	pp.Parent = root
	pp.Triggered:Connect(function(player)
		local ok, err = pcall(Friend.talk, player, def.Id)
		if not ok then
			S.Net.logError("friend", err)
		end
	end)
	local sp = { Model = m, Pos = pos, Home = pos, HomeLook = center, Prompt = pp, Away = false }
	spawned[def.Id] = sp
	place(sp, pos, center)
end

-- Lugar de grabación de su distrito donde espera cuando sale como invitado en un vídeo
function Friend.guestSpot(id)
	local def = FriendData.ById[id or ""]
	local d = def and WorldData.DistrictById[def.District]
	if not d or not d.Spots[1] then
		return nil
	end
	return WorldData.SpotById[d.Id .. "_1"]
end

-- Mientras algún jugador lo tenga invitado, el personaje espera junto al lugar de grabación; si no, vuelve a la acera.
function Friend.updatePlacement()
	local wanted = {}
	for _, player in ipairs(Players:GetPlayers()) do
		local data = S.Data.get(player)
		if data and type(data.Friends) == "table" then
			for id, f in pairs(data.Friends) do
				if type(f) == "table" and f.Guest then
					wanted[id] = true
				end
			end
		end
	end
	for id, sp in pairs(spawned) do
		if wanted[id] and not sp.Away then
			local spot = Friend.guestSpot(id)
			if spot then
				sp.Away = true
				place(sp, Vector3.new(spot.X + 7, GROUND_TOP, spot.Z + 5), Vector3.new(spot.X, GROUND_TOP, spot.Z))
			end
		elseif not wanted[id] and sp.Away then
			sp.Away = false
			place(sp, sp.Home, sp.HomeLook)
		end
	end
end

function Friend.position(id)
	local sp = spawned[id]
	return sp and sp.Pos or nil
end

local function nearFriend(player, id, radius)
	local sp = spawned[id]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not sp or not root then
		return false
	end
	local dx, dz = root.Position.X - sp.Pos.X, root.Position.Z - sp.Pos.Z
	return dx * dx + dz * dz <= radius * radius
end
Friend.near = nearFriend

---------------------------------------------------------------------------
-- Acciones
---------------------------------------------------------------------------
local function greeting(def, f)
	local pers = FriendData.Personalities[def.Personality]
	local lines = pers.Greet[FriendData.tier(FriendData.levelOf(f.Pts))]
	return pick(lines, today() + (f.Talks or 0))
end

-- Aviso «Hablar»: se conocen (si es la primera vez) y aparece el diálogo con opciones.
function Friend.talk(player, id)
	local def = FriendData.ById[id or ""]
	local data = S.Data.get(player)
	if not def or not data then
		return
	end
	Friend.refresh(player)
	local list = friendsOf(data)
	local f = list[id]
	local text
	if not f then
		f = newRecord(today())
		list[id] = f
		log(f, "Os conocisteis en " .. districtName(def.District) .. ".")
		text = greeting(def, f) .. " Me llamo " .. def.Name .. ". " .. def.Bio
	else
		text = greeting(def, f)
	end
	f.Talks = (f.Talks or 0) + 1
	S.Data.markDirty(player)
	S.Net.push(player, "dialog", {
		name = def.Name .. " · " .. def.Job,
		text = text,
		options = {
			{ label = "💬 Charlar", call = "Friend.Chat", payload = { id = id } },
			{ label = "🫂 Amistad", ui = "app", app = "friends", params = { friend = id } },
		},
	})
	return f
end

function Friend.chat(player, id)
	local def = FriendData.ById[id or ""]
	local data = S.Data.get(player)
	if not def then
		return false, "Personaje no válido."
	end
	if not nearFriend(player, id, FriendData.TalkRadius) then
		return false, "Para charlar con " .. def.Name .. " tienes que estar a su lado. Suele estar en " .. districtName(def.District) .. "."
	end
	Friend.refresh(player)
	local list = friendsOf(data)
	local f = list[id]
	if not f then
		f = newRecord(today())
		list[id] = f
		log(f, "Os conocisteis en " .. districtName(def.District) .. ".")
	end
	local day = today()
	if f.Chat == day then
		return false, "Ya habéis charlado hoy. " .. def.Name .. " te espera mañana."
	end
	f.Chat = day
	f.Last = day
	local pers = FriendData.Personalities[def.Personality]
	local text = pick(pers.Chat[FriendData.tier(FriendData.levelOf(f.Pts))], day + #(f.Known or {}))
	-- En cada charla descubres uno de sus gustos
	f.Known = f.Known or {}
	local unknown = {}
	for _, key in ipairs(FriendData.likeKeys(def)) do
		if not Util.indexOf(f.Known, key) then
			unknown[#unknown + 1] = key
		end
	end
	if #unknown > 0 then
		local key = pick(unknown, day)
		table.insert(f.Known, key)
		text = text .. " Por cierto, me encantan los " .. Friend.likeText(key) .. "."
	end
	log(f, "Charlasteis un rato.")
	data.Counters.friend_chats = (data.Counters.friend_chats or 0) + 1
	if S.Needs and S.Needs.change then
		S.Needs.change(player, 0, 2)
	end
	addPts(player, id, f, FriendData.ChatPts)
	return true, "💬 " .. def.Name .. ": «" .. text .. "» (+" .. FriendData.ChatPts .. " amistad)", { pts = f.Pts, level = FriendData.levelOf(f.Pts) }
end

-- Motivo por el que no se puede regalar un objeto (nil = se puede)
function Friend.giftLock(player, uid)
	local data = S.Data.get(player)
	local rec = data and type(uid) == "string" and data.Inventory[uid]
	if not rec then
		return "No tienes ese objeto."
	end
	local item = Catalog.get(rec.Id)
	if not item then
		return "Objeto desconocido."
	end
	if S.Market and S.Market.lockReason then
		local why = S.Market.lockReason(player, uid)
		if why then
			return why
		end
	else
		local loc = rec.Loc or "home"
		if loc:sub(1, 4) == "rig:" or loc:sub(1, 5) == "prop:" or rec.Loan then
			return item.Name .. " está instalado, colocado o prestado."
		end
	end
	if S.Trade and S.Trade.isOffered and S.Trade.isOffered(player, uid) then
		return item.Name .. " está en una oferta de intercambio."
	end
	if data.Equipped.Phone == uid then
		return "Es el teléfono que usas. Equipa otro antes de regalarlo."
	end
	return nil
end

function Friend.gift(player, id, uid)
	local def = FriendData.ById[id or ""]
	local data = S.Data.get(player)
	if not def then
		return false, "Personaje no válido."
	end
	Friend.refresh(player)
	local f = friendsOf(data)[id]
	if not f then
		return false, "Primero preséntate a " .. def.Name .. " (" .. districtName(def.District) .. ")."
	end
	if not nearFriend(player, id, FriendData.TalkRadius) then
		return false, "Los regalos se dan en persona: ve a ver a " .. def.Name .. " en " .. districtName(def.District) .. "."
	end
	local day = today()
	if f.Gift == day then
		return false, "Ya le has hecho un regalo hoy a " .. def.Name .. ". ¡Mañana más!"
	end
	local why = Friend.giftLock(player, uid)
	if why then
		return false, why
	end
	local rec = data.Inventory[uid]
	local item = Catalog.get(rec.Id)
	local pts = FriendData.GiftBase + math.min(FriendData.GiftValueMax, math.floor((item.Price or 0) / 25))
	local pers = FriendData.Personalities[def.Personality]
	local reaction = pers.Neutral
	local liked = Util.indexOf(def.Gifts, item.Cat) ~= nil
	if liked then
		pts = pts * 2 + FriendData.GiftLikedBonus
		reaction = pers.Liked
		f.Known = f.Known or {}
		if not Util.indexOf(f.Known, "g:" .. item.Cat) then
			table.insert(f.Known, "g:" .. item.Cat)
		end
	elseif item.Cat == def.Dislike then
		pts = math.max(2, math.floor(pts / 2))
		reaction = "Gracias... aunque no es mucho lo mío. ¡Lo que cuenta es el detalle!"
	end
	if item.Collectible then
		pts = pts + 6
	end
	S.Inventory.remove(player, uid)
	f.Gift = day
	f.Last = day
	f.Gifts = (f.Gifts or 0) + 1
	data.Counters.gifts_given = (data.Counters.gifts_given or 0) + 1
	log(f, "Le regalaste " .. item.Name .. (liked and " (¡le encantó!)" or "") .. ".")
	addPts(player, id, f, pts)
	S.Quest.check(player)
	return true, "🎁 " .. def.Name .. ": «" .. reaction .. "» (+" .. pts .. " amistad)", { pts = f.Pts, gained = pts, liked = liked }
end

---------------------------------------------------------------------------
-- Favores
---------------------------------------------------------------------------
local favorHandlers = {}

function favorHandlers.trend(player, data, def, f)
	local hot = S.Channel.trendsFor(today() + 1)
	local names = {}
	for _, id in ipairs(hot) do
		local c = VideoData.CategoryById[id]
		names[#names + 1] = c and c.Name or id
	end
	f.Tip = { Day = today() + 1, Hot = hot }
	return true, "🔥 " .. def.Name .. ": «Me han chivado que mañana serán tendencia: " .. table.concat(names, ", ") .. ".» Prepara tu idea con tiempo."
end

function favorHandlers.guest(player, data, def, f)
	if f.Guest then
		local spot = Friend.guestSpot(def.Id)
		return false, def.Name .. " ya va a salir en tu próximo vídeo: te espera en " .. (spot and spot.Name or districtName(def.District)) .. "."
	end
	local spot = Friend.guestSpot(def.Id)
	if not spot then
		return false, "Hoy no puede salir en vídeos."
	end
	f.Guest = { Day = today(), Scenes = 0 }
	Friend.updatePlacement()
	return true, "🎬 " .. def.Name .. " saldrá en tu próximo vídeo: te espera en " .. spot.Name .. " (" .. districtName(def.District) .. "). Graba allí a su lado: +" .. FriendData.GuestInterest .. " de interés por escena."
end

function favorHandlers.discount(player, data, def, f, fav)
	local store = Catalog.Stores[fav.Store]
	f.Discount = { Store = fav.Store, Pct = fav.Pct, Until = today() + fav.Days }
	return true, "🏷 " .. def.Name .. " te consigue un " .. fav.Pct .. "% de descuento en " .. (store and store.Name or fav.Store) .. " durante " .. fav.Days .. " días (también en pedidos online)."
end

function favorHandlers.commission(player, data, def, f, fav)
	local spot = WorldData.SpotById[fav.Spot]
	if not spot then
		return false, "Ahora mismo no tiene ningún encargo."
	end
	if f.Task then
		return false, "Ya tienes su encargo pendiente: graba una escena en " .. spot.Name .. "."
	end
	f.Task = { Spot = spot.Id, Reward = fav.Reward, Day = today() }
	return true, "📦 Encargo de " .. def.Name .. ": graba una escena en " .. spot.Name .. " (" .. districtName(spot.District) .. ") y te pagará $" .. fav.Reward .. "."
end

function favorHandlers.sponsor(player, data, def, f, fav)
	local brand = SponsorData.BrandById[fav.Brand]
	if not brand or not S.Sponsor then
		return false, "Ahora mismo no conoce a ninguna marca."
	end
	pcall(S.Sponsor.refreshOffers, player) -- así la oferta nueva no se pierde al renovar las del día
	local sp = S.Sponsor.state(data)
	for _, o in ipairs(sp.Offers) do
		if o.Intro then
			return false, "Ya tienes una oferta presentada por un amigo en la app Patrocinios. Respóndela primero."
		end
	end
	local subs = data.Channel.Subs or 0
	local pay = (120 + 6 * math.sqrt(subs)) * (1 + (data.Reputation or 0) / 100) * FriendData.SponsorPayBonus
	sp.Seq = (sp.Seq or 0) + 1
	local cat = brand.Cats[(today() % #brand.Cats) + 1]
	table.insert(sp.Offers, 1, {
		Id = "o" .. sp.Seq,
		Brand = brand.Id,
		Kind = "campaign",
		Category = cat,
		MinQ = math.floor(math.min(70, 30 + math.sqrt(subs) * 0.25)),
		Days = 4,
		Pay = math.floor(pay / 5) * 5,
		Bonus = math.floor(pay * 0.3 / 5) * 5,
		Intro = def.Name,
	})
	local c = VideoData.CategoryById[cat]
	return true, "🤝 " .. def.Name .. " te presenta a " .. brand.Name .. ": tienes una oferta de patrocinio (" .. (c and c.Name or cat) .. ", $" .. math.floor(pay / 5) * 5 .. ") en la app Patrocinios."
end

function favorHandlers.recipe(player, data, def, f, fav)
	local item = Catalog.get(fav.Recipe)
	if not item then
		return false, "Hoy no tiene ninguna receta a mano."
	end
	local learned = false
	if type(data.Recipes) == "table" and not data.Recipes[fav.Recipe] then
		data.Recipes[fav.Recipe] = true
		learned = true
	end
	local uid, err = S.Inventory.add(player, fav.Recipe, { src = "gift", paid = 0, loc = "home" })
	if not uid then
		return false, err or "No tienes sitio para recibirlo."
	end
	f.Recipes = f.Recipes or {}
	if not Util.indexOf(f.Recipes, fav.Recipe) then
		table.insert(f.Recipes, fav.Recipe)
	end
	return true, "👨‍🍳 " .. def.Name .. " te enseña su receta de " .. item.Name .. (learned and " (receta desbloqueada)" or "") .. " y te regala una ración. Está en tu despensa."
end

function favorHandlers.route(player, data, def, f)
	if data.Trip and data.Trip.At and data.Trip.At ~= "" then
		return false, "Estás de viaje. Pídeselo cuando vuelvas a la ciudad."
	end
	-- Primero un secreto de su distrito; si no, el primero que aún no conozcas
	local target
	for _, s in ipairs(WorldData.Secrets) do
		if not data.Visited.Secrets[s.Id] and (not target or (s.District == def.District and target.District ~= def.District)) then
			target = s
		end
	end
	if not target then
		return false, "«¡Ya conoces todos mis rincones secretos!» No quedan lugares secretos por descubrir."
	end
	local cx, cz = WorldData.center(WorldData.DistrictById[target.District])
	local dx, dz = cx - target.WX, cz - target.WZ
	local len = math.sqrt(dx * dx + dz * dz)
	if len < 0.1 then
		dx, dz, len = 1, 0, 1
	end
	local pos = Vector3.new(target.WX + dx / len * 32, 4, target.WZ + dz / len * 32)
	if not S.Travel.teleport(player, pos) then
		return false, "No puedes viajar ahora."
	end
	f.Route = target.Id
	return true, "🧭 " .. def.Name .. " te lleva por una ruta secreta hasta " .. districtName(target.District) .. ": «" .. target.Hint .. "» Camina un poco hacia el destello dorado."
end

function Friend.favor(player, id, level)
	local def = FriendData.ById[id or ""]
	local data = S.Data.get(player)
	if not def then
		return false, "Personaje no válido."
	end
	Friend.refresh(player)
	local f = friendsOf(data)[id]
	if not f then
		return false, "Primero preséntate a " .. def.Name .. " (" .. districtName(def.District) .. ")."
	end
	local fav = FriendData.favorAt(def, math.floor(tonumber(level) or 0))
	if not fav then
		return false, "Ese favor no existe."
	end
	local kind = FriendData.FavorKinds[fav.Kind]
	if FriendData.levelOf(f.Pts) < fav.Level then
		return false, "Necesitáis ser «" .. FriendData.Levels[fav.Level].Name .. "» para pedirle: " .. kind.Name .. "."
	end
	local key = "L" .. fav.Level
	f.Favors = f.Favors or {}
	local last = f.Favors[key]
	local day = today()
	if last and day - last < kind.Cooldown then
		local wait = kind.Cooldown - (day - last)
		return false, def.Name .. " ya te ayudó con eso hace poco. Vuelve a pedírselo en " .. wait .. (wait == 1 and " día." or " días.")
	end
	local ok, msg = favorHandlers[fav.Kind](player, data, def, f, fav)
	if not ok then
		return false, msg
	end
	f.Favors[key] = day
	f.Last = day
	data.Counters.friend_favors = (data.Counters.friend_favors or 0) + 1
	log(f, "Favor: " .. kind.Name .. ".")
	S.Data.markDirty(player)
	return true, msg
end

---------------------------------------------------------------------------
-- Ganchos con otros servicios
---------------------------------------------------------------------------
-- Interés extra de una escena si grabas con tu invitado cerca (VideoService)
function Friend.interestBonus(player, pid)
	local data = S.Data.get(player)
	if not data or type(data.Friends) ~= "table" then
		return 0
	end
	for id, f in pairs(data.Friends) do
		local g = f.Guest
		if g and (g.Pid == nil or g.Pid == pid) and nearFriend(player, id, FriendData.GuestRadius) then
			return FriendData.GuestInterest
		end
	end
	return 0
end

-- Tras grabar una escena: el invitado queda ligado a ese vídeo y se completan encargos
function Friend.onScene(player, scene, pid)
	local data = S.Data.get(player)
	if not data or type(data.Friends) ~= "table" then
		return
	end
	for id, f in pairs(data.Friends) do
		local def = FriendData.ById[id]
		if def then
			local g = f.Guest
			if g and (g.Pid == nil or g.Pid == pid) and nearFriend(player, id, FriendData.GuestRadius) then
				g.Pid = pid
				g.Scenes = (g.Scenes or 0) + 1
				scene.Guest = def.Name
			end
			if f.Task and scene.Spot == f.Task.Spot then
				local reward = f.Task.Reward or 0
				f.Task = nil
				S.Economy.add(player, reward, "Encargos", "Encargo de " .. def.Name, { taxable = true })
				data.Counters.friend_tasks = (data.Counters.friend_tasks or 0) + 1
				log(f, "Completaste su encargo (+$" .. reward .. ").")
				S.Net.notify(player, "📱 " .. def.Name .. ": «¡Encargo recibido, gracias!» +$" .. reward, "success")
				addPts(player, id, f, 10)
			end
		end
	end
end

-- Descuento (0-1) que un amigo te consigue en la tienda que vende este objeto (ShopService)
function Friend.discountFor(player, item)
	local data = S.Data.get(player)
	if not data or type(data.Friends) ~= "table" or not item or not item.Stores then
		return 0
	end
	local best, day = 0, today()
	for _, f in pairs(data.Friends) do
		local dsc = f.Discount
		if dsc and dsc.Until >= day and Util.indexOf(item.Stores, dsc.Store) then
			best = math.max(best, (dsc.Pct or 0) / 100)
		end
	end
	return Util.clamp(best, 0, 0.5)
end

function Friend.Start()
	local Net = S.Net
	local city = workspace:FindFirstChild("City") or workspace
	local folder = Instance.new("Folder")
	folder.Name = "Friends"
	folder.Parent = city
	for _, def in ipairs(FriendData.Friends) do
		local ok, err = pcall(spawnFriend, def, folder)
		if not ok then
			Net.logError("friend spawn " .. def.Id, err)
		end
	end

	Net.on("Friend.Chat", function(player, p)
		return Friend.chat(player, type(p) == "table" and p.id or nil)
	end)
	Net.on("Friend.Gift", function(player, p)
		p = type(p) == "table" and p or {}
		return Friend.gift(player, p.id, p.uid)
	end)
	Net.on("Friend.Favor", function(player, p)
		p = type(p) == "table" and p or {}
		return Friend.favor(player, p.id, p.level)
	end)

	-- Enfriamiento y caducidad de efectos, sin prisa
	task.spawn(function()
		while true do
			task.wait(15)
			for _, player in ipairs(Players:GetPlayers()) do
				pcall(Friend.refresh, player)
			end
		end
	end)
end

return Friend
