import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotification } from '../modules/notifications/notifications.service.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    notification: {
      create: vi.fn()
    }
  }
}));

describe('notifications service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notification with correct fields', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const mockCreate = vi.fn().mockResolvedValue({ id: '1' });
    prisma.notification.create = mockCreate;

    await createNotification(
      'org-1',
      'membership-123',
      'ASSIGNED',
      'Test Title',
      'Test Body',
      'incident-456'
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        recipientMembershipId: 'membership-123',
        eventType: 'ASSIGNED',
        title: 'Test Title',
        body: 'Test Body',
        incidentId: 'incident-456'
      }
    });
  });

  it('handles errors gracefully without throwing', async () => {
    const { prisma } = await import('../lib/prisma.js');
    prisma.notification.create = vi.fn().mockRejectedValue(new Error('DB error'));

    await expect(
      createNotification('org-1', 'membership-123', 'ASSIGNED', 'Title', 'Body')
    ).resolves.not.toThrow();
  });
});
