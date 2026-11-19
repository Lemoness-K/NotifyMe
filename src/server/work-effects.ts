import type { Prisma } from './generated/client.js';
import type { HouseholdEffects } from './households.js';
import { loadWork } from './work-service.js';
import { currentOccurrence, relations } from './repository.js';
import { appendChange, updateOccurrence, workAudit } from './work-storage.js';
import { synchronizePlans, type InstallationPlanParticipant } from './work-scheduling.js';

type Tx = Prisma.TransactionClient;

export function workEffects(planPort?: InstallationPlanParticipant, additional?: HouseholdEffects): HouseholdEffects {
  return {
    async removeTargets(tx, householdId, userId, now) {
      const affected = await tx.reminder.findMany({
        where: { householdId, OR: [
          { assignments: { some: { userId, endedAt: now } } },
          { verifierUserId: userId },
          { occurrences: { some: { completions: { some: { verifierUserId: userId, state: 'OPEN' } } } } },
        ] }, include: relations,
      });
      for (const reminder of affected) {
        const lostVerification = reminder.verifierUserId === userId;
        const row = await tx.reminder.update({ where: { id: reminder.id }, data: {
          revision: { increment: 1 }, verifierUserId: lostVerification ? null : undefined,
          pausedAt: reminder.assignments.length ? undefined : (reminder.pausedAt ?? now),
        } });
        for (const occurrence of reminder.occurrences) {
          const pending = occurrence.completions[0];
          if (!pending || pending.verifierUserId !== userId) continue;
          await tx.completion.update({ where: { id: pending.id }, data: {
            state: 'VERIFIER_REVOKED', respondedAt: now, reason: 'MEMBERSHIP_REVOKED',
          } });
          await updateOccurrence(tx, occurrence.id, occurrence.revision, { state: 'PENDING', stateAt: now, reason: 'VERIFIER_REVOKED' });
          await workAudit(tx, householdId, row.id, 'SYSTEM', 'VERIFIER_REVOKED', now, occurrence.id);
        }
        await workAudit(tx, householdId, row.id, 'SYSTEM', 'ACCESS_REVOKED', now);
        const changed = await appendChange(tx, householdId, row.id, 'UPSERT', now);
        const refreshed = await loadWork(tx, householdId, row.id);
        const current = currentOccurrence(refreshed);
        if (current && refreshed.lifecycle === 'ACTIVE') {
          await synchronizePlans(tx, planPort, householdId, [current], [], [userId], [], refreshed.trigger, changed.revision);
        }
      }
      await additional?.removeTargets?.(tx, householdId, userId, now);
    },
    async changeRadius(tx, householdId, actorId, bounds, now) {
      const changes: { reminderId: string; occurrenceId?: string; from: number; to: number }[] = [];
      const items = await tx.trigger.findMany({ where: {
        kind: 'LOCATION', reminder: { householdId }, OR: [{ radiusM: { lt: bounds.min } }, { radiusM: { gt: bounds.max } }],
      } });
      for (const trigger of items) {
        const radiusM = Math.max(bounds.min, Math.min(bounds.max, trigger.radiusM!));
        await tx.trigger.update({ where: { reminderId: trigger.reminderId }, data: { radiusM } });
        changes.push({ reminderId: trigger.reminderId, from: trigger.radiusM!, to: radiusM });
      }
      const overrides = await tx.occurrenceOverride.findMany({ where: {
        occurrence: { reminder: { householdId }, state: { in: ['PENDING', 'VERIFICATION_PENDING'] } },
        patch: { contains: '"kind":"LOCATION"' },
      }, include: { occurrence: { select: { reminderId: true } } } });
      for (const override of overrides) {
        const patch = JSON.parse(override.patch) as { trigger?: { kind?: string; radiusM?: number } };
        const from = patch.trigger?.radiusM;
        if (patch.trigger?.kind !== 'LOCATION' || from === undefined) continue;
        const to = Math.max(bounds.min, Math.min(bounds.max, from));
        if (from === to) continue;
        patch.trigger.radiusM = to;
        await tx.occurrenceOverride.update({ where: { occurrenceId: override.occurrenceId }, data: { patch: JSON.stringify(patch) } });
        await tx.occurrence.update({ where: { id: override.occurrenceId }, data: { revision: { increment: 1 } } });
        changes.push({ reminderId: override.occurrence.reminderId, occurrenceId: override.occurrenceId, from, to });
      }
      for (const change of changes) {
        await workAudit(tx, householdId, change.reminderId, actorId, 'RADIUS_ADJUSTED', now, change.occurrenceId,
          { from: change.from, to: change.to });
      }
      for (const reminderId of new Set(changes.map((change) => change.reminderId))) {
        await tx.reminder.update({ where: { id: reminderId }, data: { revision: { increment: 1 } } });
        const row = await loadWork(tx, householdId, reminderId);
        const entry = await appendChange(tx, householdId, row.id, 'UPSERT', now);
        const current = currentOccurrence(row);
        if (current && row.lifecycle === 'ACTIVE' && !row.pausedAt) {
          const people = row.assignments.map((assignment) => assignment.userId);
          await synchronizePlans(tx, planPort, householdId, [current], [current], people, people, row.trigger, entry.revision);
        }
      }
      await additional?.changeRadius?.(tx, householdId, actorId, bounds, now);
    },
  };
}
