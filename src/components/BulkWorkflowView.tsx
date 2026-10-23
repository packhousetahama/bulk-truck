import React, { useState } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkSiloId, BulkTicketData } from '../types';
import { BULK_SILOS } from '../utils/constants';
import { BulkSiloSelector } from './BulkSiloSelector';
import { BulkQRScannerModal } from './BulkQRScannerModal';
import { BulkConflictModal } from './BulkConflictModal';
import { BulkStoppageModal } from './BulkStoppageModal';
import { BulkCompleteModal } from './BulkCompleteModal';
import { formatElapsedSeconds } from '../utils/timeZone';
import {
  Camera,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Truck,
  Hash,
  Scale,
  User as UserIcon,
  Phone,
  Flame,
  ShieldCheck,
  XCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export const BulkWorkflowView: React.FC = () => {
  const {
    currentUser,
    activeJobs,
    activeNowMs,
    startJob,
    reportStoppage,
    resolveStoppage,
    completeJob,
    cancelJob,
    language,
    showToast,
    t
  } = useBulkApp();

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isStoppageModalOpen, setIsStoppageModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedActiveSiloId, setSelectedActiveSiloId] = useState<BulkSiloId | null>(null);

  // Scanned ticket in progress of review
  const [pendingTicket, setPendingTicket] = useState<BulkTicketData | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<BulkSiloId | null>(null);
  const [conflictResolutionNote, setConflictResolutionNote] = useState<string | undefined>(undefined);
  const [showAllSilos, setShowAllSilos] = useState(false);

  // Manual entry toggle
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualTonnes, setManualTonnes] = useState('30');
  const [manualCement, setManualCement] = useState<'OPC' | 'GU' | 'PPC'>('OPC');

  // Find user's active jobs or any ongoing active jobs
  const activeSiloIds = Object.keys(activeJobs) as BulkSiloId[];
  const userActiveSiloId = activeSiloIds.find(
    sId => activeJobs[sId]?.operator.toLowerCase() === currentUser.name.toLowerCase()
  ) || activeSiloIds[0] || null;

  const currentActiveJob = userActiveSiloId ? activeJobs[userActiveSiloId] : null;

  const handleScanSuccess = (res: any) => {
    setIsScannerOpen(false);
    if (!res.success) {
      showToast(res.error || 'Failed to parse QR code', 'error');
      return;
    }
    const ticket: BulkTicketData = res.ticket;
    setPendingTicket(ticket);

    // If conflict detected, prompt conflict modal immediately
    if (ticket.conflictDetected) {
      setIsConflictModalOpen(true);
    } else if (ticket.proposedSiloId) {
      setSelectedSiloId(ticket.proposedSiloId);
    }
  };

  const handleConflictResolved = (resolvedSiloId: BulkSiloId, note: string) => {
    setIsConflictModalOpen(false);
    setSelectedSiloId(resolvedSiloId);
    setConflictResolutionNote(note);
    showToast(`Conflict resolved: Assigned to ${BULK_SILOS[resolvedSiloId].nameEn}`, 'info');
  };

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPlate.trim() || !manualReceipt.trim()) {
      showToast('Please enter both plate and receipt numbers.', 'error');
      return;
    }
    const ticket: BulkTicketData = {
      variant: 'MANUAL',
      receiptNumber: manualReceipt.trim().toUpperCase(),
      vehicleNumber: manualPlate.trim().toUpperCase(),
      cementType: manualCement,
      authorisedTonnes: parseFloat(manualTonnes) || 30
    };
    setPendingTicket(ticket);
    setShowManualInputs(false);
  };

  const handleStartLoading = async () => {
    if (!pendingTicket || !selectedSiloId) return;
    const ok = await startJob(selectedSiloId, pendingTicket, conflictResolutionNote);
    if (ok) {
      setPendingTicket(null);
      setSelectedSiloId(null);
      setConflictResolutionNote(undefined);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      {/* 1. ACTIVE LOADING HUD (If an active job exists) */}
      {currentActiveJob && (
        <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400">
                {currentActiveJob.status === 'STOPPAGE'
                  ? language === 'ar' ? 'عطل / توقف بالتحميل' : 'STOPPAGE IN PROGRESS'
                  : language === 'ar' ? 'تحميل مباشر قيد التنفيذ' : 'ACTIVE LOADING IN PROGRESS'}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-950 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-800">
              {BULK_SILOS[currentActiveJob.siloId].nameEn} · {BULK_SILOS[currentActiveJob.siloId].defaultStation}
            </span>
          </div>

          {/* Big High-Contrast Elapsed Timer */}
          <div className="bg-slate-950/90 rounded-2xl p-5 border border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {language === 'ar' ? 'الوقت الإجمالي المنقضي' : 'Gross Elapsed Time'}
            </span>
            <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-amber-400 drop-shadow-md">
              {formatElapsedSeconds(
                Math.max(0, Math.floor((activeNowMs - currentActiveJob.startEpochMs) / 1000))
              )}
            </div>

            {/* Stoppage Banner */}
            {currentActiveJob.status === 'STOPPAGE' && (
              <div className="mt-3 w-full bg-red-950/60 border border-red-500/50 rounded-xl p-2.5 flex items-center justify-between text-xs text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-semibold">{currentActiveJob.stoppageReason || 'Stoppage'}</span>
                </div>
                <span className="font-mono font-bold text-red-300">
                  {currentActiveJob.stoppageStartEpochMs
                    ? formatElapsedSeconds(Math.max(0, Math.floor((activeNowMs - currentActiveJob.stoppageStartEpochMs) / 1000)))
                    : ''}
                </span>
              </div>
            )}
          </div>

          {/* Truck and Material Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                {language === 'ar' ? 'رقم الشاحنة' : 'Truck Plate'}
              </span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                {currentActiveJob.truckNumber}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                {language === 'ar' ? 'رقم الإيصال' : 'Receipt #'}
              </span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {currentActiveJob.receiptNumber}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                {language === 'ar' ? 'نوع الإسمنت والكمية' : 'Material & Tonnes'}
              </span>
              <span className="font-bold text-emerald-400 text-sm">
                {currentActiveJob.cementType} · {currentActiveJob.authorisedTonnes} t
              </span>
            </div>
          </div>

          {/* Action Buttons for Active Load */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {currentActiveJob.status === 'STOPPAGE' ? (
                <button
                  type="button"
                  onClick={() => resolveStoppage(currentActiveJob.siloId)}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{language === 'ar' ? 'استئناف التحميل' : 'Resume Loading'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActiveSiloId(currentActiveJob.siloId);
                    setIsStoppageModalOpen(true);
                  }}
                  className="py-3 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>{language === 'ar' ? 'تسجيل عطل' : 'Report Delay'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedActiveSiloId(currentActiveJob.siloId);
                  setIsCompleteModalOpen(true);
                }}
                className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === 'ar' ? 'إتمام التحميل' : 'Complete & Weigh-Out'}</span>
              </button>
            </div>

            {/* Cancel Load Link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this bulk loading session?')) {
                    cancelJob(currentActiveJob.siloId, 'Operator cancelled');
                  }
                }}
                className="text-[11px] text-red-400/80 hover:text-red-300 underline font-semibold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء التحميل' : 'Cancel this Loading Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TICKET INTAKE: SCAN OR MANUAL ENTRY */}
      {!pendingTicket && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-100 tracking-tight">
              {language === 'ar' ? 'بدء شحنة جديدة' : 'Start New Bulk Dispatch'}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {language === 'ar'
                ? 'امسح رمز التذكرة QR مباشرة عبر الكاميرا للتعرف الفوري على بيانات الشاحنة والصومعة.'
                : 'Scan dispatch ticket QR code to instantly verify vehicle, material, and compatible silo.'}
            </p>
          </div>

          {/* Big Friendly Scan Button */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-3 cursor-pointer"
          >
            <Camera className="w-6 h-6 text-slate-950" />
            <span>{t('scanQR')}</span>
          </button>

          {/* Manual Entry Accordion */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowManualInputs(!showManualInputs)}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              {showManualInputs ? '▲ Hide Manual Entry' : '▼ Or Enter Ticket Manually'}
            </button>

            {showManualInputs && (
              <form onSubmit={handleManualCreate} className="mt-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      {language === 'ar' ? 'رقم اللوحة' : 'Truck License Plate'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4093-ASA"
                      value={manualPlate}
                      onChange={e => setManualPlate(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      {language === 'ar' ? 'رقم الإيصال' : 'Dispatch Receipt #'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6L9JMQ"
                      value={manualReceipt}
                      onChange={e => setManualReceipt(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      {language === 'ar' ? 'نوع الإسمنت' : 'Cement Type'}
                    </label>
                    <select
                      value={manualCement}
                      onChange={e => setManualCement(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="OPC">OPC (Ordinary Portland)</option>
                      <option value="GU">GU (General Use / Resistant)</option>
                      <option value="PPC">PPC (Portland Pozzolana)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      {language === 'ar' ? 'الكمية (طن)' : 'Authorised Tonnes'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={manualTonnes}
                      onChange={e => setManualTonnes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95"
                >
                  {language === 'ar' ? 'متابعة لاختيار الصومعة' : 'Proceed to Silo Selection'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. TICKET REVIEW & SILO SELECTION */}
      {pendingTicket && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                {language === 'ar' ? 'مراجعة بيانات التذكرة' : 'Ticket Details Verified'}
              </span>
              <h2 className="text-base font-black text-slate-100">
                {pendingTicket.vehicleNumber}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingTicket(null);
                setSelectedSiloId(null);
                setConflictResolutionNote(undefined);
              }}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              {language === 'ar' ? 'إلغاء والمسح مجدداً' : 'Clear & Rescan'}
            </button>
          </div>

          {/* Ticket Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block">Receipt</span>
              <span className="font-mono font-bold text-slate-100">{pendingTicket.receiptNumber}</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block">Cement</span>
              <span className="font-bold text-amber-400">{pendingTicket.cementType}</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block">Authorised</span>
              <span className="font-mono font-bold text-slate-100">{pendingTicket.authorisedTonnes} t</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block">Format</span>
              <span className="font-mono text-[11px] text-slate-300">
                {pendingTicket.variant === 'VARIANT_1_PIPE' ? 'Variant 1 (Pipe)' : pendingTicket.variant === 'VARIANT_2_JSON' ? 'Variant 2 (JSON)' : 'Manual'}
              </span>
            </div>
          </div>

          {/* Conflict notice badge if resolved */}
          {conflictResolutionNote && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{conflictResolutionNote}</span>
            </div>
          )}

          {/* 4 Large Silo Selection Cards */}
          <BulkSiloSelector
            selectedSiloId={selectedSiloId}
            onSelectSilo={id => setSelectedSiloId(id)}
            targetCementType={pendingTicket.cementType}
            showAllOverride={showAllSilos}
            onToggleShowAll={() => setShowAllSilos(!showAllSilos)}
          />

          {/* Start Loading Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!selectedSiloId}
              onClick={handleStartLoading}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>
                {selectedSiloId
                  ? language === 'ar'
                    ? `بدء التحميل من ${BULK_SILOS[selectedSiloId].nameAr}`
                    : `Start Loading at ${BULK_SILOS[selectedSiloId].nameEn}`
                  : language === 'ar'
                  ? 'اختر صومعة للبدء'
                  : 'Select an Authorised Silo to Start'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <BulkQRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <BulkConflictModal
        isOpen={isConflictModalOpen}
        ticket={pendingTicket}
        onConfirmResolution={handleConflictResolved}
        onCancel={() => {
          setIsConflictModalOpen(false);
          setPendingTicket(null);
        }}
      />

      {selectedActiveSiloId && (
        <BulkStoppageModal
          isOpen={isStoppageModalOpen}
          siloId={selectedActiveSiloId}
          onClose={() => setIsStoppageModalOpen(false)}
          onSubmit={async (reason, comment) => {
            setIsStoppageModalOpen(false);
            await reportStoppage(selectedActiveSiloId, reason, comment);
          }}
        />
      )}

      {selectedActiveSiloId && currentActiveJob && (
        <BulkCompleteModal
          isOpen={isCompleteModalOpen}
          job={currentActiveJob}
          onClose={() => setIsCompleteModalOpen(false)}
          onConfirmComplete={async actualTonnes => {
            setIsCompleteModalOpen(false);
            await completeJob(selectedActiveSiloId, actualTonnes);
          }}
        />
      )}
    </div>
  );
};
