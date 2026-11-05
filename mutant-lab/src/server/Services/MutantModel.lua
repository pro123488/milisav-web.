--!nonstrict
-- MutantModel: construye el modelo 3D de un mutante a partir de su ficha (piezas sencillas, sin recursos externos).
-- El modelo mira hacia -Z (LookVector) y apoya los pies en el origen del CFrame que se le pasa.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local Util = require(ReplicatedStorage.Shared.Util)

local MM = {}

local function c3(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

-- Crea una pieza relativa al CFrame base del modelo
local function piece(model, base, name, shape, size, offset, color, material, transparency)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = true
	p.Material = material or Enum.Material.SmoothPlastic
	p.Color = c3(color)
	p.Transparency = transparency or 0
	if shape == "ball" then
		p.Shape = Enum.PartType.Ball
		p.Size = size
		p.CFrame = base * offset
	elseif shape == "cyl" then
		-- los cilindros de Roblox van a lo largo del eje X: se giran para que queden de pie
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(size.Y, size.X, size.Z)
		p.CFrame = base * offset * CFrame.Angles(0, 0, math.pi / 2)
	else
		p.Size = size
		p.CFrame = base * offset
	end
	p.Parent = model
	return p
end

local function eye(model, base, pos, d, pupilColor)
	piece(model, base, "Eye", "ball", Vector3.new(d, d, d), CFrame.new(pos), { 255, 255, 255 })
	piece(model, base, "Pupil", "ball", Vector3.new(d * 0.5, d * 0.5, d * 0.5), CFrame.new(pos + Vector3.new(0, 0, -d * 0.32)), pupilColor or { 20, 20, 24 })
end

-- rec = { S = especie, M = mutación, L = nivel }; opts = { scale = n, label = true, price = n }
function MM.build(rec, cf, opts)
	opts = opts or {}
	local sp = MutantData.SpeciesById[rec.S]
	local rarity = MutantData.RarityById[sp.Rarity]
	local mut = rec.M and MutantData.MutationById[rec.M]
	local level = rec.L or 1
	local sc = (opts.scale or 1) * (1 + 0.12 * (level - 1))
	local model = Instance.new("Model")
	model.Name = sp.Name
	local sx, sy, sz = sp.Scale[1] * sc, sp.Scale[2] * sc, sp.Scale[3] * sc
	local c1, c2 = sp.C1, sp.C2
	local bodyMat = sp.Glass and Enum.Material.Glass or Enum.Material.SmoothPlastic
	local bodyT = sp.Ghost and 0.35 or (sp.Glass and 0.25 or 0)
	local has = {}
	for _, p in ipairs(sp.Parts) do
		has[p] = true
	end

	local legH = has.legs and 0.7 * sc or 0
	local by = legH + sy / 2 -- centro del cuerpo
	local body = piece(model, cf, "Body", sp.Body, Vector3.new(sx, sy, sz), CFrame.new(0, by, 0), c1, bodyMat, bodyT)
	model.PrimaryPart = body
	local front = -sz / 2

	-- ojos
	local eyeD = math.min(sx, sy) * (has.bigeye and 0.62 or 0.3)
	if sp.Eyes == 1 then
		eye(model, cf, Vector3.new(0, by + sy * 0.12, front * 0.92), eyeD)
	elseif sp.Eyes >= 2 then
		for i = 1, sp.Eyes do
			local t = sp.Eyes == 2 and (i == 1 and -1 or 1) or (i - 2)
			eye(model, cf, Vector3.new(t * sx * 0.22, by + sy * 0.15, front * 0.9), eyeD)
		end
	end
	if has.mouth then
		piece(model, cf, "Mouth", "block", Vector3.new(sx * 0.4, sy * 0.1, 0.2 * sc), CFrame.new(0, by - sy * 0.15, front * 0.95), { 40, 10, 20 })
	end
	if has.legs then
		for _, q in ipairs({ { -1, -1 }, { 1, -1 }, { -1, 1 }, { 1, 1 } }) do
			piece(model, cf, "Leg", "cyl", Vector3.new(0.5 * sc, legH + 0.3, 0.5 * sc), CFrame.new(q[1] * sx * 0.3, legH / 2, q[2] * sz * 0.3), c2)
		end
	end
	if has.eyestalks then
		for _, s in ipairs({ -1, 1 }) do
			piece(model, cf, "Stalk", "cyl", Vector3.new(0.3 * sc, 0.9 * sc, 0.3 * sc), CFrame.new(s * sx * 0.25, by + sy * 0.5 + 0.3 * sc, front * 0.4), c1)
			eye(model, cf, Vector3.new(s * sx * 0.25, by + sy * 0.5 + 0.9 * sc, front * 0.4), 0.7 * sc)
		end
	end
	if has.segments then
		for i = 1, 3 do
			local d = sx * (1 - i * 0.18)
			piece(model, cf, "Segment", "ball", Vector3.new(d, d, d), CFrame.new(0, d / 2 + legH, sz * 0.45 * i), i % 2 == 0 and c1 or c2)
		end
	end
	if has.bubbles then
		for i = 1, 3 do
			local a = i * 2.1
			local d = 0.6 * sc
			piece(model, cf, "Bubble", "ball", Vector3.new(d, d, d), CFrame.new(math.cos(a) * sx * 0.7, by + sy * 0.5 + i * 0.4 * sc, math.sin(a) * sz * 0.7), c2, Enum.Material.Glass, 0.4)
		end
	end
	if has.cap then
		piece(model, cf, "Cap", "ball", Vector3.new(sx * 2.1, sy * 0.9, sz * 2.1), CFrame.new(0, by + sy * 0.55, 0), c2)
		for i = 1, 4 do
			local a = i * 1.6
			piece(model, cf, "Dot", "ball", Vector3.new(0.45 * sc, 0.25 * sc, 0.45 * sc), CFrame.new(math.cos(a) * sx * 0.6, by + sy * 0.92, math.sin(a) * sz * 0.6), { 255, 255, 255 })
		end
	end
	local function tentacles(n, len, off)
		for i = 1, n do
			local a = (i / n) * math.pi * 2 + (off or 0)
			piece(model, cf, "Tentacle", "block", Vector3.new(0.35 * sc, len, 0.35 * sc),
				CFrame.new(math.cos(a) * sx * 0.32, by - sy * 0.45, math.sin(a) * sz * 0.32) * CFrame.Angles(math.sin(a) * 0.5, 0, -math.cos(a) * 0.5) * CFrame.new(0, -len / 2, 0), c2)
		end
	end
	if has.tentacles then
		tentacles(4, sy * 0.7, 0.4)
	end
	if has.tentacles2 then
		tentacles(4, sy * 0.55, 1.2)
	end
	if has.wings or has.bigwings then
		local w = has.bigwings and 2.4 or 1.4
		for _, s in ipairs({ -1, 1 }) do
			piece(model, cf, "Wing", "block", Vector3.new(sx * w, 0.2 * sc, sz * 0.7), CFrame.new(s * (sx / 2 + sx * w * 0.4), by + sy * 0.25, 0) * CFrame.Angles(0, 0, s * 0.35),
				c2, has.bigwings and Enum.Material.Neon or Enum.Material.SmoothPlastic, has.bigwings and 0.15 or 0)
		end
	end
	if has.ears then
		for _, s in ipairs({ -1, 1 }) do
			piece(model, cf, "Ear", "block", Vector3.new(0.5 * sc, 0.8 * sc, 0.3 * sc), CFrame.new(s * sx * 0.3, by + sy * 0.55, front * 0.4) * CFrame.Angles(0, 0, s * 0.3), c2)
		end
	end
	if has.arms then
		for _, s in ipairs({ -1, 1 }) do
			piece(model, cf, "Arm", "block", Vector3.new(sx * 0.6, 0.45 * sc, 0.45 * sc), CFrame.new(s * sx * 0.75, by, 0) * CFrame.Angles(0, 0, s * 0.5), c1)
		end
	end
	if has.spikes then
		for i = 1, 5 do
			local a = i * 1.25
			piece(model, cf, "Spike", "block", Vector3.new(0.3 * sc, 0.8 * sc, 0.3 * sc), CFrame.new(math.cos(a) * sx * 0.3, by + sy * 0.5, math.sin(a) * sz * 0.3) * CFrame.Angles(0.3, a, 0.3), c2)
		end
	end
	if has.antenna then
		piece(model, cf, "Antenna", "cyl", Vector3.new(0.15 * sc, 1.4 * sc, 0.15 * sc), CFrame.new(0, by + sy / 2 + 0.7 * sc, 0), { 60, 60, 70 })
		piece(model, cf, "AntennaTip", "ball", Vector3.new(0.5 * sc, 0.5 * sc, 0.5 * sc), CFrame.new(0, by + sy / 2 + 1.45 * sc, 0), c2, Enum.Material.Neon)
	end
	if has.tail then
		piece(model, cf, "Tail", "block", Vector3.new(0.5 * sc, 0.5 * sc, sz * 0.7), CFrame.new(0, by - sy * 0.1, sz / 2 + sz * 0.3) * CFrame.Angles(0.4, 0, 0), c2)
	end
	if has.visor then
		piece(model, cf, "Visor", "block", Vector3.new(sx * 0.8, sy * 0.18, 0.2 * sc), CFrame.new(0, by + sy * 0.15, front * 1.02), c2, Enum.Material.Neon)
	end
	if has.horns then
		for _, s in ipairs({ -1, 1 }) do
			piece(model, cf, "Horn", "block", Vector3.new(0.35 * sc, 1.1 * sc, 0.35 * sc), CFrame.new(s * sx * 0.25, by + sy * 0.55, front * 0.3) * CFrame.Angles(-0.3, 0, s * 0.35), { 240, 230, 210 })
		end
	end
	if has.crystals then
		for i = 1, 4 do
			piece(model, cf, "Crystal", "block", Vector3.new(0.6 * sc, (1 + i * 0.25) * sc, 0.6 * sc), CFrame.new((i - 2.5) * sx * 0.2, by + sy * 0.5, sz * 0.15) * CFrame.Angles(0.2 * i, i, 0.25), c2, Enum.Material.Neon, 0.2)
		end
	end
	if has.skirt then
		piece(model, cf, "Skirt", "cyl", Vector3.new(sx * 0.9, sy * 0.5, sz * 0.9), CFrame.new(0, by - sy * 0.45, 0), c1, Enum.Material.SmoothPlastic, 0.45)
	end
	if has.cracks then
		for i = 1, 4 do
			piece(model, cf, "Crack", "block", Vector3.new(sx * 0.7, 0.12 * sc, 0.12 * sc), CFrame.new(0, by + (i - 2.5) * sy * 0.18, front * 0.98) * CFrame.Angles(0, 0, i * 0.7), c2, Enum.Material.Neon)
		end
	end
	if has.necks then
		for i = -1, 1 do
			local nx = i * sx * 0.32
			piece(model, cf, "Neck", "cyl", Vector3.new(0.7 * sc, 2.4 * sc, 0.7 * sc), CFrame.new(nx, by + sy / 2 + 1 * sc, front * 0.5) * CFrame.Angles(-0.3, 0, i * 0.25), c1)
			local hp = Vector3.new(nx * 1.5, by + sy / 2 + 2.2 * sc, front * 0.9)
			piece(model, cf, "Head", "block", Vector3.new(1.2 * sc, 0.9 * sc, 1.4 * sc), CFrame.new(hp), c1)
			eye(model, cf, hp + Vector3.new(0, 0.2 * sc, -0.6 * sc), 0.4 * sc, c2)
		end
	end
	if has.crest then
		for i = 1, 3 do
			piece(model, cf, "Crest", "block", Vector3.new(0.2 * sc, (0.6 + i * 0.2) * sc, 0.5 * sc), CFrame.new(0, by + sy / 2 + 0.3 * sc, (i - 2) * 0.5 * sc), c2, Enum.Material.Neon)
		end
	end
	if has.rings then
		for i = 1, 2 do
			local r = math.max(sx, sz) * (1.25 + 0.25 * i)
			piece(model, cf, "Ring", "cyl", Vector3.new(r, 0.15 * sc, r), CFrame.new(0, by, 0) * CFrame.Angles(i * 0.5, 0, i * 0.4), c2, Enum.Material.Neon, 0.3)
		end
	end
	if has.glow or mut then
		local light = Instance.new("PointLight")
		light.Range = 10 * sc
		light.Brightness = 1.5
		light.Color = c3(mut and mut.Color or c2)
		light.Parent = body
	end
	if mut then
		-- aura de mutación: anillo de neón en el suelo y destellos (objeto Sparkles incluido en Roblox)
		piece(model, cf, "Aura", "cyl", Vector3.new(math.max(sx, sz) * 1.5, 0.15, math.max(sx, sz) * 1.5), CFrame.new(0, 0.1, 0), mut.Color, Enum.Material.Neon, 0.35)
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = c3(mut.Color)
		sparkles.Parent = body
		if mut.Id == "shadow" then
			body.Color = Color3.fromRGB(40, 25, 60)
		elseif mut.Id == "crystal" then
			body.Material = Enum.Material.Glass
			body.Transparency = 0.2
		elseif mut.Id == "galaxy" then
			body.Material = Enum.Material.Neon
		end
	end

	if opts.label ~= false then
		local bb = Instance.new("BillboardGui")
		bb.Name = "Info"
		bb.Size = UDim2.new(0, 220, 0, 64)
		bb.StudsOffset = Vector3.new(0, sy / 2 + 2.6 + (has.necks and 2.5 * sc or 0), 0)
		bb.MaxDistance = opts.maxDistance or 70
		bb.AlwaysOnTop = false
		bb.Parent = body
		local function line(text, y, h, color, font)
			local t = Instance.new("TextLabel")
			t.BackgroundTransparency = 1
			t.Size = UDim2.new(1, 0, 0, h)
			t.Position = UDim2.new(0, 0, 0, y)
			t.Text = text
			t.TextColor3 = color
			t.TextStrokeTransparency = 0.3
			t.Font = font or Enum.Font.GothamBold
			t.TextScaled = true
			t.Parent = bb
			return t
		end
		local stars = level > 1 and (" " .. string.rep("★", level - 1)) or ""
		line((mut and (mut.Name .. " ") or "") .. sp.Name .. stars, 0, 22, mut and c3(mut.Color) or Color3.new(1, 1, 1), Enum.Font.GothamBlack)
		line(rarity.Name, 22, 18, c3(rarity.Color))
		local txt = "+" .. Util.short(MutantData.income(rec)) .. "/s"
		if opts.price then
			txt = "$" .. Util.short(opts.price) .. "  ·  " .. txt
		end
		line(txt, 40, 22, Color3.fromRGB(255, 230, 90))
	end
	return model
end

return MM
