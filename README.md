# 🎬 Episodex — личный трекер аниме, дорам, сериалов и фильмов

Каталоги: Shikimori (аниме, русские названия) и TMDB (сериалы/дорамы/фильмы,
русская локализация). Списки, прогресс серий и статистика — в PostgreSQL.
Все внешние запросы идут только с сервера.

## Стек
- Frontend: Vite + React 19 + TypeScript + react-router-dom 7
- Backend: Express + TypeScript (локально tsx watch), Drizzle ORM, zod, bcryptjs, jsonwebtoken
- DB: PostgreSQL (Supabase)
- Каталоги: Shikimori REST/GraphQL + TMDB v3 (`language=ru-RU`)
- Deploy: Vercel — статика + `/api` как serverless-функция (esbuild → CJS-бандл)

## Быстрый старт
1. `.env` в `server/` или в корне (см. «Переменные окружения»).
2. `npm i` в корне, `server/`, `client/`.
3. Чистая БД: `cd server && npx drizzle-kit push`.
   Существующая БД: выполнить `server/src/db/migrations/0001_add_v2_constraints.sql`
   и `0002_content_source.sql`.
4. `npm run dev` → клиент :5173, сервер :4000.
5. Тест-юзер создаётся автоматически из `TEST_USER_*`.

## Переменные окружения
- `DATABASE_URL`, `JWT_SECRET` (≥32), `PORT`
- `FRONTEND_URL`, `BACKEND_URL`
- `SHIKIMORI_API_URL`, `SHIKIMORI_ORIGIN`, `SHIKIMORI_USER_AGENT` (только латиница!)
- `TMDB_READ_TOKEN` (рекомендуется) и/или `TMDB_API_KEY`
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` / `TEST_USER_NAME` — опционально

## Деплой (Vercel)
- Install: `npm install && npm install --prefix client && npm install --prefix server`
- Build: `npx esbuild server/src/app.ts --bundle --platform=node --target=node18 --format=cjs --external:pg-native --outfile=api/server-bundle.cjs && cd client && npm run build`
- Output: `client/dist`; rewrites в `vercel.json`: `/api/*` → функция, остальное → SPA
- `api/index.ts` реэкспортирует express-app из бандла; `server/src/app.ts` — единственный
  источник сборки Express (локаль и прод не расходятся)

## Что реализовано
- Auth: регистрация/вход (bcrypt + JWT 7d), seed тест-юзера
- Профиль: аватар (base64, даунскейл 256px), смена имени/email/пароля, «Вы с нами с …»
- Поиск: плашки «Аниме | Сериалы и дорамы | Фильмы»; фильтры — жанры-чипы, год,
  сезон/формат/статус (аниме), страна (сериалы); пагинация; состояние в URL;
  исключение добавленных тайтлов
- Карточка аниме: постер (заглушка при 404), жанры, описание, «Сезоны и фильмы»
  (франшиза), «Похожее по жанрам», чек-лист серий с прогрессом
- Карточка сериала/фильма (TMDB): сезоны и серии с русскими названиями,
  прогресс по сезонам, рекомендации TMDB
- Списки: 4 статуса, смена, удаление, бейджи типа контента
- Статистика: карточки итогов (франшиза = 1 тайтл), активность за 12 недель,
  «Сейчас смотрю» с прогресс-барами, жанровые бары
- «Что дальше»: продолжения просмотренного (франшизы Shikimori, коллекции TMDB)
  + похожие по жанрам с честной подписью + плашка «Анонсы» (ещё не вышедшее)
- «Что посмотреть»: случайный тайтл из топа по типам, исключая ваши списки

## Известные ограничения
- Зеркало Shikimori не отдаёт серии (REST 404, GraphQL пусто) → «Серия N»
- У TMDB-сериалов нет графа сиквелов — «Что дальше» для сериалов даёт похожие
- TMDB `/search` игнорирует год — год фильтруется на клиенте
- Прогресс внутри внешних плееров не читается