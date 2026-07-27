/* ============================================================
   Sharing controls, and the preview.

   The rules are in 99-privacy.js. This is just the way you set them, plus a
   way to look at your own sheet the way somebody else will.
   ============================================================ */

/* The same plain words the journal uses, so there is one vocabulary. */
const PRIV_LABEL = { party: 'the table', dm: 'the DM', private: 'just me' };
const PRIV_NEXT = { party: 'dm', dm: 'private', private: 'party' };
const PRIV_WHY = {
  party: 'Everyone in the campaign can see this, the DM included.',
  dm: 'The DM can see this. The other players cannot.',
  private: 'Nobody else can see this. Not even the DM.'
};

/* Is the sheet on screen one you may change? */
function sheetReadOnly() {
  return readingSomeoneElse() || !!app.preview;
}

/* ---------------- the sharing box ---------------- */
function privacyBlock(c) {
  // only ever on your own sheet, and only when there is a table to share with
  if (readingSomeoneElse()) return '';

  const rows = PRIV_SECTIONS.map(s => {
    const lvl = privLevelOf(c, s.key);
    const empty = sectionIsEmpty(c, s);
    return `<tr class="${empty ? 'dim' : ''}">
      <td><b>${h(s.label)}</b>
        <span class="privhint">${h(s.hint)}</span></td>
      <td class="privcell">
        <button class="jvis v-${lvl} noprint" data-act="pvis" data-key="${h(s.key)}"
          title="${h(PRIV_WHY[lvl])} Tap to change."
          ${app.preview ? 'disabled' : ''}>${h(PRIV_LABEL[lvl])}</button>
      </td>
    </tr>`;
  }).join('');

  const hiddenItems = invItems(c).filter(i => privItemLevel(i) !== 'party');

  return `<div class="cs-box privbox" data-w="26"><h4>Who can see what</h4>
    <table class="privtable">${rows}</table>
    <div class="privnote note">
      Numbers are always shared with the table — scores, AC, hit points, saves
      and skills. The DM's party table is worked out from them, so a sheet that
      hid them would just show blanks.
      ${hiddenItems.length
      ? `<br><b>${hiddenItems.length} possession${hiddenItems.length === 1 ? '' : 's'}</b>
         held back. Others see the weight and value but not what it is.`
      : 'Individual possessions have their own control in the inventory.'}
      ${isConnected() ? '' : '<br>On your own, this is a note to yourself rather than a lock. It takes effect once you are on the group\'s server.'}
    </div>
    ${privPreviewBar(c)}
  </div>`;
}

function sectionIsEmpty(c, s) {
  return s.fields.every(pair => {
    const v = c[pair[0]];
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).filter(k => v[k]).length === 0;
    return false;
  });
}

function privPreviewBar(c) {
  const at = app.preview;
  return `<div class="privpreview noprint">
    <span class="privpreview-lab">Look at this sheet as:</span>
    <button class="btn sm ${!at ? 'primary' : ''}" data-act="ppreview" data-as="">me</button>
    <button class="btn sm ${at === 'dm' ? 'primary' : ''}" data-act="ppreview" data-as="dm">the DM</button>
    <button class="btn sm ${at === 'party' ? 'primary' : ''}" data-act="ppreview" data-as="party">the table</button>
  </div>`;
}

/* Shown across the top while previewing, so nobody mistakes it for their sheet. */
function previewNote() {
  if (!app.preview) return '';
  const who = app.preview === 'dm' ? 'the DM' : 'the other players';
  return `<div class="pagenote previewnote noprint">
    <div><b>This is what ${who} can see.</b>
      <span class="note">Anything you are keeping back is missing from it, exactly as it is
      missing from what the server sends them. Nothing here can be edited.</span></div>
    <button class="btn primary" data-act="ppreview" data-as="">Back to my sheet</button>
  </div>`;
}

/* ---------------- events ---------------- */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act !== 'pvis' && act !== 'ppreview' && act !== 'ivis') return;

  if (act === 'ppreview') {
    app.preview = el.dataset.as || null;
    render(); return;
  }

  const c = cur();
  if (!c) return;
  if (readingSomeoneElse()) {
    app.flash = 'This is somebody else\'s sheet, so its sharing cannot be changed here.';
    render(); return;
  }
  if (app.preview) {
    app.flash = 'Go back to your own view to change what you share.';
    render(); return;
  }

  if (act === 'pvis') {
    const key = el.dataset.key;
    if (!privSection(key)) return;
    if (!c.privacy || typeof c.privacy !== 'object') c.privacy = {};
    c.privacy[key] = PRIV_NEXT[privLevelOf(c, key)];
    persist(); render(); return;
  }

  if (act === 'ivis') {
    const i = invItems(c).find(x => x.id === el.dataset.id);
    if (!i) return;
    // Worn armour and a raised shield set your AC, and the AC is always shared.
    // Hiding the name while the number it produces is on show would be a
    // pretence, so say so rather than pretend.
    if (i.equipped && (i.cat === 'armor' || i.cat === 'shield')) {
      app.flash = 'Armour you are wearing sets your AC, and the AC is always shared, ' +
        'so its name cannot be held back. Unequip it first if you want it hidden.';
      render(); return;
    }
    i.visibility = PRIV_NEXT[privItemLevel(i)];
    persist(); render(); return;
  }
});
