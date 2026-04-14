/**
 * arena.js — Arena Page (Phase 3)
 *
 * Planned: achievement system with unlockable badges and animated pop-ups.
 */

export function render(container) {
    container.innerHTML = /* html */`
    <div class="page-stub">
        <span class="stub-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 21h8M12 17v4"/>
                <path d="M17 3H7v6a5 5 0 0 0 10 0V3z"/>
                <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4h-.5"/>
                <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4h.5"/>
            </svg>
        </span>
        <h2 class="stub-title">Arena</h2>
        <p class="stub-body">
            Earn badges for vocal milestones, streaks, and record-breaking range scores.
        </p>
        <ul class="stub-features">
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
                <strong>First Note</strong> — complete your first analysis
            </li>
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                    <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                    <path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                </svg>
                <strong>Deep Diver</strong> — hit a note below D2
            </li>
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <strong>High Flyer</strong> — hit a note above C5
            </li>
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
                </svg>
                <strong>Two Octaves</strong> — reach a range of ≥ 24 semitones
            </li>
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                </svg>
                <strong>Stamina</strong> — 3 sessions in one day
            </li>
            <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M8 21h8M12 17v4"/>
                    <path d="M17 3H7v6a5 5 0 0 0 10 0V3z"/>
                    <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4h-.5"/>
                    <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4h.5"/>
                </svg>
                <strong>Legend</strong> — range score ≥ 30 semitones
            </li>
        </ul>
        <span class="stub-badge">Phase 3 — Planned</span>
    </div>`;

    return null;
}
