'use strict';

/* Inline stroke icons on a 24×24 grid. Inlined rather than loaded from a CDN so
   the app stays fully offline-capable, and drawn as strokes so they inherit
   `currentColor` and the surrounding font-size. */

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.9-3.9"/>',
  settings: '<path d="M4 7h8M17 7h3M4 12h3M12 12h8M4 17h8M17 17h3"/>'
    + '<circle cx="14.5" cy="7" r="2.2"/><circle cx="9.5" cy="12" r="2.2"/><circle cx="14.5" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M8 12.4l2.8 2.8L16.2 9"/>',
  heart: '<path d="M12 20.3S4.5 15.6 4.5 10.6A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4c0 5-7.5 9.7-7.5 9.7z"/>',
  code: '<path d="M9 8l-4.5 4L9 16M15 8l4.5 4L15 16"/>',
  sparkle: '<path d="M12 3.2l1.9 5.4 5.4 1.9-5.4 1.9L12 17.8l-1.9-5.4L4.7 10.5l5.4-1.9z"/>',
  dumbbell: '<path d="M4 9.5v5M7.5 7v10M16.5 7v10M20 9.5v5M7.5 12h9"/>',
  chart: '<path d="M3.5 20.5h17M7.5 20.5v-7M12 20.5V6.5M16.5 20.5v-4.5"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  flame: '<path d="M12 21.5a5.6 5.6 0 0 0 5.6-5.6c0-4.7-5.6-10.4-5.6-10.4S6.4 11.2 6.4 15.9A5.6 5.6 0 0 0 12 21.5z"/>'
    + '<path d="M12 21.5a2.4 2.4 0 0 0 2.4-2.4c0-2-2.4-4.4-2.4-4.4s-2.4 2.4-2.4 4.4A2.4 2.4 0 0 0 12 21.5z"/>',
  link: '<path d="M10.2 13.8a3.9 3.9 0 0 0 5.6 0l2.9-2.9a3.9 3.9 0 1 0-5.6-5.6l-1.4 1.5"/>'
    + '<path d="M13.8 10.2a3.9 3.9 0 0 0-5.6 0l-2.9 2.9a3.9 3.9 0 1 0 5.6 5.6l1.4-1.5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/>'
    + '<rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.4 2"/>',
  inbox: '<path d="M3.5 13.5h4.7l1.4 2.8h4.8l1.4-2.8h4.7"/>'
    + '<path d="M5.8 5.2h12.4l2.3 8.3v4.3a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-4.3z"/>',
  moon: '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z"/>',
  utensils: '<path d="M6.5 3v6a2 2 0 0 0 4 0V3M8.5 9v12"/>'
    + '<path d="M16.8 3c-1.6 1.5-2.3 3.5-2.3 5.5 0 1.7.8 2.8 2.3 3.1V21"/>',
};

/** Maps the built-in workspace ids to an icon. Custom workspaces fall back to
    the emoji the user picked, so nothing here needs a data migration. */
export const WORKSPACE_ICONS = {
  timetable: 'calendar',
  tasks: 'checkSquare',
  health: 'heart',
  cpdsa: 'code',
  skincare: 'sparkle',
  gym: 'dumbbell',
  meals: 'utensils',
  stats: 'chart',
};

/** Returns an <svg> element for `name`, or null if unknown. */
export function icon(name) {
  const d = PATHS[name];
  if (!d) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = d;
  return svg;
}

/** Icon for a workspace: built-in glyph, else the user's emoji, else a folder. */
export function workspaceIcon(ws) {
  const name = WORKSPACE_ICONS[ws.id];
  if (name) return icon(name);
  if (ws.icon) {
    const span = document.createElement('span');
    span.className = 'icon ws-emoji';
    span.style.cssText = 'display:grid;place-items:center;font-size:0.95em;line-height:1';
    span.textContent = ws.icon;
    return span;
  }
  return icon('folder');
}

/** Convenience: append an icon to `el` (no-op when the name is unknown). */
export function addIcon(el, name) {
  const svg = icon(name);
  if (svg) el.appendChild(svg);
  return el;
}
