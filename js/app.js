/**
 * app.js — VocalRange Router & Shell
 *
 * Hash-based routing: #studio | #vitals | #arena | #profile
 * Each page module exports render(container) → optional cleanup fn.
 */

import { render as renderStudio  } from './pages/studio.js';
import { render as renderVitals  } from './pages/vitals.js';
import { render as renderArena   } from './pages/arena.js';
import { render as renderProfile } from './pages/profile.js';

// ── Route table ───────────────────────────────────────────────
const ROUTES = {
    studio:  renderStudio,
    vitals:  renderVitals,
    arena:   renderArena,
    profile: renderProfile,
};

// ── Active page cleanup (e.g. stop AudioContext) ──────────────
let currentCleanup = null;

// ── Router ────────────────────────────────────────────────────
async function navigate() {
    // Run cleanup from previous page
    if (typeof currentCleanup === 'function') {
        currentCleanup();
        currentCleanup = null;
    }

    const hash = (location.hash.slice(1) || 'studio').toLowerCase();
    const render = ROUTES[hash] ?? ROUTES.studio;
    const app = document.getElementById('app');

    // Clear previous content
    app.innerHTML = '';

    // Render new page — render() may return a cleanup function
    currentCleanup = render(app) ?? null;

    // Sync nav tab active state
    updateNav(hash);
}

function updateNav(activeKey) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.nav === activeKey);
    });
}

// ── Nav click handler ─────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        location.hash = tab.dataset.nav;
    });
});

// ── Listen for hash changes ───────────────────────────────────
window.addEventListener('hashchange', navigate);

// ── Initial load ──────────────────────────────────────────────
navigate();

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('[VocalRange] Service Worker registered.'))
            .catch(err => console.warn('[VocalRange] Service Worker failed:', err));
    });
}
