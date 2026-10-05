import { describe, expect, it } from 'vitest';
import { escapeHtml, timeAgo } from './utils';

describe('escapeHtml', () => {
  it('escapes user-provided markup before it is used in map popups', () => {
    expect(escapeHtml('<img src="x" onerror=alert(1)> & \'text\'')).toBe(
      '&lt;img src=&quot;x&quot; onerror=alert(1)&gt; &amp; &#39;text&#39;'
    );
  });
});

describe('timeAgo', () => {
  it('formats a recent time using the requested locale', () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 60_000).toISOString(), 'en')).toBe('1 minute ago');
    expect(timeAgo(new Date(now - 60_000).toISOString(), 'fr')).toBe('il y a 1 minute');
  });
});
