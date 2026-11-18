import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App, errorText, localeFor } from '../../src/web/App.js';

describe('U1 shared UI', () => {
  it('renders an accessible primary heading and login entry', () => {
    const markup = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(App)));
    expect(markup).toMatch(/<h1[^>]*>Notify Me<\/h1>/);
    expect(markup).toMatch(/로그인|Sign in/);
  });

  it('supports the two approved locales and falls back to Korean', () => {
    expect(localeFor('ko-KR')).toBe('ko-KR');
    expect(localeFor('en-US')).toBe('en-US');
    expect(localeFor('fr-FR')).toBe('ko-KR');
  });

  it('turns stable error codes into localized UI text without exposing the code', () => {
    expect(errorText('ko-KR', 'AUTH_PROVIDER_UNAVAILABLE')).not.toBe(errorText('en-US', 'AUTH_PROVIDER_UNAVAILABLE'));
    expect(errorText('ko-KR', 'unknown')).toBeTruthy();
    expect(errorText('ko-KR', 'SECRET_DATA')).not.toContain('SECRET_DATA');
  });
});
