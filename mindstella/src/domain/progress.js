/**
 * Verteilung des Baufortschritts auf Alltagsschritte.
 *
 * Die Hütte besteht aus einer festen Zahl von Bauelementen. Bereits gebaute
 * Elemente bleiben immer stehen. Beim Abhaken eines Schritts werden die noch
 * fehlenden Elemente gleichmäßig auf die offenen Schritte verteilt; der
 * letzte offene Schritt erhält den Rest. Dadurch gilt unabhängig von der
 * Schrittzahl:
 *   - jeder erledigte Schritt fügt mindestens ein Element hinzu,
 *   - der Abschluss der Hauptaufgabe ergibt genau eine vollständige Hütte,
 *   - Verkleinern oder Ergänzen verändert nur die Verteilung des Rests,
 *     nie den sichtbaren Bestand und nie die Gesamtmenge.
 */

/**
 * @param {number} built     bereits gebaute Elemente
 * @param {number} total     Elemente der vollständigen Hütte
 * @param {number} openSteps offene Schritte einschließlich des gerade erledigten
 * @returns {number} Zahl der Elemente, die der erledigte Schritt hinzufügt
 */
export function elementsForCompletedStep(built, total, openSteps) {
  const remaining = total - built;
  if (remaining <= 0 || openSteps <= 0) return 0;
  if (openSteps === 1) return remaining;
  const even = Math.floor(remaining / openSteps);
  // Jeder spätere offene Schritt muss noch mindestens ein Element erhalten.
  const cap = remaining - (openSteps - 1);
  return Math.max(1, Math.min(even, cap));
}

/**
 * Wie viele offene Schritte eine Aufgabe höchstens haben darf, damit jeder
 * noch ein sichtbares Bauelement erhalten kann.
 */
export function maxOpenSteps(built, total) {
  return Math.max(0, total - built);
}
