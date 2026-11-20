import { join } from 'node:path';
import { atomicRecord, isMissing, readProtected } from './files.js';

export type Health = 'READY' | 'UNAVAILABLE' | 'CHECK_FAILED';
type Settings = { state: string; timeZone: string; weekly: boolean; incidents: boolean };
type Event = { event: 'LOCAL_OPERATIONS'; kind: string; id: string; at: string; [key: string]: unknown };
type ReportState = { health?: Health; week?: string; incidents: number; sequence: number; pending?: Event[] };

function weekOf(now: Date, timeZone: string) {
  const entries = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => Number(entries.find((entry) => entry.type === name)?.value);
  const day = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

export class OperationsReporter {
  private readonly path: string;
  constructor(private readonly options: Settings, private readonly log: (event: Event) => void) {
    this.path = join(options.state, 'reporter.json');
  }

  observe(now: Date, health: Health, backup?: string) {
    if (!this.options.weekly && !this.options.incidents) return;
    let state: ReportState;
    try { state = JSON.parse(readProtected(this.path)); }
    catch (error) {
      if (!isMissing(error)) throw error;
      state = { incidents: 0, sequence: 0 };
    }
    const events: Event[] = state.pending ?? [];
    const event = (kind: string, id: string) => ({ event: 'LOCAL_OPERATIONS' as const, kind, id, at: now.toISOString() });
    if (this.options.incidents && health === 'CHECK_FAILED') {
      events.push(event('CHECK_FAILED', 'check-' + ++state.sequence));
    } else if (this.options.incidents && state.health !== health) {
      if (health === 'UNAVAILABLE') { state.incidents++; events.push(event('INCIDENT', 'incident-' + ++state.sequence)); }
      else if (state.health === 'UNAVAILABLE') events.push(event('RECOVERED', 'recovered-' + ++state.sequence));
      state.health = health;
    }
    const week = weekOf(now, this.options.timeZone);
    if (this.options.weekly && state.week !== week) {
      events.push({ ...event('WEEKLY', 'week-' + week), health, backup: backup ?? 'NONE', incidents: state.incidents });
      state.week = week;
      state.incidents = 0;
    }
    if (events.length) {
      // A restarted observer can re-emit the same stable ID if it stopped before journald saw it.
      atomicRecord(this.path, { ...state, pending: events });
      for (const item of events) this.log(item);
      atomicRecord(this.path, { ...state, pending: [] });
    }
  }
}
