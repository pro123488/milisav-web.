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
}

StadiumPieces.ById = {}
for _, piece in ipairs(StadiumPieces.List) do
	StadiumPieces.ById[piece.id] = piece
end

return StadiumPieces
