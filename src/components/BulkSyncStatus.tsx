import React, { useState } from 'react';
import { CloudOff, CloudUpload, CheckCircle2, AlertTriangle, X, RefreshCw, Trash2 } from 'lucide-react';
import {
  useBulkOutbox,
  flushBulkOutbox,
  retryFailedBulkItems,
  discardBulkItem,
  dismissFlaggedNotice
} from '../services/offlineQueue';
import { useBulkApp } from '../context/BulkAppContext';

/**
 * Interactive Header badge for Bulk Truck:
 * Shows offline state, number of bulk dispatches waiting to upload, and tap-for-details popup.
 */
export const BulkSyncStatus: React.FC = () => {
  const { items, pending, failed, syncing, online, flaggedNotice } = useBulkOutbox();
  const { language } = useBulkApp();
  const [open, setOpen] = useState(false);

  // If an offline dispatch was flagged for administrative review
  if (online && pending === 0 && failed === 0 && !syncing && flaggedNotice > 0) {
    return (
      <button
        type="button"
        onClick={dismissFlaggedNotice}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] sm:text-[11px] font-bold bg-amber-500/15 text-amber-400 border-amber-500/40 cursor-pointer shadow-sm active:scale-95 transition"
        aria-label="Dismiss Review Flag"
        title={language === 'ar' ? 'انقر للإغلاق' : 'Tap to dismiss'}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span className="whitespace-nowrap">
          {language === 'ar'
            ? `تم الحفظ · تم إرسال ${flaggedNotice} للمشرف للمراجعة`
            : `Saved · ${flaggedNotice} sent for admin review`}
        </span>
      </button>
    );
  }

  // If online with nothing queued and not syncing, show clean Online status
  if (online && pending === 0 && failed === 0 && !syncing) {
    return null;
  }

  const tone = failed > 0
    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-rose-950/20'
    : !online
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-amber-950/20'
    : 'bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-sky-950/20';

  const text = failed > 0
    ? (language === 'ar' ? `${failed} يتطلب انتباهك` : `${failed} need attention`)
    : !online
    ? (pending
        ? (language === 'ar' ? `غير متصل · ${pending} معلق` : `Offline · ${pending} queued`)
        : (language === 'ar' ? 'غير متصل (محلي)' : 'Offline (Local)'))
    : syncing
    ? (language === 'ar' ? 'جاري المزامنة…' : 'Syncing…')
    : (language === 'ar' ? `${pending} معلق للرفع` : `${pending} queued`);

  const Icon = failed > 0 ? AlertTriangle : !online ? CloudOff : CloudUpload;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] sm:text-[11px] font-bold cursor-pointer transition shadow-sm active:scale-95 ${tone}`}
        aria-label="Bulk sync status"
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-pulse' : ''}`} />
        <span className="whitespace-nowrap font-mono">{text}</span>
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-auto sm:w-88 max-w-[94vw] z-50 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-4 text-xs text-slate-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <span className="font-black uppercase tracking-wider text-[11px] text-slate-300 flex items-center gap-1.5">
              <CloudUpload className="w-4 h-4 text-amber-400" />
              {language === 'ar' ? 'طابور الحفظ المحلي للسائب' : 'Bulk Offline Saves Queue'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            {online
              ? (language === 'ar'
                  ? 'عمليات التحميل المحفوظة أثناء انقطاع الشبكة مخزنة على هذا الجهاز ويتم رفعها تلقائياً إلى Google Sheets بالترتيب.'
                  : 'Saves made without internet are safely stored on this phone and upload automatically to Google Sheets in order.')
              : (language === 'ar'
                  ? 'الشبكة غير متصلة. يمكنك متابعة العمل كالمعتاد — يتم حفظ جميع العمليات على جهازك وتُرفع فور عودة الاتصال.'
                  : 'No internet connection. Keep working — dispatches are stored on this phone and upload when connection returns.')}
          </p>

          {items.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 font-semibold py-3 px-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{language === 'ar' ? 'تمت مزامنة ورفع جميع العمليات بالكامل' : 'All bulk dispatches are fully synced'}</span>
            </div>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto m-0 p-0 list-none custom-scrollbar">
              {items.map(i => (
                <li
                  key={i.id}
                  className={`p-2.5 rounded-xl border ${
                    i.status === 'failed'
                      ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                      : 'border-slate-800 bg-slate-950/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate text-slate-100">{i.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{new Date(i.queuedAt).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span className={i.status === 'failed' ? 'text-rose-400 font-semibold' : 'text-amber-400'}>
                          {i.status === 'failed'
                            ? (language === 'ar' ? 'تم الرفض من الخادم' : 'Rejected by server')
                            : (language === 'ar' ? 'في انتظار الرفع' : 'Waiting to upload')}
                        </span>
                      </div>
                      {i.error && (
                        <div className="text-[10px] text-rose-400 mt-1 p-1.5 rounded-lg bg-rose-950/50 border border-rose-900/60 break-words leading-tight">
                          {i.error}
                        </div>
                      )}
                    </div>
                    {i.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => discardBulkItem(i.id)}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-800/40 shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <Trash2 className="w-3 h-3" />
                        {language === 'ar' ? 'حذف' : 'Discard'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={!online || syncing || pending === 0}
              onClick={() => flushBulkOutbox()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs disabled:opacity-40 disabled:pointer-events-none transition shadow cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{language === 'ar' ? 'مزامنة الآن' : 'Sync Now'}</span>
            </button>
            {failed > 0 && (
              <button
                type="button"
                onClick={() => retryFailedBulkItems()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition cursor-pointer active:scale-95"
              >
                <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry Rejected'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
