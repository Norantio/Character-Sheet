/* ============================================================
   Inventory: catalogue, carried items, coins, load and encumbrance
   ============================================================ */

/* ---------------- the catalogue ---------------- */
const _itemCache = {};
function itemsFor(systemId) {
  if (_itemCache[systemId]) return _itemCache[systemId];
  let rows = [];
  try {
    if (systemId === '5e' && typeof ITEMDATA_5E !== 'undefined') rows = ITEMDATA_5E;
    else if (systemId === 'pf2' && typeof ITEMDATA_PF2 !== 'undefined') rows = ITEMDATA_PF2;
    else if (systemId === 'pf1' && typeof ITEMDATA_PF1 !== 'undefined') {
      rows = ITEMDATA_PF1.concat(typeof ITEMDATA_PF1_EXTRA !== 'undefined' ? ITEMDATA_PF1_EXTRA : []);
    } else if (systemId === '4e' && typeof ITEMDATA_4E !== 'undefined') rows = ITEMDATA_4E;
  } catch (e) { console.error('item load failed for ' + systemId, e); }
  const list = rows.map((r, i) => ({
    uid: systemId + ':i' + i,
    name: r[0],
    cat: ITEMCATS[r[1]] || 'other',
    cp: r[2] || 0,
    weight: r[3] || 0,
    sub: r[4] || '',
    stats: r[5] || '',
    attune: !!r[6],
    note: r[7] || ''
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  _itemCache[systemId] = list;
  return list;
}
function catalogueItem(systemId, uid) {
  return itemsFor(systemId).find(i => i.uid === uid) || null;
}
function hasItemData(systemId) { return itemsFor(systemId).length > 0; }

/* Bulk for Pathfinder 2e, pounds everywhere else. */
function weightUnit(systemId) { return systemId === 'pf2' ? 'Bulk' : 'lb'; }
function fmtWeight(systemId, n) {
  if (systemId === 'pf2') {
    if (n === 0) return '—';
    if (n < 1) return (Math.round(n * 10)) + 'L';
    return (Math.round(n * 10) / 10) + '';
  }
  return (Math.round(n * 100) / 100) + '';
}

/* ---------------- money ---------------- */
const COINS = [
  { id: 'pp', name: 'Platinum', cp: 1000 },
  { id: 'gp', name: 'Gold', cp: 100 },
  { id: 'sp', name: 'Silver', cp: 10 },
  { id: 'cp', name: 'Copper', cp: 1 }
];
function fmtCoins(cp) {
  cp = Math.round(cp);
  if (!cp) return '0 gp';
  const out = [];
  COINS.forEach(c => {
    const n = Math.floor(cp / c.cp);
    if (n) { out.push(n + ' ' + c.id); cp -= n * c.cp; }
  });
  return out.join(' ');
}
/* Show the coins as held — turning 25 gp into "2 pp 5 gp" only confuses people. */
function fmtPurse(c) {
  const p = invInit(c).coins;
  const held = COINS.filter(k => Number(p[k.id]) > 0).map(k => Number(p[k.id]) + ' ' + k.id);
  return held.length ? held.join(' · ') : 'empty';
}
function fmtGold(cp) {
  const gp = cp / 100;
  return (Math.round(gp * 100) / 100) + ' gp';
}
function coinTotalCp(c) {
  const p = invInit(c).coins;
  return COINS.reduce((t, k) => t + (Number(p[k.id]) || 0) * k.cp, 0);
}
function coinCount(c) {
  const p = invInit(c).coins;
  return COINS.reduce((t, k) => t + (Number(p[k.id]) || 0), 0);
}
/* 50 coins to the pound in D&D and Pathfinder 1e; 1000 coins to the Bulk in PF2. */
function coinWeight(c) {
  const n = coinCount(c);
  if (!n) return 0;
  return c.systemId === 'pf2' ? n / 1000 : n / 50;
}

/* ---------------- carried items ---------------- */
function invInit(c) {
  if (!c.inv || typeof c.inv !== 'object') c.inv = {};
  if (!Array.isArray(c.inv.items)) c.inv.items = [];
  if (!c.inv.coins || typeof c.inv.coins !== 'object') c.inv.coins = { pp: 0, gp: 0, sp: 0, cp: 0 };
  return c.inv;
}
function invItems(c) { return invInit(c).items; }

/* Add from the catalogue, stacking with an identical line if there is one. */
function addCatalogueItem(c, uid, qty) {
  const src = catalogueItem(c.systemId, uid);
  if (!src) return null;
  const items = invItems(c);
  const same = items.find(i => i.ref === uid && !i.equipped);
  if (same) { same.qty += (qty || 1); return same; }
  const line = {
    id: uid8(), ref: uid, name: src.name, cat: src.cat, qty: qty || 1,
    weight: src.weight, cp: src.cp, stats: src.stats, sub: src.sub,
    attune: src.attune, attuned: false, equipped: false, note: src.note || ''
  };
  items.push(line);
  return line;
}
function addCustomItem(c, fields) {
  const line = {
    id: uid8(), ref: null,
    // trim first, so a name of only spaces still gets a usable label
    name: String(fields.name || '').trim() || 'New item',
    cat: fields.cat && ITEMCATS.includes(fields.cat) ? fields.cat : 'gear',
    qty: Math.max(1, Math.round(Number(fields.qty) || 1)),
    weight: Math.max(0, Number(fields.weight) || 0),
    cp: Math.max(0, Math.round(Number(fields.cp) || 0)),
    stats: (fields.stats || '').trim(),
    sub: 'custom',
    attune: false, attuned: false, equipped: false,
    note: (fields.note || '').trim(),
    custom: true
  };
  invItems(c).push(line);
  return line;
}
function invLine(c, id) { return invItems(c).find(i => i.id === id) || null; }
function removeItem(c, id) {
  const line = invLine(c, id);
  c.inv.items = invItems(c).filter(i => i.id !== id);
  if (line && line.equipped) syncEquippedArmour(c);
  return line;
}
function setQty(c, id, n) {
  const line = invLine(c, id);
  if (!line) return;
  line.qty = Math.max(0, Math.round(n));
  if (line.qty === 0) removeItem(c, id);
}
function uid8() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }

/* ---------------- load ---------------- */
function itemWeight(line) { return (Number(line.weight) || 0) * (Number(line.qty) || 0); }
function totalLoad(c) {
  const items = invItems(c).reduce((t, i) => t + itemWeight(i), 0);
  return Math.round((items + coinWeight(c)) * 1000) / 1000;
}

/* Pathfinder 1e heavy-load column, medium creature. Light is a third of it,
   medium two thirds, matching the printed table. */
const PF1_HEAVY = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200,
  230, 260, 300, 350, 400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400];
function pf1Capacity(str, small) {
  let heavy;
  if (str <= 0) heavy = 0;
  else if (str <= PF1_HEAVY.length) heavy = PF1_HEAVY[str - 1];
  else {
    // every 10 points of Strength beyond the table quadruples the limit
    const over = str - PF1_HEAVY.length;
    heavy = PF1_HEAVY[PF1_HEAVY.length - 1] * Math.pow(4, Math.floor(over / 10) + 1);
  }
  const mult = small ? 0.75 : 1;
  return {
    light: Math.floor(heavy / 3 * mult),
    medium: Math.floor(heavy * 2 / 3 * mult),
    heavy: Math.floor(heavy * mult)
  };
}

/* What counts as encumbered in each system. */
function loadLimits(c, d) {
  d = d || derive(c);
  const s = c.finalScores;
  const S = sys(c.systemId);
  const lin = byId(S.lineages, c.lineageId);
  const small = lin && lin.size === 'Small';
  if (c.systemId === 'pf1') {
    const cap = pf1Capacity(s.str, small);
    return {
      unit: 'lb',
      bands: [
        { name: 'Light load', upTo: cap.light, note: 'no penalty' },
        { name: 'Medium load', upTo: cap.medium, note: '−3 checks, max Dex +3, speed reduced' },
        { name: 'Heavy load', upTo: cap.heavy, note: '−6 checks, max Dex +1, speed reduced' },
        { name: 'Overloaded', upTo: Infinity, note: 'you cannot carry this much' }
      ],
      max: cap.heavy
    };
  }
  if (c.systemId === 'pf2') {
    const enc = 5 + mod(s.str), max = 10 + mod(s.str);
    return {
      unit: 'Bulk',
      bands: [
        { name: 'Unencumbered', upTo: enc, note: 'no penalty' },
        { name: 'Encumbered', upTo: max, note: 'clumsy 1, −10 ft. Speed' },
        { name: 'Over your maximum', upTo: Infinity, note: 'you cannot move' }
      ],
      max: max
    };
  }
  if (c.systemId === '4e') {
    return {
      unit: 'lb',
      bands: [
        { name: 'Normal load', upTo: s.str * 10, note: 'no penalty' },
        { name: 'Heavy load', upTo: s.str * 20, note: '−1 speed, −2 attacks and checks' },
        { name: 'Beyond dragging', upTo: Infinity, note: 'too heavy to shift' }
      ],
      max: s.str * 20
    };
  }
  // 5e: capacity is Str x 15, with the optional encumbrance rule at x5 and x10
  return {
    unit: 'lb',
    bands: [
      { name: 'Unencumbered', upTo: s.str * 5, note: 'no penalty' },
      { name: 'Encumbered', upTo: s.str * 10, note: '−10 ft. Speed (variant rule)' },
      { name: 'Heavily encumbered', upTo: s.str * 15, note: '−20 ft. Speed, disadvantage (variant rule)' },
      { name: 'Over capacity', upTo: Infinity, note: 'beyond what you can carry' }
    ],
    max: s.str * 15
  };
}
function loadBand(c, d) {
  const lim = loadLimits(c, d);
  const load = totalLoad(c);
  const band = lim.bands.find(b => load <= b.upTo) || lim.bands[lim.bands.length - 1];
  return { load: load, band: band, limits: lim, over: load > lim.max };
}

/* ---------------- equipping ---------------- */
/* Armour and shields in the inventory drive the worn armour, so AC follows. */
function armourChoices(c) {
  const S = sys(c.systemId);
  return (S.armorList || []).map(a => a.name);
}
function shieldFieldFor(systemId) {
  return systemId === '5e' ? 'shield' : systemId === '4e' ? 'shield4e'
    : systemId === 'pf1' ? 'shieldPf' : 'shieldPf2';
}
/* Catalogue names and table names do not always agree — the SRD calls it
   "Studded Leather Armor" while the armour table says "Studded Leather", and
   Pathfinder's "Heavy Steel Shield" is a "Heavy Shield" mechanically. Score on
   shared words so the closest entry wins rather than the first partial hit. */
function tokens(s) {
  return String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(w => w && !['armor', 'armour', 'a', 'of', 'the'].includes(w));
}
function bestMatch(name, candidates) {
  const want = tokens(name);
  const flat = x => String(x).toLowerCase().replace(/[^a-z]/g, '');
  const exact = candidates.find(x => flat(x) === flat(name));
  if (exact) return exact;
  let best = null, bestScore = 0;
  candidates.forEach(cand => {
    const have = tokens(cand);
    if (!have.length) return;
    const shared = have.filter(w => want.includes(w)).length;
    if (!shared) return;
    // reward overlap, penalise words the candidate has that the item does not
    const score = shared * 2 - (have.length - shared);
    if (score > bestScore) { bestScore = score; best = cand; }
  });
  return best;
}
function matchArmour(c, name) {
  const S = sys(c.systemId);
  const names = (S.armorList || []).map(a => a.name).filter((n, i) => i > 0);  // skip "None"
  return bestMatch(name, names);
}
function matchShield(c, name) {
  const S = sys(c.systemId);
  if (c.systemId === '5e') return /shield/i.test(name) ? true : null;
  const names = (S.shields || []).map(x => x.name).filter(n => n !== 'None');
  return bestMatch(name, names);
}

function toggleEquip(c, id) {
  const line = invLine(c, id);
  if (!line) return { ok: false, message: 'No such item.' };
  if (line.equipped) {
    line.equipped = false;
    syncEquippedArmour(c);
    return { ok: true, message: line.name + ' unequipped.' };
  }
  // only one suit of armour and one shield at a time
  if (line.cat === 'armor') invItems(c).forEach(i => { if (i.cat === 'armor') i.equipped = false; });
  if (line.cat === 'shield') invItems(c).forEach(i => { if (i.cat === 'shield') i.equipped = false; });
  line.equipped = true;
  const res = syncEquippedArmour(c);
  return { ok: true, message: line.name + ' equipped.' + (res ? ' ' + res : '') };
}

/* Push equipped armour and shields into the fields the AC maths reads. */
function syncEquippedArmour(c) {
  const S = sys(c.systemId);
  const items = invItems(c);
  const notes = [];

  const armour = items.find(i => i.equipped && i.cat === 'armor');
  const unarmoured = (S.armorList || [])[0] ? S.armorList[0].name : null;
  if (armour) {
    const m = matchArmour(c, armour.name);
    if (m) { c.armor = m; notes.push('AC now uses ' + m + '.'); }
    else notes.push('No armour table entry matches ' + armour.name + ', so AC is unchanged.');
  } else if (unarmoured) {
    c.armor = unarmoured;
  }

  const shield = items.find(i => i.equipped && i.cat === 'shield');
  const field = shieldFieldFor(c.systemId);
  if (c.systemId === '5e') {
    c.shield = !!shield;
  } else if (shield) {
    const m = matchShield(c, shield.name);
    if (m) c[field] = m;
  } else {
    c[field] = 'None';
  }
  return notes.join(' ');
}

/* When armour is chosen in the wizard, reflect it in the inventory. */
function syncArmourToInventory(c) {
  const items = invItems(c);
  const worn = c.armor;
  const S = sys(c.systemId);
  const unarmoured = (S.armorList || [])[0] ? S.armorList[0].name : null;
  items.forEach(i => {
    if (i.cat === 'armor') i.equipped = worn !== unarmoured && matchArmour(c, i.name) === worn;
  });
  const shieldOn = c.systemId === '5e' ? !!c.shield : (c[shieldFieldFor(c.systemId)] || 'None') !== 'None';
  items.forEach(i => { if (i.cat === 'shield') i.equipped = shieldOn && matchShield(c, i.name) !== null; });
}

/* ---------------- summary ---------------- */
function invSummary(c, d) {
  const items = invItems(c);
  const b = loadBand(c, d);
  return {
    count: items.reduce((t, i) => t + (i.qty || 0), 0),
    lines: items.length,
    load: b.load,
    band: b.band,
    limits: b.limits,
    over: b.over,
    coinCp: coinTotalCp(c),
    coinWeight: coinWeight(c),
    value: items.reduce((t, i) => t + (i.cp || 0) * (i.qty || 0), 0),
    equipped: items.filter(i => i.equipped).length,
    attuned: items.filter(i => i.attuned).length
  };
}
/* 5e allows three attuned items at a time. */
function attunementLimit(c) { return c.systemId === '5e' ? 3 : 0; }

function invIssues(c) {
  const out = [];
  const s = invSummary(c);
  if (s.over) {
    out.push({
      level: 'warn',
      text: 'Carrying ' + fmtWeight(c.systemId, s.load) + ' ' + s.limits.unit +
        ' — over your limit of ' + s.limits.max + '. ' + s.band.note + '.'
    });
  }
  const lim = attunementLimit(c);
  if (lim && s.attuned > lim) {
    out.push({ level: 'error', text: 'Attuned to ' + s.attuned + ' items; the limit is ' + lim + '.' });
  }
  return out;
}
