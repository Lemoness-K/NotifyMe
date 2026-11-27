import { AppError } from './errors.js';
import { bootstrapAdmin } from './auth.js';
import { getRuntime } from './config.js';
import { databaseGeneration } from './operations/activation.js';
import { openStore } from './storage.js';

try {
  if (process.env.NOTIFY_MODE !== 'local' || process.argv.slice(2).join(' ') !== '--synthetic' ||
      Object.keys(process.env).some((name) => name.startsWith('NOTIFY_OPS_'))) {
    throw new AppError(409, 'BOOTSTRAP_CLI_DISABLED');
  }
  const runtime = getRuntime();
  if (!('localSignIn' in runtime) || !runtime.localSignIn) throw new AppError(409, 'BOOTSTRAP_CLI_DISABLED');
  if (databaseGeneration(runtime.path) !== undefined) throw new AppError(409, 'BOOTSTRAP_CLI_DISABLED');
  const db = await openStore(runtime.path);
  try {
    await bootstrapAdmin(db, runtime.provider, runtime.localSignIn('').firebaseToken);
    process.stdout.write('Notify Me household initialized.\n');
  } finally { await db.$disconnect(); }
} catch (error) {
  const code = error instanceof AppError ? error.code : 'BOOTSTRAP_FAILED';
  process.stderr.write('Notify Me initialization failed: ' + code + '\n');
  process.exitCode = 1;
}
