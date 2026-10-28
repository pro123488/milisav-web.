-- PlacementController (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Controllers/PlacementController
--
-- CONSTRUCCIÓN AVANZADA (FASE 2): modo de colocación libre de decoraciones.
--   * Vista previa (fantasma) que sigue al ratón o al dedo sobre tu terreno.
--   * Verde = colocación válida, rojo = no válida (con el motivo).
--   * PC: clic para colocar, R para rotar, Q o Esc para cancelar.
--   * Móvil/tableta: toca para mover la vista previa y usa los botones.
-- La validación del cliente (PlacementRules) es solo orientativa: el servidor
-- repite exactamente las mismas comprobaciones antes de aceptar nada.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local PlacementRules = require(Shared.Modules.PlacementRules)
local StadiumLayout = require(Shared.Modules.StadiumLayout)

local UI = script.Parent.Parent:WaitForChild("UI")
local Theme = require(UI.Theme)
local C = require(UI.Components)

local player = Players.LocalPlayer

local PlacementController = {}
PlacementController.Active = false

local session -- estado de la colocación en curso

local function findPlotOrigin()
	local world = Workspace:FindFirstChild("FEU_World")
	local plots = world and world:FindFirstChild("Plots")
	if not plots then
		return nil
	end
	for _, model in ipairs(plots:GetChildren()) do
		if model:GetAttribute("OwnerUserId") == player.UserId then
			local base = model:FindFirstChild("Base")
			if base then
				-- La cara superior de la base es el plano local y = 0
				return base.CFrame * CFrame.new(0, base.Size.Y / 2, 0)
			end
		end
	end
	return nil
end

local function makeZoneMarker(parent, origin, rect, color, transparency)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Transparency = transparency
	p.Size = Vector3.new(rect.xMax - rect.xMin, 0.15, rect.zMax - rect.zMin)
	p.CFrame = origin * CFrame.new((rect.xMin + rect.xMax) / 2, 0.2, (rect.zMin + rect.zMax) / 2)
	p.Parent = parent
	return p
end

local function cleanup()
	if not session then
		return
	end
	for _, connection in ipairs(session.connections) do
		connection:Disconnect()
	end
	if session.folder then
		session.folder:Destroy()
	end
	if session.hud then
		session.hud:Destroy()
	end
	session = nil
	PlacementController.Active = false
end

local function validate()
	local s = session
	return PlacementRules.Validate({
		decorations = s.ctx.state.stadium.decorations,
		decoId = s.decoId,
		x = s.x,
		z = s.z,
		rotation = s.rotation,
		isPro = s.isPro,
		ignoreIndex = s.moveIndex,
	})
end

local function refreshGhost()
	local s = session
	if not s then
		return
	end
	s.ghost.CFrame = s.origin * CFrame.new(s.x, 1.5, s.z) * CFrame.Angles(0, math.rad(s.rotation), 0)
	local ok, reason = validate()
	s.valid = ok
	s.ghost.Color = ok and Theme.Accent or Theme.Danger
	s.statusLabel.Text = string.format("%s  ·  %s  ·  x %d, z %d, %d°",
		s.item.name, ok and "✅ Colocación válida" or ("⛔ " .. (reason or "No válida")),
		s.x, s.z, s.rotation)
	s.statusLabel.TextColor3 = ok and Theme.Text or Theme.Warning
end

-- Convierte una posición de pantalla en coordenadas locales del terreno (plano y = 0).
-- fromTouch = true: posición sin el margen de la barra superior (ScreenPointToRay).
local function screenToLocal(screenPos, fromTouch)
	local s = session
	local camera = Workspace.CurrentCamera
	local ray = fromTouch and camera:ScreenPointToRay(screenPos.X, screenPos.Y)
		or camera:ViewportPointToRay(screenPos.X, screenPos.Y)
	local planeY = s.origin.Position.Y
	if math.abs(ray.Direction.Y) < 1e-4 then
		return nil
	end
	local t = (planeY - ray.Origin.Y) / ray.Direction.Y
	if t < 0 or t > 2000 then
		return nil
	end
	local worldPoint = ray.Origin + ray.Direction * t
	return s.origin:PointToObjectSpace(worldPoint)
end

local function moveTo(screenPos, fromTouch)
	local s = session
	local localPoint = screenToLocal(screenPos, fromTouch)
	if not localPoint then
		return
	end
	local grid = s.tools.grid
	local x = PlacementRules.Snap(localPoint.X, grid)
	local z = PlacementRules.Snap(localPoint.Z, grid)
	-- Mantener la vista previa cerca de la plaza para que sea fácil de encontrar
	x = math.clamp(x, -StadiumLayout.HALF_X, StadiumLayout.HALF_X)
	z = math.clamp(z, -StadiumLayout.HALF_Z, StadiumLayout.HALF_Z)
	if x ~= s.x or z ~= s.z then
		s.x, s.z = x, z
		refreshGhost()
	end
end

local function rotate()
	local s = session
	s.rotation = (s.rotation + s.tools.rotationStep) % 360
	refreshGhost()
end

local function confirm()
	local s = session
	if not s or s.busy then
		return
	end
	if not s.valid then
		local _, reason = validate()
		s.ctx.notify("error", reason or "Colocación no válida.")
		return
	end
	s.busy = true
	local action = s.moveIndex and "MoveDecoration" or "PlaceDecoration"
	local result = s.ctx.act(action, {
		decoration = s.decoId,
		index = s.moveIndex,
		x = s.x,
		z = s.z,
		rotation = s.rotation,
	})
	if not session then
		return
	end
	s.busy = false
	if result.ok then
		local onFinish = s.onFinish
		cleanup()
		if onFinish then
			onFinish(true)
		end
	end
end

function PlacementController.Cancel()
	if not session then
		return
	end
	local onFinish = session.onFinish
	cleanup()
	if onFinish then
		onFinish(false)
	end
end

local function buildHud(s)
	local hud = C.New("ScreenGui", {
		Name = "FEU_Placement",
		ResetOnSpawn = false,
		DisplayOrder = 5,
	}, player:WaitForChild("PlayerGui"))
	local top = C.New("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 70),
		Size = UDim2.new(0.9, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Panel,
		Children = {
			C.Corner(), C.Stroke(Theme.Accent, 2), C.Padding(10, 14), C.List(nil, 4),
			C.New("UISizeConstraint", { MaxSize = Vector2.new(720, math.huge) }),
		},
	}, hud)
	C.Label("🏗️ <b>MODO CONSTRUCCIÓN</b>", { TextSize = 16, LayoutOrder = 1 }).Parent = top
	s.statusLabel = C.Label("", { TextSize = 14, LayoutOrder = 2 })
	s.statusLabel.Parent = top
	local hint = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
		and "Toca tu plaza para mover la vista previa. Zona azul = permitida, zonas rojas = reservadas."
		or "Mueve el ratón · Clic: colocar · R: rotar · Q/Esc: cancelar. Zona azul = permitida, zonas rojas = reservadas."
	C.Label(string.format("%s  Rejilla %d stud(s), rotación %d°%s.", hint, s.tools.grid, s.tools.rotationStep,
		s.isPro and " (Constructor Pro)" or ""), { TextSize = 12, TextColor3 = Theme.TextDim, LayoutOrder = 3 }).Parent = top

	local bar = C.Row({
		C.Button("⟳ Rotar", "secondary", rotate, { Size = UDim2.new(0, 120, 0, 50), AutomaticSize = Enum.AutomaticSize.None }),
		C.Button("✔ Confirmar", "primary", confirm, { Size = UDim2.new(0, 150, 0, 50), AutomaticSize = Enum.AutomaticSize.None }),
		C.Button("✕ Cancelar", "danger", PlacementController.Cancel, { Size = UDim2.new(0, 130, 0, 50), AutomaticSize = Enum.AutomaticSize.None }),
	}, 10, {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -24),
		Size = UDim2.new(0, 430, 0, 50),
		AutomaticSize = Enum.AutomaticSize.None,
	})
	bar.Parent = hud
	return hud
end

-- opts = { decoId, moveIndex?, onFinish(placed:boolean)? }
function PlacementController.Start(ctx, opts)
	if session then
		PlacementController.Cancel()
	end
	local item = CosmeticConfig.ById.decoration[opts.decoId]
	local origin = findPlotOrigin()
	if not item or not origin then
		ctx.notify("error", "No se encontró tu terreno. Espera a que se cargue tu estadio.")
		return false
	end
	local existing = opts.moveIndex and ctx.state.stadium.decorations[opts.moveIndex]
	local tools = ctx.state.stadium.tools
	session = {
		ctx = ctx,
		item = item,
		decoId = opts.decoId,
		moveIndex = opts.moveIndex,
		onFinish = opts.onFinish,
		origin = origin,
		tools = tools,
		isPro = ctx.state.premium.owned.CONSTRUCTOR_PRO == true,
		rotation = existing and existing.r or 0,
		x = existing and existing.x or 40,
		z = existing and existing.z or 88,
		connections = {},
	}
	local s = session
	PlacementController.Active = true

	s.folder = Instance.new("Folder")
	s.folder.Name = "FEU_PlacementPreview"
	s.folder.Parent = Workspace.CurrentCamera
	for _, zone in ipairs(StadiumLayout.DecorationZones) do
		makeZoneMarker(s.folder, origin, zone, Theme.Info, 0.8)
	end
	for _, reserved in ipairs(StadiumLayout.Reserved) do
		makeZoneMarker(s.folder, origin, reserved, Theme.Danger, 0.75)
	end
	s.ghost = Instance.new("Part")
	s.ghost.Anchored = true
	s.ghost.CanCollide = false
	s.ghost.CanQuery = false
	s.ghost.CanTouch = false
	s.ghost.CastShadow = false
	s.ghost.Material = Enum.Material.ForceField
	s.ghost.Transparency = 0.2
	s.ghost.Size = Vector3.new(item.w, 3, item.d)
	s.ghost.Parent = s.folder

	s.hud = buildHud(s)
	refreshGhost()

	local usingMouse = UserInputService.MouseEnabled
	table.insert(s.connections, RunService.RenderStepped:Connect(function()
		if session and usingMouse and not s.busy then
			moveTo(UserInputService:GetMouseLocation())
		end
	end))
	table.insert(s.connections, UserInputService.InputBegan:Connect(function(input, processed)
		if not session then
			return
		end
		if input.UserInputType == Enum.UserInputType.Touch then
			usingMouse = false
		end
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.R then
			rotate()
		elseif input.KeyCode == Enum.KeyCode.Q or input.KeyCode == Enum.KeyCode.Escape then
			PlacementController.Cancel()
		elseif input.UserInputType == Enum.UserInputType.MouseButton1 then
			usingMouse = true
			confirm()
		end
	end))
	table.insert(s.connections, UserInputService.TouchTap:Connect(function(positions, processed)
		if session and not processed and positions[1] then
			-- TouchTap da posiciones de pantalla sin el margen de la barra superior
			moveTo(Vector2.new(positions[1].X, positions[1].Y), true)
		end
	end))
	return true
end

return PlacementController
