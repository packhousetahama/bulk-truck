import React, { useState } from 'react';
import { BulkActiveJob } from '../types';
import { BULK_SILOS, BULK_STOPPAGE_OPTIONS, BulkStoppageType } from '../utils/constants';
import { useBulkApp } from '../context/BulkAppContext';
import { calculateDurationMinutes, getSaudiCurrentTimeOnly } from '../utils/timeZone';
import { CheckCircle2, X, Scale, AlertTriangle } from 'lucide-react';

interface BulkCompleteModalProps {
  isOpen: boolean;
  job: BulkActiveJob | null;
  onClose: () => void;
  onConfirmComplete: (actualTonnes: number, stoppageReason: BulkStoppageType, status: 'completed' | 'not completed') => void;
}

export const BulkCompleteModal: React.FC<BulkCompleteModalProps> = ({
  isOpen,
  job,
  onClose,
  onConfirmComplete
}) => {
  const { language } = useBulkApp();
  const [actualTonnes, setActualTonnes] = useState<string>(
    job ? String(job.authorisedTonnes || 30) : '30'
  );
  const [stoppage, setStoppage] = useState<BulkStoppageType>(() => {
    if (job?.stoppageReason && job.stoppageReason !== 'NONE') {
      const up = job.stoppageReason.toUpperCase();
      if (up.includes('MECH')) return 'MECHANICAL';
      if (up.includes('INST') || up.includes('ELEC')) return 'INSTRUMENT';
      if (up.includes('PROD') || up.includes('OPER')) return 'PRODUCTION';
    }
    return 'NONE';
  });

  if (!isOpen || !job) return null;

  const silo = BULK_SILOS[job.siloId];
  const endTime = getSaudiCurrentTimeOnly();
  const grossMinutes = calculateDurationMinutes(job.startTime, endTime);
  const downtimeMinutes = Math.round(((job.totalDowntimeSeconds || 0) / 60) * 10) / 10;
  const netMinutes = Math.max(0, Math.round((grossMinutes - downtimeMinutes) * 10) / 10);

  const numVal = parseFloat(actualTonnes) || 0;
  const variance = Math.round((numVal - job.authorisedTonnes) * 100) / 100;
  const isProblem = stoppage !== 'NONE';

  const handleAdjust = (delta: number) => {
    const next = Math.max(0, Math.round((numVal + delta) * 100) / 100);
    setActualTonnes(String(next));
  };

  const handleCompleteAndWeighOut = () => {
    if (numVal <= 0) return;
    // Complete the load, preserving stoppage reason (e.g. MECHANICAL, PRODUCTION)
    onConfirmComplete(numVal, stoppage, 'completed');
  };

  const handleSaveDelayInProgress = () => {
    if (numVal <= 0) return;
    // Keep active on silo with status 'not completed'
    onConfirmComplete(numVal, stoppage, 'not completed');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCompleteAndWeighOut();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                {language === 'ar' ? 'إتمام التحميل وتأكيد الوزن النهائي' : 'Complete Loading & Weigh-Out'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {silo?.nameEn || job.siloId} · {job.truckNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Key Metrics Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {language === 'ar' ? 'الوقت الإجمالي' : 'Gross Time'}
              </span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                {grossMinutes}m
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-red-400 block">
                {language === 'ar' ? 'وقت العطل' : 'Downtime'}
              </span>
              <span className="font-mono font-bold text-red-300 text-sm">
                {downtimeMinutes}m
              </span>
            </div>

            <div className="bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                {language === 'ar' ? 'الصافي' : 'Net Time'}
              </span>
              <span className="font-mono font-bold text-emerald-300 text-sm">
                {netMinutes}m
              </span>
            </div>
          </div>

          {/* Actual Tonnes Entry Field */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                {language === 'ar' ? 'الوزن الفعلي المحمّل (طن):' : 'Actual Loaded Tonnes:'}
              </label>
              <span className="text-[11px] text-slate-400">
                {language === 'ar' ? 'المصرح بالتذكرة:' : 'Authorised:'}{' '}
                <span className="font-mono font-bold text-amber-400">{job.authorisedTonnes} t</span>
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={actualTonnes}
                onChange={e => setActualTonnes(e.target.value)}
                required
                className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl py-3 px-4 text-2xl font-black font-mono text-center text-emerald-400 focus:outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-500">
                TONNES
              </span>
            </div>

            {/* Touch Adjusters for Touchscreens */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleAdjust(-1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 cursor-pointer"
              >
                -1.0 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(-0.1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 cursor-pointer"
              >
                -0.1 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(0.1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 cursor-pointer"
              >
                +0.1 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 cursor-pointer"
              >
                +1.0 t
              </button>
            </div>

            {/* Variance Pill */}
            {variance !== 0 && (
              <div className="flex items-center justify-between text-xs px-2 pt-1 font-semibold">
                <span className="text-slate-400">
                  {language === 'ar' ? 'فارق الوزن عن التذكرة:' : 'Variance from Ticket:'}
                </span>
                <span className={`font-mono font-bold ${variance > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                  {variance > 0 ? `+${variance}` : variance} t
                </span>
              </div>
            )}
          </div>

          {/* Compulsory Stoppage Selector matching Truck Entry */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'ar' ? 'حالة التوقف / العطل (إلزامي)' : 'Stoppage Condition (Compulsory)'}</span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isProblem
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
              }`}>
                {isProblem ? 'NOT COMPLETED (KEEP ACTIVE)' : 'COMPLETED (FREE SILO)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BULK_STOPPAGE_OPTIONS.map(st => {
                const isSelected = stoppage === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStoppage(st)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? st === 'NONE'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                          : 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>{st === 'MECHANICAL' ? 'MECHANICAL' : st}</span>
                  </button>
                );
              })}
            </div>
            {isProblem ? (
              <p className="text-[11px] text-rose-300/90 pt-1 leading-snug">
                {language === 'ar'
                  ? 'سيتم تسجيل التوقف في الشيت كـ "غير مكتمل". ستبقى الشاحنة في الصومعة حتى يتم حل العطل واختيار "NONE".'
                  : 'Stoppage will be saved to Google Sheets as "not completed". This truck will remain active on the silo until marked as "NONE".'}
              </p>
            ) : (
              <p className="text-[11px] text-emerald-300/90 pt-1 leading-snug">
                {language === 'ar'
                  ? 'سيتم إتمام الشحنة كـ "مكتملة" بنجاح، وتفريغ الصومعة للشاحنة التالية.'
                  : 'Loading will be completed with status "completed" and this silo will be freed for the next dispatch.'}
              </p>
            )}
          </div>

          {/* Explanatory banner about Stoppage Reason preservation */}
          {isProblem && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-300 block">
                  {language === 'ar' ? `سبب التوقف المُسجل: ${stoppage}` : `Recorded Stoppage: ${stoppage}`}
                </span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {language === 'ar'
                    ? `سيتم حفظ سبب التوقف (${stoppage}) في العمود R دون الرجوع إلى NONE، مع توثيق مدة العطل بالشيت.`
                    : `Column R will permanently record "${stoppage}" (will NOT revert to NONE), documenting the delay downtime.`}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              {/* Primary Action: Complete & Weigh-Out (Frees silo, keeps stoppage reason) */}
              <button
                type="button"
                disabled={numVal <= 0}
                onClick={handleCompleteAndWeighOut}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition shadow-lg shadow-emerald-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isProblem
                    ? (language === 'ar' ? `إتمام وتفريغ الصومعة (مع توثيق ${stoppage})` : `Complete & Weigh-Out (Log ${stoppage})`)
                    : (language === 'ar' ? 'إتمام التحميل وتفريغ الصومعة' : 'Complete & Weigh-Out (Free Silo)')}
                </span>
              </button>
            </div>

            {/* Secondary Action (Only if Stoppage): Keep Active / Delay In Progress */}
            {isProblem && (
              <button
                type="button"
                disabled={numVal <= 0}
                onClick={handleSaveDelayInProgress}
                className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {language === 'ar'
                    ? `حفظ كعطل قيد الانتظار (${stoppage}) - إبقاء الشاحنة في الصومعة`
                    : `Save Delay In-Progress (${stoppage}) - Keep Silo Active`}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
