import { describe, expect, it, vi } from 'vitest';
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications';
import {
  CapacitorNotificationAdapter,
  VKU_SYNC_NOTIFICATION_CHANNEL_ID,
} from './CapacitorNotificationAdapter.ts';

describe('CapacitorNotificationAdapter', () => {
  it('requests permissions and creates notification channel before scheduling', async () => {
    const mockPlugin: Partial<LocalNotificationsPlugin> = {
      checkPermissions: vi.fn().mockResolvedValue({ display: 'prompt' }),
      requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      createChannel: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue({ notifications: [] }),
    };

    const adapter = new CapacitorNotificationAdapter({
      plugin: mockPlugin as LocalNotificationsPlugin,
    });

    await adapter.notify({
      id: 101,
      title: 'Đồng bộ thành công',
      body: 'Đã tải lên 2 bản ghi.',
    });

    expect(mockPlugin.checkPermissions).toHaveBeenCalledTimes(1);
    expect(mockPlugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(mockPlugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: VKU_SYNC_NOTIFICATION_CHANNEL_ID,
      })
    );
    expect(mockPlugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 101,
          title: 'Đồng bộ thành công',
          body: 'Đã tải lên 2 bản ghi.',
          channelId: VKU_SYNC_NOTIFICATION_CHANNEL_ID,
        }),
      ],
    });
  });

  it('skips scheduling when permission is denied', async () => {
    const mockPlugin: Partial<LocalNotificationsPlugin> = {
      checkPermissions: vi.fn().mockResolvedValue({ display: 'denied' }),
      requestPermissions: vi.fn().mockResolvedValue({ display: 'denied' }),
      schedule: vi.fn(),
    };

    const adapter = new CapacitorNotificationAdapter({
      plugin: mockPlugin as LocalNotificationsPlugin,
    });

    await adapter.notify({
      title: 'Đồng bộ',
      body: 'Nội dung',
    });

    expect(mockPlugin.schedule).not.toHaveBeenCalled();
  });
});
