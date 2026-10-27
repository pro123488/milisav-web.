-- Format (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/Format
-- Utilidades de formato compartidas por cliente y servidor.

local GameConfig = require(script.Parent.Parent.Config.GameConfig)

local Format = {}

-- 1234567 -> "1.234.567"
function Format.Thousands(n)
	n = math.floor(tonumber(n) or 0)
	local negative = n < 0
	local s = tostring(math.abs(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
	if out:sub(1, 1) == "." then
		out = out:sub(2)
	end
	return (negative and "-" or "") .. out
end

function Format.Money(n)
	return Format.Thousands(n) .. " " .. GameConfig.CURRENCY
end

function Format.SignedMoney(n)
	n = math.floor(tonumber(n) or 0)
	return (n >= 0 and "+" or "") .. Format.Money(n)
end

-- 1500 -> "1,5K"
function Format.Short(n)
	n = tonumber(n) or 0
	local abs = math.abs(n)
	if abs >= 1e6 then
		return (string.format("%.1fM", n / 1e6):gsub("%.", ","))
	elseif abs >= 1e3 then
		return (string.format("%.1fK", n / 1e3):gsub("%.", ","))
	end
	return tostring(math.floor(n))
end

function Format.Percent(x)
	return string.format("%d%%", math.floor((tonumber(x) or 0) * 100 + 0.5))
end

function Format.Duration(seconds)
	seconds = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", math.floor(seconds / 60), seconds % 60)
end

return Format
