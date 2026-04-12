# VoiceCrack – Gamification 

## ✅ Phase 1 – Range Score (implementiert)

- **Halbtöne-Score** nach jeder Messung
- **Tier-System** (Aufwärmen → Legende)
- **Persönlicher Rekord** via localStorage mit Puls-Animation bei neuem Bestrekord

---

## ✅ Phase 2 – DPSJApp-Integration (implementiert)

- **postMessage-Integration:** Ergebnis wird nach Auswertung an DPSJApp-Parent gesendet
- **Speichern-Dialog:** Erscheint nur wenn `?member=<id>` gesetzt UND App im iframe läuft
- **Origin-Sicherheit:** postMessage nur an `https://www.dpsj.ch` (localhost: `'*'`)
- **Getestetes Payload-Format:** `{ type, memberId, voiceType, badge, minNote, maxNote, semitones }`
- DPSJApp-seitig: Route `/api/voicecrack/save` + Seite `/voicecrack` bereits implementiert (v0.8)

---

## 🔲 Phase 3 – Fortschritts-History

**Ziel:** Messungen über Zeit vergleichbar machen.

- Letzte 5 Messungen in `localStorage` speichern
- Mini-Sparkline-Graph in der Result-Card (SVG, keine Lib nötig)
- Delta-Anzeige: „+2 ST gegenüber letzter Woche"

**Aufwand:** ~1–2h  
**Abhängigkeit:** keine

---

## 🔲 Phase 4 – Achievement-System

**Ziel:** Langzeit-Motivation durch freischaltbare Badges.

| Badge | Bedingung |
|-------|-----------|
| 🎵 **Erster Ton** | Erste erfolgreiche Messung |
| 🌊 **Tieftaucher** | Ton unter D2 registriert |
| 🚀 **Höhenflug** | Ton über C5 registriert |
| 📏 **Zwei Oktaven** | Range-Score ≥ 24 ST |
| 🔥 **Ausdauer** | 3 Messungen in einer Sitzung |
| 🏆 **Legende** | Range-Score ≥ 30 ST |

Achievements in `localStorage` gespeichert, animiertes Pop-up bei Freischaltung.

**Aufwand:** ~3–4h  
**Abhängigkeit:** Phase 1 (Score-System)

---

## 🔲 Phase 5 – Zielton-Challenge

**Ziel:** Trainingsmodul für gezielte Stimmbildung.

- App gibt einen Zielton vor (z. B. „Singe F2")
- Totenkopf-Dot muss ±1 Halbton treffen und 1 Sek. halten
- Grünes Glow-Feedback + Ton-Ding bei Erfolg
- Schwierigkeitsstufen: Tief / Mittel / Hoch

**Aufwand:** ~4–6h  
**Abhängigkeit:** keine

---

## Tier-System (Phase 1)

| Score (Halbtöne) | Tier | Farbe |
|-----------------|------|-------|
| < 6 ST | Aufwärmen | Grau |
| 6–9 ST | Solide | Blau |
| 10–13 ST | Gut | Grün |
| 14–17 ST | Stark | Violett |
| 18–23 ST | Profi | Gold |
| ≥ 24 ST | Legende | Pink |
