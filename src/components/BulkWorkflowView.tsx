import React, { useState } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkSiloId, BulkTicketData, CementType, BulkEntry } from '../types';
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
  AlertCircle,
  Ban
} from 'lucide-react';

export const BulkWorkflowView: React.FC = () => {
  const {
    currentUser,
    activeJobs,
    activeNowMs,
    recentEntries,
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
  const [manualCement, setManualCement] = useState<CementType>('OPC');
  const [manualDriverName, setManualDriverName] = useState('');
  const [manualDriverPhone, setManualDriverPhone] = useState('');
  const [manualDriverId, setManualDriverId] = useState('');

  // Find user's active jobs or any ongoing active jobs
  const activeSiloIds = Object.keys(activeJobs) as BulkSiloId[];
  const userActiveSiloId = activeSiloIds.find(
    sId => {
      const jobOp = String(activeJobs[sId]?.operator || '').toLowerCase();
      const userOp = String(currentUser?.name || '').toLowerCase();
      return jobOp && userOp && jobOp === userOp;
    }
  ) || activeSiloIds[0] || null;

  const currentActiveJob = userActiveSiloId ? activeJobs[userActiveSiloId] : null;

  // Duplicate Check against active jobs and recorded entries
  const currentReceiptNormalized = (pendingTicket?.receiptNumber || manualReceipt || '').trim().toUpperCase();
  const duplicateActive = currentReceiptNormalized
    ? Object.values(activeJobs).find(
        j => j && j.receiptNumber.trim().toUpperCase() === currentReceiptNormalized
      )
    : undefined;

  const duplicateRecorded = currentReceiptNormalized
    ? (recentEntries || []).find(
        (e: BulkEntry) => e && String(e.receiptNumber || '').trim().toUpperCase() === currentReceiptNormalized
      )
    : undefined;

  const isDuplicateReceipt = !!(duplicateActive || duplicateRecorded);

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
      authorisedTonnes: parseFloat(manualTonnes) || 30,
      driverName: manualDriverName.trim() || undefined,
      driverPhone: manualDriverPhone.trim() || undefined,
      driverId: manualDriverId.trim() || undefined
    };

    // Auto propose silo based on cement
    if (manualCement === 'PPC') ticket.proposedSiloId = 'OLD_2';
    else if (manualCement === 'GU') ticket.proposedSiloId = 'OLD_1';
    else ticket.proposedSiloId = 'NEW_5';

    setPendingTicket(ticket);
    setSelectedSiloId(ticket.proposedSiloId);
    setShowManualInputs(false);
  };

  const handleStartLoading = async () => {
    if (!pendingTicket || !selectedSiloId) return;

    if (isDuplicateReceipt && currentUser.role !== 'admin') {
      showToast('Duplicate load blocked: Receipt already recorded or active.', 'error');
      return;
    }

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
              {BULK_SILOS[currentActiveJob.siloId]?.nameEn || currentActiveJob.siloId} · {BULK_SILOS[currentActiveJob.siloId]?.defaultStation || 'Bay'}
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

            {/* Driver Details in Active HUD */}
            {currentActiveJob.driverName && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-3 flex items-center justify-between text-[11px] text-slate-300">
                <span className="text-slate-400">Driver: <strong className="text-white">{currentActiveJob.driverName}</strong></span>
                {currentActiveJob.driverPhone && <span className="font-mono text-slate-400">{currentActiveJob.driverPhone}</span>}
                {currentActiveJob.driverId && <span className="font-mono text-amber-400/80">ID: {currentActiveJob.driverId}</span>}
              </div>
            )}
          </div>

          {/* Action Buttons for Active Load */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {currentActiveJob.status === 'STOPPAGE' ? (
                <button
                  type="button"
                  onClick={() => resolveStoppage(currentActiveJob.siloId)}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
                  className="py-3 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
                className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
                : 'Scan dispatch ticket QR code to verify vehicle, material, and compatible silo.'}
            </p>
          </div>

          {/* Big Friendly Scan Button matching Truck-Entry */}
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
                      {language === 'ar' ? 'رقم اللوحة' : 'Truck License Plate'} *
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
                      {language === 'ar' ? 'رقم الإيصال' : 'Dispatch Receipt #'} *
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Iqbal"
                      value={manualDriverName}
                      onChange={e => setManualDriverName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Phone</label>
                    <input
                      type="text"
                      placeholder="+966..."
                      value={manualDriverPhone}
                      onChange={e => setManualDriverPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Iqama / ID</label>
                    <input
                      type="text"
                      placeholder="10-digit ID"
                      value={manualDriverId}
                      onChange={e => setManualDriverId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 cursor-pointer"
                >
                  {language === 'ar' ? 'متابعة لاختيار الصومعة' : 'Proceed to Silo Selection'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. TICKET REVIEW & EDITABLE BOXES (Matching Truck-Entry design) */}
      {pendingTicket && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                {language === 'ar' ? 'مراجعة بيانات التذكرة' : 'Ticket Details Verified'}
              </span>
              <h2 className="text-base font-black text-slate-100 font-mono">
                {pendingTicket.vehicleNumber || 'NEW TRUCK'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingTicket(null);
                setSelectedSiloId(null);
                setConflictResolutionNote(undefined);
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              {language === 'ar' ? 'إلغاء والمسح مجدداً' : 'Clear & Rescan'}
            </button>
          </div>

          {/* DUPLICATE RECEIPT WARNING BANNER (Matching Truck-Entry Ban Banner) */}
          {isDuplicateReceipt && (
            <div className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500/80 flex items-start gap-3 text-xs text-red-200 shadow-xl shadow-red-950/50 animate-in fade-in">
              <div className="p-2 rounded-xl bg-red-900/80 text-red-300 shrink-0 mt-0.5">
                <Ban className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-red-100 tracking-wide">
                    {language === 'ar' ? 'تذكرة مكررة - تم تسجيل هذا الإيصال' : 'Duplicate Dispatch Receipt Detected'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    {duplicateActive ? 'Currently Loading' : 'Recorded in Google Sheets'}
                  </span>
                </div>
                <p className="text-xs text-red-200/90 leading-relaxed">
                  Receipt <strong className="font-mono text-red-100 font-bold">#{pendingTicket.receiptNumber}</strong>
                  {duplicateRecorded
                    ? ` has already been recorded in Google Sheets on ${duplicateRecorded.date} by ${duplicateRecorded.operator} (${duplicateRecorded.siloName}).`
                    : duplicateActive
                    ? ` is currently actively loading on ${duplicateActive.siloId} by ${duplicateActive.operator}.`
                    : ' is a duplicate.'}
                </p>
                {currentUser?.role === 'admin' && (
                  <p className="text-[11px] text-amber-300/90 pt-1">
                    * Admin Privilege: You may review or modify parameters and proceed if this is an authorized re-dispatch.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* EXTRACTED DETAILS CARD - EXACT TRUCK ENTRY BOXES */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5 shadow-lg">
            {/* Header with Receipt and Clickable Cement Selector */}
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Scanned Receipt:</span>
                <span className="font-mono font-bold text-amber-400">#{pendingTicket.receiptNumber}</span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 ml-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              </div>
              {/* Clickable Cement Type Selector Pills */}
              <div className="flex items-center gap-1.5">
                {(['OPC', 'GU', 'PPC'] as CementType[]).map(lbl => {
                  const isSel = pendingTicket.cementType === lbl;
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        setPendingTicket(prev => prev ? { ...prev, cementType: lbl } : null);
                        if (lbl === 'PPC') setSelectedSiloId('OLD_2');
                        else if (lbl === 'GU') setSelectedSiloId('OLD_1');
                        else setSelectedSiloId('NEW_5');
                      }}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        isSel
                          ? lbl === 'OPC'
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                            : lbl === 'GU'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/30'
                            : 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-500/30'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cement Type Summary Callout */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                  {language === 'ar' ? 'نوع الإسمنت السائب' : 'Bulk Material Description'}
                </span>
                <span className="text-xs font-bold text-slate-100">
                  {pendingTicket.cementType === 'OPC'
                    ? 'Ordinary Portland Cement (OPC) · Bulk'
                    : pendingTicket.cementType === 'PPC'
                    ? 'Portland Pozzolana Cement (PPC) · Bulk'
                    : 'General Use / Resistant Cement (GU) · Bulk'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                Bulk Silo Loading
              </span>
            </div>

            {/* Editable Fields Grid (2 Columns, matching Truck Entry form boxes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Vehicle Number (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'رقم الشاحنة / اللوحة' : 'Vehicle / Plate Number'}</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.vehicleNumber}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, vehicleNumber: e.target.value.toUpperCase() } : null)}
                  placeholder="e.g. 4093-ASA"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Receipt Number (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'رقم الإيصال / الشحنة' : 'Receipt / Dispatch #'}</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.receiptNumber}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, receiptNumber: e.target.value.toUpperCase() } : null)}
                  placeholder="e.g. 6L9JMQ"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Authorised Tonnes (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'الكمية المصرح بها (طن)' : 'Authorised Tonnes'}</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={pendingTicket.authorisedTonnes || ''}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, authorisedTonnes: parseFloat(e.target.value) || 0 } : null)}
                  placeholder="30"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Ticket Silo Reference (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'الصومعة المطبوعة بالتذكرة' : 'Ticket Silo Reference'}</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.printedSiloRef || ''}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, printedSiloRef: e.target.value } : null)}
                  placeholder="e.g. Tahama-Silo 6"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Driver Name (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'اسم السائق' : 'Driver Name'}</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.driverName || ''}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, driverName: e.target.value } : null)}
                  placeholder="e.g. Iqbal"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Driver Phone (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'رقم هاتف السائق' : 'Driver Phone'}</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.driverPhone || ''}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, driverPhone: e.target.value } : null)}
                  placeholder="+966..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Driver ID / Iqama (Editable) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'رقم الهوية / الإقامة' : 'Driver ID / Iqama'}</span>
                </label>
                <input
                  type="text"
                  value={pendingTicket.driverId || ''}
                  onChange={e => setPendingTicket(prev => prev ? { ...prev, driverId: e.target.value } : null)}
                  placeholder="10-digit Iqama / ID"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Operator & Shift Info */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'المشغل والوردية' : 'Assigned Operator & Shift'}</span>
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>{currentUser?.name || 'Operator'}</span>
                  <span className="text-[10px] font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                    Active Session
                  </span>
                </div>
              </div>
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
              disabled={!selectedSiloId || (isDuplicateReceipt && currentUser?.role !== 'admin')}
              onClick={handleStartLoading}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>
                {selectedSiloId && BULK_SILOS[selectedSiloId]
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
          if (pendingTicket?.proposedSiloId) {
            setSelectedSiloId(pendingTicket.proposedSiloId);
          }
        }}
      />

      {selectedActiveSiloId && (
        <BulkStoppageModal
          isOpen={isStoppageModalOpen}
          siloId={selectedActiveSiloId}
          onClose={() => {
            setIsStoppageModalOpen(false);
            setSelectedActiveSiloId(null);
          }}
          onSubmit={async (reason, comment) => {
            await reportStoppage(selectedActiveSiloId, reason, comment);
            setIsStoppageModalOpen(false);
            setSelectedActiveSiloId(null);
          }}
        />
      )}

      <BulkCompleteModal
        isOpen={isCompleteModalOpen}
        job={selectedActiveSiloId ? activeJobs[selectedActiveSiloId] || null : null}
        onClose={() => {
          setIsCompleteModalOpen(false);
          setSelectedActiveSiloId(null);
        }}
        onConfirmComplete={async (actualTonnes) => {
          if (selectedActiveSiloId) {
            await completeJob(selectedActiveSiloId, actualTonnes);
          }
          setIsCompleteModalOpen(false);
          setSelectedActiveSiloId(null);
        }}
      />
    </div>
  );
};
