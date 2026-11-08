import crypto from 'crypto';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { setProviderForTests } from '../src/services/notify/notifier';
import { hashPassword } from '../src/utils/crypto';
import type { OutgoingMessage, Provider } from '../src/services/notify/providers';

export { app, prisma };
export const api = () => request(app);

/** Every message the app "sends" during a test, newest last */
export const outbox: OutgoingMessage[] = [];
const capture: Provider = {
  channel: 'console',
  async send(msg) {
    outbox.push(msg);
  },
};
setProviderForTests('console', capture);

let phoneSeq = 0;
/** A unique, valid Indian mobile number per call (90000 00000 range, never a real user) */
export function newPhone() {
  phoneSeq++;
  return `+9190${String(Date.now() % 1_000_000).padStart(6, '0')}${String(phoneSeq).padStart(2, '0')}`.slice(0, 13);
}

/** Every test user's password (already their own: no forced change) */
export const PASSWORD = 'Test-pass-2026';
let passwordHash: string | null = null;

/** A society with two flats, a guard, an admin and a resident in each flat */
export async function makeSociety() {
  passwordHash ??= await hashPassword(PASSWORD);
  const tag = crypto.randomBytes(3).toString('hex');
  const society = await prisma.society.create({ data: { name: `Test Society ${tag}` } });
  const flatA = await prisma.flat.create({ data: { societyId: society.id, tower: 'A', number: '101' } });
  const flatB = await prisma.flat.create({ data: { societyId: society.id, tower: 'B', number: '202' } });
  const mk = (name: string, role: 'GUARD' | 'ADMIN' | 'RESIDENT', flatId: string | null = null) =>
    prisma.user.create({
      data: { name, phone: newPhone(), role, societyId: society.id, flatId, passwordHash, mustChangePassword: false },
    });
  const guard = await mk('Test Guard', 'GUARD');
  const admin = await mk('Test Admin', 'ADMIN');
  const residentA = await mk('Resident A', 'RESIDENT', flatA.id);
  const residentB = await mk('Resident B', 'RESIDENT', flatB.id);
  return { society, flatA, flatB, guard, admin, residentA, residentB };
}

/** Sign in through the real password endpoint */
export async function login(phone: string, password = PASSWORD): Promise<{ token: string; refreshToken: string }> {
  const res = await api().post('/auth/login').send({ phone, password });
  if (res.status !== 200) throw new Error(`login ${res.status}: ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, refreshToken: res.body.data.refreshToken };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A real 1x1 PNG as a data URL */
export const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
