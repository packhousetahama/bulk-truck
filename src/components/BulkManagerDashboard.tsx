import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkDashboardMetrics, BulkSiloId } from '../types';
import { fetchBulkDashboardMetrics } from '../services/api';
import { BULK_SILO_IDS, BULK_SILOS } from '../utils/constants';
import { formatElapsedSeconds } from '../utils/timeZone';
import {
  Scale,
  Truck,
  Clock,
  AlertTriangle,
  RotateCw,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Layers,
  XCircle
} from 'lucide-react';

export const BulkManagerDashboard: React.FC = () => {
  const { language, activeJobs, activeNowMs, cancelJob, showToast, currentUser, resetActiveLoaders } = useBulkApp();
  const [metrics, setMetrics] = useState<BulkDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchBulkDashboardMetrics();
      if (data) setMetrics(data);
    } catch (err) {
      console.warn('Failed to load manager metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const totalTrucks = metrics?.totalTrucks ?? (metrics as any)?.totalCompletedTrucks ?? 0;
  const totalTonnes = metrics?.totalTonnes ?? (metrics as any)?.totalCompletedTonnes ?? 0;
  const opcTonnes = metrics?.opcTonnes || 0;
  const guTonnes = metrics?.guTonnes || 0;
  const ppcTonnes = metrics?.ppcTonnes || 0;
  const totalDowntime = metrics?.totalDowntimeMinutes || 0;
  const avgGross = metrics?.avgGrossMinutes ?? (metrics as any)?.avgDurationMinutes ?? 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 sm:space-y-4 pb-20 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/60 inline-block">
            Manager Cockpit · لوحة التحكم الإدارية
          </span>
          <h2 className="text-sm sm:text-lg font-black text-slate-100 tracking-tight mt-1 leading-snug truncate">
            SPCC Tahama Bulk Cement Fleet Operations
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={async () => {
                if (confirm(language === 'ar' ? 'إجراء إداري: هل أنت متأكد من إعادة ضبط كافة الصوامع ومسح الجلسات المعلقة؟' : 'Admin Action: Reset all active loaders and clear stuck sessions?')) {
                  await resetActiveLoaders();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-red-950/80 border border-red-700/80 text-red-300 hover:bg-red-900 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Clear all active sessions across all 4 silos"
            >
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span>{language === 'ar' ? "إعادة ضبط الصوامع" : "Reset All Loaders"}</span>
            </button>
          )}
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-purple-400 border border-slate-850 transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Production KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{language === 'ar' ? "إجمالي المحمّل" : "Total Dispatched"}</span>
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {totalTonnes.toLocaleString()} <span className="text-xs text-slate-400 font-sans">t</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">{language === 'ar' ? "إجمالي حجم اليوم" : "Today's bulk volume"}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Truck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">{language === 'ar' ? "الشحنات المنجزة" : "Completed Loads"}</span>
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-sky-400">
            {totalTrucks} <span className="text-xs text-slate-400 font-sans">{language === 'ar' ? "شاحنة" : "trucks"}</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">{language === 'ar' ? "شاحنات مكتملة" : "Finished loads"}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{language === 'ar' ? "متوسط وقت التحميل" : "Avg Loading Time"}</span>
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {avgGross} <span className="text-xs text-slate-400 font-sans">{language === 'ar' ? "دقيقة" : "min"}</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">{language === 'ar' ? "متوسط الوقت الإجمالي للشاحنة" : "Gross avg per load"}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="truncate">{language === 'ar' ? "إجمالي وقت الأعطال" : "Total Downtime"}</span>
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-red-400">
            {totalDowntime} <span className="text-xs text-slate-400 font-sans">{language === 'ar' ? "دقيقة" : "min"}</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">{language === 'ar' ? "تأخير الأعطال" : "Stoppage delay"}</span>
        </div>
      </div>

      {/* Production by Cement Type Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-2.5 sm:space-y-3">
        <h3 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          {language === 'ar' ? "الكميات المحمّلة حسب نوع الإسمنت" : "Tonnes Dispatched by Material"}
        </h3>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 text-center">
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-400 block truncate">OPC (عادي)</span>
            <span className="text-sm sm:text-xl font-black font-mono text-emerald-300 block my-0.5">{opcTonnes.toLocaleString()} t</span>
            <span className="text-[8px] sm:text-[10px] text-slate-500 block truncate">Silos 5 & 6</span>
          </div>

          <div className="bg-sky-950/20 border border-sky-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-sky-400 block truncate">GU (مقاوم)</span>
            <span className="text-sm sm:text-xl font-black font-mono text-sky-300 block my-0.5">{guTonnes.toLocaleString()} t</span>
            <span className="text-[8px] sm:text-[10px] text-slate-500 block truncate">Old Silo 1</span>
          </div>

          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-amber-400 block truncate">PPC (بوزولاني)</span>
            <span className="text-sm sm:text-xl font-black font-mono text-amber-300 block my-0.5">{ppcTonnes.toLocaleString()} t</span>
            <span className="text-[8px] sm:text-[10px] text-slate-500 block truncate">Old Silo 2</span>
          </div>
        </div>
      </div>

      {/* Live 4-Silo Cockpit & Emergency Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3 sm:space-y-4">
        <h3 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          {language === 'ar' ? "لوحة متابعة صوامع السائب المباشرة" : "Live Authorised Silos Bay Cockpit"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {BULK_SILO_IDS.map(id => {
            const silo = BULK_SILOS[id];
            const activeJob = activeJobs[id];
            const isOccupied = !!activeJob;

            let elapsedSec = 0;
            if (activeJob) {
              elapsedSec = Math.max(0, Math.floor((activeNowMs - activeJob.startEpochMs) / 1000));
            }

            return (
              <div
                key={id}
                className="bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-black text-slate-100 truncate">{language === 'ar' ? (silo.nameAr || silo.nameEn) : silo.nameEn}</h4>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">{silo.defaultStation}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase bg-slate-900 border border-slate-700 text-amber-400 font-mono shrink-0">
                    {silo.cementType}
                  </span>
                </div>

                {isOccupied ? (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-400 truncate">
                        {activeJob.truckNumber} (#{activeJob.receiptNumber})
                      </span>
                      <span className="font-mono font-bold text-slate-200 shrink-0 ml-1">
                        {formatElapsedSeconds(elapsedSec)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
                      <span className="truncate">{language === 'ar' ? "المشغل:" : "Op:"} {activeJob.operator}</span>
                      <span className="font-mono shrink-0">{activeJob.authorisedTonnes} t</span>
                    </div>

                    {/* Admin Emergency Cancel Button */}
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(language === 'ar' ? `إجراء إداري: هل تريد إلغاء التحميل النشط على ${silo.nameAr || silo.nameEn}؟` : `Admin action: Cancel active load on ${silo.nameEn}?`)) {
                            cancelJob(id, 'Admin emergency cancellation');
                          }
                        }}
                        className="w-full mt-1 py-1 px-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span>{language === 'ar' ? "إلغاء إداري إجباري" : "Admin Force Cancel"}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{language === 'ar' ? "متاحة وجاهزة للتحميل" : "Idle & Ready for Loading"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
