-- KitPattern (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/KitPattern
-- Dibuja una plantilla de equipación con Frames. Lo usan la interfaz (vista previa)
-- y el servidor (expositor de equipación del estadio, en un SurfaceGui).

local KitPattern = {}

local function block(parent, color, pos, size, rotation)
	local f = Instance.new("Frame")
	f.Name = "KitPart"
	f.BorderSizePixel = 0
	f.BackgroundColor3 = color
	f.Position = pos
	f.Size = size
	f.Rotation = rotation or 0
	f.Parent = parent
	return f
end

function KitPattern.Build(parent, pattern, primary, secondary)
	for _, child in ipairs(parent:GetChildren()) do
		if child.Name == "KitPart" then
			child:Destroy()
		end
	end
	parent.BackgroundColor3 = primary
	parent.ClipsDescendants = true

	if pattern == "vstripes" then
		for i = 0, 3 do
			block(parent, secondary, UDim2.fromScale(0.08 + i * 0.25, 0), UDim2.fromScale(0.12, 1))
		end
	elseif pattern == "halves" then
		block(parent, secondary, UDim2.fromScale(0.5, 0), UDim2.fromScale(0.5, 1))
	elseif pattern == "hoops" then
		for i = 0, 3 do
			block(parent, secondary, UDim2.fromScale(0, 0.08 + i * 0.25), UDim2.fromScale(1, 0.12))
		end
	elseif pattern == "sash" then
		block(parent, secondary, UDim2.fromScale(-0.25, 0.42), UDim2.fromScale(1.5, 0.18), -40)
	elseif pattern == "chest" then
		block(parent, secondary, UDim2.fromScale(0, 0.35), UDim2.fromScale(1, 0.25))
	elseif pattern == "quarters" then
		block(parent, secondary, UDim2.fromScale(0.5, 0), UDim2.fromScale(0.5, 0.5))
		block(parent, secondary, UDim2.fromScale(0, 0.5), UDim2.fromScale(0.5, 0.5))
	end
	-- Cuello
	block(parent, secondary, UDim2.fromScale(0.38, 0), UDim2.fromScale(0.24, 0.07))
end

return KitPattern
