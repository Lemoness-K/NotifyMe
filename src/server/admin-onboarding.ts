import { createHash, randomUUID } from 'node:crypto';
import { createInitialAdmin, createSession, denied, digest, randomSecret, type FirebaseIdentity, type IdentityProvider } from './auth.js';
import { AppError } from './errors.js';
import type { Prisma, PrismaClient, SetupCandidate } from './generated/client.js';
import type { BoundSetupGrant, OpenSetupGrant, SetupAuthority } from './operations/setup-authority.js';

const candidateLifetime = 10 * 60_000;
const unavailable = () => new AppError(503, 'SETUP_UNAVAILABLE');
const expired = () => new AppError(409, 'SETUP_EXPIRED');
function displayAccount(identity: FirebaseIdentity) {
  if (identity.emailVerified !== true || !identity.email || identity.email.length > 320) throw denied();
  return identity.email;
}

function isAccount(candidate: SetupCandidate, identity: FirebaseIdentity) {
  return candidate.verifiedIssuer === identity.issuer && candidate.verifiedSubject === identity.subject &&
    candidate.verifiedGoogleSubject === identity.googleSubject;
}

function applicationSecret(secret: string, { issuer, subject, googleSubject, authTime }: FirebaseIdentity) {
  return createHash('sha256').update(JSON.stringify(['setup-session-v1', secret, issuer, subject, googleSubject, authTime]))
    .digest('base64url');
}

export class FirstAdminOnboarding {
  constructor(private readonly db: PrismaClient, private readonly provider: IdentityProvider,
    private readonly authority: SetupAuthority, private readonly clock = () => new Date()) {}

  serial<T>(operation: () => Promise<T>) {
    return this.authority.serial(operation);
  }

  async reserve(tx: Prisma.TransactionClient, identity: FirebaseIdentity, now: Date) {
    const account = displayAccount(identity);
    const grant = await this.current(tx);
    if (grant?.phase === 'COMMITTING') throw unavailable();
    if (grant?.phase !== 'OPEN' || await tx.setupCompletion.count() || await tx.household.count()) throw denied();
    const existing = await tx.setupCandidate.findUnique({ where: { setupCycle: grant.setupCycle } });
    const live = existing && existing.expiresAt > now ? existing : undefined;
    if (live && !isAccount(live, identity)) throw new AppError(409, 'SETUP_RESERVED');

    const secret = randomSecret();
    const credential = { credentialDigest: digest(secret), authenticationTime: identity.authTime };
    if (existing && !live) await tx.setupCandidate.delete({ where: { candidateId: existing.candidateId } });
    const candidate = live ? await tx.setupCandidate.update({ where: { candidateId: live.candidateId }, data: credential }) :
      await tx.setupCandidate.create({ data: {
        ...credential, candidateId: randomUUID(), setupCycle: grant.setupCycle,
        verifiedIssuer: identity.issuer, verifiedSubject: identity.subject, verifiedGoogleSubject: identity.googleSubject,
        expiresAt: new Date(now.getTime() + candidateLifetime),
      } });
    return { secret, expiresAt: candidate.expiresAt, setup: { displayAccount: account, expiresAt: candidate.expiresAt } };
  }

  private async current(db: Prisma.TransactionClient) {
    try { return await this.authority.current(db); }
    catch { throw unavailable(); }
  }

  private async verify(secret: string, token: string) {
    if (!secret) throw denied();
    return this.provider.verifyFirebase(token);
  }

  private async candidate(tx: Prisma.TransactionClient, grant: OpenSetupGrant, secret: string, identity: FirebaseIdentity) {
    const candidate = await tx.setupCandidate.findUnique({ where: { credentialDigest: digest(secret) } });
    if (!candidate || candidate.setupCycle !== grant.setupCycle || !isAccount(candidate, identity) ||
        candidate.authenticationTime !== identity.authTime) throw denied();
    if (candidate.expiresAt <= this.clock()) throw expired();
    return candidate;
  }

  private async withCandidate<T>(secret: string, token: string,
    act: (candidate: SetupCandidate, tx: Prisma.TransactionClient, identity: FirebaseIdentity) => T | Promise<T>) {
    const identity = await this.verify(secret, token);
    try {
      return await this.serial(() => this.db.$transaction(async (tx) => {
        const grant = await this.current(tx);
        if (grant?.phase === 'COMMITTING') throw unavailable();
        if (grant?.phase !== 'OPEN') throw denied();
        return act(await this.candidate(tx, grant, secret, identity), tx, identity);
      }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    }
  }

  status(secret: string, token: string) {
    return this.withCandidate(secret, token, ({ expiresAt }, _tx, identity) => ({ displayAccount: displayAccount(identity), expiresAt }));
  }

  async cancel(secret: string, token: string) {
    await this.withCandidate(secret, token, ({ candidateId }, tx) => tx.setupCandidate.delete({ where: { candidateId } }));
  }

  // Expired reservations never authorize a request, even before maintenance deletes them.
  async clearExpired() {
    await this.serial(async () => {
      await this.db.setupCandidate.deleteMany({ where: { expiresAt: { lte: this.clock() } } });
    });
  }

  private async completed(grant: BoundSetupGrant, secret: string) {
    const completion = await this.db.setupCompletion.findUnique({ where: { setupCycle: grant.setupCycle } });
    if (!completion) {
      if (grant.phase === 'COMMITTING') throw unavailable();
      throw denied();
    }
    const session = await this.db.session.findUnique({
      where: { digest: digest(secret) }, include: { user: true },
    });
    if (!session || !session.user.active || session.userId !== completion.userId ||
        session.endedAt || session.expiresAt <= this.clock() ||
        !await this.db.membership.findFirst({ where: { householdId: completion.householdId, userId: completion.userId, active: true } })) {
      throw denied();
    }
    if (completion.replayUntil <= this.clock()) throw expired();
    if (grant.phase === 'COMMITTING') {
      if (grant.confirmingCandidate !== completion.candidateId) throw unavailable();
      this.authority.finishConfirmation(grant);
    }
    return { secret, expiresAt: session.expiresAt };
  }

  async confirm(credential: string, token: string) {
    const identity = await this.verify(credential, token);
    return this.serial(async () => {
      try {
        const grant = await this.current(this.db);
        if (!grant) throw denied();
        const secret = applicationSecret(credential, identity);
        return grant.phase === 'OPEN'
          ? await this.commit(grant, credential, identity, secret) : await this.completed(grant, secret);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw unavailable();
      }
    });
  }

  private async commit(grant: OpenSetupGrant, credential: string, identity: FirebaseIdentity, secret: string) {
    const first = await this.candidate(this.db, grant, credential, identity);
    if (await this.db.setupCompletion.count() || await this.db.household.count()) throw denied();
    const committing = this.authority.beginConfirmation(grant, first.candidateId);
    let result;
    try {
      result = await this.db.$transaction(async (tx) => {
        const state = await this.current(tx);
        if (state?.phase !== 'COMMITTING' || state.setupCycle !== grant.setupCycle ||
            state.confirmingCandidate !== first.candidateId) throw unavailable();
        const candidate = await this.candidate(tx, grant, credential, identity);
        const { householdId, userId } = await createInitialAdmin(tx, identity);
        const committedAt = this.clock();
        await tx.setupCompletion.create({ data: { setupCycle: grant.setupCycle, candidateId: candidate.candidateId,
          householdId, userId, committedAt, replayUntil: candidate.expiresAt } });
        await tx.setupCandidate.delete({ where: { candidateId: candidate.candidateId } });
        return createSession(tx, userId, identity, committedAt, secret);
      });
    } catch (error) {
      const state = await this.current(this.db);
      if (state?.phase === 'COMMITTING' && state.setupCycle === grant.setupCycle &&
          state.confirmingCandidate === first.candidateId && !await this.db.setupCompletion.count() &&
          !await this.db.household.count() &&
          await this.db.setupCandidate.findUnique({ where: { candidateId: first.candidateId } })) {
        this.authority.reopenAfterRollback(grant);
      }
      throw error;
    }
    const state = await this.current(this.db);
    if (state?.phase !== 'COMMITTING' || state.confirmingCandidate !== first.candidateId) throw unavailable();
    this.authority.finishConfirmation(committing);
    return result;
  }
}
