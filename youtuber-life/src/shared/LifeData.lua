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
LifeData.UpgradeOrder = { "engine", "handling", "trunk" }
LifeData.FuelNames = { gas = "Gasolina", battery = "Batería eléctrica", none = "Sin combustible" }
LifeData.PaintCost = 200
LifeData.MaxVehicles = 6
LifeData.KmhPerStud = 1.6 -- km/h ficticios que se muestran por cada stud/s

-- Fórmulas compartidas (el servidor cobra con ellas; el cliente solo las muestra)
function LifeData.vehicleStats(rec)
	local def = LifeData.VehicleById[rec.Model]
	local up = rec.Upgrades or {}
	local speed = def.Speed * (up.engine and 1.15 or 1)
	if (rec.Cond or 100) < 40 then
		speed = speed * 0.8
	end
	if def.Fuel ~= "none" and (rec.Fuel or 0) <= 0 then
		speed = 8 -- sin combustible: muy despacio, pero nunca atrapado
	end
	return { Speed = speed, Turn = def.Turn * (up.handling and 1.2 or 1), Trunk = def.Trunk + (up.trunk and 3 or 0) }
end
function LifeData.rentPrice(def)
	return math.max(20, math.floor(def.Price * 0.02))
end
function LifeData.fuelCost(def, rec)
	return math.ceil((100 - rec.Fuel) * (def.Fuel == "battery" and 0.15 or 0.4))
end
function LifeData.repairCost(def, rec)
	return math.ceil(def.Price * 0.002 * (100 - rec.Cond))
end
function LifeData.upgradeCost(def, key)
	return math.floor(def.Price * LifeData.VehicleUpgrades[key].Rate)
end
function LifeData.sellValue(rec)
	return math.floor(((rec.Paid or 0) * 0.6 + (rec.Extra or 0) * 0.3) * (rec.Cond or 100) / 100)
end

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
-- Requisitos para fundar la empresa (basta con cumplir UNO)
LifeData.CompanyReq = { Level = 10, Subs = 5000 }
-- Una propiedad de este tipo (en propiedad o alquilada) da +2 puestos de trabajo
LifeData.CompanyOfficeKinds = { business = true, studio = true }
LifeData.CompanyOfficeBonus = 2
LifeData.CandidatesPerDay = 6
LifeData.ClientOffersPerDay = 3
LifeData.MaxClientContracts = 3
LifeData.PayPeriodDays = 7

-- Logotipo ficticio: emoji + color
LifeData.CompanyEmojis = { "🎬", "🎥", "📹", "⭐", "🚀", "🔥", "💡", "🎨", "🦊", "🦁", "🐺", "🌊", "⚡", "🎧", "🏆", "🌈" }
LifeData.CompanyColors = {
	{ "Rojo", { 220, 50, 60 } }, { "Azul", { 40, 110, 230 } }, { "Verde", { 40, 170, 100 } }, { "Morado", { 140, 70, 210 } },
	{ "Naranja", { 250, 130, 30 } }, { "Turquesa", { 20, 180, 190 } }, { "Rosa", { 235, 90, 160 } }, { "Grafito", { 60, 64, 76 } },
	{ "Dorado", { 210, 170, 40 } }, { "Blanco", { 235, 235, 240 } },
}

-- Clientes ficticios: sector y categorías de vídeo que suelen encargar
LifeData.Clients = {
	{ Name = "Panadería La Espiga", Icon = "🥖", Field = "Alimentación", Cats = { "food", "cooking", "vlog" } },
	{ Name = "Gimnasio Fuerza", Icon = "💪", Field = "Deporte", Cats = { "challenge", "tutorial", "vlog" } },
	{ Name = "Hotel Brisa", Icon = "🏨", Field = "Turismo", Cats = { "tourism", "places", "travel", "luxury" } },
	{ Name = "Tienda Moda Urbana", Icon = "👗", Field = "Moda", Cats = { "fashion", "shopping" } },
	{ Name = "Clínica Sonrisa", Icon = "🦷", Field = "Salud", Cats = { "education", "interview" } },
	{ Name = "Inmobiliaria Horizonte", Icon = "🏢", Field = "Inmobiliaria", Cats = { "decor", "luxury", "places", "business" } },
	{ Name = "Café Central", Icon = "☕", Field = "Hostelería", Cats = { "food", "vlog", "places" } },
	{ Name = "Academia Futuro", Icon = "🎓", Field = "Educación", Cats = { "education", "tutorial", "experiment" } },
	{ Name = "Taller Rueda", Icon = "🔧", Field = "Automoción", Cats = { "cars", "tutorial" } },
	{ Name = "Floristería Pétalo", Icon = "💐", Field = "Comercio", Cats = { "decor", "nature", "shopping" } },
	{ Name = "Electrónica Voltio", Icon = "🔌", Field = "Tecnología", Cats = { "tech", "review", "unboxing" } },
	{ Name = "Agencia de Viajes Rumbo", Icon = "✈", Field = "Viajes", Cats = { "travel", "tourism", "adventure" } },
}

-- Nombres ficticios de candidatos
LifeData.FirstNames = { "Ana", "Bruno", "Carla", "Diego", "Elena", "Fabio", "Gala", "Hugo", "Irene", "Joel", "Lara", "Marco", "Nora", "Óscar", "Paula", "Raúl", "Sara", "Teo", "Vera", "Leo" }
LifeData.LastNames = { "Almeida", "Barrios", "Cano", "Duarte", "Esteve", "Ferrer", "Galán", "Herrero", "Iglesias", "Jurado", "Lozano", "Molina", "Navas", "Ortega", "Prieto", "Quintana", "Robles", "Soler", "Toledo", "Varela" }

-- Salario semanal de un empleado
function LifeData.salaryFor(skill, roleId)
	local role = LifeData.RoleById[roleId]
	return math.floor((80 + skill * 4) * (role and role.Pay or 3) + 0.5)
end

-- Nivel de la empresa según los contratos cumplidos
function LifeData.companyTier(contracts)
	local idx = 1
	for i, t in ipairs(LifeData.CompanyTiers) do
		if (contracts or 0) >= t.Contracts then
			idx = i
		end
	end
	return idx, LifeData.CompanyTiers[idx], LifeData.CompanyTiers[idx + 1]
end

-- ¿Tiene una propiedad tipo negocio o estudio (comprada o alquilada)? properties = data.Properties, byId = PropertyData.ById
function LifeData.hasOffice(properties, byId)
	for id in pairs(properties or {}) do
		local l = byId and byId[id]
		if l and LifeData.CompanyOfficeKinds[l.Kind] then
			return true
		end
	end
	return false
end

function LifeData.companyMaxStaff(company, properties, byId)
	local _, tier = LifeData.companyTier(company and company.Contracts or 0)
	return tier.MaxStaff + (LifeData.hasOffice(properties, byId) and LifeData.CompanyOfficeBonus or 0)
end

-- Efectos reales del personal. Editor, camarógrafo y diseñador escalan con habilidad y moral (hasta el máximo);
-- asistente, gestor y técnico funcionan si su moral es al menos 25; el fotógrafo vende fotos cada día.
function LifeData.companyEffects(company)
	local fx = { exportMult = 1, sceneBonus = 0, thumbBonus = 0, energyMult = 1, sponsorExtra = 0, sponsorMult = 1, clientExtra = 0, repairMult = 1, photoIncome = 0 }
	if type(company) ~= "table" or not company.Staff then
		return fx
	end
	local strength, active = {}, {}
	for _, e in pairs(company.Staff) do
		local morale = e.Morale or 70
		strength[e.Role] = (strength[e.Role] or 0) + (e.Skill / 95) * (0.5 + morale / 200)
		if morale >= 25 then
			active[e.Role] = true
		end
		if e.Role == "photographer" then
			fx.photoIncome = fx.photoIncome + math.floor(e.Skill * 2 * (morale >= 25 and 1 or 0.5))
		end
	end
	local function s(role)
		return math.min(1, strength[role] or 0)
	end
	fx.exportMult = 1 - 0.25 * s("editor")
	fx.sceneBonus = math.floor(4 * s("camera") * 10 + 0.5) / 10
	fx.thumbBonus = math.floor(5 * s("designer") * 10 + 0.5) / 10
	if active.assistant then
		fx.energyMult = 0.75
	end
	if active.manager then
		fx.sponsorExtra, fx.sponsorMult, fx.clientExtra = 1, 1.1, 1
	end
	if active.technician then
		fx.repairMult = 0.5
	end
	return fx
end

-- Texto del efecto de un empleado concreto (para la interfaz)
function LifeData.employeeEffect(e)
	local one = { Staff = { x = e } }
	local fx = LifeData.companyEffects(one)
	if e.Role == "editor" then
		return "Exportación −" .. math.floor((1 - fx.exportMult) * 100 + 0.5) .. "%"
	elseif e.Role == "camera" then
		return "+" .. fx.sceneBonus .. " de calidad por escena"
	elseif e.Role == "designer" then
		return "+" .. fx.thumbBonus .. " en miniaturas"
	elseif e.Role == "assistant" then
		return fx.energyMult < 1 and "Gastas un 25% menos de energía" or "Sin efecto (moral muy baja)"
	elseif e.Role == "manager" then
		return fx.sponsorExtra > 0 and "+1 oferta de patrocinio y de cliente, +10% de pago" or "Sin efecto (moral muy baja)"
	elseif e.Role == "technician" then
		return fx.repairMult < 1 and "Reparaciones a mitad de precio" or "Sin efecto (moral muy baja)"
	elseif e.Role == "photographer" then
		return "Venta de fotos: +$" .. fx.photoIncome .. "/día para la empresa"
	end
	return ""
end

return LifeData
