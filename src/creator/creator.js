// The Playlist Creator: build or edit the music for one chapter, try it out, and save it as a file.
// Opened from the popup as creator.html?chapter=<chapterId>.

import { parseSyncFile } from "../shared/cues.js";
import { getChapterInfo, chapterLabel } from "../shared/mangadex.js";
import { checkVideo } from "../shared/youtube.js";
import { icon, renderIcons } from "../shared/icons.js";
import { MY_PACK, findMusic, saveMyPlaylist } from "../shared/packs.js";

const $ = (id) => document.getElementById(id);
const chapterId = new URLSearchParams(location.search).get("chapter");
const SAVE_FOLDER = "Manga Reading Companion"; // inside Downloads

let chapterInfo = null; // from MangaDex; null if it couldn't be reached

// ---------- Times: "1:30" ↔ 90 seconds ----------

/** "1:30" → 90, "90" → 90, "1:02:03" → 3723, "" → 0. Returns null if it can't be read. */
function parseTime(text) {
  text = text.trim();
  if (!text) return 0;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return null;
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** 90 → "1:30" */
function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

// ---------- YouTube links ----------

/**
 * Pulls the video ID (and start time, if any) out of anything people usually paste:
 * youtube.com/watch?v=…, youtu.be/…, music.youtube.com/…, /shorts/…, /embed/…, or a bare ID.
 * Returns { id, start } (start is seconds or null), or null if it isn't a YouTube video link.
 */
function parseYouTubeLink(text) {
  text = text.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return { id: text, start: null };

  let url;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1, 12);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return { id, start: parseYouTubeTime(url.searchParams.get("t") ?? url.searchParams.get("start")) };
}

/** YouTube writes times as "42", "42s", "1m30s" or "1h2m3s". */
function parseYouTubeTime(t) {
  const m = t?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m || !m[0]) return null;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

const VIDEO_PROBLEMS = {
  notFound: "YouTube can't find this video. It may be deleted, private, or the link is incomplete.",
  noEmbed: "This video's owner doesn't allow playing it outside YouTube. Try another upload of the same song.",
};

// ---------- The song list ----------

function songRows() {
  return [...$("song-list").children];
}

function renumber() {
  songRows().forEach((row, i) => {
    const number = row.querySelector(".song-number");
    number.dataset.n = i + 1;
    number.textContent = "Song";
  });
}

/** Adds a song to the list, optionally filled in. */
function addSong({ page = "", youtubeId = "", startAt = 0 } = {}) {
  const row = $("song-template").content.firstElementChild.cloneNode(true);
  renderIcons(row);
  const link = row.querySelector(".link");

  row.querySelector(".page").value = page;
  row.querySelector(".page").max = chapterInfo?.pages ?? "";
  row.querySelector(".start").value = formatTime(startAt);
  link.value = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";

  // Check the link shortly after the person stops typing or pastes.
  let timer;
  link.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => checkLink(row), 400);
  });

  row.querySelector(".remove").addEventListener("click", () => {
    row.remove();
    renumber();
  });

  row.querySelector(".here").addEventListener("click", async () => {
    const { reader } = await browser.storage.session.get("reader");
    if (reader?.chapterId === chapterId) {
      row.querySelector(".page").value = reader.page;
    } else {
      showMessage("bad", "Open this chapter in another tab first, then go to the page where the song should start.");
    }
  });

  $("song-list").append(row);
  renumber();
  if (youtubeId) checkLink(row);
  return row;
}

/** Reads the row's link, fills in the start time if the link has one, and asks YouTube about the video. */
async function checkLink(row) {
  const link = row.querySelector(".link");
  const text = link.value;
  row.dataset.videoId = "";

  if (!text.trim()) return setStatus(row, "", "");
  const parsed = parseYouTubeLink(text);
  if (!parsed) return setStatus(row, "bad", "That doesn't look like a YouTube video link.");
  if (parsed.start !== null) row.querySelector(".start").value = formatTime(parsed.start);

  setStatus(row, "", "Checking…");
  const result = await checkVideo(parsed.id);
  if (link.value !== text) return; // the link changed while we waited; a newer check will handle it

  if (result.ok) {
    row.dataset.videoId = parsed.id;
    setStatus(row, "ok", result.title);
  } else if (result.reason === "offline") {
    row.dataset.videoId = parsed.id; // can't check now; let the person use it anyway
    setStatus(row, "warn", "Couldn't reach YouTube to check this video. Are you offline?");
  } else {
    setStatus(row, "bad", VIDEO_PROBLEMS[result.reason]);
  }
}

function setStatus(row, kind, text) {
  const status = row.querySelector(".video-status");
  status.className = `video-status ${kind}`;
  const icons = { ok: "check", bad: "alert", warn: "alert" };
  status.replaceChildren(...(icons[kind] ? [Object.assign(document.createElement("span"), { className: "icon" })] : []), text);
  if (icons[kind]) status.firstChild.append(icon(icons[kind]));
}

// ---------- Checking and saving ----------

/** Turns the song list into a music file. Returns { file } or { errors: [...] } in plain words. */
function buildFile() {
  const errors = [];
  const cues = [];

  songRows().forEach((row, i) => {
    const n = i + 1;
    const page = Number(row.querySelector(".page").value);
    const startAt = parseTime(row.querySelector(".start").value);

    if (!row.dataset.videoId) errors.push(`Song ${n}: paste a YouTube link that works (look for the green check).`);
    if (!Number.isInteger(page) || page < 1) errors.push(`Song ${n}: choose the page it starts on.`);
    else if (chapterInfo?.pages && page > chapterInfo.pages) {
      errors.push(`Song ${n}: this chapter only has ${chapterInfo.pages} pages.`);
    }
    if (startAt === null) errors.push(`Song ${n}: write the start time as minutes:seconds, like 1:30.`);

    cues.push({ page, youtubeId: row.dataset.videoId, startAt });
  });

  if (cues.length === 0) errors.push("Add at least one song.");

  const seen = new Set();
  for (const { page } of cues) {
    if (seen.has(page)) errors.push(`Two songs start on page ${page}. Each song needs its own starting page.`);
    seen.add(page);
  }

  if (errors.length) return { errors: [...new Set(errors)] };

  cues.sort((a, b) => a.page - b.page);
  return {
    file: {
      chapterId,
      // For people reading the file; the extension only needs chapterId and cues.
      manga: chapterInfo?.mangaTitle,
      chapter: chapterInfo ? chapterLabel(chapterInfo) : undefined,
      cues,
    },
  };
}

/** Puts the playlist in the library ("My playlists"), so it plays right away when reading. */
async function saveToLibrary(file) {
  const { cues } = parseSyncFile(file);
  await saveMyPlaylist(chapterId, cues);
}

/** "Manga Reading Companion/Berserk/Vol. 1 Ch. 0.01 — The Black Swordsman [en].json" */
function savePath() {
  // Remove characters that aren't allowed in file names.
  const clean = (s) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "");
  if (!chapterInfo) return `${SAVE_FOLDER}/Unknown manga/${chapterId}.json`;
  const manga = clean(chapterInfo.mangaTitle) || "Unknown manga";
  const name = clean(chapterLabel(chapterInfo)) || chapterId;
  // The language tag keeps different translations of the same chapter from overwriting each other.
  return `${SAVE_FOLDER}/${manga}/${name} [${chapterInfo.language}].json`;
}

async function downloadFile(file, askWhere) {
  const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    await browser.downloads.download({ url, filename: savePath(), saveAs: askWhere, conflictAction: "overwrite" });
    return true;
  } catch (e) {
    if (/cancel/i.test(e.message)) return false; // closed the "Save as" window
    throw e;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Shows a message under the song list. kind: "ok" or "bad". */
function showMessage(kind, text, list = []) {
  const body = document.createElement("div");
  body.textContent = text;
  if (list.length) {
    const ul = document.createElement("ul");
    for (const item of list) ul.append(Object.assign(document.createElement("li"), { textContent: item }));
    body.append(ul);
  }
  const iconBox = Object.assign(document.createElement("span"), { className: "icon" });
  iconBox.append(icon(kind === "ok" ? "check" : "alert"));
  const alert = Object.assign(document.createElement("div"), { className: `alert alert-${kind}` });
  alert.append(iconBox, body);

  const box = $("message");
  box.replaceChildren(alert);
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** Checks the playlist and either shows what's wrong or returns the file. */
function fileOrShowErrors() {
  const { file, errors } = buildFile();
  if (errors) showMessage("bad", "Almost there! Please fix:", errors);
  return file ?? null;
}

$("add-song").addEventListener("click", () => {
  const rows = songRows();
  const lastPage = Number(rows.at(-1)?.querySelector(".page").value) || 0;
  addSong({ page: lastPage + 1 }).querySelector(".link").focus();
});

$("try-it").addEventListener("click", async () => {
  const file = fileOrShowErrors();
  if (!file) return;
  await saveToLibrary(file);
  showMessage("ok", "Added to your library. Go to the chapter tab: the music is already updated.");
});

async function save(askWhere) {
  const file = fileOrShowErrors();
  if (!file) return;
  await saveToLibrary(file);
  try {
    if (await downloadFile(file, askWhere)) {
      showMessage("ok", askWhere ? "Saved!" : `Saved to Downloads/${savePath()}`);
    }
  } catch (e) {
    showMessage("bad", `Couldn't save the file: ${e.message}`);
  }
}

$("save-file").addEventListener("click", () => save(false));
$("save-elsewhere").addEventListener("click", (e) => {
  e.preventDefault();
  save(true);
});

// ---------- Start ----------

async function start() {
  if (!chapterId) {
    $("manga-title").textContent = "No chapter chosen";
    $("chapter-label").textContent = "Open a chapter on MangaDex, then use the extension's popup to open the creator.";
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    return;
  }

  chapterInfo = await getChapterInfo(chapterId);
  $("manga-title").textContent = chapterInfo?.mangaTitle ?? "Unknown manga";
  $("chapter-label").textContent = chapterInfo
    ? `${chapterLabel(chapterInfo)} · ${chapterInfo.pages} pages`
    : `Chapter ${chapterId}`;
  $("chapter-label").textContent += " ·";
  document.title = `✏️ ${chapterInfo?.mangaTitle ?? "Playlist"} — Playlist Creator`;
  $("open-chapter").href = `https://mangadex.org/chapter/${chapterId}`;
  $("save-path").textContent = savePath();

  // Editing: start from the music that plays for this chapter now, if any.
  const existing = await findMusic(chapterId);
  if (existing) {
    existing.cues.forEach((cue) => addSong(cue));
    if (existing.pack !== MY_PACK) {
      const alert = Object.assign(document.createElement("div"), { className: "alert alert-warn" });
      const iconBox = Object.assign(document.createElement("span"), { className: "icon" });
      iconBox.append(icon("alert"));
      alert.append(iconBox, Object.assign(document.createElement("div"), {
        textContent:
          `This chapter's music comes from the pack “${existing.pack}”. You're editing a copy: when you save, ` +
          `it goes to “${MY_PACK}” and plays instead. The original pack isn't changed.`,
      }));
      $("notice").replaceChildren(alert);
      $("notice").hidden = false;
    }
  } else {
    addSong({ page: 1 });
  }
}

renderIcons();
start();
