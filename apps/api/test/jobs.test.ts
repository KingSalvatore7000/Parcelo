import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, makeSociety, outbox } from './helpers';
import { queueReminders, markUnclaimed, cleanUp } from '../src/services/jobs';
import { processOutbox, setProviderForTests } from '../src/services/notify/notifier';
import { ProviderError, type Provider } from '../src/services/notify/providers';

let s: Awaited<ReturnType<typeof makeSociety>>;
const DAY = 86_400_000;
/** 10:30 India time today, when reminders may go out */
const morningIST = () => {
  const d = new Date();
  d.setUTCHours(5, 0, 0, 0);
  return d;
};

beforeAll(async () => {
  s = await makeSociety();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const parcel = (daysOld: number, status: 'LOGGED' | 'SCHEDULED' = 'LOGGED') =>
  prisma.parcel.create({
    data: {
      societyId: s.society.id,
      flatId: s.flatA.id,
      courier: 'Job Test',
      status,
      loggedById: s.guard.id,
      loggedAt: new Date(morningIST().getTime() - daysOld * DAY),
    },
  });

describe('reminders', () => {
  it('queues one reminder for a parcel waiting 2 days, and not again the same day', async () => {
    const old = await parcel(3);
    const fresh = await parcel(0.5);
    await queueReminders(morningIST());
    await queueReminders(morningIST());
    const r = await prisma.notification.findMany({ where: { parcelId: { in: [old.id, fresh.id] }, kind: 'REMINDER' } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ parcelId: old.id, userId: s.residentA.id, status: 'PENDING' });
  });

  it('sends nothing at night (India time)', async () => {
    await parcel(4);
    const night = new Date(morningIST().getTime() + 14 * 3600_000); // 00:30 IST
    expect(await queueReminders(night)).toBe(0);
  });
});

describe('unclaimed parcels', () => {
  it('marks parcels logged 7+ days ago as UNCLAIMED, leaves newer ones', async () => {
    const old = await parcel(8);
    const newer = await parcel(5);
    await markUnclaimed(morningIST());
    expect((await prisma.parcel.findUnique({ where: { id: old.id } }))!.status).toBe('UNCLAIMED');
    expect((await prisma.parcel.findUnique({ where: { id: newer.id } }))!.status).toBe('LOGGED');
  });
});

describe('outbox', () => {
  const queue = async () => {
    const p = await parcel(0);
    return prisma.notification.create({
      data: { userId: s.residentA.id, parcelId: p.id, channel: 'PUSH', kind: 'NEW_PARCEL' },
    });
  };

  it('sends pending messages and marks them SENT', async () => {
    const n = await queue();
    const before = outbox.length;
    await processOutbox();
    const row = await prisma.notification.findUnique({ where: { id: n.id } });
    expect(row).toMatchObject({ status: 'SENT', attempts: 1 });
    const sent = outbox.slice(before).find((m) => m.to === s.residentA.phone);
    expect(sent?.text).toContain('Job Test');
    expect(sent?.text).toContain('Tower A - 101');
  });

  it('retries a temporary failure, then gives up after 3 attempts', async () => {
    const flaky: Provider = { channel: 'console', send: async () => { throw new ProviderError('HTTP 503', true); } };
    setProviderForTests('console', flaky);
    try {
      const n = await queue();
      await processOutbox();
      expect(await prisma.notification.findUnique({ where: { id: n.id } })).toMatchObject({ status: 'PENDING', attempts: 1 });
      await processOutbox();
      await processOutbox();
      expect(await prisma.notification.findUnique({ where: { id: n.id } })).toMatchObject({ status: 'FAILED', attempts: 3 });
    } finally {
      const capture: Provider = { channel: 'console', send: async (m) => { outbox.push(m); } };
      setProviderForTests('console', capture);
    }
  });

  it('fails at once on an error that cannot succeed', async () => {
    const bad: Provider = { channel: 'console', send: async () => { throw new ProviderError('HTTP 400: bad template', false); } };
    setProviderForTests('console', bad);
    try {
      const n = await queue();
      await processOutbox();
      const row = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(row).toMatchObject({ status: 'FAILED', attempts: 1 });
      expect(row!.lastError).toContain('bad template');
    } finally {
      const capture: Provider = { channel: 'console', send: async (m) => { outbox.push(m); } };
      setProviderForTests('console', capture);
    }
  });
});

describe('clean-up', () => {
  it('removes expired sessions', async () => {
    await prisma.refreshToken.create({ data: { userId: s.guard.id, tokenHash: `expired-${Date.now()}`, expiresAt: new Date(Date.now() - 1000) } });
    const r = await cleanUp();
    expect(r.tokens).toBeGreaterThanOrEqual(1);
  });
});
