-- PlotService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/PlotService
--
-- Terrenos del servidor:
--   * Crea el mundo base (avenida central + terrenos) por código.
--   * Asigna un terreno a cada jugador y construye su estadio desde sus datos.
--   * Teletransporta al jugador a su estadio y muestra su etiqueta (club / VIP).
-- Cualquier jugador puede caminar por los estadios ajenos (visita), pero solo
-- el servidor modifica un estadio y únicamente con los datos de su dueño.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.Config.GameConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local StadiumStages = require(Shared.Config.StadiumStages)

local DataService = require(script.Parent.DataService)
local ClubService = require(script.Parent.ClubService)
local BuildService = require(script.Parent.BuildService)
local StadiumRenderer = require(script.Parent.StadiumRenderer)

local PlotService = {}

local plots = {} -- array de { index, origin, model, stadium, owner }
local playerPlot = {} -- [player] = plot
local pendingRender = {}

local AVENUE_WIDTH = 60

local function makePart(parent, cf, size, color, mat, name)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CFrame = cf
	p.Size = size
	p.Color = color
	p.Material = mat
	p.Name = name or "Part"
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function setFreeSign(plot)
	local old = plot.model:FindFirstChild("FreeSign")
	if old then
		old:Destroy()
	end
	if plot.owner then
		return
	end
	local sign = makePart(plot.model, plot.origin * CFrame.new(0, 6, 82), Vector3.new(20, 6, 1),
		Color3.fromRGB(30, 40, 60), Enum.Material.SmoothPlastic, "FreeSign")
	for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back }) do
		local gui = Instance.new("SurfaceGui")
		gui.Face = face
		gui.Parent = sign
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.TextColor3 = Color3.fromRGB(220, 230, 255)
		t.Font = Enum.Font.GothamBold
		t.TextScaled = true
		t.Text = "Terreno " .. plot.index .. " · libre"
		t.Parent = gui
	end
end

function PlotService.CreateWorld()
	local root = Workspace:FindFirstChild("FEU_World")
	if root then
		root:Destroy()
	end
	root = Instance.new("Folder")
	root.Name = "FEU_World"
	root.Parent = Workspace

	local perRow = math.ceil(GameConfig.PLOT_COUNT / 2)
	local stepX = GameConfig.PLOT_SIZE.X + GameConfig.PLOT_SPACING
	local rowOffset = AVENUE_WIDTH / 2 + GameConfig.PLOT_SIZE.Z / 2
	local totalX = perRow * stepX + 120
	local totalZ = (rowOffset + GameConfig.PLOT_SIZE.Z / 2) * 2 + 80

	makePart(root, CFrame.new(0, -0.6, 0), Vector3.new(totalX, 1, totalZ), Color3.fromRGB(70, 110, 60), Enum.Material.Grass, "Ground")
	makePart(root, CFrame.new(0, -0.48, 0), Vector3.new(totalX, 1, AVENUE_WIDTH - 10), Color3.fromRGB(150, 150, 155), Enum.Material.Concrete, "Avenue")

	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(0, 0.05, 0)
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Color = Color3.fromRGB(255, 196, 0)
	spawn.Material = Enum.Material.Neon
	spawn.Parent = root

	local plotsFolder = Instance.new("Folder")
	plotsFolder.Name = "Plots"
	plotsFolder.Parent = root

	for i = 1, GameConfig.PLOT_COUNT do
		local row = (i <= perRow) and 0 or 1
		local col = (i - 1) % perRow
		local x = (col - (perRow - 1) / 2) * stepX
		local origin
		if row == 0 then
			origin = CFrame.new(x, 0, -rowOffset) -- plaza (Z+ local) mirando a la avenida
		else
			origin = CFrame.new(x, 0, rowOffset) * CFrame.Angles(0, math.pi, 0)
		end
		local model = Instance.new("Model")
		model.Name = "Plot_" .. i
		model:SetAttribute("PlotIndex", i)
		model.Parent = plotsFolder
		local base = makePart(model, origin * CFrame.new(0, -0.5, 0), GameConfig.PLOT_SIZE,
			Color3.fromRGB(86, 125, 70), Enum.Material.Grass, "Base")
		model.PrimaryPart = base
		local stadium = Instance.new("Folder")
		stadium.Name = "Stadium"
		stadium.Parent = model
		local plot = { index = i, origin = origin, model = model, stadium = stadium, owner = nil }
		plots[i] = plot
		setFreeSign(plot)
	end
end

function PlotService.Assign(player)
	if playerPlot[player] then
		return playerPlot[player]
	end
	for _, plot in ipairs(plots) do
		if not plot.owner then
			plot.owner = player
			plot.model:SetAttribute("OwnerUserId", player.UserId)
			plot.model:SetAttribute("OwnerName", player.DisplayName)
			playerPlot[player] = plot
			setFreeSign(plot)
			return plot
		end
	end
	return nil
end

function PlotService.Release(player)
	local plot = playerPlot[player]
	if not plot then
		return
	end
	playerPlot[player] = nil
	pendingRender[player] = nil
	plot.owner = nil
	plot.model:SetAttribute("OwnerUserId", nil)
	plot.model:SetAttribute("OwnerName", nil)
	plot.stadium:ClearAllChildren()
	setFreeSign(plot)
end

function PlotService.GetPlot(player)
	return playerPlot[player]
end

local function readableText(color)
	local luminance = 0.299 * color.R + 0.587 * color.G + 0.114 * color.B
	return luminance > 0.6 and Color3.fromRGB(20, 20, 25) or Color3.fromRGB(250, 250, 250)
end

function PlotService.BuildRenderInfo(player, data)
	local appearance = ClubService.EffectiveAppearance(player, data)
	local palette = CosmeticConfig.ById.palette[appearance.palette]
	local crest = CosmeticConfig.ById.crest[appearance.crest]
	local kit = CosmeticConfig.ById.kit[appearance.kit]
	local stage = StadiumStages.Get(data.stadium.stage)
	return {
		facilities = data.stadium.facilities,
		appearance = appearance,
		primary = palette.primary,
		secondary = palette.secondary,
		secondaryText = readableText(palette.primary),
		crestSymbol = crest.symbol,
		kitPattern = kit.pattern,
		clubName = ClubService.DisplayName(data),
		shortName = ClubService.ShortName(data),
		ownerName = player.DisplayName,
		stage = stage.stage,
		stageName = stage.name,
		stageVisual = stage.visual,
		trophyCount = #data.trophies,
		vip = ClubService.IsVip(player),
		decorations = data.stadium.decorations,
		decorationVisible = BuildService.DecorationVisibility(player, data),
	}
end

local function updateNameTag(player, data)
	local character = player.Character
	local head = character and character:FindFirstChild("Head")
	if not head or not data then
		return
	end
	local tag = head:FindFirstChild("FEU_Tag")
	if not tag then
		tag = Instance.new("BillboardGui")
		tag.Name = "FEU_Tag"
		tag.Size = UDim2.fromOffset(200, 50)
		tag.StudsOffset = Vector3.new(0, 2.6, 0)
		tag.MaxDistance = 80
		tag.Parent = head
		local layout = Instance.new("UIListLayout")
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
		layout.Parent = tag
	end
	tag:ClearAllChildren()
	local layout = Instance.new("UIListLayout")
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.Parent = tag
	local info = PlotService.BuildRenderInfo(player, data)
	if info.vip then
		local vip = Instance.new("TextLabel")
		vip.Size = UDim2.new(0, 70, 0.45, 0)
		vip.BackgroundColor3 = Color3.fromRGB(255, 200, 70)
		vip.TextColor3 = Color3.fromRGB(40, 25, 0)
		vip.Font = Enum.Font.GothamBlack
		vip.TextScaled = true
		vip.Text = "👑 VIP"
		vip.Parent = tag
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0.4, 0)
		corner.Parent = vip
	end
	local club = Instance.new("TextLabel")
	club.Size = UDim2.new(1, 0, 0.5, 0)
	club.BackgroundTransparency = 1
	club.TextColor3 = Color3.fromRGB(255, 255, 255)
	club.TextStrokeTransparency = 0.4
	club.Font = Enum.Font.GothamBold
	club.TextScaled = true
	club.Text = info.crestSymbol .. " " .. info.clubName
	club.Parent = tag
end

function PlotService.Render(player)
	local plot = playerPlot[player]
	local data = DataService.Get(player)
	if not plot or not data then
		return
	end
	local ok, err = pcall(function()
		StadiumRenderer.Render(plot.stadium, plot.origin, PlotService.BuildRenderInfo(player, data))
	end)
	if not ok then
		warn("[PlotService] Error construyendo el estadio de ", player.Name, ": ", err)
	end
	updateNameTag(player, data)
end

-- Agrupa varios cambios seguidos en una sola reconstrucción.
function PlotService.RequestRender(player)
	if pendingRender[player] then
		return
	end
	pendingRender[player] = true
	task.delay(0.25, function()
		if pendingRender[player] then
			pendingRender[player] = nil
			if player.Parent then
				PlotService.Render(player)
			end
		end
	end)
end

function PlotService.TeleportHome(player)
	local plot = playerPlot[player]
	local character = player.Character
	if not plot or not character or not character:FindFirstChild("HumanoidRootPart") then
		return false, "No se pudo teletransportar ahora."
	end
	character:PivotTo(plot.origin * StadiumRenderer.SpawnOffset)
	return true, "Bienvenido a tu estadio."
end

function PlotService.CharacterAdded(player)
	task.wait(0.2)
	if DataService.Get(player) then
		PlotService.TeleportHome(player)
		updateNameTag(player, DataService.Get(player))
	end
end

return PlotService
