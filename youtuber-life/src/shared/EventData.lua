--!nonstrict
-- EventData: eventos dinámicos reutilizables. Cada día de juego hay un evento distinto (rotación determinista),
-- con lugar, horario, actividades, efectos reales y recompensas. Añadir un evento = añadir una entrada aquí.
--
-- Effects:
--   Discount = { Cats = {...} | All = true, Rate = 0.2 }  → precios de las tiendas
--   ViewBonus = { Cats = {...}, Mult = 1.3 }              → visitas de vídeos publicados ese día
--   EventSpotBonus = 1.3                                    → escenas grabadas en el lugar del evento
--   TaxiDiscount = 0.5
-- Goals (recompensa una vez por evento):
--   checkin  = ir al lugar del evento
--   photo    = foto en el lugar con calidad mínima
--   publish  = publicar N vídeos (opcionalmente de ciertas categorías / calidad / edición mínima)
--   decor    = tener una propiedad con decoración mínima
--   scene    = grabar N escenas en el lugar del evento

local EventData = {}

EventData.Events = {
	{ Id = "techfair", Name = "Feria tecnológica", District = "tech", Spot = "tech_1", Hours = { 9, 21 },
		Desc = "Las marcas presentan novedades. 15% de descuento en tecnología y más visitas para vídeos de tecnología.",
		Effects = { Discount = { Cats = { "pc", "laptop", "monitor", "peripheral", "component", "storage" }, Rate = 0.15 }, ViewBonus = { Cats = { "tech", "review", "compare", "unboxing" }, Mult = 1.25 }, EventSpotBonus = 1.2 },
		Goals = { { Type = "checkin", Reward = 150 }, { Type = "scene", N = 3, Reward = 250 }, { Type = "publish", N = 1, Cats = { "tech", "review", "compare", "unboxing" }, Reward = 400 } } },
	{ Id = "phonelaunch", Name = "Lanzamiento del Zenit Pro", District = "commercial", Spot = "commercial_1", Hours = { 10, 20 },
		Desc = "Presentación de un teléfono ficticio. 20% de descuento en teléfonos y tabletas.",
		Effects = { Discount = { Cats = { "phone", "tablet" }, Rate = 0.2 }, ViewBonus = { Cats = { "tech", "unboxing", "review" }, Mult = 1.2 } },
		Goals = { { Type = "checkin", Reward = 100 }, { Type = "photo", MinQ = 55, Reward = 200 } } },
	{ Id = "saleweek", Name = "Semana de descuentos", District = "commercial", Spot = "commercial_2", Hours = { 8, 22 },
		Desc = "Todas las tiendas con un 20% de descuento. Vídeos de compras y económicos con más visitas.",
		Effects = { Discount = { All = true, Rate = 0.2 }, ViewBonus = { Cats = { "shopping", "budget" }, Mult = 1.3 } },
		Goals = { { Type = "checkin", Reward = 100 }, { Type = "publish", N = 1, Cats = { "shopping", "budget" }, Reward = 300 } } },
	{ Id = "musicfest", Name = "Festival de música", District = "events", Spot = "events_2", Hours = { 16, 24 },
		Desc = "Conciertos ficticios en el escenario principal. Grabar allí da escenas más interesantes.",
		Effects = { ViewBonus = { Cats = { "events", "vlog" }, Mult = 1.3 }, EventSpotBonus = 1.35 },
		Goals = { { Type = "checkin", Reward = 120 }, { Type = "scene", N = 3, Reward = 300 }, { Type = "photo", MinQ = 60, Reward = 200 } } },
	{ Id = "carshow", Name = "Exposición de vehículos", District = "dealers", Spot = "dealers_1", Hours = { 10, 20 },
		Desc = "Deportivos y clásicos expuestos. Vídeos de automóviles con más visitas.",
		Effects = { ViewBonus = { Cats = { "cars", "luxury" }, Mult = 1.35 }, EventSpotBonus = 1.25 },
		Goals = { { Type = "checkin", Reward = 120 }, { Type = "photo", MinQ = 60, Reward = 250 }, { Type = "publish", N = 1, Cats = { "cars" }, Reward = 350 } } },
	{ Id = "realestate", Name = "Feria inmobiliaria", District = "residential", Spot = "residential_1", Hours = { 9, 19 },
		Desc = "10% de descuento en muebles y decoración. Vídeos de decoración con más visitas.",
		Effects = { Discount = { Cats = { "decor", "furniture" }, Rate = 0.1 }, ViewBonus = { Cats = { "decor" }, Mult = 1.3 } },
		Goals = { { Type = "checkin", Reward = 100 }, { Type = "decor", Min = 20, Reward = 400 } } },
	{ Id = "photocontest", Name = "Concurso de fotografía", District = "park", Spot = "park_1", Hours = { 6, 20 },
		Desc = "Haz la mejor foto en la fuente del parque. Premios según la calidad.",
		Effects = {},
		Goals = { { Type = "photo", MinQ = 50, Reward = 200 }, { Type = "photo", MinQ = 70, Reward = 400 }, { Type = "photo", MinQ = 85, Reward = 800 } } },
	{ Id = "editcomp", Name = "Competición de edición", District = "studios", Spot = "studios_1", Hours = { 8, 22 },
		Desc = "Publica un vídeo con una edición excelente para ganar premios.",
		Effects = { ViewBonus = { Cats = { "tutorial", "education" }, Mult = 1.2 } },
		Goals = { { Type = "publish", N = 1, MinEdit = 60, Reward = 300 }, { Type = "publish", N = 1, MinEdit = 80, Reward = 700 } } },
	{ Id = "creatorfest", Name = "Festival de creadores", District = "events", Spot = "events_1", Hours = { 10, 22 },
		Desc = "Encuentro de creadores. Todo lo grabado en la explanada gusta más al público.",
		Effects = { ViewBonus = { Cats = { "vlog", "events", "interview", "challenge" }, Mult = 1.3 }, EventSpotBonus = 1.4 },
		Goals = { { Type = "checkin", Reward = 150 }, { Type = "scene", N = 4, Reward = 350 }, { Type = "publish", N = 1, Reward = 300 } } },
	{ Id = "storeopening", Name = "Inauguración de Hogar & Deco", District = "residential", Spot = "residential_2", Hours = { 9, 21 },
		Desc = "25% de descuento en Hogar & Deco por su reapertura.",
		Effects = { Discount = { Cats = { "decor" }, Rate = 0.25 } },
		Goals = { { Type = "checkin", Reward = 100 } } },
	{ Id = "sportsday", Name = "Día del deporte", District = "beach", Spot = "beach_1", Hours = { 8, 19 },
		Desc = "Torneo ficticio en la playa. Retos y aventuras con más visitas.",
		Effects = { ViewBonus = { Cats = { "challenge", "adventure" }, Mult = 1.3 }, EventSpotBonus = 1.25 },
		Goals = { { Type = "checkin", Reward = 120 }, { Type = "scene", N = 3, Reward = 300 } } },
	{ Id = "gamecon", Name = "Convención de videojuegos", District = "entertainment", Spot = "entertainment_2", Hours = { 12, 24 },
		Desc = "Novedades de juegos ficticios. Consolas y mandos un 20% más baratos.",
		Effects = { Discount = { Cats = { "gadget" }, Rate = 0.2 }, ViewBonus = { Cats = { "gaming" }, Mult = 1.35 }, EventSpotBonus = 1.2 },
		Goals = { { Type = "checkin", Reward = 120 }, { Type = "publish", N = 1, Cats = { "gaming" }, Reward = 350 } } },
	{ Id = "fleamarket", Name = "Mercado de segunda mano", District = "secondhand", Spot = "secondhand_1", Hours = { 7, 15 },
		Desc = "Puestos de objetos usados con precios aún más bajos.",
		Effects = { UsedDiscount = 0.2, ViewBonus = { Cats = { "budget", "shopping" }, Mult = 1.2 } },
		Goals = { { Type = "checkin", Reward = 100 }, { Type = "photo", MinQ = 45, Reward = 150 } } },
	{ Id = "decorcontest", Name = "Concurso de decoración", District = "apartments", Spot = "apartments_1", Hours = { 8, 22 },
		Desc = "Las mejores salas ganan premios (decoración de tu propiedad).",
		Effects = { ViewBonus = { Cats = { "decor" }, Mult = 1.25 } },
		Goals = { { Type = "decor", Min = 15, Reward = 250 }, { Type = "decor", Min = 30, Reward = 600 } } },
	{ Id = "tourism", Name = "Semana del turismo", District = "tourist", Spot = "tourist_1", Hours = { 8, 21 },
		Desc = "Taxis a mitad de precio y más interés por los vídeos de turismo.",
		Effects = { TaxiDiscount = 0.5, ViewBonus = { Cats = { "tourism", "travel", "places" }, Mult = 1.3 }, EventSpotBonus = 1.2 },
		Goals = { { Type = "checkin", Reward = 120 }, { Type = "photo", MinQ = 55, Reward = 200 }, { Type = "publish", N = 1, Cats = { "tourism", "travel", "places" }, Reward = 300 } } },
	{ Id = "videochallenge", Name = "Desafío de vídeos", District = "creators", Spot = "creators_1", Hours = { 0, 24 },
		Desc = "Publica dos vídeos hoy para completar el desafío.",
		Effects = { ViewBonus = { Cats = {}, Mult = 1.0 } },
		Goals = { { Type = "publish", N = 1, Reward = 150 }, { Type = "publish", N = 2, Reward = 400 } } },
}
EventData.ById = {}
for _, e in ipairs(EventData.Events) do
	EventData.ById[e.Id] = e
end

-- Evento del día (rotación determinista)
function EventData.forDay(day)
	local n = #EventData.Events
	return EventData.Events[((day * 7) % n) + 1]
end

function EventData.goalText(g)
	if g.Type == "checkin" then
		return "Ve al lugar del evento"
	elseif g.Type == "photo" then
		return "Foto en el lugar con calidad " .. g.MinQ .. "+"
	elseif g.Type == "scene" then
		return "Graba " .. g.N .. " escenas en el lugar"
	elseif g.Type == "publish" then
		local t = "Publica " .. g.N .. " vídeo" .. (g.N > 1 and "s" or "") .. " hoy"
		if g.MinEdit then
			t = t .. " con edición " .. g.MinEdit .. "+"
		end
		if g.Cats then
			t = t .. " (categoría del evento)"
		end
		return t
	elseif g.Type == "decor" then
		return "Ten una sala con decoración " .. g.Min .. "+"
	end
	return g.Type
end

return EventData
