--!nonstrict
-- StudioService: Complejo de Estudios Prisma (Distrito de estudios de grabación).
--  * 6 platós especializados (gaming, música, cocina, podcast, croma y fotografía) alquilables en la
--    recepción por bloques de 1 hora de juego. Un plató solo puede tenerlo un jugador a la vez en el servidor.
--  * Al alquilar te lleva dentro; puedes salir y volver a entrar (desde la recepción) mientras dure el alquiler,
--    ampliar 1 hora (hasta StudioData.MaxHours pendientes). Avisa 5 minutos de juego antes del final y,
--    al acabar, te devuelve a la recepción.
--  * Mientras tienes el alquiler activo y estás dentro: el plató es tu lugar de grabación (Tags/Interest propios),
--    +luz de plató, +calidad de escena (sceneBonus) y +calidad de fotos (photoBonus).
--  * Croma: eliges un «fondo» (categoría de vídeo) y las Tags de la escena pasan a ser las de esa categoría.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local StudioData = require(Shared.StudioData)
local VideoData = require(Shared.VideoData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)

local Studio = {}
local S
local occupant = {} -- [setId] = player

function Studio.Init(services)
	S = services
end

local function lobby()
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == "studios" then
			return sp
		end
	end
	return nil
end

local function rootOf(player)
	return player.Character and player.Character:FindFirstChild("HumanoidRootPart")
end

local function rec(data)
	if type(data.Studio) ~= "table" then
		data.Studio = { Set = "", Ends = 0, Warned = false, Bg = StudioData.DefaultBackdrop }
	end
	return data.Studio
end

-- Punto de la recepción (dentro del vestíbulo, delante del mostrador)
function Studio.lobbyPosition()
	local sp = lobby()
	if not sp then
		return Vector3.new(0, 1, 0)
	end
	return Vector3.new(sp.WX, 1, sp.WZ + 6)
end

-- Punto de entrada de un plató (junto a la puerta de salida)
function Studio.setPosition(set)
	return Vector3.new(set.OX, 1, set.OZ + StudioData.SetSize.D / 2 - 6)
end

function Studio.atDesk(player)
	return S.World.nearSpecial(player, "studios", StudioData.DeskRadius) ~= nil
end

-- Plató en el que está físicamente el jugador (con o sin alquiler)
function Studio.insideSet(player)
	local root = rootOf(player)
	if not root then
		return nil
	end
	local pos = root.Position
	local half = StudioData.SetSize
	for _, set in ipairs(StudioData.Sets) do
		if math.abs(pos.X - set.OX) <= half.W / 2 + 2 and math.abs(pos.Z - set.OZ) <= half.D / 2 + 2 and pos.Y > -5 and pos.Y < 30 then
			return set
		end
	end
	return nil
end

-- Alquiler activo (valida que el plató sigue siendo tuyo en este servidor)
function Studio.rental(player)
	local data = S.Data.get(player)
	if not data then
		return nil
	end
	local r = rec(data)
	if r.Set == "" then
		return nil
	end
	local set = StudioData.ById[r.Set]
	local occ = occupant[r.Set]
	if not set or (occ and occ ~= player and occ.Parent) then
		-- otro jugador lo tiene en este servidor: tu alquiler anterior no sigue aquí
		r.Set, r.Ends, r.Warned = "", 0, false
		return nil
	end
	if os.time() >= r.Ends then
		return nil -- caducado: el bucle lo cierra y avisa
	end
	occupant[r.Set] = player
	return set, r, data
end

-- Plató alquilado en el que estás ahora mismo (alquiler activo + dentro)
function Studio.current(player)
	local set = Studio.rental(player)
	if not set then
		return nil
	end
	local here = Studio.insideSet(player)
	if here and here.Id == set.Id then
		return set
	end
	return nil
end

function Studio.sceneBonus(player)
	local set = Studio.current(player)
	return set and set.Scene or 0
end

function Studio.photoBonus(player)
	local set = Studio.current(player)
	return set and set.Photo or 0
end

local function backdropOf(data)
	local cat = VideoData.CategoryById[rec(data).Bg or ""] or VideoData.CategoryById[StudioData.DefaultBackdrop]
	return cat
end

-- Lugar de grabación del plató (solo con alquiler activo y estando dentro)
function Studio.spot(player)
	local set = Studio.current(player)
	if not set then
		return nil
	end
	local data = S.Data.get(player)
	local tags, name = {}, set.Name
	if set.Chroma then
		local cat = backdropOf(data)
		for _, t in ipairs(cat.Tags) do
			tags[#tags + 1] = t
		end
		name = set.Name .. " (fondo: " .. cat.Name .. ")"
	else
		for _, t in ipairs(set.Tags) do
			tags[#tags + 1] = t
		end
	end
	return {
		Id = "studio_" .. set.Id,
		Name = name,
		Tags = tags,
		Indoor = true,
		Interest = set.Interest,
		Noise = set.Noise,
		Busy = 0,
		Decor = set.Decor,
		StudioLight = set.Light,
		District = "studios",
		Studio = set.Id,
	}
end

local function freeIn(set, player)
	local occ = occupant[set.Id]
	if not occ or occ == player or not occ.Parent then
		return 0
	end
	local d = S.Data.get(occ)
	local r = d and rec(d)
	if not r or r.Set ~= set.Id then
		return 0
	end
	return math.max(0, r.Ends - os.time())
end

-- Vista para el cliente (Derived.Studio)
function Studio.view(player)
	local data = S.Data.get(player)
	if not data then
		return nil
	end
	local set, r = Studio.rental(player)
	local sets = {}
	for _, s in ipairs(StudioData.Sets) do
		local wait = freeIn(s, player)
		sets[#sets + 1] = { Id = s.Id, Free = wait <= 0, FreeIn = wait }
	end
	local here = Studio.current(player)
	return {
		Set = set and set.Id or "",
		Ends = r and r.Ends or 0,
		Left = r and math.max(0, r.Ends - os.time()) or 0,
		Inside = here ~= nil,
		AtDesk = Studio.atDesk(player),
		Bg = rec(data).Bg,
		Sets = sets,
	}
end

local function updateChromaMonitor(data)
	local info = S.World.StudioSets and S.World.StudioSets.chroma
	if info and info.Monitor then
		info.Monitor.Text = "FONDO: " .. backdropOf(data).Name
	end
end

-- Fin del alquiler (caducado o liberado)
function Studio.finish(player, reason)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local r = rec(data)
	local set = StudioData.ById[r.Set]
	if not set then
		r.Set, r.Ends, r.Warned = "", 0, false
		return
	end
	local here = Studio.insideSet(player)
	r.Set, r.Ends, r.Warned = "", 0, false
	if occupant[set.Id] == player then
		occupant[set.Id] = nil
	end
	if here and here.Id == set.Id then
		S.Travel.teleport(player, Studio.lobbyPosition(), "🎛 Recepción de Prisma")
	end
	if reason == "expired" then
		S.Net.notify(player, "⌛ Se acabó tu tiempo en el " .. set.Name .. ". ¡Gracias por grabar en Prisma!", "info")
	end
	S.Data.markDirty(player)
end

-- Bucle: aviso 5 minutos de juego antes y cierre al acabar
function Studio.tick()
	local now = os.time()
	for _, player in ipairs(Players:GetPlayers()) do
		local data = S.Data.get(player)
		if data and type(data.Studio) == "table" and data.Studio.Set ~= "" then
			local r = data.Studio
			local left = r.Ends - now
			if left <= 0 then
				Studio.finish(player, "expired")
			elseif left <= StudioData.WarnSeconds and not r.Warned then
				r.Warned = true
				local set = StudioData.ById[r.Set]
				S.Net.notify(player, "⏳ Tu alquiler del " .. (set and set.Name or "plató") .. " termina en 5 minutos. Amplíalo en la app Estudios.", "warn")
			end
		end
	end
	for id, p in pairs(occupant) do
		if not p.Parent then
			occupant[id] = nil
		end
	end
end

-- Salir del plató (puerta o app): el alquiler sigue corriendo
function Studio.leave(player)
	local here = Studio.insideSet(player)
	if not here then
		return false, "No estás en ningún plató."
	end
	S.Travel.teleport(player, Studio.lobbyPosition(), "🎛 Recepción de Prisma")
	local set, r = Studio.rental(player)
	if set then
		return true, "Has salido del " .. set.Name .. ". Tu alquiler sigue: vuelve desde la recepción (quedan " .. StudioData.gameMinutes(r.Ends - os.time()) .. " min)."
	end
	return true, "Has vuelto a la recepción."
end

function Studio.Start()
	local Net = S.Net

	Net.on("Studio.Rent", function(player, p)
		p = type(p) == "table" and p or {}
		local set = StudioData.ById[p.set or ""]
		if not set then
			return false, "Elige un plató."
		end
		local hours = math.floor(tonumber(p.hours) or 1)
		if hours ~= hours or hours < 1 or hours > StudioData.MaxHours then
			return false, "Puedes alquilar de 1 a " .. StudioData.MaxHours .. " horas."
		end
		if not Studio.atDesk(player) then
			return false, "Los platós se alquilan en la recepción del " .. StudioData.Name .. " (Distrito de estudios de grabación)."
		end
		local data = S.Data.get(player)
		local cur = Studio.rental(player)
		if cur then
			return false, "Ya tienes alquilado el " .. cur.Name .. ". Amplíalo o espera a que termine."
		end
		if data.Level < set.Level then
			return false, "El " .. set.Name .. " requiere nivel " .. set.Level .. "."
		end
		local wait = freeIn(set, player)
		if wait > 0 then
			return false, "El " .. set.Name .. " está ocupado. Quedará libre en " .. StudioData.gameMinutes(wait) .. " min de juego."
		end
		local price = StudioData.price(set, hours)
		if not S.Economy.spend(player, price, "Estudios", "Alquiler del " .. set.Name .. " (" .. hours .. " h)") then
			return false, "Necesitas $" .. price .. " para alquilar el " .. set.Name .. "."
		end
		local r = rec(data)
		r.Set, r.Ends, r.Warned = set.Id, os.time() + hours * StudioData.HourSeconds, false
		occupant[set.Id] = player
		data.Counters.studio_rentals = (data.Counters.studio_rentals or 0) + 1
		data.Counters.studio_hours = (data.Counters.studio_hours or 0) + hours
		if set.Chroma then
			updateChromaMonitor(data)
		end
		S.Travel.teleport(player, Studio.setPosition(set), set.Icon .. " " .. set.Name)
		S.Progress.addXp(player, 10)
		S.Quest.check(player)
		S.Data.markDirty(player)
		return true, set.Icon .. " ¡" .. set.Name .. " alquilado " .. hours .. " h por $" .. price .. "! +" .. set.Scene .. " calidad de escena mientras grabes dentro.", { set = set.Id, ends = r.Ends }
	end)

	Net.on("Studio.Extend", function(player)
		local set, r = Studio.rental(player)
		if not set then
			return false, "No tienes ningún plató alquilado."
		end
		if not Studio.atDesk(player) and not Studio.current(player) then
			return false, "Amplía el alquiler desde el plató o la recepción."
		end
		if (r.Ends - os.time()) + StudioData.HourSeconds > StudioData.MaxHours * StudioData.HourSeconds + 1 then
			return false, "Como máximo puedes tener " .. StudioData.MaxHours .. " horas pendientes."
		end
		if not S.Economy.spend(player, set.Price, "Estudios", "Ampliación del " .. set.Name .. " (1 h)") then
			return false, "Necesitas $" .. set.Price .. " para ampliar 1 hora."
		end
		r.Ends = r.Ends + StudioData.HourSeconds
		r.Warned = false
		local data = S.Data.get(player)
		data.Counters.studio_hours = (data.Counters.studio_hours or 0) + 1
		S.Data.markDirty(player)
		return true, "⏱ +1 hora en el " .. set.Name .. " ($" .. set.Price .. "). Quedan " .. StudioData.gameMinutes(r.Ends - os.time()) .. " min.", { ends = r.Ends }
	end)

	Net.on("Studio.Enter", function(player)
		local set = Studio.rental(player)
		if not set then
			return false, "No tienes ningún plató alquilado."
		end
		if not Studio.atDesk(player) then
			return false, "Vuelve a entrar desde la recepción del " .. StudioData.Name .. "."
		end
		S.Travel.teleport(player, Studio.setPosition(set), set.Icon .. " " .. set.Name)
		return true, "Entras en el " .. set.Name .. "."
	end)

	Net.on("Studio.Leave", function(player)
		return Studio.leave(player)
	end)

	Net.on("Studio.SetBackdrop", function(player, p)
		p = type(p) == "table" and p or {}
		local set = Studio.rental(player)
		if not set or not set.Chroma then
			return false, "Necesitas el Plató Croma alquilado para cambiar el fondo."
		end
		local cat = VideoData.CategoryById[p.category or ""]
		if not cat then
			return false, "Fondo no válido."
		end
		local data = S.Data.get(player)
		rec(data).Bg = cat.Id
		updateChromaMonitor(data)
		S.Data.markDirty(player)
		return true, "🟩 Fondo del croma: " .. cat.Name .. ". Tus escenas aquí cuentan como «" .. cat.Name .. "».", { bg = cat.Id }
	end)

	Players.PlayerRemoving:Connect(function(player)
		for id, p in pairs(occupant) do
			if p == player then
				occupant[id] = nil
			end
		end
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			local ok, err = pcall(Studio.tick)
			if not ok then
				S.Net.logError("StudioTick", err)
			end
		end
	end)
end

return Studio
