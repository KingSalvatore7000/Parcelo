/**
 * Standardize Indian phone number to E.164 format (+91XXXXXXXXXX)
 */
export declare function normalizePhone(rawPhone: string): string;
export declare class AuthService {
    /**
     * Request OTP for phone login
     */
    requestOtp(rawPhone: string): Promise<{
        success: boolean;
        message: string;
        expiresInSeconds: number;
        devOtp: string | undefined;
    }>;
    /**
     * Verify OTP and issue JWT session
     */
    verifyOtp(rawPhone: string, otp: string): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            phone: string;
            role: import(".prisma/client").$Enums.UserRole;
            societyId: string;
            societyName: string;
            flatId: string | null;
            flat: {
                id: string;
                societyId: string;
                tower: string;
                number: string;
                label: string;
            } | null;
        };
    }>;
    /**
     * Get user profile by ID
     */
    getProfile(userId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        role: import(".prisma/client").$Enums.UserRole;
        societyId: string;
        societyName: string;
        flatId: string | null;
        flat: {
            id: string;
            societyId: string;
            tower: string;
            number: string;
            label: string;
        } | null;
    }>;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map