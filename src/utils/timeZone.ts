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
export function calculateDurationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const parseSec = (t: string) => {
    const parts = t.trim().split(':').map(Number);
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const startSec = parseSec(start);
  let endSec = parseSec(end);

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
