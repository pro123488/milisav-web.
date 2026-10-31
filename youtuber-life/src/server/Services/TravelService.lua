--!nonstrict
-- TravelService: dónde está cada jugador (distrito, lugar de grabación, tienda), descubrimientos,
-- lugares secretos, taxi y autobús.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local WorldData = require(Shared.WorldData)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Travel = {}
local S
local lastDistrict = {}
local lastTaxi = {}

Travel.BusLine = { "budget", "apartments", "studios", "entertainment", "events", "commercial", "park", "creators", "financial", "tourist", "university", "beach" }

local storeTags = {
	tech = { "shop", "tech" },
	camera = { "shop", "tech", "studio" },
	phone = { "shop", "tech" },
	creator = { "shop", "studio" },
	home = { "shop", "home" },
}

function Travel.Init(services)
	S = services
end

local function rootOf(player)
	return player.Character and player.Character:FindFirstChild("HumanoidRootPart")
end

-- Lugar de grabación en el que está el jugador (o nil)
function Travel.currentSpot(player)
	local root = rootOf(player)
	if not root then
		return nil
	end
	local pos = root.Position
	local district = WorldData.districtAt(pos.X, pos.Z)
	local pspot = S.Property.spot(player)
	if pspot then
		return pspot
	end
	if S.Home.isAtHome(player) then
		local _, _, decor = S.Inventory.best(player, "homeextra", "home", "Decor")
		local tags = { "home" }
		if decor then
			tags[#tags + 1] = "studio"
		end
		return { Id = "home", Name = "Tu habitación", Tags = tags, Indoor = true, Interest = 5, Noise = 1, Busy = 0, IsHome = true, District = district and district.Id }
	end
	local vip = S.World.VipLounge
	if vip then
		local rel = pos - vip.Center
		if math.abs(rel.X) < vip.Size.X / 2 and math.abs(rel.Z) < vip.Size.Z / 2 and math.abs(rel.Y) < 15 then
			return { Id = "vip", Name = "Sala VIP", Tags = { "luxury", "event" }, Indoor = true, Interest = 12, Noise = 2, Busy = 3, District = "events", Decor = 20 }
		end
	end
	for _, sp in ipairs(WorldData.Specials) do
		local dx, dz = pos.X - sp.WX, pos.Z - sp.WZ
		if dx * dx + dz * dz <= 40 * 40 then
			if sp.Type == "store" then
				return { Id = "store_" .. sp.StoreId, Name = Catalog.Stores[sp.StoreId].Name, Tags = storeTags[sp.StoreId] or { "shop" }, Indoor = true, Interest = 8, Noise = 3, Busy = 5, District = sp.District, Decor = 12 }
			elseif sp.Type == "cafe" then
				return { Id = "cafe", Name = sp.Name, Tags = { "education", "tech", "food" }, Indoor = true, Interest = 6, Noise = 3, Busy = 5, District = sp.District, Decor = 8 }
			elseif sp.Type == "bank" then
				return { Id = "bank", Name = sp.Name, Tags = { "business" }, Indoor = true, Interest = 5, Noise = 2, Busy = 4, District = sp.District, Decor = 10 }
			end
		end
	end
	local best, bestD = nil, Config.RecordSpotRadius
	for _, s in ipairs(WorldData.Spots) do
		local d = math.sqrt((pos.X - s.X) ^ 2 + (pos.Z - s.Z) ^ 2)
		if d <= bestD and (not s.Secret or (S.Data.get(player).Visited.Secrets[s.Id])) then
			best, bestD = s, d
		end
	end
	if best then
		-- de noche, los lugares con etiqueta "night" son más interesantes
		if S.Time.isNight() and Util.indexOf(best.Tags, "night") then
			local copy = Util.deepCopy(best)
			copy.Interest = copy.Interest + 4
			return copy
		end
		return best
	end
	return nil
end

-- Lugar genérico para fotos fuera de los puntos de grabación
function Travel.genericSpot(player)
	local root = rootOf(player)
	local d = root and WorldData.districtAt(root.Position.X, root.Position.Z)
	if not d then
		return { Id = "outside", Name = "Afueras", Tags = { "nature" }, Indoor = false, Interest = 2, Noise = 2, Busy = 1 }
	end
	return { Id = "free_" .. d.Id, Name = d.Name, Tags = d.Tags, Indoor = false, Interest = 3, Noise = d.Noise, Busy = d.Busy, District = d.Id }
end

function Travel.markStoreVisit(player, storeId)
	local data = S.Data.get(player)
	if not data.Visited.Stores[storeId] then
		data.Visited.Stores[storeId] = true
		S.Quest.check(player)
	end
	S.Quest.tutorialEvent(player, "visit_store")
end

function Travel.taxiStop(district)
	local cx, cz = WorldData.center(district)
	return Vector3.new(cx + 24, 4, cz + WorldData.CellSize / 2 - WorldData.RoadWidth / 2 - 8)
end

function Travel.teleport(player, pos)
	local char = player.Character
	if not char or not rootOf(player) then
		return false
	end
	S.Net.push(player, "travelFade", {})
	task.delay(0.35, function()
		if char.Parent then
			char:PivotTo(CFrame.new(pos + Vector3.new(0, 3, 0)))
		end
	end)
	return true
end

function Travel.taxiTo(player, pos, label)
	local root = rootOf(player)
	if not root then
		return false, "No puedes viajar ahora."
	end
	if lastTaxi[player] and os.clock() - lastTaxi[player] < 4 then
		return false, "Espera un momento antes de pedir otro taxi."
	end
	local dist = (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(root.Position.X, 0, root.Position.Z)).Magnitude
	if dist < 60 then
		return false, "Ya estás muy cerca."
	end
	local fare = math.floor(Config.TaxiBaseFare + dist * Config.TaxiPerStud + 0.5)
	if not S.Economy.spend(player, fare, "Transporte", "Taxi a " .. label) then
		return false, "El taxi cuesta $" .. fare .. "."
	end
	lastTaxi[player] = os.clock()
	local data = S.Data.get(player)
	data.Counters.taxi_rides = (data.Counters.taxi_rides or 0) + 1
	S.Quest.check(player)
	Travel.teleport(player, pos)
	return true, "🚕 Taxi a " .. label .. " ($" .. fare .. ")."
end

function Travel.Start()
	local Net = S.Net

	Net.on("Travel.Taxi", function(player, p)
		local d = WorldData.DistrictById[p.district or ""]
		if not d then
			return false, "Destino no válido."
		end
		return Travel.taxiTo(player, Travel.taxiStop(d), d.Name)
	end)

	Net.on("Travel.TaxiSpot", function(player, p)
		local spot = WorldData.SpotById[p.spot or ""]
		if not spot or spot.Secret then
			return false, "Destino no válido."
		end
		return Travel.taxiTo(player, Vector3.new(spot.X, 4, spot.Z + 12), spot.Name)
	end)

	Net.on("Travel.Bus", function(player, p)
		local d = WorldData.DistrictById[p.district or ""]
		if not d or not Util.indexOf(Travel.BusLine, d.Id) then
			return false, "El autobús no llega a ese distrito."
		end
		local root = rootOf(player)
		local here = root and WorldData.districtAt(root.Position.X, root.Position.Z)
		if not here or not Util.indexOf(Travel.BusLine, here.Id) then
			return false, "Aquí no hay parada de autobús. Las paradas están en: " .. #Travel.BusLine .. " distritos de la línea."
		end
		if here.Id == d.Id then
			return false, "Ya estás en ese distrito."
		end
		if not S.Economy.spend(player, 3, "Transporte", "Autobús a " .. d.Name) then
			return false, "El billete cuesta $3."
		end
		Travel.teleport(player, Travel.taxiStop(d) + Vector3.new(-40, 0, 0))
		return true, "🚌 Autobús a " .. d.Name .. " ($3)."
	end)

	Players.PlayerRemoving:Connect(function(player)
		lastDistrict[player] = nil
		lastTaxi[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(1.5)
			for _, player in ipairs(Players:GetPlayers()) do
				local data = S.Data.get(player)
				local root = rootOf(player)
				if data and root then
					local pos = root.Position
					local d = WorldData.districtAt(pos.X, pos.Z)
					if d and d.Id ~= lastDistrict[player] then
						lastDistrict[player] = d.Id
						player:SetAttribute("District", d.Name)
						if not data.Visited.Districts[d.Id] then
							local first = Util.count(data.Visited.Districts) == 0
							data.Visited.Districts[d.Id] = true
							if not first then
								S.Net.notify(player, "🗺 Nuevo distrito descubierto: " .. d.Name, "success")
								S.Progress.addXp(player, S.Progress.Xp.District)
								S.Quest.tutorialEvent(player, "new_district")
							end
							S.Quest.check(player)
						end
					elseif not d then
						player:SetAttribute("District", "Afueras")
					end
					-- Tiendas
					local storeId = S.Shop.storeNear(player)
					if storeId and player:GetAttribute("InStore") ~= storeId then
						player:SetAttribute("InStore", storeId)
						Travel.markStoreVisit(player, storeId)
					elseif not storeId then
						player:SetAttribute("InStore", nil)
					end
					-- Lugar de grabación cercano (para el HUD)
					local spot = Travel.currentSpot(player)
					player:SetAttribute("Spot", spot and spot.Name or nil)
					-- Secretos
					for _, s in ipairs(WorldData.Secrets) do
						if not data.Visited.Secrets[s.Id] then
							local dx, dz = pos.X - s.WX, pos.Z - s.WZ
							if dx * dx + dz * dz < 20 * 20 then
								data.Visited.Secrets[s.Id] = true
								S.Economy.add(player, s.Reward, "Descubrimientos", "Lugar secreto: " .. s.Name, {})
								S.Net.push(player, "secret", { name = s.Name, reward = s.Reward })
								S.Progress.addXp(player, 50)
								S.Quest.check(player)
							end
						end
					end
				end
			end
		end
	end)
end

return Travel
