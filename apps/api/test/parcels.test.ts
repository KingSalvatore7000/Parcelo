import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, prisma, makeSociety, login, bearer, PNG } from './helpers';
import { availableSlots } from '../src/modules/parcels/slots';

let s: Awaited<ReturnType<typeof makeSociety>>;
let guard: string, resA: string, resB: string;

beforeAll(async () => {
  s = await makeSociety();
  guard = (await login(s.guard.phone)).token;
  resA = (await login(s.residentA.phone)).token;
  resB = (await login(s.residentB.phone)).token;
});
afterAll(async () => {
  await prisma.$disconnect();
});

const logParcel = async (body: Record<string, unknown> = {}) => {
  const res = await api().post('/parcels').set(bearer(guard)).send({ flatId: s.flatA.id, courier: 'Amazon', ...body });
  expect(res.status).toBe(201);
  return res.body.data;
};
const slot = () => availableSlots()[0];
const schedule = (id: string, token = resA, mode = 'PICKUP') =>
  api().post(`/parcels/${id}/schedule`).set(bearer(token)).send({ mode, slotStart: slot().start, slotEnd: slot().end });

describe('photos', () => {
  it('stores an uploaded photo privately and serves it only on a signed link', async () => {
    const up = await api().post('/parcels/upload-photo').set(bearer(guard)).send({ image: PNG });
    expect(up.status).toBe(200);
    expect(up.body.photoUrl).toMatch(/^\/uploads\/parcels\/[a-f0-9]{32}\.png$/);

    expect((await api().get(up.body.photoUrl)).status).toBe(403); // bare path
    const ok = await api().get(up.body.previewUrl);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    const tampered = up.body.previewUrl.replace(/sig=./, (m: string) => (m.endsWith('A') ? 'sig=B' : 'sig=A'));
    expect((await api().get(tampered)).status).toBe(403);
    const expired = up.body.previewUrl.replace(/exp=\d+/, 'exp=1000');
    expect((await api().get(expired)).status).toBe(403);

    const parcel = await logParcel({ photoUrl: up.body.photoUrl });
    expect(parcel.photoUrl).toContain('sig=');
    expect((await api().get(parcel.photoUrl)).status).toBe(200);
  });

  it('refuses a photo that is not an image', async () => {
    const html = 'data:image/png;base64,' + Buffer.from('<script>x</script>').toString('base64');
    expect((await api().post('/parcels/upload-photo').set(bearer(guard)).send({ image: html })).status).toBe(400);
  });
});

describe('handover', () => {
  it('queues a notification for each resident when a parcel is logged', async () => {
    const p = await logParcel();
    const n = await prisma.notification.findMany({ where: { parcelId: p.id } });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ userId: s.residentA.id, status: 'PENDING', kind: 'NEW_PARCEL' });
  });

  it('lets the resident reschedule and invalidates the old code', async () => {
    const p = await logParcel();
    const first = (await schedule(p.id)).body.data;
    const second = (await schedule(p.id, resA, 'DOOR')).body.data;
    expect(second.rescheduled).toBe(true);
    expect(second.feePaise).toBe(2000);
    if (first.code !== second.code) {
      const old = await api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code: first.code });
      expect(old.body.error).toBe('INVALID_HANDOVER_CODE');
    }
    const done = await api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code: second.code });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('HANDED_OVER');
  });

  it('stops parallel guessing at 5 tries', async () => {
    const p = await logParcel();
    const { code } = (await schedule(p.id)).body.data;
    const wrong = code === '1111' ? '2222' : '1111';
    const burst = await Promise.all(Array.from({ length: 10 }, () => api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code: wrong })));
    expect(burst.filter((r) => r.body.error === 'INVALID_HANDOVER_CODE').length).toBe(5);
    const right = await api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code });
    expect(right.body.error).toBe('CODE_LOCKED');
  });

  it('completes a handover exactly once when two guards submit together', async () => {
    const p = await logParcel();
    const { code } = (await schedule(p.id)).body.data;
    const both = await Promise.all([1, 2].map(() => api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code })));
    expect(both.filter((r) => r.status === 200).length).toBe(1);
  });

  it('keeps residents to their own flat', async () => {
    const p = await logParcel();
    expect((await schedule(p.id, resB)).status).toBe(403);
    const list = await api().get('/parcels').set(bearer(resB));
    expect(list.body.data.some((x: { id: string }) => x.id === p.id)).toBe(false);
  });

  it('rejects a slot the server did not offer', async () => {
    const p = await logParcel();
    const res = await api().post(`/parcels/${p.id}/schedule`).set(bearer(resA))
      .send({ mode: 'PICKUP', slotStart: '2026-01-01T03:17:00.000Z', slotEnd: '2026-01-01T05:17:00.000Z' });
    expect(res.body.error).toBe('INVALID_SLOT');
  });

  it('returns a parcel to the courier and kills its code', async () => {
    const p = await logParcel();
    const { code } = (await schedule(p.id)).body.data;
    expect((await api().post(`/parcels/${p.id}/return`).set(bearer(resA))).status).toBe(403);
    expect((await api().post(`/parcels/${p.id}/return`).set(bearer(guard))).body.data.status).toBe('RETURNED');
    expect((await api().post(`/parcels/${p.id}/handover`).set(bearer(guard)).send({ code })).body.error).toBe('RETURNED');
  });
});

describe('paging', () => {
  it('walks the whole list with nextCursor, newest first, no repeats', async () => {
    for (let i = 0; i < 5; i++) await logParcel({ courier: `Page ${i}` });
    const total = await prisma.parcel.count({ where: { societyId: s.society.id } });
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await api().get(`/parcels?limit=3${cursor ? `&cursor=${cursor}` : ''}`).set(bearer(guard));
      expect(res.status).toBe(200);
      seen.push(...res.body.data.map((p: { id: string }) => p.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
  });
});
