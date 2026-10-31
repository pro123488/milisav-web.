// ============================================================================
// Youtuber Life 3D — motor: utilidades, estado, guardado y fórmulas
// (las fórmulas son la misma lógica que src/shared/VideoFormulas.lua y PCBuild.lua de Roblox)
// ============================================================================
"use strict";
const D = GAMEDATA;
const ITEMS = {};
D.Items.forEach(i => { ITEMS[i.Id] = i; });
const arr = x => Array.isArray(x) ? x : [];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round = (x, d = 0) => { const m = Math.pow(10, d); return Math.round(x * m) / m; };
const fmtInt = n => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fmtMoney = n => "$" + fmtInt(n);
const fmtShort = n => { n = n || 0; const a = Math.abs(n); const f = (x, s) => x.toFixed(1).replace(/\.0$/, "").replace(".", ",") + s; return a >= 1e9 ? f(n / 1e9, " MM") : a >= 1e6 ? f(n / 1e6, " M") : a >= 1e3 ? f(n / 1e3, " K") : String(Math.round(n)); };
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) % 2147483647; return h; }
const seeded = (s, lo, hi) => lo + (hi - lo) * ((hashStr(s) % 100000) / 100000);
const pick = a => a[Math.floor(Math.random() * a.length)];
const overlap = (a, b) => { let n = 0; arr(a).forEach(x => { if (arr(b).includes(x)) n++; }); return n; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = {}; arr(D.Video.Categories).forEach(c => CATS[c.Id] = c);
const SHOTS = {}; arr(D.Video.Shots).forEach(s => SHOTS[s.Id] = s);
const MUSIC = {}; arr(D.Video.Music).forEach(m => MUSIC[m.Id] = m);
const FORMATS = {}; arr(D.Video.Formats).forEach(f => FORMATS[f.Id] = f);
const PHOTOMODES = {}; arr(D.Video.PhotoModes).forEach(m => PHOTOMODES[m.Id] = m);
const DISTRICTS = {}; D.World.Districts.forEach(d => DISTRICTS[d.Id] = d);
const SPOTS = {}; D.World.Spots.forEach(s => SPOTS[s.Id] = s);
const catName = id => (CATS[id] || {}).Name || id;
const rgb = c => "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";

// Tipografías de miniaturas (equivalentes web de las de Roblox)
const WEBFONTS = { GothamBlack: "900 {s}px 'Arial Black', Arial, sans-serif", LuckiestGuy: "900 {s}px Impact, 'Arial Black', sans-serif", Bangers: "700 {s}px Impact, sans-serif", FredokaOne: "800 {s}px 'Trebuchet MS', Verdana, sans-serif", Oswald: "700 {s}px 'Arial Narrow', Arial, sans-serif", GothamBold: "700 {s}px Arial, sans-serif", SourceSansBold: "700 {s}px Verdana, sans-serif", Michroma: "700 {s}px 'Courier New', monospace", Arcade: "700 {s}px monospace", PermanentMarker: "700 {s}px 'Comic Sans MS', cursive" };

// ---------------------------------------------------------------- Eventos internos
const Bus = { l: {}, on(ev, fn) { (this.l[ev] = this.l[ev] || []).push(fn); return () => { this.l[ev] = this.l[ev].filter(f => f !== fn); }; }, emit(ev, d) { (this.l[ev] || []).slice().forEach(f => { try { f(d); } catch (e) { console.error(e); } }); } };

// ---------------------------------------------------------------- Estado y guardado
const SAVE_KEY = "ytlife3d_save_v1";
function newState() {
  return {
    v: 1, money: D.Config.StartingMoney, earned: 0, xp: 0, level: 1, rep: 10, bizRep: 50,
    channel: { name: "", desc: "", subs: 0, subFrac: 0, views: 0, revenue: 0, partner: false, avatar: 0, banner: 0, pendingRev: 0 },
    inv: {}, uid: 0, phone: "", rigs: {}, activeRig: "",
    projects: {}, photos: [], thumbs: {}, videos: [], posts: [],
    counters: {}, visited: { districts: {}, recorded: {}, stores: {}, cats: {}, secrets: {}, cameras: {} },
    quests: { done: {}, claimed: {}, step: 0, stepProg: 0, skipped: false }, titles: {}, title: "",
    needs: { energy: 100, mood: 70 }, orders: [], tx: [], bank: { savings: 0, loan: 0, goals: [] },
    job: null, sponsors: { offers: [], active: {}, history: [], day: -1, seq: 0 }, eventProg: { day: -1, done: {}, scenes: 0, pub: {} },
    settings: { vol: 0.6, quality: "high", sens: 1, hints: true },
    look: { shirt: 4, pants: 1 },
    clock: 9, day: 1, playDays: 0, rent: { due: 7, debt: 0 },
    pos: null, created: Date.now(), lastSeen: Date.now(), lastLive: 0, lives: [],
  };
}
let S = null;
function saveGame() {
  if (!S) return;
  S.lastSeen = Date.now();
  let json = JSON.stringify(S);
  for (let tries = 0; tries < 6; tries++) {
    try { localStorage.setItem(SAVE_KEY, json); return true; } catch (e) {
      // sin espacio: quitar imágenes antiguas (se conservan los datos)
      let removed = false;
      for (let i = S.photos.length - 1; i >= 0 && !removed; i--) if (S.photos[i].img) { S.photos[i].img = null; removed = true; }
      for (const p of Object.values(S.projects)) for (const sc of p.scenes) if (!removed && sc.img) { sc.img = null; removed = true; }
      for (let i = S.videos.length - 1; i >= 0 && !removed; i--) if (S.videos[i].thumbImg) { S.videos[i].thumbImg = null; removed = true; }
      if (!removed) return false;
      json = JSON.stringify(S);
    }
  }
  return false;
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const st = JSON.parse(raw); return Object.assign(newState(), st); }
  } catch (e) { console.warn("No se pudo cargar la partida", e); }
  return null;
}

// ---------------------------------------------------------------- Fórmulas de vídeo
const F = {};
F.lighting = function (c) {
  let light;
  if (c.indoor) light = 62 + (c.homeLight || 0);
  else {
    const h = c.hour == null ? 12 : c.hour;
    if (h >= 7 && h < 17) light = 82; else if ((h >= 5.5 && h < 7) || (h >= 17 && h < 19)) light = 74; else light = 28;
    light -= { Cloudy: 8, Rain: 18, Fog: 14, Storm: 26 }[c.weather] || 0;
  }
  light += c.portableLight || 0;
  const low = c.lowLight || 30;
  if (light < 60) light += (60 - light) * (low / 100) * 0.8;
  return clamp(light, 5, 100);
};
F.golden = h => (h >= 5.5 && h < 7) || (h >= 17 && h < 19);
F.scene = function (c) {
  const shot = c.shot, dev = c.device, probs = [];
  const lighting = F.lighting({ indoor: c.indoor, hour: c.hour, weather: c.weather, homeLight: c.homeLight, portableLight: c.portableLight, lowLight: dev.LowLight });
  let image = dev.Video * 0.6 + lighting * 0.4;
  const stab = (dev.Stab || 20) + (c.gimbal || 0) + (c.mount || 0);
  if (shot.Moving) { image -= Math.max(0, 60 - stab) * 0.3; if (stab < 40 && Math.random() < 0.5) { image -= 10; probs.push("Imagen temblorosa"); } }
  else if (c.tripod > 0) image += 5 * Math.min(1, c.tripod / 75);
  if (!c.indoor && (c.weather === "Rain" || c.weather === "Storm") && !dev.Weather && Math.random() < 0.4) { image -= 12; probs.push("Gotas en la lente"); }
  if (lighting < 40 && Math.random() < 0.6) { image -= 8; probs.push("Imagen con ruido por poca luz"); }
  const noise = c.spotNoise == null ? 3 : c.spotNoise;
  let audio = (c.micAudio || dev.Audio || 28) - noise * 2.5;
  if (c.indoor) audio += 6;
  if (!c.indoor && !c.micPortable && noise >= 5 && Math.random() < 0.5) { audio -= 12; probs.push("Viento en el micrófono"); }
  const match = overlap(c.categoryTags, c.spotTags);
  let interest = shot.Interest + (c.spotInterest || 5);
  interest += match > 0 ? 12 + Math.min(2, match - 1) * 3 : -6;
  if (c.productQuality) interest += c.productQuality / 10;
  if (c.indoor) interest += (c.decor || 0) / 3;
  if (shot.Presenter) interest += c.presentation || 0;
  if (c.goldenHour && !c.indoor) interest += 4;
  if ((c.busy || 0) >= 6 && Math.random() < 0.3) { interest -= 5; probs.push("Gente cruzando el plano"); }
  if (c.batteryLow) probs.push("Batería baja");
  image = clamp(image, 1, 100); audio = clamp(audio, 1, 100); interest = clamp(interest, 0, 40);
  const q = clamp(image * 0.55 + audio * 0.25 + Math.min(100, interest * 2.5) * 0.2, 1, 100);
  return { Quality: round(q, 1), Image: round(image, 1), Audio: round(audio, 1), Lighting: round(lighting, 1), Interest: round(interest, 1), Problems: probs, Seconds: shot.Seconds };
};
F.photo = function (c) {
  const mode = c.mode;
  const lighting = F.lighting({ indoor: c.indoor, hour: c.hour, weather: c.weather, homeLight: c.homeLight, portableLight: c.portableLight, lowLight: c.device.LowLight });
  let q = c.device.Photo * 0.6 + lighting * 0.4; const probs = [];
  if (overlap(mode.Tags, c.spotTags) > 0) q += 10;
  if (mode.Night) { if (c.device.Night || (c.device.LowLight || 0) >= 70) q += 8; else if (lighting < 45) { q -= 10; probs.push("Foto movida por la oscuridad"); } }
  if (c.goldenHour && !c.indoor) q += 5;
  if (c.tripod > 0) q += 3;
  if (!c.indoor && (c.weather === "Rain" || c.weather === "Storm") && !c.device.Weather && Math.random() < 0.3) { q -= 10; probs.push("Gotas en la lente"); }
  q += (c.composition == null ? 5 : c.composition) - 5;
  return { Quality: round(clamp(q, 1, 100), 1), Lighting: round(lighting, 1), Problems: probs };
};
F.edit = function (p) {
  const details = [], entries = p.entries || [];
  if (!entries.length) return { EditQuality: 0, Footage: 0, Final: 0, Seconds: 0, Details: ["La línea de tiempo está vacía"] };
  let totalW = 0, footage = 0, seconds = 0, trimSum = 0, nonCut = 0, glitch = 0; const shots = {};
  entries.forEach((e, i) => {
    const trim = clamp(e.trim || 1, 0.3, 1), dur = (e.seconds || 10) * trim;
    seconds += dur; trimSum += trim; footage += (e.q || 30) * dur; totalW += dur; if (e.shot) shots[e.shot] = 1;
    if (i > 0) { if (e.transition && e.transition !== "cut") nonCut++; if (e.transition === "glitch") glitch++; }
  });
  footage /= Math.max(totalW, 1);
  let score = 40; const target = p.targetSeconds || 120;
  const pacing = clamp(100 - Math.abs(Math.log2(Math.max(seconds / target, 0.05))) * 35, 0, 100);
  score += (pacing - 50) * 0.2; details.push("Ritmo " + Math.floor(pacing) + "/100 (" + Math.floor(seconds) + " s de " + target + " s)");
  const avgTrim = trimSum / entries.length; if (avgTrim >= 0.55 && avgTrim <= 0.88) { score += 6; details.push("Cortes ajustados (+6)"); }
  if ((entries[0] && entries[0].shot === "talking") || p.intro === "hook") { score += 8; details.push("Buen gancho inicial (+8)"); } else if (p.intro && p.intro !== "none") score += 3;
  if (p.outro === "subscribe" || p.outro === "endscreen") { score += 5; details.push("Cierre con llamada a la acción (+5)"); } else if (p.outro === "bloopers") score += 3;
  const variety = Object.keys(shots).length; score += Math.min(5, variety) * 2; details.push("Variedad de tomas: " + variety);
  if (entries.length > 1) { const share = nonCut / (entries.length - 1); if (share > 0 && share <= 0.4) score += 4; else if (share > 0.7) { score -= 5; details.push("Demasiadas transiciones (-5)"); } }
  if (glitch > 2) { score -= 4; details.push("Abuso del efecto glitch (-4)"); }
  const music = MUSIC[p.music || "none"], voice = p.voiceVol == null ? 1 : p.voiceVol, mvol = p.musicVol == null ? 0.3 : p.musicVol;
  if (music && music.Id !== "none") {
    if (arr(music.Fits).includes(p.category)) { score += 8; details.push("Música adecuada (+8)"); } else score += 1;
    if (mvol > voice) { score -= 10; details.push("La música tapa la voz (-10)"); } else if (mvol >= 0.12 && mvol <= 0.45) score += 4;
  } else if (p.category !== "interview" && p.category !== "documentary") score -= 3;
  let fit = 0, bad = 0;
  (p.effects || []).forEach(fx => { const d = arr(D.Video.Effects).find(e => e.Id === fx); if (d) { if (arr(d.Fits).includes(p.category)) fit++; else bad++; } });
  score += Math.min(3, fit) * 3 - bad * 2; if ((p.effects || []).length > 4) { score -= 5; details.push("Demasiados efectos (-5)"); }
  const c = p.color || {}; const b = Math.abs(c.b || 0), ct = Math.abs(c.c || 0), s = Math.abs(c.s || 0), sum = b + ct + s;
  if (b > 60 || ct > 60 || s > 60) { score -= 6; details.push("Color exagerado (-6)"); }
  else if (sum >= 5 && sum <= 45) { const bonus = 6 * clamp(((p.colorAcc || 40) + (p.proColor || 0)) / 100, 0.2, 1.1); score += bonus; details.push("Etalonaje (+" + round(bonus, 1) + ")"); }
  if (p.titles) score += 3; if (p.subtitles) { score += 5; details.push("Subtítulos (+5)"); }
  score += clamp((p.audioMix || 0) / 20, 0, 5);
  const editQ = clamp(score, 0, 100), fin = clamp(footage * 0.55 + editQ * 0.45, 1, 100);
  return { EditQuality: round(editQ, 1), Footage: round(footage, 1), Final: round(fin, 1), Seconds: Math.floor(seconds), Details: details };
};
F.exportSeconds = function (p, pc, editSpeed, comfort) {
  let cx = (p.seconds || 60) / 60 + (p.effects || []).length * 0.6 + (p.transitions || 0) * 0.2 + (p.photos || 0) * 0.1;
  if (p.colorGraded) cx += 1;
  const red = clamp((editSpeed || 0) + (comfort || 0) / 4, 0, 30) / 100;
  return Math.round(clamp((8 + cx * 7) / (pc ? pc.RenderMult : 1) * (1 - red), 4, 180));
};
F.contrast = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
F.thumbnail = function (d, c) {
  c = c || {}; const details = []; const text = d.text || "";
  const words = text.split(/\s+/).filter(Boolean).length; let read = 0;
  if (words >= 1 && words <= 5) read += 35; else if (words === 0) read += 10; else { read += Math.max(0, 35 - (words - 5) * 8); details.push("Demasiado texto"); }
  if (text.length > 0 && text.length <= 28) read += 10;
  const font = arr(D.Video.Fonts).find(f => f.Id === d.font); read += (font ? font.Readability : 5) * 2.5;
  const pal = D.Video.Palette; let contrast = F.contrast(pal[(d.textColor || 1) - 1] || [255, 255, 255], pal[(d.bg || 2) - 1] || [20, 20, 24]) / 441 * 30;
  if (d.outline) contrast = Math.max(contrast, 22); read += contrast; if (contrast < 10) details.push("Poco contraste entre texto y fondo");
  read = clamp(read, 0, 100);
  const tpl = arr(D.Video.ThumbTemplates).find(t => t.Id === d.template); let comp = (tpl ? tpl.Composition : 5) * 6;
  const st = (d.stickers || []).length; if (st === 1 || st === 2) comp += 15; else if (st === 3) comp += 8; else if (st > 3) { comp -= 10; details.push("Demasiados elementos"); }
  if (c.photoQuality) comp += 20; else details.push("Sin fotografía");
  if (d.frame && d.frame !== "none") comp += 4; comp = clamp(comp, 0, 100);
  let rel = 20; if (c.photoQuality) { rel += c.photoQuality * 0.35; if (c.photoMatches) rel += 30; else details.push("La foto no tiene relación con el tema"); }
  if (c.keywordInText) rel += 10; rel = clamp(rel, 0, 100);
  return { Score: round(clamp(read * 0.4 + comp * 0.3 + rel * 0.3, 0, 100), 1), Readability: round(read, 1), Composition: round(comp, 1), Relevance: round(rel, 1), Details: details };
};
F.keyword = id => { const c = CATS[id]; return c ? c.Name.toLowerCase().split(" ")[0] : null; };
F.title = function (t, cat) {
  t = t || ""; const len = t.length; let s = len >= 20 && len <= 60 ? 75 : len < 20 ? 35 + len * 2 : Math.max(30, 75 - (len - 60) * 2);
  if (/\d/.test(t)) s += 5; const kw = F.keyword(cat); if (kw && t.toLowerCase().includes(kw)) s += 10;
  const letters = (t.match(/[a-záéíóúñ]/gi) || []).length, upper = (t.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
  if (letters > 6 && upper / letters > 0.6) s -= 15; if (t.includes("!!!") || t.includes("???")) s -= 10;
  return clamp(s, 0, 100);
};
F.ctr = (thumb, title) => 0.025 + (thumb || 30) / 100 * 0.05 + (title || 40) / 100 * 0.02;
F.expectedViews = function (p) {
  const subs = p.subs || 0, imp = 3000 + subs * 6 + (p.reputation || 10) * 40, q = clamp(p.quality || 30, 1, 100) / 100;
  let v = imp * (p.ctr || 0.05) * (0.3 + Math.pow(q, 1.5) * 1.7) * ((p.interest || 50) / 50) * (p.trend || 1) * (p.luck || 1) * (p.competition || 1) * (p.fatigue || 1);
  if (p.viral) v *= p.viral;
  return Math.floor(clamp(v, 5, 50000 + subs * 40));
};
F.subConversion = q => { q = clamp(q || 30, 1, 100) / 100; return 0.02 + q * q * 0.08; };
F.likeRate = q => 0.02 + clamp(q || 30, 1, 100) / 100 * 0.06;
F.revenuePerView = (cat, partner) => { const c = CATS[cat]; let rpm = (c ? c.Rpm : 2) * 100; if (!partner) rpm *= 0.3; return rpm / 1000; };
F.viewCurve = (min, cm) => 1 - Math.exp(-min / (cm || 8));

// ---------------------------------------------------------------- PC
const PC = {};
PC.slotMatches = (it, slot) => !!it && (slot.Key === "storage" ? it.Cat === "storage" && it.Sub === "internal" : it.Cat === "component" && it.Sub === slot.Sub);
PC.slotFor = it => D.PC.Slots.find(s => PC.slotMatches(it, s));
PC.watts = p => { let w = D.PC.BaseWatts; const cpu = ITEMS[p.cpu], gpu = ITEMS[p.gpu]; if (cpu) w += cpu.Stats.Tdp; if (gpu) w += gpu.Stats.Watts; return w + (p.storage || []).length * 6 + (p.fans || []).length * 3; };
PC.validate = function (p) {
  const errors = [], warnings = []; p = p || {};
  D.PC.Slots.forEach(slot => {
    const v = p[slot.Key];
    if (slot.Multi) { const l = v || []; if (slot.Required && !l.length) errors.push("Falta: " + slot.Name); l.forEach(id => { if (!PC.slotMatches(ITEMS[id], slot)) errors.push("Pieza no válida en " + slot.Name); }); }
    else if (v == null) { if (slot.Required) errors.push("Falta: " + slot.Name); } else if (!PC.slotMatches(ITEMS[v], slot)) errors.push("Pieza no válida en " + slot.Name);
  });
  if (errors.length) return { ok: false, errors, warnings };
  const c = ITEMS[p.case], m = ITEMS[p.mobo], cpu = ITEMS[p.cpu], ram = ITEMS[p.ram], gpu = ITEMS[p.gpu], psu = ITEMS[p.psu], cool = ITEMS[p.cooling];
  if (cpu.Compat.Socket !== m.Compat.Socket) errors.push("El procesador (" + cpu.Compat.Socket + ") no encaja en la placa (" + m.Compat.Socket + ").");
  if (ram.Compat.RamType !== m.Compat.RamType) errors.push("La placa usa " + m.Compat.RamType + " y la memoria es " + ram.Compat.RamType + ".");
  if (!arr(c.Compat.Forms).includes(m.Compat.Form)) errors.push("La placa " + m.Compat.Form + " no cabe en el gabinete.");
  if (gpu && gpu.Compat.Length > c.Compat.MaxGpu) errors.push("La gráfica no cabe en el gabinete.");
  if ((p.storage || []).length > m.Compat.StorageSlots) errors.push("La placa solo admite " + m.Compat.StorageSlots + " discos.");
  if ((p.fans || []).length > c.Stats.FanSlots) errors.push("El gabinete solo admite " + c.Stats.FanSlots + " ventiladores.");
  if (!gpu && !(cpu.Stats.IGpu > 0)) errors.push("Este procesador necesita tarjeta gráfica.");
  const w = PC.watts(p); if (w > psu.Stats.Watts) errors.push("Consumo " + w + " W supera la fuente de " + psu.Stats.Watts + " W."); else if (w > psu.Stats.Watts * 0.85) warnings.push("La fuente va al límite.");
  if (cool.Stats.Capacity < cpu.Stats.Tdp) warnings.push("Refrigeración insuficiente (-20%).");
  return { ok: !errors.length, errors, warnings };
};
const ramFactor = gb => gb >= 128 ? 1.25 : gb >= 64 ? 1.18 : gb >= 32 ? 1.1 : gb >= 16 ? 1 : 0.8;
PC.tier = s => s < 25 ? 1 : s < 40 ? 2 : s < 55 ? 3 : s < 70 ? 4 : s < 85 ? 5 : 6;
PC.finish = st => { st.Tier = PC.tier(st.Score); st.TierName = D.PC.TierNames[st.Tier - 1]; st.MaxScenes = D.PC.MaxScenesByTier[st.Tier - 1]; st.RenderMult = (0.6 + st.Score / 50) * (1 + ((st.StorageSpeed || 1) - 1) * 0.04); return st; };
PC.stats = function (p, cf) {
  p = p || {}; const cpu = ITEMS[p.cpu], gpu = ITEMS[p.gpu], ram = ITEMS[p.ram], cool = ITEMS[p.cooling], c = ITEMS[p.case];
  let score = ((cpu ? cpu.Stats.Score : 0) * 0.55 + (gpu ? gpu.Stats.Score : (cpu ? cpu.Stats.IGpu || 0 : 0) * 1.5) * 0.45) * ramFactor(ram ? ram.Stats.Gb : 0);
  let thr = false; if (cpu && cool && cool.Stats.Capacity < cpu.Stats.Tdp) { score *= 0.8; thr = true; }
  score *= cf || 1;
  let air = c ? c.Stats.Airflow : 3, noise = cool ? cool.Stats.Noise : 6;
  (p.fans || []).forEach(f => { const it = ITEMS[f]; if (it) { air += it.Stats.Airflow; noise += it.Stats.Noise; } });
  if (gpu) noise += gpu.Stats.Watts / 120;
  const temp = clamp(30 + 50 * ((cpu ? cpu.Stats.Tdp : 50) / (cool ? cool.Stats.Capacity : 50)) - air * 1.6, 32, 98);
  let gb = 0, sp = 1; (p.storage || []).forEach(s => { const d = ITEMS[s]; if (d) { gb += d.Stats.Gb; sp = Math.max(sp, d.Stats.Speed); } });
  let value = 0; D.PC.Slots.forEach(sl => { const v = p[sl.Key]; (Array.isArray(v) ? v : v ? [v] : []).forEach(id => value += (ITEMS[id] || {}).Price || 0); });
  return PC.finish({ Score: round(score, 1), Watts: PC.watts(p), Temp: Math.round(temp), Noise: round(Math.min(10, noise), 1), Throttled: thr, Ram: ram ? ram.Stats.Gb : 0, StorageGb: gb, StorageSpeed: sp, ProColor: gpu ? gpu.Stats.ProColor || 0 : 0, PartsValue: value });
};
PC.laptop = (it, cf) => { const s = it.Stats; return PC.finish({ Score: round((s.CpuScore * 0.55 + s.GpuScore * 0.45) * ramFactor(s.Ram) * (cf || 1), 1), Watts: 90, Temp: 60, Noise: 3, Ram: s.Ram, StorageGb: s.Gb, StorageSpeed: 6, ProColor: s.ProColor || 0, PartsValue: it.Price }); };
PC.public = () => PC.finish({ Score: 18, Watts: 0, Temp: 50, Noise: 5, Ram: 8, StorageGb: 200, StorageSpeed: 1, ProColor: 0, PartsValue: 0 });

// ---------------------------------------------------------------- Progresión
const xpToNext = lvl => Math.floor(100 * Math.pow(lvl, 1.45));
function rankFor(st) {
  let best = 0; D.Ranks.forEach((r, i) => { if (st.level >= r.Level && st.channel.subs >= r.Subs && (st.counters.published || 0) >= r.Videos && st.rep >= r.Rep) best = i; });
  return { index: best, rank: D.Ranks[best] };
}
