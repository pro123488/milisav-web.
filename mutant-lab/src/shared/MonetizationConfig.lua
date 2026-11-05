--!nonstrict
-- MonetizationConfig: PON AQUÍ TUS IDS REALES de Game Passes y Developer Products (Creator Hub de Roblox).
-- Mientras valgan 0 no se ofrecen en el juego (no hay botones falsos ni IDs inventados).
-- Nada del juego queda bloqueado por pagar.

local MonetizationConfig = {}

MonetizationConfig.GamePasses = {
	{ Key = "VIP", Name = "Laboratorio VIP", Desc = "+10% de producción y etiqueta VIP", Id = 0 },
	{ Key = "BigTank", Name = "Tanque gigante", Desc = "+50% de capacidad del tanque", Id = 0 },
}

-- Paquetes de créditos: dan minutos de tu producción actual (mínimo garantizado)
MonetizationConfig.Products = {
	{ Key = "CreditsSmall", Name = "Bote de créditos", Minutes = 10, Min = 500, Id = 0 },
	{ Key = "CreditsBig", Name = "Barril de créditos", Minutes = 60, Min = 5000, Id = 0 },
}

function MonetizationConfig.isConfigured(entry)
	return type(entry.Id) == "number" and entry.Id > 0
end

return MonetizationConfig
