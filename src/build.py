#!/usr/bin/env python3
"""Build the client from src/.

Two targets, same source:

  character-forge.html          one self-contained file, works offline from disk
  server/public/{index,app.css,app.js}
                                the same client split up, so a browser caches
                                the 2.6 MB of spell and item data instead of
                                re-downloading it on every page load

    python3 build.py            build both
    python3 build.py --single    just the offline file
    python3 build.py --server    just the server bundle
"""
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SINGLE_OUT = os.path.join(ROOT, 'character-forge.html')
PUBLIC_DIR = os.path.join(ROOT, 'server', 'public')

JS_FILES = ['10-core.js', '20-dnd5e.js', '21-dnd55e.js', '30-dnd4e.js', '40-pf1.js', '50-pf2.js',
            '60-engine.js', '70-ui.js',
            '80-spells-5e.js', '81-spells-pf2.js', '82-spells-pf1.js',
            '85-spellbook.js', '86-spells-ui.js',
            '90-play.js', '91-sheet.js',
            '83-items-5e.js', '84-items-pf2.js', '87-items-pf1.js', '88-items-extra.js',
            '92-inventory.js', '93-inventory-ui.js',
            '95-store.js', '96-signin.js', '97-campaigns.js',
            '98-journal.js', '99-privacy.js',
            '100-privacy-ui.js', '101-live.js']

HEAD = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Character Forge — multi-system RPG character builder</title>
<meta name="description" content="Character builder for D&amp;D 5th Edition, D&amp;D 4th Edition, Pathfinder 1st Edition and Pathfinder 2nd Edition.">"""

BODY = """<div class="topbar" id="topbar"></div>
<div class="connbar" id="connbar"></div>
<div id="app"><div class="empty">Loading…</div></div>
<noscript><div class="empty">This builder needs JavaScript enabled.</div></noscript>"""


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def kb(text):
    return len(text.encode('utf-8')) / 1024


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return kb(text)


css = read('style.css')
js = '\n\n'.join('/* ===== %s ===== */\n%s' % (n, read(n)) for n in JS_FILES)

args = sys.argv[1:]
do_single = '--server' not in args
do_server = '--single' not in args

if do_single:
    html = """<!DOCTYPE html>
<html lang="en">
<head>
%s
<style>
%s
</style>
</head>
<body>
%s
<script>
%s
</script>
</body>
</html>
""" % (HEAD, css, BODY, js)
    print('wrote %s (%.1f KB)' % (SINGLE_OUT, write(SINGLE_OUT, html)))

if do_server:
    # The server requires the privacy rules rather than restating them, so a
    # copy of that one file lives beside it. A test checks they stay identical.
    shared = read('99-privacy.js')
    banner = ('/* Copied from src/99-privacy.js by build.py. Do not edit here —\n'
              '   edit src/99-privacy.js and run the build again. */\n')
    write(os.path.join(ROOT, 'server', 'privacy.js'), banner + shared)

    # A content hash in the query string means the browser caches app.js hard
    # but still picks up a rebuild immediately.
    tag = hashlib.sha256((css + js).encode('utf-8')).hexdigest()[:10]
    page = """<!DOCTYPE html>
<html lang="en">
<head>
%s
<link rel="stylesheet" href="app.css?v=%s">
</head>
<body>
%s
<script src="app.js?v=%s"></script>
</body>
</html>
""" % (HEAD, tag, BODY, tag)
    a = write(os.path.join(PUBLIC_DIR, 'index.html'), page)
    b = write(os.path.join(PUBLIC_DIR, 'app.css'), css)
    c = write(os.path.join(PUBLIC_DIR, 'app.js'), js)
    print('wrote %s (index %.1f KB + css %.1f KB + js %.1f KB, build %s)'
          % (PUBLIC_DIR, a, b, c, tag))
