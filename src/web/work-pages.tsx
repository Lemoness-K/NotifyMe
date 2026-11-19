import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { scheduleLocal } from '../server/recurrence.js';
import type { PageProps } from './App.js';
import { ApiError, type Reminder, type WorkOccurrence } from './client.js';
import { errorText, retryAfterText, words } from './messages.js';
import { CapacityAdjustment } from './InstallationSettings.js';
import { WorkBadge, WorkOptions, workFormFields, type TriggerMode } from './work-form.js';
import { workErrorText, workLabel, workWords } from './work-messages.js';

type Props = PageProps & { displayTimeZone?: string };
type Page<T> = { items: T[]; nextCursor?: string };
const message = (failure: unknown) => failure instanceof ApiError ? failure.code : 'UNAVAILABLE';
const relative = (id: string) => '/reminders/' + encodeURIComponent(id);
const household = (id: string | undefined) => '/households/' + encodeURIComponent(id ?? '');

function displayDate(value: string, locale: Props['locale'], timeZone?: string, includeTime = true) {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' } : {}) })
    .format(new Date(value));
}

export function WorkSchedule({ item, locale, displayTimeZone }: {
  item: Reminder; locale: Props['locale']; displayTimeZone?: string;
}) {
  const trigger = item.currentOccurrence?.override?.trigger ?? item.trigger;
  if (trigger.kind === 'LOCATION') return <p>{trigger.placeName || workWords[locale].LOCATION}
    {trigger.event && ' · ' + workLabel(locale, trigger.event)}</p>;
  const instant = item.currentOccurrence?.scheduledAt ?? trigger.scheduledAt;
  const zone = displayTimeZone ?? trigger.timeZone;
  return <>{instant && <time dateTime={instant}>{displayDate(instant, locale, zone)}{zone && ' · ' + zone}</time>}</>;
}

function useWrite(session: Props['session']) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<Record<string, unknown>>();
  const [retry, setRetry] = useState<number>();
  async function write<T>(path: string, method: string, body?: unknown, revision?: number) {
    if (busy) return;
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const id = JSON.stringify([method, path, payload, revision]);
    const pending = session.pendingWrites;
    const attempt = pending.get(id) ?? { key: crypto.randomUUID() };
    if (attempt.retryAt && attempt.retryAt > Date.now()) {
      setRetry(attempt.retryAt);
      return;
    }
    pending.set(id, attempt);
    setBusy(true); setRetry(undefined); setError(''); setDetails(undefined);
    try {
      const result = await session.request<T>(path, { method, body: payload,
        ...(revision === undefined ? {} : { headers: { 'If-Match': '"' + revision + '"' } }) }, attempt.key);
      pending.delete(id);
      return { result };
    } catch (failure) {
      if (failure instanceof ApiError && failure.retryAt) {
        attempt.retryAt = failure.retryAt;
        setRetry(failure.retryAt);
      }
      if (failure instanceof ApiError && failure.status && failure.status < 500 && ![408, 429].includes(failure.status)) pending.delete(id);
      setDetails(failure instanceof ApiError ? failure.details : undefined);
      setError(message(failure));
    } finally { setBusy(false); }
  }
  return { busy, error, details, retry, write, setError };
}

export function WorkDetail({ session, locale, displayTimeZone, edit }: Props & { edit?: boolean }) {
  const id = useParams().reminderId ?? '';
  const path = household(session.me.householdId) + relative(id);
  const navigate = useNavigate();
  const text = workWords[locale];
  const request = session.request;
  const [item, setItem] = useState<Reminder>();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState<string>();
  const [occurrences, setOccurrences] = useState<Page<WorkOccurrence>>();
  const [changed, setChanged] = useState<WorkOccurrence>();
  const [history, setHistory] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const writer = useWrite(session);
  async function refresh() {
    setItem(await request<Reminder>(path));
  }
  useEffect(() => {
    let live = true;
    setItem(undefined); setError(''); setConfirm(false); setFilter(undefined); setOccurrences(undefined); setChanged(undefined);
    void request<Reminder>(path).then((data) => { if (live) setItem(data); },
      (failure) => { if (live) setError(message(failure)); });
    return () => { live = false; };
  }, [path, request]);
  const home = household(session.me.householdId);
  const showNames = item?.requesterId !== undefined || item?.assigneeIds !== undefined;
  useEffect(() => {
    if (!showNames) return;
    let live = true;
    setMemberNames({});
    void request<{ userId: string; displayName?: string }[]>(home + '/members').then((rows) => {
      if (live && Array.isArray(rows)) {
        setMemberNames(Object.fromEntries(rows.map((row) => [row.userId, row.displayName ?? row.userId])));
      }
    }).catch(() => {});
    return () => { live = false; };
  }, [home, request, showNames]);
  async function loadOccurrences(state: string, cursor?: string) {
    setError('');
    setFilter(state);
    const query = new URLSearchParams();
    if (state) query.set('state', state);
    if (cursor) query.set('cursor', cursor);
    try {
      const result = await request<Page<WorkOccurrence>>(path + '/occurrences' + (query.size ? '?' + query : ''));
      setOccurrences((previous) => ({ ...result, items: cursor ? [...(previous?.items ?? []), ...result.items] : result.items }));
    } catch (failure) { setError(message(failure)); }
  }
  async function action(target: WorkOccurrence, value: string) {
    const result = await writer.write<WorkOccurrence>(household(session.me.householdId) + '/occurrences/' +
      encodeURIComponent(target.occurrenceId) + '/actions', 'POST', { action: value, revision: target.revision });
    if (!result) return;
    setChanged(result.result);
    try {
      await refresh();
      if (filter !== undefined) await loadOccurrences(filter);
    } catch (failure) { setError(message(failure)); }
  }
  async function lifecycle(value: 'ARCHIVE' | 'RESTORE') {
    const result = await writer.write<Reminder>(path + '/lifecycle', 'POST', { action: value, revision: item?.revision });
    if (result) { setItem(result.result); setChanged(undefined); setConfirm(false); }
  }
  async function remove() {
    const result = await writer.write(path, 'DELETE', undefined, item?.revision);
    if (result) navigate(item?.lifecycle === 'ARCHIVED' ? '/reminders/archive' : '/reminders');
  }
  const errorCode = writer.error || error;
  if (!item) return <section>{errorCode ? <p role="alert">{errorText(locale, errorCode)}</p> :
    <p role="status">{words[locale].loading}</p>}</section>;
  if (edit) return <EditWork key={item.reminderId} item={item} session={session} locale={locale} />;
  const current = changed && changed.occurrenceId !== item.currentOccurrence?.occurrenceId ?
    changed : item.currentOccurrence;
  const name = (memberId: string) => memberNames[memberId] ?? memberId;
  const trigger = item.currentOccurrence?.override?.trigger ?? item.trigger;
  function controls(row: WorkOccurrence) {
    return <div className="form-actions" aria-label={text.actions}>
      {(row.allowedActions ?? []).map((value) => <button type="button" disabled={writer.busy} key={value}
        onClick={() => void action(row, value)}>{workLabel(locale, value)}</button>)}
    </div>;
  }
  return <section className="panel">
    <h2>{item.currentOccurrence?.override?.title ?? item.title}</h2>
    {(item.currentOccurrence?.override?.description ?? item.description) !== undefined &&
      <p className="original">{item.currentOccurrence?.override?.description ?? item.description}</p>}
    <WorkSchedule item={item} locale={locale} displayTimeZone={displayTimeZone} />
    <dl className="work-metadata">
      {item.requesterId && <><dt>{text.requester}</dt><dd>{name(item.requesterId)}</dd></>}
      {item.assigneeIds && <><dt>{text.assignees}</dt><dd>{item.assigneeIds.map(name).join(', ') || text.unassigned}</dd></>}
      <dt>{text.trigger}</dt><dd>{workLabel(locale, trigger.kind ?? 'TIME')}
        {trigger.radiusM !== undefined && ' · ' + new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter' }).format(trigger.radiusM)}
        {trigger.durationMinutes !== undefined && ' · ' + new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute' }).format(trigger.durationMinutes)}</dd>
      <dt>{text.recurrence}</dt><dd>{item.recurrence ? workLabel(locale, item.recurrence.frequency) : text.once}
        {item.recurrence && ' · ' + text.interval + ' ' + new Intl.NumberFormat(locale).format(item.recurrence.interval ?? 1)}
        {item.recurrence?.endOn && ' · ' + text.endOn + ' ' + displayDate(item.recurrence.endOn + 'T00:00:00Z', locale, 'UTC', false)}
        {item.recurrence && item.lifecycle === 'ARCHIVED' && ' · ' + text.paused}</dd>
    </dl>
    {item.lifecycle && <WorkBadge locale={locale} state={item.lifecycle} />}
    {errorCode && <p role="alert">{workErrorText(locale, errorCode, writer.details)}
      {writer.retry && ' ' + retryAfterText(locale, writer.retry)}
      {errorCode === 'STALE_REVISION' && <button type="button" onClick={() =>
        void refresh().then(() => { setChanged(undefined); writer.setError(''); }).catch((failure) => setError(message(failure)))}>
        {words[locale].refresh}</button>}</p>}
    {current ? <section><p><WorkBadge locale={locale} state={current.state} /></p>{controls(current)}</section> :
      item.latestOccurrenceState ? <p><WorkBadge locale={locale} state={item.latestOccurrenceState} /></p> :
      <p>{text.noOccurrence}</p>}
    <div className="form-actions">
      {!!item.pendingVerificationCount && <button type="button" onClick={() => void loadOccurrences('VERIFICATION_PENDING')}>
        {text.pending} ({item.pendingVerificationCount})</button>}
      <button type="button" onClick={() => void loadOccurrences('')}>{text.allOccurrences}</button>
      {item.lifecycle === 'ACTIVE' && <Link className="action" to={relative(id) + '/edit'}>{text.edit}</Link>}
      {item.lifecycle && <button type="button" disabled={writer.busy} onClick={() =>
        void lifecycle(item.lifecycle === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVE')}>
        {item.lifecycle === 'ARCHIVED' ? text.restore : text.archiveAction}</button>}
      {item.revision !== undefined && <button type="button" onClick={() => setConfirm(true)}>{text.delete}</button>}
      <button type="button" aria-expanded={history} onClick={() => setHistory(!history)}>{text.history}</button>
    </div>
    {occurrences && <ul className="management-list">{occurrences.items.map((row) => <li key={row.occurrenceId}>
      <WorkBadge locale={locale} state={row.state} />
      {row.scheduledAt && <time dateTime={row.scheduledAt}>{displayDate(row.scheduledAt, locale, displayTimeZone)}</time>}
      {row.override?.title && <p>{row.override.title}</p>}
      {controls(row)}
    </li>)}</ul>}
    {occurrences?.nextCursor && filter !== undefined && <button type="button" onClick={() =>
      void loadOccurrences(filter, occurrences.nextCursor)}>{words[locale].more}</button>}
    {history && <>
      <StateFlow label={text.lifecycle} states={['ACTIVE', 'ARCHIVED']} current={item.lifecycle} locale={locale} />
      <StateFlow label={text.occurrenceFlow}
        states={['PENDING', 'VERIFICATION_PENDING', 'COMPLETED', 'MISSED', 'SKIPPED', 'CANCELLED']}
        current={current?.state ?? item.latestOccurrenceState}
        locale={locale} />
      <WorkHistory session={session} locale={locale} displayTimeZone={displayTimeZone} reminderId={id} />
    </>}
    {confirm && <section role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-hint">
      <h3 id="delete-title">{item.title}</h3>
      <p id="delete-hint">{text.deleteHint}</p>
      <div className="form-actions"><button type="button" disabled={writer.busy} onClick={() => void remove()}>{text.confirm}</button>
        <button type="button" onClick={() => setConfirm(false)}>{words[locale].cancel}</button></div>
    </section>}
  </section>;
}

function StateFlow({ label, states, current, locale }: {
  label: string; states: readonly string[]; current?: string; locale: Props['locale'];
}) {
  return <section aria-label={label}><h3>{label}</h3>
    <ul className="work-state-list">{states.map((state) => <li key={state} aria-current={state === current ? 'step' : undefined}>
      {workLabel(locale, state)}
    </li>)}</ul>
  </section>;
}

function EditWork({ session, locale, item }: PageProps & { item: Reminder }) {
  const text = workWords[locale];
  const label = words[locale];
  const [mode, setMode] = useState<TriggerMode>(item.trigger.kind ?? 'TIME');
  const [scope, setScope] = useState('ENTIRE_SERIES');
  const [occurrenceId, setOccurrenceId] = useState(item.currentOccurrence?.occurrenceId ?? '');
  const navigate = useNavigate();
  const writer = useWrite(session);
  const path = relative(item.reminderId);
  const zone = item.trigger.timeZone ?? session.me.defaultTimeZone ?? 'Asia/Seoul';
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '');
    const description = String(data.get('description') ?? '');
    if (!title.trim()) return writer.setError('TITLE_REQUIRED');
    let fields: ReturnType<typeof workFormFields>;
    try { fields = workFormFields(data, zone, mode); }
    catch (failure) { return writer.setError(failure instanceof ApiError ? failure.code : 'TIME_REQUIRED'); }
    const { trigger, recurrence, requesterId, assigneeIds, verification } = fields;
    const sameTrigger = trigger.kind === 'TIME' ? Date.parse(trigger.scheduledAt ?? '') === Date.parse(item.trigger.scheduledAt ?? '') &&
      trigger.timeZone === item.trigger.timeZone :
      ['kind', 'placeName', 'latitude', 'longitude', 'event', 'durationMinutes', 'radiusM'].every((key) =>
        trigger[key as keyof typeof trigger] === item.trigger[key as keyof typeof item.trigger]);
    const single = scope === 'THIS_OCCURRENCE';
    const payload = {
      ...(title !== item.title ? { title } : {}),
      ...(description !== (item.description ?? '') ? { description } : {}),
      ...(!sameTrigger ? { trigger } : {}), revision: item.revision,
      ...(item.recurrence ? { scope, ...(scope !== 'ENTIRE_SERIES' ? { occurrenceId } : {}) } : {}),
      ...(!single && recurrence && JSON.stringify(recurrence) !== JSON.stringify(item.recurrence) ? { recurrence } : {}),
      ...(!single && requesterId && requesterId !== item.requesterId ? { requesterId } : {}),
      ...(!single && assigneeIds && JSON.stringify([...assigneeIds].sort()) !== JSON.stringify([...(item.assigneeIds ?? [])].sort()) ?
        { assigneeIds } : {}),
      ...(!single && verification ? { verification } :
        !single && item.verification?.enabled && data.has('verifierControl') ? { verification: { enabled: false } } : {}),
    };
    if (await writer.write(household(session.me.householdId) + path, 'PATCH', payload)) navigate(path);
  }
  return <section className="panel"><h2>{text.edit}</h2>
    {writer.error && <p role="alert">{workErrorText(locale, writer.error, writer.details)}{writer.retry && ' ' + retryAfterText(locale, writer.retry)}</p>}
    {writer.error === 'GEOFENCE_CAPACITY_EXCEEDED' && <CapacityAdjustment session={session} locale={locale} details={writer.details} />}
    <form noValidate onSubmit={(event) => void save(event)}>
      <label>{label.title}<input name="title" maxLength={200} defaultValue={item.title} required /></label>
      <label>{label.description}<textarea name="description" defaultValue={item.description} maxLength={4000} rows={4} /></label>
      {mode === 'TIME' && <><label>{label.scheduledAt}<input type="datetime-local" name="scheduledAt"
        defaultValue={item.trigger.scheduledAt && scheduleLocal(new Date(item.trigger.scheduledAt), zone)} /></label><small>{zone}</small></>}
      <WorkOptions session={session} locale={locale} reminder={item} mode={mode} setMode={setMode} />
      {item.recurrence && <label>{text.scope}<select value={scope} onChange={(e) => {
        setScope(e.currentTarget.value); setOccurrenceId(item.currentOccurrence?.occurrenceId ?? '');
      }}>
        <option value="ENTIRE_SERIES">{text.ENTIRE_SERIES}</option>
        {item.currentOccurrence && <><option value="THIS_OCCURRENCE">{text.THIS_OCCURRENCE}</option>
          <option value="THIS_AND_FUTURE">{text.THIS_AND_FUTURE}</option></>}
      </select></label>}
      <div className="form-actions"><button type="submit" className="primary" disabled={writer.busy}>{label.save}</button>
        <Link to={path}>{label.cancel}</Link></div>
    </form>
  </section>;
}

type HistoryItem = { reminderId: string; occurrenceId?: string; kind: string; occurredAt: string; title?: string; actorId?: string };
export function WorkHistory({ session, locale, displayTimeZone, reminderId }: Props & { reminderId?: string }) {
  const [view, setView] = useState(reminderId ? 'HOUSEHOLD' : 'MINE');
  const [records, setRecords] = useState<Page<HistoryItem>>();
  const [error, setError] = useState('');
  const request = session.request;
  const path = household(session.me.householdId) + '/history';
  const text = workWords[locale];
  async function load(cursor?: string, signal?: AbortSignal) {
    try {
      const query = new URLSearchParams({ view, ...(reminderId ? { reminderId } : {}), ...(cursor ? { cursor } : {}) });
      const results = await request<Page<HistoryItem>>(path + '?' + query);
      if (!signal?.aborted) setRecords((old) => ({ ...results, items: cursor ? [...(old?.items ?? []), ...results.items] : results.items }));
    } catch (failure) { if (!signal?.aborted) setError(message(failure)); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setRecords(undefined); setError('');
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [path, request, view, reminderId]);
  return <section>
    <h2>{text.history}</h2>
    {!reminderId && <label>{text.history}<select value={view} onChange={(event) => setView(event.currentTarget.value)}>
      <option value="MINE">{text.mine}</option><option value="HOUSEHOLD">{text.household}</option>
    </select></label>}
    {error && <p role="alert">{errorText(locale, error)}</p>}
    {!records && !error && <p role="status">{words[locale].loading}</p>}
    {records?.items.length === 0 && <p>{text.noHistory}</p>}
    {records && <ol className="management-list">{records.items.map((row, index) => <li key={row.occurredAt + '-' + index}>
      <Link to={relative(row.reminderId)}>{row.title ?? row.reminderId}</Link>{' '}
      <WorkBadge locale={locale} state={row.kind} />{' '}
      <time dateTime={row.occurredAt}>{displayDate(row.occurredAt, locale, displayTimeZone)}</time>
    </li>)}</ol>}
    {records?.nextCursor && <button type="button" onClick={() => void load(records.nextCursor)}>{words[locale].more}</button>}
  </section>;
}
