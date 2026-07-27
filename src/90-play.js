/* ============================================================
   Play state: hit points, expendable resources, rests, casting
   ============================================================ */

/* ---------------- state ---------------- */
function playInit(c) {
  if (!c.play || typeof c.play !== 'object') c.play = {};
  const p = c.play;
  if (!p.used || typeof p.used !== 'object') p.used = {};
  if (typeof p.temp !== 'number') p.temp = 0;
  if (p.hp === undefined) p.hp = null;      // null means "full"
  return p;
}
function maxHp(c) { return derive(c).hp; }
function curHp(c) {
  const p = playInit(c);
  return p.hp === null ? maxHp(c) : clamp(p.hp, 0, maxHp(c));
}
function setHp(c, v) {
  const p = playInit(c);
  p.hp = clamp(Math.round(v), 0, maxHp(c));
  return p.hp;
}
/* Damage hits temporary hit points first, as in every edition here. */
function applyDamage(c, n) {
  const p = playInit(c);
  let dmg = Math.max(0, Math.round(n));
  if (p.temp > 0) {
    const soaked = Math.min(p.temp, dmg);
    p.temp -= soaked;
    dmg -= soaked;
  }
  setHp(c, curHp(c) - dmg);
  return curHp(c);
}
function applyHeal(c, n) { return setHp(c, curHp(c) + Math.max(0, Math.round(n))); }

function used(c, id) { return playInit(c).used[id] || 0; }
function setUsed(c, id, n, max) { playInit(c).used[id] = clamp(Math.round(n), 0, max); }

/* ---------------- limited-use class features ---------------- */
/* max is a function of (level, finalScores, derived) */
const USES_5E_CLASS = {
  barbarian: [{ id: 'rage', name: 'Rage', reset: 'long', max: l => l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2, note: l => l >= 20 ? 'unlimited at 20th; tracked as 6' : '' }],
  bard: [{ id: 'bardic', name: 'Bardic Inspiration', reset: l => l >= 5 ? 'short' : 'long', max: (l, s) => Math.max(1, mod(s.cha)) }],
  cleric: [
    { id: 'channel', name: 'Channel Divinity', reset: 'short', max: l => l >= 18 ? 3 : l >= 6 ? 2 : 1 },
    { id: 'intervention', name: 'Divine Intervention', reset: 'long', max: l => l >= 10 ? 1 : 0 }],
  druid: [{ id: 'wildshape', name: 'Wild Shape', reset: 'short', max: l => l >= 2 ? 2 : 0 }],
  fighter: [
    { id: 'secondwind', name: 'Second Wind', reset: 'short', max: () => 1 },
    { id: 'actionsurge', name: 'Action Surge', reset: 'short', max: l => l >= 17 ? 2 : l >= 2 ? 1 : 0 },
    { id: 'indomitable', name: 'Indomitable', reset: 'long', max: l => l >= 17 ? 3 : l >= 13 ? 2 : l >= 9 ? 1 : 0 }],
  monk: [{ id: 'ki', name: 'Ki points', reset: 'short', max: l => l >= 2 ? l : 0 }],
  paladin: [
    { id: 'loh', name: 'Lay on Hands (HP pool)', reset: 'long', max: l => l * 5, pool: true },
    { id: 'channel', name: 'Channel Divinity', reset: 'short', max: l => l >= 3 ? 1 : 0 },
    { id: 'divinesense', name: 'Divine Sense', reset: 'long', max: (l, s) => 1 + mod(s.cha) }],
  sorcerer: [{ id: 'sorcery', name: 'Sorcery points', reset: 'long', max: l => l >= 2 ? l : 0, pool: true }],
  warlock: [
    { id: 'arcanum6', name: 'Mystic Arcanum (6th)', reset: 'long', max: l => l >= 11 ? 1 : 0 },
    { id: 'arcanum7', name: 'Mystic Arcanum (7th)', reset: 'long', max: l => l >= 13 ? 1 : 0 },
    { id: 'arcanum8', name: 'Mystic Arcanum (8th)', reset: 'long', max: l => l >= 15 ? 1 : 0 },
    { id: 'arcanum9', name: 'Mystic Arcanum (9th)', reset: 'long', max: l => l >= 17 ? 1 : 0 }],
  wizard: [{ id: 'recovery', name: 'Arcane Recovery', reset: 'long', max: () => 1 }],
  ranger: [], rogue: []
};
const USES_5E_RACE = {
  dragonborn: [{ id: 'breath', name: 'Breath Weapon', reset: 'short', max: () => 1 }],
  halforc: [{ id: 'relentless', name: 'Relentless Endurance', reset: 'long', max: () => 1 }],
  tiefling: [
    { id: 'rebuke', name: 'Hellish Rebuke', reset: 'long', max: l => l >= 3 ? 1 : 0 },
    { id: 'tdarkness', name: 'Darkness', reset: 'long', max: l => l >= 5 ? 1 : 0 }],
  gnome: [], dwarf: [], elf: [], halfling: [], human: [], halfelf: []
};
const USES_5E_SUBRACE = {
  drow: [
    { id: 'faeriefire', name: 'Faerie Fire', reset: 'long', max: l => l >= 3 ? 1 : 0 },
    { id: 'ddarkness', name: 'Darkness', reset: 'long', max: l => l >= 5 ? 1 : 0 }],
  forest: [], rock: [], hill: [], mountain: [], high: [], wood: [], lightfoot: [], stout: [], standard: [], variant: []
};

const USES_PF1_CLASS = {
  barbarian: [{ id: 'rage', name: 'Rage (rounds/day)', reset: 'day', max: (l, s) => 4 + mod(s.con) + (l - 1) * 2, pool: true }],
  bard: [{ id: 'perform', name: 'Bardic Performance (rounds/day)', reset: 'day', max: (l, s) => 4 + mod(s.cha) + (l - 1) * 2, pool: true }],
  cleric: [{ id: 'channel', name: 'Channel Energy', reset: 'day', max: (l, s) => 3 + mod(s.cha) }],
  paladin: [
    { id: 'smite', name: 'Smite Evil', reset: 'day', max: l => 1 + Math.floor((l - 1) / 3) },
    { id: 'loh', name: 'Lay on Hands', reset: 'day', max: (l, s) => Math.max(0, Math.floor(l / 2) + mod(s.cha)) }],
  monk: [{ id: 'ki', name: 'Ki pool', reset: 'day', max: (l, s) => l >= 4 ? Math.floor(l / 2) + mod(s.wis) : 0, pool: true }],
  druid: [{ id: 'wildshape', name: 'Wild Shape', reset: 'day', max: l => l >= 4 ? Math.min(6, Math.floor((l - 4) / 2) + 1) : 0 }],
  fighter: [], ranger: [], rogue: [], sorcerer: [], wizard: [{ id: 'bond', name: 'Bonded item / school power', reset: 'day', max: () => 1 }]
};

const USES_4E_CLASS = {
  fighter: [], cleric: [], paladin: [{ id: 'loh', name: 'Lay on Hands', reset: 'daily', max: (l, s) => Math.max(1, mod(s.wis)) }],
  ranger: [], rogue: [], warlock: [], warlord: [], wizard: []
};

/* ---------------- the resource list ---------------- */
function resourcesFor(c, d) {
  d = d || derive(c);
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const lin = byId(S.lineages, c.lineageId);
  const L = c.level, s = c.finalScores;
  const out = [];
  const push = (group, def) => {
    const max = typeof def.max === 'function' ? def.max(L, s, d) : def.max;
    if (!(max > 0)) return;
    out.push({
      id: def.id, group: group, name: def.name, max: max,
      reset: typeof def.reset === 'function' ? def.reset(L) : def.reset,
      pool: !!def.pool,
      note: typeof def.note === 'function' ? def.note(L) : (def.note || '')
    });
  };

  /* --- casting resources --- */
  const lim = spellLimits(c, d);
  if (lim) {
    if (c.systemId === '5e') {
      if (lim.pact) push('Spell slots', { id: 'pact', name: 'Pact slots (level ' + lim.pact.level + ')', max: lim.pact.count, reset: 'short' });
      (lim.slots || []).forEach((n, i) => push('Spell slots', { id: 'slot' + (i + 1), name: ordinalLevel(i + 1) + ' level', max: n, reset: 'long' }));
    } else if (c.systemId === 'pf2') {
      Object.keys(lim.slots || {}).forEach(r => push('Spell slots', { id: 'slot' + r, name: 'Rank ' + r, max: lim.slots[r], reset: 'long' }));
      const focusMax = clamp((c.spells || []).filter(u => { const sp = spellByUid('pf2', u); return sp && sp.focus; }).length, 0, 3);
      if (focusMax) push('Focus', { id: 'focus', name: 'Focus points', max: focusMax, reset: 'refocus', note: 'Refocus for 10 minutes to regain one.' });
    } else if (c.systemId === 'pf1' && lim.perDay) {
      lim.perDay.forEach((n, i) => { if (i > 0) push('Spells per day', { id: 'slot' + i, name: ordinalLevel(i) + ' level', max: n, reset: 'day' }); });
    }
  }

  /* --- recovery --- */
  if (c.systemId === '5e' && cls) {
    push('Recovery', { id: 'hitdice', name: 'Hit dice (d' + cls.hitDie + ')', max: L, reset: 'longHalf', note: 'Spend on a short rest to heal.' });
  }
  if (c.systemId === '4e') {
    push('Recovery', { id: 'surges', name: 'Healing surges', max: d.surges, reset: 'daily', note: 'Each restores ' + d.surgeValue + ' HP.' });
    push('Class', { id: 'secondwind', name: 'Second Wind', max: 1, reset: 'encounter' });
    push('Class', { id: 'actionpoint', name: 'Action points', max: 1, reset: 'daily' });
  }

  /* --- class and racial uses --- */
  const table = c.systemId === '5e' ? USES_5E_CLASS : c.systemId === 'pf1' ? USES_PF1_CLASS : c.systemId === '4e' ? USES_4E_CLASS : null;
  if (table && cls) (table[cls.id] || []).forEach(def => push('Class', def));
  if (c.systemId === '5e' && lin) {
    (USES_5E_RACE[lin.id] || []).forEach(def => push(S.lineageLabel, def));
    (USES_5E_SUBRACE[c.lineageSubId] || []).forEach(def => push(S.lineageLabel, def));
  }
  return out;
}
function ordinalLevel(n) {
  return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
}
function resourceById(c, id, d) { return resourcesFor(c, d).find(r => r.id === id) || null; }

/* ---------------- rests ---------------- */
const RESTS = {
  '5e': [
    { kind: 'short', label: 'Short rest', hint: 'an hour — restores short-rest features and pact slots' },
    { kind: 'long', label: 'Long rest', hint: 'eight hours — full hit points, all slots and features' }
  ],
  '5.5e': [
    { kind: 'short', label: 'Short rest', hint: 'an hour — restores short-rest features and pact slots' },
    { kind: 'long', label: 'Long rest', hint: 'eight hours — full hit points, all slots and features' }
  ],
  '4e': [
    { kind: 'short', label: 'Short rest', hint: '5 minutes — encounter powers and second wind' },
    { kind: 'extended', label: 'Extended rest', hint: '6 hours — daily powers, surges, full hit points' }
  ],
  pf1: [{ kind: 'day', label: 'Rest 8 hours', hint: 'restores spells per day and daily abilities' }],
  pf2: [
    { kind: 'refocus', label: 'Refocus', hint: '10 minutes — regain one Focus Point' },
    { kind: 'long', label: 'Long rest', hint: 'a full night — all slots, focus, and hit point recovery' }
  ]
};

function doRest(c, kind) {
  const d = derive(c);
  const p = playInit(c);
  const res = resourcesFor(c, d);
  const restored = [];
  const clearAll = ids => ids.forEach(r => { if (p.used[r.id]) { restored.push(r.name); delete p.used[r.id]; } });

  if (kind === 'refocus') {
    const f = res.find(r => r.id === 'focus');
    if (f && used(c, 'focus') > 0) { setUsed(c, 'focus', used(c, 'focus') - 1, f.max); restored.push('1 Focus Point'); }
    return { restored: restored, healed: 0, note: 'Refocused.' };
  }

  let healed = 0;
  if (kind === 'short') {
    clearAll(res.filter(r => r.reset === 'short' || r.reset === 'encounter'));
    return { restored: restored, healed: 0, note: 'Short rest taken. Spend hit dice below to heal.' };
  }
  // everything else is a full rest of some sort
  clearAll(res.filter(r => ['short', 'long', 'day', 'daily', 'encounter', 'refocus'].includes(r.reset)));
  // hit dice come back at half rate in 5e
  res.filter(r => r.reset === 'longHalf').forEach(r => {
    const back = Math.max(1, Math.floor(r.max / 2));
    const before = used(c, r.id);
    if (before > 0) {
      setUsed(c, r.id, Math.max(0, before - back), r.max);
      restored.push(Math.min(before, back) + ' hit dice');
    }
  });

  const before = curHp(c);
  if (c.systemId === 'pf1') {
    healed = applyHeal(c, c.level) - before;          // a night's rest restores HP equal to your level
  } else if (c.systemId === 'pf2') {
    const perLevel = Math.max(1, mod(c.finalScores.con));
    healed = applyHeal(c, perLevel * c.level) - before;
  } else {
    healed = setHp(c, maxHp(c)) - before;             // 5e and 4e come back to full
  }
  p.temp = 0;
  return { restored: restored, healed: healed, note: null };
}

/* ---------------- casting ---------------- */
/* Which resource does this spell draw on, and is any of it left? */
function castCost(c, sp) {
  const d = derive(c);
  const lim = spellLimits(c, d);
  const lv = spellLevelFor(c, sp);
  if (sp.cantrip || lv === 0) return { free: true, label: 'Cantrip — cast at will' };
  if (c.systemId === 'pf2' && sp.focus) {
    const fp = resourceById(c, 'focus', d);
    if (fp && used(c, 'focus') < fp.max) return { id: 'focus', label: 'Focus Point' };
    return { none: true, label: 'No Focus Points left' };
  }
  if (!lim) return { free: true, label: 'No casting resource tracked' };

  if (c.systemId === '5e') {
    if (lim.pact) {
      if (lv > lim.pact.level) return { none: true, label: 'Above your pact slot level' };
      return { id: 'pact', label: 'Pact slot' };
    }
    for (let r = lv; r <= (lim.slots || []).length; r++) {
      const res = resourceById(c, 'slot' + r, d);
      if (res && used(c, 'slot' + r) < res.max) return { id: 'slot' + r, label: ordinalLevel(r) + '-level slot' };
    }
    return { none: true, label: 'No slot of ' + ordinalLevel(lv) + ' level or higher left' };
  }
  if (c.systemId === 'pf2') {
    const maxRank = lim.maxRank || 0;
    for (let r = lv; r <= maxRank; r++) {
      const res = resourceById(c, 'slot' + r, d);
      if (res && used(c, 'slot' + r) < res.max) return { id: 'slot' + r, label: 'rank ' + r + ' slot' };
    }
    return { none: true, label: 'No rank ' + lv + ' slot or higher left' };
  }
  if (c.systemId === 'pf1') {
    const res = resourceById(c, 'slot' + lv, d);
    if (res && used(c, 'slot' + lv) < res.max) return { id: 'slot' + lv, label: ordinalLevel(lv) + '-level slot' };
    return { none: true, label: 'No ' + ordinalLevel(lv) + '-level slots left today' };
  }
  return { free: true, label: '' };
}

function castSpell(c, sp) {
  const cost = castCost(c, sp);
  if (cost.free) return { ok: true, message: sp.name + ' cast. ' + cost.label + '.' };
  if (cost.none) return { ok: false, message: 'Cannot cast ' + sp.name + ': ' + cost.label.toLowerCase() + '.' };
  const d = derive(c);
  const res = resourceById(c, cost.id, d);
  if (!res) return { ok: false, message: 'No resource to spend for ' + sp.name + '.' };
  setUsed(c, cost.id, used(c, cost.id) + 1, res.max);
  const left = res.max - used(c, cost.id);
  return {
    ok: true,
    message: sp.name + ' cast using a ' + cost.label + ' — ' + left + ' of ' + res.max + ' left' +
      (left === 0 ? ', back after a ' + restWord(res.reset) + '.' : '.')
  };
}
function restWord(reset) {
  return reset === 'short' ? 'short rest' : reset === 'refocus' ? 'Refocus'
    : reset === 'day' ? "night's rest" : reset === 'encounter' ? 'short rest'
      : reset === 'daily' ? 'extended rest' : 'long rest';
}

/* Spend one hit die (5e short-rest healing). */
function spendHitDie(c) {
  const d = derive(c);
  const res = resourceById(c, 'hitdice', d);
  if (!res) return { ok: false, message: 'No hit dice to spend.' };
  if (used(c, 'hitdice') >= res.max) return { ok: false, message: 'No hit dice left — they come back on a long rest.' };
  const cls = byId(sys(c.systemId).classes, c.classId);
  const die = cls ? cls.hitDie : 8;
  const roll = d1(die) + mod(c.finalScores.con);
  setUsed(c, 'hitdice', used(c, 'hitdice') + 1, res.max);
  const before = curHp(c);
  const after = applyHeal(c, Math.max(0, roll));
  return { ok: true, message: 'Spent a hit die: rolled d' + die + ' + Con for ' + Math.max(0, roll) + ' HP (' + before + ' → ' + after + ').' };
}
function d1(n) { return d(n); }

/* Spend a 4e healing surge. */
function spendSurge(c) {
  const d0 = derive(c);
  const res = resourceById(c, 'surges', d0);
  if (!res) return { ok: false, message: 'No healing surges.' };
  if (used(c, 'surges') >= res.max) return { ok: false, message: 'No healing surges left until an extended rest.' };
  setUsed(c, 'surges', used(c, 'surges') + 1, res.max);
  const before = curHp(c);
  const after = applyHeal(c, d0.surgeValue);
  return { ok: true, message: 'Spent a healing surge for ' + d0.surgeValue + ' HP (' + before + ' → ' + after + ').' };
}
