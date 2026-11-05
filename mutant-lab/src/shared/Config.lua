--!nonstrict
-- Config: equilibrio del juego. Todo en un solo sitio para poder ajustarlo sin tocar la lógica.

local Config = {}

Config.GameName = "Laboratorio Mutante"
Config.Version = "1.0.0"
Config.DataStoreName = "LabMutante_Datos_v1"

-- Economía
Config.StartingCredits = 60
Config.SellRate = 0.5 -- al vender recibes la mitad del valor
Config.DiscoverReward = 0.25 -- recompensa única al descubrir una especie (fracción de su precio)

-- Cinta de cápsulas (centro del mapa, a lo largo del eje X)
Config.BeltStartX = -235
Config.BeltEndX = 235
Config.BeltZ = 0
Config.BeltY = 3.2
Config.BeltSpeed = 7 -- studs por segundo
Config.CapsuleInterval = 2.2 -- segundos entre cápsulas
Config.MaxCapsules = 70
Config.BuyRadius = 16

-- Asaltos
Config.StealRadius = 11 -- distancia máxima al pedestal para robar
Config.GrabHoldSeconds = 1.6 -- hay que mantener pulsado
Config.RecaptureRadius = 12
Config.NormalWalkSpeed = 16
Config.CarryWalkSpeed = 10
Config.DeliverRadius = 11 -- radio de la zona de llegada de tu laboratorio
Config.LaserCooldown = 25
Config.TrapRadius = 4
Config.TrapRearm = 12
Config.TrapSlowSeconds = 5
Config.TrapWalkSpeed = 6
Config.DroneCooldown = 30
Config.AlarmCooldown = 20

-- Fusión y niveles
Config.MaxLevel = 5
Config.LevelIncomeMult = 2.2 -- cada nivel multiplica la producción
Config.LevelValueMult = 1.9
Config.FusionBaseSeconds = 25

-- Tiempo
Config.IncomeTick = 1
Config.EventEvery = 240 -- cada cuánto empieza un evento
Config.EventDuration = 120
Config.AutosaveInterval = 90
Config.RequestsPerSecond = 12
Config.SessionLockTimeout = 600
Config.LoadRetries = 4

return Config
