/**
 * Handover slots, decided by the server in India time (IST, UTC+05:30, no DST).
 * Two-hour blocks from 08:00 to 22:00, for today and tomorrow. A slot can be booked
 * until the hour before it starts.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const SLOT_START_HOURS = [8, 10, 12, 14, 16, 18, 20];
export const SLOT_LENGTH_HOURS = 2;
export const SLOT_DAYS_AHEAD = 2; // today and tomorrow
/** The handover code stays valid this long after the slot ends */
export const CODE_GRACE_MS = 2 * HOUR_MS;

export interface Slot {
  start: string; // ISO, UTC
  end: string;
  day: 'today' | 'tomorrow';
  label: string; // "10:00 – 12:00"
}

/** Midnight IST of the IST calendar day containing `at`, as a UTC timestamp */
function istMidnight(at: Date): number {
  const istNow = at.getTime() + IST_OFFSET_MS;
  const istDayStart = istNow - (istNow % (24 * HOUR_MS));
  return istDayStart - IST_OFFSET_MS;
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function availableSlots(now: Date = new Date()): Slot[] {
  const cutoff = now.getTime() + HOUR_MS; // must start at least an hour from now
  const slots: Slot[] = [];
  for (let d = 0; d < SLOT_DAYS_AHEAD; d++) {
    const dayStart = istMidnight(now) + d * 24 * HOUR_MS;
    for (const h of SLOT_START_HOURS) {
      const start = dayStart + h * HOUR_MS;
      if (start < cutoff) continue;
      slots.push({
        start: new Date(start).toISOString(),
        end: new Date(start + SLOT_LENGTH_HOURS * HOUR_MS).toISOString(),
        day: d === 0 ? 'today' : 'tomorrow',
        label: `${pad(h)} – ${pad(h + SLOT_LENGTH_HOURS)}`,
      });
    }
  }
  return slots;
}

/** The bookable slot matching these times exactly, or null */
export function findSlot(slotStart: string, slotEnd: string, now: Date = new Date()): Slot | null {
  const s = Date.parse(slotStart);
  const e = Date.parse(slotEnd);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return (
    availableSlots(now).find((slot) => Date.parse(slot.start) === s && Date.parse(slot.end) === e) ?? null
  );
}
