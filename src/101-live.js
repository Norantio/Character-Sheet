/* ============================================================
   Live updates.

   The server sends a one-line notice when anything changes. The notice has no
   content in it: the client re-asks through the ordinary routes, which are the
   ones that do the filtering. So watching the table can never show anyone
   something they would not have been sent anyway.

   Nothing here runs in local mode.
   ============================================================ */

const LIVE = {
  es: null,            // the EventSource, when there is one
  poll: null,          // the fallback timer
  timer: null,         // debounce for the refresh itself
  seq: 0,              // the last notice we acted on
  state: 'off',        // off | watching | polling | lost
  stale: false,        // someone changed something we have not picked up yet
  tries: 0
};

const LIVE_POLL_MS = 10000;
const LIVE_SETTLE_MS = 350;

/* ---------------- starting and stopping ---------------- */
function storeWatch() {
  storeUnwatch();
  if (STORE.mode !== 'server' || !signedIn() || !STORE.token) return;

  if (typeof EventSource === 'function') {
    try {
      // EventSource cannot set a header, so the token goes in the address
      const es = new EventSource('/api/events?token=' + encodeURIComponent(STORE.token));
      es.onopen = () => {
        LIVE.state = 'watching';
        LIVE.tries = 0;
        refreshConnBar();
      };
      es.onmessage = ev => {
        let msg = null;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        onRemoteChange(msg);
      };
      es.onerror = () => {
        // the browser retries by itself; if it keeps failing, fall back to asking
        LIVE.state = 'lost';
        LIVE.tries++;
        refreshConnBar();
        if (LIVE.tries >= 3) {
          try { es.close(); } catch (e) { }
          LIVE.es = null;
          startPolling();
        }
      };
      LIVE.es = es;
      LIVE.state = 'watching';
      return;
    } catch (e) { /* fall through to polling */ }
  }
  startPolling();
}

function storeUnwatch() {
  if (LIVE.es) { try { LIVE.es.close(); } catch (e) { } LIVE.es = null; }
  if (LIVE.poll) { clearInterval(LIVE.poll); LIVE.poll = null; }
  if (LIVE.timer) { clearTimeout(LIVE.timer); LIVE.timer = null; }
  LIVE.state = 'off';
  LIVE.stale = false;
}

/* Older browsers, or a stream that will not stay up: just ask now and then. */
function startPolling() {
  if (LIVE.poll) return;
  LIVE.state = 'polling';
  refreshConnBar();
  LIVE.poll = setInterval(() => {
    if (STORE.mode !== 'server' || !signedIn()) return;
    onRemoteChange({ kind: 'changed', by: null, seq: 0, poll: true });
  }, LIVE_POLL_MS);
}

/* ---------------- reacting ---------------- */
function onRemoteChange(msg) {
  if (!msg) return;
  // the echo of our own save: we already have that
  if (msg.by && STORE.profile && msg.by === STORE.profile.id) return;
  if (msg.seq && msg.seq <= LIVE.seq) return;
  if (msg.seq) LIVE.seq = msg.seq;

  if (LIVE.timer) clearTimeout(LIVE.timer);
  LIVE.timer = setTimeout(liveRefresh, LIVE_SETTLE_MS);
}

/* Never yank the page out from under someone. */
function liveHoldOff() {
  // mid-wizard: they are working, and the wizard has unsaved intermediate state
  if (app.view === 'build') return 'the wizard is open';
  // typing: a re-render is safe for focus but not for an unsubmitted form
  const el = typeof document === 'object' ? document.activeElement : null;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '')) return 'a field is being typed in';
  // our own writes are still going out
  if (STORE.pending > 0) return 'a save is in flight';
  return null;
}

async function liveRefresh() {
  LIVE.timer = null;
  if (STORE.mode !== 'server' || !signedIn()) return;

  const hold = liveHoldOff();
  if (hold) {
    LIVE.stale = true;
    refreshConnBar();
    // try again shortly; whatever they are doing will finish
    LIVE.timer = setTimeout(liveRefresh, 2000);
    return;
  }

  try {
    // Somebody else's data first, since that is what changed. Our own roster is
    // only re-read when we have nothing pending, so an edit cannot be lost.
    await storeFetchCampaigns();
    if (campUI.id) {
      try { campUI.data = await storeCampaign(campUI.id); } catch (e) { /* it may be gone */ }
    }
    if (app.guest) {
      try {
        const res = await api('/characters/' + encodeURIComponent(app.guest.id));
        app.guest = migrateCharacter(res.character);
      } catch (e) {
        // they left the table, or the sheet went away
        app.guest = null;
        if (app.view === 'sheet') app.view = campUI.id ? 'campaign' : 'roster';
      }
    }
    if (!flushState.dirty.size && STORE.pending === 0) {
      await storeFetchAll();
      app.roster = loadRoster();
    }
    LIVE.stale = false;
    LIVE.state = LIVE.es ? 'watching' : 'polling';
  } catch (e) {
    LIVE.stale = true;
  }
  render();
}

/* Asked for by hand, from the connection bar. */
function liveRefreshNow() {
  if (LIVE.timer) { clearTimeout(LIVE.timer); LIVE.timer = null; }
  liveRefresh();
}

/* What the connection bar says about all this. */
function liveLabel() {
  if (STORE.mode !== 'server' || !signedIn()) return '';
  if (LIVE.stale) return 'someone else made a change';
  if (LIVE.state === 'watching') return 'live';
  if (LIVE.state === 'polling') return 'checking every 10s';
  if (LIVE.state === 'lost') return 'reconnecting…';
  return '';
}

document.addEventListener('click', function (ev) {
  const el = ev.target.closest('[data-act]');
  if (!el || el.dataset.act !== 'liverefresh') return;
  liveRefreshNow();
});

/* Coming back to a tablet that has been asleep: catch up straight away rather
   than waiting for the next notice. */
document.addEventListener('visibilitychange', function () {
  if (typeof document === 'object' && document.visibilityState === 'visible' &&
    STORE.mode === 'server' && signedIn()) {
    if (!LIVE.es && !LIVE.poll) storeWatch();
    liveRefreshNow();
  }
});
