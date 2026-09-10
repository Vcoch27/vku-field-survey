import type { GeolocationPort, GeolocationPosition } from '../../domain/ports.ts';

export interface WebGeolocationAdapterOptions {
  readonly targetNavigator?: Navigator;
}

export class WebGeolocationAdapter implements GeolocationPort {
  private readonly targetNavigator: Navigator | undefined;

  constructor(options?: WebGeolocationAdapterOptions) {
    this.targetNavigator =
      options?.targetNavigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  }

  public async getCurrentPosition(): Promise<GeolocationPosition | null> {
    if (!this.targetNavigator || !('geolocation' in this.targetNavigator)) {
      return null;
    }

    return new Promise((resolve) => {
      this.targetNavigator!.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude ?? null,
            capturedAt: new Date(pos.timestamp).toISOString(),
          });
        },
        (err) => {
          console.warn('Web Geolocation error:', err.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 5_000,
        }
      );
    });
  }
}
