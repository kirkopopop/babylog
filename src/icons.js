// Stroke icons, 24px grid, currentColor.
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  sleep: s('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  bottle: s('<path d="M10 2h4M10.5 2v3.2L8.6 7.6A3 3 0 0 0 8 9.4V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9.4a3 3 0 0 0-.6-1.8L13.5 5.2V2"/><path d="M8 12h3M8 16h3"/>'),
  solids: s('<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>'),
  nappy: s('<path d="M12 3c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0C6 10.4 8.5 7.2 12 3Z"/>'),
  vitd: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  med: s('<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>'),
  growth: s('<path d="M4 20 20 4M7 17l1.5 1.5M10 14l1.5 1.5M13 11l1.5 1.5M16 8l1.5 1.5"/><path d="m3 15 6 6M15 3l6 6"/>'),
  milestone: s('<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9Z"/>'),
  nursing: s('<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M12 14v6M8 20h8"/>'),
  pump: s('<path d="M9 3h6v4H9zM10 7v3l-2 2v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8l-2-2V7"/>'),
  bath: s('<path d="M4 12h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Z"/><path d="M6 12V6a2 2 0 0 1 4 0"/>'),
  walk: s('<circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M3 8h12l-2 7H6ZM15 8l2-4h3"/>'),
  note: s('<path d="M5 4h14v12l-4 4H5Z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>'),
  today: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  history: s('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  trends: s('<path d="M3 20h18"/><path d="m4 15 5-5 4 3 7-7"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  stop: s('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  play: s('<path d="M7 5v14l11-7Z"/>'),
  left: s('<path d="m15 6-6 6 6 6"/>'),
  right: s('<path d="m9 6 6 6-6 6"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
};
// colour token per kind (used as --k)
export const KCOLOR = { sleep: 'var(--night)', nap: 'var(--nap)', bottle: 'var(--bottle)', solids: 'var(--solid)', nappy: 'var(--nappy)', vitd: 'var(--nappy)', med: 'var(--med)', growth: 'var(--growth)', milestone: 'var(--mile)', nursing: 'var(--nurse)', pump: 'var(--nurse)', bath: 'var(--bath)', walk: 'var(--walk)', note: 'var(--ink-3)' };
