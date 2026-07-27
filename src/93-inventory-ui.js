/* ============================================================
   Inventory UI — carried items, catalogue, custom items, coins
   ============================================================ */

const invUI = {
  open: false,        // catalogue drawer open?
  q: '', cat: 'all', limit: 50,
  customOpen: false,
  custom: { name: '', cat: 'gear', qty: 1, weight: '', cp: '', stats: '', note: '' },
  detail: null
};
function resetInvUI() {
  invUI.open = false; invUI.q = ''; invUI.cat = 'all'; invUI.limit = 50;
  invUI.customOpen = false; invUI.detail = null;
  invUI.custom = { name: '', cat: 'gear', qty: 1, weight: '', cp: '', stats: '', note: '' };
}
/* Called whenever the open character changes: clear every panel's own state. */
function resetAllPanels() {
  resetSpellUI();
  resetInvUI();
  if (typeof resetJournalUI === 'function') resetJournalUI();
  if (typeof resetCampUI === 'function') resetCampUI();
  if (typeof sheetUI === 'object') sheetUI.openSpell = null;
}

const CAT_LABEL = {
  weapon: 'Weapons', armor: 'Armour', shield: 'Shields', ammunition: 'Ammunition',
  gear: 'Gear', tool: 'Tools', consumable: 'Consumables', container: 'Containers',
  kit: 'Kits', treasure: 'Treasure', magic: 'Magic items', mount: 'Mounts',
  vehicle: 'Vehicles', other: 'Other'
};
const CAT_ORDER = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'tool', 'consumable',
  'container', 'kit', 'treasure', 'magic', 'mount', 'vehicle', 'other'];

/* ---------------- the block on the character sheet ---------------- */
function inventoryBlock(c, d) {
  const s = invSummary(c, d);
  const items = invItems(c);
  const unit = s.limits.unit;
  const pct = s.limits.max ? clamp(Math.round(s.load / s.limits.max * 100), 0, 100) : 0;
  const bandIdx = s.limits.bands.indexOf(s.band);
  const barClass = s.over ? 'over' : bandIdx > 0 ? 'warn' : '';

  const groups = {};
  items.forEach(i => (groups[i.cat] = groups[i.cat] || []).push(i));
  const order = CAT_ORDER.filter(k => groups[k]);

  return `<div class="cs-box" data-w="${8 + items.length * 1.2}"><h4>Inventory${s.lines ? ' — ' + s.count + ' item' + (s.count === 1 ? '' : 's') : ''}</h4>

    <div class="loadbar">
      <div class="loadhead">
        <span><b>${h(fmtWeight(c.systemId, s.load))}</b> ${h(unit)} carried</span>
        <span class="${s.over ? 'loadover' : 'note'}">${h(s.band.name)} · limit ${s.limits.max} ${h(unit)}</span>
      </div>
      <div class="bar ${barClass}"><i style="width:${pct}%"></i></div>
      ${bandIdx > 0 ? `<div class="note">${h(s.band.note)}</div>` : ''}
    </div>

    ${coinPanel(c, s)}

    ${items.length ? order.map(k => `<div class="invgroup">
        <div class="invgroup-lab">${h(CAT_LABEL[k] || k)}</div>
        <table>${groups[k].map(i => invRow(c, i)).join('')}</table>
      </div>`).join('')
      : `<p class="note">Nothing carried yet.</p>`}

    <div class="footbar noprint" style="justify-content:flex-start">
      ${sheetReadOnly() ? '' : `<button class="btn sm primary" data-act="invbrowse">${invUI.open ? 'Hide the catalogue' : 'Add from catalogue'}</button>
      <button class="btn sm" data-act="invcustom">${invUI.customOpen ? 'Cancel custom item' : 'Create a custom item'}</button>`}
      ${items.length ? `<span class="note">Worth ${h(fmtCoins(s.value))}${s.equipped ? ' · ' + s.equipped + ' equipped' : ''}</span>` : ''}
    </div>
    ${sheetReadOnly() ? '' : (invUI.customOpen ? customForm(c) : '')}
    ${sheetReadOnly() ? '' : (invUI.open ? cataloguePanel(c) : '')}
  </div>`;
}

function invRow(c, i) {
  const canEquip = ['weapon', 'armor', 'shield'].includes(i.cat);
  const lim = attunementLimit(c);
  const open = invUI.detail === i.id;
  const ro = sheetReadOnly();
  const lvl = privItemLevel(i);

  // A possession somebody is not allowed to see arrives as a nameless line
  // that still weighs and is worth what it did, so their totals add up.
  if (i.hidden) {
    return `<tr class="hiddenrow">
      <td><i>hidden item</i>
        ${i.qty > 1 ? ' <span class="note">×' + i.qty + '</span>' : ''}
        <span class="invstats">kept back by their player</span></td>
      <td class="num note">${h(fmtWeight(c.systemId, itemWeight(i)))}</td>
      <td class="noprint"></td>
    </tr>`;
  }

  return `<tr class="${i.equipped ? 'on' : ''}">
    <td>
      ${i.note || i.stats ? `<button class="btn sm ghost noprint" data-act="invinfo" data-id="${h(i.id)}" style="padding:1px 5px">${open ? '▾' : '▸'}</button>` : ''}
      ${h(i.name)}${i.qty > 1 ? ' <span class="note">×' + i.qty + '</span>' : ''}
      ${i.equipped ? '<span class="tag">equipped</span>' : ''}
      ${i.attuned ? '<span class="tag">attuned</span>' : ''}
      ${i.custom ? '<span class="tag">custom</span>' : ''}
      ${lvl !== 'party' ? `<span class="tag hid">${h(PRIV_LABEL[lvl])}</span>` : ''}
      ${i.stats ? `<span class="invstats">${h(i.stats)}</span>` : ''}
    </td>
    <td class="num note">${h(fmtWeight(c.systemId, itemWeight(i)))}</td>
    <td class="noprint" style="text-align:right;white-space:nowrap">
      ${ro ? '' : `<button class="btn sm" data-act="invqty" data-id="${h(i.id)}" data-delta="-1">−</button>
      <button class="btn sm" data-act="invqty" data-id="${h(i.id)}" data-delta="1">+</button>
      ${canEquip ? `<button class="btn sm ${i.equipped ? 'primary' : ''}" data-act="invequip" data-id="${h(i.id)}">${i.equipped ? 'Worn' : 'Equip'}</button>` : ''}
      ${i.attune && lim ? `<button class="btn sm ${i.attuned ? 'primary' : ''}" data-act="invattune" data-id="${h(i.id)}">${i.attuned ? 'Attuned' : 'Attune'}</button>` : ''}
      <button class="jvis v-${lvl}" data-act="ivis" data-id="${h(i.id)}"
        title="${h(PRIV_WHY[lvl])} Tap to change who can see this one thing.">${h(PRIV_LABEL[lvl])}</button>
      <button class="btn sm danger" data-act="invdel" data-id="${h(i.id)}">Drop</button>`}
    </td>
  </tr>${open ? `<tr><td colspan="3" class="spdetail">
    ${i.sub ? `<div class="note">${h(i.sub)}</div>` : ''}
    ${i.stats ? `<div class="note">${h(i.stats)}</div>` : ''}
    ${i.cp ? `<div class="note">Worth ${h(fmtCoins(i.cp))} each</div>` : ''}
    ${i.note ? `<div class="prose" style="margin-top:5px">${h(i.note)}</div>` : ''}
  </td></tr>` : ''}`;
}

function coinPanel(c, s) {
  const p = invInit(c).coins;
  return `<div class="coins">
    <div class="coinrow noprint">
      ${COINS.map(k => `<label class="coin">
        <span>${k.id}</span>
        <input type="number" min="0" inputmode="numeric" value="${Number(p[k.id]) || 0}"
          data-act="setcoin" data-coin="${k.id}">
      </label>`).join('')}
    </div>
    <div class="note">Purse: <b>${h(fmtPurse(c))}</b>${s.coinCp ? ' — worth ' + h(fmtGold(s.coinCp)) : ''}
      ${s.coinWeight ? ' · ' + h(fmtWeight(c.systemId, s.coinWeight)) + ' ' + h(s.limits.unit) + ' of coins' : ''}
      ${c.systemId === 'pf2' ? ' · 1,000 coins is 1 Bulk' : ' · 50 coins to the pound'}</div>
  </div>`;
}

/* ---------------- custom item form ---------------- */
function customForm(c) {
  const f = invUI.custom;
  return `<div class="invpanel noprint">
    <h5>Create a custom item</h5>
    <div class="grid3">
      <div class="field"><label>Name</label>
        <input data-cust="name" value="${h(f.name)}" placeholder="Grandfather's locket"></div>
      <div class="field"><label>Category</label>
        <select data-cust="cat">${CAT_ORDER.map(k => `<option value="${k}" ${f.cat === k ? 'selected' : ''}>${h(CAT_LABEL[k])}</option>`).join('')}</select></div>
      <div class="field"><label>Quantity</label>
        <input type="number" min="1" inputmode="numeric" data-cust="qty" value="${h(f.qty)}"></div>
      <div class="field"><label>Weight each (${h(weightUnit(c.systemId))})</label>
        <input type="number" min="0" step="0.1" inputmode="decimal" data-cust="weight" value="${h(f.weight)}" placeholder="0"></div>
      <div class="field"><label>Value each (copper)</label>
        <input type="number" min="0" inputmode="numeric" data-cust="cp" value="${h(f.cp)}" placeholder="0"></div>
      <div class="field"><label>Stats (optional)</label>
        <input data-cust="stats" value="${h(f.stats)}" placeholder="1d6 fire, +1 AC…"></div>
    </div>
    <div class="field"><label>Notes</label>
      <textarea data-cust="note" style="min-height:52px" placeholder="What it does, where it came from…">${h(f.note)}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-act="invaddcustom">Add to inventory</button>
      <button class="btn ghost" data-act="invcustom">Cancel</button>
      <span class="note">Weight and value are per item; the total updates with quantity.</span>
    </div>
  </div>`;
}

/* ---------------- catalogue ---------------- */
function filterItems(c) {
  const all = itemsFor(c.systemId);
  const q = invUI.q.trim().toLowerCase();
  return all.filter(i => {
    if (invUI.cat !== 'all' && i.cat !== invUI.cat) return false;
    if (q) {
      const hay = (i.name + ' ' + i.sub + ' ' + i.stats + ' ' + i.note).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function cataloguePanel(c) {
  if (!hasItemData(c.systemId)) {
    return `<div class="invpanel noprint"><p class="note">No item catalogue is bundled for ${h(sys(c.systemId).name)}. Use <b>Create a custom item</b>.</p></div>`;
  }
  const results = filterItems(c);
  const shown = results.slice(0, invUI.limit);
  const cats = [...new Set(itemsFor(c.systemId).map(i => i.cat))].sort(
    (a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
  return `<div class="invpanel noprint">
    <h5>Catalogue <span class="note">${results.length} of ${itemsFor(c.systemId).length} items</span></h5>
    <div class="grid2" style="align-items:end">
      <div class="field"><label>Search</label>
        <input data-invf="q" value="${h(invUI.q)}" placeholder="rope, longsword, potion…"></div>
      <div class="field"><label>Category</label>
        <select data-invf="cat">
          <option value="all" ${invUI.cat === 'all' ? 'selected' : ''}>All categories</option>
          ${cats.map(k => `<option value="${k}" ${invUI.cat === k ? 'selected' : ''}>${h(CAT_LABEL[k] || k)}</option>`).join('')}
        </select></div>
    </div>
    ${results.length ? `<table class="inv-cat"><thead><tr>
        <th>Item</th><th class="num">${h(weightUnit(c.systemId))}</th><th>Cost</th><th></th>
      </tr></thead><tbody>
      ${shown.map(i => `<tr>
        <td>${h(i.name)}
          ${i.stats ? `<span class="invstats">${h(i.stats)}</span>` : ''}
          ${i.sub ? `<span class="invstats">${h(i.sub)}</span>` : ''}</td>
        <td class="num note">${h(fmtWeight(c.systemId, i.weight))}</td>
        <td class="note">${i.cp ? h(fmtCoins(i.cp)) : '—'}</td>
        <td style="text-align:right"><button class="btn sm primary" data-act="invadd" data-uid="${h(i.uid)}">Add</button></td>
      </tr>`).join('')}
      </tbody></table>
      ${results.length > shown.length ? `<div style="text-align:center;margin-top:8px">
        <button class="btn sm" data-act="invmore">Show ${Math.min(50, results.length - shown.length)} more (${results.length - shown.length} hidden)</button></div>` : ''}`
      : `<p class="note">Nothing matches. Try a different search, or create a custom item.</p>`}
  </div>`;
}

/* ============================================================
   Events
   ============================================================ */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!/^inv/.test(act)) return;
  const c = cur();
  if (!c) return;
  if (sheetReadOnly()) {
    app.flash = readingSomeoneElse()
      ? 'This is somebody else\'s inventory, so it cannot be changed here.'
      : 'Go back to your own view to change your inventory.';
    render(); return;
  }

  switch (act) {
    case 'invbrowse': invUI.open = !invUI.open; invUI.limit = 50; render(); return;
    case 'invcustom': invUI.customOpen = !invUI.customOpen; render(); return;
    case 'invmore': invUI.limit += 50; render(); return;
    case 'invinfo': invUI.detail = invUI.detail === el.dataset.id ? null : el.dataset.id; render(); return;
    case 'invadd': {
      const line = addCatalogueItem(c, el.dataset.uid, 1);
      if (line) logPlay('Picked up ' + line.name + (line.qty > 1 ? ' (now ×' + line.qty + ')' : '') + '.');
      persist(); render(); return;
    }
    case 'invaddcustom': {
      if (!invUI.custom.name.trim()) { app.flash = 'Give the item a name first.'; render(); return; }
      const line = addCustomItem(c, invUI.custom);
      logPlay('Added ' + line.name + ' to the inventory.');
      invUI.custom = { name: '', cat: line.cat, qty: 1, weight: '', cp: '', stats: '', note: '' };
      invUI.customOpen = false;
      persist(); render(); return;
    }
    case 'invqty': {
      const line = invLine(c, el.dataset.id);
      if (!line) return;
      setQty(c, line.id, line.qty + Number(el.dataset.delta));
      persist(); render(); return;
    }
    case 'invequip': {
      const r = toggleEquip(c, el.dataset.id);
      if (r.message) logPlay(r.message);
      persist(); render(); return;
    }
    case 'invattune': {
      const line = invLine(c, el.dataset.id);
      if (!line) return;
      const lim = attunementLimit(c);
      const attunedNow = invItems(c).filter(i => i.attuned).length;
      if (!line.attuned && lim && attunedNow >= lim) {
        app.flash = 'You are already attuned to ' + lim + ' items. Break one first.';
        render(); return;
      }
      line.attuned = !line.attuned;
      logPlay(line.name + (line.attuned ? ' attuned.' : ' no longer attuned.'));
      persist(); render(); return;
    }
    case 'invdel': {
      const line = removeItem(c, el.dataset.id);
      if (line) logPlay('Dropped ' + line.name + '.');
      persist(); render(); return;
    }
  }
});

document.addEventListener('input', onInvField);
document.addEventListener('change', onInvField);
function onInvField(ev) {
  const t = ev.target;
  if (!t || !t.dataset) return;
  const c = cur();
  if (!c) return;

  // coin boxes
  if (t.dataset.act === 'setcoin') {
    invInit(c).coins[t.dataset.coin] = Math.max(0, Math.round(Number(t.value) || 0));
    persist();
    if (ev.type === 'change') render();
    return;
  }
  // custom item form: keep the values without re-rendering, so typing is smooth
  if (t.dataset.cust) {
    invUI.custom[t.dataset.cust] = t.value;
    return;
  }
  // catalogue filters
  if (t.dataset.invf) {
    invUI[t.dataset.invf] = t.value;
    invUI.limit = 50;
    if (t.dataset.invf === 'q') {
      if (ev.type !== 'input') return;
      clearTimeout(onInvField._t);
      onInvField._t = setTimeout(() => {
        const cc = cur(); if (!cc) return;
        const panel = document.querySelector('.invpanel');
        if (!panel) return render();
        const tmp = document.createElement('div');
        tmp.innerHTML = cataloguePanel(cc);
        panel.innerHTML = tmp.firstElementChild.innerHTML;
        const box = panel.querySelector('[data-invf="q"]');
        if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }, 160);
      return;
    }
    render();
  }
}
