/* ============================================================
   The character sheet — dark themed, live at the table
   ============================================================ */

const sheetUI = { log: [], openSpell: null };
const levelUI = { open: false, done: false, from: 0, notesDraft: '' };

/* What each system calls the sub-choices, for the labelled header */
const SUBLINEAGE_LABEL = { '5e': 'Subrace', '5.5e': 'Subrace', '4e': 'Variant', pf1: 'Variant', pf2: 'Heritage' };
const SUBCLASS_LABEL = { '5e': 'Subclass', '4e': 'Build', pf1: 'Archetype', pf2: 'Subclass' };

function logPlay(msg) {
  sheetUI.log.unshift(msg);
  sheetUI.log = sheetUI.log.slice(0, 6);
}

/* ---------------- level-up modal ---------------- */
function levelChoices(c, l) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const out = [];
  if (c.systemId === '5e' || c.systemId === '5.5e') {
    if (cls && (cls.asiLevels || []).includes(l)) out.push({ kind: 'asi5e', level: l, label: 'Ability Score Improvement — two points, or a feat instead' });
    if (cls && (cls.subclasses || []).length && !c.subclassId) out.push({ kind: 'subclass', label: (SUBCLASS_LABEL && SUBCLASS_LABEL[c.systemId]) || 'Subclass' });
  } else if (c.systemId === 'pf1') {
    if (l % 4 === 0) out.push({ kind: 'asipf1', level: l, label: '+1 to one ability score' });
    if (l % 2 === 1) out.push({ kind: 'note', label: 'A new feat — record it in the notes' });
  } else if (c.systemId === 'pf2') {
    if ([5, 10, 15, 20].includes(l)) out.push({ kind: 'boosts', level: l, label: 'Four ability boosts' });
    const S2 = sys('pf2');
    if ((S2.skillIncreaseLevels || []).includes(l)) out.push({ kind: 'note', label: 'A skill increase — set it on the Skills step' });
  } else if (c.systemId === '4e') {
    if (l % 2 === 1) out.push({ kind: 'note', label: 'A new feat' });
    if ([2, 6, 10, 16, 22, 26].includes(l)) out.push({ kind: 'note', label: 'A new utility power' });
  }
  return out;
}

function levelHpNote(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const hd = cls ? (cls.hitDie || 8) : 8;
  if (c.systemId === '4e') return 'Hit points rise on the 4e schedule.';
  const con = mod((c.finalScores || {}).con || 10);
  if (c.hpMethod === 'roll') return 'Hit points: 1d' + hd + ' + ' + signed(con) + ', rolled when you confirm.';
  return 'Hit points: +' + (Math.floor(hd / 2) + 1 + con) + ' (fixed average of a d' + hd + ', ' + signed(con) + ' Con).';
}

function levelUpModal(c) {
  if (!levelUI.open || !c) return '';
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const capped = c.level >= S.maxLevel;

  if (!levelUI.done) {
    const target = c.level + 1;
    const feats = cls && cls.features && cls.features[target] ? cls.features[target] : [];
    const choices = levelChoices(c, target);
    return `<div class="dialog-backdrop noprint" data-act="levelclose">
      <div class="dialog lvl-dialog" data-stop="1">
        <div class="dialog-title">Level ${c.level} → ${capped ? c.level : target}</div>
        <div class="dialog-body">
          ${capped ? `<p class="note">${h(c.name || 'This character')} is already at the cap for ${h(S.name)}.</p>` : `
          <div class="lvl-sec"><span class="k">What you gain</span>
            ${feats.length ? `<ul class="cs-list">${feats.map(f => `<li>${h(f)}</li>`).join('')}</ul>` : '<p class="note">No new class feature at this level.</p>'}
            <p class="note">${h(levelHpNote(c))}</p>
          </div>
          <div class="lvl-sec"><span class="k">What you will choose</span>
            ${choices.length ? `<ul class="cs-list">${choices.map(ch => `<li>${h(ch.label)}</li>`).join('')}</ul>` : '<p class="note">Nothing to decide — this level applies itself.</p>'}
          </div>`}
        </div>
        <div class="dialog-actions">
          <button class="btn" data-act="levelclose">Cancel</button>
          ${capped ? '' : `<button class="btn primary" data-act="levelgo">Level up to ${target}</button>`}
        </div>
      </div>
    </div>`;
  }

  /* after levelling up: show what was gained and let the player make choices */
  const l = c.level;
  const choices = levelChoices(c, l);
  const gained = app.levelUpLog || [];
  const asi = choices.find(x => x.kind === 'asi5e' || x.kind === 'asipf1');
  const boosts = choices.find(x => x.kind === 'boosts');
  const wantsSub = choices.find(x => x.kind === 'subclass');
  const cur5 = asArray((c.levelAsi || {})[l]);
  const curB = asArray(((c.boosts || {}).levels || {})[l]);

  return `<div class="dialog-backdrop noprint" data-act="levelclose">
    <div class="dialog lvl-dialog" data-stop="1">
      <div class="dialog-title">Welcome to level ${l}</div>
      <div class="dialog-body">
        ${gained.length ? `<div class="lvl-sec"><span class="k">Gained</span>
          <ul class="cs-list">${gained.map(g => `<li>${h(g.text)}</li>`).join('')}</ul></div>` : ''}

        ${wantsSub && cls ? `<div class="lvl-sec"><span class="k">${h(wantsSub.label)}</span>
          <div class="field"><select data-field="subclassId">
            <option value="">—</option>
            ${(cls.subclasses || []).map(s => `<option value="${h(s.id)}" ${c.subclassId === s.id ? 'selected' : ''}>${h(s.name)}</option>`).join('')}
          </select></div>
          <p class="note">${h((byId(cls.subclasses || [], c.subclassId) || {}).note || 'Pick the path this character follows.')}</p>
        </div>` : ''}

        ${asi && asi.kind === 'asi5e' ? `<div class="lvl-sec"><span class="k">Ability Score Improvement</span>
          <div class="grid3">
            ${abilSelect(c, 'levelAsi.' + l + '.0', cur5[0], [], 'First point (+1)')}
            ${abilSelect(c, 'levelAsi.' + l + '.1', cur5[1], [], 'Second point (+1)')}
            <div class="field"><label>Feat taken instead</label>
              <input data-field="choices.feat${l}" value="${h((c.choices || {})['feat' + l] || '')}" placeholder="e.g. Sharpshooter"></div>
          </div>
          <p class="note">Pick the same ability twice for +2.</p>
        </div>` : ''}

        ${asi && asi.kind === 'asipf1' ? `<div class="lvl-sec"><span class="k">+1 ability score</span>
          <div class="grid3">${abilSelect(c, 'levelAsi.' + l + '.0', asArray((c.levelAsi || {})[l])[0], [], 'Increase')}</div>
        </div>` : ''}

        ${boosts ? `<div class="lvl-sec"><span class="k">Four ability boosts</span>
          <div class="grid3">${[0, 1, 2, 3].map(i => {
            const taken = curB.filter((x, j) => j !== i && x);
            return `<div class="field"><label>Boost ${i + 1}</label>
              <select data-field="boosts.levels.${l}.${i}"><option value="">—</option>
              ${ABIL6.map(a => `<option value="${a}" ${curB[i] === a ? 'selected' : ''} ${taken.includes(a) ? 'disabled' : ''}>${h(ABIL_NAME[a])}</option>`).join('')}
              </select></div>`;
          }).join('')}</div>
          <p class="note">A boost gives +2, or +1 once the score is 18 or higher.</p>
        </div>` : ''}

        ${choices.filter(x => x.kind === 'note').length ? `<div class="lvl-sec"><span class="k">Still to do</span>
          <ul class="cs-list">${choices.filter(x => x.kind === 'note').map(x => `<li>${h(x.label)}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="lvl-sec"><span class="k">Notes for this level</span>
          <textarea data-levelnotes="1" style="min-height:70px;width:100%" placeholder="Feats, powers, item choices…">${h(levelUI.notesDraft)}</textarea>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="btn" data-act="modify">Open the wizard</button>
        <button class="btn primary" data-act="levelclose">Done</button>
      </div>
    </div>
  </div>`;
}

function viewSheet() {
  const real = cur();
  if (!real) { app.view = 'roster'; return viewRoster(); }
  // Previewing runs the sheet through filterCharacter — the same function the
  // server uses — so what you are shown cannot disagree with what it sends.
  const c = app.preview ? filterCharacter(app.preview, real) : real;
  const S = sys(c.systemId);
  const d = derive(c);
  playInit(c);

  const lin = byId(S.lineages, c.lineageId);
  const linSub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
  const cls = byId(S.classes, c.classId);
  const sub = cls ? byId(cls.subclasses || [], c.subclassId) : null;
  const bg = byId(S.backgrounds, c.backgroundId);

  const missing = [];
  if (!c.name) missing.push('a name');
  if (!c.lineageId) missing.push('a ' + S.lineageLabel.toLowerCase());
  if (!c.classId) missing.push('a ' + S.classLabel.toLowerCase());
  const errs = validate(c).filter(i => i.level === 'error');

  // Each part of the header gets a label, so it is obvious what is what.
  const idFields = [
    ['Level', c.level],
    [S.lineageLabel, lin ? lin.name : null],
    [SUBLINEAGE_LABEL[c.systemId] || 'Variant', linSub ? linSub.name : null],
    [S.classLabel, cls ? cls.name : null],
    [SUBCLASS_LABEL[c.systemId] || 'Subclass', sub ? sub.name : null],
    [S.backgroundLabel.split(' / ')[0], bg && bg.id !== 'none' ? bg.name : null],
    ['Alignment', c.alignment],
    ['Deity', c.deity],
    ['Player', c.player],
    ['Campaign', c.campaignId ? (campaignName(c.campaignId) || 'a campaign') : null]
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return pageBar(c, 'sheet') +
    previewNote() +
    (app.flash ? `<div class="pagenote noprint"><div>${h(app.flash)}</div></div>` : '') +
    // Reading somebody else's sheet: still say what is unfinished, since that
    // is worth knowing, but offer no button — it is not yours to fix.
    (missing.length ? `<div class="pagenote noprint">
      <div><b>This character still needs ${h(missing.join(' and '))}.</b>
        <span class="note">${readingSomeoneElse()
        ? 'Their player has not finished building it.'
        : 'The wizard walks you through what is left.'}</span></div>
      ${sheetReadOnly() ? '' : '<button class="btn primary" data-act="modify">Continue building →</button>'}
    </div>` : errs.length ? `<div class="pagenote noprint">
      <div><b>${errs.length} thing${errs.length > 1 ? 's' : ''} to tidy up:</b>
        <span class="note">${h(errs.slice(0, 2).map(i => i.text).join(' '))}${errs.length > 2 ? ' …' : ''}</span></div>
      ${sheetReadOnly() ? '' : '<button class="btn" data-act="modify">Fix in the wizard →</button>'}
    </div>` : '') +
    `<div class="csheet">
      <div class="cs-title">
        <div>
          <h1>${h(c.name || 'Unnamed character')}</h1>
          <div class="cs-id">${idFields.map(([k, v]) => `<div>
            <span class="k">${h(k)}</span><span class="v">${h(v)}</span></div>`).join('')}</div>
        </div>
        <div class="cs-sys">${h(S.name)}<br><span>${h(S.tag)}</span></div>
      </div>

      ${abilityBlock(c, d)}
      ${vitalsBlock(c, d)}
      ${sheetUI.log.length ? `<div class="cs-log noprint">${sheetUI.log.map((m, i) => `<div class="${i ? 'old' : ''}">${h(m)}</div>`).join('')}
        <button class="btn sm ghost" data-act="clearlog">clear</button></div>` : ''}
      ${spellPlayBlock(c, d)}
      ${resourceBlock(c, d)}

      ${sheetPanels(c, d)}

      ${columnise([
      saveBlock(c, d),
      attackBlock(c, d),
      castingBlock(c, d),
      skillBlock(c, d),
      proficiencyBlock(c, d),
      featureBlock(c, d, cls),
      traitBlock(c, S, lin, linSub),
      backgroundBlock(c, S, bg),
      choiceBlock(c),
      reminderBlock(c, d),
      gearBlock(c, d),
      campaignBlock(c),
      languageBlock(c),
      noteBlock(c),
      privacyBlock(real)
    ])}

      ${c.printSpellText ? spellTextSheet(c) : ''}
    </div>${levelUpModal(real)}`;
}

/* ---------------- sheet sub-pages: Inventory / Journal / Character ---------------- */
const PANEL_PAGES = {
  inventory: { title: 'Inventory', sub: 'Everything carried, worn and attuned' },
  journal:   { title: 'Journal',   sub: 'Session notes and entries' },
  character: { title: 'Character', sub: 'Background, roleplay and the record of this character' }
};

function sheetPanels(c, d) {
  const invN = (invItems(c) || []).length;
  const jN = (c.journal || []).length;
  const btn = (id, label, sub, count) =>
    `<button class="btn spanel-btn" data-act="sheetpanel" data-panel="${id}">
      <span class="spanel-t">${h(label)}${count ? ' <span class="spanel-n">' + count + '</span>' : ''}</span>
      <span class="spanel-s">${h(sub)}</span>
    </button>`;
  return `<div class="cs-box spanel-wrap noprint"><h4>Character pages</h4>
    <div class="spanel-nav">
      ${btn('inventory', 'Inventory', 'gear, weapons, encumbrance', invN)}
      ${btn('journal', 'Journal', 'session notes and entries', jN)}
      ${btn('character', 'Character', 'background, roleplay, history', 0)}
    </div></div>`;
}

function viewSheetPanel(c) {
  const S = sys(c.systemId);
  const d = derive(c);
  const meta = PANEL_PAGES[app.view] || PANEL_PAGES.character;
  const body = app.view === 'inventory' ? inventoryBlock(c, d)
    : app.view === 'journal' ? journalBlock(c)
    : characterPage(c);
  const other = Object.keys(PANEL_PAGES).filter(k => k !== app.view);
  return pageBar(c, 'sheet') +
    `<div class="pagebar noprint">
      <button class="btn" data-act="sheet">← Back to sheet</button>
      <div class="pagebar-title">
        <b>${h(c.name || 'Unnamed character')} — ${h(meta.title)}</b>
        <span>${h(meta.sub)}</span>
      </div>
      <div class="pagebar-acts">
        ${other.map(k => `<button class="btn" data-act="sheetpanel" data-panel="${k}">${h(PANEL_PAGES[k].title)}</button>`).join('')}
        <button class="btn" data-act="print">Print / PDF</button>
      </div>
    </div>
    <div class="csheet">${body}
      <div class="footbar noprint">
        <button class="btn" data-act="sheet">← Back to sheet</button>
      </div>
    </div>`;
}

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function logHistory(c, text) {
  if (!c) return;
  if (!c.history) c.history = [];
  c.history.push({ date: new Date().toISOString(), text: text, level: c.level });
}

function characterPage(c) {
  const S = sys(c.systemId);
  const history = (c.history || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const ro = typeof sheetReadOnly === 'function' && sheetReadOnly();
  if (ro) return `${flavourBlock(c) || '<div class="cs-box"><h4>Roleplay</h4><p class="note">Nothing recorded here.</p></div>'}
    ${characterRecord(c, S, history)}`;
  const a = c.appearance || {}, pr = c.personality || {};
  const line = (k, label, val) =>
    `<div class="field"><label>${h(label)}</label>
      <input data-field="${k}" value="${h(val || '')}"></div>`;
  const area = (k, label, val, min, hint) =>
    `<div class="field"><label>${h(label)}</label>
      <textarea data-field="${k}" style="min-height:${min}px" placeholder="${h(hint || '')}">${h(val || '')}</textarea></div>`;
  return `<div class="cs-box"><h4>Appearance <span class="note">edits save as you type</span></h4>
      <div class="grid3">
        ${line('appearance.age', 'Age', a.age)}
        ${line('appearance.height', 'Height', a.height)}
        ${line('appearance.weight', 'Weight', a.weight)}
        ${line('appearance.eyes', 'Eyes', a.eyes)}
        ${line('appearance.hair', 'Hair', a.hair)}
        ${line('appearance.skin', 'Skin', a.skin)}
      </div></div>
    <div class="cs-box"><h4>Personality</h4>
      ${area('personality.traits', 'Traits', pr.traits, 54, 'What stands out about you')}
      ${area('personality.ideals', 'Ideals', pr.ideals, 54, 'What you believe in')}
      ${area('personality.bonds', 'Bonds', pr.bonds, 54, 'Who or what matters most')}
      ${area('personality.flaws', 'Flaws', pr.flaws, 54, 'Your weakness or vice')}
    </div>
    <div class="cs-box"><h4>Backstory</h4>
      ${area('personality.backstory', 'Backstory', pr.backstory, 120, 'Where you came from, what you want, who you owe…')}
    </div>
    ${characterRecord(c, S, history)}`;
}

function characterRecord(c, S, history) {
  return `<div class="cs-box"><h4>Record</h4>
    <div class="cpanel">
      <div class="cpanel-col">
        ${kv([
          ['Created', fmtWhen(c.created)],
          ['Last edited', fmtWhen(c.updated)],
          ['System', S.name],
          ['Level', c.level],
          ['Player', c.player || '—']
        ])}
      </div>
      <div class="cpanel-col">
        <div class="cfield"><span class="k">Level history</span>
          ${history.length
            ? `<ul class="chist">${history.map(e => `<li><span class="jdate">${h(fmtWhen(e.date))}</span> ${h(e.text)}</li>`).join('')}</ul>`
            : '<p class="note">Levelling up and other milestones are logged here from now on.</p>'}
        </div>
      </div>
    </div></div>`;
}

/* ------------------------------------------------------------
   Spread the reference boxes over three columns of roughly equal
   height, instead of letting a plain grid leave ragged gaps.
   ------------------------------------------------------------ */
function columnise(blocks, columns) {
  const items = blocks.filter(b => b && b.trim())
    .map((html, i) => ({ html: html, weight: blockWeight(html), order: i }));
  const total = items.reduce((t, x) => t + x.weight, 0);
  const tallest = items.reduce((m, x) => Math.max(m, x.weight), 0);
  // Use fewer columns when there is little to show, or when one box is so tall
  // that extra columns would just sit half empty beside it.
  const n = columns || clamp(Math.min(
    Math.ceil(total / 26),
    Math.max(1, Math.round(total / Math.max(tallest, 1)))
  ), 1, Math.min(3, items.length));
  // Tallest first (longest-processing-time first): a big box placed last would
  // otherwise blow out whichever column it landed in.
  items.sort((a, b) => (b.weight - a.weight) || (a.order - b.order));
  const cols = Array.from({ length: n }, () => ({ parts: [], weight: 0 }));
  items.forEach(item => {
    let target = cols[0];
    cols.forEach(col => { if (col.weight < target.weight) target = col; });
    target.parts.push(item);
    target.weight += item.weight;
  });
  // inside each column, restore the original reading order
  const filled = cols.filter(col => col.parts.length);
  if (!filled.length) return '';
  return `<div class="cs-cols cols-${filled.length}">${filled.map(col =>
    `<div class="cs-col">${col.parts.sort((a, b) => a.order - b.order).map(p => p.html).join('')}</div>`
  ).join('')}</div>`;
}
/* Rough height of a block in "lines". Blocks that lay themselves out in two
   internal columns declare their own weight with data-w. */
function blockWeight(html) {
  const declared = html.match(/data-w="(\d+)"/);
  if (declared) return Number(declared[1]);
  const rows = (html.match(/<tr/g) || []).length;
  const items = (html.match(/<li/g) || []).length;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
  return 4 + rows + items * 1.3 + Math.ceil(text / 110);
}

/* ---------------- vitals ---------------- */
function vitalsBlock(c, d) {
  const hp = curHp(c), max = maxHp(c), temp = c.play.temp || 0;
  const pct = max ? Math.round(hp / max * 100) : 0;
  const bad = hp === 0 ? 'dead' : pct <= 25 ? 'low' : pct <= 50 ? 'half' : '';
  const tiles = vitalTiles(c, d);
  return `<div class="cs-vitals">
    <div class="hpbox ${bad}">
      <div class="hp-main">
        <div class="hp-head">
          <span class="k">Hit points</span>
          <span class="hp-num"><b>${hp}</b> / ${max}${temp ? ' <i>+' + temp + ' temp</i>' : ''}</span>
        </div>
        <div class="hpbar"><i style="width:${pct}%"></i>${temp ? `<u style="width:${Math.min(100, Math.round(temp / max * 100))}%"></u>` : ''}</div>
        ${hp === 0 ? '<div class="hp-warn">At 0 hit points.</div>' : d.bloodied && hp <= d.bloodied ? '<div class="hp-warn">Bloodied.</div>' : ''}
      </div>
      <div class="hp-ctl noprint">
        <button class="btn icobtn up" data-act="hp" data-delta="1" title="Heal 1" aria-label="Heal one hit point"></button>
        <button class="btn icobtn down" data-act="hp" data-delta="-1" title="Damage 1" aria-label="Take one point of damage"></button>
        <button class="btn icobtn reset" data-act="hpfull" title="Restore to full" aria-label="Restore to full hit points"></button>
      </div>
    </div>
    <div class="cs-tiles">${tiles.map(t => `<div class="tile">
      <div class="k">${h(t[0])}</div><div class="v">${h(t[1])}</div>${t[2] ? `<div class="s">${h(t[2])}</div>` : ''}
    </div>`).join('')}</div>
  </div>`;
}
function vitalTiles(c, d) {
  if (c.systemId === '5e' || c.systemId === '5.5e') return [
    ['Armour class', d.ac, d.acNote], ['Initiative', signed(d.initiative), ''],
    ['Speed', d.speed + ' ft.', ''], ['Prof. bonus', signed(d.profBonus), ''],
    ['Passive perception', d.passivePerception, ''], ['Hit dice', d.hitDice, '']
  ];
  if (c.systemId === '4e') return [
    ['AC', d.ac, d.acNote.split('(')[0]], ['Fortitude', d.fort, ''], ['Reflex', d.ref, ''], ['Will', d.will, ''],
    ['Initiative', signed(d.initiative), ''], ['Speed', d.speed, ''],
    ['Bloodied', d.bloodied, ''], ['Surge value', d.surgeValue, ''], ['Tier', d.tier, '']
  ];
  if (c.systemId === 'pf1') return [
    ['AC', d.ac, 'touch ' + d.touchAC + ' · flat-footed ' + d.flatFooted],
    ['Fort / Ref / Will', signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will), ''],
    ['Base attack', signed(d.bab), d.fullAttack || ''],
    ['CMB / CMD', signed(d.cmb) + ' / ' + d.cmd, ''],
    ['Initiative', signed(d.initiative), ''], ['Speed', d.speed, '']
  ];
  return [
    ['AC', d.ac, d.shieldAc ? 'shield raised ' + d.shieldAc : ''],
    ['Class DC', d.classDC, d.keyAbility],
    ['Perception', signed(d.perception), PROF_LABEL[d.perceptionRank]],
    ['Fort / Ref / Will', signed(d.fort) + ' / ' + signed(d.ref) + ' / ' + signed(d.will), ''],
    ['Speed', d.speed, ''], ['Bulk limit', d.bulkLimit, '']
  ];
}

/* ---------------- resources and rests ---------------- */
function resourceBlock(c, d) {
  const res = resourcesFor(c, d);
  const rests = RESTS[c.systemId] || [];
  if (!res.length && !rests.length) return '';
  const groups = {};
  res.forEach(r => (groups[r.group] = groups[r.group] || []).push(r));

  return `<div class="cs-res">
    <div class="cs-res-head">
      <h3>Resources</h3>
      <div class="restbtns noprint">
        ${rests.map(r => `<button class="btn sm" data-act="rest" data-kind="${r.kind}">${h(r.label)}</button>`).join('')}
        ${resourceById(c, 'hitdice', d) ? `<button class="btn sm" data-act="hitdie">Spend a hit die</button>` : ''}
        ${resourceById(c, 'surges', d) ? `<button class="btn sm" data-act="surge">Spend a healing surge</button>` : ''}
      </div>
    </div>
    ${rests.length ? `<div class="note resthint noprint">
      ${rests.map(r => '<b>' + h(r.label) + '</b> — ' + h(r.hint)).join(' · ')}
      ${res.some(r => r.max <= 12 && !r.pool) ? ' · Tap a filled box to spend one, an empty box to give one back.' : ''}
    </div>` : ''}
    ${res.length ? Object.keys(groups).map(g => `<div class="resgroup">
      <div class="resgroup-lab">${h(g)}</div>
      <div class="reslist">${groups[g].map(r => resourceRow(c, r)).join('')}</div>
    </div>`).join('') : '<p class="note">This character has no tracked daily resources.</p>'}
  </div>`;
}
/* compact slot pips used in the spell list and vital tiles */
function resPips(c, r, extraClass) {
  const u = used(c, r.id), left = r.max - u;
  if (r.pool || r.max > 12) {
    return `<span class="respool ${extraClass || ''}">
      <b>${left}</b> / ${r.max}
      <span class="resctl noprint">
        <button class="btn sm" data-act="resspend" data-id="${h(r.id)}">−</button>
        <button class="btn sm" data-act="resgain" data-id="${h(r.id)}">+</button>
      </span></span>`;
  }
  const pips = [];
  for (let i = 0; i < r.max; i++) {
    pips.push(`<button class="pip ${i < left ? '' : 'off'}" data-act="pip" data-id="${h(r.id)}" data-n="${i}"
      title="${i < left ? 'spend one' : 'restore one'}"></button>`);
  }
  return `<span class="pips ${extraClass || ''}">${pips.join('')}</span>`;
}

function resourceRow(c, r) {
  const u = used(c, r.id), left = r.max - u;
  const spent = left === 0;
  if (r.pool || r.max > 12) {
    return `<div class="resrow ${spent ? 'spent' : ''}">
      <span class="resname">${h(r.name)}</span>
      <span class="resnum"><b>${left}</b> / ${r.max}</span>
      <span class="resctl noprint">
        <button class="btn sm" data-act="resspend" data-id="${h(r.id)}">−</button>
        <button class="btn sm" data-act="resgain" data-id="${h(r.id)}">+</button>
      </span>
      <span class="resreset">${spent ? 'empty until a ' + restWord(r.reset) : 'back on a ' + restWord(r.reset)}</span>
    </div>`;
  }
  const pips = [];
  for (let i = 0; i < r.max; i++) {
    pips.push(`<button class="pip ${i < left ? '' : 'off'}" data-act="pip" data-id="${h(r.id)}" data-n="${i}"
      title="${i < left ? 'spend one' : 'restore one'}"></button>`);
  }
  return `<div class="resrow ${spent ? 'spent' : ''}">
    <span class="resname">${h(r.name)}</span>
    <span class="pips">${pips.join('')}</span>
    <span class="resnum">${left} / ${r.max}</span>
    <span class="resreset">${spent ? 'empty until a ' + restWord(r.reset) : 'back on a ' + restWord(r.reset)}</span>
    ${r.note ? `<span class="resnote">${h(r.note)}</span>` : ''}
  </div>`;
}

/* ---------------- abilities, saves, skills ---------------- */
function abilityBlock(c, d) {
  const s = c.finalScores;
  return `<div class="cs-box"><h4>Ability scores</h4>
    <div class="cs-abils">${ABIL6.map(a => `<div class="cs-ab">
      <div class="k">${h(ABIL_NAME[a])}</div><div class="v">${s[a]}</div><div class="m">${signed(mod(s[a]))}</div>
    </div>`).join('')}</div></div>`;
}
function saveBlock(c, d) {
  if (!d.saves || !d.saves.length) return '';
  return `<div class="cs-box"><h4>${(c.systemId === '5e' || c.systemId === '5.5e') ? 'Saving throws' : 'Saves'}</h4>
    <table>${d.saves.map(sv => `<tr>
      <td>${sv.prof !== undefined ? `<span class="dot ${sv.prof ? 'on' : ''}"></span>` : ''}${h(sv.name)}</td>
      <td class="num">${signed(sv.value)}</td>
      <td class="note">${h(sv.rank || '')}</td></tr>`).join('')}</table></div>`;
}
function skillBlock(c, d) {
  const row = sk => `<tr class="${sk.prof ? 'on' : ''}">
      <td>${c.systemId === 'pf2'
      ? `<span class="tag">${PROF_LABEL[sk.rank]}</span>`
      : `<span class="dot ${sk.exp ? 'ex' : sk.prof ? 'on' : ''}"></span>`}${h(sk.name)}</td>
      <td class="note">${h(ABIL_NAME[sk.ability].slice(0, 3))}</td>
      <td class="num">${signed(sk.value)}</td></tr>`;
  const legend = `<div class="note" style="margin-top:5px">${c.systemId === 'pf2'
    ? 'U untrained · T trained · E expert · M master · L legendary'
    : '● proficient · ◉ expertise'}</div>`;
  // Skill lists are the tallest thing on the sheet, so run them in two
  // columns rather than one long tower (5e has 18, Pathfinder 1e has 35).
  const split = d.skills.length > 12;
  if (!split) {
    return `<div class="cs-box" data-w="${6 + d.skills.length}"><h4>Skills</h4>
      <table>${d.skills.map(row).join('')}</table>${legend}</div>`;
  }
  const half = Math.ceil(d.skills.length / 2);
  return `<div class="cs-box" data-w="${7 + half}"><h4>Skills</h4>
    <div class="cs-split">
      <table>${d.skills.slice(0, half).map(row).join('')}</table>
      <table>${d.skills.slice(half).map(row).join('')}</table>
    </div>${legend}</div>`;
}
function attackBlock(c, d) {
  const atk = d.attacks || d.basicAttacks || [];
  if (!atk.length) return '';
  return `<div class="cs-box"><h4>Attacks</h4>
    <table>${atk.map(a => `<tr><td>${h(a.name)}</td><td class="num">${signed(a.value)}</td>
      <td class="note">${h(a.dmg || a.note || '')}</td></tr>`).join('')}</table>
    ${d.map ? `<div class="note" style="margin-top:5px">${h(d.map)}</div>` : ''}
    ${d.fullAttack ? `<div class="note">Full attack: ${h(d.fullAttack)}</div>` : ''}</div>`;
}
function castingBlock(c, d) {
  if (!d.spell) return '';
  const rows = sheetSpellRows(c, d);
  return `<div class="cs-box"><h4>Spellcasting</h4><table>${rows}</table></div>`;
}

/* ---------------- the live spell list ---------------- */
function spellPlayBlock(c, d) {
  const list = charSpells(c);
  if (!list.length) {
    if (!casterInfo(c)) return '';
    return `<div class="cs-box"><h4>Spells</h4>
      <p class="note">No spells chosen yet. <button class="btn sm noprint" data-act="modify">Pick some in the wizard</button></p></div>`;
  }
  const groups = {};
  list.forEach(sp => {
    const key = sp.focus ? 'focus' : spellLevelFor(c, sp);
    (groups[key] = groups[key] || []).push(sp);
  });
  const order = Object.keys(groups).sort((a, b) => (a === 'focus' ? 99 : +a) - (b === 'focus' ? 99 : +b));

  return `<div class="cs-box"><h4>Spells — tap Cast to spend a slot</h4>
    ${order.map(k => {
    const lvl = k === 'focus' ? null : +k;
    const res = lvl ? resourceById(c, 'slot' + lvl, d) : (k === 'focus' ? resourceById(c, 'focus', d) : null);
    const pact = lvl && resourceById(c, 'pact', d);
    const track = res || pact || null;
    const left = track ? track.max - used(c, track.id) : null;
    return `<div class="spgroup">
        <div class="spgroup-head">
          <b>${h(k === 'focus' ? 'Focus spells' : levelLabel(c, lvl))}</b>
          ${track ? resPips(c, track, 'sp-pips tiny') : ''}
          ${track ? `<span class="spslots ${left === 0 ? 'out' : ''}">${left} of ${track.max} ${track.id === 'focus' ? 'focus points' : 'slots'} left</span>` : ''}
          ${lvl === 0 ? '<span class="note">at will</span>' : ''}
        </div>
        <table class="sp-play">
            <colgroup><col><col style="width:132px"><col style="width:100px"><col style="width:80px"><col style="width:96px"></colgroup>
            <thead><tr>
              <th>Spell</th><th>Cast time</th><th>Range</th><th>Roll</th><th class="noprint" style="text-align:right">Use</th>
            </tr></thead>
            <tbody>${groups[k].map(sp => spellPlayRow(c, sp, d)).join('')}</tbody>
          </table>
      </div>`;
  }).join('')}
  </div>`;
}
function spellDice(sp) {
  // Extract the first dice expression from the spell description (e.g. "3d8", "1d10")
  const m = (sp.text || '').match(/\b(\d+d\d+)\b/);
  return m ? m[1] : null;
}

function spellPlayRow(c, sp, d) {
  const cost = castCost(c, sp);
  const out = !!cost.none;
  const open = sheetUI.openSpell === sp.uid;
  const spell = d && d.spell;
  const dice = spellDice(sp);
  // Primary: damage dice if available. Secondary: attack bonus or save type.
  let rollLine = '';
  if (dice) {
    rollLine = `<b>${h(dice)}</b>`;
    if (sp.save) rollLine += ` <span class="note">${h(sp.save)} sv</span>`;
    else if (sp.damageType && spell) rollLine += ` <span class="note">${signed(spell.attack)} atk</span>`;
  } else if (sp.save) {
    rollLine = `<span class="note">${h(sp.save)} sv</span>`;
  } else if (sp.damageType && spell) {
    rollLine = `<span class="note">${signed(spell.attack)} atk</span>`;
  } else {
    rollLine = '<span class="note">\u2014</span>';
  }
  const rollCol = `<span style="white-space:nowrap">${rollLine}</span>`;
  return `<tr class="${out ? 'spent' : ''}">
    <td>
      <button class="btn sm ghost noprint" data-act="spinfo" data-uid="${h(sp.uid)}" style="padding:1px 5px">${open ? '▾' : '▸'}</button>
      ${h(sp.name)}
      ${isPrepared(c, sp.uid) ? '<span class="tag">prepared</span>' : ''}
      ${sp.concentration ? '<span class="tag">conc</span>' : ''}
      ${sp.ritual ? '<span class="tag">ritual</span>' : ''}
      ${out ? `<span class="unavail">unavailable — ${h(cost.label.toLowerCase())}, recharges on a ${h(restWord(restForSpell(c, sp)))}</span>` : ''}
    </td>
    <td class="note">${h(sp.castingTime || '')}</td>
    <td class="note">${h(sp.range || '')}</td>
    <td>${rollCol}</td>
    <td class="noprint" style="text-align:right;white-space:nowrap">
      ${out ? `<span class="note">no slot</span>`
      : `<button class="btn sm ${cost.free ? '' : 'primary'}" data-act="cast" data-uid="${h(sp.uid)}">Cast</button>`}
    </td>
  </tr>${open ? `<tr><td colspan="5" class="spdetail">${spellDetail(c, sp)}</td></tr>` : ''}`;
}
function restForSpell(c, sp) {
  const lv = spellLevelFor(c, sp);
  const d = derive(c);
  if (c.systemId === 'pf2' && sp.focus) return 'refocus';
  const r = resourceById(c, 'slot' + lv, d) || resourceById(c, 'pact', d);
  return r ? r.reset : 'long';
}

/* ---------------- features, traits, gear, flavour ---------------- */
function featureBlock(c, d, cls) {
  if (!d.features || !d.features.length) return '';
  const many = d.features.length > 12;
  return `<div class="cs-box" data-w="${5 + Math.ceil(d.features.length * (many ? 0.75 : 1.4))}"><h4>Class features</h4>
    <ul class="cs-list ${many ? 'two' : ''}">${d.features.map(f => `<li>${h(f.text)} <span class="note">(${f.level})</span></li>`).join('')}</ul>
    ${c.systemId === '4e' && d.powers ? `<div style="margin-top:8px">
      ${[['atwill', 'At-Will'], ['encounter', 'Encounter'], ['daily', 'Daily']].map(([k, label]) => d.powers[k] && d.powers[k].length
      ? `<div class="note" style="margin-bottom:4px"><b>${label}:</b> ${h(d.powers[k].join('; '))}</div>` : '').join('')}
    </div>` : ''}</div>`;
}
function proficiencyBlock(c, d) {
  if (!d.profRows) return '';
  return `<div class="cs-box"><h4>Proficiencies</h4>
    <table>${d.profRows.map(r => `<tr><td style="white-space:nowrap">${h(r.label)}</td><td>${h(r.value)}</td></tr>`).join('')}</table></div>`;
}
function traitBlock(c, S, lin, linSub) {
  const traits = [].concat(lin ? (lin.traits || []) : [], linSub ? (linSub.traits || []) : []);
  if (!traits.length) return '';
  return `<div class="cs-box"><h4>${h(S.lineageLabel)} traits</h4>
    <ul class="cs-list">${traits.map(t => `<li><b>${h(t.name)}.</b> ${h(t.text)}</li>`).join('')}</ul></div>`;
}
function backgroundBlock(c, S, bg) {
  if (!bg) return '';
  const bits = [bg.feature && bg.feature !== '—' ? bg.feature : '', bg.feat ? 'Skill feat: ' + bg.feat : '',
  bg.loreSkill ? 'Lore: ' + bg.loreSkill : '', (bg.tools || []).length ? 'Tools: ' + bg.tools.join(', ') : ''].filter(Boolean);
  if (!bits.length) return '';
  return `<div class="cs-box"><h4>${h(S.backgroundLabel)}: ${h(bg.name)}</h4>
    <div class="prose">${h(bits.join('\n'))}</div></div>`;
}
function choiceBlock(c) {
  const keys = Object.keys(c.choices || {}).filter(k => c.choices[k]);
  if (!keys.length) return '';
  return `<div class="cs-box"><h4>Choices</h4><table>${keys
    .map(k => `<tr><td>${h(k)}</td><td>${h(c.choices[k])}</td></tr>`).join('')}</table></div>`;
}
function reminderBlock(c, d) {
  if (!d.notes || !d.notes.length) return '';
  return `<div class="cs-box"><h4>Rules reminders</h4><ul class="cs-list">${d.notes.map(n => `<li>${h(n)}</li>`).join('')}</ul></div>`;
}
function gearBlock(c, d) {
  if (!c.gear && !c.gold) return '';
  return `<div class="cs-box"><h4>Equipment notes${c.gold ? ' — ' + h(c.gold) : ''}</h4>
    <div class="prose">${h(c.gear || '')}</div>
    ${d.carry ? `<div class="note" style="margin-top:5px">Carry ${d.carry.carry} lb · push or drag ${d.carry.push} lb</div>` : ''}</div>`;
}
function languageBlock(c) {
  if (!(c.languages || []).length) return '';
  return `<div class="cs-box"><h4>Languages</h4><div class="prose">${h(c.languages.join(', '))}</div></div>`;
}
function noteBlock(c) {
  if (!c.notes) return '';
  return `<div class="cs-box"><h4>Feats &amp; options</h4><div class="prose">${h(c.notes)}</div></div>`;
}
function flavourBlock(c) {
  const p = c.personality || {}, a = c.appearance || {};
  const app2 = ['age', 'height', 'weight', 'eyes', 'hair', 'skin'].filter(k => a[k]).map(k => k + ' ' + a[k]).join(', ');
  const bits = [];
  if (app2) bits.push(['Appearance', app2]);
  ['traits', 'ideals', 'bonds', 'flaws'].forEach(k => { if (p[k]) bits.push([k[0].toUpperCase() + k.slice(1), p[k]]); });
  if (!bits.length && !p.backstory) return '';
  return `<div class="cs-box"><h4>Character</h4>
    ${bits.map(([k, v]) => `<div class="prose"><b>${h(k)}:</b> ${h(v)}</div>`).join('')}
    ${p.backstory ? `<div class="prose" style="margin-top:6px">${h(p.backstory)}</div>` : ''}</div>`;
}

/* keep the old helper name used by castingBlock */
function sheetSpellRows(c, d) {
  const sp = d.spell;
  const rows = [];
  if (sp.tradition) rows.push(['Tradition', sp.tradition]);
  if (sp.ability) rows.push(['Ability', sp.ability]);
  if (sp.kind) rows.push(['Type', sp.kind]);
  if (sp.dc) rows.push(['Save DC', sp.dc]);
  if (sp.attack !== undefined) rows.push(['Attack', signed(sp.attack)]);
  if (sp.saveDCbase) rows.push(['Save DC', sp.saveDCbase + ' + spell level']);
  if (sp.casterLevel) rows.push(['Caster level', sp.casterLevel]);
  if (sp.maxSpellLevel) rows.push(['Highest level', sp.maxSpellLevel]);
  if (sp.maxRank) rows.push(['Highest rank', sp.maxRank]);
  if (sp.cantrips) rows.push(['Cantrips', sp.cantrips]);
  if (sp.prepared) rows.push(['Prepared', sp.prepared]);
  if (sp.note) rows.push(['Pact magic', sp.note]);
  if (sp.slotsPerRank) rows.push(['Slots', sp.slotsPerRank]);
  if (sp.bonusSlots && Object.keys(sp.bonusSlots).length) rows.push(['Bonus slots', Object.keys(sp.bonusSlots).map(k => k + ': +' + sp.bonusSlots[k]).join(', ')]);
  return rows.map(([k, v]) => `<tr><td>${h(k)}</td><td>${h(v)}</td></tr>`).join('');
}

/* ============================================================
   Sheet events
   ============================================================ */
document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const c = cur();
  if (!c) return;
  const amount = () => {
    const box = document.getElementById('hpAmt');
    const n = box ? Number(box.value) : 0;
    return n > 0 ? n : 1;
  };

  switch (act) {
    case 'hp': setHp(c, curHp(c) + Number(el.dataset.delta)); persist(); render(); return;
    case 'dmg': {
      const n = amount(); const before = curHp(c);
      applyDamage(c, n);
      logPlay('Took ' + n + ' damage (' + before + ' → ' + curHp(c) + ').' + (curHp(c) === 0 ? ' Down!' : ''));
      persist(); render(); return;
    }
    case 'heal': {
      const n = amount(); const before = curHp(c);
      applyHeal(c, n);
      logPlay('Healed ' + n + ' (' + before + ' → ' + curHp(c) + ').');
      persist(); render(); return;
    }
    case 'hpfull': setHp(c, maxHp(c)); c.play.temp = 0; logPlay('Back to full hit points.'); persist(); render(); return;
    case 'pip': {
      const d = derive(c);
      const r = resourceById(c, el.dataset.id, d);
      if (!r) return;
      const n = Number(el.dataset.n);
      const left = r.max - used(c, r.id);
      // a filled pip spends one; an empty pip gives one back
      setUsed(c, r.id, used(c, r.id) + (n < left ? 1 : -1), r.max);
      persist(); render(); return;
    }
    case 'resspend': case 'resgain': {
      const d = derive(c);
      const r = resourceById(c, el.dataset.id, d);
      if (!r) return;
      setUsed(c, r.id, used(c, r.id) + (act === 'resspend' ? 1 : -1), r.max);
      persist(); render(); return;
    }
    case 'rest': {
      const res = doRest(c, el.dataset.kind);
      const bits = [];
      if (res.healed) bits.push('healed ' + res.healed + ' HP');
      if (res.restored.length) bits.push('restored ' + res.restored.slice(0, 4).join(', ') + (res.restored.length > 4 ? '…' : ''));
      logPlay((el.dataset.kind === 'refocus' ? 'Refocused' : 'Rested') + (bits.length ? ': ' + bits.join('; ') + '.' : ' — nothing needed restoring.'));
      persist(); render(); return;
    }
    case 'hitdie': { const r = spendHitDie(c); logPlay(r.message); persist(); render(); return; }
    case 'surge': { const r = spendSurge(c); logPlay(r.message); persist(); render(); return; }
    case 'cast': {
      const sp = spellByUid(c.systemId, el.dataset.uid);
      if (!sp) return;
      const r = castSpell(c, sp);
      logPlay(r.message);
      persist(); render(); return;
    }
    case 'spinfo': sheetUI.openSpell = sheetUI.openSpell === el.dataset.uid ? null : el.dataset.uid; render(); return;
    case 'clearlog': sheetUI.log = []; render(); return;
  }
});

document.addEventListener('change', function (ev) {
  if (ev.target.dataset && ev.target.dataset.act === 'temphp') {
    const c = cur(); if (!c) return;
    playInit(c).temp = Math.max(0, Number(ev.target.value) || 0);
    persist(); render();
  }
});
