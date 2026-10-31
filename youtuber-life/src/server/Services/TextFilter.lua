--!nonstrict
-- TextFilter: filtra con TextService todo texto escrito por jugadores que otros puedan ver
-- (nombre del canal, títulos, descripciones, metas...). Si el filtro falla, se rechaza el texto.

local TextService = game:GetService("TextService")

local TextFilter = {}

function TextFilter.Init() end

function TextFilter.filter(player, text)
	if type(text) ~= "string" then
		return nil
	end
	if text == "" then
		return ""
	end
	local ok, result = pcall(function()
		local filtered = TextService:FilterStringAsync(text, player.UserId)
		return filtered:GetNonChatStringForBroadcastAsync()
	end)
	if ok and type(result) == "string" then
		return result
	end
	return nil
end

return TextFilter
