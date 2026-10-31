--!nonstrict
-- TimeWeatherService: ciclo día/noche compartido y clima.
--  * 1 día de juego = Config.DayLengthSeconds segundos reales.
--  * El clima cambia cada pocas horas de juego (despejado, nublado, lluvia, niebla, tormenta moderada).
--  * Publica atributos en Workspace: GameHour, GameDay, Weather. El cliente dibuja la lluvia/relámpagos.
--  * Enciende farolas y ventanas de noche (etiqueta "NightLight").

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)

local Time = {}
local S
local startOffset = 9 -- el servidor empieza a las 9:00
local startClock = os.time()
local lastDay = nil
local nightState = nil

Time.WeatherNames = { Clear = "Despejado", Cloudy = "Nublado", Rain = "Lluvia", Fog = "Niebla", Storm = "Tormenta" }
local weatherWeights = { { "Clear", 45 }, { "Cloudy", 25 }, { "Rain", 12 }, { "Fog", 10 }, { "Storm", 8 } }
Time.Weather = "Clear"
local nextWeatherAt = 0

function Time.Init(services)
	S = services
end

local function totalHours()
	return startOffset + (os.time() - startClock) / Config.DayLengthSeconds * 24
end

function Time.hour()
	return totalHours() % 24
end

function Time.day()
	return math.floor(totalHours() / 24) + 1
end

function Time.monthIndex()
	return math.floor((Time.day() - 1) / Config.DaysPerMonth) + 1
end

function Time.isNight()
	local h = Time.hour()
	return h < 6 or h >= 19.5
end

function Time.label()
	local h = Time.hour()
	if h >= 5 and h < 7 then
		return "Amanecer"
	elseif h >= 7 and h < 11.5 then
		return "Mañana"
	elseif h >= 11.5 and h < 14 then
		return "Mediodía"
	elseif h >= 14 and h < 17.5 then
		return "Tarde"
	elseif h >= 17.5 and h < 19.5 then
		return "Atardecer"
	end
	return "Noche"
end

local function pickWeather()
	local total = 0
	for _, w in ipairs(weatherWeights) do
		total = total + w[2]
	end
	local r = math.random() * total
	for _, w in ipairs(weatherWeights) do
		r = r - w[2]
		if r <= 0 then
			return w[1]
		end
	end
	return "Clear"
end

local atmosphere
local function applyWeather(w)
	Time.Weather = w
	workspace:SetAttribute("Weather", w)
	if atmosphere then
		local density = ({ Clear = 0.25, Cloudy = 0.32, Rain = 0.4, Fog = 0.62, Storm = 0.5 })[w] or 0.3
		atmosphere.Density = density
		atmosphere.Haze = (w == "Fog") and 3 or ((w == "Clear") and 0.5 or 1.5)
	end
	local clouds = workspace.Terrain:FindFirstChildOfClass("Clouds")
	if clouds then
		clouds.Cover = ({ Clear = 0.35, Cloudy = 0.75, Rain = 0.85, Fog = 0.6, Storm = 0.95 })[w] or 0.5
		clouds.Density = (w == "Storm" or w == "Rain") and 0.9 or 0.5
	end
	Lighting.Brightness = (w == "Storm") and 1.3 or ((w == "Rain") and 1.7 or 2.4)
	for _, player in ipairs(Players:GetPlayers()) do
		S.Net.notify(player, "Clima: " .. (Time.WeatherNames[w] or w), "info")
	end
end

local function setNight(isNight)
	if nightState == isNight then
		return
	end
	nightState = isNight
	for _, part in ipairs(CollectionService:GetTagged("NightLight")) do
		local light = part:FindFirstChildWhichIsA("Light")
		if light then
			light.Enabled = isNight
		end
		if part:GetAttribute("GlowNight") then
			part.Material = isNight and Enum.Material.Neon or Enum.Material.Glass
		end
	end
end

function Time.Start()
	atmosphere = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmosphere.Parent = Lighting
	if not Lighting:FindFirstChildOfClass("Sky") then
		Instance.new("Sky").Parent = Lighting
	end
	if not workspace.Terrain:FindFirstChildOfClass("Clouds") then
		local c = Instance.new("Clouds")
		c.Parent = workspace.Terrain
	end
	Lighting.OutdoorAmbient = Color3.fromRGB(120, 120, 130)
	applyWeather("Clear")
	nextWeatherAt = os.time() + math.random(4, 8) * Config.DayLengthSeconds / 24

	task.spawn(function()
		while true do
			local h = Time.hour()
			Lighting.ClockTime = h
			workspace:SetAttribute("GameHour", h)
			workspace:SetAttribute("GameDay", Time.day())
			workspace:SetAttribute("TimeLabel", Time.label())
			setNight(Time.isNight())
			if os.time() >= nextWeatherAt then
				local w = pickWeather()
				-- Las tormentas duran poco para no molestar
				local hours = (w == "Storm") and math.random(1, 2) or math.random(3, 7)
				nextWeatherAt = os.time() + hours * Config.DayLengthSeconds / 24
				if w ~= Time.Weather then
					applyWeather(w)
				end
			end
			local day = Time.day()
			if lastDay and day ~= lastDay then
				for _, player in ipairs(Players:GetPlayers()) do
					if S.Data.get(player) then
						pcall(S.Home.onNewDay, player)
						pcall(S.Economy.onNewDay, player, day)
					end
				end
				pcall(S.Channel.onNewDay, day)
			end
			lastDay = day
			task.wait(1)
		end
	end)
end

return Time
