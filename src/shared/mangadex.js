// Turns MangaDex chapter IDs into readable info (manga name, chapter number, title, page count)
// using MangaDex's public API. Answers are saved in storage as "info:<chapterId>" so each
// chapter is only asked about once.

const API = "https://api.mangadex.org";
const BATCH = 100; // MangaDex returns at most 100 chapters per request

/** Returns { [chapterId]: info } for the chapters MangaDex knows about. Unknown ones are left out. */
export async function getChapterInfos(chapterIds) {
  const cached = await browser.storage.local.get(chapterIds.map((id) => `info:${id}`));
  const result = {};
  const missing = [];
  for (const id of chapterIds) {
    if (cached[`info:${id}`]) result[id] = cached[`info:${id}`];
    else missing.push(id);
  }

  for (let i = 0; i < missing.length; i += BATCH) {
    const params = new URLSearchParams({ limit: BATCH });
    for (const id of missing.slice(i, i + BATCH)) params.append("ids[]", id);
    params.append("includes[]", "manga");
    // By default MangaDex hides some content ratings from lists; we want every chapter.
    for (const rating of ["safe", "suggestive", "erotica", "pornographic"]) params.append("contentRating[]", rating);

    let json;
    try {
      const res = await fetch(`${API}/chapter?${params}`);
      if (!res.ok) throw new Error(`MangaDex answered ${res.status}`);
      json = await res.json();
    } catch (e) {
      console.warn("[MRC] couldn't reach MangaDex:", e.message);
      break; // offline or MangaDex is down: just show less info
    }

    const toSave = {};
    for (const chapter of json.data) {
      const info = describeChapter(chapter);
      result[chapter.id] = info;
      toSave[`info:${chapter.id}`] = info;
    }
    await browser.storage.local.set(toSave);
  }
  return result;
}

export async function getChapterInfo(chapterId) {
  return (await getChapterInfos([chapterId]))[chapterId] ?? null;
}

// Picks the fields we show from MangaDex's (much bigger) chapter data.
function describeChapter(chapter) {
  const a = chapter.attributes;
  const manga = chapter.relationships.find((r) => r.type === "manga");
  return {
    mangaId: manga?.id ?? null,
    mangaTitle: pickTitle(manga?.attributes),
    volume: a.volume,       // e.g. "1", or null
    chapter: a.chapter,     // e.g. "1", or null for oneshots
    title: a.title || null, // e.g. "The Black Swordsman", often empty
    pages: a.pages,
    language: a.translatedLanguage,
  };
}

// Manga titles come in several languages; prefer English, then whatever exists.
function pickTitle(mangaAttributes) {
  if (!mangaAttributes) return "Unknown manga";
  const { title, altTitles = [] } = mangaAttributes;
  return title.en ?? altTitles.find((t) => t.en)?.en ?? Object.values(title)[0] ?? "Unknown manga";
}

/** "Vol. 1 Ch. 3 — The Black Swordsman" (only the parts that exist). */
export function chapterLabel(info) {
  const parts = [];
  if (info.volume) parts.push(`Vol. ${info.volume}`);
  parts.push(info.chapter ? `Ch. ${info.chapter}` : "Oneshot");
  return parts.join(" ") + (info.title ? ` — ${info.title}` : "");
}
