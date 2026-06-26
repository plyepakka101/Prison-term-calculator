import { useState, useMemo } from 'react';
import { Scale, Calendar, Calculator, Info, AlertTriangle, CalendarDays, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const formatThaiDate = (date: Date) => {
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
};

const calculateImprisonmentRelease = (start: string, y: number, m: number, d: number, deduct: number = 0) => {
  if (!start) return null;
  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return null;

  const releaseDate = new Date(startDate);
  const targetYear = releaseDate.getFullYear() + y;
  releaseDate.setFullYear(targetYear);

  // Handle leap year: adding years to Feb 29 might land on March 1 in JS
  if (startDate.getMonth() === 1 && startDate.getDate() === 29 && releaseDate.getMonth() === 2) {
    releaseDate.setDate(0); // Sets to Feb 28 of that year
  }

  // According to Thai Penal Code Section 21: 1 month = 30 days
  // We do NOT subtract 1 here because release is the day AFTER the sentence is completed
  const additionalDays = (m * 30) + d - deduct; 
  releaseDate.setDate(releaseDate.getDate() + additionalDays);

  return releaseDate;
};

const calculateConfinement = (fine: number, rate: number, start: string, deduct: number = 0) => {
  if (fine <= 0 || rate <= 0) return { days: 0, releaseDate: null, baseDays: 0 };
  const baseDays = Math.ceil(fine / rate);
  const days = Math.max(0, baseDays - deduct);
  let releaseDate = null;
  if (start && days > 0) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime())) {
      releaseDate = new Date(startDate);
      // We do NOT subtract 1 here because release is the day AFTER the confinement is completed
      releaseDate.setDate(releaseDate.getDate() + days); 
    }
  }
  return { days, releaseDate, baseDays };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'prison' | 'fine' | 'both'>('prison');

  // Imprisonment State
  const [prisonDeduction, setPrisonDeduction] = useState<number | ''>('');
  const [prisonStartDate, setPrisonStartDate] = useState('');
  const [prisonYears, setPrisonYears] = useState<number | ''>('');
  const [prisonMonths, setPrisonMonths] = useState<number | ''>('');
  const [prisonDays, setPrisonDays] = useState<number | ''>('');

  // Fine Confinement State
  const [fineDeduction, setFineDeduction] = useState<number | ''>('');
  const [fineAmount, setFineAmount] = useState<number | ''>('');
  const [fineRate, setFineRate] = useState<number>(500);
  const [fineStartDate, setFineStartDate] = useState('');

  // Both State
  const [bothDeduction, setBothDeduction] = useState<number | ''>('');
  const [bothStartDate, setBothStartDate] = useState('');
  const [bothYears, setBothYears] = useState<number | ''>('');
  const [bothMonths, setBothMonths] = useState<number | ''>('');
  const [bothDays, setBothDays] = useState<number | ''>('');
  const [bothFineAmount, setBothFineAmount] = useState<number | ''>('');
  const [bothFineRate, setBothFineRate] = useState<number>(500);

  // Calculations
  const prisonResult = useMemo(() => {
    return calculateImprisonmentRelease(
      prisonStartDate,
      Number(prisonYears) || 0,
      Number(prisonMonths) || 0,
      Number(prisonDays) || 0,
      Number(prisonDeduction) || 0
    );
  }, [prisonStartDate, prisonYears, prisonMonths, prisonDays, prisonDeduction]);

  const fineResult = useMemo(() => {
    return calculateConfinement(
      Number(fineAmount) || 0,
      fineRate,
      fineStartDate,
      Number(fineDeduction) || 0
    );
  }, [fineAmount, fineRate, fineStartDate, fineDeduction]);

  const bothResult = useMemo(() => {
    const deduct = Number(bothDeduction) || 0;
    const prisonRelease = calculateImprisonmentRelease(
      bothStartDate,
      Number(bothYears) || 0,
      Number(bothMonths) || 0,
      Number(bothDays) || 0,
      deduct
    );
    
    if (!prisonRelease) return null;
    
    const fineConfinement = calculateConfinement(
      Number(bothFineAmount) || 0,
      bothFineRate,
      '',
      0
    );
    
    const finalRelease = new Date(prisonRelease);
    if (fineConfinement.days > 0) {
      finalRelease.setDate(finalRelease.getDate() + fineConfinement.days);
    }
    
    return {
      prisonReleaseDate: prisonRelease,
      fineDays: fineConfinement.days,
      finalReleaseDate: finalRelease
    };
  }, [bothStartDate, bothYears, bothMonths, bothDays, bothFineAmount, bothFineRate, bothDeduction]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4 pt-8 pb-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-2 text-indigo-700">
            <Scale className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            คำนวณวันจำคุกและกักขังแทนค่าปรับ
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            เครื่องมือช่วยคำนวณกำหนดวันพ้นโทษตามประมวลกฎหมายอาญา มาตรา 21 (ให้นับ 1 เดือนเท่ากับ 30 วัน) และคำนวณจำนวนวันกักขังแทนค่าปรับตามมาตรา 29
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('prison')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'prison'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            คำนวณวันจำคุก
          </button>
          <button
            onClick={() => setActiveTab('fine')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'fine'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Coins className="w-4 h-4" />
            กักขังแทนค่าปรับ
          </button>
          <button
            onClick={() => setActiveTab('both')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'both'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Scale className="w-4 h-4" />
            จำคุก + ปรับ
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'prison' && (
              <motion.div
                key="prison"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  {/* Quick Examples */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-sm text-slate-500 py-1.5 font-medium">ตัวอย่าง:</span>
                    <button onClick={() => { setPrisonYears(1); setPrisonMonths(6); setPrisonDays(0); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">1 ปี 6 เดือน</button>
                    <button onClick={() => { setPrisonYears(0); setPrisonMonths(3); setPrisonDays(15); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">3 เดือน 15 วัน</button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">หักวันต้องขัง (วัน)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={prisonDeduction}
                        onChange={(e) => setPrisonDeduction(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">วันที่เริ่มจำคุก</label>
                      <input
                        type="date"
                        value={prisonStartDate}
                        onChange={(e) => setPrisonStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">ปี</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={prisonYears}
                        onChange={(e) => setPrisonYears(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">เดือน</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={prisonMonths}
                        onChange={(e) => setPrisonMonths(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">วัน</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={prisonDays}
                        onChange={(e) => setPrisonDays(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {prisonResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl"
                  >
                    <div className="flex flex-col items-center text-center space-y-2">
                      <span className="text-indigo-600 font-medium flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        กำหนดวันพ้นโทษ
                      </span>
                      <span className="text-3xl font-bold text-indigo-900">
                        {formatThaiDate(prisonResult)}
                      </span>
                      {prisonStartDate && (
                         <span className="text-sm text-indigo-700/70 mt-2">
                           (นับตั้งแต่วันที่ {formatThaiDate(new Date(prisonStartDate))})
                         </span>
                      )}
                    </div>
                  </motion.div>
                )}
                
                <div className="flex gap-3 items-start p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="font-semibold text-slate-700">หลักการคำนวณตาม ป.อ. มาตรา 21:</strong><br />
                    การนับระยะเวลาให้นับเป็นวัน ถ้านับเป็นเดือนให้ถือว่า 1 เดือนมี 30 วัน ถ้านับเป็นปีให้คำนวณตามปีปฏิทิน และให้นับวันเริ่มจำคุกรวมเข้าด้วย <strong className="text-slate-800">โดยการปล่อยตัวจะปล่อยในวันถัดจากวันที่ครบกำหนดโทษ</strong> (ระบบนี้คำนวณแสดงเป็นวันที่ต้องปล่อยตัวจริงให้แล้ว)
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'fine' && (
              <motion.div
                key="fine"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  {/* Quick Examples */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-sm text-slate-500 py-1.5 font-medium">ตัวอย่าง:</span>
                    <button onClick={() => { setFineAmount(15000); setFineRate(500); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">ปรับ 15,000 บาท</button>
                    <button onClick={() => { setFineAmount(100000); setFineRate(500); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">ปรับ 100,000 บาท</button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">จำนวนเงินค่าปรับ (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="เช่น 15000"
                        value={fineAmount}
                        onChange={(e) => setFineAmount(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">อัตรากักขังต่อวัน (บาท)</label>
                      <input
                        type="number"
                        min="1"
                        value={fineRate}
                        onChange={(e) => setFineRate(e.target.value ? parseInt(e.target.value) : 500)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">หักวันต้องขัง (วัน)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={fineDeduction}
                        onChange={(e) => setFineDeduction(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">วันที่เริ่มกักขัง (เว้นว่างได้ถ้าต้องการดูแค่จำนวนวัน)</label>
                      <input
                        type="date"
                        value={fineStartDate}
                        onChange={(e) => setFineStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {(fineResult.baseDays ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="space-y-1">
                        <span className="text-indigo-600 font-medium">จำนวนวันกักขังสุทธิ (หลังหักวันต้องขัง)</span>
                        <div className="text-3xl font-bold text-indigo-900">
                          {fineResult.days.toLocaleString()} วัน
                        </div>
                        {Number(fineDeduction) > 0 && (
                          <div className="text-sm text-indigo-700/70 mt-1">
                            (จากเดิม {fineResult.baseDays?.toLocaleString()} วัน หัก {fineDeduction} วัน)
                          </div>
                        )}
                      </div>

                      {fineResult.releaseDate && (
                        <div className="pt-4 border-t border-indigo-200/50 w-full">
                          <span className="text-indigo-600 font-medium text-sm flex items-center justify-center gap-1.5 mb-1">
                            <Calendar className="w-4 h-4" />
                            วันพ้นกักขัง
                          </span>
                          <span className="text-xl font-bold text-indigo-800">
                            {formatThaiDate(fineResult.releaseDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="space-y-3">
                  <div className="flex gap-3 items-start p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
                    <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <p>
                      <strong className="font-semibold text-slate-700">หลักการคำนวณตาม ป.อ. มาตรา 29:</strong><br />
                      ให้ถืออัตรา 500 บาท ต่อ 1 วัน เศษของวันให้ปัดเป็นหนึ่งวัน <strong className="text-slate-800">โดยการปล่อยตัวจะปล่อยในวันถัดจากวันที่ครบกำหนดกักขัง</strong> (ระบบแสดงเป็นวันที่พ้นกักขังจริง)
                    </p>
                  </div>
                  
                  {fineResult.days > 365 && (
                    <div className="flex gap-3 items-start p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-800">
                      <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <p>
                        <strong className="font-semibold text-orange-900">ข้อควรระวัง:</strong><br />
                        ตามกฎหมายปกติ การกักขังแทนค่าปรับต้อง<strong className="font-bold underline">ไม่เกิน 1 ปี</strong> (เว้นแต่ในกรณีที่ศาลพิพากษาปรับตั้งแต่แปดหมื่นบาทขึ้นไป ศาลจะสั่งให้กักขังแทนค่าปรับเป็นระยะเวลาเกินกว่า 1 ปีแต่ไม่เกิน 2 ปีก็ได้) โปรดตรวจสอบคำพิพากษา
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'both' && (
              <motion.div
                key="both"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  {/* Quick Examples */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-sm text-slate-500 py-1.5 font-medium">ตัวอย่าง:</span>
                    <button onClick={() => { setBothYears(1); setBothMonths(0); setBothDays(0); setBothFineAmount(10000); setBothFineRate(500); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">จำคุก 1 ปี ปรับ 10,000</button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">หักวันต้องขัง (วัน)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bothDeduction}
                        onChange={(e) => setBothDeduction(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">วันที่เริ่มจำคุก</label>
                      <input
                        type="date"
                        value={bothStartDate}
                        onChange={(e) => setBothStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">จำคุก (ปี)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bothYears}
                        onChange={(e) => setBothYears(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">จำคุก (เดือน)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bothMonths}
                        onChange={(e) => setBothMonths(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">จำคุก (วัน)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bothDays}
                        onChange={(e) => setBothDays(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">จำนวนเงินค่าปรับ (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="เช่น 10000"
                        value={bothFineAmount}
                        onChange={(e) => setBothFineAmount(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">อัตรากักขังต่อวัน (บาท)</label>
                      <input
                        type="number"
                        min="1"
                        value={bothFineRate}
                        onChange={(e) => setBothFineRate(e.target.value ? parseInt(e.target.value) : 500)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {bothResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl"
                  >
                    <div className="flex flex-col items-center text-center space-y-6">
                      <div className="grid sm:grid-cols-2 gap-4 w-full">
                        <div className="p-4 bg-white/60 rounded-xl">
                          <span className="text-indigo-600 font-medium text-sm flex items-center justify-center gap-1.5 mb-2">
                            <CalendarDays className="w-4 h-4" />
                            ครบกำหนดจำคุก (หลังหักวันต้องขัง)
                          </span>
                          <span className="text-xl font-bold text-indigo-900">
                            {formatThaiDate(bothResult.prisonReleaseDate)}
                          </span>
                        </div>
                        <div className="p-4 bg-white/60 rounded-xl">
                          <span className="text-indigo-600 font-medium text-sm flex items-center justify-center gap-1.5 mb-2">
                            <Coins className="w-4 h-4" />
                            กักขังแทนค่าปรับ
                          </span>
                          <span className="text-xl font-bold text-indigo-900">
                            {bothResult.fineDays > 0 ? `${bothResult.fineDays.toLocaleString()} วัน` : 'ไม่มี'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-indigo-200/50 w-full">
                        <span className="text-indigo-600 font-medium flex items-center justify-center gap-2 mb-2">
                          <Calendar className="w-5 h-5" />
                          กำหนดวันพ้นโทษ (สุทธิ)
                        </span>
                        <span className="text-3xl font-bold text-indigo-900">
                          {formatThaiDate(bothResult.finalReleaseDate)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div className="flex gap-3 items-start p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="font-semibold text-slate-700">หลักการคำนวณ:</strong><br />
                    - <strong className="font-medium">ม. 29 วรรคสาม:</strong> ให้นับระยะเวลากักขังแทนค่าปรับติดต่อกับกำหนดเวลาจำคุก<br />
                    - <strong className="font-medium">ม. 22:</strong> ให้นำวันต้องขังหักออกจากเวลาจำคุก หากมีเศษให้นำไปหักออกจากค่าปรับ (เครื่องมือนี้จะนำไปหักอัตโนมัติ)<br />
                    <span className="text-slate-800 font-medium mt-1 inline-block">* ระบบคำนวณแสดงผลลัพธ์เป็น "วันที่ต้องปล่อยตัวจริง" (วันรุ่งขึ้นหลังจากครบกำหนดโทษ) ให้แล้ว</span>
                  </p>
                </div>

                {bothResult && bothResult.fineDays > 365 && (
                  <div className="flex gap-3 items-start p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-800">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <p>
                      <strong className="font-semibold text-orange-900">ข้อควรระวัง (กักขังเกิน 1 ปี):</strong><br />
                      การกักขังแทนค่าปรับปกติไม่เกิน 1 ปี (เว้นแต่ปรับ 80,000 บาทขึ้นไป ศาลอาจสั่งให้กักขังเกิน 1 ปีแต่ไม่เกิน 2 ปีได้)
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
