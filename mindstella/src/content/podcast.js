/**
 * Wissensfolge zu Kapitel 1. Die Audiodatei wird vorab produziert und lokal
 * eingebunden; die App erzeugt keine Audios. Solange die Datei fehlt, zeigt
 * die App diesen Stand ausdrücklich an und bietet das Skript zum Lesen an.
 */
export const EPISODE = {
  id: 'kapitel-1-huettenbau',
  title: 'Grundlagen, um eine Hütte zu bauen',
  chapter: 1,
  asset: 'audio/kapitel-1-huettenbau.mp3',
  targetLength: '5 bis 8 Minuten',
  voice: 'Vorgesehen: synthetische KI-Stimme, vorab produziert und in der Folge als solche angesagt.',
  productionStatus: 'Skript redaktionell erstellt; Aufnahme noch nicht produziert.',
  sources: ['din68800', 'idhBaulich', 'fplWoodHandbook', 'usdaAh73', 'hudDesign', 'bdfSockel'],
};

/**
 * Skript in Abschnitten. "fiction: true" markiert Passagen über die
 * erfundene Spielwelt; sie werden in der Begleitansicht gekennzeichnet.
 * Umfang rund 850 Wörter, bei ruhigem Sprechtempo etwa sechs bis sieben Minuten.
 */
export const SCRIPT = [
  {
    heading: 'Ansage',
    fiction: false,
    text: 'Mindstella, Kapitel eins: Grundlagen, um eine Hütte zu bauen. Diese Folge wird von einer synthetischen Stimme gesprochen. Die Abschnitte über den fremden Planeten sind erfunden; die Abschnitte über den Hüttenbau beruhen auf Fachliteratur, die in der App aufgeführt ist.',
  },
  {
    heading: 'Die Lage',
    fiction: true,
    text: 'Die Kapsel liegt schräg in der Wiese, die Schleifspur hinter ihr ist noch frisch. Nach der Kollision im Orbit ist der Funkkontakt zum Expeditionsteam abgerissen. Nur ein schwaches, regelmäßiges Signal kommt manchmal von jenseits des Gebirges herüber. Bevor sich jemand auf den Weg dorthin machen kann, braucht es das Nötigste: einen Ort zum Schlafen, Wasser, später Nahrung. Am Anfang steht eine einfache Hütte. Was du dafür wissen solltest, gilt nicht nur unter fremden Monden, sondern auch für jede Gartenhütte auf der Erde.',
  },
  {
    heading: 'Der wichtigste Gegner: Wasser',
    fiction: false,
    text: 'Holz ist ein erstaunlich dauerhafter Baustoff, solange es trocken bleibt. Holzzerstörende Pilze brauchen Feuchtigkeit. Das Wood Handbook des Forest Products Laboratory in den USA beschreibt, dass ernsthafte Fäulnis erst auftritt, wenn die Holzfeuchte über dem sogenannten Fasersättigungspunkt liegt, im Mittel bei etwa dreißig Prozent. Lufttrockenes Holz hat meist höchstens zwanzig Prozent Feuchte, und das gilt dort als ausreichender Sicherheitsabstand. Daraus folgt der Grundgedanke des baulichen Holzschutzes, wie ihn in Deutschland die Norm DIN 68800 Teil 2 beschreibt: Wasser soll möglichst gar nicht ins Holz gelangen. Und wenn es doch passiert, muss es schnell wieder austrocknen können. Fast jede Entscheidung beim Bau einer Hütte lässt sich auf diesen Gedanken zurückführen.',
  },
  {
    heading: 'Der Bauplatz',
    fiction: false,
    text: 'Deshalb beginnt alles mit dem Bauplatz. Er sollte so liegen, dass Regenwasser vom Gebäude wegfließt und sich nicht daran staut. Eine Mulde, in der nach jedem Schauer eine Pfütze steht, ist ein schlechter Ort für Holz. Besser ist eine Stelle, die etwas höher liegt als ihre Umgebung.',
  },
  {
    heading: 'Der Unterbau',
    fiction: false,
    text: 'Holz gehört nicht direkt auf die Erde. Unsere Hütte steht deshalb auf einzelnen Punktfundamenten aus Stein. Sie tragen das Gewicht in den Boden und halten das Holz auf Abstand. Wie viel Abstand? Wenn Regen auf den Boden prasselt, spritzt Wasser zurück an die Wand. Fachpublikationen zur DIN 68800-2 nennen deshalb dreißig Zentimeter zwischen Holzunterkante und Gelände. Liegt rund um das Gebäude eine grobe Kiesschüttung, die das Spritzwasser bremst, kann dieser Abstand auf fünfzehn Zentimeter sinken. Auf den Fundamenten liegen die Schwellen und die Bodenbalken. Darüber kommen die Dielen, mit Luft darunter, damit Feuchtigkeit abziehen kann.',
  },
  {
    heading: 'Das Tragwerk',
    fiction: false,
    text: 'Jetzt wächst die Hütte in die Höhe. An den Ecken stehen Pfosten, oben verbindet sie ein umlaufender Balken, das Rähm. Dieses Gerüst nennt man Tragwerk. Es nimmt alles auf, was auf die Hütte drückt: das Gewicht des Daches, Schnee, und den Wind, der von der Seite gegen die Wände steht. Diese Lasten wandern über das Rähm in die Pfosten, von dort in die Schwellen und Fundamente und schließlich in den Boden. Die Bretter der Wände füllen bei dieser Bauweise nur die Felder zwischen den Pfosten.',
  },
  {
    heading: 'Die Aussteifung',
    fiction: false,
    text: 'Ein Gerüst aus senkrechten Pfosten und waagerechten Balken hat eine Schwäche. Drückt der Wind seitlich dagegen, kann sich das Rechteck verschieben und zum Parallelogramm werden. Ein Dreieck dagegen behält seine Form, solange keine seiner Seiten länger oder kürzer wird. Deshalb setzt man in die Ecken schräge Hölzer, sogenannte Kopfbänder. Sie teilen das Rechteck in Dreiecke. Ein älteres Bauhandbuch des US-Landwirtschaftsministeriums beschreibt den Zweck solcher Eckaussteifungen knapp: Sie geben dem Bauwerk Steifigkeit und wirken dem Verschieben durch Wind entgegen. Im heutigen Wohnhausbau übernehmen diese Aufgabe häufig Holzwerkstoffplatten, die noch deutlich steifer sind. Für eine kleine Hütte reichen gut befestigte Diagonalen.',
  },
  {
    heading: 'Das Dach',
    fiction: false,
    text: 'Das Dach ist der wichtigste Witterungsschutz. Oben liegt die Firstpfette, ein kräftiger Balken am höchsten Punkt. Auf ihr und auf dem Rähm ruhen die Sparren, die schrägen Hölzer, die die Dachfläche tragen. Die Neigung sorgt dafür, dass Regen zügig abläuft. Genauso wichtig ist der Dachüberstand: Ragt das Dach ein Stück über die Wände hinaus, bleiben sie bei den meisten Regenschauern trocken. In den Unterlagen des Informationsdienstes Holz gelten Bauteile unter einem ausreichenden Dachüberstand als vor Bewitterung geschützt. Eine Stelle verdient besondere Aufmerksamkeit: das Hirnholz. So heißt die Schnittfläche quer zur Faser, und sie saugt Wasser besonders leicht auf. Die Enden der Sparren werden deshalb zurückgeschnitten, vom Dach überdeckt oder mit einem Brett oder Blech abgedeckt.',
  },
  {
    heading: 'Der letzte Schutz',
    fiction: false,
    text: 'Zum Schluss kommen die Details, die oft unterschätzt werden. Regenrinnen fangen das Wasser vom Dach und leiten es ab, bevor es am Sockel aufspritzt. Windbretter schließen die Dachkanten an den Giebeln. Eine Tür und ein Fensterladen halten Wind und Regen aus dem Innenraum. Keines dieser Teile ist spektakulär. Zusammen entscheiden sie darüber, ob eine Hütte ein paar Jahre hält oder ein paar Jahrzehnte.',
  },
  {
    heading: 'Zurück auf der Wiese',
    fiction: true,
    text: 'Auf der Wiese wird es langsam dunkel. Die drei Monde stehen über dem Gebirge: der größte hell und ruhig, daneben ein kleiner bläulicher und ein noch kleinerer, rötlicher. Die Rinnen sind aus Blechen der Kapselverkleidung gebogen, die Giebelbretter aus dem, was der Aufprall übrig gelassen hat. Noch ist das Funkgerät still. Aber eine Hütte bedeutet: Es gibt einen Ort, an den man zurückkehren kann. Von hier aus lässt sich alles Weitere angehen.',
  },
  {
    heading: 'Hinweis',
    fiction: false,
    text: 'Diese Folge erklärt Grundlagen. Für ein echtes Bauvorhaben gelten die örtlichen Vorschriften, die aktuelle Fassung der Normen und, je nach Größe, eine fachkundige Planung. Die Quellen zu dieser Folge findest du in der App unter Wissen.',
  },
];

export function scriptWordCount() {
  return SCRIPT.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
}
