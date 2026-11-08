import { ParcelStatus } from '@parcelo/shared';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { dbChannel, processOutbox } from './notify/notifier';
import { socketService } from './socket.service';
import { signPhotoUrl } from './storage.service';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
/** Reminders go out only in the daytime, India time */
const REMINDER_HOURS_IST = { from: 9, to: 20 };
/** At most one reminder per parcel in this window */
const REMINDER_GAP_MS = 20 * 60 * 60 * 1000;

const IN_ROOM: ParcelStatus[] = [ParcelStatus.LOGGED, ParcelStatus.SCHEDULED, ParcelStatus.UNCLAIMED];

function istHour(now: Date) {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
}

/**
 * Queue a reminder for every resident of a flat whose parcel has waited reminderAfterDays or more,
 * once a day, in the daytime. Returns how many reminders were queued.
 */
export async function queueReminders(now = new Date()): Promise<number> {
  const h = istHour(now);
  if (h < REMINDER_HOURS_IST.from || h >= REMINDER_HOURS_IST.to) return 0;

  const waiting = await prisma.parcel.findMany({
    where: {
      status: { in: IN_ROOM },
      loggedAt: { lt: new Date(now.getTime() - config.jobs.reminderAfterDays * DAY_MS) },
      // no reminder for this parcel in the last 20 hours
      notifications: { none: { kind: 'REMINDER', createdAt: { gt: new Date(now.getTime() - REMINDER_GAP_MS) } } },
    },
    select: { id: true, courier: true, flat: { select: { users: { select: { id: true } } } } },
    take: 500,
  });

  const rows = waiting.flatMap((p) =>
    p.flat.users.map((u) => ({
      userId: u.id,
      parcelId: p.id,
      channel: dbChannel(),
      kind: 'REMINDER' as const,
      status: 'PENDING' as const,
      metadata: `Reminder: ${p.courier} parcel still at the gate`,
    }))
  );
  if (rows.length > 0) await prisma.notification.createMany({ data: rows });
  return rows.length;
}

/**
 * Parcels nobody has collected: LOGGED for unclaimedAfterDays, or SCHEDULED whose code expired
 * that long ago, become UNCLAIMED. The resident can still book a slot; the admin sees them as overdue.
 */
export async function markUnclaimed(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - config.jobs.unclaimedAfterDays * DAY_MS);
  const stale = await prisma.parcel.findMany({
    where: {
      OR: [
        { status: ParcelStatus.LOGGED, loggedAt: { lt: cutoff } },
        { status: ParcelStatus.SCHEDULED, loggedAt: { lt: cutoff }, handover: { otpExpiresAt: { lt: now } } },
      ],
    },
    select: { id: true, societyId: true, flatId: true, status: true },
    take: 500,
  });

  let marked = 0;
  for (const p of stale) {
    const moved = await prisma.parcel.updateMany({
      where: { id: p.id, status: p.status },
      data: { status: ParcelStatus.UNCLAIMED },
    });
    if (moved.count === 0) continue;
    marked++;
    const row = await prisma.parcel.findUnique({ where: { id: p.id }, include: { flat: true } });
    const view = row && { ...row, photoUrl: signPhotoUrl(row.photoUrl) };
    socketService.emitToGuards(p.societyId, 'parcel:unclaimed', view);
    socketService.emitToFlat(p.societyId, p.flatId, 'parcel:unclaimed', view);
  }
  return marked;
}

/** Remove expired sessions */
export async function cleanUp(now = new Date()) {
  const tokens = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
  return { tokens: tokens.count };
}

function every(ms: number, name: string, fn: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap a slow run
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`Job ${name} failed:`, err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, ms);
  timer.unref();
  void tick();
  return timer;
}

let timers: NodeJS.Timeout[] = [];

export function startJobs() {
  if (!config.jobs.enabled || timers.length > 0) return;
  timers = [
    every(30_000, 'outbox', processOutbox),
    every(15 * 60_000, 'daily', async () => {
      await markUnclaimed();
      await queueReminders();
      await cleanUp();
    }),
  ];
  console.log(`⏱️  Jobs running: messages every 30 s via ${config.notify.channel}; reminders after ${config.jobs.reminderAfterDays} days; unclaimed after ${config.jobs.unclaimedAfterDays} days`);
}

export function stopJobs() {
  timers.forEach(clearInterval);
  timers = [];
}
