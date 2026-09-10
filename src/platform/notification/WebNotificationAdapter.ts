import type { NotificationPayload, NotificationPort } from '../../domain/ports.ts';

export interface WebNotificationAdapterOptions {
  readonly targetWindow?: Window;
}

export class WebNotificationAdapter implements NotificationPort {
  private readonly targetWindow: Window | undefined;

  constructor(options?: WebNotificationAdapterOptions) {
    this.targetWindow =
      options?.targetWindow ?? (typeof window !== 'undefined' ? window : undefined);
  }

  private getNotificationApi(): typeof Notification | undefined {
    if (!this.targetWindow) return undefined;
    const candidate = (this.targetWindow as unknown as { Notification?: typeof Notification })
      .Notification;
    return typeof candidate === 'function' ? candidate : undefined;
  }

  public async requestPermission(): Promise<boolean> {
    const NotificationApi = this.getNotificationApi();
    if (!NotificationApi) {
      return false;
    }
    try {
      if (NotificationApi.permission === 'granted') {
        return true;
      }
      if (NotificationApi.permission === 'denied') {
        return false;
      }
      const permission = await NotificationApi.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  public async notify(payload: NotificationPayload): Promise<void> {
    const NotificationApi = this.getNotificationApi();
    if (!NotificationApi) {
      return;
    }
    try {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
      new NotificationApi(payload.title, {
        body: payload.body,
        icon: '/branding/vku-field-survey-192.png',
      });
    } catch (err) {
      console.warn('Web notification dispatch failed:', err);
    }
  }
}
