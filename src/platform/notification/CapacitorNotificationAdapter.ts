import { LocalNotifications, type LocalNotificationsPlugin } from '@capacitor/local-notifications';
import type { NotificationPayload, NotificationPort } from '../../domain/ports.ts';

export const VKU_SYNC_NOTIFICATION_CHANNEL_ID = 'vku_sync_channel';

export interface CapacitorNotificationAdapterOptions {
  readonly plugin?: LocalNotificationsPlugin;
}

export class CapacitorNotificationAdapter implements NotificationPort {
  private readonly plugin: LocalNotificationsPlugin;
  private channelCreated = false;

  constructor(options?: CapacitorNotificationAdapterOptions) {
    this.plugin = options?.plugin ?? LocalNotifications;
  }

  private async ensureChannel(): Promise<void> {
    if (this.channelCreated) {
      return;
    }
    try {
      if (typeof this.plugin.createChannel === 'function') {
        await this.plugin.createChannel({
          id: VKU_SYNC_NOTIFICATION_CHANNEL_ID,
          name: 'VKU Survey Sync',
          description: 'Thông báo trạng thái đồng bộ khảo sát ngoại tuyến VKU',
          importance: 4,
          visibility: 1,
          vibration: true,
        });
      }
      this.channelCreated = true;
    } catch (err) {
      console.warn('Could not create notification channel:', err);
    }
  }

  public async requestPermission(): Promise<boolean> {
    try {
      const status = await this.plugin.checkPermissions();
      if (status.display === 'granted') {
        return true;
      }
      const requested = await this.plugin.requestPermissions();
      return requested.display === 'granted';
    } catch (err) {
      console.warn('Failed to check or request notification permissions:', err);
      return false;
    }
  }

  public async notify(payload: NotificationPayload): Promise<void> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Notification permission not granted; skipping notification.');
        return;
      }

      await this.ensureChannel();

      const notificationId = payload.id ?? Math.floor(Math.random() * 100000) + 1;

      await this.plugin.schedule({
        notifications: [
          {
            id: notificationId,
            title: payload.title,
            body: payload.body,
            channelId: VKU_SYNC_NOTIFICATION_CHANNEL_ID,
            smallIcon: 'ic_vku_notification',
            largeIcon: 'ic_vku_notification',
            iconColor: '#0054a6',
          },
        ],
      });
    } catch (err) {
      console.warn('Failed to schedule local notification:', err);
    }
  }
}
