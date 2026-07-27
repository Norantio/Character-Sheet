/* ============================================================
   Character Forge — core helpers shared by all game systems
   ============================================================ */
'use strict';

const ABIL6 = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABIL_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
};

/* --- dice ------------------------------------------------- */
function d(sides) { return 1 + Math.floor(Math.random() * sides); }
function rollN(n, sides) { const a = []; for (let i = 0; i < n; i++) a.push(d(sides)); return a; }
function sum(a) { return a.reduce((x, y) => x + y, 0); }
function roll4d6dropLowest() {
  const r = rollN(4, 6).sort((a, b) => b - a);
  return { total: sum(r.slice(0, 3)), dice: r, dropped: r[3] };
}
function roll3d6() { const r = rollN(3, 6); return { total: sum(r), dice: r, dropped: null }; }
function roll2d6plus6() { const r = rollN(2, 6); return { total: sum(r) + 6, dice: r, dropped: null }; }

/* --- generic math ----------------------------------------- */
function mod(score) { return Math.floor((score - 10) / 2); }
function signed(n) { return (n >= 0 ? '+' : '−') + Math.abs(n); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function byId(list, id) { return (list || []).find(x => x.id === id) || null; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
// JSON round-tripping can turn small integer-keyed arrays into objects; normalise them.
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.keys(v).sort((a, b) => a - b).map(k => v[k]);
  return [];
}

/* --- point-buy cost tables -------------------------------- */
const PB_5E = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PB_PF1 = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 };

function pointBuySpend(scores, table) {
  return ABIL6.reduce((t, a) => t + (table[scores[a]] !== undefined ? table[scores[a]] : 0), 0);
}

/* --- progression helpers ---------------------------------- */
function profBonus5e(level) { return 2 + Math.floor((level - 1) / 4); }

const BAB = {
  full: l => l,
  threeQuarter: l => Math.floor(l * 3 / 4),
  half: l => Math.floor(l / 2)
};
const SAVE_PF1 = {
  good: l => 2 + Math.floor(l / 2),
  poor: l => Math.floor(l / 3)
};

/* --- 5e spell slot tables --------------------------------- */
const SLOTS_FULL = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];
const SLOTS_HALF = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3],
  [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]
];
const SLOTS_THIRD = [
  [], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]
];
function slotsFor(kind, level) {
  const t = kind === 'full' ? SLOTS_FULL : kind === 'half' ? SLOTS_HALF : kind === 'third' ? SLOTS_THIRD : null;
  if (!t) return [];
  return t[clamp(level, 1, 20) - 1] || [];
}
function pactSlots(level) {
  const n = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
  const lv = level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
  const inv = level >= 18 ? 8 : level >= 15 ? 7 : level >= 12 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 0;
  return { count: n, level: lv, invocations: inv };
}

/* --- 5e ASI levels ---------------------------------------- */
const ASI_5E = [4, 8, 12, 16, 19];
const ASI_5E_FIGHTER = [4, 6, 8, 12, 14, 16, 19];
const ASI_5E_ROGUE = [4, 8, 10, 12, 16, 19];

function carryCapacity5e(str, size) {
  const mult = (size === 'Small' || size === 'Tiny') ? 0.5 : size === 'Large' ? 2 : 1;
  return { carry: Math.round(str * 15 * mult), push: Math.round(str * 30 * mult) };
}
