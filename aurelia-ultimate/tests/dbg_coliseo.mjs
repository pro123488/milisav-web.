// Depuración del torneo del Coliseo: resultado y salud del equipo por ronda.
import { launch, sleep, key, advance, driveBattle, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  const C = au.Creatures; const mv = ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'];
  for (const [sp, lv] of [[2, 70], [1, 60], [4, 50]]) g.addCreature(C.createCreature(sp, lv, { moves: mv }));
  for (const sp of [118, 117]) g.state.party.unshift(C.createCreature(sp, 100, { moves: mv }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.player.money = 30000; g.state.badges.push('hoja', 'marea', 'chispa');
  Object.assign(g.state.player, { map: 'int_oasis_coliseo', x: 9, y: 8 });
});
await G(() => { setInterval(() => { for (const c of window.__game.party) for (const m of c.moves || []) m.pp = m.max; }, 300); });
const S = () => G(() => { const g = window.__game; return { map: g.state.player.map, money: g.state.player.money, party: g.party.map((c) => c.sp), slots: g.state.daycare.slots.map((s) => s && s.mon.sp), quests: Object.fromEntries(Object.entries(g.state.quests).map(([q, v]) => [q, v.status])), wardrobe: [...g.state.wardrobe.unlocked], tour: g.state.stats.tournaments, trainers: g.state.trainers }; });
/** Ejecuta un guion y responde los menús según una lista de expresiones (o la primera opción); los diálogos avanzan solos. */
async function script(entityId, picks = []) {
  await G((id) => { const g = window.__game, ow = g.ow; const e = ow.entity(id) || ow.ents.find((q) => q.def.name === id); window.__done = false; ow.run(() => e.def.talk(g, e, ow)).then(() => { window.__done = true; }); }, entityId);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (await G(() => window.__done)) return true;
    const st = await G(() => { const g = window.__game; const items = [...document.querySelectorAll('.mi')].map((x) => x.textContent.trim()); const sel = [...document.querySelectorAll('.mi')].findIndex((x) => x.classList.contains('sel')); return { items, sel, dlg: !!document.getElementById('dialog'), scene: g.scene?.constructor.name }; });
    if (st.scene === 'BattleScene') { await driveBattle(page, { max: 800 }); continue; }
    if (st.items.length) {
      const re = picks[n++]; let target = re ? st.items.findIndex((t) => re.test(t)) : 0; if (target < 0) target = 0;
      for (let k = st.sel; k < target; k++) await key(page, 'ArrowDown', 1, 80);
      for (let k = st.sel; k > target; k--) await key(page, 'ArrowUp', 1, 80);
      await key(page, 'Enter', 1, 300);
    } else { await key(page, 'Enter', 1, 140); }
  }
  return false;
}



await G(() => { const g = window.__game; window.__r = null; g.battleTrainer('coliseo1', { rematch: true }).then((r) => { window.__r = r; }); });
const snap = () => G(() => {
  const g = window.__game, s = g.scene, b = s?.b;
  if (!b || s.constructor.name !== 'BattleScene') return { scene: s?.constructor.name, r: window.__r && window.__r.result };
  const a = (si) => { const m = b.active(si); return `${m.sp} Nv${m.lv} ${m.hp}/${m.maxHp} ${m.status || ''}`; };
  return { turn: b.turnNo, me: a(0), foe: a(1), foeLeft: b.sides[1].party.filter((p) => p.hp > 0).length, meLeft: b.sides[0].party.filter((p) => p.hp > 0).length, txt: (s.textEl?.innerText || '').slice(0, 80), menu: document.querySelector('#battleui .menu')?.innerText?.replace(/\n/g, ' | ').slice(0, 110) };
});
for (let i = 0; i < 300; i++) {
  await page.keyboard.press('Enter'); await sleep(80);
  if (i % 10 === 0) { const s = await snap(); console.log(i, JSON.stringify(s)); if (s.scene && s.scene !== 'BattleScene' && i > 5) break; }
}
console.log('resultado', JSON.stringify(await G(() => window.__r && window.__r.result)));
console.log(errors.join('\n')); await browser.close();
