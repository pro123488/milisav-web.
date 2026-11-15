-- SelfTest (ModuleScript)
-- Ubicación: ServerScriptService/Server/Tests/SelfTest
--
-- AUTOPRUEBA: solo se ejecuta en Roblox Studio, una vez, cuando el primer jugador termina de
-- cargar. Comprueba de verdad (ejecutando el código) lo que no se puede ver a simple vista:
--   * que todos los módulos cargan;
--   * que todos los premios, huevos, temporadas… apuntan a cosas que existen;
--   * que los datos guardados (incluso rotos) se cargan sin errores;
--   * que el estadio se dibuja en las 7 etapas con todo al máximo, y todas las piezas, mascotas y balones.
-- El resultado sale en la ventana Output de Studio: «[AUTOPRUEBA] ✅ …» o «❌ …» con el motivo.
-- Todo lo que dibuja lo hace lejos del mapa y lo borra al momento.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Server = ServerScriptService.Server

local SelfTest = {}

local TEST_ORIGIN = CFrame.new(6000, 300, 6000) -- lejos del mapa

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for k, v in pairs(value) do
		copy[k] = deepCopy(v)
	end
	return copy
end

function SelfTest.Run(player)
	local DataService = require(Server.Services.DataService)
	local DefaultData = require(Server.Util.DefaultData)
	local PlotService = require(Server.Services.PlotService)
	local StadiumRenderer = require(Server.Services.StadiumRenderer)
	local PetService = require(Server.Services.PetService)
	local MissionService = require(Server.Services.MissionService)
	local BallSkin = require(Server.Util.BallSkin)
	local CollectionConfig = require(Shared.Config.CollectionConfig)
	local OutfitConfig = require(Shared.Config.OutfitConfig)
	local SeasonConfig = require(Shared.Config.SeasonConfig)
	local TrophyConfig = require(Shared.Config.TrophyConfig)
	local RewardConfig = require(Shared.Config.RewardConfig)
	local RebirthConfig = require(Shared.Config.RebirthConfig)
	local WeeklyConfig = require(Shared.Config.WeeklyConfig)
	local ArenaConfig = require(Shared.Config.ArenaConfig)
	local StadiumPieces = require(Shared.Config.StadiumPieces)
	local StadiumStages = require(Shared.Config.StadiumStages)
	local FacilityConfig = require(Shared.Config.FacilityConfig)
	local MissionConfig = require(Shared.Config.MissionConfig)
	local EconomyFormulas = require(Shared.Modules.EconomyFormulas)

	local passed, failed = 0, {}
	local function check(name, fn)
		local ok, err = pcall(fn)
		if ok then
			passed += 1
		else
			table.insert(failed, name .. ": " .. tostring(err))
		end
	end
	local function expect(condition, message)
		if not condition then
			error(message, 0)
		end
	end
	local function material(name)
		local ok, value = pcall(function()
			return Enum.Material[name]
		end)
		return ok and value ~= nil
	end

	print("[AUTOPRUEBA] Empezando… (solo en Studio)")
	local startedAt = os.clock()

	-- 1. Todos los módulos cargan
	for _, root in ipairs({ Shared, Server }) do
		for _, module in ipairs(root:GetDescendants()) do
			if module:IsA("ModuleScript") and module ~= script then
				check("Cargar " .. module:GetFullName(), function()
					require(module)
				end)
			end
		end
	end

	-- 2. Huevos: cada rareza posible tiene mascotas en el grupo del huevo
	check("Huevos y grupos de mascotas", function()
		for _, egg in ipairs(CollectionConfig.Eggs) do
			for rarity, weight in pairs(egg.weights) do
				if weight > 0 then
					local found = false
					for _, pet in ipairs(CollectionConfig.Pets) do
						if not pet.golden and (pet.pool or "classic") == (egg.pool or "classic") and pet.rarity == rarity then
							found = true
						end
					end
					expect(found, string.format("el huevo %s puede dar %s y no hay mascotas", egg.id, rarity))
				end
			end
		end
	end)

	-- 3. Materiales escritos como texto
	check("Materiales de balones y estadios", function()
		for _, ball in ipairs(CollectionConfig.Balls) do
			expect(material(ball.material), "material inválido en el balón " .. ball.id)
		end
		for _, theme in ipairs(ArenaConfig.Themes) do
			for _, key in ipairs({ "pitchMaterial", "floorMaterial", "lineMaterial" }) do
				if theme[key] then
					expect(material(theme[key]), string.format("material inválido %s en el estadio %s", key, theme.id))
				end
			end
		end
	end)

	-- 4. Premios que apuntan a cosas que existen
	local function rewardOk(reward, where)
		if reward.egg then
			expect(CollectionConfig.EggById[reward.egg], where .. ": huevo inexistente " .. tostring(reward.egg))
		end
		if reward.crate then
			expect(CollectionConfig.CrateById[reward.crate], where .. ": caja inexistente " .. tostring(reward.crate))
		end
		if reward.type == "ball" then
			expect(CollectionConfig.BallById[reward.id], where .. ": balón inexistente " .. tostring(reward.id))
		elseif reward.type == "outfit" then
			expect(OutfitConfig.ById[reward.id], where .. ": traje inexistente " .. tostring(reward.id))
		end
	end
	check("Premios del pase de temporada (todas las temporadas)", function()
		for season = 1, #SeasonConfig.Themes do
			for tier, rewards in ipairs(SeasonConfig.Rewards(season)) do
				for _, track in ipairs({ "free", "premium" }) do
					if rewards[track] then
						rewardOk(rewards[track], string.format("temporada %d nivel %d %s", season, tier, track))
						expect(SeasonConfig.Describe(rewards[track]) ~= "?", "recompensa sin descripción")
					end
				end
			end
		end
	end)
	check("Premios de trofeos, diarios, ruleta, códigos, regalos e índice", function()
		for _, step in ipairs(TrophyConfig.Road) do
			rewardOk(step, "camino de trofeos " .. step.at)
		end
		for day, reward in ipairs(RewardConfig.Daily) do
			rewardOk(reward, "recompensa diaria " .. day)
		end
		for index, segment in ipairs(RewardConfig.Wheel) do
			rewardOk(segment, "ruleta " .. index)
		end
		for code, reward in pairs(RewardConfig.Codes) do
			rewardOk(reward, "código " .. code)
		end
		for index, gift in ipairs(RewardConfig.Playtime) do
			rewardOk(gift, "regalo por jugar " .. index)
		end
		for _, entry in ipairs(CollectionConfig.IndexRewards) do
			rewardOk(entry, "índice " .. entry.pool)
		end
		expect(CollectionConfig.BallById[RebirthConfig.BALL], "balón de renacimiento inexistente")
	end)
	check("Semana: estadios y bonus", function()
		for _, id in ipairs(WeeklyConfig.Themes) do
			expect(ArenaConfig.Theme(id).id == id, "estadio semanal inexistente " .. id)
		end
		expect(WeeklyConfig.ActiveBonus() ~= nil, "no hay bonus esta semana")
	end)

	check("Potenciadores, celebraciones y niveles de mascota", function()
		for _, def in ipairs(ArenaConfig.PowerUps) do
			expect(def.id and def.icon and def.name and def.color, "potenciador incompleto")
		end
		for _, id in ipairs(ArenaConfig.Celebrations) do
			expect(type(id) == "number" and id > 0, "celebración sin ID de animación")
		end
		local previous = 0
		for xp = 0, CollectionConfig.PET_LEVEL_XP[#CollectionConfig.PET_LEVEL_XP] do
			local level = CollectionConfig.PetLevel(xp)
			expect(level >= previous, "los niveles de mascota bajan con más experiencia")
			previous = level
		end
		expect(previous == #CollectionConfig.PET_LEVEL_XP, "no se llega al nivel máximo de mascota")
	end)

	-- 5. Datos guardados: por defecto y rotos
	local real = DataService.Get(player)
	check("Datos por defecto", function()
		local data = DefaultData.Create(player)
		data = DefaultData.Reconcile(data, player)
		expect(type(data.economy.money) == "number", "dinero no numérico")
	end)
	check("Datos rotos (se reparan sin errores)", function()
		local broken = {
			club = "basura", economy = { money = 0 / 0, debt = -5 }, collection = { pets = { inventada = 5, puppy = 1 / 0 } },
			pass = 7, rewards = { codes = { [1] = true } }, rebirth = { count = 999 }, arena = { trophies = -10 },
			stadium = { stage = 99, pieces = { { id = "seat", x = 0 / 0, z = 0, r = 0 }, { id = "inventada", x = 0, z = 0, r = 0 } } },
		}
		local data = DefaultData.Reconcile(broken, player)
		expect(data.economy.money == data.economy.money, "el dinero sigue siendo NaN")
		expect(#data.stadium.pieces == 0, "se aceptaron piezas inválidas")
		expect(data.rebirth.count <= RebirthConfig.MAX, "renacimientos fuera de rango")
		expect(data.arena.trophies >= 0, "trofeos negativos")
	end)
	if real then
		check("Fórmulas de economía", function()
			EconomyFormulas.Cycle(real)
		end)
		check("Logros (todas las estadísticas)", function()
			for _, achievement in ipairs(MissionConfig.Achievements) do
				expect(type(MissionService.Stat(real, achievement.stat)) == "number", "estadística desconocida " .. achievement.stat)
			end
		end)
	end

	-- 6. Dibujo: estadio en las 7 etapas al máximo, piezas, mascotas y balones
	local folder = Instance.new("Folder")
	folder.Name = "FEU_Autoprueba"
	folder.Parent = Workspace
	if real then
		for stage = 1, #StadiumStages do
			check("Dibujar el estadio en la etapa " .. stage, function()
				local data = deepCopy(real)
				data.stadium.stage = stage
				data.stadium.freeBuild = false
				for id, def in pairs(FacilityConfig.Facilities) do
					data.stadium.facilities[id] = #def.levels
				end
				local target = Instance.new("Folder")
				target.Parent = folder
				StadiumRenderer.Render(target, TEST_ORIGIN, PlotService.BuildRenderInfo(player, data))
				target:Destroy()
			end)
		end
		check("Dibujar todas las piezas del estadio libre", function()
			local data = deepCopy(real)
			data.stadium.freeBuild = true
			data.stadium.pieces = {}
			for index, piece in ipairs(StadiumPieces.List) do
				expect(StadiumRenderer.HasPieceBuilder(piece.id), "la pieza " .. piece.id .. " no tiene dibujo")
				table.insert(data.stadium.pieces, { id = piece.id, x = ((index - 1) % 8) * 30 - 105, z = math.floor((index - 1) / 8) * 30 - 90, r = 0, y = 0 })
			end
			local target = Instance.new("Folder")
			target.Parent = folder
			StadiumRenderer.Render(target, TEST_ORIGIN, PlotService.BuildRenderInfo(player, data))
			local models = 0
			for _, child in ipairs(target:GetChildren()) do
				if child:IsA("Model") and child:GetAttribute("PieceIndex") then
					models += 1
				end
			end
			target:Destroy()
			expect(models == #StadiumPieces.List, string.format("se dibujaron %d de %d piezas", models, #StadiumPieces.List))
		end)
	end
	check("Construir todas las mascotas (" .. #CollectionConfig.Pets .. ")", function()
		for _, pet in ipairs(CollectionConfig.Pets) do
			local ok, err = pcall(function()
				local model = PetService.BuildModel(pet, TEST_ORIGIN)
				model:Destroy()
			end)
			expect(ok, "mascota " .. pet.id .. ": " .. tostring(err))
		end
	end)
	check("Aplicar todos los balones (" .. #CollectionConfig.Balls .. ")", function()
		local ball = Instance.new("Part")
		ball.Shape = Enum.PartType.Ball
		ball.Size = Vector3.new(3, 3, 3)
		ball.Anchored = true
		ball.CFrame = TEST_ORIGIN
		ball.Parent = folder
		for _, skin in ipairs(CollectionConfig.Balls) do
			BallSkin.Apply(ball, skin.id)
			expect(ball:GetAttribute("Skin") == skin.id, "no se aplicó el balón " .. skin.id)
		end
	end)
	folder:Destroy()

	-- Informe
	local seconds = os.clock() - startedAt
	if #failed == 0 then
		print(string.format("[AUTOPRUEBA] ✅ %d pruebas correctas en %.1f s. Todo bien.", passed, seconds))
	else
		warn(string.format("[AUTOPRUEBA] ❌ %d pruebas fallan (y %d correctas). Mándale esta lista a quien programa el juego:", #failed, passed))
		for _, line in ipairs(failed) do
			warn("[AUTOPRUEBA] ❌ " .. line)
		end
	end
	return passed, failed
end

return SelfTest
