--!nonstrict
-- CompanyService: tu propia empresa de producción, con empleados y clientes.
--  * Se funda con nivel 10 o 5.000 suscriptores: nombre (filtrado), logotipo ficticio (emoji + color).
--  * Cuenta propia de la empresa, separada de tu dinero: tú ingresas y retiras. Los salarios, las indemnizaciones
--    y los pagos de clientes se mueven SOLO en esa cuenta (nunca se toca tu dinero personal sin tu permiso).
--  * Reputación de empresa (0-100) y nivel según contratos cumplidos (LifeData.CompanyTiers), que fija el máximo
--    de empleados (+2 si tienes en propiedad o alquiler un local de negocio o un estudio).
--  * Cada día de juego: 6 candidatos deterministas y 3 encargos de clientes ficticios.
--  * Salarios cada 7 días jugados. Sin fondos: la moral baja y tras 2 impagos seguidos el empleado se va.
--  * Efectos reales del personal (los consultan VideoService, NeedsService, SponsorService, InventoryService y
--    VehicleService con `if S.Company then ... end`).
--  * Los encargos se cumplen publicando en ViewTube Studio con «Cliente de la empresa» (Video.Publish con client = id).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local LifeData = require(Shared.LifeData)
local PropertyData = require(Shared.PropertyData)
local VideoData = require(Shared.VideoData)
local Util = require(Shared.Util)

local Company = {}
local S

function Company.Init(services)
	S = services
end

---------------------------------------------------------------------------
-- Estado
---------------------------------------------------------------------------
local function ensure(c)
	c.Funds = c.Funds or 0
	c.Rep = c.Rep or 50
	c.Contracts = c.Contracts or 0
	c.Failed = c.Failed or 0
	c.Staff = c.Staff or {}
	c.Seq = c.Seq or 0
	c.Candidates = c.Candidates or {}
	c.CandDay = c.CandDay or -1
	c.Offers = c.Offers or {}
	c.OffersDay = c.OffersDay or -1
	c.Active = c.Active or {}
	c.NextPay = c.NextPay or 0
	c.Report = c.Report or {}
	c.Report.Inc = c.Report.Inc or {}
	c.Report.Exp = c.Report.Exp or {}
	c.Report.Deposits = c.Report.Deposits or 0
	c.Report.Withdrawals = c.Report.Withdrawals or 0
	c.Weeks = c.Weeks or {}
	c.Ledger = c.Ledger or {}
	c.History = c.History or {}
	return c
end

-- Devuelve la empresa del perfil o nil si no tiene (Company = {} significa sin empresa)
local function companyOf(data)
	local c = data and data.Company
	if type(c) ~= "table" or type(c.Name) ~= "string" then
		return nil
	end
	return ensure(c)
end

function Company.get(player)
	local data = S.Data.get(player)
	return companyOf(data), data
end

function Company.canFound(data)
	return data.Level >= LifeData.CompanyReq.Level or data.Channel.Subs >= LifeData.CompanyReq.Subs
end

function Company.maxStaff(player)
	local c, data = Company.get(player)
	if not c then
		return 0
	end
	return LifeData.companyMaxStaff(c, data.Properties, PropertyData.ById)
end

local function clientName(idx)
	local cl = LifeData.Clients[idx]
	return cl and cl.Name or "Cliente"
end

local function catName(id)
	local c = VideoData.CategoryById[id]
	return c and c.Name or tostring(id)
end

local function roleName(id)
	local r = LifeData.RoleById[id]
	return r and r.Name or tostring(id)
end

local function history(c, day, text, kind)
	Util.pushCapped(c.History, { T = os.time(), D = day, X = text, K = kind or "info" }, 30)
end

-- Movimiento de la cuenta de la empresa. cat = categoría del informe; transfer = aportación/retirada del dueño.
local function move(c, day, amount, cat, text, transfer)
	amount = math.floor(amount + 0.5)
	c.Funds = c.Funds + amount
	if not transfer then
		if amount >= 0 then
			c.Report.Inc[cat] = (c.Report.Inc[cat] or 0) + amount
		else
			c.Report.Exp[cat] = (c.Report.Exp[cat] or 0) - amount
		end
		local week = math.floor(day / 7) + 1
		local w = c.Weeks[1]
		if not w or w.W ~= week then
			w = { W = week, Inc = 0, Exp = 0 }
			Util.pushCapped(c.Weeks, w, 8)
		end
		if amount >= 0 then
			w.Inc = w.Inc + amount
		else
			w.Exp = w.Exp - amount
		end
	end
	Util.pushCapped(c.Ledger, { T = os.time(), D = day, A = amount, C = cat, X = text, B = c.Funds }, 40)
end

local function changeRep(c, delta)
	c.Rep = Util.clamp(c.Rep + delta, 0, 100)
end

local function changeMorale(c, delta)
	for _, e in pairs(c.Staff) do
		e.Morale = Util.clamp((e.Morale or 70) + delta, 0, 100)
	end
end

---------------------------------------------------------------------------
-- Efectos reales del personal (neutros si no hay empresa)
---------------------------------------------------------------------------
function Company.effects(player)
	local data = S.Data.get(player)
	return LifeData.companyEffects(data and companyOf(data) or nil)
end

-- Editor: exportaciones hasta un 25% más rápidas
function Company.exportMult(player)
	return Company.effects(player).exportMult
end

-- Camarógrafo: hasta +4 de calidad por escena
function Company.sceneBonus(player)
	return Company.effects(player).sceneBonus
end

-- Diseñador: hasta +5 en la puntuación de miniaturas
function Company.thumbBonus(player)
	return Company.effects(player).thumbBonus
end

-- Asistente: gastas un 25% menos de energía
function Company.energyMult(player)
	return Company.effects(player).energyMult
end

-- Gestor: +1 oferta de patrocinio y +10% de pago
function Company.sponsorExtra(player)
	return Company.effects(player).sponsorExtra
end

function Company.sponsorMult(player)
	return Company.effects(player).sponsorMult
end

-- Técnico: reparaciones a mitad de precio
function Company.repairMult(player)
	return Company.effects(player).repairMult
end

---------------------------------------------------------------------------
-- Candidatos y ofertas de clientes (deterministas por jugador y día)
---------------------------------------------------------------------------
function Company.candidatesFor(player, day)
	local rng = Random.new(player.UserId * 7907 + day * 104729 + 11)
	local list = {}
	for i = 1, LifeData.CandidatesPerDay do
		local role = LifeData.Roles[rng:NextInteger(1, #LifeData.Roles)]
		local skill = rng:NextInteger(30, 95)
		local name = LifeData.FirstNames[rng:NextInteger(1, #LifeData.FirstNames)] .. " " .. LifeData.LastNames[rng:NextInteger(1, #LifeData.LastNames)]
		list[i] = { Id = "c" .. day .. "_" .. i, Name = name, Role = role.Id, Skill = skill, Salary = LifeData.salaryFor(skill, role.Id) }
	end
	return list
end

local function genOffers(player, c, day)
	c.Offers = {}
	local rng = Random.new(player.UserId * 3571 + day * 92821 + 5)
	local tierIdx = LifeData.companyTier(c.Contracts)
	local fx = LifeData.companyEffects(c)
	-- Con mala reputación casi nadie confía en la empresa
	local n = c.Rep < 20 and 1 or (LifeData.ClientOffersPerDay + fx.clientExtra)
	for i = 1, n do
		local ci = rng:NextInteger(1, #LifeData.Clients)
		local cl = LifeData.Clients[ci]
		local cat = cl.Cats[rng:NextInteger(1, #cl.Cats)]
		local minQ = math.min(80, 30 + tierIdx * 5 + rng:NextInteger(0, 15))
		local pay = (300 + minQ * 15) * (0.6 + c.Rep / 125) * (1 + 0.15 * (tierIdx - 1)) * fx.sponsorMult * rng:NextNumber(0.9, 1.15)
		c.Seq = c.Seq + 1
		c.Offers[i] = {
			Id = "k" .. c.Seq,
			Client = ci,
			Category = cat,
			MinQ = minQ,
			Days = rng:NextInteger(2, 4),
			Pay = math.floor(pay / 5) * 5,
			Bonus = math.floor(pay * 0.25 / 5) * 5,
		}
	end
end

-- Genera candidatos y ofertas del día si aún no existen
function Company.refresh(player)
	local c, data = Company.get(player)
	if not c then
		return
	end
	local day = data.Home.PlayDays
	if c.CandDay ~= day then
		c.CandDay = day
		c.Candidates = Company.candidatesFor(player, day)
	end
	if c.OffersDay ~= day then
		c.OffersDay = day
		genOffers(player, c, day)
	end
end

---------------------------------------------------------------------------
-- Salarios y día nuevo
---------------------------------------------------------------------------
local function sortedStaff(c)
	local list = {}
	for id, e in pairs(c.Staff) do
		list[#list + 1] = e
	end
	table.sort(list, function(a, b)
		return (a.N or 0) < (b.N or 0)
	end)
	return list
end

function Company.payroll(player, c, day)
	local paid, unpaid, left = 0, 0, {}
	for _, e in ipairs(sortedStaff(c)) do
		local days = math.min(LifeData.PayPeriodDays, day - (e.Since or day))
		local due = math.floor(e.Salary * days / LifeData.PayPeriodDays + 0.5)
		if due > 0 then
			if c.Funds >= due then
				move(c, day, -due, "Salarios", "Salario de " .. e.Name .. " (" .. roleName(e.Role) .. ")")
				e.Missed = 0
				e.Morale = Util.clamp((e.Morale or 70) + 5, 0, 100)
				e.Since = day
				paid = paid + due
			else
				e.Missed = (e.Missed or 0) + 1
				e.Morale = Util.clamp((e.Morale or 70) - 30, 0, 100)
				e.Since = day
				unpaid = unpaid + 1
				if e.Missed >= 2 then
					c.Staff[e.Id] = nil
					left[#left + 1] = e.Name
					changeRep(c, -5)
					history(c, day, e.Name .. " (" .. roleName(e.Role) .. ") se fue tras 2 salarios impagados.", "bad")
				else
					history(c, day, "Salario impagado a " .. e.Name .. ": su moral baja.", "bad")
				end
			end
		end
	end
	if paid > 0 then
		history(c, day, "Nóminas pagadas: $" .. Util.formatInt(paid) .. ".", "ok")
		S.Net.notify(player, "🏢 " .. c.Name .. " pagó $" .. Util.formatInt(paid) .. " en salarios.", "info")
	end
	if unpaid > 0 then
		S.Net.notify(player, "⚠️ " .. c.Name .. " no tiene fondos para " .. unpaid .. " salario(s). La moral baja; tras 2 impagos el empleado se va. Ingresa dinero en la app Empresa.", "warn")
	end
	if #left > 0 then
		S.Net.notify(player, "🚪 " .. table.concat(left, ", ") .. " dejó la empresa por impagos. Reputación de empresa −5.", "warn")
	end
	return paid, unpaid, left
end

function Company.onNewDay(player)
	local c, data = Company.get(player)
	if not c then
		return
	end
	local day = data.Home.PlayDays
	-- Fotógrafos: venta diaria de fotos para la empresa
	local fx = LifeData.companyEffects(c)
	if fx.photoIncome > 0 then
		move(c, day, fx.photoIncome, "Venta de fotos", "Venta de fotos del día")
	end
	-- Encargos vencidos
	for id, k in pairs(c.Active) do
		if day > k.DueDay then
			c.Active[id] = nil
			c.Failed = c.Failed + 1
			changeRep(c, -10)
			changeMorale(c, -5)
			history(c, day, "Encargo incumplido: " .. clientName(k.Client) .. " (" .. catName(k.Category) .. ").", "bad")
			S.Net.notify(player, "⚠️ " .. c.Name .. " no entregó el vídeo a " .. clientName(k.Client) .. ". Reputación de empresa −10.", "warn")
		end
	end
	-- Nóminas cada 7 días jugados
	if day >= c.NextPay then
		c.NextPay = day + LifeData.PayPeriodDays
		Company.payroll(player, c, day)
	end
	Company.refresh(player)
	S.Data.markDirty(player)
end

---------------------------------------------------------------------------
-- Clientes (los llama VideoService al publicar)
---------------------------------------------------------------------------
-- Comprueba si un proyecto cumple el encargo. Devuelve el contrato o nil y el motivo.
function Company.checkClient(player, id, proj, quality)
	local c, data = Company.get(player)
	if not c then
		return nil, "No tienes una empresa."
	end
	local k = type(id) == "string" and c.Active[id] or nil
	if not k then
		return nil, "Ese encargo no existe o ya terminó."
	end
	if data.Home.PlayDays > k.DueDay then
		return nil, "El plazo del encargo ha vencido."
	end
	if proj.Category ~= k.Category then
		return nil, clientName(k.Client) .. " pidió un vídeo de " .. catName(k.Category) .. "."
	end
	if quality < k.MinQ then
		return nil, clientName(k.Client) .. " exige calidad " .. k.MinQ .. " (tu vídeo tiene " .. math.floor(quality) .. ")."
	end
	return k
end

function Company.clientLabel(k)
	return clientName(k.Client)
end

function Company.completeClient(player, id, quality, videoId)
	local c, data = Company.get(player)
	if not c or type(id) ~= "string" then
		return
	end
	local k = c.Active[id]
	if not k then
		return
	end
	local day = data.Home.PlayDays
	c.Active[id] = nil
	local bonus = quality >= k.MinQ + 15 and k.Bonus or 0
	local total = k.Pay + bonus
	local oldTier = LifeData.companyTier(c.Contracts)
	move(c, day, total, "Clientes", "Encargo de " .. clientName(k.Client) .. (videoId and (" (vídeo " .. videoId .. ")") or ""))
	c.Contracts = c.Contracts + 1
	changeRep(c, bonus > 0 and 5 or 3)
	changeMorale(c, 3)
	data.Counters.client_contracts = (data.Counters.client_contracts or 0) + 1
	history(c, day, "Encargo cumplido para " .. clientName(k.Client) .. ": +$" .. Util.formatInt(total) .. (bonus > 0 and " (con bonus)" or "") .. ".", "ok")
	S.Net.notify(player, "🏢 Encargo de " .. clientName(k.Client) .. " entregado: +$" .. Util.formatInt(total) .. " para " .. c.Name .. ".", "success")
	local newTier, tier = LifeData.companyTier(c.Contracts)
	if newTier > oldTier then
		history(c, day, "La empresa sube a «" .. tier.Name .. "».", "ok")
		S.Net.notify(player, "🏆 " .. c.Name .. " ahora es «" .. tier.Name .. "»: hasta " .. Company.maxStaff(player) .. " empleados.", "gold")
	end
	S.Quest.check(player)
	S.Data.markDirty(player)
end

---------------------------------------------------------------------------
-- Acciones
---------------------------------------------------------------------------
local function index(v, n)
	v = tonumber(v)
	if not v or v ~= v then
		return nil
	end
	v = math.floor(v)
	if v < 1 or v > n then
		return nil
	end
	return v
end

local function amountOf(v)
	v = tonumber(v)
	if not v or v ~= v or v == math.huge then
		return nil
	end
	v = math.floor(v)
	if v <= 0 or v > 1000000000 then
		return nil
	end
	return v
end

local function noCompany()
	return false, "Primero funda tu empresa (nivel " .. LifeData.CompanyReq.Level .. " o " .. Util.formatInt(LifeData.CompanyReq.Subs) .. " suscriptores)."
end

function Company.Start()
	local Net = S.Net

	Net.on("Company.Refresh", function(player)
		Company.refresh(player)
		return true
	end)

	Net.on("Company.Create", function(player, p)
		local data = S.Data.get(player)
		if companyOf(data) then
			return false, "Ya tienes una empresa."
		end
		if not Company.canFound(data) then
			return false, "Para fundar una empresa necesitas nivel " .. LifeData.CompanyReq.Level .. " o " .. Util.formatInt(LifeData.CompanyReq.Subs) .. " suscriptores."
		end
		local name = Util.cleanText(p.name, 30)
		if not name or #name < 3 then
			return false, "Escribe el nombre de la empresa (mínimo 3 caracteres)."
		end
		local fName = S.Text.filter(player, name)
		if not fName or fName == "" then
			return false, "No se pudo comprobar el nombre. Inténtalo de nuevo."
		end
		if fName ~= name and fName:find("#", 1, true) then
			return false, "Ese nombre no está permitido. Prueba con otro."
		end
		local emoji = index(p.emoji, #LifeData.CompanyEmojis)
		local color = index(p.color, #LifeData.CompanyColors)
		if not emoji or not color then
			return false, "Elige un logotipo válido."
		end
		local day = data.Home.PlayDays
		data.Company = ensure({
			Name = fName,
			Emoji = emoji,
			Color = color,
			Founded = os.time(),
			FoundedDay = day,
			NextPay = day + LifeData.PayPeriodDays,
		})
		local c = data.Company
		history(c, day, "Fundación de «" .. fName .. "».", "ok")
		data.Counters.company_created = 1
		Company.refresh(player)
		S.Progress.addXp(player, 100)
		S.Quest.check(player)
		return true, "🏢 ¡Has fundado «" .. fName .. "»! Ingresa fondos en su cuenta y contrata a tu primer empleado."
	end)

	Net.on("Company.SetLogo", function(player, p)
		local c = Company.get(player)
		if not c then
			return noCompany()
		end
		local emoji = index(p.emoji, #LifeData.CompanyEmojis)
		local color = index(p.color, #LifeData.CompanyColors)
		if not emoji or not color then
			return false, "Elige un logotipo válido."
		end
		if emoji == c.Emoji and color == c.Color then
			return false, "Ese ya es tu logotipo."
		end
		c.Emoji, c.Color = emoji, color
		return true, "Logotipo actualizado: " .. LifeData.CompanyEmojis[emoji] .. " " .. LifeData.CompanyColors[color][1] .. "."
	end)

	Net.on("Company.Deposit", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		local amount = amountOf(p.amount)
		if not amount then
			return false, "Cantidad no válida."
		end
		if not S.Economy.spend(player, amount, "Empresa", "Aportación a " .. c.Name) then
			return false, "No tienes $" .. Util.formatInt(amount) .. "."
		end
		move(c, data.Home.PlayDays, amount, "Aportación", "Aportación del dueño", true)
		c.Report.Deposits = c.Report.Deposits + amount
		return true, "💼 Ingresaste $" .. Util.formatInt(amount) .. " en la cuenta de " .. c.Name .. "."
	end)

	Net.on("Company.Withdraw", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		local amount = amountOf(p.amount)
		if not amount then
			return false, "Cantidad no válida."
		end
		if amount > c.Funds then
			return false, "La empresa solo tiene $" .. Util.formatInt(c.Funds) .. "."
		end
		move(c, data.Home.PlayDays, -amount, "Retirada", "Retirada del dueño", true)
		c.Report.Withdrawals = c.Report.Withdrawals + amount
		S.Economy.add(player, amount, "Empresa", "Retirada de " .. c.Name, {})
		return true, "💼 Retiraste $" .. Util.formatInt(amount) .. " de la cuenta de " .. c.Name .. "."
	end)

	Net.on("Company.Hire", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		Company.refresh(player)
		local cand, idx = nil, nil
		for i, x in ipairs(c.Candidates) do
			if x.Id == p.id then
				cand, idx = x, i
			end
		end
		if not cand or not LifeData.RoleById[cand.Role] then
			return false, "Ese candidato ya no está disponible."
		end
		local max = Company.maxStaff(player)
		if Util.count(c.Staff) >= max then
			return false, "Plantilla completa (" .. max .. " empleados). Cumple más encargos para subir de nivel o consigue un local de negocio o un estudio (+" .. LifeData.CompanyOfficeBonus .. ")."
		end
		local salary = LifeData.salaryFor(cand.Skill, cand.Role)
		if c.Funds < salary then
			return false, "La empresa necesita fondos para al menos una semana de salario ($" .. Util.formatInt(salary) .. "). Ingresa dinero en su cuenta."
		end
		table.remove(c.Candidates, idx)
		local day = data.Home.PlayDays
		c.Seq = c.Seq + 1
		local id = "e" .. c.Seq
		c.Staff[id] = { Id = id, N = c.Seq, Name = cand.Name, Role = cand.Role, Skill = cand.Skill, Salary = salary, Morale = 70, Missed = 0, Hired = day, Since = day }
		data.Counters.employees_hired = (data.Counters.employees_hired or 0) + 1
		history(c, day, "Contratado: " .. cand.Name .. " (" .. roleName(cand.Role) .. ", habilidad " .. cand.Skill .. ").", "ok")
		S.Quest.check(player)
		return true, "👋 " .. cand.Name .. " se une a " .. c.Name .. " como " .. roleName(cand.Role) .. " ($" .. Util.formatInt(salary) .. "/semana). Efecto: " .. LifeData.employeeEffect(c.Staff[id]) .. "."
	end)

	Net.on("Company.Fire", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		local e = type(p.id) == "string" and c.Staff[p.id] or nil
		if not e then
			return false, "Empleado no encontrado."
		end
		if c.Funds < e.Salary then
			return false, "La indemnización (1 semana: $" .. Util.formatInt(e.Salary) .. ") se paga con los fondos de la empresa. Ingresa dinero primero."
		end
		local day = data.Home.PlayDays
		move(c, day, -e.Salary, "Indemnizaciones", "Indemnización de " .. e.Name)
		c.Staff[p.id] = nil
		changeMorale(c, -3)
		history(c, day, "Despedido: " .. e.Name .. " (indemnización $" .. Util.formatInt(e.Salary) .. ").", "info")
		return true, e.Name .. " ya no trabaja en " .. c.Name .. ". Indemnización pagada: $" .. Util.formatInt(e.Salary) .. "."
	end)

	Net.on("Company.AcceptClient", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		Company.refresh(player)
		local offer, idx = nil, nil
		for i, o in ipairs(c.Offers) do
			if o.Id == p.id then
				offer, idx = o, i
			end
		end
		if not offer then
			return false, "Esa oferta ya no está disponible."
		end
		if Util.count(c.Active) >= LifeData.MaxClientContracts then
			return false, "Ya tienes " .. LifeData.MaxClientContracts .. " encargos activos. Entrégalos antes de aceptar más."
		end
		table.remove(c.Offers, idx)
		local k = Util.deepCopy(offer)
		k.Accepted = os.time()
		k.DueDay = data.Home.PlayDays + offer.Days
		c.Active[offer.Id] = k
		history(c, data.Home.PlayDays, "Encargo aceptado: " .. clientName(k.Client) .. " (" .. catName(k.Category) .. ", calidad " .. k.MinQ .. "+).", "info")
		return true, "📝 Encargo de " .. clientName(k.Client) .. " aceptado: vídeo de " .. catName(k.Category) .. " con calidad " .. k.MinQ .. "+ en " .. offer.Days .. " días de juego."
	end)

	Net.on("Company.DeclineClient", function(player, p)
		local c = Company.get(player)
		if not c then
			return noCompany()
		end
		for i, o in ipairs(c.Offers) do
			if o.Id == p.id then
				table.remove(c.Offers, i)
				return true, "Oferta rechazada (sin penalización)."
			end
		end
		return false, "Oferta no encontrada."
	end)

	Net.on("Company.CancelClient", function(player, p)
		local c, data = Company.get(player)
		if not c then
			return noCompany()
		end
		local k = type(p.id) == "string" and c.Active[p.id] or nil
		if not k then
			return false, "Encargo no encontrado."
		end
		c.Active[p.id] = nil
		c.Failed = c.Failed + 1
		changeRep(c, -5)
		history(c, data.Home.PlayDays, "Encargo cancelado: " .. clientName(k.Client) .. ".", "bad")
		return true, "Encargo cancelado. Reputación de empresa −5 (incumplirlo cuesta 10)."
	end)
end

return Company
