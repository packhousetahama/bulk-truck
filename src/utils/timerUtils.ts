import { BulkActiveJob } from '../types';
import { formatElapsedSeconds } from './timeZone';

export interface BulkSessionElapsedInfo {
  grossSeconds: number;
  grossFormatted: string;       // "MM:SS" or "HH:MM:SS"
  downtimeSeconds: number;
  downtimeFormatted: string;    // "MM:SS" or "HH:MM:SS"
  netSeconds: number;
  netFormatted: string;         // "MM:SS" or "HH:MM:SS" (Frozen on stoppage)
  currentStoppageSeconds: number;
  currentStoppageFormatted: string;
  isStopped: boolean;
  stoppageReason?: string;
  isOvertime: boolean;          // >= 45 min net loading time for bulk load
}

/**
 * Calculates authoritative bulk loading session timing from server timestamps.
 * Formula:
 * Net elapsed = max(0, gross elapsed - accumulated downtime - current open downtime)
 * When a stoppage is reported, net timer freezes immediately while downtime timer begins.
 * On resolution, incident duration accumulates and net timer resumes.
 */
export function calculateBulkSessionElapsed(
  job: BulkActiveJob | null | undefined,
  authoritativeNowMs: number
): BulkSessionElapsedInfo {
  if (!job) {
    return {
      grossSeconds: 0,
      grossFormatted: '00:00',
      downtimeSeconds: 0,
      downtimeFormatted: '00:00',
      netSeconds: 0,
      netFormatted: '00:00',
      currentStoppageSeconds: 0,
      currentStoppageFormatted: '00:00',
      isStopped: false,
      stoppageReason: undefined,
      isOvertime: false
    };
  }

  const startMs = Number(job.startEpochMs) || authoritativeNowMs;
  const grossSeconds = Math.max(0, Math.floor((authoritativeNowMs - startMs) / 1000));

  const isStopped = job.status === 'STOPPAGE';
  const accumulatedDowntime = Number(job.totalDowntimeSeconds || 0);

  let currentStoppageSeconds = 0;
  if (isStopped && job.stoppageStartEpochMs) {
    currentStoppageSeconds = Math.max(0, Math.floor((authoritativeNowMs - Number(job.stoppageStartEpochMs)) / 1000));
  }

  const downtimeSeconds = accumulatedDowntime + currentStoppageSeconds;
  const netSeconds = Math.max(0, grossSeconds - downtimeSeconds);

  return {
    grossSeconds,
    grossFormatted: formatElapsedSeconds(grossSeconds),
    downtimeSeconds,
    downtimeFormatted: formatElapsedSeconds(downtimeSeconds),
    netSeconds,
    netFormatted: formatElapsedSeconds(netSeconds),
    currentStoppageSeconds,
    currentStoppageFormatted: formatElapsedSeconds(currentStoppageSeconds),
    isStopped,
    stoppageReason: job.stoppageReason,
    isOvertime: netSeconds >= 45 * 60 // 45 min threshold for bulk loading
  };
}
