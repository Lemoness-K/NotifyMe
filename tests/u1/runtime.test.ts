import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { getRuntime } from '../../src/server/config.js';
import { syntheticProvider } from '../../src/server/provider.js';

const environment = { NOTIFY_MODE: 'target', NOTIFY_ORIGIN: 'https://notify.invalid',
  NOTIFY_DATABASE_PATH: 'unopened.db' };

it.each(['NOTIFY_SYNTHETIC_AUTH', 'NOTIFY_SYNTHETIC_KEY', 'FIREBASE_AUTH_EMULATOR_HOST'])(
  'rejects %s in target mode before creating a provider',
  (key) => {
    expect(() => getRuntime({ ...environment, [key]: 'set' })).toThrow('forbidden in target mode');
  },
);

it('requires HTTPS, loopback API binding and configured target credentials', () => {
  expect(() => getRuntime({ ...environment, NOTIFY_ORIGIN: 'http://notify.invalid' })).toThrow('HTTPS');
  expect(() => getRuntime({ ...environment, NOTIFY_ORIGIN: 'https://notify.invalid/public' })).toThrow('HTTPS');
  expect(() => getRuntime({ ...environment, NOTIFY_HOST: '0.0.0.0' })).toThrow('loopback');
  expect(() => getRuntime(environment)).toThrow('FIREBASE_PROJECT_ID');
  expect(() => getRuntime({ ...environment, FIREBASE_PROJECT_ID: 'test-id',
    GOOGLE_APPLICATION_CREDENTIALS: '/notify-test/missing.json' })).toThrow('credential file not available');
});

it.each([
  ['NOTIFY_AUTH_VERIFY_TIMEOUT_MS', '99'],
  ['NOTIFY_AUTH_VERIFY_TIMEOUT_MS', '10001'],
  ['NOTIFY_AUTH_VERIFY_TIMEOUT_MS', '1e3'],
  ['NOTIFY_AUTH_VERIFY_RETRIES', '3'],
  ['NOTIFY_AUTH_VERIFY_RETRIES', '0.5'],
  ['NOTIFY_AUTH_VERIFY_RETRIES', ''],
])('rejects invalid target verification settings for %s', (key, value) => {
  expect(() => getRuntime({ ...environment, [key]: value })).toThrow(key);
});

it('only allows the intentionally configured synthetic mode on loopback HTTPS', () => {
  expect(() => getRuntime({ ...environment, NOTIFY_MODE: 'local' })).toThrow('Local synthetic mode');
  expect(() => getRuntime({ ...environment, NOTIFY_MODE: 'local', NOTIFY_ORIGIN: 'https://127.0.0.1',
    NOTIFY_SYNTHETIC_AUTH: '1', NOTIFY_SYNTHETIC_KEY: 'short' })).toThrow('at least 32 characters');
});

it('loads the TLS files and enables an adapter for an explicit loopback configuration', () => {
  const dir = mkdtempSync(join(process.cwd(), '.u1-db-'));
  try {
    const key = join(dir, 'key.pem');
    const cert = join(dir, 'cert.pem');
    writeFileSync(key, 'fixture key');
    writeFileSync(cert, 'fixture cert');
    const runtime = getRuntime({
      ...environment, NOTIFY_MODE: 'local', NOTIFY_ORIGIN: 'https://127.0.0.1:3443',
      NOTIFY_SYNTHETIC_AUTH: '1', NOTIFY_SYNTHETIC_KEY: 'local-config-fixture-key-at-least-32',
      NOTIFY_TLS_KEY_FILE: key, NOTIFY_TLS_CERT_FILE: cert,
    });
    expect(runtime).toMatchObject({
      host: '127.0.0.1', port: 3443, tls: { key: Buffer.from('fixture key'), cert: Buffer.from('fixture cert') },
      localSignIn: expect.any(Function),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('keeps synthetic Firebase and Google proofs distinct and binds the supplied nonce', async () => {
  const provider = syntheticProvider('a-local-test-key-with-no-external-use');
  const proof = provider.mint('one-time-identifier');
  await expect(provider.verifyFirebase(proof.firebaseToken)).resolves.toMatchObject({ googleSubject: 'local-synthetic-google' });
  await expect(provider.verifyGoogle(proof.googleToken)).resolves.toMatchObject({ nonce: 'one-time-identifier' });
  await expect(provider.verifyFirebase(proof.googleToken)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  await expect(provider.verifyGoogle('bad-input')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});
