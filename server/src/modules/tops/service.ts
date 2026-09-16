import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { anime as animeTable, userTopItems, userTops } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';

const createTopSchema = z.object({
  name: z.string().trim().min(1, 'Name is too short').max(80),
  description: z.string().trim().max(500).nullable().optional(),
  contentType: z.enum(['any', 'anime', 'tv', 'movie']).default('any'),
});
const addItemSchema = z.object({ animeId: z.string().uuid() });
const reorderSchema = z.object({ items: z.array(z.string().uuid()).max(200) });

async function assertTop(userId: string, topId: string) {
  const [top] = await db.select().from(userTops)
    .where(and(eq(userTops.id, topId), eq(userTops.userId, userId))).limit(1);
  if (!top) throw new HttpError(404, 'Top not found');
  return top;
}

const itemSelect = {
  id: userTopItems.id,
  topId: userTopItems.topId,
  position: userTopItems.position,
  animeId: animeTable.id,
  shikimoriId: animeTable.shikimoriId,
  source: animeTable.source,
  contentType: animeTable.contentType,
  name: animeTable.name,
  russian: animeTable.russian,
  coverImage: animeTable.coverImage,
  score: animeTable.score,
};

async function loadItems(topIds: string[]) {
  if (topIds.length === 0) return [];
  return db
    .select(itemSelect)
    .from(userTopItems)
    .innerJoin(animeTable, eq(userTopItems.animeId, animeTable.id))
    .where(inArray(userTopItems.topId, topIds))
    .orderBy(asc(userTopItems.position));
}

export async function listTops(userId: string) {
  const tops = await db.select().from(userTops)
    .where(eq(userTops.userId, userId)).orderBy(asc(userTops.createdAt));
  const items = await loadItems(tops.map((t) => t.id));
  return tops.map((t) => ({ ...t, items: items.filter((i) => i.topId === t.id) }));
}

export async function getTop(userId: string, topId: string) {
  const top = await assertTop(userId, topId);
  const items = await loadItems([topId]);
  return { ...top, items };
}

export async function createTop(userId: string, input: unknown) {
  const parsed = createTopSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const [top] = await db.insert(userTops).values({
    userId, name: parsed.data.name,
    description: parsed.data.description ?? null,
    contentType: parsed.data.contentType,
  }).returning();
  return { ...top, items: [] };
}

export async function removeTop(userId: string, topId: string) {
  await assertTop(userId, topId);
  await db.delete(userTops).where(eq(userTops.id, topId));
  return { ok: true };
}

export async function addTopItem(userId: string, topId: string, input: unknown) {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Invalid animeId');
  await assertTop(userId, topId);
  const existing = await db.select({ position: userTopItems.position })
    .from(userTopItems).where(eq(userTopItems.topId, topId));
  const position = existing.reduce((m, i) => Math.max(m, i.position), 0) + 1;
  try {
    await db.insert(userTopItems).values({ topId, animeId: parsed.data.animeId, position });
  } catch { throw new HttpError(409, 'Already in top'); }
  return { ok: true };
}

export async function removeTopItem(userId: string, topId: string, animeId: string) {
  await assertTop(userId, topId);
  await db.delete(userTopItems).where(and(eq(userTopItems.topId, topId), eq(userTopItems.animeId, animeId)));
  return { ok: true };
}

export async function reorderTop(userId: string, topId: string, input: unknown) {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Invalid items');
  await assertTop(userId, topId);
  for (let i = 0; i < parsed.data.items.length; i++) {
    await db.update(userTopItems).set({ position: i + 1 })
      .where(and(eq(userTopItems.topId, topId), eq(userTopItems.animeId, parsed.data.items[i])));
  }
  return { ok: true };
}