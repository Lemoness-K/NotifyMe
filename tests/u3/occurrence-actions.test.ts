import { describe, expect, it } from 'vitest';
import { authorizedOccurrenceActions, validateVerifier } from '../../src/server/occurrence-actions.js';

const pending = { state: 'PENDING', active: true, verificationEnabled: true, assigneeIds: ['person', 'other'],
  verifierUserId: 'verifier', currentRecurring: true, due: true };

describe('completion verification rules', () => {
  it('requires an active verifier who is distinct from every assignee', () => {
    expect(() => validateVerifier('other', ['person', 'other'], new Set(['person', 'other']))).toThrow('INVALID_VERIFIER');
    expect(() => validateVerifier('removed', ['person'], new Set(['person']))).toThrow('INVALID_VERIFIER');
    expect(validateVerifier('verifier', ['person', 'other'], new Set(['person', 'other', 'verifier']))).toBe('verifier');
  });

  it('allows a verification submit only for an assigned person', () => {
    expect(authorizedOccurrenceActions(pending, 'person')).toContain('COMPLETE');
    expect(authorizedOccurrenceActions(pending, 'verifier')).not.toContain('COMPLETE');
    expect(authorizedOccurrenceActions({ ...pending, verifierUserId: null }, 'person')).not.toContain('COMPLETE');
  });

  it('separates reviewer approval from submitter withdrawal', () => {
    const reviewing = { ...pending, state: 'VERIFICATION_PENDING', submittedBy: 'person', pendingVerifierId: 'verifier' };
    expect(authorizedOccurrenceActions(reviewing, 'verifier')).toEqual(['APPROVE', 'REJECT']);
    expect(authorizedOccurrenceActions(reviewing, 'person')).toEqual(['WITHDRAW_VERIFICATION']);
    expect(authorizedOccurrenceActions(reviewing, 'other')).toEqual([]);
  });

  it('accepts general completion by any member and prevents skipping early or archived work', () => {
    expect(authorizedOccurrenceActions({ ...pending, verificationEnabled: false, due: false }, 'other-member')).toEqual(['COMPLETE']);
    expect(authorizedOccurrenceActions({ ...pending, active: false }, 'person')).toEqual([]);
    expect(authorizedOccurrenceActions({ ...pending, state: 'COMPLETED', verificationEnabled: false }, 'other-member')).toEqual(['UNDO_COMPLETE']);
  });
});
