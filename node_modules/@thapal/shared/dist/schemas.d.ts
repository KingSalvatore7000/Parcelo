import { z } from 'zod';
import { UserRole, HandoverMode } from './enums';
export declare const phoneRegex: RegExp;
export declare const requestOtpSchema: z.ZodObject<{
    phone: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export declare const verifyOtpSchema: z.ZodObject<{
    phone: z.ZodString;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    otp: string;
}, {
    phone: string;
    otp: string;
}>;
export declare const createParcelSchema: z.ZodObject<{
    flatId: z.ZodString;
    courier: z.ZodString;
    photoUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    flatId: string;
    courier: string;
    photoUrl?: string | null | undefined;
}, {
    flatId: string;
    courier: string;
    photoUrl?: string | null | undefined;
}>;
export declare const scheduleParcelSchema: z.ZodObject<{
    mode: z.ZodNativeEnum<typeof HandoverMode>;
    slotStart: z.ZodString;
    slotEnd: z.ZodString;
}, "strip", z.ZodTypeAny, {
    mode: HandoverMode;
    slotStart: string;
    slotEnd: string;
}, {
    mode: HandoverMode;
    slotStart: string;
    slotEnd: string;
}>;
export declare const handoverVerifySchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const createFlatSchema: z.ZodObject<{
    tower: z.ZodString;
    number: z.ZodString;
}, "strip", z.ZodTypeAny, {
    number: string;
    tower: string;
}, {
    number: string;
    tower: string;
}>;
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodEffects<z.ZodString, string, string>;
    role: z.ZodNativeEnum<typeof UserRole>;
    flatId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    name: string;
    role: UserRole;
    flatId?: string | null | undefined;
}, {
    phone: string;
    name: string;
    role: UserRole;
    flatId?: string | null | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map