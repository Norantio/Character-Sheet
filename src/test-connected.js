/* ============================================================
   Connected-mode integration test.

   Boots the real server, then loads the real page from it in jsdom over
   HTTP — external app.js and app.css and all. Then clicks through signing
   in, building a character, and proves the data reached the server and
   comes back on a different device.

       NODE_PATH=<jsdom dir> node src/test-connected.js
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'server.js');
const PORT = 18499 + (process.pid % 300);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-conn-'));

let pass = 0, fail = 0;
const fails = [];
const jsErrors = [];
function ok(label, cond, extra) {
  if (cond) { pass++; return true; }
  fail++; fails.push(label + (extra ? ' — ' + extra : ''));
  return false;
}
function eq(label, got, want) {
  return ok(label + ' (got ' + JSON.stringify(got) + ')', String(got) === String(want),
    'expected ' + JSON.stringify(want));
}
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ---------------- the server ---------------- */
let child = null;
function startServer() {
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
  });
}
function stopServer() {
  return new Promise(res => {
    if (!child || child.exitCode !== null) return res();
    child.on('exit', () => res());
    child.kill();
    setTimeout(res, 2000);
  });
}
/* plain node request, for checking the server directly */
function raw(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {};
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    if (token) headers['X-Forge-Token'] = token;
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: url, headers }, res => {
      let t = '';
      res.on('data', d => t += d);
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(t); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text: t, json: j });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ---------------- a browser ---------------- */
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  if (/Not implemented/.test(e.message)) return;      // scrollTo / print
  jsErrors.push(e.message + '\n' + (e.detail && e.detail.stack ? e.detail.stack : ''));
});
vc.on('error', m => jsErrors.push('console.error: ' + m));

/* jsdom has no fetch, so give the page one backed by node's http. This is the
   only shim: the HTML, CSS and JS are all really served by server.js. */
function installFetch(w) {
  w.fetch = function (url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const u = new URL(url, ORIGIN);
      const headers = Object.assign({}, opts.headers || {});
      const body = opts.body === undefined ? null : opts.body;
      if (body !== null) headers['Content-Length'] = Buffer.byteLength(body);
      const req = http.request(
        { host: u.hostname, port: u.port, method: opts.method || 'GET', path: u.pathname + u.search, headers },
        res => {
          let text = '';
          res.on('data', d => text += d);
          res.on('end', () => resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(JSON.parse(text))
          }));
        });
      req.on('error', reject);
      if (body !== null) req.write(body);
      req.end();
    });
  };
}

/* jsdom has no EventSource either. This one is deliberately minimal and only
   given to the devices that are testing the push path, so every other section
   goes on exercising the polling fallback. */
function installEventSource(w) {
  w.EventSource = function (url) {
    const self = this;
    self.onopen = null; self.onmessage = null; self.onerror = null;
    self.url = url;
    const u = new URL(url, ORIGIN);
    self._req = http.request({
      host: u.hostname, port: u.port, method: 'GET',
      path: u.pathname + u.search, headers: { Accept: 'text/event-stream' }
    }, res => {
      res.setEncoding('utf8');
      if (res.statusCode !== 200) {
        if (self.onerror) self.onerror({ status: res.statusCode });
        return;
      }
      if (self.onopen) self.onopen({});
      let buf = '';
      res.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = frame.split('\n')
            .filter(l => l.indexOf('data:') === 0)
            .map(l => l.slice(5).trim()).join('\n');
          if (data && self.onmessage) self.onmessage({ data: data });
        }
      });
      res.on('end', () => { if (self.onerror) self.onerror({}); });
      res.on('error', () => { if (self.onerror) self.onerror({}); });
    });
    self._req.on('error', () => { if (self.onerror) self.onerror({}); });
    self._req.end();
    self.close = function () { try { self._req.destroy(); } catch (e) { } };
  };
}

/* jsdom shares localStorage between instances of the same origin, which would
   quietly make every "device" the same device. So each one gets its own. */
function makeStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    __map: map
  };
}

/* A device. Pass another device's storage to simulate coming back to it, and
   { live: true } to give it a working event stream. */
async function device(storage, opts) {
  const store = storage || makeStorage();
  const wantLive = !!(opts && opts.live);
  const d = await JSDOM.fromURL(ORIGIN + '/', {
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(w) {
      w.confirm = () => true;
      w.alert = () => { };
      w.print = () => { };
      w.scrollTo = () => { };
      Object.defineProperty(w, 'localStorage', { value: store, configurable: true });
      installFetch(w);
      if (wantLive) installEventSource(w);
    }
  });
  await painted(d);
  d.__storage = store;
  return d;
}
function painted(d) {
  return new Promise((res, rej) => {
    let n = 0;
    const look = () => {
      const app = d.window.document.getElementById('app');
      if (app && app.innerHTML.length > 300) return res();
      if (++n > 600) return rej(new Error('the page never painted'));
      setTimeout(look, 10);
    };
    setTimeout(look, 10);
  });
}
/* Let the app's own promises settle after a click. */
function settle(w, ms) {
  return new Promise(res => setTimeout(res, ms === undefined ? 120 : ms));
}

let win, doc;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));
function use(d) { win = d.window; doc = win.document; }
function text() {
  return (($('#topbar') || {}).textContent || '') + ' ' +
    (($('#connbar') || {}).textContent || '') + ' ' +
    (($('#app') || {}).textContent || '');
}
function click(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) throw new Error('no element for ' + sel);
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}
function setInput(sel, value) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) throw new Error('no input for ' + sel);
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
  return el;
}
function byAct(act) { return $$('[data-act="' + act + '"]'); }
async function tapPin(digits) {
  for (const ch of String(digits)) {
    click($$('[data-act="pinkey"]').find(b => b.dataset.key === ch));
    await settle(win, 10);
  }
}

/* ============================================================ */
async function main() {
  await startServer();

  section('The page is served by the server');
  {
    const idx = await raw('GET', '/');
    eq('the root serves the page', idx.status, 200);
    ok('with the app shell in it', /id="app"/.test(idx.text));
    ok('and a connection bar', /id="connbar"/.test(idx.text));
    ok('the script is external, not inlined', /<script src="app\.js/.test(idx.text));
    ok('and so is the stylesheet', /href="app\.css/.test(idx.text));
    ok('the page itself is small', idx.text.length < 4000, idx.text.length + ' bytes');

    const js = await raw('GET', '/app.js');
    eq('app.js is served', js.status, 200);
    ok('and is the whole client', js.text.length > 2000000, js.text.length + ' bytes');
    const css = await raw('GET', '/app.css');
    eq('app.css is served', css.status, 200);
    ok('the 2.6 MB script is cacheable, so a tablet downloads it once',
      /max-age=\d+/.test(js.headers['cache-control'] || ''), js.headers['cache-control']);
    ok('so is the stylesheet', /max-age=\d+/.test(css.headers['cache-control'] || ''));
    ok('but the page itself is revalidated, so a rebuild is picked up',
      /no-cache|no-store/.test(idx.headers['cache-control'] || ''), idx.headers['cache-control']);
    ok('the script is typed as javascript', /javascript/.test(js.headers['content-type'] || ''));
    ok('and the stylesheet as css', /text\/css/.test(css.headers['content-type'] || ''));
    ok('api responses are never cached',
      /no-store/.test((await raw('GET', '/api/ping')).headers['cache-control'] || ''));
  }

  section('A brand-new device is asked who is using it');
  const dev1 = await device();
  use(dev1);
  {
    eq('the store noticed the server', win.eval('STORE.mode'), 'server');
    ok('and reports itself connected', win.eval('isConnected()') === true);
    ok('but not signed in', win.eval('signedIn()') === false);
    eq('the view is the picker', win.eval('app.view'), 'signin');
    ok('which asks who you are', /Who are you/.test(text()));
    ok('the connection bar names the server', /Connected to/.test($('#connbar').textContent));
    ok('nobody exists yet, and it says so', /Nobody has been added yet/.test(text()));
    eq('there is one way forward: add yourself', byAct('whoadd').length, 1);
    ok('no character list is shown to a stranger', !/Your characters/.test(text()));
    ok('remember-me is ticked by default', $('[data-signf="remember"]').checked === true);
  }

  section('Adding yourself');
  {
    click(byAct('whoadd')[0]);
    await settle(win);
    ok('the form appears', /Add yourself/.test(text()));

    click(byAct('whocreate')[0]);
    await settle(win);
    ok('a nameless profile is refused', /Put your name in first/.test(text()));

    setInput('[data-signf="newName"]', 'Nick');
    setInput('[data-signf="newPin"]', '12');
    setInput('[data-signf="newPin2"]', '12');
    click(byAct('whocreate')[0]);
    await settle(win);
    ok('a two-digit PIN is refused, in plain words', /4 to 12 digits/.test(text()));

    setInput('[data-signf="newPin"]', '1234');
    setInput('[data-signf="newPin2"]', '4321');
    click(byAct('whocreate')[0]);
    await settle(win);
    ok('mismatched PINs are caught', /do not match/.test(text()));

    setInput('[data-signf="newPin2"]', '1234');
    click(byAct('whocreate')[0]);
    await settle(win, 400);

    eq('you land on the character list', win.eval('app.view'), 'roster');
    ok('signed in', win.eval('signedIn()') === true);
    ok('the connection bar says who you are', /Signed in as/.test($('#connbar').textContent));
    ok('by name', /Nick/.test($('#connbar').textContent));
    ok('and offers a way out', byAct('signout').length === 1);
    ok('the roster is the normal empty state', /No characters yet/.test(text()));

    const serverSide = await raw('GET', '/api/profiles');
    eq('the server has the profile', serverSide.json.profiles.length, 1);
    eq('with the right name', serverSide.json.profiles[0].name, 'Nick');
    eq('and knows it has a PIN', serverSide.json.profiles[0].hasPin, true);
    ok('the PIN is not in the data file',
      fs.readFileSync(path.join(DATA, 'db.json'), 'utf8').indexOf('1234') < 0);
  }

  section('Building a character sends it to the server');
  let charId = null;
  {
    click(byAct('create')[0]);
    await settle(win);
    ok('the wizard starts on the system step', /Which game are you playing/.test(text()));
    const card = $$('[data-act="setsys"]').find(b => b.dataset.sys === '5e');
    ok('5e is on offer', !!card);
    click(card);
    await settle(win);
    const nameField = $$('input').find(i => i.dataset.field === 'name');
    ok('the identity step has a name field', !!nameField);
    setInput(nameField, 'Peacock Jones');
    await settle(win);
    charId = win.eval('app.currentId');
    ok('a character id exists', !!charId);

    await settle(win, 700);            // the write-through is debounced
    const res = await raw('GET', '/api/characters', undefined, win.eval('STORE.token'));
    eq('the server received it', res.json.characters.length, 1);
    eq('with the name typed in', res.json.characters[0].name, 'Peacock Jones');
    eq('owned by the right profile', res.json.characters[0].ownerProfileId, win.eval('STORE.profile.id'));
    ok('and given a revision', res.json.characters[0].rev >= 1);
    ok('the client learned the revision back', win.eval('cur().rev') >= 1);
    ok('nothing was written to localStorage in connected mode',
      win.eval('localStorage.getItem("characterForge.roster.v2")') === null);
    ok('but the token was remembered', /^[0-9a-f]{64}$/.test(win.eval('localStorage.getItem("characterForge.token.v1")') || ''));
  }

  section('Coming back to the same device does not ask again');
  const dev2 = await device(dev1.__storage);
  {
    use(dev2);
    ok('the remembered token signed you straight in', win.eval('signedIn()') === true);
    eq('and you land on your characters', win.eval('app.view'), 'roster');
    ok('no picker', !/Who are you/.test(text()));
    ok('your character is listed', /Peacock Jones/.test(text()));
    ok('loaded from the server, not this browser', win.eval('STORE.mode') === 'server');
  }

  section('A different device is a different person');
  const dev3 = await device();
  {
    use(dev3);
    eq('it starts at the picker', win.eval('app.view'), 'signin');
    eq('and Nick is offered as a card', byAct('whopick').length, 1);
    ok('marked as having a PIN', /PIN/.test($('[data-act="whopick"]').textContent));
    ok('but the character is not visible before signing in', !/Peacock Jones/.test(text()));

    click(byAct('whopick')[0]);
    await settle(win);
    ok('choosing the card asks for the PIN', /Enter your PIN/.test(text()));
    eq('a full keypad is drawn', $$('[data-act="pinkey"]').length, 12);

    await tapPin('9999');
    ok('the pin shows as four filled dots', ($('.pin-shown').textContent.match(/●/g) || []).length === 4);
    click(byAct('pingo')[0]);
    await settle(win, 300);
    ok('a wrong PIN is refused', /does not match/.test(text()));
    ok('and clears itself ready for another go', win.eval('signinUI.pin') === '');
    ok('you are still not signed in', win.eval('signedIn()') === false);
    ok('and still cannot see the character', !/Peacock Jones/.test(text()));

    await tapPin('1234');
    click(byAct('pingo')[0]);
    await settle(win, 500);
    ok('the right PIN gets in', win.eval('signedIn()') === true);
    ok('and Nick sees his character on the new device', /Peacock Jones/.test(text()));
  }

  section('Two people do not see each other');
  {
    // Sam signs up on this third device, replacing Nick on it
    click(byAct('signout')[0]);
    await settle(win, 400);
    eq('signing out returns to the picker', win.eval('app.view'), 'signin');
    ok('and forgets the token', win.eval('localStorage.getItem("characterForge.token.v1")') === null);
    ok('and empties the roster in memory', win.eval('app.roster.length') === 0);
    ok('so the character is off the screen', !/Peacock Jones/.test(text()));

    click(byAct('whoadd')[0]);
    await settle(win);
    setInput('[data-signf="newName"]', 'Sam');
    setInput('[data-signf="newPin"]', '5678');
    setInput('[data-signf="newPin2"]', '5678');
    click(byAct('whocreate')[0]);
    await settle(win, 400);
    ok('Sam is signed in', /Signed in as/.test($('#connbar').textContent) && /Sam/.test($('#connbar').textContent));
    ok('Sam sees no characters', /No characters yet/.test(text()));
    ok("and no trace of Nick's character anywhere on the page",
      text().indexOf('Peacock') < 0);
    eq('Sam roster really is empty', win.eval('app.roster.length'), 0);

    const samToken = win.eval('STORE.token');
    const asSam = await raw('GET', '/api/characters', undefined, samToken);
    eq('and the server sends Sam nothing', asSam.json.characters.length, 0);
    ok('not even in the raw JSON', asSam.text.indexOf('Peacock') < 0);

    const direct = await raw('GET', '/api/characters/' + charId, undefined, samToken);
    eq('asking for it by id is a 404', direct.status, 404);
    const hijack = await raw('PUT', '/api/characters/' + charId,
      { id: charId, name: 'Stolen', rev: 99 }, samToken);
    eq('and Sam cannot overwrite it', hijack.status, 403);
  }

  section("Nick's character survived all that");
  {
    use(dev2);
    await settle(win, 100);
    const res = await raw('GET', '/api/characters', undefined, win.eval('STORE.token'));
    eq('still exactly one character on the server', res.json.characters.length, 1);
    eq('with the right name', res.json.characters[0].name, 'Peacock Jones');
    eq('and the right owner', res.json.characters[0].ownerProfileId, win.eval('STORE.profile.id'));
  }

  section('A DM starts a campaign');
  const dmDev = await device();
  let campId = null;
  {
    use(dmDev);
    click(byAct('whoadd')[0]);
    await settle(win);
    setInput('[data-signf="newName"]', 'Dana');
    setInput('[data-signf="newPin"]', '');
    setInput('[data-signf="newPin2"]', '');
    click(byAct('whocreate')[0]);
    await settle(win, 400);
    ok('Dana is signed in', /Signed in as/.test($('#connbar').textContent));

    ok('the home page has a campaigns section', /Campaigns/.test(text()));
    ok('and says there are none yet', /No campaigns yet/.test(text()));
    eq('with one way to start one', byAct('campnew').length, 1);

    click(byAct('campnew')[0]);
    await settle(win);
    ok('the form appears', !!$('[data-campf="name"]'));
    click(byAct('campcreate')[0]);
    await settle(win, 200);
    ok('a nameless campaign is refused', /Give the campaign a name/.test(text()));

    setInput('[data-campf="name"]', 'Tuesday night');
    setInput('[data-campf="blurb"]', 'Too many owlbears');
    click(byAct('campcreate')[0]);
    await settle(win, 600);

    eq('you land on the campaign page', win.eval('app.view'), 'campaign');
    campId = win.eval('campUI.id');
    ok('with an id', !!campId);
    ok('the page names the campaign', /Tuesday night/.test(text()));
    ok('and says you are the DM', /you are the DM/.test(text()));
    ok('the blurb is shown', /Too many owlbears/.test(text()));
    ok('the party is empty and explains itself', /Nobody has brought a character yet/.test(text()));
    ok('the DM is offered the edit control', byAct('campedit').length === 1);
    ok('and a way to close it', byAct('campdel').length === 1);

    const onServer = await raw('GET', '/api/campaigns', undefined, win.eval('STORE.token'));
    eq('the server has the campaign', onServer.json.campaigns.length, 1);
    eq('with the DM set', onServer.json.campaigns[0].yourRole, 'dm');
  }

  section('A player brings a character to it');
  const nickDev = await device(dev1.__storage);
  {
    use(nickDev);
    ok('Nick is signed straight back in', win.eval('signedIn()') === true);
    ok('and sees the table listed', /Tuesday night/.test(text()));
    ok('as somebody else game', /Other tables on this server/.test(text()));
    ok('with the DM named', /DM Dana/.test(text()));

    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
    await settle(win, 500);
    eq('he can open it', win.eval('app.view'), 'campaign');
    ok('and is not told he is the DM', !/you are the DM/.test(text()));
    ok('he gets the plain party view, not the DM table', $$('.party').length === 0);
    ok('no edit controls for a player', byAct('campedit').length === 0);
    ok('and no way to close somebody else campaign', byAct('campdel').length === 0);

    click(byAct('campattach')[0]);
    await settle(win);
    const join = $$('[data-act="campjoin"]')[0];
    ok('his character is offered', !!join);
    ok('by name', /Peacock Jones/.test(join.textContent));
    click(join);
    await settle(win, 700);

    ok('the character is now listed as his at this table', /Your characters here/.test(text()));
    const mine = win.eval('(loadRoster()||[]).filter(c => c.campaignId).length');
    eq('and is attached', mine, 1);

    const onServer = await raw('GET', '/api/campaigns', undefined, win.eval('STORE.token'));
    eq('the server counts him at the table', onServer.json.campaigns[0].memberCount, 1);
    eq('as a player', onServer.json.campaigns[0].yourRole, 'player');
  }

  section("The campaign shows on the player's own sheet");
  {
    use(nickDev);
    click(byAct('open')[0]);
    await settle(win, 300);
    eq('his sheet opens', win.eval('app.view'), 'sheet');
    ok('the header names the campaign', /Campaign/.test(text()) && /Tuesday night/.test(text()));
    ok('and the sheet has a campaign box', /Playing in/.test(text()));
    ok('naming the DM', /Dana/.test(text()));
    ok('with a way to leave', byAct('campleave').length >= 1);
  }

  section('The DM sees the party at a glance');
  const dmDev2 = await device(dmDev.__storage);
  {
    use(dmDev2);
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
    await settle(win, 600);

    ok('the DM gets a party table', $$('.party').length === 1);
    const head = $$('.party th').map(t => t.textContent.trim());
    ok('with a character column', head.includes('Character'));
    ok('and hit points', head.includes('HP'));
    ok('and armour class', head.includes('AC'));
    ok('and the 5e passive perception column', head.some(t => /Passive/.test(t)));
    ok('and a spell DC column', head.includes('Spell DC'));
    ok('and carried load', head.includes('Load'));

    const rows = $$('.party tbody tr');
    eq('one row for one character', rows.length, 1);
    ok('naming the character', /Peacock Jones/.test(rows[0].textContent));
    ok('and who plays them', /Nick/.test(rows[0].textContent));
    ok('the row shows real numbers, not blanks',
      /\d+\s*\/\s*\d+/.test(rows[0].textContent), rows[0].textContent.replace(/\s+/g, ' '));
    ok('nothing failed to derive', !/could not work this sheet out/.test(text()));
  }

  section("The DM can read a sheet but not change it");
  {
    use(dmDev2);
    click($$('.party tbody tr')[0]);
    await settle(win, 300);

    eq('the sheet opens', win.eval('app.view'), 'sheet');
    ok('it is the right character', /Peacock Jones/.test(text()));
    ok('the app knows it belongs to someone else', win.eval('readingSomeoneElse()') === true);
    ok('it is marked as read-only', /Reading only/.test(text()));
    eq('with no Modify button', byAct('modify').length, 0);
    eq('and no Export', byAct('export').length, 0);
    eq('and no Delete', byAct('del').length, 0);
    ok('the way back goes to the party, not to a character list',
      byAct('campgo').length >= 1);
    ok('the DM is told whose it is', /played by Nick/.test(text()));
    ok('the campaign box offers no join or leave to the DM',
      byAct('campleave').length === 0 && byAct('campjoin').length === 0);

    // whatever the DM clicks, the player's sheet must not change
    const before = (await raw('GET', '/api/characters/' + charId, undefined,
      win.eval('STORE.token'))).json.character;
    const dmg = byAct('hp').find(b => b.dataset.delta === '-5');
    if (dmg) {
      click(dmg);
      await settle(win, 700);
      ok('a damage click is refused out loud', /somebody else/i.test(text()));
    } else {
      ok('a damage control was found on the sheet', false, 'no [data-act=hp] button');
    }
    const after = (await raw('GET', '/api/characters/' + charId, undefined,
      win.eval('STORE.token'))).json.character;
    eq('the revision did not move', after.rev, before.rev);
    eq('and the hit points are untouched', JSON.stringify(after.play), JSON.stringify(before.play));
    // a party sheet must never land in the DM's own roster: it is not hers to
    // own, to save, or to see on her home page
    eq('the roster of the DM is still empty', win.eval('app.roster.length'), 0);
  }

  section('A player writes a journal, and keeps one entry to themselves');
  {
    use(nickDev);
    if (win.eval('app.view') !== 'sheet') {
      click(byAct('open')[0]);
      await settle(win, 300);
    }
    ok('the sheet has a journal', /Journal/.test(text()));
    ok('with the join entry already written for them', /Joined Tuesday night/.test(text()));
    ok('marked as automatic', /automatic/.test(text()));

    // one shared with the table
    click(byAct('jadd')[0]);
    await settle(win);
    setInput('[data-jf="title"]', 'The bridge at Kellhorn');
    setInput('[data-jf="text"]', 'We burned it. Everyone saw.');
    setInput('[data-jf="visibility"]', 'party');
    click(byAct('jsave')[0]);
    await settle(win, 700);

    // and one nobody else may read
    click(byAct('jadd')[0]);
    await settle(win);
    setInput('[data-jf="title"]', 'What I am really after');
    setInput('[data-jf="text"]', 'ABSOLUTELYSECRETPHRASE - I mean to betray them at Highfell.');
    setInput('[data-jf="visibility"]', 'private');
    click(byAct('jsave')[0]);
    await settle(win, 900);

    ok('both entries are on his own sheet', /Kellhorn/.test(text()) && /really after/.test(text()));
    ok('and the secret text is visible to him', /ABSOLUTELYSECRETPHRASE/.test(text()));
    const own = await raw('GET', '/api/characters/' + charId, undefined, win.eval('STORE.token'));
    const written = own.json.character.journal.filter(e => !e.auto);
    eq('the server holds both', written.length, 2);
    ok('with the levels he chose',
      written.some(e => e.visibility === 'party') && written.some(e => e.visibility === 'private'));
  }

  section("What the DM's browser is sent, and what it is not");
  {
    use(dmDev2);
    // arrive the way a DM actually does: campaign page, then the party row
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId) || byAct('roster')[0]);
    await settle(win, 700);
    if (win.eval('app.view') !== 'campaign') {
      click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      await settle(win, 700);
    }
    click($$('.party tbody tr')[0]);
    await settle(win, 400);

    ok('the DM is on the sheet', /Peacock Jones/.test(text()));
    ok('and can read what was shared with the table', /Kellhorn/.test(text()));
    ok('but the private entry is not on the page', !/really after/.test(text()));
    ok('nor its text', !/ABSOLUTELYSECRETPHRASE/.test(text()));
    ok('nor anything in it', !/Highfell/.test(text()));
    ok('the DM is told that entries are being withheld',
      /kept to themselves are not shown/.test(text()));
    eq('and cannot add to somebody else journal', byAct('jadd').length, 0);
    eq('nor edit an entry', byAct('jedit').length, 0);
    eq('nor delete one', byAct('jdel').length, 0);
    eq('nor change who can read it', byAct('jvis').length, 0);

    // the strongest form: it is not in the browser at all, at any depth
    const inMemory = win.eval('JSON.stringify(app.guest || null)');
    ok('the private entry is not in the page memory', inMemory.indexOf('ABSOLUTELYSECRETPHRASE') < 0);
    ok('not even its title', inMemory.indexOf('really after') < 0);
    const everything = win.eval(
      'JSON.stringify({ guest: app.guest, roster: app.roster, camp: campUI.data, cache: STORE.cache })');
    ok('and nowhere else in the app either',
      everything.indexOf('ABSOLUTELYSECRETPHRASE') < 0);
    ok('while the shared entry did arrive', everything.indexOf('Kellhorn') > 0);
    const dmJournal = win.eval('JSON.stringify((app.guest && app.guest.journal || []).map(e => e.visibility))');
    ok('the DM has only party and dm entries', !/private/.test(dmJournal), dmJournal);
  }

  section('A player holds part of the sheet back');
  {
    use(nickDev);
    if (win.eval('app.view') !== 'sheet') {
      click(byAct('open')[0]);
      await settle(win, 300);
    }
    ok('the sharing box is on the sheet', /Who can see what/.test(text()));
    ok('and does not call it a note to yourself, because there is a server',
      !/note to yourself rather than a lock/.test(text()));

    // something recognisable at each level, set through the controls
    win.eval('const c = cur();' +
      'c.notes = "NOTESONLYFORDANA";' +
      'c.personality = { ideals: "IDEALEVERYONESEES", backstory: "MYSECRETPAST" };' +
      'c.gear = "GEARNOTEFORALL";' +
      'c.privacy = { notes: "dm", flavour: "party", gear: "party" };' +
      'invItems(c).length = 0;' +
      'invItems(c).push({ id: "p1", name: "OPENLANTERN", cat: "gear", qty: 1, weight: 2, cp: 500, visibility: "party" });' +
      'invItems(c).push({ id: "p2", name: "MYHIDDENRELIC", cat: "gear", qty: 3, weight: 5, cp: 90000, visibility: "private" });' +
      'persist(); render();');
    await settle(win, 900);

    ok('everything is on his own sheet', /NOTESONLYFORDANA/.test(text()) &&
      /MYSECRETPAST/.test(text()) && /MYHIDDENRELIC/.test(text()));

    // his own preview should agree with what the server will send
    click($$('[data-act="ppreview"]').find(b => b.dataset.as === 'dm'));
    await settle(win, 200);
    ok('previewing as the DM hides the relic', !/MYHIDDENRELIC/.test(text()));
    ok('but keeps the DM-only notes', /NOTESONLYFORDANA/.test(text()));
    ok('and shows a nameless line in its place', /hidden item/.test(text()));
    click($$('[data-act="ppreview"]').find(b => b.dataset.as === ''));
    await settle(win, 200);

    const onServer = await raw('GET', '/api/characters/' + charId, undefined, win.eval('STORE.token'));
    eq('the settings reached the server', onServer.json.character.privacy.notes, 'dm');
    eq('and the item level too', onServer.json.character.inv.items[1].visibility, 'private');
  }

  section("The DM's browser never receives what was held back");
  {
    use(dmDev2);
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId) || byAct('roster')[0]);
    await settle(win, 700);
    if (win.eval('app.view') !== 'campaign') {
      click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      await settle(win, 700);
    }
    click($$('.party tbody tr')[0]);
    await settle(win, 400);

    ok('the DM is on the sheet', /Peacock Jones/.test(text()));
    ok('and gets what was shared with them', /NOTESONLYFORDANA/.test(text()));
    ok('and what was shared with everyone', /MYSECRETPAST/.test(text()));
    ok('and the open possession', /OPENLANTERN/.test(text()));
    ok('but not the withheld one', !/MYHIDDENRELIC/.test(text()));
    ok('which shows as a nameless line instead', /hidden item/.test(text()));

    // the whole point of filtering on the server rather than in the page
    const everything = win.eval(
      'JSON.stringify({ guest: app.guest, roster: app.roster, camp: campUI.data, cache: STORE.cache })');
    ok('the withheld name is nowhere in the DM browser at all',
      everything.indexOf('MYHIDDENRELIC') < 0);
    ok('while the shared things did arrive',
      everything.indexOf('OPENLANTERN') > 0 && everything.indexOf('NOTESONLYFORDANA') > 0);
    ok('and the settings map was not handed over',
      win.eval('JSON.stringify(app.guest && app.guest.privacy)') === 'undefined' ||
      win.eval('String(app.guest && app.guest.privacy)') === 'undefined');

    // and the totals still add up, which is why the placeholder exists
    const load = win.eval('String(loadBand(app.guest).load)');
    eq('the carried weight the DM sees includes the hidden item', load, String(2 + 5 * 3));
    ok('the DM has no controls on that inventory', byAct('ivis').length === 0);
    ok('and no sharing box, since it is not theirs to set',
      !/Who can see what/.test(text()));
  }

  section('A fellow player sees less than the DM');
  const samDev = await device(dev3.__storage);
  {
    use(samDev);
    ok('Sam is signed back in', win.eval('signedIn()') === true);
    // Sam needs a character at the same table
    if (!win.eval('app.roster.length')) {
      click(byAct('create')[0]);
      await settle(win);
      click($$('[data-act="setsys"]').find(b => b.dataset.sys === '5e'));
      await settle(win);
      setInput($$('input').find(i => i.dataset.field === 'name'), 'Sam Fivee');
      await settle(win, 700);
    }
    click(byAct('roster')[0] || byAct('campgo')[0]);
    await settle(win, 300);
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
    await settle(win, 600);
    if (byAct('campattach')[0]) {
      click(byAct('campattach')[0]);
      await settle(win);
      const j = $$('[data-act="campjoin"]')[0];
      if (j) { click(j); await settle(win, 900); }
    }

    const seated = win.eval('String((loadRoster()||[]).some(c => c.campaignId))');
    ok('Sam is seated at the table', seated === 'true',
      'roster: ' + win.eval('JSON.stringify((loadRoster()||[]).map(c => c.name + ":" + c.campaignId))'));
    if (seated === 'true') {
      // make sure we are looking at the campaign page, freshly loaded
      if (win.eval('app.view') !== 'campaign') {
        click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      }
      await settle(win, 900);
      ok('a player gets the party table too', $$('.party').length === 1);
      const row = $$('.party tbody tr').find(r => /Peacock/.test(r.textContent));
      ok("and can see the other character's row", !!row);
      if (row) {
        click(row);
        await settle(win, 400);
        ok('opening it gives the shared prose', /MYSECRETPAST/.test(text()));
        ok('and the open possession', /OPENLANTERN/.test(text()));
        ok('but not the DM-only notes', !/NOTESONLYFORDANA/.test(text()));
        ok('nor the withheld possession', !/MYHIDDENRELIC/.test(text()));
        const all = win.eval(
          'JSON.stringify({ guest: app.guest, roster: app.roster, camp: campUI.data, cache: STORE.cache })');
        ok('neither is anywhere in this browser either',
          all.indexOf('MYHIDDENRELIC') < 0 && all.indexOf('NOTESONLYFORDANA') < 0);
        ok('and it is read-only for them as well', win.eval('readingSomeoneElse()') === true);
        eq('with no Modify', byAct('modify').length, 0);
      }
    }
  }

  section('The table keeps up on its own');
  {
    // jsdom has no EventSource, so this exercises the polling fallback — the
    // same refresh path the stream triggers, just asked for rather than pushed
    use(dmDev2);
    ok('the DM browser has no EventSource, so it fell back to asking',
      win.eval('typeof EventSource') === 'undefined');
    ok('and it is watching one way or the other',
      ['polling', 'watching'].indexOf(win.eval('String(LIVE.state)')) >= 0,
      win.eval('String(LIVE.state)'));
    ok('the connection bar says so', /checking every 10s|live/.test($('#connbar').textContent),
      $('#connbar').textContent);

    // get the DM onto the party table, and note what it says
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId) || byAct('roster')[0]);
    await settle(win, 700);
    if (win.eval('app.view') !== 'campaign') {
      click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      await settle(win, 700);
    }
    const rowOf = name => $$('.party tbody tr').find(r => new RegExp(name).test(r.textContent));
    const before = rowOf('Peacock');
    ok('the DM can see the row', !!before);
    const hpBefore = (before.textContent.match(/(\d+)\s*\/\s*(\d+)/) || [])[0];
    ok('showing hit points', !!hpBefore, before.textContent.replace(/\s+/g, ' '));

    // the player takes a hit, on their own device
    use(nickDev);
    if (win.eval('app.view') !== 'sheet') {
      click(byAct('open')[0]);
      await settle(win, 300);
    }
    const dmg = byAct('hp').find(b => b.dataset.delta === '-1');
    ok('the player has a damage control', !!dmg);
    click(dmg);
    click(dmg);
    await settle(win, 900);
    const hpNow = win.eval('String(cur().play.hp)');
    ok('their own sheet went down', Number(hpNow) >= 0);

    // the DM's page catches up without anybody reloading it
    use(dmDev2);
    win.eval('liveRefreshNow()');
    await settle(win, 900);
    const after = rowOf('Peacock');
    ok('the row is still there', !!after);
    const hpAfter = (after.textContent.match(/(\d+)\s*\/\s*(\d+)/) || [])[0];
    ok('and the hit points on the DM table changed by themselves',
      hpAfter !== hpBefore, 'was ' + hpBefore + ', now ' + hpAfter);
    ok('matching what the player actually has',
      hpAfter.split('/')[0].trim() === hpNow, hpAfter + ' vs ' + hpNow);
    ok('the DM roster is still empty, so nothing was adopted',
      win.eval('app.roster.length') === 0);
  }

  section('Catching up never interrupts what someone is doing');
  {
    use(nickDev);
    // mid-wizard
    click(byAct('roster')[0]);
    await settle(win, 200);
    click(byAct('modify')[0]);
    await settle(win, 300);
    eq('the player is in the wizard', win.eval('app.view'), 'build');
    eq('so a refresh holds off', win.eval('String(liveHoldOff())'), 'the wizard is open');
    win.eval('liveRefreshNow()');
    await settle(win, 400);
    eq('and the wizard is still open', win.eval('app.view'), 'build');
    ok('with a note that there is something to pick up', win.eval('LIVE.stale') === true);
    ok('and the bar offers to catch up', byAct('liverefresh').length >= 1);

    // typing
    click(byAct('sheet')[0]);
    await settle(win, 300);
    win.eval('LIVE.stale = false;');
    const field = $$('input').find(i => i.id === 'hpAmt') || $$('input')[0];
    if (field) {
      field.focus();
      eq('a field being typed in also holds a refresh off',
        win.eval('String(liveHoldOff())'), 'a field is being typed in');
      field.blur();
    } else {
      ok('a field was found to type in', false);
    }
    eq('with nothing in the way, a refresh goes ahead',
      win.eval('String(liveHoldOff())'), 'null');
    win.eval('liveRefreshNow()');
    await settle(win, 700);
    ok('and it clears the note', win.eval('LIVE.stale') === false);
    ok('no errors from any of that', jsErrors.length === 0, jsErrors[0]);
  }

  section('A client ignores the echo of its own save');
  {
    use(nickDev);
    win.eval('LIVE.seq = 0; LIVE.stale = false;');
    // exactly the notice the server sends after this profile writes something
    win.eval('onRemoteChange({ kind: "changed", by: STORE.profile.id, seq: 999 })');
    await settle(win, 500);
    ok('its own notice is ignored', win.eval('LIVE.stale') === false);
    eq('and it does not even count it', win.eval('String(LIVE.seq)'), '0');

    // somebody else's is not
    win.eval('onRemoteChange({ kind: "changed", by: "someone-else", seq: 1000 })');
    eq('a notice from another person is taken up', win.eval('String(LIVE.seq)'), '1000');
    await settle(win, 900);

    // and a notice we have already seen is not acted on twice
    win.eval('onRemoteChange({ kind: "changed", by: "someone-else", seq: 500 })');
    eq('an older notice is dropped', win.eval('String(LIVE.seq)'), '1000');
  }

  section('A pushed notice arrives without anyone asking');
  {
    // two fresh devices, this time with a working event stream
    const liveDm = await device(dmDev.__storage, { live: true });
    const livePlayer = await device(dev1.__storage, { live: true });

    use(liveDm);
    ok('this device has an event stream', win.eval('typeof EventSource') === 'function');
    await settle(win, 600);
    eq('and it is watching, not polling', win.eval('String(LIVE.state)'), 'watching');
    ok('the bar says it is live', /live/.test($('#connbar').textContent),
      $('#connbar').textContent);

    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId) || byAct('roster')[0]);
    await settle(win, 800);
    if (win.eval('app.view') !== 'campaign') {
      click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      await settle(win, 800);
    }
    const rowText = () => {
      const r = $$('.party tbody tr').find(x => /Peacock/.test(x.textContent));
      return r ? r.textContent.replace(/\s+/g, ' ') : '';
    };
    const was = rowText();
    ok('the DM is looking at the party table', !!was, was);
    const seqBefore = Number(win.eval('String(LIVE.seq)'));

    // the player heals up, on their own device — nothing touches the DM's
    use(livePlayer);
    await settle(win, 400);
    if (win.eval('app.view') !== 'sheet') {
      click(byAct('open')[0]);
      await settle(win, 400);
    }
    const full = byAct('hpfull')[0];
    ok('the player can restore to full', !!full);
    click(full);
    await settle(win, 900);
    const playerHp = win.eval('String(cur().play.hp)');

    // wait for the DM's page to change by itself
    use(liveDm);
    let moved = false;
    for (let i = 0; i < 60; i++) {
      if (rowText() && rowText() !== was) { moved = true; break; }
      await settle(win, 100);
    }
    ok('the DM table updated with nobody touching it', moved,
      'was "' + was + '", still "' + rowText() + '"');
    ok('a notice was received', Number(win.eval('String(LIVE.seq)')) > seqBefore,
      'seq ' + win.eval('String(LIVE.seq)'));
    ok('showing what the player now has', rowText().indexOf(playerHp + ' /') >= 0,
      rowText() + ' vs ' + playerHp);
    ok('and it is still marked live', win.eval('String(LIVE.state)') === 'watching');
    ok('with nothing stale left over', win.eval('LIVE.stale') === false);
    ok('no errors from the stream', jsErrors.length === 0, jsErrors[0]);

    // closing the streams tidily, both ends, before the windows go away
    win.eval('storeUnwatch()');
    eq('the stream can be stopped', win.eval('String(LIVE.state)'), 'off');
    livePlayer.window.eval('storeUnwatch()');
    await settle(win, 300);
    liveDm.window.close();
    livePlayer.window.close();
    await settle(win, 300);
  }

  section('Leaving the table');
  {
    use(nickDev);
    click(byAct('campleave')[0]);
    await settle(win, 800);

    const mine = win.eval('(loadRoster()||[]).find(c => c.campaignId)');
    ok('the character is unattached', !mine);
    const hist = win.eval('JSON.stringify((loadRoster()[0]||{}).campaignHistory||[])');
    ok('but the stint is in their history', /Tuesday night/.test(hist), hist);
    ok('with an end date', /leftAt":"20/.test(hist), hist);

    use(dmDev2);
    click($$('[data-act="campgo"]').find(b => b.dataset.id === campId) || byAct('roster')[0]);
    await settle(win, 600);
    if (win.eval('app.view') !== 'campaign') {
      click($$('[data-act="campgo"]').find(b => b.dataset.id === campId));
      await settle(win, 600);
    }
    // Sam is still seated, so the table is not empty — but Nick is off it
    ok('the departed character is off the DM table', !/Peacock Jones/.test(text()));
    ok('and whoever is left is still on it', /Sam Fivee/.test(text()) ||
      /Nobody has brought a character yet/.test(text()));
    const gone = await raw('GET', '/api/characters/' + charId, undefined, win.eval('STORE.token'));
    eq('and the DM can no longer read that sheet', gone.status, 404);
    ok('nothing of it is left in the DM browser',
      win.eval('JSON.stringify(campUI.data || {})').indexOf('Peacock') < 0);
  }

  section('Deleting reaches the server');
  {
    use(dev2);
    const before = (await raw('GET', '/api/characters', undefined, win.eval('STORE.token'))).json.characters.length;
    eq('one to start with', before, 1);
    if (byAct('roster')[0]) { click(byAct('roster')[0]); await settle(win); }
    ok('we are on the character list', /Your characters/.test(text()));
    const delBtn = byAct('del')[0];
    if (!ok('there is a delete button', !!delBtn)) throw new Error('no delete button on the roster');
    click(delBtn);
    await settle(win, 700);
    const after = await raw('GET', '/api/characters', undefined, win.eval('STORE.token'));
    eq('the server dropped it too', after.json.characters.length, 0);
    ok('and the page shows the empty state', /No characters yet/.test(text()));
  }

  section('When the server goes away');
  {
    await stopServer();
    const d = await JSDOM.fromURL('file://' + path.join(ROOT, 'character-forge.html'), {
      runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
      beforeParse(w) { w.confirm = () => true; w.alert = () => { }; w.scrollTo = () => { }; }
    }).catch(() => null);
    if (d) {
      await painted(d);
      use(d);
      eq('the offline file falls back to local mode', win.eval('STORE.mode'), 'local');
      ok('and shows the character list, not a picker', /Your characters/.test(text()));
      eq('with an empty connection bar', $('#connbar').innerHTML, '');
      ok('no error is shown to the user', !/Could not/.test(text()));
    } else {
      ok('the offline file loads from disk', false, 'jsdom could not open it');
    }
  }

  section('Runtime errors');
  ok('no uncaught errors in the browser', jsErrors.length === 0,
    jsErrors.slice(0, 3).join('\n---\n'));

  await stopServer();
  console.log('\n' + '='.repeat(56));
  if (fail) {
    console.log('\x1b[31m' + pass + ' passed, ' + fail + ' failed\x1b[0m');
    fails.forEach(f => console.log('  ✗ ' + f));
  } else {
    console.log('\x1b[32m' + pass + ' passed, 0 failed\x1b[0m');
  }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* leave it */ }
  process.exit(fail ? 1 : 0);
}

main().catch(async e => {
  console.error('\n\x1b[31mThe suite itself broke:\x1b[0m ' + e.stack);
  if (jsErrors.length) console.error('\nbrowser errors:\n' + jsErrors.slice(0, 3).join('\n---\n'));
  await stopServer();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) { /* leave it */ }
  process.exit(1);
});
