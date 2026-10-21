// Entrada unificada: teclado, ratón/táctil (botones virtuales) y mando básico. Acciones lógicas:
// up down left right confirm cancel menu run
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyZ: 'confirm', KeyE: 'confirm',
  Escape: 'cancel', Backspace: 'cancel', KeyX: 'cancel', KeyQ: 'cancel',
  KeyM: 'menu', Tab: 'menu', ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'run',
};
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class Input {
  constructor() {
    this.held = new Set(); this.order = []; this.handlers = []; this.enabled = true;
    this.locked = false;
    window.addEventListener('keydown', (e) => this._down(e));
    window.addEventListener('keyup', (e) => this._up(e));
    window.addEventListener('blur', () => { this.held.clear(); this.order = []; });
  }
  _down(e) {
    const a = KEYMAP[e.code];
    if (!a) return;
    // Dentro de un campo de texto, las teclas son del campo (Retroceso, Espacio, flechas...) salvo Esc/Enter. Esta comprobación va ANTES de
    // preventDefault: si no, no se podría borrar ni escribir espacios en el nombre del personaje.
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !['Escape', 'Enter', 'NumpadEnter'].includes(e.code)) return;
    this.sawKey = true;                          // el juego sabe que quien juega tiene teclado (si no, se ofrece el pad en pantalla)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
    if (!this.held.has(a)) { this.held.add(a); if (DIRS[a]) { this.order = this.order.filter((x) => x !== a); this.order.push(a); } this.press(a, e.repeat); }
    else if (e.repeat && (DIRS[a])) this.press(a, true);
  }
  _up(e) { const a = KEYMAP[e.code]; if (!a) return; this.held.delete(a); this.order = this.order.filter((x) => x !== a); }
  /** Pulsación lógica (también la usan los botones táctiles) */
  press(action, repeat = false) {
    if (!this.enabled) return;
    const h = this.handlers[this.handlers.length - 1];
    if (h) h(action, repeat);
  }
  pressVirtual(a, down) {
    if (down) { if (!this.held.has(a)) { this.held.add(a); if (DIRS[a]) { this.order = this.order.filter((x) => x !== a); this.order.push(a); } this.press(a, false); } }
    else { this.held.delete(a); this.order = this.order.filter((x) => x !== a); }
  }
  /** Dirección mantenida (la última pulsada) */
  dir() { for (let i = this.order.length - 1; i >= 0; i--) if (this.held.has(this.order[i])) return this.order[i]; return null; }
  isHeld(a) { return this.held.has(a); }
  /** Apila un manejador de acciones; devuelve función para retirarlo. */
  push(fn) { this.handlers.push(fn); return () => { const i = this.handlers.lastIndexOf(fn); if (i >= 0) this.handlers.splice(i, 1); }; }
}
