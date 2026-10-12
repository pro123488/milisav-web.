/* =====================================================================
   art.js — Arte vectorial original (SVG generado por código)
   Escudos de club (forma + patrón + icono + colores), banderas de
   naciones ficticias, camisetas, retratos de jugadores (cara procedural)
   y marcos de carta. Todo es original: ningún recurso protegido.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  let _gid = 0;
  const gid = p => p + (++_gid);

  /* ---------- Escudos ---------- */
  const SHAPES = {
    shield:  'M50 4 C70 12 88 12 92 12 L92 52 C92 76 70 92 50 98 C30 92 8 76 8 52 L8 12 C12 12 30 12 50 4 Z',
    round:   'M50 4 A46 46 0 1 1 49.9 4 Z',
    diamond: 'M50 3 L94 50 L50 97 L6 50 Z',
    hex:     'M50 3 L90 26 L90 74 L50 97 L10 74 L10 26 Z',
    banner:  'M12 6 H88 V70 L50 96 L12 70 Z'
  };
  const ICONS = {
    star:   'M50 22 L57 42 L78 42 L61 54 L68 74 L50 62 L32 74 L39 54 L22 42 L43 42 Z',
    bolt:   'M56 18 L34 54 H48 L42 82 L68 44 H53 Z',
    crown:  'M24 66 L28 36 L40 50 L50 30 L60 50 L72 36 L76 66 Z M26 70 H74 V78 H26 Z',
    sun:    'M50 34 A16 16 0 1 0 50.1 34 Z M50 16 V26 M50 74 V84 M16 50 H26 M74 50 H84 M26 26 L33 33 M67 67 L74 74 M74 26 L67 33 M33 67 L26 74',
    tower:  'M34 78 V44 H40 V36 H46 V44 H54 V36 H60 V44 H66 V78 Z M44 78 V62 A6 6 0 0 1 56 62 V78',
    anchor: 'M50 24 A6 6 0 1 0 50.1 24 M50 32 V72 M34 46 H66 M30 62 C30 74 40 78 50 78 C60 78 70 74 70 62 M30 62 L24 56 M70 62 L76 56',
    wave:   'M20 44 C30 34 40 34 50 44 C60 54 70 54 80 44 M20 58 C30 48 40 48 50 58 C60 68 70 68 80 58',
    tree:   'M50 20 L72 52 H60 L76 72 H24 L40 52 H28 Z M47 72 H53 V82 H47 Z',
    ball:   'M50 24 A26 26 0 1 0 50.1 24 M50 38 L60 46 L56 58 H44 L40 46 Z M50 24 V38 M60 46 L74 42 M56 58 L64 72 M44 58 L36 72 M40 46 L26 42',
    wolf:   'M26 30 L38 44 H62 L74 30 L78 56 C78 72 64 82 50 84 C36 82 22 72 22 56 Z M38 60 H44 M56 60 H62 M46 72 H54',
    eagle:  'M50 24 L58 38 L84 30 L66 54 L74 74 L50 62 L26 74 L34 54 L16 30 L42 38 Z',
    lion:   'M30 40 C30 28 42 22 50 22 C58 22 70 28 70 40 L74 58 C74 72 62 80 50 80 C38 80 26 72 26 58 Z M40 52 H44 M56 52 H60 M46 66 H54',
    bear:   'M28 34 A8 8 0 1 1 28.1 34 M72 34 A8 8 0 1 1 72.1 34 M30 44 C30 36 40 30 50 30 C60 30 70 36 70 44 V62 C70 74 60 80 50 80 C40 80 30 74 30 62 Z M42 56 H46 M54 56 H58 M46 68 H54'
  };
  const clampi = (v, a, b) => Math.max(a, Math.min(b, v));

  /**
   * crest: {shape, pattern, icon}   colors: [c1, c2, c3]
   */
  function crestSVG(crest, colors, size = 48, extraClass = '') {
    crest = crest || { shape: 'shield', pattern: 'solid', icon: 'star' };
    colors = colors || ['#1456c7', '#ffffff', '#ffd23f'];
    const [c1, c2, c3] = colors;
    const id = gid('cr');
    const path = SHAPES[crest.shape] || SHAPES.shield;
    let pat = '';
    switch (crest.pattern) {
      case 'stripes':  pat = [0, 1, 2, 3, 4].map(i => `<rect x="${8 + i * 17}" y="0" width="8.5" height="100" fill="${c2}"/>`).join(''); break;
      case 'halves':   pat = `<rect x="50" y="0" width="50" height="100" fill="${c2}"/>`; break;
      case 'diagonal': pat = `<polygon points="0,0 100,100 100,60 40,0" fill="${c2}"/><polygon points="0,40 60,100 0,100" fill="${c2}"/>`; break;
      case 'chevron':  pat = `<polygon points="0,56 50,26 100,56 100,76 50,46 0,76" fill="${c2}"/>`; break;
      case 'cross':    pat = `<rect x="42" y="0" width="16" height="100" fill="${c2}"/><rect x="0" y="40" width="100" height="16" fill="${c2}"/>`; break;
      default: pat = '';
    }
    const icon = ICONS[crest.icon] ? `<path d="${ICONS[crest.icon]}" fill="${c3}" stroke="${c3}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill-opacity="${crest.icon === 'sun' || crest.icon === 'wave' || crest.icon === 'anchor' ? 0 : 1}"/>` : '';
    return `<svg class="crest ${extraClass}" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${path}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
      <g clip-path="url(#${id})"><rect width="100" height="100" fill="${c1}"/>${pat}${icon}<rect width="100" height="100" fill="url(#${id}g)"/></g>
      <path d="${path}" fill="none" stroke="${c3 === c1 ? '#fff' : c3}" stroke-width="4" stroke-linejoin="round"/>
      <path d="${path}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/></svg>`;
  }

  /* ---------- Banderas ---------- */
  function flagSVG(flag, w = 36, h = 24) {
    const [pat, a, b, c] = flag;
    let body = '';
    switch (pat) {
      case 'h3': body = `<rect width="36" height="8" fill="${a}"/><rect y="8" width="36" height="8" fill="${b}"/><rect y="16" width="36" height="8" fill="${c}"/>`; break;
      case 'v3': body = `<rect width="12" height="24" fill="${a}"/><rect x="12" width="12" height="24" fill="${b}"/><rect x="24" width="12" height="24" fill="${c}"/>`; break;
      case 'h2': body = `<rect width="36" height="12" fill="${a}"/><rect y="12" width="36" height="12" fill="${b}"/>`; break;
      case 'v2': body = `<rect width="18" height="24" fill="${a}"/><rect x="18" width="18" height="24" fill="${b}"/>`; break;
      case 'cross': body = `<rect width="36" height="24" fill="${a}"/><rect x="10" width="6" height="24" fill="${b}"/><rect y="9" width="36" height="6" fill="${b}"/>`; break;
      case 'diag': body = `<rect width="36" height="24" fill="${a}"/><polygon points="36,0 36,24 0,24" fill="${b}"/><polygon points="0,24 36,0 36,5 5,24" fill="${c}"/>`; break;
      case 'circle': body = `<rect width="36" height="24" fill="${a}"/><circle cx="18" cy="12" r="7" fill="${b}"/>`; break;
      case 'diamond': body = `<rect width="36" height="24" fill="${a}"/><polygon points="18,2 33,12 18,22 3,12" fill="${b}"/><circle cx="18" cy="12" r="4" fill="${c}"/>`; break;
      default: body = `<rect width="36" height="24" fill="${a}"/>`;
    }
    return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g>${body}</g><rect width="36" height="24" fill="none" stroke="#000" stroke-opacity=".35"/></svg>`;
  }

  /* ---------- Camiseta (vista frontal) ---------- */
  function kitSVG(kit, size = 64, num) {
    const { p, a, b, s, k, n } = kit;
    const id = gid('kt');
    const shirt = 'M30 8 L10 20 L2 44 L16 50 L22 36 L22 92 H78 V36 L84 50 L98 44 L90 20 L70 8 C64 14 36 14 30 8 Z';
    let pat = '';
    if (p === 'stripes') pat = [0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 18}" y="0" width="9" height="100" fill="${b}"/>`).join('');
    else if (p === 'hoops') pat = [0, 1, 2, 3, 4].map(i => `<rect x="0" y="${14 + i * 18}" width="100" height="9" fill="${b}"/>`).join('');
    else if (p === 'halves') pat = `<rect x="50" y="0" width="50" height="100" fill="${b}"/>`;
    else if (p === 'sash') pat = `<polygon points="14,10 30,10 90,90 74,90" fill="${b}"/>`;
    return `<svg class="kit" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${shirt}"/></clipPath></defs>
      <g clip-path="url(#${id})"><rect width="100" height="100" fill="${a}"/>${pat}<rect width="100" height="100" fill="url(#none)"/></g>
      <path d="${shirt}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30 8 C36 18 64 18 70 8" fill="none" stroke="${b}" stroke-width="3"/>
      ${num !== undefined ? `<text x="50" y="62" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="28" fill="${n}">${num}</text>` : ''}</svg>`;
  }

  /* ---------- Retrato de jugador (procedural) ---------- */
  const SKIN = ['#f6d5bd', '#eec29e', '#d9a47a', '#b97e55', '#8a5a3a', '#5e3b26'];
  const HAIR = ['#15110e', '#3b2a1f', '#6b4a2f', '#c9a55c', '#a5421f'];
  function faceSVG(player, kit, size = 80) {
    const f = player.face || { skin: 2, hairC: 1, hair: 0, beard: 0, brow: 0, eyes: 0, mouth: 0 };
    const skin = SKIN[clampi(f.skin, 0, 5)], hair = HAIR[clampi(f.hairC, 0, 4)];
    const shirt = (kit && kit.a) || '#355';
    const shirt2 = (kit && kit.b) || '#fff';
    const id = gid('fc');
    const hairShapes = [
      `<path d="M26 40 C26 20 38 14 50 14 C62 14 74 20 74 40 C70 30 60 26 50 26 C40 26 30 30 26 40 Z" fill="${hair}"/>`,                              // corto
      `<path d="M24 46 C20 18 40 8 50 8 C60 8 80 18 76 46 C74 32 64 24 50 24 C36 24 26 32 24 46 Z" fill="${hair}"/>`,                                 // volumen
      `<path d="M28 38 C28 22 38 18 50 18 C62 18 72 22 72 38 C66 30 58 28 50 28 C42 28 34 30 28 38 Z" fill="${hair}"/>`,                              // muy corto
      `<path d="M24 52 C18 20 38 8 50 8 C62 8 82 20 76 52 L72 40 C66 28 34 28 28 40 Z" fill="${hair}"/>`,                                            // largo
      `<path d="M30 36 C32 18 42 14 50 14 C58 14 68 18 70 36 L64 28 L58 34 L50 26 L42 34 L36 28 Z" fill="${hair}"/>`,                                 // pinchos
      `<path d="M30 34 C30 22 40 16 50 16 C60 16 70 22 70 34 C60 26 40 26 30 34 Z" fill="${hair}"/><rect x="44" y="10" width="12" height="10" rx="5" fill="${hair}"/>`, // moño
      `<path d="M26 42 C26 22 38 16 50 16 C62 16 74 22 74 42 L70 38 C62 30 38 30 30 38 Z" fill="${hair}" opacity=".95"/>`,                            // entradas
      ''                                                                                                                                               // rapado
    ];
    const beard = f.beard === 1 ? `<path d="M30 58 C32 76 68 76 70 58 C64 68 36 68 30 58 Z" fill="${hair}" opacity=".55"/>`
      : f.beard === 2 ? `<path d="M30 54 C28 78 72 78 70 54 C64 70 36 70 30 54 Z" fill="${hair}" opacity=".85"/><path d="M42 66 C46 62 54 62 58 66 C54 64 46 64 42 66 Z" fill="${hair}"/>`
      : f.beard === 3 ? `<path d="M42 64 C46 61 54 61 58 64 L56 66 C52 64 48 64 44 66 Z" fill="${hair}"/>` : '';
    const brows = f.brow === 1 ? 'M36 40 L46 38 M54 38 L64 40' : f.brow === 2 ? 'M36 38 L46 40 M54 40 L64 38' : 'M36 39 L46 39 M54 39 L64 39';
    const mouth = f.mouth === 1 ? 'M44 64 Q50 69 56 64' : f.mouth === 2 ? 'M45 65 H55' : 'M44 65 Q50 67 56 65';
    return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><clipPath id="${id}"><rect width="100" height="100" rx="14"/></clipPath></defs>
      <g clip-path="url(#${id})">
        <path d="M6 100 C8 78 28 74 50 74 C72 74 92 78 94 100 Z" fill="${shirt}"/>
        <path d="M38 76 L50 90 L62 76" fill="none" stroke="${shirt2}" stroke-width="5" stroke-linejoin="round"/>
        <rect x="42" y="62" width="16" height="16" fill="${skin}"/>
        <ellipse cx="50" cy="46" rx="22" ry="27" fill="${skin}"/>
        <ellipse cx="27" cy="48" rx="4" ry="7" fill="${skin}"/><ellipse cx="73" cy="48" rx="4" ry="7" fill="${skin}"/>
        ${hairShapes[clampi(f.hair, 0, 7)]}
        <path d="${brows}" stroke="${hair}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <ellipse cx="41" cy="46" rx="3" ry="${f.eyes === 1 ? 1.6 : 2.6}" fill="#1b1b1b"/><ellipse cx="59" cy="46" rx="3" ry="${f.eyes === 1 ? 1.6 : 2.6}" fill="#1b1b1b"/>
        <path d="M50 48 L47 58 H53" stroke="#000" stroke-opacity=".25" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="${mouth}" stroke="#7a2e2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        ${beard}
      </g></svg>`;
  }

  /* ---------- Trofeo (copa) ---------- */
  function trophySVG(color = '#ffd23f', size = 56) {
    return `<svg class="trophy" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M28 10 H72 V38 C72 54 62 62 50 62 C38 62 28 54 28 38 Z" fill="${color}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
      <path d="M28 16 H14 C14 36 20 42 30 44 M72 16 H86 C86 36 80 42 70 44" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
      <rect x="44" y="62" width="12" height="16" fill="${color}"/><path d="M30 90 L34 76 H66 L70 90 Z" fill="${color}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
      <path d="M36 14 V36 C36 46 42 52 48 54" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  }

  G.Art = { crestSVG, flagSVG, kitSVG, faceSVG, trophySVG, SHAPES, ICONS, SKIN, HAIR, crestShapes: Object.keys(SHAPES), crestPatterns: ['solid', 'stripes', 'halves', 'diagonal', 'chevron', 'cross'], crestIcons: Object.keys(ICONS),
    crestPatterns: ['solid', 'stripes', 'halves', 'diagonal', 'chevron', 'cross'] };
})(typeof window !== 'undefined' ? window : globalThis);
