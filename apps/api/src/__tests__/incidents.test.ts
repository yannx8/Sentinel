import { describe, it, expect } from 'vitest';
import { createIncident } from '../modules/incidents/incidents.schema.js';

describe('incident validation', () => {
  it('rejects short titles', () => {
    expect(
      createIncident.safeParse({
        title: 'bad',
        description: 'long enough description',
        category: 'LIGHTING',
        priority: 'HIGH',
        siteId: 'bad',
        latitude: 4,
        longitude: 9
      }).success
    ).toBe(false);
  });
});
