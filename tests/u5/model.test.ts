import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Activation, acquireOwnership, bindGeneration } from '../../src/server/operations/activation.js';
import { JournalAuthority } from '../../src/server/operations/authority.js';
import { hashFile } from '../../src/server/operations/files.js';
import { basicDatabase, mediaToken, operationsFixture, testKey } from './fixture.js';

let fixture: ReturnType<typeof operationsFixture>;
const proof = 'a'.repeat(64);
beforeEach(() => { fixture = operationsFixture(); basicDatabase(fixture.database); });
afterEach(() => fixture.close());

function authority(mounted = () => true) {
  return new JournalAuthority({ root: fixture.volume, volumeId: mediaToken, key: testKey, mounted });
}

it('does not self-initialize a missing head and rejects a copied volume marker on an unmounted path', () => {
  expect(() => authority().read()).toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
  expect(() => authority(() => false).baseline('test-lineage', 0, proof)).toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
});

it('persists one authenticated head and rejects contents changed without authentication', () => {
  const source = authority();
  const initial = source.baseline('test-lineage', 5, proof);
  expect(source.read()).toEqual(initial);
  expect(() => source.baseline('test-lineage', 5, proof)).toThrow();
  const path = join(fixture.volume, 'delete-head.json');
  writeFileSync(path, JSON.stringify({ ...initial, lineage: 'other-lineage' }), { mode: 0o600 });
  expect(() => source.read()).toThrow('RECOVERY_AUTHORITY_UNAVAILABLE');
});

it('holds portable SQLite process ownership independently of the active data path', () => {
  const close = acquireOwnership(fixture.state);
  try { expect(() => acquireOwnership(fixture.state)).toThrow('OPERATIONS_BUSY'); }
  finally { close(); }
  acquireOwnership(fixture.state)();
});

it('validates a candidate fingerprint before first start and the activation generation after restart', async () => {
  const activation = new Activation(fixture.state);
  expect(() => activation.active()).toThrow('RECOVERY_NOT_ACTIVE');
  bindGeneration(fixture.database, 'generation-one');
  activation.initialize(fixture.database, 'generation-one');
  activation.block();
  expect(() => new Activation(fixture.state).active()).toThrow('RECOVERY_NOT_ACTIVE');
  const candidate = join(fixture.state, 'candidate.sqlite');
  basicDatabase(candidate);
  bindGeneration(candidate, 'generation-two');
  const source = authority();
  const point = source.baseline('test-lineage', 9, proof);
  const validate = async () => undefined;
  activation.verify(candidate, 'generation-two', point, await hashFile(candidate), Date.now() + 60_000);
  const gate = await new Activation(fixture.state).prepare(source, validate);
  expect(gate.record).toMatchObject({ database: candidate, epoch: 'generation-two' });
  gate.publish();
  renameSync(fixture.database, candidate);
  await expect(new Activation(fixture.state).prepare(source, validate)).rejects.toThrow('RECOVERY_GENERATION_MISMATCH');
});
