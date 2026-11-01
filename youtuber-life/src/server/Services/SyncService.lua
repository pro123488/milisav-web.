--!nonstrict
-- SyncService: construye la vista del perfil que recibe el cliente (solo lectura en el cliente).
-- Incluye valores derivados que el servidor calcula (rango, capacidad de mochila, rendimiento del PC...).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Progression = require(Shared.Progression)
local QuestDefs = require(Shared.QuestDefs)
local Catalog = require(Shared.ItemCatalog)

local Sync = {}
local S

local HIDDEN = { Receipts = true, ReceiptOrder = true, Processed = true, ProcessedOrder = true, __lock = true }

function Sync.Init(services)
	S = services
end

function Sync.build(player)
	local data = S.Data.get(player)
	local view = {}
	for k, v in pairs(data) do
		if not HIDDEN[k] then
			view[k] = v
		end
	end
	local rankIndex, rank = S.Progress.rank(data)
	view.Derived = {
		XpNext = Progression.xpToNext(data.Level),
		RankIndex = rankIndex,
		RankName = rank.Name,
		BackpackCap = S.Inventory.backpackCap(player),
		BackpackUsed = S.Inventory.backpackUsed(player),
		PhotoCap = S.Video.photoCapacity(player),
		StorageUsed = S.Computer.storageUsed(player),
		RigStats = {},
		Passes = S.Monetization.ownedList(player),
		Trends = S.Channel.trends(),
		ReadOnly = S.Data.getProfile(player).ReadOnly,
		LoanLimit = S.Economy.loanLimit(data),
		Day = S.Time.day(),
		Month = S.Time.monthIndex(),
		AtHome = S.Home.isAtHome(player),
		Recording = S.Video.isRecording(player),
		Session = S.Computer.session(player) and S.Computer.sessionStats(player) or nil,
		QuestValues = {},
		PropInside = S.Property.inside(player),
		EventId = S.Events.current().Id,
		EventActive = S.Events.isActive(),
		AtEvent = S.Events.atEvent(player),
		Interior = S.Property.interiorInfo(player),
		DecorScore = S.Property.inside(player) and S.Property.decorScore(player, S.Property.inside(player)) or nil,
		StorageCap = S.Property.storageCap(player),
		Stored = S.Property.storedCount(player),
		MaxProps = require(Shared.PropertyData).maxProperties(data.Level),
		Returnable = {},
		SellValues = {},
		VehicleOut = S.Vehicle and S.Vehicle.spawnedId(player) or nil,
		TrunkBonus = S.Vehicle and S.Vehicle.trunkBonus(player) or 0,
		Trade = S.Trade and S.Trade.view(player) or nil,
	}
	for rigId in pairs(data.Rigs) do
		view.Derived.RigStats[rigId] = S.Computer.rigStats(player, rigId)
	end
	for key in pairs(QuestDefs.TrackNames) do
		view.Derived.QuestValues[key] = S.Quest.valueOf(data, key)
	end
	for uid, rec in pairs(data.Inventory) do
		local def = Catalog.get(rec.Id)
		if def then
			view.Derived.SellValues[uid] = S.Inventory.sellValue(rec, def)
			if S.Inventory.canReturn(rec) then
				view.Derived.Returnable[uid] = math.floor(rec.Paid * 0.9 + 0.5)
			end
		end
	end
	local inc, exp = S.Economy.balanceSummary(data)
	view.Derived.MonthIncome, view.Derived.MonthExpense = inc, exp
	return view
end

function Sync.send(player)
	S.Net.push(player, "profile", Sync.build(player))
end

function Sync.Start()
	S.Net.on("Sync.Request", function(player)
		Sync.send(player)
		return true
	end)
end

return Sync
