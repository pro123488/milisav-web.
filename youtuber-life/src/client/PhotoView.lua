--!nonstrict
-- PhotoView (cliente): muestra una fotografía virtual. Cada foto guarda la posición y dirección de la cámara,
-- así que se vuelve a "revelar" clonando las piezas cercanas de la ciudad dentro de un ViewportFrame.
-- Los filtros se simulan con capas de color. Si la foto no tiene cámara guardada, se dibuja una tarjeta.

local UI = require(script.Parent.UIKit)
local T = UI.Theme

local PhotoView = {}
local MAX_PARTS = 320
local RADIUS = 170

local filterTint = {
	[2] = { Color3.fromRGB(255, 60, 160), 0.92 }, -- Vívido
	[3] = { Color3.fromRGB(255, 150, 40), 0.82 }, -- Cálido
	[4] = { Color3.fromRGB(40, 140, 255), 0.82 }, -- Frío
	[5] = { Color3.fromRGB(128, 128, 128), 0.35 }, -- B/N (aproximado)
	[6] = { Color3.fromRGB(160, 110, 60), 0.6 }, -- Vintage
	[7] = { Color3.fromRGB(0, 40, 60), 0.85 }, -- Cine
}

local function skyColor(hour)
	if hour >= 7 and hour < 17 then
		return Color3.fromRGB(130, 190, 250)
	elseif (hour >= 5.5 and hour < 7) or (hour >= 17 and hour < 19.5) then
		return Color3.fromRGB(255, 160, 110)
	end
	return Color3.fromRGB(15, 20, 45)
end

function PhotoView.render(parent, photo, size)
	local holder = UI.frame(parent, { Size = size or UDim2.fromScale(1, 1), Color = T.Bg, Clip = true, Name = "Photo" })
	if not photo then
		UI.label(holder, "Sin foto", { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, Color = T.Sub })
		return holder
	end
	local cam = photo.Cam
	local city = workspace:FindFirstChild("City")
	if cam and city then
		local vp = UI.new("ViewportFrame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = skyColor(photo.Hour or 12), BorderSizePixel = 0, Parent = holder })
		local night = (photo.Hour or 12) < 6 or (photo.Hour or 12) >= 19.5
		vp.Ambient = night and Color3.fromRGB(70, 70, 110) or Color3.fromRGB(170, 170, 170)
		vp.LightColor = night and Color3.fromRGB(120, 120, 180) or Color3.fromRGB(255, 245, 230)
		vp.LightDirection = Vector3.new(-0.4, -1, -0.3)
		local camera = Instance.new("Camera")
		local pos = Vector3.new(cam[1], cam[2], cam[3])
		local look = Vector3.new(cam[4], cam[5], cam[6])
		if (look - pos).Magnitude < 0.01 then
			look = pos + Vector3.new(0, 0, -1)
		end
		camera.CFrame = CFrame.lookAt(pos, look)
		camera.FieldOfView = photo.Fov or 70
		camera.Parent = vp
		vp.CurrentCamera = camera
		local world = Instance.new("WorldModel")
		world.Parent = vp
		local dir = (look - pos).Unit
		local candidates = {}
		for _, d in ipairs(city:GetDescendants()) do
			if d:IsA("BasePart") and d.Transparency < 1 then
				local rel = d.Position - pos
				local reach = d.Size.Magnitude / 2
				local dist = rel.Magnitude - reach
				if dist < RADIUS and (rel:Dot(dir) > -reach - 5) then
					candidates[#candidates + 1] = { part = d, dist = dist }
				end
			end
		end
		table.sort(candidates, function(a, b)
			return a.dist < b.dist
		end)
		for i = 1, math.min(MAX_PARTS, #candidates) do
			local ok, clone = pcall(function()
				return candidates[i].part:Clone()
			end)
			if ok and clone then
				for _, child in ipairs(clone:GetChildren()) do
					if not child:IsA("SurfaceGui") and not child:IsA("Decal") then
						child:Destroy()
					end
				end
				clone.Parent = world
			end
		end
	else
		local g = UI.frame(holder, { Size = UDim2.fromScale(1, 1), Color = T.Panel2, Radius = false })
		UI.new("UIGradient", { Color = ColorSequence.new(skyColor(photo.Hour or 12), T.Panel2), Rotation = 90, Parent = g })
		UI.label(g, "📷 " .. (photo.SpotName or "Foto"), { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold })
	end
	local tint = filterTint[photo.Filter or 1]
	if tint then
		local overlay = UI.frame(holder, { Size = UDim2.fromScale(1, 1), Color = tint[1], Transparency = tint[2], Radius = false })
		overlay.ZIndex = 3
		if photo.Filter == 7 then
			for _, y in ipairs({ 0, 0.88 }) do
				local bar = UI.frame(holder, { Size = UDim2.new(1, 0, 0.12, 0), Position = UDim2.fromScale(0, y), Color = Color3.new(0, 0, 0), Radius = false })
				bar.ZIndex = 4
			end
		end
	end
	return holder
end

return PhotoView
