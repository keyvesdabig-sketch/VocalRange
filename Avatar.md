Die Animation eines Avatars anhand von Audiodaten (Audio-Responsive Visualization) basiert auf der sogenannten skalaren Zuordnung (Scalar Mapping), bei der kontinuierliche numerische Audiomerkmale direkt in visuelle Parameter übersetzt werden. Basierend auf den wissenschaftlichen Konzepten zur audiovisuellen Zuordnung kannst du die geglättete Tonhöhe und den Lautstärkepegel für deine Figur wie folgt nutzen:

**1. Lautstärkepegel (Amplitude / RMS)**
Die Amplitude eignet sich hervorragend, um die visuelle Intensität und geometrische Verformungen in Echtzeit zu steuern.
*   **Mundöffnung (Lip-Sync) und Körper-Pulsieren:** Du kannst die Dynamik der Lautstärke (Amplitude Envelope) direkt an die Skalierung binden. So öffnet sich der Mund des Avatars proportional zum RMS-Wert, oder der gesamte Rumpf pulsiert leicht, um die Kraft der Stimme zu simulieren.
*   **Helligkeit und Leuchtkraft:** Ein Anstieg der Amplitude kann auch genutzt werden, um die Beleuchtung der Figur heller zu machen oder Materialien stärker leuchten zu lassen. Wenn der Sänger lauter wird, könnte die Figur also förmlich "aufstrahlen".

**2. Tonhöhe (Pitch / Frequenz)**
Frequenzänderungen werden in der audiovisuellen Kunst klassischerweise für räumliche Positionierungen, Farbverschiebungen und Formveränderungen genutzt.
*   **Räumliche Bewegung (Y-Achse):** Wandle die Tonhöhe direkt in Parameter für die Position um. Tiefe Basstöne platzieren den Avatar weiter unten auf dem Bildschirm, während hohe Töne in der Countertenor-Lage ihn nach oben schweben oder klettern lassen.
*   **Körperform (Squash & Stretch / Masse):** Die Forschung zeigt, dass tiefe Frequenzbänder ein Gefühl von räumlicher Masse und Schwere vermitteln und langsame geometrische Verformungen gut repräsentieren. Wenn der Nutzer einen tiefen Ton singt, könnte der Avatar breiter und gedrungener ("Squash") werden, um das musikalische Fundament darzustellen. Hohe Töne hingegen werden mit schärferer räumlicher Artikulation in Verbindung gebracht, wodurch sich die Figur nach oben strecken ("Stretch") könnte.
*   **Farbcodierung (Color Temperature):** Hohe Frequenzen werden oft mit helleren, kühleren Farben und scharfen Details assoziiert, während tiefe Frequenzen dunkleren oder wärmeren Tönen entsprechen. Du kannst die Farbe oder Kleidung deines Avatars basierend auf der erkannten Frequenz dynamisch anpassen.

**3. Kombination aus beidem (Schwellenwerte & Ereignisse)**
*   **Diskrete Ereignisse:** Du kannst schwellenwertbasierte Regeln (Thresholds) definieren, die visuelle Reaktionen auslösen, wenn Lautstärke und Tonhöhe bestimmte Werte überschreiten. Ein plötzlicher, lauter Spitzenton könnte den Avatar vibrieren lassen oder ein Partikelsystem (z. B. Schweißtropfen) auslösen.
*   **Stille / Atmen:** Wenn das Signal unter dein RMS-Gate fällt (also Rauschen oder Atmen erkannt wird), kannst du den Avatar in eine Ruhestellung oder Zuhör-Pose übergehen lassen, da kein verwertbarer Grundton vorhanden ist.