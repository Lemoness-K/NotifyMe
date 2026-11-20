import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultVerificationPolicy, realProvider, syntheticProvider } from './provider.js';
import { householdRuntimeDefaults } from './household-runtime.js';
import { getMessaging } from 'firebase-admin/messaging';
import { firebaseSignalSender } from './notification-outbox.js';

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error('Missing setting: ' + key);
  return value;
}

function boundedInteger(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^[0-9]+$/.test(raw) || value < min || value > max) throw new Error('Invalid ' + key);
  return value;
}

export function getRuntime(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.NOTIFY_MODE;
  if (mode !== 'local' && mode !== 'target') throw new Error('NOTIFY_MODE must be local or target');
  const host = env.NOTIFY_HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('API requires a loopback bind address');
  const port = Number(env.NOTIFY_PORT ?? '3443');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid NOTIFY_PORT');
  const origin = new URL(required(env, 'NOTIFY_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.origin !== env.NOTIFY_ORIGIN) throw new Error('NOTIFY_ORIGIN must be one HTTPS origin');
  const path = resolve(required(env, 'NOTIFY_DATABASE_PATH'));
  const householdConfig = {
    inviteIpPerMinute: boundedInteger(env, 'NOTIFY_INVITE_IP_PER_MINUTE', householdRuntimeDefaults.inviteIpPerMinute, 1, 1000),
    inviteIdentityPerMinute: boundedInteger(env, 'NOTIFY_INVITE_IDENTITY_PER_MINUTE', householdRuntimeDefaults.inviteIdentityPerMinute, 1, 1000),
    administrationPerMinute: boundedInteger(env, 'NOTIFY_ADMIN_PER_MINUTE', householdRuntimeDefaults.administrationPerMinute, 1, 1000),
    cleanupIntervalMs: boundedInteger(env, 'NOTIFY_INVITE_CLEANUP_MS', householdRuntimeDefaults.cleanupIntervalMs, 1000, 3_600_000),
  };
  const deleteJournalPath = resolve(env.NOTIFY_DELETE_JOURNAL_PATH ?? path + '.delete.sqlite');
  if (deleteJournalPath === path) throw new Error('Delete journal path must differ from the operating database');
  const installationGeneration = env.NOTIFY_INSTALLATION_GENERATION;
  if (installationGeneration !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(installationGeneration)) {
    throw new Error('Invalid NOTIFY_INSTALLATION_GENERATION');
  }
  const common = { host, port, origin: origin.origin, path, deleteJournalPath, householdConfig, installationGeneration, trustedProxy: mode === 'target' };
  if (mode === 'local') {
    if (env.NOTIFY_SYNTHETIC_AUTH !== '1' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
      throw new Error('Local synthetic mode requires explicit opt-in and a loopback HTTPS origin');
    }
    const key = required(env, 'NOTIFY_SYNTHETIC_KEY');
    if (key.length < 32) throw new Error('Local synthetic key must have at least 32 characters');
    const provider = syntheticProvider(key);
    const tls = {
      key: readFileSync(required(env, 'NOTIFY_TLS_KEY_FILE')),
      cert: readFileSync(required(env, 'NOTIFY_TLS_CERT_FILE')),
    };
    return { ...common, provider, tls, localSignIn: provider.mint };
  }
  if (env.NOTIFY_SYNTHETIC_AUTH || env.NOTIFY_SYNTHETIC_KEY || env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Synthetic or emulated authentication is forbidden in target mode');
  }
  const verificationPolicy = {
    timeoutMs: boundedInteger(env, 'NOTIFY_AUTH_VERIFY_TIMEOUT_MS', defaultVerificationPolicy.timeoutMs, 100, 10_000),
    retries: boundedInteger(env, 'NOTIFY_AUTH_VERIFY_RETRIES', defaultVerificationPolicy.retries, 0, 2),
  };
  const projectId = required(env, 'FIREBASE_PROJECT_ID');
  const credentials = required(env, 'GOOGLE_APPLICATION_CREDENTIALS');
  if (!existsSync(credentials)) throw new Error('Firebase credential file not available');
  const googleClientId = required(env, 'GOOGLE_CLIENT_ID');
  const firebaseConfig = {
    projectId, apiKey: required(env, 'FIREBASE_WEB_API_KEY'), authDomain: required(env, 'FIREBASE_WEB_AUTH_DOMAIN'),
  };
  const encodedKey = env.NOTIFY_INSTALLATION_TOKEN_KEY;
  const installationTokenKey = encodedKey && /^[A-Za-z0-9_-]{43}$/.test(encodedKey) ? Buffer.from(encodedKey, 'base64url') : undefined;
  if (encodedKey !== undefined && installationTokenKey?.toString('base64url') !== encodedKey) {
    throw new Error('NOTIFY_INSTALLATION_TOKEN_KEY must encode 32 bytes as unpadded base64url');
  }
  const provider = realProvider(projectId, googleClientId, verificationPolicy);
  const installationSignalSender = installationTokenKey ? firebaseSignalSender(getMessaging()) : undefined;
  return { ...common, provider, googleClientId, firebaseConfig, installationTokenKey, installationSignalSender };
}
