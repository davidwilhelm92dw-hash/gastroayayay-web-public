import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDictation, findTemplate, findRoutine, findSmallerSteps } from '../../src/domain/templates.js';

test('Diktat mit Doppelpunkt und Trennwörtern', () => {
  const r = parseDictation('Küche aufräumen: erst Geschirr wegräumen, dann Arbeitsfläche wischen und danach Müll rausbringen');
  assert.equal(r.title, 'Küche aufräumen');
  assert.equal(r.steps.length, 3);
  assert.equal(r.steps[0], 'Geschirr wegräumen');
  assert.equal(r.steps[1], 'Arbeitsfläche wischen');
  assert.equal(r.steps[2], 'Müll rausbringen');
});

test('Diktat ohne Doppelpunkt mit "zuerst"', () => {
  const r = parseDictation('Steuererklärung anfangen zuerst Ordner holen dann Belege sortieren');
  assert.equal(r.title, 'Steuererklärung anfangen');
  assert.deepEqual(r.steps, ['Ordner holen', 'Belege sortieren']);
});

test('nur Titel ergibt keine Schritte', () => {
  assert.deepEqual(parseDictation('Wäsche erledigen'), { title: 'Wäsche erledigen', steps: [] });
});

test('Vorlagen werden regelbasiert erkannt, unbekannte nicht', () => {
  assert.equal(findTemplate('ich muss die Wäsche machen').id, 'waesche');
  assert.equal(findTemplate('Küche aufräumen').id, 'kueche');
  assert.equal(findTemplate('Bad putzen').id, 'bad');
  assert.equal(findTemplate('Steuererklärung'), null);
});

test('gespeicherter Ablauf hat Vorrang und wird über den Titel gefunden', () => {
  const routines = [{ id: 'r1', title: 'Küche aufräumen', steps: ['Mein Schritt'] }];
  assert.equal(findRoutine('küche aufräumen bitte', routines).id, 'r1');
  assert.equal(findRoutine('Fahrrad reparieren', routines), null);
});

test('kleinere Schritte aus Vorlagen', () => {
  assert.equal(findSmallerSteps('Müll rausbringen').length, 3);
  assert.equal(findSmallerSteps('Etwas Unbekanntes'), null);
});
