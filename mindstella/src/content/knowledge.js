/**
 * Wissenskarten zu den im Modell sichtbaren Bauteilen. Jede Karte trennt
 * überprüfbares Wissen (facts) von der erfundenen Spielwelt (fiction).
 * "phase" bestimmt, ab welchem Bauabschnitt die Karte abrufbar ist.
 */
export const KNOWLEDGE_CARDS = [
  {
    id: 'bauplatz',
    phase: null,
    title: 'Der Bauplatz',
    facts: [
      'Für eine Holzhütte zählt beim Bauplatz vor allem der Umgang mit Wasser. Regen soll vom Gebäude wegfließen, statt sich an ihm zu stauen, und das Holz soll nach Nässe rasch wieder abtrocknen können.',
      'Deshalb liegt Holz nicht direkt auf dem Erdreich. Der bauliche Holzschutz setzt zuerst auf die Konstruktion: Wasser fernhalten, ableiten und Trocknung ermöglichen, bevor an chemischen Schutz überhaupt gedacht wird.',
    ],
    fiction: 'Der Platz liegt etwas erhöht neben der Landekapsel. Die Monde, die Laternenstauden und der bläuliche Bewuchs dieser Wiese sind erfunden.',
    sources: ['idhBaulich', 'din68800'],
  },
  {
    id: 'material',
    phase: 'material',
    title: 'Holz sammeln',
    facts: [
      'Bevor gebaut wird, liegt das Material griffbereit am Bauplatz. So muss die Arbeit später nicht für jedes Bauteil unterbrochen werden.',
      'Fürs Bauen soll Holz trocken sein. Lufttrockenes Holz hat nach dem Wood Handbook meist höchstens 20 Prozent Feuchte und gilt damit als ausreichend sicher gegen Pilzbefall.',
    ],
    fiction: 'Die Stämme stammen von umgestürzten Bäumen am Waldrand. Wie schnell Holz auf diesem Planeten trocknet, ist noch unbekannt.',
    sources: ['fplWoodHandbook'],
  },
  {
    id: 'unterbau',
    phase: 'unterbau',
    title: 'Unterbau: Steinsockel und Schwellen',
    facts: [
      'Die Hütte steht auf einem niedrigen Sockel aus Natursteinen. Er trägt die Last in den Boden und hält das Holz vom feuchten Erdreich fern.',
      'Als Schutz vor Spritzwasser nennen Fachpublikationen zur DIN 68800-2 einen Abstand von 30 Zentimetern zwischen Holzunterkante und Gelände. Bremst eine grobe Kiesschüttung das Spritzwasser, kann der Abstand auf 15 Zentimeter sinken.',
      'Auf dem Sockel liegen die Schwellen und Bodenbalken. Sie verteilen die Last und bilden den Rahmen für den Boden.',
    ],
    fiction: 'Die Steine stammen von der Wiese rund um den Bauplatz. Wie tief der Boden dieses Planeten im Winter gefriert, weiß noch niemand.',
    sources: ['bdfSockel', 'din68800'],
  },
  {
    id: 'holzfeuchte',
    phase: 'boden',
    title: 'Boden und Holzfeuchte',
    facts: [
      'Holzzerstörende Pilze brauchen Wasser. Nach dem Wood Handbook des US Forest Products Laboratory tritt ernsthafte Fäulnis erst auf, wenn die Holzfeuchte über dem Fasersättigungspunkt liegt, im Mittel bei etwa 30 Prozent.',
      'Lufttrockenes Holz mit höchstens 20 Prozent Feuchte gilt dort als ausreichender Sicherheitsabstand gegen Pilzbefall. Feuchte Luft allein macht Holz nicht so nass, dass es fault, kann aber Schimmel an der Oberfläche begünstigen.',
      'Die Dielen liegen deshalb auf Balken mit Luft darunter: Wird es doch einmal feucht, kann das Holz wieder abtrocknen.',
    ],
    fiction: null,
    sources: ['fplWoodHandbook'],
  },
  {
    id: 'tragwerk',
    phase: 'tragwerk',
    title: 'Tragwerk: Pfosten und Rähm',
    facts: [
      'Das Tragwerk ist das Gerüst der Hütte. Eckpfosten stehen auf den Schwellen, oben verbindet sie ein umlaufender Balken, das Rähm.',
      'Lasten aus Dach, Schnee und Wind wandern über Sparren und Rähm in die Pfosten, von dort in Schwellen und Fundamente und schließlich in den Boden. Die Bretter der Wände füllen bei dieser Bauweise nur die Felder zwischen den Pfosten.',
    ],
    fiction: null,
    sources: ['usdaAh73'],
    note: 'Der beschriebene Lastweg ist baufachliches Grundwissen; die Quelle behandelt Holzrahmenbau allgemein.',
  },
  {
    id: 'aussteifung',
    phase: 'aussteifung',
    title: 'Aussteifung: Warum Dreiecke halten',
    facts: [
      'Ein Rechteck aus Pfosten und Balken lässt sich seitlich zusammendrücken, bis es zum Parallelogramm wird. Ein Dreieck behält seine Form, solange seine Seiten ihre Länge nicht ändern.',
      'Diagonale Kopfbänder in den Ecken teilen das Rechteck in Dreiecke. Das Landwirtschaftsministerium der USA beschreibt den Zweck solcher Eckaussteifungen so: Sie geben dem Bauwerk Steifigkeit und wirken dem seitlichen Verschieben durch Wind entgegen.',
      'Im Wohnhausbau übernehmen häufig Holzwerkstoffplatten diese Aufgabe; sie steifen deutlich stärker aus als einzelne Diagonalbretter.',
    ],
    fiction: null,
    sources: ['usdaAh73', 'hudDesign'],
  },
  {
    id: 'waende',
    phase: 'waende',
    title: 'Wände: Ausfachung aus Brettern',
    facts: [
      'Die Bretter stehen senkrecht zwischen den Pfosten. So läuft Regenwasser an ihnen nach unten ab, statt auf waagerechten Kanten liegen zu bleiben.',
      'Wichtig ist, dass Wasser an der Wand nicht eingeschlossen wird. Bekleidungen mit Luftraum dahinter, sogenannte hinterlüftete Fassaden, können nach Regen schneller abtrocknen.',
    ],
    fiction: 'Die Giebeldreiecke sind aus den übrig gebliebenen Brettern gesägt, die beim Aufprall der Kapsel nicht zerbrochen sind.',
    sources: ['idhBaulich'],
  },
  {
    id: 'dach',
    phase: 'dach',
    title: 'Dach: First, Sparren und Überstand',
    facts: [
      'Die Firstpfette trägt die Sparren am höchsten Punkt; die Sparren liegen unten auf dem Rähm auf. Die geneigte Dachfläche leitet Regen zügig ab.',
      'Der Dachüberstand hält Wasser von den Wänden fern. Bauteile unter einem ausreichenden Dachüberstand gelten im baulichen Holzschutz als vor Bewitterung geschützt.',
      'Hirnholz, also die Schnittfläche quer zur Faser, saugt Wasser besonders leicht auf. Die Enden der Sparren werden deshalb zurückgeschnitten, vom Dach überdeckt oder mit einem Brett oder Blech abgedeckt.',
    ],
    fiction: null,
    sources: ['idhBaulich', 'din68800'],
  },
  {
    id: 'witterungsschutz',
    phase: 'witterungsschutz',
    title: 'Witterungsschutz',
    facts: [
      'Regenrinnen fangen das Dachwasser und leiten es ab, bevor es am Sockel aufspritzt. Windbretter schließen die Dachkanten an den Giebeln, Tür und Fensterladen schützen den Innenraum.',
      'Der Grundsatz des baulichen Holzschutzes nach DIN 68800-2 lässt sich in einem Satz sagen: Wasser soll möglichst gar nicht ins Holz gelangen, und wenn doch, muss es schnell wieder austrocknen können.',
    ],
    fiction: 'Die Rinnen sind aus geborgenen Blechen der Kapselverkleidung gebogen.',
    sources: ['din68800', 'idhBaulich'],
  },
];

export function availableCards(reachedPhaseIds) {
  const reached = new Set(reachedPhaseIds);
  return KNOWLEDGE_CARDS.map((c) => ({ ...c, unlocked: c.phase === null || reached.has(c.phase) }));
}

export function cardForPhase(phaseId) {
  return KNOWLEDGE_CARDS.find((c) => c.phase === phaseId) || null;
}
