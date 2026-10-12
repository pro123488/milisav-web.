// Armario: ropa, sombreros, accesorios, colores, efectos visuales y diseños de cápsula. Todo es opcional.
import { el } from '../util.js';
import { trainerCanvas, HAIR_STYLES, OUTFITS, HATS, SKINS, HAIR_COLORS, OUTFIT_COLORS, PANTS_COLORS } from '../gfx/trainer_gfx.js';
import { fmtMoney } from '../util.js';

/** Catálogo: id 'tipo:nombre'. start = disponible desde el principio; price = en la boutique; ach = se consigue con logros/misiones */
export const COSMETICS = {};
const C = (id, kind, name, o) => { COSMETICS[id] = { id, kind, name, ...o }; };
// Base (siempre disponibles)
for (const [v, n] of HATS) if (!['crown', 'laurel', 'tophat'].includes(v)) C('hat:' + v, 'hat', n, { start: true, apply: (l) => { l.hat = v; } });
for (const [v, n] of OUTFITS) C('outfit:' + v, 'outfit', n, { start: v !== 'uniform' && v !== 'coat', price: v === 'coat' ? 1500 : 0, apply: (l) => { l.outfit = v; } });
for (const [v, n] of HAIR_STYLES) C('hair:' + v, 'hair', n, { start: true, apply: (l) => { l.hair = v; } });
// Desbloqueables
C('hat:crown', 'hat', 'Corona dorada', { apply: (l) => { l.hat = 'crown'; }, how: 'Logro: Ocho medallas' });
C('hat:laurel', 'hat', 'Corona de laurel', { apply: (l) => { l.hat = 'laurel'; }, how: 'Logro: Campeón de torneo' });
C('hat:tophat', 'hat', 'Chistera', { apply: (l) => { l.hat = 'tophat'; }, how: 'Logro: Fortuna' });
C('bag:aventurero', 'acc', 'Mochila dorada', { apply: (l) => { l.bag = '#e0b83a'; }, how: 'Logro: Trotamundos' });
C('bag:plata', 'acc', 'Mochila plateada', { apply: (l) => { l.bag = '#b8c4d4'; }, price: 1200 });
C('bag:none', 'acc', 'Sin mochila', { start: true, apply: (l) => { l.bag = null; } });
C('bag:basica', 'acc', 'Mochila roja', { start: true, apply: (l) => { l.bag = '#d84a4a'; } });
C('scarf:rojo', 'acc', 'Bufanda roja', { apply: (l) => { l.scarf = '#d84a4a'; }, how: 'Logro: Manos a la obra' });
C('scarf:azul', 'acc', 'Bufanda azul', { apply: (l) => { l.scarf = '#4a7ad8'; }, price: 800 });
C('scarf:none', 'acc', 'Sin bufanda', { start: true, apply: (l) => { l.scarf = null; } });
C('glasses:none', 'acc', 'Sin gafas', { start: true, apply: (l) => { l.glasses = false; } });
C('glasses:normal', 'acc', 'Gafas', { start: true, apply: (l) => { l.glasses = true; } });
C('glasses:corazon', 'acc', 'Gafas de corazón', { apply: (l) => { l.glasses = true; l.heartGlasses = true; }, how: 'Logro: Mejores amigos' });
C('effect:none', 'effect', 'Sin efecto', { start: true, effect: null });
C('effect:estrellas', 'effect', 'Estela de estrellas', { effect: 'estrellas', how: 'Logro: Enciclopedista' });
C('effect:aura', 'effect', 'Aura luminosa', { effect: 'aura', how: 'Logro: Cazador de leyendas' });
C('effect:destellos', 'effect', 'Destellos', { effect: 'destellos', how: 'Logro: Destello' });
C('effect:rayos', 'effect', 'Chispas eléctricas', { effect: 'rayos', how: 'Logro: Bajo la tormenta' });
C('effect:petalos', 'effect', 'Pétalos al caminar', { effect: 'petalos', price: 4000 });
C('ball:normal', 'ball', 'Cápsula clásica', { start: true, ball: 'normal' });
C('ball:estrella', 'ball', 'Cápsula estrellada', { ball: 'estrella', price: 3000 });
C('ball:fuego', 'ball', 'Cápsula ígnea', { ball: 'fuego', price: 3000 });
C('ball:hielo', 'ball', 'Cápsula helada', { ball: 'hielo', price: 3000 });
C('ball:arcoiris', 'ball', 'Cápsula arcoíris', { ball: 'arcoiris', how: 'Logro: Arco iris' });
export const BALL_DESIGNS = { normal: null, estrella: ['#2a2a6a', '#f2d060'], fuego: ['#ef5b2a', '#ffd24a'], hielo: ['#7fd8e6', '#ffffff'], arcoiris: ['#d84a9a', '#4ad8c8'] };

export const hasCosmetic = (g, id) => COSMETICS[id]?.start || g.state.wardrobe.unlocked.includes(id);
export function unlockCosmetic(g, id) {
  if (!COSMETICS[id] || hasCosmetic(g, id)) return false;
  g.state.wardrobe.unlocked.push(id); g.ui.toast(`👕 Nuevo cosmético: <b>${COSMETICS[id].name}</b>`); g.emit('cosmetic', { id }); return true;
}
export function installCosmetics(g) { g.unlockCosmetic = (id) => unlockCosmetic(g, id); }

export function openWardrobe(g) {
  const st = g.state, look = st.player.look;
  return g.ui.openScreen('Armario', (close, scr) => {
    const KINDS = [['hat', 'Sombreros'], ['outfit', 'Ropa'], ['hair', 'Peinados'], ['acc', 'Accesorios'], ['color', 'Colores'], ['effect', 'Efectos'], ['ball', 'Cápsulas']];
    let kind = 'hat', sel = 0, dir = 0; const dirs = ['down', 'right', 'up', 'left'];
    const preview = el('canvas', { width: 16, height: 24, style: { width: '192px', height: '288px', imageRendering: 'pixelated' } });
    const tabs = el('div', { class: 'tabs' }), list = el('div', { class: 'col scroll', style: { gap: '2px', width: '420px' } }), note = el('div', { class: 'small dim', style: { marginTop: '6px', minHeight: '34px' } });
    scr.body.append(el('div', { class: 'panel col', style: { alignItems: 'center', width: '260px' } }, [preview, el('div', { class: 'row' }, [el('button', { class: 'btn', onclick: () => { dir = (dir + 3) % 4; draw(); } }, '⟲'), el('button', { class: 'btn', onclick: () => { dir = (dir + 1) % 4; draw(); } }, '⟳')])]), el('div', { class: 'col', style: { width: '440px' } }, [tabs, list, note]), el('div', { class: 'panel grow col' }, [el('div', { class: 'title' }, 'Tu estilo'), el('div', { class: 'dim small' }, 'Los cosméticos son opcionales: no hacen falta para progresar. Se consiguen con logros, misiones y en la Boutique de Ciudad Dínamo.')]));
    const draw = () => { const g2 = preview.getContext('2d'); g2.clearRect(0, 0, 16, 24); g2.drawImage(trainerCanvas(look, dirs[dir], 0), 0, 0); };
    const items = () => {
      if (kind === 'color') return [...OUTFIT_COLORS.map((c, i) => ({ id: 'top:' + i, name: 'Ropa · color ' + (i + 1), swatch: c, set: () => { look.top = i; } })), ...PANTS_COLORS.map((c, i) => ({ id: 'bot:' + i, name: 'Pantalón · color ' + (i + 1), swatch: c, set: () => { look.bottom = i; } })), ...HAIR_COLORS.map((c, i) => ({ id: 'hc:' + i, name: 'Pelo · color ' + (i + 1), swatch: c, set: () => { look.hairColor = i; } })), ...SKINS.map((c, i) => ({ id: 'sk:' + i, name: 'Piel · tono ' + (i + 1), swatch: c, set: () => { look.skin = i; } }))].map((x) => ({ ...x, own: true }));
      return Object.values(COSMETICS).filter((c) => c.kind === kind).map((c) => ({ ...c, own: hasCosmetic(g, c.id) }));
    };
    const equipped = (c) => { if (kind === 'effect') return (st.cosmetic.effect || null) === (c.effect ?? null); if (kind === 'ball') return (st.cosmetic.ballDesign || 'normal') === c.ball; if (kind === 'color' || !c.apply) return false; const t = { ...look }; c.apply(t); return JSON.stringify(t) === JSON.stringify(look); };
    const render = () => {
      tabs.innerHTML = ''; KINDS.forEach(([k, t]) => tabs.append(el('div', { class: 'tab' + (k === kind ? ' on' : ''), onclick: () => { kind = k; sel = 0; render(); } }, t)));
      const its = items(); if (sel >= its.length) sel = 0; list.innerHTML = '';
      its.forEach((c, i) => { const row = el('div', { class: 'mi' + (i === sel ? ' sel' : '') + (c.own ? '' : ' off'), style: { opacity: c.own ? 1 : 0.65 } }, [c.swatch ? el('span', { style: { width: '20px', height: '20px', borderRadius: '4px', background: c.swatch, border: '2px solid #fff' } }) : null, el('span', {}, c.name), el('span', { class: 'hint' }, equipped(c) ? '✔ puesto' : c.own ? '' : c.price ? `🔒 ${fmtMoney(c.price)} (Boutique)` : '🔒 ' + (c.how || ''))]); row.addEventListener('click', () => { sel = i; choose(c); render(); }); row.addEventListener('mouseenter', () => { if (sel !== i) { sel = i; render(); } }); list.append(row); });
      const cur = its[sel]; note.textContent = cur ? (cur.own ? '' : cur.price ? `Se vende en la Boutique de Ciudad Dínamo por ${fmtMoney(cur.price)}.` : `Se desbloquea: ${cur.how || ''}`) : ''; draw();
    };
    const choose = (c) => {
      if (!c.own) { g.audio.sfx('error'); return; }
      g.audio.sfx('confirm');
      if (c.set) c.set(); else if (kind === 'effect') st.cosmetic.effect = c.effect; else if (kind === 'ball') st.cosmetic.ballDesign = c.ball; else if (c.apply) c.apply(look);
      g.state.player.look = look; if (g.ow?.player) g.ow.player.look = look;
    };
    render();
    scr._w = { move: (d) => { const n = items().length; sel = (sel + d + n) % n; render(); }, tab: (d) => { const i = KINDS.findIndex(([k]) => k === kind); kind = KINDS[(i + d + KINDS.length) % KINDS.length][0]; sel = 0; render(); }, pick: () => { choose(items()[sel]); render(); } };
  }, { onAction: (a) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._w; if (!b) return false; if (a === 'up') { b.move(-1); return true; } if (a === 'down') { b.move(1); return true; } if (a === 'left') { b.tab(-1); return true; } if (a === 'right') { b.tab(1); return true; } if (a === 'confirm') { b.pick(); return true; } return false; } });
}
