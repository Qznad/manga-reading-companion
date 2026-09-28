<p align="center"><img src="icons/icon.svg" width="112" alt="Manga Reading Companion icon"></p>

<h1 align="center">Manga Reading Companion</h1>

**A soundtrack for your manga.** Manga Reading Companion is a Firefox extension that plays music synced to the page you're reading on [MangaDex](https://mangadex.org). When the story shifts, so does the music.

Fans have long paired manga with music by hand, like reading *Berserk* with Susumu Hirasawa's soundtrack playing. This extension does it for you. Each song starts on the right page and loops until the scene changes, so you can keep your eyes on the page.

> **Status:** early version. It works, but isn't on the Firefox Add-ons store yet. See [Install](#install).

---

## Features

- **Page-synced music:** each song starts on a chosen page and plays until the next song's page.
- **Works with webtoons:** supports Long Strip chapters too. The page is tracked as you scroll.
- **Seamless looping:** slow reader? A song repeats from its chosen start time until you reach the next scene, so there's never silence.
- **Music packs:** music comes in packs, simple folders you download and load in one click. Works for **any manga on MangaDex**.
- **Playlist creator:** make your own soundtrack for any chapter without writing code:
  - paste a YouTube link and see the song's title straight away;
  - pick pages with one click while you read;
  - try it live, then save it as a file to share.
- **You're in control:** switch packs on and off, remove chapters, and when two packs cover the same chapter, pick which one plays.
- **An unobtrusive player:** a small YouTube player you can drag anywhere. It fades out while you read and shows the song's title.
- **Reading at a glance:** the popup shows the manga, chapter, page progress, the song playing and what's coming next.
- **Light and dark mode:** follows your system setting.
- **Private:** no accounts, no tracking, no servers. See [Privacy](#privacy).

---

## Install

The extension isn't on the Firefox Add-ons store yet. Until it is, you can load it from this repository:

1. [Download this repository](../../archive/refs/heads/main.zip) and unzip it, or `git clone` it.
2. In Firefox, go to `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
3. Select the `manifest.json` file in the folder.
4. Click the extension's icon. If it asks for access to MangaDex and YouTube, click **Allow**.

> Temporary add-ons are removed when Firefox closes. You'll need to repeat step 2 after restarting, until the extension is published.

**Requires Firefox 128 or newer.** Chrome isn't supported yet.

---

## How to use it

### Listening

1. Open **Music Library** from the extension's popup and click **Load a music pack folder**.
2. Open a chapter on MangaDex that the pack covers. A small player appears in the corner.
3. Click play once. Firefox needs one click before a page can play sound. From then on, the music follows your reading.

### Making a playlist

1. While reading a chapter, open the popup and click **Create a playlist for this chapter**.
2. For each song:
   - paste a YouTube link;
   - choose the page it starts on (or click **Page I'm on**);
   - optionally, set a start time like `1:30`.
3. Click **Try it while reading** to hear it right away.
4. Click **Save file** when you're happy. It's saved to `Downloads/Manga Reading Companion/<Manga>/`, and that folder is a ready-to-share pack.

Tip: on YouTube, right-click the video and choose **Copy video URL at current time**. The creator reads that time and fills in the start time for you.

---

## Music packs

A pack is just a folder of small text files, one per chapter. File and folder names can be anything, and subfolders are fine.

```json
{
  "chapterId": "6310f6a1-17ee-4890-b837-2ec1b372905b",
  "manga": "Berserk",
  "chapter": "Vol. 1 Ch. 0.01 — The Black Swordsman",
  "cues": [
    { "page": 1, "youtubeId": "vZa0Yh6e7dw", "startAt": 0 },
    { "page": 5, "youtubeId": "70GD2SBCq64", "startAt": 42 }
  ]
}
```

| Field | Meaning |
|---|---|
| `chapterId` | The chapter's MangaDex ID: the long code in `mangadex.org/chapter/<chapterId>`. Each translation of a chapter has its own ID. |
| `cues` | The songs. Each one plays from its `page` until the next cue's page. |
| `youtubeId` | The 11-character code after `watch?v=` in a YouTube link. |
| `startAt` | Where in the song to start, in seconds. |
| `manga`, `chapter` | Optional, for people reading the file. The extension ignores them. |

You don't need to write these by hand. The playlist creator makes them for you. An example is in [`example-pack/`](example-pack/).

**Sharing packs:** zip the folder and share it anywhere: Discord, Reddit, Google Drive. Packs contain only YouTube video IDs, never the music itself.

---

## Privacy

- **No accounts, analytics or tracking.** The extension has no server of its own.
- **Your packs and playlists stay in your browser.**
- **It only contacts three places:**
  - `api.mangadex.org`, for manga and chapter names;
  - `youtube.com`, for song titles and the player itself;
  - `mangadex.org`, the page you're already reading.

---

## Known limitations

- **One click to start:** Firefox blocks sound until you interact with the player, so you click play once per chapter.
- **Some videos can't be embedded:** their owners block playing them outside YouTube. The creator warns you, so you can pick another upload.
- **Firefox only**, for now.

---

## For developers

It's plain JavaScript, with no build step and no dependencies. Edit a file, then click **Reload** in `about:debugging`.

```
manifest.json            Extension settings and permissions
src/
  content/content.js     Runs on MangaDex: detects the chapter and page
  content/player.js      Runs on MangaDex: the draggable YouTube player
  background/            Decides what plays: finds the pack and cue for the page
  popup/                 The toolbar popup
  library/               Music Library page (load, switch, remove packs)
  creator/               Playlist creator page
  shared/                Code used by several parts: packs, cues, MangaDex/YouTube lookups, icons, theme
example-pack/            A sample music pack
```

**How it fits together:**
1. `content.js` reports the page to the background script.
2. The background script picks the pack and song for that page.
3. It tells `player.js` what to play.
4. It saves a summary for the popup to show.

Bug reports and ideas are welcome in [Issues](../../issues).

---

## License

[GPL-3.0](LICENSE) © Yassine Belhadj

*Not affiliated with MangaDex or YouTube.*
