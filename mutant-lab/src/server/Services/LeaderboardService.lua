--!nonstrict
-- LeaderboardService: panel físico en la plaza con los 10 laboratorios que más créditos han ganado.
-- Usa un OrderedDataStore (todos los servidores) y, si no está disponible (Studio sin acceso), muestra
-- la clasificación de los jugadores del servidor.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Util = require(ReplicatedStorage.Shared.Util)

local Board = {}
local S
local ordered
local rows = {}
local names = {}

function Board.Init(services)
	S = services
	local ok, ds = pcall(function()
		return DataStoreService:GetOrderedDataStore("LabMutante_Top_v1")
	end)
	ordered = ok and ds or nil
end

local function build()
	local m = Instance.new("Model")
	m.Name = "Leaderboard"
	m.Parent = S.World.root
	S.World.P(m, "Post", Vector3.new(1.5, 14, 1.5), CFrame.new(-8, 7, 22), { 40, 40, 50 }, Enum.Material.Metal)
	S.World.P(m, "Post", Vector3.new(1.5, 14, 1.5), CFrame.new(8, 7, 22), { 40, 40, 50 }, Enum.Material.Metal)
	local screen = S.World.P(m, "Screen", Vector3.new(18, 12, 0.6), CFrame.new(0, 10, 22), { 20, 22, 34 }, Enum.Material.SmoothPlastic)
	S.World.P(m, "Frame", Vector3.new(18.8, 12.8, 0.4), CFrame.new(0, 10, 22.4), { 255, 214, 70 }, Enum.Material.Neon)
	for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back }) do
		local sg = Instance.new("SurfaceGui")
		sg.Face = face
		sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		sg.PixelsPerStud = 30
		sg.Parent = screen
		local title = Instance.new("TextLabel")
		title.Size = UDim2.new(1, 0, 0.14, 0)
		title.BackgroundTransparency = 1
		title.Text = "🏆 MEJORES LABORATORIOS"
		title.TextColor3 = Color3.fromRGB(255, 214, 70)
		title.Font = Enum.Font.GothamBlack
		title.TextScaled = true
		title.Parent = sg
		for i = 1, 10 do
			local t = Instance.new("TextLabel")
			t.Name = "Row" .. i
			t.Size = UDim2.new(0.92, 0, 0.082, 0)
			t.Position = UDim2.new(0.04, 0, 0.15 + (i - 1) * 0.085, 0)
			t.BackgroundTransparency = 1
			t.Text = ""
			t.TextColor3 = i <= 3 and Color3.fromRGB(255, 230, 140) or Color3.fromRGB(220, 225, 255)
			t.Font = Enum.Font.GothamBold
			t.TextScaled = true
			t.TextXAlignment = Enum.TextXAlignment.Left
			t.Parent = sg
			rows[#rows + 1] = { label = t, index = i }
		end
	end
end

local function show(list)
	Board.entries = list
	for _, r in ipairs(rows) do
		local e = list[r.index]
		r.label.Text = e and (r.index .. ". " .. e.name .. "  —  " .. Util.short(e.value)) or ""
	end
end

local function nameOf(userId)
	if names[userId] then
		return names[userId]
	end
	local p = Players:GetPlayerByUserId(userId)
	if p then
		names[userId] = p.DisplayName
		return names[userId]
	end
	local ok, n = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	names[userId] = ok and n or ("Jugador " .. userId)
	return names[userId]
end

function Board.update()
	local list = {}
	if ordered then
		for _, p in ipairs(Players:GetPlayers()) do
			local d = S.Data.get(p)
			if d then
				pcall(function()
					ordered:SetAsync(tostring(p.UserId), math.floor(d.Stats.Earned or 0))
				end)
			end
		end
		local ok, pages = pcall(function()
			return ordered:GetSortedAsync(false, 10)
		end)
		if ok and pages then
			local okPage, page = pcall(function()
				return pages:GetCurrentPage()
			end)
			if okPage and page then
				for _, e in ipairs(page) do
					list[#list + 1] = { name = nameOf(tonumber(e.key) or 0), value = e.value }
				end
			end
		end
	end
	if #list == 0 then
		-- respaldo: jugadores de este servidor
		for _, p in ipairs(Players:GetPlayers()) do
			local d = S.Data.get(p)
			if d then
				list[#list + 1] = { name = p.DisplayName, value = math.floor(d.Stats.Earned or 0) }
			end
		end
		table.sort(list, function(a, b)
			return a.value > b.value
		end)
	end
	show(list)
	return list
end

function Board.Start()
	build()
	task.spawn(function()
		while true do
			local ok, err = pcall(Board.update)
			if not ok then
				warn("[LabMutante] clasificación: " .. tostring(err))
			end
			task.wait(90)
		end
	end)
end

return Board
