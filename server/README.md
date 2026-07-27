# Running Character Forge for the table

Two ways to use the app. You do not have to choose once and for all — the same
build does both.

## On your own, no server

Open `character-forge.html` (in the folder above this one). Everything works;
your characters are saved in that browser on that device. Nothing else needed.

## For the group, on your network

One machine hosts. It needs Node.js installed and needs to be awake while
people are playing. From this folder:

```
node server.js
```

It prints something like:

```
  On this machine:   http://localhost:8080
  On the network:    http://192.168.1.20:8080
```

Give the network address to everyone at the table. They open it in a browser on
a tablet, phone or laptop — nothing to install.

The first time someone opens it they pick their name, or tap **Add me**. They can
set a PIN if other people use the same device. *Remember me* is on by default, so
nobody retypes anything after the first time.

### Options

```
node server.js --port 9000            use a different port
node server.js --data /some/where     keep the data elsewhere
node server.js --reset-pin "Nick"     clear a forgotten PIN
node server.js --name "Tuesday Game"  a label for this server
```

### Everyone's screen keeps up on its own

When someone changes something — takes damage, levels up, joins the table — everybody
else's page updates within a second or so. Nobody needs to reload anything. The connection
bar says **live** when that is working, or *checking every 10s* on an older browser that
cannot hold a connection open.

It will not interrupt you. If you are mid-way through the wizard, typing in a box, or one
of your own saves is still going out, the bar shows *someone else made a change* with a
**Catch up** button and waits until you are done.

### Where the data lives

`data/db.json`, beside this file. Every save also keeps:

- `data/db.bak.json` — the version immediately before the last write
- `data/db.YYYY-MM-DD.json` — one snapshot per day

Writes go to a temporary file and are then renamed, so a crash or a pulled power
cable cannot leave a half-written file. If `db.json` is ever unreadable the
server falls back to `db.bak.json` and says so on startup, without deleting
anything.

To back it up, copy the `data` folder.

### Putting a backup back

```
node server.js --list-backups
```

shows what has been kept, with a one-line summary of each — how many people, characters and
campaigns are in it — so you can tell which one you want. Then:

```
node server.js --restore db.2026-07-20.json
```

Stop the server first. It refuses anything that is missing, unreadable, or not a Character
Forge database, and says which — changing nothing. Before it writes, it copies what is
there now to `db.before-restore.<timestamp>.json`, so if you restore the wrong day you can
restore your way back out of it.

### What each person can see

Everyone at a table can see the party — names, classes, levels, AC, hit points and the
rest of the numbers. Those are always shared, because the DM's party table is worked out
from them.

Beyond that, each player decides. On your own sheet there is a **Who can see what** box,
and each entry says one of three things: **the table**, **the DM**, or **just me**. Tap it
to change it. Individual possessions and individual journal entries have their own control,
so you can hold one thing back without hiding the rest.

Two things worth knowing:

- **The server does the hiding, not the page.** Something you keep to yourself is not
  merely left off someone else's screen — it is never sent to their device at all.
- **A withheld possession still counts.** Others see a nameless "hidden item" with its
  weight and value, so their totals add up. They can tell you are carrying something; they
  cannot tell what.

There is a preview on your own sheet — *look at this sheet as: me / the DM / the table* —
which runs through exactly the same rules the server does. Use it if you want to check
what you are publishing before anyone else sees it.

### A note on what the PIN is for

PINs are stored hashed with a per-profile salt, so a copy of `db.json` does not
reveal them. But this is a locked door, not a vault: the PIN is a few digits and
it crosses a plain-HTTP network. It exists so a housemate cannot tap the DM's
profile and read the villain's notes. Do not expose this server to the internet,
and do not reuse a PIN you use for anything that matters.

Also worth knowing: whoever hosts has `db.json` on their machine, so anything a
player marks private-from-DM is still in a file on the host's disk. If that
matters to your group, have someone other than the DM host it.

### Rebuilding after a change

```
python3 src/build.py
```

That writes `character-forge.html`, `server/public/`, and `server/privacy.js` — which is
a copy of `src/99-privacy.js`, the one file that decides who can see what. The server
loads that copy rather than having its own version, so the preview a player is shown and
what the server actually sends can never disagree. Do not edit `server/privacy.js`
directly; edit the file in `src/` and build again. `node src/test-privacy.js` fails if the
two ever differ.

Restart the server to pick up a new `server.js` or `privacy.js`; the client files are read
per request, so a browser refresh is enough for those.
