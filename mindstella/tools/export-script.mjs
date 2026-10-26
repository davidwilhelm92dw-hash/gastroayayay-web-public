/**
 * Erzeugt aus src/content/podcast.js und sources.js ein Markdown-Dokument
 * für die Produktion der Wissensfolge (Sprechertext mit Quellen).
 * Aufruf: npm run export:script
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { EPISODE, SCRIPT, scriptWordCount } from '../src/content/podcast.js';
import { SOURCES, SOURCE_CHECK_NOTE } from '../src/content/sources.js';

const words = scriptWordCount();
const lines = [
  `# Wissensfolge Kapitel 1: ${EPISODE.title}`,
  '',
  '<!-- Automatisch erzeugt aus src/content/podcast.js – Änderungen bitte dort vornehmen. -->',
  '',
  `- Status: ${EPISODE.productionStatus}`,
  `- Stimme: ${EPISODE.voice}`,
  `- Zieldauer: ${EPISODE.targetLength}; Umfang ${words} Wörter (bei 130 Wörtern pro Minute rund ${(words / 130).toFixed(1).replace(".", ",")} Minuten)`,
  `- Zieldatei in der App: \`public/${EPISODE.asset}\` (MP3, mono, 64–96 kbit/s genügen)`,
  '',
  'Abschnitte mit **[Fiktion]** beschreiben die erfundene Spielwelt; **[Sachwissen]** beruht auf den Quellen unten.',
  '',
];
for (const part of SCRIPT) {
  lines.push(`## ${part.heading} ${part.fiction ? '[Fiktion]' : '[Sachwissen]'}`, '', part.text, '');
}
lines.push('## Quellen', '');
for (const id of EPISODE.sources) {
  const s = SOURCES[id];
  lines.push(`- ${s.publisher}: *${s.title}* (${s.year}). ${s.url}  `, `  Prüfung: ${s.checked}`);
}
lines.push('', SOURCE_CHECK_NOTE, '');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/wissensfolge-kapitel-1.md', lines.join('\n'));
console.log(`docs/wissensfolge-kapitel-1.md geschrieben (${words} Wörter).`);
