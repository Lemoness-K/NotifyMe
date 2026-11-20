import { createHash } from 'node:crypto';
import type { JournalEntry } from '../delete-journal.js';
import { AppError } from '../errors.js';
import type { PrismaClient } from '../generated/client.js';

type Proof = {
  requestId: string; householdId: string; reminderId: string; revision: number; inputDigest: string | null;
  present: number | bigint;
};

export function readDeletionProofs(db: PrismaClient) {
  return db.$queryRaw<Proof[]>`
    SELECT c.requestId, c.householdId, c.reminderId, c.revision, c.inputDigest,
      EXISTS (SELECT 1 FROM Reminder r WHERE r.id = c.reminderId) AS present
    FROM DeletionCommit c ORDER BY c.requestId COLLATE BINARY
  `;
}

export function databaseFloor(rows: readonly JournalEntry[], proofs: readonly Proof[], legacyFloor?: number) {
  const retained = new Map(rows.map((row) => [row.requestId, row]));
  const saved = new Map(proofs.map((proof) => [proof.requestId, proof]));
  const fail = () => { throw new AppError(503, 'RECOVERY_DATABASE_PROOF_MISMATCH'); };
  for (const row of retained.values()) {
    const proof = saved.get(row.requestId);
    if (!proof) {
      if (row.state === 'COMMITTED') fail();
      continue;
    }
    if (row.state === 'ABORTED' || proof.householdId !== row.householdId || proof.reminderId !== row.reminderId ||
        (proof.inputDigest !== row.digest && !(legacyFloor !== undefined && proof.inputDigest === null)) ||
        (row.state === 'COMMITTED' && proof.revision !== row.revision)) fail();
  }
  const digest = createHash('sha256').update('notify-deletion-commit-set-v1\n');
  for (const { requestId, householdId, reminderId, revision, inputDigest, present } of proofs) {
    if (Number(present) !== 0) fail();
    if (!retained.has(requestId)) {
      if (legacyFloor === 0) fail();
      digest.update(JSON.stringify([requestId, householdId, reminderId, revision, inputDigest]) + '\n');
    }
  }
  return digest.digest('hex');
}
