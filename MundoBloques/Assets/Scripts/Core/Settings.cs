using UnityEngine;

namespace MundoBloques
{
    /// <summary>Ajustes del jugador guardados entre partidas (PlayerPrefs).</summary>
    public static class Settings
    {
        public static float sfx = 0.8f, music = 0.5f, lookSens = 2.2f;
        public static int viewDist = 6;
        public static bool minimap = true;

        public static void Load()
        {
            try
            {
                sfx = Mathf.Clamp01(PlayerPrefs.GetFloat("mb_sfx", 0.8f));
                music = Mathf.Clamp01(PlayerPrefs.GetFloat("mb_music", 0.5f));
                lookSens = Mathf.Clamp(PlayerPrefs.GetFloat("mb_sens", 2.2f), 0.5f, 5f);
                viewDist = Mathf.Clamp(PlayerPrefs.GetInt("mb_view", 6), 3, 12);
                minimap = PlayerPrefs.GetInt("mb_minimap", 1) != 0;
            }
            catch { }
            Sfx.volume = sfx; Music.volume = music;
        }

        public static void Save()
        {
            try
            {
                PlayerPrefs.SetFloat("mb_sfx", sfx); PlayerPrefs.SetFloat("mb_music", music); PlayerPrefs.SetFloat("mb_sens", lookSens);
                PlayerPrefs.SetInt("mb_view", viewDist); PlayerPrefs.SetInt("mb_minimap", minimap ? 1 : 0);
                PlayerPrefs.Save();
            }
            catch { }
        }
    }
}
