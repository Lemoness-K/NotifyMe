import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultVerificationPolicy, realProvider, syntheticProvider } from './provider.js';

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
  const common = { host, port, origin: origin.origin, path };
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
  return { ...common, provider: realProvider(projectId, googleClientId, verificationPolicy), googleClientId, firebaseConfig };
}
