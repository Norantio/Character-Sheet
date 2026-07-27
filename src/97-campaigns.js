/* ============================================================
   Campaigns — the home page section, and the campaign page.

   Works in both modes. Connected: a shared table, and the DM sees the
   party at a glance. Local: you are the DM of your own game, which is
   still useful for keeping a character's history straight.
   ============================================================ */

const campUI = {
  id: null,             // the campaign being looked at
  data: null,           // { campaign, characters, party, players }
  loading: false,
  creating: false,
  editing: false,
  attaching: false,
  form: { name: '', systemId: '5e', blurb: '' },
  edit: { name: '', blurb: '' },
  error: ''
};

function resetCampUI() {
  campUI.creating = false;
  campUI.editing = false;
  campUI.attaching = false;
  campUI.error = '';
  campUI.form = { name: '', systemId: SYSTEM_ORDER[0], blurb: '' };
}

/* ---------------- the party table ---------------- */
/* A campaign is locked to one system, so the columns can be the ones that
   system actually uses rather than a lowest common denominator. */
function partyColumns(systemId) {
  const load = c => {
    try {
      const b = loadBand(c);
      return b.load + ' ' + (b.limits.unit === 'Bulk' ? 'Bulk' : 'lb') +
        (b.over ? ' — over!' : '');
    } catch (e) { return '—'; }
  };
  const hp = (c, d) => {
    const max = d.hp;
    const cur = (c.play && typeof c.play.hp === 'number') ? c.play.hp : max;
    return cur + ' / ' + max;
  };
  const common = [
    { k: 'HP', f: hp, wide: true },
    { k: 'AC', f: (c, d) => d.ac }
  ];
  if (systemId === '5e') {
    return common.concat([
      { k: 'Passive perc.', f: (c, d) => d.passivePerception },
      { k: 'Saves', f: (c, d) => (d.saves || []).filter(s => s.prof).map(s => s.name.slice(0, 3)).join(' ') || '—' },
      { k: 'Spell DC', f: (c, d) => (d.spell && d.spell.dc) || '—' },
      { k: 'Load', f: load }
    ]);
  }
  if (systemId === '4e') {
    return common.concat([
      { k: 'Fort', f: (c, d) => d.fort },
      { k: 'Ref', f: (c, d) => d.ref },
      { k: 'Will', f: (c, d) => d.will },
      { k: 'Bloodied', f: (c, d) => d.bloodied },
      { k: 'Surges', f: (c, d) => surgesLeft(c, d) }
    ]);
  }
  if (systemId === 'pf1') {
    return common.concat([
      { k: 'Touch / FF', f: (c, d) => d.touchAC + ' / ' + d.flatFooted },
      { k: 'Fort / Ref / Will', f: (c, d) => signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will), wide: true },
      { k: 'CMD', f: (c, d) => d.cmd },
      { k: 'Load', f: load }
    ]);
  }
  return common.concat([
    { k: 'Class DC', f: (c, d) => d.classDC },
    { k: 'Perception', f: (c, d) => signed(d.perception) },
    { k: 'Fort / Ref / Will', f: (c, d) => signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will), wide: true },
    { k: 'Bulk', f: load }
  ]);
}

function surgesLeft(c, d) {
  const used = (c.play && c.play.used && c.play.used.surges) || 0;
  return Math.max(0, (d.surges || 0) - used) + ' / ' + (d.surges || 0);
}

function whoPlays(party, characterId) {
  const p = party.find(x => x.characterId === characterId);
  return p ? p.playerName : 'someone';
}

function partyTable(data) {
  const camp = data.campaign;
  const chars = data.characters || [];
  if (!chars.length) {
    return `<div class="empty">
      <p>Nobody has brought a character yet.</p>
      <p>Players attach their own characters from their home page, or from the
      campaign box on the character sheet.</p></div>`;
  }
  const cols = partyColumns(camp.systemId);
  const rows = chars.map(c => {
    let d = null;
    try { d = derive(c); } catch (e) { }
    const S = sys(c.systemId);
    const cls = byId(S.classes, c.classId);
    const lin = byId(S.lineages, c.lineageId);
    const cells = d
      ? cols.map(col => `<td${col.wide ? ' class="wide"' : ''}>${h(String(col.f(c, d)))}</td>`).join('')
      : `<td colspan="${cols.length}" class="dim">could not work this sheet out</td>`;
    return `<tr class="clickable" data-act="campopen" data-id="${h(c.id)}" tabindex="0"
        title="Open ${h(c.name || 'this sheet')}">
      <td class="who"><b>${h(c.name || 'Unnamed')}</b>
        <span class="dim">${h(whoPlays(data.party || [], c.id))}</span></td>
      <td>${h(lin ? lin.name : '—')} ${h(cls ? cls.name : '—')}
        <span class="dim">level ${c.level}</span></td>
      ${cells}
    </tr>`;
  }).join('');

  const dm = camp.yourRole === 'dm';
  return `<div class="partywrap">
    <table class="party">
      <thead><tr>
        <th>Character</th><th>Who they are</th>
        ${cols.map(col => `<th${col.wide ? ' class="wide"' : ''}>${h(col.k)}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="note">Click any row to read that sheet. HP is what the player has
  recorded, so it is only as current as their last tap.
  ${dm ? 'You see everything except what a player has kept entirely to themselves.'
      : 'You see what each player shares with the table — the DM sees a little more.'}</p>`;
}

/* What a player sees: who else is at the table, and nothing off their sheets. */
function partyRoster(data) {
  const party = (data.party || []).filter(p => p.ownerProfileId !== myId());
  if (!party.length) return '<div class="empty">You are the only one here so far.</div>';
  return `<div class="roster">${party.map(p => {
    const S = sys(p.systemId);
    const cls = byId(S.classes, p.classId);
    const lin = byId(S.lineages, p.lineageId);
    return `<div class="rcard">
      <div class="rcard-head"><h3>${h(p.name || 'Unnamed')}</h3>
        <span class="tag">level ${p.level}</span></div>
      <div class="meta">${h(lin ? lin.name : '—')} ${h(cls ? cls.name : '—')}</div>
      <div class="meta dim">played by ${h(p.playerName)}</div>
    </div>`;
  }).join('')}</div>
  <p class="note">Players see each other's names and classes. Reading somebody
  else's sheet is the DM's job.</p>`;
}

/* ---------------- the campaign page ---------------- */
function viewCampaign() {
  if (campUI.loading || !campUI.data) {
    return `<div class="homewrap"><div class="empty">Loading the campaign…</div></div>`;
  }
  const data = campUI.data;
  const camp = data.campaign;
  const dm = camp.yourRole === 'dm';
  const S = sys(camp.systemId);
  const mine = (loadRoster() || []).filter(c => c.campaignId === camp.id);

  return `<div class="pagebar noprint">
      <button class="btn" data-act="roster">← Home</button>
      <div class="pagebar-title">
        <b>${h(camp.name)}</b>
        <span>${h(SYSTEM_SHORT[camp.systemId] || S.name)} · ${dm ? 'you are the DM' : 'DM ' + h(camp.dmName)}
          · ${camp.memberCount} character${camp.memberCount === 1 ? '' : 's'}</span>
      </div>
      <div class="pagebar-acts">
        ${dm ? `<button class="btn sm" data-act="campedit">${campUI.editing ? 'Cancel' : 'Edit'}</button>` : ''}
        ${dm ? `<button class="btn sm danger" data-act="campdel">Close the campaign</button>` : ''}
      </div>
    </div>
    <div class="homewrap">
      ${campUI.error ? `<div class="who-error">${h(campUI.error)}</div>` : ''}
      ${campUI.editing ? campEditForm(camp) : (camp.blurb
      ? `<div class="panel campblurb">${h(camp.blurb)}</div>` : '')}

      <div class="panel">
        <h2>${dm ? 'The party' : 'Who else is here'}
          <span class="hint">${camp.memberCount} at the table</span></h2>
        ${camp.yourRole === 'none'
      ? `<div class="empty">
             <p style="font-size:1.05rem;margin-bottom:4px">You are not at this table yet.</p>
             <p>${h(camp.dmName)} is running it, with ${camp.memberCount}
             character${camp.memberCount === 1 ? '' : 's'} so far. Bring one of your own
             and you will see who else is here.</p>
           </div>`
      // the DM always gets the table, even when it is empty, because the empty
      // state is where it says how players join
      : (dm || (data.characters || []).length) ? partyTable(data) : partyRoster(data)}
      </div>

      <div class="panel">
        <h2>Your characters here
          <span class="hint">${mine.length ? mine.length + ' attached' : 'none yet'}</span></h2>
        ${mine.length ? `<div class="roster">${mine.map(c => campMineCard(c, camp)).join('')}</div>` : ''}
        ${campAttachPanel(camp)}
      </div>
    </div>`;
}

function campMineCard(c, camp) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  return `<div class="rcard">
    <div class="rcard-head"><h3>${h(c.name || 'Unnamed')}</h3>
      <span class="tag">level ${c.level}</span></div>
    <div class="meta">${h(cls ? cls.name : '—')}</div>
    <div class="acts">
      <button class="btn sm primary" data-act="open" data-id="${h(c.id)}">Open</button>
      <button class="btn sm" data-act="campleave" data-cid="${h(camp.id)}" data-id="${h(c.id)}">Take out</button>
    </div>
  </div>`;
}

/* Only characters of the right system can be offered, and the reason has to be
   visible — otherwise a missing character looks like a bug. */
function campAttachPanel(camp) {
  const roster = loadRoster() || [];
  const free = roster.filter(c => c.systemId === camp.systemId && !c.campaignId);
  const wrongSystem = roster.filter(c => c.systemId !== camp.systemId && !c.campaignId);
  const elsewhere = roster.filter(c => c.campaignId && c.campaignId !== camp.id);

  if (!campUI.attaching) {
    return `<div class="homeactions" style="justify-content:flex-start">
      <button class="btn" data-act="campattach">Bring a character to this table</button>
    </div>`;
  }
  return `<div class="attachpanel">
    ${free.length ? `<div class="attachlist">${free.map(c => {
    const cls = byId(sys(c.systemId).classes, c.classId);
    return `<button class="btn" data-act="campjoin" data-cid="${h(camp.id)}" data-id="${h(c.id)}">
        ${h(c.name || 'Unnamed')} <span class="dim">level ${c.level} ${h(cls ? cls.name : '')}</span>
      </button>`;
  }).join('')}</div>`
      : `<div class="empty">You have no spare ${h(SYSTEM_SHORT[camp.systemId] || '')} characters.</div>`}
    ${wrongSystem.length ? `<p class="note">${wrongSystem.length} of your
      character${wrongSystem.length === 1 ? ' is' : 's are'} for a different game, so
      ${wrongSystem.length === 1 ? 'it cannot' : 'they cannot'} join this table.</p>` : ''}
    ${elsewhere.length ? `<p class="note">${elsewhere.length}
      ${elsewhere.length === 1 ? 'is' : 'are'} already in another campaign. Take
      ${elsewhere.length === 1 ? 'them' : 'them'} out of it first.</p>` : ''}
    <div class="homeactions" style="justify-content:flex-start">
      <button class="btn ghost" data-act="campattach">Done</button>
    </div>
  </div>`;
}

function campEditForm(camp) {
  return `<div class="panel">
    <div class="field"><label>Campaign name</label>
      <input data-campf="name" value="${h(campUI.edit.name)}"></div>
    <div class="field"><label>What is this game about? (optional)</label>
      <textarea data-campf="blurb" rows="3">${h(campUI.edit.blurb)}</textarea></div>
    <div class="homeactions" style="justify-content:flex-start">
      <button class="btn primary" data-act="campsave">Save</button>
      <button class="btn ghost" data-act="campedit">Cancel</button>
    </div>
  </div>`;
}

/* ---------------- the home page section ---------------- */
function campaignsPanel() {
  const mine = campaignList();
  const others = campaignOthers();

  const card = (camp, joinable) => {
    const S = sys(camp.systemId);
    const role = camp.yourRole === 'dm' ? 'You are the DM'
      : camp.yourRole === 'player' ? 'You are playing' : 'DM ' + camp.dmName;
    return `<div class="rcard ${joinable ? '' : 'clickable'}"
        ${joinable ? '' : `data-act="campgo" data-id="${h(camp.id)}" role="button" tabindex="0"`}>
      <div class="rcard-head"><h3>${h(camp.name)}</h3>
        <span class="tag">${h(SYSTEM_SHORT[camp.systemId] || S.name)}</span></div>
      <div class="meta">${h(role)}</div>
      <div class="meta dim">${camp.memberCount} character${camp.memberCount === 1 ? '' : 's'}${camp.blurb ? ' · ' + h(camp.blurb.slice(0, 60)) : ''}</div>
      ${joinable
        ? `<div class="acts"><button class="btn sm" data-act="campgo" data-id="${h(camp.id)}">Have a look</button></div>`
        : `<div class="acts"><button class="btn sm primary" data-act="campgo" data-id="${h(camp.id)}">Open</button></div>`}
    </div>`;
  };

  return `<div class="panel">
    <h2>Campaigns <span class="hint">${mine.length ? mine.length + (mine.length === 1 ? ' yours' : ' yours') : 'none yet'}</span></h2>
    ${mine.length ? `<div class="roster">${mine.map(c => card(c, false)).join('')}</div>`
      : `<div class="empty">
          <p style="font-size:1.05rem;margin-bottom:4px">No campaigns yet.</p>
          <p>${isConnected()
        ? 'Start one and you are its DM — everyone else at the table can then bring a character to it.'
        : 'A campaign keeps a set of characters together and records where each one has played.'}</p>
        </div>`}
    ${others.length ? `<h2 style="margin-top:18px">Other tables on this server
        <span class="hint">${others.length}</span></h2>
      <div class="roster">${others.map(c => card(c, true)).join('')}</div>` : ''}
    ${campUI.creating ? campCreateForm() : `<div class="homeactions" style="justify-content:flex-start">
      <button class="btn primary" data-act="campnew">Start a campaign</button>
    </div>`}
  </div>`;
}

function campCreateForm() {
  return `<div class="attachpanel">
    ${campUI.error ? `<div class="who-error">${h(campUI.error)}</div>` : ''}
    <div class="field"><label>What is the campaign called?</label>
      <input data-campf="name" value="${h(campUI.form.name)}" placeholder="Tuesday night"></div>
    <div class="field"><label>Which game?</label>
      <select data-campf="systemId">
        ${SYSTEM_ORDER.map(id => `<option value="${id}" ${campUI.form.systemId === id ? 'selected' : ''}>
          ${h(SYSTEMS[id].name)}</option>`).join('')}
      </select></div>
    <p class="note">A campaign is fixed to one game. Characters from a different
    system cannot join, because none of the numbers would line up.</p>
    <div class="field"><label>What is it about? (optional)</label>
      <textarea data-campf="blurb" rows="2" placeholder="Sunless lands, a missing heir, too many owlbears"></textarea></div>
    <div class="homeactions" style="justify-content:flex-start">
      <button class="btn primary" data-act="campcreate">Create it</button>
      <button class="btn ghost" data-act="campnew">Cancel</button>
    </div>
  </div>`;
}

/* ============================================================
   The campaign box on the character sheet: where this character plays now,
   and everywhere they have played before.
   ============================================================ */
function campaignBlock(c) {
  const guest = sheetReadOnly();
  const here = c.campaignId ? campaignById(c.campaignId) : null;
  const history = (c.campaignHistory || []).filter(e => e.leftAt);
  // nothing to say, and nothing they could do about it
  if (!here && !history.length && (guest || !campaignList().length)) return '';

  const now = here
    ? `<div class="kv"><span>Playing in</span>
        <b class="camplink" data-act="campgo" data-id="${h(here.id)}" role="button" tabindex="0">${h(here.name)}</b></div>
       <div class="kv"><span>DM</span><b>${h(here.yourRole === 'dm' ? 'you' : here.dmName)}</b></div>`
    : `<div class="kv"><span>Playing in</span><b class="dim">not at a table</b></div>`;

  const past = history.length
    ? `<h5>Previously</h5>
       <ul class="camphist">${history.slice().reverse().map(e => `<li>
         <b>${h(e.name)}</b>
         <span class="dim">${h(shortDate(e.joinedAt))} – ${h(shortDate(e.leftAt))}</span>
       </li>`).join('')}</ul>`
    : '';

  let acts = '';
  if (!guest) {
    const joinable = campaignList().filter(cm =>
      cm.systemId === c.systemId && cm.id !== c.campaignId);
    acts = `<div class="campacts noprint">
      ${here ? `<button class="btn sm" data-act="campleave" data-cid="${h(here.id)}" data-id="${h(c.id)}">Leave this campaign</button>` : ''}
      ${!here && joinable.length ? joinable.map(cm =>
      `<button class="btn sm primary" data-act="campjoin" data-cid="${h(cm.id)}" data-id="${h(c.id)}">Join ${h(cm.name)}</button>`).join('') : ''}
      ${!here && !joinable.length ? '<span class="note">No campaign for this game to join yet.</span>' : ''}
    </div>`;
  }

  return `<div class="cs-box"><h4>Campaign</h4>${now}${past}${acts}</div>`;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ---------------- events ---------------- */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!/^camp/.test(act)) return;

  switch (act) {
    case 'campnew':
      campUI.creating = !campUI.creating;
      campUI.error = '';
      if (campUI.creating) campUI.form = { name: '', systemId: SYSTEM_ORDER[0], blurb: '' };
      render(); return;
    case 'campcreate': doCreateCampaign(); return;
    case 'campgo': openCampaign(el.dataset.id); return;
    case 'campattach':
      campUI.attaching = !campUI.attaching; campUI.error = ''; render(); return;
    case 'campjoin': doMembership(el.dataset.cid, el.dataset.id, 'join'); return;
    case 'campleave': doMembership(el.dataset.cid, el.dataset.id, 'leave'); return;
    case 'campedit': {
      campUI.editing = !campUI.editing;
      const camp = campUI.data && campUI.data.campaign;
      if (campUI.editing && camp) campUI.edit = { name: camp.name, blurb: camp.blurb || '' };
      render(); return;
    }
    case 'campsave': doSaveCampaign(); return;
    case 'campdel': doDeleteCampaign(); return;
    case 'campopen': {
      // the DM reading a party member's sheet
      const c = (campUI.data && campUI.data.characters || []).find(x => x.id === el.dataset.id);
      if (!c) return;
      app.guest = c;
      app.currentId = c.id;
      app.view = 'sheet';
      resetAllPanels();
      render(); return;
    }
  }
});

document.addEventListener('input', function (ev) {
  const t = ev.target;
  if (!t.dataset || !t.dataset.campf) return;
  const f = t.dataset.campf;
  if (campUI.editing) campUI.edit[f] = t.value;
  else campUI.form[f] = t.value;
});
document.addEventListener('change', function (ev) {
  const t = ev.target;
  if (t.dataset && t.dataset.campf === 'systemId') { campUI.form.systemId = t.value; render(); }
});

async function openCampaign(id) {
  campUI.id = id;
  campUI.data = null;
  campUI.loading = true;
  campUI.error = '';
  resetCampUI();
  app.view = 'campaign';
  app.guest = null;
  render();
  try {
    campUI.data = await storeCampaign(id);
  } catch (e) {
    campUI.error = 'Could not open that campaign: ' + e.message;
  }
  campUI.loading = false;
  render();
}

async function refreshCampaign() {
  if (!campUI.id) return;
  try { campUI.data = await storeCampaign(campUI.id); } catch (e) { /* keep what we have */ }
}

async function doCreateCampaign() {
  const name = String(campUI.form.name || '').trim();
  if (!name) { campUI.error = 'Give the campaign a name first.'; render(); return; }
  try {
    const camp = await storeCreateCampaign(name, campUI.form.systemId, campUI.form.blurb);
    campUI.creating = false;
    campUI.error = '';
    openCampaign(camp.id);
  } catch (e) {
    campUI.error = 'Could not create it: ' + e.message;
    render();
  }
}

async function doSaveCampaign() {
  try {
    await storeEditCampaign(campUI.id, { name: campUI.edit.name, blurb: campUI.edit.blurb });
    campUI.editing = false;
    await refreshCampaign();
  } catch (e) { campUI.error = 'Could not save that: ' + e.message; }
  render();
}

async function doDeleteCampaign() {
  const camp = campUI.data && campUI.data.campaign;
  if (!camp) return;
  if (!confirm('Close "' + camp.name + '"? Everyone\'s characters stay, and keep it in their history.')) return;
  try {
    await storeDeleteCampaign(camp.id);
    app.roster = loadRoster();
    app.view = 'roster';
    campUI.id = null; campUI.data = null;
  } catch (e) { campUI.error = 'Could not close it: ' + e.message; }
  render();
}

async function doMembership(campaignId, characterId, action) {
  campUI.error = '';
  try {
    await storeSetMembership(campaignId, characterId, action);
    app.roster = loadRoster();
    await refreshCampaign();
    campUI.attaching = false;
  } catch (e) {
    campUI.error = e.message;
  }
  render();
}
