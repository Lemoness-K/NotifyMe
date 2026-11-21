import { resolve, join, relative, isAbsolute } from 'node:path';
import { realpathSync, statSync } from 'node:fs';
import { JournalAuthority } from './authority.js';
import { Backups } from './backup.js';
import { readKey } from './files.js';

const required = ['STATE_DIRECTORY', 'ARCHIVES', 'AUTHORITY_MOUNT', 'VOLUME_ID', 'KEY_FILE', 'AUTHORITY_KEY_FILE'] as const;

function contained(outer: string, inner: string) {
  const remainder = relative(outer, inner);
  return remainder === '' || (!remainder.startsWith('../') && remainder !== '..' && !isAbsolute(remainder));
}

function directory(value: string) {
  const absolute = resolve(value);
  if (realpathSync(absolute) !== absolute) throw new Error('OPERATIONS_STORAGE_INVALID');
  const info = statSync(absolute);
  if (!info.isDirectory() || (info.mode & 0o077)) throw new Error('OPERATIONS_STORAGE_INVALID');
  return absolute;
}

export function localOperationsSettings(env: NodeJS.ProcessEnv = process.env) {
  if (!env.NOTIFY_OPS_STATE_DIRECTORY) throw new Error('OPERATIONS_CONFIG_INCOMPLETE');
  const state = directory(env.NOTIFY_OPS_STATE_DIRECTORY);
  const option = (name: string) => {
    const value = env['NOTIFY_OPS_' + name] ?? '0';
    if (value !== '0' && value !== '1') throw new Error('OPERATIONS_SETTING_INVALID');
    return value === '1';
  };
  const timeZone = env.NOTIFY_OPS_TIME_ZONE ?? 'Asia/Seoul';
  new Intl.DateTimeFormat('en', { timeZone });
  return { state, socket: join(state, 'operations.sock'), timeZone, weekly: option('WEEKLY'), incidents: option('INCIDENTS') };
}

export function operationsSettings(env: NodeJS.ProcessEnv = process.env) {
  if (!Object.keys(env).some((name) => name.startsWith('NOTIFY_OPS_'))) return undefined;
  const options = Object.fromEntries(required.map((name) => {
    const value = env['NOTIFY_OPS_' + name];
    if (!value) throw new Error('OPERATIONS_CONFIG_INCOMPLETE');
    return [name, value];
  })) as Record<typeof required[number], string>;
  const local = localOperationsSettings(env);
  const { state } = local;
  const archives = directory(options.ARCHIVES);
  const media = directory(options.AUTHORITY_MOUNT);
  const keyFile = realpathSync(options.KEY_FILE);
  const authorityKeyFile = realpathSync(options.AUTHORITY_KEY_FILE);
  if ([[state, archives], [state, media], [archives, media]].some(([a, b]) => contained(a, b) || contained(b, a)) ||
      keyFile === authorityKeyFile || [keyFile, authorityKeyFile].some((file) => contained(archives, file) || contained(media, file))) {
    throw new Error('OPERATIONS_STORAGE_OVERLAP');
  }
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(options.VOLUME_ID)) throw new Error('OPERATIONS_MEDIA_INVALID');
  const synthetic = env.NOTIFY_MODE === 'local' && env.NOTIFY_SYNTHETIC_AUTH === '1';
  const key = readKey(keyFile);
  const authorityKey = readKey(authorityKeyFile);
  if (key.equals(authorityKey)) throw new Error('OPERATIONS_KEY_OVERLAP');
  const authority = new JournalAuthority({ root: media, volumeId: options.VOLUME_ID, key: authorityKey,
    mounted: synthetic ? () => true : (device) => device !== statSync(resolve(media, '..')).dev &&
      device !== statSync(state).dev && device !== statSync(archives).dev });
  return { ...local, archives: new Backups(archives, state, key), authority };
}
