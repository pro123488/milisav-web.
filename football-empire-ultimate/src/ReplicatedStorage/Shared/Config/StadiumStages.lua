-- StadiumStages (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/StadiumStages
--
-- Las siete etapas del ESTADIO EVOLUTIVO.
-- FASE 1: el club empieza y permanece en la etapa 1 (Campo básico).
-- FASE 2: se implementa el ascenso de etapa con costes, requisitos y cambios visuales.
-- Las instalaciones de FacilityConfig usan `minStage` para saber cuándo se desbloquean.

local StadiumStages = {
	{
		stage = 1,
		name = "Campo básico",
		description = "Un campo humilde con unas pocas gradas. Aquí empieza tu imperio.",
		upgradeCost = 0,
		requirements = {},
	},
	{
		stage = 2,
		name = "Estadio local",
		description = "El barrio entero viene a verte jugar.",
		upgradeCost = 60000,
		requirements = { reputation = 25, facilities = { stands = 3, pitch = 2, lighting = 1 } },
	},
	{
		stage = 3,
		name = "Estadio regional",
		description = "Tu club es conocido en toda la región.",
		upgradeCost = 180000,
		requirements = { reputation = 50, facilities = { stands = 5, shop = 3, restaurant = 3 } },
	},
	{
		stage = 4,
		name = "Estadio profesional",
		description = "Instalaciones dignas del fútbol profesional.",
		upgradeCost = 450000,
		requirements = { reputation = 90 },
	},
	{
		stage = 5,
		name = "Estadio de élite",
		description = "Uno de los mejores estadios del país.",
		upgradeCost = 1100000,
		requirements = { reputation = 140 },
	},
	{
		stage = 6,
		name = "Estadio internacional",
		description = "Sede de grandes noches europeas.",
		upgradeCost = 2600000,
		requirements = { reputation = 200 },
	},
	{
		stage = 7,
		name = "Estadio legendario",
		description = "Un templo del fútbol mundial.",
		upgradeCost = 6000000,
		requirements = { reputation = 280 },
	},
}

-- En la FASE 1 no se puede superar esta etapa (el ascenso llega en la FASE 2).
StadiumStages.MAX_STAGE_THIS_PHASE = 1

return StadiumStages
