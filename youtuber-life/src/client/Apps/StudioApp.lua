--!nonstrict
-- Apps Estudios y Ocio.
--  * Estudios (🎛): platós del Complejo de Estudios Prisma con precio, bonus, disponibilidad; alquilar (en la
--    recepción), ampliar 1 hora, entrar/salir y elegir el fondo del croma.
--  * Ocio (🎳): gimnasio, cine (cartelera e ideas de vídeo), karaoke y bolera con su minijuego.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local StudioData = require(Shared.StudioData)
local VideoData = require(Shared.VideoData)
local T = UI.Theme

local function minutesText(seconds)
	return StudioData.gameMinutes(seconds) .. " min de juego (≈" .. math.ceil(math.max(0, seconds)) .. " s)"
end

---------------------------------------------------------------------------
-- ESTUDIOS
---------------------------------------------------------------------------
local Studios = { Id = "studios", Name = "Estudios", Icon = "🎛", Order = 10, Surfaces = { pc = true, phone = true, panel = true }, Width = 800, Height = 580 }

function Studios.build(container, ctx)
	local hours = 1
	local bgIndex = 1
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local view = (data.Derived and data.Derived.Studio) or { Set = "", Left = 0, Sets = {}, Bg = StudioData.DefaultBackdrop }
		local avail = {}
		for _, s in ipairs(view.Sets or {}) do
			avail[s.Id] = s
		end
		local s = UI.scroll(container, { Pad = 6 })
		UI.title(s, "🎛 " .. StudioData.Name)
		UI.label(s, "Alquila un plató en la recepción (Distrito de estudios de grabación) por bloques de 1 hora de juego. Mientras estés dentro con el alquiler activo, el plató es tu lugar de grabación y tus escenas y fotos ganan calidad y luz.", { TextSize = 12, Color = T.Sub, Height = 44 })
		-- Alquiler actual
		local mine = StudioData.ById[view.Set or ""]
		if mine then
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = T.Panel3 })
			UI.label(card, mine.Icon .. " Tienes alquilado el " .. mine.Name .. (view.Inside and " · estás dentro" or " · estás fuera"), { Font = Enum.Font.GothamBold, TextSize = 14 })
			local left = math.max(0, (view.Ends or 0) - workspace:GetServerTimeNow())
			if left <= 0 then
				left = view.Left or 0
			end
			UI.label(card, "⏱ Quedan " .. minutesText(left) .. " · bonus: +" .. mine.Scene .. " calidad de escena, +" .. mine.Light .. " luz, +" .. mine.Photo .. " fotos", { TextSize = 12, Color = left <= StudioData.WarnSeconds and T.Warn or T.Text })
			UI.progress(card, left / (StudioData.MaxHours * StudioData.HourSeconds), T.Accent2, { Height = 8 })
			local row = UI.row(card, 32)
			UI.button(row, "⏱ Ampliar 1 h ($" .. mine.Price .. ")", function()
				Net.call("Studio.Extend", {})
			end, { Width = 190, Height = 28, Color = T.Ok, TextSize = 12 })
			if view.Inside then
				UI.button(row, "🚪 Salir a la recepción", function()
					Net.call("Studio.Leave", {})
				end, { Width = 190, Height = 28, Color = T.Panel2, TextSize = 12 })
			else
				UI.button(row, "🎬 Entrar al plató", function()
					Net.call("Studio.Enter", {})
				end, { Width = 170, Height = 28, Color = T.Accent2, TextSize = 12 })
			end
			if mine.Chroma then
				local cats, names = VideoData.Categories, {}
				for i, c in ipairs(cats) do
					names[i] = c.Name
					if c.Id == view.Bg and bgIndex == 1 then
						bgIndex = i
					end
				end
				local current = VideoData.CategoryById[view.Bg or ""]
				UI.label(card, "🟩 Fondo actual: " .. (current and current.Name or "—") .. " (tus escenas aquí usan las etiquetas de esa categoría)", { TextSize = 12, Color = T.Ok })
				UI.cycle(card, "Fondo del croma", names, bgIndex, function(i)
					bgIndex = i
				end, { LabelWidth = 120, ValueWidth = 200 })
				UI.button(card, "Aplicar fondo", function()
					Net.call("Studio.SetBackdrop", { category = cats[bgIndex].Id })
				end, { Width = 150, Height = 28, Color = T.Accent2, TextSize = 12 })
			end
		else
			UI.label(s, view.AtDesk and "✅ Estás en la recepción: elige plató y horas." or "📍 Ve a la recepción para alquilar (taxi al final de la lista).", { TextSize = 13, Color = view.AtDesk and T.Ok or T.Sub })
			UI.stepper(s, "Horas de alquiler", hours, 1, StudioData.MaxHours, 1, function(v)
				hours = v
				render()
			end)
		end
		-- Platós
		for _, set in ipairs(StudioData.Sets) do
			local a = avail[set.Id]
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, set.Icon .. " " .. set.Name .. " · $" .. set.Price .. "/hora · nivel " .. set.Level, { Font = Enum.Font.GothamBold, TextSize = 14 })
			UI.label(card, set.Desc, { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
			local tags = set.Chroma and "las de la categoría que elijas" or table.concat(set.Tags, ", ")
			UI.label(card, "Bonus dentro: +" .. set.Scene .. " calidad de escena · +" .. set.Light .. " luz · +" .. set.Photo .. " fotos · interés " .. set.Interest .. " · etiquetas: " .. tags, { TextSize = 12, Color = T.Accent2, Height = 0, Auto = Enum.AutomaticSize.Y })
			local status, color
			if mine and mine.Id == set.Id then
				status, color = "⭐ Es tuyo ahora mismo", T.Gold
			elseif a and not a.Free then
				status, color = "🔴 Ocupado · libre en " .. minutesText(a.FreeIn or 0), T.Err
			else
				status, color = "🟢 Libre", T.Ok
			end
			local row = UI.row(card, 30)
			UI.label(row, status, { Size = UDim2.new(1, -200, 1, 0), TextSize = 12, Color = color })
			if not mine then
				UI.button(row, "Alquilar " .. hours .. " h ($" .. StudioData.price(set, hours) .. ")", function()
					Net.call("Studio.Rent", { set = set.Id, hours = hours })
				end, { Width = 190, Height = 26, TextSize = 12, Color = (a and not a.Free) and T.Panel3 or T.Ok })
			end
		end
		UI.label(s, "⌛ Te avisamos 5 minutos de juego antes de que termine. Al acabar, vuelves a la recepción. 1 hora de juego = " .. math.floor(StudioData.HourSeconds) .. " s reales.", { TextSize = 11, Color = T.Sub, Height = 30 })
		if not view.Inside then
			UI.button(s, "🚕 Taxi al Distrito de estudios", function()
				Net.call("Travel.Taxi", { district = "studios" })
			end, { Width = 240, Height = 28, TextSize = 12 })
		end
	end
	render()
	ctx.onState(render)
end

---------------------------------------------------------------------------
-- OCIO
---------------------------------------------------------------------------
local LeisureApp = { Id = "leisure", Name = "Ocio", Icon = "🎳", Order = 10, Surfaces = { pc = true, phone = true, panel = true }, Width = 800, Height = 580 }

local placeNames = { gym = StudioData.Gym.Name, cinema = "Cines Lumière", karaoke = StudioData.Karaoke.Name, bowling = StudioData.Bowling.Name }

function LeisureApp.build(container, ctx)
	local aim, power = 3, 3
	local lastBowl = nil
	local function render()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		local view = (data.Derived and data.Derived.Leisure) or {}
		local n = data.Needs or { Energy = 100, Mood = 70 }
		local s = UI.scroll(container, { Pad = 6 })
		UI.label(s, "⚡ Energía " .. math.floor(n.Energy) .. "/100 · 😊 Ánimo " .. math.floor(n.Mood) .. "/100 · 💪 Forma física " .. math.floor(data.Fitness or 0) .. "/100 · 💰 $" .. data.Money, { Font = Enum.Font.GothamBold, TextSize = 13 })
		UI.label(s, view.At and ("📍 Estás en " .. placeNames[view.At]) or "📍 Ve a un lugar de ocio para usarlo (o pide un taxi).", { TextSize = 12, Color = view.At and T.Ok or T.Sub })

		-- Gimnasio
		local gym = StudioData.Gym
		local g = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(g, "🏋 " .. gym.Name .. " · Barrio residencial", { Font = Enum.Font.GothamBold, TextSize = 14 })
		UI.label(g, "Sesión $" .. gym.Price .. ": energía -" .. gym.Energy .. ", ánimo +" .. gym.Mood .. ", forma física +" .. StudioData.fitnessGain(data.Fitness) .. ". La forma física da +" .. StudioData.fitnessInterest(data.Fitness) .. " de interés (hasta +3) en vídeos de deporte y fitness.", { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.progress(g, (data.Fitness or 0) / 100, T.Ok, { Height = 8 })
		UI.button(g, "🏋 Entrenar", function()
			Net.call("Leisure.Workout", {})
		end, { Width = 130, Height = 26, Color = T.Ok, TextSize = 12 })

		-- Cine
		local c = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(c, "🎬 Cines Lumière · Distrito de entretenimiento", { Font = Enum.Font.GothamBold, TextSize = 14 })
		local wait = view.CinemaIn or 0
		UI.label(c, "Ver una película dura " .. StudioData.Cinema.Hours .. " h de juego: ánimo +" .. StudioData.Cinema.Mood .. " y una idea de vídeo." .. (wait > 0 and (" Próxima sesión en " .. minutesText(wait) .. ".") or ""), { TextSize = 12, Color = wait > 0 and T.Warn or T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		for _, mv in ipairs(StudioData.Movies) do
			local row = UI.row(c, 30)
			UI.label(row, "🎞 " .. mv.Name .. " (" .. mv.Genre .. ")", { Size = UDim2.new(1, -120, 1, 0), TextSize = 12 })
			UI.button(row, "Ver $" .. mv.Price, function()
				Net.call("Leisure.Movie", { movie = mv.Id })
			end, { Width = 100, Height = 26, Color = T.Accent2, TextSize = 12 })
		end
		local idea = data.Leisure and data.Leisure.Idea
		if idea and idea.Title ~= "" then
			local cat = VideoData.CategoryById[idea.Category]
			local row = UI.row(c, 30)
			UI.label(row, "💡 Idea: «" .. idea.Title .. "» (" .. (cat and cat.Name or idea.Category) .. ")", { Size = UDim2.new(1, -170, 1, 0), TextSize = 12, Color = T.Gold })
			UI.button(row, "Crear proyecto", function()
				Net.call("Video.CreateProject", { category = idea.Category, name = idea.Title })
			end, { Width = 150, Height = 26, Color = T.Ok, TextSize = 12 })
		end

		-- Karaoke
		local k = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		local kar = StudioData.Karaoke
		UI.label(k, "🎤 " .. kar.Name .. " · Distrito de restaurantes", { Font = Enum.Font.GothamBold, TextSize = 14 })
		local micText = view.HasMic and (view.Recording and "🎙 Llevas micrófono y estás grabando: tu actuación será una escena especial de música (+" .. kar.SceneBonus .. " calidad)." or "🎙 Llevas micrófono: si grabas un proyecto, tu actuación será una escena especial de música.") or "Lleva un micrófono en la mochila para convertir tu actuación en una escena especial de música."
		UI.label(k, "Canción $" .. kar.Price .. ": ánimo +" .. kar.Mood .. (view.HasMic and (" (+" .. kar.MicMood .. " con micrófono)") or "") .. ". " .. micText, { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.button(k, "🎤 Cantar", function()
			Net.call("Leisure.Karaoke", {})
		end, { Width = 130, Height = 26, Color = T.Accent, TextSize = 12 })

		-- Bolera
		local bw = StudioData.Bowling
		local b = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(b, "🎳 " .. bw.Name .. " · Distrito de entretenimiento", { Font = Enum.Font.GothamBold, TextSize = 14 })
		local lane = view.Lane or StudioData.lane(1)
		local prizes = {}
		for _, p in ipairs(bw.Prizes) do
			prizes[#prizes + 1] = p[1] .. "+ → $" .. p[2]
		end
		UI.label(b, "Partida $" .. bw.Price .. " · quedan " .. (view.BowlLeft or bw.DailyLimit) .. "/" .. bw.DailyLimit .. " hoy · récord " .. ((data.Leisure and data.Leisure.BowlBest) or 0) .. " · premios: " .. table.concat(prizes, ", "), { TextSize = 12, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(b, "🛣 Estado de la pista hoy: " .. lane.Hint .. ". Elige bien el efecto y la potencia.", { TextSize = 12, Color = T.Accent2, Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.cycle(b, "Efecto", StudioData.AimNames, aim, function(i)
			aim = i
		end)
		UI.cycle(b, "Potencia", StudioData.PowerNames, power, function(i)
			power = i
		end)
		UI.button(b, "🎳 Lanzar", function()
			local r = Net.call("Leisure.Bowl", { aim = aim, power = power })
			if r and r.ok and r.data then
				lastBowl = r.data
				render()
			end
		end, { Width = 130, Height = 26, Color = T.Accent, TextSize = 12 })
		if lastBowl and lastBowl.frames then
			UI.label(b, "Última partida: " .. table.concat(lastBowl.frames, " | ") .. " = " .. tostring(lastBowl.score) .. " puntos" .. ((lastBowl.prize or 0) > 0 and (" · premio $" .. lastBowl.prize) or ""), { TextSize = 12, Color = T.Gold, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		-- Taxis a los lugares de ocio
		local tr = UI.row(s, 32)
		for _, t in ipairs({ { "🚕 Gimnasio", "residential" }, { "🚕 Cine y bolera", "entertainment" }, { "🚕 Karaoke", "restaurants" } }) do
			UI.button(tr, t[1], function()
				Net.call("Travel.Taxi", { district = t[2] })
			end, { Width = 150, Height = 28, TextSize = 12 })
		end
	end
	render()
	ctx.onState(render)
end

return { Studios, LeisureApp }
