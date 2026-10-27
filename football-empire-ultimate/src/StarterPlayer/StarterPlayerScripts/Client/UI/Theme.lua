-- Theme (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/Theme
-- Paleta y tipografía de la interfaz: estilo futbolístico moderno (noche de estadio).

local Theme = {
	Background = Color3.fromRGB(10, 16, 28),
	Panel = Color3.fromRGB(16, 25, 42),
	Card = Color3.fromRGB(24, 36, 58),
	CardAlt = Color3.fromRGB(31, 46, 72),
	Stroke = Color3.fromRGB(52, 72, 105),
	Text = Color3.fromRGB(240, 244, 250),
	TextDim = Color3.fromRGB(160, 175, 200),
	TextMuted = Color3.fromRGB(110, 125, 150),
	Accent = Color3.fromRGB(0, 200, 120), -- verde césped
	AccentDark = Color3.fromRGB(0, 140, 85),
	Gold = Color3.fromRGB(255, 196, 0),
	Danger = Color3.fromRGB(235, 70, 70),
	Warning = Color3.fromRGB(255, 160, 40),
	Info = Color3.fromRGB(60, 150, 255),
	Locked = Color3.fromRGB(70, 80, 100),

	Font = Enum.Font.Gotham,
	FontBold = Enum.Font.GothamBold,
	FontBlack = Enum.Font.GothamBlack,

	Radius = UDim.new(0, 10),
	RadiusSmall = UDim.new(0, 6),
}

Theme.NotifyColors = {
	success = Theme.Accent,
	error = Theme.Danger,
	warning = Theme.Warning,
	info = Theme.Info,
}

return Theme
