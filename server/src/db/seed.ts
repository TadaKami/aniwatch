import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from './client.js';
import { users } from './schema.js';

export async function seedTestUser(): Promise<void> {
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) return;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, env.TEST_USER_EMAIL))
    .limit(1);
  if (existing.length > 0) return;

  const hash = await bcrypt.hash(env.TEST_USER_PASSWORD, 10);
  await db.insert(users).values({
    email: env.TEST_USER_EMAIL,
    name: env.TEST_USER_NAME ?? 'Test User',
    password: hash,
  });
  console.log(`[SEED] ✅ test user created: ${env.TEST_USER_EMAIL}`);
}