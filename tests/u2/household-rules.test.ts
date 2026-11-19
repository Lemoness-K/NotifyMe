import { describe, expect, it } from 'vitest';
import { invitationIdentity, normalizeInvitationEmail, parseInvitationCode, parseRevision, prepareRoleChange } from '../../src/server/household-rules.js';

const proof = { issuer: 'test-issuer', subject: 'subject', googleSubject: 'google-subject', authTime: 42 };

describe('household request rules', () => {
  it('normalizes verified addresses without collapsing dots or aliases', () => {
    expect(normalizeInvitationEmail('  Example+alias@Example.Test  ')).toBe('example+alias@example.test');
    expect(normalizeInvitationEmail('ex.ample@example.test')).not.toBe(normalizeInvitationEmail('example@example.test'));
  });
  it.each([undefined, '', 'x@example', 'a..b@example.test', 'a b@example.test', 'a@example.test\nb@example.test'])(
    'rejects invalid target email %s',
    (value) => expect(() => normalizeInvitationEmail(value)).toThrow('INVALID_FIELD'),
  );
  it('requires a verified email and retains only the identity fields used for acceptance', () => {
    expect(invitationIdentity({ ...proof, email: 'Case@Example.Test', emailVerified: true })).toEqual({
      issuer: 'test-issuer', subject: 'subject', email: 'case@example.test', displayName: undefined,
    });
    expect(() => invitationIdentity({ ...proof, email: 'case@example.test', emailVerified: false })).toThrow('INVITATION_INVALID');
    expect(() => invitationIdentity({ ...proof, emailVerified: true })).toThrow('INVITATION_INVALID');
  });
  it('only accepts the code shape produced by securely minted invitations', () => {
    expect(parseInvitationCode({ code: 'a'.repeat(32) })).toBe('a'.repeat(32));
    expect(() => parseInvitationCode({ code: 'a'.repeat(33) })).toThrow('INVITATION_INVALID');
    expect(() => parseInvitationCode({ code: '?not-a-code' })).toThrow('INVITATION_INVALID');
  });
  it('uses exact version tags without accepting a wildcard or a weak tag', () => {
    expect(parseRevision('"16"')).toBe(16);
    expect(parseRevision('0')).toBe(0);
    expect(() => parseRevision('*')).toThrow('INVALID_FIELD');
    expect(() => parseRevision('W/"1"')).toThrow('INVALID_FIELD');
    expect(() => parseRevision('-1')).toThrow('INVALID_FIELD');
  });
  it('keeps the intended active household successor in the normalized role command', () => {
    expect(prepareRoleChange({ revision: 0, role: 'MEMBER', successorAdminId: 'next-admin' })).toMatchObject({
      revision: 0, role: 'MEMBER', successorAdminId: 'next-admin',
    });
    expect(() => prepareRoleChange({ revision: 0, role: 'OWNER' })).toThrow('INVALID_FIELD');
    expect(() => prepareRoleChange({ revision: 0, role: 'ADMIN', successorAdminId: '' })).toThrow('INVALID_FIELD');
  });
});
