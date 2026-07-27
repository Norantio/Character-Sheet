/* ============================================================
   Who are you? — the profile picker, and the connection bar.

   Both are only ever drawn in connected mode. In local mode the connection
   bar renders as nothing at all, so a standalone file behaves exactly as it
   did before any of this existed.
   ============================================================ */

const signinUI = {
  profileId: null,      // the card being unlocked
  pin: '',
  remember: true,
  adding: false,
  newName: '',
  newPin: '',
  newPin2: '',
  busy: false,
  error: ''
};

function resetSignin() {
  signinUI.profileId = null;
  signinUI.pin = '';
  signinUI.adding = false;
  signinUI.newName = '';
  signinUI.newPin = '';
  signinUI.newPin2 = '';
  signinUI.busy = false;
  signinUI.error = '';
}

/* Initials for the round avatar on each card. */
function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0].toUpperCase()).join('') || '?';
}

/* ---------------- the connection bar ---------------- */
function connBar() {
  if (!isConnected()) return '';
  const who = STORE.profile;
  const bits = [];
  bits.push(`<span class="conn-dot" aria-hidden="true"></span>
    <span class="conn-where">Connected to ${h(STORE.server && STORE.server.address || 'the server')}</span>`);
  if (who) {
    bits.push(`<span class="conn-sep">·</span>
      <span class="conn-who">Signed in as <b>${h(who.name)}</b></span>`);
  }
  let state = '';
  if (STORE.pending > 0) state = '<span class="conn-state">Saving…</span>';
  else if (STORE.lastError) state = `<span class="conn-state bad">${h(STORE.lastError)}</span>`;
  else if (who) state = '<span class="conn-state ok">Saved</span>';

  const live = typeof liveLabel === 'function' ? liveLabel() : '';
  const liveBit = live
    ? `<span class="conn-live${LIVE.stale ? ' stale' : ''}${LIVE.state === 'watching' ? ' on' : ''}"
        >${h(live)}</span>` : '';
  const acts = who
    ? `${LIVE.stale ? '<button class="btn sm primary" data-act="liverefresh">Catch up</button>' : ''}
       <button class="btn sm ghost" data-act="signout">Sign out</button>`
    : '';
  return `<div class="connbar-in">${bits.join(' ')}<div class="spacer"></div>${liveBit}${state}${acts}</div>`;
}

/* Repainted on its own after a background save, so the rest of the page
   is not rebuilt underneath the user's fingers. */
function refreshConnBar() {
  // A stream callback can arrive while the page is being torn down, so check
  // there is still a document to draw into.
  if (typeof document !== 'object' || !document || !document.getElementById) return;
  const el = document.getElementById('connbar');
  if (el) el.innerHTML = connBar();
}

/* ---------------- the picker ---------------- */
function viewSignIn() {
  const chosen = signinUI.profileId
    ? STORE.profiles.find(p => p.id === signinUI.profileId) : null;

  if (signinUI.adding) return signInAdd();
  if (chosen && chosen.hasPin) return signInPin(chosen);

  const cards = STORE.profiles.map(p => `
    <button class="who-card" data-act="whopick" data-id="${h(p.id)}">
      <span class="who-face">${h(initials(p.name))}</span>
      <span class="who-name">${h(p.name)}</span>
      <span class="who-lock">${p.hasPin ? 'PIN' : 'no PIN'}</span>
    </button>`).join('');

  return `<div class="whowrap">
    <div class="hero">
      <h1>Who are you?</h1>
      <p>This device is connected to <b>${h(STORE.server && STORE.server.address || 'the server')}</b>.
      Pick your name to see your characters.</p>
    </div>
    ${signinUI.error ? `<div class="who-error">${h(signinUI.error)}</div>` : ''}
    <div class="who-cards">
      ${cards || '<div class="empty">Nobody has been added yet. You are first.</div>'}
      <button class="who-card add" data-act="whoadd">
        <span class="who-face">+</span>
        <span class="who-name">Add me</span>
        <span class="who-lock">new profile</span>
      </button>
    </div>
    <label class="chk who-remember">
      <input type="checkbox" data-signf="remember" ${signinUI.remember ? 'checked' : ''}>
      <span>Remember me on this device</span>
    </label>
    <p class="note">Characters you make here are saved on the group's server, so they are
    the same on every device and the DM can see the party. Forgotten your PIN? Whoever
    runs the server can clear it.</p>
  </div>`;
}

function signInPin(p) {
  const dots = '●'.repeat(signinUI.pin.length) + '<span class="pin-empty">' +
    '○'.repeat(Math.max(0, 4 - signinUI.pin.length)) + '</span>';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  const label = { clear: 'Clear', back: '←' };
  return `<div class="whowrap">
    <div class="hero">
      <h1>${h(p.name)}</h1>
      <p>Enter your PIN.</p>
    </div>
    ${signinUI.error ? `<div class="who-error">${h(signinUI.error)}</div>` : ''}
    <div class="pin-shown">${dots}</div>
    <div class="pinpad">
      ${keys.map(k => `<button class="pin-key${k === 'clear' || k === 'back' ? ' alt' : ''}"
        data-act="pinkey" data-key="${k}">${label[k] || k}</button>`).join('')}
    </div>
    <div class="who-acts">
      <button class="btn primary big" data-act="pingo" ${signinUI.busy ? 'disabled' : ''}>
        ${signinUI.busy ? 'Checking…' : 'Sign in'}</button>
      <button class="btn ghost big" data-act="whoback">Someone else</button>
    </div>
    <label class="chk who-remember">
      <input type="checkbox" data-signf="remember" ${signinUI.remember ? 'checked' : ''}>
      <span>Remember me on this device</span>
    </label>
  </div>`;
}

function signInAdd() {
  return `<div class="whowrap">
    <div class="hero">
      <h1>Add yourself</h1>
      <p>Your name is how the rest of the table will see you. A PIN is optional —
      set one if other people use this device.</p>
    </div>
    ${signinUI.error ? `<div class="who-error">${h(signinUI.error)}</div>` : ''}
    <div class="who-form">
      <div class="field"><label>Your name</label>
        <input data-signf="newName" value="${h(signinUI.newName)}" placeholder="Nick" autocomplete="off"></div>
      <div class="field"><label>PIN (optional, 4 or more digits)</label>
        <input data-signf="newPin" value="${h(signinUI.newPin)}" inputmode="numeric" autocomplete="off"></div>
      <div class="field"><label>PIN again</label>
        <input data-signf="newPin2" value="${h(signinUI.newPin2)}" inputmode="numeric" autocomplete="off"></div>
    </div>
    <div class="who-acts">
      <button class="btn primary big" data-act="whocreate" ${signinUI.busy ? 'disabled' : ''}>
        ${signinUI.busy ? 'Creating…' : 'That is me'}</button>
      <button class="btn ghost big" data-act="whoback">Back to the list</button>
    </div>
  </div>`;
}

/* ---------------- after signing in ---------------- */
/* The roster comes from the server rather than localStorage, so it needs the
   same tidying the boot handler does. */
function adoptServerRoster() {
  app.roster = loadRoster();
  app.roster.forEach(migrateCharacter);
  app.currentId = null;
  app.view = 'home';
  resetSignin();
  resetAllPanels();
  if (typeof storeWatch === 'function') storeWatch();
}

/* ---------------- events ---------------- */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!/^(who|pin(key|go)|signout)/.test(act)) return;

  switch (act) {
    case 'whopick': {
      const p = STORE.profiles.find(x => x.id === el.dataset.id);
      if (!p) return;
      signinUI.profileId = p.id;
      signinUI.pin = '';
      signinUI.error = '';
      if (p.hasPin) { render(); return; }
      doSignIn(p.id, null);
      return;
    }
    case 'whoadd':
      signinUI.adding = true; signinUI.error = ''; render(); return;
    case 'whoback':
      resetSignin(); render(); return;
    case 'pinkey': {
      const k = el.dataset.key;
      if (k === 'clear') signinUI.pin = '';
      else if (k === 'back') signinUI.pin = signinUI.pin.slice(0, -1);
      else if (signinUI.pin.length < 12) signinUI.pin += k;
      signinUI.error = '';
      render(); return;
    }
    case 'pingo':
      doSignIn(signinUI.profileId, signinUI.pin);
      return;
    case 'whocreate':
      doCreateProfile();
      return;
    case 'signout':
      doSignOut();
      return;
  }
});

document.addEventListener('input', function (ev) {
  const t = ev.target;
  if (!t.dataset || !t.dataset.signf) return;
  const f = t.dataset.signf;
  if (f === 'remember') signinUI.remember = t.checked;
  else signinUI[f] = t.value;
  // no re-render: that would fight with typing
});
document.addEventListener('change', function (ev) {
  const t = ev.target;
  if (t.dataset && t.dataset.signf === 'remember') signinUI.remember = t.checked;
});

document.addEventListener('keydown', function (ev) {
  if (app.view !== 'signin') return;
  if (ev.key === 'Enter') {
    if (signinUI.adding) doCreateProfile();
    else if (signinUI.profileId) doSignIn(signinUI.profileId, signinUI.pin);
  }
});

async function doSignIn(profileId, pin) {
  if (signinUI.busy) return;
  signinUI.busy = true; signinUI.error = ''; render();
  try {
    await storeSignIn(profileId, pin, signinUI.remember);
    adoptServerRoster();
    render();
  } catch (e) {
    signinUI.busy = false;
    signinUI.pin = '';
    signinUI.error = e.status === 403
      ? 'That PIN does not match. Try again.'
      : 'Could not sign in: ' + e.message;
    render();
  }
}

async function doCreateProfile() {
  if (signinUI.busy) return;
  const name = String(signinUI.newName || '').trim();
  const pin = String(signinUI.newPin || '').trim();
  const pin2 = String(signinUI.newPin2 || '').trim();
  if (!name) { signinUI.error = 'Put your name in first.'; render(); return; }
  if (pin && !/^\d{4,12}$/.test(pin)) {
    signinUI.error = 'A PIN needs to be 4 to 12 digits, or leave it empty.'; render(); return;
  }
  if (pin !== pin2) { signinUI.error = 'The two PINs do not match.'; render(); return; }

  signinUI.busy = true; signinUI.error = ''; render();
  try {
    const p = await storeCreateProfile(name, pin || null);
    await storeSignIn(p.id, pin || null, signinUI.remember);
    adoptServerRoster();
    render();
  } catch (e) {
    signinUI.busy = false;
    signinUI.error = e.status === 409
      ? 'Somebody is already using that name. Pick another, or tap your own card.'
      : 'Could not add you: ' + e.message;
    render();
  }
}

async function doSignOut() {
  if (!confirm('Sign out? Your characters stay on the server.')) return;
  if (typeof storeUnwatch === 'function') storeUnwatch();
  await storeSignOut();
  app.roster = [];
  app.currentId = null;
  resetSignin();
  try { STORE.profiles = (await api('/profiles')).profiles || STORE.profiles; } catch (e) { /* keep the old list */ }
  app.view = 'signin';
  render();
}
