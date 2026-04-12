# VoiceCrack – Fortschritt

## Session 2026-04-12 – UX & Integration

### UX-Verbesserungen
- **Dynamischer Instruktionstext:** Ändert sich mit App-Zustand (vor Start → tiefster Ton → höchster Ton → auswerten)
- **REC-Indikator:** Pulsierender roter Dot + "REC" + Live-Hz — nur während Aufnahme sichtbar
- **Button-Label:** "Auswerten" → "Stoppen & Auswerten" (klarer was der Button tut)
- **Result-Box:** Wird beim Neu-Starten ausgeblendet (kein Zustand-Durcheinander)
- **Hz-Anzeige** in den REC-Indikator integriert (nicht mehr dauerhaft sichtbar)
- **Logo** von der rechten Spalte über die Pitchbar (linke Spalte) verschoben — löst Mobile-Header-Problem
- **"Hoch"/"Tief"** Labels an der Pitchbar entfernt
- **Speichern-Button:** Label gekürzt auf "Speichern", horizontales Padding ergänzt

### Rauschunterdrückung
- **RMS-Schwellwert** `RMS_THRESHOLD = 0.015` eingeführt: Frames unter dieser Amplitude werden ignoriert
- Verhindert, dass Raumrauschen als tiefster Ton registriert wird
- **Skull-Dot Farb-Feedback:** Grau wenn unter Schwelle, normal wenn über Schwelle

### DPSJApp-Integration (Phase 2) ✅
- **postMessage** getestet und bestätigt funktionierend
- Origin auf `https://www.dpsj.ch` eingeschränkt (localhost: `'*'` für lokales Testing)
- Inline-Styles in CSS-Regeln migriert (`#saveConfirm`, `#saveStatus`)
- `favicon.svg` als `<link rel="icon">` eingebunden (404 für `.ico` bleibt Browser-Fallback, kosmetisch)

### Test-Infrastruktur
- `test-embed.html` erstellt: simuliert DPSJApp iframe mit `?member=42`
- Filtert postMessage auf `type === 'vc-result'` (Service-Worker-Nachrichten ignoriert)
- Bestätigtes postMessage-Payload-Format:
  ```json
  {
    "type": "vc-result",
    "memberId": "42",
    "voiceType": "Bariton",
    "badge": "Fundament",
    "minNote": "F3",
    "maxNote": "B3",
    "semitones": 6
  }
  ```

---

## Offene Punkte / Nächste Schritte

- [ ] Netlify-Deployment aktualisieren (Push auf master)
- [ ] RMS-Schwellwert auf echten Geräten validieren (ggf. 0.01–0.02 anpassen)
- [ ] Roadmap Phase 3 (Achievement-System) beginnen
- [ ] Roadmap Phase 4 (Zielton-Challenge) evaluieren
