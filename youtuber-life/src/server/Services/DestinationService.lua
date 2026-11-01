--!nonstrict
-- DestinationService: viajes y turismo a destinos desbloqueables (LifeData.Destinations).
--  * Vuelos desde el mostrador de la Terminal Internacional (Aeropuerto). El servidor comprueba la cercanía,
--    el coste (ida y vuelta), el nivel y la invitación (rango de creador o un patrocinio activo).
--  * Llegada a la zona del destino (lejos de la ciudad). Sus lugares 🎥 están en WorldData.Spots.
--  * Hotel opcional (recupera energía y ánimo), tienda exclusiva (objetos Exclusive del destino, solo allí)
--    y vuelo de vuelta al aeropuerto.
--  * Registra data.Visited.Destinations, data.Trip (dónde está, para el cliente) y contadores
--    (flights, hotel_nights, exclusives_bought).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local LifeData = require(Shared.LifeData)
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local Progression = require(Shared.Progression)
local Util = require(Shared.Util)

local Dest = {}
local S
local lastFlight = {}
local lastHotel = {}
local tripChanged = {}

Dest.CounterRadius = 35 -- distancia máxima al centro de la terminal para facturar
Dest.HotelCooldown = 90 -- segundos reales entre noches de hotel
Dest.FlightEnergy = 6 -- volar cansa un poco
Dest.FirstVisitXp = 60

function Dest.Init(services)
	S = services
end

local function rootOf(player)
	return player.Character and player.Character:FindFirstChild("HumanoidRootPart")
end

-- Destino en el que está el jugador ahora mismo (por posición) o nil si está en la ciudad
function Dest.at(player)
	local root = rootOf(player)
	if not root then
		return nil
	end
	return LifeData.destinationAt(root.Position.X, root.Position.Z)
end

function Dest.airport()
	for _, sp in ipairs(WorldData.Specials) do
		if sp.Type == "airport" then
			return sp
		end
	end
	return nil
end

-- Dentro de la terminal, delante del mostrador (llegada de los vuelos de vuelta y del taxi)
function Dest.airportArrival()
	local sp = Dest.airport()
	return Vector3.new(sp.WX, 4, sp.WZ + 6)
end

function Dest.atAirport(player)
	return S.World.nearSpecial(player, "airport", Dest.CounterRadius) ~= nil
end

function Dest.arrivalPoint(d)
	local a = LifeData.DestLayout.Arrival
	return Vector3.new(d.Center[1] + a[1], 4, d.Center[2] + a[2])
end

local function hasSponsor(data)
	return type(data.Sponsors) == "table" and next(data.Sponsors.Active or {}) ~= nil
end

-- ¿Puede volar a este destino? Devuelve ok, motivo
function Dest.check(data, d)
	local req = d.Req or {}
	if data.Level < (req.Level or 1) then
		return false, "Necesitas nivel " .. req.Level .. " para volar a " .. d.Name .. "."
	end
	if req.Rank then
		local rank = S.Progress.rank(data)
		if rank < req.Rank and not hasSponsor(data) then
			local r = Progression.Ranks[req.Rank]
			return false, d.Name .. " es solo con invitación: necesitas el rango «" .. (r and r.Name or tostring(req.Rank)) .. "» o un contrato de patrocinio activo."
		end
	end
	return true
end

local function setTrip(player, data, destId)
	data.Trip = data.Trip or { At = "", Since = 0 }
	data.Trip.At = destId or ""
	data.Trip.Since = os.time()
	tripChanged[player] = os.clock()
	S.Data.markDirty(player)
end

function Dest.fly(player, destId)
	local data = S.Data.get(player)
	local d = LifeData.DestById[type(destId) == "string" and destId or ""]
	if not d then
		return false, "Destino no válido."
	end
	if not rootOf(player) then
		return false, "No puedes viajar ahora."
	end
	local here = Dest.at(player)
	if here then
		return false, "Ya estás de viaje en " .. here.Name .. ". Vuelve primero desde la puerta de embarque."
	end
	if not Dest.atAirport(player) then
		return false, "Los vuelos salen del mostrador de la Terminal Internacional (Aeropuerto). Ve allí o pide un taxi desde la app Viajes."
	end
	local ok, why = Dest.check(data, d)
	if not ok then
		return false, why
	end
	if lastFlight[player] and os.clock() - lastFlight[player] < 3 then
		return false, "Espera un momento antes de volver a volar."
	end
	if not S.Economy.spend(player, d.Cost, "Viajes", "Vuelo a " .. d.Name) then
		return false, "El billete a " .. d.Name .. " cuesta $" .. Util.formatInt(d.Cost) .. " (ida y vuelta)."
	end
	lastFlight[player] = os.clock()
	local first = not data.Visited.Destinations[d.Id]
	data.Visited.Destinations[d.Id] = true
	data.Counters.flights = (data.Counters.flights or 0) + 1
	setTrip(player, data, d.Id)
	if S.Needs then
		S.Needs.spend(player, Dest.FlightEnergy)
	end
	S.Travel.teleport(player, Dest.arrivalPoint(d), "✈️ Volando a " .. d.Name .. "...")
	if first then
		S.Progress.addXp(player, Dest.FirstVisitXp)
		S.Net.notify(player, "🌍 ¡Nuevo destino descubierto: " .. d.Name .. "!", "gold")
	end
	S.Quest.check(player)
	return true, "✈️ Vuelo a " .. d.Name .. " ($" .. Util.formatInt(d.Cost) .. ", ida y vuelta). Busca los lugares 🎥, la tienda exclusiva y el hotel.", { dest = d.Id }
end

function Dest.goBack(player)
	local data = S.Data.get(player)
	local d = Dest.at(player)
	if not d then
		return false, "No estás de viaje: los vuelos de vuelta salen de la puerta de embarque de cada destino."
	end
	if lastFlight[player] and os.clock() - lastFlight[player] < 3 then
		return false, "Espera un momento antes de volver a volar."
	end
	lastFlight[player] = os.clock()
	setTrip(player, data, "")
	S.Travel.teleport(player, Dest.airportArrival(), "✈️ Volando de vuelta a la ciudad...")
	return true, "🛬 Has vuelto de " .. d.Name .. " a la Terminal Internacional."
end

function Dest.hotel(player)
	local data = S.Data.get(player)
	local d = Dest.at(player)
	if not d then
		return false, "Los hoteles de viaje están en los destinos."
	end
	if not S.Needs then
		return false, "El hotel está completo."
	end
	local h = d.Hotel
	if lastHotel[player] and os.clock() - lastHotel[player] < Dest.HotelCooldown then
		return false, "Acabas de descansar en el hotel. Sal a grabar un rato."
	end
	if not S.Economy.spend(player, h.Price, "Viajes", "Hotel: " .. h.Name) then
		return false, "Una noche en " .. h.Name .. " cuesta $" .. Util.formatInt(h.Price) .. "."
	end
	lastHotel[player] = os.clock()
	S.Needs.change(player, h.Energy, h.Mood)
	data.Counters.hotel_nights = (data.Counters.hotel_nights or 0) + 1
	S.Quest.check(player)
	return true, "🏨 Noche en " .. h.Name .. ": energía +" .. h.Energy .. ", ánimo +" .. h.Mood .. " ($" .. Util.formatInt(h.Price) .. ")."
end

local function rememberNonce(data, nonce, result)
	data.Processed[nonce] = result
	table.insert(data.ProcessedOrder, nonce)
	while #data.ProcessedOrder > 40 do
		local old = table.remove(data.ProcessedOrder, 1)
		data.Processed[old] = nil
	end
end

function Dest.buy(player, p)
	local data = S.Data.get(player)
	local nonce = p.nonce
	if type(nonce) ~= "string" or #nonce < 6 or #nonce > 40 then
		return false, "Petición de compra no válida."
	end
	if data.Processed[nonce] then
		return true, "Compra ya registrada (no se ha cobrado dos veces).", data.Processed[nonce]
	end
	local def = Catalog.get(type(p.item) == "string" and p.item or "")
	if not def or not def.Exclusive then
		return false, "Ese producto no es un exclusivo de viaje."
	end
	local origin = LifeData.DestById[def.Exclusive]
	local here = Dest.at(player)
	if not here or here.Id ~= def.Exclusive then
		return false, def.Name .. " solo se vende en " .. (origin and origin.Name or "su destino") .. ". Tienes que estar allí."
	end
	if data.Level < (def.Req.Level or 1) then
		return false, "Necesitas nivel " .. def.Req.Level .. " para comprar " .. def.Name .. "."
	end
	if Util.count(data.Inventory) >= S.Inventory.MaxItems then
		return false, "Tu inventario está lleno. Vende algo primero."
	end
	local fits = def.Portable and S.Inventory.canFit(player, def)
	if not fits and not S.Property.canStore(player, 1) then
		return false, "No cabe en tu mochila y tu vivienda está llena. Haz sitio antes de comprar."
	end
	if not S.Economy.spend(player, def.Price, "Viajes", def.Name .. " (" .. here.Name .. ")") then
		return false, "No tienes suficiente dinero ($" .. Util.formatInt(def.Price) .. ")."
	end
	local uid, loc = S.Inventory.add(player, def.Id, { src = "travel", paid = def.Price, loc = "backpack" })
	if not uid then
		S.Economy.add(player, def.Price, "Viajes", "Reembolso: " .. def.Name, { silent = true })
		return false, "No se pudo entregar el producto. Se te ha devuelto el dinero."
	end
	data.Counters.exclusives_bought = (data.Counters.exclusives_bought or 0) + 1
	local result = { itemId = def.Id, uid = uid, loc = loc }
	rememberNonce(data, nonce, result)
	S.Shop.afterPurchase(player, 1, def.Price)
	return true, "🛍 Compraste " .. def.Name .. " por $" .. Util.formatInt(def.Price) .. ". "
		.. (loc == "backpack" and "Está en tu mochila." or "No cabía en la mochila: te lo envían a casa."), result
end

function Dest.Start()
	local Net = S.Net

	Net.on("Destination.Fly", function(player, p)
		return Dest.fly(player, p.dest)
	end)
	Net.on("Destination.Return", function(player)
		return Dest.goBack(player)
	end)
	Net.on("Destination.Hotel", function(player)
		return Dest.hotel(player)
	end)
	Net.on("Destination.Buy", function(player, p)
		return Dest.buy(player, p)
	end)
	Net.on("Destination.Taxi", function(player)
		if Dest.at(player) then
			return false, "Estás de viaje: vuelve en avión desde la puerta de embarque."
		end
		if Dest.atAirport(player) then
			return false, "Ya estás en la Terminal Internacional."
		end
		return S.Travel.taxiTo(player, Dest.airportArrival(), "Terminal Internacional")
	end)

	Players.PlayerRemoving:Connect(function(player)
		lastFlight[player] = nil
		lastHotel[player] = nil
		tripChanged[player] = nil
	end)

	-- data.Trip sigue a la posición real (p. ej. si reaparece en la ciudad o vuelve a entrar al juego)
	task.spawn(function()
		while true do
			task.wait(2)
			for _, player in ipairs(Players:GetPlayers()) do
				local data = S.Data.get(player)
				if data and rootOf(player) and not (tripChanged[player] and os.clock() - tripChanged[player] < 4) then
					local d = Dest.at(player)
					local id = d and d.Id or ""
					data.Trip = data.Trip or { At = "", Since = 0 }
					if data.Trip.At ~= id then
						data.Trip.At = id
						data.Trip.Since = os.time()
						S.Data.markDirty(player)
					end
				end
			end
		end
	end)
end

return Dest
