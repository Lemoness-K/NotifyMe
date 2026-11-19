import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router';
import { localToUtc } from '../server/time.js';
import { api, ApiError, openSession, type ClientConfig, type Me, type Preferences, type Reminder } from './client.js';
import { errorText, localeFor, retryAfterText, words } from './messages.js';
import { HouseholdPreferences, Invitations, Members, PersonalPreferences, SettingsHome } from './Settings.js';

export { errorText, localeFor };
type Locale = ReturnType<typeof localeFor>;
type CreateAttempt = { key: string; title: string; description: string; localTime: string; retryAt?: number };
export type Session = {
  me: Me;
  request: <T>(path: string, init?: RequestInit, key?: string) => Promise<T>;
  end: () => void;
  signOut: () => Promise<void>;
  pendingCreates: Map<string, CreateAttempt>;
  pendingWrites: Map<string, { key: string; retryAt?: number }>;
};
export type PageProps = { session: Session; locale: Locale };

function readInvitation(path: string, hash: string) {
  if (path !== '/invite' || !hash.slice(1)) return undefined;
  return { code: hash.slice(1), key: '' };
}

export function App() {
  const [deviceLocale] = useState(() => localeFor(typeof navigator === 'undefined' ? 'ko-KR' : navigator.language));
  const [config, setConfig] = useState<ClientConfig>();
  const [session, setSession] = useState<Session>();
  const [profile, setProfile] = useState<Me>();
  const [preferences, setPreferences] = useState<Preferences>();
  const activeSession = useRef<Session>(undefined);
  const signOutPending = useRef<Promise<void>>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number>();
  const navigate = useNavigate();
  const location = useLocation();
  const [invitation, setInvitation] = useState(() => readInvitation(location.pathname, location.hash));
  const inviting = location.pathname === '/invite' && !session;
  const storedLocale = preferences?.locale;
  const locale = storedLocale === 'ko-KR' || storedLocale === 'en-US' ? storedLocale : deviceLocale;
  const text = words[locale];
  async function loadConfig() {
    setError('');
    try { setConfig(await api<ClientConfig>('/client-config')); }
    catch { setError('UNAVAILABLE'); }
  }
  useEffect(() => {
    void loadConfig();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (location.pathname === '/invite' && location.hash) {
      setInvitation(readInvitation(location.pathname, location.hash));
      navigate('/invite', { replace: true });
    }
  }, [location.pathname, location.hash, navigate]);

  function closeSession(current: Session, reason = '') {
    if (activeSession.current !== current) return;
    activeSession.current = undefined;
    current.end();
    current.pendingCreates.clear();
    current.pendingWrites.clear();
    setSession(undefined);
    setProfile(undefined);
    setPreferences(undefined);
    setError(reason);
    navigate('/', { replace: true });
  }

  async function login() {
    if (!config || busy || (retryAt !== undefined && Date.now() < retryAt)) return;
    setError('');
    setRetryAt(undefined);
    setBusy(true);
    let credential: Awaited<ReturnType<typeof openSession>> | undefined;
    try {
      await signOutPending.current;
      const join = inviting && invitation ? { ...invitation, key: invitation.key || crypto.randomUUID() } : undefined;
      if (join) setInvitation(join);
      credential = await openSession(config, 'google-button', join);
      const me = await api<Me>('/me', await credential.token());
      const { token, signOut } = credential;
      const controller = new AbortController();
      const signal = controller.signal;
      const current: Session = {
        me, signOut, end: () => controller.abort(), pendingCreates: new Map(), pendingWrites: new Map(),
        async request<T>(path: string, init?: RequestInit, key?: string) {
          try {
            signal.throwIfAborted();
            const bearer = await token();
            signal.throwIfAborted();
            const result = await api<T>(path, bearer, { ...init, signal }, key);
            signal.throwIfAborted();
            return result;
          } catch (failure) {
            if (!signal.aborted && failure instanceof ApiError && failure.status === 401) {
              closeSession(current, 'UNAUTHENTICATED');
              signOutPending.current = signOut().catch(() => {});
            } else if (!signal.aborted && path.startsWith('/households/') &&
                failure instanceof ApiError && failure.code === 'HOUSEHOLD_ACCESS_DENIED') {
              void refreshProfile(current).catch(() => {});
            }
            throw failure;
          }
        },
      };
      activeSession.current = current;
      setSession(current);
      setProfile(me);
      setInvitation(undefined);
      navigate('/reminders', { replace: true });
      // Account settings are optional on older servers and use the same session as the app.
      void current.request<Preferences>('/me/settings').then((saved) => {
        if (activeSession.current === current && Number.isInteger(saved.revision)) {
          setPreferences((existing) => existing && existing.revision > saved.revision ? existing : saved);
        }
      }).catch(() => {});
    } catch (failure) {
      if (credential) await credential.signOut().catch(() => {});
      if (failure instanceof ApiError) setRetryAt(failure.retryAt);
      setError(failure instanceof ApiError
        ? failure.status === 401 ? 'UNAUTHENTICATED' : failure.code
        : 'UNAVAILABLE');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!session || busy) return;
    setError('');
    setBusy(true);
    try {
      await session.request('/sessions/current', { method: 'DELETE' }, crypto.randomUUID());
    } catch (failure) {
      if (activeSession.current === session) {
        setError(failure instanceof ApiError ? failure.code : 'UNAVAILABLE');
      }
      setBusy(false);
      return;
    }
    closeSession(session);
    try { await session.signOut(); }
    catch { setError('UNAVAILABLE'); }
    finally { setBusy(false); }
  }

  async function refreshProfile(current = activeSession.current) {
    if (!current) return;
    const me = await current.request<Me>('/me');
    if (activeSession.current === current) setProfile(me);
  }

  const viewSession = session && profile ? { ...session, me: profile } : session;
  return <main>
    <header><h1>Notify Me</h1>
      {session && <nav aria-label={text.navigation}>
        {profile?.householdId && <Link to="/reminders">{text.reminders}</Link>}
        <Link to="/settings">{text.settings}</Link>
      </nav>}
      {session && <button type="button" onClick={() => void logout()} disabled={busy}>{text.logout}</button>}
    </header>
    {error && <p role="alert">{errorText(locale, error)}</p>}
    {retryAt !== undefined && <p role="status">{retryAfterText(locale, retryAt)}</p>}
    {!session ? <section className="panel">
      <h2>{inviting ? text.inviteJoin : text.login}</h2>
      {inviting && !invitation ? <p role="alert">{text.INVITATION_INVALID}</p> :
        <button type="button" className="primary" onClick={() => void login()} disabled={busy || !config}>
          {inviting ? config?.mode === 'synthetic' ? text.localJoin : text.googleJoin
            : config?.mode === 'synthetic' ? text.localLogin : text.googleLogin}
        </button>}
      {inviting && <Link to="/">{text.login}</Link>}
      {busy && <p role="status">{text.loading}</p>}
      {config?.mode === 'google' && <div id="google-button" />}
      {!config && error && <button type="button" onClick={() => void loadConfig()}>{text.retry}</button>}
    </section> : viewSession &&
      <Routes>
        <Route path="/settings" element={<SettingsHome session={viewSession} locale={locale} />} />
        <Route path="/settings/personal" element={<PersonalPreferences session={viewSession} locale={locale} onSaved={setPreferences} />} />
        <Route path="/settings/household" element={<HouseholdPreferences session={viewSession} locale={locale} onSaved={refreshProfile} />} />
        <Route path="/settings/installation" element={<section className="panel"><h2>{text.installation}</h2><p>{text.installationUnavailable}</p></section>} />
        <Route path="/household/members" element={<Members session={viewSession} locale={locale} onSaved={refreshProfile} />} />
        <Route path="/household/invitations" element={<Invitations session={viewSession} locale={locale} />} />
        <Route path="/reminders/new" element={viewSession.me.householdId
          ? <ReminderForm session={viewSession} locale={locale} /> : <p role="alert">{text.noHousehold}</p>} />
        <Route path="*" element={viewSession.me.householdId
          ? <ReminderList session={viewSession} locale={locale} displayTimeZone={preferences?.timeZone} />
          : <p role="alert">{text.noHousehold}</p>} />
      </Routes>}
  </main>;
}

function listPath(householdId: string) {
  return '/households/' + encodeURIComponent(householdId) + '/reminders';
}

function ReminderList({ session, locale, displayTimeZone }: PageProps & { displayTimeZone?: string }) {
  const text = words[locale];
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryAt, setRetryAt] = useState<number>();
  const path = listPath(session.me.householdId ?? '');
  const requestFromSession = session.request;

  async function load(next?: string, signal?: AbortSignal) {
    if (retryAt !== undefined && retryAt > Date.now()) return;
    setLoading(true);
    setError('');
    setRetryAt(undefined);
    try {
      const suffix = next ? '?' + new URLSearchParams({ cursor: next }) : '';
      const result = await requestFromSession<{ items: Reminder[]; nextCursor?: string }>(path + suffix);
      if (!signal?.aborted) {
        setReminders((current) => next ? [...current, ...result.items] : result.items);
        setCursor(result.nextCursor);
      }
    } catch (failure) {
      if (!signal?.aborted) {
        if (failure instanceof ApiError) setRetryAt(failure.retryAt);
        setError(failure instanceof ApiError ? failure.code : 'UNAVAILABLE');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const request = new AbortController();
    void load(undefined, request.signal);
    return () => request.abort();
  }, [path, requestFromSession]);

  return <section aria-labelledby="list-title">
    <div className="section-title"><h2 id="list-title">{text.reminders}</h2>
      <Link className="primary action" to="/reminders/new">{text.add}</Link>
    </div>
    {error && <p role="alert">{errorText(locale, error)}{' '}
      {retryAt !== undefined && retryAfterText(locale, retryAt)}{' '}
      <button type="button" onClick={() => void load(cursor)}>{text.retry}</button></p>}
    {loading && <p role="status">{text.loading}</p>}
    {!error && !loading && reminders.length === 0 && <p>{text.empty}</p>}
    <ul className="reminders">{reminders.map((item) => <li className="panel" key={item.reminderId}>
      <h3>{item.title}</h3>
      <time dateTime={item.trigger.scheduledAt}>{new Intl.DateTimeFormat(locale, {
        timeZone: displayTimeZone ?? item.trigger.timeZone, dateStyle: 'medium', timeStyle: 'short',
      }).format(new Date(item.trigger.scheduledAt))} · {displayTimeZone ?? item.trigger.timeZone}</time>
      {item.description !== undefined && <p className="original">{item.description}</p>}
    </li>)}</ul>
    {cursor && !error && <button type="button" disabled={loading} onClick={() => void load(cursor)}>{text.more}</button>}
  </section>;
}

function ReminderForm({ session, locale }: PageProps) {
  const text = words[locale];
  const zone = session.me.defaultTimeZone ?? 'Asia/Seoul';
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft] = useState(() => Array.from(session.pendingCreates.values()).at(-1));
  const [retryAt, setRetryAt] = useState(() => {
    const deadline = draft?.retryAt;
    return deadline !== undefined && deadline > Date.now() ? deadline : undefined;
  });
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '');
    const description = String(data.get('description') ?? '');
    if (!title.trim()) {
      setError('TITLE_REQUIRED');
      (event.currentTarget.elements.namedItem('title') as HTMLInputElement).focus();
      return;
    }
    const localTime = String(data.get('scheduledAt') ?? '');
    let scheduledAt: string;
    try { scheduledAt = localToUtc(localTime, zone); }
    catch {
      setError('TIME_REQUIRED');
      (event.currentTarget.elements.namedItem('scheduledAt') as HTMLInputElement).focus();
      return;
    }
    const body = JSON.stringify({ title, description, trigger: { kind: 'TIME', scheduledAt, timeZone: zone } });
    const pending = session.pendingCreates;
    const attempt: CreateAttempt = pending.get(body) ?? { key: crypto.randomUUID(), title, description, localTime };
    if (attempt.retryAt !== undefined && attempt.retryAt > Date.now()) {
      setError('');
      setRetryAt(attempt.retryAt);
      return;
    }
    pending.set(body, attempt);
    const clear = () => { if (pending.get(body) === attempt) pending.delete(body); };
    setBusy(true);
    setError('');
    setRetryAt(undefined);
    try {
      await session.request(listPath(session.me.householdId ?? ''), { method: 'POST', body }, attempt.key);
      clear();
      if (mounted.current) navigate('/reminders');
    } catch (failure) {
      const apiFailure = failure instanceof ApiError ? failure : undefined;
      const status = apiFailure?.status;
      if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) clear();
      if (apiFailure?.retryAt !== undefined) {
        attempt.retryAt = Math.max(attempt.retryAt ?? 0, apiFailure.retryAt);
      }
      if (!mounted.current) return;
      if (attempt.retryAt !== undefined && attempt.retryAt > Date.now()) setRetryAt(attempt.retryAt);
      if (failure instanceof ApiError && failure.field === 'title') setError('TITLE_REQUIRED');
      else if (failure instanceof ApiError && failure.field === 'trigger.scheduledAt') setError('TIME_REQUIRED');
      else setError(failure instanceof ApiError ? failure.code : 'UNAVAILABLE');
      setBusy(false);
    }
  }

  return <section className="panel">
    <h2>{text.add}</h2>
    {(error || retryAt !== undefined) && <p id="form-error" role="alert">
      {error && errorText(locale, error)}{error && retryAt !== undefined && ' '}
      {retryAt !== undefined && retryAfterText(locale, retryAt)}
    </p>}
    <form onSubmit={(event) => void save(event)} noValidate>
      <label>{text.title}<input name="title" required maxLength={200} defaultValue={draft?.title} aria-invalid={error === 'TITLE_REQUIRED' || undefined}
        aria-describedby={error === 'TITLE_REQUIRED' ? 'form-error' : undefined} /></label>
      <label>{text.description}<textarea name="description" maxLength={4000} rows={4} defaultValue={draft?.description} /></label>
      <label>{text.scheduledAt}<input name="scheduledAt" type="datetime-local" required defaultValue={draft?.localTime} aria-invalid={error === 'TIME_REQUIRED' || undefined}
        aria-describedby={error === 'TIME_REQUIRED' ? 'form-error' : 'time-zone'} /></label>
      <small id="time-zone">{zone}</small>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>{busy ? text.loading : text.save}</button>
        <Link className="action" to="/reminders">{text.cancel}</Link>
      </div>
    </form>
  </section>;
}
