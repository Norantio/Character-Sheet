/* ============================================================
   UI layer
   ============================================================ */

const app = {
  roster: [],
  currentId: null,
  view: 'home',   // home | roster | dm | build | sheet | campaign | signin
  role: null,     // 'player' | 'dm' — set by the home landing
  step: 0,
  // set to 'dm' or 'party' while looking at your own sheet as someone else
  preview: null,
  levelUpLog: [],
  flash: '',
  // Somebody else's character, opened by the DM from the party table. It is
  // not in the roster, so nothing can accidentally save over it.
  guest: null
};

function h(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function cur() {
  const own = app.roster.find(c => c.id === app.currentId);
  if (own) return own;
  return (app.guest && app.guest.id === app.currentId) ? app.guest : null;
}
/* True when the character on screen belongs to somebody else. */
function readingSomeoneElse() {
  return !!(app.guest && app.currentId === app.guest.id &&
    !app.roster.some(c => c.id === app.currentId));
}

/* A brand-new character, ready for the wizard. */
function blankCharacter(systemId) {
  const S = sys(systemId);
  const ch = newCharacter(systemId);
  ch.armor = S.armorList[0].name;
  if (S.abilityGen.pointBuy) ABIL6.forEach(a => ch.baseScores[a] = S.abilityGen.pointBuy.min);
  ch.languages = [];
  return ch;
}
/* Nothing chosen at all — safe to discard if the user backs out of the wizard. */
function isBlank(c) {
  return !c.name && !c.lineageId && !c.classId && !c.backgroundId
    && !(c.spells || []).length && !(c.skills || []).length && !c.notes && !c.gear;
}
/* Remember where the user was in the wizard so Modify returns them there. */
function rememberStep(c) {
  if (!c) return;
  c.wizardStep = app.step;
  saveRoster(app.roster);
}
function pruneBlank() {
  const before = app.roster.length;
  app.roster = app.roster.filter(c => c.id === app.currentId || !isBlank(c));
  if (app.roster.length !== before) saveRoster(app.roster);
}
function setPath(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]]) o[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = val;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}
function persist() {
  // A DM reading a player's sheet must not be able to save it, whatever they
  // click. The server would refuse anyway; this stops it being attempted.
  if (readingSomeoneElse()) {
    app.flash = 'This is somebody else\'s character, so nothing here is saved.';
    return false;
  }
  // While previewing, the sheet on screen is a filtered copy. Nothing is saved
  // from it, or a withheld field could be written back as empty.
  if (app.preview) {
    app.flash = 'You are looking at this sheet as someone else sees it, so nothing is saved.';
    return false;
  }
  const c = cur();
  if (c) c.updated = new Date().toISOString();
  return saveRoster(app.roster);
}

/* ---------------- step definitions ---------------- */
function stepsFor(c) {
  const S = sys(c.systemId);
  const list = [
    { id: 'system', name: 'Game System' },
    { id: 'identity', name: 'Identity' },
    { id: 'lineage', name: S.lineageLabel },
    { id: 'background', name: S.backgroundLabel },
    { id: 'class', name: S.classLabel },
    { id: 'abilities', name: 'Abilities' },
    { id: 'skills', name: c.systemId === 'pf1' ? 'Skill Ranks' : 'Skills' },
    { id: 'spells', name: 'Spells' },
    { id: 'advance', name: 'Advancement' },
    { id: 'gear', name: 'Gear & Defense' },
    { id: 'flavor', name: 'Roleplay' },
    { id: 'review', name: 'Review' }
  ];
  return list;
}
function stepDone(c, id) {
  switch (id) {
    case 'system': return !!c.systemId;
    case 'identity': return !!c.name;
    case 'lineage': return !!c.lineageId;
    case 'background': return !!c.backgroundId;
    case 'class': return !!c.classId;
    case 'abilities': return !validate(c).some(i => i.level === 'error' && /point buy|array|rolled|boost|ability|below the minimum/i.test(i.text));
    case 'skills': return !validate(c).some(i => /skill/i.test(i.text) && i.level === 'error');
    case 'spells': return !casterInfo(c) || (c.spells || []).length > 0;
    case 'gear': return c.armor !== null;
    default: return false;
  }
}

/* ---------------- top-level render ---------------- */
/* Which screen are we on? Used to decide whether a re-render is navigation
   (scroll to the top) or an action on the page you are already reading
   (stay exactly where you are). */
function screenKey() {
  const sub = app.view === 'signin'
    ? '|' + signinUI.profileId + '|' + (signinUI.adding ? 'add' : '')
    : app.view === 'campaign' ? '|' + campUI.id : '';
  return app.view + '|' + app.step + '|' + app.currentId + sub;
}
const renderState = { key: null };

/* Remember the focused field so a re-render does not interrupt typing. */
function captureFocus() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.tagName) return null;
  const sel = el.dataset && el.dataset.field ? '[data-field="' + el.dataset.field + '"]'
    : el.id ? '#' + el.id : null;
  if (!sel) return null;
  let start = null, end = null;
  try {
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|url|tel|password)$/.test(el.type))) {
      start = el.selectionStart; end = el.selectionEnd;
    }
  } catch (e) { /* some input types refuse selection access */ }
  return { sel: sel, start: start, end: end };
}
function restoreFocus(f) {
  if (!f) return;
  const el = document.querySelector(f.sel);
  if (!el || !el.focus) return;
  try {
    el.focus({ preventScroll: true });
    if (f.start !== null && el.setSelectionRange) el.setSelectionRange(f.start, f.end);
  } catch (e) { /* not focusable any more; nothing to do */ }
}

function render() {
  if (typeof document !== 'object' || !document || !document.getElementById) return;
  const root = document.getElementById('app');
  if (!root) return;
  const key = screenKey();
  const sameScreen = key === renderState.key;
  const keepY = sameScreen ? (window.scrollY || window.pageYOffset || 0) : 0;
  const focus = sameScreen ? captureFocus() : null;

  if (app.view === 'signin') root.innerHTML = viewSignIn();
  else if (app.view === 'home') root.innerHTML = viewHome();
  else if (app.view === 'dm') root.innerHTML = viewDmLanding();
  else if (app.view === 'campaign') root.innerHTML = viewCampaign();
  else if (app.view === 'roster') root.innerHTML = viewRoster();
  else if (app.view === 'sheet') root.innerHTML = viewSheet();
  else if (app.view === 'inventory' || app.view === 'journal' || app.view === 'character') {
    const pc = cur();
    root.innerHTML = pc ? viewSheetPanel(pc) : viewRoster();
  } else root.innerHTML = viewBuild();
  document.getElementById('topbar').innerHTML = topbar();
  refreshConnBar();
  renderState.key = key;

  // Casting a spell or ticking a box should not throw you back to the top.
  window.scrollTo(0, keepY);
  restoreFocus(focus);
}

/* The topbar carries navigation only. Actions live on the page itself. */
function topbar() {
  const c = cur();
  let right = '';
  if (app.view === 'signin') {
    return `<div class="brand">Character Forge<small>Multi-system RPG builder</small></div>
      <div class="spacer"></div>`;
  }
  if (app.view === 'home') {
    const who = signedIn() ? STORE.profile : null;
    const out = who ? `<span class="conn-who" style="font-size:.85rem;color:var(--dim)">${h(who.name)}</span>` : '';
    const so = isConnected() && signedIn() ? `<button class="btn ghost" data-act="signout">Sign out</button>` : '';
    return `<div class="brand">Character Forge<small>Multi-system RPG builder</small></div><div class="spacer"></div>${out}${so}`;
  }
  if (app.view === 'campaign') {
    const camp = campUI.data && campUI.data.campaign;
    right = `<span class="sysbadge">${h(camp ? camp.name : 'Campaign')}</span>
      <button class="btn ghost" data-act="home">← Home</button>`;
  } else if (app.view === 'dm') {
    right = `<span class="sysbadge">DM</span><button class="btn ghost" data-act="home">← Home</button>`;
  } else if (app.view === 'roster') {
    right = `<span class="sysbadge">${app.roster.length} character${app.roster.length === 1 ? '' : 's'}</span>
      <button class="btn ghost" data-act="home">← Home</button>`;
  } else if (app.view === 'inventory' || app.view === 'journal' || app.view === 'character') {
    right = `<span class="sysbadge">${(PANEL_PAGES && PANEL_PAGES[app.view]) ? PANEL_PAGES[app.view].title : app.view}</span>
      <button class="btn ghost" data-act="sheet">← Sheet</button>`;
  } else if (c) {
    const S = sys(c.systemId);
    right = `<span class="sysbadge">${h(SYSTEM_SHORT[c.systemId] || S.name)} · Level ${c.level}</span>
      <button class="btn ghost" data-act="roster">← All characters</button>`;
  }
  return `<div class="brand">Character Forge<small>Multi-system RPG builder</small></div>
    <div class="spacer"></div>${right}`;
}

/* Action bar shown at the top of a character's own page. */
function pageBar(c, where) {
  const S = sys(c.systemId);
  const lin = byId(S.lineages, c.lineageId);
  const cls = byId(S.classes, c.classId);
  const sub = [lin ? lin.name : '', cls ? cls.name : ''].filter(Boolean).join(' ');
  const guest = readingSomeoneElse();
  const player = guest && campUI.data
    ? whoPlays(campUI.data.party || [], c.id) : '';
  return `<div class="pagebar noprint">
    ${guest
      ? `<button class="btn" data-act="campgo" data-id="${h(c.campaignId || (campUI.data && campUI.data.campaign.id) || '')}">← The party</button>`
      : `<button class="btn" data-act="roster">← All characters</button>`}
    <div class="pagebar-title">
      <b>${h(c.name || 'Unnamed character')}</b>
      <span>${sub ? h(sub) + ' · ' : ''}Level ${c.level}${guest ? ' · played by ' + h(player) : ''}</span>
    </div>
    <div class="pagebar-acts">
      ${app.preview
      ? `<span class="sysbadge">Seen as ${app.preview === 'dm' ? 'the DM' : 'the table'}</span>
           <button class="btn primary" data-act="ppreview" data-as="">Back to my sheet</button>`
      : guest
        ? `<span class="sysbadge">Reading only</span>
           <button class="btn" data-act="print">Print / PDF</button>`
        : where === 'sheet'
        ? `<button class="btn primary" data-act="modify">Modify character</button>
           <button class="btn" data-act="print">Print / PDF</button>`
          : `<button class="btn primary" data-act="sheet">Done — view character</button>`}
      ${guest || app.preview ? '' : `<button class="btn" data-act="export">Export</button>`}
    </div>
  </div>`;
}

/* ---------------- home landing ---------------- */
function viewHome() {
  const serverName = STORE.server && STORE.server.name;
  const who = STORE.profile;
  const myChars = app.roster.length;
  const myCamps = campaignList();
  const dmCamps = myCamps.filter(c => c.yourRole === 'dm');
  const playerCamps = myCamps.filter(c => c.yourRole === 'player');

  const dmSub = dmCamps.length === 1
    ? h(dmCamps[0].name) + (dmCamps[0].memberCount ? ' &middot; ' + dmCamps[0].memberCount + ' at the table' : '')
    : dmCamps.length > 1 ? dmCamps.length + ' campaigns'
    : isConnected() ? 'No campaign yet' : 'No campaign yet';

  const playerSub = myChars
    ? myChars + ' character' + (myChars === 1 ? '' : 's') + (playerCamps.length ? ' &middot; ' + playerCamps.map(c => h(c.name)).join(', ') : '')
    : 'Create a character to get started';

  return `<div class="home">
    <div class="hero">
      <h1>${h(serverName || 'Character Forge')}</h1>
      <p>${who ? 'Welcome back, <b>' + h(who.name) + '</b>. Who are you tonight?' : 'Welcome to the table.'}</p>
    </div>
    <div class="homewrap">
      <div class="home-roles">
        <button class="home-role-card" data-act="homeplayer">
          <span class="home-role-label">Player</span>
          <span class="home-role-sub">${playerSub}</span>
          <span class="home-role-cta">Open your character</span>
        </button>
        <button class="home-role-card" data-act="homedm">
          <span class="home-role-label">Dungeon Master</span>
          <span class="home-role-sub">${dmSub}</span>
          <span class="home-role-cta">See the party</span>
        </button>
      </div>
    </div>
  </div>`;
}

/* ---------------- DM landing ---------------- */
function viewDmLanding() {
  const who = STORE.profile;
  const myCamps = campaignList();
  const dmCamps = myCamps.filter(c => c.yourRole === 'dm');

  return `<div class="home">
    <div class="hero">
      <h1>DM Dashboard</h1>
      <p>${who ? 'Welcome, <b>' + h(who.name) + '</b>.' : 'Dungeon Master view.'} Set up your campaign, then share the server address with your players.</p>
    </div>
    <div class="homewrap">
      <div style="margin-bottom:8px"><button class="btn ghost" data-act="home">&larr; Back to Home</button></div>
      ${campaignsPanel()}
      ${app.roster.length ? `<details class="panel disclose">
        <summary>My own characters (${app.roster.length})</summary>
        <div class="roster" style="margin-top:10px">${app.roster.map(c => {
          const S = sys(c.systemId);
          const lin = byId(S.lineages, c.lineageId);
          const cls = byId(S.classes, c.classId);
          return `<div class="rcard clickable" data-act="open" data-id="${c.id}" role="button" tabindex="0">
            <div class="rcard-head"><h3>${h(c.name || 'Unnamed')}</h3>
              <span class="tag">${h(SYSTEM_SHORT[c.systemId] || S.name)}</span></div>
            <div class="meta">Level ${c.level} ${h(lin ? lin.name : '—')} ${h(cls ? cls.name : '—')}</div>
            <div class="acts"><button class="btn sm primary" data-act="open" data-id="${c.id}">Open</button></div>
          </div>`;
        }).join('')}</div>
      </details>` : ''}
    </div>
  </div>`;
}

/* ---------------- roster ---------------- */
function viewRoster() {
  const cards = app.roster.map(c => {
    const S = sys(c.systemId);
    const lin = byId(S.lineages, c.lineageId);
    const cls = byId(S.classes, c.classId);
    let d = null;
    try { d = derive(c); } catch (e) { }
    const spellN = (c.spells || []).length;
    const done = !!(c.name && c.lineageId && c.classId);
    return `<div class="rcard clickable" data-act="open" data-id="${c.id}" role="button" tabindex="0"
        title="Open ${h(c.name || 'this character')}">
      <div class="rcard-head">
        <h3>${h(c.name || 'Unnamed character')}</h3>
        <span class="tag">${h(SYSTEM_SHORT[c.systemId] || S.name)}</span>
      </div>
      <div class="meta">Level ${c.level} ${h(lin ? lin.name : '—')} ${h(cls ? cls.name : '—')}${cls && byId(cls.subclasses || [], c.subclassId) ? ' · ' + h(byId(cls.subclasses, c.subclassId).name) : ''}</div>
      ${d ? `<div class="rstats">
        <span><b>${d.hp}</b> HP</span>
        <span><b>${d.ac}</b> AC</span>
        ${spellN ? `<span><b>${spellN}</b> spell${spellN === 1 ? '' : 's'}</span>` : ''}
      </div>` : ''}
      ${done ? '' : '<div class="rwarn">Unfinished — pick up where you left off</div>'}
      <div class="acts">
        <button class="btn sm primary" data-act="open" data-id="${c.id}">Open</button>
        <button class="btn sm" data-act="modify" data-id="${c.id}">Modify</button>
        <button class="btn sm" data-act="dup" data-id="${c.id}">Duplicate</button>
        <button class="btn sm danger" data-act="del" data-id="${c.id}">Delete</button>
      </div></div>`;
  }).join('');

  return `<div class="home">
    <div class="hero">
      <h1>Character Forge</h1>
      <p>Characters for D&amp;D 5th Edition, D&amp;D 4th Edition, Pathfinder 1st Edition, and Pathfinder 2nd Edition — all in one file, no internet, no accounts.</p>
      ${storageOK ? '' : '<p class="note" style="color:#e08b82">Browser storage is unavailable, so characters will only last until you close the tab. Use Export JSON to keep them.</p>'}
    </div>
    <div class="homewrap">
      <div style="margin-bottom:8px"><button class="btn ghost" data-act="home">&larr; Back to Home</button></div>
      <div class="panel">
        <h2>Your characters <span class="hint">${app.roster.length ? app.roster.length + ' saved' : 'none yet'}</span></h2>
        ${app.roster.length
      ? `<div class="roster">${cards}</div>
             <p class="note" style="margin-top:12px">Click a character to open it. Saved in this browser — use Export on any character to keep a backup.</p>`
      : `<div class="empty">
               <p style="font-size:1.05rem;margin-bottom:4px">No characters yet.</p>
               <p>The wizard walks you through it one step at a time: system, race, class, abilities, skills, spells, gear.</p>
             </div>`}
        <div class="homeactions">
          <button class="btn primary big" data-act="create">Create a character</button>
          <button class="btn" data-act="import">Import from a JSON file</button>
        </div>
      </div>
      ${campaignsPanel()}
      <details class="panel disclose">
        <summary>What the wizard covers</summary>
        <div class="cards" style="margin-top:10px">
          ${SYSTEM_ORDER.map(id => {
        const S = SYSTEMS[id];
        return `<div class="card" style="cursor:default">
              <span class="pill">${h(S.tag)}</span>
              <span class="t">${h(S.name)}</span>
              <span class="s">${h(S.blurb)}</span></div>`;
      }).join('')}
        </div>
        <p class="note" style="margin-top:10px">Pick the system on the first step of the wizard. You can switch later, though race and class choices reset because they do not translate between editions.</p>
      </details>
      <details class="panel disclose">
        <summary>Bundled spell catalogues</summary>
        ${kv([
      ['D&D 5th Edition', spellsFor('5e').length + ' spells with full rules text (SRD 5.1)'],
      ['Pathfinder 2nd Edition', spellsFor('pf2').length + ' spells with full rules text (Remaster)'],
      ['Pathfinder 1st Edition', spellsFor('pf1').length + ' Core Rulebook spells — a curated index, not the complete list'],
      ['D&D 4th Edition', 'Powers rather than spells; class powers are listed on the Class step']
    ])}
        <p class="note" style="margin-top:8px">Every caster has a Spells step for picking a spellbook, and an Import tab for loading more.</p>
      </details>
      <details class="panel disclose">
        <summary>Credits and licences</summary>
        <p class="note">
          <b>D&amp;D 5e:</b> System Reference Document 5.1 Copyright 2016, Wizards of the Coast, Inc.; Authors Mike Mearls,
          Jeremy Crawford, Chris Perkins, Rodney Thompson, Peter Lee, James Wyatt, Robert J. Schwalb, Bruce R. Cordell,
          Chris Sims, and Steve Townshend, based on original material by E. Gary Gygax and Dave Arneson.
          Used under the Open Gaming License v1.0a / CC-BY-4.0.
        </p>
        <p class="note">
          <b>Pathfinder:</b> game mechanics used under the Open Game License v1.0a and the ORC License.
          Pathfinder and Pathfinder Second Edition are trademarks of Paizo Inc., used under Paizo's Community Use Policy
          (paizo.com/community/communityuse). This tool is not published, endorsed, or specifically approved by Paizo.
          Pathfinder 2e spell data derives from the Pathfinder Second Edition system for Foundry VTT.
        </p>
        <p class="note">
          <b>D&amp;D 4th Edition:</b> mechanics summarised for reference. Dungeons &amp; Dragons is a trademark of
          Wizards of the Coast. This is an unofficial fan-made tool.
        </p>
      </details>
    </div>
  </div>`;
}

/* ---------------- builder ---------------- */
function viewBuild() {
  const c = cur();
  if (!c) { app.view = 'roster'; return viewRoster(); }
  const steps = stepsFor(c);
  const stepId = steps[clamp(app.step, 0, steps.length - 1)].id;
  const doneCount = steps.filter(s => stepDone(c, s.id)).length;
  const pct = Math.round(doneCount / steps.length * 100);
  const nav = `<div class="progress">
      <div class="lab">Step ${app.step + 1} of ${steps.length}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>` + steps.map((s, i) => `<button class="step ${i === app.step ? 'active' : ''} ${stepDone(c, s.id) ? 'done' : ''}" data-act="nav" data-step="${i}">
      <span class="num"><span>${i + 1}</span></span>${h(s.name)}</button>`).join('');

  const body = {
    system: stepSystem, identity: stepIdentity, lineage: stepLineage,
    background: stepBackground, class: stepClass, abilities: stepAbilities,
    skills: stepSkills, spells: stepSpells, advance: stepAdvance, gear: stepGear,
    flavor: stepFlavor, review: stepReview
  }[stepId](c);

  return pageBar(c, 'build') + `<div class="layout">
    <div><div class="steps">${nav}</div></div>
    <div>
      ${app.flash ? `<div class="callout">${h(app.flash)}</div>` : ''}
      ${body}
      <div class="footbar">
        <button class="btn" data-act="prev" ${app.step === 0 ? 'disabled' : ''}>← ${app.step === 0 ? 'Back' : h(steps[app.step - 1].name)}</button>
        <span class="note">Step ${app.step + 1} of ${steps.length}</span>
        ${app.step === steps.length - 1
      ? `<button class="btn primary" data-act="sheet">Finish — open the sheet</button>`
      : `<button class="btn primary" data-act="next">Next: ${h(steps[app.step + 1].name)} →</button>`}
      </div>
    </div>
    <div class="rail">${rail(c)}</div>
  </div>`;
}

/* ---------------- right rail live stats ---------------- */
function rail(c) {
  const S = sys(c.systemId);
  const d = derive(c);
  const s = c.finalScores;
  const issues = validate(c);
  const errs = issues.filter(i => i.level === 'error');
  const warns = issues.filter(i => i.level === 'warn');

  const abilRow = ABIL6.map(a => `<div class="stat"><div class="k">${a.toUpperCase()}</div>
    <div class="v">${s[a]}</div><div class="sub">${signed(mod(s[a]))}</div></div>`).join('');

  let core = '';
  if (c.systemId === '5e' || c.systemId === '5.5e') {
    core = kv([['Hit Points', d.hp], ['Hit Dice', d.hitDice], ['Armor Class', d.ac], ['Initiative', signed(d.initiative)],
    ['Speed', d.speed + ' ft.'], ['Prof. Bonus', signed(d.profBonus)], ['Passive Perception', d.passivePerception]]);
    if (d.spell) core += kv([['Spell Save DC', d.spell.dc], ['Spell Attack', signed(d.spell.attack)]]);
  } else if (c.systemId === '4e') {
    core = kv([['Hit Points', d.hp], ['Bloodied', d.bloodied], ['Healing Surges', d.surges + ' (' + d.surgeValue + ' HP)'],
    ['AC', d.ac], ['Fortitude', d.fort], ['Reflex', d.ref], ['Will', d.will],
    ['Initiative', signed(d.initiative)], ['Speed', d.speed], ['Tier', d.tier]]);
  } else if (c.systemId === 'pf1') {
    core = kv([['Hit Points', d.hp], ['AC', d.ac + ' (touch ' + d.touchAC + ', FF ' + d.flatFooted + ')'],
    ['BAB', signed(d.bab)], ['Fort / Ref / Will', signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will)],
    ['CMB / CMD', signed(d.cmb) + ' / ' + d.cmd], ['Initiative', signed(d.initiative)], ['Speed', d.speed],
    ['Skill ranks', d.skillRanksSpent + ' / ' + d.skillRanksTotal]]);
  } else {
    core = kv([['Hit Points', d.hp], ['AC', d.ac + (d.shieldAc ? ' (' + d.shieldAc + ' shield)' : '')],
    ['Class DC', d.classDC], ['Perception', signed(d.perception) + ' (' + PROF_LABEL[d.perceptionRank] + ')'],
    ['Fort / Ref / Will', signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will)],
    ['Speed', d.speed]]);
    if (d.spell) core += kv([['Spell DC', d.spell.dc], ['Spell attack', signed(d.spell.attack)], ['Tradition', d.spell.tradition]]);
  }
  if ((c.spells || []).length) {
    const cnt = spellCounts(c);
    core += kv([['Spells chosen', cnt.total + (cnt.prepared ? ' (' + cnt.prepared + ' prepared)' : '')]]);
  }

  return `<div class="panel">
      <h2>Live stats</h2>
      <div class="statgrid" style="margin-bottom:10px">${abilRow}</div>
      ${core}
    </div>
    <div class="panel">
      <h2>Checks <span class="hint">${errs.length} blocking</span></h2>
      ${issues.length
      ? `<ul class="issues">${errs.concat(warns).map(i => `<li class="${i.level}">${h(i.text)}</li>`).join('')}</ul>`
      : `<div class="ok">Everything checks out.</div>`}
    </div>
    ${d.notes && d.notes.length ? `<div class="panel"><h2>Rules notes</h2><ul class="issues">${d.notes.map(n => `<li class="warn">${h(n)}</li>`).join('')}</ul></div>` : ''}`;
}
function kv(pairs) {
  return pairs.map(([k, v]) => `<div class="kv"><span>${h(k)}</span><span>${h(v)}</span></div>`).join('');
}

/* ---------------- step: system ---------------- */
function stepSystem(c) {
  const untouched = !c.lineageId && !c.classId && !c.backgroundId;
  return `<div class="panel">
    <h2>Which game are you playing? <span class="hint">step one of ${stepsFor(c).length}</span></h2>
    <p class="note">${untouched
      ? 'Pick an edition and the rest of the wizard adapts to it — the right races, classes, skills, and spell lists.'
      : 'Switching systems keeps your name and level but clears race, class, background, and skills, since those don’t translate between editions.'}</p>
    <div class="cards" style="margin-top:10px">
      ${SYSTEM_ORDER.map(id => {
    const S = SYSTEMS[id];
    return `<button class="card ${c.systemId === id ? 'sel' : ''}" data-act="setsys" data-sys="${id}">
          <span class="pill">${h(S.tag)}</span><span class="t">${h(S.name)}</span>
          <span class="s">${h(S.blurb)}</span></button>`;
  }).join('')}
    </div>
    <div class="callout">${h(sysHelp(c.systemId))}</div>
    ${untouched ? `<p class="note">Currently set to <b>${h(sys(c.systemId).name)}</b>. Click a card to change it, or carry on to the next step.</p>` : ''}
  </div>`;
}
function sysHelp(id) {
  return {
    '5e': 'Ability scores come from point buy, a standard array, or rolling. Proficiency bonus scales from +2 to +6. Your race, class, and background each hand you a package of proficiencies.',
    '4e': 'Everything gets a bonus equal to half your level. Defenses are AC, Fortitude, Reflex, and Will. You pick powers rather than spells: at-will, encounter, daily, and utility.',
    'pf1': 'Skill ranks are spent individually and capped at your level; class skills get a flat +3 once you put a rank in. Base attack bonus and saves follow class progressions.',
    'pf2': 'Scores are built from boosts rather than bought: everything starts at 10, then ancestry, background, class, and four free boosts push it up. Proficiency has four ranks and your level is added to nearly every roll.'
  }[id] || '';
}

/* ---------------- step: identity ---------------- */
function stepIdentity(c) {
  const S = sys(c.systemId);
  return `<div class="panel">
    <h2>Identity</h2>
    <div class="grid2">
      <div class="field"><label>Character name</label><input data-field="name" value="${h(c.name)}" placeholder="e.g. Thoradin Emberhand"></div>
      <div class="field"><label>Player</label><input data-field="player" value="${h(c.player)}" placeholder="Your name"></div>
      <div class="field"><label>Level (1–${S.maxLevel})</label>
        <input type="number" min="1" max="${S.maxLevel}" data-field="level" data-num="1" value="${c.level}"></div>
      <div class="field"><label>${c.systemId === 'pf2' ? 'Alignment / edicts' : 'Alignment'}</label>
        <select data-field="alignment"><option value="">—</option>
        ${S.alignments.map(a => `<option ${c.alignment === a ? 'selected' : ''}>${h(a)}</option>`).join('')}</select></div>
      <div class="field"><label>Deity / patron</label><input data-field="deity" value="${h(c.deity)}" placeholder="Optional"></div>
      <div class="field"><label>Hit point method</label>
        <select data-field="hpMethod">
          <option value="average" ${c.hpMethod === 'average' ? 'selected' : ''}>Fixed average (standard)</option>
          <option value="roll" ${c.hpMethod === 'roll' ? 'selected' : ''}>Roll hit dice</option>
        </select></div>
    </div>
    ${c.hpMethod === 'roll' && c.systemId !== '4e' ? `<div class="callout">
      Rolled hit points per level after 1st: ${c.hpRolls.length ? c.hpRolls.join(', ') : 'none rolled yet'}.
      <button class="btn sm" data-act="rollhp" style="margin-left:8px">Roll for levels 2–${c.level}</button>
      <button class="btn sm ghost" data-act="clearhp">Clear</button></div>` : ''}
    ${c.systemId === '4e' ? `<div class="callout">4th Edition hit points are fixed: a starting value plus your Constitution score, then a flat amount per level. There is nothing to roll.</div>` : ''}
  </div>`;
}

/* ---------------- step: lineage ---------------- */
function stepLineage(c) {
  const S = sys(c.systemId);
  const lin = byId(S.lineages, c.lineageId);
  const sub = lin ? byId(lin.subs || [], c.lineageSubId) : null;

  const cards = S.lineages.map(l => {
    const bits = [];
    if (c.systemId === 'pf2') {
      bits.push('HP ' + l.hp, l.size, l.speed + ' ft.');
      if (l.boosts && l.boosts.length) bits.push('+' + l.boosts.map(b => b.toUpperCase()).join(' +'));
      if (l.freeBoosts) bits.push(l.freeBoosts + ' free');
      if (l.flaw) bits.push('−' + l.flaw.toUpperCase());
    } else {
      const a = l.asi || {};
      const str = Object.keys(a).map(k => signed(a[k]) + ' ' + k.toUpperCase()).join(', ');
      bits.push(str || 'flexible', l.size, l.speed + (c.systemId === '4e' ? ' sq.' : ' ft.'));
      if (l.choiceAsi) bits.push(l.choiceAsi.count + '×' + signed(l.choiceAsi.amount) + ' your choice');
    }
    return `<button class="card ${c.lineageId === l.id ? 'sel' : ''}" data-act="pick" data-field="lineageId" data-val="${l.id}">
      <span class="t">${h(l.name)}</span><span class="s">${h(bits.join(' · '))}</span></button>`;
  }).join('');

  let detail = '';
  if (lin) {
    detail = `<div class="panel"><h2>${h(lin.name)} <span class="hint">${h(lin.languages.join(', '))}${lin.extraLanguages ? ' + ' + lin.extraLanguages + ' of your choice' : ''}</span></h2>
      <ul class="traitlist">${(lin.traits || []).map(t => `<li><b>${h(t.name)}.</b> ${h(t.text)}</li>`).join('')}</ul>`;
    if ((lin.subs || []).length) {
      const label = c.systemId === 'pf2' ? 'Heritage' : c.systemId === '4e' ? 'Variant' : 'Subrace';
      detail += `<h3 style="margin-top:14px">${label}</h3><div class="cards">
        ${lin.subs.map(sb => {
        const extra = sb.asi ? Object.keys(sb.asi).map(k => signed(sb.asi[k]) + ' ' + k.toUpperCase()).join(', ') : '';
        return `<button class="card ${c.lineageSubId === sb.id ? 'sel' : ''}" data-act="pick" data-field="lineageSubId" data-val="${sb.id}">
            <span class="t">${h(sb.name)}</span><span class="s">${h(sb.note || extra || '')}${extra && sb.note ? ' · ' + h(extra) : ''}</span></button>`;
      }).join('')}</div>`;
    }
    if (lin.choice) {
      detail += `<div class="field" style="margin-top:14px"><label>${h(lin.choice.label)}</label>
        <select data-field="choices.${lin.choice.key}"><option value="">—</option>
        ${lin.choice.options.map(o => `<option ${(c.choices || {})[lin.choice.key] === o ? 'selected' : ''}>${h(o)}</option>`).join('')}</select></div>`;
    }
    // free ability picks
    if (c.systemId === 'pf2') {
      if (lin.freeBoosts) {
        detail += `<h3 style="margin-top:14px">Free ancestry boost${lin.freeBoosts > 1 ? 's' : ''}</h3>
          <div class="grid3">${Array.from({ length: lin.freeBoosts }, (_, i) => boostSelect(c, 'boosts.ancestryFree.' + i, asArray(c.boosts.ancestryFree)[i], lin.flaw ? [] : [], 'Boost ' + (i + 1))).join('')}</div>`;
      }
    } else {
      const spec = (sub && sub.choiceAsi) || lin.choiceAsi;
      if (spec) {
        detail += `<h3 style="margin-top:14px">Choose ${spec.count} ability increase${spec.count > 1 ? 's' : ''} (${signed(spec.amount)} each)</h3>
          <div class="grid3">${Array.from({ length: spec.count }, (_, i) => abilSelect(c, 'choiceAsi.' + i, asArray(c.choiceAsi)[i], spec.exclude || [], 'Increase ' + (i + 1))).join('')}</div>`;
      }
    }
    if (lin.skillBonus) {
      detail += `<div class="callout">Racial skill bonuses: ${Object.keys(lin.skillBonus).map(k => (byId(S.skills, k) || { name: k }).name + ' +' + lin.skillBonus[k]).join(', ')}.</div>`;
    }
    detail += `</div>`;
  }

  return `<div class="panel"><h2>${h(S.lineageLabel)}</h2><div class="cards">${cards}</div></div>${detail}`;
}
function abilSelect(c, path, val, exclude, label) {
  return `<div class="field"><label>${h(label)}</label><select data-field="${path}">
    <option value="">—</option>
    ${ABIL6.filter(a => !exclude.includes(a)).map(a => `<option value="${a}" ${val === a ? 'selected' : ''}>${ABIL_NAME[a]}</option>`).join('')}
  </select></div>`;
}
function boostSelect(c, path, val, exclude, label) { return abilSelect(c, path, val, exclude, label); }

/* ---------------- step: background ---------------- */
function stepBackground(c) {
  const S = sys(c.systemId);
  const bg = byId(S.backgrounds, c.backgroundId);
  const skName = id => (byId(S.skills, id) || { name: id }).name;
  const cards = S.backgrounds.map(b => {
    const bits = [];
    if (b.boosts) bits.push('+' + b.boosts.map(x => x.toUpperCase()).join(' +'));
    if (b.skills && b.skills.length) bits.push(b.skills.map(skName).join(', '));
    if (b.loreSkill) bits.push(b.loreSkill);
    if (b.feat) bits.push(b.feat);
    if (b.feature && b.feature !== '—') bits.push(b.feature);
    return `<button class="card ${c.backgroundId === b.id ? 'sel' : ''}" data-act="pick" data-field="backgroundId" data-val="${b.id}">
      <span class="t">${h(b.name)}</span><span class="s">${h(bits.join(' · '))}</span></button>`;
  }).join('');

  let detail = '';
  if (bg) {
    const rows = [];
    if (bg.boosts) rows.push(['Ability boosts', bg.boosts.map(x => ABIL_NAME[x]).join(' and ')]);
    if (bg.skills && bg.skills.length) rows.push(['Trained skill' + (bg.skills.length > 1 ? 's' : ''), bg.skills.map(skName).join(', ') + (bg.skillChoose ? ' (choose ' + bg.skillChoose + ')' : '')]);
    if (bg.loreSkill) rows.push(['Lore', bg.loreSkill]);
    if (bg.feat) rows.push(['Skill feat', bg.feat]);
    if (bg.tools && bg.tools.length) rows.push(['Tools', bg.tools.join(', ')]);
    if (bg.languages) rows.push(['Languages', bg.languages + ' of your choice']);
    if (bg.feature && bg.feature !== '—') rows.push(['Feature', bg.feature]);
    if (bg.equip && bg.equip.length) rows.push(['Equipment', bg.equip.join(', ')]);
    detail = `<div class="panel"><h2>${h(bg.name)}</h2>${kv(rows)}`;
    if (c.systemId === '4e' && bg.chooseFrom) {
      detail += `<div class="field" style="margin-top:12px"><label>Background skill benefit (+2 to this skill)</label>
        <select data-field="bgSkillBonus"><option value="">—</option>
        ${bg.chooseFrom.map(id => `<option value="${id}" ${c.bgSkillBonus === id ? 'selected' : ''}>${h(skName(id))}</option>`).join('')}</select></div>`;
    }
    detail += `</div>`;
  }
  const note = c.systemId === 'pf1'
    ? 'Pathfinder 1e uses traits rather than backgrounds. Most tables let you take two; pick the one that matters most here and note the second in Roleplay.'
    : c.systemId === '4e'
      ? 'Backgrounds are optional in 4e and grant a small benefit, usually +2 to an associated skill or adding it to your class skill list.'
      : '';
  return `<div class="panel"><h2>${h(S.backgroundLabel)}</h2>
    ${note ? `<p class="note">${h(note)}</p>` : ''}
    <div class="cards">${cards}</div></div>${detail}`;
}

/* ---------------- step: class ---------------- */
function stepClass(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const cards = S.classes.map(cl => {
    const bits = [];
    if (c.systemId === 'pf2') { bits.push('HP ' + cl.hp + '/level', 'Key: ' + cl.keyAbility.map(k => k.toUpperCase()).join(' or ')); }
    else if (c.systemId === '4e') { bits.push(cl.role + ' · ' + cl.source, 'HP ' + cl.hpBase + ' + Con, ' + cl.hpPerLevel + '/level'); }
    else if (c.systemId === 'pf1') { bits.push('d' + cl.hitDie, cl.bab === 'full' ? 'Full BAB' : cl.bab === 'threeQuarter' ? '¾ BAB' : '½ BAB', cl.skillRanks + '+Int ranks'); }
    else { bits.push('d' + cl.hitDie + ' hit die', 'Saves: ' + cl.saves.map(x => x.toUpperCase()).join('/'), cl.skillCount + ' skills'); }
    if (cl.spellcasting) bits.push('Caster');
    return `<button class="card ${c.classId === cl.id ? 'sel' : ''}" data-act="pick" data-field="classId" data-val="${cl.id}">
      <span class="t">${h(cl.name)}</span><span class="s">${h(bits.join(' · '))}</span></button>`;
  }).join('');

  let detail = '';
  if (cls) {
    const rows = [];
    if (c.systemId === 'pf2') {
      rows.push(['Hit points', cls.hp + ' + Con per level'], ['Perception', cls.perception],
        ['Saves', 'Fort ' + cls.saves.fort + ', Ref ' + cls.saves.ref + ', Will ' + cls.saves.will],
        ['Skills', cls.skillCount + ' + Int modifier'], ['Weapons', cls.weapons],
        ['Armor', Object.keys(cls.armor).join(', ')]);
    } else if (c.systemId === '4e') {
      rows.push(['Role', cls.role], ['Power source', cls.source],
        ['Hit points', cls.hpBase + ' + Con score, +' + cls.hpPerLevel + ' per level'],
        ['Healing surges', cls.surgesBase + ' + Con modifier'],
        ['Armor', cls.armor.join(', ')], ['Weapons', cls.weapons.join(', ')],
        ['Trained skills', cls.skillCount + (cls.grantSkills ? ' (plus ' + cls.grantSkills.join(', ') + ')' : '')]);
    } else if (c.systemId === 'pf1') {
      rows.push(['Hit die', 'd' + cls.hitDie], ['Base attack', cls.bab === 'full' ? 'Full (level)' : cls.bab === 'threeQuarter' ? '¾ level' : '½ level'],
        ['Good saves', Object.keys(cls.saves).filter(k => cls.saves[k] === 'good').map(k => k.toUpperCase()).join(', ') || 'none'],
        ['Skill ranks', cls.skillRanks + ' + Int modifier per level'],
        ['Armor', cls.armor.length ? cls.armor.join(', ') : 'None'], ['Weapons', cls.weapons.join(', ')]);
      if (cls.startGold) rows.push(['Starting wealth', cls.startGold]);
    } else {
      rows.push(['Hit die', 'd' + cls.hitDie], ['Saving throws', cls.saves.map(x => ABIL_NAME[x]).join(' and ')],
        ['Armor', cls.armor.length ? cls.armor.join(', ') : 'None'], ['Weapons', cls.weapons.join(', ')],
        ['Tools', cls.tools.length ? cls.tools.join(', ') : 'None'], ['Skills', 'choose ' + cls.skillCount]);
      if (cls.spellcasting) rows.push(['Spellcasting', ABIL_NAME[cls.spellcasting.ability] + ', ' + cls.spellcasting.kind + (cls.spellcasting.prepares ? ' (prepared)' : ' (known)')]);
    }
    detail = `<div class="panel"><h2>${h(cls.name)}</h2>${kv(rows)}`;

    if (c.systemId === 'pf2' && cls.keyAbility.length > 1) {
      detail += `<div class="field" style="margin-top:12px"><label>Key ability (class boost)</label>
        <select data-field="keyAbility">${cls.keyAbility.map(k => `<option value="${k}" ${c.keyAbility === k ? 'selected' : ''}>${ABIL_NAME[k]}</option>`).join('')}</select></div>`;
    }
    if ((cls.subclasses || []).length) {
      const unlocked = c.level >= (cls.subclassLevel || 1);
      detail += `<h3 style="margin-top:14px">${h(S.subclassLabel)}${cls.subclassLevel && cls.subclassLevel > 1 ? ' <span class="tag">level ' + cls.subclassLevel + '</span>' : ''}</h3>
        ${unlocked ? '' : `<p class="note">You gain this at level ${cls.subclassLevel}. You can still plan ahead.</p>`}
        <div class="cards">${cls.subclasses.map(sb => `<button class="card ${c.subclassId === sb.id ? 'sel' : ''}" data-act="pick" data-field="subclassId" data-val="${sb.id}">
          <span class="t">${h(sb.name)}</span><span class="s">${h(sb.note || '')}</span></button>`).join('')}</div>`;
    }
    (cls.choices || []).forEach(ch => {
      detail += `<div class="field" style="margin-top:12px"><label>${h(ch.label)}</label>
        <select data-field="choices.${ch.key}"><option value="">—</option>
        ${ch.options.map(o => `<option ${(c.choices || {})[ch.key] === o ? 'selected' : ''}>${h(o)}</option>`).join('')}</select></div>`;
    });
    if (cls.choice) {
      detail += `<div class="field" style="margin-top:12px"><label>${h(cls.choice.label)}</label>
        <select data-field="choices.${cls.choice.key}"><option value="">—</option>
        ${cls.choice.options.map(o => `<option ${(c.choices || {})[cls.choice.key] === o ? 'selected' : ''}>${h(o)}</option>`).join('')}</select></div>`;
    }
    if (c.systemId === 'pf1') {
      detail += `<div class="field" style="margin-top:12px"><label>Favored class bonus (per level)</label>
        <select data-field="favoredClassBonus">
          <option value="hp" ${c.favoredClassBonus === 'hp' ? 'selected' : ''}>+1 hit point per level</option>
          <option value="skill" ${c.favoredClassBonus === 'skill' ? 'selected' : ''}>+1 skill rank per level</option>
          <option value="none" ${c.favoredClassBonus === 'none' ? 'selected' : ''}>Not my favored class</option>
        </select></div>`;
    }
    if (cls.startEquip) detail += `<div class="callout"><b>Suggested starting gear:</b> ${h(cls.startEquip.join('; '))}.</div>`;
    if (c.systemId === '4e' && cls.powers) {
      detail += `<h3 style="margin-top:12px">Level 1 powers</h3>${powerBlock(cls.powers)}`;
    }
    detail += `</div>`;
  }
  return `<div class="panel"><h2>${h(S.classLabel)}</h2><div class="cards">${cards}</div></div>${detail}`;
}
function powerBlock(p) {
  const sec = (label, arr) => arr && arr.length
    ? `<h4 style="margin:8px 0 2px;color:var(--gold2)">${label}</h4><ul class="powerlist">${arr.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '';
  return sec('At-Will', p.atwill) + sec('Encounter', p.encounter) + sec('Daily', p.daily) + sec('Level 2 Utility options', p.utility1);
}

/* ---------------- step: abilities ---------------- */
function stepAbilities(c) {
  const S = sys(c.systemId);
  const gen = S.abilityGen;
  const methods = [];
  if (gen.boosts) methods.push(['boosts', 'Boosts (standard)']);
  if (gen.pointBuy) methods.push(['pointbuy', 'Point buy']);
  if (gen.arrays && gen.arrays.length) methods.push(['array', 'Standard array']);
  if (gen.rolls && gen.rolls.length) methods.push(['roll', 'Roll dice']);
  methods.push(['manual', 'Enter manually']);

  let body = '';
  if (c.abilityMethod === 'boosts') body = uiBoosts(c);
  else if (c.abilityMethod === 'pointbuy') body = uiPointBuy(c);
  else if (c.abilityMethod === 'array') body = uiArray(c);
  else if (c.abilityMethod === 'roll') body = uiRoll(c);
  else body = uiManual(c);

  const s = c.finalScores;
  const finalRow = `<div class="abils" style="margin-top:14px">${ABIL6.map(a => {
    const parts = [];
    if (c.racialAdj && c.racialAdj[a]) parts.push(signed(c.racialAdj[a]) + ' race');
    if (c.levelAdj && c.levelAdj[a]) parts.push(signed(c.levelAdj[a]) + ' level');
    return `<div class="abil"><div class="n">${ABIL_NAME[a]}</div><div class="v">${s[a]}</div>
      <div class="m">${signed(mod(s[a]))}</div><div class="parts">${h(parts.join(' · '))}</div></div>`;
  }).join('')}</div>`;

  return `<div class="panel">
      <h2>Ability scores</h2>
      <div class="tabs">${methods.map(([id, label]) => `<button class="${c.abilityMethod === id ? 'on' : ''}" data-act="method" data-val="${id}">${h(label)}</button>`).join('')}</div>
      ${gen.note ? `<div class="callout">${h(gen.note)}</div>` : ''}
      ${body}
    </div>
    <div class="panel"><h2>Final scores <span class="hint">after every adjustment</span></h2>${finalRow}
      ${c.scoreTrace && c.scoreTrace.length ? `<div class="callout">${h(c.scoreTrace.join(' → '))}</div>` : ''}
    </div>`;
}

function uiPointBuy(c) {
  const S = sys(c.systemId);
  const pb = S.abilityGen.pointBuy;
  const budget = c.pointBudget || pb.points;
  const spent = pointBuySpend(c.baseScores, pb.table);
  const pct = clamp(Math.round(spent / budget * 100), 0, 100);
  const presets = pb.presets ? `<div class="field" style="max-width:220px"><label>Budget</label>
    <select data-field="pointBudget" data-num="1">${pb.presets.map(p => `<option value="${p.points}" ${budget === p.points ? 'selected' : ''}>${h(p.name)} — ${p.points} pts</option>`).join('')}</select></div>` : '';
  return `${presets}
    <div class="budget"><b>${spent} / ${budget}</b> points
      <div class="bar ${spent > budget ? 'over' : ''}"><i style="width:${pct}%"></i></div>
      <span class="note">range ${pb.min}–${pb.max}</span></div>
    <div class="abils">${ABIL6.map(a => {
    const v = c.baseScores[a];
    const cost = pb.table[v];
    return `<div class="abil"><div class="n">${ABIL_NAME[a]}</div><div class="v">${v}</div>
        <div class="m">${signed(mod(v))}</div>
        <div class="parts">cost ${cost === undefined ? '—' : cost}</div>
        <div class="stepper">
          <button class="btn sm" data-act="pbdec" data-abil="${a}" ${v <= pb.min ? 'disabled' : ''}>−</button>
          <button class="btn sm" data-act="pbinc" data-abil="${a}" ${v >= pb.max ? 'disabled' : ''}>+</button>
        </div></div>`;
  }).join('')}</div>
    <div style="margin-top:10px"><button class="btn sm" data-act="pbreset">Reset to ${pb.min}s</button></div>`;
}

function uiArray(c) {
  const S = sys(c.systemId);
  const arrays = S.abilityGen.arrays;
  const active = arrays.find(a => a.id === c.arrayId) || arrays[0];
  if (!c.arrayId) c.arrayId = active.id;
  const used = ABIL6.map(a => c.arrayAssign[a]).filter(x => x !== undefined && x !== null);
  return `<div class="cards" style="margin-bottom:12px">
      ${arrays.map(a => `<button class="card ${c.arrayId === a.id ? 'sel' : ''}" data-act="pickarray" data-val="${a.id}">
        <span class="t">${h(a.name)}</span><span class="s">${a.scores.join(', ')}</span></button>`).join('')}
    </div>
    <div class="pool">${active.scores.map((v, i) => `<span class="die ${used.includes(i) ? 'used' : ''}"><b>${v}</b></span>`).join('')}</div>
    <div class="abils">${ABIL6.map(a => `<div class="abil"><div class="n">${ABIL_NAME[a]}</div>
      <div class="v">${c.arrayAssign[a] !== undefined && c.arrayAssign[a] !== null ? active.scores[c.arrayAssign[a]] : '—'}</div>
      <select data-field="arrayAssign.${a}" data-num="1"><option value="">—</option>
      ${active.scores.map((v, i) => `<option value="${i}" ${c.arrayAssign[a] === i ? 'selected' : ''} ${used.includes(i) && c.arrayAssign[a] !== i ? 'disabled' : ''}>${v}</option>`).join('')}
      </select></div>`).join('')}</div>
    <div style="margin-top:10px"><button class="btn sm" data-act="autoarray">Auto-assign to class priorities</button>
      <button class="btn sm ghost" data-act="clearassign">Clear</button></div>`;
}

function uiRoll(c) {
  const S = sys(c.systemId);
  const opts = S.abilityGen.rolls;
  const used = ABIL6.map(a => c.rollAssign[a]).filter(x => x !== undefined && x !== null);
  return `<div class="grid2">
      <div class="field"><label>Method</label><select data-field="rollMethod">
        ${opts.map(o => `<option value="${o.id}" ${(c.rollMethod || opts[0].id) === o.id ? 'selected' : ''}>${h(o.name)}</option>`).join('')}
      </select></div>
      <div class="field"><label>&nbsp;</label>
        <button class="btn primary" data-act="rollscores">Roll six scores</button>
        <button class="btn" data-act="rollscores7">Roll seven, drop lowest</button></div>
    </div>
    ${(c.rolledPool || []).length ? `<div class="pool">${c.rolledPool.map((v, i) => `<span class="die ${used.includes(i) ? 'used' : ''}"><b>${v}</b>${c.rollDetail && c.rollDetail[i] ? ' <small>' + h(c.rollDetail[i]) + '</small>' : ''}</span>`).join('')}</div>
      <div class="abils">${ABIL6.map(a => `<div class="abil"><div class="n">${ABIL_NAME[a]}</div>
        <div class="v">${c.rollAssign[a] !== undefined && c.rollAssign[a] !== null ? c.rolledPool[c.rollAssign[a]] : '—'}</div>
        <select data-field="rollAssign.${a}" data-num="1"><option value="">—</option>
        ${c.rolledPool.map((v, i) => `<option value="${i}" ${c.rollAssign[a] === i ? 'selected' : ''} ${used.includes(i) && c.rollAssign[a] !== i ? 'disabled' : ''}>${v}</option>`).join('')}
        </select></div>`).join('')}</div>
      <div style="margin-top:10px"><button class="btn sm" data-act="autoroll">Auto-assign to class priorities</button>
        <button class="btn sm ghost" data-act="clearassign">Clear</button></div>`
      : `<p class="note">Roll a set, then drag the values where you want them by using the dropdowns.</p>`}`;
}

function uiManual(c) {
  const S = sys(c.systemId);
  const m = S.abilityGen.manual;
  return `<p class="note">Straight entry — useful for converting a character from elsewhere. Racial adjustments are still applied on top.</p>
    <div class="abils">${ABIL6.map(a => `<div class="abil"><div class="n">${ABIL_NAME[a]}</div>
      <input type="number" min="${m.min}" max="${m.max}" style="width:100%;text-align:center;font-size:1.3rem" data-field="baseScores.${a}" data-num="1" value="${c.baseScores[a]}">
      <div class="m">${signed(mod(c.baseScores[a]))}</div></div>`).join('')}</div>`;
}

function uiBoosts(c) {
  const S = SYS_PF2;
  const anc = byId(S.lineages, c.lineageId);
  const bg = byId(S.backgrounds, c.backgroundId);
  const cls = byId(S.classes, c.classId);
  const key = c.keyAbility || (cls ? cls.keyAbility[0] : null);
  const freeUsed = asArray(c.boosts.free).filter(Boolean);
  return `<div class="callout">Order of operations: ancestry flaw, then ancestry boosts, background, class key ability, then four free boosts. A boost is +2, or +1 if the score is already 18 or higher.</div>
    ${kv([
    ['Ancestry', anc ? ((anc.boosts || []).map(x => ABIL_NAME[x]).join(' + ') || 'two free') + (anc.flaw ? ' / flaw −2 ' + ABIL_NAME[anc.flaw] : '') : 'pick an ancestry'],
    ['Background', bg ? (bg.boosts || []).map(x => ABIL_NAME[x]).join(' + ') : 'pick a background'],
    ['Class key ability', key ? ABIL_NAME[key] : 'pick a class']
  ])}
    ${anc && anc.freeBoosts ? `<h3 style="margin-top:14px">Free ancestry boost${anc.freeBoosts > 1 ? 's' : ''}</h3>
      <div class="grid3">${Array.from({ length: anc.freeBoosts }, (_, i) => abilSelect(c, 'boosts.ancestryFree.' + i, asArray(c.boosts.ancestryFree)[i], [], 'Ancestry boost ' + (i + 1))).join('')}</div>` : ''}
    <h3 style="margin-top:14px">Four free boosts <span class="tag">must be four different abilities</span></h3>
    <div class="grid3">${Array.from({ length: 4 }, (_, i) => {
    const val = asArray(c.boosts.free)[i];
    const taken = freeUsed.filter((x, j) => j !== i);
    return `<div class="field"><label>Free boost ${i + 1}</label>
        <select data-field="boosts.free.${i}"><option value="">—</option>
        ${ABIL6.map(a => `<option value="${a}" ${val === a ? 'selected' : ''} ${taken.includes(a) ? 'disabled' : ''}>${ABIL_NAME[a]}</option>`).join('')}
        </select></div>`;
  }).join('')}</div>
    <div style="margin-top:10px"><button class="btn sm" data-act="autoboost">Suggest boosts for my class</button></div>`;
}

/* ---------------- step: skills ---------------- */
function stepSkills(c) {
  const S = sys(c.systemId);
  const d = derive(c);
  if (c.systemId === 'pf1') return skillsPf1(c, d);
  if (c.systemId === 'pf2') return skillsPf2(c, d);
  return skillsSimple(c, d);
}

function skillsSimple(c, d) {
  const S = sys(c.systemId);
  const b = skillBudget(c);
  const allowed = allowedSkillIds(c);
  const chosen = (c.skills || []).filter(s => !b.granted.includes(s));
  const cls = byId(S.classes, c.classId);
  const expWant = ((c.systemId === '5e' || c.systemId === '5.5e') && cls && cls.expertise && c.level >= cls.expertise.level)
    ? cls.expertise.count + (c.level >= 6 ? 2 : 0) : 0;

  const rows = S.skills.map(sk => {
    const info = d.skills.find(x => x.id === sk.id) || { value: 0 };
    const granted = b.granted.includes(sk.id);
    const on = (c.skills || []).includes(sk.id) || granted;
    const can = allowed.includes(sk.id) || granted;
    const exp = (c.expertise || []).includes(sk.id);
    return `<tr class="${on ? 'on' : ''}">
      <td><label class="chk"><input type="checkbox" data-act="toggleskill" data-id="${sk.id}" ${on ? 'checked' : ''} ${granted || (!can) ? 'disabled' : ''}>
        ${h(sk.name)}</label></td>
      <td class="note">${ABIL_NAME[sk.ability].slice(0, 3)}</td>
      <td>${granted ? '<span class="tag">granted</span>' : (!can ? '<span class="note">off-list</span>' : '')}</td>
      ${expWant ? `<td><input type="checkbox" data-act="toggleexp" data-id="${sk.id}" ${exp ? 'checked' : ''} ${!on ? 'disabled' : ''}></td>` : ''}
      <td class="num">${signed(info.value)}</td></tr>`;
  }).join('');

  return `<div class="panel">
    <h2>Skills <span class="hint">${chosen.length} / ${b.count} chosen${b.granted.length ? ' · ' + b.granted.length + ' granted' : ''}</span></h2>
    ${c.systemId === '4e' ? '<p class="note">4e skills are trained or untrained: trained gives a flat +5. Everything also gets half your level.</p>' : ''}
    ${expWant ? `<p class="note">Expertise doubles your proficiency bonus. You have ${expWant} pick${expWant > 1 ? 's' : ''} at level ${c.level}: ${(c.expertise || []).length} used.</p>` : ''}
    <table><thead><tr><th>Skill</th><th>Ability</th><th></th>${expWant ? '<th>Exp.</th>' : ''}<th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function skillsPf1(c, d) {
  const S = SYS_PF1;
  const rows = S.skills.map(sk => {
    const info = d.skills.find(x => x.id === sk.id) || { value: 0, classSkill: false, detail: '' };
    const r = (c.ranks && c.ranks[sk.id]) || 0;
    return `<tr class="${r ? 'on' : ''}">
      <td>${h(sk.name)}${sk.trainedOnly ? ' <span class="tag">trained only</span>' : ''}</td>
      <td class="note">${ABIL_NAME[sk.ability].slice(0, 3)}</td>
      <td>${info.classSkill ? '<span class="tag">class skill</span>' : ''}</td>
      <td class="skillrow"><input type="number" min="0" max="${c.level}" value="${r}" data-act="setrank" data-id="${sk.id}"></td>
      <td class="note">${h(info.detail)}</td>
      <td class="num">${signed(info.value)}</td></tr>`;
  }).join('');
  const over = d.skillRanksSpent > d.skillRanksTotal;
  const pct = clamp(Math.round(d.skillRanksSpent / Math.max(1, d.skillRanksTotal) * 100), 0, 100);
  return `<div class="panel">
    <h2>Skill ranks</h2>
    <div class="budget"><b>${d.skillRanksSpent} / ${d.skillRanksTotal}</b> ranks
      <div class="bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div>
      <span class="note">${d.skillRanksPerLevel} per level × ${c.level} levels · max ${c.level} ranks in any one skill</span></div>
    <table><thead><tr><th>Skill</th><th>Ability</th><th></th><th>Ranks</th><th>Breakdown</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="margin-top:10px"><button class="btn sm ghost" data-act="clearranks">Clear all ranks</button></div></div>`;
}

function skillsPf2(c, d) {
  const S = SYS_PF2;
  const ranks = ['untrained', 'trained', 'expert', 'master', 'legendary'];
  const maxRank = c.level >= 15 ? 'legendary' : c.level >= 7 ? 'master' : c.level >= 3 ? 'expert' : 'trained';
  const maxIdx = ranks.indexOf(maxRank);
  const trained = Object.keys(c.profs || {}).filter(k => c.profs[k] && c.profs[k] !== 'untrained').length;
  const cls = byId(S.classes, c.classId);
  const expected = (cls ? cls.skillCount : 2) + Math.max(0, mod(c.finalScores.int)) + ((byId(S.backgrounds, c.backgroundId) || {}).skills || []).length;
  const rows = S.skills.map(sk => {
    const info = d.skills.find(x => x.id === sk.id) || { value: 0 };
    const r = (c.profs && c.profs[sk.id]) || 'untrained';
    return `<tr class="${r !== 'untrained' ? 'on' : ''}">
      <td>${h(sk.name)}</td><td class="note">${ABIL_NAME[sk.ability].slice(0, 3)}</td>
      <td><select data-act="setprof" data-id="${sk.id}">
        ${ranks.slice(0, maxIdx + 1).map(x => `<option value="${x}" ${r === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select></td>
      <td class="note">${h(info.detail || '')}</td>
      <td class="num">${signed(info.value)}</td></tr>`;
  }).join('');
  return `<div class="panel">
    <h2>Skill proficiencies <span class="hint">${trained} trained · about ${expected} expected at level 1</span></h2>
    <p class="note">Untrained skills get no level bonus at all in PF2 — that is the big difference from 5e. Skill increases at levels ${S.skillIncreaseLevels.join(', ')} let you push a skill to expert, then master at 7th and legendary at 15th. You have ${d.skillIncreases} increase${d.skillIncreases === 1 ? '' : 's'} so far.</p>
    <table><thead><tr><th>Skill</th><th>Ability</th><th>Rank</th><th>Breakdown</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="margin-top:10px"><button class="btn sm ghost" data-act="clearprofs">Reset all to untrained</button></div></div>`;
}

/* ---------------- step: advancement ---------------- */
function stepAdvance(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const d = derive(c);

  let asiUI = '';
  if (c.systemId === '5e' && cls) {
    const levels = cls.asiLevels.filter(l => l <= c.level);
    asiUI = levels.length ? levels.map(l => `<div class="panel" style="background:var(--bg2)">
      <h3>Level ${l} — Ability Score Improvement</h3>
      <p class="note">+2 to one ability, or +1 to two. Leave blank if you took a feat instead.</p>
      <div class="grid3">${[0, 1].map(i => abilSelect(c, 'levelAsi.' + l + '.' + i, asArray(c.levelAsi[l])[i], [], 'Increase ' + (i + 1))).join('')}
        <div class="field"><label>Feat taken instead</label><input data-field="choices.feat${l}" value="${h((c.choices || {})['feat' + l] || '')}" placeholder="e.g. Sharpshooter"></div></div>
    </div>`).join('') : '<p class="note">No ability score improvements yet — your first is at level ' + cls.asiLevels[0] + '.</p>';
  } else if (c.systemId === '5.5e' && cls) {
    const levels = cls.asiLevels.filter(l => l <= c.level);
    asiUI = levels.length ? levels.map(l => `<div class="panel" style="background:var(--bg2)">
      <h3>Level ${l} — Ability Score Improvement</h3>
      <p class="note">+2 to one ability, or +1 to two. Leave blank if you took a feat instead.</p>
      <div class="grid3">${[0, 1].map(i => abilSelect(c, 'levelAsi.' + l + '.' + i, asArray(c.levelAsi[l])[i], [], 'Increase ' + (i + 1))).join('')}
        <div class="field"><label>Feat taken instead</label><input data-field="choices.feat${l}" value="${h((c.choices || {})['feat' + l] || '')}" placeholder="e.g. Sharpshooter"></div></div>
    </div>`).join('') : '<p class="note">No ability score improvements yet — your first is at level ' + cls.asiLevels[0] + '.</p>';
  } else if (c.systemId === 'pf1') {
    const levels = [4, 8, 12, 16, 20].filter(l => l <= c.level);
    asiUI = levels.length ? levels.map(l => `<div class="panel" style="background:var(--bg2)">
      <h3>Level ${l} — +1 ability score</h3>
      <div class="grid3">${abilSelect(c, 'levelAsi.' + l + '.0', asArray(c.levelAsi[l])[0], [], 'Increase')}</div></div>`).join('')
      : '<p class="note">Ability increases come at levels 4, 8, 12, 16, and 20.</p>';
  } else if (c.systemId === 'pf2') {
    const levels = [5, 10, 15, 20].filter(l => l <= c.level);
    asiUI = levels.length ? levels.map(l => {
      const cur = asArray((c.boosts.levels || {})[l]);
      return `<div class="panel" style="background:var(--bg2)"><h3>Level ${l} — four ability boosts</h3>
        <div class="grid3">${Array.from({ length: 4 }, (_, i) => {
        const taken = cur.filter((x, j) => j !== i && x);
        return `<div class="field"><label>Boost ${i + 1}</label>
            <select data-field="boosts.levels.${l}.${i}"><option value="">—</option>
            ${ABIL6.map(a => `<option value="${a}" ${cur[i] === a ? 'selected' : ''} ${taken.includes(a) ? 'disabled' : ''}>${ABIL_NAME[a]}</option>`).join('')}
            </select></div>`;
      }).join('')}</div></div>`;
    }).join('') : '<p class="note">Ability boosts arrive at levels 5, 10, 15, and 20.</p>';
  } else {
    asiUI = `<p class="note">4th Edition raises abilities on a fixed schedule: +1 to two abilities at 11th, 14th, 18th, 21st, 24th, and 28th, and +1 to four abilities at 4th, 8th, 14th, 18th, 24th, and 28th. Track those on the Abilities step using manual entry if you are above level 3.</p>`;
  }

  const featCount = c.systemId === 'pf2'
    ? Object.keys(d.featCounts || {}).map(k => `<div class="kv"><span>${h(k)}</span><span>${d.featCounts[k]}</span></div>`).join('')
    : kv([['Feats', d.featCount || 0]].concat(d.bonusCombatFeats ? [['Bonus combat feats', d.bonusCombatFeats]] : []));

  return `<div class="panel">
      <h2>Level & advancement</h2>
      <div class="grid2">
        <div class="field"><label>Current level</label>
          <input type="number" min="1" max="${S.maxLevel}" data-field="level" data-num="1" value="${c.level}"></div>
        <div class="field"><label>Quick level up</label>
          <button class="btn primary" data-act="levelup" ${c.level >= S.maxLevel ? 'disabled' : ''}>Gain a level →</button></div>
      </div>
      ${app.levelUpLog.length ? `<div class="callout"><b>Just gained:</b><ul class="powerlist">${app.levelUpLog.map(g => `<li>Level ${g.level}: ${h(g.text)}</li>`).join('')}</ul></div>` : ''}
      ${featCount}
    </div>
    <div class="panel"><h2>Ability increases</h2>${asiUI}</div>
    <div class="panel"><h2>Features gained so far <span class="hint">${d.features.length} entries</span></h2>
      ${d.features.length ? `<table><thead><tr><th>Lvl</th><th>Feature</th></tr></thead><tbody>
        ${d.features.map(f => `<tr><td class="num">${f.level}</td><td>${h(f.text)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="note">Pick a class to see its features.</p>'}
    </div>
    ${c.systemId === '4e' && d.powersKnown ? `<div class="panel"><h2>Powers known</h2>${kv(Object.keys(d.powersKnown).map(k => [k, d.powersKnown[k]]))}</div>` : ''}
    ${c.systemId === 'pf2' && d.spell ? `<div class="panel"><h2>Spellcasting</h2>${kv([['Tradition', d.spell.tradition], ['Type', d.spell.kind], ['Proficiency', d.spell.rank], ['Highest rank', d.spell.maxRank], ['Slots', d.spell.slotsPerRank], ['Cantrips', d.spell.cantrips]])}</div>` : ''}
    ${(c.systemId === '5e' || c.systemId === '5.5e' || c.systemId === 'pf1') && d.spell ? `<div class="panel"><h2>Spellcasting</h2>${spellPanel(c, d)}</div>` : ''}
    <div class="panel"><h2>Feat and option notes</h2>
      <p class="note">Type whatever you picked; there is no validation here, so homebrew and third-party options are fine.</p>
      <textarea data-field="notes" placeholder="Feats, invocations, rage powers, discoveries, metamagic, item choices...">${h(c.notes)}</textarea>
      <div class="callout"><b>Common ${h(S.name)} options:</b> ${h((S.feats || []).slice(0, 14).join(', '))}…</div>
    </div>`;
}

function spellPanel(c, d) {
  if (!d.spell) return '';
  if (c.systemId === '5e' || c.systemId === '5.5e') {
    const rows = [['Ability', d.spell.ability], ['Save DC', d.spell.dc], ['Attack bonus', signed(d.spell.attack)]];
    if (d.spell.cantrips) rows.push(['Cantrips known', d.spell.cantrips]);
    if (d.spell.prepared) rows.push(['Spells prepared', d.spell.prepared]);
    if (d.spell.note) rows.push(['Pact magic', d.spell.note]);
    if (d.spell.slots && d.spell.slots.length) rows.push(['Slots', d.spell.slots.map((n, i) => (i + 1) + 'st:' + n).join('  ')]);
    return kv(rows);
  }
  const rows = [['Ability', d.spell.ability], ['Type', d.spell.kind], ['Caster level', d.spell.casterLevel],
  ['Highest spell level', d.spell.maxSpellLevel || 'none yet'], ['Concentration', signed(d.spell.concentration)],
  ['Base save DC', d.spell.saveDCbase + ' + spell level']];
  const bs = Object.keys(d.spell.bonusSlots || {});
  if (bs.length) rows.push(['Bonus slots', bs.map(k => 'lvl ' + k + ': +' + d.spell.bonusSlots[k]).join(', ')]);
  return kv(rows);
}

/* ---------------- step: gear ---------------- */
function stepGear(c) {
  const S = sys(c.systemId);
  const d = derive(c);
  const armors = S.armorList || [];
  let shieldUI = '';
  if (c.systemId === '5e' || c.systemId === '5.5e') {
    shieldUI = `<label class="chk"><input type="checkbox" data-act="toggleshield" ${c.shield ? 'checked' : ''}> Carrying a shield (+2 AC)</label>`;
  } else if (c.systemId === '4e') {
    shieldUI = `<div class="field"><label>Shield</label><select data-field="shield4e">
      ${S.shields.map(s => `<option ${c.shield4e === s.name ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></div>`;
  } else if (c.systemId === 'pf1') {
    shieldUI = `<div class="field"><label>Shield</label><select data-field="shieldPf">
      ${S.shields.map(s => `<option ${c.shieldPf === s.name ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></div>`;
  } else {
    shieldUI = `<div class="field"><label>Shield</label><select data-field="shieldPf2">
      ${S.shields.map(s => `<option ${c.shieldPf2 === s.name ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></div>`;
  }

  return `<div class="panel">
      <h2>Armor & defense</h2>
      <div class="grid2">
        <div class="field"><label>Armor worn</label><select data-field="armor">
          ${armors.map(a => `<option ${(c.armor || armors[0].name) === a.name ? 'selected' : ''}>${h(a.name)}</option>`).join('')}
        </select></div>
        <div>${shieldUI}</div>
        <div class="field"><label>Misc. AC bonus (rings, magic, cover)</label>
          <input type="number" data-field="acBonus" data-num="1" value="${c.acBonus || 0}"></div>
        ${c.systemId === '4e' ? `<div class="field"><label>Weapon proficiency bonus</label>
          <input type="number" data-field="weaponProf" data-num="1" value="${c.weaponProf || 0}"></div>` : ''}
        ${c.systemId === 'pf1' ? `<div class="field"><label>Misc. initiative bonus</label>
          <input type="number" data-field="initBonus" data-num="1" value="${c.initBonus || 0}"></div>` : ''}
      </div>
      ${kv(defenseRows(c, d))}
    </div>
    <div class="panel"><h2>Equipment & wealth</h2>
      <div class="grid2">
        <div class="field"><label>Money</label><input data-field="gold" value="${h(c.gold)}" placeholder="e.g. 47 gp, 3 sp"></div>
        <div class="field"><label>Carrying capacity</label>
          <input value="${d.carry ? d.carry.carry + ' lb (push/drag ' + d.carry.push + ')' : (d.bulkLimit || '—')}" disabled></div>
      </div>
      <label>Gear, weapons, and magic items</label>
      <textarea data-field="gear" style="min-height:130px" placeholder="One item per line...">${h(c.gear)}</textarea>
      ${(byId(S.classes, c.classId) || {}).startEquip ? `<div class="callout"><b>Class starting kit:</b> ${h(byId(S.classes, c.classId).startEquip.join('; '))}.
        <button class="btn sm" data-act="fillgear" style="margin-left:8px">Copy into gear list</button></div>` : ''}
    </div>
    <div class="panel"><h2>Languages</h2>
      <div class="cards">${(S.languages || []).map(l => `<button class="card ${(c.languages || []).includes(l) ? 'sel' : ''}" data-act="togglelang" data-val="${h(l)}" style="padding:6px 9px">
        <span class="t" style="font-size:.9rem">${h(l)}</span></button>`).join('')}</div>
    </div>`;
}
function defenseRows(c, d) {
  if (c.systemId === '4e') return d.defenses.map(x => [x.name, x.value + (x.note ? '  (' + x.note + ')' : '')]);
  if (c.systemId === 'pf1') return [['AC', d.ac], ['Touch AC', d.touchAC], ['Flat-footed AC', d.flatFooted], ['Armor check penalty', d.acp], ['CMD', d.cmd]];
  if (c.systemId === 'pf2') return [['AC', d.ac], ['AC with shield raised', d.shieldAc || d.ac], ['Fortitude', d.fort], ['Reflex', d.ref], ['Will', d.will]];
  return [['AC', d.ac + ' (' + d.acNote + ')'], ['Initiative', signed(d.initiative)], ['Passive Perception', d.passivePerception], ['Speed', d.speed + ' ft.']];
}

/* ---------------- step: flavor ---------------- */
function stepFlavor(c) {
  const p = c.personality || {};
  const a = c.appearance || {};
  return `<div class="panel"><h2>Appearance</h2>
      <div class="grid3">
        ${['age', 'height', 'weight', 'eyes', 'hair', 'skin'].map(k =>
    `<div class="field"><label>${k}</label><input data-field="appearance.${k}" value="${h(a[k] || '')}"></div>`).join('')}
      </div></div>
    <div class="panel"><h2>Personality</h2>
      ${[['traits', 'Personality traits'], ['ideals', 'Ideals'], ['bonds', 'Bonds'], ['flaws', 'Flaws']].map(([k, label]) =>
      `<div class="field"><label>${label}</label><textarea data-field="personality.${k}" style="min-height:56px">${h(p[k] || '')}</textarea></div>`).join('')}
    </div>
    <div class="panel"><h2>Backstory</h2>
      <textarea data-field="personality.backstory" style="min-height:180px" placeholder="Where they came from, what they want, who they owe...">${h(p.backstory || '')}</textarea>
    </div>`;
}

/* ---------------- step: review ---------------- */
function stepReview(c) {
  const S = sys(c.systemId);
  const d = derive(c);
  const issues = validate(c);
  const errs = issues.filter(i => i.level === 'error');
  const lin = byId(S.lineages, c.lineageId);
  const cls = byId(S.classes, c.classId);
  return `<div class="panel">
      <h2>Review</h2>
      <p class="note">${h(c.name || 'Unnamed')} — level ${c.level} ${h(lin ? lin.name : '?')} ${h(cls ? cls.name : '?')} (${h(S.name)})</p>
      ${errs.length
      ? `<div class="callout" style="border-color:var(--red)"><b>${errs.length} thing${errs.length > 1 ? 's' : ''} still need attention:</b>
          <ul class="powerlist">${errs.map(i => `<li>${h(i.text)}</li>`).join('')}</ul>
          You can still print the sheet — these are reminders, not locks.</div>`
      : `<div class="callout" style="border-color:var(--green)">No blocking problems found. Ready to play.</div>`}
      <div class="footbar" style="justify-content:flex-start">
        <button class="btn primary" data-act="sheet">Open character sheet</button>
        <button class="btn" data-act="print">Print / save as PDF</button>
        <button class="btn" data-act="export">Export JSON</button>
      </div>
    </div>
    ${d.features.length ? `<div class="panel"><h2>Everything you have</h2>
      <table><thead><tr><th>Lvl</th><th>Feature</th></tr></thead><tbody>
      ${d.features.map(f => `<tr><td class="num">${f.level}</td><td>${h(f.text)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

/* The character sheet and play tracking live in 90-play.js and 91-sheet.js. */

/* ============================================================
   Event handling
   ============================================================ */
function autoAssignPriority(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const prim = cls ? (cls.primary || cls.keyAbility || ['str']) : ['str'];
  const rest = ABIL6.filter(a => !prim.includes(a));
  const order = prim.concat(['con'].filter(a => !prim.includes(a))).concat(rest.filter(a => a !== 'con'));
  return [...new Set(order)];
}

document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const c = cur();
  app.flash = '';

  switch (act) {
    // "Create a character" — start the guided wizard at step one
    case 'create': case 'new': case 'newsys': {
      const sid = el.dataset.sys || '5e';
      const ch = blankCharacter(sid);
      app.roster.push(ch);
      app.currentId = ch.id;
      resetAllPanels();
      app.view = 'build';
      // a named system means the caller already chose one, so skip that step
      app.step = el.dataset.sys ? 1 : 0;
      persist(); render(); return;
    }
    // opening a character shows the character, not the wizard
    case 'open': case 'opensheet': {
      app.currentId = el.dataset.id || app.currentId;
      resetAllPanels();
      app.view = 'sheet';
      render(); return;
    }
    // "Modify character" drops into the wizard where you last left it
    case 'modify': case 'build': {
      if (el.dataset.id && el.dataset.id !== app.currentId) {
        app.currentId = el.dataset.id;
        resetAllPanels();
      }
      const ch = cur();
      if (!ch) return;
      app.view = 'build';
      app.step = clamp(Number(ch.wizardStep) || 1, 0, stepsFor(ch).length - 1);
      render(); return;
    }
    case 'dup': {
      const src = app.roster.find(x => x.id === el.dataset.id);
      if (src) {
        const copy = JSON.parse(JSON.stringify(src));
        copy.id = uid(); copy.name = (src.name || 'Character') + ' (copy)';
        app.roster.push(copy); persist(); render();
      } return;
    }
    case 'del': {
      const src = app.roster.find(x => x.id === el.dataset.id);
      if (src && confirm('Delete ' + (src.name || 'this character') + '? This cannot be undone.')) {
        app.roster = app.roster.filter(x => x.id !== src.id);
        if (app.currentId === src.id) { app.currentId = null; app.view = 'roster'; }
        persist();
        if (isConnected()) storeDelete(src.id);
        render();
      } return;
    }
    case 'home': {
      app.currentId = null;
      app.guest = null;
      app.preview = null;
      app.role = null;
      pruneBlank();
      app.view = 'home'; render(); return;
    }
    case 'roster': {
      // drop a character the user created but never touched
      app.currentId = null;
      app.guest = null;
      app.preview = null;
      pruneBlank();
      app.view = 'roster'; render(); return;
    }
    case 'homeplayer': {
      app.role = 'player';
      app.view = 'roster'; render(); return;
    }
    case 'homedm': {
      app.role = 'dm';
      const dmCamps = campaignList().filter(camp => camp.yourRole === 'dm');
      if (dmCamps.length === 1) { openCampaign(dmCamps[0].id); return; }
      // no campaign yet: show DM landing so they can create one
      campUI.creating = true;
      app.view = 'dm'; render(); return;
    }
    case 'sheet': app.view = 'sheet'; render(); return;
    case 'sheetpanel': app.view = el.dataset.panel; render(); return;
    case 'print': window.print(); return;
    case 'export': doExport(c); return;
    case 'import': doImport(); return;
    case 'nav': app.step = Number(el.dataset.step); rememberStep(c); render(); return;
    case 'next': app.step = clamp(app.step + 1, 0, stepsFor(c).length - 1); rememberStep(c); render(); return;
    case 'prev': app.step = clamp(app.step - 1, 0, stepsFor(c).length - 1); rememberStep(c); render(); return;

    case 'setsys': {
      const sid = el.dataset.sys;
      const untouched = !c.lineageId && !c.classId && !c.backgroundId && !(c.spells || []).length;
      if (sid === c.systemId) return;
      // nothing to lose on an untouched character, so don't nag
      if (!untouched && !confirm('Switch to ' + sys(sid).name + '? Race, class, background, skills, and ability assignments will be cleared.')) return;
      const keep = { id: c.id, name: c.name, player: c.player, level: 1, notes: c.notes, gear: c.gear, gold: c.gold, personality: c.personality, appearance: c.appearance, created: c.created };
      const swapped = blankCharacter(sid);
      Object.assign(swapped, keep);
      swapped.systemId = sid;
      const i = app.roster.findIndex(x => x.id === c.id);
      app.roster[i] = swapped;
      resetAllPanels();
      if (!untouched) app.flash = 'Switched to ' + sys(sid).name + '.';
      persist(); render(); return;
    }
    case 'pick': {
      const f = el.dataset.field, v = el.dataset.val;
      if (c[f] === v && (f === 'lineageSubId' || f === 'subclassId')) c[f] = null;
      else c[f] = v;
      if (f === 'lineageId') { c.lineageSubId = null; c.choiceAsi = []; if (c.boosts) c.boosts.ancestryFree = []; syncGranted(c); }
      if (f === 'classId') {
        c.subclassId = null; c.choices = {};
        const cls = byId(sys(c.systemId).classes, c.classId);
        if (cls && cls.keyAbility) c.keyAbility = cls.keyAbility[0];
        c.skills = []; c.expertise = [];
        c.spells = []; c.prepared = [];   // spell lists are class-specific
        resetAllPanels();
        syncGranted(c);
      }
      if (f === 'backgroundId') syncGranted(c);
      persist(); render(); return;
    }
    case 'method': c.abilityMethod = el.dataset.val; persist(); render(); return;
    case 'pbinc': case 'pbdec': {
      const pb = sys(c.systemId).abilityGen.pointBuy;
      const a = el.dataset.abil;
      c.baseScores[a] = clamp(c.baseScores[a] + (act === 'pbinc' ? 1 : -1), pb.min, pb.max);
      persist(); render(); return;
    }
    case 'pbreset': {
      const pb = sys(c.systemId).abilityGen.pointBuy;
      ABIL6.forEach(a => c.baseScores[a] = pb.min);
      persist(); render(); return;
    }
    case 'pickarray': c.arrayId = el.dataset.val; c.arrayAssign = {}; persist(); render(); return;
    case 'clearassign': c.arrayAssign = {}; c.rollAssign = {}; persist(); render(); return;
    case 'autoarray': {
      const S = sys(c.systemId);
      const arr = (S.abilityGen.arrays || []).find(a => a.id === c.arrayId) || S.abilityGen.arrays[0];
      const order = autoAssignPriority(c);
      const idxs = arr.scores.map((v, i) => i).sort((x, y) => arr.scores[y] - arr.scores[x]);
      c.arrayAssign = {};
      order.forEach((a, i) => { if (idxs[i] !== undefined) c.arrayAssign[a] = idxs[i]; });
      persist(); render(); return;
    }
    case 'autoroll': {
      const order = autoAssignPriority(c);
      const idxs = c.rolledPool.map((v, i) => i).sort((x, y) => c.rolledPool[y] - c.rolledPool[x]);
      c.rollAssign = {};
      order.forEach((a, i) => { if (idxs[i] !== undefined) c.rollAssign[a] = idxs[i]; });
      persist(); render(); return;
    }
    case 'rollscores': case 'rollscores7': {
      const S = sys(c.systemId);
      const method = (S.abilityGen.rolls || []).find(r => r.id === (c.rollMethod || S.abilityGen.rolls[0].id)) || S.abilityGen.rolls[0];
      const n = act === 'rollscores7' ? 7 : 6;
      const res = Array.from({ length: n }, () => method.fn());
      res.sort((a, b) => b.total - a.total);
      const keep = res.slice(0, 6);
      c.rolledPool = keep.map(r => r.total);
      c.rollDetail = keep.map(r => '(' + r.dice.join(',') + (r.dropped ? ' drop ' + r.dropped : '') + ')');
      c.rollAssign = {};
      app.flash = 'Rolled ' + c.rolledPool.join(', ') + ' — total ' + sum(c.rolledPool) + '.';
      persist(); render(); return;
    }
    case 'autoboost': {
      const order = autoAssignPriority(c);
      const anc = byId(SYS_PF2.lineages, c.lineageId);
      const already = [].concat(anc ? (anc.boosts || []) : [], (byId(SYS_PF2.backgrounds, c.backgroundId) || {}).boosts || [], [c.keyAbility]).filter(Boolean);
      const free = order.filter(a => !already.includes(a)).slice(0, 4);
      while (free.length < 4) { const extra = ABIL6.find(a => !free.includes(a)); if (!extra) break; free.push(extra); }
      c.boosts.free = free;
      if (anc && anc.freeBoosts) c.boosts.ancestryFree = order.filter(a => a !== anc.flaw).slice(0, anc.freeBoosts);
      persist(); render(); return;
    }
    case 'toggleskill': {
      const id = el.dataset.id;
      c.skills = c.skills || [];
      if (c.skills.includes(id)) { c.skills = c.skills.filter(x => x !== id); c.expertise = (c.expertise || []).filter(x => x !== id); }
      else c.skills.push(id);
      persist(); render(); return;
    }
    case 'toggleexp': {
      const id = el.dataset.id;
      c.expertise = c.expertise || [];
      if (c.expertise.includes(id)) c.expertise = c.expertise.filter(x => x !== id);
      else c.expertise.push(id);
      persist(); render(); return;
    }
    case 'clearranks': c.ranks = {}; persist(); render(); return;
    case 'clearprofs': c.profs = {}; syncGranted(c); persist(); render(); return;
    case 'toggleshield': c.shield = !c.shield; persist(); render(); return;
    case 'togglelang': {
      const v = el.dataset.val;
      c.languages = c.languages || [];
      c.languages = c.languages.includes(v) ? c.languages.filter(x => x !== v) : c.languages.concat(v);
      persist(); render(); return;
    }
    case 'fillgear': {
      const cls = byId(sys(c.systemId).classes, c.classId);
      const bg = byId(sys(c.systemId).backgrounds, c.backgroundId);
      const lines = [].concat(cls ? cls.startEquip || [] : [], bg ? bg.equip || [] : []);
      c.gear = (c.gear ? c.gear + '\n' : '') + lines.join('\n');
      persist(); render(); return;
    }
    case 'levelup': {
      const was = c.level;
      app.levelUpLog = levelUp(c, c.level + 1);
      if (c.level > was) {
        autoJournal(c, 'level', 'Reached level ' + c.level,
          'Went up from level ' + was + '.');
      }
      persist(); render(); return;
    }
    case 'rollhp': {
      const cls = byId(sys(c.systemId).classes, c.classId);
      const hd = cls ? cls.hitDie : 8;
      c.hpRolls = Array.from({ length: Math.max(0, c.level - 1) }, () => d(hd));
      app.flash = 'Rolled ' + c.hpRolls.join(', ') + ' on d' + hd + '.';
      persist(); render(); return;
    }
    case 'clearhp': c.hpRolls = []; persist(); render(); return;
  }
});

/* inputs */
document.addEventListener('input', onFieldChange);
document.addEventListener('change', onFieldChange);
function onFieldChange(ev) {
  const el = ev.target;
  const c = cur();
  if (!c) return;

  if (el.dataset.act === 'setrank') {
    const id = el.dataset.id;
    c.ranks = c.ranks || {};
    c.ranks[id] = clamp(Number(el.value) || 0, 0, c.level);
    persist();
    if (ev.type === 'change') render(); else refreshRail();
    return;
  }
  if (el.dataset.act === 'setprof') {
    c.profs = c.profs || {};
    c.profs[el.dataset.id] = el.value;
    persist(); render(); return;
  }
  const f = el.dataset.field;
  if (!f) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num) v = v === '' ? null : Number(v);
  if (f === 'level') {
    v = clamp(Number(v) || 1, 1, sys(c.systemId).maxLevel);
    if (c.hpMethod === 'roll') {
      const cls = byId(sys(c.systemId).classes, c.classId);
      const hd = cls ? cls.hitDie : 8;
      while (c.hpRolls.length < v - 1) c.hpRolls.push(d(hd));
      c.hpRolls = c.hpRolls.slice(0, Math.max(0, v - 1));
    }
  }
  setPath(c, f, v);
  if (f === 'armor' || f.startsWith('boosts') || f.startsWith('choiceAsi') || f.startsWith('levelAsi')
    || f === 'keyAbility' || f === 'level' || f === 'hpMethod' || f === 'abilityMethod'
    || f.startsWith('arrayAssign') || f.startsWith('rollAssign') || f === 'favoredClassBonus'
    || f === 'bgSkillBonus' || f === 'pointBudget' || f.startsWith('shield')) {
    persist();
    if (ev.type === 'change') { render(); return; }
  }
  persist();
  refreshRail();
}
function refreshRail() {
  const c = cur();
  if (!c || app.view !== 'build') return;
  const railEl = document.querySelector('.rail');
  if (railEl) railEl.innerHTML = rail(c);
}

/* granted skills sync */
function syncGranted(c) {
  const S = sys(c.systemId);
  const b = skillBudget(c);
  if (c.systemId === 'pf2') {
    c.profs = c.profs || {};
    b.granted.forEach(id => { if (!c.profs[id] || c.profs[id] === 'untrained') c.profs[id] = 'trained'; });
    const cls = byId(S.classes, c.classId);
    if (cls && cls.grantSkills) cls.grantSkills.forEach(id => { if (!c.profs[id] || c.profs[id] === 'untrained') c.profs[id] = 'trained'; });
    return;
  }
  if (c.systemId === 'pf1') return;
  c.skills = [...new Set((c.skills || []).concat(b.granted))];
}

/* import / export */
function doExport(c) {
  if (!c) return;
  const data = JSON.stringify(c, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safe = (c.name || 'character').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  a.download = safe + '-' + c.systemId + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function doImport() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const file = inp.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(fr.result);
        const list = Array.isArray(obj) ? obj : [obj];
        let added = 0;
        list.forEach(o => {
          if (!o || !o.systemId || !SYSTEMS[o.systemId]) return;
          const fresh = newCharacter(o.systemId);
          const merged = Object.assign(fresh, o);
          merged.id = uid();
          if (!merged.boosts) merged.boosts = { ancestryFree: [], free: [], levels: {} };
          app.roster.push(merged); added++;
        });
        app.flash = added ? 'Imported ' + added + ' character' + (added > 1 ? 's' : '') + '.' : 'Nothing importable found in that file.';
        if (!added) alert('That file did not contain a recognisable character (needs a systemId of 5e, 4e, pf1, or pf2).');
        persist(); render();
      } catch (e) { alert('Could not read that file: ' + e.message); }
    };
    fr.readAsText(file);
  };
  inp.click();
}

/* boot */
async function boot() {
  // Decide where the data lives before drawing anything: local file, or a
  // server on the LAN. Either way this resolves; it never throws.
  await storeInit();

  if (isConnected() && !signedIn()) {
    app.view = 'signin';
    render();
    return;
  }
  app.roster = loadRoster();
  app.roster.forEach(migrateCharacter);
  // discard anything created but never filled in (e.g. the tab was closed mid-wizard)
  pruneBlank();
  render();
  // and from here on, keep up with whatever anyone else changes
  if (typeof storeWatch === 'function') storeWatch();
}

window.addEventListener('DOMContentLoaded', function () {
  // paint the shell straight away so a slow ping is not a blank screen
  boot();
});
