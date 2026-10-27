export const SAUDI_TIMEZONE = 'Asia/Riyadh';

/**
 * Returns current Saudi Date formatted as YYYY-MM-DD
 */
export function getSaudiCurrentDateOnly(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SAUDI_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Returns current Saudi Time formatted as HH:MM:SS (24-hour)
 */
export function getSaudiCurrentTimeOnly(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: SAUDI_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }
}

/**
 * Determines SPCC shift based on Saudi current time:
 * Shift A: 07:00:00 to 14:59:59
 * Shift B: 15:00:00 to 22:59:59
 * Shift C: 23:00:00 to 06:59:59
 */
export function getSaudiCurrentShift(): 'Shift A' | 'Shift B' | 'Shift C' {
  const timeStr = getSaudiCurrentTimeOnly();
  const [hStr] = timeStr.split(':');
  const hour = parseInt(hStr, 10);
  if (hour >= 7 && hour < 15) return 'Shift A';
  if (hour >= 15 && hour < 23) return 'Shift B';
  return 'Shift C';
}

/**
 * Calculates duration between two HH:MM or HH:MM:SS strings in minutes.
 * Handles midnight crossing correctly (adds 24 hours when end < start).
 */
/**
 * Explicitly parses a 24-hour wall-clock time string (HH:mm:ss or HH:mm) into seconds from midnight.
 * Clock times are strictly hours and minutes (never ambiguously parsed as mm:ss).
 */
export function parseClockTimeToSeconds(clockTimeStr?: string): number {
  if (!clockTimeStr) return -1;
  const str = String(clockTimeStr).trim();
  if (!str || str === 'IN PROGRESS' || str === '-') return -1;
  
  const m = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return -1;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = m[3] ? parseInt(m[3], 10) : 0;
  return h * 3600 + min * 60 + sec;
}

/**
 * Calculates duration between two clock times in minutes.
 * Handles midnight crossing correctly (adds 24 hours when end < start).
 */
export function calculateDurationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const startSec = parseClockTimeToSeconds(start);
  let endSec = parseClockTimeToSeconds(end);
  if (startSec < 0 || endSec < 0) return 0;

  if (endSec < startSec) {
    endSec += 24 * 3600; // Crossed midnight
  }

  const diffSec = Math.max(0, endSec - startSec);
  return Math.round((diffSec / 60) * 10) / 10;
}

/**
 * Formats elapsed seconds into HH:MM:SS or MM:SS
 */
export function formatElapsedSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
