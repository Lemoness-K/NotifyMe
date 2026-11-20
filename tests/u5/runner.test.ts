import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { mediaToken, operationsFixture } from './fixture.js';

it('keeps fixture authority and runtime paths separate', () => {
  const fixture = operationsFixture();
  try {
    expect(fixture.volume).not.toBe(fixture.state);
    expect(readFileSync(fixture.volume + '/notify-me-volume', 'utf8')).toBe(mediaToken);
  } finally {
    fixture.close();
  }
});
