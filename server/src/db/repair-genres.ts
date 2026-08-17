import { eq } from 'drizzle-orm';
import { shikimoriGet, type ShikimoriAnimeDetails } from '../modules/anime/shikimori.js';
import { db } from './client.js';
import { anime } from './schema.js';

async function main() {
  const rows = await db.select().from(anime);
  for (const row of rows) {
    if ((row.genres ?? []).length > 0) continue;
    try {
      const d = await shikimoriGet<ShikimoriAnimeDetails>(`/animes/${row.shikimoriId}`);
      const genres = (d.genres ?? []).map((g) => g.russian || g.name);
      await db
        .update(anime)
        .set({
          genres,
          description: row.description ?? d.description ?? null,
          studios: row.studios ?? (d.studios?.map((s) => s.name).join(', ') || null),
        })
        .where(eq(anime.id, row.id));
      console.log(`[repair] ${row.shikimoriId} → ${genres.length} жанров`);
    } catch (e) {
      console.error(`[repair] ${row.shikimoriId} ошибка:`, e);
    }
    await new Promise((r) => setTimeout(r, 700)); // ~85 зап/мин, ниже лимита 90
  }
  console.log('[repair] готово');
  process.exit(0);
}

void main();