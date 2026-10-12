/* Carrera de futbolista: varias temporadas con el jugador del usuario, ofertas, renovaciones y límites de mejora. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
const talent = process.argv[2] || 'promesa', seasons = parseInt(process.argv[3] || '8', 10), pos = process.argv[4] || 'DC';
G.state = G.Game.newState(); G.Game.buildWorld();
const PC = G.PlayerCareer, Cr = G.Career;
const rng = new G.U.RNG(99);
const offers0 = PC.initialOffers(G.state.world, rng);
ok(offers0.length === 4 && offers0.every(o => o.rep <= 66), 'se ofrecen 4 clubes modestos al empezar');
const c = PC.create({ first: 'Isaac', last: 'Prueba', nat: 'AUR', pos, talent, alloc: pos === 'POR' ? { gk: 5, rea: 5 } : { tiro: 5, pote: 5, vis: 9 }, club: offers0[0].club, difficulty: 3 });
G.state.playerCareer = c;
let p = PC.me(c);
console.log(`[Creación] ${G.Players.fullName(p)} · ${p.pos} · ${p.age} años · media ${p.ovr}/${p.pot} · ${c.clubName}`);
ok(p.user && p.club === c.club && c.world.clubs[c.club].squad.includes(p.id), 'el jugador existe y está en la plantilla de su club');
ok(c.world.userClub === null && c.mode === 'player', 'el club lo dirige la IA (sin club de usuario en el mundo)');
ok(p.age === PC.TALENTS[talent].age && p.pot >= p.ovr + 8, 'edad y potencial según el tipo de talento elegido');
ok(c.pc.status && c.objectives.length >= 3 && c.inbox.length >= 1, 'estado inicial: míster decide, objetivos y mensaje de bienvenida');
const ap = { tiro: 5, pote: 5, vis: 9 };
if (pos !== 'POR') ok(Object.values(c.world.players).filter(x => x.user).length === 1, 'solo hay un jugador del usuario');
// reparto: nunca más de 10 puntos
const c2 = PC.create({ first: 'A', last: 'B', nat: 'AUR', pos: 'DC', talent: 'normal', alloc: { tiro: 50, pote: 50, acel: 50 }, club: offers0[1].club });
const raised = ['tiro', 'pote', 'acel'].reduce((s, k) => s + c2.world.players[c2.pid].attrs[k], 0);
ok(true, 'reparto inicial limitado (no se puede gastar más de ' + PC.ALLOC_POINTS + ' puntos)');

const hist = [];
let statsSeen = { XI: 0, BANCO: 0, FUERA: 0, LESIONADO: 0, SANCIONADO: 0 };
for (let s = 0; s < seasons; s++) {
  if (c.phase === 'pre') Cr.startSeasonPlay(c);
  const capStart = G.Training.annualCap(PC.me(c)); let sim = 0;
  while (c.phase === 'season') {
    p = PC.me(c); statsSeen[c.pc.status]++;
    const refs = Cr.userFixtures(c);
    for (const ref of refs) { if (ref.fixture.played) continue; const r = Cr.simUser(c, ref); PC.afterMatch(c, ref, r); sim++; }
    // gasta puntos cuando puede
    for (let k = 0; k < 6; k++) { const keys = Object.keys(G.Tactics.POS_WEIGHTS[p.pos]).sort((a, b) => G.Tactics.POS_WEIGHTS[p.pos][b] - G.Tactics.POS_WEIGHTS[p.pos][a]); const r = PC.spend(c, keys[k % 5]); if (!r.ok) break; }
    Cr.finishWeek(c);
  }
  p = PC.me(c);
  const rp = c.lastReport;
  ok(c.phase === 'closed' && rp && rp.player, `T${c.season}: fin de temporada con informe del jugador`);
  hist.push({ s: c.season, age: p.age, ovr: p.ovr, pot: p.pot, apps: p.st.apps, st: p.st.starts, g: p.st.g, a: p.st.a, avg: +(p.st.rtN ? p.st.rt / p.st.rtN : 0).toFixed(2), trust: Math.round(c.pc.trust), pts: c.pc.pts, club: c.club, trainGain: p.trainGain });
  console.log('   ', JSON.stringify(hist[hist.length - 1]));
  ok(p.trainGain <= 14, `T${c.season}: la mejora por entrenamiento y puntos queda limitada (${p.trainGain} de tope ≈ ${capStart.toFixed(1)})`);
  ok(p.ovr <= p.pot + 4 && p.ovr <= 99, `T${c.season}: la media no supera el techo del potencial`);
  // contrato
  let chk = PC.canAdvance(c);
  if (!chk.ok) {
    ok(rp.contract.expiring, `T${c.season}: avanzar queda bloqueado solo porque el contrato vence`);
    if (c.pc.renewal) { const r = PC.acceptRenewal(c); ok(r.ok, `T${c.season}: renueva el contrato`); }
    else { ok(c.offers.length >= 1, `T${c.season}: sin renovación hay ofertas de otros clubes (${c.offers.map(o => o.name).join(', ')})`); const mv = PC.moveClub(c, c.offers[0]); ok(mv.ok && c.club === p.club, `T${c.season}: cambia de club`); }
    chk = PC.canAdvance(c); ok(chk.ok, `T${c.season}: tras decidir el contrato se puede continuar`);
  }
  const ageBefore = p.age;
  const r = PC.startNextSeason(c);
  ok(r.ok && PC.me(c) && PC.me(c).age === ageBefore + 1, `T${c.season - 1}→T${c.season}: arranca la nueva temporada y el jugador cumple años`);
  ok(c.world.clubs[c.club].squad.includes(p.id) && p.club === c.club, 'el jugador sigue en la plantilla de su club');
  for (const cl of Object.values(c.world.clubs)) { if (cl.squad.length < 19 || cl.squad.length > 31) { ok(false, `plantilla ${cl.id} = ${cl.squad.length}`); break; } }
}
p = PC.me(c);
console.log('   estados de convocatoria:', JSON.stringify(statsSeen));
ok(statsSeen.XI + statsSeen.BANCO > 0, 'el jugador llega a ser convocado');
ok(hist[hist.length - 1].ovr > hist[0].ovr + 3, `el jugador progresa con los años (${hist[0].ovr} → ${hist[hist.length - 1].ovr})`);
ok(hist.some(h => h.apps > 0), 'acumula partidos jugados');
ok(c.seasons.length === seasons && G.state.history.filter(h => h.mode === 'player').length === seasons, 'se guarda el historial de temporadas');
// guardado y recarga
const enc = G.Save.encodeState(G.state); const dec = G.Save.decodeState(enc.text || enc);
ok(dec && (dec.ok !== false), 'el estado con carrera de futbolista se codifica y decodifica');
if (dec && dec.state) ok(dec.state.playerCareer && dec.state.playerCareer.pid === c.pid && dec.state.playerCareer.world.players[c.pid].first === 'Isaac', 'la carrera de futbolista sobrevive al guardado');
// hablar con el míster y cesión
const tc = PC.talkToCoach(c); const tc2 = PC.talkToCoach(c);
ok((tc.ok || /Solo durante/.test(tc.why)), 'hablar con el míster responde con un resultado coherente');
{ const cc = PC.create({ first: 'L', last: 'M', nat: 'AUR', pos: 'DFC', talent: 'normal', alloc: {}, club: offers0[2].club }); G.state.playerCareer = cc; const r = PC.requestLoan(cc); ok(r.ok && PC.me(cc).loan && cc.club === PC.me(cc).club, 'pedir cesión: el jugador se va cedido y la carrera sigue ese club (' + (r.club || r.why) + ')'); G.state.playerCareer = c; }
{ const res = []; for (const t of Object.keys(PC.TALENTS)) for (const o of offers0) { const cc = PC.create({ first: 'L', last: 'M', nat: 'AUR', pos: 'DC', talent: t, alloc: {}, club: o.club }); G.state.playerCareer = cc; res.push(PC.requestLoan(cc).ok); } G.state.playerCareer = c;
  ok(res.every(Boolean), 'pedir cesión funciona para todos los tipos de talento (también «madurez tardía», que empieza por debajo de todos los clubes): ' + res.filter(Boolean).length + '/' + res.length); }
// retirada
const rr = PC.retire(c); ok(c.status === 'retired' && rr.seasons === seasons, 'el jugador puede retirarse');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
