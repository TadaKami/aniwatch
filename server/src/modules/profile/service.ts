import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';

const AVATAR_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(50).optional(),
  email: z.string().trim().toLowerCase().email('Invalid email').optional(),
  avatar: z.union([z.string().regex(AVATAR_RE, 'Invalid avatar').max(1_500_000, 'Avatar is too big'), z.null()]).optional(),
});

export async function getProfile(userId: string) {
  const [u] = await db
    .select({ id: users.id, email: users.email, name: users.name, avatar: users.avatar, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new HttpError(404, 'User not found');
  return { ...u, createdAt: u.createdAt.toISOString() };
}

export async function updateProfile(userId: string, input: unknown) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;

  if (p.email) {
    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, p.email), ne(users.id, userId)))
      .limit(1);
    if (dup.length > 0) throw new HttpError(409, 'A user with this email already exists');
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.email !== undefined ? { email: p.email } : {}),
      ...(p.avatar !== undefined ? { avatar: p.avatar } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return { id: updated.id, email: updated.email, name: updated.name, avatar: updated.avatar };
}