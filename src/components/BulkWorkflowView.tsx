import React, { useState } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkSiloId, BulkTicketData, CementType, BulkEntry } from '../types';
import { BULK_SILOS, BULK_SILO_IDS, BULK_CEMENT_COMPATIBLE_SILOS, isSameOperator } from '../utils/constants';
import { BulkSiloSelector } from './BulkSiloSelector';
import { BulkQRScannerModal } from './BulkQRScannerModal';
import { BulkConflictModal } from './BulkConflictModal';
import { BulkStoppageModal } from './BulkStoppageModal';
import { BulkCompleteModal } from './BulkCompleteModal';
import { BulkUserModal } from './BulkUserModal';
import { formatElapsedSeconds } from '../utils/timeZone';
import { calculateBulkSessionElapsed } from '../utils/timerUtils';
import {
  Camera,
  Loader2,
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
  Ban,
  Lock,
  PlusCircle,
  ArrowLeft,
  Layers,
  Activity,
  Check
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
  const [isResolvingSilo, setIsResolvingSilo] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isStoppageModalOpen, setIsStoppageModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedActiveSiloId, setSelectedActiveSiloId] = useState<BulkSiloId | null>(null);

  // Multi-silo state: which silo is currently focused in the active HUD
  const [focusedSiloId, setFocusedSiloId] = useState<BulkSiloId | null>(null);
  // Whether operator opened ticket intake to start another silo concurrently
  const [showIntakeForm, setShowIntakeForm] = useState(false);

  // Scanned ticket in progress of review
  const [pendingTicket, setPendingTicket] = useState<BulkTicketData | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<BulkSiloId | null>(null);
  const [conflictResolutionNote, setConflictResolutionNote] = useState<string | undefined>(undefined);
  const [showAllSilos, setShowAllSilos] = useState(false);
  const [allowForceReload, setAllowForceReload] = useState(false);
  const [isStartingLoader, setIsStartingLoader] = useState(false);

  // Manual entry toggle
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualTonnes, setManualTonnes] = useState('30');
  const [manualCement, setManualCement] = useState<CementType>('OPC');
  const [manualDriverName, setManualDriverName] = useState('');
  const [manualDriverPhone, setManualDriverPhone] = useState('');

  // Active silos list
  const activeSiloIds = (Object.keys(activeJobs) as BulkSiloId[]).filter(sId => Boolean(activeJobs[sId]));
  const hasActiveJobs = activeSiloIds.length > 0;

  // Determine which active job is currently displayed in HUD
  const effectiveActiveSiloId: BulkSiloId | null = (focusedSiloId && activeJobs[focusedSiloId])
    ? focusedSiloId
    : (activeSiloIds.find(sId => {
        const jobOp = String(activeJobs[sId]?.operator || '').toLowerCase();
        const userOp = String(currentUser?.name || '').toLowerCase();
        return jobOp && userOp && jobOp === userOp;
      }) || activeSiloIds[0] || null);

  const currentActiveJob = effectiveActiveSiloId ? activeJobs[effectiveActiveSiloId] : null;

  // Ownership permission: only the operator who started the load or an Admin can complete, report delay, or cancel
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

  // Canonical normalize helper
  const cleanReceipt = (pendingTicket?.receiptNumber || manualReceipt || '').trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '');

  // 1. Check if actively loading on any silo
  const duplicateActive = cleanReceipt
    ? Object.values(activeJobs).find(
        j => j && j.receiptNumber.trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '') === cleanReceipt
      )
    : undefined;

  // 2. Check if completed in recentEntries (matching receipt OR loadId)
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

  // If allowForceReload is true, duplicateRecorded does not block
  const isDuplicateReceipt = Boolean(
    (duplicateRecorded && !allowForceReload) ||
    (duplicateActive && selectedSiloId && duplicateActive.siloId !== selectedSiloId)
  );

  const isResumingSameSilo = Boolean(
    duplicateActive && selectedSiloId && duplicateActive.siloId === selectedSiloId
  );

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
    } else {
      // Auto-assign first available compatible silo!
      const compSilos = BULK_CEMENT_COMPATIBLE_SILOS[ticket.cementType] || BULK_SILO_IDS;
      const idleSilo = compSilos.find(sId => !activeJobs[sId]);
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
    if (!currentUser) {
      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً للمتابعة' : 'Authentication required: Please sign in with your User ID and PIN.', 'error');
      setIsUserModalOpen(true);
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
    };

    // Auto propose silo based on cement, preferring idle silo
    const compSilos = BULK_CEMENT_COMPATIBLE_SILOS[manualCement] || BULK_SILO_IDS;
    const idleSilo = compSilos.find(sId => !activeJobs[sId]);
    ticket.proposedSiloId = idleSilo || compSilos[0] || 'NEW_5';

    setPendingTicket(ticket);
    setSelectedSiloId(ticket.proposedSiloId);
    setShowManualInputs(false);
  };

  const handleStartLoading = async () => {
    if (!currentUser) {
      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in with your User ID and PIN before starting a load.', 'error');
      setIsUserModalOpen(true);
      return;
    }
    if (!pendingTicket || !selectedSiloId || isStartingLoader) return;

    if (isDuplicateReceipt) {
      showToast(
        language === 'ar'
          ? 'تم حظر التحميل: تذكرة مكررة مسجلة مسبقاً أو قيد التحميل حالياً'
          : 'Duplicate load blocked: Receipt already recorded or active. Click "Reload Ticket" to re-load.',
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
        // If startJob failed due to duplicate, offer force reload
        if (duplicateRecorded) {
          setAllowForceReload(true);
        }
      }
    } finally {
      setIsStartingLoader(false);
    }
  };

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

      {/* 1. LIVE MULTI-SILO COCKPIT (ALL 4 SILO STATIONS) */}
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
                    showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Authentication required: Please sign in first.', 'error');
                    setIsUserModalOpen(true);
                    return;
                  }
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
            const isRunning = Boolean(job && job.status !== 'STOPPAGE');
            const isStopped = Boolean(job && job.status === 'STOPPAGE');

            const session = calculateBulkSessionElapsed(job, activeNowMs);

            return (
              <div
                key={sId}
                onClick={() => {
                  if (job) {
                    // Focus on this active job's HUD
                    setFocusedSiloId(sId);
                    setShowIntakeForm(false);
                    setPendingTicket(null);
                  } else {
                    // Idle silo clicked: open intake form pre-selecting this silo
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
                {/* Station & Cement Header */}
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

                {/* Status & Live Timer */}
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
                      {isStopped && (
                        <span className="font-mono text-[9px] font-bold text-red-400 block">
                          +{session.currentStoppageFormatted}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-bold hover:text-amber-400">
                      {language === 'ar' ? '+ تحميل' : '+ Load'}
                    </span>
                  )}
                </div>

                {/* Truck Plate Subtext if active */}
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

          {/* "+ Start Another Silo Load" Tab Button */}
          {activeSiloIds.length < 4 && (
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first.', 'error');
                  setIsUserModalOpen(true);
                  return;
                }
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

      {/* 3. ACTIVE LOADING HUD FOR CURRENT FOCUSED SILO */}
      {currentActiveJob && !showIntakeForm && !pendingTicket && (
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

          {/* Big High-Contrast Net Loading Timer */}
          {(() => {
            const activeSession = calculateBulkSessionElapsed(currentActiveJob, activeNowMs);
            return (
              <div className="bg-slate-950/90 rounded-2xl p-5 border border-slate-800 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {activeSession.isStopped
                      ? (language === 'ar' ? 'وقت التحميل الصافي (متوقف مؤقتاً)' : 'Net Loading Time (Paused)')
                      : (language === 'ar' ? 'وقت التحميل الصافي المباشر' : 'Net Loading Time')}
                  </span>
                  {activeSession.isStopped && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {language === 'ar' ? 'مجمد' : 'FROZEN'}
                    </span>
                  )}
                </div>
                <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tight drop-shadow-md ${
                  activeSession.isStopped ? 'text-amber-300' : 'text-emerald-400'
                }`}>
                  {activeSession.netFormatted}
                </div>

                {/* Stoppage Banner & Live Downtime Counter */}
                {activeSession.isStopped && (
                  <div className="mt-3 w-full bg-red-950/60 border border-red-500/50 rounded-xl p-2.5 flex items-center justify-between text-xs text-red-200 animate-pulse">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="font-bold">{currentActiveJob.stoppageReason || 'Stoppage'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-red-300 block font-sans uppercase">{language === 'ar' ? 'مدة التوقف الحالية' : 'Current Downtime'}</span>
                      <span className="font-mono font-bold text-red-300 text-sm">
                        {activeSession.currentStoppageFormatted}
                      </span>
                    </div>
                  </div>
                )}

                {/* Authoritative Dual Timing Breakdown */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 w-full grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/60 p-2 rounded-xl text-left">
                    <span className="text-[10px] text-slate-400 block font-sans uppercase">{language === 'ar' ? 'الوقت الإجمالي المنقضي' : 'Gross Elapsed'}</span>
                    <span className="font-bold text-slate-200">{activeSession.grossFormatted}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl text-right">
                    <span className="text-[10px] text-slate-400 block font-sans uppercase">{language === 'ar' ? 'إجمالي وقت التوقف' : 'Total Downtime'}</span>
                    <span className="font-bold text-amber-400">{activeSession.downtimeFormatted}</span>
                  </div>
                </div>
              </div>
            );
          })()}

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
              </div>
            )}
          </div>

          {/* ACTIVE LOAD BELONGING TO ANOTHER OPERATOR WARNING */}
          {isJobOwnedByOther && (
            <div className="p-4 rounded-2xl bg-amber-950/70 border-2 border-amber-500/80 flex items-start gap-3 text-xs text-amber-200 shadow-xl animate-in fade-in">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sm text-amber-300 block">
                  {language === 'ar'
                    ? `هذه الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}`
                    : `Active Load Locked to ${currentActiveJob.operator}`}
                </span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {language === 'ar'
                    ? `أنت مسجل الدخول كـ (${currentUser?.name}). صلاحية إتمام التحميل أو تسجيل الأعطال أو الإلغاء مقصورة فقط على المشغل (${currentActiveJob.operator}) أو المشرف العام (Admin).`
                    : `You are signed in as (${currentUser?.name}). Only ${currentActiveJob.operator} or an Administrator can complete, report delay, or cancel this load.`}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons for Active Load */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {currentActiveJob.status === 'STOPPAGE' ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUser) {
                      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Authentication required: Please sign in with your User ID and PIN.', 'error');
                      setIsUserModalOpen(true);
                      return;
                    }
                    if (isJobOwnedByOther) {
                      showToast(
                        language === 'ar'
                          ? `تم رفض الإذن: الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}. يحق فقط لـ ${currentActiveJob.operator} أو المشرف استئنافها.`
                          : `Permission denied: Silo is being loaded by ${currentActiveJob.operator}. Only ${currentActiveJob.operator} or an Administrator can resume it.`,
                        'error'
                      );
                      return;
                    }
                    if (isResolvingSilo) return;
                    setIsResolvingSilo(currentActiveJob.siloId);
                    try {
                      await resolveStoppage(currentActiveJob.siloId);
                    } finally {
                      setIsResolvingSilo(null);
                    }
                  }}
                  disabled={isJobOwnedByOther || Boolean(isResolvingSilo)}
                  className={`py-3 px-4 rounded-2xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 ${
                    isJobOwnedByOther || Boolean(isResolvingSilo)
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 cursor-pointer'
                  }`}
                  title={isJobOwnedByOther ? (language === 'ar' ? `مقفل لـ ${currentActiveJob.operator}` : `Locked to ${currentActiveJob.operator}`) : undefined}
                >
                  {Boolean(isResolvingSilo) ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : isJobOwnedByOther ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  <span>
                    {Boolean(isResolvingSilo)
                      ? (language === 'ar' ? 'جاري الاستئناف...' : 'Resuming...')
                      : (language === 'ar' ? 'استئناف التحميل' : 'Resume Loading')}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isJobOwnedByOther}
                  onClick={() => {
                    if (!currentUser) {
                      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Authentication required: Please sign in with your User ID and PIN.', 'error');
                      setIsUserModalOpen(true);
                      return;
                    }
                    if (isJobOwnedByOther) {
                      showToast(
                        language === 'ar'
                          ? `تم رفض الإذن: الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}. يحق فقط لـ ${currentActiveJob.operator} أو المشرف تسجيل الأعطال.`
                          : `Permission denied: Silo is being loaded by ${currentActiveJob.operator}. Only ${currentActiveJob.operator} or an Administrator can report delays.`,
                        'error'
                      );
                      return;
                    }
                    setSelectedActiveSiloId(currentActiveJob.siloId);
                    setIsStoppageModalOpen(true);
                  }}
                  className={`py-3 px-4 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                    isJobOwnedByOther
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                      : 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 active:scale-95 cursor-pointer'
                  }`}
                  title={isJobOwnedByOther ? (language === 'ar' ? `مقفل لـ ${currentActiveJob.operator}` : `Locked to ${currentActiveJob.operator}`) : undefined}
                >
                  {isJobOwnedByOther ? <Lock className="w-4 h-4 text-slate-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span>{language === 'ar' ? 'تسجيل عطل' : 'Report Delay'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isJobOwnedByOther}
                onClick={() => {
                  if (!currentUser) {
                    showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً قبل إتمام التحميل' : 'Authentication required: Please sign in before completing a load.', 'error');
                    setIsUserModalOpen(true);
                    return;
                  }
                  if (isJobOwnedByOther) {
                    showToast(
                      language === 'ar'
                        ? `تم رفض الإذن: الصومعة قيد التحميل بواسطة ${currentActiveJob.operator}. يحق فقط لـ ${currentActiveJob.operator} أو المشرف إتمامها.`
                        : `Permission denied: Silo is being loaded by ${currentActiveJob.operator}. Only ${currentActiveJob.operator} or an Administrator can complete it.`,
                      'error'
                    );
                    return;
                  }
                  setSelectedActiveSiloId(currentActiveJob.siloId);
                  setIsCompleteModalOpen(true);
                }}
                className={`py-3 px-4 rounded-2xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 ${
                  isJobOwnedByOther
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                    : currentActiveJob.status === 'STOPPAGE'
                    ? 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 active:scale-95 cursor-pointer shadow-none'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
                }`}
                title={isJobOwnedByOther ? (language === 'ar' ? `مقفل للمشغل ${currentActiveJob.operator}` : `Locked to ${currentActiveJob.operator}`) : undefined}
              >
                {isJobOwnedByOther ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : currentActiveJob.status === 'STOPPAGE' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isJobOwnedByOther
                    ? (language === 'ar' ? `مقفل لـ ${currentActiveJob.operator}` : `Locked to ${currentActiveJob.operator}`)
                    : currentActiveJob.status === 'STOPPAGE'
                    ? (language === 'ar' ? 'إلغاء / شحنة جزئية' : 'Abort / Partial Load')
                    : (language === 'ar' ? 'إتمام التحميل' : 'Complete & Weigh-Out')}
                </span>
              </button>
            </div>

            {/* Start Another Silo Load Prompt in HUD (if other silos available) */}
            {activeSiloIds.length < 4 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first.', 'error');
                      setIsUserModalOpen(true);
                      return;
                    }
                    setShowIntakeForm(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {language === 'ar'
                      ? `+ مسح تذكرة وبدء صومعة أخرى (${4 - activeSiloIds.length} صوامع متاحة)`
                      : `+ Start Another Truck on Available Silo (${4 - activeSiloIds.length} Available)`}
                  </span>
                </button>
              </div>
            )}

            {/* Cancel Load Link (Job Owner or Admin only) */}
            {canControlJob && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUser) {
                      showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Authentication required: Please sign in with your User ID and PIN.', 'error');
                      setIsUserModalOpen(true);
                      return;
                    }
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
                  {language === 'ar' ? 'إلغاء التحميل' : 'Cancel this Loading Session'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TICKET INTAKE: SCAN OR MANUAL ENTRY (Shown if no active job, or if user clicked to start another silo load) */}
      {(showIntakeForm || !currentActiveJob) && !pendingTicket && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          {/* Back to Active HUD Header if other jobs are running */}
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
                onClick={() => setShowIntakeForm(false)}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-bold underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'العودة للصومعة النشطة' : 'Back to Active Load'}</span>
              </button>
            </div>
          )}

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
            onClick={() => {
              if (!currentUser) {
                showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً لمسح التذكرة' : 'Authentication required: Please sign in with User ID and PIN before scanning.', 'warning');
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

          {/* Manual Entry Accordion */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً للإدخال اليدوي' : 'Authentication required: Please sign in with User ID and PIN.', 'warning');
                  setIsUserModalOpen(true);
                  return;
                }
                setShowManualInputs(!showManualInputs);
              }}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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

      {/* 5. TICKET REVIEW & EDITABLE BOXES */}
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

          {/* DUPLICATE RECEIPT WARNING BANNER */}
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
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                    >
                      {language === 'ar' ? 'مسح تذكرة أخرى' : 'Scan Different Ticket'}
                    </button>
                  </div>
                )}
                {duplicateActive && (
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Cancel active session for Receipt #${pendingTicket.receiptNumber} on ${duplicateActive.siloId}?`)) {
                          await cancelJob(duplicateActive.siloId, 'Operator cleared active session');
                          showToast('Active loading session cleared.', 'info');
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-red-900/90 hover:bg-red-800 text-white font-bold text-[11px] border border-red-700 transition cursor-pointer"
                    >
                      {language === 'ar' ? 'إلغاء وتحرير الصومعة' : 'Clear / Cancel Active Load'}
                    </button>
                  </div>
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
                        const compSilos = BULK_CEMENT_COMPATIBLE_SILOS[lbl] || BULK_SILO_IDS;
                        const idleSilo = compSilos.find(sId => !activeJobs[sId]);
                        setSelectedSiloId(idleSilo || compSilos[0] || 'NEW_5');
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

            {/* Editable Fields Grid */}
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

              {/* Operator & Shift Info */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 mb-1">
                  <span>{language === 'ar' ? 'المشغل والوردية' : 'Assigned Operator & Shift'}</span>
                </label>
                {currentUser ? (
                  <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>{currentUser.name}</span>
                    <span className="text-[10px] font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                      {currentUser.role.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(true)}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <span>Click to Sign In</span>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                )}
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
              disabled={!selectedSiloId || isDuplicateReceipt || !currentUser || isStartingLoader}
              onClick={handleStartLoading}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isStartingLoader ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>{language === 'ar' ? 'جاري بدء الصومعة والتسجيل بالشيت...' : 'Starting Silo & Writing to Sheets...'}</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>
                    {!currentUser
                      ? (language === 'ar' ? 'سجّل الدخول أولاً لبدء التحميل' : 'Sign In to Start Loading')
                      : isDuplicateReceipt
                      ? (language === 'ar' ? 'تذكرة مكررة - التحميل محظور' : 'Duplicate Receipt — Loading Blocked')
                      : allowForceReload && selectedSiloId && BULK_SILOS[selectedSiloId]
                      ? (language === 'ar' ? `إعادة التحميل كتشغيل جديد على ${BULK_SILOS[selectedSiloId].nameAr}` : `Start Reload at ${BULK_SILOS[selectedSiloId].nameEn} (New Run)`)
                      : isResumingSameSilo
                      ? (language === 'ar' ? `استئناف التحميل من ${BULK_SILOS[selectedSiloId!].nameAr}` : `Resume Loading at ${BULK_SILOS[selectedSiloId!].nameEn}`)
                      : selectedSiloId && BULK_SILOS[selectedSiloId]
                      ? language === 'ar'
                        ? `بدء التحميل من ${BULK_SILOS[selectedSiloId].nameAr}`
                        : `Start Loading at ${BULK_SILOS[selectedSiloId].nameEn}`
                      : language === 'ar'
                      ? 'اختر صومعة للبدء'
                      : 'Select an Authorised Silo to Start'}
                  </span>
                </>
              )}
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

      {isCompleteModalOpen && selectedActiveSiloId && activeJobs[selectedActiveSiloId] && (
        <BulkCompleteModal
          key={`${selectedActiveSiloId}-${activeJobs[selectedActiveSiloId]?.receiptNumber}-${activeJobs[selectedActiveSiloId]?.authorisedTonnes}`}
          isOpen={isCompleteModalOpen}
          job={activeJobs[selectedActiveSiloId]}
          onClose={() => {
            setIsCompleteModalOpen(false);
            setSelectedActiveSiloId(null);
          }}
          onConfirmComplete={async (actualTonnes, stoppageReason, status, isAbort) => {
            if (selectedActiveSiloId) {
              const completedSilo = selectedActiveSiloId;
              await completeJob(completedSilo, actualTonnes, stoppageReason, status, isAbort);
              if (status === 'not completed' && !isAbort) {
                // Delay in progress kept active: KEEP FOCUSED on this silo so operator sees active delay
                setFocusedSiloId(completedSilo);
                setShowIntakeForm(false);
              } else {
                // Completed or aborted dispatch: Free silo!
                const remaining = activeSiloIds.filter(id => id !== completedSilo);
                if (remaining.length > 0) {
                  setFocusedSiloId(remaining[0]);
                } else {
                  setFocusedSiloId(null);
                  setShowIntakeForm(false);
                }
              }
            }
            setIsCompleteModalOpen(false);
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
