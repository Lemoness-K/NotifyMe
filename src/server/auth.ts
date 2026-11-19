import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from './generated/client.js';
import { AppError } from './errors.js';
import { prismaCode } from './repository.js';

export interface FirebaseIdentity {
  issuer: string;
  subject: string;
  googleSubject: string;
  authTime: number;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
}
export interface GoogleProof { subject: string; nonce: string; expiresAt: Date }
export interface VerificationBudget { deadline: number; retriesRemaining: number }
export interface IdentityProvider {
  createVerificationBudget?(): VerificationBudget;
  verifyFirebase(token: string, budget?: VerificationBudget): Promise<FirebaseIdentity>;
  verifyGoogle(token: string, budget?: VerificationBudget): Promise<GoogleProof>;
}

const challengeLifetimeMs = 5 * 60_000;
const sessionLifetimeMs = 12 * 60 * 60_000;
const randomSecret = () => randomBytes(32).toString('base64url');
const digest = (secret: string) => createHash('sha256').update(secret).digest('hex');
const denied = () => new AppError(401, 'UNAUTHENTICATED');

export async function bootstrapAdmin(db: PrismaClient, provider: IdentityProvider, token: string) {
  const identity = await provider.verifyFirebase(token);
  try {
    return await db.$transaction(async (tx) => {
      if (await tx.household.findUnique({ where: { singleton: 1 } })) {
        throw new AppError(409, 'ALREADY_INITIALIZED');
      }
      const issuer_subject = { issuer: identity.issuer, subject: identity.subject };
      const link = await tx.authIdentity.findUnique({
        where: { issuer_subject }, include: { user: true },
      });
      if (link && !link.user.active) throw denied();
      const user = link?.user ?? await tx.user.create({
        data: { displayName: identity.displayName, identities: { create: issuer_subject } },
      });
      const household = await tx.household.create({ data: {} });
      await tx.membership.create({ data: { householdId: household.id, userId: user.id, role: 'ADMIN' } });
      return { householdId: household.id, userId: user.id, role: 'ADMIN' as const };
    });
  } catch (error) {
    if (prismaCode(error) === 'P2002') throw new AppError(409, 'ALREADY_INITIALIZED');
    throw error;
  }
}

export class SessionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly provider: IdentityProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async start() {
    const secret = randomSecret();
    const nonce = randomSecret();
    const issuedAt = this.clock();
    const expiresAt = new Date(issuedAt.getTime() + challengeLifetimeMs);
    await this.db.$transaction(async (tx) => {
      await tx.loginChallenge.deleteMany({ where: { expiresAt: { lte: issuedAt } } });
      await tx.loginChallenge.create({ data: { digest: digest(secret), nonce, issuedAt, expiresAt } });
    });
    return { secret, nonce, issuedAt, expiresAt };
  }

  async issue(challengeSecret: string, firebaseToken: string, googleToken: string) {
    if (!challengeSecret) throw denied();
    const challenge = await this.db.loginChallenge.findUnique({ where: { digest: digest(challengeSecret) } });
    const initialNow = this.clock();
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= initialNow) throw denied();
    const budget = this.provider.createVerificationBudget?.();
    const identity = await this.provider.verifyFirebase(firebaseToken, budget);
    const proof = await this.provider.verifyGoogle(googleToken, budget);
    const now = this.clock();
    if (proof.nonce !== challenge.nonce || proof.subject !== identity.googleSubject ||
        !Number.isSafeInteger(identity.authTime) ||
        identity.authTime * 1000 <= challenge.issuedAt.getTime() ||
        identity.authTime * 1000 > now.getTime() + 1000 ||
        proof.expiresAt <= now) throw denied();

    const secret = randomSecret();
    const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
    const { issuer, subject, authTime } = identity;
    try {
      await this.db.$transaction(async (tx) => {
        const link = await tx.authIdentity.findUnique({
          where: { issuer_subject: { issuer, subject } }, include: { user: true },
        });
        if (!link?.user.active) throw denied();
        const consumed = await tx.loginChallenge.updateMany({
          where: { digest: challenge.digest, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw denied();
        await tx.loginProof.deleteMany({ where: { expiresAt: { lte: now } } });
        await tx.loginProof.create({
          data: { issuer, subject, authTime, expiresAt: proof.expiresAt > expiresAt ? proof.expiresAt : expiresAt },
        });
        await tx.session.deleteMany({ where: { expiresAt: { lte: now } } });
        await tx.session.create({
          data: { digest: digest(secret), userId: link.userId, issuer, subject, authTime, expiresAt },
        });
      });
    } catch (error) {
      if (prismaCode(error) === 'P2002') throw denied();
      throw error;
    }
    return { secret, expiresAt };
  }

  async principal(firebaseToken: string, secret: string) {
    if (!secret) throw denied();
    const identity = await this.provider.verifyFirebase(firebaseToken);
    const session = await this.db.session.findUnique({
      where: { digest: digest(secret) }, include: { user: true },
    });
    if (!session || session.endedAt || session.expiresAt <= this.clock() || !session.user.active ||
        session.issuer !== identity.issuer || session.subject !== identity.subject ||
        session.authTime !== identity.authTime) throw denied();
    return { userId: session.userId, displayName: session.user.displayName, sessionDigest: session.digest };
  }

  async end(firebaseToken: string, secret: string) {
    const { sessionDigest } = await this.principal(firebaseToken, secret);
    await this.db.session.updateMany({
      where: { digest: sessionDigest, endedAt: null }, data: { endedAt: this.clock() },
    });
  }
}
