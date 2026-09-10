import { describe, expect, it, vi } from 'vitest';
import { WebNotificationAdapter } from './WebNotificationAdapter.ts';

describe('WebNotificationAdapter', () => {
  it('handles environment without Notification gracefully', async () => {
    const adapter = new WebNotificationAdapter({ targetWindow: {} as unknown as Window });
    const granted = await adapter.requestPermission();
    expect(granted).toBe(false);

    await expect(adapter.notify({ title: 'Test', body: 'Msg' })).resolves.not.toThrow();
  });

  it('triggers Notification when permission is granted', async () => {
    const mockNotification = vi.fn();
    (mockNotification as unknown as { permission: string }).permission = 'granted';

    const mockWindow = {
      Notification: mockNotification,
    } as unknown as Window;

    const adapter = new WebNotificationAdapter({ targetWindow: mockWindow });
    await adapter.notify({ title: 'Đồng bộ xong', body: '1 bản ghi' });

    expect(mockNotification).toHaveBeenCalledWith(
      'Đồng bộ xong',
      expect.objectContaining({
        body: '1 bản ghi',
      })
    );
  });
});
