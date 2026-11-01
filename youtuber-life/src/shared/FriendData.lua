--!nonstrict
-- FriendData: personajes ficticios de la ciudad con los que puedes hacer amistad.
-- Solo amistad y relación profesional (nada romántico), apto para todas las edades.
--
-- Cada personaje: Id, Name, Job, Personality, District (donde suele estar), Color (ropa),
-- Videos (categorías de vídeo que le gustan), Gifts (categorías de objetos que le gusta recibir),
-- Dislike (categoría que no le hace ilusión), Bio y Favors (lo que ofrece al subir la amistad, uno por nivel 2-5).

local FriendData = {}

FriendData.Levels = {
	{ Name = "Conocido", Pts = 0 },
	{ Name = "Compañero", Pts = 60 },
	{ Name = "Amigo", Pts = 160 },
	{ Name = "Buen amigo", Pts = 320 },
	{ Name = "Amigo de confianza", Pts = 560 },
}

FriendData.ChatPts = 12 -- charlar (1 vez al día por personaje)
FriendData.GiftBase = 6 -- regalo: base + valor del objeto (máx. GiftValueMax)
FriendData.GiftValueMax = 24
FriendData.GiftLikedBonus = 8 -- si le gusta: x2 y +8
FriendData.DecayAfterDays = 7 -- días sin hablar antes de que la amistad se enfríe
FriendData.DecayPerDay = 2 -- puntos que se pierden por día (nunca por debajo del nivel 1)
FriendData.GuestInterest = 4 -- interés extra por escena grabada con el invitado cerca
FriendData.GuestRadius = 24
FriendData.TalkRadius = 14 -- distancia para charlar o dar un regalo en persona
FriendData.MaxLog = 12
FriendData.SponsorPayBonus = 1.25 -- las ofertas presentadas por un amigo pagan más

FriendData.FavorKinds = {
	trend = { Name = "Consejo de tendencias", Icon = "🔥", Cooldown = 2, Desc = "Te cuenta qué categorías serán tendencia mañana." },
	guest = { Name = "Invitado en tu próximo vídeo", Icon = "🎬", Cooldown = 3, Desc = "+4 de interés en las escenas que grabes a su lado (hasta publicar ese vídeo)." },
	discount = { Name = "Descuento en su tienda", Icon = "🏷", Cooldown = 5, Desc = "Rebaja en los productos de su tienda (también online) durante unos días." },
	commission = { Name = "Encargo especial", Icon = "📦", Cooldown = 2, Desc = "Te encarga grabar una escena en un lugar concreto y te paga por ello." },
	sponsor = { Name = "Presentación a un patrocinador", Icon = "🤝", Cooldown = 5, Desc = "Te presenta a una marca: recibes una oferta de patrocinio mejor pagada." },
	recipe = { Name = "Receta de la casa", Icon = "👨‍🍳", Cooldown = 3, Desc = "Te enseña una receta y te regala una ración recién hecha." },
	route = { Name = "Ruta secreta", Icon = "🧭", Cooldown = 3, Desc = "Te lleva gratis cerca de un lugar secreto que aún no conoces." },
}

-- Diálogos por personalidad. Tramo 1 = niveles 1-2, tramo 2 = nivel 3, tramo 3 = niveles 4-5.
FriendData.Personalities = {
	entusiasta = {
		Name = "Entusiasta",
		Greet = {
			{ "¡Hola! ¿Tú también haces vídeos? ¡Qué guay!", "¡Ey! Siempre me alegra ver caras nuevas por aquí." },
			{ "¡Hola! Justo estaba pensando en ideas para vídeos. ¿Te cuento?", "¡Qué bien verte! Hoy tengo un montón de energía." },
			{ "¡Mi creador favorito de la ciudad! ¿Qué grabamos hoy?", "¡Por fin! Te tenía que enseñar una cosa genial." },
		},
		Chat = {
			{ "Me paso el día probando cosas nuevas. ¡La ciudad está llena de rincones para grabar!", "¿Sabías que la luz del atardecer hace que todo parezca de película?" },
			{ "Tu último vídeo me hizo reír un montón. ¡Sigue así!", "Si algún día necesitas ayuda con una toma, cuenta conmigo." },
			{ "Me encanta ver cuánto has mejorado. ¡Estoy muy orgullosa de nuestro equipo!", "Gracias por pasarte siempre a saludar. Eres un gran colega." },
		},
		Liked = "¡¿En serio?! ¡Me encanta! ¿Cómo sabías que me gusta esto?",
		Neutral = "¡Muchas gracias! Qué detalle tan bonito.",
		Up = "¡Ya somos %s! Esto hay que celebrarlo con un buen vídeo.",
	},
	alegre = {
		Name = "Alegre",
		Greet = {
			{ "¡Buenas! Pasa, pasa, aquí siempre hay sitio.", "¡Hola! Qué buen día hace para charlar un rato." },
			{ "¡Mira quién está aquí! Ya te echaba de menos.", "¡Hola, colega! ¿Cómo va ese canal?" },
			{ "¡Mi persona favorita del barrio! Siéntate, que te cuento.", "¡Hola! Hoy te tengo guardada una sorpresa." },
		},
		Chat = {
			{ "El secreto de todo es hacerlo con ganas. ¡Y comer bien!", "Aquí cada día pasa algo divertido. Ayer un cliente bailó en la cola." },
			{ "Cuando te veo grabar me dan ganas de salir en cámara, ¡ja, ja!", "Un buen ánimo se nota en los vídeos. ¡Tú lo tienes!" },
			{ "Tener amigos como tú hace que todo sea más fácil.", "Si algún día tienes un mal día, ven aquí y te lo arreglo con una sonrisa." },
		},
		Liked = "¡Qué ilusión! Es justo lo que me encanta. ¡Mil gracias!",
		Neutral = "¡Gracias! Me has alegrado el día.",
		Up = "¡Ahora somos %s! Ven cuando quieras, aquí tienes tu casa.",
	},
	intelectual = {
		Name = "Curiosa",
		Greet = {
			{ "Hola. ¿Sabías que el primer vídeo de la historia duraba solo unos segundos?", "Buenas. Estaba leyendo sobre sensores de imagen, fascinante." },
			{ "¡Hola! Tengo una teoría sobre por qué tus vídeos funcionan tan bien.", "Hola, me alegra verte. Tengo datos interesantes que contarte." },
			{ "¡Hola! Siempre aprendo algo cuando hablamos.", "Hola, socio. He preparado unas notas para tu próximo proyecto." },
		},
		Chat = {
			{ "Un buen guion ahorra horas de edición. Planificar es clave.", "Cuanto mejor sea el procesador, antes exportas. Es pura física." },
			{ "He visto que tus miniaturas han mejorado mucho. Los números no mienten.", "Si quieres, un día te explico cómo leer las estadísticas de tu canal." },
			{ "Trabajar contigo es un placer: preguntas mucho y eso es bueno.", "Confío en tu criterio. Me gusta cómo piensas tus vídeos." },
		},
		Liked = "Vaya, esto es muy útil. Gracias, de verdad, me encanta.",
		Neutral = "Gracias. Es un detalle muy amable.",
		Up = "Oficialmente somos %s. Las estadísticas lo confirman.",
	},
	deportista = {
		Name = "Deportista",
		Greet = {
			{ "¡Hola! ¿Vienes a dar una vuelta? Hoy el aire está perfecto.", "¡Buenas! Acabo de volver de una ruta increíble." },
			{ "¡Hola, compañero de aventuras! ¿Qué tal las piernas?", "¡Ey! Hoy es buen día para grabar al aire libre." },
			{ "¡Mi equipo favorito de exploración! ¿Adónde vamos hoy?", "¡Hola! Te he guardado el mejor sitio para grabar." },
		},
		Chat = {
			{ "Lleva siempre agua y batería de sobra. La naturaleza no tiene enchufes.", "Las mejores vistas siempre están un poco más arriba." },
			{ "Grabar en movimiento es difícil. Un estabilizador ayuda muchísimo.", "Me gusta tu forma de enseñar los paisajes. Se nota que los disfrutas." },
			{ "Contigo cualquier excursión es más divertida.", "Gracias por acompañarme siempre. Eres un gran compañero de ruta." },
		},
		Liked = "¡Genial! Esto me lo llevo a la próxima excursión. ¡Gracias!",
		Neutral = "¡Gracias! Muy amable por tu parte.",
		Up = "¡Subimos de nivel: ya somos %s! Como en una buena ruta.",
	},
	artista = {
		Name = "Artista",
		Greet = {
			{ "Hola... perdona, estaba pensando en colores. ¿Qué tal?", "Buenas. Me gusta tu estilo, tiene personalidad." },
			{ "¡Hola! Tengo una idea visual que te encantaría.", "Hola, qué bien que vengas. Necesitaba otra opinión." },
			{ "¡Hola! Eres de las pocas personas que entienden mi trabajo.", "Hola. Te he hecho un boceto de una miniatura, ¿lo ves luego?" },
		},
		Chat = {
			{ "La composición de una imagen lo es todo. Prueba la regla de los tercios.", "Inspirarse es fácil: basta con mirar la ciudad con calma." },
			{ "Tus colores han mejorado mucho. Se nota que cuidas los detalles.", "Una buena miniatura cuenta una historia en un segundo." },
			{ "Crear con alguien de confianza es lo mejor que hay.", "Gracias por valorar lo que hago. Me inspiras a seguir." },
		},
		Liked = "Oh... es precioso. Me encanta, de verdad. Gracias.",
		Neutral = "Gracias, es un detalle muy bonito.",
		Up = "Ahora somos %s. Me hace mucha ilusión.",
	},
	bromista = {
		Name = "Bromista",
		Greet = {
			{ "¡Hola! ¿Sabes por qué la cámara fue al médico? ¡Porque tenía mal enfoque!", "¡Buenas! ¿Vienes a por chistes gratis?" },
			{ "¡Hombre, mi público favorito! ¿Te cuento el chiste del trípode?", "¡Hola! Hoy vengo con las bromas recién hechas." },
			{ "¡Mi colega de risas! Sin ti esto es muy aburrido.", "¡Hola! Te he guardado mi mejor chiste para hoy." },
		},
		Chat = {
			{ "¿Qué le dice un vídeo a otro? ¡Nos vemos en la lista de reproducción!", "La risa es el mejor filtro para cualquier vídeo." },
			{ "Tu último vídeo tenía un momento graciosísimo. ¡Lo vi tres veces!", "Si necesitas a alguien para un reto divertido, aquí estoy." },
			{ "Hablando en serio (por una vez): me alegra mucho ser tu amigo.", "Contigo hasta los días grises son divertidos." },
		},
		Liked = "¡Anda! ¡Esto es genial! Ahora te debo un chiste de los buenos.",
		Neutral = "¡Gracias! No tengo chiste para esto, ¡me has dejado sin palabras!",
		Up = "¡Ya somos %s! Y eso no es broma.",
	},
	tranquila = {
		Name = "Tranquila",
		Greet = {
			{ "Hola. Bienvenido, sin prisas.", "Buenas. ¿Un día tranquilo?" },
			{ "Hola de nuevo. Siempre es agradable verte.", "Hola. ¿Qué tal va todo? Cuéntame con calma." },
			{ "Hola, amigo. Tu visita siempre me alegra el día.", "Hola. Te esperaba, tengo algo para ti." },
		},
		Chat = {
			{ "Las cosas bien hechas llevan su tiempo. No te agobies.", "Cuidar tu equipo es cuidar tu trabajo." },
			{ "Me gusta cómo trabajas: con constancia.", "Descansar también es parte del trabajo. Recuérdalo." },
			{ "Puedes contar conmigo para lo que necesites.", "Es bonito tener a alguien de confianza en la ciudad." },
		},
		Liked = "Muchas gracias. Justo lo que me gusta. Me has emocionado.",
		Neutral = "Gracias, lo aprecio mucho.",
		Up = "Ya somos %s. Me alegra mucho.",
	},
	timida = {
		Name = "Tímida",
		Greet = {
			{ "Ah... h-hola. No suelo hablar mucho, perdona.", "Hola... ¿necesitas algo?" },
			{ "¡Hola! Ya no me da tanta vergüenza hablar contigo.", "Hola. Me alegra que hayas venido." },
			{ "¡Hola! Contigo me siento muy a gusto.", "Hola, amigo. Tenía ganas de enseñarte algo." },
		},
		Chat = {
			{ "Me gusta trabajar con auriculares y en silencio.", "Los sonidos de la ciudad son preciosos si escuchas bien." },
			{ "Escuché tu último vídeo con buenos auriculares. El audio estaba muy bien.", "Gracias por tener paciencia conmigo." },
			{ "Eres de las pocas personas con las que hablo sin nervios.", "Me ayudas a salir de mi estudio. Gracias por eso." },
		},
		Liked = "¡Oh! Me... me encanta. Muchísimas gracias.",
		Neutral = "Gracias... qué amable.",
		Up = "Ahora somos %s... me hace mucha ilusión.",
	},
}

local function favor(level, kind, extra)
	local f = extra or {}
	f.Level = level
	f.Kind = kind
	return f
end

FriendData.Friends = {
	{ Id = "lucia", Name = "Lucía Prado", Job = "Experta en cámaras de FotoPro", Personality = "entusiasta", District = "creators", Color = { 230, 90, 60 },
		Videos = { "tech", "review", "tutorial" }, Gifts = { "camera", "accessory", "audio" }, Dislike = "food",
		Bio = "Conoce cada cámara de la tienda y le encanta enseñar a grabar.",
		Favors = { favor(2, "trend"), favor(3, "guest"), favor(4, "discount", { Store = "camera", Pct = 15, Days = 3 }), favor(5, "sponsor", { Brand = "pixelia" }) } },
	{ Id = "tomas", Name = "Tomás Ferrer", Job = "Chef del Restaurante La Plaza", Personality = "alegre", District = "restaurants", Color = { 245, 245, 245 },
		Videos = { "food", "cooking", "vlog" }, Gifts = { "food", "decor" }, Dislike = "component",
		Bio = "Cocina para medio barrio y siempre tiene una receta nueva.",
		Favors = { favor(2, "recipe", { Recipe = "meal_pizza" }), favor(3, "guest"), favor(4, "discount", { Store = "market", Pct = 20, Days = 3 }), favor(5, "sponsor", { Brand = "sabor" }) } },
	{ Id = "nora", Name = "Nora Vidal", Job = "Guía de montaña", Personality = "deportista", District = "camping", Color = { 60, 150, 80 },
		Videos = { "adventure", "nature", "tourism" }, Gifts = { "camera", "accessory", "food" }, Dislike = "furniture",
		Bio = "Organiza excursiones y conoce todos los senderos de la sierra.",
		Favors = { favor(2, "route"), favor(3, "guest"), favor(4, "commission", { Spot = "camping_1", Reward = 300 }), favor(5, "sponsor", { Brand = "ferro" }) } },
	{ Id = "dario", Name = "Darío Méndez", Job = "Técnico informático de MegaTec", Personality = "intelectual", District = "commercial", Color = { 40, 90, 170 },
		Videos = { "tech", "compare", "gaming" }, Gifts = { "component", "peripheral", "storage" }, Dislike = "decor",
		Bio = "Monta ordenadores a ciegas y explica la informática con paciencia.",
		Favors = { favor(2, "trend"), favor(3, "discount", { Store = "tech", Pct = 10, Days = 3 }), favor(4, "guest"), favor(5, "sponsor", { Brand = "nexo" }) } },
	{ Id = "marta", Name = "Marta Solís", Job = "Profesora de ciencias", Personality = "intelectual", District = "university", Color = { 150, 80, 160 },
		Videos = { "education", "experiment", "documentary" }, Gifts = { "tablet", "decor", "food" }, Dislike = "gadget",
		Bio = "Da clase en la universidad y prepara experimentos seguros y sorprendentes.",
		Favors = { favor(2, "trend"), favor(3, "commission", { Spot = "university_1", Reward = 220 }), favor(4, "guest"), favor(5, "sponsor", { Brand = "lumina" }) } },
	{ Id = "kike", Name = "Kike Robles", Job = "Monitor de surf", Personality = "bromista", District = "beach", Color = { 40, 170, 200 },
		Videos = { "challenge", "adventure", "travel" }, Gifts = { "gadget", "food", "accessory" }, Dislike = "storage",
		Bio = "Enseña surf a todas las edades y siempre tiene un chiste preparado.",
		Favors = { favor(2, "recipe", { Recipe = "meal_smoothie" }), favor(3, "guest"), favor(4, "route"), favor(5, "sponsor", { Brand = "ruta" }) } },
	{ Id = "ines", Name = "Inés Calvo", Job = "Diseñadora de moda", Personality = "artista", District = "luxury", Color = { 200, 60, 120 },
		Videos = { "fashion", "luxury", "shopping" }, Gifts = { "decor", "gadget", "phone" }, Dislike = "component",
		Bio = "Diseña ropa para desfiles y le encantan los colores atrevidos.",
		Favors = { favor(2, "trend"), favor(3, "guest"), favor(4, "sponsor", { Brand = "modanova" }), favor(5, "sponsor", { Brand = "aurea" }) } },
	{ Id = "rafa", Name = "Rafa Ortega", Job = "Mecánico de Motor City", Personality = "tranquila", District = "dealers", Color = { 90, 90, 100 },
		Videos = { "cars", "review", "budget" }, Gifts = { "gadget", "accessory", "food" }, Dislike = "decor",
		Bio = "Arregla cualquier motor y conoce todos los atajos de la ciudad.",
		Favors = { favor(2, "route"), favor(3, "commission", { Spot = "dealers_1", Reward = 260 }), favor(4, "guest"), favor(5, "sponsor", { Brand = "ferro" }) } },
	{ Id = "carmen", Name = "Carmen Ruiz", Job = "Decoradora de Hogar & Deco", Personality = "artista", District = "residential", Color = { 230, 180, 60 },
		Videos = { "decor", "tutorial", "vlog" }, Gifts = { "decor", "furniture" }, Dislike = "component",
		Bio = "Transforma cualquier habitación con cuatro muebles y mucha imaginación.",
		Favors = { favor(2, "trend"), favor(3, "discount", { Store = "home", Pct = 15, Days = 3 }), favor(4, "guest"), favor(5, "sponsor", { Brand = "hogarvivo" }) } },
	{ Id = "leo", Name = "Leo Navarro", Job = "Productor de música", Personality = "timida", District = "studios", Color = { 30, 30, 40 },
		Videos = { "tutorial", "interview", "vlog" }, Gifts = { "audio", "peripheral", "gadget" }, Dislike = "food",
		Bio = "Compone bandas sonoras en su estudio y cuida cada sonido.",
		Favors = { favor(2, "trend"), favor(3, "guest"), favor(4, "discount", { Store = "creator", Pct = 15, Days = 3 }), favor(5, "sponsor", { Brand = "lumina" }) } },
	{ Id = "sara", Name = "Sara Molina", Job = "Reportera de eventos", Personality = "entusiasta", District = "events", Color = { 220, 50, 50 },
		Videos = { "events", "interview", "places" }, Gifts = { "phone", "camera", "audio" }, Dislike = "furniture",
		Bio = "Cubre todos los eventos de la ciudad con su micrófono en mano.",
		Favors = { favor(2, "commission", { Spot = "events_1", Reward = 240 }), favor(3, "guest"), favor(4, "discount", { Store = "phone", Pct = 10, Days = 3 }), favor(5, "sponsor", { Brand = "orbis" }) } },
	{ Id = "pablo", Name = "Pablo Gil", Job = "Organizador de torneos de videojuegos", Personality = "bromista", District = "entertainment", Color = { 120, 60, 200 },
		Videos = { "gaming", "challenge", "events" }, Gifts = { "gadget", "peripheral", "food" }, Dislike = "furniture",
		Bio = "Monta torneos en la sala de recreativos y conoce a todos los jugadores.",
		Favors = { favor(2, "trend"), favor(3, "guest"), favor(4, "commission", { Spot = "entertainment_2", Reward = 260 }), favor(5, "sponsor", { Brand = "kairo" }) } },
}

FriendData.ById = {}
for _, f in ipairs(FriendData.Friends) do
	FriendData.ById[f.Id] = f
end

-- Nivel (1-5) a partir de los puntos
function FriendData.levelOf(pts)
	local lvl = 1
	for i, l in ipairs(FriendData.Levels) do
		if (pts or 0) >= l.Pts then
			lvl = i
		end
	end
	return lvl
end

-- Progreso dentro del nivel actual: (puntos en el nivel, puntos necesarios) o nil si es el máximo
function FriendData.progress(pts)
	local lvl = FriendData.levelOf(pts)
	local nxt = FriendData.Levels[lvl + 1]
	if not nxt then
		return nil
	end
	local base = FriendData.Levels[lvl].Pts
	return (pts or 0) - base, nxt.Pts - base
end

function FriendData.tier(level)
	if level >= 4 then
		return 3
	elseif level == 3 then
		return 2
	end
	return 1
end

function FriendData.favorAt(friend, level)
	for _, f in ipairs(friend.Favors) do
		if f.Level == level then
			return f
		end
	end
	return nil
end

-- Clave de un gusto: "v:<categoría de vídeo>" o "g:<categoría de objeto>"
function FriendData.likeKeys(friend)
	local keys = {}
	for _, v in ipairs(friend.Videos) do
		keys[#keys + 1] = "v:" .. v
	end
	for _, g in ipairs(friend.Gifts) do
		keys[#keys + 1] = "g:" .. g
	end
	return keys
end

return FriendData
