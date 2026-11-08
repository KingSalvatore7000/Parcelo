import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, bearer, login, makeSociety, prisma, PASSWORD, PNG } from './helpers';
import { config } from '../src/config/env';

let s: Awaited<ReturnType<typeof makeSociety>>;
let other: Awaited<ReturnType<typeof makeSociety>>;
let guard: string, admin: string, residentA: string, residentB: string, foreignAdmin: string, foreignGuard: string;

beforeAll(async () => {
  s = await makeSociety();
  other = await makeSociety();
  guard = (await login(s.guard.phone)).token;
  admin = (await login(s.admin.phone)).token;
  residentA = (await login(s.residentA.phone)).token;
  residentB = (await login(s.residentB.phone)).token;
  foreignAdmin = (await login(other.admin.phone)).token;
  foreignGuard = (await login(other.guard.phone)).token;
});

const logParcel = async () =>
  (await api().post('/parcels').set(bearer(guard)).send({ flatId: s.flatA.id, courier: 'Amazon' }).expect(201)).body.data;

describe('sign-in required', () => {
  it.each(['/auth/me', '/parcels', '/parcels/slots', '/flats', '/admin/stats', '/admin/users'])('%s refuses no token', async (path) => {
    await api().get(path).expect(401);
  });

  it('refuses a token signed with another key or algorithm', async () => {
    const forged = jwt.sign({ id: s.admin.id, sid: 'x' }, 'not-the-real-key');
    await api().get('/admin/stats').set(bearer(forged)).expect(401);
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: s.admin.id })).toString('base64url')}.`;
    await api().get('/admin/stats').set(bearer(none)).expect(401);
  });

  it('refuses a correctly signed token that belongs to no session', async () => {
    const stale = jwt.sign({ id: s.admin.id, sid: '00000000-0000-0000-0000-000000000000' }, config.jwtSecret);
    await api().get('/admin/stats').set(bearer(stale)).expect(401);
  });
});

describe('sessions end', () => {
  it('logout kills the access token at once, not after 15 minutes', async () => {
    const { token, refreshToken } = await login(s.residentB.phone);
    await api().get('/auth/me').set(bearer(token)).expect(200);
    await api().post('/auth/logout').send({ refreshToken }).expect(200);
    await api().get('/auth/me').set(bearer(token)).expect(401);
    await api().post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('a password change ends every other session immediately', async () => {
    const soc = await makeSociety();
    const a = await login(soc.residentA.phone);
    const b = await login(soc.residentA.phone);
    const res = await api().post('/auth/password').set(bearer(a.token))
      .send({ currentPassword: PASSWORD, newPassword: 'Another-pass-2026' }).expect(200);
    await api().get('/auth/me').set(bearer(a.token)).expect(401);
    await api().get('/auth/me').set(bearer(b.token)).expect(401);
    await api().post('/auth/refresh').send({ refreshToken: b.refreshToken }).expect(401);
    await api().get('/auth/me').set(bearer(res.body.data.token)).expect(200);
  });

  it('an admin password reset ends the person\'s sessions immediately', async () => {
    const soc = await makeSociety();
    const adminToken = (await login(soc.admin.phone)).token;
    const victim = await login(soc.residentA.phone);
    await api().post(`/admin/users/${soc.residentA.id}/reset-password`).set(bearer(adminToken)).expect(200);
    await api().get('/auth/me').set(bearer(victim.token)).expect(401);
  });

  it('keeps no personal data in the token', async () => {
    const payload = jwt.decode((await login(s.guard.phone)).token) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'id', 'sid']);
  });
});

describe('passwords', () => {
  it('stores bcrypt only', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: s.guard.id } });
    expect(u.passwordHash).toMatch(/^\$2[aby]\$\d\d\$/);
  });

  it('answers the same for an unknown number and a wrong password', async () => {
    const wrong = await api().post('/auth/login').send({ phone: s.guard.phone, password: 'wrong-password' }).expect(401);
    const unknown = await api().post('/auth/login').send({ phone: '+919111111111', password: 'wrong-password' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('refuses a password bcrypt would truncate', async () => {
    await api().post('/auth/password').set(bearer(residentA))
      .send({ currentPassword: PASSWORD, newPassword: `a1${'x'.repeat(80)}` }).expect(400);
  });
});

describe('rate limits', () => {
  it('locks a number with 429 after 10 wrong passwords', async () => {
    const soc = await makeSociety();
    for (let i = 0; i < 10; i++) await api().post('/auth/login').send({ phone: soc.guard.phone, password: 'nope-nope' }).expect(401);
    await api().post('/auth/login').send({ phone: soc.guard.phone, password: PASSWORD }).expect(429);
  });

  it('limits photo uploads per user', async () => {
    const soc = await makeSociety();
    const token = (await login(soc.guard.phone)).token;
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await api().post('/parcels/upload-photo').set(bearer(token)).send({ image: 'x' })).status;
    expect(last).toBe(429);
  }, 60_000);
});

describe('roles and ownership', () => {
  it.each([
    ['get', '/admin/stats'], ['get', '/admin/users'], ['get', '/admin/flats'], ['post', '/admin/flats'],
    ['post', '/admin/users'], ['post', '/admin/residents/import'],
  ] as const)('a resident and a guard get 403 on %s %s', async (method, path) => {
    await api()[method](path).set(bearer(residentA)).send({}).expect(403);
    await api()[method](path).set(bearer(guard)).send({}).expect(403);
  });

  it('a resident cannot do gate work, or list the society\'s flats', async () => {
    const p = await logParcel();
    await api().post('/parcels').set(bearer(residentA)).send({ flatId: s.flatA.id, courier: 'Amazon' }).expect(403);
    await api().post(`/parcels/${p.id}/handover`).set(bearer(residentA)).send({ code: '1234' }).expect(403);
    await api().post(`/parcels/${p.id}/return`).set(bearer(residentA)).expect(403);
    await api().post('/parcels/upload-photo').set(bearer(residentA)).send({ image: PNG }).expect(403);
    await api().get('/flats').set(bearer(residentA)).expect(403);
  });

  it('another flat\'s parcel is off limits', async () => {
    const p = await logParcel();
    await api().get(`/parcels/${p.id}`).set(bearer(residentB)).expect(403);
    const slots = (await api().get('/parcels/slots').set(bearer(residentB))).body.data.slots;
    await api().post(`/parcels/${p.id}/schedule`).set(bearer(residentB))
      .send({ mode: 'PICKUP', slotStart: slots[0].start, slotEnd: slots[0].end }).expect(403);
    const list = await api().get('/parcels').set(bearer(residentB)).expect(200);
    expect(list.body.data.some((x: { id: string }) => x.id === p.id)).toBe(false);
  });

  it('another society sees nothing, even with a real id', async () => {
    const p = await logParcel();
    await api().get(`/parcels/${p.id}`).set(bearer(foreignGuard)).expect(404);
    await api().post(`/parcels/${p.id}/return`).set(bearer(foreignGuard)).expect(404);
    await api().post(`/parcels/${p.id}/handover`).set(bearer(foreignGuard)).send({ code: '1234' }).expect(404);
    await api().get('/parcels').query({ societyId: s.society.id }).set(bearer(foreignGuard)).expect(403);
    await api().post('/parcels').set(bearer(foreignGuard)).send({ flatId: s.flatA.id, courier: 'Amazon' }).expect(404);
    await api().patch(`/admin/users/${s.residentA.id}`).set(bearer(foreignAdmin)).send({ name: 'Hacked' }).expect(404);
    await api().delete(`/admin/users/${s.residentA.id}`).set(bearer(foreignAdmin)).expect(404);
    await api().post(`/admin/users/${s.residentA.id}/reset-password`).set(bearer(foreignAdmin)).expect(404);
    await api().delete(`/admin/flats/${s.flatA.id}`).set(bearer(foreignAdmin)).expect(404);
  });
});

describe('price and input', () => {
  it('ignores a fee sent by the browser', async () => {
    const p = await logParcel();
    const slots = (await api().get('/parcels/slots').set(bearer(residentA))).body.data.slots;
    const res = await api().post(`/parcels/${p.id}/schedule`).set(bearer(residentA))
      .send({ mode: 'DOOR', slotStart: slots[0].start, slotEnd: slots[0].end, feePaise: 1, fee: 0 }).expect(200);
    expect(res.body.data.feePaise).toBe(config.doorDeliveryFeePaise);
  });

  it('refuses invented slots and bad input', async () => {
    const p = await logParcel();
    await api().post(`/parcels/${p.id}/schedule`).set(bearer(residentA))
      .send({ mode: 'PICKUP', slotStart: '2030-01-01T00:00:00.000Z', slotEnd: '2030-01-01T01:00:00.000Z' }).expect(400);
    await api().post(`/parcels/${p.id}/schedule`).set(bearer(residentA)).send({ mode: 'FREE' }).expect(400);
    await api().post('/parcels').set(bearer(guard)).send({ flatId: 'x', courier: 'A' }).expect(400);
    await api().post('/parcels').set(bearer(guard))
      .send({ flatId: s.flatA.id, courier: 'Amazon', photoUrl: 'https://evil.example/x.jpg' }).expect(400);
    await api().post('/auth/login').send({ phone: { $ne: 1 }, password: [] }).expect(400);
  });

  it('treats SQL in a search as plain text', async () => {
    const res = await api().get('/parcels').query({ search: "' OR 1=1; DROP TABLE users; --" }).set(bearer(guard)).expect(200);
    expect(res.body.data).toEqual([]);
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });

  it('an unknown role filter is ignored, not a crash', async () => {
    await api().get('/admin/users').query({ role: 'constructor' }).set(bearer(admin)).expect(200);
  });
});

describe('uploads', () => {
  const asDataUrl = (type: string, body: Buffer | string) => `data:image/${type};base64,${Buffer.from(body).toString('base64')}`;

  it.each([
    ['HTML dressed as a PNG', asDataUrl('png', '<script>alert(1)</script>')],
    ['SVG', asDataUrl('svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['not a data URL', 'https://evil.example/x.png'],
    ['too large', asDataUrl('png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(5 * 1024 * 1024 + 1)]))],
  ])('refuses %s', async (_name, image) => {
    await api().post('/parcels/upload-photo').set(bearer(guard)).send({ image }).expect(400);
  });

  it('does not read a large body from someone who is not signed in', async () => {
    await api().post('/parcels/upload-photo').send({ image: 'x'.repeat(1_000_000) }).expect(401);
  });

  it('serves a photo only with a valid signature', async () => {
    const up = await api().post('/parcels/upload-photo').set(bearer(guard)).send({ image: PNG }).expect(200);
    expect(up.body.photoUrl).toMatch(/^\/uploads\/parcels\/[a-f0-9]{32}\.png$/);
    const ok = await api().get(up.body.previewUrl).expect(200);
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    await api().get(up.body.photoUrl).expect(403);
    await api().get(up.body.previewUrl.replace(/sig=.{4}/, 'sig=AAAA')).expect(403);
    await api().get(`${up.body.photoUrl}?exp=9999999999&sig=${'é'.repeat(32)}`).expect(403);
    await api().get('/uploads/../src/app.ts?exp=9999999999&sig=x').expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
  });
});

describe('transport and headers', () => {
  it('sends the security headers and no framework banner', async () => {
    const res = await api().get('/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'".slice(0, 15));
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('CORS allows only configured origins', async () => {
    const good = await api().get('/health').set('Origin', 'http://localhost:5173');
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await api().get('/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never returns a code hash', async () => {
    const p = await logParcel();
    const slots = (await api().get('/parcels/slots').set(bearer(residentA))).body.data.slots;
    await api().post(`/parcels/${p.id}/schedule`).set(bearer(residentA)).send({ mode: 'PICKUP', slotStart: slots[0].start, slotEnd: slots[0].end }).expect(200);
    const res = await api().get(`/parcels/${p.id}`).set(bearer(guard)).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('otpHash');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});
