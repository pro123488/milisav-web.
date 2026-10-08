using UnityEngine;

namespace MundoBloques
{
    /// <summary>Jugador en primera persona: movimiento, supervivencia (vida, hambre, aire), camara.</summary>
    public sealed partial class Player : Entity
    {
        public Inventory inv = new Inventory();
        public float hunger = 20f, saturation = 5f, exhaustion, air = 15f;
        public float yaw, pitch;
        public Camera cam;
        public Transform camT;
        public bool flying, sprinting, sneaking;
        public Vector3 spawnPos; public Dim spawnDim = Dim.Overworld; public bool hasBed;
        public float lookSens = 2.2f;
        public float portalTime;
        public bool portalLock;
        public int portalKind;      // 0 ninguno, 1 abismo, 2 final
        public int totalKills;
        public IMount mount;
        public Bobber bobber;
        public int fishCaught, petsTamed;

        float camY = 1.62f, fov = 70f;
        float lastJumpTap = -1f, lastFwdTap = -1f;
        float regenTimer, starveTimer, drownTimer, stepTimer;
        bool sprintToggle;
        float lastSteps;

        public override bool IsPlayer { get { return true; } }
        public override float EyeHeight { get { return sneaking ? 1.27f : 1.62f; } }

        public void Init()
        {
            width = 0.6f; height = 1.8f; maxHealth = 20f; health = 20f;
            var c = new GameObject("PlayerCamera");
            c.transform.SetParent(transform, false);
            c.transform.localPosition = new Vector3(0, 1.62f, 0);
            cam = c.AddComponent<Camera>();
            camT = c.transform;
            cam.nearClipPlane = 0.05f; cam.farClipPlane = 900f; cam.fieldOfView = 70f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.5f, 0.7f, 1f);
            cam.allowHDR = false; cam.allowMSAA = true;
            c.tag = "MainCamera";
            c.AddComponent<AudioListener>();
            InitInteract();
        }

        public void ResetStats()
        {
            health = maxHealth; hunger = 20f; saturation = 5f; exhaustion = 0; air = 15f; dead = false; burn = 0; vel = Vector3.zero;
            invuln = 1f; fallDistance = 0; flying = false; noGravity = false;
        }

        public int FacingIndex()
        {
            int f = Mathf.RoundToInt(yaw / 90f) % 4;
            return (f + 4) % 4;
        }

        void Update()
        {
            if (G == null || W == null || G.state != GameState.Playing) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (G.paused) return;
            var p = transform.position;
            if (!W.IsLoaded(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.z))) return;
            TickTimers(dt);
            bool uiOpen = G.ui.IsOpen;
            if (!dead)
            {
                if (!uiOpen) { Look(); HotbarInput(); }
                if (mount != null) MountedUpdate(dt, uiOpen); else Movement(dt, uiOpen);
                Survival(dt);
                if (!uiOpen) Interact(dt); else StopBreaking();
                UpdatePortals(dt);
            }
            else StepPhysics(dt);
            UpdateCamera(dt);
        }

        // ---------------------------------------------------------------- monturas
        bool MountValid()
        {
            var o = mount as Object;
            var e = mount as Entity;
            return o != null && e != null && !e.dead;
        }

        public void Mount(IMount m)
        {
            if (mount != null || m == null || m.Rider != null || dead) return;
            mount = m; m.Rider = this;
            vel = Vector3.zero; flying = false; sprinting = false; fallDistance = 0f;
            StopBreaking(); CancelUse();
            Advancements.Event(m is Boat ? "mount:boat" : "mount:horse");
            G.ui.Hint("Mayús para bajar", 3f);
        }

        public void Dismount()
        {
            if (mount == null) return;
            var m = mount; mount = null;
            var obj = m as Object;
            if (obj != null)
            {
                m.Rider = null;
                var t = m.MountTransform;
                var right = t.right; var fwd = t.forward; right.y = 0; fwd.y = 0;
                Vector3[] offs = { right * 1.4f, -right * 1.4f, -fwd * 1.5f, fwd * 1.5f, Vector3.zero };
                Vector3 best = t.position + Vector3.up * 1.2f; bool found = false;
                for (int pass = 0; pass < 2 && !found; pass++)
                    for (int i = 0; i < offs.Length && !found; i++)
                        for (int dy = 0; dy <= 2 && !found; dy++)
                        {
                            var c = t.position + offs[i] + Vector3.up * (0.05f + dy);
                            var box = AABB.At(c, width, height);
                            if (Phys.Overlaps(W, box)) continue;
                            if (pass == 0 && !Phys.HasGround(W, box, 1.2f)) continue;
                            best = c; found = true;
                        }
                transform.position = best;
            }
            else mount = null;
            vel = Vector3.zero; fallDistance = 0f; onGround = false;
        }

        void MountedUpdate(float dt, bool uiOpen)
        {
            if (!MountValid()) { mount = null; return; }
            sneaking = false; flying = false;
            if (!uiOpen && Inp.Pressed(Act.Sneak)) { Dismount(); return; }
            transform.position = mount.SeatPosition;
            vel = Vector3.zero; fallDistance = 0f; onGround = true;
            sprinting = !uiOpen && Inp.Held(Act.Sprint);
            UpdateMedia();
        }

        void LateUpdate()
        {
            if (mount != null && !dead && G != null && G.state == GameState.Playing && MountValid()) transform.position = mount.SeatPosition;
        }

        void OnDestroy()
        {
            if (highlight != null) Destroy(highlight);
            if (crackGo != null) Destroy(crackGo);
            if (crackMesh != null) Destroy(crackMesh);
            if (highlightMesh != null) Destroy(highlightMesh);
        }

        void Look()
        {
            yaw += Inp.Look.x * lookSens;
            pitch -= Inp.Look.y * lookSens;
            pitch = Mathf.Clamp(pitch, -89f, 89f);
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            camT.localRotation = Quaternion.Euler(pitch, 0, 0);
        }

        void HotbarInput()
        {
            for (int i = 0; i < 9; i++) if (Inp.Pressed(Act.Hotbar1 + i)) { inv.selected = i; CancelUse(); }
            if (Mathf.Abs(Inp.Scroll) > 0.01f)
            {
                inv.selected = ((inv.selected - (int)Mathf.Sign(Inp.Scroll)) % 9 + 9) % 9;
                CancelUse();
            }
            if (Inp.Pressed(Act.Drop)) DropHeld(Inp.Held(Act.Sprint));
        }

        public void DropHeld(bool all)
        {
            var s = inv.slots[inv.selected];
            if (s.IsEmpty) return;
            var d = new ItemStack(s.item, all ? s.count : 1, s.damage);
            inv.slots[inv.selected].count -= d.count;
            if (inv.slots[inv.selected].count <= 0) inv.slots[inv.selected].Clear();
            var fwd = camT.forward;
            ItemEntity.Spawn(Eye + fwd * 0.4f - Vector3.up * 0.2f, d, fwd * 5f + Vector3.up * 1.5f, 1.2f);
        }

        // ---------------------------------------------------------------- movimiento
        void Movement(float dt, bool uiOpen)
        {
            bool creative = G.creative;
            Vector2 input = Vector2.zero;
            bool jumpHeld = false;
            if (!uiOpen)
            {
                input = new Vector2(Inp.Axis(Act.Left, Act.Right), Inp.Axis(Act.Back, Act.Forward));
                jumpHeld = Inp.Held(Act.Jump);
                // doble toque de salto = volar (creativo)
                if (Inp.Pressed(Act.Jump))
                {
                    if (creative && Time.time - lastJumpTap < 0.3f) { flying = !flying; vel.y = 0; }
                    lastJumpTap = Time.time;
                }
                if (Inp.Pressed(Act.Fly) && creative) { flying = !flying; vel.y = 0; }
                // doble toque adelante = correr
                if (Inp.Pressed(Act.Forward)) { if (Time.time - lastFwdTap < 0.28f) sprintToggle = true; lastFwdTap = Time.time; }
                if (!Inp.Held(Act.Forward)) sprintToggle = false;
            }
            if (!creative) flying = false;
            sneaking = !uiOpen && Inp.Held(Act.Sneak) && !flying;
            bool canSprint = (creative || hunger > 6f) && input.y > 0.1f && !sneaking && !(useTime > 0.01f);
            sprinting = canSprint && (Inp.Held(Act.Sprint) || sprintToggle) && !uiOpen;
            noGravity = flying;

            float speed = sneaking ? 1.3f : (sprinting ? 5.7f : 4.3f);
            if (flying) speed = sprinting ? 11f : 5.6f;
            if (inWater && !flying) speed *= 0.62f;
            if (inLava && !flying) speed *= 0.4f;
            if (useTime > 0.01f && !flying) speed *= 0.6f;

            var fwd = new Vector3(Mathf.Sin(yaw * Mathf.Deg2Rad), 0, Mathf.Cos(yaw * Mathf.Deg2Rad));
            var right = new Vector3(Mathf.Cos(yaw * Mathf.Deg2Rad), 0, -Mathf.Sin(yaw * Mathf.Deg2Rad));
            var wish = fwd * input.y + right * input.x;
            if (wish.sqrMagnitude > 1f) wish.Normalize();
            wish *= speed;
            float accel = flying ? 40f : (onGround ? 55f : (inWater ? 14f : 12f));
            var hv = new Vector3(vel.x, 0, vel.z);
            hv = Vector3.MoveTowards(hv, wish, accel * dt);
            vel.x = hv.x; vel.z = hv.z;

            if (flying)
            {
                float vy = 0;
                if (!uiOpen) { if (jumpHeld) vy += 1; if (Inp.Held(Act.Sneak)) vy -= 1; }
                vel.y = Mathf.MoveTowards(vel.y, vy * (sprinting ? 9f : 6.5f), 40f * dt);
            }
            else if (inWater || inLava)
            {
                if (jumpHeld) vel.y = Mathf.MoveTowards(vel.y, inLava ? 2.5f : 4f, 20f * dt);
            }
            else if (jumpHeld && onGround)
            {
                vel.y = 8.8f;
                if (sprinting) { vel += fwd * 1.8f; AddExhaustion(0.2f); } else AddExhaustion(0.05f);
                onGround = false;
            }

            // escaleras de mano: adelante o saltar sube, agacharse sujeta, si no se desliza despacio
            if (onLadder && !flying && !inWater)
            {
                vel.y = (jumpHeld || input.y > 0.1f) ? 3.4f : (sneaking ? 0f : -2.8f);
                fallDistance = 0f;
            }

            // no caerse del borde al agacharse
            if (sneaking && onGround)
            {
                var box = Box;
                var d = new Vector3(vel.x, 0, vel.z) * dt;
                if (!Phys.HasGround(W, new AABB(box.x0 + d.x, box.y0, box.z0, box.x1 + d.x, box.y1, box.z1), 0.6f)) vel.x = 0;
                if (!Phys.HasGround(W, new AABB(box.x0, box.y0, box.z0 + d.z, box.x1, box.y1, box.z1 + d.z), 0.6f)) vel.z = 0;
            }

            float oldY = transform.position.y;
            bool wasGround = onGround;
            StepPhysics(dt, !flying);
            if (flying && onGround && vel.y <= 0 && !jumpHeld) { }

            // pasos
            var hdist = new Vector2(vel.x, vel.z).magnitude;
            if (onGround && hdist > 0.5f && !flying)
            {
                stepTimer += dt * hdist;
                if (stepTimer > (sprinting ? 3.2f : 2.4f))
                {
                    stepTimer = 0;
                    var bp = transform.position - new Vector3(0, 0.2f, 0);
                    var below = W.GetBlock(Mathf.FloorToInt(bp.x), Mathf.FloorToInt(bp.y), Mathf.FloorToInt(bp.z));
                    Sfx.Block(below.sound, transform.position, true);
                }
                if (sprinting) AddExhaustion(0.1f * hdist * dt);
            }
            if (inWater && !wasGround && hdist > 0.1f) AddExhaustion(0.015f * dt * 10f);
        }

        protected override void OnLand(float dist)
        {
            if (G.creative) return;
            float dmg = Mathf.Floor(dist - 3f);
            if (dmg >= 1f) { DamageDirect(dmg, true); Sfx.Play(Clip.Hit, transform.position, 0.7f); }
            else if (dist > 1.5f)
            {
                var below = W.GetBlock(Mathf.FloorToInt(transform.position.x), Mathf.FloorToInt(transform.position.y - 0.1f), Mathf.FloorToInt(transform.position.z));
                Sfx.Block(below.sound, transform.position, true, 1.5f);
            }
        }

        protected override void OnVoid() { if (!dead) DamageDirect(4f * Time.deltaTime * 4f + 0.5f, true); }

        void UpdateCamera(float dt)
        {
            float targetY = EyeHeight;
            camY = Mathf.Lerp(camY, targetY, 1f - Mathf.Exp(-14f * dt));
            camT.localPosition = new Vector3(0, camY, 0);
            float tf = sprinting ? 77f : 70f;
            if (useTime > 0.1f && inv.Held.item != null && inv.Held.item.action == "bow") tf = 62f;
            fov = Mathf.Lerp(fov, tf, 1f - Mathf.Exp(-9f * dt));
            cam.fieldOfView = fov;
        }

        // ---------------------------------------------------------------- supervivencia
        public void AddExhaustion(float a) { if (!G.creative) exhaustion += a; }

        void Survival(float dt)
        {
            if (G.creative) { hunger = 20f; air = 15f; health = Mathf.Min(maxHealth, health + dt * 10f); return; }
            // hambre
            if (exhaustion >= 4f)
            {
                exhaustion -= 4f;
                if (saturation > 0f) saturation = Mathf.Max(0f, saturation - 1f);
                else hunger = Mathf.Max(0f, hunger - 1f);
            }
            if (hunger >= 18f && health < maxHealth)
            {
                regenTimer += dt;
                float interval = saturation > 0 && hunger >= 20f ? 0.5f : 3f;
                if (regenTimer >= interval) { regenTimer = 0; Heal(1f); AddExhaustion(saturation > 0 ? 0.6f : 1.5f); }
            }
            else regenTimer = 0;
            if (hunger <= 0f)
            {
                starveTimer += dt;
                if (starveTimer >= 4f) { starveTimer = 0; if (health > 1f) DamageDirect(1f, false); }
            }
            else starveTimer = 0;
            // aire
            if (headInWater)
            {
                air -= dt;
                if (air <= 0f)
                {
                    drownTimer += dt;
                    if (drownTimer >= 1f) { drownTimer = 0; DamageDirect(2f, false); }
                }
            }
            else { air = Mathf.Min(15f, air + dt * 5f); drownTimer = 0; }
            // contacto con bloques danninos
            var p = transform.position;
            var feet = W.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y + 0.1f), Mathf.FloorToInt(p.z));
            if (feet.damagesOnTouch && !feet.fluid && Random.value < dt * 3f) DamageDirect(1f, false);
            var below = W.GetBlock(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y - 0.1f), Mathf.FloorToInt(p.z));
            if (below == B.Magma && !sneaking && Random.value < dt * 2f) DamageDirect(1f, false);
            // cactus a los lados
            if (Random.value < dt * 5f)
            {
                var b = Box.Grow(0.05f);
                int x0 = Mathf.FloorToInt(b.x0), x1 = Mathf.FloorToInt(b.x1), z0 = Mathf.FloorToInt(b.z0), z1 = Mathf.FloorToInt(b.z1), y = Mathf.FloorToInt(p.y + 0.5f);
                for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) if (W.GetBlock(x, y, z) == B.Cactus) { DamageDirect(1f, false); }
            }
        }

        // ---------------------------------------------------------------- dano
        public override void Damage(float amount, Vector3 from, Entity src, float knock = 0.5f)
        {
            if (dead || G.creative) return;
            if (invuln > 0f) return;
            float reduce = Mathf.Min(0.8f, inv.TotalDefense() * 0.04f);
            amount *= 1f - reduce;
            for (int i = 0; i < 4; i++)
                if (!inv.armor[i].IsEmpty && Random.value < 0.5f && inv.armor[i].Wear(1)) Sfx.Play(Clip.Hit, transform.position, 0.5f, 0.6f);
            AddExhaustion(0.1f);
            base.Damage(amount, from, src, knock);
        }

        /// <summary>Dano ambiental que ignora la armadura.</summary>
        public void DamageDirect(float amount, bool ignoreInvuln)
        {
            if (dead || G.creative) return;
            if (!ignoreInvuln && invuln > 0f) return;
            health -= amount; invuln = Mathf.Max(invuln, 0.3f); hurtFlash = 0.25f;
            Sfx.Play(Clip.Hurt, transform.position, 0.8f);
            G.ui.Flash(new Color(1f, 0f, 0f, 0.35f));
            if (health <= 0f) { health = 0f; Die(null); }
        }

        protected override void OnHurt(float amount, Entity src)
        {
            Sfx.Play(Clip.Hurt, transform.position, 0.9f);
            G.ui.Flash(new Color(1f, 0f, 0f, 0.35f));
        }

        public override void Die(Entity killer)
        {
            if (dead) return;
            dead = true;
            Dismount();
            StopBreaking(); CancelUse();
            G.OnPlayerDied();
        }

        public void Respawn(Vector3 pos)
        {
            ResetStats();
            transform.position = pos;
            vel = Vector3.zero;
        }

        public void Eat(Item food)
        {
            Advancements.Event("eat:" + food.key);
            hunger = Mathf.Min(20f, hunger + food.hunger);
            saturation = Mathf.Min(hunger, saturation + food.saturation);
            if (food.key == "golden_apple") Heal(8f);
            if (food.key == "rotten_flesh" && Random.value < 0.8f) { hunger = Mathf.Max(0, hunger - 2); }
            Sfx.Play(Clip.Eat, transform.position, 0.8f);
        }

        // ---------------------------------------------------------------- portales
        void UpdatePortals(float dt)
        {
            var p = transform.position;
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            int kind = 0;
            for (int dy = 0; dy < 2 && kind == 0; dy++)
            {
                var b = W.GetBlock(x, Mathf.FloorToInt(p.y + 0.3f + dy), z);
                if (b == B.Portal) kind = 1;
                else if (b == B.EndPortal) kind = 2;
            }
            var fb = W.GetBlock(x, Mathf.FloorToInt(p.y - 0.1f), z);
            if (fb == B.EndPortal) kind = 2;
            if (kind == 0) { portalTime = 0; portalKind = 0; portalLock = false; G.ui.SetPortalOverlay(0f); return; }
            if (portalLock) { portalTime = 0; return; }
            portalKind = kind;
            portalTime += dt;
            float need = kind == 1 ? (G.creative ? 0.5f : 3f) : 0.2f;
            G.ui.SetPortalOverlay(Mathf.Clamp01(portalTime / need));
            if (portalTime >= need)
            {
                portalTime = 0;
                G.UsePortal(kind);
            }
        }
    }
}
