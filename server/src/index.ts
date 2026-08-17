import { env } from './config/env.js';
import { seedTestUser } from './db/seed.js';
import { app } from './app.js';

async function bootstrap() {
  await seedTestUser();
  app.listen(env.PORT, () => {
    console.log(`\n[SERVER] 🚀 running on http://localhost:${env.PORT}`);
    console.log(`[SERVER] 🌐 frontend at ${env.FRONTEND_URL}`);
    console.log(`[SERVER] ❤️  health → GET /api/health\n`);
  });
}

void bootstrap();