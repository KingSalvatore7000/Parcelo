import { Prisma } from '@prisma/client';
import { ParcelStatus, UserRole, phoneRegex } from '@parcelo/shared';
import { prisma } from '../../lib/prisma';
import { normalizePhone } from '../auth/auth.service';

type AppError = { status: number; code: string; message: string; details?: unknown };
const fail = (status: number, code: string, message: string, details?: unknown): AppError => ({
  status,
  code,
  message,
  ...(details === undefined ? {} : { details }),
});

const IN_ROOM: ParcelStatus[] = [ParcelStatus.LOGGED, ParcelStatus.SCHEDULED, ParcelStatus.UNCLAIMED];
const OVERDUE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MAX_IMPORT_ROWS = 1000;

/** Start of the current IST day / month, as UTC Dates */
function istStartOf(unit: 'day' | 'month', now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = unit === 'day' ? ist.getUTCDate() : 1;
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}

const flatLabel = (f: { tower: string; number: string }) => `Tower ${f.tower} - ${f.number}`;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Minimal CSV parser: commas, double-quoted fields, "" escapes, CRLF or LF */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

export class AdminService {
  // ─── Overview ──────────────────────────────────────────────────────────────
  async getStats(societyId: string) {
    const now = new Date();
    const overdueBefore = new Date(now.getTime() - OVERDUE_AFTER_MS);
    const today = istStartOf('day', now);
    const month = istStartOf('month', now);

    const [byStatus, overdueCount, overdue, handedOverToday, loggedToday, doorFees, flats, residents, guards, admins] =
      await Promise.all([
        prisma.parcel.groupBy({ by: ['status'], where: { societyId }, _count: { _all: true } }),
        prisma.parcel.count({ where: { societyId, status: { in: IN_ROOM }, loggedAt: { lt: overdueBefore } } }),
        prisma.parcel.findMany({
          where: { societyId, status: { in: IN_ROOM }, loggedAt: { lt: overdueBefore } },
          include: { flat: true, handover: { select: { mode: true, slotStart: true, slotEnd: true } } },
          orderBy: { loggedAt: 'asc' },
          take: 50,
        }),
        prisma.handover.count({ where: { completedAt: { gte: today }, parcel: { societyId } } }),
        prisma.parcel.count({ where: { societyId, loggedAt: { gte: today } } }),
        prisma.handover.aggregate({
          where: { mode: 'DOOR', completedAt: { gte: month }, parcel: { societyId } },
          _sum: { feePaise: true },
          _count: { _all: true },
        }),
        prisma.flat.count({ where: { societyId } }),
        prisma.user.count({ where: { societyId, role: UserRole.RESIDENT } }),
        prisma.user.count({ where: { societyId, role: UserRole.GUARD } }),
        prisma.user.count({ where: { societyId, role: UserRole.ADMIN } }),
      ]);

    const statusCounts = Object.fromEntries(Object.values(ParcelStatus).map((s) => [s, 0])) as Record<ParcelStatus, number>;
    for (const row of byStatus) statusCounts[row.status as ParcelStatus] = row._count._all;

    return {
      parcels: {
        byStatus: statusCounts,
        inRoom: IN_ROOM.reduce((n, s) => n + statusCounts[s], 0),
        overdue: overdueCount,
        loggedToday,
        handedOverToday,
      },
      doorDeliveriesThisMonth: { count: doorFees._count._all, feesPaise: doorFees._sum.feePaise ?? 0 },
      people: { flats, residents, guards, admins },
      overdueParcels: overdue.map((p) => ({
        id: p.id,
        courier: p.courier,
        status: p.status,
        loggedAt: p.loggedAt,
        daysInRoom: Math.floor((now.getTime() - p.loggedAt.getTime()) / 86_400_000),
        flat: { id: p.flat.id, label: flatLabel(p.flat) },
        handover: p.handover,
      })),
    };
  }

  // ─── Flats ─────────────────────────────────────────────────────────────────
  async listFlats(societyId: string) {
    const flats = await prisma.flat.findMany({
      where: { societyId },
      orderBy: [{ tower: 'asc' }, { number: 'asc' }],
      include: {
        users: { select: { id: true, name: true, phone: true }, where: { role: UserRole.RESIDENT }, orderBy: { name: 'asc' } },
        _count: { select: { parcels: { where: { status: { in: IN_ROOM } } } } },
      },
    });
    return flats.map((f) => ({
      id: f.id,
      tower: f.tower,
      number: f.number,
      label: flatLabel(f),
      residents: f.users,
      parcelsInRoom: f._count.parcels,
    }));
  }

  async createFlat(societyId: string, data: { tower: string; number: string }) {
    try {
      const f = await prisma.flat.create({ data: { societyId, tower: data.tower, number: data.number } });
      return { id: f.id, tower: f.tower, number: f.number, label: flatLabel(f) };
    } catch (err) {
      if (isUniqueViolation(err)) throw fail(409, 'FLAT_EXISTS', `${flatLabel(data)} already exists.`);
      throw err;
    }
  }

  async updateFlat(societyId: string, id: string, data: { tower?: string; number?: string }) {
    await this.requireFlat(societyId, id);
    try {
      const f = await prisma.flat.update({ where: { id }, data });
      return { id: f.id, tower: f.tower, number: f.number, label: flatLabel(f) };
    } catch (err) {
      if (isUniqueViolation(err)) throw fail(409, 'FLAT_EXISTS', 'Another flat already has that tower and number.');
      throw err;
    }
  }

  async deleteFlat(societyId: string, id: string) {
    await this.requireFlat(societyId, id);
    const [users, parcels] = await Promise.all([
      prisma.user.count({ where: { flatId: id } }),
      prisma.parcel.count({ where: { flatId: id } }),
    ]);
    if (users > 0 || parcels > 0) {
      throw fail(
        409,
        'FLAT_IN_USE',
        `This flat still has ${users} resident${users === 1 ? '' : 's'} and ${parcels} parcel record${parcels === 1 ? '' : 's'}. Move or remove the residents first; flats with parcel history are kept.`
      );
    }
    await prisma.flat.delete({ where: { id } });
  }

  private async requireFlat(societyId: string, id: string) {
    const flat = await prisma.flat.findFirst({ where: { id, societyId } });
    if (!flat) throw fail(404, 'FLAT_NOT_FOUND', 'Flat not found in your society.');
    return flat;
  }

  // ─── People ────────────────────────────────────────────────────────────────
  async listUsers(societyId: string, role?: UserRole) {
    const users = await prisma.user.findMany({
      where: { societyId, ...(role ? { role } : {}) },
      include: { flat: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      flatId: u.flatId,
      flatLabel: u.flat ? flatLabel(u.flat) : null,
      createdAt: u.createdAt,
    }));
  }

  async createUser(societyId: string, data: { name: string; phone: string; role: UserRole; flatId?: string | null }) {
    const flatId = data.flatId ?? null;
    if (flatId) await this.requireFlat(societyId, flatId);
    try {
      const u = await prisma.user.create({
        data: { societyId, name: data.name, phone: normalizePhone(data.phone), role: data.role, flatId },
      });
      return { id: u.id, name: u.name, phone: u.phone, role: u.role, flatId: u.flatId };
    } catch (err) {
      if (isUniqueViolation(err)) throw fail(409, 'PHONE_TAKEN', 'Someone is already registered with this phone number.');
      throw err;
    }
  }

  async updateUser(
    societyId: string,
    actorId: string,
    id: string,
    data: { name?: string; role?: UserRole; flatId?: string | null }
  ) {
    const user = await prisma.user.findFirst({ where: { id, societyId } });
    if (!user) throw fail(404, 'USER_NOT_FOUND', 'Person not found in your society.');

    const nextRole = data.role ?? (user.role as UserRole);
    const nextFlat = data.flatId === undefined ? user.flatId : data.flatId;

    if (id === actorId && nextRole !== user.role) {
      throw fail(400, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role. Ask another admin.');
    }
    if (user.role === UserRole.ADMIN && nextRole !== UserRole.ADMIN) {
      await this.requireAnotherAdmin(societyId, id);
    }
    if (nextRole === UserRole.RESIDENT && !nextFlat) {
      throw fail(400, 'FLAT_REQUIRED', 'A resident must be linked to a flat.');
    }
    if (nextFlat) await this.requireFlat(societyId, nextFlat);

    const u = await prisma.user.update({
      where: { id },
      data: { name: data.name, role: nextRole, flatId: nextFlat },
    });
    return { id: u.id, name: u.name, phone: u.phone, role: u.role, flatId: u.flatId };
  }

  async deleteUser(societyId: string, actorId: string, id: string) {
    if (id === actorId) throw fail(400, 'CANNOT_DELETE_SELF', 'You cannot remove your own account.');
    const user = await prisma.user.findFirst({
      where: { id, societyId },
      include: { _count: { select: { loggedParcels: true } } },
    });
    if (!user) throw fail(404, 'USER_NOT_FOUND', 'Person not found in your society.');
    if (user.role === UserRole.ADMIN) await this.requireAnotherAdmin(societyId, id);
    if (user._count.loggedParcels > 0) {
      throw fail(
        409,
        'HAS_HISTORY',
        `${user.name} logged ${user._count.loggedParcels} parcel(s), so their record is kept for the audit trail.`
      );
    }
    // Their sign-in stops working immediately: every request reloads the user
    await prisma.user.delete({ where: { id } });
  }

  private async requireAnotherAdmin(societyId: string, exceptId: string) {
    const others = await prisma.user.count({ where: { societyId, role: UserRole.ADMIN, id: { not: exceptId } } });
    if (others === 0) throw fail(400, 'LAST_ADMIN', 'The society must keep at least one admin.');
  }

  // ─── CSV import ────────────────────────────────────────────────────────────
  /**
   * Import residents from CSV rows of name,phone,tower,flat. All rows must be valid
   * or nothing is saved; the response lists every problem by line number.
   */
  async importResidents(societyId: string, opts: { csv: string; createMissingFlats: boolean; dryRun: boolean }) {
    let rows = parseCsv(opts.csv).map((cells, i) => ({ line: i + 1, cells }));
    if (rows.length > 0 && /^name$/i.test(rows[0].cells[0] ?? '') && /phone/i.test(rows[0].cells[1] ?? '')) {
      rows = rows.slice(1); // header row
    }
    if (rows.length === 0) throw fail(400, 'EMPTY_IMPORT', 'No rows found. Use: name,phone,tower,flat');
    if (rows.length > MAX_IMPORT_ROWS) throw fail(400, 'TOO_MANY_ROWS', `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

    const flats = await prisma.flat.findMany({ where: { societyId } });
    const flatKey = (tower: string, number: string) => `${tower.toUpperCase()}|${number.toUpperCase()}`;
    const flatByKey = new Map(flats.map((f) => [flatKey(f.tower, f.number), f]));

    const errors: { line: number; message: string }[] = [];
    const valid: { line: number; name: string; phone: string; tower: string; number: string }[] = [];
    const seenPhones = new Map<string, number>();

    for (const { line, cells } of rows) {
      const [name = '', rawPhone = '', rawTower = '', number = ''] = cells;
      const tower = rawTower.replace(/^tower\s+/i, '').toUpperCase();
      const problems: string[] = [];
      if (cells.length < 4) problems.push('needs 4 columns: name,phone,tower,flat');
      if (name.length < 2 || name.length > 80) problems.push('name must be 2–80 characters');
      const compact = rawPhone.replace(/[\s-]+/g, '');
      if (!phoneRegex.test(compact)) problems.push(`"${rawPhone}" is not a valid Indian mobile number`);
      if (!tower || !number || tower.length > 20 || number.length > 20) problems.push('tower and flat number are required');

      if (problems.length === 0) {
        const phone = normalizePhone(compact);
        const firstLine = seenPhones.get(phone);
        if (firstLine) problems.push(`phone repeats line ${firstLine}`);
        else seenPhones.set(phone, line);
        if (!opts.createMissingFlats && !flatByKey.has(flatKey(tower, number))) {
          problems.push(`flat ${flatLabel({ tower, number })} does not exist`);
        }
        if (problems.length === 0) valid.push({ line, name, phone, tower, number });
      }
      if (problems.length > 0) errors.push({ line, message: problems.join('; ') });
    }

    // Phones already registered (in any society; phone numbers are globally unique)
    const existing = await prisma.user.findMany({
      where: { phone: { in: valid.map((v) => v.phone) } },
      select: { phone: true },
    });
    const taken = new Set(existing.map((u) => u.phone));
    for (const v of valid) {
      if (taken.has(v.phone)) errors.push({ line: v.line, message: `${v.phone} is already registered` });
    }
    errors.sort((a, b) => a.line - b.line);

    const newFlats = [...new Set(valid.map((v) => flatKey(v.tower, v.number)))].filter((k) => !flatByKey.has(k));
    const summary = { rows: rows.length, residents: valid.length, newFlats: newFlats.length };

    if (errors.length > 0) {
      throw fail(400, 'IMPORT_INVALID', `${errors.length} row(s) need fixing. Nothing was imported.`, { errors, summary });
    }
    if (opts.dryRun) return { dryRun: true, ...summary };

    await prisma.$transaction(async (tx) => {
      for (const key of newFlats) {
        const [tower, number] = key.split('|');
        const f = await tx.flat.create({ data: { societyId, tower, number } });
        flatByKey.set(key, f);
      }
      await tx.user.createMany({
        data: valid.map((v) => ({
          societyId,
          name: v.name,
          phone: v.phone,
          role: UserRole.RESIDENT,
          flatId: flatByKey.get(flatKey(v.tower, v.number))!.id,
        })),
      });
    });

    return { dryRun: false, ...summary };
  }
}

export const adminService = new AdminService();
