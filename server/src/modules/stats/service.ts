import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { anime as animeTable, watchItems } from '../../db/schema.js';

export interface GenreStat {
  genre: string;
  count: number;
}

export async function getGenreStats(userId: string): Promise<GenreStat[]> {
  const rows = await db
    .select({ genres: animeTable.genres })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(and(eq(watchItems.userId, userId), eq(watchItems.status, 'WATCHED')));

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const genre of row.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}