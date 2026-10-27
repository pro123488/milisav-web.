-- Remotes (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Modules/Remotes
--
-- Punto único de acceso a los RemoteEvents/RemoteFunctions.
-- El servidor los crea; el cliente espera a que existan.
--
--   Action (RemoteFunction)  cliente -> servidor: (accion, datos) -> { ok, message, ... }
--   State  (RemoteEvent)     servidor -> cliente: estado completo y saneado del propio club
--   Notify (RemoteEvent)     servidor -> cliente: (tipo, mensaje)
--   Shop   (RemoteEvent)     servidor -> cliente: estado de la Tienda Premium

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local FOLDER_NAME = "FEU_Remotes"
local DEFINITIONS = {
	Action = "RemoteFunction",
	State = "RemoteEvent",
	Notify = "RemoteEvent",
	Shop = "RemoteEvent",
}

local Remotes = {}

local function getFolder()
	if RunService:IsServer() then
		local folder = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = FOLDER_NAME
			folder.Parent = ReplicatedStorage
		end
		for name, className in pairs(DEFINITIONS) do
			if not folder:FindFirstChild(name) then
				local remote = Instance.new(className)
				remote.Name = name
				remote.Parent = folder
			end
		end
		return folder
	end
	return ReplicatedStorage:WaitForChild(FOLDER_NAME)
end

function Remotes.Get(name)
	assert(DEFINITIONS[name], "Remote desconocido: " .. tostring(name))
	return getFolder():WaitForChild(name)
end

return Remotes
