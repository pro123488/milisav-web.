--!nonstrict
-- VideoData: datos de creación de contenido (ideas, tomas, edición, miniaturas, fotos).

local VideoData = {}

-- Etiquetas de lugares usadas por WorldData: urban, shop, food, tech, nature, beach, mountain, luxury,
-- night, tourism, home, studio, business, education, event, vehicle, rural, water, fun, cheap, travel
VideoData.Categories = {
	{ Id = "vlog", Name = "Vlogs", Tags = { "urban", "home", "tourism", "fun" }, Interest = 50, Rpm = 2.0 },
	{ Id = "places", Name = "Visitas a lugares", Tags = { "tourism", "urban", "luxury", "fun" }, Interest = 52, Rpm = 2.2 },
	{ Id = "tourism", Name = "Turismo", Tags = { "tourism", "beach", "mountain", "water" }, Interest = 54, Rpm = 2.6 },
	{ Id = "food", Name = "Restaurantes", Tags = { "food" }, Interest = 55, Rpm = 2.4 },
	{ Id = "tech", Name = "Tecnología", Tags = { "tech", "shop", "home", "studio" }, Interest = 56, Rpm = 4.5, ProductBonus = true },
	{ Id = "compare", Name = "Comparativas", Tags = { "tech", "shop", "home", "studio" }, Interest = 58, Rpm = 4.8, NeedsProducts = 2 },
	{ Id = "unboxing", Name = "Unboxings", Tags = { "home", "studio", "shop" }, Interest = 55, Rpm = 4.0, NeedsProducts = 1 },
	{ Id = "review", Name = "Reseñas", Tags = { "home", "studio", "shop", "tech" }, Interest = 54, Rpm = 4.2, NeedsProducts = 1 },
	{ Id = "challenge", Name = "Retos", Tags = { "urban", "fun", "beach", "event" }, Interest = 60, Rpm = 1.8 },
	{ Id = "shopping", Name = "Compras", Tags = { "shop", "luxury", "cheap" }, Interest = 50, Rpm = 3.0 },
	{ Id = "fashion", Name = "Moda", Tags = { "shop", "luxury", "urban" }, Interest = 50, Rpm = 3.2 },
	{ Id = "decor", Name = "Decoración", Tags = { "home", "shop" }, Interest = 48, Rpm = 3.0 },
	{ Id = "cars", Name = "Automóviles", Tags = { "vehicle", "luxury" }, Interest = 53, Rpm = 4.0 },
	{ Id = "gaming", Name = "Videojuegos", Tags = { "home", "studio", "event" }, Interest = 57, Rpm = 2.0, GamingBonus = true },
	{ Id = "cooking", Name = "Cocina", Tags = { "home", "food" }, Interest = 51, Rpm = 2.8 },
	{ Id = "adventure", Name = "Aventuras", Tags = { "nature", "mountain", "water", "beach" }, Interest = 58, Rpm = 2.5 },
	{ Id = "nature", Name = "Naturaleza", Tags = { "nature", "mountain", "water", "rural" }, Interest = 49, Rpm = 2.3 },
	{ Id = "travel", Name = "Viajes", Tags = { "travel", "tourism", "beach" }, Interest = 55, Rpm = 3.0 },
	{ Id = "business", Name = "Negocios", Tags = { "business", "tech" }, Interest = 45, Rpm = 6.0 },
	{ Id = "interview", Name = "Entrevistas", Tags = { "urban", "event", "business", "studio" }, Interest = 50, Rpm = 3.0 },
	{ Id = "education", Name = "Educativos", Tags = { "education", "home", "studio" }, Interest = 47, Rpm = 4.0 },
	{ Id = "documentary", Name = "Documentales", Tags = { "nature", "rural", "business", "tourism" }, Interest = 48, Rpm = 3.4 },
	{ Id = "experiment", Name = "Experimentos seguros", Tags = { "home", "education", "studio" }, Interest = 57, Rpm = 2.6 },
	{ Id = "luxury", Name = "Vídeos de lujo", Tags = { "luxury" }, Interest = 56, Rpm = 3.5 },
	{ Id = "budget", Name = "Vídeos económicos", Tags = { "cheap", "shop" }, Interest = 52, Rpm = 2.7 },
	{ Id = "tutorial", Name = "Tutoriales", Tags = { "home", "studio", "tech", "education" }, Interest = 50, Rpm = 4.2 },
	{ Id = "events", Name = "Eventos", Tags = { "event", "fun" }, Interest = 55, Rpm = 2.5 },
}
VideoData.CategoryById = {}
for _, c in ipairs(VideoData.Categories) do
	VideoData.CategoryById[c.Id] = c
end

VideoData.Styles = { "Divertido", "Informativo", "Cinematográfico", "Relajado", "Enérgico", "Profesional" }
VideoData.Durations = { { Id = "short", Name = "Corto (1-3 min)", Seconds = 120 }, { Id = "medium", Name = "Medio (8-12 min)", Seconds = 600 }, { Id = "long", Name = "Largo (20+ min)", Seconds = 1200 } }
VideoData.Goals = { "Ganar suscriptores", "Conseguir visitas", "Generar ingresos", "Mejorar la reputación", "Experimentar" }
VideoData.Transport = { "Caminar", "Taxi", "Transporte público" }

-- Formatos de publicación (cada uno con requisitos y resultados propios)
VideoData.Formats = {
	{ Id = "video", Name = "Vídeo", Desc = "Formato estándar." },
	{ Id = "short", Name = "Short", Desc = "Máximo 75 s. Más visitas, menos ingresos por visita.", MaxSeconds = 75, ViewMult = 1.6, RpmMult = 0.35, SubMult = 0.7 },
	{ Id = "podcast", Name = "Podcast", Desc = "Mínimo 3 tomas de presentación o entrevista con buen audio. Menos visitas, más ingresos y fidelidad.", MinTalk = 3, MinAudio = 50, ViewMult = 0.7, RpmMult = 1.8, SubMult = 1.3 },
	{ Id = "series", Name = "Episodio de serie", Desc = "Cada episodio de la misma serie atrae a más público fiel (hasta +30%).", Series = true },
	{ Id = "doc", Name = "Documental / reportaje", Desc = "Mínimo 8 escenas y 6 minutos. Más reputación si la calidad es alta.", MinScenes = 8, MinSeconds = 360, ViewMult = 0.9, RpmMult = 1.4, SubMult = 1.1 },
}
VideoData.FormatById = {}
for _, f in ipairs(VideoData.Formats) do
	VideoData.FormatById[f.Id] = f
end

-- Tipos de toma. Seconds = duración simulada en el vídeo final.
VideoData.Shots = {
	{ Id = "wide", Name = "Plano general", Seconds = 20, Interest = 6 },
	{ Id = "closeup", Name = "Primer plano", Seconds = 15, Interest = 8 },
	{ Id = "talking", Name = "Presentación a cámara", Seconds = 40, Interest = 10, Presenter = true },
	{ Id = "product", Name = "Plano de producto", Seconds = 25, Interest = 10, NeedsProduct = true },
	{ Id = "broll", Name = "Recursos (B-roll)", Seconds = 12, Interest = 5 },
	{ Id = "pan", Name = "Paneo", Seconds = 14, Interest = 6, Moving = true },
	{ Id = "tracking", Name = "Toma en movimiento", Seconds = 25, Interest = 11, Moving = true },
	{ Id = "timelapse", Name = "Time-lapse", Seconds = 10, Interest = 12, NeedsTripod = true },
	{ Id = "interview", Name = "Entrevista", Seconds = 45, Interest = 12, NeedsPeople = true },
	{ Id = "aerial", Name = "Toma aérea (dron)", Seconds = 18, Interest = 16, NeedsDrone = true },
}
VideoData.ShotById = {}
for _, s in ipairs(VideoData.Shots) do
	VideoData.ShotById[s.Id] = s
end

VideoData.Transitions = {
	{ Id = "cut", Name = "Corte" },
	{ Id = "fade", Name = "Fundido" },
	{ Id = "slide", Name = "Deslizar" },
	{ Id = "zoom", Name = "Zoom" },
	{ Id = "wipe", Name = "Barrido" },
	{ Id = "glitch", Name = "Glitch" },
}

VideoData.Effects = {
	{ Id = "slowmo", Name = "Cámara lenta", Fits = { "adventure", "cars", "tourism", "nature", "challenge" } },
	{ Id = "zoompunch", Name = "Zoom dinámico", Fits = { "challenge", "gaming", "vlog", "fun" } },
	{ Id = "animtext", Name = "Texto animado", Fits = { "education", "tutorial", "tech", "compare", "business" } },
	{ Id = "vignette", Name = "Viñeta", Fits = { "documentary", "luxury", "food", "travel" } },
	{ Id = "bokeh", Name = "Desenfoque de fondo", Fits = { "review", "unboxing", "fashion", "interview" } },
	{ Id = "particles", Name = "Partículas", Fits = { "events", "gaming", "luxury" } },
	{ Id = "split", Name = "Pantalla dividida", Fits = { "compare", "experiment", "shopping", "budget" } },
}

-- Biblioteca de música ficticia (sin derechos de autor reales).
VideoData.Music = {
	{ Id = "none", Name = "Sin música", Artist = "", Mood = "Neutral", Fits = {} },
	{ Id = "m_sunny", Name = "Mañana Soleada", Artist = "Estudio Brisa", Mood = "Alegre", Fits = { "vlog", "places", "tourism", "travel", "food", "cooking" } },
	{ Id = "m_pulse", Name = "Pulso Digital", Artist = "Circuito 9", Mood = "Tecnológico", Fits = { "tech", "compare", "review", "unboxing", "tutorial", "business" } },
	{ Id = "m_epic", Name = "Cumbre Épica", Artist = "Orquesta Horizonte", Mood = "Épico", Fits = { "adventure", "nature", "documentary", "cars", "events" } },
	{ Id = "m_chill", Name = "Tarde Tranquila", Artist = "Lo-Fi Barrio", Mood = "Relajado", Fits = { "education", "tutorial", "decor", "cooking", "vlog" } },
	{ Id = "m_arcade", Name = "Nivel Extra", Artist = "Pixel Banda", Mood = "Gamer", Fits = { "gaming", "challenge", "experiment" } },
	{ Id = "m_gold", Name = "Terciopelo Dorado", Artist = "Salón Aurea", Mood = "Elegante", Fits = { "luxury", "fashion", "shopping", "cars" } },
	{ Id = "m_funk", Name = "Funk de Mercadillo", Artist = "Los Ofertas", Mood = "Divertido", Fits = { "budget", "shopping", "challenge", "fun" } },
	{ Id = "m_news", Name = "Titular", Artist = "Redacción Sonora", Mood = "Serio", Fits = { "business", "interview", "documentary", "education" } },
	{ Id = "m_wave", Name = "Olas de Verano", Artist = "Costa Sur", Mood = "Veraniego", Fits = { "tourism", "travel", "adventure", "events" } },
	{ Id = "m_kitchen", Name = "A Fuego Lento", Artist = "Cocina Swing", Mood = "Cálido", Fits = { "cooking", "food" } },
}
VideoData.MusicById = {}
for _, m in ipairs(VideoData.Music) do
	VideoData.MusicById[m.Id] = m
end

VideoData.Intros = {
	{ Id = "none", Name = "Sin introducción" },
	{ Id = "logo", Name = "Logo animado" },
	{ Id = "hook", Name = "Gancho con lo mejor del vídeo" },
	{ Id = "title", Name = "Título con música" },
}
VideoData.Outros = {
	{ Id = "none", Name = "Sin cierre" },
	{ Id = "subscribe", Name = "Invitación a suscribirse" },
	{ Id = "endscreen", Name = "Pantalla final con vídeos" },
	{ Id = "bloopers", Name = "Tomas falsas" },
}

-- Miniaturas
VideoData.Fonts = {
	{ Id = "GothamBlack", Readability = 10 },
	{ Id = "LuckiestGuy", Readability = 9 },
	{ Id = "Bangers", Readability = 8 },
	{ Id = "FredokaOne", Readability = 9 },
	{ Id = "Oswald", Readability = 8 },
	{ Id = "GothamBold", Readability = 8 },
	{ Id = "SourceSansBold", Readability = 7 },
	{ Id = "Michroma", Readability = 6 },
	{ Id = "Arcade", Readability = 5 },
	{ Id = "PermanentMarker", Readability = 5 },
}
VideoData.FontById = {}
for _, f in ipairs(VideoData.Fonts) do
	VideoData.FontById[f.Id] = f
end

VideoData.Palette = {
	{ 255, 255, 255 }, { 20, 20, 24 }, { 255, 214, 0 }, { 255, 60, 60 }, { 0, 200, 255 }, { 60, 220, 120 },
	{ 255, 120, 0 }, { 190, 90, 255 }, { 255, 90, 170 }, { 30, 60, 160 }, { 120, 120, 130 }, { 0, 110, 80 },
}

VideoData.ThumbTemplates = {
	{ Id = "left", Name = "Texto a la izquierda", Composition = 9 },
	{ Id = "top", Name = "Texto arriba", Composition = 8 },
	{ Id = "center", Name = "Texto centrado grande", Composition = 6 },
	{ Id = "split", Name = "Antes / después", Composition = 8 },
	{ Id = "corner", Name = "Texto en esquina", Composition = 7 },
}
VideoData.ThumbTemplateById = {}
for _, t in ipairs(VideoData.ThumbTemplates) do
	VideoData.ThumbTemplateById[t.Id] = t
end

VideoData.Stickers = {
	{ Id = "arrow", Name = "Flecha", Glyph = "➜" },
	{ Id = "circle", Name = "Círculo", Glyph = "◯" },
	{ Id = "star", Name = "Estrella", Glyph = "★" },
	{ Id = "new", Name = "NUEVO", Glyph = "NUEVO" },
	{ Id = "price", Name = "Precio", Glyph = "$$$" },
	{ Id = "vs", Name = "VS", Glyph = "VS" },
	{ Id = "wow", Name = "Sorpresa", Glyph = "!?" },
	{ Id = "fire", Name = "Fuego", Glyph = "🔥" },
}
VideoData.Frames = { { Id = "none", Name = "Sin marco" }, { Id = "solid", Name = "Marco sólido" }, { Id = "double", Name = "Marco doble" }, { Id = "neon", Name = "Marco neón" } }

-- Fotografía
VideoData.PhotoModes = {
	{ Id = "portrait", Name = "Retrato", Tags = { "urban", "fun", "event", "home" } },
	{ Id = "landscape", Name = "Paisaje", Tags = { "nature", "mountain", "beach", "water", "rural", "tourism" } },
	{ Id = "closeup", Name = "Primer plano", Tags = {} },
	{ Id = "product", Name = "Fotografía de producto", Tags = { "shop", "tech", "home", "studio" }, NeedsProduct = true },
	{ Id = "night", Name = "Fotografía nocturna", Tags = { "night", "urban", "luxury" }, Night = true },
	{ Id = "interior", Name = "Interiores", Tags = { "home", "shop", "food", "studio", "luxury" } },
	{ Id = "vehicle", Name = "Vehículos", Tags = { "vehicle" } },
	{ Id = "pet", Name = "Mascotas", Tags = { "home", "nature" } },
	{ Id = "tourist", Name = "Turística", Tags = { "tourism", "travel", "beach" } },
}
VideoData.PhotoModeById = {}
for _, p in ipairs(VideoData.PhotoModes) do
	VideoData.PhotoModeById[p.Id] = p
end
VideoData.PhotoFilters = { "Ninguno", "Vívido", "Cálido", "Frío", "Blanco y negro", "Vintage", "Cine" }

-- Canal
VideoData.Banners = {
	{ { 255, 60, 60 }, { 120, 0, 40 } }, { { 0, 200, 255 }, { 20, 40, 120 } }, { { 60, 220, 120 }, { 0, 90, 70 } },
	{ { 255, 214, 0 }, { 255, 100, 0 } }, { { 190, 90, 255 }, { 40, 0, 90 } }, { { 40, 40, 48 }, { 10, 10, 14 } },
}
VideoData.Avatars = { "🎬", "📷", "🎮", "🍜", "🚀", "🌴", "💡", "🎧", "🏙", "⭐" }

-- Comentarios simulados según la calidad
VideoData.Comments = {
	low = { "Se escucha un poco mal...", "Buen intento, sigue practicando", "La imagen está oscura", "¿Podrías mejorar el audio?", "Me gusta la idea, pero falta edición" },
	mid = { "¡Buen vídeo!", "Me gustó la parte del final", "Sigue así", "¿Para cuándo la segunda parte?", "Interesante el lugar", "Nuevo suscriptor aquí" },
	high = { "¡Qué calidad de vídeo!", "La edición está brutal", "Este canal va a crecer muchísimo", "La miniatura me atrapó", "Lo vi entero sin pestañear", "Merece muchas más visitas" },
}

return VideoData
