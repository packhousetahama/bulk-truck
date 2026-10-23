import React, { useState } from 'react';
import { BulkActiveJob } from '../types';
import { BULK_SILOS } from '../utils/constants';
import { useBulkApp } from '../context/BulkAppContext';
import { calculateDurationMinutes, getSaudiCurrentTimeOnly } from '../utils/timeZone';
import { CheckCircle2, X, Scale, Clock, AlertCircle } from 'lucide-react';

interface BulkCompleteModalProps {
  isOpen: boolean;
  job: BulkActiveJob | null;
  onClose: () => void;
  onConfirmComplete: (actualTonnes: number) => void;
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

  if (!isOpen || !job) return null;

  const silo = BULK_SILOS[job.siloId];
  const endTime = getSaudiCurrentTimeOnly();
  const grossMinutes = calculateDurationMinutes(job.startTime, endTime);
  const downtimeMinutes = Math.round(((job.totalDowntimeSeconds || 0) / 60) * 10) / 10;
  const netMinutes = Math.max(0, Math.round((grossMinutes - downtimeMinutes) * 10) / 10);

  const numVal = parseFloat(actualTonnes) || 0;
  const variance = Math.round((numVal - job.authorisedTonnes) * 100) / 100;

  const handleAdjust = (delta: number) => {
    const next = Math.max(0, Math.round((numVal + delta) * 100) / 100);
    setActualTonnes(String(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numVal <= 0) return;
    onConfirmComplete(numVal);
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
                {silo.nameEn} · {job.truckNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
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
                {language === 'ar' ? 'الوزن الفعلي المحمّل (طن)' : 'Actual Loaded Tonnes:'}
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

            {/* Touch Adjusters for Industrial Touchscreens */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleAdjust(-1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300"
              >
                -1.0 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(-0.1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300"
              >
                -0.1 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(0.1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300"
              >
                +0.1 t
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(1)}
                className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300"
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={numVal <= 0}
              className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{language === 'ar' ? 'تأكيد الحفظ والإغلاق' : 'Save & Complete Load'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
