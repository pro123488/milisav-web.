-- PlacementRules (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/PlacementRules
--
-- Reglas de colocación libre de decoraciones (CONSTRUCCIÓN AVANZADA, FASE 2).
-- El cliente las usa para colorear la vista previa; el SERVIDOR las vuelve a
-- aplicar antes de aceptar cualquier colocación. Constructor Pro solo cambia la
-- rejilla y el paso de rotación: las zonas, las colisiones y los límites son los mismos.

local Shared = script.Parent.Parent
local GameConfig = require(Shared.Config.GameConfig)
local CosmeticConfig = require(Shared.Config.CosmeticConfig)
local StadiumLayout = require(script.Parent.StadiumLayout)

local PlacementRules = {}

local MARGIN = 0.5 -- separación mínima entre decoraciones

function PlacementRules.Tools(isPro)
	return {
		grid = isPro and GameConfig.PRO_GRID or GameConfig.FREE_GRID,
		rotationStep = isPro and GameConfig.PRO_ROTATION_STEP or GameConfig.FREE_ROTATION_STEP,
	}
end

local function isMultiple(value, step)
	local q = value / step
	return math.abs(q - math.floor(q + 0.5)) < 1e-6
end

function PlacementRules.Snap(value, step)
	return math.floor(value / step + 0.5) * step
end

-- Semiejes del rectángulo envolvente (AABB) de una decoración rotada.
function PlacementRules.HalfExtents(decoId, rotation)
	local item = CosmeticConfig.ById.decoration[decoId]
	local w, d = item and item.w or 4, item and item.d or 4
	local r = math.rad(rotation or 0)
	local c, s = math.abs(math.cos(r)), math.abs(math.sin(r))
	return (w * c + d * s) / 2, (w * s + d * c) / 2
end

local function rectOf(decoId, x, z, rotation)
	local hx, hz = PlacementRules.HalfExtents(decoId, rotation)
	return { xMin = x - hx, xMax = x + hx, zMin = z - hz, zMax = z + hz }
end
PlacementRules.RectOf = rectOf

local function overlaps(a, b, margin)
	margin = margin or 0
	return a.xMin < b.xMax + margin and a.xMax > b.xMin - margin
		and a.zMin < b.zMax + margin and a.zMax > b.zMin - margin
end

local function inside(rect, zone)
	return rect.xMin >= zone.xMin and rect.xMax <= zone.xMax and rect.zMin >= zone.zMin and rect.zMax <= zone.zMax
end

local function finite(n)
	return type(n) == "number" and n == n and n ~= math.huge and n ~= -math.huge
end

-- params = { decorations, decoId, x, z, rotation, isPro, ignoreIndex }
-- Devuelve ok, motivo
function PlacementRules.Validate(params)
	local x, z, rotation = params.x, params.z, params.rotation
	if not finite(x) or not finite(z) or not finite(rotation) then
		return false, "Posición no válida."
	end
	if not CosmeticConfig.ById.decoration[params.decoId] then
		return false, "Esa decoración no existe."
	end
	local tools = PlacementRules.Tools(params.isPro)
	if rotation < 0 or rotation >= 360 or not isMultiple(rotation, tools.rotationStep) then
		return false, params.isPro and "Rotación no válida." or "La rotación libre a 45° es una herramienta de Constructor Pro."
	end
	if not isMultiple(x, tools.grid) or not isMultiple(z, tools.grid) then
		return false, params.isPro and "Posición fuera de la rejilla." or "La rejilla fina es una herramienta de Constructor Pro."
	end

	local rect = rectOf(params.decoId, x, z, rotation)
	local inZone = false
	for _, zone in ipairs(StadiumLayout.DecorationZones) do
		if inside(rect, zone) then
			inZone = true
			break
		end
	end
	if not inZone then
		return false, "Fuera de la zona de decoración de tu terreno."
	end
	for _, reserved in ipairs(StadiumLayout.Reserved) do
		if overlaps(rect, reserved) then
			return false, "Esa zona está reservada: " .. reserved.name .. "."
		end
	end
	for index, other in ipairs(params.decorations or {}) do
		if index ~= params.ignoreIndex then
			if overlaps(rect, rectOf(other.id, other.x, other.z, other.r), MARGIN) then
				return false, "Choca con otra decoración."
			end
		end
	end
	return true
end

return PlacementRules
