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

export async function fetchActiveBulkLoaders(): Promise<Record<string, BulkActiveJob>> {
  const url = `${getBackendUrl()}?action=getActiveBulkLoaders&_t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.status === 'success' && json.activeLoaders) {
      return json.activeLoaders;
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
      return { success: true, job: json.job };
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
      return { success: true, job: json.job };
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
      return { success: true, job: json.job };
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
