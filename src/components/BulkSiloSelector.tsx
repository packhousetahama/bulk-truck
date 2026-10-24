import React from 'react';
import { BulkSiloId, CementType } from '../types';
import { BULK_SILO_IDS, BULK_SILOS, BULK_CEMENT_COMPATIBLE_SILOS } from '../utils/constants';
import { useBulkApp } from '../context/BulkAppContext';
import { formatElapsedSeconds } from '../utils/timeZone';
import { CheckCircle2, AlertTriangle, Clock, Truck, Lock } from 'lucide-react';

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
    <div className="space-y-2.5">
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

      {/* 2x2 Silo Cards Grid (Truck-Entry format: 2 columns on mobile, 2 columns on desktop) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {BULK_SILO_IDS.map(siloId => {
          const silo = BULK_SILOS[siloId];
          const activeJob = activeJobs[siloId];
          const isSelected = selectedSiloId === siloId;
          const isCompatible = !targetCementType || compatibleSilos.includes(siloId);
          const isOccupied = !!activeJob;
          const colors = getCementColor(silo.cementType);

          // Calculate active job elapsed time
          let elapsedSec = 0;
          if (activeJob && activeJob.startEpochMs) {
            const diff = Math.floor((activeNowMs - activeJob.startEpochMs) / 1000);
            elapsedSec = isNaN(diff) || diff < 0 ? 0 : diff;
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
              className={`relative p-2.5 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[110px] ${
                isSelected
                  ? `${colors.selectedBorder} ring-2 ring-amber-500 shadow-lg shadow-amber-500/10`
                  : isOccupied
                  ? 'bg-slate-900/40 border-slate-800/80 opacity-75 cursor-not-allowed'
                  : !isCompatible
                  ? 'bg-slate-950/50 border-slate-900 opacity-40 cursor-not-allowed'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850 shadow-sm'
              }`}
            >
              {/* Header: Silo Name, Station & Cement Badge */}
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-slate-100 tracking-tight truncate">
                      {language === 'ar' ? silo.nameAr : silo.nameEn}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block truncate">
                    {silo.defaultStation}
                  </span>
                </div>

                {/* Mapped Cement Badge */}
                <div
                  className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black tracking-wider uppercase border shrink-0 ${colors.badge}`}
                >
                  {silo.cementType}
                </div>
              </div>

              {/* Body / Live Status Indicator */}
              <div className="mt-2 pt-1.5 border-t border-slate-800/60">
                {isOccupied ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold">
                      <span className="flex items-center gap-1 text-amber-400 truncate">
                        <Truck className="w-3 h-3 shrink-0" />
                        <span className="font-mono truncate">{activeJob.truckNumber}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-300 font-mono text-[9px] sm:text-[10px] shrink-0">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {formatElapsedSeconds(elapsedSec)}
                      </span>
                    </div>
                    {activeJob.status === 'STOPPAGE' ? (
                      <div className="flex items-center gap-1 text-[9px] font-semibold text-red-400 bg-red-950/40 px-1 py-0.5 rounded border border-red-800/50 truncate">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{activeJob.stoppageReason || 'Stoppage'}</span>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400 truncate">
                        {language === 'ar' ? 'المشغل:' : 'Op:'} {activeJob?.operator || 'Operator'}
                      </div>
                    )}
                  </div>
                ) : !isCompatible ? (
                  <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-red-400/80 font-medium truncate">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {language === 'ar'
                        ? `غير متوافق (${silo.cementType} ≠ ${targetCementType})`
                        : `Incompatible (${silo.cementType} ≠ ${targetCementType})`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-emerald-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{t('idle')}</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">Ready</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Incompatible Silo Toggle Helper */}
      {targetCementType && (
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 px-1 pt-0.5">
          <span className="truncate">
            {compatibleSilos.length === 1
              ? language === 'ar'
                ? `المتوافقة: ${BULK_SILOS[compatibleSilos[0]].nameAr}`
                : `Compatible: ${BULK_SILOS[compatibleSilos[0]].nameEn}`
              : language === 'ar'
              ? `المتوافقة: صومعة جديدة 5 أو 6`
              : `Compatible: New Silo 5 or New Silo 6`}
          </span>
          {onToggleShowAll && (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="text-amber-400 hover:text-amber-300 underline font-semibold ml-2 cursor-pointer shrink-0"
            >
              {showAllOverride ? 'Hide' : 'Show All'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
