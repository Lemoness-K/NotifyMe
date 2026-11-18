import { resolve } from 'node:path';
import { getRuntime } from './config.js';
import { createApp } from './http.js';
import { openStore } from './storage.js';

try {
  const settings = getRuntime();
  const db = await openStore(settings.path);
  try {
    await db.household.count();
    const app = await createApp({
      ...settings, db, webRoot: resolve('dist/web'),
      log: (record) => process.stdout.write(JSON.stringify(record) + '\n'),
    });
    await app.listen(settings.port, settings.host);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
      void app.close().then(() => db.$disconnect()).then(() => process.exit(0), () => process.exit(1));
    });
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
} catch {
  process.stderr.write('Notify Me failed to start; verify configuration, credentials, and migrations.\n');
  process.exitCode = 1;
}
