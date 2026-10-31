-- mocks.lua: simulación mínima de la API de Roblox para ejecutar los servicios del servidor en Lua 5.1.
-- No es un emulador completo: solo lo necesario para probar la lógica del juego.

local M = {}
M.time = 1700000000
M.clock = 1000
M.kicked = {}
M.store = {}
M.storeFails = false
M.isStudio = false

-------------------------------------------------------------------- Vector3
local V3 = {}
V3.__index = function(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
		return M.Vector3.new(v.X / m, v.Y / m, v.Z / m)
	end
	return rawget(V3, k)
end
V3.__add = function(a, b)
	return M.Vector3.new(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
V3.__sub = function(a, b)
	return M.Vector3.new(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
V3.__mul = function(a, b)
	if type(a) == "number" then
		a, b = b, a
	end
	if type(b) == "number" then
		return M.Vector3.new(a.X * b, a.Y * b, a.Z * b)
	end
	return M.Vector3.new(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3.__div = function(a, b)
	return M.Vector3.new(a.X / b, a.Y / b, a.Z / b)
end
V3.__unm = function(a)
	return M.Vector3.new(-a.X, -a.Y, -a.Z)
end
V3.__tostring = function(v)
	return string.format("V3(%.1f,%.1f,%.1f)", v.X, v.Y, v.Z)
end
M.Vector3 = {
	new = function(x, y, z)
		return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0, __type = "Vector3" }, V3)
	end,
}
M.Vector3.zero = M.Vector3.new(0, 0, 0)

-------------------------------------------------------------------- CFrame (rotación 3x3 + posición)
local CF = {}
local function cfNew(px, py, pz, r)
	return setmetatable({ p = M.Vector3.new(px, py, pz), r = r or { 1, 0, 0, 0, 1, 0, 0, 0, 1 }, __type = "CFrame" }, CF)
end
local function matmul(a, b)
	local r = {}
	for i = 0, 2 do
		for j = 0, 2 do
			local s = 0
			for k = 0, 2 do
				s = s + a[i * 3 + k + 1] * b[k * 3 + j + 1]
			end
			r[i * 3 + j + 1] = s
		end
	end
	return r
end
local function rotate(r, v)
	return M.Vector3.new(r[1] * v.X + r[2] * v.Y + r[3] * v.Z, r[4] * v.X + r[5] * v.Y + r[6] * v.Z, r[7] * v.X + r[8] * v.Y + r[9] * v.Z)
end
CF.__index = function(c, k)
	if k == "Position" then
		return rawget(c, "p")
	elseif k == "X" then
		return c.p.X
	elseif k == "Y" then
		return c.p.Y
	elseif k == "Z" then
		return c.p.Z
	elseif k == "LookVector" then
		return rotate(c.r, M.Vector3.new(0, 0, -1))
	end
	return rawget(CF, k)
end
CF.__mul = function(a, b)
	if b.__type == "Vector3" then
		return a.p + rotate(a.r, b)
	end
	local p = a.p + rotate(a.r, b.p)
	return cfNew(p.X, p.Y, p.Z, matmul(a.r, b.r))
end
CF.__add = function(a, v)
	return cfNew(a.p.X + v.X, a.p.Y + v.Y, a.p.Z + v.Z, a.r)
end
M.CFrame = {
	new = function(x, y, z)
		if type(x) == "table" then
			return cfNew(x.X, x.Y, x.Z)
		end
		return cfNew(x or 0, y or 0, z or 0)
	end,
	Angles = function(rx, ry, rz)
		local cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
		local X = { 1, 0, 0, 0, cx, -sx, 0, sx, cx }
		local Y = { cy, 0, sy, 0, 1, 0, -sy, 0, cy }
		local Z = { cz, -sz, 0, sz, cz, 0, 0, 0, 1 }
		return cfNew(0, 0, 0, matmul(matmul(X, Y), Z))
	end,
	lookAt = function(pos, target)
		return cfNew(pos.X, pos.Y, pos.Z)
	end,
}

-------------------------------------------------------------------- Color3, UDim2, Enum, Random
M.Color3 = {
	fromRGB = function(r, g, b)
		return { R = r / 255, G = g / 255, B = b / 255, __type = "Color3" }
	end,
	new = function(r, g, b)
		return { R = r, G = g, B = b, __type = "Color3" }
	end,
}
M.UDim2 = {
	new = function(a, b, c, d)
		return { a, b, c, d }
	end,
	fromScale = function(a, b)
		return { a, 0, b, 0 }
	end,
	fromOffset = function(a, b)
		return { 0, a, 0, b }
	end,
}
M.UDim = {
	new = function(a, b)
		return { a, b }
	end,
}
local enumMeta = {}
enumMeta.__index = function(t, k)
	local v = setmetatable({ Name = k, __enum = rawget(t, "__name") }, enumMeta)
	rawset(t, k, v)
	return v
end
M.Enum = setmetatable({}, {
	__index = function(t, k)
		local e = setmetatable({ __name = k }, enumMeta)
		rawset(t, k, e)
		return e
	end,
})
M.Random = {
	new = function(seed)
		local state = (seed or 1) % 2147483647
		if state <= 0 then
			state = state + 2147483646
		end
		local function nxt()
			state = (state * 16807) % 2147483647
			return state / 2147483647
		end
		return {
			NextNumber = function(self, a, b)
				a, b = a or 0, b or 1
				return a + (b - a) * nxt()
			end,
			NextInteger = function(self, a, b)
				return math.floor(a + (b - a + 1) * nxt())
			end,
		}
	end,
}

-------------------------------------------------------------------- Señales
local Signal = {}
Signal.__index = Signal
function Signal.new()
	return setmetatable({ handlers = {} }, Signal)
end
function Signal:Connect(fn)
	table.insert(self.handlers, fn)
	return { Disconnect = function() end }
end
function Signal:Fire(...)
	for _, h in ipairs(self.handlers) do
		h(...)
	end
end
M.Signal = Signal

-------------------------------------------------------------------- Instancias
local EVENTS = { Triggered = true, OnServerEvent = true, OnClientEvent = true, PlayerAdded = true, PlayerRemoving = true,
	CharacterAdded = true, Changed = true, Touched = true, PromptGamePassPurchaseFinished = true, Heartbeat = true }

local Inst = {}
local tags = {}
M.tags = tags
M.instCount = 0

Inst.__index = function(self, k)
	local props = rawget(self, "__props")
	if props[k] ~= nil then
		return props[k]
	end
	if k == "Position" and props.CFrame then
		return props.CFrame.Position
	end
	local m = rawget(Inst, k)
	if m then
		return m
	end
	for _, c in ipairs(rawget(self, "__children")) do
		if c.__props.Name == k then
			return c
		end
	end
	if EVENTS[k] then
		local s = Signal.new()
		props[k] = s
		return s
	end
	return nil
end
Inst.__newindex = function(self, k, v)
	if k == "Parent" then
		local old = self.__props.Parent
		if old then
			for i, c in ipairs(old.__children) do
				if c == self then
					table.remove(old.__children, i)
					break
				end
			end
		end
		if v then
			table.insert(v.__children, self)
		end
	end
	self.__props[k] = v
end
Inst.__tostring = function(self)
	return tostring(self.__props.Name or self.__props.ClassName)
end

function M.newInstance(class, props)
	M.instCount = M.instCount + 1
	local o = setmetatable({ __props = { ClassName = class, Name = class, Attributes = {} }, __children = {}, __type = "Instance" }, Inst)
	for k, v in pairs(props or {}) do
		o[k] = v
	end
	return o
end
function Inst:IsA(class)
	local c = self.__props.ClassName
	if c == class then
		return true
	end
	if class == "BasePart" then
		return c == "Part" or c == "WedgePart" or c == "SpawnLocation" or c == "MeshPart"
	end
	if class == "Light" then
		return c == "PointLight" or c == "SpotLight" or c == "SurfaceLight"
	end
	return false
end
function Inst:FindFirstChild(name)
	for _, c in ipairs(self.__children) do
		if c.__props.Name == name then
			return c
		end
	end
	return nil
end
function Inst:WaitForChild(name)
	return self:FindFirstChild(name)
end
function Inst:FindFirstChildOfClass(class)
	for _, c in ipairs(self.__children) do
		if c.__props.ClassName == class then
			return c
		end
	end
	return nil
end
function Inst:FindFirstChildWhichIsA(class)
	for _, c in ipairs(self.__children) do
		if c:IsA(class) then
			return c
		end
	end
	return nil
end
function Inst:GetChildren()
	local out = {}
	for i, c in ipairs(self.__children) do
		out[i] = c
	end
	return out
end
function Inst:GetDescendants()
	local out = {}
	local function walk(n)
		for _, c in ipairs(n.__children) do
			out[#out + 1] = c
			walk(c)
		end
	end
	walk(self)
	return out
end
function Inst:ClearAllChildren()
	for _, c in ipairs(self:GetChildren()) do
		c.Parent = nil
	end
end
function Inst:Destroy()
	self.Parent = nil
end
function Inst:SetAttribute(k, v)
	self.__props.Attributes[k] = v
end
function Inst:GetAttribute(k)
	return self.__props.Attributes[k]
end
function Inst:PivotTo(cf)
	local root = self:FindFirstChild("HumanoidRootPart")
	if root then
		root.Position = cf.Position
		root.CFrame = cf
	end
end
function Inst:Kick(msg)
	M.kicked[#M.kicked + 1] = msg
	self.Parent = nil
end
function Inst:LoadCharacter() end
function Inst:FireClient(player, kind, data)
	M.pushes[#M.pushes + 1] = { player = player, kind = kind, data = data }
end
function Inst:FireAllClients() end
function Inst:FillBlock() end
M.pushes = {}

-------------------------------------------------------------------- Servicios
function M.build(game)
	M.game = game
	local services = {}
	local function svc(name, extra)
		local s = M.newInstance(name, { Name = name })
		for k, v in pairs(extra or {}) do
			rawset(s, k, v)
		end
		services[name] = s
		return s
	end
	local workspace = svc("Workspace")
	local terrain = M.newInstance("Terrain", { Name = "Terrain" })
	terrain.Parent = workspace
	M.workspace = workspace

	local Players = svc("Players")
	Players.__props.list = {}
	rawset(Players, "GetPlayers", function()
		local out = {}
		for _, p in ipairs(Players.__props.list) do
			if p.__props.Parent then
				out[#out + 1] = p
			end
		end
		return out
	end)
	rawset(Players, "GetPlayerByUserId", function(_, id)
		for _, p in ipairs(Players.__props.list) do
			if p.UserId == id then
				return p
			end
		end
	end)
	rawset(Players, "CreateHumanoidModelFromDescription", function()
		error("sin red")
	end)

	svc("DataStoreService", {
		GetDataStore = function()
			return {
				UpdateAsync = function(_, key, fn)
					if M.storeFails then
						error("DataStore caído (simulado)")
					end
					local old = M.store[key]
					local new = fn(old and M.deepCopy(old) or nil)
					if new ~= nil then
						M.store[key] = M.deepCopy(new)
					end
					return new
				end,
			}
		end,
	})
	svc("RunService", { IsStudio = function()
		return M.isStudio
	end })
	svc("HttpService", { JSONEncode = function()
		return "{}"
	end })
	svc("TextService", {
		FilterStringAsync = function(_, text)
			return { GetNonChatStringForBroadcastAsync = function()
				return text
			end }
		end,
	})
	svc("MarketplaceService", {
		UserOwnsGamePassAsync = function()
			return false
		end,
	})
	svc("CollectionService", {
		AddTag = function(_, inst, tag)
			tags[tag] = tags[tag] or {}
			table.insert(tags[tag], inst)
		end,
		GetTagged = function(_, tag)
			return tags[tag] or {}
		end,
	})
	svc("Lighting")
	svc("ReplicatedStorage")
	svc("ServerScriptService")
	rawset(game, "GetService", function(_, name)
		return services[name] or svc(name)
	end)
	rawset(game, "BindToClose", function(_, fn)
		M.onClose = fn
	end)
	rawset(game, "JobId", "test-job")
	return services
end

function M.deepCopy(t)
	if type(t) ~= "table" or getmetatable(t) then
		return t
	end
	local o = {}
	for k, v in pairs(t) do
		o[k] = M.deepCopy(v)
	end
	return o
end

-------------------------------------------------------------------- task
M.background = {}
function M.makeTask(mainCo)
	return {
		wait = function(n)
			M.clock = M.clock + (n or 0.03)
			local co = coroutine.running()
			if co ~= mainCo and co ~= nil then
				coroutine.yield()
			end
			return n
		end,
		spawn = function(fn, ...)
			local co = coroutine.create(fn)
			local ok, err = coroutine.resume(co, ...)
			if not ok then
				error(err)
			end
			if coroutine.status(co) ~= "dead" then
				table.insert(M.background, co)
			end
			return co
		end,
		defer = function(fn, ...)
			fn(...)
		end,
		delay = function(_, fn, ...)
			fn(...)
		end,
	}
end

function M.stepBackground()
	local alive = {}
	for _, co in ipairs(M.background) do
		if coroutine.status(co) == "suspended" then
			local ok, err = coroutine.resume(co)
			if not ok then
				error(err)
			end
		end
		if coroutine.status(co) ~= "dead" then
			alive[#alive + 1] = co
		end
	end
	M.background = alive
end

function M.newPlayer(Players, userId, name)
	local p = M.newInstance("Player", { Name = name, UserId = userId, DisplayName = name })
	p.Parent = Players
	table.insert(Players.__props.list, p)
	local char = M.newInstance("Model", { Name = name })
	local root = M.newInstance("Part", { Name = "HumanoidRootPart", Position = M.Vector3.new(0, 3, 0) })
	root.Parent = char
	M.newInstance("Part", { Name = "Head" }).Parent = char
	M.newInstance("Humanoid", { Name = "Humanoid" }).Parent = char
	char.Parent = M.workspace
	p.Character = char
	return p
end

function M.moveTo(player, x, y, z)
	player.Character:FindFirstChild("HumanoidRootPart").Position = M.Vector3.new(x, y, z)
end

return M
