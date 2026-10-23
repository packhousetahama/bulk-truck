import React from 'react';
import { BulkTicketData, BulkSiloId } from '../types';
import { BULK_SILOS } from '../utils/constants';
import { AlertTriangle, Check, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { useBulkApp } from '../context/BulkAppContext';

interface BulkConflictModalProps {
  isOpen: boolean;
  ticket: BulkTicketData | null;
  onConfirmResolution: (resolvedSiloId: BulkSiloId, resolutionNote: string) => void;
  onCancel: () => void;
}

export const BulkConflictModal: React.FC<BulkConflictModalProps> = ({
  isOpen,
  ticket,
  onConfirmResolution,
  onCancel
}) => {
  const { language } = useBulkApp();
  if (!isOpen || !ticket) return null;

  const targetSiloId: BulkSiloId = ticket.proposedSiloId || 'OLD_2';
  const targetSilo = BULK_SILOS[targetSiloId];

  const resolutionNote = `Confirmed routing: Ticket specifies "${ticket.printedSiloRef || 'Silo 1'}", but Tahama plant configuration mandates ${targetSilo.nameEn} for ${ticket.cementType}. Operator verified before loading.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header Alert */}
        <div className="px-5 py-4 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                {language === 'ar' ? 'تنبيه تعارض التذكرة مع تعيين الصوامع' : 'Ticket Silo Conflict Detected'}
              </h2>
              <p className="text-[11px] text-amber-200/80">
                {language === 'ar' ? 'يتطلب مراجعة المشغل وتأكيده قبل بدء التحميل' : 'Operator review required before loading can begin'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Explanation Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-slate-200 font-semibold leading-relaxed">
                  {language === 'ar'
                    ? `تذكرة الشحن المطبوعة تشير إلى (صومعة 1)، بينما الصومعة القديمة 1 في مصنع تهامة مخصصة حصرياً لإسمنت (مقاوم GU).`
                    : `The printed ticket indicates "${ticket.printedSiloRef || 'Tahama-Silo 1'}", but Tahama Old Silo 1 is exclusively assigned to GU cement.`}
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {language === 'ar'
                    ? `وفقاً للتوزيع المعتمد في المحطة، يجب توجيه شحنات الإسمنت البوزولاني (PPC) إلى (صومعة قديمة 2).`
                    : `In accordance with authoritative plant mapping, all Bulk PPC loads are loaded at Old Silo 2 (Station 4).`}
                </p>
              </div>
            </div>

            {/* Comparison Details */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-semibold">
                  {language === 'ar' ? 'البيان على التذكرة:' : 'Ticket Statement:'}
                </span>
                <span className="font-mono font-bold text-red-400 text-xs">
                  {ticket.printedSiloRef || 'Tahama-Silo 1'} ({ticket.cementType})
                </span>
              </div>
              <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/30">
                <span className="text-amber-400 block font-semibold">
                  {language === 'ar' ? 'التوجيه المعتمد بالمصنع:' : 'Authorised Plant Routing:'}
                </span>
                <span className="font-mono font-bold text-amber-300 text-xs">
                  {targetSilo.nameEn} ({targetSilo.cementType})
                </span>
              </div>
            </div>
          </div>

          {/* Proposed Silo Card */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                {language === 'ar' ? 'الصومعة المقترحة للتأكيد' : 'Proposed Loading Destination'}
              </span>
              <div className="text-base font-black text-slate-100 flex items-center gap-2 mt-0.5">
                <span>{language === 'ar' ? targetSilo.nameAr : targetSilo.nameEn}</span>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                  {targetSilo.defaultStation}
                </span>
              </div>
            </div>
            <div className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md">
              {ticket.cementType}
            </div>
          </div>

          {/* Action Confirmation Button */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
            >
              {language === 'ar' ? 'إلغاء وتعديل' : 'Cancel & Re-check'}
            </button>
            <button
              type="button"
              onClick={() => onConfirmResolution(targetSiloId, resolutionNote)}
              className="flex-[2] py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {language === 'ar'
                  ? `تأكيد التوجيه إلى ${targetSilo.nameAr}`
                  : `Confirm & Route to ${targetSilo.nameEn}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
