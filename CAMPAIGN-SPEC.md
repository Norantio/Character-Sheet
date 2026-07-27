# Campaigns, roles and permissions — design spec

**Revision 2.** Rewritten after the decision to run a LAN-hosted server rather than
exchange files. Nothing has been built yet. This document is for approval.

Decisions taken so far:

| Question | Answer |
|---|---|
| How data moves | **Locally hosted site on the LAN**, served from a laptop |
| Runtime on the host | **Node.js**, dependency-free |
| When the host is off | **Local mode stays** — the app still works standalone |
| DM powers | **View only** to start |
| Privacy | **Private fields are withheld by the server** |
| Identity | **Pick your name, with a per-profile PIN** |
| Scope of first build | Everything through privacy and sharing |

---

## 1. What changes, architecturally

Today: one HTML file, data in one browser's localStorage, no server.

Proposed: the same client, plus a small Node server on the LAN that owns the shared
data. This is a genuine improvement over the file-exchange plan in revision 1:

- **Permissions become real.** The server decides what each client is sent. A player's
  private fields are never serialised into the DM's response, so they do not exist in
  the DM's browser. Nothing relies on the UI politely not drawing them.
- **State is live**, not a snapshot stamped "as of Tuesday".
- **Nothing to install on the tablets.** Players open `http://192.168.x.x:8080`.

The cost: it is no longer a single self-contained file, and the host machine has to be
awake. Local mode covers the second problem.

### Two modes, one codebase

On start the client pings `/api/ping`.

| | **Local mode** | **Connected mode** |
|---|---|---|
| Triggered by | opened as a file, or no server answers | served by the server |
| Data lives in | this browser's localStorage | `db.json` on the host |
| Campaigns | single-player: you can still make one and add your own characters | shared with everyone on the LAN |
| Privacy | a convention on a shared device | withheld by the server |

The topbar states which mode you are in. This matters: a player should never be unsure
whether their sheet is on the group's server or only on their own tablet.

**Implementation approach.** I introduce a persistence layer with two implementations
behind the function names the app already calls (`loadRoster`, `saveRoster` and so on).
The UI code does not learn about the server. That is the cheapest way to add this
without destabilising the 1,854 assertions currently passing.

### Build outputs

Two artefacts from the same `src/`:

- `character-forge.html` — the single offline file, as today, for local mode
- `server/` — `server.js` plus a split client (HTML, one CSS, several JS) so the 2.7 MB
  of spell and item data is cached by the browser instead of re-sent on every load

---

## 2. Data model

Held by the server in `data/db.json`, written atomically (temp file, then rename) with
the previous version kept as `db.bak.json` and a timestamped copy each day.

```
profiles    [ { id, name, colour, createdAt } ]

campaigns   [ { id, name, system, dmProfileId, blurb, createdAt, updatedAt,
                members:  [ { characterId, profileId, joinedAt, leftAt|null } ],
                sessions: [ { id, n, date, title, notes, visibility } ] } ]

characters  [ { ...every field the character object has today,
                ownerProfileId,
                campaignId | null,
                campaignHistory: [ { campaignId, name, joinedAt, leftAt } ],
                privacy: { <section or item id>: 'party' | 'dm' | 'private' },
                journal: [ { id, date, title, text, tags[], visibility, auto } ],
                updatedAt, rev } ]
```

`rev` increments on every write so the client can detect that someone else changed a
sheet since it loaded.

**Migration.** Existing characters keep working untouched. On first upload to a server
they gain `ownerProfileId`, a null `campaignId`, an empty journal and default privacy.
In local mode the same defaults are applied lazily, exactly as `play` and `inv` are today.

**A campaign is locked to one game system.** A 5e campaign accepts 5e characters. Mixed
parties do not work mechanically and the party table would be meaningless.

---

## 3. Visibility model

Three levels, the same vocabulary everywhere:

| Level | Who sees it |
|---|---|
| `party` | everyone in the campaign, DM included |
| `dm` | the DM and the owner |
| `private` | the owner only — **not the DM** |

### Defaults

| Thing | Default |
|---|---|
| Ability scores, AC, HP, saves, skills, attacks | `party` |
| Spell list, resources, features | `party` |
| Appearance, ideals, bonds, flaws, backstory | `party` |
| Feats and options notes | `dm` |
| Inventory items | `party`, individually overridable |
| Journal entries | `private` unless you change them |

### The awkward case, handled honestly

If a private item were simply deleted from the DM's copy, the DM would see a carried
weight that does not add up. So: **private items still contribute to totals**, and appear
to others as a nameless `hidden item` row. The DM can see that you are carrying
something, what it weighs and what it is worth, but not what it is. Encumbrance and value
stay correct and the secret stays secret. As built, the placeholder keeps only `id`,
`qty`, `weight` and `cp` — no name, no catalogue reference, no stats, no note, and never
shown as equipped.

For prose fields — journal entries, notes — private means absent, with no placeholder.

One thing that cannot be hidden, and says so: **armour you are wearing**. Equipping armour
sets your AC, and the AC is always shared, so holding the name back while the number it
produces is on show would be a pretence. Trying it gets an explanation and a suggestion to
unequip it first.

### The journal, as built in step 3

Entries live on the character, so they work standalone and connected alike. Each carries
its own level, shown in plain words rather than jargon — **the table**, **the DM**,
**just me** — and tapping it cycles round. New entries start at *just me*.

Some entries write themselves, so a character's history does not depend on anyone
remembering to keep one: joining a table, leaving a table, and going up a level. Those are
written by the server where it owns the fact (membership) and by the client where it owns
it (levelling), they are marked `automatic`, they are shared with the table, and they
cannot be edited or deleted.

Two things worth recording about how it is stored. The server **preserves its own
automatic entries** across a save, so a write that was already in flight when a player
joined a table cannot lose the entry. And entries are **trimmed on the way in** — title
and text capped, tags coerced to an array, an unrecognised level falling back to *just me*
rather than to *the table*, and the journal capped at 500 entries.

### Enforcement

Every response is built by a single function, `visibleCharacter(requesterId, character)`,
fed by one `relationship(viewerId, character)` that answers *owner / dm / party / none*.
No route serialises a character any other way. That pair is where the tests are
concentrated, because it is the only thing standing between a private field and the
wrong screen.

**Where step 4 left it.** The rules now live in one file, `src/99-privacy.js`, which
`build.py` also copies to `server/privacy.js` — the server `require`s that copy rather
than restating anything, so the preview a player is shown cannot disagree with what the
server sends. `test-privacy.js` fails if the two files differ by a byte.

| Relationship | Gets |
|---|---|
| owner | everything |
| dm | the sheet minus anything set to *just me*; journal filtered to *the table* and *the DM* |
| party | the sheet minus anything set to *the DM* or *just me* |
| none | nothing at all |

**What is not hideable, and why.** Ability scores, AC, hit points, saves, skills, level and
name are always shared with the table. The DM's party table is computed from them by the
client, so hiding them would not produce a private sheet — it would produce a broken one.
This is stated on the sheet itself rather than left for someone to discover.

**Two rules that both fail closed.** An unrecognised level counts as *private*, never as
*the table* — so a typo or a mangled save errs towards keeping something back. And the
distinction between *unset* and *invalid* is deliberate: nothing set means the section's
default, something set but not recognised means private.

**What each side owns.** The `privacy` map is never sent to anyone but the owner, so nobody
is told which sections exist but are withheld. On the way in, the server drops unknown
section keys and invalid levels rather than storing them, normalises each item's level, and
strips any `hidden` flag so a viewer cannot pass a placeholder back as a real possession.

**The preview.** On your own sheet you can look at it as the DM, or as the table. It runs
through the same `filterCharacter` the server uses, and it is read-only — a stray tap while
previewing saves nothing, since the sheet on screen is a filtered copy.

One thing a PIN cannot fix, worth knowing rather than discovering later: **whoever runs
the server has `db.json` on their machine.** If the DM hosts, private-from-DM fields sit
in a file on the DM's laptop. Options are to shrug (it is a game between friends), or to
have someone other than the DM host it. Encrypting them client-side is not practical
here — browsers only expose `crypto.subtle` over HTTPS or localhost, and a plain-HTTP
LAN address is neither.

---

## 4. Identity — profiles and PINs

No accounts, no usernames, no email. A **profile** is just a name on the server.

- **First time on a device:** pick your name from the list, or add yourself.
- **Setting a PIN:** four or more digits, set the first time you claim a profile. You can
  skip it — a profile with no PIN is open to anyone, which is fine for a shared tablet
  used by one person.
- **Staying signed in:** the server returns a token the browser keeps. "Remember me on
  this device" is on by default, so nobody retypes a PIN every session. Signing out
  clears it.
- **Forgot it:** whoever runs the server clears it — `node server.js --reset-pin "Nick"`.
  No email loops for a home game.

PINs are stored as a SHA-256 hash with a per-profile salt rather than in the clear, so a
copied or backed-up `db.json` does not spill everyone's PIN. Note this is a locked door,
not a vault: the PIN crosses a plain-HTTP LAN, and it is four digits. It exists to stop a
housemate flipping to the DM profile and reading the villain's notes, which is the actual
threat in a game between friends.

---

## 5. Roles

Role is per campaign, not global — you might DM one game and play in another.

| | Player | DM |
|---|---|---|
| Own characters | full control | full control |
| Other members' sheets | `party` fields only | everything except `private` |
| Campaign, sessions, notes | read published entries | create and edit |
| Change another sheet | no | **no** — view only, as decided |

Because the DM cannot edit sheets, there is no write-conflict problem to solve in this
build. Players apply their own damage and XP. If you later want the DM to award XP and
loot, that is an "offer, player accepts" flow rather than a direct write.

---

## 6. The API

Small, JSON, no dependencies.

```
GET  /api/ping                     → { ok, version, name }
GET  /api/profiles                 → list of names, and whether each has a PIN set
POST /api/profiles                 → create { name, pin? }
POST /api/profiles/:id/claim       → { pin? } → { token }   sign in as this profile
POST /api/profiles/:id/pin         → set or change a PIN (needs the current one)
POST /api/signout                  → invalidate this device's token
GET  /api/campaigns                → campaigns this profile can see
POST /api/campaigns                → create (you become DM)
GET  /api/campaigns/:id            → campaign + party, filtered for you
POST /api/campaigns/:id/members    → add or remove a character
POST /api/campaigns/:id/sessions   → add or edit a session entry
GET  /api/characters               → your characters, plus party-visible others
GET  /api/characters/:id           → filtered for you
PUT  /api/characters/:id           → save (owner only; rejects if rev is stale)
GET  /api/events                   → Server-Sent Events: "something changed"
```

Every request other than `ping`, `profiles` and `claim` carries the token from §4. The
server resolves it to a `profileId`; a missing or unknown token gets a 401 and the client
shows the profile picker. Tokens are random 32-byte hex, held in memory and in
`db.json` so a server restart does not sign everyone out.

`/api/events` pushes a one-line notice when anything changes; the client re-fetches what
it is looking at. It falls back to polling every 10 seconds if `EventSource` is missing.

**As built, the notice carries no content whatsoever** — `{ kind, by, seq, at }` and nothing
else. That is deliberate rather than frugal: if the stream carried character data it would
become a second way a character gets serialised, and therefore a second place a private
field could escape. Instead it says only *something changed, and who by*, and the client
re-asks through the ordinary filtered routes. A test asserts the whole stream contains no
character name, no numbers, and none of a private note.

`by` is the profile that caused the change, so a client ignores the echo of its own write.
`seq` rises monotonically, so an out-of-order or duplicate notice is dropped.

`EventSource` cannot set a header, so this one endpoint accepts the token in the query
string instead. Nothing is logged and it never leaves the LAN.

**Catching up never interrupts anyone.** A refresh holds off while the wizard is open,
while a field has focus, or while one of your own saves is still going out; the connection
bar shows *someone else made a change* with a **Catch up** button, and it retries by itself
once you have finished. Somebody else's data is re-read first; your own roster only when
you have nothing pending, so an edit in flight cannot be lost.

**Static files** are served from a single directory with the path normalised and confined
to it, so `../` cannot escape. That gets a test.

---

## 7. Screens

1. **Who are you?** — shown only in connected mode, on a device with no valid token. The
   list of profiles as large tappable cards, a PIN pad if that profile has one, an
   *Add me* option, and *Remember me on this device* ticked by default. A player who has
   used the tablet before never sees this screen again.
2. **Connection bar** — mode ("Local" / "Connected to 192.168.1.20"), who you are, and a
   profile switcher with *Sign out*.
3. **Home** — *Your characters* as today, plus a **Campaigns** section.
4. **Campaign, DM view** — the party at a glance, which is the genuinely useful part: a
   table of name, player, class and level, AC, current/max HP, passive Perception, saves,
   spell DC and carried load. Then the session log, membership, and a **See what players
   see** toggle so the DM can check what they are publishing.
5. **Campaign, player view** — which campaign I am in, the party roster at `party`
   visibility, and the session notes the DM has published.
6. **Character sheet** — the labelled header gains a **Campaign** field. A new **Journal**
   box. A small lock control on each hideable section and inventory item, cycling
   party → DM → private.
7. **Journal** — entries with date, title, text and visibility. Auto-entries for joining
   or leaving a campaign and for levelling up, so campaign history writes itself.
   Previous campaigns are listed from `campaignHistory`.

---

## 8. Delivery order

Each step leaves the app working, with every existing suite still green.

| Step | Contents | Why this order |
|---|---|---|
| **1** ✅ | Persistence layer split; server skeleton; profiles, PINs and tokens; connection bar | Nothing visible changes in local mode — proves no regression before anything is built on top |
| **2** ✅ | Campaigns, membership, DM party view | The feature you actually asked for, usable as soon as it lands |
| **3** ✅ | Journal, campaign history, auto entries | Sheets start answering "what has this character done" |
| **4** ✅ | Privacy levels, server-side filtering, DM preview | Secrets become meaningful |
| **5** ✅ | Live updates, LAN address printing, backups, restore | Table polish |

---

## 9. How this gets verified

Existing suites must stay green: 1,196 unit, 351 browser, 234 spell facts, 73 responsive.

**After step 5, seven suites, 2,841 assertions:**

| Suite | Count | What it covers |
|---|---|---|
| `test.js` | 1,240 | rules engines, derivation, spells, inventory, the party table for all four systems, journal escaping and ordering |
| `test-dom.js` | 487 | the built page in jsdom: local mode unchanged, campaigns standalone, writing a journal, the sharing controls and the preview |
| `test-spellfacts.js` | 234 | spell rules checked against the source data |
| `test-responsive.js` | 73 | tablet and phone layout, resolved from the CSS |
| `test-privacy.js` | 138 | the permission matrix on its own — every level against every relationship, and that both copies of the rules are the same file |
| `test-server.js` | 418 | every route, auth, PIN storage, atomic writes, restart, corruption, `--reset-pin`, campaigns, journal and field filtering over the wire, the event stream, backups and restore |
| `test-connected.js` | 251 | a real browser against a real server: sign-in, write-through, a DM and two players at one table, and withheld text that is nowhere in anyone else's browser, and a pushed notice updating the DM's table with nobody touching it |

`test-connected.js` boots `server.js`, then loads the page from it in jsdom over
HTTP — external `app.js` and `app.css` included. The only shim is `fetch`, which
jsdom does not implement. Each simulated device gets its own `localStorage`,
because jsdom otherwise shares it per origin and every "device" would secretly
be the same one.

Still to come with the later steps:

- **Permission matrix suite.** Table-driven: for every visibility level × requester
  relationship (owner, DM, fellow player, stranger), assert the exact field set that
  comes back. This is the security-critical code and it gets the most attention.
- **Server suite.** Boot on an ephemeral port; exercise every route; malformed JSON,
  oversized bodies, unknown ids, stale `rev`, concurrent writes to one character, and
  path traversal against the static handler.
- **Two-client test.** Two simulated clients against one server: DM and player. Assert
  the DM's response for a private field contains no trace of it — searching the raw JSON
  string, not just the parsed object.
- **Auth suite.** Claiming a profile with the right PIN, the wrong PIN and no PIN; a
  profile that has no PIN set; tokens surviving a restart; sign-out invalidating a token;
  requests with no token, a garbage token and another person's token; `--reset-pin`
  clearing one. Assert `db.json` never contains a PIN in the clear.
- **Round trip.** Local character → uploaded → filtered → downloaded → still derives the
  same AC, HP and spell slots.

---

## 9a. Backups and restore, as built

Every write keeps `db.bak.json` (the version immediately before it) and one dated snapshot
per day, written by rename so a pulled power cable cannot leave a half-written file.

Restoring is a **command, not a button**: it replaces everybody's data at once, which
should take a moment's thought and a stopped server.

```
node server.js --list-backups          what has been kept, with a summary of each
node server.js --restore db.2026-07-20.json
```

It refuses a file that is missing, one that is not valid JSON, and one that parses but has
no `profiles` or `characters` list — saying which, and changing nothing. Before it writes,
it copies the current data to `db.before-restore.<timestamp>.json`, and if that copy fails
it refuses to go on. So a restore is always reversible: the test restores an old snapshot,
checks the old data is live, then restores the set-aside copy and checks everyone is back.

---

## 10. Deliberately not in this build

- DM editing player sheets, XP and loot awards
- Initiative tracker, battle map, monster stat blocks (the offline packages do have 334
  5e monsters and thousands for PF2, so this is available later)
- Accounts, usernames, passwords, password recovery by email
- Internet exposure. This is LAN only; I would not recommend port forwarding it.
- Handing a character to another player, or one player running two characters at once

---

## 11. Open questions

1. **Where should the server keep its data?** My suggestion: a `data/` folder beside
   `server.js`, so it sits inside this project folder and gets picked up by whatever
   backs the folder up.
2. **Port.** 8080 unless you would rather something else.
3. **Should the DM's party table be configurable**, or is the fixed set of columns in
   §6.3 right? I would start fixed and see what you actually miss.
4. **One server, many campaigns** — assumed yes, with campaigns listed on the home page.
