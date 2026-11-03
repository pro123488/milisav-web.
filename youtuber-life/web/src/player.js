// ============================================================================
// Jugador: avatar, controles (teclado, ratón y táctil) y cámara en tercera persona
// ============================================================================
"use strict";
const P = {
  obj: null, vel: new THREE.Vector3(), yaw: Math.PI, pitch: 0.32, dist: 22, keys: {}, onGround: true, vy: 0,
  phase: 0, joy: { x: 0, y: 0, active: false }, run: false, locked: false, camOverride: null,
};
const SHIRTS = [[240, 240, 240], [30, 30, 35], [200, 40, 40], [40, 90, 200], [50, 160, 90], [250, 200, 40], [255, 120, 0], [140, 70, 200], [255, 110, 170], [120, 85, 60], [90, 100, 110], [0, 170, 190]];

P.create = function () {
  P.obj = personMesh(0x3256c8, 0x202028, 0xf1c27d);
  // gorra y mochila para distinguirlo
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xff3452 })); cap.position.set(0, 5.85, 0.15); P.obj.add(cap);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.7), new THREE.MeshLambertMaterial({ color: 0x2a2a30 })); bag.position.set(0, 3.4, -0.85); P.obj.add(bag);
  W.scene.add(P.obj);
  P.applyLook();
};
P.applyLook = function () {
  if (!P.obj || !S) return;
  const sh = SHIRTS[S.look.shirt] || SHIRTS[3], pa = SHIRTS[S.look.pants] || SHIRTS[1];
  const L = P.obj.userData.limbs; const torso = P.obj.children[0];
  const c1 = new THREE.Color(sh[0] / 255, sh[1] / 255, sh[2] / 255), c2 = new THREE.Color(pa[0] / 255, pa[1] / 255, pa[2] / 255);
  torso.material = torso.material.clone(); torso.material.color.copy(c1);
  L.la.material = torso.material; L.ra.material = torso.material;
  L.ll.material = L.ll.material.clone(); L.ll.material.color.copy(c2); L.rl.material = L.ll.material;
};
P.groundY = function (x, z) {
  const d = districtAt(x, z); if (!d) return 0;
  const [cx, cz] = districtCenter(d); const e = (CELL - ROAD) / 2;
  return Math.abs(x - cx) <= e && Math.abs(z - cz) <= e ? SIDEWALK_Y : 0;
};
P.teleport = function (x, z) { P.obj.position.set(x, P.groundY(x, z), z); P.vel.set(0, 0, 0); P.vy = 0; };

P.initInput = function (canvas) {
  window.addEventListener("keydown", e => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    P.keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    Bus.emit("key", e.code);
  });
  window.addEventListener("keyup", e => { P.keys[e.code] = false; });
  window.addEventListener("blur", () => { P.keys = {}; });
  // ratón: arrastrar para girar la cámara, rueda para el zoom
  let drag = null;
  canvas.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointermove", e => {
    if (drag && e.pointerType === "mouse") {
      const s = 0.005 * (S ? S.settings.sens : 1);
      P.yaw -= (e.clientX - drag.x) * s; P.pitch = clamp(P.pitch + (e.clientY - drag.y) * s, -0.2, 1.25); drag = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("wheel", e => { P.dist = clamp(P.dist + e.deltaY * 0.02, 6, 60); }, { passive: true });
  // táctil: joystick a la izquierda, arrastrar a la derecha para girar
  const joy = document.getElementById("joy"), knob = joy.querySelector("i");
  const touchCam = {};
  canvas.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.4) { P.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0, active: true }; joy.style.display = "block"; joy.style.left = (t.clientX - 60) + "px"; joy.style.top = (t.clientY - 60) + "px"; joy.style.bottom = "auto"; }
      else touchCam[t.identifier] = { x: t.clientX, y: t.clientY };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (P.joy.active && t.identifier === P.joy.id) { const dx = clamp(t.clientX - P.joy.ox, -50, 50), dy = clamp(t.clientY - P.joy.oy, -50, 50); P.joy.x = dx / 50; P.joy.y = dy / 50; knob.style.transform = "translate(" + dx + "px," + dy + "px)"; }
      else if (touchCam[t.identifier]) { const c = touchCam[t.identifier]; P.yaw -= (t.clientX - c.x) * 0.008; P.pitch = clamp(P.pitch + (t.clientY - c.y) * 0.006, -0.2, 1.25); c.x = t.clientX; c.y = t.clientY; }
    }
  }, { passive: true });
  const end = e => { for (const t of e.changedTouches) { if (P.joy.active && t.identifier === P.joy.id) { P.joy = { x: 0, y: 0, active: false }; knob.style.transform = ""; joy.style.display = "none"; } delete touchCam[t.identifier]; } };
  canvas.addEventListener("touchend", end, { passive: true }); canvas.addEventListener("touchcancel", end, { passive: true });
};

P.update = function (dt) {
  const o = P.obj; if (!o) return;
  let fx = 0, fz = 0;
  if (!P.locked) {
    if (P.keys.KeyW || P.keys.ArrowUp) fz += 1; if (P.keys.KeyS || P.keys.ArrowDown) fz -= 1;
    if (P.keys.KeyA || P.keys.ArrowLeft) fx -= 1; if (P.keys.KeyD || P.keys.ArrowRight) fx += 1;
    if (P.joy.active) { fx += P.joy.x; fz -= P.joy.y; }
  }
  const len = Math.hypot(fx, fz); const moving = len > 0.1;
  const running = P.keys.ShiftLeft || P.keys.ShiftRight || P.run;
  const speed = (running ? 34 : 20) * Math.min(1, len);
  if (moving) {
    fx /= Math.max(1, len); fz /= Math.max(1, len);
    // adelante = de la cámara hacia el jugador; derecha = perpendicular
    const mx = (-Math.sin(P.yaw)) * fz + (Math.cos(P.yaw)) * fx, mz = (-Math.cos(P.yaw)) * fz + (-Math.sin(P.yaw)) * fx;
    P.vel.x = mx * speed; P.vel.z = mz * speed;
    o.rotation.y = Math.atan2(mx, mz);
    P.phase += dt * speed * 0.55;
  } else { P.vel.x *= 0.7; P.vel.z *= 0.7; P.phase *= 0.9; }
  animateLimbs(o, P.phase, moving ? (running ? 0.9 : 0.6) : 0);
  o.position.x += P.vel.x * dt; o.position.z += P.vel.z * dt;
  resolveCollision(o.position, 1.4);
  // salto y gravedad
  const g = P.groundY(o.position.x, o.position.z);
  if ((P.keys.Space || P.jumpReq) && P.onGround && !P.locked) { P.vy = 18; P.onGround = false; }
  P.jumpReq = false;
  P.vy -= 50 * dt; o.position.y += P.vy * dt;
  if (o.position.y <= g) { o.position.y = g; P.vy = 0; P.onGround = true; }
  // cámara
  const target = new THREE.Vector3(o.position.x, o.position.y + 5, o.position.z);
  if (P.camOverride) { W.camera.position.lerp(P.camOverride.pos, 0.2); W.camera.lookAt(P.camOverride.look); return; }
  const indoor = W.inHome(o.position) || W.storeAt(o.position) || W.placeAt(o.position, "cafe") || W.placeAt(o.position, "bank") || W.placeAt(o.position, "restaurant") || (W.isIndoor && W.isIndoor(o.position)) || (W.indoorAt && W.indoorAt(o.position));
  let dist = indoor ? Math.min(P.dist, 12) : P.dist;
  const dirx = Math.sin(P.yaw), dirz = Math.cos(P.yaw);
  for (let s = 1.5; s < dist; s += 0.75) {
    const px = target.x + dirx * s * Math.cos(P.pitch), pz = target.z + dirz * s * Math.cos(P.pitch), py = target.y + Math.sin(P.pitch) * s;
    if (py < 40 && pointBlocked(px, pz)) { dist = Math.max(3, s - 1); break; }
  }
  const cx = target.x + Math.sin(P.yaw) * Math.cos(P.pitch) * dist, cz = target.z + Math.cos(P.yaw) * Math.cos(P.pitch) * dist;
  const cy = Math.max(target.y + Math.sin(P.pitch) * dist, (indoor ? 2 : 1.5));
  W.camera.position.lerp(new THREE.Vector3(cx, indoor ? Math.min(cy, 13) : cy, cz), 0.25);
  W.camera.lookAt(target);
};
