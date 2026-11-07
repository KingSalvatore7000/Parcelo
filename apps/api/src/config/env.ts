import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from repo root, then apps/api (first value wins)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const DEV_JWT_SECRET = 'parcelo_dev_super_secret_jwt_key_2026_indian_societies';
const DEV_DATABASE_URL = 'postgresql://postgres:postgrespassword@localhost:5433/thapal_dev?schema=public';

const boolFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

const channel = z.enum(['console', 'whatsapp', 'sms']);

const schema = z.object({
  // Unset means production: dev-only shortcuts must be switched on explicitly
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  // Access tokens are short-lived; the refresh token (stored hashed) keeps people signed in
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGIN: z.string().optional(),
  DEFAULT_DEV_OTP: z
    .string()
    .regex(/^\d{6}$/, 'DEFAULT_DEV_OTP must be 6 digits')
    .optional(),
  // Number of proxy hops in front of the API (e.g. 1 behind nginx); needed for correct client IPs
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Door delivery fee in paise (₹20 = 2000); counter pickup is always free
  DOOR_DELIVERY_FEE_PAISE: z.coerce.number().int().min(0).default(2000),

  // Where messages go. console prints them (development); whatsapp and sms need the keys below.
  NOTIFY_CHANNEL: channel.default('console'),
  OTP_CHANNEL: channel.default('console'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_LANGUAGE: z.string().default('en'),
  WHATSAPP_TEMPLATE_OTP: z.string().optional(),
  WHATSAPP_TEMPLATE_NEW_PARCEL: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_OTP: z.string().optional(),
  MSG91_TEMPLATE_NEW_PARCEL: z.string().optional(),
  MSG91_TEMPLATE_REMINDER: z.string().optional(),

  // Background jobs: message sending, reminders, unclaimed marking, clean-up
  JOBS_ENABLED: boolFlag,
  REMINDER_AFTER_DAYS: z.coerce.number().int().min(1).default(2),
  UNCLAIMED_AFTER_DAYS: z.coerce.number().int().min(1).default(7),

  // How long a signed parcel-photo link stays valid
  PHOTO_URL_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';
const isProd = env.NODE_ENV === 'production';

const problems: string[] = [];
if (isProd) {
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required in production');
  if (!env.JWT_SECRET) {
    problems.push('JWT_SECRET is required in production');
  } else if (env.JWT_SECRET.length < 32 || /^(thapal|parcelo)_dev_/.test(env.JWT_SECRET)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters, not the example secret');
  }
  if (env.OTP_CHANNEL === 'console') {
    problems.push('OTP_CHANNEL must be whatsapp or sms in production (console would print sign-in codes to the server log)');
  }
}
for (const [name, ch] of [['NOTIFY_CHANNEL', env.NOTIFY_CHANNEL], ['OTP_CHANNEL', env.OTP_CHANNEL]] as const) {
  if (ch === 'whatsapp' && (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)) {
    problems.push(`${name}=whatsapp needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID`);
  }
  if (ch === 'sms' && !env.MSG91_AUTH_KEY) problems.push(`${name}=sms needs MSG91_AUTH_KEY`);
}
if (problems.length > 0) {
  console.error(`❌ Refusing to start (NODE_ENV=${env.NODE_ENV}):`);
  problems.forEach((p) => console.error(`   ${p}`));
  process.exit(1);
}

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDev,
  isTest,
  isProd,
  databaseUrl: env.DATABASE_URL ?? DEV_DATABASE_URL,
  jwtSecret: env.JWT_SECRET ?? DEV_JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  refreshTokenDays: env.REFRESH_TOKEN_DAYS,
  corsOrigin: env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : ['https://parceloo.onrender.com', 'http://localhost:5173', 'http://localhost:3000'],
  // A fixed login OTP is honoured only in development, never in test or production
  defaultDevOtp: isDev ? env.DEFAULT_DEV_OTP ?? '123456' : undefined,
  trustProxy: env.TRUST_PROXY,
  doorDeliveryFeePaise: env.DOOR_DELIVERY_FEE_PAISE,
  notify: {
    channel: env.NOTIFY_CHANNEL,
    otpChannel: env.OTP_CHANNEL,
    whatsapp: {
      token: env.WHATSAPP_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      language: env.WHATSAPP_LANGUAGE,
      templates: { OTP: env.WHATSAPP_TEMPLATE_OTP, NEW_PARCEL: env.WHATSAPP_TEMPLATE_NEW_PARCEL, REMINDER: env.WHATSAPP_TEMPLATE_REMINDER },
    },
    msg91: {
      authKey: env.MSG91_AUTH_KEY,
      templates: { OTP: env.MSG91_TEMPLATE_OTP, NEW_PARCEL: env.MSG91_TEMPLATE_NEW_PARCEL, REMINDER: env.MSG91_TEMPLATE_REMINDER },
    },
  },
  jobs: {
    // On by default except in tests, which call the job functions directly
    enabled: env.JOBS_ENABLED ?? !isTest,
    reminderAfterDays: env.REMINDER_AFTER_DAYS,
    unclaimedAfterDays: env.UNCLAIMED_AFTER_DAYS,
  },
  photoUrlTtlMinutes: env.PHOTO_URL_TTL_MINUTES,
};
