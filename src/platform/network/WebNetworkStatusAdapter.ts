import type { NetworkStatus, NetworkStatusPort, Unsubscribe } from '../../domain/ports.ts';

export class WebNetworkStatusAdapter implements NetworkStatusPort {
  private readonly targetWindow: Window | undefined;

  constructor(
    targetWindow: Window | undefined = typeof window !== 'undefined' ? window : undefined
  ) {
    this.targetWindow = targetWindow;
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    if (this.targetWindow?.navigator) {
      return { isConnected: this.targetWindow.navigator.onLine };
    }
    return { isConnected: true };
  }

  subscribe(listener: (status: NetworkStatus) => void): Unsubscribe {
    if (!this.targetWindow) {
      return () => undefined;
    }

    const handleOnline = () => listener({ isConnected: true });
    const handleOffline = () => listener({ isConnected: false });

    this.targetWindow.addEventListener('online', handleOnline);
    this.targetWindow.addEventListener('offline', handleOffline);

    return () => {
      this.targetWindow?.removeEventListener('online', handleOnline);
      this.targetWindow?.removeEventListener('offline', handleOffline);
    };
  }
}
