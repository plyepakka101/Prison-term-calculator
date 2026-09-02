export type CalculationMode='fine'|'imprisonFine'|'imprisonConfinement';
export interface SentenceInput{years:number;months:number;days:number}
export interface CalculationInput{mode:CalculationMode;sentence:SentenceInput;pretrialDays:number;imprisonmentStart:string;fineAmount:number;paidBefore:number;paidToday:number;fineRate:number;confinementStart:string;checkDate:string;maxConfinementYears?:1|2}
const DAY_MS=86400000; const clamp=(n:number)=>Math.max(0,Number.isFinite(n)?n:0);
export const formatSentence=(s:SentenceInput)=>`${s.years||0} ปี ${s.months||0} เดือน ${s.days||0} วัน`;
export const parseLocalDate=(v:string)=>{if(!v)return null;const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?null:d};
export const formatThaiDate=(d:Date|null)=>d?d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'-';
export const inclusiveDays=(a:Date|null,b:Date|null)=>!a||!b||b<a?0:Math.floor((b.getTime()-a.getTime())/DAY_MS)+1;
export const addSentence=(start:Date|null,s:SentenceInput)=>{if(!start)return null;const d=new Date(start);d.setFullYear(d.getFullYear()+clamp(s.years));d.setMonth(d.getMonth()+clamp(s.months));d.setDate(d.getDate()+clamp(s.days));return d};

/** Single business engine used by every UI mode. */
export function calculateCase(input:CalculationInput){
 const needsConfinement=input.mode==='fine'||input.mode==='imprisonConfinement';
 const fineAmount=clamp(input.fineAmount), paidBefore=Math.min(clamp(input.paidBefore),fineAmount), rate=Math.max(1,clamp(input.fineRate)||500);
 const initialFineRemaining=Math.max(0,fineAmount-paidBefore), pretrialDays=clamp(input.pretrialDays);
 // Allocation is centralized: pre-trial custody is applied to imprisonment first when imprisonment exists.
 const allocationDays=clamp(input.sentence.years)*365+clamp(input.sentence.months)*30+clamp(input.sentence.days);
 const imprisonmentCreditDays=input.mode==='fine'?0:Math.min(pretrialDays,allocationDays);
 const remainingPretrialDays=input.mode==='fine'?pretrialDays:Math.max(0,pretrialDays-imprisonmentCreditDays);
 const pretrialFineCredit=Math.min(initialFineRemaining,remainingPretrialDays*rate);
 const confinementStart=parseLocalDate(input.confinementStart),checkDate=parseLocalDate(input.checkDate);
 const elapsedDays=needsConfinement?inclusiveDays(confinementStart,checkDate):0;
 const fineAfterPretrial=Math.max(0,initialFineRemaining-pretrialFineCredit);
 const confinementCredit=Math.min(fineAfterPretrial,elapsedDays*rate);
 const fineBeforeToday=Math.max(0,fineAfterPretrial-confinementCredit);
 const paidToday=Math.min(clamp(input.paidToday),fineBeforeToday);
 const fineRemaining=Math.max(0,fineBeforeToday-paidToday);
 const remainingDays=needsConfinement?Math.ceil(fineRemaining/rate):0;
 const maximumYears=input.maxConfinementYears||1,maximumDays=maximumYears*365;
 const exceedsMaximum=needsConfinement&&remainingDays>maximumDays;
 const projectedEnd=remainingDays&&checkDate?new Date(checkDate.getTime()+(remainingDays-1)*DAY_MS):null;
 const imprisonmentStart=parseLocalDate(input.imprisonmentStart),statutoryEnd=input.mode==='fine'?null:addSentence(imprisonmentStart,input.sentence);
 const projectedImprisonmentRelease=statutoryEnd?new Date(statutoryEnd.getTime()-imprisonmentCreditDays*DAY_MS):null;
 return {mode:input.mode,sentence:{...input.sentence,nominalAllocationDays:allocationDays,pretrialDays,imprisonmentCreditDays,remainingPretrialDays,statutoryEnd,projectedRelease:projectedImprisonmentRelease},fine:{original:fineAmount,paidBefore,initialRemaining:initialFineRemaining,pretrialFineCredit,confinementCredit,paidToday,fineBeforeToday,remaining:fineRemaining},confinement:{rate,start:confinementStart,checkDate,elapsedDays,remainingDays,maximumYears,maximumDays,exceedsMaximum,projectedEnd},status:fineRemaining===0?'PAID':'ACTIVE'} as const;
}