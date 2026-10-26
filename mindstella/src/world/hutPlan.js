/**
 * Bauplan der Hütte aus Kapitel 1.
 *
 * Reine Daten ohne Three.js-Abhängigkeit, damit Spielstand und Tests die
 * Elementzahl kennen. Maße in Metern. Ursprung: Mitte der Grundfläche auf
 * Geländehöhe; +z zeigt zur Eingangsseite, +y nach oben.
 *
 * Konstruktion: Ständerbau auf Punktfundamenten. Die Holzunterkante liegt
 * 30 cm über dem Gelände (Spritzwasserschutz). Die Ausfachung sitzt zwischen
 * den Pfosten, die Kopfbänder bleiben an der Außenseite sichtbar.
 */

export const PHASES = [
  { id: 'unterbau', label: 'Unterbau', short: 'Fundamente und Schwellen' },
  { id: 'boden', label: 'Boden', short: 'Dielen auf den Balken' },
  { id: 'tragwerk', label: 'Tragwerk', short: 'Pfosten und Rähm' },
  { id: 'aussteifung', label: 'Aussteifung', short: 'Diagonale Kopfbänder' },
  { id: 'waende', label: 'Wände', short: 'Ausfachung und Giebel' },
  { id: 'dach', label: 'Dach', short: 'First, Sparren, Deckung' },
  { id: 'witterungsschutz', label: 'Witterungsschutz', short: 'Tür, Laden, Rinnen' },
];

const W = 3.0; // Außenbreite (x)
const D = 2.4; // Außentiefe (z)
const HX = 1.44; // Achse der Eckpfosten
const HZ = 1.14;
const SILL_TOP = 0.44;
const FLOOR_TOP = SILL_TOP + 0.035;
const POST_H = 2.0;
const PLATE_Y = FLOOR_TOP + POST_H + 0.06;
const PLATE_TOP = PLATE_Y + 0.06;
const RIDGE_Y = 3.38;
const EAVE_Z = 1.6; // Dachüberstand bis hier
const DOOR_HALF = 0.42;

export const HUT_DIMENSIONS = { W, D, HX, HZ, FLOOR_TOP, PLATE_TOP, RIDGE_Y, EAVE_Z, DOOR_HALF };

/** Neigung der Dachfläche (Höhe pro Meter) */
const ROOF_SLOPE = (RIDGE_Y - PLATE_TOP) / HZ;
const ROOF_ANGLE = Math.atan(ROOF_SLOPE);

/** y der Dachfläche (Oberkante Sparren) über Position |z| */
export function roofHeightAt(absZ) {
  return RIDGE_Y - absZ * ROOF_SLOPE;
}

const els = [];
function add(phase, label, kind, size, pos, rot = [0, 0, 0], extra = {}) {
  els.push({ id: `e${String(els.length + 1).padStart(2, '0')}`, phase, label, kind, size, pos, rot, ...extra });
}

/* Unterbau: sechs Punktfundamente, dann Schwellen und Bodenbalken */
for (const z of [-HZ, HZ]) {
  for (const x of [-HX, 0, HX]) {
    add('unterbau', 'Punktfundament', 'stone', [0.34, 0.48, 0.34], [x, 0.06, z]);
  }
}
add('unterbau', 'Schwelle hinten', 'beam', [W + 0.1, 0.14, 0.16], [0, 0.37, -HZ]);
add('unterbau', 'Schwelle vorn', 'beam', [W + 0.1, 0.14, 0.16], [0, 0.37, HZ]);
for (const x of [-HX, 0, HX]) {
  add('unterbau', 'Bodenbalken', 'beam', [0.12, 0.12, D - 0.3], [x, 0.36, 0]);
}

/* Boden: zehn Dielen */
const BOARD_W = W / 10;
for (let i = 0; i < 10; i++) {
  const x = -W / 2 + BOARD_W * (i + 0.5);
  add('boden', 'Diele', 'plank', [BOARD_W - 0.012, 0.035, D], [x, SILL_TOP + 0.0175, 0]);
}

/* Tragwerk: Eck- und Türpfosten, dann Rähm */
const postY = FLOOR_TOP + POST_H / 2;
for (const [x, z] of [[-HX, HZ], [HX, HZ], [HX, -HZ], [-HX, -HZ]]) {
  add('tragwerk', 'Eckpfosten', 'post', [0.13, POST_H, 0.13], [x, postY, z]);
}
add('tragwerk', 'Türpfosten', 'post', [0.11, POST_H, 0.12], [-DOOR_HALF, postY, HZ]);
add('tragwerk', 'Türpfosten', 'post', [0.11, POST_H, 0.12], [DOOR_HALF, postY, HZ]);
add('tragwerk', 'Rähm vorn', 'beam', [W + 0.04, 0.13, 0.14], [0, PLATE_Y, HZ]);
add('tragwerk', 'Rähm hinten', 'beam', [W + 0.04, 0.13, 0.14], [0, PLATE_Y, -HZ]);
add('tragwerk', 'Rähm links', 'beam', [0.14, 0.13, D - 0.1], [-HX, PLATE_Y, 0]);
add('tragwerk', 'Rähm rechts', 'beam', [0.14, 0.13, D - 0.1], [HX, PLATE_Y, 0]);

/* Aussteifung: diagonale Kopfbänder an der Außenseite */
const braceLen = 0.95;
const braceY = PLATE_Y - 0.4;
add('aussteifung', 'Kopfband vorn links', 'brace', [braceLen, 0.08, 0.06], [-HX + 0.34, braceY, HZ + 0.08], [0, 0, Math.PI / 4]);
add('aussteifung', 'Kopfband vorn rechts', 'brace', [braceLen, 0.08, 0.06], [HX - 0.34, braceY, HZ + 0.08], [0, 0, -Math.PI / 4]);
add('aussteifung', 'Kopfband links', 'brace', [0.06, 0.08, braceLen], [-HX - 0.08, braceY, -HZ + 0.34], [-Math.PI / 4, 0, 0]);
add('aussteifung', 'Kopfband rechts', 'brace', [0.06, 0.08, braceLen], [HX + 0.08, braceY, -HZ + 0.34], [-Math.PI / 4, 0, 0]);

/* Wände: Ausfachung aus senkrechten Brettern zwischen den Pfosten */
const wallBottom = FLOOR_TOP;
const wallH = PLATE_Y - 0.065 - wallBottom;
const half = wallH / 2;
function panel(label, x0, x1, y0, y1, z, axis = 'x', extra = {}) {
  const w = x1 - x0;
  const h = y1 - y0;
  const size = axis === 'x' ? [w, h, 0.05] : [0.05, h, w];
  const pos = axis === 'x' ? [(x0 + x1) / 2, (y0 + y1) / 2, z] : [z, (y0 + y1) / 2, (x0 + x1) / 2];
  add('waende', label, 'panel', size, pos, [0, 0, 0], { axis, ...extra });
}
const inner = HX - 0.065;
// Vorderwand neben der Tür, jeweils unten und oben
panel('Ausfachung vorn links', -inner, -DOOR_HALF - 0.055, wallBottom, wallBottom + half, HZ);
panel('Ausfachung vorn rechts', DOOR_HALF + 0.055, inner, wallBottom, wallBottom + half, HZ);
panel('Ausfachung vorn links', -inner, -DOOR_HALF - 0.055, wallBottom + half, wallBottom + wallH, HZ);
panel('Ausfachung vorn rechts', DOOR_HALF + 0.055, inner, wallBottom + half, wallBottom + wallH, HZ);
// Rückwand in vier Feldern
const backW = (2 * inner) / 4;
for (let i = 0; i < 4; i++) {
  panel('Ausfachung Rückwand', -inner + backW * i, -inner + backW * (i + 1), wallBottom, wallBottom + wallH, -HZ);
}
// linke Seite
const innerZ = HZ - 0.065;
panel('Ausfachung links', -innerZ, 0, wallBottom, wallBottom + wallH, -HX, 'z');
panel('Ausfachung links', 0, innerZ, wallBottom, wallBottom + wallH, -HX, 'z');
// rechte Seite mit Fensteröffnung im vorderen Feld
const winBottom = wallBottom + 0.95;
const winTop = wallBottom + 1.6;
panel('Ausfachung rechts', -innerZ, 0, wallBottom, wallBottom + wallH, HX, 'z');
panel('Brüstung rechts', 0, innerZ, wallBottom, winBottom, HX, 'z');
panel('Sturz rechts', 0, innerZ, winTop, wallBottom + wallH, HX, 'z', { windowBelow: true });
// Giebeldreiecke
add('waende', 'Giebelfeld links', 'gable', [0.05, RIDGE_Y - PLATE_TOP, 2 * HZ], [-HX, PLATE_TOP, 0], [0, 0, 0]);
add('waende', 'Giebelfeld rechts', 'gable', [0.05, RIDGE_Y - PLATE_TOP, 2 * HZ], [HX, PLATE_TOP, 0], [0, 0, 0]);

/* Dach: Giebelstützen, First, Sparren, Deckung */
add('dach', 'Giebelstütze', 'post', [0.1, RIDGE_Y - PLATE_TOP - 0.1, 0.1], [-HX, (PLATE_TOP + RIDGE_Y - 0.1) / 2, 0]);
add('dach', 'Giebelstütze', 'post', [0.1, RIDGE_Y - PLATE_TOP - 0.1, 0.1], [HX, (PLATE_TOP + RIDGE_Y - 0.1) / 2, 0]);
add('dach', 'Firstpfette', 'beam', [W + 0.7, 0.14, 0.14], [0, RIDGE_Y - 0.1, 0]);
const rafterLen = EAVE_Z / Math.cos(ROOF_ANGLE);
for (const x of [-HX, 0, HX]) {
  for (const side of [1, -1]) {
    const zc = (side * EAVE_Z) / 2;
    const yc = roofHeightAt(EAVE_Z / 2) - 0.06;
    add('dach', 'Sparren', 'rafter', [0.08, 0.12, rafterLen], [x, yc, zc], [side * ROOF_ANGLE, 0, 0]);
  }
}
const roofLenX = W + 0.7;
const roofSeg = roofLenX / 3;
for (const side of [1, -1]) {
  for (let i = 0; i < 3; i++) {
    const x = -roofLenX / 2 + roofSeg * (i + 0.5);
    add('dach', 'Dachdeckung', 'roof', [roofSeg + 0.005, 0.06, rafterLen + 0.06], [x, roofHeightAt(EAVE_Z / 2) + 0.03, (side * EAVE_Z) / 2], [side * ROOF_ANGLE, 0, 0], { side });
  }
}

/* Witterungsschutz */
for (const x of [-(W / 2 + 0.35), W / 2 + 0.35]) {
  for (const side of [1, -1]) {
    add('witterungsschutz', 'Windbrett', 'trim', [0.03, 0.16, rafterLen + 0.04], [x, roofHeightAt(EAVE_Z / 2) + 0.02, (side * EAVE_Z) / 2], [side * ROOF_ANGLE, 0, 0]);
  }
}
add('witterungsschutz', 'Regenrinne vorn', 'gutter', [roofLenX, 0.09, 0.1], [0, roofHeightAt(EAVE_Z) - 0.06, EAVE_Z + 0.03]);
add('witterungsschutz', 'Regenrinne hinten', 'gutter', [roofLenX, 0.09, 0.1], [0, roofHeightAt(EAVE_Z) - 0.06, -EAVE_Z - 0.03]);
// geöffneter Laden, flach neben der Fensteröffnung
add('witterungsschutz', 'Fensterladen', 'shutter', [0.04, winTop - winBottom, innerZ - 0.06], [HX + 0.06, (winBottom + winTop) / 2, -(innerZ - 0.06) / 2 - 0.02]);
add('witterungsschutz', 'Tür', 'door', [2 * DOOR_HALF - 0.12, wallH - 0.02, 0.05], [0, wallBottom + (wallH - 0.02) / 2, HZ]);
add('witterungsschutz', 'Trittstein', 'stone', [0.9, 0.24, 0.42], [0, 0.04, HZ + 0.5]);

export const HUT_ELEMENTS = Object.freeze(els);
export const HUT_ELEMENT_COUNT = els.length;
export const WINDOW = { bottom: winBottom, top: winTop, zMin: 0, zMax: innerZ };

/** Phasen, von denen mindestens ein Element gebaut ist */
export function reachedPhases(elementsBuilt) {
  const ids = new Set();
  for (let i = 0; i < Math.min(elementsBuilt, els.length); i++) ids.add(els[i].phase);
  return PHASES.filter((p) => ids.has(p.id)).map((p) => p.id);
}

/** Phase des zuletzt gebauten Elements */
export function phaseOfElement(index) {
  return els[Math.max(0, Math.min(els.length - 1, index))].phase;
}
