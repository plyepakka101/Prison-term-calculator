export type CalculationMode='fine'|'imprisonFine'|'imprisonConfinement';
export interface SentenceInput{years:number;months:number;days:number}
export interface CalculationInput{mode:CalculationMode;sentence:SentenceInput;pretrialDays:number;imprisonmentStart:string;fineAmount:number;paidBefore:number;paidToday:number;fineRate:number;confinementStart:string;checkDate:string;maxConfinementYears:1|2}
export interface CalculationResult{mode:CalculationMode;sentence:{years:number;months:number;days:number;nominalAllocationDays:number;pretrialDays:number;imprisonmentCreditDays:number;remainingPretrialDays:number;statutoryEnd:Date|null;projectedRelease:Date|null};fine:{amount:number;paidBefore:number;pretrialFineCredit:number;confinementCredit:number;paidToday:number;remaining:number;remaining_baht:string;outstanding_baht:string};confinement:{elapsedDays:number;remainingDays:number;maxDays:number;exceedsMaximum:boolean;projectedEnd:Date|null;projectedEnd_thai:string}}

const MS = 86400000;
const toUTC = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

// นับแบบรวมวันแรกเป็น 1 วันเต็ม (ป.อาญา ม.21)
const daysInclusive = (a, b) => Math.floor((toUTC(b) - toUTC(a)) / MS) + 1;

// ครบ n วัน => วันสุดท้ายของโทษ
const addDaysInclusive = (start, n) => {
  const d = new Date(start);
  d.setDate(d.getDate() + n - 1);
  return d;
};

const clamp=(n:number)=>Math.max(0,Number.isFinite(n)?n:0);
export const formatSentence=(s:SentenceInput)=>`${s.years||0} ปี ${s.months||0} เดือน ${s.days||0} วัน`;
export const parseLocalDate=(v:string)=>{if(!v)return null;const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?null:d};
export const formatThaiDate=(d:Date|null)=>d?d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'-';
export const inclusiveDays=(a:Date|null,b:Date|null)=>!a||!b||b<a?0:Math.floor((b.getTime()-a.getTime())/MS)+1;
export const addSentence=(start:Date|null,s:SentenceInput)=>{if(!start)return null;const d=new Date(start);d.setFullYear(d.getFullYear()+clamp(s.years));d.setMonth(d.getMonth()+clamp(s.months));d.setDate(d.getDate()+clamp(s.days));return d};

/** Single business engine used by every UI mode. */
export function calculateCase({ preStart, preEnd, detStart, checkDate, fine, paid, rate = 500 }: {
  preStart: Date;
  preEnd: Date;
  detStart: Date;
  checkDate: Date;
  fine: number;
  paid: number;
  rate?: number;
}): {
  creditDays: number;
  usedDays: number;
  remainingFine: number;
  remainingDays: number;
  releaseDate: Date;
} {
  const preDays    = daysInclusive(preStart, preEnd);
  const servedDays = daysInclusive(detStart, checkDate);

  // ✅ FIX 1: ตัดวันที่คาบเกี่ยวกัน ไม่ให้นับซ้ำ
  const ovStart = Math.max(toUTC(preStart), toUTC(detStart));
  const ovEnd   = Math.min(toUTC(preEnd),  toUTC(checkDate));
  const overlap = ovEnd >= ovStart ? Math.floor((ovEnd - ovStart) / MS) + 1 : 0;

  const creditDays = preDays + servedDays - overlap;

  const fineAfterPaid  = Math.max(0, fine - paid);
  const totalDaysNeed  = Math.ceil(fineAfterPaid / rate);
  const usedDays       = Math.min(creditDays, totalDaysNeed);   // ✅ FIX 2: ไม่ให้เครดิตเกินโทษ
  const remainingFine  = fineAfterPaid - usedDays * rate;
  const remainingDays  = Math.ceil(remainingFine / rate);

  // ✅ FIX 3: วันพ้นโทษนับจากวันเริ่มกักขัง โดยหักวันคุมขังก่อนพิพากษาที่ไม่ซ้ำ
  const netNeed = totalDaysNeed - (preDays - overlap);
  return {
    creditDays, usedDays, remainingFine, remainingDays,
    releaseDate: addDaysInclusive(detStart, netNeed)
  };
}
