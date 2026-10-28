-- SponsorConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/SponsorConfig
--
-- Contratos de patrocinio (FASE 3). Todas las marcas son FICTICIAS: se generan
-- combinando las listas de abajo y no representan a ninguna empresa real.

local SponsorConfig = {}

-- Huecos de patrocinio. value = peso del hueco en el valor de la oferta.
SponsorConfig.Slots = {
	{ id = "shirt", name = "Patrocinador de camiseta", icon = "👕", minStage = 1, value = 1.0 },
	{ id = "supplier", name = "Proveedor técnico", icon = "👟", minStage = 1, value = 0.7 },
	{ id = "boards", name = "Vallas publicitarias", icon = "📢", minStage = 1, value = 0.5 },
	{ id = "sleeve", name = "Manga de la camiseta", icon = "💪", minStage = 2, value = 0.4 },
	{ id = "naming", name = "Nombre del estadio", icon = "🏟️", minStage = 3, value = 2.0 },
}

SponsorConfig.BrandPrefixes = {
	"Nova", "Atlas", "Cumbre", "Solaris", "Brisa", "Titán", "Orbe", "Vértice", "Aurora", "Delta",
	"Faro", "Cénit", "Lince", "Prisma", "Rumbo", "Halcón", "Zafiro", "Ola", "Volta", "Kronos",
}
SponsorConfig.BrandSuffixes = {
	"Energía", "Seguros", "Telecom", "Bebidas", "Motor", "Banca", "Logística", "Deportes", "Tech", "Viajes",
	"Alimentación", "Hogar", "Digital", "Moda", "Aerolíneas",
}

-- Valor por jornada de una oferta = valor del hueco × (BASE + rep × PER_REP + √aficionados × PER_SQRT_FAN) × aleatorio
SponsorConfig.BASE_VALUE = 60
SponsorConfig.PER_REPUTATION = 6
SponsorConfig.PER_SQRT_FAN = 3
SponsorConfig.RANDOM_MIN = 0.8
SponsorConfig.RANDOM_MAX = 1.25

SponsorConfig.OFFERS_PER_SLOT = 3
SponsorConfig.OFFER_REFRESH_CYCLES = 15 -- jornadas entre renovaciones de ofertas
SponsorConfig.DURATION_MIN = 20 -- jornadas
SponsorConfig.DURATION_MAX = 60
SponsorConfig.SIGNING_BONUS_MIN = 3 -- jornadas de pago como prima de fichaje
SponsorConfig.SIGNING_BONUS_MAX = 8
SponsorConfig.TERMINATION_PENALTY = 5 -- jornadas de pago como penalización por rescindir
SponsorConfig.OBJECTIVE_BONUS = 0.25 -- +25 % del pago en cada jornada con el objetivo cumplido

-- Objetivos posibles (se evalúan en cada jornada con los datos reales).
SponsorConfig.Objectives = {
	{ id = "occupancy", text = "Ocupación del estadio ≥ %d%%" },
	{ id = "satisfaction", text = "Satisfacción de la afición ≥ %d" },
	{ id = "members", text = "Socios ≥ %d" },
}

function SponsorConfig.Slot(id)
	for _, slot in ipairs(SponsorConfig.Slots) do
		if slot.id == id then
			return slot
		end
	end
	return nil
end

function SponsorConfig.ObjectiveText(objective)
	for _, def in ipairs(SponsorConfig.Objectives) do
		if def.id == objective.type then
			local value = objective.type == "occupancy" and math.floor(objective.target * 100 + 0.5) or objective.target
			return string.format(def.text, value)
		end
	end
	return "—"
end

-- ¿Se cumple el objetivo con estos resultados? (función pura, la usan cliente y servidor)
function SponsorConfig.ObjectiveMet(objective, occupancy, satisfaction, members)
	if not objective then
		return false
	end
	if objective.type == "occupancy" then
		return occupancy >= objective.target
	elseif objective.type == "satisfaction" then
		return satisfaction >= objective.target
	elseif objective.type == "members" then
		return members >= objective.target
	end
	return false
end

return SponsorConfig
