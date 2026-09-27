// Asks YouTube about a video using its public oEmbed service (no key needed).
// Titles are saved in storage as "yt:<videoId>" so each video is only asked about once.

/**
 * Checks whether a video exists and can be played in our player.
 * Returns { ok: true, title } or { ok: false, reason } where reason is
 * "notFound" (deleted, private or mistyped), "noEmbed" (owner blocks playing outside YouTube)
 * or "offline" (couldn't reach YouTube).
 */
export async function checkVideo(videoId) {
  const key = `yt:${videoId}`;
  const cached = (await browser.storage.local.get(key))[key];
  if (cached) return { ok: true, title: cached };

  let res;
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "noEmbed" };
  if (!res.ok) return { ok: false, reason: "notFound" };

  const { title } = await res.json();
  await browser.storage.local.set({ [key]: title });
  return { ok: true, title };
}

/** Returns the video's title, or null if YouTube can't tell us. */
export async function getVideoTitle(videoId) {
  const result = await checkVideo(videoId);
  return result.ok ? result.title : null;
}
