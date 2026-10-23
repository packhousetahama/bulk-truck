import React, { useState, useEffect } from 'react';
import { BulkAppProvider, useBulkApp } from './context/BulkAppContext';
import { BulkHeader } from './components/BulkHeader';
import { BulkWorkflowView } from './components/BulkWorkflowView';
import { BulkRecordsView } from './components/BulkRecordsView';
import { BulkManagerDashboard } from './components/BulkManagerDashboard';
import { BulkUserModal } from './components/BulkUserModal';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone
} from 'lucide-react';

const BulkAppContent: React.FC = () => {
  const { activeTab, toast, language } = useBulkApp();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsIosDevice(isIos && !isStandalone);

    const handlePrompt = () => setCanInstall(true);
    window.addEventListener('pwa-prompt-available', handlePrompt);
    if ((window as any).__PWA_PROMPT__) setCanInstall(true);
    return () => window.removeEventListener('pwa-prompt-available', handlePrompt);
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).__PWA_PROMPT__;
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setCanInstall(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">
      {/* Android PWA Install Banner */}
      {canInstall && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-950" />
            <span>Install SPCC Bulk Loading App on Home Screen</span>
          </div>
          <button
            onClick={handleInstallClick}
            className="bg-slate-950 text-amber-400 hover:text-white px-3 py-1 rounded-lg text-xs font-black transition active:scale-95 cursor-pointer"
          >
            Install
          </button>
        </div>
      )}

      {/* iOS iPhone / Safari Install Banner */}
      {isIosDevice && (
        <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {language === 'ar'
                ? 'تثبيت التطبيق على الآيفون (iPhone)'
                : 'Install SPCC Bulk on iPhone Home Screen'}
            </span>
          </div>
          <button
            onClick={() => setShowIosModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
          >
            {language === 'ar' ? 'طريقة التثبيت' : 'How to Install'}
          </button>
        </div>
      )}

      {/* Main Header */}
      <BulkHeader onOpenUserModal={() => setIsUserModalOpen(true)} />

      {/* Main Tab View */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4">
        {activeTab === 'workflow' && <BulkWorkflowView />}
        {activeTab === 'records' && <BulkRecordsView />}
        {activeTab === 'manager' && <BulkManagerDashboard />}
      </main>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-slide-up">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                : toast.type === 'error'
                ? 'bg-red-950/90 text-red-300 border-red-500/50'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                : 'bg-slate-900/90 text-slate-200 border-slate-700'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}

      {/* User Selection & Admin Management Modal */}
      <BulkUserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      {/* iPhone / iOS Step-by-Step Installation Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {language === 'ar' ? 'التثبيت على الآيفون (iPhone)' : 'Add to iPhone Home Screen'}
                  </h3>
                  <span className="text-[10px] text-slate-400">Apple Safari iOS Guide</span>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-200">
                    {language === 'ar' ? 'اضغط على زر المشاركة أسفل الشاشة' : 'Tap the Share Button in Safari'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span>Look for the</span> <Share className="w-3.5 h-3.5 text-blue-400 inline" /> <span>icon at the bottom of Safari.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-200">
                    {language === 'ar' ? 'اختر "إضافة إلى الشاشة الرئيسية"' : 'Select "Add to Home Screen"'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span>Scroll down and tap</span> <PlusSquare className="w-3.5 h-3.5 text-amber-400 inline" /> <span>Add to Home Screen.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-200">
                    {language === 'ar' ? 'اضغط على "إضافة" في أعلى اليمين' : 'Tap "Add" in the Top Right'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'سيظهر رمز التطبيق (SPCC Bulk) مباشرة على شاشة الآيفون.'
                      : 'The SPCC Bulk icon will be saved to your home screen!'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
            >
              {language === 'ar' ? 'فهمت، حسناً' : 'Got it!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BulkAppProvider>
      <BulkAppContent />
    </BulkAppProvider>
  );
};

export default App;
