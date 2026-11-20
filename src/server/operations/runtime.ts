import { DeleteJournal } from '../delete-journal.js';
import { openStore } from '../storage.js';
import { Activation, acquireOwnership } from './activation.js';
import { sameHead, type JournalAuthority } from './authority.js';

export type ServingGate = { check: () => void; publish: () => void };

export async function startManagedRuntime(state: string,
  start: (active: { database: string; epoch: string }, gate: ServingGate) => Promise<() => Promise<void>>,
  { authority, journalPath, clock }: { authority: JournalAuthority; journalPath: string; clock?: () => Date }) {
  const release = acquireOwnership(state);
  try {
    const { record, check, publish } = await new Activation(state).prepare(authority, async (record) => {
      if (journalPath === record.database) throw new Error('OPERATIONS_JOURNAL_INVALID');
      const db = await openStore(record.database);
      try {
        if (record.phase === 'VERIFIED') {
          const journal = DeleteJournal.openRecovery(journalPath, authority);
          try {
            const history = journal.history();
            if (!sameHead(record.head, history.head)) throw new Error('RECOVERY_BOUNDARY_CHANGED');
            await journal.assertDatabase(db, history);
          } finally { journal.close(); }
        } else {
          (await DeleteJournal.open(db, journalPath, authority)).close();
        }
      } finally { await db.$disconnect(); }
    }, clock);
    const stop = await start(record, { check, publish });
    return async () => { try { await stop(); } finally { release(); } };
  } catch (error) { release(); throw error; }
}
