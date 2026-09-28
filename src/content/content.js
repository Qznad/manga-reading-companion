// Detects the current MangaDex chapter + page and reports it to the background script.
//
// MangaDex is an SPA, so page turns and chapter changes don't reload the document. Content
// scripts run in an isolated world and can't hook the page's history.pushState, so we poll
// location.href (cheap) and report only on change.
//
// Reader URL shape: /chapter/<uuid>/<page>  (page is 1-indexed, may be absent on entry).

(() => {
  const POLL_MS = 400;
  const CHAPTER_RE = /^\/chapter\/([0-9a-f-]{36})(?:\/(\d+))?/i;

  // Stays open as long as this page does. When the tab is closed or goes to another site,
  // Firefox cuts it and the background knows reading stopped (we get no chance to say goodbye).
  // If it's cut while this page is still open (Firefox put the background to sleep), reconnect.
  function connect() {
    try {
      browser.runtime.connect({ name: "reader" }).onDisconnect.addListener(() => setTimeout(connect, 1000));
    } catch {
      // The extension was removed or reloaded; this old copy of the script just stops.
    }
  }
  connect();

  let last = null;

  // The chapter always comes from the address bar. The page comes from the screen in
  // Long Strip mode (where MangaDex doesn't update the address), otherwise from the address.
  function detect() {
    const m = location.pathname.match(CHAPTER_RE);
    if (!m) return null;
    const chapterId = m[1];

    const stripPage = pageFromLongStrip();
    if (stripPage) return { chapterId, page: stripPage, source: "long-strip" };

    return { chapterId, page: m[2] ? Number(m[2]) : 1, source: m[2] ? "url" : "url-default" };
  }

  // In Long Strip mode every page is an <img> inside a box with class "md--page ls",
  // one under the other. The page being read is the last one whose top edge is above
  // the middle of the screen. Returns null when the reader isn't in Long Strip mode.
  function pageFromLongStrip() {
    const pages = document.querySelectorAll(".md--page.ls");
    if (pages.length === 0) return null;

    const readingLine = window.innerHeight / 2;
    let page = 1;
    pages.forEach((box, i) => {
      if (box.getBoundingClientRect().top <= readingLine) page = i + 1;
    });
    return page;
  }

  function tick() {
    const state = detect();
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
