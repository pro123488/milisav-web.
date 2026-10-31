--!nonstrict
-- MonetizationConfig: COLOCA AQUÍ TUS IDS REALES.
--
-- Todos los Id están en 0 a propósito: no se inventan identificadores.
-- Mientras un Id sea 0, el producto aparece como "No configurado" y no se puede comprar.
-- Crea los Game Passes y Developer Products en create.roblox.com (Monetización) y pega sus números.
--
-- Las ventajas están limitadas para no romper el equilibrio: el juego es completo sin pagar.

local MonetizationConfig = {}

MonetizationConfig.GamePasses = {
	VIP = {
		Id = 0,
		Name = "VIP",
		Description = "Etiqueta VIP, +10% de dinero en empleos y acceso a la sala VIP del Distrito de eventos.",
		Perks = { JobBonus = 0.10, VipRoom = true, ChatTag = true },
	},
	BigBackpack = {
		Id = 0,
		Name = "Mochila ampliada",
		Description = "+4 espacios de mochila para llevar más equipo.",
		Perks = { BackpackSlots = 4 },
	},
	MoreProjects = {
		Id = 0,
		Name = "Más espacios para proyectos",
		Description = "+6 proyectos de vídeo simultáneos.",
		Perks = { ProjectSlots = 6 },
	},
	PCTheme = {
		Id = 0,
		Name = "Tema exclusivo del computador",
		Description = "Fondos de escritorio y colores exclusivos para el sistema operativo del juego (cosmético).",
		Perks = { Wallpapers = true },
	},
	LightingPack = {
		Id = 0,
		Name = "Paquete de iluminación",
		Description = "Filtros de foto y estilos de miniatura adicionales (cosmético, sin bonus de calidad).",
		Perks = { ExtraFilters = true },
	},
	ChannelPack = {
		Id = 0,
		Name = "Personalización del canal",
		Description = "Banners y avatares de canal exclusivos (cosmético).",
		Perks = { ExtraBanners = true },
	},
}

-- Developer Products: se procesan con ProcessReceipt de forma idempotente.
MonetizationConfig.Products = {
	CashSmall = { Id = 0, Name = "Paquete de dinero pequeño", Grant = { Money = 2500 } },
	CashMedium = { Id = 0, Name = "Paquete de dinero mediano", Grant = { Money = 8000 } },
	CashLarge = { Id = 0, Name = "Paquete de dinero grande", Grant = { Money = 20000 } },
	ExportBoost = { Id = 0, Name = "Exportación instantánea (1 uso)", Grant = { ExportTokens = 1 } },
}

function MonetizationConfig.isConfigured(entry)
	return entry ~= nil and type(entry.Id) == "number" and entry.Id > 0
end

return MonetizationConfig
