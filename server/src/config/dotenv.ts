import dotenv from 'dotenv';
import path from 'node:path';

/**
 * Ищет .env в server/ и в корне монорепо.
 * Порядок важен: ближний файл приоритетнее (dotenv не перезаписывает существующие ключи).
 */
export function loadDotenv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}