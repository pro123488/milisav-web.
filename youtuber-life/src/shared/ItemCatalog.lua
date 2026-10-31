--!nonstrict
-- ItemCatalog: catálogo único de objetos. Lo usan tiendas, inventario, montaje de PC,
-- grabación, comparador y misiones. Todas las marcas son ficticias.
--
-- Campos de cada objeto:
--   Id, Name, Brand, Cat, Sub, Price, Quality (1-100), Desc, Stats, Compat, Req {Level},
--   Slot (uso), Portable (se puede llevar en la mochila), Size (espacios de mochila),
--   Stores (tiendas físicas que lo venden), Color {r,g,b}, Shape (modelo de exposición),
--   Hidden (no se vende), Upgradable.

local ItemCatalog = {}

ItemCatalog.Categories = {
	{ Key = "pc", Name = "Computadores" },
	{ Key = "laptop", Name = "Portátiles" },
	{ Key = "monitor", Name = "Monitores" },
	{ Key = "peripheral", Name = "Periféricos" },
	{ Key = "furniture", Name = "Sillas y escritorios" },
	{ Key = "storage", Name = "Almacenamiento" },
	{ Key = "component", Name = "Componentes" },
	{ Key = "camera", Name = "Cámaras" },
	{ Key = "audio", Name = "Micrófonos" },
	{ Key = "accessory", Name = "Accesorios" },
	{ Key = "phone", Name = "Teléfonos" },
	{ Key = "tablet", Name = "Tabletas" },
	{ Key = "gadget", Name = "Gadgets y consolas" },
	{ Key = "decor", Name = "Muebles y decoración" },
}

ItemCatalog.Stores = {
	tech = { Name = "MegaTec", Cats = { "pc", "laptop", "monitor", "peripheral", "storage", "component" } },
	camera = { Name = "FotoPro", Cats = { "camera", "accessory", "audio" } },
	phone = { Name = "Conecta Móvil", Cats = { "phone", "tablet", "gadget" } },
	creator = { Name = "Creator Hub", Cats = { "accessory", "audio", "furniture", "peripheral" } },
	home = { Name = "Hogar & Deco", Cats = { "decor", "furniture" } },
}

local Items = {}
local Order = {}

local defaultShape = {
	pc = "tower", laptop = "laptop", monitor = "monitor", peripheral = "box", furniture = "box",
	storage = "box", component = "box", camera = "camera", audio = "mic", accessory = "box",
	phone = "phone", tablet = "phone", gadget = "box",
}

local function add(cat, sub, data)
	data.Cat = cat
	data.Sub = sub
	data.Stats = data.Stats or {}
	data.Compat = data.Compat or {}
	data.Req = data.Req or { Level = 1 }
	data.Size = data.Size or 1
	if data.Portable == nil then
		data.Portable = false
	end
	data.Shape = data.Shape or defaultShape[cat] or "box"
	data.Color = data.Color or { 60, 64, 72 }
	data.Quality = data.Quality or 50
	assert(Items[data.Id] == nil, "Id duplicado: " .. data.Id)
	Items[data.Id] = data
	Order[#Order + 1] = data.Id
	return data
end

---------------------------------------------------------------------------
-- COMPONENTES
---------------------------------------------------------------------------
-- Procesadores (Score = rendimiento relativo, Tdp = calor/consumo en W)
add("component", "cpu", { Id = "cpu_n3_210", Name = "Nexo C3-210", Brand = "Nexo", Price = 90, Quality = 25,
	Desc = "Procesador básico de 4 núcleos con gráficos integrados.",
	Stats = { Score = 20, Tdp = 45, IGpu = 6, Cores = 4 }, Compat = { Socket = "N4" } })
add("component", "cpu", { Id = "cpu_n5_420", Name = "Nexo C5-420", Brand = "Nexo", Price = 180, Quality = 45,
	Desc = "6 núcleos equilibrados para oficina y edición ligera. Con gráficos integrados.",
	Stats = { Score = 38, Tdp = 65, IGpu = 9, Cores = 6 }, Compat = { Socket = "N4" } })
add("component", "cpu", { Id = "cpu_n7_640", Name = "Nexo C7-640", Brand = "Nexo", Price = 340, Quality = 65,
	Desc = "8 núcleos de alto rendimiento. Necesita tarjeta gráfica.",
	Stats = { Score = 60, Tdp = 105, IGpu = 0, Cores = 8 }, Compat = { Socket = "N4" } })
add("component", "cpu", { Id = "cpu_n9_880", Name = "Nexo C9-880", Brand = "Nexo", Price = 590, Quality = 84,
	Desc = "Tope de gama de Nexo. Mucho calor: usa refrigeración líquida.",
	Stats = { Score = 82, Tdp = 150, IGpu = 0, Cores = 16 }, Compat = { Socket = "N4" }, Req = { Level = 4 } })
add("component", "cpu", { Id = "cpu_k5_500", Name = "Kairo R5 500", Brand = "Kairo", Price = 210, Quality = 50,
	Desc = "6 núcleos eficientes con gráficos integrados decentes.",
	Stats = { Score = 42, Tdp = 65, IGpu = 10, Cores = 6 }, Compat = { Socket = "K5" } })
add("component", "cpu", { Id = "cpu_k7_700", Name = "Kairo R7 700", Brand = "Kairo", Price = 360, Quality = 68,
	Desc = "8 núcleos rápidos y fríos. Ideal para edición 4K.",
	Stats = { Score = 66, Tdp = 95, IGpu = 0, Cores = 8 }, Compat = { Socket = "K5" } })
add("component", "cpu", { Id = "cpu_k9_900", Name = "Kairo R9 900", Brand = "Kairo", Price = 640, Quality = 88,
	Desc = "16 núcleos para creadores exigentes.",
	Stats = { Score = 88, Tdp = 140, IGpu = 0, Cores = 16 }, Compat = { Socket = "K5" }, Req = { Level = 5 } })
add("component", "cpu", { Id = "cpu_kx_thread", Name = "Kairo Threadmax 64", Brand = "Kairo", Price = 1400, Quality = 98,
	Desc = "Procesador de estación de trabajo. Requiere placa KX.",
	Stats = { Score = 100, Tdp = 220, IGpu = 0, Cores = 64 }, Compat = { Socket = "KX" }, Req = { Level = 8 } })

-- Placas base
add("component", "mobo", { Id = "mobo_n4_basic", Name = "Ferro B4 mATX (N4)", Brand = "Ferro", Price = 80, Quality = 35,
	Desc = "Placa básica para Nexo. DDR4, 2 ranuras de almacenamiento.",
	Compat = { Socket = "N4", RamType = "DDR4", Form = "mATX", StorageSlots = 2, FanHeaders = 3 } })
add("component", "mobo", { Id = "mobo_n4_pro", Name = "Ferro Z4 Pro ATX (N4)", Brand = "Ferro", Price = 190, Quality = 70,
	Desc = "Placa ATX con DDR5 y 4 ranuras de almacenamiento.",
	Compat = { Socket = "N4", RamType = "DDR5", Form = "ATX", StorageSlots = 4, FanHeaders = 6 } })
add("component", "mobo", { Id = "mobo_n4_itx", Name = "Ferro Mini ITX (N4)", Brand = "Ferro", Price = 170, Quality = 62,
	Desc = "Placa diminuta para equipos compactos. DDR5.",
	Compat = { Socket = "N4", RamType = "DDR5", Form = "ITX", StorageSlots = 2, FanHeaders = 2 } })
add("component", "mobo", { Id = "mobo_k5_basic", Name = "Orbis A5 mATX (K5)", Brand = "Orbis", Price = 90, Quality = 38,
	Desc = "Placa básica para Kairo. DDR4.",
	Compat = { Socket = "K5", RamType = "DDR4", Form = "mATX", StorageSlots = 2, FanHeaders = 3 } })
add("component", "mobo", { Id = "mobo_k5_pro", Name = "Orbis X5 Pro ATX (K5)", Brand = "Orbis", Price = 210, Quality = 74,
	Desc = "Placa ATX completa para Kairo. DDR5.",
	Compat = { Socket = "K5", RamType = "DDR5", Form = "ATX", StorageSlots = 4, FanHeaders = 6 } })
add("component", "mobo", { Id = "mobo_kx_ws", Name = "Stratos WS EATX (KX)", Brand = "Stratos", Price = 520, Quality = 95,
	Desc = "Placa de estación de trabajo con 6 ranuras de almacenamiento.",
	Compat = { Socket = "KX", RamType = "DDR5", Form = "EATX", StorageSlots = 6, FanHeaders = 8 }, Req = { Level = 8 } })

-- Memoria RAM
local rams = {
	{ "ram_d4_8", "Zenit 8 GB DDR4", "DDR4", 8, 30, 25 },
	{ "ram_d4_16", "Zenit 16 GB DDR4", "DDR4", 16, 55, 45 },
	{ "ram_d4_32", "Zenit 32 GB DDR4", "DDR4", 32, 95, 60 },
	{ "ram_d5_16", "Zenit 16 GB DDR5", "DDR5", 16, 75, 55 },
	{ "ram_d5_32", "Zenit 32 GB DDR5", "DDR5", 32, 130, 72 },
	{ "ram_d5_64", "Zenit 64 GB DDR5", "DDR5", 64, 240, 86 },
	{ "ram_d5_128", "Zenit 128 GB DDR5", "DDR5", 128, 480, 96 },
}
for _, r in ipairs(rams) do
	add("component", "ram", { Id = r[1], Name = r[2], Brand = "Zenit", Price = r[5], Quality = r[6],
		Desc = r[4] .. " GB de memoria " .. r[3] .. ". Más memoria permite proyectos con más escenas.",
		Stats = { Gb = r[4] }, Compat = { RamType = r[3] } })
end

-- Tarjetas gráficas
add("component", "gpu", { Id = "gpu_vx1", Name = "Voltex VX 1600", Brand = "Voltex", Price = 150, Quality = 35,
	Desc = "Gráfica de entrada. Acelera un poco la exportación.", Stats = { Score = 25, Watts = 75 }, Compat = { Length = 20 } })
add("component", "gpu", { Id = "gpu_vx3", Name = "Voltex VX 3600", Brand = "Voltex", Price = 320, Quality = 55,
	Desc = "Buena gráfica para 1080p y edición fluida.", Stats = { Score = 45, Watts = 170 }, Compat = { Length = 24 } })
add("component", "gpu", { Id = "gpu_vx5", Name = "Voltex VX 5700", Brand = "Voltex", Price = 520, Quality = 70,
	Desc = "Gráfica potente para 4K.", Stats = { Score = 65, Watts = 220 }, Compat = { Length = 28 } })
add("component", "gpu", { Id = "gpu_vx7", Name = "Voltex VX 7800", Brand = "Voltex", Price = 900, Quality = 85,
	Desc = "Gama alta. Exportaciones muy rápidas.", Stats = { Score = 85, Watts = 320 }, Compat = { Length = 31 }, Req = { Level = 4 } })
add("component", "gpu", { Id = "gpu_vx9", Name = "Voltex VX 9900", Brand = "Voltex", Price = 1600, Quality = 97,
	Desc = "La gráfica más potente. Consume muchísimo.", Stats = { Score = 100, Watts = 450 }, Compat = { Length = 34 }, Req = { Level = 7 } })
add("component", "gpu", { Id = "gpu_lm_s40", Name = "Lumina Studio S40", Brand = "Lumina", Price = 750, Quality = 82,
	Desc = "Gráfica profesional con color preciso: mejora el etalonaje.", Stats = { Score = 70, Watts = 200, ProColor = 10 }, Compat = { Length = 26 }, Req = { Level = 3 } })

-- Fuentes de alimentación
local psus = { { "psu_400", 400, 45, 35 }, { "psu_550", 550, 65, 50 }, { "psu_750", 750, 95, 68 }, { "psu_1000", 1000, 150, 84 }, { "psu_1300", 1300, 230, 95 } }
for _, p in ipairs(psus) do
	add("component", "psu", { Id = p[1], Name = "Ferro Power " .. p[2] .. " W", Brand = "Ferro", Price = p[3], Quality = p[4],
		Desc = "Fuente de " .. p[2] .. " W. El consumo total del equipo no debe superarla.", Stats = { Watts = p[2] } })
end

-- Refrigeración
add("component", "cooling", { Id = "cool_stock", Name = "Disipador de serie", Brand = "Nexo", Price = 15, Quality = 25,
	Desc = "Disipa hasta 70 W. Ruidoso.", Stats = { Capacity = 70, Noise = 6 } })
add("component", "cooling", { Id = "cool_tower", Name = "Ferro Torre 120", Brand = "Ferro", Price = 45, Quality = 55,
	Desc = "Disipador de torre: hasta 140 W.", Stats = { Capacity = 140, Noise = 4 } })
add("component", "cooling", { Id = "cool_aio240", Name = "Zenit Líquida 240", Brand = "Zenit", Price = 110, Quality = 75,
	Desc = "Refrigeración líquida: hasta 180 W, silenciosa.", Stats = { Capacity = 180, Noise = 3 } })
add("component", "cooling", { Id = "cool_aio360", Name = "Zenit Líquida 360", Brand = "Zenit", Price = 170, Quality = 90,
	Desc = "Refrigeración líquida grande: hasta 250 W.", Stats = { Capacity = 250, Noise = 3 } })

-- Gabinetes
add("component", "case", { Id = "case_mini", Name = "Orbis Cubo ITX", Brand = "Orbis", Price = 60, Quality = 45,
	Desc = "Gabinete diminuto. Solo placas ITX y gráficas de hasta 24 cm.",
	Stats = { Airflow = 4, FanSlots = 2 }, Compat = { Forms = { "ITX" }, MaxGpu = 24 } })
add("component", "case", { Id = "case_compact", Name = "Orbis Compacto", Brand = "Orbis", Price = 70, Quality = 40,
	Desc = "Gabinete compacto para ITX y mATX.", Stats = { Airflow = 5, FanSlots = 3 }, Compat = { Forms = { "ITX", "mATX" }, MaxGpu = 28 } })
add("component", "case", { Id = "case_mid", Name = "Ferro Torre Media", Brand = "Ferro", Price = 110, Quality = 60,
	Desc = "Torre media con buen flujo de aire.", Stats = { Airflow = 7, FanSlots = 5 }, Compat = { Forms = { "ITX", "mATX", "ATX" }, MaxGpu = 33 } })
add("component", "case", { Id = "case_glass", Name = "Aurea Vitrina RGB", Brand = "Aurea", Price = 160, Quality = 75,
	Desc = "Torre de cristal templado con iluminación.", Stats = { Airflow = 8, FanSlots = 6 }, Compat = { Forms = { "ITX", "mATX", "ATX" }, MaxGpu = 35 }, Color = { 220, 120, 255 } })
add("component", "case", { Id = "case_full", Name = "Stratos Torre Completa", Brand = "Stratos", Price = 240, Quality = 90,
	Desc = "Torre completa para placas EATX y gráficas enormes.", Stats = { Airflow = 9, FanSlots = 8 }, Compat = { Forms = { "mATX", "ATX", "EATX" }, MaxGpu = 40 } })

-- Ventiladores
add("component", "fan", { Id = "fan_basic", Name = "Ventilador 120 mm", Brand = "Ferro", Price = 8, Quality = 30,
	Desc = "Mejora el flujo de aire. Algo de ruido.", Stats = { Airflow = 1, Noise = 1 } })
add("component", "fan", { Id = "fan_rgb", Name = "Ventilador RGB 120 mm", Brand = "Aurea", Price = 15, Quality = 45,
	Desc = "Flujo de aire y luces de colores.", Stats = { Airflow = 1.5, Noise = 1 } })
add("component", "fan", { Id = "fan_silent", Name = "Ventilador Silencio 140 mm", Brand = "Zenit", Price = 22, Quality = 70,
	Desc = "Mueve mucho aire casi sin ruido.", Stats = { Airflow = 1.2, Noise = 0 } })

---------------------------------------------------------------------------
-- ALMACENAMIENTO (Gb = capacidad para material grabado, Speed = velocidad de exportación)
---------------------------------------------------------------------------
local drives = {
	{ "hdd_1tb", "Ferro HDD 1 TB", "HDD", 1000, 1, 45, 30, false },
	{ "hdd_4tb", "Ferro HDD 4 TB", "HDD", 4000, 1, 95, 45, false },
	{ "ssd_500", "Zenit SSD 500 GB", "SSD", 500, 3, 55, 50, false },
	{ "ssd_1tb", "Zenit SSD 1 TB", "SSD", 1000, 3, 85, 58, false },
	{ "nvme_1tb", "Zenit NVMe 1 TB", "NVMe", 1000, 6, 110, 70, false },
	{ "nvme_2tb", "Zenit NVMe 2 TB", "NVMe", 2000, 7, 190, 80, false },
	{ "nvme_4tb", "Zenit NVMe 4 TB", "NVMe", 4000, 8, 360, 90, false },
}
for _, d in ipairs(drives) do
	add("storage", "internal", { Id = d[1], Name = d[2], Brand = d[2]:match("^(%a+)"), Price = d[6], Quality = d[7],
		Desc = d[3] .. " interno de " .. d[4] .. " GB. Se instala en un computador.",
		Stats = { Gb = d[4], Speed = d[5] }, Compat = { DriveType = d[3] } })
end
add("storage", "external", { Id = "ext_hdd_1tb", Name = "Disco externo 1 TB", Brand = "Ferro", Price = 70, Quality = 40,
	Desc = "Almacenamiento externo portátil. Suma capacidad a cualquier computador o portátil.",
	Stats = { Gb = 1000, Speed = 2 }, Portable = true, Slot = "external" })
add("storage", "external", { Id = "ext_ssd_2tb", Name = "SSD externo 2 TB", Brand = "Zenit", Price = 180, Quality = 72,
	Desc = "SSD externo rápido y resistente.", Stats = { Gb = 2000, Speed = 5 }, Portable = true, Slot = "external" })
add("storage", "external", { Id = "nas_business", Name = "Servidor NAS Empresa 16 TB", Brand = "Stratos", Price = 1200, Quality = 88,
	Desc = "Almacenamiento para empresas: suma 16 TB al computador de casa.",
	Stats = { Gb = 16000, Speed = 4 }, Slot = "external", Req = { Level = 6 } })

---------------------------------------------------------------------------
-- COMPUTADORES COMPLETOS (se componen de piezas reales del catálogo)
---------------------------------------------------------------------------
local function prebuilt(id, name, brand, sub, quality, parts, desc, req, color)
	add("pc", sub, { Id = id, Name = name, Brand = brand, Price = 0, Quality = quality, Desc = desc,
		Parts = parts, Req = { Level = req or 1 }, Color = color })
end
prebuilt("pc_old", "Computador viejo", "Nexo", "Económico", 15,
	{ case = "case_compact", cpu = "cpu_n3_210", mobo = "mobo_n4_basic", ram = "ram_d4_8", storage = { "hdd_1tb" }, psu = "psu_400", cooling = "cool_stock" },
	"El computador que venía con la habitación. Lento, pero funciona.", 1)
prebuilt("pc_home", "Nexo Hogar", "Nexo", "Económico", 25,
	{ case = "case_compact", cpu = "cpu_n3_210", mobo = "mobo_n4_basic", ram = "ram_d4_8", storage = { "ssd_500" }, psu = "psu_400", cooling = "cool_stock" },
	"Computador económico con SSD: arranca rápido y edita vídeos sencillos.")
prebuilt("pc_office", "Nexo Oficina Plus", "Nexo", "Oficina", 40,
	{ case = "case_compact", cpu = "cpu_n5_420", mobo = "mobo_n4_basic", ram = "ram_d4_16", storage = { "ssd_1tb" }, psu = "psu_400", cooling = "cool_stock" },
	"Equipo de oficina fiable para edición 1080p.")
prebuilt("pc_mini", "Nexo Mini", "Nexo", "Compacto", 55,
	{ case = "case_mini", cpu = "cpu_n5_420", mobo = "mobo_n4_itx", ram = "ram_d5_16", storage = { "nvme_1tb" }, psu = "psu_550", cooling = "cool_stock" },
	"Computador compacto que ocupa muy poco espacio.")
prebuilt("pc_gamer", "Kairo Gamer X", "Kairo", "Gamer", 72,
	{ case = "case_glass", cpu = "cpu_k7_700", mobo = "mobo_k5_pro", ram = "ram_d5_32", storage = { "nvme_1tb" }, gpu = "gpu_vx5", psu = "psu_750", cooling = "cool_tower", fans = { "fan_rgb", "fan_rgb" } },
	"Equipo gamer con gráfica potente y cristal RGB.", 2, { 200, 90, 255 })
prebuilt("pc_creator", "Kairo Creator Pro", "Kairo", "Profesional", 84,
	{ case = "case_mid", cpu = "cpu_k9_900", mobo = "mobo_k5_pro", ram = "ram_d5_64", storage = { "nvme_2tb", "hdd_4tb" }, gpu = "gpu_lm_s40", psu = "psu_750", cooling = "cool_aio240", fans = { "fan_silent", "fan_silent" } },
	"Pensado para creadores: color preciso y mucha memoria.", 5)
prebuilt("pc_lux", "Aurea Prestige", "Aurea", "Lujo", 88,
	{ case = "case_glass", cpu = "cpu_n9_880", mobo = "mobo_n4_pro", ram = "ram_d5_64", storage = { "nvme_2tb" }, gpu = "gpu_vx7", psu = "psu_1000", cooling = "cool_aio360", fans = { "fan_rgb", "fan_rgb", "fan_rgb" } },
	"Computador de lujo con acabados premium.", 6, { 255, 205, 90 })
prebuilt("pc_ws", "Stratos Workstation", "Stratos", "Estación de trabajo", 98,
	{ case = "case_full", cpu = "cpu_kx_thread", mobo = "mobo_kx_ws", ram = "ram_d5_128", storage = { "nvme_4tb", "nvme_4tb" }, gpu = "gpu_vx9", psu = "psu_1300", cooling = "cool_aio360", fans = { "fan_silent", "fan_silent", "fan_silent", "fan_silent" } },
	"Estación de trabajo para producciones enormes.", 9)

---------------------------------------------------------------------------
-- PORTÁTILES (permiten editar e importar fuera de casa)
---------------------------------------------------------------------------
local laptops = {
	{ "lap_basic", "Orbis Book 14", "Básico", 380, 25, 18, 6, 8, 256, 1, 2 },
	{ "lap_school", "Orbis Edu 15", "Escolar", 450, 30, 22, 8, 8, 512, 1, 2 },
	{ "lap_office", "Orbis Pro Office", "Oficina", 780, 45, 35, 10, 16, 512, 2, 2 },
	{ "lap_ultra", "Zenit Air 13", "Ultraligero", 1100, 60, 45, 15, 16, 1000, 3, 1 },
	{ "lap_gamer", "Kairo Blade G16", "Gamer", 1500, 70, 60, 65, 32, 1000, 4, 2 },
	{ "lap_pro", "Stratos Studio 16", "Profesional", 2200, 82, 75, 60, 32, 2000, 5, 2 },
	{ "lap_edit", "Lumina Edit 17", "Edición", 3100, 90, 82, 72, 64, 4000, 6, 2 },
}
for _, l in ipairs(laptops) do
	add("laptop", l[3], { Id = l[1], Name = l[2], Brand = l[2]:match("^(%a+)"), Price = l[4], Quality = l[5],
		Desc = "Portátil " .. l[3]:lower() .. ". Permite importar y editar en cualquier lugar si lo llevas en la mochila.",
		Stats = { CpuScore = l[6], GpuScore = l[7], Ram = l[8], Gb = l[9], ProColor = (l[1] == "lap_pro" or l[1] == "lap_edit") and 6 or 0 },
		Portable = true, Size = l[11], Slot = "laptop", Req = { Level = l[10] } })
end

---------------------------------------------------------------------------
-- MONITORES (ColorAcc mejora el etalonaje; Screens acelera la edición)
---------------------------------------------------------------------------
local monitors = {
	{ "mon_22", "Orbis 22\" 1080p", "Económico", 110, 30, 55, 1, 1 },
	{ "mon_27", "Orbis 27\" 1440p 144 Hz", "Grande", 260, 55, 70, 1, 1 },
	{ "mon_32", "Zenit 32\" 4K", "Alta calidad", 420, 70, 78, 1, 2 },
	{ "mon_uw34", "Zenit 34\" Ultrapanorámico", "Ultrapanorámico", 520, 72, 75, 1.5, 2 },
	{ "mon_dual", "Kit doble 24\"", "Dos monitores", 300, 55, 70, 2, 2 },
	{ "mon_triple", "Kit triple 27\"", "Tres monitores", 800, 75, 72, 3, 4 },
	{ "mon_pro27", "Lumina Referencia 27\" 5K", "Profesional", 1100, 92, 96, 1, 5 },
}
for _, m in ipairs(monitors) do
	add("monitor", m[3], { Id = m[1], Name = m[2], Brand = m[2]:match("^(%a+)"), Price = m[4], Quality = m[5],
		Desc = "Monitor " .. m[3]:lower() .. ". Precisión de color " .. m[6] .. "/100.",
		Stats = { ColorAcc = m[6], Screens = m[7] }, Req = { Level = m[8] } })
end

---------------------------------------------------------------------------
-- PERIFÉRICOS (EditSpeed = % menos de tiempo de exportación/edición)
---------------------------------------------------------------------------
local periph = {
	{ "kb_basic", "Teclado de membrana", "Teclado", 15, 20, { EditSpeed = 1 } },
	{ "kb_mech", "Teclado mecánico Ferro K7", "Teclado", 80, 60, { EditSpeed = 3 } },
	{ "kb_editor", "Teclado de edición Lumina", "Teclado", 220, 88, { EditSpeed = 6 } },
	{ "mouse_basic", "Ratón básico", "Ratón", 10, 20, { EditSpeed = 1 } },
	{ "mouse_gamer", "Ratón gamer Kairo M5", "Ratón", 55, 60, { EditSpeed = 2 } },
	{ "mouse_pro", "Ratón ergonómico Zenit MX", "Ratón", 110, 85, { EditSpeed = 4 } },
	{ "pad_basic", "Alfombrilla básica", "Alfombrilla", 8, 25, { EditSpeed = 0.5 } },
	{ "pad_xl", "Alfombrilla XL", "Alfombrilla", 25, 55, { EditSpeed = 1 } },
	{ "head_basic", "Auriculares Orbis H1", "Auriculares", 30, 30, { AudioMix = 30 } },
	{ "head_studio", "Auriculares de estudio Zenit S", "Auriculares", 150, 75, { AudioMix = 70 } },
	{ "head_ref", "Auriculares de referencia Lumina R", "Auriculares", 380, 95, { AudioMix = 92 } },
	{ "spk_basic", "Altavoces 2.0", "Altavoces", 40, 30, { AudioMix = 25 } },
	{ "spk_monitor", "Monitores de estudio Ferro M5", "Altavoces", 320, 82, { AudioMix = 80 } },
	{ "web_basic", "Cámara web 720p", "Cámara web", 25, 20, { Video = 20 } },
	{ "web_hd", "Cámara web Orbis 1080p", "Cámara web", 70, 45, { Video = 38 } },
	{ "web_4k", "Cámara web Zenit 4K", "Cámara web", 190, 70, { Video = 55 } },
	{ "pad_ctrl", "Mando Orbis Station", "Mando", 60, 55, { Gaming = 10 } },
	{ "pad_pro", "Mando Pro Kairo", "Mando", 140, 80, { Gaming = 18 } },
}
for _, p in ipairs(periph) do
	add("peripheral", p[3], { Id = p[1], Name = p[2], Brand = "", Price = p[4], Quality = p[5],
		Desc = p[3] .. ". Se usa con el computador de casa.", Stats = p[6] })
end

---------------------------------------------------------------------------
-- SILLAS Y ESCRITORIOS (Comfort reduce el tiempo de exportación)
---------------------------------------------------------------------------
local furn = {
	{ "chair_basic", "Silla plegable", "Silla", 40, 20, 10, { 120, 120, 120 } },
	{ "chair_office", "Silla de oficina", "Silla", 160, 50, 25, { 40, 40, 50 } },
	{ "chair_gamer", "Silla gamer Kairo", "Silla", 290, 65, 32, { 180, 30, 40 } },
	{ "chair_ergo", "Silla ergonómica Zenit", "Silla", 650, 90, 45, { 30, 30, 35 } },
	{ "desk_basic", "Escritorio sencillo", "Escritorio", 60, 25, 8, { 160, 120, 80 } },
	{ "desk_large", "Escritorio grande en L", "Escritorio", 180, 55, 18, { 90, 70, 55 } },
	{ "desk_standing", "Escritorio elevable", "Escritorio", 420, 80, 26, { 230, 230, 230 } },
	{ "desk_lux", "Escritorio de nogal Aurea", "Escritorio", 900, 95, 32, { 90, 55, 30 } },
}
for _, f in ipairs(furn) do
	add("furniture", f[3], { Id = f[1], Name = f[2], Brand = "", Price = f[4], Quality = f[5],
		Desc = f[3] .. " para tu zona de trabajo. Comodidad +" .. f[6] .. ".", Stats = { Comfort = f[6] }, Color = f[7],
		Shape = f[3] == "Silla" and "chair" or "desk" })
end

---------------------------------------------------------------------------
-- CÁMARAS
---------------------------------------------------------------------------
-- Video, Photo, LowLight, Stab (estabilización), Battery (escenas por carga), GbPerMin, Weather (resistente a lluvia)
local cams = {
	{ "cam_basic", "Pixelia Snap", "Económica", 250, 30, 40, 45, 30, 20, 12, 1.0, false, 1, "Cámara compacta sencilla para empezar." },
	{ "cam_action", "Pixelia Action 4", "Acción", 380, 50, 55, 50, 35, 70, 10, 2.0, true, 1, "Pequeña, sumergible y muy estable. Ideal para aventura, playa y deportes." },
	{ "cam_vlog", "Lumina Vlog V2", "Vlog", 690, 60, 65, 62, 55, 45, 14, 2.5, false, 2, "Pantalla abatible y buen micro interno: perfecta para vlogs." },
	{ "cam_outdoor", "Ferro Trail", "Exteriores", 950, 66, 68, 70, 60, 60, 18, 2.5, true, 3, "Sellada contra lluvia y polvo, batería enorme." },
	{ "cam_pro", "Lumina Alpha 7", "Profesional", 1800, 82, 82, 85, 75, 50, 16, 3.5, false, 4, "Cámara profesional de fotograma completo." },
	{ "cam_studio", "Stratos Studio C", "Estudio", 2600, 86, 88, 80, 80, 30, 25, 4.0, false, 5, "Cámara de estudio: espectacular con trípode y buena luz." },
	{ "cam_cine", "Aurea Cine 8K", "Cinematográfica", 6500, 96, 97, 90, 90, 40, 12, 8.0, false, 8, "Cámara de cine 8K. Necesita mucho almacenamiento." },
}
for _, c in ipairs(cams) do
	add("camera", c[3], { Id = c[1], Name = c[2], Brand = c[2]:match("^(%a+)"), Price = c[4], Quality = c[5],
		Desc = c[14], Stats = { Video = c[6], Photo = c[7], LowLight = c[8], Stab = c[9], Battery = c[10], GbPerMin = c[11], Weather = c[12] },
		Portable = true, Slot = "camera", Req = { Level = c[13] } })
end

---------------------------------------------------------------------------
-- MICRÓFONOS (Audio; Portable = se puede usar fuera de casa)
---------------------------------------------------------------------------
local mics = {
	{ "mic_usb", "Micrófono USB Orbis", "USB", 40, 35, 45, false },
	{ "mic_usb_pro", "Micrófono USB Zenit Pro", "USB", 150, 65, 70, false },
	{ "mic_studio", "Micrófono de estudio Lumina XLR", "Estudio", 420, 92, 92, false },
	{ "mic_lav", "Micrófono de solapa", "Solapa", 70, 50, 60, true },
	{ "mic_shotgun", "Micrófono de cañón Ferro", "Cañón", 260, 75, 78, true },
	{ "mic_wireless", "Kit inalámbrico Zenit Duo", "Inalámbrico", 480, 86, 85, true },
}
for _, m in ipairs(mics) do
	add("audio", m[3], { Id = m[1], Name = m[2], Brand = "", Price = m[4], Quality = m[5],
		Desc = m[7] and ("Micrófono " .. m[3]:lower() .. ": llévalo en la mochila para grabar fuera.") or "Micrófono de escritorio: mejora el audio de grabaciones en casa o en estudio.",
		Stats = { Audio = m[6] }, Portable = m[7], Slot = "mic" })
end

---------------------------------------------------------------------------
-- ACCESORIOS
---------------------------------------------------------------------------
add("accessory", "Trípode", { Id = "tripod_basic", Name = "Trípode básico", Brand = "Ferro", Price = 30, Quality = 35,
	Desc = "Estabiliza tomas fijas y permite time-lapses.", Stats = { Stability = 40 }, Portable = true, Size = 2, Slot = "tripod", Shape = "tripod" })
add("accessory", "Trípode", { Id = "tripod_pro", Name = "Trípode de fibra de carbono", Brand = "Stratos", Price = 140, Quality = 75,
	Desc = "Ligero y muy firme.", Stats = { Stability = 75 }, Portable = true, Size = 1, Slot = "tripod", Shape = "tripod" })
add("accessory", "Estabilizador", { Id = "gimbal", Name = "Estabilizador Zenit G3", Brand = "Zenit", Price = 260, Quality = 80,
	Desc = "Elimina temblores en tomas en movimiento.", Stats = { Stab = 35 }, Portable = true, Slot = "gimbal" })
add("accessory", "Luz", { Id = "light_mini", Name = "Luz LED de bolsillo", Brand = "Lumina", Price = 60, Quality = 45,
	Desc = "Mejora la iluminación de noche y en interiores.", Stats = { Light = 18 }, Portable = true, Slot = "light", Shape = "light" })
add("accessory", "Luz", { Id = "light_panel", Name = "Panel LED profesional", Brand = "Lumina", Price = 230, Quality = 78,
	Desc = "Luz potente y regulable.", Stats = { Light = 35 }, Portable = true, Size = 2, Slot = "light", Shape = "light" })
add("accessory", "Aro de luz", { Id = "ringlight", Name = "Aro de luz 18\"", Brand = "Lumina", Price = 70, Quality = 50,
	Desc = "Luz frontal suave para grabar en casa.", Stats = { Light = 25 }, Slot = "homelight", Shape = "light" })
add("accessory", "Aro de luz", { Id = "softbox_kit", Name = "Kit de softbox x2", Brand = "Stratos", Price = 290, Quality = 82,
	Desc = "Iluminación de estudio en casa.", Stats = { Light = 40 }, Slot = "homelight", Shape = "light", Req = { Level = 3 } })
add("accessory", "Teleprompter", { Id = "teleprompter", Name = "Teleprompter Zenit", Brand = "Zenit", Price = 310, Quality = 75,
	Desc = "Presentaciones a cámara sin olvidos: más interés en tomas de presentación en casa.", Stats = { Presentation = 12 }, Slot = "homeextra", Req = { Level = 2 } })
add("accessory", "Fondo", { Id = "backdrop_green", Name = "Fondo croma verde", Brand = "Ferro", Price = 90, Quality = 55,
	Desc = "Fondo para grabar en casa con aspecto limpio.", Stats = { Decor = 10 }, Slot = "homeextra" })
add("accessory", "Fondo", { Id = "backdrop_neon", Name = "Pared de neón decorativa", Brand = "Aurea", Price = 240, Quality = 70,
	Desc = "Fondo llamativo para estudio gamer o tecnológico.", Stats = { Decor = 18 }, Slot = "homeextra" })
add("accessory", "Soporte", { Id = "phone_mount", Name = "Soporte para teléfono", Brand = "Orbis", Price = 20, Quality = 40,
	Desc = "Estabiliza un poco las tomas con el teléfono.", Stats = { Stab = 10 }, Portable = true, Slot = "mount" })
add("accessory", "Batería", { Id = "battery_std", Name = "Batería de repuesto", Brand = "Ferro", Price = 25, Quality = 40,
	Desc = "Una carga extra completa para la cámara.", Stats = { Charges = 1 }, Portable = true, Slot = "battery" })
add("accessory", "Batería", { Id = "battery_xl", Name = "Batería de larga duración", Brand = "Zenit", Price = 70, Quality = 70,
	Desc = "Dos cargas extra completas para la cámara.", Stats = { Charges = 2 }, Portable = true, Slot = "battery" })
add("accessory", "Mochila", { Id = "bag_small", Name = "Bolsa para cámara", Brand = "Ferro", Price = 45, Quality = 40,
	Desc = "+2 espacios de mochila (no ocupa espacio).", Stats = { Slots = 2 }, Portable = true, Size = 0, Slot = "bag" })
add("accessory", "Mochila", { Id = "bag_pro", Name = "Mochila profesional", Brand = "Stratos", Price = 160, Quality = 78,
	Desc = "+4 espacios de mochila (no ocupa espacio).", Stats = { Slots = 4 }, Portable = true, Size = 0, Slot = "bag" })

---------------------------------------------------------------------------
-- TELÉFONOS Y TABLETAS
---------------------------------------------------------------------------
local phones = {
	{ "phone_basic", "Nexo Fon A1", 0, 20, 30, 25, 8, 40, false, false, true },
	{ "phone_mid", "Orbis Phone 12", 450, 50, 55, 50, 12, 80, false, false, false },
	{ "phone_rugged", "Ferro Rugged 5", 600, 55, 50, 48, 26, 100, false, true, false },
	{ "phone_pro", "Zenit Pro 15", 1100, 78, 78, 72, 16, 150, true, false, false },
	{ "phone_ultra", "Aurea Ultra X", 1900, 92, 90, 85, 20, 250, true, false, false },
}
for _, p in ipairs(phones) do
	add("phone", "Teléfono", { Id = p[1], Name = p[2], Brand = p[2]:match("^(%a+)"), Price = p[3], Quality = p[4],
		Desc = "Teléfono. Fotos " .. p[5] .. "/100, vídeo " .. p[6] .. "/100, " .. p[8] .. " fotos de capacidad.",
		Stats = { Photo = p[5], Video = p[6], Battery = p[7], PhotoStorage = p[8], Night = p[9], Weather = p[10], LowLight = p[9] and 60 or 25, Stab = p[9] and 40 or 15, GbPerMin = 1 },
		Portable = true, Size = 0, Slot = "phone", Hidden = p[11] })
end
add("tablet", "Tableta", { Id = "tab_basic", Name = "Orbis Tab 10", Brand = "Orbis", Price = 280, Quality = 40,
	Desc = "Lleva el diseñador de miniaturas y las estadísticas a cualquier lugar (en la mochila).",
	Stats = { Thumbnails = true, EditLite = 0 }, Portable = true, Slot = "tablet", Shape = "phone" })
add("tablet", "Tableta", { Id = "tab_pro", Name = "Zenit Tab Pro", Brand = "Zenit", Price = 950, Quality = 80,
	Desc = "Miniaturas, estadísticas y edición ligera (hasta 8 escenas) en cualquier lugar.",
	Stats = { Thumbnails = true, EditLite = 8 }, Portable = true, Slot = "tablet", Shape = "phone", Req = { Level = 3 } })

---------------------------------------------------------------------------
-- GADGETS (productos para reseñas, unboxings y comparativas)
---------------------------------------------------------------------------
local gadgets = {
	{ "console_orbis5", "Consola Orbis Station 5", "Consola", 500, 75, { Performance = 70, Durability = 80 } },
	{ "console_kairo", "Consola Kairo Box", "Consola", 450, 72, { Performance = 72, Durability = 75 } },
	{ "console_handheld", "Consola portátil Pixelia Go", "Consola", 300, 60, { Performance = 45, Durability = 65 } },
	{ "tv_43", "Televisor Orbis 43\"", "Televisor", 320, 45, { Performance = 50, Durability = 70 } },
	{ "tv_65", "Televisor Zenit OLED 65\"", "Televisor", 1600, 90, { Performance = 92, Durability = 80 } },
	{ "watch_fit", "Reloj inteligente Ferro Fit", "Reloj", 180, 55, { Performance = 55, Durability = 70 } },
	{ "watch_lux", "Reloj Aurea Chrono", "Reloj", 1200, 92, { Performance = 70, Durability = 95 } },
	{ "spk_bt", "Altavoz Bluetooth Ferro Boom", "Equipo de sonido", 90, 55, { Performance = 60, Durability = 85 } },
	{ "soundbar", "Barra de sonido Zenit Cine", "Equipo de sonido", 450, 80, { Performance = 82, Durability = 80 } },
	{ "drone_mini", "Dron Pixelia Mini (vuelo simulado)", "Dron", 650, 70, { Performance = 70, Durability = 55, Aerial = true } },
	{ "earbuds", "Auriculares inalámbricos Orbis Buds", "Auriculares", 130, 60, { Performance = 62, Durability = 60 } },
	{ "vr_headset", "Visor de realidad virtual Stratos VR", "Realidad virtual", 700, 78, { Performance = 78, Durability = 70 } },
}
for _, g in ipairs(gadgets) do
	local portable = g[3] ~= "Televisor"
	add("gadget", g[3], { Id = g[1], Name = g[2], Brand = "", Price = g[4], Quality = g[5],
		Desc = g[3] .. " para usar y reseñar. Llévalo en la mochila para grabar una prueba real.",
		Stats = g[6], Portable = portable, Slot = g[1] == "drone_mini" and "drone" or "product", Size = (g[3] == "Consola" and 2) or 1 })
end

---------------------------------------------------------------------------
-- MUEBLES Y DECORACIÓN (colocables en tus propiedades con el modo construcción)
-- Decor = cuánto mejora la sala para grabar. Foot = huella {ancho, fondo, alto} en studs.
---------------------------------------------------------------------------
local styles = {
	{ "modern", "Moderno", 1.0, { 230, 230, 235 } }, { "minimal", "Minimalista", 0.9, { 245, 245, 245 } },
	{ "industrial", "Industrial", 1.0, { 90, 85, 80 } }, { "classic", "Clásico", 1.2, { 140, 90, 60 } },
	{ "tech", "Tecnológico", 1.3, { 40, 120, 200 } }, { "gamer", "Gamer", 1.2, { 200, 40, 220 } },
	{ "luxury", "Lujoso", 3.0, { 230, 190, 90 } }, { "budget", "Económico", 0.45, { 170, 170, 160 } },
	{ "natural", "Natural", 1.0, { 120, 160, 100 } }, { "futuristic", "Futurista", 1.8, { 80, 230, 230 } },
	{ "pro", "Profesional", 1.5, { 50, 55, 65 } }, { "creative", "Creativo", 1.1, { 255, 120, 90 } },
}
local pieces = {
	{ "sofa", "Sofá", 220, 6, "sofa", { 8, 3, 3 } },
	{ "lamp", "Lámpara", 60, 3, "lamp", { 2, 2, 6 } },
	{ "art", "Cuadro", 90, 4, "painting", { 5, 1, 4 } },
}
for _, st in ipairs(styles) do
	for _, pc in ipairs(pieces) do
		local price = math.floor(pc[3] * st[3] / 5 + 0.5) * 5
		local q = math.floor(math.min(98, 30 + st[3] * 22))
		add("decor", pc[2], { Id = "dec_" .. pc[1] .. "_" .. st[1], Name = pc[2] .. " " .. st[2]:lower(), Brand = "", Price = price, Quality = q,
			Desc = pc[2] .. " de estilo " .. st[2]:lower() .. ". Combina 3 piezas del mismo estilo para un bonus de decoración.",
			Stats = { Decor = math.floor(pc[4] * (0.7 + st[3] * 0.3) + 0.5) }, Style = st[1], Placeable = true, Foot = pc[6], Shape = pc[5], Color = st[4],
			Req = { Level = st[1] == "luxury" and 6 or 1 } })
	end
end
local generic = {
	{ "dec_plant_small", "Planta pequeña", "Planta", 25, 2, "plant", { 2, 2, 3 }, { 60, 150, 70 } },
	{ "dec_plant_big", "Palmera de interior", "Planta", 80, 4, "plant", { 3, 3, 7 }, { 50, 140, 60 } },
	{ "dec_rug", "Alfombra grande", "Alfombra", 70, 3, "rug", { 10, 7, 0.2 }, { 160, 60, 70 } },
	{ "dec_bookshelf", "Estantería con libros", "Estantería", 130, 4, "shelf", { 6, 2, 8 }, { 120, 85, 55 } },
	{ "dec_bed_single", "Cama individual", "Cama", 160, 3, "bed", { 5, 8, 2 }, { 240, 240, 250 } },
	{ "dec_bed_double", "Cama de matrimonio", "Cama", 380, 5, "bed", { 8, 9, 2 }, { 230, 230, 245 } },
	{ "dec_table", "Mesa de comedor", "Mesa", 150, 3, "table", { 8, 5, 3 }, { 140, 100, 70 } },
	{ "dec_coffee", "Mesa de centro", "Mesa", 70, 2, "table", { 5, 3, 1.6 }, { 90, 70, 50 } },
	{ "dec_curtain", "Cortinas de terciopelo", "Cortinas", 90, 3, "curtain", { 8, 1, 10 }, { 140, 30, 50 } },
	{ "dec_acoustic", "Paneles acústicos", "Acústica", 240, 6, "panel", { 8, 1, 6 }, { 60, 60, 70 }, true },
	{ "dec_rack", "Estantería de almacenaje", "Almacenaje", 110, 1, "shelf", { 6, 2, 8 }, { 80, 80, 85 } },
	{ "dec_partition", "Tabique móvil", "Distribución", 120, 0, "partition", { 10, 1, 12 }, { 225, 220, 210 } },
	{ "dec_lightstand", "Foco de estudio con soporte", "Iluminación", 320, 7, "lamp", { 2, 2, 8 }, { 255, 255, 240 } },
	{ "dec_neon", "Letrero de neón ON AIR", "Decoración", 150, 6, "neon", { 6, 1, 2 }, { 255, 40, 80 } },
	{ "dec_trophy", "Vitrina de trofeos", "Decoración", 260, 6, "shelf", { 5, 2, 7 }, { 230, 190, 90 } },
	{ "dec_beanbag", "Puf gamer", "Asiento", 60, 2, "beanbag", { 3, 3, 2 }, { 200, 40, 220 } },
	{ "dec_seccam", "Cámara de seguridad", "Seguridad", 140, 0, "seccam", { 1, 1, 1 }, { 30, 30, 34 } },
}
for _, g in ipairs(generic) do
	add("decor", g[3], { Id = g[1], Name = g[2], Brand = "", Price = g[4], Quality = math.min(90, 30 + g[5] * 8),
		Desc = g[2] .. (g[9] and ". Reduce el ruido al grabar en la sala." or ".") .. " Se coloca con el modo construcción.",
		Stats = { Decor = g[5], Acoustic = g[9] and 2 or nil }, Placeable = true, Foot = g[7], Shape = g[6], Color = g[8] })
end
-- Las sillas y escritorios también se pueden colocar
for _, id in ipairs(Order) do
	local it = Items[id]
	if it.Cat == "furniture" then
		it.Placeable = true
		it.Foot = it.Shape == "chair" and { 3, 3, 4 } or { 8, 4, 3 }
		it.Stats.Decor = math.floor(it.Quality / 25)
	end
end

---------------------------------------------------------------------------
-- Finalización: precio de los PC completos = suma de piezas (con 5% de descuento de montaje)
---------------------------------------------------------------------------
for _, id in ipairs(Order) do
	local item = Items[id]
	if item.Cat == "pc" then
		local total = 0
		for slot, partId in pairs(item.Parts) do
			if type(partId) == "table" then
				for _, p in ipairs(partId) do
					total = total + assert(Items[p], "Pieza inexistente " .. p).Price
				end
			else
				total = total + assert(Items[partId], "Pieza inexistente " .. partId).Price
			end
		end
		item.Price = math.floor(total * 0.95 / 10 + 0.5) * 10
		if item.Id == "pc_old" then
			item.Hidden = true
			item.Price = 150
		end
	end
	-- Tiendas físicas que lo venden
	item.Stores = {}
	for storeId, store in pairs(ItemCatalog.Stores) do
		for _, cat in ipairs(store.Cats) do
			if cat == item.Cat then
				table.insert(item.Stores, storeId)
			end
		end
	end
	table.sort(item.Stores)
end

ItemCatalog.Items = Items
ItemCatalog.Order = Order

function ItemCatalog.get(id)
	return Items[id]
end

function ItemCatalog.isForSale(id)
	local item = Items[id]
	return item ~= nil and not item.Hidden and item.Price > 0
end

function ItemCatalog.list(filter)
	local out = {}
	for _, id in ipairs(Order) do
		local item = Items[id]
		if not item.Hidden then
			local ok = true
			if filter then
				if filter.Cat and item.Cat ~= filter.Cat then
					ok = false
				end
				if filter.Store and not table.concat(item.Stores, ","):find(filter.Store, 1, true) then
					ok = false
				end
			end
			if ok then
				out[#out + 1] = item
			end
		end
	end
	return out
end

function ItemCatalog.categoryName(key)
	for _, c in ipairs(ItemCatalog.Categories) do
		if c.Key == key then
			return c.Name
		end
	end
	return key
end

-- Ventajas y desventajas generadas a partir de las estadísticas reales (para el comparador).
function ItemCatalog.prosCons(item)
	local pros, cons = {}, {}
	local s = item.Stats
	if item.Quality >= 80 then
		pros[#pros + 1] = "Calidad muy alta"
	elseif item.Quality <= 30 then
		cons[#cons + 1] = "Calidad básica"
	end
	if item.Price <= 100 and item.Price > 0 then
		pros[#pros + 1] = "Muy asequible"
	elseif item.Price >= 1500 then
		cons[#cons + 1] = "Precio elevado"
	end
	if item.Portable then
		pros[#pros + 1] = "Portátil (cabe en la mochila)"
	end
	if s.Weather then
		pros[#pros + 1] = "Resistente a la lluvia"
	end
	if s.LowLight and s.LowLight >= 75 then
		pros[#pros + 1] = "Excelente con poca luz"
	elseif s.LowLight and s.LowLight < 35 then
		cons[#cons + 1] = "Sufre con poca luz"
	end
	if s.Battery and s.Battery >= 18 then
		pros[#pros + 1] = "Gran autonomía"
	elseif s.Battery and s.Battery <= 10 then
		cons[#cons + 1] = "Batería corta"
	end
	if s.Tdp and s.Tdp >= 140 then
		cons[#cons + 1] = "Necesita mucha refrigeración"
	end
	if s.Watts and item.Sub == "gpu" and s.Watts >= 300 then
		cons[#cons + 1] = "Consumo muy alto"
	end
	if s.Noise and s.Noise >= 5 then
		cons[#cons + 1] = "Ruidoso"
	end
	if s.GbPerMin and s.GbPerMin >= 4 then
		cons[#cons + 1] = "Archivos muy pesados"
	end
	if item.Req and item.Req.Level and item.Req.Level >= 5 then
		cons[#cons + 1] = "Requiere nivel " .. item.Req.Level
	end
	return pros, cons
end

return ItemCatalog
