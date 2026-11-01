// ============================================================================
// Logros nuevos (lista propia, se suman a D.Quests.Achievements: la comprobación,
// el cobro y la app Misiones los tratan como los demás) y adaptación a móvil.
// ============================================================================
"use strict";
const pl = (n, one, many) => n === 1 ? one : many.replace("%s", fmtInt(n));
const EXTRA_TRACKS = [
  ["company_contracts", n => pl(n, "Cumple 1 encargo de un cliente", "Cumple %s encargos de clientes"), [1, 5, 15, 40], 300, 120, { 4: "Productor de éxito" }],
  ["staff_hired", n => pl(n, "Contrata a tu primer empleado", "Contrata a %s empleados"), [1, 5, 15], 200, 80, { 3: "Jefe de equipo" }],
  ["companies", () => "Funda tu productora", [1], 500, 200, { 1: "Empresario" }],
  ["secondhand_deals", n => pl(n, "Compra 1 objeto de segunda mano", "Compra %s objetos de segunda mano"), [1, 10, 30], 120, 50, {}],
  ["secondhand_sold", n => pl(n, "Vende 1 objeto en el rastro", "Vende %s objetos en el rastro"), [1, 10, 30], 120, 50, {}],
  ["collectibles_owned", n => pl(n, "Consigue un coleccionable raro", "Ten %s coleccionables raros"), [1, 3, 6], 250, 100, { 3: "Coleccionista" }],
  ["moves", n => pl(n, "Múdate a una nueva casa", "Múdate %s veces"), [1, 3], 150, 60, { 1: "Vecino nuevo" }],
  ["job_tech", n => pl(n, "Resuelve 1 avería como técnico", "Resuelve %s averías como técnico"), [1, 5, 20], 150, 60, { 3: "Manitas del PC" }],
  ["job_press", n => pl(n, "Publica 1 crónica de un evento", "Publica %s crónicas de eventos"), [1, 5, 20], 150, 60, { 3: "Reportero" }],
  ["job_design", n => pl(n, "Diseña 1 cartel para un cliente", "Diseña %s carteles para clientes"), [1, 5, 20], 150, 60, { 3: "Diseñador gráfico" }],
];
const EXTRA_NAMES = { company_contracts: "Encargos de clientes", staff_hired: "Empleados", companies: "Productora", secondhand_deals: "Compras de segunda mano", secondhand_sold: "Ventas al rastro", collectibles_owned: "Coleccionables", moves: "Mudanzas", job_tech: "Técnico informático", job_press: "Periodista", job_design: "Diseñador gráfico" };
const EXTRA_ACH = [];
EXTRA_TRACKS.forEach(([key, name, levels, money, xp, titles]) => levels.forEach((n, i) => EXTRA_ACH.push({ Id: "x_" + key + "_" + (i + 1), Name: name(n), Counter: key, Target: n, Tier: i + 1, Group: EXTRA_NAMES[key], Reward: Object.assign({ Money: Math.round(money * Math.pow(1.8, i)), Xp: Math.round(xp * Math.pow(1.6, i)) }, titles[i + 1] ? { Title: titles[i + 1] } : {}) })));
EXTRA_ACH.forEach(a => { if (!D.Quests.Achievements.some(x => x.Id === a.Id)) D.Quests.Achievements.push(a); });
Object.assign(D.Quests.TrackNames || (D.Quests.TrackNames = {}), EXTRA_NAMES);

// ---------------------------------------------------------------- Móvil: HUD en rejilla, barra deslizable, ventanas a pantalla completa
(function () {
  const css = `
#hudTop { display: contents; }
.plan { display: block; margin: 6px auto; border-radius: 6px; cursor: crosshair; touch-action: none; }
#buildPanel { position: fixed; left: 10px; top: 220px; width: 340px; max-height: calc(100vh - 300px); overflow: auto; z-index: 25; display: none; border: 2px solid var(--accent2); }
#buildPanel select { width: auto; flex: 1; min-width: 0; }
.filters select { width: 100%; }
@media (max-width: 720px), (pointer: coarse) and (max-width: 900px) {
  #hudTop { display: grid; position: fixed; top: 4px; left: 4px; right: 4px; grid-template-columns: 1fr 1fr; gap: 4px; z-index: 6; pointer-events: none; }
  #hudTop > .hud { position: static; transform: none; width: auto; min-width: 0; pointer-events: auto; padding: 5px 7px; }
  #hudLeft { grid-column: 1; grid-row: 1 / span 2; font-size: 11px; }
  #hudLeft .small { font-size: 10px; } #hudLeft b { font-size: 12px; }
  #hudRight { grid-column: 2; grid-row: 1; font-size: 10px; text-align: right; }
  #hudRight b { font-size: 11px; }
  #hudMid { grid-column: 2; grid-row: 2; font-size: 14px; gap: 10px; justify-content: flex-end; align-self: start; }
  #objective { grid-column: 1 / span 2; grid-row: 3; font-size: 11px; }
  #objective div { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  #actionBar { left: 4px; right: 4px; bottom: 4px; transform: none; max-width: none; flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; padding: 4px; -webkit-overflow-scrolling: touch; }
  #actionBar button { flex: 0 0 auto; width: 58px; height: 50px; font-size: 9px; }
  #touchBtns { right: 8px; bottom: 74px; gap: 10px; }
  #touchBtns button { width: 60px; height: 60px; font-size: 12px; white-space: pre-line; }
  #joy { bottom: 80px; }
  #prompt { bottom: 70px; max-width: calc(100vw - 90px); left: 8px; transform: none; font-size: 13px; padding: 10px 14px; min-height: 44px; }
  #toasts { top: auto; bottom: 150px; left: 8px; right: 78px; width: auto; }
  .toast { font-size: 12px; padding: 7px 10px; }
  #banner { min-width: 0; width: 92vw; padding: 10px; } #banner.show { top: 150px; } #banner h2 { font-size: 18px; }
  #rec { top: auto; bottom: 62px; max-height: 48vh; overflow: auto; width: calc(100vw - 8px); }
  #photoUI .ctrl { bottom: 62px; width: calc(100vw - 8px); }
  .modal-back { align-items: stretch; }
  .window { max-width: 100vw !important; width: 100vw !important; height: 100% !important; max-height: 100% !important; border-radius: 0; }
  .window > header { padding: 8px; } .window > header button { min-width: 44px; min-height: 40px; font-size: 16px; }
  .window button, .phone button, .desktop button, #buildPanel button, #rec button { min-height: 38px; }
  input, select, textarea { font-size: 16px; min-height: 38px; }
  .phone { left: 0; right: 0; top: 0; bottom: 0; width: auto; height: auto; max-height: none; transform: none; border-radius: 0; border: 0; padding: 28px 6px 8px; }
  .phone .homegrid { grid-template-columns: repeat(4, 1fr); }
  .desktop { inset: 0; border-radius: 0; border-width: 0; }
  .desktop .win { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; border-radius: 0; }
  .desktop .icons { grid-template-columns: repeat(4, 1fr); max-width: none; }
  .desktop .taskbar { height: 52px; overflow-x: auto; }
  #buildPanel { left: 4px; right: 4px; width: auto; top: auto; bottom: 62px; max-height: 52vh; }
  .grid[style*="2fr 1fr"] { grid-template-columns: 1fr !important; }
}`;
  document.head.appendChild(h("style", null, css));
  const wrap = h("div", { id: "hudTop" }); const ui = document.getElementById("ui");
  ["hudLeft", "hudRight", "hudMid", "objective"].forEach(id => { const el = document.getElementById(id); if (el) wrap.appendChild(el); });
  ui.insertBefore(wrap, ui.firstChild);
})();

Object.assign(window.YT = window.YT || {}, { D, ITEMS, DISTRICTS, EXTRA_ACH });
