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
-- MASCOTAS (PetService + app Mascotas). Food = coste de una comida. Icon = emoji de la especie.
---------------------------------------------------------------------------
LifeData.Pets = {
	{ Id = "dog", Name = "Perro", Price = 300, Follows = true, Size = 1.0, Food = 8, Icon = "🐶" },
	{ Id = "cat", Name = "Gato", Price = 250, Follows = true, Size = 0.8, Food = 7, Icon = "🐱" },
	{ Id = "bird", Name = "Pájaro", Price = 150, Follows = true, Size = 0.5, Flies = true, Food = 4, Icon = "🐦" },
	{ Id = "rabbit", Name = "Conejo", Price = 180, Follows = true, Size = 0.6, Food = 5, Icon = "🐰" },
	{ Id = "turtle", Name = "Tortuga", Price = 120, Follows = true, Size = 0.6, Food = 4, Icon = "🐢" },
	{ Id = "fish", Name = "Peces (acuario)", Price = 200, Follows = false, Size = 1.0, Food = 3, Icon = "🐠" },
}
LifeData.PetById = {}
for _, p in ipairs(LifeData.Pets) do
	LifeData.PetById[p.Id] = p
end
LifeData.PetColors = { { 140, 100, 60 }, { 240, 240, 240 }, { 30, 30, 30 }, { 230, 160, 60 }, { 120, 120, 130 }, { 255, 200, 200 }, { 80, 170, 230 }, { 90, 200, 120 } }
LifeData.PetColorNames = { "Marrón", "Blanco", "Negro", "Naranja", "Gris", "Rosa", "Azul", "Verde" }
LifeData.PetAccessories = { "Ninguno", "Collar rojo", "Pajarita", "Gorrito", "Pañuelo", "Gafas de sol" }
-- Precio de cada accesorio (se compra una vez en la tienda y sirve para todas tus mascotas)
LifeData.PetAccessoryPrices = { ["Ninguno"] = 0, ["Collar rojo"] = 40, ["Pajarita"] = 35, ["Gorrito"] = 50, ["Pañuelo"] = 30, ["Gafas de sol"] = 60 }
-- Juguetes: al jugar, el mejor juguete que tengas suma felicidad extra
LifeData.PetToys = {
	{ Id = "ball", Name = "Pelota saltarina", Price = 30, Bonus = 4 },
	{ Id = "rope", Name = "Cuerda para morder", Price = 45, Bonus = 6 },
	{ Id = "puzzle", Name = "Juguete rompecabezas", Price = 80, Bonus = 10 },
}
LifeData.PetToyById = {}
for _, t in ipairs(LifeData.PetToys) do
	LifeData.PetToyById[t.Id] = t
end
-- Nombres por defecto si no eliges uno al adoptar
LifeData.PetNames = { "Luna", "Toby", "Coco", "Nube", "Kiwi", "Simba", "Lola", "Bolita", "Chispa", "Pipo", "Canela", "Tito" }
-- Cuidados: la felicidad (0-100) baja muy despacio y solo cambia el aspecto (triste), nunca tu progreso.
LifeData.PetCare = {
	MaxPets = 3,
	StartHappy = 80,
	SadBelow = 30,
	HappyAbove = 80,
	DecayPerMinute = 0.1, -- mientras juegas (6 puntos por hora); una cama o rascador colocado la detiene
	PlayHappy = 12,
	PlayMood = 4, -- ánimo del jugador
	PlayCooldown = 45, -- segundos
	FeedHappy = 10,
	FeedCooldown = 90, -- segundos
	WalkHappy = 2, -- por cada 100 m paseados
	WalkMaxStep = 30, -- studs por segundo como máximo para contar como paseo (no en vehículo ni en taxi)
	SnapDistance = 45, -- si la mascota se queda más lejos, aparece a tu lado
	NearRadius = 30,
	PhotoBonus = 8, -- calidad extra de la foto en modo mascota
	SceneInterest = 3, -- interés extra de las escenas con tu mascota cerca
	NameMax = 20,
	BedItems = { "dec_pet_bed", "dec_pet_tower" },
}

---------------------------------------------------------------------------
-- DESTINOS DE VIAJE (zonas lejos de la ciudad, se llega en avión desde el aeropuerto)
---------------------------------------------------------------------------
LifeData.Destinations = {
	{ Id = "island", Name = "Isla Tropical Coral", Cost = 900, Req = { Level = 3 }, Center = { 3600, 0 }, Ground = { 230, 210, 160 }, Material = "Sand",
		Desc = "Playas de arena blanca, arrecife y un pueblo pesquero.",
		Spots = { { "Playa de coral", 0, 60, { "beach", "water", "tourism", "travel" }, 16 }, { "Muelle del pueblo", -80, -40, { "travel", "food", "tourism" }, 14 }, { "Mirador de la palmera", 90, -70, { "nature", "tourism", "travel" }, 15 } },
		Shop = { "x_cam_dive", "x_hat_straw", "x_shell" } },
	{ Id = "neo", Name = "Neo Ciudad 2099", Cost = 1600, Req = { Level = 6 }, Center = { 3600, 900 }, Ground = { 40, 40, 60 }, Material = "Neon",
		Desc = "Una ciudad futurista ficticia llena de pantallas y robots.",
		Spots = { { "Avenida de hologramas", 0, 0, { "tech", "urban", "night", "travel" }, 16 }, { "Torre de datos", 80, -60, { "tech", "business", "travel" }, 15 }, { "Mercado robótico", -70, 60, { "shop", "tech", "travel" }, 14 } },
		Shop = { "x_holo", "x_drone_neo", "x_visor" } },
	{ Id = "ski", Name = "Estación de Esquí Cumbre Blanca", Cost = 1200, Req = { Level = 5 }, Center = { 3600, -900 }, Ground = { 245, 248, 255 }, Material = "Snow",
		Desc = "Nieve, cabañas y pistas con vistas espectaculares.",
		Spots = { { "Pista principal", 0, 40, { "mountain", "nature", "travel", "challenge" }, 16 }, { "Refugio de montaña", -70, -50, { "mountain", "food", "travel" }, 13 }, { "Telesilla", 80, -60, { "mountain", "tourism", "travel" }, 15 } },
		Shop = { "x_jacket", "x_cam_snow" } },
	{ Id = "expo", Name = "Feria Tecnológica Internacional", Cost = 2500, Req = { Level = 8, Rank = 5 }, Center = { 4500, 0 }, Ground = { 210, 215, 225 }, Material = "Marble",
		Desc = "Solo con invitación (rango Especialista o superior). Lanzamientos y prototipos.",
		Spots = { { "Pabellón principal", 0, 0, { "tech", "event", "business", "travel" }, 17 }, { "Zona de prototipos", 70, 60, { "tech", "event", "travel" }, 16 } },
		Shop = { "x_proto_phone", "x_proto_cam" } },
}
LifeData.DestById = {}
for _, d in ipairs(LifeData.Destinations) do
	LifeData.DestById[d.Id] = d
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
