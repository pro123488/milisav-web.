-- PetAnimator (ModuleScript)
-- Ubicación: StarterPlayer/StarterPlayerScripts/Client/Controllers/PetAnimator
--
-- Hace que TUS mascotas floten suavemente arriba y abajo mientras te siguen.
-- Las mascotas siguen unos puntos («PetTarget») del personaje; como su física la simula el
-- cliente de su dueño, mover esos puntos aquí basta para que todos vean el movimiento.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local PetAnimator = {}

local player = Players.LocalPlayer

function PetAnimator.Init()
	RunService.RenderStepped:Connect(function()
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not root then
			return
		end
		local t = os.clock()
		for _, child in ipairs(root:GetChildren()) do
			local base = child:IsA("Attachment") and child:GetAttribute("Base")
			if typeof(base) == "Vector3" then
				local phase = (tonumber(string.match(child.Name, "%d+")) or 1) * 1.3
				child.Position = base + Vector3.new(0, math.sin(t * 2.6 + phase) * 0.45, 0)
			end
		end
	end)
end

return PetAnimator
