--!nonstrict
-- HomeService: vivienda inicial alquilada (habitación en la Residencia Económica).
--  * Cada jugador recibe una habitación propia con escritorio, computador, cama y vestidor.
--  * Lo que compras se ve en tu habitación (PC activo, monitores, silla, escritorio, luces, fondos).
--  * Alquiler semanal (cada 7 días de juego jugados). Si no hay saldo: deuda + recargo y aviso.
--    Nunca se pierde el progreso ni se desaloja al jugador.
--  * Estar en casa recarga las baterías.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local Config = require(Shared.Config)
local Catalog = require(Shared.ItemCatalog)
local Util = require(Shared.Util)

local Home = {}
local S
local assigned = {} -- [player] = room
local atHome = {}

function Home.Init(services)
	S = services
end

function Home.room(player)
	return assigned[player]
end

function Home.isAtHome(player)
	local room = assigned[player]
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not room or not root then
		return false
	end
	local rel = root.Position - room.Center
	return math.abs(rel.X) <= room.Size.X / 2 + 2 and math.abs(rel.Z) <= room.Size.Z / 2 + 2 and math.abs(rel.Y) < 20
end

function Home.spawnCFrame(player)
	local room = assigned[player]
	if room then
		return CFrame.new(room.Center + Vector3.new(0, 4, room.Size.Z / 2 - 5))
	end
	return nil
end

local function makePart(parent, name, size, cf, color, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

-- Redibuja los muebles y equipos dinámicos de la habitación según el inventario.
function Home.refreshRoom(player)
	local room = assigned[player]
	local data = S.Data.get(player)
	if not room or not data then
		return
	end
	local folder = room.Dynamic
	folder:ClearAllChildren()
	local deskCF = room.DeskCFrame -- parte superior del escritorio, mirando a la pared

	local desk = S.Inventory.bestCatAtHome(player, "furniture", "Escritorio", "Comfort")
	local deskColor = desk and rgb(desk.Color) or Color3.fromRGB(150, 115, 80)
	local deskWidth = desk and (desk.Id == "desk_large" and 12 or (desk.Id == "desk_lux" and 11 or 9)) or 8
	makePart(folder, "DeskTop", Vector3.new(deskWidth, 0.6, 4), deskCF, deskColor, desk and desk.Id == "desk_lux" and Enum.Material.Wood or Enum.Material.WoodPlanks)
	for _, sx in ipairs({ -1, 1 }) do
		makePart(folder, "DeskLeg", Vector3.new(0.5, 3, 3.6), deskCF * CFrame.new(sx * (deskWidth / 2 - 0.4), -1.8, 0), deskColor)
	end

	-- Monitores
	local mon = S.Inventory.bestCatAtHome(player, "monitor", nil, "ColorAcc")
	local screens = mon and math.floor(mon.Stats.Screens + 0.5) or 1
	if screens < 1 then
		screens = 1
	end
	local wide = mon and mon.Id == "mon_uw34"
	for i = 1, screens do
		local x = (i - (screens + 1) / 2) * 3.4
		local w = wide and 5 or 3.2
		local screen = makePart(folder, "Monitor", Vector3.new(w, 2, 0.25), deskCF * CFrame.new(x, 1.6, 1.2), Color3.fromRGB(20, 20, 24))
		local glow = makePart(folder, "Screen", Vector3.new(w - 0.2, 1.8, 0.05), screen.CFrame * CFrame.new(0, 0, -0.15), Color3.fromRGB(70, 140, 255), Enum.Material.Neon)
		glow.CanCollide = false
	end

	-- Torre del PC activo
	local rig = data.Rigs[data.ActiveRig]
	if rig then
		local caseRec = data.Inventory[rig.Parts.case or ""]
		local caseDef = caseRec and Catalog.get(caseRec.Id)
		local tower = makePart(folder, "PCTower", Vector3.new(1.6, 3.2, 3), deskCF * CFrame.new(deskWidth / 2 + 1.4, -1.3, 0),
			caseDef and rgb(caseDef.Color) or Color3.fromRGB(50, 50, 55))
		if caseDef and caseDef.Id == "case_glass" then
			tower.Material = Enum.Material.Glass
			tower.Transparency = 0.3
			local light = Instance.new("PointLight")
			light.Color = Color3.fromRGB(200, 80, 255)
			light.Range = 8
			light.Brightness = 1.5
			light.Parent = tower
		end
	end

	-- Silla
	local chair = S.Inventory.bestCatAtHome(player, "furniture", "Silla", "Comfort")
	local chairColor = chair and rgb(chair.Color) or Color3.fromRGB(110, 110, 110)
	local seat = makePart(folder, "ChairSeat", Vector3.new(2.6, 0.5, 2.6), deskCF * CFrame.new(0, -1.4, -3.2), chairColor)
	makePart(folder, "ChairBack", Vector3.new(2.6, chair and chair.Id ~= "chair_basic" and 3.4 or 2.2, 0.4), seat.CFrame * CFrame.new(0, 1.7, -1.2), chairColor)

	-- Luces y fondos de casa
	local light = S.Inventory.best(player, "homelight", "home", "Light")
	if light then
		local ring = makePart(folder, "RingLight", Vector3.new(0.3, 2.4, 2.4), CFrame.new(room.Center) * CFrame.new(-room.Size.X / 2 + 4, 1, 0), Color3.fromRGB(255, 255, 240), Enum.Material.Neon)
		local l = Instance.new("SpotLight")
		l.Face = Enum.NormalId.Right
		l.Brightness = 2
		l.Range = 16
		l.Parent = ring
	end
	local _, backRec, backDef = S.Inventory.best(player, "homeextra", "home", "Decor")
	if backDef then
		local color = backDef.Id == "backdrop_neon" and Color3.fromRGB(255, 60, 200) or Color3.fromRGB(40, 200, 80)
		local wall = makePart(folder, "Backdrop", Vector3.new(0.2, 7, 9), CFrame.new(room.Center) * CFrame.new(room.Size.X / 2 - 1, 1.5, -2), color,
			backDef.Id == "backdrop_neon" and Enum.Material.Neon or Enum.Material.Fabric)
		wall.CanCollide = false
	end
end

local function assignRoom(player)
	for _, room in ipairs(S.World.HomeRooms or {}) do
		if room.Owner == nil then
			room.Owner = player
			assigned[player] = room
			room.Sign.Text = "Hab. " .. room.Index .. " · " .. player.DisplayName
			room.DeskPrompt:SetAttribute("Owner", player.UserId)
			room.Wardrobe:SetAttribute("Owner", player.UserId)
			return room
		end
	end
	return nil
end

local function freeRoom(player)
	local room = assigned[player]
	if room then
		room.Owner = nil
		room.Sign.Text = "Hab. " .. room.Index .. " · Libre"
		room.DeskPrompt:SetAttribute("Owner", 0)
		room.Wardrobe:SetAttribute("Owner", 0)
		room.Dynamic:ClearAllChildren()
		assigned[player] = nil
	end
	atHome[player] = nil
end

function Home.onPlayerReady(player)
	local room = assignRoom(player)
	if not room then
		S.Net.notify(player, "La residencia está llena en este servidor: usa el cibercafé de la Zona universitaria o tu portátil.", "warn")
		return
	end
	Home.refreshRoom(player)
end

-- Alquiler: se cobra cada 7 días de juego JUGADOS (no se cobra mientras estás desconectado)
function Home.onNewDay(player)
	local data = S.Data.get(player)
	if not data then
		return
	end
	local h = data.Home
	h.PlayDays = h.PlayDays + 1
	if h.PlayDays < h.NextDue then
		return
	end
	h.NextDue = h.PlayDays + Config.RentPeriodDays
	local due = h.Rent
	if S.Economy.spend(player, due, "Alquiler", "Alquiler semanal (" .. "Residencia Económica" .. ")") then
		h.Paid = h.Paid + due
		h.Missed = 0
		data.Counters.rent_paid = (data.Counters.rent_paid or 0) + 1
		S.Net.notify(player, "🏠 Alquiler pagado: $" .. due .. ".", "info")
	else
		local fee = math.floor(due * Config.LateFeeRate + 0.5)
		h.Debt = h.Debt + due + fee
		h.Missed = h.Missed + 1
		data.Reputation = math.max(0, data.Reputation - 1)
		S.Net.notify(player, "⚠️ No pudiste pagar el alquiler. Deuda: $" .. h.Debt .. " (incluye recargo). Págala en la app Banco." ..
			(h.Missed >= 2 and " Los pedidos online quedan bloqueados hasta pagar." or ""), "warn")
	end
	S.Data.markDirty(player)
end

function Home.Start()
	local Net = S.Net

	Net.on("Home.PayDebt", function(player)
		local data = S.Data.get(player)
		local h = data.Home
		if h.Debt <= 0 then
			return false, "No tienes deudas de alquiler."
		end
		if not S.Economy.spend(player, h.Debt, "Alquiler", "Pago de alquiler atrasado") then
			return false, "Necesitas $" .. Util.formatInt(h.Debt) .. "."
		end
		h.Paid = h.Paid + h.Debt
		h.Debt = 0
		h.Missed = 0
		return true, "Deuda de alquiler saldada. ¡Gracias!"
	end)

	Net.on("Home.Teleport", function(player)
		local cf = Home.spawnCFrame(player)
		if not cf or not player.Character then
			return false, "No tienes habitación asignada."
		end
		local data = S.Data.get(player)
		-- Volver a casa en taxi tiene coste normal
		return S.Travel.taxiTo(player, cf.Position, "tu casa")
	end)

	Players.PlayerRemoving:Connect(freeRoom)

	-- Detección de entrada en casa + recarga de baterías
	task.spawn(function()
		while true do
			task.wait(1)
			for _, player in ipairs(Players:GetPlayers()) do
				if S.Data.get(player) then
					local inside = Home.isAtHome(player)
					if inside and not atHome[player] then
						S.Quest.tutorialEvent(player, "enter_home")
						if S.Inventory.chargeAll(player) then
							S.Net.notify(player, "🔋 Baterías recargadas en casa.", "info")
						end
					end
					atHome[player] = inside
				end
			end
		end
	end)
end

return Home
