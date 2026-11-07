import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, prisma, makeSociety, login, outbox, bearer, newPhone } from './helpers';

let s: Awaited<ReturnType<typeof makeSociety>>;
beforeAll(async () => {
  s = await makeSociety();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('OTP sign-in', () => {
  it('answers the same for an unknown number and sends nothing', async () => {
    const before = outbox.length;
    const unknown = newPhone();
    const res = await api().post('/auth/otp/request').send({ phone: unknown });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toBeUndefined();
    expect(outbox.length).toBe(before);

    const known = await api().post('/auth/otp/request').send({ phone: s.residentA.phone });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe(res.body.message);
  });

  it('sends a random 6-digit code through the provider, never in the response', async () => {
    const res = await api().post('/auth/otp/request').send({ phone: s.guard.phone });
    expect(res.body.devOtp).toBeUndefined();
    const msg = outbox[outbox.length - 1];
    expect(msg.to).toBe(s.guard.phone);
    expect(msg.params[0]).toMatch(/^\d{6}$/);
    expect(msg.text).toContain(msg.params[0]);
  });

  it('locks the code after 5 wrong tries, even with the right one', async () => {
    const phone = s.residentB.phone;
    await api().post('/auth/otp/request').send({ phone });
    const code = outbox[outbox.length - 1].params[0];
    const wrong = code === '000000' ? '111111' : '000000';
    const results = await Promise.all(Array.from({ length: 8 }, () => api().post('/auth/otp/verify').send({ phone, otp: wrong })));
    expect(results.filter((r) => r.body.error === 'INVALID_OTP').length).toBe(5);
    const right = await api().post('/auth/otp/verify').send({ phone, otp: code });
    expect(right.status).not.toBe(200);
  });
});

describe('sessions', () => {
  it('issues a short access token and a refresh token', async () => {
    const { token, refreshToken } = await login(s.admin.phone);
    const payload = jwt.decode(token) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBe(15 * 60);
    expect(refreshToken.length).toBeGreaterThan(30);
    const me = await api().get('/auth/me').set(bearer(token));
    expect(me.body.data.id).toBe(s.admin.id);
  });

  it('rotates the refresh token on use', async () => {
    const first = await login(s.admin.phone);
    const r1 = await api().post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(first.refreshToken);
    const me = await api().get('/auth/me').set(bearer(r1.body.data.token));
    expect(me.status).toBe(200);
  });

  it('ends every session when a used refresh token comes back', async () => {
    const first = await login(s.residentA.phone);
    const second = (await api().post('/auth/refresh').send({ refreshToken: first.refreshToken })).body.data;
    // the old token again: looks stolen
    const replay = await api().post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    // the legitimate newer token is now revoked too
    const after = await api().post('/auth/refresh').send({ refreshToken: second.refreshToken });
    expect(after.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { refreshToken } = await login(s.residentA.phone);
    expect((await api().post('/auth/logout').send({ refreshToken })).status).toBe(200);
    expect((await api().post('/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('two refreshes with one token cannot both succeed', async () => {
    const { refreshToken } = await login(s.guard.phone);
    const both = await Promise.all([1, 2].map(() => api().post('/auth/refresh').send({ refreshToken })));
    expect(both.filter((r) => r.status === 200).length).toBe(1);
  });
});
