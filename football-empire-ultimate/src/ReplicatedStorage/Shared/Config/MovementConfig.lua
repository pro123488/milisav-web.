-- MovementConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/MovementConfig
-- Velocidades de los personajes y resistencia del sprint (botón SPRINT / tecla Shift).

local MovementConfig = {}

MovementConfig.WALK_SPEED = 22 -- fuera del partido (Roblox trae 16)
MovementConfig.SPRINT_SPEED = 34
MovementConfig.ARENA_WALK_SPEED = 20
MovementConfig.ARENA_SPRINT_SPEED = 29

MovementConfig.STAMINA_MAX = 100
MovementConfig.STAMINA_DRAIN = 24 -- por segundo esprintando
MovementConfig.STAMINA_REGEN = 16 -- por segundo sin esprintar
MovementConfig.STAMINA_REGEN_DELAY = 0.8
MovementConfig.STAMINA_MIN_TO_START = 15


return MovementConfig
