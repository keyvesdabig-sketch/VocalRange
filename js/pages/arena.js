/**
 * arena.js — Arena Page (Phase 3)
 *
 * Planned: achievement system with unlockable badges and animated pop-ups.
 */

export function render(container) {
    container.innerHTML = /* html */`
    <div class="page-stub">
        <span class="stub-icon">🏆</span>
        <h2 class="stub-title">Arena</h2>
        <p class="stub-body">
            Earn badges for vocal milestones, streaks, and record-breaking range scores.
        </p>
        <ul class="stub-features">
            <li>🎵 <strong>First Note</strong> — complete your first analysis</li>
            <li>🌊 <strong>Deep Diver</strong> — hit a note below D2</li>
            <li>🚀 <strong>High Flyer</strong> — hit a note above C5</li>
            <li>📏 <strong>Two Octaves</strong> — reach a range of ≥ 24 semitones</li>
            <li>🔥 <strong>Stamina</strong> — 3 sessions in one day</li>
            <li>🏆 <strong>Legend</strong> — range score ≥ 30 semitones</li>
        </ul>
        <span class="stub-badge">Phase 3 — Planned</span>
    </div>`;

    return null;
}
