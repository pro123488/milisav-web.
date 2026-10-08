using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using System.IO;

namespace MundoBloques.EditorTools
{
    /// <summary>
    /// Prepara el proyecto la primera vez que se abre en Unity: crea la escena Main,
    /// la anade a los ajustes de compilacion y configura los datos basicos del juego.
    /// Tambien anade el menu MundoBloques en la barra superior.
    /// </summary>
    [InitializeOnLoad]
    public static class MundoBloquesSetup
    {
        const string ScenePath = "Assets/Scenes/Main.unity";
        const string Key = "MundoBloques.SetupDone.v1";

        static MundoBloquesSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (SessionState.GetBool(Key, false)) return;
                SessionState.SetBool(Key, true);
                if (!File.Exists(ScenePath)) Setup(false);
            };
        }

        [MenuItem("MundoBloques/Configurar proyecto y crear escena")]
        public static void SetupMenu() { Setup(true); }

        [MenuItem("MundoBloques/Abrir carpeta de partidas guardadas")]
        public static void OpenSaves()
        {
            string p = Path.Combine(Application.persistentDataPath, "MundoBloques");
            Directory.CreateDirectory(p);
            EditorUtility.RevealInFinder(p);
        }

        static void Setup(bool verbose)
        {
            PlayerSettings.productName = "MundoBloques";
            PlayerSettings.companyName = "MundoBloques";
            PlayerSettings.runInBackground = true;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;

            Directory.CreateDirectory("Assets/Scenes");
            // Escena vacia: el juego se crea solo al pulsar Play (GameRoot usa RuntimeInitializeOnLoadMethod)
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, ScenePath);
            var list = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            bool has = false;
            foreach (var s in list) if (s.path == ScenePath) has = true;
            if (!has) list.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = list.ToArray();
            AssetDatabase.SaveAssets();
            if (verbose) EditorUtility.DisplayDialog("MundoBloques", "Escena creada en " + ScenePath + ".\nPulsa Play para jugar.", "Vale");
            else Debug.Log("[MundoBloques] Escena creada en " + ScenePath + ". Pulsa Play para jugar.");
#if !ENABLE_LEGACY_INPUT_MANAGER && !ENABLE_INPUT_SYSTEM
            Debug.LogWarning("[MundoBloques] No se detecta ningun sistema de entrada activo. En Project Settings > Player > Active Input Handling elige 'Both'.");
#endif
        }
    }
}
