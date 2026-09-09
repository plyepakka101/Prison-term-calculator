import assert from 'node:assert/strict';
import { addSentence, calculateCase, inclusiveDays, parseLocalDate } from '../src/engine';

const base = {
  sentence: { years: 0, months: 0, days: 0 }, judgmentDate: '', pretrialDays: 0, imprisonmentStart: '',
  fineAmount: 100000, paidBefore: 0, paidToday: 0, fineRate: 500,
  confinementStart: '2026-09-01', checkDate: '2026-09-01', maxConfinementYears: 1 as 1 | 2,
};

// §30: start day is counted.
assert.equal(inclusiveDays(parseLocalDate('2026-09-01'), parseLocalDate('2026-09-01')), 1);
assert.equal(inclusiveDays(parseLocalDate('2026-09-01'), parseLocalDate('2026-09-10')), 10);

// 1. 100,000 baht => 200 days; first confinement day credits 500 baht.
{
  const r = calculateCase({ ...base, mode: 'fine' });
  assert.equal(r.confinement.elapsedDays, 1); assert.equal(r.fine.confinementCredit, 500);
  assert.equal(r.fine.remaining, 99500); assert.equal(r.confinement.remainingDays, 199);
}

// 2. Pre-trial detention is credited to imprisonment first.
{
  const r = calculateCase({ ...base, mode: 'imprisonFine', judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', sentence: { years: 1, months: 0, days: 0 }, pretrialDays: 45 });
  assert.equal(r.sentence.nominalAllocationDays, 365); assert.equal(r.sentence.imprisonmentCreditDays, 45);
  assert.equal(r.sentence.remainingPretrialDays, 0); assert.equal(r.fine.pretrialFineCredit, 0);
  assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-11-16');
}

// 3. Excess pre-trial detention can then credit the fine.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', sentence: { years: 0, months: 0, days: 10 }, pretrialDays: 15 });
  assert.equal(r.sentence.imprisonmentCreditDays, 10); assert.equal(r.sentence.remainingPretrialDays, 5);
  assert.equal(r.fine.pretrialFineCredit, 2500);
}

// 4. 1 Sep through 10 Sep is 10 credited confinement days.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', judgmentDate: '2026-09-01', sentence: { years: 1, months: 0, days: 0 }, confinementStart: '2026-09-01', checkDate: '2026-09-10', paidToday: 10000 });
  assert.equal(r.confinement.elapsedDays, 10); assert.equal(r.fine.confinementCredit, 5000);
  assert.equal(r.fine.paidToday, 10000); assert.equal(r.fine.remaining, 85000); assert.equal(r.confinement.remainingDays, 170);
}

// 5. Invalid date order gives zero elapsed days.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', confinementStart: '2026-09-10', checkDate: '2026-09-01' });
  assert.equal(r.confinement.elapsedDays, 0); assert.equal(r.fine.confinementCredit, 0);
}

// 6. Current-law conversion rate is fixed at 500 baht/day.
{
  const r = calculateCase({ ...base, mode: 'fine', fineRate: 1000, confinementStart: '', checkDate: '' });
  assert.equal(r.fine.rate, 500); assert.equal(r.confinement.remainingDays, 200);
}

// 7. Fine < 200,000 cannot activate the two-year exception; >= 200,000 can.
{
  const a = calculateCase({ ...base, mode: 'fine', fineAmount: 199999, maxConfinementYears: 2, confinementStart: '', checkDate: '' });
  assert.equal(a.confinement.twoYearEligible, false); assert.equal(a.confinement.maxDays, 365);
  const b = calculateCase({ ...base, mode: 'fine', fineAmount: 200000, maxConfinementYears: 2, confinementStart: '', checkDate: '' });
  assert.equal(b.confinement.twoYearEligible, true); assert.equal(b.confinement.maxDays, 730);
}

// 8. Calendar-year ceiling: 1 Jan 2028 through 31 Dec 2028 is 366 days.
{
  const r = calculateCase({ ...base, mode: 'fine', fineAmount: 183500, maxConfinementYears: 1, confinementStart: '2028-01-01', checkDate: '2028-01-01' });
  assert.equal(r.confinement.maxDays, 366);
}

// 9. One-day sentence ends on its start date.
{
  assert.equal(addSentence(parseLocalDate('2026-05-10'), { years: 0, months: 0, days: 1 })?.toISOString().slice(0,10), '2026-05-10');
}

// 10. One pre-trial day fully credits a one-day sentence.
{
  const r = calculateCase({ ...base, mode: 'imprisonFine', judgmentDate: '2026-05-10', imprisonmentStart: '2026-05-10', sentence: { years: 0, months: 0, days: 1 }, pretrialDays: 1 });
  assert.equal(r.sentence.imprisonmentCreditDays, 1); assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-05-09');
}

// 11. Judgment date is a real engine input and is used as the prison start fallback.
{
  const r = calculateCase({ ...base, mode: 'imprisonFine', judgmentDate: '2026-01-01', imprisonmentStart: '', sentence: { years: 0, months: 0, days: 1 } });
  assert.equal(r.sentence.statutoryEnd?.toISOString().slice(0,10), '2026-01-01');
  assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-01-01');
}

// 12. Payments cannot make the balance negative.
{
  const r = calculateCase({ ...base, mode: 'fine', paidBefore: 90000, paidToday: 999999, confinementStart: '', checkDate: '' });
  assert.equal(r.fine.remaining, 0); assert.equal(r.fine.paidToday, 10000);
}

console.log('✓ All PrisonTermEngine V3 tests passed');
