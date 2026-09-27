// Phase 1: detect the current MangaDex chapter + page and report it to the background worker.
//
// MangaDex is an SPA, so page turns and chapter changes don't reload the document. Content
// scripts run in an isolated world and can't hook the page's history.pushState, so we poll
// location.href (cheap) and report only on change.
//
// Known reader URL shape: /chapter/<uuid>/<page>  (page is 1-indexed, may be absent on entry).
// UNVERIFIED: whether long-strip mode keeps the /<page> segment in sync while scrolling.
// Check in devtools; if it doesn't, add an IntersectionObserver fallback in detectFromDom().

(() => {
  const POLL_MS = 400;
  const CHAPTER_RE = /^\/chapter\/([0-9a-f-]{36})(?:\/(\d+))?/i;

  let last = null;

  function detectFromUrl() {
    const m = location.pathname.match(CHAPTER_RE);
    if (!m) return null;
    return {
      chapterId: m[1],
      page: m[2] ? Number(m[2]) : 1,
      source: m[2] ? "url" : "url-default",
    };
  }

  function detectFromDom() {
    // Placeholder for the long-strip fallback — fill in once the reader DOM is inspected.
    return null;
  }

  function tick() {
    const state = detectFromUrl() ?? detectFromDom();
    const key = state ? `${state.chapterId}:${state.page}` : null;
    if (key === last) return;
    last = key;

    if (!state) {
      console.log("[MRC] left reader");
      browser.runtime.sendMessage({ type: "readerLeft" }).catch(() => {});
      return;
    }

    console.log("[MRC] page", state);
    browser.runtime.sendMessage({ type: "pageChanged", ...state }).catch(() => {});
  }

  tick();
  setInterval(tick, POLL_MS);
})();
