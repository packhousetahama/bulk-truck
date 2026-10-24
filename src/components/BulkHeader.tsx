import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { getSaudiCurrentTimeOnly, getSaudiCurrentShift } from '../utils/timeZone';
import { BULK_SHEET_URL } from '../utils/constants';
import {
  Truck,
  RotateCw,
  Sun,
  Moon,
  Globe,
  User as UserIcon,
  Wifi,
  WifiOff,
  Layers,
  Clock,
  Shield,
  Lock,
  BarChart3,
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';

interface BulkHeaderProps {
  onOpenUserModal: () => void;
}

export const BulkHeader: React.FC<BulkHeaderProps> = ({ onOpenUserModal }) => {
  const {
    currentUser,
    language,
    setLanguage,
    theme,
    setTheme,
    activeTab,
    setActiveTab,
    isOnline,
    refreshActiveJobs,
    loading,
    t
  } = useBulkApp();

  const [currentTime, setCurrentTime] = useState(getSaudiCurrentTimeOnly());
  const [currentShift, setCurrentShift] = useState(getSaudiCurrentShift());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getSaudiCurrentTimeOnly());
      setCurrentShift(getSaudiCurrentShift());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-slate-950/95 backdrop-blur-md border-b border-amber-900/30 text-slate-100 shadow-lg overflow-x-hidden">
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-2">
        {/* Top Row: Brand, Saudi Clock, Shift, Controls */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 min-w-0">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 font-black text-base sm:text-lg shrink-0">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                  SPCC BULK
                </span>
                <span className="text-[11px] font-semibold text-slate-400 hidden md:inline truncate">
                  {t('plantName')}
                </span>
              </div>
              <h1 className="text-xs sm:text-base font-bold text-slate-100 tracking-tight leading-snug truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                {language === 'ar' ? 'تحميل السائب' : 'Bulk Cement Loading'}
              </h1>
            </div>
          </div>

          {/* Time & Shift Widget (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-bold text-amber-300">{currentTime}</span>
            <span className="text-slate-600">|</span>
            <span className="bg-amber-950/60 text-amber-400 px-1.5 py-0.5 rounded font-semibold text-[11px] border border-amber-800/40">
              {currentShift}
            </span>
          </div>

          {/* Action Utilities */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Google Sheet link (Icon only on mobile) */}
            <a
              href={BULK_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Live Google Sheet (BULK Tab)"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sheet</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70 hidden sm:inline" />
            </a>

            {/* Sync button */}
            <button
              onClick={() => refreshActiveJobs()}
              disabled={loading}
              title="Refresh live status"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-amber-400 border border-slate-800 transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs flex items-center gap-1 transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'en' ? 'عربي' : 'EN'}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-amber-400 border border-slate-800 transition active:scale-95 shrink-0 cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* User Profile Pill / Sign In Button */}
            {currentUser ? (
              <button
                onClick={onOpenUserModal}
                className="flex items-center gap-1 sm:gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shrink-0 max-w-[110px] sm:max-w-none"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${currentUser?.role === 'admin' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                <span className="font-bold text-slate-200 truncate max-w-[60px] sm:max-w-[120px]">
                  {currentUser.name}
                </span>
                {currentUser?.role === 'admin' ? (
                  <Shield className="w-3 h-3 text-purple-400 shrink-0" />
                ) : (
                  <UserIcon className="w-3 h-3 text-slate-400 shrink-0 hidden sm:inline" />
                )}
              </button>
            ) : (
              <button
                onClick={onOpenUserModal}
                className="h-8 px-2.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Lock className="w-3 h-3" />
                <span>{language === 'ar' ? 'دخول' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Tab Navigation */}
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-900 overflow-x-auto no-scrollbar gap-2">
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'workflow'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{t('bulkLoading')}</span>
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('records')}</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('manager')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'manager'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-purple-300 hover:bg-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t('managerDashboard')}</span>
              </button>
            )}
          </nav>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 shrink-0">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400 font-semibold animate-pulse">
                <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
