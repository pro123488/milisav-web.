using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public enum GameState { Menu, Loading, Playing }

    /// <summary>Director del juego: arranque, ciclo de vida del mundo, dimensiones, jefe final, guardado.</summary>
    public sealed class GameRoot : MonoBehaviour
    {
        public static GameRoot I;
        public World world;
        public Player player;
        public DayNight sky;
        public Weather weather;
        public GameUI ui;
        public Transform entityRoot;
        public GameState state = GameState.Menu;
        public bool paused;
        public string worldName = "Mundo";
        public int worldSeed;
        public bool creative;
        public bool dragonDefeated, creditsShown;
        public float playTime;
        public Rng rand = new Rng(System.Environment.TickCount);
        public int viewDist = 6;
        public float skyBrightness { get { return sky != null ? (world != null && world.dim == Dim.Overworld ? sky.skyBrightness : 0f) : 1f; } }

        public readonly HashSet<string> advDone = new HashSet<string>();
        public readonly MapData map = new MapData();
        public List<BoatDto> savedBoats = new List<BoatDto>();
        float mapTimer;
        public readonly HashSet<int> persistentIds = new HashSet<int>();
        public List<MobDto> savedMobs = new List<MobDto>();
        GameObject menuCam;
        float tickAcc, autosave, activateTimer;
        bool traveling;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (I != null) return;
            var go = new GameObject("MundoBloques");
            go.AddComponent<GameRoot>();
        }

        void Awake()
        {
            if (I != null) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            Application.runInBackground = true;
            Application.targetFrameRate = -1;
            QualitySettings.vSyncCount = 1;
            foreach (var c in FindObjectsByType<Camera>(FindObjectsSortMode.None)) c.gameObject.SetActive(false);
            foreach (var l in FindObjectsByType<AudioListener>(FindObjectsSortMode.None)) l.enabled = false;

            B.Init(); Items.Init(); Recipes.Init(); MobDefs.EnsureInit();
            TileAtlas.Build(true);
            IconAtlas.Build(true);
            Mats.Init();
            Sfx.Init(transform);
            Music.Init(transform);
            Settings.Load();
            viewDist = Settings.viewDist;
            Particles.Init(transform);

            entityRoot = new GameObject("Entities").transform;
            entityRoot.SetParent(transform, false);
            sky = new GameObject("Sky").AddComponent<DayNight>();
            sky.transform.SetParent(transform, false);
            sky.Init();
            weather = new GameObject("Weather").AddComponent<Weather>();
            weather.transform.SetParent(transform, false);
            weather.Init();
            BlockLogic.RainHook = (w, x, y, z) => world == w && weather != null && weather.RainAt(w, x, z) && w.SkyLight(x, y, z) >= 14;
            ui = new GameObject("UI").AddComponent<GameUI>();
            ui.transform.SetParent(transform, false);
            ui.Build();
            MakeMenuCamera();
            ui.ShowMainMenu();
        }

        public MobDto[] CollectPersistentMobs()
        {
            if (world != null && world.dim == Dim.Overworld)
            {
                var l = new List<MobDto>();
                for (int i = 0; i < Entity.All.Count; i++)
                {
                    var m = Entity.All[i] as Mob;
                    if (m == null || m.dead || !m.persistent || m.spawnId == 0) continue;
                    var p = m.transform.position;
                    l.Add(new MobDto { k = m.def.key, x = p.x, y = p.y, z = p.z, hx = m.home.x, hy = m.home.y, hz = m.home.z, id = m.spawnId, f = m.Flags, c = m.woolColor, hp = m.health });
                }
                // conservar los que aun no estan cargados como entidades
                foreach (var d in savedMobs) { bool dup = false; foreach (var e in l) if (e.id == d.id) { dup = true; break; } if (!dup && !persistentDead.Contains(d.id)) l.Add(d); }
                savedMobs = l;
            }
            return savedMobs.ToArray();
        }

        public BoatDto[] CollectBoats()
        {
            if (world != null && world.dim == Dim.Overworld)
            {
                var l = new List<BoatDto>();
                for (int i = 0; i < Entity.All.Count; i++)
                {
                    var b = Entity.All[i] as Boat;
                    if (b == null || b.dead) continue;
                    var p = b.transform.position;
                    l.Add(new BoatDto { x = p.x, y = p.y, z = p.z, yaw = b.yaw });
                }
                savedBoats = l;
            }
            return savedBoats.ToArray();
        }

        void RestoreBoats()
        {
            if (world == null || world.dim != Dim.Overworld) return;
            foreach (var d in savedBoats) Boat.Spawn(new Vector3(d.x, d.y, d.z), d.yaw);
        }

        public readonly HashSet<int> persistentDead = new HashSet<int>();
        int dynId = 0x40000000;
        /// <summary>Identificador nuevo para criaturas que se vuelven persistentes (mascotas, caballos ensillados).</summary>
        public int NewMobId() { return ++dynId; }

        public void RestoreMobs()
        {
            if (world == null || world.dim != Dim.Overworld) return;
            foreach (var d in savedMobs)
            {
                persistentIds.Add(d.id);
                bool alive = false;
                for (int i = 0; i < Entity.All.Count; i++) { var m = Entity.All[i] as Mob; if (m != null && m.spawnId == d.id && !m.dead) { alive = true; break; } }
                if (alive || persistentDead.Contains(d.id)) continue;
                var def = MobDefs.Get(d.k); if (def == null) continue;
                var mob = Mob.Create(def, new Vector3(d.hx, d.hy, d.hz), (d.f & 8) != 0, d.f != 0 || d.c != 0 ? d.c : -1);
                mob.transform.position = new Vector3(d.x, d.y, d.z);
                mob.persistent = true; mob.spawnId = d.id; mob.home = new Vector3(d.hx, d.hy, d.hz);
                mob.ApplyFlags(d.f, d.hp);
            }
        }

        void MakeMenuCamera()
        {
            menuCam = new GameObject("MenuCamera");
            menuCam.transform.SetParent(transform, false);
            var c = menuCam.AddComponent<Camera>();
            c.clearFlags = CameraClearFlags.SolidColor; c.backgroundColor = new Color(0.12f, 0.2f, 0.35f);
            c.cullingMask = 0;
            menuCam.AddComponent<AudioListener>();
        }

        // ================================================================== bucle principal
        void Update()
        {
            Inp.Poll();
            float dt = Mathf.Min(Time.deltaTime, 0.1f);
            if (world != null && player != null)
            {
                var pp = player.transform.position;
                int pcx = Mathf.FloorToInt(pp.x) >> 4, pcz = Mathf.FloorToInt(pp.z) >> 4;
                world.viewDist = viewDist;
                world.Stream(pcx, pcz);
                PumpMeshes();
                if (state == GameState.Playing)
                {
                    if (!paused)
                    {
                        playTime += dt;
                        tickAcc += dt;
                        int n = 0;
                        while (tickAcc >= 0.05f && n++ < 3) { tickAcc -= 0.05f; world.Tick(pcx, pcz, 4); }
                        if (tickAcc > 0.2f) tickAcc = 0f;
                        weather.Step(dt, player, world);
                        sky.overcast = weather.Overcast; sky.flash = weather.flash;
                        mapTimer -= dt;
                        if (mapTimer <= 0f) { mapTimer = 0.5f; if (world.dim == Dim.Overworld) map.CaptureAround(world, pcx, pcz, 9, Time.time, 6); }
                        Advancements.Tick(this, player, dt);
                        sky.Step(dt, player, world, viewDist);
                        MobSpawner.Tick(this, dt);
                        activateTimer -= dt;
                        if (activateTimer <= 0f) { activateTimer = 0.2f; ActivateChunks(pcx, pcz); }
                        autosave += dt;
                        if (autosave > 90f) { autosave = 0; SaveSystem.SaveLevel(this); }
                    }
                }
                else if (world != null) sky.Step(0f, player, world, viewDist);
            }
            ui.Tick(dt);
            Music.Tick(this, dt);
            bool locked = state == GameState.Playing && !paused && !ui.IsOpen && player != null && !player.dead;
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        void ActivateChunks(int pcx, int pcz)
        {
            int n = 0;
            for (int dz = -3; dz <= 3 && n < 2; dz++)
                for (int dx = -3; dx <= 3 && n < 2; dx++)
                {
                    var c = world.GetChunkNoCache(pcx + dx, pcz + dz);
                    if (c != null && c.state == 2 && !c.spawnsDone && c.view != null) { MobSpawner.Activate(this, c); n++; }
                }
        }

        /// <summary>Sube a la GPU las mallas terminadas por los hilos de fondo.</summary>
        public void PumpMeshes()
        {
            float start = Time.realtimeSinceStartup;
            MeshData md;
            int n = 0;
            while (world.meshResults.TryDequeue(out md))
            {
                var c = md.chunk;
                Chunk cur;
                if (c != null && world.chunks.TryGetValue(MathX.ChunkKey(c.cx, c.cz), out cur) && cur == c)
                {
                    var v = c.view as ChunkView;
                    if (v == null) { v = new ChunkView(c); c.view = v; }
                    v.Upload(md);
                }
                md.Release();
                n++;
                if (Time.realtimeSinceStartup - start > 0.006f && state == GameState.Playing) break;
                if (n > 6 && state == GameState.Playing) break;
            }
        }

        // ================================================================== sesion
        World CreateWorld(Dim dim, int seed)
        {
            var w = new World(dim, seed);
            w.store = new SaveSystem.ChunkStore(worldName);
            w.viewDist = viewDist;
            w.OnDrops = (x, y, z, list) => { for (int i = 0; i < list.Count; i++) SpawnItem(new Vector3(x + 0.5f, y + 0.4f, z + 0.5f), list[i], new Vector3(rand.Range(-1f, 1f), rand.Range(1.5f, 3f), rand.Range(-1f, 1f))); };
            w.OnFallingBlock = (x, y, z, b) => FallingBlockEntity.Spawn(x, y, z, b);
            w.OnSpawnerTick = (x, y, z, meta) => MobSpawner.SpawnerBlock(this, x, y, z, meta);
            w.OnBlockBroken = (x, y, z, b, meta) => { Particles.BlockBreak(x, y, z, b, 8); };
            w.OnChunkUnloaded = c => { var v = c.view as ChunkView; if (v != null) v.Destroy(); c.view = null; };
            return w;
        }

        void ClearWorld()
        {
            if (world != null) { world.UnloadAll(); }
            world = null;
            for (int i = Entity.All.Count - 1; i >= 0; i--)
            {
                var e = Entity.All[i];
                if (e != null && !e.IsPlayer) Destroy(e.gameObject);
            }
            MeshData md;
        }

        public void StartNewWorld(string name, int seed, bool creativeMode)
        {
            if (state == GameState.Loading) return;
            StartCoroutine(BeginSession(name, seed, creativeMode, null));
        }

        public void LoadWorld(LevelDto dto)
        {
            if (state == GameState.Loading) return;
            StartCoroutine(BeginSession(dto.name, dto.seed, dto.creative, dto));
        }

        public void ReturnToMenu()
        {
            if (world != null && player != null && state == GameState.Playing) SaveSystem.SaveLevel(this);
            state = GameState.Menu; paused = false;
            weather.Clear(); sky.overcast = 0f; sky.flash = 0f;
            ClearWorld();
            if (player != null) { Destroy(player.gameObject); player = null; }
            if (menuCam == null) MakeMenuCamera();
            ui.CloseAll();
            ui.ShowMainMenu();
            Mats.SetGlobals(1f, 0.04f, new Color(0.12f, 0.2f, 0.35f), 100f, 200f);
        }

        IEnumerator BeginSession(string name, int seed, bool creativeMode, LevelDto dto)
        {
            state = GameState.Loading; paused = false;
            ui.HideMainMenu();
            ui.ShowLoading("Preparando el mundo...", 0.02f);
            yield return null;
            ClearWorld();
            if (player != null) { Destroy(player.gameObject); player = null; yield return null; }
            worldName = name; worldSeed = seed; creative = creativeMode;
            dragonDefeated = dto != null && dto.dragonDefeated; creditsShown = dto != null && dto.creditsShown;
            persistentIds.Clear(); persistentDead.Clear(); savedMobs = dto != null && dto.mobs != null ? new List<MobDto>(dto.mobs) : new List<MobDto>();
            dynId = 0x40000000;
            foreach (var sm in savedMobs) if (sm.id > dynId) dynId = sm.id;
            savedBoats = dto != null && dto.boats != null ? new List<BoatDto>(dto.boats) : new List<BoatDto>();
            advDone.Clear(); Advancements.ClearEvents();
            if (dto != null && dto.adv != null) foreach (var a in dto.adv) advDone.Add(a);
            map.Clear(); map.Load(SaveSystem.MapFile(name));
            playTime = dto != null ? dto.playTime : 0f;
            if (dto != null) viewDist = Mathf.Clamp(dto.viewDist, 3, 12);
            Dim dim = dto != null ? (Dim)dto.dim : Dim.Overworld;
            world = CreateWorld(dim, seed);

            var pgo = new GameObject("Player");
            pgo.transform.SetParent(transform, false);
            player = pgo.AddComponent<Player>();
            player.Init();
            player.lookSens = Settings.lookSens;
            if (menuCam != null) { Destroy(menuCam); menuCam = null; }
            Vector3 pos;
            if (dto != null)
            {
                pos = new Vector3(dto.px, dto.py, dto.pz);
                sky.time = dto.dayTime;
                SaveSystem.ApplyToPlayer(dto, player);
            }
            else
            {
                pos = FindSpawn(seed);
                sky.time = 0.04f;
                player.spawnPos = pos; player.spawnDim = Dim.Overworld; player.hasBed = false;
                player.ResetStats();
                if (creativeMode) { }
                else { var inv = player.inv; }
            }
            player.transform.position = pos;
            player.transform.rotation = Quaternion.Euler(0, player.yaw, 0);
            yield return StartCoroutine(WaitForArea(pos, "Generando el mundo..."));
            if (dto == null) pos = SafeSpawn(pos);
            player.transform.position = pos;
            RestoreMobs(); RestoreBoats();
            if (dto != null) weather.SetState(dto.rain, dto.storm); else weather.Clear();
            player.vel = Vector3.zero;
            if (dto == null) SaveSystem.SaveLevel(this);
            state = GameState.Playing;
            ui.HideLoading();
            ui.OnSessionStart();
        }

        IEnumerator WaitForArea(Vector3 pos, string text)
        {
            int pcx = Mathf.FloorToInt(pos.x) >> 4, pcz = Mathf.FloorToInt(pos.z) >> 4;
            float t = 0f;
            const int R = 2;
            while (true)
            {
                world.Stream(pcx, pcz);
                PumpMeshes();
                int ready = 0, total = (2 * R + 1) * (2 * R + 1);
                for (int dz = -R; dz <= R; dz++)
                    for (int dx = -R; dx <= R; dx++)
                    {
                        var c = world.GetChunkNoCache(pcx + dx, pcz + dz);
                        if (c != null && c.state == 2 && c.view != null) ready++;
                    }
                ui.ShowLoading(text, 0.05f + 0.95f * ready / total);
                if (ready >= total) break;
                t += Time.deltaTime;
                if (t > 60f) break;
                yield return null;
            }
            for (int i = 0; i < 3; i++) { PumpMeshes(); yield return null; }
        }

        Vector3 SafeSpawn(Vector3 pos)
        {
            int x = Mathf.FloorToInt(pos.x), z = Mathf.FloorToInt(pos.z);
            int gy = world.GroundY(x, z);
            if (gy < 0) return pos;
            int y = gy + 1;
            for (int i = 0; i < 12; i++)
            {
                var b1 = world.GetBlock(x, y, z); var b2 = world.GetBlock(x, y + 1, z);
                if (!b1.Collides && !b2.Collides) break;
                y++;
            }
            return new Vector3(x + 0.5f, y + 0.02f, z + 0.5f);
        }

        Vector3 FindSpawn(int seed)
        {
            var gen = new OverworldGen(seed);
            for (int r = 0; r < 90; r++)
                for (int a = 0; a < Mathf.Max(1, r > 0 ? 14 : 1); a++)
                {
                    float ang = a * 6.2831f / 14f + r * 0.7f;
                    int x = Mathf.RoundToInt(Mathf.Cos(ang) * r * 14), z = Mathf.RoundToInt(Mathf.Sin(ang) * r * 14);
                    var ci = gen.Column(x, z);
                    if (ci.HasWater || ci.h < OverworldGen.Sea + 2 || ci.h > OverworldGen.Sea + 18) continue;
                    if (ci.biome == BiomeId.Beach || ci.biome == BiomeId.River || ci.biome == BiomeId.Mushroom || ci.biome == BiomeId.SnowyPeaks || ci.biome == BiomeId.Mountains) continue;
                    return new Vector3(x + 0.5f, ci.h + 2f, z + 0.5f);
                }
            return new Vector3(0.5f, 70f, 0.5f);
        }

        void OnApplicationQuit() { if (world != null && player != null && state == GameState.Playing) SaveSystem.SaveLevel(this); }
        void OnApplicationPause(bool p) { if (p && world != null && player != null && state == GameState.Playing) SaveSystem.SaveLevel(this); }

        // ================================================================== utilidades de juego
        public ItemEntity SpawnItem(Vector3 pos, ItemStack s, Vector3 vel) { return ItemEntity.Spawn(pos, s, vel); }

        public Mob SpawnMob(string key, Vector3 pos, bool baby = false)
        {
            var def = MobDefs.Get(key);
            return def == null ? null : Mob.Create(def, pos, baby);
        }

        /// <summary>Explosion con dano, empuje y destruccion de bloques.</summary>
        public void Explode(Vector3 pos, float radius, Entity src, bool destroyBlocks, bool small)
        {
            Sfx.Play(Clip.Explode, pos, small ? 0.6f : 1f, small ? 1.4f : 1f);
            Particles.Burst(pos, new Color32(240, 240, 230, 255), small ? 14 : 50, radius * 1.3f, 0.35f, 1.1f, Vector3.one * radius * 0.5f);
            Particles.Burst(pos, new Color32(70, 70, 70, 255), small ? 8 : 30, radius, 0.3f, 1.3f, Vector3.one * radius * 0.5f);
            Particles.Burst(pos, new Color32(255, 160, 40, 255), small ? 6 : 24, radius * 1.2f, 0.2f, 0.7f, Vector3.one * radius * 0.4f);
            if (destroyBlocks && world != null)
            {
                int r = Mathf.CeilToInt(radius);
                int cx = Mathf.FloorToInt(pos.x), cy = Mathf.FloorToInt(pos.y), cz = Mathf.FloorToInt(pos.z);
                var list = new List<ItemStack>();
                for (int dy = -r; dy <= r; dy++)
                    for (int dz = -r; dz <= r; dz++)
                        for (int dx = -r; dx <= r; dx++)
                        {
                            float d = Mathf.Sqrt(dx * dx + dy * dy + dz * dz);
                            if (d > radius * (0.75f + 0.25f * rand.Float())) continue;
                            int x = cx + dx, y = cy + dy, z = cz + dz;
                            var b = world.GetBlock(x, y, z);
                            if (b.id == 0 || b.fluid || b.hardness < 0f || b.hardness > 12f) continue;
                            if (b == B.Tnt) { world.SetBlock(x, y, z, B.Air); PrimedTnt.Spawn(new Vector3(x + 0.5f, y, z + 0.5f), rand.Range(0.4f, 1.4f), new Vector3(rand.Range(-2f, 2f), 3f, rand.Range(-2f, 2f))); continue; }
                            if (rand.Chance(0.25f)) { list.Clear(); b.GetDrops(rand, ItemStack.Empty, list); for (int i = 0; i < list.Count; i++) SpawnItem(new Vector3(x + 0.5f, y + 0.5f, z + 0.5f), list[i], new Vector3(rand.Range(-2f, 2f), 3f, rand.Range(-2f, 2f))); }
                            world.SetBlock(x, y, z, B.Air);
                        }
            }
            float rd = radius * 2f;
            for (int i = Entity.All.Count - 1; i >= 0; i--)
            {
                var e = Entity.All[i];
                if (e == null || e.dead) continue;
                if (e is ItemEntity || e is Projectile) continue;
                var c = e.transform.position + Vector3.up * e.height * 0.5f;
                float dist = (c - pos).magnitude;
                if (dist > rd) continue;
                float f = 1f - dist / rd;
                float dmg = Mathf.Floor(f * f * (radius * 4f + 1f) + 1f);
                if (small) dmg *= 0.5f;
                var dir = (c - pos); dir.y += 0.3f; dir = dir.sqrMagnitude > 0.001f ? dir.normalized : Vector3.up;
                if (e == src && !(src is Mob)) continue;
                var pl = e as Player;
                if (e is PrimedTnt || e is FallingBlockEntity) { e.vel += dir * 8f * f; continue; }
                e.Damage(dmg, pos, src, 0f);
                e.vel += dir * 11f * f; e.onGround = false;
            }
        }

        // ================================================================== muerte, cama, portales
        public void OnPlayerDied()
        {
            if (!creative)
            {
                var inv = player.inv;
                for (int i = 0; i < inv.slots.Length; i++)
                    if (!inv.slots[i].IsEmpty) { SpawnItem(player.transform.position + Vector3.up, inv.slots[i], new Vector3(rand.Range(-3f, 3f), 4f, rand.Range(-3f, 3f))); inv.slots[i].Clear(); }
                for (int i = 0; i < 4; i++)
                    if (!inv.armor[i].IsEmpty) { SpawnItem(player.transform.position + Vector3.up, inv.armor[i], new Vector3(rand.Range(-3f, 3f), 4f, rand.Range(-3f, 3f))); inv.armor[i].Clear(); }
            }
            ui.CloseAll();
            ui.ShowDeath();
        }

        public void OnMobKilled(Mob m)
        {
            Advancements.Event("kill:" + m.def.key);
            if (m.def.hostile) Advancements.Event("kill:hostile");
        }

        public void Respawn()
        {
            ui.HideDeath();
            Vector3 pos = player.spawnPos;
            Dim target = player.hasBed ? player.spawnDim : Dim.Overworld;
            if (!player.hasBed) { pos = FindSpawn(worldSeed); }
            if (world.dim != target) { StartCoroutine(Travel(target, pos, 0, false, true)); return; }
            player.Respawn(pos);
            var p = SafeSpawn(pos);
            player.transform.position = p;
        }

        public void SleepInBed(Vector3 bed)
        {
            player.spawnPos = bed; player.spawnDim = world.dim; player.hasBed = true;
            ui.Flash(new Color(0, 0, 0, 1f));
            sky.SkipNight();
            weather.Clear();
            Advancements.Event("sleep");
            player.health = player.maxHealth;
            ui.Toast("Has dormido. Punto de reaparición guardado.");
        }

        public void UsePortal(int kind)
        {
            if (traveling || state != GameState.Playing) return;
            if (player.portalLock) return;
            if (kind == 1)
            {
                if (world.dim == Dim.Overworld)
                {
                    var p = player.transform.position;
                    StartCoroutine(Travel(Dim.Abismo, new Vector3(p.x / 8f, p.y, p.z / 8f), 1, true, false));
                }
                else if (world.dim == Dim.Abismo)
                {
                    var p = player.transform.position;
                    StartCoroutine(Travel(Dim.Overworld, new Vector3(p.x * 8f, 70f, p.z * 8f), 1, true, false));
                }
            }
            else
            {
                if (world.dim == Dim.Overworld) StartCoroutine(Travel(Dim.Final, new Vector3(0.5f, 70f, 40.5f), 2, false, false));
                else if (world.dim == Dim.Final)
                {
                    if (dragonDefeated && !creditsShown) { creditsShown = true; ui.ShowVictory(); }
                    else ExitEnd();
                }
            }
        }

        public void ExitEnd()
        {
            var sp = player.hasBed && player.spawnDim == Dim.Overworld ? player.spawnPos : FindSpawn(worldSeed);
            StartCoroutine(Travel(Dim.Overworld, sp, 0, false, true));
        }

        IEnumerator Travel(Dim target, Vector3 dest, int portalKind, bool findPortal, bool respawn)
        {
            traveling = true;
            var prevState = state;
            state = GameState.Loading;
            ui.CloseAll();
            ui.ShowLoading(target == Dim.Abismo ? "Entrando al Abismo..." : target == Dim.Final ? "Viajando al Final..." : "Volviendo al Mundo Superior...", 0.02f);
            yield return null;
            var seed = worldSeed;
            SaveSystem.SaveLevel(this);
            if (world != null) world.UnloadAll();
            for (int i = Entity.All.Count - 1; i >= 0; i--) { var e = Entity.All[i]; if (e != null && !e.IsPlayer) Destroy(e.gameObject); }
            world = CreateWorld(target, seed);
            if (target == Dim.Abismo) Advancements.Event("dim:abismo");
            if (target == Dim.Final) Advancements.Event("dim:final");
            player.transform.position = dest;
            player.vel = Vector3.zero;
            yield return StartCoroutine(WaitForArea(dest, "Generando dimensión..."));

            Vector3 pos = dest;
            int x = Mathf.FloorToInt(dest.x), z = Mathf.FloorToInt(dest.z);
            if (target == Dim.Final)
            {
                int gy = world.GroundY(x, z);
                pos = new Vector3(x + 0.5f, (gy >= 0 ? gy : 64) + 1.02f, z + 0.5f);
                if (!dragonDefeated && Dragon.Instance == null) Dragon.Create(new Vector3(0, 90, 0));
            }
            else if (target == Dim.Abismo || (findPortal && target == Dim.Overworld))
            {
                int fx, fy, fz;
                bool found = Portals.Find(world, x, 5, 120, z, target == Dim.Abismo ? 16 : 64, out fx, out fy, out fz);
                if (!found)
                {
                    int by = target == Dim.Overworld ? Mathf.Max(world.GroundY(x, z) + 1, OverworldGen.Sea + 1) : FindAbismoY(x, z);
                    if (target == Dim.Abismo)
                    {
                        // zona despejada con suelo
                        for (int dy = -1; dy <= 5; dy++) for (int dz = -3; dz <= 3; dz++) for (int dx = -3; dx <= 4; dx++)
                                    world.SetBlock(x + dx, by + dy, z + dz, dy == -1 ? B.AbyssRock : B.Air, 0, false);
                    }
                    Portals.Build(world, x, by, z);
                    fx = x; fy = by; fz = z;
                    // marcar los bloques de portal construidos (Build usa ids de portal, no obsidiana)
                }
                pos = new Vector3(fx + 0.5f, fy + 0.02f, fz + 1.6f);
                if (world.GetBlock(fx, fy, Mathf.FloorToInt(pos.z)).Collides) pos = new Vector3(fx + 0.5f, fy + 0.02f, fz - 0.6f);
                player.portalLock = true;
            }
            else
            {
                if (respawn) { pos = SafeSpawn(dest); }
                else { int gy = world.GroundY(x, z); pos = new Vector3(x + 0.5f, (gy >= 0 ? gy : 70) + 1.02f, z + 0.5f); }
            }
            player.transform.position = pos;
            if (target == Dim.Overworld) { RestoreMobs(); RestoreBoats(); }
            player.vel = Vector3.zero; player.fallDistance = 0; player.portalTime = 0;
            if (respawn) { player.ResetStats(); }
            Sfx.Play(Clip.Portal, pos, 0.7f, target == Dim.Overworld ? 1.2f : 0.8f);
            state = GameState.Playing;
            ui.HideLoading();
            traveling = false;
            SaveSystem.SaveLevel(this);
        }

        int FindAbismoY(int x, int z)
        {
            for (int y = 40; y < 100; y++)
                if (world.GetBlock(x, y, z).id == 0 && world.GetBlock(x, y + 1, z).id == 0 && world.GetBlock(x, y - 1, z).Collides) return y;
            return 64;
        }

        // ================================================================== final del juego
        public void OnDragonDefeated(Vector3 pos)
        {
            dragonDefeated = true;
            int y = world.GroundY(0, 0);
            if (y < 0) y = 64;
            for (int dz = -2; dz <= 2; dz++)
                for (int dx = -2; dx <= 2; dx++)
                {
                    bool edge = Mathf.Abs(dx) == 2 || Mathf.Abs(dz) == 2;
                    world.SetBlock(dx, y, dz, B.Bedrock, 0, false);
                    world.SetBlock(dx, y + 1, dz, edge ? (Mathf.Abs(dx) == 2 && Mathf.Abs(dz) == 2 ? B.Air : B.Bedrock) : B.EndPortal, 0, false);
                    for (int k = 2; k <= 6; k++) world.SetBlock(dx, y + k, dz, B.Air, 0, false);
                }
            for (int k = 1; k <= 3; k++) world.SetBlock(0, y + 1 + k, 0, B.Bedrock, 0, false);
            world.SetBlock(0, y + 5, 0, B.DragonEgg, 0, false);
            foreach (var s in new[] { new[] { -2, 0 }, new[] { 2, 0 }, new[] { 0, -2 }, new[] { 0, 2 } }) world.SetBlock(s[0], y + 2, s[1], B.Torch, 0, false);
            var drop = new Vector3(0.5f, y + 3f, 0.5f);
            SpawnItem(drop, new ItemStack(Items.Get("dragon_scale"), rand.Range(3, 7)), Vector3.up * 4f);
            SpawnItem(drop, new ItemStack(Items.Get("dragon_heart"), 1), Vector3.up * 5f);
            Explode(drop, 2f, null, false, true);
            ui.Toast("¡Has derrotado al Dragón del Final! Entra en el portal para volver a casa.");
            SaveSystem.SaveLevel(this);
        }
    }
}
