import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, roomById, activitiesForDisplay, orderedSteps } from '../../src/domain/rooms.js';

test('jeder Raum hat häufige und seltene Tätigkeiten mit eindeutigen IDs', () => {
  const ids = new Set();
  for (const r of ROOMS) {
    const { oft, selten } = activitiesForDisplay(r);
    assert.ok(oft.length >= 3, r.id);
    assert.ok(selten.length >= 1, r.id);
    for (const a of r.activities) {
      assert.ok(!ids.has(a.id), a.id);
      ids.add(a.id);
    }
  }
});

test('Bad: Spiegel und Flächen vor der Toilette, Toilette zuletzt', () => {
  const bad = roomById('bad');
  const all = orderedSteps(bad, bad.activities.map((a) => a.id));
  assert.equal(all.at(-1), 'Toilette reinigen');
  assert.ok(all.indexOf('Spiegel putzen') < all.indexOf('Toilette reinigen'));
  assert.ok(all.indexOf('Ablagen abwischen') < all.indexOf('Toilette reinigen'));
});

test('Auswahlreihenfolge des Nutzers ändert die Ablaufreihenfolge nicht', () => {
  const bad = roomById('bad');
  assert.deepEqual(orderedSteps(bad, ['b-toilette', 'b-spiegel']), ['Spiegel putzen', 'Toilette reinigen']);
});

test('Fernseher abstauben gibt es im Wohn- und im Schlafzimmer', () => {
  for (const id of ['wohnzimmer', 'schlafzimmer']) {
    assert.ok(roomById(id).activities.some((a) => a.text === 'Fernseher abstauben'), id);
  }
  assert.ok(roomById('wohnzimmer').activities.some((a) => /Sofakissen/.test(a.text)));
});

test('Häufige Tätigkeiten werden vor seltenen angezeigt', () => {
  for (const r of ROOMS) {
    const { oft, selten } = activitiesForDisplay(r);
    assert.ok(oft.every((a) => a.freq === 'oft') && selten.every((a) => a.freq === 'selten'));
  }
});
