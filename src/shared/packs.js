// Music packs, as saved in the extension's storage:
//   "pack:<name>" → { name, enabled, loadedAt, chapters: { [chapterId]: cues } }
//   "choices"     → { [chapterId]: packName }
//
// Rule: only ONE pack plays for a chapter. If several switched-on packs have music for the same
// chapter, the one in "choices" wins; if nobody chose, the most recently loaded pack wins.

export const MY_PACK = "My playlists"; // where playlists made in the creator go

export async function getPacks() {
  const everything = await browser.storage.local.get(null);
  return Object.entries(everything)
    .filter(([key]) => key.startsWith("pack:"))
    .map(([, pack]) => pack)
    .sort((a, b) => a.loadedAt - b.loadedAt);
}

async function getPack(name) {
  const key = `pack:${name}`;
  return (await browser.storage.local.get(key))[key] ?? null;
}

async function putPack(pack) {
  await browser.storage.local.set({ [`pack:${pack.name}`]: pack });
}

/** Adds a pack, or replaces a pack with the same name (keeping its on/off switch). Returns true if replaced. */
export async function importPack(name, chapters) {
  const old = await getPack(name);
  await putPack({ name, enabled: old?.enabled ?? true, loadedAt: old?.loadedAt ?? Date.now(), chapters });
  return Boolean(old);
}

export async function removePack(name) {
  await browser.storage.local.remove(`pack:${name}`);
}

export async function setPackEnabled(name, enabled) {
  const pack = await getPack(name);
  if (!pack) return;
  pack.enabled = enabled;
  await putPack(pack);
}

/** Removes one chapter from a pack. A pack left with no chapters is removed too. */
export async function removeChapter(name, chapterId) {
  const pack = await getPack(name);
  if (!pack) return;
  delete pack.chapters[chapterId];
  if (Object.keys(pack.chapters).length === 0) await removePack(name);
  else await putPack(pack);
}

/** Saves a playlist from the creator into "My playlists" and makes it the one that plays. */
export async function saveMyPlaylist(chapterId, cues) {
  const pack = (await getPack(MY_PACK)) ?? { name: MY_PACK, enabled: true, loadedAt: Date.now(), chapters: {} };
  pack.chapters[chapterId] = cues;
  pack.enabled = true;
  await putPack(pack);
  await choosePack(chapterId, MY_PACK);
}

export async function getChoices() {
  return (await browser.storage.local.get("choices")).choices ?? {};
}

/** Makes `name` the pack that plays for this chapter. */
export async function choosePack(chapterId, name) {
  const choices = await getChoices();
  choices[chapterId] = name;
  await browser.storage.local.set({ choices });
}

/**
 * Decides which pack plays for a chapter.
 * Returns { pack, cues, candidates } (candidates = every switched-on pack that has this chapter),
 * or null if none does.
 */
export function resolveChapter(packs, choices, chapterId) {
  const candidates = packs.filter((p) => p.enabled && p.chapters[chapterId]);
  if (candidates.length === 0) return null;
  const chosen = candidates.find((p) => p.name === choices[chapterId]) ?? candidates.at(-1);
  return { pack: chosen.name, cues: chosen.chapters[chapterId], candidates: candidates.map((p) => p.name) };
}

export async function findMusic(chapterId) {
  const [packs, choices] = await Promise.all([getPacks(), getChoices()]);
  return resolveChapter(packs, choices, chapterId);
}

/** True if a storage change touched packs or choices. */
export function isLibraryChange(changes) {
  return Object.keys(changes).some((k) => k.startsWith("pack:") || k === "choices");
}

/** Moves packs saved by older versions ("chapter:<id>" → { pack, cues }) into the new format. */
export async function migrateOldFormat() {
  const everything = await browser.storage.local.get(null);
  const oldKeys = Object.keys(everything).filter((k) => k.startsWith("chapter:"));
  if (oldKeys.length === 0) return;

  const packs = {};
  for (const key of oldKeys) {
    const { pack, cues } = everything[key];
    (packs[pack] ??= { name: pack, enabled: true, loadedAt: Date.now(), chapters: {} }).chapters[key.slice(8)] = cues;
  }
  await browser.storage.local.set(Object.fromEntries(Object.values(packs).map((p) => [`pack:${p.name}`, p])));
  await browser.storage.local.remove(oldKeys);
  console.log("[MRC] moved old packs to the new format:", Object.keys(packs));
}
