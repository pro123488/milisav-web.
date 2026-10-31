-- harness.lua: árbol de instancias falso para poder hacer require() de los módulos fuera de Roblox.
-- Uso desde run_tests.py (lupa, Lua 5.1). READ(path) y LIST(dir) los inyecta Python.

local H = {}

local Node = {}
Node.__index = function(self, k)
	local raw = rawget(Node, k)
	if raw then
		return raw
	end
	local children = rawget(self, "__children")
	if children and children[k] then
		return children[k]
	end
	return nil
end

function Node.new(name, path, parent)
	local n = setmetatable({ __name = name, __path = path, __children = {} }, Node)
	rawset(n, "Name", name)
	if parent then
		rawset(n, "Parent", parent)
		parent.__children[name] = n
	end
	return n
end
function Node:FindFirstChild(name)
	return self.__children[name]
end
function Node:WaitForChild(name)
	local c = self.__children[name]
	assert(c, "WaitForChild: no existe " .. tostring(name))
	return c
end
function Node:GetChildren()
	local out = {}
	for _, c in pairs(self.__children) do
		out[#out + 1] = c
	end
	table.sort(out, function(a, b)
		return a.__name < b.__name
	end)
	return out
end
function Node:IsA(class)
	return class == "ModuleScript" and self.__path ~= nil
end

H.Node = Node

-- Monta un árbol a partir de una lista de {logical = "ReplicatedStorage/Shared/Util", path = "..."}
function H.mount(root, entries)
	for _, e in ipairs(entries) do
		local parts = {}
		for p in e.logical:gmatch("[^/]+") do
			parts[#parts + 1] = p
		end
		local cur = root
		for i, p in ipairs(parts) do
			local nxt = cur.__children[p]
			if not nxt then
				nxt = Node.new(p, i == #parts and e.path or nil, cur)
			elseif i == #parts then
				rawset(nxt, "__path", e.path)
			end
			cur = nxt
		end
	end
end

local cache = {}
function H.makeRequire(env)
	local function req(node)
		if type(node) ~= "table" or not node.__path then
			error("require de algo que no es ModuleScript: " .. tostring(node and node.__name))
		end
		if cache[node] ~= nil then
			return cache[node]
		end
		local src = READ(node.__path)
		local fn, err = loadstring(src, "@" .. node.__path)
		if not fn then
			error(err)
		end
		local menv = setmetatable({ script = node }, { __index = env })
		setfenv(fn, menv)
		local result = fn()
		cache[node] = result
		return result
	end
	return req
end

return H
