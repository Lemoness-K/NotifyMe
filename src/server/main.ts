import { resolve } from 'node:path';
import { getRuntime } from './config.js';
import { createApp } from './http.js';
import { openStore } from './storage.js';
import { HouseholdRepository } from './households.js';
import { startInviteCleanup } from './household-runtime.js';

try {
  const settings = getRuntime();
  const db = await openStore(settings.path);
  try {
    await db.invitation.count();
    const app = await createApp({
      ...settings, db, webRoot: resolve('dist/web'),
      log: (record) => process.stdout.write(JSON.stringify(record) + '\n'),
    });
    await app.listen(settings.port, settings.host);
    const stopCleanup = startInviteCleanup(new HouseholdRepository(db, settings.origin), settings.householdConfig.cleanupIntervalMs,
      (record) => process.stdout.write(JSON.stringify(record) + '\n'));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
      void stopCleanup().then(() => app.close()).then(() => db.$disconnect()).then(() => process.exit(0), () => process.exit(1));
    });
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
} catch {
  process.stderr.write('Notify Me failed to start; verify configuration, credentials, and migrations.\n');
  process.exitCode = 1;
}
