/// <reference types="node" />
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// .env может лежать в server/ или в корне монорепо — читаем оба места
dotenv.config();                    // server/.env
dotenv.config({ path: '../.env' }); // корень монорепо

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('[drizzle] DATABASE_URL не задан — скопируйте .env.example в .env');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
});