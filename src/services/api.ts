import {
  BulkSiloId,
  BulkActiveJob,
  BulkEntry,
  BulkDashboardMetrics,
  BulkQRVariant,
  CementType,
  User
} from '../types';
import { BULK_BACKEND_URL, DEFAULT_USERS } from '../utils/constants';

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
    driverName: String(raw.driverName || raw.driver || '').trim() || undefined,
    driverPhone: String(raw.driverPhone || raw.phone || '').trim() || undefined,
    driverId: String(raw.driverId || '').trim() || undefined,
    ticketSiloRef: String(raw.ticketSiloRef || raw.siloRef || '').trim() || undefined,
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

export async function resetActiveBulkLoadersRemote(): Promise<{ success: boolean; message?: string }> {
  const url = `${getBackendUrl()}?action=resetActiveBulkLoaders&_t=${Date.now()}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return { success: !!(json.ok || json.status === 'success'), message: json.message };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
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
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  ticketSiloRef?: string;
  conflictDetected?: boolean;
  conflictResolution?: string;
  id?: string;
  userId?: string;
  pin?: string;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'startBulkLoader',
        id: params.userId || params.id,
        pin: params.pin,
        ...params
      })
    });
    const json = await res.json();
    if (json.ok || json.status === 'success' || json.success) {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.error || json.message || 'Failed to start bulk loader' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function reportBulkStoppageRemote(params: {
  siloId: BulkSiloId;
  reason: string;
  comment?: string;
  id?: string;
  userId?: string;
  pin?: string;
  receiptNumber?: string;
  loadId?: string;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'reportBulkStoppage',
        id: params.userId || params.id,
        pin: params.pin,
        ...params
      })
    });
    const json = await res.json();
    if (json.ok || json.status === 'success' || json.success) {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.error || json.message || 'Failed to report stoppage' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function resolveBulkStoppageRemote(params: {
  siloId: BulkSiloId;
  id?: string;
  userId?: string;
  pin?: string;
  receiptNumber?: string;
  loadId?: string;
  stoppageId?: string;
}): Promise<{ success: boolean; job?: BulkActiveJob; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'resolveBulkStoppage',
        id: params.userId || params.id,
        pin: params.pin,
        ...params
      })
    });
    const json = await res.json();
    if (json.ok || json.status === 'success' || json.success) {
      const normalizedJob = json.job ? normalizeActiveJob(json.job) : undefined;
      return { success: true, job: normalizedJob || json.job };
    }
    return { success: false, error: json.error || json.message || 'Failed to resolve stoppage' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function completeBulkLoaderRemote(params: {
  siloId: BulkSiloId;
  actualTonnes: number;
  receiptNumber?: string;
  loadId?: string;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  ticketSiloRef?: string;
  grossDurationMinutes?: number;
  netDurationMinutes?: number;
  downtimeMinutes?: number;
  stoppage?: string;
  status?: string;
  id?: string;
  userId?: string;
  pin?: string;
}): Promise<{ success: boolean; completedJob?: any; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'completeBulkLoader',
        id: params.userId || params.id,
        pin: params.pin,
        ...params
      })
    });
    const json = await res.json();
    if (json.ok || json.status === 'success' || json.success) {
      return { success: true, completedJob: json.completedJob || json };
    }
    return { success: false, error: json.error || json.message || 'Failed to complete loader' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function cancelBulkLoaderRemote(params: {
  siloId: BulkSiloId;
  reason?: string;
  cancelledBy?: string;
  id?: string;
  userId?: string;
  pin?: string;
  receiptNumber?: string;
  loadId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'cancelBulkLoader',
        id: params.userId || params.id,
        pin: params.pin,
        ...params
      })
    });
    const json = await res.json();
    return { success: !!(json.ok || json.status === 'success' || json.success), error: json.error || json.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function submitBulkEntry(entry: Partial<BulkEntry>, user?: User | null): Promise<{ success: boolean; id?: string; error?: string }> {
  const url = getBackendUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveBulkEntry',
        id: user?.id,
        pin: user?.pin,
        entry: {
          ...entry,
          vehicleNumber: entry.truckNumber || (entry as any).vehicleNumber,
          operatorName: entry.operator || (entry as any).operatorName
        }
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

// --- AUTHENTICATION & USER MANAGEMENT ---
const LOCAL_USERS_KEY = 'spcc_bulk_users_store';
const USERS_STORE_VER = 'spcc_bulk_users_v3_6digits';

export function getUsers(): User[] {
  try {
    const ver = localStorage.getItem('spcc_bulk_users_ver');
    if (ver !== USERS_STORE_VER) {
      localStorage.removeItem(LOCAL_USERS_KEY);
      localStorage.setItem('spcc_bulk_users_ver', USERS_STORE_VER);
      return DEFAULT_USERS;
    }
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_USERS;
}

export function saveUsers(users: User[]) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {}
}

export async function authenticateUser(userId: string, pin: string): Promise<{ success: boolean; user?: User; message?: string }> {
  const cleanId = String(userId || '').trim();
  const cleanPin = String(pin || '').trim();
  if (!cleanId || !cleanPin) {
    return { success: false, message: 'Please provide both User ID and PIN.' };
  }

  // 1. Try server-side authentication if backend is accessible
  const url = getBackendUrl();
  if (url && url.startsWith('http')) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', id: cleanId, pin: cleanPin })
      });
      const data = await res.json();
      if (data.ok && data.user) {
        const user: User = {
          id: data.user.id || cleanId.toLowerCase(),
          name: data.user.name || cleanId,
          role: data.user.role || 'user',
          pin: cleanPin,
          enabled: true
        };
        return { success: true, user };
      }
      if (data.error || data.message) {
        return { success: false, message: data.error || data.message };
      }
    } catch (err) {
      console.warn('Backend authentication failed or offline, checking local credentials:', err);
    }
  }

  // 2. Local fallback verification
  const users = getUsers();
  const lowerId = cleanId.toLowerCase();
  const normKey = lowerId.replace(/[\s._-]+/g, '');

  const matched = users.find(u => {
    const uId = (u.id || '').toLowerCase();
    const uName = (u.name || '').toLowerCase();
    return (
      uId === lowerId ||
      uName === lowerId ||
      uId.replace(/[\s._-]+/g, '') === normKey ||
      uName.replace(/[\s._-]+/g, '') === normKey
    );
  });

  if (!matched) {
    return { success: false, message: 'User ID not found' };
  }
  if (matched.enabled === false) {
    return { success: false, message: 'This account has been deactivated by an administrator' };
  }
  if (matched.pin !== cleanPin) {
    return { success: false, message: 'Incorrect PIN / Password' };
  }

  return {
    success: true,
    user: {
      id: matched.id || lowerId,
      name: matched.name,
      role: matched.role,
      pin: cleanPin,
      enabled: true
    }
  };
}

export async function adminSaveUser(adminUser: User, targetId: string, displayName: string, role: 'admin' | 'user', newPin: string): Promise<{ success: boolean; message?: string }> {
  const url = getBackendUrl();
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveAppUser',
        id: adminUser.id || adminUser.name,
        pin: adminUser.pin || 'Jaw@red',
        targetId,
        displayName,
        role,
        newPin
      })
    });
  } catch (e) {
    console.warn('Remote user save failed, saving locally:', e);
  }

  const list = getUsers();
  const idx = list.findIndex(u => (u.id || '').toLowerCase() === targetId.toLowerCase());
  if (idx >= 0) {
    list[idx] = { ...list[idx], name: displayName, role, pin: newPin, enabled: true };
  } else {
    list.push({ id: targetId, name: displayName, role, pin: newPin, enabled: true });
  }
  saveUsers(list);
  return { success: true };
}

export async function adminDeleteUser(adminUser: User, targetId: string): Promise<{ success: boolean; message?: string }> {
  const url = getBackendUrl();
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteAppUser',
        id: adminUser.id || adminUser.name,
        pin: adminUser.pin || 'Jaw@red',
        targetId
      })
    });
  } catch (e) {
    console.warn('Remote user delete failed, deleting locally:', e);
  }

  const list = getUsers().filter(u => (u.id || '').toLowerCase() !== targetId.toLowerCase());
  saveUsers(list);
  return { success: true };
}
