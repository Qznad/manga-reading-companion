// The Music Library page: load pack folders, switch packs on/off, remove packs or chapters,
// and choose which pack plays when two packs have music for the same chapter.
//
// Firefox can't keep reading a folder on your computer, so loading a pack COPIES its music files
// into the extension's storage (see shared/packs.js).

import { parseSyncFile } from "../shared/cues.js";
import { getChapterInfos, chapterLabel } from "../shared/mangadex.js";
import { icon, renderIcons } from "../shared/icons.js";
import {
  getPacks, getChoices, resolveChapter, importPack, removePack, removeChapter,
  setPackEnabled, choosePack, isLibraryChange,
} from "../shared/packs.js";

const $ = (id) => document.getElementById(id);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Small helper to build elements: el("span", { className: "x" }, child1, "text", ...)
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

function iconEl(name) {
  return el("span", { className: "icon" }, icon(name));
}

// ---------- Loading a pack folder ----------

$("load-button").addEventListener("click", () => $("folder-input").click());

$("folder-input").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = ""; // so picking the same folder again still works
  if (files.length === 0) return;

  // The folder's name is the first part of each file's path, e.g. "Berserk pack/abc.json".
  const packName = files[0].webkitRelativePath.split("/")[0];
  const chapters = {};
  const problems = [];

  for (const file of files) {
    if (!file.name.endsWith(".json")) continue; // ignore READMEs, images, etc.
    try {
      const { chapterId, cues } = parseSyncFile(JSON.parse(await file.text()));
      chapters[chapterId] = cues;
    } catch (err) {
      problems.push(`${file.name}: ${err.message}`);
    }
  }

  const count = Object.keys(chapters).length;
  if (count === 0) {
    showResult("bad", `No music files found in “${packName}”.`, problems);
    return;
  }
  const replaced = await importPack(packName, chapters);
  showResult(
    problems.length ? "warn" : "ok",
    `${replaced ? "Updated" : "Loaded"} “${packName}”: music for ${plural(count, "chapter")}.` +
      (problems.length ? ` ${plural(problems.length, "file")} skipped:` : ""),
    problems,
  );
});

function showResult(kind, text, list = []) {
  const box = $("result");
  const icons = { ok: "check", warn: "alert", bad: "alert" };
  const body = el("div", {}, text);
  if (list.length) body.append(el("ul", {}, ...list.map((item) => el("li", { textContent: item }))));
  box.replaceChildren(el("div", { className: `alert alert-${kind}` }, iconEl(icons[kind]), body));
  box.hidden = false;
}

// ---------- The pack list ----------

const openPacks = new Set(); // packs whose chapter list is expanded (kept across re-draws)

async function render() {
  const [packs, choices] = await Promise.all([getPacks(), getChoices()]);
  const infos = await getChapterInfos(packs.flatMap((p) => Object.keys(p.chapters)));

  $("empty").hidden = packs.length > 0;
  const enabled = packs.filter((p) => p.enabled).length;
  $("pack-summary").textContent = packs.length ? `${enabled} of ${packs.length} switched on` : "";

  // Newest first.
  $("pack-list").replaceChildren(...[...packs].reverse().map((pack) => packCard(pack, packs, choices, infos)));
}

function packCard(pack, packs, choices, infos) {
  const chapterIds = Object.keys(pack.chapters);
  const mangaNames = [...new Set(chapterIds.map((id) => infos[id]?.mangaTitle).filter(Boolean))];

  // Chapters where another switched-on pack wins.
  const notPlaying = pack.enabled
    ? chapterIds.filter((id) => resolveChapter(packs, choices, id).pack !== pack.name).length
    : 0;

  const toggle = el("input", { type: "checkbox", className: "switch", checked: pack.enabled, title: "Use this pack" });
  toggle.addEventListener("change", () => setPackEnabled(pack.name, toggle.checked));

  const meta = el("p", { className: "pack-meta" },
    [plural(chapterIds.length, "chapter"), mangaNames.slice(0, 3).join(", ") + (mangaNames.length > 3 ? "…" : "")]
      .filter(Boolean).join(" · "),
    notPlaying ? el("span", { className: "badge badge-warn" }, `${notPlaying} used from another pack`) : null,
  );
  const info = el("div", { className: "pack-info" }, el("p", { className: "pack-name", textContent: pack.name }), meta);

  const expand = el("button", { className: "btn btn-ghost btn-icon expand", title: "Show chapters" }, iconEl("chevron"));
  const remove = confirmButton("Remove pack", () => removePack(pack.name));

  const card = el("li", { className: `card pack${pack.enabled ? "" : " off"}${openPacks.has(pack.name) ? " open" : ""}` },
    el("div", { className: "pack-head" }, toggle, info, remove, expand));

  const list = el("ul", { className: "chapters", hidden: !openPacks.has(pack.name) },
    ...sortChapters(chapterIds, infos).map((id) => chapterRow(pack, id, packs, choices, infos[id])));
  card.append(list);

  const flip = () => {
    const open = !openPacks.has(pack.name);
    if (open) openPacks.add(pack.name);
    else openPacks.delete(pack.name);
    card.classList.toggle("open", open);
    list.hidden = !open;
  };
  info.addEventListener("click", flip);
  expand.addEventListener("click", flip);
  return card;
}

// By manga name, then chapter number.
function sortChapters(ids, infos) {
  return [...ids].sort((a, b) =>
    (infos[a]?.mangaTitle ?? "~").localeCompare(infos[b]?.mangaTitle ?? "~") ||
    parseFloat(infos[a]?.chapter ?? 0) - parseFloat(infos[b]?.chapter ?? 0));
}

function chapterRow(pack, chapterId, packs, choices, info) {
  const songs = pack.chapters[chapterId].length;
  const name = el("div", { className: "chapter-name" },
    el("a", { href: `https://mangadex.org/chapter/${chapterId}`, target: "_blank",
      textContent: info ? chapterLabel(info) : `Unknown chapter` }),
    el("span", { className: "faint", textContent: `${info?.mangaTitle ?? chapterId} · ${plural(songs, "song")}` }),
  );

  // Only one pack plays per chapter: say which, and offer to switch when there's a choice.
  let status = null;
  if (pack.enabled) {
    const { pack: winner, candidates } = resolveChapter(packs, choices, chapterId);
    if (candidates.length > 1) {
      if (winner === pack.name) {
        status = el("span", { className: "badge badge-accent" }, iconEl("check"), "Playing");
      } else {
        status = el("button", { className: "btn", title: `Right now “${winner}” plays for this chapter` }, "Use this pack");
        status.addEventListener("click", () => choosePack(chapterId, pack.name));
      }
    }
  }

  const remove = el("button", { className: "btn btn-ghost btn-icon btn-danger", title: "Remove this chapter from the pack" }, iconEl("x"));
  remove.addEventListener("click", () => removeChapter(pack.name, chapterId));

  return el("li", { className: "chapter" }, name, status, remove);
}

/** A button that asks "Sure?" on the first click and acts on the second. */
function confirmButton(label, action) {
  const text = document.createTextNode(label);
  const btn = el("button", { className: "btn btn-ghost btn-danger" }, iconEl("trash"), text);
  let timer;
  const reset = () => {
    clearTimeout(timer);
    btn.classList.remove("confirming");
    text.textContent = label;
  };
  btn.addEventListener("click", () => {
    if (btn.classList.contains("confirming")) return action();
    btn.classList.add("confirming");
    text.textContent = "Click again to remove";
    timer = setTimeout(reset, 3000);
  });
  btn.addEventListener("blur", reset);
  return btn;
}

renderIcons();
render();

// Redraw whenever packs change (here, in the creator, or anywhere else).
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && isLibraryChange(changes)) render();
});
