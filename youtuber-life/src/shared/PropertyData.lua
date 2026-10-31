--!nonstrict
-- PropertyData: mercado inmobiliario (Fase 2). Cada anuncio es una propiedad concreta en un distrito,
-- con precio de compra y/o alquiler, mantenimiento, almacenamiento, espacio para muebles, calidad del entorno,
-- espacio para grabar, posibilidad de remodelar, valor de reventa y requisitos.

local PropertyData = {}

PropertyData.Kinds = {
	home = "Vivienda", studio = "Estudio", business = "Negocio", garage = "Garaje", land = "Terreno",
}

-- Mejora: coste y efecto real (lo aplica PropertyService)
PropertyData.Upgrades = {
	soundproof = { Name = "Aislamiento acústico", Cost = 2000, Desc = "−3 de ruido en las grabaciones dentro de la propiedad." },
	security = { Name = "Sistema de seguridad", Cost = 1500, Desc = "+5 de calidad del entorno (tranquilidad para grabar)." },
	storage = { Name = "Ampliación de almacenaje", Cost = 2500, Desc = "+50% de capacidad de almacenamiento." },
	lightrig = { Name = "Rig de iluminación de estudio", Cost = 3000, Desc = "+20 de luz en grabaciones y fotos de interior." },
}

PropertyData.Walls = {
	{ "Blanco", { 240, 240, 236 } }, { "Gris cálido", { 190, 182, 170 } }, { "Grafito", { 60, 62, 70 } }, { "Azul noche", { 30, 40, 80 } },
	{ "Verde salvia", { 150, 175, 145 } }, { "Terracota", { 190, 110, 80 } }, { "Rosa pastel", { 240, 190, 200 } }, { "Negro gamer", { 20, 20, 26 } },
	{ "Madera", { 150, 110, 75 } }, { "Ladrillo", { 160, 80, 60 } },
}
PropertyData.Floors = {
	{ "Parqué", "WoodPlanks", { 160, 120, 85 } }, { "Mármol", "Marble", { 235, 235, 235 } }, { "Moqueta", "Fabric", { 90, 90, 110 } },
	{ "Hormigón pulido", "Concrete", { 150, 150, 150 } }, { "Baldosa", "Slate", { 120, 115, 110 } }, { "Madera oscura", "Wood", { 90, 60, 40 } },
}
PropertyData.Lights = {
	{ "Cálida", { 255, 220, 170 }, 1.2 }, { "Neutra", { 255, 250, 240 }, 1.4 }, { "Fría", { 200, 225, 255 }, 1.4 },
	{ "Neón gamer", { 200, 80, 255 }, 1.6 }, { "Estudio", { 255, 255, 255 }, 2.2 },
}

-- Estilos de decoración: combinación sugerida de pared/suelo/luz
PropertyData.Styles = {
	{ Id = "modern", Name = "Moderno", Wall = 1, Floor = 1, Light = 2 },
	{ Id = "minimal", Name = "Minimalista", Wall = 1, Floor = 4, Light = 2 },
	{ Id = "industrial", Name = "Industrial", Wall = 10, Floor = 4, Light = 1 },
	{ Id = "classic", Name = "Clásico", Wall = 2, Floor = 6, Light = 1 },
	{ Id = "tech", Name = "Tecnológico", Wall = 3, Floor = 4, Light = 3 },
	{ Id = "gamer", Name = "Gamer", Wall = 8, Floor = 3, Light = 4 },
	{ Id = "luxury", Name = "Lujoso", Wall = 2, Floor = 2, Light = 1 },
	{ Id = "budget", Name = "Económico", Wall = 1, Floor = 5, Light = 2 },
	{ Id = "natural", Name = "Natural", Wall = 5, Floor = 1, Light = 1 },
	{ Id = "futuristic", Name = "Futurista", Wall = 4, Floor = 2, Light = 3 },
	{ Id = "pro", Name = "Profesional", Wall = 3, Floor = 3, Light = 5 },
	{ Id = "creative", Name = "Creativo", Wall = 7, Floor = 1, Light = 2 },
}
PropertyData.StyleById = {}
for _, s in ipairs(PropertyData.Styles) do
	PropertyData.StyleById[s.Id] = s
end

-- Anuncios. W/D = tamaño interior. Slots = muebles colocables. Storage = objetos guardados.
-- Env = calidad del entorno (0-100). Studio = bonus de interés al grabar dentro.
local L = {}
local function listing(t)
	t.Resale = t.Resale or 0.8
	t.Req = t.Req or { Level = 1, Subs = 0 }
	t.Remodel = t.Remodel ~= false
	L[#L + 1] = t
end

listing({ Id = "hotel_room", Name = "Habitación en el Gran Hotel", Type = "Habitación de hotel", Kind = "home", District = "hotels", Rent = 300, Upkeep = 0, Storage = 40, Slots = 6, Env = 70, Studio = 2, W = 26, D = 22, Remodel = false, Tags = { "luxury", "tourism" } })
listing({ Id = "apt_small", Name = "Apartamento pequeño en la Zona de apartamentos", Type = "Apartamento pequeño", Kind = "home", District = "apartments", Buy = 9000, Rent = 220, Upkeep = 30, Storage = 90, Slots = 10, Env = 45, Studio = 3, W = 30, D = 26, Tags = { "urban", "home" } })
listing({ Id = "apt_modern", Name = "Apartamento moderno con balcón", Type = "Apartamento moderno", Kind = "home", District = "apartments", Buy = 22000, Rent = 450, Upkeep = 60, Storage = 130, Slots = 14, Env = 60, Studio = 5, W = 36, D = 30, Tags = { "urban", "home" } })
listing({ Id = "apt_luxury", Name = "Apartamento de lujo en el Centro financiero", Type = "Apartamento de lujo", Kind = "home", District = "financial", Buy = 85000, Rent = 1200, Upkeep = 200, Storage = 180, Slots = 20, Env = 80, Studio = 8, W = 44, D = 36, Req = { Level = 8, Subs = 0 }, Tags = { "luxury", "home", "business" } })
listing({ Id = "house_family", Name = "Casa familiar con jardín", Type = "Casa familiar", Kind = "home", District = "residential", Buy = 45000, Rent = 700, Upkeep = 120, Storage = 220, Slots = 22, Env = 65, Studio = 6, W = 46, D = 40, Tags = { "home", "urban" } })
listing({ Id = "house_modern", Name = "Casa moderna de diseño", Type = "Casa moderna", Kind = "home", District = "residential", Buy = 70000, Rent = 1000, Upkeep = 160, Storage = 240, Slots = 26, Env = 75, Studio = 8, W = 50, D = 42, Req = { Level = 5, Subs = 0 }, Tags = { "home", "luxury" } })
listing({ Id = "mansion", Name = "Mansión de la Avenida", Type = "Mansión", Kind = "home", District = "luxury", Buy = 400000, Upkeep = 900, Storage = 500, Slots = 50, Env = 95, Studio = 14, W = 80, D = 64, Req = { Level = 15, Subs = 50000 }, Pool = true, Tags = { "luxury", "home" } })
listing({ Id = "penthouse", Name = "Ático con vistas", Type = "Ático", Kind = "home", District = "financial", Buy = 250000, Rent = 3500, Upkeep = 600, Storage = 300, Slots = 36, Env = 92, Studio = 12, W = 60, D = 48, Req = { Level = 12, Subs = 10000 }, View = "Vista panorámica", Tags = { "luxury", "home", "night" } })
listing({ Id = "beach_house", Name = "Casa de playa", Type = "Casa de playa", Kind = "home", District = "coast", Buy = 150000, Rent = 1800, Upkeep = 300, Storage = 220, Slots = 28, Env = 88, Studio = 10, W = 52, D = 42, Req = { Level = 9, Subs = 0 }, View = "Vista al mar", Tags = { "beach", "home", "luxury" } })
listing({ Id = "rural_house", Name = "Casa rural", Type = "Casa rural", Kind = "home", District = "rural", Buy = 30000, Rent = 400, Upkeep = 70, Storage = 260, Slots = 22, Env = 70, Studio = 6, W = 46, D = 40, View = "Vista al campo", Tags = { "rural", "home", "nature" } })
listing({ Id = "mountain_cabin", Name = "Casa en la montaña", Type = "Casa de montaña", Kind = "home", District = "mountains", Buy = 40000, Rent = 500, Upkeep = 90, Storage = 160, Slots = 18, Env = 78, Studio = 7, W = 40, D = 34, View = "Vista a las cumbres", Tags = { "mountain", "home", "nature" } })
listing({ Id = "pool_house", Name = "Casa con piscina", Type = "Casa con piscina", Kind = "home", District = "luxury", Buy = 120000, Rent = 1500, Upkeep = 280, Storage = 260, Slots = 30, Env = 85, Studio = 9, W = 56, D = 46, Req = { Level = 7, Subs = 0 }, Pool = true, Tags = { "luxury", "home", "water" } })
listing({ Id = "pro_studio", Name = "Estudio profesional", Type = "Estudio profesional", Kind = "studio", District = "creators", Buy = 60000, Rent = 900, Upkeep = 150, Storage = 160, Slots = 24, Env = 70, Studio = 15, W = 44, D = 36, Req = { Level = 4, Subs = 0 }, Tags = { "studio" } })
listing({ Id = "shop_local", Name = "Local comercial", Type = "Local comercial", Kind = "business", District = "commercial", Buy = 50000, Rent = 800, Upkeep = 140, Storage = 200, Slots = 22, Env = 55, Studio = 5, W = 44, D = 34, Tags = { "shop", "business" } })
listing({ Id = "office", Name = "Oficina en la Zona de oficinas", Type = "Oficina", Kind = "business", District = "offices", Buy = 80000, Rent = 1000, Upkeep = 180, Storage = 180, Slots = 24, Env = 65, Studio = 6, W = 46, D = 36, Req = { Level = 6, Subs = 0 }, Tags = { "business" } })
listing({ Id = "rec_studio", Name = "Estudio de grabación insonorizado", Type = "Estudio de grabación", Kind = "studio", District = "studios", Buy = 110000, Rent = 1500, Upkeep = 250, Storage = 200, Slots = 28, Env = 75, Studio = 20, W = 50, D = 40, Req = { Level = 8, Subs = 0 }, Tags = { "studio" } })
listing({ Id = "warehouse", Name = "Almacén industrial", Type = "Almacén", Kind = "business", District = "industrial", Buy = 35000, Rent = 600, Upkeep = 100, Storage = 900, Slots = 30, Env = 35, Studio = 4, W = 60, D = 50, Tags = { "business" } })
listing({ Id = "garage", Name = "Garaje en el Barrio económico", Type = "Garaje", Kind = "garage", District = "budget", Buy = 8000, Rent = 150, Upkeep = 20, Storage = 160, Slots = 10, Env = 25, Studio = 2, W = 30, D = 26, Tags = { "urban" } })
listing({ Id = "land_lot", Name = "Terreno edificable", Type = "Terreno edificable", Kind = "land", District = "rural", Buy = 20000, Upkeep = 10, Storage = 60, Slots = 60, Env = 60, Studio = 4, W = 70, D = 70, Tags = { "rural", "nature" } })
listing({ Id = "loft_creators", Name = "Loft en el Barrio de creadores", Type = "Apartamento moderno", Kind = "home", District = "creators", Buy = 35000, Rent = 600, Upkeep = 80, Storage = 140, Slots = 18, Env = 62, Studio = 9, W = 40, D = 32, Tags = { "urban", "studio", "home" } })

PropertyData.Listings = L
PropertyData.ById = {}
for _, p in ipairs(L) do
	PropertyData.ById[p.Id] = p
end

-- Máximo de propiedades simultáneas según el nivel (no se pierde lo que ya tienes)
function PropertyData.maxProperties(level)
	if level >= 10 then
		return 6
	elseif level >= 5 then
		return 3
	end
	return 1
end

PropertyData.StarterStorage = 80

return PropertyData
