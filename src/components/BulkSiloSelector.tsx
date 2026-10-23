import React from 'react';
import { BulkSiloId, CementType } from '../types';
import { BULK_SILO_IDS, BULK_SILOS, BULK_CEMENT_COMPATIBLE_SILOS } from '../utils/constants';
import { useBulkApp } from '../context/BulkAppContext';
import { formatElapsedSeconds } from '../utils/timeZone';
import { CheckCircle2, AlertTriangle, Clock, Truck, ShieldAlert, Lock } from 'lucide-react';

interface BulkSiloSelectorProps {
  selectedSiloId: BulkSiloId | null;
  onSelectSilo: (id: BulkSiloId) => void;
  targetCementType?: CementType;
  showAllOverride?: boolean;
  onToggleShowAll?: () => void;
}

export const BulkSiloSelector: React.FC<BulkSiloSelectorProps> = ({
  selectedSiloId,
  onSelectSilo,
  targetCementType,
  showAllOverride = false,
  onToggleShowAll
}) => {
  const { activeJobs, activeNowMs, language, t } = useBulkApp();

  const compatibleSilos = targetCementType
    ? BULK_CEMENT_COMPATIBLE_SILOS[targetCementType] || []
    : BULK_SILO_IDS;

  const getCementColor = (cement: CementType) => {
    switch (cement) {
      case 'OPC':
        return {
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          ring: 'focus:ring-emerald-500',
          selectedBorder: 'border-emerald-500 bg-emerald-950/20'
        };
      case 'GU':
        return {
          badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
          ring: 'focus:ring-sky-500',
          selectedBorder: 'border-sky-500 bg-sky-950/20'
        };
      case 'PPC':
        return {
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          ring: 'focus:ring-amber-500',
          selectedBorder: 'border-amber-500 bg-amber-950/20'
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          {language === 'ar' ? 'اختر صومعة التحميل المعتمدة' : 'Select Authorised Loading Silo'}
        </h3>
        {targetCementType && (
          <span className="text-xs font-semibold text-slate-300">
            {language === 'ar' ? 'نوع الإسمنت المطلوب:' : 'Required Material:'}{' '}
            <span className="font-mono font-bold text-amber-400">{targetCementType}</span>
          </span>
        )}
      </div>

      {/* 4 Large Silo Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {BULK_SILO_IDS.map(siloId => {
          const silo = BULK_SILOS[siloId];
          const activeJob = activeJobs[siloId];
          const isSelected = selectedSiloId === siloId;
          const isCompatible = !targetCementType || compatibleSilos.includes(siloId);
          const isOccupied = !!activeJob;
          const colors = getCementColor(silo.cementType);

          // Calculate active job elapsed time
          let elapsedSec = 0;
          if (activeJob) {
            elapsedSec = Math.max(0, Math.floor((activeNowMs - activeJob.startEpochMs) / 1000));
          }

          const isDisabled = (!isCompatible && !showAllOverride) || isOccupied;

          return (
            <button
              key={siloId}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onSelectSilo(siloId);
              }}
              className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[140px] ${
                isSelected
                  ? `${colors.selectedBorder} ring-2 ring-amber-500 shadow-xl shadow-amber-500/10 scale-[1.01]`
                  : isOccupied
                  ? 'bg-slate-900/40 border-slate-800/80 opacity-75 cursor-not-allowed'
                  : !isCompatible
                  ? 'bg-slate-950/50 border-slate-900 opacity-40 cursor-not-allowed'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850 shadow-md'
              }`}
            >
              {/* Header: Silo Name, Station & Cement Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                      {language === 'ar' ? silo.nameAr : silo.nameEn}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {silo.defaultStation}
                  </span>
                </div>

                {/* Mapped Cement Badge */}
                <div
                  className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-wider uppercase border shadow-sm ${colors.badge}`}
                >
                  {silo.cementType}
                </div>
              </div>

              {/* Body / Live Status Indicator */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/60">
                {isOccupied ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Truck className="w-3.5 h-3.5" />
                        <span className="font-mono">{activeJob.truckNumber}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-300 font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {formatElapsedSeconds(elapsedSec)}
                      </span>
                    </div>
                    {activeJob.status === 'STOPPAGE' ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-800/50">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{activeJob.stoppageReason || 'Stoppage'}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        {language === 'ar' ? 'المشغل:' : 'Operator:'} {activeJob.operator}
                      </div>
                    )}
                  </div>
                ) : !isCompatible ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-400/80 font-medium">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {language === 'ar'
                        ? `غير متوافق (${silo.cementType} ≠ ${targetCementType})`
                        : `Incompatible (${silo.cementType} ≠ ${targetCementType})`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {t('idle')}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Ready</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Incompatible Silo Toggle Helper */}
      {targetCementType && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <span>
            {compatibleSilos.length === 1
              ? language === 'ar'
                ? `الصومعة الوحيدة المتوافقة مع ${targetCementType} هي ${BULK_SILOS[compatibleSilos[0]].nameAr}`
                : `Sole compatible silo for ${targetCementType} is ${BULK_SILOS[compatibleSilos[0]].nameEn}`
              : language === 'ar'
              ? `الصوامع المتوافقة مع ${targetCementType}: صومعة جديدة 5 أو 6`
              : `Compatible silos for ${targetCementType}: New Silo 5 or New Silo 6`}
          </span>
          {onToggleShowAll && (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="text-amber-400 hover:text-amber-300 underline font-semibold ml-2 cursor-pointer"
            >
              {showAllOverride ? 'Hide Incompatible' : 'Show All Silos'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
