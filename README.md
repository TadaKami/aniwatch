# 🎌 AnimeWatch — личный трекер аниме

Каталог — Shikimori (русские названия), списки пользователя — PostgreSQL.
Все внешние запросы идут только с сервера (правило ТЗ §3).

## Стек
- Frontend: Vite + React 19 + TypeScript + react-router-dom 7
- Backend: Express + TypeScript (tsx watch), Drizzle ORM, zod, bcryptjs, jsonwebtoken
- DB: PostgreSQL (Supabase), каталог: Shikimori (зеркало настраивается в .env)

## Быстрый старт
1. `.env` в `server/` (или в корне): `DATABASE_URL`, `JWT_SECRET` (≥32), `SHIKIMORI_USER_AGENT`.
2. `npm i` в корне, `server/`, `client/`.
3. Чистая БД: `cd server && npx drizzle-kit push`.
   Перенос с v1: `src/db/migrations/0001_add_v2_constraints.sql`.
4. `npm run dev` → клиент :5173, сервер :4000.
5. Тест-юзер создаётся автоматически из `TEST_USER_*`.

## Скрипты и утилиты
- `npm run dev` — оба процесса (concurrently -k)
- `npx drizzle-kit push | studio`
- `npx tsx src/db/repair-genres.ts` — дозаполнение жанров у тайтлов,
  добавленных до серверного обогащения (идемпотентно, пауза против 429)

## Реализовано по ТЗ
- Auth: регистрация/вход (bcrypt + JWT 7d), seed, Bearer-middleware
- Поиск: строка, жанры-чипы, сезон/год/формат/статус, пагинация 20/30/50,
  исключение добавленных; состояние поиска живёт в URL — «← Назад» с карточки
  возвращает на поиск с тем же запросом
- Карточка: баннер, жанры, мета, описание (HTML), статус, чек-лист серий
  (серии видны только у тайтлов из списка)
- Списки: 4 статуса, смена, удаление, владение, unique-защита от дублей
- Дашборд: бары жанров по WATCHED, on-the-fly

## Известные ограничения
- Зеркало shikimori.io не отдаёт серии (REST 404, GraphQL пусто) → «Серия N»
- Постеры-«404» у анонсов подменяются заглушкой через `/api/anime/cover-status`
  (HEAD-сравнение сигнатур в одном размере, кэш 24ч)
- Список поиска Shikimori не содержит жанров — жанры дотягиваются из деталей
- Google OAuth не подключён (опционально по ТЗ)
- PowerShell 5.1: тела запросов — только через файлы (`--data "@f.json"`),
  `Authorization` надёжнее слать через `curl.exe`
