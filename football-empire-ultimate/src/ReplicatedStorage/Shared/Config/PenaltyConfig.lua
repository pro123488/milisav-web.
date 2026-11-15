-- PenaltyConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/PenaltyConfig
--
-- TANDA DE PENALTIS de la plaza: 5 tiros contra un portero bot. Se chuta igual que en los
-- partidos (mantener clic o el botón CHUTAR y soltar; el balón va hacia donde mira la cámara).

local PenaltyConfig = {}

PenaltyConfig.ORIGIN = CFrame.new(150, 0, 0) -- centro de la portería (la línea de gol mira hacia -X)
PenaltyConfig.SPOT_DISTANCE = 22 -- punto de penalti
PenaltyConfig.GOAL_WIDTH = 16
PenaltyConfig.GOAL_HEIGHT = 8
PenaltyConfig.SHOTS = 5
PenaltyConfig.SHOT_TIMEOUT = 15 -- segundos para chutar antes de que cuente como fallo
PenaltyConfig.KICK_RANGE = 8

-- Portero
PenaltyConfig.KEEPER_SPEED = 26 -- studs por segundo al lanzarse
PenaltyConfig.KEEPER_REACTION = 0.22 -- segundos que tarda en reaccionar
PenaltyConfig.KEEPER_WRONG_SIDE = 0.25 -- probabilidad de tirarse al lado equivocado

-- Recompensas (con espera para que no se pueda granjear)
PenaltyConfig.REWARD_PER_GOAL = 600
PenaltyConfig.REWARD_PERFECT = 3000 -- 5 de 5
PenaltyConfig.XP_PER_SESSION = 10 -- puntos del pase por terminar una tanda
PenaltyConfig.REWARD_COOLDOWN = 600 -- segundos entre tandas con premio

return PenaltyConfig
