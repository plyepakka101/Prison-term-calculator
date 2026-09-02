import assert from 'node:assert/strict';
import { calculateCase } from '../src/engine';

const base = {
  sentence: { years: 0, months: 0, days: 0 },
  pretrialDays: 0,
  imprisonmentStart: '',
  fineAmount: 100000,
  paidBefore: 0,
  paidToday: 0,
  fineRate: 500,
  confinementStart: '2026-09-01',
  checkDate: '2026-09-01',
  maxConfinementYears: 1 as 1 | 2,
};

// 1) กักขังแทนค่าปรับ: 100,000 / 500 = 200 วัน
{
  const r = calculateCase({ ...base, mode: 'fine' });
  assert.equal(r.fine.remaining, 100000);
  assert.equal(r.confinement.remainingDays, 0, 'fine-only mode does not project post-check confinement until an explicit confinement period is entered');
}

// 2) จำคุกและปรับ: วันคุมขังก่อนพิพากษาถูกจัดสรรเข้าจำคุกก่อน
{
  const r = calculateCase({ ...base, mode: 'imprisonFine', sentence: { years: 1, months: 0, days: 0 }, pretrialDays: 45 });
  assert.equal(r.sentence.imprisonmentCreditDays, 45);
  assert.equal(r.sentence.remainingPretrialDays, 0);
  assert.equal(r.fine.pretrialFineCredit, 0);
}

// 3) จำคุกและกักขังแทนค่าปรับ: 10 วันกักขัง = เครดิต 5,000 บาท; ชำระเพิ่ม 10,000 => เหลือ 85,000 = 170 วัน
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', sentence: { years: 1, months: 0, days: 0 }, pretrialDays: 0, confinementStart: '2026-09-01', checkDate: '2026-09-10', paidToday: 10000 });
  assert.equal(r.confinement.elapsedDays, 10);
  assert.equal(r.fine.confinementCredit, 5000);
  assert.equal(r.fine.paidToday, 10000);
  assert.equal(r.fine.remaining, 85000);
  assert.equal(r.confinement.remainingDays, 170);
}

// Date validation: check date before start must not produce negative elapsed days.
{
  const r = calculateCase({ ...base, mode: 'imprisonConfinement', confinementStart: '2026-09-10', checkDate: '2026-09-01' });
  assert.equal(r.confinement.elapsedDays, 0);
  assert.equal(r.fine.confinementCredit, 0);
}

console.log('✓ All PrisonTermEngine tests passed');
