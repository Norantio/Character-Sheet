/* Integration test: loads the built HTML in jsdom and clicks through it.
   Run: NODE_PATH=<jsdom dir> node src/test-dom.js */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(path.dirname(__dirname), 'character-forge.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0; const fails = [];
const jsErrors = [];
function ok(label, cond, extra) { if (cond) pass++; else { fail++; fails.push(label + (extra ? ' — ' + extra : '')); } }
function eq(label, got, want) { ok(label + ' (got ' + got + ')', String(got) === String(want), 'expected ' + want); }
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  if (/Not implemented/.test(e.message)) return;   // window.print / scrollTo noise
  jsErrors.push(e.message + '\n' + (e.detail && e.detail.stack ? e.detail.stack : ''));
});
vc.on('error', m => jsErrors.push('console.error: ' + m));

function boot(seedRoster) {
  const d = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.confirm = () => true;
      w.alert = () => { };
      w.print = () => { };
      // jsdom has no real scrolling; record what the app asks for
      w.__scrolls = [];
      w.__fakeY = 0;
      w.scrollTo = function (x, y) {
        w.__scrolls.push(typeof x === 'object' && x !== null ? x.top : y);
      };
      Object.defineProperty(w, 'scrollY', { configurable: true, get: () => w.__fakeY });
      Object.defineProperty(w, 'pageYOffset', { configurable: true, get: () => w.__fakeY });
      if (seedRoster) w.localStorage.setItem('characterForge.roster.v2', JSON.stringify(seedRoster));
    }
  });
  // boot() is async now (it decides between local and server mode first), so
  // wait for the first real paint rather than a single tick.
  return new Promise((res, rej) => {
    let tries = 0;
    const painted = () => {
      const app = d.window.document.getElementById('app');
      if (app && app.innerHTML.length > 500) return res(d);
      if (++tries > 200) return rej(new Error('the app never painted'));
      setTimeout(painted, 5);
    };
    const done = () => setTimeout(painted, 0);
    if (d.window.document.readyState === 'complete') done();
    else d.window.addEventListener('load', done);
  });
}

let win, doc;
const $ = sel => doc.querySelector(sel);
const $$ = sel => Array.from(doc.querySelectorAll(sel));
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
function setSelect(field, value) {
  const el = $$('select').find(s => s.dataset.field === field);
  if (!el) return null;
  el.value = value;
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
  return el;
}
// Real checkboxes fire click (then change) when toggled; the app listens for click.
function setCheck(el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}
// Only the rendered UI — body.textContent would also include the inline <script> source,
// which makes every assertion match its own source code.
function text() {
  return (($('#topbar') || {}).textContent || '') + ' ' + (($('#app') || {}).textContent || '');
}
function railValue(label) {
  const kv = $$('.rail .kv').find(k => k.firstElementChild && k.firstElementChild.textContent.trim() === label);
  return kv ? kv.lastElementChild.textContent.trim() : null;
}
function openByName(name) {          // -> the character's own page
  const card = $$('.rcard').find(x => x.textContent.includes(name));
  if (!card) throw new Error('no roster card named ' + name);
  click(card.querySelector('[data-act="open"]'));
}
function editByName(name) {          // -> the character page, then into the wizard
  openByName(name);
  click('.pagebar [data-act="modify"]');
}
// The front page now has a single Create button; the system is chosen on step one.
function createChar(sysId) {
  click('[data-act="create"]');
  const card = $$('[data-act="setsys"]').find(b => b.dataset.sys === sysId);
  if (!card) throw new Error('no system card for ' + sysId);
  click(card);
  if (!/Identity/.test(($('.step.active') || {}).textContent || '')) click(stepButton('Identity'));
}
function goHome() {                  // the homepage has no "back" button of its own
  const b = $('[data-act="roster"]');
  if (b) click(b);
  if (!/Your characters/.test(text())) throw new Error('not on the homepage');
}
// pick a catalogue row by its exact name, not just the first search hit
async function addFromCatalogue(name) {
  setInput('[data-invf="q"]', name);
  await new Promise(r => setTimeout(r, 260));
  const row = $$('.inv-cat tbody tr').find(r =>
    r.children[0].textContent.trim().toLowerCase().startsWith(name.toLowerCase()));
  if (!row) throw new Error('catalogue has no row for ' + name + '; offered: ' +
    $$('.inv-cat tbody tr').map(r => r.children[0].textContent.trim().split('\n')[0]).join(' | '));
  click(row.querySelector('[data-act="invadd"]'));
}
function stepButton(name) {
  const b = $$('.step').find(x => x.textContent.trim().includes(name));
  if (!b) throw new Error('no step button matching "' + name + '"; steps are: ' + $$('.step').map(x => x.textContent.trim()).join(', '));
  return b;
}

async function main() {
  const dom = await boot();
  win = dom.window; doc = win.document;

  /* ---------- boot ---------- */
  section('Boot');
  ok('app container rendered', $('#app').innerHTML.length > 500);
  ok('topbar shows the brand', /Character Forge/.test($('#topbar').textContent));
  // Step 1 promised local mode looks exactly as it did before the server existed.
  ok('a connection bar element exists', !!$('#connbar'));
  eq('the connection bar is empty in local mode', $('#connbar').innerHTML, '');
  eq('so it contributes no text', $('#connbar').textContent, '');
  ok('the store reports local mode', win.eval('STORE.mode') === 'local');
  ok('and reports itself as not connected', win.eval('isConnected()') === false);
  ok('no sign-in screen in local mode', !/Who are you/.test(text()));
  ok('and no sign-out button', $$('[data-act="signout"]').length === 0);
  eq('front page has one Create button', $$('[data-act="create"]').length, 1);
  eq('front page has an Import button', $$('[data-act="import"]').length, 1);
  ok('front page leads with the character list', /Your characters/.test(text()));
  ok('empty state explains the wizard', /No characters yet/.test(text()));
  ok('front page reports the bundled spell counts', /319 spells with full rules text/.test(text()));
  ok('front page reports the pf2 catalogue', /1542 spells with full rules text/.test(text()));
  ok('SRD attribution is visible to the user', /System Reference Document 5.1 Copyright 2016/.test(text()));
  ok('Paizo Community Use notice is visible', /Community Use Policy/.test(text()));
  ok('OGL is named', /Open Gaming License/.test(text()));
  ok('all four systems named', ['5th Edition', '4th Edition', 'Pathfinder 1st', 'Pathfinder 2nd'].every(n => text().includes(n)));
  ok('no JS errors on load', jsErrors.length === 0, jsErrors[0]);

  /* ---------- the guided wizard ---------- */
  section('Front page and guided wizard');
  click('[data-act="create"]');
  ok('Create starts on the system step', /Which game are you playing/.test(text()));
  ok('the system step is step one of twelve', /step one of 12/.test(text()));
  eq('system step is the active one', $('.step.active').textContent.includes('Game System'), true);
  ok('a progress bar is shown', !!$('.progress .bar'));
  ok('progress reads step 1 of 12', /Step 1 of 12/.test(text()));
  ok('all four systems are offered on the step', $$('[data-act="setsys"]').length === 4);
  ok('Next names the step it leads to', /Next: Identity/.test(text()));
  click($$('[data-act="setsys"]').find(b => b.dataset.sys === 'pf2'));
  ok('choosing a system advances the wizard', /Identity/.test($('.step.active').textContent));
  ok('no confirmation prompt on a fresh character', /PF 2e/.test($('#topbar').textContent));
  click(stepButton('Game System'));
  click($$('[data-act="setsys"]').find(b => b.dataset.sys === '5e'));
  ok('switching again still advances', /Identity/.test($('.step.active').textContent));
  // abandoning a blank character should not leave clutter behind
  goHome();
  eq('abandoned blank character was discarded', $$('.rcard').length, 0);
  ok('still showing the empty state', /No characters yet/.test(text()));

  /* ---------- 5e end-to-end ---------- */
  section('5e: full build via clicks');
  createChar('5e');
  ok('switched to the builder', $$('.step').length > 5);
  ok('identity step is active', /Identity/.test($('.step.active').textContent));
  ok('right rail is showing live stats', $$('.rail .stat').length === 6);

  setInput('[data-field="name"]', 'Thoradin Emberhand');
  ok('name written to storage', /Thoradin Emberhand/.test(win.localStorage.getItem('characterForge.roster.v2')));

  click(stepButton('Race'));
  ok('race step lists Dwarf', /Dwarf/.test(text()));
  eq('nine 5e races offered', $$('[data-field="lineageId"]').length, 9);
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'dwarf'));
  ok('dwarf is selected', $$('[data-field="lineageId"]').find(b => b.dataset.val === 'dwarf').classList.contains('sel'));
  ok('dwarf traits shown', /Dwarven Resilience/.test(text()));
  eq('two dwarf subraces', $$('[data-field="lineageSubId"]').length, 2);
  click($$('[data-field="lineageSubId"]').find(b => b.dataset.val === 'hill'));
  ok('hill dwarf selected', $$('[data-field="lineageSubId"]').find(b => b.dataset.val === 'hill').classList.contains('sel'));
  // point buy starts everything at 8, so the dwarf's +2 shows as 10
  eq('dwarf +2 Con visible in the rail', $$('.rail .stat')[2].querySelector('.v').textContent.trim(), 10);

  click(stepButton('Class'));
  eq('twelve 5e classes offered', $$('[data-field="classId"]').length, 12);
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'fighter'));
  ok('fighter selected and detailed', /Second Wind|Fighting Style/.test(text()));
  ok('fighting style dropdown offered', !!setSelect('choices.fightingStyle', 'Defense (+1 AC in armor)'));

  click(stepButton('Background'));
  click($$('[data-field="backgroundId"]').find(b => b.dataset.val === 'soldier'));
  ok('soldier feature shown', /Military Rank/.test(text()));

  click(stepButton('Abilities'));
  ok('point buy shows a 27 point budget', /\/ 27/.test(text()));
  for (let i = 0; i < 7; i++) click($$('[data-act="pbinc"]').find(b => b.dataset.abil === 'str'));
  for (let i = 0; i < 6; i++) click($$('[data-act="pbinc"]').find(b => b.dataset.abil === 'con'));
  for (let i = 0; i < 5; i++) click($$('[data-act="pbinc"]').find(b => b.dataset.abil === 'dex'));
  const strCard = $$('.abil').find(a => /Strength/.test(a.textContent));
  eq('Str raised to 15 by clicking +', strCard.querySelector('.v').textContent.trim(), 15);
  ok('budget line shows points spent', /2\d \/ 27/.test(text()));
  ok('final scores panel credits the racial bonus', /race/.test(text()));

  click($$('[data-act="method"]').find(b => b.dataset.val === 'array'));
  ok('array method offers presets', /Standard Array/.test(text()));
  click('[data-act="autoarray"]');
  ok('auto-assign satisfied the array check', !/Assign all six array/.test($('.rail').textContent));
  click($$('[data-act="method"]').find(b => b.dataset.val === 'roll'));
  click('[data-act="rollscores"]');
  eq('rolling produced six values', $$('.pool .die').length, 6);
  click('[data-act="autoroll"]');
  ok('rolled values auto-assigned', !/Assign all six rolled/.test($('.rail').textContent));
  click('[data-act="rollscores7"]');
  eq('roll-seven-drop-one still yields six', $$('.pool .die').length, 6);
  click($$('[data-act="method"]').find(b => b.dataset.val === 'pointbuy'));
  eq('point buy values were preserved through the detour',
    $$('.abil').find(a => /Strength/.test(a.textContent)).querySelector('.v').textContent.trim(), 15);

  click(stepButton('Skills'));
  const boxes = $$('input[data-act="toggleskill"]').filter(b => !b.disabled);
  ok('skill checkboxes available', boxes.length > 3);
  setCheck(boxes[0]);
  ok('skill choice counted', /[12] \/ 2 chosen/.test(text()));

  click(stepButton('Gear'));
  setSelect('armor', 'Chain Mail');
  eq('AC follows chain mail', railValue('Armor Class'), '16');
  click('[data-act="toggleshield"]');
  eq('AC includes the shield', railValue('Armor Class'), '18');
  click($$('[data-act="togglelang"]').find(b => b.dataset.val === 'Dwarvish'));
  ok('language toggled on', $$('[data-act="togglelang"]').find(b => b.dataset.val === 'Dwarvish').classList.contains('sel'));
  click('[data-act="fillgear"]');
  ok('starting kit copied into gear', /Chain mail|Martial weapon/.test($$('textarea').map(t => t.value).join(' ')));

  click(stepButton('Roleplay'));
  setInput('[data-field="personality.ideals"]', 'Honour above all.');
  ok('ideals stored', /Honour above all/.test(win.localStorage.getItem('characterForge.roster.v2')));

  click(stepButton('Review'));
  ok('review names the character', /Thoradin Emberhand/.test(text()));
  ok('review reports readiness', /No blocking problems|still need attention/.test(text()));

  /* ---------- advancement ---------- */
  section('5e: advancement');
  click(stepButton('Advancement'));
  const hpBefore = Number(railValue('Hit Points'));
  click('[data-act="levelup"]');
  ok('level up raised HP (' + hpBefore + ' -> ' + railValue('Hit Points') + ')', Number(railValue('Hit Points')) > hpBefore);
  ok('topbar shows level 2', /Level 2/.test($('#topbar').textContent));
  click('[data-act="levelup"]'); click('[data-act="levelup"]');
  eq('now level 4', ($('#topbar').textContent.match(/Level (\d+)/) || [])[1], 4);
  ok('level-4 ASI selector appeared', $$('select').some(s => (s.dataset.field || '').startsWith('levelAsi.4.')));
  setSelect('levelAsi.4.0', 'str');
  setSelect('levelAsi.4.1', 'con');
  eq('ASI raised Str to 16', $$('.rail .stat')[0].querySelector('.v').textContent.trim(), 16);
  eq('proficiency bonus still +2 at level 4', railValue('Prof. Bonus'), '+2');
  click('[data-act="levelup"]');
  eq('proficiency bonus becomes +3 at level 5', railValue('Prof. Bonus'), '+3');
  ok('Extra Attack listed in features', /Extra Attack/.test(text()));

  /* ---------- spellbook: build a wizard and pick spells by clicking ---------- */
  section('Spellbook: 5e wizard via clicks');
  goHome();
  createChar('5e');
  setInput('[data-field="name"]', 'Vex Nightquill');
  click(stepButton('Race'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'elf'));
  click($$('[data-field="lineageSubId"]').find(b => b.dataset.val === 'high'));
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'wizard'));
  click(stepButton('Background'));
  click($$('[data-field="backgroundId"]').find(b => b.dataset.val === 'sage'));
  click(stepButton('Abilities'));
  click($$('[data-act="method"]').find(b => b.dataset.val === 'array'));
  click('[data-act="autoarray"]');
  click(stepButton('Advancement'));
  for (let i = 0; i < 4; i++) click('[data-act="levelup"]');
  eq('wizard is level 5', ($('#topbar').textContent.match(/Level (\d+)/) || [])[1], 5);

  click(stepButton('Spells'));
  ok('spell step shows the spellcasting header', /Spellcasting/.test(text()));
  ok('spell save DC shown', railValue('Spell Save DC') !== null || /Spell save DC/.test(text()));
  ok('slots line shown', /Slots/.test(text()));
  ok('three spell tabs offered', $$('[data-act="sptab"]').length >= 3);
  ok('empty spellbook prompts you to browse', /Nothing chosen yet/.test(text()));

  // starter set
  click('[data-act="spsuggest"]');
  ok('starter set filled the book', !/Nothing chosen yet/.test(text()));
  ok('book groups by level', /Cantrips/.test(text()));
  const bookCount = (text().match(/My spellbook \((\d+)\)/) || [])[1];
  ok('spell count appears in the tab label (' + bookCount + ')', Number(bookCount) > 0);

  // browse and add a specific spell
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'browse'));
  const wizMatches = Number((text().match(/(\d+) of 319 spells match/) || [])[1]);
  ok('catalogue reports wizard-only matches (' + wizMatches + ')', wizMatches > 40 && wizMatches < 319);
  setInput('[data-spf="q"]', 'fireball');
  await new Promise(r => setTimeout(r, 260));
  ok('search narrowed the catalogue', /Fireball/.test(text()));
  const addBtns = $$('[data-act="spadd"]');
  ok('an Add button is available', addBtns.length > 0);
  const beforeAdd = ($$('[data-act="sptab"]').find(b => b.dataset.val === 'book').textContent.match(/\((\d+)\)/) || [])[1];
  click(addBtns[0]);
  const afterAdd = ($$('[data-act="sptab"]').find(b => b.dataset.val === 'book').textContent.match(/\((\d+)\)/) || [])[1];
  eq('adding a spell raised the count', Number(afterAdd), Number(beforeAdd) + 1);
  ok('rail tracks chosen spells', railValue('Spells chosen') !== null);

  // expand a spell to read it
  click($$('[data-act="spopen"]')[0]);
  ok('spell detail expands with rules text', /Casting time|Components|Duration/.test(text()));
  click($$('[data-act="spopen"]')[0]);

  // level filter
  setSelect('level', '3');
  const lvlSel = $$('select').find(s => s.dataset.spf === 'level');
  lvlSel.value = '3'; lvlSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  ok('level filter applied', $$('table tbody tr').length > 0);

  // off-list toggle — clear the search and level filter first
  setInput('[data-spf="q"]', '');
  await new Promise(r => setTimeout(r, 260));
  const lvlSel2 = $$('select').find(s => s.dataset.spf === 'level');
  lvlSel2.value = 'all'; lvlSel2.dispatchEvent(new win.Event('change', { bubbles: true }));
  click('[data-act="sponly"]');
  const wide = Number((text().match(/(\d+) of 319 spells match/) || [])[1]);
  eq('unticking the class filter shows every 5e spell', wide, 319);
  click('[data-act="sponly"]');
  const narrow = Number((text().match(/(\d+) of 319 spells match/) || [])[1]);
  ok('re-ticking it narrows to the wizard list (' + narrow + ')', narrow > 40 && narrow < 319);

  // remove a spell from the book
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'book'));
  const delBtns = $$('[data-act="spdel"]');
  ok('remove buttons available in the book', delBtns.length > 0);
  const beforeDel = ($$('[data-act="sptab"]').find(b => b.dataset.val === 'book').textContent.match(/\((\d+)\)/) || [])[1];
  click(delBtns[0]);
  const afterDel = ($$('[data-act="sptab"]').find(b => b.dataset.val === 'book').textContent.match(/\((\d+)\)/) || [])[1];
  eq('removing a spell lowered the count', Number(afterDel), Number(beforeDel) - 1);

  // prepared toggles (wizard is a prepared caster)
  const prepBoxes = $$('input[data-act="spprep"]');
  ok('prepared checkboxes shown for a wizard', prepBoxes.length > 0);
  setCheck(prepBoxes[prepBoxes.length - 1]);
  ok('prepared count tracked', /prepared/.test($('.rail').textContent) || /Spells prepared/.test(text()));

  // spells reach the sheet
  click('[data-act="sheet"]');
  ok('sheet has a Spells box', /Spells/.test($('.csheet').textContent));
  ok('sheet lists a cantrip heading', /Cantrips/.test($('.csheet').textContent));
  ok('sheet shows the prepared legend', /prepared/.test($('.csheet').textContent));
  const sheetLen = $('.csheet').textContent.length;
  click('.pagebar [data-act="modify"]');
  click(stepButton('Spells'));
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'book'));
  click('[data-act="spprinttext"]');
  click('[data-act="sheet"]');
  ok('full spell text option lengthens the sheet', $('.csheet').textContent.length > sheetLen);
  ok('printed descriptions appear', /Spell descriptions/.test($('.csheet').textContent));
  click('.pagebar [data-act="modify"]');

  /* ---------- spellbook in the other systems ---------- */
  section('Spellbook: PF2 and PF1');
  goHome();
  createChar('pf2');
  setInput('[data-field="name"]', 'Ezren Goldbraid');
  click(stepButton('Ancestry'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'elf'));
  click($$('[data-field="lineageSubId"]')[0]);
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'wizard'));
  click(stepButton('Background'));
  click($$('[data-field="backgroundId"]').find(b => b.dataset.val === 'scholar'));
  click(stepButton('Abilities'));
  click('[data-act="autoboost"]');
  click(stepButton('Spells'));
  ok('pf2 spell step names the tradition', /Arcane/.test(text()));
  ok('pf2 shows slots by rank', /Slots by rank/.test(text()));
  click('[data-act="spsuggest"]');
  ok('pf2 starter filled the repertoire', /Rank 1|Cantrips/.test(text()));
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'browse'));
  const pf2Total = Number((text().match(/(\d+) of 1542 spells match/) || [])[1]);
  ok('pf2 catalogue reports arcane matches (' + pf2Total + ')', pf2Total > 100 && pf2Total < 1542);
  ok('pf2 rows show traits', /concentrate|manipulate/.test(text()));
  const traitSel = $$('select').find(s => s.dataset.spf === 'school');
  ok('pf2 filter offers traits', traitSel && Array.from(traitSel.options).some(o => o.value === 'fire'));
  traitSel.value = 'fire'; traitSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  const pf2Fire = Number((text().match(/(\d+) of 1542 spells match/) || [])[1]);
  ok('pf2 trait filter narrowed results (' + pf2Fire + ' fire vs ' + pf2Total + ')', pf2Fire > 0 && pf2Fire < pf2Total);
  traitSel.value = 'all'; traitSel.dispatchEvent(new win.Event('change', { bubbles: true }));

  // PF2 champion: focus spells only
  goHome();
  createChar('pf2');
  setInput('[data-field="name"]', 'Seelah Shieldsworn');
  click(stepButton('Ancestry'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'human'));
  click($$('[data-field="lineageSubId"]')[0]);
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'champion'));
  click(stepButton('Abilities'));
  click('[data-act="autoboost"]');
  click(stepButton('Spells'));
  ok('champion is treated as a focus caster', /Focus spells only/.test(text()));
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'browse'));
  ok('champion browse shows only focus spells', /focus/.test(text()));

  // PF1
  goHome();
  createChar('pf1');
  setInput('[data-field="name"]', 'Kyra Flamekeeper');
  click(stepButton('Race'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'human'));
  $$('select').forEach(s => {
    if (/^choiceAsi\./.test(s.dataset.field || '') && s.options.length > 1) {
      s.value = 'wis'; s.dispatchEvent(new win.Event('change', { bubbles: true }));
    }
  });
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'cleric'));
  click(stepButton('Trait'));
  click($$('[data-field="backgroundId"]')[1]);
  click(stepButton('Abilities'));
  click($$('[data-act="method"]').find(b => b.dataset.val === 'array'));
  click('[data-act="autoarray"]');
  click(stepButton('Spells'));
  ok('pf1 shows spells per day', /Spells per day/.test(text()));
  ok('pf1 shows the casting ability', /Wisdom/.test(text()));
  click('[data-act="spsuggest"]');
  ok('pf1 starter filled the list', !/Nothing chosen yet/.test(text()));
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'browse'));
  ok('pf1 catalogue lists spells', /Cure Light Wounds|Bless/.test(text()));

  /* ---------- importer ---------- */
  section('Spell importer UI');
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'import'));
  ok('import tab explains the built-in count', /built-in/.test(text()));
  ok('pf1 import mentions the community database', /community spell database/.test(text()));
  ok('file import button present', !!$('[data-act="spimportfile"]'));
  goHome();
  editByName('Vex Nightquill');            // the 5e wizard
  click(stepButton('Spells'));
  click($$('[data-act="sptab"]').find(b => b.dataset.val === 'import'));
  ok('5e import offers the Open5e fetch', !!$('[data-act="spfetch"]'));
  ok('5e import states the built-in spell count', /319 built-in|built-in/.test(text()));
  ok('non-casters get a plain explanation', (() => {
    goHome();
    editByName('Thoradin');                // the fighter
    click(stepButton('Spells'));
    return /does not cast spells/.test(text());
  })());

  /* ---------- sheet ---------- */
  section('5e: character sheet');
  goHome();
  openByName('Thoradin Emberhand');
  ok('opening a character lands on the character page, not the wizard', !!$('.csheet') && $$('.step').length === 0);
  ok('sheet rendered', !!$('.csheet'));
  const sheet = () => $('.csheet').textContent.replace(/\s+/g, ' ');
  ok('sheet has the name', /Thoradin Emberhand/.test(sheet()));
  ok('sheet names race and class', /Hill Dwarf/.test(sheet()) && /Fighter/.test(sheet()));
  eq('sheet shows six ability blocks', $$('.csheet .cs-ab').length, 6);
  ok('sheet shows saving throws', /Saving Throws/.test(sheet()));
  ok('sheet shows proficiencies', /Proficiencies/.test(sheet()));
  ok('sheet shows class features', /Second Wind/.test(sheet()));
  ok('sheet shows the background feature', /Military Rank/.test(sheet()));
  ok('sheet shows the ideal', /Honour above all/.test(sheet()));
  ok('sheet shows equipment', /Equipment/.test(sheet()));
  ok('print button present', !!$('[data-act="print"]'));
  ok('print CSS rule exists in the document', /@media print/.test(html));
  click('.pagebar [data-act="modify"]');
  ok('Modify returned to the builder', $$('.step').length > 5);

  /* ---------- other systems ---------- */
  section('Other systems: build each via clicks');
  function buildIn(sysId, opts) {
    goHome();
    createChar(sysId);
    setInput('[data-field="name"]', opts.name);
    click(stepButton(opts.lineageStep));
    const lin = $$('[data-field="lineageId"]').find(b => b.dataset.val === opts.lineage);
    ok(sysId + ': ' + opts.lineage + ' is offered', !!lin);
    click(lin);
    const subs = $$('[data-field="lineageSubId"]');
    if (subs.length) click(subs[0]);
    $$('select').forEach(s => {
      const f = s.dataset.field || '';
      if (/^(choiceAsi|boosts\.ancestryFree)\./.test(f) && s.options.length > 1) {
        s.value = s.options[1].value; s.dispatchEvent(new win.Event('change', { bubbles: true }));
      }
    });
    click(stepButton('Class'));
    const cl = $$('[data-field="classId"]').find(b => b.dataset.val === opts.cls);
    ok(sysId + ': ' + opts.cls + ' is offered', !!cl);
    click(cl);
    const sub = $$('[data-field="subclassId"]');
    if (sub.length) click(sub[0]);
    click(stepButton(opts.bgStep));
    const bgs = $$('[data-field="backgroundId"]');
    ok(sysId + ': backgrounds offered', bgs.length > 0);
    click(bgs[bgs.length - 1]);
    click(stepButton('Abilities'));
    if (sysId === 'pf2') {
      click('[data-act="autoboost"]');
      ok('pf2: autoboost satisfied the boost checks', !/four free ability boosts/.test($('.rail').textContent));
    } else {
      click($$('[data-act="method"]').find(b => b.dataset.val === 'array'));
      click('[data-act="autoarray"]');
      ok(sysId + ': array auto-assign complete', !/Assign all six array/.test($('.rail').textContent));
    }
  }

  buildIn('4e', { name: 'Kaelin Swiftarrow', lineageStep: 'Race', lineage: 'elf', cls: 'ranger', bgStep: 'Background' });
  click(stepButton('Skills'));
  const b4 = $$('input[data-act="toggleskill"]').filter(x => !x.disabled);
  ok('4e: trainable skills listed', b4.length > 3);
  setCheck(b4[0]);
  click(stepButton('Gear'));
  ok('4e: shield selector present', !!setSelect('shield4e', 'Light Shield'));
  ok('4e: rail shows all four defenses', ['AC', 'Fortitude', 'Reflex', 'Will'].every(k => railValue(k) !== null));
  ok('4e: healing surges shown', railValue('Healing Surges') !== null);
  ok('4e: tier shown', /Heroic Tier/.test($('.rail').textContent));
  click(stepButton('Spells'));
  ok('4e: spell step explains that 4e uses powers', /uses powers rather than spells/.test(text()));
  eq('4e: no spell tabs offered', $$('[data-act="sptab"]').length, 0);
  click(stepButton('Gear'));
  click('[data-act="sheet"]');
  ok('4e: sheet lists powers', /At-Will/.test($('.csheet').textContent));
  ok('4e: sheet has the name', /Kaelin Swiftarrow/.test($('.csheet').textContent));

  buildIn('pf1', { name: 'Seelah Ironvow', lineageStep: 'Race', lineage: 'human', cls: 'rogue', bgStep: 'Trait' });
  click(stepButton('Skill Ranks'));
  const rankInputs = $$('input[data-act="setrank"]');
  ok('pf1: a rank box per skill', rankInputs.length > 30);
  setInput(rankInputs[0], '1');
  ok('pf1: rank budget tracked', /\d+ \/ \d+ ranks/.test(text()));
  ok('pf1: rail shows BAB', railValue('BAB') !== null);
  ok('pf1: rail shows CMB / CMD', railValue('CMB / CMD') !== null);
  ok('pf1: rail shows skill rank budget', railValue('Skill ranks') !== null);
  click('[data-act="sheet"]');
  ok('pf1: sheet shows touch AC', /touch/.test($('.csheet').textContent));
  ok('pf1: sheet has the name', /Seelah Ironvow/.test($('.csheet').textContent));

  buildIn('pf2', { name: 'Amiri Bloodbraid', lineageStep: 'Ancestry', lineage: 'orc', cls: 'barbarian', bgStep: 'Background' });
  click(stepButton('Skills'));
  const profSels = $$('select[data-act="setprof"]');
  ok('pf2: a proficiency dropdown per skill', profSels.length > 10);
  profSels[0].value = 'trained';
  profSels[0].dispatchEvent(new win.Event('change', { bubbles: true }));
  ok('pf2: rail shows Class DC', railValue('Class DC') !== null);
  ok('pf2: untrained skills flagged as getting no level bonus', /untrained \(no level bonus\)/.test(text()));
  click('[data-act="sheet"]');
  ok('pf2: sheet shows the proficiency legend', /legendary/.test($('.csheet').textContent));
  ok('pf2: sheet has the name', /Amiri Bloodbraid/.test($('.csheet').textContent));

  /* ---------- roster ---------- */
  section('Roster: persistence, duplicate, delete');
  goHome();
  const rosterN = $$('.rcard').length;
  ok('roster holds every character built (' + rosterN + ')', rosterN >= 8);

  // clicking the card body (not just the Open button) opens the character
  const firstCard = $$('.rcard')[0];
  ok('cards are marked clickable', firstCard.classList.contains('clickable'));
  eq('cards carry an open action', firstCard.dataset.act, 'open');
  ok('cards are keyboard reachable', firstCard.getAttribute('tabindex') === '0');
  const cardName = firstCard.querySelector('h3').textContent.trim();
  click(firstCard);
  ok('clicking the card body opens the character page', !!$('.csheet'));
  eq('the wizard is not shown', $$('.step').length, 0);
  eq('it opened the character that was clicked',
    $('.pagebar-title b').textContent.trim(), cardName);
  ok('the character page offers Modify at the top', !!$('.pagebar [data-act="modify"]'));
  ok('the character page offers a way back', !!$('.pagebar [data-act="roster"]'));
  ok('the character page offers Print', !!$('.pagebar [data-act="print"]'));
  goHome();
  eq('back on the front page with everything intact', $$('.rcard').length, rosterN);

  // per-card actions still work and do not trigger the card click
  const modBtn = $$('.rcard')[0].querySelector('[data-act="modify"]');
  ok('cards offer a Modify shortcut', !!modBtn);
  click(modBtn);
  ok('the card Modify button goes straight to the wizard', $$('.step').length > 5);
  goHome();
  ok('cards show a level, race and class line', /Level \d+/.test(text()));
  ok('cards show the system as a short tag', /D&D 5e|D&D 4e|PF 1e|PF 2e/.test(text()));
  ok('roster shows HP and AC summaries', /\d+ HP/.test(text()) && /\d+ AC/.test(text()));
  click($$('[data-act="dup"]')[0]);
  eq('duplicate added one', $$('.rcard').length, rosterN + 1);
  ok('the copy is labelled', /\(copy\)/.test(text()));
  click($$('[data-act="del"]').pop());
  eq('delete removed one again', $$('.rcard').length, rosterN);

  const saved = JSON.parse(win.localStorage.getItem('characterForge.roster.v2'));
  eq('storage matches the roster', saved.length, rosterN);
  eq('all four systems represented', new Set(saved.map(c => c.systemId)).size, 4);
  ok('every saved character has a name', saved.every(c => c.name && c.name.length > 3));
  ok('spell picks were saved', saved.some(c => (c.spells || []).length > 0));

  /* ---------- reload ---------- */
  section('Reload from storage');
  const reloaded = await boot(saved);
  const rdoc = reloaded.window.document;
  eq('reload restores every card', rdoc.querySelectorAll('.rcard').length, rosterN);
  ok('reload keeps names', /Thoradin Emberhand/.test(rdoc.body.textContent));
  const rtext = rdoc.getElementById('app').textContent;
  ok('reloaded characters still derive stats', /\d+ HP/.test(rtext) && /\d+ AC/.test(rtext));
  reloaded.window.close();

  /* ---------- system switch ---------- */
  section('System switching');
  click($$('[data-act="open"]')[0]);
  click('.pagebar [data-act="modify"]');
  click(stepButton('Game System'));
  click($$('[data-act="setsys"]').find(b => b.dataset.sys === 'pf2'));
  ok('topbar now shows the PF2 badge', /PF 2e/.test($('#topbar').textContent));
  click(stepButton('Class'));
  ok('class list is now PF2', /Champion/.test(text()));
  ok('previous choices were cleared', /Pick a class|Pick a ancestry/.test($('.rail').textContent));
  click(stepButton('Ancestry'));
  ok('ancestry list is now PF2 (Leshy present)', /Leshy/.test(text()));

  /* ---------- home → character → wizard → back ---------- */
  section('Navigation round trip');
  goHome();
  ok('back on the homepage', /Your characters/.test(text()) && $$('.rcard').length > 0);
  openByName('Ezren Goldbraid');
  ok('1. opening shows the character page', !!$('.csheet'));
  eq('   the wizard is not on screen', $$('.step').length, 0);
  ok('   Modify sits at the top of the page', !!$('.pagebar [data-act="modify"]'));
  click('.pagebar [data-act="modify"]');
  ok('2. Modify opens the wizard', $$('.step').length > 5);
  ok('   the builder also offers a way back to the character', !!$('.pagebar [data-act="sheet"]'));
  ok('   and a way back to the homepage', !!$('.pagebar [data-act="roster"]'));
  // step memory: leave from a specific step and come back to it
  click(stepButton('Gear'));
  const leftOn = $('.step.active').textContent.trim();
  click('.pagebar [data-act="sheet"]');
  ok('3. Done returns to the character page', !!$('.csheet') && $$('.step').length === 0);
  click('.pagebar [data-act="modify"]');
  eq('4. Modify reopens the step you left from', $('.step.active').textContent.trim(), leftOn);
  click('.pagebar [data-act="roster"]');
  ok('5. Back from the wizard reaches the homepage', /Your characters/.test(text()));
  // step memory survives a reload
  const savedNav = JSON.parse(win.localStorage.getItem('characterForge.roster.v2'));
  const ez = savedNav.find(x => x.name === 'Ezren Goldbraid');
  ok('the remembered step is stored on the character', typeof ez.wizardStep === 'number');
  const nav2 = await boot(savedNav);
  const ndoc = nav2.window.document;
  const ezCard = Array.from(ndoc.querySelectorAll('.rcard')).find(x => x.textContent.includes('Ezren'));
  ezCard.querySelector('[data-act="modify"]').dispatchEvent(
    new nav2.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  eq('after a reload Modify still lands on that step',
    ndoc.querySelector('.step.active').textContent.trim(), leftOn);
  nav2.window.close();

  /* ---------- unfinished characters ---------- */
  section('Unfinished characters');
  click('[data-act="create"]');
  click($$('[data-act="setsys"]').find(b => b.dataset.sys === '5e'));
  setInput('[data-field="name"]', 'Half Built');
  click('.pagebar [data-act="sheet"]');
  ok('an unfinished character still opens its page', !!$('.csheet'));
  ok('it says what is missing', /still needs/.test(text()));
  ok('it names the missing race and class', /race and a class|race/.test(text()));
  ok('it offers to continue building', !!$('[data-act="modify"]'));
  click('[data-act="modify"]');
  ok('continue building returns to the wizard', $$('.step').length > 5);
  click(stepButton('Race'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'human'));
  click($$('[data-field="lineageSubId"]').find(b => b.dataset.val === 'standard'));
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'fighter'));
  click('.pagebar [data-act="sheet"]');
  ok('once race and class are set the warning is gone', !/still needs/.test(text()));
  goHome();
  ok('the finished character no longer shows the unfinished flag',
    !$$('.rcard').find(x => x.textContent.includes('Half Built') && /Unfinished/.test(x.textContent)));

  /* ---------- the live sheet ---------- */
  section('Live sheet: styling and vitals');
  goHome();
  openByName('Vex Nightquill');                       // 5e wizard with spells
  ok('the sheet uses the app theme, not the old parchment block', !!$('.csheet') && !$('.sheet .box'));
  ok('hit point box is present', !!$('.hpbox'));
  ok('a hit point bar is drawn', !!$('.hpbar i'));
  ok('vital tiles are shown', $$('.cs-tiles .tile').length >= 5);
  ok('ability scores use the themed blocks', $$('.cs-ab').length === 6);
  const hpText = () => $('.hp-num').textContent.replace(/\s+/g, ' ');
  const hpNow = () => Number(($('.hp-num b') || {}).textContent);
  const hpMax0 = Number((hpText().match(/\/ (\d+)/) || [])[1]);
  eq('starts at full hit points', hpNow(), hpMax0);
  click($$('[data-act="hp"]').find(b => b.dataset.delta === '-5'));
  eq('minus five takes five off', hpNow(), hpMax0 - 5);
  click($$('[data-act="hp"]').find(b => b.dataset.delta === '1'));
  eq('plus one puts one back', hpNow(), hpMax0 - 4);
  setInput('#hpAmt', '7');
  click('[data-act="dmg"]');
  eq('typed damage is applied', hpNow(), hpMax0 - 11);
  ok('the action log reports the hit', /Took 7 damage/.test(text()));
  setInput('#hpAmt', '3');
  click('[data-act="heal"]');
  eq('typed healing is applied', hpNow(), hpMax0 - 8);
  // temp HP soaks the next hit
  const tempBox = $('[data-act="temphp"]');
  tempBox.value = '5';
  tempBox.dispatchEvent(new win.Event('change', { bubbles: true }));
  ok('temp hit points are shown', /temp/.test(hpText()));
  setInput('#hpAmt', '4');
  click('[data-act="dmg"]');
  eq('temp hit points absorbed the damage', hpNow(), hpMax0 - 8);
  click('[data-act="hpfull"]');
  eq('restore to full works', hpNow(), hpMax0);

  section('Live sheet: casting and rests');
  ok('resource panel is present', !!$('.cs-res'));
  ok('spell slots are listed as resources', /Spell slots/.test(text()));
  ok('slot pips are clickable', $$('.pip').length > 0);
  ok('rest buttons are offered', $$('[data-act="rest"]').length >= 2);
  ok('a hit die button is offered', !!$('[data-act="hitdie"]'));
  ok('resources say when they come back', /back on a long rest/.test(text()));

  // cast a levelled spell and watch the slot count fall
  const slotLine = () => {
    const g = $$('.spgroup').find(x => /1st level/.test(x.textContent));
    return g ? (g.querySelector('.spslots') || {}).textContent || '' : '';
  };
  ok('the spell group shows how many slots are left', /of \d+ slots left/.test(slotLine()), slotLine());
  const beforeSlots = Number((slotLine().match(/^(\d+)/) || [])[1]);
  const castBtn = $$('.spgroup').find(x => /1st level/.test(x.textContent)).querySelector('[data-act="cast"]');
  click(castBtn);
  const afterSlots = Number((slotLine().match(/^(\d+)/) || [])[1]);
  eq('casting spent a slot', afterSlots, beforeSlots - 1);
  ok('the log says what was cast and what is left', /cast using a 1st-level slot/.test(text()));

  // spend the rest of that level and confirm the spells go unavailable
  for (let i = 0; i < 8; i++) {
    const g = $$('.spgroup').find(x => /1st level/.test(x.textContent));
    const b = g && g.querySelector('[data-act="cast"]');
    if (!b) break;
    click(b);
  }
  const spentGroup = $$('.spgroup').find(x => /1st level/.test(x.textContent));
  ok('with no slots left the group says so', /0 of \d+ slots left/.test(spentGroup.textContent));
  ok('spent spells are marked unavailable', /unavailable/.test(spentGroup.textContent));
  ok('and say when they come back', /recharges on a long rest/.test(spentGroup.textContent));
  ok('the Cast button is replaced', !spentGroup.querySelector('[data-act="cast"]'));
  ok('cantrips are still castable', (() => {
    const g = $$('.spgroup').find(x => /Cantrips/.test(x.textContent));
    return !!(g && g.querySelector('[data-act="cast"]'));
  })());

  // a short rest should not bring wizard slots back, a long rest should
  click($$('[data-act="rest"]').find(b => b.dataset.kind === 'short'));
  ok('a short rest leaves the slots spent', /0 of \d+ slots left/.test(
    $$('.spgroup').find(x => /1st level/.test(x.textContent)).textContent));
  setInput('#hpAmt', '12');
  click('[data-act="dmg"]');
  click($$('[data-act="rest"]').find(b => b.dataset.kind === 'long'));
  ok('a long rest restores the slots', /[1-9]\d? of \d+ slots left/.test(
    $$('.spgroup').find(x => /1st level/.test(x.textContent)).textContent));
  eq('a long rest heals to full', hpNow(), hpMax0);
  ok('the log mentions the rest', /Rested/.test(text()));

  // pips: click one to spend, click again to restore
  const pipRow = $$('.resrow').find(r => r.querySelector('.pip'));
  const litBefore = pipRow.querySelectorAll('.pip:not(.off)').length;
  click(pipRow.querySelector('.pip'));
  const rowNow = () => $$('.resrow').find(r => r.querySelector('.pip'));
  ok('clicking a pip spends it', rowNow().querySelectorAll('.pip:not(.off)').length === litBefore - 1);
  click(rowNow().querySelectorAll('.pip')[litBefore - 1]);
  ok('clicking an empty pip restores it', rowNow().querySelectorAll('.pip:not(.off)').length === litBefore);

  // play state persists
  const savedPlay = JSON.parse(win.localStorage.getItem('characterForge.roster.v2'));
  const vex = savedPlay.find(x => x.name === 'Vex Nightquill');
  ok('play state is saved with the character', !!vex.play);
  ok('hit points are saved', typeof vex.play.hp === 'number' || vex.play.hp === null);
  const play2 = await boot(savedPlay);
  const pdoc = play2.window.document;
  const vexCard = Array.from(pdoc.querySelectorAll('.rcard')).find(x => x.textContent.includes('Vex'));
  vexCard.querySelector('[data-act="open"]').dispatchEvent(
    new play2.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok('after a reload the sheet still renders', !!pdoc.querySelector('.csheet'));
  ok('and hit points came back as saved', !!pdoc.querySelector('.hp-num'));
  play2.window.close();

  // other systems get the right rest buttons and trackers
  section('Live sheet: other systems');
  goHome();
  openByName('Kaelin Swiftarrow');                    // 4e
  ok('4e offers an extended rest', !!$$('[data-act="rest"]').find(b => b.dataset.kind === 'extended'));
  ok('4e tracks healing surges', /Healing surges/.test(text()));
  ok('4e offers to spend a surge', !!$('[data-act="surge"]'));
  ok('4e shows four defences as tiles', /Fortitude/.test(text()) && /Reflex/.test(text()) && /Will/.test(text()));
  const surgeBefore = hpNow();
  setInput('#hpAmt', '10');
  click('[data-act="dmg"]');
  click('[data-act="surge"]');
  ok('spending a surge heals', hpNow() > surgeBefore - 10);
  ok('the log records the surge', /healing surge/.test(text()));

  goHome();
  openByName('Kyra Flamekeeper');                     // pf1
  ok('pf1 offers an eight hour rest', !!$$('[data-act="rest"]').find(b => b.dataset.kind === 'day'));
  ok('pf1 tracks spells per day', /Spells per day/.test(text()));
  ok('pf1 shows touch and flat-footed AC', /touch/.test(text()) && /flat-footed/.test(text()));

  goHome();
  openByName('Ezren Goldbraid');                      // pf2
  ok('pf2 offers Refocus', !!$$('[data-act="rest"]').find(b => b.dataset.kind === 'refocus'));
  ok('pf2 shows the class DC tile', /Class DC/.test(text()));
  ok('pf2 groups slots by rank', /Rank 1/.test(text()));

  /* ---------- sheet layout ---------- */
  section('Sheet layout: balanced columns');
  // jsdom does no layout, so estimate each box's height from what it contains
  function boxHeight(el) {
    const rows = el.querySelectorAll('tr').length;
    const lis = el.querySelectorAll('li').length;
    const txt = el.textContent.replace(/\s+/g, ' ').trim().length;
    const twoUp = el.querySelector('.cs-list.two') || el.querySelector('.cs-split');
    const base = 3 + rows + lis * 1.3 + Math.ceil(txt / 120);
    return twoUp ? base * 0.6 : base;
  }
  goHome();
  const layoutNames = $$('.rcard').map(x => x.querySelector('h3').textContent.trim());
  let worstSpread = 0, checked = 0;
  layoutNames.forEach(name => {
    goHome();
    openByName(name);
    const cols = $$('.cs-col');
    if (cols.length < 2) return;                       // very sparse character
    const heights = cols.map(col => Array.from(col.children).reduce((t, ch) => t + boxHeight(ch), 0));
    const spread = (Math.max(...heights) - Math.min(...heights)) / Math.max(...heights);
    worstSpread = Math.max(worstSpread, spread);
    checked++;
    ok('every column has content — ' + name, cols.every(col => col.children.length > 0));
    // jsdom has no layout, so this is an estimate; the old auto-fill grid ran 60-70% ragged
    ok('columns are roughly even — ' + name + ' (' +
      heights.map(x => Math.round(x)).join('/') + ')', spread < 0.40);
  });
  ok('checked the layout of several characters (' + checked + ')', checked >= 4);
  ok('worst column spread stays modest (' + Math.round(worstSpread * 100) + '%)', worstSpread < 0.40);

  goHome();
  openByName(layoutNames[0]);
  ok('boxes sit in explicit columns, not a ragged auto grid', !!$('.cs-cols') && !$('.cs-grid'));
  ok('the column count is declared on the container', /cols-[123]/.test($('.cs-cols').className));
  ok('vitals and resources run the full width', !!$('.csheet > .cs-vitals') && !!$('.csheet > .cs-res'));

  // the order of the full-width bands, for a caster
  goHome();
  openByName('Vex Nightquill');
  const bands = Array.from($('.csheet').children).map(el => {
    if (el.classList.contains('cs-title')) return 'title';
    if (el.classList.contains('cs-vitals')) return 'vitals';
    if (el.classList.contains('cs-res')) return 'resources';
    if (el.classList.contains('cs-cols')) return 'columns';
    if (el.classList.contains('cs-log')) return 'log';
    const h4 = el.querySelector('h4');
    if (h4 && /^Spells/.test(h4.textContent)) return 'spells';
    if (h4 && /Ability scores/.test(h4.textContent)) return 'abilities';
    return 'other';
  });
  const iSpells = bands.indexOf('spells'), iRes = bands.indexOf('resources');
  ok('the sheet has both a spells band and a resources band', iSpells >= 0 && iRes >= 0,
    bands.join(' > '));
  ok('spells sit above resources (' + bands.join(' > ') + ')', iSpells < iRes);
  ok('ability scores sit directly under the header', bands.indexOf('abilities') === 1, bands.join(' > '));
  ok('vitals follow the ability scores', bands.indexOf('vitals') === 2, bands.join(' > '));
  ok('the reference columns come last of the bands', bands.indexOf('columns') > iRes);

  // the header labels every field it shows
  const idFields = $$('.cs-id > div').map(el => ({
    k: el.querySelector('.k').textContent.trim(),
    v: el.querySelector('.v').textContent.trim()
  }));
  ok('the header shows labelled fields', idFields.length >= 4, JSON.stringify(idFields));
  ok('every header field has both a label and a value',
    idFields.every(f => f.k.length > 1 && f.v.length > 0), JSON.stringify(idFields));
  ok('level is labelled', idFields.some(f => f.k === 'Level' && /^\d+$/.test(f.v)),
    JSON.stringify(idFields));
  ok('the race field is labelled for its system',
    idFields.some(f => f.k === 'Race' || f.k === 'Ancestry'), JSON.stringify(idFields));
  ok('the class field is labelled', idFields.some(f => f.k === 'Class'), JSON.stringify(idFields));
  ok('no field is a bare dot-separated run', !/·/.test($('.cs-id').textContent));
  ok('ability scores run the full width', (() => {
    const ab = $$('.csheet > .cs-box').find(b => /Ability scores/.test(b.textContent));
    return !!ab;
  })());
  ok('the spell list runs the full width', (() => {
    const sp = $$('.csheet > .cs-box').find(b => /^Spells/.test(b.querySelector('h4') ? b.querySelector('h4').textContent : ''));
    return !!sp || !$('.spgroup');
  })());
  ok('vital tiles share a minimum height', /min-height: 74px/.test(html));
  ok('long skill lists split into two tables', (() => {
    goHome(); openByName('Kyra Flamekeeper');          // pf1 has 35 skills
    const box = $$('.cs-box').find(b => /Skills/.test((b.querySelector('h4') || {}).textContent || ''));
    return !!box && !!box.querySelector('.cs-split');
  })());
  ok('the split really is two tables of about half each', (() => {
    goHome(); openByName('Kyra Flamekeeper');
    const box = $$('.cs-box').find(b => /Skills/.test((b.querySelector('h4') || {}).textContent || ''));
    const tables = box ? box.querySelectorAll('.cs-split table') : [];
    if (tables.length !== 2) return false;
    const a = tables[0].querySelectorAll('tr').length, b = tables[1].querySelectorAll('tr').length;
    return Math.abs(a - b) <= 1 && a > 5;
  })());
  ok('the sheet never uses more than three columns', $$('.cs-cols').every(c => c.children.length <= 3));

  /* ---------- inventory ---------- */
  section('Inventory: adding, equipping, coins');
  // build a fresh 5e fighter: an earlier section converts the first roster entry to PF2
  goHome();
  createChar('5e');
  setInput('[data-field="name"]', 'Bram Packwell');
  click(stepButton('Race'));
  click($$('[data-field="lineageId"]').find(b => b.dataset.val === 'human'));
  click($$('[data-field="lineageSubId"]').find(b => b.dataset.val === 'standard'));
  click(stepButton('Class'));
  click($$('[data-field="classId"]').find(b => b.dataset.val === 'fighter'));
  click(stepButton('Abilities'));
  click($$('[data-act="method"]').find(b => b.dataset.val === 'array'));
  click('[data-act="autoarray"]');
  click(stepButton('Gear'));
  setSelect('armor', 'None');
  click('.pagebar [data-act="sheet"]');
  const invBox = () => $$('.cs-box').find(b => /Inventory/.test((b.querySelector('h4') || {}).textContent || ''));
  ok('the sheet has an inventory box', !!invBox());
  ok('it shows a carry bar', !!$('.loadbar .bar'));
  ok('it shows a coin purse', !!$('.coins'));
  eq('four coin denominations', $$('[data-act="setcoin"]').length, 4);
  ok('it offers the catalogue', !!$('[data-act="invbrowse"]'));
  ok('it offers custom items', !!$('[data-act="invcustom"]'));

  // add something from the catalogue
  click('[data-act="invbrowse"]');
  ok('the catalogue opened', !!$('.invpanel'));
  ok('it reports how many items there are', /of 476 items/.test(text()));
  ok('a matching item can be added', $$('[data-act="invadd"]').length >= 0);
  await addFromCatalogue('Longsword');
  ok('the item is now carried', /Longsword/.test(invBox().textContent));
  ok('the action log noted it', /Picked up/.test(text()));
  const loadAfterSword = $('.loadhead b').textContent.trim();
  eq('the carry weight is the sword', loadAfterSword, '3');

  // quantity
  const plus = invBox().querySelector('[data-act="invqty"][data-delta="1"]');
  click(plus);
  eq('quantity raised the weight', $('.loadhead b').textContent.trim(), '6');
  click(invBox().querySelector('[data-act="invqty"][data-delta="-1"]'));
  eq('and lowered it again', $('.loadhead b').textContent.trim(), '3');

  // equipping armour changes AC
  const acTile = () => {
    const t = $$('.cs-tiles .tile').find(x => /Armour class/.test(x.textContent));
    return t ? Number(t.querySelector('.v').textContent) : null;
  };
  const acBefore = acTile();
  // the catalogue stays open after adding, so just search again
  await addFromCatalogue('Chain Mail');
  const chainRow = $$('.cs-box tr').find(r => /Chain Mail/.test(r.textContent) && r.querySelector('[data-act="invequip"]'));
  ok('the armour is listed with an Equip button', !!chainRow);
  click(chainRow.querySelector('[data-act="invequip"]'));
  eq('equipping chain mail sets AC to 16', acTile(), 16);
  ok('the row shows it as worn', /equipped/.test(
    $$('.cs-box tr').find(r => /Chain Mail/.test(r.textContent)).textContent));
  ok('the log recorded the change', /equipped/.test(text()));
  // and the wizard agrees
  click('.pagebar [data-act="modify"]');
  click(stepButton('Gear'));
  const armourSel = $$('select').find(x => x.dataset.field === 'armor');
  eq('the wizard armour dropdown matches', armourSel.value, 'Chain Mail');
  click('.pagebar [data-act="sheet"]');
  // unequip puts AC back
  click($$('.cs-box tr').find(r => /Chain Mail/.test(r.textContent)).querySelector('[data-act="invequip"]'));
  eq('unequipping returns AC', acTile(), acBefore);

  // a custom item
  click('[data-act="invcustom"]');
  ok('the custom form opened', !!$('[data-cust="name"]'));
  setInput('[data-cust="name"]', 'Grandfather\'s locket');
  setInput('[data-cust="weight"]', '0.5');
  setInput('[data-cust="cp"]', '250');
  setInput('[data-cust="note"]', 'Opens to a portrait.');
  click('[data-act="invaddcustom"]');
  ok('the custom item is carried', /Grandfather/.test(invBox().textContent));
  ok('it is marked as custom', /custom/.test(invBox().textContent));
  ok('a blank custom item is refused', (() => {
    click('[data-act="invcustom"]');
    click('[data-act="invaddcustom"]');
    return /Give the item a name first/.test(text());
  })());
  click('[data-act="invcustom"]');

  // coins
  const gpBox = $$('[data-act="setcoin"]').find(b => b.dataset.coin === 'gp');
  gpBox.value = '25';
  gpBox.dispatchEvent(new win.Event('change', { bubbles: true }));
  ok('the purse shows the coins as held', /25 gp/.test(invBox().textContent));
  const spBox = $$('[data-act="setcoin"]').find(b => b.dataset.coin === 'sp');
  spBox.value = '5';
  spBox.dispatchEvent(new win.Event('change', { bubbles: true }));
  ok('mixed coins are listed', /25 gp · 5 sp/.test(invBox().textContent));
  ok('and totalled in gold', /worth 25\.5 gp/.test(invBox().textContent));
  ok('coin weight is mentioned', /coins/.test(invBox().textContent));

  // dropping
  const dropRow = $$('.cs-box tr').find(r => /Grandfather/.test(r.textContent));
  click(dropRow.querySelector('[data-act="invdel"]'));
  ok('the item is gone', !/Grandfather/.test(invBox().textContent));
  ok('the log noted the drop', /Dropped/.test(text()));

  // persistence
  const savedInv = JSON.parse(win.localStorage.getItem('characterForge.roster.v2'));
  const bram = savedInv.find(x => /Bram/.test(x.name));
  ok('inventory is saved with the character', bram.inv && bram.inv.items.length > 0);
  eq('coins are saved', bram.inv.coins.gp, 25);
  const inv2 = await boot(savedInv);
  const idoc = inv2.window.document;
  Array.from(idoc.querySelectorAll('.rcard')).find(x => /Bram/.test(x.textContent))
    .querySelector('[data-act="open"]').dispatchEvent(
      new inv2.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok('after a reload the inventory is still there', /Longsword/.test(idoc.getElementById('app').textContent));
  inv2.window.close();

  // other systems use their own units
  goHome();
  openByName('Ezren Goldbraid');               // pf2
  ok('pf2 measures in Bulk', /Bulk carried/.test(text()));
  ok('pf2 explains coin bulk', /1,000 coins is 1 Bulk/.test(text()));
  goHome();
  openByName('Kyra Flamekeeper');              // pf1
  ok('pf1 measures in pounds', /lb carried/.test(text()));
  ok('pf1 uses the load bands', /Light load|Medium load/.test(text()));
  click('[data-act="invbrowse"]');
  ok('pf1 catalogue has armour and gear as well as weapons', (() => {
    const sel = $$('select').find(x => x.dataset.invf === 'cat');
    const opts = Array.from(sel.options).map(o => o.value);
    return opts.includes('armor') && opts.includes('gear') && opts.includes('weapon');
  })());

  /* ---------- scroll position ---------- */
  section('Scroll position is kept when you act on a page');
  const scrolls = () => win.__scrolls;
  const lastScroll = () => scrolls()[scrolls().length - 1];
  goHome();
  openByName('Vex Nightquill');                 // a caster with a long sheet
  win.__fakeY = 0;
  scrolls().length = 0;
  win.__fakeY = 640;                            // pretend we scrolled down to the spells

  // casting must not throw us back to the top
  const castable = $$('[data-act="cast"]');
  ok('there is a spell to cast', castable.length > 0);
  click(castable[0]);
  eq('casting keeps the scroll position', lastScroll(), 640);

  // nor should damage, pips, or rests
  setInput('#hpAmt', '3');
  click('[data-act="dmg"]');
  eq('taking damage keeps the position', lastScroll(), 640);
  const pip = $('.pip');
  if (pip) { click(pip); eq('spending a pip keeps the position', lastScroll(), 640); }
  click($$('[data-act="rest"]')[0]);
  eq('resting keeps the position', lastScroll(), 640);
  click('[data-act="spinfo"]');
  eq('expanding a spell keeps the position', lastScroll(), 640);
  ok('nothing scrolled to the top during all of that', scrolls().every(y => y === 640),
    scrolls().join(','));

  // but real navigation should start at the top
  scrolls().length = 0;
  click('.pagebar [data-act="modify"]');
  eq('opening the wizard starts at the top', lastScroll(), 0);
  win.__fakeY = 500;
  scrolls().length = 0;
  click(stepButton('Gear'));
  eq('changing wizard step starts at the top', lastScroll(), 0);
  win.__fakeY = 500;
  scrolls().length = 0;
  click('.pagebar [data-act="sheet"]');
  eq('going back to the character starts at the top', lastScroll(), 0);
  win.__fakeY = 500;
  scrolls().length = 0;
  goHome();
  eq('going home starts at the top', lastScroll(), 0);
  win.__fakeY = 0;

  // typing in a field keeps focus through the re-render
  section('Typing is not interrupted');
  openByName('Vex Nightquill');
  click('.pagebar [data-act="modify"]');
  click(stepButton('Roleplay'));
  const area = $$('textarea').find(t => (t.dataset.field || '').includes('personality.ideals'));
  ok('found a text field to type in', !!area);
  area.focus();
  area.value = 'Knowledge above all';
  area.dispatchEvent(new win.Event('input', { bubbles: true }));
  ok('the field still has focus after the input handler ran',
    doc.activeElement === area || (doc.activeElement && doc.activeElement.dataset &&
      doc.activeElement.dataset.field === 'personality.ideals'));

  /* ---------- campaigns, standalone ---------- */
  section('Campaigns in local mode');
  goHome();
  ok('the home page has a campaigns section', /Campaigns/.test(text()));
  ok('and says there are none yet', /No campaigns yet/.test(text()));
  ok('explaining what one is for, without mentioning a server',
    /keeps a set of characters together/.test(text()));
  ok('there is no "other tables" section without a server',
    !/Other tables on this server/.test(text()));
  eq('one button to start one', $$('[data-act="campnew"]').length, 1);

  click('[data-act="campnew"]');
  ok('the form opens', !!$('[data-campf="name"]'));
  eq('with a game to choose', $$('[data-campf="systemId"]').length, 1);
  ok('and says a campaign is fixed to one game', /fixed to one game/.test(text()));
  click('[data-act="campcreate"]');
  ok('a nameless campaign is refused', /Give the campaign a name/.test(text()));

  setInput('[data-campf="name"]', 'Solo game');
  setInput('[data-campf="blurb"]', 'Just me and the dice');
  click('[data-act="campcreate"]');
  await new Promise(r => setTimeout(r, 60));
  eq('you land on the campaign page', win.eval('app.view'), 'campaign');
  ok('which names it', /Solo game/.test(text()));
  ok('and says you are the DM', /you are the DM/.test(text()));
  ok('the blurb shows', /Just me and the dice/.test(text()));
  ok('it is stored in this browser',
    /Solo game/.test(win.localStorage.getItem('characterForge.campaigns.v1') || ''));

  // 5e characters can join it; a Pathfinder one cannot
  click('[data-act="campattach"]');
  const offers = $$('[data-act="campjoin"]').map(b => b.textContent.trim());
  ok('only 5e characters are offered', offers.length > 0);
  ok('and the Pathfinder characters are not', !offers.some(t => /Grix|Sable/.test(t)),
    offers.join(' | '));
  ok('with a reason given for the ones left out',
    /different game/.test(text()) || /cannot join/.test(text()));

  const first = $$('[data-act="campjoin"]')[0];
  const joinedName = first.textContent.trim().split('\n')[0].trim();
  click(first);
  await new Promise(r => setTimeout(r, 60));
  ok('the character is at the table now', /Your characters here/.test(text()));
  eq('exactly one is attached',
    win.eval('(loadRoster()||[]).filter(c => c.campaignId).length'), 1);
  ok('and it is the one clicked', text().includes(joinedName.split(' ')[0]));

  // the campaign shows on the sheet, with history
  click($$('[data-act="open"]')[0]);
  await new Promise(r => setTimeout(r, 60));
  eq('the sheet opens', win.eval('app.view'), 'sheet');
  ok('the header has a Campaign label', /Campaign/.test($('.cs-id').textContent));
  ok('naming the campaign', /Solo game/.test($('.cs-id').textContent));
  ok('and the sheet has a campaign box', /Playing in/.test(text()));
  eq('with a way to leave', $$('[data-act="campleave"]').length >= 1, true);
  ok('the sheet is not read-only, since it is yours',
    win.eval('readingSomeoneElse()') === false);
  eq('so Modify is still offered', $$('.pagebar [data-act="modify"]').length, 1);

  click($$('[data-act="campleave"]')[0]);
  await new Promise(r => setTimeout(r, 60));
  eq('leaving detaches it',
    win.eval('(loadRoster()||[]).filter(c => c.campaignId).length'), 0);
  const hist = win.eval('JSON.stringify((loadRoster()||[]).map(c => c.campaignHistory || []))');
  ok('but the stint is recorded in the history', /Solo game/.test(hist), hist.slice(0, 200));
  ok('with an end date', /leftAt":"20/.test(hist));

  goHome();
  ok('the campaign is listed on the home page', /Solo game/.test(text()));
  ok('and no longer says there are none', !/No campaigns yet/.test(text()));

  /* ---------- journal ---------- */
  section('The journal');
  goHome();
  openByName('Vex Nightquill');
  // This character has already been levelled up earlier in the run, so entries
  // exist. Count from where we are rather than assuming an empty journal.
  const jBase = Number(win.eval('cur().journal.length'));
  ok('the sheet has a journal', /Journal/.test(text()));
  eq('with one way to add to it', $$('[data-act="jadd"]').length, 1);
  ok('levelling up earlier wrote its own entries', jBase > 0, 'started at ' + jBase);
  ok('and they are shown as automatic', /automatic/.test(text()));
  eq('an automatic entry offers no delete', $$('.jentry.auto [data-act="jdel"]').length, 0);
  eq('and no edit', $$('.jentry.auto [data-act="jedit"]').length, 0);
  eq('and its visibility is fixed, not a control',
    $$('.jentry.auto button[data-act="jvis"]').length, 0);
  const lvlEntry = win.eval('JSON.stringify(cur().journal.filter(e => e.auto === "level").pop())');
  ok('a level entry names the level reached', /Reached level \d/.test(lvlEntry), lvlEntry);
  ok('and is shared with the table, since it is no secret',
    /"visibility":"party"/.test(lvlEntry), lvlEntry);

  // find a named entry, and the element showing it
  const jEntry = title => JSON.parse(win.eval(
    'JSON.stringify(cur().journal.find(e => (e.title||"").indexOf(' +
    JSON.stringify(title) + ') === 0) || null)'));
  const jEl = title => $$('.jentry').find(el => el.textContent.includes(title));

  click('[data-act="jadd"]');
  ok('the form opens', !!$('[data-jf="title"]'));
  ok('with a date already filled in', /^\d{4}-\d{2}-\d{2}$/.test($('[data-jf="date"]').value));
  const visSel = $('[data-jf="visibility"]');
  ok('and a choice of who can read it', !!visSel);
  eq('starting at just me', visSel.value, 'private');
  const visOpts = Array.from(visSel.options).map(o => o.textContent.trim());
  eq('the choices are in plain words', visOpts.join('|'), 'the table|the DM|just me');

  click('[data-act="jsave"]');
  ok('an empty entry is refused', /a title or something to say/.test(text()));
  eq('and nothing was added', Number(win.eval('cur().journal.length')), jBase);

  setInput('[data-jf="title"]', 'The bridge at Kellhorn');
  setInput('[data-jf="text"]', 'We burned it.\n\nNobody argued.');
  click('[data-act="jsave"]');
  eq('one entry was added', Number(win.eval('cur().journal.length')), jBase + 1);
  ok('the entry appears', /The bridge at Kellhorn/.test(text()));
  const mineEl = jEl('The bridge at Kellhorn');
  ok('as an entry of its own', !!mineEl);
  ok('with its text', /We burned it/.test(mineEl.textContent));
  ok('and its second paragraph', /Nobody argued/.test(mineEl.textContent));
  eq('paragraph breaks survive as paragraphs',
    mineEl.querySelectorAll('.jtext p').length, 2);
  eq('it is private by default', jEntry('The bridge').visibility, 'private');
  ok('and says so on the entry', /just me/.test(mineEl.textContent));
  ok('it survived to storage',
    /Kellhorn/.test(win.localStorage.getItem('characterForge.roster.v2') || ''));

  // the visibility control cycles in one direction
  const visBtn = () => jEl('The bridge at Kellhorn').querySelector('[data-act="jvis"]');
  ok('a hand-written entry has a visibility control', !!visBtn());
  click(visBtn());
  eq('one tap shares it with the DM', jEntry('The bridge').visibility, 'dm');
  ok('and the label follows', /the DM/.test(jEl('The bridge at Kellhorn').textContent));
  click(visBtn());
  eq('another shares it with the table', jEntry('The bridge').visibility, 'party');
  ok('with the label again', /the table/.test(jEl('The bridge at Kellhorn').textContent));
  click(visBtn());
  eq('and a third puts it back to just me', jEntry('The bridge').visibility, 'private');

  // editing
  click(jEl('The bridge at Kellhorn').querySelector('[data-act="jedit"]'));
  eq('the edit form opens with the entry in it',
    ($('[data-jf="title"]') || {}).value, 'The bridge at Kellhorn');
  setInput('[data-jf="title"]', 'The bridge at Kellhorn, revisited');
  click('[data-act="jsave"]');
  ok('the change sticks', /revisited/.test(text()));
  eq('and did not add a second entry', Number(win.eval('cur().journal.length')), jBase + 1);
  eq('the visibility was left alone', jEntry('The bridge').visibility, 'private');

  // levelling up writes another entry
  const beforeLevel = Number(win.eval('cur().level'));
  click('.pagebar [data-act="modify"]');
  click(stepButton("Advancement"));
  const lvlBtn = $('[data-act="levelup"]');
  ok('there is a level-up button', !!lvlBtn);
  click(lvlBtn);
  click('.pagebar [data-act="sheet"]');
  eq('the level went up', Number(win.eval('cur().level')), beforeLevel + 1);
  eq('and an entry wrote itself', Number(win.eval('cur().journal.length')), jBase + 2);
  const fresh = jEntry('Reached level ' + (beforeLevel + 1));
  ok('naming the level reached', !!fresh);
  eq('marked as automatic', fresh.auto, 'level');
  eq('and shared with the table', fresh.visibility, 'party');
  ok('the sheet shows it',
    new RegExp('Reached level ' + (beforeLevel + 1)).test(text()));

  // deleting a hand-written entry
  const delBtn = jEl('The bridge at Kellhorn').querySelector('[data-act="jdel"]');
  ok('a hand-written entry can be deleted', !!delBtn);
  click(delBtn);
  eq('leaving the automatic ones', Number(win.eval('cur().journal.length')), jBase + 1);
  ok('the deleted one is gone from the page', !/revisited/.test(text()));
  ok('the automatic ones are still there',
    new RegExp('Reached level ' + (beforeLevel + 1)).test(text()));

  // joining a campaign writes an entry standalone too, exactly as the server does
  goHome();
  click('[data-act="campgo"]');
  await new Promise(r => setTimeout(r, 60));
  click('[data-act="campattach"]');
  const vexJoin = $$('[data-act="campjoin"]').find(b => /Vex/.test(b.textContent));
  if (vexJoin) {
    const wasLen = Number(win.eval('(loadRoster().find(c => /Vex/.test(c.name||"")) || {}).journal.length'));
    click(vexJoin);
    await new Promise(r => setTimeout(r, 60));
    const nowLen = Number(win.eval('(loadRoster().find(c => /Vex/.test(c.name||"")) || {}).journal.length'));
    eq('joining a table writes one entry', nowLen, wasLen + 1);
    const joined = win.eval('JSON.stringify(loadRoster().find(c => /Vex/.test(c.name||"")).journal.pop())');
    ok('marked as a join', /"auto":"join"/.test(joined), joined);
    ok('naming the campaign', /Joined Solo game/.test(joined), joined);
    ok('and shared with the table', /"visibility":"party"/.test(joined), joined);
  } else {
    ok('a 5e character was offered to join the local campaign', false,
      'offered: ' + $$('[data-act="campjoin"]').map(b => b.textContent.trim()).join(' | '));
  }

  /* ---------- sharing controls and the preview ---------- */
  section('Sharing controls and the preview');
  goHome();
  openByName('Vex Nightquill');
  ok('the sheet has a sharing box', /Who can see what/.test(text()));
  ok('which says numbers are always shared', /Numbers are always shared/.test(text()));
  ok('and explains why', /party table is worked out from them/.test(text()));
  ok('standalone, it says the setting is a note to yourself',
    /note to yourself rather than a lock/.test(text()));

  const pvBtns = $$('[data-act="pvis"]');
  eq('there is a control for every section', pvBtns.length, Number(win.eval('PRIV_SECTIONS.length')));
  const pvKeys = pvBtns.map(b => b.dataset.key).sort().join(',');
  eq('covering the expected sections', pvKeys,
    'choices,flavour,gear,languages,notes,spells');
  const pvOf = key => $$('[data-act="pvis"]').find(b => b.dataset.key === key);
  eq('appearance and backstory start shared with the table',
    pvOf('flavour').textContent.trim(), 'the table');
  eq('the notes box starts DM-only', pvOf('notes').textContent.trim(), 'the DM');

  click(pvOf('flavour'));
  eq('one tap makes it DM-only', win.eval('privLevelOf(cur(), "flavour")'), 'dm');
  eq('and the label follows', pvOf('flavour').textContent.trim(), 'the DM');
  click(pvOf('flavour'));
  eq('another makes it private', win.eval('privLevelOf(cur(), "flavour")'), 'private');
  eq('with its own label', pvOf('flavour').textContent.trim(), 'just me');
  click(pvOf('flavour'));
  eq('and a third shares it again', win.eval('privLevelOf(cur(), "flavour")'), 'party');
  ok('the setting is stored on the character',
    /"privacy"/.test(win.localStorage.getItem('characterForge.roster.v2') || ''));

  // nothing that feeds a number is hideable
  ['baseScores', 'skills', 'hp', 'level'].forEach(k => {
    ok('there is no control for ' + k, !pvOf(k));
  });

  // per-item controls in the inventory
  if (!$$('[data-act="ivis"]').length) {
    // this character was built without gear, so give it something to hide
    click('[data-act="invbrowse"]');
    await addFromCatalogue('Rope');
    ok('a possession was added to work with', win.eval('invItems(cur()).length') > 0);
  }
  const ivBtns = $$('[data-act="ivis"]');
  ok('each possession has its own control', ivBtns.length > 0,
    'items: ' + win.eval('invItems(cur()).length'));
  eq('and they start shared with the table', ivBtns[0].textContent.trim(), 'the table');
  const firstItemId = ivBtns[0].dataset.id;
  click(ivBtns[0]);
  eq('one tap makes that one DM-only',
    win.eval('privItemLevel(invItems(cur()).find(i => i.id === "' + firstItemId + '"))'), 'dm');
  ok('and the row is tagged as held back', /class="tag hid"/.test($('#app').innerHTML));
  click($$('[data-act="ivis"]').find(b => b.dataset.id === firstItemId));
  eq('another makes it private',
    win.eval('privItemLevel(invItems(cur()).find(i => i.id === "' + firstItemId + '"))'), 'private');
  ok('and the box counts what is held back', /possession/.test(text()) && /held back/.test(text()));

  // hide something recognisable, then look at the sheet as somebody else
  win.eval('cur().notes = "NOTESJUSTFORME"; cur().privacy.notes = "private";' +
    'cur().personality = cur().personality || {}; cur().personality.ideals = "SHAREDIDEAL";' +
    'cur().privacy.flavour = "party"; saveRoster(app.roster);');
  win.eval('render()');
  ok('the note is on your own sheet', /NOTESJUSTFORME/.test(text()));

  click($$('[data-act="ppreview"]').find(b => b.dataset.as === 'dm'));
  eq('the sheet switches to the DM view', win.eval('String(app.preview)'), 'dm');
  ok('and says so across the top', /This is what the DM can see/.test(text()));
  ok('the private note is gone', !/NOTESJUSTFORME/.test(text()));
  ok('but the shared ideal is still there', /SHAREDIDEAL/.test(text()));
  ok('the private possession shows as a hidden item', /hidden item/.test(text()));
  eq('nothing on the sheet can be edited', $$('.pagebar [data-act="modify"]').length, 0);
  eq('and there is no export', $$('.pagebar [data-act="export"]').length, 0);
  eq('the journal cannot be added to', $$('[data-act="jadd"]').length, 0);
  eq('nor the inventory', $$('[data-act="invbrowse"]').length, 0);
  eq('and no item can be dropped', $$('[data-act="invdel"]').length, 0);
  ok('the app knows the sheet is read-only', win.eval('sheetReadOnly()') === true);

  // a stray click while previewing must not write anything
  const revBefore = win.localStorage.getItem('characterForge.roster.v2');
  const hpBtn = $$('[data-act="hp"]')[0];
  if (hpBtn) {
    click(hpBtn);
    ok('a damage click while previewing is refused out loud',
      /looking at this sheet as someone else/.test(text()));
    eq('and nothing was saved',
      win.localStorage.getItem('characterForge.roster.v2'), revBefore);
  } else {
    ok('a damage control exists on the sheet', false, 'no [data-act=hp]');
  }

  click($$('[data-act="ppreview"]').find(b => b.dataset.as === 'party'));
  eq('the table view can be looked at too', win.eval('String(app.preview)'), 'party');
  ok('and names who it is for', /what the other players can see/.test(text()));
  ok('the DM-only notes box is gone here as well', !/NOTESJUSTFORME/.test(text()));

  click($$('[data-act="ppreview"]').find(b => b.dataset.as === ''));
  eq('and you can come back to your own', win.eval('String(app.preview)'), 'null');
  ok('where the note is visible again', /NOTESJUSTFORME/.test(text()));
  eq('and the sheet is editable again', $$('.pagebar [data-act="modify"]').length, 1);
  ok('the app agrees', win.eval('sheetReadOnly()') === false);

  // leaving the sheet drops the preview with it
  click($$('[data-act="ppreview"]').find(b => b.dataset.as === 'dm'));
  goHome();
  eq('going home clears the preview', win.eval('String(app.preview)'), 'null');

  /* ---------- errors ---------- */
  section('Runtime errors');
  ok('no uncaught JS errors during the entire run', jsErrors.length === 0, jsErrors.slice(0, 2).join('\n---\n'));

  console.log('\n' + '='.repeat(56));
  if (fails.length) {
    console.log('\x1b[31mFAILURES (' + fails.length + '):\x1b[0m');
    fails.forEach(f => console.log('  ✗ ' + f));
  }
  console.log((fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
  win.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('\x1b[31mHARNESS ERROR:\x1b[0m', e); process.exit(2); });
