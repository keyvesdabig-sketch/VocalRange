/**
 * profile.js — Profile Page (Phase 4)
 *
 * Shows current stats from localStorage. Planned: full profile management.
 */

const BEST_KEY = 'vc_best_st';

export function render(container) {
    let best = 0;
    try { best = parseInt(localStorage.getItem(BEST_KEY) || '0'); } catch { /* noop */ }

    const tierLabel = best === 0 ? '—'
        : best < 6  ? 'Warm Up'
        : best < 10 ? 'Solid'
        : best < 14 ? 'Good'
        : best < 18 ? 'Strong'
        : best < 24 ? 'Pro'
        : 'Legend';

    container.innerHTML = /* html */`
    <div class="page-stub">
        <span class="stub-icon">🎙️</span>
        <h2 class="stub-title">Profile</h2>
        <p class="stub-body">Your vocal identity — stored locally, always private.</p>
        <ul class="stub-features">
            <li>🏅 Personal Best: <strong style="color:var(--primary)">${best > 0 ? best + ' ST' : 'Not yet measured'}</strong></li>
            <li>📊 Current Tier: <strong style="color:var(--primary)">${tierLabel}</strong></li>
        </ul>
        <span class="stub-badge">Phase 4 — Planned</span>
    </div>`;

    return null;
}
