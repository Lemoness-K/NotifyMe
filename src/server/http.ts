import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import {
  All, ArgumentsHost, Body, Catch, Controller, Delete, ExceptionFilter, Get, HttpCode, HttpException,
  Inject, Module, Param, Patch, Post, Query, Req, Res,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { PrismaClient } from './generated/client.js';
import { type IdentityProvider, SessionService } from './auth.js';
import { AppError } from './errors.js';
import { createTimeReminder, listReminders, readReminder, type ListOptions } from './repository.js';
import { prepareReminder } from './reminders.js';
import { invitationIdentity, invalidField, normalizeInvitationEmail, optionalId, parseInvitationCode, parseRevision, prepareRoleChange, record } from './household-rules.js';
import { HouseholdRepository, type HouseholdEffects } from './households.js';
import { HouseholdRateLimit, householdRuntimeDefaults, requestSource, type HouseholdConfig } from './household-runtime.js';
import type { SyntheticAccount } from './provider.js';
import { catalog, prepareHouseholdSettings, prepareUserSettings } from './settings.js';

const services = Symbol('U1 services');
const challengeName = '__Host-notify-login';
const sessionName = '__Host-notify-session';
const secureCookie = { secure: true, httpOnly: true, sameSite: 'strict', path: '/' } as const;

export interface AppOptions {
  db: PrismaClient;
  provider: IdentityProvider;
  origin: string;
  clock?: () => Date;
  tls?: { key: Buffer; cert: Buffer };
  webRoot?: string;
  googleClientId?: string;
  firebaseConfig?: { apiKey: string; authDomain: string; projectId: string };
  localSignIn?: (nonce: string, account?: SyntheticAccount) => { firebaseToken: string; googleToken: string };
  householdConfig?: HouseholdConfig;
  householdEffects?: HouseholdEffects;
  trustedProxy?: boolean;
  log?: (record: { requestId: string; route: string; status: number; durationMs: number; code?: string }) => void;
}
type Services = AppOptions & {
  auth: SessionService; households: HouseholdRepository; limit: HouseholdRateLimit; householdConfig: HouseholdConfig;
};

function bearer(req: Request) {
  const header = req.get('authorization');
  if (!header || !/^Bearer [^\s]{1,12000}$/i.test(header)) throw new AppError(401, 'UNAUTHENTICATED');
  return header.slice(7);
}
function cookie(req: Request, name: string) {
  for (const fragment of (req.get('cookie') ?? '').split(';')) {
    const [key, value] = fragment.trim().split('=', 2);
    if (key === name && value && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return '';
}
function idempotency(req: Request) {
  const value = req.get('idempotency-key');
  if (!value || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) throw new AppError(422, 'INVALID_IDEMPOTENCY_KEY');
  return value;
}

@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const allowedCodes = ['AUTH_PROVIDER_UNAVAILABLE', 'UNAUTHENTICATED'];
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let details: Record<string, string> | undefined;
    if (error instanceof AppError) {
      ({ status, code, details } = error);
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      code = status === 404 ? 'NOT_FOUND' : status === 413 ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST';
    } else if (error && typeof error === 'object' && 'code' in error && 'status' in error &&
        typeof error.code === 'string' && allowedCodes.includes(error.code) &&
        (error.status === 401 || error.status === 503)) {
      ({ status, code } = error);
    }
    response.locals.errorCode = code;
    if (status === 503) response.setHeader('Retry-After', '2');
    if (status === 429 && error instanceof AppError) response.setHeader('Retry-After', String(error.retryAfterSeconds ?? 60));
    response.status(status).json({ code, requestId: response.locals.requestId, ...(details ? { details } : {}) });
  }
}

@Controller()
class CoreController {
  constructor(@Inject(services) private readonly runtime: Services) {}

  private principal(request: Request) {
    return this.runtime.auth.principal(bearer(request), cookie(request, sessionName));
  }

  private async administratorRequest(request: Request, householdId: string) {
    const { userId } = await this.principal(request);
    this.runtime.limit.check(JSON.stringify(['ADMIN', householdId, userId]), this.runtime.householdConfig.administrationPerMinute);
    return userId;
  }

  @Get('client-config')
  config() {
    const { googleClientId, firebaseConfig, localSignIn } = this.runtime;
    return localSignIn ? { mode: 'synthetic' } : { mode: 'google', googleClientId, firebaseConfig };
  }

  @Post('sessions/challenges')
  async challenge(@Res({ passthrough: true }) response: Response) {
    const result = await this.runtime.auth.start();
    response.cookie(challengeName, result.secret, { ...secureCookie, expires: result.expiresAt });
    return { nonce: result.nonce, issuedAt: result.issuedAt.toISOString() };
  }

  @Post('sessions/local-proof')
  localProof(@Body() body: unknown) {
    if (!this.runtime.localSignIn) throw new AppError(404, 'NOT_FOUND');
    const nonce = body && typeof body === 'object' && 'nonce' in body ? body.nonce : undefined;
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) {
      throw new AppError(422, 'INVALID_FIELD', { field: 'nonce' });
    }
    const account = body && typeof body === 'object' && 'account' in body ? body.account : undefined;
    if (account !== undefined && account !== 'admin' && account !== 'member') throw invalidField('account');
    return this.runtime.localSignIn(nonce, account);
  }

  @Post('sessions')
  async session(@Req() request: Request, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const token = body && typeof body === 'object' && 'googleToken' in body ? body.googleToken : undefined;
    if (typeof token !== 'string' || token.length === 0 || token.length > 12000) {
      throw new AppError(422, 'INVALID_FIELD', { field: 'googleToken' });
    }
    const result = await this.runtime.auth.issue(cookie(request, challengeName), bearer(request), token);
    response.clearCookie(challengeName, secureCookie);
    response.cookie(sessionName, result.secret, { ...secureCookie, expires: result.expiresAt });
    return { expiresAt: result.expiresAt.toISOString() };
  }

  @Delete('sessions/current')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    idempotency(request);
    await this.runtime.auth.end(bearer(request), cookie(request, sessionName));
    response.clearCookie(sessionName, secureCookie);
  }

  @Get('me')
  async me(@Req() request: Request) {
    const identity = await this.runtime.auth.principal(bearer(request), cookie(request, sessionName));
    const membership = await this.runtime.db.membership.findFirst({
      where: { userId: identity.userId, active: true, user: { active: true } },
      include: { household: true },
    });
    return {
      userId: identity.userId, ...(identity.displayName === null ? {} : { displayName: identity.displayName }),
      ...(membership ? {
        householdId: membership.householdId, defaultTimeZone: membership.household.defaultTimeZone, householdRole: membership.role,
      } : {}),
    };
  }

  @Get('settings/catalog')
  async settingsCatalog(@Req() request: Request) {
    await this.principal(request);
    return catalog;
  }

  @Get('me/settings')
  async userSettings(@Req() request: Request) {
    const { userId } = await this.principal(request);
    return this.runtime.households.getUserSettings(userId);
  }

  @Patch('me/settings')
  async changeUserSettings(@Req() request: Request, @Body() body: unknown) {
    const { userId } = await this.principal(request);
    return this.runtime.households.updateUserSettings(userId, idempotency(request), prepareUserSettings(body));
  }

  @Get('households/:householdId/settings')
  async householdSettings(@Req() request: Request, @Param('householdId') householdId: string) {
    const { userId } = await this.principal(request);
    return this.runtime.households.getHouseholdSettings(householdId, userId);
  }

  @Patch('households/:householdId/settings')
  async changeHouseholdSettings(@Req() request: Request, @Param('householdId') householdId: string, @Body() body: unknown) {
    const { userId } = await this.principal(request);
    return this.runtime.households.updateHouseholdSettings(householdId, userId, idempotency(request), prepareHouseholdSettings(body));
  }

  @Get('households/:householdId/invitations')
  async invitations(@Req() request: Request, @Param('householdId') householdId: string, @Query() query: Record<string, unknown>) {
    const { userId } = await this.principal(request);
    const limit = query.limit === undefined ? 25 : typeof query.limit === 'string' && /^\d+$/.test(query.limit) ? Number(query.limit) : 0;
    if (limit < 1 || limit > 100) throw invalidField('limit');
    if (query.cursor !== undefined && (typeof query.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(query.cursor))) {
      throw invalidField('cursor');
    }
    return this.runtime.households.listInvitations(householdId, userId, { limit, cursor: query.cursor });
  }

  @Post('households/:householdId/invitations')
  async makeInvitation(@Req() request: Request, @Param('householdId') householdId: string, @Body() body: unknown) {
    const userId = await this.administratorRequest(request, householdId);
    return this.runtime.households.createInvitation(householdId, userId, idempotency(request), normalizeInvitationEmail(record(body).email));
  }

  @Delete('households/:householdId/invitations/:invitationId')
  @HttpCode(204)
  async revokeInvitation(@Req() request: Request, @Param('householdId') householdId: string, @Param('invitationId') invitationId: string) {
    const userId = await this.administratorRequest(request, householdId);
    await this.runtime.households.revokeInvitation(householdId, userId, invitationId, idempotency(request));
  }

  @Post('invitations/accept')
  @HttpCode(200)
  async acceptInvitation(@Req() request: Request, @Body() body: unknown) {
    const ip = requestSource(request, this.runtime.trustedProxy === true);
    this.runtime.limit.check(JSON.stringify(['INVITE_IP', ip]), this.runtime.householdConfig.inviteIpPerMinute);
    const key = idempotency(request);
    const code = parseInvitationCode(body);
    const identity = await this.runtime.provider.verifyFirebase(bearer(request));
    this.runtime.limit.check(JSON.stringify(['INVITE_IDENTITY', identity.issuer, identity.subject]),
      this.runtime.householdConfig.inviteIdentityPerMinute);
    return this.runtime.households.acceptInvitation(key, code, invitationIdentity(identity));
  }

  @Get('households/:householdId/members')
  async members(@Req() request: Request, @Param('householdId') householdId: string) {
    const { userId } = await this.principal(request);
    return this.runtime.households.listMembers(householdId, userId);
  }

  @Patch('households/:householdId/members/:userId')
  async changeRole(@Req() request: Request, @Param('householdId') householdId: string, @Param('userId') target: string, @Body() body: unknown) {
    const userId = await this.administratorRequest(request, householdId);
    const { revision, role, successorAdminId } = prepareRoleChange(body);
    return this.runtime.households.changeRole(householdId, userId, target, idempotency(request), revision, role, successorAdminId);
  }

  @Delete('households/:householdId/members/:userId')
  @HttpCode(204)
  async removeMember(@Req() request: Request, @Param('householdId') householdId: string, @Param('userId') target: string, @Query('successorAdminId') successor: unknown) {
    const actor = await this.administratorRequest(request, householdId);
    await this.runtime.households.removeMember(householdId, actor, target, idempotency(request), parseRevision(request.get('if-match')),
      optionalId(successor, 'successorAdminId'));
  }

  @Get('households/:householdId/reminders')
  async list(@Req() request: Request, @Param('householdId') home: string, @Query() query: Record<string, unknown>) {
    const who = await this.runtime.auth.principal(bearer(request), cookie(request, sessionName));
    for (const k of ['view', 'bucket', 'limit', 'cursor']) {
      if (query[k] !== undefined && typeof query[k] !== 'string') throw new AppError(422, 'INVALID_FILTER');
    }
    return listReminders(this.runtime.db, home, who.userId, {
      cursor: query.cursor as string | undefined, limit: query.limit === undefined ? undefined : Number(query.limit),
      view: query.view as ListOptions['view'], bucket: query.bucket as ListOptions['bucket'], now: this.runtime.clock?.(),
    });
  }

  @Get('households/:householdId/reminders/:reminderId')
  async detail(@Req() request: Request, @Param('householdId') home: string, @Param('reminderId') id: string) {
    const who = await this.runtime.auth.principal(bearer(request), cookie(request, sessionName));
    return readReminder(this.runtime.db, home, who.userId, id);
  }

  @Post('households/:householdId/reminders')
  async add(@Req() request: Request, @Param('householdId') home: string, @Body() body: unknown) {
    const who = await this.runtime.auth.principal(bearer(request), cookie(request, sessionName));
    return createTimeReminder(this.runtime.db, home, who.userId, idempotency(request), prepareReminder(body, who.userId));
  }

  @All('{*unknown}')
  missing() {
    throw new AppError(404, 'NOT_FOUND');
  }
}

export async function createApp(options: AppOptions) {
  @Module({
    controllers: [CoreController],
    providers: [{ provide: services, useValue: {
      ...options, auth: new SessionService(options.db, options.provider, options.clock),
      households: new HouseholdRepository(options.db, options.origin, options.clock, options.householdEffects),
      householdConfig: options.householdConfig ?? householdRuntimeDefaults,
      limit: new HouseholdRateLimit(options.clock ? () => options.clock!().getTime() : undefined),
    } }],
  })
  class AppModule {}

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false, abortOnError: false, httpsOptions: options.tls,
  });
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new SafeErrors());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => options.log?.({
      requestId, route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
      status: res.statusCode, durationMs: Math.round(performance.now() - start),
      ...(typeof res.locals.errorCode === 'string' ? { code: res.locals.errorCode } : {}),
    }));
    if (req.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        req.get('origin') !== options.origin) {
      res.locals.errorCode = 'ORIGIN_DENIED';
      res.status(403).json({ code: 'ORIGIN_DENIED', requestId });
      return;
    }
    next();
  });
  app.useBodyParser('json', { limit: '32kb' });
  express.get('/internal/health', async (_req: Request, response: Response) => {
    try {
      await options.db.household.count();
      response.status(204).end();
    } catch {
      response.locals.errorCode = 'UNAVAILABLE';
      response.status(503).json({ code: 'UNAVAILABLE', requestId: response.locals.requestId });
    }
  });
  if (options.webRoot && existsSync(join(options.webRoot, 'index.html'))) {
    const root = options.webRoot;
    app.useStaticAssets(root, { index: false });
    express.get(['/', '/reminders', '/reminders/new', '/invite', '/settings', '/settings/household', '/settings/personal', '/settings/installation', '/household', '/household/members', '/household/invitations'], (_req: Request, response: Response) => {
      response.sendFile(join(root, 'index.html'));
    });
  }
  return app;
}
