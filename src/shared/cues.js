// Music file format (one file per chapter):
// { "chapterId": "<mangadex uuid>", "cues": [{ "page": 1, "youtubeId": "dQw4w9WgXcQ", "startAt": 0 }] }
// A cue applies from its page until the next cue's page.

/** Returns the cue in effect for `page`, or null if the page precedes the first cue. */
export function findCue(cues, page) {
  let active = null;
  for (const cue of cues) {
    if (cue.page > page) break;
    active = cue;
  }
  return active;
}

/**
 * Checks a music file and returns { chapterId, cues } with cues sorted by page.
 * Throws an Error whose message is readable by non-programmers if something is wrong.
 */
export function parseSyncFile(json) {
  if (!json || !/^[0-9a-f-]{36}$/i.test(json.chapterId)) throw new Error("missing or invalid chapter ID");
  if (!Array.isArray(json.cues) || json.cues.length === 0) throw new Error("no songs listed");
  for (const c of json.cues) {
    if (!Number.isInteger(c.page) || c.page < 1) throw new Error(`invalid page number: ${c.page}`);
    if (!/^[A-Za-z0-9_-]{11}$/.test(c.youtubeId)) throw new Error(`invalid YouTube video: ${c.youtubeId}`);
    if (typeof c.startAt !== "number" || c.startAt < 0) throw new Error(`invalid start time: ${c.startAt}`);
  }
  return { chapterId: json.chapterId, cues: [...json.cues].sort((a, b) => a.page - b.page) };
}
