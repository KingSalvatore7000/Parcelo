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

const schema = z.object({
  // Unset means production: dev-only shortcuts must be switched on explicitly
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().optional(),
  MOCK_SMS_CONSOLE: boolFlag,
  DEFAULT_DEV_OTP: z
    .string()
    .regex(/^\d{6}$/, 'DEFAULT_DEV_OTP must be 6 digits')
    .optional(),
  // Number of proxy hops in front of the API (e.g. 1 behind nginx); needed for correct client IPs
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Door delivery fee in paise (₹20 = 2000); counter pickup is always free
  DOOR_DELIVERY_FEE_PAISE: z.coerce.number().int().min(0).default(2000),
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
const isProd = env.NODE_ENV === 'production';

const problems: string[] = [];
if (isProd) {
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required in production');
  if (!env.JWT_SECRET) {
    problems.push('JWT_SECRET is required in production');
  } else if (env.JWT_SECRET.length < 32 || /^(thapal|parcelo)_dev_/.test(env.JWT_SECRET)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters, not the example secret');
  }
  if (!env.CORS_ORIGIN) problems.push('CORS_ORIGIN is required in production (comma-separated web origins)');
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
  isProd,
  databaseUrl: env.DATABASE_URL ?? DEV_DATABASE_URL,
  jwtSecret: env.JWT_SECRET ?? DEV_JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  corsOrigin: env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],
  // Printing OTPs to the console is only on by default in development
  mockSmsConsole: env.MOCK_SMS_CONSOLE ?? isDev,
  // A fixed login OTP is honoured only in development, never in test or production
  defaultDevOtp: isDev ? env.DEFAULT_DEV_OTP ?? '123456' : undefined,
  trustProxy: env.TRUST_PROXY,
  doorDeliveryFeePaise: env.DOOR_DELIVERY_FEE_PAISE,
};
