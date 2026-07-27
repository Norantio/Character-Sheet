#!/usr/bin/env python3
"""
Build src/80-spells-5e.js and src/81-spells-pf2.js from offline package data.

Sources (both redistributable):
  5e  : dnd-oracle npm package -> dist/data/dnd.sqlite   (SRD 5.1, OGL / CC-BY-4.0)
  PF2 : pf2e-database npm package -> PF2E_DATA_EN/spells (ORC / OGL, Paizo Community Use)

Output is a compact JS array plus a decoder, so the single-file HTML stays as
small as possible while keeping the complete rules text.
"""
import json, os, re, sqlite3, sys, html, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SQLITE = '/tmp/ora/package/dist/data/dnd.sqlite'
PF2DIR = '/tmp/dat/node_modules/pf2e-database/PF2E_DATA_EN/spells'


# ---------------------------------------------------------------- helpers
def clean_html(s):
    """Foundry descriptions are HTML with @UUID/@Damage enrichers. Make them plain text."""
    if not s:
        return ''
    t = s
    # Foundry enrichers: @UUID[...]{Label} -> Label ; @Damage[2d6[fire]] -> 2d6 fire
    t = re.sub(r'@(?:UUID|Compendium)\[[^\]]*\]\{([^}]*)\}', r'\1', t)
    t = re.sub(r'@(?:UUID|Compendium)\[[^\]]*\]', '', t)
    t = re.sub(r'@Damage\[([^\]\[]*(?:\[[^\]]*\])?[^\]]*)\]\{([^}]*)\}', r'\2', t)
    t = re.sub(r'@Damage\[([^\]]*)\]', lambda m: re.sub(r'[\[\]]', ' ', m.group(1)).strip(), t)
    t = re.sub(r'@Check\[([^\]]*)\]\{([^}]*)\}', r'\2', t)
    t = re.sub(r'@Check\[([^\]]*)\]', lambda m: m.group(1).split('|')[0], t)
    t = re.sub(r'@Template\[([^\]]*)\]\{([^}]*)\}', r'\2', t)
    t = re.sub(r'@Template\[([^\]]*)\]', '', t)
    t = re.sub(r'@Localize\[[^\]]*\]', '', t)
    t = re.sub(r'@[A-Za-z]+\[[^\]]*\]\{([^}]*)\}', r'\1', t)
    t = re.sub(r'@[A-Za-z]+\[[^\]]*\]', '', t)
    # structural tags -> newlines
    t = re.sub(r'<\s*(br|hr)\s*/?\s*>', '\n', t, flags=re.I)
    t = re.sub(r'</\s*(p|li|tr|h[1-6]|div)\s*>', '\n', t, flags=re.I)
    t = re.sub(r'<\s*li[^>]*>', '• ', t, flags=re.I)
    t = re.sub(r'<\s*(strong|b)\s*>', '**', t, flags=re.I)
    t = re.sub(r'</\s*(strong|b)\s*>', '**', t, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r' *\n *', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def js_string(s):
    """JSON-encode; JSON strings are valid JS strings."""
    return json.dumps(s, ensure_ascii=False)


# ---------------------------------------------------------------- 5e
SCHOOL_5E = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment',
             'Evocation', 'Illusion', 'Necromancy', 'Transmutation']
CLASS_5E = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']


def build_5e():
    if not os.path.exists(SQLITE):
        print('  !! 5e sqlite missing at', SQLITE)
        return None, 0
    con = sqlite3.connect(SQLITE)
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute('select * from spells order by level, name')]
    out = []
    for r in rows:
        classes = []
        try:
            for c in json.loads(r['classes'] or '[]'):
                cl = c.strip().lower()
                if cl in CLASS_5E:
                    classes.append(CLASS_5E.index(cl))
        except Exception:
            pass
        comp = ''
        if r['components_v']:
            comp += 'V'
        if r['components_s']:
            comp += 'S'
        if r['components_m']:
            comp += 'M'
        school = r['school'] or ''
        si = SCHOOL_5E.index(school.title()) if school.title() in SCHOOL_5E else -1
        out.append([
            r['name'],
            r['level'],
            si,
            r['casting_time'] or '',
            r['range'] or '',
            r['duration'] or '',
            comp,
            r['material_description'] or '',
            1 if r['concentration'] else 0,
            1 if r['ritual'] else 0,
            sorted(classes),
            clean_html(r['description'] or ''),
            clean_html(r['higher_level'] or ''),
            r['damage_type'] or '',
            r['save_type'] or ''
        ])
    return out, len(out)


# ---------------------------------------------------------------- PF2
PF2_TRADITIONS = ['arcane', 'divine', 'occult', 'primal']
ACTION_LABEL = {'1': '1 action', '2': '2 actions', '3': '3 actions',
                'reaction': 'reaction', 'free': 'free action'}


def pf2_cast_time(system):
    t = (system.get('time') or {}).get('value', '')
    t = str(t).strip()
    return ACTION_LABEL.get(t, t)


def build_pf2():
    files = sorted(glob.glob(os.path.join(PF2DIR, '*.json')))
    if not files:
        print('  !! PF2 spell dir missing at', PF2DIR)
        return None, 0
    out = []
    for fp in files:
        try:
            d = json.load(open(fp, encoding='utf-8'))
        except Exception as e:
            print('  skip', os.path.basename(fp), e)
            continue
        if d.get('type') != 'spell':
            continue
        s = d.get('system') or {}
        traits = s.get('traits') or {}
        tv = [str(x) for x in (traits.get('value') or [])]
        # cantrips and focus spells are both flagged by trait, not by a category field
        is_cantrip = 'cantrip' in tv
        is_focus = 'focus' in tv
        trads = [PF2_TRADITIONS.index(t) for t in (traits.get('traditions') or [])
                 if t in PF2_TRADITIONS]
        area = s.get('area') or {}
        area_s = ''
        if area and area.get('value'):
            area_s = '%s-foot %s' % (area.get('value'), area.get('type') or 'area')
        save = ((s.get('defense') or {}).get('save') or {})
        save_s = save.get('statistic') or ''
        if save_s and save.get('basic'):
            save_s = 'basic ' + save_s
        dur = (s.get('duration') or {})
        dur_s = dur.get('value') or ''
        if dur.get('sustained'):
            dur_s = ('sustained' + (' up to ' + dur_s if dur_s else ''))
        pub = s.get('publication') or {}
        desc = clean_html((s.get('description') or {}).get('value', ''))
        out.append([
            d.get('name', '?'),
            (s.get('level') or {}).get('value', 1),
            1 if is_cantrip else 0,
            1 if is_focus else 0,
            pf2_cast_time(s),
            (s.get('range') or {}).get('value', '') or '',
            (s.get('target') or {}).get('value', '') or '',
            area_s,
            dur_s,
            save_s,
            sorted(trads),
            sorted(tv),
            traits.get('rarity') or 'common',
            desc,
            pub.get('title') or '',
            1 if pub.get('remaster') else 0
        ])
    out.sort(key=lambda r: (r[1], r[0]))
    return out, len(out)


# ---------------------------------------------------------------- emit
HEADER_5E = """/* ============================================================
   D&D 5e spell catalogue — SRD 5.1
   ------------------------------------------------------------
   System Reference Document 5.1 Copyright 2016, Wizards of the
   Coast, Inc.; Authors Mike Mearls, Jeremy Crawford, Chris Perkins,
   Rodney Thompson, Peter Lee, James Wyatt, Robert J. Schwalb,
   Bruce R. Cordell, Chris Sims, and Steve Townshend, based on
   original material by E. Gary Gygax and Dave Arneson.
   Available under the Open Gaming License / CC-BY-4.0.

   Rows are packed as arrays to keep this file small:
   [name, level, schoolIndex, castingTime, range, duration,
    components, material, concentration, ritual, [classIdx],
    description, higherLevel, damageType, saveType]
   ============================================================ */

const SPELL_SCHOOLS_5E = %s;
const SPELL_CLASSES_5E = %s;
const SPELLDATA_5E = [
%s
];

function unpackSpells5e() {
  return SPELLDATA_5E.map((r, i) => ({
    uid: '5e:' + i,
    system: '5e',
    name: r[0],
    level: r[1],
    school: r[2] >= 0 ? SPELL_SCHOOLS_5E[r[2]] : '',
    castingTime: r[3],
    range: r[4],
    duration: r[5],
    components: r[6],
    material: r[7],
    concentration: !!r[8],
    ritual: !!r[9],
    classes: r[10].map(x => SPELL_CLASSES_5E[x]),
    text: r[11],
    higher: r[12],
    damageType: r[13],
    save: r[14],
    source: 'SRD 5.1'
  }));
}
"""

HEADER_PF2 = """/* ============================================================
   Pathfinder 2e spell catalogue
   ------------------------------------------------------------
   Spell data extracted from the Pathfinder Second Edition system
   for Foundry VTT (github.com/foundryvtt/pf2e), which publishes
   game mechanics under the Open Game License and the ORC License.
   Pathfinder is a trademark of Paizo Inc.; used under Paizo's
   Community Use Policy (paizo.com/community/communityuse).

   Rows are packed as arrays:
   [name, rank, isCantrip, isFocus, castTime, range, target, area,
    duration, save, [traditionIdx], [traits], rarity, text,
    sourceTitle, remaster]
   ============================================================ */

const SPELL_TRADITIONS_PF2 = %s;
const SPELLDATA_PF2 = [
%s
];

function unpackSpellsPf2() {
  return SPELLDATA_PF2.map((r, i) => ({
    uid: 'pf2:' + i,
    system: 'pf2',
    name: r[0],
    level: r[1],
    cantrip: !!r[2],
    focus: !!r[3],
    castingTime: r[4],
    range: r[5],
    target: r[6],
    area: r[7],
    duration: r[8],
    save: r[9],
    traditions: r[10].map(x => SPELL_TRADITIONS_PF2[x]),
    traits: r[11],
    rarity: r[12],
    text: r[13],
    source: r[14],
    remaster: !!r[15]
  }));
}
"""


def emit(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    kb = os.path.getsize(path) / 1024
    print('  wrote %-24s %7.1f KB' % (os.path.basename(path), kb))


def rows_js(rows):
    return ',\n'.join('[' + ','.join(js_string(c) if isinstance(c, str) else
                                     (json.dumps(c) if not isinstance(c, int) else str(c))
                                     for c in r) + ']' for r in rows)


def main():
    print('Extracting spells...')
    d5, n5 = build_5e()
    if d5:
        emit(os.path.join(HERE, '80-spells-5e.js'),
             HEADER_5E % (json.dumps(SCHOOL_5E), json.dumps(CLASS_5E), rows_js(d5)))
        print('  5e spells:', n5)
    d2, n2 = build_pf2()
    if d2:
        emit(os.path.join(HERE, '81-spells-pf2.js'),
             HEADER_PF2 % (json.dumps(PF2_TRADITIONS), rows_js(d2)))
        print('  pf2 spells:', n2)

    # quick sanity report
    if d5:
        fb = [r for r in d5 if r[0] == 'Fireball']
        print('  5e Fireball ->', fb[0][1], SCHOOL_5E[fb[0][2]], fb[0][6],
              [CLASS_5E[i] for i in fb[0][10]], len(fb[0][11]), 'chars')
    if d2:
        fb = [r for r in d2 if r[0] == 'Fireball']
        print('  pf2 Fireball -> rank', fb[0][1], 'trads',
              [PF2_TRADITIONS[i] for i in fb[0][10]], len(fb[0][13]), 'chars')


if __name__ == '__main__':
    main()
