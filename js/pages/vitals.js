/**
 * vitals.js — Vitals Page (Phase 2)
 *
 * Planned: progress history over time, sparkline chart, delta vs. last session.
 */

export function render(container) {
    container.innerHTML = /* html */`
    <div class="page-stub">
        <span class="stub-icon">📈</span>
        <h2 class="stub-title">Vitals</h2>
        <p class="stub-body">
            Track your vocal range across sessions and watch your voice grow over time.
        </p>
        <ul class="stub-features">
            <li>📊 Last 5 sessions — mini sparkline graph</li>
            <li>📅 Date + range history timeline</li>
            <li>⬆️ Delta vs. previous session</li>
            <li>🏅 Personal records per voice type</li>
        </ul>
        <span class="stub-badge">Phase 2 — Planned</span>
    </div>`;

    return null; // no cleanup needed
}
