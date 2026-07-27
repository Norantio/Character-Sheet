/* ============================================================
   Persistence: local mode (localStorage) or connected mode (LAN server)

   The app is synchronous throughout: it calls loadRoster() and gets an
   array back. So connected mode keeps an in-memory cache that is filled
   once at boot and written through to the server in the background. Every
   existing caller keeps working unchanged.
   ============================================================ */

const STORE = {
  mode: 'local',          // 'local' | 'server'
  cache: null,            // the roster, once loaded
  server: null,           // { name, version, address }
  token: null,
  profile: null,          // { id, name } once signed in
  profiles: [],           // known profiles, in connected mode
  campaigns: [],          // campaigns you are in
  campaignOthers: [],     // other tables on this server, joinable
  pending: 0,             // saves in flight
  lastError: null
};
const TOKEN_KEY = 'characterForge.token.v1';

/* ---------------- local mode ---------------- */
function storeLocalLoad() {
  if (!storageOK) return memoryStore.roster;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) { console.warn('roster load failed', e); return []; }
}
function storeLocalSave(list) {
  memoryStore.roster = list;
  if (!storageOK) return false;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; }
  catch (e) { console.warn('roster save failed', e); return false; }
}

/* ---------------- what loadRoster / saveRoster call ---------------- */
function storeLoad() {
  if (STORE.mode === 'server') return STORE.cache || [];
  return storeLocalLoad();
}
function storeSave(list) {
  if (STORE.mode === 'server') {
    STORE.cache = list;
    queueFlush(list);
    return true;
  }
  return storeLocalSave(list);
}

/* ---------------- talking to the server ---------------- */
function apiAvailable() {
  return typeof fetch === 'function' && typeof location === 'object' &&
    /^https?:$/.test((location && location.protocol) || '');
}
async function api(path, opts) {
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (STORE.token) headers['X-Forge-Token'] = STORE.token;
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
  if (!res.ok) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* Called once at boot, before the first render. Never throws: if anything
   about the server is unhappy we fall back to local mode and say so. */
async function storeInit() {
  STORE.mode = 'local';
  if (!apiAvailable()) return STORE;
  let ping;
  try {
    ping = await api('/ping');
  } catch (e) {
    return STORE;                       // opened as a file, or nothing listening
  }
  if (!ping || !ping.ok) return STORE;

  STORE.mode = 'server';
  STORE.server = { name: ping.name, version: ping.version, address: location.host };
  try { STORE.token = storageOK ? localStorage.getItem(TOKEN_KEY) : null; } catch (e) { STORE.token = null; }

  try {
    STORE.profiles = (await api('/profiles')).profiles || [];
  } catch (e) { STORE.profiles = []; }

  if (STORE.token) {
    try {
      const me = await api('/me');
      STORE.profile = me.profile;
      await storeFetchAll();
      await storeFetchCampaigns();
    } catch (e) {
      // token no longer good: forget it and show the picker
      forgetToken();
      STORE.profile = null;
      STORE.cache = [];
    }
  } else {
    STORE.cache = [];
  }
  return STORE;
}

async function storeFetchAll() {
  const res = await api('/characters');
  STORE.cache = (res.characters || []).map(migrateCharacter);
  return STORE.cache;
}

/* ---------------- sign in and out ---------------- */
function rememberToken(token) {
  STORE.token = token;
  if (!storageOK) return;
  try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* private browsing */ }
}
function forgetToken() {
  STORE.token = null;
  if (!storageOK) return;
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* nothing to do */ }
}

async function storeSignIn(profileId, pin, remember) {
  const res = await api('/profiles/' + encodeURIComponent(profileId) + '/claim', {
    method: 'POST', body: { pin: pin || null }
  });
  STORE.profile = res.profile;
  if (remember === false) STORE.token = res.token; else rememberToken(res.token);
  await storeFetchAll();
  await storeFetchCampaigns();
  return res.profile;
}
async function storeCreateProfile(name, pin) {
  const res = await api('/profiles', { method: 'POST', body: { name: name, pin: pin || null } });
  STORE.profiles = res.profiles || STORE.profiles;
  return res.profile;
}
async function storeSetPin(currentPin, newPin) {
  if (!STORE.profile) throw new Error('Not signed in.');
  return api('/profiles/' + encodeURIComponent(STORE.profile.id) + '/pin', {
    method: 'POST', body: { current: currentPin || null, pin: newPin || null }
  });
}
async function storeSignOut() {
  try { await api('/signout', { method: 'POST' }); } catch (e) { /* going anyway */ }
  forgetToken();
  STORE.profile = null;
  STORE.cache = [];
  STORE.campaigns = [];
  STORE.campaignOthers = [];
}

/* ---------------- write-through ---------------- */
/* Characters are saved individually so two people editing different sheets
   never overwrite each other. Writes are debounced and de-duplicated. */
const flushState = { timer: null, dirty: new Set(), sent: {} };

function queueFlush(list) {
  (list || []).forEach(c => {
    const json = JSON.stringify(c);
    if (flushState.sent[c.id] !== json) flushState.dirty.add(c.id);
  });
  if (flushState.timer) clearTimeout(flushState.timer);
  flushState.timer = setTimeout(flushSaves, 400);
}

async function flushSaves() {
  flushState.timer = null;
  const ids = [...flushState.dirty];
  flushState.dirty.clear();
  for (const id of ids) {
    const c = (STORE.cache || []).find(x => x.id === id);
    if (!c) continue;                      // deleted before we got to it
    STORE.pending++;
    try {
      const res = await api('/characters/' + encodeURIComponent(id), { method: 'PUT', body: c });
      if (res && res.character) {
        c.rev = res.character.rev;
        c.updatedAt = res.character.updatedAt;
        // membership belongs to the server; take its word for it
        c.campaignId = res.character.campaignId;
        c.campaignHistory = res.character.campaignHistory || [];
      }
      flushState.sent[id] = JSON.stringify(c);
      STORE.lastError = null;
    } catch (e) {
      if (e.status === 409) {
        STORE.lastError = 'Someone else changed "' + (c.name || 'a character') +
          '" while you had it open. Reload to see their version.';
      } else {
        STORE.lastError = 'Could not save to the server: ' + e.message;
        flushState.dirty.add(id);          // try again on the next flush
      }
    } finally {
      STORE.pending--;
    }
  }
  if (typeof refreshConnBar === 'function') refreshConnBar();
}

/* Deleting has to reach the server too. */
async function storeDelete(id) {
  if (STORE.mode !== 'server') return;
  flushState.dirty.delete(id);
  delete flushState.sent[id];
  try { await api('/characters/' + encodeURIComponent(id), { method: 'DELETE' }); }
  catch (e) { STORE.lastError = 'Could not delete on the server: ' + e.message; }
}

/* ============================================================
   Campaigns

   Connected: the server owns them, and membership is only ever changed
   through it. Local: a list in localStorage, where you are both the DM and
   the only player — useful for keeping one character's table history
   straight even without a server.
   ============================================================ */
const CAMP_KEY = 'characterForge.campaigns.v1';
const LOCAL_PROFILE = { id: 'local', name: 'You', hasPin: false };

function campLocalLoad() {
  if (!storageOK) return memoryStore.campaigns || (memoryStore.campaigns = []);
  try {
    const raw = localStorage.getItem(CAMP_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { console.warn('campaign load failed', e); return []; }
}
function campLocalSave(list) {
  memoryStore.campaigns = list;
  if (!storageOK) return false;
  try { localStorage.setItem(CAMP_KEY, JSON.stringify(list)); return true; }
  catch (e) { console.warn('campaign save failed', e); return false; }
}

/* Who you are, in either mode. Local mode has one implicit person. */
function whoAmI() { return STORE.mode === 'server' ? STORE.profile : LOCAL_PROFILE; }
function myId() { const p = whoAmI(); return p ? p.id : 'local'; }

/* The same shape the server sends, so the UI cannot tell the modes apart. */
function campLocalPublic(camp) {
  const mine = (camp.members || []).filter(m => !m.leftAt).map(m => m.characterId);
  return {
    id: camp.id, name: camp.name, systemId: camp.systemId, blurb: camp.blurb || '',
    dmProfileId: camp.dmProfileId, dmName: 'You',
    createdAt: camp.createdAt, updatedAt: camp.updatedAt,
    memberCount: mine.length,
    yourRole: 'dm',
    yourCharacterIds: mine
  };
}

function campaignList() {
  if (STORE.mode === 'server') return STORE.campaigns || [];
  return campLocalLoad().map(campLocalPublic);
}
function campaignOthers() {
  return STORE.mode === 'server' ? (STORE.campaignOthers || []) : [];
}
function campaignById(id) {
  return campaignList().find(c => c.id === id) ||
    campaignOthers().find(c => c.id === id) || null;
}
function campaignName(id) {
  const c = campaignById(id);
  return c ? c.name : null;
}

async function storeFetchCampaigns() {
  if (STORE.mode !== 'server') return campaignList();
  try {
    const res = await api('/campaigns');
    STORE.campaigns = res.campaigns || [];
    STORE.campaignOthers = res.others || [];
  } catch (e) {
    STORE.campaigns = []; STORE.campaignOthers = [];
    STORE.lastError = 'Could not load the campaign list: ' + e.message;
  }
  return STORE.campaigns;
}

/* The campaign page: the campaign, the party, and — for the DM — whole sheets. */
async function storeCampaign(id) {
  if (STORE.mode === 'server') {
    const res = await api('/campaigns/' + encodeURIComponent(id));
    return res;
  }
  const camp = campLocalLoad().find(c => c.id === id);
  if (!camp) throw new Error('No such campaign.');
  const ids = (camp.members || []).filter(m => !m.leftAt).map(m => m.characterId);
  const chars = (loadRoster() || []).filter(c => ids.includes(c.id));
  return {
    campaign: campLocalPublic(camp),
    characters: chars,
    party: chars.map(c => ({
      characterId: c.id, name: c.name || '', playerName: 'You',
      ownerProfileId: 'local', systemId: c.systemId, level: c.level,
      lineageId: c.lineageId || null, classId: c.classId || null,
      subclassId: c.subclassId || null
    })),
    players: [LOCAL_PROFILE]
  };
}

async function storeCreateCampaign(name, systemId, blurb) {
  if (STORE.mode === 'server') {
    const res = await api('/campaigns', {
      method: 'POST', body: { name: name, systemId: systemId, blurb: blurb || '' }
    });
    await storeFetchCampaigns();
    return res.campaign;
  }
  const list = campLocalLoad();
  const camp = {
    id: uid(), name: name, systemId: systemId, blurb: blurb || '',
    dmProfileId: 'local', members: [], sessions: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  list.push(camp);
  campLocalSave(list);
  return campLocalPublic(camp);
}

async function storeEditCampaign(id, fields) {
  if (STORE.mode === 'server') {
    const res = await api('/campaigns/' + encodeURIComponent(id), { method: 'PUT', body: fields });
    await storeFetchCampaigns();
    return res.campaign;
  }
  const list = campLocalLoad();
  const camp = list.find(c => c.id === id);
  if (!camp) throw new Error('No such campaign.');
  if (fields.name !== undefined) camp.name = String(fields.name).trim() || camp.name;
  if (fields.blurb !== undefined) camp.blurb = String(fields.blurb);
  camp.updatedAt = new Date().toISOString();
  campLocalSave(list);
  return campLocalPublic(camp);
}

async function storeDeleteCampaign(id) {
  if (STORE.mode === 'server') {
    await api('/campaigns/' + encodeURIComponent(id), { method: 'DELETE' });
    await storeFetchCampaigns();
    await storeFetchAll();
    return;
  }
  const list = campLocalLoad();
  const camp = list.find(c => c.id === id);
  if (camp) {
    const roster = loadRoster();
    (camp.members || []).filter(m => !m.leftAt).forEach(m => {
      m.leftAt = new Date().toISOString();
      const c = roster.find(x => x.id === m.characterId);
      if (c) { c.campaignId = null; localNoteLeave(c, id); }
    });
    saveRoster(roster);
  }
  campLocalSave(list.filter(c => c.id !== id));
}

/* Joining and leaving. Returns nothing useful; callers re-read the lists. */
async function storeSetMembership(campaignId, characterId, action) {
  if (STORE.mode === 'server') {
    await api('/campaigns/' + encodeURIComponent(campaignId) + '/members', {
      method: 'POST', body: { characterId: characterId, action: action }
    });
    await storeFetchCampaigns();
    await storeFetchAll();
    return;
  }
  const list = campLocalLoad();
  const camp = list.find(c => c.id === campaignId);
  if (!camp) throw new Error('No such campaign.');
  const roster = loadRoster();
  const c = roster.find(x => x.id === characterId);
  if (!c) throw new Error('No such character.');
  if (!Array.isArray(camp.members)) camp.members = [];
  const active = camp.members.filter(m => !m.leftAt && m.characterId === characterId)[0];

  if (action === 'join') {
    if (c.systemId !== camp.systemId) {
      throw new Error('That campaign is playing a different game, so the numbers would not line up.');
    }
    if (c.campaignId && c.campaignId !== campaignId) {
      throw new Error('That character is already in another campaign. Take them out of it first.');
    }
    if (!active) {
      camp.members.push({
        characterId: characterId, profileId: 'local',
        joinedAt: new Date().toISOString(), leftAt: null
      });
      c.campaignId = campaignId;
      localNoteJoin(c, camp);
    }
  } else if (active) {
    active.leftAt = new Date().toISOString();
    if (c.campaignId === campaignId) c.campaignId = null;
    localNoteLeave(c, campaignId);
  }
  camp.updatedAt = new Date().toISOString();
  campLocalSave(list);
  saveRoster(roster);
}

/* The same history the server keeps, kept locally — including the journal
   entries that write themselves, so a character reads the same either way. */
function localNoteJoin(c, camp) {
  if (!Array.isArray(c.campaignHistory)) c.campaignHistory = [];
  c.campaignHistory.push({
    campaignId: camp.id, name: camp.name,
    joinedAt: new Date().toISOString(), leftAt: null
  });
  if (typeof autoJournal === 'function') {
    autoJournal(c, 'join', 'Joined ' + camp.name,
      'Came to the table at level ' + (c.level || 1) + '.');
  }
}
function localNoteLeave(c, campaignId) {
  if (!Array.isArray(c.campaignHistory)) c.campaignHistory = [];
  const open = c.campaignHistory.filter(e => e.campaignId === campaignId && !e.leftAt).pop();
  if (open) open.leftAt = new Date().toISOString();
  const camp = campaignById(campaignId);
  if (typeof autoJournal === 'function') {
    autoJournal(c, 'leave', 'Left ' + ((open && open.name) || (camp && camp.name) || 'the campaign'),
      'Left at level ' + (c.level || 1) + '.');
  }
}

/* ---------------- shape migration ---------------- */
/* Characters gain campaign and privacy fields. Applied on load in both modes,
   the same way play and inv are today. */
function migrateCharacter(c) {
  if (!c || typeof c !== 'object') return c;
  if (!c.boosts) c.boosts = { ancestryFree: [], free: [], levels: {} };
  if (!c.levelAsi) c.levelAsi = {};
  if (!c.profs) c.profs = {};
  if (!c.ranks) c.ranks = {};
  if (!c.spells) c.spells = [];
  if (!c.prepared) c.prepared = [];
  if (c.campaignId === undefined) c.campaignId = null;
  if (!Array.isArray(c.campaignHistory)) c.campaignHistory = [];
  if (!c.privacy || typeof c.privacy !== 'object') c.privacy = {};
  if (!Array.isArray(c.journal)) c.journal = [];
  if (typeof c.rev !== 'number') c.rev = 0;
  return c;
}

/* ---------------- for the UI ---------------- */
function isConnected() { return STORE.mode === 'server'; }
function signedIn() { return !!(STORE.mode === 'server' && STORE.profile); }
function storeModeLabel() {
  if (STORE.mode !== 'server') return 'Local';
  return 'Connected to ' + (STORE.server && STORE.server.address ? STORE.server.address : 'the server');
}
