import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';
import { prismaCode, requireMember } from './repository.js';

type Transaction = Prisma.TransactionClient;
export type Role = 'ADMIN' | 'MEMBER';
export type WeeklyCalendarConvention = 'MONDAY_START' | 'SUNDAY_START' | 'ISO_8601';
export type Locale = 'ko-KR' | 'en-US';
export type Radius = { min: number; default: number; max: number };
export type HouseholdSettings = {
  revision: number;
  defaultTimeZone: string;
  radiusM: Radius;
  maxLocationDurationMin: number;
  weeklyCalendarConvention: WeeklyCalendarConvention;
};
export type UserSettings = { revision: number; locale?: Locale; timeZone?: string };
export type HouseholdSettingsPatch = Partial<Omit<HouseholdSettings, 'revision'>> & { revision: number };
export type Member = { userId: string; role: Role; revision: number; displayName?: string };
export type InviteIdentity = { issuer: string; subject: string; email: string; displayName?: string };
export const householdDefaults = {
  radiusM: { min: 50, default: 100, max: 500 },
  maxLocationDurationMin: 60,
  weeklyCalendarConvention: 'MONDAY_START',
} as const;
const inviteLifetime = 24 * 60 * 60 * 1_000;

export interface HouseholdEffects {
  beforeRemoveTargets?(tx: Transaction, householdId: string, userId: string, at: Date): Promise<void>;
  // U3/U4 attach their persistent targets to the existing transaction.
  removeTargets?(tx: Transaction, householdId: string, userId: string, at: Date): Promise<void>;
  changeRadius?(tx: Transaction, householdId: string, actorId: string, radius: Radius, at: Date): Promise<void>;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalidInvite = () => new AppError(422, 'INVITATION_INVALID');
const denied = () => new AppError(403, 'HOUSEHOLD_ACCESS_DENIED');
const stale = () => new AppError(409, 'STALE_REVISION');

function memberDto(row: { userId: string; role: string; revision: number; user?: { displayName: string | null } }): Member {
  return {
    userId: row.userId, role: row.role as Role, revision: row.revision,
    ...(row.user?.displayName ? { displayName: row.user.displayName } : {}),
  };
}

async function requireAdmin(tx: Transaction, householdId: string, actorId: string) {
  const member = await requireMember(tx, householdId, actorId);
  if (member.role !== 'ADMIN') throw denied();
  return member;
}

function scope(...parts: string[]) {
  return JSON.stringify(parts);
}

async function previous<T>(tx: Transaction, scope: string, key: string, input: unknown): Promise<T | undefined> {
  const row = await tx.householdCommandResult.findUnique({ where: { scope_key: { scope, key } } });
  if (!row) return;
  if (row.inputDigest !== digest(JSON.stringify([row.inputSalt, input]))) {
    throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
  }
  return JSON.parse(row.result) as T;
}

async function recordResult<T>(tx: Transaction, scope: string, key: string, input: unknown, result: T) {
  const inputSalt = randomBytes(16).toString('hex');
  await tx.householdCommandResult.create({
    data: { scope, key, inputSalt, inputDigest: digest(JSON.stringify([inputSalt, input])), result: JSON.stringify(result) },
  });
  return result;
}

function audit(tx: Transaction, householdId: string, actorId: string, action: string, subjectId: string, at: Date, details: object = {}) {
  return tx.householdAudit.create({ data: { householdId, actorId, action, subjectId, createdAt: at, details: JSON.stringify(details) } });
}

type PolicyRecord = { settingsRevision: number; defaultTimeZone: string; settings: {
  minRadiusM: number; defaultRadiusM: number; maxRadiusM: number;
  maxLocationDurationMin: number; weeklyCalendarConvention: string;
} | null };

function presentPolicy(row: PolicyRecord): HouseholdSettings {
  const s = row.settings;
  return {
    revision: row.settingsRevision,
    defaultTimeZone: row.defaultTimeZone,
    radiusM: s ? { min: s.minRadiusM, default: s.defaultRadiusM, max: s.maxRadiusM } : { ...householdDefaults.radiusM },
    maxLocationDurationMin: s?.maxLocationDurationMin ?? householdDefaults.maxLocationDurationMin,
    weeklyCalendarConvention: (s?.weeklyCalendarConvention ?? householdDefaults.weeklyCalendarConvention) as WeeklyCalendarConvention,
  };
}

function personalPreferences(row: { settingsRevision: number; timeZone: string | null; settings: { locale: string | null } | null }): UserSettings {
  const locale = row.settings?.locale;
  return {
    revision: row.settingsRevision,
    ...(locale === 'ko-KR' || locale === 'en-US' ? { locale } : {}),
    ...(row.timeZone === null ? {} : { timeZone: row.timeZone }),
  };
}

export class HouseholdRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly origin: string,
    private readonly clock: () => Date = () => new Date(),
    private readonly effects: HouseholdEffects = {},
  ) {}

  private async write<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(work);
      } catch (error) {
        if (!['P2002', 'P2034', 'P1008'].includes(prismaCode(error) ?? '')) throw error;
        if (attempt === 2) throw new AppError(503, 'STORAGE_UNAVAILABLE');
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 5));
      }
    }
  }

  createInvitation(householdId: string, actorId: string, key: string, email: string) {
    const requestScope = scope('CREATE_INVITATION', householdId, actorId);
    return this.write(async (tx) => {
      await requireAdmin(tx, householdId, actorId);
      const existing = await previous<{ invitationId: string; expiresAt: string }>(tx, requestScope, key, email);
      if (existing) throw new AppError(409, 'INVITATION_ALREADY_ISSUED', existing);
      const code = randomBytes(24).toString('base64url');
      const now = this.clock();
      const invite = await tx.invitation.create({
        data: {
          householdId, createdByUserId: actorId, targetEmail: email, tokenHash: digest(code),
          createdAt: now, expiresAt: new Date(now.getTime() + inviteLifetime),
        },
        select: { id: true, expiresAt: true },
      });
      const result = { invitationId: invite.id, expiresAt: invite.expiresAt.toISOString() };
      await recordResult(tx, requestScope, key, email, result);
      await audit(tx, householdId, actorId, 'INVITATION_ISSUED', invite.id, now);
      const url = new URL('/invite', this.origin);
      url.hash = code;
      return { ...result, inviteUrl: url.toString() };
    });
  }

  revokeInvitation(householdId: string, actorId: string, invitationId: string, key: string) {
    const requestScope = scope('REVOKE_INVITATION', householdId, actorId);
    return this.write(async (tx) => {
      await requireAdmin(tx, householdId, actorId);
      if (await previous(tx, requestScope, key, invitationId)) return;
      const now = this.clock();
      const updated = await tx.invitation.updateMany({
        where: { id: invitationId, householdId, revokedAt: null, consumedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, targetEmail: null },
      });
      if (updated.count !== 1) {
        const row = await tx.invitation.findFirst({ where: { id: invitationId, householdId }, select: { id: true } });
        if (!row) throw new AppError(404, 'INVITATION_NOT_FOUND');
        throw new AppError(409, 'INVITATION_INACTIVE');
      }
      await recordResult(tx, requestScope, key, invitationId, true);
      await audit(tx, householdId, actorId, 'INVITATION_REVOKED', invitationId, now);
    });
  }

  acceptInvitation(key: string, code: string, identity: InviteIdentity) {
    const tokenHash = digest(code);
    return this.write(async (tx) => {
      const invite = await tx.invitation.findUnique({ where: { tokenHash } });
      if (!invite) throw invalidInvite();
      const requestScope = scope('ACCEPT_INVITATION', invite.householdId, identity.issuer, identity.subject);
      const member = await previous<Member>(tx, requestScope, key, tokenHash);
      const externalKey = { issuer: identity.issuer, subject: identity.subject };
      const current = await tx.authIdentity.findUnique({ where: { issuer_subject: externalKey }, include: { user: true } });
      if (current && !current.user.active) throw invalidInvite();
      if (member) {
        if (current?.userId !== member.userId) throw invalidInvite();
        await requireMember(tx, invite.householdId, member.userId);
        return member;
      }
      const now = this.clock();
      if (invite.revokedAt || invite.consumedAt || invite.expiresAt <= now || invite.targetEmail !== identity.email) {
        throw invalidInvite();
      }
      const user = current?.user ?? await tx.user.create({ data: {
        displayName: identity.displayName, identities: { create: externalKey },
      } });
      const enrolled = await tx.membership.findUnique({
        where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
      });
      const joined = enrolled?.active ? enrolled : await tx.membership.upsert({
        where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
        create: { householdId: invite.householdId, userId: user.id, role: 'MEMBER', joinedAt: now },
        update: { role: 'MEMBER', active: true, joinedAt: now, leftAt: null, removedByUserId: null, revision: { increment: 1 } },
      });
      const consumed = await tx.invitation.updateMany({
        where: { id: invite.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now, consumedByUserId: user.id, targetEmail: null },
      });
      if (consumed.count !== 1) throw invalidInvite();
      await audit(tx, invite.householdId, user.id, 'INVITATION_ACCEPTED', invite.id, now);
      return recordResult(tx, requestScope, key, tokenHash, memberDto(joined));
    });
  }

  listInvitations(householdId: string, actorId: string, options: { limit: number; cursor?: string }) {
    const filters: Prisma.InvitationWhereInput = { householdId };
    const cursorScope = scope(householdId, actorId);
    if (options.cursor) {
      try {
        const [scope, value, id] = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8'));
        const createdAt = new Date(value);
        if (scope !== cursorScope || typeof id !== 'string' || !id || !Number.isFinite(createdAt.getTime())) throw new Error();
        filters.OR = [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }];
      } catch {
        throw new AppError(422, 'INVALID_CURSOR');
      }
    }
    return this.db.$transaction(async (tx) => {
      await requireAdmin(tx, householdId, actorId);
      const rows = await tx.invitation.findMany({
        where: filters, take: options.limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, createdAt: true, expiresAt: true, consumedAt: true, revokedAt: true },
      });
      const now = this.clock();
      const items = rows.slice(0, options.limit).map((row) => ({
        invitationId: row.id, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
        status: row.consumedAt ? 'CONSUMED' : row.revokedAt ? 'REVOKED' : row.expiresAt <= now ? 'EXPIRED' : 'ACTIVE',
      }));
      const last = items.at(-1);
      const nextCursor = rows.length > options.limit && last
        ? Buffer.from(JSON.stringify([cursorScope, last.createdAt, last.invitationId])).toString('base64url') : undefined;
      return { items, ...(nextCursor ? { nextCursor } : {}) };
    });
  }

  cleanExpiredInvitations() {
    return this.write(async (tx) => {
      const now = this.clock();
      const eligible = { expiresAt: { lte: now }, targetEmail: { not: null } };
      const rows = await tx.invitation.findMany({
        where: eligible, select: { id: true, expiresAt: true }, orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }], take: 100,
      });
      if (!rows.length) return { count: 0, oldestDelayMs: 0 };
      const result = await tx.invitation.updateMany({
        where: { ...eligible, id: { in: rows.map(({ id }) => id) } }, data: { targetEmail: null },
      });
      return { count: result.count, oldestDelayMs: now.getTime() - rows[0].expiresAt.getTime() };
    });
  }

  listMembers(householdId: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, householdId, actorId);
      const rows = await tx.membership.findMany({
        where: { householdId, active: true, user: { active: true } }, include: { user: { select: { displayName: true } } },
        orderBy: [{ role: 'asc' }, { userId: 'asc' }],
      });
      return rows.map(memberDto);
    });
  }

  changeRole(householdId: string, actorId: string, userId: string, key: string, revision: number, role: Role, successor?: string) {
    return this.changeMember(householdId, actorId, userId, key, revision, role, successor);
  }

  async removeMember(householdId: string, actorId: string, userId: string, key: string, revision: number, successor?: string) {
    await this.changeMember(householdId, actorId, userId, key, revision, null, successor);
  }

  private changeMember(householdId: string, actorId: string, userId: string, key: string, revision: number, role: Role | null, successor?: string) {
    const requestScope = scope(role === null ? 'REMOVE_MEMBER' : 'CHANGE_ROLE', householdId, actorId);
    const input = [userId, revision, role, successor ?? null];
    return this.write(async (tx) => {
      await requireAdmin(tx, householdId, actorId);
      const existing = await previous<Member>(tx, requestScope, key, input);
      if (existing) return existing;
      const target = await tx.membership.findUnique({ where: { householdId_userId: { householdId, userId } } });
      if (!target?.active) throw new AppError(404, 'MEMBER_NOT_FOUND');
      if (target.revision !== revision) throw stale();
      const now = this.clock();
      const isAdminLoss = target.role === 'ADMIN' && role !== 'ADMIN';
      const activeAdmins = isAdminLoss ? await tx.membership.count({
        where: { householdId, role: 'ADMIN', active: true, user: { active: true } },
      }) : 0;
      if (isAdminLoss && activeAdmins <= 1) {
        if (!successor) throw new AppError(409, 'LAST_ADMIN');
        const promoted = await tx.membership.updateMany({
          where: { householdId, userId: successor, role: 'MEMBER', active: true, user: { active: true } },
          data: { role: 'ADMIN', revision: { increment: 1 } },
        });
        if (promoted.count !== 1) throw new AppError(422, 'INVALID_SUCCESSOR');
        await audit(tx, householdId, actorId, 'MEMBER_ROLE_CHANGED', successor, now, { from: 'MEMBER', to: 'ADMIN' });
      } else if (successor) {
        throw new AppError(422, 'INVALID_SUCCESSOR');
      }
      if (role === target.role) return recordResult(tx, requestScope, key, input, memberDto(target));
      if (role === null) await this.effects.beforeRemoveTargets?.(tx, householdId, userId, now);
      const changed = await tx.membership.updateMany({
        where: { householdId, userId, revision, active: true },
        data: role === null ? { active: false, leftAt: now, removedByUserId: actorId, revision: { increment: 1 } } :
          { role, revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw stale();
      if (role === null) {
        const assignments = await tx.assignment.updateMany({
          where: { householdId, userId, endedAt: null }, data: { endedAt: now },
        });
        await this.effects.removeTargets?.(tx, householdId, userId, now);
        await audit(tx, householdId, actorId, 'MEMBER_REMOVED', userId, now, { assignmentsEnded: assignments.count });
      } else {
        await audit(tx, householdId, actorId, 'MEMBER_ROLE_CHANGED', userId, now, { from: target.role, to: role });
      }
      return recordResult(tx, requestScope, key, input, memberDto({ userId, role: role ?? target.role, revision: revision + 1 }));
    });
  }

  getHouseholdSettings(householdId: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, householdId, actorId);
      return presentPolicy(await tx.household.findUniqueOrThrow({ where: { id: householdId }, include: { settings: true } }));
    });
  }

  updateHouseholdSettings(householdId: string, actorId: string, key: string, patch: HouseholdSettingsPatch) {
    const requestScope = scope('HOUSEHOLD_SETTINGS', householdId, actorId);
    return this.write(async (tx) => {
      await requireAdmin(tx, householdId, actorId);
      const existing = await previous<HouseholdSettings>(tx, requestScope, key, patch);
      if (existing) return existing;
      const old = presentPolicy(await tx.household.findUniqueOrThrow({ where: { id: householdId }, include: { settings: true } }));
      if (old.revision !== patch.revision) throw stale();
      const next = { ...old, ...patch, revision: patch.revision + 1 };
      const changed = await tx.household.updateMany({
        where: { id: householdId, settingsRevision: patch.revision },
        data: { defaultTimeZone: patch.defaultTimeZone, settingsRevision: { increment: 1 } },
      });
      if (changed.count !== 1) throw stale();
      const values = {
        minRadiusM: next.radiusM.min, defaultRadiusM: next.radiusM.default, maxRadiusM: next.radiusM.max,
        maxLocationDurationMin: next.maxLocationDurationMin, weeklyCalendarConvention: next.weeklyCalendarConvention,
      };
      await tx.householdSettings.upsert({ where: { householdId }, create: { householdId, ...values }, update: values });
      const now = this.clock();
      if (old.radiusM.min !== next.radiusM.min || old.radiusM.max !== next.radiusM.max) {
        if (this.effects.changeRadius) {
          await this.effects.changeRadius(tx, householdId, actorId, next.radiusM, now);
        } else if (await tx.trigger.count({ where: { kind: 'LOCATION', reminder: { householdId } } })) {
          throw new AppError(503, 'STORAGE_UNAVAILABLE');
        }
      }
      await audit(tx, householdId, actorId, 'HOUSEHOLD_SETTINGS_CHANGED', householdId, now, { previous: old, current: next });
      return recordResult(tx, requestScope, key, patch, next);
    });
  }

  async getUserSettings(userId: string) {
    const row = await this.db.user.findUnique({ where: { id: userId, active: true }, include: { settings: true } });
    if (!row) throw new AppError(401, 'UNAUTHENTICATED');
    return personalPreferences(row);
  }

  updateUserSettings(userId: string, key: string, patch: UserSettings) {
    const requestScope = scope('USER_SETTINGS', userId);
    return this.write(async (tx) => {
      const row = await tx.user.findUnique({ where: { id: userId, active: true } });
      if (!row) throw new AppError(401, 'UNAUTHENTICATED');
      const existing = await previous<UserSettings>(tx, requestScope, key, patch);
      if (existing) return existing;
      const changed = await tx.user.updateMany({
        where: { id: userId, active: true, settingsRevision: patch.revision },
        data: { timeZone: patch.timeZone, settingsRevision: { increment: 1 } },
      });
      if (changed.count !== 1) throw stale();
      if (patch.locale !== undefined) {
        const value = { locale: patch.locale };
        await tx.userSettings.upsert({ where: { userId }, create: { userId, ...value }, update: value });
      }
      const refreshed = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
      return recordResult(tx, requestScope, key, patch, personalPreferences(refreshed));
    });
  }
}
