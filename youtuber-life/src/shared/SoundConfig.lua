--!nonstrict
-- SoundConfig: sonidos del juego.
-- Los efectos usan sonidos incluidos con Roblox (rbxasset://). La música ambiental queda en 0
-- hasta que coloques IDs de audio que tengas permiso para usar (Creator Store, audio con licencia).

local SoundConfig = {}

SoundConfig.Sfx = {
	Click = "rbxasset://sounds/clickfast.wav",
	Open = "rbxasset://sounds/electronicpingshort.wav",
	Notify = "rbxasset://sounds/electronicpingshort.wav",
	Error = "rbxasset://sounds/clickfast.wav",
	Cash = "rbxasset://sounds/electronicpingshort.wav",
	Shutter = "rbxasset://sounds/clickfast.wav",
	Swoosh = "rbxasset://sounds/swoosh.wav",
}

-- Pon aquí IDs numéricos de audio con licencia. 0 = desactivado.
SoundConfig.Music = {
	Ambient = 0,
	Event = 0,
	Shop = 0,
}

SoundConfig.Ambience = {
	City = 0,
	Nature = 0,
	Rain = 0,
}

return SoundConfig
