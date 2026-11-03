"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSchema = exports.createFlatSchema = exports.handoverVerifySchema = exports.scheduleParcelSchema = exports.createParcelSchema = exports.verifyOtpSchema = exports.requestOtpSchema = exports.phoneRegex = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
// Indian phone number regex or standard 10-digit mobile
exports.phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
exports.requestOtpSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .trim()
        .min(10, 'Phone number must be at least 10 digits')
        .refine((val) => exports.phoneRegex.test(val.replace(/\s+/g, '')), {
        message: 'Enter a valid Indian mobile number (e.g. +919876543210 or 9876543210)',
    }),
});
exports.verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().trim(),
    otp: zod_1.z
        .string()
        .trim()
        .min(4, 'OTP must be at least 4 digits')
        .max(6, 'OTP cannot exceed 6 digits'),
});
exports.createParcelSchema = zod_1.z.object({
    flatId: zod_1.z.string().uuid('Please select a valid flat'),
    courier: zod_1.z.string().trim().min(2, 'Courier name must be at least 2 characters'),
    photoUrl: zod_1.z.string().optional().nullable(),
});
exports.scheduleParcelSchema = zod_1.z.object({
    mode: zod_1.z.nativeEnum(enums_1.HandoverMode, {
        errorMap: () => ({ message: 'Please select Pickup or Door Delivery' }),
    }),
    slotStart: zod_1.z.string().datetime({ message: 'Valid slot start time required' }),
    slotEnd: zod_1.z.string().datetime({ message: 'Valid slot end time required' }),
});
exports.handoverVerifySchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .trim()
        .regex(/^\d{4}$/, 'Handover code must be exactly 4 numeric digits'),
});
exports.createFlatSchema = zod_1.z.object({
    tower: zod_1.z.string().trim().min(1, 'Tower is required (e.g., Tower A)'),
    number: zod_1.z.string().trim().min(1, 'Flat number is required (e.g., 1204)'),
});
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: zod_1.z
        .string()
        .trim()
        .refine((val) => exports.phoneRegex.test(val.replace(/\s+/g, '')), {
        message: 'Enter a valid Indian mobile number',
    }),
    role: zod_1.z.nativeEnum(enums_1.UserRole),
    flatId: zod_1.z.string().uuid().optional().nullable(),
});
//# sourceMappingURL=schemas.js.map