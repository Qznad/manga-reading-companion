// Background script (Firefox event page — has a DOM, unlike a Chrome service worker).
// Receives page changes from content.js, finds which pack's music applies to the chapter,
// works out which cue applies to the page, and tells player.js what to play.
// It also saves a summary of what's going on ("reader" in storage.session) for the popup.

import { findCue } from "../shared/cues.js";
import { getChapterInfo } from "../shared/mangadex.js";
import { getVideoTitle } from "../shared/youtube.js";
import { findMusic, isLibraryChange, migrateOldFormat } from "../shared/packs.js";

migrateOldFormat();

// The chapter whose music we looked up last, so we don't look it up on every page turn.
let loaded = { chapterId: null, music: null };

// The page being read right now, so we can re-apply the music if the library changes.
let current = null;

// If packs are loaded, switched on/off, removed, or a playlist is saved while reading,
// look the music up again and update the player right away.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !isLibraryChange(changes)) return;
  loaded = { chapterId: null, music: null };
  if (current) onPageChanged(current);
});

// Counts page changes, so a slow lookup for an old page can't overwrite a newer page's summary.
let latestChange = 0;

async function onPageChanged({ chapterId, page, tabId }) {
  current = { chapterId, page, tabId };
  const thisChange = ++latestChange;

  if (chapterId !== loaded.chapterId) {
    loaded = { chapterId, music: await findMusic(chapterId) };
    console.log("[MRC] music for this chapter:", loaded.music ?? "none");
  }
  const { music } = loaded;

  // 1. Music first, so it never waits for the info lookups below.
  // No music, or a page before the first cue → nothing should play.
  const cue = music && findCue(music.cues, page);
  if (cue) {
    console.log(`[MRC] page ${page} → cue`, cue);
    tellPlayer(tabId, { type: "playCue", chapterId, cue });
  } else {
    tellPlayer(tabId, { type: "stopMusic" });
  }

  // 2. Then the summary for the popup (and the song title for the player).
  const [chapter, songTitle] = await Promise.all([
    getChapterInfo(chapterId),
    cue ? getVideoTitle(cue.youtubeId) : null,
  ]);
  if (thisChange !== latestChange) return; // the reader already moved on

  if (cue && songTitle) tellPlayer(tabId, { type: "songTitle", youtubeId: cue.youtubeId, title: songTitle });

  const cueIndex = cue ? music.cues.indexOf(cue) : -1;
  await browser.storage.session.set({
    reader: {
      chapterId,
      page,
      chapter, // manga name, chapter number, title, page count — or null if MangaDex is unreachable
      music: music && {
        pack: music.pack,
        otherPacks: music.candidates.length - 1, // other switched-on packs with music for this chapter
        songCount: music.cues.length,
        firstPage: music.cues[0].page,
        playing: cue && {
          number: cueIndex + 1,
          title: songTitle, // null if YouTube didn't tell us
          youtubeId: cue.youtubeId,
          nextSongPage: music.cues[cueIndex + 1]?.page ?? null,
        },
      },
    },
  });
}

// Sends an instruction to the player (player.js) in the MangaDex tab.
function tellPlayer(tabId, msg) {
  browser.tabs.sendMessage(tabId, msg).catch(() => {}); // tab may have closed; that's fine
}

browser.runtime.onMessage.addListener((msg, sender) => {
  switch (msg.type) {
    case "pageChanged":
      onPageChanged({ chapterId: msg.chapterId, page: msg.page, tabId: sender.tab?.id });
      return;
    case "readerLeft":
      console.log("[MRC] reader left");
      latestChange++;
      current = null;
      browser.storage.session.set({ reader: null });
      tellPlayer(sender.tab?.id, { type: "stopMusic" });
      return;
  }
});
