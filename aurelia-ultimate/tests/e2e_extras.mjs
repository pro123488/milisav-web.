// Sistemas "extra" en el navegador real: guardería (menús), boutique, revancha de un entrenador y torneo del Coliseo.
import { launch, sleep, key, advance, driveBattle, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  const C = au.Creatures; const mv = ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'];
  for (const [sp, lv] of [[2, 70], [1, 60], [4, 50]]) g.addCreature(C.createCreature(sp, lv, { moves: mv }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.player.money = 30000; g.state.badges.push('hoja', 'marea', 'chispa');
  Object.assign(g.state.player, { map: 'int_ruta2_guarderia', x: 6, y: 6 });
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
    if (st.scene === 'BattleScene') { await driveBattle(page, { max: 800, smart: true }); continue; }
    if (st.items.length) {
      const re = picks[n++]; let target = re ? st.items.findIndex((t) => re.test(t)) : 0; if (target < 0) target = 0;
      for (let k = st.sel; k < target; k++) await key(page, 'ArrowDown', 1, 80);
      for (let k = st.sel; k > target; k--) await key(page, 'ArrowUp', 1, 80);
      await key(page, 'Enter', 1, 300);
    } else { await key(page, 'Enter', 1, 140); }
  }
  return false;
}

console.log('1) Guardería: aceptar el reto, dejar una criatura y recogerla');
let r = await script('cuidadora', [/^Sí/, /Dejar una/, /Frondeo/, /Salir/]);
let s = await S(); ok('la criatura queda en la guardería (sale del equipo)', r && s.slots[0] === 2 && s.party.length === 2, JSON.stringify([s.slots, s.party]));
ok('la misión del primer huevo se ofrece y se acepta', s.quests.side_huevo === 'active');
await G(() => { const g = window.__game; g.state.daycare.total = 700; });         // 700 pasos después: la criatura gana experiencia
const mBefore = (await S()).money;
r = await script('cuidadora', [/Recoger una/, /Frondeo/, /Salir/]);
s = await S(); ok('al recogerla vuelve al equipo y se cobra', s.party.length === 3 && s.slots[0] === null && s.money < mBefore, JSON.stringify([s.party, mBefore, s.money]));

console.log('2) Boutique de Dínamo: compra de un cosmético con precio');
await G(async () => { const ow = window.__game.ow; const sp = window.__au.World.getMap('int_dinamo_boutique').spawns.door; await ow.loadMap('int_dinamo_boutique', sp.x, sp.y, 'up', { announce: false }); }); await sleep(500);
const m0 = (await S()).money;
r = await script('dependienta', [/Bufanda azul/, /^Sí/, /Salir/]);
s = await S(); ok('comprar la bufanda desbloquea el cosmético y descuenta el precio', s.wardrobe.includes('scarf:azul') && s.money === m0 - 800, JSON.stringify([s.wardrobe, m0, s.money]));

console.log('3) Revancha: pasados 2 días, un entrenador de ruta ofrece revancha con equipo más fuerte');
const tid = await G(() => { const g = window.__game, W = window.__au.World; const m = W.getMap('ruta2'); const t = m.entities.find((e) => e.kind === 'trainer' && e.trainer); g.state.trainers[t.trainer] = { beaten: true, day: 0 }; g.state.clock.minutes = 3 * 1440 + 600; return t.trainer; });
await G(async () => { const ow = window.__game.ow; await ow.loadMap('ruta2', 18, 12, 'down', { announce: false }); }); await sleep(500);
const base = await G((id) => { const T = window.__au; return null; }, tid);
await G((id) => { const g = window.__game, ow = g.ow; const e = ow.ents.find((q) => q.def && q.def.trainer === id); window.__done = false; ow.run(() => ow.talkTrainer(e)).then(() => { window.__done = true; }); }, tid);
let foeLv = null;
for (let i = 0; i < 300 && foeLv == null; i++) { const st = await G(() => { const sc = window.__game.scene; return sc?.constructor.name === 'BattleScene' ? { lv: sc.b.active(1).lv, rematch: true } : { dlg: !!document.getElementById('dialog') || !!document.querySelector('.mi') }; }); if (st.lv) foeLv = st.lv; else await key(page, 'Enter', 1, 200); }
const baseLv = await G((id) => { const t = window.__au.World.MAP_DEFS; return null; }, tid);
await driveBattle(page, { max: 800 }); await advance(page, { max: 60, quiet: 1200 });
s = await S(); ok('la revancha se juega y queda registrada (rematchDone=1)', foeLv && s.trainers[tid].rematchDone === 1, `${tid}: foe Nv${foeLv}, ${JSON.stringify(s.trainers[tid])}`);

console.log('4) Coliseo: torneo de 3 rondas con premio');
// Los rivales escalan con el nivel medio del equipo y el bot (Enter sin estrategia) pierde combates parejos: se pone al frente un dúo muy superior.
await G(() => { const g = window.__game, C = window.__au.Creatures; for (const sp of [118, 117]) g.state.party.unshift(C.createCreature(sp, 100, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] })); });
await G(async () => { const ow = window.__game.ow; const sp = window.__au.World.getMap('int_oasis_coliseo').spawns.door; await ow.loadMap('int_oasis_coliseo', sp.x, sp.y, 'up', { announce: false }); }); await sleep(500);
const m1 = (await S()).money; const t0 = (await S()).tour;
r = await script('arbitro', [/^Sí/, /^Sí/]);
s = await S(); ok('ganar las 3 rondas suma un torneo y paga el premio', r && s.tour === t0 + 1 && s.money > m1 + 3000, `torneos ${t0}→${s.tour}, dinero ${m1}→${s.money}`);
r = await script('arbitro', []);
s = await S(); ok('no se puede repetir el torneo hasta pasados 3 días', s.tour === t0 + 1);
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((x) => x[1]).length;
console.log(`\nExtras: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
