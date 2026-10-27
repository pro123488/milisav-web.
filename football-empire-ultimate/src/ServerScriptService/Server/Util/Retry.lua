-- Retry (ModuleScript)
-- Ubicación: ServerScriptService/Server/Util/Retry
-- Ejecuta una función con pcall y reintentos controlados con espera exponencial.

local Retry = {}

-- Devuelve: ok, resultado (o mensaje de error del último intento)
function Retry.Call(attempts, baseDelay, fn, ...)
	local lastError
	for attempt = 1, attempts do
		local ok, result = pcall(fn, ...)
		if ok then
			return true, result
		end
		lastError = result
		if attempt < attempts then
			task.wait(baseDelay * (2 ^ (attempt - 1)))
		end
	end
	return false, lastError
end

return Retry
