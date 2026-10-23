import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { BulkDashboardMetrics, BulkSiloId } from '../types';
import { fetchBulkDashboardMetrics } from '../services/api';
import { BULK_SILO_IDS, BULK_SILOS } from '../utils/constants';
import { formatElapsedSeconds } from '../utils/timeZone';
import {
  Scale,
  Truck,
  Clock,
  AlertTriangle,
  RotateCw,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Layers,
  XCircle
} from 'lucide-react';

export const BulkManagerDashboard: React.FC = () => {
  const { language, activeJobs, activeNowMs, cancelJob, showToast } = useBulkApp();
  const [metrics, setMetrics] = useState<BulkDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchBulkDashboardMetrics();
      if (data) setMetrics(data);
    } catch (err) {
      console.warn('Failed to load manager metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const totalTrucks = metrics?.totalTrucks || 0;
  const totalTonnes = metrics?.totalTonnes || 0;
  const opcTonnes = metrics?.opcTonnes || 0;
  const guTonnes = metrics?.guTonnes || 0;
  const ppcTonnes = metrics?.ppcTonnes || 0;
  const totalDowntime = metrics?.totalDowntimeMinutes || 0;
  const avgGross = metrics?.avgGrossMinutes || 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-20">
      {/* Header */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2.5 py-0.5 rounded-md border border-purple-800/60">
            Manager Cockpit · لوحة التحكم الإدارية
          </span>
          <h2 className="text-lg font-black text-slate-100 tracking-tight mt-1">
            SPCC Tahama Bulk Cement Fleet Operations
          </h2>
        </div>

        <button
          onClick={loadMetrics}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-purple-400 border border-slate-850 transition active:scale-95 disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
        </button>
      </div>

      {/* Top Production KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            Total Dispatched
          </span>
          <div className="text-2xl font-black font-mono text-amber-400">
            {totalTonnes.toLocaleString()} <span className="text-xs text-slate-400">t</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Today's bulk volume</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-sky-400" />
            Completed Loads
          </span>
          <div className="text-2xl font-black font-mono text-sky-400">
            {totalTrucks} <span className="text-xs text-slate-400">trucks</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Finished and weighed out</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Avg Loading Time
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {avgGross} <span className="text-xs text-slate-400">min</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Gross average per load</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            Total Downtime
          </span>
          <div className="text-2xl font-black font-mono text-red-400">
            {totalDowntime} <span className="text-xs text-slate-400">min</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Cumulative stoppage delay</span>
        </div>
      </div>

      {/* Production by Cement Type Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Tonnes Dispatched by Material
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase text-emerald-400 block">OPC (عادي)</span>
            <span className="text-xl font-black font-mono text-emerald-300">{opcTonnes.toLocaleString()} t</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">New Silos 5 & 6</span>
          </div>

          <div className="bg-sky-950/20 border border-sky-500/30 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase text-sky-400 block">GU (مقاوم)</span>
            <span className="text-xl font-black font-mono text-sky-300">{guTonnes.toLocaleString()} t</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Old Silo 1</span>
          </div>

          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase text-amber-400 block">PPC (بوزولاني)</span>
            <span className="text-xl font-black font-mono text-amber-300">{ppcTonnes.toLocaleString()} t</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Old Silo 2</span>
          </div>
        </div>
      </div>

      {/* Live 4-Silo Cockpit & Emergency Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Live Authorised Silos Bay Cockpit
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BULK_SILO_IDS.map(id => {
            const silo = BULK_SILOS[id];
            const activeJob = activeJobs[id];
            const isOccupied = !!activeJob;

            let elapsedSec = 0;
            if (activeJob) {
              elapsedSec = Math.max(0, Math.floor((activeNowMs - activeJob.startEpochMs) / 1000));
            }

            return (
              <div
                key={id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-100">{silo.nameEn}</h4>
                    <span className="text-[11px] text-slate-400">{silo.defaultStation}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-black uppercase bg-slate-900 border border-slate-700 text-amber-400 font-mono">
                    {silo.cementType}
                  </span>
                </div>

                {isOccupied ? (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-400">
                        {activeJob.truckNumber} (#{activeJob.receiptNumber})
                      </span>
                      <span className="font-mono font-bold text-slate-200">
                        {formatElapsedSeconds(elapsedSec)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Op: {activeJob.operator}</span>
                      <span className="font-mono">{activeJob.authorisedTonnes} t</span>
                    </div>

                    {/* Admin Emergency Cancel Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Admin action: Cancel active load on ${silo.nameEn}?`)) {
                          cancelJob(id, 'Admin emergency cancellation');
                        }
                      }}
                      className="w-full mt-1 py-1 px-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span>Admin Force Cancel</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Idle & Ready for Loading</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
