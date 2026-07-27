/* ============================================================
   Server and auth suite.

   Boots the real server.js as a child process against a throwaway data
   directory, then talks to it over HTTP exactly as a browser would.

       node src/test-server.js
   ============================================================ */
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'server.js');
const PORT = 18099 + (process.pid % 300);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-test-'));

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, extra) {
  if (cond) { pass++; return true; }
  fail++; failures.push(label + (extra ? '  — ' + extra : ''));
  return false;
}
function eq(a, b, label) {
  return ok(a === b, label, 'got ' + JSON.stringify(a) + ', wanted ' + JSON.stringify(b));
}
function section(name) { console.log('\n\x1b[1m' + name + '\x1b[0m'); }

/* ---------------- a tiny HTTP client ---------------- */
function request(method, url, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const body = opts.body === undefined ? null
      : (typeof opts.rawBody === 'string' ? opts.rawBody : JSON.stringify(opts.body));
    const headers = {};
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (body !== null) headers['Content-Length'] = Buffer.byteLength(body);
    if (opts.token) headers['X-Forge-Token'] = opts.token;
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: url, headers },
      res => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch (e) { /* not json */ }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}
const GET = (u, t) => request('GET', u, { token: t });
const POST = (u, b, t) => request('POST', u, { body: b === undefined ? {} : b, token: t });
const PUT = (u, b, t) => request('PUT', u, { body: b, token: t });
const DEL = (u, t) => request('DELETE', u, { token: t });

/* Hold an event stream open and collect what comes down it. */
function watch(token) {
  const w = {
    chunks: [], headers: null, req: null, res: null,
    events() {
      return w.chunks.join('').split('\n')
        .filter(l => l.indexOf('data: ') === 0)
        .map(l => { try { return JSON.parse(l.slice(6)); } catch (e) { return null; } })
        .filter(Boolean);
    },
    waitFor(re, ms) {
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const look = () => {
          if (re.test(w.chunks.join(''))) return resolve();
          if (Date.now() - started > (ms || 3000)) {
            return reject(new Error('nothing matching ' + re + ' arrived on the stream'));
          }
          setTimeout(look, 25);
        };
        look();
      });
    },
    close() {
      try { w.req.destroy(); } catch (e) { }
    }
  };
  w.ready = new Promise((resolve, reject) => {
    w.req = http.request({
      host: '127.0.0.1', port: PORT, method: 'GET',
      path: '/api/events?token=' + encodeURIComponent(token),
      headers: { Accept: 'text/event-stream' }
    }, res => {
      w.res = res;
      w.headers = res.headers;
      res.setEncoding('utf8');
      res.on('data', d => w.chunks.push(d));
      res.on('error', () => { });
      // resolve once the first chunk lands, so the stream is really open
      const wait = setInterval(() => {
        if (w.chunks.length) { clearInterval(wait); resolve(w); }
      }, 15);
      setTimeout(() => { clearInterval(wait); resolve(w); }, 2000);
    });
    w.req.on('error', reject);
    w.req.end();
  });
  return w;
}

/* ---------------- boot and shutdown ---------------- */
let child = null;
function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [SERVER, '--port', String(PORT), '--data', DATA],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => reject(new Error('server did not start:\n' + out)), 10000);
    child.stdout.on('data', d => {
      out += d.toString();
      if (out.includes('is running')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', d => { out += d.toString(); });
    child.on('exit', code => {
      if (!out.includes('is running')) { clearTimeout(timer); reject(new Error('server exited ' + code + ':\n' + out)); }
    });
  });
}
function stop() {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 3000);
  });
}
function runCli(args) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [SERVER, '--data', DATA].concat(args),
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => out += d.toString());
    p.on('exit', code => resolve({ code, out }));
  });
}
function readDb() {
  return JSON.parse(fs.readFileSync(path.join(DATA, 'db.json'), 'utf8'));
}

/* a plausible character, the shape the client actually sends */
function character(id, name, over) {
  return Object.assign({
    id: id, name: name, systemId: '5e', level: 1, ancestry: 'Human', klass: 'Sorcerer',
    scores: { str: 10, dex: 14, con: 13, int: 12, wis: 11, cha: 16 },
    spells: ['fire-bolt'], prepared: [], inv: { items: [], purse: { gp: 10 } },
    play: { hp: 7, used: {} }, journal: [], privacy: {}, campaignId: null,
    campaignHistory: [], rev: 0
  }, over || {});
}

/* ============================================================ */
async function main() {
  await start();

  let nickToken = null, samToken = null, nickId = null, samId = null, openId = null;

  section('Ping and static handling');
  {
    const r = await GET('/api/ping');
    eq(r.status, 200, 'ping answers 200');
    eq(r.json.ok, true, 'ping says ok');
    ok(typeof r.json.version === 'string', 'ping reports a version');
    eq(r.json.profiles, 0, 'no profiles on a fresh database');

    const traversals = [
      '/../server.js', '/..%2fserver.js', '/%2e%2e/server.js',
      '/public/../server.js', '/....//server.js', '/..\\server.js'
    ];
    for (const t of traversals) {
      const s = await GET(t);
      ok(s.status === 403 || s.status === 404,
        'path traversal refused: ' + t, 'status ' + s.status);
      ok(!/hashPin|require\(/.test(s.text), 'no server source leaked via ' + t);
    }
    const m = await request('POST', '/index.html', { body: {} });
    eq(m.status, 405, 'non-GET on a static path is refused');
    const nf = await GET('/api/nonsense');
    eq(nf.status, 401, 'an unknown api route asks for a token rather than confirming it exists');
  }

  section('Creating profiles');
  {
    let r = await POST('/api/profiles', { name: 'Nick', pin: '1234' });
    eq(r.status, 201, 'a profile is created');
    nickId = r.json.profile.id;
    eq(r.json.profile.name, 'Nick', 'the name comes back');
    eq(r.json.profile.hasPin, true, 'it reports having a PIN');
    ok(r.json.profile.pinHash === undefined, 'the hash is not sent to clients');
    ok(r.json.profile.pinSalt === undefined, 'the salt is not sent to clients');

    r = await POST('/api/profiles', { name: 'Sam', pin: '9999' });
    samId = r.json.profile.id;
    eq(r.status, 201, 'a second profile is created');

    r = await POST('/api/profiles', { name: 'Tablet' });
    openId = r.json.profile.id;
    eq(r.status, 201, 'a profile with no PIN is allowed');
    eq(r.json.profile.hasPin, false, 'and reports having none');

    r = await POST('/api/profiles', { name: 'nick', pin: '5555' });
    eq(r.status, 409, 'a duplicate name is refused, ignoring case');
    r = await POST('/api/profiles', { name: '   ' });
    eq(r.status, 400, 'a blank name is refused');
    r = await POST('/api/profiles', { name: 'x'.repeat(60) });
    eq(r.status, 400, 'an over-long name is refused');
    r = await POST('/api/profiles', { name: 'Badpin', pin: '12' });
    eq(r.status, 400, 'a two-digit PIN is refused');
    r = await POST('/api/profiles', { name: 'Badpin2', pin: 'abcd' });
    eq(r.status, 400, 'a non-numeric PIN is refused');

    r = await GET('/api/profiles');
    eq(r.status, 200, 'the profile list is open, so the picker can be drawn');
    eq(r.json.profiles.length, 3, 'three profiles are listed');
    ok(!/pinHash|pinSalt/.test(r.text), 'the list leaks no hashes');
  }

  section('PINs are not stored in the clear');
  {
    const db = readDb();
    ok(!db.profiles.some(p => p.pin !== undefined), 'no profile has a plain pin field');
    ok(fs.readFileSync(path.join(DATA, 'db.json'), 'utf8').indexOf('1234') < 0,
      'the PIN string appears nowhere in db.json');
    const nick = db.profiles.find(p => p.name === 'Nick');
    ok(/^[0-9a-f]{64}$/.test(nick.pinHash), 'the PIN is a sha-256 hash');
    ok(/^[0-9a-f]{16}$/.test(nick.pinSalt), 'with a per-profile salt');
    const sam = db.profiles.find(p => p.name === 'Sam');
    ok(sam.pinSalt !== nick.pinSalt, 'salts differ between profiles');
    const tab = db.profiles.find(p => p.name === 'Tablet');
    ok(!tab.pinHash, 'a profile with no PIN stores no hash');
  }

  section('Signing in');
  {
    let r = await POST('/api/profiles/' + nickId + '/claim', { pin: '0000' });
    eq(r.status, 403, 'the wrong PIN is refused');
    ok(!r.json.token, 'and hands out no token');
    r = await POST('/api/profiles/' + nickId + '/claim', { pin: null });
    eq(r.status, 403, 'no PIN at all is refused when one is set');
    r = await POST('/api/profiles/deadbeef/claim', { pin: '1234' });
    eq(r.status, 404, 'an unknown profile id is a 404');

    r = await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' });
    eq(r.status, 200, 'the right PIN signs in');
    ok(/^[0-9a-f]{64}$/.test(r.json.token), 'a 32-byte token comes back');
    nickToken = r.json.token;

    r = await POST('/api/profiles/' + openId + '/claim', {});
    eq(r.status, 200, 'a profile with no PIN signs in with none');
    ok(!!r.json.token, 'and still gets a token');

    r = await POST('/api/profiles/' + samId + '/claim', { pin: '9999' });
    samToken = r.json.token;
    ok(samToken !== nickToken, 'two people get different tokens');

    const second = await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' });
    ok(second.json.token !== nickToken, 'signing in on a second device gets its own token');
    const bothWork = await GET('/api/me', second.json.token);
    eq(bothWork.status, 200, 'and both devices stay signed in');
  }

  section('Tokens guard everything else');
  {
    let r = await GET('/api/me');
    eq(r.status, 401, 'no token is a 401');
    r = await GET('/api/me', 'not-a-real-token');
    eq(r.status, 401, 'a garbage token is a 401');
    r = await GET('/api/characters');
    eq(r.status, 401, 'the character list needs a token');
    r = await PUT('/api/characters/x', character('x', 'X'));
    eq(r.status, 401, 'saving needs a token');

    r = await GET('/api/nonsense', nickToken);
    eq(r.status, 404, 'an unknown api route is a 404 once you are signed in');

    r = await GET('/api/me', nickToken);
    eq(r.status, 200, 'a good token identifies you');
    eq(r.json.profile.name, 'Nick', 'as the right person');
    eq(r.json.profile.id, nickId, 'with the right id');
  }

  section('Changing a PIN');
  {
    let r = await POST('/api/profiles/' + nickId + '/pin', { current: 'wrong', pin: '4321' }, nickToken);
    eq(r.status, 403, 'the wrong current PIN is refused');
    r = await POST('/api/profiles/' + samId + '/pin', { current: '9999', pin: '1111' }, nickToken);
    eq(r.status, 403, 'you cannot change somebody else PIN');
    r = await POST('/api/profiles/' + nickId + '/pin', { current: '1234', pin: '99' }, nickToken);
    eq(r.status, 400, 'a too-short new PIN is refused');

    r = await POST('/api/profiles/' + nickId + '/pin', { current: '1234', pin: '4321' }, nickToken);
    eq(r.status, 200, 'the right current PIN lets you change it');
    r = await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' });
    eq(r.status, 403, 'the old PIN no longer works');
    r = await POST('/api/profiles/' + nickId + '/claim', { pin: '4321' });
    eq(r.status, 200, 'the new PIN does');
    nickToken = r.json.token;

    r = await POST('/api/profiles/' + nickId + '/pin', { current: '4321', pin: '1234' }, nickToken);
    eq(r.status, 200, 'and it can be changed back');
  }

  section('Saving and reading characters');
  {
    let r = await GET('/api/characters', nickToken);
    eq(r.status, 200, 'the list works when signed in');
    eq(r.json.characters.length, 0, 'and is empty to start');

    r = await PUT('/api/characters/c1', character('c1', 'Peacock Jones'), nickToken);
    eq(r.status, 201, 'a new character is created');
    eq(r.json.character.ownerProfileId, nickId, 'owned by whoever saved it');
    eq(r.json.character.rev, 1, 'starting at revision 1');
    ok(!!r.json.character.updatedAt, 'and stamped with a time');

    r = await GET('/api/characters', nickToken);
    eq(r.json.characters.length, 1, 'it shows up in the list');
    eq(r.json.characters[0].name, 'Peacock Jones', 'with its name');
    eq(r.json.characters[0].scores.cha, 16, 'and its nested data intact');
    eq(r.json.characters[0].inv.purse.gp, 10, 'including the purse');

    r = await GET('/api/characters/c1', nickToken);
    eq(r.status, 200, 'it can be fetched by id');
    eq(r.json.character.klass, 'Sorcerer', 'with the right class');

    const saved = r.json.character;
    saved.name = 'Peacock Jones II';
    r = await PUT('/api/characters/c1', saved, nickToken);
    eq(r.status, 200, 'an update succeeds');
    eq(r.json.character.rev, 2, 'and bumps the revision');
    eq(r.json.character.name, 'Peacock Jones II', 'and keeps the change');

    r = await PUT('/api/characters/c1', Object.assign(character('c1', 'Stale'), { rev: 1 }), nickToken);
    eq(r.status, 409, 'a stale revision is rejected');
    ok(!!r.json.character, 'and the current version is returned so the client can recover');
    eq(r.json.character.name, 'Peacock Jones II', 'the rejected write changed nothing');

    r = await PUT('/api/characters/c1', character('mismatch', 'X'), nickToken);
    eq(r.status, 400, 'an id that disagrees with the address is refused');
    r = await request('PUT', '/api/characters/c1', { body: {}, rawBody: '{not json', token: nickToken });
    eq(r.status, 400, 'malformed JSON is refused');
    ok(child.exitCode === null, 'and does not kill the server');

    const big = character('big', 'Big');
    big.journal = [{ id: 'j', text: 'x'.repeat(5 * 1024 * 1024) }];
    r = await PUT('/api/characters/big', big, nickToken).catch(e => ({ status: 'refused' }));
    ok(r.status === 400 || r.status === 'refused', 'an oversized body is refused', 'status ' + r.status);
    ok(child.exitCode === null, 'and does not kill the server either');
  }

  section('One person cannot see or touch another person characters');
  {
    let r = await PUT('/api/characters/s1', character('s1', 'Sam Secretkeeper'), samToken);
    eq(r.status, 201, 'Sam saves a character of their own');

    r = await GET('/api/characters', nickToken);
    eq(r.json.characters.length, 1, 'Nick still sees only one');
    ok(!r.json.characters.some(c => c.id === 's1'), 'and it is not Sam character');
    ok(r.text.indexOf('Secretkeeper') < 0, 'Sam name appears nowhere in the raw response');

    r = await GET('/api/characters/s1', nickToken);
    eq(r.status, 404, 'fetching it directly is a 404, not a 403 that confirms it exists');
    ok(r.text.indexOf('Secretkeeper') < 0, 'and leaks nothing');

    r = await PUT('/api/characters/s1', character('s1', 'Hijacked', { rev: 1 }), nickToken);
    eq(r.status, 403, 'Nick cannot overwrite it');
    r = await GET('/api/characters/s1', samToken);
    eq(r.json.character.name, 'Sam Secretkeeper', 'and it is unchanged');

    r = await DEL('/api/characters/s1', nickToken);
    eq(r.status, 403, 'Nick cannot delete it');
    r = await GET('/api/characters/s1', samToken);
    eq(r.status, 200, 'it is still there');
  }

  section('Deleting');
  {
    let r = await PUT('/api/characters/gone', character('gone', 'Doomed'), nickToken);
    eq(r.status, 201, 'a character to delete is created');
    r = await DEL('/api/characters/gone', nickToken);
    eq(r.status, 200, 'the owner can delete it');
    r = await GET('/api/characters/gone', nickToken);
    eq(r.status, 404, 'and then it is gone');
    r = await DEL('/api/characters/gone', nickToken);
    eq(r.status, 200, 'deleting it twice is not an error');
  }

  section('Concurrent writes to one character');
  {
    await PUT('/api/characters/race', character('race', 'Racer'), nickToken);
    const base = (await GET('/api/characters/race', nickToken)).json.character;
    const results = await Promise.all([0, 1, 2, 3, 4].map(i =>
      PUT('/api/characters/race', Object.assign({}, base, { name: 'Racer ' + i }), nickToken)));
    const good = results.filter(r => r.status === 200 || r.status === 201).length;
    const stale = results.filter(r => r.status === 409).length;
    eq(good + stale, 5, 'every concurrent write got a clear answer');
    ok(good >= 1, 'at least one of them landed');
    const after = (await GET('/api/characters/race', nickToken)).json.character;
    ok(/^Racer \d$/.test(after.name), 'the stored character is one of the writes, not a blend');
    const revs = new Set(results.filter(r => r.json && r.json.character && r.status !== 409)
      .map(r => r.json.character.rev));
    eq(revs.size, good, 'each accepted write got its own revision number');
    await DEL('/api/characters/race', nickToken);
  }

  section('Signing out');
  {
    let r = await POST('/api/signout', {}, samToken);
    eq(r.status, 200, 'sign-out succeeds');
    r = await GET('/api/me', samToken);
    eq(r.status, 401, 'the token stops working');
    r = await GET('/api/characters', samToken);
    eq(r.status, 401, 'for every route');
    r = await GET('/api/me', nickToken);
    eq(r.status, 200, 'and nobody else is signed out');

    r = await POST('/api/profiles/' + samId + '/claim', { pin: '9999' });
    eq(r.status, 200, 'Sam can sign in again');
    samToken = r.json.token;
    r = await GET('/api/characters', samToken);
    eq(r.json.characters.length, 1, 'and their character is still there');
  }

  section('Surviving a restart');
  {
    const before = readDb();
    await stop();
    await start();

    let r = await GET('/api/ping');
    eq(r.json.profiles, 3, 'the profiles came back');
    r = await GET('/api/me', nickToken);
    eq(r.status, 200, 'the token still works after a restart');
    eq(r.json.profile.name, 'Nick', 'as the same person');
    r = await GET('/api/characters', nickToken);
    eq(r.json.characters.length, 1, 'the characters came back');
    eq(r.json.characters[0].name, 'Peacock Jones II', 'with their edits');
    r = await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' });
    eq(r.status, 200, 'the PIN survived too');

    ok(fs.existsSync(path.join(DATA, 'db.bak.json')), 'a backup file was kept');
    const day = new Date().toISOString().slice(0, 10);
    ok(fs.existsSync(path.join(DATA, 'db.' + day + '.json')), 'and a dated copy for today');
    const bak = JSON.parse(fs.readFileSync(path.join(DATA, 'db.bak.json'), 'utf8'));
    ok(Array.isArray(bak.profiles), 'the backup is valid JSON with the same shape');
    ok(before.characters.length > 0, 'the database on disk held the characters');
  }

  section('Recovering a damaged database');
  {
    await stop();
    const dbPath = path.join(DATA, 'db.json');
    const goodCopy = fs.readFileSync(dbPath, 'utf8');
    fs.writeFileSync(dbPath, '{ this is not json at all');
    await start();
    const r = await GET('/api/ping');
    eq(r.status, 200, 'the server starts even with a corrupt database');
    eq(r.json.profiles, 3, 'and recovers the profiles from the backup');
    const me = await GET('/api/me', nickToken);
    eq(me.status, 200, 'tokens came back with it');
    await stop();
    fs.writeFileSync(dbPath, goodCopy);
    await start();
    eq((await GET('/api/ping')).json.profiles, 3, 'and the good file restores cleanly');
  }

  section('The --reset-pin command');
  {
    await stop();
    let r = await runCli(['--reset-pin', 'Nobody']);
    eq(r.code, 1, 'an unknown name fails');
    ok(/No profile called/.test(r.out), 'and says so plainly');
    ok(/Nick/.test(r.out), 'listing who it does know about');

    r = await runCli(['--reset-pin', 'Nick']);
    eq(r.code, 0, 'a known name succeeds');
    ok(/Cleared the PIN/.test(r.out), 'and confirms it');

    await start();
    let s = await POST('/api/profiles/' + nickId + '/claim', {});
    eq(s.status, 200, 'the profile can now be claimed with no PIN');
    const freshToken = s.json.token;
    s = await GET('/api/profiles');
    eq(s.json.profiles.find(p => p.id === nickId).hasPin, false, 'and shows as having no PIN');
    s = await GET('/api/me', nickToken);
    eq(s.status, 401, 'the old tokens for that profile were invalidated');
    s = await GET('/api/me', samToken);
    eq(s.status, 200, 'but not anybody else tokens');

    s = await POST('/api/profiles/' + nickId + '/pin', { current: null, pin: '1234' }, freshToken);
    eq(s.status, 200, 'a new PIN can be set with no current one');
    s = await POST('/api/profiles/' + nickId + '/claim', {});
    eq(s.status, 403, 'and it takes effect');
    nickToken = (await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' })).json.token;
  }

  section('Campaigns');
  let campId = null, dmToken = null, dmId = null;
  {
    // a third person to be the DM, so the roles are properly separate
    let r = await POST('/api/profiles', { name: 'Dana', pin: '2468' });
    dmId = r.json.profile.id;
    dmToken = (await POST('/api/profiles/' + dmId + '/claim', { pin: '2468' })).json.token;

    r = await GET('/api/campaigns', dmToken);
    eq(r.status, 200, 'the campaign list works when signed in');
    eq(r.json.campaigns.length, 0, 'and is empty to start');
    r = await GET('/api/campaigns');
    eq(r.status, 401, 'and needs a token');

    r = await POST('/api/campaigns', { name: '', systemId: '5e' }, dmToken);
    eq(r.status, 400, 'a nameless campaign is refused');
    r = await POST('/api/campaigns', { name: 'Tuesday' }, dmToken);
    eq(r.status, 400, 'a campaign with no game is refused');

    r = await POST('/api/campaigns', { name: 'Tuesday night', systemId: '5e', blurb: 'Owlbears' }, dmToken);
    eq(r.status, 201, 'a campaign is created');
    campId = r.json.campaign.id;
    eq(r.json.campaign.name, 'Tuesday night', 'with its name');
    eq(r.json.campaign.dmProfileId, dmId, 'and whoever made it is the DM');
    eq(r.json.campaign.yourRole, 'dm', 'which it reports back');
    eq(r.json.campaign.memberCount, 0, 'nobody at the table yet');

    r = await GET('/api/campaigns', dmToken);
    eq(r.json.campaigns.length, 1, 'the DM sees it as theirs');
    r = await GET('/api/campaigns', nickToken);
    eq(r.json.campaigns.length, 0, 'Nick is not in it');
    eq(r.json.others.length, 1, 'but can see the table exists, so he can join it');
    eq(r.json.others[0].yourRole, 'none', 'with no role in it');
    eq(r.json.others[0].dmName, 'Dana', 'and is told who is running it');

    r = await PUT('/api/campaigns/' + campId, { name: 'Wednesday night' }, nickToken);
    eq(r.status, 403, 'a player cannot rename somebody else campaign');
    r = await PUT('/api/campaigns/' + campId, { blurb: 'Fewer owlbears' }, dmToken);
    eq(r.status, 200, 'the DM can edit it');
    eq(r.json.campaign.blurb, 'Fewer owlbears', 'and the change sticks');
    r = await PUT('/api/campaigns/' + campId, { name: '  ' }, dmToken);
    eq(r.status, 400, 'but cannot blank the name');
  }

  section('Bringing a character to a table');
  {
    let r = await GET('/api/characters', nickToken);
    const nickChar = r.json.characters[0];
    ok(!!nickChar, 'Nick has a character to bring');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: nickChar.id, action: 'join' }, samToken);
    eq(r.status, 403, 'Sam cannot sign up somebody else character');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 'nope', action: 'join' }, nickToken);
    eq(r.status, 404, 'an unknown character is a 404');
    r = await POST('/api/campaigns/nope/members',
      { characterId: nickChar.id, action: 'join' }, nickToken);
    eq(r.status, 404, 'an unknown campaign is a 404');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: nickChar.id, action: 'join' }, nickToken);
    eq(r.status, 200, 'Nick brings his own character');
    eq(r.json.character.campaignId, campId, 'and it now points at the campaign');
    ok(r.json.character.campaignHistory.length >= 1, 'with a history entry written for him');
    const entry = r.json.character.campaignHistory[r.json.character.campaignHistory.length - 1];
    eq(entry.campaignId, campId, 'naming the campaign');
    eq(entry.name, 'Tuesday night', 'as it was called when he joined');
    eq(entry.leftAt, null, 'and still open');

    r = await GET('/api/campaigns', nickToken);
    eq(r.json.campaigns.length, 1, 'the campaign is now his');
    eq(r.json.campaigns[0].yourRole, 'player', 'as a player');
    eq(r.json.campaigns[0].memberCount, 1, 'with one at the table');
    eq(r.json.others.length, 0, 'and no longer listed as somebody else table');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: nickChar.id, action: 'join' }, nickToken);
    eq(r.status, 200, 'joining twice is harmless');
    const camp2 = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp2.json.campaign.memberCount, 1, 'and does not double him up');

    // a wrong-system character
    r = await PUT('/api/characters/pf', character('pf', 'Grix', { systemId: 'pf2' }), samToken);
    eq(r.status, 201, 'Sam makes a Pathfinder character');
    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 'pf', action: 'join' }, samToken);
    eq(r.status, 400, 'it cannot join a 5e table');
    ok(/different game/.test(r.json.error), 'and the reason says why', r.json.error);

    // one character, one table
    r = await POST('/api/campaigns', { name: 'Other game', systemId: '5e' }, samToken);
    const otherId = r.json.campaign.id;
    r = await POST('/api/campaigns/' + otherId + '/members',
      { characterId: nickChar.id, action: 'join' }, nickToken);
    eq(r.status, 409, 'a character already at a table cannot join a second');
    ok(/another campaign/.test(r.json.error), 'and is told to leave the first');
    await DEL('/api/campaigns/' + otherId, samToken);
  }

  section('What the DM can see, and what a fellow player can');
  {
    // Sam joins the same table so there are two players
    let r = await PUT('/api/characters/s2', character('s2', 'Sam Fivee'), samToken);
    eq(r.status, 201, 'Sam makes a 5e character');
    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'join' }, samToken);
    eq(r.status, 200, 'and brings them to the table');

    const asDm = await GET('/api/campaigns/' + campId, dmToken);
    eq(asDm.status, 200, 'the DM can open the campaign');
    eq(asDm.json.characters.length, 2, 'and gets both whole sheets for the party table');
    eq(asDm.json.party.length, 2, 'plus the summaries');
    eq(asDm.json.players.length, 2, 'and knows who is playing');
    ok(asDm.json.characters.every(c => c.scores), 'the sheets are complete enough to derive from');
    ok(asDm.json.party.every(p => p.playerName), 'each summary names the player');

    const asPlayer = await GET('/api/campaigns/' + campId, nickToken);
    eq(asPlayer.status, 200, 'a player can open it too');
    eq(asPlayer.json.characters.length, 2, 'and gets the party, so they can draw the table');
    ok(asPlayer.json.characters.some(c => c.ownerProfileId === nickId), 'including their own');
    ok(asPlayer.json.characters.some(c => c.ownerProfileId !== nickId), 'and the other player');
    eq(asPlayer.json.party.length, 2, 'with the summaries as well');
    ok(asPlayer.text.indexOf('"scores"') > 0, 'the numbers are there, so the table works');
    const mineOwn = asPlayer.json.characters.find(c => c.ownerProfileId === nickId);
    const theirs = asPlayer.json.characters.find(c => c.ownerProfileId !== nickId);
    eq(mineOwn.privacy !== undefined, true, 'their own sheet keeps its settings map');
    eq(theirs.privacy, undefined, 'the other one does not hand its settings over');
    eq(theirs.name, 'Sam Fivee', 'the other character is named');
    ok(!!theirs.scores, 'and its numbers shared, since AC and HP always are');

    // a stranger
    const stranger = await GET('/api/campaigns/' + campId, samToken);
    eq(stranger.status, 200, 'Sam is a member so can see it');
    const tabletToken = (await POST('/api/profiles/' + openId + '/claim', {})).json.token;
    const out = await GET('/api/campaigns/' + campId, tabletToken);
    eq(out.status, 200, 'somebody not at the table can see it exists, so they can join');
    eq(out.json.campaign.name, 'Tuesday night', 'and what it is called');
    eq(out.json.campaign.yourRole, 'none', 'with no role in it');
    eq(out.json.characters.length, 0, 'but gets no sheets');
    eq(out.json.party.length, 0, 'and no party list');
    eq(out.json.players.length, 0, 'and is not told who is playing');
    ok(out.text.indexOf('Sam Fivee') < 0, 'no character names leak');
    ok(out.text.indexOf('Peacock') < 0, 'none at all');
    ok(out.text.indexOf('Nick') < 0, 'nor player names');

    // "your characters" means yours, not the party's
    const dmOwn = await GET('/api/characters', dmToken);
    eq(dmOwn.json.characters.length, 0, 'the DM own character list stays her own');
    ok(dmOwn.text.indexOf('Peacock') < 0, 'the party is not in it');
    ok(dmOwn.text.indexOf('Fivee') < 0, 'none of it');
    const nickOwn = await GET('/api/characters', nickToken);
    eq(nickOwn.json.characters.length, 1, 'and a player list is still just theirs');
    eq(nickOwn.json.characters[0].ownerProfileId, nickId, 'owned by them');

    // the DM can read one sheet directly; other players cannot
    const one = await GET('/api/characters/s2', dmToken);
    eq(one.status, 200, 'the DM can open a party member sheet');
    eq(one.json.character.name, 'Sam Fivee', 'and it is the right one');
    const fellow = await GET('/api/characters/s2', nickToken);
    eq(fellow.status, 200, 'and so can a fellow player at the same table');
    eq(fellow.json.character.name, 'Sam Fivee', 'getting the sheet');
    eq(fellow.json.character.privacy, undefined, 'without its settings map');
    // what they get is the party-level view, which step 4 opened deliberately
    eq(fellow.json.character.notes, '', 'and not the DM-only notes box');

    // and the DM still cannot write to it
    const dmWrite = await PUT('/api/characters/s2',
      Object.assign({}, one.json.character, { name: 'DM was here' }), dmToken);
    eq(dmWrite.status, 403, 'the DM cannot edit a player sheet');
    const unchanged = await GET('/api/characters/s2', samToken);
    eq(unchanged.json.character.name, 'Sam Fivee', 'so it is untouched');
    const dmDelete = await DEL('/api/characters/s2', dmToken);
    eq(dmDelete.status, 403, 'nor delete it');
  }

  section('A sheet cannot talk its way into a campaign');
  {
    // the character PUT must ignore campaign fields entirely
    const mine = (await GET('/api/characters', samToken)).json.characters
      .find(c => c.id === 'pf');
    const sneaky = Object.assign({}, mine, {
      campaignId: campId,
      campaignHistory: [{ campaignId: campId, name: 'I was always here', joinedAt: 'x', leftAt: null }]
    });
    const r = await PUT('/api/characters/pf', sneaky, samToken);
    eq(r.status, 200, 'the save itself succeeds');
    eq(r.json.character.campaignId, null, 'but the campaign claim is ignored');
    eq(r.json.character.campaignHistory.length, 0, 'and so is the invented history');
    const camp = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp.json.characters.length, 2, 'the party did not grow');
    ok(camp.text.indexOf('Grix') < 0, 'and the gatecrasher is not in it');
  }

  section('Leaving a table');
  {
    let r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'leave' }, nickToken);
    eq(r.status, 403, 'one player cannot remove another character');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'leave' }, samToken);
    eq(r.status, 200, 'the owner can walk away');
    eq(r.json.character.campaignId, null, 'the character is unattached');
    const hist = r.json.character.campaignHistory;
    eq(hist[hist.length - 1].campaignId, campId, 'and the history entry is closed');
    ok(!!hist[hist.length - 1].leftAt, 'with a date');

    let camp = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp.json.campaign.memberCount, 1, 'the table is down to one');
    ok(camp.text.indexOf('Fivee') < 0, 'and the departed sheet is gone from it');
    r = await GET('/api/characters/s2', dmToken);
    eq(r.status, 404, 'so the DM can no longer read that sheet');

    // the DM can also show someone the door
    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'join' }, samToken);
    eq(r.status, 200, 'Sam rejoins');
    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'leave' }, dmToken);
    eq(r.status, 200, 'and the DM can remove them');
    camp = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp.json.campaign.memberCount, 1, 'leaving one at the table');
    const back = await GET('/api/characters/s2', samToken);
    eq(back.json.character.campaignHistory.length, 2, 'both stints are on record');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'leave' }, samToken);
    eq(r.status, 200, 'leaving twice is harmless');
  }

  section('Deleting a character leaves no ghost at the table');
  {
    let r = await PUT('/api/characters/ghost', character('ghost', 'Ghosty'), samToken);
    eq(r.status, 201, 'a character is made');
    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 'ghost', action: 'join' }, samToken);
    eq(r.status, 200, 'and joins the table');
    let camp = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp.json.campaign.memberCount, 2, 'two at the table');

    r = await DEL('/api/characters/ghost', samToken);
    eq(r.status, 200, 'then the character is deleted');
    camp = await GET('/api/campaigns/' + campId, dmToken);
    eq(camp.json.campaign.memberCount, 1, 'and the table is back to one');
    ok(camp.text.indexOf('Ghosty') < 0, 'with no trace of them');
    eq(camp.json.characters.length, 1, 'and no broken row for the DM');
  }

  section('Closing a campaign');
  {
    let r = await POST('/api/campaigns', { name: 'Doomed game', systemId: '5e' }, dmToken);
    const doomed = r.json.campaign.id;
    r = await PUT('/api/characters/d1', character('d1', 'Leftbehind'), samToken);
    r = await POST('/api/campaigns/' + doomed + '/members',
      { characterId: 'd1', action: 'join' }, samToken);
    eq(r.status, 200, 'somebody is at the doomed table');

    r = await DEL('/api/campaigns/' + doomed, nickToken);
    eq(r.status, 403, 'a player cannot close it');
    r = await DEL('/api/campaigns/' + doomed, dmToken);
    eq(r.status, 200, 'the DM can');

    r = await GET('/api/campaigns/' + doomed, dmToken);
    eq(r.status, 404, 'and then it is gone');
    const left = await GET('/api/characters/d1', samToken);
    eq(left.status, 200, 'the character survives');
    eq(left.json.character.campaignId, null, 'unattached');
    const h2 = left.json.character.campaignHistory;
    eq(h2[h2.length - 1].name, 'Doomed game', 'with the closed campaign in their history');
    ok(!!h2[h2.length - 1].leftAt, 'marked as over');
    r = await DEL('/api/campaigns/' + doomed, dmToken);
    eq(r.status, 200, 'closing it twice is harmless');
  }

  section('The journal, and what stays private');
  {
    // Nick writes three entries at the three levels, on a character the DM can see
    const nick = (await GET('/api/characters', nickToken)).json.characters[0];
    nick.journal = (nick.journal || []).concat([
      {
        id: 'j-party', date: '2026-03-01', title: 'The bridge at Kellhorn',
        text: 'We burned it. Everyone saw.', tags: [], visibility: 'party', auto: false
      },
      {
        id: 'j-dm', date: '2026-03-02', title: 'A word with the DM',
        text: 'Quietly bribed the harbourmaster.', tags: [], visibility: 'dm', auto: false
      },
      {
        id: 'j-private', date: '2026-03-03', title: 'What I am really after',
        text: 'ABSOLUTELYSECRETPHRASE — I mean to betray the party at Highfell.',
        tags: [], visibility: 'private', auto: false
      }
    ]);
    let r = await PUT('/api/characters/' + nick.id, nick, nickToken);
    eq(r.status, 200, 'the entries save');
    const mine = r.json.character.journal;
    ok(mine.some(e => e.id === 'j-private'), 'and the owner gets their private one back');

    const own = await GET('/api/characters/' + nick.id, nickToken);
    const ownJ = own.json.character.journal;
    eq(ownJ.filter(e => !e.auto).length, 3, 'the owner sees all three of their own entries');
    ok(own.text.indexOf('ABSOLUTELYSECRETPHRASE') > 0, 'including the private text');

    // the DM sees two of the three, and the third leaves no trace at all
    const dmView = await GET('/api/characters/' + nick.id, dmToken);
    eq(dmView.status, 200, 'the DM can read the sheet');
    const dmJ = dmView.json.character.journal.filter(e => !e.auto);
    eq(dmJ.length, 2, 'and gets the shared and DM-only entries');
    ok(dmJ.some(e => e.id === 'j-party'), 'the shared one is there');
    ok(dmJ.some(e => e.id === 'j-dm'), 'the DM-only one is there');
    ok(!dmJ.some(e => e.id === 'j-private'), 'the private one is not');
    // searched in the raw string, not the parsed object
    ok(dmView.text.indexOf('ABSOLUTELYSECRETPHRASE') < 0,
      'the private text appears nowhere in the raw response');
    ok(dmView.text.indexOf('What I am really after') < 0, 'nor its title');
    ok(dmView.text.indexOf('j-private') < 0, 'nor its id');
    ok(dmView.text.indexOf('Highfell') < 0, 'nor anything in it');
    ok(dmView.text.indexOf('bribed the harbourmaster') > 0,
      'while what was shared with the DM did come through');

    // the same through the campaign route, which is how the DM actually arrives
    const camp = await GET('/api/campaigns/' + campId, dmToken);
    ok(camp.text.indexOf('ABSOLUTELYSECRETPHRASE') < 0,
      'the campaign response leaks nothing private either');
    ok(camp.text.indexOf('bribed the harbourmaster') > 0, 'but does carry the shared entries');
    const campJ = camp.json.characters[0].journal.filter(e => !e.auto);
    eq(campJ.length, 2, 'two entries in the party payload');

    // filtering must not have edited the stored character
    const stored = readDb().characters.find(c => c.id === nick.id);
    eq(stored.journal.filter(e => !e.auto).length, 3,
      'the stored character still has all three');
    ok(JSON.stringify(stored).indexOf('ABSOLUTELYSECRETPHRASE') > 0,
      'so filtering a response did not delete anything');

    // a fellow player gets nothing at all, private or otherwise
    const fellow = await GET('/api/characters/' + nick.id, samToken);
    eq(fellow.status, 404, 'a fellow player cannot read the sheet');
    ok(fellow.text.indexOf('Kellhorn') < 0, 'so not even the shared entry reaches them');
  }

  section('Entries that write themselves');
  {
    let r = await PUT('/api/characters/auto1', character('auto1', 'Autoline'), samToken);
    eq(r.status, 201, 'a fresh character has a journal');
    eq(r.json.character.journal.length, 0, 'and it starts empty');

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 'auto1', action: 'join' }, samToken);
    eq(r.status, 200, 'they join a table');
    let j = r.json.character.journal;
    eq(j.length, 1, 'which writes one entry by itself');
    eq(j[0].auto, 'join', 'marked as automatic');
    eq(j[0].title, 'Joined Tuesday night', 'naming the campaign');
    eq(j[0].visibility, 'party', 'shared with the table, since it is no secret');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(j[0].date), 'with a plain date', j[0].date);

    r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 'auto1', action: 'leave' }, samToken);
    j = r.json.character.journal;
    eq(j.length, 2, 'leaving writes another');
    eq(j[1].auto, 'leave', 'also automatic');
    eq(j[1].title, 'Left Tuesday night', 'naming the campaign they left');

    // a save that predates the automatic entries must not wipe them
    const stale = (await GET('/api/characters/auto1', samToken)).json.character;
    const withoutAuto = Object.assign({}, stale, { journal: [] });
    r = await PUT('/api/characters/auto1', withoutAuto, samToken);
    eq(r.status, 200, 'an older copy still saves');
    eq(r.json.character.journal.length, 2, 'but the automatic entries survive it');
    ok(r.json.character.journal.every(e => e.auto), 'because the server keeps its own');

    // the player's own entries are theirs to remove
    const withMine = Object.assign({}, r.json.character);
    withMine.journal = withMine.journal.concat([{
      id: 'mine1', date: '2026-01-01', title: 'Mine', text: 'x',
      tags: [], visibility: 'private', auto: false
    }]);
    r = await PUT('/api/characters/auto1', withMine, samToken);
    eq(r.json.character.journal.length, 3, 'a hand-written entry is added');
    const dropped = Object.assign({}, r.json.character);
    dropped.journal = dropped.journal.filter(e => e.id !== 'mine1');
    r = await PUT('/api/characters/auto1', dropped, samToken);
    eq(r.json.character.journal.length, 2, 'and can be deleted again');
    ok(!r.json.character.journal.some(e => e.id === 'mine1'), 'it is really gone');
    await DEL('/api/characters/auto1', samToken);
  }

  section('Journal entries are cleaned up on the way in');
  {
    const c = (await GET('/api/characters', samToken)).json.characters
      .find(x => x.id === 'pf');
    c.journal = [
      { id: 'ok', date: '2026-05-05', title: 'Fine', text: 'Fine.', visibility: 'party' },
      { title: 'No id', text: 'Still fine.' },
      { id: 'weird', title: 'Bad level', text: 'x', visibility: 'everyone' },
      { id: 'long', title: 'L'.repeat(400), text: 'T'.repeat(30000), visibility: 'dm' },
      { id: 'tags', title: 'Tagged', text: 'x', tags: 'not an array', visibility: 'dm' }
    ];
    const r = await PUT('/api/characters/pf', c, samToken);
    eq(r.status, 200, 'an odd journal still saves');
    const j = r.json.character.journal;
    eq(j.length, 5, 'all five entries survive');
    ok(!!j[1].id, 'a missing id is filled in');
    eq(j[2].visibility, 'private', 'an unknown visibility falls back to private, not public');
    ok(j[3].title.length <= 200, 'an enormous title is trimmed', String(j[3].title.length));
    ok(j[3].text.length <= 20000, 'and so is enormous text', String(j[3].text.length));
    ok(Array.isArray(j[4].tags), 'tags are always an array');
    ok(j.every(e => typeof e.date === 'string'), 'every entry has a date field');
    ok(j.every(e => e.auto === false || typeof e.auto === 'string'), 'and a sane auto flag');

    // 500 is the cap, so a runaway client cannot bloat the data file
    const many = Object.assign({}, r.json.character);
    many.journal = Array.from({ length: 700 }, (_, i) =>
      ({ id: 'm' + i, date: '2026-01-01', title: 'n' + i, text: 'x', visibility: 'private' }));
    const big = await PUT('/api/characters/pf', many, samToken);
    eq(big.status, 200, 'a huge journal is accepted');
    eq(big.json.character.journal.length, 500, 'but capped');

    const tidy = Object.assign({}, big.json.character, { journal: [] });
    await PUT('/api/characters/pf', tidy, samToken);
  }

  section('Sharing levels over the wire');
  {
    // Nick is at the table; Sam brings a character to the same table
    let r = await POST('/api/campaigns/' + campId + '/members',
      { characterId: 's2', action: 'join' }, samToken);
    eq(r.status, 200, 'Sam rejoins the table so there are two players');

    const nick = (await GET('/api/characters', nickToken)).json.characters[0];
    nick.notes = 'NOTESONLYFORTHEDM';
    nick.personality = { ideals: 'SHAREDIDEAL', backstory: 'SHAREDBACKSTORY' };
    nick.gear = 'GEARFOREVERYONE';
    nick.privacy = { flavour: 'party', gear: 'dm', spells: 'private' };
    nick.spells = ['fire-bolt', 'SECRETSPELL'];
    nick.inv = {
      items: [
        { id: 'v1', name: 'OPENROPE', cat: 'gear', qty: 1, weight: 10, cp: 100, visibility: 'party' },
        { id: 'v2', name: 'DMLOCKPICKS', cat: 'tool', qty: 1, weight: 1, cp: 2500, visibility: 'dm' },
        { id: 'v3', name: 'HIDDENRELIC', cat: 'gear', qty: 2, weight: 4, cp: 50000, visibility: 'private' }
      ],
      coins: { gp: 7 }
    };
    r = await PUT('/api/characters/' + nick.id, nick, nickToken);
    eq(r.status, 200, 'the settings save');
    eq(r.json.character.privacy.gear, 'dm', 'and come back as set');
    eq(r.json.character.inv.items[2].visibility, 'private', 'as do the item levels');

    const total = 10 + 1 + 4 * 2;

    // the DM
    const dmv = await GET('/api/characters/' + nick.id, dmToken);
    eq(dmv.status, 200, 'the DM can read the sheet');
    const dc = dmv.json.character;
    eq(dc.notes, 'NOTESONLYFORTHEDM', 'the DM gets the DM-only notes');
    eq(dc.gear, 'GEARFOREVERYONE', 'and the DM-only gear notes');
    eq(dc.personality.backstory, 'SHAREDBACKSTORY', 'and the shared backstory');
    eq(dc.spells.length, 0, 'but not the private spell list');
    ok(dmv.text.indexOf('SECRETSPELL') < 0, 'which leaves no trace in the response');
    eq(dc.inv.items[0].name, 'OPENROPE', 'the open possession by name');
    eq(dc.inv.items[1].name, 'DMLOCKPICKS', 'the DM-only one by name');
    eq(dc.inv.items[2].name, 'hidden item', 'and the private one nameless');
    ok(dmv.text.indexOf('HIDDENRELIC') < 0, 'with the name nowhere in the response');
    eq(dc.inv.items.reduce((t, i) => t + i.weight * i.qty, 0), total,
      'and the carried weight still adds up');
    eq(dc.scores.cha, nick.scores.cha, 'the numbers are all still there');
    eq(dc.privacy, undefined, 'and the settings map is not passed on');

    // a fellow player
    const pv = await GET('/api/characters/' + nick.id, samToken);
    eq(pv.status, 200, 'a fellow player at the same table can now read the sheet');
    const pc = pv.json.character;
    eq(pc.personality.backstory, 'SHAREDBACKSTORY', 'and gets the shared backstory');
    eq(pc.notes, '', 'but not the notes box');
    ok(pv.text.indexOf('NOTESONLYFORTHEDM') < 0, 'which is nowhere in their response');
    eq(pc.gear, '', 'nor the DM-only gear notes');
    ok(pv.text.indexOf('GEARFOREVERYONE') < 0, 'also absent entirely');
    eq(pc.spells.length, 0, 'nor the private spell list');
    eq(pc.inv.items[0].name, 'OPENROPE', 'they see the open possession');
    eq(pc.inv.items[1].name, 'hidden item', 'but not the DM-only one');
    eq(pc.inv.items[2].name, 'hidden item', 'nor the private one');
    ok(pv.text.indexOf('DMLOCKPICKS') < 0, 'with no name leaking');
    ok(pv.text.indexOf('HIDDENRELIC') < 0, 'for either');
    eq(pc.inv.items.reduce((t, i) => t + i.weight * i.qty, 0), total,
      'and their totals add up too');
    eq(pc.scores.cha, nick.scores.cha,
      'the numbers reach them, so the party table works');
    eq(pc.level, nick.level, 'as does the level');
    eq(pc.name, nick.name, 'and the name');

    // somebody at no table at all
    const tabletToken = (await POST('/api/profiles/' + openId + '/claim', {})).json.token;
    const out = await GET('/api/characters/' + nick.id, tabletToken);
    eq(out.status, 404, 'somebody not at the table gets nothing');
    ok(out.text.indexOf('SHAREDBACKSTORY') < 0, 'not even what is shared with the table');

    // the stored character is untouched by all that filtering
    const stored = readDb().characters.find(x => x.id === nick.id);
    eq(stored.notes, 'NOTESONLYFORTHEDM', 'the stored notes survive');
    eq(stored.spells.length, 2, 'the stored spell list survives');
    eq(stored.inv.items[2].name, 'HIDDENRELIC', 'and the stored item keeps its name');
    eq(typeof stored.privacy, 'object', 'and its settings');
  }

  section('Sharing settings are checked on the way in');
  {
    const c = (await GET('/api/characters', samToken)).json.characters
      .find(x => x.id === 's2');
    c.privacy = {
      flavour: 'dm',              // fine
      notes: 'everyone',          // not a level
      nonsense: 'party',          // not a section
      spells: ''                  // empty
    };
    c.inv = {
      items: [
        { id: 'a', name: 'A', cat: 'gear', qty: 1, weight: 1, cp: 0, visibility: 'dm' },
        { id: 'b', name: 'B', cat: 'gear', qty: 1, weight: 1, cp: 0, visibility: 'everyone' },
        { id: 'x', name: 'X', cat: 'gear', qty: 1, weight: 1, cp: 0, hidden: true }
      ],
      coins: {}
    };
    const r = await PUT('/api/characters/s2', c, samToken);
    eq(r.status, 200, 'the save succeeds');
    const p = r.json.character.privacy;
    eq(p.flavour, 'dm', 'a good setting is kept');
    eq(p.notes, undefined, 'an invalid level is dropped rather than stored');
    eq(p.nonsense, undefined, 'and so is an unknown section');
    eq(p.spells, undefined, 'as is an empty one');
    eq(Object.keys(p).length, 1, 'leaving only what made sense');

    const items = r.json.character.inv.items;
    eq(items[0].visibility, 'dm', 'a good item level is kept');
    eq(items[1].visibility, 'private', 'a mangled one becomes private, not public');
    eq(items[2].visibility, 'party', 'an absent one becomes shared, the item default');
    eq(items[2].hidden, undefined,
      'and a client cannot pass off a placeholder as a real item');

    // nothing a viewer sends back can widen what they were given
    const asDm = (await GET('/api/characters/s2', dmToken)).json.character;
    const echoed = Object.assign({}, asDm, { rev: 999 });
    const pushBack = await PUT('/api/characters/s2', echoed, dmToken);
    eq(pushBack.status, 403, 'and the DM cannot write the filtered copy back');
    const after = (await GET('/api/characters/s2', samToken)).json.character;
    eq(after.privacy.flavour, 'dm', 'so the owner settings are intact');
  }

  section('Campaigns survive a restart');
  {
    await stop();
    await start();
    const r = await GET('/api/campaigns/' + campId, dmToken);
    eq(r.status, 200, 'the campaign is still there');
    eq(r.json.campaign.name, 'Tuesday night', 'with its name');
    eq(r.json.campaign.blurb, 'Fewer owlbears', 'and the edited blurb');
    eq(r.json.campaign.memberCount, 2, 'and its membership');
    eq(r.json.characters.length, 2, 'and the DM still gets both sheets');
  }

  section('The event stream');
  {
    let r = await GET('/api/events');
    eq(r.status, 401, 'watching without a token is refused');
    r = await GET('/api/events?token=rubbish');
    eq(r.status, 401, 'and a rubbish one too');

    // open a stream, then make a change and see what comes down it
    const stream = watch(nickToken);
    await stream.ready;
    ok(stream.headers['content-type'].indexOf('text/event-stream') === 0,
      'the stream is typed as an event stream', stream.headers['content-type']);
    ok(/no-store/.test(stream.headers['cache-control'] || ''), 'and is not cached');
    ok(stream.chunks.join('').indexOf(': watching') >= 0, 'it says hello straight away');
    ok(/retry: \d+/.test(stream.chunks.join('')), 'and suggests a retry interval');

    const c = (await GET('/api/characters', samToken)).json.characters
      .find(x => x.id === 's2');
    c.name = 'Sam Fivee the Second';
    c.notes = 'ABSOLUTELYSECRETNOTE';
    c.privacy = { notes: 'private' };
    await PUT('/api/characters/s2', c, samToken);
    await stream.waitFor(/"kind":"changed"/, 3000);

    const got = stream.events();
    ok(got.length >= 1, 'a change on one device reaches another', got.length + ' events');
    const ev = got[got.length - 1];
    eq(ev.kind, 'changed', 'the notice says something changed');
    eq(ev.by, samId, 'and who by, so a client can ignore its own echo');
    ok(typeof ev.seq === 'number', 'with a sequence number');
    ok(!!ev.at, 'and a time');

    // the whole point: the notice carries nothing at all
    const raw = stream.chunks.join('');
    eq(Object.keys(ev).sort().join(','), 'at,by,kind,seq',
      'and nothing else besides');
    ok(raw.indexOf('ABSOLUTELYSECRETNOTE') < 0,
      'the private note is nowhere in the stream');
    ok(raw.indexOf('Sam Fivee') < 0, 'nor is the character name');
    ok(raw.indexOf('scores') < 0, 'nor any of the numbers');
    ok(raw.length < 2000, 'the stream stays tiny', raw.length + ' bytes');

    // a second change bumps the sequence
    c.rev = (await GET('/api/characters/s2', samToken)).json.character.rev;
    c.name = 'Sam Fivee the Third';
    await PUT('/api/characters/s2', c, samToken);
    await stream.waitFor(new RegExp('"seq":' + (ev.seq + 1)), 3000);
    const later = stream.events();
    ok(later.length >= 2, 'a second change sends a second notice', later.length + ' events');
    ok(later[later.length - 1].seq > ev.seq, 'with a higher sequence number');

    // two watchers both hear about it
    const second = watch(dmToken);
    await second.ready;
    const camp = await POST('/api/campaigns', { name: 'Another game', systemId: '5e' }, samToken);
    await second.waitFor(/"kind":"changed"/, 3000);
    ok(second.events().length >= 1, 'a second watcher hears about it too');
    ok(stream.events().length >= 3, 'and so does the first');
    await DEL('/api/campaigns/' + camp.json.campaign.id, samToken);

    stream.close();
    second.close();
    await new Promise(r2 => setTimeout(r2, 200));
    const after = await GET('/api/ping');
    eq(after.status, 200, 'closing a stream leaves the server working');
    const c2 = (await GET('/api/characters/s2', samToken)).json.character;
    c2.name = 'Sam Fivee';
    const post = await PUT('/api/characters/s2', c2, samToken);
    eq(post.status, 200, 'and writing still works with nobody watching');
  }

  section('Backups and restore');
  {
    const before = readDb();
    const day = new Date().toISOString().slice(0, 10);

    let r = await runCli(['--list-backups']);
    eq(r.code, 0, 'the backup list runs');
    ok(/db\.bak\.json/.test(r.out), 'and names the last-write copy');
    ok(new RegExp('db\\.' + day + '\\.json').test(r.out), 'and today copy');
    ok(/people,/.test(r.out), 'summarising what is in each');
    ok(/--restore/.test(r.out), 'and says how to put one back');

    // a nonsense restore must change nothing
    r = await runCli(['--restore', 'db.no-such-day.json']);
    eq(r.code, 1, 'restoring a file that is not there fails');
    ok(/no file at/.test(r.out), 'and says so plainly');
    eq(JSON.stringify(readDb()) === JSON.stringify(before), true,
      'having changed nothing');

    const junk = path.join(DATA, 'junk.json');
    fs.writeFileSync(junk, 'this is not json');
    r = await runCli(['--restore', junk]);
    eq(r.code, 1, 'restoring something unreadable fails');
    ok(/not readable as JSON/.test(r.out), 'and says why');
    ok(/Nothing has been changed/.test(r.out), 'and reassures you');

    const wrong = path.join(DATA, 'wrong.json');
    fs.writeFileSync(wrong, JSON.stringify({ hello: 'world' }));
    r = await runCli(['--restore', wrong]);
    eq(r.code, 1, 'restoring the wrong kind of file fails');
    ok(/does not look like a Character Forge database/.test(r.out), 'and says what it wanted');
    eq(JSON.stringify(readDb()) === JSON.stringify(before), true, 'still unchanged');

    // a real one, made by hand so we know exactly what is in it
    const snapshot = path.join(DATA, 'db.2020-01-01.json');
    fs.writeFileSync(snapshot, JSON.stringify({
      version: 1,
      profiles: [{ id: 'old1', name: 'Someone Old', createdAt: '2020-01-01T00:00:00.000Z' }],
      campaigns: [],
      characters: [{ id: 'oldchar', name: 'Ancient Hero', ownerProfileId: 'old1', systemId: '5e', level: 9, rev: 1 }],
      tokens: {}
    }));

    await stop();
    r = await runCli(['--restore', 'db.2020-01-01.json']);
    eq(r.code, 0, 'a real backup restores');
    ok(/kept as db\.before-restore/.test(r.out), 'keeping the current data aside first');
    ok(/1 people, 1 characters/.test(r.out), 'and reporting what came back');

    const now2 = readDb();
    eq(now2.profiles.length, 1, 'the restored data is in place');
    eq(now2.profiles[0].name, 'Someone Old', 'with the old profile');
    eq(now2.characters.length, 1, 'and the old character');
    eq(now2.characters[0].name, 'Ancient Hero', 'by name');

    const asides = fs.readdirSync(DATA).filter(n => /^db\.before-restore\./.test(n));
    eq(asides.length, 1, 'and one set-aside copy was written');
    const aside = JSON.parse(fs.readFileSync(path.join(DATA, asides[0]), 'utf8'));
    ok(aside.profiles.length >= 4, 'holding everything that was there before',
      aside.profiles.length + ' profiles');

    await start();
    const ping = await GET('/api/ping');
    eq(ping.json.profiles, 1, 'the server starts on the restored data');
    const stale = await GET('/api/me', nickToken);
    eq(stale.status, 401, 'and the old tokens no longer work, since they are not in it');

    // put everything back so the rest of the suite is unaffected
    await stop();
    r = await runCli(['--restore', asides[0]]);
    eq(r.code, 0, 'and the set-aside copy restores in turn');
    await start();
    const back = await GET('/api/me', nickToken);
    eq(back.status, 200, 'so everyone is signed in again');
    eq(back.json.profile.name, 'Nick', 'as themselves');
  }

  section('Client store contract');
  {
    // the shapes 95-store.js depends on, asserted here so the two cannot drift
    let r = await GET('/api/ping');
    ok('ok' in r.json && 'version' in r.json && 'name' in r.json, 'ping has ok, version and name');
    r = await GET('/api/profiles');
    ok(Array.isArray(r.json.profiles), 'profiles is an array under .profiles');
    ok(r.json.profiles.every(p => 'id' in p && 'name' in p && 'hasPin' in p),
      'each profile has id, name and hasPin');
    r = await POST('/api/profiles/' + nickId + '/claim', { pin: '1234' });
    ok('token' in r.json && 'profile' in r.json, 'claim returns token and profile');
    r = await GET('/api/me', r.json.token);
    ok('profile' in r.json, 'me returns profile');
    r = await GET('/api/characters', nickToken);
    ok(Array.isArray(r.json.characters), 'characters is an array under .characters');
    const c = r.json.characters[0];
    r = await PUT('/api/characters/' + c.id, c, nickToken);
    ok('character' in r.json && typeof r.json.character.rev === 'number',
      'a save returns the character with a numeric rev');
    const conflict = await PUT('/api/characters/' + c.id, Object.assign({}, c, { rev: 0 }), nickToken);
    eq(conflict.status, 409, 'a stale save is a 409, which is what the client checks for');
    ok('character' in conflict.json, 'and carries the server version');
  }

  await stop();

  console.log('\n' + '='.repeat(56));
  if (fail) {
    console.log('\x1b[31m' + pass + ' passed, ' + fail + ' failed\x1b[0m');
    failures.forEach(f => console.log('  ✗ ' + f));
  } else {
    console.log('\x1b[32m' + pass + ' passed, 0 failed\x1b[0m');
  }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* leave it */ }
  process.exit(fail ? 1 : 0);
}

main().catch(async e => {
  console.error('\n\x1b[31mThe suite itself broke:\x1b[0m ' + e.stack);
  await stop();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) { /* leave it */ }
  process.exit(1);
});
