import React, { useState, useEffect } from 'react';
import { BulkEntry } from '../types';
import { fetchBulkEntries } from '../services/api';
import { useBulkApp } from '../context/BulkAppContext';
import { BULK_SILO_IDS, BULK_SILOS } from '../utils/constants';
import {
  Search,
  Filter,
  Download,
  RotateCw,
  Calendar,
  Layers,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';

export const BulkRecordsView: React.FC = () => {
  const { language, currentUser } = useBulkApp();
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterSilo, setFilterSilo] = useState('');
  const [filterCement, setFilterCement] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchBulkEntries();
      setEntries(data);
    } catch (err) {
      console.warn('Error loading records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = entries.filter(e => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchTruck = e.truckNumber?.toLowerCase().includes(q);
      const matchReceipt = e.receiptNumber?.toLowerCase().includes(q);
      const matchOp = e.operator?.toLowerCase().includes(q);
      if (!matchTruck && !matchReceipt && !matchOp) return false;
    }
    if (filterShift && e.shift !== filterShift) return false;
    if (filterSilo && e.siloId !== filterSilo) return false;
    if (filterCement && e.cementType !== filterCement) return false;
    return true;
  });

  const exportCsv = () => {
    const headers = [
      'Date',
      'Time',
      'Shift',
      'Silo',
      'Station',
      'Truck Number',
      'Receipt #',
      'Cement Type',
      'Authorised Tonnes',
      'Actual Tonnes',
      'Variance',
      'Gross Minutes',
      'Downtime Minutes',
      'Net Minutes',
      'Operator',
      'Status',
      'Comments'
    ];

    const rows = filtered.map(e => [
      e.date,
      e.time,
      e.shift,
      e.siloName,
      e.station,
      e.truckNumber,
      e.receiptNumber,
      e.cementType,
      e.authorisedTonnes,
      e.actualTonnes,
      e.varianceTonnes || 0,
      e.grossDurationMinutes,
      e.downtimeMinutes,
      e.netDurationMinutes,
      e.operator,
      e.status,
      `"${(e.comments || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPCC_Bulk_Dispatches_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-20">
      {/* Top Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{language === 'ar' ? 'سجل شحنات السائب المنجزة' : 'Bulk Loading Dispatch Records'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {filtered.length} {language === 'ar' ? 'شحنة مسجلة' : 'dispatches found'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-amber-400 border border-slate-800 transition active:scale-95 disabled:opacity-50"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/10 flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-950" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
          {/* Search */}
          <div className="relative sm:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plate, receipt, operator..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Shift Filter */}
          <select
            value={filterShift}
            onChange={e => setFilterShift(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none"
          >
            <option value="">All Shifts (الكل)</option>
            <option value="Shift A">Shift A (07:00 - 15:00)</option>
            <option value="Shift B">Shift B (15:00 - 23:00)</option>
            <option value="Shift C">Shift C (23:00 - 07:00)</option>
          </select>

          {/* Silo Filter */}
          <select
            value={filterSilo}
            onChange={e => setFilterSilo(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none"
          >
            <option value="">All Silos (جميع الصوامع)</option>
            {BULK_SILO_IDS.map(id => (
              <option key={id} value={id}>
                {BULK_SILOS[id].nameEn} ({BULK_SILOS[id].cementType})
              </option>
            ))}
          </select>

          {/* Cement Filter */}
          <select
            value={filterCement}
            onChange={e => setFilterCement(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none"
          >
            <option value="">All Materials (جميع الأنواع)</option>
            <option value="OPC">OPC (Ordinary Portland)</option>
            <option value="GU">GU (General Use)</option>
            <option value="PPC">PPC (Portland Pozzolana)</option>
          </select>
        </div>
      </div>

      {/* Dispatches List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {loading ? 'Fetching dispatches from Google Sheets...' : 'No loading records match the selected criteria.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-4 hover:bg-slate-850/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                {/* Left Info: Truck, Receipt, Silo */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-slate-100">
                      {item.truckNumber}
                    </span>
                    <span className="font-mono text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                      #{item.receiptNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.cementType === 'OPC'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : item.cementType === 'GU'
                          ? 'bg-sky-950 text-sky-400 border border-sky-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {item.cementType}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{item.siloName || item.siloId}</span>
                    <span>•</span>
                    <span>{item.date} {item.time}</span>
                    <span>•</span>
                    <span>{item.shift}</span>
                    <span>•</span>
                    <span>{language === 'ar' ? 'المشغل:' : 'Op:'} {item.operator}</span>
                  </div>
                </div>

                {/* Right Info: Tonnes & Timing */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-emerald-400 block leading-tight">
                      {item.actualTonnes} t
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      auth: {item.authorisedTonnes} t
                    </span>
                  </div>

                  <div className="text-right text-[11px] border-l border-slate-800 pl-3">
                    <span className="text-slate-300 font-mono font-bold block">
                      {item.grossDurationMinutes}m gross
                    </span>
                    {item.downtimeMinutes > 0 && (
                      <span className="text-red-400 font-mono block text-[10px]">
                        -{item.downtimeMinutes}m down
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
