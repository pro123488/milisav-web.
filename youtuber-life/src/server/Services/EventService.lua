--!nonstrict
-- EventService: eventos dinámicos diarios (EventData). Cada evento tiene lugar, horario, efectos reales
-- (descuentos, más visitas, escenas más interesantes en el lugar, taxis más baratos) y objetivos con
-- recompensa que se cobran una vez por evento. Hay un escenario con luces en el lugar del evento.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local EventData = require(Shared.EventData)
local WorldData = require(Shared.WorldData)
local Util = require(Shared.Util)

local Events = {}
local S
local beacon

function Events.Init(services)
	S = services
end

function Events.current()
	local day = S.Time.day()
	return EventData.forDay(day), day
end

function Events.isActive()
	local ev = Events.current()
	local h = S.Time.hour()
	return h >= ev.Hours[1] and h < ev.Hours[2]
end

local function effect(name)
	local ev = Events.current()
	return ev.Effects and ev.Effects[name] or nil
end

function Events.priceMultiplier(def)
	local d = effect("Discount")
	if d and (d.All or Util.indexOf(d.Cats or {}, def.Cat)) then
		return 1 - d.Rate
	end
	return 1
end

function Events.usedDiscount()
	return effect("UsedDiscount") or 0
end

function Events.taxiMultiplier()
	return effect("TaxiDiscount") and (1 - effect("TaxiDiscount")) or 1
end

function Events.viewMultiplier(categoryId)
	local v = effect("ViewBonus")
	if v and Util.indexOf(v.Cats or {}, categoryId) then
		return v.Mult
	end
	return 1
end

function Events.sceneBonus(spot)
	local ev = Events.current()
	if spot and spot.Id == ev.Spot and Events.isActive() then
		return ev.Effects.EventSpotBonus or 1.1
	end
	return 1
end

function Events.atEvent(player)
	local ev = Events.current()
	local spot = WorldData.SpotById[ev.Spot]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not spot or not root then
		return false
	end
	local dx, dz = root.Position.X - spot.X, root.Position.Z - spot.Z
	return dx * dx + dz * dz <= 50 * 50
end

local function progress(data)
	local ev, day = Events.current()
	local p = data.EventProg
	if not p or p.Day ~= day then
		p = { Day = day, Event = ev.Id, Done = {}, Scenes = 0, Published = 0, Joined = false }
		data.EventProg = p
	end
	return p, ev
end
Events.progress = progress

local function complete(player, index)
	local data = S.Data.get(player)
	local p, ev = progress(data)
	local key = tostring(index)
	if p.Done[key] then
		return
	end
	p.Done[key] = true
	local g = ev.Goals[index]
	if not p.Joined then
		p.Joined = true
		data.Counters.events_joined = (data.Counters.events_joined or 0) + 1
	end
	data.Counters.events_goals = (data.Counters.events_goals or 0) + 1
	S.Economy.add(player, g.Reward, "Eventos", ev.Name .. ": " .. EventData.goalText(g), {})
	S.Progress.addXp(player, 25)
	S.Net.notify(player, "🎪 " .. ev.Name .. " — objetivo cumplido: " .. EventData.goalText(g) .. " (+$" .. g.Reward .. ")", "success")
	S.Quest.check(player)
end

local function check(player, kind, value)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local p, ev = progress(data)
	for i, g in ipairs(ev.Goals) do
		if not p.Done[tostring(i)] and g.Type == kind then
			local ok = false
			if kind == "checkin" then
				ok = value == true
			elseif kind == "photo" then
				ok = value >= g.MinQ
			elseif kind == "scene" then
				ok = p.Scenes >= g.N
			elseif kind == "decor" then
				ok = value >= g.Min
			elseif kind == "publish" then
				local v = value
				local catOk = not g.Cats or Util.indexOf(g.Cats, v.Cat) ~= nil
				local editOk = not g.MinEdit or (v.EditQ or 0) >= g.MinEdit
				if catOk and editOk then
					p["Pub" .. i] = (p["Pub" .. i] or 0) + 1
				end
				ok = (p["Pub" .. i] or 0) >= g.N
			end
			if ok then
				complete(player, i)
			end
		end
	end
end

function Events.onScene(player, spot)
	local data = S.Data.get(player)
	local p, ev = progress(data)
	if spot and spot.Id == ev.Spot and Events.isActive() then
		p.Scenes = p.Scenes + 1
		check(player, "scene")
	end
end

function Events.onPhoto(player, photo)
	local ev = Events.current()
	if photo.Spot == ev.Spot and Events.isActive() then
		check(player, "photo", photo.Q)
	end
end

function Events.onPublish(player, video)
	check(player, "publish", video)
end

function Events.onDecor(player, score)
	check(player, "decor", score)
end

local function moveBeacon()
	local ev = Events.current()
	local spot = WorldData.SpotById[ev.Spot]
	if not spot then
		return
	end
	if beacon then
		beacon:Destroy()
	end
	local m = Instance.new("Model")
	m.Name = "EventBeacon"
	local function part(name, size, pos, color, mat, transp)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored = true
		p.CanCollide = name == "Stage"
		p.Size = size
		p.CFrame = CFrame.new(pos)
		p.Color = color
		p.Material = mat or Enum.Material.Neon
		p.Transparency = transp or 0
		p.Parent = m
		return p
	end
	local base = Vector3.new(spot.X + 18, 0.5, spot.Z - 14)
	part("Stage", Vector3.new(16, 1.2, 10), base + Vector3.new(0, 0.6, 0), Color3.fromRGB(30, 30, 36), Enum.Material.Metal)
	local beam = part("LightBeam", Vector3.new(3, 120, 3), base + Vector3.new(0, 61, 0), Color3.fromRGB(255, 80, 200), Enum.Material.Neon, 0.6)
	beam.CastShadow = false
	for i = -1, 1, 2 do
		part("Flag", Vector3.new(0.4, 14, 0.4), base + Vector3.new(i * 8, 7, -5), Color3.fromRGB(240, 240, 240), Enum.Material.Metal)
		part("Banner", Vector3.new(0.2, 4, 3), base + Vector3.new(i * 8, 11, -3.4), Color3.fromRGB(255, 52, 82), Enum.Material.Fabric)
	end
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(260, 50)
	bb.StudsOffset = Vector3.new(0, 14, 0)
	bb.MaxDistance = 400
	bb.Parent = m.Stage
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = Color3.fromRGB(120, 20, 90)
	t.BackgroundTransparency = 0.15
	t.TextColor3 = Color3.new(1, 1, 1)
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = "🎪 " .. ev.Name
	t.Parent = bb
	m.Parent = workspace
	beacon = m
	workspace:SetAttribute("EventId", ev.Id)
end

function Events.Start()
	moveBeacon()
	local lastDay = S.Time.day()
	task.spawn(function()
		while true do
			task.wait(2)
			local day = S.Time.day()
			if day ~= lastDay then
				lastDay = day
				moveBeacon()
				local ev = Events.current()
				for _, player in ipairs(Players:GetPlayers()) do
					S.Net.notify(player, "🎪 Nuevo evento hoy: " .. ev.Name .. " — " .. ev.Desc, "info")
				end
			end
			workspace:SetAttribute("EventActive", Events.isActive())
			for _, player in ipairs(Players:GetPlayers()) do
				local data = S.Data.get(player)
				if data and Events.isActive() and Events.atEvent(player) then
					check(player, "checkin", true)
				end
			end
		end
	end)
end

return Events
