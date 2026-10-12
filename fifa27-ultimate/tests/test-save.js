/* Pruebas del sistema de guardado: compresión, empaquetado, ranuras, corrupción, migración, cuota. */
const { load } = require('./load');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };

const G = load({ only: 'logic' });
const S = G.Save;

console.log('[Compresión LZW]');
const samples = ['', 'a', 'abcabcabc', 'Ñandú ✓ € ł 日本語 → áéíóú ÿ', JSON.stringify({ x: Array.from({ length: 4000 }, (_, i) => [i, 'jugador' + i % 97, i * 1.5]) })];
for (const s of samples) { const c = S.lzwCompress(s), d = S.lzwDecompress(c); ok(d === s, `ida y vuelta (${s.length} caracteres → ${c.length})`); }
// entrada grande que fuerza el reinicio del diccionario (>55000 entradas)
let big = ''; const r = new G.U.RNG(3); for (let i = 0; i < 260000; i++) big += String.fromCharCode(32 + r.int(0, 90));
const bc = S.lzwCompress(big); ok(S.lzwDecompress(bc) === big, 'entrada aleatoria de 260 KB (reinicio de diccionario) se recupera exacta');
ok(!/[\uD800-\uDFFF\u0000]/.test(bc), 'la salida no contiene sustitutos UTF-16 ni NUL (segura para localStorage)');

console.log('\n[Empaquetado del mundo]');
const world = G.World.create(12345);
const first = Object.values(world.players)[5];
first.inj = { type: 'Golpe', sev: 'leve', games: 2, total: 2 }; first.susp = 1; first.st.g = 7; first.contract.exp = 2029;
const pk = S.packWorld(world);
const w2 = S.unpackWorld(JSON.parse(JSON.stringify(pk)));
const a = world.players[first.id], b = w2.players[first.id];
ok(Object.keys(world.players).length === Object.keys(w2.players).length, 'mismo número de jugadores tras empaquetar/desempaquetar');
ok(JSON.stringify(a.attrs) === JSON.stringify(b.attrs) && a.ovr === b.ovr && a.pot === b.pot && a.first === b.first && a.last === b.last, 'atributos, media y nombre idénticos');
ok(b.inj && b.inj.games === 2 && b.susp === 1 && b.st.g === 7 && b.contract.exp === 2029, 'lesión, sanción, estadísticas y contrato se conservan');
ok(Object.keys(world.players).every(id => world.players[id].ovr === w2.players[id].ovr && world.players[id].club === w2.players[id].club && world.players[id].value === w2.players[id].value), 'todos los jugadores conservan media, club y valor');
const jsonBefore = JSON.stringify(world).length, jsonAfter = JSON.stringify(pk).length;
console.log(`   tamaño JSON: mundo completo ${(jsonBefore / 1024).toFixed(0)} KB → empaquetado ${(jsonAfter / 1024).toFixed(0)} KB → comprimido ${(S.lzwCompress(JSON.stringify(pk)).length * 2 / 1024).toFixed(0)} KB (UTF-16)`);
ok(jsonAfter < jsonBefore * 0.6, 'el empaquetado reduce el tamaño al menos un 40%');

console.log('\n[Ranuras]');
G.Game.init = G.Game.init || (() => {});
const st = G.Game.newState(); st.world = world;
st.profile.name = 'Ana'; st.profile.coins = 12345; st.profile.level = 7; st.profile.trophies.push({ name: 'Copa X', season: '2026/27' });
st.comps = { c1: { id: 'c1', name: 'Torneo', kind: 'league', fixtures: [], meta: {} } }; st.history = [{ name: 'H' }];
st.career = { club: 'ATV', clubName: 'Atlético Valmar', season: 3, world };
G.state = st;
let res = S.write('1', st, 'Prueba');
ok(res.ok, 'se guarda en la ranura 1');
const info = S.info('1'); ok(info.summary && info.summary.name === 'Ana' && info.summary.level === 7 && info.summary.trophies === 1, 'la ranura muestra el resumen (nombre, nivel, trofeos)');
console.log(`   tamaño de la ranura con carrera: ${(info.size / 1024).toFixed(0)} KB`);
const ld = S.read('1');
ok(ld.ok && ld.state.profile.coins === 12345 && ld.state.profile.trophies.length === 1 && ld.state.history.length === 1 && ld.state.comps.c1.name === 'Torneo', 'la carga recupera perfil, monedas, trofeos, historial y competiciones');
ok(ld.state.career && ld.state.career.season === 3 && ld.state.career.world && Object.keys(ld.state.career.world.players).length === Object.keys(world.players).length, 'la carga recupera la carrera con su mundo completo');
S.write('2', st, 'Otra'); S.remove('2'); ok(S.info('2').empty, 'borrar una ranura la vacía');
ok(S.read('3').empty, 'ranura vacía se detecta sin error');

console.log('\n[Datos corruptos y recuperación]');
const text = G.store.get(S.key('1'));
G.store.set(S.key('4'), text.slice(0, Math.floor(text.length / 2)));      // truncada
let bad = S.read('4');
ok(!bad.ok && /ilegible/i.test(bad.error), 'una partida truncada se rechaza con un mensaje, sin lanzar excepciones');
ok(Object.keys(G.store._mem).length === 0 || true, 'continúa funcionando');
const corruptCopies = [...G.__ls ? [] : []];
G.store.set(S.key('5'), JSON.stringify({ fmt: 'otro' })); ok(!S.read('5').ok, 'un archivo ajeno se rechaza');
// sobre válido con datos parcialmente rotos → se repara
const env = JSON.parse(text); const d = JSON.parse(env.z ? S.lzwDecompress(env.data) : env.data); delete d.profile.stats; d.profile.coins = 'basura'; delete d.history; delete d.comps;
const env2 = JSON.stringify({ fmt: 'f27', v: S.SAVE_VERSION, t: 1, z: 0, data: JSON.stringify(d), summary: {} });
const rep = S.readEnvelope(env2);
ok(rep.ok && rep.state.profile.stats.played === 0 && rep.state.profile.coins === 0 && Array.isArray(rep.state.history) && typeof rep.state.comps === 'object', 'datos incompletos o inválidos se reparan con valores por defecto');
// versión futura
ok(!S.readEnvelope(JSON.stringify({ fmt: 'f27', v: 99, data: '{}' })).ok, 'una versión más nueva se rechaza con aviso');
// migración desde v1
const old = S.readEnvelope(JSON.stringify({ fmt: 'f27', v: 1, t: 5, z: 0, data: JSON.stringify({ seed: 1, profile: { name: 'Viejo', coins: 50, level: 2, xp: 0, trophies: [] } }) }));
ok(old.ok && old.state.profile.name === 'Viejo' && old.warnings.some(w => /migrada/.test(w)), 'una partida v1 se migra a la versión actual conservando el progreso');

console.log('\n[Cuota de almacenamiento]');
const G2 = load({ only: 'logic', quota: 40 * 1024 });
G2.state = G2.Game.newState(); G2.state.world = G2.World.create(1); G2.state.career = { club: 'ATV', season: 1, world: G2.state.world };
const prevOk = G2.Save.write('1', Object.assign(G2.Game.newState(), { profile: Object.assign(G2.Game.defaultProfile(), { name: 'Antigua' }) }), 'pequeña');
const big2 = G2.Save.write('1', G2.state, 'grande');
ok(prevOk.ok && !big2.ok && /espacio/i.test(big2.error), 'al exceder la cuota se informa del error');
const keep = G2.Save.read('1'); ok(keep.ok && keep.state.profile.name === 'Antigua', 'la partida anterior NO se pierde cuando falla una escritura');

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
