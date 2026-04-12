/**
 * studio.js — Studio Page
 *
 * Renders the pitch meter + recording UI into the provided container.
 * Returns a cleanup() function — called by the router when navigating away
 * so the AudioContext and microphone are properly released.
 */

import {
    yin,
    noteFromPitch,
    noteNameFromPitch,
    createMedianFilter,
    getVoiceSuggestion,
    getRangeScore,
} from '../../pitchEngine.js';

import { LevelEngine } from '../engines/levelEngine.js';
import { WaveEngine  } from '../engines/waveEngine.js';


// ── HTML template ─────────────────────────────────────────────

const HTML = /* html */`
<div id="mainCard">
    <div class="studio-layout">

        <!-- ── Compact header ──────────────────────────────── -->
        <header class="studio-header">
            <div class="studio-brand">
                <img src="favicon.svg" alt="VocalRange icon" class="brand-icon">
                <div class="brand-text">
                    <h1 class="app-title">VocalRange</h1>
                    <p class="app-subtitle">Vocal Range Analyzer</p>
                </div>
            </div>
            <div id="recordingIndicator" class="rec-badge hidden">
                <span class="rec-dot"></span>
                <span class="rec-label">REC</span>
                <span id="frequencyDisplay">— Hz</span>
            </div>
        </header>

        <!-- ── Hero: Wave Canvas ─────────────────────────── -->
        <div id="avatarWrap">
            <canvas id="waveCanvas" aria-label="Vocal waveform visualizer"></canvas>
            <!-- Idle overlay: shown when not recording -->
            <div id="idleOverlay" class="canvas-idle-overlay">
                <p id="instructionText" class="canvas-hint">
                    Start recording and sing your notes — hold each for at least 1 second.
                </p>
                <button id="startBtn" class="btn-primary btn-canvas">Start Recording</button>
            </div>
        </div>

        <!-- ── Captured range: compact row ───────────────── -->
        <div class="range-row">
            <div class="range-item">
                <span class="dot-low"></span>
                <span class="range-lbl">Lowest</span>
                <strong id="minNoteDisplay" class="range-note">–</strong>
            </div>
            <div class="range-item range-item--right">
                <strong id="maxNoteDisplay" class="range-note">–</strong>
                <span class="range-lbl">Highest</span>
                <span class="dot-high"></span>
            </div>
        </div>

        <!-- ── Analyze button (only during/after recording) ─ -->
        <button id="stopBtn" class="btn-ghost btn-full hidden" disabled>Analyze Voice</button>

        <!-- ── Error ─────────────────────────────────────── -->
        <div id="errorBox" class="hidden">
            <strong>Error:</strong>
            <span id="errorMessage" style="display:block;margin-top:3px;"></span>
        </div>

        <!-- ── Results ───────────────────────────────────── -->
        <div id="resultBox" class="hidden">
            <p class="result-label">Voice Type</p>
            <h2 id="voiceTypeDisplay"></h2>
            <p id="rangeInfo"></p>
            <span id="badgeDisplay"></span>
            <div class="score-section">
                <div class="score-row">
                    <div>
                        <p class="score-label">Range Score</p>
                        <p class="score-num">
                            <span id="semitoneCount">0</span>
                            <span class="score-unit">semitones</span>
                        </p>
                    </div>
                    <div class="score-right">
                        <p class="score-label">Personal Best</p>
                        <p id="personalBestDisplay">—</p>
                    </div>
                </div>
                <div class="score-pills">
                    <span id="tierPill" class="tier-pill"></span>
                    <span id="recordBadge" class="record-badge hidden">🏆 New Record!</span>
                </div>
            </div>
        </div>

        <!-- ── Hidden pitch bar — JS still references these ─ -->
        <div id="pitchColumn" hidden aria-hidden="true">
            <div class="pitch-bar-wrap">
                <div id="pitchBar">
                    <div id="overlayBottom" class="pitch-overlay"></div>
                    <div id="overlayTop"    class="pitch-overlay"></div>
                    <span class="note-label note-c6">C6</span>
                    <span class="note-label note-c5">C5</span>
                    <span class="note-label note-c4">C4</span>
                    <span class="note-label note-c3">C3</span>
                    <span class="note-label note-c2">C2</span>
                    <div id="pitchDot"></div>
                    <div id="minMarker" class="pitch-marker marker-min hidden"></div>
                    <div id="maxMarker" class="pitch-marker marker-max hidden"></div>
                    <div id="pianoBar"></div>
                    <div id="pianoBarRight"></div>
                </div>
            </div>
        </div>

        <!-- ── Hidden level canvas — LevelEngine still uses it ─ -->
        <div id="levelSection" hidden aria-hidden="true">
            <canvas id="levelCanvas" aria-label="Signal level meter"></canvas>
        </div>

    </div><!-- /studio-layout -->
</div><!-- /mainCard -->
`;

// ── Constants ─────────────────────────────────────────────────
const PITCH_MIN         = 36;    // MIDI C2 (~65 Hz)
const PITCH_MAX         = 84;    // MIDI C6 (~1047 Hz)
const PITCH_RANGE       = PITCH_MAX - PITCH_MIN; // 48 semitones — full SATB range
const STABILITY_TOL     = 1;     // ±semitones for hysteresis
const DOT_MIN_FRAMES    = 4;     // frames before dot starts moving
const DOT_LERP          = 0.08;  // EMA — dot glide speed
const FREQ_LERP         = 0.04;  // EMA — Hz display glide speed
const RMS_THRESHOLD     = 0.015; // amplitude gate
const BEST_KEY          = 'vc_best_st';

/** Adaptive hold time: 30 frames @ A1, 75 frames @ G5 */
function stabilityFrames(midi) {
    return Math.round(30 + 45 * ((midi - PITCH_MIN) / PITCH_RANGE));
}
function ema(current, target, a) {
    return current === null ? target : current + a * (target - current);
}
function noteToPercent(midi) {
    return ((Math.max(PITCH_MIN, Math.min(PITCH_MAX, midi)) - PITCH_MIN) / PITCH_RANGE) * 100;
}

// ── Render ────────────────────────────────────────────────────
export function render(container) {
    container.innerHTML = HTML;

    // ── DOM refs ──────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const startBtn            = $('startBtn');
    const stopBtn             = $('stopBtn');
    const frequencyDisplay    = $('frequencyDisplay');
    const minNoteDisplay      = $('minNoteDisplay');
    const maxNoteDisplay      = $('maxNoteDisplay');
    const errorBox            = $('errorBox');
    const errorMessage        = $('errorMessage');
    const resultBox           = $('resultBox');
    const voiceTypeDisplay    = $('voiceTypeDisplay');
    const rangeInfo           = $('rangeInfo');
    const badgeDisplay        = $('badgeDisplay');
    const semitoneCount       = $('semitoneCount');
    const personalBestDisplay = $('personalBestDisplay');
    const tierPill            = $('tierPill');
    const recordBadge         = $('recordBadge');
    const instructionText     = $('instructionText');
    const recordingIndicator  = $('recordingIndicator');
    const pitchBar            = $('pitchBar');
    const pitchDot            = $('pitchDot');
    const minMarker           = $('minMarker');
    const maxMarker           = $('maxMarker');
    const overlayBottom       = $('overlayBottom');
    const overlayTop          = $('overlayTop');
    const levelSection        = $('levelSection');
    const idleOverlay         = $('idleOverlay');

    // ── Engine instantiation ──────────────────────────────────────
    const levelEngine  = new LevelEngine($('levelCanvas'));
    const waveEngine   = new WaveEngine($('waveCanvas'), {
        pitchMin: PITCH_MIN, pitchMax: PITCH_MAX,
    });

    // ── State ─────────────────────────────────────────────────
    let audioContext, analyser, specAnalyser, microphone, lowShelf, highShelf;
    let micStream       = null;
    let yinBuffer       = null;
    let isRecording     = false;
    let animationFrameId;
    let minPitch        = Infinity;
    let maxPitch        = -Infinity;
    let lastDisplayedHz = -1;
    let stableNote      = null;
    let stableCount     = 0;
    let displayMidi     = null;
    let displayFreq     = null;
    let pitchBarHeight  = 0;

    const medianFilter = createMedianFilter(9);
    let inMemoryBest = (() => {
        try { return parseInt(localStorage.getItem(BEST_KEY) || '0'); } catch { return 0; }
    })();

    // ── Meter helpers ─────────────────────────────────────────
    function moveDot(midiFloat) {
        const px = (noteToPercent(midiFloat) / 100) * pitchBarHeight;
        pitchDot.style.transform = `translateX(-50%) translateY(calc(50% - ${px}px))`;
        pitchDot.classList.add('active');
    }
    function hideDot() { pitchDot.classList.remove('active'); }

    function setMarker(marker, overlay, midiNote, isTop) {
        const pct = noteToPercent(midiNote);
        marker.style.bottom = pct + '%';
        marker.classList.remove('hidden');
        overlay.style.height = (isTop ? 100 - pct : pct) + '%';
    }
    function resetMeter() {
        hideDot();
        pitchDot.style.transform = 'translateX(-50%) translateY(50%)';
        minMarker.classList.add('hidden');
        maxMarker.classList.add('hidden');
        overlayBottom.style.height = '100%';
        overlayTop.style.height    = '100%';
        displayMidi = null;
    }
    function showError(msg) {
        errorMessage.textContent = msg;
        errorBox.classList.remove('hidden');
    }

    // ── Piano keys (rendered once) ────────────────────────────
    (function initPianoKeys() {
        const left  = $('pianoBar');
        const right = $('pianoBarRight');
        const BLACK = new Set([1, 3, 6, 8, 10]);
        const keyH  = 100 / PITCH_RANGE;
        const fragL = document.createDocumentFragment();
        const fragR = document.createDocumentFragment();
        for (let midi = PITCH_MIN; midi <= PITCH_MAX; midi++) {
            const isBlack = BLACK.has(midi % 12);
            const bot = noteToPercent(midi) + '%';
            const h   = `calc(${keyH}% - 0.5px)`;
            [fragL, fragR].forEach(frag => {
                const key = document.createElement('div');
                key.className    = isBlack ? 'pk-black' : 'pk-white';
                key.style.bottom = bot;
                key.style.height = h;
                frag.appendChild(key);
            });
        }
        left.appendChild(fragL);
        right.appendChild(fragR);
    })();

    // ── Recording loop ────────────────────────────────────────
    function updatePitch() {
        if (!isRecording) return;

        analyser.getFloatTimeDomainData(yinBuffer);

        // RMS amplitude gate
        let rmsSum = 0;
        for (let i = 0; i < yinBuffer.length; i++) rmsSum += yinBuffer[i] ** 2;
        const rms = Math.sqrt(rmsSum / yinBuffer.length);

        // Feed level engine every frame (regardless of RMS gate)
        levelEngine.frame(rms);

        pitchDot.classList.toggle('silent', rms < RMS_THRESHOLD);

        if (rms < RMS_THRESHOLD) {
            stableCount = 0;
            waveEngine.frame(NaN, rms, NaN);  // silence gap in trail + idle EQ
            animationFrameId = requestAnimationFrame(updatePitch);
            return;
        }


        const frequency = yin(yinBuffer, audioContext.sampleRate);

        // trailMidi: median-filtered pitch, or NaN if no clean pitch detected
        let trailMidi = NaN;

        if (frequency !== -1 && frequency > 50 && frequency < 2000) {
            const rawPitch = noteFromPitch(frequency);
            const medPitch = medianFilter.push(rawPitch);

            trailMidi = medPitch; // feed median pitch to trail (no extra EMA)

            // Hz display — EMA smoothed
            displayFreq = ema(displayFreq, frequency, FREQ_LERP);
            const rounded = Math.round(displayFreq);
            if (lastDisplayedHz !== rounded) {
                frequencyDisplay.textContent = rounded + ' Hz';
                lastDisplayedHz = rounded;
            }

            // Hysteresis
            if (stableNote === null || Math.abs(medPitch - stableNote) > STABILITY_TOL) {
                stableNote  = medPitch;
                stableCount = 1;
            } else {
                stableCount++;
            }

            // Dot glides after DOT_MIN_FRAMES stable frames
            if (stableCount >= DOT_MIN_FRAMES) {
                displayMidi = ema(displayMidi, stableNote, DOT_LERP);
                moveDot(displayMidi);
            }

            // Register new min / max after adaptive hold time
            const req = stabilityFrames(stableNote);
            if (stableCount >= req && stableNote < minPitch) {
                minPitch = stableNote;
                minNoteDisplay.textContent = noteNameFromPitch(stableNote);
                setMarker(minMarker, overlayBottom, stableNote, false);
                if (maxPitch === -Infinity)
                    instructionText.textContent = 'Lowest note captured! Now sing your highest note and hold it.';
            }
            if (stableCount >= req && stableNote > maxPitch) {
                maxPitch = stableNote;
                maxNoteDisplay.textContent = noteNameFromPitch(stableNote);
                setMarker(maxMarker, overlayTop, stableNote, true);
                if (minPitch !== Infinity)
                    instructionText.textContent = 'Both notes captured! Press "Analyze Voice" whenever you\'re done.';
            }
        } else {
            stableCount = 0;
        }

        waveEngine.frame(displayMidi ?? NaN, rms, trailMidi);     // trail + EQ
        animationFrameId = requestAnimationFrame(updatePitch);
    }

    // ── Voice evaluation ──────────────────────────────────────
    function evaluateVoiceType() {
        if (minPitch === Infinity || maxPitch === -Infinity) {
            showError('No clear pitch detected. Please try again and hold your notes steadily.');
            return;
        }

        // pitchEngine returns English SATB strings directly — no translation needed
        const raw   = getVoiceSuggestion(minPitch, maxPitch);
        const { semitones, tier, color } = getRangeScore(minPitch, maxPitch);

        voiceTypeDisplay.textContent = raw.type;
        rangeInfo.innerHTML =
            `<strong>${raw.description}</strong><br>` +
            `Measured range: ${noteNameFromPitch(minPitch)} – ${noteNameFromPitch(maxPitch)}`;
        badgeDisplay.textContent = raw.badge;

        semitoneCount.textContent = semitones;
        semitoneCount.style.color = color;
        tierPill.textContent      = tier;
        tierPill.style.color      = color;
        tierPill.style.background = color + '22';
        tierPill.style.border     = `1px solid ${color}55`;

        // Personal best
        let prevBest = inMemoryBest;
        try { prevBest = parseInt(localStorage.getItem(BEST_KEY) || '0'); } catch { /* noop */ }
        const isNewRecord = semitones > prevBest;
        if (isNewRecord) {
            inMemoryBest = semitones;
            try { localStorage.setItem(BEST_KEY, String(semitones)); } catch { /* noop */ }
        }
        const best = Math.max(semitones, prevBest);
        personalBestDisplay.textContent = best + ' ST';
        personalBestDisplay.style.color = color;

        if (isNewRecord) {
            recordBadge.classList.remove('hidden');
            recordBadge.style.animation = 'none';
            requestAnimationFrame(() => {
                recordBadge.style.animation = 'record-pulse 0.45s ease-in-out 5';
            });
        } else {
            recordBadge.classList.add('hidden');
        }

        resultBox.classList.remove('hidden');
    }

    // ── Stop recording (also used as cleanup) ─────────────────
    function stopRecording() {
        isRecording = false;
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
        if (microphone) { try { microphone.disconnect(); } catch { /* noop */ } }
        if (audioContext && audioContext.state !== 'closed') audioContext.close();
        cancelAnimationFrame(animationFrameId);
        waveEngine.clearAnalyser(); // back to idle breathing
    }

    // ── Button handlers ───────────────────────────────────────
    startBtn.addEventListener('click', async () => {
        errorBox.classList.add('hidden');
        resultBox.classList.add('hidden');
        minPitch = Infinity;
        maxPitch = -Infinity;
        minNoteDisplay.textContent   = '–';
        maxNoteDisplay.textContent   = '–';
        frequencyDisplay.textContent = '— Hz';
        instructionText.textContent  = 'Sing your lowest note and hold it for at least 1 second.';
        resetMeter();

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            lowShelf = audioContext.createBiquadFilter();
            lowShelf.type = 'highpass';
            lowShelf.frequency.value = 40;

            highShelf = audioContext.createBiquadFilter();
            highShelf.type = 'lowpass';
            highShelf.frequency.value = 2000; // covers full soprano range (C6 = 1047 Hz)

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;
            yinBuffer = new Float32Array(analyser.fftSize);

            micStream  = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = audioContext.createMediaStreamSource(micStream);
            microphone.connect(lowShelf);
            lowShelf.connect(highShelf);
            highShelf.connect(analyser);

            // Separate full-range analyser for spectrum visualizer
            // (bypasses the lowpass filter so high bands are visible)
            specAnalyser = audioContext.createAnalyser();
            specAnalyser.fftSize        = 2048;
            specAnalyser.smoothingTimeConstant = 0.75;
            microphone.connect(specAnalyser);
            waveEngine.setAnalyser(specAnalyser);

            pitchBarHeight = pitchBar.offsetHeight;
            isRecording    = true;
            medianFilter.reset();
            stableNote      = null;
            stableCount     = 0;
            displayFreq     = null;
            lastDisplayedHz = -1;

            // Initialise engines
            levelEngine.reset();

            idleOverlay.classList.add('hidden');   // hide canvas overlay
            stopBtn.classList.remove('hidden');
            stopBtn.disabled = false;
            recordingIndicator.classList.remove('hidden');

            updatePitch();

        } catch (err) {
            console.error('[studio] Recording setup failed:', err);
            const isPermission = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
            const isNoDevice   = err?.name === 'NotFoundError'   || err?.name === 'DevicesNotFoundError';
            if (isPermission) {
                showError('Microphone access denied. Please allow microphone access in your browser settings (click the 🔒 icon in the address bar).');
            } else if (isNoDevice) {
                showError('No microphone found. Please connect a microphone and try again.');
            } else {
                showError(`Setup error: ${err?.message ?? err}`);
            }
        }
    });

    stopBtn.addEventListener('click', () => {
        stopRecording();
        hideDot();
        pitchDot.classList.remove('silent');
        idleOverlay.classList.remove('hidden');  // show canvas overlay again
        startBtn.textContent = 'Record Again';
        stopBtn.classList.add('hidden');
        recordingIndicator.classList.add('hidden');
        instructionText.textContent = 'Start recording and sing your notes — hold each for at least 1 second.';
        evaluateVoiceType();
    });

    // ── Return combined cleanup for the router ─────────────────
    // stopRecording handles mic/audio teardown;
    // waveEngine.stop() cancels its always-running internal RAF
    return () => { stopRecording(); waveEngine.stop(); };
}
