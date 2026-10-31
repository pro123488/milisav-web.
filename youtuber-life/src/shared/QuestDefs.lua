--!nonstrict
-- QuestDefs: tutorial guiado + logros progresivos generados de forma reutilizable.
-- Cada logro se completa UNA sola vez y su recompensa se cobra una sola vez.

local QuestDefs = {}

-- Tutorial: avanza cuando ocurre el evento indicado en el paso actual.
-- Target: veces que debe ocurrir el evento. Marker: lugar al que apunta la flecha guía.
QuestDefs.Tutorial = {
	{ Id = "t_style", Name = "Elige tu apariencia", Event = "appearance", Hint = "Pulsa el botón ESTILO (o tecla V) y elige los colores de tu ropa.", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_phone", Name = "Abre tu teléfono", Event = "open_phone", Hint = "Pulsa el botón TELÉFONO o la tecla P. Siempre lo llevas contigo.", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_home", Name = "Conoce tu primera vivienda", Event = "enter_home", Hint = "Sigue la flecha hasta tu habitación en la Residencia Económica.", Marker = "home", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_pc", Name = "Usa un computador", Event = "open_computer", Hint = "Acércate al escritorio de tu habitación y pulsa E (o toca el aviso) para encender el computador.", Marker = "home", Reward = { Money = 75, Xp = 25 } },
	{ Id = "t_idea", Name = "Elige una idea", Event = "create_project", Hint = "En el computador abre la app IDEAS y crea un proyecto (prueba con «Compras» o «Tecnología»).", Reward = { Money = 75, Xp = 25 } },
	{ Id = "t_pack", Name = "Prepara la mochila", Event = "pack", Hint = "Abre INVENTARIO (tecla I) y mueve el trípode a la mochila. El teléfono siempre va contigo.", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_store", Name = "Visita una tienda", Event = "visit_store", Hint = "Sal de casa y entra en MegaTec (Zona comercial). Usa el TAXI del teléfono (app Mapa) si quieres llegar rápido.", Marker = "store_tech", Reward = { Money = 75, Xp = 25 } },
	{ Id = "t_record", Name = "Graba 3 escenas", Event = "record_scene", Target = 3, Hint = "Ve a un lugar de grabación (icono 🎥), pulsa GRABAR (tecla R), elige tu proyecto y graba 3 tomas.", Reward = { Money = 100, Xp = 40 } },
	{ Id = "t_return", Name = "Regresa a casa", Event = "enter_home", Hint = "Vuelve a tu habitación para organizar el material.", Marker = "home", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_edit", Name = "Edita el proyecto", Event = "save_edit", Hint = "En el computador abre EDITOR, importa el material, ordena las escenas y pulsa GUARDAR.", Marker = "home", Reward = { Money = 100, Xp = 40 } },
	{ Id = "t_thumb", Name = "Crea una miniatura", Event = "thumbnail", Hint = "Abre MINIATURAS, elige una foto o escena, añade texto y guarda el diseño.", Reward = { Money = 75, Xp = 30 } },
	{ Id = "t_publish", Name = "Publica el vídeo", Event = "publish", Hint = "En el EDITOR exporta el proyecto y luego publícalo desde YOUTUBE STUDIO.", Reward = { Money = 150, Xp = 60 } },
	{ Id = "t_stats", Name = "Consulta las estadísticas", Event = "open_analytics", Hint = "Abre ESTADÍSTICAS (en el computador o en el teléfono) y mira cómo crece tu vídeo.", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_claim", Name = "Cobra tus primeras recompensas", Event = "claim_reward", Hint = "Abre MISIONES (tecla M) y cobra un logro completado.", Reward = { Money = 50, Xp = 20 } },
	{ Id = "t_upgrade", Name = "Compra una mejora", Event = "buy_item", Hint = "Compra equipo en una tienda física o en la app TIENDA. ¡Una cámara mejora mucho tus vídeos!", Reward = { Money = 100, Xp = 40 } },
	{ Id = "t_explore", Name = "Explora una nueva zona", Event = "new_district", Hint = "Visita un distrito en el que no hayas estado. Hay 30 y algunos esconden secretos.", Reward = { Money = 150, Xp = 60 } },
}

-- Contadores por los que se generan logros: { clave, plantilla de nombre, niveles, dinero base, xp base, títulos por índice }
local tracks = {
	{ "published", "Publica %s vídeos", { 1, 3, 5, 10, 25, 50, 100, 250 }, 100, 40, { [1] = "Primer vídeo", [5] = "Constante", [8] = "Incansable" } },
	{ "subs", "Alcanza %s suscriptores", { 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000 }, 150, 60, { [3] = "Socio del programa", [5] = "Mil gracias", [7] = "Placa de plata", [9] = "Placa de oro", [11] = "Placa de diamante" } },
	{ "total_views", "Consigue %s visitas totales", { 100, 1000, 10000, 100000, 1000000, 10000000 }, 120, 50, { [4] = "Viral" } },
	{ "revenue", "Gana %s $ con tus vídeos", { 100, 1000, 10000, 100000, 1000000 }, 100, 50, { [3] = "Rentable", [5] = "Millonario digital" } },
	{ "scenes", "Graba %s escenas", { 1, 10, 50, 100, 250, 500 }, 50, 25, { [4] = "Camarógrafo" } },
	{ "photos", "Toma %s fotografías", { 1, 10, 50, 100, 250 }, 40, 20, { [3] = "Fotógrafo", [5] = "Ojo de halcón" } },
	{ "thumbnails", "Diseña %s miniaturas", { 1, 5, 25, 50 }, 50, 25, { [3] = "Diseñador" } },
	{ "items_bought", "Compra %s artículos", { 1, 5, 10, 25, 50, 100 }, 40, 20, { [5] = "Comprador experto" } },
	{ "cameras_owned", "Colección: ten %s cámaras distintas", { 1, 3, 5, 7 }, 120, 50, { [4] = "Coleccionista de cámaras" } },
	{ "pcs_built", "Monta %s computadores", { 1, 3, 5 }, 200, 80, { [1] = "Montador", [3] = "Maestro del hardware" } },
	{ "benchmarks", "Haz %s pruebas de rendimiento", { 1, 10 }, 60, 30, {} },
	{ "districts_visited", "Visita %s distritos", { 3, 5, 10, 20, 30 }, 80, 40, { [5] = "Explorador urbano" } },
	{ "districts_recorded", "Graba en %s distritos", { 1, 5, 10, 20, 30 }, 100, 50, { [5] = "Trotamundos local" } },
	{ "stores_visited", "Visita %s tiendas distintas", { 1, 4 }, 60, 30, {} },
	{ "categories_published", "Publica en %s categorías distintas", { 3, 5, 10, 20, 27 }, 120, 60, { [5] = "Todoterreno" } },
	{ "secrets_found", "Descubre %s lugares secretos", { 1, 4, 8 }, 150, 80, { [3] = "Cazador de secretos" } },
	{ "level", "Llega al nivel %s", { 5, 10, 15, 20, 30, 50 }, 150, 0, { [6] = "Leyenda" } },
	{ "max_quality", "Publica un vídeo de calidad %s+", { 50, 60, 70, 80, 90 }, 120, 60, { [5] = "Perfeccionista" } },
	{ "comparisons", "Publica %s comparativas", { 1, 5, 10 }, 120, 50, { [3] = "Analista" } },
	{ "reviews", "Publica %s reseñas con prueba real", { 1, 5, 10 }, 120, 50, { [3] = "Crítico" } },
	{ "jobs_done", "Completa %s encargos de trabajo", { 1, 10, 50, 100 }, 60, 30, { [4] = "Trabajador incansable" } },
	{ "taxi_rides", "Viaja %s veces en taxi", { 1, 10, 50 }, 30, 15, {} },
	{ "exports", "Exporta %s proyectos", { 1, 10, 50 }, 60, 30, {} },
	{ "golden_scenes", "Graba %s escenas en la hora dorada", { 1, 10, 50 }, 60, 30, { [3] = "Cazador de luz" } },
	{ "night_photos", "Toma %s fotos nocturnas", { 1, 10, 25 }, 50, 25, {} },
	{ "rentals", "Alquila %s viviendas", { 1, 3 }, 100, 50, {} },
	{ "properties_owned", "Sé propietario de %s propiedades", { 1, 2, 4 }, 300, 120, { [1] = "Propietario", [3] = "Magnate inmobiliario" } },
	{ "furniture_placed", "Coloca %s muebles", { 1, 10, 30, 75 }, 60, 30, { [3] = "Interiorista" } },
	{ "remodels", "Remodela %s veces una sala", { 1, 5, 15 }, 60, 30, {} },
	{ "decor_max", "Consigue una decoración de %s puntos", { 10, 20, 30, 40 }, 120, 60, { [3] = "Estudio de ensueño" } },
}

QuestDefs.TrackNames = {
	published = "Vídeos publicados", subs = "Suscriptores", total_views = "Visitas", revenue = "Ingresos de vídeo",
	scenes = "Escenas", photos = "Fotos", thumbnails = "Miniaturas", items_bought = "Compras", cameras_owned = "Cámaras",
	pcs_built = "PC montados", benchmarks = "Benchmarks", districts_visited = "Distritos visitados",
	districts_recorded = "Distritos grabados", stores_visited = "Tiendas visitadas", categories_published = "Categorías",
	secrets_found = "Secretos", level = "Nivel", max_quality = "Mejor calidad", comparisons = "Comparativas",
	reviews = "Reseñas", jobs_done = "Encargos", taxi_rides = "Taxis", exports = "Exportaciones",
	golden_scenes = "Hora dorada", night_photos = "Fotos nocturnas", rentals = "Alquileres", properties_owned = "Propiedades",
	furniture_placed = "Muebles colocados", remodels = "Remodelaciones", decor_max = "Mejor decoración",
}

local function fmt(n)
	local s = tostring(n)
	local out = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
	if out:sub(1, 1) == "." then
		out = out:sub(2)
	end
	return out
end

QuestDefs.Achievements = {}
QuestDefs.ById = {}
for _, t in ipairs(tracks) do
	local key, tpl, tiers, money, xp, titles = t[1], t[2], t[3], t[4], t[5], t[6]
	for i, target in ipairs(tiers) do
		local q = {
			Id = key .. "_" .. i,
			Counter = key,
			Target = target,
			Tier = i,
			Name = string.format(tpl, fmt(target)),
			Group = QuestDefs.TrackNames[key] or key,
			Reward = { Money = math.floor(money * (i ^ 1.6)), Xp = math.floor(xp * (i ^ 1.4)), Title = titles[i] },
		}
		QuestDefs.Achievements[#QuestDefs.Achievements + 1] = q
		QuestDefs.ById[q.Id] = q
	end
end
for _, step in ipairs(QuestDefs.Tutorial) do
	QuestDefs.ById[step.Id] = step
end

return QuestDefs
