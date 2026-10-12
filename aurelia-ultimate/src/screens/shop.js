// Tienda: comprar y vender objetos con cantidades, límites de dinero y precios claros.
import { el, fmtMoney } from '../util.js';
import { SHOPS, shopStock } from '../data/shops.js';
import { getItem, POCKETS } from '../data/items.js';
import { bagList, bagCount } from '../inventory.js';
import { COSMETICS, hasCosmetic } from './wardrobe.js';

export function openShop(g, shopId) {
  const shop = SHOPS[shopId] || SHOPS.general;
  return g.ui.openScreen(shop.name, (close, scr) => {
    let mode = 'buy', sel = 0, qty = 1, list = [];
    const tabs = el('div', { class: 'tabs' }), listEl = el('div', { class: 'col scroll', style: { gap: '2px', width: '420px' } }), desc = el('div', { class: 'panel grow col' });
    const money = el('div', { class: 'gold big', style: { marginLeft: 'auto', marginRight: '14px' } }); scr.head.insertBefore(money, scr.head.querySelector('.x'));
    scr.body.append(el('div', { class: 'col', style: { width: '440px' } }, [tabs, listEl]), desc);
    const entries = () => mode === 'buy' ? shopStock(shopId, g.badges.length).map((id) => ({ id, price: getItem(id).price, item: getItem(id) })) : bagList(g.bag).filter((x) => x.item.sell).map((x) => ({ id: x.item.id, price: Math.floor(x.item.price / 2), item: x.item, n: x.n }));
    const render = () => {
      money.textContent = '₳ ' + g.money.toLocaleString('es-ES');
      tabs.innerHTML = ''; [['buy', 'Comprar'], ['sell', 'Vender']].forEach(([k, t]) => tabs.append(el('div', { class: 'tab' + (mode === k ? ' on' : ''), onclick: () => { mode = k; sel = 0; qty = 1; render(); } }, t)));
      list = entries(); if (sel >= list.length) sel = Math.max(0, list.length - 1);
      listEl.innerHTML = ''; if (!list.length) listEl.append(el('div', { class: 'dim', style: { padding: '12px' } }, mode === 'buy' ? 'No hay nada a la venta ahora mismo.' : 'No tienes objetos vendibles.'));
      list.forEach((e, i) => { const row = el('div', { class: 'mi' + (i === sel ? ' sel' : '') + (mode === 'buy' && e.price > g.money ? ' off' : '') }, [el('span', {}, e.item.name), el('span', { class: 'hint' }, `${mode === 'sell' ? '×' + e.n + '  ' : 'tienes ' + bagCount(g.bag, e.id) + '  '}${fmtMoney(e.price)}`)]); row.addEventListener('click', () => { sel = i; qty = 1; render(); doTx(); }); row.addEventListener('mouseenter', () => { if (sel !== i) { sel = i; qty = 1; render(); } }); listEl.append(row); });
      desc.innerHTML = ''; const cur = list[sel];
      if (cur) { const max = mode === 'buy' ? Math.max(1, Math.min(99 - bagCount(g.bag, cur.id), Math.floor(g.money / Math.max(1, cur.price)) || 1)) : cur.n; qty = Math.max(1, Math.min(qty, max)); desc.append(el('div', { class: 'title' }, cur.item.name), el('div', {}, cur.item.desc), el('div', { class: 'small dim' }, POCKETS[cur.item.pocket]), el('div', { class: 'hr' }), el('div', { class: 'row' }, [el('span', {}, 'Cantidad:'), el('button', { class: 'btn', onclick: () => { qty = Math.max(1, qty - 1); render(); } }, '−'), el('b', { class: 'big' }, String(qty)), el('button', { class: 'btn', onclick: () => { qty = Math.min(max, qty + 1); render(); } }, '+'), el('button', { class: 'btn', onclick: () => { qty = Math.min(max, qty + 10); render(); } }, '+10')]), el('div', { style: { marginTop: '8px' } }, `Total: ${fmtMoney(cur.price * qty)}`), el('div', { class: 'spacer' }), el('button', { class: 'btn', onclick: doTx }, mode === 'buy' ? 'Comprar' : 'Vender')); }
    };
    const doTx = async () => {
      const cur = list[sel]; if (!cur) return; const total = cur.price * qty;
      if (mode === 'buy') {
        if (g.money < total) { g.audio.sfx('error'); g.ui.toast('No tienes suficiente dinero.'); return; }
        if (bagCount(g.bag, cur.id) + qty > 99) { g.audio.sfx('error'); g.ui.toast('No puedes llevar más de 99.'); return; }
        g.spend(total); await g.giveItem(cur.id, qty, { quiet: true }); g.audio.sfx('coin'); g.ui.toast(`Compraste ${qty} × ${cur.item.name}`); g.emit('buy', { id: cur.id, n: qty });
      } else {
        if (!(await g.ui.yesNo(`¿Vender ${qty} × ${cur.item.name} por ${fmtMoney(total)}?`))) return;
        g.takeItem(cur.id, qty); g.addMoney(total); g.audio.sfx('coin'); g.ui.toast(`Vendiste ${qty} × ${cur.item.name}: +${fmtMoney(total)}`); g.emit('sell', { id: cur.id, n: qty });
      }
      render();
    };
    render();
    scr._s = { move: (d) => { if (list.length) { sel = (sel + d + list.length) % list.length; qty = 1; render(); } }, qty: (d) => { qty = Math.max(1, qty + d); render(); }, tab: () => { mode = mode === 'buy' ? 'sell' : 'buy'; sel = 0; qty = 1; render(); }, tx: doTx };
  }, { onAction: (a) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._s; if (!b) return false; if (a === 'up') { b.move(-1); return true; } if (a === 'down') { b.move(1); return true; } if (a === 'left') { b.qty(-1); return true; } if (a === 'right') { b.qty(1); return true; } if (a === 'run') { b.tab(); return true; } if (a === 'confirm') { b.tx(); return true; } return false; } });
}
