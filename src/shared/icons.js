// Simple line icons. In HTML, write <span class="icon" data-icon="music"></span> and call renderIcons().
//
// Icon shapes from Lucide (https://lucide.dev), used under the ISC License:
//   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
//   All other copyright (c) for Lucide are held by Lucide Contributors 2022.
//   Permission to use, copy, modify, and/or distribute this software for any purpose with or without
//   fee is hereby granted, provided that the above copyright notice and this permission notice
//   appear in all copies.

const ICONS = {
  music: [["path", { d: "M9 18V5l12-2v13" }], ["circle", { cx: 6, cy: 18, r: 3 }], ["circle", { cx: 18, cy: 16, r: 3 }]],
  folder: [["path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }]],
  book: [["path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" }], ["path", { d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" }]],
  pencil: [["path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }]],
  trash: [["path", { d: "M3 6h18" }], ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }], ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]],
  x: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
  plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
  play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
  download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }], ["polyline", { points: "7 10 12 15 17 10" }], ["line", { x1: 12, x2: 12, y1: 15, y2: 3 }]],
  pin: [["path", { d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" }], ["circle", { cx: 12, cy: 10, r: 3 }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  alert: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
  chevron: [["path", { d: "m9 18 6-6-6-6" }]],
  external: [["path", { d: "M15 3h6v6" }], ["path", { d: "M10 14 21 3" }], ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]],
  mute: [["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }], ["line", { x1: 22, x2: 16, y1: 9, y2: 15 }], ["line", { x1: 16, x2: 22, y1: 9, y2: 15 }]],
  clock: [["circle", { cx: 12, cy: 12, r: 10 }], ["polyline", { points: "12 6 12 12 16 14" }]],
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Builds an <svg> element for the named icon. */
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
  })) svg.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name] ?? []) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

/** Fills every [data-icon] element inside `root` with its icon. */
export function renderIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    el.replaceChildren(icon(el.dataset.icon));
    el.classList.add("icon");
  }
}
