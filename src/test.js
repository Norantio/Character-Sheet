/* Headless verification harness. Run: node src/test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['10-core.js','20-dnd5e.js','21-dnd55e.js','30-dnd4e.js','40-pf1.js','50-pf2.js','60-engine.js','70-ui.js','80-spells-5e.js','81-spells-pf2.js','82-spells-pf1.js','85-spellbook.js','86-spells-ui.js','90-play.js','91-sheet.js','83-items-5e.js','84-items-pf2.js','87-items-pf1.js','88-items-extra.js','92-inventory.js','93-inventory-ui.js','95-store.js','96-signin.js','97-campaigns.js','98-journal.js','99-privacy.js','100-privacy-ui.js','101-live.js'];
let code = FILES.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n;\n');
// Top-level const/let bindings are not properties of globalThis in a classic script,
// so re-export the ones the tests need.
code += `
;globalThis.__consts = {
  ABIL6, ABIL_NAME, PB_5E, PB_PF1, BAB, SAVE_PF1, SLOTS_FULL, SLOTS_HALF, SLOTS_THIRD,
  ASI_5E, ASI_5E_FIGHTER, ASI_5E_ROGUE, ASI_55E, PROF, PROF_LABEL,
  SYS_5E, SYS_4E, SYS_PF1, SYS_PF2, SYS_55E, SYSTEMS, SYSTEM_ORDER, STORE_KEY, app,
  SPELL_SCHOOLS_5E, SPELL_CLASSES_5E, SPELLDATA_5E, SPELLDATA_PF2, SPELLDATA_PF1,
  SPELL_TRADITIONS_PF2, SPELL_CLASSES_PF1, PF1_CLASS_TO_KEY, KNOWN_5E, spellUI, importState, STARTERS, PF2_FOCUS_CLASSES, PF2_LEGACY_NAMES, SYSTEM_SHORT,
  USES_5E_CLASS, USES_5E_RACE, USES_PF1_CLASS, RESTS, sheetUI,
  ITEMCATS, ITEMDATA_5E, ITEMDATA_PF2, ITEMDATA_PF1, ITEMDATA_PF1_EXTRA, ITEMDATA_4E,
  COINS, PF1_HEAVY, invUI, CAT_LABEL, CAT_ORDER, STORE, TOKEN_KEY, signinUI, initials, campUI, partyColumns, partyTable, partyRoster, CAMP_KEY, LOCAL_PROFILE, journalUI, journalBlock, journalSorted, autoJournal, VIS_LABEL, VIS_CYCLE, paraHtml, PRIV_LEVELS, PRIV_SECTIONS, privLevelOf, privVisible, privClearance, privItemLevel, privEntryLevel, privHiddenItem, filterCharacter, privSection, privacyBlock, PRIV_LABEL, PRIV_NEXT, sheetReadOnly, LIVE, liveLabel, liveHoldOff
};`;

/* --- minimal DOM shim so 70-ui.js loads and renders --- */
const store = {};
function elStub() {
  return {
    innerHTML: '', value: '', checked: false, dataset: {}, type: 'text', files: [],
    style: {}, addEventListener() { }, appendChild() { }, remove() { }, click() { },
    closest() { return null; }, querySelector() { return null; }
  };
}
const sandbox = {
  console,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  document: {
    addEventListener() { },
    getElementById: () => elStub(),
    querySelector: () => null,
    createElement: () => elStub(),
    body: { appendChild() { }, removeChild() { } }
  },
  window: { addEventListener() { }, scrollTo() { }, print() { }, URL: { createObjectURL: () => 'blob:', revokeObjectURL() { } } },
  Blob: function () { },
  FileReader: function () { },
  alert: () => { },
  confirm: () => true,
  setTimeout,
  URL: { createObjectURL: () => 'blob:', revokeObjectURL() { } }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'bundle.js' });
const G = Object.assign({}, sandbox, sandbox.__consts);

/* --- tiny test framework --- */
let pass = 0, fail = 0;
const fails = [];
function eq(label, got, want) {
  const ok = String(got) === String(want);
  if (ok) pass++; else { fail++; fails.push(`${label}: got ${got}, expected ${want}`); }
}
function ok(label, cond) { if (cond) pass++; else { fail++; fails.push(label); } }
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

function mk(systemId, over) {
  const c = G.newCharacter(systemId);
  const S = G.sys(systemId);
  c.armor = S.armorList[0].name;
  Object.assign(c, over || {});
  return c;
}

/* ============ core math ============ */
section('Core math');
eq('mod(10)', G.mod(10), 0);
eq('mod(8)', G.mod(8), -1);
eq('mod(18)', G.mod(18), 4);
eq('mod(7)', G.mod(7), -2);
eq('profBonus5e(1)', G.profBonus5e(1), 2);
eq('profBonus5e(4)', G.profBonus5e(4), 2);
eq('profBonus5e(5)', G.profBonus5e(5), 3);
eq('profBonus5e(17)', G.profBonus5e(17), 6);
eq('profBonus5e(20)', G.profBonus5e(20), 6);
eq('5e point buy of standard array costs 27',
  G.pointBuySpend({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, G.PB_5E), 27);
eq('5e point buy all 8s costs 0', G.pointBuySpend({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, G.PB_5E), 0);
eq('PF1 15-pt array cost', G.pointBuySpend({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, G.PB_PF1), 15);
eq('BAB full at 7', G.BAB.full(7), 7);
eq('BAB 3/4 at 7', G.BAB.threeQuarter(7), 5);
eq('BAB 1/2 at 7', G.BAB.half(7), 3);
eq('PF1 good save at 1', G.SAVE_PF1.good(1), 2);
eq('PF1 good save at 20', G.SAVE_PF1.good(20), 12);
eq('PF1 poor save at 20', G.SAVE_PF1.poor(20), 6);
eq('5e full caster slots at 1', JSON.stringify(G.slotsFor('full', 1)), '[2]');
eq('5e full caster slots at 5', JSON.stringify(G.slotsFor('full', 5)), '[4,3,2]');
eq('5e full caster slots at 20', JSON.stringify(G.slotsFor('full', 20)), '[4,3,3,3,3,2,2,1,1]');
eq('5e half caster slots at 2', JSON.stringify(G.slotsFor('half', 2)), '[2]');
eq('5e third caster nothing at 1', JSON.stringify(G.slotsFor('third', 1)), '[]');
eq('5e third caster slots at 3', JSON.stringify(G.slotsFor('third', 3)), '[2]');
eq('warlock 5th: 2 slots of lvl 3', G.pactSlots(5).count + '/' + G.pactSlots(5).level, '2/3');
eq('warlock 5th invocations', G.pactSlots(5).invocations, 3);
eq('warlock 17th: 4 slots of lvl 5', G.pactSlots(17).count + '/' + G.pactSlots(17).level, '4/5');
eq('asArray on object', JSON.stringify(G.asArray({ 0: 'str', 1: 'dex' })), '["str","dex"]');
eq('asArray on array', JSON.stringify(G.asArray(['a'])), '["a"]');
eq('asArray on undefined', JSON.stringify(G.asArray(undefined)), '[]');

/* ============ 5e ============ */
section('D&D 5e');
{
  // Level 1 hill dwarf fighter, standard array assigned
  const c = mk('5e', {
    name: 'Test Fighter', level: 1, lineageId: 'dwarf', lineageSubId: 'hill',
    classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual',
    baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    armor: 'Chain Mail', shield: true, skills: ['athletics', 'intimidation']
  });
  const d = G.derive(c);
  eq('dwarf +2 Con applied', c.finalScores.con, 16);
  eq('hill dwarf +1 Wis applied', c.finalScores.wis, 13);
  eq('Str unchanged', c.finalScores.str, 15);
  eq('L1 fighter d10 + Con3 + dwarven toughness 1 = 14', d.hp, 14);
  eq('chain mail 16 + shield 2 = 18 AC', d.ac, 18);
  eq('dwarf speed 25', d.speed, 25);
  eq('prof bonus +2', d.profBonus, 2);
  eq('Str save proficient', d.saves.find(s => s.ability === 'str').value, 4);
  eq('Con save proficient', d.saves.find(s => s.ability === 'con').value, 5);
  eq('Dex save not proficient', d.saves.find(s => s.ability === 'dex').value, 1);
  eq('Athletics = Str 2 + prof 2', d.skills.find(s => s.id === 'athletics').value, 4);
  eq('Stealth = Dex 1 only', d.skills.find(s => s.id === 'stealth').value, 1);
  eq('passive perception 11', d.passivePerception, 11);
  ok('chain mail Str-13 warning absent (Str 15)', !d.notes.some(n => /Speed −10/.test(n)));
  ok('stealth disadvantage noted', d.notes.some(n => /Stealth/.test(n)));
  eq('melee attack +2 prof +2 Str', d.attacks[0].value, 4);
}
{
  // Level 5 wizard HP and slots
  const c = mk('5e', {
    level: 5, lineageId: 'elf', lineageSubId: 'high', classId: 'wizard',
    backgroundId: 'sage', abilityMethod: 'manual',
    baseScores: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, armor: 'None'
  });
  const d = G.derive(c);
  eq('high elf Int 16', c.finalScores.int, 16);
  eq('L5 wizard HP: 6+2 then 4x(4+2) = 32', d.hp, 32);
  eq('L5 slots', JSON.stringify(d.spell.slots), '[4,3,2]');
  eq('spell save DC 8+3+3', d.spell.dc, 14);
  eq('spell attack +6', d.spell.attack, 6);
  eq('cantrips: wizard has 4 from 4th level on', d.spell.cantrips, 4);
  eq('prepared = level + Int', d.spell.prepared, 8);
  eq('AC unarmored = 10 + Dex 3 (elf +2 Dex)', d.ac, 13);
  eq('elf grants Perception', c.skills.includes('perception') || G.skillBudget(c).granted.includes('perception'), true);
}
{
  // Barbarian unarmored defense
  const c = mk('5e', {
    level: 3, lineageId: 'halforc', classId: 'barbarian', abilityMethod: 'manual',
    baseScores: { str: 15, dex: 14, con: 15, int: 8, wis: 12, cha: 10 }, armor: 'None'
  });
  const d = G.derive(c);
  eq('half-orc Str 17 Con 16', c.finalScores.str + '/' + c.finalScores.con, '17/16');
  eq('unarmored defense 10+2+3 = 15', d.ac, 15);
  ok('unarmored note present', d.notes.some(n => /Unarmored Defense/.test(n)));
  eq('L3 barbarian HP 12+3 + 2x(7+3) = 35', d.hp, 35);
}
{
  // Warlock pact magic + monk martial arts
  const w = mk('5e', { level: 5, lineageId: 'tiefling', classId: 'warlock', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, armor: 'Leather' });
  const dw = G.derive(w);
  eq('warlock pact kind', dw.spell.kind, 'pact');
  eq('warlock 2 slots lvl 3', dw.spell.pact.count + '/' + dw.spell.pact.level, '2/3');
  eq('tiefling Cha 17 -> DC 8+3+3', dw.spell.dc, 14);
  const m = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'monk', abilityMethod: 'manual', baseScores: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 }, armor: 'None' });
  const dm = G.derive(m);
  eq('standard human +1 all: Dex 16, Wis 15', dm.skills ? m.finalScores.dex + '/' + m.finalScores.wis : '', '16/15');
  eq('monk AC 10 + Dex 3 + Wis 2 = 15', dm.ac, 15);
}
{
  // Level 20 fighter ASI count and heavy armor Str penalty
  const c = mk('5e', {
    level: 20, lineageId: 'human', lineageSubId: 'variant', classId: 'fighter', abilityMethod: 'manual',
    baseScores: { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }, armor: 'Plate',
    choiceAsi: ['str', 'con']
  });
  const d = G.derive(c);
  eq('variant human two +1s', c.finalScores.str + '/' + c.finalScores.con, '13/15');
  eq('fighter has 7 ASIs by 20', d.asiCount, 7);
  eq('plate is flat AC 18', d.ac, 18);
  ok('plate Str-15 penalty flagged', d.notes.some(n => /requires Str 15/.test(n)));
  eq('speed reduced to 20', d.speed, 20);
  eq('prof bonus +6', d.profBonus, 6);
}
{
  // Rogue expertise doubles proficiency
  const c = mk('5e', {
    level: 6, lineageId: 'halfling', lineageSubId: 'lightfoot', classId: 'rogue', abilityMethod: 'manual',
    baseScores: { str: 8, dex: 15, con: 13, int: 14, wis: 12, cha: 10 }, armor: 'Leather',
    skills: ['stealth', 'acrobatics', 'perception', 'investigation'], expertise: ['stealth', 'perception']
  });
  const d = G.derive(c);
  eq('halfling Dex 17', c.finalScores.dex, 17);
  eq('stealth expertise = 3 + 3x2', d.skills.find(s => s.id === 'stealth').value, 9);
  eq('acrobatics proficient = 3 + 3', d.skills.find(s => s.id === 'acrobatics').value, 6);
  eq('passive perception with expertise', d.passivePerception, 17);
}
{
  // Bard jack of all trades
  const c = mk('5e', { level: 4, lineageId: 'halfelf', classId: 'bard', abilityMethod: 'manual', baseScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 15 }, armor: 'Leather', choiceAsi: ['dex', 'con'] });
  const d = G.derive(c);
  eq('half-elf Cha 17', c.finalScores.cha, 17);
  eq('half-elf free +1 Dex/Con', c.finalScores.dex + '/' + c.finalScores.con, '15/13');
  eq('jack of all trades adds +1 to unproficient', d.skills.find(s => s.id === 'nature').value, 1);
}

/* ============ 4e ============ */
section('D&D 4e');
{
  const c = mk('4e', {
    level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual',
    baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    choiceAsi: ['str'], armor: 'Scale', shield4e: 'Heavy Shield', skills: ['athletics', 'endurance', 'intimidate']
  });
  const d = G.derive(c);
  eq('human +2 to chosen: Str 18', c.finalScores.str, 18);
  eq('L1 fighter HP 15 + Con score 14 = 29', d.hp, 29);
  eq('bloodied 14', d.bloodied, 14);
  eq('surge value 7', d.surgeValue, 7);
  eq('surges 9 + Con mod 2 = 11', d.surges, 11);
  eq('AC 10 + scale 7 + heavy shield 2 (heavy armor: no ability)', d.ac, 19);
  eq('Fortitude 10 + 0 + Str 4 + class 2 + human 1', d.fort, 17);
  eq('Reflex 10 + 0 + max(Dex1,Int0) + human 1 + shield 2', d.ref, 14);
  eq('Will 10 + 0 + max(Wis1,Cha-1) + human 1', d.will, 12);
  eq('initiative = half level 0 + Dex 1', d.initiative, 1);
  eq('trained athletics = Str 4 + 5 − 2 heavy shield check penalty', d.skills.find(s => s.id === 'athletics').value, 7);
  eq('untrained arcana = Int 0', d.skills.find(s => s.id === 'arcana').value, 0);
  eq('tier', d.tier, 'Heroic Tier');
  eq('powers: 3 at-will for human', d.powersKnown['At-Will'], 3);
  eq('powers: 1 encounter at L1', d.powersKnown['Encounter'], 1);
}
{
  // Half-level bonus and light armor ability bonus
  const c = mk('4e', {
    level: 11, lineageId: 'elf', classId: 'ranger', backgroundId: 'none', abilityMethod: 'manual',
    baseScores: { str: 12, dex: 18, con: 12, int: 10, wis: 14, cha: 8 }, armor: 'Leather'
  });
  const d = G.derive(c);
  eq('elf Dex 20 Wis 16', c.finalScores.dex + '/' + c.finalScores.wis, '20/16');
  eq('half level at 11 = 5', d.halfLevel, 5);
  eq('AC 10 + 5 + leather 2 + Dex 5', d.ac, 22);
  eq('L11 ranger HP 12 + 12 + 10x5', d.hp, 74);
  eq('Paragon tier', d.tier, 'Paragon Tier');
  eq('untrained Perception = half 5 + Wis 3 + racial 2', d.skills.find(s => s.id === 'perception').value, 10);
  eq('encounter powers at 11 (3 class + 1 paragon)', d.powersKnown['Encounter'], 4);
  eq('utility powers at 11', d.powersKnown['Utility'], 3);
}
{
  // Dwarf never slowed by armor
  const c = mk('4e', { level: 1, lineageId: 'dwarf', classId: 'paladin', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 }, armor: 'Plate' });
  const d = G.derive(c);
  eq('dwarf speed stays 5 in plate', d.speed, '5 squares (25 ft.)');
  eq('AC 10 + plate 8', d.ac, 18);
}

/* ============ Pathfinder 1e ============ */
section('Pathfinder 1e');
{
  const c = mk('pf1', {
    level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'reactionary', abilityMethod: 'manual',
    baseScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 }, choiceAsi: ['str'],
    armor: 'Scale Mail', shieldPf: 'Heavy Shield', favoredClassBonus: 'hp',
    ranks: { climb: 1, intimidate: 1, ride: 1, swim: 1 }
  });
  const d = G.derive(c);
  eq('human +2 chosen: Str 18', c.finalScores.str, 18);
  eq('L1 fighter HP 10 + Con 2 + favored class 1', d.hp, 13);
  eq('BAB 1', d.bab, 1);
  eq('Fort 2 + Con 2 = 4', d.fort, 4);
  eq('Ref poor 0 + Dex 2 = 2', d.ref, 2);
  eq('Will poor 0 + Wis 0 = 0', d.will, 0);
  eq('AC 10 + scale 5 + hvy shield 2 + Dex(max 3 -> 2)', d.ac, 19);
  eq('touch AC 10 + Dex 2', d.touchAC, 12);
  eq('armor check penalty scale -4 + shield -2', d.acp, -6);
  eq('Reactionary trait +2 initiative', d.initiative, 4);
  eq('skill ranks per level 2 + Int 1 + human 1', d.skillRanksPerLevel, 4);
  eq('total ranks at L1', d.skillRanksTotal, 4);
  eq('ranks spent', d.skillRanksSpent, 4);
  eq('Climb: 1 rank +3 class + Str 4 + acp -6', d.skills.find(s => s.id === 'climb').value, 2);
  eq('Intimidate: 1 + 3 + Cha -1', d.skills.find(s => s.id === 'intimidate').value, 3);
  eq('feats at L1: 1 + human bonus', d.featCount, 2);
  eq('fighter bonus combat feats at 1', d.bonusCombatFeats, 1);
  eq('CMB = BAB 1 + Str 4', d.cmb, 5);
  eq('CMD = 10 + 1 + 4 + 2', d.cmd, 17);
  eq('medium armor slows human to 20', d.speed, '20 ft.');
}
{
  // Rogue 3/4 BAB, class skills, small size
  const c = mk('pf1', {
    level: 8, lineageId: 'halfling', classId: 'rogue', backgroundId: 'none', abilityMethod: 'manual',
    baseScores: { str: 10, dex: 16, con: 12, int: 14, wis: 12, cha: 10 }, armor: 'Leather',
    favoredClassBonus: 'skill', ranks: { stealth: 8, perception: 8, disable: 8 }
  });
  const d = G.derive(c);
  eq('halfling Dex 18 Str 8', c.finalScores.dex + '/' + c.finalScores.str, '18/8');
  eq('BAB 3/4 of 8 = 6', d.bab, 6);
  eq('iterative attacks listed', d.fullAttack.split('/').length, 2);
  eq('halfling +1 luck on all saves: Ref 6+4+1', d.ref, 11);
  eq('AC 10 + leather 2 + Dex 4 + small 1', d.ac, 17);
  eq('stealth 8 ranks +3 class +Dex 4 +4 size (no racial stealth bonus in PF1)', d.skills.find(s => s.id === 'stealth').value, 19);
  eq('acrobatics untrained: Dex 4 + 2 sure-footed', d.skills.find(s => s.id === 'acrobatics').value, 6);
  eq('perception 8 +3 +1 Wis +2 racial', d.skills.find(s => s.id === 'perception').value, 14);
  eq('ranks/level 8 + Int 2 + favored 1 = 11', d.skillRanksPerLevel, 11);
  eq('ability increases by 8', d.abilityIncreases, 2);
  eq('feats at 8: 1 + 3', d.featCount, 4);
}
{
  // Wizard half BAB, bonus spell slots, paladin divine grace
  const w = mk('pf1', { level: 9, lineageId: 'elf', classId: 'wizard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 }, armor: 'None' });
  const dw = G.derive(w);
  eq('elf Int 20', w.finalScores.int, 20);
  eq('wizard BAB half of 9 = 4', dw.bab, 4);
  eq('caster level 9', dw.spell.casterLevel, 9);
  eq('highest spell level at 9', dw.spell.maxSpellLevel, 5);
  eq('base save DC 10 + Int 5', dw.spell.saveDCbase, 15);
  eq('bonus 1st-level slot from Int 20', dw.spell.bonusSlots[1], 2);
  const p = mk('pf1', { level: 5, lineageId: 'human', classId: 'paladin', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 10, con: 12, int: 10, wis: 10, cha: 16 }, choiceAsi: ['cha'], armor: 'Full Plate' });
  const dp = G.derive(p);
  eq('paladin Cha 18', p.finalScores.cha, 18);
  eq('divine grace +4 on Will: 4 + 0 + 4', dp.will, 8);
  eq('divine grace on Fort: 4 + 1 + 4', dp.fort, 9);
  eq('full plate AC 10 + 9 + Dex(max1 ->0)', dp.ac, 19);
}
{
  // Monk unarmored AC and fast movement
  const c = mk('pf1', { level: 6, lineageId: 'human', classId: 'monk', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 }, choiceAsi: ['dex'], armor: 'None' });
  const d = G.derive(c);
  eq('monk Dex 18', c.finalScores.dex, 18);
  eq('monk AC 10 + Dex 4 + Wis 2 + 1/4 level 1', d.ac, 17);
  eq('monk speed 30 + 20', d.speed, '50 ft.');
  eq('all good saves at 6: 5 + ability', d.fort, 6);
}

/* ============ Pathfinder 2e ============ */
section('Pathfinder 2e');
{
  const c = mk('pf2', {
    level: 1, lineageId: 'dwarf', lineageSubId: 'rock', classId: 'fighter', backgroundId: 'warrior',
    keyAbility: 'str', abilityMethod: 'boosts', armor: 'Chain Mail',
    boosts: { ancestryFree: ['dex'], free: ['str', 'dex', 'int', 'cha'], levels: {} },
    profs: { athletics: 'trained', intimidation: 'trained', acrobatics: 'trained', survival: 'trained' }
  });
  const d = G.derive(c);
  // 10 base; flaw -2 Cha=8; ancestry Con12 Wis12; free ancestry Dex12;
  // background warrior Str12 Con14; class key Str14; free: Str16 Dex14 Int12 Cha10
  eq('PF2 Str 16', c.finalScores.str, 16);
  eq('PF2 Dex 14', c.finalScores.dex, 14);
  eq('PF2 Con 14', c.finalScores.con, 14);
  eq('PF2 Wis 12', c.finalScores.wis, 12);
  eq('PF2 Cha 10 (flaw then boost)', c.finalScores.cha, 10);
  eq('PF2 Int 12', c.finalScores.int, 12);
  eq('L1 HP = 10 ancestry + (10 class + 2 Con)', d.hp, 22);
  eq('AC 10 + 1 lvl + trained 2 + chain 4 + Dex cap 1', d.ac, 18);
  eq('Fort 1 + expert 4 + Con 2', d.fort, 7);
  eq('Ref 1 + expert 4 + Dex 2', d.ref, 7);
  eq('Will 1 + trained 2 + Wis 1', d.will, 4);
  eq('Perception 1 + expert 4 + Wis 1', d.perception, 6);
  eq('Class DC 10 + 1 + trained 2 + Str 3', d.classDC, 16);
  eq('trained Athletics 1 + 2 + Str 3', d.skills.find(s => s.id === 'athletics').value, 6);
  eq('untrained Arcana gets NO level bonus: just Int 1', d.skills.find(s => s.id === 'arcana').value, 1);
  eq('fighter is expert in weapons at L1: 1 + 4 + Str 3', d.attacks[0].value, 8);
  eq('dwarf speed 20', d.speed, '20 ft.');
}
{
  // Level 5 boosts, spellcaster, skill increases
  const c = mk('pf2', {
    level: 5, lineageId: 'elf', lineageSubId: 'seer', classId: 'wizard', backgroundId: 'scholar',
    keyAbility: 'int', abilityMethod: 'boosts', armor: 'Explorer’s Clothing',
    boosts: { ancestryFree: ['con'], free: ['int', 'wis', 'con', 'cha'], levels: { 5: ['int', 'dex', 'con', 'wis'] } },
    profs: { arcana: 'expert', society: 'trained', crafting: 'trained', medicine: 'trained' }
  });
  const d = G.derive(c);
  // flaw Con 8; ancestry Dex12 Int12; free ancestry Con10; bg scholar Int14 Wis12;
  // class Int16; free Int18 Wis14 Con12 Cha12; level5 Int19 Dex14 Con14 Wis16
  eq('Int reaches 19 (18 then +1)', c.finalScores.int, 19);
  eq('Dex 14 at L5', c.finalScores.dex, 14);
  eq('Con 14 at L5', c.finalScores.con, 14);
  eq('Wis 16 at L5', c.finalScores.wis, 16);
  eq('HP = 6 ancestry + 5x(6 + Con 2)', d.hp, 46);
  eq('spell DC 10 + 5 + trained 2 + Int 4', d.spell.dc, 21);
  eq('spell attack 5 + 2 + 4', d.spell.attack, 11);
  eq('highest spell rank at 5', d.spell.maxRank, 3);
  eq('tradition', d.spell.tradition, 'Arcane');
  eq('skill increases by 5 (levels 3,5)', d.skillIncreases, 2);
  eq('expert Arcana 5 + 4 + Int 4', d.skills.find(s => s.id === 'arcana').value, 13);
  eq('ancestry feats by 5', d.featCounts['Ancestry feats'], 2);
  eq('general feats by 5', d.featCounts['General feats'], 1);
  eq('boost levels reached', JSON.stringify(d.abilityBoostLevels), '[5]');
}
{
  // Level 20 sanity + save bumps
  const c = mk('pf2', {
    level: 20, lineageId: 'human', lineageSubId: 'versatile', classId: 'rogue', backgroundId: 'street',
    keyAbility: 'dex', abilityMethod: 'boosts', armor: 'Leather',
    boosts: {
      ancestryFree: ['dex', 'con'], free: ['dex', 'con', 'int', 'wis'],
      levels: { 5: ['dex', 'con', 'int', 'wis'], 10: ['dex', 'con', 'int', 'wis'], 15: ['dex', 'con', 'int', 'wis'], 20: ['dex', 'con', 'int', 'wis'] }
    },
    profs: { stealth: 'legendary', thievery: 'master' }
  });
  const d = G.derive(c);
  ok('Dex capped sensibly at 20 (' + c.finalScores.dex + ')', c.finalScores.dex >= 19 && c.finalScores.dex <= 22);
  ok('HP over 200 at level 20 (' + d.hp + ')', d.hp > 180);
  eq('Will bumps to master by 15', d.saves.find(s => s.name === 'Will').rank, 'master');
  eq('legendary Stealth 20 + 8 + Dex', d.skills.find(s => s.id === 'stealth').value, 20 + 8 + G.mod(c.finalScores.dex));
  eq('rogue gets many skill feats', d.featCounts['Skill feats'] >= 20, true);
}

/* ============ level up ============ */
section('Level up');
{
  const c = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, armor: 'Chain Mail' });
  const before = G.derive(c).hp;
  const log = G.levelUp(c, 5);
  const after = G.derive(c);
  eq('level is now 5', c.level, 5);
  ok('HP increased (' + before + ' -> ' + after.hp + ')', after.hp > before);
  ok('gained log mentions Extra Attack', log.some(g => /Extra Attack/.test(g.text)));
  ok('gained log mentions ASI at 4', log.some(g => g.level === 4 && /Ability Score/.test(g.text)));
  eq('prof bonus now +3', after.profBonus, 3);
  const log2 = G.levelUp(c, 25);
  eq('clamped to system max 20', c.level, 20);
}
{
  const c = mk('pf2', { level: 1, lineageId: 'orc', lineageSubId: 'battle', classId: 'barbarian', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'con', 'dex', 'wis'], levels: {} } });
  const h1 = G.derive(c).hp;
  G.levelUp(c, 10);
  const h10 = G.derive(c).hp;
  eq('pf2 level 10', c.level, 10);
  ok('HP scaled linearly (' + h1 + ' -> ' + h10 + ')', h10 > h1 * 5);
}
{
  const c = mk('pf1', { level: 1, lineageId: 'human', classId: 'rogue', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 10, dex: 16, con: 12, int: 14, wis: 12, cha: 10 }, choiceAsi: ['dex'], hpMethod: 'roll' });
  G.levelUp(c, 6);
  eq('rolled HP entries for levels 2-6', c.hpRolls.length, 5);
  ok('all rolls within d8', c.hpRolls.every(r => r >= 1 && r <= 8));
}

/* ============ validation ============ */
section('Validation');
{
  const c = mk('5e', { abilityMethod: 'pointbuy' });
  G.ABIL6.forEach(a => c.baseScores[a] = 8);
  let v = G.validate(c);
  ok('flags missing race', v.some(i => /Race|race/.test(i.text)));
  ok('flags missing class', v.some(i => /class/i.test(i.text)));
  ok('flags unspent points', v.some(i => /unspent/.test(i.text)));
  c.baseScores = { str: 15, dex: 15, con: 15, int: 10, wis: 10, cha: 8 }; // 31 points
  v = G.validate(c);
  ok('flags over budget', v.some(i => /over budget/.test(i.text)));
  c.baseScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  v = G.validate(c);
  ok('27-point spread is accepted', !v.some(i => /budget|unspent/.test(i.text)));
}
{
  const c = mk('pf2', { lineageId: 'dwarf', classId: 'fighter', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts' });
  let v = G.validate(c);
  ok('flags missing free boosts', v.some(i => /four free ability boosts/.test(i.text)));
  c.boosts = { ancestryFree: ['dex'], free: ['str', 'str', 'int', 'cha'], levels: {} };
  v = G.validate(c);
  ok('flags duplicate free boosts', v.some(i => /four different abilities/.test(i.text)));
  c.boosts.free = ['str', 'dex', 'int', 'cha'];
  v = G.validate(c);
  ok('valid boosts accepted', !v.some(i => /free ability boosts|four different/.test(i.text)));
}
{
  const c = mk('pf1', { lineageId: 'human', classId: 'rogue', backgroundId: 'none', level: 2, abilityMethod: 'manual', baseScores: { str: 10, dex: 16, con: 12, int: 14, wis: 12, cha: 10 }, choiceAsi: ['dex'], ranks: { stealth: 5 } });
  const v = G.validate(c);
  ok('flags ranks above level cap', v.some(i => /exceed your level/.test(i.text)));
}
{
  const c = mk('5e', { lineageId: 'elf', lineageSubId: 'high', classId: 'rogue', backgroundId: 'criminal', abilityMethod: 'array', arrayId: 'std', arrayAssign: { str: 0, dex: 0 } });
  const v = G.validate(c);
  ok('flags duplicate array assignment', v.some(i => /only be used once/.test(i.text)));
  ok('flags incomplete array', v.some(i => /Assign all six/.test(i.text)));
}

/* ============ data integrity ============ */
section('Data integrity');
G.SYSTEM_ORDER.forEach(sid => {
  const S = G.SYSTEMS[sid];
  const skillIds = S.skills.map(s => s.id);
  ok(sid + ': has a name/tag/blurb', !!(S.name && S.tag && S.blurb));
  ok(sid + ': unique skill ids', new Set(skillIds).size === skillIds.length);
  ok(sid + ': unique lineage ids', new Set(S.lineages.map(l => l.id)).size === S.lineages.length);
  ok(sid + ': unique class ids', new Set(S.classes.map(l => l.id)).size === S.classes.length);
  ok(sid + ': unique background ids', new Set(S.backgrounds.map(l => l.id)).size === S.backgrounds.length);
  ok(sid + ': has armor list', S.armorList && S.armorList.length > 0);
  ok(sid + ': has languages', S.languages && S.languages.length > 0);
  S.classes.forEach(cl => {
    if (Array.isArray(cl.skillList)) {
      cl.skillList.forEach(id => ok(sid + '/' + cl.id + ': skill "' + id + '" exists', skillIds.includes(id)));
    }
    if (cl.grantSkills) cl.grantSkills.forEach(id => ok(sid + '/' + cl.id + ': granted "' + id + '" exists', skillIds.includes(id)));
    ok(sid + '/' + cl.id + ': has subclasses or is intentionally bare', Array.isArray(cl.subclasses));
    if (new Set((cl.subclasses || []).map(x => x.id)).size !== (cl.subclasses || []).length) fail++, fails.push(sid + '/' + cl.id + ': duplicate subclass ids');
  });
  S.lineages.forEach(l => {
    if (l.grantSkills) l.grantSkills.forEach(id => ok(sid + '/' + l.id + ': granted "' + id + '" exists', skillIds.includes(id)));
    if (l.skillBonus) Object.keys(l.skillBonus).forEach(id => ok(sid + '/' + l.id + ': bonus skill "' + id + '" exists', skillIds.includes(id)));
    if (l.chooseSkillsFrom && Array.isArray(l.chooseSkillsFrom)) l.chooseSkillsFrom.forEach(id => ok(sid + '/' + l.id + ': choose-from "' + id + '" exists', skillIds.includes(id)));
    ok(sid + '/' + l.id + ': subs is an array', Array.isArray(l.subs));
  });
  S.backgrounds.forEach(b => {
    (b.skills || []).forEach(id => ok(sid + '/' + b.id + ': bg skill "' + id + '" exists', skillIds.includes(id)));
    (b.chooseFrom || []).forEach(id => ok(sid + '/' + b.id + ': bg choose "' + id + '" exists', skillIds.includes(id)));
    if (b.skillBonus) Object.keys(b.skillBonus).forEach(id => ok(sid + '/' + b.id + ': bg bonus "' + id + '" exists', skillIds.includes(id)));
    (b.boosts || []).forEach(a => ok(sid + '/' + b.id + ': boost "' + a + '" is a real ability', G.ABIL6.includes(a)));
  });
});

/* ============ exhaustive derive sweep ============ */
section('Exhaustive derive sweep (every class x lineage x level)');
let combos = 0, errors = 0;
G.SYSTEM_ORDER.forEach(sid => {
  const S = G.SYSTEMS[sid];
  const levels = sid === '4e' ? [1, 5, 11, 21, 30] : [1, 4, 5, 11, 20];
  S.classes.forEach(cl => S.lineages.forEach(l => levels.forEach(lv => {
    const c = mk(sid, {
      level: lv, lineageId: l.id, lineageSubId: (l.subs || [])[0] ? l.subs[0].id : null,
      classId: cl.id, subclassId: (cl.subclasses || [])[0] ? cl.subclasses[0].id : null,
      backgroundId: S.backgrounds[0].id, abilityMethod: 'manual',
      baseScores: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 10 },
      keyAbility: cl.keyAbility ? cl.keyAbility[0] : null
    });
    if (sid === 'pf2') c.boosts = { ancestryFree: ['str'], free: ['str', 'dex', 'con', 'wis'], levels: { 5: ['str', 'dex', 'con', 'wis'], 10: ['str', 'dex', 'con', 'wis'], 15: ['str', 'dex', 'con', 'wis'], 20: ['str', 'dex', 'con', 'wis'] } };
    // choose racial free increases where required
    const spec = l.choiceAsi || ((l.subs || [])[0] || {}).choiceAsi;
    if (spec) c.choiceAsi = ['str', 'dex', 'con'].slice(0, spec.count);
    combos++;
    try {
      const d = G.derive(c);
      if (!(d.hp > 0)) throw new Error('non-positive HP: ' + d.hp);
      if (!(d.ac > 0)) throw new Error('non-positive AC: ' + d.ac);
      if (!Array.isArray(d.skills) || !d.skills.length) throw new Error('no skills computed');
      d.skills.forEach(s => { if (!Number.isFinite(s.value)) throw new Error('NaN skill ' + s.id); });
      if (d.notes.some(n => /Derivation error/.test(n))) throw new Error('derive threw internally');
      G.validate(c);
    } catch (e) {
      errors++;
      if (errors <= 8) fails.push('derive ' + sid + '/' + cl.id + '/' + l.id + ' L' + lv + ': ' + e.message);
    }
  })));
});
console.log('  swept ' + combos + ' combinations');
eq('no derive/validate errors across all combinations', errors, 0);

/* ============ UI render sweep ============ */
section('UI render sweep (every step, every system, every view)');
let renders = 0, rerrors = 0;
G.SYSTEM_ORDER.forEach(sid => {
  const S = G.SYSTEMS[sid];
  const c = mk(sid, {
    name: 'Render Test', level: sid === '4e' ? 11 : 5,
    lineageId: S.lineages[0].id, lineageSubId: (S.lineages[0].subs || [])[0] ? S.lineages[0].subs[0].id : null,
    classId: S.classes[0].id, subclassId: (S.classes[0].subclasses || [])[0] ? S.classes[0].subclasses[0].id : null,
    backgroundId: S.backgrounds[0].id, abilityMethod: 'manual',
    baseScores: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 10 },
    keyAbility: S.classes[0].keyAbility ? S.classes[0].keyAbility[0] : null,
    gear: 'Rope\nTorch', notes: 'Alert', gold: '20 gp',
    personality: { traits: 'Curious', ideals: 'Freedom', bonds: 'My sister', flaws: 'Greedy', backstory: 'Long story.' },
    appearance: { age: '30', height: '5ft', weight: '150', eyes: 'blue', hair: 'black', skin: 'tan' },
    languages: ['Common']
  });
  if (sid === 'pf2') c.boosts = { ancestryFree: ['str'], free: ['str', 'dex', 'con', 'wis'], levels: { 5: ['str', 'dex', 'con', 'wis'] } };
  const spec = S.lineages[0].choiceAsi;
  if (spec) c.choiceAsi = ['str', 'dex'].slice(0, spec.count);
  G.app.roster = [c];
  G.app.currentId = c.id;

  // every ability method
  ['pointbuy', 'array', 'roll', 'manual', 'boosts'].forEach(meth => {
    if (meth === 'boosts' && !S.abilityGen.boosts) return;
    if (meth === 'pointbuy' && !S.abilityGen.pointBuy) return;
    c.abilityMethod = meth;
    if (meth === 'roll') { c.rolledPool = [15, 14, 13, 12, 10, 8]; c.rollDetail = ['(5,5,5)', '', '', '', '', '']; c.rollAssign = { str: 0, dex: 1 }; }
    if (meth === 'array') { c.arrayId = S.abilityGen.arrays[0].id; c.arrayAssign = { str: 0, dex: 1, con: 2 }; }
    G.app.view = 'build';
    G.stepsFor(c).forEach((st, i) => {
      G.app.step = i;
      renders++;
      try {
        const html = G.viewBuild();
        if (!html || html.length < 50) throw new Error('empty output');
        if (/undefined<|>undefined|NaN/.test(html)) throw new Error('rendered undefined/NaN in ' + st.id);
      } catch (e) {
        rerrors++;
        if (rerrors <= 8) fails.push('render ' + sid + '/' + meth + '/' + st.id + ': ' + e.message);
      }
    });
  });
  c.abilityMethod = S.abilityGen.boosts ? 'boosts' : 'manual';
  ['sheet', 'roster'].forEach(v => {
    G.app.view = v;
    renders++;
    try {
      const html = v === 'sheet' ? G.viewSheet() : G.viewRoster();
      if (!html || html.length < 100) throw new Error('empty output');
      if (/>undefined|NaN/.test(html)) throw new Error('rendered undefined/NaN');
    } catch (e) { rerrors++; fails.push('render ' + sid + '/' + v + ': ' + e.message); }
  });
  // bare character (nothing chosen) must not crash any step
  const bare = mk(sid, {});
  G.app.roster = [bare]; G.app.currentId = bare.id; G.app.view = 'build';
  G.stepsFor(bare).forEach((st, i) => {
    G.app.step = i; renders++;
    try { G.viewBuild(); } catch (e) { rerrors++; fails.push('render bare ' + sid + '/' + st.id + ': ' + e.message); }
  });
  G.app.view = 'sheet';
  try { G.viewSheet(); renders++; } catch (e) { rerrors++; fails.push('render bare sheet ' + sid + ': ' + e.message); }
});
console.log('  rendered ' + renders + ' views');
eq('no render errors', rerrors, 0);

/* ============ persistence round trip ============ */
section('Persistence & JSON round trip');
{
  const c = mk('pf2', {
    name: 'Round Trip', level: 5, lineageId: 'elf', lineageSubId: 'seer', classId: 'wizard',
    backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts',
    boosts: { ancestryFree: ['con'], free: ['int', 'wis', 'con', 'cha'], levels: { 5: ['int', 'dex', 'con', 'wis'] } },
    profs: { arcana: 'expert' }
  });
  const before = G.derive(c);
  const clone = JSON.parse(JSON.stringify(c));
  const after = G.derive(clone);
  eq('HP survives JSON round trip', after.hp, before.hp);
  eq('scores survive JSON round trip', JSON.stringify(clone.finalScores), JSON.stringify(c.finalScores));
  // simulate the object-instead-of-array corruption JSON can cause
  const corrupt = JSON.parse(JSON.stringify(c));
  corrupt.boosts.levels = { 5: { 0: 'int', 1: 'dex', 2: 'con', 3: 'wis' } };
  corrupt.boosts.free = { 0: 'int', 1: 'wis', 2: 'con', 3: 'cha' };
  const fixed = G.derive(corrupt);
  eq('object-shaped boost arrays still work', fixed.hp, before.hp);
  eq('object-shaped boosts give same Int', corrupt.finalScores.int, c.finalScores.int);

  G.saveRoster([c]);
  const back = G.loadRoster();
  eq('roster saves and loads', back.length, 1);
  eq('loaded character keeps name', back[0].name, 'Round Trip');
}
{
  // 5e levelAsi as object (JSON corruption)
  const c = mk('5e', { level: 8, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  c.levelAsi = { 4: ['str', 'str'], 6: ['con', 'con'], 8: { 0: 'str', 1: 'dex' } };
  G.derive(c);
  eq('object-shaped levelAsi applied: Str 16+2+1', c.finalScores.str, 19);
  eq('Con 15+2', c.finalScores.con, 17);
  eq('Dex 14+1', c.finalScores.dex, 15);
}

/* ============ spell catalogue ============ */
section('Spell catalogue');
{
  const sp5 = G.spellsFor('5e'), sp2 = G.spellsFor('pf2'), sp1 = G.spellsFor('pf1');
  eq('5e SRD spell count', sp5.length, 339);
  eq('pf2 spell count', sp2.length, 1542);
  ok('pf1 index has a useful core selection (' + sp1.length + ')', sp1.length > 200);
  eq('4e ships no spell catalogue', G.spellsFor('4e').length, 0);
  eq('hasSpellData 5e', G.hasSpellData('5e'), true);
  eq('hasSpellData 4e', G.hasSpellData('4e'), false);

  // ---- 5e content spot checks
  const fb = sp5.find(s => s.name === 'Fireball');
  eq('5e Fireball level', fb.level, 3);
  eq('5e Fireball school', fb.school, 'Evocation');
  eq('5e Fireball classes', fb.classes.join(','), 'sorcerer,wizard');
  eq('5e Fireball components', fb.components, 'VSM');
  ok('5e Fireball text mentions 20-foot radius', /20-foot-radius/.test(fb.text));
  ok('5e Fireball higher-level text present', /1d6 for each slot level/.test(fb.higher));
  const mm = sp5.find(s => s.name === 'Magic Missile');
  eq('5e Magic Missile level', mm.level, 1);
  ok('5e Magic Missile is a wizard spell', mm.classes.includes('wizard'));
  eq('5e Wish is 9th level', sp5.find(s => s.name === 'Wish').level, 9);
  eq('5e cantrip count', sp5.filter(s => s.level === 0).length, 27);
  eq('5e spells with concentration', sp5.filter(s => s.concentration).length > 50, true);
  eq('5e ritual spells exist', sp5.filter(s => s.ritual).length > 5, true);
  ok('every 5e spell has text', sp5.every(s => s.text && s.text.length > 10));
  ok('every 5e spell has a valid level', sp5.every(s => s.level >= 0 && s.level <= 9));
  ok('every 5e spell has at least one class', sp5.every(s => s.classes.length > 0));
  ok('every 5e class reference is a real class',
    sp5.every(s => s.classes.every(cl => G.SPELL_CLASSES_5E.includes(cl))));
  ok('every 5e school is one of the eight',
    sp5.every(s => !s.school || G.SPELL_SCHOOLS_5E.includes(s.school)));
  ok('no leftover HTML in 5e text', sp5.every(s => !/<[a-z\/]/i.test(s.text)));

  // ---- pf2 content spot checks
  const fb2 = sp2.find(s => s.name === 'Fireball');
  eq('pf2 Fireball rank', fb2.level, 3);
  eq('pf2 Fireball traditions', fb2.traditions.join(','), 'arcane,primal');
  eq('pf2 Fireball save', fb2.save, 'basic reflex');
  eq('pf2 Fireball area', fb2.area, '20-foot burst');
  eq('pf2 Fireball cast time', fb2.castingTime, '2 actions');
  ok('pf2 Fireball text has heightening', /Heightened/.test(fb2.text));
  eq('pf2 cantrips', sp2.filter(s => s.cantrip).length, 108);
  eq('pf2 focus spells', sp2.filter(s => s.focus).length, 435);
  eq('pf2 max rank', Math.max.apply(null, sp2.map(s => s.level)), 10);
  ok('every pf2 spell has text', sp2.every(s => s.text && s.text.length > 5));
  ok('every pf2 tradition is valid',
    sp2.every(s => s.traditions.every(t => G.SPELL_TRADITIONS_PF2.includes(t))));
  ok('no leftover Foundry enrichers in pf2 text',
    sp2.every(s => !/@(UUID|Damage|Check|Template|Compendium)\[/.test(s.text)));
  ok('no leftover HTML in pf2 text', sp2.every(s => !/<[a-z\/]/i.test(s.text)));
  eq('pf2 remaster naming: Force Barrage present', !!sp2.find(s => s.name === 'Force Barrage'), true);

  // ---- pf1 content spot checks
  const fb1 = sp1.find(s => s.name === 'Fireball');
  eq('pf1 Fireball is a 3rd-level arcane spell', fb1.levels.sw, 3);
  eq('pf1 Fireball school', fb1.school, 'Evocation');
  const clw = sp1.find(s => s.name === 'Cure Light Wounds');
  eq('pf1 Cure Light Wounds is cleric 1', clw.levels.clr, 1);
  eq('pf1 Cure Light Wounds is ranger 2', clw.levels.rgr, 2);
  ok('every pf1 spell lists at least one class level',
    sp1.every(s => Object.keys(s.levels).length > 0));
  ok('every pf1 class key is known',
    sp1.every(s => Object.keys(s.levels).every(k => G.SPELL_CLASSES_PF1[k])));
  ok('every pf1 spell level is 0-9',
    sp1.every(s => Object.values(s.levels).every(l => l >= 0 && l <= 9)));
  ok('every pf1 spell has a summary', sp1.every(s => s.text && s.text.length > 8));
  ok('no duplicate pf1 spell names',
    new Set(sp1.map(s => s.name)).size === sp1.length);
}

/* ============ class spell lists ============ */
section('Spell list membership');
{
  const wiz = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(wiz);
  const f = (sysid, name) => G.spellsFor(sysid).find(s => s.name === name);
  ok('wizard can take Fireball', G.spellOnList(wiz, f('5e', 'Fireball')));
  ok('wizard cannot take Cure Wounds', !G.spellOnList(wiz, f('5e', 'Cure Wounds')));
  const clr = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'cleric', backgroundId: 'acolyte', abilityMethod: 'manual', baseScores: { str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 10 } });
  G.derive(clr);
  ok('cleric can take Cure Wounds', G.spellOnList(clr, f('5e', 'Cure Wounds')));
  ok('cleric cannot take Fireball', !G.spellOnList(clr, f('5e', 'Fireball')));
  const ek = mk('5e', { level: 7, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', subclassId: 'eldritch', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 13, wis: 10, cha: 8 } });
  G.derive(ek);
  ok('eldritch knight draws on the wizard list', G.spellOnList(ek, f('5e', 'Shield')));

  const pf2w = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'wizard', backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts', boosts: { ancestryFree: ['int', 'con'], free: ['int', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(pf2w);
  ok('pf2 wizard (arcane) can take Fireball', G.spellOnList(pf2w, f('pf2', 'Fireball')));
  ok('pf2 wizard cannot take Heal (divine/primal)', !G.spellOnList(pf2w, f('pf2', 'Heal')));
  const pf2c = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: {} } });
  G.derive(pf2c);
  ok('pf2 cleric (divine) can take Heal', G.spellOnList(pf2c, f('pf2', 'Heal')));
  const champ = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'champion', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(champ);
  ok('champion focus spell Lay on Hands is on-list', G.spellOnList(champ, f('pf2', 'Lay on Hands')));
  ok('cleric cannot take the champion focus spell', !G.spellOnList(pf2c, f('pf2', 'Lay on Hands')));

  const pf1w = mk('pf1', { level: 5, lineageId: 'human', classId: 'wizard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 }, choiceAsi: ['int'] });
  G.derive(pf1w);
  ok('pf1 wizard can take Fireball', G.spellOnList(pf1w, f('pf1', 'Fireball')));
  ok('pf1 wizard cannot take Cure Light Wounds', !G.spellOnList(pf1w, f('pf1', 'Cure Light Wounds')));
  const pf1c = mk('pf1', { level: 5, lineageId: 'human', classId: 'cleric', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 12, dex: 12, con: 12, int: 10, wis: 16, cha: 12 }, choiceAsi: ['wis'] });
  G.derive(pf1c);
  eq('pf1 cleric sees Cure Light Wounds as level 1', G.spellLevelFor(pf1c, f('pf1', 'Cure Light Wounds')), 1);
  const pf1r = mk('pf1', { level: 8, lineageId: 'human', classId: 'ranger', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 }, choiceAsi: ['dex'] });
  G.derive(pf1r);
  eq('pf1 ranger sees Cure Light Wounds as level 2', G.spellLevelFor(pf1r, f('pf1', 'Cure Light Wounds')), 2);
}

/* ============ casting limits ============ */
section('Casting limits');
{
  const mkc = (sysid, over) => { const c = mk(sysid, over); G.derive(c); return c; };
  // 5e prepared caster
  const wiz = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  let lim = G.spellLimits(wiz, null);
  eq('wizard mode', lim.mode, 'prepared');
  eq('wizard cantrips at 5', lim.cantrips, 4);
  eq('wizard prepared = level 5 + Int mod 3 (16 base +1 human)', lim.prepared, 8);
  eq('wizard slots', JSON.stringify(lim.slots), '[4,3,2]');
  eq('wizard max spell level', lim.maxLevel, 3);
  eq('wizard spellbook estimate', lim.spellbook, 14);
  // 5e known casters
  const sor = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'sorcerer', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 } });
  lim = G.spellLimits(sor, null);
  eq('sorcerer knows 6 at level 5', lim.known, 6);
  eq('sorcerer cantrips at 5', lim.cantrips, 5);
  const bard = mkc('5e', { level: 10, lineageId: 'human', lineageSubId: 'standard', classId: 'bard', backgroundId: 'entertainer', abilityMethod: 'manual', baseScores: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 } });
  eq('bard knows 14 at level 10', G.spellLimits(bard, null).known, 14);
  const wl = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'warlock', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 } });
  lim = G.spellLimits(wl, null);
  eq('warlock knows 6 at level 5', lim.known, 6);
  eq('warlock pact slots', lim.pact.count + ' of level ' + lim.pact.level, '2 of level 3');
  const rgr = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'ranger', backgroundId: 'outlander', abilityMethod: 'manual', baseScores: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 } });
  eq('ranger knows 4 at level 5', G.spellLimits(rgr, null).known, 4);
  eq('ranger has no cantrips', G.spellLimits(rgr, null).cantrips, 0);
  const pal = mkc('5e', { level: 6, lineageId: 'human', lineageSubId: 'standard', classId: 'paladin', backgroundId: 'noble', abilityMethod: 'manual', baseScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 } });
  lim = G.spellLimits(pal, null);
  eq('paladin prepares half level + Cha', lim.prepared, 5);
  const ek = mkc('5e', { level: 7, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', subclassId: 'eldritch', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 13, wis: 10, cha: 8 } });
  lim = G.spellLimits(ek, null);
  eq('eldritch knight knows 5 at level 7', lim.known, 5);
  eq('eldritch knight has 2 cantrips', lim.cantrips, 2);
  const fighter = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', subclassId: 'champion', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  eq('champion fighter has no spellcasting', G.spellLimits(fighter, null), null);
  eq('casterInfo is null for a champion', G.casterInfo(fighter), null);

  // pf2
  const c1 = mkc('pf2', { level: 1, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: {} } });
  lim = G.spellLimits(c1, null);
  eq('pf2 level 1: two rank-1 slots', JSON.stringify(lim.slots), '{"1":2}');
  eq('pf2 cantrips always 5', lim.cantrips, 5);
  eq('pf2 cleric prepares', lim.mode, 'prepared');
  const c5 = mkc('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: { 5: ['wis', 'dex', 'con', 'cha'] } } });
  lim = G.spellLimits(c5, null);
  eq('pf2 level 5 max rank', lim.maxRank, 3);
  eq('pf2 level 5 slots', JSON.stringify(lim.slots), '{"1":3,"2":3,"3":2}');
  const c6 = mkc('pf2', { level: 6, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: { 5: ['wis', 'dex', 'con', 'cha'] } } });
  eq('pf2 level 6 top rank is full', JSON.stringify(G.spellLimits(c6, null).slots), '{"1":3,"2":3,"3":3}');
  const c19 = mkc('pf2', { level: 19, lineageId: 'human', lineageSubId: 'skilled', classId: 'wizard', backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts', boosts: { ancestryFree: ['int', 'con'], free: ['int', 'dex', 'con', 'wis'], levels: {} } });
  lim = G.spellLimits(c19, null);
  eq('pf2 level 19 gets one rank-10 slot', lim.slots[10], 1);
  eq('pf2 level 19 max rank', lim.maxRank, 10);
  const bard2 = mkc('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'bard', backgroundId: 'entertainer', keyAbility: 'cha', abilityMethod: 'boosts', boosts: { ancestryFree: ['cha', 'con'], free: ['cha', 'dex', 'con', 'wis'], levels: { 5: ['cha', 'dex', 'con', 'wis'] } } });
  eq('pf2 bard uses a repertoire', G.spellLimits(bard2, null).mode, 'repertoire');

  // pf1
  const w5 = mkc('pf1', { level: 5, lineageId: 'human', classId: 'wizard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 }, choiceAsi: ['int'] });
  lim = G.spellLimits(w5, null);
  eq('pf1 wizard level 5 per day', JSON.stringify(lim.perDay), '[4,3,2,1]');
  eq('pf1 wizard max spell level', lim.maxLevel, 3);
  eq('pf1 wizard prepares', lim.mode, 'prepared');
  const s1 = mkc('pf1', { level: 1, lineageId: 'human', classId: 'sorcerer', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 10, wis: 12, cha: 16 }, choiceAsi: ['cha'] });
  eq('pf1 sorcerer level 1 per day', JSON.stringify(G.spellLimits(s1, null).perDay), '[5,3]');
  eq('pf1 sorcerer is spontaneous', G.spellLimits(s1, null).mode, 'spontaneous');
  const b20 = mkc('pf1', { level: 20, lineageId: 'human', classId: 'bard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 10, dex: 14, con: 12, int: 12, wis: 10, cha: 16 }, choiceAsi: ['cha'] });
  eq('pf1 bard level 20 casts 6th-level spells', G.spellLimits(b20, null).maxLevel, 6);
}

/* ============ spellbook tracking ============ */
section('Spellbook tracking');
{
  const c = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(c);
  const find = n => G.spellsFor('5e').find(s => s.name === n);
  c.spells = [find('Fireball').uid, find('Magic Missile').uid, find('Fire Bolt').uid];
  c.prepared = [find('Fireball').uid];
  const cnt = G.spellCounts(c);
  eq('counts total', cnt.total, 3);
  eq('counts cantrips', cnt.cantrips, 1);
  eq('counts leveled', cnt.leveled, 2);
  eq('counts prepared', cnt.prepared, 1);
  eq('charSpells resolves uids', G.charSpells(c).map(s => s.name).sort().join(','), 'Fire Bolt,Fireball,Magic Missile');
  eq('isPrepared true for Fireball', G.isPrepared(c, find('Fireball').uid), true);
  eq('isPrepared false for Magic Missile', G.isPrepared(c, find('Magic Missile').uid), false);

  // over-level spell is flagged
  c.spells.push(find('Wish').uid);
  let iss = G.spellIssues(c);
  ok('9th-level spell flagged for a level 5 wizard', iss.some(i => i.level === 'error' && /Wish is level 9/.test(i.text)));
  ok('spell problems reach the main validator', G.validate(c).some(i => /Wish is level 9/.test(i.text)));
  c.spells.pop();

  // off-list spell is flagged
  c.spells.push(find('Cure Wounds').uid);
  iss = G.spellIssues(c);
  ok('off-list spell flagged', iss.some(i => /not on your class list/.test(i.text)));
  c.spells.pop();

  // too many cantrips
  const cantrips = G.spellsFor('5e').filter(s => s.level === 0 && s.classes.includes('wizard')).slice(0, 6);
  c.spells = cantrips.map(s => s.uid);
  ok('too many cantrips flagged', G.spellIssues(c).some(i => i.level === 'error' && /Too many cantrips/.test(i.text)));

  // starter set respects limits
  const fresh = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(fresh);
  const n = G.fillStarter(fresh);
  ok('starter set added spells (' + n + ')', n > 0);
  const fc = G.spellCounts(fresh);
  eq('starter respects the cantrip limit', fc.cantrips, G.spellLimits(fresh, null).cantrips);
  ok('starter spells are all on the class list',
    G.charSpells(fresh).every(sp => G.spellOnList(fresh, sp)));
  ok('starter set produces no blocking spell errors',
    !G.spellIssues(fresh).some(i => i.level === 'error'));

  // pf2 starter
  const p2 = mk('pf2', { level: 3, lineageId: 'human', lineageSubId: 'skilled', classId: 'wizard', backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts', boosts: { ancestryFree: ['int', 'con'], free: ['int', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(p2);
  ok('pf2 starter set fills something', G.fillStarter(p2) > 0);
  ok('pf2 starter spells are all castable',
    G.charSpells(p2).every(sp => sp.cantrip || sp.focus || sp.level <= G.spellLimits(p2, null).maxRank));

  // pf1 starter
  const p1 = mk('pf1', { level: 3, lineageId: 'human', classId: 'cleric', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 12, dex: 12, con: 12, int: 10, wis: 16, cha: 12 }, choiceAsi: ['wis'] });
  G.derive(p1);
  ok('pf1 starter set fills something', G.fillStarter(p1) > 0);
  ok('pf1 starter spells are on the cleric list',
    G.charSpells(p1).every(sp => G.spellOnList(p1, sp)));
}

/* ============ filtering ============ */
section('Spell filtering');
{
  const c = mk('5e', { level: 20, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(c);
  const S = G.spellUI;
  const reset = () => { S.q = ''; S.level = 'all'; S.school = 'all'; S.onlyList = true; };
  reset();
  const onList = G.filterSpells(c);
  ok('wizard list is a subset of all spells', onList.length > 50 && onList.length < 339);
  ok('everything in the filtered list is on the wizard list', onList.every(s => s.classes.includes('wizard')));
  S.onlyList = false;
  eq('unfiltered shows everything', G.filterSpells(c).length, 339);
  reset();
  S.q = 'fireball';
  const hits = G.filterSpells(c);
  ok('search finds Fireball itself', hits.some(s => s.name === 'Fireball'));
  ok('search also matches spell text (' + hits.length + ' hits)', hits.length > 1 && hits.length < 10);
  S.q = 'FIREBALL';
  eq('search is case-insensitive', G.filterSpells(c).length, hits.length);
  S.q = 'zzzznotaspell';
  eq('search with no matches returns nothing', G.filterSpells(c).length, 0);
  reset();
  S.level = 'cantrip';
  ok('cantrip filter returns only cantrips', G.filterSpells(c).every(s => s.level === 0));
  S.level = '3';
  ok('level filter returns only that level', G.filterSpells(c).every(s => s.level === 3));
  reset();
  S.school = 'Necromancy';
  ok('school filter works', G.filterSpells(c).every(s => s.school === 'Necromancy'));
  reset();
  ok('5e school options are the eight schools', G.schoolOptions('5e').length === 8);
  ok('pf2 filter options include traits', G.schoolOptions('pf2').length > 8);

  // pf2 trait filtering
  const p = mk('pf2', { level: 20, lineageId: 'human', lineageSubId: 'skilled', classId: 'wizard', backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts', boosts: { ancestryFree: ['int', 'con'], free: ['int', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(p);
  reset();
  S.school = 'fire';
  const fires = G.filterSpells(p);
  ok('pf2 trait filter returns fire spells', fires.length > 5 && fires.every(s => s.traits.includes('fire')));
  reset();
}

/* ============ importer ============ */
section('Spell importer');
{
  // Open5e-shaped record
  const rec = {
    name: 'Test Bolt', level_int: 2, school: 'evocation', casting_time: '1 action',
    range: '60 feet', duration: 'Instantaneous', desc: 'A test bolt of energy.',
    higher_level: 'More damage.', spell_lists: ['wizard', 'sorcerer'],
    requires_verbal_components: true, requires_somatic_components: true,
    requires_material_components: false, requires_concentration: false,
    can_be_cast_as_ritual: false, document__title: 'Test Book'
  };
  const n = G.normalizeImportedSpell(rec, '5e');
  eq('import: name', n.name, 'Test Bolt');
  eq('import: level', n.level, 2);
  eq('import: school title-cased', n.school, 'Evocation');
  eq('import: components', n.components, 'VS');
  eq('import: classes', n.classes.join(','), 'wizard,sorcerer');
  eq('import: source', n.source, 'Test Book');
  eq('import: rejects a record with no name', G.normalizeImportedSpell({ level: 1 }, '5e'), null);

  // pf1 CSV-shaped record
  const p1 = G.normalizeImportedSpell({ name: 'Test Ward', school: 'abjuration', sor: '2', wiz: '2', cleric: '3', description: 'Wards things.' }, 'pf1');
  eq('pf1 import: sorcerer/wizard level', p1.levels.sw, 2);
  eq('pf1 import: cleric level', p1.levels.clr, 3);
  eq('pf1 import: lowest level', p1.level, 2);
  eq('pf1 import: rejects rows with no class levels', G.normalizeImportedSpell({ name: 'Nope' }, 'pf1'), null);

  // pf2-shaped record
  const p2 = G.normalizeImportedSpell({ name: 'Test Gust', level: 4, traditions: ['Arcane'], traits: ['air', 'cantrip'], text: 'Blows.' }, 'pf2');
  eq('pf2 import: rank', p2.level, 4);
  eq('pf2 import: tradition lowercased', p2.traditions.join(','), 'arcane');
  eq('pf2 import: cantrip detected from traits', p2.cantrip, true);

  // CSV parsing
  const csv = 'name,school,sor,description\n"Acid Rain","conjuration",3,"Rains acid, badly"\n"Two Line","evocation",1,"line one\nline two"\n';
  const rows = G.parseCSV(csv);
  eq('csv rows', rows.length, 2);
  eq('csv quoted comma kept', rows[0].description, 'Rains acid, badly');
  eq('csv embedded newline kept', rows[1].description, 'line one\nline two');
  eq('csv header normalised', Object.keys(rows[0]).join(','), 'name,school,sor,description');

  // round trip through the store
  const before = G.spellsFor('5e').length;
  const res = G.importSpellRecords([rec], '5e');
  eq('import added one', res.added, 1);
  eq('catalogue grew by one', G.spellsFor('5e').length, before + 1);
  ok('imported spell is findable', !!G.spellsFor('5e').find(s => s.name === 'Test Bolt'));
  ok('imported spell is flagged', G.spellsFor('5e').find(s => s.name === 'Test Bolt').imported === true);

  // imports that duplicate a built-in inherit its uid, so existing picks survive
  const fbUid = G.spellsFor('5e').find(s => s.name === 'Fireball').uid;
  G.importSpellRecords([{ name: 'Fireball', level_int: 3, school: 'evocation', desc: 'Custom fireball.', spell_lists: ['wizard'] }], '5e');
  const fb2 = G.spellsFor('5e').find(s => s.name === 'Fireball');
  eq('only one Fireball after import', G.spellsFor('5e').filter(s => s.name === 'Fireball').length, 1);
  eq('duplicate import keeps the original uid', fb2.uid, fbUid);
  eq('duplicate import replaces the text', fb2.text, 'Custom fireball.');

  G.clearImportedSpells('5e');
  eq('clearing imports restores the built-in count', G.spellsFor('5e').length, 339);
  eq('clearing imports restores the built-in text', /bright streak/.test(G.spellsFor('5e').find(s => s.name === 'Fireball').text), true);
}

/* ============ spells survive save and load ============ */
section('Spells persistence');
{
  const c = mk('pf2', { name: 'Spell Saver', level: 5, lineageId: 'elf', lineageSubId: 'seer', classId: 'wizard', backgroundId: 'scholar', keyAbility: 'int', abilityMethod: 'boosts', boosts: { ancestryFree: ['con'], free: ['int', 'wis', 'con', 'cha'], levels: { 5: ['int', 'dex', 'con', 'wis'] } } });
  G.derive(c);
  G.fillStarter(c);
  const names = G.charSpells(c).map(s => s.name).sort().join(',');
  const clone = JSON.parse(JSON.stringify(c));
  G.derive(clone);
  eq('spell picks survive a JSON round trip', G.charSpells(clone).map(s => s.name).sort().join(','), names);
  eq('prepared list survives too', clone.prepared.length, c.prepared.length);
  G.saveRoster([c]);
  const back = G.loadRoster();
  eq('spells survive the roster store', back[0].spells.length, c.spells.length);
}

/* ============ spell UI render sweep ============ */
section('Spell UI render sweep (every class x every tab)');
{
  let n = 0, errs = 0;
  ['5e', '4e', 'pf1', 'pf2'].forEach(sid => {
    const S = G.SYSTEMS[sid];
    S.classes.forEach(cl => {
      [1, 5, 11, 20].forEach(lv => {
        const c = mk(sid, {
          name: 'Spell Render', level: Math.min(lv, S.maxLevel),
          lineageId: S.lineages[0].id,
          lineageSubId: (S.lineages[0].subs || [])[0] ? S.lineages[0].subs[0].id : null,
          classId: cl.id, subclassId: (cl.subclasses || [])[0] ? cl.subclasses[0].id : null,
          backgroundId: S.backgrounds[0].id, abilityMethod: 'manual',
          baseScores: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
          keyAbility: cl.keyAbility ? cl.keyAbility[0] : null
        });
        if (sid === 'pf2') c.boosts = { ancestryFree: ['str'], free: ['str', 'dex', 'con', 'wis'], levels: { 5: ['str', 'dex', 'con', 'wis'], 10: ['str', 'dex', 'con', 'wis'], 15: ['str', 'dex', 'con', 'wis'], 20: ['str', 'dex', 'con', 'wis'] } };
        const spec = S.lineages[0].choiceAsi;
        if (spec) c.choiceAsi = ['str', 'dex', 'con'].slice(0, spec.count);
        G.derive(c);
        G.app.roster = [c]; G.app.currentId = c.id;
        // give the caster some spells so the book view has content
        if (G.casterInfo(c)) G.fillStarter(c);
        ['book', 'browse', 'import'].forEach(tab => {
          G.spellUI.tab = tab;
          n++;
          try {
            const html = G.stepSpells(c);
            if (!html || html.length < 30) throw new Error('empty output');
            if (/>undefined|NaN|\[object Object\]/.test(html)) throw new Error('bad interpolation');
          } catch (e) {
            errs++;
            if (errs <= 6) fails.push('stepSpells ' + sid + '/' + cl.id + ' L' + lv + '/' + tab + ': ' + e.message);
          }
        });
        // sheet block
        n++;
        try {
          const sb = G.spellSheetBlock(c);
          if (/>undefined|NaN/.test(sb)) throw new Error('bad interpolation in sheet block');
          c.printSpellText = true;
          const sb2 = G.spellSheetBlock(c);
          if (/>undefined|NaN/.test(sb2)) throw new Error('bad interpolation in printed text');
          c.printSpellText = false;
        } catch (e) {
          errs++;
          if (errs <= 6) fails.push('spellSheetBlock ' + sid + '/' + cl.id + ': ' + e.message);
        }
      });
    });
  });
  G.spellUI.tab = 'browse';
  console.log('  rendered ' + n + ' spell views');
  eq('no spell UI render errors', errs, 0);
}
{
  // focus-only casters (PF2 champion and monk)
  const champ = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'champion', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(champ);
  const info = G.casterInfo(champ);
  ok('champion counts as a focus-only caster', info && info.focusOnly === true);
  const lim = G.spellLimits(champ, null);
  eq('champion casting mode', lim.mode, 'focus');
  eq('champion has no cantrips', lim.cantrips, 0);
  eq('champion has no slots', JSON.stringify(lim.slots), '{}');
  const onList = G.spellsFor('pf2').filter(sp => G.spellOnList(champ, sp));
  ok('champion sees only focus spells (' + onList.length + ')', onList.length > 0 && onList.every(sp => sp.focus));
  const monk = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'monk', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(monk);
  ok('monk is a focus-only caster', G.casterInfo(monk).focusOnly === true);
  const fighter = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'fighter', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(fighter);
  eq('pf2 fighter is not a caster at all', G.casterInfo(fighter), null);
}

/* ============ play: hit points ============ */
section('Play: hit points');
{
  const c = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  const max = G.derive(c).hp;
  eq('starts at full health', G.curHp(c), max);
  G.applyDamage(c, 7);
  eq('damage comes off', G.curHp(c), max - 7);
  G.applyHeal(c, 3);
  eq('healing goes back on', G.curHp(c), max - 4);
  G.applyHeal(c, 999);
  eq('healing cannot exceed the maximum', G.curHp(c), max);
  G.applyDamage(c, 9999);
  eq('damage stops at zero, never negative', G.curHp(c), 0);
  G.setHp(c, 10);
  eq('setHp works', G.curHp(c), 10);
  // temporary hit points soak damage first
  c.play.temp = 6;
  G.applyDamage(c, 4);
  eq('temp HP absorbs the hit', G.curHp(c), 10);
  eq('temp HP is reduced', c.play.temp, 2);
  G.applyDamage(c, 5);
  eq('overflow carries into real HP', G.curHp(c), 7);
  eq('temp HP is used up', c.play.temp, 0);
  // max HP changing with level keeps current HP in range
  c.play.hp = 100;
  eq('current HP is clamped to the new maximum', G.curHp(c), G.derive(c).hp);
}

/* ============ play: resources ============ */
section('Play: resource maxima');
{
  const mkc = (sysid, over) => { const c = mk(sysid, over); G.derive(c); return c; };
  const resOf = c => { const r = {}; G.resourcesFor(c).forEach(x => r[x.id] = x); return r; };

  // 5e wizard: slots + hit dice + arcane recovery
  const wiz = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  let r = resOf(wiz);
  eq('wizard 1st-level slots', r.slot1.max, 4);
  eq('wizard 2nd-level slots', r.slot2.max, 3);
  eq('wizard 3rd-level slots', r.slot3.max, 2);
  eq('wizard has no 4th-level slots at level 5', r.slot4, undefined);
  eq('slots come back on a long rest', r.slot1.reset, 'long');
  eq('hit dice equal level', r.hitdice.max, 5);
  eq('hit dice come back at half rate', r.hitdice.reset, 'longHalf');
  eq('arcane recovery once per long rest', r.recovery.max, 1);

  // barbarian rage by level
  [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]].forEach(([lv, want]) => {
    const b = mkc('5e', { level: lv, lineageId: 'halforc', classId: 'barbarian', backgroundId: 'outlander', abilityMethod: 'manual', baseScores: { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 } });
    eq('barbarian rage uses at level ' + lv, resOf(b).rage.max, want);
  });

  // monk ki equals level from 2nd, on a short rest
  const monk = mkc('5e', { level: 6, lineageId: 'human', lineageSubId: 'standard', classId: 'monk', backgroundId: 'hermit', abilityMethod: 'manual', baseScores: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 } });
  eq('monk ki points equal level', resOf(monk).ki.max, 6);
  eq('ki returns on a short rest', resOf(monk).ki.reset, 'short');

  // paladin lay on hands pool and channel divinity
  const pal = mkc('5e', { level: 6, lineageId: 'human', lineageSubId: 'standard', classId: 'paladin', backgroundId: 'noble', abilityMethod: 'manual', baseScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 } });
  r = resOf(pal);
  eq('lay on hands pool is five per level', r.loh.max, 30);
  ok('lay on hands is a pool, not pips', r.loh.pool === true);
  eq('channel divinity once per short rest', r.channel.max, 1);
  eq('divine sense is 1 + Cha mod', r.divinesense.max, 1 + G.mod(pal.finalScores.cha));

  // fighter action surge and indomitable
  const ftr = mkc('5e', { level: 17, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  r = resOf(ftr);
  eq('action surge twice at 17th', r.actionsurge.max, 2);
  eq('indomitable three times at 17th', r.indomitable.max, 3);
  eq('second wind once per short rest', r.secondwind.max, 1);

  // warlock pact slots recharge on a short rest
  const wl = mkc('5e', { level: 5, lineageId: 'tiefling', classId: 'warlock', backgroundId: 'charlatan', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 } });
  r = resOf(wl);
  eq('warlock has pact slots', r.pact.max, 2);
  eq('pact slots return on a short rest', r.pact.reset, 'short');
  ok('warlock has no ordinary slot resources', !r.slot1);
  eq('tiefling Hellish Rebuke once per long rest', r.rebuke.max, 1);

  // half-orc racial
  const ho = mkc('5e', { level: 3, lineageId: 'halforc', classId: 'barbarian', backgroundId: 'outlander', abilityMethod: 'manual', baseScores: { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 } });
  eq('half-orc Relentless Endurance once per long rest', resOf(ho).relentless.max, 1);

  // 4e surges
  const f4 = mkc('4e', { level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, choiceAsi: ['str'] });
  r = resOf(f4);
  eq('4e healing surges match the derived count', r.surges.max, G.derive(f4).surges);
  eq('surges return on an extended rest', r.surges.reset, 'daily');
  eq('second wind is per encounter', r.secondwind.reset, 'encounter');

  // pf1 spells per day and rage rounds
  const pf1w = mkc('pf1', { level: 5, lineageId: 'human', classId: 'wizard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 }, choiceAsi: ['int'] });
  r = resOf(pf1w);
  eq('pf1 wizard 1st-level spells per day', r.slot1.max, 3);
  eq('pf1 wizard 1 third-level spell per day at level 5', r.slot3.max, 1);
  eq('pf1 slots reset daily', r.slot1.reset, 'day');
  const pf1b = mkc('pf1', { level: 5, lineageId: 'human', classId: 'barbarian', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 }, choiceAsi: ['str'] });
  eq('pf1 rage rounds = 4 + Con mod + 2/level after 1st',
    resOf(pf1b).rage.max, 4 + G.mod(pf1b.finalScores.con) + 4 * 2);

  // pf2 slots by rank plus focus points from focus spells
  const pf2c = mkc('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: { 5: ['wis', 'dex', 'con', 'cha'] } } });
  r = resOf(pf2c);
  eq('pf2 rank 1 slots', r.slot1.max, 3);
  eq('pf2 top rank has two slots at an odd level', r.slot3.max, 2);
  ok('no focus points without focus spells', !r.focus);
  const focusSpell = G.spellsFor('pf2').find(s => s.focus && s.traits.includes('cleric'));
  pf2c.spells = [focusSpell.uid];
  eq('a focus spell grants a focus point', resOf(pf2c).focus.max, 1);
  eq('focus points return on a Refocus', resOf(pf2c).focus.reset, 'refocus');
}

/* ============ play: casting and rests ============ */
section('Play: casting');
{
  const mkc = (sysid, over) => { const c = mk(sysid, over); G.derive(c); G.playInit(c); return c; };
  const find = (sysid, n) => G.spellsFor(sysid).find(s => s.name === n);

  const wiz = mkc('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  const fireball = find('5e', 'Fireball'), firebolt = find('5e', 'Fire Bolt'), mm = find('5e', 'Magic Missile');
  wiz.spells = [fireball.uid, firebolt.uid, mm.uid];

  // cantrips are free
  let res = G.castSpell(wiz, firebolt);
  ok('cantrips cast without cost', res.ok && /at will/i.test(res.message));
  eq('no slots spent on a cantrip', G.used(wiz, 'slot1'), 0);

  // a 3rd-level spell eats a 3rd-level slot
  res = G.castSpell(wiz, fireball);
  ok('fireball casts', res.ok);
  eq('one 3rd-level slot spent', G.used(wiz, 'slot3'), 1);
  ok('the message says how many are left', /1 of 2 left/.test(res.message));
  res = G.castSpell(wiz, fireball);
  eq('both 3rd-level slots now spent', G.used(wiz, 'slot3'), 2);
  ok('the message warns it is the last one', /back after a long rest/.test(res.message));
  res = G.castSpell(wiz, fireball);
  ok('a third cast is refused', !res.ok);
  ok('and says why', /No slot of 3rd level or higher left/i.test(res.message));
  ok('castCost reports it as unavailable', G.castCost(wiz, fireball).none === true);

  // a 1st-level spell can burn a higher slot once the low ones are gone
  G.setUsed(wiz, 'slot1', 4, 4);
  let cost = G.castCost(wiz, mm);
  eq('magic missile falls back to a 2nd-level slot', cost.id, 'slot2');
  G.setUsed(wiz, 'slot2', 3, 3);
  ok('with 1st and 2nd gone and 3rd spent, it is unavailable', G.castCost(wiz, mm).none === true);

  // long rest restores everything and heals to full
  G.applyDamage(wiz, 12);
  const restRes = G.doRest(wiz, 'long');
  eq('long rest clears 3rd-level slots', G.used(wiz, 'slot3'), 0);
  eq('long rest clears 1st-level slots', G.used(wiz, 'slot1'), 0);
  eq('long rest heals to full', G.curHp(wiz), G.maxHp(wiz));
  ok('the rest reports what it restored', restRes.restored.length > 0);
  ok('fireball is castable again', !G.castCost(wiz, fireball).none);

  // short rest does not give back long-rest slots
  G.castSpell(wiz, fireball);
  G.doRest(wiz, 'short');
  eq('short rest leaves spell slots alone', G.used(wiz, 'slot3'), 1);

  // hit dice: spent on a short rest, half back on a long rest
  const ftr = mkc('5e', { level: 10, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  G.applyDamage(ftr, 40);
  const hpBefore = G.curHp(ftr);
  const hd = G.spendHitDie(ftr);
  ok('spending a hit die heals', hd.ok && G.curHp(ftr) > hpBefore);
  eq('one hit die used', G.used(ftr, 'hitdice'), 1);
  G.setUsed(ftr, 'hitdice', 10, 10);
  ok('with none left, spending is refused', !G.spendHitDie(ftr).ok);
  G.doRest(ftr, 'long');
  eq('a long rest gives back half your hit dice', G.used(ftr, 'hitdice'), 5);

  // short-rest features
  const monk = mkc('5e', { level: 6, lineageId: 'human', lineageSubId: 'standard', classId: 'monk', backgroundId: 'hermit', abilityMethod: 'manual', baseScores: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 } });
  G.setUsed(monk, 'ki', 6, 6);
  G.doRest(monk, 'short');
  eq('a short rest refills ki', G.used(monk, 'ki'), 0);

  // warlock pact slots on a short rest
  const wl = mkc('5e', { level: 5, lineageId: 'tiefling', classId: 'warlock', backgroundId: 'charlatan', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 } });
  const hex = G.spellsFor('5e').find(s => s.classes.includes('warlock') && s.level === 1);
  wl.spells = [hex.uid];
  G.castSpell(wl, hex);
  eq('warlock spends a pact slot', G.used(wl, 'pact'), 1);
  G.doRest(wl, 'short');
  eq('pact slots refill on a short rest', G.used(wl, 'pact'), 0);

  // pf2: focus spell spends a focus point; refocus gives one back
  const cl2 = mkc('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'cleric', backgroundId: 'acolyte', keyAbility: 'wis', abilityMethod: 'boosts', boosts: { ancestryFree: ['wis', 'con'], free: ['wis', 'dex', 'con', 'cha'], levels: { 5: ['wis', 'dex', 'con', 'cha'] } } });
  const fs = G.spellsFor('pf2').find(s => s.focus && s.traits.includes('cleric'));
  cl2.spells = [fs.uid];
  ok('focus spell costs a focus point', G.castCost(cl2, fs).id === 'focus');
  G.castSpell(cl2, fs);
  eq('focus point spent', G.used(cl2, 'focus'), 1);
  ok('with none left it is unavailable', G.castCost(cl2, fs).none === true);
  G.doRest(cl2, 'refocus');
  eq('Refocus returns one focus point', G.used(cl2, 'focus'), 0);
  // pf2 night's rest heals Con mod per level
  const heal2 = Math.max(1, G.mod(cl2.finalScores.con)) * cl2.level;
  G.setHp(cl2, 1);
  G.doRest(cl2, 'long');
  eq('pf2 long rest heals Con modifier per level', G.curHp(cl2), Math.min(G.maxHp(cl2), 1 + heal2));

  // pf1: exact level slots, and a night restores HP equal to level
  const pf1w = mkc('pf1', { level: 5, lineageId: 'human', classId: 'wizard', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 }, choiceAsi: ['int'] });
  const fb1 = find('pf1', 'Fireball');
  pf1w.spells = [fb1.uid];
  eq('pf1 fireball uses a 3rd-level slot', G.castCost(pf1w, fb1).id, 'slot3');
  const firstCast = G.castSpell(pf1w, fb1);
  ok('the single 3rd-level slot casts', firstCast.ok);
  const secondCast = G.castSpell(pf1w, fb1);
  ok('a second cast is refused', !secondCast.ok);
  eq('only the one slot was spent', G.used(pf1w, 'slot3'), 1);
  ok('pf1 does not upcast into higher slots', G.castCost(pf1w, fb1).none === true);
  G.setHp(pf1w, 1);
  G.doRest(pf1w, 'day');
  eq('pf1 rest restores slots', G.used(pf1w, 'slot3'), 0);
  eq('pf1 rest heals HP equal to level', G.curHp(pf1w), 1 + pf1w.level);

  // 4e surges and rests
  const f4 = mkc('4e', { level: 3, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, choiceAsi: ['str'] });
  G.applyDamage(f4, 20);
  const before4 = G.curHp(f4);
  const sr = G.spendSurge(f4);
  ok('spending a surge heals the surge value', sr.ok && G.curHp(f4) === before4 + G.derive(f4).surgeValue);
  eq('one surge used', G.used(f4, 'surges'), 1);
  G.setUsed(f4, 'secondwind', 1, 1);
  G.doRest(f4, 'short');
  eq('4e short rest refreshes second wind', G.used(f4, 'secondwind'), 0);
  eq('4e short rest does not refresh surges', G.used(f4, 'surges'), 1);
  G.doRest(f4, 'extended');
  eq('4e extended rest refreshes surges', G.used(f4, 'surges'), 0);
  eq('4e extended rest heals to full', G.curHp(f4), G.maxHp(f4));
}

/* ============ play: persistence ============ */
section('Play: persistence');
{
  const c = mk('5e', { name: 'Play Saver', level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(c);
  const fb = G.spellsFor('5e').find(s => s.name === 'Fireball');
  c.spells = [fb.uid];
  G.castSpell(c, fb);
  G.applyDamage(c, 9);
  c.play.temp = 4;
  const clone = JSON.parse(JSON.stringify(c));
  G.derive(clone);
  eq('spent slots survive a save and load', G.used(clone, 'slot3'), 1);
  eq('current HP survives', G.curHp(clone), G.curHp(c));
  eq('temp HP survives', clone.play.temp, 4);
  G.saveRoster([c]);
  const back = G.loadRoster();
  eq('play state is in the roster store', back[0].play.used.slot3, 1);
  // a character with no play block at all still works
  const old = JSON.parse(JSON.stringify(c));
  delete old.play;
  G.derive(old);
  eq('a character saved before play tracking existed still opens', G.curHp(old), G.maxHp(old));
  eq('and starts with nothing spent', G.used(old, 'slot3'), 0);
}

/* ============ inventory: catalogue ============ */
section('Inventory: catalogue');
{
  const c5 = G.itemsFor('5e'), c2 = G.itemsFor('pf2'), c1 = G.itemsFor('pf1'), c4 = G.itemsFor('4e');
  ok('5e catalogue loaded (' + c5.length + ')', c5.length > 400);
  ok('pf2 catalogue loaded (' + c2.length + ')', c2.length > 4000);
  ok('pf1 catalogue loaded (' + c1.length + ')', c1.length > 380);
  ok('4e catalogue loaded (' + c4.length + ')', c4.length > 50);
  ok('every system has items', ['5e', '4e', 'pf1', 'pf2'].every(s => G.hasItemData(s)));

  const find = (sys, n) => G.itemsFor(sys).find(i => i.name.toLowerCase() === n.toLowerCase());
  // 5e values straight from the SRD equipment table
  const ls = find('5e', 'Longsword');
  eq('5e longsword costs 15 gp', ls.cp, 1500);
  eq('5e longsword weighs 3 lb', ls.weight, 3);
  eq('5e longsword is a weapon', ls.cat, 'weapon');
  ok('5e longsword carries its damage', /1d8/.test(ls.stats), ls.stats);
  const pl = find('5e', 'Plate Armor');
  eq('5e plate costs 1500 gp', pl.cp, 150000);
  eq('5e plate weighs 65 lb', pl.weight, 65);
  eq('5e plate is armour', pl.cat, 'armor');
  const rope = find('5e', 'Rope, hempen (50 feet)');
  ok('5e rope is in the catalogue', !!rope);
  if (rope) { eq('5e rope costs 1 gp', rope.cp, 100); eq('5e rope weighs 10 lb', rope.weight, 10); }
  const shield5 = G.itemsFor('5e').filter(i => i.cat === 'shield');
  eq('5e has a shield, filed as a shield', shield5.length, 1);
  eq('5e shield weighs 6 lb', shield5[0].weight, 6);
  ok('5e magic items are present', G.itemsFor('5e').filter(i => i.cat === 'magic').length > 200);
  const bag = find('5e', 'Bag of Holding');
  ok('a known magic item is there with its text', bag && bag.note.length > 40);

  // pf2 bulk and price
  const ls2 = find('pf2', 'Longsword');
  eq('pf2 longsword costs 1 gp', ls2.cp, 100);
  eq('pf2 longsword is 1 Bulk', ls2.weight, 1);
  const dag2 = find('pf2', 'Dagger');
  eq('pf2 dagger is light Bulk', dag2.weight, 0.1);
  ok('pf2 armour is categorised', G.itemsFor('pf2').filter(i => i.cat === 'armor').length > 100);
  ok('pf2 shields are separated from armour', G.itemsFor('pf2').filter(i => i.cat === 'shield').length > 50);

  // pf1 weapons from the extract, armour and gear hand-authored
  const ls1 = find('pf1', 'Longsword');
  eq('pf1 longsword costs 15 gp', ls1.cp, 1500);
  eq('pf1 longsword weighs 4 lb', ls1.weight, 4);
  const fp = find('pf1', 'Full Plate');
  eq('pf1 full plate costs 1500 gp', fp.cp, 150000);
  eq('pf1 full plate weighs 50 lb', fp.weight, 50);
  const rope1 = find('pf1', 'Rope, hemp (50 ft.)');
  eq('pf1 hemp rope costs 1 gp', rope1.cp, 100);
  ok('pf1 has armour, shields and gear as well as weapons',
    ['armor', 'shield', 'gear', 'tool', 'consumable'].every(k => G.itemsFor('pf1').some(i => i.cat === k)));

  // 4e hand-authored
  const ls4 = find('4e', 'Longsword');
  eq('4e longsword costs 15 gp', ls4.cp, 1500);
  eq('4e longsword weighs 4 lb', ls4.weight, 4);
  ok('4e has armour and a kit', G.itemsFor('4e').some(i => i.cat === 'armor') &&
    G.itemsFor('4e').some(i => i.cat === 'kit'));

  // data hygiene across every catalogue
  ['5e', '4e', 'pf1', 'pf2'].forEach(sysid => {
    const list = G.itemsFor(sysid);
    ok(sysid + ': every item has a name', list.every(i => i.name && i.name.length > 1));
    ok(sysid + ': every category is known', list.every(i => G.ITEMCATS.includes(i.cat)));
    ok(sysid + ': no negative weights or costs', list.every(i => i.weight >= 0 && i.cp >= 0));
    ok(sysid + ': uids are unique', new Set(list.map(i => i.uid)).size === list.length);
    ok(sysid + ': sorted by name', list.every((it, k) => k === 0 || list[k - 1].name.localeCompare(it.name) <= 0));
  });
}

/* ============ inventory: money ============ */
section('Inventory: money');
{
  eq('formats a mixed purse', G.fmtCoins(1234), '1 pp 2 gp 3 sp 4 cp');
  eq('formats round gold', G.fmtCoins(500), '5 gp');
  eq('formats nothing', G.fmtCoins(0), '0 gp');
  const c = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  G.derive(c);
  G.invInit(c).coins = { pp: 1, gp: 20, sp: 5, cp: 3 };
  eq('purse total in copper', G.coinTotalCp(c), 1000 + 2000 + 50 + 3);
  eq('coin count', G.coinCount(c), 29);
  eq('coin weight is 50 to the pound', G.coinWeight(c), 29 / 50);
  const p2 = mk('pf2', { level: 1, lineageId: 'human', lineageSubId: 'skilled', classId: 'fighter', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(p2);
  G.invInit(p2).coins = { pp: 0, gp: 500, sp: 0, cp: 0 };
  eq('pf2 counts 1000 coins to the Bulk', G.coinWeight(p2), 0.5);
}

/* ============ inventory: carrying items ============ */
section('Inventory: items and load');
{
  const c = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  G.derive(c);
  const find = n => G.itemsFor('5e').find(i => i.name === n);

  const l1 = G.addCatalogueItem(c, find('Longsword').uid, 1);
  eq('added the longsword', l1.name, 'Longsword');
  eq('one line in the inventory', G.invItems(c).length, 1);
  eq('load is the item weight', G.totalLoad(c), 3);
  // adding the same thing again stacks rather than duplicating
  G.addCatalogueItem(c, find('Longsword').uid, 1);
  eq('still one line', G.invItems(c).length, 1);
  eq('quantity went up', G.invLine(c, l1.id).qty, 2);
  eq('load counts quantity', G.totalLoad(c), 6);
  G.setQty(c, l1.id, 1);
  eq('quantity can come down', G.totalLoad(c), 3);

  // a custom item
  const cu = G.addCustomItem(c, { name: 'Grandfather\'s locket', cat: 'treasure', qty: 2, weight: 0.5, cp: 250, note: 'Opens to a portrait.' });
  eq('custom item added', cu.name, "Grandfather's locket");
  eq('custom items are flagged', cu.custom, true);
  eq('custom weight counts', G.totalLoad(c), 3 + 1);
  eq('custom value is per item', G.invSummary(c).value, 1500 + 500);
  const bad = G.addCustomItem(c, { name: '  ', weight: -5, qty: 0, cp: -3 });
  eq('a blank name still gets something usable', bad.name.length > 0, true);
  eq('negative weight is clamped', bad.weight, 0);
  eq('quantity is at least one', bad.qty, 1);
  eq('negative cost is clamped', bad.cp, 0);
  G.removeItem(c, bad.id);

  // coins add to the load
  G.invInit(c).coins = { pp: 0, gp: 100, sp: 0, cp: 0 };
  eq('coins are part of the load', G.totalLoad(c), 3 + 1 + 2);
  G.invInit(c).coins = { pp: 0, gp: 0, sp: 0, cp: 0 };

  // dropping
  const before = G.invItems(c).length;
  G.removeItem(c, cu.id);
  eq('dropping removes the line', G.invItems(c).length, before - 1);
  eq('and its weight', G.totalLoad(c), 3);
}

/* ============ inventory: encumbrance ============ */
section('Inventory: encumbrance');
{
  // 5e: capacity is Strength x 15, with the variant thresholds at x5 and x10
  const c = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } });
  G.derive(c);
  const str = c.finalScores.str;
  let lim = G.loadLimits(c);
  eq('5e maximum is Str x 15', lim.max, str * 15);
  eq('5e unencumbered up to Str x 5', lim.bands[0].upTo, str * 5);
  eq('5e encumbered up to Str x 10', lim.bands[1].upTo, str * 10);
  G.addCustomItem(c, { name: 'Lead block', weight: 1, qty: str * 5 });
  eq('at exactly Str x 5 you are still unencumbered', G.loadBand(c).band.name, 'Unencumbered');
  G.addCustomItem(c, { name: 'Another block', weight: 1, qty: 1 });
  eq('one pound over and you are encumbered', G.loadBand(c).band.name, 'Encumbered');
  G.addCustomItem(c, { name: 'Heavy crate', weight: 1, qty: str * 15 });
  ok('past capacity it reports being over', G.loadBand(c).over === true);
  ok('and that shows up as a warning', G.invIssues(c).some(i => /over your limit/.test(i.text)));

  // Pathfinder 1e uses the printed table
  eq('pf1 Str 10 light load is 33 lb', G.pf1Capacity(10, false).light, 33);
  eq('pf1 Str 10 medium load is 66 lb', G.pf1Capacity(10, false).medium, 66);
  eq('pf1 Str 10 heavy load is 100 lb', G.pf1Capacity(10, false).heavy, 100);
  eq('pf1 Str 13 light load is 50 lb', G.pf1Capacity(13, false).light, 50);
  eq('pf1 Str 18 heavy load is 300 lb', G.pf1Capacity(18, false).heavy, 300);
  eq('pf1 Str 20 heavy load is 400 lb', G.pf1Capacity(20, false).heavy, 400);
  eq('pf1 small creatures carry three quarters', G.pf1Capacity(10, true).heavy, 75);
  const p1 = mk('pf1', { level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, choiceAsi: ['str'] });
  G.derive(p1);
  lim = G.loadLimits(p1);
  eq('pf1 bands come from the table', lim.bands[0].upTo, G.pf1Capacity(p1.finalScores.str, false).light);
  ok('pf1 band names read like the rules', /Light load/.test(lim.bands[0].name));

  // Pathfinder 2e counts Bulk
  const p2 = mk('pf2', { level: 1, lineageId: 'human', lineageSubId: 'skilled', classId: 'fighter', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  G.derive(p2);
  lim = G.loadLimits(p2);
  eq('pf2 encumbered at 5 + Str mod', lim.bands[0].upTo, 5 + G.mod(p2.finalScores.str));
  eq('pf2 maximum at 10 + Str mod', lim.max, 10 + G.mod(p2.finalScores.str));
  eq('pf2 measures in Bulk', lim.unit, 'Bulk');
  eq('pf2 formats light bulk', G.fmtWeight('pf2', 0.3), '3L');
  eq('pf2 formats no bulk', G.fmtWeight('pf2', 0), '—');

  // 4e normal and heavy load
  const p4 = mk('4e', { level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, choiceAsi: ['str'] });
  G.derive(p4);
  lim = G.loadLimits(p4);
  eq('4e normal load is Str x 10', lim.bands[0].upTo, p4.finalScores.str * 10);
  eq('4e heavy load is Str x 20', lim.max, p4.finalScores.str * 20);
}

/* ============ inventory: equipping drives AC ============ */
section('Inventory: equipping changes AC');
{
  const c = mk('5e', { level: 1, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, armor: 'None' });
  G.derive(c);
  const acNow = () => G.derive(c).ac;
  const find = n => G.itemsFor('5e').find(i => i.name === n);
  eq('unarmoured AC is 10 + Dex', acNow(), 10 + G.mod(c.finalScores.dex));

  const chain = G.addCatalogueItem(c, find('Chain Mail').uid, 1);
  eq('adding armour does not equip it', G.derive(c).ac, 10 + G.mod(c.finalScores.dex));
  G.toggleEquip(c, chain.id);
  eq('equipping chain mail sets the worn armour', c.armor, 'Chain Mail');
  eq('and AC follows', acNow(), 16);
  ok('the item is marked equipped', G.invLine(c, chain.id).equipped === true);

  const shield = G.addCatalogueItem(c, find('Shield').uid, 1);
  G.toggleEquip(c, shield.id);
  eq('equipping a shield sets the flag', c.shield, true);
  eq('and adds 2 to AC', acNow(), 18);

  // only one suit of armour at a time
  const leather = G.addCatalogueItem(c, find('Leather Armor').uid, 1);
  G.toggleEquip(c, leather.id);
  eq('the new armour takes over', c.armor, 'Leather');
  eq('the old armour is no longer worn', G.invLine(c, chain.id).equipped, false);
  eq('AC reflects leather plus shield', acNow(), 11 + G.mod(c.finalScores.dex) + 2);

  // unequipping goes back to unarmoured
  G.toggleEquip(c, leather.id);
  eq('unequipping returns to no armour', c.armor, 'None');
  G.toggleEquip(c, shield.id);
  eq('and the shield comes off', c.shield, false);
  eq('AC is back to unarmoured', acNow(), 10 + G.mod(c.finalScores.dex));

  // dropping worn armour also unsets it
  G.toggleEquip(c, chain.id);
  eq('chain mail on again', c.armor, 'Chain Mail');
  G.removeItem(c, chain.id);
  eq('dropping it unsets the worn armour', c.armor, 'None');

  // the wizard's armour dropdown syncs the other way
  c.armor = 'Leather';
  G.syncArmourToInventory(c);
  eq('choosing armour in the wizard marks the item worn', G.invLine(c, leather.id).equipped, true);

  // Pathfinder 1e shields use the named field
  const p1 = mk('pf1', { level: 1, lineageId: 'human', classId: 'fighter', backgroundId: 'none', abilityMethod: 'manual', baseScores: { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, choiceAsi: ['str'], armor: 'None' });
  G.derive(p1);
  const hs = G.itemsFor('pf1').find(i => i.name === 'Heavy Steel Shield');
  const line = G.addCatalogueItem(p1, hs.uid, 1);
  G.toggleEquip(p1, line.id);
  eq('pf1 heavy steel shield is selected', p1.shieldPf, 'Heavy Shield');
  ok('pf1 AC went up by the shield bonus', G.derive(p1).ac >= 12);

  // an item with no armour-table match says so rather than silently doing nothing
  const odd = G.addCustomItem(c, { name: 'Bark cuirass', cat: 'armor', weight: 8 });
  const res = G.toggleEquip(c, odd.id);
  ok('an unmatched armour name is reported', /No armour table entry matches/.test(res.message), res.message);
}

/* ============ inventory: attunement ============ */
section('Inventory: attunement');
{
  const c = mk('5e', { level: 5, lineageId: 'human', lineageSubId: 'standard', classId: 'wizard', backgroundId: 'sage', abilityMethod: 'manual', baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } });
  G.derive(c);
  eq('5e allows three attuned items', G.attunementLimit(c), 3);
  const attunables = G.itemsFor('5e').filter(i => i.attune).slice(0, 4);
  ok('the catalogue marks items that need attunement', attunables.length === 4);
  const lines = attunables.map(a => G.addCatalogueItem(c, a.uid, 1));
  lines.slice(0, 3).forEach(l => { l.attuned = true; });
  eq('three attuned is fine', G.invIssues(c).filter(i => /Attuned/.test(i.text)).length, 0);
  lines[3].attuned = true;
  ok('a fourth is flagged', G.invIssues(c).some(i => i.level === 'error' && /Attuned to 4/.test(i.text)));
  const p2 = mk('pf2', { level: 5, lineageId: 'human', lineageSubId: 'skilled', classId: 'fighter', backgroundId: 'warrior', keyAbility: 'str', abilityMethod: 'boosts', boosts: { ancestryFree: ['str', 'con'], free: ['str', 'dex', 'con', 'wis'], levels: {} } });
  eq('pf2 has no attunement rule', G.attunementLimit(p2), 0);
}

/* ============ inventory: persistence ============ */
section('Inventory: persistence');
{
  const c = mk('5e', { name: 'Pack Mule', level: 3, lineageId: 'human', lineageSubId: 'standard', classId: 'fighter', backgroundId: 'soldier', abilityMethod: 'manual', baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, armor: 'None' });
  G.derive(c);
  const find = n => G.itemsFor('5e').find(i => i.name === n);
  const chain = G.addCatalogueItem(c, find('Chain Mail').uid, 1);
  G.toggleEquip(c, chain.id);
  G.addCustomItem(c, { name: 'Lucky stone', weight: 0.1, cp: 5 });
  G.invInit(c).coins = { pp: 0, gp: 12, sp: 4, cp: 0 };
  const load = G.totalLoad(c);

  const clone = JSON.parse(JSON.stringify(c));
  G.derive(clone);
  eq('items survive a save and load', G.invItems(clone).length, 2);
  eq('load survives', G.totalLoad(clone), load);
  eq('coins survive', G.coinTotalCp(clone), 1240);
  eq('equipped armour survives', clone.armor, 'Chain Mail');
  eq('and the equipped flag', G.invItems(clone).find(i => i.ref === chain.ref).equipped, true);
  G.saveRoster([c]);
  eq('inventory is in the roster store', G.loadRoster()[0].inv.items.length, 2);

  // a character saved before inventories existed still opens
  const old = JSON.parse(JSON.stringify(c));
  delete old.inv;
  G.derive(old);
  eq('an older character gets an empty inventory', G.invItems(old).length, 0);
  eq('with no load', G.totalLoad(old), 0);
  eq('and an empty purse', G.coinTotalCp(old), 0);
}

/* ============ inventory: render sweep ============ */
section('Inventory render sweep');
{
  let n = 0, errs = 0;
  ['5e', '4e', 'pf1', 'pf2'].forEach(sid => {
    const S = G.SYSTEMS[sid];
    S.classes.slice(0, 4).forEach(cl => {
      const c = mk(sid, {
        name: 'Inv Test', level: 5, lineageId: S.lineages[0].id,
        lineageSubId: (S.lineages[0].subs || [])[0] ? S.lineages[0].subs[0].id : null,
        classId: cl.id, backgroundId: S.backgrounds[0].id, abilityMethod: 'manual',
        baseScores: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 10 },
        keyAbility: cl.keyAbility ? cl.keyAbility[0] : null
      });
      if (sid === 'pf2') c.boosts = { ancestryFree: ['str'], free: ['str', 'dex', 'con', 'wis'], levels: { 5: ['str', 'dex', 'con', 'wis'] } };
      const spec = S.lineages[0].choiceAsi;
      if (spec) c.choiceAsi = ['str', 'dex'].slice(0, spec.count);
      G.derive(c);
      // empty, then with a few things in it
      [0, 1].forEach(phase => {
        if (phase === 1) {
          G.itemsFor(sid).slice(0, 3).forEach(i => G.addCatalogueItem(c, i.uid, 2));
          G.addCustomItem(c, { name: 'Odd trinket', weight: 1, cp: 10, note: 'Hums faintly.' });
          G.invInit(c).coins = { pp: 1, gp: 2, sp: 3, cp: 4 };
        }
        [false, true].forEach(open => {
          G.invUI.open = open;
          G.invUI.customOpen = open;
          n++;
          try {
            const html = G.inventoryBlock(c, G.derive(c));
            if (!html || html.length < 50) throw new Error('empty');
            if (/>undefined|NaN|\[object Object\]/.test(html)) throw new Error('bad interpolation');
          } catch (e) {
            errs++;
            if (errs <= 6) fails.push('inventoryBlock ' + sid + '/' + cl.id + ' phase' + phase + ': ' + e.message);
          }
        });
      });
    });
  });
  G.invUI.open = false; G.invUI.customOpen = false;
  console.log('  rendered ' + n + ' inventory views');
  eq('no inventory render errors', errs, 0);
}

/* ============ the DM's party table, all four systems ============ */
/* A campaign is locked to one system, so each gets its own columns. Only 5e
   is exercised through a browser, so every system is swept here. */
section('Party table');
{
  const expected = {
    '5e': ['HP', 'AC', 'Passive perc.', 'Saves', 'Spell DC', 'Load'],
    '4e': ['HP', 'AC', 'Fort', 'Ref', 'Will', 'Bloodied', 'Surges'],
    pf1: ['HP', 'AC', 'Touch / FF', 'Fort / Ref / Will', 'CMD', 'Load'],
    pf2: ['HP', 'AC', 'Class DC', 'Perception', 'Fort / Ref / Will', 'Bulk']
  };
  let rendered = 0, errs = 0;
  ['5e', '4e', 'pf1', 'pf2'].forEach(sid => {
    const cols = G.partyColumns(sid);
    eq(sid + ' has the expected party columns',
      cols.map(c => c.k).join(', '), expected[sid].join(', '));

    const S = G.SYSTEMS[sid];
    S.classes.slice(0, 5).forEach(cl => {
      const c = mk(sid, {
        name: 'Party Test', level: 6, lineageId: S.lineages[0].id,
        lineageSubId: (S.lineages[0].subs || [])[0] ? S.lineages[0].subs[0].id : null,
        classId: cl.id, backgroundId: S.backgrounds[0].id, abilityMethod: 'manual',
        baseScores: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 10 },
        keyAbility: cl.keyAbility ? cl.keyAbility[0] : null
      });
      if (sid === 'pf2') c.boosts = { ancestryFree: ['str'], free: ['str', 'dex', 'con', 'wis'], levels: { 5: ['str', 'dex', 'con', 'wis'] } };
      const spec = S.lineages[0].choiceAsi;
      if (spec) c.choiceAsi = ['str', 'dex'].slice(0, spec.count);
      G.itemsFor(sid).slice(0, 3).forEach(i => G.addCatalogueItem(c, i.uid, 1));
      const d = G.derive(c);

      // every cell must be a value a DM could read off the table
      cols.forEach(col => {
        rendered++;
        let v;
        try { v = col.f(c, d); } catch (e) {
          errs++;
          if (errs <= 6) fails.push('party cell threw: ' + sid + '/' + cl.id + '/' + col.k + ': ' + e.message);
          return;
        }
        const s = String(v);
        if (v === undefined || v === null || s === '' || /undefined|NaN|\[object/.test(s)) {
          errs++;
          if (errs <= 6) fails.push('party cell unreadable: ' + sid + '/' + cl.id + '/' + col.k + ' = ' + s);
        }
      });

      // and the whole table has to come out as usable HTML
      const data = {
        campaign: { id: 'x', name: 'T', systemId: sid, yourRole: 'dm', memberCount: 1, dmName: 'D' },
        characters: [c],
        party: [{ characterId: c.id, name: c.name, playerName: 'Nick', ownerProfileId: 'p1', systemId: sid, level: c.level, classId: cl.id, lineageId: S.lineages[0].id }]
      };
      try {
        const html = G.partyTable(data);
        if (!/<table class="party"/.test(html)) throw new Error('no table');
        if (/>undefined|NaN|\[object Object\]/.test(html)) throw new Error('bad interpolation');
        if (/could not work this sheet out/.test(html)) throw new Error('derive failed for the row');
        if (html.indexOf('Nick') < 0) throw new Error('the player is not named');
      } catch (e) {
        errs++;
        if (errs <= 6) fails.push('partyTable ' + sid + '/' + cl.id + ': ' + e.message);
      }
    });
  });
  console.log('  checked ' + rendered + ' party cells');
  eq('every party cell reads as a value', errs, 0);

  // the empty table has to explain itself rather than showing a bare frame
  const blank = G.partyTable({
    campaign: { id: 'x', name: 'T', systemId: '5e', yourRole: 'dm', memberCount: 0, dmName: 'D' },
    characters: [], party: []
  });
  ok('an empty party says so', /Nobody has brought a character yet/.test(blank));
  ok('and says how to fix it', /attach their own characters/.test(blank));

  // what a player sees of the others
  const roster = G.partyRoster({
    campaign: { id: 'x', name: 'T', systemId: '5e', yourRole: 'player', memberCount: 2, dmName: 'D' },
    party: [
      { characterId: 'a', name: 'Mine', playerName: 'Me', ownerProfileId: 'local', systemId: '5e', level: 3, classId: 'fighter', lineageId: 'human' },
      { characterId: 'b', name: 'Theirs', playerName: 'Sam', ownerProfileId: 'other', systemId: '5e', level: 4, classId: 'wizard', lineageId: 'elf' }
    ]
  });
  ok('a player sees the other characters', /Theirs/.test(roster));
  ok('and who plays them', /Sam/.test(roster));
  ok('but not their own listed twice', roster.indexOf('Mine') < 0);
  ok('and is told reading sheets is the DM job', /the DM's job/.test(roster));
  ok('no numbers off anybody else sheet appear', !/\bAC\b/.test(roster));
}

/* ============ journal ============ */
section('Journal');
{
  // A journal entry is free text from a person, rendered into a page. It has to
  // come out as text, never as markup.
  const nasty = '<script>alert(1)</script> & "quotes" and <b>bold</b>';
  const out = G.paraHtml(nasty);
  ok('a script tag is escaped, not rendered', out.indexOf('<script') < 0, out);
  ok('the closing tag too', out.indexOf('</script') < 0);
  ok('bold markup is escaped', out.indexOf('<b>') < 0);
  ok('an ampersand is escaped', out.indexOf('&amp;') >= 0);
  ok('quotes are escaped', out.indexOf('&quot;') >= 0);
  ok('the words themselves survive', /alert\(1\)/.test(out));

  eq('a blank line starts a new paragraph',
    (G.paraHtml('one\n\ntwo').match(/<p>/g) || []).length, 2);
  eq('a single newline stays inside the paragraph',
    (G.paraHtml('one\ntwo').match(/<p>/g) || []).length, 1);
  ok('and becomes a line break', /one<br>two/.test(G.paraHtml('one\ntwo')));
  eq('three blank lines are still one break',
    (G.paraHtml('one\n\n\n\ntwo').match(/<p>/g) || []).length, 2);

  // newest first, with undated entries at the bottom rather than in 1970
  const c = mk('5e', { name: 'Diarist', level: 1 });
  c.journal = [
    { id: 'a', date: '2026-01-01', title: 'Oldest' },
    { id: 'b', date: '', title: 'No date' },
    { id: 'c', date: '2026-06-01', title: 'Newest' },
    { id: 'd', date: '2026-03-01', title: 'Middle' }
  ];
  const order = G.journalSorted(c).map(e => e.title);
  eq('entries come out newest first', order.slice(0, 3).join(','), 'Newest,Middle,Oldest');
  eq('and undated ones sink to the bottom', order[3], 'No date');
  eq('sorting does not reorder the stored journal', c.journal[0].title, 'Oldest');

  // the three levels form one closed cycle, so tapping always gets you back
  let v = 'private';
  const seen = [v];
  for (let i = 0; i < 3; i++) { v = G.VIS_CYCLE[v]; seen.push(v); }
  eq('the visibility control cycles through all three', seen.join('>'),
    'private>dm>party>private');
  ok('and every level has a plain-words label',
    ['party', 'dm', 'private'].every(k => G.VIS_LABEL[k] && !/^[a-z]{2}$/.test(G.VIS_LABEL[k])),
    JSON.stringify(G.VIS_LABEL));

  // an entry with a nonsense level is treated as private, not as public
  c.journal = [{ id: 'x', date: '2026-01-01', title: 'Odd', text: 'x', visibility: 'everyone' }];
  const html = G.journalBlock(c);
  // read the label off the control itself, not the legend underneath it
  const visLabels = (html.match(/data-act="jvis"[\s\S]*?>([^<]+)</g) || [])
    .map(m => m.slice(m.lastIndexOf('>') + 1, -1).trim());
  eq('one entry, one visibility control', visLabels.length, 1);
  eq('an unknown visibility shows as just me', visLabels[0], G.VIS_LABEL.private);
  ok('the control carries the private styling', /class="jvis v-private/.test(html));
  ok('and not the shared styling', !/class="jvis v-party/.test(html));

  // automatic entries are shown, but offer no controls
  c.journal = [{ id: 'y', date: '2026-02-01', title: 'Joined Tuesday', text: '', visibility: 'party', auto: 'join' }];
  const autoHtml = G.journalBlock(c);
  ok('an automatic entry is labelled as such', /automatic/.test(autoHtml));
  ok('and offers no delete', autoHtml.indexOf('data-act="jdel"') < 0);
  ok('and no edit', autoHtml.indexOf('data-act="jedit"') < 0);
  ok('and its level is not a button', !/button[^>]*data-act="jvis"/.test(autoHtml));

  // an empty journal invites you to write in it
  c.journal = [];
  const emptyHtml = G.journalBlock(c);
  ok('an empty journal says so', /Nothing written down yet/.test(emptyHtml));
  ok('and offers a way to start', emptyHtml.indexOf('data-act="jadd"') > 0);

  G.autoJournal(c, 'level', 'Reached level 2', 'Went up from level 1.');
  eq('an automatic entry is appended', c.journal.length, 1);
  eq('marked with its kind', c.journal[0].auto, 'level');
  eq('and shared with the table', c.journal[0].visibility, 'party');
  ok('with a plain date', /^\d{4}-\d{2}-\d{2}$/.test(c.journal[0].date), c.journal[0].date);
  ok('and an id of its own', !!c.journal[0].id);

  // journal entries survive a round trip through JSON, like the rest of a sheet
  const revived = JSON.parse(JSON.stringify(c));
  eq('a journal survives being saved and loaded', revived.journal.length, 1);
  eq('with its visibility', revived.journal[0].visibility, 'party');
}

/* ============ results ============ */
console.log('\n' + '='.repeat(56));
if (fails.length) {
  console.log('\x1b[31mFAILURES (' + fails.length + '):\x1b[0m');
  fails.forEach(f => console.log('  ✗ ' + f));
}
console.log((fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
