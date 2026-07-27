/* ============================================================
   Spellbook: catalogue access, casting limits, filters, importer
   ============================================================ */

/* ---------------- catalogue ---------------- */
const SPELL_IMPORT_KEY = 'characterForge.spells.v1';
const _spellCache = {};
let _importedSpells = null;

function loadImportedSpells() {
  if (_importedSpells) return _importedSpells;
  _importedSpells = { '5e': [], '5.5e': [], '4e': [], pf1: [], pf2: [] };
  if (!storageOK) return _importedSpells;
  try {
    const raw = localStorage.getItem(SPELL_IMPORT_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      Object.keys(_importedSpells).forEach(k => {
        if (Array.isArray(o[k])) _importedSpells[k] = o[k];
      });
    }
  } catch (e) { console.warn('imported spell load failed', e); }
  return _importedSpells;
}
function saveImportedSpells() {
  if (!storageOK) return false;
  try { localStorage.setItem(SPELL_IMPORT_KEY, JSON.stringify(loadImportedSpells())); return true; }
  catch (e) { console.warn('imported spell save failed', e); return false; }
}
function clearImportedSpells(systemId) {
  const imp = loadImportedSpells();
  if (systemId) imp[systemId] = []; else Object.keys(imp).forEach(k => imp[k] = []);
  saveImportedSpells();
  Object.keys(_spellCache).forEach(k => delete _spellCache[k]);
}

function spellsFor(systemId) {
  if (_spellCache[systemId]) return _spellCache[systemId];
  let base = [];
  try {
    if (systemId === '5e' && typeof unpackSpells5e === 'function') base = unpackSpells5e();
    else if (systemId === '5.5e' && typeof unpackSpells5e === 'function') base = unpackSpells5e().map(s => Object.assign({}, s, { uid: '5.5e:' + s.uid.split(':')[1], system: '5.5e', source: s.source }));
    else if (systemId === 'pf2' && typeof unpackSpellsPf2 === 'function') base = unpackSpellsPf2();
    else if (systemId === 'pf1' && typeof unpackSpellsPf1 === 'function') base = unpackSpellsPf1();
  } catch (e) { console.error('spell unpack failed for ' + systemId, e); }
  // Imported entries replace built-ins of the same name, but inherit the built-in's
  // uid so characters that already picked that spell keep their reference.
  const byName = {};
  base.forEach(s => { byName[(s.name || '').toLowerCase()] = s; });
  const replaced = new Set();
  const imported = (loadImportedSpells()[systemId] || []).map((s, i) => {
    const key = (s.name || '').toLowerCase();
    const twin = byName[key];
    if (twin) replaced.add(twin.uid);
    return Object.assign({}, s, {
      uid: twin ? twin.uid : systemId + ':imp' + i,
      system: systemId,
      imported: true
    });
  });
  const merged = base.filter(s => !replaced.has(s.uid)).concat(imported);
  merged.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  _spellCache[systemId] = merged;
  return merged;
}
function spellByUid(systemId, uid) {
  return spellsFor(systemId).find(s => s.uid === uid) || null;
}
function hasSpellData(systemId) { return spellsFor(systemId).length > 0; }

/* ---------------- which classes cast ---------------- */
// PF2 classes that get focus spells without being spellcasters
const PF2_FOCUS_CLASSES = ['champion', 'monk'];

function casterInfo(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  if (!cls) return null;
  const sub = byId(cls.subclasses || [], c.subclassId);
  const sc = (sub && sub.spellcasting) || cls.spellcasting;
  if (sc) return { cls: cls, sub: sub, sc: sc, focusOnly: false };
  // champions and monks cast focus spells from a Focus Pool rather than slots
  if (c.systemId === 'pf2' && PF2_FOCUS_CLASSES.includes(cls.id)) {
    return { cls: cls, sub: sub, sc: { kind: 'focus', ability: cls.keyAbility[0], tradition: 'Focus' }, focusOnly: true };
  }
  return null;
}

/* ---------------- 5e limits ---------------- */
const KNOWN_5E = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
};
// Eldritch Knight / Arcane Trickster spells known
const KNOWN_5E_THIRD = { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 };

function spellLimits5e(c, d) {
  const info = casterInfo(c);
  if (!info) return null;
  const L = c.level, s = c.finalScores;
  const kind = info.sc.kind, ab = info.sc.ability;
  const clsId = info.cls.id;
  const out = { cantrips: (d.spell && d.spell.cantrips) || 0, mode: 'known', maxLevel: 0, slots: [] };

  if (kind === 'pact') {
    const p = pactSlots(L);
    out.slots = [];
    out.maxLevel = p.level;
    out.pact = p;
  } else if (kind === 'third') {
    out.slots = slotsFor('third', L);
    out.maxLevel = out.slots.length;
  } else {
    out.slots = slotsFor(kind, L);
    out.maxLevel = out.slots.length;
  }

  if (info.sub && info.sub.spellcasting && info.sc.kind === 'third') {
    let k = 0;
    Object.keys(KNOWN_5E_THIRD).map(Number).sort((a, b) => a - b).forEach(lv => { if (L >= lv) k = KNOWN_5E_THIRD[lv]; });
    out.known = k;
    out.cantrips = L >= 10 ? 3 : 2;
  } else if (KNOWN_5E[clsId]) {
    out.known = KNOWN_5E[clsId][clamp(L, 1, 20) - 1];
  } else if (info.sc.prepares) {
    out.mode = 'prepared';
    if (clsId === 'paladin') out.prepared = Math.max(1, Math.floor(L / 2) + mod(s[ab]));
    else out.prepared = Math.max(1, L + mod(s[ab]));
    if (clsId === 'wizard') out.spellbook = 6 + (L - 1) * 2;
  }
  return out;
}

/* ---------------- PF2 limits ---------------- */
function spellLimitsPf2(c) {
  const info = casterInfo(c);
  if (!info) return null;
  const L = c.level;
  if (info.focusOnly) {
    return {
      cantrips: 0, maxRank: Math.min(10, Math.ceil(L / 2)), slots: {}, total: 0,
      mode: 'focus', tradition: 'Focus spells',
      note: info.cls.name + 's have no spell slots. Focus spells are cast from a Focus Pool and refill on a 10-minute Refocus activity.'
    };
  }
  const maxRank = Math.min(10, Math.ceil(L / 2));
  const slots = {};
  for (let r = 1; r <= maxRank; r++) {
    if (L === 1) slots[r] = 2;
    else if (r === maxRank && L % 2 === 1) slots[r] = 2;
    else slots[r] = 3;
  }
  if (L >= 19) slots[10] = 1;
  const spontaneous = info.sc.kind === 'spontaneous';
  return {
    cantrips: 5,
    maxRank: maxRank,
    slots: slots,
    mode: spontaneous ? 'repertoire' : 'prepared',
    tradition: info.sc.tradition,
    total: Object.values(slots).reduce((a, b) => a + b, 0),
    note: spontaneous
      ? 'Your repertoire holds one spell per slot; sorcerers and some archetypes gain extra slots.'
      : 'Prepared casters fill each slot daily; divine font, school slots, and curriculum spells add more.'
  };
}

/* ---------------- PF1 limits ---------------- */
const PF1_PER_DAY = {
  // [level0..level9] by class level 1..20
  sw: [[3, 1], [4, 2], [4, 2, 1], [4, 3, 2], [4, 3, 2, 1], [4, 3, 3, 2], [4, 4, 3, 2, 1], [4, 4, 3, 3, 2],
  [4, 4, 4, 3, 2, 1], [4, 4, 4, 3, 3, 2], [4, 4, 4, 4, 3, 2, 1], [4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 3, 2, 1], [4, 4, 4, 4, 4, 3, 3, 2], [4, 4, 4, 4, 4, 4, 3, 2, 1],
  [4, 4, 4, 4, 4, 4, 3, 3, 2], [4, 4, 4, 4, 4, 4, 4, 3, 2, 1], [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 4, 4, 4, 3, 3], [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]],
  sorc: [[5, 3], [6, 4], [6, 5], [6, 6, 3], [6, 6, 4], [6, 6, 5, 3], [6, 6, 6, 4], [6, 6, 6, 5, 3],
  [6, 6, 6, 6, 4], [6, 6, 6, 6, 5, 3], [6, 6, 6, 6, 6, 4], [6, 6, 6, 6, 6, 5, 3],
  [6, 6, 6, 6, 6, 6, 4], [6, 6, 6, 6, 6, 6, 5, 3], [6, 6, 6, 6, 6, 6, 6, 4],
  [6, 6, 6, 6, 6, 6, 6, 5, 3], [6, 6, 6, 6, 6, 6, 6, 6, 4], [6, 6, 6, 6, 6, 6, 6, 6, 5, 3],
  [6, 6, 6, 6, 6, 6, 6, 6, 6, 4], [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]],
  brd: [[0, 1], [0, 2], [0, 3], [0, 3, 1], [0, 4, 2], [0, 4, 3], [0, 4, 3, 1], [0, 4, 4, 2], [0, 5, 4, 3],
  [0, 5, 4, 3, 1], [0, 5, 4, 4, 2], [0, 5, 5, 4, 3], [0, 5, 5, 4, 3, 1], [0, 5, 5, 4, 4, 2],
  [0, 5, 5, 5, 4, 3], [0, 5, 5, 5, 4, 3, 1], [0, 5, 5, 5, 4, 4, 2], [0, 5, 5, 5, 5, 4, 3],
  [0, 5, 5, 5, 5, 5, 4], [0, 5, 5, 5, 5, 5, 5]]
};
function pf1PerDay(c) {
  const cls = byId(SYS_PF1.classes, c.classId);
  if (!cls || !cls.spellcasting) return null;
  const L = clamp(c.level, 1, 20);
  let table = null, label = '';
  if (cls.id === 'wizard' || cls.id === 'cleric' || cls.id === 'druid') { table = PF1_PER_DAY.sw; label = 'prepared'; }
  else if (cls.id === 'sorcerer') { table = PF1_PER_DAY.sorc; label = 'spontaneous'; }
  else if (cls.id === 'bard') { table = PF1_PER_DAY.brd; label = 'spontaneous'; }
  const sc = cls.spellcasting;
  const out = { mode: label || sc.kind, perDay: table ? table[L - 1] : null, ability: sc.ability };
  if (!table) {
    out.note = cls.name + ' spells per day come from the class table; this build tracks your list but not the daily count.';
    out.maxLevel = L >= sc.startLevel ? Math.min(sc.maxSpellLevel, Math.min(4, 1 + Math.floor((L - 4) / 3))) : 0;
  } else {
    out.maxLevel = out.perDay.length - 1;
  }
  if (cls.id === 'cleric') out.extra = 'Plus one domain spell slot of each level you can cast.';
  if (cls.id === 'wizard') out.extra = 'Plus one bonus school spell of each level (specialists only).';
  return out;
}

/* ---------------- unified limit accessor ---------------- */
function spellLimits(c, d) {
  if (!casterInfo(c)) return null;
  if (c.systemId === '5e' || c.systemId === '5.5e') return spellLimits5e(c, d || derive(c));
  if (c.systemId === 'pf2') return spellLimitsPf2(c);
  if (c.systemId === 'pf1') return pf1PerDay(c);
  return null;
}

/* ---------------- spell availability for a character ---------------- */
function spellOnList(c, sp) {
  const S = sys(c.systemId);
  const info = casterInfo(c);
  if (!info) return false;
  if (c.systemId === '5e' || c.systemId === '5.5e') {
    const want = (info.sub && info.sub.spellcasting) ? 'wizard' : info.cls.id;
    return (sp.classes || []).includes(want);
  }
  if (c.systemId === 'pf1') {
    const key = PF1_CLASS_TO_KEY[info.cls.id];
    return !!(sp.levels && sp.levels[key] !== undefined);
  }
  if (c.systemId === 'pf2') {
    const trad = (info.sc.tradition || '').toLowerCase();
    if (sp.focus) return (sp.traits || []).includes(info.cls.id);
    if (info.focusOnly) return false;   // no slots, so only focus spells apply
    if (!(sp.traditions || []).length) return false;   // rituals and class-locked items
    if (trad === 'by bloodline') return true;          // sorcerer: bloodline sets the tradition
    return (sp.traditions || []).includes(trad);
  }
  return true;
}
// the level this spell occupies for this character
function spellLevelFor(c, sp) {
  if (c.systemId === 'pf1') {
    const info = casterInfo(c);
    const key = info ? PF1_CLASS_TO_KEY[info.cls.id] : null;
    if (key && sp.levels && sp.levels[key] !== undefined) return sp.levels[key];
    return sp.level;
  }
  return sp.level;
}

/* ---------------- character spell list helpers ---------------- */
function charSpells(c) { return (c.spells || []).map(u => spellByUid(c.systemId, u)).filter(Boolean); }
function isPrepared(c, uid) { return (c.prepared || []).includes(uid); }

function spellCounts(c) {
  const list = charSpells(c);
  const lim = spellLimits(c, null);
  const cantrips = list.filter(s => spellLevelFor(c, s) === 0 || s.cantrip).length;
  const leveled = list.filter(s => !(spellLevelFor(c, s) === 0 || s.cantrip));
  const focus = list.filter(s => s.focus).length;
  return {
    total: list.length, cantrips: cantrips, leveled: leveled.length, focus: focus,
    prepared: (c.prepared || []).length, limits: lim
  };
}

function spellIssues(c) {
  const out = [];
  if (!casterInfo(c)) return out;
  const cnt = spellCounts(c);
  const lim = cnt.limits;
  if (!lim) return out;
  const cantripLimit = lim.cantrips || 0;
  if (cantripLimit && cnt.cantrips > cantripLimit) {
    out.push({ level: 'error', text: 'Too many cantrips: ' + cnt.cantrips + ' of ' + cantripLimit + '.' });
  } else if (cantripLimit && cnt.cantrips < cantripLimit) {
    out.push({ level: 'warn', text: 'You can still learn ' + (cantripLimit - cnt.cantrips) + ' cantrip(s).' });
  }
  if (c.systemId === '5e') {
    if (lim.known !== undefined) {
      if (cnt.leveled > lim.known) out.push({ level: 'error', text: 'Too many spells known: ' + cnt.leveled + ' of ' + lim.known + '.' });
      else if (cnt.leveled < lim.known) out.push({ level: 'warn', text: (lim.known - cnt.leveled) + ' more spell(s) can be known.' });
    }
    if (lim.mode === 'prepared' && lim.prepared !== undefined && cnt.prepared > lim.prepared) {
      out.push({ level: 'error', text: 'Too many spells prepared: ' + cnt.prepared + ' of ' + lim.prepared + '.' });
    }
    charSpells(c).forEach(sp => {
      const l = spellLevelFor(c, sp);
      if (l > 0 && lim.maxLevel && l > lim.maxLevel) {
        out.push({ level: 'error', text: sp.name + ' is level ' + l + ' — you can only cast up to level ' + lim.maxLevel + '.' });
      }
    });
  }
  if (c.systemId === 'pf2' && lim.maxRank) {
    charSpells(c).forEach(sp => {
      if (!sp.cantrip && !sp.focus && sp.level > lim.maxRank) {
        out.push({ level: 'error', text: sp.name + ' is rank ' + sp.level + ' — your highest is rank ' + lim.maxRank + '.' });
      }
    });
    if (lim.mode === 'repertoire' && cnt.leveled > lim.total) {
      out.push({ level: 'warn', text: 'Repertoire holds ' + cnt.leveled + ' spells for ' + lim.total + ' slots.' });
    }
  }
  if (c.systemId === 'pf1' && lim.maxLevel !== undefined) {
    charSpells(c).forEach(sp => {
      const l = spellLevelFor(c, sp);
      if (l > lim.maxLevel) out.push({ level: 'error', text: sp.name + ' is a level ' + l + ' spell — your maximum is ' + lim.maxLevel + '.' });
    });
  }
  const off = charSpells(c).filter(sp => !spellOnList(c, sp));
  if (off.length) out.push({ level: 'warn', text: off.length + ' spell(s) are not on your class list: ' + off.slice(0, 3).map(s => s.name).join(', ') + (off.length > 3 ? '…' : '') + '.' });
  return out;
}

/* ---------------- filtering ---------------- */
const spellUI = { q: '', level: 'all', school: 'all', onlyList: true, tab: 'book', open: null, limit: 60 };

// Filters and the open tab belong to a character, not to the app, so reset them
// whenever we switch to a different one.
function resetSpellUI() {
  spellUI.q = ''; spellUI.level = 'all'; spellUI.school = 'all';
  spellUI.onlyList = true; spellUI.tab = 'book'; spellUI.open = null; spellUI.limit = 60;
}

/* The PF2 remaster renamed a number of spells. Searching the old name should still
   find the spell, so map legacy names onto current ones. */
const PF2_LEGACY_NAMES = {
  'magic missile': 'force barrage',
  'true strike': 'sure strike',
  'mage armor': 'mystic armor',
  'dimension door': 'translocate',
  'time stop': 'freeze time',
  'ray of enfeeblement': 'enfeeble',
  'spiritual weapon': 'spiritual armament',
  'burning hands': 'breathe fire',
  'flaming sphere': 'floating flame',
  'scorching ray': 'blazing bolt',
  'barkskin': 'oaken resilience',
  'call lightning': 'draw the lightning',
  'animate dead': 'summon undead',
  'sound burst': 'noise blast',
  'shocking grasp': 'thunderstrike',
  'chill touch': 'void warp',
  'magic weapon': 'runic weapon',
  'phantom steed': 'marvelous mount',
  'gentle repose': 'peaceful rest',
  'faerie fire': 'revealing light',
  'sunburst': 'fear the sun',
  'modify memory': 'never mind',
  'lay on hands': 'lay on hands'
};
function legacyAlias(systemId, q) {
  if (systemId !== 'pf2') return null;
  const hit = PF2_LEGACY_NAMES[q];
  return hit && hit !== q ? hit : null;
}

function filterSpells(c) {
  const all = spellsFor(c.systemId);
  let q = spellUI.q.trim().toLowerCase();
  const alias = legacyAlias(c.systemId, q);
  if (alias) q = alias;
  return all.filter(sp => {
    if (spellUI.onlyList && !spellOnList(c, sp)) return false;
    if (spellUI.level !== 'all') {
      const lv = spellLevelFor(c, sp);
      if (spellUI.level === 'cantrip') { if (!(lv === 0 || sp.cantrip)) return false; }
      else if (spellUI.level === 'focus') { if (!sp.focus) return false; }
      else if (String(lv) !== String(spellUI.level)) return false;
    }
    if (spellUI.school !== 'all') {
      const tags = [sp.school || ''].concat(sp.traits || []).map(x => String(x).toLowerCase());
      if (!tags.includes(spellUI.school.toLowerCase())) return false;
    }
    if (q) {
      const hay = (sp.name + ' ' + (sp.text || '') + ' ' + (sp.school || '') + ' ' + (sp.traits || []).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function schoolOptions(systemId) {
  const set = new Set();
  spellsFor(systemId).forEach(sp => {
    if (sp.school) set.add(sp.school);
    (sp.traits || []).forEach(t => { if (SPELL_TRAIT_FILTER.includes(t)) set.add(t); });
  });
  return [...set].sort();
}
const SPELL_TRAIT_FILTER = ['acid', 'air', 'cold', 'darkness', 'death', 'earth', 'electricity', 'emotion',
  'fear', 'fire', 'healing', 'illusion', 'light', 'mental', 'poison', 'sonic', 'teleportation', 'vitality', 'void', 'water', 'polymorph'];

/* ---------------- importer ---------------- */
/* Normalises a few common shapes into our internal spell object. */
function normalizeImportedSpell(o, systemId) {
  if (!o || typeof o !== 'object') return null;
  const name = o.name || o.Name || o.title;
  if (!name) return null;
  const num = v => { const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; };

  if (systemId === '5e') {
    // Open5e v1 shape, or our own export
    const cls = (o.spell_lists || o.classes ||
      String(o.dnd_class || '').split(',').map(x => x.trim()).filter(Boolean))
      .map(x => String(x).toLowerCase());
    return {
      name: name,
      level: o.level_int !== undefined ? o.level_int : (o.spell_level !== undefined ? o.spell_level : num(o.level)),
      school: (o.school || '').replace(/^./, ch => ch.toUpperCase()),
      castingTime: o.casting_time || o.castingTime || '',
      range: o.range || '',
      duration: o.duration || '',
      components: o.components || [o.requires_verbal_components ? 'V' : '', o.requires_somatic_components ? 'S' : '', o.requires_material_components ? 'M' : ''].join(''),
      material: o.material || '',
      concentration: o.requires_concentration !== undefined ? !!o.requires_concentration : /^yes$/i.test(o.concentration || ''),
      ritual: o.can_be_cast_as_ritual !== undefined ? !!o.can_be_cast_as_ritual : /^yes$/i.test(o.ritual || ''),
      classes: [...new Set(cls)],
      text: o.desc || o.text || o.description || '',
      higher: o.higher_level || o.higher || '',
      source: o.document__title || o.source || 'imported'
    };
  }
  if (systemId === 'pf1') {
    const levels = {};
    ['sw', 'brd', 'clr', 'drd', 'pal', 'rgr'].forEach(k => { if (o[k] !== undefined && o[k] !== '' && o[k] !== null) levels[k] = num(o[k]); });
    // Pathfinder Community CSV column names
    const map = { sor: 'sw', wiz: 'sw', bard: 'brd', cleric: 'clr', druid: 'drd', paladin: 'pal', ranger: 'rgr' };
    Object.keys(map).forEach(k => {
      if (o[k] !== undefined && o[k] !== '' && o[k] !== null && !isNaN(parseInt(o[k], 10))) levels[map[k]] = num(o[k]);
    });
    if (o.levels && typeof o.levels === 'object') Object.assign(levels, o.levels);
    if (!Object.keys(levels).length) return null;
    return {
      name: name,
      school: o.school || '',
      levels: levels,
      level: Math.min.apply(null, Object.values(levels)),
      classes: Object.keys(levels).map(k => SPELL_CLASSES_PF1[k]).filter(Boolean),
      castingTime: o.casting_time || o.castingTime || o.cast || '',
      range: o.range || '',
      duration: o.duration || '',
      save: o.saving_throw || o.save || '',
      sr: o.spell_resistance || o.sr || '',
      text: o.description || o.desc || o.text || o.description_formatted || '',
      source: o.source || 'imported'
    };
  }
  if (systemId === 'pf2') {
    return {
      name: name,
      level: o.level !== undefined ? num(o.level) : num(o.rank),
      cantrip: !!o.cantrip || (o.traits || []).includes('cantrip'),
      focus: !!o.focus || (o.traits || []).includes('focus'),
      castingTime: o.castingTime || o.actions || o.cast || '',
      range: o.range || '', target: o.target || '', area: o.area || '',
      duration: o.duration || '', save: o.saving_throw || o.save || '',
      traditions: (o.traditions || o.tradition || []).map(x => String(x).toLowerCase()),
      traits: o.traits || o.trait || [],
      rarity: o.rarity || 'common',
      text: o.text || o.desc || o.description || '',
      source: o.source || 'imported'
    };
  }
  return null;
}

function importSpellRecords(records, systemId) {
  const imp = loadImportedSpells();
  let added = 0, skipped = 0;
  records.forEach(r => {
    const n = normalizeImportedSpell(r, systemId);
    if (n && n.name) { imp[systemId].push(n); added++; } else skipped++;
  });
  saveImportedSpells();
  delete _spellCache[systemId];
  return { added: added, skipped: skipped };
}

/* CSV -> array of objects (handles quoted fields and embedded newlines) */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).filter(r => r.length > 1).map(r => {
    const o = {};
    head.forEach((h, i) => o[h] = r[i] === undefined ? '' : r[i]);
    return o;
  });
}

/* Pull the full Open5e catalogue using the user's own internet connection. */
async function fetchOpen5e(onProgress) {
  const base = 'https://api.open5e.com/v1/spells/?limit=200';
  let url = base, page = 1, all = [];
  while (url) {
    onProgress('Fetching page ' + page + '… (' + all.length + ' spells so far)');
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' from Open5e');
    const data = await res.json();
    all = all.concat(data.results || []);
    url = data.next;
    page++;
    if (page > 20) break;
  }
  return all;
}
