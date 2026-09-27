// The music player: a small, movable YouTube player in the corner of MangaDex.
// It doesn't decide anything itself. It follows instructions from the background script:
//   { type: "playCue", chapterId, cue }  → play this song (or keep playing it if it already is)
//   { type: "songTitle", youtubeId, title } → show the song's name on the drag bar
//   { type: "stopMusic" }                → remove the player

(() => {
  // The cue that's playing right now, or null if nothing is.
  let playingCue = null;
  let playingKey = null; // identifies the cue (chapter, page, video, start), so we can tell if it changed

  // The box that holds everything. It's what gets moved and faded.
  const box = document.createElement("div");
  box.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
    width: 300px; border-radius: 14px; overflow: hidden;
    background: #18181b; border: 1px solid rgba(255,255,255,.08);
    box-shadow: 0 12px 32px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.2);
    opacity: 0.35; transition: opacity .2s;`;
  // Fade in while the mouse is over the player, fade out when it leaves.
  box.addEventListener("mouseenter", () => (box.style.opacity = "1"));
  box.addEventListener("mouseleave", () => (box.style.opacity = "0.35"));

  // The bar on top you grab to drag the player around. It shows the song's title.
  const handle = document.createElement("div");
  handle.title = "Drag to move";
  handle.style.cssText = `
    display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
    font: 500 12px ui-sans-serif, system-ui, sans-serif; color: #d4d4d8;
    cursor: grab; user-select: none;`;

  // Six-dot "grip" icon, the usual sign for "you can drag this".
  const grip = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  grip.setAttribute("viewBox", "0 0 24 24");
  grip.setAttribute("fill", "#71717a");
  grip.style.cssText = "width: 14px; height: 14px; flex-shrink: 0;";
  for (const [cx, cy] of [[9, 5], [9, 12], [9, 19], [15, 5], [15, 12], [15, 19]]) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("r", 1.6);
    grip.append(dot);
  }

  const songTitle = document.createElement("span");
  songTitle.textContent = "Now playing";
  songTitle.style.cssText = "overflow: hidden; white-space: nowrap; text-overflow: ellipsis;";
  handle.append(grip, songTitle);

  const player = document.createElement("iframe");
  player.allow = "autoplay; encrypted-media";
  player.style.cssText = "display: block; width: 300px; height: 169px; border: 0;";

  box.append(handle, player);
  // The box is only added to the page when there's something to play (see playCue below).

  // Dragging: remember where the mouse grabbed the box, then move the box with the mouse.
  // setPointerCapture keeps sending us mouse moves even when the mouse passes over the video.
  let grabX = 0, grabY = 0;
  handle.addEventListener("pointerdown", (e) => {
    const rect = box.getBoundingClientRect();
    grabX = e.clientX - rect.left;
    grabY = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = "grabbing";
  });
  handle.addEventListener("pointermove", (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    // Keep the box inside the window.
    const x = Math.min(Math.max(0, e.clientX - grabX), window.innerWidth - box.offsetWidth);
    const y = Math.min(Math.max(0, e.clientY - grabY), window.innerHeight - box.offsetHeight);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.right = box.style.bottom = "auto";
  });
  handle.addEventListener("pointerup", (e) => {
    handle.releasePointerCapture(e.pointerId);
    handle.style.cursor = "grab";
  });

  function sendCommand(func, args = []) {
    player.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com"
    );
  }

  // Looping: ask the player to send us updates, and restart the song when it ends.
  const ENDED = 0; // YouTube's number for "the video finished"

  player.addEventListener("load", () => {
    player.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "https://www.youtube.com");
  });

  window.addEventListener("message", (e) => {
    if (e.origin !== "https://www.youtube.com") return; // ignore messages not from YouTube

    let data;
    try {
      data = JSON.parse(e.data);
    } catch {
      return; // not a YouTube player update
    }

    // YouTube reports the state in one of two message shapes, so check both.
    const state = data.event === "onStateChange" ? data.info : data.info?.playerState;
    if (state !== ENDED || !playingCue) return;

    console.log(`[MRC] song ended → looping from ${playingCue.startAt}s`);
    sendCommand("seekTo", [playingCue.startAt, true]);
    sendCommand("playVideo");
  });

  function playCue(chapterId, cue) {
    const key = `${chapterId}:${cue.page}:${cue.youtubeId}:${cue.startAt}`;
    // Same cue as before → the right song is already playing, leave it alone.
    if (key === playingKey) return;
    playingKey = key;
    playingCue = cue;
    songTitle.textContent = "Now playing";

    if (!box.isConnected) {
      // Player isn't on the page yet: add it, starting on this song.
      console.log(`[MRC] showing player: ${cue.youtubeId} at ${cue.startAt}s`);
      player.src = `https://www.youtube.com/embed/${cue.youtubeId}?enablejsapi=1&start=${cue.startAt}`;
      document.body.appendChild(box);
    } else {
      console.log(`[MRC] switching to ${cue.youtubeId} at ${cue.startAt}s`);
      sendCommand("loadVideoById", [{ videoId: cue.youtubeId, startSeconds: cue.startAt }]);
    }
  }

  function stopMusic() {
    if (!box.isConnected) return;
    console.log("[MRC] removing player");
    box.remove(); // taking the player off the page also stops the video
    playingCue = playingKey = null;
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "playCue") playCue(msg.chapterId, msg.cue);
    if (msg.type === "stopMusic") stopMusic();
    if (msg.type === "songTitle" && msg.youtubeId === playingCue?.youtubeId) songTitle.textContent = msg.title;
  });
})();
