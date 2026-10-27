-- Premium (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/UI/Premium
-- Ayudas de INTERFAZ para mostrar opciones bloqueadas por Game Pass.
-- Solo deciden qué se muestra: el servidor vuelve a validar cada acción.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GamePassConfig = require(ReplicatedStorage:WaitForChild("Shared").Config.GamePassConfig)

local Premium = {}

function Premium.IsLocked(state, item)
	return item.requiredPass ~= nil and not state.premium.owned[item.requiredPass]
end

function Premium.PassName(passKey)
	local def = GamePassConfig.Get(passKey)
	return def and (def.icon .. " " .. def.name) or passKey
end

function Premium.LockText(item)
	return item.requiredPass and Premium.PassName(item.requiredPass) or ""
end

-- Al pulsar una opción bloqueada: se explica y se lleva a la Tienda Premium.
function Premium.OnLockedClick(ctx, item)
	ctx.notify("info", string.format("«%s» forma parte del pase %s.", item.name, Premium.PassName(item.requiredPass)))
	ctx.navigate("shop", { focus = item.requiredPass })
end

return Premium
