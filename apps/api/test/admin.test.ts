import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, prisma, makeSociety, login, bearer } from './helpers';

let s: Awaited<ReturnType<typeof makeSociety>>;
let admin: string, guard: string;

beforeAll(async () => {
  s = await makeSociety();
  admin = (await login(s.admin.phone)).token;
  guard = (await login(s.guard.phone)).token;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('admin', () => {
  it('is for admins only', async () => {
    expect((await api().get('/admin/stats').set(bearer(guard))).status).toBe(403);
    expect((await api().get('/admin/stats')).status).toBe(401);
  });

  it('reports stats for its own society', async () => {
    const res = await api().get('/admin/stats').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.people).toMatchObject({ flats: 2, residents: 2, guards: 1, admins: 1 });
  });

  it('keeps an admin from removing or demoting themselves', async () => {
    expect((await api().delete(`/admin/users/${s.admin.id}`).set(bearer(admin))).body.error).toBe('CANNOT_DELETE_SELF');
    expect((await api().patch(`/admin/users/${s.admin.id}`).set(bearer(admin)).send({ role: 'GUARD' })).body.error).toBe('CANNOT_CHANGE_OWN_ROLE');
  });

  it('gives a new person a temporary password, shown once, that must be changed', async () => {
    const res = await api().post('/admin/users').set(bearer(admin)).send({ name: 'Kiran Test', phone: '9123400010', role: 'GUARD' });
    expect(res.status).toBe(201);
    const temp = res.body.data.temporaryPassword;
    expect(temp).toMatch(/^[A-Za-z2-9]{10}$/);
    const signIn = await api().post('/auth/login').send({ phone: '9123400010', password: temp });
    expect(signIn.body.data.user.mustChangePassword).toBe(true);
    // never shown again: the list has no passwords
    const list = await api().get('/admin/users').set(bearer(admin));
    expect(JSON.stringify(list.body)).not.toContain(temp);
  });

  it('resets a forgotten password and signs the person out', async () => {
    const before = await login(s.residentA.phone);
    const res = await api().post(`/admin/users/${s.residentA.id}/reset-password`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect((await api().post('/auth/refresh').send({ refreshToken: before.refreshToken })).status).toBe(401);
    expect((await api().post('/auth/login').send({ phone: s.residentA.phone, password: res.body.data.temporaryPassword })).status).toBe(200);
    // an admin changes their own password themselves
    expect((await api().post(`/admin/users/${s.admin.id}/reset-password`).set(bearer(admin))).body.error).toBe('USE_CHANGE_PASSWORD');
    // a guard cannot reset anyone
    expect((await api().post(`/admin/users/${s.residentB.id}/reset-password`).set(bearer(guard))).status).toBe(403);
  });

  it('imports residents all-or-nothing, with a dry run first', async () => {
    const bad = 'name,phone,tower,flat\nGood Row,9123400001,C,301\nBad Phone,12345,C,302\n';
    const r1 = await api().post('/admin/residents/import').set(bearer(admin)).send({ csv: bad });
    expect(r1.status).toBe(400);
    expect(r1.body.details.errors.map((e: { line: number }) => e.line)).toEqual([3]);
    expect(await prisma.user.count({ where: { phone: '+919123400001' } })).toBe(0);

    const good = 'name,phone,tower,flat\n"Rao, Meera",9123400001,C,301\nVikram Iyer,+91 91234 00002,Tower C,302\n';
    const dry = await api().post('/admin/residents/import').set(bearer(admin)).send({ csv: good, dryRun: true });
    expect(dry.body.data).toMatchObject({ dryRun: true, residents: 2, newFlats: 2 });
    expect(await prisma.user.count({ where: { phone: '+919123400001' } })).toBe(0);

    const real = await api().post('/admin/residents/import').set(bearer(admin)).send({ csv: good });
    expect(real.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { phone: '+919123400001' } }))?.name).toBe('Rao, Meera');

    // each imported resident gets a working temporary password, returned once
    const creds = real.body.data.credentials as { phone: string; temporaryPassword: string; flat: string }[];
    expect(creds).toHaveLength(2);
    expect(creds[0].flat).toBe('Tower C - 301');
    const signIn = await api().post('/auth/login').send({ phone: creds[1].phone, password: creds[1].temporaryPassword });
    expect(signIn.body.data.user.mustChangePassword).toBe(true);
  });
});
