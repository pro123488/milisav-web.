--!nonstrict
-- NPCService: dependientes, barista, asesora del banco y vecinos con diálogos útiles.
-- Usa Players:CreateHumanoidModelFromDescription; si falla (por ejemplo en pruebas sin red),
-- crea un maniquí sencillo de Parts para que el NPC siga siendo funcional.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local Shared = ReplicatedStorage.Shared
local Catalog = require(Shared.ItemCatalog)
local WorldData = require(Shared.WorldData)

local NPC = {}
local S
local npcs = {}

local tips = {
	"Los lugares con 🎥 son ideales para grabar. Cada distrito tiene los suyos.",
	"En la hora dorada (amanecer y atardecer) las tomas exteriores quedan más bonitas.",
	"Si llueve, una cámara resistente al agua evita gotas en la lente.",
	"Un trípode permite hacer time-lapses. ¡Al público le encantan!",
	"Un micrófono de solapa o de cañón mejora mucho el audio en la calle.",
	"Las reseñas con prueba real necesitan que tengas el producto en la mochila.",
	"Dicen que hay lugares secretos repartidos por la ciudad... busca destellos dorados.",
	"Con el taxi del teléfono llegas a cualquier distrito rápido, pero cuesta dinero.",
	"Las tendencias cambian cada día. Mira la app Tendencias antes de elegir idea.",
	"Un buen monitor mejora el etalonaje; un buen PC exporta mucho más rápido.",
}

local roleLines = {
	shopkeeper = { "¡Bienvenido! Puedes inspeccionar cualquier producto expuesto o ver todo el catálogo en el mostrador.",
		"Si compras aquí, te lo llevas al momento. Online tarda un poco más en llegar.",
		"¿Vas a grabar una reseña? Puedes probar los productos de exposición mientras estés en la tienda." },
	barista = { "Los computadores públicos son gratis. Perfectos para editar si aún no tienes uno bueno.",
		"Aquí vienen muchos estudiantes a editar sus vídeos." },
	waiter = { "¡Bienvenido! El menú del día es lo más popular. Pide en el mostrador.", "Comer bien sube tu energía y tu ánimo." },
	petkeeper = { "¡Hola! Aquí puedes adoptar perros, gatos, pájaros, conejos, tortugas y peces. Máximo 3 por familia.",
		"Juega con tu mascota y dale de comer: se pone muy contenta. Si la notas triste, solo necesita un poco de cariño.",
		"Una cama o un rascador en casa hace que tus mascotas estén siempre a gusto." },
	banker = { "Desde el cajero puedes ahorrar, crear metas y pedir préstamos con un 10% fijo.",
		"Revisa tu informe mensual: verás en qué gastas y cuánto ganas." },
}

function NPC.Init(services)
	S = services
end

local function buildDummy(name)
	local m = Instance.new("Model")
	m.Name = name
	local function part(n, size, offset, color)
		local p = Instance.new("Part")
		p.Name = n
		p.Size = size
		p.Anchored = true
		p.Color = color
		p.CFrame = CFrame.new(offset)
		p.Parent = m
		return p
	end
	local root = part("HumanoidRootPart", Vector3.new(2, 2, 1), Vector3.new(0, 3, 0), Color3.fromRGB(60, 120, 200))
	root.Transparency = 1
	part("Torso", Vector3.new(2, 2, 1), Vector3.new(0, 3, 0), Color3.fromRGB(60, 120, 200))
	part("Head", Vector3.new(1.2, 1.2, 1.2), Vector3.new(0, 4.6, 0), Color3.fromRGB(240, 200, 160))
	part("Legs", Vector3.new(2, 2, 1), Vector3.new(0, 1, 0), Color3.fromRGB(40, 40, 50))
	local hum = Instance.new("Humanoid")
	hum.Parent = m
	m.PrimaryPart = root
	return m
end

local function spawnNpc(point, index)
	local m
	local ok = pcall(function()
		local desc = Instance.new("HumanoidDescription")
		m = Players:CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15)
	end)
	if not ok or not m then
		m = buildDummy(point.Name)
	end
	m.Name = point.Name
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = true
		end
	end
	local hum = m:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayName = point.Name
		hum.NameDisplayDistance = 40
	end
	m.Parent = workspace:FindFirstChild("City") or workspace
	local look = Vector3.new(point.Look.X, point.Pos.Y + 3, point.Look.Z)
	local pos = Vector3.new(point.Pos.X, point.Pos.Y + 3, point.Pos.Z)
	if (look - pos).Magnitude < 0.1 then
		look = pos + Vector3.new(0, 0, 1)
	end
	m:PivotTo(CFrame.lookAt(pos, look))
	local root = m.PrimaryPart or m:FindFirstChild("HumanoidRootPart")
	local id = "npc" .. index
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = "Hablar"
	pp.ObjectText = point.Name
	pp.HoldDuration = 0
	pp.MaxActivationDistance = 10
	pp.RequiresLineOfSight = false
	pp:SetAttribute("Action", "npc")
	pp:SetAttribute("NpcId", id)
	pp.Parent = root
	pp.Triggered:Connect(function(player)
		local okTalk, err = pcall(S.World.onPrompt, pp, player)
		if not okTalk then
			S.Net.logError("npc", err)
		end
	end)
	npcs[id] = { Point = point, Count = 0 }
end

function NPC.talk(player, id)
	local npc = npcs[id or ""]
	if not npc then
		return
	end
	npc.Count = npc.Count + 1
	local p = npc.Point
	local lines = roleLines[p.Role] or tips
	local text = lines[(npc.Count % #lines) + 1]
	local options = {}
	if p.Role == "shopkeeper" and p.Store then
		options[#options + 1] = { label = "Ver catálogo", ui = "store", store = p.Store }
		S.Travel.markStoreVisit(player, p.Store)
	elseif p.Role == "petkeeper" then
		options[#options + 1] = { label = "Ver mascotas", ui = "app", app = "pets" }
	elseif p.Role == "banker" then
		options[#options + 1] = { label = "Abrir banco", ui = "app", app = "bank" }
	elseif p.Role == "citizen" then
		local d = WorldData.DistrictById[p.District or ""]
		text = tips[(npc.Count + #(p.Name)) % #tips + 1]
		if d then
			text = "¡Hola! Esto es " .. d.Name .. ". " .. text
		end
	end
	S.Net.push(player, "dialog", { name = p.Name, text = text, options = options })
end

function NPC.Start()
	task.defer(function()
		for i, point in ipairs(S.World.NpcPoints) do
			local ok, err = pcall(spawnNpc, point, i)
			if not ok then
				S.Net.logError("npc spawn", err)
			end
		end
	end)
end

return NPC
