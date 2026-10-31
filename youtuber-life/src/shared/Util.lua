--!nonstrict
-- Util: funciones puras reutilizadas por servidor y cliente.
-- Escrito en el subconjunto de Luau compatible con Lua 5.1 para poder probarlo fuera de Studio.

local Util = {}

function Util.deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for k, v in pairs(value) do
		copy[Util.deepCopy(k)] = Util.deepCopy(v)
	end
	return copy
end

-- Rellena los campos que falten en `data` usando `template` (no borra nada existente).
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

function Util.clamp(x, lo, hi)
	if x < lo then
		return lo
	end
	if x > hi then
		return hi
	end
	return x
end

function Util.round(x, decimals)
	local m = 10 ^ (decimals or 0)
	return math.floor(x * m + 0.5) / m
end

function Util.lerp(a, b, t)
	return a + (b - a) * t
end

function Util.count(t)
	local n = 0
	for _ in pairs(t) do
		n = n + 1
	end
	return n
end

function Util.keys(t)
	local out = {}
	for k in pairs(t) do
		out[#out + 1] = k
	end
	return out
end

function Util.indexOf(list, value)
	for i, v in ipairs(list) do
		if v == value then
			return i
		end
	end
	return nil
end

-- Formato con separador de miles: 1234567 -> "1.234.567"
function Util.formatInt(n)
	n = math.floor((n or 0) + 0.5)
	local neg = n < 0
	local s = tostring(math.abs(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
	if out:sub(1, 1) == "." then
		out = out:sub(2)
	end
	if neg then
		out = "-" .. out
	end
	return out
end

function Util.formatMoney(n)
	return "$" .. Util.formatInt(n)
end

-- Formato corto: 1520 -> "1,5 K"
function Util.formatShort(n)
	n = n or 0
	local a = math.abs(n)
	local function fmt(x, suffix)
		local s = string.format("%.1f", x):gsub("%.0$", ""):gsub("%.", ",")
		return s .. suffix
	end
	if a >= 1e9 then
		return fmt(n / 1e9, " MM")
	elseif a >= 1e6 then
		return fmt(n / 1e6, " M")
	elseif a >= 1e3 then
		return fmt(n / 1e3, " K")
	end
	return tostring(math.floor(n + 0.5))
end

function Util.trim(s)
	return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- Inserta al principio y recorta la lista a `cap` elementos.
function Util.pushCapped(list, item, cap)
	table.insert(list, 1, item)
	while #list > cap do
		table.remove(list)
	end
end

-- Generador pseudoaleatorio determinista (para "suerte controlada").
function Util.hashString(s)
	local h = 5381
	for i = 1, #s do
		h = (h * 33 + s:byte(i)) % 2147483647
	end
	return h
end

function Util.seededRandom(seedString, lo, hi)
	local h = Util.hashString(seedString)
	local r = (h % 100000) / 100000
	return lo + (hi - lo) * r
end

-- Valida que `value` sea string corto y sin caracteres de control.
function Util.cleanText(value, maxLen)
	if type(value) ~= "string" then
		return nil
	end
	value = value:gsub("[%c]", " ")
	value = Util.trim(value)
	if #value > maxLen then
		value = value:sub(1, maxLen)
	end
	return value
end

function Util.colorDistance(a, b)
	-- a, b = {r,g,b} 0..255
	local dr, dg, db = a[1] - b[1], a[2] - b[2], a[3] - b[3]
	return math.sqrt(dr * dr + dg * dg + db * db)
end

function Util.luminance(c)
	return (0.299 * c[1] + 0.587 * c[2] + 0.114 * c[3]) / 255
end

return Util
