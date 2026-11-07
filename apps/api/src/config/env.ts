import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or apps/api
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5433/thapal_dev?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'thapal_dev_super_secret_jwt_key_2026_indian_societies',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
  mockSmsConsole: process.env.MOCK_SMS_CONSOLE !== 'false',
  defaultDevOtp: process.env.DEFAULT_DEV_OTP || '123456',
};
