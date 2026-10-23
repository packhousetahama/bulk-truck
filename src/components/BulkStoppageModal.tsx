import React, { useState } from 'react';
import { BulkSiloId } from '../types';
import { BULK_STOPPAGE_REASONS, BULK_SILOS } from '../utils/constants';
import { useBulkApp } from '../context/BulkAppContext';
import { AlertTriangle, X, Check, FileText } from 'lucide-react';

interface BulkStoppageModalProps {
  isOpen: boolean;
  siloId: BulkSiloId;
  onClose: () => void;
  onSubmit: (reason: string, comment?: string) => void;
}

export const BulkStoppageModal: React.FC<BulkStoppageModalProps> = ({
  isOpen,
  siloId,
  onClose,
  onSubmit
}) => {
  const { language } = useBulkApp();
  const [selectedReasonId, setSelectedReasonId] = useState<string>(BULK_STOPPAGE_REASONS[0].id);
  const [customComment, setCustomComment] = useState('');

  if (!isOpen) return null;

  const silo = BULK_SILOS[siloId];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = BULK_STOPPAGE_REASONS.find(r => r.id === selectedReasonId);
    const reasonText = found ? (language === 'ar' ? found.ar : found.en) : selectedReasonId;
    onSubmit(reasonText, customComment.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-red-500/50 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-red-950/30 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                {language === 'ar' ? 'تسجيل توقف / عطل فني' : 'Report Loading Stoppage'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {silo.nameEn} ({silo.cementType})
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {language === 'ar' ? 'اختر سبب التوقف:' : 'Select Stoppage Reason:'}
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {BULK_STOPPAGE_REASONS.map(reason => {
                const isSelected = selectedReasonId === reason.id;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setSelectedReasonId(reason.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-red-500/20 border-red-500 text-red-200 ring-1 ring-red-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <span>{language === 'ar' ? reason.ar : reason.en}</span>
                    {isSelected && <Check className="w-4 h-4 text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional comment */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ar' ? 'ملاحظات إضافية (اختياري):' : 'Additional Notes (Optional):'}</span>
            </label>
            <input
              type="text"
              value={customComment}
              onChange={e => setCustomComment(e.target.value)}
              placeholder="e.g. Technician called / waiting for air pressure"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            ℹ️ {language === 'ar'
              ? 'ملاحظة: مؤقت التحميل الكلي يستمر بالعمل. يتم احتساب فترة العطل بشكل منفصل كوقت توقف.'
              : 'Gross loading timer continues running. Stoppage duration will be tracked separately as downtime.'}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition shadow-lg shadow-red-600/20 active:scale-95"
            >
              {language === 'ar' ? 'تأكيد التوقف' : 'Confirm Stoppage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
