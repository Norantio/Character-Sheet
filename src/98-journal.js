/* ============================================================
   The journal — what this character has done, and who may read it.

   Entries are part of the character, so they work the same standalone and
   connected. Each carries a visibility: the table, the DM, or just you.
   New entries start as just you. Some entries write themselves — joining a
   campaign, leaving one, going up a level.
   ============================================================ */

const journalUI = {
  adding: false,
  editing: null,        // entry id
  form: { date: '', title: '', text: '', visibility: 'private' },
  limit: 8,
  error: ''
};

/* Plain words rather than jargon: these are read at a table, not in a config file. */
const VIS_LABEL = { party: 'the table', dm: 'the DM', private: 'just me' };
const VIS_TITLE = {
  party: 'Everyone in the campaign can read this, the DM included.',
  dm: 'The DM can read this. The other players cannot.',
  private: 'Only you can read this. Not even the DM.'
};
const VIS_CYCLE = { private: 'dm', dm: 'party', party: 'private' };
const VIS_ORDER = ['party', 'dm', 'private'];

function resetJournalUI() {
  journalUI.adding = false;
  journalUI.editing = null;
  journalUI.limit = 8;
  journalUI.error = '';
  journalUI.form = { date: today(), title: '', text: '', visibility: 'private' };
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function journalOf(c) {
  return Array.isArray(c.journal) ? c.journal : (c.journal = []);
}

/* Newest first, but entries with no date sink to the bottom rather than
   pretending to be from the year zero. */
function journalSorted(c) {
  return journalOf(c).slice().sort((a, b) => {
    const da = (a && a.date) || '', dbb = (b && b.date) || '';
    if (da && dbb && da !== dbb) return da < dbb ? 1 : -1;
    if (da && !dbb) return -1;
    if (!da && dbb) return 1;
    return 0;
  });
}

function visOf(e) {
  return VIS_ORDER.includes(e && e.visibility) ? e.visibility : 'private';
}

/* ---------------- the block on the sheet ---------------- */
function journalBlock(c) {
  const guest = sheetReadOnly();
  const all = journalSorted(c);
  // nothing written and nobody who could write it: say nothing at all
  if (guest && !all.length) return '';

  const shown = all.slice(0, journalUI.limit);
  const more = all.length - shown.length;

  return `<div class="cs-journal">
    <div class="cs-res-head">
      <h4>Journal</h4>
      <span class="resnote">${all.length
      ? all.length + ' entr' + (all.length === 1 ? 'y' : 'ies')
      : 'nothing written down yet'}</span>
      ${guest ? '' : `<button class="btn sm primary noprint" data-act="jadd">
        ${journalUI.adding ? 'Cancel' : 'Add an entry'}</button>`}
    </div>
    ${journalUI.error ? `<div class="who-error">${h(journalUI.error)}</div>` : ''}
    ${!guest && journalUI.adding ? journalForm(c, null) : ''}
    ${all.length
      ? `<ol class="jlist">${shown.map(e => journalEntry(c, e, guest)).join('')}</ol>
         ${more > 0 ? `<div class="jmore noprint">
           <button class="btn sm" data-act="jmore">Show ${more} older entr${more === 1 ? 'y' : 'ies'}</button>
         </div>` : ''}`
      : guest ? '' : `<div class="empty">
          <p>Nothing written down yet.</p>
          <p>Sessions, decisions, people you have met, promises you have made.
          Joining a campaign and going up a level write themselves.</p>
        </div>`}
    ${guest
      ? '<p class="note">Entries this player has kept to themselves are not shown here, and are not sent to you.</p>'
      : all.length ? `<p class="note">Each entry says who can read it: <b>the table</b>,
        <b>the DM</b>, or <b>just me</b>. Tap that to change it. New entries start as
        just you.${isConnected() ? '' : ' On your own, this is a note to yourself rather than a lock.'}</p>` : ''}
  </div>`;
}

function journalEntry(c, e, guest) {
  const vis = visOf(e);
  const editing = journalUI.editing === e.id;
  if (editing && !guest) return `<li class="jentry editing">${journalForm(c, e)}</li>`;

  return `<li class="jentry${e.auto ? ' auto' : ''}">
    <div class="jhead">
      <span class="jdate">${h(prettyDate(e.date))}</span>
      <b class="jtitle">${h(e.title || 'Untitled')}</b>
      ${e.auto
      ? `<span class="jvis fixed" title="Written automatically, and shared with the table.">${h(VIS_LABEL.party)}</span>
         <span class="jauto">automatic</span>`
      : guest
        ? `<span class="jvis fixed">${h(VIS_LABEL[vis])}</span>`
        : `<button class="jvis v-${vis} noprint" data-act="jvis" data-id="${h(e.id)}"
            title="${h(VIS_TITLE[vis])} Tap to change.">${h(VIS_LABEL[vis])}</button>`}
      ${guest || e.auto ? '' : `<span class="jacts noprint">
        <button class="btn sm ghost" data-act="jedit" data-id="${h(e.id)}">Edit</button>
        <button class="btn sm danger" data-act="jdel" data-id="${h(e.id)}">Delete</button>
      </span>`}
    </div>
    ${e.text ? `<div class="jtext">${paraHtml(e.text)}</div>` : ''}
  </li>`;
}

/* Keep the player's paragraph breaks without letting any markup through. */
function paraHtml(text) {
  return String(text).split(/\n{2,}/).map(p =>
    '<p>' + h(p).replace(/\n/g, '<br>') + '</p>').join('');
}

function prettyDate(iso) {
  if (!iso) return 'no date';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function journalForm(c, entry) {
  const f = entry ? {
    date: entry.date || '', title: entry.title || '',
    text: entry.text || '', visibility: visOf(entry)
  } : journalUI.form;
  const idAttr = entry ? ` data-id="${h(entry.id)}"` : '';
  return `<div class="jform noprint">
    <div class="jform-row">
      <div class="field"><label>Date</label>
        <input type="date" data-jf="date" value="${h(f.date)}"></div>
      <div class="field grow"><label>Title</label>
        <input data-jf="title" value="${h(f.title)}" placeholder="The bridge at Kellhorn"></div>
      <div class="field"><label>Who can read it</label>
        <select data-jf="visibility">
          ${VIS_ORDER.map(v => `<option value="${v}" ${f.visibility === v ? 'selected' : ''}
            >${h(VIS_LABEL[v])}</option>`).join('')}
        </select></div>
    </div>
    <div class="field"><label>What happened</label>
      <textarea data-jf="text" rows="4" placeholder="Write as much or as little as you like.">${h(f.text)}</textarea></div>
    <div class="jform-acts">
      <button class="btn primary" data-act="jsave"${idAttr}>${entry ? 'Save changes' : 'Add the entry'}</button>
      <button class="btn ghost" data-act="jcancel">Cancel</button>
    </div>
  </div>`;
}

/* ---------------- entries that write themselves ---------------- */
/* The server writes the joining and leaving ones, since it owns membership.
   Levelling up happens here, so this one does too. */
function autoJournal(c, kind, title, text) {
  journalOf(c).push({
    id: uid(),
    date: today(),
    title: title,
    text: text || '',
    tags: [],
    visibility: 'party',
    auto: kind
  });
}

/* ---------------- events ---------------- */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!/^j(add|save|cancel|edit|del|vis|more)$/.test(act)) return;
  const c = cur();
  if (!c) return;

  // nothing in here may touch somebody else's sheet, or a preview of your own
  if (readingSomeoneElse()) {
    app.flash = 'This is somebody else\'s journal, so it cannot be changed here.';
    render(); return;
  }
  if (app.preview) {
    app.flash = 'Go back to your own view to change your journal.';
    render(); return;
  }

  switch (act) {
    case 'jadd':
      journalUI.adding = !journalUI.adding;
      journalUI.editing = null;
      journalUI.error = '';
      if (journalUI.adding) journalUI.form = { date: today(), title: '', text: '', visibility: 'private' };
      render(); return;

    case 'jcancel':
      journalUI.adding = false;
      journalUI.editing = null;
      journalUI.error = '';
      render(); return;

    case 'jedit':
      journalUI.editing = el.dataset.id;
      journalUI.adding = false;
      journalUI.error = '';
      // the form is seeded from the entry itself, so it opens with what is there
      journalUI.form = null;
      render(); return;

    case 'jsave': {
      const id = el.dataset.id;
      const src = journalUI.form || {};
      if (id) {
        const e = journalOf(c).find(x => x.id === id);
        if (!e) { journalUI.editing = null; render(); return; }
        if (!String(src.title === undefined ? e.title : src.title).trim() &&
          !String(src.text === undefined ? e.text : src.text).trim()) {
          journalUI.error = 'Give the entry a title or something to say.';
          render(); return;
        }
        if (src.date !== undefined) e.date = src.date;
        if (src.title !== undefined) e.title = String(src.title).trim();
        if (src.text !== undefined) e.text = src.text;
        if (src.visibility !== undefined) e.visibility = visOf({ visibility: src.visibility });
        journalUI.editing = null;
      } else {
        const f = journalUI.form;
        if (!String(f.title || '').trim() && !String(f.text || '').trim()) {
          journalUI.error = 'Give the entry a title or something to say.';
          render(); return;
        }
        journalOf(c).push({
          id: uid(),
          date: f.date || today(),
          title: String(f.title || '').trim() || 'Untitled',
          text: f.text || '',
          tags: [],
          visibility: visOf(f),
          auto: false
        });
        journalUI.adding = false;
      }
      journalUI.error = '';
      journalUI.form = { date: today(), title: '', text: '', visibility: 'private' };
      persist(); render(); return;
    }

    case 'jdel': {
      const e = journalOf(c).find(x => x.id === el.dataset.id);
      if (!e) return;
      if (!confirm('Delete "' + (e.title || 'this entry') + '"? This cannot be undone.')) return;
      c.journal = journalOf(c).filter(x => x.id !== el.dataset.id);
      if (journalUI.editing === el.dataset.id) journalUI.editing = null;
      persist(); render(); return;
    }

    case 'jvis': {
      const e = journalOf(c).find(x => x.id === el.dataset.id);
      if (!e || e.auto) return;
      e.visibility = VIS_CYCLE[visOf(e)];
      persist(); render(); return;
    }

    case 'jmore':
      journalUI.limit += 20;
      render(); return;
  }
});

document.addEventListener('input', function (ev) {
  const t = ev.target;
  if (!t.dataset || !t.dataset.jf) return;
  if (!journalUI.form) journalUI.form = {};
  journalUI.form[t.dataset.jf] = t.value;
  // no re-render: that would interrupt typing
});
document.addEventListener('change', function (ev) {
  const t = ev.target;
  if (!t.dataset || !t.dataset.jf) return;
  if (!journalUI.form) journalUI.form = {};
  journalUI.form[t.dataset.jf] = t.value;
});
