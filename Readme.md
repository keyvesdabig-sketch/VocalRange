# 🎙️ VoiceCrack – Project Briefing

> **Status:** Aktiv in Entwicklung · GitHub: [keyvesdabig-sketch/VoiceCrack](https://github.com/keyvesdabig-sketch/VoiceCrack)  
> **Live:** [voicecrack3000.netlify.app](https://voicecrack3000.netlify.app)  
> **Integration:** Eingebettet in DPSJApp (`www.dpsj.ch`) via iframe + postMessage ✅

---

## 1. Projekt-Identität & Zweck

VoiceCrack ist eine spezialisierte Progressive Web App (PWA), die darauf ausgelegt ist, Sängern in Männerchören innerhalb weniger Sekunden eine fundierte Empfehlung für ihre Stimmlage (Bass, Bariton, Tenor oder Countertenor) zu geben.

- **Zielgruppe:** Mitglieder der „Din Pä singt jetzt" (DPSJ).
- **Kernkonzept:** „Sing erst deinen tiefsten, dann deinen höchsten Ton." Die App analysiert die Grenztöne und schlägt eine Kategorie vor.

---

## 2. Technische Kern-Logik („Das Gehirn")

Die App nutzt fortgeschrittene Signalverarbeitung, um menschliche Gesangsstimmen trotz Obertönen und Rauschen stabil zu erfassen.

- **RMS-Amplituden-Gate:** Frames unter Schwellwert (0.015) werden ignoriert — verhindert dass Raumrauschen als Ton registriert wird.
- **YIN-Algorithmus:** Ersetzt einfache Autokorrelation, um Oktavfehler drastisch zu reduzieren.
- **Signal-Filterung:** Highpass (40 Hz) entfernt Brummen, Lowpass (1200 Hz) dämpft Obertöne.
- **Stabilitäts-Mechanismen:**
  - **Median-Filter:** 9-Frame-Puffer eliminiert Ausreißer.
  - **EMA (Moving Average):** Pitch-Dot gleitet flüssig, springt nicht.
  - **Adaptive Hysterese:** Ton muss 30–75 Frames stabil sein (0.5 s tief → 1.25 s hoch).

---

## 3. Design-System: „Voice of the Deep"

- **Layout:** Zweispaltig — linke Spalte: Chor-Logo + vertikale Pitchbar. Rechte Spalte: Controls + Ergebnis.
- **Farbpalette:** Kupfer-Gradients (`--copper-a`), Tiefblau/Schwarz (`--deep`), Glassmorphismus.
- **Typografie:** „Epilogue" für Headlines, „Manrope" für Body-Text.
- **Pitch Bar:** A1–G5 (MIDI 33–79), Copper-Fire-Gradient, mit beidseitigem Klaviatur-Overlay.
- **Geführter Flow:** Dynamischer Instruktionstext + REC-Indikator führen Nutzer durch die Messung.

---

## 4. Auswertungs-Philosophie

Anstatt einer „harten Diagnose" setzt VoiceCrack auf musikalische **Empfehlungen**.

- **Badges:** Titel wie „Tiefen-Spezialist", „Höhen-Artist" oder „Allrounder".
- **Priorisierung:** Bass (≤ MIDI 41) und Tenor-Umfang (MIDI 50–71) bevorzugt erkannt.
- **Range Score:** Halbtöne zwischen Min/Max → Tier-System (Aufwärmen → Legende). Persönlicher Rekord in `localStorage`.

---

## 5. Integration in die DPSJ-App

**Status: Implementiert und produktiv (v0.8).**

- VoiceCrack läuft als `<iframe>` auf `/voicecrack` der DPSJApp
- Nach Auswertung: Speichern-Dialog → `postMessage` → DPSJApp speichert in Google Sheets
- Origin-gesichert: Nachrichten nur an `https://www.dpsj.ch`
- Details → [`Anbindung.md`](Anbindung.md)

---

## 6. Offline-Funktionalität (PWA)

- **Service Worker:** Cache-First für `index.html`, `manifest.json` und Assets.
- **Installation:** Über Web-Manifest auf Homescreen installierbar.
- **Hinweis:** Bei Code-Änderungen Hard Reload nötig (`Ctrl+Shift+R`).

---

## 7. Roadmap

| Phase | Thema | Status |
|-------|-------|--------|
| 1 | Range Score + Tier-System | ✅ Fertig |
| 2 | DPSJApp-Integration (postMessage) | ✅ Fertig |
| 3 | Fortschritts-History (Sparkline) | 🔲 Offen |
| 4 | Achievement-System | 🔲 Offen |
| 5 | Zielton-Challenge | 🔲 Offen |

Details → [`Roadmap.md`](Roadmap.md)
