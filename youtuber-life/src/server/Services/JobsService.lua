--!nonstrict
-- JobsService: encargos de trabajo para ganar dinero además del canal (adelanto de la Fase 5).
--  * Editor de vídeos freelance: ordenar los clips de un cliente en un computador.
--  * Fotógrafo: hacer una foto de un tipo concreto en un lugar concreto.
--  * Repartidor: llevar un paquete desde una tienda hasta un lugar de la ciudad.
-- Cada tipo tiene requisitos, recompensa, experiencia y ascensos (cada 10 encargos +5% de paga, máx. +50%).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Shared = ReplicatedStorage.Shared
local WorldData = require(Shared.WorldData)
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)

local Jobs = {}
local S
local cooldown = {}

Jobs.Types = {
	edit = { Name = "Editor de vídeos freelance", Req = "Usar un computador", Base = 45, Cooldown = 40 },
	photo = { Name = "Fotógrafo por encargo", Req = "Cámara o teléfono", Base = 60, Cooldown = 30 },
	delivery = { Name = "Repartidor", Req = "Empezar en una tienda", Base = 30, Cooldown = 20 },
	cashier = { Name = "Cajero / dependiente", Req = "Empezar en una tienda", Base = 40, Cooldown = 30 },
	camera = { Name = "Camarógrafo", Req = "Grabar 2 escenas de calidad en un lugar", Base = 70, Cooldown = 40 },
	thumbs = { Name = "Diseñador de miniaturas", Req = "Computador o tableta", Base = 55, Cooldown = 40 },
	tech = { Name = "Técnico informático", Req = "Saber de compatibilidad de piezas", Base = 50, Cooldown = 30 },
	reporter = { Name = "Periodista de eventos", Req = "Foto y escena en el evento del día", Base = 90, Cooldown = 60 },
}
Jobs.Keywords = { "OFERTA", "NUEVO", "TOP 5", "REVIEW", "VIAJE", "RETO", "GRATIS", "VS" }
Jobs.ClipLabels = { "Gancho", "Presentación", "Desarrollo", "Momento clave", "Conclusión", "Despedida" }

function Jobs.Init(services)
	S = services
end

local function promotion(data, jobType)
	local n = data.Counters["job_" .. jobType] or 0
	return math.min(0.5, math.floor(n / 10) * 0.05), n
end

local function pay(player, jobType, base, detail)
	local data = S.Data.get(player)
	local promo, n = promotion(data, jobType)
	local bonus = S.Monetization.perk(player, "JobBonus")
	local amount = math.floor(base * (1 + promo + bonus) + 0.5)
	data.Counters["job_" .. jobType] = n + 1
	data.Counters.jobs_done = (data.Counters.jobs_done or 0) + 1
	if S.Needs then
		S.Needs.spend(player, 3)
	end
	data.Job = {}
	cooldown[player] = cooldown[player] or {}
	cooldown[player][jobType] = os.clock()
	S.Economy.add(player, amount, "Empleos", Jobs.Types[jobType].Name .. (detail and (": " .. detail) or ""), { taxable = true })
	S.Progress.addXp(player, S.Progress.Xp.Job)
	S.Quest.check(player)
	if (n + 1) % 10 == 0 and promo < 0.5 then
		S.Net.notify(player, "📈 ¡Ascenso como " .. Jobs.Types[jobType].Name .. "! Cobrarás un 5% más.", "success")
	end
	return amount
end

function Jobs.onScene(player, scene)
	local data = S.Data.get(player)
	local job = data.Job
	if job.Type == "camera" and scene.Spot == job.Spot and scene.Q >= job.MinQ then
		job.Count = (job.Count or 0) + 1
		if job.Count >= 2 then
			local amount = pay(player, "camera", Jobs.Types.camera.Base + scene.Q * 0.8, job.SpotName)
			S.Net.notify(player, "✅ Grabación para el cliente completada: +$" .. amount, "success")
		else
			S.Net.notify(player, "🎥 Toma válida para el cliente (" .. job.Count .. "/2).", "info")
		end
	elseif job.Type == "reporter" and scene.Spot == job.Spot then
		job.Scene = true
		Jobs.checkReporter(player)
	end
end

function Jobs.checkReporter(player)
	local data = S.Data.get(player)
	local job = data.Job
	if job.Type == "reporter" and job.Scene and job.Photo then
		local amount = pay(player, "reporter", Jobs.Types.reporter.Base, job.SpotName)
		S.Net.notify(player, "📰 Reportaje entregado: +$" .. amount, "success")
	end
end

function Jobs.onThumb(player, design, score)
	local data = S.Data.get(player)
	local job = data.Job
	if job.Type == "thumbs" then
		if not (design.text or ""):upper():find(job.Keyword, 1, true) then
			S.Net.notify(player, "El cliente quería la palabra «" .. job.Keyword .. "» en la miniatura.", "warn")
		elseif score < job.MinScore then
			S.Net.notify(player, "El cliente pide al menos " .. job.MinScore .. " puntos (tu diseño: " .. math.floor(score) .. ").", "warn")
		else
			local amount = pay(player, "thumbs", Jobs.Types.thumbs.Base + score * 0.6, "«" .. job.Keyword .. "»")
			S.Net.notify(player, "✅ Miniatura aceptada por el cliente: +$" .. amount, "success")
		end
	end
end

function Jobs.onPhoto(player, photo)
	local data = S.Data.get(player)
	local job = data.Job
	if job.Type == "reporter" and photo.Spot == job.Spot and photo.Q >= 45 then
		job.Photo = true
		Jobs.checkReporter(player)
		return
	end
	if job.Type == "photo" and photo.Spot == job.Spot and photo.Mode == job.Mode then
		local amount = pay(player, "photo", Jobs.Types.photo.Base + photo.Q * 0.8, job.SpotName)
		S.Net.notify(player, "✅ Encargo de fotografía completado: +$" .. amount, "success")
	end
end

function Jobs.Start()
	local Net = S.Net

	Net.on("Job.Start", function(player, p)
		local data = S.Data.get(player)
		local def = Jobs.Types[p.type or ""]
		if not def then
			return false, "Empleo no válido."
		end
		if data.Job.Type then
			return false, "Ya tienes un encargo en curso. Termínalo o cancélalo."
		end
		local last = cooldown[player] and cooldown[player][p.type]
		if last and os.clock() - last < def.Cooldown then
			return false, "Vuelve en " .. math.ceil(def.Cooldown - (os.clock() - last)) .. " s para otro encargo de este tipo."
		end
		local rng = Random.new()
		if p.type == "edit" then
			if not S.Computer.hasSession(player) then
				return false, "Necesitas estar usando un computador."
			end
			local stats = S.Computer.sessionStats(player)
			local n = math.min(#Jobs.ClipLabels, 3 + stats.Tier)
			local order = {}
			for i = 1, n do
				order[i] = Jobs.ClipLabels[i]
			end
			local shuffled = {}
			for i = 1, n do
				shuffled[i] = order[i]
			end
			for i = n, 2, -1 do
				local j = rng:NextInteger(1, i)
				shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
			end
			data.Job = { Type = "edit", Answer = order, Clips = shuffled, Tier = stats.Tier, Started = os.time() }
			return true, "Encargo de edición: ordena los clips del cliente.", { clips = shuffled }
		elseif p.type == "photo" then
			local candidates = {}
			for _, s in ipairs(WorldData.Spots) do
				if not s.Secret then
					candidates[#candidates + 1] = s
				end
			end
			local spot = candidates[rng:NextInteger(1, #candidates)]
			local modes = {}
			for _, m in ipairs(VideoData.PhotoModes) do
				if not m.NeedsProduct and m.Id ~= "pet" and m.Id ~= "night" then
					for _, t in ipairs(m.Tags) do
						if Util.indexOf(spot.Tags, t) then
							modes[#modes + 1] = m
							break
						end
					end
				end
			end
			if #modes == 0 then
				modes = { VideoData.PhotoModeById.closeup }
			end
			local mode = modes[rng:NextInteger(1, #modes)]
			data.Job = { Type = "photo", Spot = spot.Id, SpotName = spot.Name, Mode = mode.Id, ModeName = mode.Name, Started = os.time() }
			return true, "Encargo: foto «" .. mode.Name .. "» en " .. spot.Name .. ".", { spot = spot.Id }
		elseif p.type == "delivery" then
			if not S.Shop.storeNear(player) then
				return false, "Los repartos empiezan en una tienda (MegaTec, FotoPro, Conecta o Creator Hub)."
			end
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			local candidates = {}
			for _, s in ipairs(WorldData.Spots) do
				if not s.Secret and root then
					local d = math.sqrt((s.X - root.Position.X) ^ 2 + (s.Z - root.Position.Z) ^ 2)
					if d > 200 and d < 900 then
						candidates[#candidates + 1] = { s = s, d = d }
					end
				end
			end
			if #candidates == 0 then
				return false, "No hay repartos disponibles ahora."
			end
			local c = candidates[rng:NextInteger(1, #candidates)]
			data.Job = { Type = "delivery", Spot = c.s.Id, SpotName = c.s.Name, Dist = math.floor(c.d), Started = os.time() }
			return true, "Reparto: lleva el paquete a " .. c.s.Name .. " (" .. math.floor(c.d) .. " studs).", { spot = c.s.Id }
		elseif p.type == "cashier" then
			if not S.Shop.storeNear(player) then
				return false, "Este turno empieza dentro de una tienda."
			end
			local rounds, answers = {}, {}
			for i = 1, 3 do
				local price = rng:NextInteger(3, 95)
				local paid = price <= 10 and 10 or (price <= 20 and 20 or (price <= 50 and 50 or 100))
				rounds[i] = { Price = price, Paid = paid }
				answers[i] = paid - price
			end
			data.Job = { Type = "cashier", Rounds = rounds, Answer = answers, Started = os.time() }
			return true, "Turno de caja: calcula el cambio de 3 clientes.", { rounds = rounds }
		elseif p.type == "camera" then
			local candidates = {}
			for _, s in ipairs(WorldData.Spots) do
				if not s.Secret then
					candidates[#candidates + 1] = s
				end
			end
			local spot = candidates[rng:NextInteger(1, #candidates)]
			local minQ = math.min(70, 30 + data.Level * 2)
			data.Job = { Type = "camera", Spot = spot.Id, SpotName = spot.Name, MinQ = minQ, Count = 0, Started = os.time() }
			return true, "Encargo de grabación: 2 escenas de calidad " .. minQ .. "+ en " .. spot.Name .. " (en cualquier proyecto).", { spot = spot.Id }
		elseif p.type == "thumbs" then
			local kw = Jobs.Keywords[rng:NextInteger(1, #Jobs.Keywords)]
			local minScore = math.min(75, 45 + data.Level)
			data.Job = { Type = "thumbs", Keyword = kw, MinScore = minScore, Started = os.time() }
			return true, "Encargo: miniatura con la palabra «" .. kw .. "» y puntuación " .. minScore .. "+ (app Miniaturas).", {}
		elseif p.type == "tech" then
			local cpus, mobos = {}, {}
			for _, def in pairs(require(Shared.ItemCatalog).Items) do
				if def.Sub == "cpu" then
					cpus[#cpus + 1] = def
				elseif def.Sub == "mobo" then
					mobos[#mobos + 1] = def
				end
			end
			table.sort(cpus, function(a, b)
				return a.Id < b.Id
			end)
			table.sort(mobos, function(a, b)
				return a.Id < b.Id
			end)
			local questions, answers = {}, {}
			for i = 1, 3 do
				local cpu = cpus[rng:NextInteger(1, #cpus)]
				local good, bad = {}, {}
				for _, m in ipairs(mobos) do
					if m.Compat.Socket == cpu.Compat.Socket then
						good[#good + 1] = m
					else
						bad[#bad + 1] = m
					end
				end
				local correct = good[rng:NextInteger(1, #good)]
				local opts = { correct.Id }
				while #opts < 3 and #bad > 0 do
					local b = table.remove(bad, rng:NextInteger(1, #bad))
					opts[#opts + 1] = b.Id
				end
				for j = #opts, 2, -1 do
					local k = rng:NextInteger(1, j)
					opts[j], opts[k] = opts[k], opts[j]
				end
				questions[i] = { Cpu = cpu.Id, Options = opts }
				answers[i] = correct.Id
			end
			data.Job = { Type = "tech", Questions = questions, Answer = answers, Started = os.time() }
			return true, "Cliente con averías: elige la placa base compatible con cada procesador.", { questions = questions }
		elseif p.type == "reporter" then
			local ev = S.Events.current()
			local spot = WorldData.SpotById[ev.Spot]
			data.Job = { Type = "reporter", Spot = ev.Spot, SpotName = spot.Name .. " (" .. ev.Name .. ")", Started = os.time() }
			return true, "Reportaje: haz una foto (calidad 45+) y graba una escena en " .. spot.Name .. ".", { spot = ev.Spot }
		end
		return false, "Empleo no válido."
	end)

	Net.on("Job.Submit", function(player, p)
		local data = S.Data.get(player)
		local job = data.Job
		if job.Type == "edit" then
			if not S.Computer.hasSession(player) then
				return false, "Necesitas estar usando un computador."
			end
			if type(p.order) ~= "table" or #p.order ~= #job.Answer then
				return false, "Orden incompleto."
			end
			local correct = 0
			for i, label in ipairs(job.Answer) do
				if p.order[i] == label then
					correct = correct + 1
				end
			end
			local ratio = correct / #job.Answer
			if ratio < 0.5 then
				data.Job = {}
				cooldown[player] = cooldown[player] or {}
				cooldown[player].edit = os.clock()
				return false, "El cliente rechazó la edición (" .. correct .. "/" .. #job.Answer .. " clips bien). Inténtalo en otro encargo."
			end
			local amount = pay(player, "edit", (Jobs.Types.edit.Base + job.Tier * 15) * ratio, correct .. "/" .. #job.Answer .. " clips")
			return true, "✅ Edición entregada: +$" .. amount .. " (" .. correct .. "/" .. #job.Answer .. ")."
		elseif job.Type == "delivery" then
			local spot = WorldData.SpotById[job.Spot]
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			if not spot or not root then
				return false, "No puedes entregar ahora."
			end
			local d = math.sqrt((spot.X - root.Position.X) ^ 2 + (spot.Z - root.Position.Z) ^ 2)
			if d > 30 then
				return false, "Aún no estás en " .. spot.Name .. " (a " .. math.floor(d) .. " studs)."
			end
			local amount = pay(player, "delivery", Jobs.Types.delivery.Base + job.Dist * 0.05, job.SpotName)
			return true, "✅ Paquete entregado: +$" .. amount .. "."
		elseif job.Type == "cashier" or job.Type == "tech" then
			if type(p.answers) ~= "table" or #p.answers ~= #job.Answer then
				return false, "Responde a todo."
			end
			local correct = 0
			for i, a in ipairs(job.Answer) do
				if tostring(p.answers[i]) == tostring(a) then
					correct = correct + 1
				end
			end
			if correct == 0 then
				data.Job = {}
				cooldown[player] = cooldown[player] or {}
				cooldown[player][job.Type] = os.clock()
				return false, "Ninguna respuesta correcta. El encargado te pide repasar."
			end
			local amount = pay(player, job.Type, Jobs.Types[job.Type].Base * correct / 3 + (job.Type == "tech" and data.Level * 3 or 0), correct .. "/3")
			return true, "✅ Turno completado: +$" .. amount .. " (" .. correct .. "/3 correctas)."
		elseif job.Type == "photo" then
			return false, "Este encargo se completa al hacer la foto pedida en el lugar indicado."
		end
		return false, "No tienes encargos en curso."
	end)

	Net.on("Job.Cancel", function(player)
		local data = S.Data.get(player)
		if not data.Job.Type then
			return false, "No tienes encargos en curso."
		end
		data.Job = {}
		return true, "Encargo cancelado (sin penalización)."
	end)

	Players.PlayerRemoving:Connect(function(player)
		cooldown[player] = nil
	end)
end

return Jobs
