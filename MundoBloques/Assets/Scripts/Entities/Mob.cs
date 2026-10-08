using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Criatura (pacifica, hostil o sobrenatural) con IA sencilla y modelo de cubos.</summary>
    public sealed class Mob : Entity, IMount
    {
        public MobDef def;
        public bool isBaby, provoked, persistent;
        public float ageSec, love, breedCooldown, eggTimer;
        public int woolColor; public bool sheared;
        public Vector3 home;
        public Villager villager;
        public int spawnId;
        public bool tamed, sitting, saddled;
        Entity foe;
        Player rider;
        public Player Rider { get { return rider; } set { rider = value; } }
        public Transform MountTransform { get { return transform; } }
        public Vector3 SeatPosition { get { return transform.position + new Vector3(0f, 1.0f, 0f); } }

        // IA
        float thinkTimer, panicTimer, attackCd, shootCd, fuse, teleportCd, hopCd, lookTimer;
        int burstLeft; float burstTimer;
        Vector3 wanderTarget; bool hasWander; float idleTimer;
        bool aggro;
        float walkPhase, walkAmp, flap, animTime;
        Transform modelRoot;
        readonly List<Transform> partT = new List<Transform>();
        readonly List<Part> partD = new List<Part>();
        readonly List<Vector3> partBase = new List<Vector3>();
        readonly List<Renderer> rends = new List<Renderer>();
        MaterialPropertyBlock mpb;
        float lightTimer, lastFlash = -1f, curLight = 1f;
        float yawBody;
        float headYaw, headPitch;
        Vector3 desired;
        int fuseFlash;

        public override bool Hostile { get { return def.hostile; } }
        public override float EyeHeight { get { return height * 0.85f; } }

        public static Mob Create(MobDef def, Vector3 pos, bool baby = false, int variant = -1)
        {
            var go = new GameObject(def.name);
            go.transform.SetParent(GameRoot.I.entityRoot, false);
            go.transform.position = pos;
            var m = go.AddComponent<Mob>();
            m.def = def; m.isBaby = baby;
            m.maxHealth = m.health = def.health;
            m.width = def.width * (baby ? 0.5f : 1f); m.height = def.height * (baby ? 0.5f : 1f);
            m.home = pos;
            m.yawBody = Random.value * 360f;
            m.woolColor = def.key == "sheep" ? (Random.value < 0.8f ? 0 : GameRoot.I.rand.Int(16)) : 0;
            if (def.key == "horse") m.woolColor = variant >= 0 ? Mathf.Min(variant, MobDefs.HorseBody.Length - 1) : GameRoot.I.rand.Int(MobDefs.HorseBody.Length);
            m.eggTimer = Random.Range(120f, 400f);
            m.noGravity = def.flies;
            m.stepHeight = def.ai == AI.Fish ? 0f : 0.6f;
            m.BuildModel();
            if (def.ai == AI.Villager) m.villager = new Villager(m);
            return m;
        }

        // ---------------------------------------------------------------- modelo
        void BuildModel()
        {
            modelRoot = new GameObject("model").transform;
            modelRoot.SetParent(transform, false);
            float s = def.scale * (isBaby ? 0.5f : 1f);
            mpb = new MaterialPropertyBlock();
            for (int i = 0; i < def.parts.Count; i++)
            {
                var p = def.parts[i];
                var go = new GameObject(p.name);
                go.transform.SetParent(modelRoot, false);
                var pivot = p.pivot * (s / 16f);
                go.transform.localPosition = pivot;
                var mesh = new GameObject("m");
                mesh.transform.SetParent(go.transform, false);
                mesh.transform.localPosition = p.off * (s / 16f);
                mesh.transform.localScale = Vector3.one * s;
                var col = p.color;
                if (def.key == "sheep" && p.name == "body")
                    col = sheared ? Col.Hex(0xE8C8B0) : Col.Hex(Dyes.Colors[woolColor]);
                else if (def.key == "horse") col = HorseColor(p.name, p.color);
                mesh.AddComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(p.size, col);
                var mr = mesh.AddComponent<MeshRenderer>();
                mr.sharedMaterial = Mats.Mob;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                mr.receiveShadows = false;
                rends.Add(mr);
                partT.Add(go.transform); partD.Add(p); partBase.Add(pivot);
            }
            if (def.key == "sheep") RecolorSheep();
            UpdateParts();
            ApplyProps(true);
        }

        Color32 HorseColor(string part, Color32 fallback)
        {
            int v = Mathf.Clamp(woolColor, 0, MobDefs.HorseBody.Length - 1);
            if (part == "body" || part.StartsWith("neck") || part == "head" || part.StartsWith("ear") || part.StartsWith("leg")) return Col.Hex(MobDefs.HorseBody[v]);
            if (part == "muzzle") return Col.Mul(Col.Hex(MobDefs.HorseBody[v]), 1.18f);
            if (part == "mane" || part == "tail") return Col.Hex(MobDefs.HorseMane[v]);
            return fallback;
        }

        /// <summary>Muestra u oculta piezas segun el estado (collar del lobo, montura del caballo).</summary>
        void UpdateParts()
        {
            for (int i = 0; i < partD.Count && i < rends.Count; i++)
            {
                string n = partD[i].name;
                if (n == "collar") rends[i].enabled = tamed;
                else if (n == "saddle" || n == "saddleHorn") rends[i].enabled = saddled;
            }
        }

        public int Flags { get { return (tamed ? 1 : 0) | (sitting ? 2 : 0) | (saddled ? 4 : 0) | (isBaby ? 8 : 0); } }

        public void ApplyFlags(int f, float hp)
        {
            tamed = (f & 1) != 0; sitting = (f & 2) != 0; saddled = (f & 4) != 0;
            if (tamed && def.ai == AI.Wolf) maxHealth = 20f;
            if (hp > 0f) health = Mathf.Min(maxHealth, hp);
            UpdateParts();
        }

        void EnsureId()
        {
            persistent = true;
            if (spawnId == 0) { spawnId = G.NewMobId(); G.persistentIds.Add(spawnId); }
        }

        void RecolorSheep()
        {
            // la lana es el cuerpo y una capa sobre la cabeza/patas: se reconstruye la malla del cuerpo
            for (int i = 0; i < partD.Count; i++)
            {
                if (partD[i].name == "body")
                {
                    var c = sheared ? Col.Hex(0xD8B8A0) : Col.Hex(Dyes.Colors[woolColor]);
                    rends[i].GetComponent<MeshFilter>().sharedMesh = MobDefs.BoxMesh(sheared ? partD[i].size * 0.92f : partD[i].size * 1.05f, c);
                }
            }
        }

        void ApplyProps(bool force)
        {
            float flash = hurtFlash > 0 ? 1f : 0f;
            mpb.SetFloat("_ObjLight", def.glow ? 1f : curLight);
            mpb.SetColor("_Tint", flash > 0 ? new Color(1f, 0.35f, 0.35f) : (fuseFlash == 1 ? new Color(2.5f, 2.5f, 2.5f) : Color.white));
            for (int i = 0; i < rends.Count; i++) rends[i].SetPropertyBlock(mpb);
            lastFlash = flash;
        }

        // ---------------------------------------------------------------- ciclo de vida
        void Update()
        {
            if (G == null || W == null || G.paused || dead) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            var p0 = transform.position;
            if (!W.IsLoaded(Mathf.FloorToInt(p0.x), Mathf.FloorToInt(p0.z))) return;
            var pl = G.player;
            float pd = pl != null ? (pl.transform.position - p0).magnitude : 0f;
            if (!persistent && pd > 112f) { dead = true; Destroy(gameObject); return; }
            if (!persistent && def.hostile && pd > 48f && Random.value < dt * 0.05f) { dead = true; Destroy(gameObject); return; }
            ageSec += dt;
            if (isBaby && ageSec > 600f) Grow();
            if (breedCooldown > 0) breedCooldown -= dt;
            if (love > 0) love -= dt;
            attackCd -= dt; shootCd -= dt; teleportCd -= dt; hopCd -= dt; panicTimer -= dt;
            if (def.ai == AI.Horse) stepHeight = rider != null ? 1.05f : 0.6f;
            if (rider != null && (rider.dead || rider.mount != (IMount)this)) rider = null;
            TickTimers(dt);
            if (dead) return;

            desired = Vector3.zero;
            Think(dt, pl, pd);

            // movimiento horizontal hacia la velocidad deseada
            float accel = onGround ? 12f : (def.flies ? 5f : 4f);
            float k = 1f - Mathf.Exp(-accel * dt);
            if (invuln > 0.2f && def.ai != AI.Fish) { }
            else if (!(def.ai == AI.Exploder && fuse > 0f))
            {
                vel.x = Mathf.Lerp(vel.x, desired.x, k);
                vel.z = Mathf.Lerp(vel.z, desired.z, k);
            }
            else { vel.x = Mathf.Lerp(vel.x, 0, k); vel.z = Mathf.Lerp(vel.z, 0, k); }
            if (def.flies) vel.y = Mathf.Lerp(vel.y, desired.y, 1f - Mathf.Exp(-3f * dt));
            else if (def.ai == AI.Fish)
            {
                noGravity = inWater;
                if (inWater) vel.y = Mathf.Lerp(vel.y, desired.y, 1f - Mathf.Exp(-3f * dt));
            }
            else
            {
                if (inWater || inLava) { if (headInWater || vel.y < 0f) vel.y = Mathf.Max(vel.y, 1.6f); }
                else if (hitWall && onGround && desired.sqrMagnitude > 0.01f && rider == null) { vel.y = 8.4f; onGround = false; }
            }
            // orientacion
            var hv = new Vector3(vel.x, 0, vel.z);
            if (hv.sqrMagnitude > 0.04f || faceTarget)
            {
                float ty = faceTarget ? faceYaw : Mathf.Atan2(hv.x, hv.z) * Mathf.Rad2Deg;
                yawBody = Mathf.MoveTowardsAngle(yawBody, ty, 280f * dt);
            }
            modelRoot.rotation = Quaternion.Euler(0, yawBody, 0);
            faceTarget = false;
            StepPhysics(dt);
            if (def.ai == AI.Fish && !inWater && onGround && Random.value < dt * 2f) { vel.y = 4f; vel.x = Random.Range(-1f, 1f); Damage(1f, p0, null, 0f); }
            Animate(dt, hv.magnitude);
            AmbientAndProps(dt);
        }

        bool faceTarget; float faceYaw;
        void FaceDir(Vector3 d) { if (d.sqrMagnitude < 0.0001f) return; faceTarget = true; faceYaw = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg; }

        void Grow()
        {
            isBaby = false;
            width = def.width; height = def.height;
            for (int i = 0; i < partT.Count; i++)
            {
                partT[i].localPosition = partD[i].pivot * (def.scale / 16f); partBase[i] = partT[i].localPosition;
                var m = partT[i].GetChild(0);
                m.localPosition = partD[i].off * (def.scale / 16f); m.localScale = Vector3.one * def.scale;
            }
        }

        void AmbientAndProps(float dt)
        {
            lightTimer -= dt;
            bool changed = false;
            if (lightTimer <= 0f) { lightTimer = 0.4f; float l = Mathf.Clamp01(LightAt() * 1.05f + 0.1f); if (Mathf.Abs(l - curLight) > 0.02f) { curLight = l; changed = true; } }
            float flash = hurtFlash > 0 ? 1f : 0f;
            int ff = (def.ai == AI.Exploder && fuse > 0f && Mathf.FloorToInt(fuse * 8f) % 2 == 0) ? 1 : 0;
            if (flash != lastFlash || ff != fuseFlash) { fuseFlash = ff; changed = true; }
            if (changed) ApplyProps(false);
            if (def.ambientChance > 0 && Random.value < def.ambientChance * dt * 20f && G.player != null && (G.player.transform.position - transform.position).sqrMagnitude < 576f)
                Sfx.Play(def.ambient, transform.position, 0.7f, isBaby ? 1.5f : 1f);
            if (burn > 0 && Random.value < dt * 12f) Particles.Burst(transform.position + Vector3.up * height * 0.6f, new Color32(255, 140, 30, 255), 1, 0.8f, 0.12f, 0.4f);
            if (def.glow && Random.value < dt * 3f) Particles.Burst(transform.position + Vector3.up * height * 0.5f, def.ai == AI.Blaze ? new Color32(255, 170, 40, 255) : new Color32(150, 245, 255, 255), 1, 0.4f, 0.1f, 0.8f, new Vector3(0.3f, 0.4f, 0.3f));
            // quemadura de dia
            if (def.burnsInDay && Mathf.FloorToInt(animTime) != Mathf.FloorToInt(animTime - dt) && G.world.dim == Dim.Overworld && G.sky.IsDay)
            {
                var p = transform.position;
                int x = Mathf.FloorToInt(p.x), y = Mathf.FloorToInt(p.y + height), z = Mathf.FloorToInt(p.z);
                if (!inWater && W.SkyLight(x, y, z) >= 14 && !W.GetBlock(x, y, z).FullOpaque) SetOnFire(6f);
            }
        }

        // ---------------------------------------------------------------- IA
        void Think(float dt, Player pl, float pd)
        {
            animTime += dt;
            bool plTargetable = pl != null && !pl.dead && !G.creative;
            switch (def.ai)
            {
                case AI.Passive: ThinkPassive(dt, pl, pd); break;
                case AI.Villager: ThinkVillager(dt, pl, pd); break;
                case AI.Fish: ThinkFish(dt); break;
                case AI.Wolf: ThinkWolf(dt, pl, pd); break;
                case AI.Horse: ThinkHorse(dt, pl, pd); break;
                case AI.Spirit: ThinkSpirit(dt); break;
                case AI.Blaze: ThinkBlaze(dt, pl, pd, plTargetable); break;
                case AI.Wanderer: ThinkWanderer(dt, pl, pd, plTargetable); break;
                default: ThinkHostile(dt, pl, pd, plTargetable); break;
            }
        }

        bool CliffAhead(Vector3 dir)
        {
            var b = Box; float s = 0.7f;
            var moved = new AABB(b.x0 + dir.x * s, b.y0, b.z0 + dir.z * s, b.x1 + dir.x * s, b.y1, b.z1 + dir.z * s);
            return !Phys.HasGround(W, moved, 1.4f) && !inWater;
        }

        void Wander(float dt, float speed, float range, bool avoidCliff = true)
        {
            idleTimer -= dt;
            if (idleTimer <= 0f)
            {
                if (Random.value < 0.55f) { hasWander = false; idleTimer = Random.Range(1.5f, 5f); }
                else
                {
                    var a = Random.value * 6.2831f; var r = Random.Range(3f, range);
                    wanderTarget = home + new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r);
                    if ((wanderTarget - transform.position).magnitude > range * 2f) wanderTarget = transform.position + new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r);
                    hasWander = true; idleTimer = Random.Range(3f, 8f);
                }
            }
            if (!hasWander) return;
            var d = wanderTarget - transform.position; d.y = 0;
            if (d.magnitude < 0.7f) { hasWander = false; return; }
            d.Normalize();
            if (avoidCliff && onGround && CliffAhead(d)) { hasWander = false; idleTimer = 0.3f; return; }
            desired = d * speed;
        }

        void ThinkPassive(float dt, Player pl, float pd)
        {
            if (panicTimer > 0f)
            {
                var away = transform.position - panicFrom; away.y = 0;
                if (away.sqrMagnitude < 0.01f) away = Random.insideUnitSphere; away.y = 0;
                desired = away.normalized * def.speed * 1.9f;
                return;
            }
            // seguir al jugador con comida
            if (pl != null && !isBaby && pd < 9f && !pl.inv.Held.IsEmpty && def.breedItem != null && pl.inv.Held.item.key == def.breedItem)
            {
                var d = pl.transform.position - transform.position; d.y = 0;
                if (d.magnitude > 1.8f) { desired = d.normalized * def.speed; FaceDir(d); return; }
            }
            // enamoramiento
            if (love > 0f && breedCooldown <= 0f)
            {
                Mob mate = null; float bd = 100f;
                for (int i = 0; i < All.Count; i++)
                {
                    var o = All[i] as Mob;
                    if (o == null || o == this || o.def != def || o.love <= 0f || o.isBaby || o.dead) continue;
                    float d2 = (o.transform.position - transform.position).sqrMagnitude;
                    if (d2 < bd && d2 < 100f) { bd = d2; mate = o; }
                }
                if (mate != null)
                {
                    var d = mate.transform.position - transform.position; d.y = 0;
                    if (d.magnitude < 1.4f)
                    {
                        love = 0; mate.love = 0; breedCooldown = 240f; mate.breedCooldown = 240f;
                        Advancements.Event("breed");
                        var baby = Mob.Create(def, (transform.position + mate.transform.position) * 0.5f, true);
                        baby.sheared = false; baby.woolColor = woolColor;
                        Particles.Burst(transform.position + Vector3.up, new Color32(255, 80, 120, 255), 10, 1.5f, 0.12f, 0.8f);
                        Sfx.Play(Clip.Pop, transform.position, 0.6f, 1.4f);
                    }
                    else { desired = d.normalized * def.speed; FaceDir(d); }
                    return;
                }
            }
            Wander(dt, def.speed * 0.6f, 9f);
            // puesta de huevos / lana
            if (def.key == "chicken" && !isBaby)
            {
                eggTimer -= dt;
                if (eggTimer <= 0f) { eggTimer = Random.Range(300f, 600f); G.SpawnItem(transform.position + Vector3.up * 0.3f, new ItemStack(Items.Get("egg"), 1), Vector3.up * 2f); Sfx.Play(Clip.Pop, transform.position, 0.5f); }
                if (!onGround && vel.y < 0) vel.y = Mathf.Max(vel.y, -2.2f);
            }
            if (def.key == "sheep" && sheared)
            {
                eggTimer -= dt;
                if (eggTimer <= 0f) { sheared = false; eggTimer = Random.Range(120f, 400f); RecolorSheep(); }
            }
        }

        Vector3 panicFrom;

        // ---------------------------------------------------------------- lobos y caballos
        static bool IsMeat(Item it)
        {
            switch (it.key)
            {
                case "beef": case "pork": case "chicken": case "mutton": case "rabbit": case "rotten_flesh": case "cod": case "salmon":
                case "cooked_beef": case "cooked_pork": case "cooked_chicken": case "cooked_mutton": case "cooked_rabbit": case "cooked_cod": case "cooked_salmon": return true;
            }
            return false;
        }

        void ThinkWolf(float dt, Player pl, float pd)
        {
            if (foe != null && (foe.dead || (foe.transform.position - transform.position).sqrMagnitude > 576f)) foe = null;
            if (foe != null && foe.IsPlayer && (tamed || G.creative)) foe = null;
            if (tamed)
            {
                if (sitting) return;
                thinkTimer -= dt;
                if (foe == null && thinkTimer <= 0f && pl != null)
                {
                    thinkTimer = 0.6f;
                    var e = Entity.Closest(pl.transform.position, 12f, x => { var mm = x as Mob; return mm != null && !mm.dead && mm.def.hostile && mm.def.ai != AI.Exploder; });
                    if (e != null) foe = e;
                }
                if (foe != null) { ChaseFoe(); return; }
                if (pl != null && !pl.dead)
                {
                    var d = pl.transform.position - transform.position; d.y = 0f;
                    float dist = d.magnitude;
                    if (dist > 24f && pl.onGround) { TeleportNear(pl.transform.position, 3f); return; }
                    if (dist > 4.5f) { desired = d.normalized * def.speed * (dist > 10f ? 1.6f : 1.15f); FaceDir(d); if (onGround && CliffAhead(d.normalized) && dist < 12f) desired = Vector3.zero; }
                    else if (dist > 2.6f) FaceDir(d);
                }
                return;
            }
            if (foe != null) { ChaseFoe(); return; }
            Wander(dt, def.speed * 0.5f, 12f);
        }

        void ChaseFoe()
        {
            var d = foe.transform.position - transform.position; d.y = 0f;
            float dist = d.magnitude;
            FaceDir(d); desired = d.normalized * def.speed * 1.5f;
            if (dist < 1.5f && attackCd <= 0f && Mathf.Abs(foe.transform.position.y - transform.position.y) < 1.6f)
            {
                attackCd = 0.9f;
                foe.Damage(tamed ? 4f : 3f, transform.position, this, 0.5f);
                Sfx.Play(Clip.Bark, transform.position, 0.7f);
            }
        }

        void ThinkHorse(float dt, Player pl, float pd)
        {
            if (rider == null) { ThinkPassive(dt, pl, pd); return; }
            bool ui = G.ui.IsOpen;
            var inp = ui ? Vector2.zero : new Vector2(Inp.Axis(Act.Left, Act.Right), Inp.Axis(Act.Back, Act.Forward));
            float yr = rider.yaw * Mathf.Deg2Rad;
            var fwd = new Vector3(Mathf.Sin(yr), 0f, Mathf.Cos(yr)); var right = new Vector3(Mathf.Cos(yr), 0f, -Mathf.Sin(yr));
            var wish = fwd * inp.y + right * inp.x;
            if (wish.sqrMagnitude > 1f) wish.Normalize();
            bool sprint = !ui && Inp.Held(Act.Sprint);
            desired = wish * (sprint ? 11.5f : 8f);
            if (!ui && Inp.Held(Act.Jump) && (onGround || inWater) && hopCd <= 0f) { vel.y = inWater ? 5f : 9.6f; onGround = false; hopCd = 0.25f; }
            panicTimer = 0f;
        }

        void Tame(Player p)
        {
            tamed = true; sitting = false; foe = null; maxHealth = 20f; health = 20f;
            EnsureId(); UpdateParts();
            p.petsTamed++;
            Particles.Burst(transform.position + Vector3.up * height, new Color32(255, 80, 120, 255), 12, 1.5f, 0.12f, 0.9f);
            Sfx.Play(Clip.Bark, transform.position, 0.8f, 1.2f);
            G.ui.Hint("¡Has domesticado al lobo! Clic derecho: sentarse / seguir", 3f);
        }

        void ThinkVillager(float dt, Player pl, float pd)
        {
            if (villager != null && villager.trading) { var d = pl.transform.position - transform.position; FaceDir(d); return; }
            if (panicTimer > 0f)
            {
                var away = transform.position - panicFrom; away.y = 0;
                desired = away.normalized * def.speed * 1.7f; return;
            }
            // huir de los zombis
            var z = Entity.Closest(transform.position, 8f, e => e is Mob && ((Mob)e).def.hostile && !e.dead);
            if (z != null) { var away = transform.position - z.transform.position; away.y = 0; desired = away.normalized * def.speed * 1.5f; return; }
            if (G.sky.IsNight) { Wander(dt, def.speed * 0.4f, 4f); return; }
            Wander(dt, def.speed * 0.6f, 12f);
        }

        void ThinkFish(float dt)
        {
            if (!inWater) { return; }
            idleTimer -= dt;
            if (idleTimer <= 0f || !hasWander)
            {
                idleTimer = Random.Range(2f, 5f);
                var o = Random.insideUnitSphere * 5f; o.y *= 0.4f;
                wanderTarget = transform.position + o; hasWander = true;
            }
            var d = wanderTarget - transform.position;
            if (d.magnitude < 0.6f) { hasWander = false; return; }
            // no salir del agua
            var ahead = transform.position + d.normalized * 0.8f;
            if (!B.IsWaterlike(W.GetBlock(Mathf.FloorToInt(ahead.x), Mathf.FloorToInt(ahead.y), Mathf.FloorToInt(ahead.z)))) { hasWander = false; idleTimer = 0.2f; desired = Vector3.zero; return; }
            var n = d.normalized * def.speed;
            desired = n; desired.y = n.y;
            FaceDir(new Vector3(d.x, 0, d.z));
        }

        void ThinkSpirit(float dt)
        {
            idleTimer -= dt;
            if (idleTimer <= 0f || !hasWander)
            {
                idleTimer = Random.Range(2f, 5f);
                wanderTarget = home + new Vector3(Random.Range(-7f, 7f), Random.Range(0.5f, 4.5f), Random.Range(-7f, 7f)); hasWander = true;
            }
            if (panicTimer > 0f) { var away = transform.position - panicFrom; desired = away.normalized * def.speed * 2f; desired.y = 1f; return; }
            var d = wanderTarget - transform.position;
            if (d.magnitude < 0.7f) { hasWander = false; return; }
            desired = d.normalized * def.speed;
            FaceDir(new Vector3(d.x, 0, d.z));
            var pl = G.player;
            if (pl != null && (pl.transform.position - transform.position).sqrMagnitude < 9f) { var f = pl.transform.position - transform.position; FaceDir(new Vector3(f.x, 0, f.z)); }
        }

        bool HasLos(Vector3 from, Vector3 to)
        {
            var d = to - from; float len = d.magnitude;
            if (len < 0.5f) return true;
            var h = Phys.Raycast(W, from, d, len, false);
            return !h.hit || h.dist >= len - 0.4f;
        }

        void ThinkHostile(float dt, Player pl, float pd, bool targetable)
        {
            bool neutral = def.ai == AI.Spider && G.sky.IsDay && !provoked && LightAt() > 0.55f;
            if (foe != null && (foe.dead || (foe.transform.position - transform.position).sqrMagnitude > 196f)) foe = null;
            if (foe != null && def.ai != AI.Skeleton && def.ai != AI.Exploder && def.ai != AI.Golem)
            {
                var fv = foe.transform.position - transform.position; fv.y = 0f;
                float fdl = fv.magnitude;
                if (!targetable || neutral || fdl < pd)
                {
                    FaceDir(fv); desired = fv.normalized * def.speed;
                    if (def.ai == AI.Slime && onGround && hopCd <= 0f) { hopCd = Random.Range(0.6f, 1.1f); vel = fv.normalized * def.speed * 1.4f + Vector3.up * 7.5f; onGround = false; }
                    if (def.ai == AI.Slime && !onGround) desired = fv.normalized * def.speed * 1.4f;
                    if (fdl < 1.5f + def.width && attackCd <= 0f && Mathf.Abs(foe.transform.position.y - transform.position.y) < 2f)
                    {
                        attackCd = 1f; foe.Damage(def.damage, transform.position, this, 0.5f);
                    }
                    return;
                }
            }
            if (!targetable || neutral || pd > def.sight + 8f)
            {
                Wander(dt, def.speed * 0.5f, 10f); return;
            }
            var to = pl.transform.position - transform.position;
            var flat = new Vector3(to.x, 0, to.z);
            float fd = flat.magnitude;
            bool sees = pd < def.sight && (HasLos(Eye, pl.Eye) || pd < 8f) || provoked && pd < def.sight * 1.5f;
            if (!sees) { Wander(dt, def.speed * 0.5f, 10f); return; }
            FaceDir(flat);
            switch (def.ai)
            {
                case AI.Skeleton:
                    {
                        float want = 7f;
                        if (fd > want + 3f) desired = flat.normalized * def.speed;
                        else if (fd < want - 2.5f) desired = -flat.normalized * def.speed * 0.8f;
                        else desired = Quaternion.Euler(0, Mathf.Sin(animTime * 0.5f) > 0 ? 90 : -90, 0) * flat.normalized * def.speed * 0.5f;
                        if (shootCd <= 0f && fd < 20f)
                        {
                            shootCd = Random.Range(1.4f, 2.4f);
                            var dir = (pl.Eye - Eye);
                            dir.y += fd * 0.06f;
                            Projectile.Spawn(ProjKind.Arrow, Eye + flat.normalized * 0.5f, dir.normalized * (18f + fd * 0.4f) + new Vector3(Random.Range(-0.8f, 0.8f), 0, Random.Range(-0.8f, 0.8f)), this, def.damage);
                            Sfx.Play(Clip.Bow, transform.position, 0.7f);
                        }
                        break;
                    }
                case AI.Exploder:
                    {
                        if (fd < 3f && Mathf.Abs(to.y) < 2.5f)
                        {
                            if (fuse <= 0f) Sfx.Play(Clip.Hiss, transform.position, 1f);
                            fuse += dt;
                            if (fuse >= 1.5f) { Detonate(); return; }
                        }
                        else
                        {
                            fuse = Mathf.Max(0f, fuse - dt * 2f);
                            desired = flat.normalized * def.speed;
                        }
                        break;
                    }
                case AI.Spider:
                    {
                        desired = flat.normalized * def.speed;
                        if (fd > 2f && fd < 4.5f && onGround && hopCd <= 0f) { hopCd = 1.8f; vel = flat.normalized * 6.5f + Vector3.up * 6f; onGround = false; }
                        MeleeCheck(pl, fd, to);
                        break;
                    }
                case AI.Slime:
                    {
                        if (onGround && hopCd <= 0f) { hopCd = Random.Range(0.6f, 1.1f); vel = flat.normalized * def.speed * 1.4f + Vector3.up * 7.5f; onGround = false; }
                        if (!onGround) desired = flat.normalized * def.speed * 1.4f;
                        MeleeCheck(pl, fd, to);
                        break;
                    }
                case AI.Golem:
                    desired = flat.normalized * def.speed;
                    MeleeCheck(pl, fd, to, 2.4f);
                    break;
                default:
                    desired = flat.normalized * def.speed * (inWater && def.key == "drowned" ? 1.2f : 1f);
                    MeleeCheck(pl, fd, to);
                    break;
            }
            if (def.ai != AI.Skeleton && def.ai != AI.Exploder && onGround && CliffAhead(desired.normalized) && fd > 3f && def.ai != AI.Slime) desired = Vector3.zero;
        }

        void MeleeCheck(Player pl, float fd, Vector3 to, float reach = 1.5f)
        {
            if (fd < reach + def.width && Mathf.Abs(to.y) < 2f && attackCd <= 0f)
            {
                attackCd = def.ai == AI.Golem ? 1.6f : 1f;
                pl.Damage(def.damage, transform.position, this, def.ai == AI.Golem ? 1.2f : 0.5f);
                if (def.ai == AI.Golem) pl.vel.y = 8f;
                Sfx.Play(Clip.Hit, pl.transform.position, 0.6f);
            }
        }

        void Detonate()
        {
            dead = true;
            var p = transform.position + Vector3.up * 0.8f;
            Destroy(gameObject);
            G.Explode(p, 3.2f, this, true, false);
        }

        void ThinkBlaze(float dt, Player pl, float pd, bool targetable)
        {
            noGravity = true;
            if (!targetable || pd > def.sight)
            {
                idleTimer -= dt;
                if (idleTimer <= 0f) { idleTimer = Random.Range(2f, 4f); wanderTarget = home + new Vector3(Random.Range(-8f, 8f), Random.Range(-2f, 4f), Random.Range(-8f, 8f)); }
                var d = wanderTarget - transform.position; if (d.magnitude > 1f) desired = d.normalized * def.speed * 0.5f;
                return;
            }
            var to = pl.Eye - transform.position;
            var flat = new Vector3(to.x, 0, to.z);
            float fd = flat.magnitude;
            FaceDir(flat);
            float want = 8f;
            Vector3 mv = Vector3.zero;
            if (fd > want + 3f) mv += flat.normalized; else if (fd < want - 3f) mv -= flat.normalized;
            mv += Quaternion.Euler(0, 90, 0) * flat.normalized * 0.5f * Mathf.Sin(animTime * 0.6f);
            float targetY = pl.transform.position.y + 3.5f + Mathf.Sin(animTime) * 1f;
            desired = mv.normalized * def.speed;
            desired.y = Mathf.Clamp((targetY - transform.position.y) * 1.2f, -2.5f, 2.5f);
            if (hitWall) desired.y = 3f;
            // disparo en rafagas
            if (burstLeft > 0)
            {
                burstTimer -= dt;
                if (burstTimer <= 0f)
                {
                    burstTimer = 0.35f; burstLeft--;
                    var dir = (pl.Eye - Eye).normalized;
                    Projectile.Spawn(ProjKind.Fireball, Eye + dir * 0.7f, dir * 13f + new Vector3(Random.Range(-0.6f, 0.6f), 0, Random.Range(-0.6f, 0.6f)), this, 5f);
                    Sfx.Play(Clip.Whoosh, transform.position, 0.7f, 0.6f);
                }
            }
            else if (shootCd <= 0f && HasLos(Eye, pl.Eye) && pd < 26f) { shootCd = 4f; burstLeft = 3; burstTimer = 0.2f; }
        }

        void ThinkWanderer(float dt, Player pl, float pd, bool targetable)
        {
            if (inWater && teleportCd <= 0f) { Teleport(); return; }
            if (targetable && !aggro && pd < 30f)
            {
                var look = pl.camT.forward; var dir = (Eye - pl.Eye).normalized;
                if (Vector3.Dot(look, dir) > 0.985f && HasLos(pl.Eye, Eye)) { aggro = true; Sfx.Play(Clip.Growl, transform.position, 1f, 1.3f); }
            }
            if (!aggro && !provoked) { Wander(dt, def.speed * 0.3f, 10f); return; }
            aggro = true;
            if (!targetable) { aggro = false; return; }
            var to = pl.transform.position - transform.position; var flat = new Vector3(to.x, 0, to.z);
            FaceDir(flat);
            if (pd > 32f) { aggro = false; return; }
            if (pd > 16f && teleportCd <= 0f && Random.value < dt * 0.5f) { TeleportNear(pl.transform.position, 4f); return; }
            desired = flat.normalized * def.speed * 1.1f;
            MeleeCheck(pl, flat.magnitude, to, 1.6f);
        }

        void Teleport()
        {
            teleportCd = 1.2f;
            for (int i = 0; i < 12; i++)
            {
                var p = transform.position + new Vector3(Random.Range(-16f, 16f), 0, Random.Range(-16f, 16f));
                if (TryPlaceAt(p)) return;
            }
        }

        void TeleportNear(Vector3 c, float r)
        {
            teleportCd = 3f;
            for (int i = 0; i < 12; i++)
                if (TryPlaceAt(c + new Vector3(Random.Range(-r, r), 0, Random.Range(-r, r)))) return;
        }

        bool TryPlaceAt(Vector3 p)
        {
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            if (!W.IsLoaded(x, z)) return false;
            int y = W.GroundY(x, z);
            if (y < 0) return false;
            var tp = new Vector3(x + 0.5f, y + 1f, z + 0.5f);
            var box = AABB.At(tp, width, height);
            if (Phys.Overlaps(W, box)) return false;
            if (B.IsWaterlike(W.GetBlock(x, y + 1, z))) return false;
            bool fx = def.ai != AI.Wolf;
            if (fx) Particles.Burst(transform.position + Vector3.up, new Color32(180, 60, 255, 255), 14, 2f);
            transform.position = tp; vel = Vector3.zero;
            if (fx) { Particles.Burst(tp + Vector3.up, new Color32(180, 60, 255, 255), 14, 2f); Sfx.Play(Clip.Teleport, tp, 0.8f); }
            return true;
        }

        // ---------------------------------------------------------------- animacion
        void Animate(float dt, float speed)
        {
            float target = Mathf.Clamp01(speed / Mathf.Max(0.5f, def.speed)) * (onGround || inWater || def.flies ? 1f : 0.3f);
            walkAmp = Mathf.Lerp(walkAmp, target, 1f - Mathf.Exp(-10f * dt));
            walkPhase += dt * (4f + speed * 3.5f);
            flap += dt * (onGround ? 0f : 22f);
            var pl = G.player;
            float lookY = 0, lookP = 0;
            if (pl != null && (def.ai == AI.Villager || def.ai == AI.Passive || def.hostile || def.ai == AI.Spirit))
            {
                var d = pl.Eye - Eye;
                if (d.sqrMagnitude < 144f)
                {
                    float wy = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg;
                    lookY = Mathf.Clamp(Mathf.DeltaAngle(yawBody, wy), -60f, 60f);
                    lookP = Mathf.Clamp(-Mathf.Atan2(d.y, new Vector2(d.x, d.z).magnitude) * Mathf.Rad2Deg, -35f, 35f);
                }
            }
            headYaw = Mathf.Lerp(headYaw, lookY, 1f - Mathf.Exp(-8f * dt)); headPitch = Mathf.Lerp(headPitch, lookP, 1f - Mathf.Exp(-8f * dt));
            float sw = Mathf.Sin(walkPhase) * 45f * walkAmp;
            for (int i = 0; i < partT.Count; i++)
            {
                var t = partT[i];
                switch (partD[i].anim)
                {
                    case 'a': t.localRotation = Quaternion.Euler(sw, 0, 0); break;
                    case 'b': t.localRotation = Quaternion.Euler(-sw, 0, 0); break;
                    case 'A': t.localRotation = Quaternion.Euler(-sw * 0.8f, 0, 3f); break;
                    case 'B': t.localRotation = Quaternion.Euler(sw * 0.8f, 0, -3f); break;
                    case 'z': t.localRotation = Quaternion.Euler(-90f + Mathf.Sin(animTime * 2f + i) * 4f, 0, 0); break;
                    case 'h': t.localRotation = Quaternion.Euler(headPitch, headYaw, 0); break;
                    case 'w': t.localRotation = Quaternion.Euler(0, 0, -Mathf.Abs(Mathf.Sin(flap)) * 60f); break;
                    case 'W': t.localRotation = Quaternion.Euler(0, 0, Mathf.Abs(Mathf.Sin(flap)) * 60f); break;
                    case 't': t.localRotation = Quaternion.Euler(0, Mathf.Sin(animTime * 9f) * 28f, 0); break;
                    case 'k': t.localPosition = partBase[i] + new Vector3(0, Mathf.Sin(animTime * 2f + i) * 0.05f, 0); break;
                    case 'r':
                        {
                            var b0 = partBase[i];
                            if (def.ai == AI.Spirit) t.localRotation = Quaternion.Euler(0, animTime * 90f, 0);
                            else
                            {
                                var rot = Quaternion.Euler(0, animTime * 120f * (i % 2 == 0 ? 1 : -1), 0);
                                t.localPosition = rot * new Vector3(b0.x, 0, b0.z) + new Vector3(0, b0.y + Mathf.Sin(animTime * 3f + i) * 0.04f, 0);
                            }
                            break;
                        }
                }
            }
            if (def.ai == AI.Wolf) modelRoot.localPosition = sitting ? new Vector3(0f, -0.2f, 0f) : Vector3.zero;
            if (def.ai == AI.Slime)
            {
                float sq = onGround ? 1f : 1.15f;
                modelRoot.localScale = new Vector3(1f / sq, sq, 1f / sq);
            }
        }

        // ---------------------------------------------------------------- dano e interaccion
        protected override void OnHurt(float amount, Entity src)
        {
            provoked = true;
            panicFrom = src != null ? src.transform.position : transform.position + Random.insideUnitSphere;
            if (src != null && src != this)
            {
                if (def.ai == AI.Wolf) { sitting = false; if (!tamed || !src.IsPlayer) foe = src; }
                else if (def.hostile && !src.IsPlayer) foe = src;
            }
            if (def.ai == AI.Passive || def.ai == AI.Villager || def.ai == AI.Spirit || def.ai == AI.Fish) panicTimer = 4f;
            if (def.ai == AI.Wanderer) { aggro = true; if (Random.value < 0.4f && teleportCd <= 0f) Teleport(); }
            Sfx.Play(def.ai == AI.Passive && def.ambient != Clip.Pop ? def.ambient : Clip.Hurt, transform.position, 0.8f, 1.2f);
            // los zombis y esqueletos cercanos no cambian; pero las gallinas saltan
            if (def.key == "chicken" && !onGround) vel.y = 2f;
        }

        public override void Die(Entity killer)
        {
            if (dead) return;
            dead = true;
            if (spawnId != 0) G.persistentDead.Add(spawnId);
            if (rider != null) rider.Dismount();
            var drops = new List<ItemStack>();
            if (saddled) drops.Add(new ItemStack(Items.Get("saddle"), 1));
            if (!isBaby)
            {
                for (int i = 0; i < def.drops.Length; i++)
                {
                    var d = def.drops[i];
                    if (d.chance < 1f && Random.value > d.chance) continue;
                    var it = Items.Get(d.item); if (it == null) continue;
                    int n = d.min >= d.max ? d.min : Random.Range(d.min, d.max + 1);
                    if (burn > 0 && it.IsFood) { var sm = Recipes.FindSmelt(it); if (sm != null) it = Items.Get(sm.output); }
                    if (n > 0) drops.Add(new ItemStack(it, n));
                }
                if (def.key == "sheep" && !sheared) drops.Add(new ItemStack(B.Wool[woolColor].item, 1));
            }
            for (int i = 0; i < drops.Count; i++) G.SpawnItem(transform.position + Vector3.up * 0.5f, drops[i], new Vector3(Random.Range(-1.5f, 1.5f), Random.Range(2f, 4f), Random.Range(-1.5f, 1.5f)));
            Particles.Burst(transform.position + Vector3.up * height * 0.5f, new Color32(240, 240, 240, 255), 14, 2.5f, 0.14f, 0.6f);
            Sfx.Play(def.hostile ? Clip.Hit : Clip.Hurt, transform.position, 0.8f, 0.7f);
            if (killer != null && killer.IsPlayer) G.OnMobKilled(this);
            Destroy(gameObject);
        }

        /// <summary>Clic derecho del jugador sobre la criatura.</summary>
        public bool Interact(Player p)
        {
            var h = p.inv.Held;
            bool empty = h.IsEmpty;
            if (def.ai == AI.Villager && villager != null)
            {
                villager.trading = true;
                G.ui.OpenTrade(this);
                return true;
            }
            if (def.ai == AI.Wolf)
            {
                if (!tamed)
                {
                    if (!empty && h.item.key == "bone")
                    {
                        p.ConsumeHeld(1); Sfx.Play(Clip.Eat, transform.position, 0.6f);
                        if (G.rand.Chance(0.34f)) Tame(p);
                        else Particles.Burst(transform.position + Vector3.up * height, new Color32(150, 150, 150, 255), 8, 1f, 0.1f, 0.6f);
                        return true;
                    }
                    return false;
                }
                if (!empty && IsMeat(h.item) && health < maxHealth)
                {
                    Heal(Mathf.Max(2, h.item.hunger)); p.ConsumeHeld(1);
                    Particles.Burst(transform.position + Vector3.up * height, new Color32(255, 80, 120, 255), 6, 1f, 0.1f, 0.8f);
                    Sfx.Play(Clip.Eat, transform.position, 0.6f);
                    return true;
                }
                sitting = !sitting;
                G.ui.Hint(sitting ? "El lobo se queda aquí" : "El lobo te sigue", 1.4f);
                return true;
            }
            if (def.ai == AI.Horse && !isBaby)
            {
                if (!saddled && !empty && h.item.key == "saddle")
                {
                    p.ConsumeHeld(1); saddled = true; EnsureId(); UpdateParts();
                    Sfx.Play(Clip.Click, transform.position, 0.8f, 0.8f);
                    G.ui.Hint("Caballo ensillado: clic derecho para montar", 2.5f);
                    return true;
                }
                bool feeding = !empty && h.item.key == def.breedItem;
                if (saddled && rider == null && !feeding) { p.Mount(this); return true; }
                if (!saddled && empty) { G.ui.Hint("Necesita una montura", 1.6f); return true; }
            }
            if (empty) return false;
            if (def.key == "cow" && !isBaby && h.item.action == "bucket")
            {
                p.ReplaceHeld(Items.Get("milk_bucket")); Sfx.Play(Clip.Drink, transform.position); return true;
            }
            if (def.key == "sheep" && !isBaby && !sheared && h.item.action == "shears")
            {
                sheared = true; eggTimer = Random.Range(120f, 300f); RecolorSheep();
                G.SpawnItem(transform.position + Vector3.up * 0.8f, new ItemStack(B.Wool[woolColor].item, Random.Range(1, 4)), Vector3.up * 3f);
                p.WearHeld(1); Sfx.Play(Clip.Door, transform.position, 0.6f, 1.6f);
                return true;
            }
            if (def.breedItem != null && h.item.key == def.breedItem && !isBaby && love <= 0f && breedCooldown <= 0f)
            {
                p.ConsumeHeld(1); love = 20f;
                Particles.Burst(transform.position + Vector3.up * height, new Color32(255, 80, 120, 255), 8, 1f, 0.12f, 0.8f);
                Sfx.Play(Clip.Eat, transform.position, 0.6f);
                return true;
            }
            if (isBaby && def.breedItem != null && h.item.key == def.breedItem) { p.ConsumeHeld(1); ageSec += 120f; Sfx.Play(Clip.Eat, transform.position, 0.6f); return true; }
            return false;
        }
    }
}
