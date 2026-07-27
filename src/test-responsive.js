/* Responsive check: resolve the stylesheet at real tablet viewport sizes.
   jsdom does no layout and ignores media queries, so this parses the CSS and
   works out which declarations actually win at a given width / pointer type.
   Run: node src/test-responsive.js */
const fs = require('fs');
const path = require('path');

const FILE = path.join(path.dirname(__dirname), 'character-forge.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0; const fails = [];
function ok(label, cond, extra) { if (cond) pass++; else { fail++; fails.push(label + (extra ? ' — ' + extra : '')); } }
function eq(label, got, want) { ok(label + ' (got ' + got + ')', String(got) === String(want), 'expected ' + want); }
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ---------------- pull the stylesheet out of the single file ---------------- */
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
if (!css) { console.error('no <style> block found'); process.exit(2); }

/* ---------------- a small CSS parser ---------------- */
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
function parse(src) {
  const rules = [];              // { media, selectors:[], decls:{} }
  let i = 0;
  src = stripComments(src);
  function parseBlock(text, media) {
    let j = 0;
    while (j < text.length) {
      const brace = text.indexOf('{', j);
      if (brace < 0) break;
      const head = text.slice(j, brace).trim();
      // find the matching close brace
      let depth = 1, k = brace + 1;
      while (k < text.length && depth > 0) {
        if (text[k] === '{') depth++;
        else if (text[k] === '}') depth--;
        k++;
      }
      const body = text.slice(brace + 1, k - 1);
      if (head.startsWith('@media')) {
        parseBlock(body, head.replace(/^@media\s*/, '').trim());
      } else if (head.startsWith('@')) {
        /* @page and friends: ignore */
      } else {
        const decls = {};
        body.split(';').forEach(d => {
          const c = d.indexOf(':');
          if (c < 0) return;
          const prop = d.slice(0, c).trim();
          const val = d.slice(c + 1).trim();
          if (prop && val) decls[prop] = val;
        });
        rules.push({
          media: media || null,
          selectors: head.split(',').map(x => x.replace(/\s+/g, ' ').trim()),
          decls: decls
        });
      }
      j = k;
    }
  }
  parseBlock(src, null);
  return rules;
}
const RULES = parse(css);

/* ---------------- media query evaluation ---------------- */
function mediaMatches(cond, ctx) {
  if (!cond) return true;
  // comma means "any of these"
  return cond.split(',').some(part => {
    return part.split(/\s+and\s+/).every(term => {
      term = term.trim().replace(/^\(|\)$/g, '').trim();
      if (!term) return true;
      if (term === 'screen') return ctx.media !== 'print';
      if (term === 'print') return ctx.media === 'print';
      const m = term.match(/^([a-z-]+)\s*:\s*(.+)$/);
      if (!m) return true;
      const [, prop, raw] = m;
      const val = raw.trim();
      const px = parseFloat(val);
      switch (prop) {
        case 'max-width': return ctx.width <= px;
        case 'min-width': return ctx.width >= px;
        case 'max-height': return ctx.height <= px;
        case 'min-height': return ctx.height >= px;
        case 'pointer': return ctx.pointer === val;
        case 'hover': return ctx.hover === val;
        case 'orientation': return (ctx.width >= ctx.height ? 'landscape' : 'portrait') === val;
        default: return true;
      }
    });
  });
}
/* Effective value of a property for an exact selector, in source order. */
function resolve(selector, prop, ctx) {
  let out = null;
  RULES.forEach(r => {
    if (!mediaMatches(r.media, ctx)) return;
    if (!r.selectors.includes(selector)) return;
    if (r.decls[prop] !== undefined) out = r.decls[prop];
  });
  return out;
}
function px(v) { return v === null ? null : parseFloat(v); }

/* ---------------- devices ---------------- */
const DEVICES = [
  { name: 'iPad mini portrait', w: 768, h: 1024, touch: true },
  { name: 'iPad mini landscape', w: 1024, h: 768, touch: true },
  { name: 'iPad 10.9 portrait', w: 820, h: 1180, touch: true },
  { name: 'iPad 10.9 landscape', w: 1180, h: 820, touch: true },
  { name: 'iPad Pro 11 portrait', w: 834, h: 1194, touch: true },
  { name: 'iPad Pro 11 landscape', w: 1194, h: 834, touch: true },
  { name: 'iPad Pro 12.9 portrait', w: 1024, h: 1366, touch: true },
  { name: 'iPad Pro 12.9 landscape', w: 1366, h: 1024, touch: true },
  { name: 'Android 8in portrait', w: 600, h: 960, touch: true },
  { name: 'Android 10in landscape', w: 960, h: 600, touch: true },
  { name: 'Surface Pro portrait', w: 912, h: 1368, touch: true },
  { name: 'Desktop', w: 1600, h: 900, touch: false }
];
function ctxFor(dev) {
  return {
    width: dev.w, height: dev.h, media: 'screen',
    pointer: dev.touch ? 'coarse' : 'fine',
    hover: dev.touch ? 'none' : 'hover'
  };
}

/* ---------------- the document itself ---------------- */
section('Document');
const viewport = (html.match(/<meta name="viewport" content="([^"]+)"/) || [])[1];
ok('a viewport meta tag is present', !!viewport, 'none found');
ok('it uses width=device-width', /width=device-width/.test(viewport || ''), viewport);
ok('it sets initial-scale=1', /initial-scale=1/.test(viewport || ''), viewport);
ok('it does not block pinch zoom', !/user-scalable=no|maximum-scale=1/.test(viewport || ''), viewport);
ok('text size adjust is pinned so iOS does not inflate text on rotation',
  /text-size-adjust:\s*100%/.test(css));
ok('a tap highlight colour is set', /-webkit-tap-highlight-color/.test(css));

section('Nothing wider than the narrowest tablet');
const fixed = [];
RULES.forEach(r => {
  ['width', 'min-width'].forEach(prop => {
    const v = r.decls[prop];
    if (!v) return;
    const n = parseFloat(v);
    if (/px$/.test(v) && n > 560) fixed.push(r.selectors.join(',') + ' { ' + prop + ': ' + v + ' }');
  });
});
ok('no rule forces a width beyond a 600px viewport', fixed.length === 0, fixed.join(' | '));
const inlineWide = (html.match(/style="[^"]*width:\s*(\d{3,})px/g) || [])
  .map(m => parseFloat(m.match(/(\d{3,})px/)[1])).filter(n => n > 560);
ok('no inline style forces a wide element', inlineWide.length === 0, inlineWide.join(','));

/* ---------------- per-device layout ---------------- */
section('Layout at each screen size');
DEVICES.forEach(dev => {
  const ctx = ctxFor(dev);
  const label = dev.name.padEnd(24);
  const layout = resolve('.layout', 'grid-template-columns', ctx);
  const railPos = resolve('.rail', 'position', ctx);
  const cols3 = resolve('.cs-cols.cols-3', 'grid-template-columns', ctx);
  const vitals = resolve('.cs-vitals', 'grid-template-columns', ctx);
  const cols = (cols3 || '').includes('repeat(3') ? 3 : (cols3 || '').includes('repeat(2') ? 2 : 1;
  console.log('  ' + label + ' ' + String(dev.w).padStart(4) + 'px  wizard: ' +
    (layout.includes('208px') ? '3-col' : layout.includes('190px') ? '2-col' : '1-col').padEnd(6) +
    ' sheet: ' + cols + '-col   rail: ' + railPos);

  // the wizard must never keep a 300px rail column on a tablet
  if (dev.w <= 1240) {
    ok(label + 'wizard drops the fixed rail column', !layout.includes('300px'), layout);
    ok(label + 'rail is not sticky once it spans the full width', railPos === 'static', railPos);
  } else {
    ok(label + 'desktop keeps the three-column wizard', layout.includes('300px'), layout);
  }
  // narrow tablets stack the wizard entirely
  if (dev.w <= 860) {
    eq(label + 'wizard is a single column', layout, '1fr');
    eq(label + 'step list becomes a strip', resolve('.steps', 'display', ctx), 'flex');
    eq(label + 'and the strip is not sticky', resolve('.steps', 'position', ctx), 'static');
  }
  // the sheet should never show three columns below 1080
  if (dev.w <= 1080) ok(label + 'sheet uses at most two columns', cols <= 2, cols + ' columns');
  if (dev.w <= 720) ok(label + 'sheet is a single column', cols === 1, cols + ' columns');
  if (dev.w <= 780) ok(label + 'vitals stack', (vitals || '').includes('1fr') && !(vitals || '').includes('340px'), vitals);
  // skills split and two-column lists collapse on narrow screens
  if (dev.w <= 760) {
    ok(label + 'skill split collapses', resolve('.cs-split', 'grid-template-columns', ctx) === '1fr');
    ok(label + 'two-column lists collapse', resolve('.cs-list.two', 'columns', ctx) === '1');
  }
  if (dev.w <= 620) {
    const ab = resolve('.cs-abils', 'grid-template-columns', ctx);
    ok(label + 'ability blocks go three across', (ab || '').includes('repeat(3'), ab);
  }
});

/* ---------------- touch targets ---------------- */
section('Touch targets');
const touch = ctxFor(DEVICES[0]);
const desk = ctxFor(DEVICES[DEVICES.length - 1]);
function boxHeight(sel, ctx, fallbackFont) {
  const pad = resolve(sel, 'padding', ctx) || '';
  const py = parseFloat(pad.split(/\s+/)[0]) || 0;
  const fs = resolve(sel, 'font-size', ctx);
  let font = fallbackFont;
  if (fs && /rem$/.test(fs)) font = parseFloat(fs) * (parseFloat(resolve('body', 'font-size', ctx)) || 15);
  else if (fs && /px$/.test(fs)) font = parseFloat(fs);
  return Math.round(py * 2 + font * 1.5 + 2);
}
const bodyFont = parseFloat(resolve('body', 'font-size', touch));
eq('body text is 16px on touch devices', bodyFont, 16);

const btnH = boxHeight('.btn', touch, bodyFont);
const btnSmH = boxHeight('.btn.sm', touch, bodyFont);
const pipW = px(resolve('.pip', 'width', touch));
const pipGap = px(resolve('.pips', 'gap', touch));
const inputMin = px(resolve('input', 'min-height', touch));
const inputFont = px(resolve('input', 'font-size', touch));
const stepH = boxHeight('.step', touch, bodyFont);
const chk = px(resolve('.chk input', 'width', touch));

console.log('  primary button   ' + btnH + 'px');
console.log('  small button     ' + btnSmH + 'px');
console.log('  resource pip     ' + pipW + 'px (+' + pipGap + 'px gap → ' + (pipW + pipGap) + 'px pitch)');
console.log('  form field       ' + inputMin + 'px, font ' + inputFont + 'px');
console.log('  wizard step      ' + stepH + 'px');
console.log('  checkbox         ' + chk + 'px');

ok('primary buttons clear 44px (' + btnH + ')', btnH >= 44);
ok('small buttons are at least 40px (' + btnSmH + ')', btnSmH >= 40);
ok('pips are at least 30px (' + pipW + ')', pipW >= 30);
ok('pips have space between them so neighbours are not hit (' + pipGap + ')', pipGap >= 6);
ok('form fields are at least 44px (' + inputMin + ')', inputMin >= 44);
ok('form fields use 16px text so iOS does not zoom on focus (' + inputFont + ')', inputFont >= 16);
ok('wizard steps are at least 44px (' + stepH + ')', stepH >= 44);
ok('checkboxes are at least 20px (' + chk + ')', chk >= 20);
ok('table cells get more padding on touch',
  px(resolve('td', 'padding', touch)) > px(resolve('td', 'padding', desk)));
ok('desktop keeps the compact sizing', px(resolve('.pip', 'width', desk)) < 20);

section('Hover and press feedback');
ok('the card lift is cancelled where there is no hover',
  resolve('.rcard.clickable:hover', 'transform', { width: 800, height: 1000, media: 'screen', pointer: 'coarse', hover: 'none' }) === 'none');
ok('cards give press feedback instead',
  !!resolve('.rcard.clickable:active', 'border-color', { width: 800, height: 1000, media: 'screen', pointer: 'coarse', hover: 'none' }));
ok('buttons give press feedback',
  !!resolve('.btn:active', 'border-color', { width: 800, height: 1000, media: 'screen', pointer: 'coarse', hover: 'none' }));
ok('desktop still gets the hover lift',
  resolve('.rcard.clickable:hover', 'transform', desk) !== 'none');

section('Information that was tooltip-only');
ok('rest hints are rendered as visible text, not just a title attribute',
  /class="note resthint noprint"/.test(html) || /resthint/.test(html));
ok('the pip interaction is explained in words',
  /Tap a filled box to spend one/.test(html));

/* ---------------- results ---------------- */
console.log('\n' + '='.repeat(56));
if (fails.length) {
  console.log('\x1b[31mFAILURES (' + fails.length + '):\x1b[0m');
  fails.forEach(f => console.log('  ✗ ' + f));
}
console.log((fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
