--!nonstrict
-- Sound (cliente): efectos de interfaz y música ambiental con control de volumen.

local SoundService = game:GetService("SoundService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundConfig = require(ReplicatedStorage.Shared.SoundConfig)

local Sound = {}
local sfxVolume = 0.7
local musicVolume = 0.5
local cache = {}
local music

function Sound.setVolumes(sfx, mus)
	sfxVolume = sfx or sfxVolume
	musicVolume = mus or musicVolume
	if music then
		music.Volume = musicVolume * 0.4
	end
end

function Sound.play(name)
	local id = SoundConfig.Sfx[name]
	if not id or sfxVolume <= 0 then
		return
	end
	local s = cache[name]
	if not s then
		s = Instance.new("Sound")
		s.SoundId = id
		s.Parent = SoundService
		cache[name] = s
	end
	s.Volume = sfxVolume * 0.6
	s.PlaybackSpeed = (name == "Error") and 0.7 or ((name == "Cash") and 1.3 or 1)
	pcall(function()
		SoundService:PlayLocalSound(s)
	end)
end

function Sound.startMusic()
	local id = SoundConfig.Music.Ambient
	if not id or id == 0 then
		return -- sin ID configurado: no se reproduce nada (evita audio sin licencia)
	end
	music = Instance.new("Sound")
	music.SoundId = "rbxassetid://" .. id
	music.Looped = true
	music.Volume = musicVolume * 0.4
	music.Parent = SoundService
	music:Play()
end

return Sound
