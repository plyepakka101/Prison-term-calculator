export type CalculationMode='fine'|'imprisonFine'|'imprisonConfinement';
export interface SentenceInput{years:number;months:number;days:number}
export interface CalculationInput{mode:CalculationMode;sentence:SentenceInput;judgmentDate:string;pretrialDays:number;imprisonmentStart:string;fineAmount:number;paidBefore:number;paidToday:number;fineRate?:number;confinementStart:string;checkDate:string;maxConfinementYears:1|2}
export interface CalculationResult{mode:CalculationMode;sentence:{years:number;months:number;days:number;nominalAllocationDays:number;pretrialDays:number;imprisonmentCreditDays:number;remainingPretrialDays:number;statutoryEnd:Date|null;projectedRelease:Date|null};fine:{initialRemaining:number;amount:number;paidBefore:number;pretrialFineCredit:number;confinementCredit:number;paidToday:number;remaining:number;rate:number};confinement:{elapsedDays:number;remainingDays:number;maxDays:number;maxEnd:Date|null;exceedsMaximum:boolean;twoYearEligible:boolean;projectedEnd:Date|null};status:'PAID'|'PENDING'}

const DAY_MS=86400000;
const clamp=(n:number)=>Math.max(0,Number.isFinite(n)?n:0);
const dateOnly=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());

export const formatSentence=(s:SentenceInput)=>`${s.years||0} ปี ${s.months||0} เดือน ${s.days||0} วัน`;
export const parseLocalDate=(v:string)=>{if(!v)return null;const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?null:d};
export const formatThaiDate=(d:Date|null)=>d?d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'-';

/** Inclusive day count: the first day is day 1, consistent with Penal Code section 30. */
export const inclusiveDays=(a:Date|null,b:Date|null)=>!a||!b||b<a?0:Math.floor((dateOnly(b).getTime()-dateOnly(a).getTime())/DAY_MS)+1;

/** Add a sentence expressed as calendar years/months/days and return its inclusive final day. */
export const addSentence=(start:Date|null,s:SentenceInput)=>{if(!start)return null;const d=dateOnly(start);d.setFullYear(d.getFullYear()+clamp(s.years));d.setMonth(d.getMonth()+clamp(s.months));d.setDate(d.getDate()+clamp(s.days));d.setDate(d.getDate()-1);return d};

const subtractDays=(d:Date,n:number)=>{const r=dateOnly(d);r.setDate(r.getDate()-n);return r};
const inclusiveTermDays=(start:Date|null,years:number)=>{if(!start||years<=0)return 0;const end=subtractDays(new Date(dateOnly(start).getFullYear()+years,dateOnly(start).getMonth(),dateOnly(start).getDate()),1);return inclusiveDays(start,end)};

/** Single business engine for V3. Current Thai law: fine conversion is fixed at 500 baht/day. */
export function calculateCase(input:CalculationInput){
  const needsConfinement=input.mode==='fine'||input.mode==='imprisonConfinement';
  const fineAmount=clamp(input.fineAmount);
  const paidBefore=Math.min(clamp(input.paidBefore),fineAmount);
  const rate=500;
  const initialFineRemaining=Math.max(0,fineAmount-paidBefore);
  const pretrialDays=Math.floor(clamp(input.pretrialDays));

  const judgmentDate=parseLocalDate(input.judgmentDate);
  const imprisonmentStart=parseLocalDate(input.imprisonmentStart)||judgmentDate;
  const sentenceEnd=addSentence(imprisonmentStart,input.sentence);
  const calendarSentenceDays=imprisonmentStart&&sentenceEnd?inclusiveDays(imprisonmentStart,sentenceEnd):0;
  const fallbackSentenceDays=clamp(input.sentence.years)*365+clamp(input.sentence.months)*30+clamp(input.sentence.days);
  const allocationDays=calendarSentenceDays||fallbackSentenceDays;

  // When both imprisonment and a fine exist, pre-trial detention is allocated to imprisonment first.
  const imprisonmentCreditDays=input.mode==='fine'?0:Math.min(pretrialDays,allocationDays);
  const remainingPretrialDays=input.mode==='fine'?pretrialDays:Math.max(0,pretrialDays-imprisonmentCreditDays);
  const pretrialFineCredit=Math.min(initialFineRemaining,remainingPretrialDays*rate);

  const confinementStart=parseLocalDate(input.confinementStart);
  const checkDate=parseLocalDate(input.checkDate);
  const elapsedDays=needsConfinement?inclusiveDays(confinementStart,checkDate):0;
  const fineAfterPretrial=Math.max(0,initialFineRemaining-pretrialFineCredit);
  const confinementCredit=Math.min(fineAfterPretrial,elapsedDays*rate);
  const fineBeforeToday=Math.max(0,fineAfterPretrial-confinementCredit);
  const paidToday=Math.min(clamp(input.paidToday),fineBeforeToday);
  const fineRemaining=Math.max(0,fineBeforeToday-paidToday);
  const remainingDays=needsConfinement?Math.ceil(fineRemaining/rate):0;

  const twoYearEligible=fineAmount>=200000;
  const requestedMaximumYears=input.maxConfinementYears===2&&twoYearEligible?2:1;
  const maxEnd=confinementStart?subtractDays(new Date(confinementStart.getFullYear()+requestedMaximumYears,confinementStart.getMonth(),confinementStart.getDate()),1):null;
  const maximumDays=confinementStart?inclusiveDays(confinementStart,maxEnd):inclusiveTermDays(confinementStart,requestedMaximumYears);
  const exceedsMaximum=needsConfinement&&remainingDays>(maximumDays||requestedMaximumYears*365);
  const projectedEnd=remainingDays&&checkDate?new Date(dateOnly(checkDate).getTime()+(remainingDays-1)*DAY_MS):null;

  // Release is the inclusive sentence end after subtracting credited pre-trial detention.
  const projectedImprisonmentRelease=sentenceEnd&&input.mode!=='fine'?subtractDays(sentenceEnd,imprisonmentCreditDays):null;

  return {mode:input.mode,sentence:{...input.sentence,nominalAllocationDays:allocationDays,pretrialDays,imprisonmentCreditDays,remainingPretrialDays,statutoryEnd:input.mode==='fine'?null:sentenceEnd,projectedRelease:projectedImprisonmentRelease},fine:{initialRemaining:initialFineRemaining,amount:fineAmount,paidBefore,pretrialFineCredit,confinementCredit,paidToday,remaining:fineRemaining,rate},confinement:{elapsedDays,remainingDays,maxDays:maximumDays,maxEnd,exceedsMaximum,twoYearEligible,projectedEnd},status:fineRemaining===0&&(input.mode==='fine'||!needsConfinement)?'PAID':'PENDING'};
}
