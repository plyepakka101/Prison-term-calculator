import { useMemo, useState } from 'react';
import { Scale, AlertTriangle, RotateCcw } from 'lucide-react';
import { calculateCase, formatSentence, formatThaiDate, type CalculationMode } from './engine';

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `${Math.round(n).toLocaleString('th-TH')} บาท`;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="field"><span>{label}</span>{children}</label>
);

const Result = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`result ${highlight ? 'result-hi' : ''}`}>
    <span>{label}</span><strong>{value}</strong>
  </div>
);

export default function AppV2() {
  const [mode, setMode] = useState<CalculationMode>('fine');
  const [sentence, setSentence] = useState({ years: 0, months: 0, days: 0 });
  const [pretrialDays, setPretrialDays] = useState(0);
  const [pretrialStart, setPretrialStart] = useState('');
  const [judgmentDate, setJudgmentDate] = useState('');
  const [imprisonmentStart, setImprisonmentStart] = useState('');
  const [fineAmount, setFineAmount] = useState(100000);
  const [paidBefore, setPaidBefore] = useState(0);
  const [paidToday, setPaidToday] = useState(0);
  const [rate, setRate] = useState(500);
  const [confinementStart, setConfinementStart] = useState('');
  const [checkDate, setCheckDate] = useState(today());
  const [maxConfinementYears, setMaxConfinementYears] = useState<1 | 2>(1);

  const needsPrison = mode !== 'fine';
  const needsConfinement = mode === 'fine' || mode === 'imprisonConfinement';

  // คำนวณจำนวนวันจากช่วงวันที่ (นับวันแรกเป็น 1 วัน)
  const daysFromRange = useMemo(() => {
    if (!pretrialStart || !judgmentDate) return null;
    const a = new Date(pretrialStart).getTime();
    const b = new Date(judgmentDate).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
    return Math.floor((b - a) / 86400000) + 1;
  }, [pretrialStart, judgmentDate]);

  const effectivePretrialDays = daysFromRange ?? pretrialDays;

  const result = useMemo(
    () => calculateCase({
      mode, sentence,
      pretrialDays: effectivePretrialDays,
      imprisonmentStart, fineAmount, paidBefore, paidToday,
      fineRate: rate, confinementStart, checkDate, maxConfinementYears,
    }),
    [mode, sentence, effectivePretrialDays, imprisonmentStart, fineAmount,
     paidBefore, paidToday, rate, confinementStart, checkDate, maxConfinementYears]
  );

  // วันกักขังแทนค่าปรับ "ก่อน" หักวันคุมขังก่อนพิพากษา
  const grossConfinementDays = useMemo(
    () => (rate > 0 ? Math.ceil(Math.max(0, fineAmount - paidBefore) / rate) : 0),
    [fineAmount, paidBefore, rate]
  );

  // วันก่อนพิพากษาส่วนที่เหลือมาใช้หักค่าปรับ
  const pretrialForFine = needsPrison
    ? (result.sentence?.remainingPretrialDays ?? 0)
    : effectivePretrialDays;

  const creditDaysUsed = Math.min(grossConfinementDays, pretrialForFine);
  const netConfinementDays = Math.max(0, grossConfinementDays - pretrialForFine);
  const noConfinementLeft = grossConfinementDays > 0 && netConfinementDays === 0;

  const reset = () => {
    setSentence({ years: 0, months: 0, days: 0 });
    setPretrialDays(0); setPretrialStart(''); setJudgmentDate('');
    setImprisonmentStart(''); setFineAmount(100000);
    setPaidBefore(0); setPaidToday(0); setRate(500);
    setConfinementStart(''); setCheckDate(today()); setMaxConfinementYears(1);
  };

  const setPart = (k: 'years' | 'months' | 'days', v: string) =>
    setSentence(s => ({ ...s, [k]: Math.max(0, Number(v) || 0) }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <header className="bg-indigo-700 text-white rounded-2xl p-5 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <Scale />
            <div>
              <h1 className="text-2xl font-bold">ระบบคำนวณวันต้องโทษ V2</h1>
              <p className="text-indigo-100 text-sm">Calculation Engine เดียวสำหรับ 3 กรณี</p>
            </div>
          </div>
          <button onClick={reset} className="px-3 py-2 bg-white/10 rounded-lg flex gap-2 items-center">
            <RotateCcw size={16} />ล้างข้อมูล
          </button>
        </header>

        <section className="card">
          <h2>ประเภทการคำนวณ</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {([['fine', 'กักขังแทนค่าปรับ'],
               ['imprisonFine', 'จำคุกและปรับ'],
               ['imprisonConfinement', 'จำคุกและกักขังแทนค่าปรับ']] as const).map(([v, t]) => (
              <button key={v} onClick={() => setMode(v)} className={`mode ${mode === v ? 'mode-active' : ''}`}>{t}</button>
            ))}
          </div>
        </section>

        {needsPrison && (
          <section className="card">
            <h2>ข้อมูลโทษจำคุก</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="ปี"><input type="number" min="0" value={sentence.years} onChange={e => setPart('years', e.target.value)} /></Field>
              <Field label="เดือน"><input type="number" min="0" max="11" value={sentence.months} onChange={e => setPart('months', e.target.value)} /></Field>
              <Field label="วัน"><input type="number" min="0" value={sentence.days} onChange={e => setPart('days', e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <Field label="วันที่เริ่มจำคุก">
                <input type="date" value={imprisonmentStart} onChange={e => setImprisonmentStart(e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {/* ===== ส่วนใหม่: การคุมขังก่อนพิพากษา (แสดงทุกโหมด) ===== */}
        <section className="card">
          <h2>การคุมขังก่อนพิพากษา</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="วันเริ่มถูกคุมขัง / ฝากขัง">
              <input type="date" value={pretrialStart} onChange={e => setPretrialStart(e.target.value)} />
            </Field>
            <Field label="วันพิพากษา">
              <input type="date" value={judgmentDate} onChange={e => setJudgmentDate(e.target.value)} />
            </Field>
            <Field label="จำนวนวัน (กรอกเองได้)">
              <input
                type="number" min="0"
                value={effectivePretrialDays}
                disabled={daysFromRange !== null}
                onChange={e => setPretrialDays(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          </div>
          <p className="notice mt-4">
            {daysFromRange !== null
              ? `คำนวณจากช่วงวันที่ = ${daysFromRange} วัน (นับวันแรกเป็น 1 วัน) — ล้างช่องวันที่หากต้องการกรอกจำนวนวันเอง`
              : 'ยังไม่ได้ระบุช่วงวันที่ ระบบใช้จำนวนวันที่กรอกเอง'}
            {needsPrison
              ? ' • ระบบจะนำวันคุมขังก่อนพิพากษาไปหักโทษจำคุกก่อน แล้วจึงนำวันที่เหลือมาหักค่าปรับ'
              : ' • ระบบจะนำวันคุมขังก่อนพิพากษามาหักจากวันกักขังแทนค่าปรับโดยตรง'}
          </p>
        </section>

        <section className="card">
          <h2>ข้อมูลค่าปรับ</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="ค่าปรับตามคำพิพากษา"><input type="number" min="0" value={fineAmount} onChange={e => setFineAmount(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field label="ชำระก่อนเริ่มกักขัง"><input type="number" min="0" value={paidBefore} onChange={e => setPaidBefore(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field label="อัตรา 1 วัน (บาท)"><input type="number" min="1" value={rate} onChange={e => setRate(Math.max(1, Number(e.target.value) || 500))} /></Field>
          </div>
        </section>

        {needsConfinement && (
          <section className="card">
            <h2>กักขังแทนค่าปรับ</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="วันที่เริ่มกักขัง"><input type="date" value={confinementStart} onChange={e => setConfinementStart(e.target.value)} /></Field>
              <Field label="วันที่ตรวจสอบ / วันที่มาชำระ"><input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} /></Field>
              <Field label="ชำระเงินวันนี้"><input type="number" min="0" value={paidToday} onChange={e => setPaidToday(Math.max(0, Number(e.target.value) || 0))} /></Field>
              <Field label="เพดานการกักขัง">
                <select value={maxConfinementYears} onChange={e => setMaxConfinementYears(Number(e.target.value) as 1 | 2)}>
                  <option value="1">ไม่เกิน 1 ปี</option>
                  <option value="2">ไม่เกิน 2 ปี</option>
                </select>
              </Field>
            </div>

            {/* สรุปการหักวันขังก่อนพิพากษา */}
            <div className="mt-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 p-4 space-y-1 text-sm">
              <div>ค่าปรับ {money(Math.max(0, fineAmount - paidBefore))} คิดอัตรา {rate.toLocaleString('th-TH')} บาท/วัน เท่ากับกักขัง <strong>{grossConfinementDays} วัน</strong></div>
              <div>หักวันคุมขังก่อนพิพากษา <strong>{creditDaysUsed} วัน</strong> (คิดเป็น {money(creditDaysUsed * rate)})</div>
              {noConfinementLeft ? (
                <div className="font-semibold text-emerald-700 dark:text-emerald-300">ไม่เหลือวันกักขังแทนค่าปรับ</div>
              ) : (
                <div className="font-semibold">คงเหลือกักขัง <strong>{netConfinementDays} วัน</strong> หรือคิดเป็นค่าปรับคงเหลือประมาณ {money(netConfinementDays * rate)}</div>
              )}
            </div>

            <p className="notice mt-3">
              {fineAmount >= 200000
                ? 'ค่าปรับตั้งแต่ 200,000 บาทขึ้นไป: โปรดตรวจสอบคำสั่งศาลและเพดานการกักขังของคดี'
                : 'ค่าปรับต่ำกว่า 200,000 บาท: ระบบตั้งค่าเพดานเริ่มต้น 1 ปี'}
            </p>
          </section>
        )}

        <section className="card">
          <div className="flex justify-between items-center">
            <h2>ผลคำนวณจาก Engine กลาง</h2>
            <span className="badge">{result.status === 'PAID' ? 'ชำระครบแล้ว' : 'ยังมียอดคงเหลือ'}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {needsPrison && (
              <>
                <Result label="โทษจำคุก" value={formatSentence(sentence)} />
                <Result label="วันคุมขังก่อนพิพากษาที่แจ้ง" value={`${effectivePretrialDays} วัน`} />
                <Result label="หักเข้าโทษจำคุก" value={`${result.sentence.imprisonmentCreditDays} วัน`} />
                <Result label="วันที่เหลือมาหักค่าปรับ" value={`${result.sentence.remainingPretrialDays} วัน`} />
              </>
            )}
            {!needsPrison && (
              <Result label="วันคุมขังก่อนพิพากษาที่แจ้ง" value={`${effectivePretrialDays} วัน`} />
            )}

            <Result label="ค่าปรับหลังชำระก่อนกักขัง" value={money(result.fine.initialRemaining)} />
            <Result label="วันกักขังตามยอดค่าปรับ (ก่อนหัก)" value={`${grossConfinementDays} วัน`} />
            <Result label="วันที่หักจากการขังก่อนพิพากษา" value={`${creditDaysUsed} วัน`} />
            <Result label="เครดิตจากวันคุมขังก่อนพิพากษา" value={money(result.fine.pretrialFineCredit)} />

            {needsConfinement && (
              <>
                <Result label="เครดิตจากการกักขังถึงวันตรวจสอบ" value={money(result.fine.confinementCredit)} />
                <Result label="ชำระวันนี้" value={money(result.fine.paidToday)} />
                <Result highlight label="ค่าปรับคงเหลือ" value={money(result.fine.remaining)} />
                <Result
                  highlight
                  label="กักขังแทนค่าปรับคงเหลือ"
                  value={noConfinementLeft ? 'ไม่เหลือวันกักขังแทนค่าปรับ' : `${result.confinement.remainingDays} วัน`}
                />
                <Result label="วันสิ้นสุดกักขังโดยประมาณ" value={result.confinement.projectedEnd ? formatThaiDate(result.confinement.projectedEnd) : 'ชำระครบแล้ว'} />
              </>
            )}
            {needsPrison && (
              <Result label="กำหนดสิ้นสุดจำคุกโดยประมาณ" value={result.sentence.projectedRelease ? formatThaiDate(result.sentence.projectedRelease) : 'ระบุวันเริ่มจำคุก'} />
            )}
          </div>
        </section>

        <section className="card">
          <h2>ลำดับการคำนวณ</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
            <li>ค่าปรับตามคำพิพากษา หักเงินที่ชำระก่อนเริ่มกักขัง</li>
            <li>แปลงค่าปรับคงเหลือเป็นวันกักขังที่อัตรา {rate.toLocaleString('th-TH')} บาท/วัน (ปัดเศษขึ้น)</li>
            {needsPrison && <li>วันคุมขังก่อนพิพากษาถูกจัดสรรเข้าหักโทษจำคุกก่อน แล้ววันที่เหลือจึงเป็นเครดิตค่าปรับ</li>}
            {!needsPrison && <li>วันคุมขังก่อนพิพากษาถูกนำมาหักจากวันกักขังแทนค่าปรับโดยตรง</li>}
            {needsConfinement && <li>คำนวณเครดิตจากการกักขังจริงถึงวันตรวจสอบ แล้วหักเงินที่ชำระวันนี้</li>}
            <li>ค่าปรับคงเหลือหารด้วยอัตราต่อวัน แล้วปัดเศษขึ้นเป็นวันกักขังที่เหลือ</li>
          </ol>
        </section>

        {needsConfinement && result.confinement.remainingDays > result.confinement.maximumDays && (
          <div className="warning">
            <AlertTriangle size={20} />
            <span>ผลคำนวณเกินเพดาน {maxConfinementYears} ปี ต้องตรวจสอบคำพิพากษาและกฎหมายที่ใช้บังคับ</span>
          </div>
        )}

        <footer className="text-xs text-slate-500 text-center pb-8">
          เครื่องมือช่วยคำนวณเบื้องต้น ไม่ใช่คำวินิจฉัยทางกฎหมาย ต้องตรวจสอบคำพิพากษา หมายจำคุก หมายกักขัง และแนวปฏิบัติก่อนใช้เป็นทางการ
        </footer>
      </div>
    </div>
  );
}