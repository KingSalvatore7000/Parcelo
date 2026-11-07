import { Prisma } from '@prisma/client';
import { ParcelStatus, UserRole, HandoverMode } from '@parcelo/shared';
import { prisma } from '../../lib/prisma';
import { config } from '../../config/env';
import { generate4DigitCode, hashCode, verifyCode } from '../../utils/crypto';
import { socketService } from '../../services/socket.service';
import { availableSlots, findSlot, CODE_GRACE_MS } from './slots';

const MAX_CODE_ATTEMPTS = 5;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

/** Statuses from which a resident may (re)book a slot */
const SCHEDULABLE: ParcelStatus[] = [ParcelStatus.LOGGED, ParcelStatus.SCHEDULED, ParcelStatus.UNCLAIMED];
/** Statuses from which the gate may send a parcel back to the courier */
const RETURNABLE: ParcelStatus[] = [ParcelStatus.LOGGED, ParcelStatus.SCHEDULED, ParcelStatus.UNCLAIMED];

/** Everything a client may see about a parcel. Never includes the code hash. */
const parcelView = {
  flat: true,
  loggedBy: { select: { id: true, name: true, role: true } },
  handover: {
    select: {
      id: true,
      parcelId: true,
      mode: true,
      slotStart: true,
      slotEnd: true,
      otpAttempts: true,
      otpExpiresAt: true,
      feePaise: true,
      completedAt: true,
      completedById: true,
      completedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ParcelInclude;

type AppError = { status: number; code: string; message: string };
const fail = (status: number, code: string, message: string): AppError => ({ status, code, message });

export function feeForMode(mode: HandoverMode): number {
  return mode === HandoverMode.DOOR ? config.doorDeliveryFeePaise : 0;
}

export class ParcelsService {
  private loadView(id: string) {
    return prisma.parcel.findUniqueOrThrow({ where: { id }, include: parcelView });
  }

  /**
   * Guard logs an incoming parcel
   */
  async logParcel(data: {
    societyId: string;
    flatId: string;
    courier: string;
    photoUrl?: string | null;
    guardId: string;
  }) {
    const flat = await prisma.flat.findFirst({
      where: { id: data.flatId, societyId: data.societyId },
      include: { users: { select: { id: true } } },
    });
    if (!flat) {
      throw fail(404, 'FLAT_NOT_FOUND', 'The selected flat was not found in your society.');
    }

    const parcel = await prisma.parcel.create({
      data: {
        societyId: data.societyId,
        flatId: data.flatId,
        courier: data.courier.trim(),
        photoUrl: data.photoUrl,
        status: ParcelStatus.LOGGED,
        loggedById: data.guardId,
      },
      include: parcelView,
    });

    // Queue one notification per resident of the flat. They stay PENDING until a
    // delivery channel (push / WhatsApp / SMS) actually sends them.
    if (flat.users.length > 0) {
      await prisma.notification.createMany({
        data: flat.users.map((u) => ({
          userId: u.id,
          parcelId: parcel.id,
          channel: 'PUSH' as const,
          status: 'PENDING' as const,
          metadata: `New ${parcel.courier} parcel received at society gate`,
        })),
      });
    }

    socketService.emitToGuards(data.societyId, 'parcel:logged', parcel);
    socketService.emitToFlat(data.societyId, data.flatId, 'parcel:new', parcel);

    return parcel;
  }

  /**
   * List parcels scoped by role and societyId, newest first, capped
   */
  async getParcels(params: {
    societyId: string;
    userRole: UserRole;
    userId: string;
    userFlatId?: string | null;
    status?: ParcelStatus;
    search?: string;
    limit?: number;
  }) {
    const where: Prisma.ParcelWhereInput = { societyId: params.societyId };

    if (params.userRole === UserRole.RESIDENT) {
      if (!params.userFlatId) {
        throw fail(400, 'NO_FLAT_ASSIGNED', 'No flat is associated with your resident profile.');
      }
      where.flatId = params.userFlatId;
    }

    if (params.status) {
      if (!Object.values(ParcelStatus).includes(params.status)) {
        throw fail(400, 'INVALID_STATUS', 'Unknown parcel status filter.');
      }
      where.status = params.status;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim().slice(0, 50);
      where.OR = [
        { courier: { contains: q, mode: 'insensitive' } },
        { flat: { number: { contains: q, mode: 'insensitive' } } },
        { flat: { tower: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const take = Math.min(Math.max(params.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

    return prisma.parcel.findMany({
      where,
      include: parcelView,
      orderBy: { loggedAt: 'desc' },
      take,
    });
  }

  /**
   * Get single parcel by ID
   */
  async getParcelById(id: string, societyId: string) {
    const parcel = await prisma.parcel.findFirst({ where: { id, societyId }, include: parcelView });
    if (!parcel) {
      throw fail(404, 'PARCEL_NOT_FOUND', 'Parcel not found.');
    }
    return parcel;
  }

  /**
   * Bookable handover slots and fees (paise)
   */
  getSlotOptions() {
    return {
      slots: availableSlots(),
      fees: {
        [HandoverMode.PICKUP]: feeForMode(HandoverMode.PICKUP),
        [HandoverMode.DOOR]: feeForMode(HandoverMode.DOOR),
      },
    };
  }

  /**
   * Resident schedules (or reschedules) a parcel for pickup or door delivery.
   * Each call issues a fresh 4-digit code and invalidates any earlier one.
   */
  async scheduleParcel(params: {
    parcelId: string;
    societyId: string;
    userId: string;
    userFlatId: string;
    mode: HandoverMode;
    slotStart: string;
    slotEnd: string;
  }) {
    const parcel = await prisma.parcel.findFirst({
      where: { id: params.parcelId, societyId: params.societyId },
      include: { flat: true },
    });

    if (!parcel) {
      throw fail(404, 'PARCEL_NOT_FOUND', 'Parcel not found.');
    }
    if (parcel.flatId !== params.userFlatId) {
      throw fail(403, 'FORBIDDEN', 'This parcel is not addressed to your flat.');
    }
    if (parcel.status === ParcelStatus.HANDED_OVER) {
      throw fail(400, 'ALREADY_HANDED_OVER', 'This parcel has already been handed over.');
    }
    if (parcel.status === ParcelStatus.RETURNED) {
      throw fail(400, 'RETURNED', 'This parcel was returned to the courier.');
    }

    const slot = findSlot(params.slotStart, params.slotEnd);
    if (!slot) {
      throw fail(400, 'INVALID_SLOT', 'That time slot is not available. Please pick one of the listed slots.');
    }

    const plainCode = generate4DigitCode();
    const otpHash = await hashCode(plainCode);
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    const otpExpiresAt = new Date(slotEnd.getTime() + CODE_GRACE_MS);
    const feePaise = feeForMode(params.mode);
    const rescheduled = parcel.status === ParcelStatus.SCHEDULED;

    await prisma.$transaction(async (tx) => {
      // Conditional on status, so a parcel handed over or returned meanwhile is not reopened
      const moved = await tx.parcel.updateMany({
        where: { id: parcel.id, status: { in: SCHEDULABLE } },
        data: { status: ParcelStatus.SCHEDULED },
      });
      if (moved.count === 0) {
        throw fail(409, 'STATUS_CHANGED', 'This parcel was just updated at the gate. Refresh and try again.');
      }
      const handoverData = {
        mode: params.mode,
        slotStart,
        slotEnd,
        feePaise,
        otpHash,
        otpAttempts: 0,
        otpExpiresAt,
        completedAt: null,
        completedById: null,
      };
      await tx.handover.upsert({
        where: { parcelId: parcel.id },
        create: { parcelId: parcel.id, ...handoverData },
        update: handoverData,
      });
    });

    const view = await this.loadView(parcel.id);
    socketService.emitToGuards(params.societyId, 'parcel:scheduled', view);
    socketService.emitToFlat(params.societyId, parcel.flatId, 'parcel:scheduled', view);

    // The plain code is returned once, here, and never stored
    return {
      parcelId: parcel.id,
      courier: parcel.courier,
      flat: `Tower ${parcel.flat.tower} - ${parcel.flat.number}`,
      mode: params.mode,
      slotStart: slot.start,
      slotEnd: slot.end,
      feePaise,
      code: plainCode,
      expiresAt: otpExpiresAt.toISOString(),
      rescheduled,
    };
  }

  /**
   * Guard completes handover with the resident's 4-digit code
   */
  async completeHandover(parcelId: string, societyId: string, guardId: string, code: string) {
    const parcel = await prisma.parcel.findFirst({
      where: { id: parcelId, societyId },
      include: { handover: true },
    });

    if (!parcel) {
      throw fail(404, 'PARCEL_NOT_FOUND', 'Parcel not found in your society.');
    }
    if (parcel.status === ParcelStatus.HANDED_OVER) {
      const when = parcel.handover?.completedAt
        ? new Date(parcel.handover.completedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'an earlier date';
      throw fail(400, 'ALREADY_HANDED_OVER', `This parcel has already been handed over on ${when}.`);
    }
    if (parcel.status === ParcelStatus.RETURNED) {
      throw fail(400, 'RETURNED', 'This parcel was returned to the courier.');
    }
    if (parcel.status !== ParcelStatus.SCHEDULED || !parcel.handover) {
      throw fail(400, 'NOT_SCHEDULED', 'The resident has not scheduled this parcel yet. Ask them to pick a slot in Parcelo to get a 4-digit code.');
    }

    const { handover } = parcel;

    if (new Date() > handover.otpExpiresAt) {
      throw fail(400, 'CODE_EXPIRED', 'This handover code has expired. The resident can reschedule in Parcelo to get a new code.');
    }

    // Reserve one attempt atomically before checking the code, so parallel guesses
    // cannot get past the limit
    const reserved = await prisma.handover.updateMany({
      where: { id: handover.id, otpAttempts: { lt: MAX_CODE_ATTEMPTS }, completedAt: null },
      data: { otpAttempts: { increment: 1 } },
    });
    if (reserved.count === 0) {
      throw fail(429, 'CODE_LOCKED', 'This code is locked after 5 wrong attempts. The resident can reschedule in Parcelo to get a new code.');
    }

    const isValid = await verifyCode(code.trim(), handover.otpHash);
    if (!isValid) {
      const remaining = Math.max(0, MAX_CODE_ATTEMPTS - (handover.otpAttempts + 1));
      throw fail(
        400,
        'INVALID_HANDOVER_CODE',
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left before it locks.`
          : 'Incorrect code. The code is now locked; the resident can reschedule to get a new one.'
      );
    }

    await prisma.$transaction(async (tx) => {
      // Only one guard can complete it, even if two submit the right code at once
      const done = await tx.parcel.updateMany({
        where: { id: parcel.id, status: ParcelStatus.SCHEDULED },
        data: { status: ParcelStatus.HANDED_OVER },
      });
      if (done.count === 0) {
        throw fail(409, 'STATUS_CHANGED', 'This parcel was just updated. Refresh to see its current status.');
      }
      await tx.handover.update({
        where: { id: handover.id },
        data: {
          completedAt: new Date(),
          completedById: guardId,
          otpAttempts: { decrement: 1 }, // the successful entry is not a failed attempt
        },
      });
    });

    const view = await this.loadView(parcel.id);
    socketService.emitToGuards(societyId, 'parcel:handed_over', view);
    socketService.emitToFlat(societyId, parcel.flatId, 'parcel:handed_over', view);
    return view;
  }

  /**
   * Gate sends an uncollected parcel back to the courier. Any open code stops working.
   */
  async returnParcel(parcelId: string, societyId: string) {
    const parcel = await prisma.parcel.findFirst({ where: { id: parcelId, societyId } });
    if (!parcel) {
      throw fail(404, 'PARCEL_NOT_FOUND', 'Parcel not found in your society.');
    }

    await prisma.$transaction(async (tx) => {
      const moved = await tx.parcel.updateMany({
        where: { id: parcel.id, status: { in: RETURNABLE } },
        data: { status: ParcelStatus.RETURNED },
      });
      if (moved.count === 0) {
        throw fail(400, 'CANNOT_RETURN', 'Only parcels still in the parcel room can be returned.');
      }
      await tx.handover.updateMany({
        where: { parcelId: parcel.id, completedAt: null },
        data: { otpExpiresAt: new Date() },
      });
    });

    const view = await this.loadView(parcel.id);
    socketService.emitToGuards(societyId, 'parcel:returned', view);
    socketService.emitToFlat(societyId, parcel.flatId, 'parcel:returned', view);
    return view;
  }
}

export const parcelsService = new ParcelsService();
