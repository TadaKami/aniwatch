import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { anime as animeTable, userTopItems, userTops, users, watchItems } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';

const createTopSchema = z.object({
  name: z.string().trim().min(1, 'Name is too short').max(80),
  description: z.string().trim().max(500).nullable().optional(),
  contentType: z.enum(['any', 'anime', 'tv', 'movie']).default('any'),
  items: z.array(z.object({
    animeId: z.string().uuid(),
    comment: z.string().trim().max(1000).nullable().optional(),
  })).max(100).optional(),
});
const addItemSchema = z.object({
  animeId: z.string().uuid(),
  comment: z.string().trim().max(1000).nullable().optional(),
});
const reorderSchema = z.object({ items: z.array(z.string().uuid()).max(200) });

async function assertTop(userId: string, topId: string) {
  const [top] = await db.select().from(userTops)
    .where(and(eq(userTops.id, topId), eq(userTops.userId, userId))).limit(1);
  if (!top) throw new HttpError(404, 'Top not found');
  return top;
}

async function assertItemAllowed(userId: string, animeId: string) {
  const [w] = await db.select({ status: watchItems.status, rating: watchItems.rating })
    .from(watchItems)
    .where(and(eq(watchItems.userId, userId), eq(watchItems.animeId, animeId)))
    .limit(1);
  if (!w || w.status !== 'WATCHED' || w.rating == null) {
    throw new HttpError(400, 'В топ можно добавлять только просмотренные тайтлы с вашей оценкой');
  }
}

const itemSelect = {
  id: userTopItems.id,
  topId: userTopItems.topId,
  position: userTopItems.position,
  comment: userTopItems.comment,
  animeId: animeTable.id,
  shikimoriId: animeTable.shikimoriId,
  source: animeTable.source,
  contentType: animeTable.contentType,
  name: animeTable.name,
  russian: animeTable.russian,
  coverImage: animeTable.coverImage,
  score: animeTable.score,
  ownerRating: watchItems.rating,
};

// ВАЖНО: userTops обязательно в FROM, иначе Postgres даст
// "missing FROM-clause entry for table UserTop"
async function loadItems(topIds: string[]) {
  if (topIds.length === 0) return [];
  return db.select(itemSelect)
    .from(userTopItems)
    .innerJoin(userTops, eq(userTops.id, userTopItems.topId))
    .innerJoin(animeTable, eq(userTopItems.animeId, animeTable.id))
    .leftJoin(watchItems, and(
      eq(watchItems.animeId, animeTable.id),
      eq(watchItems.userId, userTops.userId),
    ))
    .where(inArray(userTopItems.topId, topIds))
    .orderBy(asc(userTopItems.position));
}

const topSelect = {
  id: userTops.id,
  userId: userTops.userId,
  ownerName: users.name,
  ownerAvatar: users.avatar,
  name: userTops.name,
  description: userTops.description,
  contentType: userTops.contentType,
  createdAt: userTops.createdAt,
  updatedAt: userTops.updatedAt,
};

// Публичный список топов всех пользователей
export async function listTops() {
  const tops = await db.select(topSelect)
    .from(userTops)
    .innerJoin(users, eq(userTops.userId, users.id))
    .orderBy(desc(userTops.createdAt));
  const items = await loadItems(tops.map((t) => t.id));
  return tops.map((t) => ({ ...t, items: items.filter((i) => i.topId === t.id) }));
}

export async function getTop(topId: string) {
  const [top] = await db.select(topSelect)
    .from(userTops)
    .innerJoin(users, eq(userTops.userId, users.id))
    .where(eq(userTops.id, topId))
    .limit(1);
  if (!top) throw new HttpError(404, 'Top not found');
  const items = await loadItems([topId]);
  return { ...top, items };
}

export async function createTop(userId: string, input: unknown) {
  const parsed = createTopSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;
  for (const it of p.items ?? []) await assertItemAllowed(userId, it.animeId);
  return db.transaction(async (tx) => {
    const [top] = await tx.insert(userTops).values({
      userId,
      name: p.name,
      description: p.description ?? null,
      contentType: p.contentType,
    }).returning();
    let pos = 1;
    for (const it of p.items ?? []) {
      await tx.insert(userTopItems).values({
        topId: top.id, animeId: it.animeId, position: pos++, comment: it.comment ?? null,
      });
    }
    return { id: top.id };
  });
}

export async function removeTop(userId: string, topId: string) {
  await assertTop(userId, topId);
  await db.delete(userTops).where(eq(userTops.id, topId));
  return { ok: true };
}

export async function addTopItem(userId: string, topId: string, input: unknown) {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Invalid item');
  await assertTop(userId, topId);
  await assertItemAllowed(userId, parsed.data.animeId);
  const existing = await db.select({ position: userTopItems.position })
    .from(userTopItems).where(eq(userTopItems.topId, topId));
  const position = existing.reduce((m, i) => Math.max(m, i.position), 0) + 1;
  try {
    await db.insert(userTopItems).values({
      topId, animeId: parsed.data.animeId, position, comment: parsed.data.comment ?? null,
    });
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