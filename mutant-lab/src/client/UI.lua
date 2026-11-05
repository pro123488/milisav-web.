--!nonstrict
-- UI: interfaz del jugador (PC y móvil). HUD con créditos y producción, tarjeta del laboratorio,
-- avisos, banner de evento, alerta de robo, guía para empezar y panel con pestañas:
-- Mutantes, Fusión, Mejoras, Bestiario, Tienda y Ayuda. Todos los botones llaman al servidor.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Util = require(ReplicatedStorage.Shared.Util)
local MutantData = require(ReplicatedStorage.Shared.MutantData)
local LabData = require(ReplicatedStorage.Shared.LabData)
local Config = require(ReplicatedStorage.Shared.Config)
local Net = require(script.Parent.Net)

local UI = { state = nil, tab = "mutants", open = false, selected = {}, hideGuide = false }
local player = Players.LocalPlayer
local gui, hud, panel, body, tabsBar, notes, alertBar, carryBar, eventBar, guide
local hudLabels = {}
local lastSig = ""

local C = {
	bg = Color3.fromRGB(16, 18, 28), card = Color3.fromRGB(28, 31, 46), card2 = Color3.fromRGB(38, 42, 62),
	text = Color3.fromRGB(235, 238, 255), sub = Color3.fromRGB(150, 158, 190), neon = Color3.fromRGB(80, 255, 140),
	gold = Color3.fromRGB(255, 214, 70), red = Color3.fromRGB(255, 70, 90), blue = Color3.fromRGB(70, 170, 255), purple = Color3.fromRGB(180, 110, 255),
}

local function rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local function corner(o, r)
	new("UICorner", { CornerRadius = UDim.new(0, r or 10) }, o)
	return o
end

local function frame(parent, props)
	local f = new("Frame", { BackgroundColor3 = C.card, BorderSizePixel = 0 }, parent)
	for k, v in pairs(props or {}) do
		f[k] = v
	end
	return corner(f)
end

local function label(parent, text, props)
	local t = new("TextLabel", {
		BackgroundTransparency = 1, Text = text, TextColor3 = C.text, Font = Enum.Font.GothamBold, TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Left, TextWrapped = true, Size = UDim2.new(1, 0, 0, 22),
	}, parent)
	for k, v in pairs(props or {}) do
		t[k] = v
	end
	return t
end

local function button(parent, text, fn, props)
	local b = new("TextButton", {
		Text = text, TextColor3 = Color3.new(1, 1, 1), Font = Enum.Font.GothamBold, TextSize = 15, AutoButtonColor = true,
		BackgroundColor3 = C.blue, Size = UDim2.new(0, 120, 0, 40), BorderSizePixel = 0,
	}, parent)
	for k, v in pairs(props or {}) do
		b[k] = v
	end
	corner(b, 8)
	b.Activated:Connect(function()
		fn()
	end)
	return b
end

local function list(parent)
	local s = new("ScrollingFrame", {
		BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, BorderSizePixel = 0,
	}, parent)
	new("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, s)
	new("UIPadding", { PaddingRight = UDim.new(0, 8) }, s)
	return s
end

local function row(parent, h)
	local r = frame(parent, { Size = UDim2.new(1, 0, 0, h or 56), BackgroundColor3 = C.card2 })
	new("UIPadding", { PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10), PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 6) }, r)
	return r
end

-------------------------------------------------------------------- avisos
function UI.notify(text, style)
	if not notes or not text or text == "" then
		return
	end
	local color = ({ success = C.neon, error = C.red, warn = C.gold, gold = C.gold, info = C.blue })[style or "info"] or C.blue
	local n = frame(notes, { Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = C.bg, BackgroundTransparency = 0.1 })
	new("UIStroke", { Color = color, Thickness = 2 }, n)
	label(n, text, { Size = UDim2.new(1, -16, 1, 0), Position = UDim2.new(0, 8, 0, 0), TextSize = 14, TextColor3 = color })
	task.delay(5, function()
		n:Destroy()
	end)
	local items = notes:GetChildren()
	local count = 0
	for _, c in ipairs(items) do
		if c:IsA("Frame") then
			count = count + 1
		end
	end
	if count > 5 then
		for _, c in ipairs(items) do
			if c:IsA("Frame") then
				c:Destroy()
				break
			end
		end
	end
end

-------------------------------------------------------------------- pestañas
local TABS = {
	{ "mutants", "🧪 Mutantes" }, { "fusion", "🧬 Fusión" }, { "upgrades", "🏗 Mejoras" },
	{ "index", "📖 Bestiario" }, { "shop", "🛒 Tienda" }, { "help", "❓ Ayuda" },
}

local function signature()
	local st = UI.state
	if not st or not st.Lab then
		return "none"
	end
	local parts = { UI.tab, st.Lab.Tier, #st.Lab.Mutants, st.Lab.Traps, tostring(st.Lab.Alarm), tostring(st.Lab.Drone), math.floor(math.log10(math.max(1, st.Credits)) * 4) }
	for _, m in ipairs(st.Lab.Mutants) do
		parts[#parts + 1] = m.Id .. (m.Carried and "c" or "") .. (UI.selected[m.Slot] and "s" or "")
	end
	for _, r in ipairs(st.Research or {}) do
		parts[#parts + 1] = r.Level
	end
	if st.Fusion then
		parts[#parts + 1] = st.Fusion.Name .. (st.Fusion.Ready and "R" or math.floor(st.Fusion.Left / 5))
	end
	return table.concat(parts, "|")
end

local renderers = {}

renderers.mutants = function(s, st)
	local lab = st.Lab
	label(s, "Tu laboratorio: " .. #lab.Mutants .. "/" .. lab.Slots .. " pedestales · +" .. Util.short(lab.Income) .. "/s", { TextColor3 = C.neon })
	if #lab.Mutants == 0 then
		label(s, "Aún no tienes mutantes. Ve a la cinta del centro y compra una cápsula (tecla E o toca el aviso).", { Size = UDim2.new(1, 0, 0, 46), TextColor3 = C.sub })
	end
	local nsel = 0
	for _ in pairs(UI.selected) do
		nsel = nsel + 1
	end
	if nsel == 2 then
		local a, b = nil, nil
		for k in pairs(UI.selected) do
			if a then
				b = k
			else
				a = k
			end
		end
		button(s, "🧬 Fusionar los 2 seleccionados", function()
			local r = Net.call("Fusion.Start", { a = a, b = b })
			if r.ok then
				UI.selected = {}
			end
			UI.refresh(true)
		end, { Size = UDim2.new(1, 0, 0, 42), BackgroundColor3 = C.purple })
	end
	for _, m in ipairs(lab.Mutants) do
		local rar = MutantData.RarityById[m.Rarity]
		local r = row(s, 62)
		label(r, m.Name, { TextColor3 = rgb(rar.Color), Size = UDim2.new(1, -250, 0, 22) })
		label(r, rar.Name .. " · pedestal " .. m.Slot .. " · +" .. Util.short(m.Income) .. "/s", { Position = UDim2.new(0, 0, 0, 24), Size = UDim2.new(1, -250, 0, 20), TextSize = 13, TextColor3 = C.sub })
		if m.Carried then
			label(r, "🚨 ¡Te lo están robando!", { Position = UDim2.new(1, -240, 0, 10), Size = UDim2.new(0, 240, 0, 30), TextColor3 = C.red })
		else
			button(r, UI.selected[m.Slot] and "✓ Elegido" or "Fusión", function()
				if UI.selected[m.Slot] then
					UI.selected[m.Slot] = nil
				else
					local n = 0
					for _ in pairs(UI.selected) do
						n = n + 1
					end
					if n >= 2 then
						UI.selected = {}
					end
					UI.selected[m.Slot] = true
				end
				UI.refresh(true)
			end, { Position = UDim2.new(1, -236, 0, 6), Size = UDim2.new(0, 100, 0, 38), BackgroundColor3 = UI.selected[m.Slot] and C.purple or C.card })
			button(r, "Vender " .. Util.short(m.Value), function()
				Net.call("Lab.Sell", { slot = m.Slot })
				UI.selected[m.Slot] = nil
				UI.refresh(true)
			end, { Position = UDim2.new(1, -128, 0, 6), Size = UDim2.new(0, 128, 0, 38), BackgroundColor3 = C.red })
		end
	end
end

renderers.fusion = function(s, st)
	label(s, "Fusiona dos mutantes de la misma especie y nivel: obtienes uno de nivel superior que produce x" .. Config.LevelIncomeMult .. ". Se conserva la mejor mutación. Nivel máximo: " .. Config.MaxLevel .. ".", { Size = UDim2.new(1, 0, 0, 60), TextColor3 = C.sub, TextSize = 14 })
	local f = st.Fusion
	if f then
		local r = row(s, 70)
		label(r, "En la cámara: " .. f.Name, { TextColor3 = C.purple })
		label(r, f.Ready and "¡Lista para recoger!" or ("Faltan " .. Util.time(f.Left)), { Position = UDim2.new(0, 0, 0, 26), TextSize = 14, TextColor3 = f.Ready and C.neon or C.sub, Size = UDim2.new(1, -260, 0, 22) })
		if f.Ready then
			button(r, "Recoger", function()
				Net.call("Fusion.Claim")
				UI.refresh(true)
			end, { Position = UDim2.new(1, -250, 0, 10), BackgroundColor3 = C.neon, TextColor3 = C.bg })
		end
		button(r, "Cancelar", function()
			Net.call("Fusion.Cancel")
			UI.refresh(true)
		end, { Position = UDim2.new(1, -124, 0, 10), BackgroundColor3 = C.red })
	end
	-- parejas disponibles
	local groups, orderKeys = {}, {}
	for _, m in ipairs(st.Lab.Mutants) do
		if not m.Carried and m.L < Config.MaxLevel then
			local k = m.S .. "#" .. m.L
			if not groups[k] then
				groups[k] = {}
				orderKeys[#orderKeys + 1] = k
			end
			table.insert(groups[k], m)
		end
	end
	local any = false
	for _, k in ipairs(orderKeys) do
		local g = groups[k]
		if #g >= 2 then
			any = true
			local r = row(s, 56)
			local sp = MutantData.SpeciesById[g[1].S]
			label(r, sp.Name .. " Nv." .. g[1].L .. "  ×" .. #g, { Size = UDim2.new(1, -170, 0, 22), TextColor3 = rgb(MutantData.RarityById[sp.Rarity].Color) })
			label(r, "Resultado: Nv." .. (g[1].L + 1), { Position = UDim2.new(0, 0, 0, 22), TextSize = 13, TextColor3 = C.sub, Size = UDim2.new(1, -170, 0, 20) })
			button(r, "🧬 Fusionar", function()
				Net.call("Fusion.Start", { a = g[1].Slot, b = g[2].Slot })
				UI.refresh(true)
			end, { Position = UDim2.new(1, -150, 0, 4), Size = UDim2.new(0, 150, 0, 38), BackgroundColor3 = C.purple })
		end
	end
	if not any then
		label(s, "No tienes parejas iguales todavía. Compra o roba otro mutante de la misma especie.", { Size = UDim2.new(1, 0, 0, 44), TextColor3 = C.sub })
	end
end

renderers.upgrades = function(s, st)
	local lab = st.Lab
	local r = row(s, 76)
	label(r, "🏗 " .. lab.TierName .. " (nivel " .. lab.Tier .. ")", { TextColor3 = C.gold })
	local nt = st.NextTier
	if nt then
		label(r, "Siguiente: " .. nt.Name .. " · " .. nt.Slots .. " pedestales · tanque " .. Util.short(nt.Tank) .. " · láser " .. nt.Laser .. " s", { Position = UDim2.new(0, 0, 0, 24), TextSize = 13, TextColor3 = C.sub, Size = UDim2.new(1, -170, 0, 36) })
		button(r, "Mejorar " .. Util.short(nt.Cost), function()
			Net.call("Lab.Upgrade")
			UI.refresh(true)
		end, { Position = UDim2.new(1, -160, 0, 16), Size = UDim2.new(0, 160, 0, 40), BackgroundColor3 = st.Credits >= nt.Cost and C.neon or C.card, TextColor3 = st.Credits >= nt.Cost and C.bg or C.text })
	else
		label(r, "¡Laboratorio al máximo!", { Position = UDim2.new(0, 0, 0, 26), TextColor3 = C.neon })
	end
	label(s, "🔬 Investigación", { TextColor3 = C.blue })
	for _, res in ipairs(st.Research) do
		local rr = row(s, 62)
		label(rr, res.Name .. "  (" .. res.Level .. "/" .. res.Max .. ")", { Size = UDim2.new(1, -170, 0, 22) })
		label(rr, res.Desc, { Position = UDim2.new(0, 0, 0, 24), TextSize = 13, TextColor3 = C.sub, Size = UDim2.new(1, -170, 0, 30) })
		if res.Cost then
			button(rr, Util.short(res.Cost), function()
				Net.call("Lab.Research", { id = res.Id })
				UI.refresh(true)
			end, { Position = UDim2.new(1, -150, 0, 6), Size = UDim2.new(0, 150, 0, 38), BackgroundColor3 = st.Credits >= res.Cost and C.blue or C.card })
		else
			label(rr, "MÁX", { Position = UDim2.new(1, -150, 0, 14), Size = UDim2.new(0, 150, 0, 24), TextColor3 = C.neon, TextXAlignment = Enum.TextXAlignment.Center })
		end
	end
	label(s, "🛡 Defensas", { TextColor3 = C.red })
	for _, id in ipairs({ "trap", "alarm", "drone" }) do
		local def = LabData.Defenses[id]
		local rr = row(s, 70)
		local status = id == "trap" and (lab.Traps .. "/" .. math.min(lab.Tier, 5)) or ((id == "alarm" and lab.Alarm or id == "drone" and lab.Drone) and "instalada" or "no instalada")
		label(rr, def.Name .. " (" .. status .. ")", { Size = UDim2.new(1, -170, 0, 22) })
		label(rr, def.Desc, { Position = UDim2.new(0, 0, 0, 24), TextSize = 13, TextColor3 = C.sub, Size = UDim2.new(1, -170, 0, 40) })
		local owned = (id == "alarm" and lab.Alarm) or (id == "drone" and lab.Drone) or (id == "trap" and lab.Traps >= math.min(lab.Tier, 5))
		if not owned then
			button(rr, Util.short(def.Cost), function()
				Net.call("Lab.Defense", { id = id })
				UI.refresh(true)
			end, { Position = UDim2.new(1, -150, 0, 10), Size = UDim2.new(0, 150, 0, 38), BackgroundColor3 = st.Credits >= def.Cost and C.red or C.card })
		end
	end
end

renderers.index = function(s, st)
	local found = 0
	for _, e in ipairs(st.Index) do
		if e.Count > 0 then
			found = found + 1
		end
	end
	label(s, "Especies descubiertas: " .. found .. "/" .. #st.Index .. " (cada especie nueva da una recompensa)", { TextColor3 = C.gold })
	for _, e in ipairs(st.Index) do
		local rar = MutantData.RarityById[e.Rarity]
		local r = row(s, 48)
		if e.Count > 0 then
			label(r, e.Name .. "  ·  conseguidos: " .. e.Count, { TextColor3 = rgb(rar.Color), Size = UDim2.new(1, 0, 0, 20) })
			label(r, rar.Name .. " · precio " .. Util.short(e.Price) .. " · +" .. Util.short(e.Income) .. "/s", { Position = UDim2.new(0, 0, 0, 20), TextSize = 13, TextColor3 = C.sub })
		else
			label(r, "???", { TextColor3 = C.sub, Size = UDim2.new(1, 0, 0, 20) })
			label(r, rar.Name .. " · sin descubrir", { Position = UDim2.new(0, 0, 0, 20), TextSize = 13, TextColor3 = rgb(rar.Color) })
		end
	end
end

renderers.shop = function(s, st)
	label(s, "Compras opcionales con Robux. El juego se puede completar sin pagar.", { TextColor3 = C.sub, Size = UDim2.new(1, 0, 0, 40) })
	local shop = st.Shop or { Passes = {}, Products = {} }
	local function item(name, desc, key, configured, owned)
		local r = row(s, 62)
		label(r, name, { Size = UDim2.new(1, -170, 0, 22), TextColor3 = C.gold })
		label(r, desc, { Position = UDim2.new(0, 0, 0, 24), TextSize = 13, TextColor3 = C.sub, Size = UDim2.new(1, -170, 0, 30) })
		if owned then
			label(r, "✓ Tuyo", { Position = UDim2.new(1, -150, 0, 14), Size = UDim2.new(0, 150, 0, 24), TextColor3 = C.neon })
		elseif configured then
			button(r, "Comprar", function()
				Net.call("Shop.Prompt", { key = key })
			end, { Position = UDim2.new(1, -150, 0, 8), Size = UDim2.new(0, 150, 0, 38), BackgroundColor3 = C.gold, TextColor3 = C.bg })
		else
			label(r, "No disponible todavía", { Position = UDim2.new(1, -170, 0, 14), Size = UDim2.new(0, 170, 0, 24), TextColor3 = C.sub, TextSize = 13 })
		end
	end
	for _, p in ipairs(shop.Passes) do
		item("⭐ " .. p.Name, p.Desc, p.Key, p.Configured, p.Owned)
	end
	for _, p in ipairs(shop.Products) do
		item("💰 " .. p.Name, p.Minutes .. " minutos de tu producción (mínimo " .. Util.short(p.Min) .. ")", p.Key, p.Configured, false)
	end
end

renderers.help = function(s, st)
	local lines = {
		"🧪 Compra cápsulas en la cinta del centro: cada una trae un mutante que produce créditos por segundo.",
		"🛢 La producción se guarda en el TANQUE de tu laboratorio. Ve al colector (centro de tu laboratorio) para recogerla. ¡Si se llena, deja de subir!",
		"🧬 Fusiona dos mutantes iguales del mismo nivel en la cámara de fusión para subirlos de nivel.",
		"🏃 Puedes robar mutantes de otros laboratorios: mantén pulsado el aviso del pedestal y llévalo a la zona de llegada de TU laboratorio. Irás más lento.",
		"🛡 Defiéndete: activa la puerta láser (botón rojo junto a la puerta), compra trampas de baba, alarma y el dron guardián. Si alguien te roba, tócale para recuperarlo.",
		"⚡ Atento a los eventos: tormenta radiactiva, fiebre de cápsulas, hora legendaria y doble producción.",
	}
	for _, l in ipairs(lines) do
		label(s, l, { Size = UDim2.new(1, 0, 0, 52), TextSize = 14 })
	end
	button(s, "🏠 Volver a mi laboratorio", function()
		Net.call("Lab.Home")
	end, { Size = UDim2.new(1, 0, 0, 42), BackgroundColor3 = C.neon, TextColor3 = C.bg })
	button(s, UI.hideGuide and "Mostrar guía de inicio" or "Ocultar guía de inicio", function()
		UI.hideGuide = not UI.hideGuide
		UI.refresh(true)
	end, { Size = UDim2.new(1, 0, 0, 42), BackgroundColor3 = C.card2 })
end

function UI.renderPanel()
	if not panel or not UI.open then
		return
	end
	for _, c in ipairs(body:GetChildren()) do
		c:Destroy()
	end
	for _, b in ipairs(tabsBar:GetChildren()) do
		if b:IsA("TextButton") then
			b.BackgroundColor3 = b:GetAttribute("Tab") == UI.tab and C.purple or C.card2
		end
	end
	local st = UI.state
	local s = list(body)
	if not st or not st.Lab then
		label(s, "Cargando tu laboratorio...", { TextColor3 = C.sub })
		return
	end
	renderers[UI.tab](s, st)
	lastSig = signature()
end

function UI.openPanel(tab)
	UI.tab = tab or UI.tab
	UI.open = true
	panel.Visible = true
	UI.renderPanel()
end

function UI.closePanel()
	UI.open = false
	panel.Visible = false
end

-------------------------------------------------------------------- HUD
local function guideText(st)
	if UI.hideGuide or not st or not st.Lab then
		return nil
	end
	local stats = st.Stats or {}
	if (stats.Bought or 0) == 0 then
		return "1/5 · Ve a la cinta del centro y compra tu primera cápsula (E / toca el aviso)."
	elseif (stats.Earned or 0) == 0 then
		return "2/5 · Espera a que se llene el tanque y recoge los créditos en el colector de tu laboratorio."
	elseif #st.Lab.Mutants < 3 then
		return "3/5 · Compra más mutantes: los raros producen mucho más."
	elseif (stats.Fusions or 0) == 0 then
		return "4/5 · Consigue dos mutantes iguales y fusiónalos en la cámara de fusión."
	elseif st.Lab.Tier < 2 then
		return "5/5 · Mejora tu laboratorio en la terminal para tener más pedestales."
	end
	return nil
end

function UI.refresh(force)
	local st = UI.state
	if not st or not hud then
		return
	end
	local lab = st.Lab
	hudLabels.credits.Text = "💰 " .. Util.short(st.Credits)
	if lab then
		hudLabels.income.Text = "+" .. Util.short(lab.Income) .. "/s"
		hudLabels.lab.Text = "🔬 " .. lab.TierName .. " · " .. #lab.Mutants .. "/" .. lab.Slots
		local frac = lab.TankCap > 0 and lab.Tank / lab.TankCap or 0
		hudLabels.tankFill.Size = UDim2.new(math.min(1, frac), 0, 1, 0)
		hudLabels.tank.Text = "🛢 Tanque " .. Util.short(lab.Tank) .. " / " .. Util.short(lab.TankCap) .. (frac >= 1 and "  ¡LLENO! Recoge en el colector" or "")
		hudLabels.tankFill.BackgroundColor3 = frac >= 1 and C.red or C.neon
		if lab.LaserLeft > 0 then
			hudLabels.laser.Text = "🛡 Láser " .. math.ceil(lab.LaserLeft) .. " s"
			hudLabels.laser.BackgroundColor3 = C.neon
		elseif lab.LaserReady > 0 then
			hudLabels.laser.Text = "🛡 Recarga " .. math.ceil(lab.LaserReady) .. " s"
			hudLabels.laser.BackgroundColor3 = C.card2
		else
			hudLabels.laser.Text = "🛡 Activar láser"
			hudLabels.laser.BackgroundColor3 = C.red
		end
	end
	local ev = st.Event
	if ev and ev.Name then
		eventBar.Visible = true
		eventBar.Text.Text = "⚡ " .. ev.Name .. ": " .. ev.Desc .. " (" .. Util.time(ev.Left) .. ")"
	else
		eventBar.Visible = false
	end
	carryBar.Visible = st.Carrying ~= nil
	if st.Carrying then
		carryBar.Text.Text = "🏃 Llevas " .. st.Carrying .. ": ¡corre a la zona de llegada de tu laboratorio!"
	end
	local g = guideText(st)
	guide.Visible = g ~= nil
	if g then
		guide.Text.Text = "🎯 " .. g
	end
	if UI.open and (force or signature() ~= lastSig) then
		UI.renderPanel()
	end
end

function UI.setState(st)
	UI.state = st
	UI.refresh(false)
end

function UI.alert(data)
	alertBar.Visible = data and data.on or false
	if data and data.on then
		alertBar.Text.Text = "🚨 ¡" .. tostring(data.thief) .. " te está robando " .. tostring(data.name) .. "! Persíguele y tócale."
	end
end

function UI.build()
	gui = new("ScreenGui", { Name = "LabMutanteUI", ResetOnSpawn = false, IgnoreGuiInset = false }, player:WaitForChild("PlayerGui"))
	local cam = workspace.CurrentCamera
	local vw = cam and cam.ViewportSize.X or 1280
	new("UIScale", { Scale = vw < 700 and 0.75 or 1 }, gui)

	hud = new("Frame", { Name = "HUD", BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0) }, gui)
	-- créditos (arriba al centro)
	local top = frame(hud, { Size = UDim2.new(0, 300, 0, 64), Position = UDim2.new(0.5, -150, 0, 8), BackgroundColor3 = C.bg, BackgroundTransparency = 0.15 })
	new("UIStroke", { Color = C.neon, Thickness = 2 }, top)
	hudLabels.credits = label(top, "💰 0", { Size = UDim2.new(1, 0, 0, 36), TextXAlignment = Enum.TextXAlignment.Center, TextSize = 26, Font = Enum.Font.GothamBlack, TextColor3 = C.gold })
	hudLabels.income = label(top, "+0/s", { Size = UDim2.new(1, 0, 0, 22), Position = UDim2.new(0, 0, 0, 36), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.neon })
	-- tarjeta del laboratorio (arriba a la izquierda)
	local card = frame(hud, { Size = UDim2.new(0, 330, 0, 74), Position = UDim2.new(0, 10, 0, 8), BackgroundColor3 = C.bg, BackgroundTransparency = 0.15 })
	new("UIPadding", { PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10), PaddingTop = UDim.new(0, 6) }, card)
	hudLabels.lab = label(card, "🔬 Laboratorio", { TextSize = 15 })
	local bar = frame(card, { Size = UDim2.new(1, 0, 0, 12), Position = UDim2.new(0, 0, 0, 28), BackgroundColor3 = C.card2 })
	hudLabels.tankFill = frame(bar, { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = C.neon })
	hudLabels.tank = label(card, "🛢 Tanque", { Position = UDim2.new(0, 0, 0, 42), TextSize = 13, TextColor3 = C.sub })
	-- banners
	local function banner(name, y, color)
		local b = frame(hud, { Name = name, Size = UDim2.new(0, 560, 0, 40), Position = UDim2.new(0.5, -280, 0, y), BackgroundColor3 = color, Visible = false })
		label(b, "", { Name = "Text", Size = UDim2.new(1, -16, 1, 0), Position = UDim2.new(0, 8, 0, 0), TextXAlignment = Enum.TextXAlignment.Center, TextSize = 15 })
		return b
	end
	eventBar = banner("Event", 80, Color3.fromRGB(80, 50, 140))
	alertBar = banner("Alert", 126, Color3.fromRGB(170, 30, 50))
	carryBar = banner("Carry", 126, Color3.fromRGB(30, 120, 70))
	guide = banner("Guide", 172, Color3.fromRGB(30, 60, 110))
	guide.Size = UDim2.new(0, 560, 0, 46)
	-- avisos (derecha)
	notes = new("Frame", { Name = "Notes", BackgroundTransparency = 1, Size = UDim2.new(0, 340, 0, 300), Position = UDim2.new(1, -350, 0, 8) }, hud)
	new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, notes)
	-- botones (abajo)
	local bottom = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0, 740, 0, 52), Position = UDim2.new(0.5, -370, 1, -64) }, hud)
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center }, bottom)
	local function hb(text, fn, color)
		return button(bottom, text, fn, { Size = UDim2.new(0, 114, 0, 50), BackgroundColor3 = color or C.card2, TextSize = 14 })
	end
	hb("🔬 Laboratorio", function()
		UI.openPanel("mutants")
	end, C.purple)
	hudLabels.laser = hb("🛡 Activar láser", function()
		Net.call("Lab.Laser")
	end, C.red)
	hb("🧬 Fusión", function()
		UI.openPanel("fusion")
	end)
	hb("📖 Bestiario", function()
		UI.openPanel("index")
	end)
	hb("🏠 A casa", function()
		Net.call("Lab.Home")
	end)
	hb("❓ Ayuda", function()
		UI.openPanel("help")
	end)

	-- panel
	panel = frame(gui, { Name = "Panel", Size = UDim2.new(0, 640, 0, 470), Position = UDim2.new(0.5, -320, 0.5, -250), BackgroundColor3 = C.bg, Visible = false })
	new("UIStroke", { Color = C.purple, Thickness = 2 }, panel)
	new("UISizeConstraint", { MaxSize = Vector2.new(640, 470) }, panel)
	tabsBar = new("Frame", { Name = "Tabs", BackgroundTransparency = 1, Size = UDim2.new(1, -60, 0, 44), Position = UDim2.new(0, 8, 0, 8) }, panel)
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 4) }, tabsBar)
	for _, t in ipairs(TABS) do
		local b = button(tabsBar, t[2], function()
			UI.openPanel(t[1])
		end, { Size = UDim2.new(0, 94, 0, 40), TextSize = 12, BackgroundColor3 = C.card2 })
		b:SetAttribute("Tab", t[1])
	end
	button(panel, "✕", function()
		UI.closePanel()
	end, { Size = UDim2.new(0, 44, 0, 40), Position = UDim2.new(1, -52, 0, 8), BackgroundColor3 = C.red })
	body = new("Frame", { Name = "Body", BackgroundTransparency = 1, Size = UDim2.new(1, -24, 1, -72), Position = UDim2.new(0, 12, 0, 60) }, panel)
end

UI.renderers = renderers
UI.TABS = TABS
return UI
