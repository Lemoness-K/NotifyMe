import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PageProps, Session } from './App.js';
import { ApiError, type Preferences, type Role } from './client.js';
import { errorText, retryAfterText, words } from './messages.js';

type Locale = PageProps['locale'];
type InvitationStatus = 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';
type Invite = { invitationId: string; status: InvitationStatus; createdAt: string; expiresAt: string };
type InvitationPage = { items: Invite[]; nextCursor?: string };
type IssuedInvite = { invitationId: string; inviteUrl: string; expiresAt: string };
type Person = { userId: string; revision: number; role: Role; displayName?: string };
type Policy = {
  revision: number; defaultTimeZone: string; radiusM: { min: number; default: number; max: number };
  maxLocationDurationMin: number; weeklyCalendarConvention: string;
};
type Catalog = { key: string; scope: 'USER' | 'HOUSEHOLD' | 'INSTALLATION' | 'REMINDER'; validation: Record<string, unknown> }[];
type Attempt = { key: string; retryAt?: number };

const calendarOptions = ['MONDAY_START', 'SUNDAY_START', 'ISO_8601'] as const;
const householdPath = (session: Session) => '/households/' + encodeURIComponent(session.me.householdId ?? '');
const issueTime = (time: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time));

function asError(failure: unknown) {
  return failure instanceof ApiError ? failure : new ApiError('UNAVAILABLE');
}

function useRead<T>(request: Session['request'], path?: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const retryAt = useRef<number>(0);
  const load = useCallback(async () => {
    if (!path || retryAt.current > Date.now()) return;
    const version = ++sequence.current;
    setError(undefined);
    setLoading(true);
    try {
      const value = await request<T>(path);
      if (sequence.current === version) setData(value);
    } catch (failure) {
      if (sequence.current === version) {
        const issue = asError(failure);
        retryAt.current = issue.retryAt ?? 0;
        setError(issue);
      }
    } finally {
      if (sequence.current === version) setLoading(false);
    }
  }, [request, path]);
  useEffect(() => {
    setData(undefined);
    retryAt.current = 0;
    void load();
    return () => { sequence.current++; };
  }, [load]);
  return { data, setData, error, loading, load };
}

function useWrite(session: Session) {
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  async function submit<T>(
    path: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, onSuccess: (result: T) => void,
    headers?: Record<string, string>,
  ) {
    if (inflight.current) return;
    const json = body === undefined ? undefined : JSON.stringify(body);
    const action = JSON.stringify([path, method, json, headers]);
    const stored = session.pendingWrites.get(action);
    const attempt: Attempt = stored ?? { key: crypto.randomUUID() };
    if (attempt.retryAt !== undefined && attempt.retryAt > Date.now()) {
      setError(new ApiError(error?.code ?? 'RATE_LIMITED', undefined, undefined, attempt.retryAt));
      return;
    }
    session.pendingWrites.set(action, attempt);
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    let result: T;
    try {
      result = await session.request<T>(path, { method, body: json, headers }, attempt.key);
    } catch (failure) {
      const issue = asError(failure);
      if (issue.retryAt !== undefined) attempt.retryAt = issue.retryAt;
      if (issue.status !== undefined && issue.status >= 400 && issue.status < 500 && issue.status !== 408 && issue.status !== 429) {
        session.pendingWrites.delete(action);
      }
      setError(issue);
      return;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
    session.pendingWrites.delete(action);
    onSuccess(result);
  }
  return { error, busy, submit, clearError: () => setError(undefined) };
}

function ErrorNotice({ locale, error, retry }: { locale: Locale; error?: ApiError; retry?: () => void }) {
  if (!error) return null;
  return <p role="alert">
    {errorText(locale, error.code)}{' '}
    {error.retryAt !== undefined && retryAfterText(locale, error.retryAt)}{' '}
    {retry && <button type="button" onClick={retry}>{words[locale].retry}</button>}
  </p>;
}

function Panel({ locale, title, children }: { locale: Locale; title: string; children: ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}
    <p><Link to="/settings">{words[locale].settings}</Link></p>
  </section>;
}

export function SettingsHome({ locale, session }: PageProps) {
  const text = words[locale];
  return <section className="panel">
    <h2>{text.settings}</h2>
    <ul>
      <li><Link to="/settings/personal">{text.personal}</Link></li>
      {session.me.householdId && <>
        <li><Link to="/settings/household">{text.household}</Link></li>
        <li><Link to="/household/members">{text.members}</Link></li>
      </>}
      {session.me.householdRole === 'ADMIN' && <li><Link to="/household/invitations">{text.invitations}</Link></li>}
      <li><Link to="/settings/installation">{text.installation}</Link></li>
    </ul>
  </section>;
}

export function PersonalPreferences({ locale, session, onSaved }: PageProps & { onSaved: (result: Preferences) => void }) {
  const text = words[locale];
  const read = useRead<Preferences>(session.request, '/me/settings');
  const write = useWrite(session);
  const [saved, setSaved] = useState(false);
  return <Panel locale={locale} title={text.personal}>
    <ErrorNotice locale={locale} error={read.error} retry={() => void read.load()} />
    <ErrorNotice locale={locale} error={write.error} />
    {read.loading && <p role="status">{text.loading}</p>}
    {saved && <p role="status">{text.saved}</p>}
    {read.data && <form key={read.data.revision} onSubmit={(event) => {
      event.preventDefault();
      const input = new FormData(event.currentTarget);
      const timeZone = String(input.get('timeZone') ?? '').trim();
      const body = { revision: read.data!.revision, locale: input.get('locale'), ...(timeZone && { timeZone }) };
      setSaved(false);
      void write.submit<Preferences>('/me/settings', 'PATCH', body, (result) => {
        read.setData(result);
        onSaved(result);
        setSaved(true);
      });
    }}>
      <label>{text.locale}<select name="locale" defaultValue={read.data.locale ?? locale}>
        <option value="ko-KR">한국어</option><option value="en-US">English</option>
      </select></label>
      <label>{text.timeZone}<input name="timeZone" maxLength={128} placeholder="Asia/Seoul" defaultValue={read.data.timeZone ?? ''} /></label>
      <div className="form-actions">
        <button className="primary" type="submit" disabled={write.busy}>{text.save}</button>
        {write.error?.status === 409 && <button type="button" onClick={() => void read.load()}>{text.refresh}</button>}
      </div>
    </form>}
  </Panel>;
}

export function HouseholdPreferences({ locale, session, onSaved }: PageProps & { onSaved: () => Promise<void> }) {
  const text = words[locale];
  const home = session.me.householdId;
  const path = householdPath(session) + '/settings';
  const read = useRead<Policy>(session.request, home ? path : undefined);
  const catalog = useRead<Catalog>(session.request, home ? '/settings/catalog' : undefined);
  const write = useWrite(session);
  const admin = session.me.householdRole === 'ADMIN';
  const [saved, setSaved] = useState(false);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!read.data || !admin) return;
    const input = new FormData(event.currentTarget);
    const body = {
      revision: read.data.revision,
      defaultTimeZone: input.get('defaultTimeZone'),
      radiusM: { min: Number(input.get('min')), default: Number(input.get('default')), max: Number(input.get('max')) },
      maxLocationDurationMin: Number(input.get('maxLocationDurationMin')),
      weeklyCalendarConvention: input.get('weeklyCalendarConvention'),
    };
    setSaved(false);
    void write.submit<Policy>(path, 'PATCH', body, (result) => {
      read.setData(result);
      setSaved(true);
      void onSaved().catch(() => {});
    });
  }
  const data = read.data;
  const duration = catalog.data?.find((setting) => setting.scope === 'HOUSEHOLD' && setting.key === 'maxLocationDurationMin')?.validation;
  const durationMin = typeof duration?.minimum === 'number' ? duration.minimum : 10;
  const durationMax = typeof duration?.maximum === 'number' ? duration.maximum : 1440;
  return <Panel locale={locale} title={text.household}>
    {!home && <p role="alert">{text.noHousehold}</p>}
    <ErrorNotice locale={locale} error={read.error} retry={() => void read.load()} />
    <ErrorNotice locale={locale} error={write.error} />
    {read.loading && <p role="status">{text.loading}</p>}
    {saved && <p role="status">{text.saved}</p>}
    {data && <form key={data.revision} onSubmit={save}>
      <label>{text.defaultTimeZone}<input name="defaultTimeZone" disabled={!admin} required defaultValue={data.defaultTimeZone} /></label>
      <label>{text.radiusMin}<input name="min" disabled={!admin} type="number" min="0" required defaultValue={data.radiusM.min} /></label>
      <label>{text.radiusDefault}<input name="default" disabled={!admin} type="number" min="0" required defaultValue={data.radiusM.default} /></label>
      <label>{text.radiusMax}<input name="max" disabled={!admin} type="number" min="0" required defaultValue={data.radiusM.max} /></label>
      <label>{text.maxDuration}<input name="maxLocationDurationMin" disabled={!admin} type="number" min={durationMin} max={durationMax} required defaultValue={data.maxLocationDurationMin} /></label>
      <label>{text.calendar}<select name="weeklyCalendarConvention" disabled={!admin} defaultValue={data.weeklyCalendarConvention}>
        {[text.monday, text.sunday, text.isoWeek].map((label, index) => <option key={label} value={calendarOptions[index]}>{label}</option>)}
      </select></label>
      {admin && <><p>{text.radiusNotice}</p><div className="form-actions">
        <button className="primary" type="submit" disabled={write.busy}>{text.save}</button>
        {write.error?.status === 409 && <button type="button" onClick={() => void read.load()}>{text.refresh}</button>}
      </div></>}
    </form>}
  </Panel>;
}

export function Invitations({ locale, session }: PageProps) {
  const text = words[locale];
  const admin = !!session.me.householdId && session.me.householdRole === 'ADMIN';
  const path = householdPath(session) + '/invitations';
  const write = useWrite(session);
  const [cursor, setCursor] = useState<string>();
  const read = useRead<InvitationPage>(session.request, admin ? path + (cursor ? '?' + new URLSearchParams({ cursor }) : '') : undefined);
  const [issued, setIssued] = useState<IssuedInvite>();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [recoveryId, setRecoveryId] = useState<string>();
  const inviteStatus = { ACTIVE: text.active, CONSUMED: text.consumed, REVOKED: text.revoked, EXPIRED: text.expired };
  useEffect(() => {
    if (write.error?.code === 'INVITATION_ALREADY_ISSUED' && typeof write.error.details?.invitationId === 'string') {
      setRecoveryId(write.error.details.invitationId);
    }
  }, [write.error]);
  function refreshFirstPage() {
    if (cursor) setCursor(undefined);
    else void read.load();
  }
  function revoke(id: string) {
    void write.submit(path + '/' + encodeURIComponent(id), 'DELETE', undefined, () => {
      if (issued?.invitationId === id) setIssued(undefined);
      if (recoveryId === id) setRecoveryId(undefined);
      refreshFirstPage();
    });
  }
  if (!admin) return <Panel locale={locale} title={text.invitations}><p role="alert">{text.ADMIN_REQUIRED}</p></Panel>;
  return <Panel locale={locale} title={text.invitations}>
    <ErrorNotice locale={locale} error={read.error} retry={() => void read.load()} />
    <ErrorNotice locale={locale} error={write.error} />
    {recoveryId && <button type="button" disabled={write.busy} onClick={() => revoke(recoveryId)}>{text.revoke}</button>}
    <form onSubmit={(event) => {
      event.preventDefault();
      if (recoveryId) return;
      const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
      setIssued(undefined);
      setCopied(false);
      setCopyFailed(false);
      void write.submit<IssuedInvite>(path, 'POST', { email }, (result) => {
        setIssued(result);
        refreshFirstPage();
      });
    }}>
      <label>{text.email}<input name="email" type="email" required autoComplete="off" maxLength={254} /></label>
      <div className="form-actions"><button className="primary" type="submit" disabled={write.busy || !!recoveryId}>{text.issue}</button></div>
    </form>
    {issued && <div>
      <label>{text.inviteLink}<input name="inviteUrl" readOnly value={issued.inviteUrl} onFocus={(event) => event.target.select()} /></label>
      <div className="form-actions"><button type="button" onClick={() => {
        void navigator.clipboard?.writeText(issued.inviteUrl).then(() => setCopied(true), () => setCopyFailed(true));
        if (!navigator.clipboard) setCopyFailed(true);
      }}>{text.copy}</button></div>
      {copied && <p role="status">{text.copied}</p>}
      {copyFailed && <p role="alert">{text.UNAVAILABLE}</p>}
    </div>}
    {read.loading && <p role="status">{text.loading}</p>}
    {read.data?.items.length === 0 && <p>{text.emptyInvites}</p>}
    <ul className="management-list">{read.data?.items.map((item) => <li key={item.invitationId}>
      <span>{inviteStatus[item.status]} · {text.expires}{' '}
        <time dateTime={item.expiresAt}>{issueTime(item.expiresAt, locale)}</time></span>
      {item.status === 'ACTIVE' && <button type="button" disabled={write.busy} onClick={() => revoke(item.invitationId)}>{text.revoke}</button>}
    </li>)}</ul>
    {read.data?.nextCursor && <button type="button" onClick={() => setCursor(read.data?.nextCursor)}>{text.more}</button>}
    {cursor && <button type="button" onClick={refreshFirstPage}>{text.refresh}</button>}
  </Panel>;
}

export function Members({ locale, session, onSaved }: PageProps & { onSaved: () => Promise<void> }) {
  const text = words[locale];
  const home = session.me.householdId;
  const admin = session.me.householdRole === 'ADMIN';
  const path = householdPath(session) + '/members';
  const read = useRead<Person[]>(session.request, home ? path : undefined);
  const write = useWrite(session);
  const [selection, setSelection] = useState<{ person: Person; removing: boolean }>();
  const people = read.data ?? [];
  const lastAdmin = selection?.person.role === 'ADMIN' && people.filter((person) => person.role === 'ADMIN').length === 1;
  const personName = (person: Person) => person.displayName ?? person.userId;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const { person, removing } = selection;
    const selected = new FormData(event.currentTarget).get('successorAdminId');
    const successor = lastAdmin && typeof selected === 'string' && selected ? selected : undefined;
    const memberPath = path + '/' + encodeURIComponent(person.userId);
    const changed = () => {
      setSelection(undefined);
      void onSaved().catch(() => {});
      if (!removing || person.userId !== session.me.userId) void read.load();
    };
    if (removing) {
      void write.submit(memberPath + (successor ? '?' + new URLSearchParams({ successorAdminId: successor }) : ''), 'DELETE',
        undefined, changed, { 'If-Match': '"' + person.revision + '"' });
    } else {
      void write.submit(memberPath, 'PATCH', {
        revision: person.revision, role: person.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
        ...(successor && { successorAdminId: successor }),
      }, changed);
    }
  }
  return <Panel locale={locale} title={text.members}>
    {!home && <p role="alert">{text.noHousehold}</p>}
    <ErrorNotice locale={locale} error={read.error} retry={() => void read.load()} />
    <ErrorNotice locale={locale} error={write.error} />
    {read.loading && <p role="status">{text.loading}</p>}
    <ul className="management-list">{people.map((person) => <li key={person.userId}>
      <span>{personName(person)} · {person.role === 'ADMIN' ? text.admin : text.member}</span>
      {admin && <div className="form-actions">
        <button type="button" onClick={() => { write.clearError(); setSelection({ person, removing: false }); }}>{personName(person)} {text.roleTo}</button>
        <button type="button" onClick={() => { write.clearError(); setSelection({ person, removing: true }); }}>{personName(person)} {text.remove}</button>
      </div>}
    </li>)}</ul>
    {admin && selection && <form key={selection.person.userId + selection.removing} onSubmit={save}>
      <h3>{personName(selection.person)} · {selection.removing ? text.confirmRemove : text.roleTo}</h3>
      {selection.removing && <p>{text.confirmRemoveHint}</p>}
      {lastAdmin && <label>{text.successor}<select name="successorAdminId" required defaultValue="">
        <option value="">{text.selectMember}</option>
        {people.filter((person) => person.role === 'MEMBER').map((person) =>
          <option key={person.userId} value={person.userId}>{personName(person)}</option>)}
      </select></label>}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={write.busy}>{selection.removing ? text.confirmRemove : text.save}</button>
        <button type="button" onClick={() => setSelection(undefined)}>{text.cancel}</button>
        {write.error?.status === 409 && <button type="button" onClick={() => { setSelection(undefined); void read.load(); }}>{text.refresh}</button>}
      </div>
    </form>}
  </Panel>;
}
