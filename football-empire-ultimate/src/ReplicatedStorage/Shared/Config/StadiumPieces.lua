-- StadiumPieces (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/StadiumPieces
--
-- CONSTRUCCIÓN LIBRE DEL ESTADIO: piezas sueltas que cada jugador coloca donde quiere
-- en su terreno (una silla aquí, el campo allí, una grada allá…).
--   w = ancho (eje X local sin rotar) · d = fondo (eje Z) · h = alto aproximado (vista previa)
-- Se pagan con el dinero del club; al quitarlas se devuelve REFUND del precio.

local StadiumPieces = {}

StadiumPieces.MAX_PIECES = 200 -- límite por terreno (rendimiento)
StadiumPieces.REFUND = 0.5
StadiumPieces.MAX_HEIGHT = 40 -- altura máxima (studs) a la que se puede subir una pieza

StadiumPieces.Categories = {
	{ id = "field", name = "Campo", icon = "🟩" },
	{ id = "stands", name = "Gradas y asientos", icon = "💺" },
	{ id = "structure", name = "Estructura", icon = "🧱" },
	{ id = "extras", name = "Extras", icon = "✨" },
	{ id = "rebirth", name = "Renacimiento (exclusivas)", icon = "👑" },
}

StadiumPieces.List = {
	-- Campo
	{ id = "pitch_full", category = "field", icon = "🏟️", name = "Campo grande", cost = 20000, w = 104, d = 68, h = 1 },
	{ id = "pitch_mini", category = "field", icon = "⚽", name = "Campo pequeño", cost = 6000, w = 52, d = 34, h = 1 },
	{ id = "goal", category = "field", icon = "🥅", name = "Portería", cost = 1500, w = 4, d = 14, h = 6 },
	{ id = "grass_tile", category = "field", icon = "🌱", name = "Césped 8×8", cost = 200, w = 8, d = 8, h = 1 },
	{ id = "path_tile", category = "field", icon = "⬜", name = "Suelo de plaza 8×8", cost = 150, w = 8, d = 8, h = 1 },
	{ id = "bench", category = "field", icon = "🪑", name = "Banquillo", cost = 800, w = 10, d = 3, h = 4 },
	-- Gradas y asientos
	{ id = "seat", category = "stands", icon = "💺", name = "Silla", cost = 50, w = 2, d = 2, h = 3 },
	{ id = "seat_row", category = "stands", icon = "💺", name = "Fila de 10 sillas", cost = 400, w = 20, d = 2, h = 3 },
	{ id = "stand_small", category = "stands", icon = "🏟️", name = "Grada pequeña", cost = 5000, w = 30, d = 10, h = 8 },
	{ id = "stand_big", category = "stands", icon = "🏟️", name = "Grada grande", cost = 15000, w = 60, d = 16, h = 13 },
	{ id = "stand_corner", category = "stands", icon = "📐", name = "Grada de esquina", cost = 6000, w = 16, d = 16, h = 10 },
	{ id = "vip_box", category = "stands", icon = "🥂", name = "Palco VIP", cost = 9000, w = 20, d = 8, h = 10 },
	-- Estructura
	{ id = "wall", category = "structure", icon = "🧱", name = "Muro", cost = 300, w = 16, d = 1, h = 6 },
	{ id = "fence", category = "structure", icon = "🚧", name = "Valla", cost = 150, w = 16, d = 1, h = 3 },
	{ id = "roof", category = "structure", icon = "🏠", name = "Techo de grada", cost = 3000, w = 30, d = 10, h = 14 },
	{ id = "gate", category = "structure", icon = "🚪", name = "Puerta de entrada", cost = 2500, w = 16, d = 4, h = 12 },
	{ id = "floodlight", category = "structure", icon = "💡", name = "Torre de focos", cost = 2500, w = 4, d = 4, h = 30 },
	{ id = "scoreboard", category = "structure", icon = "📺", name = "Marcador", cost = 4000, w = 16, d = 2, h = 14 },
	-- Extras
	{ id = "flag", category = "extras", icon = "🚩", name = "Bandera del club", cost = 300, w = 2, d = 2, h = 10 },
	{ id = "ad_board", category = "extras", icon = "📣", name = "Valla publicitaria", cost = 500, w = 16, d = 1, h = 3 },
	{ id = "kiosk", category = "extras", icon = "🌭", name = "Puesto de comida", cost = 1500, w = 8, d = 8, h = 8 },
	{ id = "tree", category = "extras", icon = "🌳", name = "Árbol", cost = 200, w = 6, d = 6, h = 12 },
	{ id = "lamp", category = "extras", icon = "🏮", name = "Farola", cost = 250, w = 2, d = 2, h = 9 },
	-- Nuevas: estructura para construir en altura
	{ id = "platform", category = "structure", icon = "⬛", name = "Plataforma 16×16", cost = 1200, w = 16, d = 16, h = 1 },
	{ id = "stairs", category = "structure", icon = "🪜", name = "Escalera", cost = 800, w = 6, d = 12, h = 8 },
	{ id = "column", category = "structure", icon = "🏛️", name = "Columna", cost = 400, w = 3, d = 3, h = 12 },
	{ id = "jumbotron", category = "structure", icon = "📺", name = "Pantalla gigante", cost = 12000, w = 28, d = 3, h = 22 },
	{ id = "ticket_booth", category = "structure", icon = "🎫", name = "Taquilla", cost = 2000, w = 8, d = 6, h = 7 },
	-- Nuevas: extras
	{ id = "fountain", category = "extras", icon = "⛲", name = "Fuente", cost = 3500, w = 12, d = 12, h = 6 },
	{ id = "statue", category = "extras", icon = "🗿", name = "Estatua de jugador", cost = 6000, w = 6, d = 6, h = 14 },
	{ id = "trophy_case", category = "extras", icon = "🏆", name = "Vitrina de trofeos", cost = 5000, w = 10, d = 4, h = 8 },
	{ id = "team_bus", category = "extras", icon = "🚌", name = "Autobús del equipo", cost = 7000, w = 24, d = 8, h = 9 },
	{ id = "palm", category = "extras", icon = "🌴", name = "Palmera", cost = 300, w = 6, d = 6, h = 16 },
	{ id = "flowers", category = "extras", icon = "🌷", name = "Jardinera de flores", cost = 250, w = 8, d = 4, h = 2 },
	{ id = "balloon_arch", category = "extras", icon = "🎈", name = "Arco de globos", cost = 1800, w = 18, d = 2, h = 14 },
	-- Exclusivas de renacimiento (requiresRebirth = renacimientos necesarios)
	{ id = "gold_statue", category = "rebirth", icon = "👑", name = "Estatua dorada", cost = 50000, requiresRebirth = 3, w = 8, d = 8, h = 18 },
	{ id = "gold_gate", category = "rebirth", icon = "🚪", name = "Puerta dorada", cost = 40000, requiresRebirth = 3, w = 20, d = 5, h = 16 },
	{ id = "gold_fountain", category = "rebirth", icon = "⛲", name = "Fuente de oro", cost = 60000, requiresRebirth = 3, w = 14, d = 14, h = 9 },
	{ id = "rebirth_monument", category = "rebirth", icon = "🔄", name = "Monumento al renacido", cost = 100000, requiresRebirth = 5, w = 10, d = 10, h = 24 },
}

StadiumPieces.ById = {}
for _, piece in ipairs(StadiumPieces.List) do
	StadiumPieces.ById[piece.id] = piece
end

return StadiumPieces
