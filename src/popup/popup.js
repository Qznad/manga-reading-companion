// The popup: a summary of what's happening, built from the "reader" info the background saves.

import { chapterLabel } from "../shared/mangadex.js";
import { icon, renderIcons } from "../shared/icons.js";
import { getPacks } from "../shared/packs.js";

const $ = (id) => document.getElementById(id);

// The websites listed under "host_permissions" in manifest.json.
const NEEDED = { origins: browser.runtime.getManifest().host_permissions };

// Remembered so the creator button knows which chapter to open.
let currentChapterId = null;

async function render() {
  $("permission-card").hidden = await browser.permissions.contains(NEEDED);
  const { reader } = await browser.storage.session.get("reader");
  $("not-reading").hidden = !!reader;
  $("reading").hidden = !reader;
  if (reader) renderReading(reader);
  renderPackCount();
}

function renderReading({ chapterId, page, chapter, music }) {
  currentChapterId = chapterId;
  $("creator-label").textContent = music ? "Edit this chapter's playlist" : "Create a playlist for this chapter";

  // What you're reading. `chapter` is null if MangaDex couldn't be reached.
  $("manga-title").textContent = chapter?.mangaTitle ?? "Unknown manga";
  $("chapter-label").textContent = chapter ? chapterLabel(chapter) : "";
  $("page-label").textContent = chapter?.pages ? `${page} / ${chapter.pages}` : `Page ${page}`;
  // The bar needs the page count from MangaDex; hide it rather than show an empty bar.
  $("progress-bar").parentElement.hidden = !chapter?.pages;
  if (chapter?.pages) $("progress-bar").style.width = `${Math.min(100, (page / chapter.pages) * 100)}%`;

  // The music.
  const playing = music?.playing;
  const card = $("music-card");
  card.classList.toggle("playing", !!playing);
  card.classList.toggle("silent", !playing);
  $("music-icon").replaceChildren(icon(!music ? "mute" : playing ? "music" : "clock"));

  if (!music) {
    $("music-label").textContent = "No music";
    $("song-title").textContent = "No pack has music for this chapter";
    $("song-details").textContent = "Create a playlist below, or load a pack that covers it.";
  } else if (!playing) {
    $("music-label").textContent = "Coming up";
    $("song-title").textContent = `Music starts on page ${music.firstPage}`;
    $("song-details").textContent = `From “${music.pack}”`;
  } else {
    $("music-label").textContent = "Now playing";
    $("song-title").textContent = playing.title ?? `YouTube video ${playing.youtubeId}`;
    const next = playing.nextSongPage ? `next song on page ${playing.nextSongPage}` : "last song";
    const others = music.otherPacks ? ` · ${music.otherPacks} more in Library` : "";
    $("song-details").textContent = `Song ${playing.number} of ${music.songCount} · ${next}\nFrom “${music.pack}”${others}`;
  }
}

async function renderPackCount() {
  const packs = await getPacks();
  const on = packs.filter((p) => p.enabled).length;
  $("pack-count").textContent = packs.length === 0 ? "No packs yet" : `${on} of ${packs.length} packs on`;
}

// Firefox only shows its permission question after a click, so this must stay inside the click handler.
$("grant-permission").addEventListener("click", async () => {
  if (await browser.permissions.request(NEEDED)) render();
});

function openPage(path) {
  browser.tabs.create({ url: browser.runtime.getURL(path) });
  window.close();
}
$("open-creator").addEventListener("click", () => openPage(`src/creator/creator.html?chapter=${currentChapterId}`));
// The Music Library opens in a full tab (the popup can't show a folder picker).
$("open-library").addEventListener("click", () => openPage("src/library/library.html"));

renderIcons();
render();

// Re-render while the popup is open, so it follows your reading live.
browser.storage.onChanged.addListener(render);
