export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const deepClone = (o) => JSON.parse(JSON.stringify(o));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtMoney = (n) => '₳' + Math.floor(n).toLocaleString('es-ES');
export function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
export const uid = (() => { let n = 0; return () => 'u' + Date.now().toString(36) + (n++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); })();
/** Crea un nodo DOM: el('div', {class:'x', onclick:fn}, [hijos|texto]) */
export function el(tag, props = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

// Evita que `append(null)` / `append(cond && nodo)` escriba el texto "null"/"false" en pantalla (el DOM lo convierte a cadena).
if (typeof Element !== 'undefined') {
  for (const m of ['append', 'prepend']) { const orig = Element.prototype[m]; Element.prototype[m] = function (...a) { return orig.apply(this, a.filter((x) => x != null && x !== false)); }; }
}
