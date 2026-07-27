#!/usr/bin/env node
/* ============================================================
   Character Forge — LAN server

   No dependencies. Run it on a machine on your home network:

       node server.js                       start on port 8080
       node server.js --port 9000           a different port
       node server.js --reset-pin "Nick"    clear a forgotten PIN
       node server.js --data ../data        keep the data somewhere else

   Then everyone opens the address it prints.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/* The visibility rules, shared verbatim with the browser. build.py writes this
   file from src/99-privacy.js; a test checks the two stay identical. */
const {
  PRIV_LEVELS, PRIV_SECTIONS, privClearance, privNormalise, privVisible,
  privLevelOf, privItemLevel, privEntryLevel, privHiddenItem, filterCharacter
} = require('./privacy.js');

const VERSION = '1.0.0';
const MAX_BODY = 4 * 1024 * 1024;      // a big character with a long journal

/* ---------------- arguments ---------------- */
function parseArgs(argv) {
  const out = { port: 8080, data: null, resetPin: null, name: 'Character Forge' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' && argv[i + 1]) out.port = parseInt(argv[++i], 10) || 8080;
    else if (a === '--data' && argv[i + 1]) out.data = argv[++i];
    else if (a === '--reset-pin' && argv[i + 1]) out.resetPin = argv[++i];
    else if (a === '--restore' && argv[i + 1]) out.restore = argv[++i];
    else if (a === '--list-backups') out.listBackups = true;
    else if (a === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = ARGS.data ? path.resolve(ARGS.data) : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (ARGS.help) {
  console.log([
    '',
    '  Character Forge — LAN server',
    '',
    '  node server.js                       start on port ' + 8080,
    '  node server.js --port 9000           use a different port',
    '  node server.js --data /some/where    keep the data elsewhere',
    '  node server.js --reset-pin "Nick"    clear a forgotten PIN',
    '  node server.js --list-backups        show the copies that have been kept',
    '  node server.js --restore FILE        put one of them back',
    '  node server.js --name "Tuesday Game" label this server',
    '',
    '  Then give the network address it prints to everyone at the table.',
    ''
  ].join('\n'));
  process.exit(0);
}

/* ---------------- the database ---------------- */
const EMPTY_DB = { version: 1, profiles: [], campaigns: [], characters: [], tokens: {} };

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    return Object.assign({}, EMPTY_DB, db);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('\n  !! ' + DB_FILE + ' could not be read: ' + e.message);
      const bak = DB_FILE.replace(/\.json$/, '.bak.json');
      if (fs.existsSync(bak)) {
        console.error('     trying the backup at ' + bak);
        try { return Object.assign({}, EMPTY_DB, JSON.parse(fs.readFileSync(bak, 'utf8'))); }
        catch (e2) { console.error('     the backup is unreadable too: ' + e2.message); }
      }
      console.error('     starting empty; your old file has NOT been deleted.\n');
    }
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

let db = loadDb();
let writing = false, writeAgain = false;
const NO_NOTICE = Symbol('none');
let pendingNotice = NO_NOTICE;

/* Write to a temp file and rename, so a crash mid-write cannot corrupt the
   database. Keep the previous version, plus one copy per day. */
/* Every save announces itself to whoever is watching, so the other tablets at
   the table do not sit on a stale sheet. `by` is the profile that caused it, so
   a client can ignore the echo of its own write. */
function saveDb(by) {
  if (by !== undefined) pendingNotice = by;
  if (writing) { writeAgain = true; return; }
  writing = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.' + process.pid + '.tmp';
    const bak = DB_FILE.replace(/\.json$/, '.bak.json');
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    if (fs.existsSync(DB_FILE)) {
      try { fs.copyFileSync(DB_FILE, bak); } catch (e) { /* best effort */ }
      const day = new Date().toISOString().slice(0, 10);
      const daily = path.join(DATA_DIR, 'db.' + day + '.json');
      if (!fs.existsSync(daily)) {
        try { fs.copyFileSync(DB_FILE, daily); } catch (e) { /* best effort */ }
      }
    }
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('  !! could not save: ' + e.message);
  } finally {
    writing = false;
    if (writeAgain) { writeAgain = false; saveDb(); }
    else if (pendingNotice !== NO_NOTICE) {
      const by = pendingNotice;
      pendingNotice = NO_NOTICE;
      broadcast(by);
    }
  }
}

/* ---------------- live updates ----------------
   Server-Sent Events. The notice deliberately carries no content at all — just
   "something changed, and who by". Clients then re-ask through the ordinary
   filtered routes, so this can never become a second way for a character to be
   serialised, and therefore never a second place a private field could escape. */
const watchers = new Set();
let noticeSeq = 0;

function broadcast(by) {
  if (!watchers.size) return;
  noticeSeq++;
  const line = 'data: ' + JSON.stringify({
    kind: 'changed', by: by || null, seq: noticeSeq, at: now()
  }) + '\n\n';
  watchers.forEach(w => {
    try { w.res.write(line); }
    catch (e) { watchers.delete(w); }
  });
}

function openWatch(req, res, profileId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  // a comment line flushes the headers, so the browser fires onopen promptly
  res.write(': watching\n\n');
  res.write('retry: 3000\n\n');
  const w = { res: res, profileId: profileId };
  watchers.add(w);
  const drop = () => { watchers.delete(w); try { res.end(); } catch (e) { } };
  req.on('close', drop);
  req.on('error', drop);
  res.on('error', drop);
}

/* A comment every 25 seconds, so a sleeping tablet or a tidy-minded network
   does not quietly drop the connection without either end noticing. */
const heartbeat = setInterval(() => {
  watchers.forEach(w => {
    try { w.res.write(': beat\n\n'); }
    catch (e) { watchers.delete(w); }
  });
}, 25000);
heartbeat.unref && heartbeat.unref();

/* ---------------- helpers ---------------- */
function newId() { return crypto.randomBytes(8).toString('hex'); }
function newToken() { return crypto.randomBytes(32).toString('hex'); }
function now() { return new Date().toISOString(); }

/* Salted SHA-256. Deliberately modest: this stops a housemate switching to the
   DM profile, it is not protection against someone who has the data file. */
function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(salt + ':' + String(pin)).digest('hex');
}
function setPin(profile, pin) {
  if (pin === null || pin === undefined || pin === '') {
    delete profile.pinSalt; delete profile.pinHash;
    return;
  }
  profile.pinSalt = crypto.randomBytes(8).toString('hex');
  profile.pinHash = hashPin(pin, profile.pinSalt);
}
function pinMatches(profile, pin) {
  if (!profile.pinHash) return true;                    // no PIN set: open
  if (pin === null || pin === undefined || pin === '') return false;
  const a = Buffer.from(hashPin(pin, profile.pinSalt), 'utf8');
  const b = Buffer.from(profile.pinHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function validPin(pin) {
  return pin === null || pin === undefined || pin === '' ||
    (/^\d{4,12}$/.test(String(pin)));
}

function profileById(id) { return db.profiles.find(p => p.id === id) || null; }
function profileByName(name) {
  const n = String(name || '').trim().toLowerCase();
  return db.profiles.find(p => p.name.toLowerCase() === n) || null;
}
function publicProfile(p) { return { id: p.id, name: p.name, hasPin: !!p.pinHash }; }

function authOf(req) {
  const token = req.headers['x-forge-token'];
  if (!token) return null;
  const id = db.tokens[token];
  return id ? profileById(id) : null;
}

/* ---------------- campaigns ---------------- */
function campaignById(id) { return db.campaigns.find(c => c.id === id) || null; }
function isDm(profileId, camp) { return !!camp && camp.dmProfileId === profileId; }

/* Membership is a list of stints rather than a set, so leaving and rejoining
   later both show up in the history. */
function activeMembers(camp) {
  return (camp && camp.members || []).filter(m => !m.leftAt);
}
function activeMembership(camp, characterId) {
  return activeMembers(camp).find(m => m.characterId === characterId) || null;
}
function playsIn(profileId, camp) {
  return activeMembers(camp).some(m => m.profileId === profileId);
}
function canSeeCampaign(profileId, camp) {
  return isDm(profileId, camp) || playsIn(profileId, camp);
}

/* How the viewer is related to this character. Everything about who may see
   what is decided from this one answer. */
function relationship(viewerId, c) {
  if (!c) return 'none';
  if (c.ownerProfileId === viewerId) return 'owner';
  const camp = c.campaignId ? campaignById(c.campaignId) : null;
  if (!camp) return 'none';
  if (!activeMembership(camp, c.id)) return 'none';   // listed but not currently in
  if (isDm(viewerId, camp)) return 'dm';
  if (playsIn(viewerId, camp)) return 'party';
  return 'none';
}

/* Journal entries arrive from a browser, so they are trimmed to a sane shape
   and size before they go anywhere near the data file. */
function cleanJournal(list) {
  return (Array.isArray(list) ? list : []).slice(0, 500).map(e => ({
    id: String((e && e.id) || newId()).slice(0, 40),
    date: String((e && e.date) || '').slice(0, 10),
    title: String((e && e.title) || '').slice(0, 200),
    text: String((e && e.text) || '').slice(0, 20000),
    tags: Array.isArray(e && e.tags)
      ? e.tags.slice(0, 12).map(t => String(t).slice(0, 30)) : [],
    visibility: privEntryLevel(e),
    auto: (e && e.auto) ? String(e.auto).slice(0, 20) : false
  }));
}

/* Only the known sections, only the three levels. Anything else is dropped
   rather than stored, so the data file cannot fill up with junk keys. */
function cleanPrivacy(map) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  PRIV_SECTIONS.forEach(s => {
    if (PRIV_LEVELS.indexOf(map[s.key]) >= 0) out[s.key] = map[s.key];
  });
  return out;
}

/* A possession's level travels on the item. Normalised on the way in so a
   nonsense value cannot end up meaning "show everyone". */
function cleanInvVisibility(inv) {
  if (!inv || typeof inv !== 'object' || !Array.isArray(inv.items)) return inv;
  const out = {};
  for (const k in inv) if (Object.prototype.hasOwnProperty.call(inv, k)) out[k] = inv[k];
  out.items = inv.items.map(i => {
    if (!i || typeof i !== 'object') return i;
    const copy = {};
    for (const k in i) if (Object.prototype.hasOwnProperty.call(i, k)) copy[k] = i[k];
    copy.visibility = privItemLevel(i);
    delete copy.hidden;          // never take a viewer's placeholder as truth
    return copy;
  });
  return out;
}

/* Entries the server wrote itself are kept even when the incoming copy predates
   them, so a save that was already in flight cannot lose a character's history.
   Everything the client sends is kept as sent. */
function mergeJournal(existingJournal, sentJournal) {
  const sent = cleanJournal(sentJournal);
  const sentIds = new Set(sent.map(e => e.id));
  const keptAuto = (existingJournal || []).filter(e => e && e.auto && !sentIds.has(e.id));
  return keptAuto.concat(sent);
}

/* ---------------- the one place a character is serialised ----------------
   Nothing else in the server may build a character response.

   The rules themselves live in privacy.js, which is a copy of the very file
   the browser bundles — so the preview a player is shown cannot disagree with
   what this actually sends. filterCharacter never mutates its argument, so
   answering a request cannot edit the stored character. */
function visibleCharacter(viewerId, c) {
  return filterCharacter(relationship(viewerId, c), c);
}
/* "Your characters" means the ones you own, and only those. A DM reaches a
   player's sheet through the campaign, not through this list — otherwise the
   party would turn up on the DM's own home page as if it were hers. */
function ownCharacters(viewerId) {
  return db.characters.filter(c => c.ownerProfileId === viewerId);
}

/* What one player is allowed to know about another player's character: enough
   to draw a party roster, and no more. Ids rather than names, because the
   client already has every rulebook and can look them up. */
function partySummary(c) {
  const owner = profileById(c.ownerProfileId);
  return {
    characterId: c.id,
    name: c.name || '',
    playerName: owner ? owner.name : 'someone',
    ownerProfileId: c.ownerProfileId,
    systemId: c.systemId,
    level: c.level,
    lineageId: c.lineageId || null,
    classId: c.classId || null,
    subclassId: c.subclassId || null
  };
}

function publicCampaign(camp, viewerId) {
  const dm = profileById(camp.dmProfileId);
  const mine = activeMembers(camp)
    .filter(m => m.profileId === viewerId).map(m => m.characterId);
  return {
    id: camp.id,
    name: camp.name,
    systemId: camp.systemId,
    blurb: camp.blurb || '',
    dmProfileId: camp.dmProfileId,
    dmName: dm ? dm.name : 'the DM',
    createdAt: camp.createdAt,
    updatedAt: camp.updatedAt,
    memberCount: activeMembers(camp).length,
    yourRole: isDm(viewerId, camp) ? 'dm' : (mine.length ? 'player' : 'none'),
    yourCharacterIds: mine
  };
}

/* Record joining and leaving on the character, so its history is right without
   anyone having to write it down. */
function autoEntry(c, kind, title, text) {
  if (!Array.isArray(c.journal)) c.journal = [];
  c.journal.push({
    id: newId(),
    date: now().slice(0, 10),
    title: title,
    text: text || '',
    tags: [],
    // joining a table is not a secret from the people at it
    visibility: 'party',
    auto: kind
  });
}
function noteJoin(c, camp) {
  if (!Array.isArray(c.campaignHistory)) c.campaignHistory = [];
  c.campaignHistory.push({
    campaignId: camp.id, name: camp.name, joinedAt: now(), leftAt: null
  });
  autoEntry(c, 'join', 'Joined ' + camp.name,
    'Came to the table at level ' + (c.level || 1) + '.');
}
function noteLeave(c, campaignId) {
  if (!Array.isArray(c.campaignHistory)) c.campaignHistory = [];
  const open = c.campaignHistory.filter(e => e.campaignId === campaignId && !e.leftAt).pop();
  if (open) open.leftAt = now();
  const camp = campaignById(campaignId);
  autoEntry(c, 'leave', 'Left ' + ((open && open.name) || (camp && camp.name) || 'the campaign'),
    'Left at level ' + (c.level || 1) + '.');
}
function touch(c) { c.rev = (c.rev || 0) + 1; c.updatedAt = now(); }

/* ---------------- HTTP plumbing ---------------- */
function send(res, code, obj, headers) {
  const body = obj === null ? '' : JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(body);
}
function fail(res, code, message) { send(res, code, { error: message }); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', d => {
      size += d.length;
      if (size > MAX_BODY) { reject(new Error('Request too large.')); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); }
      catch (e) { reject(new Error('Body was not valid JSON.')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

/* Serve only from public/, whatever the request says. */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.join(PUBLIC_DIR, path.normalize(rel));
  const base = PUBLIC_DIR + path.sep;
  if (full !== PUBLIC_DIR && !full.startsWith(base)) return fail(res, 403, 'Forbidden.');
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return fail(res, 404, 'Not found.');
    const ext = path.extname(full).toLowerCase();
    // the client bundle is big and changes only when rebuilt
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache
    });
    fs.createReadStream(full).pipe(res);
  });
}

/* ---------------- routes ---------------- */
async function handleApi(req, res, segs, query) {
  const method = req.method;
  let who = authOf(req);
  /* EventSource cannot set a header, so this one endpoint takes the token in the
     query string instead. Nothing is logged, and it never leaves the LAN. */
  if (segs[0] === 'events' && !who && query && query.get('token')) {
    const id = db.tokens[query.get('token')];
    who = id ? profileById(id) : null;
  }
  if (segs[0] === 'events' && method === 'GET') {
    if (!who) return fail(res, 401, 'Sign in first.');
    return openWatch(req, res, who.id);
  }
  const body = (method === 'POST' || method === 'PUT') ? await readBody(req) : {};

  // --- open routes ---
  if (segs[0] === 'ping' && method === 'GET') {
    return send(res, 200, { ok: true, version: VERSION, name: ARGS.name, profiles: db.profiles.length });
  }
  if (segs[0] === 'profiles' && segs.length === 1 && method === 'GET') {
    return send(res, 200, { profiles: db.profiles.map(publicProfile) });
  }
  if (segs[0] === 'profiles' && segs.length === 1 && method === 'POST') {
    const name = String(body.name || '').trim();
    if (name.length < 1) return fail(res, 400, 'A name is needed.');
    if (name.length > 40) return fail(res, 400, 'That name is too long.');
    if (profileByName(name)) return fail(res, 409, 'Someone is already called that.');
    if (!validPin(body.pin)) return fail(res, 400, 'A PIN must be 4 to 12 digits.');
    const p = { id: newId(), name: name, createdAt: now() };
    setPin(p, body.pin);
    db.profiles.push(p);
    saveDb(p.id);
    return send(res, 201, { profile: publicProfile(p), profiles: db.profiles.map(publicProfile) });
  }
  if (segs[0] === 'profiles' && segs[2] === 'claim' && method === 'POST') {
    const p = profileById(segs[1]);
    if (!p) return fail(res, 404, 'No such profile.');
    if (!pinMatches(p, body.pin)) return fail(res, 403, 'That PIN does not match.');
    const token = newToken();
    db.tokens[token] = p.id;
    saveDb(p.id);
    return send(res, 200, { token: token, profile: publicProfile(p) });
  }

  // --- everything below needs a token ---
  if (!who) return fail(res, 401, 'Sign in first.');

  if (segs[0] === 'me' && method === 'GET') {
    return send(res, 200, { profile: publicProfile(who) });
  }
  if (segs[0] === 'signout' && method === 'POST') {
    const token = req.headers['x-forge-token'];
    delete db.tokens[token];
    saveDb(who.id);
    return send(res, 200, { ok: true });
  }
  if (segs[0] === 'profiles' && segs[2] === 'pin' && method === 'POST') {
    const p = profileById(segs[1]);
    if (!p) return fail(res, 404, 'No such profile.');
    if (p.id !== who.id) return fail(res, 403, 'You can only change your own PIN.');
    if (!pinMatches(p, body.current)) return fail(res, 403, 'The current PIN does not match.');
    if (!validPin(body.pin)) return fail(res, 400, 'A PIN must be 4 to 12 digits.');
    setPin(p, body.pin);
    saveDb(who.id);
    return send(res, 200, { profile: publicProfile(p) });
  }

  /* ---- campaigns ---- */
  if (segs[0] === 'campaigns' && segs.length === 1 && method === 'GET') {
    const mine = [], others = [];
    db.campaigns.forEach(c => {
      (canSeeCampaign(who.id, c) ? mine : others).push(publicCampaign(c, who.id));
    });
    // Everyone on the server can see that a table exists and ask to join it.
    // There are no invitations: this is one household's worth of people.
    return send(res, 200, { campaigns: mine, others: others });
  }
  if (segs[0] === 'campaigns' && segs.length === 1 && method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name) return fail(res, 400, 'The campaign needs a name.');
    if (name.length > 80) return fail(res, 400, 'That name is too long.');
    if (!body.systemId) return fail(res, 400, 'Pick which game this campaign uses.');
    const camp = {
      id: newId(),
      name: name,
      systemId: String(body.systemId),
      blurb: String(body.blurb || '').slice(0, 2000),
      dmProfileId: who.id,
      members: [],
      sessions: [],
      createdAt: now(),
      updatedAt: now()
    };
    db.campaigns.push(camp);
    saveDb(who.id);
    return send(res, 201, { campaign: publicCampaign(camp, who.id) });
  }
  if (segs[0] === 'campaigns' && segs.length === 2 && method === 'GET') {
    const camp = campaignById(segs[1]);
    if (!camp) return fail(res, 404, 'Not found.');
    /* Anyone signed in can look at a table to decide whether to join it — the
       same names GET /api/campaigns already lists. What they cannot see is who
       is in it, so an outsider learns nothing about anybody's character. */
    if (!canSeeCampaign(who.id, camp)) {
      return send(res, 200, {
        campaign: publicCampaign(camp, who.id),
        characters: [], party: [], players: []
      });
    }
    const members = activeMembers(camp);
    const chars = members
      .map(m => db.characters.find(c => c.id === m.characterId))
      .filter(Boolean);
    const out = {
      campaign: publicCampaign(camp, who.id),
      // the DM gets whole sheets so the party table can be worked out from the
      // rules the client already has; players get names and levels only
      characters: chars.map(c => visibleCharacter(who.id, c)).filter(Boolean),
      party: chars.map(partySummary),
      players: [...new Set(members.map(m => m.profileId))]
        .map(id => profileById(id)).filter(Boolean).map(publicProfile)
    };
    return send(res, 200, out);
  }
  if (segs[0] === 'campaigns' && segs.length === 2 && method === 'PUT') {
    const camp = campaignById(segs[1]);
    if (!camp) return fail(res, 404, 'Not found.');
    if (!isDm(who.id, camp)) return fail(res, 403, 'Only the DM can change the campaign.');
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return fail(res, 400, 'The campaign needs a name.');
      camp.name = name.slice(0, 80);
    }
    if (body.blurb !== undefined) camp.blurb = String(body.blurb).slice(0, 2000);
    camp.updatedAt = now();
    saveDb(who.id);
    return send(res, 200, { campaign: publicCampaign(camp, who.id) });
  }
  if (segs[0] === 'campaigns' && segs.length === 2 && method === 'DELETE') {
    const camp = campaignById(segs[1]);
    if (!camp) return send(res, 200, { ok: true });
    if (!isDm(who.id, camp)) return fail(res, 403, 'Only the DM can close the campaign.');
    // let everyone out before it disappears, so nobody is left pointing at it
    activeMembers(camp).forEach(m => {
      m.leftAt = now();
      const c = db.characters.find(x => x.id === m.characterId);
      if (c) { c.campaignId = null; noteLeave(c, camp.id); touch(c); }
    });
    db.campaigns = db.campaigns.filter(c => c.id !== camp.id);
    saveDb(who.id);
    return send(res, 200, { ok: true });
  }
  if (segs[0] === 'campaigns' && segs[2] === 'members' && method === 'POST') {
    const camp = campaignById(segs[1]);
    if (!camp) return fail(res, 404, 'No such campaign.');
    const c = db.characters.find(x => x.id === body.characterId);
    if (!c) return fail(res, 404, 'No such character.');
    const action = body.action === 'leave' ? 'leave' : 'join';
    const owned = c.ownerProfileId === who.id;

    if (action === 'join') {
      if (!owned) return fail(res, 403, 'You can only bring your own character to a table.');
      if (c.systemId !== camp.systemId) {
        return fail(res, 400, 'That campaign is playing a different game, so the numbers would not line up.');
      }
      if (activeMembership(camp, c.id)) return send(res, 200, { campaign: publicCampaign(camp, who.id) });
      if (c.campaignId && c.campaignId !== camp.id) {
        return fail(res, 409, 'That character is already in another campaign. Take them out of it first.');
      }
      camp.members.push({
        characterId: c.id, profileId: who.id, joinedAt: now(), leftAt: null
      });
      c.campaignId = camp.id;
      noteJoin(c, camp);
      touch(c);
    } else {
      const m = activeMembership(camp, c.id);
      // the owner can walk away; the DM can show someone the door
      if (!owned && !isDm(who.id, camp)) return fail(res, 403, 'That is not yours to remove.');
      if (!m) return send(res, 200, { campaign: publicCampaign(camp, who.id) });
      m.leftAt = now();
      if (c.campaignId === camp.id) c.campaignId = null;
      noteLeave(c, camp.id);
      touch(c);
    }
    camp.updatedAt = now();
    saveDb(who.id);
    return send(res, 200, { campaign: publicCampaign(camp, who.id), character: visibleCharacter(who.id, c) });
  }

  if (segs[0] === 'characters' && segs.length === 1 && method === 'GET') {
    return send(res, 200, { characters: ownCharacters(who.id) });
  }
  if (segs[0] === 'characters' && segs.length === 2 && method === 'GET') {
    const c = db.characters.find(x => x.id === segs[1]);
    const v = visibleCharacter(who.id, c);
    if (!v) return fail(res, 404, 'Not found.');
    return send(res, 200, { character: v });
  }
  if (segs[0] === 'characters' && segs.length === 2 && method === 'PUT') {
    const id = segs[1];
    if (!body || body.id !== id) return fail(res, 400, 'The character id does not match the address.');
    const i = db.characters.findIndex(x => x.id === id);
    /* Which table you sit at is not something a sheet can assert about itself.
       Membership is only ever changed through the campaign routes, so these
       fields are taken from the server's copy and never from the request. */
    if (i < 0) {
      const fresh = Object.assign({}, body, {
        ownerProfileId: who.id, rev: 1, updatedAt: now(),
        campaignId: null, campaignHistory: [],
        journal: cleanJournal(body.journal),
        privacy: cleanPrivacy(body.privacy),
        inv: cleanInvVisibility(body.inv)
      });
      db.characters.push(fresh);
      saveDb(who.id);
      return send(res, 201, { character: fresh });
    }
    const existing = db.characters[i];
    if (existing.ownerProfileId !== who.id) return fail(res, 403, 'That is not your character.');
    const sentRev = typeof body.rev === 'number' ? body.rev : 0;
    if (sentRev < existing.rev) {
      return send(res, 409, { error: 'Stale copy.', character: existing });
    }
    const updated = Object.assign({}, body, {
      ownerProfileId: existing.ownerProfileId,
      privacy: cleanPrivacy(body.privacy),
      inv: cleanInvVisibility(body.inv),
      campaignId: existing.campaignId === undefined ? null : existing.campaignId,
      campaignHistory: Array.isArray(existing.campaignHistory) ? existing.campaignHistory : [],
      journal: mergeJournal(existing.journal, body.journal),
      rev: existing.rev + 1,
      updatedAt: now()
    });
    db.characters[i] = updated;
    saveDb(who.id);
    return send(res, 200, { character: updated });
  }
  if (segs[0] === 'characters' && segs.length === 2 && method === 'DELETE') {
    const i = db.characters.findIndex(x => x.id === segs[1]);
    if (i < 0) return send(res, 200, { ok: true });
    if (db.characters[i].ownerProfileId !== who.id) return fail(res, 403, 'That is not your character.');
    // take them out of the party too, or the DM's table would show a ghost
    db.campaigns.forEach(camp => {
      activeMembers(camp).forEach(m => {
        if (m.characterId === segs[1]) { m.leftAt = now(); camp.updatedAt = now(); }
      });
    });
    db.characters.splice(i, 1);
    saveDb(who.id);
    return send(res, 200, { ok: true });
  }

  return fail(res, 404, 'No such endpoint.');
}

/* ---------------- server ---------------- */
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/api' || url.startsWith('/api/')) {
    const qs = url.indexOf('?') >= 0 ? url.slice(url.indexOf('?') + 1) : '';
    const segs = url.split('?')[0].split('/').filter(Boolean).slice(1);
    handleApi(req, res, segs, new URLSearchParams(qs)).catch(e => {
      if (!res.headersSent) fail(res, 400, e.message || 'Something went wrong.');
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed.');
  serveStatic(req, res, url);
});

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(name => {
    (ifaces[name] || []).forEach(a => {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    });
  });
  return out;
}

/* ---------------- backups ----------------
   Restoring is a command rather than a button: it replaces everybody's data at
   once, and that should take a moment's thought and a stopped server. */
function backupList() {
  let names = [];
  try { names = fs.readdirSync(DATA_DIR); } catch (e) { return []; }
  return names
    .filter(n => /^db\.(bak|\d{4}-\d{2}-\d{2})\.json$/.test(n))
    .map(n => {
      const full = path.join(DATA_DIR, n);
      let st = null, summary = '(unreadable)';
      try {
        st = fs.statSync(full);
        const d = JSON.parse(fs.readFileSync(full, 'utf8'));
        summary = (d.profiles || []).length + ' people, ' +
          (d.characters || []).length + ' characters, ' +
          (d.campaigns || []).length + ' campaigns';
      } catch (e) { /* leave the summary as it is */ }
      return {
        name: n, path: full, summary: summary,
        when: st ? st.mtime.toISOString().replace('T', ' ').slice(0, 16) : '?',
        size: st ? Math.round(st.size / 1024) : 0
      };
    })
    .sort((a, b) => (a.when < b.when ? 1 : -1));
}

function printBackups() {
  const list = backupList();
  console.log('');
  if (!list.length) {
    console.log('  No backups yet in ' + DATA_DIR);
    console.log('  One is kept each day, plus db.bak.json from the last write.');
    console.log('');
    return list;
  }
  console.log('  Backups in ' + DATA_DIR + ':');
  console.log('');
  list.forEach(b => {
    console.log('    ' + b.name.padEnd(22) + b.when + '   ' +
      String(b.size + ' KB').padEnd(9) + b.summary);
  });
  console.log('');
  console.log('  To put one back:  node server.js --restore ' + list[0].name);
  console.log('');
  return list;
}

function restoreBackup(which) {
  // a bare name means one from the data folder; anything else is a path
  const candidate = which.indexOf(path.sep) >= 0 || which.indexOf('/') >= 0
    ? path.resolve(which) : path.join(DATA_DIR, which);
  if (!fs.existsSync(candidate)) {
    console.error('\n  There is no file at ' + candidate);
    printBackups();
    return 1;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
  } catch (e) {
    console.error('\n  ' + candidate + ' is not readable as JSON: ' + e.message);
    console.error('  Nothing has been changed.\n');
    return 1;
  }
  if (!parsed || typeof parsed !== 'object' ||
    !Array.isArray(parsed.profiles) || !Array.isArray(parsed.characters)) {
    console.error('\n  ' + candidate + ' does not look like a Character Forge database.');
    console.error('  It has no profiles or characters list. Nothing has been changed.\n');
    return 1;
  }

  // keep what is there now, under a name that says what it is
  if (fs.existsSync(DB_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const aside = path.join(DATA_DIR, 'db.before-restore.' + stamp + '.json');
    try {
      fs.copyFileSync(DB_FILE, aside);
      console.log('\n  The current data has been kept as ' + path.basename(aside));
    } catch (e) {
      console.error('\n  Could not set the current data aside: ' + e.message);
      console.error('  Refusing to restore over it.\n');
      return 1;
    }
  }

  db = Object.assign({}, EMPTY_DB, parsed);
  saveDb();
  console.log('  Restored from ' + path.basename(candidate) + ':');
  console.log('    ' + db.profiles.length + ' people, ' + db.characters.length +
    ' characters, ' + db.campaigns.length + ' campaigns');
  console.log('  Start the server as usual to use it.\n');
  return 0;
}

if (ARGS.listBackups) {
  printBackups();
  process.exit(0);
}
if (ARGS.restore) {
  process.exit(restoreBackup(ARGS.restore));
}

/* --reset-pin runs and exits without starting the server. */
if (ARGS.resetPin) {
  const p = profileByName(ARGS.resetPin);
  if (!p) {
    console.error('No profile called "' + ARGS.resetPin + '". Known: ' +
      (db.profiles.map(x => x.name).join(', ') || '(none yet)'));
    process.exit(1);
  }
  setPin(p, null);
  Object.keys(db.tokens).forEach(t => { if (db.tokens[t] === p.id) delete db.tokens[t]; });
  saveDb();
  console.log('Cleared the PIN for "' + p.name + '". They can set a new one next time they sign in.');
  process.exit(0);
}

server.listen(ARGS.port, () => {
  const addrs = lanAddresses();
  console.log('');
  console.log('  Character Forge is running.');
  console.log('');
  console.log('  On this machine:   http://localhost:' + ARGS.port);
  addrs.forEach(a => console.log('  On the network:     http://' + a + ':' + ARGS.port));
  if (!addrs.length) console.log('  (no network address found — only this machine can reach it)');
  console.log('');
  console.log('  Data:              ' + DB_FILE);
  console.log('  Profiles:          ' + (db.profiles.map(p => p.name).join(', ') || 'none yet'));
  console.log('  Characters:        ' + db.characters.length);
  console.log('');
  const backups = backupList().length;
  console.log('  Backups:           ' + (backups ? backups + ' kept — node server.js --list-backups' : 'none yet'));
  console.log('');
  console.log('  Give one of the network addresses to your players. Ctrl+C to stop.');
  console.log('');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + ARGS.port + ' is already in use.' +
      '\n  Something else is running there — try: node server.js --port 8081\n');
  } else {
    console.error('\n  Could not start: ' + e.message + '\n');
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  Saving and stopping.');
  clearInterval(heartbeat);
  watchers.forEach(w => { try { w.res.end(); } catch (e) { } });
  saveDb();
  process.exit(0);
});

module.exports = { server, hashPin, pinMatches, visibleCharacter, filterCharacter, broadcast, backupList };
