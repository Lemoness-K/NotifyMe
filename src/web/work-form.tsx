import { useEffect, useState } from 'react';
import { localToUtc } from '../server/time.js';
import type { PageProps } from './App.js';
import { ApiError, type Reminder } from './client.js';
import { words } from './messages.js';
import { workWords, workLabel } from './work-messages.js';

export type TriggerMode = 'TIME' | 'LOCATION';
const events = ['ENTER', 'EXIT', 'DWELL', 'AFTER_EXIT'] as const;
const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const repeats = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
const obtain = (data: FormData, name: string) => String(data.get(name) ?? '');

export function workFormFields(data: FormData, zone: string, mode: TriggerMode) {
  const assigned = data.getAll('assigneeIds').map(String).filter(Boolean);
  const requesterId = obtain(data, 'requesterId');
  const verifierId = obtain(data, 'verifierId');
  const frequency = obtain(data, 'frequency');
  const place = obtain(data, 'event');
  const duration = obtain(data, 'durationMinutes');
  const radiusM = obtain(data, 'radiusM');
  function coordinate(name: string) {
    const value = obtain(data, name);
    if (!value.trim() || !Number.isFinite(Number(value))) throw new ApiError('INVALID_FIELD', 'trigger.' + name);
    return Number(value);
  }
  const trigger = mode === 'LOCATION' ? {
    kind: mode, placeName: obtain(data, 'placeName'), latitude: coordinate('latitude'), longitude: coordinate('longitude'),
    event: place, ...(radiusM ? { radiusM: Number(radiusM) } : {}), ...(duration ? { durationMinutes: Number(duration) } : {}),
  } : { kind: mode, scheduledAt: localToUtc(obtain(data, 'scheduledAt'), zone), timeZone: zone };
  const chosenDays = data.getAll('weekdays').map(String);
  const monthDay = obtain(data, 'monthDay');
  const end = obtain(data, 'endOn');
  const verification = data.has('verify') ? { verification: { enabled: true, verifierId } } : {};
  return {
    trigger, ...(requesterId ? { requesterId } : {}), ...(assigned.length ? { assigneeIds: assigned } : {}), ...verification,
    ...(frequency ? { recurrence: { frequency, interval: Number(obtain(data, 'interval') || '1'),
      ...(chosenDays.length ? { weekdays: chosenDays } : {}),
      ...(data.has('lastDayOfMonth') ? { lastDayOfMonth: true } : monthDay ? { monthDays: [Number(monthDay)] } : {}),
      ...(end ? { endOn: end } : {}) } } : {}),
  };
}

export function WorkOptions({ session, locale, reminder, mode, setMode }: PageProps &
  { reminder?: Reminder; mode: TriggerMode; setMode: (mode: TriggerMode) => void }) {
  const text = workWords[locale];
  const [members, setMembers] = useState<{ userId: string; displayName?: string }[]>([]);
  const [radius, setRadius] = useState({ min: 50, default: 100, max: 500 });
  const [editedRadius, setEditedRadius] = useState<number>();
  const [maxMinutes, setMaxMinutes] = useState(60);
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState(reminder?.trigger.event ?? 'ENTER');
  const [frequency, setFrequency] = useState(reminder?.recurrence?.frequency ?? '');
  const [verify, setVerify] = useState(reminder?.verification?.enabled ?? false);
  const [assigned, setAssigned] = useState(reminder?.assigneeIds ?? [session.me.userId]);
  const request = session.request;
  const home = '/households/' + encodeURIComponent(session.me.householdId ?? '');
  useEffect(() => {
    if (!open) return;
    let live = true;
    void request<typeof members>(home + '/members').then((rows) => {
      if (live && Array.isArray(rows)) setMembers(rows);
    }).catch(() => {});
    void request<{ radiusM: typeof radius; maxLocationDurationMin: number }>(home + '/settings').then((settings) => {
      if (live && settings.radiusM) setRadius(settings.radiusM);
      if (live && settings.maxLocationDurationMin) setMaxMinutes(settings.maxLocationDurationMin);
    }).catch(() => {});
    return () => { live = false; };
  }, [home, request, open]);
  const sustained = event === 'DWELL' || event === 'AFTER_EXIT';
  const name = (member: typeof members[number]) => member.displayName ?? member.userId;
  const labelDay = (index: number) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, index + 1)));
  const rawRadius = editedRadius ?? reminder?.trigger.radiusM ?? radius.default;
  const radiusSteps = Math.ceil((radius.max - radius.min) / 25);
  const radiusIndex = rawRadius === radius.max ? radiusSteps : Math.min(radiusSteps, Math.max(0, Math.round((rawRadius - radius.min) / 25)));
  return <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="work-options">
    <summary>{text.options}</summary>
    {!!members.length && <><label>{text.requester}<select name="requesterId" defaultValue={reminder?.requesterId ?? ''}>
      <option value="">{words[locale].selectMember}</option>{members.map((member) =>
        <option value={member.userId} key={member.userId}>{name(member)}</option>)}</select></label>
    <label>{text.assignees}<select multiple name="assigneeIds" value={assigned} onChange={(e) =>
      setAssigned(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>
      {members.map((member) => <option value={member.userId} key={member.userId}>{name(member)}</option>)}</select></label></>}
    <label>{text.trigger}<select value={mode} onChange={(e) => setMode(e.currentTarget.value as TriggerMode)}>
      <option value="TIME">{text.TIME}</option><option value="LOCATION">{text.LOCATION}</option>
    </select></label>
    {mode === 'LOCATION' && <>
      <label>{text.placeName}<input name="placeName" defaultValue={reminder?.trigger.placeName} /></label>
      <div className="work-grid">{(['latitude','longitude'] as const).map((coord) =>
        <label key={coord}>{text[coord]}<input type="number" step="any" name={coord} defaultValue={reminder?.trigger[coord]} /></label>)}</div>
      <label>{text.adjustRadius}<input type="range" min={0} max={radiusSteps} value={radiusIndex}
        aria-valuetext={new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter' }).format(rawRadius)}
        disabled={radiusSteps === 0} onChange={(e) =>
          setEditedRadius(Math.min(radius.max, radius.min + Number(e.currentTarget.value) * 25))} /></label>
      <span>{text.radius} {new Intl.NumberFormat(locale).format(rawRadius)}</span>
      <input name="radiusM" type="hidden" value={rawRadius} />
      <label>{text.event}<select name="event" value={event} onChange={(e) => setEvent(e.currentTarget.value)}>
        {events.map((item) => <option value={item} key={item}>{text[item]}</option>)}</select></label>
      {sustained && <label>{text.duration}<input name="durationMinutes" type="number" min={1} max={maxMinutes}
        defaultValue={reminder?.trigger.durationMinutes ?? Math.min(10, maxMinutes)} list="work-durations" />
        <datalist id="work-durations">{[5, 10, 15, 30, 60].filter((value) => value <= maxMinutes).map((n) => <option key={n} value={n} />)}</datalist></label>}
    </>}
    <label>{text.recurrence}<select name="frequency" value={frequency} onChange={(e) => setFrequency(e.currentTarget.value)}>
      <option value="" disabled={!!reminder?.recurrence}>{text.once}</option>
      {repeats.map((item) => <option value={item} key={item}>{text[item]}</option>)}</select></label>
    {frequency && <>
      <label>{text.interval}<input type="number" name="interval" min={1} defaultValue={reminder?.recurrence?.interval ?? 1} /></label>
      <label>{text.endOn}<input type="date" name="endOn" defaultValue={reminder?.recurrence?.endOn} /></label>
    </>}
    {frequency === 'WEEKLY' && <fieldset><legend>{text.weeklyDays}</legend><div className="work-days">
      {days.map((day, index) => <label key={day}><input type="checkbox" name="weekdays" value={day}
        defaultChecked={reminder?.recurrence?.weekdays?.includes(day)} />{labelDay(index)}</label>)}</div></fieldset>}
    {frequency === 'MONTHLY' && <>
      <label>{text.monthDays}<input type="number" name="monthDay" min={1} max={31} defaultValue={reminder?.recurrence?.monthDays?.[0]} /></label>
      <label className="check-row"><input type="checkbox" name="lastDayOfMonth" defaultChecked={reminder?.recurrence?.lastDayOfMonth} />{text.lastDay}</label>
    </>}
    {!!members.length && <><input type="hidden" name="verifierControl" value="1" />
      <label className="check-row"><input type="checkbox" name="verify" checked={verify} onChange={(e) => setVerify(e.currentTarget.checked)} />
        {text.verification}</label></>}
    {verify && members.length > 0 && <label>{text.verifier}<select name="verifierId" defaultValue={reminder?.verification?.verifierId ?? ''}>
      <option value="">{text.select}</option>{members.filter((member) => !assigned.includes(member.userId))
        .map((member) => <option value={member.userId} key={member.userId}>{name(member)}</option>)}</select></label>}
  </details>;
}

export function WorkBadge({ state, locale }: { state: string; locale: PageProps['locale'] }) {
  return <span className="work-badge">{workLabel(locale, state)}</span>;
}
