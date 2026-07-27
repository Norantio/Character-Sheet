/* Independent fact-check: sample well-known spells and compare the shipped data
   against the published rules. Run: node src/test-spellfacts.js */
const fs = require('fs'), path = require('path'), vm = require('vm');

const FILES = ['10-core.js', '20-dnd5e.js', '30-dnd4e.js', '40-pf1.js', '50-pf2.js', '60-engine.js',
  '70-ui.js', '80-spells-5e.js', '81-spells-pf2.js', '82-spells-pf1.js', '85-spellbook.js', '86-spells-ui.js',
  '90-play.js', '91-sheet.js', '83-items-5e.js', '84-items-pf2.js', '87-items-pf1.js',
  '88-items-extra.js', '92-inventory.js', '93-inventory-ui.js', '95-store.js', '96-signin.js', '97-campaigns.js', '98-journal.js', '99-privacy.js', '100-privacy-ui.js', '101-live.js'];
let code = FILES.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n;\n');
code += ';globalThis.__x = { spellsFor, PF2_LEGACY_NAMES };';
const store = {};
const sb = {
  console, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() { }, getElementById: () => ({ innerHTML: '' }), querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), body: {} },
  window: { addEventListener() { }, scrollTo() { } }
};
sb.globalThis = sb; vm.createContext(sb); vm.runInContext(code, sb);
const spellsFor = sb.__x.spellsFor;

let pass = 0, fail = 0; const fails = [];
function check(label, cond, detail) { if (cond) pass++; else { fail++; fails.push(label + (detail ? ' — ' + detail : '')); } }
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ---------------- 5e ---------------- */
section('D&D 5e SRD: level, school, class list');
const s5 = spellsFor('5e');
const get5 = n => s5.find(s => s.name.toLowerCase() === n.toLowerCase());

// [name, level, school]
[
  ['Acid Splash', 0, 'Conjuration'], ['Eldritch Blast', 0, 'Evocation'],
  ['Fire Bolt', 0, 'Evocation'], ['Guidance', 0, 'Divination'],
  ['Prestidigitation', 0, 'Transmutation'], ['Sacred Flame', 0, 'Evocation'],
  ['Vicious Mockery', 0, 'Enchantment'], ['Thaumaturgy', 0, 'Transmutation'],
  ['Cure Wounds', 1, 'Evocation'], ['Detect Magic', 1, 'Divination'],
  ['Healing Word', 1, 'Evocation'], ['Hunter\'s Mark', 1, 'Divination'],
  ['Mage Armor', 1, 'Abjuration'], ['Magic Missile', 1, 'Evocation'],
  ['Shield', 1, 'Abjuration'], ['Sleep', 1, 'Enchantment'],
  ['Thunderwave', 1, 'Evocation'], ['Bless', 1, 'Enchantment'],
  ['Invisibility', 2, 'Illusion'], ['Misty Step', 2, 'Conjuration'],
  ['Spiritual Weapon', 2, 'Evocation'], ['Hold Person', 2, 'Enchantment'],
  ['Animate Dead', 3, 'Necromancy'], ['Counterspell', 3, 'Abjuration'],
  ['Fireball', 3, 'Evocation'], ['Fly', 3, 'Transmutation'],
  // SRD 5.1 lists Revivify as conjuration (the 2024 rules moved it to necromancy)
  ['Haste', 3, 'Transmutation'], ['Revivify', 3, 'Conjuration'],
  ['Dimension Door', 4, 'Conjuration'], ['Polymorph', 4, 'Transmutation'],
  ['Wall of Fire', 4, 'Evocation'], ['Greater Invisibility', 4, 'Illusion'],
  ['Cone of Cold', 5, 'Evocation'], ['Raise Dead', 5, 'Necromancy'],
  ['Wall of Force', 5, 'Evocation'], ['Chain Lightning', 6, 'Evocation'],
  ['Disintegrate', 6, 'Transmutation'], ['True Seeing', 6, 'Divination'],
  ['Finger of Death', 7, 'Necromancy'], ['Teleport', 7, 'Conjuration'],
  ['Dominate Monster', 8, 'Enchantment'], ['Sunburst', 8, 'Evocation'],
  ['Meteor Swarm', 9, 'Evocation'], ['Power Word Kill', 9, 'Enchantment'],
  ['Time Stop', 9, 'Transmutation'], ['True Resurrection', 9, 'Necromancy'],
  ['Wish', 9, 'Conjuration']
].forEach(([name, lv, school]) => {
  const sp = get5(name);
  if (!sp) return check('5e has ' + name, false, 'missing from the catalogue');
  check('5e ' + name + ' is level ' + lv, sp.level === lv, 'data says ' + sp.level);
  check('5e ' + name + ' is ' + school, sp.school === school, 'data says ' + sp.school);
});

// class lists
[
  ['Fireball', ['sorcerer', 'wizard']],
  ['Cure Wounds', ['bard', 'cleric', 'druid', 'paladin', 'ranger']],
  ['Eldritch Blast', ['warlock']],
  ['Sacred Flame', ['cleric']],
  ['Hunter\'s Mark', ['ranger']],
  ['Divine Favor', ['paladin']],
  ['Vicious Mockery', ['bard']],
  ['Counterspell', ['sorcerer', 'warlock', 'wizard']]
].forEach(([name, want]) => {
  const sp = get5(name);
  if (!sp) return check('5e has ' + name, false);
  const got = sp.classes.slice().sort().join(',');
  check('5e ' + name + ' class list', got === want.slice().sort().join(','), 'data says ' + got);
});

// flags
check('5e Fireball needs no concentration', get5('Fireball').concentration === false);
check('5e Hold Person needs concentration', get5('Hold Person').concentration === true);
check('5e Invisibility needs concentration', get5('Invisibility').concentration === true);
check('5e Detect Magic can be a ritual', get5('Detect Magic').ritual === true);
check('5e Identify can be a ritual', get5('Identify').ritual === true);
check('5e Fireball is not a ritual', get5('Fireball').ritual === false);
check('5e Fireball has V, S, M', get5('Fireball').components === 'VSM');
check('5e Magic Missile has V, S only', get5('Magic Missile').components === 'VS',
  'data says ' + get5('Magic Missile').components);
check('5e Fireball range is 150 feet', /150/.test(get5('Fireball').range), get5('Fireball').range);
check('5e Fireball damage type is fire', /fire/i.test(get5('Fireball').damageType));
check('5e Cone of Cold saves with Con', /CON/i.test(get5('Cone of Cold').save || ''),
  'data says ' + get5('Cone of Cold').save);

/* ---------------- PF2 ---------------- */
section('Pathfinder 2e: rank, traits, traditions');
const s2 = spellsFor('pf2');
const get2 = n => s2.find(s => s.name.toLowerCase() === n.toLowerCase());

[
  ['Bless', 1], ['Fear', 1], ['Force Barrage', 1], ['Heal', 1], ['Mystic Armor', 1],
  ['Sure Strike', 1], ['Soothe', 1], ['Grease', 1],
  ['Invisibility', 2], ['Mirror Image', 2], ['Fireball', 3], ['Haste', 3],
  ['Fly', 4], ['Cone of Cold', 5], ['Disintegrate', 6],
  ['Teleport', 6], ['Wish', 10],
  // remaster renames: Dimension Door -> Translocate, Time Stop -> Freeze Time
  ['Translocate', 4], ['Freeze Time', 10]
].forEach(([name, rank]) => {
  const sp = get2(name);
  if (!sp) return check('pf2 has ' + name, false, 'missing from the catalogue');
  check('pf2 ' + name + ' is rank ' + rank, sp.level === rank, 'data says ' + sp.level);
});

['Electric Arc', 'Shield', 'Detect Magic', 'Light', 'Prestidigitation', 'Telekinetic Projectile'].forEach(n => {
  const sp = get2(n);
  if (!sp) return check('pf2 has cantrip ' + n, false);
  check('pf2 ' + n + ' is a cantrip', sp.cantrip === true);
});
['Lay on Hands', 'Fire Ray', 'Dragon Claws'].forEach(n => {
  const sp = get2(n);
  if (!sp) return check('pf2 has focus spell ' + n, false);
  check('pf2 ' + n + ' is a focus spell', sp.focus === true);
});
check('pf2 Fireball is arcane and primal',
  get2('Fireball').traditions.slice().sort().join(',') === 'arcane,primal',
  get2('Fireball').traditions.join(','));
check('pf2 Heal is divine and primal',
  get2('Heal').traditions.slice().sort().join(',') === 'divine,primal',
  get2('Heal').traditions.join(','));
check('pf2 Fireball has the fire trait', get2('Fireball').traits.includes('fire'));
check('pf2 Fireball takes 2 actions', get2('Fireball').castingTime === '2 actions',
  get2('Fireball').castingTime);
check('pf2 Fireball is a basic Reflex save', get2('Fireball').save === 'basic reflex',
  get2('Fireball').save);
check('pf2 Fireball area is a 20-foot burst', get2('Fireball').area === '20-foot burst',
  get2('Fireball').area);
check('pf2 Lay on Hands is uncommon', get2('Lay on Hands').rarity === 'uncommon');
check('pf2 Wish is rare', get2('Wish').rarity === 'rare');
check('pf2 remaster renamed Magic Missile', get2('Magic Missile') === undefined);
check('pf2 remaster renamed True Strike to Sure Strike', !!get2('Sure Strike'));
check('pf2 remaster renamed Dimension Door', get2('Dimension Door') === undefined);
check('pf2 remaster renamed Time Stop', get2('Time Stop') === undefined);

/* legacy-name search aliases must all resolve to a real spell */
section('Pathfinder 2e: remaster name aliases');
const aliases = sb.__x.PF2_LEGACY_NAMES;
Object.keys(aliases).forEach(old => {
  const target = get2(aliases[old]);
  check('alias "' + old + '" resolves to ' + aliases[old], !!target,
    'no spell named ' + aliases[old]);
});
check('alias table is not empty', Object.keys(aliases).length > 10);

/* ---------------- PF1 ---------------- */
section('Pathfinder 1e: school and per-class level');
const s1 = spellsFor('pf1');
const get1 = n => s1.find(s => s.name.toLowerCase() === n.toLowerCase());

// [name, school, {classKey: level}]
[
  ['Prestidigitation', 'Universal', { sw: 0 }],
  ['Detect Magic', 'Divination', { sw: 0, brd: 0, clr: 0, drd: 0 }],
  ['Magic Missile', 'Evocation', { sw: 1 }],
  ['Mage Armor', 'Conjuration', { sw: 1 }],
  ['Shield', 'Abjuration', { sw: 1 }],
  ['Bless', 'Enchantment', { clr: 1, pal: 1 }],
  ['Cure Light Wounds', 'Conjuration', { brd: 1, clr: 1, drd: 1, pal: 1, rgr: 2 }],
  ['Divine Favor', 'Evocation', { clr: 1, pal: 1 }],
  ['Fireball', 'Evocation', { sw: 3 }],
  ['Fly', 'Transmutation', { sw: 3 }],
  ['Haste', 'Transmutation', { sw: 3, brd: 3 }],
  ['Dispel Magic', 'Abjuration', { sw: 3, brd: 3, clr: 3, pal: 3 }],
  ['Stoneskin', 'Abjuration', { sw: 4 }],
  ['Teleport', 'Conjuration', { sw: 5 }],
  ['Raise Dead', 'Conjuration', { clr: 5 }],
  ['Disintegrate', 'Transmutation', { sw: 6 }],
  ['Heal', 'Conjuration', { clr: 6, drd: 7 }],
  ['Time Stop', 'Transmutation', { sw: 9 }],
  ['Wish', 'Universal', { sw: 9 }],
  ['Meteor Swarm', 'Evocation', { sw: 9 }]
].forEach(([name, school, levels]) => {
  const sp = get1(name);
  if (!sp) return check('pf1 has ' + name, false, 'missing from the index');
  check('pf1 ' + name + ' is ' + school, sp.school === school, 'data says ' + sp.school);
  Object.keys(levels).forEach(k => {
    check('pf1 ' + name + ' is ' + k + ' ' + levels[k],
      sp.levels[k] === levels[k], 'data says ' + k + ' ' + sp.levels[k]);
  });
});
check('pf1 Fireball is not on the cleric list', get1('Fireball').levels.clr === undefined);
check('pf1 Cure Light Wounds is not an arcane spell', get1('Cure Light Wounds').levels.sw === undefined);
check('pf1 index covers all nine spell levels',
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every(l => s1.some(sp => Object.values(sp.levels).includes(l))));

/* ---------------- results ---------------- */
console.log('\n' + '='.repeat(56));
if (fails.length) {
  console.log('\x1b[31mFACT-CHECK FAILURES (' + fails.length + '):\x1b[0m');
  fails.forEach(f => console.log('  ✗ ' + f));
}
console.log((fail ? '\x1b[31m' : '\x1b[32m') + pass + ' facts verified, ' + fail + ' wrong\x1b[0m');
process.exit(fail ? 1 : 0);
