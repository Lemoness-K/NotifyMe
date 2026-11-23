import { randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DeleteJournal, type JournalEntry } from '../delete-journal.js';
import { revisePlans } from '../installation-plans.js';
import { openStore } from '../storage.js';
import { appendChange, preserveDeletedCreateKeys } from '../work-storage.js';
import { acquireOwnership, bindGeneration, type Activation } from './activation.js';
import { sameHead, samePoint, type JournalAuthority } from './authority.js';
import { backupExpiresAt, inspectSnapshot, type Backups } from './backup.js';
import { hashFile, syncDirectory } from './files.js';

function settledAfter(rows: JournalEntry[], cutoff: number) {
  const requests = new Map<string, JournalEntry>();
  const committed: JournalEntry[] = [];
  for (const row of rows) {
    if (row.position <= cutoff) continue;
    if (row.state === 'REQUESTED') {
      if (requests.has(row.requestId) || row.revision !== null) throw new Error('RECOVERY_JOURNAL_INVALID');
      requests.set(row.requestId, row);
      continue;
    }
    const request = requests.get(row.requestId);
    if (!request || request.householdId !== row.householdId || request.reminderId !== row.reminderId ||
        request.digest !== row.digest || (row.state !== 'COMMITTED' && row.state !== 'ABORTED') ||
        (row.state === 'COMMITTED') !== Number.isSafeInteger(row.revision)) throw new Error('RECOVERY_JOURNAL_INVALID');
    requests.delete(row.requestId);
    if (row.state === 'COMMITTED') committed.push(row);
  }
  if (requests.size) throw new Error('DELETE_EVIDENCE_PENDING');
  return committed;
}

async function prepareCandidate(image: string, entries: JournalEntry[], journal: DeleteJournal, history: ReturnType<DeleteJournal['history']>) {
  const database = await openStore(image, { migrate: true });
  try {
    for (const entry of entries) {
      await database.$transaction(async (tx) => {
        const { reminderId, householdId, requestId, revision } = entry;
        const target = await tx.reminder.findUnique({ where: { id: reminderId } });
        if (target && target.householdId !== householdId) throw new Error('RECOVERY_TARGET_SCOPE_MISMATCH');
        const recorded = await tx.deletionCommit.findUnique({ where: { requestId } });
        if (recorded && (recorded.householdId !== householdId || recorded.reminderId !== reminderId ||
            recorded.revision !== revision || recorded.inputDigest !== entry.digest)) throw new Error('RECOVERY_COMMIT_MISMATCH');
        if (target) {
          const occurrences = await tx.occurrence.findMany({ where: { reminderId }, select: { id: true } });
          await tx.locationEvent.deleteMany({ where: { occurrenceId: { in: occurrences.map(({ id }) => id) }, scope: { householdId } } });
          await preserveDeletedCreateKeys(tx, householdId, reminderId);
          await appendChange(tx, householdId, reminderId, 'DELETE', new Date(entry.at));
          await tx.reminder.delete({ where: { id: reminderId } });
        }
        const affected = await tx.installationScope.findMany({ where: { householdId, state: { not: 'REVOKED' }, OR: [
          { plans: { some: { reminderId } } }, { exclusions: { some: { reminderId } } },
        ] } });
        await tx.devicePlan.deleteMany({ where: { reminderId, scope: { householdId } } });
        await tx.locationExclusion.deleteMany({ where: { reminderId, scope: { householdId } } });
        for (const scope of affected) await revisePlans(tx, scope, new Date(entry.at), 'bootstrap');
        if (!recorded) await tx.deletionCommit.create({ data: { requestId, reminderId, householdId, revision: revision!,
          committedAt: new Date(entry.at), inputDigest: entry.digest } });
      });
    }
    await database.$transaction(async (tx) => {
      // Treat every restored session-bound installation as logged out until registration.
      await tx.installation.updateMany({ where: { sessionDigest: { not: null } },
        data: { active: false, tokenCiphertext: null } });
      await tx.session.deleteMany();
      await tx.loginChallenge.deleteMany();
    });
    // Verify existing authorization joins without opening a listener or invoking a provider.
    await database.membership.findFirst({ where: { active: true }, include: { user: true, household: true } });
    await database.reminder.count();
    await journal.assertDatabase(database, history);
  } finally { await database.$disconnect(); }
}

export async function restoreBackup(options: {
  activation: Activation; archives: Backups; authority: JournalAuthority; state: string; journalPath: string; id: string;
  clock?: () => Date;
}) {
  const release = acquireOwnership(options.state);
  const clock = options.clock ?? (() => new Date());
  let directory: string | undefined;
  let journal: DeleteJournal | undefined;
  let releaseArchives: (() => void) | undefined;
  try {
    releaseArchives = options.archives.acquireArchiveLock();
    options.activation.block();
    journal = DeleteJournal.openRecovery(options.journalPath, options.authority);
    const item = options.archives.select(options.id, clock());
    const expiresAt = backupExpiresAt(item);
    const history = journal.history();
    const cutoff = history.points.get(item.cutoff.position);
    if (journal.lineage !== item.lineage || !cutoff || !samePoint(cutoff, item.cutoff)) throw new Error('RECOVERY_CUTOFF_MISMATCH');
    const committed = settledAfter(history.rows, cutoff.position);
    for (const name of readdirSync(options.state)) {
      if (/^\.restore-job-[A-Za-z0-9]{6}$/.test(name)) rmSync(join(options.state, name), { recursive: true, force: true });
    }
    directory = mkdtempSync(join(options.state, '.restore-job-'));
    const image = join(directory, 'candidate.sqlite');
    await options.archives.decrypt(item, image);
    releaseArchives();
    releaseArchives = undefined;
    if (await hashFile(image) !== item.digest || inspectSnapshot(image) !== item.schema) throw new Error('RECOVERY_FINGERPRINT_MISMATCH');
    await prepareCandidate(image, committed, journal, history);
    inspectSnapshot(image, committed);
    const epoch = randomUUID();
    bindGeneration(image, epoch);
    const digest = await hashFile(image);
    const newest = journal.history().head;
    if (!sameHead(newest, history.head)) throw new Error('RECOVERY_BOUNDARY_CHANGED');
    if (!(clock().getTime() < expiresAt)) throw new Error('BACKUP_NOT_SELECTABLE');
    const database = join(options.state, 'recovered-' + epoch + '.sqlite');
    renameSync(image, database);
    chmodSync(database, 0o600);
    syncDirectory(options.state);
    options.activation.verify(database, epoch, newest, digest, expiresAt);
    return { database, epoch };
  } finally {
    try {
      releaseArchives?.();
      journal?.close();
      if (directory) rmSync(directory, { recursive: true, force: true });
    } finally { release(); }
  }
}
