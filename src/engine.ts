export type CalculationMode = 'fine' | 'imprisonment' | 'imprisonConfinement';

export interface SentenceInput { years: number; months: number; days: number }
export interface CalculationInput {
  mode: CalculationMode; sentence: SentenceInput; judgmentDate: string; pretrialDays: number;
  imprisonmentStart: string; fineAmount: number; paidBefore: number; paidToday: number;
  confinementStart: string; checkDate: string; maxConfinementYears: 1 | 2;
}
export interface CalculationResult {
  mode: CalculationMode;
  sentence: { years:number; months:number; days:number; nominalAllocationDays:number; pretrialDays:number;
    imprisonmentCreditDays:number; remainingPretrialDays:number; remainingDays:number;
    statutoryEnd:Date|null; projectedRelease:Date|null };
  fine: { initialRemaining:number; amount:number; paidBefore:number; pretrialFineCredit:number;
    confinementCredit:number; paidToday:number; remaining:number; rate:number };
  confinement: { elapsedDays:number; remainingDays:number; maxDays:number; maxEnd:Date|null;
    exceedsMaximum:boolean; twoYearEligible:boolean; projectedEnd:Date|null };
  status: 'PAID' | 'PENDING';
}

const DAY_MS = 86400000;
const FINE_RATE = 500;
const clamp = (n:number) => Math.max(0, Number.isFinite(n) ? n : 0);
const integer = (n:number) => Math.floor(clamp(n));
const dateOnly = (d:Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const formatSentence = (s:SentenceInput) => `${integer(s.years)} ปี ${integer(s.months)} เดือน ${integer(s.days)} วัน`;
export const parseLocalDate = (v:string) => {
  if (!v) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return null;
  const [, year, month, day] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.getFullYear() === Number(year) && d.getMonth() === Number(month) - 1 && d.getDate() === Number(day) ? d : null;
};
export const formatThaiDate = (d:Date|null) => {
  if (!d) return '-';
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear()+543}`;
};

/** วันเริ่มนับรวมเป็นวันแรก */
export const inclusiveDays = (a:Date|null,b:Date|null) => {
  if (!a || !b || b < a) return 0;
  return Math.floor((dateOnly(b).getTime()-dateOnly(a).getTime())/DAY_MS)+1;
};

/** วันสิ้นสุดของโทษที่ระบุเป็นปี/เดือน/วัน โดยใช้ปฏิทินและไม่ให้วันที่เกิน */
export const addSentence = (start:Date|null,s:SentenceInput) => {
  if (!start) return null;
  const y=integer(s.years), m=integer(s.months), days=integer(s.days);
  const base=dateOnly(start);
  const totalMonths=base.getMonth()+y*12+m;
  const targetYear=base.getFullYear()+Math.floor(totalMonths/12);
  const targetMonth=((totalMonths%12)+12)%12;
  const lastDay=new Date(targetYear,targetMonth+1,0).getDate();
  const end=new Date(targetYear,targetMonth,Math.min(base.getDate(),lastDay));
  end.setDate(end.getDate()+days-1);
  return end;
};
const subtractDays=(d:Date,n:number)=>{const r=dateOnly(d);r.setDate(r.getDate()-integer(n));return r};
const addDays=(d:Date,n:number)=>{const r=dateOnly(d);r.setDate(r.getDate()+integer(n));return r};

/** Engine เดียวของระบบ: ป.อ. มาตรา 30 ใช้อัตรา 500 บาท/วัน */
export function calculateCase(input:CalculationInput):CalculationResult {
  const needsConfinement=input.mode==='fine'||input.mode==='imprisonConfinement';
  const needsImprisonment=input.mode!=='fine';
  const fineAmount=input.mode==='imprisonment'?0:clamp(input.fineAmount);
  const paidBefore=Math.min(clamp(input.paidBefore),fineAmount);
  const initialFineRemaining=Math.max(0,fineAmount-paidBefore);
  const pretrialDays=integer(input.pretrialDays);

  const judgmentDate=parseLocalDate(input.judgmentDate);
  const imprisonmentStart=parseLocalDate(input.imprisonmentStart)||judgmentDate;
  const statutoryEnd=needsImprisonment?addSentence(imprisonmentStart,input.sentence):null;
  const calendarSentenceDays=statutoryEnd&&imprisonmentStart?inclusiveDays(imprisonmentStart,statutoryEnd):0;
  const fallbackSentenceDays=integer(input.sentence.years)*365+integer(input.sentence.months)*30+integer(input.sentence.days);
  const nominalAllocationDays=calendarSentenceDays||fallbackSentenceDays;

  // จำคุก + ปรับ: หักวันคุมขังก่อนพิพากษาจากโทษจำคุกก่อน เหลือเท่าใดจึงหักจากปรับ
  const imprisonmentCreditDays=input.mode==='fine'?0:Math.min(pretrialDays,nominalAllocationDays);
  const remainingPretrialDays=input.mode==='fine'?pretrialDays:Math.max(0,pretrialDays-imprisonmentCreditDays);
  const pretrialFineCredit=input.mode==='imprisonment'?0:Math.min(initialFineRemaining,remainingPretrialDays*FINE_RATE);

  const confinementStart=parseLocalDate(input.confinementStart);
  const checkDate=parseLocalDate(input.checkDate);
  const elapsedDays=needsConfinement?inclusiveDays(confinementStart,checkDate):0;
  const fineAfterPretrial=Math.max(0,initialFineRemaining-pretrialFineCredit);
  const confinementCredit=Math.min(fineAfterPretrial,elapsedDays*FINE_RATE);
  const fineBeforeToday=Math.max(0,fineAfterPretrial-confinementCredit);
  const paidToday=Math.min(clamp(input.paidToday),fineBeforeToday);
  const fineRemaining=Math.max(0,fineBeforeToday-paidToday);
  const remainingConfinementDays=needsConfinement?Math.ceil(fineRemaining/FINE_RATE):0;

  const twoYearEligible=fineAmount>=200000;
  const maxYears=input.maxConfinementYears===2&&twoYearEligible?2:1;
  const maxEnd=confinementStart?subtractDays(new Date(confinementStart.getFullYear()+maxYears,confinementStart.getMonth(),confinementStart.getDate()),1):null;
  const maxDays=confinementStart?inclusiveDays(confinementStart,maxEnd):maxYears*365;
  const exceedsMaximum=needsConfinement&&remainingConfinementDays>maxDays;

  // checkDate คือวันสุดท้ายที่รับเครดิตแล้ว ดังนั้นวันคงเหลือวันแรกคือ checkDate + 1
  // วันพ้นโทษคือวันถัดจากวันที่รับโทษครบ
  const projectedConfinementEnd=remainingConfinementDays>0&& (checkDate||confinementStart)
    ? addDays(checkDate||confinementStart!,remainingConfinementDays)
    : (needsConfinement&&fineRemaining===0
      ? (confinementStart ? addDays(confinementStart, Math.ceil(fineAfterPretrial/FINE_RATE)) : (checkDate ? addDays(checkDate,1) : null))
      : null);
  const remainingSentenceDays=needsImprisonment?Math.max(0,nominalAllocationDays-imprisonmentCreditDays):0;
  // imprisonmentStart คือวันแรกของโทษ (นับรวม) วันพ้นโทษคือวันถัดจากวันสุดท้าย
  const projectedRelease=needsImprisonment&&imprisonmentStart
    ?(remainingSentenceDays>0?addDays(imprisonmentStart,remainingSentenceDays):imprisonmentStart)
    :null;
  const complete=(needsImprisonment?remainingSentenceDays===0:true) && fineRemaining===0 && (!needsConfinement||remainingConfinementDays===0);

  return {
    mode:input.mode,
    sentence:{...input.sentence,nominalAllocationDays,pretrialDays,imprisonmentCreditDays,remainingPretrialDays,remainingDays:remainingSentenceDays,statutoryEnd,projectedRelease},
    fine:{initialRemaining:initialFineRemaining,amount:fineAmount,paidBefore,pretrialFineCredit,confinementCredit,paidToday,remaining:fineRemaining,rate:FINE_RATE},
    confinement:{elapsedDays,remainingDays:remainingConfinementDays,maxDays,maxEnd,exceedsMaximum,twoYearEligible,projectedEnd:projectedConfinementEnd},
    status:complete?'PAID':'PENDING',
  };
}
