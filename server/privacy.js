/* Copied from src/99-privacy.js by build.py. Do not edit here —
   edit src/99-privacy.js and run the build again. */
/* ============================================================
   Who may see what.

   This file is the only place that decides it, and it is used by both sides:
   the browser loads it as part of the bundle, and the server requires a copy
   of the very same file (build.py writes it to server/privacy.js). One set of
   rules, so the preview a player sees cannot disagree with what the server
   actually sends.

   Three levels, in the same words everywhere:

     party    everyone in the campaign, the DM included
     dm       the DM and you
     private  you only — not even the DM

   Numbers are deliberately not hideable. Ability scores, AC, hit points,
   saves and skills are always shared with the table, because the DM's party
   table is worked out from them and a sheet that hid them would simply show
   blanks. What you can keep back is what is yours to keep back: prose,
   your spell list, individual possessions, and your journal.
   ============================================================ */

const PRIV_LEVELS = ['party', 'dm', 'private'];

/* Each hideable part of a sheet, and what it covers. `blank` is what the
   field becomes when it is withheld: the shape stays, so nothing downstream
   has to guard against a missing field. */
const PRIV_SECTIONS = [
  {
    key: 'flavour', label: 'Appearance and backstory', def: 'party',
    hint: 'What you look like, your ideals, bonds, flaws and history.',
    fields: [['appearance', {}], ['personality', {}]]
  },
  {
    key: 'gear', label: 'Equipment notes', def: 'party',
    hint: 'The free-text gear box, and starting wealth.',
    fields: [['gear', ''], ['gold', '']]
  },
  {
    key: 'spells', label: 'Spell list', def: 'party',
    hint: 'Which spells you know and have prepared. Your slots and save DC still show.',
    fields: [['spells', []], ['prepared', []]]
  },
  {
    key: 'choices', label: 'Wizard choices', def: 'dm',
    hint: 'The record of what you picked while building the character.',
    fields: [['choices', {}]]
  },
  {
    key: 'notes', label: 'Feats and options', def: 'dm',
    hint: 'Your own notes box.',
    fields: [['notes', '']]
  },
  {
    key: 'languages', label: 'Languages', def: 'party',
    hint: 'Which languages you speak.',
    fields: [['languages', []]]
  }
];

/* How much a viewer is allowed to see. */
function privClearance(rel) {
  if (rel === 'owner') return 3;
  if (rel === 'dm') return 2;
  if (rel === 'party') return 1;
  return 0;
}
/* An unrecognised value is treated as private, so a typo or a mangled save errs
   towards keeping something back rather than publishing it. */
function privNormalise(level) {
  return PRIV_LEVELS.indexOf(level) >= 0 ? level : 'private';
}
/* What a level costs to see. Normalised first, so anything unrecognised costs
   the most rather than the least — this must fail closed. */
function privCost(level) {
  const l = privNormalise(level);
  return l === 'private' ? 3 : l === 'dm' ? 2 : 1;
}
function privVisible(level, rel) {
  return privClearance(rel) >= privCost(level);
}

function privSection(key) {
  return PRIV_SECTIONS.filter(s => s.key === key)[0] || null;
}
/* Nothing set at all means the section's default. Something set but not
   recognised means private: an absent choice is a choice, a corrupted one is not.
   The same distinction applies to items and entries below. */
function privUnset(v) { return v === undefined || v === null || v === ''; }

function privLevelOf(c, key) {
  const set = c && c.privacy && c.privacy[key];
  if (!privUnset(set)) return privNormalise(set);
  const s = privSection(key);
  return s ? s.def : 'party';
}
/* Items and journal entries carry their level on themselves. Possessions are
   shared by default; journal entries are not. */
function privItemLevel(item) {
  const set = item && item.visibility;
  return privUnset(set) ? 'party' : privNormalise(set);
}
function privEntryLevel(entry) {
  const set = entry && entry.visibility;
  return privUnset(set) ? 'private' : privNormalise(set);
}

/* A withheld possession still weighs what it weighs and is worth what it is
   worth, or the totals on the viewer's screen would not add up and they would
   reasonably think the sheet was broken. What is withheld is what it *is*. */
function privHiddenItem(i) {
  return {
    id: i.id,
    ref: null,
    name: 'hidden item',
    cat: 'gear',
    qty: i.qty,
    weight: i.weight,
    cp: i.cp,
    stats: '',
    sub: null,
    attune: false,
    attuned: false,
    equipped: false,
    note: '',
    visibility: privItemLevel(i),
    hidden: true
  };
}

/* The one function that decides what a viewer gets. Never mutates the
   character it is given. */
function filterCharacter(rel, c) {
  if (!c) return null;
  if (rel === 'owner') return c;
  if (privClearance(rel) < 1) return null;

  const out = {};
  for (const k in c) if (Object.prototype.hasOwnProperty.call(c, k)) out[k] = c[k];

  // prose and lists, section by section
  PRIV_SECTIONS.forEach(s => {
    if (privVisible(privLevelOf(c, s.key), rel)) return;
    s.fields.forEach(pair => {
      const blank = pair[1];
      out[pair[0]] = Array.isArray(blank) ? [] : (blank && typeof blank === 'object' ? {} : blank);
    });
  });

  // possessions, one at a time
  if (c.inv && Array.isArray(c.inv.items)) {
    const items = c.inv.items.map(i =>
      privVisible(privItemLevel(i), rel) ? i : privHiddenItem(i));
    out.inv = {};
    for (const k in c.inv) if (Object.prototype.hasOwnProperty.call(c.inv, k)) out.inv[k] = c.inv[k];
    out.inv.items = items;
  }

  // the journal, entry by entry
  out.journal = (Array.isArray(c.journal) ? c.journal : [])
    .filter(e => privVisible(privEntryLevel(e), rel));

  // the settings themselves are the owner's business
  delete out.privacy;

  return out;
}

/* Loaded by the server with require(); harmless in a browser, where there is
   no module object. */
if (typeof module === 'object' && module && module.exports) {
  module.exports = {
    PRIV_LEVELS, PRIV_SECTIONS,
    privClearance, privCost, privNormalise, privVisible,
    privSection, privLevelOf, privItemLevel, privEntryLevel,
    privHiddenItem, filterCharacter
  };
}
