import { getSaudiCurrentTimeOnly, getSaudiCurrentDateOnly } from '../utils/timeZone';
// Offline outbox for Google Apps Script writes in Bulk Truck PWA
import { useSyncExternalStore } from 'react';

export type OutboxStatus = 'pending' | 'failed';
export interface OutboxItem {
  id: string;
  action: string;
  url: string;
  body: string;
  label: string;
  receipt?: string;
  siloId?: string;
  loadId?: string;
  operator?: string;
  queuedAt: number;
  attempts: number;
  status: OutboxStatus;
  error?: string;
}

const KEY = 'spcc_bulk_truck_outbox_v1';
const WRITE_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 8;

const WRITE_ACTIONS = new Set([
  'startBulkLoader',
  'reportBulkStoppage',
  'resolveBulkStoppage',
  'completeBulkLoader',
  'cancelBulkLoader',
  'saveBulkEntry',
  'saveBulkUser',
  'deleteBulkUser',
  'repairBulkSheet',
  'resetActiveBulkLoaders'
]);

const LABELS: Record<string, string> = {
  startBulkLoader: 'Start bulk loading',
  reportBulkStoppage: 'Report bulk stoppage',
  resolveBulkStoppage: 'Resolve bulk stoppage',
  completeBulkLoader: 'Complete bulk loading',
  cancelBulkLoader: 'Cancel bulk loading',
  saveBulkEntry: 'Save bulk entry',
  saveBulkUser: 'Save bulk user',
  deleteBulkUser: 'Delete bulk user'
};

let items: OutboxItem[] = load();
let flushing = false;
let version = 0;
const listeners = new Set<() => void>();
let flaggedNotice = 0;
let snapshot = {
  items,
  flushing,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  flaggedNotice,
  v: 0
};

function load(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

function emit() {
  version++;
  snapshot = {
    items: [...items],
    flushing,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    flaggedNotice,
    v: version
  };
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const getSnapshot = () => snapshot;

export function useBulkOutbox() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    items: s.items,
    pending: s.items.filter(i => i.status === 'pending').length,
    failed: s.items.filter(i => i.status === 'failed').length,
    syncing: s.flushing,
    online: s.online,
    flaggedNotice: s.flaggedNotice
  };
}

export function dismissFlaggedNotice() {
  flaggedNotice = 0;
  emit();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function describe(action: string, payload: any) {
  const receipt =
    payload?.receiptNumber ||
    payload?.receipt ||
    payload?.job?.receiptNumber ||
    payload?.entry?.receiptNumber ||
    undefined;
  const siloId = payload?.siloId || payload?.job?.siloId || payload?.entry?.siloId || undefined;
  const loadId = payload?.loadId || payload?.job?.loadId || payload?.entry?.loadId || undefined;
  const base = LABELS[action] || action;
  return {
    receipt,
    siloId,
    loadId,
    label: receipt ? `${base} #${String(receipt).toUpperCase()}` : siloId ? `${base} (${siloId})` : base
  };
}

function parseBody(init?: RequestInit): any | null {
  try {
    return typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  } catch {
    return null;
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), WRITE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const ACK = (action: string, payload: any) =>
  new Response(
    JSON.stringify({
      ok: true,
      status: 'success',
      queued: true,
      offline: true,
      message: 'Saved on device (offline queue). Will synchronize to Google Sheets once connection is restored.',
      job: payload?.job || (payload?.siloId ? {
        ...payload,
        startTime: payload.startTime || getSaudiCurrentTimeOnly(),
        startDate: payload.startDate || getSaudiCurrentDateOnly(),
        startEpochMs: payload.startEpochMs || payload.startedAtTimestamp || Date.now(),
        startedAtTimestamp: payload.startedAtTimestamp || payload.startEpochMs || Date.now(),
        status: payload.status || 'LOADING'
      } : undefined)
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

function enqueue(url: string, action: string, payload: any) {
  const d = describe(action, payload);
  const body = JSON.stringify({ ...payload, queuedAt: Date.now(), offlineQueued: true });
  items.push({
    id: uid(),
    action,
    url,
    body,
    label: d.label,
    receipt: d.receipt,
    siloId: d.siloId,
    loadId: d.loadId,
    operator: payload?.operator || payload?.operatorName || payload?.id,
    queuedAt: Date.now(),
    attempts: 0,
    status: 'pending'
  });
  persist();
  emit();
}

/** Drop-in replacement for fetch(gasUrl, init) in Bulk Truck */
export async function bulkGasFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const payload = parseBody(init);
  const action = payload?.action;
  if (!action || !WRITE_ACTIONS.has(action)) {
    return fetch(url, init); // Reads go direct
  }

  const mustQueue = !navigator.onLine || items.some(i => i.status === 'pending');
  if (mustQueue) {
    enqueue(url, action, payload);
    void flushBulkOutbox();
    return ACK(action, payload);
  }

  try {
    return await timedFetch(url, init);
  } catch {
    enqueue(url, action, payload);
    return ACK(action, payload);
  }
}

const isDuplicateError = (msg: string) => /duplicate/i.test(msg);

export async function flushBulkOutbox(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  emit();
  let delivered = 0;

  try {
    for (;;) {
      const item = items.find(i => i.status === 'pending');
      if (!item) break;

      let res: Response;
      try {
        res = await timedFetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: item.body
        });
      } catch {
        break; // Still offline
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (data && (data.ok || data.status === 'success' || data.success)) {
        items = items.filter(i => i.id !== item.id);
        delivered++;
        if (data.needsReview) flaggedNotice++;
      } else if (data && data.error && isDuplicateError(String(data.error))) {
        items = items.filter(i => i.id !== item.id);
        delivered++;
      } else if (data && (data.error || data.message)) {
        item.status = 'failed';
        item.error = String(data.error || data.message);
      } else {
        item.attempts++;
        if (item.attempts >= MAX_ATTEMPTS) {
          item.status = 'failed';
          item.error = 'Server did not respond correctly.';
        } else {
          persist();
          emit();
          break;
        }
      }
      persist();
      emit();
    }
  } finally {
    flushing = false;
    persist();
    emit();
    if (delivered > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bulk-outbox-synced', { detail: { delivered } }));
    }
  }
}

export function hasPendingBulkForSilo(siloId: string): boolean {
  return items.some(i => i.status === 'pending' && (i.siloId === siloId || i.action === 'startBulkLoader'));
}

export function retryFailedBulkItems() {
  items.forEach(i => {
    if (i.status === 'failed') {
      i.status = 'pending';
      i.attempts = 0;
      i.error = undefined;
    }
  });
  persist();
  emit();
  void flushBulkOutbox();
}

export function discardBulkItem(id: string) {
  items = items.filter(i => i.id !== id);
  persist();
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emit();
    void flushBulkOutbox();
  });
  window.addEventListener('offline', () => emit());
  window.addEventListener('focus', () => void flushBulkOutbox());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushBulkOutbox();
  });
  setInterval(() => {
    if (items.some(i => i.status === 'pending')) void flushBulkOutbox();
  }, 15000);
  setTimeout(() => void flushBulkOutbox(), 2500);
}
