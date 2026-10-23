import React, { useState } from 'react';
import { BulkAppProvider, useBulkApp } from './context/BulkAppContext';
import { BulkHeader } from './components/BulkHeader';
import { BulkWorkflowView } from './components/BulkWorkflowView';
import { BulkRecordsView } from './components/BulkRecordsView';
import { BulkManagerDashboard } from './components/BulkManagerDashboard';
import { BulkUserModal } from './components/BulkUserModal';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Download } from 'lucide-react';

const BulkAppContent: React.FC = () => {
  const { activeTab, toast } = useBulkApp();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  React.useEffect(() => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* PWA Install Banner */}
      {canInstall && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-950" />
            <span>Install SPCC Bulk Loading App on Home Screen</span>
          </div>
          <button
            onClick={handleInstallClick}
            className="bg-slate-950 text-amber-400 hover:text-white px-3 py-1 rounded-lg text-xs font-black transition active:scale-95"
          >
            Install
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

      {/* User Selection Modal */}
      <BulkUserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
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
