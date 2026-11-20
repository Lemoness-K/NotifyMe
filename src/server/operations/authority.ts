import { createHmac, timingSafeEqual } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppError } from '../errors.js';
import { atomicRecord, readProtected } from './files.js';

export type JournalPoint = { position: number; digest: string };
export type JournalHead = { lineage: string; floor: JournalPoint; tip: JournalPoint; floorProof: string };
const digestPattern = /^[0-9a-f]{64}$/;

function mac(key: Buffer, domain: string, data: unknown) {
  return createHmac('sha256', key).update(JSON.stringify([domain, data])).digest('hex');
}

export function samePoint(left: JournalPoint, right: JournalPoint) {
  return left.position === right.position && left.digest === right.digest;
}

function point(value: unknown): value is JournalPoint {
  if (!value || typeof value !== 'object') return false;
  const p = value as JournalPoint;
  return Number.isSafeInteger(p.position) && p.position >= 0 && typeof p.digest === 'string' && digestPattern.test(p.digest);
}

export function requireJournalPoint(value: unknown): JournalPoint {
  if (!point(value)) throw new Error('RECOVERY_POINT_INVALID');
  return value;
}

export function sameHead(left: JournalHead, right: JournalHead) {
  return left.lineage === right.lineage && left.floorProof === right.floorProof &&
    samePoint(left.floor, right.floor) && samePoint(left.tip, right.tip);
}

type MediaOptions = {
  root: string;
  volumeId: string;
  key: Buffer;
  mounted?: (device: number) => boolean;
};

export class JournalAuthority {
  constructor(private readonly media: MediaOptions) {
    if (media.key.length !== 32) throw new Error('OPERATIONS_KEY_INVALID');
  }

  private inside<T>(action: (name: string) => T): T {
    let descriptor: number | undefined;
    try {
      descriptor = openSync(this.media.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const root = '/proc/self/fd/' + descriptor;
      const device = fstatSync(descriptor).dev;
      const mounted = this.media.mounted?.(device) ?? device !== statSync(dirname(this.media.root)).dev;
      if (!mounted || readProtected(join(root, 'notify-me-volume')).trim() !== this.media.volumeId) {
        throw new Error('Identity mismatch');
      }
      return action(join(root, 'delete-head.json'));
    } catch {
      throw new AppError(503, 'RECOVERY_AUTHORITY_UNAVAILABLE');
    } finally { if (descriptor !== undefined) closeSync(descriptor); }
  }

  extendsPoint(lineage: string, previous: JournalPoint, row: {
    position: number; requestId: string; householdId: string; reminderId: string; digest: string;
    at: string; state: string; revision: number | null;
  }): JournalPoint {
    if (row.position !== previous.position + 1) throw new AppError(503, 'RECOVERY_JOURNAL_GAP');
    return { position: row.position, digest: mac(this.media.key, 'notify-delete-row-v1', [
      lineage, previous.digest, row.position, row.requestId, row.householdId, row.reminderId,
      row.digest, row.at, row.state, row.revision,
    ]) };
  }

  private signature(head: JournalHead) {
    return mac(this.media.key, 'notify-authority-v2',
      [head.lineage, head.floor.position, head.floor.digest, head.tip.position, head.tip.digest, head.floorProof]);
  }

  private decode(name: string): JournalHead {
    const { lineage, floor, tip, floorProof, signature } = JSON.parse(readProtected(name));
    const head = { lineage, floor, tip, floorProof };
    if (typeof lineage !== 'string' || !lineage || !point(floor) || !point(tip) || tip.position < floor.position ||
        typeof floorProof !== 'string' || !digestPattern.test(floorProof) ||
        typeof signature !== 'string' || !digestPattern.test(signature) ||
        !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.signature(head), 'hex'))) {
      throw new Error('Untrusted deletion head');
    }
    return head;
  }

  read() { return this.inside((path) => this.decode(path)); }

  baseline(lineage: string, position: number, floorProof: string) {
    if (!digestPattern.test(floorProof)) throw new Error('RECOVERY_DATABASE_PROOF_INVALID');
    const base = requireJournalPoint({ position, digest: mac(this.media.key, 'notify-delete-base-v1', [lineage, position]) });
    const head = { lineage, floor: base, tip: base, floorProof };
    return this.inside((path) => {
      atomicRecord(path, { ...head, signature: this.signature(head) }, false);
      return head;
    });
  }

  advance(previous: JournalHead, next: JournalHead) {
    return this.inside((path) => {
      const current = this.decode(path);
      if (next.lineage !== previous.lineage || !digestPattern.test(next.floorProof) || next.tip.position < previous.tip.position ||
          next.floor.position < previous.floor.position || next.floor.position > next.tip.position ||
          (next.floor.position === previous.floor.position && next.floorProof !== previous.floorProof) ||
          !sameHead(current, previous)) {
        throw new Error('Deletion head changed');
      }
      atomicRecord(path, { ...next, signature: this.signature(next) });
      return next;
    });
  }
}
