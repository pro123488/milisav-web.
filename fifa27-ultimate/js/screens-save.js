/* =====================================================================
   screens-save.js — Guardar y cargar partidas
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, num } = G.U;
  const ico = UI.ico, S = G.Save;

  const slotName = s => s === 'auto' ? 'Autoguardado' : 'Ranura ' + s;
  const when = t => t ? new Date(t).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  UI.register('saves', () => {
    const rows = S.SLOTS.map(slot => {
      const i = S.info(slot);
      const body = i.empty ? '<small class="muted">Vacía</small>'
        : i.bad ? '<small class="warn">Archivo dañado: se conserva una copia de respaldo</small>'
        : `<b>${esc(i.summary.name)}</b> · Nivel ${i.summary.level} · ${num(i.summary.coins)} monedas · ${i.summary.trophies} trofeos<small>${esc((i.summary.bits || []).join(' · ') || 'Sin modos en curso')}</small><small>${when(i.t)} · ${Math.round(i.size / 1024)} KB${i.v < S.SAVE_VERSION ? ' · versión antigua (se migrará)' : ''}</small>`;
      return `<div class="slot ${i.empty ? 'empty' : ''}"><div class="slot-h"><h3>${slotName(slot)}</h3></div><div class="slot-b">${body}</div>
        <div class="slot-a">
          ${slot !== 'auto' ? `<button class="btn" data-act="sv_save" data-slot="${slot}">${ico('saves', 18)}<span>Guardar aquí</span></button>` : ''}
          <button class="btn primary" data-act="sv_load" data-slot="${slot}" ${i.empty ? 'disabled' : ''}>${ico('upload', 18)}<span>Cargar</span></button>
          <button class="btn ghost" data-act="sv_export" data-slot="${slot}" ${i.empty ? 'disabled' : ''} title="Descargar archivo">${ico('download', 18)}</button>
          <button class="btn ghost" data-act="sv_del" data-slot="${slot}" ${i.empty ? 'disabled' : ''} title="Borrar">${ico('trash', 18)}</button>
        </div></div>`;
    }).join('');
    const s = G.state.settings;
    return `${UI.header('Guardar y cargar', { sub: 'Tu progreso se guarda en este navegador. Exporta un archivo para hacer copias de seguridad.' })}
      <div class="slots">${rows}</div>
      <div class="panel"><h3>Más opciones</h3><div class="sv-more">
        <label class="check"><input type="checkbox" data-bind="sv_auto" ${s.autosave ? 'checked' : ''}><span><b>Autoguardado</b><small>Guarda tras cada partido y avance de competición</small></span></label>
        <div class="sv-btns"><button class="btn" data-act="sv_exportnow">${ico('download', 18)}<span>Exportar partida actual</span></button>
        <button class="btn" data-act="sv_import">${ico('upload', 18)}<span>Importar desde archivo</span></button>
        <button class="btn danger" data-act="sv_new">${ico('plus', 18)}<span>Nueva partida</span></button></div>
        <input id="sv-file" type="file" accept=".f27save,.json,.txt" class="hidden"></div></div>`;
  });

  UI.bind('sv_auto', v => { G.state.settings.autosave = v; G.Game.saveSettings(); });
  UI.on('sv_save', el => {
    const slot = el.dataset.slot, i = S.info(slot);
    const doSave = () => { const r = S.write(slot, G.state, ''); if (r.ok) { UI.toast('Partida guardada en la ' + slotName(slot).toLowerCase(), 'good'); G.Audio.confirm && G.Audio.init(); } else UI.toast(r.error, 'error', 6000); UI.refresh(); };
    if (!i.empty) UI.confirm('La ' + slotName(slot).toLowerCase() + ' ya contiene una partida. ¿Sobrescribirla?', doSave, { yes: 'Sobrescribir', danger: true }); else doSave();
  });
  UI.on('sv_load', el => {
    const slot = el.dataset.slot;
    const r = S.read(slot);
    if (!r.ok) { UI.toast(r.error, 'error', 6000); UI.refresh(); return; }
    UI.confirm('Cargar la partida «' + esc(r.state.profile.name) + '» reemplazará la partida actual (los cambios sin guardar se perderán). ¿Continuar?', () => {
      G.Game.loadState(r.state); (r.warnings || []).forEach(w => UI.toast(w, 'info', 5000)); UI.toast('Partida cargada', 'good'); UI.go('menu', {}, { root: true });
    }, { yes: 'Cargar' });
  });
  UI.on('sv_del', el => UI.confirm('¿Borrar definitivamente la ' + slotName(el.dataset.slot).toLowerCase() + '? Esta acción no se puede deshacer.', () => { S.remove(el.dataset.slot); UI.refresh(); }, { danger: true, yes: 'Borrar' }));

  function download(name, text) {
    try {
      const blob = new Blob([text], { type: 'application/octet-stream' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return true;
    } catch (e) { UI.toast('No se pudo exportar: ' + e.message, 'error'); return false; }
  }
  UI.on('sv_export', el => { const t = G.store.get(S.key(el.dataset.slot)); if (t) download(`fifa27-${el.dataset.slot}-${Date.now()}.f27save`, t); });
  UI.on('sv_exportnow', () => { if (download(`fifa27-${G.state.profile.name.replace(/\W+/g, '_')}-${new Date().toISOString().slice(0, 10)}.f27save`, S.exportText(G.state))) UI.toast('Archivo exportado', 'good'); });
  UI.on('sv_import', () => { const f = document.getElementById('sv-file'); f.value = ''; f.onchange = () => {
    const file = f.files && f.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const r = S.readEnvelope(String(rd.result));
      if (!r.ok) { UI.toast(r.error, 'error', 6000); return; }
      UI.confirm('Se importará la partida «' + esc(r.state.profile.name) + '» y sustituirá la actual. ¿Continuar?', () => { G.Game.loadState(r.state); UI.toast('Partida importada', 'good'); UI.go('menu', {}, { root: true }); }, { yes: 'Importar' });
    };
    rd.onerror = () => UI.toast('No se pudo leer el archivo', 'error');
    rd.readAsText(file);
  }; f.click(); });
  UI.on('sv_new', () => UI.modal({ title: 'Nueva partida', body: '<p>Se creará un perfil nuevo y se perderá la partida actual (guárdala antes si quieres conservarla).</p><label class="check"><input type="checkbox" id="sv-rand"><span><b>Generar un mundo distinto</b><small>Otros jugadores y plantillas (semilla aleatoria)</small></span></label>',
    buttons: [{ label: 'Cancelar' }, { label: 'Empezar de cero', cls: 'danger', fn: () => { const r = document.getElementById('sv-rand'); G.Game.newGame({ randomSeed: false }); UI.toast('Nueva partida creada', 'good'); UI.go('menu', {}, { root: true }); } }] }));
  UI.on('sv_new2', () => 0);

  /* Autoguardado: tras cada partido registrado y avance de competición */
  G.bus.on('matchRecorded', () => G.Game.autosave());
  G.bus.on('compFinished', () => G.Game.autosave());
  G.bus.on('progress', () => G.Game.autosave());
})(typeof window !== 'undefined' ? window : globalThis);
