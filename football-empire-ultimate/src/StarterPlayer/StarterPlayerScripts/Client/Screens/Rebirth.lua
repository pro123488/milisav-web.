-- Rebirth (ModuleScript) · Pantalla "Renacer"
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Screens/Rebirth
--
-- Muestra los bonus actuales, lo que hace falta para el siguiente renacimiento y qué se reinicia.
-- Renacer pide confirmar dos veces; el servidor vuelve a comprobar todos los requisitos.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local RebirthConfig = require(Shared.Config.RebirthConfig)
local CollectionConfig = require(Shared.Config.CollectionConfig)

local Rebirth = {}

local function percent(value)
	return string.format("+%d %%", math.floor(value * 100 + 0.5))
end

function Rebirth.Render(container, ctx)
	local C, Theme, Format, state = ctx.C, ctx.Theme, ctx.Format, ctx.state
	local rebirth = state.rebirth
	local count = rebirth.count
	local scroll = C.Scroll()
	scroll.Parent = container
	local add = C.Stack(scroll)

	add(C.Row({
		C.Title("🔄 Renacer", 26),
		C.Badge(string.format("Renacimientos: %d / %d", count, rebirth.max), Theme.Panel, Theme.Gold),
	}, 14))

	-- Bonus actuales y del siguiente renacimiento
	add(C.Card({ BackgroundColor3 = Theme.Panel }, {
		C.Title("Tus bonus permanentes", 18),
		C.Label(string.format("💰 Ingresos de cada jornada: <b>%s</b>  →  con el siguiente: <b>%s</b>",
			percent(RebirthConfig.IncomeBonus(count)), percent(RebirthConfig.IncomeBonus(count + 1))), { TextSize = 15 }),
		C.Label(string.format("⚽ Recompensas de los partidos en grupo: <b>%s</b>  →  <b>%s</b>",
			percent(RebirthConfig.ArenaBonus(count)), percent(RebirthConfig.ArenaBonus(count + 1))), { TextSize = 15 }),
		C.Label(string.format("🐾 Huecos de mascota: <b>%d</b>  →  <b>%d</b>",
			RebirthConfig.PetSlots(count, CollectionConfig.MAX_EQUIPPED_PETS), RebirthConfig.PetSlots(count + 1, CollectionConfig.MAX_EQUIPPED_PETS)), { TextSize = 15 }),
	}))

	-- Desbloqueos
	local unlocks = C.Card({}, { C.Title("🎁 Desbloqueos", 18) })
	for _, unlock in ipairs(RebirthConfig.Unlocks) do
		local done = count >= unlock.count
		C.Label(string.format("%s %s %s  <font color='#8C9BB4'>(renacimiento %d)</font>", done and "✅" or "🔒", unlock.icon, unlock.text, unlock.count),
			{ TextSize = 14, TextColor3 = done and Theme.Text or Theme.TextDim }).Parent = unlocks
	end
	add(unlocks)

	-- Requisitos del siguiente
	local nextReq = rebirth.next
	if not nextReq then
		add(C.Card({ BackgroundColor3 = Color3.fromRGB(60, 45, 10) }, {
			C.Label("👑 Has llegado al máximo de renacimientos. ¡Eres una leyenda!", { TextColor3 = Theme.Gold }),
		}))
		return
	end
	local stageOk = state.stadium.stage >= nextReq.stage
	local moneyOk = state.economy.money >= nextReq.money
	local debtOk = state.economy.debt <= 0
	local ready = stageOk and moneyOk and debtOk
	local card = C.Card({}, {
		C.Title(string.format("Renacimiento %d", count + 1), 20),
		C.Label(string.format("%s Estadio en la etapa %d (tienes la %d)", stageOk and "✅" or "❌", nextReq.stage, state.stadium.stage), { TextSize = 15 }),
		C.ProgressBar(math.min(1, state.stadium.stage / nextReq.stage), stageOk and Theme.Accent or Theme.Warning, 8),
		C.Label(string.format("%s %s (tienes %s)", moneyOk and "✅" or "❌", Format.Money(nextReq.money), Format.Money(state.economy.money)), { TextSize = 15 }),
		C.ProgressBar(math.min(1, state.economy.money / nextReq.money), moneyOk and Theme.Accent or Theme.Warning, 8),
		C.Label(string.format("%s Sin deuda", debtOk and "✅" or "❌"), { TextSize = 15 }),
		C.Label("<b>Se reinicia:</b> el dinero (vuelves a empezar con el dinero inicial), la deuda, la afición, las instalaciones y la etapa del estadio.\n"
			.. "<b>Se conserva:</b> tu plantilla, mascotas, balones, trajes, piezas del estadio libre, decoraciones, pase de temporada, misiones, logros e historia.",
			{ TextSize = 13, TextColor3 = Theme.TextDim }),
	})
	local confirming = ctx.drafts.rebirthConfirm and os.clock() - ctx.drafts.rebirthConfirm < 8
	local button = C.Button(confirming and "⚠️ ¿Seguro? Pulsa otra vez para RENACER" or "🔄 Renacer", confirming and "danger" or "gold", function()
		if confirming then
			ctx.drafts.rebirthConfirm = nil
			ctx.act("Rebirth", { confirm = true })
		else
			ctx.drafts.rebirthConfirm = os.clock()
			ctx.navigate("rebirth")
		end
	end)
	C.SetEnabled(button, ready)
	C.Row({ button }, 8).Parent = card
	add(card)
end

return Rebirth
