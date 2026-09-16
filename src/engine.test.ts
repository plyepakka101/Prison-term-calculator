import assert from 'node:assert/strict';
import { calculateCase } from './engine';

const base = {
  sentence: { years: 0, months: 0, days: 0 },
  judgmentDate: '2026-01-01',
  pretrialDays: 0,
  imprisonmentStart: '2026-01-01',
  fineAmount: 100000,
  paidBefore: 0,
  paidToday: 0,
  confinementStart: '2026-09-01',
  checkDate: '2026-09-01',
  maxConfinementYears: 1 as 1 | 2,
};

// Smoke tests for the single V3 engine.
{
  const r = calculateCase({ ...base, mode: 'fine' });
  assert.equal(r.fine.rate, 500);
  assert.equal(r.confinement.elapsedDays, 1);
  assert.equal(r.confinement.remainingDays, 199);
}

{
  const r = calculateCase({ ...base, mode: 'imprisonment', sentence: { years: 1, months: 0, days: 0 }, pretrialDays: 45 });
  assert.equal(r.sentence.imprisonmentCreditDays, 45);
  assert.equal(r.sentence.remainingPretrialDays, 0);
}

{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', sentence: { years: 0, months: 0, days: 10 }, pretrialDays: 15 });
  assert.equal(r.sentence.imprisonmentCreditDays, 10);
  assert.equal(r.sentence.remainingPretrialDays, 5);
  assert.equal(r.fine.pretrialFineCredit, 2500);
}

console.log('✓ Engine smoke tests passed');
