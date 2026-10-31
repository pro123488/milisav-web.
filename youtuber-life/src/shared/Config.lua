--!nonstrict
-- Config: valores de equilibrio del juego. Cambia aquí sin tocar la lógica.

local Config = {}

Config.Version = "0.4.0"
Config.GameName = "Youtuber Life: Real World Ultimate"

-- Guardado
Config.DataStoreName = "YTLife_PlayerData_v1"
Config.AutosaveInterval = 120 -- segundos
Config.SessionLockTimeout = 600 -- segundos tras los que un bloqueo de sesión se considera abandonado
Config.LoadRetries = 4

-- Economía (dinero virtual del juego, nunca Robux)
Config.StartingMoney = 1500
Config.MaxTransactions = 150
Config.MonthsKept = 6
Config.SellBackRate = 0.55 -- % del precio pagado al vender (multiplicado por la condición)
Config.ReturnWindowDays = 3 -- días de juego para devolver con reembolso casi completo
Config.ReturnRefundRate = 0.9
Config.IncomeTaxRate = 0.08 -- impuesto simulado sobre ingresos de vídeos y empleos

-- Tiempo del mundo
Config.DayLengthSeconds = 1200 -- 20 minutos reales = 1 día de juego
Config.DaysPerMonth = 7
Config.OnlineDeliveryHours = 3 -- horas de juego hasta entrega de pedidos online

-- Inventario
Config.BaseBackpackSlots = 6
Config.BaseProjectSlots = 6
Config.MaxPhotos = 120
Config.MaxThumbnails = 40
Config.MaxVideosKept = 150
Config.MaxVersionsPerProject = 5
Config.MaxScenesPerProject = 40

-- Grabación
Config.SceneCooldown = 2.5 -- segundos reales entre escenas
Config.PhotoCooldown = 1.0
Config.RecordSpotRadius = 45
Config.HomeRadius = 40

-- Canal
Config.StatsTickSeconds = 20
Config.ViewCurveMinutes = 8 -- minutos reales para que un vídeo alcance ~63% de sus visitas esperadas
Config.OfflineCatchUpHours = 12
Config.PartnerSubs = 100
Config.PartnerVideos = 3
Config.CreatorFundRPM = 0.6 -- $ por 1000 visitas antes de ser socio
Config.HistoryPoints = 24

-- Viviendas
Config.StarterRent = 120 -- por semana de juego (7 días)
Config.RentPeriodDays = 7
Config.LateFeeRate = 0.1

-- Seguridad
Config.RequestsPerSecond = 15
Config.MaxTextTitle = 80
Config.MaxTextDescription = 300

-- Taxi
Config.TaxiBaseFare = 8
Config.TaxiPerStud = 0.012

return Config
