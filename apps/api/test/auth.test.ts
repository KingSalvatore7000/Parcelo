import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, prisma, makeSociety, login, bearer, newPhone, PASSWORD } from './helpers';
import { setTemporaryPassword } from '../src/modules/auth/auth.service';

let s: Awaited<ReturnType<typeof makeSociety>>;
beforeAll(async () => {
  s = await makeSociety();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('password sign-in', () => {
  it('signs in with the right password, accepting the number in any common format', async () => {
    const local = s.guard.phone.replace('+91', '');
    const res = await api().post('/auth/login').send({ phone: `${local.slice(0, 5)} ${local.slice(5)}`, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: s.guard.id, mustChangePassword: false });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('gives the same answer for a wrong password and an unknown number', async () => {
    const wrong = await api().post('/auth/login').send({ phone: s.residentA.phone, password: 'nope-nope-1' });
    const unknown = await api().post('/auth/login').send({ phone: newPhone(), password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('blocks a number after 10 wrong passwords, but successful sign-ins never count', async () => {
    const phone = s.residentB.phone;
    for (let i = 0; i < 12; i++) expect((await api().post('/auth/login').send({ phone, password: PASSWORD })).status).toBe(200);
    const wrong = [];
    for (let i = 0; i < 11; i++) wrong.push((await api().post('/auth/login').send({ phone, password: `wrong-${i}-x` })).status);
    expect(wrong.slice(0, 10).every((st) => st === 401)).toBe(true);
    expect(wrong[10]).toBe(429);
    // even the right password waits now
    expect((await api().post('/auth/login').send({ phone, password: PASSWORD })).status).toBe(429);
  });
});

describe('temporary passwords', () => {
  it('forces a new password before anything else, then ends old sessions', async () => {
    const user = await prisma.user.create({
      data: { name: 'New Resident', phone: newPhone(), role: 'RESIDENT', societyId: s.society.id, flatId: s.flatA.id },
    });
    const temp = await setTemporaryPassword(user.id);
    expect(temp).toMatch(/^[A-Za-z2-9]{10}$/);

    const first = await login(user.phone, temp);
    const me = await api().get('/auth/me').set(bearer(first.token));
    expect(me.body.data.mustChangePassword).toBe(true);
    // the rest of the API is closed until the password is changed
    expect((await api().get('/parcels').set(bearer(first.token))).body.error).toBe('PASSWORD_CHANGE_REQUIRED');

    const weak = await api().post('/auth/password').set(bearer(first.token)).send({ currentPassword: temp, newPassword: '12345678' });
    expect(weak.status).toBe(400);
    const phoneAsPassword = await api().post('/auth/password').set(bearer(first.token))
      .send({ currentPassword: temp, newPassword: `a${user.phone.slice(3)}` });
    expect(phoneAsPassword.body.error).toBe('WEAK_PASSWORD');

    const changed = await api().post('/auth/password').set(bearer(first.token)).send({ currentPassword: temp, newPassword: 'My-own-pass-9' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.mustChangePassword).toBe(false);
    expect((await api().get('/parcels').set(bearer(changed.body.data.token))).status).toBe(200);

    // the session that used the temporary password is gone; the temporary password no longer works
    expect((await api().post('/auth/refresh').send({ refreshToken: first.refreshToken })).status).toBe(401);
    expect((await api().post('/auth/login').send({ phone: user.phone, password: temp })).status).toBe(401);
    expect((await api().post('/auth/login').send({ phone: user.phone, password: 'My-own-pass-9' })).status).toBe(200);
  });

  it('refuses a wrong current password', async () => {
    const { token } = await login(s.admin.phone);
    const res = await api().post('/auth/password').set(bearer(token)).send({ currentPassword: 'not-it-123', newPassword: 'Another-pass-1' });
    expect(res.body.error).toBe('WRONG_PASSWORD');
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
    expect((await api().get('/auth/me').set(bearer(r1.body.data.token))).status).toBe(200);
  });

  it('ends every session when a used refresh token comes back', async () => {
    const first = await login(s.residentA.phone);
    const second = (await api().post('/auth/refresh').send({ refreshToken: first.refreshToken })).body.data;
    expect((await api().post('/auth/refresh').send({ refreshToken: first.refreshToken })).status).toBe(401);
    expect((await api().post('/auth/refresh').send({ refreshToken: second.refreshToken })).status).toBe(401);
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
