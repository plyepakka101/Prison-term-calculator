import assert from 'node:assert/strict';
import { addSentence, calculateCase, inclusiveDays, parseLocalDate } from '../src/engine';

const base = {
  sentence: { years: 0, months: 0, days: 0 },
  judgmentDate: '', pretrialDays: 0, imprisonmentStart: '',
  fineAmount: 100000, paidBefore: 0, paidToday: 0,
  confinementStart: '2026-09-01', checkDate: '2026-09-01', maxConfinementYears: 1 as 1 | 2,
};

assert.equal(inclusiveDays(parseLocalDate('2026-09-01'), parseLocalDate('2026-09-01')), 1);
assert.equal(inclusiveDays(parseLocalDate('2026-09-01'), parseLocalDate('2026-09-10')), 10);

// 1. Fine-only: 100,000 baht = 200 confinement days; first day credits 500 baht.
{
  const r = calculateCase({ ...base, mode: 'fine' });
  assert.equal(r.confinement.elapsedDays, 1); assert.equal(r.fine.confinementCredit, 500);
  assert.equal(r.fine.remaining, 99500); assert.equal(r.confinement.remainingDays, 199);
}

// 2. Imprisonment-only: pretrial detention is credited to imprisonment first.
{
  const r = calculateCase({ ...base, mode: 'imprisonment', judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', sentence: { years: 1, months: 0, days: 0 }, pretrialDays: 45 });
  assert.equal(r.sentence.nominalAllocationDays, 365); assert.equal(r.sentence.imprisonmentCreditDays, 45);
  assert.equal(r.sentence.remainingPretrialDays, 0); assert.equal(r.fine.remaining, 0);
  assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-11-16');
}

// 3. Combined case: 10-day imprisonment + 15 pretrial days => 5 days credit the fine.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', sentence: { years: 0, months: 0, days: 10 }, pretrialDays: 15 });
  assert.equal(r.sentence.imprisonmentCreditDays, 10); assert.equal(r.sentence.remainingPretrialDays, 5);
  assert.equal(r.fine.pretrialFineCredit, 2500);
}

// 4. 1 Sep through 10 Sep = 10 confinement days; remaining 85,000 = 170 days.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', judgmentDate: '2026-09-01', sentence: { years: 1, months: 0, days: 0 }, confinementStart: '2026-09-01', checkDate: '2026-09-10', paidToday: 10000 });
  assert.equal(r.confinement.elapsedDays, 10); assert.equal(r.fine.confinementCredit, 5000);
  assert.equal(r.fine.paidToday, 10000); assert.equal(r.fine.remaining, 85000); assert.equal(r.confinement.remainingDays, 170);
  assert.equal(r.confinement.projectedEnd?.toISOString().slice(0,10), '2027-02-27');
}

// 5. Invalid date order gives zero confinement credit.
{
  const r = calculateCase({ ...base, mode: 'fine', confinementStart: '2026-09-10', checkDate: '2026-09-01' });
  assert.equal(r.confinement.elapsedDays, 0); assert.equal(r.fine.confinementCredit, 0);
}

// 6. Engine fixes the legal conversion rate at 500 baht/day.
{
  const r = calculateCase({ ...base, mode: 'fine', confinementStart: '', checkDate: '' });
  assert.equal(r.fine.rate, 500); assert.equal(r.confinement.remainingDays, 200);
}

// 7. Fine < 200,000 cannot use the two-year exception; >= 200,000 can.
{
  const a = calculateCase({ ...base, mode: 'fine', fineAmount: 199999, maxConfinementYears: 2, confinementStart: '', checkDate: '' });
  assert.equal(a.confinement.twoYearEligible, false); assert.equal(a.confinement.maxDays, 365);
  const b = calculateCase({ ...base, mode: 'fine', fineAmount: 200000, maxConfinementYears: 2, confinementStart: '', checkDate: '' });
  assert.equal(b.confinement.twoYearEligible, true); assert.equal(b.confinement.maxDays, 730);
}

// 8. Calendar ceiling: 1 Jan 2028 through 31 Dec 2028 = 366 days.
{
  const r = calculateCase({ ...base, mode: 'fine', fineAmount: 183500, confinementStart: '2028-01-01', checkDate: '2028-01-01' });
  assert.equal(r.confinement.maxDays, 366);
}

// 9. One-day sentence ends on its start date.
assert.equal(addSentence(parseLocalDate('2026-05-10'), { years: 0, months: 0, days: 1 })?.toISOString().slice(0,10), '2026-05-10');

// 10. One pretrial day fully credits a one-day sentence.
{
  const r = calculateCase({ ...base, mode: 'imprisonment', judgmentDate: '2026-05-10', imprisonmentStart: '2026-05-10', sentence: { years: 0, months: 0, days: 1 }, pretrialDays: 1 });
  assert.equal(r.sentence.imprisonmentCreditDays, 1); assert.equal(r.sentence.remainingDays, 0);
  assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-05-09');
}

// 11. Judgment date is used as prison start when imprisonmentStart is omitted.
{
  const r = calculateCase({ ...base, mode: 'imprisonment', judgmentDate: '2026-01-01', imprisonmentStart: '', sentence: { years: 0, months: 0, days: 1 } });
  assert.equal(r.sentence.statutoryEnd?.toISOString().slice(0,10), '2026-01-01');
  assert.equal(r.sentence.projectedRelease?.toISOString().slice(0,10), '2026-01-01');
}

// 12. Payments cannot make the balance negative.
{
  const r = calculateCase({ ...base, mode: 'fine', paidBefore: 90000, paidToday: 999999, confinementStart: '', checkDate: '' });
  assert.equal(r.fine.paidToday, 10000); assert.equal(r.fine.remaining, 0); assert.equal(r.confinement.remainingDays, 0);
}

// 13. Imprisonment-only never consumes confinement days or fine credit.
{
  const r = calculateCase({ ...base, mode: 'imprisonment', sentence: { years: 0, months: 0, days: 10 }, judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', pretrialDays: 15, confinementStart: '2026-01-01', checkDate: '2026-01-10' });
  assert.equal(r.fine.remaining, 0); assert.equal(r.confinement.elapsedDays, 0);
  assert.equal(r.sentence.imprisonmentCreditDays, 10); assert.equal(r.sentence.remainingPretrialDays, 5);
}

// 14. Combined case applies pretrial credit to the remaining fine after prior payment.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', fineAmount: 100000, paidBefore: 20000, pretrialDays: 15, sentence: { years: 0, months: 0, days: 10 }, judgmentDate: '2026-01-01', imprisonmentStart: '2026-01-01', confinementStart: '2026-09-01', checkDate: '2026-09-02' });
  assert.equal(r.fine.initialRemaining, 80000); assert.equal(r.fine.pretrialFineCredit, 2500);
  assert.equal(r.fine.confinementCredit, 1000); assert.equal(r.fine.remaining, 76500); assert.equal(r.confinement.remainingDays, 153);
}

console.log('✓ All PrisonTermEngine V3.1 regression tests passed');
