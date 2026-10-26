import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/domain/state.js';
import { HUT_ELEMENT_COUNT } from '../../src/world/hutPlan.js';

function started(steps) {
  const s0 = S.createInitialState(0);
  return S.startTask(s0, { title: 'Küche aufräumen', steps }, 1);
}

function finish(state) {
  let s = state;
  let guard = 0;
  while (S.currentStep(s.task) && guard++ < 200) {
    s = S.completeStep(s, S.currentStep(s.task).id, 2).state;
  }
  return s;
}

test('kurze Liste (2 Schritte) ergibt eine vollständige Hütte', () => {
  const s = finish(started(['A', 'B']));
  assert.equal(s.world.elementsBuilt, HUT_ELEMENT_COUNT);
  assert.equal(s.world.completed, true);
  assert.equal(s.task.status, 'done');
  assert.equal(s.world.completedTaskTitle, 'Küche aufräumen');
});

test('lange Liste (20 Schritte) ergibt dieselbe vollständige Hütte', () => {
  const s = finish(started(Array.from({ length: 20 }, (_, i) => `Schritt ${i + 1}`)));
  assert.equal(s.world.elementsBuilt, HUT_ELEMENT_COUNT);
});

test('Doppeltipp mit derselben Schritt-ID schließt nur einen Schritt ab', () => {
  const s1 = started(['A', 'B', 'C']);
  const id = S.currentStep(s1.task).id;
  const r1 = S.completeStep(s1, id, 5);
  const r2 = S.completeStep(r1.state, id, 6);
  assert.equal(r2.gained, 0);
  assert.equal(r2.state, r1.state);
  assert.equal(r1.state.task.steps.filter((x) => x.done).length, 1);
});

test('Verkleinern erhält sichtbaren Fortschritt und erzeugt keine Zusatzbelohnung', () => {
  let s = started(['A', 'B', 'C']);
  s = S.completeStep(s, S.currentStep(s.task).id).state;
  const builtBefore = s.world.elementsBuilt;
  const r = S.splitCurrentStep(s, S.currentStep(s.task).id, ['B1', 'B2', 'B3']);
  assert.ok(r.ok);
  assert.equal(r.state.world.elementsBuilt, builtBefore);
  assert.equal(S.openSteps(r.state.task).length, 4);
  assert.equal(S.currentStep(r.state.task).text, 'B1');
  assert.equal(S.currentStep(r.state.task).partOf, 'B');
  const done = finish(r.state);
  assert.equal(done.world.elementsBuilt, HUT_ELEMENT_COUNT);
  assert.equal(done.world.totalElements, HUT_ELEMENT_COUNT);
});

test('Verkleinern mit veralteter Schritt-ID wird abgelehnt', () => {
  let s = started(['A', 'B']);
  const oldId = S.currentStep(s.task).id;
  s = S.completeStep(s, oldId).state;
  assert.equal(S.splitCurrentStep(s, oldId, ['x', 'y']).ok, false);
});

test('Pause verhindert Abhaken, Fortsetzen erlaubt es wieder', () => {
  let s = S.pauseTask(started(['A', 'B']));
  const id = S.currentStep(s.task).id;
  assert.equal(S.completeStep(s, id).gained, 0);
  s = S.resumeTask(s);
  assert.ok(S.completeStep(s, id).gained > 0);
});

test('Gedanke parken verändert den aktuellen Schritt nicht', () => {
  const s = started(['A', 'B']);
  const s2 = S.parkThought(s, 'Zahnarzt anrufen');
  assert.equal(S.currentStep(s2.task).id, S.currentStep(s.task).id);
  assert.equal(s2.parked.length, 1);
});

test('Speichern und Laden (JSON) stellt Schritt und Bauzustand her', () => {
  let s = started(['A', 'B', 'C', 'D']);
  s = S.completeStep(s, S.currentStep(s.task).id).state;
  const restored = S.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(S.currentStep(restored.task).id, S.currentStep(s.task).id);
  assert.equal(restored.world.elementsBuilt, s.world.elementsBuilt);
});

test('abgebrochene Aufgabe lässt gebaute Teile stehen, nächste Aufgabe vollendet die Hütte', () => {
  let s = started(['A', 'B', 'C']);
  s = S.completeStep(s, S.currentStep(s.task).id).state;
  const built = s.world.elementsBuilt;
  s = S.abandonTask(s);
  assert.equal(s.world.elementsBuilt, built);
  s = S.startTask(s, { title: 'Wäsche', steps: ['X'] });
  s = finish(s);
  assert.equal(s.world.elementsBuilt, HUT_ELEMENT_COUNT);
});

test('leere Schritte werden verworfen, ohne Schritte startet nichts', () => {
  const s0 = S.createInitialState();
  assert.equal(S.startTask(s0, { title: 'X', steps: ['  ', ''] }), s0);
  const s1 = S.startTask(s0, { title: 'X', steps: ['', 'A'] });
  assert.equal(s1.task.steps.length, 1);
});

test('kaputter Spielstand wird verworfen statt abzustürzen', () => {
  assert.equal(S.migrate(null), null);
  assert.equal(S.migrate({ version: 99 }), null);
});
