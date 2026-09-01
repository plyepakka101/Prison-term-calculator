export type CalculationMode = 'fine' | 'imprisonFine' | 'imprisonConfinement';

export interface SentenceInput {
  years: number;
  months: number;
  days: number;
}

export interface CalculationInput {
  mode: CalculationMode;
  sentence: SentenceInput;
  pretrialDays: number;
  imprisonmentStart: string;
  fineAmount: number;
  paidBefore: number;
  paidToday: number;
  fineRate: number;
  confinementStart: string;
  checkDate: string;
  maxConfinementYears: 1 | 2;
}

const DAY_MS = 86_400_000;
const clamp = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);

export const formatSentence = (s: SentenceInput) => `${s.years || 0} ปี ${s.months || 0} เดือน ${s.days || 0} วัน`;

export const parseLocalDate = (value: string) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatThaiDate = (value: Date | null) => {
  if (!value) return '-';
  return value.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Inclusive day count: the starting day counts as one day. */
export const inclusiveDays = (start: Date | null, end: Date | null) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
};

/** Add a statutory sentence expressed as years/months/days without converting months to 30 days. */
export const addSentence = (start: Date | null, sentence: SentenceInput) => {
  if (!start) return null;
  const d = new Date(start);
  const originalDay = d.getDate();
  d.setFullYear(d.getFullYear() + clamp(sentence.years));
  if (d.getMonth() !== start.getMonth() && originalDay > 28) d.setDate(0);
  d.setMonth(d.getMonth() + clamp(sentence.months));
  d.setDate(d.getDate() + clamp(sentence.days));
  return d;
};

/**
 * One engine is used by all three modes.
 * Business rules are intentionally centralized here; UI only renders the result.
 */
export function calculateCase(input: CalculationInput) {
  const fineAmount = clamp(input.fineAmount);
  const paidBefore = Math.min(clamp(input.paidBefore), fineAmount);
  const paidTodayRequested = clamp(input.paidToday);
  const rate = Math.max(1, clamp(input.fineRate) || 500);
  const pretrialDays = clamp(input.pretrialDays);
  const initialFineRemaining = Math.max(0, fineAmount - paidBefore);

  // For cases containing imprisonment, pre-trial custody is allocated to imprisonment first.
  // Remaining custody days may then be credited against the fine at the statutory rate.
  const sentenceDaysForAllocation =
    clamp(input.sentence.years) * 365 + clamp(input.sentence.months) * 30 + clamp(input.sentence.days);
  const imprisonmentCreditDays = input.mode === 'fine' ? 0 : Math.min(pretrialDays, sentenceDaysForAllocation);
  const remainingPretrialForFine = input.mode === 'fine' ? 0 : Math.max(0, pretrialDays - imprisonmentCreditDays);
  const pretrialFineCredit = Math.min(initialFineRemaining, remainingPretrialForFine * rate);

  // Only the third mode has post-sentence confinement in this V2 workflow.
  const confinementStart = parseLocalDate(input.confinementStart);
  const checkDate = parseLocalDate(input.checkDate);
  const elapsedConfinementDays = input.mode === 'imprisonConfinement'
    ? inclusiveDays(confinementStart, checkDate)
    : 0;
  const fineAfterPretrialCredit = Math.max(0, initialFineRemaining - pretrialFineCredit);
  const elapsedConfinementCredit = Math.min(fineAfterPretrialCredit, elapsedConfinementDays * rate);
  const fineBeforeToday = Math.max(0, fineAfterPretrialCredit - elapsedConfinementCredit);
  const paidToday = Math.min(paidTodayRequested, fineBeforeToday);
  const fineRemaining = Math.max(0, fineBeforeToday - paidToday);
  const remainingConfinementDays = input.mode === 'imprisonConfinement' ? Math.ceil(fineRemaining / rate) : 0;

  const imprisonmentStart = parseLocalDate(input.imprisonmentStart);
  const statutoryImprisonmentEnd = input.mode === 'fine' ? null : addSentence(imprisonmentStart, input.sentence);
  const imprisonmentRelease = statutoryImprisonmentEnd
    ? new Date(statutoryImprisonmentEnd.getTime() - imprisonmentCreditDays * DAY_MS)
    : null;

  const confinementEnd = remainingConfinementDays > 0 && checkDate
    ? new Date(checkDate.getTime() + (remainingConfinementDays - 1) * DAY_MS)
    : null;

  return {
    mode: input.mode,
    sentence: {
      ...input.sentence,
      nominalAllocationDays: sentenceDaysForAllocation,
      pretrialDays,
      imprisonmentCreditDays,
      remainingSentenceDaysForAllocation: Math.max(0, sentenceDaysForAllocation - imprisonmentCreditDays),
      statutoryEnd: statutoryImprisonmentEnd,
      projectedRelease: imprisonmentRelease,
    },
    fine: {
      original: fineAmount,
      paidBefore,
      initialRemaining: initialFineRemaining,
      pretrialFineCredit,
      confinementCredit: elapsedConfinementCredit,
      paidToday,
      fineBeforeToday,
      remaining: fineRemaining,
    },
    confinement: {
      rate,
      start: confinementStart,
      checkDate,
      elapsedDays: elapsedConfinementDays,
      remainingDays: remainingConfinementDays,
      maximumYears: input.maxConfinementYears,
      maximumDays: input.maxConfinementYears * 365,
      projectedEnd: confinementEnd,
    },
    status: fineRemaining === 0 ? 'PAID' : 'ACTIVE',
  } as const;
}
