import { describe, it, expect } from 'vitest';
import { assertTransition } from '../modules/incidents/incident-lifecycle.js';

describe('lifecycle', () => {
  it('allows sequential transitions', () => {
    expect(() => assertTransition('NEW', 'ASSIGNED')).not.toThrow();
    expect(() => assertTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow();
    expect(() => assertTransition('RESOLVED', 'CLOSED')).not.toThrow();
  });
  it('rejects skips and invalid transitions', () => {
    expect(() => assertTransition('NEW', 'RESOLVED')).toThrow();
    expect(() => assertTransition('CLOSED', 'IN_PROGRESS')).toThrow();
  });
});
