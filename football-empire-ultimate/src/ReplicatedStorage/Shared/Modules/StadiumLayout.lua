-- StadiumLayout (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/StadiumLayout
--
-- Plano del terreno en coordenadas LOCALES (iguales para todos los terrenos):
--   X: -150..150 · Z: -105..105 · Z+ = plaza y entrada principal.
-- Lo usan StadiumRenderer (servidor), PlacementRules (servidor y cliente) y el
-- modo de colocación del cliente. Cambiar el plano aquí lo cambia en todo el juego.
--
--            N (marcador)
--   ┌──────────────────────────────┐
--   │ carril O │  gradas + campo │ carril E │
--   │ vestuar. │                 │ entrenam.│
--   │ trofeos  │     CAMPO       │ zona VIP │
--   │ tienda   │                 │ restaur. │
--   │ academia │     PLAZA (decoraciones)   │
--   └────────────────── puerta ────┘

local StadiumLayout = {}

StadiumLayout.HALF_X = 150
StadiumLayout.HALF_Z = 105

StadiumLayout.PITCH_CENTER_Z = -10
StadiumLayout.PITCH_LENGTH = 100
StadiumLayout.PITCH_WIDTH = 64
StadiumLayout.ROW_DEPTH = 3
StadiumLayout.ROW_STEP = 1.5
StadiumLayout.ROWS_BY_LEVEL = { 4, 5, 6, 8, 10, 12, 14 }

-- Punto de aparición (mirando al campo)
StadiumLayout.SPAWN = Vector3.new(0, 4, 72)

-- Instalaciones en los carriles laterales
StadiumLayout.Facilities = {
	lockers = Vector3.new(-122, 0, -65),
	trophyRoom = Vector3.new(-122, 0, -12),
	shop = Vector3.new(-122, 0, 38),
	academy = Vector3.new(-122, 0, 86),
	training = Vector3.new(122, 0, -65),
	vip = Vector3.new(122, 0, -12),
	restaurant = Vector3.new(122, 0, 38),
}

-- Elementos fijos de la plaza
StadiumLayout.SIGN = Vector3.new(0, 0, 82)
StadiumLayout.KIT_DISPLAY = Vector3.new(-22, 0, 84)
StadiumLayout.MONUMENT = Vector3.new(0, 0, 96)

-- Zona donde se pueden colocar decoraciones (rectángulo local: xMin, xMax, zMin, zMax).
-- Está dentro del terreno y fuera de gradas, instalaciones y carriles.
StadiumLayout.DecorationZones = {
	{ xMin = -92, xMax = 92, zMin = 76, zMax = 102 },
}

-- Áreas reservadas dentro de la zona (no se puede colocar encima).
StadiumLayout.Reserved = {
	{ name = "Camino de entrada", xMin = -7, xMax = 7, zMin = 70, zMax = 105 },
	{ name = "Cartel del club", xMin = -15, xMax = 15, zMin = 79, zMax = 85 },
	{ name = "Expositor de equipación", xMin = -26, xMax = -18, zMin = 82, zMax = 86 },
}

return StadiumLayout
