-- RateLimiter (ModuleScript)
-- Ubicación: ServerScriptService/Server/Util/RateLimiter
-- Limita cuántas acciones puede enviar cada jugador por ventana de tiempo.

local RateLimiter = {}
RateLimiter.__index = RateLimiter

function RateLimiter.new(maxActions, windowSeconds)
	return setmetatable({
		max = maxActions,
		window = windowSeconds,
		buckets = {},
	}, RateLimiter)
end

function RateLimiter:Allow(player)
	local now = os.clock()
	local bucket = self.buckets[player]
	if not bucket or now - bucket.start >= self.window then
		bucket = { start = now, count = 0 }
		self.buckets[player] = bucket
	end
	bucket.count += 1
	return bucket.count <= self.max
end

function RateLimiter:Remove(player)
	self.buckets[player] = nil
end

return RateLimiter
