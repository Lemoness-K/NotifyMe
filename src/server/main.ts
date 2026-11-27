import { dirname, resolve } from 'node:path';
import { getRuntime, setupIngressAllowed } from './config.js';
import { FirstAdminOnboarding } from './admin-onboarding.js';
import { createApp } from './http.js';
import { openStore } from './storage.js';
import { HouseholdRepository } from './households.js';
import { startInviteCleanup } from './household-runtime.js';
import { databaseGeneration } from './operations/activation.js';
import { startManagedRuntime, type ServingGate } from './operations/runtime.js';
import { operationsSettings } from './operations/settings.js';
import { SetupAuthority } from './operations/setup-authority.js';
import { listenOperations } from './operations/socket.js';
import type { WorkService } from './work-service.js';

const log = (record: Record<string, unknown>) => process.stdout.write(JSON.stringify(record) + '\n');

try {
  const settings = getRuntime();
  const operations = operationsSettings();
  if (operations && dirname(settings.deleteJournalPath) !== operations.state) throw new Error('OPERATIONS_JOURNAL_INVALID');
  async function start({ database, epoch }: { database: string; epoch?: string }, gate?: ServingGate) {
    const db = await openStore(database);
    let app: Awaited<ReturnType<typeof createApp>> | undefined;
    let stopLocal: (() => Promise<void>) | undefined;
    let cleanup: ReturnType<typeof setInterval> | undefined;
    try {
      await db.invitation.count();
      const authority = operations && epoch && setupIngressAllowed(process.env)
        ? new SetupAuthority(operations.state, database, epoch) : undefined;
      const onboarding = authority && new FirstAdminOnboarding(db, settings.provider, authority);
      if (authority) {
        try { await authority.recover(db); }
        catch { log({ event: 'SETUP_UNAVAILABLE' }); }
      }
      let work!: WorkService;
      let published = false;
      let startWorkers: (() => void) | undefined;
      app = await createApp({
        ...settings, db, installationGeneration: epoch, webRoot: resolve('dist/web'),
        workMaintenance: true, workLog: log, log, onboarding,
        journalAuthority: operations?.authority, onWorkService: (service) => { work = service; },
        servingGate: gate && { isPublished: () => published, deferWorkers: (start) => { startWorkers = start; } },
      });
      gate?.check();
      await app.listen(settings.port, settings.host);
      gate?.publish();
      published = true;
      startWorkers?.();
      if (operations) stopLocal = await listenOperations(operations, database, work, log);
      if (onboarding) {
        const purge = () => void onboarding.clearExpired().catch(() => log({ event: 'SETUP_CLEANUP_FAILED' }));
        purge();
        cleanup = setInterval(purge, 60_000).unref();
      }
      const stopCleanup = startInviteCleanup(new HouseholdRepository(db, settings.origin), settings.householdConfig.cleanupIntervalMs, log);
      return async () => {
        clearInterval(cleanup);
        try { await stopLocal?.(); }
        finally { try { await stopCleanup(); await app?.close(); } finally { await db.$disconnect(); } }
      };
    } catch (error) {
      clearInterval(cleanup);
      try { await stopLocal?.(); await app?.close(); }
      finally { await db.$disconnect(); }
      throw error;
    }
  }
  if (!operations && databaseGeneration(settings.path) !== undefined) throw new Error('OPERATIONS_CONFIG_INCOMPLETE');
  const stop = operations ? await startManagedRuntime(operations.state, start, {
    authority: operations.authority, journalPath: settings.deleteJournalPath,
  }) :
    await start({ database: settings.path, epoch: settings.installationGeneration });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    void stop().then(() => process.exit(0), () => process.exit(1));
  });
} catch {
  process.stderr.write('Notify Me failed to start; verify configuration, credentials, and migrations.\n');
  process.exitCode = 1;
}
