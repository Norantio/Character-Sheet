#!/usr/bin/env python3
"""
Build the item catalogues from the same offline packages used for spells.

  5e  : dnd-oracle sqlite -> equipment + magic_items   (SRD 5.1, OGL / CC-BY-4.0)
  PF2 : pf2e-database -> PF2E_DATA_EN/equipment        (ORC / OGL, Paizo Community Use)
  PF1 : pathfinder-data -> lib/data/weapons            (OGL)

Costs are stored in copper pieces so the arithmetic is exact.
Weight is pounds for 5e / PF1 / 4e, and Bulk for PF2 (L = 0.1).
"""
import glob, html, json, os, re, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
SQLITE = '/tmp/ora/package/dist/data/dnd.sqlite'
PF2DIR = '/tmp/dat/node_modules/pf2e-database/PF2E_DATA_EN/equipment'
PF1WEAP = '/tmp/pfd/package/lib/data/weapons'

CATS = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'tool', 'consumable',
        'container', 'kit', 'treasure', 'magic', 'mount', 'vehicle', 'other']


def cat_index(name):
    return CATS.index(name) if name in CATS else CATS.index('other')


def clean(s):
    if not s:
        return ''
    t = re.sub(r'<[^>]+>', ' ', str(s))
    t = html.unescape(t)
    return re.sub(r'\s+', ' ', t).strip()


def js(v):
    return json.dumps(v, ensure_ascii=False)


# ------------------------------------------------------------------ 5e
def cat_5e(row):
    c = (row['category'] or '').lower()
    if row['armor_category']:
        ac = (row['armor_category'] or '').lower()
        return 'shield' if 'shield' in ac or 'shield' in c else 'armor'
    if 'melee' in c or 'ranged' in c or 'weapon' in c:
        return 'weapon'
    if 'ammunition' in c:
        return 'ammunition'
    if 'tool' in c or 'instrument' in c or 'supplies' in c or 'kit' in c:
        return 'tool'
    if 'potion' in c or 'poison' in c:
        return 'consumable'
    if 'mount' in c or 'tack' in c:
        return 'mount'
    if 'vehicle' in c or 'waterborne' in c:
        return 'vehicle'
    if 'gemstone' in c or 'art object' in c or 'trade good' in c:
        return 'treasure'
    if 'container' in c or 'pack' in c:
        return 'container'
    return 'gear'


def build_5e():
    if not os.path.exists(SQLITE):
        print('  !! 5e sqlite missing')
        return None
    con = sqlite3.connect(SQLITE)
    con.row_factory = sqlite3.Row
    rows = []
    for r in con.execute('select * from equipment order by name'):
        unit = (r['cost_unit'] or 'gp').lower()
        mult = {'cp': 1, 'sp': 10, 'ep': 50, 'gp': 100, 'pp': 1000}.get(unit, 100)
        cp = int(round((r['cost_gp'] or 0) * mult))
        wt = float(r['weight'] or 0)
        stat = ''
        if r['damage_dice']:
            stat = r['damage_dice'] + ' ' + (r['damage_type'] or '').lower()
            try:
                props = json.loads(r['weapon_properties'] or '[]')
                if props:
                    stat += ' (' + ', '.join(props).lower() + ')'
            except Exception:
                pass
            if r['range_normal'] and r['weapon_range'] != 'Melee':
                stat += ' range ' + str(int(r['range_normal'])) + \
                    ('/' + str(int(r['range_long'])) if r['range_long'] else '')
        elif r['ac_base']:
            stat = 'AC ' + str(int(r['ac_base']))
            if r['ac_dex_bonus']:
                stat += ' + Dex' + (' (max ' + str(int(r['ac_max_bonus'])) + ')' if r['ac_max_bonus'] else '')
            if r['str_minimum']:
                stat += ', Str ' + str(int(r['str_minimum']))
            if r['stealth_disadvantage']:
                stat += ', stealth disadvantage'
        rows.append([r['name'], cat_index(cat_5e(r)), cp, wt, clean(r['category']), stat, 0, ''])
    # magic items: no weight or price in the SRD tables, but the text matters
    for r in con.execute('select * from magic_items order by name'):
        note = clean(r['description'])
        rows.append([r['name'], cat_index('magic'), 0, 0.0,
                     clean(r['type'] or 'Wondrous item') + ' · ' + clean(r['rarity'] or ''),
                     'attunement' if r['requires_attunement'] else '',
                     1 if r['requires_attunement'] else 0,
                     note[:600]])
    return rows


# ------------------------------------------------------------------ PF2
def cat_pf2(d, s):
    t = d.get('type')
    c = (s.get('category') or '').lower()
    grp = (s.get('group') or '').lower()
    if t == 'weapon':
        return 'weapon'
    if t == 'armor':
        return 'shield' if c == 'shield' or grp == 'shield' else 'armor'
    if t == 'consumable':
        cc = (s.get('category') or '').lower()
        return 'ammunition' if cc == 'ammo' else 'consumable'
    if t == 'treasure':
        return 'treasure'
    if t == 'backpack':
        return 'container'
    if t == 'kit':
        return 'kit'
    if (s.get('level') or {}).get('value', 0) > 0:
        return 'magic'
    return 'gear'


def bulk_pf2(s):
    w = (s.get('weight') or {}).get('value')
    if w is None or w == '' or w == '-':
        return 0.0
    w = str(w).strip().upper()
    if w == 'L':
        return 0.1
    try:
        return float(w)
    except ValueError:
        return 0.0


def price_pf2(s):
    p = ((s.get('price') or {}).get('value')) or {}
    if not isinstance(p, dict):
        return 0
    return int(round(p.get('cp', 0) + p.get('sp', 0) * 10 +
                     p.get('gp', 0) * 100 + p.get('pp', 0) * 1000))


def build_pf2():
    files = sorted(glob.glob(os.path.join(PF2DIR, '*.json')))
    if not files:
        print('  !! PF2 equipment missing')
        return None
    rows = []
    for fp in files:
        try:
            d = json.load(open(fp, encoding='utf-8'))
        except Exception:
            continue
        s = d.get('system') or {}
        traits = (s.get('traits') or {})
        lvl = (s.get('level') or {}).get('value', 0)
        stat = ''
        dmg = s.get('damage') or {}
        if dmg.get('die'):
            stat = str(dmg.get('dice', 1)) + dmg['die'] + ' ' + (dmg.get('damageType') or '')
        elif d.get('type') == 'armor':
            ac = s.get('acBonus')
            if ac is not None:
                stat = 'AC +' + str(ac)
        usage = (s.get('usage') or {}).get('value') or ''
        sub = ' · '.join([x for x in [
            (s.get('category') or ''), (s.get('group') or ''),
            ('level ' + str(lvl)) if lvl else ''] if x])
        rows.append([
            d.get('name', '?'), cat_index(cat_pf2(d, s)), price_pf2(s), bulk_pf2(s),
            sub, stat, 0,
            ((traits.get('rarity') or 'common') if (traits.get('rarity') or 'common') != 'common' else '')
        ])
    rows.sort(key=lambda r: r[0])
    return rows


# ------------------------------------------------------------------ PF1
def build_pf1():
    rows = []
    for fp in sorted(glob.glob(os.path.join(PF1WEAP, '*.json'))):
        try:
            d = json.load(open(fp, encoding='utf-8'))
        except Exception:
            continue
        cost = d.get('cost') or ''
        m = re.match(r'([\d,]+)\s*(cp|sp|gp|pp)', str(cost).replace(' ', ''), re.I)
        cp = 0
        if m:
            mult = {'cp': 1, 'sp': 10, 'gp': 100, 'pp': 1000}[m.group(2).lower()]
            cp = int(m.group(1).replace(',', '')) * mult
        wm = re.match(r'([\d.]+)', str(d.get('weight') or '').strip())
        wt = float(wm.group(1)) if wm else 0.0
        dmg = d.get('damage') or {}
        stat = ' '.join(filter(None, [
            dmg.get('medium') or '',
            (dmg.get('critical') or ''),
            '/'.join(dmg.get('type') or []).lower()
        ])).strip()
        rows.append([d.get('name', '?'), cat_index('weapon'), cp, wt, 'weapon', stat, 0, ''])
    return rows


# ------------------------------------------------------------------ emit
HEADER = """/* ============================================================
   %(title)s
   ------------------------------------------------------------
   %(licence)s

   Rows: [name, categoryIndex, costInCopper, weight, subtitle,
          stats, needsAttunement, note]
   ============================================================ */

%(catdecl)sconst ITEMDATA_%(key)s = [
%(rows)s
];
"""


def emit(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('  wrote %-24s %7.1f KB' % (os.path.basename(path), os.path.getsize(path) / 1024))


def rows_js(rows):
    out = []
    for r in rows:
        cells = []
        for c in r:
            if isinstance(c, str):
                cells.append(js(c))
            elif isinstance(c, float):
                cells.append(('%g' % c))
            else:
                cells.append(str(c))
        out.append('[' + ','.join(cells) + ']')
    return ',\n'.join(out)


def main():
    print('Extracting items...')
    d5 = build_5e()
    if d5:
        emit(os.path.join(HERE, '83-items-5e.js'), HEADER % {
            'title': 'D&D 5e equipment and magic items — SRD 5.1',
            'licence': 'System Reference Document 5.1 Copyright 2016, Wizards of the Coast, Inc.\n   Open Gaming License / CC-BY-4.0.',
            'catdecl': 'const ITEMCATS = ' + js(CATS) + ';\n', 'key': '5E', 'rows': rows_js(d5)})
        print('  5e items:', len(d5))
    d2 = build_pf2()
    if d2:
        emit(os.path.join(HERE, '84-items-pf2.js'), HEADER % {
            'title': 'Pathfinder 2e equipment',
            'licence': 'From the Pathfinder Second Edition system for Foundry VTT.\n   Open Game License / ORC. Pathfinder is a trademark of Paizo Inc.,\n   used under Paizo\'s Community Use Policy.',
            'catdecl': '', 'key': 'PF2', 'rows': rows_js(d2)})
        print('  pf2 items:', len(d2))
    d1 = build_pf1()
    if d1:
        emit(os.path.join(HERE, '87-items-pf1.js'), HEADER % {
            'title': 'Pathfinder 1e weapons',
            'licence': 'Machine-readable extract of the Pathfinder RPG weapon tables.\n   Open Game License v1.0a.',
            'catdecl': '', 'key': 'PF1', 'rows': rows_js(d1)})
        print('  pf1 weapons:', len(d1))

    for label, data in [('5e', d5), ('pf2', d2), ('pf1', d1)]:
        if not data:
            continue
        import collections
        cnt = collections.Counter(CATS[r[1]] for r in data)
        print('  %-4s %s' % (label, dict(cnt.most_common())))


if __name__ == '__main__':
    main()
