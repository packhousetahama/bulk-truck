import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  BulkSiloId,
  BulkActiveJob,
  BulkTicketData,
  BulkEntry,
  User,
  Language,
  Theme
} from '../types';
import { DEFAULT_OPERATORS, BULK_SILOS } from '../utils/constants';
import {
  fetchActiveBulkLoaders,
  startBulkLoaderRemote,
  reportBulkStoppageRemote,
  resolveBulkStoppageRemote,
  completeBulkLoaderRemote,
  cancelBulkLoaderRemote,
  submitBulkEntry,
  fetchBulkEntries,
  authenticateUser
} from '../services/api';
import { getSaudiCurrentDateOnly, getSaudiCurrentTimeOnly, getSaudiCurrentShift, calculateDurationMinutes } from '../utils/timeZone';

interface BulkAppContextType {
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  login: (id: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  language: Language;
  setLanguage: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  activeTab: 'workflow' | 'records' | 'manager';
  setActiveTab: (tab: 'workflow' | 'records' | 'manager') => void;
  activeJobs: Record<string, BulkActiveJob>;
  activeNowMs: number;
  loading: boolean;
  isOnline: boolean;
  lastSynced: Date | null;
  selectedSiloId: BulkSiloId | null;
  setSelectedSiloId: (id: BulkSiloId | null) => void;
  startJob: (siloId: BulkSiloId, ticket: BulkTicketData, conflictResolution?: string) => Promise<boolean>;
  reportStoppage: (siloId: BulkSiloId, reason: string, comment?: string) => Promise<boolean>;
  resolveStoppage: (siloId: BulkSiloId) => Promise<boolean>;
  completeJob: (siloId: BulkSiloId, actualTonnes: number, stoppageReason?: string, status?: string) => Promise<boolean>;
  cancelJob: (siloId: BulkSiloId, reason?: string) => Promise<boolean>;
  toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  refreshActiveJobs: () => Promise<void>;
  recentEntries: BulkEntry[];
  refreshRecentEntries: () => Promise<void>;
  playBeep: () => void;
  playSuccess: () => void;
  t: (key: string) => string;
}

const BulkAppContext = createContext<BulkAppContextType | null>(null);

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    appTitle: 'SPCC Tahama — Bulk Cement Loading',
    plantName: 'Tahama Plant',
    bulkLoading: 'Bulk Loading',
    records: 'Records',
    managerDashboard: 'Manager Cockpit',
    scanQR: 'Scan Ticket QR',
    manualEntry: 'Manual Entry',
    loading: 'Loading',
    stoppage: 'Stoppage Active',
    idle: 'Available / Idle',
    newSilo5: 'New Silo 5 (OPC)',
    newSilo6: 'New Silo 6 (OPC)',
    oldSilo1: 'Old Silo 1 (GU)',
    oldSilo2: 'Old Silo 2 (PPC)',
    startLoading: 'Start Loading',
    reportProblem: 'Report Stoppage / Delay',
    resolveProblem: 'Resolve & Resume',
    completeLoading: 'Complete & Weigh Out',
    cancel: 'Cancel',
    truckPlate: 'Truck License Plate',
    receiptNumber: 'Dispatch Receipt #',
    authorisedTonnes: 'Authorised Tonnes',
    actualTonnes: 'Actual Dispatched Tonnes',
    operator: 'Operator',
    shift: 'Shift',
    duration: 'Gross Duration',
    downtime: 'Downtime Delay',
    netDuration: 'Net Loading Time',
    incompatibleSilo: 'Incompatible Cement Type',
    siloOccupied: 'Silo currently loading another truck'
  },
  ar: {
    appTitle: 'شركة أسمنت المنطقة الجنوبية — محطة تهامة (السائب)',
    plantName: 'محطة تهامة',
    bulkLoading: 'تحميل السائب',
    records: 'سجل الشحنات',
    managerDashboard: 'لوحة التحكم الإدارية',
    scanQR: 'مسح تذكرة QR',
    manualEntry: 'إدخال يدوي',
    loading: 'جاري التحميل',
    stoppage: 'توقف مؤقت / عطل',
    idle: 'متاح للتحميل',
    newSilo5: 'صومعة جديدة 5 (عادي)',
    newSilo6: 'صومعة جديدة 6 (عادي)',
    oldSilo1: 'صومعة قديمة 1 (مقاوم)',
    oldSilo2: 'صومعة قديمة 2 (بوزولاني)',
    startLoading: 'بدء التحميل',
    reportProblem: 'تسجيل توقف / عطل',
    resolveProblem: 'استئناف التحميل',
    completeLoading: 'إتمام التحميل والوزن النهائي',
    cancel: 'إلغاء',
    truckPlate: 'رقم لوحة الشاحنة',
    receiptNumber: 'رقم إيصال الصرف',
    authorisedTonnes: 'الكمية المصرح بها (طن)',
    actualTonnes: 'الكمية الفعلية المحملة (طن)',
    operator: 'المشغل',
    shift: 'الوردية',
    duration: 'إجمالي الوقت',
    downtime: 'وقت التوقف',
    netDuration: 'الوقت الصافي للتحميل',
    incompatibleSilo: 'نوع الإسمنت غير متطابق مع الصومعة',
    siloOccupied: 'الصومعة قيد التحميل لشاحنة أخرى حالياً'
  }
};

export const BulkAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('spcc_bulk_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.name) return u;
      }
    } catch {}
    return null;
  });

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('spcc_bulk_lang');
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {}
    return 'en';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('spcc_bulk_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  const [activeTab, setActiveTab] = useState<'workflow' | 'records' | 'manager'>('workflow');
  const [activeJobs, setActiveJobs] = useState<Record<string, BulkActiveJob>>({});
  const [activeNowMs, setActiveNowMs] = useState<number>(Date.now());
  const [recentEntries, setRecentEntries] = useState<BulkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<BulkSiloId | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const graceMap = useRef<Record<string, number>>({});

  const setCurrentUser = (u: User | null) => {
    setCurrentUserState(u);
    if (u) {
      localStorage.setItem('spcc_bulk_auth_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('spcc_bulk_auth_user');
    }
  };

  const login = async (id: string, pin: string): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    try {
      const res = await authenticateUser(id, pin);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        showToast(`Welcome, ${res.user.name}`, 'success');
        playSuccess();
        return { success: true };
      }
      return { success: false, message: res.message || 'Authentication failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('You have been signed out.', 'info');
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('spcc_bulk_lang', l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('spcc_bulk_theme', t);
    if (t === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const playSuccess = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  };

  // Synchronize theme to document element
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Synchronize language dir
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Live timer tick every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshRecentEntries = async () => {
    try {
      const data = await fetchBulkEntries();
      setRecentEntries(data);
    } catch {}
  };

  useEffect(() => {
    refreshRecentEntries();
  }, []);

  // Polling active bulk loaders
  const refreshActiveJobs = async () => {
    try {
      const remote = await fetchActiveBulkLoaders();
      const now = Date.now();
      const merged = { ...remote };

      // Apply 15s grace window to prevent local jobs from disappearing while backend commits
      Object.keys(graceMap.current).forEach(siloId => {
        if (graceMap.current[siloId] && now - graceMap.current[siloId] < 15000) {
          if (!merged[siloId] && activeJobs[siloId]) {
            merged[siloId] = activeJobs[siloId];
          }
        } else {
          delete graceMap.current[siloId];
        }
      });

      setActiveJobs(merged);
      setLastSynced(new Date());
    } catch (err) {
      console.warn('Failed to poll bulk loaders', err);
    }
  };

  useEffect(() => {
    refreshActiveJobs();
    const interval = setInterval(refreshActiveJobs, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const startJob = async (
    siloId: BulkSiloId,
    ticket: BulkTicketData,
    conflictResolution?: string
  ): Promise<boolean> => {
    if (!currentUser || !currentUser.id || !currentUser.pin) {
      showToast('Authentication required: Please sign in with your User ID and PIN before starting a load.', 'error');
      return false;
    }
    setLoading(true);
    try {
      const nowMs = Date.now();
      const localJob: BulkActiveJob = {
        siloId,
        receiptNumber: ticket.receiptNumber,
        truckNumber: ticket.vehicleNumber,
        cementType: ticket.cementType,
        authorisedTonnes: ticket.authorisedTonnes,
        driverName: ticket.driverName,
        driverPhone: ticket.driverPhone,
        driverId: ticket.driverId,
        ticketSiloRef: ticket.printedSiloRef,
        startTime: getSaudiCurrentTimeOnly(),
        startEpochMs: nowMs,
        operator: currentUser.name,
        shift: getSaudiCurrentShift(),
        variant: ticket.variant,
        conflictDetected: ticket.conflictDetected,
        conflictResolution,
        status: 'LOADING'
      };

      // Optimistic local update
      setActiveJobs(prev => ({ ...prev, [siloId]: localJob }));
      graceMap.current[siloId] = nowMs;

      const res = await startBulkLoaderRemote({
        siloId,
        receiptNumber: ticket.receiptNumber,
        truckNumber: ticket.vehicleNumber,
        cementType: ticket.cementType,
        authorisedTonnes: ticket.authorisedTonnes,
        driverName: ticket.driverName,
        driverPhone: ticket.driverPhone,
        driverId: ticket.driverId,
        ticketSiloRef: ticket.printedSiloRef,
        operator: currentUser.name,
        id: currentUser.id,
        pin: currentUser.pin,
        variant: ticket.variant,
        conflictDetected: ticket.conflictDetected,
        conflictResolution
      });

      if (!res.success) {
        // Rollback optimistic state immediately
        setActiveJobs(prev => {
          const copy = { ...prev };
          delete copy[siloId];
          return copy;
        });
        delete graceMap.current[siloId];
        showToast(res.error || 'Failed to start loader', 'error');
        return false;
      }

      playSuccess();
      showToast(`Loading started on ${BULK_SILOS[siloId].nameEn} for truck ${ticket.vehicleNumber}`, 'success');
      return true;
    } catch (err: any) {
      setActiveJobs(prev => {
        const copy = { ...prev };
        delete copy[siloId];
        return copy;
      });
      delete graceMap.current[siloId];
      showToast(err.message || 'Error starting load', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reportStoppage = async (siloId: BulkSiloId, reason: string, comment?: string): Promise<boolean> => {
    if (!currentUser || !currentUser.id || !currentUser.pin) {
      showToast('Authentication required: Please sign in before reporting a delay.', 'error');
      return false;
    }
    const existingJob = activeJobs[siloId];
    setLoading(true);
    try {
      const nowMs = Date.now();
      // Optimistic update
      setActiveJobs(prev => {
        const existing = prev[siloId];
        if (!existing) return prev;
        return {
          ...prev,
          [siloId]: {
            ...existing,
            status: 'STOPPAGE',
            stoppageReason: reason,
            stoppageStartTime: getSaudiCurrentTimeOnly(),
            stoppageStartEpochMs: nowMs
          }
        };
      });

      const res = await reportBulkStoppageRemote({
        siloId,
        reason,
        comment,
        id: currentUser.id,
        pin: currentUser.pin,
        receiptNumber: existingJob?.receiptNumber,
        loadId: (existingJob as any)?.loadId
      });
      if (!res.success) {
        showToast(res.error || 'Failed to record stoppage', 'error');
        return false;
      }

      showToast(`Stoppage recorded on ${BULK_SILOS[siloId].nameEn}: ${reason}`, 'warning');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error recording stoppage', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resolveStoppage = async (siloId: BulkSiloId): Promise<boolean> => {
    if (!currentUser || !currentUser.id || !currentUser.pin) {
      showToast('Authentication required: Please sign in before resuming a load.', 'error');
      return false;
    }
    const existingJob = activeJobs[siloId];
    setLoading(true);
    try {
      const res = await resolveBulkStoppageRemote({
        siloId,
        id: currentUser.id,
        pin: currentUser.pin,
        receiptNumber: existingJob?.receiptNumber,
        loadId: (existingJob as any)?.loadId
      });
      if (!res.success) {
        showToast(res.error || 'Failed to resolve stoppage', 'error');
        return false;
      }

      // Optimistic update
      setActiveJobs(prev => {
        const existing = prev[siloId];
        if (!existing) return prev;
        const stoppageSec = existing.stoppageStartEpochMs
          ? Math.floor((Date.now() - existing.stoppageStartEpochMs) / 1000)
          : 0;
        return {
          ...prev,
          [siloId]: {
            ...existing,
            status: 'LOADING',
            stoppageReason: undefined,
            stoppageStartTime: undefined,
            stoppageStartEpochMs: undefined,
            totalDowntimeSeconds: (existing.totalDowntimeSeconds || 0) + stoppageSec
          }
        };
      });

      playSuccess();
      showToast(`Stoppage resolved on ${BULK_SILOS[siloId].nameEn}. Loading resumed.`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error resolving stoppage', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const completeJob = async (
    siloId: BulkSiloId,
    actualTonnes: number,
    stoppageReason?: string,
    status?: string
  ): Promise<boolean> => {
    if (!currentUser || !currentUser.id || !currentUser.pin) {
      showToast('Authentication required: Please sign in before completing a load.', 'error');
      return false;
    }
    const job = activeJobs[siloId];
    if (!job) return false;

    setLoading(true);
    try {
      const endTime = getSaudiCurrentTimeOnly();
      const grossMinutes = calculateDurationMinutes(job.startTime, endTime);
      const downtimeMinutes = Math.round(((job.totalDowntimeSeconds || 0) / 60) * 10) / 10;
      const netMinutes = Math.max(0, Math.round((grossMinutes - downtimeMinutes) * 10) / 10);

      const finalStoppage = stoppageReason || (job.stoppageReason && job.stoppageReason !== 'NONE' ? job.stoppageReason : 'NONE');
      const finalStatus = status || (finalStoppage !== 'NONE' ? 'not completed' : 'completed');

      // Complete active bulk job remotely & commit final metrics to BULK ENTRY sheet
      const res = await completeBulkLoaderRemote({
        siloId,
        actualTonnes,
        receiptNumber: job.receiptNumber,
        loadId: (job as any).loadId,
        driverName: job.driverName,
        driverPhone: job.driverPhone,
        driverId: job.driverId,
        ticketSiloRef: job.ticketSiloRef,
        grossDurationMinutes: grossMinutes,
        netDurationMinutes: netMinutes,
        downtimeMinutes,
        stoppage: finalStoppage,
        status: finalStatus,
        id: currentUser.id,
        pin: currentUser.pin
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete load on server');
      }

      // Clear local state
      setActiveJobs(prev => {
        const copy = { ...prev };
        delete copy[siloId];
        return copy;
      });
      delete graceMap.current[siloId];

      refreshRecentEntries();
      playSuccess();
      showToast(`Loading complete! ${actualTonnes} tonnes dispatched for truck ${job.truckNumber}`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error completing job', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelJob = async (siloId: BulkSiloId, reason?: string): Promise<boolean> => {
    const job = activeJobs[siloId];
    if (!job) return false;

    if (!currentUser) {
      showToast('Authentication required: Please sign in.', 'error');
      return false;
    }
    // Permission check: users can only cancel their own job, admin can cancel anyone
    if (currentUser.role !== 'admin' && job.operator && job.operator.toLowerCase() !== currentUser.name.toLowerCase()) {
      showToast('Permission denied: You can only cancel your own loading jobs. Contact an Admin.', 'error');
      return false;
    }

    setLoading(true);
    try {
      const res = await cancelBulkLoaderRemote({
        siloId,
        reason,
        cancelledBy: currentUser.name,
        id: currentUser.id,
        pin: currentUser.pin,
        receiptNumber: job.receiptNumber,
        loadId: (job as any).loadId
      });
      if (!res.success) {
        showToast(res.error || 'Failed to cancel job', 'error');
        return false;
      }

      setActiveJobs(prev => {
        const copy = { ...prev };
        delete copy[siloId];
        return copy;
      });
      delete graceMap.current[siloId];

      showToast(`Loading cancelled on ${BULK_SILOS[siloId].nameEn}`, 'info');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error cancelling job', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <BulkAppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
        language,
        setLanguage,
        theme,
        setTheme,
        activeTab,
        setActiveTab,
        activeJobs,
        activeNowMs,
        loading,
        isOnline,
        lastSynced,
        selectedSiloId,
        setSelectedSiloId,
        startJob,
        reportStoppage,
        resolveStoppage,
        completeJob,
        cancelJob,
        toast,
        showToast,
        refreshActiveJobs,
        recentEntries,
        refreshRecentEntries,
        playBeep,
        playSuccess,
        t
      }}
    >
      {children}
    </BulkAppContext.Provider>
  );
};

export const useBulkApp = () => {
  const context = useContext(BulkAppContext);
  if (!context) {
    throw new Error('useBulkApp must be used within a BulkAppProvider');
  }
  return context;
};
