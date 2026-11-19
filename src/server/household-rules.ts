import type { FirebaseIdentity } from './auth.js';
import { AppError } from './errors.js';
import type { InviteIdentity, Role } from './households.js';

export const invalidField = (field: string) => new AppError(422, 'INVALID_FIELD', { field });
export function record(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalidField('body');
  return value as Record<string, unknown>;
}

export function optionalId(value: unknown, field: string) {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw invalidField(field);
  return value;
}

export function normalizeInvitationEmail(value: unknown): string {
  if (typeof value !== 'string') throw invalidField('email');
  const email = value.trim().toLowerCase();
  const [name, domain] = email.split('@');
  if (email.length > 254 || !name || name.length > 64 || name.includes('..') ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(name) || name.startsWith('.') || name.endsWith('.') ||
      !domain || email !== name + '@' + domain ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) {
    throw invalidField('email');
  }
  return email;
}

export function invitationIdentity(value: FirebaseIdentity): InviteIdentity {
  if (value.emailVerified !== true) throw new AppError(422, 'INVITATION_INVALID');
  try {
    return {
      issuer: value.issuer, subject: value.subject, email: normalizeInvitationEmail(value.email), displayName: value.displayName,
    };
  } catch {
    throw new AppError(422, 'INVITATION_INVALID');
  }
}

export function parseInvitationCode(value: unknown): string {
  if (value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' &&
      /^[A-Za-z0-9_-]{32}$/.test(value.code)) return value.code;
  throw new AppError(422, 'INVITATION_INVALID');
}

export function validateRevision(value: unknown, field = 'revision'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= 2_147_483_647) {
    throw invalidField(field);
  }
  return value;
}

export function parseRevision(value: string | undefined) {
  const match = value?.match(/^(?:"([0-9]+)"|([0-9]+))$/);
  if (!match) throw invalidField('If-Match');
  return validateRevision(Number(match[1] ?? match[2]), 'If-Match');
}

export function prepareRoleChange(value: unknown) {
  const body = record(value);
  if (body.role !== 'ADMIN' && body.role !== 'MEMBER') throw invalidField('role');
  return {
    role: body.role as Role, revision: validateRevision(body.revision),
    successorAdminId: optionalId(body.successorAdminId, 'successorAdminId'),
  };
}
