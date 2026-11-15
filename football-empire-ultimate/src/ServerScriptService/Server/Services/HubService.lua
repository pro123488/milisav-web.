-- HubService (ModuleScript)
-- Ubicación: ServerScriptService/Server/Services/HubService
--
-- PLAZA CENTRAL (junto al punto de aparición, en la avenida):
--   * Puesto de huevos y puesto de cajas de balones: tecla E abre su pantalla.
--   * Tablón del pase de temporada y de la semana (bonus y estadio destacado).
--   * Tablón con el top 10 mundial de goleadores.
--   * Ambiente: atmósfera, brillo suave y rayos de sol.
-- Son carteles e indicaciones: comprar y abrir se sigue validando en el servidor como siempre.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local CollectionConfig = require(Shared.Config.CollectionConfig)
local SeasonConfig = require(Shared.Config.SeasonConfig)
local WeeklyConfig = require(Shared.Config.WeeklyConfig)
local ArenaConfig = require(Shared.Config.ArenaConfig)
local Remotes = require(Shared.Modules.Remotes)

local PetService = require(script.Parent.PetService)

local HubService = {}

local notifyRemote = Remotes.Get("Notify")
local folder
local seasonLabel
local boardLabels = {} -- [idClasificación] = TextLabel
local eggLabels = {} -- [id] = TextLabel con el precio

local DARK = Color3.fromRGB(18, 22, 34)
local GOLD = Color3.fromRGB(255, 200, 60)

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		p[key] = value
	end
	p.Parent = folder
	return p
end

local function billboard(adornee, text, height, width)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(width or 240, 50)
	gui.StudsOffset = Vector3.new(0, height, 0)
	gui.MaxDistance = 120
	gui.Parent = adornee
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.RichText = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.3
	label.Text = text
	label.Parent = gui
	return label
end

-- Indicación con la tecla E que abre una pantalla del menú del jugador
local function openPrompt(target, actionText, objectText, screen, params)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = actionText
	prompt.ObjectText = objectText
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 16
	prompt.RequiresLineOfSight = false
	prompt.Parent = target
	prompt.Triggered:Connect(function(player)
		notifyRemote:FireClient(player, "open", { screen = screen, params = params })
	end)
end

local function board(cframe, face, title, color)
	for _, dx in ipairs({ -10, 10 }) do
		part({ Name = "Leg", Size = Vector3.new(1, 6, 1), CFrame = cframe * CFrame.new(dx, -8, 0), Color = Color3.fromRGB(60, 62, 72), Material = Enum.Material.Metal })
	end
	local panel = part({ Name = "Board", Size = Vector3.new(26, 14, 1), CFrame = cframe, Color = DARK })
	part({ Name = "Trim", Size = Vector3.new(27, 1, 1.2), CFrame = cframe * CFrame.new(0, 7.5, 0), Color = color, Material = Enum.Material.Neon })
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.Parent = panel
	local heading = Instance.new("TextLabel")
	heading.Size = UDim2.fromScale(1, 0.2)
	heading.BackgroundTransparency = 1
	heading.Font = Enum.Font.GothamBlack
	heading.TextScaled = true
	heading.TextColor3 = color
	heading.Text = title
	heading.Parent = gui
	local body = Instance.new("TextLabel")
	body.Position = UDim2.fromScale(0.04, 0.22)
	body.Size = UDim2.fromScale(0.92, 0.74)
	body.BackgroundTransparency = 1
	body.Font = Enum.Font.GothamBold
	body.TextScaled = true
	body.RichText = true
	body.TextColor3 = Color3.new(1, 1, 1)
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.Text = ""
	body.Parent = gui
	return panel, body
end

local function buildEggStand()
	local center = CFrame.new(-44, 0, 0)
	local base = part({ Name = "EggStand", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1, 40, 40),
		CFrame = center * CFrame.new(0, 0.5, 0) * CFrame.Angles(0, 0, math.pi / 2), Color = Color3.fromRGB(70, 50, 110), Material = Enum.Material.Marble })
	billboard(base, "🥚 HUEVOS DE MASCOTAS", 13, 300)
	openPrompt(base, "Abrir huevos", "Mascotas", "collection", { tab = "pets" })
	local looks = {
		basic = { color = Color3.fromRGB(250, 245, 230), material = Enum.Material.SmoothPlastic },
		golden = { color = GOLD, material = Enum.Material.Neon },
		champion = { color = Color3.fromRGB(170, 90, 255), material = Enum.Material.Neon },
		jungle = { color = Color3.fromRGB(70, 170, 70), material = Enum.Material.LeafyGrass },
		ocean = { color = Color3.fromRGB(60, 150, 230), material = Enum.Material.Glass },
		rebirth = { color = Color3.fromRGB(255, 120, 40), material = Enum.Material.Neon },
	}
	for i, egg in ipairs(CollectionConfig.Eggs) do
		local x = (i - (#CollectionConfig.Eggs + 1) / 2) * 6
		part({ Name = "Pedestal", Size = Vector3.new(3, 3, 3), CFrame = center * CFrame.new(x, 2.5, 0), Color = Color3.fromRGB(235, 235, 240), Material = Enum.Material.Marble })
		local look = looks[egg.id] or looks.basic
		local shell = part({ Name = "Egg", Size = Vector3.new(3, 4, 3), CFrame = center * CFrame.new(x, 6, 0), Color = look.color, Material = look.material, CanCollide = false })
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = shell
		eggLabels[egg.id] = billboard(shell, "", 3.2, 200)
	end
end

local function buildCrateStand()
	local center = CFrame.new(-84, 0, 0)
	local base = part({ Name = "CrateStand", Size = Vector3.new(12, 1, 12), CFrame = center * CFrame.new(0, 0.5, 0), Color = Color3.fromRGB(40, 70, 120), Material = Enum.Material.Marble })
	billboard(base, "📦 CAJAS DE BALONES", 11, 300)
	openPrompt(base, "Abrir cajas", "Balones", "collection", { tab = "balls" })
	part({ Name = "Crate", Size = Vector3.new(5, 5, 5), CFrame = center * CFrame.new(-3, 3.5, 0) * CFrame.Angles(0, math.rad(20), 0), Color = Color3.fromRGB(160, 110, 60), Material = Enum.Material.WoodPlanks })
	part({ Name = "EliteCrate", Size = Vector3.new(4, 4, 4), CFrame = center * CFrame.new(3, 3, 1) * CFrame.Angles(0, math.rad(-15), 0), Color = GOLD, Material = Enum.Material.Metal })
	local ballShow = part({ Name = "Ball", Shape = Enum.PartType.Ball, Size = Vector3.new(2.6, 2.6, 2.6), CFrame = center * CFrame.new(0, 7.5, 0),
		Color = Color3.fromRGB(110, 60, 220), Material = Enum.Material.Neon, CanCollide = false })
	local sparkles = Instance.new("Sparkles")
	sparkles.SparkleColor = Color3.fromRGB(200, 160, 255)
	sparkles.Parent = ballShow
end

local function formatDate(timestamp)
	return os.date("!%d/%m", timestamp)
end

-- Textos que dependen de la fecha (temporada, semana y precios con descuento)
local function refreshTexts()
	local season = SeasonConfig.Current()
	local weekly = WeeklyConfig.Current()
	local bonus = WeeklyConfig.Bonus(weekly.bonusId)
	local theme = ArenaConfig.Theme(weekly.themeId)
	seasonLabel.Text = string.format(
		"%s <b>%s</b> (temporada %d)\nTermina el %s · 20 niveles de premios\n\n📅 <b>Esta semana:</b> %s %s\n%s Estadio destacado: %s\nCambia el %s",
		season.theme.icon, season.theme.name, season.number, formatDate(season.endsAt),
		bonus.icon, bonus.name, theme.icon, theme.name, formatDate(weekly.endsAt))
	for _, egg in ipairs(CollectionConfig.Eggs) do
		local label = eggLabels[egg.id]
		if label then
			label.Text = string.format("%s %s\n<font color='#FFD23C'>%d $</font>", egg.icon, egg.name, PetService.EggCost(egg))
		end
	end
end

-- Lo llama LeaderboardService con el top 10 mundial de cada clasificación
function HubService.SetLeaderboard(boardId, list, available)
	local label = boardLabels[boardId]
	if not label then
		return
	end
	if not available then
		label.Text = "La clasificación mundial no está disponible en esta sesión."
		return
	end
	if #list == 0 then
		label.Text = "Todavía no hay nadie.\n¡Juega un partido en grupo y sé el primero!"
		return
	end
	local lines = {}
	for position, entry in ipairs(list) do
		local medal = position == 1 and "🥇" or (position == 2 and "🥈" or (position == 3 and "🥉" or string.format("%d.", position)))
		table.insert(lines, string.format("%s %s — <b>%d</b>", medal, entry.name, entry.value))
	end
	label.Text = table.concat(lines, "\n")
end

local function polishLighting()
	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local atmosphere = Instance.new("Atmosphere")
		atmosphere.Density = 0.28
		atmosphere.Offset = 0.2
		atmosphere.Haze = 1.2
		atmosphere.Glare = 0.2
		atmosphere.Color = Color3.fromRGB(200, 215, 235)
		atmosphere.Decay = Color3.fromRGB(110, 125, 150)
		atmosphere.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 0.35
		bloom.Size = 24
		bloom.Threshold = 1.1
		bloom.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("ColorCorrectionEffect") then
		local color = Instance.new("ColorCorrectionEffect")
		color.Saturation = 0.12
		color.Contrast = 0.06
		color.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("SunRaysEffect") then
		local rays = Instance.new("SunRaysEffect")
		rays.Intensity = 0.06
		rays.Spread = 0.8
		rays.Parent = Lighting
	end
end

function HubService.Start()
	folder = Instance.new("Folder")
	folder.Name = "FEU_Hub"
	folder.Parent = Workspace
	buildEggStand()
	buildCrateStand()
	-- Tablones a los lados del punto de aparición, mirando hacia él
	local seasonBoard, seasonBody = board(CFrame.new(0, 11, 22), Enum.NormalId.Front, "🎟️ PASE DE TEMPORADA", GOLD)
	seasonLabel = seasonBody
	openPrompt(seasonBoard, "Ver el pase", "Pase de temporada", "season")
	local _, goalsBody = board(CFrame.new(0, 11, -22), Enum.NormalId.Back, "⚽ TOP GOLEADORES DEL MUNDO", Color3.fromRGB(90, 220, 255))
	boardLabels.goals = goalsBody
	goalsBody.Text = "Cargando la clasificación…"
	local trophyBoard, trophyBody = board(CFrame.new(30, 11, -22), Enum.NormalId.Back, "🏆 TOP TROFEOS DEL MUNDO", GOLD)
	boardLabels.trophies = trophyBody
	trophyBody.Text = "Cargando la clasificación…"
	openPrompt(trophyBoard, "Ver mi camino", "Camino de trofeos", "trophies")
	polishLighting()
	task.spawn(function()
		while true do
			refreshTexts()
			task.wait(600)
		end
	end)
end

return HubService
