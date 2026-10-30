import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkSiloId, BulkTicketData, CementType, BulkEntry } from '../types';
import {
  BULK_SILOS,
  BULK_SILO_IDS,
  BULK_CEMENT_COMPATIBLE_SILOS,
  isSameOperator
} from '../utils/constants';
import { BulkQRScannerModal } from './BulkQRScannerModal';
import { BulkConflictModal } from './BulkConflictModal';
import { BulkStoppageModal } from './BulkStoppageModal';
import { BulkUserModal } from './BulkUserModal';
import { getSaudiCurrentTimeOnly } from '../utils/timeZone';
import { calculateBulkSessionElapsed } from '../utils/timerUtils';
import {
  Camera,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Lock,
  PlusCircle,
  ArrowLeft,
  ShieldCheck,
  Ban
} from 'lucide-react';

export const BulkWorkflowView: React.FC = () => {
  const {
    currentUser,
    activeJobs,
    activeNowMs,
    recentEntries,
    refreshRecentEntries,
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
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isStoppageModalOpen, setIsStoppageModalOpen] = useState(false);
  const [selectedActiveSiloId, setSelectedActiveSiloId] = useState<BulkSiloId | null>(null);

  // Multi-silo state: which silo is currently focused in HUD
  const [focusedSiloId, setFocusedSiloId] = useState<BulkSiloId | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);

  // Scanned ticket in review
  const [pendingTicket, setPendingTicket] = useState<BulkTicketData | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<BulkSiloId | null>(null);
  const [conflictResolutionNote, setConflictResolutionNote] = useState<string | undefined>(undefined);
  const [allowForceReload, setAllowForceReload] = useState(false);
  const [isStartingLoader, setIsStartingLoader] = useState(false);
  const [isCompletingLoader, setIsCompletingLoader] = useState(false);
  const [isResolvingSilo, setIsResolvingSilo] = useState<string | null>(null);

  // Form Fields State
  const [actualTonnesInput, setActualTonnesInput] = useState<string>('');

  // Admin Manual entry toggle
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualTonnes, setManualTonnes] = useState('30');
  const [manualCement, setManualCement] = useState<CementType>('OPC');
  const [manualDriverName, setManualDriverName] = useState('');
  const [manualDriverPhone, setManualDriverPhone] = useState('');
  const [manualDriverId, setManualDriverId] = useState('');

  // Active silos list
  const activeSiloIds = (Object.keys(activeJobs) as BulkSiloId[]).filter(sId => Boolean(activeJobs[sId]));
  const hasActiveJobs = activeSiloIds.length > 0;

  // Determine which active job is displayed
  const effectiveActiveSiloId: BulkSiloId | null = (focusedSiloId && activeJobs[focusedSiloId])
    ? focusedSiloId
    : (activeSiloIds.find(sId => {
        const jobOp = String(activeJobs[sId]?.operator || '').toLowerCase();
        const userOp = String(currentUser?.name || '').toLowerCase();
        return jobOp && userOp && jobOp === userOp;
      }) || activeSiloIds[0] || null);

  const currentActiveJob = effectiveActiveSiloId ? activeJobs[effectiveActiveSiloId] : null;

  // Sync actual tonnes input when active job changes or ticket scanned
  useEffect(() => {
    if (currentActiveJob) {
      setActualTonnesInput(String((currentActiveJob as any).actualTonnes || currentActiveJob.authorisedTonnes || ''));
    } else if (pendingTicket) {
      setActualTonnesInput(String(pendingTicket.authorisedTonnes || '30'));
    }
  }, [currentActiveJob?.receiptNumber, pendingTicket?.receiptNumber]);

  // Ownership permission
  const isJobOwnedByOther = Boolean(
    currentActiveJob &&
    currentUser &&
    currentUser.role !== 'admin' &&
    (currentActiveJob.operator || (currentActiveJob as any).operatorName) &&
    !isSameOperator(currentActiveJob.operator || (currentActiveJob as any).operatorName, currentUser.name) &&
    !isSameOperator(currentActiveJob.operator || (currentActiveJob as any).operatorName, currentUser.id)
  );

  const canControlJob = Boolean(
    currentActiveJob &&
    currentUser &&
    (currentUser.role === 'admin' ||
     isSameOperator(currentActiveJob.operator || (currentActiveJob as any).operatorName, currentUser.name) ||
     isSameOperator(currentActiveJob.operator || (currentActiveJob as any).operatorName, currentUser.id))
  );

  // Canonical receipt normalize helper
  const cleanReceipt = (pendingTicket?.receiptNumber || manualReceipt || '').trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '');

  const duplicateActive = cleanReceipt
    ? Object.values(activeJobs).find(
        j => j && j.receiptNumber.trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '') === cleanReceipt
      )
    : undefined;

  const duplicateRecorded = cleanReceipt
    ? (recentEntries || []).find((e: BulkEntry) => {
        if (!e) return false;
        const eRec = String(e.receiptNumber || '').trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '');
        const eLoad = String((e as any).loadId || '').trim().toUpperCase();
        const matches = (eRec === cleanReceipt) || (cleanReceipt.length >= 4 && eLoad.includes(cleanReceipt));
        const isCompleted = String(e.status || '').trim().toLowerCase() === 'completed';
        return matches && isCompleted;
      })
    : undefined;

  const isDuplicateReceipt = Boolean(
    (duplicateRecorded && !allowForceReload) ||
    (duplicateActive && selectedSiloId && duplicateActive.siloId !== selectedSiloId)
  );

  const handleScanSuccess = (res: any) => {
    setIsScannerOpen(false);
    if (!res.success) {
      showToast(res.error || 'Failed to parse QR code', 'error');
      return;
    }
    const ticket: BulkTicketData = res.ticket;
    setPendingTicket(ticket);
    setActualTonnesInput(String(ticket.authorisedTonnes || '30'));

    if (ticket.conflictDetected) {
      setIsConflictModalOpen(true);
    } else {
      // Auto-assign available compatible silo (honoring pre-selected silo if available and compatible)
      const compSilos = BULK_CEMENT_COMPATIBLE_SILOS[ticket.cementType] || BULK_SILO_IDS;
      const idleSilo = (selectedSiloId && !activeJobs[selectedSiloId] && compSilos.includes(selectedSiloId))
        ? selectedSiloId
        : compSilos.find(sId => !activeJobs[sId]);
      setSelectedSiloId(idleSilo || ticket.proposedSiloId || compSilos[0] || 'NEW_5');
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
    if (currentUser?.role !== 'admin') {
      showToast('Manual Entry is restricted to Administrators only.', 'error');
      return;
    }
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
      driverId: manualDriverId.trim() || undefined,
    };

    const compSilos = BULK_CEMENT_COMPATIBLE_SILOS[manualCement] || BULK_SILO_IDS;
    const idleSilo = compSilos.find(sId => !activeJobs[sId]);
    ticket.proposedSiloId = idleSilo || compSilos[0] || 'NEW_5';

    setPendingTicket(ticket);
    setSelectedSiloId(ticket.proposedSiloId);
    setActualTonnesInput(String(ticket.authorisedTonnes));
    setShowManualInputs(false);
  };

  // Primary Action 1: START LOADING
  const handleStartLoading = async () => {
    if (!currentUser) {
      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in before starting a load.', 'error');
      setIsUserModalOpen(true);
      return;
    }
    if (!pendingTicket || !selectedSiloId || isStartingLoader) return;

    if (isDuplicateReceipt) {
      showToast(
        language === 'ar'
          ? 'تم حظر التحميل: تذكرة مكررة مسجلة مسبقاً أو قيد التحميل حالياً'
          : 'Duplicate load blocked: Receipt already recorded or active.',
        'error'
      );
      return;
    }

    const targetSilo = selectedSiloId;
    setIsStartingLoader(true);
    try {
      const ok = await startJob(targetSilo, pendingTicket, conflictResolutionNote, allowForceReload);
      if (ok) {
        setFocusedSiloId(targetSilo);
        setShowIntakeForm(false);
        setPendingTicket(null);
        setSelectedSiloId(null);
        setConflictResolutionNote(undefined);
        setAllowForceReload(false);
      } else {
        if (duplicateRecorded) {
          setAllowForceReload(true);
        }
      }
    } finally {
      setIsStartingLoader(false);
    }
  };

  // Primary Action 2: STOP / PAUSE or RESUME
  const handleToggleStopResume = async () => {
    if (!currentUser) {
      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in with your User ID and PIN.', 'error');
      setIsUserModalOpen(true);
      return;
    }
    if (!currentActiveJob) return;

    if (isJobOwnedByOther) {
      showToast(
        language === 'ar'
          ? `تم رفض الإذن: الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}. يحق فقط له أو للمشرف التحكم بها.`
          : `Permission denied: Silo is being loaded by ${currentActiveJob.operator}.`,
        'error'
      );
      return;
    }

    if (currentActiveJob.status === 'STOPPAGE') {
      // Resume loading
      if (isResolvingSilo) return;
      setIsResolvingSilo(currentActiveJob.siloId);
      try {
        await resolveStoppage(currentActiveJob.siloId);
      } finally {
        setIsResolvingSilo(null);
      }
    } else {
      // Report delay / pause
      setSelectedActiveSiloId(currentActiveJob.siloId);
      setIsStoppageModalOpen(true);
    }
  };

  // Primary Action 3: COMPLETE & SAVE ENTRY
  const handleCompleteAndSave = async () => {
    if (!currentUser) {
      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in before completing a load.', 'error');
      setIsUserModalOpen(true);
      return;
    }
    if (!currentActiveJob) return;

    if (isJobOwnedByOther) {
      showToast(
        language === 'ar'
          ? `تم رفض الإذن: الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}.`
          : `Permission denied: Silo is being loaded by ${currentActiveJob.operator}.`,
        'error'
      );
      return;
    }

    const tonnes = parseFloat(actualTonnesInput) || currentActiveJob.authorisedTonnes || 0;
    if (tonnes <= 0) {
      showToast('Please enter valid actual tonnes loaded before completing.', 'error');
      return;
    }

    setIsCompletingLoader(true);
    try {
      const siloToComplete = currentActiveJob.siloId;
      const ok = await completeJob(siloToComplete, tonnes, 'NONE', 'completed');
      if (ok) {
        showToast(
          language === 'ar'
            ? `تم إتمام الشحنة #${currentActiveJob.receiptNumber} بنجاح (${tonnes} طن) وتحديث شيت قوقل.`
            : `Load #${currentActiveJob.receiptNumber} completed (${tonnes} MT) and saved to Google Sheets.`,
          'success'
        );
        const remaining = activeSiloIds.filter(id => id !== siloToComplete);
        if (remaining.length > 0) {
          setFocusedSiloId(remaining[0]);
        } else {
          setFocusedSiloId(null);
          setShowIntakeForm(false);
          setPendingTicket(null);
        }
      }
    } finally {
      setIsCompletingLoader(false);
    }
  };

  // State separation: Are we inspecting a new scanned ticket vs an active running silo?
  const isViewingPendingTicket = Boolean(pendingTicket);
  const isViewingActiveJob = Boolean(currentActiveJob && !showIntakeForm && !pendingTicket);
  const isShowingForm = isViewingPendingTicket || isViewingActiveJob;
  const isShowingScanIntake = (showIntakeForm || !hasActiveJobs) && !pendingTicket;

  // Active session timer metrics
  const activeSession = isViewingActiveJob && currentActiveJob
    ? calculateBulkSessionElapsed(currentActiveJob, activeNowMs)
    : null;

  // Determine current cement type for compatible silo choice
  const activeCementType: CementType = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.cementType
    : pendingTicket?.cementType || 'OPC';

  const compatibleSilos = BULK_CEMENT_COMPATIBLE_SILOS[activeCementType] || BULK_SILO_IDS;

  const displaySiloId: BulkSiloId = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.siloId
    : selectedSiloId || compatibleSilos.find(sId => !activeJobs[sId]) || compatibleSilos[0] || 'NEW_5';

  const displayReceipt = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.receiptNumber
    : pendingTicket?.receiptNumber || '';
  const displayPlate = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.truckNumber
    : pendingTicket?.vehicleNumber || '';
  const displayAuthTonnes = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.authorisedTonnes
    : (pendingTicket?.authorisedTonnes ?? 30);
  const displayDriverName = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.driverName
    : pendingTicket?.driverName || '';
  const displayDriverPhone = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.driverPhone
    : pendingTicket?.driverPhone || '';
  const displayDriverId = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.driverId
    : pendingTicket?.driverId || '';
  const displayOperator = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.operator
    : (currentUser?.role === 'admin' ? 'ADMIN' : (currentUser?.name || 'Operator'));
  const displayStartTime = isViewingActiveJob && currentActiveJob
    ? currentActiveJob.startTime
    : (pendingTicket ? getSaudiCurrentTimeOnly() : '--:--:--');
  const displayEndTime = isViewingActiveJob && currentActiveJob
    ? (currentActiveJob.status === 'STOPPAGE' ? 'PAUSED' : 'IN PROGRESS')
    : '--:--:--';
  const displayStatus = isViewingActiveJob && currentActiveJob
    ? (currentActiveJob.status === 'STOPPAGE' ? 'STOPPAGE' : 'LOADING')
    : pendingTicket
    ? 'READY TO START'
    : 'IDLE';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      {/* 0. AUTHENTICATION REQUIRED PROMPT */}
      {!currentUser && (
        <div className="bg-amber-950/60 border border-amber-500/60 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-amber-100 block text-sm">
                {language === 'ar' ? 'تسجيل الدخول مطلوب للبدء بالتحميل' : 'Operator Authentication Required'}
              </span>
              <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                {language === 'ar'
                  ? 'يرجى تسجيل الدخول برقم المشغل ورمز المرور للبدء بالتحميل أو تعديل البيانات.'
                  : 'Please sign in with your User ID and Security PIN before starting or operating bulk loads.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsUserModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
          </button>
        </div>
      )}

      {/* 1. LIVE SILO STATIONS OVERVIEW (ALL 4 SILOS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              {language === 'ar' ? 'محطات وصوامع التحميل السائب' : 'Bulk Silo Loading Stations'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {activeSiloIds.length} / 4 {language === 'ar' ? 'قيد التحميل' : 'Active'}
            </span>
            {hasActiveJobs && activeSiloIds.length < 4 && !showIntakeForm && !pendingTicket && (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first.', 'error');
                    setIsUserModalOpen(true);
                    return;
                  }
                  setPendingTicket(null);
                  setShowIntakeForm(true);
                }}
                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 transition shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-3 h-3" />
                <span>{language === 'ar' ? '+ تحميل صومعة' : '+ Add Silo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Silo Cards Grid (2x2) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {BULK_SILO_IDS.map(sId => {
            const silo = BULK_SILOS[sId];
            const job = activeJobs[sId];
            const isFocused = currentActiveJob && currentActiveJob.siloId === sId && !showIntakeForm && !pendingTicket;
            const isStopped = Boolean(job && job.status === 'STOPPAGE');
            const session = calculateBulkSessionElapsed(job, activeNowMs);

            return (
              <div
                key={sId}
                onClick={() => {
                  if (job) {
                    setFocusedSiloId(sId);
                    setShowIntakeForm(false);
                    setPendingTicket(null);
                  } else {
                    if (!currentUser) {
                      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in to start a load.', 'error');
                      setIsUserModalOpen(true);
                      return;
                    }
                    setSelectedSiloId(sId);
                    setShowIntakeForm(true);
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[92px] ${
                  isFocused
                    ? 'bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                    : job
                    ? isStopped
                      ? 'bg-red-950/20 border-red-500/60 hover:bg-red-950/30'
                      : 'bg-slate-950/70 border-amber-500/50 hover:bg-slate-850'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="truncate">
                    <span className="text-[10px] font-bold text-slate-400 block truncate">
                      {silo.defaultStation}
                    </span>
                    <span className="text-xs font-black text-slate-100 truncate block">
                      {silo.nameEn}
                    </span>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                    silo.cementType === 'OPC'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : silo.cementType === 'GU'
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {silo.cementType}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 mt-2 flex items-center justify-between">
                  {job ? (
                    isStopped ? (
                      <div className="flex items-center gap-1.5 text-red-400">
                        <AlertTriangle className="w-3 h-3 animate-pulse shrink-0" />
                        <span className="text-[10px] font-black truncate">{job.stoppageReason || 'STOPPAGE'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                        <span className="text-[10px] font-black">{language === 'ar' ? 'تحميل مباشر' : 'LOADING'}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[10px] font-semibold">{language === 'ar' ? 'متاح' : 'Available'}</span>
                    </div>
                  )}

                  {job ? (
                    <div className="text-right">
                      <span className={`font-mono text-xs font-black block ${isStopped ? 'text-amber-400' : 'text-slate-100'}`}>
                        {session.netFormatted}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-bold hover:text-amber-400">
                      {language === 'ar' ? '+ تحميل' : '+ Load'}
                    </span>
                  )}
                </div>

                {job && (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate">{job.truckNumber}</span>
                    <span className="text-amber-300">#{job.receiptNumber}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MULTI-SILO QUICK SWITCHER TABS (When active jobs exist) */}
      {hasActiveJobs && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-1">
            {language === 'ar' ? 'الصوامع النشطة:' : 'Active Silos:'}
          </span>
          {activeSiloIds.map(sId => {
            const job = activeJobs[sId];
            if (!job) return null;
            const isCurrent = effectiveActiveSiloId === sId && !showIntakeForm && !pendingTicket;
            const isStopped = job.status === 'STOPPAGE';
            const tabSession = calculateBulkSessionElapsed(job, activeNowMs);

            return (
              <button
                key={sId}
                type="button"
                onClick={() => {
                  setFocusedSiloId(sId);
                  setShowIntakeForm(false);
                  setPendingTicket(null);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                    : isStopped
                    ? 'bg-red-950/50 text-red-300 border-red-500/50 hover:bg-red-900/50'
                    : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  isCurrent ? 'bg-slate-950' : isStopped ? 'bg-red-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`} />
                <span>{BULK_SILOS[sId].nameEn}</span>
                <span className="font-mono text-[11px] opacity-90">{tabSession.netFormatted}</span>
              </button>
            );
          })}

          {activeSiloIds.length < 4 && (
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first.', 'error');
                  setIsUserModalOpen(true);
                  return;
                }
                setPendingTicket(null);
                setShowIntakeForm(true);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                showIntakeForm && !pendingTicket
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-black'
                  : 'bg-slate-900/80 text-amber-400 border-dashed border-amber-500/40 hover:bg-amber-500/10'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? '+ بدء صومعة أخرى' : '+ Start Another Silo'}</span>
            </button>
          )}
        </div>
      )}

      {/* 3. HOME VIEW: SCAN QR (No Quick Slips) */}
      {isShowingScanIntake && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          {hasActiveJobs && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="font-bold">
                  {language === 'ar'
                    ? `جاري تحميل ${activeSiloIds.length} صومعة في الخلفية`
                    : `${activeSiloIds.length} Silo(s) Loading in Background`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIntakeForm(false);
                  setPendingTicket(null);
                }}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-bold underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'العودة للصومعة النشطة' : 'Back to Active Load'}</span>
              </button>
            </div>
          )}

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-100 tracking-tight">
              {language === 'ar' ? 'بدء شحنة إسمنت سائب جديدة' : 'Start New Bulk Cement Dispatch'}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {language === 'ar'
                ? 'امسح رمز التذكرة QR مباشرة عبر الكاميرا للتعرف الفوري على بيانات الشاحنة والصومعة.'
                : 'Scan dispatch ticket QR code to verify vehicle, material, and compatible silo.'}
            </p>
          </div>

          {/* Primary Scan Button */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً لمسح التذكرة' : 'Please sign in with User ID and PIN before scanning.', 'warning');
                setIsUserModalOpen(true);
                return;
              }
              setIsScannerOpen(true);
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-3 cursor-pointer"
          >
            <Camera className="w-6 h-6 text-slate-950" />
            <span>{t('scanQR')}</span>
          </button>

          {/* Emergency Manual Entry - Restricted to Administrators Only */}
          {currentUser?.role === 'admin' && (
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowManualInputs(!showManualInputs)}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-amber-400 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span>{showManualInputs ? '▲ Hide Admin Manual Entry' : '▼ Admin Emergency Manual Entry Override'}</span>
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
                        placeholder="Driver Name"
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
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver ID</label>
                      <input
                        type="text"
                        placeholder="Iqama / ID"
                        value={manualDriverId}
                        onChange={e => setManualDriverId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
          )}
        </div>
      )}

      {/* 4. THE CLEAN 12-FIELD LOADING WORKFLOW CARD */}
      {isShowingForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                isViewingActiveJob && currentActiveJob?.status === 'STOPPAGE'
                  ? 'bg-red-400 animate-pulse'
                  : isViewingActiveJob
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-emerald-400'
              }`} />
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                  {isViewingActiveJob && currentActiveJob
                    ? currentActiveJob.status === 'STOPPAGE'
                      ? (language === 'ar' ? 'توقف / عطل بالتحميل' : 'STOPPAGE IN PROGRESS')
                      : (language === 'ar' ? 'تحميل مباشر قيد التنفيذ' : 'ACTIVE LOADING IN PROGRESS')
                    : (language === 'ar' ? 'تذكرة مؤكدة - جاهزة للبدء' : 'TICKET VERIFIED — READY TO LOAD')}
                </span>
                <h2 className="text-base font-black text-slate-100 font-mono">
                  {displayPlate || 'NEW TRUCK'}
                </h2>
              </div>
            </div>

            {isViewingPendingTicket && (
              <button
                type="button"
                onClick={() => {
                  setPendingTicket(null);
                  setSelectedSiloId(null);
                  setConflictResolutionNote(undefined);
                  setAllowForceReload(false);
                  refreshRecentEntries();
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء والمسح مجدداً' : 'Clear & Rescan'}
              </button>
            )}
          </div>

          {/* DUPLICATE RECEIPT WARNING BANNER */}
          {isDuplicateReceipt && isViewingPendingTicket && (
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
                  Receipt <strong className="font-mono text-red-100 font-bold">#{pendingTicket?.receiptNumber}</strong>
                  {duplicateRecorded
                    ? ` has already been recorded in Google Sheets on ${duplicateRecorded.date} by ${duplicateRecorded.operator} (${duplicateRecorded.siloName}).`
                    : duplicateActive
                    ? ` is currently actively loading on ${duplicateActive.siloId} by ${duplicateActive.operator}.`
                    : ' is a duplicate.'}
                </p>
                {duplicateRecorded && !allowForceReload && (
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAllowForceReload(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'السماح بإعادة التحميل كتشغيل جديد' : 'Reload Ticket as New Run'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingTicket(null);
                        setSelectedSiloId(null);
                        setAllowForceReload(false);
                        refreshRecentEntries();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                    >
                      {language === 'ar' ? 'مسح تذكرة أخرى' : 'Scan Different Ticket'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LIVE TIMER HUD (When session is active) */}
          {activeSession && isViewingActiveJob && currentActiveJob && (
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {activeSession.isStopped
                    ? (language === 'ar' ? 'وقت التحميل الصافي (متوقف مؤقتاً)' : 'Net Loading Time (Paused)')
                    : (language === 'ar' ? 'وقت التحميل الصافي المباشر' : 'Net Loading Time')}
                </span>
                {activeSession.isStopped && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                    {language === 'ar' ? 'متوقف مؤقتاً' : 'PAUSED'}
                  </span>
                )}
              </div>
              <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tight drop-shadow-md ${
                activeSession.isStopped ? 'text-amber-300' : 'text-emerald-400'
              }`}>
                {activeSession.netFormatted}
              </div>

              {activeSession.isStopped && (
                <div className="mt-3 w-full bg-red-950/60 border border-red-500/50 rounded-xl p-2.5 flex items-center justify-between text-xs text-red-200 animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-bold">{currentActiveJob.stoppageReason || 'Stoppage'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-red-300 block font-sans uppercase">
                      {language === 'ar' ? 'مدة التوقف الحالية' : 'Current Downtime'}
                    </span>
                    <span className="font-mono font-bold text-red-300 text-sm">
                      {activeSession.currentStoppageFormatted}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 w-full grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900/60 p-2 rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase">
                    {language === 'ar' ? 'الوقت الإجمالي' : 'Gross Elapsed'}
                  </span>
                  <span className="font-bold text-slate-200">{activeSession.grossFormatted}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-xl text-right">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase">
                    {language === 'ar' ? 'إجمالي وقت التوقف' : 'Total Downtime'}
                  </span>
                  <span className="font-bold text-amber-400">{activeSession.downtimeFormatted}</span>
                </div>
              </div>
            </div>
          )}

          {/* CONFLICT NOTICE BADGE */}
          {conflictResolutionNote && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{conflictResolutionNote}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* THE 12 STANDARDIZED BULK TRUCK FIELDS                        */}
          {/* ============================================================ */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg">
            {/* FIELD 1: TARGET BULK SILO & CEMENT COMPATIBILITY */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-300 flex items-center justify-between mb-1.5">
                <span>1. {language === 'ar' ? 'صومعة التحميل وتوافق الإسمنت' : 'Target Bulk Silo & Cement Compatibility'} *</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  {activeCementType} · {activeCementType === 'OPC' ? 'Ordinary' : activeCementType === 'GU' ? 'Resistant' : 'Pozzolana'}
                </span>
              </label>

              {/* Compatible Silo Pills */}
              <div className="grid grid-cols-2 gap-2">
                {compatibleSilos.map(sId => {
                  const s = BULK_SILOS[sId];
                  const isSelected = displaySiloId === sId;
                  const isOccupied = Boolean(activeJobs[sId] && activeJobs[sId]?.receiptNumber !== displayReceipt);

                  return (
                    <button
                      key={sId}
                      type="button"
                      disabled={isViewingActiveJob || isOccupied}
                      onClick={() => {
                        if (!isViewingActiveJob && !isOccupied) setSelectedSiloId(sId);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                          : isOccupied
                          ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold block text-slate-400">{s.defaultStation}</span>
                        <span className="text-xs font-bold block">{s.nameEn}</span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-amber-500 text-slate-950 font-bold' : isOccupied ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {isSelected ? 'SELECTED' : isOccupied ? 'OCCUPIED' : 'IDLE'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FIELDS 2 & 3: RECEIPT # and VEHICLE PLATE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  2. {language === 'ar' ? 'رقم الإيصال / الطلب' : 'Receipt / Order Number'} *
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 flex items-center justify-between">
                  <span>#{displayReceipt}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  3. {language === 'ar' ? 'رقم اللوحة / الشاحنة' : 'Vehicle Plate / Lorry Number'} *
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 flex items-center justify-between">
                  <span>{displayPlate}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* FIELDS 4 & 5: AUTHORISED TONNES and ACTUAL TONNES LOADED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  4. {language === 'ar' ? 'الكمية المصرح بها (طن)' : 'Authorised Tonnes (MT)'} *
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-200">
                  <span>{displayAuthTonnes} MT</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-amber-400 flex items-center justify-between mb-1">
                  <span>5. {language === 'ar' ? 'الكمية الفعلية المحملة (طن)' : 'Actual Tonnes Loaded (MT)'} *</span>
                  <span className="text-[10px] text-amber-400/80 font-normal">
                    {language === 'ar' ? 'الوزن الفعلي عند الخروج' : 'Weigh-Out Input'}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={actualTonnesInput}
                  onChange={e => setActualTonnesInput(e.target.value)}
                  placeholder={String(displayAuthTonnes)}
                  className="w-full bg-slate-900 border border-amber-500/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-black text-amber-300 placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* FIELDS 6, 7 & 8: DRIVER NAME, PHONE, ID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  6. {language === 'ar' ? 'اسم السائق' : 'Driver Name'}
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 truncate">
                  <span>{displayDriverName || '—'}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  7. {language === 'ar' ? 'رقم هاتف السائق' : 'Driver Phone'}
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate">
                  <span>{displayDriverPhone || '—'}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">
                  8. {language === 'ar' ? 'رقم هوية السائق' : 'Driver ID'}
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate">
                  <span>{displayDriverId || '—'}</span>
                </div>
              </div>
            </div>

            {/* FIELDS 9, 10, 11 & 12: OPERATOR, START TIME, END TIME, STATUS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-800/80">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  9. {language === 'ar' ? 'المشغل' : 'Operator Name'}
                </label>
                <div className="w-full bg-slate-900 border border-sky-800/50 rounded-xl px-2.5 py-1.5 text-xs font-bold text-sky-200 flex items-center justify-between">
                  <span className="truncate">{displayOperator}</span>
                  <Lock className="w-3 h-3 text-sky-400 shrink-0" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  10. {language === 'ar' ? 'وقت البدء' : 'Start Time'}
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300">
                  <span>{displayStartTime}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  11. {language === 'ar' ? 'وقت الانتهاء' : 'End Time'}
                </label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300">
                  <span>{displayEndTime}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  12. {language === 'ar' ? 'حالة التحميل' : 'Final Status'}
                </label>
                <div className={`w-full rounded-xl px-2.5 py-1.5 text-xs font-bold border flex items-center justify-center ${
                  displayStatus === 'LOADING'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : displayStatus === 'STOPPAGE'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  <span>{displayStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE LOAD OWNERSHIP WARNING */}
          {isJobOwnedByOther && currentActiveJob && (
            <div className="p-4 rounded-2xl bg-amber-950/70 border-2 border-amber-500/80 flex items-start gap-3 text-xs text-amber-200 shadow-xl">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sm text-amber-300 block">
                  {language === 'ar'
                    ? `هذه الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}`
                    : `Active Load Locked to ${currentActiveJob.operator}`}
                </span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {language === 'ar'
                    ? `أنت مسجل الدخول كـ (${currentUser?.name}). صلاحية إتمام التحميل أو تسجيل الأعطال مقصورة على (${currentActiveJob.operator}) أو المشرف.`
                    : `You are signed in as (${currentUser?.name}). Only ${currentActiveJob.operator} or an Administrator can complete or report delay.`}
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* THE 3 PRIMARY LOADING ACTIONS                                */}
          {/* ============================================================ */}
          <div className="pt-2 space-y-2">
            {isViewingPendingTicket ? (
              /* BEFORE START: BUTTON 1 (START LOADING) */
              <button
                type="button"
                disabled={!selectedSiloId || isDuplicateReceipt || !currentUser || isStartingLoader}
                onClick={handleStartLoading}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {isStartingLoader ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    <span>{language === 'ar' ? 'جاري بدء التحميل والتسجيل بالشيت...' : 'Starting Silo & Writing to Sheets...'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>
                      {!currentUser
                        ? (language === 'ar' ? 'سجّل الدخول أولاً للبدء' : 'Sign In to Start Loading')
                        : isDuplicateReceipt
                        ? (language === 'ar' ? 'تذكرة مكررة - التحميل محظور' : 'Duplicate Receipt — Loading Blocked')
                        : (language === 'ar' ? `1. بدء التحميل (${BULK_SILOS[displaySiloId]?.nameAr || displaySiloId})` : `1. START LOADING (${BULK_SILOS[displaySiloId]?.nameEn})`)}
                    </span>
                  </>
                )}
              </button>
            ) : isViewingActiveJob && currentActiveJob ? (
              /* AFTER START: BUTTONS 2 & 3 (STOP/RESUME & COMPLETE & SAVE) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* BUTTON 2: STOP / PAUSE (or RESUME LOADING) */}
                <button
                  type="button"
                  disabled={isJobOwnedByOther || Boolean(isResolvingSilo)}
                  onClick={handleToggleStopResume}
                  className={`py-3.5 px-4 rounded-2xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    isJobOwnedByOther
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
                      : currentActiveJob.status === 'STOPPAGE'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-600/20'
                      : 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 active:scale-95'
                  }`}
                >
                  {isResolvingSilo ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : currentActiveJob.status === 'STOPPAGE' ? (
                    <Play className="w-4 h-4 fill-white" />
                  ) : (
                    <Pause className="w-4 h-4 fill-red-300" />
                  )}
                  <span>
                    {isResolvingSilo
                      ? (language === 'ar' ? 'جاري الاستئناف...' : 'Resuming...')
                      : currentActiveJob.status === 'STOPPAGE'
                      ? (language === 'ar' ? '2. استئناف التحميل' : '2. RESUME LOADING')
                      : (language === 'ar' ? '2. إيقاف مؤقت / عطل' : '2. STOP / PAUSE')}
                  </span>
                </button>

                {/* BUTTON 3: COMPLETE & SAVE ENTRY */}
                <button
                  type="button"
                  disabled={isJobOwnedByOther || isCompletingLoader}
                  onClick={handleCompleteAndSave}
                  className={`py-3.5 px-4 rounded-2xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    isJobOwnedByOther || isCompletingLoader
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                  }`}
                >
                  {isCompletingLoader ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isCompletingLoader
                      ? (language === 'ar' ? 'جاري إتمام الشحنة بالشيت...' : 'Saving to Google Sheets...')
                      : (language === 'ar' ? '3. إتمام وحفظ الشحنة' : '3. COMPLETE & SAVE ENTRY')}
                  </span>
                </button>
              </div>
            ) : null}

            {/* Cancel Load link (Job Owner or Admin only) */}
            {canControlJob && isViewingActiveJob && currentActiveJob && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Are you sure you want to cancel this bulk loading session?')) {
                      const siloToCancel = currentActiveJob.siloId;
                      await cancelJob(siloToCancel, 'Operator cancelled');
                      const remaining = activeSiloIds.filter(id => id !== siloToCancel);
                      if (remaining.length > 0) {
                        setFocusedSiloId(remaining[0]);
                      } else {
                        setFocusedSiloId(null);
                        setShowIntakeForm(false);
                      }
                    }
                  }}
                  className="text-[11px] text-red-400/80 hover:text-red-300 underline font-semibold cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء جلسة التحميل' : 'Cancel this Loading Session'}
                </button>
              </div>
            )}
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

      <BulkUserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
    </div>
  );
};
