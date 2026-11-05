--!nonstrict
-- LabData: niveles del laboratorio, investigación, defensas y eventos.

local LabData = {}

-- Niveles del laboratorio: huecos (pedestales), capacidad del tanque de créditos y duración del láser
LabData.Tiers = {
	{ Name = "Laboratorio de garaje", Slots = 6, Tank = 500, Laser = 40, Cost = 0 },
	{ Name = "Laboratorio universitario", Slots = 9, Tank = 4000, Laser = 55, Cost = 2500 },
	{ Name = "Instituto genético", Slots = 12, Tank = 30000, Laser = 70, Cost = 30000 },
	{ Name = "Complejo secreto", Slots = 15, Tank = 250000, Laser = 85, Cost = 400000 },
	{ Name = "Megalaboratorio orbital", Slots = 18, Tank = 3000000, Laser = 100, Cost = 5000000 },
}
LabData.MaxSlots = 18

-- Investigación: mejoras permanentes que se compran con créditos
LabData.Research = {
	{ Id = "income", Name = "Nutrientes mejorados", Desc = "+10% de producción por nivel", Max = 10, Base = 600, Growth = 2.1 },
	{ Id = "discount", Name = "Contrato con el generador", Desc = "-4% en el precio de las cápsulas por nivel", Max = 8, Base = 900, Growth = 2.3 },
	{ Id = "mutate", Name = "Reactor de mutación", Desc = "Las cápsulas sin mutación pueden mutar al comprarlas (+ probabilidad por nivel)", Max = 6, Base = 1500, Growth = 2.5 },
	{ Id = "fusion", Name = "Fusión acelerada", Desc = "-10% de tiempo de fusión por nivel", Max = 5, Base = 1200, Growth = 2.4 },
	{ Id = "sprint", Name = "Botas antigravedad", Desc = "+1 de velocidad al cargar un mutante", Max = 4, Base = 2000, Growth = 2.6 },
	{ Id = "tank", Name = "Tanque ampliado", Desc = "+25% de capacidad del tanque por nivel", Max = 6, Base = 1000, Growth = 2.4 },
}
LabData.ResearchById = {}
for _, r in ipairs(LabData.Research) do
	LabData.ResearchById[r.Id] = r
end
function LabData.researchCost(id, level)
	local r = LabData.ResearchById[id]
	return math.floor(r.Base * r.Growth ^ level)
end

-- Defensas
LabData.Defenses = {
	trap = { Name = "Trampa de baba", Desc = "Frena a los ladrones y les hace soltar lo que llevan. Máximo: una por nivel del laboratorio.", Cost = 1500 },
	alarm = { Name = "Alarma de intrusos", Desc = "Te avisa cuando alguien entra en tu laboratorio.", Cost = 600 },
	drone = { Name = "Dron guardián", Desc = "Recupera solo un mutante robado si el ladrón sigue dentro (cada 30 s). Requiere nivel 3.", Cost = 40000, Tier = 3 },
}

-- Colores de las 8 parcelas
LabData.PlotColors = {
	{ 0, 220, 255 }, { 255, 70, 160 }, { 120, 255, 80 }, { 255, 190, 40 },
	{ 170, 100, 255 }, { 255, 110, 60 }, { 60, 255, 200 }, { 255, 255, 120 },
}

-- Eventos de todo el servidor
LabData.Events = {
	{ Id = "storm", Name = "Tormenta radiactiva", Desc = "Mutaciones x3 en las cápsulas", MutMult = 3, Sky = { 80, 255, 80 } },
	{ Id = "rush", Name = "Fiebre de cápsulas", Desc = "Las cápsulas salen el doble de rápido", SpawnMult = 0.5, Sky = { 255, 200, 60 } },
	{ Id = "legend", Name = "Hora legendaria", Desc = "Mucha más suerte de rareza", Luck = 2.5, Sky = { 255, 150, 40 } },
	{ Id = "double", Name = "Doble producción", Desc = "Todos los laboratorios producen el doble", IncomeMult = 2, Sky = { 60, 200, 255 } },
}

return LabData
