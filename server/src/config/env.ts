import { loadDotenv } from './dotenv.js';
import { z } from 'zod';


loadDotenv();

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  SHIKIMORI_API_URL: z.string().url().default('https://shikimori.io/api'),
  SHIKIMORI_ORIGIN: z.string().url().default('https://shikimori.io'),
  SHIKIMORI_USER_AGENT: z.string().min(1, 'SHIKIMORI_USER_AGENT is required'),
  TEST_USER_EMAIL: z.string().email().optional(),
  TEST_USER_PASSWORD: z.string().min(6).optional(),
  TEST_USER_NAME: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[ENV] ❌ Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  • ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();