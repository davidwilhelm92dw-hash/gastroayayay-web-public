/**
 * Fachquellen für Wissenskarten und Wissensfolge.
 * "checked" beschreibt ehrlich, wie die Aussagen geprüft wurden.
 */
export const SOURCES = {
  din68800: {
    id: 'din68800',
    title: 'DIN 68800-2:2022-02 – Holzschutz, Teil 2: Vorbeugende bauliche Maßnahmen im Hochbau',
    publisher: 'DIN Deutsches Institut für Normung',
    year: '2022',
    url: 'https://www.baunormenlexikon.de/norm/din-68800-2/111e6fbf-6458-4a9b-9f9d-e7ed67570450',
    checked: 'Normtext nicht eingesehen (kostenpflichtig); Inhalte über die unten genannten Fachpublikationen geprüft.',
  },
  idhBaulich: {
    id: 'idhBaulich',
    title: 'holzbau handbuch, Reihe 5, Teil 2, Folge 2: Holzschutz – Bauliche Maßnahmen',
    publisher: 'Informationsdienst Holz',
    year: '2023',
    url: 'https://informationsdienst-holz.de/fileadmin/Publikationen/2_Holzbau_Handbuch/R05_T02_F02_Holzschutz--Bauliche-Massnahmen_2023-01.pdf',
    checked: 'Aussagen zu Dachüberstand und Hirnholzschutz anhand von Textauszügen geprüft.',
  },
  fplWoodHandbook: {
    id: 'fplWoodHandbook',
    title: 'Wood Handbook – Wood as an Engineering Material (FPL-GTR-282), Kapitel 14: Biodeterioration of Wood',
    publisher: 'USDA Forest Service, Forest Products Laboratory',
    year: '2021',
    url: 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr282/chapter_14_fpl_gtr282.pdf',
    checked: 'Aussagen zu Fasersättigung (ca. 30 %) und 20-%-Sicherheitsgrenze anhand von Textauszügen geprüft.',
  },
  usdaAh73: {
    id: 'usdaAh73',
    title: 'Wood-Frame House Construction, Agriculture Handbook No. 73 (L. O. Anderson, O. C. Heyer)',
    publisher: 'USDA Forest Service, Forest Products Laboratory',
    year: '1955, überarbeitet 1970/1975',
    url: 'https://sibr.nist.gov/record/wood-frame-house-construction',
    checked: 'Zweck der Eckaussteifung (Steifigkeit, Widerstand gegen Verschieben durch Wind) anhand von Textauszügen geprüft.',
  },
  hudDesign: {
    id: 'hudDesign',
    title: 'Residential Structural Design Guide, Kapitel 5: Design of Wood Framing',
    publisher: 'U.S. Department of Housing and Urban Development (HUD)',
    year: '2000',
    url: 'https://www.huduser.gov/publications/pdf/res2000_3.pdf',
    checked: 'Aussage, dass Holzwerkstoffplatten deutlich steifer aussteifen als eingelassene Diagonalbretter, anhand von Textauszügen geprüft.',
  },
  bdfSockel: {
    id: 'bdfSockel',
    title: 'Merkblatt „Sockel“ – Sockelkonstruktionen gemäß DIN 68800-2',
    publisher: 'Bundesverband Deutscher Fertigbau (BDF)',
    year: 'o. J.',
    url: 'https://www.fertigbau.de/newsroom/index.html?getDownloadFile=88',
    checked: 'Abstände 30 cm bzw. 15 cm mit Kiesschüttung anhand von Textauszügen geprüft; Verbandsmerkblatt, keine Norm.',
  },
};

export const SOURCE_CHECK_NOTE =
  'Geprüft am 26. Oktober 2026 anhand von Textauszügen der genannten Veröffentlichungen. Die Volltexte waren in der Entwicklungsumgebung nicht abrufbar; vor einer Veröffentlichung ist ein Abgleich mit den Volltexten vorgesehen. Die Karten vermitteln Grundlagen und ersetzen keine Planung für ein echtes Bauvorhaben.';
