# VoiceCrack – Pitch Engine Parameter

Alle Stellschrauben der Audio-Analyse, geordnet nach Pipeline-Stufe.  
Änderungen an diesen Werten beeinflussen direkt Empfindlichkeit, Stabilität und Reaktionszeit.

---

## 1. Web Audio API (index.html)

| Parameter | Wert | Effekt wenn erhöht | Effekt wenn gesenkt |
|-----------|------|-------------------|-------------------|
| `fftSize` | `4096` | Bessere Tiefton-Auflösung (mehr Samples pro Frame) | Schlechtere Bass-Erkennung, schnellere Frames |
| YIN-Puffergrösse `W` | `2048` (= fftSize / 2) | — | — |
| **Highpass-Filter** | `40 Hz` | Mehr Bass-Rauschen durchgelassen | Tiefe Töne (A1 = 55 Hz) werden abgeschnitten |
| **Lowpass-Filter** | `1200 Hz` | Mehr Oberton-Störungen | Höhere Töne werden gedämpft |

> **Abhängigkeit:** `fftSize` bestimmt die Auflösung des YIN-Algorithmus. Bei `4096` hat YIN 2048 Samples → kann Fundamentalfrequenzen bis ~21 Hz auflösen (weit unter A1).

---

## 2. Amplituden-Gate (index.html)

| Parameter | Wert | Effekt wenn erhöht | Effekt wenn gesenkt |
|-----------|------|-------------------|-------------------|
| `RMS_THRESHOLD` | `0.015` | Weniger Raumrauschen, aber leise Stimmen könnten blockiert werden | Mehr Empfindlichkeit, aber Raumrauschen kann Töne auslösen |

**Typische RMS-Werte zur Orientierung:**

| Quelle | Typischer RMS |
|--------|--------------|
| Stilles Mikrofon (Eigenrauschen) | 0.001–0.004 |
| Raumrauschen / HVAC | 0.003–0.008 |
| Flüstern | 0.008–0.015 |
| Leises Singen | 0.02–0.05 |
| Normales Singen | 0.05–0.15 |
| Lautes Singen | 0.15–0.4 |

> **Faustregeln:** Zu viele Fehlauslösungen → erhöhen (0.02). Leise Stimmen werden nicht erkannt → senken (0.01).

---

## 3. YIN-Algorithmus (pitchEngine.js)

| Parameter | Wert | Effekt wenn erhöht | Effekt wenn gesenkt |
|-----------|------|-------------------|-------------------|
| `THRESHOLD` | `0.12` | Mehr Pitches werden erkannt (auch unsichere) → mehr Fehler | Strenger, seltener ein Ergebnis → Bass-Töne können verschwinden |
| `TAU_MIN` | `~22` @ 44.1 kHz | Höhere Minimalfrequenz | Tiefere Frequenzen erkennbar |
| `TAU_MAX` | `~882` @ 44.1 kHz | Tiefere Minimalfrequenz (~50 Hz) | Schlechtere Bass-Erkennung |

**Frequenzgrenzen aus TAU:**

| TAU | Frequenz | Note |
|-----|----------|------|
| TAU_MIN ≈ 22 | ~2000 Hz | C7 |
| TAU_MAX ≈ 882 | ~50 Hz | G1 |

> **Hinweis zu `THRESHOLD = 0.12`:** Der Wert ist ein Kompromiss.  
> `0.10` → tiefe Töne (A1–E2) werden oft verpasst.  
> `0.15` → Oktav-Fehler nehmen zu (falsche Minima bei τ/2 werden akzeptiert).  
> `0.12` deckt tiefe CMNDF-Minima ab ohne das Oktavfehler-Fenster zu öffnen.

---

## 4. Median-Filter (pitchEngine.js)

| Parameter | Wert | Effekt wenn erhöht | Effekt wenn gesenkt |
|-----------|------|-------------------|-------------------|
| `size` (Fenstergrösse) | `9 Frames` | Stärkere Glättung, träger bei Tonwechsel | Schnellere Reaktion, mehr Ausreißer |

> Bei ~60 fps entspricht `size=9` einem Fenster von ~150 ms.

---

## 5. Stabilitäts-Hysterese (index.html)

| Parameter | Wert | Effekt wenn erhöht | Effekt wenn gesenkt |
|-----------|------|-------------------|-------------------|
| `STABILITY_TOLERANCE` | `±1 Halbton` | Weniger empfindlich auf Vibrato | Vibrato bricht Stabilität → `stableCount` wird öfter zurückgesetzt |
| `DOT_MIN_FRAMES` | `4 Frames (~66ms)` | Dot reagiert träger, stabiler | Dot springt bei kurzen Störsignalen |

---

## 6. Adaptive Haltezeit (index.html)

Bevor ein Ton als neuer Min/Max-Wert akzeptiert wird, muss er stabil gehalten werden.  
Die Haltezeit hängt von der Tonhöhe ab:

```
frames = 30 + 45 × t
t = (midi − PITCH_MIN) / PITCH_RANGE   (0 = A1, 1 = G5)
```

| Ton | MIDI | t | Frames | Zeit @ 60fps |
|-----|------|---|--------|-------------|
| A1 (tief) | 33 | 0.0 | 30 | 0.50 s |
| C3 | 48 | 0.33 | 45 | 0.75 s |
| C4 (Mitte) | 60 | 0.59 | 57 | 0.95 s |
| C5 | 72 | 0.85 | 68 | 1.13 s |
| G5 (hoch) | 79 | 1.0 | 75 | 1.25 s |

> **Begründung:** Tiefe Töne (A1–E2) sind schwerer stabil zu halten → kürzere Haltezeit verhindert, dass sie gar nicht registriert werden. Hohe Töne sind stabil → strengere Haltezeit reduziert Falschauslösungen.

---

## 7. EMA-Smoothing (index.html)

| Parameter | Wert | Effekt wenn erhöht (näher 1.0) | Effekt wenn gesenkt (näher 0) |
|-----------|------|-------------------------------|-------------------------------|
| `DOT_LERP` | `0.08` | Dot folgt Signal schneller, springt mehr | Dot gleitet träger, flüssiger |
| `FREQ_LERP` | `0.04` | Hz-Anzeige reagiert schneller | Hz-Anzeige ist gedämpfter |

**Formel:** `display = display + α × (target − display)`  
Bei α = 0.08 erreicht der Dot ~50% des Zielwerts nach ~8 Frames (~130 ms).

---

## 8. Anzeigebereich Pitch Bar (index.html)

| Parameter | Wert | Note | Frequenz |
|-----------|------|------|----------|
| `PITCH_MIN` | `33` | A1 | 55 Hz |
| `PITCH_MAX` | `79` | G5 | ~784 Hz |
| `PITCH_RANGE` | `46` | — | 46 Halbtöne |

> Töne ausserhalb dieses Bereichs werden auf die Grenzen geclamped (Dot sichtbar, aber an Grenze fixiert). Registriert als Min/Max werden sie trotzdem.

---

## Zusammenfassung: Schnell-Tuning

| Problem | Massnahme |
|---------|-----------|
| Raumrauschen löst Töne aus | `RMS_THRESHOLD` erhöhen (0.02–0.025) |
| Leise Stimmen werden nicht erkannt | `RMS_THRESHOLD` senken (0.01) |
| Tiefe Töne (Bass) werden verpasst | `THRESHOLD` in YIN leicht erhöhen (0.13–0.14) |
| Oktavsprünge (Dot springt hoch/tief) | `THRESHOLD` in YIN senken (0.10–0.11) |
| Ton wird zu früh registriert | `stabilityFrames` erhöhen (z.B. `40 + 45 × t`) |
| Ton muss zu lang gehalten werden | `stabilityFrames` senken (z.B. `20 + 35 × t`) |
| Dot springt zu viel | `DOT_LERP` senken (0.05) oder `DOT_MIN_FRAMES` erhöhen (6) |
| Dot reagiert zu träge | `DOT_LERP` erhöhen (0.12) |
