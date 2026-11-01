--!nonstrict
-- LifeData: vehículos, mascotas, destinos de viaje y empresa (datos compartidos).

local LifeData = {}

---------------------------------------------------------------------------
-- VEHÍCULOS (cada modelo es distinto en velocidad, giro, maletero, consumo y tamaño)
-- Fuel: "none" (bicicleta), "battery" (eléctricos) o "gas". Trunk = espacios extra de mochila cerca del vehículo.
---------------------------------------------------------------------------
LifeData.Vehicles = {
	{ Id = "v_bike", Name = "Bicicleta urbana", Type = "Bicicleta", Price = 250, Speed = 34, Turn = 2.6, Trunk = 0, Fuel = "none", Use = 0, Size = { 2, 4, 6 }, Level = 1 },
	{ Id = "v_scooter", Name = "Patinete eléctrico", Type = "Patinete", Price = 450, Speed = 40, Turn = 2.8, Trunk = 0, Fuel = "battery", Use = 0.8, Size = { 2, 4, 5 }, Level = 1 },
	{ Id = "v_moto", Name = "Moto Ferro 125", Type = "Motocicleta", Price = 2200, Speed = 70, Turn = 2.2, Trunk = 1, Fuel = "gas", Use = 0.6, Size = { 3, 5, 8 }, Level = 2 },
	{ Id = "v_compact", Name = "Orbis Compacto", Type = "Automóvil económico", Price = 6500, Speed = 75, Turn = 1.8, Trunk = 4, Fuel = "gas", Use = 0.5, Size = { 6, 5, 11 }, Level = 3 },
	{ Id = "v_ev", Name = "Zenit E-Volt", Type = "Eléctrico", Price = 14000, Speed = 90, Turn = 1.9, Trunk = 4, Fuel = "battery", Use = 0.4, Size = { 6, 5, 12 }, Level = 5 },
	{ Id = "v_van", Name = "Furgoneta Stratos Cargo", Type = "Furgoneta", Price = 11000, Speed = 65, Turn = 1.4, Trunk = 10, Fuel = "gas", Use = 0.7, Size = { 7, 7, 15 }, Level = 4 },
	{ Id = "v_truck", Name = "Camión ligero Ferro", Type = "Vehículo de carga", Price = 18000, Speed = 55, Turn = 1.1, Trunk = 16, Fuel = "gas", Use = 0.9, Size = { 8, 9, 18 }, Level = 6 },
	{ Id = "v_offroad", Name = "Todoterreno Ferro Trail", Type = "Todoterreno", Price = 21000, Speed = 80, Turn = 1.6, Trunk = 6, Fuel = "gas", Use = 0.8, Size = { 7, 7, 13 }, Level = 6 },
	{ Id = "v_sport", Name = "Kairo GT", Type = "Deportivo", Price = 48000, Speed = 125, Turn = 2.0, Trunk = 2, Fuel = "gas", Use = 1.0, Size = { 6, 4, 12 }, Level = 9 },
	{ Id = "v_lux", Name = "Aurea Majestic", Type = "Vehículo de lujo", Price = 95000, Speed = 110, Turn = 1.7, Trunk = 5, Fuel = "gas", Use = 0.9, Size = { 7, 5, 14 }, Level = 12 },
}
LifeData.VehicleById = {}
for _, v in ipairs(LifeData.Vehicles) do
	LifeData.VehicleById[v.Id] = v
end
LifeData.VehicleColors = {
	{ "Rojo", { 200, 30, 40 } }, { "Azul", { 30, 90, 200 } }, { "Blanco", { 240, 240, 240 } }, { "Negro", { 20, 20, 25 } },
	{ "Amarillo", { 250, 200, 40 } }, { "Verde", { 50, 160, 90 } }, { "Naranja", { 255, 120, 0 } }, { "Morado", { 140, 70, 200 } },
}
LifeData.VehicleUpgrades = {
	engine = { Name = "Motor mejorado", Desc = "+15% velocidad máxima", Rate = 0.12 },
	handling = { Name = "Suspensión y neumáticos", Desc = "+20% de giro", Rate = 0.08 },
	trunk = { Name = "Maletero ampliado", Desc = "+3 espacios de carga", Rate = 0.06 },
}

---------------------------------------------------------------------------
-- MASCOTAS
---------------------------------------------------------------------------
LifeData.Pets = {
	{ Id = "dog", Name = "Perro", Price = 300, Follows = true, Size = 1.0 },
	{ Id = "cat", Name = "Gato", Price = 250, Follows = true, Size = 0.8 },
	{ Id = "bird", Name = "Pájaro", Price = 150, Follows = true, Size = 0.5, Flies = true },
	{ Id = "rabbit", Name = "Conejo", Price = 180, Follows = true, Size = 0.6 },
	{ Id = "turtle", Name = "Tortuga", Price = 120, Follows = true, Size = 0.6 },
	{ Id = "fish", Name = "Peces (acuario)", Price = 200, Follows = false, Size = 1.0 },
}
LifeData.PetById = {}
for _, p in ipairs(LifeData.Pets) do
	LifeData.PetById[p.Id] = p
end
LifeData.PetColors = { { 140, 100, 60 }, { 240, 240, 240 }, { 30, 30, 30 }, { 230, 160, 60 }, { 120, 120, 130 }, { 255, 200, 200 }, { 80, 170, 230 }, { 90, 200, 120 } }
LifeData.PetAccessories = { "Ninguno", "Collar rojo", "Pajarita", "Gorrito", "Pañuelo", "Gafas de sol" }

---------------------------------------------------------------------------
-- DESTINOS DE VIAJE (zonas lejos de la ciudad, se llega en avión desde el aeropuerto)
--   Spots = { { nombre, x, z, etiquetas, interés } } relativos a Center (x, z).
--   Shop = objetos exclusivos (ItemCatalog, Exclusive = Id) que solo se compran allí.
--   Req = { Level, Rank } (Rank = invitación: rango de creador o un patrocinio activo).
---------------------------------------------------------------------------
LifeData.Destinations = {
	{ Id = "island", Name = "Isla Tropical Coral", Cost = 900, Req = { Level = 3 }, Center = { 3600, 0 }, Ground = { 230, 210, 160 }, Material = "Sand",
		Noise = 2, Busy = 4, Theme = "island",
		Desc = "Playas de arena blanca, arrecife y un pueblo pesquero.",
		Spots = { { "Playa de coral", 0, 60, { "beach", "water", "tourism", "travel" }, 16 }, { "Muelle del pueblo", -80, -40, { "travel", "food", "tourism" }, 14 }, { "Mirador de la palmera", 90, -70, { "nature", "tourism", "travel" }, 15 } },
		Shop = { "x_cam_dive", "x_hat_straw", "x_shell" }, ShopName = "Bazar del Arrecife",
		Hotel = { Name = "Hotel Palmeras Coral", Price = 140, Energy = 60, Mood = 18 } },
	{ Id = "neo", Name = "Neo Ciudad 2099", Cost = 1600, Req = { Level = 6 }, Center = { 3600, 900 }, Ground = { 40, 40, 60 }, Material = "Glass",
		Noise = 5, Busy = 7, Theme = "neo",
		Desc = "Una ciudad futurista ficticia llena de pantallas y robots.",
		Spots = { { "Avenida de hologramas", 0, 0, { "tech", "urban", "night", "travel" }, 16 }, { "Torre de datos", 80, -60, { "tech", "business", "travel" }, 15 }, { "Mercado robótico", -70, 60, { "shop", "tech", "travel" }, 14 } },
		Shop = { "x_holo", "x_drone_neo", "x_visor" }, ShopName = "Neo Store 2099",
		Hotel = { Name = "Cápsulas Hotel Órbita", Price = 220, Energy = 65, Mood = 15 } },
	{ Id = "ski", Name = "Estación de Esquí Cumbre Blanca", Cost = 1200, Req = { Level = 5 }, Center = { 3600, -900 }, Ground = { 245, 248, 255 }, Material = "Snow",
		Noise = 2, Busy = 4, Theme = "ski",
		Desc = "Nieve, cabañas y pistas con vistas espectaculares.",
		Spots = { { "Pista principal", 0, 40, { "mountain", "nature", "travel", "challenge" }, 16 }, { "Refugio de montaña", -70, -50, { "mountain", "food", "travel" }, 13 }, { "Telesilla", 80, -60, { "mountain", "tourism", "travel" }, 15 } },
		Shop = { "x_jacket", "x_cam_snow" }, ShopName = "Tienda Alpina Cumbre",
		Hotel = { Name = "Chalet Cumbre Blanca", Price = 180, Energy = 70, Mood = 20 } },
	{ Id = "expo", Name = "Feria Tecnológica Internacional", Cost = 2500, Req = { Level = 8, Rank = 5 }, Center = { 4500, 0 }, Ground = { 210, 215, 225 }, Material = "Marble",
		Noise = 6, Busy = 8, Theme = "expo",
		Desc = "Solo con invitación (rango Especialista o superior, o un patrocinio activo). Lanzamientos y prototipos.",
		Spots = { { "Pabellón principal", 0, 0, { "tech", "event", "business", "travel" }, 17 }, { "Zona de prototipos", 70, 60, { "tech", "event", "travel" }, 16 } },
		Shop = { "x_proto_phone", "x_proto_cam" }, ShopName = "Stand de prototipos",
		Hotel = { Name = "Hotel Congresos Nexo", Price = 260, Energy = 60, Mood = 12 } },
	{ Id = "valley", Name = "Parque Nacional Valle Esmeralda", Cost = 700, Req = { Level = 2 }, Center = { 4500, 900 }, Ground = { 80, 140, 70 }, Material = "Grass",
		Noise = 1, Busy = 2, Theme = "valley",
		Desc = "Cascadas, un lago cristalino y senderos entre secuoyas gigantes. Ideal para naturaleza y aventura.",
		Spots = { { "Cascada esmeralda", -60, -60, { "nature", "water", "mountain", "travel" }, 16 }, { "Lago del valle", 80, -20, { "nature", "water", "tourism", "travel" }, 14 }, { "Sendero de las secuoyas", 0, 40, { "nature", "rural", "travel" }, 13 } },
		Shop = { "x_binoculars", "x_mic_field" }, ShopName = "Centro de visitantes",
		Hotel = { Name = "Refugio del Guarda", Price = 90, Energy = 55, Mood = 22 } },
	{ Id = "fest", Name = "Festival de Creadores Aurora", Cost = 1800, Req = { Level = 6, Rank = 4 }, Center = { 4500, -900 }, Ground = { 70, 70, 80 }, Material = "Concrete",
		Noise = 7, Busy = 9, Theme = "fest",
		Desc = "El mayor encuentro de creadores ficticio: escenarios, firmas y food trucks. Acreditación: rango Creador constante o un patrocinio activo.",
		Spots = { { "Escenario Aurora", 0, -60, { "event", "fun", "travel" }, 17 }, { "Zona de firmas", -80, 30, { "event", "urban", "travel" }, 14 }, { "Calle de food trucks", 80, 30, { "food", "fun", "travel" }, 14 } },
		Shop = { "x_light_aurora", "x_merch_aurora" }, ShopName = "Tienda oficial Aurora",
		Hotel = { Name = "Glamping Aurora", Price = 160, Energy = 50, Mood = 25 } },
}
LifeData.DestById = {}
for _, d in ipairs(LifeData.Destinations) do
	LifeData.DestById[d.Id] = d
end

-- Tamaño de cada zona de destino (mitad del lado, studs) y disposición común relativa al centro:
-- puerta de embarque (vuelta), punto de llegada, tienda exclusiva y hotel.
LifeData.DestHalf = 230
LifeData.DestLayout = { Gate = { 0, 168 }, Arrival = { 0, 138 }, Shop = { -100, 115 }, Hotel = { 100, 115 } }

-- Destino en el que está una posición (o nil si está en la ciudad)
function LifeData.destinationAt(x, z)
	for _, d in ipairs(LifeData.Destinations) do
		if math.abs(x - d.Center[1]) <= LifeData.DestHalf and math.abs(z - d.Center[2]) <= LifeData.DestHalf then
			return d
		end
	end
	return nil
end

---------------------------------------------------------------------------
-- EMPRESA
---------------------------------------------------------------------------
LifeData.Roles = {
	{ Id = "editor", Name = "Editor", Pay = 4.0, Effect = "Exportaciones más rápidas" },
	{ Id = "camera", Name = "Camarógrafo", Pay = 4.2, Effect = "Más calidad en tus escenas" },
	{ Id = "designer", Name = "Diseñador", Pay = 3.6, Effect = "Mejores miniaturas" },
	{ Id = "assistant", Name = "Asistente", Pay = 2.6, Effect = "Gastas menos energía" },
	{ Id = "manager", Name = "Gestor", Pay = 4.6, Effect = "Más y mejores patrocinios y clientes" },
	{ Id = "technician", Name = "Técnico", Pay = 3.4, Effect = "Reparaciones a mitad de precio" },
	{ Id = "photographer", Name = "Fotógrafo", Pay = 3.8, Effect = "Ingresos diarios por venta de fotos" },
}
LifeData.RoleById = {}
for _, r in ipairs(LifeData.Roles) do
	LifeData.RoleById[r.Id] = r
end
LifeData.CompanyTiers = {
	{ Name = "Productora pequeña", Contracts = 0, MaxStaff = 2 },
	{ Name = "Productora mediana", Contracts = 5, MaxStaff = 4 },
	{ Name = "Estudio de medios", Contracts = 15, MaxStaff = 6 },
	{ Name = "Gran estudio", Contracts = 40, MaxStaff = 8 },
}
LifeData.Clients = { "Panadería La Espiga", "Gimnasio Fuerza", "Hotel Brisa", "Tienda Moda Urbana", "Clínica Sonrisa", "Inmobiliaria Horizonte", "Café Central", "Academia Futuro", "Taller Rueda", "Floristería Pétalo" }

return LifeData
