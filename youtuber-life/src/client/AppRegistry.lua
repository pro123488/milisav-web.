--!nonstrict
-- AppRegistry: todas las aplicaciones del juego. Cada módulo de la carpeta Apps devuelve una app
-- o una lista de apps con: Id, Name, Icon, Surfaces {pc, phone, panel}, Width, Height, Order, build(container, ctx).

local Registry = {}
local apps = {}
local order = {}

local function add(app)
	assert(app.Id and app.build, "App sin Id o build")
	apps[app.Id] = app
	order[#order + 1] = app
end

for _, mod in ipairs(script.Parent:WaitForChild("Apps"):GetChildren()) do
	if mod:IsA("ModuleScript") then
		local ok, result = pcall(require, mod)
		if ok then
			if result.Id then
				add(result)
			else
				for _, app in ipairs(result) do
					add(app)
				end
			end
		else
			warn("[YTLife] No se pudo cargar la app " .. mod.Name .. ": " .. tostring(result))
		end
	end
end
table.sort(order, function(a, b)
	return (a.Order or 50) < (b.Order or 50)
end)

function Registry.get(id)
	return apps[id]
end

function Registry.allowed(app, surface)
	return app.Surfaces and app.Surfaces[surface] == true
end

function Registry.list(surface)
	local out = {}
	for _, app in ipairs(order) do
		if Registry.allowed(app, surface) and not app.Hidden then
			out[#out + 1] = app
		end
	end
	return out
end

return Registry
