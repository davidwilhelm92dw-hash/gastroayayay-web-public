/**
 * Hausarbeit nach Räumen. Jede Tätigkeit hat
 *   freq: 'oft' (oben angezeigt) oder 'selten' (darunter),
 *   seq:  Position im Ablauf; ausgewählte Tätigkeiten werden danach sortiert.
 *
 * Die Anzeigereihenfolge (Häufigkeit) und die Ablaufreihenfolge (seq) sind
 * bewusst getrennt: Häufiges steht oben, ausgeführt wird in sinnvoller
 * Folge, zum Beispiel von oben nach unten und im Bad die Toilette zuletzt.
 */

/** @typedef {{ id: string, text: string, freq: 'oft'|'selten', seq: number, smaller?: string[] }} Activity */
/** @typedef {{ id: string, name: string, title: string, icon: string, keywords: string[], activities: Activity[] }} Room */

/** @type {Room[]} */
export const ROOMS = [
  {
    id: 'kueche',
    name: 'Küche',
    title: 'Küche aufräumen',
    icon: 'kueche',
    keywords: ['küche', 'kueche', 'geschirr', 'abwasch', 'spülmaschine', 'spuelmaschine', 'spülen'],
    activities: [
      { id: 'k-geschirr', text: 'Benutztes Geschirr zur Spüle bringen', freq: 'oft', seq: 10, smaller: ['Gläser und Tassen einsammeln', 'Teller und Besteck einsammeln', 'Töpfe und Pfannen zur Spüle stellen'] },
      { id: 'k-sm-aus', text: 'Spülmaschine ausräumen', freq: 'oft', seq: 20, smaller: ['Unteren Korb ausräumen', 'Oberen Korb und Besteck ausräumen'] },
      { id: 'k-sm-ein', text: 'Spülmaschine einräumen und starten', freq: 'oft', seq: 30 },
      { id: 'k-flaeche', text: 'Arbeitsfläche abwischen', freq: 'oft', seq: 50, smaller: ['Dinge von der Arbeitsfläche wegräumen', 'Arbeitsfläche feucht abwischen'] },
      { id: 'k-herd', text: 'Herd abwischen', freq: 'oft', seq: 60 },
      { id: 'k-muell', text: 'Müll rausbringen', freq: 'oft', seq: 75, smaller: ['Müllbeutel zubinden', 'Beutel zur Tonne bringen', 'Neuen Beutel einsetzen'] },
      { id: 'k-toepfe', text: 'Töpfe und Pfannen von Hand spülen', freq: 'selten', seq: 35 },
      { id: 'k-kuehl', text: 'Kühlschrank auf Abgelaufenes prüfen', freq: 'selten', seq: 40 },
      { id: 'k-tuecher', text: 'Geschirrtücher wechseln', freq: 'selten', seq: 45 },
      { id: 'k-spuele', text: 'Spülbecken reinigen', freq: 'selten', seq: 70 },
      { id: 'k-kehren', text: 'Boden kehren', freq: 'selten', seq: 80 },
      { id: 'k-wischen', text: 'Boden wischen', freq: 'selten', seq: 85 },
    ],
  },
  {
    id: 'bad',
    name: 'Bad',
    title: 'Bad putzen',
    icon: 'bad',
    keywords: ['bad', 'badezimmer', 'toilette', 'klo', 'wc', 'dusche', 'waschbecken'],
    activities: [
      { id: 'b-spiegel', text: 'Spiegel putzen', freq: 'oft', seq: 20 },
      { id: 'b-becken', text: 'Waschbecken reinigen', freq: 'oft', seq: 30 },
      { id: 'b-ablagen', text: 'Ablagen abwischen', freq: 'oft', seq: 40 },
      { id: 'b-toilette', text: 'Toilette reinigen', freq: 'oft', seq: 99, smaller: ['Reiniger in die Toilette geben', 'Brille und Deckel abwischen', 'Becken ausbürsten und spülen'] },
      { id: 'b-raeumen', text: 'Herumliegendes wegräumen', freq: 'selten', seq: 5 },
      { id: 'b-handtuch', text: 'Handtücher wechseln', freq: 'selten', seq: 10 },
      { id: 'b-armatur', text: 'Armaturen polieren', freq: 'selten', seq: 45 },
      { id: 'b-dusche', text: 'Dusche oder Badewanne reinigen', freq: 'selten', seq: 60 },
      { id: 'b-eimer', text: 'Mülleimer leeren', freq: 'selten', seq: 70 },
      { id: 'b-boden', text: 'Boden wischen', freq: 'selten', seq: 80 },
    ],
  },
  {
    id: 'wohnzimmer',
    name: 'Wohnzimmer',
    title: 'Wohnzimmer aufräumen',
    icon: 'wohnzimmer',
    keywords: ['wohnzimmer', 'sofa', 'couch', 'stube'],
    activities: [
      { id: 'w-raeumen', text: 'Herumliegendes wegräumen', freq: 'oft', seq: 10, smaller: ['Geschirr in die Küche bringen', 'Kleidung wegbringen', 'Rest an seinen Platz legen'] },
      { id: 'w-kissen', text: 'Sofakissen ordentlich hinrichten', freq: 'oft', seq: 30 },
      { id: 'w-tisch', text: 'Couchtisch abwischen', freq: 'oft', seq: 40 },
      { id: 'w-tv', text: 'Fernseher abstauben', freq: 'oft', seq: 50 },
      { id: 'w-lueften', text: 'Fenster zum Lüften öffnen', freq: 'selten', seq: 5 },
      { id: 'w-decken', text: 'Decken zusammenlegen', freq: 'selten', seq: 20 },
      { id: 'w-regal', text: 'Regale abstauben', freq: 'selten', seq: 55 },
      { id: 'w-pflanzen', text: 'Pflanzen gießen', freq: 'selten', seq: 60 },
      { id: 'w-saugen', text: 'Staubsaugen', freq: 'selten', seq: 80 },
      { id: 'w-wischen', text: 'Boden wischen', freq: 'selten', seq: 90 },
    ],
  },
  {
    id: 'schlafzimmer',
    name: 'Schlafzimmer',
    title: 'Schlafzimmer aufräumen',
    icon: 'schlafzimmer',
    keywords: ['schlafzimmer', 'bett', 'kleiderschrank'],
    activities: [
      { id: 's-lueften', text: 'Fenster zum Lüften öffnen', freq: 'oft', seq: 5 },
      { id: 's-bett', text: 'Bett machen', freq: 'oft', seq: 20 },
      { id: 's-kleidung', text: 'Kleidung wegräumen', freq: 'oft', seq: 30, smaller: ['Getragenes in den Wäschekorb legen', 'Sauberes in den Schrank legen'] },
      { id: 's-nacht', text: 'Nachttisch aufräumen', freq: 'oft', seq: 40 },
      { id: 's-bettwaesche', text: 'Bettwäsche wechseln', freq: 'selten', seq: 15, smaller: ['Alte Bettwäsche abziehen', 'Kissen neu beziehen', 'Decke neu beziehen'] },
      { id: 's-tv', text: 'Fernseher abstauben', freq: 'selten', seq: 50 },
      { id: 's-kommode', text: 'Kommode abstauben', freq: 'selten', seq: 55 },
      { id: 's-pflanzen', text: 'Pflanzen gießen', freq: 'selten', seq: 60 },
      { id: 's-saugen', text: 'Staubsaugen', freq: 'selten', seq: 80 },
    ],
  },
  {
    id: 'flur',
    name: 'Flur',
    title: 'Flur aufräumen',
    icon: 'flur',
    keywords: ['flur', 'eingang', 'diele', 'garderobe', 'schuhe'],
    activities: [
      { id: 'f-schuhe', text: 'Schuhe ordnen', freq: 'oft', seq: 10 },
      { id: 'f-jacken', text: 'Jacken aufhängen', freq: 'oft', seq: 20 },
      { id: 'f-post', text: 'Post sortieren', freq: 'oft', seq: 30 },
      { id: 'f-schluessel', text: 'Schlüsselablage aufräumen', freq: 'selten', seq: 25 },
      { id: 'f-spiegel', text: 'Spiegel putzen', freq: 'selten', seq: 40 },
      { id: 'f-matte', text: 'Fußmatte ausschütteln', freq: 'selten', seq: 50 },
      { id: 'f-kehren', text: 'Boden kehren', freq: 'selten', seq: 80 },
    ],
  },
  {
    id: 'waesche',
    name: 'Wäsche',
    title: 'Wäsche erledigen',
    icon: 'waesche',
    keywords: ['wäsche', 'waesche', 'waschen', 'waschmaschine', 'klamotten', 'trockner'],
    activities: [
      { id: 'x-sortieren', text: 'Wäsche nach Farben sortieren', freq: 'oft', seq: 10, smaller: ['Helle Teile heraussuchen', 'Dunkle Teile heraussuchen', 'Restliche Teile auf einen Stapel legen'] },
      { id: 'x-starten', text: 'Maschine befüllen und starten', freq: 'oft', seq: 20 },
      { id: 'x-aufhaengen', text: 'Gewaschene Wäsche aufhängen', freq: 'oft', seq: 30, smaller: ['Wäscheständer aufstellen', 'Große Teile aufhängen', 'Kleine Teile aufhängen'] },
      { id: 'x-abnehmen', text: 'Trockene Wäsche abnehmen', freq: 'oft', seq: 40 },
      { id: 'x-legen', text: 'Wäsche zusammenlegen', freq: 'oft', seq: 50, smaller: ['Shirts zusammenlegen', 'Hosen zusammenlegen', 'Socken paarweise zusammenlegen'] },
      { id: 'x-einraeumen', text: 'Wäsche in den Schrank räumen', freq: 'oft', seq: 60 },
      { id: 'x-flecken', text: 'Flecken vorbehandeln', freq: 'selten', seq: 15 },
      { id: 'x-buegeln', text: 'Bügeln', freq: 'selten', seq: 55 },
      { id: 'x-flusen', text: 'Flusensieb reinigen', freq: 'selten', seq: 70 },
    ],
  },
];

export function roomById(id) {
  return ROOMS.find((r) => r.id === id) || null;
}

/** Tätigkeiten in Anzeigereihenfolge: häufige zuerst, innerhalb nach Ablauf. */
export function activitiesForDisplay(room) {
  const bySeq = (a, b) => a.seq - b.seq;
  return {
    oft: room.activities.filter((a) => a.freq === 'oft').sort(bySeq),
    selten: room.activities.filter((a) => a.freq === 'selten').sort(bySeq),
  };
}

/** Ausgewählte Tätigkeiten in sinnvoller Ablaufreihenfolge als Schritttexte. */
export function orderedSteps(room, selectedIds) {
  const set = new Set(selectedIds);
  return room.activities
    .filter((a) => set.has(a.id))
    .sort((a, b) => a.seq - b.seq)
    .map((a) => a.text);
}

/** Vorauswahl: alle häufigen Tätigkeiten. */
export function defaultSelection(room) {
  return room.activities.filter((a) => a.freq === 'oft').map((a) => a.id);
}
