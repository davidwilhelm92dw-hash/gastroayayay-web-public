import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementsForCompletedStep } from '../../src/domain/progress.js';
import { HUT_ELEMENT_COUNT } from '../../src/world/hutPlan.js';

function simulate(stepCount, total = HUT_ELEMENT_COUNT) {
  let built = 0;
  const gains = [];
  for (let open = stepCount; open >= 1; open--) {
    const g = elementsForCompletedStep(built, total, open);
    gains.push(g);
    built += g;
  }
  return { built, gains };
}

test('jede Schrittzahl von 1 bis zur Elementzahl ergibt genau eine Hütte', () => {
  for (let n = 1; n <= HUT_ELEMENT_COUNT; n++) {
    const { built, gains } = simulate(n);
    assert.equal(built, HUT_ELEMENT_COUNT, `n=${n}`);
    assert.ok(gains.every((g) => g >= 1), `jeder Schritt baut etwas (n=${n})`);
  }
});

test('Verteilung ist gleichmäßig (Abweichung höchstens ein Element)', () => {
  for (const n of [3, 7, 12, 20]) {
    const { gains } = simulate(n);
    assert.ok(Math.max(...gains) - Math.min(...gains) <= 1, `n=${n}: ${gains}`);
  }
});

test('nichts mehr zu bauen ergibt null', () => {
  assert.equal(elementsForCompletedStep(HUT_ELEMENT_COUNT, HUT_ELEMENT_COUNT, 3), 0);
});
