import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { openStore } from '../../src/server/storage.js';
import { DeleteJournal } from '../../src/server/delete-journal.js';
import { acquireOwnership, Activation } from '../../src/server/operations/activation.js';
import { JournalAuthority } from '../../src/server/operations/authority.js';
import { Backups } from '../../src/server/operations/backup.js';
import { restoreBackup } from '../../src/server/operations/restore.js';
import { startManagedRuntime } from '../../src/server/operations/runtime.js';
import { prepareNewInstallation, SetupAuthority } from '../../src/server/operations/setup-authority.js';
import { WorkService } from '../../src/server/work-service.js';
import { basicDatabase, mediaToken, operationsFixture, testKey } from './fixture.js';

let fixture: ReturnType<typeof operationsFixture>;
beforeEach(() => { fixture = operationsFixture(); });
afterEach(() => { fixture.close(); });

async function prepared() {
  const grant = await prepareNewInstallation(fixture.state, fixture.database, async () => {});
  const db = await openStore(fixture.database);
  const authority = new SetupAuthority(fixture.state, fixture.database, grant.activationEpoch);
  return { authority, grant, db };
}

describe('installation setup authority', () => {
  it('authorizes the explicitly prepared new database across a clean restart', async () => {
    const { authority, grant, db } = await prepared();
    try {
      expect(await authority.current(db)).toMatchObject({ setupCycle: grant.setupCycle, phase: 'OPEN' });
      expect(await new SetupAuthority(fixture.state, fixture.database, grant.activationEpoch).current(db))
        .toMatchObject({ setupCycle: grant.setupCycle });
    } finally { await db.$disconnect(); }
  });

  it('rejects an existing empty file and refuses a second installation in the same state directory', async () => {
    const old = join(fixture.state, 'old.sqlite');
    basicDatabase(old);
    await expect(prepareNewInstallation(fixture.state, old, async () => {})).rejects.toThrow();
    const { db } = await prepared();
    try {
      await expect(prepareNewInstallation(fixture.state, join(fixture.state, 'other.sqlite'), async () => {})).rejects.toThrow();
    } finally { await db.$disconnect(); }
  });

  it('does not authorize any missing, replaced or wrong-epoch database', async () => {
    const { authority, grant, db } = await prepared();
    try {
      expect(await new SetupAuthority(fixture.state, fixture.database, 'different').current(db)).toBeUndefined();
      const moved = fixture.database + '.old';
      renameSync(fixture.database, moved);
      await expect(authority.current(db)).rejects.toThrow();
      copyFileSync(moved, fixture.database);
      expect(await authority.current(db)).toBeUndefined();
      expect(grant.phase).toBe('OPEN');
    } finally { await db.$disconnect(); }
  });

  it('keeps a committing grant closed on restart when no matching completion can be found', async () => {
    const { authority, grant, db } = await prepared();
    try { authority.beginConfirmation(grant, 'candidate'); }
    finally { await db.$disconnect(); }
    const reopened = await openStore(fixture.database);
    try {
      const restarted = new SetupAuthority(fixture.state, fixture.database, grant.activationEpoch);
      await restarted.recover(reopened);
      expect(await reopened.setupCompletion.count()).toBe(0);
      expect(await restarted.current(reopened)).toMatchObject({ phase: 'COMMITTING' });
    } finally { await reopened.$disconnect(); }
  });

  it('seals a matching committed receipt on restart even if the household was closed', async () => {
    const { authority, grant, db } = await prepared();
    try {
      authority.beginConfirmation(grant, 'candidate');
      await db.setupCompletion.create({ data: { setupCycle: grant.setupCycle, candidateId: 'candidate',
        householdId: 'closed-household', userId: 'user', committedAt: new Date(), replayUntil: new Date() } });
    } finally { await db.$disconnect(); }
    const reopened = await openStore(fixture.database);
    try {
      const restarted = new SetupAuthority(fixture.state, fixture.database, grant.activationEpoch);
      await restarted.recover(reopened);
      expect(await reopened.setupCompletion.count()).toBe(1);
      expect(await restarted.current(reopened)).toMatchObject({ phase: 'SEALED' });
    } finally { await reopened.$disconnect(); }
  });

  it('closes eligibility before a restore and ignores the old database grant', async () => {
    const { authority, db } = await prepared();
    try {
      SetupAuthority.closeForRestore(fixture.state);
      new Activation(fixture.state).block();
      expect(await authority.current(db)).toBeUndefined();
    } finally { await db.$disconnect(); }
  });

  it('restores an actual encrypted pre-setup snapshot without reviving its candidate', async () => {
    const journalPath = join(fixture.state, 'journal.sqlite');
    const journalAuthority = new JournalAuthority({ root: fixture.volume, volumeId: mediaToken, key: testKey, mounted: () => true });
    const backups = new Backups(fixture.archives, fixture.state, Buffer.alloc(32, 23));
    const grant = await prepareNewInstallation(fixture.state, fixture.database, async (db) => {
      const journal = await DeleteJournal.open(db, journalPath);
      try { await journal.initializeAuthority(journalAuthority, db); backups.initialize(); }
      finally { journal.close(); }
    });
    const db = await openStore(fixture.database);
    const journal = await DeleteJournal.open(db, journalPath, journalAuthority);
    const capturedAt = new Date('2032-01-01T00:00:00Z');
    const restoreTime = () => new Date('2032-01-01T00:00:01Z');
    let id: string;
    try {
      await db.setupCandidate.create({ data: { candidateId: 'candidate', setupCycle: grant.setupCycle,
        verifiedIssuer: 'issuer', verifiedSubject: 'subject', verifiedGoogleSubject: 'google',
        credentialDigest: 'd'.repeat(64),
        authenticationTime: 1, expiresAt: new Date('2032-01-01T00:10:00Z') } });
      const snapshot = await backups.capture(fixture.database, new WorkService(db, undefined, undefined, journal), capturedAt);
      id = snapshot.id;
    } finally { journal.close(); await db.$disconnect(); }
    const activation = new Activation(fixture.state);
    const restored = await restoreBackup({ activation, archives: backups, authority: journalAuthority, journalPath,
      state: fixture.state, id, clock: restoreTime });
    const stop = await startManagedRuntime(fixture.state, async (_active, gate) => {
      gate.publish();
      return async () => undefined;
    }, { authority: journalAuthority, journalPath, clock: restoreTime });
    try {
      const recovered = await openStore(restored.database);
      try {
        expect(await recovered.household.count()).toBe(0);
        expect(await recovered.setupCandidate.count()).toBe(0);
        expect(await new SetupAuthority(fixture.state, restored.database, restored.epoch).current(recovered)).toBeUndefined();
      } finally { await recovered.$disconnect(); }
    } finally { await stop(); }
  });

  it('uses the same exclusive ownership as managed serving and restores', async () => {
    const release = acquireOwnership(fixture.state);
    try {
      await expect(prepareNewInstallation(fixture.state, fixture.database, async () => {})).rejects.toThrow('OPERATIONS_BUSY');
    } finally { release(); }
  });
});
