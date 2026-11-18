import { AppError } from './errors.js';
import { bootstrapAdmin } from './auth.js';
import { getRuntime } from './config.js';
import { openStore } from './storage.js';

async function readToken() {
  if (process.stdin.isTTY) throw new Error('Receive the identity proof on stdin, not in CLI arguments');
  let data = '';
  for await (const chunk of process.stdin) {
    data += String(chunk);
    if (data.length > 12_000) throw new Error('Invalid input');
  }
  return data.trim();
}

try {
  const runtime = getRuntime();
  const token = process.argv[2] === '--synthetic' && 'localSignIn' in runtime && runtime.localSignIn
    ? runtime.localSignIn('').firebaseToken : await readToken();
  if (!token) throw new Error('Identity proof missing');
  const db = await openStore(runtime.path);
  try {
    await bootstrapAdmin(db, runtime.provider, token);
    process.stdout.write('Notify Me household initialized.\n');
  } finally { await db.$disconnect(); }
} catch (error) {
  const code = error instanceof AppError ? error.code : 'BOOTSTRAP_FAILED';
  process.stderr.write('Notify Me initialization failed: ' + code + '\n');
  process.exitCode = 1;
}
