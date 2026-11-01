--!nonstrict
-- App Empresa: funda tu productora (nombre y logotipo), gestiona su cuenta, contrata y despide personal,
-- acepta encargos de clientes y consulta el informe de ingresos, gastos y contratos.
-- Todo lo decide el servidor (CompanyService); la app solo pide acciones y muestra el estado.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Client = script.Parent.Parent
local UI = require(Client.UIKit)
local Net = require(Client.Net)
local State = require(Client.State)
local Notify = require(Client.Notify)
local LifeData = require(Shared.LifeData)
local PropertyData = require(Shared.PropertyData)
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)
local T = UI.Theme

local App = { Id = "company", Name = "Empresa", Icon = "🏢", Order = 8, Surfaces = { pc = true, phone = true, panel = true }, Width = 900, Height = 580 }

local function catName(id)
	local c = VideoData.CategoryById[id]
	return c and c.Name or tostring(id)
end

local function clientOf(idx)
	return LifeData.Clients[idx] or { Name = "Cliente", Icon = "🏢", Field = "", Cats = {} }
end

local function roleOf(id)
	return LifeData.RoleById[id] or { Name = tostring(id), Effect = "" }
end

local function hasCompany(data)
	return type(data.Company) == "table" and type(data.Company.Name) == "string"
end

local function logo(parent, emoji, color, size)
	local col = LifeData.CompanyColors[color] or LifeData.CompanyColors[1]
	local f = UI.frame(parent, { Size = UDim2.fromOffset(size, size), Color = UI.rgb(col[2]), Radius = 10 })
	UI.label(f, LifeData.CompanyEmojis[emoji] or "🏢", { Size = UDim2.fromScale(1, 1), Align = Enum.TextXAlignment.Center, TextSize = math.floor(size * 0.55) })
	return f
end

local function money(n)
	return "$" .. Util.formatInt(n or 0)
end

function App.build(container, ctx)
	local tab = ctx.params.tab or "panel"
	local form = { name = "", emoji = 1, color = 1 }
	local amount = 1000
	local logoEdit = nil
	task.spawn(Net.call, "Company.Refresh", {}, { silent = true })

	local render

	-- Pantalla de fundación
	local function founding(data)
		local s = UI.scroll(container, { Pad = 8 })
		UI.title(s, "🏢 Funda tu productora")
		UI.label(s, "Una empresa propia con cuenta separada, empleados que mejoran tus vídeos de verdad y clientes que encargan producciones.", { TextSize = 13, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		local req = LifeData.CompanyReq
		local okLevel = data.Level >= req.Level
		local okSubs = data.Channel.Subs >= req.Subs
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, "Requisitos (basta con uno):", { Font = Enum.Font.GothamBold })
		UI.label(card, (okLevel and "✅" or "❌") .. " Nivel " .. req.Level .. " (tienes " .. data.Level .. ")", { TextSize = 13, Color = okLevel and T.Ok or T.Sub })
		UI.label(card, (okSubs and "✅" or "❌") .. " " .. Util.formatInt(req.Subs) .. " suscriptores (tienes " .. Util.formatInt(data.Channel.Subs) .. ")", { TextSize = 13, Color = okSubs and T.Ok or T.Sub })
		local box = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		local nb = UI.input(box, "Nombre de la empresa (3-30 caracteres)", form.name)
		nb:GetPropertyChangedSignal("Text"):Connect(function()
			form.name = nb.Text
		end)
		local preview = UI.row(box, 64)
		logo(preview, form.emoji, form.color, 60)
		UI.label(preview, (form.name ~= "" and form.name or "Tu productora") .. "\nLogotipo ficticio: " .. LifeData.CompanyColors[form.color][1], { Size = UDim2.new(1, -80, 1, 0), TextSize = 14, Font = Enum.Font.GothamBold })
		UI.cycle(box, "Símbolo", LifeData.CompanyEmojis, form.emoji, function(i)
			form.emoji = i
			render()
		end, { ValueWidth = 80 })
		local colorNames = {}
		for i, c in ipairs(LifeData.CompanyColors) do
			colorNames[i] = c[1]
		end
		UI.cycle(box, "Color", colorNames, form.color, function(i)
			form.color = i
			render()
		end, { ValueWidth = 120 })
		UI.button(box, "🏢 Fundar empresa", function()
			Net.call("Company.Create", { name = form.name, emoji = form.emoji, color = form.color })
		end, { Width = 200, Color = (okLevel or okSubs) and T.Ok or T.Panel3 })
		UI.label(s, "Cómo funciona: la empresa tiene su propia cuenta (tú ingresas y retiras). Los salarios se pagan cada 7 días jugados desde esa cuenta; si no hay fondos, baja la moral y tras 2 impagos el empleado se va. Tu dinero personal nunca se usa sin que tú lo ingreses.", { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
	end

	local function panelTab(s, data, c, fx, maxStaff, tierIdx, tier, nextTier)
		local head = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		local hr = UI.row(head, 72)
		logo(hr, c.Emoji, c.Color, 66)
		UI.label(hr, c.Name .. "\n" .. tier.Name .. " · " .. c.Contracts .. " contratos cumplidos", { Size = UDim2.new(1, -80, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 16 })
		if nextTier then
			UI.label(head, "Siguiente nivel: «" .. nextTier.Name .. "» con " .. nextTier.Contracts .. " contratos (máx. " .. nextTier.MaxStaff .. " empleados).", { TextSize = 12, Color = T.Sub })
			UI.progress(head, c.Contracts / nextTier.Contracts, T.Accent2, { Height = 8 })
		else
			UI.label(head, "¡Nivel máximo de empresa!", { TextSize = 12, Color = T.Gold })
		end
		UI.label(head, "⭐ Reputación de empresa: " .. math.floor(c.Rep) .. "/100" .. (c.Rep < 20 and " (los clientes desconfían: solo 1 oferta al día)" or ""), { Font = Enum.Font.GothamBold, Color = T.Gold })
		UI.progress(head, c.Rep / 100, T.Gold, { Height = 8 })

		-- Cuenta
		local acc = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(acc, "💼 Cuenta de la empresa: " .. money(c.Funds) .. "  ·  Tu dinero: " .. money(data.Money), { Font = Enum.Font.GothamBold, TextSize = 15 })
		local payroll = 0
		for _, e in pairs(c.Staff) do
			payroll = payroll + e.Salary
		end
		local daysLeft = math.max(0, (c.NextPay or 0) - data.Home.PlayDays)
		UI.label(acc, "Nóminas semanales: " .. money(payroll) .. " · próximo pago en " .. daysLeft .. " día(s) de juego", { TextSize = 12, Color = (payroll > c.Funds) and T.Warn or T.Sub })
		if payroll > c.Funds then
			UI.label(acc, "⚠️ Los fondos no cubren las nóminas: ingresa dinero o la moral bajará.", { TextSize = 12, Color = T.Warn })
		end
		UI.stepper(acc, "Cantidad", amount, 100, 1000000, 500, function(v)
			amount = v
		end, { Format = function(v)
			return money(v)
		end })
		local ar = UI.row(acc, 34)
		UI.button(ar, "⬆ Ingresar", function()
			Net.call("Company.Deposit", { amount = amount })
		end, { Width = 130, Color = T.Ok })
		UI.button(ar, "⬇ Retirar", function()
			Net.call("Company.Withdraw", { amount = amount })
		end, { Width = 130, Color = T.Accent2 })
		UI.button(ar, "Retirar todo", function()
			if c.Funds > 0 then
				Notify.confirm("¿Retirar " .. money(c.Funds) .. " de la cuenta de " .. c.Name .. " a tu dinero personal?", function()
					Net.call("Company.Withdraw", { amount = c.Funds })
				end, "Retirar")
			else
				Notify.toast("La cuenta de la empresa está vacía.", "info")
			end
		end, { Width = 130 })

		-- Plantilla y efectos
		local eff = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		local office = LifeData.hasOffice(data.Properties, PropertyData.ById)
		UI.label(eff, "👥 Plantilla: " .. State.count(c.Staff) .. "/" .. maxStaff .. (office and " (incluye +" .. LifeData.CompanyOfficeBonus .. " por tu local o estudio)" or " · un local de negocio o un estudio da +" .. LifeData.CompanyOfficeBonus), { Font = Enum.Font.GothamBold, TextSize = 13 })
		local lines = {}
		if fx.exportMult < 1 then
			lines[#lines + 1] = "🎞 Exportación −" .. math.floor((1 - fx.exportMult) * 100 + 0.5) .. "%"
		end
		if fx.sceneBonus > 0 then
			lines[#lines + 1] = "🎥 +" .. fx.sceneBonus .. " de calidad por escena"
		end
		if fx.thumbBonus > 0 then
			lines[#lines + 1] = "🖼 +" .. fx.thumbBonus .. " en miniaturas"
		end
		if fx.energyMult < 1 then
			lines[#lines + 1] = "⚡ −25% de gasto de energía"
		end
		if fx.sponsorExtra > 0 then
			lines[#lines + 1] = "🤝 +1 oferta de patrocinio y de cliente, +10% de pago"
		end
		if fx.repairMult < 1 then
			lines[#lines + 1] = "🔧 Reparaciones a mitad de precio"
		end
		if fx.photoIncome > 0 then
			lines[#lines + 1] = "📷 Venta de fotos: +" .. money(fx.photoIncome) .. "/día"
		end
		UI.label(eff, #lines > 0 and ("Efectos activos: " .. table.concat(lines, " · ")) or "Sin efectos todavía: contrata personal en la pestaña Empleados.", { TextSize = 12, Color = #lines > 0 and T.Ok or T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })

		-- Logotipo
		local lg = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		if logoEdit then
			local colorNames = {}
			for i, col in ipairs(LifeData.CompanyColors) do
				colorNames[i] = col[1]
			end
			local pr = UI.row(lg, 50)
			logo(pr, logoEdit.emoji, logoEdit.color, 46)
			UI.cycle(lg, "Símbolo", LifeData.CompanyEmojis, logoEdit.emoji, function(i)
				logoEdit.emoji = i
				render()
			end, { ValueWidth = 80 })
			UI.cycle(lg, "Color", colorNames, logoEdit.color, function(i)
				logoEdit.color = i
				render()
			end, { ValueWidth = 120 })
			local lr = UI.row(lg, 34)
			UI.button(lr, "💾 Guardar logotipo", function()
				local r = Net.call("Company.SetLogo", { emoji = logoEdit.emoji, color = logoEdit.color })
				if r.ok then
					logoEdit = nil
					render()
				end
			end, { Width = 180, Color = T.Ok })
			UI.button(lr, "Cancelar", function()
				logoEdit = nil
				render()
			end, { Width = 110 })
		else
			UI.button(lg, "🎨 Cambiar logotipo", function()
				logoEdit = { emoji = c.Emoji, color = c.Color }
				render()
			end, { Width = 180, Height = 28, TextSize = 12 })
		end
	end

	local function staffTab(s, data, c, maxStaff)
		UI.title(s, "👥 Tu equipo (" .. State.count(c.Staff) .. "/" .. maxStaff .. ")")
		local list = {}
		for _, e in pairs(c.Staff) do
			list[#list + 1] = e
		end
		table.sort(list, function(a, b)
			return (a.N or 0) < (b.N or 0)
		end)
		if #list == 0 then
			UI.label(s, "Aún no tienes empleados. Elige un candidato de hoy.", { Color = T.Sub })
		end
		for _, e in ipairs(list) do
			local role = roleOf(e.Role)
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = (e.Missed or 0) > 0 and Color3.fromRGB(80, 45, 35) or T.Panel2 })
			UI.label(card, e.Name .. " · " .. role.Name .. " · habilidad " .. e.Skill, { Font = Enum.Font.GothamBold })
			UI.label(card, "Efecto: " .. LifeData.employeeEffect(e), { TextSize = 12, Color = T.Ok })
			UI.label(card, "Salario " .. money(e.Salary) .. "/semana · moral " .. math.floor(e.Morale or 70) .. "/100" .. ((e.Missed or 0) > 0 and (" · ⚠️ " .. e.Missed .. " salario impagado") or ""), { TextSize = 12, Color = T.Sub })
			UI.progress(card, (e.Morale or 70) / 100, (e.Morale or 70) >= 40 and T.Ok or T.Warn, { Height = 6 })
			UI.button(card, "Despedir", function()
				Notify.confirm("¿Despedir a " .. e.Name .. "? La empresa pagará una indemnización de 1 semana (" .. money(e.Salary) .. ").", function()
					Net.call("Company.Fire", { id = e.Id })
				end, "Despedir")
			end, { Width = 110, Height = 26, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		end
		UI.title(s, "📋 Candidatos de hoy")
		UI.label(s, "Salario semanal = (80 + habilidad × 4) × multiplicador del puesto. Se paga cada 7 días jugados con los fondos de la empresa.", { TextSize = 11, Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		local full = State.count(c.Staff) >= maxStaff
		if #(c.Candidates or {}) == 0 then
			UI.label(s, "No quedan candidatos hoy. Mañana llegarán más.", { Color = T.Sub })
		end
		for _, cand in ipairs(c.Candidates or {}) do
			local role = roleOf(cand.Role)
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, cand.Name .. " · " .. role.Name .. " · habilidad " .. cand.Skill, { Font = Enum.Font.GothamBold })
			UI.label(card, role.Effect .. " → " .. LifeData.employeeEffect({ Role = cand.Role, Skill = cand.Skill, Morale = 70 }), { TextSize = 12, Color = T.Ok, Height = 0, Auto = Enum.AutomaticSize.Y })
			local row = UI.row(card, 30)
			UI.label(row, "Salario " .. money(cand.Salary) .. "/semana", { Size = UDim2.new(1, -130, 1, 0), TextSize = 12 })
			UI.button(row, full and "Plantilla llena" or "✅ Contratar", function()
				Net.call("Company.Hire", { id = cand.Id })
			end, { Width = 120, Height = 26, TextSize = 12, Color = full and T.Panel3 or T.Ok })
		end
	end

	local function clientsTab(s, data, c)
		UI.title(s, "📝 Encargos activos (" .. State.count(c.Active) .. "/" .. LifeData.MaxClientContracts .. ")")
		local any = false
		for id, k in pairs(c.Active or {}) do
			any = true
			local cl = clientOf(k.Client)
			local left = k.DueDay - data.Home.PlayDays
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y, Color = left <= 0 and Color3.fromRGB(90, 50, 30) or T.Panel2 })
			UI.label(card, cl.Icon .. " " .. cl.Name .. " · " .. cl.Field, { Font = Enum.Font.GothamBold })
			UI.label(card, "Vídeo de " .. catName(k.Category) .. " con calidad " .. k.MinQ .. "+ · " .. (left >= 0 and ("quedan " .. left .. " días de juego") or "¡fuera de plazo!"), { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "Pago a la empresa " .. money(k.Pay) .. " (+" .. money(k.Bonus) .. " si la calidad supera " .. (k.MinQ + 15) .. ")", { TextSize = 12, Color = T.Ok })
			UI.label(card, "Al publicar en ViewTube Studio elige este encargo en «Cliente de la empresa».", { TextSize = 11, Color = T.Sub })
			local row = UI.row(card, 30)
			UI.button(row, "🎬 Crear proyecto", function()
				Net.call("Video.CreateProject", { category = k.Category, name = cl.Name .. " · encargo" })
			end, { Width = 150, Height = 26, TextSize = 12, Color = T.Accent2 })
			UI.button(row, "Cancelar encargo", function()
				Notify.confirm("¿Cancelar el encargo de " .. cl.Name .. "? La reputación de la empresa bajará 5 puntos (incumplirlo cuesta 10).", function()
					Net.call("Company.CancelClient", { id = id })
				end, "Cancelar encargo")
			end, { Width = 150, Height = 26, TextSize = 12, Color = Color3.fromRGB(110, 40, 40) })
		end
		if not any then
			UI.label(s, "Ninguno.", { Color = T.Sub })
		end
		UI.title(s, "📨 Ofertas de clientes de hoy")
		if #(c.Offers or {}) == 0 then
			UI.label(s, "No hay ofertas ahora. Llegan nuevas cada día de juego (más con buena reputación y un gestor).", { Color = T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		for _, o in ipairs(c.Offers or {}) do
			local cl = clientOf(o.Client)
			local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, cl.Icon .. " " .. cl.Name .. " (" .. cl.Field .. ")", { Font = Enum.Font.GothamBold })
			UI.label(card, "Pide: vídeo de " .. catName(o.Category) .. ", calidad " .. o.MinQ .. "+, en " .. o.Days .. " días de juego.", { TextSize = 12, Height = 0, Auto = Enum.AutomaticSize.Y })
			UI.label(card, "Pago " .. money(o.Pay) .. " + bonus " .. money(o.Bonus) .. " (a la cuenta de la empresa) · incumplir: −10 de reputación de empresa", { TextSize = 12, Color = T.Ok, Height = 0, Auto = Enum.AutomaticSize.Y })
			local row = UI.row(card, 30)
			UI.button(row, "✅ Aceptar", function()
				Net.call("Company.AcceptClient", { id = o.Id })
			end, { Width = 110, Height = 26, Color = T.Ok })
			UI.button(row, "Rechazar", function()
				Net.call("Company.DeclineClient", { id = o.Id })
			end, { Width = 100, Height = 26 })
		end
	end

	local function reportTab(s, data, c)
		local rp = c.Report or { Inc = {}, Exp = {} }
		local inc, exp = 0, 0
		local card = UI.card(s, { Height = 0, Auto = Enum.AutomaticSize.Y })
		UI.label(card, "📈 Ingresos", { Font = Enum.Font.GothamBold, Color = T.Ok })
		for cat, v in pairs(rp.Inc or {}) do
			inc = inc + v
			UI.label(card, "  " .. cat .. ": " .. money(v), { TextSize = 12 })
		end
		UI.label(card, "📉 Gastos", { Font = Enum.Font.GothamBold, Color = T.Err })
		for cat, v in pairs(rp.Exp or {}) do
			exp = exp + v
			UI.label(card, "  " .. cat .. ": " .. money(v), { TextSize = 12 })
		end
		UI.label(card, "Resultado: " .. money(inc - exp) .. " (ingresos " .. money(inc) .. ", gastos " .. money(exp) .. ")", { Font = Enum.Font.GothamBold, Color = inc >= exp and T.Ok or T.Warn })
		UI.label(card, "Aportaciones del dueño " .. money(rp.Deposits) .. " · retiradas " .. money(rp.Withdrawals), { TextSize = 12, Color = T.Sub })
		UI.label(card, "Contratos cumplidos " .. (c.Contracts or 0) .. " · incumplidos o cancelados " .. (c.Failed or 0) .. " · fundada el día " .. (c.FoundedDay or 0), { TextSize = 12, Color = T.Sub })
		UI.title(s, "Semanas (ingresos)")
		local vals, labels = {}, {}
		local weeks = c.Weeks or {}
		for i = math.min(8, #weeks), 1, -1 do
			vals[#vals + 1] = weeks[i].Inc
			labels[#labels + 1] = "S" .. weeks[i].W
		end
		UI.bars(s, vals, labels, T.Ok, { Height = 110 })
		vals, labels = {}, {}
		for i = math.min(8, #weeks), 1, -1 do
			vals[#vals + 1] = weeks[i].Exp
			labels[#labels + 1] = "S" .. weeks[i].W
		end
		UI.title(s, "Semanas (gastos)")
		UI.bars(s, vals, labels, T.Err, { Height = 110 })
		UI.title(s, "🗂 Historial")
		for _, h in ipairs(c.History or {}) do
			UI.label(s, "Día " .. (h.D or 0) .. " · " .. h.X, { TextSize = 12, Color = h.K == "ok" and T.Ok or (h.K == "bad" and T.Warn or T.Text), Height = 0, Auto = Enum.AutomaticSize.Y })
		end
		UI.title(s, "💼 Movimientos de la cuenta")
		for _, m in ipairs(c.Ledger or {}) do
			UI.label(s, "Día " .. (m.D or 0) .. " · " .. (m.A >= 0 and "+" or "−") .. money(math.abs(m.A)) .. " · " .. m.X .. " · saldo " .. money(m.B), { TextSize = 12, Color = m.A >= 0 and T.Ok or T.Sub, Height = 0, Auto = Enum.AutomaticSize.Y })
		end
	end

	render = function()
		UI.clear(container)
		local data = State.Data
		if not data then
			return
		end
		if not hasCompany(data) then
			founding(data)
			return
		end
		local c = data.Company
		c.Staff = c.Staff or {}
		c.Active = c.Active or {}
		local fx = LifeData.companyEffects(c)
		local maxStaff = LifeData.companyMaxStaff(c, data.Properties, PropertyData.ById)
		local tierIdx, tier, nextTier = LifeData.companyTier(c.Contracts or 0)
		local top = UI.row(container, 34)
		local tabs = { { "panel", "🏢 Panel" }, { "staff", "👥 Empleados" }, { "clients", "🤝 Clientes" }, { "report", "📊 Informe" } }
		for _, t in ipairs(tabs) do
			UI.button(top, t[2], function()
				tab = t[1]
				render()
			end, { Width = 120, Height = 28, TextSize = 13, Color = tab == t[1] and T.Accent or T.Panel3 })
		end
		local s = UI.scroll(container, { Size = UDim2.new(1, 0, 1, -40), Position = UDim2.fromOffset(0, 40), Pad = 6 })
		if tab == "staff" then
			staffTab(s, data, c, maxStaff)
		elseif tab == "clients" then
			clientsTab(s, data, c)
		elseif tab == "report" then
			reportTab(s, data, c)
		else
			panelTab(s, data, c, fx, maxStaff, tierIdx, tier, nextTier)
		end
	end
	render()
	ctx.onState(render)
end

return App
