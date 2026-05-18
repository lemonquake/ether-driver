// Unique SVG icon for each special weapon, rendered inline in the weapon HUD cards.
// Each returns an SVG string sized 32×32 with viewBox 0 0 32 32.

const icons = {
  'boom-missile': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff6545"/><stop offset="100%" stop-color="#ffb15a"/></linearGradient></defs>
    <path d="M6 16l18-6v12L6 16z" fill="url(#bm)" stroke="#ff6545" stroke-width="1"/>
    <rect x="22" y="9" width="4" height="3" rx="1" fill="#ffb15a"/>
    <rect x="22" y="20" width="4" height="3" rx="1" fill="#ffb15a"/>
    <circle cx="8" cy="16" r="2" fill="#ff6545" opacity="0.7"/>
    <path d="M3 14l3 2-3 2" stroke="#ffb15a" stroke-width="1.5" fill="none" opacity="0.6"/>
  </svg>`,

  'bouncy-wouncy': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="bw"><stop offset="0%" stop-color="#fff2c4"/><stop offset="100%" stop-color="#ffcc66"/></radialGradient></defs>
    <circle cx="16" cy="18" r="8" fill="url(#bw)" stroke="#ffcc66" stroke-width="1.2"/>
    <path d="M8 26q4-6 8 0" stroke="#ffcc66" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>
    <path d="M16 26q4-6 8 0" stroke="#ffcc66" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>
    <path d="M12 10l-2-4M16 9v-5M20 10l2-4" stroke="#fff2c4" stroke-width="1" opacity="0.7"/>
    <circle cx="13" cy="16" r="1.5" fill="#fff" opacity="0.5"/>
  </svg>`,

  'shock-lance': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="sl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7df9ff"/><stop offset="100%" stop-color="#9afcff"/></linearGradient></defs>
    <path d="M18 4l-6 12h8l-6 12" stroke="url(#sl)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M18 4l-6 12h8l-6 12" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>
    <circle cx="14" cy="28" r="2" fill="#7df9ff" opacity="0.4"/>
    <line x1="6" y1="14" x2="10" y2="14" stroke="#9afcff" stroke-width="1" opacity="0.5"/>
    <line x1="22" y1="18" x2="26" y2="18" stroke="#9afcff" stroke-width="1" opacity="0.5"/>
  </svg>`,

  'fire-mine': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="fm"><stop offset="0%" stop-color="#ff6545"/><stop offset="100%" stop-color="#ff2f1f"/></radialGradient></defs>
    <circle cx="16" cy="16" r="9" fill="url(#fm)" stroke="#ff2f1f" stroke-width="1.2"/>
    <circle cx="16" cy="16" r="5" fill="none" stroke="#ff6545" stroke-width="1" stroke-dasharray="3 2"/>
    <circle cx="16" cy="16" r="3" fill="#fff" opacity="0.3"/>
    <path d="M16 4v3M16 25v3M4 16h3M25 16h3" stroke="#ff6545" stroke-width="1.5" opacity="0.6"/>
    <path d="M9 9l2 2M21 21l2 2M21 9l2 2M9 21l2 2" stroke="#ff6545" stroke-width="1" opacity="0.4"/>
  </svg>`,

  'swarm-missiles': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="sm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff88aa"/><stop offset="100%" stop-color="#ffccdd"/></linearGradient></defs>
    <path d="M6 10l12-4v8L6 10z" fill="url(#sm)" opacity="0.85"/>
    <path d="M6 16l12-4v8L6 16z" fill="url(#sm)"/>
    <path d="M6 22l12-4v8L6 22z" fill="url(#sm)" opacity="0.85"/>
    <rect x="17" y="5" width="3" height="2" rx="0.5" fill="#ffccdd" opacity="0.7"/>
    <rect x="17" y="11" width="3" height="2" rx="0.5" fill="#ffccdd"/>
    <rect x="17" y="17" width="3" height="2" rx="0.5" fill="#ffccdd" opacity="0.7"/>
    <path d="M3 9l2 1-2 1M3 15l2 1-2 1M3 21l2 1-2 1" stroke="#ff88aa" stroke-width="1" fill="none" opacity="0.5"/>
  </svg>`,

  'gravity-imploder': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="gi"><stop offset="0%" stop-color="#da70d6"/><stop offset="60%" stop-color="#9400d3"/><stop offset="100%" stop-color="#4b0082"/></radialGradient></defs>
    <circle cx="16" cy="16" r="10" fill="url(#gi)" opacity="0.85"/>
    <circle cx="16" cy="16" r="4" fill="#1a0033"/>
    <path d="M16 2a14 14 0 0 1 0 28" stroke="#da70d6" stroke-width="1.2" fill="none" stroke-dasharray="4 3" opacity="0.6"/>
    <path d="M16 30a14 14 0 0 1 0-28" stroke="#9400d3" stroke-width="1.2" fill="none" stroke-dasharray="4 3" opacity="0.6"/>
    <path d="M24 8l-4 4M8 24l4-4M24 24l-4-4M8 8l4 4" stroke="#da70d6" stroke-width="1" opacity="0.5"/>
  </svg>`,

  'rail-slug': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="rs" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#e0e0e0"/><stop offset="100%" stop-color="#ffffff"/></linearGradient></defs>
    <rect x="4" y="14" width="22" height="4" rx="2" fill="url(#rs)"/>
    <rect x="8" y="12" width="2" height="8" rx="0.5" fill="#e0e0e0" opacity="0.6"/>
    <rect x="14" y="12" width="2" height="8" rx="0.5" fill="#e0e0e0" opacity="0.6"/>
    <rect x="20" y="12" width="2" height="8" rx="0.5" fill="#e0e0e0" opacity="0.6"/>
    <path d="M26 16l4 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <path d="M2 14l3 2-3 2" stroke="#e0e0e0" stroke-width="1" fill="none" opacity="0.5"/>
    <circle cx="27" cy="16" r="1.5" fill="#fff" opacity="0.4"/>
  </svg>`,

  'toxic-cask': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="tc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#aaffaa"/><stop offset="100%" stop-color="#55ff55"/></linearGradient></defs>
    <rect x="10" y="8" width="12" height="18" rx="3" fill="url(#tc)" stroke="#55ff55" stroke-width="1"/>
    <rect x="12" y="5" width="8" height="4" rx="1.5" fill="#aaffaa"/>
    <path d="M16 14l2 3h-4l2-3z" fill="#1a3300"/>
    <circle cx="16" cy="19" r="1" fill="#1a3300"/>
    <path d="M13 26q1 3 3 3t3-3" stroke="#55ff55" stroke-width="1.2" fill="none" opacity="0.6"/>
    <circle cx="14" cy="29" r="1" fill="#55ff55" opacity="0.4"/>
    <circle cx="18" cy="30" r="0.8" fill="#55ff55" opacity="0.3"/>
  </svg>`,

  'devastator-nuke': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="dn"><stop offset="0%" stop-color="#ff6600"/><stop offset="50%" stop-color="#ff2200"/><stop offset="100%" stop-color="#880000"/></radialGradient></defs>
    <circle cx="16" cy="12" r="8" fill="url(#dn)" opacity="0.9"/>
    <ellipse cx="16" cy="12" rx="5" ry="4" fill="#ff6600" opacity="0.5"/>
    <rect x="14" y="18" width="4" height="8" rx="1" fill="#ff2200" opacity="0.8"/>
    <ellipse cx="16" cy="26" rx="7" ry="2.5" fill="#ff2200" opacity="0.35"/>
    <circle cx="16" cy="10" r="2" fill="#fff" opacity="0.3"/>
    <path d="M8 6l2 3M24 6l-2 3M6 14h3M23 14h3" stroke="#ff6600" stroke-width="1" opacity="0.5"/>
  </svg>`,

  'phantom-seeker': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="ps" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#cc88ff"/><stop offset="100%" stop-color="#aa44ff"/></linearGradient></defs>
    <path d="M16 4l-4 8v8l4 8 4-8v-8z" fill="url(#ps)" opacity="0.85" stroke="#cc88ff" stroke-width="1"/>
    <circle cx="16" cy="12" r="2" fill="#fff" opacity="0.6"/>
    <path d="M10 16l-4 4 4 4M22 16l4 4-4 4" stroke="#cc88ff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
  </svg>`,

  'plasma-wraith': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="pw"><stop offset="0%" stop-color="#88ffee"/><stop offset="100%" stop-color="#00ffcc"/></radialGradient></defs>
    <path d="M16 6a6 6 0 0 1 6 6v8l-6 6-6-6v-8a6 6 0 0 1 6-6" fill="url(#pw)" opacity="0.8"/>
    <circle cx="12" cy="14" r="1.5" fill="#1a3333"/>
    <circle cx="20" cy="14" r="1.5" fill="#1a3333"/>
    <path d="M16 26q-4 4-8 0" stroke="#00ffcc" stroke-width="1.5" fill="none" opacity="0.6"/>
    <path d="M16 26q4 4 8 0" stroke="#00ffcc" stroke-width="1.5" fill="none" opacity="0.6"/>
  </svg>`,

  'magma-drone': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="md"><stop offset="0%" stop-color="#ff8833"/><stop offset="100%" stop-color="#ff4400"/></radialGradient></defs>
    <path d="M16 8l8 6v8l-8 6-8-6v-8z" fill="url(#md)" stroke="#ff4400" stroke-width="1.2"/>
    <circle cx="16" cy="16" r="3" fill="#ffccaa"/>
    <path d="M16 8v-4M24 14l4-2M24 22l4 2M16 24v4M8 22l-4 2M8 14l-4-2" stroke="#ff8833" stroke-width="1.5" opacity="0.7"/>
  </svg>`,

  'volt-hunter': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><linearGradient id="vh" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eeff88"/><stop offset="100%" stop-color="#ccff00"/></linearGradient></defs>
    <path d="M18 2L8 16h6l-2 14 12-16h-6l2-12z" fill="url(#vh)" stroke="#ccff00" stroke-width="1"/>
    <circle cx="16" cy="16" r="8" fill="none" stroke="#eeff88" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
  </svg>`,

  'void-stalker': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs><radialGradient id="vs"><stop offset="0%" stop-color="#6633aa"/><stop offset="80%" stop-color="#330066"/><stop offset="100%" stop-color="#110022"/></radialGradient></defs>
    <circle cx="16" cy="16" r="12" fill="url(#vs)"/>
    <circle cx="16" cy="16" r="6" fill="#110022"/>
    <path d="M16 10v12M10 16h12" stroke="#6633aa" stroke-width="2" opacity="0.8"/>
    <circle cx="16" cy="16" r="2" fill="#cc88ff"/>
    <path d="M16 2a14 14 0 0 0 0 28M16 30a14 14 0 0 0 0-28" stroke="#6633aa" stroke-width="1.5" fill="none" opacity="0.5" stroke-dasharray="3 4"/>
  </svg>`,
};

export function getWeaponIcon(weaponId) {
  return icons[weaponId] || '';
}

export function getWeaponIconDataUrl(weaponId) {
  const svg = icons[weaponId];
  if (!svg) return '';
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
