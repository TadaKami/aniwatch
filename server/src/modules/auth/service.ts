import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';

export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name is too short').max(50),
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(6,'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(1),
});

export interface PublicUser{
    id: string;
    email: string;
    name: string;
}

function toPublicUser(u: typeof users.$inferSelect): PublicUser{
    return {id: u.id, email: u.email, name: u.name};
}

function signToken(userId: string): string{
    return jwt.sign({sub: userId}, env.JWT_SECRET, {expiresIn: '7d'});
}

export async function register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
    const {name, email, password} = parsed.data;

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length >0) throw new HttpError(409, 'A user with this email already exists');

    const hash = await bcrypt.hash(password, 10);
    const [created] = await db
    .insert(users)
    .values({name, email, password: hash})
    .returning();

    return {token: signToken(created.id), user: toPublicUser(created)};
}

export async function login(input: unknown) {
    const parsed = loginSchema.safeParse(input);
    if(!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');

    const {email, password} = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // Не раскрываем, существует ли email (защита от перебора)
    if (!user) throw new HttpError(401, 'Invalid email or password');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new HttpError(401, 'Invalid email or password');

    return { token: signToken(user.id), user: toPublicUser(user) };    
}
