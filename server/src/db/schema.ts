import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const watchStatusEnum = pgEnum('WatchStatus', [
  'WANT_TO_WATCH',
  'WATCHING',
  'WATCHED',
  'DROPPED',
]);

export const users = pgTable('User', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const anime = pgTable('Anime', {
  id: uuid('id').defaultRandom().primaryKey(),
  shikimoriId: integer('shikimoriId').notNull().unique(),
  name: text('name').notNull(),
  russian: text('russian'),
  originalName: text('originalName'),
  coverImage: text('coverImage'),
  kind: text('kind'),
  score: real('score'),
  episodes: integer('episodes'),
  episodesAired: integer('episodesAired'),
  season: text('season'),
  seasonYear: integer('seasonYear'),
  genres: text('genres').array(),
  description: text('description'),
  studios: text('studios'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const watchItems = pgTable(
  'WatchItem',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    animeId: uuid('animeId').notNull().references(() => anime.id, { onDelete: 'cascade' }),
    status: watchStatusEnum('status').notNull().default('WANT_TO_WATCH'),
    note: text('note'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('WatchItem_user_anime_uq').on(t.userId, t.animeId)]
);

export const episodeProgress = pgTable(
  'EpisodeProgress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchItemId: uuid('watchItemId').notNull().references(() => watchItems.id, { onDelete: 'cascade' }),
    seasonNumber: integer('seasonNumber').notNull().default(1),
    episodeNumber: integer('episodeNumber').notNull(),
    watchedAt: timestamp('watchedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('EpisodeProgress_user_item_season_episode_uq').on(
      t.userId,
      t.watchItemId,
      t.seasonNumber,
      t.episodeNumber
    ),
  ]
);