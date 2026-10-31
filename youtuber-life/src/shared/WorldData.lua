--!nonstrict
-- WorldData: definición de la ciudad. WorldBuilder la usa para construir el mapa y
-- el servidor para saber en qué distrito / lugar de grabación está cada jugador.
--
-- Cuadrícula de 6 columnas x 5 filas. Cada distrito ocupa CellSize x CellSize studs.
-- Offset de los lugares = posición relativa al centro del distrito (x, z).

local WorldData = {}

WorldData.CellSize = 280
WorldData.RoadWidth = 26
WorldData.Cols = 6
WorldData.Rows = 5

-- Estilos de edificios: tower, office, house, shop, warehouse, cabin, hotel, none
local D = {}
local function district(d)
	D[#D + 1] = d
	return d
end

-- Fila 1 (norte)
district({ Id = "mountains", Name = "Montañas", Col = 1, Row = 1, Ground = { 110, 110, 105 }, Material = "Slate",
	Style = "cabin", Count = 3, Palette = { { 120, 80, 50 }, { 90, 60, 40 } }, Trees = 14, Hills = true,
	Tags = { "nature", "mountain" }, Noise = 2, Busy = 1,
	Spots = { { Name = "Mirador de la cumbre", X = 40, Z = -60, Tags = { "mountain", "nature", "tourism" }, Interest = 12 },
		{ Name = "Sendero rocoso", X = -70, Z = 50, Tags = { "mountain", "nature" }, Interest = 8 } } })
district({ Id = "forest", Name = "Bosque", Col = 2, Row = 1, Ground = { 60, 110, 55 }, Material = "Grass",
	Style = "none", Count = 0, Palette = {}, Trees = 45,
	Tags = { "nature", "rural" }, Noise = 1, Busy = 1,
	Spots = { { Name = "Claro del bosque", X = 0, Z = 0, Tags = { "nature" }, Interest = 9 },
		{ Name = "Puente de madera", X = 80, Z = 70, Tags = { "nature", "tourism" }, Interest = 8 } } })
district({ Id = "camping", Name = "Zona de campamento", Col = 3, Row = 1, Ground = { 85, 125, 60 }, Material = "Grass",
	Style = "tent", Count = 6, Palette = { { 230, 120, 40 }, { 40, 120, 200 }, { 220, 200, 60 } }, Trees = 18,
	Tags = { "nature", "fun", "rural" }, Noise = 2, Busy = 3,
	Spots = { { Name = "Hoguera del campamento", X = 0, Z = 20, Tags = { "nature", "fun" }, Interest = 10 },
		{ Name = "Zona de tiendas de campaña", X = -60, Z = -40, Tags = { "nature", "rural" }, Interest = 7 } } })
district({ Id = "rural", Name = "Zona rural", Col = 4, Row = 1, Ground = { 140, 150, 70 }, Material = "Grass",
	Style = "house", Count = 4, Palette = { { 200, 180, 140 }, { 170, 70, 50 } }, Trees = 10, Fields = true,
	Tags = { "rural", "nature", "food" }, Noise = 2, Busy = 2,
	Spots = { { Name = "Granja de la colina", X = 50, Z = 30, Tags = { "rural", "food" }, Interest = 8 },
		{ Name = "Campo de girasoles", X = -60, Z = -50, Tags = { "rural", "nature", "tourism" }, Interest = 10 } } })
district({ Id = "lake", Name = "Lago", Col = 5, Row = 1, Ground = { 80, 130, 70 }, Material = "Grass",
	Style = "cabin", Count = 2, Palette = { { 140, 100, 70 } }, Trees = 16, Water = { X = 0, Z = 0, W = 170, D = 150 },
	Tags = { "water", "nature", "tourism" }, Noise = 1, Busy = 2,
	Spots = { { Name = "Muelle del lago", X = 0, Z = 95, Tags = { "water", "nature", "tourism" }, Interest = 11 },
		{ Name = "Orilla tranquila", X = -110, Z = 0, Tags = { "water", "nature" }, Interest = 8 } } })
district({ Id = "airport", Name = "Aeropuerto", Col = 6, Row = 1, Ground = { 90, 90, 95 }, Material = "Asphalt",
	Style = "office", Count = 2, Palette = { { 210, 215, 225 } }, Trees = 0, Runway = true,
	Tags = { "travel", "vehicle", "urban" }, Noise = 7, Busy = 6,
	Spots = { { Name = "Terminal de salidas", X = -80, Z = -80, Tags = { "travel", "urban" }, Interest = 9 },
		{ Name = "Mirador de la pista", X = 60, Z = 60, Tags = { "travel", "vehicle" }, Interest = 10 } } })

-- Fila 2
district({ Id = "university", Name = "Zona universitaria", Col = 1, Row = 2, Ground = { 100, 150, 90 }, Material = "Grass",
	Style = "office", Count = 4, Palette = { { 170, 90, 70 }, { 200, 190, 170 } }, Trees = 10,
	Tags = { "education", "urban" }, Noise = 3, Busy = 5,
	Specials = { { Type = "cafe", Name = "Cibercafé Campus", X = 60, Z = -60 } },
	Spots = { { Name = "Biblioteca", X = -60, Z = 40, Tags = { "education" }, Interest = 7, Indoor = false },
		{ Name = "Patio del campus", X = 0, Z = 0, Tags = { "education", "urban" }, Interest = 7 } } })
district({ Id = "tech", Name = "Distrito tecnológico", Col = 2, Row = 2, Ground = { 70, 75, 85 }, Material = "Concrete",
	Style = "tower", Count = 7, Palette = { { 60, 160, 220 }, { 40, 60, 90 }, { 200, 220, 240 } }, Trees = 2, Neon = { 0, 200, 255 },
	Tags = { "tech", "business", "urban" }, Noise = 4, Busy = 5,
	Spots = { { Name = "Plaza de las pantallas", X = 0, Z = 0, Tags = { "tech", "urban", "night" }, Interest = 10 },
		{ Name = "Laboratorio abierto", X = 70, Z = -70, Tags = { "tech", "education" }, Interest = 9 } } })
district({ Id = "offices", Name = "Zona de oficinas", Col = 3, Row = 2, Ground = { 85, 85, 90 }, Material = "Concrete",
	Style = "office", Count = 7, Palette = { { 150, 160, 170 }, { 90, 100, 120 } }, Trees = 4,
	Tags = { "business", "urban" }, Noise = 5, Busy = 6,
	Spots = { { Name = "Vestíbulo corporativo", X = -50, Z = 50, Tags = { "business" }, Interest = 6 },
		{ Name = "Azotea de oficinas", X = 60, Z = -40, Tags = { "business", "urban" }, Interest = 8 } } })
district({ Id = "financial", Name = "Centro financiero", Col = 4, Row = 2, Ground = { 75, 75, 80 }, Material = "Marble",
	Style = "tower", Count = 8, Palette = { { 40, 50, 70 }, { 180, 190, 200 }, { 30, 30, 40 } }, Trees = 2,
	Tags = { "business", "urban", "luxury" }, Noise = 6, Busy = 7,
	Specials = { { Type = "bank", Name = "Banco Central Virtual", X = 0, Z = -80 } },
	Spots = { { Name = "Plaza de la bolsa", X = 0, Z = 40, Tags = { "business", "urban" }, Interest = 8 },
		{ Name = "Rascacielos de cristal", X = -80, Z = 80, Tags = { "business", "luxury", "night" }, Interest = 9 } } })
district({ Id = "luxury", Name = "Distrito de lujo", Col = 5, Row = 2, Ground = { 120, 160, 110 }, Material = "Grass",
	Style = "mansion", Count = 5, Palette = { { 245, 240, 230 }, { 220, 200, 160 } }, Trees = 12,
	Tags = { "luxury" }, Noise = 2, Busy = 2,
	Spots = { { Name = "Avenida de las mansiones", X = 0, Z = 0, Tags = { "luxury" }, Interest = 11 },
		{ Name = "Boutique Aurea", X = 80, Z = -80, Tags = { "luxury", "shop" }, Interest = 10 } } })
district({ Id = "hotels", Name = "Zona de hoteles", Col = 6, Row = 2, Ground = { 90, 90, 100 }, Material = "Concrete",
	Style = "hotel", Count = 5, Palette = { { 230, 210, 180 }, { 60, 80, 110 } }, Trees = 6,
	Tags = { "tourism", "luxury", "travel" }, Noise = 3, Busy = 4,
	Spots = { { Name = "Vestíbulo del Gran Hotel", X = 0, Z = 0, Tags = { "luxury", "tourism" }, Interest = 9 },
		{ Name = "Piscina en la azotea", X = 70, Z = 70, Tags = { "luxury", "tourism", "water" }, Interest = 10 } } })

-- Fila 3
district({ Id = "residential", Name = "Barrio residencial", Col = 1, Row = 3, Ground = { 110, 160, 100 }, Material = "Grass",
	Style = "house", Count = 8, Palette = { { 230, 220, 200 }, { 200, 150, 120 }, { 170, 190, 210 } }, Trees = 14,
	Tags = { "urban", "home" }, Noise = 2, Busy = 3,
	Spots = { { Name = "Calle de los jardines", X = 0, Z = 0, Tags = { "urban", "home" }, Interest = 6 },
		{ Name = "Parque infantil", X = -70, Z = 70, Tags = { "fun", "urban" }, Interest = 6 } } })
district({ Id = "creators", Name = "Barrio de creadores", Col = 2, Row = 3, Ground = { 80, 80, 90 }, Material = "Concrete",
	Style = "shop", Count = 6, Palette = { { 255, 90, 90 }, { 90, 200, 255 }, { 255, 210, 80 } }, Trees = 6, Neon = { 255, 60, 140 },
	Tags = { "urban", "studio", "fun", "tech" }, Noise = 4, Busy = 6,
	Specials = { { Type = "store", StoreId = "creator", X = -70, Z = -70 }, { Type = "store", StoreId = "camera", X = 70, Z = -70 } },
	Spots = { { Name = "Muro de grafitis", X = 0, Z = 60, Tags = { "urban", "fun" }, Interest = 9 },
		{ Name = "Calle de los creadores", X = -60, Z = 60, Tags = { "urban", "studio" }, Interest = 8 } } })
district({ Id = "park", Name = "Parque central", Col = 3, Row = 3, Ground = { 90, 160, 80 }, Material = "Grass",
	Style = "none", Count = 0, Palette = {}, Trees = 30, Water = { X = 40, Z = 40, W = 60, D = 50 },
	Tags = { "nature", "fun", "urban" }, Noise = 2, Busy = 5,
	Spots = { { Name = "Fuente del parque", X = -40, Z = -40, Tags = { "nature", "urban", "tourism" }, Interest = 9 },
		{ Name = "Estanque", X = 40, Z = 80, Tags = { "nature", "water" }, Interest = 8 } } })
district({ Id = "commercial", Name = "Zona comercial", Col = 4, Row = 3, Ground = { 85, 85, 90 }, Material = "Concrete",
	Style = "shop", Count = 6, Palette = { { 240, 240, 240 }, { 255, 160, 60 }, { 60, 120, 200 } }, Trees = 4,
	Tags = { "shop", "urban" }, Noise = 5, Busy = 7,
	Specials = { { Type = "store", StoreId = "tech", X = -70, Z = -70 }, { Type = "store", StoreId = "phone", X = 70, Z = -70 } },
	Spots = { { Name = "Pasaje comercial", X = 0, Z = 60, Tags = { "shop", "urban" }, Interest = 8 },
		{ Name = "Escaparates", X = 70, Z = 60, Tags = { "shop", "night" }, Interest = 7 } } })
district({ Id = "restaurants", Name = "Distrito de restaurantes", Col = 5, Row = 3, Ground = { 95, 85, 80 }, Material = "Brick",
	Style = "shop", Count = 7, Palette = { { 200, 90, 60 }, { 240, 200, 150 }, { 90, 50, 40 } }, Trees = 6,
	Tags = { "food", "urban" }, Noise = 4, Busy = 6,
	Spots = { { Name = "Terraza gourmet", X = 0, Z = 0, Tags = { "food", "luxury" }, Interest = 10 },
		{ Name = "Callejón de comida callejera", X = -70, Z = 70, Tags = { "food", "cheap" }, Interest = 9 } } })
district({ Id = "tourist", Name = "Zona turística", Col = 6, Row = 3, Ground = { 200, 180, 140 }, Material = "Cobblestone",
	Style = "shop", Count = 5, Palette = { { 240, 220, 180 }, { 200, 120, 80 } }, Trees = 8, Monument = true,
	Tags = { "tourism", "urban" }, Noise = 4, Busy = 7,
	Spots = { { Name = "Monumento de la ciudad", X = 0, Z = 0, Tags = { "tourism", "urban" }, Interest = 12 },
		{ Name = "Mercado de recuerdos", X = 70, Z = 70, Tags = { "tourism", "shop" }, Interest = 8 } } })

-- Fila 4
district({ Id = "budget", Name = "Barrio económico", Col = 1, Row = 4, Ground = { 95, 95, 90 }, Material = "Concrete",
	Style = "apartment", Count = 5, Palette = { { 180, 160, 140 }, { 150, 150, 160 } }, Trees = 4,
	Tags = { "urban", "cheap", "home" }, Noise = 4, Busy = 4,
	Specials = { { Type = "home", Name = "Residencia Económica", X = -40, Z = -40 } },
	Spots = { { Name = "Esquina del barrio", X = 70, Z = 70, Tags = { "urban", "cheap" }, Interest = 6 },
		{ Name = "Mercadillo local", X = -70, Z = 80, Tags = { "cheap", "food", "shop" }, Interest = 7 } } })
district({ Id = "apartments", Name = "Zona de apartamentos", Col = 2, Row = 4, Ground = { 90, 95, 95 }, Material = "Concrete",
	Style = "apartment", Count = 7, Palette = { { 200, 200, 210 }, { 120, 140, 160 } }, Trees = 6,
	Tags = { "urban", "home" }, Noise = 3, Busy = 4,
	Spots = { { Name = "Patio interior", X = 0, Z = 0, Tags = { "urban", "home" }, Interest = 5 },
		{ Name = "Azotea compartida", X = 70, Z = -70, Tags = { "urban", "night" }, Interest = 8 } } })
district({ Id = "studios", Name = "Distrito de estudios de grabación", Col = 3, Row = 4, Ground = { 60, 60, 66 }, Material = "Concrete",
	Style = "warehouse", Count = 5, Palette = { { 40, 40, 45 }, { 200, 60, 60 } }, Trees = 0, Neon = { 255, 40, 40 },
	Tags = { "studio", "business" }, Noise = 2, Busy = 3,
	Spots = { { Name = "Plató de alquiler", X = 0, Z = 0, Tags = { "studio" }, Interest = 9, Indoor = true },
		{ Name = "Callejón de los estudios", X = -70, Z = 70, Tags = { "studio", "urban" }, Interest = 7 } } })
district({ Id = "entertainment", Name = "Distrito de entretenimiento", Col = 4, Row = 4, Ground = { 60, 50, 70 }, Material = "Concrete",
	Style = "shop", Count = 6, Palette = { { 140, 60, 200 }, { 255, 80, 160 } }, Trees = 2, Neon = { 200, 80, 255 },
	Tags = { "fun", "night", "urban" }, Noise = 6, Busy = 7,
	Spots = { { Name = "Bolera retro", X = -50, Z = -50, Tags = { "fun" }, Interest = 9 },
		{ Name = "Sala de recreativos", X = 60, Z = 40, Tags = { "fun", "night" }, Interest = 10 } } })
district({ Id = "events", Name = "Distrito de eventos", Col = 5, Row = 4, Ground = { 80, 80, 85 }, Material = "Concrete",
	Style = "arena", Count = 1, Palette = { { 220, 220, 230 } }, Trees = 4,
	Tags = { "event", "fun" }, Noise = 6, Busy = 6,
	Spots = { { Name = "Explanada de eventos", X = 0, Z = 70, Tags = { "event", "fun" }, Interest = 11 },
		{ Name = "Escenario principal", X = 0, Z = -40, Tags = { "event" }, Interest = 10 } } })
district({ Id = "themepark", Name = "Parque de atracciones", Col = 6, Row = 4, Ground = { 120, 170, 100 }, Material = "Grass",
	Style = "rides", Count = 4, Palette = { { 255, 80, 80 }, { 255, 220, 60 }, { 60, 160, 255 } }, Trees = 8,
	Tags = { "fun", "tourism" }, Noise = 7, Busy = 8,
	Spots = { { Name = "Noria gigante", X = 50, Z = 0, Tags = { "fun", "tourism" }, Interest = 13 },
		{ Name = "Montaña rusa", X = -60, Z = 60, Tags = { "fun" }, Interest = 12 } } })

-- Fila 5 (sur)
district({ Id = "industrial", Name = "Distrito industrial", Col = 1, Row = 5, Ground = { 85, 80, 75 }, Material = "Asphalt",
	Style = "warehouse", Count = 6, Palette = { { 120, 110, 100 }, { 90, 100, 90 } }, Trees = 0,
	Tags = { "business", "urban" }, Noise = 7, Busy = 3,
	Spots = { { Name = "Naves industriales", X = 0, Z = 0, Tags = { "business", "urban" }, Interest = 6 },
		{ Name = "Chimenea vieja", X = 80, Z = 80, Tags = { "urban", "documentary" }, Interest = 7 } } })
district({ Id = "secondhand", Name = "Zona de tiendas de segunda mano", Col = 2, Row = 5, Ground = { 110, 95, 80 }, Material = "Brick",
	Style = "shop", Count = 6, Palette = { { 160, 120, 90 }, { 120, 150, 120 } }, Trees = 4,
	Tags = { "shop", "cheap" }, Noise = 4, Busy = 5,
	Spots = { { Name = "Rastro de los domingos", X = 0, Z = 0, Tags = { "shop", "cheap" }, Interest = 9 },
		{ Name = "Tienda de antigüedades", X = -70, Z = -60, Tags = { "shop", "cheap", "tourism" }, Interest = 8 } } })
district({ Id = "dealers", Name = "Distrito de concesionarios", Col = 3, Row = 5, Ground = { 80, 80, 85 }, Material = "Asphalt",
	Style = "showroom", Count = 4, Palette = { { 230, 235, 240 }, { 30, 30, 35 } }, Trees = 2,
	Tags = { "vehicle", "shop", "luxury" }, Noise = 5, Busy = 4,
	Spots = { { Name = "Exposición de deportivos", X = 0, Z = 0, Tags = { "vehicle", "luxury" }, Interest = 11 },
		{ Name = "Aparcamiento de clásicos", X = -70, Z = 70, Tags = { "vehicle" }, Interest = 9 } } })
district({ Id = "port", Name = "Puerto", Col = 4, Row = 5, Ground = { 90, 90, 90 }, Material = "Concrete",
	Style = "containers", Count = 10, Palette = { { 200, 60, 50 }, { 50, 100, 180 }, { 230, 170, 40 } }, Trees = 0, Water = { X = 0, Z = 90, W = 260, D = 90 },
	Tags = { "water", "business", "travel" }, Noise = 6, Busy = 4,
	Spots = { { Name = "Grúas del puerto", X = -60, Z = -40, Tags = { "business", "water" }, Interest = 8 },
		{ Name = "Embarcadero del ferry", X = 60, Z = 30, Tags = { "travel", "water" }, Interest = 9 } } })
district({ Id = "coast", Name = "Zona costera", Col = 5, Row = 5, Ground = { 190, 180, 140 }, Material = "Sand",
	Style = "house", Count = 4, Palette = { { 250, 250, 245 }, { 120, 190, 220 } }, Trees = 8, Water = { X = 0, Z = 100, W = 260, D = 70 },
	Tags = { "beach", "tourism", "luxury" }, Noise = 3, Busy = 3,
	Spots = { { Name = "Paseo marítimo", X = 0, Z = 30, Tags = { "beach", "tourism" }, Interest = 10 },
		{ Name = "Faro de la costa", X = 90, Z = -60, Tags = { "tourism", "beach" }, Interest = 11 } } })
district({ Id = "beach", Name = "Playa", Col = 6, Row = 5, Ground = { 230, 210, 160 }, Material = "Sand",
	Style = "kiosk", Count = 3, Palette = { { 255, 200, 60 }, { 60, 200, 220 } }, Trees = 10, Water = { X = 0, Z = 85, W = 260, D = 100 },
	Tags = { "beach", "water", "fun", "tourism" }, Noise = 4, Busy = 6,
	Spots = { { Name = "Orilla de la playa", X = 0, Z = 20, Tags = { "beach", "water" }, Interest = 11 },
		{ Name = "Chiringuito", X = -70, Z = -50, Tags = { "beach", "food" }, Interest = 9 } } })

WorldData.Districts = D
WorldData.DistrictById = {}
for _, d in ipairs(D) do
	WorldData.DistrictById[d.Id] = d
end

function WorldData.totalSize()
	return WorldData.Cols * WorldData.CellSize, WorldData.Rows * WorldData.CellSize
end

-- Centro del distrito en coordenadas del mundo (x, z). El mapa está centrado en el origen.
function WorldData.center(d)
	local w, h = WorldData.totalSize()
	local x = -w / 2 + (d.Col - 0.5) * WorldData.CellSize
	local z = -h / 2 + (d.Row - 0.5) * WorldData.CellSize
	return x, z
end

function WorldData.districtAt(x, z)
	local w, h = WorldData.totalSize()
	local col = math.floor((x + w / 2) / WorldData.CellSize) + 1
	local row = math.floor((z + h / 2) / WorldData.CellSize) + 1
	for _, d in ipairs(D) do
		if d.Col == col and d.Row == row then
			return d
		end
	end
	return nil
end

-- Lista plana de lugares de grabación con posición absoluta.
WorldData.Spots = {}
for _, d in ipairs(D) do
	local cx, cz = WorldData.center(d)
	for i, s in ipairs(d.Spots) do
		local spot = {
			Id = d.Id .. "_" .. i,
			Name = s.Name,
			District = d.Id,
			X = cx + s.X,
			Z = cz + s.Z,
			Tags = s.Tags,
			Interest = s.Interest or 6,
			Noise = s.Noise or d.Noise or 3,
			Busy = s.Busy or d.Busy or 3,
			Indoor = s.Indoor or false,
		}
		WorldData.Spots[#WorldData.Spots + 1] = spot
	end
end

-- Lugares secretos: se descubren al acercarse.
WorldData.Secrets = {
	{ Id = "sec_peak", Name = "Mirador escondido", District = "mountains", X = -110, Z = -110, Reward = 250, Hint = "Lo más alto y apartado de las montañas." },
	{ Id = "sec_studio", Name = "Estudio abandonado", District = "industrial", X = -110, Z = 110, Reward = 300, Hint = "Una nave olvidada en la esquina del distrito industrial." },
	{ Id = "sec_cave", Name = "Cueva del lago", District = "lake", X = 115, Z = -110, Reward = 250, Hint = "Detrás de los árboles, al otro lado del lago." },
	{ Id = "sec_cove", Name = "Cala secreta", District = "beach", X = 120, Z = -115, Reward = 250, Hint = "Un rincón de la playa que casi nadie visita." },
	{ Id = "sec_garden", Name = "Jardín oculto", District = "luxury", X = -115, Z = 115, Reward = 300, Hint = "Tras las mansiones hay un jardín privado... ¿o no tanto?" },
	{ Id = "sec_arcade", Name = "Recreativa legendaria", District = "entertainment", X = 115, Z = 115, Reward = 300, Hint = "Una máquina de juegos que nadie recuerda." },
	{ Id = "sec_forest", Name = "Árbol milenario", District = "forest", X = -115, Z = 110, Reward = 250, Hint = "El árbol más viejo del bosque." },
	{ Id = "sec_dock", Name = "Barco fantasma", District = "port", X = 120, Z = -110, Reward = 300, Hint = "Un barco que nunca zarpa." },
}
for _, s in ipairs(WorldData.Secrets) do
	local cx, cz = WorldData.center(WorldData.DistrictById[s.District])
	s.WX = cx + s.X
	s.WZ = cz + s.Z
	-- El secreto también es un lugar de grabación especial
	WorldData.Spots[#WorldData.Spots + 1] = { Id = s.Id, Name = s.Name, District = s.District, X = s.WX, Z = s.WZ,
		Tags = { "tourism", "fun" }, Interest = 15, Noise = 1, Busy = 0, Indoor = false, Secret = true }
end

WorldData.SpotById = {}
for _, s in ipairs(WorldData.Spots) do
	WorldData.SpotById[s.Id] = s
end

-- Lista de edificios especiales con posición absoluta.
WorldData.Specials = {}
for _, d in ipairs(D) do
	local cx, cz = WorldData.center(d)
	for _, sp in ipairs(d.Specials or {}) do
		local s = {}
		for k, v in pairs(sp) do
			s[k] = v
		end
		s.District = d.Id
		s.WX = cx + sp.X
		s.WZ = cz + sp.Z
		WorldData.Specials[#WorldData.Specials + 1] = s
	end
end

WorldData.SpawnDistrict = "budget"

return WorldData
