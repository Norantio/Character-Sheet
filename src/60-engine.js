/* ============================================================
   Engine: registry, ability-score pipeline, storage, validation
   ============================================================ */

const SYSTEMS = { '5e': SYS_5E, '5.5e': SYS_55E, '4e': SYS_4E, pf1: SYS_PF1, pf2: SYS_PF2 };
const SYSTEM_ORDER = ['5e', '5.5e', '4e', 'pf1', 'pf2'];
const SYSTEM_SHORT = { '5e': 'D&D 5e', '5.5e': 'D&D 5e (2024)', '4e': 'D&D 4e', pf1: 'PF 1e', pf2: 'PF 2e' };
function sys(id) { return SYSTEMS[id] || SYS_5E; }

/* ---------- blank character ---------- */
function newCharacter(systemId) {
  const S = sys(systemId);
  return {
    id: uid(),
    schema: 2,
    systemId: systemId,
    name: '',
    player: '',
    level: 1,
    lineageId: null, lineageSubId: null,
    classId: null, subclassId: null,
    backgroundId: null,
    keyAbility: null,
    abilityMethod: S.abilityGen.boosts ? 'boosts' : 'pointbuy',
    baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    arrayId: null, arrayAssign: {}, rolledPool: [], rollAssign: {},
    choiceAsi: [],                 // free racial ability picks (5e/4e/PF1)
    boosts: { ancestryFree: [], free: [], levels: {} },  // PF2
    levelAsi: {},                  // {4:['str','str'], ...}
    skills: [], expertise: [],     // 5e / 4e trained skills
    ranks: {},                     // PF1 skill ranks
    profs: {},                     // PF2 skill proficiency ranks
    bgSkillBonus: null,            // 4e background skill
    choices: {},                   // fighting style, implement, etc.
    favoredClassBonus: 'hp',
    armor: null, shield: false, shield4e: 'None', shieldPf: 'None', shieldPf2: 'None',
    acBonus: 0, initBonus: 0, weaponProf: 0,
    hpMethod: 'average', hpRolls: [],
    spells: [], prepared: [], printSpellText: false,
    languages: [], deity: '', alignment: '',
    gear: '', gold: '', notes: '',
    appearance: { age: '', height: '', weight: '', eyes: '', hair: '', skin: '' },
    personality: { traits: '', ideals: '', bonds: '', flaws: '', backstory: '' },
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

/* ---------- ability score pipeline ---------- */
function racialAdjustments(c) {
  const S = sys(c.systemId);
  const lin = byId(S.lineages, c.lineageId);
  const sub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
  const adj = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!lin) return adj;
  const useBase = !(sub && sub.replaceAsi);
  if (useBase) Object.keys(lin.asi || {}).forEach(a => adj[a] += lin.asi[a]);
  if (sub && sub.asi) Object.keys(sub.asi).forEach(a => adj[a] += sub.asi[a]);
  const spec = (sub && sub.choiceAsi) || lin.choiceAsi;
  if (spec) asArray(c.choiceAsi).slice(0, spec.count).forEach(a => { if (a) adj[a] += spec.amount; });
  return adj;
}

function levelAsiAdjustments(c) {
  const adj = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  Object.keys(c.levelAsi || {}).forEach(lv => {
    if (Number(lv) <= c.level) asArray(c.levelAsi[lv]).forEach(a => { if (a) adj[a] += 1; });
  });
  return adj;
}

function pf2Boost(score) { return score >= 18 ? score + 1 : score + 2; }

function computePf2Scores(c) {
  const S = SYS_PF2;
  const s = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const trace = [];
  const anc = byId(S.lineages, c.lineageId);
  const bg = byId(S.backgrounds, c.backgroundId);
  const cls = byId(S.classes, c.classId);
  if (anc) {
    if (anc.flaw) { s[anc.flaw] -= 2; trace.push('Ancestry flaw −2 ' + ABIL_NAME[anc.flaw]); }
    (anc.boosts || []).forEach(a => { s[a] = pf2Boost(s[a]); trace.push('Ancestry boost ' + ABIL_NAME[a]); });
    asArray(c.boosts && c.boosts.ancestryFree).slice(0, anc.freeBoosts || 0).forEach(a => {
      if (a) { s[a] = pf2Boost(s[a]); trace.push('Ancestry free boost ' + ABIL_NAME[a]); }
    });
  }
  if (bg) (bg.boosts || []).forEach(a => { s[a] = pf2Boost(s[a]); trace.push('Background boost ' + ABIL_NAME[a]); });
  const key = c.keyAbility || (cls ? cls.keyAbility[0] : null);
  if (key) { s[key] = pf2Boost(s[key]); trace.push('Class key ability ' + ABIL_NAME[key]); }
  asArray(c.boosts && c.boosts.free).slice(0, 4).forEach(a => {
    if (a) { s[a] = pf2Boost(s[a]); trace.push('Free boost ' + ABIL_NAME[a]); }
  });
  [5, 10, 15, 20].forEach(lv => {
    if (c.level >= lv) {
      asArray(((c.boosts && c.boosts.levels) || {})[lv]).forEach(a => {
        if (a) { s[a] = pf2Boost(s[a]); trace.push('Level ' + lv + ' boost ' + ABIL_NAME[a]); }
      });
    }
  });
  return { scores: s, trace };
}

/* Background ASI for 5.5e. The player records their choice as an object in
   c.bgAsiAssign (e.g. { str: 2, dex: 1 }). The system flag backgroundAsi
   gates this so it is a no-op for every other system. */
function backgroundAsiAdjustments(c) {
  const adj = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!sys(c.systemId).backgroundAsi) return adj;
  const assign = c.bgAsiAssign;
  if (!assign || typeof assign !== 'object') return adj;
  let total = 0;
  ABIL6.forEach(a => {
    const v = Number(assign[a]) || 0;
    if (v > 0 && total + v <= 3) { adj[a] += v; total += v; }
  });
  return adj;
}

function computeScores(c) {
  const S = sys(c.systemId);
  if (S.abilityGen.boosts && c.abilityMethod === 'boosts') {
    const r = computePf2Scores(c);
    c.finalScores = r.scores;
    c.scoreTrace = r.trace;
    c.baseForDisplay = r.scores;
    return c.finalScores;
  }
  let base = Object.assign({}, c.baseScores);
  if (c.abilityMethod === 'array' && c.arrayId) {
    const arr = (S.abilityGen.arrays || []).find(a => a.id === c.arrayId);
    if (arr) {
      base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      ABIL6.forEach(a => {
        const idx = c.arrayAssign[a];
        if (idx !== undefined && idx !== null && arr.scores[idx] !== undefined) base[a] = arr.scores[idx];
      });
    }
  } else if (c.abilityMethod === 'roll' && (c.rolledPool || []).length) {
    base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    ABIL6.forEach(a => {
      const idx = c.rollAssign[a];
      if (idx !== undefined && idx !== null && c.rolledPool[idx] !== undefined) base[a] = c.rolledPool[idx];
    });
  }
  c.baseForDisplay = base;
  const race = racialAdjustments(c);
  const lvl = levelAsiAdjustments(c);
  const bgAdj = backgroundAsiAdjustments(c);
  const out = {};
  ABIL6.forEach(a => { out[a] = base[a] + race[a] + lvl[a] + bgAdj[a]; });
  c.racialAdj = race;
  c.levelAdj = lvl;
  c.bgAsiAdj = bgAdj;
  c.finalScores = out;
  return out;
}

function derive(c) {
  computeScores(c);
  const S = sys(c.systemId);
  try { return S.derive(c); }
  catch (e) { console.error('derive failed', e); return { level: c.level, skills: [], features: [], notes: ['Derivation error: ' + e.message], saves: [] }; }
}

/* ---------- skill budgets ---------- */
function skillBudget(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const lin = byId(S.lineages, c.lineageId);
  const sub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
  const bg = byId(S.backgrounds, c.backgroundId);
  let n = cls ? (cls.skillCount || 0) : 0;
  let granted = [];
  if (cls && cls.grantSkills) granted = granted.concat(cls.grantSkills);
  if (lin && lin.grantSkills) granted = granted.concat(lin.grantSkills);
  if (bg && bg.skills && c.systemId !== 'pf2') granted = granted.concat(bg.skills);
  if (bg && bg.skills && c.systemId === 'pf2') granted = granted.concat(bg.skills.length === 1 ? bg.skills : []);
  if (lin && lin.chooseSkills) n += lin.chooseSkills;
  if (sub && sub.chooseSkills) n += sub.chooseSkills;
  if (c.systemId === 'pf2') n += Math.max(0, mod(c.finalScores ? c.finalScores.int : 10));
  granted = [...new Set(granted)];
  return { count: n, granted };
}

function allowedSkillIds(c) {
  const S = sys(c.systemId);
  const cls = byId(S.classes, c.classId);
  const lin = byId(S.lineages, c.lineageId);
  const all = S.skills.map(s => s.id);
  if (c.systemId === 'pf2') return all;
  let list = [];
  if (cls) list = cls.skillList === 'any' ? all.slice() : (cls.skillList || []).slice();
  if (lin && lin.chooseSkillsFrom) {
    if (lin.chooseSkillsFrom === 'any') list = all.slice();
    else list = [...new Set(list.concat(lin.chooseSkillsFrom))];
  }
  if (c.systemId === '4e' || c.systemId === '5e' || c.systemId === '5.5e') {
    const sub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
    if (sub && sub.chooseSkills) list = all.slice();
    if (lin && lin.id === 'halfelf' && c.systemId === '5e') list = all.slice();
  }
  return list.length ? list : all;
}

/* ---------- validation ---------- */
function validate(c) {
  const S = sys(c.systemId);
  computeScores(c);           // make sure finalScores exists before anything reads it
  const issues = [];
  if (!c.name) issues.push({ level: 'warn', text: 'No character name yet.' });
  if (!c.lineageId) issues.push({ level: 'error', text: 'Pick a ' + S.lineageLabel.toLowerCase() + '.' });
  if (!c.classId) issues.push({ level: 'error', text: 'Pick a ' + S.classLabel.toLowerCase() + '.' });
  const lin = byId(S.lineages, c.lineageId);
  if (lin && (lin.subs || []).length && !c.lineageSubId) issues.push({ level: 'warn', text: 'Choose a ' + S.subclassLabel.split(' / ')[0].toLowerCase() + ' for your ' + lin.name + '.' });
  const cls = byId(S.classes, c.classId);
  if (cls && (cls.subclasses || []).length && c.level >= (cls.subclassLevel || 1) && !c.subclassId) {
    issues.push({ level: 'warn', text: 'Choose a ' + S.subclassLabel.toLowerCase() + '.' });
  }
  if (!c.backgroundId && S.backgrounds && S.backgrounds.length) issues.push({ level: 'warn', text: 'No ' + S.backgroundLabel.toLowerCase() + ' selected.' });

  // ability method completeness
  if (c.abilityMethod === 'pointbuy') {
    const pb = S.abilityGen.pointBuy;
    if (pb) {
      const spent = pointBuySpend(c.baseScores, pb.table);
      const budget = c.pointBudget || pb.points;
      if (spent > budget) issues.push({ level: 'error', text: 'Point buy over budget: ' + spent + ' / ' + budget + '.' });
      else if (spent < budget) issues.push({ level: 'warn', text: 'Point buy has ' + (budget - spent) + ' point(s) unspent.' });
    }
  }
  if (c.abilityMethod === 'array') {
    const assigned = ABIL6.filter(a => c.arrayAssign[a] !== undefined && c.arrayAssign[a] !== null).length;
    if (assigned < 6) issues.push({ level: 'error', text: 'Assign all six array values (' + assigned + '/6 done).' });
    const idxs = ABIL6.map(a => c.arrayAssign[a]).filter(x => x !== undefined && x !== null);
    if (new Set(idxs).size !== idxs.length) issues.push({ level: 'error', text: 'Each array value can only be used once.' });
  }
  if (c.abilityMethod === 'roll') {
    if (!(c.rolledPool || []).length) issues.push({ level: 'error', text: 'Roll a set of scores first.' });
    else {
      const assigned = ABIL6.filter(a => c.rollAssign[a] !== undefined && c.rollAssign[a] !== null).length;
      if (assigned < 6) issues.push({ level: 'error', text: 'Assign all six rolled values (' + assigned + '/6 done).' });
    }
  }
  // free racial picks
  const sub = lin ? byId(lin.subs || [], c.lineageSubId) : null;
  const spec = (sub && sub.choiceAsi) || (lin && lin.choiceAsi);
  if (spec) {
    const picks = asArray(c.choiceAsi).filter(Boolean);
    if (picks.length < spec.count) issues.push({ level: 'error', text: 'Choose ' + spec.count + ' ability score' + (spec.count > 1 ? 's' : '') + ' to increase from your ' + S.lineageLabel.toLowerCase() + '.' });
    if (spec.distinct && new Set(picks).size !== picks.length) issues.push({ level: 'error', text: 'Those ability increases must be different abilities.' });
  }
  // PF2 boosts
  if (c.systemId === 'pf2') {
    const anc = byId(S.lineages, c.lineageId);
    if (anc) {
      const need = anc.freeBoosts || 0;
      const got = asArray(c.boosts.ancestryFree).filter(Boolean).length;
      if (got < need) issues.push({ level: 'error', text: 'Choose ' + need + ' free ancestry boost' + (need > 1 ? 's' : '') + '.' });
    }
    const free = asArray(c.boosts.free).filter(Boolean);
    if (free.length < 4) issues.push({ level: 'error', text: 'Assign all four free ability boosts (' + free.length + '/4).' });
    if (new Set(free).size !== free.length) issues.push({ level: 'error', text: 'The four free boosts must go to four different abilities.' });
    [5, 10, 15, 20].forEach(lv => {
      if (c.level >= lv) {
        const b = asArray((c.boosts.levels || {})[lv]).filter(Boolean);
        if (b.length < 4) issues.push({ level: 'warn', text: 'Level ' + lv + ' ability boosts incomplete (' + b.length + '/4).' });
        if (new Set(b).size !== b.length) issues.push({ level: 'error', text: 'Level ' + lv + ' boosts must be four different abilities.' });
      }
    });
  }
  // skills
  if (c.systemId === 'pf1') {
    const d = derive(c);
    if (d.skillRanksSpent > d.skillRanksTotal) issues.push({ level: 'error', text: 'Too many skill ranks spent: ' + d.skillRanksSpent + ' / ' + d.skillRanksTotal + '.' });
    else if (d.skillRanksSpent < d.skillRanksTotal) issues.push({ level: 'warn', text: (d.skillRanksTotal - d.skillRanksSpent) + ' skill rank(s) unspent.' });
    Object.keys(c.ranks || {}).forEach(k => {
      if (c.ranks[k] > c.level) issues.push({ level: 'error', text: 'Ranks in ' + k + ' exceed your level (max ' + c.level + ').' });
    });
  } else if (c.systemId === 'pf2') {
    const b = skillBudget(c);
    const trained = Object.keys(c.profs || {}).filter(k => c.profs[k] && c.profs[k] !== 'untrained').length;
    const expected = (cls ? cls.skillCount : 2) + Math.max(0, mod(c.finalScores.int)) + ((byId(S.backgrounds, c.backgroundId) || {}).skills || []).length;
    if (trained < expected) issues.push({ level: 'warn', text: 'You have ' + (expected - trained) + ' skill training slot(s) left (about ' + expected + ' expected at level 1).' });
  } else {
    const b = skillBudget(c);
    const chosen = (c.skills || []).filter(s => !b.granted.includes(s)).length;
    if (chosen < b.count) issues.push({ level: 'warn', text: 'Choose ' + (b.count - chosen) + ' more skill proficienc' + (b.count - chosen === 1 ? 'y' : 'ies') + '.' });
    if (chosen > b.count) issues.push({ level: 'error', text: 'Too many skills chosen: ' + chosen + ' / ' + b.count + '.' });
  }
  // 5e/5.5e background ASI
  if (c.systemId === '5.5e') {
    const assign = c.bgAsiAssign || {};
    const total = ABIL6.reduce((t, a) => t + (Number(assign[a]) || 0), 0);
    if (total < 3) issues.push({ level: 'warn', text: 'Assign your background ability score increases (+2 to one, +1 to another; or +1 to three different abilities).' });
    if (total > 3) issues.push({ level: 'error', text: 'Background ability increases total ' + total + ' — the maximum is +3.' });
  }
  // 5e/5.5e expertise
  if ((c.systemId === '5e' || c.systemId === '5.5e') && cls && cls.expertise && c.level >= cls.expertise.level) {
    const want = cls.expertise.count + (c.level >= 6 ? 2 : 0);
    if ((c.expertise || []).length < want) issues.push({ level: 'warn', text: 'Pick ' + (want - (c.expertise || []).length) + ' more expertise skill(s).' });
    if ((c.expertise || []).length > want) issues.push({ level: 'error', text: 'Too many expertise picks (max ' + want + ').' });
  }
  // 5e/5.5e/PF1 level ASIs
  if (c.systemId === '5e' || c.systemId === '5.5e' || c.systemId === 'pf1') {
    const d = derive(c);
    const lv = (c.systemId === '5e' || c.systemId === '5.5e') ? (cls ? cls.asiLevels : ASI_5E).filter(l => l <= c.level) : [4, 8, 12, 16, 20].filter(l => l <= c.level);
    lv.forEach(l => {
      const picks = asArray(c.levelAsi[l]).filter(Boolean);
      const need = c.systemId === '5e' ? 2 : 1;
      if (picks.length < need) issues.push({ level: 'warn', text: 'Level ' + l + ' ability increase not assigned (' + picks.length + '/' + need + '). You may have taken a feat instead.' });
    });
  }
  // spellbook (defined in the spellbook module, which loads after this one)
  if (typeof spellIssues === 'function') {
    try { spellIssues(c).forEach(i => issues.push(i)); }
    catch (e) { console.warn('spell validation failed', e); }
  }
  // score sanity
  ABIL6.forEach(a => {
    const v = c.finalScores[a];
    if (v > 20 && c.systemId !== '4e') issues.push({ level: 'warn', text: ABIL_NAME[a] + ' is ' + v + ' — above the usual 20 cap for player characters.' });
    if (v < 3) issues.push({ level: 'error', text: ABIL_NAME[a] + ' is ' + v + ', which is below the minimum of 3.' });
  });
  return issues;
}

/* ---------- storage ---------- */
const STORE_KEY = 'characterForge.roster.v2';
const memoryStore = { roster: [] };
let storageOK = true;
try { localStorage.setItem('__cf_test', '1'); localStorage.removeItem('__cf_test'); }
catch (e) { storageOK = false; }

/* Both of these delegate to the store (see 95-store.js), which is either
   localStorage or the LAN server. Callers do not need to know which. */
function loadRoster() { return storeLoad(); }
function saveRoster(list) { return storeSave(list); }

/* ---------- level up ---------- */
function levelUp(c, to) {
  const S = sys(c.systemId);
  const target = clamp(to, 1, S.maxLevel);
  const gained = [];
  const cls = byId(S.classes, c.classId);
  for (let l = c.level + 1; l <= target; l++) {
    if (cls && cls.features && cls.features[l]) cls.features[l].forEach(f => gained.push({ level: l, text: f }));
    if (c.systemId === '5e' && cls && cls.asiLevels.includes(l)) gained.push({ level: l, text: 'Ability Score Improvement or feat — assign on the Abilities step.' });
    if (c.systemId === 'pf1' && l % 4 === 0) gained.push({ level: l, text: '+1 to one ability score.' });
    if (c.systemId === 'pf1' && l % 2 === 1) gained.push({ level: l, text: 'New feat.' });
    if (c.systemId === 'pf2' && [5, 10, 15, 20].includes(l)) gained.push({ level: l, text: 'Four ability boosts.' });
    if (c.systemId === 'pf2' && S.skillIncreaseLevels.includes(l)) gained.push({ level: l, text: 'Skill increase.' });
    if (c.systemId === '4e') gained.push({ level: l, text: 'Level ' + l + ': +1 to half-level bonuses' + ([2, 6, 10, 16, 22, 26].includes(l) ? ', new utility power' : '') + ([3, 7, 13, 17, 23, 27].includes(l) ? ', replace an encounter power' : '') + ([5, 9, 15, 19, 25, 29].includes(l) ? ', replace a daily power' : '') + (l % 2 === 1 ? ', new feat' : '') + '.' });
    if (c.hpMethod === 'roll') {
      const hd = c.systemId === '4e' ? null : (cls ? (cls.hitDie || 8) : 8);
      if (hd) c.hpRolls.push(d(hd));
    }
  }
  c.level = target;
  c.updated = new Date().toISOString();
  return gained;
}
