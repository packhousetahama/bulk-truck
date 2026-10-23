import {
  BulkSiloId,
  BulkActiveJob,
  BulkEntry,
  BulkDashboardMetrics,
  BulkQRVariant,
  CementType
} from '../types';
import { BULK_BACKEND_URL } from '../utils/constants';

function getBackendUrl(): string {
  try {
    const saved = localStorage.getItem('spcc_bulk_backend_url');
    if (saved && saved.startsWith('http')) return saved;
  } catch {}
  return BULK_BACKEND_URL;
}

export function normalizeSiloId(raw: any): BulkSiloId | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === 'NEW_5' || s === '5' || (s.includes('NEW') && s.includes('5'))) return 'NEW_5';
  if (s === 'NEW_6' || s === '6' || (s.includes('NEW') && s.includes('6'))) return 'NEW_6';
  if (s === 'OLD_1' || s === '1' || (s.includes('OLD') && s.includes('1'))) return 'OLD_1';
  if (s === 'OLD_2' || s === '2' || (s.includes('OLD') && s.includes('2'))) return 'OLD_2';
  if (s.includes('5')) return 'NEW_5';
  if (s.includes('6')) return 'NEW_6';
  if (s.includes('1')) return 'OLD_1';
  if (s.includes('2')) return 'OLD_2';
  return null;
}

export function normalizeActiveJob(raw: any, fallbackSiloId?: BulkSiloId): BulkActiveJob | null {
  if (!raw) return null;
  const siloId = normalizeSiloId(raw.siloId || fallbackSiloId) || fallbackSiloId || 'NEW_5';

  // Epoch timestamp calculation
  let epoch = Number(raw.startEpochMs || raw.startedAtTimestamp || raw.timestamp) || 0;
  if (!epoch && raw.startTime) {
    try {
      const parts = String(raw.startTime).split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const d = new Date();
        d.setHours(parts[0], parts[1], parts[2] || 0, 0);
        epoch = d.getTime();
      }
    } catch {}
  }
  if (!epoch || isNaN(epoch)) {
    epoch = Date.now();
  }

  const rawStatus = String(raw.status || '').toUpperCase();
  const status: 'LOADING' | 'STOPPAGE' =
    rawStatus.includes('STOP') || rawStatus === 'ISSUE OPEN' ? 'STOPPAGE' : 'LOADING';

  const rawCement = String(raw.cementType || raw.cementLabel || 'OPC').toUpperCase();
  const cementType: CementType =
    rawCement.includes('PPC') ? 'PPC' : rawCement.includes('GU') || rawCement.includes('SRC') ? 'GU' : 'OPC';

  return {
    siloId,
    receiptNumber: String(raw.receiptNumber || raw.receipt || '').trim(),
    truckNumber: String(raw.truckNumber || raw.vehicleNumber || raw.plate || 'TRUCK').trim(),
    cementType,
    authorisedTonnes: Number(raw.authorisedTonnes || raw.tons || raw.actualTonnes) || 30,
    startTime: String(raw.startTime || ''),
    startEpochMs: epoch,
    operator: String(raw.operator || raw.operatorName || 'Operator').trim(),
    shift: String(raw.shift || 'Shift A'),
    variant: raw.variant || 'VARIANT_1_PIPE',
    conflictDetected: !!raw.conflictDetected,
    conflictResolution: raw.conflictResolution || '',
    status,
    stoppageReason: raw.stoppageReason || raw.activeProblem || '',
    stoppageStartEpochMs: Number(raw.stoppageStartEpochMs || raw.activeStoppageStartedAt) || undefined
  };
}

export async function fetchActiveBulkLoaders(): Promise<Record<string, BulkActiveJob>> {
  const url = `${getBackendUrl()}?action=getActiveBulkLoaders&_t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.status === 'success' && json.activeLoaders) {
      const normalized: Record<string, BulkActiveJob> = {};
      Object.keys(json.activeLoaders).forEach(key => {
        const job = normalizeActiveJob(json.activeLoaders[key], key as any);
        if (job) {
          normalized[job.siloId] = job;
        }
      });
      return normalized;
    }
  } catch (err) {
    console.warn('fetchActiveBulkLoaders error:', err);
  }
  return {};
}

export async function startBulkLoaderRemote(params: {
  siloId: BulkSiloId;
  receiptNumber: string;
  truckNumber: string;
  cementType: CementType;
  authorisedTonnes: number;
  operator: string;
  variant: BulkQRVariant;
  conflictDetected?: boolean;
  conflictResolution?: string;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'startBulkLoader',
        ...params
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.message || 'Failed to start bulk loader' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function reportBulkStoppageRemote(params: {
  siloId: BulkSiloId;
  reason: string;
  comment?: string;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'reportBulkStoppage',
        ...params
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.message || 'Failed to report stoppage' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function resolveBulkStoppageRemote(params: {
  siloId: BulkSiloId;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'resolveBulkStoppage',
        ...params
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.message || 'Failed to resolve stoppage' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function completeBulkLoaderRemote(params: {
  siloId: BulkSiloId;
  actualTonnes: number;
  grossDurationMinutes?: number;
  netDurationMinutes?: number;
  downtimeMinutes?: number;
}): Promise<{ success: boolean; completedJob?: any; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'completeBulkLoader',
        ...params
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      return { success: true, completedJob: json.completedJob };
    }
    return { success: false, error: json.message || 'Failed to complete loader' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function cancelBulkLoaderRemote(params: {
  siloId: BulkSiloId;
  reason?: string;
  cancelledBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'cancelBulkLoader',
        ...params
      })
    });
    const json = await res.json();
    return { success: json.status === 'success', error: json.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function submitBulkEntry(entry: Partial<BulkEntry>): Promise<{ success: boolean; id?: string; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveBulkEntry',
        entry
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      return { success: true, id: json.id };
    }
    return { success: false, error: json.message || 'Failed to save bulk entry' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function fetchBulkEntries(filters?: {
  date?: string;
  shift?: string;
  siloId?: string;
  cementType?: string;
}): Promise<BulkEntry[]> {
  const params = new URLSearchParams({ action: 'getBulkEntries', _t: String(Date.now()) });
  if (filters?.date) params.append('date', filters.date);
  if (filters?.shift) params.append('shift', filters.shift);
  if (filters?.siloId) params.append('siloId', filters.siloId);
  if (filters?.cementType) params.append('cementType', filters.cementType);

  const url = `${getBackendUrl()}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.status === 'success' && Array.isArray(json.entries)) {
      return json.entries;
    }
  } catch (err) {
    console.warn('fetchBulkEntries error:', err);
  }
  return [];
}

export async function fetchBulkDashboardMetrics(): Promise<BulkDashboardMetrics | null> {
  const url = `${getBackendUrl()}?action=getBulkDashboardMetrics&_t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.status === 'success' && json.metrics) {
      return json.metrics;
    }
  } catch (err) {
    console.warn('fetchBulkDashboardMetrics error:', err);
  }
  return null;
}
