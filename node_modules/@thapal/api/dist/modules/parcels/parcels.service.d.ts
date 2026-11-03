import { ParcelStatus, UserRole, HandoverMode } from '@thapal/shared';
export declare class ParcelsService {
    /**
     * Guard logs an incoming parcel
     */
    logParcel(data: {
        societyId: string;
        flatId: string;
        courier: string;
        photoUrl?: string | null;
        guardId: string;
    }): Promise<{
        flat: {
            number: string;
            societyId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tower: string;
        };
        handover: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            otpHash: string;
            parcelId: string;
            mode: import(".prisma/client").$Enums.HandoverMode;
            slotStart: Date;
            slotEnd: Date;
            otpExpiresAt: Date;
            otpAttempts: number;
            fee: number;
            completedAt: Date | null;
            completedById: string | null;
        } | null;
        loggedBy: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        societyId: string;
        id: string;
        flatId: string;
        updatedAt: Date;
        courier: string;
        photoUrl: string | null;
        status: import(".prisma/client").$Enums.ParcelStatus;
        loggedAt: Date;
        loggedById: string;
    }>;
    /**
     * List parcels scoped by role and societyId
     */
    getParcels(params: {
        societyId: string;
        userRole: UserRole;
        userId: string;
        userFlatId?: string | null;
        status?: ParcelStatus;
        search?: string;
    }): Promise<({
        flat: {
            number: string;
            societyId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tower: string;
        };
        handover: {
            id: string;
            parcelId: string;
            mode: import(".prisma/client").$Enums.HandoverMode;
            slotStart: Date;
            slotEnd: Date;
            otpAttempts: number;
            fee: number;
            completedAt: Date | null;
            completedById: string | null;
            completedBy: {
                id: string;
                name: string;
            } | null;
        } | null;
        loggedBy: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        societyId: string;
        id: string;
        flatId: string;
        updatedAt: Date;
        courier: string;
        photoUrl: string | null;
        status: import(".prisma/client").$Enums.ParcelStatus;
        loggedAt: Date;
        loggedById: string;
    })[]>;
    /**
     * Get single parcel by ID
     */
    getParcelById(id: string, societyId: string): Promise<{
        flat: {
            number: string;
            societyId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tower: string;
        };
        handover: {
            id: string;
            parcelId: string;
            mode: import(".prisma/client").$Enums.HandoverMode;
            slotStart: Date;
            slotEnd: Date;
            otpAttempts: number;
            fee: number;
            completedAt: Date | null;
            completedById: string | null;
            completedBy: {
                id: string;
                name: string;
            } | null;
        } | null;
        loggedBy: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        societyId: string;
        id: string;
        flatId: string;
        updatedAt: Date;
        courier: string;
        photoUrl: string | null;
        status: import(".prisma/client").$Enums.ParcelStatus;
        loggedAt: Date;
        loggedById: string;
    }>;
    /**
     * Guard completes handover with 4-digit code
     */
    completeHandover(parcelId: string, societyId: string, guardId: string, code: string): Promise<{
        status: ParcelStatus;
        handover: {
            completedAt: Date;
            completedById: string;
            completedBy: {
                id: string;
                name: string;
            } | null;
            id?: string | undefined;
            createdAt?: Date | undefined;
            updatedAt?: Date | undefined;
            otpHash?: string | undefined;
            parcelId?: string | undefined;
            mode?: import(".prisma/client").$Enums.HandoverMode | undefined;
            slotStart?: Date | undefined;
            slotEnd?: Date | undefined;
            otpExpiresAt?: Date | undefined;
            otpAttempts?: number | undefined;
            fee?: number | undefined;
        };
        flat: {
            number: string;
            societyId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tower: string;
        };
        loggedBy: {
            id: string;
            name: string;
        };
        societyId: string;
        id: string;
        flatId: string;
        updatedAt: Date;
        courier: string;
        photoUrl: string | null;
        loggedAt: Date;
        loggedById: string;
    }>;
    /**
     * Resident schedules a parcel for pickup or door delivery.
     * Generates a 4-digit code, hashes and stores it, returns plaintext once.
     */
    scheduleParcel(params: {
        parcelId: string;
        societyId: string;
        userId: string;
        userFlatId: string;
        mode: HandoverMode;
        slotStart: string;
        slotEnd: string;
    }): Promise<{
        parcelId: string;
        courier: string;
        flat: string;
        mode: HandoverMode;
        slotStart: string;
        slotEnd: string;
        fee: number;
        code: string;
        expiresAt: string;
    }>;
}
export declare const parcelsService: ParcelsService;
//# sourceMappingURL=parcels.service.d.ts.map