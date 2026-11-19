import { AppError } from './errors.js';

export const occurrenceActions = ['COMPLETE', 'UNDO_COMPLETE', 'SKIP', 'APPROVE', 'REJECT', 'WITHDRAW_VERIFICATION'] as const;
export type OccurrenceAction = typeof occurrenceActions[number];

interface ActionContext {
  state: string;
  active: boolean;
  verificationEnabled: boolean;
  assigneeIds: string[];
  verifierUserId: string | null;
  currentRecurring: boolean;
  due: boolean;
  submittedBy?: string;
  pendingVerifierId?: string | null;
}

export function validateVerifier(verifier: string | null, assigneeIds: string[], active: Set<string>) {
  if (!verifier || !active.has(verifier) || assigneeIds.includes(verifier)) {
    throw new AppError(422, 'INVALID_VERIFIER', { field: 'verification.verifierId' });
  }
  return verifier;
}

export function authorizedOccurrenceActions(context: ActionContext, actorId: string): OccurrenceAction[] {
  if (!context.active) return [];
  if (context.state === 'VERIFICATION_PENDING') {
    if (context.pendingVerifierId === actorId && context.submittedBy !== actorId) return ['APPROVE', 'REJECT'];
    return context.submittedBy === actorId ? ['WITHDRAW_VERIFICATION'] : [];
  }
  if (context.state === 'COMPLETED' && !context.verificationEnabled) return ['UNDO_COMPLETE'];
  if (context.state !== 'PENDING') return [];
  const canComplete = !context.verificationEnabled || (!!context.verifierUserId && context.verifierUserId !== actorId &&
    (!context.assigneeIds.length || context.assigneeIds.includes(actorId)));
  const actions: OccurrenceAction[] = canComplete ? ['COMPLETE'] : [];
  if (context.currentRecurring && context.due) actions.push('SKIP');
  return actions;
}
