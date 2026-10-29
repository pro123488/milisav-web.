-- CosmeticConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/CosmeticConfig
--
-- Catálogo de personalización. Cada elemento puede tener `requiredPass`
-- (clave de GamePassConfig). El SERVIDOR valida la propiedad real antes de
-- permitir seleccionarlo y vuelve a comprobarla al mostrarlo: si la
-- propiedad no está confirmada, se muestra el elemento gratuito por defecto.
--
-- Las ventajas de pago son cosméticas: no dan ventaja económica.

local CosmeticConfig = {}

-- ===== Escudos =====
CosmeticConfig.Crests = {
	{ id = "classic", name = "Clásico", symbol = "⚽" },
	{ id = "star", name = "Estrella", symbol = "⭐" },
	{ id = "lion", name = "León", symbol = "🦁" },
	{ id = "shield", name = "Escudo", symbol = "🛡️" },
	{ id = "castle", name = "Castillo", symbol = "🏰" },
	-- Expansión Cosmética
	{ id = "dragon", name = "Dragón", symbol = "🐉", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "eagle", name = "Águila", symbol = "🦅", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "bolt", name = "Rayo", symbol = "⚡", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "wolf", name = "Lobo", symbol = "🐺", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "phoenix", name = "Fénix", symbol = "🔥", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "trophy", name = "Copa", symbol = "🏆", requiredPass = "COSMETIC_EXPANSION" },
	-- VIP Club
	{ id = "vip_crown", name = "Corona VIP", symbol = "👑", requiredPass = "VIP_CLUB" },
	{ id = "vip_diamond", name = "Diamante VIP", symbol = "💎", requiredPass = "VIP_CLUB" },
	-- Evento «Doces ou Travessuras» (gratis: se canjea con caramelos)
	{ id = "pumpkin", name = "Calabaza", symbol = "🎃", requiredUnlock = "crest_pumpkin" },
}

-- ===== Paletas de colores (primario / secundario) =====
CosmeticConfig.Palettes = {
	{ id = "white_blue", name = "Blanco y azul", primary = Color3.fromRGB(240, 240, 240), secondary = Color3.fromRGB(20, 70, 170) },
	{ id = "red_white", name = "Rojo y blanco", primary = Color3.fromRGB(200, 25, 35), secondary = Color3.fromRGB(245, 245, 245) },
	{ id = "blue_red", name = "Azul y grana", primary = Color3.fromRGB(20, 50, 140), secondary = Color3.fromRGB(150, 20, 50) },
	{ id = "green_white", name = "Verde y blanco", primary = Color3.fromRGB(20, 130, 60), secondary = Color3.fromRGB(245, 245, 245) },
	{ id = "yellow_black", name = "Amarillo y negro", primary = Color3.fromRGB(250, 210, 20), secondary = Color3.fromRGB(25, 25, 25) },
	{ id = "sky_white", name = "Celeste y blanco", primary = Color3.fromRGB(110, 180, 235), secondary = Color3.fromRGB(245, 245, 245) },
	-- Expansión Cosmética
	{ id = "purple_gold", name = "Púrpura real", primary = Color3.fromRGB(90, 30, 140), secondary = Color3.fromRGB(230, 180, 40), requiredPass = "COSMETIC_EXPANSION" },
	{ id = "orange_navy", name = "Naranja y marino", primary = Color3.fromRGB(245, 120, 20), secondary = Color3.fromRGB(15, 30, 70), requiredPass = "COSMETIC_EXPANSION" },
	{ id = "teal_black", name = "Turquesa nocturno", primary = Color3.fromRGB(0, 160, 160), secondary = Color3.fromRGB(20, 20, 30), requiredPass = "COSMETIC_EXPANSION" },
	{ id = "pink_black", name = "Rosa eléctrico", primary = Color3.fromRGB(240, 60, 150), secondary = Color3.fromRGB(25, 25, 25), requiredPass = "COSMETIC_EXPANSION" },
	{ id = "neon_lime", name = "Lima neón", primary = Color3.fromRGB(170, 240, 30), secondary = Color3.fromRGB(30, 30, 40), requiredPass = "COSMETIC_EXPANSION" },
	{ id = "maroon_sky", name = "Burdeos y cielo", primary = Color3.fromRGB(120, 25, 45), secondary = Color3.fromRGB(140, 200, 240), requiredPass = "COSMETIC_EXPANSION" },
	-- VIP Club
	{ id = "vip_gold", name = "Oro VIP", primary = Color3.fromRGB(212, 175, 55), secondary = Color3.fromRGB(20, 20, 20), requiredPass = "VIP_CLUB" },
	{ id = "vip_platinum", name = "Platino VIP", primary = Color3.fromRGB(220, 225, 230), secondary = Color3.fromRGB(212, 175, 55), requiredPass = "VIP_CLUB" },
	-- Evento de Halloween
	{ id = "halloween", name = "Noche de Halloween", primary = Color3.fromRGB(240, 120, 20), secondary = Color3.fromRGB(35, 15, 45), requiredUnlock = "palette_halloween" },
}

-- ===== Plantillas de equipación =====
-- pattern: lo interpretan el renderizador del estadio y la vista previa de la interfaz.
CosmeticConfig.Kits = {
	{ id = "plain", name = "Lisa", pattern = "plain" },
	{ id = "vstripes", name = "Rayas verticales", pattern = "vstripes" },
	{ id = "halves", name = "Mitades", pattern = "halves" },
	-- Expansión Cosmética
	{ id = "hoops", name = "Rayas horizontales", pattern = "hoops", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "sash", name = "Banda diagonal", pattern = "sash", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "chest", name = "Franja central", pattern = "chest", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "quarters", name = "Cuartos", pattern = "quarters", requiredPass = "COSMETIC_EXPANSION" },
}

-- ===== Efectos visuales cosméticos (en el estadio) =====
CosmeticConfig.Effects = {
	{ id = "none", name = "Sin efecto" },
	{ id = "confetti", name = "Confeti", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "sparkles", name = "Destellos", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "smoke", name = "Bengalas de humo (colores del club)", requiredPass = "COSMETIC_EXPANSION" },
	{ id = "vip_gold", name = "Brillo dorado VIP", requiredPass = "VIP_CLUB" },
	{ id = "bats", name = "Murciélagos", requiredUnlock = "effect_bats" }, -- evento de Halloween
}

-- ===== Diseños de construcción (Constructor Pro) =====
-- appliesTo: "stands" para gradas, "building" para edificios (tienda, restaurante, vestuarios...).
CosmeticConfig.BuildDesigns = {
	{ id = "classic", name = "Clásico", appliesTo = "stands", material = "Concrete", roof = false },
	{ id = "modern", name = "Moderno", appliesTo = "stands", material = "SmoothPlastic", roof = true },
	{ id = "cantilever_pro", name = "Voladizo Pro", appliesTo = "stands", material = "Metal", roof = true, canopy = true, requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "arena_pro", name = "Arena Futurista", appliesTo = "stands", material = "Glass", roof = true, neon = true, requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "elite_gold", name = "Élite Oro", appliesTo = "stands", material = "Metal", roof = true, canopy = true, neon = true, gold = true, requiredPass = "ELITE_STADIUM" },

	{ id = "brick", name = "Ladrillo", appliesTo = "building", material = "Brick" },
	{ id = "glass", name = "Cristal", appliesTo = "building", material = "Glass" },
	{ id = "steel_pro", name = "Acero Pro", appliesTo = "building", material = "DiamondPlate", requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "neon_pro", name = "Neón Pro", appliesTo = "building", material = "Neon", requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "elite_glass", name = "Cristal Élite", appliesTo = "building", material = "Glass", gold = true, requiredPass = "ELITE_STADIUM" },
}

-- ===== Decoraciones (se compran con dinero del juego y se colocan libremente en la plaza del terreno) =====
-- w, d = huella en planta (studs) sin rotar; la usa PlacementRules para validar la colocación.
CosmeticConfig.Decorations = {
	{ id = "flags", name = "Banderas del club", cost = 500, w = 10, d = 3 },
	{ id = "planters", name = "Jardineras", cost = 400, w = 6, d = 4 },
	{ id = "bench", name = "Banco de aficionados", cost = 300, w = 8, d = 3 },
	{ id = "ball_statue", name = "Balón monumental", cost = 1500, w = 6, d = 6 },
	-- Constructor Pro
	{ id = "pro_arch", name = "Arco de entrada Pro", cost = 2500, w = 12, d = 3, requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "pro_fountain", name = "Fuente Pro", cost = 2000, w = 10, d = 10, requiredPass = "CONSTRUCTOR_PRO" },
	{ id = "pro_screen", name = "Pantalla gigante Pro", cost = 3000, w = 11, d = 2, requiredPass = "CONSTRUCTOR_PRO" },
	-- Expansión Cosmética
	{ id = "cos_banner", name = "Pancarta gigante", cost = 1200, w = 11, d = 2, requiredPass = "COSMETIC_EXPANSION" },
	{ id = "cos_fireworks", name = "Torre de fuegos artificiales", cost = 1800, w = 3, d = 3, requiredPass = "COSMETIC_EXPANSION" },
	-- VIP Club
	{ id = "vip_carpet", name = "Alfombra roja VIP", cost = 1000, w = 6, d = 12, requiredPass = "VIP_CLUB" },
	{ id = "vip_statue", name = "Estatua dorada VIP", cost = 2500, w = 5, d = 5, requiredPass = "VIP_CLUB" },
	-- Evento de Halloween (se desbloquea con caramelos)
	{ id = "pumpkin_giant", name = "Calabaza gigante", cost = 300, w = 6, d = 6, requiredUnlock = "deco_pumpkin" },
}

-- Reembolso al retirar una decoración.
CosmeticConfig.DECORATION_REFUND = 0.5
-- Bonificación de atractivo por decoración. Solo cuentan tantas decoraciones como permita
-- la etapa del estadio (límite gratuito), de modo que Constructor Pro no da ventaja económica.
CosmeticConfig.DECORATION_ATTRACTIVENESS = 0.01

CosmeticConfig.Defaults = {
	crest = "classic",
	palette = "white_blue",
	kit = "plain",
	effect = "none",
	standsDesign = "classic",
	buildingDesign = "brick",
}

local function index(list)
	local map = {}
	for _, item in ipairs(list) do
		map[item.id] = item
	end
	return map
end

CosmeticConfig.ById = {
	crest = index(CosmeticConfig.Crests),
	palette = index(CosmeticConfig.Palettes),
	kit = index(CosmeticConfig.Kits),
	effect = index(CosmeticConfig.Effects),
	design = index(CosmeticConfig.BuildDesigns),
	decoration = index(CosmeticConfig.Decorations),
}

-- Categorías de apariencia que el jugador puede cambiar y el catálogo que valida cada una.
CosmeticConfig.AppearanceSlots = {
	crest = { catalog = "crest" },
	palette = { catalog = "palette" },
	kit = { catalog = "kit" },
	effect = { catalog = "effect" },
	standsDesign = { catalog = "design", appliesTo = "stands" },
	buildingDesign = { catalog = "design", appliesTo = "building" },
}

return CosmeticConfig
