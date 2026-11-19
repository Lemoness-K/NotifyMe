import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/http.js';
import { seedHousehold, testDatabase } from '../u1/fixtures.js';
import { AppError } from '../../src/server/errors.js';
import type { PlanCandidate } from '../../src/server/work-scheduling.js';

const origin = 'https://notify.invalid';
const now = new Date('2032-01-01T00:00:00Z');
const workPath = '/households/home/reminders';
const actionPath = (id: string) => '/households/home/occurrences/' + id + '/actions';
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let clock: Date;
let rejectPlan: boolean;
let latestCandidates: readonly PlanCandidate[];

function secret(actor: string) {
  return (actor + 'A'.repeat(43)).slice(0, 43);
}

function send(path: string, actor = 'member', method = 'GET', body?: unknown, key = 'single', more?: Record<string, string>) {
  return fetch(base + path, { method, headers: {
    Connection: 'close', Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key,
    Cookie: '__Host-notify-session=' + secret(actor), Authorization: 'Bearer ' + actor, ...more,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const timeTrigger = { kind: 'TIME', scheduledAt: '2032-01-02T00:00:00Z', timeZone: 'Asia/Seoul' };

async function create(verification = false, key = 'create') {
  const response = await send(workPath, 'member', 'POST', {
    title: '원문', trigger: timeTrigger, verification: { enabled: verification, ...(verification ? { verifierId: 'verifier' } : {}) },
  }, key);
  expect(response.status).toBe(201);
  return response.json();
}

beforeEach(async () => {
  clock = now;
  rejectPlan = false;
  latestCandidates = [];
  fixture = await testDatabase();
  await seedHousehold(fixture.db);
  await fixture.db.user.create({ data: { id: 'verifier' } });
  await fixture.db.membership.create({ data: { householdId: 'home', userId: 'verifier', role: 'MEMBER' } });
  for (const actor of ['member', 'verifier']) {
    if (actor === 'verifier') await fixture.db.authIdentity.create({ data: { issuer: 'test-issuer', subject: actor, userId: actor } });
    await fixture.db.session.create({ data: { digest: createHash('sha256').update(secret(actor)).digest('hex'), userId: actor, issuer: 'test-issuer',
      subject: actor === 'member' ? 'member-firebase' : actor, authTime: 1, expiresAt: new Date('2032-01-31T00:00:00Z') } });
  }
  app = await createApp({ db: fixture.db, origin, clock: () => clock, deleteJournalPath: fixture.path + '.delete.sqlite',
    workPlanPort: {
      targets: async (_tx, _home, ids) => ids.map((id) => 'installation-' + id),
      validateAndStore: async (_tx, _household, candidates) => {
        if (rejectPlan) throw new AppError(409, 'GEOFENCE_CAPACITY_EXCEEDED', { installationId: 'installation-member', remainingCapacity: '0' });
        latestCandidates = candidates;
      },
    },
    provider: {
      verifyFirebase: async (token) => ({ issuer: 'test-issuer', subject: token === 'member' ? 'member-firebase' : token,
        authTime: 1, googleSubject: token }),
      verifyGoogle: async () => ({ subject: 'unused', nonce: 'unused', expiresAt: now }),
    } });
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
});

afterEach(async () => {
  await app?.close();
  await fixture?.close();
});

describe('U3 work HTTP contract', () => {
  it('opens, shows and withdraws verification and preserves the attempt', async () => {
    const item = await create(true);
    const action = actionPath(item.currentOccurrence.occurrenceId);
    const requested = await send(action, 'member', 'POST', { action: 'COMPLETE', revision: 1 }, 'complete');
    expect(requested.status).toBe(200);
    const reply = await requested.json();
    expect(reply).toMatchObject({ state: 'VERIFICATION_PENDING', allowedActions: ['WITHDRAW_VERIFICATION'] });
    const detail = workPath + '/' + item.reminderId;
    expect(await (await send(detail)).json()).toMatchObject({ pendingVerificationCount: 1 });
    expect(await (await send(detail + '/occurrences?state=VERIFICATION_PENDING', 'verifier')).json())
      .toMatchObject({ items: [{ allowedActions: ['APPROVE', 'REJECT'] }] });
    expect((await send(action, 'verifier', 'POST', { action: 'WITHDRAW_VERIFICATION', revision: reply.revision })).status).toBe(403);
    const withdrawn = await send(action, 'member', 'POST', { action: 'WITHDRAW_VERIFICATION', revision: reply.revision }, 'withdrawn');
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toMatchObject({ state: 'PENDING' });
    expect(await fixture.db.completion.findFirst()).toMatchObject({ state: 'WITHDRAWN', responseActorId: 'member' });
  });

  it('avoids overwrites and returns a pending verification to pending on membership revocation', async () => {
    const item = await create(true);
    const action = actionPath(item.currentOccurrence.occurrenceId);
    expect((await send(action, 'member', 'POST', { action: 'COMPLETE', revision: 1 }, 'complete')).status).toBe(200);
    const revoke = await send('/households/home/members/verifier', 'member', 'DELETE', undefined, 'revoke', { 'If-Match': '0' });
    expect(revoke.status).toBe(204);
    const detail = workPath + '/' + item.reminderId;
    expect(await (await send(detail)).json()).toMatchObject({ currentOccurrence: { state: 'PENDING' }, pendingVerificationCount: 0 });
    expect(await fixture.db.completion.findFirst()).toMatchObject({ state: 'VERIFIER_REVOKED' });
    expect((await send(action, 'verifier', 'POST', { action: 'APPROVE', revision: 2 })).status).toBe(403);
  });

  it('supports revisions, archives and restores, then removes app content after durable delete evidence', async () => {
    const item = await create(false);
    const detail = workPath + '/' + item.reminderId;
    expect((await send(detail, 'member', 'PATCH', { title: '새 원문', revision: 0 }, 'stale')).status).toBe(409);
    expect((await send(detail, 'member', 'PATCH', { title: '새 원문', revision: 1 }, 'edit')).status).toBe(200);
    expect((await send(detail + '/lifecycle', 'member', 'POST', { action: 'ARCHIVE', revision: 2 })).status).toBe(200);
    expect(await (await send(workPath + '?bucket=ARCHIVED')).json()).toMatchObject({ items: [{ title: '새 원문' }] });
    expect((await send(detail + '/lifecycle', 'member', 'POST', { action: 'RESTORE', revision: 3 }, 'restore')).status).toBe(200);
    expect((await send(detail, 'member', 'DELETE', undefined, 'del', { 'If-Match': '4' })).status).toBe(204);
    expect((await send(detail, 'member', 'DELETE', undefined, 'del', { 'If-Match': '4' })).status).toBe(204);
    expect((await send(detail)).status).toBe(404);
    expect(await fixture.db.reminderAudit.count()).toBe(0);
    expect(await fixture.db.deletionCommit.findFirst()).toMatchObject({ reminderId: item.reminderId, householdId: 'home' });
  });

  it('rejects a verifier assigned with another person and limits each verification action to the current actor', async () => {
    const incompatible = await send(workPath, 'member', 'POST', {
      title: 'invalid', trigger: timeTrigger, assigneeIds: ['member', 'verifier'],
      verification: { enabled: true, verifierId: 'verifier' },
    });
    expect(incompatible.status).toBe(422);
    expect(await incompatible.json()).toMatchObject({ code: 'INVALID_VERIFIER' });
    const item = await create(true);
    const action = actionPath(item.currentOccurrence.occurrenceId);
    await send(action, 'member', 'POST', { action: 'COMPLETE', revision: 1 }, 'submit');
    const outcomes = await Promise.all([
      send(action, 'verifier', 'POST', { action: 'APPROVE', revision: 2 }, 'approve'),
      send(action, 'member', 'POST', { action: 'WITHDRAW_VERIFICATION', revision: 2 }, 'withdraw'),
    ]);
    expect(outcomes.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await fixture.db.completion.count({ where: { state: 'OPEN' } })).toBe(0);
    expect(await fixture.db.completion.count()).toBe(1);
  });

  it('prevents self-verification after the last assignee loses membership', async () => {
    await fixture.db.membership.create({ data: { householdId: 'home', userId: 'outsider', role: 'MEMBER' } });
    const created = await send(workPath, 'member', 'POST', { title: 'Unassigned later', trigger: timeTrigger,
      assigneeIds: ['outsider'], verification: { enabled: true, verifierId: 'verifier' } });
    expect(created.status).toBe(201);
    const item = await created.json();
    const occurrenceId = item.currentOccurrence.occurrenceId;
    expect((await send('/households/home/members/outsider', 'member', 'DELETE', undefined, 'drop', { 'If-Match': '0' })).status).toBe(204);
    const path = workPath + '/' + item.reminderId;
    expect(await (await send(path, 'verifier')).json()).toMatchObject({ assigneeIds: [], currentOccurrence: { allowedActions: [] } });
    expect((await send(actionPath(occurrenceId), 'verifier', 'POST', { action: 'COMPLETE', revision: 1 }, 'submit-own')).status).toBe(403);

    // Protect a stored request from before the fix, too.
    await fixture.db.occurrence.update({ where: { id: occurrenceId }, data: { state: 'VERIFICATION_PENDING', revision: 2 } });
    await fixture.db.completion.create({ data: { occurrenceId, submittedBy: 'verifier', verifierUserId: 'verifier',
      state: 'OPEN', requestedAt: now } });
    const pending = await (await send(path + '/occurrences?state=VERIFICATION_PENDING', 'verifier')).json();
    expect(pending.items[0].allowedActions).toEqual(['WITHDRAW_VERIFICATION']);
    for (const action of ['APPROVE', 'REJECT']) {
      expect((await send(actionPath(occurrenceId), 'verifier', 'POST', { action, revision: 2 }, action)).status).toBe(403);
    }
  });

  it('keeps an older verification request separate from the next current recurring occurrence', async () => {
    const response = await send(workPath, 'member', 'POST', {
      title: 'Daily', trigger: timeTrigger, recurrence: { frequency: 'DAILY', endOn: '2032-01-05' },
      verification: { enabled: true, verifierId: 'verifier' },
    });
    expect(response.status).toBe(201);
    const item = await response.json();
    const action = actionPath(item.currentOccurrence.occurrenceId);
    expect((await send(action, 'member', 'POST', { action: 'COMPLETE', revision: 1 }, 'submit')).status).toBe(200);
    clock = new Date('2032-01-03T03:00:00Z');
    const detail = workPath + '/' + item.reminderId;
    expect(await (await send(detail)).json()).toMatchObject({
      pendingVerificationCount: 1, currentOccurrence: { state: 'PENDING', scheduledAt: '2032-01-03T00:00:00.000Z' },
    });
    expect(await (await send(detail + '/occurrences?state=VERIFICATION_PENDING', 'verifier')).json())
      .toMatchObject({ items: [{ occurrenceId: item.currentOccurrence.occurrenceId }] });
    expect(await fixture.db.occurrence.count()).toBe(3);
    await send(detail);
    expect(await fixture.db.occurrence.count()).toBe(3);
  });

  it('merges successive occurrence overrides and binds cursors to history filters', async () => {
    const response = await send(workPath, 'member', 'POST', { title: 'Weekly', trigger: timeTrigger,
      recurrence: { frequency: 'WEEKLY', weekdays: ['FR'] } });
    expect(response.status).toBe(201);
    const item = await response.json();
    const detail = workPath + '/' + item.reminderId;
    const selection = { scope: 'THIS_OCCURRENCE', occurrenceId: item.currentOccurrence.occurrenceId };
    expect((await send(detail, 'member', 'PATCH', { ...selection, revision: 1, title: 'unique title' }, 'title')).status).toBe(200);
    expect((await send(detail, 'member', 'PATCH', { ...selection, revision: 2, description: ' unique text ' }, 'text')).status).toBe(200);
    expect(await (await send(detail)).json()).toMatchObject({
      title: 'Weekly', currentOccurrence: { override: { title: 'unique title', description: ' unique text ' } },
    });
    const history = '/households/home/history';
    const first = await (await send(history + '?view=HOUSEHOLD&limit=1')).json();
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    expect((await send(history + '?view=MINE&cursor=' + first.nextCursor)).status).toBe(422);
    expect((await send(history + '?view=HOUSEHOLD&cursor=' + first.nextCursor)).status).toBe(200);
  });

  it('preserves finalized and verification-pending logical slots through a whole-series rebuild', async () => {
    const created = await send(workPath, 'member', 'POST', {
      title: 'Repeated', trigger: timeTrigger, recurrence: { frequency: 'DAILY' },
    });
    expect(created.status).toBe(201);
    const item = await created.json();
    const detail = workPath + '/' + item.reminderId;
    const completedId = item.currentOccurrence.occurrenceId;
    expect((await send(actionPath(completedId), 'member', 'POST', { action: 'COMPLETE', revision: 1 }, 'finish-first')).status).toBe(200);
    clock = new Date('2032-01-03T03:00:00Z');
    const second = await (await send(detail)).json();
    const pendingId = second.currentOccurrence.occurrenceId;
    expect((await send(detail, 'member', 'PATCH', { scope: 'THIS_OCCURRENCE', occurrenceId: pendingId, revision: second.revision,
      trigger: { ...timeTrigger, scheduledAt: '2032-01-03T08:00:00Z' } }, 'move-slot')).status).toBe(200);
    const moved = await (await send(detail)).json();
    expect((await send(detail, 'member', 'PATCH', { scope: 'ENTIRE_SERIES', revision: moved.revision,
      verification: { enabled: true, verifierId: 'verifier' } }, 'enable-check')).status).toBe(200);
    expect((await send(actionPath(pendingId), 'member', 'POST', { action: 'COMPLETE',
      revision: moved.currentOccurrence.revision }, 'submit-second')).status).toBe(200);
    const awaiting = await (await send(detail)).json();
    expect((await send(detail, 'member', 'PATCH', { scope: 'ENTIRE_SERIES', revision: awaiting.revision,
      recurrence: { frequency: 'DAILY', endOn: '2032-01-10' } }, 'rebuild')).status).toBe(200);
    await send(detail);
    const occurrences = await fixture.db.occurrence.findMany({ where: { reminderId: item.reminderId } });
    expect(occurrences.filter((row) => row.scheduledAt?.toISOString() === '2032-01-02T00:00:00.000Z'))
      .toMatchObject([{ id: completedId, state: 'COMPLETED' }]);
    expect(occurrences.filter((row) => row.scheduledAt?.toISOString().startsWith('2032-01-03'))).toMatchObject([{
      id: pendingId, state: 'VERIFICATION_PENDING', scheduledAt: new Date('2032-01-03T08:00:00Z'),
    }]);
    expect(await fixture.db.completion.count({ where: { occurrenceId: pendingId, state: 'OPEN' } })).toBe(1);
  });

  it('uses an occurrence-local trigger for authorized reads and installation plans', async () => {
    const created = await send(workPath, 'member', 'POST', {
      title: 'Scheduled', trigger: timeTrigger, recurrence: { frequency: 'DAILY' },
    });
    expect(created.status).toBe(201);
    const item = await created.json();
    const detail = workPath + '/' + item.reminderId;
    const trigger = { kind: 'LOCATION', latitude: 40, longitude: 120, radiusM: 125, event: 'ENTER' };
    const edit = await send(detail, 'member', 'PATCH', {
      revision: 1, scope: 'THIS_OCCURRENCE', occurrenceId: item.currentOccurrence.occurrenceId, trigger,
    });
    expect(edit.status).toBe(200);
    expect(latestCandidates).toEqual([expect.objectContaining({ action: 'UPSERT',
      plan: expect.objectContaining({ trigger: expect.objectContaining({ kind: 'LOCATION', radiusM: 125, event: 'ENTER' }) }),
    })]);
    expect(await (await send(detail)).json()).toMatchObject({
      trigger: { kind: 'TIME' }, currentOccurrence: { override: { trigger: { kind: 'LOCATION', radiusM: 125 } } },
    });
    const settings = '/households/home/settings';
    expect((await send(settings, 'member', 'PATCH',
      { revision: 0, radiusM: { min: 150, default: 150, max: 500 } }, 'increase-radius')).status).toBe(200);
    expect(latestCandidates).toEqual([expect.objectContaining({ action: 'UPSERT',
      plan: expect.objectContaining({ trigger: expect.objectContaining({ kind: 'LOCATION', radiusM: 150 }) }),
    })]);
  });

  it('validates location duration and rolls back policy and writes when the plan port rejects them', async () => {
    const trigger = { kind: 'LOCATION', latitude: 40, longitude: 120, radiusM: 100, event: 'DWELL', durationMinutes: 10 };
    expect((await send(workPath, 'member', 'POST', { title: 'Bad', trigger: { ...trigger, durationMinutes: 70 } }, 'bad')).status).toBe(422);
    rejectPlan = true;
    const full = await send(workPath, 'member', 'POST', { title: 'Place', trigger }, 'retry');
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({ code: 'GEOFENCE_CAPACITY_EXCEEDED',
      details: { installationId: 'installation-member', remainingCapacity: '0' } });
    expect(await fixture.db.reminder.count()).toBe(0);
    expect(await fixture.db.reminderFeedEntry.count()).toBe(0);
    rejectPlan = false;
    const created = await send(workPath, 'member', 'POST', { title: 'Place', trigger }, 'retry');
    expect(created.status).toBe(201);
    const settings = '/households/home/settings';
    const patch = { revision: 0, radiusM: { min: 150, default: 150, max: 500 } };
    rejectPlan = true;
    expect((await send(settings, 'member', 'PATCH', patch, 'bounds')).status).toBe(409);
    expect(await fixture.db.trigger.findFirst()).toMatchObject({ radiusM: 100 });
    expect(await fixture.db.householdSettings.count()).toBe(0);
    rejectPlan = false;
    expect((await send(settings, 'member', 'PATCH', patch, 'bounds')).status).toBe(200);
    expect(await fixture.db.trigger.findFirst()).toMatchObject({ radiusM: 150 });
    const history = await (await send('/households/home/history?view=HOUSEHOLD')).json();
    expect(history.items.some((item: { kind: string }) => item.kind === 'RADIUS_ADJUSTED')).toBe(true);
    expect(JSON.stringify(history)).not.toContain('latitude');
  });
});
