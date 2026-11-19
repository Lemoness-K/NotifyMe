import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { PageProps } from './App.js';
import { deviceError } from './client.js';
import { androidDevice, type DeviceSetting, type DeviceStatus } from './device.js';
import { words } from './messages.js';
import { ErrorNotice, useRead, useWrite } from './Settings.js';
import { workErrorText } from './work-messages.js';

type LocationItem = { reminderId: string; title: string; excluded: boolean; slots: number };
type LocationPage = { epoch: string; revision: number; locationCapacity: { state: 'ACTIVE' | 'CAPACITY_PENDING'; requiredSlots: number; limit: number };
  items: LocationItem[]; nextCursor?: string };

const english = {
  heading: 'Location capacity', open: 'Manage this device’s location capacity', close: 'Close location capacity',
  pending: 'Location monitoring is waiting for capacity', active: 'Location plans fit on this device',
  exclude: 'Exclude', restore: 'Restore', confirmExclude: 'Confirm exclusion', confirmRestore: 'Confirm restoration',
  excluded: 'Excluded on this device', included: 'Included on this device', empty: 'No assigned location reminders.',
  refreshing: 'Connecting this device…', restart: 'First page', stale: 'The list changed. Review your choice and confirm again.',
  device: 'Installation', slots: 'Slots', notification: 'Notifications', time: 'Time reminder channel', location: 'Location reminder channel',
  allowed: 'enabled', restricted: 'disabled', exact: 'Exact alarms', late: 'delivery may be delayed',
  background: 'Background location', openNotification: 'Open notification settings', openTime: 'Open time channel settings',
  openLocation: 'Open location channel settings', openExact: 'Open exact alarm settings', openBackground: 'Open location permissions',
  remote: 'Manage exclusions on the affected Android device, then try saving again.',
};
const labels: Record<PageProps['locale'], typeof english> = { 'en-US': english, 'ko-KR': {
  heading: '장소 용량', open: '이 기기의 장소 용량 관리', close: '장소 용량 닫기',
  pending: '장소 감시가 용량 확보를 기다리고 있습니다', active: '이 기기에서 장소 감지 계획을 수용할 수 있습니다',
  exclude: '제외', restore: '복원', confirmExclude: '제외 확인', confirmRestore: '복원 확인',
  excluded: '이 기기에서 제외됨', included: '이 기기에서 사용 중', empty: '배정된 장소 리마인더가 없습니다.',
  refreshing: '이 기기를 연결하는 중…', restart: '첫 페이지', stale: '목록이 바뀌었습니다. 선택을 다시 확인해 주세요.',
  device: '설치 기기', slots: '슬롯', notification: '알림', time: '시간 알림 채널', location: '장소 알림 채널',
  allowed: '허용됨', restricted: '꺼짐', exact: '정확 알람', late: '지연될 수 있음',
  background: '백그라운드 위치', openNotification: '알림 설정 열기', openTime: '시간 채널 설정 열기',
  openLocation: '장소 채널 설정 열기', openExact: '정확 알람 설정 열기', openBackground: '위치 권한 열기',
  remote: '영향받은 Android 기기에서 제외를 조정하고 저장을 다시 시도해 주세요.',
} };

export function InstallationSettings({ locale, session }: PageProps) {
  const text = words[locale];
  const label = labels[locale];
  const device = androidDevice();
  const bound = session.installation;
  const [status, setStatus] = useState<DeviceStatus>();
  const [error, setError] = useState<ReturnType<typeof deviceError>>();
  const readStatus = useCallback(() => {
    setError(undefined);
    void device?.status().then(setStatus, (failure) => setError(deviceError(failure)));
  }, [device]);

  useEffect(() => {
    if (!device || !bound) return;
    readStatus();
    const listener = device.addListener('capabilitiesChanged', readStatus);
    return () => { void listener.then((active) => active.remove()).catch(() => {}); };
  }, [device, bound, readStatus]);

  const flags: [DeviceSetting, string, string, string][] = status ? [
    ['notification', label.notification, status.notifications ? label.allowed : label.restricted, label.openNotification],
    ['timeChannel', label.time, status.timeChannel ? label.allowed : label.restricted, label.openTime],
    ['locationChannel', label.location, status.locationChannel ? label.allowed : label.restricted, label.openLocation],
    ['exact', label.exact, status.exactAlarms ? label.allowed : label.late, label.openExact],
    ['location', label.background, status.location ? label.allowed : label.restricted, label.openBackground],
  ] : [];
  return <section className="panel">
    <h2>{text.installation}</h2>
    {!device && <p>{text.installationUnavailable}</p>}
    {device && !bound && (session.installationError ? <ErrorNotice locale={locale} error={session.installationError} retry={session.retryInstallation} /> :
      <p role="status">{label.refreshing}</p>)}
    {bound && <><p>{label.device} <strong>{bound.installationName}</strong></p>
      <ErrorNotice locale={locale} error={error} retry={readStatus} />
      {flags.length > 0 && <ul className="installation-options">{flags.map(([kind, name, value, action]) =>
        <li key={kind}><span>{name}: {value}</span><button type="button" onClick={() => {
          void device?.openSettings({ kind }).catch((failure) => setError(deviceError(failure)));
        }}>{action}</button></li>)}</ul>}
      {session.me.householdId && <LocationCapacity key={`${session.me.householdId}/${bound.installationId}`} session={session} locale={locale} device={bound} />}
    </>}
    <Link to="/settings">{text.settings}</Link>
  </section>;
}

export function CapacityAdjustment({ session, locale, details }: PageProps & { details?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const label = labels[locale];
  const device = session.installation;
  if (!device || details?.installationId !== device.installationId) return <p>{label.remote}</p>;
  return <div>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? label.close : label.open}</button>
    {open && <LocationCapacity key={`${session.me.householdId}/${device.installationId}`} session={session} locale={locale} device={device} />}
  </div>;
}

function LocationCapacity({ session, locale, device }: PageProps & { device: DeviceStatus }) {
  const label = labels[locale];
  const text = words[locale];
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<{ reminderId: string; title: string; excluded: boolean }>();
  const path = `/households/${encodeURIComponent(session.me.householdId ?? '')}/installations/${encodeURIComponent(device.installationId)}/location-exclusions`;
  const read = useRead<LocationPage>(session.request, path + (cursor ? `?${new URLSearchParams({ cursor })}` : ''));
  const write = useWrite(session);
  const data = read.data;
  const capacity = data?.locationCapacity;

  useEffect(() => {
    if (write.error?.code === 'STALE_REVISION') {
      if (cursor) setCursor(undefined);
      else void read.load();
    }
  }, [write.error, cursor, read.load]);

  async function apply() {
    if (!selected || !data) return;
    await write.submit(path + '/' + encodeURIComponent(selected.reminderId), 'PUT',
      { excluded: selected.excluded, epoch: data.epoch, revision: data.revision }, () => {
        setSelected(undefined);
        if (cursor) setCursor(undefined);
        else void read.load();
      });
  }
  return <section className="location-capacity" aria-label={label.heading}>
    <h3>{label.heading}</h3>
    {read.loading && <p role="status">{text.loading}</p>}
    <ErrorNotice locale={locale} error={read.error} retry={() => void read.load()} />
    {write.error?.code === 'STALE_REVISION' ? <p role="alert">{label.stale}</p> :
      write.error?.code === 'GEOFENCE_CAPACITY_EXCEEDED' ? <p role="alert">{workErrorText(locale, write.error.code, write.error.details)}</p> :
      <ErrorNotice locale={locale} error={write.error} />}
    {capacity && <p role="status">{capacity.state === 'CAPACITY_PENDING' ? label.pending : label.active} ({capacity.requiredSlots}/{capacity.limit})</p>}
    {data?.items.length === 0 && <p>{label.empty}</p>}
    <ul className="installation-options">{data?.items.map((item) => <li key={item.reminderId}>
      <span><strong>{item.title}</strong><small>{item.excluded ? label.excluded : label.included} · {label.slots} {item.slots}</small></span>
      <button type="button" disabled={write.busy || read.loading} onClick={() => {
        write.clearError();
        setSelected({ reminderId: item.reminderId, title: item.title, excluded: !item.excluded });
      }}>{item.excluded ? label.restore : label.exclude}</button>
    </li>)}</ul>
    {selected && <div className="location-confirm" role="group" aria-label={selected.excluded ? label.confirmExclude : label.confirmRestore}>
      <p>{selected.title} · {device.installationName}</p>
      <button type="button" disabled={write.busy || read.loading || !data} onClick={() => void apply()}>
        {selected.excluded ? label.confirmExclude : label.confirmRestore}
      </button>{' '}
      <button type="button" disabled={write.busy} onClick={() => { setSelected(undefined); write.clearError(); }}>{text.cancel}</button>
    </div>}
    <div className="form-actions">
      {cursor && <button type="button" onClick={() => setCursor(undefined)}>{label.restart}</button>}
      {data?.nextCursor && <button type="button" disabled={read.loading || write.busy || !!selected} onClick={() => setCursor(data.nextCursor)}>{text.more}</button>}
    </div>
  </section>;
}
