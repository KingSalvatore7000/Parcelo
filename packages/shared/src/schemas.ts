import { z } from 'zod';
import { UserRole, HandoverMode } from './enums';

// Indian phone number regex or standard 10-digit mobile
export const phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;

export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, 'Phone number must be at least 10 digits')
    .refine((val) => phoneRegex.test(val.replace(/\s+/g, '')), {
      message: 'Enter a valid Indian mobile number (e.g. +919876543210 or 9876543210)',
    }),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim(),
  otp: z
    .string()
    .trim()
    .min(4, 'OTP must be at least 4 digits')
    .max(6, 'OTP cannot exceed 6 digits'),
});

/** Public path the API returns for an uploaded parcel photo */
export const parcelPhotoPathRegex = /^\/uploads\/parcels\/[a-f0-9]{32}\.(jpg|png|webp)$/;

export const createParcelSchema = z.object({
  flatId: z.string().uuid('Please select a valid flat'),
  courier: z.string().trim().min(2, 'Courier name must be at least 2 characters').max(60),
  photoUrl: z
    .string()
    .regex(parcelPhotoPathRegex, 'Photo must be uploaded through Parcelo first')
    .optional()
    .nullable(),
});

export const scheduleParcelSchema = z.object({
  mode: z.nativeEnum(HandoverMode, {
    errorMap: () => ({ message: 'Please select Pickup or Door Delivery' }),
  }),
  slotStart: z.string().datetime({ message: 'Valid slot start time required' }),
  slotEnd: z.string().datetime({ message: 'Valid slot end time required' }),
});

export const handoverVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Handover code must be exactly 4 numeric digits'),
});

export const createFlatSchema = z.object({
  tower: z.string().trim().min(1, 'Tower is required (e.g., Tower A)'),
  number: z.string().trim().min(1, 'Flat number is required (e.g., 1204)'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .refine((val) => phoneRegex.test(val.replace(/\s+/g, '')), {
      message: 'Enter a valid Indian mobile number',
    }),
  role: z.nativeEnum(UserRole),
  flatId: z.string().uuid().optional().nullable(),
});
