-- GamePassConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/GamePassConfig
--
-- Configuración CENTRALIZADA de los Game Passes de FOOTBALL EMPIRE ULTIMATE.
--
-- ⚠️ IMPORTANTE
--   * Todos los identificadores están en 0 = "PENDIENTE DE CONFIGURACIÓN".
--   * Ninguno de estos pases existe todavía en Roblox hasta que los crees en el
--     Creator Dashboard (Monetización > Pases) y copies aquí su ID numérico.
--   * Mientras el ID sea 0, la tienda muestra "Pendiente de configuración",
--     el botón de compra está desactivado y NUNCA se conceden ventajas.
--   * El precio NO se escribe aquí: se obtiene de Roblox con GetProductInfo.
--
-- Para añadir un pase nuevo en el futuro basta con añadir una entrada a
-- `Passes` y a `Order`. La tienda y el GamePassService lo recogen solos.

export type PassDefinition = {
	key: string,
	id: number, -- 0 = pendiente de configuración
	active: boolean, -- false = pase futuro: no se muestra a la venta todavía
	name: string,
	icon: string, -- emoji usado como icono (puedes sustituirlo por rbxassetid)
	iconImage: string?, -- opcional: "rbxassetid://..." de la imagen del pase
	accent: Color3,
	description: string,
	benefits: { string },
	priority: number,
	phase: number, -- fase del plan de desarrollo en la que se activan sus ventajas
}

local GamePassConfig = {}

GamePassConfig.PENDING_ID = 0

GamePassConfig.Passes = {
	VIP_CLUB = {
		key = "VIP_CLUB",
		id = 0, -- TODO: pega aquí el ID del pase "VIP Club" del Creator Dashboard
		active = true,
		name = "VIP Club",
		icon = "👑",
		accent = Color3.fromRGB(255, 196, 0),
		description = "Haz que tu club destaque en todo el universo futbolístico con un estatus VIP exclusivo.",
		benefits = {
			"Etiqueta VIP en tu perfil y en el cartel de tu estadio",
			"Decoraciones exclusivas VIP para tu estadio",
			"Elementos visuales especiales (iluminación dorada)",
			"Opciones cosméticas VIP para escudos y colores",
		},
		priority = 1,
		phase = 1,
	},
	CONSTRUCTOR_PRO = {
		key = "CONSTRUCTOR_PRO",
		id = 0, -- TODO: pega aquí el ID del pase "Constructor Pro"
		active = true,
		name = "Constructor Pro",
		icon = "🏗️",
		accent = Color3.fromRGB(0, 170, 255),
		description = "Más diseños y herramientas de construcción, siempre dentro de las reglas de tu terreno.",
		benefits = {
			"Diseños de construcción exclusivos para gradas e instalaciones",
			"Herramientas de colocación: rejilla fina (1 stud) y rotación a 45°",
			"Elementos decorativos especiales",
			"+6 decoraciones, siempre dentro de la zona de tu terreno",
		},
		priority = 2,
		phase = 1,
	},
	COSMETIC_EXPANSION = {
		key = "COSMETIC_EXPANSION",
		id = 0, -- TODO: pega aquí el ID del pase "Expansión Cosmética"
		active = true,
		name = "Expansión Cosmética",
		icon = "🎨",
		accent = Color3.fromRGB(230, 60, 140),
		description = "Personaliza la identidad de tu club con escudos, paletas y equipaciones adicionales.",
		benefits = {
			"Diseños adicionales de escudos",
			"Paletas de colores exclusivas",
			"Plantillas de equipaciones adicionales",
			"Decoraciones especiales y efectos visuales cosméticos",
		},
		priority = 3,
		phase = 1,
	},

	-- ===== Pases preparados para fases posteriores (no se venden aún) =====
	ELITE_STADIUM = {
		key = "ELITE_STADIUM",
		id = 0,
		active = false,
		name = "Estadio de Élite",
		icon = "🏟️",
		accent = Color3.fromRGB(140, 90, 255),
		description = "Acabados y estilos de élite para tu estadio evolutivo.",
		benefits = { "Estilos visuales de élite para las 7 etapas del estadio" },
		priority = 4,
		phase = 11, -- se activa con la Tienda Premium completa (FASE 11)
	},
	ELITE_ACADEMY = {
		key = "ELITE_ACADEMY",
		id = 0,
		active = false,
		name = "Academia de Élite",
		icon = "🧬",
		accent = Color3.fromRGB(40, 200, 120),
		description = "Personalización ampliada de la cantera generacional.",
		benefits = { "Opciones visuales y de gestión ampliadas para la academia" },
		priority = 5,
		phase = 11, -- se activa con la Tienda Premium completa (FASE 11)
	},
	CLUB_LEGENDS = {
		key = "CLUB_LEGENDS",
		id = 0,
		active = false,
		name = "Leyendas del Club",
		icon = "📜",
		accent = Color3.fromRGB(255, 120, 40),
		description = "Galería ampliada de leyendas e historia del club.",
		benefits = { "Vitrinas y presentaciones especiales en la historia del club" },
		priority = 6,
		phase = 11, -- se activa con la Tienda Premium completa (FASE 11)
	},
} :: { [string]: PassDefinition }

-- Orden de aparición en la TIENDA PREMIUM.
GamePassConfig.Order = {
	"VIP_CLUB",
	"CONSTRUCTOR_PRO",
	"COSMETIC_EXPANSION",
	"ELITE_STADIUM",
	"ELITE_ACADEMY",
	"CLUB_LEGENDS",
}

function GamePassConfig.Get(key: string): PassDefinition?
	return GamePassConfig.Passes[key]
end

function GamePassConfig.IsConfigured(key: string): boolean
	local def = GamePassConfig.Passes[key]
	return def ~= nil and typeof(def.id) == "number" and def.id > 0
end

function GamePassConfig.GetKeyById(id: number): string?
	if id <= 0 then
		return nil
	end
	for key, def in pairs(GamePassConfig.Passes) do
		if def.id == id then
			return key
		end
	end
	return nil
end

return GamePassConfig
