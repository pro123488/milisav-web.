--!nonstrict
-- Main (Script de servidor): arranca todos los servicios en orden y gestiona la entrada de jugadores.

local Players = game:GetService("Players")
local Services = script.Parent:WaitForChild("Services")

local S = {}
local order = {
	{ "Net", "Net" },
	{ "Text", "TextFilter" },
	{ "Data", "DataService" },
	{ "Time", "TimeWeatherService" },
	{ "Economy", "EconomyService" },
	{ "Monetization", "MonetizationService" },
	{ "Progress", "ProgressService" },
	{ "Quest", "QuestService" },
	{ "Inventory", "InventoryService" },
	{ "Computer", "ComputerService" },
	{ "Shop", "ShopService" },
	{ "Travel", "TravelService" },
	{ "Property", "PropertyService" },
	{ "World", "WorldBuilder" },
	{ "Home", "HomeService" },
	{ "Avatar", "AvatarService" },
	{ "Needs", "NeedsService" },
	{ "Events", "EventService" },
	{ "Sponsor", "SponsorService" },
	{ "Live", "LiveService" },
	{ "Vehicle", "VehicleService" },
	{ "Video", "VideoService" },
	{ "Pet", "PetService" },
	{ "Channel", "ChannelService" },
	{ "Market", "MarketService" },
	{ "Trade", "TradeService" },
	{ "Jobs", "JobsService" },
	{ "Company", "CompanyService" },
	{ "NPC", "NPCService" },
	{ "Sync", "SyncService" },
}

for _, entry in ipairs(order) do
	S[entry[1]] = require(Services:WaitForChild(entry[2]))
end
for _, entry in ipairs(order) do
	S[entry[1]].Init(S)
end
for _, entry in ipairs(order) do
	local ok, err = true, nil
	if S[entry[1]].Start then
		ok, err = pcall(S[entry[1]].Start)
	end
	if not ok then
		warn("[YTLife] Error al iniciar " .. entry[2] .. ": " .. tostring(err))
	end
end

local Catalog = require(game:GetService("ReplicatedStorage").Shared.ItemCatalog)
local Config = require(game:GetService("ReplicatedStorage").Shared.Config)

local function giveStarterKit(player)
	local data = S.Data.get(player)
	local phone = S.Inventory.add(player, "phone_basic", { src = "starter", paid = 0 })
	data.Equipped.Phone = phone
	S.Inventory.add(player, "tripod_basic", { src = "starter", paid = 10 })
	S.Inventory.add(player, "mon_22", { src = "starter", paid = 40 })
	S.Inventory.add(player, "kb_basic", { src = "starter", paid = 5 })
	S.Inventory.add(player, "mouse_basic", { src = "starter", paid = 5 })
	S.Inventory.add(player, "chair_basic", { src = "starter", paid = 15 })
	S.Computer.createRigFromPrebuilt(player, Catalog.get("pc_old"), { src = "starter", paid = 150 })
	data.Counters.items_bought = 0
	S.Net.notify(player, "📱 Recibiste un teléfono básico y una habitación con un computador viejo.", "success")
end

local function onPlayerAdded(player)
	player.CharacterAdded:Connect(function(char)
		if S.Data.get(player) then
			S.Avatar.onCharacter(player, char)
		end
	end)
	local profile = S.Data.load(player)
	if not profile or not player.Parent then
		return
	end
	S.Monetization.onPlayerReady(player)
	S.Home.onPlayerReady(player)
	local data = profile.Data
	if next(data.Inventory) == nil then
		giveStarterKit(player)
	end
	-- Crecimiento de los vídeos mientras estaba desconectado (limitado)
	S.Channel.tickPlayer(player, Config.OfflineCatchUpHours * 3600)
	data.LastSeen = os.time()
	S.Shop.processOrders(player)
	pcall(S.Sponsor.refreshOffers, player)
	S.Quest.check(player)
	if player.Character then
		task.spawn(S.Avatar.onCharacter, player, player.Character)
	end
	S.Sync.send(player)
	S.Net.push(player, "ready", { isNew = profile.IsNew, readOnly = profile.ReadOnly })
	if profile.ReadOnly then
		S.Net.notify(player, "Modo de prueba en Studio: el progreso NO se guardará. Activa «Enable Studio Access to API Services» para guardar.", "warn")
	end
end

Players.PlayerAdded:Connect(function(player)
	local ok, err = pcall(onPlayerAdded, player)
	if not ok then
		S.Net.logError("PlayerAdded", err)
	end
end)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	S.Computer.close(player)
	S.Data.release(player)
end)

print("[YTLife] Servidor listo: " .. Config.GameName .. " v" .. Config.Version)
