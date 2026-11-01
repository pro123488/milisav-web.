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
	studio = { "¡Bienvenido a Prisma! Alquila un plató por horas: gaming, música, cocina, podcast, croma o fotografía.",
		"Dentro del plató alquilado tus escenas y fotos ganan calidad y luz profesional.",
		"Con el croma eliges el fondo y tu escena cuenta como si grabaras en ese tipo de lugar." },
	leisure = { "¡Hola! Aquí se viene a desconectar: sube el ánimo y vuelve a grabar con energía.",
		"Entrenar mejora tu forma física; el cine te da ideas para vídeos; en el karaoke, con micrófono, ¡hasta grabas!",
		"En la bolera, lee la pista: el efecto y la potencia correctos dan más plenos." },
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
	dealer = { "¡Bienvenido a Motor City! Cada modelo es distinto: velocidad, giro, maletero y consumo.",
		"¿Aún no te llega? Alquílalo un día y pruébalo por la ciudad.",
		"Con un buen maletero llevas mucho más equipo cuando grabas fuera de casa." },
	mechanic = { "Aquí repostamos, cargamos eléctricos y reparamos. Un vehículo cuidado corre más.",
		"Si te quedas sin combustible irás muy despacio: no esperes a la reserva." },
	travel = { "¡Bienvenido! Desde este mostrador salen los vuelos a todos los destinos. El billete incluye la vuelta.",
		"Algunos destinos piden invitación: sube de rango o consigue un patrocinio activo.",
		"En cada destino hay lugares 🎥 únicos, un hotel y una tienda con productos que no se venden en la ciudad." },
	dest_shop = { "Todo lo que ves aquí es exclusivo: no lo encontrarás en la ciudad.", "Si no cabe en tu mochila, te lo enviamos a casa." },
	hotel = { "Una noche en el hotel te deja como nuevo para seguir grabando.", "Las vistas desde las habitaciones son de postal." },
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

-- Crea el modelo anclado de un personaje (avatar o maniquí de respaldo). También lo usa FriendService.
function NPC.makeModel(name, shirt, pants)
	local m
	local ok = pcall(function()
		local desc = Instance.new("HumanoidDescription")
		if shirt then
			desc.TorsoColor = shirt
			desc.LeftArmColor = shirt
			desc.RightArmColor = shirt
		end
		if pants then
			desc.LeftLegColor = pants
			desc.RightLegColor = pants
		end
		m = Players:CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15)
	end)
	if not ok or not m then
		m = buildDummy(name)
		if shirt and m:FindFirstChild("Torso") then
			m.Torso.Color = shirt
		end
		if pants and m:FindFirstChild("Legs") then
			m.Legs.Color = pants
		end
	end
	m.Name = name
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = true
		end
	end
	local hum = m:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayName = name
		hum.NameDisplayDistance = 40
	end
	return m, hum
end

local function spawnNpc(point, index)
	local m = NPC.makeModel(point.Name)
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
	elseif p.Role == "dealer" or p.Role == "mechanic" then
		options[#options + 1] = { label = "Vehículos", ui = "app", app = "vehicles" }
	elseif p.Role == "travel" or p.Role == "dest_shop" or p.Role == "hotel" then
		options[#options + 1] = { label = "Abrir Viajes", ui = "app", app = "travel" }
	elseif p.Role == "studio" then
		options[#options + 1] = { label = "Abrir Estudios", ui = "app", app = "studios" }
	elseif p.Role == "leisure" then
		options[#options + 1] = { label = "Abrir Ocio", ui = "app", app = "leisure" }
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
