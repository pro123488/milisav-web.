--!nonstrict
-- Util: funciones pequeñas compartidas por servidor y cliente.

local Util = {}

function Util.clamp(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end

function Util.round(x)
	return math.floor(x + 0.5)
end

function Util.deepCopy(t)
	if type(t) ~= "table" then
		return t
	end
	local o = {}
	for k, v in pairs(t) do
		o[k] = Util.deepCopy(v)
	end
	return o
end

-- Añade a "data" los campos que falten de "template" (perfiles antiguos)
function Util.reconcile(data, template)
	for k, v in pairs(template) do
		if data[k] == nil then
			data[k] = Util.deepCopy(v)
		elseif type(v) == "table" and type(data[k]) == "table" and next(v) ~= nil and #v == 0 then
			Util.reconcile(data[k], v)
		end
	end
	return data
end

function Util.count(t)
	local n = 0
	for _ in pairs(t or {}) do
		n = n + 1
	end
	return n
end

-- 1234 -> "1,2 K"; 2500000 -> "2,5 M"
function Util.short(n)
	n = n or 0
	local sign = n < 0 and "-" or ""
	n = math.abs(n)
	local units = { { 1e12, " T" }, { 1e9, " B" }, { 1e6, " M" }, { 1e3, " K" } }
	for _, u in ipairs(units) do
		if n >= u[1] then
			local v = n / u[1]
			local s = v >= 100 and string.format("%d", math.floor(v)) or string.format("%.1f", math.floor(v * 10) / 10)
			s = s:gsub("%.0$", ""):gsub("%.", ",")
			return sign .. s .. u[2]
		end
	end
	return sign .. tostring(math.floor(n))
end

-- Elige un elemento de "list" con pesos (weightFn devuelve el peso de cada uno)
function Util.weighted(list, weightFn, r)
	local total = 0
	for _, it in ipairs(list) do
		total = total + math.max(0, weightFn(it))
	end
	local x = r * total
	for _, it in ipairs(list) do
		x = x - math.max(0, weightFn(it))
		if x <= 0 then
			return it
		end
	end
	return list[#list]
end

function Util.time(seconds)
	seconds = math.max(0, math.floor(seconds))
	local m = math.floor(seconds / 60)
	local s = seconds % 60
	if m > 0 then
		return m .. " min " .. s .. " s"
	end
	return s .. " s"
end

return Util
