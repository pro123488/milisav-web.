--!nonstrict
-- HUD (cliente): dinero, nivel/XP, rango, suscriptores, reloj, clima, ubicación, objetivo actual y botones
-- de acción (adaptados a PC y móvil).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local UI = require(script.Parent.UIKit)
local State = require(script.Parent.State)
local Net = require(script.Parent.Net)
local QuestDefs = require(Shared.QuestDefs)
local Util = require(Shared.Util)
local T = UI.Theme

local HUD = {}
local player = Players.LocalPlayer
local refs = {}

local weatherIcon = { Clear = "☀️", Cloudy = "☁️", Rain = "🌧", Fog = "🌫", Storm = "⛈" }
local weatherName = { Clear = "Despejado", Cloudy = "Nublado", Rain = "Lluvia", Fog = "Niebla", Storm = "Tormenta" }

function HUD.build(gui, actions)
	-- Panel superior izquierdo: canal, nivel y rango
	local left = UI.frame(gui, { Size = UDim2.fromOffset(300, 74), Position = UDim2.fromOffset(12, 12), Color = T.Panel, Transparency = 0.1, Name = "HudLeft" })
	UI.padding(left, 8)
	refs.channel = UI.label(left, "Cargando...", { Font = Enum.Font.GothamBlack, TextSize = 15, Height = 20 })
	refs.rank = UI.label(left, "", { Position = UDim2.fromOffset(0, 20), TextSize = 12, Color = T.Gold, Height = 16 })
	local xpBg, xpFill = UI.progress(left, 0, T.Accent2, { Size = UDim2.new(1, 0, 0, 8) })
	xpBg.Position = UDim2.fromOffset(0, 40)
	refs.xpFill = xpFill
	refs.level = UI.label(left, "", { Position = UDim2.fromOffset(0, 48), TextSize = 11, Color = T.Sub, Height = 14 })

	-- Panel superior central: dinero y suscriptores
	local mid = UI.frame(gui, { Size = UDim2.fromOffset(340, 44), Position = UDim2.new(0.5, 0, 0, 12), Anchor = Vector2.new(0.5, 0), Color = T.Panel, Transparency = 0.1, Name = "HudMid" })
	refs.money = UI.label(mid, "$0", { Size = UDim2.new(0.5, 0, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 20, Color = T.Ok, Align = Enum.TextXAlignment.Center })
	refs.subs = UI.label(mid, "0 subs", { Size = UDim2.new(0.5, 0, 1, 0), Position = UDim2.fromScale(0.5, 0), Font = Enum.Font.GothamBold, TextSize = 16, Color = T.Accent, Align = Enum.TextXAlignment.Center })

	-- Panel superior derecho: hora, clima, ubicación
	local right = UI.frame(gui, { Size = UDim2.fromOffset(260, 60), Position = UDim2.new(1, -12, 0, 12), Anchor = Vector2.new(1, 0), Color = T.Panel, Transparency = 0.1, Name = "HudRight" })
	UI.padding(right, 8)
	refs.clock = UI.label(right, "", { Font = Enum.Font.GothamBold, TextSize = 14, Height = 20, Align = Enum.TextXAlignment.Right })
	refs.place = UI.label(right, "", { Position = UDim2.fromOffset(0, 22), TextSize = 12, Color = T.Sub, Height = 20, Align = Enum.TextXAlignment.Right })
	refs.busy = UI.label(right, "⏳", { Size = UDim2.fromOffset(20, 20), Position = UDim2.fromOffset(-4, -4), TextSize = 14 })
	refs.busy.Visible = false
	Net.OnBusy = function(b)
		refs.busy.Visible = b
	end

	-- Objetivo actual (tutorial)
	local obj = UI.frame(gui, { Size = UDim2.fromOffset(300, 0), Auto = Enum.AutomaticSize.Y, Position = UDim2.fromOffset(12, 96), Color = Color3.fromRGB(30, 40, 70), Transparency = 0.1, Name = "Objective" })
	UI.padding(obj, 8)
	UI.list(obj, Enum.FillDirection.Vertical, 4)
	refs.objTitle = UI.label(obj, "", { Font = Enum.Font.GothamBold, TextSize = 13, Auto = Enum.AutomaticSize.Y, Height = 0 })
	refs.objHint = UI.label(obj, "", { TextSize = 12, Color = Color3.fromRGB(210, 215, 235), Auto = Enum.AutomaticSize.Y, Height = 0 })
	refs.obj = obj

	-- Botones de acción
	local bar = UI.frame(gui, { Size = UDim2.fromOffset(0, 64), Auto = Enum.AutomaticSize.X, Position = UDim2.new(0.5, 0, 1, -12), Anchor = Vector2.new(0.5, 1), Color = T.Panel, Transparency = 0.15, Name = "ActionBar" })
	UI.padding(bar, 6)
	UI.list(bar, Enum.FillDirection.Horizontal, 6)
	local function action(icon, label, key, fn, color)
		local b = UI.button(bar, icon .. "\n" .. label .. (key and (" (" .. key .. ")") or ""), fn, { Width = 78, Height = 52, TextSize = 11, Color = color or T.Panel3 })
		return b
	end
	action("📱", "Teléfono", "P", actions.phone)
	action("🎒", "Inventario", "I", actions.inventory)
	refs.missionsBtn = action("🏆", "Misiones", "M", actions.missions)
	refs.recBtn = action("🎬", "Grabar", "R", actions.record, Color3.fromRGB(150, 30, 50))
	action("📸", "Foto", "F", actions.photo)
	action("👕", "Estilo", "V", actions.style)
	refs.laptopBtn = action("💻", "Portátil", "C", actions.laptop)
	refs.buildBtn = action("🔨", "Construir", "B", actions.build, Color3.fromRGB(40, 110, 70))
	action("🏘", "Inmobiliaria", nil, actions.realty)
	action("⚙", "Ajustes", nil, actions.settings)

	HUD.refresh()
	State.on(HUD.refresh)
	task.spawn(function()
		while true do
			local h = workspace:GetAttribute("GameHour") or 12
			local w = workspace:GetAttribute("Weather") or "Clear"
			refs.clock.Text = string.format("%s %02d:%02d · %s · Día %d", weatherIcon[w] or "", math.floor(h), math.floor((h % 1) * 60), workspace:GetAttribute("TimeLabel") or "", workspace:GetAttribute("GameDay") or 1)
			local spot = player:GetAttribute("Spot")
			refs.place.Text = "📍 " .. tostring(player:GetAttribute("District") or "...") .. (spot and ("  ·  🎥 " .. spot) or "") .. "  ·  " .. (weatherName[w] or "")
			task.wait(0.5)
		end
	end)
end

function HUD.refresh()
	local data = State.Data
	if not data or not refs.money then
		return
	end
	local d = data.Derived
	local name = data.Channel.Name ~= "" and data.Channel.Name or player.DisplayName
	refs.channel.Text = "🎬 " .. name
	refs.rank.Text = d.RankName .. (data.EquippedTitle ~= "" and (" · «" .. data.EquippedTitle .. "»") or "")
	refs.xpFill.Size = UDim2.new(math.clamp(data.XP / d.XpNext, 0, 1), 0, 1, 0)
	refs.level.Text = "Nivel " .. data.Level .. " · " .. data.XP .. "/" .. d.XpNext .. " XP · Reputación " .. data.Reputation
	refs.money.Text = "$" .. Util.formatInt(data.Money)
	refs.subs.Text = "👥 " .. Util.formatShort(data.Channel.Subs) .. " subs"
	-- Objetivo
	local q = data.Quests
	local step = QuestDefs.Tutorial[q.Step]
	if step and not q.Skipped then
		refs.obj.Visible = true
		refs.objTitle.Text = "🎯 " .. q.Step .. "/" .. #QuestDefs.Tutorial .. " " .. step.Name .. ((step.Target or 1) > 1 and (" (" .. q.StepProgress .. "/" .. step.Target .. ")") or "")
		refs.objHint.Text = data.Settings.Hints ~= false and step.Hint or ""
		refs.objHint.Visible = data.Settings.Hints ~= false
	else
		refs.obj.Visible = false
	end
	local pending = 0
	for id in pairs(q.Completed) do
		if not q.Claimed[id] then
			pending = pending + 1
		end
	end
	refs.missionsBtn.Text = "🏆\nMisiones (M)" .. (pending > 0 and (" 🎁" .. pending) or "")
	refs.recBtn.Text = d.Recording and "⏹\nGrabando (R)" or "🎬\nGrabar (R)"
	local hasLaptop = false
	for _, rec in pairs(data.Inventory) do
		if rec.Id:sub(1, 4) == "lap_" then
			hasLaptop = true
		end
	end
	refs.laptopBtn.Visible = hasLaptop
	refs.buildBtn.Visible = d.PropInside ~= nil
end

-- Texto flotante de dinero ganado
function HUD.cash(amount)
	if not refs.money then
		return
	end
	local l = UI.label(refs.money.Parent, (amount >= 0 and "+$" or "-$") .. Util.formatInt(math.abs(amount)), { Size = UDim2.new(0.5, 0, 0, 20), Position = UDim2.new(0, 0, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 16, Color = T.Ok, Align = Enum.TextXAlignment.Center })
	UI.tween(l, { Position = UDim2.new(0, 0, 1, 26), TextTransparency = 1 }, 1.4)
	task.delay(1.5, function()
		l:Destroy()
	end)
end

return HUD
