// Mapa de la región de Aurelia: nodos descubiertos, ubicación actual y viaje rápido.
import { el } from '../util.js';
import { mapExists, getMap } from '../world.js';

export const NODES = [
  { id: 'villa_alba', label: 'Villa Alba', x: 0.09, y: 0.70, type: 'town', maps: ['villa_alba'], fly: 'villa_alba' },
  { id: 'ruta1', label: 'Ruta 1', x: 0.19, y: 0.66, type: 'route', maps: ['ruta1'] },
  { id: 'bosque_umbra', label: 'Bosque Umbra', x: 0.29, y: 0.58, type: 'forest', maps: ['bosque_umbra'] },
  { id: 'ciudad_roble', label: 'Ciudad Roble', x: 0.39, y: 0.50, type: 'city', maps: ['ciudad_roble'], fly: 'ciudad_roble', gym: 'hoja' },
  { id: 'ruta2', label: 'Lago Espejo', x: 0.40, y: 0.65, type: 'lake', maps: ['ruta2'] },
  { id: 'playa_brisa', label: 'Playa Brisa', x: 0.27, y: 0.84, type: 'beach', maps: ['playa_brisa'] },
  { id: 'puerto_marea', label: 'Puerto Marea', x: 0.42, y: 0.82, type: 'city', maps: ['puerto_marea'], fly: 'puerto_marea', gym: 'marea' },
  { id: 'isla_tormenta', label: 'Isla Tormenta', x: 0.56, y: 0.92, type: 'island', maps: ['isla_tormenta'] },
  { id: 'ruta3', label: 'Ruta 3', x: 0.50, y: 0.45, type: 'route', maps: ['ruta3'] },
  { id: 'cueva_eco', label: 'Cueva Eco', x: 0.51, y: 0.33, type: 'cave', maps: ['cueva_eco'] },
  { id: 'ciudad_dinamo', label: 'Ciudad Dínamo', x: 0.61, y: 0.50, type: 'city', maps: ['ciudad_dinamo'], fly: 'ciudad_dinamo', gym: 'chispa' },
  { id: 'ruta_granito', label: 'Ruta Granito', x: 0.62, y: 0.32, type: 'mountain', maps: ['ruta_granito', 'mina_granito'] },
  { id: 'pico_granito', label: 'Pico Granito', x: 0.68, y: 0.19, type: 'city', maps: ['pico_granito'], fly: 'pico_granito', gym: 'cantera' },
  { id: 'desierto_ambar', label: 'Desierto Ámbar', x: 0.74, y: 0.52, type: 'desert', maps: ['desierto_ambar'] },
  { id: 'oasis_zafiro', label: 'Oasis Zafiro', x: 0.83, y: 0.48, type: 'city', maps: ['oasis_zafiro'], fly: 'oasis_zafiro' },
  { id: 'ruta_ceniza', label: 'Ruta Ceniza', x: 0.87, y: 0.60, type: 'volcano', maps: ['ruta_ceniza'] },
  { id: 'ciudad_brasa', label: 'Ciudad Brasa', x: 0.90, y: 0.72, type: 'city', maps: ['ciudad_brasa', 'crater_ignis'], fly: 'ciudad_brasa', gym: 'ascua' },
  { id: 'pantano_niebla', label: 'Pantano Niebla', x: 0.62, y: 0.68, type: 'swamp', maps: ['pantano_niebla'] },
  { id: 'aldea_niebla', label: 'Aldea Niebla', x: 0.64, y: 0.82, type: 'city', maps: ['aldea_niebla'], fly: 'aldea_niebla', gym: 'bruma' },
  { id: 'ruta_nevada', label: 'Ruta Nevada', x: 0.78, y: 0.20, type: 'snow', maps: ['ruta_nevada', 'cueva_hielo'] },
  { id: 'cima_escarcha', label: 'Cima Escarcha', x: 0.88, y: 0.12, type: 'city', maps: ['cima_escarcha'], fly: 'cima_escarcha', gym: 'cristal' },
  { id: 'ruinas_antiguas', label: 'Ruinas Antiguas', x: 0.93, y: 0.30, type: 'ruins', maps: ['ruinas_antiguas'] },
  { id: 'ciudad_arcana', label: 'Ciudad Arcana', x: 0.95, y: 0.42, type: 'city', maps: ['ciudad_arcana'], fly: 'ciudad_arcana', gym: 'dragon' },
  { id: 'calzada_victoria', label: 'Calzada Victoria', x: 0.80, y: 0.30, type: 'route', maps: ['calzada_victoria'] },
  { id: 'meseta_aurora', label: 'Meseta Aurora', x: 0.72, y: 0.06, type: 'league', maps: ['meseta_aurora'], fly: 'meseta_aurora' },
];
export const EDGES = [['villa_alba', 'ruta1'], ['ruta1', 'bosque_umbra'], ['bosque_umbra', 'ciudad_roble'], ['ciudad_roble', 'ruta2'], ['ruta2', 'puerto_marea'], ['puerto_marea', 'playa_brisa'], ['ciudad_roble', 'ruta3'], ['ruta3', 'cueva_eco'], ['ruta3', 'ciudad_dinamo'],
  ['ciudad_dinamo', 'ruta_granito'], ['ruta_granito', 'pico_granito'], ['ciudad_dinamo', 'desierto_ambar'], ['desierto_ambar', 'oasis_zafiro'], ['oasis_zafiro', 'ruta_ceniza'], ['ruta_ceniza', 'ciudad_brasa'], ['ciudad_dinamo', 'pantano_niebla'], ['pantano_niebla', 'aldea_niebla'],
  ['pico_granito', 'ruta_nevada'], ['ruta_nevada', 'cima_escarcha'], ['cima_escarcha', 'ruinas_antiguas'], ['ruinas_antiguas', 'ciudad_arcana'], ['ciudad_arcana', 'calzada_victoria'], ['calzada_victoria', 'meseta_aurora']];
const COLORS = { town: '#f2d060', city: '#ff9a5a', route: '#e8e0c0', forest: '#4aa85a', lake: '#5ab8f0', beach: '#f2e2b0', island: '#7ad8c0', cave: '#a09cb0', mountain: '#b8b0a0', desert: '#e8c97e', volcano: '#ef5b2a', swamp: '#7a9a5a', snow: '#e8f4ff', ruins: '#c8b8e0', league: '#ff6aa8' };

export function nodeVisited(g, n) { return n.maps.some((m) => g.state.flags['v_' + m]); }

export function openWorldMap(g) {
  let result = null;
  return g.ui.openScreen('Mapa de Aurelia', (close, scr) => {
    const W = 880, H = 400;
    const cv = el('canvas', { width: W, height: H, style: { width: W + 'px', height: H + 'px', borderRadius: '10px', border: '3px solid #f2d060' } });
    const info = el('div', { class: 'panel', style: { marginTop: '8px', minHeight: '70px' } }, 'Pasa el ratón por un lugar para ver sus detalles.');
    scr.body.append(el('div', { class: 'col', style: { margin: '0 auto' } }, [cv, info]));
    const ctx = cv.getContext('2d');
    const cur = g.ow?.map?.id; const curNode = NODES.find((n) => n.maps.includes(cur));
    const canFly = g.hasKey('pase_viaje') && !g.ow?.map?.indoor && !g.ow?.map?.cave && !g.ow?.map?.noFly;
    let hover = null, pick = curNode ? NODES.indexOf(curNode) : 0;
    const draw = () => {
      if (!cv.isConnected) { clearInterval(timer); return; }
      // mar y tierra
      let gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a5a9a'); gr.addColorStop(1, '#183a6a'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#4a6a3a'; ctx.beginPath(); ctx.moveTo(30, 300); ctx.bezierCurveTo(60, 150, 200, 120, 330, 90); ctx.bezierCurveTo(480, 40, 700, 20, 820, 50); ctx.bezierCurveTo(870, 150, 880, 250, 850, 360); ctx.bezierCurveTo(700, 390, 520, 392, 360, 372); ctx.bezierCurveTo(200, 380, 80, 360, 30, 300); ctx.fill();
      ctx.fillStyle = '#6a8a4a'; ctx.beginPath(); ctx.ellipse(300, 230, 160, 90, -0.2, 0, 7); ctx.ellipse(620, 170, 150, 80, 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8c0b0'; ctx.beginPath(); ctx.ellipse(560, 80, 110, 40, 0, 0, 7); ctx.ellipse(700, 70, 120, 38, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8c97e'; ctx.beginPath(); ctx.ellipse(670, 205, 70, 40, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a9a5a'; ctx.beginPath(); ctx.ellipse(550, 270, 55, 35, 0, 0, 7); ctx.fill();
      // caminos
      ctx.strokeStyle = 'rgba(255,240,200,.8)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      for (const [a, b] of EDGES) { const A = NODES.find((n) => n.id === a), B = NODES.find((n) => n.id === b); if (!(nodeVisited(g, A) || nodeVisited(g, B))) continue; ctx.beginPath(); ctx.moveTo(A.x * W, A.y * H); ctx.lineTo(B.x * W, B.y * H); ctx.stroke(); }
      ctx.setLineDash([]);
      NODES.forEach((n, i) => {
        const vis = nodeVisited(g, n), exists = n.maps.some(mapExists); if (!vis && !(n.fly && false)) { ctx.fillStyle = 'rgba(20,16,50,.55)'; ctx.beginPath(); ctx.arc(n.x * W, n.y * H, 5, 0, 7); ctx.fill(); return; }
        const r = n.type === 'city' || n.type === 'town' || n.type === 'league' ? 11 : 7;
        ctx.fillStyle = COLORS[n.type] || '#fff'; ctx.strokeStyle = i === pick ? '#fff' : '#1a1226'; ctx.lineWidth = i === pick ? 4 : 2; ctx.beginPath(); ctx.arc(n.x * W, n.y * H, r, 0, 7); ctx.fill(); ctx.stroke();
        if (n.gym && g.state.badges.includes(n.gym)) { ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('★', n.x * W - 5, n.y * H + 4); }
        ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,24,.9)'; ctx.strokeText(n.label, n.x * W, n.y * H - r - 4); ctx.fillStyle = '#fff'; ctx.fillText(n.label, n.x * W, n.y * H - r - 4);
        if (canFly && n.fly && g.state.fastTravel.includes(n.fly)) { ctx.fillStyle = '#6ad8ff'; ctx.fillText('✈', n.x * W + r + 8, n.y * H + 4); }
      });
      if (curNode) { const t = performance.now() / 300; ctx.strokeStyle = '#ff4a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(curNode.x * W, curNode.y * H, 15 + Math.sin(t) * 2, 0, 7); ctx.stroke(); }
    };
    const timer = setInterval(draw, 100); draw();
    const describe = (n) => { info.innerHTML = ''; const vis = nodeVisited(g, n); if (!vis) { info.append(el('div', { class: 'dim' }, '??? — Lugar sin descubrir')); return; } const flyOk = canFly && n.fly && g.state.fastTravel.includes(n.fly) && n.maps.some(mapExists);
      info.append(el('div', { class: 'title', style: { marginBottom: '2px' } }, n.label), el('div', { class: 'small dim' }, n.gym ? `Gimnasio · ${g.state.badges.includes(n.gym) ? 'Medalla conseguida' : 'Medalla pendiente'}` : n.type), flyOk ? el('div', { style: { marginTop: '6px' } }, el('button', { class: 'btn', onclick: () => travel(n) }, '✈ Viajar aquí')) : el('div', { class: 'small dim' }, g.hasKey('pase_viaje') ? (n.fly ? 'Aún no has visitado su centro de curación.' : 'No se puede viajar directamente.') : 'Necesitas el Pase de Viaje para viajar rápido.')); };
    const travel = async (n) => {
      const dest = n.fly; const m = getMap(dest); const sp = m.spawns.fly || m.spawns.start || { x: 1, y: 1, dir: 'down' };
      g.inc('fast_travel_used'); g.emit('fast_travel', { to: dest });
      result = 'closeAll'; close(); g.audio.sfx('warp'); g.ow.busy = true; await g.ui.fade(true, 350); g.state.player.surfing = false; g.state.player.biking = false; await g.ow.loadMap(dest, sp.x, sp.y, sp.dir || 'down'); await g.ui.fade(false, 350); g.ow.busy = false;
    };
    cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; const i = NODES.findIndex((n) => Math.hypot(n.x * W - x, n.y * H - y) < 14); if (i >= 0 && i !== pick) { pick = i; describe(NODES[i]); } });
    cv.addEventListener('click', () => describe(NODES[pick]));
    if (curNode) describe(curNode);
    scr._wm = { timer, move: (d) => { const vis = NODES.map((n, i) => [n, i]).filter(([n]) => nodeVisited(g, n)); const k = vis.findIndex(([, i]) => i === pick); const nx = vis[(k + d + vis.length) % vis.length]; pick = nx[1]; describe(nx[0]); }, go: () => { const n = NODES[pick]; if (canFly && n.fly && g.state.fastTravel.includes(n.fly) && n.maps.some(mapExists) && nodeVisited(g, n)) travel(n); } };
  }, { onAction: (a) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._wm; if (!b) return false; if (a === 'up' || a === 'left') { b.move(-1); return true; } if (a === 'down' || a === 'right') { b.move(1); return true; } if (a === 'confirm') { b.go(); return true; } return false; } }).then((r) => { document.querySelectorAll('.screen').forEach(() => {}); return result; });
}
