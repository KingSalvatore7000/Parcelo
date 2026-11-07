import { ParcelStatus, UserRole, HandoverMode } from '@parcelo/shared';
import { prisma } from '../../lib/prisma';
import { generate4DigitCode, hashCode, verifyCode } from '../../utils/crypto';
import { socketService } from '../../services/socket.service';

export class ParcelsService {
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
    // 1. Verify flat exists in guard's society
    const flat = await prisma.flat.findFirst({
      where: {
        id: data.flatId,
        societyId: data.societyId,
      },
    });

    if (!flat) {
      throw {
        status: 404,
        code: 'FLAT_NOT_FOUND',
        message: 'The selected flat was not found in your society.',
      };
    }

    // 2. Create Parcel in DB
    const parcel = await prisma.parcel.create({
      data: {
        societyId: data.societyId,
        flatId: data.flatId,
        courier: data.courier.trim(),
        photoUrl: data.photoUrl,
        status: ParcelStatus.LOGGED,
        loggedById: data.guardId,
      },
      include: {
        flat: true,
        loggedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        handover: true,
      },
    });

    // 3. Emit real-time WebSocket events
    // Notify all guards on duty
    socketService.emitToGuards(data.societyId, 'parcel:logged', parcel);
    // Notify residents of this flat
    socketService.emitToFlat(data.societyId, data.flatId, 'parcel:new', parcel);

    console.log(`📦 Parcel logged: [${parcel.courier}] for Flat Tower ${flat.tower}-${flat.number} by Guard ${parcel.loggedBy.name}`);

    // Audit notification entry in DB
    const flatResidents = await prisma.user.findMany({
      where: { flatId: data.flatId },
    });

    for (const resident of flatResidents) {
      await prisma.notification.create({
        data: {
          userId: resident.id,
          parcelId: parcel.id,
          channel: 'PUSH',
          status: 'SENT',
          sentAt: new Date(),
          metadata: `New ${parcel.courier} parcel received at society gate`,
        },
      });

      console.log(`🔔 [PUSH NOTIFICATION] To ${resident.name} (${resident.phone}): A new ${parcel.courier} parcel has arrived at the gate!`);
    }

    return parcel;
  }

  /**
   * List parcels scoped by role and societyId
   */
  async getParcels(params: {
    societyId: string;
    userRole: UserRole;
    userId: string;
    userFlatId?: string | null;
    status?: ParcelStatus;
    search?: string;
  }) {
    const whereClause: any = {
      societyId: params.societyId,
    };

    // Role-based access control
    if (params.userRole === UserRole.RESIDENT) {
      if (!params.userFlatId) {
        throw {
          status: 400,
          code: 'NO_FLAT_ASSIGNED',
          message: 'No flat is associated with your resident profile.',
        };
      }
      whereClause.flatId = params.userFlatId;
    }

    // Optional status filter
    if (params.status) {
      whereClause.status = params.status;
    }

    // Optional search by courier or flat number
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      whereClause.OR = [
        { courier: { contains: q, mode: 'insensitive' } },
        { flat: { number: { contains: q, mode: 'insensitive' } } },
        { flat: { tower: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const parcels = await prisma.parcel.findMany({
      where: whereClause,
      include: {
        flat: true,
        loggedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        handover: {
          select: {
            id: true,
            parcelId: true,
            mode: true,
            slotStart: true,
            slotEnd: true,
            otpAttempts: true,
            fee: true,
            completedAt: true,
            completedById: true,
            completedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });

    return parcels;
  }

  /**
   * Get single parcel by ID
   */
  async getParcelById(id: string, societyId: string) {
    const parcel = await prisma.parcel.findFirst({
      where: { id, societyId },
      include: {
        flat: true,
        loggedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        handover: {
          select: {
            id: true,
            parcelId: true,
            mode: true,
            slotStart: true,
            slotEnd: true,
            otpAttempts: true,
            fee: true,
            completedAt: true,
            completedById: true,
            completedBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!parcel) {
      throw {
        status: 404,
        code: 'PARCEL_NOT_FOUND',
        message: 'Parcel not found.',
      };
    }

    return parcel;
  }

  /**
   * Guard completes handover with 4-digit code
   */
  async completeHandover(parcelId: string, societyId: string, guardId: string, code: string) {
    const parcel = await prisma.parcel.findFirst({
      where: { id: parcelId, societyId },
      include: {
        flat: true,
        handover: true,
      },
    });

    if (!parcel) {
      throw {
        status: 404,
        code: 'PARCEL_NOT_FOUND',
        message: 'Parcel not found in your society.',
      };
    }

    if (parcel.status === ParcelStatus.HANDED_OVER) {
      throw {
        status: 400,
        code: 'ALREADY_HANDED_OVER',
        message: `This parcel has already been handed over on ${parcel.handover?.completedAt ? new Date(parcel.handover.completedAt).toLocaleString('en-IN') : 'an earlier date'}.`,
      };
    }

    if (!parcel.handover) {
      throw {
        status: 400,
        code: 'NOT_SCHEDULED',
        message: 'Resident has not scheduled this parcel yet. Ask resident to confirm mode (Pickup / Door Delivery) on their app to generate the 4-digit code.',
      };
    }

    const { handover } = parcel;

    // Check attempts lockout
    if (handover.otpAttempts >= 5) {
      throw {
        status: 429,
        code: 'CODE_LOCKED',
        message: 'This handover code has been locked due to 5 consecutive incorrect attempts. The resident must re-generate a code from their Parcelo app.',
      };
    }

    // Check expiry
    if (new Date() > handover.otpExpiresAt) {
      throw {
        status: 400,
        code: 'CODE_EXPIRED',
        message: 'The handover code has expired. The resident must confirm a new slot from their app.',
      };
    }

    // Verify 4-digit code against salted bcrypt hash
    const isValid = await verifyCode(code.trim(), handover.otpHash);

    if (!isValid) {
      const updatedAttempts = handover.otpAttempts + 1;
      await prisma.handover.update({
        where: { id: handover.id },
        data: { otpAttempts: updatedAttempts },
      });

      const remaining = 5 - updatedAttempts;
      throw {
        status: 400,
        code: 'INVALID_HANDOVER_CODE',
        message: `Incorrect 4-digit handover code. ${remaining > 0 ? `${remaining} attempts remaining before lockout.` : 'Code is now locked. Resident must generate a new code.'}`,
      };
    }

    // Code is valid! Mark parcel as HANDED_OVER
    const now = new Date();

    const [updatedParcel] = await prisma.$transaction([
      prisma.parcel.update({
        where: { id: parcel.id },
        data: {
          status: ParcelStatus.HANDED_OVER,
        },
        include: {
          flat: true,
          loggedBy: {
            select: { id: true, name: true },
          },
          handover: {
            include: {
              completedBy: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.handover.update({
        where: { id: handover.id },
        data: {
          completedAt: now,
          completedById: guardId,
        },
      }),
    ]);

    // Fetch guard's name for complete record
    const guardUser = await prisma.user.findUnique({
      where: { id: guardId },
      select: { id: true, name: true },
    });

    const handoverRecord = {
      ...updatedParcel,
      status: ParcelStatus.HANDED_OVER,
      handover: {
        ...updatedParcel.handover,
        completedAt: now,
        completedById: guardId,
        completedBy: guardUser,
      },
    };

    // Broadcast real-time handover events
    socketService.emitToGuards(societyId, 'parcel:handed_over', handoverRecord);
    socketService.emitToFlat(societyId, parcel.flatId, 'parcel:handed_over', handoverRecord);

    console.log(`🤝 Handover COMPLETED: Parcel [${parcel.courier}] for Flat Tower ${parcel.flat.tower}-${parcel.flat.number} handed over by Guard ${guardUser?.name || guardId}`);

    return handoverRecord;
  }

  /**
   * Resident schedules a parcel for pickup or door delivery.
   * Generates a 4-digit code, hashes and stores it, returns plaintext once.
   */
  async scheduleParcel(params: {
    parcelId: string;
    societyId: string;
    userId: string;
    userFlatId: string;
    mode: HandoverMode;
    slotStart: string; // ISO date string
    slotEnd: string;   // ISO date string
  }) {
    // 1. Fetch parcel and verify ownership
    const parcel = await prisma.parcel.findFirst({
      where: { id: params.parcelId, societyId: params.societyId },
      include: { flat: true },
    });

    if (!parcel) {
      throw { status: 404, code: 'PARCEL_NOT_FOUND', message: 'Parcel not found.' };
    }

    if (parcel.flatId !== params.userFlatId) {
      throw { status: 403, code: 'FORBIDDEN', message: 'This parcel is not addressed to your flat.' };
    }

    if (parcel.status === ParcelStatus.HANDED_OVER) {
      throw { status: 400, code: 'ALREADY_HANDED_OVER', message: 'This parcel has already been handed over.' };
    }

    if (parcel.status === ParcelStatus.SCHEDULED) {
      throw { status: 400, code: 'ALREADY_SCHEDULED', message: 'This parcel already has a scheduled slot. Cancel first or wait for the current code to expire.' };
    }

    // 2. Generate 4-digit plaintext code
    const plainCode = generate4DigitCode();
    const otpHash = await hashCode(plainCode);
    const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // 3. Calculate fee: DOOR = ₹20, PICKUP = free
    const fee = params.mode === HandoverMode.DOOR ? 20 : 0;

    // 4. Upsert handover record and update parcel status (transaction)
    const [updatedParcel] = await prisma.$transaction([
      prisma.parcel.update({
        where: { id: parcel.id },
        data: { status: ParcelStatus.SCHEDULED },
        include: {
          flat: true,
          loggedBy: { select: { id: true, name: true, role: true } },
          handover: true,
        },
      }),
      prisma.handover.upsert({
        where: { parcelId: parcel.id },
        create: {
          parcelId: parcel.id,
          mode: params.mode,
          slotStart: new Date(params.slotStart),
          slotEnd: new Date(params.slotEnd),
          fee,
          otpHash,
          otpAttempts: 0,
          otpExpiresAt,
        },
        update: {
          mode: params.mode,
          slotStart: new Date(params.slotStart),
          slotEnd: new Date(params.slotEnd),
          fee,
          otpHash,
          otpAttempts: 0,
          otpExpiresAt,
          completedAt: null,
          completedById: null,
        },
      }),
    ]);

    // 5. Emit socket events to guards and this flat
    const eventPayload = { ...updatedParcel, handover: { ...updatedParcel.handover, mode: params.mode } };
    socketService.emitToGuards(params.societyId, 'parcel:scheduled', eventPayload);
    socketService.emitToFlat(params.societyId, parcel.flatId, 'parcel:scheduled', eventPayload);

    console.log(`📅 Parcel scheduled: [${parcel.courier}] → Flat ${parcel.flat.tower}-${parcel.flat.number} | Mode: ${params.mode} | Slot: ${params.slotStart} | Fee: ₹${fee}`);

    // 6. Return stamp DTO — plain code returned ONCE here
    return {
      parcelId: parcel.id,
      courier: parcel.courier,
      flat: `Tower ${parcel.flat.tower} - ${parcel.flat.number}`,
      mode: params.mode,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      fee,
      code: plainCode,           // ← 4-digit code, plaintext, returned ONCE
      expiresAt: otpExpiresAt.toISOString(),
    };
  }
}

export const parcelsService = new ParcelsService();
