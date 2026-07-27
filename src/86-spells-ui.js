/* ============================================================
   Spellbook UI — wizard step, browser, importer, sheet block
   ============================================================ */

const importState = { busy: false, msg: '' };

function levelLabel(c, n) {
  if (c.systemId === 'pf2') return n === 0 ? 'Cantrips' : 'Rank ' + n;
  return n === 0 ? 'Cantrips' : n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th') + ' level';
}

/* ---------------- the step ---------------- */
function stepSpells(c) {
  const S = sys(c.systemId);
  const info = casterInfo(c);

  if (!hasSpellData(c.systemId)) {
    return `<div class="panel"><h2>Spells</h2>
      <p class="note">${h(S.name)} spell data is not bundled${c.systemId === '4e' ? ' — 4th Edition uses powers rather than spells, and no openly licensed power list exists to ship. Your class powers are listed on the Class and Advancement steps.' : '.'}</p>
      ${c.systemId === '4e' ? '' : importPanel(c)}
    </div>`;
  }
  if (!info) {
    return `<div class="panel"><h2>Spells</h2>
      <p class="note">${h(byId(S.classes, c.classId) ? byId(S.classes, c.classId).name : 'This class')} does not cast spells${c.classId ? '' : ' — pick a class first'}. You can still browse the catalogue below, or note magic items and scrolls on the Advancement step.</p>
      </div>
      ${browsePanel(c, true)}`;
  }

  const tabs = [
    ['book', 'My spellbook (' + (c.spells || []).length + ')'],
    ['browse', 'Browse catalogue'],
    ['import', 'Import']
  ];
  const body = spellUI.tab === 'book' ? bookPanel(c)
    : spellUI.tab === 'import' ? `<div class="panel">${importPanel(c)}</div>`
      : browsePanel(c, false);

  return limitsPanel(c) + `<div class="tabs" style="margin-bottom:0">
      ${tabs.map(([id, label]) => `<button class="${spellUI.tab === id ? 'on' : ''}" data-act="sptab" data-val="${id}">${h(label)}</button>`).join('')}
    </div>` + body;
}

/* ---------------- limits header ---------------- */
function limitsPanel(c) {
  const d = derive(c);
  const lim = spellLimits(c, d);
  const cnt = spellCounts(c);
  const info = casterInfo(c);
  if (!lim) return '';
  const rows = [];

  if (c.systemId === '5e' || c.systemId === '5.5e') {
    rows.push(['Spellcasting ability', d.spell ? d.spell.ability : '—']);
    rows.push(['Spell save DC', d.spell ? d.spell.dc : '—']);
    rows.push(['Spell attack', d.spell ? signed(d.spell.attack) : '—']);
    rows.push(['Cantrips', cnt.cantrips + ' / ' + (lim.cantrips || 0)]);
    if (lim.known !== undefined) rows.push(['Spells known', cnt.leveled + ' / ' + lim.known]);
    if (lim.prepared !== undefined) rows.push(['Spells prepared', cnt.prepared + ' / ' + lim.prepared]);
    if (lim.spellbook) rows.push(['Spellbook holds', 'about ' + lim.spellbook + ' spells by this level']);
    if (lim.pact) rows.push(['Pact magic', lim.pact.count + ' slot(s) of level ' + lim.pact.level + ', regained on a short rest']);
    else if (lim.slots.length) rows.push(['Slots', lim.slots.map((n, i) => (i + 1) + ':' + n).join('  ')]);
  } else if (c.systemId === 'pf2' && lim.mode === 'focus') {
    rows.push(['Casting', 'Focus spells only']);
    rows.push(['Focus spells chosen', cnt.focus]);
    rows.push(['Spell DC', 10 + c.level + PROF.trained + mod(c.finalScores[info.sc.ability])]);
  } else if (c.systemId === 'pf2') {
    rows.push(['Tradition', lim.tradition]);
    rows.push(['Spell DC / attack', d.spell ? d.spell.dc + ' / ' + signed(d.spell.attack) : '—']);
    rows.push(['Cantrips', cnt.cantrips + ' / ' + lim.cantrips]);
    rows.push([lim.mode === 'repertoire' ? 'Repertoire' : 'Prepared spells', cnt.leveled + ' spells for ' + lim.total + ' slots']);
    rows.push(['Slots by rank', Object.keys(lim.slots).map(r => r + ':' + lim.slots[r]).join('  ')]);
    if (cnt.focus) rows.push(['Focus spells', cnt.focus + ' (cast with Focus Points)']);
  } else if (c.systemId === 'pf1') {
    rows.push(['Casting', lim.mode + ', ' + ABIL_NAME[lim.ability]]);
    rows.push(['Highest spell level', lim.maxLevel || 'none yet']);
    if (lim.perDay) rows.push(['Spells per day', lim.perDay.map((n, i) => i + ':' + n).join('  ')]);
    if (d.spell) rows.push(['Save DC', d.spell.saveDCbase + ' + spell level']);
    rows.push(['Spells recorded', cnt.total]);
  }
  const issues = spellIssues(c);
  return `<div class="panel">
    <h2>Spellcasting <span class="hint">${h(info.cls.name)}${info.sub ? ' · ' + h(info.sub.name) : ''}, level ${c.level}</span></h2>
    ${kv(rows)}
    ${lim.extra ? `<div class="callout">${h(lim.extra)}</div>` : ''}
    ${lim.note ? `<div class="callout">${h(lim.note)}</div>` : ''}
    ${issues.length ? `<ul class="issues">${issues.map(i => `<li class="${i.level}">${h(i.text)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

/* ---------------- my spellbook ---------------- */
function bookPanel(c) {
  const list = charSpells(c);
  if (!list.length) {
    return `<div class="panel"><h2>My spellbook</h2>
      <p class="note">Nothing chosen yet. Switch to <b>Browse catalogue</b> and add spells — the list is filtered to your class by default.</p>
      <button class="btn primary" data-act="sptab" data-val="browse">Browse the catalogue →</button>
      ${suggestBar(c)}</div>`;
  }
  const groups = {};
  list.forEach(sp => {
    const key = sp.focus ? 'focus' : spellLevelFor(c, sp);
    (groups[key] = groups[key] || []).push(sp);
  });
  const order = Object.keys(groups).sort((a, b) => (a === 'focus' ? 99 : +a) - (b === 'focus' ? 99 : +b));
  const showPrep = ((c.systemId === '5e' || c.systemId === '5.5e') && (spellLimits(c, null) || {}).mode === 'prepared')
    || (c.systemId === 'pf2' && (spellLimits(c, null) || {}).mode === 'prepared')
    || c.systemId === 'pf1';

  return `<div class="panel">
    <h2>My spellbook <span class="hint">${list.length} spell${list.length === 1 ? '' : 's'}${showPrep ? ' · tick the ones you have prepared' : ''}</span></h2>
    ${order.map(k => `<h3 style="margin-top:12px">${h(k === 'focus' ? 'Focus spells' : levelLabel(c, +k))}
        <span class="tag">${groups[k].length}</span></h3>
      <table><tbody>${groups[k].map(sp => spellRow(c, sp, true, showPrep)).join('')}</tbody></table>`).join('')}
    <div class="footbar" style="justify-content:flex-start">
      <button class="btn" data-act="sptab" data-val="browse">Add more spells</button>
      <button class="btn ghost" data-act="spsuggest">Refill with a starter set</button>
      <label class="chk"><input type="checkbox" data-act="spprinttext" ${c.printSpellText ? 'checked' : ''}> Print full spell text on the character sheet</label>
    </div>
  </div>`;
}

function suggestBar(c) {
  const lim = spellLimits(c, null);
  if (!lim) return '';
  return `<div class="callout">Need a starting point? <button class="btn sm" data-act="spsuggest">Fill with a sensible starter set</button>
    — picks common low-level spells from your class list up to your limits. You can change any of them afterwards.</div>`;
}

/* ---------------- browse ---------------- */
function browsePanel(c, readOnly) {
  const results = filterSpells(c);
  const shown = results.slice(0, spellUI.limit);
  const all = spellsFor(c.systemId);
  const levels = c.systemId === 'pf2' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const schools = schoolOptions(c.systemId);

  const alias = legacyAlias(c.systemId, spellUI.q.trim().toLowerCase());
  return `<div class="panel">
    <h2>Catalogue <span class="hint">${results.length} of ${all.length} spells match</span></h2>
    ${alias ? `<div class="callout">The remaster renamed that spell — showing results for <b>${h(alias.replace(/\b\w/g, ch => ch.toUpperCase()))}</b>.</div>` : ''}
    <div class="grid2" style="align-items:end">
      <div class="field"><label>Search name or text</label>
        <input data-spf="q" value="${h(spellUI.q)}" placeholder="fireball, healing, teleport…"></div>
      <div class="field"><label>Level</label><select data-spf="level">
        <option value="all" ${spellUI.level === 'all' ? 'selected' : ''}>All levels</option>
        <option value="cantrip" ${spellUI.level === 'cantrip' ? 'selected' : ''}>Cantrips only</option>
        ${c.systemId === 'pf2' ? `<option value="focus" ${spellUI.level === 'focus' ? 'selected' : ''}>Focus spells</option>` : ''}
        ${levels.filter(l => l > 0).map(l => `<option value="${l}" ${String(spellUI.level) === String(l) ? 'selected' : ''}>${h(levelLabel(c, l))}</option>`).join('')}
      </select></div>
      <div class="field"><label>${c.systemId === 'pf2' ? 'School or trait' : 'School'}</label><select data-spf="school">
        <option value="all" ${spellUI.school === 'all' ? 'selected' : ''}>Any</option>
        ${schools.map(s => `<option value="${h(s)}" ${spellUI.school === s ? 'selected' : ''}>${h(s)}</option>`).join('')}
      </select></div>
      <div><label class="chk"><input type="checkbox" data-act="sponly" ${spellUI.onlyList ? 'checked' : ''}>
        Only spells on my class list</label></div>
    </div>
    ${results.length === 0 ? `<p class="note" style="margin-top:12px">Nothing matches. ${spellUI.onlyList ? 'Try unticking “only my class list”.' : 'Try a different search.'}</p>` : ''}
    <table class="sp-browse" style="margin-top:10px"><thead><tr>
      <th>Spell</th><th>Lvl</th><th>${c.systemId === 'pf2' ? 'Traits' : 'School'}</th><th>Cast</th><th>Range</th><th></th>
    </tr></thead><tbody>
      ${shown.map(sp => spellRow(c, sp, false, false, readOnly)).join('')}
    </tbody></table>
    ${results.length > shown.length ? `<div style="margin-top:10px;text-align:center">
      <button class="btn" data-act="spmore">Show ${Math.min(60, results.length - shown.length)} more (${results.length - shown.length} hidden)</button></div>` : ''}
  </div>`;
}

/* ---------------- one row ---------------- */
function spellRow(c, sp, inBook, showPrep, readOnly) {
  const have = (c.spells || []).includes(sp.uid);
  const open = spellUI.open === sp.uid;
  const lv = spellLevelFor(c, sp);
  const tags = c.systemId === 'pf2'
    ? (sp.traits || []).slice(0, 4).join(', ')
    : (sp.school || '');
  const offList = !spellOnList(c, sp);
  const main = `<tr class="${have && !inBook ? 'on' : ''}">
    <td><button class="btn sm ghost" data-act="spopen" data-uid="${h(sp.uid)}" style="padding:2px 6px;margin-right:5px">${open ? '▾' : '▸'}</button>
      <b>${h(sp.name)}</b>
      ${sp.concentration ? '<span class="tag">conc</span>' : ''}
      ${sp.ritual ? '<span class="tag">ritual</span>' : ''}
      ${sp.focus ? '<span class="tag">focus</span>' : ''}
      ${sp.imported ? '<span class="tag">imported</span>' : ''}
      ${sp.rarity && sp.rarity !== 'common' ? `<span class="tag">${h(sp.rarity)}</span>` : ''}
      ${offList ? '<span class="tag">off-list</span>' : ''}</td>
    <td class="num">${sp.focus ? '—' : lv === 0 ? 'C' : lv}</td>
    <td class="note">${h(tags)}</td>
    <td class="note">${h(sp.castingTime || '')}</td>
    <td class="note">${h(sp.range || '')}</td>
    <td style="white-space:nowrap;text-align:right">
      ${showPrep ? `<label class="chk" style="display:inline-flex;margin-right:6px"><input type="checkbox" data-act="spprep" data-uid="${h(sp.uid)}" ${isPrepared(c, sp.uid) ? 'checked' : ''}> prep</label>` : ''}
      ${readOnly ? '' : have
      ? `<button class="btn sm danger" data-act="spdel" data-uid="${h(sp.uid)}">Remove</button>`
      : `<button class="btn sm primary" data-act="spadd" data-uid="${h(sp.uid)}">Add</button>`}
    </td></tr>`;
  if (!open) return main;
  return main + `<tr><td colspan="6" style="background:var(--bg2)">${spellDetail(c, sp)}</td></tr>`;
}

function spellDetail(c, sp) {
  const rows = [];
  if (c.systemId === 'pf1') {
    rows.push(['School', sp.school]);
    rows.push(['Level', Object.keys(sp.levels || {}).map(k => SPELL_CLASSES_PF1[k] + ' ' + sp.levels[k]).join(', ')]);
    if (sp.save) rows.push(['Saving throw', sp.save]);
    if (sp.sr) rows.push(['Spell resistance', sp.sr]);
  } else if (c.systemId === 'pf2') {
    rows.push([sp.cantrip ? 'Cantrip' : sp.focus ? 'Focus spell' : 'Rank', sp.level]);
    if ((sp.traditions || []).length) rows.push(['Traditions', sp.traditions.join(', ')]);
    if ((sp.traits || []).length) rows.push(['Traits', sp.traits.join(', ')]);
    if (sp.target) rows.push(['Target', sp.target]);
    if (sp.area) rows.push(['Area', sp.area]);
    if (sp.save) rows.push(['Saving throw', sp.save]);
  } else {
    rows.push(['Level', sp.level === 0 ? 'Cantrip' : sp.level]);
    rows.push(['School', sp.school]);
    if ((sp.classes || []).length) rows.push(['Classes', sp.classes.join(', ')]);
    if (sp.components) rows.push(['Components', sp.components + (sp.material ? ' (' + sp.material + ')' : '')]);
    if (sp.save) rows.push(['Save', sp.save]);
    if (sp.damageType) rows.push(['Damage type', sp.damageType]);
  }
  if (sp.castingTime) rows.push(['Casting time', sp.castingTime]);
  if (sp.range) rows.push(['Range', sp.range]);
  if (sp.duration) rows.push(['Duration', sp.duration]);
  if (sp.source) rows.push(['Source', sp.source]);
  return `<div style="padding:8px 4px">
    ${kv(rows)}
    <div class="prose" style="white-space:pre-wrap;font-size:.87rem;margin-top:8px">${h(sp.text || '')}</div>
    ${sp.higher ? `<div class="prose" style="white-space:pre-wrap;font-size:.87rem;margin-top:6px"><b>At higher levels.</b> ${h(sp.higher)}</div>` : ''}
  </div>`;
}

/* ---------------- import panel ---------------- */
function importPanel(c) {
  const imp = loadImportedSpells();
  const n = (imp[c.systemId] || []).length;
  return `<h2>Import spells</h2>
    <p class="note">This file ships with ${spellsFor(c.systemId).length - n} built-in ${h(sys(c.systemId).name)} spells${n ? ' plus ' + n + ' you imported' : ''}.</p>
    ${c.systemId === '5e' ? `<div class="callout">
      <b>Open5e</b> hosts about 1,435 openly licensed 5e spells — the SRD plus Kobold Press Deep Magic, Level Up A5E and others.
      Your browser can fetch them directly.
      <div style="margin-top:8px">
        <button class="btn primary" data-act="spfetch" ${importState.busy ? 'disabled' : ''}>${importState.busy ? 'Fetching…' : 'Fetch from Open5e'}</button>
      </div></div>` : ''}
    ${c.systemId === 'pf1' ? `<div class="callout">
      The complete Pathfinder 1e spell list lives in the community spell database. Download it as CSV, then load the file here —
      columns like <code>name, school, sor, wiz, cleric, druid, bard, ranger, paladin, casting_time, range, duration,
      saving_throw, spell_resistance, description</code> are recognised automatically.</div>` : ''}
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-act="spimportfile">Load a JSON or CSV file</button>
      ${n ? `<button class="btn danger" data-act="spclearimport">Remove ${n} imported spell(s)</button>` : ''}
    </div>
    ${importState.msg ? `<div class="callout" style="border-color:var(--gold)">${h(importState.msg)}</div>` : ''}`;
}

/* ---------------- starter set ---------------- */
const STARTERS = {
  '5e': ['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation', 'Sacred Flame', 'Guidance', 'Druidcraft',
    'Vicious Mockery', 'Eldritch Blast', 'Magic Missile', 'Shield', 'Cure Wounds', 'Bless', 'Healing Word',
    'Sleep', 'Thunderwave', 'Faerie Fire', 'Hunter\'s Mark', 'Burning Hands', 'Detect Magic',
    'Mage Armor', 'Charm Person', 'Shield of Faith', 'Entangle', 'Goodberry', 'Divine Favor'],
  pf1: ['Detect Magic', 'Light', 'Read Magic', 'Mage Hand', 'Prestidigitation', 'Guidance', 'Stabilize',
    'Magic Missile', 'Mage Armor', 'Shield', 'Cure Light Wounds', 'Bless', 'Divine Favor', 'Entangle',
    'Sleep', 'Charm Person', 'Burning Hands', 'Obscuring Mist', 'Shield of Faith', 'Produce Flame'],
  pf2: ['Detect Magic', 'Light', 'Prestidigitation', 'Shield', 'Electric Arc', 'Telekinetic Projectile',
    'Force Barrage', 'Heal', 'Bless', 'Fear', 'Mystic Armor', 'Grease', 'Soothe', 'Gust of Wind',
    'Sure Strike', 'Runic Weapon', 'Guidance', 'Void Warp']
};
function fillStarter(c) {
  const lim = spellLimits(c, null);
  if (!lim) return 0;
  const pool = spellsFor(c.systemId).filter(sp => spellOnList(c, sp));
  const wanted = STARTERS[c.systemId] || [];
  const pick = [];
  const cantripCap = lim.cantrips || 0;
  const levelCap = c.systemId === 'pf2' ? lim.maxRank : lim.maxLevel;
  const knownCap = lim.known !== undefined ? lim.known
    : lim.prepared !== undefined ? lim.prepared
      : c.systemId === 'pf2' ? lim.total : 8;
  let nc = 0, nl = 0;
  wanted.forEach(name => {
    const sp = pool.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!sp || pick.includes(sp.uid)) return;
    const isC = sp.cantrip || spellLevelFor(c, sp) === 0;
    const lv = spellLevelFor(c, sp);
    if (isC) { if (nc < cantripCap) { pick.push(sp.uid); nc++; } }
    else if (lv <= (levelCap || 0) && nl < knownCap) { pick.push(sp.uid); nl++; }
  });
  // top up cantrips and low-level spells from the class list if the curated names ran out
  if (nc < cantripCap) {
    pool.filter(sp => (sp.cantrip || spellLevelFor(c, sp) === 0) && !pick.includes(sp.uid))
      .slice(0, cantripCap - nc).forEach(sp => { pick.push(sp.uid); nc++; });
  }
  if (nl < knownCap && levelCap) {
    pool.filter(sp => !sp.cantrip && !sp.focus && spellLevelFor(c, sp) === 1 && !pick.includes(sp.uid))
      .slice(0, knownCap - nl).forEach(sp => { pick.push(sp.uid); nl++; });
  }
  c.spells = pick;
  // cantrips and focus spells are always available, so only leveled spells go on the prepared list
  const prepCap = lim.prepared !== undefined ? lim.prepared : pick.length;
  c.prepared = pick.filter(u => {
    const sp = spellByUid(c.systemId, u);
    return sp && !sp.focus && spellLevelFor(c, sp) > 0;
  }).slice(0, prepCap);
  return pick.length;
}

/* ---------------- sheet block ---------------- */
function spellSheetBlock(c) {
  const list = charSpells(c);
  if (!list.length) return '';
  const d = derive(c);
  const lim = spellLimits(c, d);
  const groups = {};
  list.forEach(sp => {
    const key = sp.focus ? 'focus' : spellLevelFor(c, sp);
    (groups[key] = groups[key] || []).push(sp);
  });
  const order = Object.keys(groups).sort((a, b) => (a === 'focus' ? 99 : +a) - (b === 'focus' ? 99 : +b));
  const slotFor = k => {
    if (k === 'focus' || !lim) return '';
    const n = +k;
    if (n === 0) return '';
    if (c.systemId === 'pf2' && lim.slots) return lim.slots[n] ? ' — ' + lim.slots[n] + ' slots' : '';
    if (c.systemId === '5e' && lim.slots && lim.slots[n - 1]) return ' — ' + lim.slots[n - 1] + ' slots';
    if (c.systemId === 'pf1' && lim.perDay && lim.perDay[n] !== undefined) return ' — ' + lim.perDay[n] + '/day';
    return '';
  };
  return `<div class="box"><h4>Spells${d.spell && d.spell.dc ? ' — DC ' + d.spell.dc : ''}${d.spell && d.spell.attack !== undefined ? ', attack ' + signed(d.spell.attack) : ''}</h4>
    ${order.map(k => `<div style="margin-bottom:6px">
      <b style="font-size:.74rem;text-transform:uppercase;letter-spacing:.06em">${h(k === 'focus' ? 'Focus spells' : levelLabel(c, +k))}${h(slotFor(k))}</b>
      <ul>${groups[k].map(sp => `<li>${isPrepared(c, sp.uid) ? '<span class="dot on"></span>' : ''}${h(sp.name)}${sp.concentration ? ' (conc)' : ''}${sp.ritual ? ' (ritual)' : ''}</li>`).join('')}</ul>
    </div>`).join('')}
    <div class="prose" style="font-size:.7rem">● prepared</div>
  </div>`;
}

/* Full descriptions run the width of the page rather than sitting in a sheet column. */
function spellTextSheet(c) {
  if (!c.printSpellText) return '';
  const list = charSpells(c);
  if (!list.length) return '';
  const sorted = list.slice().sort((a, b) =>
    (spellLevelFor(c, a) - spellLevelFor(c, b)) || a.name.localeCompare(b.name));
  return `<div class="box" style="margin-top:12px"><h4>Spell descriptions</h4>
    <div class="spelltext">
    ${sorted.map(sp => `<div class="spellentry">
      <b>${h(sp.name)}</b> <span style="font-size:.72rem;color:#7a6d5c">${h(sp.focus ? 'focus' : spellLevelFor(c, sp) === 0 ? 'cantrip' : levelLabel(c, spellLevelFor(c, sp)))}${sp.school ? ' · ' + h(sp.school) : ''}${sp.castingTime ? ' · ' + h(sp.castingTime) : ''}${sp.range ? ' · ' + h(sp.range) : ''}${sp.duration ? ' · ' + h(sp.duration) : ''}${sp.save ? ' · save ' + h(sp.save) : ''}</span>
      <div class="prose" style="white-space:pre-wrap">${h(sp.text || '')}${sp.higher ? '\n\nAt higher levels. ' + h(sp.higher) : ''}</div>
    </div>`).join('')}
    </div></div>`;
}

/* ============================================================
   Spell events (separate delegated listener)
   ============================================================ */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!/^sp/.test(act)) return;
  const c = cur();
  if (!c) return;

  switch (act) {
    case 'sptab': spellUI.tab = el.dataset.val; spellUI.limit = 60; render(); return;
    case 'spmore': spellUI.limit += 60; render(); return;
    case 'sponly': spellUI.onlyList = !spellUI.onlyList; spellUI.limit = 60; render(); return;
    case 'spopen': spellUI.open = spellUI.open === el.dataset.uid ? null : el.dataset.uid; render(); return;
    case 'spadd': {
      c.spells = c.spells || [];
      if (!c.spells.includes(el.dataset.uid)) c.spells.push(el.dataset.uid);
      persist(); render(); return;
    }
    case 'spdel': {
      c.spells = (c.spells || []).filter(u => u !== el.dataset.uid);
      c.prepared = (c.prepared || []).filter(u => u !== el.dataset.uid);
      persist(); render(); return;
    }
    case 'spprep': {
      const u = el.dataset.uid;
      c.prepared = c.prepared || [];
      c.prepared = c.prepared.includes(u) ? c.prepared.filter(x => x !== u) : c.prepared.concat(u);
      persist(); render(); return;
    }
    case 'spprinttext': c.printSpellText = !c.printSpellText; persist(); render(); return;
    case 'spsuggest': {
      const n = fillStarter(c);
      app.flash = n ? 'Added ' + n + ' spells. Swap anything you do not want.' : 'No matching starter spells for this class.';
      spellUI.tab = 'book';
      persist(); render(); return;
    }
    case 'spclearimport': {
      if (!confirm('Remove all imported spells for this system? Characters keep their picks but unknown entries will drop off.')) return;
      clearImportedSpells(c.systemId);
      importState.msg = 'Imported spells removed.';
      render(); return;
    }
    case 'spimportfile': {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,.csv,.tsv,application/json,text/csv';
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          try {
            let records;
            const txt = String(fr.result).trim();
            if (txt[0] === '[' || txt[0] === '{') {
              const o = JSON.parse(txt);
              records = Array.isArray(o) ? o : (o.results || o.spells || [o]);
            } else {
              records = parseCSV(txt);
            }
            const r = importSpellRecords(records, c.systemId);
            importState.msg = 'Imported ' + r.added + ' spell(s)' + (r.skipped ? ', skipped ' + r.skipped + ' unrecognised row(s)' : '') + '.';
          } catch (e) {
            importState.msg = 'Could not read that file: ' + e.message;
          }
          render();
        };
        fr.readAsText(f);
      };
      inp.click();
      return;
    }
    case 'spfetch': {
      if (importState.busy) return;
      importState.busy = true;
      importState.msg = 'Contacting Open5e…';
      render();
      fetchOpen5e(msg => { importState.msg = msg; const p = document.querySelector('.callout'); if (p) p.textContent = msg; })
        .then(all => {
          const r = importSpellRecords(all, '5e');
          importState.busy = false;
          importState.msg = 'Imported ' + r.added + ' spells from Open5e' + (r.skipped ? ' (' + r.skipped + ' skipped)' : '') + '. Built-in duplicates were replaced.';
          render();
        })
        .catch(e => {
          importState.busy = false;
          importState.msg = 'Open5e fetch failed: ' + e.message +
            '. If you opened this file straight from disk your browser may be blocking the request — try downloading the spell JSON yourself and using “Load a JSON or CSV file”.';
          render();
        });
      return;
    }
  }
});

document.addEventListener('input', onSpellFilter);
document.addEventListener('change', onSpellFilter);
function onSpellFilter(ev) {
  const f = ev.target.dataset ? ev.target.dataset.spf : null;
  if (!f) return;
  spellUI[f] = ev.target.value;
  spellUI.limit = 60;
  if (f === 'q') {
    // re-render only the results table so the search box keeps focus
    if (ev.type !== 'input') return;
    clearTimeout(onSpellFilter._t);
    onSpellFilter._t = setTimeout(() => {
      const c = cur(); if (!c) return;
      const panels = document.querySelectorAll('.layout > div:nth-child(2) .panel');
      const target = panels[panels.length - 1];
      if (target) {
        const tmp = document.createElement('div');
        tmp.innerHTML = browsePanel(c, false);
        target.innerHTML = tmp.firstElementChild.innerHTML;
        const box = target.querySelector('[data-spf="q"]');
        if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }
    }, 160);
    return;
  }
  render();
}
