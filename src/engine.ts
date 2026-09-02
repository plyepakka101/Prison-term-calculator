export type CalculationMode='fine'|'imprisonFine'|'imprisonConfinement';
export interface SentenceInput{years:number;months:number;days:number}
export interface CalculationInput{mode:CalculationMode;sentence:SentenceInput;pretrialDays:number;imprisonmentStart:string;fineAmount:number;paidBefore:number;paidToday:number;fineRate:number;confinementStart:string;checkDate:string;maxConfinementYears?:1|2}
const DAY_MS=86400000; const clamp=(n:number)=>Math.max(0,Number.isFinite(n)?n:0);
export const formatSentence=(s:SentenceInput)=>`${s.years||0} ปี ${s.months||0} เดือน ${s.days||0} วัน`;
export const parseLocalDate=(v:string)=>{if(!v)return null;const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?null:d};
export const formatThaiDate=(d:Date|null)=>d?d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'-';
export const inclusiveDays=(a:Date|null,b:Date|null)=>!a||!b?0:Math.max(0,Math.floor((b.getTime()-a.getTime())/DAY_MS)+1);
export const addSentence=(start:Date|null,s:SentenceInput)=>{if(!start)return null;const d=new Date(start);const day=d.getDate();d.setFullYear(d.getFullYear()+clamp(s.years));if(d.getMonth()!==start.getMonth()){d.setMonth(start.getMonth());d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}d.setMonth(d.getMonth()+clamp(s.months));d.setDate(d.getDate()+clamp(s.days));return d};

/** Shared business engine. All three UI modes call this function; UI contains no business formulas. */
export function calculateCase(input:CalculationInput){
 const fineAmount=clamp(input.fineAmount),paidBefore=Math.min(clamp(input.paidBefore),fineAmount),paidTodayRequested=clamp(input.paidToday),rate=Math.max(1,clamp(input.fineRate)||500),pretrialDays=clamp(input.pretrialDays);
 const initialFineRemaining=Math.max(0,fineAmount-paidBefore);
 const sentenceDaysForAllocation=clamp(input.sentence.years)*365+clamp(input.sentence.months)*30+clamp(input.sentence.days);
 const imprisonmentCreditDays=input.mode==='fine'?0:Math.min(pretrialDays,sentenceDaysForAllocation);
 const remainingPretrialForFine=Math.max(0,pretrialDays-imprisonmentCreditDays);
 const pretrialFineCredit=Math.min(initialFineRemaining,remainingPretrialForFine*rate);
 const confinementStart=parseLocalDate(input.confinementStart),checkDate=parseLocalDate(input.checkDate);
 const hasConfinement=input.mode==='fine'||input.mode==='imprisonConfinement';
 const datesValid=!!(confinementStart&&checkDate&&checkDate.getTime()>=confinementStart.getTime());
 const elapsedConfinementDays=hasConfinement&&datesValid?inclusiveDays(confinementStart,checkDate):0;
 const fineAfterPretrialCredit=Math.max(0,initialFineRemaining-pretrialFineCredit);
 const elapsedConfinementCredit=Math.min(fineAfterPretrialCredit,elapsedConfinementDays*rate);
 const fineBeforeToday=Math.max(0,fineAfterPretrialCredit-elapsedConfinementCredit);
 const paidToday=Math.min(paidTodayRequested,fineBeforeToday),fineRemaining=Math.max(0,fineBeforeToday-paidToday);
 const remainingConfinementDays=hasConfinement?Math.ceil(fineRemaining/rate):0;
 const maximumDays=(input.maxConfinementYears||1)*365;
 const exceedsMaximum=hasConfinement&&remainingConfinementDays>maximumDays;
 const imprisonmentStart=parseLocalDate(input.imprisonmentStart),statutoryImprisonmentEnd=input.mode==='fine'?null:addSentence(imprisonmentStart,input.sentence);
 const imprisonmentRelease=statutoryImprisonmentEnd?new Date(statutoryImprisonmentEnd.getTime()-imprisonmentCreditDays*DAY_MS):null;
 const confinementEnd=remainingConfinementDays>0&&checkDate&&datesValid?new Date(checkDate.getTime()+(remainingConfinementDays-1)*DAY_MS):null;
 // วันปล่อย = วันถัดจากวันสุดท้ายของการกักขัง
 const confinementRelease=confinementEnd?new Date(confinementEnd.getTime()+DAY_MS):null;
 const status=fineRemaining===0?'PAID':'UNPAID';
 return {mode,status,input:{fineAmount,paidBefore,paidTodayRequested,rate,pretrialDays},sentence:{...input.sentence,nominalAllocationDays:sentenceDaysForAllocation,pretrialDays,imprisonmentCreditDays,remainingPretrialForFine,statutoryEnd:statutoryImprisonmentEnd,projectedRelease:imprisonmentRelease},fine:{original:fineAmount,initialRemaining:initialFineRemaining,pretrialFineCredit,confinementCredit:elapsedConfinementCredit,paidToday,fineBeforeToday,remaining:fineRemaining},confinement:{start:confinementStart,checkDate,datesValid,elapsedDays:elapsedConfinementDays,remainingDays:remainingConfinementDays,maximumYears:input.maxConfinementYears||1,maximumDays,exceedsMaximum,projectedEnd:confinementRelease}};
}
