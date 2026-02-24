import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().default('dev_secret_change_me'),
  BASE_URL: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform((s) => s === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@reservas.local'),
  RESEND_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const PORT = env.PORT;
export const JWT_SECRET = env.JWT_SECRET;
export const BASE_URL = env.BASE_URL || `http://localhost:${env.PORT}`;
export const FRONTEND_URL = env.FRONTEND_URL;
export const SMTP = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
};
export const RESEND_API_KEY = env.RESEND_API_KEY;
export const DATA_DIR = path.join(__dirname, '../../data');
