/* ============================================================
   The permission matrix.

   This is the security-critical code, so it gets its own suite: a table of
   every level against every relationship, plus a check that the copy the
   server requires really is the same file the browser bundles.

       node src/test-privacy.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, '99-privacy.js');
const COPY = path.join(ROOT, 'server', 'privacy.js');

let pass = 0, fail = 0;
const fails = [];
function ok(label, cond, extra) {
  if (cond) { pass++; return true; }
  fail++; fails.push(label + (extra ? ' — ' + extra : ''));
  return false;
}
function eq(label, got, want) {
  return ok(label + ' (got ' + JSON.stringify(got) + ')',
    String(got) === String(want), 'expected ' + JSON.stringify(want));
}
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ============================================================
   One set of rules, in two places
   ============================================================ */
section('The server uses the same file the browser does');
{
  ok('the browser copy exists', fs.existsSync(SRC));
  ok('and the server copy exists', fs.existsSync(COPY),
    'run python3 src/build.py');

  const src = fs.readFileSync(SRC, 'utf8');
  const copy = fs.readFileSync(COPY, 'utf8');
  const stripped = copy.replace(/^\/\*[\s\S]*?\*\/\n/, '');
  eq('the two are the same, byte for byte', stripped === src, true);
  ok('and the copy warns against editing it', /Do not edit here/.test(copy));

  // if that ever drifts, this is the message that should appear
  if (stripped !== src) {
    fails.push('server/privacy.js is out of date. Run: python3 src/build.py');
  }
}

const P = require(COPY);

/* A character with something at every level. */
function fixture() {
  return {
    id: 'c1', name: 'Peacock Jones', systemId: '5e', level: 4,
    ownerProfileId: 'p-owner', campaignId: 'camp1',
    baseScores: { str: 10, dex: 14, con: 13, int: 12, wis: 11, cha: 16 },
    skills: ['perception'], armor: 'Leather',

    appearance: { eyes: 'grey', hair: 'black' },
    personality: { ideals: 'IDEALTEXT', backstory: 'BACKSTORYTEXT' },
    gear: 'GEARTEXT', gold: '15 gp',
    spells: ['fireball', 'shield'], prepared: ['fireball'],
    choices: { 'Fighting style': 'CHOICETEXT' },
    notes: 'NOTESTEXT',
    languages: ['Common', 'LANGUAGETEXT'],

    privacy: {},
    inv: {
      items: [
        { id: 'i1', name: 'OPENSWORD', cat: 'weapon', qty: 1, weight: 3, cp: 1500, visibility: 'party' },
        { id: 'i2', name: 'DMDAGGER', cat: 'weapon', qty: 2, weight: 1, cp: 200, visibility: 'dm' },
        { id: 'i3', name: 'SECRETIDOL', cat: 'gear', qty: 1, weight: 7, cp: 90000, visibility: 'private' }
      ],
      coins: { gp: 10 }
    },
    journal: [
      { id: 'j1', title: 'OPENENTRY', text: 'x', visibility: 'party', auto: false },
      { id: 'j2', title: 'DMENTRY', text: 'y', visibility: 'dm', auto: false },
      { id: 'j3', title: 'SECRETENTRY', text: 'z', visibility: 'private', auto: false },
      { id: 'j4', title: 'AUTOENTRY', text: 'w', visibility: 'party', auto: 'join' }
    ]
  };
}

const RELS = ['owner', 'dm', 'party', 'none'];

/* ============================================================
   The matrix
   ============================================================ */
section('Every level against every relationship');
{
  // level -> who should be able to see it
  const expect = {
    party: { owner: true, dm: true, party: true, none: false },
    dm: { owner: true, dm: true, party: false, none: false },
    private: { owner: true, dm: false, party: false, none: false }
  };

  P.PRIV_LEVELS.forEach(level => {
    RELS.forEach(rel => {
      eq(level + ' seen by ' + rel, P.privVisible(level, rel), expect[level][rel]);
    });
  });

  // an unrecognised level must be treated as the most private, never the least
  RELS.forEach(rel => {
    eq('a nonsense level seen by ' + rel,
      P.privVisible('everyone', rel), rel === 'owner');
  });
  eq('and it normalises to private', P.privNormalise('everyone'), 'private');
  eq('as does an empty one', P.privNormalise(''), 'private');
  eq('and a missing one', P.privNormalise(undefined), 'private');

  eq('the owner outranks the DM',
    P.privClearance('owner') > P.privClearance('dm'), true);
  eq('who outranks a fellow player',
    P.privClearance('dm') > P.privClearance('party'), true);
  eq('who outranks a stranger',
    P.privClearance('party') > P.privClearance('none'), true);
}

section('Section defaults');
{
  const c = fixture();
  const byKey = {};
  P.PRIV_SECTIONS.forEach(s => { byKey[s.key] = s; });

  ok('appearance and backstory are shared by default', byKey.flavour.def === 'party');
  ok('equipment notes are shared by default', byKey.gear.def === 'party');
  ok('the spell list is shared by default', byKey.spells.def === 'party');
  ok('languages are shared by default', byKey.languages.def === 'party');
  ok('the notes box starts DM-only', byKey.notes.def === 'dm');
  ok('and so do the wizard choices', byKey.choices.def === 'dm');
  ok('every section has a label', P.PRIV_SECTIONS.every(s => !!s.label));
  ok('and an explanation', P.PRIV_SECTIONS.every(s => !!s.hint));
  ok('and at least one field', P.PRIV_SECTIONS.every(s => s.fields.length > 0));
  ok('and a default that is one of the three levels',
    P.PRIV_SECTIONS.every(s => P.PRIV_LEVELS.indexOf(s.def) >= 0));

  P.PRIV_SECTIONS.forEach(s => {
    eq(s.key + ' falls back to its default', P.privLevelOf(c, s.key), s.def);
  });
  c.privacy = { flavour: 'private' };
  eq('a set level wins over the default', P.privLevelOf(c, 'flavour'), 'private');
  c.privacy = { flavour: 'nonsense' };
  eq('a mangled set level becomes private, not public',
    P.privLevelOf(c, 'flavour'), 'private');
  c.privacy = { flavour: '' };
  eq('an empty one means nothing was set, so the default applies',
    P.privLevelOf(c, 'flavour'), 'party');
  eq('a mangled possession level is private too',
    P.privItemLevel({ visibility: 'everyone' }), 'private');
  eq('but an absent one means shared, which is the default for possessions',
    P.privItemLevel({}), 'party');
  eq('a mangled entry level is private', P.privEntryLevel({ visibility: 'oops' }), 'private');

  // nothing outside the declared list is hideable, so numbers cannot be hidden
  ['baseScores', 'skills', 'level', 'name', 'armor', 'hp'].forEach(k => {
    eq('there is no way to hide ' + k, P.privSection(k), null);
  });
}

section('What each viewer is handed');
{
  const c = fixture();

  const owner = P.filterCharacter('owner', c);
  eq('the owner gets the character itself, unfiltered', owner === c, true);

  const dm = P.filterCharacter('dm', c);
  const party = P.filterCharacter('party', c);
  const none = P.filterCharacter('none', c);
  eq('a stranger gets nothing at all', none, null);

  // numbers reach everyone, because the party table is worked out from them
  [['the DM', dm], ['a fellow player', party]].forEach(([who, v]) => {
    eq(who + ' still gets the ability scores', JSON.stringify(v.baseScores),
      JSON.stringify(c.baseScores));
    eq(who + ' still gets the level', v.level, 4);
    eq(who + ' still gets the skills', v.skills.join(), 'perception');
    eq(who + ' still gets the name', v.name, 'Peacock Jones');
    eq(who + ' still gets the worn armour', v.armor, 'Leather');
  });

  // default levels: notes and choices are DM-only
  ok('the DM gets the notes box', dm.notes === 'NOTESTEXT');
  ok('a fellow player does not', party.notes === '');
  ok('the DM gets the wizard choices', Object.keys(dm.choices).length > 0);
  eq('a fellow player gets none of them', Object.keys(party.choices).length, 0);
  ok('both get the backstory, which is shared by default',
    dm.personality.backstory === 'BACKSTORYTEXT' && party.personality.backstory === 'BACKSTORYTEXT');
  ok('and the spell list', dm.spells.length === 2 && party.spells.length === 2);

  // the raw string test: withheld text must not be in the payload at all
  const partyJson = JSON.stringify(party);
  ok('NOTESTEXT is nowhere in a fellow player payload', partyJson.indexOf('NOTESTEXT') < 0);
  ok('nor CHOICETEXT', partyJson.indexOf('CHOICETEXT') < 0);

  // the settings map is the owner's own business
  eq('the DM is not told what has been hidden', dm.privacy, undefined);
  eq('nor is a fellow player', party.privacy, undefined);

  // and filtering never edits the original
  eq('the character still has its notes afterwards', c.notes, 'NOTESTEXT');
  eq('and its privacy map', typeof c.privacy, 'object');
  eq('and all three journal entries', c.journal.length, 4);
  eq('and all three possessions', c.inv.items.length, 3);
  ok('and its named possessions', c.inv.items[2].name === 'SECRETIDOL');
}

section('Hiding a section');
{
  const c = fixture();
  c.privacy = { flavour: 'private', spells: 'dm', languages: 'private' };

  const dm = P.filterCharacter('dm', c);
  const party = P.filterCharacter('party', c);

  eq('a private backstory is gone for the DM', Object.keys(dm.personality).length, 0);
  eq('and for a fellow player', Object.keys(party.personality).length, 0);
  eq('as is the appearance it travels with', Object.keys(dm.appearance).length, 0);
  ok('BACKSTORYTEXT is nowhere in the DM payload',
    JSON.stringify(dm).indexOf('BACKSTORYTEXT') < 0);
  ok('nor IDEALTEXT', JSON.stringify(dm).indexOf('IDEALTEXT') < 0);

  eq('a DM-only spell list reaches the DM', dm.spells.length, 2);
  eq('but not a fellow player', party.spells.length, 0);
  eq('and neither does the prepared list', party.prepared.length, 0);
  ok('the spell names are nowhere in a fellow player payload',
    JSON.stringify(party).indexOf('fireball') < 0);

  eq('private languages are gone for both', dm.languages.length + party.languages.length, 0);
  ok('and the language name does not leak',
    JSON.stringify(dm).indexOf('LANGUAGETEXT') < 0);

  // the shape survives, so nothing downstream trips over a missing field
  ok('a withheld object is still an object', dm.personality && typeof dm.personality === 'object');
  ok('a withheld array is still an array', Array.isArray(party.spells));
  eq('a withheld string is still a string', typeof P.filterCharacter('party',
    Object.assign(fixture(), { privacy: { gear: 'private' } })).gear, 'string');
}

section('A withheld possession still weighs and is worth what it did');
{
  const c = fixture();
  const total = c.inv.items.reduce((t, i) => t + i.weight * i.qty, 0);
  const value = c.inv.items.reduce((t, i) => t + i.cp * i.qty, 0);

  const dm = P.filterCharacter('dm', c);
  const party = P.filterCharacter('party', c);

  eq('the DM sees three lines, as there are three', dm.inv.items.length, 3);
  eq('and so does a fellow player', party.inv.items.length, 3);

  eq('the DM sees the open item by name', dm.inv.items[0].name, 'OPENSWORD');
  eq('and the one shared with them', dm.inv.items[1].name, 'DMDAGGER');
  eq('but not the private one', dm.inv.items[2].name, 'hidden item');
  ok('the DM row is flagged as withheld', dm.inv.items[2].hidden === true);

  eq('a fellow player sees the open item', party.inv.items[0].name, 'OPENSWORD');
  eq('but not the DM-only one', party.inv.items[1].name, 'hidden item');
  eq('nor the private one', party.inv.items[2].name, 'hidden item');

  // this is the point of the placeholder
  const dmWeight = dm.inv.items.reduce((t, i) => t + i.weight * i.qty, 0);
  const dmValue = dm.inv.items.reduce((t, i) => t + i.cp * i.qty, 0);
  eq('the carried weight still adds up for the DM', dmWeight, total);
  eq('and so does the value', dmValue, value);
  const pWeight = party.inv.items.reduce((t, i) => t + i.weight * i.qty, 0);
  eq('and for a fellow player', pWeight, total);
  eq('the quantity is kept too', party.inv.items[1].qty, 2);

  // but nothing identifying survives
  const pj = JSON.stringify(party);
  ok('the private name is nowhere in the payload', pj.indexOf('SECRETIDOL') < 0);
  ok('nor the DM-only name', pj.indexOf('DMDAGGER') < 0);
  const one = P.privHiddenItem(c.inv.items[2]);
  eq('a withheld line carries no catalogue reference', one.ref, null);
  eq('no stats', one.stats, '');
  eq('no note', one.note, '');
  eq('and is never shown as equipped', one.equipped, false);
  eq('the coins are untouched', party.inv.coins.gp, 10);
}

section('The journal, entry by entry');
{
  const c = fixture();
  const dm = P.filterCharacter('dm', c);
  const party = P.filterCharacter('party', c);

  eq('the DM gets the shared, the DM-only and the automatic', dm.journal.length, 3);
  eq('a fellow player gets the shared and the automatic', party.journal.length, 2);
  ok('the DM does not get the private one',
    !dm.journal.some(e => e.id === 'j3'));
  ok('and it leaves no trace', JSON.stringify(dm).indexOf('SECRETENTRY') < 0);
  ok('a fellow player gets neither the private nor the DM-only',
    JSON.stringify(party).indexOf('SECRETENTRY') < 0 &&
    JSON.stringify(party).indexOf('DMENTRY') < 0);
  ok('both see the automatic entry', dm.journal.some(e => e.auto) && party.journal.some(e => e.auto));

  // an entry with no level set is private, unlike everything else
  const c2 = fixture();
  c2.journal = [{ id: 'x', title: 'UNMARKED', text: 'q' }];
  eq('an unmarked entry defaults to private', P.privEntryLevel(c2.journal[0]), 'private');
  eq('so the DM does not get it', P.filterCharacter('dm', c2).journal.length, 0);
  eq('an unmarked possession defaults to shared, which is the other way round',
    P.privItemLevel({ id: 'y' }), 'party');
}

section('Odd input');
{
  eq('a missing character filters to nothing', P.filterCharacter('dm', null), null);
  eq('and so does an undefined one', P.filterCharacter('party', undefined), null);

  const bare = { id: 'b', name: 'Bare', ownerProfileId: 'p2' };
  const out = P.filterCharacter('dm', bare);
  ok('a character with no journal comes back with an empty one', Array.isArray(out.journal));
  eq('and no inventory is left alone', out.inv, undefined);
  eq('its name survives', out.name, 'Bare');

  const oddInv = { id: 'o', inv: { items: 'not an array' }, ownerProfileId: 'p2' };
  const oddOut = P.filterCharacter('dm', oddInv);
  eq('an inventory that is not a list is passed through untouched',
    oddOut.inv.items, 'not an array');

  const oddJournal = { id: 'q', journal: 'not an array', ownerProfileId: 'p2' };
  ok('a journal that is not a list becomes an empty one',
    Array.isArray(P.filterCharacter('dm', oddJournal).journal));

  // an unknown relationship must fail closed
  eq('an unrecognised relationship gets nothing', P.filterCharacter('nonsense', fixture()), null);
  eq('as does an empty one', P.filterCharacter('', fixture()), null);
  eq('and undefined', P.filterCharacter(undefined, fixture()), null);
}

section('A lower clearance never reveals more than a higher one');
{
  /* Filtering the DM's copy again is not the same as filtering the original,
     because the settings map is deliberately not sent on — the DM is not told
     which sections exist but are withheld. So the property worth checking is
     the ordering itself: for every field, a fellow player gets no more than
     the DM, who gets no more than the owner. */
  const cases = [
    {}, { flavour: 'dm' }, { flavour: 'private' }, { notes: 'party' },
    { spells: 'private' }, { gear: 'dm' }, { languages: 'private' },
    { flavour: 'private', gear: 'private', spells: 'private', notes: 'private', choices: 'private', languages: 'private' },
    { flavour: 'party', gear: 'party', spells: 'party', notes: 'party', choices: 'party', languages: 'party' }
  ];

  const filled = v => {
    if (v === undefined || v === null || v === '') return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') return Object.keys(v).filter(k => v[k]).length;
    return 1;
  };

  let breaches = 0;
  cases.forEach((priv, n) => {
    const c = fixture();
    c.privacy = priv;
    const owner = P.filterCharacter('owner', c);
    const dm = P.filterCharacter('dm', c);
    const party = P.filterCharacter('party', c);

    P.PRIV_SECTIONS.forEach(s => {
      s.fields.forEach(pair => {
        const k = pair[0];
        if (filled(party[k]) > filled(dm[k])) {
          breaches++;
          fails.push('case ' + n + ': a fellow player got more of ' + k + ' than the DM');
        }
        if (filled(dm[k]) > filled(owner[k])) {
          breaches++;
          fails.push('case ' + n + ': the DM got more of ' + k + ' than the owner');
        }
      });
    });

    if (party.journal.length > dm.journal.length) {
      breaches++;
      fails.push('case ' + n + ': a fellow player got more journal entries than the DM');
    }
    if (dm.journal.length > owner.journal.length) {
      breaches++;
      fails.push('case ' + n + ': the DM got more journal entries than the owner');
    }
    const hidden = v => v.inv.items.filter(i => i.hidden).length;
    if (hidden(party) < hidden(dm)) {
      breaches++;
      fails.push('case ' + n + ': a fellow player saw more possessions than the DM');
    }
    // and the totals always survive, whatever is withheld
    const w = v => v.inv.items.reduce((t, i) => t + i.weight * i.qty, 0);
    if (w(party) !== w(owner) || w(dm) !== w(owner)) {
      breaches++;
      fails.push('case ' + n + ': the carried weight stopped adding up');
    }
  });
  ok('across ' + cases.length + ' settings, no lower clearance ever saw more',
    breaches === 0, breaches + ' breaches');
  if (breaches === 0) pass += 0;   // the detail is in the loop above

  // the settings map is never handed on, at any clearance
  const c = fixture();
  c.privacy = { notes: 'private' };
  ok('the DM is not handed the settings map', P.filterCharacter('dm', c).privacy === undefined);
  ok('nor is a fellow player', P.filterCharacter('party', c).privacy === undefined);
  ok('so nobody is told which sections exist but are withheld',
    JSON.stringify(P.filterCharacter('dm', c)).indexOf('"privacy"') < 0);
}

console.log('\n' + '='.repeat(56));
if (fail) {
  console.log('\x1b[31m' + pass + ' passed, ' + fail + ' failed\x1b[0m');
  fails.forEach(f => console.log('  ✗ ' + f));
} else {
  console.log('\x1b[32m' + pass + ' passed, 0 failed\x1b[0m');
}
process.exit(fail ? 1 : 0);
